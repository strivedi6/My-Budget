/* My Budget: app shell, navigation, sign-in, shared UI pieces and the add/edit spend sheet. */
(function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const LS = Store.LS;

  const App = window.App = {
    screens: {},
    charts: {},
    prefs: Object.assign({ appearance: 'auto', autolock: 5 }, LS.get('mb_prefs', {})),
    ui: {
      month: Calc.currentMk(),
      route: 'home',
      sub: '',
      locked: false,
      spends: { scope: 'month', q: '', cat: '', paid: '', limit: 120 },
      trend: 'monthly',
      who: 'both',
      insights: 'pnl',
      cmp: { mode: 'prev', custom: '' }
    },
    installPrompt: null
  };

  /* ---------------- Helpers ---------------- */
  const h = App.h = (s) => String(s === undefined || s === null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  App.fmt = (n) => (!isFinite(n) ? '0' : Math.round(n).toLocaleString('en-AE'));
  App.fmt2 = (n) => { n = Number(n) || 0; return Number.isInteger(Math.round(n * 100) / 100) ? Math.round(n).toLocaleString('en-AE') : n.toLocaleString('en-AE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  App.signed = (n) => (n < 0 ? '−' : '') + App.fmt(Math.abs(n));
  App.cur = CFG.currency || 'AED';
  App.S = () => Store.state.settings;
  App.name1 = () => (App.S().name1 || 'Person 1').trim();
  App.name2 = () => (App.S().name2 || 'Person 2').trim();
  App.first1 = () => App.name1().split(/\s+/)[0];
  App.first2 = () => App.name2().split(/\s+/)[0];
  App.payer = (n) => (Number(n) === 2 ? App.first2() : App.first1());
  App.cat = (id) => Store.idx.cats[id];
  App.calc = (key) => Calc.calcMonth(Store.state, Store.idx, key);
  App.css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  App.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  App.pct = (a, b) => (b > 0 ? a / b * 100 : 0);
  App.initial = () => (App.name1()[0] || 'M').toUpperCase();
  App.avatarHtml = () => {
    const a = App.S().avatar;
    return a ? '<div class="avatar"><img src="' + h(a) + '" alt=""></div>' : '<div class="avatar">' + h(App.initial()) + '</div>';
  };
  App.savePrefs = () => LS.set('mb_prefs', App.prefs);
  App.dateLabel = (iso, opts) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('en-GB', opts || { weekday: 'short', day: 'numeric', month: 'short' }); };
  App.rateClass = (r) => (r >= 20 ? 'pos' : r >= 10 ? 'warn' : 'neg');
  App.isDesktop = () => matchMedia('(min-width: 960px)').matches;
  App.deltaHtml = (a, b, goodUp) => {
    if (!b) return '<span class="delta muted">—</span>';
    const d = (a - b) / Math.abs(b) * 100;
    const good = goodUp ? d >= 0 : d <= 0;
    return '<span class="delta ' + (Math.abs(d) < 0.5 ? 'muted' : good ? 'pos' : 'neg') + '">' + icon(d >= 0 ? 'arrowUp' : 'arrowDown', 12) + Math.abs(d).toFixed(0) + '%</span>';
  };

  App.toast = (msg, ms) => {
    const t = document.getElementById('toast');
    t.textContent = msg; t.classList.add('show');
    clearTimeout(App._tt); App._tt = setTimeout(() => t.classList.remove('show'), ms || 2400);
  };

  App.download = (name, text, type) => {
    const blob = new Blob([text], { type: type || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  App.pickFile = (accept) => new Promise((resolve) => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = accept || '*/*';
    inp.onchange = () => resolve(inp.files && inp.files[0]); inp.click();
  });

  /* ---------------- Theme ---------------- */
  App.applyTheme = () => {
    const a = App.prefs.appearance;
    const dark = a === 'dark' || (a === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    const root = document.documentElement;
    root.setAttribute('data-theme', dark ? 'dark' : 'light');
    const acc = App.S().accent || 'amber';
    if (acc.charAt(0) === '#') { root.setAttribute('data-accent', 'custom'); root.style.setProperty('--accent', acc); }
    else { root.setAttribute('data-accent', acc); root.style.removeProperty('--accent'); }
    const m = document.querySelector('meta[name="theme-color"]');
    if (m) m.setAttribute('content', dark ? '#000000' : '#F2F2F7');
  };
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => { if (App.prefs.appearance === 'auto') { App.applyTheme(); App.renderView(); } });

  /* ---------------- Charts ---------------- */
  App.palette = () => ['--accent', '--p2', '--indigo', '--pink', '--green', '--orange', '--purple', '--blue', '--yellow', '--brown', '--mint', '--red', '--teal', '--gray'].map(App.css);
  App.destroyCharts = () => { Object.values(App.charts).forEach((c) => { try { c.destroy(); } catch (e) {} }); App.charts = {}; };
  App.chart = (id, cfg) => {
    const el = document.getElementById(id);
    if (!el || !window.Chart) return null;
    if (App.charts[id]) App.charts[id].destroy();
    const tick = App.css('--text-3'), grid = App.css('--line');
    Chart.defaults.font.family = App.css('--font') || 'Manrope';
    Chart.defaults.font.weight = 600;
    Chart.defaults.color = tick;
    const base = {
      responsive: true, maintainAspectRatio: false, animation: { duration: 500 },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: { backgroundColor: App.css('--text'), titleColor: App.css('--bg'), bodyColor: App.css('--bg'), padding: 10, cornerRadius: 10, boxPadding: 4, usePointStyle: true,
          callbacks: { label: (c) => ' ' + (c.dataset.label ? c.dataset.label + ': ' : '') + App.fmt(c.raw) } }
      }
    };
    if (cfg.type !== 'doughnut') {
      base.scales = {
        x: { grid: { display: false }, border: { display: false }, ticks: { color: tick, font: { size: 11 }, maxRotation: 0, autoSkipPadding: 8 } },
        y: { grid: { color: grid, drawTicks: false }, border: { display: false }, ticks: { color: tick, font: { size: 11 }, padding: 8, maxTicksLimit: 5, callback: (v) => (Math.abs(v) >= 1000 ? (v / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1) + 'k' : v) } }
      };
    }
    if (cfg.options && cfg.options.indexAxis === 'y' && base.scales) {
      const k = base.scales.y.ticks.callback;
      base.scales.y.ticks.callback = function (v) { const l = String(this.getLabelForValue(v)); return l.length > 13 ? l.slice(0, 12) + '…' : l; };
      base.scales.y.ticks.crossAlign = 'far';
      base.scales.x.ticks.callback = k;
    }
    cfg.options = deepMerge(base, cfg.options || {});
    const ch = App.charts[id] = new Chart(el, cfg);
    // Re-measure labels once the app font has loaded.
    if (document.fonts && !App._fontsOk) document.fonts.ready.then(() => { App._fontsOk = true; try { ch.update('none'); } catch (e) {} });
    return ch;
  };
  function deepMerge(a, b) {
    Object.keys(b).forEach((k) => { if (b[k] && typeof b[k] === 'object' && !Array.isArray(b[k]) && a[k] && typeof a[k] === 'object') deepMerge(a[k], b[k]); else a[k] = b[k]; });
    return a;
  }
  App.lineDs = (label, data, color, opts) => Object.assign({
    label, data, borderColor: color, backgroundColor: color + '22', pointRadius: 0, pointHoverRadius: 4, borderWidth: 2.2, tension: 0.35, fill: false, spanGaps: true
  }, opts || {});
  App.legendHtml = (items) => '<div class="row" style="gap:14px;flex-wrap:wrap;margin-bottom:10px;font-size:12.5px;font-weight:700;color:var(--text-2)">' +
    items.map((i) => '<span class="row" style="gap:6px"><i class="dot" style="background:' + i[1] + '"></i>' + h(i[0]) + '</span>').join('') + '</div>';

  /* ---------------- Sheets & dialogs ---------------- */
  App.sheet = (opt) => {
    const root = document.getElementById('sheet-root');
    const back = document.createElement('div'); back.className = 'sheet-back';
    const el = document.createElement('div'); el.className = 'sheet' + (opt.wide ? ' wide' : ''); el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true');
    el.innerHTML = '<div class="grab"></div><div class="sh-h"><button class="circle press" data-close aria-label="Close">' + icon('close', 20) + '</button><h2>' + h(opt.title || '') + '</h2>' +
      (opt.okAttr ? '<button class="circle tint press" ' + opt.okAttr + ' aria-label="Done">' + icon('check', 22) + '</button>' : '<span></span>') + '</div>' +
      '<div class="sh-b">' + (opt.body || '') + '</div>' + (opt.foot ? '<div class="sh-f">' + opt.foot + '</div>' : '');
    root.appendChild(back); root.appendChild(el);
    requestAnimationFrame(() => { back.classList.add('in'); el.classList.add('in'); });
    let closed = false;
    const api = {
      el,
      close(fromPop) {
        if (closed) return; closed = true;
        back.classList.remove('in'); el.classList.remove('in');
        setTimeout(() => { back.remove(); el.remove(); }, 300);
        App._sheets = App._sheets.filter((s) => s !== api);
        if (!fromPop && history.state && history.state.sheet) history.back();
        if (opt.onClose) opt.onClose();
      }
    };
    App._sheets.push(api);
    history.pushState({ sheet: true }, '');
    back.addEventListener('click', () => api.close());
    el.querySelector('[data-close]').addEventListener('click', () => api.close());
    // Swipe down on the handle area to close (phone).
    let y0 = null;
    el.querySelector('.grab').addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    el.querySelector('.sh-h').addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; }, { passive: true });
    el.addEventListener('touchmove', (e) => { if (y0 !== null) { const dy = e.touches[0].clientY - y0; if (dy > 0) el.style.transform = 'translateY(' + dy + 'px)'; } }, { passive: true });
    el.addEventListener('touchend', (e) => {
      if (y0 === null) return; const dy = e.changedTouches[0].clientY - y0; y0 = null; el.style.transform = '';
      if (dy > 110) api.close();
    });
    if (opt.onMount) opt.onMount(el, api);
    return api;
  };
  App._sheets = [];
  window.addEventListener('popstate', () => {
    const top = App._sheets[App._sheets.length - 1];
    if (top) { top.close(true); return; }
    App.readRoute();
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const top = App._sheets[App._sheets.length - 1]; if (top) top.close(); } });

  App.confirm = (o) => new Promise((resolve) => {
    const root = document.getElementById('sheet-root');
    const back = document.createElement('div'); back.className = 'alert-back';
    const el = document.createElement('div'); el.className = 'alert'; el.setAttribute('role', 'alertdialog');
    el.innerHTML = '<h2>' + h(o.title || 'Are you sure?') + '</h2><p>' + (o.html || h(o.message || '')) + '</p>' +
      '<div class="acts"><button class="btn" data-no>Cancel</button><button class="btn ' + (o.danger ? 'danger' : 'primary') + '" data-yes>' + h(o.ok || 'OK') + '</button></div>';
    root.appendChild(back); root.appendChild(el);
    requestAnimationFrame(() => { back.classList.add('in'); el.classList.add('in'); });
    const done = (v) => {
      back.classList.remove('in'); el.classList.remove('in');
      setTimeout(() => { back.remove(); el.remove(); }, 250);
      document.removeEventListener('keydown', onKey, true);
      resolve(v);
    };
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); done(false); } };
    document.addEventListener('keydown', onKey, true);
    el.querySelector('[data-no]').onclick = () => done(false);
    el.querySelector('[data-yes]').onclick = () => done(true);
    back.onclick = () => done(false);
  });

  /* ---------------- Routing ---------------- */
  const TABS = [
    ['home', 'Summary', 'home'], ['spends', 'Spends', 'list'], ['insights', 'Insights', 'chart'], ['settings', 'Settings', 'settings']
  ];
  App.go = (route, sub) => {
    const hash = '#/' + route + (sub ? '/' + sub : '');
    if (location.hash !== hash) history.pushState({}, '', hash);
    App.readRoute();
    window.scrollTo(0, 0);
  };
  App.readRoute = () => {
    const parts = (location.hash || '#/home').replace(/^#\/?/, '').split('/');
    App.ui.route = App.screens[parts[0]] ? parts[0] : 'home';
    App.ui.sub = parts[1] || '';
    if (!App.ui.locked && document.querySelector('.shell')) { App.renderNav(); App.renderView(); }
  };

  /* ---------------- Shell ---------------- */
  App.renderShell = () => {
    const app = document.getElementById('app');
    app.innerHTML =
      '<div class="shell">' +
        '<header class="navbar" id="navbar"></header>' +
        '<main class="content" id="view"></main>' +
      '</div>' +
      '<div class="tabdock"><nav class="tabbar glass" id="tabbar"></nav>' +
        '<button class="fab glass press" data-add aria-label="Add spend">' + icon('plus', 28) + '</button></div>';
    app.querySelector('[data-add]').onclick = () => App.spendSheet();
    App.renderNav();
  };

  App.renderNav = () => {
    const r = App.ui.route;
    const tb = document.getElementById('tabbar'); if (!tb) return;
    const i = Math.max(0, TABS.findIndex((t) => t[0] === r));
    tb.innerHTML = '<span class="tab-pill" style="width:calc((100% - 8px) / ' + TABS.length + ');transform:translateX(' + (i * 100) + '%)"></span>' +
      TABS.map((t) => '<a href="#/' + t[0] + '" class="tab ' + (r === t[0] ? 'on' : '') + '">' + icon(t[2], 25) + t[1] + '</a>').join('');
    App.renderSync();
  };

  App.syncInfo = () => {
    const n = Store.outbox.length, s = Store.status;
    if (s === 'saving') return { icon: 'cloud', text: 'Saving to Google Sheet…' };
    if (s === 'auth') return { icon: 'cloudOff', text: 'Sign in again to keep saving' };
    if (n && (s === 'offline' || s === 'error')) return { icon: 'cloudOff', text: n + ' change' + (n > 1 ? 's' : '') + ' waiting to save' };
    if (n) return { icon: 'cloud', text: n + ' change' + (n > 1 ? 's' : '') + ' waiting' };
    if (!Store.lastSync) return { icon: 'cloud', text: 'Not synced yet' };
    return { icon: 'cloud', text: 'Saved · ' + App.ago(Store.lastSync) };
  };
  App.ago = (iso) => {
    const s = (Date.now() - new Date(iso).getTime()) / 1000;
    if (s < 60) return 'just now'; if (s < 3600) return Math.floor(s / 60) + ' min ago';
    if (s < 86400) return Math.floor(s / 3600) + ' h ago'; return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  App.renderSync = () => {
    const i = App.syncInfo();
    const dot = document.getElementById('top-sync');
    if (dot) {
      dot.setAttribute('data-s', Store.status);
      dot.innerHTML = icon(i.icon, 21) + (Store.outbox.length && Store.status !== 'saving' ? '<span class="badge-n">' + Store.outbox.length + '</span>' : '');
      dot.title = i.text;
    }
  };

  App.monthSwitcher = () => {
    const m = App.ui.month, cur = m === Calc.currentMk();
    return '<div class="monthsw glass"><button data-mprev aria-label="Previous month">' + icon('left', 18) + '</button>' +
      '<button class="lbl ' + (cur ? 'cur' : '') + '" data-mpick title="Pick a month">' + h(Calc.monthShort(m)) + '</button>' +
      '<button data-mnext aria-label="Next month">' + icon('right', 18) + '</button></div>';
  };
  App.bindMonthSwitcher = (root) => {
    const set = (k) => { if (App.slideMonth) App.slideMonth(k > App.ui.month ? 1 : -1); App.ui.month = k; App.renderView(); };
    root.querySelectorAll('[data-mprev]').forEach((b) => (b.onclick = () => set(Calc.addMonths(App.ui.month, -1))));
    root.querySelectorAll('[data-mnext]').forEach((b) => (b.onclick = () => set(Calc.addMonths(App.ui.month, 1))));
    root.querySelectorAll('[data-mpick]').forEach((b) => (b.onclick = () => App.monthPicker()));
  };
  App.monthPicker = () => {
    let year = Calc.parseMk(App.ui.month).year;
    const draw = (el, api) => {
      const body = el.querySelector('.sh-b');
      const months = Calc.yearMonths(year);
      body.innerHTML = '<div class="between" style="margin-bottom:14px"><button class="icon-btn" data-y="-1">' + icon('left') + '</button><b style="font-size:18px">' + year + '</b><button class="icon-btn" data-y="1">' + icon('right') + '</button></div>' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px">' + months.map((k) => {
          const has = (Store.idx.byMonth[k] || []).length;
          return '<button class="chip ' + (k === App.ui.month ? 'on' : '') + '" data-k="' + k + '" style="justify-content:center;flex-direction:column;gap:0;padding:10px 4px;border-radius:14px">' + Calc.monShort(k) +
            '<small style="font-size:11px;color:var(--text-3);font-weight:650">' + (has ? has + ' spends' : (k === Calc.currentMk() ? 'now' : '&nbsp;')) + '</small></button>';
        }).join('') + '</div>' +
        '<button class="btn block" style="margin-top:14px" data-k="' + Calc.currentMk() + '">Go to this month</button>';
      body.querySelectorAll('[data-y]').forEach((b) => (b.onclick = () => { year += Number(b.dataset.y); draw(el, api); }));
      body.querySelectorAll('[data-k]').forEach((b) => (b.onclick = () => { if (App.slideMonth && b.dataset.k !== App.ui.month) App.slideMonth(b.dataset.k > App.ui.month ? 1 : -1); App.ui.month = b.dataset.k; api.close(); App.renderView(); }));
    };
    App.sheet({ title: 'Choose month', onMount: draw });
  };

  App.renderView = () => {
    if (App.ui.locked || !document.getElementById('view')) return;
    App.destroyCharts();
    const scr = App.screens[App.ui.route];
    const nav = document.getElementById('navbar');
    const title = typeof scr.title === 'function' ? scr.title() : scr.title;
    const sub = typeof scr.subtitle === 'function' ? scr.subtitle() : '';
    const showMonth = typeof scr.month === 'function' ? scr.month() : scr.month !== false;
    const backTo = typeof scr.back === 'function' ? scr.back() : '';
    nav.innerHTML = '<div class="nb-l">' + (backTo ? '<a class="circle glass press" href="' + backTo + '" aria-label="Back">' + icon('left', 22) + '</a>' :
        '<button class="circle glass press" data-go-settings aria-label="Settings">' + App.avatarHtml() + '</button>') + '</div>' +
      '<div class="nb-title">' + h(title) + '</div>' +
      '<div class="nb-r"><button class="circle glass press" id="top-sync" data-go-sync aria-label="Sync status"></button></div>';
    const gs = nav.querySelector('[data-go-settings]'); if (gs) gs.onclick = () => App.go('settings');
    nav.querySelector('[data-go-sync]').onclick = () => App.go('settings', 'sync');
    App.renderSync();
    const view = document.getElementById('view');
    view.innerHTML = '<div class="large-title"><div style="min-width:0"><h1>' + h(title) + '</h1>' + (sub ? '<div class="lt-sub">' + h(sub) + '</div>' : '') + '</div>' + (showMonth ? App.monthSwitcher() : '') + '</div>' + scr.render();
    App.bindMonthSwitcher(view.querySelector('.large-title'));
    if (scr.mount) scr.mount(view);
    App.onScroll();
  };
  App.onScroll = () => { document.body.classList.toggle('scrolled', window.scrollY > 34); };
  window.addEventListener('scroll', App.onScroll, { passive: true });

  /* ---------------- Lock / sign-in ---------------- */
  App.lockScreen = (mode) => {
    App.ui.locked = true;
    App.destroyCharts();
    App._sheets.slice().forEach((s) => s.close(true));
    const app = document.getElementById('app');
    const name = Store.hasData ? App.first1() : '';
    const notConfigured = !Store.configured();
    const title = mode === 'unlock' ? (name ? 'Hi, ' + name : 'Welcome back') : 'Sign in';
    const sub = mode === 'unlock' ? 'Enter your 6-digit code' : 'Enter your 6-digit code to load your budget';
    document.documentElement.classList.add('is-locked');
    app.innerHTML = '<div class="lock"><div class="lock-bg"><i></i><i></i><i></i></div><div class="lock-card">' +
      '<div class="avatar-xl"><span class="ripple"></span><span class="ripple"></span><span class="ripple"></span>' + (Store.hasData ? App.avatarHtml() : '<div class="avatar" style="background:var(--accent)">' + icon('wallet', 34) + '</div>') + '</div>' +
      '<h1>' + h(title) + '</h1><p>' + sub + '</p>' +
      (notConfigured ? '<div class="notice warn" style="margin-top:20px"><b>One step left.</b> Paste your Apps Script <b>/exec</b> link into <b>config.js</b> (apiUrl), then upload the folder again. See SETUP-GUIDE.md, step 3.</div>' :
      '<div class="pin-dots" id="dots">' + '<i></i>'.repeat(6) + '</div><div class="pin-msg" id="pinmsg"></div>' +
      '<div class="keypad">' + [[1, ''], [2, 'ABC'], [3, 'DEF'], [4, 'GHI'], [5, 'JKL'], [6, 'MNO'], [7, 'PQRS'], [8, 'TUV'], [9, 'WXYZ']].map((n) => '<button data-n="' + n[0] + '">' + n[0] + '<small>' + (n[1] || '&nbsp;') + '</small></button>').join('') +
      '<button class="fn" data-fn="help">' + (mode === 'unlock' ? 'Sign out' : '') + '</button><button data-n="0">0<small>&nbsp;</small></button><button class="fn" data-fn="del" aria-label="Delete">Delete</button></div>') +
      '</div></div>';
    if (notConfigured) return;
    let pin = '', busy = false;
    const dots = app.querySelector('#dots'), msg = app.querySelector('#pinmsg');
    const draw = () => dots.querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', i < pin.length));
    const fail = (t) => { msg.textContent = t; dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake'); pin = ''; draw(); if (navigator.vibrate) navigator.vibrate(80); };
    const submit = async () => {
      busy = true; msg.style.color = 'var(--text-3)'; msg.textContent = mode === 'unlock' ? '' : 'Checking…';
      try {
        if (mode === 'unlock' && Store.pinHash && await Store.checkPin(pin)) { return App.unlocked(); }
        if (mode === 'unlock' && !navigator.onLine) { msg.style.color = ''; return fail('Wrong code.'); }
        msg.style.color = 'var(--text-3)'; msg.textContent = 'Checking…';
        await Store.login(pin);
        App.unlocked(true);
      } catch (e) {
        msg.style.color = '';
        fail(e.code === 'NET' ? 'No connection. Check your internet and try again.' : e.message);
      } finally { busy = false; }
    };
    const press = (n) => { if (busy) return; App.haptic(); if (pin.length < 6) { pin += n; draw(); msg.textContent = ''; } if (pin.length === 6) setTimeout(submit, 120); };
    const del = () => { if (!busy) { pin = pin.slice(0, -1); draw(); } };
    app.querySelectorAll('[data-n]').forEach((b) => (b.onclick = () => press(b.dataset.n)));
    app.querySelector('[data-fn="del"]').onclick = del;
    app.querySelector('[data-fn="help"]').onclick = async () => {
      if (mode !== 'unlock') return;
      if (await App.confirm({ title: 'Sign out of this device?', message: Store.outbox.length ? 'There are ' + Store.outbox.length + ' changes not yet saved to the Sheet. Signing out now loses them.' : 'Your data stays in the Google Sheet. Sign in again with your code any time.', ok: 'Sign out', danger: true })) {
        Store.signOut(); App.lockScreen('signin');
      }
    };
    App._keyHandler = (e) => { if (!App.ui.locked || App._sheets.length) return; if (/^\d$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') del(); };
  };
  document.addEventListener('keydown', (e) => App._keyHandler && App._keyHandler(e));

  App.unlocked = (fresh) => {
    document.documentElement.classList.remove('is-locked');
    App.ui.locked = false;
    App.lastActive = Date.now();
    App.applyTheme();
    App.renderShell();
    App.readRoute();
    if (fresh) App.toast('Loaded from your Google Sheet');
    else Store.refresh();
  };

  App.lock = () => { if (Store.pinHash && Store.token) App.lockScreen('unlock'); };

  /* Auto-lock after inactivity or when the app has been in the background. */
  App.lastActive = Date.now();
  ['pointerdown', 'keydown', 'touchstart', 'scroll'].forEach((ev) => document.addEventListener(ev, () => { App.lastActive = Date.now(); }, { passive: true }));
  const autolockDue = () => { const m = Number(App.prefs.autolock) || 0; return m > 0 && !App.ui.locked && Store.pinHash && Date.now() - App.lastActive > m * 60000; };
  setInterval(() => { if (autolockDue()) App.lock(); }, 15000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      if (autolockDue()) return App.lock();
      if (!App.ui.locked && Store.token && (!Store.lastSync || Date.now() - new Date(Store.lastSync).getTime() > 60000)) Store.refresh();
    } else {
      Store.flush();
    }
  });

  Store.onChange((what) => {
    if (what === 'status') { App.renderSync(); if (Store.status === 'auth' && !App.ui.locked) { App.toast('Please sign in again to keep saving'); App.lockScreen('signin'); } return; }
    App.renderSync();
    if (!App.ui.locked && document.getElementById('view') && !App._sheets.length) { App.applyTheme(); App.renderNav(); App.renderView(); }
    else if (!App.ui.locked) App._dirty = true;
  });

  /* ---------------- Start ---------------- */
  App.start = () => {
    App.applyTheme();
    if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); App.installPrompt = e; });
    if (!Store.token || !Store.hasData) return App.lockScreen('signin');
    if ((Number(App.prefs.autolock) || 0) > 0 && Store.pinHash) return App.lockScreen('unlock');
    App.unlocked();
  };

  /* ================= Add / edit a spend ================= */
  App.merchantIndex = () => {
    const map = {};
    for (const s of Store.state.spends) {
      const k = (s.merchant || '').trim().toLowerCase(); if (!k) continue;
      const m = map[k] || (map[k] = { name: s.merchant.trim(), n: 0, cats: {}, paid: {}, last: '' });
      m.n++; m.cats[s.catId] = (m.cats[s.catId] || 0) + 1; m.paid[s.paidBy] = (m.paid[s.paidBy] || 0) + 1;
      if (s.date > m.last) m.last = s.date;
    }
    return map;
  };
  App.catUsage = () => {
    const use = {};
    const cutoff = Calc.addMonths(Calc.currentMk(), -6);
    for (const s of Store.state.spends) { use[s.catId] = (use[s.catId] || 0) + (s.date.slice(0, 7) >= cutoff ? 3 : 1); }
    return use;
  };
  const top = (o) => Object.keys(o).sort((a, b) => o[b] - o[a])[0];

  App.spendSheet = (existing) => {
    const isEdit = !!existing;
    const s = existing ? Object.assign({}, existing) : { id: App.uid(), date: Calc.todayIso(), catId: '', merchant: '', paidBy: 1, amount: '' };
    const merchants = App.merchantIndex();
    const usage = App.catUsage();
    const cats = Store.state.categories.slice().sort((a, b) => (usage[b.id] || 0) - (usage[a.id] || 0));
    if (!s.catId) s.catId = cats[0] ? cats[0].id : '';
    let showAll = false, catTouched = isEdit;
    const today = Calc.todayIso();
    const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); })();
    const mlist = Object.values(merchants).sort((a, b) => b.n - a.n).slice(0, 400);

    const body =
      '<div class="amount-in"><span class="cur">' + h(App.cur) + '</span><input id="sp-amt" type="text" inputmode="decimal" placeholder="0" autocomplete="off" value="' + (s.amount !== '' ? h(s.amount) : '') + '" aria-label="Amount"></div>' +
      '<label class="field"><span>Merchant or note</span><input class="input" id="sp-mer" list="sp-mlist" autocomplete="off" placeholder="e.g. Carrefour, Starbucks" value="' + h(s.merchant) + '">' +
      '<datalist id="sp-mlist">' + mlist.map((m) => '<option value="' + h(m.name) + '">').join('') + '</datalist></label>' +
      '<div class="field"><span>Category</span><div class="cat-grid" id="sp-cats"></div>' +
      '<button class="btn sm ghost" id="sp-more" style="margin-top:8px;width:100%"></button></div>' +
      '<div class="field"><span>Paid by</span><div class="seg full" id="sp-paid"><button data-p="1">' + h(App.first1()) + '</button><button data-p="2">' + h(App.first2()) + '</button></div></div>' +
      '<div class="field"><span>Date</span><div class="row" style="gap:8px;flex-wrap:wrap">' +
        '<button class="chip" data-d="' + today + '">Today</button><button class="chip" data-d="' + yest + '">Yesterday</button>' +
        '<input class="input sm" type="date" id="sp-date" value="' + h(s.date) + '" style="flex:1;min-width:150px"></div></div>' +
      '<div class="pin-msg" id="sp-err" style="text-align:center"></div>';
    const foot = isEdit ? '<button class="btn danger" data-del>' + icon('trash', 18) + 'Delete spend</button>' : '<button class="btn" data-again>Save &amp; add another</button>';

    App.sheet({
      title: isEdit ? 'Edit spend' : 'New spend', body, foot, okAttr: 'data-save',
      onMount(el, api) {
        const $ = (q) => el.querySelector(q);
        const drawCats = () => {
          const list = showAll ? cats : cats.slice(0, App.isDesktop() ? 12 : 8);
          if (!showAll && s.catId && !list.some((c) => c.id === s.catId)) { const c = App.cat(s.catId); if (c) list[list.length - 1] = c; }
          $('#sp-cats').innerHTML = list.map((c) => '<button type="button" class="cat-opt ' + (c.id === s.catId ? 'on' : '') + '" data-c="' + h(c.id) + '"><span class="cat-ic">' + catIcon(c.icon, 22) + '</span><span>' + h(c.name) + '</span></button>').join('');
          $('#sp-more').textContent = showAll ? 'Show fewer' : 'All categories (' + cats.length + ')';
          $('#sp-cats').querySelectorAll('[data-c]').forEach((b) => (b.onclick = () => { s.catId = b.dataset.c; catTouched = true; drawCats(); }));
        };
        const drawPaid = () => $('#sp-paid').querySelectorAll('button').forEach((b) => b.classList.toggle('on', Number(b.dataset.p) === Number(s.paidBy)));
        const drawDate = () => el.querySelectorAll('[data-d]').forEach((b) => b.classList.toggle('on', b.dataset.d === s.date));
        drawCats(); drawPaid(); drawDate();
        $('#sp-more').onclick = () => { showAll = !showAll; drawCats(); };
        $('#sp-paid').querySelectorAll('button').forEach((b) => (b.onclick = () => { s.paidBy = Number(b.dataset.p); drawPaid(); }));
        el.querySelectorAll('[data-d]').forEach((b) => (b.onclick = () => { s.date = b.dataset.d; $('#sp-date').value = s.date; drawDate(); }));
        $('#sp-date').onchange = (e) => { s.date = e.target.value; drawDate(); };
        $('#sp-mer').addEventListener('input', (e) => {
          const m = merchants[e.target.value.trim().toLowerCase()];
          if (m && !catTouched) { const c = top(m.cats); if (App.cat(c)) { s.catId = c; drawCats(); } s.paidBy = Number(top(m.paid)) || s.paidBy; drawPaid(); }
        });
        const amt = $('#sp-amt');
        const fit = () => { amt.style.width = Math.max(1, (amt.value || '0').length) + 0.6 + 'ch'; };
        amt.addEventListener('input', () => { amt.value = amt.value.replace(/[^0-9.,]/g, '').replace(',', '.'); fit(); }); fit();
        if (!isEdit) setTimeout(() => amt.focus(), 350);

        const save = (again) => {
          const amount = parseFloat(String(amt.value).replace(/,/g, ''));
          const err = $('#sp-err');
          if (!amount || amount <= 0) { err.textContent = 'Enter an amount'; amt.focus(); return; }
          if (!s.date) { err.textContent = 'Pick a date'; return; }
          if (!s.catId) { err.textContent = 'Pick a category'; return; }
          const row = { id: s.id, date: s.date, catId: s.catId, merchant: $('#sp-mer').value.trim() || 'Untitled', paidBy: s.paidBy, amount: Math.round(amount * 100) / 100 };
          Store.commit({ op: 'put', t: 'spends', row });
          const c = App.cat(row.catId);
          const inOther = row.date.slice(0, 7) !== App.ui.month;
          App.toast((isEdit ? 'Updated' : 'Saved') + ' · ' + App.cur + ' ' + App.fmt2(row.amount) + ' ' + (c ? c.name : '') + (inOther ? ' (' + Calc.monthShort(row.date.slice(0, 7)) + ')' : ''));
          if (navigator.vibrate) navigator.vibrate(15);
          if (again) {
            s.id = App.uid(); amt.value = ''; fit(); $('#sp-mer').value = ''; catTouched = false; err.textContent = ''; amt.focus();
          } else api.close();
        };
        $('[data-save]').onclick = () => save(false);
        const ag = $('[data-again]'); if (ag) ag.onclick = () => save(true);
        el.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type !== 'date') { e.preventDefault(); save(false); } });
        const del = $('[data-del]');
        if (del) del.onclick = async () => {
          if (await App.confirm({ title: 'Delete this spend?', message: (s.merchant || '') + ' · ' + App.cur + ' ' + App.fmt2(s.amount), ok: 'Delete', danger: true })) {
            Store.commit({ op: 'del', t: 'spends', id: s.id }); api.close(); App.toast('Deleted');
          }
        };
      },
      onClose() { if (App._dirty) { App._dirty = false; setTimeout(() => { if (!App._sheets.length) { App.renderNav(); App.renderView(); } }, 320); } }
    });
  };

  // Re-render after any sheet closes if data changed while it was open.
  const _sheet = App.sheet;
  App.sheet = (opt) => {
    const oc = opt.onClose;
    opt.onClose = () => { if (oc) oc(); if (App._dirty) { App._dirty = false; setTimeout(() => { if (!App._sheets.length && !App.ui.locked) { App.renderNav(); App.renderView(); } }, 320); } };
    return _sheet(opt);
  };
})();
