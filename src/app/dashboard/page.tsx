'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Plane } from 'lucide-react';
import { Rubik } from 'next/font/google';
import { createClient } from '@/lib/supabase/client';
import { Trip, TripRole } from '@/lib/types';
import TripCard from '@/components/TripCard';
import EmptyState from '@/components/EmptyState';

const rubik = Rubik({
  subsets: ['latin'],
  weight: ['600', '700'],
  display: 'swap',
});

interface TripWithRole extends Trip {
  myRole: TripRole;
}

export default function DashboardPage() {
  const [trips, setTrips] = useState<TripWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  const hideTripFromDashboard = async (tripId: string) => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('hidden_trips')
      .upsert({ user_id: user.id, trip_id: tripId }, { onConflict: 'user_id,trip_id' });

    setTrips(prev => prev.filter(t => t.id !== tripId));
  };

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setTrips([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch memberships + user hidden trips
        const [{ data: memberships }, { data: hidden }] = await Promise.all([
          supabase
            .from('trip_members')
            .select('role, trip_id')
            .eq('user_id', user.id),
          supabase
            .from('hidden_trips')
            .select('trip_id')
            .eq('user_id', user.id),
        ]);

        if (!memberships || memberships.length === 0) {
          setTrips([]);
          return;
        }

        const hiddenIds = new Set((hidden ?? []).map(h => h.trip_id));

        const roleMap: Record<string, TripRole> = {};
        memberships.forEach(m => { roleMap[m.trip_id] = m.role as TripRole; });

        const tripIds = memberships
          .map(m => m.trip_id)
          .filter(tripId => !hiddenIds.has(tripId));

        if (tripIds.length === 0) {
          setTrips([]);
          return;
        }

        const { data: tripsData } = await supabase
          .from('trips')
          .select('*')
          .in('id', tripIds)
          .order('start_date', { ascending: false });

        setTrips(
          (tripsData ?? []).map(t => ({ ...t, myRole: roleMap[t.id] ?? 'viewer' }))
        );
      } finally {
        setLoading(false);
      }
    }).catch(() => {
      setTrips([]);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div>
        <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-teal-700 h-44 animate-pulse" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="card h-72 animate-pulse bg-sand-200" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const ownTrips = trips.filter(t => t.myRole === 'owner');
  const sharedTrips = trips.filter(t => t.myRole !== 'owner');
  const totalTrips = trips.length;

  return (
    <div className="relative overflow-hidden">
      {/* Hero Banner */}
      <div className="relative isolate text-white overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1701603240628-2df86bb7606c?q=80&w=1600&auto=format&fit=crop')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0b3b7a]/55 via-[#1354a2]/40 to-[#0b2e5f]/70" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_15%,rgba(255,255,255,0.35),transparent_35%)]" />
        <div className="absolute -top-20 -right-8 h-64 w-64 rounded-full bg-white/20 blur-3xl" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-14 md:py-20">
          <div className="grid lg:grid-cols-[1fr_auto] gap-8 items-end">
            <div>
              <p className="text-cyan-100 text-xs font-bold uppercase tracking-[0.2em] mb-3">
                Your travel planner
              </p>
              <h1 className={`${rubik.className} text-white text-5xl sm:text-7xl font-bold leading-[0.98] drop-shadow-md`}>
                Discover Your<br />
                Next Stop
              </h1>
              <p className="text-white/90 text-sm sm:text-base mt-4 max-w-xl">
                {totalTrips === 0
                  ? 'Inizia a pianificare la tua prossima avventura'
                  : `${totalTrips} ${totalTrips === 1 ? 'viaggio' : 'viaggi'} • ${sharedTrips.length} condivisi`}
              </p>
            </div>

            <Link
              href="/trip/new"
              className="hidden sm:inline-flex items-center gap-2 text-white/95 hover:text-white font-bold text-base sm:text-lg transition-colors drop-shadow-md flex-shrink-0"
            >
              <Plus size={16} /> Nuovo viaggio
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 md:py-12">
        {/* Mobile CTA */}
        <div className="flex sm:hidden justify-end mb-6">
          <Link href="/trip/new" className="inline-flex items-center gap-1.5 text-primary-700 hover:text-primary-800 font-semibold text-sm">
            <Plus size={16} /> Nuovo viaggio
          </Link>
        </div>

        {trips.length === 0 ? (
          <EmptyState
            icon={Plane}
            title="Nessun viaggio ancora"
            description="Pianifica il tuo primo viaggio e tieni traccia di tutto in un posto solo."
            action={{ label: 'Crea il primo viaggio', onClick: () => window.location.href = '/trip/new' }}
          />
        ) : (
          <>
            {/* Own trips */}
            {ownTrips.length > 0 && (
              <div className="mb-10 rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm p-4 sm:p-5">
                {sharedTrips.length > 0 && (
                  <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">I miei viaggi</h2>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {ownTrips.map(trip => (
                    <TripCard key={trip.id} trip={trip} myRole={trip.myRole} />
                  ))}
                </div>
              </div>
            )}

            {/* Shared trips */}
            {sharedTrips.length > 0 && (
              <div className="rounded-2xl border border-slate-200/80 bg-white/70 backdrop-blur-sm p-4 sm:p-5">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Condivisi con me</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {sharedTrips.map(trip => (
                    <TripCard
                      key={trip.id}
                      trip={trip}
                      myRole={trip.myRole}
                      onHideFromDashboard={() => hideTripFromDashboard(trip.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
