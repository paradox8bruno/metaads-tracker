import { NextResponse } from "next/server";
import { intParam, like, runJson, textParam } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = intParam(searchParams, "limit", 100, 10, 300);
  const offset = intParam(searchParams, "offset", 0, 0, 500000);
  const q = textParam(searchParams, "q");
  const whereSql = q ? `WHERE lower(COALESCE(query,'')) LIKE ${like(q)}` : "";
  const total = (await runJson(`SELECT COUNT(*) AS total FROM import_runs ${whereSql}`))[0]?.total ?? 0;
  const rows = await runJson(`
    SELECT id, source, source_ref, query, actor_run_id, dataset_id, imported_at,
           items_seen, items_inserted, items_updated,
           ROUND(items_inserted * 100.0 / NULLIF(items_seen, 0), 1)::float AS novelty_pct
    FROM import_runs
    ${whereSql}
    ORDER BY id DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  return NextResponse.json({ rows, total, limit, offset });
}
