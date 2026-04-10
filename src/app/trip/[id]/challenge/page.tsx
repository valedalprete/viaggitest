'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ListChecks, Trophy, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function ChallengeHubPage() {
  const supabase = createClient();
  const { id: tripId } = useParams<{ id: string }>();
  const [participantsCount, setParticipantsCount] = useState(0);
  const [challengesCount, setChallengesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [{ count: pCount }, { count: cCount }] = await Promise.all([
        supabase.from('trip_challenge_participants').select('id', { count: 'exact', head: true }).eq('trip_id', tripId),
        supabase.from('trip_challenges').select('id', { count: 'exact', head: true }).eq('trip_id', tripId),
      ]);
      setParticipantsCount(pCount ?? 0);
      setChallengesCount(cCount ?? 0);
      setLoading(false);
    };

    load();
  }, [tripId]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href={`/trip/${tripId}`}
        aria-label="Torna al viaggio"
        title="Torna al viaggio"
        className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={18} strokeWidth={2.3} />
      </Link>

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
          <Trophy size={18} className="text-yellow-700" />
        </div>
        <h1 className="text-xl font-bold text-gray-900">Challenge</h1>
      </div>

      {loading ? (
        <div className="space-y-3">
          <div className="card h-24 animate-pulse bg-sand-200" />
          <div className="card h-24 animate-pulse bg-sand-200" />
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          <Link href={`/trip/${tripId}/challenge/classifica`}>
            <div className="card p-4 hover:shadow-card-hover transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Users size={17} className="text-blue-700" />
                </div>
                <h2 className="font-bold text-gray-900">Partecipanti & classifica</h2>
              </div>
              <p className="text-xs text-gray-500 mt-2">{participantsCount} partecipanti</p>
            </div>
          </Link>

          <Link href={`/trip/${tripId}/challenge/sfide`}>
            <div className="card p-4 hover:shadow-card-hover transition-all hover:-translate-y-0.5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                  <ListChecks size={17} className="text-emerald-700" />
                </div>
                <h2 className="font-bold text-gray-900">Gestione sfide</h2>
              </div>
              <p className="text-xs text-gray-500 mt-2">{challengesCount} sfide</p>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
