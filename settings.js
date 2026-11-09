/* My Budget: Settings, categories, month setup, backup/import, CSV, reports. */
(function () {
  'use strict';
  const { h, fmt, fmt2 } = App;
  const CFG = window.APP_CONFIG || {};
  const GROUPS = [['fixed', 'Fixed', 'Same every month: rent, loans'], ['musthave', 'Must have', 'Needed but varies: groceries, petrol'], ['optional', 'Optional', 'Nice to have: dining, travel, gifts']];
  const ACCENTS = [['blue', '#0088FF'], ['amber', '#FF8D28'], ['emerald', '#34C759'], ['violet', '#6155F5'], ['rose', '#FF2D55'], ['teal', '#00C3D0']];
  const TONE = { calendar: '--red', tag: '--orange', file: '--blue', palette: '--indigo', lock: '--gray', phone: '--blue', cloud: '--teal', cloudOff: '--orange', layers: '--green', info: '--gray', refresh: '--blue', download: '--green', upload: '--blue', trash: '--red', logout: '--red', sheet: '--green', user: '--gray' };
  const tile = (ic, danger) => '<span class="cat-ic sm" style="--c:var(' + (danger ? '--red' : (TONE[ic] || '--accent')) + ')">' + icon(ic, 16) + '</span>';
  const chev = '<svg class="ic chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>';
  const back = () => '';
  const li = (href, ic, label, val, extra) => '<a class="li" href="' + href + '"' + (extra || '') + '>' + tile(ic) + '<span class="main-t"><div class="t1">' + label + '</div></span>' + (val || val === 0 ? '<span class="val">' + val + '</span>' : '') + chev + '</a>';
  const btnLi = (attr, ic, label, val, danger) => '<button class="li' + (danger ? ' danger' : '') + '" ' + attr + '>' + tile(ic, danger) + '<span class="main-t"><div class="t1">' + label + '</div></span>' + (val ? '<span class="val">' + val + '</span>' : '') + '</button>';

  const PAGES = {};
  App.screens.settings = {
    title: () => ({ '': 'Settings', profile: 'Profile & Income', month: 'Month Setup', categories: 'Categories', appearance: 'Appearance', security: 'Security', data: 'Backup & Data', sync: 'Sync', install: 'Install App' })[App.ui.sub] || 'Settings',
    month: () => App.ui.sub === 'month',
    back: () => (App.ui.sub ? '#/settings' : ''),
    render() { return (PAGES[App.ui.sub] || PAGES['']).render(); },
    mount(view) { const p = PAGES[App.ui.sub] || PAGES['']; if (p.mount) p.mount(view); }
  };

  /* ---------- Menu ---------- */
  PAGES[''] = {
    render() {
      const s = App.S(), sync = App.syncInfo();
      const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      return '<div class="settings-grid"><div>' +
        '<a class="menu profile-card" href="#/settings/profile" style="text-decoration:none;color:inherit;display:flex"><div class="av">' + App.avatarHtml() + '</div><div style="flex:1;min-width:0"><div style="font-weight:780;font-size:17px">' + h(App.name1()) + '</div><div class="muted" style="font-size:13px">with ' + h(App.name2()) + ' · ' + h(App.cur) + ' ' + fmt(Calc.num(s.sal1) + Calc.num(s.sal2)) + '/month</div></div>' + icon('right', 18) + '</a>' +
        '<div class="section-title">Money</div><div class="menu">' +
          li('#/settings/month', 'calendar', 'Month setup', h(Calc.monthShort(App.ui.month))) +
          li('#/settings/categories', 'tag', 'Categories', Store.state.categories.length) +
          btnLi('data-report', 'file', 'Monthly report', '') +
        '</div>' +
        '<div class="section-title">App</div><div class="menu">' +
          li('#/settings/appearance', 'palette', 'Appearance', ({ auto: 'Automatic', light: 'Light', dark: 'Dark' })[App.prefs.appearance]) +
          li('#/settings/security', 'lock', 'Security & lock', Number(App.prefs.autolock) ? 'After ' + App.prefs.autolock + ' min' : 'Off') +
          li('#/settings/install', 'phone', 'Install on this device', standalone ? 'Installed' : '') +
        '</div></div><div>' +
        '<div class="section-title">Your data</div><div class="menu">' +
          li('#/settings/sync', Store.status === 'offline' || Store.status === 'error' ? 'cloudOff' : 'cloud', 'Sync & Google Sheet', h(sync.text)) +
          li('#/settings/data', 'layers', 'Backup, import & reset', '') +
        '</div>' +
        '<div class="section-title">About</div><div class="menu"><div class="li">' + tile('info') + '<span class="main-t"><div class="t1">' + h(CFG.appName || 'My Budget') + '</div><div class="t2">Version ' + h(CFG.appVersion || '') + ' · ' + Store.state.spends.length + ' spends saved</div></span></div>' +
          btnLi('data-lock', 'lock', 'Lock now', '') + '</div>' +
        '</div></div>';
    },
    mount(v) {
      v.querySelector('[data-report]').onclick = () => App.reportSheet();
      v.querySelector('[data-lock]').onclick = () => { if (Store.pinHash) App.lock(); else App.toast('Sign in once to use the lock'); };
    }
  };

  /* ---------- Profile ---------- */
  PAGES.profile = {
    render() {
      const s = App.S();
      return back() + '<div class="grid"><section class="card c6">' +
        '<div class="row" style="gap:16px;margin-bottom:18px"><div style="width:72px;height:72px;font-size:28px">' + App.avatarHtml() + '</div><div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn sm" id="av-up">' + icon('upload', 16) + 'Change photo</button>' + (s.avatar ? '<button class="btn sm ghost" id="av-rm">Remove</button>' : '') + '</div></div>' +
        '<div class="two"><label class="field"><span>Your name</span><input class="input" id="n1" value="' + h(s.name1) + '"></label><label class="field"><span>Partner\'s name</span><input class="input" id="n2" value="' + h(s.name2) + '"></label></div>' +
        '<div class="two"><label class="field"><span>Your monthly salary</span><input class="input" id="s1" inputmode="decimal" value="' + h(s.sal1) + '"></label><label class="field"><span>Partner\'s monthly salary</span><input class="input" id="s2" inputmode="decimal" value="' + h(s.sal2) + '"></label></div>' +
        '<p class="muted" style="font-size:13px;margin:-4px 0 16px">Default salaries set the income share for splitting shared costs and fill every month you have not set yourself. A month with a different salary goes in Month setup.</p>' +
        '<button class="btn primary block" id="save">Save</button></section></div>';
    },
    mount(v) {
      v.querySelector('#save').onclick = () => {
        const ops = [['name1', v.querySelector('#n1').value.trim() || 'Person 1'], ['name2', v.querySelector('#n2').value.trim() || 'Person 2'],
          ['sal1', Calc.num(v.querySelector('#s1').value)], ['sal2', Calc.num(v.querySelector('#s2').value)]]
          .filter(([k, val]) => String(App.S()[k]) !== String(val)).map(([key, value]) => ({ op: 'put', t: 'settings', row: { key, value } }));
        if (ops.length) Store.commit(ops); App.toast('Saved');
      };
      v.querySelector('#av-up').onclick = async () => {
        const f = await App.pickFile('image/*'); if (!f) return;
        try { const url = await resizeImage(f, 320); Store.commit({ op: 'put', t: 'settings', row: { key: 'avatar', value: url } }); App.toast('Photo updated'); }
        catch (e) { App.toast('Could not read that image'); }
      };
      const rm = v.querySelector('#av-rm'); if (rm) rm.onclick = () => Store.commit({ op: 'put', t: 'settings', row: { key: 'avatar', value: '' } });
    }
  };
  function resizeImage(file, size) {
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const s = Math.min(img.width, img.height), c = document.createElement('canvas'); c.width = c.height = size;
        c.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject; img.src = url;
    });
  }

  /* ---------- Month setup ---------- */
  PAGES.month = {
    render() {
      const key = App.ui.month, md = Store.state.months[key] || {}, s = App.S(), m = App.calc(key);
      const extras = (md.extra || []).length ? md.extra : [];
      const budgeted = Store.state.categories.filter((c) => c.kind === 'budgeted');
      const accCats = Store.state.categories.filter((c) => (m.agg.total[c.id] || 0) > 0 || Calc.has((md.accruals || {})[c.id]));
      const v = (x) => (Calc.has(x) ? h(x) : '');
      return back() + '<p class="sub" style="margin:0 0 14px;font-size:13.5px">Settings for <b>' + h(Calc.monthLabel(key)) + '</b> only. Leave a box empty to use the default. Use the month switcher above to change month.</p>' +
        '<div class="grid">' +
        '<section class="card c6"><div class="card-h"><h3>Income this month</h3></div>' +
          '<div class="two"><label class="field"><span>' + h(App.first1()) + '\'s salary</span><input class="input" data-f="income1" inputmode="decimal" placeholder="' + h(s.sal1) + '" value="' + v(md.income1) + '"></label>' +
          '<label class="field"><span>' + h(App.first2()) + '\'s salary</span><input class="input" data-f="income2" inputmode="decimal" placeholder="' + h(s.sal2) + '" value="' + v(md.income2) + '"></label></div>' +
          '<div class="field"><span>Extra income</span><div id="extras">' + extras.map(extraRow).join('') + '</div><button class="btn sm ghost" id="add-extra">' + icon('plus', 16) + 'Add income source</button></div>' +
        '</section>' +
        '<section class="card c6"><div class="card-h"><h3>Spread a big payment</h3></div><p class="muted" style="font-size:13px;margin:-6px 0 12px">For payments that cover several months (rent cheque, annual fee): enter the amount this month should carry. The difference stays in savings. Empty = actual spend.</p>' +
          (accCats.length ? accCats.map((c) => { const act = m.agg.total[c.id] || 0; return '<label class="field"><span class="between"><span class="row" style="gap:8px"><span class="cat-ic sm">' + catIcon(c.icon, 14) + '</span>' + h(c.name) + '</span><span class="muted num">actual ' + fmt(act) + '</span></span>' +
            '<input class="input" data-acc="' + h(c.id) + '" data-act="' + act + '" inputmode="decimal" placeholder="e.g. ' + fmt(act / 3) + ' (÷ 3)" value="' + v((md.accruals || {})[c.id]) + '"><small data-prev="' + h(c.id) + '"></small></label>'; }).join('') : '<div class="empty" style="padding:12px">Log spends for this month first; categories with spends appear here.</div>') +
        '</section>' +
        '<section class="card"><div class="card-h"><h3>Budgets this month</h3></div><p class="muted" style="font-size:13px;margin:-6px 0 12px">Used for categories with nothing logged this month. Empty = the category\'s default budget.</p>' +
          '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(210px,1fr));gap:0 14px">' + budgeted.map((c) => '<label class="field"><span class="row" style="gap:8px"><span class="cat-ic sm">' + catIcon(c.icon, 14) + '</span>' + h(c.name) + '</span><input class="input" data-bud="' + h(c.id) + '" inputmode="decimal" placeholder="' + fmt(c.budget) + '" value="' + v((md.budgets || {})[c.id]) + '"></label>').join('') + '</div>' +
        '</section>' +
        '<div class="span-all"><button class="btn primary block" id="save-month">Save ' + h(Calc.monthLabel(key)) + '</button></div></div>';
    },
    mount(v) {
      const prev = (inp) => {
        const out = v.querySelector('[data-prev="' + inp.dataset.acc + '"]'); const act = Number(inp.dataset.act); const val = parseFloat(inp.value);
        if (!inp.value || isNaN(val)) { out.textContent = ''; return; }
        const d = act - val; out.innerHTML = d > 0 ? 'Shows <b>' + fmt(val) + '</b> instead of ' + fmt(act) + ' · <span class="pos">' + fmt(d) + ' kept in savings</span>' : d < 0 ? '<span class="warn">' + fmt(-d) + ' more than you actually spent</span>' : 'Same as actual: no effect';
      };
      v.querySelectorAll('[data-acc]').forEach((i) => { prev(i); i.oninput = () => prev(i); });
      v.querySelector('#add-extra').onclick = () => { v.querySelector('#extras').insertAdjacentHTML('beforeend', extraRow({ desc: '', amount: '' })); bindExtras(); };
      const bindExtras = () => v.querySelectorAll('[data-rmx]').forEach((b) => (b.onclick = () => b.closest('.xrow').remove()));
      bindExtras();
      v.querySelector('#save-month').onclick = () => {
        const key = App.ui.month;
        const row = { month: key, income1: '', income2: '', extra: [], budgets: {}, accruals: {} };
        v.querySelectorAll('[data-f]').forEach((i) => { if (i.value.trim() !== '') row[i.dataset.f] = Calc.num(i.value); });
        v.querySelectorAll('.xrow').forEach((r) => { const d = r.querySelector('[data-xd]').value.trim(), a = Calc.num(r.querySelector('[data-xa]').value); if (d || a) row.extra.push({ desc: d, amount: a }); });
        v.querySelectorAll('[data-bud]').forEach((i) => { if (i.value.trim() !== '') row.budgets[i.dataset.bud] = Calc.num(i.value); });
        v.querySelectorAll('[data-acc]').forEach((i) => { if (i.value.trim() !== '') row.accruals[i.dataset.acc] = Calc.num(i.value); });
        // Keep accruals for categories not shown (no spends this month)
        const old = (Store.state.months[key] || {}).accruals || {};
        Object.keys(old).forEach((k) => { if (!v.querySelector('[data-acc="' + k + '"]')) row.accruals[k] = old[k]; });
        const empty = row.income1 === '' && row.income2 === '' && !row.extra.length && !Object.keys(row.budgets).length && !Object.keys(row.accruals).length;
        Store.commit(empty ? (Store.state.months[key] ? { op: 'del', t: 'months', id: key } : []) : { op: 'put', t: 'months', row });
        App.toast(Calc.monthLabel(key) + ' saved');
      };
    }
  };
  function extraRow(x) {
    return '<div class="xrow row" style="gap:8px;margin-bottom:8px"><input class="input" data-xd placeholder="Source, e.g. Bonus" value="' + h(x.desc || '') + '" style="flex:2">' +
      '<input class="input" data-xa inputmode="decimal" placeholder="Amount" value="' + h(x.amount || '') + '" style="flex:1;min-width:90px"><button class="icon-btn" data-rmx aria-label="Remove">' + icon('trash', 18) + '</button></div>';
  }

  /* ---------- Categories ---------- */
  PAGES.categories = {
    render() {
      const usage = {}; Store.state.spends.forEach((s) => { usage[s.catId] = (usage[s.catId] || 0) + 1; });
      const owner = (c) => (c.type === 'shared' ? 'Shared' : Number(c.owner) === 1 ? App.first1() : Number(c.owner) === 2 ? App.first2() : 'Personal · both');
      return back() + '<div class="between" style="margin-bottom:6px"><p class="sub" style="margin:0;font-size:13.5px">' + Store.state.categories.length + ' categories. Tap one to edit.</p><button class="btn sm primary" id="cat-add">' + icon('plus', 16) + 'New</button></div>' +
        '<div class="settings-grid">' + GROUPS.map((g) => {
          const list = Store.state.categories.filter((c) => c.group === g[0]);
          return '<div><div class="section-title">' + g[1] + ' <span style="text-transform:none;letter-spacing:0;font-weight:650">· ' + g[2] + '</span></div><div class="menu">' +
            (list.length ? list.map((c) => '<button class="li" data-cat="' + h(c.id) + '"><span class="cat-ic">' + catIcon(c.icon, 18) + '</span><span class="main-t"><div class="t1">' + h(c.name) + '</div><div class="t2">' + h(owner(c)) + ' · ' + (usage[c.id] || 0) + ' spends</div></span>' +
              '<span class="val num">' + (c.kind === 'budgeted' ? (c.budget ? fmt(c.budget) : 'no budget') : 'not budgeted') + '</span></button>').join('') : '<div class="li muted">None</div>') + '</div></div>';
        }).join('') + '</div>' +
        '<div class="section-title">Start over</div><div class="menu">' + btnLi('id="cat-reset"', 'refresh', 'Restore the default categories', '', true) + '</div>';
    },
    mount(v) {
      v.querySelector('#cat-add').onclick = () => catSheet();
      v.querySelectorAll('[data-cat]').forEach((b) => (b.onclick = () => catSheet(App.cat(b.dataset.cat))));
      v.querySelector('#cat-reset').onclick = async () => {
        if (!(await App.confirm({ title: 'Restore default categories?', message: 'Your custom categories are removed. Spends in a removed category will show as "Unknown category" until you edit them. Spends, income and months are kept.', ok: 'Restore defaults', danger: true }))) return;
        const ops = Store.state.categories.map((c) => ({ op: 'del', t: 'categories', id: c.id }))
          .concat(Store.DEFAULT_CATEGORIES.map((c, i) => ({ op: 'put', t: 'categories', row: Object.assign({}, c, { order: i }) })));
        Store.commit(ops); App.toast('Default categories restored');
      };
    }
  };

  function catSheet(cat) {
    const isNew = !cat;
    const c = cat ? Object.assign({}, cat) : { id: 'cat_' + App.uid(), name: '', icon: 'package', type: 'shared', owner: 0, kind: 'budgeted', group: 'optional', budget: 0, order: Store.state.categories.reduce((m, x) => Math.max(m, Number(x.order) || 0), 0) + 1 };
    const used = Store.state.spends.filter((s) => s.catId === c.id).length;
    const seg = (id, opts, val) => '<div class="seg full" id="' + id + '">' + opts.map((o) => '<button data-v="' + o[0] + '" class="' + (String(val) === String(o[0]) ? 'on' : '') + '">' + h(o[1]) + '</button>').join('') + '</div>';
    App.sheet({
      title: isNew ? 'New category' : 'Edit category', wide: true,
      body: '<label class="field"><span>Name</span><input class="input" id="c-name" value="' + h(c.name) + '" placeholder="e.g. Gym"></label>' +
        '<div class="field"><span>Icon</span><div class="icon-grid" id="c-icons">' + Object.keys(window.CAT_ICONS).map((k) => '<button data-i="' + k + '" class="' + (c.icon === k ? 'on' : '') + '" title="' + k + '">' + catIcon(k, 20) + '</button>').join('') + '</div></div>' +
        '<div class="field"><span>Who it belongs to</span>' + seg('c-type', [['shared', 'Shared'], ['personal', 'Personal']], c.type) + '<small>Shared costs are split by income share. Personal costs belong to one person.</small></div>' +
        '<div class="field" id="c-owner-f"><span>Whose</span>' + seg('c-owner', [[0, 'Whoever paid'], [1, App.first1()], [2, App.first2()]], c.owner) + '</div>' +
        '<div class="field"><span>Group</span>' + seg('c-group', GROUPS.map((g) => [g[0], g[1]]), c.group) + '</div>' +
        '<div class="field"><span>Budget</span>' + seg('c-kind', [['budgeted', 'Monthly budget'], ['nonbudgeted', 'Not budgeted']], c.kind) + '</div>' +
        '<label class="field" id="c-budget-f"><span>Monthly budget (' + h(App.cur) + ')</span><input class="input" id="c-budget" inputmode="decimal" value="' + h(c.budget || '') + '" placeholder="0"><small>Counted as planned spending in months with nothing logged in this category.</small></label>',
      foot: isNew ? '' : '<button class="btn danger" data-del>' + icon('trash', 18) + 'Delete category</button>', okAttr: 'data-save',
      onMount(el, api) {
        const segBind = (id, key, after) => el.querySelectorAll('#' + id + ' button').forEach((b) => (b.onclick = () => { c[key] = b.dataset.v; el.querySelectorAll('#' + id + ' button').forEach((x) => x.classList.toggle('on', x === b)); if (after) after(); }));
        const vis = () => { el.querySelector('#c-owner-f').style.display = c.type === 'personal' ? '' : 'none'; el.querySelector('#c-budget-f').style.display = c.kind === 'budgeted' ? '' : 'none'; };
        segBind('c-type', 'type', vis); segBind('c-owner', 'owner'); segBind('c-group', 'group'); segBind('c-kind', 'kind', vis); vis();
        el.querySelectorAll('#c-icons button').forEach((b) => (b.onclick = () => { c.icon = b.dataset.i; el.querySelectorAll('#c-icons button').forEach((x) => x.classList.toggle('on', x === b)); }));
        el.querySelector('[data-save]').onclick = () => {
          c.name = el.querySelector('#c-name').value.trim();
          if (!c.name) { el.querySelector('#c-name').focus(); return; }
          c.budget = Calc.num(el.querySelector('#c-budget').value); c.owner = c.type === 'personal' ? Number(c.owner) : 0;
          Store.commit({ op: 'put', t: 'categories', row: c }); api.close(); App.toast(isNew ? 'Category added' : 'Saved');
        };
        const del = el.querySelector('[data-del]');
        if (del) del.onclick = () => {
          const others = Store.state.categories.filter((x) => x.id !== c.id);
          const s2 = App.sheet({
            title: 'Delete ' + c.name + '?',
            body: used ? '<p class="sub">' + used + ' spend' + (used > 1 ? 's are' : ' is') + ' in this category. Move ' + (used > 1 ? 'them' : 'it') + ' to:</p><select class="input" id="mv">' + others.map((o) => '<option value="' + h(o.id) + '"' + (o.id === 'misc' ? ' selected' : '') + '>' + h(o.name) + '</option>').join('') + '</select>' : '<p class="sub">No spends use this category.</p>',
            foot: '<button class="btn" data-no>Cancel</button><button class="btn danger" data-yes>Delete</button>',
            onMount(e2, a2) {
              e2.querySelector('[data-no]').onclick = () => a2.close();
              e2.querySelector('[data-yes]').onclick = () => {
                const ops = [];
                if (used) { const to = e2.querySelector('#mv').value; Store.state.spends.filter((s) => s.catId === c.id).forEach((s) => ops.push({ op: 'put', t: 'spends', row: Object.assign({}, s, { catId: to }) })); }
                ops.push({ op: 'del', t: 'categories', id: c.id });
                Store.commit(ops); a2.close(); setTimeout(() => api.close(), 50); App.toast('Category deleted');
              };
            }
          });
          void s2;
        };
      }
    });
  }

  /* ---------- Appearance ---------- */
  PAGES.appearance = {
    render() {
      const acc = App.S().accent || 'amber', custom = acc.charAt(0) === '#';
      return back() + '<div class="grid"><section class="card c6"><div class="field"><span>Theme on this device</span><div class="seg full" id="ap">' + [['auto', 'Automatic'], ['light', 'Light'], ['dark', 'Dark']].map((x) => '<button data-v="' + x[0] + '" class="' + (App.prefs.appearance === x[0] ? 'on' : '') + '">' + x[1] + '</button>').join('') + '</div><small>Automatic follows your phone or computer.</small></div>' +
        '<div class="field"><span>Accent colour (all devices)</span><div class="swatches">' + ACCENTS.map((a) => '<button class="swatch ' + (acc === a[0] ? 'on' : '') + '" data-a="' + a[0] + '" style="background:' + a[1] + '" aria-label="' + a[0] + '"></button>').join('') +
        '<label class="swatch ' + (custom ? 'on' : '') + '" style="background:' + (custom ? acc : 'conic-gradient(#f43,#fc3,#3c6,#39f,#a4f,#f43)') + '" title="Custom colour"><input type="color" id="acc-c" value="' + (custom ? acc : '#e0a21f') + '"></label></div></div></section>' +
        '<section class="card c6"><div class="field" style="margin-bottom:0"><span>Loading animation (this device)</span><div class="ld-grid">' +
        App.LOADERS.map((x) => '<button class="ld-tile ' + ((App.prefs.loader || 'goo') === x[0] ? 'on' : '') + '" data-ld="' + x[0] + '">' + App.loader(true, x[0]) + '<span>' + h(x[1]) + '</span></button>').join('') +
        '</div><small>Shown when you pull down to refresh.</small></div></section></div>';
    },
    mount(v) {
      v.querySelectorAll('#ap [data-v]').forEach((b) => (b.onclick = () => { App.prefs.appearance = b.dataset.v; App.savePrefs(); App.applyTheme(); App.renderView(); }));
      const set = (val) => Store.commit({ op: 'put', t: 'settings', row: { key: 'accent', value: val } });
      v.querySelectorAll('[data-a]').forEach((b) => (b.onclick = () => set(b.dataset.a)));
      v.querySelector('#acc-c').onchange = (e) => set(e.target.value);
      v.querySelectorAll('[data-ld]').forEach((b) => (b.onclick = () => {
        App.prefs.loader = b.dataset.ld; App.savePrefs();
        v.querySelectorAll('[data-ld]').forEach((x) => x.classList.toggle('on', x === b));
        if (App.refreshLoader) App.refreshLoader();
      }));
    }
  };

  /* ---------- Security ---------- */
  PAGES.security = {
    render() {
      return back() + '<div class="grid"><section class="card c6"><div class="field"><span>Lock the app after</span><select class="input" id="al">' + [[0, 'Never'], [1, '1 minute'], [5, '5 minutes'], [15, '15 minutes'], [30, '30 minutes'], [60, '1 hour']].map((x) => '<option value="' + x[0] + '"' + (Number(App.prefs.autolock) === x[0] ? ' selected' : '') + '>' + x[1] + '</option>').join('') + '</select><small>Of no use, or in the background. Unlocking uses your 6-digit code and works offline.</small></div>' +
        '<div class="menu">' + btnLi('id="chg"', 'lock', 'Change your code', '') + btnLi('id="lk"', 'lock', 'Lock now', '') + btnLi('id="so"', 'logout', 'Sign out of this device', '', true) + '</div></section></div>';
    },
    mount(v) {
      v.querySelector('#al').onchange = (e) => { App.prefs.autolock = Number(e.target.value); App.savePrefs(); App.toast('Saved'); };
      v.querySelector('#lk').onclick = () => App.lock();
      v.querySelector('#so').onclick = async () => {
        if (await App.confirm({ title: 'Sign out of this device?', message: (Store.outbox.length ? Store.outbox.length + ' changes have not reached the Sheet yet and will be lost. ' : '') + 'This removes your data from this device only. It stays safe in the Google Sheet.', ok: 'Sign out', danger: true })) { Store.signOut(); App.lockScreen('signin'); }
      };
      v.querySelector('#chg').onclick = () => App.sheet({
        title: 'Change your code',
        body: '<label class="field"><span>Current code</span><input class="input" id="p0" type="password" inputmode="numeric" maxlength="6" autocomplete="current-password"></label><label class="field"><span>New 6-digit code</span><input class="input" id="p1" type="password" inputmode="numeric" maxlength="6" autocomplete="new-password"></label><label class="field"><span>New code again</span><input class="input" id="p2" type="password" inputmode="numeric" maxlength="6"></label><div class="pin-msg" id="pm"></div>',
        okAttr: 'data-ok',
        onMount(el, api) {
          el.querySelector('[data-ok]').onclick = async () => {
            const [a, b, c2] = ['#p0', '#p1', '#p2'].map((q) => el.querySelector(q).value.trim()); const pm = el.querySelector('#pm');
            if (!/^\d{6}$/.test(b)) { pm.textContent = 'The new code must be 6 digits'; return; }
            if (b !== c2) { pm.textContent = 'The new codes do not match'; return; }
            pm.style.color = 'var(--text-3)'; pm.textContent = 'Saving…';
            try { await Store.changePin(a, b); api.close(); App.toast('Code changed on all devices'); } catch (e) { pm.style.color = ''; pm.textContent = e.message; }
          };
        }
      });
    }
  };

  /* ---------- Install ---------- */
  PAGES.install = {
    render() {
      const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
      const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
      return back() + '<div class="grid"><section class="card c6">' +
        (standalone ? '<div class="empty">' + icon('check', 32) + 'Installed. You are using the app from your Home Screen.</div>' :
        App.installPrompt ? '<p class="sub">Add My Budget to this device so it opens like an app, full screen, with its own icon.</p><button class="btn primary block" id="inst">' + icon('download', 18) + 'Install app</button>' :
        ios ? '<ol class="sub" style="padding-left:20px;line-height:1.9;margin:0"><li>Open this page in <b>Safari</b>.</li><li>Tap the <b>Share</b> button (square with arrow).</li><li>Scroll and tap <b>Add to Home Screen</b>.</li><li>Tap <b>Add</b>. Open My Budget from the new icon.</li></ol>' :
        '<ol class="sub" style="padding-left:20px;line-height:1.9;margin:0"><li>Open the browser menu (⋮ in Chrome, or the install icon in the address bar on a computer).</li><li>Choose <b>Install app</b> or <b>Add to Home screen</b>.</li><li>Open My Budget from the new icon.</li></ol>') +
        '<p class="muted" style="font-size:13px;margin:16px 0 0">Your data lives in your Google Sheet, so the installed app, this browser and your computer all show the same numbers.</p></section></div>';
    },
    mount(v) { const b = v.querySelector('#inst'); if (b) b.onclick = async () => { App.installPrompt.prompt(); await App.installPrompt.userChoice; App.installPrompt = null; App.renderView(); }; }
  };

  /* ---------- Sync ---------- */
  PAGES.sync = {
    render() {
      const i = App.syncInfo();
      return back() + '<div class="grid"><section class="card c6"><div class="row" style="gap:14px;margin-bottom:16px"><span class="cat-ic" style="--c:var(--teal);width:52px;height:52px;border-radius:14px">' + icon(i.icon, 28) + '</span><div><div style="font-weight:780;font-size:17px">' + h(i.text) + '</div><div class="muted" style="font-size:13px">' + (Store.lastSync ? 'Last saved ' + new Date(Store.lastSync).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '') + '</div></div></div>' +
        (Store.lastError && Store.status !== 'idle' ? '<div class="notice warn" style="margin-bottom:14px">' + h(Store.lastError) + '</div>' : '') +
        '<div class="menu">' + btnLi('id="sn"', 'refresh', 'Sync now', Store.outbox.length ? Store.outbox.length + ' waiting' : '') + btnLi('id="rl"', 'download', 'Reload everything from the Sheet', '') +
        (CFG.sheetUrl ? '<a class="li" href="' + h(CFG.sheetUrl) + '" target="_blank" rel="noopener">' + tile('sheet') + '<span class="main-t"><div class="t1">Open the Google Sheet</div></span></a>' : '') + '</div>' +
        '<p class="muted" style="font-size:13px;margin:16px 0 0">Every change is saved on this device first, then sent to your Google Sheet. Without internet, changes wait here and go through when you are back online. Clearing the browser cache never loses data: just sign in again.</p></section></div>';
    },
    mount(v) {
      v.querySelector('#sn').onclick = async () => { App.toast('Syncing…'); await Store.flush(); await Store.refresh(); App.renderView(); App.toast(Store.outbox.length ? 'Still offline; will retry' : 'All saved'); };
      v.querySelector('#rl').onclick = async () => { App.toast('Loading…'); await Store.refresh(); App.renderView(); App.toast(Store.status === 'idle' ? 'Up to date with the Sheet' : Store.lastError || 'Could not reach the Sheet'); };
    }
  };

  /* ---------- Backup, import & reset ---------- */
  PAGES.data = {
    render() {
      const y = App.ui.month.slice(0, 4);
      return back() + '<div class="settings-grid"><div>' +
        '<div class="section-title">Backup</div><div class="menu">' + btnLi('id="exp"', 'download', 'Download a backup (.json)', '') + btnLi('id="imp"', 'upload', 'Import a backup', 'new or old app') + '</div>' +
        '<p class="muted" style="font-size:12.5px;margin:8px 4px 0">To bring in data from the old My Budget file: open it, go to Settings › Backup &amp; Restore › Export Data (JSON), then import that file here.</p>' +
        '<div class="section-title">Spends as CSV</div><div class="menu">' + btnLi('id="cimp"', 'upload', 'Import spends from CSV', '') + btnLi('id="cexp"', 'download', 'Export all spends to CSV', '') + btnLi('id="ctpl"', 'file', 'Download CSV template', '') + '</div>' +
        '</div><div><div class="section-title">Reset</div><div class="menu">' +
          btnLi('id="rm"', 'calendar', 'Clear ' + Calc.monthLabel(App.ui.month), '', true) + btnLi('id="ry"', 'calendar', 'Clear all of ' + y, '', true) + btnLi('id="ra"', 'trash', 'Erase everything', '', true) +
        '</div><p class="muted" style="font-size:12.5px;margin:8px 4px 0">Clearing removes the spends and month settings for that period from the Sheet too. Download a backup first if unsure.</p></div></div>';
    },
    mount(v) {
      v.querySelector('#exp').onclick = exportBackup;
      v.querySelector('#imp').onclick = importBackup;
      v.querySelector('#cimp').onclick = App.importCsv;
      v.querySelector('#cexp').onclick = () => App.exportCsv(Store.state.spends, 'all');
      v.querySelector('#ctpl').onclick = csvTemplate;
      v.querySelector('#rm').onclick = () => resetPeriod(App.ui.month, Calc.monthLabel(App.ui.month));
      v.querySelector('#ry').onclick = () => resetPeriod(App.ui.month.slice(0, 4), App.ui.month.slice(0, 4));
      v.querySelector('#ra').onclick = async () => {
        if (!(await App.confirm({ title: 'Erase everything?', message: 'All spends, months, categories and settings are deleted from this app and the Google Sheet. Your sign-in code stays the same.', ok: 'Continue', danger: true }))) return;
        if (!(await App.confirm({ title: 'Really erase everything?', message: 'This cannot be undone. Download a backup first if you might need it.', ok: 'Erase everything', danger: true }))) return;
        const fresh = Store.normalise(null); fresh.settings = { name1: App.name1(), name2: App.name2(), sal1: 0, sal2: 0 };
        Store.commit({ op: 'replace', data: fresh }); App.toast('Everything erased');
      };
    }
  };

  async function resetPeriod(prefix, label) {
    const spends = Store.state.spends.filter((s) => s.date.indexOf(prefix) === 0);
    const months = Object.keys(Store.state.months).filter((k) => k.indexOf(prefix) === 0);
    if (!spends.length && !months.length) { App.toast('Nothing to clear in ' + label); return; }
    if (!(await App.confirm({ title: 'Clear ' + label + '?', message: spends.length + ' spends and ' + months.length + ' month setting' + (months.length === 1 ? '' : 's') + ' will be deleted. Categories and other periods are kept.', ok: 'Clear ' + label, danger: true }))) return;
    Store.commit(spends.map((s) => ({ op: 'del', t: 'spends', id: s.id })).concat(months.map((k) => ({ op: 'del', t: 'months', id: k }))));
    App.toast(label + ' cleared');
  }

  function exportBackup() {
    const d = new Date(), stamp = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    App.download('My-Budget-backup-' + stamp + '.json', JSON.stringify({ app: 'mybudget', version: 1, exported: d.toISOString(), data: Store.state }), 'application/json');
    App.toast('Backup downloaded');
  }

  async function importBackup() {
    const f = await App.pickFile('.json,application/json'); if (!f) return;
    let data;
    try {
      const json = JSON.parse(await f.text());
      if (json.hb_cfg_v2 || json.hb_spends) data = Store.fromLegacy(json);
      else if (json.app === 'mybudget' && json.data) data = json.data;
      else throw new Error('x');
    } catch (e) { App.toast('That file is not a My Budget backup'); return; }
    const st = Store.normalise(data);
    const dates = st.spends.map((s) => s.date).sort();
    const known = new Set(Store.state.spends.map((s) => s.id));
    const fresh = st.spends.filter((s) => !known.has(s.id)).length;
    App.sheet({
      title: 'Import backup',
      body: '<div class="notice" style="margin-bottom:14px"><b>' + st.spends.length + ' spends</b>' + (dates.length ? ' from ' + App.dateLabel(dates[0], { day: 'numeric', month: 'short', year: 'numeric' }) + ' to ' + App.dateLabel(dates[dates.length - 1], { day: 'numeric', month: 'short', year: 'numeric' }) : '') +
        ', ' + st.categories.length + ' categories, ' + Object.keys(st.months).length + ' month settings. <b>' + fresh + '</b> spends are new to this app.</div>' +
        '<div class="menu">' + btnLi('data-m="merge"', 'layers', 'Merge (recommended)', 'add + update') + btnLi('data-m="replace"', 'refresh', 'Replace everything', '', true) + '</div>' +
        '<p class="muted" style="font-size:12.5px;margin:10px 2px 0"><b>Merge</b> adds new spends and updates matching ones; nothing already here is deleted. <b>Replace</b> makes the app and Sheet exactly match the file.</p>',
      onMount(el, api) {
        el.querySelector('[data-m="merge"]').onclick = () => {
          const ops = [];
          Object.keys(st.settings).forEach((k) => { if (k === 'avatar' && !st.settings[k]) return; if (String(App.S()[k]) !== String(st.settings[k])) ops.push({ op: 'put', t: 'settings', row: { key: k, value: st.settings[k] } }); });
          if (data.categories && data.categories.length) st.categories.forEach((c) => ops.push({ op: 'put', t: 'categories', row: c }));
          Object.keys(st.months).forEach((k) => ops.push({ op: 'put', t: 'months', row: Object.assign({ month: k }, st.months[k]) }));
          st.spends.forEach((s) => { const cur = Store.state.spends.find((x) => x.id === s.id); if (!cur || JSON.stringify(cur) !== JSON.stringify(s)) ops.push({ op: 'put', t: 'spends', row: s }); });
          Store.commit(ops); api.close(); App.toast('Imported · ' + fresh + ' new spends');
        };
        el.querySelector('[data-m="replace"]').onclick = async () => {
          if (!(await App.confirm({ title: 'Replace everything?', message: 'Everything in the app and the Google Sheet is replaced by this file.', ok: 'Replace', danger: true }))) return;
          Store.commit({ op: 'replace', data: st }); api.close(); App.toast('Replaced with the backup');
        };
      }
    });
  }

  /* ---------- CSV ---------- */
  App.csvMenu = () => App.sheet({
    title: 'Spends CSV',
    body: '<div class="menu">' + btnLi('data-x="imp"', 'upload', 'Import spends from CSV', '') + btnLi('data-x="exp"', 'download', 'Export what is shown', App.filteredSpends().length + ' spends') + btnLi('data-x="tpl"', 'file', 'Download CSV template', '') + '</div>' +
      '<p class="muted" style="font-size:12.5px;margin:10px 2px 0">Columns: Date, Category, Merchant, Paid By, Amount. Duplicates (same date, category, merchant and amount) are skipped.</p>',
    onMount(el, api) {
      el.querySelector('[data-x="imp"]').onclick = () => { api.close(); setTimeout(App.importCsv, 300); };
      el.querySelector('[data-x="exp"]').onclick = () => { App.exportCsv(App.filteredSpends(), App.ui.spends.scope === 'month' ? App.ui.month : App.ui.spends.scope === 'year' ? App.ui.month.slice(0, 4) : 'all'); api.close(); };
      el.querySelector('[data-x="tpl"]').onclick = () => { csvTemplate(); api.close(); };
    }
  });

  const q = (s) => '"' + String(s === undefined || s === null ? '' : s).replace(/"/g, '""') + '"';
  App.exportCsv = (list, tag) => {
    if (!list.length) { App.toast('No spends to export'); return; }
    const rows = list.slice().sort((a, b) => (a.date < b.date ? -1 : 1)).map((s) => { const c = App.cat(s.catId); return [s.date, c ? (c.type === 'shared' ? 'shared' : 'personal') : '', q(c ? c.name : ''), q(s.merchant), q(App.payer(s.paidBy)), Calc.num(s.amount).toFixed(2)].join(','); });
    App.download('Spends-' + tag + '.csv', 'Date,Type,Category,Merchant,Paid By,Amount\n' + rows.join('\n'), 'text/csv;charset=utf-8');
  };
  function csvTemplate() {
    const t = Calc.todayIso(), c = Store.state.categories;
    App.download('Spends-template.csv', ['# Date as YYYY-MM-DD (or DD/MM/YYYY). Amount as a number. Category must match a category name.',
      '# Paid By: ' + App.first1() + ' or ' + App.first2() + ' (or 1 / 2). Lines starting with # are ignored.',
      'Date,Category,Merchant,Paid By,Amount',
      t + ',' + q(c[0] ? c[0].name : 'Groceries') + ',Carrefour,' + q(App.first1()) + ',350.00',
      t + ',' + q(c[1] ? c[1].name : 'Petrol') + ',ENOC,' + q(App.first2()) + ',120.00'].join('\n'), 'text/csv;charset=utf-8');
  }
  function parseRow(line) {
    const out = []; let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) { const ch = line[i];
      if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
      else if (ch === ',' && !inQ) { out.push(cur); cur = ''; } else cur += ch; }
    out.push(cur); return out;
  }
  function normDate(raw) {
    raw = (raw || '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
    const m = raw.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
    if (m) { const d = Number(m[1]), mo = Number(m[2]); if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return m[3] + '-' + String(mo).padStart(2, '0') + '-' + String(d).padStart(2, '0');
      if (d >= 1 && d <= 12 && mo <= 31) return m[3] + '-' + String(d).padStart(2, '0') + '-' + String(mo).padStart(2, '0'); }
    return null;
  }
  App.importCsv = async () => {
    const f = await App.pickFile('.csv,text/csv,.txt'); if (!f) return;
    const lines = (await f.text()).replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#'));
    if (lines.length < 2) { App.toast('That file has no rows'); return; }
    const head = parseRow(lines[0]).map((x) => x.trim().toLowerCase());
    const col = (names) => { for (const n of names) { const i = head.indexOf(n); if (i >= 0) return i; } return -1; };
    const iD = col(['date']), iC = col(['category', 'cat']), iM = col(['merchant', 'description', 'desc', 'note', 'notes']), iP = col(['paid by', 'paidby', 'paid_by', 'person', 'who']), iA = col(['amount', 'amt', 'sum', 'value', 'price']);
    if (iD < 0 || iA < 0) { App.toast('The file needs Date and Amount columns'); return; }
    const cats = Store.state.categories, n1 = App.name1().toLowerCase(), n2 = App.name2().toLowerCase(), f1 = App.first1().toLowerCase(), f2 = App.first2().toLowerCase();
    const seen = new Set(Store.state.spends.map((s) => s.date + '|' + s.catId + '|' + Calc.num(s.amount).toFixed(2) + '|' + s.merchant.toLowerCase()));
    const ops = [], problems = []; let skipped = 0;
    for (let i = 1; i < lines.length; i++) {
      const r = parseRow(lines[i]); if (r.every((x) => !x.trim())) continue;
      const date = normDate(r[iD]); const amount = parseFloat(String(r[iA] || '').replace(/[, ]/g, ''));
      if (!date) { problems.push('Row ' + (i + 1) + ': date "' + (r[iD] || '') + '"'); skipped++; continue; }
      if (!(amount > 0)) { problems.push('Row ' + (i + 1) + ': amount "' + (r[iA] || '') + '"'); skipped++; continue; }
      const rc = iC >= 0 ? (r[iC] || '').trim().toLowerCase() : '';
      let cat = rc && (cats.find((c) => c.name.toLowerCase() === rc) || cats.find((c) => c.name.toLowerCase().includes(rc) || rc.includes(c.name.toLowerCase())));
      if (!cat) { cat = cats.find((c) => c.id === 'misc') || cats[0]; if (rc) problems.push('Row ' + (i + 1) + ': category "' + rc + '" → ' + cat.name); }
      const pb = iP >= 0 ? (r[iP] || '').trim().toLowerCase() : '';
      const paidBy = pb && (pb === '2' || pb === n2 || pb === f2 || pb === 'partner') ? 2 : 1;
      const merchant = iM >= 0 ? (r[iM] || '').trim() || 'Imported' : 'Imported';
      const k = date + '|' + cat.id + '|' + amount.toFixed(2) + '|' + merchant.toLowerCase();
      if (seen.has(k)) { skipped++; continue; } seen.add(k);
      ops.push({ op: 'put', t: 'spends', row: { id: 'imp_' + App.uid() + '_' + i, date, catId: cat.id, merchant, paidBy, amount: Math.round(amount * 100) / 100 } });
    }
    if (ops.length) Store.commit(ops);
    App.sheet({ title: 'CSV import', body: '<div class="notice"><b>' + ops.length + ' spends imported</b>' + (skipped ? ', ' + skipped + ' skipped (duplicates or unreadable rows)' : '') + '.</div>' +
      (problems.length ? '<div class="section-title">Check these</div><div class="sub" style="font-size:13px;line-height:1.7">' + problems.slice(0, 40).map(h).join('<br>') + (problems.length > 40 ? '<br>…and ' + (problems.length - 40) + ' more' : '') + '</div>' : '') });
  };

  /* ---------- Monthly report ---------- */
  App.reportSheet = () => {
    const key = App.ui.month;
    const opts = [['sum', 'Income & savings summary'], ['shared', 'Shared expenses'], ['personal', 'Personal expenses'], ['split', 'Who pays what'], ['pnl', 'Individual P&L'], ['log', 'Daily spends log']];
    App.sheet({
      title: 'Report · ' + Calc.monthLabel(key),
      body: '<div class="field"><span>Include</span>' + opts.map((o) => '<label class="row" style="padding:7px 0;font-weight:650;gap:12px"><input type="checkbox" data-o="' + o[0] + '" checked style="width:18px;height:18px;accent-color:var(--accent)">' + o[1] + '</label>').join('') + '</div>' +
        '<label class="field"><span>Notes (optional)</span><textarea class="input" id="rnotes" placeholder="Anything to remember about this month"></textarea></label>' +
        '<p class="muted" style="font-size:12.5px;margin:0">Downloads a page you can open, print or save as PDF.</p>',
      foot: '<button class="btn primary" data-go>' + icon('download', 18) + 'Download report</button>', okAttr: 'data-go2',
      onMount(el, api) {
        el.querySelector('[data-go2]').onclick = () => el.querySelector('[data-go]').click();
        el.querySelector('[data-go]').onclick = () => {
          const on = {}; el.querySelectorAll('[data-o]').forEach((c) => { on[c.dataset.o] = c.checked; });
          App.download('Budget-report-' + key + '.html', buildReport(key, on, el.querySelector('#rnotes').value), 'text/html;charset=utf-8');
          api.close(); App.toast('Report downloaded');
        };
      }
    });
  };

  function buildReport(key, on, notes) {
    const m = App.calc(key), n1 = App.name1(), n2 = App.name2();
    const R = (n) => fmt(n), cls = (n) => (n >= 0 ? 'pos' : 'neg');
    const exp = Store.state.categories.map((c) => ({ c, v: m.exp[c.id] || 0, a: m.attrib[c.id] || {} })).filter((x) => x.v > 0).sort((a, b) => b.v - a.v);
    let html = '';
    if (on.sum) html += '<section><h2>Income &amp; savings</h2><table><tr><th>Person</th><th class="r">Income</th><th class="r">Share</th></tr><tr><td>' + h(n1) + '</td><td class="r">' + R(m.sal1) + '</td><td class="r">' + Math.round(m.sh1 * 100) + '%</td></tr><tr><td>' + h(n2) + '</td><td class="r">' + R(m.sal2) + '</td><td class="r">' + Math.round(m.sh2 * 100) + '%</td></tr>' +
      m.extras.filter((x) => Calc.num(x.amount)).map((x) => '<tr><td>' + h(x.desc || 'Extra income') + '</td><td class="r">' + R(x.amount) + '</td><td></td></tr>').join('') +
      '<tr class="t"><td>Total income</td><td class="r">' + R(m.totalInc) + '</td><td></td></tr><tr class="t"><td>Total expenses</td><td class="r">' + R(m.totalExp) + '</td><td></td></tr><tr class="t"><td>Savings</td><td class="r ' + cls(m.savings) + '">' + App.signed(m.savings) + '</td><td class="r">' + m.rate.toFixed(1) + '%</td></tr></table></section>';
    const catTable = (list, title) => list.length ? '<section><h2>' + title + '</h2><table><tr><th>Category</th><th class="r">Amount</th><th class="r">' + h(n1) + '</th><th class="r">' + h(n2) + '</th></tr>' + list.map((x) => '<tr><td>' + h(x.c.name) + '</td><td class="r">' + R(x.v) + '</td><td class="r">' + R(x.a.p1 || 0) + '</td><td class="r">' + R(x.a.p2 || 0) + '</td></tr>').join('') + '<tr class="t"><td>Total</td><td class="r">' + R(list.reduce((s, x) => s + x.v, 0)) + '</td><td></td><td></td></tr></table></section>' : '';
    if (on.shared) html += catTable(exp.filter((x) => x.c.type === 'shared'), 'Shared expenses');
    if (on.personal) html += catTable(exp.filter((x) => x.c.type !== 'shared'), 'Personal expenses');
    if (on.split) html += '<section><h2>Who pays what</h2><table><tr><th></th><th class="r">' + h(n1) + '</th><th class="r">' + h(n2) + '</th></tr><tr><td>Shared</td><td class="r">' + R(m.p1_shared) + '</td><td class="r">' + R(m.p2_shared) + '</td></tr><tr><td>Personal</td><td class="r">' + R(m.p1_personal) + '</td><td class="r">' + R(m.p2_personal) + '</td></tr><tr class="t"><td>Total</td><td class="r">' + R(m.p1_total) + '</td><td class="r">' + R(m.p2_total) + '</td></tr></table></section>';
    if (on.pnl) html += '<section><h2>Individual P&amp;L</h2><table><tr><th></th><th class="r">Income</th><th class="r">Expense share</th><th class="r">Net</th></tr><tr><td>' + h(n1) + '</td><td class="r">' + R(m.sal1) + '</td><td class="r">' + R(m.p1_total) + '</td><td class="r ' + cls(m.sal1 - m.p1_total) + '">' + App.signed(m.sal1 - m.p1_total) + '</td></tr><tr><td>' + h(n2) + '</td><td class="r">' + R(m.sal2) + '</td><td class="r">' + R(m.p2_total) + '</td><td class="r ' + cls(m.sal2 - m.p2_total) + '">' + App.signed(m.sal2 - m.p2_total) + '</td></tr></table></section>';
    if (on.log) { const list = (Store.idx.byMonth[key] || []).slice().sort((a, b) => (a.date < b.date ? -1 : 1));
      html += '<section><h2>Daily spends (' + list.length + ')</h2><table><tr><th>Date</th><th>Category</th><th>Merchant</th><th>Paid by</th><th class="r">Amount</th></tr>' + list.map((s) => '<tr><td>' + h(App.dateLabel(s.date, { day: '2-digit', month: 'short' })) + '</td><td>' + h((App.cat(s.catId) || { name: '?' }).name) + '</td><td>' + h(s.merchant) + '</td><td>' + h(App.payer(s.paidBy)) + '</td><td class="r">' + fmt2(s.amount) + '</td></tr>').join('') + '<tr class="t"><td colspan="4">Total</td><td class="r">' + fmt2(m.actual) + '</td></tr></table></section>'; }
    if (notes.trim()) html += '<section><h2>Notes</h2><p style="white-space:pre-wrap">' + h(notes) + '</p></section>';
    return '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Budget report ' + h(Calc.monthLabel(key)) + '</title><style>' +
      'body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#1b1915;max-width:820px;margin:0 auto;padding:32px 20px;font-size:14px}header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #C98A0B;padding-bottom:14px;margin-bottom:8px}' +
      'h1{margin:0;font-size:26px}header p{margin:4px 0 0;color:#6b655c}h2{font-size:15px;margin:26px 0 8px;text-transform:uppercase;letter-spacing:.06em;color:#6b655c}table{width:100%;border-collapse:collapse}th,td{padding:7px 8px;border-bottom:1px solid #e5dfd5;text-align:left}th{font-size:12px;color:#8e877c}.r{text-align:right;font-variant-numeric:tabular-nums}tr.t td{font-weight:700;background:#f6f3ee}.pos{color:#1c8a57}.neg{color:#cf3f57}footer{margin-top:30px;color:#8e877c;font-size:12px}@media print{body{padding:0}}' +
      '</style></head><body><header><div><h1>' + h(Calc.monthLabel(key)) + '</h1><p>Household budget · ' + h(n1) + ' &amp; ' + h(n2) + ' · amounts in ' + h(App.cur) + '</p></div><div style="text-align:right;color:#6b655c;font-size:12px">Generated ' + new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + '</div></header>' + html +
      '<footer>My Budget · ' + h(Calc.monthLabel(key)) + '</footer></body></html>';
  }
})();
