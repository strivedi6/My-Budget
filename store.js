/* My Budget: data store.
 * The Google Sheet is the real copy of everything. This device keeps:
 *   - a copy of the data (so the app opens instantly and works offline)
 *   - a queue of changes not yet saved to the Sheet (sent automatically, retried until they land)
 * If the browser storage is cleared, sign in again and everything reloads from the Sheet.
 */
(function () {
  'use strict';
  const CFG = window.APP_CONFIG || {};
  const LS = {
    get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  };

  const DEFAULT_CATEGORIES = [
    { id: 'rent', name: 'Rent', icon: 'home2', type: 'shared', owner: 0, kind: 'budgeted', group: 'fixed', budget: 0 },
    { id: 'dewa', name: 'DEWA', icon: 'zap', type: 'shared', owner: 0, kind: 'budgeted', group: 'fixed', budget: 0 },
    { id: 'chiller', name: 'Chiller', icon: 'snowflake', type: 'shared', owner: 0, kind: 'budgeted', group: 'fixed', budget: 0 },
    { id: 'car_loan', name: 'Car Loan', icon: 'car', type: 'shared', owner: 0, kind: 'budgeted', group: 'fixed', budget: 0 },
    { id: 'petrol', name: 'Petrol', icon: 'fuel', type: 'shared', owner: 0, kind: 'budgeted', group: 'musthave', budget: 0 },
    { id: 'groceries', name: 'Groceries', icon: 'cart', type: 'shared', owner: 0, kind: 'budgeted', group: 'musthave', budget: 0 },
    { id: 'baby', name: "Baby's Care", icon: 'baby', type: 'shared', owner: 0, kind: 'budgeted', group: 'musthave', budget: 0 },
    { id: 'misc', name: 'Miscellaneous', icon: 'package', type: 'shared', owner: 0, kind: 'nonbudgeted', group: 'optional', budget: 0 },
    { id: 'family1', name: 'Family Support', icon: 'heart', type: 'personal', owner: 1, kind: 'budgeted', group: 'musthave', budget: 0 },
    { id: 'school_fee', name: "Master's Fee", icon: 'graduation', type: 'personal', owner: 1, kind: 'budgeted', group: 'fixed', budget: 0 }
  ];

  function emptyState() {
    return { settings: { name1: 'Person 1', name2: 'Person 2', sal1: 0, sal2: 0 }, categories: JSON.parse(JSON.stringify(DEFAULT_CATEGORIES)), spends: [], months: {} };
  }

  function normalise(data) {
    const st = emptyState();
    if (!data) return st;
    st.settings = Object.assign({}, st.settings, data.settings || {});
    ['sal1', 'sal2'].forEach((k) => { st.settings[k] = Calc.num(st.settings[k]); });
    if (Array.isArray(data.categories) && data.categories.length) {
      st.categories = data.categories.map((c, i) => ({
        id: String(c.id), name: String(c.name || 'Untitled'), icon: c.icon || 'package',
        type: c.type === 'personal' ? 'personal' : 'shared', owner: Number(c.owner) || 0,
        kind: c.kind === 'nonbudgeted' ? 'nonbudgeted' : 'budgeted',
        group: ['fixed', 'musthave', 'optional'].indexOf(c.group) >= 0 ? c.group : 'optional',
        budget: Calc.num(c.budget), order: c.order === '' || c.order === undefined ? i : Number(c.order)
      }));
    }
    st.spends = (data.spends || []).filter((s) => s && s.id && s.date).map((s) => ({
      id: String(s.id), date: String(s.date).slice(0, 10), catId: String(s.catId || ''), merchant: String(s.merchant || ''),
      paidBy: Number(s.paidBy) === 2 ? 2 : 1, amount: Calc.num(s.amount)
    }));
    st.months = {};
    Object.keys(data.months || {}).forEach((k) => {
      const m = data.months[k] || {};
      st.months[k] = {
        income1: Calc.has(m.income1) ? Calc.num(m.income1) : '',
        income2: Calc.has(m.income2) ? Calc.num(m.income2) : '',
        extra: Array.isArray(m.extra) ? m.extra : [],
        budgets: m.budgets && typeof m.budgets === 'object' ? m.budgets : {},
        accruals: m.accruals && typeof m.accruals === 'object' ? m.accruals : {}
      };
    });
    return st;
  }

  /* Converts a backup from the previous desktop app (hb_* keys) into this app's format. */
  function fromLegacy(json) {
    const cfg = typeof json.hb_cfg_v2 === 'string' ? JSON.parse(json.hb_cfg_v2) : (json.hb_cfg_v2 || {});
    const monthly = typeof json.hb_monthly === 'string' ? JSON.parse(json.hb_monthly) : (json.hb_monthly || {});
    const spends = typeof json.hb_spends === 'string' ? JSON.parse(json.hb_spends) : (json.hb_spends || []);
    const months = {};
    Object.keys(monthly).forEach((k) => {
      const mi = Number(k); const v = monthly[k] || {};
      const key = Calc.mk(2026 + Math.floor(mi / 12), mi % 12);
      const o = { income1: '', income2: '', extra: v.extra_income || [], budgets: {}, accruals: {} };
      Object.keys(v).forEach((kk) => {
        if (kk === 'income1' || kk === 'income2') o[kk] = v[kk];
        else if (kk.indexOf('accrual_') === 0) o.accruals[kk.slice(8)] = v[kk];
        else if (kk !== 'extra_income') o.budgets[kk] = v[kk];
      });
      months[key] = o;
    });
    let accent = json.hb_color_theme ? JSON.parse(json.hb_color_theme) : (cfg.colorTheme || '');
    if (accent === 'custom') { try { accent = JSON.parse(json.hb_custom_color); } catch (e) { accent = ''; } }
    const settings = { name1: cfg.name1 || 'Person 1', name2: cfg.name2 || 'Person 2', sal1: cfg.sal1 || 0, sal2: cfg.sal2 || 0 };
    if (cfg.avatar) settings.avatar = cfg.avatar;
    if (accent) settings.accent = accent;
    return {
      settings,
      categories: (cfg.categories || []).map((c, i) => Object.assign({}, c, { order: i })),
      spends: spends.map((s) => ({ id: String(s.id), date: s.date, catId: s.catId || s.catKey, merchant: s.merchant, paidBy: s.paidBy, amount: s.amount })),
      months
    };
  }

  /* ---------------- Store ---------------- */
  const Store = {
    state: normalise(LS.get('mb_state', null)),
    idx: null,
    outbox: LS.get('mb_outbox', []),
    token: LS.get('mb_token', ''),
    pinHash: LS.get('mb_pinhash', ''),
    lastSync: LS.get('mb_last_sync', ''),
    hasData: !!LS.get('mb_state', null),
    status: 'idle', // idle | saving | offline | error | auth
    lastError: '',
    listeners: [],
    DEFAULT_CATEGORIES,
    fromLegacy,
    normalise,
    LS,

    configured() { return !!(CFG.apiUrl && /^https:\/\//.test(CFG.apiUrl)); },
    onChange(fn) { this.listeners.push(fn); },
    emit(what) { this.listeners.forEach((fn) => { try { fn(what); } catch (e) { console.error(e); } }); },
    reindex() { this.idx = Calc.buildIndex(this.state); },
    persist() {
      this.reindex();
      if (!LS.set('mb_state', this.state)) {
        // Storage full (usually a large photo): keep working, the Sheet still has everything.
        const slim = Object.assign({}, this.state, { settings: Object.assign({}, this.state.settings, { avatar: '' }) });
        LS.set('mb_state', slim);
      }
      LS.set('mb_outbox', this.outbox);
      this.hasData = true;
    },

    /* ----- local changes ----- */
    applyLocal(op) {
      const st = this.state;
      if (op.op === 'replace') { this.state = normalise(op.data); return; }
      if (op.t === 'settings') {
        if (op.op === 'put') st.settings[op.row.key] = op.row.value;
        else delete st.settings[op.id];
        return;
      }
      if (op.t === 'months') {
        if (op.op === 'put') { const r = Object.assign({}, op.row); const k = r.month; delete r.month; st.months[k] = normalise({ months: { [k]: r } }).months[k]; }
        else delete st.months[op.id];
        return;
      }
      const list = op.t === 'spends' ? st.spends : st.categories;
      const i = list.findIndex((x) => x.id === (op.op === 'put' ? op.row.id : op.id));
      if (op.op === 'put') {
        const row = op.t === 'spends' ? normalise({ spends: [op.row] }).spends[0] : normalise({ categories: [op.row] }).categories[0];
        if (!row) return;
        if (i >= 0) list[i] = row; else list.push(row);
        if (op.t === 'categories') list.sort((a, b) => (a.order || 0) - (b.order || 0));
      } else if (i >= 0) list.splice(i, 1);
    },

    /** Apply changes now, save on this device, and queue them for the Sheet. */
    commit(ops, what) {
      ops = Array.isArray(ops) ? ops : [ops];
      ops.forEach((op) => this.applyLocal(op));
      ops.forEach((op) => this.outbox.push(op));
      this.persist();
      this.emit(what || 'data');
      this.scheduleFlush(400);
    },

    /* ----- server ----- */
    async api(action, data, timeoutMs) {
      if (!this.configured()) throw Object.assign(new Error('The backend link is not set in config.js yet.'), { code: 'CONFIG' });
      const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs || 45000) : null;
      let res;
      try {
        res = await fetch(CFG.apiUrl, { method: 'POST', body: JSON.stringify(Object.assign({ action, token: this.token }, data || {})), signal: ctrl ? ctrl.signal : undefined, redirect: 'follow' });
      } catch (e) {
        throw Object.assign(new Error('No connection. Your changes are kept on this device.'), { code: 'NET' });
      } finally { if (timer) clearTimeout(timer); }
      let json;
      try { json = await res.json(); } catch (e) { throw Object.assign(new Error('The backend did not answer properly. Check the /exec link and that access is set to Anyone.'), { code: 'BAD' }); }
      if (!json.ok) {
        const err = Object.assign(new Error(json.error || 'Something went wrong.'), { code: json.code || '' });
        if (json.code === 'AUTH') { this.setStatus('auth'); }
        throw err;
      }
      return json;
    },

    async status_() { return this.api('status', {}, 20000); },

    async login(pin) {
      const json = await this.api('login', { pin, device: deviceName() });
      this.token = json.token; LS.set('mb_token', this.token);
      this.pinHash = await hashPin(pin); LS.set('mb_pinhash', this.pinHash);
      this.receive(json.data);
      return json;
    },

    receive(data) {
      // Server copy, plus any changes still waiting to be sent.
      this.state = normalise(data);
      this.outbox.forEach((op) => this.applyLocal(op));
      this.lastSync = new Date().toISOString(); LS.set('mb_last_sync', this.lastSync);
      this.persist();
      this.emit('data');
    },

    async refresh() {
      if (!this.token || !this.configured()) return;
      await this.flush();
      if (this.outbox.length) return; // still offline; keep local
      try {
        const json = await this.api('load');
        this.receive(json.data);
        this.setStatus('idle');
      } catch (e) {
        this.lastError = e.message;
        if (e.code === 'NET') this.setStatus('offline');
        else if (e.code !== 'AUTH') this.setStatus('error');
      }
    },

    flushTimer: null, flushing: false, retryMs: 4000,
    scheduleFlush(ms) {
      clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => this.flush(), ms || 0);
    },
    async flush() {
      if (this.flushing || !this.outbox.length || !this.token || !this.configured()) {
        if (!this.outbox.length && this.status === 'saving') this.setStatus('idle');
        return;
      }
      this.flushing = true;
      this.setStatus('saving');
      const batch = this.outbox.slice(0, 250);
      try {
        await this.api('sync', { ops: batch }, 90000);
        this.outbox.splice(0, batch.length);
        LS.set('mb_outbox', this.outbox);
        this.lastSync = new Date().toISOString(); LS.set('mb_last_sync', this.lastSync);
        this.retryMs = 4000;
        this.flushing = false;
        if (this.outbox.length) return this.flush();
        this.setStatus('idle');
      } catch (e) {
        this.flushing = false;
        this.lastError = e.message;
        if (e.code === 'AUTH') return;
        this.setStatus(e.code === 'NET' ? 'offline' : 'error');
        this.scheduleFlush(this.retryMs);
        this.retryMs = Math.min(this.retryMs * 2, 120000);
      }
    },

    setStatus(s) { if (this.status !== s) { this.status = s; this.emit('status'); } },

    async changePin(oldPin, newPin) {
      await this.api('changePin', { oldPin, newPin });
      this.pinHash = await hashPin(newPin); LS.set('mb_pinhash', this.pinHash);
    },

    signOut() {
      const t = this.token;
      if (t && this.configured()) this.api('logout', {}).catch(() => {});
      ['mb_state', 'mb_outbox', 'mb_token', 'mb_pinhash', 'mb_last_sync'].forEach((k) => LS.del(k));
      this.token = ''; this.pinHash = ''; this.outbox = []; this.state = emptyState(); this.hasData = false;
    },

    async checkPin(pin) { return !!this.pinHash && (await hashPin(pin)) === this.pinHash; }
  };

  async function hashPin(pin) {
    const text = 'mybudget:' + pin;
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
      return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    }
    let h = 0; for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) | 0; return 'x' + h;
  }

  function deviceName() {
    const ua = navigator.userAgent;
    if (/iPhone/.test(ua)) return 'iPhone'; if (/iPad/.test(ua)) return 'iPad'; if (/Android/.test(ua)) return 'Android';
    if (/Mac/.test(ua)) return 'Mac'; if (/Windows/.test(ua)) return 'Windows'; return 'Browser';
  }

  Store.reindex();
  window.addEventListener('online', () => Store.scheduleFlush(300));
  window.Store = Store;
})();
