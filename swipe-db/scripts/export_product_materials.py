#!/usr/bin/env python3
import argparse
import json
import os
import re
import sqlite3
import subprocess
import time
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_DB = ROOT / "meta_ads_swipe.db"
WEB_ROOT = ROOT / "web"
MANIFEST_PATH = WEB_ROOT / "data" / "product-materials-manifest.json"
PUBLIC_MATERIALS = WEB_ROOT / "public" / "materials"

PRODUCT_COLLECTIONS = {
    67305476: {"title": "Produtos Prontos", "parent_id": None},
    67305477: {"title": "Teste", "parent_id": 67305476},
    67305518: {"title": "Receitas para Diabeticos", "parent_id": 67305476},
    67645342: {"title": "Metaforas 1.500 e Terapeuticas", "parent_id": 67305476},
    68197259: {"title": "Religioso", "parent_id": 67305476},
    68197408: {"title": "Croche", "parent_id": 67305476},
    68197500: {"title": "Estudos - Concurso", "parent_id": 67305476},
    68197531: {"title": "Infantil - Educacao", "parent_id": 67305476},
    68392380: {"title": "Receitas", "parent_id": 67305476},
    68922929: {"title": "Baralho Cigano", "parent_id": 67305476},
    69540145: {"title": "4 Tipos de Potes", "parent_id": 67305476},
    68197264: {"title": "Pack 5.000 Sermoes Prontos", "parent_id": 68197259},
    67964992: {"title": "Jogos Biblicos", "parent_id": 68197259},
    67882484: {"title": "Jejum de Daniel 21 Dias + Bonus", "parent_id": 68197259},
    67866510: {"title": "Salmografia", "parent_id": 68197259},
    67305746: {"title": "Cartas de Paulo 2", "parent_id": 68197259},
    67591834: {"title": "Cristao", "parent_id": 68197259},
    67309473: {"title": "10.000 Musicas Gospel", "parent_id": 68197259},
    67305772: {"title": "Mapas Mentais Biblia", "parent_id": 68197259},
    67305813: {"title": "Resumo Biblia", "parent_id": 68197259},
    67305690: {"title": "150 Salmos Explicados", "parent_id": 68197259},
    67305532: {"title": "Cartas de Paulo", "parent_id": 68197259},
    67305761: {"title": "150 salmos 2", "parent_id": 68197259},
    68923065: {"title": "365 Versiculos para o Dia a Dia", "parent_id": 68197259},
    67964276: {"title": "Colecao Orixas", "parent_id": 68197408},
    67407797: {"title": "Croche Patterns", "parent_id": 68197408},
    67305802: {"title": "Amigurumis Kids", "parent_id": 68197408},
    68340430: {"title": "INSS 2026", "parent_id": 68197500},
    68352180: {"title": "Eletricista", "parent_id": 68197500},
    68780445: {"title": "Petrobras", "parent_id": 68197500},
    67898816: {"title": "Grafismo Fonetico", "parent_id": 68197531},
    67965801: {"title": "Caixinha de Leitura + Caligrafia", "parent_id": 68197531},
    67647141: {"title": "Comunicacao Alternativa", "parent_id": 68197531},
    67500338: {"title": "Caligrafia", "parent_id": 68197531},
    67305855: {"title": "Grafismo Fonetico 3", "parent_id": 68197531},
    67305824: {"title": "Atividades Infantis", "parent_id": 68197531},
    67305911: {"title": "5000 Atividades", "parent_id": 68197531},
    67305784: {"title": "Grafismo Fonetico", "parent_id": 68197531},
    67305713: {"title": "Kit Grafismo Fonetico", "parent_id": 68197531},
    68922980: {"title": "Rotinas", "parent_id": 68197531},
    67547465: {"title": "200 Receitas para Diabeticos", "parent_id": 68392380},
    67309489: {"title": "paes para diabeticos", "parent_id": 68392380},
    67309481: {"title": "Receitas para Diabetes", "parent_id": 68392380},
}


def slug(value):
    text = (value or "").lower()
    text = text.encode("ascii", "ignore").decode("ascii")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return text or "sem-titulo"


def filename_for(row):
    title = row["title"] or Path(urllib.parse.urlparse(row["link"] or "").path).name or str(row["raindrop_id"])
    suffix = Path(title).suffix
    if not suffix:
        suffix = Path(urllib.parse.urlparse(row["link"] or "").path).suffix
    base = slug(Path(title).stem)
    return f"{row['raindrop_id']}-{base}{suffix or ''}"


def launchctl_getenv(name):
    try:
      result = subprocess.run(["launchctl", "getenv", name], capture_output=True, text=True, check=False)
    except OSError:
      return ""
    return result.stdout.strip()


def raindrop_file_url(row):
    link = row["link"] or ""
    if "api.raindrop.io/" in link:
        return link
    return link


