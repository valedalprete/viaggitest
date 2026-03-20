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
  const toLocalIso = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const days: string[] = [];
  const current = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T00:00:00');

  while (current <= end) {
    days.push(toLocalIso(current));
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

export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export function formatRelativeTime(isoDate: string | null | undefined): string {
  if (!isoDate) return 'mai';
  const ts = new Date(isoDate).getTime();
  const diffSec = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (diffSec < 10) return 'ora';
  if (diffSec < 60) return `${diffSec}s fa`;
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min fa`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} h fa`;
  const days = Math.floor(hours / 24);
  return `${days} g fa`;
}
