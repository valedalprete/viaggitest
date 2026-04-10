'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, ChevronDown, Edit, ListChecks, Plus, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';

interface ChallengeParticipant {
  id: string;
  name: string;
}

interface Challenge {
  id: string;
  trip_id: string;
  title: string;
  points: number;
  created_at: string;
}

interface ChallengeCompletion {
  id: string;
  challenge_id: string;
  participant_id: string;
}

export default function ChallengeTasksPage() {
  const supabase = createClient();
  const { id: tripId } = useParams<{ id: string }>();

  const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [completions, setCompletions] = useState<ChallengeCompletion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncingKey, setSyncingKey] = useState<string | null>(null);
  const [expandedChallengeId, setExpandedChallengeId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Challenge | null>(null);
  const [title, setTitle] = useState('');
  const [points, setPoints] = useState('10');

  const load = async () => {
    setLoading(true);
    const [{ data: participantsData }, { data: challengesData }, { data: completionsData }] = await Promise.all([
      supabase.from('trip_challenge_participants').select('id,name').eq('trip_id', tripId).order('created_at', { ascending: true }),
      supabase.from('trip_challenges').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
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

  const completionSet = useMemo(() => {
    const set = new Set<string>();
    completions.forEach(c => set.add(`${c.challenge_id}:${c.participant_id}`));
    return set;
  }, [completions]);

  const openAdd = () => {
    setEditing(null);
    setTitle('');
    setPoints('10');
    setModalOpen(true);
  };

  const openEdit = (challenge: Challenge) => {
    setEditing(challenge);
    setTitle(challenge.title);
    setPoints(String(challenge.points));
    setModalOpen(true);
  };

  const saveChallenge = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = title.trim();
    const numericPoints = Math.max(0, Math.floor(Number(points) || 0));
    if (!cleanTitle) return;

    setSaving(true);
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) {
      setSaving(false);
      return;
    }

    if (editing) {
      await supabase
        .from('trip_challenges')
        .update({ title: cleanTitle, points: numericPoints })
        .eq('id', editing.id);
    } else {
      await supabase
        .from('trip_challenges')
        .insert({ trip_id: tripId, title: cleanTitle, points: numericPoints, created_by: uid });
    }

    setSaving(false);
    setModalOpen(false);
    await load();
  };

  const deleteChallenge = async (challenge: Challenge) => {
    if (!confirm(`Eliminare definitivamente la sfida "${challenge.title}"?`)) return;
    await supabase.from('trip_challenges').delete().eq('id', challenge.id);
    await load();
  };

  const toggleCompletion = async (challengeId: string, participantId: string, checked: boolean) => {
    const key = `${challengeId}:${participantId}`;
    setSyncingKey(key);

    if (checked) {
      const { data: authData } = await supabase.auth.getUser();
      const uid = authData.user?.id;
      if (!uid) {
        setSyncingKey(null);
        return;
      }
      await supabase.from('trip_challenge_completions').insert({
        trip_id: tripId,
        challenge_id: challengeId,
        participant_id: participantId,
        completed_by: uid,
      });
    } else {
      await supabase
        .from('trip_challenge_completions')
        .delete()
        .eq('challenge_id', challengeId)
        .eq('participant_id', participantId)
        .eq('trip_id', tripId);
    }

    setSyncingKey(null);
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

      <div className="flex items-center justify-between mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <ListChecks size={18} className="text-emerald-700" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Sfide</h1>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Aggiungi</button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-sand-200" />)}
        </div>
      ) : challenges.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Nessuna sfida"
          description="Aggiungi una sfida con i punti da assegnare al completamento."
          action={{ label: 'Aggiungi sfida', onClick: openAdd }}
        />
      ) : (
        <div className="space-y-3">
          {challenges.map(challenge => {
            const completedBy = participants.filter(p => completionSet.has(`${challenge.id}:${p.id}`));
            const isExpanded = expandedChallengeId === challenge.id;

            return (
              <div key={challenge.id} className="card p-4">
                <button
                  type="button"
                  onClick={() => setExpandedChallengeId(prev => prev === challenge.id ? null : challenge.id)}
                  className="w-full flex items-center gap-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-gray-900">{challenge.title}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">{challenge.points} {challenge.points === 1 ? 'punto' : 'punti'}</p>
                  </div>
                  <ChevronDown size={16} className={`text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-sand-200">
                    {participants.length === 0 ? (
                      <p className="text-xs text-gray-500">
                        Nessun partecipante disponibile. Aggiungili prima nella pagina classifica.
                      </p>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2">
                        {participants.map(participant => {
                          const key = `${challenge.id}:${participant.id}`;
                          const checked = completionSet.has(key);
                          return (
                            <label key={participant.id} className="flex items-center gap-2 text-sm text-gray-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={syncingKey === key}
                                onChange={(e) => toggleCompletion(challenge.id, participant.id, e.target.checked)}
                              />
                              <span className={checked ? 'font-semibold text-emerald-700' : ''}>{participant.name}</span>
                            </label>
                          );
                        })}
                      </div>
                    )}

                    <p className="text-xs text-gray-500 mt-3">
                      {completedBy.length === 0
                        ? 'Completata da: nessuno'
                        : `Completata da: ${completedBy.map(p => p.name).join(', ')}`}
                    </p>

                    <div className="flex items-center justify-end gap-1 mt-3 pt-3 border-t border-sand-100">
                      <button
                        onClick={() => openEdit(challenge)}
                        className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                        title="Modifica sfida"
                        aria-label="Modifica sfida"
                      >
                        <Edit size={14} />
                      </button>
                      <button
                        onClick={() => deleteChallenge(challenge)}
                        className="p-2 rounded-lg text-red-600 hover:bg-red-50"
                        title="Elimina sfida"
                        aria-label="Elimina sfida"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Modifica sfida' : 'Aggiungi sfida'} onClose={() => setModalOpen(false)}>
          <form onSubmit={saveChallenge} className="space-y-4">
            <div className="form-group">
              <label className="label">Nome sfida *</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="input"
                placeholder="Es. Foto più creativa"
                required
              />
            </div>

            <div className="form-group">
              <label className="label">Punti *</label>
              <input
                type="number"
                min={0}
                step={1}
                value={points}
                onChange={(e) => setPoints(e.target.value)}
                className="input"
                required
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 justify-center">Annulla</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
