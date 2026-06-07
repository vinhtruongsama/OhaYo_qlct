const EXCHANGE_RATES = {
  usd: 25000,
  jpy: 160
};

export function parseCurrencyInput(value) {
  if (typeof value !== 'string') return Number(value);
  const normalized = value
    .trim()
    .replace(/\s/g, '')
    .replace(/[^\d.,-]/g, '');

  if (!normalized) return NaN;

  const hasComma = normalized.includes(',');
  const hasDot = normalized.includes('.');

  if (hasComma && hasDot) {
    const decimalSeparator = normalized.lastIndexOf(',') > normalized.lastIndexOf('.') ? ',' : '.';
    const thousandsSeparator = decimalSeparator === ',' ? '.' : ',';
    return Number(normalized.replaceAll(thousandsSeparator, '').replace(decimalSeparator, '.'));
  }

  if (hasComma || hasDot) {
    const separator = hasComma ? ',' : '.';
    const parts = normalized.split(separator);
    const last = parts[parts.length - 1];
    if (parts.length > 1 && last.length === 3) return Number(parts.join(''));
    return Number(normalized.replace(separator, '.'));
  }

  return Number(normalized);
}

export function toBaseCurrency(amount, currency) {
  if (currency === 'usd') return amount * EXCHANGE_RATES.usd;
  if (currency === 'jpy') return amount * EXCHANGE_RATES.jpy;
  return amount;
}

export function fromBaseCurrency(amount, currency) {
  if (currency === 'usd') return amount / EXCHANGE_RATES.usd;
  if (currency === 'jpy') return amount / EXCHANGE_RATES.jpy;
  return amount;
}

export function formatCurrencyAmount(amount, currency) {
  if (currency === 'usd') {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(fromBaseCurrency(amount, currency));
  }
  if (currency === 'jpy') {
    return new Intl.NumberFormat('ja-JP', { style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(fromBaseCurrency(amount, currency));
  }
  return `${new Intl.NumberFormat('vi-VN').format(amount)}đ`;
}

export function formatCompactCurrencyAmount(amount, currency) {
  if (currency === 'usd') {
    return new Intl.NumberFormat('en-US', { notation: 'compact', style: 'currency', currency: 'USD', maximumFractionDigits: 1 }).format(fromBaseCurrency(amount, currency));
  }
  if (currency === 'jpy') {
    return new Intl.NumberFormat('ja-JP', { notation: 'compact', style: 'currency', currency: 'JPY', maximumFractionDigits: 0 }).format(fromBaseCurrency(amount, currency));
  }
  if (amount >= 1e9) return `${(amount / 1e9).toFixed(amount % 1e9 === 0 ? 0 : 1)}B`;
  if (amount >= 1e6) return `${(amount / 1e6).toFixed(amount % 1e6 === 0 ? 0 : 1)}M`;
  if (amount >= 1e3) return `${(amount / 1e3).toFixed(amount % 1e3 === 0 ? 0 : 1)}K`;
  return `${amount}đ`;
}
