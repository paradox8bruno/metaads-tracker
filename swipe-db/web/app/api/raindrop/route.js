import { NextResponse } from "next/server";
import { intParam, like, runJson, tableExists, textParam } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  if (!(await tableExists("raindrop_items"))) {
    return NextResponse.json({ rows: [], total: 0, limit: 0, offset: 0, summary: {} });
  }
  const { searchParams } = new URL(request.url);
  const limit = intParam(searchParams, "limit", 100, 10, 300);
  const offset = intParam(searchParams, "offset", 0, 0, 500000);
  const q = textParam(searchParams, "q");
  const status = textParam(searchParams, "status");
  const where = [];
  if (q) where.push(`lower(COALESCE(ri.title,'') || ' ' || COALESCE(ri.link,'') || ' ' || COALESCE(rt.query,'')) LIKE ${like(q)}`);
  if (status === "relevant") where.push("ri.is_relevant = 1");
  else if (status === "ignored") where.push("ri.is_relevant = 0");
  else if (["new", "imported", "error"].includes(status)) where.push(`rt.status = '${status}'`);
  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const total = (await runJson(`
    SELECT COUNT(DISTINCT ri.raindrop_id) AS total
    FROM raindrop_items ri
    LEFT JOIN raindrop_targets rt ON rt.raindrop_id = ri.raindrop_id
    ${whereSql}
  `))[0]?.total ?? 0;
  const summary = (await runJson(`
    SELECT
      COUNT(*) AS bookmarks,
      SUM(CASE WHEN is_relevant = 1 THEN 1 ELSE 0 END) AS relevant,
      SUM(CASE WHEN is_relevant = 0 THEN 1 ELSE 0 END) AS ignored
    FROM raindrop_items
  `))[0] ?? {};
  const rows = await runJson(`
    SELECT
      ri.raindrop_id, ri.title, ri.link, ri.domain, ri.item_type,
      ri.is_relevant, ri.relevance_reason, ri.created_at,
      STRING_AGG(DISTINCT rt.target_type || ':' || rt.query, ',') AS targets,
      STRING_AGG(DISTINCT rt.status, ',') AS target_statuses
    FROM raindrop_items ri
    LEFT JOIN raindrop_targets rt ON rt.raindrop_id = ri.raindrop_id
    ${whereSql}
    GROUP BY ri.raindrop_id
    ORDER BY ri.raindrop_id DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  return NextResponse.json({ rows, total, limit, offset, summary });
}
