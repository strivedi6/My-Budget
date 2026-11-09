/* My Budget: Home, Spends and Insights screens. */
(function () {
  'use strict';
  const { h, fmt, fmt2 } = App;
  window.addEventListener('hashchange', () => App.readRoute());

  /* Expense rows for a month, biggest first. */
  function expenseRows(m) {
    return Store.state.categories.map((c) => ({ c, v: m.exp[c.id] || 0, a: m.attrib[c.id] || {} })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
  }
  function budgetRows(key, m) {
    return Store.state.categories.map((c) => {
      const spent = m.agg.total[c.id] || 0;
      const budget = c.kind === 'budgeted' ? Calc.budgetFor(Store.state, c, key) : 0;
      return { c, spent, budget, nb: c.kind !== 'budgeted' };
    });
  }
  function barClass(spent, budget, nb) { if (nb || !budget) return 'acc'; const p = spent / budget; return p > 1 ? 'neg' : p > 0.85 ? 'warn' : ''; }
  function budgetRowHtml(r) {
    const p = r.budget > 0 ? Math.min(r.spent / r.budget * 100, 100) : (r.spent > 0 ? 100 : 0);
    const cls = barClass(r.spent, r.budget, r.nb);
    const left = r.budget - r.spent;
    return '<div class="budget-row"><div class="top"><span class="cat-ic sm">' + catIcon(r.c.icon, 15) + '</span><span class="name">' + h(r.c.name) + '</span>' +
      '<span class="vals num ' + (cls === 'neg' ? 'neg' : '') + '">' + fmt(r.spent) + (r.budget > 0 ? ' <span>/ ' + fmt(r.budget) + '</span>' : (r.nb ? ' <span>not budgeted</span>' : '')) + '</span></div>' +
      '<div class="bar"><i class="' + cls + '" style="width:' + p + '%"></i></div>' +
      (r.budget > 0 ? '<div class="between" style="margin-top:5px;font-size:12px;font-weight:650"><span class="muted">' + Math.round(r.spent / r.budget * 100) + '% used</span><span class="' + (left < 0 ? 'neg' : 'muted') + '">' + (left < 0 ? fmt(-left) + ' over' : fmt(left) + ' left') + '</span></div>' : '') +
      '</div>';
  }
  function donutHtml(id, items, total, label) {
    const pal = App.palette();
    return '<div class="donut-wrap"><div class="chart-box donut"><canvas id="' + id + '"></canvas><div class="donut-center"><div><b class="num">' + fmt(total) + '</b><span>' + h(label) + '</span></div></div></div>' +
      '<div class="legend">' + items.slice(0, 8).map((x, i) => '<div class="lg"><i class="dot" style="background:' + pal[i % pal.length] + '"></i><span>' + h(x.name) + '</span><b class="num">' + Math.round(App.pct(x.v, total)) + '%</b></div>').join('') +
      (items.length > 8 ? '<div class="lg muted" style="font-size:12px">+ ' + (items.length - 8) + ' more</div>' : '') + '</div></div>';
  }
  function drawDonut(id, items) {
    const pal = App.palette();
    App.chart(id, { type: 'doughnut', data: { labels: items.map((x) => x.name), datasets: [{ data: items.map((x) => x.v), backgroundColor: items.map((_, i) => pal[i % pal.length]), borderColor: App.css('--surface'), borderWidth: 2, hoverOffset: 4 }] },
      options: { cutout: '72%', interaction: { mode: 'nearest', intersect: true }, plugins: { tooltip: { callbacks: { label: (c) => ' ' + c.label + ': ' + fmt(c.raw) } } } } });
  }
  function phoneWho(rowsIn, label, pick) {
    const list = rowsIn.filter((x) => pick(x) > 0.004);
    if (!list.length) return '';
    return '<div class="hide-d"><div class="day-h"><span class="tag ' + (label === 'Shared' ? 's' : 'p') + '">' + label + '</span><span class="num">' + fmt(list.reduce((s, x) => s + pick(x), 0)) + '</span></div><div class="list">' + list.map((x) =>
      '<div class="li"><span class="cat-ic sm">' + catIcon(x.c.icon, 15) + '</span><span class="main-t"><div class="t1">' + h(x.c.name) + '</div><div class="t2"><span style="color:var(--p1)">' + h(App.first1()) + ' ' + (x.a.p1 > 0.004 ? fmt(x.a.p1) : '—') + '</span> · <span style="color:var(--p2)">' + h(App.first2()) + ' ' + (x.a.p2 > 0.004 ? fmt(x.a.p2) : '—') + '</span></div></span><span class="amt num">' + fmt(pick(x)) + '</span></div>').join('') + '</div></div>';
  }
  function spendLi(s) {
    const c = App.cat(s.catId);
    return '<button class="li" data-spend="' + h(s.id) + '"><span class="cat-ic">' + catIcon(c ? c.icon : 'package', 18) + '</span>' +
      '<span class="main-t"><div class="t1">' + h(s.merchant) + '</div><div class="t2">' + h(c ? c.name : 'Unknown category') + ' · ' + h(App.payer(s.paidBy)) + '</div></span>' +
      '<span class="amt num">' + fmt2(s.amount) + '</span></button>';
  }
  function bindSpends(root) {
    root.querySelectorAll('[data-spend]').forEach((b) => (b.onclick = () => { const s = Store.state.spends.find((x) => x.id === b.dataset.spend); if (s) App.spendSheet(s); }));
  }
  App.spendLi = spendLi; App.bindSpends = bindSpends;

  /* ================= HOME ================= */
  App.screens.home = {
    title: 'Summary',
    subtitle: () => 'Hi ' + App.first1() + ' · ' + Calc.monthLabel(App.ui.month),
    render() {
      const key = App.ui.month, m = App.calc(key);
      const cur = key === Calc.currentMk(), past = key < Calc.currentMk();
      const n1 = App.first1(), n2 = App.first2();

      // Hero
      const hero = '<section class="card hero c8"><div class="eyebrow">' + icon('coins', 16) + (cur ? 'Saving this month' : past ? 'Saved in ' + Calc.MONTHS[Calc.parseMk(key).month] : 'Planned savings') +
        '<span class="pill ' + App.rateClass(m.rate) + '">' + m.rate.toFixed(1) + '% of income</span></div>' +
        '<div class="big num ' + (m.savings < 0 ? 'neg' : '') + '"><small>' + h(App.cur) + '</small>' + App.signed(m.savings) + '</div>' +
        '<div class="kpis"><div class="kpi"><div class="k">Income</div><div class="v num">' + fmt(m.totalInc) + '</div></div>' +
        '<div class="kpi"><div class="k">Expenses</div><div class="v num">' + fmt(m.totalExp) + '</div></div>' +
        '<div class="kpi"><div class="k">Logged spends</div><div class="v num">' + fmt(m.actual) + '</div></div></div></section>';

      // Income split
      const extra = m.extras.filter((x) => Calc.num(x.amount));
      const inc = '<section class="card c4"><div class="card-h"><h3>Income</h3><a class="link" href="#/settings/month">Edit</a></div>' +
        '<div class="split" style="margin-bottom:14px"><i style="flex:' + (m.sal1 || 0.0001) + ';background:var(--p1)"></i><i style="flex:' + (m.sal2 || 0.0001) + ';background:var(--p2)"></i>' + (m.extraIncome ? '<i style="flex:' + m.extraIncome + ';background:var(--text-3)"></i>' : '') + '</div>' +
        '<div class="list">' +
        '<div class="li"><i class="dot" style="background:var(--p1)"></i><span class="main-t"><div class="t1">' + h(n1) + '</div><div class="t2">Shares ' + Math.round(m.sh1 * 100) + '% of shared costs</div></span><span class="amt num">' + fmt(m.sal1) + '</span></div>' +
        '<div class="li"><i class="dot" style="background:var(--p2)"></i><span class="main-t"><div class="t1">' + h(n2) + '</div><div class="t2">Shares ' + Math.round(m.sh2 * 100) + '% of shared costs</div></span><span class="amt num">' + fmt(m.sal2) + '</span></div>' +
        extra.map((x) => '<div class="li"><i class="dot" style="background:var(--text-3)"></i><span class="main-t"><div class="t1">' + h(x.desc || 'Extra income') + '</div><div class="t2">Extra this month</div></span><span class="amt num">' + fmt(x.amount) + '</span></div>').join('') +
        '</div></section>';

      // Budget
      const rows = budgetRows(key, m);
      const budgeted = rows.filter((r) => !r.nb && r.budget > 0);
      const bTotal = budgeted.reduce((s, r) => s + r.budget, 0);
      const bSpent = budgeted.reduce((s, r) => s + r.spent, 0);
      const days = Calc.daysIn(key), dayNow = cur ? new Date().getDate() : (past ? days : 0);
      const left = bTotal - bSpent;
      const watch = rows.filter((r) => r.spent > 0 || r.budget > 0).sort((a, b) => {
        const pa = a.budget ? a.spent / a.budget : (a.spent ? 0.5 : 0), pb = b.budget ? b.spent / b.budget : (b.spent ? 0.5 : 0);
        return pb - pa || b.spent - a.spent;
      }).slice(0, 5);
      const budget = '<section class="card c6"><div class="card-h"><h3>Budget</h3><a class="link" href="#/spends">All categories</a></div>' +
        (bTotal ? '<div class="between" style="align-items:flex-end;margin-bottom:8px"><div><div class="num" style="font-size:24px;font-weight:800;letter-spacing:-0.02em">' + fmt(bSpent) + ' <span class="muted" style="font-size:14px;font-weight:700">of ' + fmt(bTotal) + '</span></div>' +
          '<div class="sub" style="font-size:13px">' + (left >= 0 ? fmt(left) + ' left' : '<span class="neg">' + fmt(-left) + ' over budget</span>') + (cur && left > 0 ? ' · about ' + fmt(left / Math.max(1, days - dayNow + 1)) + ' a day for ' + (days - dayNow + 1) + ' days' : '') + '</div></div>' +
          '<span class="pill ' + (bSpent > bTotal ? 'neg' : 'acc') + '">' + Math.round(App.pct(bSpent, bTotal)) + '%</span></div>' +
          '<div class="bar thick" style="margin-bottom:6px"><i class="' + barClass(bSpent, bTotal) + '" style="width:' + Math.min(100, App.pct(bSpent, bTotal)) + '%"></i>' + (cur ? '<i style="left:' + (dayNow / days * 100) + '%;width:2px;background:var(--text);opacity:.35;border-radius:0"></i>' : '') + '</div>' : '<p class="muted">No budgets set. Add them in Settings › Categories.</p>') +
        watch.map(budgetRowHtml).join('') + '</section>';

      // Where it went
      const items = expenseRows(m).map((x) => ({ name: x.c.name, v: x.v }));
      const where = '<section class="card c6"><div class="card-h"><h3>Where it goes</h3><span class="pill">incl. planned</span></div>' +
        (items.length ? donutHtml('ch-home-donut', items, m.totalExp, 'expenses') : '<div class="empty">No expenses yet</div>') + '</section>';

      // Trend
      const trend = '<section class="card c8"><div class="card-h"><h3>Trend</h3><div class="seg" id="trend-seg">' +
        [['monthly', 'Monthly'], ['daily', 'Daily'], ['cumulative', 'Year to date']].map((t) => '<button data-t="' + t[0] + '" class="' + (App.ui.trend === t[0] ? 'on' : '') + '">' + t[1] + '</button>').join('') +
        '</div></div><div id="trend-legend"></div><div class="chart-box"><canvas id="ch-trend"></canvas></div></section>';

      // Recent
      const recent = (Store.idx.byMonth[key] || []).slice().sort((a, b) => (b.date + b.id < a.date + a.id ? -1 : 1)).slice(0, 6);
      const rec = '<section class="card c4"><div class="card-h"><h3>Recent spends</h3><a class="link" href="#/spends">See all</a></div>' +
        (recent.length ? '<div class="list">' + recent.map(spendLi).join('') + '</div>' : '<div class="empty">' + icon('wallet', 32) + 'Nothing logged in ' + Calc.monthLabel(key) + ' yet.<br><button class="btn sm primary" data-add2 style="margin-top:12px">' + icon('plus', 16) + 'Add a spend</button></div>') + '</section>';

      // Who pays what
      const who = App.ui.who;
      const exp = expenseRows(m);
      const shared = exp.filter((x) => x.c.type === 'shared'), personal = exp.filter((x) => x.c.type !== 'shared');
      const pick = (x) => (who === '1' ? x.a.p1 : who === '2' ? x.a.p2 : x.v);
      const resp = (rowsIn, label) => {
        const list = rowsIn.filter((x) => pick(x) > 0.004);
        if (!list.length) return '';
        const tot = list.reduce((s, x) => s + pick(x), 0);
        return '<tr><td colspan="4" style="padding-top:16px"><span class="tag ' + (label === 'Shared' ? 's' : 'p') + '">' + label + '</span></td></tr>' + list.map((x) =>
          '<tr><td><div class="row" style="gap:10px"><span class="cat-ic sm">' + catIcon(x.c.icon, 15) + '</span><span style="font-weight:650">' + h(x.c.name) + '</span>' + (x.c.kind === 'nonbudgeted' ? ' <span class="tag">extra</span>' : '') + '</div></td>' +
          '<td class="r num">' + fmt(x.v) + '</td><td class="r num" style="color:var(--p1)">' + (x.a.p1 > 0.004 ? fmt(x.a.p1) : '—') + '</td><td class="r num" style="color:var(--p2)">' + (x.a.p2 > 0.004 ? fmt(x.a.p2) : '—') + '</td></tr>').join('') +
          '<tr><td class="muted" style="font-size:12.5px">' + label + ' total</td><td class="r num muted">' + fmt(tot) + '</td><td></td><td></td></tr>';
      };
      const whoCard = '<section class="card"><div class="card-h"><h3>Who pays what</h3><div class="seg" id="who-seg">' +
        [['both', 'Both'], ['1', n1], ['2', n2]].map((t) => '<button data-w="' + t[0] + '" class="' + (who === t[0] ? 'on' : '') + '">' + h(t[1]) + '</button>').join('') + '</div></div>' +
        '<p class="sub" style="margin:-6px 0 6px;font-size:13px">Shared costs are split by income (' + Math.round(m.sh1 * 100) + ' / ' + Math.round(m.sh2 * 100) + '). Where a spend was logged, the person who actually paid is shown.</p>' +
        phoneWho(shared, 'Shared', pick) + phoneWho(personal, 'Personal', pick) +
        '<div class="li hide-d" style="font-weight:800;border-top:2px solid var(--line)"><span class="main-t"><div class="t1">Total</div><div class="t2"><span style="color:var(--p1)">' + h(n1) + ' ' + fmt(m.p1_total) + '</span> · <span style="color:var(--p2)">' + h(n2) + ' ' + fmt(m.p2_total) + '</span></div></span><span class="amt num">' + fmt(who === '1' ? m.p1_total : who === '2' ? m.p2_total : m.totalExp) + '</span></div>' +
        '<div class="tbl-wrap hide-m"><table class="tbl"><thead><tr><th>Category</th><th class="r">Total</th><th class="r">' + h(n1) + '</th><th class="r">' + h(n2) + '</th></tr></thead><tbody>' +
        resp(shared, 'Shared') + resp(personal, 'Personal') +
        '<tr class="total"><td>Total</td><td class="r num">' + fmt(m.totalExp) + '</td><td class="r num">' + fmt(m.p1_total) + '</td><td class="r num">' + fmt(m.p2_total) + '</td></tr>' +
        '</tbody></table></div></section>';

      return '<div class="grid">' + hero + inc + budget + where + trend + rec + whoCard + '</div>';
    },
    mount(view) {
      const key = App.ui.month, m = App.calc(key);
      const items = expenseRows(m).map((x) => ({ name: x.c.name, v: x.v }));
      if (items.length) drawDonut('ch-home-donut', items);
      drawTrend(key);
      view.querySelectorAll('#trend-seg [data-t]').forEach((b) => (b.onclick = () => { App.ui.trend = b.dataset.t; view.querySelectorAll('#trend-seg button').forEach((x) => x.classList.toggle('on', x === b)); drawTrend(key); }));
      view.querySelectorAll('#who-seg [data-w]').forEach((b) => (b.onclick = () => { App.ui.who = b.dataset.w; App.renderView(); }));
      const a2 = view.querySelector('[data-add2]'); if (a2) a2.onclick = () => App.spendSheet();
      bindSpends(view);
    }
  };

  function drawTrend(key) {
    const pos = App.css('--pos'), neg = App.css('--neg'), acc = App.css('--accent');
    const lg = document.getElementById('trend-legend');
    if (App.ui.trend === 'daily') {
      const days = Calc.daysIn(key), cur = key === Calc.currentMk(), past = key < Calc.currentMk();
      const last = cur ? new Date().getDate() : past ? days : 0;
      const daily = {}; (Store.idx.byMonth[key] || []).forEach((s) => { const d = Number(s.date.slice(8, 10)); daily[d] = (daily[d] || 0) + Calc.num(s.amount); });
      const labels = [], spent = [], cum = []; let run = 0;
      for (let d = 1; d <= days; d++) { labels.push(String(d)); const v = d <= last ? (daily[d] || 0) : null; spent.push(v); run += v || 0; cum.push(d <= last ? run : null); }
      const m = App.calc(key);
      const budgetLine = Store.state.categories.filter((c) => c.kind === 'budgeted').reduce((s, c) => s + Calc.budgetFor(Store.state, c, key), 0);
      lg.innerHTML = App.legendHtml([['Spent that day', neg], ['Running total', acc], ['Budget', App.css('--text-3')]]);
      App.chart('ch-trend', { type: 'bar', data: { labels, datasets: [
        { type: 'bar', label: 'Spent', data: spent, backgroundColor: neg + 'AA', borderRadius: 4, maxBarThickness: 14, yAxisID: 'y' },
        App.lineDs('Running total', cum, acc, { yAxisID: 'y1', borderWidth: 2.5 }),
        App.lineDs('Budget', labels.map(() => budgetLine), App.css('--text-3'), { yAxisID: 'y1', borderDash: [5, 5], borderWidth: 1.5 })
      ] }, options: { scales: { y1: { position: 'right', grid: { display: false }, border: { display: false }, ticks: { maxTicksLimit: 5, callback: (v) => (v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v) } } } } });
      void m; return;
    }
    const year = Calc.parseMk(key).year, months = Calc.yearMonths(year);
    const labels = months.map(Calc.monShort);
    let ci = 0, ce = 0, cs = 0;
    const inc = [], exp = [], sav = [];
    months.forEach((k) => {
      const m = App.calc(k);
      if (App.ui.trend === 'monthly') { inc.push(m.totalInc); exp.push(m.totalExp); sav.push(m.savings); }
      else { ci += m.totalInc; ce += m.totalExp; cs += m.savings; inc.push(ci); exp.push(ce); sav.push(cs); }
    });
    lg.innerHTML = App.legendHtml([['Income', pos], ['Expenses', neg], ['Savings', acc]]);
    const nowIdx = months.indexOf(Calc.currentMk());
    const seg = { borderDash: (c) => (nowIdx >= 0 && c.p1DataIndex > nowIdx ? [4, 4] : undefined) };
    App.chart('ch-trend', { type: 'line', data: { labels, datasets: [
      App.lineDs('Income', inc, pos, { segment: seg }), App.lineDs('Expenses', exp, neg, { segment: seg }),
      App.lineDs('Savings', sav, acc, { borderWidth: 3, fill: true, backgroundColor: acc + '18', segment: seg })
    ] } });
  }
  App.drawTrend = drawTrend;

  /* ================= SPENDS ================= */
  function filteredSpends() {
    const f = App.ui.spends, key = App.ui.month, year = key.slice(0, 4), q = f.q.trim().toLowerCase();
    return Store.state.spends.filter((s) => {
      if (f.scope === 'month' && s.date.slice(0, 7) !== key) return false;
      if (f.scope === 'year' && s.date.slice(0, 4) !== year) return false;
      if (f.cat && s.catId !== f.cat) return false;
      if (f.paid && String(s.paidBy) !== f.paid) return false;
      if (q) { const c = App.cat(s.catId); if (!(s.merchant.toLowerCase().includes(q) || (c && c.name.toLowerCase().includes(q)) || String(s.amount).includes(q))) return false; }
      return true;
    }).sort((a, b) => (a.date === b.date ? (a.id < b.id ? 1 : -1) : a.date < b.date ? 1 : -1));
  }
  App.filteredSpends = filteredSpends;

  App.screens.spends = {
    title: 'Spends',
    subtitle: () => { const f = App.ui.spends; return f.scope === 'month' ? Calc.monthLabel(App.ui.month) : f.scope === 'year' ? 'All of ' + App.ui.month.slice(0, 4) : 'All time'; },
    render() {
      const f = App.ui.spends, key = App.ui.month;
      const list = filteredSpends();
      const total = list.reduce((s, x) => s + Calc.num(x.amount), 0);
      // daily average for month scope
      let avg = '—';
      if (f.scope === 'month') {
        const days = Calc.daysIn(key), cur = key === Calc.currentMk();
        const el = cur ? new Date().getDate() : key < Calc.currentMk() ? days : 0;
        avg = el ? fmt(total / el) : '—';
      } else if (list.length) {
        const first = list[list.length - 1].date, last = list[0].date;
        const d = Math.max(1, Math.round((new Date(last) - new Date(first)) / 864e5) + 1); avg = fmt(total / d);
      }
      const byCat = {}, byMer = {};
      list.forEach((s) => { byCat[s.catId] = (byCat[s.catId] || 0) + Calc.num(s.amount); const k = s.merchant.trim(); byMer[k] = (byMer[k] || 0) + Calc.num(s.amount); });
      const topCat = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];
      const topMer = Object.entries(byMer).sort((a, b) => b[1] - a[1])[0];
      const scopeLbl = f.scope === 'month' ? Calc.monthLabel(key) : f.scope === 'year' ? key.slice(0, 4) : 'All time';

      const usedCats = Store.state.categories.filter((c) => Store.state.spends.some((s) => s.catId === c.id)).sort((a, b) => a.name.localeCompare(b.name));
      const toolbar = '<div class="toolbar">' +
        '<div class="search grow">' + icon('search', 18) + '<input class="input sm" id="q" type="search" placeholder="Search" value="' + h(f.q) + '"></div>' +
        '<div class="seg full" id="scope" style="flex:1 1 100%">' + [['month', 'Month'], ['year', 'Year'], ['all', 'All']].map((s) => '<button data-s="' + s[0] + '" class="' + (f.scope === s[0] ? 'on' : '') + '">' + s[1] + '</button>').join('') + '</div>' +
        '<select class="input sm" id="fcat" style="width:auto;flex:1 1 150px"><option value="">All categories</option>' + usedCats.map((c) => '<option value="' + h(c.id) + '" ' + (f.cat === c.id ? 'selected' : '') + '>' + h(c.name) + '</option>').join('') + '</select>' +
        '<select class="input sm" id="fpaid" style="width:auto;flex:1 1 110px"><option value="">Anyone</option><option value="1" ' + (f.paid === '1' ? 'selected' : '') + '>' + h(App.first1()) + '</option><option value="2" ' + (f.paid === '2' ? 'selected' : '') + '>' + h(App.first2()) + '</option></select>' +
        '<button class="icon-btn" id="sp-tools" aria-label="CSV import and export" style="width:36px;height:36px">' + icon('more', 18) + '</button>' +
        '</div>';

      const stats = '<div class="stats" style="margin-bottom:14px">' +
        '<div class="stat"><div class="k">Total spent</div><div class="v num">' + fmt(total) + '</div><div class="s">' + list.length + ' spend' + (list.length === 1 ? '' : 's') + ' · ' + h(scopeLbl) + '</div></div>' +
        '<div class="stat"><div class="k">Daily average</div><div class="v num">' + avg + '</div><div class="s">per day</div></div>' +
        '<div class="stat"><div class="k">Top category</div><div class="v" style="font-size:17px">' + h(topCat ? (App.cat(topCat[0]) || { name: '?' }).name : '—') + '</div><div class="s num">' + (topCat ? fmt(topCat[1]) : '') + '</div></div>' +
        '<div class="stat"><div class="k">Top merchant</div><div class="v" style="font-size:17px">' + h(topMer ? topMer[0] : '—') + '</div><div class="s num">' + (topMer ? fmt(topMer[1]) : '') + '</div></div></div>';

      // Grouped list
      const shown = list.slice(0, f.limit);
      let groups = '', lastDate = '';
      const dayTot = {}; list.forEach((s) => { dayTot[s.date] = (dayTot[s.date] || 0) + Calc.num(s.amount); });
      shown.forEach((s) => {
        if (s.date !== lastDate) {
          if (lastDate) groups += '</div>';
          groups += '<div class="day-h"><span>' + h(App.dateLabel(s.date, f.scope === 'month' ? { weekday: 'long', day: 'numeric', month: 'long' } : { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })) + '</span><span class="num">' + fmt2(dayTot[s.date]) + '</span></div><div class="list day-group">';
          lastDate = s.date;
        }
        groups += spendLi(s);
      });
      if (lastDate) groups += '</div>';
      const more = list.length > shown.length ? '<button class="btn block ghost" id="more" style="margin-top:12px">Show more (' + (list.length - shown.length) + ')</button>' : '';
      const listCard = '<section class="c8" style="margin-top:-12px">' +
        (list.length ? groups + more : '<div class="card empty" style="margin-top:12px">' + icon('search', 40) + (f.q || f.cat || f.paid ? 'No spends match these filters.' : 'No spends logged for ' + h(scopeLbl) + '.') + '<br><button class="btn sm primary" data-add3 style="margin-top:14px">' + icon('plus', 16) + 'Add a spend</button></div>') + '</section>';

      // Side: budget vs actual + by category
      const m = App.calc(key);
      const brows = budgetRows(key, m).filter((r) => r.spent > 0).sort((a, b) => b.spent - a.spent);
      const catItems = Object.entries(byCat).map(([id, v]) => ({ name: (App.cat(id) || { name: 'Unknown' }).name, v })).sort((a, b) => b.v - a.v);
      const side = '<div class="c4" style="display:grid;gap:inherit;align-content:start">' +
        (f.scope === 'month' ? '<section class="card"><div class="card-h"><h3>Budget vs actual</h3></div>' + (brows.length ? brows.map(budgetRowHtml).join('') : '<div class="empty">Nothing logged yet</div>') + '</section>' : '') +
        '<section class="card"><div class="card-h"><h3>By category</h3></div>' + (catItems.length ? donutHtml('ch-sp-donut', catItems, total, 'spent') : '<div class="empty">No spends</div>') + '</section></div>';

      return toolbar + stats + '<div class="grid">' + listCard + side + '</div>';
    },
    mount(view) {
      const f = App.ui.spends;
      view.querySelectorAll('#scope [data-s]').forEach((b) => (b.onclick = () => { f.scope = b.dataset.s; f.limit = 120; App.renderView(); }));
      const q = view.querySelector('#q');
      let t; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { f.q = q.value; f.limit = 120; const pos = q.selectionStart; App.renderView(); const nq = document.getElementById('q'); nq.focus(); try { nq.setSelectionRange(pos, pos); } catch (e) {} }, 250); };
      view.querySelector('#fcat').onchange = (e) => { f.cat = e.target.value; App.renderView(); };
      view.querySelector('#fpaid').onchange = (e) => { f.paid = e.target.value; App.renderView(); };
      const more = view.querySelector('#more'); if (more) more.onclick = () => { f.limit += 200; App.renderView(); };
      const a3 = view.querySelector('[data-add3]'); if (a3) a3.onclick = () => App.spendSheet();
      view.querySelector('#sp-tools').onclick = () => App.csvMenu();
      const byCat = {}; filteredSpends().forEach((s) => { byCat[s.catId] = (byCat[s.catId] || 0) + Calc.num(s.amount); });
      const items = Object.entries(byCat).map(([id, v]) => ({ name: (App.cat(id) || { name: 'Unknown' }).name, v })).sort((a, b) => b.v - a.v);
      if (items.length) drawDonut('ch-sp-donut', items);
      bindSpends(view);
    }
  };

  /* ================= INSIGHTS ================= */
  const ITABS = [['pnl', 'P&L'], ['savings', 'Savings'], ['forecast', 'Forecast'], ['compare', 'Compare']];
  App.screens.insights = {
    title: 'Insights',
    subtitle: () => (App.ui.insights === 'pnl' || App.ui.insights === 'compare' ? Calc.monthLabel(App.ui.month) : 'Year ' + App.ui.month.slice(0, 4)),
    render() {
      const t = App.ui.insights;
      const seg = '<div class="seg full" id="itabs" style="margin-bottom:18px">' + ITABS.map((x) => '<button data-i="' + x[0] + '" class="' + (t === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div>';
      return seg + INS[t].render();
    },
    mount(view) {
      view.querySelectorAll('#itabs [data-i]').forEach((b) => (b.onclick = () => { App.ui.insights = b.dataset.i; App.renderView(); }));
      INS[App.ui.insights].mount(view);
    }
  };

  function yearInfo() {
    const year = Calc.parseMk(App.ui.month).year, months = Calc.yearMonths(year), nowK = Calc.currentMk();
    const done = months.filter((k) => k <= nowK);
    return { year, months, nowK, done };
  }

  const INS = {
    pnl: {
      render() {
        const key = App.ui.month, m = App.calc(key);
        const person = (p) => {
          const name = p === 1 ? App.name1() : App.name2();
          const inc = p === 1 ? m.sal1 : m.sal2, ex = p === 1 ? m.p1_total : m.p2_total, net = inc - ex;
          const lines = Store.state.categories.map((c) => {
            const v = m.exp[c.id] || 0; if (!v) return null;
            const a = m.attrib[c.id] || {};
            const amt = c.type === 'shared' ? (p === 1 ? a.resp1 : a.resp2) : (p === 1 ? a.p1 : a.p2);
            return amt > 0.004 ? { c, amt } : null;
          }).filter(Boolean).sort((a, b) => b.amt - a.amt);
          return '<section class="card c6"><div class="card-h"><span class="dot" style="background:var(--p' + p + ');width:10px;height:10px"></span><h3>' + h(name) + '</h3><span class="pill ' + (net >= 0 ? 'pos' : 'neg') + '">Net ' + App.signed(net) + '</span></div>' +
            '<div class="kpis" style="margin:0 0 14px"><div class="kpi"><div class="k">Income</div><div class="v num">' + fmt(inc) + '</div></div><div class="kpi"><div class="k">Expense share</div><div class="v num">' + fmt(ex) + '</div></div><div class="kpi"><div class="k">Net</div><div class="v num ' + (net >= 0 ? 'pos' : 'neg') + '">' + App.signed(net) + '</div></div></div>' +
            '<div class="list">' + (lines.length ? lines.map((l) => '<div class="li"><span class="cat-ic sm">' + catIcon(l.c.icon, 15) + '</span><span class="main-t"><div class="t1">' + h(l.c.name) + '</div><div class="t2">' + (l.c.type === 'shared' ? 'Shared · ' + Math.round((p === 1 ? m.sh1 : m.sh2) * 100) + '%' : 'Personal') + '</div></span><span class="amt num neg">−' + fmt(l.amt) + '</span></div>').join('') : '<div class="empty">No expenses</div>') + '</div>' +
            '<div class="card-h" style="margin:18px 0 6px"><h3 style="font-size:13.5px">' + Calc.parseMk(key).year + '</h3></div>' + App.legendHtml([['Income', App.css('--pos')], ['Expenses', App.css('--neg')]]) +
            '<div class="chart-box"><canvas id="ch-pnl' + p + '"></canvas></div></section>';
        };
        return '<p class="sub" style="margin:-4px 0 14px;font-size:13.5px">' + h(Calc.monthLabel(App.ui.month)) + '. Each person\'s income against their share of costs: shared costs by income ratio, personal costs in full.</p><div class="grid">' + person(1) + person(2) + '</div>';
      },
      mount() {
        const { months } = yearInfo();
        const labels = months.map(Calc.monShort);
        [1, 2].forEach((p) => {
          const inc = months.map((k) => { const m = App.calc(k); return p === 1 ? m.sal1 : m.sal2; });
          const ex = months.map((k) => { const m = App.calc(k); return p === 1 ? m.p1_total : m.p2_total; });
          App.chart('ch-pnl' + p, { type: 'line', data: { labels, datasets: [App.lineDs('Income', inc, App.css('--pos')), App.lineDs('Expenses', ex, App.css('--neg'), { fill: true, backgroundColor: App.css('--neg') + '14' })] } });
        });
      }
    },

    savings: {
      render() {
        const { year, months, done } = yearInfo();
        const ms = months.map((k) => App.calc(k));
        const ytdList = ms.filter((m) => done.indexOf(m.key) >= 0);
        const ytd = ytdList.reduce((s, m) => s + m.savings, 0);
        const avg = ytdList.length ? ytd / ytdList.length : 0;
        const proj = ms.reduce((s, m) => s + m.savings, 0);
        const incYtd = ytdList.reduce((s, m) => s + m.totalInc, 0);
        const rows = ms.map((m) => {
          const n1 = m.sal1 - m.p1_total, n2 = m.sal2 - m.p2_total, fut = m.key > Calc.currentMk();
          return '<tr class="' + (m.key === App.ui.month ? 'cur ' : '') + (fut ? 'future' : '') + '"><td>' + Calc.MONTHS[Calc.parseMk(m.key).month] + (fut ? ' <span class="tag">plan</span>' : '') + '</td>' +
            '<td class="r num ' + (n1 >= 0 ? '' : 'neg') + '">' + App.signed(n1) + '</td><td class="r num ' + (n2 >= 0 ? '' : 'neg') + '">' + App.signed(n2) + '</td>' +
            '<td class="r num" style="font-weight:800" ><span class="' + (m.savings >= 0 ? 'pos' : 'neg') + '">' + App.signed(m.savings) + '</span></td><td class="r num">' + m.rate.toFixed(1) + '%</td></tr>';
        }).join('');
        return '<div class="stats" style="margin-bottom:16px">' +
          '<div class="stat"><div class="k">Saved so far in ' + year + '</div><div class="v num ' + (ytd < 0 ? 'neg' : 'pos') + '">' + App.signed(ytd) + '</div><div class="s">' + ytdList.length + ' month' + (ytdList.length === 1 ? '' : 's') + '</div></div>' +
          '<div class="stat"><div class="k">Average a month</div><div class="v num">' + App.signed(avg) + '</div><div class="s">' + (incYtd ? (ytd / incYtd * 100).toFixed(1) + '% of income' : '') + '</div></div>' +
          '<div class="stat"><div class="k">Projected year end</div><div class="v num">' + App.signed(proj) + '</div><div class="s">plan for remaining months</div></div>' +
          '<div class="stat"><div class="k">Best month</div><div class="v" style="font-size:17px">' + (() => { const b = ytdList.filter((m) => m.key < Calc.currentMk()).sort((a, b2) => b2.savings - a.savings)[0]; return b ? Calc.MONTHS[Calc.parseMk(b.key).month] + '</div><div class="s num">' + fmt(b.savings) : '—</div><div class="s">'; })() + '</div></div></div>' +
          '<div class="grid"><section class="card c6"><div class="card-h"><h3>Savings by month</h3></div><div class="chart-box"><canvas id="ch-sav"></canvas></div></section>' +
          '<section class="card c6"><div class="card-h"><h3>Growing total</h3></div><div class="chart-box"><canvas id="ch-savcum"></canvas></div></section>' +
          '<section class="card"><div class="card-h"><h3>Who saved what</h3></div><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Month</th><th class="r">' + h(App.first1()) + '</th><th class="r">' + h(App.first2()) + '</th><th class="r">Combined</th><th class="r">Rate</th></tr></thead><tbody>' + rows +
          '<tr class="total"><td>' + year + '</td><td class="r num">' + App.signed(ms.reduce((s, m) => s + m.sal1 - m.p1_total, 0)) + '</td><td class="r num">' + App.signed(ms.reduce((s, m) => s + m.sal2 - m.p2_total, 0)) + '</td><td class="r num">' + App.signed(proj) + '</td><td></td></tr></tbody></table></div></section></div>';
      },
      mount() {
        const { months } = yearInfo();
        const nowK = Calc.currentMk();
        const sav = months.map((k) => App.calc(k).savings);
        const pos = App.css('--pos'), neg = App.css('--neg'), acc = App.css('--accent');
        App.chart('ch-sav', { type: 'bar', data: { labels: months.map(Calc.monShort), datasets: [{ label: 'Savings', data: sav, borderRadius: 6, maxBarThickness: 26,
          backgroundColor: months.map((k, i) => (sav[i] >= 0 ? pos : neg) + (k > nowK ? '55' : 'DD')) }] } });
        let c = 0; const cum = sav.map((v) => (c += v));
        App.chart('ch-savcum', { type: 'line', data: { labels: months.map(Calc.monShort), datasets: [App.lineDs('Total saved', cum, acc, { fill: true, backgroundColor: acc + '20', borderWidth: 3, segment: { borderDash: (x) => (months[x.p1DataIndex] > nowK ? [4, 4] : undefined) } })] } });
      }
    },

    forecast: {
      render() {
        const { year, months, nowK } = yearInfo();
        const ms = months.map((k) => App.calc(k));
        const T = (f, list) => (list || ms).reduce((s, m) => s + m[f], 0);
        const rest = ms.filter((m) => m.key > nowK);
        const rows = ms.map((m) => '<tr class="' + (m.key === nowK ? 'cur ' : '') + (m.key > nowK ? 'future' : '') + '"><td>' + Calc.MONTHS[Calc.parseMk(m.key).month] + (m.key === nowK ? ' <span class="tag s">now</span>' : '') + '</td><td class="r num">' + fmt(m.totalInc) + '</td><td class="r num">' + fmt(m.totalExp) + '</td><td class="r num ' + (m.savings >= 0 ? 'pos' : 'neg') + '" style="font-weight:800">' + App.signed(m.savings) + '</td><td class="r num">' + m.rate.toFixed(1) + '%</td></tr>').join('');
        const inc = T('totalInc'), sav = T('savings');
        return '<div class="stats" style="margin-bottom:16px">' +
          '<div class="stat"><div class="k">' + year + ' income</div><div class="v num">' + fmt(inc) + '</div><div class="s">actual + planned</div></div>' +
          '<div class="stat"><div class="k">' + year + ' expenses</div><div class="v num">' + fmt(T('totalExp')) + '</div><div class="s">actual + budgets</div></div>' +
          '<div class="stat"><div class="k">' + year + ' savings</div><div class="v num ' + (sav >= 0 ? 'pos' : 'neg') + '">' + App.signed(sav) + '</div><div class="s">' + (inc ? (sav / inc * 100).toFixed(1) + '% of income' : '') + '</div></div>' +
          '<div class="stat"><div class="k">Rest of the year</div><div class="v num">' + (rest.length ? App.signed(T('savings', rest)) : '—') + '</div><div class="s">' + (rest.length ? rest.length + ' month' + (rest.length > 1 ? 's' : '') + ' to go' : 'year complete') + '</div></div></div>' +
          '<div class="notice" style="margin-bottom:16px">' + icon('info', 16) + ' Months ahead use default salaries and category budgets. Set a different amount for a month in Settings › Month setup.</div>' +
          '<div class="grid"><section class="card"><div class="card-h"><h3>' + year + ' month by month</h3></div>' + App.legendHtml([['Income', App.css('--pos')], ['Expenses', App.css('--neg')], ['Savings', App.css('--accent')]]) + '<div class="chart-box tall"><canvas id="ch-fc"></canvas></div></section>' +
          '<section class="card"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Month</th><th class="r">Income</th><th class="r">Expenses</th><th class="r">Savings</th><th class="r">Rate</th></tr></thead><tbody>' + rows +
          '<tr class="total"><td>Total</td><td class="r num">' + fmt(inc) + '</td><td class="r num">' + fmt(T('totalExp')) + '</td><td class="r num">' + App.signed(sav) + '</td><td class="r num">' + (inc ? (sav / inc * 100).toFixed(1) : '0') + '%</td></tr></tbody></table></div></section></div>';
      },
      mount() {
        const { months, nowK } = yearInfo();
        const ms = months.map((k) => App.calc(k));
        const seg = { borderDash: (x) => (months[x.p1DataIndex] > nowK ? [4, 4] : undefined) };
        App.chart('ch-fc', { type: 'line', data: { labels: months.map(Calc.monShort), datasets: [
          App.lineDs('Income', ms.map((m) => m.totalInc), App.css('--pos'), { segment: seg }),
          App.lineDs('Expenses', ms.map((m) => m.totalExp), App.css('--neg'), { segment: seg }),
          App.lineDs('Savings', ms.map((m) => m.savings), App.css('--accent'), { borderWidth: 3, fill: true, backgroundColor: App.css('--accent') + '18', segment: seg })
        ] } });
      }
    },

    compare: {
      render() {
        const c = App.ui.cmp, key = App.ui.month;
        const modes = [['prev', 'Last month'], ['lastyear', 'Same month last year'], ['custom', 'Pick a month'], ['yearly', 'Year vs year']];
        const seg = '<div class="chips" id="cmp-modes" style="margin-bottom:14px">' + modes.map((x) => '<button class="chip ' + (c.mode === x[0] ? 'on' : '') + '" data-cm="' + x[0] + '">' + x[1] + '</button>').join('') + '</div>';
        if (c.mode === 'yearly') return seg + yearly();
        const other = c.mode === 'prev' ? Calc.addMonths(key, -1) : c.mode === 'lastyear' ? Calc.addMonths(key, -12) : (c.custom || Calc.addMonths(key, -1));
        const A = App.calc(key), B = App.calc(other);
        const kpi = (lbl, f, goodUp) => '<div class="stat"><div class="k">' + lbl + '</div><div class="v num">' + App.signed(A[f]) + '</div><div class="s"><span class="num">vs ' + App.signed(B[f]) + '</span> ' + App.deltaHtml(A[f], B[f], goodUp) + '</div></div>';
        const cats = Store.state.categories.map((cat) => ({ cat, a: A.exp[cat.id] || 0, b: B.exp[cat.id] || 0 })).filter((x) => x.a || x.b).sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b));
        const picker = c.mode === 'custom' ? '<div class="row" style="margin-bottom:14px;gap:10px"><span class="sub" style="font-weight:700">Compare ' + h(Calc.monthShort(key)) + ' with</span><input class="input sm" type="month" id="cmp-custom" value="' + h(other) + '" style="max-width:180px"></div>' : '';
        return seg + picker +
          '<div class="stats" style="margin-bottom:16px">' + kpi('Income', 'totalInc', true) + kpi('Expenses', 'totalExp', false) + kpi('Savings', 'savings', true) +
          '<div class="stat"><div class="k">Savings rate</div><div class="v num">' + A.rate.toFixed(1) + '%</div><div class="s num">vs ' + B.rate.toFixed(1) + '% <span class="delta ' + (A.rate >= B.rate ? 'pos' : 'neg') + '">' + (A.rate >= B.rate ? '+' : '') + (A.rate - B.rate).toFixed(1) + ' pts</span></div></div></div>' +
          '<div class="grid"><section class="card c7"><div class="card-h"><h3>Category by category</h3></div>' + App.legendHtml([[Calc.monthShort(key), App.css('--accent')], [Calc.monthShort(other), App.css('--text-3')]]) +
          '<div class="chart-box tall" style="height:' + Math.max(220, Math.min(cats.length, 12) * 34 + 40) + 'px"><canvas id="ch-cmp"></canvas></div></section>' +
          '<section class="card c5"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Category</th><th class="r">' + h(Calc.monthShort(key)) + '</th><th class="r">' + h(Calc.monthShort(other)) + '</th><th class="r">Change</th></tr></thead><tbody>' +
          cats.map((x) => { const d = x.a - x.b; return '<tr><td>' + h(x.cat.name) + '</td><td class="r num">' + fmt(x.a) + '</td><td class="r num muted">' + fmt(x.b) + '</td><td class="r num ' + (Math.abs(d) < 1 ? 'muted' : d > 0 ? 'neg' : 'pos') + '">' + (d > 0 ? '+' : d < 0 ? '−' : '') + fmt(Math.abs(d)) + '</td></tr>'; }).join('') +
          '</tbody></table></div></section></div>';
      },
      mount(view) {
        const c = App.ui.cmp;
        view.querySelectorAll('[data-cm]').forEach((b) => (b.onclick = () => { c.mode = b.dataset.cm; App.renderView(); }));
        const cc = view.querySelector('#cmp-custom'); if (cc) cc.onchange = (e) => { if (e.target.value) { c.custom = e.target.value; App.renderView(); } };
        if (c.mode === 'yearly') return yearlyMount();
        const key = App.ui.month;
        const other = c.mode === 'prev' ? Calc.addMonths(key, -1) : c.mode === 'lastyear' ? Calc.addMonths(key, -12) : (c.custom || Calc.addMonths(key, -1));
        const A = App.calc(key), B = App.calc(other);
        const cats = Store.state.categories.map((cat) => ({ cat, a: A.exp[cat.id] || 0, b: B.exp[cat.id] || 0 })).filter((x) => x.a || x.b).sort((x, y) => Math.max(y.a, y.b) - Math.max(x.a, x.b)).slice(0, 12);
        App.chart('ch-cmp', { type: 'bar', data: { labels: cats.map((x) => x.cat.name), datasets: [
          { label: Calc.monthShort(key), data: cats.map((x) => x.a), backgroundColor: App.css('--accent'), borderRadius: 5, barPercentage: 0.8, categoryPercentage: 0.7 },
          { label: Calc.monthShort(other), data: cats.map((x) => x.b), backgroundColor: App.css('--text-3') + '88', borderRadius: 5, barPercentage: 0.8, categoryPercentage: 0.7 }
        ] }, options: { indexAxis: 'y', scales: { x: { grid: { color: App.css('--line') }, ticks: { maxTicksLimit: 5 } }, y: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 11.5 } } } } } });
      }
    }
  };

  function yearsWithData() {
    const ys = new Set([Number(Calc.currentMk().slice(0, 4))]);
    Store.state.spends.forEach((s) => ys.add(Number(s.date.slice(0, 4))));
    Object.keys(Store.state.months).forEach((k) => ys.add(Number(k.slice(0, 4))));
    return Array.from(ys).sort();
  }
  function yearTotals(y) {
    const ms = Calc.yearMonths(y).map((k) => App.calc(k));
    const inc = ms.reduce((s, m) => s + m.totalInc, 0), exp = ms.reduce((s, m) => s + m.totalExp, 0);
    return { y, inc, exp, sav: inc - exp, logged: ms.reduce((s, m) => s + m.actual, 0) };
  }
  function yearly() {
    const ys = yearsWithData().map(yearTotals);
    return '<div class="grid"><section class="card c7"><div class="card-h"><h3>Year by year</h3></div>' + App.legendHtml([['Income', App.css('--pos')], ['Expenses', App.css('--neg')], ['Savings', App.css('--accent')]]) + '<div class="chart-box tall"><canvas id="ch-yr"></canvas></div></section>' +
      '<section class="card c5"><div class="tbl-wrap"><table class="tbl"><thead><tr><th>Year</th><th class="r">Income</th><th class="r">Expenses</th><th class="r">Savings</th></tr></thead><tbody>' +
      ys.map((x) => '<tr><td style="font-weight:750">' + x.y + '</td><td class="r num">' + fmt(x.inc) + '</td><td class="r num">' + fmt(x.exp) + '</td><td class="r num ' + (x.sav >= 0 ? 'pos' : 'neg') + '" style="font-weight:800">' + App.signed(x.sav) + '</td></tr>').join('') +
      '</tbody></table></div><p class="muted" style="font-size:12.5px;margin:12px 0 0">Months without data count default salaries and budgets, so early and future years include planned figures.</p></section></div>';
  }
  function yearlyMount() {
    const ys = yearsWithData().map(yearTotals);
    App.chart('ch-yr', { type: 'bar', data: { labels: ys.map((x) => String(x.y)), datasets: [
      { label: 'Income', data: ys.map((x) => x.inc), backgroundColor: App.css('--pos'), borderRadius: 6, maxBarThickness: 38 },
      { label: 'Expenses', data: ys.map((x) => x.exp), backgroundColor: App.css('--neg'), borderRadius: 6, maxBarThickness: 38 },
      { label: 'Savings', data: ys.map((x) => x.sav), backgroundColor: App.css('--accent'), borderRadius: 6, maxBarThickness: 38 }
    ] } });
  }
})();
