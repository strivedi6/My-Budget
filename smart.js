/* My Budget — smart budgets and spending suggestions.
 *
 * Smart budgets learn each category's budget from past months:
 *   - fixed bills paid every month: the latest amount;
 *   - bills paid now and then (e.g. a rent cheque): their monthly share, to set aside;
 *   - must-haves: the usual spend (6-month average, recent months count more);
 *   - optional spending: 10% below the usual, as a gentle savings goal.
 * When "Follow smart budgets" is on, the current month's budgets are set and kept up to date
 * automatically (unless someone edits that month's budgets by hand). Next month is previewed,
 * using this month's pace too, and is applied when it starts.
 *
 * Suggestions look at what each person paid for themselves and spot things worth changing.
 */
(function (root) {
  const C = root.Calc;
  const num = C.num;
  const HIST = 6;              // months of history to learn from
  const OPTIONAL_STRETCH = 0.9;

  const roundUp = (v) => {
    if (v <= 0) return 0;
    const step = v < 200 ? 10 : v < 1000 ? 25 : 50;
    return Math.ceil(v / step) * step;
  };

  // Months with any spending, before `beforeMk` and already finished.
  function historyMonths(state, idx, beforeMk) {
    const cur = C.currentMk();
    return Object.keys(idx.byMonth).filter((k) => k < beforeMk && k < cur && (idx.byMonth[k] || []).length).sort().slice(-HIST);
  }

  // What a category really cost in a month: a spread payment if one was set, otherwise logged spends.
  function actual(state, idx, cat, mk) {
    const md = state.months[mk] || {};
    if (md.accruals && C.has(md.accruals[cat.id])) return num(md.accruals[cat.id]);
    const agg = C.aggregate(state, idx, mk);
    return agg.total[cat.id] || 0;
  }

  // How far through the current month we are (0..1).
  function elapsed(mk) {
    const cur = C.currentMk();
    if (mk < cur) return 1;
    if (mk > cur) return 0;
    return Math.min(1, new Date().getDate() / C.daysIn(mk));
  }

  /* Learn suggested budgets for `targetMk`.
   * With withPace, this month's spending so far (scaled to a full month) counts as the latest month
   * for everyday categories, once at least half the month has gone. */
  function learn(state, idx, targetMk, withPace) {
    const months = historyMonths(state, idx, targetMk);
    const cur = C.currentMk(), frac = elapsed(cur);
    const usePace = withPace && targetMk > cur && frac >= 0.5;
    const rows = state.categories.map((cat) => {
      const hist = months.map((k) => actual(state, idx, cat, k));
      if (usePace && cat.group !== 'fixed') hist.push(actual(state, idx, cat, cur) / frac);
      const n = hist.length;
      const paid = hist.filter((v) => v > 0);
      const mean = n ? hist.reduce((a, b) => a + b, 0) / n : 0;
      let wsum = 0, wtot = 0;
      hist.forEach((v, i) => { wsum += v * (i + 1); wtot += i + 1; });
      const wavg = wtot ? wsum / wtot : 0;
      const recent = hist.slice(-3), older = hist.slice(0, -3);
      const ra = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      const oa = older.length ? older.reduce((a, b) => a + b, 0) / older.length : 0;
      const trend = oa > 0 && n >= 4 ? (ra - oa) / oa : 0;
      const regular = n > 0 && paid.length >= Math.max(1, Math.ceil(n * 0.6));
      let raw = 0, why = '', kind = '';
      if (!paid.length) { raw = 0; kind = 'none'; why = 'No spending yet'; }
      else if (cat.group === 'fixed' && regular) {
        raw = [...hist].reverse().find((v) => v > 0); kind = 'fixed'; why = 'Fixed bill · latest amount';
      } else if (!regular && paid.length <= Math.ceil(n / 3)) {
        raw = mean; kind = 'lumpy'; why = 'Paid now and then · set aside monthly';
      } else if (cat.group === 'optional') {
        raw = wavg * OPTIONAL_STRETCH; kind = 'optional'; why = '10% below your usual, to save more';
      } else {
        raw = wavg; kind = 'usual'; why = 'Your usual spend';
      }
      const steady = older.filter((v) => v > 0).length >= 2 && recent.filter((v) => v > 0).length >= 2;
      if ((kind === 'usual' || kind === 'optional') && steady && Math.abs(trend) >= 0.15 && Math.abs(trend) <= 1.5) why += ' · trending ' + (trend > 0 ? 'up ' : 'down ') + Math.round(Math.abs(trend) * 100) + '%';
      return { cat, hist, avg: mean, wavg, trend, kind, why, suggested: roundUp(raw), current: C.budgetFor(state, cat, targetMk) };
    });
    const total = rows.reduce((a, r) => a + r.suggested, 0);
    return { months, usedPace: usePace, rows, total };
  }

  // The budgets object written into a month when smart budgets are followed.
  function budgetsFor(learned) {
    const b = { _smart: 1 };
    learned.rows.forEach((r) => { if (r.suggested > 0) b[r.cat.id] = r.suggested; });
    return b;
  }
  const isAuto = (md) => { const b = (md && md.budgets) || {}; return !Object.keys(b).length || !!b._smart; };
  const same = (a, b) => {
    const ka = Object.keys(a).filter((k) => k !== '_smart'), kb = Object.keys(b || {}).filter((k) => k !== '_smart');
    if (ka.length !== kb.length) return false;
    return ka.every((k) => Math.abs(num(a[k]) - num(b[k])) < 0.5);
  };
  // The full month row to save, keeping income, extras and spread payments as they are.
  function monthRow(state, mk, budgets) {
    const md = state.months[mk] || {};
    return { month: mk, income1: C.has(md.income1) ? md.income1 : '', income2: C.has(md.income2) ? md.income2 : '',
      extra: Array.isArray(md.extra) ? md.extra : [], budgets, accruals: md.accruals || {} };
  }

  /* ---------------- Suggestions for one person ---------------- */
  const DELIVERY = /talabat|deliveroo|careem\s*food|noon\s*food|zomato|instashop|smiles|keeta/i;
  const fmt = (v) => Math.round(v).toLocaleString('en-AE');

  function tips(state, idx, p) {
    const cur = C.currentMk(), frac = Math.max(elapsed(cur), 1 / 31);
    const past = historyMonths(state, idx, cur).slice(-3);
    const cats = {}; state.categories.forEach((c) => { cats[c.id] = c; });
    const mine = (s) => Number(s.paidBy) === p;
    const spendsIn = (k) => (idx.byMonth[k] || []).filter(mine);
    const out = [];
    const nm = (id) => (cats[id] ? cats[id].name : 'Other');

    // Their spending per category: this month (paced to a full month) vs their recent usual.
    const byCat = (list) => list.reduce((m, s) => { m[s.catId] = (m[s.catId] || 0) + num(s.amount); return m; }, {});
    const now = byCat(spendsIn(cur));
    const usual = {};
    past.forEach((k) => { const m = byCat(spendsIn(k)); Object.keys(m).forEach((id) => { usual[id] = (usual[id] || 0) + m[id] / past.length; }); });
    if (past.length && frac >= 0.25) {
      Object.keys(now).forEach((id) => {
        const c = cats[id]; if (!c || c.group === 'fixed') return;
        const paced = now[id] / frac, u = usual[id] || 0;
        if (u > 0 && paced > u * 1.2 && paced - u > 100) {
          out.push({ cat: id, icon: 'trending', tone: 'warn', save: paced - u, title: nm(id) + ' is running ' + Math.round((paced / u - 1) * 100) + '% above your usual',
            text: 'At this pace it ends the month near AED ' + fmt(paced) + ' against a usual AED ' + fmt(u) + '. Slowing down for the rest of the month keeps about AED ' + fmt(paced - u) + '.' });
        }
      });
    }

    // Last 30 days of their spending.
    const since = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
    const recent = state.spends.filter((s) => mine(s) && String(s.date) >= since);

    // Food delivery and other frequent merchants in everyday/optional categories.
    const byMerchant = {};
    recent.forEach((s) => {
      const c = cats[s.catId]; if (!c || c.group === 'fixed') return;
      const key = String(s.merchant || '').toLowerCase().replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim().split(' ').slice(0, 2).join(' ');
      if (!key) return;
      const m = byMerchant[key] || (byMerchant[key] = { name: String(s.merchant).replace(/\s+\S*\d\S*.*$/, '').trim() || s.merchant, n: 0, total: 0, delivery: false, cat: s.catId });
      m.n++; m.total += num(s.amount); if (DELIVERY.test(s.merchant)) m.delivery = true;
    });
    const freq = Object.values(byMerchant).filter((m) => m.n >= 5 && m.total >= 150).sort((a, b) => b.total - a.total).slice(0, 2);
    freq.forEach((m) => {
      const save = m.total * (m.delivery ? 0.4 : 0.25);
      out.push({ icon: m.delivery ? 'utensils' : 'receipt', tone: 'info', save,
        title: (m.delivery ? 'Food delivery: ' : '') + m.n + ' orders from ' + m.name + ' in 30 days',
        text: 'That came to AED ' + fmt(m.total) + '. ' + (m.delivery ? 'Cooking or picking up a few of those each week' : 'Cutting a quarter of these visits') + ' saves about AED ' + fmt(save) + ' a month.' });
    });

    // Lots of small purchases.
    const small = recent.filter((s) => num(s.amount) > 0 && num(s.amount) < 30 && cats[s.catId] && cats[s.catId].group !== 'fixed');
    const smallTotal = small.reduce((a, s) => a + num(s.amount), 0);
    if (small.length >= 12 && smallTotal >= 200) {
      out.push({ icon: 'coins', tone: 'info', save: smallTotal * 0.35,
        title: small.length + ' small purchases under AED 30 added up to AED ' + fmt(smallTotal),
        text: 'Coffees, snacks and quick buys add up. Skipping about a third of them saves around AED ' + fmt(smallTotal * 0.35) + ' a month.' });
    }

    // Repeating payments (subscriptions): same merchant in at least 3 of the last 4 months.
    const months4 = past.concat(cur).slice(-4);
    const rec = {};
    months4.forEach((k) => spendsIn(k).forEach((s) => {
      const key = String(s.merchant || '').toLowerCase().replace(/[^a-z]/g, '').slice(0, 14); if (!key) return;
      const c = cats[s.catId]; if (!c || c.group === 'fixed') return;
      const r = rec[key] || (rec[key] = { name: String(s.merchant).replace(/\s+\S*\d\S*.*$/, '').trim() || s.merchant, months: {}, amt: 0 });
      r.months[k] = (r.months[k] || 0) + num(s.amount);
    }));
    const subs = Object.values(rec).filter((r) => Object.keys(r.months).length >= 3).map((r) => {
      const vals = Object.values(r.months); return { name: r.name, monthly: vals.reduce((a, b) => a + b, 0) / vals.length };
    }).filter((r) => r.monthly <= 600 && r.monthly >= 10).sort((a, b) => b.monthly - a.monthly);
    if (subs.length >= 2) {
      const total = subs.reduce((a, r) => a + r.monthly, 0);
      out.push({ icon: 'refresh', tone: 'info', save: subs[subs.length - 1].monthly,
        title: subs.length + ' payments repeat every month · about AED ' + fmt(total),
        text: subs.slice(0, 4).map((r) => r.name + ' (' + fmt(r.monthly) + ')').join(', ') + (subs.length > 4 ? ' and more' : '') + '. Cancel any you no longer use.' });
    }

    // Weekend spending on optional things.
    const opt = recent.filter((s) => cats[s.catId] && cats[s.catId].group === 'optional');
    const optTotal = opt.reduce((a, s) => a + num(s.amount), 0);
    const wk = opt.filter((s) => { const d = new Date(s.date + 'T12:00:00').getDay(); return d === 0 || d === 6; }).reduce((a, s) => a + num(s.amount), 0);
    if (optTotal > 400 && wk / optTotal > 0.5) {
      out.push({ icon: 'calendar', tone: 'info', save: wk * 0.2,
        title: Math.round(wk / optTotal * 100) + '% of your optional spending happens at weekends',
        text: 'AED ' + fmt(wk) + ' in the last 30 days. Planning one free weekend activity saves about AED ' + fmt(wk * 0.2) + '.' });
    }

    // Their biggest optional category: a small trim there is the easiest saving.
    const optUsual = Object.keys(usual).filter((id) => cats[id] && cats[id].group === 'optional').sort((a, b) => usual[b] - usual[a]);
    if (optUsual.length && usual[optUsual[0]] >= 300 && !out.some((t) => t.cat === optUsual[0])) {
      const u = usual[optUsual[0]];
      out.push({ cat: optUsual[0], icon: 'scissors', tone: 'info', save: u * 0.15, title: nm(optUsual[0]) + ' is your biggest optional spend · about AED ' + fmt(u) + ' a month',
        text: 'Trimming it by 15% keeps about AED ' + fmt(u * 0.15) + ' a month, without giving it up.' });
    }

    // Savings: what was left of their income last month after their share of costs.
    const lastMk = past[past.length - 1];
    if (lastMk) {
      const m = C.calcMonth(state, idx, lastMk);
      const inc = p === 1 ? m.sal1 : m.sal2, share = p === 1 ? m.p1_total : m.p2_total, left = inc - share;
      if (inc > 0) {
        const rate = left / inc, goal = inc * 0.2, gap = Math.max(0, goal - Math.max(left, 0)), mon = C.monthLabel(lastMk).split(' ')[0];
        if (rate < 0.2) out.push({ goal: true, icon: 'target', tone: 'warn', save: gap, title: 'In ' + mon + ' you kept ' + Math.round(Math.max(rate, 0) * 100) + '% of your income',
          text: 'Aim for at least 20% (AED ' + fmt(goal) + '). The ideas here are the quickest way to close the AED ' + fmt(gap) + ' gap.' });
        else out.push({ icon: 'bank', tone: 'good', save: 0, title: 'In ' + mon + ' you kept AED ' + fmt(left) + ' (' + Math.round(rate * 100) + '% of your income)',
          text: 'Keep it up: move about AED ' + fmt(Math.floor(left * 0.8 / 100) * 100) + ' to savings on payday, before it gets spent, and leave the rest as a buffer.' });
      }
    }

    out.sort((a, b) => b.save - a.save);
    const potential = out.reduce((a, t) => a + (t.tone === 'good' || t.goal ? 0 : t.save), 0);
    return { list: out.slice(0, 7), potential };
  }

  root.Smart = { learn, budgetsFor, isAuto, same, monthRow, tips, historyMonths };
})(typeof window !== 'undefined' ? window : this);
