'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Trip } from '@/lib/types';
import TripForm from '@/components/TripForm';
import CollaboratorsPanel from '@/components/CollaboratorsPanel';

export default function EditTripPage() {
  const { id } = useParams<{ id: string }>();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    createClient()
      .from('trips')
      .select('*')
      .eq('id', id)
      .single()
      .then(({ data }) => {
        setTrip(data);
        setLoading(false);
      });
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-10">
        <div className="card h-96 animate-pulse bg-sand-200" />
      </div>
    );
  }

  if (!trip) return <div className="p-10 text-center text-gray-500">Viaggio non trovato.</div>;

  return (
    <>
      <TripForm trip={trip} />
      <div className="max-w-2xl mx-auto px-4 sm:px-6 pb-10 -mt-4">
        <CollaboratorsPanel />
      </div>
    </>
  );
}
