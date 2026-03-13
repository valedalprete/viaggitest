import { DebtSettlement, ExpenseCategory, EXPENSE_CATEGORIES } from './types';

// =============================================
// DATE FORMATTING
// =============================================

export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'long', year: 'numeric' });
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr + (dateStr.length === 10 ? 'T00:00:00' : ''));
  return date.toLocaleDateString('it-IT', { day: '2-digit', month: 'short' });
}

export function formatDateRange(start: string, end: string): string {
  return `${formatDateShort(start)} – ${formatDateShort(end)}`;
}

export function formatDateTime(datetimeStr: string | null | undefined): string {
  if (!datetimeStr) return '—';
  const date = new Date(datetimeStr);
  return date.toLocaleString('it-IT', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function formatTime(datetimeStr: string | null | undefined): string {
  if (!datetimeStr) return '—';
  const date = new Date(datetimeStr);
  return date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
}

// =============================================
// CURRENCY
// =============================================

export function formatCurrency(amount: number | null | undefined): string {
  if (amount == null) return '—';
  return new Intl.NumberFormat('it-IT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(amount);
}

// =============================================
// TRIP HELPERS
// =============================================

export function getTripStatus(startDate: string, endDate: string): 'upcoming' | 'ongoing' | 'past' {
  const now = new Date();
  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');
  if (now < start) return 'upcoming';
  if (now > end) return 'past';
  return 'ongoing';
}

export function getCountdownText(startDate: string, endDate: string): string {
  const status = getTripStatus(startDate, endDate);
  if (status === 'ongoing') return 'In corso ✈️';
  if (status === 'past') return 'Concluso';
  const days = Math.ceil(
    (new Date(startDate + 'T00:00:00').getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)
  );
  if (days === 0) return 'Parte oggi! 🎉';
  if (days === 1) return 'Domani! 🎒';
  return `Tra ${days} giorni`;
}

export function getTripDuration(startDate: string, endDate: string): number {
  return Math.ceil(
    (new Date(endDate + 'T00:00:00').getTime() - new Date(startDate + 'T00:00:00').getTime()) /
    (1000 * 60 * 60 * 24)
  ) + 1;
}

/** Returns an array of ISO date strings for every day of the trip */
export function getDaysArray(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');
  while (current <= end) {
    days.push(current.toISOString().split('T')[0]);
    current.setDate(current.getDate() + 1);
  }
  return days;
}

// =============================================
// EXPENSE / SPLITWISE
// =============================================

export function getExpenseCategory(value: ExpenseCategory) {
  return EXPENSE_CATEGORIES.find(c => c.value === value) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];
}

interface BalanceEntry {
  participantId: string;
  name: string;
  amount: number; // positive = owed to them, negative = they owe
}

/**
 * Greedy debt-simplification algorithm (Splitwise-style).
 * Returns the minimum set of transfers to settle all debts.
 */
export function simplifyDebts(balances: BalanceEntry[]): DebtSettlement[] {
  const creditors = balances
    .filter(b => b.amount > 0.005)
    .map(b => ({ ...b }))
    .sort((a, b) => b.amount - a.amount);

  const debtors = balances
    .filter(b => b.amount < -0.005)
    .map(b => ({ ...b }))
    .sort((a, b) => a.amount - b.amount);

  const settlements: DebtSettlement[] = [];
  let ci = 0;
  let di = 0;

  while (ci < creditors.length && di < debtors.length) {
    const transfer = Math.min(creditors[ci].amount, Math.abs(debtors[di].amount));
    settlements.push({
      from: debtors[di].name,
      to: creditors[ci].name,
      fromId: debtors[di].participantId,
      toId: creditors[ci].participantId,
      amount: parseFloat(transfer.toFixed(2)),
    });
    creditors[ci].amount -= transfer;
    debtors[di].amount += transfer;
    if (Math.abs(creditors[ci].amount) < 0.005) ci++;
    if (Math.abs(debtors[di].amount) < 0.005) di++;
  }

  return settlements;
}

// =============================================
// MISC
// =============================================

export function generateId(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : Math.random().toString(36).substring(2, 11);
}

export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}
