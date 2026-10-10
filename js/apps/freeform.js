/* =========================================================
   js/apps/freeform.js: app Freeform (kiểu Freeform của macOS / iPad / iPhone)
   - Tự đăng ký vào window.WMApps.freeform, window-manager.js sẽ gọi build()
   - Màn hình 1 (Gallery): sidebar nổi "Boards" (All Boards / Recents / Shared / Favorites /
     Recently Deleted) + lưới thẻ board có hình thu nhỏ + ô Search + nút xem Lưới / Danh sách
   - Màn hình 2 (Board): canvas vô hạn (kéo để di chuyển, Ctrl/Cmd + cuộn hoặc 2 ngón để zoom)
       Công cụ: Chọn, Bút vẽ, Sticky note, Text, Hình (5 loại), Ảnh
       Kéo để di chuyển, kéo góc để đổi kích thước, bấm đúp để sửa chữ, Delete để xoá, Cmd/Ctrl+Z hoàn tác
   - Điện thoại / tablet (≤1100px): header tròn, lưới 2 cột, thanh công cụ nổi ở dưới như iPad / iPhone
   - Board được lưu trong localStorage (mất khi xoá dữ liệu trình duyệt)
   - CSS đi kèm: css/apps/freeform.css
========================================================= */
(() => {
  /* ---------- DỮ LIỆU MẪU (sửa ở đây) ---------- */
  const KEY = 'ngocsang-freeform-v1';
  const DAY = 864e5;
  const HOUR = 36e5;
  const T0 = Date.now();
  const ago = (d, h = 0) => T0 - d * DAY - h * HOUR;

  const PAL = ['#1d1d1f', '#ff453a', '#ff9f0a', '#ffd60a', '#32d74b', '#0a84ff', '#bf5af2', '#ff7ad9'];
  const SHAPES = ['rect', 'ellipse', 'triangle', 'diamond', 'star'];
  const HAND = '"Bradley Hand", "Segoe Print", "Marker Felt", "Comic Sans MS", cursive';

  let seq = 0;
  const uid = () => 'i' + Date.now().toString(36) + (++seq);
  const sticky = (x, y, c, txt, w = 150, h = 150) => ({ id: uid(), t: 'sticky', x, y, w, h, c, txt });
  const text = (x, y, txt, fs = 28, c = '#1d1d1f', w = 320) => ({ id: uid(), t: 'text', x, y, w, h: fs * 1.5, fs, c, txt });
  const shape = (x, y, w, h, kind, c, txt = '') => ({ id: uid(), t: 'shape', x, y, w, h, kind, c, txt });
  const path = (pts, c = '#1d1d1f', sw = 4) => ({ id: uid(), t: 'path', pts, c, sw });
  const arrow = (x1, y1, x2, y2, c = '#1d1d1f') => {
    const a = Math.atan2(y2 - y1, x2 - x1);
    const hd = 14;
    return path([[x1, y1], [x2, y2],
      [x2 - hd * Math.cos(a - .5), y2 - hd * Math.sin(a - .5)], [x2, y2],
      [x2 - hd * Math.cos(a + .5), y2 - hd * Math.sin(a + .5)]], c, 3);
  };
  const wave = (x, y, n, c) => path(Array.from({ length: n * 6 + 1 }, (_, i) => [x + i * 7, y + Math.sin(i / 3) * 9]), c, 4);

  const SEED = () => ({
    boards: [
      {
        id: 'b1', title: 'Portfolio ideas', date: ago(0, 1), fav: true, others: 3,
        items: [
          text(40, 20, 'Portfolio 2026', 46, '#0a84ff', 420),
          wave(44, 84, 12, '#ff9f0a'),
          sticky(40, 140, '#ffd60a', 'Case study: banking app'),
          sticky(220, 170, '#ff7ad9', 'Landing page hero'),
          sticky(400, 140, '#32d74b', 'Add motion to cards'),
          sticky(580, 175, '#0a84ff', 'Dark mode version?'),
          shape(70, 340, 170, 100, 'rect', '#bf5af2', 'Research'),
          shape(330, 340, 170, 100, 'ellipse', '#ff9f0a', 'Design'),
          shape(590, 340, 170, 100, 'diamond', '#32d74b', 'Ship'),
          arrow(240, 390, 328, 390), arrow(500, 390, 588, 390),
          text(70, 480, 'Make a portfolio people remember', 24, '#ff453a', 520)
        ]
      },
      {
        id: 'b2', title: 'Brand mood board', date: ago(1, 2), others: 6,
        items: [
          text(30, 10, 'Warm · Friendly · Bold', 34, '#1d1d1f', 440),
          shape(30, 80, 120, 120, 'rect', '#ff453a'), shape(160, 80, 120, 120, 'rect', '#ff9f0a'),
          shape(290, 80, 120, 120, 'rect', '#ffd60a'), shape(420, 80, 120, 120, 'rect', '#32d74b'),
          shape(550, 80, 120, 120, 'rect', '#0a84ff'),
          shape(60, 230, 130, 130, 'star', '#bf5af2'), shape(220, 250, 140, 110, 'ellipse', '#ff7ad9'),
          sticky(400, 235, '#ffd60a', 'Rounded type, big headlines'), sticky(570, 245, '#b5ead7', 'Photos with warm light', 140, 140),
          wave(40, 400, 14, '#bf5af2')
        ]
      },
      {
        id: 'b3', title: 'Website sitemap', date: ago(3, 3), others: 0,
        items: [
          shape(260, 20, 160, 70, 'rect', '#0a84ff', 'Home'),
          shape(40, 190, 150, 70, 'rect', '#32d74b', 'About'),
          shape(260, 190, 160, 70, 'rect', '#ff9f0a', 'Work'),
          shape(490, 190, 150, 70, 'rect', '#bf5af2', 'Contact'),
          arrow(300, 92, 120, 188), arrow(340, 92, 340, 188), arrow(380, 92, 560, 188),
          sticky(230, 330, '#ffd60a', 'Case studies grid + filters', 130, 130),
          sticky(400, 345, '#ff7ad9', 'Form + map', 130, 130)
        ]
      },
      {
        id: 'b4', title: 'Weekly plan', date: ago(8, 5), fav: true, others: 1,
        items: [
          text(30, 10, 'This week', 36, '#ff9f0a', 300),
          sticky(30, 80, '#ffd60a', 'Mon: wireframes'), sticky(200, 100, '#ff7ad9', 'Tue: visual design'),
          sticky(370, 80, '#32d74b', 'Wed: prototype'), sticky(540, 100, '#0a84ff', 'Thu: user test'),
          sticky(710, 80, '#bf5af2', 'Fri: handoff')
        ]
      },
      {
        id: 'b5', title: 'Trip to Da Lat', date: ago(20, 2), others: 2, deleted: true,
        items: [text(30, 20, 'Packing list', 32, '#0a84ff', 300), sticky(30, 90, '#ffd60a', 'Jacket + camera')]
      }
    ]
  });

  const VI = { back: 'Quay lại', boards: 'Boards', views: 'Chế độ xem' };

  /* ---------- ICON (SVG) ---------- */
  const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const I = {
    boards:  svg('<rect x="4" y="5" width="9" height="7" rx="1.6"/><rect x="11" y="12" width="9" height="7" rx="1.6"/>'),
    clock:   svg('<circle cx="12" cy="12" r="8"/><path d="M12 7.5V12l3 2"/>'),
    people:  svg('<circle cx="9" cy="9" r="2.6"/><circle cx="16.5" cy="10" r="2.1"/><path d="M4.5 18c.4-2.8 2.2-4.2 4.5-4.2s4.1 1.4 4.5 4.2M14.5 14.2c2.4-.3 4.3.8 5 3.3"/>'),
    heart:   svg('<path d="M12 19.5S4.5 15 4.5 9.6A3.7 3.7 0 0112 8a3.7 3.7 0 017.5 1.6c0 5.4-7.5 9.9-7.5 9.9z"/>'),
    trash:   svg('<path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7M10.2 10.5v6M13.8 10.5v6"/>'),
    sidebar: svg('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M9.5 5v14"/>'),
    grid:    svg('<rect x="4.5" y="4.5" width="6" height="6" rx="1.2"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.2"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.2"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.2"/>'),
    list:    svg('<path d="M9 7h10M9 12h10M9 17h10M5 7h.01M5 12h.01M5 17h.01" stroke-width="2.6"/>'),
    compose: svg('<path d="M12 5H6.5A1.5 1.5 0 005 6.5v11A1.5 1.5 0 006.5 19h11a1.5 1.5 0 001.5-1.5V12M17.5 4.5l2 2L11 15l-3 1 1-3z"/>'),
    search:  svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5"/>'),
    back:    svg('<path d="M14.5 6l-6 6 6 6"/>'),
    more:    svg('<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3.2"/>'),
    share:   svg('<path d="M12 4v10M8.5 7.5L12 4l3.5 3.5M7 11H6a1 1 0 00-1 1v7a1 1 0 001 1h12a1 1 0 001-1v-7a1 1 0 00-1-1h-1"/>'),
    undo:    svg('<path d="M9 7L5 11l4 4M5 11h9a5 5 0 010 10h-2"/>'),
    cursor:  svg('<path d="M6 4l12 7.5-5.2 1.3L10.5 18z"/>'),
    pen:     svg('<path d="M5 19l1-4L16.5 4.5a2 2 0 013 3L9 18z M14.5 6.5l3 3"/>'),
    sticky:  svg('<path d="M5 6.5A1.5 1.5 0 016.5 5h11A1.5 1.5 0 0119 6.5V14l-5 5H6.5A1.5 1.5 0 015 17.5z"/><path d="M19 14h-4a1 1 0 00-1 1v4"/>'),
    text:    svg('<path d="M5 7V5.5h14V7M12 5.5V19M9 19h6"/>'),
    shapes:  svg('<circle cx="8.5" cy="9" r="4"/><rect x="11" y="11" width="8" height="8" rx="1.6"/>'),
    image:   svg('<rect x="4" y="5" width="16" height="14" rx="2.2"/><circle cx="9" cy="10" r="1.6"/><path d="M5 17l4.5-4.5 3 3 2-2L19 17"/>'),
    plus:    svg('<path d="M12 5v14M5 12h14"/>'),
    minus:   svg('<path d="M5 12h14"/>'),
    fit:     svg('<path d="M5 9V5h4M15 5h4v4M19 15v4h-4M9 19H5v-4"/>')
  };

  /* ---------- HÀM PHỤ ---------- */
  const h = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const icon = (name, cls) => {
    const s = h('span', cls || 'fr-ico');
    s.innerHTML = I[name];
    return s;
  };

  const btn = (label, ic, cls) => {
    const b = h('button', 'fr-btn' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = ic;
    return b;
  };

  const pill = (...kids) => {
    const p = h('div', 'fr-pill');
    p.append(...kids);
    return p;
  };

  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // trộn màu với trắng (dùng cho sticky và hình)
  const mix = (hex, amt) => {
    const n = parseInt(hex.slice(1), 16);
    const f = v => Math.round(v + (255 - v) * amt);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  };

  const pathD = pts => {
    if (!pts.length) return '';
    if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}l.01 0`;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length - 1; i++) {
      const mx = (pts[i][0] + pts[i + 1][0]) / 2;
      const my = (pts[i][1] + pts[i + 1][1]) / 2;
      d += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`;
    }
    const l = pts[pts.length - 1];
    return d + `L${l[0]} ${l[1]}`;
  };

  // phần tử SVG của 1 hình (dùng chung cho canvas và hình thu nhỏ)
  const shapeInner = (kind, w, h2, c) => {
    const fill = mix(c, .45);
    const st = `fill="${fill}" stroke="${c}" stroke-width="3" stroke-linejoin="round"`;
    if (kind === 'ellipse') return `<ellipse cx="${w / 2}" cy="${h2 / 2}" rx="${w / 2 - 2}" ry="${h2 / 2 - 2}" ${st}/>`;
    if (kind === 'triangle') return `<polygon points="${w / 2},3 ${w - 3},${h2 - 3} 3,${h2 - 3}" ${st}/>`;
    if (kind === 'diamond') return `<polygon points="${w / 2},3 ${w - 3},${h2 / 2} ${w / 2},${h2 - 3} 3,${h2 / 2}" ${st}/>`;
    if (kind === 'star') {
      const pts = Array.from({ length: 10 }, (_, i) => {
        const r = i % 2 ? .22 : .5;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        return `${w / 2 + Math.cos(a) * r * w * 1.0},${h2 / 2 + Math.sin(a) * r * h2 * 1.0}`;
      }).join(' ');
      return `<polygon points="${pts}" ${st}/>`;
    }
    return `<rect x="2" y="2" width="${w - 4}" height="${h2 - 4}" rx="10" ${st}/>`;
  };

  const bboxOf = it => {
    if (it.t === 'path') {
      const xs = it.pts.map(p => p[0]);
      const ys = it.pts.map(p => p[1]);
      const m = it.sw / 2 + 4;
      const x = Math.min(...xs) - m;
      const y = Math.min(...ys) - m;
      return { x, y, w: Math.max(...xs) + m - x, h: Math.max(...ys) + m - y };
    }
    return { x: it.x, y: it.y, w: it.w, h: it.h };
  };

  // hình thu nhỏ của 1 board (vẽ lại bằng SVG)
  function thumb(b) {
    if (!b.items.length) return '<svg viewBox="0 0 160 100" preserveAspectRatio="xMidYMid meet"></svg>';
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    b.items.forEach(it => {
      const r = bboxOf(it);
      x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
      x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
    });
    let w = x1 - x0 + 60;
    let hh = y1 - y0 + 60;
    const ratio = 1.6;
    if (w / hh < ratio) w = hh * ratio; else hh = w / ratio;
    const cx = (x0 + x1) / 2;
    const cy = (y0 + y1) / 2;
    const parts = b.items.map(it => {
      if (it.t === 'sticky') return `<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" rx="4" fill="${mix(it.c, .45)}"/><text x="${it.x + 12}" y="${it.y + 32}" font-size="19" font-family='${HAND}' fill="#1d1d1f">${esc((it.txt || '').slice(0, 22))}</text>`;
      if (it.t === 'text') return `<text x="${it.x}" y="${it.y + it.fs}" font-size="${it.fs}" font-weight="700" font-family='${HAND}' fill="${it.c}">${esc((it.txt || '').slice(0, 40))}</text>`;
      if (it.t === 'shape') return `<g transform="translate(${it.x} ${it.y})">${shapeInner(it.kind, it.w, it.h, it.c)}</g>`;
      if (it.t === 'path') return `<path d="${pathD(it.pts)}" fill="none" stroke="${it.c}" stroke-width="${it.sw}" stroke-linecap="round" stroke-linejoin="round"/>`;
      return `<rect x="${it.x}" y="${it.y}" width="${it.w}" height="${it.h}" fill="#d1d1d6"/>`;
    }).join('');
    return `<svg viewBox="${cx - w / 2} ${cy - hh / 2} ${w} ${hh}" preserveAspectRatio="xMidYMid meet">${parts}</svg>`;
  }

  const fmtDate = ms => {
    const d = new Date(ms);
    const t = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    const diff = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(ms).setHours(0, 0, 0, 0)) / DAY);
    if (diff <= 0) return `Today, ${t}`;
    if (diff === 1) return `Yesterday, ${t}`;
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const VIEWS = [
    ['all', 'All Boards', 'boards', '#2fb4e6', b => !b.deleted],
    ['recents', 'Recents', 'clock', '#ff9f0a', b => !b.deleted && T0 - b.date < 14 * DAY],
    ['shared', 'Shared', 'people', '#0a84ff', b => !b.deleted && b.others > 0],
    ['fav', 'Favorites', 'heart', '#ff453a', b => !b.deleted && b.fav],
    ['trash', 'Recently Deleted', 'trash', '#8e8e93', b => !!b.deleted]
  ];

  /* ---------- BUILD ---------- */
  function build(body, _title, api) {
    const { isMobile } = api;
    body.classList.add('flush', 'fr-body');
    const small = () => window.matchMedia('(max-width:1100px)').matches || isMobile();

    /* --- Dữ liệu --- */
    let data;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
    if (!data || !Array.isArray(data.boards)) data = SEED();
    let st;
    const save = () => {
      clearTimeout(st);
      st = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* bỏ qua */ } }, 250);
    };
    const byId = id => data.boards.find(b => b.id === id);
    const viewDef = id => VIEWS.find(v => v[0] === id) || VIEWS[0];

    /* --- Trạng thái --- */
    let view = 'all';
    let gridMode = true;
    let q = '';
    let cur = null;              // id board đang mở (null = đang ở gallery)
    let tool = 'select';         // select | pen | sticky | text | shape
    let shapeKind = 'rect';
    let penColor = '#1d1d1f';
    let fillColor = '#ffd60a';
    let sel = null;              // id item đang chọn
    let editing = null;
    let vw = { x: 40, y: 40, k: 1 };
    let undoStack = [];
    const els = {};

    /* --- Khung chính --- */
    const root = h('div', 'fr');
    const side = h('nav', 'fr-side');
    side.setAttribute('aria-label', 'Boards');
    const main = h('div', 'fr-main');

    /* ===== GALLERY ===== */
    const gal = h('section', 'fr-gal');
    const gbar = h('div', 'fr-gbar win-drag');
    const gNew = btn('New Board', I.compose);
    const gGrid = btn('As Icons', I.grid, 'on');
    const gList = btn('As List', I.list);
    const search = h('label', 'fr-search');
    const sInput = h('input');
    sInput.type = 'search';
    sInput.placeholder = 'Search';
    sInput.setAttribute('aria-label', 'Search');
    sInput.autocomplete = 'off';
    sInput.spellcheck = false;
    search.append(icon('search', 'fr-sico'), sInput);
    gbar.append(h('div', 'fr-sp'), pill(gNew), pill(gGrid, gList), search);

    const gTitle = h('h1', 'fr-gtitle');
    const grid = h('div', 'fr-grid');
    const gScroll = h('div', 'fr-gscroll');
    gScroll.append(gTitle, grid);

    // [MOBILE] header: nút tròn chế độ xem | tiêu đề | nút tròn tạo mới
    const mViews = h('button', 'fm-circle');
    mViews.type = 'button';
    mViews.setAttribute('aria-label', VI.views);
    mViews.innerHTML = I.more;
    const mTitle = h('div', 'fm-title');
    const mNew = h('button', 'fm-circle');
    mNew.type = 'button';
    mNew.setAttribute('aria-label', 'New Board');
    mNew.innerHTML = I.compose;
    const mHead = h('div', 'fm-head');
    mHead.append(mViews, mTitle, mNew);

    gal.append(gbar, mHead, gScroll);

    /* ===== BOARD ===== */
    const board = h('section', 'fr-board');
    board.hidden = true;

    const canvas = h('div', 'fr-canvas');
    canvas.tabIndex = 0;
    const world = h('div', 'fr-world');
    const itemsLayer = h('div', 'fr-items');
    const inkSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    inkSvg.setAttribute('class', 'fr-ink');
    inkSvg.setAttribute('width', '1');
    inkSvg.setAttribute('height', '1');
    const selBox = h('div', 'fr-selbox');
    selBox.hidden = true;
    const handle = h('div', 'fr-h');
    selBox.append(handle);
    world.append(itemsLayer, inkSvg, selBox);
    canvas.append(world);

    // thanh trên: quay lại + tên board | công cụ | hoàn tác + chia sẻ
    const bbar = h('div', 'fr-bbar win-drag');
    const bBack = btn('Boards', I.back);
    const ttl = h('span', 'fr-ttl');
    ttl.contentEditable = 'true';
    ttl.spellcheck = false;
    ttl.setAttribute('aria-label', 'Board name');
    const bUndo = btn('Undo', I.undo);
    const bShare = btn('Share', I.share);
    const bDel = btn('Delete Item', I.trash);

    const tools = h('div', 'fr-tools');
    const TOOLS = [['select', 'Select', I.cursor], ['pen', 'Draw', I.pen], ['sticky', 'Sticky Note', I.sticky],
      ['text', 'Text', I.text], ['shape', 'Shapes', I.shapes]];
    const toolBtns = TOOLS.map(([k, l, ic]) => {
      const b = btn(l, ic);
      b.addEventListener('click', () => setTool(k));
      return [k, b];
    });
    const bImg = btn('Image', I.image);
    const file = h('input');
    file.type = 'file';
    file.accept = 'image/*';
    file.hidden = true;
    tools.append(pill(...toolBtns.map(t => t[1]), bImg));

    const ctx = h('div', 'fr-ctx');
    ctx.hidden = true;

    bbar.append(pill(bBack), ttl, h('div', 'fr-sp'), pill(bDel, bUndo, bShare));

    // điều khiển zoom ở góc dưới
    const zm = h('div', 'fr-zoom');
    const zOut = btn('Zoom Out', I.minus);
    const zLbl = h('button', 'fr-zl', '100%');
    zLbl.type = 'button';
    const zIn = btn('Zoom In', I.plus);
    const zFit = btn('Fit', I.fit);
    zm.append(pill(zOut, zLbl, zIn, zFit));

    board.append(canvas, bbar, tools, ctx, zm, file);

    main.append(gal, board);
    root.append(side, main);
    body.append(root);

    /* --- Popover + toast --- */
    const pop = h('div', 'fr-pop');
    pop.hidden = true;
    root.append(pop);
    let popFor = null;
    const closePop = () => { pop.hidden = true; popFor = null; };

    function menu(anchor, list) {
      if (popFor === anchor && !pop.hidden) { closePop(); return; }
      pop.replaceChildren();
      list.forEach(m => {
        if (m.sep) { pop.append(h('div', 'fr-sep')); return; }
        const r = h('button', 'fr-mi');
        r.type = 'button';
        r.disabled = !!m.off;
        r.append(h('span', 'fr-ck', m.on ? '✓' : ''), h('span', null, m.label));
        r.addEventListener('click', () => { closePop(); if (m.run) m.run(); });
        pop.append(r);
      });
      pop.hidden = false;
      popFor = anchor;
      const rr = root.getBoundingClientRect();
      const ar = anchor.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(ar.left - rr.left, rr.width - pop.offsetWidth - 8)) + 'px';
      pop.style.top = (ar.bottom - rr.top + 8) + 'px';
    }

    const away = e => {
      if (!root.isConnected) { document.removeEventListener('pointerdown', away); return; }
      if (!pop.hidden && !pop.contains(e.target) && !(popFor && popFor.contains(e.target))) closePop();
    };
    document.addEventListener('pointerdown', away);

    const toastEl = h('div', 'fr-toast');
    toastEl.hidden = true;
    root.append(toastEl);
    let tt;
    const toast = m => {
      toastEl.textContent = m;
      toastEl.hidden = false;
      clearTimeout(tt);
      tt = setTimeout(() => { toastEl.hidden = true; }, 1600);
    };

    /* ===== SIDEBAR ===== */
    const rows = {};
    function renderSide() {
      side.replaceChildren(h('div', 'win-drag fr-side-drag'), h('div', 'fr-sidebtn'));
      side.querySelector('.fr-sidebtn').append(pill(sbToggle));
      side.append(h('div', 'fr-head', 'Boards'));
      VIEWS.forEach(([id, label, ic, color, f]) => {
        const r = h('div', 'fr-row' + (id === view ? ' on' : ''));
        r.setAttribute('role', 'button');
        r.tabIndex = 0;
        const dot = h('span', 'fr-dot');
        dot.style.background = color;
        dot.innerHTML = I[ic];
        r.append(dot, h('span', 'fr-row-t', label), h('span', 'fr-cnt', String(data.boards.filter(f).length)));
        const go = () => selectView(id);
        r.addEventListener('click', go);
        r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        rows[id] = r;
        side.append(r);
      });
    }

    const sbToggle = btn('Toggle Sidebar', I.sidebar);
    sbToggle.addEventListener('click', () => root.classList.toggle('no-side'));

    function selectView(id) {
      view = id;
      q = '';
      sInput.value = '';
      closePop();
      renderSide();
      renderGallery();
    }

    /* ===== GALLERY ===== */
    function renderGallery() {
      const def = viewDef(view);
      gTitle.textContent = def[1];
      mTitle.textContent = def[1];
      gTitle.style.color = def[3];
      const s = q.trim().toLowerCase();
      const list = data.boards
        .filter(def[4])
        .filter(b => !s || b.title.toLowerCase().includes(s))
        .sort((a, b) => b.date - a.date);

      grid.className = 'fr-grid' + (gridMode ? '' : ' as-list');
      grid.replaceChildren();
      if (!list.length) { grid.append(h('p', 'fr-empty', q ? 'No Results' : 'No Boards')); return; }

      list.forEach(b => {
        const card = h('div', 'fr-card');
        card.setAttribute('role', 'button');
        card.tabIndex = 0;
        const th = h('div', 'fr-thumb');
        th.innerHTML = thumb(b);
        const info = h('div', 'fr-cinfo');
        const t = h('b', 'fr-ct', b.title);
        if (b.fav) t.append(h('i', 'fr-fav', '♥'));
        info.append(t, h('span', null, fmtDate(b.date)), h('span', null, b.others > 0 ? `You & ${b.others} Other${b.others > 1 ? 's' : ''}` : 'Only You'));
        const more = btn('More', I.more, 'fr-cmore');
        more.addEventListener('click', e => { e.stopPropagation(); cardMenu(more, b); });
        card.append(th, info, more);

        const go = () => { if (!b.deleted) openBoard(b.id); else toast('Restore the board to open it'); };
        card.addEventListener('click', go);
        card.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
        card.addEventListener('contextmenu', e => { e.preventDefault(); cardMenu(more, b); });
        grid.append(card);
      });
    }

    function cardMenu(anchor, b) {
      menu(anchor, b.deleted ? [
        { label: 'Restore', run: () => { b.deleted = false; save(); renderSide(); renderGallery(); } },
        { label: 'Delete Permanently', run: () => { data.boards = data.boards.filter(x => x !== b); save(); renderSide(); renderGallery(); } }
      ] : [
        { label: 'Open', run: () => openBoard(b.id) },
        { label: b.fav ? 'Remove from Favorites' : 'Add to Favorites', run: () => { b.fav = !b.fav; save(); renderSide(); renderGallery(); } },
        { label: 'Duplicate', run: () => {
          const c = JSON.parse(JSON.stringify(b));
          c.id = 'b' + Date.now().toString(36);
          c.title = b.title + ' copy';
          c.date = Date.now();
          c.fav = false;
          c.items.forEach(i => { i.id = uid(); });
          data.boards.unshift(c);
          save(); renderSide(); renderGallery();
        } },
        { sep: true },
        { label: 'Delete', run: () => { b.deleted = true; save(); renderSide(); renderGallery(); toast('Moved to Recently Deleted'); } }
      ]);
    }

    function newBoard() {
      const b = { id: 'b' + Date.now().toString(36), title: 'Untitled', date: Date.now(), others: 0, items: [] };
      data.boards.unshift(b);
      save();
      openBoard(b.id);
    }

    gNew.addEventListener('click', newBoard);
    mNew.addEventListener('click', newBoard);

    const setMode = g => {
      gridMode = g;
      gGrid.classList.toggle('on', g);
      gList.classList.toggle('on', !g);
      renderGallery();
    };
    gGrid.addEventListener('click', () => setMode(true));
    gList.addEventListener('click', () => setMode(false));

    sInput.addEventListener('input', () => { q = sInput.value; renderGallery(); });

    // [MOBILE] nút "…" chọn chế độ xem
    mViews.addEventListener('click', () => menu(mViews, [
      ...VIEWS.map(([id, label]) => ({ label, on: id === view, run: () => selectView(id) })),
      { sep: true },
      { label: 'Xem dạng lưới', on: gridMode, run: () => setMode(true) },
      { label: 'Xem dạng danh sách', on: !gridMode, run: () => setMode(false) }
    ]));

    /* ===== BOARD: dữ liệu + vẽ ===== */
    const cb = () => byId(cur);
    const itemOf = id => cb() && cb().items.find(i => i.id === id);

    const pushUndo = () => {
      if (!cb()) return;
      undoStack.push(JSON.stringify(cb().items));
      if (undoStack.length > 40) undoStack.shift();
      bUndo.classList.toggle('dim', false);
    };

    function undo() {
      if (!undoStack.length || !cb()) return;
      cb().items = JSON.parse(undoStack.pop());
      sel = null;
      touch();
      renderWorld();
    }

    const touch = () => { if (cb()) { cb().date = Date.now(); save(); } };

    function applyView() {
      world.style.transform = `translate(${vw.x}px,${vw.y}px) scale(${vw.k})`;
      world.style.setProperty('--k', vw.k);
      canvas.style.backgroundSize = `${28 * vw.k}px ${28 * vw.k}px`;
      canvas.style.backgroundPosition = `${vw.x}px ${vw.y}px`;
      zLbl.textContent = Math.round(vw.k * 100) + '%';
    }

    function zoomAt(cx, cy, f) {
      const r = canvas.getBoundingClientRect();
      const px = cx - r.left;
      const py = cy - r.top;
      const k = Math.max(.2, Math.min(3, vw.k * f));
      const real = k / vw.k;
      vw.x = px - (px - vw.x) * real;
      vw.y = py - (py - vw.y) * real;
      vw.k = k;
      applyView();
    }

    function fit() {
      const b = cb();
      const r = canvas.getBoundingClientRect();
      if (!b || !b.items.length || !r.width) { vw = { x: 40, y: 40, k: 1 }; applyView(); return; }
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      b.items.forEach(it => {
        const bb = bboxOf(it);
        x0 = Math.min(x0, bb.x); y0 = Math.min(y0, bb.y);
        x1 = Math.max(x1, bb.x + bb.w); y1 = Math.max(y1, bb.y + bb.h);
      });
      const pad = 90;
      const k = Math.max(.25, Math.min(1.2, Math.min((r.width - pad * 2) / (x1 - x0), (r.height - pad * 2) / (y1 - y0))));
      vw.k = k;
      vw.x = (r.width - (x1 - x0) * k) / 2 - x0 * k;
      vw.y = (r.height - (y1 - y0) * k) / 2 - y0 * k + 20;
      applyView();
    }

    zIn.addEventListener('click', () => { const r = canvas.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.25); });
    zOut.addEventListener('click', () => { const r = canvas.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, .8); });
    zFit.addEventListener('click', fit);
    zLbl.addEventListener('click', () => { vw.k = 1; applyView(); });

    function paintShape(it) {
      const el = els[it.id];
      const sv = el.querySelector('svg');
      sv.setAttribute('viewBox', `0 0 ${it.w} ${it.h}`);
      sv.innerHTML = shapeInner(it.kind, it.w, it.h, it.c);
    }

    function placeEl(it) {
      const el = els[it.id];
      if (!el || it.t === 'path') return;
      el.style.left = it.x + 'px';
      el.style.top = it.y + 'px';
      el.style.width = it.w + 'px';
      if (it.t !== 'text') el.style.height = it.h + 'px';
    }

    function mount(it) {
      let el;
      if (it.t === 'path') {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        el.setAttribute('class', 'fr-pg');
        el.dataset.id = it.id;
        const hit = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        hit.setAttribute('class', 'fr-hit');
        const vis = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        vis.setAttribute('class', 'fr-vis');
        el.append(hit, vis);
        inkSvg.append(el);
        els[it.id] = el;
        paintPath(it);
        return;
      }
      el = h('div', 'fr-it fr-' + it.t);
      el.dataset.id = it.id;
      els[it.id] = el;
      if (it.t === 'sticky') {
        el.style.setProperty('--c', mix(it.c, .45));
        const tx = h('div', 'fr-txt', it.txt || '');
        tx.style.fontFamily = HAND;
        el.append(tx);
      } else if (it.t === 'text') {
        const tx = h('div', 'fr-txt', it.txt || '');
        tx.style.fontSize = it.fs + 'px';
        tx.style.color = it.c;
        tx.style.fontFamily = HAND;
        el.append(tx);
      } else if (it.t === 'shape') {
        el.innerHTML = '<svg preserveAspectRatio="none"></svg>';
        const tx = h('div', 'fr-txt', it.txt || '');
        tx.style.fontFamily = HAND;
        el.append(tx);
      } else if (it.t === 'image') {
        const im = new Image();
        im.src = it.src;
        im.draggable = false;
        im.alt = '';
        el.append(im);
      }
      itemsLayer.append(el);
      placeEl(it);
      if (it.t === 'shape') paintShape(it);
    }

    function paintPath(it) {
      const g = els[it.id];
      const d = pathD(it.pts);
      const [hit, vis] = g.children;
      hit.setAttribute('d', d);
      hit.setAttribute('stroke-width', Math.max(it.sw, 18));
      vis.setAttribute('d', d);
      vis.setAttribute('stroke', it.c);
      vis.setAttribute('stroke-width', it.sw);
    }

    function renderWorld() {
      itemsLayer.replaceChildren();
      inkSvg.replaceChildren();
      Object.keys(els).forEach(k => delete els[k]);
      (cb() ? cb().items : []).forEach(mount);
      updateSel();
      renderCtx();
    }

    function updateSel() {
      const it = sel && itemOf(sel);
      if (!it || !els[it.id]) { selBox.hidden = true; bDel.classList.add('dim'); return; }
      if (it.t === 'text') it.h = els[it.id].offsetHeight || it.h;
      const b = bboxOf(it);
      selBox.hidden = false;
      selBox.style.left = b.x + 'px';
      selBox.style.top = b.y + 'px';
      selBox.style.width = b.w + 'px';
      selBox.style.height = b.h + 'px';
      handle.hidden = it.t === 'path';
      bDel.classList.remove('dim');
    }

    function select(id) {
      sel = id;
      updateSel();
      renderCtx();
    }

    /* ===== BOARD: công cụ + thanh màu ===== */
    function setTool(k) {
      tool = k;
      toolBtns.forEach(([id, b]) => b.classList.toggle('on', id === k));
      canvas.dataset.tool = k;
      if (k !== 'select') { sel = null; updateSel(); }
      renderCtx();
    }

    function renderCtx() {
      ctx.replaceChildren();
      const it = sel && itemOf(sel);
      const showTool = ['pen', 'sticky', 'shape', 'text'].includes(tool);
      if (!it && !showTool) { ctx.hidden = true; return; }
      ctx.hidden = false;

      const activeColor = it ? it.c : (tool === 'pen' ? penColor : fillColor);
      const row = h('div', 'fr-swatches');
      PAL.forEach(c => {
        const b = h('button', 'fr-sw' + (c === activeColor ? ' on' : ''));
        b.type = 'button';
        b.style.background = c;
        b.setAttribute('aria-label', c);
        b.addEventListener('click', () => {
          if (it) { pushUndo(); it.c = c; remount(it); touch(); }
          else if (tool === 'pen') penColor = c; else fillColor = c;
          renderCtx();
        });
        row.append(b);
      });
      ctx.append(pill(row));

      if ((tool === 'shape' && !it) || (it && it.t === 'shape')) {
        const kinds = h('div', 'fr-kinds');
        const active = it ? it.kind : shapeKind;
        SHAPES.forEach(k => {
          const b = h('button', 'fr-kind' + (k === active ? ' on' : ''));
          b.type = 'button';
          b.setAttribute('aria-label', k);
          b.innerHTML = `<svg viewBox="0 0 40 32">${shapeInner(k, 40, 32, '#8e8e93')}</svg>`;
          b.addEventListener('click', () => {
            if (it) { pushUndo(); it.kind = k; paintShape(it); touch(); } else shapeKind = k;
            renderCtx();
          });
          kinds.append(b);
        });
        ctx.append(pill(kinds));
      }
    }

    // vẽ lại 1 item sau khi đổi màu
    function remount(it) {
      const old = els[it.id];
      const next = old.nextSibling;
      old.remove();
      mount(it);
      const el = els[it.id];
      if (next && next.parentNode === el.parentNode) el.parentNode.insertBefore(el, next);
      updateSel();
    }

    /* ===== BOARD: tương tác ===== */
    const toWorld = e => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left - vw.x) / vw.k, (e.clientY - r.top - vw.y) / vw.k];
    };

    const ptrs = new Map();
    let mode = null;
    let g = null;      // dữ liệu tạm của thao tác đang chạy

    function startEdit(it) {
      const el = els[it.id];
      const tx = el && el.querySelector('.fr-txt');
      if (!tx) return;
      editing = it.id;
      el.classList.add('editing');
      tx.contentEditable = 'true';
      tx.focus();
      const r = document.createRange();
      r.selectNodeContents(tx);
      const s = window.getSelection();
      s.removeAllRanges();
      s.addRange(r);
      const done = () => {
        tx.contentEditable = 'false';
        el.classList.remove('editing');
        const v = tx.innerText.replace(/\n$/, '');
        if (v !== (it.txt || '')) { pushUndo(); it.txt = v; touch(); }
        editing = null;
        tx.removeEventListener('blur', done);
        updateSel();
      };
      tx.addEventListener('blur', done);
      tx.addEventListener('keydown', e => { if (e.key === 'Escape') { e.preventDefault(); tx.blur(); } });
    }

    function addItem(it, edit) {
      pushUndo();
      cb().items.push(it);
      mount(it);
      touch();
      setTool('select');
      select(it.id);
      if (edit) setTimeout(() => startEdit(it), 20);
    }

    canvas.addEventListener('pointerdown', e => {
      if (!cb()) return;
      if (e.target.closest('.fr-txt[contenteditable="true"]')) return;
      if (editing) { document.activeElement.blur(); }
      canvas.focus({ preventScroll: true });
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

      // 2 ngón: zoom + di chuyển
      if (ptrs.size === 2) {
        if (mode === 'draw' && g && g.it) {
          cb().items = cb().items.filter(i => i !== g.it);
          renderWorld();
        }
        const [a, b] = [...ptrs.values()];
        g = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
        mode = 'pinch';
        return;
      }
      if (ptrs.size > 2) return;

      const [wx, wy] = toWorld(e);

      if (e.target === handle && sel) {
        const it = itemOf(sel);
        pushUndo();
        mode = 'resize';
        g = { it, sx: wx, sy: wy, w: it.w, h: it.h };
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }

      const hitEl = e.target.closest('[data-id]');
      if (hitEl && tool !== 'pen') {
        const it = itemOf(hitEl.dataset.id);
        if (it) {
          if (tool !== 'select') setTool('select');
          select(it.id);
          g = { it, sx: wx, sy: wy, ox: it.x, oy: it.y, pts: it.pts ? it.pts.map(p => p.slice()) : null, moved: false };
          mode = 'drag';
          canvas.setPointerCapture(e.pointerId);
          e.preventDefault();
          return;
        }
      }

      if (tool === 'pen') {
        pushUndo();
        const it = path([[wx, wy]], penColor, 4);
        cb().items.push(it);
        mount(it);
        g = { it };
        mode = 'draw';
        canvas.setPointerCapture(e.pointerId);
        e.preventDefault();
        return;
      }

      if (tool === 'sticky') { addItem(sticky(wx - 75, wy - 75, fillColor, ''), true); return; }
      if (tool === 'text') { addItem(text(wx, wy - 18, 'Text', 28, penColor === '#ffd60a' ? '#1d1d1f' : penColor, 260), true); return; }
      if (tool === 'shape') { addItem(shape(wx - 70, wy - 55, 140, 110, shapeKind, fillColor === '#1d1d1f' ? '#0a84ff' : fillColor), false); return; }

      // chạm vào nền: bỏ chọn + kéo để di chuyển canvas
      select(null);
      mode = 'pan';
      g = { sx: e.clientX, sy: e.clientY, x: vw.x, y: vw.y };
      canvas.setPointerCapture(e.pointerId);
    });

    canvas.addEventListener('pointermove', e => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (mode === 'pinch' && ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        const cx = (a.x + b.x) / 2;
        const cy = (a.y + b.y) / 2;
        vw.x += cx - g.cx;
        vw.y += cy - g.cy;
        if (g.d) zoomAt(cx, cy, d / g.d);
        else applyView();
        g.d = d; g.cx = cx; g.cy = cy;
        return;
      }

      if (mode === 'pan') {
        vw.x = g.x + e.clientX - g.sx;
        vw.y = g.y + e.clientY - g.sy;
        applyView();
      } else if (mode === 'drag') {
        const [wx, wy] = toWorld(e);
        const dx = wx - g.sx;
        const dy = wy - g.sy;
        if (!g.moved && Math.hypot(dx, dy) * vw.k < 3) return;
        if (!g.moved) { pushUndo(); g.moved = true; }
        const it = g.it;
        if (it.t === 'path') {
          it.pts = g.pts.map(p => [p[0] + dx, p[1] + dy]);
          paintPath(it);
        } else {
          it.x = g.ox + dx;
          it.y = g.oy + dy;
          placeEl(it);
        }
        updateSel();
      } else if (mode === 'resize') {
        const [wx, wy] = toWorld(e);
        const it = g.it;
        it.w = Math.max(40, g.w + wx - g.sx);
        if (it.t !== 'text') it.h = Math.max(40, g.h + wy - g.sy);
        if (it.t === 'sticky' || it.t === 'image') {
          // giữ nguyên tỉ lệ cho sticky / ảnh
          const s = Math.max(it.w / g.w, it.h / g.h);
          it.w = g.w * s; it.h = g.h * s;
        }
        placeEl(it);
        if (it.t === 'shape') paintShape(it);
        updateSel();
      } else if (mode === 'draw') {
        const [wx, wy] = toWorld(e);
        const it = g.it;
        const l = it.pts[it.pts.length - 1];
        if (Math.hypot(wx - l[0], wy - l[1]) * vw.k > 2) {
          it.pts.push([wx, wy]);
          paintPath(it);
        }
      }
    });

    const endPtr = e => {
      ptrs.delete(e.pointerId);
      if (mode === 'pinch') { if (ptrs.size < 2) { mode = null; g = null; } return; }
      if (!mode) return;
      if (mode === 'drag' && g && g.moved) touch();
      if (mode === 'resize') touch();
      if (mode === 'draw') touch();
      if (mode === 'draw' && g && g.it) select(null);
      mode = null;
      g = null;
    };
    canvas.addEventListener('pointerup', endPtr);
    canvas.addEventListener('pointercancel', endPtr);

    canvas.addEventListener('dblclick', e => {
      const hitEl = e.target.closest('[data-id]');
      const it = hitEl && itemOf(hitEl.dataset.id);
      if (it && it.t !== 'path' && it.t !== 'image') { select(it.id); startEdit(it); }
    });

    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) zoomAt(e.clientX, e.clientY, Math.exp(-e.deltaY * .01));
      else { vw.x -= e.deltaX; vw.y -= e.deltaY; applyView(); }
    }, { passive: false });

    canvas.addEventListener('keydown', e => {
      if (editing) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); deleteSel(); }
      else if (e.key === 'Escape') { setTool('select'); select(null); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
    });

    function deleteSel() {
      if (!sel || !cb()) return;
      pushUndo();
      cb().items = cb().items.filter(i => i.id !== sel);
      sel = null;
      touch();
      renderWorld();
    }

    bDel.addEventListener('click', deleteSel);
    bUndo.addEventListener('click', undo);

    bImg.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const f = file.files && file.files[0];
      file.value = '';
      if (!f || !cb()) return;
      const rd = new FileReader();
      rd.onload = () => {
        const im = new Image();
        im.onload = () => {
          const s = Math.min(1, 280 / Math.max(im.width, im.height));
          const r = canvas.getBoundingClientRect();
          const cx = (r.width / 2 - vw.x) / vw.k;
          const cy = (r.height / 2 - vw.y) / vw.k;
          const w = im.width * s;
          const hh = im.height * s;
          addItem({ id: uid(), t: 'image', x: cx - w / 2, y: cy - hh / 2, w, h: hh, src: rd.result }, false);
        };
        im.src = rd.result;
      };
      rd.readAsDataURL(f);
    });

    bShare.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href.split('#')[0] + '#' + (cur || '')); toast('Link copied'); }
      catch { toast('Could not copy link'); }
    });

    ttl.addEventListener('input', () => { if (cb()) { cb().title = ttl.textContent.trim() || 'Untitled'; save(); } });
    ttl.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ttl.blur(); } });
    ttl.addEventListener('blur', () => { if (cb()) { ttl.textContent = cb().title; } });

    /* ===== Chuyển giữa Gallery và Board ===== */
    function openBoard(id) {
      cur = id;
      sel = null;
      undoStack = [];
      closePop();
      ttl.textContent = cb().title;
      gal.hidden = true;
      board.hidden = false;
      root.classList.add('in-board');
      setTool('select');
      renderWorld();
      requestAnimationFrame(fit);
    }

    function closeBoard() {
      if (editing && document.activeElement) document.activeElement.blur();
      cur = null;
      board.hidden = true;
      gal.hidden = false;
      root.classList.remove('in-board');
      save();
      renderSide();
      renderGallery();
    }

    bBack.addEventListener('click', closeBoard);

    const mq = window.matchMedia('(max-width:1100px)');
    const onMq = () => {
      if (!root.isConnected) { mq.removeEventListener('change', onMq); return; }
      if (cur) fit();
    };
    mq.addEventListener('change', onMq);

    /* --- Khởi động --- */
    renderSide();
    renderGallery();
    applyView();
  }

  /* ---------- ĐĂNG KÝ APP ---------- */
  (window.WMApps = window.WMApps || {}).freeform = {
    title: 'Freeform',
    w: 1000,
    h: 640,
    cls: 'is-freeform',       // class thêm vào cửa sổ (freeform.css dùng để ẩn thanh tiêu đề trên máy tính)
    build
  };
})();