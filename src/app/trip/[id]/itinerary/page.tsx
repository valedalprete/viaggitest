'use client';

import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, MoreVertical, Pencil, Plus, Save, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Accommodation, CarRental, DiaryEntry, Flight, Restaurant, Transport, Trip } from '@/lib/types';
import { getDaysArray, formatDate } from '@/lib/utils';
import EmptyState from '@/components/EmptyState';
import DiaryAttachments from '@/components/DiaryAttachments';

const DIARY_BUCKET = 'trip-diary';
const MAX_PHOTO_SIZE = 10 * 1024 * 1024;

const MOODS: { value: 1 | 2 | 3 | 4 | 5; label: string }[] = [
  { value: 1, label: 'Faticosa' },
  { value: 2, label: 'Impegnativa' },
  { value: 3, label: 'Buona' },
  { value: 4, label: 'Molto bella' },
  { value: 5, label: 'Indimenticabile' },
];

interface DiaryStructuredContent {
  description: string;
}

const EMPTY_STRUCTURED: DiaryStructuredContent = {
  description: '',
};

interface DayCard {
  date: string;
  saving: boolean;
  draft: {
    author_name: string;
    visibility: 'public' | 'private';
    title: string;
    description: string;
    mood: 1 | 2 | 3 | 4 | 5 | null;
  };
}

