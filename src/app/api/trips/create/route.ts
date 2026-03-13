import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface CreateTripBody {
  name?: string;
  destination?: string;
  lat?: number | null;
  lon?: number | null;
  start_date?: string;
  end_date?: string;
  cover_image?: string | null;
  notes?: string | null;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const body = (await req.json()) as CreateTripBody;

    const name = body.name?.trim();
    const destination = body.destination?.trim();
    const startDate = body.start_date;
    const endDate = body.end_date;

    if (!name || !destination || !startDate || !endDate) {
      return NextResponse.json({ error: 'Campi obbligatori mancanti' }, { status: 400 });
    }

    const admin = createAdminClient();

    const { data, error } = await admin
      .from('trips')
      .insert({
        user_id: user.id,
        name,
        destination,
        lat: body.lat ?? null,
        lon: body.lon ?? null,
        start_date: startDate,
        end_date: endDate,
        cover_image: body.cover_image?.trim() || null,
        notes: body.notes?.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error || !data) {
      return NextResponse.json({ error: error?.message ?? 'Errore creazione viaggio' }, { status: 500 });
    }

    return NextResponse.json({ id: data.id });
  } catch (err) {
    console.error('[trips/create]', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
