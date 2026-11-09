/* My Budget: calculations.
 * Same rules as the previous desktop app (v4), with months keyed as 'YYYY-MM'.
 *
 * Expense for a category in a month, in priority order:
 *   1. Accrual set for that month (spreads a big payment evenly)
 *   2. Sum of daily spends logged in that month
 *   3. Budget override set for that month
 *   4. The category's default budget (budgeted categories only)
 * Shared categories are split by income share; actual payer is kept for "who paid".
 */
(function (root) {
  'use strict';

  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const has = (v) => v !== undefined && v !== null && v !== '';

  /* ---------- Month keys ---------- */
  function mk(year, month0) { return year + '-' + String(month0 + 1).padStart(2, '0'); }
  function parseMk(key) { const [y, m] = key.split('-').map(Number); return { year: y, month: m - 1 }; }
  function addMonths(key, n) { const { year, month } = parseMk(key); const t = year * 12 + month + n; return mk(Math.floor(t / 12), ((t % 12) + 12) % 12); }
  function monthLabel(key) { const { year, month } = parseMk(key); return MONTHS[month] + ' ' + year; }
  function monthShort(key) { const { year, month } = parseMk(key); return MON[month] + ' ’' + String(year).slice(2); }
  function monShort(key) { return MON[parseMk(key).month]; }
  function yearMonths(year) { return Array.from({ length: 12 }, (_, m) => mk(year, m)); }
  function daysIn(key) { const { year, month } = parseMk(key); return new Date(year, month + 1, 0).getDate(); }
  function todayIso() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function currentMk() { return todayIso().slice(0, 7); }

  /* ---------- Index (rebuilt when data changes) ---------- */
  function buildIndex(state) {
    const byMonth = {};
    for (const s of state.spends) {
      const key = String(s.date || '').slice(0, 7);
      if (!key) continue;
      (byMonth[key] = byMonth[key] || []).push(s);
    }
    const cats = {};
    state.categories.forEach((c) => { cats[c.id] = c; });
    return { byMonth, cats, cache: {} };
  }

  function share(state) {
    const s1 = num(state.settings.sal1), s2 = num(state.settings.sal2);
    const t = s1 + s2;
    return t ? [s1 / t, s2 / t] : [0.5, 0.5];
  }

  function aggregate(state, idx, key) {
    const total = {}, byP1 = {}, byP2 = {};
    for (const s of idx.byMonth[key] || []) {
      const id = s.catId; if (!id) continue;
      const a = num(s.amount);
      total[id] = (total[id] || 0) + a;
      if (Number(s.paidBy) === 1) byP1[id] = (byP1[id] || 0) + a;
      else byP2[id] = (byP2[id] || 0) + a;
    }
    return { total, byP1, byP2 };
  }

  function monthData(state, key) { return state.months[key] || {}; }

  function budgetFor(state, cat, key) {
    const md = monthData(state, key);
    if (md.budgets && has(md.budgets[cat.id])) return num(md.budgets[cat.id]);
    return cat.kind === 'budgeted' ? num(cat.budget) : 0;
  }

  function expenses(state, idx, key, agg) {
    const md = monthData(state, key);
    agg = agg || aggregate(state, idx, key);
    const out = {};
    for (const cat of state.categories) {
      const acc = md.accruals && md.accruals[cat.id];
      const daily = agg.total[cat.id] || 0;
      if (has(acc)) out[cat.id] = num(acc);
      else if (daily > 0) out[cat.id] = daily;
      else if (md.budgets && has(md.budgets[cat.id])) out[cat.id] = num(md.budgets[cat.id]);
      else if (cat.kind === 'budgeted') out[cat.id] = num(cat.budget);
      else out[cat.id] = 0;
    }
    return out;
  }

  function calcMonth(state, idx, key) {
    if (idx.cache[key]) return idx.cache[key];
    const [sh1, sh2] = share(state);
    const agg = aggregate(state, idx, key);
    const exp = expenses(state, idx, key, agg);
    const md = monthData(state, key);
    const sal1 = num(has(md.income1) ? md.income1 : state.settings.sal1);
    const sal2 = num(has(md.income2) ? md.income2 : state.settings.sal2);
    const extras = Array.isArray(md.extra) ? md.extra : [];
    const extraIncome = extras.reduce((s, x) => s + num(x.amount), 0);
    const totalInc = sal1 + sal2 + extraIncome;

    let sharedTotal = 0, p1s = 0, p2s = 0, p1p = 0, p2p = 0;
    const attrib = {};
    for (const cat of state.categories) {
      const v = exp[cat.id] || 0;
      const spent = agg.total[cat.id] > 0;
      if (v === 0) { attrib[cat.id] = { p1: 0, p2: 0, resp1: 0, resp2: 0 }; continue; }
      if (cat.type === 'shared') {
        sharedTotal += v;
        const a = spent
          ? { p1: agg.byP1[cat.id] || 0, p2: agg.byP2[cat.id] || 0, resp1: v * sh1, resp2: v * sh2 }
          : { p1: v * sh1, p2: v * sh2, resp1: v * sh1, resp2: v * sh2 };
        attrib[cat.id] = a; p1s += a.p1; p2s += a.p2;
      } else if (Number(cat.owner) === 1) {
        p1p += v; attrib[cat.id] = { p1: v, p2: 0, resp1: v, resp2: 0 };
      } else if (Number(cat.owner) === 2) {
        p2p += v; attrib[cat.id] = { p1: 0, p2: v, resp1: 0, resp2: v };
      } else {
        const a = spent ? { p1: agg.byP1[cat.id] || 0, p2: agg.byP2[cat.id] || 0 } : { p1: v * sh1, p2: v * sh2 };
        a.resp1 = a.p1; a.resp2 = a.p2;
        p1p += a.p1; p2p += a.p2; attrib[cat.id] = a;
      }
    }
    const p1_total = p1s + p1p, p2_total = p2s + p2p;
    const totalExp = p1_total + p2_total;
    const savings = totalInc - totalExp;
    const actual = Object.values(agg.total).reduce((a, b) => a + b, 0);
    const res = {
      key, sal1, sal2, extras, extraIncome, totalInc, sharedTotal,
      p1_shared: p1s, p2_shared: p2s, p1_personal: p1p, p2_personal: p2p,
      p1_total, p2_total, totalExp, savings, rate: totalInc > 0 ? savings / totalInc * 100 : 0,
      sh1, sh2, exp, attrib, agg, actual, count: (idx.byMonth[key] || []).length
    };
    idx.cache[key] = res;
    return res;
  }

  const api = {
    MONTHS, MON, num, has, mk, parseMk, addMonths, monthLabel, monthShort, monShort, yearMonths, daysIn,
    todayIso, currentMk, buildIndex, share, aggregate, expenses, budgetFor, calcMonth
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : this);
