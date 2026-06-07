import { toBaseCurrency } from '../../utils/currency.js';

export function createLocalTransaction({ note, category, date, rawAmount, type, currency }) {
  return {
    id: `t_${Date.now()}`,
    note,
    category,
    date,
    amount: toBaseCurrency(rawAmount, currency),
    type
  };
}
