'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Plane } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Trip, TripRole } from '@/lib/types';
import TripCard from '@/components/TripCard';
import EmptyState from '@/components/EmptyState';

interface TripWithRole extends Trip {
  myRole: TripRole;
}

export default function DashboardPage() {
  const [trips, setTrips] = useState<TripWithRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setTrips([]);
        setLoading(false);
        return;
      }

      try {
        // Fetch memberships (includes own + shared trips via new RLS)
        const { data: memberships } = await supabase
          .from('trip_members')
          .select('role, trip_id')
          .eq('user_id', user.id);

        if (!memberships || memberships.length === 0) {
          setTrips([]);
          return;
        }

        const roleMap: Record<string, TripRole> = {};
        memberships.forEach(m => { roleMap[m.trip_id] = m.role as TripRole; });

        const tripIds = memberships.map(m => m.trip_id);

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

  return (
    <div>
      {/* Hero Banner */}
      <div className="bg-gradient-to-br from-primary-900 via-primary-800 to-teal-700 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
          <div className="flex items-end justify-between gap-6">
            <div>
              <p className="text-amber-400 text-xs font-bold uppercase tracking-[0.15em] mb-3">
                Il tuo pianificatore di viaggi
              </p>
              <h1 className="text-4xl sm:text-5xl font-extrabold leading-tight">
                Dove ti porta<br />
                il prossimo viaggio?
              </h1>
              <p className="text-white/60 text-sm mt-4">
                {trips.length === 0
                  ? 'Inizia a pianificare la tua prossima avventura'
                  : `${trips.length} ${trips.length === 1 ? 'viaggio' : 'viaggi'} • ${sharedTrips.length} condivisi`}
              </p>
            </div>
            <Link
              href="/trip/new"
              className="hidden sm:flex items-center gap-2 px-5 py-3 bg-amber-400 hover:bg-amber-300 text-primary-900 font-bold text-sm rounded-xl transition-colors shadow-lg flex-shrink-0"
            >
              <Plus size={16} /> Nuovo viaggio
            </Link>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* Mobile CTA */}
        <div className="flex sm:hidden justify-end mb-6">
          <Link href="/trip/new" className="btn-primary">
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
              <div className="mb-10">
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
              <div>
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-4">Condivisi con me</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                  {sharedTrips.map(trip => (
                    <TripCard key={trip.id} trip={trip} myRole={trip.myRole} />
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
