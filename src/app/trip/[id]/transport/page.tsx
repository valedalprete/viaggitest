'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Bus, Edit, Trash2, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Transport } from '@/lib/types';
import { formatDate, formatCurrency } from '@/lib/utils';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';
import TicketAttachments from '@/components/TicketAttachments';

const TYPES = ['train','bus','ferry','metro','taxi','uber','other'] as const;
const TYPE_LABELS: Record<string, string> = {
  train: 'Treno', bus: 'Bus', ferry: 'Traghetto',
  metro: 'Metro', taxi: 'Taxi', uber: 'Uber', other: 'Altro',
};

function PublicTransportIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className={className} fill="currentColor" aria-hidden="true">
      <path d="M297.5-422.5Q280-405 280-380t17.5 42.5Q315-320 340-320t42.5-17.5Q400-355 400-380t-17.5-42.5Q365-440 340-440t-42.5 17.5Zm532.5-93Q880-471 880-400v160q0 33-23.5 56.5T800-160l80 80H520l80-80q-33 0-56.5-23.5T520-240v-160q0-71 50-115.5T700-560q80 0 130 44.5ZM679-291q-9 9-9 21t9 21q9 9 21 9t21-9q9-9 9-21t-9-21q-9-9-21-9t-21 9Zm-91-149q-4 9-6 19t-2 21v40h240v-40q0-11-2-21t-6-19H588ZM480-880q172 0 246 37t74 123v96q-18-6-38-9.5t-42-5.5v-41H240v120h260q-16 17-27.5 37T453-480H240v120q0 33 23.5 56.5T320-280h120v80H320v40q0 17-11.5 28.5T280-120h-40q-17 0-28.5-11.5T200-160v-82q-18-20-29-44.5T160-340v-380q0-83 77-121.5T480-880Zm2 120h224-448 224Zm-224 0h448q-15-17-64.5-28.5T482-800q-107 0-156.5 12.5T258-760Zm195 280Z" />
    </svg>
  );
}

function TaxiCarIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 -960 960 960" className={className} fill="currentColor" aria-hidden="true">
      <path d="M240-200v40q0 17-11.5 28.5T200-120h-40q-17 0-28.5-11.5T120-160v-320l84-240q6-18 21.5-29t34.5-11h100v-80h240v80h100q19 0 34.5 11t21.5 29l84 240v320q0 17-11.5 28.5T800-120h-40q-17 0-28.5-11.5T720-160v-40H240Zm-8-360h496l-42-120H274l-42 120Zm-32 80v200-200Zm100 160q25 0 42.5-17.5T360-380q0-25-17.5-42.5T300-440q-25 0-42.5 17.5T240-380q0 25 17.5 42.5T300-320Zm360 0q25 0 42.5-17.5T720-380q0-25-17.5-42.5T660-440q-25 0-42.5 17.5T600-380q0 25 17.5 42.5T660-320Zm-460 40h560v-200H200v200Z" />
    </svg>
  );
}

const TRANSPORT_ICON_KIND: Record<string, 'public' | 'car'> = {
  train: 'public',
  bus: 'public',
  ferry: 'public',
  metro: 'public',
  taxi: 'car',
  uber: 'car',
  other: 'public',
};

const empty = (): Partial<Transport> => ({
  type: 'train', from_location: '', to_location: '', date: '',
  departure_time: '', arrival_time: '', operator: '', price: undefined,
  booking_ref: '', notes: '',
});

