'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, CalendarDays, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Trip, Flight, Accommodation, Restaurant, Transport, CarRental, DiaryEntry } from '@/lib/types';
import { formatDateShort } from '@/lib/utils';
import Modal from '@/components/Modal';

// ─── Types ────────────────────────────────────────────────────────────────────

type QuickAddType = 'flight' | 'accommodation' | 'restaurant' | 'transport' | 'car-rental' | 'diary';

interface TimelineEvent {
  id: string;
  sortKey: string;
  type: string;
  icon: string;
  title: string;
  subtitle?: string | null;
  detail?: string | null;
  bgColor: string;
  borderColor: string;
}

interface DayGroup {
  date: string;
  events: TimelineEvent[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const MOOD_EMOJI: Record<number, string> = { 1: '😢', 2: '😕', 3: '🙂', 4: '😄', 5: '🤩' };

const TRANSPORT_LABELS: Record<string, string> = {
  train: 'Treno', bus: 'Bus', ferry: 'Traghetto', metro: 'Metro',
  taxi: 'Taxi', uber: 'Uber', other: 'Trasporto',
};

const FLIGHT_LABELS: Record<string, string> = {
  outbound: 'Volo andata', return: 'Volo ritorno', other: 'Volo',
};

function toDate(ts: string | null | undefined): string | null {
  if (!ts) return null;
  return ts.length > 10 ? ts.slice(0, 10) : ts;
}

function toTime(ts: string | null | undefined): string | null {
  if (!ts || ts.length <= 10) return null;
  return ts.slice(11, 16);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TimelinePage() {
  const { id: tripId } = useParams<{ id: string }>();
  const supabase = createClient();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [transports, setTransports] = useState<Transport[]>([]);
  const [carRentals, setCarRentals] = useState<CarRental[]>([]);
  const [diaryEntries, setDiaryEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);

  // Quick-add
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quickType, setQuickType] = useState<QuickAddType | null>(null);
  const [saving, setSaving] = useState(false);

  const [qFlight, setQFlight] = useState({ type: 'outbound' as Flight['type'], from: '', to: '', departure_at: '', airline: '' });
  const [qAccom, setQAccom] = useState({ name: '', type: 'hotel' as Accommodation['type'], checkin: '', checkout: '' });
  const [qRest, setQRest] = useState({ name: '', date: '', time: '' });
  const [qTransport, setQTransport] = useState({ type: 'train' as Transport['type'], from: '', to: '', date: '' });
  const [qCar, setQCar] = useState({ company: '', pickup_date: '', dropoff_date: '' });
  const [qDiary, setQDiary] = useState({ date: '', title: '', mood: '' });

  const load = async () => {
    const [
      { data: tripData },
      { data: fl },
      { data: ac },
      { data: re },
      { data: tr },
      { data: cr },
      { data: di },
    ] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).single(),
      supabase.from('flights').select('*').eq('trip_id', tripId),
      supabase.from('accommodations').select('*').eq('trip_id', tripId),
      supabase.from('restaurants').select('*').eq('trip_id', tripId),
      supabase.from('transports').select('*').eq('trip_id', tripId),
      supabase.from('car_rentals').select('*').eq('trip_id', tripId),
      supabase.from('diary_entries').select('*').eq('trip_id', tripId),
    ]);
    setTrip(tripData);
    setFlights(fl ?? []);
    setAccommodations(ac ?? []);
    setRestaurants(re ?? []);
    setTransports(tr ?? []);
    setCarRentals(cr ?? []);
    setDiaryEntries(di ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tripId]);

  // ─── Build timeline ────────────────────────────────────────────────────────

  const dayGroups = useMemo<DayGroup[]>(() => {
    if (!trip) return [];

    const map = new Map<string, TimelineEvent[]>();

    const add = (dateStr: string | null | undefined, ev: TimelineEvent) => {
      const d = toDate(dateStr);
      if (!d) return;
      if (!map.has(d)) map.set(d, []);
      map.get(d)!.push(ev);
    };

    // Trip anchors
    add(trip.start_date, {
      id: 'trip-start',
      sortKey: trip.start_date + 'T00:00',
      type: 'anchor',
      icon: '🎒',
      title: 'Partenza',
      subtitle: trip.destination,
      bgColor: 'bg-primary-50',
      borderColor: 'border-primary-200',
    });
    add(trip.end_date, {
      id: 'trip-end',
      sortKey: trip.end_date + 'T23:59',
      type: 'anchor',
      icon: '🏠',
      title: 'Rientro',
      subtitle: trip.destination,
      bgColor: 'bg-primary-50',
      borderColor: 'border-primary-200',
    });

    // Flights
    flights.forEach(f => {
      const d = toDate(f.departure_at);
      if (!d) return;
      add(d, {
        id: f.id,
        sortKey: (f.departure_at ?? d + 'T08:00'),
        type: 'flight',
        icon: '✈️',
        title: FLIGHT_LABELS[f.type] ?? 'Volo',
        subtitle: f.from_airport && f.to_airport ? `${f.from_airport} → ${f.to_airport}` : (f.airline ?? null),
        detail: f.departure_at ? toTime(f.departure_at) : null,
        bgColor: 'bg-sky-50',
        borderColor: 'border-sky-200',
      });
    });

    // Accommodations
    accommodations.forEach(a => {
      if (a.checkin_date) add(a.checkin_date, {
        id: a.id + '-in',
        sortKey: a.checkin_date + 'T14:00',
        type: 'accommodation',
        icon: '🏨',
        title: `Check-in: ${a.name}`,
        subtitle: a.address,
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-200',
      });
      if (a.checkout_date) add(a.checkout_date, {
        id: a.id + '-out',
        sortKey: a.checkout_date + 'T11:00',
        type: 'accommodation',
        icon: '🏨',
        title: `Check-out: ${a.name}`,
        subtitle: a.address,
        bgColor: 'bg-violet-50',
        borderColor: 'border-violet-200',
      });
    });

    // Restaurants (only booked with a date)
    restaurants.forEach(r => {
      if (!r.booking_date) return;
      add(r.booking_date, {
        id: r.id,
        sortKey: r.booking_date + (r.booking_time ? 'T' + r.booking_time : 'T20:00'),
        type: 'restaurant',
        icon: '🍽️',
        title: r.name ?? 'Ristorante',
        subtitle: r.address,
        detail: r.booking_time ? r.booking_time.slice(0, 5) : null,
        bgColor: 'bg-orange-50',
        borderColor: 'border-orange-200',
      });
    });

    // Transports
    transports.forEach(t => {
      if (!t.date) return;
      add(t.date, {
        id: t.id,
        sortKey: t.date + (t.departure_time ? 'T' + t.departure_time : 'T09:00'),
        type: 'transport',
        icon: '🚌',
        title: `${TRANSPORT_LABELS[t.type] ?? 'Trasporto'}${t.from_location && t.to_location ? `: ${t.from_location} → ${t.to_location}` : ''}`,
        subtitle: t.operator ?? null,
        detail: t.departure_time ? t.departure_time.slice(0, 5) : null,
        bgColor: 'bg-blue-50',
        borderColor: 'border-blue-200',
      });
    });

    // Car rentals
    carRentals.forEach(c => {
      if (c.pickup_date) add(c.pickup_date, {
        id: c.id + '-pick',
        sortKey: c.pickup_date + 'T10:00',
        type: 'car',
        icon: '🚗',
        title: `Ritiro auto${c.company ? ` · ${c.company}` : ''}`,
        subtitle: c.pickup_location,
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
      });
      if (c.dropoff_date) add(c.dropoff_date, {
        id: c.id + '-drop',
        sortKey: c.dropoff_date + 'T10:00',
        type: 'car',
        icon: '🚗',
        title: `Restituzione auto${c.company ? ` · ${c.company}` : ''}`,
        subtitle: c.dropoff_location,
        bgColor: 'bg-rose-50',
        borderColor: 'border-rose-200',
      });
    });

    // Diary
    diaryEntries.forEach(d => {
      if (!d.day_date) return;
      add(d.day_date, {
        id: d.id,
        sortKey: d.day_date + 'T23:00',
        type: 'diary',
        icon: d.mood ? MOOD_EMOJI[d.mood] : '📖',
        title: d.title ?? 'Diario',
        subtitle: d.content ? d.content.slice(0, 90) + (d.content.length > 90 ? '…' : '') : null,
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
      });
    });

    // Sort events within each day, then sort days
    map.forEach(evs => evs.sort((a, b) => a.sortKey.localeCompare(b.sortKey)));
    return Array.from(map.entries())
      .map(([date, events]) => ({ date, events }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [trip, flights, accommodations, restaurants, transports, carRentals, diaryEntries]);

  // ─── Quick-add ────────────────────────────────────────────────────────────

  const openQuickAdd = (type: QuickAddType) => {
    const def = trip?.start_date ?? new Date().toISOString().slice(0, 10);
    setQFlight({ type: 'outbound', from: '', to: '', departure_at: def + 'T00:00', airline: '' });
    setQAccom({ name: '', type: 'hotel', checkin: def, checkout: '' });
    setQRest({ name: '', date: def, time: '' });
    setQTransport({ type: 'train', from: '', to: '', date: def });
    setQCar({ company: '', pickup_date: def, dropoff_date: '' });
    setQDiary({ date: def, title: '', mood: '' });
    setPickerOpen(false);
    setQuickType(type);
  };

  const handleQuickAdd = async (type: QuickAddType) => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    try {
      if (type === 'flight') {
        await supabase.from('flights').insert({
          trip_id: tripId, user_id: user.id,
          type: qFlight.type,
          from_airport: qFlight.from || 'TBD',
          to_airport: qFlight.to || 'TBD',
          departure_at: qFlight.departure_at || null,
          airline: qFlight.airline || null,
        });
      } else if (type === 'accommodation') {
        await supabase.from('accommodations').insert({
          trip_id: tripId, user_id: user.id,
          name: qAccom.name || 'Alloggio',
          type: qAccom.type,
          checkin_date: qAccom.checkin || null,
          checkout_date: qAccom.checkout || null,
          price_type: 'per_night',
        });
      } else if (type === 'restaurant') {
        await supabase.from('restaurants').insert({
          trip_id: tripId, user_id: user.id,
          name: qRest.name || 'Ristorante',
          status: 'booked',
          booking_date: qRest.date || null,
          booking_time: qRest.time || null,
          source: 'manual',
        });
      } else if (type === 'transport') {
        await supabase.from('transports').insert({
          trip_id: tripId, user_id: user.id,
          type: qTransport.type,
          from_location: qTransport.from || null,
          to_location: qTransport.to || null,
          date: qTransport.date || null,
        });
      } else if (type === 'car-rental') {
        await supabase.from('car_rentals').insert({
          trip_id: tripId, user_id: user.id,
          company: qCar.company || null,
          pickup_date: qCar.pickup_date || null,
          dropoff_date: qCar.dropoff_date || null,
        });
      } else if (type === 'diary') {
        await supabase.from('diary_entries').upsert({
          trip_id: tripId, user_id: user.id,
          day_date: qDiary.date,
          title: qDiary.title || null,
          mood: qDiary.mood ? parseInt(qDiary.mood) : null,
        }, { onConflict: 'trip_id,day_date' });
      }
    } catch (err) {
      console.error(err);
    }

    setSaving(false);
    setQuickType(null);
    load();
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="card h-16 animate-pulse bg-sand-200 mb-8" />
        <div className="space-y-8">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex gap-4 items-start">
              <div className="w-12 h-12 rounded-full bg-sand-200 animate-pulse flex-shrink-0" />
              <div className="flex-1 h-20 card animate-pulse bg-sand-200" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!trip) return <div className="p-10 text-center text-gray-500">Viaggio non trovato.</div>;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 pb-28">
      {/* Back */}
      <Link
        href={`/trip/${tripId}`}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-primary-800 bg-sand-200 hover:bg-sand-300 rounded-lg mb-6 transition-colors"
      >
        <ArrowLeft size={15} /> {trip.name}
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3 mb-10">
        <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center">
          <CalendarDays size={18} className="text-primary-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Timeline</h1>
          <p className="text-sm text-gray-500">{trip.name} · {trip.destination}</p>
        </div>
      </div>

      {/* Timeline */}
      {dayGroups.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <CalendarDays size={44} className="mx-auto mb-3 opacity-25" />
          <p className="font-semibold text-gray-500">Nessun evento ancora</p>
          <p className="text-sm mt-1">Usa il + per aggiungere voli, alloggi e altro</p>
        </div>
      ) : (
        <div className="relative">

          {/* ── Desktop: alternating center-line layout ── */}
          <div className="hidden md:block">
            {/* Center vertical line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-sand-300 -translate-x-px" />

            <div className="space-y-6">
              {dayGroups.map((group, idx) => {
                const isLeft = idx % 2 === 0;
                const isPast = group.date < today;
                const isToday = group.date === today;
                const parts = formatDateShort(group.date).split(' ');

                return (
                  <div key={group.date} className="relative flex items-start">
                    {/* Left slot */}
                    <div className="w-[44%] pr-7 flex flex-col items-end gap-2">
                      {isLeft && group.events.map(ev => (
                        <EventCard key={ev.id} ev={ev} align="right" />
                      ))}
                    </div>

                    {/* Center date bubble */}
                    <div className="w-[12%] flex justify-center flex-shrink-0">
                      <div className={`
                        relative z-10 w-16 h-16 rounded-full border-4 border-white shadow-md
                        flex flex-col items-center justify-center select-none
                        ${isToday
                          ? 'bg-primary-600 text-white'
                          : isPast
                            ? 'bg-gray-300 text-gray-600'
                            : 'bg-white text-primary-700 ring-2 ring-primary-200'}
                      `}>
                        <span className="text-base font-extrabold leading-none">{parts[0]}</span>
                        <span className="text-[11px] font-semibold leading-none mt-0.5 uppercase tracking-wide">
                          {parts[1] ?? ''}
                        </span>
                      </div>
                    </div>

                    {/* Right slot */}
                    <div className="w-[44%] pl-7 flex flex-col gap-2">
                      {!isLeft && group.events.map(ev => (
                        <EventCard key={ev.id} ev={ev} align="left" />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Mobile: left-line layout ── */}
          <div className="md:hidden">
            {/* Left vertical line */}
            <div className="absolute left-[22px] top-0 bottom-0 w-0.5 bg-sand-300" />

            <div className="space-y-6">
              {dayGroups.map((group) => {
                const isPast = group.date < today;
                const isToday = group.date === today;
                const parts = formatDateShort(group.date).split(' ');

                return (
                  <div key={group.date} className="relative flex gap-4 items-start">
                    {/* Date bubble */}
                    <div className={`
                      relative z-10 w-11 h-11 rounded-full border-4 border-white shadow-md flex-shrink-0
                      flex flex-col items-center justify-center select-none
                      ${isToday
                        ? 'bg-primary-600 text-white'
                        : isPast
                          ? 'bg-gray-300 text-gray-600'
                          : 'bg-white text-primary-700 ring-2 ring-primary-200'}
                    `}>
                      <span className="text-[11px] font-extrabold leading-none">{parts[0]}</span>
                      <span className="text-[9px] font-semibold leading-none mt-0.5 uppercase">
                        {parts[1] ?? ''}
                      </span>
                    </div>

                    {/* Events */}
                    <div className="flex-1 flex flex-col gap-2 pt-1">
                      {group.events.map(ev => (
                        <EventCard key={ev.id} ev={ev} align="left" />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => setPickerOpen(true)}
        className="fixed bottom-8 right-6 w-14 h-14 rounded-full bg-primary-700 hover:bg-primary-800 active:scale-95 text-white shadow-xl flex items-center justify-center transition-all z-40"
        title="Aggiungi alla timeline"
      >
        <Plus size={26} />
      </button>

      {/* ── Type picker modal ── */}
      {pickerOpen && (
        <Modal title="Cosa vuoi aggiungere?" onClose={() => setPickerOpen(false)}>
          <div className="grid grid-cols-3 gap-3 pt-1">
            {[
              { type: 'flight'        as QuickAddType, icon: '✈️',  label: 'Volo' },
              { type: 'accommodation' as QuickAddType, icon: '🏨',  label: 'Alloggio' },
              { type: 'restaurant'    as QuickAddType, icon: '🍽️', label: 'Ristorante' },
              { type: 'transport'     as QuickAddType, icon: '🚌',  label: 'Trasporto' },
              { type: 'car-rental'    as QuickAddType, icon: '🚗',  label: 'Auto' },
              { type: 'diary'         as QuickAddType, icon: '📖',  label: 'Diario' },
            ].map(opt => (
              <button
                key={opt.type}
                onClick={() => openQuickAdd(opt.type)}
                className="flex flex-col items-center gap-2.5 p-4 rounded-xl border-2 border-sand-200 hover:border-primary-400 hover:bg-primary-50 transition-all active:scale-95"
              >
                <span className="text-3xl">{opt.icon}</span>
                <span className="text-xs font-semibold text-gray-700">{opt.label}</span>
              </button>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Quick-add: Flight ── */}
      {quickType === 'flight' && (
        <Modal title="✈️ Aggiungi volo" onClose={() => setQuickType(null)}>
          <form onSubmit={e => { e.preventDefault(); handleQuickAdd('flight'); }} className="space-y-4">
            <div className="form-group">
              <label className="label">Tipo</label>
              <select value={qFlight.type} onChange={e => setQFlight(p => ({ ...p, type: e.target.value as Flight['type'] }))} className="input">
                <option value="outbound">Andata</option>
                <option value="return">Ritorno</option>
                <option value="other">Altro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Da *</label>
                <input value={qFlight.from} onChange={e => setQFlight(p => ({ ...p, from: e.target.value }))} className="input" placeholder="MXP" required />
              </div>
              <div className="form-group">
                <label className="label">A *</label>
                <input value={qFlight.to} onChange={e => setQFlight(p => ({ ...p, to: e.target.value }))} className="input" placeholder="ALC" required />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Data e ora partenza</label>
              <input type="datetime-local" value={qFlight.departure_at} onChange={e => setQFlight(p => ({ ...p, departure_at: e.target.value }))} className="input" />
            </div>
            <div className="form-group">
              <label className="label">Compagnia</label>
              <input value={qFlight.airline} onChange={e => setQFlight(p => ({ ...p, airline: e.target.value }))} className="input" placeholder="Ryanair" />
            </div>
            <SaveButtons saving={saving} onCancel={() => setQuickType(null)} />
          </form>
        </Modal>
      )}

      {/* ── Quick-add: Accommodation ── */}
      {quickType === 'accommodation' && (
        <Modal title="🏨 Aggiungi alloggio" onClose={() => setQuickType(null)}>
          <form onSubmit={e => { e.preventDefault(); handleQuickAdd('accommodation'); }} className="space-y-4">
            <div className="form-group">
              <label className="label">Nome *</label>
              <input value={qAccom.name} onChange={e => setQAccom(p => ({ ...p, name: e.target.value }))} className="input" placeholder="Hotel Vista Mare" required />
            </div>
            <div className="form-group">
              <label className="label">Tipo</label>
              <select value={qAccom.type} onChange={e => setQAccom(p => ({ ...p, type: e.target.value as Accommodation['type'] }))} className="input">
                <option value="hotel">Hotel</option>
                <option value="airbnb">Airbnb</option>
                <option value="hostel">Ostello</option>
                <option value="apartment">Appartamento</option>
                <option value="villa">Villa</option>
                <option value="camping">Camping</option>
                <option value="other">Altro</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Check-in</label>
                <input type="date" value={qAccom.checkin} onChange={e => setQAccom(p => ({ ...p, checkin: e.target.value }))} className="input" />
              </div>
              <div className="form-group">
                <label className="label">Check-out</label>
                <input type="date" value={qAccom.checkout} onChange={e => setQAccom(p => ({ ...p, checkout: e.target.value }))} className="input" />
              </div>
            </div>
            <SaveButtons saving={saving} onCancel={() => setQuickType(null)} />
          </form>
        </Modal>
      )}

      {/* ── Quick-add: Restaurant ── */}
      {quickType === 'restaurant' && (
        <Modal title="🍽️ Aggiungi ristorante" onClose={() => setQuickType(null)}>
          <form onSubmit={e => { e.preventDefault(); handleQuickAdd('restaurant'); }} className="space-y-4">
            <div className="form-group">
              <label className="label">Nome *</label>
              <input value={qRest.name} onChange={e => setQRest(p => ({ ...p, name: e.target.value }))} className="input" placeholder="La Taberna" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Data</label>
                <input type="date" value={qRest.date} onChange={e => setQRest(p => ({ ...p, date: e.target.value }))} className="input" />
              </div>
              <div className="form-group">
                <label className="label">Orario</label>
                <input type="time" value={qRest.time} onChange={e => setQRest(p => ({ ...p, time: e.target.value }))} className="input" />
              </div>
            </div>
            <SaveButtons saving={saving} onCancel={() => setQuickType(null)} />
          </form>
        </Modal>
      )}

      {/* ── Quick-add: Transport ── */}
      {quickType === 'transport' && (
        <Modal title="🚌 Aggiungi trasporto" onClose={() => setQuickType(null)}>
          <form onSubmit={e => { e.preventDefault(); handleQuickAdd('transport'); }} className="space-y-4">
            <div className="form-group">
              <label className="label">Tipo</label>
              <select value={qTransport.type} onChange={e => setQTransport(p => ({ ...p, type: e.target.value as Transport['type'] }))} className="input">
                {Object.entries(TRANSPORT_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Da</label>
                <input value={qTransport.from} onChange={e => setQTransport(p => ({ ...p, from: e.target.value }))} className="input" placeholder="Aeroporto" />
              </div>
              <div className="form-group">
                <label className="label">A</label>
                <input value={qTransport.to} onChange={e => setQTransport(p => ({ ...p, to: e.target.value }))} className="input" placeholder="Centro" />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Data</label>
              <input type="date" value={qTransport.date} onChange={e => setQTransport(p => ({ ...p, date: e.target.value }))} className="input" />
            </div>
            <SaveButtons saving={saving} onCancel={() => setQuickType(null)} />
          </form>
        </Modal>
      )}

      {/* ── Quick-add: Car rental ── */}
      {quickType === 'car-rental' && (
        <Modal title="🚗 Aggiungi auto a noleggio" onClose={() => setQuickType(null)}>
          <form onSubmit={e => { e.preventDefault(); handleQuickAdd('car-rental'); }} className="space-y-4">
            <div className="form-group">
              <label className="label">Società</label>
              <input value={qCar.company} onChange={e => setQCar(p => ({ ...p, company: e.target.value }))} className="input" placeholder="Europcar" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Ritiro</label>
                <input type="date" value={qCar.pickup_date} onChange={e => setQCar(p => ({ ...p, pickup_date: e.target.value }))} className="input" />
              </div>
              <div className="form-group">
                <label className="label">Restituzione</label>
                <input type="date" value={qCar.dropoff_date} onChange={e => setQCar(p => ({ ...p, dropoff_date: e.target.value }))} className="input" />
              </div>
            </div>
            <SaveButtons saving={saving} onCancel={() => setQuickType(null)} />
          </form>
        </Modal>
      )}

      {/* ── Quick-add: Diary ── */}
      {quickType === 'diary' && (
        <Modal title="📖 Aggiungi nota diario" onClose={() => setQuickType(null)}>
          <form onSubmit={e => { e.preventDefault(); handleQuickAdd('diary'); }} className="space-y-4">
            <div className="form-group">
              <label className="label">Data *</label>
              <input type="date" value={qDiary.date} onChange={e => setQDiary(p => ({ ...p, date: e.target.value }))} className="input" required />
            </div>
            <div className="form-group">
              <label className="label">Titolo</label>
              <input value={qDiary.title} onChange={e => setQDiary(p => ({ ...p, title: e.target.value }))} className="input" placeholder="Giornata fantastica!" />
            </div>
            <div className="form-group">
              <label className="label">Umore</label>
              <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n} type="button"
                    onClick={() => setQDiary(p => ({ ...p, mood: p.mood === String(n) ? '' : String(n) }))}
                    className={`w-10 h-10 rounded-xl text-xl border-2 transition-all ${qDiary.mood === String(n) ? 'border-primary-500 bg-primary-50 scale-110' : 'border-sand-200 hover:border-sand-400'}`}
                  >
                    {MOOD_EMOJI[n]}
                  </button>
                ))}
              </div>
            </div>
            <SaveButtons saving={saving} onCancel={() => setQuickType(null)} />
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventCard({ ev, align }: { ev: TimelineEvent; align: 'left' | 'right' }) {
  return (
    <div className={`
      ${ev.bgColor} border ${ev.borderColor}
      rounded-xl px-4 py-3 shadow-sm w-full
      ${align === 'right' ? 'text-right' : ''}
    `}>
      <div className={`flex items-start gap-2.5 ${align === 'right' ? 'flex-row-reverse' : ''}`}>
        <span className="text-xl leading-none flex-shrink-0 mt-0.5">{ev.icon}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-gray-800 leading-snug">{ev.title}</p>
          {ev.subtitle && (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed truncate">{ev.subtitle}</p>
          )}
          {ev.detail && (
            <p className="text-xs font-semibold text-primary-600 mt-1">🕐 {ev.detail}</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SaveButtons({ saving, onCancel }: { saving: boolean; onCancel: () => void }) {
  return (
    <div className="flex gap-3 pt-1">
      <button type="button" onClick={onCancel} className="btn-secondary flex-1 justify-center">
        Annulla
      </button>
      <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
        {saving ? <Loader2 size={15} className="animate-spin" /> : 'Salva'}
      </button>
    </div>
  );
}
