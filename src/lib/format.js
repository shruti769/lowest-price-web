export const sgd = (n) => `S$${Number(n || 0).toFixed(2)}`;
export const BCRS_DEPOSIT = 0.1;
export const bcrsLabel = (p) => (p.bcrsContainerCount ? `Excl. ${sgd(BCRS_DEPOSIT)} BCRS Deposit` : '');
export const discountPercent = (p) => (p.oldPrice && p.oldPrice > p.price ? Math.round((1 - p.price / p.oldPrice) * 100) : 0);
export const formatDate = (v) =>
  new Date(v).toLocaleString('en-SG', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const slug = (s) => encodeURIComponent(s.toLowerCase().replace(/\s+/g, '-'));

export const readJSON = (key, fallback) => {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
};
export const writeJSON = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
};
