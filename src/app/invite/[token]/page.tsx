import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import AcceptInviteClient from './AcceptInviteClient';

interface Props {
  params: Promise<{ token: string }> | { token: string };
}

export default async function InvitePage({ params }: Props) {
  const { token } = await Promise.resolve(params);
  const admin = createAdminClient();
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Fetch invite with trip and inviter profile using admin client (bypasses RLS)
  const { data: invite, error: inviteError } = await admin
    .from('trip_invites')
    .select(`
      id,
      trip_id,
      role,
      expires_at,
      accepted_at,
      invited_by,
      trips ( id, name, destination, cover_image )
    `)
    .eq('token', token)
    .single();

  let inviterProfile: { display_name: string | null; email: string } | null = null;
  if (invite?.invited_by) {
    const { data: profileData } = await admin
      .from('profiles')
      .select('display_name, email')
      .eq('id', invite.invited_by)
      .single();
    inviterProfile = profileData ?? null;
  }

  const inviteWithProfile = invite
    ? { ...invite, profiles: inviterProfile }
    : null;

  if (!inviteWithProfile || inviteError) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-teal-700 flex items-center justify-center p-4">
        <div className="bg-[#fefcf8] rounded-2xl shadow-elevated p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">🔗</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Link non valido</h2>
          <p className="text-gray-500 text-sm">Questo link di invito non esiste o è scaduto.</p>
        </div>
      </div>
    );
  }

  if (new Date(inviteWithProfile.expires_at) < new Date()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-teal-700 flex items-center justify-center p-4">
        <div className="bg-[#fefcf8] rounded-2xl shadow-elevated p-10 max-w-md w-full text-center">
          <div className="text-5xl mb-4">⏰</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Invito scaduto</h2>
          <p className="text-gray-500 text-sm">
            Questo invito è scaduto. Chiedi al proprietario del viaggio di inviarti un nuovo link.
          </p>
        </div>
      </div>
    );
  }

  // Check if current user is already a member
  let alreadyMember = false;
  if (user) {
    const { data: membership } = await admin
      .from('trip_members')
      .select('id')
      .eq('trip_id', inviteWithProfile.trip_id)
      .eq('user_id', user.id)
      .single();
    alreadyMember = !!membership;
  }

  return (
    <AcceptInviteClient
      invite={inviteWithProfile as unknown as Parameters<typeof AcceptInviteClient>[0]['invite']}
      user={user}
      token={token}
      alreadyMember={alreadyMember}
    />
  );
}
