import {NativeModules, Platform} from 'react-native';
import {financialAgenda} from '../data/financialAgenda';
import {providerDay, type LocalBankData} from '../data/pluggyModel';
import {loanInstallments, type Control} from '../data/localControls';
import {wealthSummary} from '../data/wealthSummary';

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
    const month = today.slice(0, 7);
    const agenda = financialAgenda(data, controls, month);
    const months = new Set<string>();
    const addMonths = (first: string, count: number) => {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(first)) return;
      const date = new Date(first + '-01T12:00:00Z');
      for (let i = 0; i < count; i++) {
        months.add(date.toISOString().slice(0, 7));
        date.setUTCMonth(date.getUTCMonth() + 1);
      }
    };
    addMonths(month, 4);
    for (const record of data.records) {
      if (record.kind === 'bill') addMonths(record.date.slice(0, 7), 1);
      if (record.metadata.card) addMonths(record.invoiceMonth || record.date.slice(0, 7), 1);
      for (const share of data.annotations[record.id]?.shares || []) addMonths(share.dueDate.slice(0, 7), 1);
    }
    for (const control of controls) {
      if (control.type === 'recurrences' && control.startDate) addMonths(String(control.startDate).slice(0, 7), 3);
      if (control.type === 'loans') {
        for (const part of loanInstallments(control)) addMonths(part.dueDate.slice(0, 7), 1);
      }
    }
    const upcoming = [];
    for (const candidate of [...months].filter(value => value >= month).sort()) {
      const {rows} = candidate === month ? agenda : financialAgenda(data, controls, candidate);
      upcoming.push(...rows.filter(row => row.included && !row.resolved && row.date >= today && row.date.startsWith(candidate)));
      if (upcoming.length >= 3) break;
    }
    const money = new Intl.NumberFormat('pt-BR', {style: 'currency', currency: 'BRL'});
    const entries = upcoming
      .slice(0, 3)
      .map(row => ({
        name: row.name,
        date: row.date.slice(5).split('-').reverse().join('/'),
        direction: row.direction === 'pay' ? 'A pagar' : 'A receber',
        amount: money.format(row.amount / 100),
      }));
    native.publishWidget(JSON.stringify({
      balance: money.format(wealthSummary(data, controls).available / 100),
      month: start.toLocaleDateString('pt-BR', {month: 'long', year: 'numeric', timeZone: 'UTC'}),
      pay: money.format(agenda.pay / 100),
      receive: money.format(agenda.receive / 100),
      entries,
    }));
  } catch {
    // A widget refresh must not interrupt the app or its financial synchronization.
  }
}
