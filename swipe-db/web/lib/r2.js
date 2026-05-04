import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const requiredEnv = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET_NAME"];

export function r2ConfigStatus() {
  const missing = requiredEnv.filter((name) => !process.env[name]);
  return {
    configured: missing.length === 0,
    missing,
    bucket: process.env.R2_BUCKET_NAME || "",
    publicBaseUrl: process.env.R2_PUBLIC_BASE_URL || "",
  };
}

export function r2Client() {
  const status = r2ConfigStatus();
  if (!status.configured) {
    throw new Error(`R2 is not configured. Missing: ${status.missing.join(", ")}`);
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export function objectUrl(key) {
  const base = process.env.R2_PUBLIC_BASE_URL?.replace(/\/$/, "");
  return base ? `${base}/${encodeURI(key).replaceAll("%2F", "/")}` : "";
}

export async function signedReadUrl({ key, filename, mode = "view", expiresIn = 300 }) {
  const publicUrl = objectUrl(key);
  if (publicUrl) return publicUrl;
  const disposition = mode === "download"
    ? `attachment; filename="${String(filename || "material").replaceAll('"', "'")}"`
    : "inline";
  const command = new GetObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    ResponseContentDisposition: disposition,
  });
  return getSignedUrl(r2Client(), command, { expiresIn });
}

export async function objectExists(key) {
  try {
    await r2Client().send(new HeadObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key }));
    return true;
  } catch (error) {
    if (["NotFound", "NoSuchKey", "Forbidden"].includes(error?.name)) return false;
    throw error;
  }
}

export async function putObject({ key, body, contentType }) {
  await r2Client().send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: body,
    ContentType: contentType,
  }));
}
