'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { ArrowLeft, Plus, Edit, Trash2, Users, Receipt, BarChart2, Loader2, MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { TripParticipant, EXPENSE_CATEGORIES } from '@/lib/types';
import { formatCurrency, formatDateShort, simplifyDebts } from '@/lib/utils';
import Modal from '@/components/Modal';
import EmptyState from '@/components/EmptyState';

type View = 'expenses' | 'summary';

// Local types matching actual DB schema
interface DbExpense {
  id: string;
  trip_id: string;
  user_id: string;
  description: string;
  amount: number;
  category: string;
  date: string | null;
  paid_by_participant_id: string | null;
  split_type: string;
  created_at: string;
}
interface DbExpenseSplit {
  id: string;
  expense_id: string;
  participant_id: string;
  user_id: string;
  owed_amount: number;
  created_at: string;
}
interface ExpenseWithSplits extends DbExpense {
  splits: DbExpenseSplit[];
}
interface DbSettlement {
  id: string;
  trip_id: string;
  user_id: string;
  from_participant_id: string;
  to_participant_id: string;
  amount: number;
  date: string | null;
  notes: string | null;
  created_at: string;
}

const PIE_COLORS = ['#f97316','#3b82f6','#8b5cf6','#22c55e','#ec4899','#ef4444','#6b7280'];

