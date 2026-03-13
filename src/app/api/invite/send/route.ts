import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Non autenticato' }, { status: 401 });
    }

    const { trip_id, role } = await req.json() as { trip_id: string; role: 'editor' | 'viewer' };

    if (!trip_id || !role) {
      return NextResponse.json({ error: 'Parametri mancanti' }, { status: 400 });
    }

    // Verify caller is editor/owner
    const { data: member } = await supabase
      .from('trip_members')
      .select('role')
      .eq('trip_id', trip_id)
      .eq('user_id', user.id)
      .single();

    if (!member || !['owner', 'editor'].includes(member.role)) {
      return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 });
    }

    const admin = createAdminClient();

    // Create invite
    const { data: invite, error } = await admin
      .from('trip_invites')
      .insert({
        trip_id,
        invited_by: user.id,
        role,
        // expires in 7 days (default in DB)
      })
      .select('token')
      .single();

    if (error || !invite) {
      return NextResponse.json({ error: 'Errore creazione invito' }, { status: 500 });
    }

    const origin = req.headers.get('origin');
    const forwardedHost = req.headers.get('x-forwarded-host');
    const forwardedProto = req.headers.get('x-forwarded-proto') || 'https';

    // Priority:
    // 1) Browser origin (works both in dev and prod)
    // 2) Forwarded host/proto (reverse proxy / Vercel)
    // 3) Explicit env URL (recommended in production)
    // 4) Local fallback
    const baseUrl =
      origin ||
      (forwardedHost ? `${forwardedProto}://${forwardedHost}` : null) ||
      process.env.NEXT_PUBLIC_APP_URL ||
      process.env.NEXT_PUBLIC_SITE_URL ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
      'http://localhost:3000';

    const inviteUrl = `${baseUrl.replace(/\/$/, '')}/invite/${invite.token}`;

    return NextResponse.json({ inviteUrl, token: invite.token });
  } catch (err) {
    console.error('[invite/send]', err);
    return NextResponse.json({ error: 'Errore interno' }, { status: 500 });
  }
}
