import { execFileSync } from "node:child_process";
import path from "node:path";
import { NextResponse } from "next/server";
import { ensurePageLibrarySyncsTable, intParam, one, sqlString } from "../../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request, { params }) {
  const { id } = await params;
  const body = await request.json().catch(() => ({}));
  const searchParams = new URLSearchParams();
  if (body.max_items) searchParams.set("max_items", String(body.max_items));
  const maxItems = intParam(searchParams, "max_items", 10000, 1, 50000);
  const waitSecs = Number.parseInt(body.wait_secs ?? "1200", 10);
  const page = await one(`SELECT page_name FROM pages WHERE page_id = ${sqlString(id)}`, {});

  await ensurePageLibrarySyncsTable();
  try {
    const scriptPath = path.resolve(process.cwd(), "../sync_page_library.py");
    const pythonPath = path.resolve(process.cwd(), "../.venv/bin/python");
    const output = execFileSync(
      pythonPath,
      [
        scriptPath,
        "--page-id",
        id,
        "--page-name",
        page.page_name || id,
        "--max-items",
        String(maxItems),
        "--wait-secs",
        String(Number.isNaN(waitSecs) ? 1200 : waitSecs),
      ],
      {
        cwd: path.resolve(process.cwd(), ".."),
        env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
        encoding: "utf8",
        maxBuffer: 1024 * 1024 * 20,
        timeout: (Number.isNaN(waitSecs) ? 1200 : waitSecs) * 1000 + 120000,
      },
    ).trim();
    const lastLine = output.split("\n").filter(Boolean).at(-1) || "{}";
    return NextResponse.json(JSON.parse(lastLine));
  } catch (error) {
    return NextResponse.json(
      {
        error: "Falha ao sincronizar biblioteca do anunciante",
        detail: error.stderr?.toString() || error.stdout?.toString() || error.message,
      },
      { status: 500 },
    );
  }
}
