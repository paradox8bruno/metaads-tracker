import { NextResponse } from "next/server";
import { domainExpr, intParam, like, runJson, sqlString, textParam } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const limit = intParam(searchParams, "limit", 50, 10, 200);
  const offset = intParam(searchParams, "offset", 0, 0, 500000);
  const minDays = intParam(searchParams, "min_days", 0, 0, 5000);
  const maxDays = intParam(searchParams, "max_days", 0, 0, 5000);
  const minLikes = intParam(searchParams, "min_likes", 0, 0, 100000000);
  const sort = textParam(searchParams, "sort") || "active_days";
  const order = textParam(searchParams, "order").toLowerCase() === "asc" ? "ASC" : "DESC";
  const sorts = {
    active_days: "a.active_days",
    start_date: "a.start_date",
    page_like_count: "a.page_like_count",
    media_count: "a.media_count",
    first_seen_at: "a.first_seen_at",
    last_seen_at: "a.last_seen_at",
    page_name: "a.page_name",
  };
  const where = ["1=1"];
  const q = textParam(searchParams, "q");
  if (q) {
    where.push(`
      lower(COALESCE(a.page_name,'') || ' ' || COALESCE(a.body_text,'') || ' ' ||
            COALESCE(a.title,'') || ' ' || COALESCE(a.caption,'') || ' ' ||
            COALESCE(a.link_url,'') || ' ' || COALESCE(ir.query,''))
      LIKE ${like(q)}
    `);
  }
  const cta = textParam(searchParams, "cta");
  if (cta) where.push(`a.cta_text = ${sqlString(cta)}`);
  const format = textParam(searchParams, "format");
  if (format) where.push(`a.display_format = ${sqlString(format)}`);
  const active = textParam(searchParams, "active");
  if (active === "0" || active === "1") where.push(`a.is_active = ${Number(active)}`);
  const media = textParam(searchParams, "media");
  if (media === "video") where.push("a.has_videos = 1");
  if (media === "image") where.push("a.has_images = 1");
  if (media === "both") where.push("a.has_images = 1 AND a.has_videos = 1");
  if (minDays) where.push(`COALESCE(a.active_days, 0) >= ${minDays}`);
  if (maxDays) where.push(`COALESCE(a.active_days, 0) <= ${maxDays}`);
  if (minLikes) where.push(`COALESCE(a.page_like_count, 0) >= ${minLikes}`);
  const query = textParam(searchParams, "query");
  if (query) where.push(`ir.query = ${sqlString(query)}`);
  const domain = textParam(searchParams, "domain");
  if (domain) where.push(`${domainExpr("a")} = ${sqlString(domain.toLowerCase())}`);
  const country = textParam(searchParams, "country");
  if (country) where.push(`a.country_iso_code = ${sqlString(country.toUpperCase())}`);
  const pageId = textParam(searchParams, "page_id");
  if (pageId) where.push(`a.page_id = ${sqlString(pageId)}`);
  const pageName = textParam(searchParams, "page_name");
  if (pageName) where.push(`a.page_name = ${sqlString(pageName)}`);
  const whereSql = where.join(" AND ");
  const total = (await runJson(`
    SELECT COUNT(*) AS total
    FROM ads a
    LEFT JOIN import_runs ir ON ir.id = a.source_import_run_id
    WHERE ${whereSql}
  `))[0]?.total ?? 0;
  const rows = await runJson(`
    SELECT a.ad_archive_id, a.page_id, a.page_name, a.page_like_count,
           a.is_active, a.start_date_iso, a.end_date_iso, a.active_days,
           a.display_format, a.cta_text, a.cta_type, a.caption, a.link_url,
           a.link_domain,
           a.title, a.body_text, a.link_description, a.has_images,
           a.has_videos, a.media_count, a.first_seen_at, a.last_seen_at,
           ir.query AS source_query
    FROM ads a
    LEFT JOIN import_runs ir ON ir.id = a.source_import_run_id
    WHERE ${whereSql}
    ORDER BY ${sorts[sort] ?? "a.active_days"} ${order}, a.ad_archive_id DESC
    LIMIT ${limit} OFFSET ${offset}
  `);
  return NextResponse.json({ rows, total, limit, offset });
}
