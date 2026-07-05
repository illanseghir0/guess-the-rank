/* ============================================================
   legacyScrape.ts — MODULE LEGACY : scraping de listes via proxys CORS
   Chemin de secours uniquement : il ne sert que si la DB est
   indisponible (catalogue embarqué) ou pour de très vieux caches.
   Le chemin nominal est la table `lists` (films JSONB enrichis).
   Le jour où plus personne n'en dépend, supprimer ce fichier et
   ses appels d'un bloc (loadList dans stores/list.ts).
   ============================================================ */

import type { Film } from "../types";
import { fetchHTML, parseListPage } from "./letterboxd";

export interface ScrapedList {
  title: string | null;
  films: Film[];
}

/** aspire une liste page par page via les proxys CORS (20 pages max) */
export async function scrapeListPages(
  base: string,
  onProgress?: (page: number, totalPages: number | null) => void,
): Promise<ScrapedList> {
  let page = 1;
  const out: Film[] = [];
  let title: string | null = null, totalPages: number | null = null;
  const seen = new Set<string>();
  while (page <= 20) {
    onProgress?.(page, totalPages);
    const html = await fetchHTML(page === 1 ? base : `${base}page/${page}/`);
    const parsed = parseListPage(html, out.length);
    if (page === 1) { title = parsed.title; totalPages = parsed.totalPages; }
    if (!parsed.entries.length) break;
    for (const f of parsed.entries) {
      if (f.slug && seen.has(f.slug)) continue;
      if (f.slug) seen.add(f.slug);
      out.push(f);
    }
    if (totalPages && page >= totalPages) break;
    page++;
    await new Promise((r) => setTimeout(r, 250)); // politesse
  }
  if (!out.length) throw new Error("liste vide");
  out.sort((a, b) => a.rank - b.rank);
  return { title, films: out };
}
