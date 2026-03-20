import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type OverpassElement = {
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
};

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function hasMuseumIntent(tokens: string[]): boolean {
  const museumKeywords = new Set([
    'museo', 'musei', 'museum', 'museums', 'science', 'scienza', 'scienze', 'ciencia', 'ciencias',
  ]);
  return tokens.some((t) => museumKeywords.has(t) || t.startsWith('muse'));
}

function expandQueryTokens(tokens: string[]): string[] {
  const out = new Set<string>(tokens);

  for (const token of tokens) {
    if (token.startsWith('muse')) {
      out.add('muse');
      out.add('museo');
      out.add('museu');
      out.add('museum');
    }

    if (token.startsWith('scien') || token.startsWith('scienz') || token.startsWith('cien')) {
      out.add('science');
      out.add('scienza');
      out.add('scienze');
      out.add('ciencia');
      out.add('ciencias');
      out.add('ciencies');
    }
  }

  return Array.from(out);
}

function distanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (v: number) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2)
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function scoreMatch(searchText: string, category: string, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 1;

  let score = 0;
  const words = searchText.split(' ').filter(Boolean);

  for (const token of queryTokens) {
    if (searchText.includes(token)) {
      score += token.length >= 5 ? 3 : 2;
      continue;
    }

    const nearWord = words.some((w) => w.startsWith(token) || token.startsWith(w));
    if (nearWord) {
      score += 1;
    }
  }

  if (hasMuseumIntent(queryTokens) && normalizeText(category).includes('museo')) {
    score += 2;
  }

  return score;
}

function guessCategory(tags: Record<string, string>): string {
  if (tags.tourism === 'museum') return 'Museo';
  if (tags.tourism === 'attraction') return 'Attrazione';
  if (tags.amenity === 'place_of_worship' || tags.building === 'church') return 'Chiesa';
  if (tags.historic) return 'Storico';
  if (tags.leisure === 'park' || tags.leisure === 'garden') return 'Parco';
  if (tags.tourism === 'gallery') return 'Galleria';
  if (tags.tourism === 'viewpoint') return 'Panorama';
  return 'Luogo di interesse';
}

export async function GET(req: NextRequest) {
  try {
    const city = (req.nextUrl.searchParams.get('city') ?? '').trim();
    const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
    const qTokensBase = normalizeText(q).split(' ').filter(Boolean);
    const qTokens = expandQueryTokens(qTokensBase);

    if (!city) {
      return NextResponse.json({ error: 'Parametro city obbligatorio' }, { status: 400 });
    }

    const nominatimUrl = new URL('https://nominatim.openstreetmap.org/search');
    nominatimUrl.searchParams.set('q', city);
    nominatimUrl.searchParams.set('format', 'jsonv2');
    nominatimUrl.searchParams.set('limit', '1');
    nominatimUrl.searchParams.set('addressdetails', '1');

    const geoRes = await fetch(nominatimUrl.toString(), {
      headers: {
        'User-Agent': 'viaggitest/1.0 (city-poi-search)',
      },
      next: { revalidate: 3600 },
    });

    if (!geoRes.ok) {
      return NextResponse.json({ error: 'Geocoding non disponibile' }, { status: 502 });
    }

    const geoData = (await geoRes.json()) as Array<{
      lat: string;
      lon: string;
      display_name: string;
      boundingbox?: [string, string, string, string];
    }>;
    const first = geoData[0];

    if (!first?.lat || !first?.lon) {
      return NextResponse.json({ results: [] });
    }

    const lat = Number(first.lat);
    const lon = Number(first.lon);
    const cityShort = normalizeText(first.display_name.split(',')[0] ?? city);

    const [south, north, west, east] = first.boundingbox
      ? [
          Number(first.boundingbox[0]),
          Number(first.boundingbox[1]),
          Number(first.boundingbox[2]),
          Number(first.boundingbox[3]),
        ]
      : [lat - 0.12, lat + 0.12, lon - 0.12, lon + 0.12];

    const overpassQuery = `
[out:json][timeout:25];
(
  nwr["tourism"~"museum|attraction|gallery|viewpoint|zoo|theme_park"](${south},${west},${north},${east});
  nwr["amenity"="place_of_worship"](${south},${west},${north},${east});
  nwr["building"="church"](${south},${west},${north},${east});
  nwr["historic"](${south},${west},${north},${east});
  nwr["leisure"~"park|garden"](${south},${west},${north},${east});
);
out center tags 300;
`;

    const overpassRes = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'User-Agent': 'viaggitest/1.0 (city-poi-search)',
      },
      body: new URLSearchParams({ data: overpassQuery }).toString(),
      next: { revalidate: 3600 },
    });

    if (!overpassRes.ok) {
      return NextResponse.json({ error: 'Ricerca luoghi non disponibile' }, { status: 502 });
    }

    const overpassData = (await overpassRes.json()) as { elements?: OverpassElement[] };
    const elements = overpassData.elements ?? [];

    const seen = new Set<string>();
    const mapped = elements
      .map((el) => {
        const tags = el.tags ?? {};
        const name = (tags.name ?? '').trim();
        const cLat = el.lat ?? el.center?.lat;
        const cLon = el.lon ?? el.center?.lon;
        if (!name || cLat == null || cLon == null) return null;

        const category = guessCategory(tags);
        const altNames = [
          tags['name:it'],
          tags['name:en'],
          tags['name:es'],
          tags['name:ca'],
          tags.alt_name,
          tags.official_name,
          tags.short_name,
        ]
          .filter((v): v is string => !!v && v.trim().length > 0)
          .join(' ');

        const address = [tags['addr:street'], tags['addr:housenumber'], tags['addr:city']]
          .filter(Boolean)
          .join(' ')
          .trim();

        const searchText = normalizeText(`${name} ${altNames} ${category} ${address}`);
        let score = scoreMatch(searchText, category, qTokens);
        if (qTokens.length > 0 && score <= 0) {
          return null;
        }

        const cityTag = normalizeText(tags['addr:city'] ?? tags['is_in:city'] ?? '');
        if (cityShort && cityTag.includes(cityShort)) score += 2;

        const km = distanceKm(lat, lon, cLat, cLon);
        score += Math.max(0, 6 - Math.floor(km));

        const key = `${name.toLowerCase()}|${Math.round(cLat * 1000)}|${Math.round(cLon * 1000)}`;
        if (seen.has(key)) return null;
        seen.add(key);

        return {
          xid: `osm-${el.id}`,
          name,
          kinds: category.toLowerCase().replace(/\s+/g, '_'),
          rate: '2',
          point: { lat: cLat, lon: cLon },
          category,
          address: address || null,
          maps_url: `https://www.google.com/maps/search/?api=1&query=${cLat},${cLon}`,
          _score: score,
        };
      })
      .filter((v): v is {
        xid: string;
        name: string;
        kinds: string;
        rate: string;
        point: { lat: number; lon: number };
        category: string;
        address: string | null;
        maps_url: string;
        _score: number;
      } => v !== null)
      .sort((a, b) => b._score - a._score)
      .slice(0, 30)
      .map(({ _score, ...rest }) => rest);

    return NextResponse.json({
      city: first.display_name,
      center: { lat, lon },
      results: mapped,
    });
  } catch (err) {
    console.error('[places/suggest]', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
