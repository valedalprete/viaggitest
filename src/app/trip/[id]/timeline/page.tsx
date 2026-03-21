'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CalendarDays } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Trip, Flight, Accommodation, Restaurant, Transport, Place, WeatherForecast } from '@/lib/types';
import { formatDateShort } from '@/lib/utils';
import { getWeatherForecast } from '@/lib/weather';
import DayWeather from '@/components/DayWeather';

interface TimelineEvent {
  id: string;
  date: string;
  sortKey: string;
  timeLabel: string;
  title: string;
  subtitle?: string | null;
  meta?: string | null;
}

interface DayGroup {
  date: string;
  events: TimelineEvent[];
}

function toDate(value: string | null | undefined): string | null {
  if (!value) return null;
  return value.length > 10 ? value.slice(0, 10) : value;
}

function toTime(value: string | null | undefined, fallback = '09:00'): string {
  if (!value) return fallback;
  if (value.length <= 10) return fallback;
  return value.slice(11, 16);
}

export default function TimelinePage() {
  const { id: tripId } = useParams<{ id: string }>();
  const supabase = createClient();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [flights, setFlights] = useState<Flight[]>([]);
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [transports, setTransports] = useState<Transport[]>([]);
  const [places, setPlaces] = useState<Place[]>([]);
  const [weather, setWeather] = useState<Map<string, WeatherForecast>>(new Map());
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [
      { data: tripData },
      { data: fl },
      { data: ac },
      { data: re },
      { data: tr },
      { data: pl },
    ] = await Promise.all([
      supabase.from('trips').select('*').eq('id', tripId).maybeSingle(),
      supabase.from('flights').select('*').eq('trip_id', tripId),
      supabase.from('accommodations').select('*').eq('trip_id', tripId),
      supabase.from('restaurants').select('*').eq('trip_id', tripId),
      supabase.from('transports').select('*').eq('trip_id', tripId),
      supabase.from('places').select('*').eq('trip_id', tripId),
    ]);

    setTrip(tripData ?? null);
    setFlights(fl ?? []);
    setAccommodations(ac ?? []);
    setRestaurants(re ?? []);
    setTransports(tr ?? []);
    setPlaces(pl ?? []);

    // Fetch weather for the trip destination if coordinates are available
    if (tripData?.lat && tripData?.lon) {
      try {
        const forecasts = await getWeatherForecast(
          tripData.lat,
          tripData.lon,
          tripData.start_date,
          tripData.end_date
        );
        const weatherMap = new Map<string, WeatherForecast>();
        forecasts.forEach((forecast) => {
          weatherMap.set(forecast.date, forecast);
        });
        setWeather(weatherMap);
      } catch (error) {
        console.error('Error fetching weather:', error);
      }
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [tripId]);

  const dayGroups = useMemo<DayGroup[]>(() => {
    const events: TimelineEvent[] = [];

    flights.forEach((f) => {
      const date = toDate(f.departure_at);
      if (!date) return;
      const time = toTime(f.departure_at, '08:00');
      events.push({
        id: `flight-${f.id}`,
        date,
        sortKey: `${date}T${time}`,
        timeLabel: time,
        title: `Volo ${f.from_airport} → ${f.to_airport}`,
        subtitle: f.airline ?? null,
        meta: f.type === 'outbound' ? 'Andata' : f.type === 'return' ? 'Ritorno' : 'Volo',
      });
    });

    accommodations.forEach((a) => {
      if (a.checkin_date) {
        const checkinTime = a.checkin_time?.slice(0, 5) || '14:00';
        events.push({
          id: `accom-in-${a.id}`,
          date: a.checkin_date,
          sortKey: `${a.checkin_date}T${checkinTime}`,
          timeLabel: checkinTime,
          title: `Check-in · ${a.name}`,
          subtitle: a.address,
          meta: 'Alloggio',
        });
      }
      if (a.checkout_date) {
        const checkoutTime = a.checkout_time?.slice(0, 5) || '11:00';
        events.push({
          id: `accom-out-${a.id}`,
          date: a.checkout_date,
          sortKey: `${a.checkout_date}T${checkoutTime}`,
          timeLabel: checkoutTime,
          title: `Check-out · ${a.name}`,
          subtitle: a.address,
          meta: 'Alloggio',
        });
      }
    });

    transports.forEach((t) => {
      if (!t.date) return;
      const time = t.departure_time?.slice(0, 5) || '09:00';
      events.push({
        id: `transport-${t.id}`,
        date: t.date,
        sortKey: `${t.date}T${time}`,
        timeLabel: time,
        title: t.from_location && t.to_location
          ? `Trasporto · ${t.from_location} → ${t.to_location}`
          : 'Trasporto',
        subtitle: t.operator ?? null,
        meta: t.type,
      });
    });

    restaurants.forEach((r) => {
      if (r.status !== 'booked' || !r.booking_date || !r.booking_time) return;
      const time = r.booking_time.slice(0, 5);
      events.push({
        id: `restaurant-${r.id}`,
        date: r.booking_date,
        sortKey: `${r.booking_date}T${time}`,
        timeLabel: time,
        title: `Ristorante · ${r.name ?? 'Prenotazione'}`,
        subtitle: r.address,
        meta: 'Prenotazione',
      });
    });

    places.forEach((p) => {
      if (p.status !== 'booked' || !p.booking_date || !p.booking_time) return;
      const date = p.booking_date;
      const time = p.booking_time.slice(0, 5);
      events.push({
        id: `place-${p.id}`,
        date,
        sortKey: `${date}T${time}`,
        timeLabel: time,
        title: `Luogo · ${p.name ?? 'Luogo'}`,
        subtitle: p.address,
        meta: p.category ?? 'Musei / Luoghi',
      });
    });

    const byDate = new Map<string, TimelineEvent[]>();
    events.forEach((ev) => {
      if (!byDate.has(ev.date)) byDate.set(ev.date, []);
      byDate.get(ev.date)!.push(ev);
    });

    byDate.forEach((evs) => evs.sort((a, b) => a.sortKey.localeCompare(b.sortKey)));

    return Array.from(byDate.entries())
      .map(([date, evs]) => ({ date, events: evs }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [flights, accommodations, transports, restaurants, places]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-sand-200" />)}</div>
      </div>
    );
  }

  if (!trip) return <div className="p-10 text-center text-gray-500">Viaggio non trovato.</div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href={`/trip/${tripId}`}
        aria-label="Torna al viaggio"
        title="Torna al viaggio"
        className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={18} strokeWidth={2.3} />
      </Link>

      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
          <CalendarDays size={18} className="text-slate-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Timeline</h1>
          <p className="text-sm text-slate-500">{trip.destination}</p>
        </div>
      </div>

      {dayGroups.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          Nessun evento disponibile.
        </div>
      ) : (
        <div className="space-y-5">
          {dayGroups.map((group) => {
            const dayWeather = weather.get(group.date);
            return (
              <section key={group.date} className="card p-4 sm:p-5">
                <div className="flex items-center justify-between gap-3 mb-3">
                  <h2 className="text-sm font-bold text-slate-900">
                    {formatDateShort(group.date)}
                  </h2>
                  {dayWeather && <DayWeather forecast={dayWeather} compact />}
                </div>

                <div className="space-y-3">
                  {group.events.map((ev, index) => {
                    const last = index === group.events.length - 1;
                    return (
                      <div key={ev.id} className="grid grid-cols-[64px_20px_1fr] gap-3 items-start">
                        <div className="text-xs font-semibold text-slate-500 pt-0.5">{ev.timeLabel}</div>

                        <div className="relative flex justify-center">
                          {!last && <span className="absolute top-2 bottom-[-18px] w-px bg-slate-200" />}
                          <span className="relative z-10 mt-1 w-2.5 h-2.5 rounded-full bg-slate-400" />
                        </div>

                        <div className="min-w-0 pb-1">
                          <p className="text-sm font-semibold text-slate-900 leading-snug">{ev.title}</p>
                          {ev.subtitle && <p className="text-xs text-slate-600 mt-0.5 truncate">{ev.subtitle}</p>}
                          {ev.meta && <p className="text-[11px] text-slate-400 mt-0.5 uppercase tracking-wide">{ev.meta}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Full weather card below events */}
                {dayWeather && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <DayWeather forecast={dayWeather} />
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
