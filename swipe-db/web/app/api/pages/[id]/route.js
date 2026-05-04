import { NextResponse } from "next/server";
import { execSql, one, runJson, sqlString } from "../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  const page = await one(`
    SELECT p.*, ps.ads_count, ps.active_ads, ps.max_active_days, ps.avg_active_days
    FROM pages p
    LEFT JOIN page_stats ps ON ps.page_id = p.page_id
    WHERE p.page_id = ${sqlString(id)}
  `, null);
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });
  return NextResponse.json({ page });
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  const pageId = sqlString(id);
  const page = await one(`
    SELECT COALESCE(ps.page_name, p.page_name, ${pageId}) AS page_name,
           COALESCE(ps.ads_count, 0) AS ads_count
    FROM pages p
    LEFT JOIN page_stats ps ON ps.page_id = p.page_id
    WHERE p.page_id = ${pageId}
  `, null);
  if (!page) return NextResponse.json({ error: "Page not found" }, { status: 404 });

  const deletedAds = await runJson(`
    DELETE FROM ads
    WHERE page_id = ${pageId}
    RETURNING ad_archive_id
  `);
  await execSql(`DELETE FROM page_favorites WHERE page_id = ${pageId}`);
  await execSql(`DELETE FROM page_stats WHERE page_id = ${pageId}`);
  await execSql(`DELETE FROM page_library_syncs WHERE page_id = ${pageId}`);
  await execSql(`DELETE FROM pages WHERE page_id = ${pageId}`);

  return NextResponse.json({
    deleted: {
      page_id: id,
      page_name: page.page_name,
      ads_deleted: deletedAds.length,
    },
  });
}