export default function ExpensesPage() {
  const { id: tripId } = useParams<{ id: string }>();
  const [view, setView] = useState<View>('expenses');
  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>([]);
  const [participants, setParticipants] = useState<TripParticipant[]>([]);
  const [loading, setLoading] = useState(true);

  const [newParticipant, setNewParticipant] = useState('');
  const [addingP, setAddingP] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ExpenseWithSplits | null>(null);
  const [saving, setSaving] = useState(false);

  const [settlements, setSettlements] = useState<DbSettlement[]>([]);
  const [settlingIds, setSettlingIds] = useState<Set<string>>(new Set());
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [expandedExpenseId, setExpandedExpenseId] = useState<string | null>(null);
  const [openExpenseMenuId, setOpenExpenseMenuId] = useState<string | null>(null);
  const [partialAmount, setPartialAmount] = useState<string>('');

  const [form, setForm] = useState<{
    description: string; amount: string; category: string; date: string;
    paid_by_id: string; split_type: 'equal' | 'exact';
    selected_ids: string[];        // participants involved in this expense
    splits: Record<string, string>; // participant_id -> owed_amount
  }>({
    description: '', amount: '', category: 'food',
    date: new Date().toISOString().slice(0, 10),
    paid_by_id: '', split_type: 'equal', selected_ids: [], splits: {},
  });

  const supabase = createClient();

  const load = async () => {
    const [{ data: exp }, { data: parts }, { data: setts }] = await Promise.all([
      supabase.from('expenses').select('*').eq('trip_id', tripId).order('date', { ascending: false }),
      supabase.from('trip_participants').select('*').eq('trip_id', tripId).order('name'),
      supabase.from('debt_settlements').select('*').eq('trip_id', tripId).order('date', { ascending: false }),
    ]);
    setSettlements(setts ?? []);
    const expList: DbExpense[] = exp ?? [];
    if (expList.length > 0) {
      const ids = expList.map(e => e.id);
      const { data: splits } = await supabase.from('expense_splits').select('*').in('expense_id', ids);
      const splitMap: Record<string, DbExpenseSplit[]> = {};
      (splits ?? []).forEach((s: DbExpenseSplit) => {
        if (!splitMap[s.expense_id]) splitMap[s.expense_id] = [];
        splitMap[s.expense_id].push(s);
      });
      setExpenses(expList.map(e => ({ ...e, splits: splitMap[e.id] ?? [] })));
    } else {
      setExpenses([]);
    }
    setParticipants(parts ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [tripId]);

  const participantName = (id: string | null) => participants.find(p => p.id === id)?.name ?? '?';

  const addParticipant = async () => {
    if (!newParticipant.trim()) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setAddingP(true);
    await supabase.from('trip_participants').insert({ trip_id: tripId, name: newParticipant.trim(), user_id: user.id });
    setNewParticipant('');
    setAddingP(false);
    load();
  };

  const removeParticipant = async (p: TripParticipant) => {
    if (!confirm(`Rimuovere ${p.name}?`)) return;
    await supabase.from('trip_participants').delete().eq('id', p.id);
    load();
  };

  const initSplits = () => {
    const s: Record<string, string> = {};
    participants.forEach(p => { s[p.id] = ''; });
    return s;
  };

  const openAdd = () => {
    setEditing(null);
    setForm({
      description: '', amount: '', category: 'food',
      date: new Date().toISOString().slice(0, 10),
      paid_by_id: participants[0]?.id ?? '',
      split_type: 'equal',
      selected_ids: participants.map(p => p.id),
      splits: initSplits(),
    });
    setModalOpen(true);
  };

  const openEdit = (exp: ExpenseWithSplits) => {
    setEditing(exp);
    const s: Record<string, string> = {};
    participants.forEach(p => {
      const split = exp.splits.find(sp => sp.participant_id === p.id);
      s[p.id] = split ? String(split.owed_amount) : '';
    });
    // selected = participants that have a split; fall back to all if no splits recorded
    const selectedFromSplits = exp.splits.map(sp => sp.participant_id);
    setForm({
      description: exp.description, amount: String(exp.amount),
      category: exp.category, date: exp.date ?? '',
      paid_by_id: exp.paid_by_participant_id ?? '',
      split_type: exp.split_type as 'equal' | 'exact',
      selected_ids: selectedFromSplits.length > 0 ? selectedFromSplits : participants.map(p => p.id),
      splits: s,
    });
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.selected_ids.length === 0) return;
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }
    const amount = parseFloat(form.amount);

    let splitsData: { participant_id: string; owed_amount: number; user_id: string }[] = [];
    const selectedParticipants = participants.filter(p => form.selected_ids.includes(p.id));
    if (form.split_type === 'equal' && selectedParticipants.length > 0) {
      const totalCents = Math.round(amount * 100);
      const baseCents = Math.floor(totalCents / selectedParticipants.length);
      const extraCents = totalCents - baseCents * selectedParticipants.length;
      splitsData = selectedParticipants.map((p, i) => ({
        participant_id: p.id,
        owed_amount: parseFloat(((baseCents + (i < extraCents ? 1 : 0)) / 100).toFixed(2)),
        user_id: user.id,
      }));
    } else {
      splitsData = Object.entries(form.splits)
        .filter(([pid, v]) => form.selected_ids.includes(pid) && v !== '' && !isNaN(parseFloat(v)))
        .map(([pid, val]) => ({ participant_id: pid, owed_amount: parseFloat(val), user_id: user.id }));
    }

    const payload = {
      trip_id: tripId, user_id: user.id, description: form.description,
      amount, category: form.category, date: form.date || null,
      paid_by_participant_id: form.paid_by_id || null, split_type: form.split_type,
    };

    let expenseId: string;
    if (editing) {
      await supabase.from('expenses').update(payload).eq('id', editing.id);
      await supabase.from('expense_splits').delete().eq('expense_id', editing.id);
      expenseId = editing.id;
    } else {
      const { data } = await supabase.from('expenses').insert(payload).select().single();
      expenseId = data!.id;
    }

    if (splitsData.length > 0) {
      await supabase.from('expense_splits').insert(splitsData.map(s => ({ ...s, expense_id: expenseId })));
    }

    setSaving(false); setModalOpen(false); load();
  };

  const openSettle = (key: string, defaultAmount: number) => {
    if (expandedKey === key) {
      setExpandedKey(null);
    } else {
      setExpandedKey(key);
      setPartialAmount(defaultAmount.toFixed(2));
    }
  };

  const confirmSettle = async (fromId: string, toId: string, maxAmount: number) => {
    const amt = parseFloat(partialAmount);
    if (isNaN(amt) || amt <= 0 || amt > maxAmount + 0.001) return;
    const key = `${fromId}-${toId}`;
    setSettlingIds(prev => new Set(prev).add(key));
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('debt_settlements').insert({
        trip_id: tripId,
        user_id: user.id,
        from_participant_id: fromId,
        to_participant_id: toId,
        amount: parseFloat(amt.toFixed(2)),
        date: new Date().toISOString().slice(0, 10),
        notes: null,
      });
    }
    setSettlingIds(prev => { const s = new Set(prev); s.delete(key); return s; });
    setExpandedKey(null);
    load();
  };

  const deleteSettlement = async (s: DbSettlement) => {
    if (!confirm('Eliminare questo rimborso?')) return;
    await supabase.from('debt_settlements').delete().eq('id', s.id);
    load();
  };

  const deleteAllSettlements = async () => {
    if (!confirm('Eliminare TUTTI i rimborsi registrati? Questa azione non è reversibile.')) return;
    await supabase.from('debt_settlements').delete().eq('trip_id', tripId);
    load();
  };

  const handleDelete = async (exp: DbExpense) => {
    if (!confirm('Eliminare questa spesa?')) return;
    await supabase.from('expense_splits').delete().eq('expense_id', exp.id);
    await supabase.from('expenses').delete().eq('id', exp.id);
    load();
  };

  // Summary calculations
  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);

  const byCategory = EXPENSE_CATEGORIES.map((cat, i) => ({
    name: cat.label,
    value: expenses.filter(e => e.category === cat.value).reduce((s, e) => s + Number(e.amount), 0),
    color: PIE_COLORS[i % PIE_COLORS.length],
    id: cat.value,
  })).filter(c => c.value > 0);

  // Build balances for debt simplification
  const balances = participants.map(p => {
    const paid = expenses.filter(e => e.paid_by_participant_id === p.id).reduce((s, e) => s + Number(e.amount), 0);
    const owed = expenses.reduce((s, e) => {
      return s + e.splits
        .filter(sp => sp.participant_id === p.id)
        .reduce((ss, sp) => ss + Number(sp.owed_amount), 0);
    }, 0);
    return { participantId: p.id, name: p.name, amount: paid - owed };
  });

  const spendByPerson = participants.map(p => {
    const totalShare = expenses.reduce((sum, e) => {
      return sum + e.splits
        .filter(sp => sp.participant_id === p.id)
        .reduce((s, sp) => s + Number(sp.owed_amount), 0);
    }, 0);
    return {
      participantId: p.id,
      name: p.name,
      totalShare,
    };
  });

  // Raw debts from expenses (no settlements applied)
  const rawDebts = simplifyDebts(balances);

  // Adjust balances by settlements BEFORE simplifying so debts are re-routed correctly
  const adjustedBalances = balances.map(b => {
    const sent = settlements
      .filter(s => s.from_participant_id === b.participantId)
      .reduce((sum, s) => sum + Number(s.amount), 0);
    const received = settlements
      .filter(s => s.to_participant_id === b.participantId)
      .reduce((sum, s) => sum + Number(s.amount), 0);
    return { ...b, amount: parseFloat((b.amount + sent - received).toFixed(2)) };
  });

  const remainingDebts = simplifyDebts(adjustedBalances);

  const catLabel = (v: string) => EXPENSE_CATEGORIES.find(c => c.value === v)?.label ?? v;

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
          <div className="w-10 h-10 rounded-xl bg-orange-100 flex items-center justify-center">
            <Receipt size={18} className="text-orange-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Spese</h1>
            <p className="text-sm text-gray-500">Totale: {formatCurrency(total)}</p>
          </div>
        </div>
        <button onClick={openAdd} disabled={participants.length === 0} className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed">
          <Plus size={15} /> Aggiungi spesa
        </button>
      </div>

      {/* Participants */}
      <div className="card p-5 mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-gray-500" />
          <span className="font-semibold text-sm text-gray-700">Partecipanti</span>
        </div>
        <div className="flex flex-wrap gap-2 mb-3">
          {participants.map(p => (
            <span key={p.id} className="flex items-center gap-1.5 bg-gray-100 rounded-full px-3 py-1 text-sm font-medium">
              {p.name}
              <button onClick={() => removeParticipant(p)} className="text-gray-400 hover:text-red-500 ml-0.5">×</button>
            </span>
          ))}
          {participants.length === 0 && <p className="text-xs text-gray-400">Aggiungi almeno un partecipante per registrare le spese</p>}
        </div>
        <div className="flex gap-2">
          <input
            value={newParticipant}
            onChange={e => setNewParticipant(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addParticipant())}
            className="input flex-1 h-9 text-sm"
            placeholder="Nome partecipante..."
          />
          <button onClick={addParticipant} disabled={addingP || !newParticipant.trim()} className="btn-primary h-9 px-3 py-0 text-sm">
            <Plus size={14} /> Aggiungi
          </button>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-2 mb-6">
        <button onClick={() => setView('expenses')} className={`tab-btn ${view === 'expenses' ? 'tab-btn-active' : 'tab-btn-inactive'}`}>
          <Receipt size={14} /> Spese
        </button>
        <button onClick={() => setView('summary')} className={`tab-btn ${view === 'summary' ? 'tab-btn-active' : 'tab-btn-inactive'}`}>
          <BarChart2 size={14} /> Riepilogo
        </button>
      </div>

      {view === 'expenses' && (
        loading ? (
          <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="card h-16 animate-pulse bg-sand-200" />)}</div>
        ) : expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="Nessuna spesa"
            description={participants.length === 0 ? 'Aggiungi prima i partecipanti' : 'Registra la prima spesa del viaggio'}
            action={participants.length > 0 ? { label: 'Aggiungi spesa', onClick: openAdd } : undefined}
          />
        ) : (
          <div className="space-y-3">
            {expenses.map(exp => (
              <div key={exp.id} className="card p-3">
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedExpenseId(prev => prev === exp.id ? null : exp.id);
                      setOpenExpenseMenuId(null);
                    }}
                    className="flex-1 min-w-0 text-left"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-gray-700 truncate pr-2">{exp.description}</span>
                      <span className="text-base font-bold text-primary-600 flex-shrink-0">{formatCurrency(Number(exp.amount))}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {exp.date ? formatDateShort(exp.date) : '—'}
                      {exp.paid_by_participant_id ? ` · Pagato da ${participantName(exp.paid_by_participant_id)}` : ''}
                    </p>
                  </button>

                  <div className="relative flex-shrink-0">
                    <button
                      type="button"
                      onClick={() => setOpenExpenseMenuId(prev => prev === exp.id ? null : exp.id)}
                      className="p-1 text-slate-500 hover:text-slate-700 transition-colors"
                      aria-label="Azioni spesa"
                    >
                      <MoreVertical size={14} className="text-slate-600" />
                    </button>

                    {openExpenseMenuId === exp.id && (
                      <div className="absolute right-0 top-9 z-20 w-36 rounded-xl border border-slate-200 bg-white shadow-elevated p-1">
                        <button
                          type="button"
                          onClick={() => {
                            setOpenExpenseMenuId(null);
                            openEdit(exp);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 flex items-center gap-2"
                        >
                          <Edit size={13} /> Modifica
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setOpenExpenseMenuId(null);
                            handleDelete(exp);
                          }}
                          className="w-full text-left px-2.5 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Trash2 size={13} /> Elimina
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {expandedExpenseId === exp.id && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2">
                    <p className="text-xs text-gray-500">Categoria: <span className="font-medium text-gray-700">{catLabel(exp.category)}</span></p>
                    {exp.splits.length > 0 ? (
                      <div className="space-y-1.5">
                        {exp.splits.map(s => (
                          <div key={s.id} className="flex items-center justify-between text-sm">
                            <span className="text-gray-700">{participantName(s.participant_id)}</span>
                            <span className="font-semibold text-gray-900">{formatCurrency(Number(s.owed_amount))}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-gray-400">Nessuna ripartizione disponibile.</p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      )}

      {view === 'summary' && (
        <div>
          {expenses.length === 0 ? (
            <EmptyState icon={BarChart2} title="Nessuna spesa" description="Aggiungi spese per vedere il riepilogo" />
          ) : (
            <>
            {/* Spend per person */}
            <div className="card overflow-hidden mb-4">
              <div className="px-5 pt-4 pb-3 border-b border-sand-200">
                <h3 className="font-semibold text-gray-800 text-sm">Spesa per persona</h3>
                <p className="text-xs text-gray-400 mt-0.5">Quota totale personale calcolata dalle ripartizioni delle spese</p>
              </div>
              <div className="divide-y divide-sand-100">
                {spendByPerson.map(person => {
                  return (
                    <div key={person.participantId} className="flex items-center gap-3 px-5 py-3">
                      <span className="text-sm font-semibold text-gray-800 flex-1 truncate">{person.name}</span>
                      <span className="text-sm font-bold text-gray-900 flex-shrink-0">
                        {formatCurrency(person.totalShare)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="card overflow-hidden">
              {/* Header */}
              <div className="px-5 pt-5 pb-4 border-b border-sand-200">
                <h3 className="font-semibold text-gray-800">Chi deve a chi</h3>
                <p className="text-xs text-gray-400 mt-0.5">
                  {remainingDebts.length > 0
                    ? 'Clicca su una voce per registrare un rimborso (anche parziale)'
                    : 'Tutti i conti sono in pari 🎉'}
                </p>
              </div>

              {/* Fully-settled debts */}
              {rawDebts.length > 0 && remainingDebts.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <span className="text-4xl">🎉</span>
                  <p className="mt-3 font-semibold text-green-600">Tutti i debiti sono saldati!</p>
                  <p className="text-xs text-gray-400 mt-1">Totale spese: {formatCurrency(total)}</p>
                </div>
              ) : rawDebts.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <span className="text-4xl">🎉</span>
                  <p className="mt-3 font-semibold text-green-600">Nessun debito</p>
                  <p className="text-xs text-gray-400 mt-1">Totale spese: {formatCurrency(total)}</p>
                </div>
              ) : (
                <div className="divide-y divide-sand-200">
                  {remainingDebts.map((d, i) => {
                    const key = `${d.fromId}-${d.toId}`;
                    const isSettling = settlingIds.has(key);
                    const isExpanded = expandedKey === key;
                    const partialAmt = parseFloat(partialAmount);
                    const isValid = !isNaN(partialAmt) && partialAmt > 0 && partialAmt <= d.amount + 0.001;
                    return (
                      <div key={i}>
                        <button
                          onClick={() => openSettle(key, d.amount)}
                          disabled={isSettling}
                          className={`w-full flex items-center gap-3 px-5 py-4 text-left transition-colors ${isExpanded ? 'bg-green-50' : 'hover:bg-sand-50'}`}
                        >
                          <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                            isExpanded ? 'border-green-500 bg-green-100' : 'border-sand-300'
                          }`}>
                            {isSettling
                              ? <Loader2 size={13} className="animate-spin text-gray-400" />
                              : isExpanded
                                ? <span className="text-green-600 text-xs font-bold">✕</span>
                                : null}
                          </div>
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-bold text-gray-900">{d.from}</span>
                            <span className="text-xs text-gray-400 mx-1.5">deve a</span>
                            <span className="text-sm font-bold text-gray-900">{d.to}</span>
                          </div>
                          <span className="font-bold text-primary-700 text-sm flex-shrink-0">{formatCurrency(d.amount)}</span>
                        </button>

                        {isExpanded && (
                          <div className="px-5 pb-4 pt-2 bg-green-50 border-t border-green-100">
                            <p className="text-xs text-gray-500 mb-2">Quanto ha rimborsato?</p>
                            <div className="flex items-center gap-2">
                              <input
                                type="number" step="0.01" min="0.01" max={d.amount.toFixed(2)}
                                value={partialAmount}
                                onChange={e => setPartialAmount(e.target.value)}
                                autoFocus
                                className="input h-9 text-sm w-32"
                              />
                              <span className="text-sm text-gray-400">€</span>
                              <button
                                onClick={() => setPartialAmount(d.amount.toFixed(2))}
                                className="text-xs px-2.5 py-1.5 bg-white border border-sand-300 hover:bg-sand-100 rounded-lg text-gray-600 transition-colors"
                              >
                                Tutto ({formatCurrency(d.amount)})
                              </button>
                              <button
                                onClick={() => confirmSettle(d.fromId, d.toId, d.amount)}
                                disabled={!isValid || isSettling}
                                className="ml-auto flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg transition-colors"
                              >
                                {isSettling && <Loader2 size={13} className="animate-spin" />}
                                Salda
                              </button>
                            </div>
                            {!isNaN(partialAmt) && partialAmt > 0 && partialAmt < d.amount - 0.005 && (
                              <p className="text-xs text-amber-600 mt-2">
                                Rimane ancora {formatCurrency(d.amount - partialAmt)} da saldare
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Settlements log — only if there are any */}
              {settlements.length > 0 && (
                <>
                  <div className="px-5 py-3 border-t border-sand-200 bg-sand-50 flex items-center justify-between">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Rimborsi già registrati</p>
                    <button onClick={deleteAllSettlements} className="text-xs text-red-400 hover:text-red-600 transition-colors">Cancella tutti</button>
                  </div>
                  <div className="divide-y divide-sand-200">
                    {settlements.map(s => (
                      <div key={s.id} className="flex items-center gap-3 px-5 py-3">
                        <div className="w-5 h-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                          <span className="text-green-600 text-xs">✓</span>
                        </div>
                        <div className="flex-1 min-w-0 text-sm">
                          <span className="font-semibold text-gray-700">{participantName(s.from_participant_id)}</span>
                          <span className="text-gray-400 mx-1">→</span>
                          <span className="font-semibold text-gray-700">{participantName(s.to_participant_id)}</span>
                          {s.date && <span className="ml-2 text-xs text-gray-400">{formatDateShort(s.date)}</span>}
                        </div>
                        <span className="text-sm font-bold text-green-600">{formatCurrency(Number(s.amount))}</span>
                        <button onClick={() => deleteSettlement(s)} title="Annulla" className="p-1 rounded text-gray-300 hover:text-red-400 hover:bg-red-50"><Trash2 size={13} /></button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            </>
          )}
        </div>
      )}

      {modalOpen && (
        <Modal title={editing ? 'Modifica spesa' : 'Nuova spesa'} onClose={() => setModalOpen(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="form-group">
              <label className="label">Descrizione *</label>
              <input value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} className="input" placeholder="Cena al ristorante" required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Importo (€) *</label>
                <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))} className="input" placeholder="42.00" required />
              </div>
              <div className="form-group">
                <label className="label">Data</label>
                <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className="input" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="form-group">
                <label className="label">Categoria</label>
                <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className="input">
                  {EXPENSE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.icon} {c.label}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="label">Pagato da *</label>
                <select value={form.paid_by_id} onChange={e => setForm(p => ({ ...p, paid_by_id: e.target.value }))} className="input" required>
                  <option value="">Seleziona...</option>
                  {participants.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>
            {/* Chi partecipa */}
            <div className="form-group">
              <label className="label">Chi partecipa *</label>
              <div className="flex flex-wrap gap-2">
                {participants.map(p => {
                  const active = form.selected_ids.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setForm(prev => ({
                        ...prev,
                        selected_ids: active
                          ? prev.selected_ids.filter(id => id !== p.id)
                          : [...prev.selected_ids, p.id],
                      }))}
                      className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                        active
                          ? 'bg-primary-800 text-white border-primary-800'
                          : 'bg-sand-100 text-gray-400 border-sand-300 hover:border-gray-400'
                      }`}
                    >
                      {active ? '✓ ' : ''}{p.name}
                    </button>
                  );
                })}
              </div>
              {form.selected_ids.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Seleziona almeno un partecipante</p>
              )}
              {form.split_type === 'equal' && form.selected_ids.length > 0 && form.amount && (
                <p className="text-xs text-gray-400 mt-1.5">
                  {formatCurrency(parseFloat(form.amount) / form.selected_ids.length)} a testa ({form.selected_ids.length} persone)
                </p>
              )}
            </div>

            <div className="form-group">
              <label className="label">Divisione</label>
              <div className="flex gap-3">
                {(['equal', 'exact'] as const).map(t => (
                  <label key={t} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" checked={form.split_type === t} onChange={() => setForm(p => ({ ...p, split_type: t }))} className="accent-primary-600" />
                    <span className="text-sm">{t === 'equal' ? '⚖️ Uguale' : '✏️ Personalizzata'}</span>
                  </label>
                ))}
              </div>
            </div>
            {form.split_type === 'exact' && form.selected_ids.length > 0 && (
              <div className="space-y-2">
                <label className="label">Importi per persona</label>
                {participants.filter(p => form.selected_ids.includes(p.id)).map(p => (
                  <div key={p.id} className="flex items-center gap-2">
                    <span className="text-sm w-28 text-gray-700">{p.name}</span>
                    <input
                      type="number" step="0.01" min="0"
                      value={form.splits[p.id] ?? ''}
                      onChange={e => setForm(prev => ({ ...prev, splits: { ...prev.splits, [p.id]: e.target.value } }))}
                      className="input flex-1 h-8 text-sm"
                      placeholder="0.00"
                    />
                    <span className="text-sm text-gray-400">€</span>
                  </div>
                ))}
                <div className="text-xs text-right text-gray-400">
                  Totale: {formatCurrency(form.selected_ids.reduce((s, id) => s + (parseFloat(form.splits[id] ?? '') || 0), 0))}
                  {' / '}{formatCurrency(parseFloat(form.amount) || 0)}
                </div>
              </div>
            )}
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
