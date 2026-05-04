import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createReadStream, existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const manifestPath = join(root, "data/product-materials-manifest.json");
const publicRoot = join(root, "public");

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
};

const client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

async function exists(key) {
  try {
    await client.send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    return true;
  } catch (error) {
    if (["NotFound", "NoSuchKey", "Forbidden"].includes(error?.name)) return false;
    throw error;
  }
}

const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
let uploaded = 0;
let skipped = 0;
let missingLocal = 0;

for (const item of manifest.items) {
  if (!item.r2Key || !item.localUrl) continue;
  const localPath = join(publicRoot, item.localUrl.replace(/^\//, ""));
  if (!existsSync(localPath)) {
    item.r2Status = item.r2Status || "missing_local_file";
    missingLocal += 1;
    continue;
  }
  if (await exists(item.r2Key)) {
    item.r2Status = "uploaded";
    item.r2Uploaded = true;
    item.r2Size = statSync(localPath).size;
    skipped += 1;
    continue;
  }
  await client.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: item.r2Key,
    Body: createReadStream(localPath),
    ContentType: contentTypes[extname(localPath).toLowerCase()] || "application/octet-stream",
  }));
  item.r2Status = "uploaded";
  item.r2Uploaded = true;
  item.r2Size = statSync(localPath).size;
  uploaded += 1;
  if ((uploaded + skipped) % 25 === 0) {
    console.log(JSON.stringify({ uploaded, skipped, missingLocal }));
  }
}

manifest.summary.r2Uploaded = manifest.items.filter((item) => item.r2Uploaded || item.r2Status === "uploaded").length;
manifest.summary.r2MissingLocal = manifest.items.filter((item) => item.r2Status === "missing_local_file").length;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(JSON.stringify({ uploaded, skipped, missingLocal, r2Uploaded: manifest.summary.r2Uploaded }, null, 2));
