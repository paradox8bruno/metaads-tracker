import { NextResponse } from "next/server";
import { domainExpr, ensurePageFavoritesTable, ensurePageLibrarySyncsTable, ensurePageStatsTable, intParam, like, runJson, sqlString, textParam } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  await ensurePageFavoritesTable();
  await ensurePageLibrarySyncsTable();
  await ensurePageStatsTable();
  const { searchParams } = new URL(request.url);
  const limit = intParam(searchParams, "limit", 50, 10, 200);
  const offset = intParam(searchParams, "offset", 0, 0, 500000);
  const sort = textParam(searchParams, "sort") || "active_ads";
  const order = textParam(searchParams, "order").toLowerCase() === "asc" ? "ASC" : "DESC";
  const minActive = intParam(searchParams, "min_active", 0, 0, 100000);
  const minTotal = intParam(searchParams, "min_total", 0, 0, 100000);
  const minMaxDays = intParam(searchParams, "min_max_days", 0, 0, 5000);
  const minAvgDays = intParam(searchParams, "min_avg_days", 0, 0, 5000);
  const minLikes = intParam(searchParams, "min_likes", 0, 0, 100000000);
  const sorts = {
    ads_count: "ads_count",
    active_ads: "active_ads",
    max_active_days: "max_active_days",
    avg_active_days: "avg_active_days",
    page_like_count: "page_like_count",
    page_name: "page_name",
  };
  const q = textParam(searchParams, "q");
  const where = [];
  if (q) where.push(`lower(COALESCE(ps.page_name, p.page_name, '')) LIKE ${like(q)}`);
  const favorite = textParam(searchParams, "favorite");
  if (favorite === "1") where.push("pf.page_id IS NOT NULL");
  const domain = textParam(searchParams, "domain");
  if (domain) where.push(`EXISTS (SELECT 1 FROM ads ad WHERE ad.page_id = ps.page_id AND ${domainExpr("ad")} = ${sqlString(domain.toLowerCase())})`);
  const having = [];
  if (minActive) having.push(`ps.active_ads >= ${minActive}`);
  if (minTotal) having.push(`ps.ads_count >= ${minTotal}`);
  if (minMaxDays) having.push(`ps.max_active_days >= ${minMaxDays}`);
  if (minAvgDays) having.push(`ps.avg_active_days >= ${minAvgDays}`);
  if (minLikes) having.push(`ps.page_like_count >= ${minLikes}`);
  const statsWhere = [...where, ...having];
  const statsSql = statsWhere.length ? `WHERE ${statsWhere.join(" AND ")}` : "";
  const total = (await runJson(`
    SELECT COUNT(*) AS total
    FROM page_stats ps
    LEFT JOIN pages p ON p.page_id = ps.page_id
    LEFT JOIN page_favorites pf ON pf.page_id = ps.page_id
    ${statsSql}
  `))[0]?.total ?? 0;
  const rows = await runJson(`
    SELECT ps.page_id, COALESCE(ps.page_name, p.page_name) AS page_name,
           p.page_profile_uri,
           p.page_profile_picture_url,
           ps.page_like_count,
           CASE WHEN pf.page_id IS NOT NULL THEN 1 ELSE 0 END AS is_favorite,
           pf.created_at AS favorited_at,
           pls.synced_at AS library_synced_at,
           pls.max_items AS library_sync_max_items,
           pls.items_seen AS library_last_seen,
           ps.ads_count,
           ps.active_ads,
           ps.max_active_days,
           ps.avg_active_days,
           ps.last_seen_at
    FROM page_stats ps
    LEFT JOIN pages p ON p.page_id = ps.page_id
    LEFT JOIN page_favorites pf ON pf.page_id = ps.page_id
    LEFT JOIN (
      SELECT s.*
      FROM page_library_syncs s
      JOIN (
        SELECT page_id, MAX(id) AS id
        FROM page_library_syncs
        GROUP BY page_id
      ) latest ON latest.id = s.id
    ) pls ON pls.page_id = ps.page_id
    ${statsSql}
    ORDER BY ${sorts[sort] ?? "ads_count"} ${order}, page_name
    LIMIT ${limit} OFFSET ${offset}
  `);
  return NextResponse.json({ rows, total, limit, offset });
}
