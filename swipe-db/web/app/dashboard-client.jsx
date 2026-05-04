"use client";

import {
  ArrowLeft,
  Archive,
  Bookmark,
  Boxes,
  Download,
  ExternalLink,
  FileSearch,
  Filter,
  GalleryVerticalEnd,
  LayoutDashboard,
  ListFilter,
  RefreshCw,
  Search,
  Star,
  Table2,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { hubTools, productHub, productManifest } from "../lib/product-materials";

const nav = [
  { id: "overview", label: "HUB", icon: LayoutDashboard },
  { id: "materials", label: "Materiais", icon: Archive },
  { id: "ads", label: "Anúncios", icon: GalleryVerticalEnd },
  { id: "pages", label: "Anunciantes", icon: Table2 },
  { id: "favorites", label: "Favoritos", icon: Star },
  { id: "imports", label: "Buscas", icon: FileSearch },
  { id: "raindrop", label: "Raindrop", icon: Bookmark },
];

function routeFromWindow() {
  if (typeof window === "undefined") return { view: "overview", pageFilter: null, adId: null };
  const path = window.location.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  const params = new URLSearchParams(window.location.search);
  const pageName = params.get("name") || params.get("page_name") || "Anunciante";
  if (path[0] === "anunciantes" && path[1]) {
    return {
      view: "ads",
      pageFilter: { page_id: path[1], page_name: pageName },
      adId: path[2] === "anuncios" ? path[3] || null : null,
    };
  }
  if (path[0] === "anunciantes") return { view: "pages", pageFilter: null, adId: null };
  if (path[0] === "favoritos") return { view: "favorites", pageFilter: null, adId: null };
  if (path[0] === "anuncios") return { view: "ads", pageFilter: null, adId: path[1] || null };
  if (path[0] === "anuncio") return { view: "ads", pageFilter: null, adId: path[1] || null };
  if (path[0] === "buscas") return { view: "imports", pageFilter: null, adId: null };
  if (path[0] === "raindrop") return { view: "raindrop", pageFilter: null, adId: null };
  if (path[0] === "materiais") return { view: "materials", pageFilter: null, adId: null };
  return { view: "overview", pageFilter: null, adId: null };
}

function routeUrl({ view, pageFilter, adId }) {
  const params = new URLSearchParams();
  if (pageFilter?.page_name) params.set("name", pageFilter.page_name);
  const query = params.toString();
  const suffix = query ? `?${query}` : "";
  if (pageFilter?.page_id && adId) return `/anunciantes/${encodeURIComponent(pageFilter.page_id)}/anuncios/${encodeURIComponent(adId)}${suffix}`;
  if (pageFilter?.page_id) return `/anunciantes/${encodeURIComponent(pageFilter.page_id)}${suffix}`;
  if (adId) return `/anuncio/${encodeURIComponent(adId)}`;
  if (view === "ads") return "/anuncios";
  if (view === "pages") return "/anunciantes";
  if (view === "favorites") return "/favoritos";
  if (view === "imports") return "/buscas";
  if (view === "raindrop") return "/raindrop";
  if (view === "materials") return "/materiais";
  return "/";
}

function initialSearchParam(name, fallback = "") {
  if (typeof window === "undefined") return fallback;
  return new URLSearchParams(window.location.search).get(name) ?? fallback;
}

function initialIntSearchParam(name, fallback = 0) {
  const value = Number.parseInt(initialSearchParam(name, String(fallback)), 10);
  return Number.isNaN(value) ? fallback : value;
}

const number = (value) => new Intl.NumberFormat("pt-BR").format(value || 0);
const bytes = (value) => {
  const size = Number(value || 0);
  if (!size) return "-";
  if (size < 1024 * 1024) return `${number(Math.round(size / 1024))} KB`;
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(size / (1024 * 1024))} MB`;
};
const safe = (value) => (value === null || value === undefined || value === "" ? "-" : String(value));
const truncate = (value, size = 160) => {
  const text = safe(value);
  return text.length > size ? `${text.slice(0, size - 1)}...` : text;
};
const metaAdLibraryAdUrl = (adArchiveId) => `https://www.facebook.com/ads/library/?id=${encodeURIComponent(adArchiveId)}`;
const metaAdLibraryPageUrl = (pageId) => {
  const params = new URLSearchParams({
    active_status: "active",
    ad_type: "all",
    country: "ALL",
    media_type: "all",
    search_type: "page",
    view_all_page_id: pageId,
  });
  return `https://www.facebook.com/ads/library/?${params.toString()}`;
};

async function api(path) {
  const response = await fetch(path, { cache: "no-store" });
  if (!response.ok) throw new Error(`Erro ${response.status}: ${path}`);
  return response.json();
}

async function favoritePage(pageId, shouldFavorite) {
  const response = await fetch(`/api/pages/${encodeURIComponent(pageId)}/favorite`, {
    method: shouldFavorite ? "POST" : "DELETE",
    headers: shouldFavorite ? { "Content-Type": "application/json" } : undefined,
    body: shouldFavorite ? JSON.stringify({}) : undefined,
  });
  if (!response.ok) throw new Error(`Erro ${response.status}: favorito`);
  return response.json();
}

async function syncPageLibrary(pageId) {
  const response = await fetch(`/api/pages/${encodeURIComponent(pageId)}/sync`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ max_items: 10000, wait_secs: 1200 }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || data.error || `Erro ${response.status}: sync`);
  return data;
}

async function deleteAd(adId) {
  const response = await fetch(`/api/ad/${encodeURIComponent(adId)}`, { method: "DELETE" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro ${response.status}: excluir anúncio`);
  return data;
}

async function deleteAdvertiser(pageId) {
  const response = await fetch(`/api/pages/${encodeURIComponent(pageId)}`, { method: "DELETE" });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Erro ${response.status}: excluir anunciante`);
  return data;
}

function Chip({ children, tone = "neutral" }) {
  return <span className={`chip ${tone}`}>{children}</span>;
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{number(value)}</strong>
    </div>
  );
}

function Bars({ title, rows = [] }) {
  const max = Math.max(...rows.map((row) => row.count || 0), 1);
  return (
    <section className="bars">
      <h3>{title}</h3>
      {rows.map((row) => (
        <div className="bar-row" key={row.label}>
          <div className="bar-body" title={row.label}>
            <div className="bar-label">{row.label}</div>
            <div className="bar-track">
              <div className="bar-fill" style={{ width: `${Math.round((row.count / max) * 100)}%` }} />
            </div>
          </div>
          <strong>{number(row.count)}</strong>
        </div>
      ))}
    </section>
  );
}

function AdCopy({ row }) {
  return truncate(row.body_text || row.title || row.caption || row.link_description || "", 210);
}

