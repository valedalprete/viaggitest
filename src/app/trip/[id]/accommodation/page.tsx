'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Hotel, Edit, Trash2, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Accommodation } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';

const TYPES = ['hotel','airbnb','hostel','apartment','villa','camping','other'] as const;
const TYPE_LABELS: Record<string, string> = {
  hotel: 'Hotel', airbnb: 'Airbnb', hostel: 'Ostello',
  apartment: 'Appartamento', villa: 'Villa', camping: 'Campeggio', other: 'Altro',
};

const empty = (): Partial<Accommodation> => ({
  name: '', type: 'hotel', address: '',
  checkin_date: '', checkout_date: '', price_per_night: undefined,
  price_type: 'per_night',
  booking_ref: '', booking_url: '', notes: '',
});

export default function AccommodationPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const [items, setItems] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Accommodation | null>(null);
  const [form, setForm] = useState<Partial<Accommodation>>(empty());
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = () => {
    supabase.from('accommodations').select('*').eq('trip_id', tripId).order('checkin_date').then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [tripId]);

  const openAdd = () => { setEditing(null); setForm(empty()); setModalOpen(true); };
  const openEdit = (item: Accommodation) => { setEditing(item); setForm(item); setModalOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    // Campi ammessi dalla tabella
    const payload: Record<string, unknown> = {
      trip_id: tripId,
      user_id: user.id,
      name: form.name || null,
      type: form.type ?? 'hotel',
      address: form.address || null,
      checkin_date: form.checkin_date || null,
      checkout_date: form.checkout_date || null,
      price_per_night: form.price_per_night ? Number(form.price_per_night) : null,
      price_type: form.price_type ?? 'per_night',
      booking_ref: form.booking_ref || null,
      booking_url: form.booking_url || null,
      notes: form.notes || null,
    };

    let err: unknown;
    if (editing) {
      const { error } = await supabase.from('accommodations').update(payload).eq('id', editing.id);
      err = error;
    } else {
      const { error } = await supabase.from('accommodations').insert(payload);
      err = error;
    }
    if (err) console.error('Accommodation save error:', err);
    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = async (item: Accommodation) => {
    if (!confirm('Eliminare questo alloggio?')) return;
    await supabase.from('accommodations').delete().eq('id', item.id);
    load();
  };

  const nights = (item: Accommodation) => {
    if (!item.checkin_date || !item.checkout_date) return null;
    const diff = (new Date(item.checkout_date).getTime() - new Date(item.checkin_date).getTime()) / 86400000;
    return Math.max(0, diff);
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href={`/trip/${tripId}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-primary-800 bg-sand-200 hover:bg-sand-300 rounded-lg mb-6 transition-colors">
        <ArrowLeft size={15} /> Torna al viaggio
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center">
            <Hotel size={18} className="text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Alloggio</h1>
            <p className="text-sm text-gray-500">{items.length} {items.length === 1 ? 'struttura' : 'strutture'}</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Aggiungi alloggio</button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-sand-200" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Hotel} title="Nessun alloggio" description="Aggiungi hotel, Airbnb o altre strutture." action={{ label: 'Aggiungi alloggio', onClick: openAdd }} />
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const n = nights(item);
            return (
              <div key={item.id} className="card p-5 flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Hotel size={16} className="text-violet-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900">{item.name}</span>
                    <span className="badge bg-violet-100 text-violet-700">{TYPE_LABELS[item.type] ?? item.type}</span>
                  </div>
                  {item.address && <p className="text-xs text-gray-500 mt-0.5">{item.address}</p>}
                  <div className="mt-1 text-xs text-gray-400 flex flex-wrap gap-3">
                    {item.checkin_date  && <span>Check-in: {formatDate(item.checkin_date)}</span>}
                    {item.checkout_date && <span>Check-out: {formatDate(item.checkout_date)}</span>}
                    {n !== null && <span>{n} {n === 1 ? 'notte' : 'notti'}</span>}
                    {item.price_per_night != null && (
                      <span className="text-primary-600 font-medium">
                        {item.price_type === 'total'
                          ? <>{formatCurrency(item.price_per_night)}{n ? ` · ${formatCurrency(item.price_per_night / n)}/notte` : ''}</>
                          : <>{formatCurrency(item.price_per_night)}/notte{n ? ` · Tot: ${formatCurrency(item.price_per_night * n)}` : ''}</>}
                      </span>
                    )}
                    {item.booking_ref && <span>Ref: <span className="font-mono">{item.booking_ref}</span></span>}
                  </div>
                  {item.booking_url && (
                    <a href={item.booking_url} target="_blank" rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 px-2 py-0.5 rounded-full transition-colors">
                      <ExternalLink size={11} /> Apri prenotazione
                    </a>
                  )}
                  {item.notes && <p className="mt-1 text-xs text-gray-400 italic">{item.notes}</p>}
                </div>
                <div className="flex gap-1.5 flex-shrink-0">
                  <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-sand-200"><Edit size={14} /></button>
                  <button onClick={() => handleDelete(item)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Modifica alloggio' : 'Aggiungi alloggio'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="form-group">
              <label className="label">Nome *</label>
              <input value={form.name ?? ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="input" placeholder="Hotel Barceló" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Tipo</label>
                <select value={form.type ?? 'hotel'} onChange={e => setForm(p => ({ ...p, type: e.target.value as Accommodation['type'] }))} className="input">
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Prezzo (€)</label>
                <div className="flex gap-2">
                  <input type="number" step="0.01" min="0" value={form.price_per_night ?? ''} onChange={e => setForm(p => ({ ...p, price_per_night: e.target.value ? Number(e.target.value) : undefined }))} className="input flex-1" placeholder="0.00" />
                  <select
                    value={form.price_type ?? 'per_night'}
                    onChange={e => setForm(p => ({ ...p, price_type: e.target.value as 'per_night' | 'total' }))}
                    className="input w-auto text-xs px-2"
                  >
                    <option value="per_night">a notte</option>
                    <option value="total">totale</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="form-group">
              <label className="label">Indirizzo</label>
              <input value={form.address ?? ''} onChange={e => setForm(p => ({ ...p, address: e.target.value }))} className="input" placeholder="Via esempio 1, Barcellona" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Check-in</label>
                <input type="date" value={form.checkin_date ?? ''} onChange={e => setForm(p => ({ ...p, checkin_date: e.target.value }))} className="input" />
              </div>
              <div className="form-group">
                <label className="label">Check-out</label>
                <input type="date" value={form.checkout_date ?? ''} onChange={e => setForm(p => ({ ...p, checkout_date: e.target.value }))} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Codice prenotazione</label>
                <input value={form.booking_ref ?? ''} onChange={e => setForm(p => ({ ...p, booking_ref: e.target.value }))} className="input" placeholder="ABC123" />
              </div>
              <div className="form-group">
                <label className="label flex items-center gap-1.5"><ExternalLink size={13} className="text-blue-500" /> Link prenotazione</label>
                <input type="url" value={form.booking_url ?? ''} onChange={e => setForm(p => ({ ...p, booking_url: e.target.value }))} className="input" placeholder="https://booking.com/..." />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Note</label>
              <textarea value={form.notes ?? ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} className="input min-h-[60px] resize-none" rows={2} />
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
