'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Cloud } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Trip, WeatherForecast } from '@/lib/types';
import { getWeatherForecast } from '@/lib/weather';
import DayWeather from '@/components/DayWeather';

export default function MeteoPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const supabase = createClient();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [weather, setWeather] = useState<WeatherForecast[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: tripData } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .maybeSingle();

      setTrip(tripData ?? null);

      // Fetch weather for the trip destination if coordinates are available
      if (tripData?.lat && tripData?.lon) {
        try {
          const forecasts = await getWeatherForecast(
            tripData.lat,
            tripData.lon,
            tripData.start_date,
            tripData.end_date
          );
          setWeather(forecasts);
        } catch (error) {
          console.error('Error fetching weather:', error);
        }
      }

      setLoading(false);
    };

    load();
  }, [tripId]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="space-y-3">{[...Array(5)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-sand-200" />)}</div>
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
          <Cloud size={18} className="text-slate-700" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Meteo</h1>
          <p className="text-sm text-slate-500">{trip.destination}</p>
        </div>
      </div>

      {weather.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          Meteo non disponibile per questa destinazione.
        </div>
      ) : (
        <div className="space-y-4">
          {weather.map((forecast) => (
            <div key={forecast.date}>
              <DayWeather forecast={forecast} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