function Shell({ activeView, navigateView, children, refresh, notice }) {
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brandMark">MS</span>
          <div>
            <strong>Business HUB</strong>
            <small>Produtos, anúncios e materiais</small>
          </div>
        </div>
        <nav>
          {nav.map((item) => {
            const Icon = item.icon;
            return (
              <button
                className={`navButton ${activeView === item.id ? "active" : ""}`}
                key={item.id}
                onClick={() => navigateView(item.id)}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>
      </aside>
      <main>
        <header className="topbar">
          <div>
            <h1>HUB interno do negócio</h1>
            <p>Produtos prontos, criativos, anúncios, buscas e bookmarks organizados em um só lugar.</p>
          </div>
          <button className="primaryButton" onClick={refresh}>
            <RefreshCw size={16} />
            Atualizar
          </button>
        </header>
        {notice ? <div className="notice">{notice}</div> : null}
        {children}
      </main>
    </div>
  );
}

function Overview({ summary, openAd }) {
  if (!summary) return <Panel title="Carregando">Lendo SQLite...</Panel>;
  const t = summary.totals;
  const r = summary.raindrop;
  const productTotal = productHub.collections.reduce((total, collection) => total + collection.count, productHub.directItems);
  const highPriority = productHub.collections.filter((collection) => collection.priority === "Alta").length;
  return (
    <div className="viewStack">
      <div className="metricsGrid">
        <Metric label="Produtos prontos" value={productTotal} />
        <Metric label="Coleções mapeadas" value={productHub.collections.length} />
        <Metric label="Prioridade alta" value={highPriority} />
        <Metric label="Anúncios capturados" value={t.ads} />
        <Metric label="Anunciantes capturados" value={t.pages} />
        <Metric label="Favoritos" value={t.favorite_pages} />
        <Metric label="Mídias" value={t.media} />
        <Metric label="Buscas" value={t.imports} />
        <Metric label="Ativos capturados" value={t.active_ads} />
        <Metric label="Média dias ativos" value={t.avg_active_days} />
        <Metric label="Raindrop relevantes" value={r.relevant} />
        <Metric label="Ads via Raindrop" value={r.ads_inserted} />
      </div>

      <div className="split">
        <Panel title="Ferramentas do HUB" hint="Módulos internos">
          <div className="toolGrid">
            {hubTools.map((tool) => (
              <a className="toolCard" href={tool.route} key={tool.title}>
                <span className="toolIcon"><Boxes size={18} /></span>
                <strong>{tool.title}</strong>
                <p>{tool.description}</p>
                <span>{tool.status}</span>
              </a>
            ))}
          </div>
        </Panel>
        <Panel title="Anúncios com maior duração" hint="Ordenado por dias ativos">
          <div className="compactList">
            {summary.durable_ads.map((row) => (
              <button className="compactItem" key={row.ad_archive_id} onClick={() => openAd(row.ad_archive_id)}>
                <div className="compactTitle">{row.page_name}</div>
                <p>{AdCopy({ row })}</p>
                <div className="chips">
                  <Chip tone="green">{number(row.active_days)} dias</Chip>
                  <Chip>{row.cta_text || "Sem CTA"}</Chip>
                  <Chip>{row.display_format || "Sem formato"}</Chip>
                  {row.has_videos ? <Chip tone="amber">Vídeo</Chip> : null}
                </div>
              </button>
            ))}
          </div>
        </Panel>
      </div>

      <div className="split">
        <Panel title="Produtos prontos prioritários" hint="Baseado no Raindrop">
          <div className="compactList">
            {productHub.collections.filter((collection) => collection.priority === "Alta").map((collection) => (
              <a className="compactItem" href="/materiais" key={collection.id}>
                <div className="compactTitle">{collection.title}</div>
                <p>{collection.angle}</p>
                <div className="chips">
                  <Chip tone="green">{number(collection.count)} itens</Chip>
                  <Chip>{collection.market}</Chip>
                  <Chip tone="amber">{collection.status}</Chip>
                </div>
              </a>
            ))}
          </div>
        </Panel>
        <Panel title="Distribuição real" hint="CTA, formato e domínios">
          <div className="chartStack">
            <Bars title="CTAs" rows={summary.top_ctas} />
            <Bars title="Formatos" rows={summary.top_formats} />
            <Bars title="Domínios" rows={summary.top_domains} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function MaterialsView({ isActive }) {
  const [query, setQuery] = useState(() => initialSearchParam("q"));
  const [market, setMarket] = useState(() => initialSearchParam("market"));
  const [priority, setPriority] = useState(() => initialSearchParam("priority"));
  const [status, setStatus] = useState(() => initialSearchParam("status"));
  const markets = useMemo(() => [...new Set(productHub.collections.map((item) => item.market))].sort(), []);
  const priorities = ["Alta", "Média", "Baixa"];
  const statuses = useMemo(() => [...new Set(productHub.collections.map((item) => item.status))].sort(), []);
  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return productHub.collections.filter((item) => {
      const haystack = `${item.title} ${item.market} ${item.status} ${item.angle} ${item.nextAction} ${item.samples.join(" ")}`.toLowerCase();
      if (term && !haystack.includes(term)) return false;
      if (market && item.market !== market) return false;
      if (priority && item.priority !== priority) return false;
      if (status && item.status !== status) return false;
      return true;
    });
  }, [market, priority, query, status]);
  const filteredFiles = useMemo(() => {
    const collectionIds = new Set(filtered.map((item) => item.id));
    const childByParent = productManifest.collections.reduce((acc, collection) => {
      if (!collection.parentId) return acc;
      acc[collection.parentId] = acc[collection.parentId] || [];
      acc[collection.parentId].push(collection.id);
      return acc;
    }, {});
    const include = new Set(collectionIds);
    const queue = [...collectionIds];
    while (queue.length) {
      const current = queue.shift();
      for (const child of childByParent[current] || []) {
        if (include.has(child)) continue;
        include.add(child);
        queue.push(child);
      }
    }
    const term = query.trim().toLowerCase();
    return productManifest.items.filter((item) => {
      if (!include.has(item.collectionId)) return false;
      if (!term) return true;
      return `${item.title} ${item.collectionTitle} ${item.domain} ${item.type}`.toLowerCase().includes(term);
    });
  }, [filtered, query]);
  const totalFiles = filtered.reduce((sum, item) => sum + item.count, 0);
  const r2ReadyFiles = filteredFiles.filter((item) => item.r2Uploaded || (item.r2Status === "uploaded"));
  const localFiles = filteredFiles.filter((item) => item.localUrl && ["downloaded", "exists"].includes(item.downloadStatus));
  useEffect(() => {
    if (!isActive) return;
    const search = new URLSearchParams();
    if (query) search.set("q", query);
    if (market) search.set("market", market);
    if (priority) search.set("priority", priority);
    if (status) search.set("status", status);
    const queryString = search.toString();
    window.history.replaceState({ view: "materials", pageFilter: null, adId: null }, "", queryString ? `/materiais?${queryString}` : "/materiais");
  }, [isActive, market, priority, query, status]);
  const clear = () => {
    setQuery("");
    setMarket("");
    setPriority("");
    setStatus("");
  };
  return (
    <div className="viewStack">
      <section className="materialsHero">
        <div>
          <h2>{productHub.source.name}</h2>
          <p>Catálogo inicial dos materiais prontos lidos no Raindrop, organizado para virar produtos, páginas, criativos e pesquisas de validação.</p>
        </div>
        <div className="materialsStats">
          <Metric label="Itens no Raindrop" value={productHub.source.totalItems} />
          <Metric label="Itens mapeados" value={productManifest.summary.items} />
          <Metric label="Arquivos no R2" value={productManifest.summary.r2Uploaded || 0} />
          <Metric label="Itens filtrados" value={totalFiles} />
          <Metric label="Coleções" value={filtered.length} />
        </div>
      </section>

      <FilterPanel onApply={() => {}}>
        <FilterGroup label="Busca" wide>
          <div className="searchBox"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar produto, arquivo, nicho ou próxima ação" /></div>
        </FilterGroup>
        <FilterGroup label="Mercado">
          <select value={market} onChange={(event) => setMarket(event.target.value)}>
            <option value="">Todos</option>
            {markets.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Prioridade">
          <select value={priority} onChange={(event) => setPriority(event.target.value)}>
            <option value="">Todas</option>
            {priorities.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Status">
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Todos</option>
            {statuses.map((item) => <option value={item} key={item}>{item}</option>)}
          </select>
        </FilterGroup>
        <div className="filterActions">
          <button type="button" onClick={() => setPriority("Alta")}>Prioridade alta</button>
          <button type="button" onClick={clear}>Limpar</button>
        </div>
      </FilterPanel>

      <Panel title="Mapa dos materiais" hint={`${number(filtered.length)} coleções`}>
        <div className="materialsGrid">
          {filtered.map((collection) => (
            <article className="materialCard" key={collection.id}>
              <div className="materialCardHead">
                <div>
                  <h2>{collection.title}</h2>
                  <p>{collection.market}</p>
                </div>
                <strong>{number(collection.count)}</strong>
              </div>
              <div className="chips">
                <Chip tone={collection.priority === "Alta" ? "green" : collection.priority === "Média" ? "amber" : "neutral"}>{collection.priority}</Chip>
                <Chip>{collection.status}</Chip>
              </div>
              <p className="materialAngle">{collection.angle}</p>
              <div className="nextAction">
                <h3>Próxima ação</h3>
                <p>{collection.nextAction}</p>
              </div>
              <div className="sampleList">
                <h3>Amostras de arquivos</h3>
                {collection.samples.slice(0, 6).map((sample) => <span key={sample}>{sample}</span>)}
              </div>
            </article>
          ))}
        </div>
      </Panel>

      <Panel title="Arquivos do acervo" hint={`${number(r2ReadyFiles.length || localFiles.length)} disponíveis de ${number(filteredFiles.length)} filtrados`}>
        {(productManifest.summary.r2Uploaded || productManifest.summary.downloaded || 0) === 0 ? (
          <div className="notice">
            Nenhum arquivo foi enviado ao R2 ainda. O HUB já conhece os {number(productManifest.summary.items)} itens, mas os botões de visualizar e baixar só aparecem depois que os arquivos forem enviados para o bucket.
          </div>
        ) : null}
        <div className="table">
          <div className="tableRow header materialFilesRow"><div>Arquivo</div><div>Coleção</div><div>Tipo</div><div>Tamanho</div><div>Status</div><div>Ação</div></div>
          {filteredFiles.slice(0, 120).map((file) => {
            const hasR2 = file.r2Uploaded || file.r2Status === "uploaded";
            const hasLocal = file.localUrl && ["downloaded", "exists"].includes(file.downloadStatus);
            const available = hasR2 || hasLocal;
            const viewUrl = hasR2 ? `/api/materials/${encodeURIComponent(file.id)}/url?mode=view` : file.localUrl;
            const downloadUrl = hasR2 ? `/api/materials/${encodeURIComponent(file.id)}/url?mode=download` : file.localUrl;
            return (
              <div className="tableRow materialFilesRow" key={file.id}>
                <div className="rowMain">
                  <strong>{safe(file.title)}</strong>
                  <small className="rowMeta">ID {file.id}</small>
                </div>
                <div>{safe(file.collectionTitle)}</div>
                <div>{safe(file.type)}</div>
                <div>{bytes(file.localSize)}</div>
                <div>{hasR2 ? <Chip tone="green">R2</Chip> : hasLocal ? <Chip tone="green">Local</Chip> : file.downloadStatus === "external" ? <Chip tone="amber">Link externo</Chip> : <Chip>{file.downloadStatus}</Chip>}</div>
                <div className="actionGroup">
                  {available ? (
                    <>
                      <a className="iconButton" href={viewUrl} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Visualizar</a>
                      <a className="iconButton" href={downloadUrl}><Download size={14} /> Baixar</a>
                    </>
                  ) : (
                    <span className="rowMeta">Enviar para R2</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {filteredFiles.length > 120 ? <p className="tableNote">Mostrando os primeiros 120 arquivos do filtro atual. Use a busca ou os filtros para afinar.</p> : null}
      </Panel>
    </div>
  );
}

function Panel({ title, hint, children }) {
  return (
    <section className="panel">
      <div className="panelHead">
        <h2>{title}</h2>
        {hint ? <span>{hint}</span> : null}
      </div>
      {children}
    </section>
  );
}

function FilterPanel({ children, onApply }) {
  return (
    <section className="panel filters">
      {children}
      <button className="primaryButton" onClick={onApply}>
        <Filter size={15} />
        Filtrar
      </button>
    </section>
  );
}

function FilterGroup({ label, children, wide = false }) {
  return (
    <div className={`filterGroup ${wide ? "wide" : ""}`}>
      <span>{label}</span>
      {children}
    </div>
  );
}

function SortHeader({ label, value, activeSort, order, onSort }) {
  const active = activeSort === value;
  return (
    <button className={`sortHeader ${active ? "active" : ""}`} onClick={() => onSort(value)} type="button">
      {label}
      <span>{active ? (order === "asc" ? "↑" : "↓") : "↕"}</span>
    </button>
  );
}

function Pager({ offset, limit, total, onPrev, onNext }) {
  const end = Math.min(offset + limit, total);
  return (
    <div className="pager">
      <button disabled={offset === 0} onClick={onPrev}>Anterior</button>
      <span>{total ? `${number(offset + 1)}-${number(end)} de ${number(total)}` : "0"}</span>
      <button disabled={offset + limit >= total} onClick={onNext}>Próxima</button>
    </div>
  );
}

function AdsView({ facets, openAd, pageFilter, clearPageFilter, backToAdvertisers, isActive, currentAdId, onSyncAdvertiser, syncingPageId, refreshKey, onDeleteAd, deletingAdId, onDeleteAdvertiser, deletingPageId }) {
  const defaultFilters = {
    q: "",
    cta: "",
    format: "",
    media: "",
    active: "1",
    min_days: "",
    max_days: "",
    min_likes: "",
    domain: "",
    country: "",
    query: "",
    sort: "active_days",
    order: "desc",
  };
  const [filters, setFilters] = useState({
    q: initialSearchParam("q"),
    cta: initialSearchParam("cta"),
    format: initialSearchParam("format"),
    media: initialSearchParam("media"),
    active: initialSearchParam("active", "1"),
    min_days: initialSearchParam("min_days"),
    max_days: initialSearchParam("max_days"),
    min_likes: initialSearchParam("min_likes"),
    domain: initialSearchParam("domain"),
    country: initialSearchParam("country"),
    query: initialSearchParam("query"),
    sort: initialSearchParam("sort", "active_days"),
    order: initialSearchParam("order", "desc"),
  });
  const [offset, setOffset] = useState(() => initialIntSearchParam("offset", 0));
  const [data, setData] = useState({ rows: [], total: 0, limit: 50, offset: 0 });

  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: "50", offset: String(offset), sort: filters.sort, order: filters.order });
    Object.entries(filters).forEach(([key, value]) => {
      if (value && key !== "sort" && key !== "order") p.set(key, value);
    });
    if (pageFilter?.page_id) p.set("page_id", pageFilter.page_id);
    if (!pageFilter?.page_id && pageFilter?.page_name) p.set("page_name", pageFilter.page_name);
    return p;
  }, [filters, offset, pageFilter]);

  useEffect(() => { api(`/api/ads?${params}`).then(setData); }, [params, refreshKey]);
  useEffect(() => {
    if (!isActive) return;
    if (currentAdId) return;
    const search = new URLSearchParams();
    if (pageFilter?.page_name) search.set("name", pageFilter.page_name);
    if (offset) search.set("offset", String(offset));
    Object.entries(filters).forEach(([key, value]) => {
      if (!value) return;
      if (key === "active" && value === "1") return;
      if (key === "sort" && value === "active_days") return;
      if (key === "order" && value === "desc") return;
      search.set(key, value);
    });
    const base = routeUrl({ view: "ads", pageFilter, adId: null }).split("?")[0];
    const query = search.toString();
    window.history.replaceState({ view: "ads", pageFilter, adId: null }, "", query ? `${base}?${query}` : base);
  }, [currentAdId, filters, isActive, offset, pageFilter]);
  const update = (key, value) => setFilters((current) => ({ ...current, [key]: value }));
  const applyPreset = (preset) => {
    setOffset(0);
    setFilters((current) => {
      if (preset === "durable") return { ...current, min_days: "30", active: "1", sort: "active_days", order: "desc" };
      if (preset === "video") return { ...current, media: "video", active: "1", sort: "active_days", order: "desc" };
      if (preset === "newest") return { ...current, sort: "start_date", order: "desc" };
      return current;
    });
  };
  const resetFilters = () => {
    setFilters(defaultFilters);
    setOffset(0);
  };
  const sortBy = (value) => {
    setOffset(0);
    setFilters((current) => ({
      ...current,
      sort: value,
      order: current.sort === value && current.order === "desc" ? "asc" : "desc",
    }));
  };
  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (!value) return false;
    if (key === "active" && value === "1") return false;
    if (key === "sort" && value === "active_days") return false;
    if (key === "order" && value === "desc") return false;
    return true;
  }).length;

  return (
    <div className="viewStack">
      <FilterPanel onApply={() => setOffset(0)}>
        <FilterGroup label="Busca" wide>
          <div className="searchBox"><Search size={16} /><input value={filters.q} onChange={(e) => update("q", e.target.value)} placeholder="Texto, anunciante, URL ou termo" /></div>
        </FilterGroup>
        <FilterGroup label="Oferta">
          <select value={filters.cta} onChange={(e) => update("cta", e.target.value)}>
            <option value="">CTA</option>
            {facets.ctas.map((row) => <option value={row.value} key={row.value}>{row.value} ({number(row.count)})</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Criativo">
          <select value={filters.format} onChange={(e) => update("format", e.target.value)}>
            <option value="">Formato</option>
            {facets.formats.map((row) => <option value={row.value} key={row.value}>{row.value} ({number(row.count)})</option>)}
          </select>
          <select value={filters.media} onChange={(e) => update("media", e.target.value)}>
            <option value="">Mídia</option><option value="image">Imagem</option><option value="video">Vídeo</option><option value="both">Imagem + vídeo</option>
          </select>
        </FilterGroup>
        <FilterGroup label="Status">
          <select value={filters.active} onChange={(e) => update("active", e.target.value)}>
            <option value="">Todos</option><option value="1">Ativos</option><option value="0">Inativos</option>
          </select>
        </FilterGroup>
        <FilterGroup label="Duração">
          <input value={filters.min_days} onChange={(e) => update("min_days", e.target.value)} type="number" min="0" placeholder="Mín." />
          <input value={filters.max_days} onChange={(e) => update("max_days", e.target.value)} type="number" min="0" placeholder="Máx." />
        </FilterGroup>
        <FilterGroup label="Escala">
          <input value={filters.min_likes} onChange={(e) => update("min_likes", e.target.value)} type="number" min="0" placeholder="Curtidas mín." />
          <select value={filters.country} onChange={(e) => update("country", e.target.value)}>
            <option value="">País</option>
            {facets.countries.map((row) => <option value={row.value} key={row.value}>{row.value} ({number(row.count)})</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Origem" wide>
          <select value={filters.domain} onChange={(e) => update("domain", e.target.value)}>
            <option value="">Domínio</option>
            {facets.domains.map((row) => <option value={row.value} key={row.value}>{row.value} ({number(row.count)})</option>)}
          </select>
          <select value={filters.query} onChange={(e) => update("query", e.target.value)}>
            <option value="">Busca origem</option>
            {facets.queries.map((row) => <option value={row.value} key={row.value}>{row.value} ({number(row.inserted || row.seen)})</option>)}
          </select>
        </FilterGroup>
        <FilterGroup label="Ordenar">
          <select value={filters.sort} onChange={(e) => update("sort", e.target.value)}>
            <option value="active_days">Dias ativos</option><option value="start_date">Data início</option><option value="page_like_count">Curtidas</option><option value="media_count">Mídias</option><option value="page_name">Anunciante</option><option value="last_seen_at">Última captura</option>
          </select>
          <select value={filters.order} onChange={(e) => update("order", e.target.value)}>
            <option value="desc">Maior primeiro</option><option value="asc">Menor primeiro</option>
          </select>
        </FilterGroup>
        <div className="filterActions">
          <button type="button" onClick={() => applyPreset("durable")}><ListFilter size={14} /> Longevos</button>
          <button type="button" onClick={() => applyPreset("video")}>Vídeos</button>
          <button type="button" onClick={() => applyPreset("newest")}>Recentes</button>
          <button type="button" onClick={resetFilters}>Limpar {activeFilterCount ? `(${activeFilterCount})` : ""}</button>
        </div>
      </FilterPanel>
      {pageFilter ? (
        <div className="selectionBar">
          <div className="selectionActions">
            <button onClick={backToAdvertisers}><ArrowLeft size={14} /> Voltar para anunciantes</button>
            <span>Anúncios de <strong>{pageFilter.page_name}</strong></span>
          </div>
          <div className="selectionActions">
            <a className="iconButton" href={metaAdLibraryPageUrl(pageFilter.page_id)} target="_blank" rel="noreferrer" title="Abrir anunciante na Meta Ads Library"><ExternalLink size={14} /> Library</a>
            <button onClick={() => onSyncAdvertiser(pageFilter)} disabled={syncingPageId === pageFilter.page_id}>
              <RefreshCw size={14} /> {syncingPageId === pageFilter.page_id ? "Importando..." : "Importar Library"}
            </button>
            <button className="dangerButton" onClick={() => onDeleteAdvertiser(pageFilter)} disabled={deletingPageId === pageFilter.page_id}>
              <Trash2 size={14} /> {deletingPageId === pageFilter.page_id ? "Excluindo..." : "Excluir anunciante"}
            </button>
            <button onClick={clearPageFilter}><X size={14} /> Ver todos os anúncios</button>
          </div>
        </div>
      ) : null}
      <Panel title="Anúncios" hint={`${number(data.total)} resultados`}>
        <div className="table">
          <div className="tableRow header adsRow">
            <SortHeader label="Anúncio" value="page_name" activeSort={filters.sort} order={filters.order} onSort={sortBy} />
            <SortHeader label="Dias" value="active_days" activeSort={filters.sort} order={filters.order} onSort={sortBy} />
            <SortHeader label="Curtidas" value="page_like_count" activeSort={filters.sort} order={filters.order} onSort={sortBy} />
            <div>Status</div>
            <div>CTA / formato</div>
            <div>Ação</div>
          </div>
          {data.rows.map((row) => (
            <div className="tableRow adsRow" key={row.ad_archive_id}>
              <div className="rowMain">
                <strong>{safe(row.page_name)}</strong>
                <p>{AdCopy({ row })}</p>
                <small className="rowMeta">
                  {truncate(row.link_domain || row.link_url, 42)} · {truncate(row.source_query, 42)} · início {safe(row.start_date_iso)}
                </small>
              </div>
              <div><strong className="scaleNumber">{number(row.active_days)}</strong><small className="rowMeta">dias</small></div>
              <div>{number(row.page_like_count)}</div>
              <div className="chips">{row.is_active ? <Chip tone="green">Ativo</Chip> : <Chip>Inativo</Chip>}{row.has_videos ? <Chip tone="amber">Vídeo</Chip> : null}{row.has_images ? <Chip>Imagem</Chip> : null}</div>
              <div><strong>{safe(row.cta_text)}</strong><small className="rowMeta">{safe(row.display_format)} · {number(row.media_count)} mídia(s)</small></div>
              <div className="actionGroup">
                <button onClick={() => openAd(row.ad_archive_id)}>Abrir</button>
                <a className="iconButton" href={metaAdLibraryAdUrl(row.ad_archive_id)} target="_blank" rel="noreferrer" title="Abrir anúncio na Meta Ads Library"><ExternalLink size={14} /> Meta</a>
                <button className="dangerButton iconOnly" onClick={() => onDeleteAd(row)} disabled={deletingAdId === row.ad_archive_id} title="Excluir anúncio">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
        <Pager offset={data.offset} limit={data.limit} total={data.total} onPrev={() => setOffset(Math.max(0, offset - 50))} onNext={() => setOffset(offset + 50)} />
      </Panel>
    </div>
  );
}

function GenericTableView({ type, facets, onOpenAdvertiser, isActive, favoritesOnly = false, onFavoritesChanged, onSyncAdvertiser, syncingPageId, refreshKey, onDeleteAdvertiser, deletingPageId }) {
  const [query, setQuery] = useState(() => initialSearchParam("q"));
  const [sort, setSort] = useState(() => initialSearchParam("sort", type === "pages" ? "active_ads" : ""));
  const [order, setOrder] = useState(() => initialSearchParam("order", "desc"));
  const [status, setStatus] = useState(() => initialSearchParam("status"));
  const [minActive, setMinActive] = useState(() => initialSearchParam("min_active", type === "pages" ? "3" : ""));
  const [minTotal, setMinTotal] = useState(() => initialSearchParam("min_total"));
  const [minMaxDays, setMinMaxDays] = useState(() => initialSearchParam("min_max_days"));
  const [minAvgDays, setMinAvgDays] = useState(() => initialSearchParam("min_avg_days"));
  const [minLikes, setMinLikes] = useState(() => initialSearchParam("min_likes"));
  const [domain, setDomain] = useState(() => initialSearchParam("domain"));
  const [offset, setOffset] = useState(() => initialIntSearchParam("offset", 0));
  const [data, setData] = useState({ rows: [], total: 0, limit: type === "ads" ? 50 : 100, offset: 0 });
  const limit = type === "pages" ? 50 : 100;
  const params = useMemo(() => {
    const p = new URLSearchParams({ limit: String(limit), offset: String(offset), order });
    if (query) p.set("q", query);
    if (sort) p.set("sort", sort);
    if (status) p.set("status", status);
    if (type === "pages" && minActive) p.set("min_active", minActive);
    if (type === "pages" && minTotal) p.set("min_total", minTotal);
    if (type === "pages" && minMaxDays) p.set("min_max_days", minMaxDays);
    if (type === "pages" && minAvgDays) p.set("min_avg_days", minAvgDays);
    if (type === "pages" && minLikes) p.set("min_likes", minLikes);
    if (type === "pages" && domain) p.set("domain", domain);
    if (favoritesOnly) p.set("favorite", "1");
    return p;
  }, [limit, offset, order, query, sort, status, minActive, minTotal, minMaxDays, minAvgDays, minLikes, domain, type, favoritesOnly]);
  useEffect(() => { api(`/api/${type}?${params}`).then(setData); }, [params, type, refreshKey]);
  useEffect(() => {
    if (!isActive) return;
    const search = new URLSearchParams();
    if (offset) search.set("offset", String(offset));
    if (query) search.set("q", query);
    if (sort && !(type === "pages" && sort === "active_ads")) search.set("sort", sort);
    if (order !== "desc") search.set("order", order);
    if (status) search.set("status", status);
    if (type === "pages" && minActive && minActive !== "3") search.set("min_active", minActive);
    if (type === "pages" && minTotal) search.set("min_total", minTotal);
    if (type === "pages" && minMaxDays) search.set("min_max_days", minMaxDays);
    if (type === "pages" && minAvgDays) search.set("min_avg_days", minAvgDays);
    if (type === "pages" && minLikes) search.set("min_likes", minLikes);
    if (type === "pages" && domain) search.set("domain", domain);
    const view = favoritesOnly ? "favorites" : type === "pages" ? "pages" : type === "imports" ? "imports" : "raindrop";
    const base = routeUrl({ view, pageFilter: null, adId: null });
    const queryString = search.toString();
    window.history.replaceState({ view, pageFilter: null, adId: null }, "", queryString ? `${base}?${queryString}` : base);
  }, [domain, favoritesOnly, isActive, minActive, minAvgDays, minLikes, minMaxDays, minTotal, offset, order, query, sort, status, type]);
  const sortPagesBy = (value) => {
    setOffset(0);
    setOrder(sort === value && order === "desc" ? "asc" : "desc");
    setSort(value);
  };
  const toggleFavorite = async (row) => {
    const next = !row.is_favorite;
    await favoritePage(row.page_id, next);
    setData((current) => {
      const rows = favoritesOnly && !next
        ? current.rows.filter((item) => item.page_id !== row.page_id)
        : current.rows.map((item) => item.page_id === row.page_id ? { ...item, is_favorite: next ? 1 : 0 } : item);
      return { ...current, rows, total: favoritesOnly && !next ? Math.max(0, current.total - 1) : current.total };
    });
    onFavoritesChanged?.();
  };
  const title = favoritesOnly ? "Anunciantes favoritos" : type === "pages" ? "Anunciantes capturados" : type === "imports" ? "Buscas executadas" : "Bookmarks do Raindrop";

  return (
    <div className="viewStack">
      <FilterPanel onApply={() => setOffset(0)}>
        <div className="searchBox"><Search size={16} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={type === "pages" ? "Buscar anunciante" : type === "imports" ? "Buscar termo pesquisado" : "Buscar bookmark, domínio ou target"} /></div>
        {type === "pages" ? (
          <>
            <select value={sort} onChange={(e) => setSort(e.target.value)}>
              <option value="active_ads">Anúncios ativos</option><option value="ads_count">Total anúncios</option><option value="max_active_days">Maior duração</option><option value="avg_active_days">Média duração</option><option value="page_like_count">Curtidas</option>
            </select>
            <select value={order} onChange={(e) => setOrder(e.target.value)}>
              <option value="desc">Maior primeiro</option><option value="asc">Menor primeiro</option>
            </select>
            <input value={minActive} onChange={(e) => setMinActive(e.target.value)} type="number" min="0" placeholder="Mín. ativos no banco" />
            <input value={minTotal} onChange={(e) => setMinTotal(e.target.value)} type="number" min="0" placeholder="Mín. capturados" />
            <input value={minMaxDays} onChange={(e) => setMinMaxDays(e.target.value)} type="number" min="0" placeholder="Máx. dias mín." />
            <input value={minAvgDays} onChange={(e) => setMinAvgDays(e.target.value)} type="number" min="0" placeholder="Média dias mín." />
            <input value={minLikes} onChange={(e) => setMinLikes(e.target.value)} type="number" min="0" placeholder="Curtidas mín." />
            <select value={domain} onChange={(e) => setDomain(e.target.value)}>
              <option value="">Domínio</option>
              {facets.domains.map((row) => <option value={row.value} key={row.value}>{row.value} ({number(row.count)})</option>)}
            </select>
          </>
        ) : null}
        {type === "raindrop" ? (
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Todos</option><option value="relevant">Relevantes</option><option value="ignored">Ignorados</option><option value="new">Targets pendentes</option><option value="imported">Targets importados</option><option value="error">Targets com erro</option>
          </select>
        ) : null}
      </FilterPanel>
      <Panel title={title} hint={type === "pages" ? `${number(data.total)} anunciantes no banco` : `${number(data.total)} itens`}>
        {type === "pages" ? <PagesTable rows={data.rows} sort={sort} order={order} onSort={sortPagesBy} onOpenAdvertiser={onOpenAdvertiser} onToggleFavorite={toggleFavorite} onSyncAdvertiser={onSyncAdvertiser} syncingPageId={syncingPageId} onDeleteAdvertiser={onDeleteAdvertiser} deletingPageId={deletingPageId} /> : type === "imports" ? <ImportsTable rows={data.rows} /> : <RaindropTable rows={data.rows} />}
        <Pager offset={data.offset} limit={data.limit} total={data.total} onPrev={() => setOffset(Math.max(0, offset - limit))} onNext={() => setOffset(offset + limit)} />
      </Panel>
    </div>
  );
}

function PagesTable({ rows, sort, order, onSort, onOpenAdvertiser, onToggleFavorite, onSyncAdvertiser, syncingPageId, onDeleteAdvertiser, deletingPageId }) {
  return (
    <div className="table">
      <div className="tableRow header pagesRow">
        <SortHeader label="Anunciante" value="page_name" activeSort={sort} order={order} onSort={onSort} />
        <SortHeader label="Ativos" value="active_ads" activeSort={sort} order={order} onSort={onSort} />
        <SortHeader label="Total" value="ads_count" activeSort={sort} order={order} onSort={onSort} />
        <SortHeader label="Máx. dias" value="max_active_days" activeSort={sort} order={order} onSort={onSort} />
        <SortHeader label="Média" value="avg_active_days" activeSort={sort} order={order} onSort={onSort} />
        <SortHeader label="Curtidas" value="page_like_count" activeSort={sort} order={order} onSort={onSort} />
        <div>Ação</div>
      </div>
      {rows.map((row) => (
        <div className="tableRow pagesRow" key={row.page_id}>
          <div className="rowMain">
            <strong>{safe(row.page_name)}</strong>
            <p>{row.page_profile_uri ? <a href={row.page_profile_uri} target="_blank" rel="noreferrer">{row.page_profile_uri}</a> : `Curtidas: ${number(row.page_like_count)}`}</p>
            <small className="rowMeta">{row.library_synced_at ? `Library sync: ${row.library_synced_at} (${number(row.library_last_seen)} vistos)` : "Library ainda não sincronizada por pageId"}</small>
          </div>
          <div><strong className="scaleNumber">{number(row.active_ads)}</strong></div>
          <div>{number(row.ads_count)}</div>
          <div>{number(row.max_active_days)}</div>
          <div>{number(row.avg_active_days)}</div>
          <div>{number(row.page_like_count)}</div>
          <div className="actionGroup">
            <button className={`starButton ${row.is_favorite ? "active" : ""}`} onClick={() => onToggleFavorite(row)} title={row.is_favorite ? "Remover dos favoritos" : "Favoritar anunciante"}>
              <Star size={15} fill={row.is_favorite ? "currentColor" : "none"} />
            </button>
            <button onClick={() => onOpenAdvertiser(row)}>Ver anúncios</button>
            <button onClick={() => onSyncAdvertiser(row)} disabled={syncingPageId === row.page_id} title="Importar anúncios desse anunciante pela Meta Ads Library usando pageId">
              <RefreshCw size={14} /> {syncingPageId === row.page_id ? "Importando" : "Sync"}
            </button>
            <a className="iconButton" href={metaAdLibraryPageUrl(row.page_id)} target="_blank" rel="noreferrer" title="Abrir anunciante na Meta Ads Library"><ExternalLink size={14} /> Library</a>
            <button className="dangerButton iconOnly" onClick={() => onDeleteAdvertiser(row)} disabled={deletingPageId === row.page_id} title="Excluir anunciante e todos os anúncios dele">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ImportsTable({ rows }) {
  return (
    <div className="table">
      <div className="tableRow header importsRow"><div>ID</div><div>Termo</div><div>Vistos</div><div>Novos</div><div>Atualizados</div><div>Novidade</div><div>Importado</div></div>
      {rows.map((row) => (
        <div className="tableRow importsRow" key={row.id}>
          <div>{row.id}</div><strong>{safe(row.query)}</strong><div>{number(row.items_seen)}</div><div>{number(row.items_inserted)}</div><div>{number(row.items_updated)}</div><div>{safe(row.novelty_pct)}%</div><div>{safe(row.imported_at)}</div>
        </div>
      ))}
    </div>
  );
}

function RaindropTable({ rows }) {
  return (
    <div className="table">
      <div className="tableRow header raindropRow"><div>ID</div><div>Bookmark</div><div>Domínio</div><div>Status</div><div>Targets</div></div>
      {rows.map((row) => (
        <div className="tableRow raindropRow" key={row.raindrop_id}>
          <div>{row.raindrop_id}</div>
          <div className="rowMain"><strong>{safe(row.title)}</strong><p>{row.link ? <a href={row.link} target="_blank">{truncate(row.link, 120)}</a> : "-"}</p></div>
          <div>{safe(row.domain)}</div>
          <div>{row.is_relevant ? <Chip tone="green">Relevante</Chip> : <Chip>{row.relevance_reason}</Chip>}</div>
          <div title={row.targets}>{truncate(row.targets || row.target_statuses, 64)}</div>
        </div>
      ))}
    </div>
  );
}

function DetailDrawer({ adId, onClose, onDeleteAd, deletingAdId }) {
  const [detail, setDetail] = useState(null);
  useEffect(() => {
    if (!adId) return;
    setDetail(null);
    api(`/api/ad/${encodeURIComponent(adId)}`).then(setDetail);
  }, [adId]);
  return (
    <aside className={`drawer ${adId ? "open" : ""}`} aria-hidden={!adId}>
      <div className="drawerHead">
        <div><h2>{detail?.ad?.page_name || "Detalhe do anúncio"}</h2><span>{detail?.ad ? `${detail.ad.ad_archive_id} - ${number(detail.ad.active_days)} dias ativos` : "Carregando..."}</span></div>
        <div className="drawerActions">
          {detail?.ad ? (
            <button className="dangerButton" onClick={() => onDeleteAd(detail.ad)} disabled={deletingAdId === detail.ad.ad_archive_id}>
              <Trash2 size={14} /> {deletingAdId === detail.ad.ad_archive_id ? "Excluindo..." : "Excluir"}
            </button>
          ) : null}
          <button onClick={onClose}><X size={16} /> Fechar</button>
        </div>
      </div>
      <div className="drawerBody">
        {detail ? (
          <>
            <section className="detailBlock"><h3>Resumo</h3><div className="chips">{detail.ad.is_active ? <Chip tone="green">Ativo</Chip> : <Chip>Inativo</Chip>}<Chip>{detail.ad.cta_text || "Sem CTA"}</Chip><Chip>{detail.ad.display_format || "Sem formato"}</Chip><Chip>{detail.ad.source_query || "Sem busca"}</Chip></div></section>
            <section className="detailBlock"><h3>Texto</h3><p className="detailText">{safe(detail.ad.body_text || detail.ad.title || detail.ad.caption || detail.ad.link_description)}</p></section>
            <section className="detailBlock"><h3>Meta Ads Library</h3><div className="linkStack">
              <a href={metaAdLibraryAdUrl(detail.ad.ad_archive_id)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir anúncio na biblioteca</a>
              {detail.ad.page_id ? <a href={metaAdLibraryPageUrl(detail.ad.page_id)} target="_blank" rel="noreferrer"><ExternalLink size={14} /> Abrir anunciante na biblioteca</a> : null}
            </div></section>
            <section className="detailBlock"><h3>Destino</h3>{detail.ad.link_url ? <a href={detail.ad.link_url} target="_blank" rel="noreferrer"><ExternalLink size={14} /> {detail.ad.link_url}</a> : "-"}</section>
            <section className="detailBlock"><h3>Mídias</h3><div className="mediaGrid">{detail.media.length ? detail.media.map((item, index) => {
              const url = item.preview_url || item.url || item.hd_url || item.sd_url;
              if (!url) return null;
              return item.media_type.includes("video") ? <video key={index} src={url} controls /> : <img key={index} alt="Criativo do anúncio" src={url} loading="lazy" />;
            }) : <p>Sem mídia salva.</p>}</div></section>
          </>
        ) : <p>Carregando...</p>}
      </div>
    </aside>
  );
}

export default function Dashboard() {
  const [activeView, setActiveView] = useState("overview");
  const [summary, setSummary] = useState(null);
  const [facets, setFacets] = useState({ ctas: [], formats: [], queries: [], domains: [], countries: [] });
  const [adId, setAdId] = useState(null);
  const [pageFilter, setPageFilter] = useState(null);
  const [syncingPageId, setSyncingPageId] = useState(null);
  const [deletingAdId, setDeletingAdId] = useState(null);
  const [deletingPageId, setDeletingPageId] = useState(null);
  const [notice, setNotice] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const refresh = () => Promise.all([api("/api/summary").then(setSummary), api("/api/facets").then(setFacets)]);
  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const initial = routeFromWindow();
    setActiveView(initial.view);
    setPageFilter(initial.pageFilter);
    setAdId(initial.adId);
    window.history.replaceState(initial, "", routeUrl(initial));
    const onPopState = (event) => {
      const state = event.state || routeFromWindow();
      setActiveView(state.view || "overview");
      setPageFilter(state.pageFilter || null);
      setAdId(state.adId || null);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);
  const navigate = (view, options = {}) => {
    const next = {
      view,
      pageFilter: options.pageFilter ?? null,
      adId: options.adId ?? null,
    };
    setActiveView(next.view);
    setPageFilter(next.pageFilter);
    setAdId(next.adId);
    window.history[options.replace ? "replaceState" : "pushState"](next, "", routeUrl(next));
  };
  const navigateView = (view) => navigate(view, { pageFilter: null, adId: null });
  const openAdvertiser = (row) => {
    navigate("ads", { pageFilter: { page_id: row.page_id, page_name: row.page_name }, adId: null });
  };
  const openAd = (id) => {
    navigate(activeView, { pageFilter, adId: id });
  };
  const syncAdvertiser = async (row) => {
    if (!row?.page_id || syncingPageId) return;
    setSyncingPageId(row.page_id);
    setNotice(`Importando anúncios da Library para ${row.page_name || row.page_id}...`);
    try {
      const result = await syncPageLibrary(row.page_id);
      setNotice(`${result.page_name}: ${number(result.items_inserted)} novos, ${number(result.items_updated)} atualizados. Total capturado agora: ${number(result.captured_total_after)}.`);
      await refresh();
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice(`Falha ao importar Library: ${error.message}`);
    } finally {
      setSyncingPageId(null);
    }
  };
  const removeAd = async (row) => {
    const adArchiveId = row?.ad_archive_id;
    if (!adArchiveId || deletingAdId) return;
    const label = row.page_name ? `${row.page_name} / ${adArchiveId}` : adArchiveId;
    if (!window.confirm(`Excluir este anúncio do banco?\n\n${label}`)) return;
    setDeletingAdId(adArchiveId);
    setNotice(`Excluindo anúncio ${adArchiveId}...`);
    try {
      await deleteAd(adArchiveId);
      if (adId === adArchiveId) closeAd();
      setNotice(`Anúncio ${adArchiveId} excluído.`);
      await refresh();
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice(`Falha ao excluir anúncio: ${error.message}`);
    } finally {
      setDeletingAdId(null);
    }
  };
  const removeAdvertiser = async (row) => {
    const pageId = row?.page_id;
    if (!pageId || deletingPageId) return;
    const count = row.ads_count ?? row.active_ads ?? 0;
    const label = row.page_name || pageId;
    if (!window.confirm(`Excluir anunciante e todos os anúncios dele do banco?\n\n${label}\nAnúncios capturados: ${number(count)}`)) return;
    setDeletingPageId(pageId);
    setNotice(`Excluindo anunciante ${label}...`);
    try {
      const result = await deleteAdvertiser(pageId);
      setNotice(`${result.deleted.page_name}: anunciante excluído com ${number(result.deleted.ads_deleted)} anúncios.`);
      if (pageFilter?.page_id === pageId) navigate("pages", { pageFilter: null, adId: null });
      await refresh();
      setRefreshKey((value) => value + 1);
    } catch (error) {
      setNotice(`Falha ao excluir anunciante: ${error.message}`);
    } finally {
      setDeletingPageId(null);
    }
  };
  const closeAd = () => {
    if (window.history.state?.adId) {
      window.history.back();
      return;
    }
    navigate(activeView, { pageFilter, adId: null, replace: true });
  };
  return (
    <Shell activeView={activeView} navigateView={navigateView} refresh={refresh} notice={notice}>
      <div hidden={activeView !== "overview"}><Overview summary={summary} openAd={openAd} /></div>
      <div hidden={activeView !== "materials"}><MaterialsView isActive={activeView === "materials"} /></div>
      <div hidden={activeView !== "ads"}>
        <AdsView
          facets={facets}
          openAd={openAd}
          pageFilter={pageFilter}
          clearPageFilter={() => navigate("ads", { pageFilter: null, adId: null })}
          backToAdvertisers={() => navigate("pages", { pageFilter: null, adId: null })}
          isActive={activeView === "ads"}
          currentAdId={adId}
          onSyncAdvertiser={syncAdvertiser}
          syncingPageId={syncingPageId}
          refreshKey={refreshKey}
          onDeleteAd={removeAd}
          deletingAdId={deletingAdId}
          onDeleteAdvertiser={removeAdvertiser}
          deletingPageId={deletingPageId}
        />
      </div>
      <div hidden={activeView !== "pages"}><GenericTableView type="pages" facets={facets} onOpenAdvertiser={openAdvertiser} isActive={activeView === "pages"} onFavoritesChanged={refresh} onSyncAdvertiser={syncAdvertiser} syncingPageId={syncingPageId} refreshKey={refreshKey} onDeleteAdvertiser={removeAdvertiser} deletingPageId={deletingPageId} /></div>
      <div hidden={activeView !== "favorites"}><GenericTableView type="pages" facets={facets} onOpenAdvertiser={openAdvertiser} isActive={activeView === "favorites"} favoritesOnly onFavoritesChanged={refresh} onSyncAdvertiser={syncAdvertiser} syncingPageId={syncingPageId} refreshKey={refreshKey} onDeleteAdvertiser={removeAdvertiser} deletingPageId={deletingPageId} /></div>
      <div hidden={activeView !== "imports"}><GenericTableView type="imports" facets={facets} isActive={activeView === "imports"} /></div>
      <div hidden={activeView !== "raindrop"}><GenericTableView type="raindrop" facets={facets} isActive={activeView === "raindrop"} /></div>
      <DetailDrawer adId={adId} onClose={closeAd} onDeleteAd={removeAd} deletingAdId={deletingAdId} />
    </Shell>
  );
}
