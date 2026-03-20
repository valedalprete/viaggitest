'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Map, Edit, Trash2, Search, Loader2, MapPin, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { NominatimResult, Place } from '@/lib/types';
import { geocodeDestination } from '@/lib/nominatim';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import TicketAttachments from '@/components/TicketAttachments';

type PlaceStatus = 'booked' | 'wishlist' | 'suggested';

type SuggestResult = {
  xid: string;
  name: string;
  kinds: string;
  rate?: string;
  point: { lon: number; lat: number };
  category?: string;
  address?: string | null;
  maps_url?: string;
};

const RATE_MAP: Record<string, string> = { '1': '⭐', '2': '⭐⭐', '3': '⭐⭐⭐', '1h': '🏛️', '2h': '🏛️🏛️', '3h': '🏛️🏛️🏛️' };

const empty = (): Partial<Place> => ({
  name: '', category: '', address: '', status: 'wishlist', source: 'manual', description: '', notes: '',
  booking_date: '', booking_time: '',
  maps_url: '', tiktok_url: '',
});

const normalizePlaceStatus = (status: Place['status'] | null | undefined): PlaceStatus => {
  if (status === 'booked') return 'booked';
  if (status === 'suggested') return 'suggested';
  return 'wishlist';
};

const tryExtractName = (url: string): string => {
  try {
    const match = url.match(/\/maps\/place\/([^/@?]+)/);
    if (match) return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch {}
  return '';
};

export default function RecommendationsPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const [items, setItems] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Place | null>(null);
  const [form, setForm] = useState<Partial<Place>>(empty());
  const [saving, setSaving] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [cityQuery, setCityQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [citySuggestions, setCitySuggestions] = useState<NominatimResult[]>([]);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [cityLoading, setCityLoading] = useState(false);

  const [placeQuery, setPlaceQuery] = useState('');
  const [suggestions, setSuggestions] = useState<SuggestResult[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);

  const [quickSavingId, setQuickSavingId] = useState<string | null>(null);
  const suggestionsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cityDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = createClient();

  const load = () => {
    supabase.from('places').select('*').eq('trip_id', tripId).order('created_at').then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
  }, [tripId]);

  useEffect(() => {
    if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    if (!cityQuery.trim()) {
      setCitySuggestions([]);
      setShowCitySuggestions(false);
      setCityLoading(false);
      return;
    }

    cityDebounceRef.current = setTimeout(async () => {
      setCityLoading(true);
      const results = await geocodeDestination(cityQuery.trim());
      setCitySuggestions(results.slice(0, 6));
      setShowCitySuggestions(results.length > 0);
      setCityLoading(false);
    }, 350);

    return () => {
      if (cityDebounceRef.current) clearTimeout(cityDebounceRef.current);
    };
  }, [cityQuery]);

  useEffect(() => {
    if (suggestionsDebounceRef.current) clearTimeout(suggestionsDebounceRef.current);
    const effectiveCity = (selectedCity ?? cityQuery).trim();

    if (!effectiveCity) {
      setSuggestions([]);
      setSuggestionsError(null);
      return;
    }

    if (!cityQuery.trim()) {
      setSuggestions([]);
      setSuggestionsError(null);
      return;
    }

    suggestionsDebounceRef.current = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        setSuggestionsError(null);
        const url = new URL('/api/places/suggest', window.location.origin);
        url.searchParams.set('city', effectiveCity);
        if (placeQuery.trim()) url.searchParams.set('q', placeQuery.trim());

        const res = await fetch(url.toString());
        if (!res.ok) {
          setSuggestions([]);
          setSuggestionsError('Ricerca non disponibile. Riprova tra poco.');
          return;
        }

        const data = (await res.json()) as { results?: SuggestResult[] };
        setSuggestions((data.results ?? []).filter((r) => r.name?.trim()));
      } catch {
        setSuggestions([]);
        setSuggestionsError('Errore durante la ricerca dei luoghi.');
      } finally {
        setSuggestionsLoading(false);
      }
    }, 600);

    return () => {
      if (suggestionsDebounceRef.current) clearTimeout(suggestionsDebounceRef.current);
    };
  }, [cityQuery, placeQuery, selectedCity]);

  const selectCitySuggestion = (city: NominatimResult) => {
    const shortLabel = city.display_name.split(',').slice(0, 2).join(', ').trim();
    setCityQuery(shortLabel);
    setSelectedCity(city.display_name);
    setCitySuggestions([]);
    setShowCitySuggestions(false);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(empty());
    setModalOpen(true);
  };

  const openEdit = (item: Place) => {
    setEditing(item);
    setForm({ ...item, status: normalizePlaceStatus(item.status) });
    setModalOpen(true);
  };

  const saveSuggestion = async (row: SuggestResult) => {
    if (!row.name) return;

    const duplicate = items.some((i) =>
      (i.external_id && i.external_id === row.xid)
      || (!!i.name && i.name.trim().toLowerCase() === row.name.trim().toLowerCase())
    );
    if (duplicate) return;

    setQuickSavingId(row.xid);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setQuickSavingId(null); return; }

    const payload = {
      trip_id: tripId,
      user_id: user.id,
      name: row.name,
      category: row.category ?? row.kinds ?? null,
      address: row.address ?? null,
      lat: row.point?.lat ?? null,
      lon: row.point?.lon ?? null,
      status: 'wishlist' as PlaceStatus,
      source: 'opentripmap' as const,
      external_id: row.xid,
      maps_url: row.maps_url ?? null,
      description: null,
      notes: null,
    };

    await supabase.from('places').insert(payload);
    setQuickSavingId(null);
    load();
  };

  const handleMapsUrl = (url: string) => {
    setForm(p => {
      const updated: Partial<Place> = { ...p, maps_url: url };
      if (!p.name && url) {
        const extracted = tryExtractName(url);
        if (extracted) updated.name = extracted;
      }
      return updated;
    });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.source !== 'opentripmap' && !form.maps_url && !form.tiktok_url) {
      setLinkError('Inserisci almeno un link (Google Maps o TikTok)');
      return;
    }
    const normalizedStatus = normalizePlaceStatus(form.status as Place['status']);
    if (normalizedStatus === 'booked' && (!form.booking_date || !form.booking_time)) {
      setLinkError('Per i luoghi prenotati inserisci giorno e ora.');
      return;
    }
    setLinkError(null);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const raw = {
      ...form,
      trip_id: tripId,
      user_id: user.id,
      status: normalizedStatus,
    };
    const payload = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, v === '' ? null : v])
    );
    if (editing) {
      await supabase.from('places').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('places').insert(payload);
    }
    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = async (item: Place) => {
    if (!confirm('Eliminare questo luogo?')) return;
    await supabase.from('places').delete().eq('id', item.id);
    load();
  };

  const favoriteItems = items.filter((i) => normalizePlaceStatus(i.status) !== 'suggested');

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

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
            <Map size={18} className="text-emerald-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Luoghi</h1>
            <p className="text-sm text-gray-500">{items.length} {items.length === 1 ? 'luogo' : 'luoghi'}</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Aggiungi luogo</button>
      </div>

      <div className="card p-4 mb-5 space-y-3">
        <p className="text-[11px] uppercase tracking-[0.08em] text-slate-500 font-bold">Ricerca luoghi gratuiti (OpenStreetMap)</p>
        <div className="grid sm:grid-cols-2 gap-2">
          <div
            className="relative"
            onBlur={() => setTimeout(() => setShowCitySuggestions(false), 120)}
          >
            <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={cityQuery}
              onFocus={() => setShowCitySuggestions(citySuggestions.length > 0)}
              onChange={(e) => {
                setCityQuery(e.target.value);
                setSelectedCity(null);
              }}
              className="input pl-9"
              placeholder="Città (es. Alicante)"
              autoComplete="off"
            />
            {cityLoading && <Loader2 size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}

            {showCitySuggestions && citySuggestions.length > 0 && (
              <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-elevated overflow-hidden max-h-56 overflow-y-auto">
                {citySuggestions.map((s, i) => (
                  <button
                    key={`${s.display_name}-${i}`}
                    type="button"
                    onClick={() => selectCitySuggestion(s)}
                    className="w-full text-left px-3 py-2.5 text-sm text-slate-700 hover:bg-primary-50 hover:text-primary-800 border-b border-slate-100 last:border-0"
                  >
                    <span className="font-medium">{s.display_name.split(',')[0]}</span>
                    <span className="text-xs text-slate-400 ml-1">
                      {s.display_name.split(',').slice(1, 3).join(',')}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={placeQuery}
              onChange={(e) => setPlaceQuery(e.target.value)}
              className="input pl-9"
              placeholder="Musei, chiese, parchi... (opzionale)"
            />
          </div>
        </div>
        {suggestionsError && <p className="text-xs text-red-600">{suggestionsError}</p>}
        {!cityQuery.trim() && <p className="text-xs text-slate-400">Scrivi una città per ottenere suggerimenti.</p>}

        {cityQuery.trim() && (
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            {suggestionsLoading ? (
              <div className="p-3 text-xs text-slate-500 flex items-center gap-2"><Loader2 size={13} className="animate-spin" /> Ricerca in corso...</div>
            ) : suggestions.length === 0 ? (
              <div className="p-3 text-xs text-slate-400">Nessun luogo trovato.</div>
            ) : (
              <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                {suggestions.map((r) => {
                  const exists = items.some((i) => (i.external_id && i.external_id === r.xid) || (!!i.name && i.name.toLowerCase() === r.name.toLowerCase()));
                  return (
                    <div key={r.xid} className="p-3 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800 truncate">{r.name}</p>
                        <p className="text-xs text-slate-500 truncate">{r.category ?? r.kinds}</p>
                        {r.address && <p className="text-xs text-slate-400 truncate">{r.address}</p>}
                      </div>
                      <button
                        type="button"
                        onClick={() => saveSuggestion(r)}
                        disabled={exists || quickSavingId === r.xid}
                        className={`text-xs px-2.5 py-1.5 rounded-lg font-semibold ${exists ? 'bg-slate-100 text-slate-400' : 'bg-emerald-600 text-white hover:bg-emerald-700'}`}
                      >
                        {exists ? 'Salvato' : quickSavingId === r.xid ? 'Salvo...' : 'Salva'}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold uppercase tracking-[0.08em] text-slate-500">Preferiti</h2>
        <span className="text-xs px-2 py-1 rounded-full bg-slate-100 text-slate-600">{favoriteItems.length}</span>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-sand-200" />)}</div>
      ) : favoriteItems.length === 0 ? (
        <EmptyState
          icon={Map}
          title="Nessun preferito"
          description="Cerca una città e salva i luoghi suggeriti, oppure aggiungili a mano."
          action={{ label: 'Aggiungi luogo', onClick: openAdd }}
        />
      ) : (
        <div className="space-y-3">
          {favoriteItems.map(item => (
            <div key={item.id} className="card p-5 flex gap-4 items-start">
              <div className="text-2xl flex-shrink-0">
                📌
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.name
                    ? <span className="font-semibold text-gray-900">{item.name}</span>
                    : <span className="font-semibold text-gray-400 italic">Senza nome</span>
                  }
                  <span className={`badge ${normalizePlaceStatus(item.status) === 'booked' ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-700'}`}>
                    {normalizePlaceStatus(item.status) === 'booked' ? 'Prenotato' : 'Preferito'}
                  </span>
                  {item.category && <span className="badge bg-emerald-100 text-emerald-700">{item.category}</span>}
                  {item.rating   && <span className="text-sm">{RATE_MAP[item.rating] ?? item.rating}</span>}
                  {item.source === 'opentripmap' && <span className="badge bg-blue-100 text-blue-700">OSM</span>}
                </div>
                {item.address && <p className="text-xs text-gray-500 mt-0.5">{item.address}</p>}
                {normalizePlaceStatus(item.status) === 'booked' && item.booking_date && item.booking_time && (
                  <p className="text-xs text-blue-700 mt-1 font-medium">{item.booking_date} · {item.booking_time.slice(0, 5)}</p>
                )}
                {item.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{item.description}</p>}
                {item.notes && <p className="mt-1 text-xs text-gray-400 italic">{item.notes}</p>}
                <div className="mt-2 flex gap-2">
                  {item.maps_url && (
                    <a href={item.maps_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-full transition-colors">
                      <MapPin size={11} /> Maps
                    </a>
                  )}
                  {item.tiktok_url && (
                    <a href={item.tiktok_url} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-medium text-pink-700 bg-pink-50 hover:bg-pink-100 px-2 py-0.5 rounded-full transition-colors">
                      <ExternalLink size={11} /> TikTok
                    </a>
                  )}
                </div>
                <TicketAttachments module="place" tripId={tripId} recordId={item.id} />
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-sand-200"><Edit size={14} /></button>
                <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Modifica luogo' : 'Aggiungi luogo'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            {/* Link section */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
              <p className="text-xs font-semibold text-amber-800 uppercase tracking-wide">🔗 Link — almeno uno obbligatorio</p>
              <div className="form-group mb-0">
                <label className="label flex items-center gap-1.5"><MapPin size={13} className="text-emerald-600" /> Google Maps</label>
                <input
                  type="url"
                  value={form.maps_url ?? ''}
                  onChange={e => handleMapsUrl(e.target.value)}
                  className="input"
                  placeholder="https://maps.app.goo.gl/..."
                />
              </div>
              <div className="form-group mb-0">
                <label className="label flex items-center gap-1.5"><ExternalLink size={13} className="text-pink-500" /> TikTok</label>
                <input
                  type="url"
                  value={form.tiktok_url ?? ''}
                  onChange={e => setForm(p => ({ ...p, tiktok_url: e.target.value }))}
                  className="input"
                  placeholder="https://www.tiktok.com/@..."
                />
              </div>
              {linkError && <p className="text-xs text-red-600 font-semibold">{linkError}</p>}
            </div>

            {/* Optional fields */}
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Dettagli opzionali</p>
              <div className="space-y-3">
                <div className="form-group">
                  <label className="label">Nome</label>
                  <input value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" placeholder="Sagrada Familia" />
                </div>
                <div className="form-group">
                  <label className="label">Categoria</label>
                  <input value={form.category ?? ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input" placeholder="Museo, Monumento..." />
                </div>
                <div className="form-group">
                  <label className="label">Stato</label>
                  <select
                    value={normalizePlaceStatus(form.status as Place['status'])}
                    onChange={e => setForm(p => ({ ...p, status: e.target.value as PlaceStatus }))}
                    className="input"
                  >
                    <option value="wishlist">Preferito</option>
                    <option value="booked">Prenotato</option>
                  </select>
                </div>
                {normalizePlaceStatus(form.status as Place['status']) === 'booked' && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="label">Giorno prenotazione</label>
                      <input
                        type="date"
                        value={form.booking_date ?? ''}
                        onChange={e => setForm(p => ({ ...p, booking_date: e.target.value }))}
                        className="input"
                      />
                    </div>
                    <div className="form-group">
                      <label className="label">Orario prenotazione</label>
                      <input
                        type="time"
                        value={form.booking_time ?? ''}
                        onChange={e => setForm(p => ({ ...p, booking_time: e.target.value }))}
                        className="input"
                      />
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="label">Indirizzo</label>
                  <input value={form.address ?? ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="input" placeholder="C/ de Mallorca, 401, Barcellona" />
                </div>
                <div className="form-group">
                  <label className="label">Descrizione</label>
                  <textarea value={form.description ?? ''} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input min-h-[60px] resize-none" rows={2} placeholder="Breve descrizione..." />
                </div>
                <div className="form-group">
                  <label className="label">Note personali</label>
                  <textarea value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="input min-h-[60px] resize-none" rows={2} />
                </div>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setModalOpen(false)} className="btn-secondary flex-1 justify-center">Annulla</button>
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">{saving ? 'Salvataggio...' : 'Salva'}</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
