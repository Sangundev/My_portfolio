/* =========================================================
   js/apps/finder.js: app Finder (kiểu macOS + app Tệp của iPhone)
   - Tự đăng ký vào window.WMApps.finder, window-manager.js sẽ gọi build()
   - Máy tính (>1100px): sidebar + thanh công cụ (Back/Forward, Views, Group, Share, Tags, More, Search)
   - Điện thoại / tablet (≤1100px): giao diện giống app Tệp trên iPhone
     (header tròn, ô tìm kiếm, lưới thư mục có "N mục", thanh tab Gần đây / Được chia sẻ / Duyệt)
   - Máy tính: bấm = chọn, bấm đúp = mở. Điện thoại / tablet: chạm = mở
   - CSS đi kèm: css/apps/finder.css (+ finder-mobile.css dán xuống cuối)
   - Chỗ nào có chữ [MOBILE] là phần mới thêm cho điện thoại
========================================================= */
(() => {
  /* ---------- DỮ LIỆU (sửa ở đây) ---------- */
  // img: tên ảnh trong assets/folders | date: ngày sửa | href: (tuỳ chọn) file để tải về
  // size: (tuỳ chọn) dung lượng, chỉ hiện trên điện thoại, ví dụ '163 KB'
  const FILES = {
    website_project:  { name: 'Website_project',  img: 'folder', date: '2026-03-12' },
    mobile_project:   { name: 'Mobile_project',   img: 'folder', date: '2026-02-20' },
    branding_project: { name: 'Branding_project', img: 'folder', date: '2026-01-08' },
    about:            { name: 'About Me',         img: 'folder', date: '2026-04-02' },
    cv:               { name: 'NgocSang.pdf',     img: 'pdf',    date: '2026-05-15', href: 'assets/files/NgocSang.pdf' },

    // Thư mục con (chỉ xem được khi đi vào bên trong Finder). leaf = chưa có nội dung
    wp_landing: { name: 'Landing page',    img: 'folder', date: '2026-03-01', leaf: true },
    wp_dash:    { name: 'Dashboard',       img: 'folder', date: '2026-03-05', leaf: true },
    wp_shop:    { name: 'E-commerce',      img: 'folder', date: '2026-03-09', leaf: true },
    wp_blog:    { name: 'Blog',            img: 'folder', date: '2026-03-12', leaf: true },
    mp_food:    { name: 'Food delivery',   img: 'folder', date: '2026-02-02', leaf: true },
    mp_bank:    { name: 'Banking app',     img: 'folder', date: '2026-02-11', leaf: true },
    mp_fit:     { name: 'Fitness',         img: 'folder', date: '2026-02-20', leaf: true },
    bp_logo:    { name: 'Logo system',     img: 'folder', date: '2026-01-02', leaf: true },
    bp_pack:    { name: 'Packaging',       img: 'folder', date: '2026-01-05', leaf: true },
    bp_guide:   { name: 'Brand guideline', img: 'folder', date: '2026-01-08', leaf: true }
  };

  // Folder nào có nội dung bên trong: bấm đúp trong Finder (desktop) sẽ đi vào, giống macOS
  const CHILDREN = {
    website_project:  ['wp_landing', 'wp_dash', 'wp_shop', 'wp_blog'],
    mobile_project:   ['mp_food', 'mp_bank', 'mp_fit'],
    branding_project: ['bp_logo', 'bp_pack', 'bp_guide']
  };

  const KIND = { folder: 'Folder', pdf: 'PDF Document' };

  const TAGS = [
    ['Red', '#ff453a'], ['Orange', '#ff9f0a'], ['Yellow', '#ffd60a'],
    ['Green', '#32d74b'], ['Blue', '#0a84ff'], ['Purple', '#bf5af2'], ['Gray', '#98989d']
  ];

  // [MOBILE] Chữ tiếng Việt cho giao diện điện thoại / tablet
  const VI = {
    search: 'Tìm kiếm', items: 'mục', recents: 'Gần đây', shared: 'Được chia sẻ', browse: 'Duyệt',
    synced: 'Đã đồng bộ hóa với iCloud', empty: 'Thư mục trống', back: 'Quay lại', more: 'Thêm'
  };
  // [MOBILE] Tên hiển thị trên tiêu đề (mục nào không có ở đây thì dùng tên gốc)
  const VI_TITLE = {
    recents: 'Gần đây', shared: 'Được chia sẻ', apps: 'Ứng dụng',
    desktop: 'Màn hình nền', docs: 'Tài liệu', downloads: 'Tải về'
  };

  const ALL = ['website_project', 'mobile_project', 'branding_project', 'about', 'cv'];

  // [id, tên hiển thị, icon, danh sách file trong mục đó]
  const SIDE = [
    { head: 'Favourites', rows: [
      ['recents',   'Recents',      'clock',   ['website_project', 'cv']],
      ['apps',      'Applications', 'apps',    ALL],
      ['desktop',   'Desktop',      'desktop', ['branding_project', 'about']],
      ['docs',      'Documents',    'doc',     ['cv']],
      ['downloads', 'Downloads',    'down',    []]
    ] },
    { head: 'iCloud', rows: [
      ['p1',     'Project1',     'folder', ['website_project']],
      ['p2',     'Project2',     'folder', ['mobile_project']],
      ['p3',     'Project3',     'folder', ['branding_project']],
      ['icloud', 'iCloud Drive', 'cloud',  ALL]
    ] }
  ];

  // Vị trí rải rác (% theo vùng nội dung): [x, y]
  const SPOTS = [[33, 40], [60, 29], [55, 56], [31, 66], [68, 72]];
  const spot = (n, i) => (n === 1 ? [50, 45] : SPOTS[i % SPOTS.length]);

  /* ---------- ICON (SVG) ---------- */
  const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const I = {
    clock:   svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    apps:    svg('<path d="M12 4l6.5 12M12 4L5.5 16M8 13h8M5 19.5h2.5"/>'),
    desktop: svg('<rect x="4" y="5" width="16" height="11" rx="2"/><path d="M4 12.5h16M9 19.5h6"/>'),
    doc:     svg('<path d="M7 3.5h6.5L18 8v12.5H7z"/><path d="M13.5 3.5V8H18M9.5 12h5M9.5 15h5"/>'),
    down:    svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 8v6.5M9 12l3 3 3-3"/>'),
    folder:  svg('<path d="M4 7.5A1.5 1.5 0 015.5 6h4l2 2h7A1.5 1.5 0 0120 9.5v8a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z"/>'),
    cloud:   svg('<path d="M7.5 18.5a4 4 0 01-.5-7.97 5.5 5.5 0 0110.6-1A4.5 4.5 0 0117 18.5z"/>'),
    left:    svg('<path d="M14.5 6l-6 6 6 6"/>'),
    right:   svg('<path d="M9.5 6l6 6-6 6"/>'),
    grid:    svg('<rect x="4.5" y="4.5" width="6" height="6" rx="1.2"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.2"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.2"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.2"/>'),
    list:    svg('<path d="M9 7h10M9 12h10M9 17h10M5 7h.01M5 12h.01M5 17h.01"/>'),
    cols:    svg('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M9.5 5v14M14.5 5v14"/>'),
    gallery: svg('<rect x="4" y="5" width="16" height="9" rx="1.8"/><path d="M6 17.5h2M11 17.5h2M16 17.5h2"/>'),
    group:   svg('<rect x="4.5" y="4.5" width="4" height="4" rx="1"/><rect x="10" y="4.5" width="4" height="4" rx="1"/><rect x="15.5" y="4.5" width="4" height="4" rx="1"/><rect x="4.5" y="10" width="4" height="4" rx="1"/><rect x="10" y="10" width="4" height="4" rx="1"/><rect x="15.5" y="10" width="4" height="4" rx="1"/><path d="M8 18.5l2.5 2.5 2.5-2.5"/>'),
    share:   svg('<path d="M12 4v10M8.5 7.5L12 4l3.5 3.5M7 11H6a1 1 0 00-1 1v7a1 1 0 001 1h12a1 1 0 001-1v-7a1 1 0 00-1-1h-1"/>'),
    tag:     svg('<path d="M4.5 12.2V5.5a1 1 0 011-1h6.7a1 1 0 01.7.3l6.8 6.8a1 1 0 010 1.4l-6.7 6.7a1 1 0 01-1.4 0l-6.8-6.8a1 1 0 01-.3-.7z"/><circle cx="8.8" cy="8.8" r="1"/>'),
    more:    svg('<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3.2"/>'),
    search:  svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5"/>'),

    // [MOBILE] micro (trang trí trong ô tìm kiếm) + 3 icon đặc của thanh tab
    mic:     svg('<rect x="9" y="3.5" width="6" height="10.5" rx="3" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v2.5"/>'),
    tRecent: svg('<circle cx="12" cy="12" r="10"/><path class="fm-hand" d="M12 6.8v5.7H8.2"/>'),
    tShared: svg('<path d="M2.5 8.2A2.2 2.2 0 014.7 6h4.4l1.9 2h6.3a2.2 2.2 0 012.2 2.2v7.6a2.2 2.2 0 01-2.2 2.2H4.7a2.2 2.2 0 01-2.2-2.2z"/><circle class="fm-badge" cx="18" cy="6.5" r="4.4"/><circle cx="18" cy="5.3" r="1.1" style="fill:var(--fm-card)"/><path class="fm-hand" d="M16 9a2.2 2.2 0 014 0"/>'),
    tBrowse: svg('<path d="M2.8 7.8a2.3 2.3 0 012.3-2.3h4.3l2 2.1h7.5a2.3 2.3 0 012.3 2.3v7.6a2.3 2.3 0 01-2.3 2.3H5.1a2.3 2.3 0 01-2.3-2.3z"/>')
  };

  const VIEWS = [['icons', 'Icons', I.grid], ['list', 'List', I.list], ['columns', 'Columns', I.cols], ['gallery', 'Gallery', I.gallery]];

  /* ---------- HÀM PHỤ ---------- */
  const h = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const btn = (label, icon, cls) => {
    const b = h('button', 'fd-btn' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.innerHTML = icon;
    return b;
  };

  const pill = (...kids) => {
    const p = h('div', 'fd-pill');
    p.append(...kids);
    return p;
  };

  const imgSrc = k => `assets/folders/${FILES[k].img}.png`;
  const kindOf = k => KIND[FILES[k].img] || 'Document';
  const fmt = d => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const tagColor = n => (TAGS.find(t => t[0] === n) || [])[1];
  const mkImg = src => {
    const im = new Image();
    im.src = src;
    im.alt = '';
    im.draggable = false;
    return im;
  };

  // [MOBILE] ngày kiểu 30/8/26, số mục trong thư mục, dòng phụ dưới tên (giống app Tệp)
  const fmtVi = d => new Date(d).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric', year: '2-digit' });
  const countOf = k => (CHILDREN[k] ? CHILDREN[k].length : (FILES[k].leaf ? 0 : null));
  const subOf = k => {
    const c = countOf(k);
    return c != null ? `${c} ${VI.items}` : [fmtVi(FILES[k].date), FILES[k].size].filter(Boolean).join('\n');
  };

  /* ---------- BUILD ---------- */
  function build(body, _title, api) {
    const { open, isMobile } = api;
    body.classList.add('flush', 'fd-body');

    const root = h('div', 'fd');
    const side = h('nav', 'fd-side');
    side.setAttribute('aria-label', 'Sidebar');
    side.append(h('div', 'win-drag fd-side-drag'));

    const main = h('div', 'fd-main');
    const bar = h('div', 'fd-bar win-drag');
    const canvas = h('div', 'fd-canvas');

    let cur = 'apps';
    let hist = ['apps'];
    let hi = 0;
    let view = 'icons';      // icons | list | columns | gallery (máy tính)
    let mview = 'icons';     // [MOBILE] icons | list (điện thoại / tablet)
    let group = 'none';      // none | kind | name | tag
    let sort = 'none';       // none | name | kind | date
    let sel = null;          // key đang chọn
    const tags = {};         // key -> tên tag
    const entries = {};
    const rows = {};
    const small = () => window.matchMedia('(max-width:1100px)').matches;

    /* --- Sidebar --- */
    SIDE.forEach((g, gi) => {
      side.append(h('div', 'fd-head' + (gi ? ' gap' : ''), g.head));
      g.rows.forEach(([id, label, icon, files]) => {
        entries[id] = { label, files };
        const row = h('div', 'fd-row');
        row.setAttribute('role', 'button');
        row.tabIndex = 0;
        const ic = h('span', 'fd-ico');
        ic.innerHTML = I[icon];
        row.append(ic, h('span', null, label));
        row.addEventListener('click', () => show(id, true));
        rows[id] = row;
        side.append(row);
      });
    });

    // Mỗi folder có con trở thành một "vị trí" mà Finder đi vào được (Back/Forward dùng chung history)
    Object.keys(CHILDREN).forEach(k => { entries[k] = { label: FILES[k].name, files: CHILDREN[k] }; });

    // [MOBILE] tab "Được chia sẻ" (chưa có nội dung)
    entries.shared = { label: 'Shared', files: [] };

    /* --- Thanh công cụ --- */
    const back = btn('Back', I.left);
    const fwd = btn('Forward', I.right);
    const nav = pill(back, h('i', 'fd-div'), fwd);

    const title = h('div', 'fd-title');
    const tIco = mkImg('assets/folders/folder.png');
    const tText = h('span');
    title.append(tIco, tText);

    const viewBtns = VIEWS.map(([k, l, ic]) => {
      const b = btn(l, ic, k === view ? 'on' : '');
      b.addEventListener('click', () => {
        view = k;
        viewBtns.forEach(o => o.classList.toggle('on', o === b));
        render();
      });
      return b;
    });
    const viewPill = pill(...viewBtns);

    const gBtn = btn('Group', I.group, 'dim');
    const groupPill = pill(gBtn);

    const shBtn = btn('Share', I.share);
    const tgBtn = btn('Tags', I.tag);
    const moBtn = btn('More', I.more);
    const actPill = pill(shBtn, tgBtn, moBtn);

    const search = h('label', 'fd-pill fd-search');
    const sIco = h('span', 'fd-sico');
    sIco.innerHTML = I.search;
    const input = h('input');
    input.type = 'search';
    input.placeholder = 'Search';
    input.setAttribute('aria-label', 'Search');
    input.autocomplete = 'off';
    input.spellcheck = false;
    search.append(sIco, input);

    bar.append(nav, title, h('div', 'fd-sp'), viewPill, groupPill, actPill, search);

    /* --- [MOBILE] Header + ô tìm kiếm + thanh tab (chỉ hiện ở ≤1100px, finder-mobile.css lo) --- */
    const mBack = h('button', 'fm-circle');
    mBack.type = 'button';
    mBack.setAttribute('aria-label', VI.back);
    mBack.innerHTML = I.left;
    mBack.addEventListener('click', () => back.click());

    const mMore = h('button', 'fm-circle');
    mMore.type = 'button';
    mMore.setAttribute('aria-label', VI.more);
    mMore.innerHTML = I.more;

    const mTitle = h('div', 'fm-title');
    const mHead = h('div', 'fm-head');
    mHead.append(mBack, mTitle, mMore);

    const mSearch = h('label', 'fm-search');
    const msIco = h('span', 'fd-sico');
    msIco.innerHTML = I.search;
    const mInput = h('input');
    mInput.type = 'search';
    mInput.placeholder = VI.search;
    mInput.setAttribute('aria-label', VI.search);
    mInput.autocomplete = 'off';
    mInput.spellcheck = false;
    const mic = h('span', 'fm-mic');
    mic.setAttribute('aria-hidden', 'true');
    mic.innerHTML = I.mic;
    mSearch.append(msIco, mInput, mic);

    // Tab "Duyệt" trỏ vào iCloud Drive (danh sách đầy đủ)
    const TABS = [['recents', VI.recents, I.tRecent], ['shared', VI.shared, I.tShared], ['icloud', VI.browse, I.tBrowse]];
    const mTabs = h('nav', 'fm-tabs');
    mTabs.setAttribute('aria-label', 'Tabs');
    const tabBtns = TABS.map(([id, label, ic]) => {
      const b = h('button', 'fm-tab');
      b.type = 'button';
      b.innerHTML = ic;
      b.append(h('span', null, label));
      b.addEventListener('click', () => show(id, true));
      return [id, b];
    });
    mTabs.append(...tabBtns.map(t => t[1]));

    const paintTabs = id => {
      tabBtns.forEach(([tid, b]) => {
        const on = tid === 'icloud' ? !['recents', 'shared'].includes(id) : tid === id;
        b.classList.toggle('on', on);
      });
    };

    main.append(bar, mHead, mSearch, canvas, mTabs);
    root.append(side, main);
    body.append(root);

    /* --- Popover menu + toast + hộp thông tin --- */
    const pop = h('div', 'fd-pop');
    pop.hidden = true;
    pop.setAttribute('role', 'menu');
    root.append(pop);
    let popFor = null;

    const closePop = () => { pop.hidden = true; popFor = null; };

    function menu(anchor, list) {
      if (popFor === anchor && !pop.hidden) { closePop(); return; }
      pop.replaceChildren();
      list.forEach(m => {
        if (m.sep) { pop.append(h('div', 'fd-sep')); return; }
        if (m.head) { pop.append(h('div', 'fd-mhead', m.head)); return; }
        const r = h('button', 'fd-mi');
        r.type = 'button';
        r.disabled = !!m.off;
        r.append(h('span', 'fd-ck', m.on ? '✓' : ''));
        if (m.color) {
          const d = h('i', 'fd-dot big');
          d.style.background = m.color;
          r.append(d);
        }
        r.append(h('span', null, m.label));
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
    root.addEventListener('keydown', e => { if (e.key === 'Escape') closePop(); });

    const toastEl = h('div', 'fd-toast');
    toastEl.hidden = true;
    root.append(toastEl);
    let tt;
    const toast = m => {
      toastEl.textContent = m;
      toastEl.hidden = false;
      clearTimeout(tt);
      tt = setTimeout(() => { toastEl.hidden = true; }, 1600);
    };

    function info(k) {
      const ov = h('div', 'fd-ov');
      const card = h('div', 'fd-card');
      const ok = h('button', 'fd-ok', 'Done');
      ok.type = 'button';
      card.append(
        mkImg(imgSrc(k)),
        h('b', null, FILES[k].name),
        h('p', null, `Kind: ${kindOf(k)}`),
        h('p', null, `Modified: ${fmt(FILES[k].date)}`),
        h('p', null, `Tag: ${tags[k] || 'None'}`),
        ok
      );
      ov.append(card);
      ov.addEventListener('click', e => { if (e.target === ov || e.target === ok) ov.remove(); });
      root.append(ov);
    }

    /* --- Menu: Group --- */
    gBtn.addEventListener('click', () => menu(gBtn, [
      { head: 'Group by' },
      ...[['none', 'None'], ['kind', 'Kind'], ['name', 'Name'], ['tag', 'Tag']].map(([k, l]) => ({
        label: l, on: group === k,
        run: () => { group = k; gBtn.classList.toggle('dim', k === 'none'); render(); }
      }))
    ]));

    /* --- Menu: Share --- */
    const link = () => location.href.split('#')[0] + '#' + (sel || cur);
    const shareName = () => (sel ? FILES[sel].name : entries[cur].label);
    shBtn.addEventListener('click', () => menu(shBtn, [
      { head: shareName() },
      {
        label: 'Copy Link',
        run: async () => {
          try { await navigator.clipboard.writeText(link()); toast('Link copied'); }
          catch { toast('Could not copy link'); }
        }
      },
      {
        label: 'Email…',
        run: () => { location.href = 'mailto:?subject=' + encodeURIComponent(shareName()) + '&body=' + encodeURIComponent(link()); }
      },
      {
        label: 'Download',
        off: !(sel && FILES[sel].href),
        run: () => {
          const a = h('a');
          a.href = FILES[sel].href;
          a.download = FILES[sel].name;
          a.click();
        }
      }
    ]));

    /* --- Menu: Tags (gán cho item đang chọn) --- */
    tgBtn.addEventListener('click', () => menu(tgBtn, [
      { head: sel ? FILES[sel].name : 'Select an item first' },
      ...TAGS.map(([n, c]) => ({
        label: n, color: c, off: !sel, on: !!sel && tags[sel] === n,
        run: () => { if (tags[sel] === n) delete tags[sel]; else tags[sel] = n; render(); }
      })),
      { sep: true },
      { label: 'Clear Tag', off: !sel || !tags[sel], run: () => { delete tags[sel]; render(); } }
    ]));

    /* --- Menu: More --- */
    moBtn.addEventListener('click', () => menu(moBtn, [
      { label: 'Open', off: !sel, run: () => activate(sel, canvas.querySelector(`[data-key="${sel}"]`)) },
      { label: 'Get Info', off: !sel, run: () => info(sel) },
      { sep: true },
      { head: 'Sort by' },
      ...[['none', 'None'], ['name', 'Name'], ['kind', 'Kind'], ['date', 'Date Modified']].map(([k, l]) => ({
        label: l, on: sort === k, run: () => { sort = k; render(); }
      }))
    ]));

    /* --- [MOBILE] Menu "…" : kiểu xem + sắp xếp --- */
    mMore.addEventListener('click', () => menu(mMore, [
      { head: 'Xem dạng' },
      { label: 'Biểu tượng', on: mview === 'icons', run: () => { mview = 'icons'; render(); } },
      { label: 'Danh sách',  on: mview === 'list',  run: () => { mview = 'list'; render(); } },
      { sep: true },
      { head: 'Sắp xếp theo' },
      ...[['none', 'Mặc định'], ['name', 'Tên'], ['kind', 'Loại'], ['date', 'Ngày sửa đổi']].map(([k, l]) => ({
        label: l, on: sort === k, run: () => { sort = k; render(); }
      }))
    ]));

    /* --- Điều hướng (back / forward) --- */
    const sync = () => {
      back.disabled = hi <= 0;
      fwd.disabled = hi >= hist.length - 1;
      mBack.disabled = back.disabled;     // [MOBILE]
    };
    back.addEventListener('click', () => { if (hi > 0) { hi--; show(hist[hi], false); } });
    fwd.addEventListener('click', () => { if (hi < hist.length - 1) { hi++; show(hist[hi], false); } });

    /* --- Lọc theo ô tìm kiếm (máy tính dùng ô trên thanh, điện thoại dùng ô riêng) --- */
    const filter = () => {
      const q = (small() ? mInput : input).value.trim().toLowerCase();
      canvas.querySelectorAll('[data-key]').forEach(it => {
        it.hidden = !!q && !it.dataset.name.includes(q);
      });
    };
    input.addEventListener('input', filter);
    mInput.addEventListener('input', filter);

    /* --- Chọn item + khung xem trước --- */
    const paintSel = () => {
      canvas.querySelectorAll('[data-key]').forEach(n => n.classList.toggle('sel', n.dataset.key === sel));
    };

    function refreshPreview() {
      const pv = canvas.querySelector('.fd-prev, .fd-gal');
      if (!pv) return;
      pv.replaceChildren();
      if (!sel) { pv.append(h('p', 'fd-nosel', 'No Selection')); return; }
      pv.append(
        mkImg(imgSrc(sel)),
        h('div', 'fd-pname', FILES[sel].name),
        h('div', 'fd-pmeta', `${kindOf(sel)} · ${fmt(FILES[sel].date)}` + (tags[sel] ? ` · ${tags[sel]}` : ''))
      );
    }

    function setSel(k) {
      sel = k;
      paintSel();
      refreshPreview();
    }

    canvas.addEventListener('click', () => { if (!canvas.classList.contains('v-gallery')) setSel(null); });

    /* --- Dữ liệu hiển thị: sắp xếp + gom nhóm --- */
    const cmp = {
      name: (a, b) => FILES[a].name.localeCompare(FILES[b].name),
      kind: (a, b) => kindOf(a).localeCompare(kindOf(b)) || cmp.name(a, b),
      date: (a, b) => FILES[b].date.localeCompare(FILES[a].date)
    };

    const keysNow = () => {
      const arr = entries[cur].files.slice();
      if (sort !== 'none') arr.sort(cmp[sort]);
      return arr;
    };

    const groupName = k => (
      group === 'kind' ? kindOf(k) :
      group === 'name' ? FILES[k].name[0].toUpperCase() :
      (tags[k] || 'No Tag')
    );

    const groupsOf = keys => {
      if (group === 'none') return [[null, keys]];
      const m = new Map();
      keys.forEach(k => {
        const g = groupName(k);
        if (!m.has(g)) m.set(g, []);
        m.get(g).push(k);
      });
      return [...m].sort((a, b) => a[0].localeCompare(b[0]));
    };

    /* --- Tạo phần tử --- */
    const label = k => {
      const s = h('span');
      if (tags[k]) {
        const d = h('i', 'fd-dot');
        d.style.background = tagColor(tags[k]);
        s.append(d);
      }
      s.append(FILES[k].name);
      return s;
    };

    function wire(el, k) {
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.dataset.key = k;
      el.dataset.name = FILES[k].name.toLowerCase();
      el.addEventListener('click', e => {
        e.stopPropagation();
        if (small() || isMobile() || e.detail === 0) activate(k, el);     // cảm ứng / phím Enter: mở luôn
        else setSel(k);                                                    // chuột: bấm = chọn
      });
      el.addEventListener('dblclick', e => {
        e.stopPropagation();
        activate(k, el);
      });
      return el;
    }

    /* Mở một item:
       - Desktop + folder có nội dung: đi vào trong chính cửa sổ Finder (kiểu macOS)
       - Folder con chưa có nội dung: báo "đang cập nhật"
       - Còn lại (file, About Me, và mọi thứ trên tablet/điện thoại): mở cửa sổ riêng */
    function activate(k, el) {
      const desktop = !small() && !isMobile();
      if (desktop && CHILDREN[k]) show(k, true);
      else if (FILES[k].leaf) toast('Đang cập nhật nội dung');
      else open(k, el, null);
    }

    function iconItem(k, i, n, scatter) {
      const it = wire(h('div', 'fd-item'), k);
      if (scatter) {
        const [x, y] = spot(n, i);
        it.style.setProperty('--x', x + '%');
        it.style.setProperty('--y', y + '%');
      } else it.classList.add('flow');
      it.append(mkImg(imgSrc(k)), label(k));
      if (small()) it.append(h('div', 'fd-sub', subOf(k)));     // [MOBILE] "4 mục" / ngày + dung lượng
      return it;
    }

    function listRow(k, compact) {
      const r = wire(h('div', compact ? 'fd-cr' : 'fd-li'), k);
      const nm = h('div', 'c-name');
      nm.append(mkImg(imgSrc(k)), label(k));
      r.append(nm);
      if (!compact) r.append(h('span', null, fmt(FILES[k].date)), h('span', null, kindOf(k)));
      return r;
    }

    // [MOBILE] một dòng của chế độ "Danh sách" trên điện thoại
    function mobileRow(k) {
      const r = wire(h('div', 'fm-li'), k);
      const t = h('div', 'fm-li-t');
      t.append(label(k), h('div', 'fd-sub', subOf(k).replace('\n', ' · ')));
      r.append(mkImg(imgSrc(k)), t);
      return r;
    }

    // [MOBILE] chân trang: "4 mục" + "Đã đồng bộ hóa với iCloud"
    const foot = n => {
      const f = h('div', 'fm-foot');
      f.append(h('b', null, `${n} ${VI.items}`));
      if (cur === 'icloud') f.append(h('span', null, VI.synced));
      return f;
    };

    const section = (t, node) => {
      if (t == null) return node;
      const s = h('div', 'fd-sec');
      s.append(h('div', 'fd-sec-h', t), node);
      return s;
    };

    /* --- Vẽ nội dung --- */
    function render() {
      canvas.replaceChildren();
      const mode = small() ? (mview === 'list' ? 'mlist' : 'icons') : view;
      canvas.className = 'fd-canvas v-' + mode;

      const keys = keysNow();
      if (!keys.length) {
        canvas.append(h('p', 'fd-empty', small() ? VI.empty : 'This folder is empty'));
        return;
      }
      if (sel && !keys.includes(sel)) sel = null;
      if (mode === 'gallery' && !sel) sel = keys[0];

      const groups = small() ? [[null, keys]] : groupsOf(keys);
      const plain = groups.length === 1 && groups[0][0] === null;

      if (mode === 'icons') {
        if (plain) keys.forEach((k, i) => canvas.append(iconItem(k, i, keys.length, true)));
        else groups.forEach(([t, ks]) => {
          const flow = h('div', 'fd-flow');
          ks.forEach(k => flow.append(iconItem(k, 0, 0, false)));
          canvas.append(section(t, flow));
        });
      } else if (mode === 'mlist') {
        const box = h('div', 'fm-list');
        keys.forEach(k => box.append(mobileRow(k)));
        canvas.append(box);
      } else if (mode === 'list') {
        const head = h('div', 'fd-lh');
        head.append(h('span', null, 'Name'), h('span', null, 'Date Modified'), h('span', null, 'Kind'));
        canvas.append(head);
        groups.forEach(([t, ks]) => {
          const box = h('div');
          ks.forEach(k => box.append(listRow(k, false)));
          canvas.append(section(t, box));
        });
      } else if (mode === 'columns') {
        const col = h('div', 'fd-col');
        groups.forEach(([t, ks]) => {
          const box = h('div');
          ks.forEach(k => box.append(listRow(k, true)));
          col.append(section(t, box));
        });
        canvas.append(col, h('div', 'fd-col fd-prev'));
      } else {
        const strip = h('div', 'fd-strip');
        keys.forEach(k => strip.append(iconItem(k, 0, 0, false)));
        canvas.append(h('div', 'fd-gal'), strip);
      }

      if (small()) canvas.append(foot(keys.length));     // [MOBILE]

      paintSel();
      refreshPreview();
      filter();
    }

    function show(id, push) {
      if (!entries[id]) return;
      if (push) {
        if (id === cur) return;
        hist = hist.slice(0, hi + 1);
        hist.push(id);
        hi = hist.length - 1;
      }
      cur = id;
      sel = null;
      closePop();
      Object.entries(rows).forEach(([k, r]) => r.classList.toggle('on', k === id));
      tText.textContent = entries[id].label;
      tIco.hidden = false;
      mTitle.textContent = VI_TITLE[id] || entries[id].label;     // [MOBILE]
      paintTabs(id);                                              // [MOBILE]
      render();
      sync();
    }

    // Đổi kích thước qua mốc 1100px thì vẽ lại (desktop <-> tablet)
    const mq = window.matchMedia('(max-width:1100px)');
    const onMq = () => {
      if (!root.isConnected) { mq.removeEventListener('change', onMq); return; }
      render();
    };
    mq.addEventListener('change', onMq);

    // [MOBILE] Điện thoại / tablet mở thẳng iCloud Drive (như tab "Duyệt"), máy tính mở "Applications"
    const start = small() ? 'icloud' : 'apps';
    hist[0] = start;
    show(start, false);
  }

  /* ---------- ĐĂNG KÝ APP ---------- */
  (window.WMApps = window.WMApps || {}).finder = {
    title: 'Finder',
    w: 980,
    h: 600,
    cls: 'is-finder',        // class thêm vào cửa sổ (finder.css dùng để ẩn thanh tiêu đề trên máy tính)
    build
  };
})();