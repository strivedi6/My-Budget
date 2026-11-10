/* My Budget — planned payments (rent cheques, loans, fees, bills).
 * Each plan repeats on a schedule. Due payments show on Summary ("Coming up") and in Settings ›
 * Planned payments, where one tap confirms them as a spend. Open payments count in the month's plan
 * (calc.js), and smart budgets use them for the months they fall in (smart.js).
 * Stored as JSON in the Settings tab of the database (key "planned"). */
(function () {
  'use strict';
  const { h, fmt, fmt2 } = App;
  const list = () => Calc.plannedList(Store.state);
  const save = (next, extraOps) => Store.commit([{ op: 'put', t: 'settings', row: { key: 'planned', value: JSON.stringify(next) } }].concat(extraOps || []));
  const today = () => Calc.todayIso();
  const dayDiff = (iso) => { const [y, m, d] = iso.split('-').map(Number), t = Calc.todayIso().split('-').map(Number); return Math.round((new Date(y, m - 1, d) - new Date(t[0], t[1] - 1, t[2])) / 864e5); };
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  const dateLong = (iso) => App.dateLabel(iso, { day: 'numeric', month: 'long', year: 'numeric' });

  function schedText(p) {
    const n = Math.max(1, Number(p.every) || 1);
    if (p.unit === 'once') return 'Once on ' + App.dateLabel(p.start, { day: 'numeric', month: 'short', year: 'numeric' });
    const unit = { week: 'week', month: 'month', year: 'year' }[p.unit] || 'month';
    let t = n === 1 ? 'Every ' + unit : 'Every ' + ord(n) + ' ' + unit;
    if (p.unit === 'month') { const days = (p.days && p.days.length ? p.days : [Number(String(p.start).slice(8))]).map(Number).sort((a, b) => a - b); t += ' on the ' + days.map(ord).join(days.length === 2 ? ' and ' : ', '); }
    if (p.unit === 'week') t += ' on ' + App.dateLabel(p.start, { weekday: 'long' });
    if (p.unit === 'year') t += ' on ' + App.dateLabel(p.start, { day: 'numeric', month: 'long' });
    if (p.endType === 'count') t += ' · ' + p.endCount + ' times';
    if (p.endType === 'date' && p.endDate) t += ' · until ' + App.dateLabel(p.endDate, { day: 'numeric', month: 'short', year: 'numeric' });
    return t;
  }
  function dueLabel(iso) {
    const d = dayDiff(iso);
    if (d < 0) return { text: 'Overdue ' + (-d) + ' day' + (d === -1 ? '' : 's'), tone: 'neg', icon: 'warning' };
    if (d === 0) return { text: 'Due today', tone: 'warn', icon: 'clock' };
    if (d === 1) return { text: 'Due tomorrow', tone: 'acc', icon: 'clock' };
    return { text: 'Due in ' + d + ' days', tone: 'acc', icon: 'clock' };
  }
  // Open dates for a plan: anything not yet paid from the last 60 days, and the next few to come.
  // Payments due before the plan was added are not chased.
  function openDates(p, ahead) {
    const back = Calc.addDaysIso(today(), -60), from = p.created && p.created > back ? p.created : back, to = Calc.addDaysIso(today(), ahead || 400);
    return Calc.occurrences(p, to).filter((d) => d >= from && !Calc.plannedStatus(Store.state, Store.idx, p, d));
  }
  const dueNow = (p) => openDates(p, 0).filter((d) => d <= today());
  App.plannedDueCount = () => list().reduce((n, p) => n + dueNow(p).length, 0);
  App.plannedBadge = () => { const n = App.plannedDueCount(); return n ? '<span class="badge-pill">' + n + ' due</span>' : (list().length || ''); };

  function markDone(p, iso, how, extraOps) {
    const next = list().map((x) => (x.id === p.id ? Object.assign({}, x, { done: Object.assign({}, x.done || {}, { [iso]: how }) }) : x));
    save(next, extraOps);
  }
  // Confirm a payment: logged as a spend on its due date (or today, if earlier), and marked paid.
  App.confirmPlanned = (id, iso, edit) => {
    const p = list().find((x) => x.id === id); if (!p) return;
    const date = iso > today() ? today() : iso;
    const draft = { id: App.uid(), date, catId: p.catId, merchant: p.name, paidBy: Number(p.paidBy) || App.me(), amount: p.amount };
    if (edit) App.spendSheet(draft, { draft: true, onSaved: (row) => markDone(p, iso, 'paid', [{ op: 'put', t: 'spends', row }]) });
    else { markDone(p, iso, 'paid', [{ op: 'put', t: 'spends', row: draft }]); App.toast('Paid · ' + App.cur + ' ' + fmt2(p.amount) + ' ' + p.name); }
  };

  /* ---------- Summary card: what is coming up ---------- */
  App.comingUpCard = () => {
    // One row per plan (its earliest open payment), with how many are open in the next 30 days.
    const items = [];
    let total = 0;
    list().forEach((p) => { const ds = openDates(p, 30); if (ds.length) { items.push({ p, d: ds[0], n: ds.length }); total += ds.length * Calc.num(p.amount); } });
    if (!items.length) return '';
    items.sort((a, b) => (a.d < b.d ? -1 : 1));
    return '<section class="card c4"><div class="card-h"><h3>Coming up</h3><a class="link" href="#/settings/planned">All planned</a></div>' +
      '<p class="card-q">Next 30 days · ' + App.cur + ' ' + fmt(total) + '</p><div class="list">' +
      items.slice(0, 4).map(({ p, d, n }) => { const c = App.cat(p.catId), L = dueLabel(d);
        return '<div class="li pp-li"><span class="cat-ic sm">' + catIcon(c ? c.icon : 'receipt', 15) + '</span><button class="main-t pp-open" data-pp-open="' + h(p.id) + '"><div class="t1">' + h(p.name) + '</div><div class="t2 ' + L.tone + '">' + L.text + (n > 1 ? ' · ' + n + ' open' : '') + '</div></button>' +
          '<span class="pp-r"><span class="amt num">' + fmt(p.amount) + '</span>' + (dayDiff(d) <= 3 ? '<button class="btn xs tint" data-pp-confirm="' + h(p.id) + '" data-d="' + d + '">Confirm</button>' : '') + '</span></div>';
      }).join('') + '</div></section>';
  };

  /* ---------- Settings › Planned payments ---------- */
  App.settingsPages.planned = {
    render() {
      const ps = list();
      const head = '<div class="pd-row" style="justify-content:space-between"><p class="muted" style="margin:0;font-size:14px;max-width:560px">Bills that repeat: rent cheques, loans, fees. Confirm each one when it is paid and it is logged as a spend.</p>' +
        '<button class="btn sm tint" data-pp-new>' + icon('plus', 16) + 'Add</button></div>';
      if (!ps.length) return head + '<section class="card"><div class="empty">No planned payments yet. Add your rent cheques, car loan or school fees so they show up before they are due.</div></section>';
      const rows = ps.map((p) => {
        const c = App.cat(p.catId), open = openDates(p), next = open[0], due = dueNow(p).length, L = next ? dueLabel(next) : null;
        return '<button class="li pp-row" data-pp-open="' + h(p.id) + '"><span class="cat-ic">' + catIcon(c ? c.icon : 'receipt', 18) + '</span><span class="main-t"><div class="t1">' + h(p.name) + '</div><div class="t2">' + h(schedText(p)) + '</div>' +
          '<div class="t2">' + h(c ? c.name : 'No category') + ' · ' + h(Number(p.paidBy) === 2 ? App.first2() : App.first1()) + '</div></span>' +
          '<span class="pp-r">' + (due ? '<span class="badge-n static">' + due + '</span>' : '') + '<span class="amt num">−' + fmt2(p.amount) + '</span><span class="pp-when ' + (L ? L.tone : 'muted') + '">' + (L ? (dayDiff(next) === 0 ? 'Today' : L.text.replace('Due ', '')) : 'Finished') + '</span></span></button>';
      }).join('');
      return head + '<section class="card"><div class="list">' + rows + '</div></section>';
    },
    mount(v) { const b = v.querySelector('[data-pp-new]'); if (b) b.onclick = () => editSheet(null); }
  };

  // One delegated handler, so the buttons work on Summary and in Settings alike.
  document.addEventListener('click', (e) => {
    const cf = e.target.closest('[data-pp-confirm]'); if (cf) { e.preventDefault(); App.confirmPlanned(cf.dataset.ppConfirm, cf.dataset.d, false); return; }
    const op = e.target.closest('[data-pp-open]'); if (op) { e.preventDefault(); detailSheet(op.dataset.ppOpen); }
  });

  /* ---------- Detail: payment overview ---------- */
  function detailSheet(id) {
    const p = list().find((x) => x.id === id); if (!p) return;
    const c = App.cat(p.catId);
    const open = openDates(p).slice(0, 4);
    const paid = Calc.occurrences(p, today()).filter((d) => Calc.plannedStatus(Store.state, Store.idx, p, d)).slice(-3).reverse();
    const body = '<div class="pp-hero"><span class="pp-big">' + catIcon(c ? c.icon : 'receipt', 34) + '</span><b>' + h(p.name) + '</b><span class="muted">' + h(c ? c.name : '') + ' · ' + h(schedText(p)) + '</span><span class="num pp-amt">−' + App.cur + ' ' + fmt2(p.amount) + '</span></div>' +
      '<div class="section-title" style="margin-top:18px">Payment overview</div>' +
      (open.length ? open.map((d) => { const L = dueLabel(d);
        return '<div class="pp-occ"><div><b>' + h(dateLong(d)) + '</b><div class="pp-due ' + L.tone + '">' + icon(L.icon, 16) + L.text + '</div></div>' +
          '<div class="pp-acts"><button class="btn sm tint" data-ok="' + d + '">Confirm</button><button class="btn sm" data-ed="' + d + '">Edit</button><button class="btn sm ghost" data-skip="' + d + '">Skip</button></div></div>'; }).join('')
        : '<div class="empty">Nothing left to pay on this schedule.</div>') +
      (paid.length ? '<div class="section-title" style="margin-top:18px">Recently paid</div><div class="list">' + paid.map((d) => '<div class="li"><span class="main-t"><div class="t1">' + h(dateLong(d)) + '</div></span><span class="val ' + (p.done && p.done[d] === 'skip' ? 'muted' : 'pos') + '">' + (p.done && p.done[d] === 'skip' ? 'Skipped' : 'Paid') + '</span></div>').join('') + '</div>' : '');
    App.sheet({
      title: 'Planned payment', body,
      foot: '<button class="btn" data-edit>' + icon('edit', 17) + 'Edit</button><button class="btn danger" data-del>' + icon('trash', 17) + 'Delete</button>',
      onMount(el, api) {
        el.querySelectorAll('[data-ok]').forEach((b) => (b.onclick = () => { api.close(); App.confirmPlanned(p.id, b.dataset.ok, false); }));
        el.querySelectorAll('[data-ed]').forEach((b) => (b.onclick = () => { api.close(); setTimeout(() => App.confirmPlanned(p.id, b.dataset.ed, true), 320); }));
        el.querySelectorAll('[data-skip]').forEach((b) => (b.onclick = () => { api.close(); markDone(p, b.dataset.skip, 'skip'); App.toast('Skipped ' + App.dateLabel(b.dataset.skip)); }));
        el.querySelector('[data-edit]').onclick = () => { api.close(); setTimeout(() => editSheet(p), 320); };
        el.querySelector('[data-del]').onclick = async () => {
          if (!(await App.confirm({ title: 'Delete ' + p.name + '?', message: 'Spends already logged from it stay as they are.', ok: 'Delete', danger: true }))) return;
          api.close(); save(list().filter((x) => x.id !== p.id)); App.toast('Deleted');
        };
      }
    });
  }

  /* ---------- Add / edit (with an iOS-style wheel for "every N weeks/months/years") ---------- */
  function wheel(id, items, value) {
    return '<div class="wheel-col" id="' + id + '" data-v="' + h(value) + '">' + items.map((x) => '<div class="wi" data-v="' + h(x[0]) + '">' + h(x[1]) + '</div>').join('') + '</div>';
  }
  function bindWheel(col, onChange) {
    const H = 36, items = Array.from(col.querySelectorAll('.wi'));
    const idx0 = Math.max(0, items.findIndex((x) => x.dataset.v === col.dataset.v));
    col.scrollTop = idx0 * H;
    const mark = () => { const i = Math.max(0, Math.min(items.length - 1, Math.round(col.scrollTop / H))); items.forEach((x, k) => x.classList.toggle('on', k === i)); if (col.dataset.v !== items[i].dataset.v) { col.dataset.v = items[i].dataset.v; App.haptic(); onChange(col.dataset.v); } };
    let t = 0; col.addEventListener('scroll', () => { clearTimeout(t); items.forEach((x, k) => x.classList.toggle('on', k === Math.round(col.scrollTop / H))); t = setTimeout(mark, 90); }, { passive: true });
    items.forEach((x, k) => (x.onclick = () => col.scrollTo({ top: k * H, behavior: 'smooth' })));
    items[idx0].classList.add('on');
  }
  function editSheet(orig) {
    const isNew = !orig;
    const p = Object.assign({ id: 'pp' + Date.now().toString(36), created: today(), name: '', catId: '', amount: '', paidBy: App.me(), every: 1, unit: 'month', days: [], start: today(), endType: 'never', endCount: 12, endDate: '', done: {} }, orig || {});
    if (!p.days || !p.days.length) p.days = [Number(String(p.start).slice(8))];
    const cats = Store.state.categories;
    const repeat = p.unit !== 'once';
    const seg = (id, opts, val) => '<div class="seg full" id="' + id + '">' + opts.map((o) => '<button type="button" data-v="' + o[0] + '" class="' + (String(val) === String(o[0]) ? 'on' : '') + '">' + h(o[1]) + '</button>').join('') + '</div>';
    const body =
      '<div class="amount-in"><span class="cur">' + h(App.cur) + '</span><input id="pp-amt" type="text" inputmode="decimal" autocomplete="off" placeholder="0" value="' + h(p.amount) + '" aria-label="Amount"></div>' +
      '<div class="money-grid" style="grid-template-columns:1fr;margin-bottom:14px">' +
        '<label class="field" style="margin:0"><span>Payment name</span><input class="input" id="pp-name" placeholder="e.g. Rent cheque, Car loan" value="' + h(p.name) + '"></label></div>' +
      '<div class="two"><label class="field"><span>Category</span><select class="input" id="pp-cat"><option value="">Choose…</option>' + cats.map((c) => '<option value="' + h(c.id) + '"' + (c.id === p.catId ? ' selected' : '') + '>' + h(c.name) + '</option>').join('') + '</select></label>' +
        '<label class="field"><span>First payment</span><input class="input" type="date" id="pp-start" value="' + h(p.start) + '"></label></div>' +
      '<div class="field"><span>Paid by</span>' + seg('pp-paid', [[1, App.first1()], [2, App.first2()]], p.paidBy) + '</div>' +
      '<div class="field"><span>Date and repeat</span>' + seg('pp-rep', [['once', 'One-time'], ['repeat', 'Repeat']], repeat ? 'repeat' : 'once') + '</div>' +
      '<div id="pp-repeat"' + (repeat ? '' : ' hidden') + '>' +
        '<p class="pp-sum" id="pp-sum"></p>' +
        '<div class="wheel"><span class="wheel-band"></span><span class="wheel-l">Every</span>' + wheel('pp-every', Array.from({ length: 12 }, (_, i) => [String(i + 1), String(i + 1)]), String(p.every)) +
          wheel('pp-unit', [['week', 'Week'], ['month', 'Month'], ['year', 'Year']], p.unit === 'once' ? 'month' : p.unit) + '</div>' +
        '<div class="field" id="pp-days-f"><span>Select dates</span><div class="date-grid" id="pp-days">' + Array.from({ length: 31 }, (_, i) => '<button type="button" data-d="' + (i + 1) + '" class="' + (p.days.includes(i + 1) ? 'on' : '') + '">' + (i + 1) + '</button>').join('') + '</div></div>' +
        '<div class="field"><span>Ends</span>' + seg('pp-end', [['never', 'Never'], ['count', 'After'], ['date', 'On date']], p.endType) +
          '<div class="row" style="gap:10px;margin-top:10px" id="pp-end-x"><input class="input" id="pp-count" inputmode="numeric" value="' + h(p.endCount) + '" style="max-width:110px"><span class="muted" id="pp-count-l">payments</span><input class="input" type="date" id="pp-enddate" value="' + h(p.endDate) + '"></div></div>' +
      '</div><p class="err" id="pp-err"></p>';
    App.sheet({
      title: isNew ? 'Add planned payment' : 'Edit planned payment', body, okAttr: 'data-save', wide: true,
      onMount(el, api) {
        const $ = (s) => el.querySelector(s);
        const segBind = (id, fn) => el.querySelectorAll('#' + id + ' button').forEach((b) => (b.onclick = () => { el.querySelectorAll('#' + id + ' button').forEach((x) => x.classList.toggle('on', x === b)); fn(b.dataset.v); }));
        let rep = repeat ? 'repeat' : 'once';
        const sum = () => {
          const q = Object.assign({}, p, { unit: rep === 'once' ? 'once' : p.unit, start: $('#pp-start').value || p.start });
          $('#pp-sum').textContent = schedText(q);
          $('#pp-days-f').hidden = q.unit !== 'month';
          $('#pp-count').hidden = $('#pp-count-l').hidden = p.endType !== 'count'; $('#pp-enddate').hidden = p.endType !== 'date'; $('#pp-end-x').hidden = p.endType === 'never';
          const next = Calc.occurrences(q, Calc.addDaysIso(today(), 800)).filter((d) => d >= today()).slice(0, 3);
          $('#pp-sum').textContent += next.length ? ' · next ' + next.map((d) => App.dateLabel(d, { day: 'numeric', month: 'short' })).join(', ') : '';
        };
        segBind('pp-paid', (v) => { p.paidBy = Number(v); });
        segBind('pp-rep', (v) => { rep = v; $('#pp-repeat').hidden = v === 'once'; sum(); });
        segBind('pp-end', (v) => { p.endType = v; sum(); });
        bindWheel($('#pp-every'), (v) => { p.every = Number(v); sum(); });
        bindWheel($('#pp-unit'), (v) => { p.unit = v; sum(); });
        el.querySelectorAll('#pp-days button').forEach((b) => (b.onclick = () => {
          const d = Number(b.dataset.d), on = !p.days.includes(d);
          if (!on && p.days.length === 1) return;   // keep at least one date
          p.days = on ? p.days.concat(d).sort((a, b2) => a - b2) : p.days.filter((x) => x !== d); b.classList.toggle('on', on); App.haptic(); sum();
        }));
        $('#pp-start').onchange = () => { if (p.days.length === 1) { p.days = [Number($('#pp-start').value.slice(8))]; el.querySelectorAll('#pp-days button').forEach((b) => b.classList.toggle('on', p.days.includes(Number(b.dataset.d)))); } sum(); };
        $('#pp-cat').onchange = () => { if (!$('#pp-name').value.trim()) { const c = App.cat($('#pp-cat').value); if (c) $('#pp-name').placeholder = c.name; } };
        sum();
        // The amount box grows with the number, like the spend sheet.
        const amt = $('#pp-amt');
        const fit = () => { amt.style.width = Math.max(1, (amt.value || '0').length) + 0.6 + 'ch'; };
        amt.addEventListener('input', () => { amt.value = amt.value.replace(/[^0-9.,]/g, '').replace(',', '.'); fit(); }); fit();
        if (isNew) setTimeout(() => amt.focus(), 350);
        $('[data-save]').onclick = () => {
          const amount = parseFloat(String($('#pp-amt').value).replace(/,/g, '')), err = $('#pp-err');
          p.catId = $('#pp-cat').value; p.start = $('#pp-start').value;
          p.name = $('#pp-name').value.trim() || (App.cat(p.catId) || {}).name || '';
          if (!amount || amount <= 0) { err.textContent = 'Enter the amount'; return; }
          if (!p.catId) { err.textContent = 'Choose a category'; return; }
          if (!p.start) { err.textContent = 'Pick the first payment date'; return; }
          p.amount = Math.round(amount * 100) / 100; if (rep === 'once') p.unit = 'once';
          p.endCount = Math.max(1, parseInt($('#pp-count').value, 10) || 1); p.endDate = $('#pp-enddate').value;
          if (p.unit !== 'month') p.days = [];
          const all = list(), next = isNew ? all.concat(p) : all.map((x) => (x.id === p.id ? p : x));
          save(next); api.close(); App.toast(isNew ? 'Planned payment added' : 'Saved');
        };
      }
    });
  }
})();
