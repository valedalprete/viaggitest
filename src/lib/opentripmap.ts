import { OpenTripMapDetail, OpenTripMapPlace } from './types';

const API_KEY = process.env.NEXT_PUBLIC_OPENTRIPMAP_API_KEY;
const BASE_URL = 'https://api.opentripmap.com/0.1/en/places';

/**
 * Search for POIs around a lat/lon point.
 * kinds: e.g. 'interesting_places,museums,architecture' or 'foods,restaurants'
 */
export async function searchPlaces(
  lat: number,
  lon: number,
  kinds: string,
  radius = 5000,
  limit = 20
): Promise<OpenTripMapPlace[]> {
  if (!API_KEY || API_KEY === 'your_opentripmap_key_here') return [];

  try {
    const url = new URL(`${BASE_URL}/radius`);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('radius', String(radius));
    url.searchParams.set('kinds', kinds);
    url.searchParams.set('rate', '2');
    url.searchParams.set('limit', String(limit));
    url.searchParams.set('format', 'json');
    url.searchParams.set('apikey', API_KEY);

    const res = await fetch(url.toString(), { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

/**
 * Get full details for a specific POI by its xid.
 */
export async function getPlaceDetail(xid: string): Promise<OpenTripMapDetail | null> {
  if (!API_KEY || API_KEY === 'your_opentripmap_key_here') return null;

  try {
    const url = `${BASE_URL}/xid/${xid}?apikey=${API_KEY}`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

/**
 * Text search for places near a point (autosuggest).
 */
export async function autosuggestPlaces(
  name: string,
  lat: number,
  lon: number,
  kinds?: string
): Promise<OpenTripMapPlace[]> {
  if (!API_KEY || API_KEY === 'your_opentripmap_key_here') return [];

  try {
    const url = new URL(`${BASE_URL}/autosuggest`);
    url.searchParams.set('name', name);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    url.searchParams.set('radius', '10000');
    url.searchParams.set('limit', '10');
    url.searchParams.set('format', 'json');
    if (kinds) url.searchParams.set('kinds', kinds);
    url.searchParams.set('apikey', API_KEY);

    const res = await fetch(url.toString());
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

export function formatKinds(kinds: string): string {
  const map: Record<string, string> = {
    museums: 'Museo',
    architecture: 'Architettura',
    churches: 'Chiesa',
    natural: 'Natura',
    historic_architecture: 'Storico',
    interesting_places: 'Luogo d\'interesse',
    foods: 'Cibo',
    restaurants: 'Ristorante',
    cultural: 'Cultura',
    amusements: 'Intrattenimento',
    sport: 'Sport',
    beaches: 'Spiaggia',
    gardens: 'Giardino',
  };
  const first = kinds.split(',')[0];
  return map[first] ?? first;
}
