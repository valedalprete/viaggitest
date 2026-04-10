'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Edit, Trash2, Users } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import EmptyState from '@/components/EmptyState';
import Modal from '@/components/Modal';

const AVATAR_OPTIONS = [
  'alice', 'emma', 'sofia', 'luna', 'olivia', 'giulia', 'sara', 'mia',
  'emma-2', 'aria', 'noa', 'aurora', 'violet', 'isabella', 'chiara', 'valentina',
  'martina', 'gaia', 'alice-2', 'elena', 'camilla', 'flora', 'anna', 'nicole',
  'beatrice', 'sofia-2', 'luna-2', 'emma-3', 'maria', 'roberta', 'alessia', 'greta',
  'iris', 'maya', 'sabrina', 'daria'
];

const getDiceBearUrl = (seed: string) => {
  const encoded = encodeURIComponent(seed);
  return `https://api.dicebear.com/9.x/personas/svg?seed=${encoded}`;
};

interface ChallengeParticipant {
  id: string;
  trip_id: string;
  name: string;
  avatar_style: string;
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
  const [selectedAvatarStyle, setSelectedAvatarStyle] = useState(AVATAR_OPTIONS[0]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingParticipant, setEditingParticipant] = useState<ChallengeParticipant | null>(null);

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

    if (editingParticipant) {
      await supabase.from('trip_challenge_participants').update({
        name,
        avatar_style: selectedAvatarStyle,
      }).eq('id', editingParticipant.id);
    } else {
      await supabase.from('trip_challenge_participants').insert({
        trip_id: tripId,
        name,
        avatar_style: selectedAvatarStyle,
        created_by: uid,
      });
    }

    setNewName('');
    setSelectedAvatarStyle(AVATAR_OPTIONS[0]);
    setEditingParticipant(null);
    setModalOpen(false);
    setAdding(false);
    await load();
  };

  const openEditParticipant = (participant: ChallengeParticipant) => {
    setEditingParticipant(participant);
    setNewName(participant.name);
    setSelectedAvatarStyle(participant.avatar_style);
    setModalOpen(true);
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
        <h1 className="text-xl font-bold text-gray-900">Classifica</h1>
      </div>

      <button onClick={() => { setEditingParticipant(null); setNewName(''); setSelectedAvatarStyle(AVATAR_OPTIONS[0]); setModalOpen(true); }} className="btn-primary mb-4 w-full justify-center"><span>+ Aggiungi partecipante</span></button>

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
        <div className="space-y-6">
          {/* Top 3 Podium */}
          {ranking.length >= 1 && (
            <div className="flex items-flex-end justify-center gap-4 mb-8">
              {ranking.slice(0, 3).map((p, idx) => {
                const positions = [1, 0, 2]; // order for display: 2nd, 1st, 3rd
                const displayIdx = positions[idx];
                const heights = ['h-32', 'h-40', 'h-24'];
                const bgColors = ['bg-orange-100', 'bg-yellow-100', 'bg-orange-100'];
                const medals = ['🥈', '🥇', '🥉'];
                
                return (
                  <div key={p.id} className={`flex flex-col items-center ${heights[displayIdx]}`}>
                    <div className="text-2xl mb-2">{medals[displayIdx]}</div>
                    <div className="mb-2">
                      <img src={getDiceBearUrl(p.avatar_style)} alt={p.name} className="w-16 h-16 rounded-full" />
                    </div>
                    <div className={`${bgColors[displayIdx]} rounded-2xl px-4 py-3 text-center w-28`}>
                      <p className="font-bold text-sm text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-600 mt-1">{p.points} pt</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Full ranking list */}
          <div className="space-y-2">
            {ranking.map((p, index) => (
              <div key={p.id} className="card p-3">
                <div className="flex items-center gap-3">
                  <img src={getDiceBearUrl(p.avatar_style)} alt={p.name} className="w-10 h-10 rounded-full" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold text-gray-900">#{index + 1} · {p.name}</p>
                    <p className="text-xs text-gray-500">{p.points} {p.points === 1 ? 'punto' : 'punti'}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => openEditParticipant(p)}
                      className="p-2 rounded-lg text-blue-600 hover:bg-blue-50"
                      aria-label={`Modifica ${p.name}`}
                      title={`Modifica ${p.name}`}
                    >
                      <Edit size={14} />
                    </button>
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
              </div>
            ))}
          </div>
        </div>
      )}

      {modalOpen && (
        <Modal title={editingParticipant ? 'Modifica partecipante' : 'Aggiungi partecipante'} onClose={() => { setModalOpen(false); setEditingParticipant(null); }}>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addParticipant();
            }}
            className="space-y-4"
          >
            <div className="form-group">
              <label className="label">Nome partecipante *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="input"
                placeholder="Es. Marco"
                autoFocus
                required
              />
            </div>

            <div className="form-group">
              <label className="label">Scegli avatar</label>
              <div className="grid grid-cols-4 gap-2">
                {AVATAR_OPTIONS.map((style) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => setSelectedAvatarStyle(style)}
                    className={`p-2 rounded-xl transition-all flex items-center justify-center aspect-square ${
                      selectedAvatarStyle === style
                        ? 'bg-blue-100 ring-2 ring-blue-500'
                        : 'bg-sand-100 hover:bg-sand-200'
                    }`}
                  >
                    <img src={getDiceBearUrl(style)} alt={style} className="w-12 h-12 rounded-full" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => { setModalOpen(false); setEditingParticipant(null); }} className="btn-secondary flex-1 justify-center">Annulla</button>
              <button type="submit" disabled={adding || !newName.trim()} className="btn-primary flex-1 justify-center">{adding ? (editingParticipant ? 'Salvataggio...' : 'Aggiunta...') : (editingParticipant ? 'Salva' : 'Aggiungi')}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
