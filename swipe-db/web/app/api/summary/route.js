import { NextResponse } from "next/server";
import { domainExpr, ensurePageFavoritesTable, one, runJson, tableExists } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await ensurePageFavoritesTable();
  const totals = await one(`
    SELECT
      (SELECT COUNT(*) FROM ads) AS ads,
      (SELECT COUNT(DISTINCT page_id) FROM ads) AS pages,
      (SELECT COUNT(*) FROM page_favorites) AS favorite_pages,
      (SELECT COUNT(*) FROM ad_media) AS media,
      (SELECT COUNT(*) FROM ad_cards) AS cards,
      (SELECT COUNT(*) FROM import_runs) AS imports,
      (SELECT COUNT(*) FROM ads WHERE is_active = 1) AS active_ads,
      ROUND((SELECT AVG(active_days) FROM ads), 1)::float AS avg_active_days,
      (SELECT MAX(active_days) FROM ads) AS max_active_days
  `);
  const top_ctas = await runJson(`
    SELECT COALESCE(NULLIF(cta_text, ''), 'Sem CTA') AS label, COUNT(*) AS count
    FROM ads GROUP BY label ORDER BY count DESC LIMIT 12
  `);
  const top_formats = await runJson(`
    SELECT COALESCE(NULLIF(display_format, ''), 'Sem formato') AS label, COUNT(*) AS count
    FROM ads GROUP BY label ORDER BY count DESC LIMIT 12
  `);
  const top_domains = await runJson(`
    SELECT ${domainExpr()} AS label, COUNT(*) AS count
    FROM ads
    WHERE link_domain IS NOT NULL AND link_domain <> ''
    GROUP BY link_domain
    ORDER BY count DESC LIMIT 12
  `);
  const durable_ads = await runJson(`
    SELECT ad_archive_id, page_name, title, body_text, cta_text, active_days,
           display_format, link_url, has_images, has_videos, media_count
    FROM ads
    WHERE active_days IS NOT NULL
    ORDER BY active_days DESC, media_count DESC
    LIMIT 10
  `);
  const recent_imports = await runJson(`
    SELECT id, query, items_seen, items_inserted, items_updated, imported_at
    FROM import_runs ORDER BY id DESC LIMIT 10
  `);
  const raindrop = {
    bookmarks: 0,
    relevant: 0,
    ignored: 0,
    targets: 0,
    unique_targets: 0,
    imported_targets: 0,
    ads_inserted: (await one(`
      SELECT COALESCE(SUM(items_inserted), 0) AS value
      FROM import_runs
      WHERE source = 'raindrop_apify_search'
    `)).value,
  };
  if (await tableExists("raindrop_items")) {
    Object.assign(raindrop, await one(`
      SELECT
        COUNT(*) AS bookmarks,
        SUM(CASE WHEN is_relevant = 1 THEN 1 ELSE 0 END) AS relevant,
        SUM(CASE WHEN is_relevant = 0 THEN 1 ELSE 0 END) AS ignored
      FROM raindrop_items
    `));
  }
  if (await tableExists("raindrop_targets")) {
    Object.assign(raindrop, await one(`
      SELECT
        COUNT(*) AS targets,
        COUNT(DISTINCT target_type || ':' || target_value) AS unique_targets,
        SUM(CASE WHEN status = 'imported' THEN 1 ELSE 0 END) AS imported_targets
      FROM raindrop_targets
    `));
  }
  return NextResponse.json({ totals, raindrop, top_ctas, top_formats, top_domains, durable_ads, recent_imports });
}
