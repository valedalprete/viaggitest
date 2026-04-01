'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowLeft, Edit, Trash2, MapPin, Calendar, Clock,
  Plane, Hotel, Utensils, Map, BookOpen, Receipt, Bus, Car, CalendarDays, Users, Images,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Trip, TripRole, ROLE_LABELS, ROLE_COLORS } from '@/lib/types';
import { formatDateRange, getCountdownText, getTripDuration, getTripStatus } from '@/lib/utils';
import ModuleCard from '@/components/ModuleCard';

const MODULES = [
  { key: 'flights',         href: 'flights',         icon: Plane,         title: 'Voli',             description: 'Voli andata e ritorno',     color: 'bg-sky-100',     iconColor: 'text-sky-700' },
  { key: 'accommodation',   href: 'accommodation',   icon: Hotel,         title: 'Alloggio',          description: 'Hotel, Airbnb e altro',     color: 'bg-violet-100',  iconColor: 'text-violet-700' },
  { key: 'restaurants',     href: 'restaurants',     icon: Utensils,      title: 'Ristoranti',        description: 'Prenotati e preferiti',     color: 'bg-orange-100',  iconColor: 'text-orange-700' },
  { key: 'recommendations', href: 'recommendations', icon: Map,           title: 'Luoghi',            description: 'Da vedere e suggeriti',     color: 'bg-emerald-100', iconColor: 'text-emerald-700' },
  { key: 'expenses',        href: 'expenses',        icon: Receipt,       title: 'Spese',             description: 'Gestione spese e rimborsi', color: 'bg-green-100',   iconColor: 'text-green-700' },
  { key: 'itinerary',       href: 'itinerary',       icon: BookOpen,      title: 'Diario',            description: 'Giornale di viaggio',       color: 'bg-amber-100',   iconColor: 'text-amber-700' },
  { key: 'transport',       href: 'transport',       icon: Bus,           title: 'Trasporti',         description: 'Treni, bus e traghetti',    color: 'bg-blue-100',    iconColor: 'text-blue-700' },
  { key: 'car_rentals',     href: 'car-rental',      icon: Car,           title: 'Auto a noleggio',   description: 'Noleggio veicoli',          color: 'bg-rose-100',    iconColor: 'text-rose-700' },
  { key: 'photos',          href: 'photos',          icon: Images,        title: 'Foto',              description: 'Galleria condivisa',         color: 'bg-fuchsia-100', iconColor: 'text-fuchsia-700' },
] as const;

interface Counts {
  flights: number;
  accommodation: number;
  restaurants: number;
  recommendations: number;
  expenses: number;
  itinerary: number;
  transport: number;
  car_rentals: number;
  photos: number;
}