function toLocalIso(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function toDateMidday(dateIso: string): Date {
  return new Date(`${dateIso}T12:00:00`);
}

function parseDiaryContent(content: string | null | undefined): DiaryStructuredContent {
  if (!content) return { ...EMPTY_STRUCTURED };

  try {
    const parsed = JSON.parse(content);
    if (parsed && parsed.version === 'diary-v2') {
      return {
        description: parsed.description ?? '',
      };
    }
  } catch {
    // fallback legacy plain text
  }

  return { ...EMPTY_STRUCTURED, description: content };
}

function serializeDiaryContent(draft: DayCard['draft']): string {
  return JSON.stringify({
    version: 'diary-v2',
    description: draft.description,
  });
}

function hasMeaningfulData(draft: DayCard['draft']): boolean {
  return Boolean(
    draft.title.trim() ||
    draft.description.trim() ||
    draft.mood
  );
}

function buildActivitiesByDay(
  flights: Flight[],
  accommodations: Accommodation[],
  restaurants: Restaurant[],
  transports: Transport[],
  carRentals: CarRental[]
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  const add = (date: string | null | undefined, value: string) => {
    if (!date) return;
    const key = date.length > 10 ? date.slice(0, 10) : date;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(value);
  };

  flights.forEach(f => {
    if (!f.departure_at) return;
    add(f.departure_at, `Volo ${f.from_airport} → ${f.to_airport}${f.airline ? ` · ${f.airline}` : ''}`);
  });

  accommodations.forEach(a => {
    if (a.checkin_date) add(a.checkin_date, `Check-in alloggio · ${a.name}`);
    if (a.checkout_date) add(a.checkout_date, `Check-out alloggio · ${a.name}`);
  });

  restaurants.forEach(r => {
    if (!r.booking_date) return;
    add(r.booking_date, `Ristorante${r.name ? ` · ${r.name}` : ''}${r.booking_time ? ` (${r.booking_time.slice(0, 5)})` : ''}`);
  });

  transports.forEach(t => {
    if (!t.date) return;
    const route = t.from_location && t.to_location ? `${t.from_location} → ${t.to_location}` : 'Trasferimento';
    add(t.date, `Trasporto · ${route}`);
  });

  carRentals.forEach(c => {
    if (c.pickup_date) add(c.pickup_date, `Ritiro auto${c.company ? ` · ${c.company}` : ''}`);
    if (c.dropoff_date) add(c.dropoff_date, `Restituzione auto${c.company ? ` · ${c.company}` : ''}`);
  });

  return map;
}

export default function ItineraryPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [days, setDays] = useState<DayCard[]>([]);
  const [selectedDate, setSelectedDate] = useState('');
  const [viewMonth, setViewMonth] = useState('');
  const [allEntries, setAllEntries] = useState<DiaryEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState('Utente');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedDetailEntryId, setSelectedDetailEntryId] = useState<string | null>(null);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [openEntryMenuId, setOpenEntryMenuId] = useState<string | null>(null);
  const [pendingDiaryFiles, setPendingDiaryFiles] = useState<File[]>([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const [flights, setFlights] = useState<Flight[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [transports, setTransports] = useState<Transport[]>([]);
  const [carRentals, setCarRentals] = useState<CarRental[]>([]);

  const [loading, setLoading] = useState(true);

  const supabase = createClient();

  const buildDays = (tripData: Trip, entries: DiaryEntry[]): DayCard[] => {
    if (!tripData.start_date || !tripData.end_date) return [];

    return getDaysArray(tripData.start_date, tripData.end_date).map(date => {
      return {
        date,
        saving: false,
        draft: {
          author_name: currentUserName,
          visibility: 'public',
          title: '',
          description: '',
          mood: null,
        },
      };
    });
  };

  useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const { data: authData } = await supabase.auth.getUser();
        const user = authData.user;
        const uid = user?.id ?? null;
        const uname =
          (user?.user_metadata?.full_name as string | undefined)
          || (user?.user_metadata?.name as string | undefined)
          || user?.email?.split('@')[0]
          || 'Utente';

        setCurrentUserId(uid);
        setCurrentUserName(uname);

        const [
          { data: tripData },
          { data: entries },
          { data: flightsData },
          { data: accommodationsData },
          { data: restaurantsData },
          { data: transportsData },
          { data: carRentalsData },
        ] = await Promise.all([
          supabase.from('trips').select('*').eq('id', tripId).maybeSingle(),
          supabase.from('diary_entries').select('*').eq('trip_id', tripId).order('created_at', { ascending: true }),
          supabase.from('flights').select('*').eq('trip_id', tripId),
          supabase.from('accommodations').select('*').eq('trip_id', tripId),
          supabase.from('restaurants').select('*').eq('trip_id', tripId),
          supabase.from('transports').select('*').eq('trip_id', tripId),
          supabase.from('car_rentals').select('*').eq('trip_id', tripId),
        ]);

        if (!tripData) {
          setTrip(null);
          setDays([]);
          setAllEntries([]);
          return;
        }

        setTrip(tripData);
        const all = (entries ?? []) as DiaryEntry[];
        setAllEntries(all);
        const builtDays = buildDays(tripData, all);
        setDays(builtDays);

        setFlights(flightsData ?? []);
        setAccommodations(accommodationsData ?? []);
        setRestaurants(restaurantsData ?? []);
        setTransports(transportsData ?? []);
        setCarRentals(carRentalsData ?? []);

        setSelectedDate('');
        const today = toLocalIso(new Date());
        const monthBase = builtDays.some(d => d.date === today) ? today : (builtDays[0]?.date ?? '');
        if (monthBase) setViewMonth(`${monthBase.slice(0, 7)}-01`);
      } catch (error) {
        console.error('Itinerary load error:', error);
        setTrip(null);
        setDays([]);
        setAllEntries([]);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [tripId]);

  const updateDraft = (date: string, patch: Partial<DayCard['draft']>) => {
    setDays(prev => prev.map(d => d.date === date ? { ...d, draft: { ...d.draft, ...patch } } : d));
  };

  const save = async (day: DayCard) => {
    setDays(prev => prev.map(d => d.date === day.date ? { ...d, saving: true } : d));
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setDays(prev => prev.map(d => d.date === day.date ? { ...d, saving: false } : d));
      return;
    }

    const payload = {
      trip_id: tripId,
      user_id: user.id,
      day_date: day.date,
      author_name: day.draft.author_name.trim() || currentUserName,
      visibility: day.draft.visibility,
      title: day.draft.title.trim() || null,
      content: serializeDiaryContent(day.draft),
      mood: day.draft.mood,
      weather: null,
    };

    let targetEntryId: string | null = editingEntryId;

    if (editingEntryId) {
      await supabase
        .from('diary_entries')
        .update(payload)
        .eq('id', editingEntryId)
        .eq('user_id', user.id);
    } else {
      const { data: inserted } = await supabase
        .from('diary_entries')
        .insert(payload)
        .select('id')
        .single();
      targetEntryId = inserted?.id ?? null;
    }

    if (targetEntryId && pendingDiaryFiles.length > 0) {
      await uploadDiaryFiles(targetEntryId, pendingDiaryFiles);
      setPendingDiaryFiles([]);
    }

    const { data: refreshed } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    const all = (refreshed ?? []) as DiaryEntry[];
    setAllEntries(all);
    if (trip) setDays(buildDays(trip, all));

    setDays(prev => prev.map(d => d.date === day.date
      ? { ...d, saving: false }
      : d
    ));
    
    setIsFormOpen(false);
    setEditingEntryId(null);
    setOpenEntryMenuId(null);
  };

  const sanitizeFileName = (name: string) => name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9._-]/g, '')
    .slice(-80);

  const uploadDiaryFiles = async (entryId: string, files: File[]) => {
    const { data: authData } = await supabase.auth.getUser();
    const uid = authData.user?.id;
    if (!uid) return;

    for (const file of files) {
      if (!file.type.startsWith('image/') || file.size > MAX_PHOTO_SIZE) continue;

      const cleanName = sanitizeFileName(file.name || 'diary.jpg') || 'diary.jpg';
      const random = Math.random().toString(36).slice(2, 8);
      const path = `${tripId}/${entryId}/${uid}/${Date.now()}-${random}-${cleanName}`;

      const { error: uploadError } = await supabase.storage
        .from(DIARY_BUCKET)
        .upload(path, file, {
          contentType: file.type || 'application/octet-stream',
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadError) continue;

      const { error: insertError } = await supabase.from('diary_attachments').insert({
        trip_id: tripId,
        diary_entry_id: entryId,
        uploaded_by: uid,
        storage_path: path,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });

      if (insertError) {
        await supabase.storage.from(DIARY_BUCKET).remove([path]);
      }
    }
  };

  const onPickDiaryFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    const valid = files.filter(f => f.type.startsWith('image/') && f.size <= MAX_PHOTO_SIZE);
    if (valid.length === 0) return;

    if (editingEntryId) {
      setPhotoUploading(true);
      await uploadDiaryFiles(editingEntryId, valid);
      setPhotoUploading(false);
    } else {
      setPendingDiaryFiles(prev => [...prev, ...valid]);
    }

    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const editEntry = (entry: DiaryEntry) => {
    const structured = parseDiaryContent(entry.content);
    setEditingEntryId(entry.id);
    setSelectedDate(entry.day_date);
    updateDraft(entry.day_date, {
      author_name: entry.author_name ?? currentUserName,
      visibility: entry.visibility === 'private' ? 'private' : 'public',
      title: entry.title ?? '',
      description: structured.description,
      mood: (entry.mood as 1 | 2 | 3 | 4 | 5 | null) ?? null,
    });
    setSelectedDetailEntryId(null);
    setOpenEntryMenuId(null);
    setIsFormOpen(true);
  };

  const deleteEntry = async (entry: DiaryEntry) => {
    const ok = confirm('Eliminare questa pagina diario?');
    if (!ok) return;

    await supabase
      .from('diary_entries')
      .delete()
      .eq('id', entry.id)
      .eq('user_id', currentUserId ?? '');

    const { data: refreshed } = await supabase
      .from('diary_entries')
      .select('*')
      .eq('trip_id', tripId)
      .order('created_at', { ascending: true });

    const all = (refreshed ?? []) as DiaryEntry[];
    setAllEntries(all);
    if (trip) setDays(buildDays(trip, all));
    if (selectedDetailEntryId === entry.id) setSelectedDetailEntryId(null);
    setOpenEntryMenuId(null);
  };

  const daysMap = useMemo(() => new Map(days.map(d => [d.date, d])), [days]);

  const entriesCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    allEntries.forEach(e => map.set(e.day_date, (map.get(e.day_date) ?? 0) + 1));
    return map;
  }, [allEntries]);

  const activitiesByDay = useMemo(
    () => buildActivitiesByDay(flights, accommodations, restaurants, transports, carRentals),
    [flights, accommodations, restaurants, transports, carRentals]
  );

  const selectedDay = selectedDate ? (daysMap.get(selectedDate) ?? null) : null;
  const selectedActivities = selectedDate ? (activitiesByDay.get(selectedDate) ?? []) : [];
  const selectedDateEntries = useMemo(
    () => allEntries.filter(e => e.day_date === selectedDate && (e.visibility === 'public' || e.user_id === currentUserId)),
    [allEntries, selectedDate, currentUserId]
  );

  const selectedDetailEntry = useMemo(
    () => selectedDateEntries.find(e => e.id === selectedDetailEntryId) ?? null,
    [selectedDateEntries, selectedDetailEntryId]
  );

  useEffect(() => {
    if (selectedDateEntries.length === 0) {
      setSelectedDetailEntryId(null);
      return;
    }
    if (selectedDetailEntryId && !selectedDateEntries.some(e => e.id === selectedDetailEntryId)) {
      setSelectedDetailEntryId(null);
    }
  }, [selectedDateEntries, selectedDetailEntryId]);

  const monthDate = useMemo(() => {
    const base = viewMonth || (selectedDate ? `${selectedDate.slice(0, 7)}-01` : '');
    if (!base) return null;
    return toDateMidday(base);
  }, [viewMonth, selectedDate]);

  const calendarCells = useMemo(() => {
    if (!monthDate) return [] as Array<{ dateIso: string; inMonth: boolean }>;

    const first = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1, 12);
    const firstWeekDay = (first.getDay() + 6) % 7; // Monday first
    const start = new Date(first);
    start.setDate(first.getDate() - firstWeekDay);

    const cells: Array<{ dateIso: string; inMonth: boolean }> = [];
    for (let i = 0; i < 42; i++) {
      const cell = new Date(start);
      cell.setDate(start.getDate() + i);
      cells.push({
        dateIso: toLocalIso(cell),
        inMonth: cell.getMonth() === first.getMonth(),
      });
    }

    return cells;
  }, [monthDate]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="card h-14 animate-pulse bg-sand-200" />)}</div>
      </div>
    );
  }

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

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
          <BookOpen size={18} className="text-violet-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Diario di viaggio</h1>
          <p className="text-sm text-gray-500">
            {days.length > 0 ? `${days.length} ${days.length === 1 ? 'giorno' : 'giorni'}` : 'Nessuna data'}
            {' · '}
            {allEntries.filter(e => hasMeaningfulData({
              author_name: e.author_name ?? '',
              visibility: e.visibility === 'private' ? 'private' : 'public',
              title: e.title ?? '',
              description: parseDiaryContent(e.content).description,
              mood: e.mood as 1 | 2 | 3 | 4 | 5 | null,
            })).length} pagine compilate
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
        <div className="space-y-4">
          {/* Calendar section */}
          <div className="card p-4 sm:p-5">
              <div className="flex items-center justify-between gap-2 mb-4">
                <h2 className="text-base font-bold text-slate-900">Calendario giornaliero</h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (!monthDate) return;
                      const prev = new Date(monthDate.getFullYear(), monthDate.getMonth() - 1, 1, 12);
                      setViewMonth(`${toLocalIso(prev).slice(0, 7)}-01`);
                    }}
                    className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                  >
                    <ChevronLeft size={15} className="mx-auto" />
                  </button>
                  <p className="text-xs sm:text-sm font-semibold text-slate-700 min-w-[120px] sm:min-w-[140px] text-center capitalize">
                    {monthDate?.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      if (!monthDate) return;
                      const next = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1, 12);
                      setViewMonth(`${toLocalIso(next).slice(0, 7)}-01`);
                    }}
                    className="w-9 h-9 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-100"
                  >
                    <ChevronRight size={15} className="mx-auto" />
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <div className="min-w-[300px]">
                  <div className="grid grid-cols-7 gap-1 mb-1 text-[10px] sm:text-[11px] uppercase tracking-wide text-slate-400 font-semibold">
                    {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
                      <div key={day} className="text-center py-1">{day}</div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map(cell => {
                      const day = daysMap.get(cell.dateIso);
                      const inTrip = Boolean(day);
                      const isSelected = selectedDate === cell.dateIso;
                      const hasEntry = (entriesCountByDate.get(cell.dateIso) ?? 0) > 0;
                      const hasActivities = (activitiesByDay.get(cell.dateIso)?.length ?? 0) > 0;

                      return (
                        <button
                          key={cell.dateIso}
                          type="button"
                          disabled={!inTrip}
                          onClick={() => {
                            setSelectedDate(cell.dateIso);
                            setViewMonth(`${cell.dateIso.slice(0, 7)}-01`);
                            setIsFormOpen(false);
                            setSelectedDetailEntryId(null);
                          }}
                          className={`h-10 sm:h-11 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs transition-all ${
                            isSelected
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : inTrip
                                ? 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                                : 'border-transparent text-slate-300'
                          } ${!cell.inMonth ? 'opacity-45' : ''}`}
                        >
                          <div className="flex flex-col items-center justify-center leading-none gap-1">
                            <span>{toDateMidday(cell.dateIso).getDate()}</span>
                            {(hasEntry || hasActivities) && inTrip && (
                              <span className="flex items-center gap-1">
                                {hasActivities && <span className="w-1.5 h-1.5 rounded-full bg-primary-400" />}
                                {hasEntry && <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />}
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-4 text-[11px] text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary-400" />Attività</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-violet-500" />Pagina diario</span>
              </div>
          </div>

          {/* Structured diary page */}
          {selectedDay && (
            <div className="space-y-4">
              {/* Dettagli del giorno selezionato */}
              {!isFormOpen && !selectedDetailEntry && (
                <div className="card p-4 sm:p-5">
                  <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-1">Giorno selezionato</p>
                  <h3 className="text-base font-bold text-slate-900 capitalize">
                    {toDateMidday(selectedDay.date).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' })}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1">{formatDate(selectedDay.date)}</p>

                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold mb-2">Cosa è stato registrato</p>
                    {selectedActivities.length === 0 ? (
                      <p className="text-sm text-slate-500">Nessuna attività pianificata in questo giorno.</p>
                    ) : (
                      <ul className="space-y-1.5">
                        {selectedActivities.map((a, idx) => (
                          <li key={idx} className="text-sm text-slate-700">• {a}</li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-slate-200 flex items-center justify-between">
                    <p className="text-sm text-slate-700">
                      Pagine diario: <span className="font-semibold text-slate-900">{selectedDateEntries.length > 0 ? `${selectedDateEntries.length}` : 'Nessuna'}</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setIsFormOpen(true);
                        setEditingEntryId(null);
                        updateDraft(selectedDay.date, {
                          author_name: currentUserName,
                          visibility: 'public',
                          title: '',
                          description: '',
                          mood: null,
                        });
                      }}
                      className="btn-secondary"
                    >
                      <Plus size={14} /> Nuova pagina
                    </button>
                  </div>
                </div>
              )}

              {/* Form di compilazione */}
              {isFormOpen && (
                <div className="card p-4 sm:p-6 form-interactive">
                  <div className="mb-5 flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900">{editingEntryId ? 'Modifica pagina diario' : 'Nuova pagina diario'}</h2>
                      <p className="text-sm text-slate-500 mt-1">{formatDate(selectedDay.date)}</p>
                    </div>
                    <div className="w-[170px] sm:w-[190px]">
                      <select
                        value={selectedDay.draft.visibility}
                        onChange={e => updateDraft(selectedDay.date, { visibility: e.target.value as 'public' | 'private' })}
                        className="input text-xs sm:text-sm py-2"
                        aria-label="Visibilità pagina diario"
                      >
                        <option value="public">Pubblica</option>
                        <option value="private">Privata</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="form-group">
                      <label className="label">Nome autore</label>
                      <input
                        value={selectedDay.draft.author_name}
                        onChange={e => updateDraft(selectedDay.date, { author_name: e.target.value })}
                        className="input"
                        placeholder="Il tuo nome"
                      />
                    </div>

                    <div className="form-group">
                      <label className="label">Titolo della giornata</label>
                      <input
                        value={selectedDay.draft.title}
                        onChange={e => updateDraft(selectedDay.date, { title: e.target.value })}
                        className="input"
                        placeholder="Es. Una giornata indimenticabile"
                      />
                    </div>

                    <div className="form-group">
                      <label className="label">Valutazione della giornata</label>
                      <div className="grid grid-cols-5 gap-2">
                        {MOODS.map(m => (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => updateDraft(selectedDay.date, { mood: selectedDay.draft.mood === m.value ? null : m.value })}
                            title={m.label}
                            aria-label={`Valutazione ${m.value}: ${m.label}`}
                            className={`rounded-lg border px-2 py-2 text-center transition-all ${
                              selectedDay.draft.mood === m.value
                                ? 'border-primary-500 bg-primary-50 text-primary-700'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                            }`}
                          >
                            <div className="text-sm font-bold">{m.value}</div>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="form-group">
                      <div className="flex items-center justify-between gap-2">
                        <label className="label mb-0">Descrizione della giornata</label>
                        <button
                          type="button"
                          onClick={() => photoInputRef.current?.click()}
                          className="w-7 h-7 rounded-full border border-slate-300 text-slate-600 hover:bg-slate-100"
                          title="Aggiungi foto"
                        >
                          +
                        </button>
                        <input
                          ref={photoInputRef}
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={onPickDiaryFiles}
                        />
                      </div>
                      <textarea
                        value={selectedDay.draft.description}
                        onChange={e => updateDraft(selectedDay.date, { description: e.target.value })}
                        className="input min-h-[180px] resize-y"
                        placeholder="Come è stata la giornata? Cosa hai fatto, visto, provato? Quali sono i momenti più belli da ricordare?"
                      />
                    </div>

                    {editingEntryId ? (
                      <div>
                        <DiaryAttachments
                          tripId={tripId}
                          diaryEntryId={editingEntryId}
                        />
                      </div>
                    ) : pendingDiaryFiles.length > 0 ? (
                      <p className="text-xs text-slate-500 px-1">
                        {pendingDiaryFiles.length} foto pronte: verranno caricate al salvataggio.
                      </p>
                    ) : (
                      <p className="text-xs text-slate-500 px-1">
                        Aggiungi foto con il +: nelle nuove pagine verranno caricate al salvataggio.
                      </p>
                    )}

                    {photoUploading && (
                      <p className="text-xs text-slate-500 px-1">
                        Caricamento foto in corso...
                      </p>
                    )}

                    <div className="flex gap-3 justify-stretch sm:justify-end">
                      <button
                        type="button"
                        onClick={() => setIsFormOpen(false)}
                        className="btn-secondary flex-1 sm:flex-none"
                      >
                        Annulla
                      </button>
                      <button
                        onClick={() => save(selectedDay)}
                        disabled={selectedDay.saving}
                        className="btn-primary flex-1 sm:flex-none justify-center"
                      >
                        {selectedDay.saving ? (
                          <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Salvataggio...</span>
                        ) : (
                          <span className="flex items-center gap-2"><Save size={14} /> Salva</span>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Elenco pagine diario del giorno */}
              {!isFormOpen && !selectedDetailEntry && selectedDateEntries.length > 0 && (
                <div className="card p-4 sm:p-5">
                  <h3 className="text-base font-bold text-slate-900 mb-4">Pagine diario del giorno</h3>
                  <p className="text-xs text-slate-500 mb-3">Tocca una pagina per aprire il dettaglio e aggiungere foto.</p>
                  <div className="space-y-2">
                    {selectedDateEntries.map(entry => {
                      const canManage = entry.user_id === currentUserId;
                      return (
                        <div
                          key={entry.id}
                          className="w-full p-3 rounded-lg border border-slate-200 hover:border-primary-300 hover:bg-primary-50 transition-all text-left"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setOpenEntryMenuId(null);
                                setSelectedDetailEntryId(entry.id);
                              }}
                              className="flex-1 min-w-0 text-left"
                            >
                              <p className="font-semibold text-slate-900 truncate">{entry.title || '(senza titolo)'}</p>
                              <p className="text-sm text-slate-600 mt-0.5">{entry.author_name || 'Utente'}</p>
                            </button>

                            <div className="flex items-start gap-2">
                              <span className={`flex-shrink-0 text-xs px-2 py-1 rounded-full font-semibold ${
                                entry.visibility === 'public'
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-gray-100 text-gray-700'
                              }`}>
                                {entry.visibility === 'private' ? 'Privata' : 'Pubblica'}
                              </span>

                              {canManage && (
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={() => setOpenEntryMenuId(prev => prev === entry.id ? null : entry.id)}
                                    className="w-8 h-8 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 flex items-center justify-center"
                                    aria-label="Azioni pagina diario"
                                  >
                                    <MoreVertical size={14} className="text-slate-600" />
                                  </button>

                                  {openEntryMenuId === entry.id && (
                                    <div className="absolute right-0 top-9 z-20 w-36 rounded-xl border border-slate-200 bg-white shadow-elevated p-1">
                                      <button
                                        type="button"
                                        onClick={() => editEntry(entry)}
                                        className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                                      >
                                        <Pencil size={13} /> Modifica
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => deleteEntry(entry)}
                                        className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                      >
                                        <Trash2 size={13} /> Elimina
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Dettaglio pagina diario */}
              {selectedDetailEntry && (
                <div className="card p-4 sm:p-6">
                  <button
                    type="button"
                    onClick={() => setSelectedDetailEntryId(null)}
                    className="mb-4 flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-primary-800 bg-sand-200 hover:bg-sand-300 rounded-lg transition-colors"
                  >
                    <ChevronLeft size={14} /> Torna all'elenco
                  </button>

                  <div className="space-y-4">
                    <div>
                      <div className="flex items-start justify-between">
                        <div>
                          <h2 className="text-xl font-bold text-slate-900">{selectedDetailEntry.title || '(senza titolo)'}</h2>
                          <p className="text-sm text-slate-600 mt-1">{selectedDetailEntry.author_name || 'Utente'}</p>
                        </div>
                        <span className={`text-xs px-3 py-1 rounded-full font-semibold ${
                          selectedDetailEntry.visibility === 'public'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-700'
                        }`}>
                          {selectedDetailEntry.visibility === 'private' ? 'Privata' : 'Pubblica'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-2">
                        {selectedDetailEntry.mood && `Giornata: ${MOODS.find(m => m.value === selectedDetailEntry.mood)?.label}`}
                      </p>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <p className="text-sm text-slate-700 whitespace-pre-wrap">
                        {parseDiaryContent(selectedDetailEntry.content).description}
                      </p>
                    </div>

                    <DiaryAttachments
                      tripId={tripId}
                      diaryEntryId={selectedDetailEntry.id}
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
