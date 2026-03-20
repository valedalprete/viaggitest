'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Car, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { CarRental } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';

const empty = (): Partial<CarRental> => ({
  company: '', pickup_location: '', dropoff_location: '',
  pickup_date: '', dropoff_date: '', car_model: '',
  price_total: undefined, booking_ref: '', notes: '',
});

export default function CarRentalPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const [items, setItems] = useState<CarRental[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CarRental | null>(null);
  const [form, setForm] = useState<Partial<CarRental>>(empty());
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = () => {
    supabase.from('car_rentals').select('*').eq('trip_id', tripId).order('pickup_date').then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [tripId]);

  const openAdd = () => { setEditing(null); setForm(empty()); setModalOpen(true); };
  const openEdit = (item: CarRental) => { setEditing(item); setForm(item); setModalOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const raw = { ...form, trip_id: tripId, user_id: user.id, price_total: form.price_total ? Number(form.price_total) : null };
    const payload = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, v === '' ? null : v])
    );
    if (editing) {
      await supabase.from('car_rentals').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('car_rentals').insert(payload);
    }
    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = async (item: CarRental) => {
    if (!confirm('Eliminare questo noleggio?')) return;
    await supabase.from('car_rentals').delete().eq('id', item.id);
    load();
  };

  const rentalDays = (item: CarRental) => {
    if (!item.pickup_date || !item.dropoff_date) return null;
    return Math.max(0, (new Date(item.dropoff_date).getTime() - new Date(item.pickup_date).getTime()) / 86400000);
  };

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
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
            <Car size={18} className="text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Auto a noleggio</h1>
            <p className="text-sm text-gray-500">{items.length} {items.length === 1 ? 'noleggio' : 'noleggi'}</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Aggiungi noleggio</button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-sand-200" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Car} title="Nessun noleggio" description="Aggiungi auto o altri veicoli a noleggio." action={{ label: 'Aggiungi noleggio', onClick: openAdd }} />
      ) : (
        <div className="space-y-3">
          {items.map(item => {
            const days = rentalDays(item);
            return (
              <div key={item.id} className="card p-5 flex gap-4 items-start">
                <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                  <Car size={16} className="text-rose-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    {item.company   && <span className="font-semibold text-gray-900">{item.company}</span>}
                    {item.car_model && <span className="badge bg-rose-100 text-rose-700">{item.car_model}</span>}
                  </div>
                  <div className="mt-1 text-xs text-gray-400 flex flex-wrap gap-3">
                    {item.pickup_location  && <span>Ritiro: {item.pickup_location}</span>}
                    {item.dropoff_location && <span>Reso: {item.dropoff_location}</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-gray-400 flex flex-wrap gap-3">
                    {item.pickup_date  && <span>{formatDate(item.pickup_date)}</span>}
                    {item.dropoff_date && <span>→ {formatDate(item.dropoff_date)}</span>}
                    {days !== null     && <span>{days} {days === 1 ? 'giorno' : 'giorni'}</span>}
                    {item.price_total != null && <span className="text-primary-600 font-medium">{formatCurrency(item.price_total)} totale</span>}
                    {item.booking_ref  && <span>Ref: <span className="font-mono">{item.booking_ref}</span></span>}
                  </div>
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
        <Modal title={editing ? 'Modifica noleggio' : 'Aggiungi noleggio'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Società</label>
                <input value={form.company ?? ''} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} className="input" placeholder="Hertz, Europcar..." />
              </div>
              <div className="form-group">
                <label className="label">Modello auto</label>
                <input value={form.car_model ?? ''} onChange={e => setForm(p => ({ ...p, car_model: e.target.value }))} className="input" placeholder="Fiat 500" />
              </div>
            </div>
            <div className="form-group">
              <label className="label">Luogo ritiro</label>
              <input value={form.pickup_location ?? ''} onChange={e => setForm(p => ({ ...p, pickup_location: e.target.value }))} className="input" placeholder="Aeroporto di Barcellona" />
            </div>
            <div className="form-group">
              <label className="label">Luogo reso</label>
              <input value={form.dropoff_location ?? ''} onChange={e => setForm(p => ({ ...p, dropoff_location: e.target.value }))} className="input" placeholder="Aeroporto di Barcellona" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Data ritiro</label>
                <input type="date" value={form.pickup_date ?? ''} onChange={e => setForm(p => ({ ...p, pickup_date: e.target.value }))} className="input" />
              </div>
              <div className="form-group">
                <label className="label">Data reso</label>
                <input type="date" value={form.dropoff_date ?? ''} onChange={e => setForm(p => ({ ...p, dropoff_date: e.target.value }))} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Prezzo totale (€)</label>
                <input type="number" step="0.01" min="0" value={form.price_total ?? ''} onChange={e => setForm(p => ({ ...p, price_total: e.target.value ? Number(e.target.value) : undefined }))} className="input" placeholder="0.00" />
              </div>
              <div className="form-group">
                <label className="label">Codice prenotazione</label>
                <input value={form.booking_ref ?? ''} onChange={e => setForm(p => ({ ...p, booking_ref: e.target.value }))} className="input" placeholder="ABC123" />
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