export default function TripHubPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [myRole, setMyRole] = useState<TripRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const supabase = createClient();

    Promise.all([
      supabase.from('trips').select('*').eq('id', id).single(),
      supabase.from('flights').select('id', { count: 'exact', head: true }).eq('trip_id', id),
      supabase.from('accommodations').select('id', { count: 'exact', head: true }).eq('trip_id', id),
      supabase.from('restaurants').select('id', { count: 'exact', head: true }).eq('trip_id', id),
      supabase.from('places').select('id', { count: 'exact', head: true }).eq('trip_id', id),
      supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('trip_id', id),
      supabase.from('diary_entries').select('id', { count: 'exact', head: true }).eq('trip_id', id),
      supabase.from('transports').select('id', { count: 'exact', head: true }).eq('trip_id', id),
      supabase.from('car_rentals').select('id', { count: 'exact', head: true }).eq('trip_id', id),
      supabase.from('trip_photos').select('id', { count: 'exact', head: true }).eq('trip_id', id),
      supabase.auth.getUser(),
    ]).then(async ([tripRes, fl, ac, re, pl, ex, di, tr, cr, ph, userRes]) => {
      setTrip(tripRes.data);
      setCounts({
        flights:        fl.count ?? 0,
        accommodation:  ac.count ?? 0,
        restaurants:    re.count ?? 0,
        recommendations: pl.count ?? 0,
        expenses:       ex.count ?? 0,
        itinerary:      di.count ?? 0,
        transport:      tr.count ?? 0,
        car_rentals:    cr.count ?? 0,
        photos:         ph.count ?? 0,
      });
      const userId = userRes.data.user?.id;
      if (userId) {
        const { data: memberRow } = await supabase
          .from('trip_members')
          .select('role')
          .eq('trip_id', id)
          .eq('user_id', userId)
          .single();
        setMyRole((memberRow?.role as TripRole) ?? null);
      }
      setLoading(false);
    });
  }, [id]);

  const handleDelete = async () => {
    if (myRole !== 'owner') return;
    if (!confirm('Eliminare questo viaggio? Tutti i dati verranno persi.')) return;
    setDeleting(true);
    await createClient().from('trips').delete().eq('id', id);
    router.push('/dashboard');
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="card h-56 animate-pulse bg-sand-200 mb-6" />
        <div className="grid grid-cols-2 gap-4">
          {[...Array(10)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-sand-200" />)}
        </div>
      </div>
    );
  }

  if (!trip) return <div className="p-10 text-center text-gray-500">Viaggio non trovato.</div>;

  const status = getTripStatus(trip.start_date, trip.end_date);
  const countdown = getCountdownText(trip.start_date, trip.end_date);
  const duration = getTripDuration(trip.start_date, trip.end_date);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link
        href="/dashboard"
        aria-label="Torna alla dashboard"
        title="Torna alla dashboard"
        className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={18} strokeWidth={2.3} />
      </Link>

      <div className="card overflow-hidden mb-6">
        <div className="relative h-52">
          {trip.cover_image ? (
            <Image src={trip.cover_image} alt={trip.destination} fill className="object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-primary-700 to-primary-900" />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
            <div>
              <Link href={`/trip/${id}/timeline`} className="group inline-block">
                <h1 className="text-white text-2xl font-bold drop-shadow group-hover:underline decoration-white/60 underline-offset-2 transition-all">{trip.name}</h1>
              </Link>
              <div className="flex items-center gap-1.5 mt-1">
                <MapPin size={14} className="text-white/80" />
                <span className="text-white/90 text-sm">{trip.destination}</span>
              </div>
            </div>
            <div className="flex gap-2">
              {(myRole === 'owner' || myRole === 'editor') && (
                <Link
                  href={`/trip/${id}/edit`}
                  className="p-2 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white transition-colors"
                >
                  <Edit size={15} />
                </Link>
              )}
              {myRole === 'owner' && (
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="p-2 rounded-xl bg-white/20 hover:bg-red-500/60 backdrop-blur-sm text-white transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 flex flex-wrap gap-4 text-sm text-gray-600 border-b border-sand-200">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-gray-400" />
            {formatDateRange(trip.start_date, trip.end_date)}
          </div>
          <div className="flex items-center gap-1.5">
            <Clock size={14} className="text-gray-400" />
            {duration} {duration === 1 ? 'giorno' : 'giorni'}
          </div>
          {myRole && (
            <span className={`badge flex items-center gap-1 ${ROLE_COLORS[myRole]}`}>
              <Users size={10} />
              {ROLE_LABELS[myRole]}
            </span>
          )}
          {status !== 'past' && (
            <div className="flex items-center gap-1.5 text-primary-600 font-medium ml-auto">
              {countdown}
            </div>
          )}
        </div>

        {trip.notes && (
          <div className="px-5 py-3 text-sm text-gray-500 italic">{trip.notes}</div>
        )}
      </div>

      <h2 className="text-lg font-extrabold text-gray-800 mb-3">Sezioni del viaggio</h2>

      <div className="mb-3">
        <ModuleCard
          href={`/trip/${id}/timeline`}
          icon={CalendarDays}
          title="Timeline"
          description="Tutti gli eventi del viaggio in ordine cronologico"
          color="bg-primary-100"
          iconColor="text-primary-700"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {MODULES.map(mod => {
          const count = counts?.[mod.key as keyof Counts] ?? 0;
          return (
            <ModuleCard
              key={mod.key}
              href={`/trip/${id}/${mod.href}`}
              icon={mod.icon}
              title={mod.title}
              description={mod.description}
              count={count}
              countLabel={count === 1 ? 'elemento' : 'elementi'}
              color={mod.color}
              iconColor={mod.iconColor}
            />
          );
        })}
      </div>
    </div>
  );
}
