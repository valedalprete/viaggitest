'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Users, UserPlus, Trash2, Copy, Check, Link2, Crown, Edit3, Eye, Loader2, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { TripMember, TripInvite, TripRole, ROLE_LABELS, ROLE_COLORS } from '@/lib/types';

interface MemberWithProfile {
  id: string;
  trip_id: string;
  user_id: string;
  role: TripRole;
  joined_at: string;
  profiles: { display_name: string | null; email: string; avatar_url: string | null } | null;
}

function MemberAvatar({ member }: { member: MemberWithProfile }) {
  const name = member.profiles?.display_name || member.profiles?.email || '?';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="w-9 h-9 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
      <span className="text-primary-900 font-bold text-xs">{initials}</span>
    </div>
  );
}

function RoleIcon({ role }: { role: TripRole }) {
  if (role === 'owner') return <Crown size={12} className="text-amber-600" />;
  if (role === 'editor') return <Edit3 size={12} className="text-blue-600" />;
  return <Eye size={12} className="text-gray-500" />;
}

export default function CollaboratorsPanel() {
  const { id: tripId } = useParams<{ id: string }>();
  const [myRole, setMyRole] = useState<TripRole | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [invites, setInvites] = useState<TripInvite[]>([]);
  const [loading, setLoading] = useState(true);

  // Invite form state
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviting, setInviting] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [inviteError, setInviteError] = useState('');

  const loadData = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [membersRes, invitesRes, myRoleRes] = await Promise.all([
      supabase.from('trip_members').select('id, user_id, role, joined_at').eq('trip_id', tripId),
      supabase.from('trip_invites').select('*').eq('trip_id', tripId).is('accepted_at', null),
      supabase.from('trip_members').select('role').eq('trip_id', tripId).eq('user_id', user.id).single(),
    ]);

    setMyRole((myRoleRes.data?.role as TripRole) || null);
    setInvites(invitesRes.data ?? []);

    // Fetch profiles for members
    const memberList = membersRes.data ?? [];
    if (memberList.length > 0) {
      const userIds = memberList.map(m => m.user_id);
      const { data: profiles } = await supabase.from('profiles').select('id, display_name, email, avatar_url').in('id', userIds);
      const profileMap = Object.fromEntries((profiles ?? []).map(p => [p.id, p]));
      setMembers(memberList.map(m => ({
        id: m.id,
        trip_id: tripId,
        user_id: m.user_id,
        role: m.role as TripRole,
        joined_at: m.joined_at ?? '',
        profiles: profileMap[m.user_id] || null,
      })));
    } else {
      setMembers([]);
    }

    setLoading(false);
  }, [tripId]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGenerateLink = async () => {
    setInviting(true);
    setInviteError('');
    setInviteLink('');
    try {
      const res = await fetch('/api/invite/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trip_id: tripId, role: inviteRole }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Errore');
      setInviteLink(data.inviteUrl);
      await loadData(); // refresh invites list
    } catch (e: unknown) {
      setInviteError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = async () => {
    if (!inviteLink) return;
    await navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRemoveMember = async (memberId: string, userId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    if (!confirm('Rimuovere questo membro dal viaggio?')) return;
    await supabase.from('trip_members').delete().eq('id', memberId);
    setMembers(prev => prev.filter(m => m.id !== memberId));
    // Also clear any pending invites for that user (optional UX)
  };

  const handleCancelInvite = async (inviteId: string) => {
    const supabase = createClient();
    await supabase.from('trip_invites').delete().eq('id', inviteId);
    setInvites(prev => prev.filter(i => i.id !== inviteId));
    if (inviteLink) setInviteLink('');
  };

  const handleChangeRole = async (memberId: string, newRole: TripRole) => {
    const supabase = createClient();
    await supabase.from('trip_members').update({ role: newRole }).eq('id', memberId);
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));
  };

  if (loading) return (
    <div className="card p-6 mt-6 animate-pulse">
      <div className="h-5 bg-sand-200 rounded w-32 mb-4" />
      <div className="space-y-3">
        {[1, 2].map(i => <div key={i} className="h-12 bg-sand-100 rounded-xl" />)}
      </div>
    </div>
  );

  const canManage = myRole === 'owner' || myRole === 'editor';
  const isOwner = myRole === 'owner';

  // Filter expired invites from display
  const pendingInvites = invites.filter(i => new Date(i.expires_at) > new Date());

  return (
    <div className="card p-6 mt-6">
      <h2 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
        <Users size={17} className="text-primary-700" />
        Collaboratori
      </h2>

      {/* Members list */}
      <div className="space-y-2 mb-6">
        {members.map(member => {
          const name = member.profiles?.display_name || member.profiles?.email || 'Utente sconosciuto';
          const isSelf = false; // simplified — we'd need user.id here
          return (
            <div key={member.id} className="flex items-center gap-3 p-3 bg-sand-50 rounded-xl border border-sand-200">
              <MemberAvatar member={member} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm text-gray-900 truncate">{name}</p>
                <p className="text-xs text-gray-400 truncate">{member.profiles?.email}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {isOwner && member.role !== 'owner' ? (
                  <select
                    value={member.role}
                    onChange={e => handleChangeRole(member.id, e.target.value as TripRole)}
                    className="text-xs border border-sand-300 rounded-lg px-2 py-1 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
                  >
                    <option value="editor">Editor</option>
                    <option value="viewer">Visualizzatore</option>
                  </select>
                ) : (
                  <span className={`badge flex items-center gap-1 ${ROLE_COLORS[member.role]}`}>
                    <RoleIcon role={member.role} />
                    {ROLE_LABELS[member.role]}
                  </span>
                )}
                {isOwner && member.role !== 'owner' && (
                  <button
                    onClick={() => handleRemoveMember(member.id, member.user_id)}
                    className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    title="Rimuovi membro"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Pending invites */}
      {pendingInvites.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Inviti in attesa</p>
          <div className="space-y-2">
            {pendingInvites.map(invite => (
              <div key={invite.id} className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100">
                <Link2 size={14} className="text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-blue-700 font-medium">
                    Link {invite.role === 'editor' ? 'Editor' : 'Visualizzatore'} —
                    scade il {new Date(invite.expires_at).toLocaleDateString('it-IT')}
                  </p>
                </div>
                {isOwner && (
                  <button
                    onClick={() => handleCancelInvite(invite.id)}
                    className="p-1.5 text-blue-400 hover:text-red-500 rounded-lg transition-colors"
                    title="Revoca invito"
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generate invite link (owner + editor) */}
      {canManage && (
        <div className="border-t border-sand-200 pt-4">
          <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            <UserPlus size={15} className="text-primary-700" />
            Invita collaboratore
          </p>

          <div className="flex gap-2 mb-3">
            <select
              value={inviteRole}
              onChange={e => setInviteRole(e.target.value as 'editor' | 'viewer')}
              className="input flex-1 text-sm py-2"
            >
              <option value="editor">Editor — può modificare</option>
              <option value="viewer">Visualizzatore — solo lettura</option>
            </select>
            <button
              onClick={handleGenerateLink}
              disabled={inviting}
              className="btn-primary text-sm py-2 px-4"
            >
              {inviting ? <Loader2 size={14} className="animate-spin" /> : 'Genera link'}
            </button>
          </div>

          {inviteError && (
            <p className="text-xs text-red-600 mb-2">{inviteError}</p>
          )}

          {inviteLink && (
            <div className="flex gap-2">
              <input
                type="text"
                value={inviteLink}
                readOnly
                className="input text-xs flex-1 bg-sand-50 text-gray-600 cursor-text"
              />
              <button
                onClick={handleCopyLink}
                className={`btn-secondary text-sm py-2 px-3 flex-shrink-0 ${copied ? 'text-emerald-700' : ''}`}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          )}

          <p className="text-xs text-gray-400 mt-2">
            Copia il link e condividilo con chi vuoi invitare. Il link scade dopo 7 giorni.
          </p>
        </div>
      )}
    </div>
  );
}
