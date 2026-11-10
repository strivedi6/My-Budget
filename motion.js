/* My Budget: motion. Liquid tab bar, sliding segmented controls, screen transitions,
 * scroll reveal and pull-to-refresh with an elastic (rubber-band) feel. */
(function () {
  'use strict';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SPRING = 'cubic-bezier(.34, 1.25, .64, 1)';      // gentle overshoot
  const SETTLE = 'cubic-bezier(.32, .72, 0, 1)';          // iOS-like deceleration
  const TABS = ['home', 'spends', 'insights', 'settings'];
  const anim = (el, frames, opts) => (reduce || !el || !el.animate ? null : el.animate(frames, opts));

  /* ---------- Tab bar: one pill that morphs between tabs ---------- */
  App.renderNav = () => {
    const tb = document.getElementById('tabbar'); if (!tb) return;
    const labels = { home: ['Summary', 'home'], spends: ['Spends', 'list'], insights: ['Insights', 'chart'], settings: ['Settings', 'settings'] };
    if (!tb.querySelector('.tab-pill')) {
      tb.innerHTML = '<span class="tab-pill"></span>' + TABS.map((t) => '<a href="#/' + t + '" class="tab" data-tab="' + t + '">' + icon(labels[t][1], 25) + labels[t][0] + '</a>').join('');
    }
    const i = Math.max(0, TABS.indexOf(App.ui.route));
    tb.querySelectorAll('.tab').forEach((a) => a.classList.toggle('on', a.dataset.tab === App.ui.route));
    const pill = tb.querySelector('.tab-pill');
    const prev = App._pillIdx;
    if (prev === undefined) { pill.style.transition = 'none'; requestAnimationFrame(() => { pill.style.transition = ''; }); }
    pill.style.transform = 'translateX(' + (i * 100) + '%)';
    if (prev !== undefined && prev !== i) {
      const ic = tb.querySelector('.tab.on .ic');
      anim(ic, [{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: 0.45 }, { transform: 'scale(1)' }], { duration: 520, easing: SETTLE });
    }
    App._pillIdx = i;
    App.renderSync();
  };

  /* ---------- Haptics ----------
   * iPhone Safari has no vibration API; tapping a hidden iOS switch gives the system "tick" (iOS 18+).
   * Other phones use navigator.vibrate. */
  // Newer iOS only gives the tick when the finger itself lands on a switch, so every tappable control
  // gets an invisible switch laid over it. The tap still reaches the control as a normal click.
  const IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  App.haptic = () => { try { if (!IOS && navigator.vibrate) navigator.vibrate(8); } catch (e) {} };
  const HAPTIC = '.btn, .circle, .fab, .tab, .chip, .seg button, .cat-opt, .monthsw button, .icon-btn, button.swatch, .icon-grid button, .menu .li, [data-spend], .keypad button, .keypad .fn';
  function armHaptics(root) {
    if (!IOS) return;
    (root.matches && root.matches(HAPTIC) ? [root] : []).concat(Array.from(root.querySelectorAll ? root.querySelectorAll(HAPTIC) : [])).forEach((el) => {
      if (el.tagName === 'LABEL' || el.tagName === 'INPUT' || el.querySelector(':scope > [data-haptic]')) return;
      const lb = document.createElement('label');
      lb.setAttribute('data-haptic', ''); lb.setAttribute('aria-hidden', 'true');
      const sw = document.createElement('input'); sw.type = 'checkbox'; sw.setAttribute('switch', ''); sw.tabIndex = -1;
      sw.addEventListener('click', (e) => e.stopPropagation());
      lb.appendChild(sw);
      if (getComputedStyle(el).position === 'static') el.style.position = 'relative';
      el.appendChild(lb);
    });
  }
  if (IOS) {
    armHaptics(document.body);
    let queued = [];
    new MutationObserver((list) => {
      list.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1 && !n.hasAttribute('data-haptic')) queued.push(n); }));
      if (queued.length) { const q = queued; queued = []; q.forEach((n) => { if (n.isConnected) armHaptics(n); }); }
    }).observe(document.body, { childList: true, subtree: true });
    // A tap on the overlay is a tap on a label, which would stop a link from opening, so follow links here.
    document.addEventListener('click', (e) => {
      const lb = e.target.closest && e.target.closest('[data-haptic]'); if (!lb) return;
      const a = lb.parentElement && lb.parentElement.closest('a[href]');
      if (a && !e.defaultPrevented) { const href = a.getAttribute('href'); if (href.charAt(0) === '#') location.hash = href; else location.href = a.href; }
    });
  }

  /* ---------- Route & month changes drive the screen transition ---------- */
  const readRoute = App.readRoute;
  App.readRoute = () => {
    const before = App.ui.route + '/' + App.ui.sub;
    const parts = (location.hash || '#/home').replace(/^#\/?/, '').split('/');
    const after = (App.screens[parts[0]] ? parts[0] : 'home') + '/' + (parts[1] || '');
    if (before !== after) {
      const a = before.split('/'), b = after.split('/');
      App._enter = a[0] === b[0] ? (b[1] ? 'push' : 'pop') : 'tab';
    }
    readRoute();
  };
  App.slideMonth = (dir) => { App._enter = dir > 0 ? 'next' : 'prev'; };

  /* ---------- After every render ---------- */
  const renderView = App.renderView;
  App.renderView = () => {
    renderView();
    const view = document.getElementById('view'); if (!view) return;
    morphSegs(view);
    const kind = App._enter; App._enter = '';
    if (kind) enter(view, kind);
    countUp(view, kind === 'tab' || !App._counted);
    App._counted = true;
    observeReveal(view);
    follow.reset();
  };

  function enter(view, kind) {
    const items = Array.from(view.children).flatMap((el) => (el.classList.contains('grid') || el.classList.contains('settings-grid') ? Array.from(el.children) : [el]));
    const vh = window.innerHeight;
    let n = 0;
    items.forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top > vh + 40) return; // off-screen items are handled by scroll reveal
      const delay = Math.min(n++, 6) * 34;
      let from;
      if (kind === 'push') from = 'translateX(28px)';
      else if (kind === 'pop') from = 'translateX(-28px)';
      else if (kind === 'next') from = 'translateX(22px)';
      else if (kind === 'prev') from = 'translateX(-22px)';
      else from = 'translateY(14px) scale(.985)';
      if (el.classList.contains('large-title') && (kind === 'next' || kind === 'prev')) return;
      anim(el, [{ opacity: 0, transform: from }, { opacity: 1, transform: 'none' }], { duration: 460, delay, easing: SETTLE, fill: 'backwards' });
    });
  }

  /* ---------- Segmented controls & filter chips: the selection glides like the tab bar ---------- */
  const GLIDE = 'cubic-bezier(.22, .8, .22, 1)', GLIDE_MS = 550;
  App._segPos = App._segPos || {};
  const SLIDERS = '.seg, .chips';
  const rectIn = (b) => ({ left: b.offsetLeft, top: b.offsetTop, width: b.offsetWidth, height: b.offsetHeight });
  function glide(box, on, from) {
    const to = rectIn(on);
    if (!from || reduce || (Math.abs(from.left - to.left) < 1 && Math.abs(from.top - to.top) < 1)) return;
    box.querySelectorAll(':scope > .seg-ghost').forEach((g) => g.remove());
    const chip = box.classList.contains('chips');
    const ghost = document.createElement('span'); ghost.className = 'seg-ghost' + (chip ? ' chip-ghost' : '');
    const px = (r) => ({ left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    Object.assign(ghost.style, px(to));
    box.appendChild(ghost); on.classList.add('seg-hold');
    const a = ghost.animate([px(from), px(to)], { duration: GLIDE_MS, easing: GLIDE });
    a.onfinish = a.oncancel = () => { ghost.remove(); on.classList.remove('seg-hold'); };
  }
  function morphSegs(root) {
    root.querySelectorAll('.seg[id], .chips[id]').forEach((box) => {
      const on = box.querySelector(':scope > .on'); if (!on) return;
      const key = App.ui.route + ':' + box.id, from = App._segPos[key];
      App._segPos[key] = rectIn(on);
      glide(box, on, from);
    });
  }
  // Controls that don't re-render the screen (inside sheets): glide on tap.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.seg > button, .chips > button'); if (!b || !b.closest('.sheet')) return;
    const box = b.parentElement, prev = box.querySelector(':scope > .on');
    if (!prev || prev === b) return;
    const from = rectIn(prev);
    requestAnimationFrame(() => { if (b.classList.contains('on')) glide(box, b, from); });
  }, true);

  /* ---------- Scroll reveal: cards ease in as they come into view ---------- */
  let io = null;
  function observeReveal(view) {
    if (reduce || !('IntersectionObserver' in window)) return;
    if (io) io.disconnect();
    io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -30px 0px', threshold: 0.04 });
    const vh = window.innerHeight;
    view.querySelectorAll('.card, .stat, .day-group, .day-h, .menu, .section-title').forEach((el) => {
      if (el.getBoundingClientRect().top < vh) return;
      el.classList.add('reveal');
      io.observe(el);
    });
  }


  /* ---------- Numbers count like a meter: from 0 on arrival, from the old value when a filter changes ---------- */
  App._counts = App._counts || {};
  const COUNT = '.hero .big, .hero .pill, .kpi .v, .stat .v.num, .donut-center b, [data-count]';
  const NUM_RE = /([+\u2212-]?)(\d[\d,]*)(\.\d+)?/;
  const ease = (t) => 1 - Math.pow(1 - t, 4);
  function countUp(view, fromZero) {
    const scope = App.ui.route + '/' + (App.ui.sub || '');
    view.querySelectorAll(COUNT).forEach((el, i) => {
      // The number is the last text node holding digits (the AED label stays put).
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      let node = null, n; while ((n = walker.nextNode())) if (NUM_RE.test(n.nodeValue)) node = n;
      if (!node) return;
      const txt = node.nodeValue, mt = txt.match(NUM_RE);
      const dec = mt[3] ? mt[3].length - 1 : 0;
      const neg = mt[1] === '\u2212' || mt[1] === '-';
      const val = (neg ? -1 : 1) * parseFloat(mt[2].replace(/,/g, '') + (mt[3] || ''));
      const key = scope + '#' + i + ':' + el.className;
      const prev = App._counts[key];
      App._counts[key] = val;
      const from = fromZero || prev === undefined ? 0 : prev;
      if (reduce || from === val) return;
      const pre = txt.slice(0, mt.index), post = txt.slice(mt.index + mt[0].length);
      const show = (v) => {
        const a = Math.abs(v);
        node.nodeValue = pre + (v < 0 && a >= Math.pow(10, -dec) / 2 ? (mt[1] === '-' ? '-' : '\u2212') : (mt[1] === '+' ? '+' : '')) +
          a.toLocaleString('en-AE', { minimumFractionDigits: dec, maximumFractionDigits: dec }) + post;
      };
      const dur = fromZero ? 1100 : 700, t0 = performance.now();
      show(from);
      const tick = (now) => {
        if (!node.isConnected) return;
        const t = Math.min(1, (now - t0) / dur);
        if (t < 1) { show(from + (val - from) * ease(t)); requestAnimationFrame(tick); } else node.nodeValue = txt;
      };
      requestAnimationFrame(tick);
    });
  }

  /* ---------- Scroll follow: each card trails the one before it, then springs into place ---------- */
  const follow = (() => {
    if (reduce) return { reset() {} };
    let items = [], lastY = window.scrollY, touchY = null, running = false;
    const STRETCH = 0.42, MAXO = 46, K = 0.075, DAMP = 0.8;
    const collect = () => {
      const view = document.getElementById('view'); if (!view) return [];
      return Array.from(view.querySelectorAll(':scope > *, .grid > *, .settings-grid > *, .day-h, .day-group'))
        .filter((el) => !el.classList.contains('grid') && !el.classList.contains('settings-grid') && !el.classList.contains('large-title'))
        .map((el) => ({ el, o: 0, v: 0, y: 0 }));
    };
    const reset = () => { items.forEach((it) => { it.el.style.translate = ''; }); items = collect(); lastY = window.scrollY; };
    const frame = () => {
      let moving = false;
      items.forEach((it) => {
        it.v = (it.v - it.o * K) * DAMP; it.o += it.v;
        if (Math.abs(it.o) < 0.15 && Math.abs(it.v) < 0.15) { it.o = 0; it.v = 0; }
        else moving = true;
        it.el.style.translate = it.o ? '0 ' + it.o.toFixed(2) + 'px' : '';
      });
      running = moving;
      if (moving) requestAnimationFrame(frame);
    };
    window.addEventListener('touchstart', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchmove', (e) => { touchY = e.touches[0].clientY; }, { passive: true });
    window.addEventListener('touchend', () => { touchY = null; }, { passive: true });
    window.addEventListener('scroll', () => {
      const y = window.scrollY, d = y - lastY; lastY = y;
      if (!d || App.ui.locked || y < 0 || y > document.documentElement.scrollHeight - innerHeight) return;
      if (!items.length || !items[0].el.isConnected) items = collect();
      const vh = innerHeight;
      // Content under the finger moves 1:1; the farther a card is from it, the more it lags behind.
      const anchor = touchY !== null ? touchY : (d > 0 ? vh * 0.25 : vh * 0.75);
      items.forEach((it) => {
        const r = it.el.getBoundingClientRect();
        if (r.bottom < -80 || r.top > vh + 80) return;
        const mid = Math.min(Math.max(anchor, r.top), r.bottom);
        const w = Math.min(1, Math.abs(mid - anchor) / vh);
        it.o = Math.max(-MAXO, Math.min(MAXO, it.o + d * w * STRETCH));
      });
      if (!running) { running = true; requestAnimationFrame(frame); }
    }, { passive: true });
    return { reset };
  })();

  /* ---------- Pull down to refresh (elastic) ---------- */
  // Aurora: northern lights in the accent colour, behind the status bar and the top bar.
  // Pulling down stretches it into view; it sways while the refresh runs, then fades away.
  const aur = document.createElement('div');
  aur.id = 'aurora'; aur.setAttribute('aria-hidden', 'true');
  aur.innerHTML = '<div class="sky"></div><div class="lights">' + '<i></i>'.repeat(6) + '<b></b><b></b></div><span class="stars"></span><span class="stars s2"></span>';
  document.body.appendChild(aur);
  const navH = () => { const n = document.querySelector('.navbar'); return n ? n.getBoundingClientRect().height : 100; };
  const MAX = 150, TRIGGER = 66, HOLD = 58;
  const rubber = (dy) => MAX * (1 - Math.exp(-dy / 270));
  let startY = null, pulling = false, dist = 0, busy = false;
  const target = () => document.getElementById('view');
  const setPull = (d, withTransition) => {
    const v = target(); if (!v) return;
    v.style.transition = withTransition ? 'transform .6s ' + SPRING : 'none';
    v.style.transform = d ? 'translateY(' + d + 'px)' : '';
    const p = Math.min(1, d / TRIGGER);
    aur.style.transition = withTransition ? 'height .6s ' + SPRING + ', opacity .5s ease' : 'none';
    aur.style.height = (navH() + Math.min(d * 0.35, 26)) + 'px';   // stays in the top strip
    if (!busy) aur.style.opacity = d > 2 ? (0.85 * Math.min(1, p)).toFixed(3) : '0';
    aur.classList.toggle('live', d > 2 || busy);
    aur.classList.toggle('ready', p >= 1 && !busy);
    // Large title stretches a little, like iOS.
    const lt = v.querySelector('.large-title h1');
    if (lt) { lt.style.transition = v.style.transition; lt.style.transformOrigin = 'left bottom'; lt.style.transform = d ? 'scale(' + (1 + Math.min(d, 120) / 1400) + ')' : ''; }
  };
  const canPull = () => !App.ui.locked && !App._sheets.length && !document.querySelector('.alert') && window.scrollY <= 0 && document.getElementById('view');

  document.addEventListener('touchstart', (e) => {
    if (busy || e.touches.length !== 1 || !canPull()) { startY = null; return; }
    startY = e.touches[0].clientY; pulling = false; dist = 0;
  }, { passive: true });
  document.addEventListener('touchmove', (e) => {
    if (startY === null) return;
    const dy = e.touches[0].clientY - startY;
    if (!pulling) {
      if (window.scrollY > 0 || dy < -6) { startY = null; return; }  // scrolling normally
      if (dy < 4) return;                                             // not decided yet
    }
    pulling = true;
    if (e.cancelable) e.preventDefault();
    dist = rubber(Math.max(0, dy));
    setPull(dist, false);
  }, { passive: false });
  const release = async () => {
    if (startY === null || !pulling) { startY = null; return; }
    startY = null; pulling = false;
    if (dist >= TRIGGER) {
      busy = true;
      App.haptic();
      setPull(HOLD, true);
      aur.classList.add('busy');
      const t0 = Date.now();
      try { await Store.refresh(); } catch (err) {}
      await new Promise((r) => setTimeout(r, Math.max(0, 1400 - (Date.now() - t0))));   // let the lights play a moment
      busy = false;
      aur.classList.remove('busy');
      setPull(0, true);
      setTimeout(() => { if (!busy && !pulling) aur.classList.remove('live'); }, 650);
      App.toast(Store.status === 'idle' ? 'Up to date' : (Store.outbox.length ? 'Offline: changes will sync later' : (Store.lastError || 'Could not reach the database')));
    } else {
      setPull(0, true);
    }
    dist = 0;
  };
  document.addEventListener('touchend', release, { passive: true });
  document.addEventListener('touchcancel', release, { passive: true });
})();
