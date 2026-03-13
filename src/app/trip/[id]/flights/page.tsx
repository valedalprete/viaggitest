'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Plane, Edit, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Flight } from '@/lib/types';
import { formatDateTime, formatCurrency } from '@/lib/utils';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';

const FLIGHT_TYPES = [
  { value: 'outbound', label: 'Andata' },
  { value: 'return',   label: 'Ritorno' },
  { value: 'other',    label: 'Altro' },
];

const empty = (): Partial<Flight> => ({
  type: 'outbound', airline: '', flight_number: '',
  from_airport: '', to_airport: '', departure_at: '', arrival_at: '',
  price: undefined, booking_ref: '', notes: '',
});

export default function FlightsPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const router = useRouter();
  const [flights, setFlights] = useState<Flight[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Flight | null>(null);
  const [form, setForm] = useState<Partial<Flight>>(empty());
  const [saving, setSaving] = useState(false);

  const supabase = createClient();

  const load = () => {
    supabase.from('flights').select('*').eq('trip_id', tripId).order('departure_at').then(({ data }) => {
      setFlights(data ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [tripId]);

  const openAdd = () => { setEditing(null); setForm(empty()); setModalOpen(true); };
  const openEdit = (f: Flight) => { setEditing(f); setForm(f); setModalOpen(true); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const raw = { ...form, trip_id: tripId, user_id: user.id, price: form.price ? Number(form.price) : null };
    const payload = Object.fromEntries(
      Object.entries(raw).map(([k, v]) => [k, v === '' ? null : v])
    );

    if (editing) {
      await supabase.from('flights').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('flights').insert(payload);
    }
    setSaving(false);
    setModalOpen(false);
    load();
  };

  const handleDelete = async (f: Flight) => {
    if (!confirm('Eliminare questo volo?')) return;
    await supabase.from('flights').delete().eq('id', f.id);
    load();
  };

  const typeLabel = (t: string) => FLIGHT_TYPES.find(x => x.value === t)?.label ?? t;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
      <Link href={`/trip/${tripId}`} className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-primary-800 bg-sand-200 hover:bg-sand-300 rounded-lg mb-6 transition-colors">
        <ArrowLeft size={15} /> Torna al viaggio
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center">
            <Plane size={18} className="text-sky-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Voli</h1>
            <p className="text-sm text-gray-500">{flights.length} {flights.length === 1 ? 'volo' : 'voli'}</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Aggiungi volo</button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="card h-24 animate-pulse bg-sand-200" />)}</div>
      ) : flights.length === 0 ? (
        <EmptyState icon={Plane} title="Nessun volo" description="Aggiungi i voli del tuo viaggio." action={{ label: 'Aggiungi volo', onClick: openAdd }} />
      ) : (
        <div className="space-y-3">
          {flights.map(f => (
            <div key={f.id} className="card p-5 flex gap-4 items-start">
              <div className="w-9 h-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Plane size={16} className="text-sky-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge bg-sky-100 text-sky-700">{typeLabel(f.type)}</span>
                  {f.airline && <span className="text-sm font-medium text-gray-800">{f.airline}</span>}
                  {f.flight_number && <span className="text-sm text-gray-500">{f.flight_number}</span>}
                </div>
                <div className="mt-1 text-sm text-gray-700 font-medium">
                  {f.from_airport} → {f.to_airport}
                </div>
                <div className="mt-0.5 text-xs text-gray-400 flex flex-wrap gap-3">
                  {f.departure_at && <span>Partenza: {formatDateTime(f.departure_at)}</span>}
                  {f.arrival_at   && <span>Arrivo: {formatDateTime(f.arrival_at)}</span>}
                  {f.price != null && <span className="text-primary-600 font-medium">{formatCurrency(f.price)}</span>}
                  {f.booking_ref  && <span>Ref: <span className="font-mono">{f.booking_ref}</span></span>}
                </div>
                {f.notes && <p className="mt-1 text-xs text-gray-400 italic">{f.notes}</p>}
              </div>
              <div className="flex gap-1.5 flex-shrink-0">
                <button onClick={() => openEdit(f)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-sand-200"><Edit size={14} /></button>
                <button onClick={() => handleDelete(f)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Modifica volo' : 'Aggiungi volo'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="form-group">
              <label className="label">Tipo *</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as Flight['type'] }))} className="input">
                {FLIGHT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Compagnia</label>
                <input value={form.airline ?? ''} onChange={e => setForm(p => ({ ...p, airline: e.target.value }))} className="input" placeholder="Ryanair" />
              </div>
              <div className="form-group">
                <label className="label">N° volo</label>
                <input value={form.flight_number ?? ''} onChange={e => setForm(p => ({ ...p, flight_number: e.target.value }))} className="input" placeholder="FR1234" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Partenza da *</label>
                <input value={form.from_airport ?? ''} onChange={e => setForm(p => ({ ...p, from_airport: e.target.value }))} className="input" placeholder="MXP" required />
              </div>
              <div className="form-group">
                <label className="label">Arrivo a *</label>
                <input value={form.to_airport ?? ''} onChange={e => setForm(p => ({ ...p, to_airport: e.target.value }))} className="input" placeholder="BCN" required />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Data/ora partenza</label>
                <input type="datetime-local" value={form.departure_at ? form.departure_at.slice(0, 16) : ''} onChange={e => setForm(p => ({ ...p, departure_at: e.target.value }))} className="input" />
              </div>
              <div className="form-group">
                <label className="label">Data/ora arrivo</label>
                <input type="datetime-local" value={form.arrival_at ? form.arrival_at.slice(0, 16) : ''} onChange={e => setForm(p => ({ ...p, arrival_at: e.target.value }))} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Prezzo (€)</label>
                <input type="number" step="0.01" min="0" value={form.price ?? ''} onChange={e => setForm(p => ({ ...p, price: e.target.value ? Number(e.target.value) : undefined }))} className="input" placeholder="0.00" />
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
