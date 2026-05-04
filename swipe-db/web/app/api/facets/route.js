import { NextResponse } from "next/server";
import { domainExpr, runJson } from "../../../lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const ctas = await runJson(`
    SELECT cta_text AS value, COUNT(*) AS count
    FROM ads
    WHERE cta_text IS NOT NULL AND cta_text <> ''
    GROUP BY cta_text
    ORDER BY count DESC, cta_text
    LIMIT 80
  `);
  const formats = await runJson(`
    SELECT display_format AS value, COUNT(*) AS count
    FROM ads
    WHERE display_format IS NOT NULL AND display_format <> ''
    GROUP BY display_format
    ORDER BY count DESC, display_format
    LIMIT 40
  `);
  const queries = await runJson(`
    SELECT query AS value, SUM(items_seen) AS seen, SUM(items_inserted) AS inserted
    FROM import_runs
    WHERE query IS NOT NULL AND query <> ''
    GROUP BY query
    ORDER BY inserted DESC, seen DESC
    LIMIT 100
  `);
  const domains = await runJson(`
    SELECT ${domainExpr()} AS value, COUNT(*) AS count
    FROM ads
    WHERE link_domain IS NOT NULL AND link_domain <> ''
    GROUP BY link_domain
    ORDER BY count DESC, value
    LIMIT 120
  `);
  const countries = await runJson(`
    SELECT country_iso_code AS value, COUNT(*) AS count
    FROM ads
    WHERE country_iso_code IS NOT NULL AND country_iso_code <> ''
    GROUP BY country_iso_code
    ORDER BY count DESC, country_iso_code
    LIMIT 80
  `);
  return NextResponse.json({ ctas, formats, queries, domains, countries });
}
