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

  /* ---------- Planned payments ----------
   * Saved as JSON in Settings (key "planned"): [{ id, name, catId, amount, paidBy, every, unit, days, start, endType, endCount, endDate, done }]
   *   unit: 'once' | 'week' | 'month' | 'year'; every: 1..; days: days of the month (unit 'month');
   *   done: { 'yyyy-mm-dd': 'paid' | 'skip' }. */
  let _pCache = { raw: null, list: [] };
  function plannedList(state) {
    const raw = state.settings && state.settings.planned;
    if (raw === _pCache.raw) return _pCache.list;
    let list = [];
    try { list = Array.isArray(raw) ? raw : raw ? JSON.parse(raw) : []; } catch (e) { list = []; }
    _pCache = { raw, list: Array.isArray(list) ? list : [] };
    return _pCache.list;
  }
  const isoOf = (y, m0, d) => y + '-' + String(m0 + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  const addDaysIso = (iso, n) => { const [y, m, d] = iso.split('-').map(Number); const t = new Date(y, m - 1, d + n); return isoOf(t.getFullYear(), t.getMonth(), t.getDate()); };
  // Payment dates of one plan, oldest first, up to `to` (inclusive).
  function occurrences(p, to) {
    const out = [], start = String(p.start || ''); if (!/^\d{4}-\d{2}-\d{2}$/.test(start)) return out;
    const every = Math.max(1, num(p.every) || 1), max = p.endType === 'count' ? Math.max(1, num(p.endCount) || 1) : 600;
    const endD = p.endType === 'date' && p.endDate ? String(p.endDate) : '9999-12-31';
    const push = (iso) => { if (iso >= start && iso <= to && iso <= endD && out.length < max) out.push(iso); return out.length < max && iso <= to && iso <= endD; };
    const [sy, sm, sd] = start.split('-').map(Number);
    if (p.unit === 'once') { push(start); return out; }
    for (let k = 0, guard = 0; guard < 1200; k++, guard++) {
      let more = true;
      if (p.unit === 'week') more = push(addDaysIso(start, k * 7 * every));
      else if (p.unit === 'year') { const y = sy + k * every; more = push(isoOf(y, sm - 1, Math.min(sd, new Date(y, sm, 0).getDate()))); }
      else {
        const t = (sy * 12 + sm - 1) + k * every, y = Math.floor(t / 12), m0 = t % 12, dim = new Date(y, m0 + 1, 0).getDate();
        const days = (Array.isArray(p.days) && p.days.length ? p.days : [sd]).map(Number).sort((a, b) => a - b);
        for (const d of days) { more = push(isoOf(y, m0, Math.min(d, dim))); if (!more) break; }
        if (isoOf(y, m0, 1) > to) more = false;
      }
      if (!more) break;
    }
    return out;
  }
  // A date counts as paid if it was confirmed/skipped, or a matching spend was logged (same category, ±6 days, similar amount).
  function plannedStatus(state, idx, p, iso) {
    const d = p.done && p.done[iso]; if (d) return d;
    const amt = num(p.amount), lo = addDaysIso(iso, -6), hi = addDaysIso(iso, 6);
    const keys = [lo.slice(0, 7), hi.slice(0, 7)].filter((k, i, a) => a.indexOf(k) === i);
    for (const k of keys) for (const s of (idx.byMonth[k] || [])) {
      if (s.catId === p.catId && s.date >= lo && s.date <= hi && (!amt || Math.abs(num(s.amount) - amt) <= Math.max(1, amt * 0.12))) return 'paid';
    }
    return '';
  }
  // Open (not yet paid) planned amounts per category in a month, for this month onwards.
  function plannedOpen(state, idx, key) {
    if (key < currentMk()) return {};
    const out = {}, to = isoOf(parseMk(key).year, parseMk(key).month, daysIn(key));
    for (const p of plannedList(state)) {
      for (const iso of occurrences(p, to)) {
        if (iso.slice(0, 7) !== key || plannedStatus(state, idx, p, iso)) continue;
        out[p.catId] = (out[p.catId] || 0) + num(p.amount);
      }
    }
    return out;
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
    const open = plannedOpen(state, idx, key);
    const out = {};
    for (const cat of state.categories) {
      const acc = md.accruals && md.accruals[cat.id];
      const daily = (agg.total[cat.id] || 0) + (open[cat.id] || 0);
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
    const open = plannedOpen(state, idx, key);
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
      const spent = agg.total[cat.id] > 0 && !open[cat.id];
      if (v === 0) { attrib[cat.id] = { p1: 0, p2: 0, resp1: 0, resp2: 0 }; continue; }
      if (cat.type === 'shared') {
        sharedTotal += v;
        // Shared costs are always split by income share, whoever paid; who actually paid is kept in paid1/paid2.
        const a = { p1: v * sh1, p2: v * sh2, resp1: v * sh1, resp2: v * sh2,
          paid1: spent ? agg.byP1[cat.id] || 0 : 0, paid2: spent ? agg.byP2[cat.id] || 0 : 0 };
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
    todayIso, currentMk, buildIndex, share, aggregate, expenses, budgetFor, calcMonth,
    plannedList, occurrences, plannedStatus, plannedOpen, addDaysIso
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Calc = api;
})(typeof window !== 'undefined' ? window : this);
