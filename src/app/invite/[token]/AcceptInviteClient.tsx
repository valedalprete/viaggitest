'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Plane, MapPin, Users, Check, Loader2, LogIn } from 'lucide-react';
import { acceptInvite } from './actions';
import { ROLE_LABELS } from '@/lib/types';

interface InviteData {
  id: string;
  trip_id: string;
  role: 'editor' | 'viewer';
  trips: { id: string; name: string; destination: string; cover_image: string | null };
  profiles: { display_name: string | null; email: string } | null;
}

interface Props {
  invite: InviteData;
  user: { id: string; email?: string } | null;
  token: string;
  alreadyMember: boolean;
}

export default function AcceptInviteClient({ invite, user, token, alreadyMember }: Props) {
  const [accepting, setAccepting] = useState(false);

  const handleAccept = async () => {
    setAccepting(true);
    await acceptInvite(token);
  };

  const inviterName = invite.profiles?.display_name || invite.profiles?.email || 'Qualcuno';
  const roleLabel = ROLE_LABELS[invite.role];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-900 via-primary-800 to-teal-700 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-amber-400 rounded-2xl mb-4 shadow-elevated">
            <Plane size={30} className="text-primary-900" />
          </div>
          <h1 className="text-3xl font-extrabold text-white">Invito al viaggio</h1>
          <p className="text-white/60 mt-2 text-sm">Sei stato invitato a collaborare</p>
        </div>

        <div className="bg-[#fefcf8] rounded-2xl shadow-elevated border border-sand-200 p-8">
          {/* Trip info */}
          <div className="flex items-center gap-3 p-4 bg-sand-50 rounded-xl mb-6 border border-sand-200">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-teal-700 to-emerald-500 flex items-center justify-center flex-shrink-0">
              <Plane size={20} className="text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-bold text-gray-900 truncate">{invite.trips.name}</p>
              <div className="flex items-center gap-1 text-sm text-gray-500">
                <MapPin size={12} />
                <span className="truncate">{invite.trips.destination}</span>
              </div>
            </div>
          </div>

          {/* Invite details */}
          <div className="space-y-3 mb-6">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500 flex items-center gap-1.5">
                <Users size={14} /> Invitato da
              </span>
              <span className="font-semibold text-gray-800">{inviterName}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Il tuo ruolo</span>
              <span className={`badge ${invite.role === 'editor' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                {roleLabel}
              </span>
            </div>
            {invite.role === 'editor' && (
              <p className="text-xs text-gray-400 bg-blue-50 rounded-lg p-3">
                Come <strong>Editor</strong> puoi aggiungere e modificare voli, alloggi, ristoranti, spese e tutto il resto del viaggio.
              </p>
            )}
            {invite.role === 'viewer' && (
              <p className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3">
                Come <strong>Visualizzatore</strong> puoi vedere tutti i dettagli del viaggio ma non apportare modifiche.
              </p>
            )}
          </div>

          {/* Action */}
          {alreadyMember ? (
            <div className="text-center">
              <div className="inline-flex items-center gap-2 text-emerald-700 font-semibold mb-4">
                <Check size={18} /> Sei già membro di questo viaggio
              </div>
              <Link
                href={`/trip/${invite.trip_id}`}
                className="btn-primary w-full justify-center"
              >
                Vai al viaggio
              </Link>
            </div>
          ) : user ? (
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              {accepting ? (
                <><Loader2 size={16} className="animate-spin" /> Accettando...</>
              ) : (
                <><Check size={16} /> Accetta invito</>
              )}
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-600 text-center mb-4">
                Accedi o registrati per accettare l&apos;invito
              </p>
              <Link
                href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                className="btn-primary w-full justify-center py-3 text-base"
              >
                <LogIn size={16} /> Accedi
              </Link>
              <Link
                href={`/register?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-primary-800 text-primary-800 font-bold rounded-xl hover:bg-primary-50 transition-colors text-sm"
              >
                Registrati
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
