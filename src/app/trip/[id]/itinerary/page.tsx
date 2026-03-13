'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ChevronDown, ChevronUp, Save } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { DiaryEntry, Trip } from '@/lib/types';
import { getDaysArray, formatDate } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';

const MOODS: { value: 1 | 2 | 3 | 4 | 5; emoji: string; label: string }[] = [
  { value: 1, emoji: '😢', label: 'Brutta' },
  { value: 2, emoji: '😕', label: 'Così così' },
  { value: 3, emoji: '🙂', label: 'Buona' },
  { value: 4, emoji: '😄', label: 'Ottima' },
  { value: 5, emoji: '🤩', label: 'Fantastica' },
];

const WEATHER_PRESETS = ['☀️ Sole', '⛅ Nuvoloso', '🌧️ Pioggia', '⛈️ Temporale', '🌨️ Neve', '🌫️ Nebbia', '🌬️ Vento', '🌡️ Caldo', '🥶 Freddo'];

interface DayCard {
  date: string;
  entry: DiaryEntry | null;
  open: boolean;
  saving: boolean;
  draft: {
    content: string;
    mood: 1 | 2 | 3 | 4 | 5 | null;
    weather: string;
  };
}

export default function ItineraryPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<DayCard[]>([]);
  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const buildDays = (tripData: Trip, entries: DiaryEntry[]): DayCard[] => {
    if (!tripData.start_date || !tripData.end_date) return [];
    return getDaysArray(tripData.start_date, tripData.end_date).map(date => {
      const entry = entries.find(e => e.day_date === date) ?? null;
      return {
        date,
        entry,
        open: false,
        saving: false,
        draft: {
          content: entry?.content ?? '',
          mood: (entry?.mood as 1 | 2 | 3 | 4 | 5 | null) ?? null,
          weather: entry?.weather ?? '',
        },
      };
    });
  };

  useEffect(() => {
    Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('diary_entries').select('*').eq('trip_id', tripId),
    ]).then(([{ data: tripData }, { data: entries }]) => {
      if (!tripData) return;
      setTrip(tripData);
      setDays(buildDays(tripData, entries ?? []));
      setLoading(false);
    });
  }, [tripId]);

  const toggle = (date: string) => {
    setDays(prev => prev.map(d => d.date === date ? { ...d, open: !d.open } : d));
  };

  const updateDraft = (date: string, patch: Partial<DayCard['draft']>) => {
    setDays(prev => prev.map(d => d.date === date ? { ...d, draft: { ...d.draft, ...patch } } : d));
  };

  const save = async (day: DayCard) => {
    setDays(prev => prev.map(d => d.date === day.date ? { ...d, saving: true } : d));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const payload = {
      trip_id: tripId, user_id: user.id, day_date: day.date,
      content: day.draft.content, mood: day.draft.mood, weather: day.draft.weather,
    };
    const { data } = await supabase.from('diary_entries').upsert(payload, { onConflict: 'trip_id,day_date' }).select().single();
    setDays(prev => prev.map(d => d.date === day.date
      ? { ...d, entry: data ?? d.entry, saving: false }
      : d
    ));
  };

  const hasContent = (day: DayCard) => day.entry?.content || day.entry?.mood || day.entry?.weather;

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card h-14 animate-pulse bg-sand-200" />)}</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href={`/trip/${tripId}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-primary-800 bg-sand-200 hover:bg-sand-300 rounded-lg mb-6 transition-colors">
        <ArrowLeft size={15} /> Torna al viaggio
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <BookOpen size={18} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Diario di viaggio</h1>
          <p className="text-sm text-gray-500">
            {days.length > 0 ? `${days.length} ${days.length === 1 ? 'giorno' : 'giorni'}` : 'Nessuna data'}
            {' · '}
            {days.filter(d => d.entry?.content).length} {days.filter(d => d.entry?.content).length === 1 ? 'entry' : 'entries'}
          </p>
        </div>
      </div>

      {days.length === 0 ? (
        <EmptyState
          icon={BookOpen}
          title="Date non impostate"
          description="Imposta le date del viaggio per usare il diario"
          action={{ label: 'Modifica viaggio', onClick: () => router.push(`/trip/${tripId}/edit`) }}
        />
      ) : (
        <div className="space-y-3">
          {days.map(day => (
            <div key={day.date} className={`card overflow-hidden transition-shadow ${day.open ? 'shadow-elevated' : ''}`}>
              {/* Day header */}
              <button
                onClick={() => toggle(day.date)}
                className="w-full flex items-center gap-4 px-5 py-4 text-left hover:bg-gray-50/80 transition-colors"
              >
                <div className="w-12 text-center">
                  <div className="text-lg font-bold text-primary-600 leading-none">
                    {new Date(day.date + 'T12:00:00').getDate()}
                  </div>
                  <div className="text-xs text-gray-400 uppercase tracking-wide">
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('it-IT', { month: 'short' })}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 capitalize">
                    {new Date(day.date + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </p>
                  {hasContent(day) && (
                    <div className="flex items-center gap-2 mt-0.5">
                      {day.entry?.mood && <span>{MOODS.find(m => m.value === day.entry!.mood)?.emoji}</span>}
                      {day.entry?.weather && <span className="text-xs text-gray-500">{day.entry.weather}</span>}
                      {day.entry?.content && <span className="text-xs text-gray-400 truncate">{day.entry.content.slice(0, 50)}{day.entry.content.length > 50 ? '…' : ''}</span>}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-gray-400">
                  {day.open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </button>

              {/* Day editor */}
              {day.open && (
                <div className="border-t border-gray-100 px-5 py-5 space-y-4 bg-gray-50/40">
                  {/* Mood */}
                  <div>
                    <label className="label mb-2">Come è andata?</label>
                    <div className="flex gap-2 flex-wrap">
                      {MOODS.map(m => (
                        <button
                          key={m.value}
                          type="button"
                          onClick={() => updateDraft(day.date, { mood: day.draft.mood === m.value ? null : m.value })}
                          className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-xl border-2 transition-all ${
                            day.draft.mood === m.value
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          <span className="text-xl">{m.emoji}</span>
                          <span className="text-xs">{m.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Weather */}
                  <div>
                    <label className="label mb-2">Meteo</label>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {WEATHER_PRESETS.map(w => (
                        <button
                          key={w}
                          type="button"
                          onClick={() => updateDraft(day.date, { weather: day.draft.weather === w ? '' : w })}
                          className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                            day.draft.weather === w
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300'
                          }`}
                        >
                          {w}
                        </button>
                      ))}
                    </div>
                    <input
                      value={day.draft.weather}
                      onChange={e => updateDraft(day.date, { weather: e.target.value })}
                      className="input text-sm"
                      placeholder="o scrivi tu il meteo..."
                    />
                  </div>

                  {/* Content */}
                  <div>
                    <label className="label mb-2">Come è andata?</label>
                    <textarea
                      value={day.draft.content}
                      onChange={e => updateDraft(day.date, { content: e.target.value })}
                      className="input resize-none text-sm"
                      rows={5}
                      placeholder="Scrivi qui cosa hai fatto oggi, cosa ti ha colpito, momenti speciali..."
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      onClick={() => save(day)}
                      disabled={day.saving}
                      className="btn-primary"
                    >
                      {day.saving ? (
                        <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvataggio...</span>
                      ) : (
                        <span className="flex items-center gap-2"><Save size={14} /> Salva giornata</span>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
