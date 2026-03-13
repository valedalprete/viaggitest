'use server';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?redirect=/invite/${token}`);
  }

  const admin = createAdminClient();

  // Validate invite
  const { data: invite, error } = await admin
    .from('trip_invites')
    .select('id, trip_id, role, expires_at, accepted_at')
    .eq('token', token)
    .single();

  if (error || !invite) {
    redirect('/dashboard?error=invite_invalid');
  }

  if (new Date(invite.expires_at) < new Date()) {
    redirect('/dashboard?error=invite_expired');
  }

  // Idempotent add membership (link can be used by multiple people until expiry)
  const { error: upsertErr } = await admin
    .from('trip_members')
    .upsert(
      {
        trip_id: invite.trip_id,
        user_id: user.id,
        role: invite.role,
      },
      { onConflict: 'trip_id,user_id', ignoreDuplicates: true }
    );

  if (upsertErr) {
    redirect('/dashboard?error=invite_failed');
  }

  redirect(`/trip/${invite.trip_id}`);
}
