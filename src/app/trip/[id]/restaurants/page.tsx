'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Utensils, Edit, Trash2, Search, Loader2, ExternalLink, MapPin } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Restaurant, Trip } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import { autosuggestPlaces, formatKinds } from '@/lib/opentripmap';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';

type TabKey = 'booked' | 'wishlist' | 'recommended';

const TABS: { key: TabKey; label: string; desc: string }[] = [
  { key: 'booked',      label: 'Prenotati',   desc: 'Ristoranti con prenotazione confermata' },
  { key: 'wishlist',    label: 'Preferiti',   desc: 'Da prenotare o visitare' },
  { key: 'recommended', label: 'Consigliati', desc: 'Suggeriti da OpenTripMap' },
];

const PRICE_RANGES = ['€', '€€', '€€€', '€€€€'];

const empty = (status: TabKey): Partial<Restaurant> => ({
  name: '', address: '', status, booking_date: '', booking_time: '',
  cuisine: '', price_range: null, notes: '', source: 'manual',
  maps_url: '', tiktok_url: '',
});

const tryExtractName = (url: string): string => {
  try {
    const match = url.match(/\/maps\/place\/([^/@?]+)/);
    if (match) return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch {}
  return '';
};

export default function RestaurantsPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabKey>('booked');
  const [items, setItems] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Restaurant | null>(null);
  const [form, setForm] = useState<Partial<Restaurant>>(empty('booked'));
  const [saving, setSaving] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  // OpenTripMap search state
  const [otmSearch, setOtmSearch] = useState('');
  const [otmResults, setOtmResults] = useState<{ xid: string; name: string; kinds: string }[]>([]);
  const [otmLoading, setOtmLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = createClient();

  const load = () => {
    supabase.from('restaurants').select('*').eq('trip_id', tripId).order('created_at').then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    supabase.from('trips').select('*').eq('id', tripId).single().then(({ data }) => setTrip(data));
  }, [tripId]);

  // OpenTripMap search (debounced)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!otmSearch.trim() || !trip?.lat || !trip?.lon) { setOtmResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setOtmLoading(true);
      const results = await autosuggestPlaces(otmSearch, trip.lat!, trip.lon!, 'foods,restaurants');
      setOtmResults(results.filter(r => r.name?.trim()));
      setOtmLoading(false);
    }, 600);
  }, [otmSearch, trip]);

  const openAdd = () => { setEditing(null); setForm(empty(tab)); setOtmSearch(''); setOtmResults([]); setModalOpen(true); };
  const openEdit = (item: Restaurant) => { setEditing(item); setForm(item); setOtmSearch(''); setOtmResults([]); setModalOpen(true); };

  const selectOtm = (r: { xid: string; name: string; kinds: string }) => {
    setForm(p => ({ ...p, name: r.name, source: 'opentripmap', external_id: r.xid, cuisine: formatKinds(r.kinds), status: tab }));
    setOtmResults([]);
    setOtmSearch('');
  };

  const handleMapsUrl = (url: string) => {
    setForm(p => {
      const updated: Partial<Restaurant> = { ...p, maps_url: url };
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
    setLinkError(null);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const raw = { ...form, trip_id: tripId, user_id: user.id };
    const payload = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, v === '' ? null : v])
    );
    if (editing) {
      await supabase.from('restaurants').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('restaurants').insert(payload);
    }
    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = async (item: Restaurant) => {
    if (!confirm('Eliminare questo ristorante?')) return;
    await supabase.from('restaurants').delete().eq('id', item.id);
    load();
  };

  const tabItems = items.filter(i => i.status === tab);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href={`/trip/${tripId}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-primary-800 bg-sand-200 hover:bg-sand-300 rounded-lg mb-6 transition-colors">
        <ArrowLeft size={15} /> Torna al viaggio
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Utensils size={18} className="text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Ristoranti</h1>
            <p className="text-sm text-gray-500">{items.length} {items.length === 1 ? 'ristorante' : 'ristoranti'}</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Aggiungi</button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`tab-btn ${tab === t.key ? 'tab-btn-active' : 'tab-btn-inactive'}`}
          >
            {t.label}
            <span className={`ml-1.5 text-xs rounded-full px-1.5 py-0.5 ${tab === t.key ? 'bg-white/20' : 'bg-gray-100'}`}>
              {items.filter(i => i.status === t.key).length}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-sand-200" />)}</div>
      ) : tabItems.length === 0 ? (
        <EmptyState
          icon={Utensils}
          title={`Nessun ristorante in "${TABS.find(t => t.key === tab)?.label}"`}
          description={TABS.find(t => t.key === tab)?.desc}
          action={{ label: 'Aggiungi ristorante', onClick: openAdd }}
        />
      ) : (
        <div className="space-y-3">
          {tabItems.map(item => (
            <div key={item.id} className="card p-5 flex gap-4 items-start">
              <div className="text-2xl flex-shrink-0">🍽️</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.name
                    ? <span className="font-semibold text-gray-900">{item.name}</span>
                    : <span className="font-semibold text-gray-400 italic">Senza nome</span>
                  }
                  {item.price_range && <span className="badge bg-orange-100 text-orange-700">{item.price_range}</span>}
                  {item.cuisine    && <span className="badge bg-gray-100 text-gray-600">{item.cuisine}</span>}
                  {item.source === 'opentripmap' && <span className="badge bg-emerald-100 text-emerald-700">OpenTripMap</span>}
                </div>
                {item.address && <p className="text-xs text-gray-500 mt-0.5">{item.address}</p>}
                <div className="mt-0.5 text-xs text-gray-400 flex flex-wrap gap-3">
                  {item.booking_date && <span>Prenotazione: {formatDate(item.booking_date)}</span>}
                  {item.booking_time && <span>Ore {item.booking_time}</span>}
                </div>
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
        <Modal title={editing ? 'Modifica ristorante' : 'Aggiungi ristorante'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            {/* OTM Search */}
            {!editing && trip?.lat && trip?.lon && (
              <div className="form-group">
                <label className="label">Cerca su OpenTripMap</label>
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={otmSearch}
                    onChange={e => setOtmSearch(e.target.value)}
                    className="input pl-9 pr-8"
                    placeholder="Cerca ristoranti vicino alla destinazione..."
                  />
                  {otmLoading && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />}
                </div>
                {otmResults.length > 0 && (
                  <div className="mt-1 bg-white border border-gray-200 rounded-xl shadow-elevated overflow-hidden max-h-48 overflow-y-auto">
                    {otmResults.map(r => (
                      <button key={r.xid} type="button" onClick={() => selectOtm(r)}
                        className="w-full text-left px-4 py-2.5 text-sm hover:bg-primary-50 hover:text-primary-700 border-b border-gray-100 last:border-0 flex items-center justify-between gap-2"
                      >
                        <span className="font-medium">{r.name}</span>
                        <span className="text-xs text-gray-400">{formatKinds(r.kinds)}</span>
                      </button>
                    ))}
                  </div>
                )}
                {!trip.lat && <p className="text-xs text-amber-600 mt-1">⚠️ Aggiungi la posizione al viaggio per usare la ricerca</p>}
              </div>
            )}

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
                  <input value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" placeholder="La Boqueria" />
                </div>
                <div className="form-group">
                  <label className="label">Stato</label>
                  <select value={form.status ?? 'wishlist'} onChange={e => setForm(p => ({ ...p, status: e.target.value as TabKey }))} className="input">
                    {TABS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="label">Cucina</label>
                    <input value={form.cuisine ?? ''} onChange={e => setForm(p => ({ ...p, cuisine: e.target.value }))} className="input" placeholder="Catalana, Tapas..." />
                  </div>
                  <div className="form-group">
                    <label className="label">Fascia prezzo</label>
                    <select value={form.price_range ?? ''} onChange={e => setForm(p => ({ ...p, price_range: e.target.value as Restaurant['price_range'] || null }))} className="input">
                      <option value="">—</option>
                      {PRICE_RANGES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>
                <div className="form-group">
                  <label className="label">Indirizzo</label>
                  <input value={form.address ?? ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="input" placeholder="Carrer de la Boqueria, Barcellona" />
                </div>
                {(form.status === 'booked') && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="form-group">
                      <label className="label">Data prenotazione</label>
                      <input type="date" value={form.booking_date ?? ''} onChange={e => setForm(p => ({ ...p, booking_date: e.target.value }))} className="input" />
                    </div>
                    <div className="form-group">
                      <label className="label">Orario</label>
                      <input type="time" value={form.booking_time ?? ''} onChange={e => setForm(p => ({ ...p, booking_time: e.target.value }))} className="input" />
                    </div>
                  </div>
                )}
                <div className="form-group">
                  <label className="label">Note</label>
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
