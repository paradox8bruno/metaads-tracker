import { NextResponse } from "next/server";
import { execSql, one, runJson, sqlString } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id: rawId } = await params;
  const id = sqlString(rawId);
  const ad = await one(`
    SELECT a.*, ir.query AS source_query, ir.imported_at AS source_imported_at
    FROM ads a
    LEFT JOIN import_runs ir ON ir.id = a.source_import_run_id
    WHERE a.ad_archive_id = ${id}
  `, null);
  if (!ad) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  const media = await runJson(`
    SELECT media_type, position, url, preview_url, hd_url, sd_url
    FROM ad_media
    WHERE ad_archive_id = ${id}
    ORDER BY position, id
  `);
  const cards = await runJson(`
    SELECT position, title, body_text, caption, cta_text, link_url
    FROM ad_cards
    WHERE ad_archive_id = ${id}
    ORDER BY position, id
  `);
  return NextResponse.json({ ad, media, cards });
}

async function refreshPageStats(pageId) {
  if (!pageId) return;
  await execSql(`
    DELETE FROM page_stats
    WHERE page_id = ${sqlString(pageId)}
      AND NOT EXISTS (SELECT 1 FROM ads WHERE page_id = ${sqlString(pageId)});
  `);
  await execSql(`
    INSERT INTO page_stats(
      page_id, page_name, page_like_count, ads_count, active_ads,
      max_active_days, avg_active_days, first_seen_at, last_seen_at, updated_at
    )
    SELECT
      a.page_id,
      MAX(a.page_name),
      MAX(a.page_like_count),
      COUNT(*),
      SUM(CASE WHEN a.is_active = 1 THEN 1 ELSE 0 END),
      MAX(a.active_days),
      ROUND(AVG(a.active_days), 1)::float,
      MIN(a.first_seen_at),
      MAX(a.last_seen_at),
      now()
    FROM ads a
    WHERE a.page_id = ${sqlString(pageId)}
    GROUP BY a.page_id
    ON CONFLICT(page_id) DO UPDATE SET
      page_name=excluded.page_name,
      page_like_count=excluded.page_like_count,
      ads_count=excluded.ads_count,
      active_ads=excluded.active_ads,
      max_active_days=excluded.max_active_days,
      avg_active_days=excluded.avg_active_days,
      first_seen_at=excluded.first_seen_at,
      last_seen_at=excluded.last_seen_at,
      updated_at=now();
  `);
}

export async function DELETE(_request, { params }) {
  const { id: rawId } = await params;
  const id = sqlString(rawId);
  const deleted = await runJson(`
    DELETE FROM ads
    WHERE ad_archive_id = ${id}
    RETURNING ad_archive_id, page_id, page_name
  `);
  if (!deleted.length) return NextResponse.json({ error: "Ad not found" }, { status: 404 });
  await refreshPageStats(deleted[0].page_id);
  return NextResponse.json({ deleted: deleted[0] });
}
