'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Plane, Edit, Trash2, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Flight } from '@/lib/types';
import { formatDateTime, formatCurrency, formatTime } from '@/lib/utils';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import TicketAttachments from '@/components/TicketAttachments';

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
  const [expandedFlightId, setExpandedFlightId] = useState<string | null>(null);
  const [openFlightMenuId, setOpenFlightMenuId] = useState<string | null>(null);

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
            <div key={f.id} className="card">
              {/* Preview row — clickable to expand */}
              <button
                type="button"
                onClick={() => {
                  setExpandedFlightId(prev => prev === f.id ? null : f.id);
                  setOpenFlightMenuId(null);
                }}
                className="w-full text-left p-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-sky-100 flex items-center justify-center flex-shrink-0">
                  <Plane size={15} className="text-sky-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{f.from_airport}</span>
                    <span className="text-xs text-gray-400">→</span>
                    <span className="text-sm font-semibold text-gray-900">{f.to_airport}</span>
                  </div>
                  {f.airline && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {f.airline} {f.flight_number ? `· ${f.flight_number}` : ''}
                    </p>
                  )}
                </div>
                {f.departure_at && (
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-gray-400">{f.departure_at.split('T')[0]}</p>
                    <p className="text-sm font-semibold text-gray-900">{formatTime(f.departure_at)}</p>
                  </div>
                )}
              </button>

              {/* Expanded details */}
              {expandedFlightId === f.id && (
                <div className="px-3 pb-3 pt-1 border-t border-sand-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">Partenza</p>
                      <p className="text-gray-900 font-medium mt-0.5">{f.from_airport}</p>
                      {f.departure_at && <p className="text-xs text-gray-500">{formatDateTime(f.departure_at)}</p>}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">Arrivo</p>
                      <p className="text-gray-900 font-medium mt-0.5">{f.to_airport}</p>
                      {f.arrival_at && <p className="text-xs text-gray-500">{formatDateTime(f.arrival_at)}</p>}
                    </div>
                  </div>

                  {f.price != null && (
                    <div className="text-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Prezzo</p>
                      <p className="text-primary-600 font-bold">{formatCurrency(f.price)}</p>
                    </div>
                  )}

                  {f.booking_ref && (
                    <div className="text-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Codice</p>
                      <p className="font-mono text-gray-900">{f.booking_ref}</p>
                    </div>
                  )}

                  {f.notes && (
                    <div className="text-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Note</p>
                      <p className="text-gray-600 text-xs italic">{f.notes}</p>
                    </div>
                  )}

                  <TicketAttachments module="flight" tripId={tripId} recordId={f.id} />

                  {/* Three-dot menu */}
                  <div className="flex gap-2 pt-2 border-t border-sand-100">
                    <div className="relative ml-auto">
                      <button
                        type="button"
                        onClick={() => setOpenFlightMenuId(prev => prev === f.id ? null : f.id)}
                        className="p-1 text-slate-500 hover:text-slate-700 transition-colors"
                        aria-label="Azioni volo"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {openFlightMenuId === f.id && (
                        <div className="absolute right-0 top-8 z-20 w-32 rounded-xl border border-slate-200 bg-white shadow-elevated p-1">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenFlightMenuId(null);
                              openEdit(f);
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                          >
                            <Edit size={13} /> Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenFlightMenuId(null);
                              handleDelete(f);
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                          >
                            <Trash2 size={13} /> Elimina
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
