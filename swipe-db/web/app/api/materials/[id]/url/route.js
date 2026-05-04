import { NextResponse } from "next/server";
import { productManifest } from "../../../../../lib/product-materials";
import { r2ConfigStatus, signedReadUrl } from "../../../../../lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode") === "download" ? "download" : "view";
  const id = Number(params.id);
  const item = productManifest.items.find((entry) => Number(entry.id) === id);
  if (!item) {
    return NextResponse.json({ error: "Material not found" }, { status: 404 });
  }
  if (!item.r2Key) {
    return NextResponse.json({ error: "Material has not been uploaded to R2 yet", item }, { status: 409 });
  }
  const status = r2ConfigStatus();
  if (!status.configured) {
    return NextResponse.json({ error: "R2 is not configured", missing: status.missing }, { status: 503 });
  }
  const url = await signedReadUrl({ key: item.r2Key, filename: item.title, mode });
  return NextResponse.redirect(url, 302);
}
