'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Medal, Plus, Trash2, Trophy, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import EmptyState from '@/components/EmptyState';

interface ChallengeParticipant {
  id: string;
  trip_id: string;
  name: string;
  created_at: string;
}

interface Challenge {
  id: string;
  trip_id: string;
  title: string;
  points: number;
}

interface ChallengeCompletion {
  id: string;
  challenge_id: string;
  participant_id: string;
}

export default function ChallengeLeaderboardPage() {
  const supabase = createClient();
  const { id: tripId } = useParams<{ id: string }>();

  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [completions, setCompletions] = useState<ChallengeCompletion[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: participantsData }, { data: challengesData }, { data: completionsData }] = await Promise.all([
      supabase.from('trip_challenge_participants').select('*').eq('trip_id', tripId).order('created_at', { ascending: true }),
      supabase.from('trip_challenges').select('id,trip_id,title,points').eq('trip_id', tripId),
      supabase.from('trip_challenge_completions').select('id,challenge_id,participant_id').eq('trip_id', tripId),
    ]);

    setParticipants((participantsData ?? []) as ChallengeParticipant[]);
    setChallenges((challengesData ?? []) as Challenge[]);
    setCompletions((completionsData ?? []) as ChallengeCompletion[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tripId]);

  const scoreMap = useMemo(() => {
    const pointsByChallenge = new Map<string, number>();
    challenges.forEach(ch => pointsByChallenge.set(ch.id, Number(ch.points) || 0));

    const map = new Map<string, number>();
    participants.forEach(p => map.set(p.id, 0));

    completions.forEach(c => {
      const score = pointsByChallenge.get(c.challenge_id) ?? 0;
      map.set(c.participant_id, (map.get(c.participant_id) ?? 0) + score);
    });

    return map;
  }, [challenges, completions, participants]);

  const ranking = useMemo(() => {
    return [...participants]
      .map(p => ({ ...p, points: scoreMap.get(p.id) ?? 0 }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        return a.name.localeCompare(b.name, 'it');
      });
  }, [participants, scoreMap]);

  const addParticipant = async () => {
    const name = newName.trim();
    if (!name) return;

    setAdding(true);
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) {
      setAdding(false);
      return;
    }

    await supabase.from('trip_challenge_participants').insert({
      trip_id: tripId,
      name,
      created_by: uid,
    });

    setNewName('');
    setAdding(false);
    await load();
  };

  const removeParticipant = async (participant: ChallengeParticipant) => {
    if (!confirm(`Eliminare definitivamente ${participant.name} dalla classifica?`)) return;
    await supabase.from('trip_challenge_participants').delete().eq('id', participant.id);
    await load();
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href={`/trip/${tripId}/challenge`}
        aria-label="Torna a challenge"
        title="Torna a challenge"
        className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={18} strokeWidth={2.3} />
      </Link>

      <div className="flex items-center gap-3 mb-5">
        <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
          <Users size={18} className="text-blue-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Partecipanti & classifica</h1>
        </div>
      </div>

      <div className="card p-4 mb-4">
        <div className="flex items-center gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                addParticipant();
              }
            }}
            className="input"
            placeholder="Nome partecipante"
          />
          <button onClick={addParticipant} disabled={adding} className="btn-primary whitespace-nowrap">
            <Plus size={15} /> Aggiungi
          </button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-sand-200" />)}
        </div>
      ) : ranking.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nessun partecipante"
          description="Aggiungi i nomi per iniziare la classifica challenge."
        />
      ) : (
        <div className="space-y-2">
          {ranking.map((p, index) => {
            const isTop = index === 0;
            return (
              <div key={p.id} className="card p-3">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isTop ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-600'}`}>
                    {isTop ? <Trophy size={15} /> : <Medal size={15} />}
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900 truncate">#{index + 1} · {p.name}</p>
                    <p className="text-xs text-gray-500">{p.points} {p.points === 1 ? 'punto' : 'punti'}</p>
                  </div>

                  <button
                    onClick={() => removeParticipant(p)}
                    className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                    aria-label={`Rimuovi ${p.name}`}
                    title={`Rimuovi ${p.name}`}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
