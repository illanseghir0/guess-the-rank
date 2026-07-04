export interface Film {
  rank: number;
  title: string;
  year: number | null;
  slug: string | null;
  url: string | null;
  /** undefined = pas encore récupérée, null = pas d'affiche */
  poster?: string | null;
  /** undefined = pas encore récupéré, null = inconnu */
  director?: string | null;
}

export interface RoundResult {
  title: string;
  year: number | null;
  rank: number;
  g: [number, number];
  d: [number, number];
  win: 0 | 1 | 2; // 0 = égalité
  pts: number;    // points marqués (mode course aux points)
}

/** un classement du catalogue curaté (table `lists` côté Supabase) */
export interface CatalogEntry {
  slug: string;
  url: string;
  title: string;
  cover: string | null;
  count: number;
  /** films depuis la DB ; null = à charger via proxys (catalogue de secours) */
  films: Film[] | null;
}

export interface Profile {
  id: string;
  username: string;
  games_played: number;
  games_won: number;
  best_gap: number | null;
  created_at?: string;
}
