// Database abstraction layer - works in Electron environment
const db = {
  async query(sql, params = [], method = 'all') {
    if (window.electronAPI) {
      return window.electronAPI.dbQuery({ sql, params, method });
    }
    // Fallback for browser testing
    console.log('DB Query (browser mode):', sql, params);
    return [];
  },
  
  async run(sql, params = []) {
    return this.query(sql, params, 'run');
  },
  
  async get(sql, params = []) {
    return this.query(sql, params, 'get');
  },
  
  async all(sql, params = []) {
    return this.query(sql, params, 'all');
  }
};

export default db;

const CURRENCY_MOJIBAKE_MAP = {
  'â‚¹': '\u20B9',
  'â‚¬': '\u20AC',
  'Â£': '\u00A3',
  'Â¥': '\u00A5'
};

export function sanitizeCurrencySymbol(symbol) {
  const raw = `${symbol ?? ''}`.trim();
  if (!raw) return '\u20B9';
  if (CURRENCY_MOJIBAKE_MAP[raw]) return CURRENCY_MOJIBAKE_MAP[raw];
  if (['\u20B9', '$', '\u20AC', '\u00A3', '\u00A5', 'Rs.', 'Rs'].includes(raw)) return raw === 'Rs' ? 'Rs.' : raw;
  if (/^[A-Za-z]{1,4}$/.test(raw)) return raw;
  if (raw.includes('â‚')) return '\u20B9';
  if (raw.includes('Â£')) return '\u00A3';
  if (raw.includes('â‚¬')) return '\u20AC';
  return raw;
}

// UUID generator
export function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : ((r & 0x3) | 0x8);
    return v.toString(16);
  });
}

// Format currency
export function formatCurrency(amount, symbol = '\u20B9') {
  const safeSymbol = sanitizeCurrencySymbol(symbol);
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount)) return `${safeSymbol}0.00`;
  return `${safeSymbol}${numericAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Format date
export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// Generate document number
export function generateDocNumber(prefix, sequence) {
  const year = new Date().getFullYear().toString().slice(-2);
  const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
  return `${prefix}-${year}${month}-${sequence.toString().padStart(4, '0')}`;
}

// Get next sequence number
export async function getNextSequence(table, numberField, prefix) {
  try {
    const result = await db.get(
      `SELECT ${numberField} FROM ${table} ORDER BY created_at DESC LIMIT 1`
    );
    if (result && result[numberField]) {
      const parts = result[numberField].split('-');
      const lastNum = parseInt(parts[parts.length - 1]) || 0;
      return lastNum + 1;
    }
    return 1;
  } catch {
    return 1;
  }
}
