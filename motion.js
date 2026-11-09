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
    const end = 'translateX(' + (i * 100) + '%)';
    if (prev !== undefined && prev !== i) {
      const mid = ((prev + i) / 2) * 100;
      const stretch = 1 + Math.min(0.5, 0.18 * Math.abs(i - prev));
      anim(pill, [
        { transform: 'translateX(' + (prev * 100) + '%) scale(1, 1)' },
        { transform: 'translateX(' + mid + '%) scale(' + stretch + ', .86)', offset: 0.45 },
        { transform: end + ' scale(.96, 1.04)', offset: 0.8 },
        { transform: end + ' scale(1, 1)' }
      ], { duration: 560, easing: SETTLE });
      const icon = tb.querySelector('.tab.on .ic');
      anim(icon, [{ transform: 'scale(1)' }, { transform: 'scale(1.22) translateY(-1px)', offset: 0.4 }, { transform: 'scale(1)' }], { duration: 480, easing: SPRING });
    }
    pill.style.transform = end;
    App._pillIdx = i;
    App.renderSync();
  };

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
    observeReveal(view);
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

  /* ---------- Segmented controls: thumb slides to the new choice ---------- */
  App._segPos = App._segPos || {};
  function morphSegs(root) {
    root.querySelectorAll('.seg[id]').forEach((seg) => {
      const on = seg.querySelector('button.on'); if (!on) return;
      const to = { left: on.offsetLeft, width: on.offsetWidth };
      const from = App._segPos[seg.id];
      App._segPos[seg.id] = to;
      if (!from || (from.left === to.left && from.width === to.width) || reduce) return;
      const ghost = document.createElement('span'); ghost.className = 'seg-ghost';
      ghost.style.left = to.left + 'px'; ghost.style.width = to.width + 'px';
      seg.appendChild(ghost); on.classList.add('seg-hold');
      const dx = from.left - to.left, sx = from.width / to.width;
      const a = ghost.animate([
        { transform: 'translateX(' + dx + 'px) scaleX(' + sx + ')' },
        { transform: 'translateX(' + dx * 0.35 + 'px) scaleX(' + (sx * 0.5 + 0.58) + ') scaleY(.9)', offset: 0.5 },
        { transform: 'none' }
      ], { duration: 420, easing: SETTLE });
      a.onfinish = () => { ghost.remove(); on.classList.remove('seg-hold'); };
    });
  }
  // Segments inside sheets (no re-render): slide on click.
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.sheet .seg button'); if (!b) return;
    const seg = b.parentElement, prev = seg.querySelector('button.on');
    if (!prev || prev === b || reduce) return;
    requestAnimationFrame(() => {
      if (!b.classList.contains('on')) return;
      const ghost = document.createElement('span'); ghost.className = 'seg-ghost';
      ghost.style.left = b.offsetLeft + 'px'; ghost.style.width = b.offsetWidth + 'px';
      seg.appendChild(ghost); b.classList.add('seg-hold');
      const a = ghost.animate([{ transform: 'translateX(' + (prev.offsetLeft - b.offsetLeft) + 'px)' }, { transform: 'none' }], { duration: 380, easing: SETTLE });
      a.onfinish = () => { ghost.remove(); b.classList.remove('seg-hold'); };
    });
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

  /* ---------- Pull down to refresh (elastic) ---------- */
  const ptr = document.createElement('div');
  ptr.id = 'ptr';
  ptr.innerHTML = '<div class="spinner">' + Array.from({ length: 8 }, (_, i) => '<i style="transform:rotate(' + i * 45 + 'deg)"></i>').join('') + '</div>';
  document.body.appendChild(ptr);
  const spokes = ptr.querySelectorAll('i');
  const MAX = 150, TRIGGER = 66, HOLD = 58;
  const rubber = (dy) => MAX * (1 - Math.exp(-dy / 270));
  let startY = null, pulling = false, dist = 0, busy = false;
  const target = () => document.getElementById('view');
  const setPull = (d, withTransition) => {
    const v = target(); if (!v) return;
    v.style.transition = withTransition ? 'transform .6s ' + SPRING : 'none';
    v.style.transform = d ? 'translateY(' + d + 'px)' : '';
    const p = Math.min(1, d / TRIGGER);
    ptr.style.transition = withTransition ? 'opacity .3s, transform .6s ' + SPRING : 'none';
    ptr.style.opacity = d > 4 ? Math.min(1, p * 1.4) : 0;
    ptr.style.transform = 'translate(-50%, ' + Math.min(d * 0.55, 34) + 'px) scale(' + (0.6 + 0.4 * p) + ')';
    if (!busy) spokes.forEach((s, i) => { s.style.opacity = i < Math.round(p * 8) ? 1 : 0.15; });
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
      if (navigator.vibrate) navigator.vibrate(10);
      setPull(HOLD, true);
      ptr.classList.add('spin'); spokes.forEach((s) => { s.style.opacity = ''; });
      const t0 = Date.now();
      try { await Store.refresh(); } catch (err) {}
      await new Promise((r) => setTimeout(r, Math.max(0, 650 - (Date.now() - t0))));
      ptr.classList.remove('spin');
      busy = false;
      setPull(0, true);
      App.toast(Store.status === 'idle' ? 'Up to date' : (Store.outbox.length ? 'Offline: changes will sync later' : (Store.lastError || 'Could not reach the Sheet')));
    } else {
      setPull(0, true);
    }
    dist = 0;
  };
  document.addEventListener('touchend', release, { passive: true });
  document.addEventListener('touchcancel', release, { passive: true });
})();
