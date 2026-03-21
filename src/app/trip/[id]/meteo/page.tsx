'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Cloud, X, Search } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Trip, WeatherForecast } from '@/lib/types';
import { getWeatherForecast } from '@/lib/weather';
import DayWeather from '@/components/DayWeather';

interface MeteoLocation {
  id: string;
  destination_name: string;
  latitude: number;
  longitude: number;
}

interface SearchResult {
  name: string;
  lat: number;
  lon: number;
}

export default function MeteoPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const supabase = createClient();

  const [trip, setTrip] = useState<Trip | null>(null);
  const [meteoLocations, setMeteoLocations] = useState<MeteoLocation[]>([]);
  const [weatherData, setWeatherData] = useState<Map<string, WeatherForecast[]>>(new Map());
  const [loading, setLoading] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [addingLocation, setAddingLocation] = useState<string | null>(null);

  // Calculate date range: today to 7 days from now
  const getDateRange = () => {
    const today = new Date();
    const in7Days = new Date(today);
    in7Days.setDate(in7Days.getDate() + 7);
    
    const startDate = today.toISOString().split('T')[0];
    const endDate = in7Days.toISOString().split('T')[0];
    
    return { startDate, endDate };
  };

  // Load trip and meteo locations
  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data: tripData } = await supabase
        .from('trips')
        .select('*')
        .eq('id', tripId)
        .maybeSingle();

      setTrip(tripData ?? null);

      if (user) {
        const { data: locations } = await supabase
          .from('trip_meteo_locations')
          .select('*')
          .eq('trip_id', tripId)
          .order('created_at', { ascending: true });

        if (locations) {
          setMeteoLocations(locations);
          
          // Fetch weather for each location using today + 7 days range
          const { startDate, endDate } = getDateRange();
          const weatherMap = new Map<string, WeatherForecast[]>();
          
          for (const loc of locations) {
            try {
              console.log(`Fetching weather for ${loc.destination_name}:`, { startDate, endDate });
              const forecasts = await getWeatherForecast(
                loc.latitude,
                loc.longitude,
                startDate,
                endDate
              );
              console.log(`Weather loaded for ${loc.destination_name}:`, forecasts.length, 'days');
              weatherMap.set(loc.id, forecasts);
            } catch (error) {
              console.error(`Error fetching weather for ${loc.destination_name}:`, error);
            }
          }
          setWeatherData(weatherMap);
        }
      }

      setLoading(false);
    };

    load();
  }, [tripId]);

  // Search destinations using Nominatim
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=8`
      );
      const results: any[] = await response.json();
      
      const formatted: SearchResult[] = results
        .slice(0, 8)
        .map((r) => ({
          name: r.display_name,
          lat: parseFloat(r.lat),
          lon: parseFloat(r.lon),
        }));
      
      setSearchResults(formatted);
      setShowDropdown(true);
    } catch (error) {
      console.error('Search error:', error);
      setSearchResults([]);
    }
    setSearching(false);
  };

  // Add meteo location
  const addMeteoLocation = async (result: SearchResult) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    setAddingLocation(result.name);

    try {
      const { data } = await supabase
        .from('trip_meteo_locations')
        .insert({
          trip_id: tripId,
          user_id: user.id,
          destination_name: result.name,
          latitude: result.lat,
          longitude: result.lon,
        })
        .select()
        .maybeSingle();

      if (data) {
        setMeteoLocations([...meteoLocations, data]);
        
        // Fetch weather for this location using today + 7 days range
        try {
          const { startDate, endDate } = getDateRange();
          
          console.log('Fetching weather for:', {
            name: result.name,
            lat: data.latitude,
            lon: data.longitude,
            startDate,
            endDate,
          });
          
          const forecasts = await getWeatherForecast(
            data.latitude,
            data.longitude,
            startDate,
            endDate
          );
          
          console.log('Weather fetched:', { name: result.name, count: forecasts.length });
          setWeatherData(new Map(weatherData).set(data.id, forecasts));
        } catch (error) {
          console.error('Error fetching weather for', result.name, ':', error);
        }
      }

      setSearchQuery('');
      setSearchResults([]);
      setShowDropdown(false);
    } catch (error) {
      console.error('Error adding location:', error);
    } finally {
      setAddingLocation(null);
    }
  };

  // Remove meteo location
  const removeMeteoLocation = async (locationId: string) => {
    try {
      await supabase
        .from('trip_meteo_locations')
        .delete()
        .eq('id', locationId);

      setMeteoLocations(meteoLocations.filter((l) => l.id !== locationId));
      const newWeatherData = new Map(weatherData);
      newWeatherData.delete(locationId);
      setWeatherData(newWeatherData);
    } catch (error) {
      console.error('Error removing location:', error);
    }
  };

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
          <p className="text-sm text-slate-500">Aggiungi le destinazioni per visualizzare il meteo</p>
        </div>
      </div>

      {/* Search bar */}
      <div className="card p-4 sm:p-5 mb-6">
        <div className="relative">
          <div className="relative">
            <Search size={18} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Cerca una destinazione..."
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none transition-all bg-white"
            />
          </div>

          {/* Dropdown results */}
          {showDropdown && searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-lg shadow-lg z-10">
              {searchResults.map((result, idx) => (
                <button
                  key={idx}
                  onClick={() => addMeteoLocation(result)}
                  disabled={addingLocation === result.name}
                  className="w-full text-left px-4 py-3 hover:bg-slate-50 border-b border-slate-100 last:border-b-0 transition-colors text-sm disabled:opacity-50"
                >
                  <p className="font-medium text-slate-900">
                    {result.name.split(',')[0]}
                    {addingLocation === result.name && ' (caricamento...)'}
                  </p>
                  <p className="text-xs text-slate-500">{result.name.split(',').slice(1).join(',')}</p>
                </button>
              ))}
            </div>
          )}

          {searching && <p className="text-xs text-slate-400 mt-2">Cercando...</p>}
        </div>
      </div>

      {/* Meteo locations */}
      {meteoLocations.length === 0 ? (
        <div className="card p-10 text-center text-slate-500">
          Nessuna destinazione aggiunta. Usa la ricerca per iniziare.
        </div>
      ) : (
        <div className="space-y-8">
          {meteoLocations.map((location) => {
            const forecasts = weatherData.get(location.id) || [];
            return (
              <div key={location.id}>
                {/* Location header with delete button */}
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-slate-900">
                    {location.destination_name.split(',')[0]}
                  </h2>
                  <button
                    onClick={() => removeMeteoLocation(location.id)}
                    className="p-2 rounded-lg hover:bg-red-50 text-red-600 transition-colors"
                    title="Rimuovi destinazione"
                  >
                    <X size={18} />
                  </button>
                </div>

                {/* Weather cards for this location */}
                {forecasts.length === 0 ? (
                  <div className="card p-6 text-center text-slate-500">
                    Meteo non disponibile
                  </div>
                ) : (
                  <div className="space-y-4">
                    {forecasts.map((forecast) => (
                      <div key={forecast.date}>
                        <DayWeather forecast={forecast} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
