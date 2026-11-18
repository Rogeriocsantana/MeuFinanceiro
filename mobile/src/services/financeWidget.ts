import {NativeModules, Platform} from 'react-native';
import {financialAgenda} from '../data/financialAgenda';
import {providerDay, type LocalBankData} from '../data/pluggyModel';
import type {Control} from '../data/localControls';

export function publishFinanceWidget(data: LocalBankData | null, controls: Control[]) {
  if (Platform.OS !== 'android') return;
  const native = NativeModules.FinanceiroThemePreferences;
  if (!native?.publishWidget) return;
  try {
    if (!data) {
      native.publishWidget('{}');
      return;
    }
    const today = providerDay(new Date().toISOString());
    const start = new Date(today + 'T12:00:00Z');
    const end = new Date(start.getTime() + 6 * 86400000).toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const agenda = financialAgenda(data, controls, month);
    const nextMonth = end.slice(0, 7);
    const rows = nextMonth === month ? agenda.rows : [...agenda.rows, ...financialAgenda(data, controls, nextMonth).rows];
    const money = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
    const entries = [...new Map(rows.map(row => [row.id, row])).values()]
      .filter(row => row.included && !row.resolved && row.date >= today && row.date <= end)
      .sort((a,b) => a.date.localeCompare(b.date))
      .slice(0, 3)
      .map(row => ({
        name: row.name,
        date: row.date.slice(5).split('-').reverse().join('/'),
        direction: row.direction === 'pay' ? 'A pagar' : 'A receber',
        amount: money.format(row.amount / 100),
      }));
    native.publishWidget(JSON.stringify({
      month: start.toLocaleDateString('pt-BR', {month: 'long', year: 'numeric', timeZone: 'UTC'}),
      pay: money.format(agenda.pay / 100),
      receive: money.format(agenda.receive / 100),
      entries,
    }));
  } catch {
    // A widget refresh must not interrupt the app or its financial synchronization.
  }
}
