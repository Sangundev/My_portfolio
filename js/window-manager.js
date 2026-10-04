/* Cửa sổ kiểu macOS (desktop) + app toàn màn hình kiểu iOS (tablet / điện thoại ≤1100px) */
(() => {
  const layer = document.getElementById('windows');
  if (!layer) return;

  const $ = (s, r = document) => r.querySelector(s);
  const h = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const mq = matchMedia('(max-width:1100px)');
  const isMobile = () => mq.matches;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const setMb = () => document.documentElement.style.setProperty('--mb-h', ($('#menubar')?.offsetHeight || 32) + 'px');
  setMb();

  /* ---------- Nội dung từng cửa sổ (sửa ở đây) ---------- */
  const SVG = p => `<svg viewBox="0 0 12 12" fill="none" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p}</svg>`;
  const GLYPH = {
    close: SVG('<path d="M3.5 3.5l5 5m0-5l-5 5"/>'),
    min:   SVG('<path d="M3 6h6"/>'),
    max:   SVG('<path d="M7 3.5h1.5V5M8.5 3.5l-2 2M5 8.5H3.5V7M3.5 8.5l2-2"/>')
  };

  const empty = text => h('div', 'empty', text);

  const tiles = list => {
    const g = h('div', 'tiles');
    list.forEach(([name, key]) => {
      const t = h('div', 'tile-i');
      if (key) { t.dataset.open = key; t.dataset.label = name; t.setAttribute('role', 'button'); t.tabIndex = 0; }
      const im = new Image();
      im.src = 'assets/folders/folder.png'; im.alt = ''; im.width = 64; im.height = 64;
      t.append(im, h('span', null, name));
      g.append(t);
    });
    return g;
  };

  const link = (href, title, sub) => {
    const a = h('a');
    a.href = href;
    a.append(h('strong', null, title), h('small', null, sub));
    return a;
  };

  const APPS = {
    finder: {
      title: 'Finder', w: 720, h: 460,
      build: b => b.append(tiles([
        ['Website_project', 'website_project'], ['Mobile_project', 'mobile_project'],
        ['Branding_project', 'branding_project'], ['About Me', 'about'], ['NgocSang.pdf', 'cv']
      ]))
    },
    website_project:  { title: 'Website_project',  build: b => b.append(tiles([['Landing page'], ['Dashboard'], ['E-commerce'], ['Blog']])) },
    mobile_project:   { title: 'Mobile_project',   build: b => b.append(tiles([['Food delivery'], ['Banking app'], ['Fitness']])) },
    branding_project: { title: 'Branding_project', build: b => b.append(tiles([['Logo system'], ['Packaging'], ['Brand guideline']])) },
    about: {
      title: 'About Me', w: 560, h: 400,
      build: b => {
        const p = h('div', 'prose');
        p.append(
          h('h3', null, 'Ngoc Sang'),
          h('p', null, 'Designer làm website, mobile và branding.'),
          h('p', null, 'Viết vài dòng giới thiệu về bạn ở đây.')
        );
        b.append(p);
      }
    },
    contact: {
      title: 'Contact', w: 440, h: 320,
      build: b => {
        const l = h('div', 'links');
        l.append(
          link('mailto:your@email.com', 'Email', 'your@email.com'),
          link('tel:+84000000000', 'Phone', '+84 000 000 000'),
          link('#', 'Behance', 'behance.net/yourname')
        );
        b.append(l);
      }
    },
    cv: {
      title: 'NgocSang_CV.pdf', w: 880, h: 640,
      build: b => {
        const f = h('iframe', 'pdf');
        f.src = 'assets/files/NgocSang_CV.pdf';
        f.title = 'NgocSang CV';
        b.classList.add('flush');
        b.append(f);
      }
    },
    trash: { title: 'Trash', w: 520, h: 360, build: b => b.append(empty('Trash is empty')) }
  };
  const soon = b => b.append(empty('Đang cập nhật nội dung'));

  /* ---------- Trạng thái ---------- */
  const wins = new Map();
  let z = 10, active = null, uid = 0, mcOn = false;

  const metrics = () => {
    const dock = $('#dock');
    const lr = layer.getBoundingClientRect();
    const bottom = dock ? Math.max(0, lr.bottom - dock.getBoundingClientRect().top) + 8 : 8;
    return { cw: layer.clientWidth, ch: layer.clientHeight, usable: layer.clientHeight - bottom };
  };

  const animate = el => {
    el.classList.add('anim');
    clearTimeout(el._t);
    el._t = setTimeout(() => el.classList.remove('anim'), 380);
  };

  const findWin = key => { for (const w of wins.values()) if (w.tabs.some(t => t.key === key)) return w; return null; };

  const refresh = () => document.querySelectorAll('#dock .dock-icon[data-open]').forEach(ic =>
    ic.classList.toggle('running', !!findWin(ic.dataset.open)));

  function focus(w) {
    z += 1;
    w.el.style.zIndex = z;
    wins.forEach(x => x.el.classList.toggle('is-active', x === w));
    active = w;
  }

  function focusTop() {
    let top = null;
    wins.forEach(w => { if (!w.min && (!top || +w.el.style.zIndex > +top.el.style.zIndex)) top = w; });
    if (top) focus(top);
  }

  /* ---------- Hành động ---------- */
  function dockTarget(key) {
    const icons = [...document.querySelectorAll(`#dock .dock-icon[data-open="${CSS.escape(key)}"]`)];
    const ic = icons.find(i => i.offsetWidth > 0);            // bỏ icon đang bị ẩn
    const r = (ic || $('#dock'))?.getBoundingClientRect();
    return r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: innerWidth / 2, y: innerHeight };
  }

  function minimize(w) {
    if (w.min) return;
    const el = w.el, r = el.getBoundingClientRect(), t = dockTarget(w.cur ? w.cur.key : '');
    el.style.setProperty('--dx', t.x - (r.left + r.width / 2) + 'px');
    el.style.setProperty('--dy', t.y - (r.top + r.height / 2) + 'px');
    el.classList.add('is-min');
    el.classList.remove('is-active');
    w.min = true;
    if (active === w) { active = null; focusTop(); }
  }

  function restore(w) {
    w.min = false;
    w.el.classList.remove('is-min');
    focus(w);
  }

  function toggleMax(w) {
    if (isMobile()) return;
    const el = w.el, m = metrics();
    animate(el);
    if (w.max) {
      Object.assign(el.style, w.prev);
      w.max = false;
      el.classList.remove('is-max');
    } else {
      w.prev = { left: el.style.left, top: el.style.top, width: el.style.width, height: el.style.height };
      Object.assign(el.style, { left: '0px', top: '0px', width: m.cw + 'px', height: m.usable + 'px' });
      w.max = true;
      el.classList.add('is-max');
    }
    focus(w);
  }

  function closeWin(w) {
    wins.delete(w.id);
    w.el.classList.add('is-closing');
    setTimeout(() => w.el.remove(), reduce ? 0 : 260);
    refresh();
    if (active === w) { active = null; focusTop(); }
    if (mcOn) { if (isMobile()) mobRemove(w); else mcLayoutDesktop(); }
  }

  const ACT = { close: closeWin, min: minimize, max: toggleMax };

  /* ---------- Tab ---------- */
  function selectTab(w, t) {
    w.tabs.forEach(o => {
      const on = o === t;
      o.body.hidden = !on;
      o.btn.classList.toggle('on', on);
      o.btn.setAttribute('aria-selected', String(on));
    });
    w.cur = t;
    w.titleEl.textContent = t.title;
    w.el.setAttribute('aria-label', t.title);
  }

  function addTab(w, key, src) {
    const old = w.tabs.find(t => t.key === key);
    if (old) return selectTab(w, old);

    const app = APPS[key] || {};
    const title = app.title || src?.dataset?.label || src?.querySelector?.('.label')?.textContent || key;

    const body = h('div', 'win-body');
    (app.build || soon)(body, title);
    body.hidden = true;

    const btn = h('div', 'wtab');
    btn.setAttribute('role', 'tab');
    btn.tabIndex = 0;
    const x = h('button', 'wtab-x', '✕');
    x.type = 'button';
    x.setAttribute('aria-label', 'Đóng tab');
    btn.append(h('span', 'wtab-t', title), x);

    const t = { key, title, body, btn };
    btn.addEventListener('click', () => selectTab(w, t));
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); selectTab(w, t); }
    });
    x.addEventListener('click', e => { e.stopPropagation(); closeTab(w, t); });

    w.tabs.push(t);
    w.tabBar.append(btn);
    w.el.insertBefore(body, w.el.querySelector('.rs'));
    w.el.classList.toggle('has-tabs', w.tabs.length > 1);
    selectTab(w, t);
  }

  function closeTab(w, t) {
    if (w.tabs.length === 1) return closeWin(w);
    const i = w.tabs.indexOf(t);
    w.tabs.splice(i, 1);
    t.btn.remove();
    t.body.remove();
    w.el.classList.toggle('has-tabs', w.tabs.length > 1);
    if (w.cur === t) selectTab(w, w.tabs[Math.min(i, w.tabs.length - 1)]);
    refresh();
  }

  /* ---------- Kéo thả (desktop) ---------- */
  function startDrag(e, w) {
    if (e.button !== 0 || isMobile() || w.max || e.target.closest('.lights, .win-add')) return;
    const el = w.el, bar = w.bar;
    const sx = e.clientX, sy = e.clientY, ox = el.offsetLeft, oy = el.offsetTop;
    bar.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    const mv = ev => {
      const m = metrics();
      el.style.left = Math.min(Math.max(ox + ev.clientX - sx, 80 - el.offsetWidth), m.cw - 80) + 'px';
      el.style.top = Math.min(Math.max(oy + ev.clientY - sy, 0), m.ch - 44) + 'px';
    };
    const up = () => {
      el.classList.remove('dragging');
      bar.removeEventListener('pointermove', mv);
      bar.removeEventListener('pointerup', up);
      bar.removeEventListener('pointercancel', up);
    };
    bar.addEventListener('pointermove', mv);
    bar.addEventListener('pointerup', up);
    bar.addEventListener('pointercancel', up);
  }

  /* ---------- Giãn kích thước (desktop) ---------- */
  function startResize(e, w) {
    if (e.button !== 0 || isMobile() || w.max) return;
    e.preventDefault();
    const el = w.el, hd = e.currentTarget, d = hd.dataset.d;
    const s = { x: e.clientX, y: e.clientY, l: el.offsetLeft, t: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight };
    hd.setPointerCapture(e.pointerId);
    el.classList.add('dragging');
    const mv = ev => {
      const dx = ev.clientX - s.x, dy = ev.clientY - s.y;
      let { l, t, w: ww, h: hh } = s;
      if (d.includes('e')) ww = Math.max(320, s.w + dx);
      if (d.includes('s')) hh = Math.max(200, s.h + dy);
      if (d.includes('w')) { ww = Math.max(320, s.w - dx); l = s.l + s.w - ww; }
      if (d.includes('n')) { hh = Math.max(200, s.h - dy); t = Math.max(0, s.t + s.h - hh); hh = s.t + s.h - t; }
      Object.assign(el.style, { left: l + 'px', top: t + 'px', width: ww + 'px', height: hh + 'px' });
    };
    const up = () => {
      el.classList.remove('dragging');
      hd.removeEventListener('pointermove', mv);
      hd.removeEventListener('pointerup', up);
      hd.removeEventListener('pointercancel', up);
    };
    hd.addEventListener('pointermove', mv);
    hd.addEventListener('pointerup', up);
    hd.addEventListener('pointercancel', up);
  }

  /* ---------- Mở cửa sổ / tab ---------- */
  function open(key, src, into) {
    let w = findWin(key);
    if (w) {
      if (w.min) restore(w); else focus(w);
      selectTab(w, w.tabs.find(t => t.key === key));
      return w;
    }
    if (into) {
      addTab(into, key, src);
      focus(into);
      refresh();
      return into;
    }

    const app = APPS[key] || {};
    const m = metrics();
    const W = Math.min(app.w || 720, m.cw - 24);
    const H = Math.min(app.h || 480, m.usable - 16);
    const off = (wins.size % 6) * 28;

    const el = h('section', 'win');
    el.setAttribute('role', 'dialog');
    Object.assign(el.style, {
      width: W + 'px', height: H + 'px',
      left: Math.max(8, Math.round((m.cw - W) / 2 + off - 56)) + 'px',
      top: Math.max(8, Math.round((m.usable - H) / 2 + off - 20)) + 'px'
    });

    const bar = h('header', 'win-bar');
    const lights = h('div', 'lights');
    const titleEl = h('h2', 'win-title');
    const tabBar = h('div', 'win-tabs');
    tabBar.setAttribute('role', 'tablist');
    w = { id: ++uid, el, bar, titleEl, tabBar, tabs: [], cur: null, min: false, max: false, prev: null,
          icon: src?.querySelector?.('img')?.src || '' };
    el._w = w;

    [['close', 'Đóng'], ['min', 'Thu nhỏ'], ['max', 'Phóng to']].forEach(([t, label]) => {
      const b = h('button', 'light ' + t);
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.innerHTML = GLYPH[t];
      b.addEventListener('click', e => { e.stopPropagation(); ACT[t](w); });
      lights.append(b);
    });

    const add = h('button', 'win-add', '+');
    add.type = 'button';
    add.setAttribute('aria-label', 'Tab mới');
    add.addEventListener('click', e => { e.stopPropagation(); open('finder', null, w); });

    bar.append(lights, titleEl, add);
    el.append(bar, tabBar);

    ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'].forEach(d => {
      const r = h('i', 'rs ' + d);
      r.dataset.d = d;
      r.addEventListener('pointerdown', e => startResize(e, w));
      el.append(r);
    });

    el.addEventListener('pointerdown', () => focus(w), true);
    bar.addEventListener('pointerdown', e => startDrag(e, w));
    bar.addEventListener('dblclick', e => { if (!e.target.closest('.lights, .win-add')) toggleMax(w); });

    layer.append(el);

    if (isMobile() && src && src.getBoundingClientRect && !reduce) {   // app phóng ra từ chính icon
      const r = src.getBoundingClientRect(), L = layer.getBoundingClientRect();
      el.style.transformOrigin =
        `${r.left + r.width / 2 - L.left - el.offsetLeft}px ${r.top + r.height / 2 - L.top - el.offsetTop}px`;
      el.classList.add('from-icon');
      el.addEventListener('animationend', () => {
        el.style.transformOrigin = '';
        el.classList.remove('from-icon');
      }, { once: true });
    }
    wins.set(w.id, w);
    addTab(w, key, src);
    focus(w);
    refresh();
    return w;
  }

  /* =====================================================
     XEM TẤT CẢ
     - Desktop: lưới (cửa sổ thật co lại)
     - Tablet / điện thoại: các thẻ app lướt ngang như iOS (bản chụp nhanh của app)
     ===================================================== */
  const mcRoot = h('div');
  mcRoot.id = 'mc';
  mcRoot.hidden = true;
  const mcHint = h('p', 'mc-hint', 'Không có cửa sổ nào đang mở');
  mcHint.hidden = true;
  mcRoot.append(h('span', 'mc-pill', 'Desktop'), mcHint);

  const mcItems = h('div');
  mcItems.id = 'mc-items';
  mcItems.hidden = true;
  document.body.append(mcRoot, mcItems);
  mcRoot.addEventListener('click', () => mcExit());
  mcItems.addEventListener('click', e => { if (!isMobile() && e.target === mcItems) mcExit(); });

  const mcLayout = () => (isMobile() ? mcLayoutMobile() : mcLayoutDesktop());

  function mcLayoutDesktop() {
    const list = [...wins.values()];
    mcItems.replaceChildren();
    mcHint.hidden = list.length > 0;
    if (!list.length) return;

    const m = metrics();
    const PAD = 40, GAP = 28, LAB = 34, TOP = 60, MAXS = 0.8;
    const aw = Math.max(160, m.cw - PAD * 2);
    const ah = Math.max(160, m.usable - TOP - 12);

    list.sort((a, b) => (a.el.offsetTop - b.el.offsetTop) || (a.el.offsetLeft - b.el.offsetLeft));
    const rnd = id => ((id * 9301 + 49297) % 233280) / 233280;

    const pack = s => {
      const rows = [];
      let row = null, ok = true;
      list.forEach(w => {
        const ww = w.el.offsetWidth * s, hh = w.el.offsetHeight * s;
        if (ww > aw) ok = false;
        if (!row || row.w + GAP + ww > aw) { row = { items: [], w: 0, h: 0 }; rows.push(row); }
        row.w += (row.items.length ? GAP : 0) + ww;
        row.h = Math.max(row.h, hh);
        row.items.push({ w, ww, hh });
      });
      const total = rows.reduce((a, r) => a + r.h + LAB, 0) + GAP * (rows.length - 1);
      return { rows, total, s, ok: ok && total <= ah };
    };

    let best = pack(MAXS);
    if (!best.ok) {
      let lo = 0.06, hi = MAXS;
      best = pack(lo);
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2, p = pack(mid);
        if (p.ok) { lo = mid; best = p; } else hi = mid;
      }
    }

    const place = (w, x, y, ww, hh) => {
      const el = w.el, s = best.s;
      el.style.setProperty('--mx', (x - el.offsetLeft) + 'px');
      el.style.setProperty('--my', (y - el.offsetTop) + 'px');
      el.style.setProperty('--ms', s.toFixed(4));

      const it = h('div', 'mc-it');
      it.setAttribute('role', 'button');
      it.tabIndex = 0;
      Object.assign(it.style, {
        left: x + 'px', top: y + 'px', width: ww + 'px', height: hh + 'px',
        borderRadius: Math.max(6, 12 * s) + 'px'
      });
      const title = w.cur ? w.cur.title : '';
      it.setAttribute('aria-label', title);

      const x2 = h('button', 'mc-x', '✕');
      x2.type = 'button';
      x2.setAttribute('aria-label', 'Đóng ' + title);
      it.append(x2, h('span', 'mc-t', title + (w.tabs.length > 1 ? ` · ${w.tabs.length} tab` : '')));

      it.addEventListener('click', e => {
        e.stopPropagation();
        if (e.target.closest('.mc-x')) closeWin(w);
        else mcExit(w);
      });
      it.addEventListener('keydown', e => {
        if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); closeWin(w); }
      });
      mcItems.append(it);
    };

    let y = TOP + Math.max(0, (ah - best.total) / 2);
    best.rows.forEach(row => {
      const n = row.items.length;
      const extra = Math.max(0, aw - row.w);
      const sp = n > 1 ? Math.min(GAP * 2, extra / (n + 1)) : 0;
      const gap = GAP + sp;
      const rw = row.items.reduce((a, it) => a + it.ww, 0) + gap * (n - 1);
      let x = PAD + (aw - rw) / 2;

      row.items.forEach(({ w, ww, hh }) => {
        const slack = row.h - hh;
        place(w, x, y + slack / 2 + (rnd(w.id) - 0.5) * slack * 0.9, ww, hh);
        x += ww + gap;
      });
      y += row.h + LAB + GAP;
    });
  }

  /* ----- Tablet / điện thoại: thẻ app như iOS -----
     Không dùng thanh cuộn của trình duyệt: vị trí thẻ tính theo một số thực `pos` (thẻ ở giữa),
     kéo = đổi pos, thả = lò xo trượt tới thẻ gần nhất. Mọi thứ vẽ bằng transform nên rất mượt. */
  let mob = null;

  function mcLayoutMobile() {
    const list = [...wins.values()].sort((a, b) => +a.el.style.zIndex - +b.el.style.zIndex);   // cũ nhất → mới nhất
    const keepPos = mob ? mob.pos : null;
    if (mob && mob.raf) cancelAnimationFrame(mob.raf);
    mcItems.replaceChildren();
    mob = null;
    mcHint.hidden = list.length > 0;
    if (!list.length) return;

    const W = layer.clientWidth, H = layer.clientHeight, S = 0.66;
    const cw = W * S, ch = H * S;
    mcItems.style.setProperty('--cw', cw + 'px');
    mcItems.style.setProperty('--ch', ch + 'px');

    const items = list.map((w, i) => {
      const snap = w.el.cloneNode(true);                               // bản chụp nhanh, không phải cửa sổ thật
      snap.classList.remove('is-min', 'is-active', 'is-closing', 'anim', 'dragging', 'from-icon', 'is-max');
      snap.removeAttribute('role');
      snap.querySelectorAll('iframe').forEach(f => f.replaceWith(empty('PDF')));

      const card = h('div', 'mc-card');
      card.style.cssText = `--w:${W}px;--h:${H}px;--s:${S}`;
      card.append(snap);

      const title = w.cur ? w.cur.title : '';
      const ico = new Image();
      ico.alt = ''; ico.draggable = false;
      ico.src = w.icon || $(`#dock .dock-icon[data-open="${CSS.escape(w.cur?.key || '')}"] img`)?.src || 'assets/folders/folder.png';
      const head = h('div', 'mc-h');
      head.append(ico, h('span', null, title + (w.tabs.length > 1 ? ` · ${w.tabs.length} tab` : '')));

      const it = h('div', 'mc-it');
      it.setAttribute('role', 'button');
      it.tabIndex = 0;
      it.setAttribute('aria-label', title);
      it.style.width = cw + 'px';
      it.style.height = ch + 'px';
      it._w = w; it._slot = i; it._dy = 0;
      if (i === list.length - 1) it.classList.add('cur');
      it.append(head, card);

      it.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); zoomOpen(it); }
        else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); closeWin(w); }
      });
      mcItems.append(it);
      return it;
    });

    const pos = Math.max(0, Math.min(items.length - 1, keepPos == null ? items.length - 1 : keepPos));
    mob = { items, H, PR: cw * 0.76, PL: cw * 0.25, pos, target: Math.round(pos), dragging: false, locked: false, raf: 0, last: 0 };
    mobRender();
  }

  /* Vẽ: thẻ bên phải nằm trên và giữ nguyên; thẻ bên trái bị đẩy sát vào sau thẻ giữa, nhỏ lại và xám nhạt */
  function mobRender() {
    const m = mob;
    if (!m) return;
    m.items.forEach(it => {
      const d = it._slot - m.pos;
      const a = Math.min(Math.abs(d), 1);
      const x = d >= 0 ? d * m.PR : d * m.PL;
      it.style.translate = `${x.toFixed(1)}px ${(it._dy || 0).toFixed(1)}px`;
      it.style.scale = d >= 0 ? '1' : (1 - 0.07 * a).toFixed(3);
      it.style.setProperty('--dim', d < 0 ? (0.24 * a).toFixed(3) : '0');
      it.style.zIndex = String(Math.round(it._slot) + 1);
    });
  }

  function mobTick(now) {
    const m = mob;
    if (!m) return;
    const dt = Math.min(40, m.last ? now - m.last : 16);
    m.last = now;
    let busy = m.dragging;

    if (!m.dragging) {                                                 // lò xo về thẻ gần nhất
      const dp = m.target - m.pos;
      if (Math.abs(dp) > 0.0005) { m.pos += dp * (1 - Math.exp(-dt / 120)); busy = true; }
      else m.pos = m.target;
    }

    const ks = 1 - Math.exp(-dt / 100);                                // các thẻ trượt vào chỗ trống khi đóng app
    m.items.forEach((it, i) => {
      const e = i - it._slot;
      if (Math.abs(e) > 0.0005) { it._slot += e * ks; busy = true; } else it._slot = i;
    });

    mobRender();
    m.raf = busy ? requestAnimationFrame(mobTick) : 0;
    if (!busy) m.last = 0;
  }

  const mobKick = () => { if (mob && !mob.raf) mob.raf = requestAnimationFrame(mobTick); };

  /* Chạm thẻ: thẻ phóng ra toàn màn hình rồi mới hiện app thật */
  function zoomOpen(it) {
    const m = mob, w = it._w;
    if (!m || m.locked) return;
    m.locked = true;
    if (reduce) return mcExit(w);
    const card = it.querySelector('.mc-card');
    it.style.transition = 'none';
    it.style.scale = '1';
    const r = card.getBoundingClientRect(), L = layer.getBoundingClientRect();

    mcItems.classList.add('zooming');
    it.classList.add('pick');
    card.style.transformOrigin = '0 0';
    card.style.transition = 'transform .38s var(--win-ease), border-radius .38s var(--win-ease)';
    card.style.borderRadius = '0px';
    card.style.transform = `translate(${L.left - r.left}px, ${L.top - r.top}px) scale(${L.width / r.width}, ${L.height / r.height})`;
    setTimeout(() => mcExit(w), 370);
  }

  /* Vuốt thẻ lên: thẻ bay lên rồi đóng app */
  function closeCard(it) {
    it.classList.add('closing');
    it._dy = -mob.H;
    it.style.opacity = '0';
    it.style.pointerEvents = 'none';
    mobRender();
    setTimeout(() => closeWin(it._w), reduce ? 0 : 200);
  }

  /* App đã đóng: bỏ thẻ, các thẻ còn lại tự trượt vào chỗ trống (xem mobTick) */
  function mobRemove(w) {
    const m = mob;
    if (!m) return;
    const k = m.items.findIndex(it => it._w === w);
    if (k < 0) return;
    const it = m.items[k];
    m.items.splice(k, 1);
    it.classList.add('closing');
    it.style.opacity = '0';
    it.style.pointerEvents = 'none';
    setTimeout(() => it.remove(), 320);
    mcHint.hidden = m.items.length > 0;
    m.target = Math.max(0, Math.min(m.items.length - 1, Math.round(m.target)));
    mobKick();
  }

  /* ----- Cử chỉ: kéo ngang = lướt thẻ; vuốt thẻ lên = đóng; chạm thẻ = mở; chạm nền = về màn hình chính ----- */
  let g = null;

  mcItems.addEventListener('pointerdown', e => {
    const m = mob;
    if (!m || m.locked || !isMobile() || (e.pointerType === 'mouse' && e.button)) return;
    g = { id: e.pointerId, x: e.clientX, y: e.clientY, it: e.target.closest('.mc-it'), axis: '',
          p0: m.pos, lx: e.clientX, lt: performance.now(), t0: performance.now(), v: 0 };
    try { mcItems.setPointerCapture(e.pointerId); } catch {}
  });

  mcItems.addEventListener('pointermove', e => {
    const m = mob;
    if (!g || !m || e.pointerId !== g.id) return;
    const dx = e.clientX - g.x, dy = e.clientY - g.y;

    if (!g.axis) {
      if (Math.hypot(dx, dy) < 8) return;
      g.axis = Math.abs(dx) >= Math.abs(dy) ? 'x' : (g.it && dy < 0 ? 'y' : 'none');
      if (g.axis === 'x') { m.dragging = true; mobKick(); }
    }

    if (g.axis === 'x') {
      const now = performance.now(), dt = Math.max(1, now - g.lt);
      g.v = 0.75 * g.v + 0.25 * ((g.lx - e.clientX) / m.PR / dt);      // vận tốc (thẻ / ms)
      g.lx = e.clientX; g.lt = now;
      const n = m.items.length, raw = g.p0 - dx / m.PR;
      m.pos = raw < 0 ? raw * 0.35 : raw > n - 1 ? (n - 1) + (raw - (n - 1)) * 0.35 : raw;   // kéo quá đầu/cuối thì có lực cản
    } else if (g.axis === 'y') {
      g.it._dy = Math.min(0, dy);
      g.it.style.opacity = String(Math.max(0.35, 1 + dy / 420));
      mobRender();
    }
    e.preventDefault();
  });

  const gEnd = e => {
    const m = mob;
    if (!g || e.pointerId !== g.id) return;
    const s = g;
    g = null;
    try { mcItems.releasePointerCapture(s.id); } catch {}
    if (!m) return;

    if (!s.axis) {                                                     // chạm
      if (e.type === 'pointercancel') return;
      if (s.it) zoomOpen(s.it); else mcExit();
    } else if (s.axis === 'x') {
      m.dragging = false;
      const fling = e.type === 'pointerup' && performance.now() - s.lt < 90 ? s.v : 0;   // dừng tay rồi mới thả thì không văng
      m.target = Math.max(0, Math.min(m.items.length - 1, Math.round(m.pos + fling * 240)));
      mobKick();
    } else if (s.axis === 'y') {
      const dy = s.it._dy, fast = dy / Math.max(1, performance.now() - s.t0) < -0.5;
      if (dy < -110 || (fast && dy < -40)) closeCard(s.it);
      else {
        s.it.classList.add('closing');
        s.it._dy = 0;
        s.it.style.opacity = '';
        mobRender();
        setTimeout(() => s.it.classList.remove('closing'), 320);
      }
    }
  };
  mcItems.addEventListener('pointerup', gEnd);
  mcItems.addEventListener('pointercancel', gEnd);

  function mcEnter() {
    if (mcOn) return;
    mcOn = true;
    mcRoot.hidden = false;
    mcItems.hidden = false;
    document.body.classList.add('mc-active');
    mcLayout();
    if (isMobile() && !reduce) {
      mcItems.classList.add('enter');
      setTimeout(() => mcItems.classList.remove('enter'), 600);
    }
    requestAnimationFrame(() => {
      layer.classList.add(isMobile() ? 'mc-m' : 'mc-on');
      mcRoot.classList.add('on');
    });
    mcBtn.setAttribute('aria-pressed', 'true');
  }

  function mcExit(target, silent) {
    if (!mcOn) return;
    mcOn = false;
    const el = target && isMobile() ? target.el : null;
    if (el) el.style.transition = 'none';                              // app hiện ngay, không mờ dần
    layer.classList.remove('mc-on', 'mc-m');
    mcRoot.classList.remove('on');
    mcItems.replaceChildren();
    mcItems.classList.remove('zooming', 'enter');
    document.body.classList.remove('mc-active');
    mcBtn.setAttribute('aria-pressed', 'false');
    if (mob && mob.raf) cancelAnimationFrame(mob.raf);
    mob = null;
    setTimeout(() => { if (!mcOn) { mcRoot.hidden = true; mcItems.hidden = true; } }, 360);

    if (target) {
      if (target.min) restore(target); else focus(target);
      if (el) requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = ''; }));
    } else if (isMobile() && !silent) {
      wins.forEach(w => minimize(w));                                  // chạm nền / vuốt thanh home = về màn hình chính
    }
  }

  const mcToggle = () => (mcOn ? mcExit() : mcEnter());

  /* ----- Thanh home (iOS): vuốt lên hoặc chạm = xem tất cả app ----- */
  const homeBar = h('div');
  homeBar.id = 'home-bar';
  homeBar.setAttribute('role', 'button');
  homeBar.setAttribute('aria-label', 'Xem tất cả ứng dụng');
  document.body.append(homeBar);

  const barAction = () => { if (mcOn) mcExit(); else if (wins.size) mcEnter(); };

  let gesture = null;
  homeBar.addEventListener('pointerdown', e => {
    gesture = { y: e.clientY };
    try { homeBar.setPointerCapture(e.pointerId); } catch {}
  });
  homeBar.addEventListener('pointermove', e => {
    if (gesture && gesture.y - e.clientY > 36) { gesture = null; barAction(); }
  });
  homeBar.addEventListener('pointerup', () => { if (gesture) { gesture = null; barAction(); } });
  homeBar.addEventListener('pointercancel', () => { gesture = null; });

  /* Ẩn dock + hiện thanh home khi đang ở trong app */
  const syncApp = () =>
    document.body.classList.toggle('app-open', isMobile() && [...wins.values()].some(w => !w.min));
  new MutationObserver(syncApp).observe(layer, {
    subtree: true, childList: true, attributes: true, attributeFilter: ['class']
  });
  addEventListener('resize', syncApp);

  /* Nút trên menubar (cạnh đồng hồ) */
  const mcBtn = h('button', 'mc-btn');
  mcBtn.type = 'button';
  mcBtn.title = 'Xem tất cả cửa sổ (Ctrl + ↑)';
  mcBtn.setAttribute('aria-label', 'Xem tất cả cửa sổ');
  mcBtn.setAttribute('aria-pressed', 'false');
  mcBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true">' +
    '<rect x="3" y="4" width="18" height="8" rx="2"/><rect x="3" y="15" width="8" height="5" rx="1.5"/><rect x="13" y="15" width="8" height="5" rx="1.5"/></svg>';
  mcBtn.addEventListener('click', mcToggle);
  const right = $('.menubar-right');
  const clock = $('#clock');
  if (right) right.insertBefore(mcBtn, clock && clock.parentNode === right ? clock : null);
  else document.body.append(mcBtn);

  /* ---------- Sự kiện toàn cục ---------- */
  // Icon desktop: desktop.js phân biệt click / kéo / giữ rồi mới gửi sự kiện này
  document.addEventListener('desktop:open', e => {
    const { target, element } = e.detail || {};
    if (!target) return;
    if (mcOn) mcExit();
    open(target, element, null);
  });

  document.addEventListener('click', e => {
    if (e.target.closest('[data-mc]')) { e.preventDefault(); mcToggle(); return; }

    const t = e.target.closest('[data-open]');
    if (!t) return;
    if (t.closest('.desk-icon') && e.detail !== 0) return;             // chuột/chạm: desktop.js lo; phím Enter vẫn mở
    e.preventDefault();
    if (mcOn) mcExit();
    const host = t.closest('.win');
    open(t.dataset.open, t, host ? host._w : null);
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && mcOn) { mcExit(); return; }
    if (e.key === 'F3' || (e.ctrlKey && e.key === 'ArrowUp')) { e.preventDefault(); mcToggle(); return; }

    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target;
    if (t.getAttribute?.('role') !== 'button') return;
    e.preventDefault();
    t.click();
  });

  addEventListener('resize', () => {
    setMb();
    if (isMobile()) { if (mcOn) mcLayout(); return; }
    const m = metrics();
    wins.forEach(w => {
      const el = w.el;
      if (w.max) {
        el.style.width = m.cw + 'px';
        el.style.height = m.usable + 'px';
      } else {
        el.style.left = Math.min(Math.max(el.offsetLeft, 0), Math.max(0, m.cw - 120)) + 'px';
        el.style.top = Math.min(Math.max(el.offsetTop, 0), Math.max(0, m.ch - 60)) + 'px';
      }
    });
    if (mcOn) mcLayout();
  });

  mq.addEventListener('change', () => {
    if (mcOn) mcExit(null, true);                                      // bỏ danh sách thẻ cũ, không thu nhỏ app
    wins.forEach(w => {
      ['--mx', '--my', '--ms', '--mdy'].forEach(p => w.el.style.removeProperty(p));
      w.el.style.opacity = '';
      w.el.style.transition = '';
    });
    setMb();
    syncApp();
  });

  window.WM = {
    open,
    overview: mcToggle,
    close: key => { const w = findWin(key); if (w) closeWin(w); }
  };
})();