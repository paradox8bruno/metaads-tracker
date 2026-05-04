import { NextResponse } from "next/server";
import { ensurePageFavoritesTable, execSql, one, sqlString } from "../../../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request, { params }) {
  const { id } = await params;
  await ensurePageFavoritesTable();
  const row = await one(`
    SELECT pf.page_id, pf.created_at
    FROM page_favorites pf
    WHERE pf.page_id = ${sqlString(id)}
  `, null);
  return NextResponse.json({ is_favorite: Boolean(row), favorited_at: row?.created_at ?? null });
}

export async function POST(request, { params }) {
  const { id } = await params;
  await ensurePageFavoritesTable();
  const body = await request.json().catch(() => ({}));
  await execSql(`
    INSERT INTO page_favorites(page_id, note, updated_at)
    VALUES (${sqlString(id)}, ${sqlString(body.note || "")}, now())
    ON CONFLICT(page_id) DO UPDATE SET
      note = excluded.note,
      updated_at = now();
  `);
  const row = await one(`
    SELECT page_id, created_at, updated_at
    FROM page_favorites
    WHERE page_id = ${sqlString(id)}
  `);
  return NextResponse.json({ is_favorite: true, favorite: row });
}

export async function DELETE(_request, { params }) {
  const { id } = await params;
  await ensurePageFavoritesTable();
  await execSql(`DELETE FROM page_favorites WHERE page_id = ${sqlString(id)};`);
  return NextResponse.json({ is_favorite: false });
}
