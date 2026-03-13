import { NominatimResult } from './types';

/**
 * Geocode a destination name to lat/lon using Nominatim (OpenStreetMap).
 * No API key required. Max 1 req/sec.
 */
export async function geocodeDestination(query: string): Promise<NominatimResult[]> {
  if (!query.trim()) return [];

  try {
    const url = new URL('https://nominatim.openstreetmap.org/search');
    url.searchParams.set('q', query);
    url.searchParams.set('format', 'jsonv2');
    url.searchParams.set('limit', '5');
    url.searchParams.set('addressdetails', '1');
    url.searchParams.set('accept-language', 'it');

    const res = await fetch(url.toString(), {
      headers: { 'User-Agent': 'TravelPlanner/1.0' },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}
