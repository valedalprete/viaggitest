'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Bus, Edit, Trash2 } from 'lucide-react';
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
const TYPE_ICONS: Record<string, string> = {
  train: '🚂', bus: '🚌', ferry: '⛴️', metro: '🚇', taxi: '🚕', uber: '🚗', other: '🚌',
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
            <div key={item.id} className="card p-5 flex gap-4 items-start">
              <div className="text-2xl flex-shrink-0 mt-0.5">{TYPE_ICONS[item.type] ?? '🚌'}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="badge bg-blue-100 text-blue-700">{TYPE_LABELS[item.type]}</span>
                  {item.operator && <span className="text-sm font-medium text-gray-800">{item.operator}</span>}
                </div>
                {(item.from_location || item.to_location) && (
                  <div className="mt-1 text-sm font-medium text-gray-700">
                    {item.from_location} {item.from_location && item.to_location && '→'} {item.to_location}
                  </div>
                )}
                <div className="mt-0.5 text-xs text-gray-400 flex flex-wrap gap-3">
                  {item.date && <span>{formatDate(item.date)}</span>}
                  {item.departure_time && <span>Partenza: {item.departure_time}</span>}
                  {item.arrival_time   && <span>Arrivo: {item.arrival_time}</span>}
                  {item.price != null  && <span className="text-primary-600 font-medium">{formatCurrency(item.price)}</span>}
                  {item.booking_ref    && <span>Ref: <span className="font-mono">{item.booking_ref}</span></span>}
                </div>
                {item.notes && <p className="mt-1 text-xs text-gray-400 italic">{item.notes}</p>}
                <TicketAttachments module="transport" tripId={tripId} recordId={item.id} />
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
