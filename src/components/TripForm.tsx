'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MapPin, Calendar, Image as ImageIcon, ArrowLeft, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { geocodeDestination } from '@/lib/nominatim';
import { NominatimResult, Trip } from '@/lib/types';

interface TripFormProps {
  trip?: Trip; // if provided → edit mode
}

export default function TripForm({ trip }: TripFormProps) {
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState(trip?.name ?? '');
  const [destination, setDestination] = useState(trip?.destination ?? '');
  const [lat, setLat] = useState<number | null>(trip?.lat ?? null);
  const [lon, setLon] = useState<number | null>(trip?.lon ?? null);
  const [startDate, setStartDate] = useState(trip?.start_date ?? '');
  const [endDate, setEndDate] = useState(trip?.end_date ?? '');
  const [coverImage, setCoverImage] = useState(trip?.cover_image ?? '');
  const [notes, setNotes] = useState(trip?.notes ?? '');

  const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Autocomplete destination
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!destination.trim() || destination === trip?.destination) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setGeocoding(true);
      const results = await geocodeDestination(destination);
      setSuggestions(results.slice(0, 5));
      setShowSuggestions(results.length > 0);
      setGeocoding(false);
    }, 500);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [destination]);

  const selectSuggestion = (result: NominatimResult) => {
    setDestination(result.display_name.split(',').slice(0, 2).join(', ').trim());
    setLat(parseFloat(result.lat));
    setLon(parseFloat(result.lon));
    setSuggestions([]);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!name.trim() || !destination.trim() || !startDate || !endDate) {
      setError('Compila tutti i campi obbligatori.');
      return;
    }

    if (new Date(endDate) < new Date(startDate)) {
      setError('La data di fine deve essere dopo quella di inizio.');
      return;
    }

    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      router.push('/login');
      return;
    }

    let error_: string | null = null;
    let tripId = trip?.id;

    if (trip) {
      // UPDATE: never override user_id (creator's ownership stays)
      const { error: err } = await supabase.from('trips').update({
        name: name.trim(),
        destination: destination.trim(),
        lat,
        lon,
        start_date: startDate,
        end_date: endDate,
        cover_image: coverImage.trim() || null,
        notes: notes.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', trip.id);
      error_ = err?.message ?? null;
    } else {
      // INSERT via server route to avoid client-side RLS race/issues
      const response = await fetch('/api/trips/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          destination,
          lat,
          lon,
          start_date: startDate,
          end_date: endDate,
          cover_image: coverImage,
          notes,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        error_ = result?.error ?? 'Errore creazione viaggio';
      } else {
        tripId = result?.id;
      }
    }

    if (error_) {
      console.error('Errore salvataggio viaggio:', error_);
      setError(`Errore durante il salvataggio: ${error_}`);
      setLoading(false);
    } else {
      router.push(`/trip/${tripId}`);
      router.refresh();
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      {/* Back */}
      <button
        onClick={() => router.back()}
        aria-label="Torna indietro"
        title="Torna indietro"
        className="inline-flex items-center text-slate-600 hover:text-slate-900 mb-6 transition-colors"
      >
        <ArrowLeft size={18} strokeWidth={2.3} />
      </button>

      <div className="card p-8">
        <h1 className="text-xl font-bold text-gray-900 mb-6">
          {trip ? 'Modifica viaggio' : 'Nuovo viaggio'}
        </h1>

        <form onSubmit={handleSubmit} className="form-interactive space-y-5">
          {/* Name */}
          <div className="form-group form-section">
            <label className="label">Nome viaggio *</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input"
              placeholder="Es. Estate a Barcellona"
              required
            />
          </div>

          {/* Destination */}
          <div className="form-group form-section relative">
            <label className="label">Destinazione *</label>
            <div className="relative">
              <MapPin size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={destination}
                onChange={e => { setDestination(e.target.value); setLat(null); setLon(null); }}
                className="input pl-9"
                placeholder="Es. Barcellona, Spagna"
                required
                autoComplete="off"
              />
              {geocoding && (
                <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
              )}
            </div>
            {/* Autocomplete dropdown */}
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-elevated overflow-hidden">
                {suggestions.map((s, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => selectSuggestion(s)}
                    className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-800 border-b border-slate-100 last:border-0 transition-colors"
                  >
                    <span className="font-medium">{s.display_name.split(',')[0]}</span>
                    <span className="text-gray-400 ml-1 text-xs">
                      {s.display_name.split(',').slice(1, 3).join(',')}
                    </span>
                  </button>
                ))}
              </div>
            )}
            {lat && lon && (
              <p className="text-xs text-primary-700 font-semibold mt-1">✓ Posizione trovata ({lat.toFixed(4)}, {lon.toFixed(4)})</p>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 form-section">
            <div className="form-group">
              <label className="label">Data inizio *</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="input pl-9"
                  required
                />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Data fine *</label>
              <div className="relative">
                <Calendar size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="input pl-9"
                  required
                />
              </div>
            </div>
          </div>

          {/* Cover Image */}
          <div className="form-group form-section">
            <label className="label">URL immagine di copertina (opzionale)</label>
            <div className="relative">
              <ImageIcon size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="url"
                value={coverImage}
                onChange={e => setCoverImage(e.target.value)}
                className="input pl-9"
                placeholder="https://images.unsplash.com/..."
              />
            </div>
            {coverImage && (
              <p className="text-xs text-gray-400 mt-1">Suggerimento: usa immagini da unsplash.com</p>
            )}
          </div>

          {/* Notes */}
          <div className="form-group form-section">
            <label className="label">Note (opzionale)</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="input min-h-[80px] resize-none"
              placeholder="Appunti generali sul viaggio..."
              rows={3}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={() => router.back()}
              className="btn-secondary flex-1 justify-center"
            >
              Annulla
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 justify-center"
            >
              {loading ? 'Salvataggio...' : trip ? 'Salva modifiche' : 'Crea viaggio'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
