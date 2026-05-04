import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { execFileSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { extname, join } from "node:path";
import { Readable } from "node:stream";

const root = fileURLToPath(new URL("..", import.meta.url));
const manifestPath = join(root, "data/product-materials-manifest.json");
const envPath = join(root, ".env");
const progressPath = join(root, "data/product-materials-sync-progress.jsonl");
const cookieDbPath = `${process.env.HOME}/Library/Application Support/Raindrop.io/Cookies`;

loadEnvFile(envPath);

const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = "true"] = arg.replace(/^--/, "").split("=");
    return [key, value];
  }),
);
const limit = args.has("limit") ? Number(args.get("limit")) : Infinity;
const concurrency = Math.max(1, Math.min(Number(args.get("concurrency") || 4), 8));
const force = args.has("force");

const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing R2 env vars: ${missing.join(", ")}`);
  process.exit(1);
}

const contentTypes = {
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".zip": "application/zip",
};

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  requestChecksumCalculation: "WHEN_REQUIRED",
  responseChecksumValidation: "WHEN_REQUIRED",
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const cookie = readRaindropCookie();
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

let uploaded = 0;
let skipped = 0;
let failed = 0;
let processed = 0;

const queue = [];
for (const item of manifest.items) {
  if (!item.r2Key || !item.sourceUrl) continue;
  if (!force && (item.r2Uploaded || item.r2Status === "uploaded")) {
    skipped += 1;
  } else if (queue.length < limit) {
    queue.push(item);
  }
}

let cursor = 0;
await Promise.all(
  Array.from({ length: Math.min(concurrency, queue.length) }, async () => {
    while (cursor < queue.length) {
      const item = queue[cursor];
      cursor += 1;
      await syncItem(item);
    }
  }),
);

saveManifest();
console.log(JSON.stringify({
  uploaded,
  skipped,
  failed,
  processed,
  r2Uploaded: manifest.summary.r2Uploaded,
  r2Errors: manifest.summary.r2Errors,
}, null, 2));

async function syncItem(item) {
  processed += 1;

  try {
    const remote = await headObject(item.r2Key);
    if (!force && remote) {
      markUploaded(item, Number(remote.ContentLength || 0));
      skipped += 1;
      saveManifest();
      logProgress({ status: "skipped_existing", id: item.id, key: item.r2Key });
      printProgress();
      return;
    }

    const response = await fetch(item.sourceUrl, {
      redirect: "follow",
      headers: { cookie: `connect.sid=${cookie}` },
    });

    if (!response.ok || !response.body) {
      throw new Error(`download_failed_${response.status}`);
    }

    const contentType = response.headers.get("content-type") || inferContentType(item);
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentType.includes("text/html")) {
      throw new Error("download_returned_html");
    }

    await client.send(new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: item.r2Key,
      Body: Readable.fromWeb(response.body),
      ContentType: contentType,
      ...(contentLength ? { ContentLength: contentLength } : {}),
    }));

    markUploaded(item, contentLength);
    uploaded += 1;
    saveManifest();
    logProgress({ status: "uploaded", id: item.id, key: item.r2Key, bytes: contentLength });
    printProgress();
  } catch (error) {
    item.r2Status = "error";
    item.r2Uploaded = false;
    item.r2Error = error?.message || String(error);
    failed += 1;
    saveManifest();
    logProgress({ status: "error", id: item.id, key: item.r2Key, error: item.r2Error });
    console.error(JSON.stringify({ status: "error", id: item.id, title: item.title, error: item.r2Error }));
  }
}

function printProgress() {
  if ((uploaded + skipped + failed) % 10 === 0) {
    console.log(JSON.stringify({ uploaded, skipped, failed, processed, concurrency }));
  }
}

function loadEnvFile(path) {
  try {
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) continue;
      const [, key, rawValue] = match;
      if (process.env[key]) continue;
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  } catch {
    // The caller can still provide env vars directly.
  }
}

function readRaindropCookie() {
  const value = execFileSync("sqlite3", [
    cookieDbPath,
    "select value from cookies where host_key='.raindrop.io' and name='connect.sid' limit 1;",
  ], { encoding: "utf8" }).trim();
  if (!value) {
    throw new Error("Raindrop session cookie not found. Open Raindrop.io app and sign in.");
  }
  return value;
}

async function headObject(key) {
  try {
    return await client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
  } catch (error) {
    if (["NotFound", "NoSuchKey", "Forbidden"].includes(error?.name) || error?.$metadata?.httpStatusCode === 404) {
      return null;
    }
    throw error;
  }
}

function inferContentType(item) {
  const fromUrl = new URL(item.sourceUrl);
  const type = fromUrl.searchParams.get("type");
  if (type) return type;
  return contentTypes[extname(item.r2Key).toLowerCase()] || "application/octet-stream";
}

function markUploaded(item, size) {
  item.r2Status = "uploaded";
  item.r2Uploaded = true;
  item.r2Size = size;
  item.r2UploadedAt = new Date().toISOString();
  delete item.r2Error;
}

function saveManifest() {
  manifest.summary.r2Uploaded = manifest.items.filter((item) => item.r2Uploaded || item.r2Status === "uploaded").length;
  manifest.summary.r2Errors = manifest.items.filter((item) => item.r2Status === "error").length;
  manifest.summary.r2Pending = manifest.items.filter((item) => item.r2Key && !item.r2Uploaded && item.r2Status !== "uploaded").length;
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

function logProgress(event) {
  const line = JSON.stringify({ time: new Date().toISOString(), ...event });
  appendFileSync(progressPath, `${line}\n`);
}