def fetch_rows(db_path):
    ids = ",".join(str(collection_id) for collection_id in PRODUCT_COLLECTIONS)
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        f"""
        SELECT raindrop_id, title, link, domain, item_type, collection_id, created_at, last_update
        FROM raindrop_items
        WHERE collection_id IN ({ids})
        ORDER BY collection_id, raindrop_id
        """
    ).fetchall()
    conn.close()
    return rows


def looks_like_error_page(data):
    sample = data[:512].lstrip().lower()
    return sample.startswith(b"<!doctype") or sample.startswith(b"<html") or sample.startswith(b"<?xml")


def download_file(url, destination, token="", retries=2):
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and destination.stat().st_size > 0:
        return "exists", destination.stat().st_size
    headers = {"User-Agent": "BusinessHubMaterialExporter/1.0"}
    if token and "api.raindrop.io/" in url:
        headers["Authorization"] = f"Bearer {token}"
    last_error = None
    for attempt in range(retries + 1):
        try:
            request = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(request, timeout=120) as response:
                data = response.read()
            if looks_like_error_page(data):
                destination.unlink(missing_ok=True)
                return "error: auth_or_signed_url_required", 0
            destination.write_bytes(data)
            return "downloaded", len(data)
        except Exception as exc:
            last_error = str(exc)
            if attempt < retries:
                time.sleep(1 + attempt)
    return f"error: {last_error}", 0


def build_manifest(rows, download=True, limit=None, token=""):
    downloaded = 0
    downloadable = 0
    errors = 0
    items = []
    rows = rows[:limit] if limit else rows
    for row in rows:
        collection = PRODUCT_COLLECTIONS.get(row["collection_id"], {})
        collection_slug = slug(collection.get("title") or str(row["collection_id"]))
        is_raindrop_file = (row["domain"] or "").lower() == "up.raindrop.io"
        local_url = None
        local_size = 0
        download_status = "external"
        if is_raindrop_file:
            downloadable += 1
            name = filename_for(row)
            relative_path = Path("materials") / collection_slug / name
            destination = WEB_ROOT / "public" / relative_path
            local_url = "/" + relative_path.as_posix()
            r2_key = relative_path.as_posix()
            if download:
                download_status, local_size = download_file(raindrop_file_url(row), destination, token=token)
                if download_status in {"downloaded", "exists"}:
                    downloaded += 1
                else:
                    errors += 1
            else:
                download_status = "pending"
        items.append(
            {
                "id": row["raindrop_id"],
                "title": row["title"],
                "type": row["item_type"] or "link",
                "domain": row["domain"],
                "sourceUrl": row["link"],
                "collectionId": row["collection_id"],
                "collectionTitle": collection.get("title") or str(row["collection_id"]),
                "parentCollectionId": collection.get("parent_id"),
                "localUrl": local_url,
                "r2Key": r2_key if is_raindrop_file else None,
                "localSize": local_size,
                "downloadStatus": download_status,
                "createdAt": row["created_at"],
                "lastUpdate": row["last_update"],
            }
        )
    collections = []
    for collection_id, collection in PRODUCT_COLLECTIONS.items():
        collection_items = [item for item in items if item["collectionId"] == collection_id]
        if not collection_items and collection_id != 67305476:
            continue
        collections.append(
            {
                "id": collection_id,
                "title": collection["title"],
                "parentId": collection["parent_id"],
                "items": len(collection_items),
                "downloaded": sum(1 for item in collection_items if item["downloadStatus"] in {"downloaded", "exists"}),
                "external": sum(1 for item in collection_items if item["downloadStatus"] == "external"),
            }
        )
    return {
        "source": {
            "collectionId": 67305476,
            "title": "Produtos Prontos",
            "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        },
        "summary": {
            "items": len(items),
            "downloadable": downloadable,
            "downloaded": downloaded,
            "external": len(items) - downloadable,
            "errors": errors,
        },
        "collections": collections,
        "items": items,
    }


def main():
    parser = argparse.ArgumentParser(description="Export Produtos Prontos from local Raindrop DB into local project files.")
    parser.add_argument("--db", default=str(DEFAULT_DB))
    parser.add_argument("--no-download", action="store_true")
    parser.add_argument("--raindrop-token", default=os.environ.get("RAINDROP_ACCESS_TOKEN") or launchctl_getenv("RAINDROP_ACCESS_TOKEN"))
    parser.add_argument("--limit", type=int)
    args = parser.parse_args()

    rows = fetch_rows(args.db)
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    PUBLIC_MATERIALS.mkdir(parents=True, exist_ok=True)
    manifest = build_manifest(rows, download=not args.no_download, limit=args.limit, token=args.raindrop_token)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(manifest["summary"], ensure_ascii=False, indent=2))
    print(f"Manifest: {MANIFEST_PATH}")


if __name__ == "__main__":
    main()