export default function TransportPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const [items, setItems] = useState<Transport[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Transport | null>(null);
  const [form, setForm] = useState<Partial<Transport>>(empty());
  const [saving, setSaving] = useState(false);
  const [expandedTransportId, setExpandedTransportId] = useState<string | null>(null);
  const [openTransportMenuId, setOpenTransportMenuId] = useState<string | null>(null);

  const supabase = createClient();

  const load = () => {
    supabase.from('transports').select('*').eq('trip_id', tripId).order('date').then(({ data }) => {
      setItems(data ?? []);
      setLoading(false);
    });
  };

  useEffect(() => { load(); }, [tripId]);

  const openAdd = () => { setEditing(null); setForm(empty()); setModalOpen(true); };
  const openEdit = (item: Transport) => { setEditing(item); setForm(item); setModalOpen(true); };

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
      await supabase.from('transports').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('transports').insert(payload);
    }
    setSaving(false); setModalOpen(false); load();
  };

  const handleDelete = async (item: Transport) => {
    if (!confirm('Eliminare questo trasporto?')) return;
    await supabase.from('transports').delete().eq('id', item.id);
    load();
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
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center">
            <Bus size={18} className="text-blue-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Trasporti</h1>
            <p className="text-sm text-gray-500">{items.length} {items.length === 1 ? 'trasporto' : 'trasporti'}</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary"><Plus size={15} /> Aggiungi</button>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(2)].map((_, i) => <div key={i} className="card h-20 animate-pulse bg-sand-200" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState icon={Bus} title="Nessun trasporto" description="Aggiungi treni, bus, traghetti e altri spostamenti." action={{ label: 'Aggiungi trasporto', onClick: openAdd }} />
      ) : (
        <div className="space-y-3">
          {items.map(item => (
            <div key={item.id} className="card">
              {/* Preview row */}
              <button
                type="button"
                onClick={() => {
                  setExpandedTransportId(prev => prev === item.id ? null : item.id);
                  setOpenTransportMenuId(null);
                }}
                className="w-full text-left p-3 flex items-center gap-3"
              >
                <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0 text-blue-700">
                  {TRANSPORT_ICON_KIND[item.type] === 'car' ? (
                    <TaxiCarIcon className="w-5 h-5" />
                  ) : (
                    <PublicTransportIcon className="w-5 h-5" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-900">{TYPE_LABELS[item.type]}</span>
                    {item.date && <span className="text-xs text-gray-500">· {formatDate(item.date)}</span>}
                  </div>
                  <p className="text-xs text-gray-600 mt-0.5 truncate">
                    {(item.from_location || '—')} → {(item.to_location || '—')}
                  </p>
                </div>
              </button>

              {/* Expanded details */}
              {expandedTransportId === item.id && (
                <div className="px-3 pb-3 pt-1 border-t border-sand-200 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">Partenza</p>
                      <p className="text-gray-900 font-medium mt-0.5">{item.from_location || '—'}</p>
                      {item.departure_time && <p className="text-xs text-gray-500">Ore {item.departure_time}</p>}
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">Arrivo</p>
                      <p className="text-gray-900 font-medium mt-0.5">{item.to_location || '—'}</p>
                      {item.arrival_time && <p className="text-xs text-gray-500">Ore {item.arrival_time}</p>}
                    </div>
                  </div>

                  {item.operator && (
                    <div className="text-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Operatore</p>
                      <p className="text-gray-900">{item.operator}</p>
                    </div>
                  )}

                  {item.price != null && (
                    <div className="text-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Costo</p>
                      <p className="text-primary-600 font-bold">{formatCurrency(item.price)}</p>
                    </div>
                  )}

                  {item.booking_ref && (
                    <div className="text-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Codice prenotazione</p>
                      <p className="font-mono text-gray-900">{item.booking_ref}</p>
                    </div>
                  )}

                  {item.notes && (
                    <div className="text-sm">
                      <p className="text-xs font-semibold text-gray-500 uppercase">Note</p>
                      <p className="text-gray-600 text-xs italic">{item.notes}</p>
                    </div>
                  )}

                  <TicketAttachments module="transport" tripId={tripId} recordId={item.id} />

                  <div className="flex gap-2 pt-2 border-t border-sand-100">
                    <div className="relative ml-auto">
                      <button
                        type="button"
                        onClick={() => setOpenTransportMenuId(prev => prev === item.id ? null : item.id)}
                        className="p-1 text-slate-500 hover:text-slate-700 transition-colors"
                        aria-label="Azioni trasporto"
                      >
                        <MoreVertical size={14} />
                      </button>

                      {openTransportMenuId === item.id && (
                        <div className="absolute right-0 top-8 z-20 w-32 rounded-xl border border-slate-200 bg-white shadow-elevated p-1">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenTransportMenuId(null);
                              openEdit(item);
                            }}
                            className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                          >
                            <Edit size={13} /> Modifica
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenTransportMenuId(null);
                              handleDelete(item);
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
        <Modal title={editing ? 'Modifica trasporto' : 'Aggiungi trasporto'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Tipo *</label>
                <select value={form.type ?? 'train'} onChange={e => setForm(p => ({ ...p, type: e.target.value as Transport['type'] }))} className="input">
                  {TYPES.map(t => <option key={t} value={t}>{TYPE_LABELS[t]}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Operatore</label>
                <input value={form.operator ?? ''} onChange={e => setForm(p => ({ ...p, operator: e.target.value }))} className="input" placeholder="Trenitalia" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Da</label>
                <input value={form.from_location ?? ''} onChange={e => setForm(p => ({ ...p, from_location: e.target.value }))} className="input" placeholder="Milano Centrale" />
              </div>
              <div className="form-group">
                <label className="label">A</label>
                <input value={form.to_location ?? ''} onChange={e => setForm(p => ({ ...p, to_location: e.target.value }))} className="input" placeholder="Roma Termini" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="form-group">
                <label className="label">Data</label>
                <input type="date" value={form.date ?? ''} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="input" />
              </div>
              <div className="form-group">
                <label className="label">Partenza</label>
                <input type="time" value={form.departure_time ?? ''} onChange={e => setForm(p => ({ ...p, departure_time: e.target.value }))} className="input" />
              </div>
              <div className="form-group">
                <label className="label">Arrivo</label>
                <input type="time" value={form.arrival_time ?? ''} onChange={e => setForm(p => ({ ...p, arrival_time: e.target.value }))} className="input" />
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
