'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Map, Edit, Trash2, Search, Loader2, MapPin, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Place, Trip } from '@/lib/types';
import { autosuggestPlaces, formatKinds } from '@/lib/opentripmap';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';

type TabKey = 'chosen' | 'wishlist' | 'suggested';

const TABS: { key: TabKey; label: string; desc: string; emoji: string }[] = [
  { key: 'chosen',   label: 'Scelti',       desc: 'Luoghi confermati nell\'itinerario', emoji: '✅' },
  { key: 'wishlist', label: 'Da visitare',  desc: 'Luoghi da valutare', emoji: '📌' },
  { key: 'suggested',label: 'Suggeriti',    desc: 'Trovati su OpenTripMap', emoji: '🔍' },
];

const RATE_MAP: Record<string, string> = { '1': '⭐', '2': '⭐⭐', '3': '⭐⭐⭐', '1h': '🏛️', '2h': '🏛️🏛️', '3h': '🏛️🏛️🏛️' };

const empty = (status: TabKey): Partial<Place> => ({
  name: '', category: '', address: '', status, source: 'manual', description: '', notes: '',
  maps_url: '', tiktok_url: '',
});

const tryExtractName = (url: string): string => {
  try {
    const match = url.match(/\/maps\/place\/([^/@?]+)/);
    if (match) return decodeURIComponent(match[1].replace(/\+/g, ' '));
  } catch {}
  return '';
};

export default function RecommendationsPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const [tab, setTab] = useState<TabKey>('chosen');
  const [items, setItems] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Place | null>(null);
  const [form, setForm] = useState<Partial<Place>>(empty('chosen'));
  const [saving, setSaving] = useState(false);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const [otmSearch, setOtmSearch] = useState('');
  const [otmResults, setOtmResults] = useState<{ xid: string; name: string; kinds: string; rate?: string }[]>([]);
  const [otmLoading, setOtmLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const supabase = createClient();

  const load = () => {
    supabase.from('places').select('*').eq('trip_id', tripId).order('created_at').then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  };

  useEffect(() => {
    load();
    supabase.from('trips').select('*').eq('id', tripId).single().then(({ data }) => setTrip(data));
  }, [tripId]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!otmSearch.trim() || !trip?.lat || !trip?.lon) { setOtmResults([]); return; }
    debounceRef.current = setTimeout(async () => {
      setOtmLoading(true);
      const results = await autosuggestPlaces(otmSearch, trip.lat!, trip.lon!, 'interesting_places,museums,architecture,natural,cultural,churches');
      setOtmResults(results.filter(r => r.name?.trim()));
      setOtmLoading(false);
    }, 600);
  }, [otmSearch, trip]);

  const openAdd = () => { setEditing(null); setForm(empty(tab)); setOtmSearch(''); setOtmResults([]); setModalOpen(true); };
  const openEdit = (item: Place) => { setEditing(item); setForm(item); setOtmSearch(''); setOtmResults([]); setModalOpen(true); };

  const selectOtm = (r: { xid: string; name: string; kinds: string }) => {
    setForm(p => ({
      ...p,
      name: r.name,
      source: 'opentripmap',
      external_id: r.xid,
      category: formatKinds(r.kinds),
      status: tab,
    }));
    setOtmResults([]);
    setOtmSearch('');
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
    setLinkError(null);
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const raw = { ...form, trip_id: tripId, user_id: user.id };
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

  const tabItems = items.filter(i => i.status === tab);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href={`/trip/${tripId}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-primary-800 bg-sand-200 hover:bg-sand-300 rounded-lg mb-6 transition-colors">
        <ArrowLeft size={15} /> Torna al viaggio
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

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={`tab-btn ${tab === t.key ? 'tab-btn-active' : 'tab-btn-inactive'}`}>
            <span className="mr-1">{t.emoji}</span>{t.label}
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
          icon={Map}
          title={`Nessun luogo in "${TABS.find(t => t.key === tab)?.label}"`}
          description={TABS.find(t => t.key === tab)?.desc}
          action={{ label: 'Aggiungi luogo', onClick: openAdd }}
        />
      ) : (
        <div className="space-y-3">
          {tabItems.map(item => (
            <div key={item.id} className="card p-5 flex gap-4 items-start">
              <div className="text-2xl flex-shrink-0">
                {tab === 'chosen' ? '✅' : tab === 'wishlist' ? '📌' : '🔍'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {item.name
                    ? <span className="font-semibold text-gray-900">{item.name}</span>
                    : <span className="font-semibold text-gray-400 italic">Senza nome</span>
                  }
                  {item.category && <span className="badge bg-emerald-100 text-emerald-700">{item.category}</span>}
                  {item.rating   && <span className="text-sm">{RATE_MAP[item.rating] ?? item.rating}</span>}
                  {item.source === 'opentripmap' && <span className="badge bg-blue-100 text-blue-700">OpenTripMap</span>}
                </div>
                {item.address && <p className="text-xs text-gray-500 mt-0.5">{item.address}</p>}
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
                    placeholder="Cerca musei, monumenti, parchi..."
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
                  <input value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" placeholder="Sagrada Familia" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="form-group">
                    <label className="label">Categoria</label>
                    <input value={form.category ?? ''} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input" placeholder="Museo, Monumento..." />
                  </div>
                  <div className="form-group">
                    <label className="label">Stato</label>
                    <select value={form.status ?? 'wishlist'} onChange={e => setForm(p => ({ ...p, status: e.target.value as TabKey }))} className="input">
                      {TABS.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                    </select>
                  </div>
                </div>
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
