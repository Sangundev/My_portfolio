/* =========================================================
   js/apps/notes.js: app Notes (kiểu Notes của macOS + iOS)
   - Tự đăng ký vào window.WMApps.notes, window-manager.js sẽ gọi build()
   - Máy tính (>1100px): 3 cột giống macOS
       Sidebar (iCloud: All Notes / Quick Notes / Shared / thư mục / Recently Deleted + Tags)
       | Danh sách ghi chú (Pinned, Today, Previous 7 Days...) | Khung soạn thảo
   - Điện thoại / tablet (≤1100px): giống Notes trên iPhone
       Thư mục -> Danh sách ghi chú -> Soạn thảo (nút quay lại + nút tròn nổi để tạo ghi chú)
   - Ghi chú được lưu trong localStorage (mất khi xoá dữ liệu trình duyệt)
   - CSS đi kèm: css/apps/notes.css
========================================================= */
(() => {
  /* ---------- DỮ LIỆU MẪU (sửa ở đây) ---------- */
  const KEY = 'ngocsang-notes-v1';
  const DAY = 864e5;
  const HOUR = 36e5;
  const T0 = Date.now();
  const ago = (d, h = 0) => T0 - d * DAY - h * HOUR;

  // [id, tên thư mục]
  // quick: true = hiện trong Quick Notes | pinned: true = ghim lên đầu danh sách
  const SEED = {
    folders: [['notes', 'Notes'], ['projects', 'Projects'], ['ideas', 'Ideas']],
    notes: [
      {
        id: 'n1', folder: 'notes', pinned: true, date: ago(0, 0.3),
        html: `<div>About Me</div>
          <div>Hi, I'm Ngoc Sang, a designer who turns messy ideas into clean, usable interfaces.</div>
          <div><br></div>
          <ul><li>UI / UX design for web and mobile</li><li>Design systems and prototyping in Figma</li><li>Brand identity, logo and packaging</li><li>Front-end with HTML, CSS and JavaScript</li></ul>
          <div><br></div>
          <div>#about #design</div>`
      },
      {
        id: 'n2', folder: 'notes', pinned: true, date: ago(0, 2),
        html: `<div>To do</div>
          <ul class="nt-check"><li>Become a better designer</li><li>Get really good at Figma</li><li class="done">Travel more</li><li>Build something I'm proud of</li><li>Make a portfolio people remember</li><li class="done">Stop saying "I'll do it tomorrow"</li></ul>
          <div><br></div><div>#todo</div>`
      },
      {
        id: 'n3', folder: 'notes', quick: true, date: ago(1, 3),
        html: `<div>Call the printer</div><div>Ask about paper weight for the business cards before Friday.</div>`
      },
      {
        id: 'n4', folder: 'projects', date: ago(3, 1),
        html: `<div>Portfolio plan</div>
          <div>Website, mobile and branding projects, each with a short case study.</div>
          <div><br></div>
          <ol><li>Research and audit</li><li>Wireframes</li><li>Visual design</li><li>Handoff</li></ol>
          <div><br></div><div>#work #portfolio</div>`
      },
      {
        id: 'n5', folder: 'projects', date: ago(9, 4),
        html: `<div>Brand guideline ideas</div>
          <div>Logo system, colour palette, typography, packaging mockups and a one-page usage guide.</div>
          <div><br></div><div>#work #branding</div>`
      },
      {
        id: 'n6', folder: 'ideas', date: ago(16, 5),
        html: `<div>Coffee spots to try</div>
          <ul class="nt-check"><li>A quiet place near the river</li><li class="done">Rooftop café with good Wi-Fi</li><li>Small roastery in District 1</li></ul>
          <div><br></div><div>#life</div>`
      },
      {
        id: 'n7', folder: 'ideas', date: ago(41, 2),
        html: `<div>Learn Figma auto layout</div>
          <div>Practice buttons, cards and responsive lists. Then build a small design system with variables.</div>
          <div><br></div><div>#learning #design</div>`
      },
      {
        id: 'n8', folder: 'notes', date: ago(95, 6),
        html: `<div>Cover letter draft</div>
          <div>Dear Hiring Team, I'm excited to apply for the Product Designer position. I enjoy working with people around the world and I keep improving my craft every day.</div>`
      }
    ]
  };

  const TAGS_RE = /#[\p{L}\d_-]+/gu;
  const VI = { back: 'Quay lại', folders: 'Thư mục', search: 'Tìm kiếm' };

  /* ---------- ICON (SVG) ---------- */
  const svg = p => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const I = {
    all:     svg('<rect x="5" y="4" width="14" height="16" rx="2.5"/><path d="M8.5 9h7M8.5 12.5h7M8.5 16h4"/>'),
    quick:   svg('<path d="M13 3.5L6 13.5h5l-1 7 7-10h-5z"/>'),
    shared:  svg('<path d="M3.5 8A2 2 0 015.5 6h4l2 2h7a2 2 0 012 2v7.5a2 2 0 01-2 2h-13a2 2 0 01-2-2z"/><circle cx="12" cy="11.8" r="1.5"/><path d="M9.2 17c.4-1.5 1.5-2.2 2.8-2.2s2.4.7 2.8 2.2"/>'),
    folder:  svg('<path d="M4 7.5A1.5 1.5 0 015.5 6h4l2 2h7A1.5 1.5 0 0120 9.5v8a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 17.5z"/>'),
    trash:   svg('<path d="M5 7h14M10 7V5h4v2M7 7l.8 12h8.4L17 7M10.2 10.5v6M13.8 10.5v6"/>'),
    sidebar: svg('<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><path d="M9.5 5v14"/>'),
    list:    svg('<path d="M9 7h10M9 12h10M9 17h10M5 7h.01M5 12h.01M5 17h.01" stroke-width="2.6"/>'),
    grid:    svg('<rect x="4.5" y="4.5" width="6" height="6" rx="1.2"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.2"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.2"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.2"/>'),
    compose: svg('<path d="M12 5H6.5A1.5 1.5 0 005 6.5v11A1.5 1.5 0 006.5 19h11a1.5 1.5 0 001.5-1.5V12M17.5 4.5l2 2L11 15l-3 1 1-3z"/>'),
    check:   svg('<circle cx="12" cy="12" r="7.5"/><path d="M8.8 12.2l2.2 2.2 4.2-4.6"/>'),
    table:   svg('<rect x="4" y="5" width="16" height="14" rx="2"/><path d="M4 10h16M4 14.5h16M10 5v14"/>'),
    pin:     svg('<path d="M9 4.5h6l-1 5 3 3.2H7l3-3.2zM12 12.7V20"/>'),
    share:   svg('<path d="M12 4v10M8.5 7.5L12 4l3.5 3.5M7 11H6a1 1 0 00-1 1v7a1 1 0 001 1h12a1 1 0 001-1v-7a1 1 0 00-1-1h-1"/>'),
    search:  svg('<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5"/>'),
    back:    svg('<path d="M14.5 6l-6 6 6 6"/>'),
    plus:    svg('<path d="M12 5v14M5 12h14"/>'),
    bold:    svg('<path d="M7 5h6a3.5 3.5 0 010 7H7zM7 12h7a3.5 3.5 0 010 7H7z"/>'),
    italic:  svg('<path d="M10 5h7M7 19h7M14.5 5l-5 14"/>'),
    under:   svg('<path d="M7 5v6a5 5 0 0010 0V5M5.5 20h13"/>'),
    strike:  svg('<path d="M5 12h14M16.5 7.5A4 4 0 0012 6c-2.5 0-4 1.2-4 3 0 3.5 8 2 8 6 0 1.8-1.7 3-4 3a4.5 4.5 0 01-4.5-2"/>'),
    ul:      svg('<path d="M10 7h9M10 12h9M10 17h9M5.5 7h.01M5.5 12h.01M5.5 17h.01" stroke-width="2.8"/>'),
    ol:      svg('<path d="M11 7h8M11 12h8M11 17h8M5 6l1-.7V9M4.8 13.5c.4-.8 1.8-.8 1.8.2 0 .9-1.8 1.4-1.8 2.3h1.9"/>')
  };

  /* ---------- HÀM PHỤ ---------- */
  const h = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const icon = (name, cls) => {
    const s = h('span', cls || 'nt-ico');
    s.innerHTML = I[name];
    return s;
  };

  const btn = (label, ic, cls) => {
    const b = h('button', 'nt-btn' + (cls ? ' ' + cls : ''));
    b.type = 'button';
    b.setAttribute('aria-label', label);
    b.title = label;
    b.innerHTML = ic;
    b.addEventListener('mousedown', e => e.preventDefault());   // không cướp focus của vùng soạn thảo
    return b;
  };

  const pill = (...kids) => {
    const p = h('div', 'nt-pill');
    p.append(...kids);
    return p;
  };

  const day0 = d => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = ms => Math.round((day0(new Date()) - day0(new Date(ms))) / DAY);
  const pad = n => String(n).padStart(2, '0');
  const hhmm = ms => { const d = new Date(ms); return pad(d.getHours()) + ':' + pad(d.getMinutes()); };

  // Tiêu đề nhóm trong danh sách (giống Notes: Today, Previous 7 Days, tháng...)
  const groupOf = n => {
    if (n.pinned) return 'Pinned';
    const d = dayDiff(n.date);
    if (d <= 0) return 'Today';
    if (d === 1) return 'Yesterday';
    if (d <= 7) return 'Previous 7 Days';
    if (d <= 30) return 'Previous 30 Days';
    const dt = new Date(n.date);
    return dt.getFullYear() === new Date().getFullYear()
      ? dt.toLocaleDateString('en-GB', { month: 'long' })
      : String(dt.getFullYear());
  };

  // Ngày hiện ở dòng phụ của mỗi ghi chú
  const shortDate = ms => {
    const d = dayDiff(ms);
    if (d <= 0) return hhmm(ms);
    if (d === 1) return 'Yesterday';
    if (d <= 7) return new Date(ms).toLocaleDateString('en-GB', { weekday: 'long' });
    return new Date(ms).toLocaleDateString('en-GB');
  };

  const longDate = ms => new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) + ' at ' + hhmm(ms);

  // Tách HTML thành các dòng chữ để lấy tiêu đề / xem trước / tag
  const linesOf = html => {
    const t = document.createElement('div');
    t.innerHTML = html.replace(/<\/(div|p|h[1-6]|li|pre|tr)>|<br\s*\/?>/gi, '$&\n');
    return t.textContent.split('\n').map(s => s.trim()).filter(Boolean);
  };

  /* ---------- BUILD ---------- */
  function build(body, _title, api) {
    const { isMobile } = api;
    body.classList.add('flush', 'nt-body');

    const small = () => window.matchMedia('(max-width:1100px)').matches || isMobile();

    /* --- Dữ liệu --- */
    let data;
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
    if (!data || !Array.isArray(data.notes) || !Array.isArray(data.folders)) data = JSON.parse(JSON.stringify(SEED));
    const save = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* bỏ qua */ } };

    const byId = id => data.notes.find(n => n.id === id);
    const info = n => {
      const ls = linesOf(n.html);
      return {
        title: ls[0] || 'New Note',
        preview: ls[1] || 'No additional text',
        tags: [...new Set(ls.join(' ').match(TAGS_RE) || [])]
      };
    };

    const SMART = [
      ['all', 'All Notes', 'all', n => !n.deleted],
      ['quick', 'Quick Notes', 'quick', n => !n.deleted && n.quick],
      ['shared', 'Shared', 'shared', () => false]
    ];

    const viewDef = id => {
      const s = SMART.find(x => x[0] === id);
      if (s) return { label: s[1], icon: s[2], f: s[3] };
      if (id === 'trash') return { label: 'Recently Deleted', icon: 'trash', f: n => !!n.deleted };
      const fo = data.folders.find(x => x[0] === id);
      return { label: fo ? fo[1] : 'Notes', icon: 'folder', f: n => !n.deleted && n.folder === id };
    };

    /* --- Trạng thái --- */
    let view = 'all';
    let tagF = null;
    let curId = null;
    let q = '';
    let gallery = false;
    let screen = 'folders';       // [MOBILE] folders | list | edit

    /* --- Khung --- */
    const root = h('div', 'nt');
    const side = h('nav', 'nt-side');
    side.setAttribute('aria-label', 'Folders');

    const listPane = h('section', 'nt-listpane');
    const listBar = h('div', 'nt-bar nt-lbar win-drag');
    const searchBox = h('label', 'nt-search');
    const sInput = h('input');
    sInput.type = 'search';
    sInput.placeholder = 'Search';
    sInput.setAttribute('aria-label', 'Search');
    sInput.autocomplete = 'off';
    sInput.spellcheck = false;
    searchBox.append(icon('search', 'nt-sico'), sInput);
    const list = h('div', 'nt-list');

    const edit = h('section', 'nt-edit');
    const eBar = h('div', 'nt-bar nt-ebar win-drag');
    const scroller = h('div', 'nt-scroll');
    const dateEl = h('div', 'nt-date');
    const paper = h('article', 'nt-paper');
    paper.contentEditable = 'true';
    paper.spellcheck = false;
    paper.setAttribute('aria-label', 'Note');
    const empty = h('div', 'nt-none', 'No Note Selected');
    scroller.append(dateEl, paper);
    edit.append(eBar, scroller, empty);

    /* --- Thanh trên của danh sách: nút sidebar + chế độ xem --- */
    const sbBtn = btn('Toggle Sidebar', I.sidebar);
    sbBtn.addEventListener('click', () => root.classList.toggle('no-side'));

    const vList = btn('As List', I.list, 'on');
    const vGal = btn('As Gallery', I.grid);
    const setGallery = g => {
      gallery = g;
      vList.classList.toggle('on', !g);
      vGal.classList.toggle('on', g);
      list.classList.toggle('gal', g);
    };
    vList.addEventListener('click', () => setGallery(false));
    vGal.addEventListener('click', () => setGallery(true));

    const listTitle = h('div', 'nt-ltitle');
    listBar.append(pill(sbBtn), h('div', 'nt-sp'), pill(vList, vGal));
    listPane.append(listBar, searchBox, list);

    /* --- Thanh trên của khung soạn thảo --- */
    const bDel = btn('Delete', I.trash);
    const bNew = btn('New Note', I.compose);
    const bAa = btn('Format', '<span class="nt-aa">Aa</span>');
    const bChk = btn('Checklist', I.check);
    const bTbl = btn('Table', I.table);
    const bPin = btn('Pin Note', I.pin);
    const bShare = btn('Share', I.share);
    eBar.append(pill(bDel, bNew), h('div', 'nt-sp'), pill(bAa, bChk, bTbl), h('div', 'nt-sp'), pill(bPin, bShare));

    /* --- [MOBILE] Header + nút tròn nổi --- */
    const mBack = h('button', 'nm-circle');
    mBack.type = 'button';
    mBack.setAttribute('aria-label', VI.back);
    mBack.innerHTML = I.back;
    const mTitle = h('div', 'nm-title');
    const mAct = h('button', 'nm-circle');
    mAct.type = 'button';
    mAct.setAttribute('aria-label', 'Delete');
    mAct.innerHTML = I.trash;
    const mHead = h('div', 'nm-head');
    mHead.append(mBack, mTitle, mAct);

    const mFab = h('button', 'nm-fab');
    mFab.type = 'button';
    mFab.setAttribute('aria-label', 'New Note');
    mFab.innerHTML = I.compose;

    root.append(side, listPane, edit, mHead, mFab);
    body.append(root);

    /* --- Popover định dạng (Aa) --- */
    const pop = h('div', 'nt-pop');
    pop.hidden = true;
    root.append(pop);

    const toastEl = h('div', 'nt-toast');
    toastEl.hidden = true;
    root.append(toastEl);
    let tt;
    const toast = m => {
      toastEl.textContent = m;
      toastEl.hidden = false;
      clearTimeout(tt);
      tt = setTimeout(() => { toastEl.hidden = true; }, 1600);
    };

    /* --- Soạn thảo --- */
    const focusEd = () => { if (document.activeElement !== paper) paper.focus(); };

    const exec = (cmd, val) => {
      focusEd();
      document.execCommand(cmd, false, val);
      onInput();
    };

    const closePop = () => { pop.hidden = true; };

    function buildPop() {
      pop.replaceChildren();
      const blocks = [['Title', 'h1'], ['Heading', 'h2'], ['Subheading', 'h3'], ['Body', 'p'], ['Monospaced', 'pre']];
      blocks.forEach(([l, tag]) => {
        const b = h('button', 'nt-mi nt-mi-' + tag, l);
        b.type = 'button';
        b.addEventListener('mousedown', e => e.preventDefault());
        b.addEventListener('click', () => { closePop(); exec('formatBlock', tag); });
        pop.append(b);
      });
      pop.append(h('div', 'nt-sep'));
      const row = (items) => {
        const r = h('div', 'nt-prow');
        items.forEach(([l, ic, fn]) => {
          const b = btn(l, ic);
          b.addEventListener('click', () => { closePop(); fn(); });
          r.append(b);
        });
        return r;
      };
      pop.append(
        row([
          ['Bold', I.bold, () => exec('bold')],
          ['Italic', I.italic, () => exec('italic')],
          ['Underline', I.under, () => exec('underline')],
          ['Strikethrough', I.strike, () => exec('strikeThrough')]
        ]),
        row([
          ['Bulleted List', I.ul, () => exec('insertUnorderedList')],
          ['Numbered List', I.ol, () => exec('insertOrderedList')],
          ['Checklist', I.check, () => checklist()]
        ])
      );
    }
    buildPop();

    bAa.addEventListener('click', () => {
      if (!pop.hidden) { closePop(); return; }
      pop.hidden = false;
      const rr = root.getBoundingClientRect();
      const ar = bAa.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(ar.left - rr.left, rr.width - pop.offsetWidth - 8)) + 'px';
      pop.style.top = (ar.bottom - rr.top + 8) + 'px';
    });

    const away = e => {
      if (!root.isConnected) { document.removeEventListener('pointerdown', away); return; }
      if (!pop.hidden && !pop.contains(e.target) && !bAa.contains(e.target)) closePop();
    };
    document.addEventListener('pointerdown', away);

    // Checklist: danh sách có vòng tròn, bấm vào vòng để tick
    function checklist() {
      focusEd();
      document.execCommand('insertUnorderedList', false);
      const sel = document.getSelection();
      let node = sel && sel.anchorNode;
      while (node && node !== paper && !(node.nodeName === 'UL')) node = node.parentNode;
      if (node && node.nodeName === 'UL') node.classList.toggle('nt-check');
      onInput();
    }
    bChk.addEventListener('click', checklist);

    bTbl.addEventListener('click', () => {
      const cell = '<td><br></td>';
      exec('insertHTML', `<table class="nt-table"><tbody><tr>${cell}${cell}</tr><tr>${cell}${cell}</tr></tbody></table><div><br></div>`);
    });

    paper.addEventListener('click', e => {
      const li = e.target.closest && e.target.closest('ul.nt-check > li');
      if (!li || !paper.contains(li)) return;
      const r = li.getBoundingClientRect();
      if (e.clientX - r.left < 26) {
        li.classList.toggle('done');
        onInput();
      }
    });

    paper.addEventListener('keydown', e => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const map = { b: 'bold', i: 'italic', u: 'underline' };
      const c = map[e.key.toLowerCase()];
      if (c) { e.preventDefault(); exec(c); }
    });

    paper.addEventListener('paste', e => {
      e.preventDefault();
      const txt = (e.clipboardData || window.clipboardData).getData('text/plain');
      document.execCommand('insertText', false, txt);
    });

    paper.addEventListener('input', () => onInput());

    let rt;
    function onInput() {
      const n = byId(curId);
      if (!n || n.deleted) return;
      n.html = paper.innerHTML;
      n.date = Date.now();
      dateEl.textContent = longDate(n.date);
      save();
      clearTimeout(rt);
      rt = setTimeout(() => { renderList(true); renderSide(); }, 350);
    }

    /* --- Sidebar --- */
    function renderSide() {
      side.replaceChildren(h('div', 'win-drag nt-side-drag'));

      const count = f => data.notes.filter(f).length;
      const add = (id, label, ic) => {
        const r = h('div', 'nt-row' + (id === view && !tagF ? ' on' : ''));
        r.setAttribute('role', 'button');
        r.tabIndex = 0;
        r.append(icon(ic), h('span', 'nt-row-t', label), h('span', 'nt-cnt', String(count(viewDef(id).f) || '')));
        const go = () => selectView(id);
        r.addEventListener('click', go);
        r.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); } });
        side.append(r);
      };

      side.append(h('div', 'nt-head', 'iCloud'));
      SMART.forEach(([id, l, ic]) => add(id, l, ic));
      side.append(h('div', 'nt-head gap', 'Folders'));
      data.folders.forEach(([id, l]) => add(id, l, 'folder'));
      add('trash', 'Recently Deleted', 'trash');

      // Tags: lấy từ các từ bắt đầu bằng # trong ghi chú
      const all = new Set();
      data.notes.filter(n => !n.deleted).forEach(n => info(n).tags.forEach(t => all.add(t)));
      const tags = h('div', 'nt-tags');
      if (all.size) {
        tags.append(h('div', 'nt-head', 'Tags'));
        const wrap = h('div', 'nt-chips');
        const chip = (label, val) => {
          const c = h('button', 'nt-chip' + (tagF === val ? ' on' : ''), label);
          c.type = 'button';
          c.addEventListener('click', () => {
            tagF = val;
            pickFirst();
            renderSide();
            renderList();
            loadEditor();
            if (small()) setScreen('list');
          });
          wrap.append(c);
        };
        chip('All Tags', null);
        [...all].sort().forEach(t => chip(t, t));
        tags.append(wrap);
      }
      side.append(tags);

      const nf = h('button', 'nt-newf');
      nf.type = 'button';
      nf.append(icon('plus'), h('span', null, 'New Folder'));
      nf.addEventListener('click', () => {
        const id = 'f' + Date.now().toString(36);
        data.folders.push([id, 'New Folder ' + data.folders.length]);
        save();
        selectView(id);
      });
      side.append(nf);
    }

    /* --- Danh sách ghi chú --- */
    const visible = () => {
      const f = viewDef(view).f;
      const s = q.trim().toLowerCase();
      return data.notes
        .filter(f)
        .filter(n => !tagF || info(n).tags.includes(tagF))
        .filter(n => !s || linesOf(n.html).join(' ').toLowerCase().includes(s))
        .sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || b.date - a.date);
    };

    function renderList(keepScroll) {
      const top = list.scrollTop;
      list.replaceChildren();
      const notes = visible();

      if (!notes.length) {
        list.append(h('p', 'nt-empty', q ? 'No Results' : 'No Notes'));
        return;
      }

      const groups = new Map();
      notes.forEach(n => {
        const g = viewDef(view).icon === 'trash' ? 'Recently Deleted' : groupOf(n);
        if (!groups.has(g)) groups.set(g, []);
        groups.get(g).push(n);
      });

      groups.forEach((ns, g) => {
        const head = h('div', 'nt-gh');
        if (g === 'Pinned') head.append(icon('pin', 'nt-gh-i'));
        head.append(h('span', null, g));
        const box = h('div', 'nt-gbox');
        ns.forEach(n => box.append(noteRow(n)));
        list.append(head, box);
      });

      if (keepScroll) list.scrollTop = top;
    }

    function noteRow(n) {
      const { title, preview } = info(n);
      const r = h('div', 'nt-note' + (n.id === curId ? ' sel' : ''));
      r.setAttribute('role', 'button');
      r.tabIndex = 0;
      r.dataset.id = n.id;

      const t = h('div', 'nt-n-t', title);
      const s = h('div', 'nt-n-s');
      s.append(h('b', null, shortDate(n.date)), h('span', null, preview));
      r.append(t, s);

      if (view === 'all' || tagF || q) {
        const f = h('div', 'nt-n-f');
        const fo = data.folders.find(x => x[0] === n.folder);
        f.append(icon('folder', 'nt-n-fi'), h('span', null, fo ? fo[1] : 'Notes'));
        r.append(f);
      }

      const go = () => openNote(n.id);
      r.addEventListener('click', go);
      r.addEventListener('keydown', e => { if (e.key === 'Enter') go(); });
      return r;
    }

    /* --- Mở ghi chú --- */
    function loadEditor() {
      const n = byId(curId);
      root.classList.toggle('has-note', !!n);
      empty.hidden = !!n;
      scroller.hidden = !n;
      eBar.classList.toggle('off', !n);
      if (!n) { paper.innerHTML = ''; dateEl.textContent = ''; updateHead(); return; }
      paper.innerHTML = n.html;
      paper.contentEditable = n.deleted ? 'false' : 'true';
      dateEl.textContent = longDate(n.date);
      bPin.classList.toggle('on', !!n.pinned);
      scroller.scrollTop = 0;
      updateHead();
    }

    function openNote(id) {
      curId = id;
      list.querySelectorAll('.nt-note').forEach(r => r.classList.toggle('sel', r.dataset.id === id));
      loadEditor();
      if (small()) setScreen('edit');
    }

    const pickFirst = () => {
      const v = visible();
      curId = v.length ? v[0].id : null;
    };

    function selectView(id) {
      view = id;
      tagF = null;
      q = '';
      sInput.value = '';
      closePop();
      if (!small()) pickFirst(); else curId = null;
      renderSide();
      renderList();
      loadEditor();
      if (small()) setScreen('list');
    }

    /* --- Thao tác --- */
    function newNote() {
      let folder = 'notes';
      if (data.folders.some(f => f[0] === view)) folder = view;
      const n = { id: 'n' + Date.now().toString(36), folder, date: Date.now(), html: '<div><br></div>' };
      data.notes.unshift(n);
      if (view === 'trash' || view === 'shared') view = 'all';
      tagF = null;
      q = '';
      sInput.value = '';
      save();
      curId = n.id;
      renderSide();
      renderList();
      loadEditor();
      if (small()) setScreen('edit');
      setTimeout(() => { paper.focus(); }, 30);
    }

    function removeNote() {
      const n = byId(curId);
      if (!n) return;
      const v = visible();
      const i = v.findIndex(x => x.id === n.id);
      if (n.deleted) data.notes = data.notes.filter(x => x !== n);
      else { n.deleted = true; n.pinned = false; }
      save();
      const rest = visible();
      curId = small() ? null : (rest[Math.min(i, rest.length - 1)] || {}).id || null;
      renderSide();
      renderList();
      loadEditor();
      toast(n.deleted ? 'Moved to Recently Deleted' : 'Note deleted');
      if (small()) setScreen('list');
    }

    bNew.addEventListener('click', newNote);
    mFab.addEventListener('click', newNote);
    bDel.addEventListener('click', removeNote);
    mAct.addEventListener('click', removeNote);

    bPin.addEventListener('click', () => {
      const n = byId(curId);
      if (!n || n.deleted) return;
      n.pinned = !n.pinned;
      bPin.classList.toggle('on', n.pinned);
      save();
      renderList(true);
    });

    bShare.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(location.href.split('#')[0] + '#' + (curId || '')); toast('Link copied'); }
      catch { toast('Could not copy link'); }
    });

    sInput.addEventListener('input', () => {
      q = sInput.value;
      renderList();
    });

    /* --- [MOBILE] Điều hướng 3 màn hình --- */
    function updateHead() {
      const n = byId(curId);
      mBack.style.visibility = screen === 'folders' ? 'hidden' : 'visible';
      mAct.style.visibility = screen === 'edit' && n ? 'visible' : 'hidden';
      mTitle.textContent = screen === 'folders' ? VI.folders : (screen === 'list' ? viewDef(view).label : '');
    }

    function setScreen(s) {
      screen = s;
      root.dataset.screen = s;
      updateHead();
    }

    mBack.addEventListener('click', () => {
      if (screen === 'edit') { setScreen('list'); renderList(true); }
      else if (screen === 'list') setScreen('folders');
    });

    const mq = window.matchMedia('(max-width:1100px)');
    const onMq = () => {
      if (!root.isConnected) { mq.removeEventListener('change', onMq); return; }
      if (!small() && !curId) { pickFirst(); renderList(); loadEditor(); }
      setScreen(small() ? 'folders' : 'list');
    };
    mq.addEventListener('change', onMq);

    /* --- Khởi động --- */
    renderSide();
    if (small()) {
      renderList();
      loadEditor();
      setScreen('folders');
    } else {
      pickFirst();
      renderList();
      loadEditor();
      setScreen('list');
    }
  }

  /* ---------- ĐĂNG KÝ APP ---------- */
  (window.WMApps = window.WMApps || {}).notes = {
    title: 'Notes',
    w: 1000,
    h: 640,
    cls: 'is-notes',          // class thêm vào cửa sổ (notes.css dùng để ẩn thanh tiêu đề trên máy tính)
    build
  };
})();