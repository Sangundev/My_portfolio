/* =========================================================
   js/apps/photos.js: app Photos (bố cục giống Finder)
   - Tự đăng ký vào window.WMApps.photos, window-manager.js sẽ gọi build()
   - Máy tính (>1100px): sidebar + thanh công cụ (Back/Forward, Zoom, Share, More, Search)
     bấm = chọn, bấm đúp = mở (album -> đi vào trong, ảnh -> xem ảnh)
   - Điện thoại / tablet (≤1100px): giống app Tệp trên iPhone
     (header tròn, ô tìm kiếm, lưới album, thanh tab Thư viện / Album / Yêu thích), chạm = mở
   - Xem ảnh: ảnh bay ra từ chính ô vừa bấm; ←/→ đổi ảnh, Esc đóng, vuốt ngang / vuốt xuống trên cảm ứng
   - CSS đi kèm: css/apps/photos.css
   - Ảnh đặt ở assets/photos/<folder>/1.jpg, 2.jpg, ... (thiếu ảnh vẫn hiện gradient, không lỗi)
========================================================= */
(() => {
  /* ---------- DỮ LIỆU (sửa ở đây) ---------- */
  const BASE = "assets/Photos";
  const EXT = 'jpg';
  const EXTS = ['jpg', 'jpeg', 'png', 'webp'];        // các đuôi sẽ thử lần lượt
  const ALBUMS = [
    { id: 'travel', name: 'Travel', folder: 'travels', hue: 160 },
     { id: 'family', name: 'Family',      folder: 'family', hue: 30  },
    { id: 'food',   name: 'Food',        folder: 'food',   hue: 48  }
  ];

  // Các mục ghim ở sidebar, mỗi mục một thư mục riêng
  const SETS = {
    favorites: { name: "Favorites", folder: "favorites", hue: 340 },
    videos: { name: "Videos", folder: "videos", hue: 280 },
    people: { name: "People & Pets", folder: "people-pets", hue: 200 },
    shared: { name: "Shared Albums", folder: "shared", hue: 120 },
  };

  const ALL = [];
  const BY = {}; // id -> ảnh
  const MAX = 200; // chặn trên cho an toàn

  const makePhoto = (key, g, n, ext = EXT) => {
    const p = {
      id: `${key}-${n}`, album: g, title: `${g.name} ${n}`,
      src: `${BASE}/${g.folder}/${n}.${ext}`, hue: (g.hue + n * 11) % 360
    };
    BY[p.id] = p;
    return p;
  };

  const exists = (src) =>
    new Promise((res) => {
      const im = new Image();
      im.onload = () => res(true);
      im.onerror = () => res(false);
      im.src = src;
    });

  /* Gọi 1.jpg, 2.jpg, ... cho đến khi gặp ảnh không có thì dừng */
  async function load(key, g) {
    g.photos = [];
    for (let n = 1; n <= MAX; n++) {
      let found = null;
      for (const ext of EXTS) {                                  // thử từng đuôi cho ảnh số n
        const src = `${BASE}/${g.folder}/${n}.${ext}`;
        if (await exists(src)) { found = makePhoto(key, g, n, ext); break; }
      }
      if (!found) break;                                         // không có đuôi nào -> hết ảnh
      g.photos.push(found);
    }
    if (!g.photos.length) g.photos.push(makePhoto(key, g, 1));   // thư mục trống: giữ 1 ô gradient
  }

  const GROUPS = [...ALBUMS.map((a) => [a.id, a]), ...Object.entries(SETS)];
  let ready = null; // chỉ quét một lần dù mở app nhiều lần
  ALBUMS.forEach((a) => {
    a.photos = Array.from({ length: a.count }, (_, i) => {
      const p = {
        id: `${a.id}-${i + 1}`,
        album: a,
        title: `${a.name} ${i + 1}`,
        src: `${BASE}/${a.folder}/${i + 1}.${EXT}`,
        hue: (a.hue + i * 11) % 360,
      };
      ALL.push(p);
      BY[p.id] = p;
      return p;
    });
  });

  const AZ = [130, 160, 200, 250, 320]; // cột tối thiểu của lưới album theo mức zoom
  const PZ = [70, 95, 130, 180, 240]; // cột tối thiểu của lưới ảnh theo mức zoom
  const SLIDE_MS = 3000;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Chữ tiếng Việt cho giao diện điện thoại / tablet
  const VI = { search: "Tìm kiếm", back: "Quay lại", more: "Thêm" };
  const VI_TITLE = {
    library: "Thư viện",
    collections: "Album",
    albums: "Album",
    favorites: "Yêu thích",
    videos: "Video",
    people: "Người & Thú cưng",
    shared: "Album chia sẻ",
  };
  // icon, tiêu đề (EN), tiêu đề (VI), mô tả (EN), mô tả (VI)
  const EMPTY = {
    favorites: [
      "heart",
      "No Favorites",
      "Chưa có mục yêu thích",
      "Tap the heart on a photo to add it here.",
      "Chạm trái tim trên ảnh để thêm vào đây.",
    ],
    videos: [
      "video",
      "No Videos",
      "Chưa có video",
      "Videos you add will appear here.",
      "Video bạn thêm sẽ hiện ở đây.",
    ],
    people: [
      "person",
      "No People or Pets",
      "Chưa có người hoặc thú cưng",
      "Photos of people and pets will appear here.",
      "Ảnh người và thú cưng sẽ hiện ở đây.",
    ],
    shared: [
      "collections",
      "No Shared Albums",
      "Chưa có album chia sẻ",
      "Shared albums will appear here.",
      "Album chia sẻ sẽ hiện ở đây.",
    ],
  };
  // [id, tên hiển thị, icon]
  const PINNED = [
    ["favorites", "Favorites", "heart"],
    ["videos", "Videos", "video"],
    ["people", "People & Pets", "person"],
  ];
  const SIDE = [
    {
      rows: [
        ["library", "Library", "photo"],
        ["collections", "Collections", "collections"],
      ],
    },
    { head: "Pinned", rows: PINNED },
    {
      head: "Albums",
      rows: [
        ["albums", "All Albums", "album"],
        ...ALBUMS.map((a) => ["album:" + a.id, a.name, null, a]),
      ],
    },
    { head: "Sharing", rows: [["shared", "Shared Albums", "person"]] },
  ];

  /* ---------- ICON (SVG, kiểu nét như Finder) ---------- */
  const svg = (p) => `<svg viewBox="0 0 24 24" aria-hidden="true">${p}</svg>`;
  const I = {
    photo: svg(
      '<rect x="3.5" y="4.5" width="17" height="15" rx="3"/><circle cx="9" cy="10" r="1.5"/><path d="M4.5 17.5l4.5-4.5 3.5 3.5 2.5-2.5 4.5 4.5"/>',
    ),
    collections: svg(
      '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M4 12h16M12 4v16"/>',
    ),
    album: svg(
      '<rect x="4" y="6" width="16" height="13" rx="3"/><path d="M7 3.5h10"/>',
    ),
    heart: svg(
      '<path d="M12 19.5s-7-4.3-7-9.7A4 4 0 0112 7.3a4 4 0 017 2.5c0 5.4-7 9.7-7 9.7z"/>',
    ),
    clock: svg('<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>'),
    map: svg(
      '<path d="M12 20.5s-6-5.2-6-9.7a6 6 0 0112 0c0 4.5-6 9.7-6 9.7z"/><circle cx="12" cy="10.8" r="2.2"/>',
    ),
    video: svg(
      '<rect x="3.5" y="6.5" width="12.5" height="11" rx="2.6"/><path d="M16 11.2l4.5-2.7v7l-4.5-2.7z"/>',
    ),
    shot: svg(
      '<path d="M8 4H5.5A1.5 1.5 0 004 5.5V8M16 4h2.5A1.5 1.5 0 0120 5.5V8M8 20H5.5A1.5 1.5 0 014 18.5V16M16 20h2.5a1.5 1.5 0 001.5-1.5V16"/>',
    ),
    person: svg(
      '<circle cx="12" cy="9" r="3.5"/><path d="M5 19.5c1-3.8 4-5.2 7-5.2s6 1.4 7 5.2"/>',
    ),
    trash: svg('<path d="M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12"/>'),
    left: svg('<path d="M14.5 6l-6 6 6 6"/>'),
    right: svg('<path d="M9.5 6l6 6-6 6"/>'),
    minus: svg('<path d="M6.5 12h11"/>'),
    grid: svg(
      '<rect x="4.5" y="4.5" width="6" height="6" rx="1.2"/><rect x="13.5" y="4.5" width="6" height="6" rx="1.2"/><rect x="4.5" y="13.5" width="6" height="6" rx="1.2"/><rect x="13.5" y="13.5" width="6" height="6" rx="1.2"/>',
    ),
    cube: svg(
      '<path d="M12 3.5l7.5 4.2v8.6L12 20.5l-7.5-4.2V7.7z"/><path d="M4.5 7.7L12 12l7.5-4.3M12 12v8.5"/>',
    ),
    plus: svg('<path d="M6.5 12h11M12 6.5v11"/>'),
    share: svg(
      '<path d="M12 4v10M8.5 7.5L12 4l3.5 3.5M7 11H6a1 1 0 00-1 1v7a1 1 0 001 1h12a1 1 0 001-1v-7a1 1 0 00-1-1h-1"/>',
    ),
    more: svg('<path d="M6 12h.01M12 12h.01M18 12h.01" stroke-width="3.2"/>'),
    search: svg(
      '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l4.5 4.5"/>',
    ),
    mic: svg(
      '<rect x="9" y="3.5" width="6" height="10.5" rx="3" fill="currentColor"/><path d="M5.5 11.5a6.5 6.5 0 0013 0M12 18v2.5"/>',
    ),
  };

  /* ---------- Yêu thích (lưu localStorage, có try/catch) ---------- */
  const FKEY = "ph-fav";
  const favs = new Set();
  try {
    JSON.parse(localStorage.getItem(FKEY) || "[]").forEach((x) => favs.add(x));
  } catch {}
  const saveFavs = () => {
    try {
      localStorage.setItem(FKEY, JSON.stringify([...favs]));
    } catch {}
  };

  /* ---------- HÀM PHỤ ---------- */
  const h = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  const btn = (label, icon, cls) => {
    const b = h("button", "ph-btn" + (cls ? " " + cls : ""));
    b.type = "button";
    b.setAttribute("aria-label", label);
    b.innerHTML = icon;
    return b;
  };

  const pill = (...kids) => {
    const p = h("div", "ph-pill");
    p.append(...kids);
    return p;
  };

  /* Tô ô bằng ảnh (fade-in khi tải xong), thiếu ảnh thì giữ gradient */
  const paint = (el, p) => {
    el.classList.add("ph-g");
    el.style.setProperty("--hue", p.hue);
    const im = new Image();
    im.alt = "";
    im.decoding = "async";
    im.loading = "lazy";
    im.draggable = false;
    im.addEventListener("load", () => el.classList.add("ld"));
    im.addEventListener("error", () => im.remove());
    im.src = p.src;
    el.append(im);
    return el;
  };

  /* ---------- BUILD ---------- */
  function build(body, _title, api) {
    const { isMobile } = api;
    body.classList.add("flush", "ph-body");

    const small = () => window.matchMedia("(max-width:1100px)").matches;
    const T = (en, vi) => (small() ? vi : en);

    const root = h("div", "ph");
    root.tabIndex = -1;
    const side = h("nav", "ph-side");
    side.setAttribute("aria-label", "Sidebar");
    side.append(h("div", "win-drag ph-side-drag"));

    const main = h("div", "ph-main");
    const bar = h("div", "ph-bar win-drag");
    const canvas = h("div", "ph-canvas");

    let cur = "collections";
    let hist = ["collections"];
    let hi = 0;
    let zoom = 2;
    let vmode = "3d"; // grid | 3d
    let cf = null; // trạng thái dạng 3D (coverflow)
    let sort = "none"; // none | az | za
    let sel = null; // key đang chọn (id ảnh hoặc 'album:xxx')
    let total = 0; // số mục của màn hình hiện tại (trước khi lọc tìm kiếm)
    let kindNow = "albums";
    let L = null,
      lbTimer = 0,
      slideTimer = 0; // trạng thái xem ảnh
    const entries = {};
    const rows = {};
    const tileMap = new Map(); // id ảnh -> ô đang hiển thị

    /* --- Sidebar --- */
    SIDE.forEach((g, gi) => {
      if (g.head)
        side.append(h("div", "ph-head" + (gi > 1 ? " gap" : ""), g.head));
      g.rows.forEach(([id, label, icon, album]) => {
        entries[id] = { label };
        const row = h("div", "ph-row");
        row.setAttribute("role", "button");
        row.tabIndex = 0;
        const ic = h("span", album ? "ph-sth" : "ph-ico");
        if (album) paint(ic, album.photos[0]);
        else ic.innerHTML = I[icon];
        row.append(ic, h("span", null, label));
        row.addEventListener("click", () => show(id, true));
        rows[id] = row;
        side.append(row);
      });
    });

    /* --- Thanh công cụ --- */
    const back = btn("Back", I.left);
    const fwd = btn("Forward", I.right);
    const nav = pill(back, h("i", "ph-div"), fwd);

    const title = h("div", "ph-title");
    const tText = h("span", "ph-tt");
    const tCount = h("small");
    title.append(tText, tCount);

    const zOut = btn("Zoom out", I.minus);
    const zIn = btn("Zoom in", I.plus);
    const zoomPill = pill(zOut, h("i", "ph-div"), zIn);

    const vGrid = btn('Grid view', I.grid);
    const v3d = btn('3D view', I.cube, 'on');
    const viewPill = pill(vGrid, v3d);
    const setView = (m) => {
      if (vmode === m) return;
      vmode = m;
      vGrid.classList.toggle("on", m === "grid");
      v3d.classList.toggle("on", m === "3d");
      render();
    };
    vGrid.addEventListener("click", () => setView("grid"));
    v3d.addEventListener("click", () => setView("3d"));

    const shBtn = btn("Share", I.share);
    const moBtn = btn("More", I.more);
    const actPill = pill(shBtn, moBtn);

    const search = h("label", "ph-pill ph-search");
    const sIco = h("span", "ph-sico");
    sIco.innerHTML = I.search;
    const input = h("input");
    input.type = "search";
    input.placeholder = "Search";
    input.setAttribute("aria-label", "Search");
    input.autocomplete = "off";
    input.spellcheck = false;
    search.append(sIco, input);

    bar.append(
      nav,
      title,
      h("div", "ph-sp"),
      viewPill,
      zoomPill,
      actPill,
      search,
    );

    /* --- Header + ô tìm kiếm + thanh tab (chỉ hiện ở ≤1100px) --- */
    const mBack = h("button", "pm-circle");
    mBack.type = "button";
    mBack.setAttribute("aria-label", VI.back);
    mBack.innerHTML = I.left;
    mBack.addEventListener("click", () => back.click());

    const mMore = h("button", "pm-circle");
    mMore.type = "button";
    mMore.setAttribute("aria-label", VI.more);
    mMore.innerHTML = I.more;

    const mTitle = h("div", "pm-title");
    const mHead = h("div", "pm-head");
    mHead.append(mBack, mTitle, mMore);

    const mSearch = h("label", "pm-search");
    const msIco = h("span", "ph-sico");
    msIco.innerHTML = I.search;
    const mInput = h("input");
    mInput.type = "search";
    mInput.placeholder = VI.search;
    mInput.setAttribute("aria-label", VI.search);
    mInput.autocomplete = "off";
    mInput.spellcheck = false;
    const mic = h("span", "pm-mic");
    mic.setAttribute("aria-hidden", "true");
    mic.innerHTML = I.mic;
    mSearch.append(msIco, mInput, mic);

    const TABS = [
      ["library", "Thư viện", I.photo],
      ["collections", "Album", I.collections],
      ["favorites", "Yêu thích", I.heart],
    ];
    const mTabs = h("nav", "pm-tabs");
    mTabs.setAttribute("aria-label", "Tabs");
    const tabBtns = TABS.map(([id, label, ic]) => {
      const b = h("button", "pm-tab");
      b.type = "button";
      b.innerHTML = ic;
      b.append(h("span", null, label));
      b.addEventListener("click", () => show(id, true));
      return [id, b];
    });
    mTabs.append(...tabBtns.map((t) => t[1]));

    const paintTabs = (id) => {
      const t = id === "library" || id === "favorites" ? id : "collections";
      tabBtns.forEach(([tid, b]) => b.classList.toggle("on", tid === t));
    };

    main.append(bar, mHead, mSearch, canvas, mTabs);
    root.append(side, main);
    body.append(root);

    /* --- Popover menu + toast --- */
    const pop = h("div", "ph-pop");
    pop.hidden = true;
    pop.setAttribute("role", "menu");
    root.append(pop);
    let popFor = null;
    const closePop = () => {
      pop.hidden = true;
      popFor = null;
    };

    function menu(anchor, list) {
      if (popFor === anchor && !pop.hidden) {
        closePop();
        return;
      }
      pop.replaceChildren();
      list.forEach((m) => {
        if (m.sep) {
          pop.append(h("div", "ph-sep"));
          return;
        }
        if (m.head) {
          pop.append(h("div", "ph-mhead", m.head));
          return;
        }
        const r = h("button", "ph-mi");
        r.type = "button";
        r.disabled = !!m.off;
        r.append(h("span", "ph-ck", m.on ? "✓" : ""), h("span", null, m.label));
        r.addEventListener("click", () => {
          closePop();
          if (m.run) m.run();
        });
        pop.append(r);
      });
      pop.hidden = false;
      popFor = anchor;
      const rr = root.getBoundingClientRect();
      const ar = anchor.getBoundingClientRect();
      pop.style.left =
        Math.max(
          8,
          Math.min(ar.left - rr.left, rr.width - pop.offsetWidth - 8),
        ) + "px";
      pop.style.top = ar.bottom - rr.top + 8 + "px";
    }

    const away = (e) => {
      if (!root.isConnected) {
        document.removeEventListener("pointerdown", away);
        return;
      }
      if (
        !pop.hidden &&
        !pop.contains(e.target) &&
        !(popFor && popFor.contains(e.target))
      )
        closePop();
    };
    document.addEventListener("pointerdown", away);

    const toastEl = h("div", "ph-toast");
    toastEl.hidden = true;
    root.append(toastEl);
    let tt;
    const toast = (m) => {
      toastEl.textContent = m;
      toastEl.hidden = false;
      clearTimeout(tt);
      tt = setTimeout(() => {
        toastEl.hidden = true;
      }, 1600);
    };

    /* --- Điều hướng (back / forward) --- */
    const sync = () => {
      back.disabled = hi <= 0;
      fwd.disabled = hi >= hist.length - 1;
      mBack.disabled = back.disabled;
    };
    back.addEventListener("click", () => {
      if (hi > 0) {
        hi--;
        show(hist[hi], false);
      }
    });
    fwd.addEventListener("click", () => {
      if (hi < hist.length - 1) {
        hi++;
        show(hist[hi], false);
      }
    });

    /* --- Zoom: chỉ đổi biến CSS nên rất mượt, không vẽ lại --- */
    const applyZoom = () => {
      canvas.style.setProperty(
        "--min",
        (kindNow === "albums" ? AZ : PZ)[zoom] + "px",
      );
      zoomPill.hidden = vmode === "3d"; // dạng 3D không dùng zoom
      zOut.disabled = zoom === 0;
      zIn.disabled = zoom === 4;
    };
    zOut.addEventListener("click", () => {
      zoom = Math.max(0, zoom - 1);
      applyZoom();
    });
    zIn.addEventListener("click", () => {
      zoom = Math.min(4, zoom + 1);
      applyZoom();
    });

    /* --- Dữ liệu từng màn hình --- */
    function data(id) {
      if (id === "collections" || id === "albums")
        return { kind: "albums", list: ALBUMS };
      if (id === "library") return { kind: "photos", list: ALL };
      if (id === "favorites")
        return {
          kind: "photos",
          list: [
            ...SETS.favorites.photos,
            ...ALL.filter((p) => favs.has(p.id)),
          ],
        };
      if (SETS[id]) return { kind: "photos", list: SETS[id].photos };
      if (id.startsWith("album:")) {
        const a = ALBUMS.find((x) => "album:" + x.id === id);
        return { kind: "photos", list: a.photos };
      }
      return { kind: "empty", list: [] };
    }

    const nameOf = (it) => it.name || it.title;
    const sorted = (list) => {
      const arr = list.slice();
      if (sort === "az")
        arr.sort((a, b) =>
          nameOf(a).localeCompare(nameOf(b), undefined, { numeric: true }),
        );
      if (sort === "za")
        arr.sort((a, b) =>
          nameOf(b).localeCompare(nameOf(a), undefined, { numeric: true }),
        );
      return arr;
    };

    const countText = (kind, n) =>
      kind === "albums"
        ? `${n} ${T(n === 1 ? "Album" : "Albums", "album")}`
        : `${n} ${T(n === 1 ? "Photo" : "Photos", "ảnh")}`;

    const emptyV = (icon, t, s) => {
      const e = h("div", "ph-empty");
      e.innerHTML = I[icon];
      e.append(h("strong", null, t));
      if (s) e.append(h("span", null, s));
      return e;
    };

    const nores = emptyV("search", "No Results", "Try a different search.");
    nores.hidden = true;
    const footB = h("b");
    const foot = h("div", "ph-foot");
    foot.append(footB);

    /* --- Lọc theo ô tìm kiếm (máy tính dùng ô trên thanh, điện thoại dùng ô riêng) --- */
    const filter = () => {
      const q = (small() ? mInput : input).value.trim().toLowerCase();
      let n = 0;
      canvas.querySelectorAll("[data-key]").forEach((it) => {
        const hide = !!q && !it.dataset.name.includes(q);
        it.hidden = hide;
        if (!hide) n++;
      });
      nores.hidden = !(q && total && !n);
      cfSync(); // dạng 3D: xếp lại theo các ảnh còn hiện
      const txt = total ? countText(kindNow, n) : "";
      tCount.textContent = txt;
      footB.textContent = txt;
    };
    input.addEventListener("input", filter);
    mInput.addEventListener("input", filter);

    /* --- Chọn ô --- */
    const paintSel = () => {
      canvas
        .querySelectorAll("[data-key]")
        .forEach((n) => n.classList.toggle("sel", n.dataset.key === sel));
    };
    const setSel = (k) => {
      sel = k;
      paintSel();
    };
    canvas.addEventListener("click", () => setSel(null));

    function wire(el, key, name, act) {
      el.setAttribute("role", "button");
      el.tabIndex = 0;
      el.dataset.key = key;
      el.dataset.name = name.toLowerCase();
      el.addEventListener("click", (e) => {
        e.stopPropagation();
        if (small() || isMobile() || e.detail === 0 || vmode === "3d")
          act(); // cảm ứng / phím Enter / dạng 3D: mở luôn
        else setSel(key); // chuột: bấm = chọn
      });
      el.addEventListener("dblclick", (e) => {
        e.stopPropagation();
        if (vmode !== "3d") act(); // dạng 3D: click đã mở rồi
      });
      return el;
    }

    const albumTile = (a, i) => {
      const t = wire(h("div", "ph-al"), "album:" + a.id, a.name, () =>
        show("album:" + a.id, true),
      );
      t.style.setProperty("--i", Math.min(i, 18));
      t.setAttribute("aria-label", a.name);
      paint(t, a.photos[0]);
      t.append(h("span", "ph-all", a.name));
      return t;
    };

    const photoTile = (p, i) => {
      const t = wire(
        h("div", "ph-ph"),
        p.id,
        p.title + " " + p.album.name,
        () => {
          const vis = [...canvas.querySelectorAll(".ph-ph")]
            .filter((n) => !n.hidden)
            .map((n) => BY[n.dataset.key]);
          openLB(vis, Math.max(0, vis.indexOf(p)), t);
        },
      );
      t.style.setProperty("--i", Math.min(i, 24));
      t.setAttribute("aria-label", p.title);
      t.classList.toggle("fav", favs.has(p.id));
      paint(t, p);
      const hr = h("span", "hrt");
      hr.innerHTML = I.heart;
      t.append(hr);
      tileMap.set(p.id, t);
      return t;
    };

    /* --- Vẽ nội dung --- */
    function render() {
      stopCF();
      tileMap.clear();
      canvas.replaceChildren();
      const d = data(cur);
      kindNow = d.kind;
      canvas.className = "ph-canvas k-" + d.kind;
      applyZoom();

      if (d.kind === "empty" || !d.list.length) {
        total = 0;
        const e = EMPTY[d.kind === "empty" ? cur : "favorites"] || EMPTY.shared;
        canvas.append(emptyV(e[0], T(e[1], e[2]), T(e[3], e[4])));
        filter();
        return;
      }

      const list = sorted(d.list);
      total = list.length;

      if (vmode === "3d") {
        canvas.classList.add("v-3d");
        buildCF(d.kind, list);
        canvas.append(nores);
        paintSel();
        filter();
        return;
      }

      const grid = h("div", "ph-grid " + d.kind);
      list.forEach((it, i) =>
        grid.append(d.kind === "albums" ? albumTile(it, i) : photoTile(it, i)),
      );
      canvas.append(grid, nores, foot);

      if (!reduce) {
        canvas.classList.remove("ph-in");
        void canvas.offsetWidth;
        canvas.classList.add("ph-in");
      }
      paintSel();
      filter();
    }

    function show(id, push) {
      if (!entries[id] && !id.startsWith("album:")) return;
      if (push) {
        if (id === cur) return;
        hist = hist.slice(0, hi + 1);
        hist.push(id);
        hi = hist.length - 1;
      }
      cur = id;
      sel = null;
      closePop();
      input.value = "";
      mInput.value = "";
      canvas.scrollTop = 0;
      Object.entries(rows).forEach(([k, r]) =>
        r.classList.toggle("on", k === id),
      );
      const label = entries[id].label;
      tText.textContent = label;
      mTitle.textContent = VI_TITLE[id] || label;
      paintTabs(id);
      render();
      sync();
    }

    /* =====================================================
       XEM ẢNH (lightbox)
    ===================================================== */
    const lb = h("div", "ph-lb");
    lb.hidden = true;
    const lbBg = h("div", "ph-lb-bg");
    const frame = h("div", "ph-lb-frame ph-g");
    const big = new Image();
    big.alt = "";
    big.draggable = false;
    big.decoding = "async";
    frame.append(big);
    big.addEventListener("load", () => frame.classList.add("ld"));
    big.addEventListener("error", () => {
      big.hidden = true;
    });

    const lbClose = btn("Back", I.left);
    const favB = btn("Favorite", I.heart, "ph-fav");
    const lbTop = h("div", "ph-lb-top win-drag");
    const lbMid = h("div", "ph-lb-mid");
    const lbTitle = h("strong");
    const lbCount = h("small");
    lbMid.append(lbTitle, lbCount);
    lbTop.append(pill(lbClose), lbMid, pill(favB));

    const prevB = btn("Previous photo", I.left, "ph-nav prev");
    const nextB = btn("Next photo", I.right, "ph-nav next");
    lb.append(lbBg, frame, lbTop, prevB, nextB);
    root.append(lb);

    const stopSlide = () => {
      clearInterval(slideTimer);
      slideTimer = 0;
    };

    function showPhoto(dir) {
      const p = L.list[L.i];
      frame.style.setProperty("--hue", p.hue);
      frame.classList.remove("ld");
      big.hidden = false;
      big.src = p.src;
      lbTitle.textContent = p.title;
      lbCount.textContent =
        `${L.i + 1} / ${L.list.length}` +
        (slideTimer ? " · " + T("Slideshow", "Trình chiếu") : "");
      const on = favs.has(p.id);
      favB.classList.toggle("on", on);
      favB.setAttribute("aria-pressed", String(on));
      prevB.hidden = L.i === 0;
      nextB.hidden = L.i === L.list.length - 1;
      if (dir && !reduce && frame.animate) {
        frame.animate(
          [
            { opacity: 0, transform: `translateX(${dir * 36}px)` },
            { opacity: 1, transform: "none" },
          ],
          { duration: 300, easing: "cubic-bezier(.22,.8,.24,1)" },
        );
      }
      const nx = L.list[L.i + (dir || 1)]; // nạp trước ảnh kế tiếp
      if (nx) new Image().src = nx.src;
    }

    /* Vị trí ô ảnh <-> khung xem: scale đều (không méo ảnh), căn theo tâm */
    const flip = (tile) => {
      const fr = frame.getBoundingClientRect(),
        tr = tile.getBoundingClientRect();
      const s = Math.min(tr.width / fr.width, tr.height / fr.height);
      const dx = tr.left + tr.width / 2 - (fr.left + fr.width / 2);
      const dy = tr.top + tr.height / 2 - (fr.top + fr.height / 2);
      return `translate(${dx}px, ${dy}px) scale(${s})`;
    };

    function openLB(list, i, tile) {
      if (!list.length) return;
      clearTimeout(lbTimer);
      closePop();
      L = { list, i };
      lb.hidden = false;
      root.classList.add("lb-on");
      lb.classList.remove("on");
      frame.style.transition = "none";
      frame.style.opacity = "";
      frame.style.transform = "";
      showPhoto(0);
      if (tile && !reduce) {
        frame.style.transform = flip(tile);
        void frame.offsetWidth;
      }
      requestAnimationFrame(() => {
        lb.classList.add("on");
        frame.style.transition = reduce
          ? "none"
          : "transform .46s var(--ph-ease)";
        frame.style.transform = "";
      });
      root.focus({ preventScroll: true });
    }

    function closeLB() {
      if (!L) return;
      stopSlide();
      const p = L.list[L.i],
        tile = tileMap.get(p.id);
      L = null;
      lb.classList.remove("on");
      if (tile && tile.isConnected && !tile.hidden && !reduce) {
        frame.style.transition = "transform .4s var(--ph-ease)";
        frame.style.transform = flip(tile);
      } else {
        frame.style.transition = reduce
          ? "none"
          : "opacity .25s ease, transform .25s ease";
        frame.style.opacity = "0";
        frame.style.transform = "scale(.96)";
      }
      lbTimer = setTimeout(
        () => {
          lb.hidden = true;
          root.classList.remove("lb-on");
          frame.style.transition =
            frame.style.transform =
            frame.style.opacity =
              "";
          if (cur === "favorites") render(); // đồng bộ khi bỏ tim trong mục Favorites
        },
        reduce ? 0 : 420,
      );
    }

    function step(d, auto) {
      if (!L) return;
      if (!auto) stopSlide();
      let n = L.i + d;
      if (auto && n >= L.list.length) n = 0; // trình chiếu: hết ảnh thì quay lại đầu
      if (n < 0 || n >= L.list.length) return;
      L.i = n;
      showPhoto(d);
    }

    function slideshow() {
      const vis = [...canvas.querySelectorAll(".ph-ph, .ph-cf-item")]
        .filter((n) => !n.hidden && BY[n.dataset.key])
        .map((n) => BY[n.dataset.key]);
      if (!vis.length) return;
      openLB(vis, 0, null);
      stopSlide();
      slideTimer = setInterval(() => step(1, true), SLIDE_MS);
      showPhoto(0);
    }

    favB.addEventListener("click", () => {
      if (!L) return;
      const p = L.list[L.i];
      if (favs.has(p.id)) favs.delete(p.id);
      else favs.add(p.id);
      saveFavs();
      const on = favs.has(p.id);
      favB.classList.toggle("on", on);
      favB.setAttribute("aria-pressed", String(on));
      tileMap.get(p.id)?.classList.toggle("fav", on);
    });
    lbClose.addEventListener("click", closeLB);
    lbBg.addEventListener("click", closeLB);
    prevB.addEventListener("click", () => step(-1));
    nextB.addEventListener("click", () => step(1));

    /* Vuốt ngang = đổi ảnh, vuốt xuống = đóng */
    let sw = null;
    frame.addEventListener("pointerdown", (e) => {
      sw = { x: e.clientX, y: e.clientY };
    });
    frame.addEventListener("pointercancel", () => {
      sw = null;
    });
    frame.addEventListener("pointerup", (e) => {
      if (!sw) return;
      const dx = e.clientX - sw.x,
        dy = e.clientY - sw.y;
      sw = null;
      if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy))
        step(dx < 0 ? 1 : -1);
      else if (dy > 90 && Math.abs(dy) > Math.abs(dx)) closeLB();
    });

    root.addEventListener("keydown", (e) => {
      if (!L) {
        if (e.key === "Escape") closePop();
        else if (
          cf &&
          (e.key === "ArrowLeft" || e.key === "ArrowRight") &&
          e.target.tagName !== "INPUT"
        ) {
          e.preventDefault(); // dạng 3D: ← → lướt ảnh
          cf.target = cfSnap(cf.target + (e.key === "ArrowRight" ? 1 : -1));
          cfKick();
        }
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeLB();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        step(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        step(-1);
      }
    });

    /* =====================================================
       DẠNG 3D (coverflow): ảnh xoay quanh điểm giữa như ảnh mẫu
       - Điểm giữa nằm GIỮA hai ảnh: hai ảnh sát tâm gần như quay nghiêng 72°, càng xa càng thẳng dần
       - Kéo ngang (chuột / cảm ứng), lăn chuột / trackpad, phím ← → đều được; thả tay thì lò xo trượt về vị trí gần nhất
       - Mọi thứ vẽ bằng transform, mỗi khung hình chỉ cập nhật ~12 ảnh gần tâm
    ===================================================== */
    const CF_ANGLE = 72; // góc xoay lớn nhất (độ)

    function cfRange(n) {
      return n > 1 ? [0.5, n - 1.5] : [0, 0];
    }

    function cfSnap(v) {
      const [lo, hi] = cfRange(cf.vis.length);
      return Math.max(lo, Math.min(hi, Math.round(v - 0.5) + 0.5));
    }

    // 0 ở tâm -> 1 ở ±0.5 (nghiêng hẳn) -> giảm dần khi ra xa
    function cfCurve(a) {
      return a < 0.5
        ? Math.sin(((a / 0.5) * Math.PI) / 2)
        : 0.16 + 0.84 * Math.exp(-(a - 0.5) * 1.4);
    }

    function cfDraw() {
      const c = cf;
      if (!c) return;
      c.vis.forEach((it, i) => {
        const d = i - c.pos,
          a = Math.abs(d);
        if (a > 5.5) {
          it.style.visibility = "hidden";
          return;
        }
        const ang = -Math.sign(d) * CF_ANGLE * cfCurve(a);
        it.style.visibility = "";
        it.style.opacity =
          a > 3.5 ? String(Math.max(0, 1 - (a - 3.5) / 2)) : "1";
        it.style.transform = `translate3d(${(d * c.S).toFixed(1)}px, 0, ${(-Math.min(a, 4) * 34).toFixed(1)}px) rotateY(${ang.toFixed(2)}deg)`;
      });
      const k = Math.max(0, Math.min(c.vis.length - 1, Math.round(c.pos)));
      if (k !== c.k) {
        c.k = k;
        const it = c.vis[k];
        c.cap.textContent = it
          ? `${it.dataset.label} · ${k + 1} / ${c.vis.length}`
          : "";
      }
    }

    function cfResize() {
      const c = cf;
      if (!c) return;
      const rw = c.root.clientWidth,
        rh = c.root.clientHeight;
      let H = Math.max(170, Math.min(440, rh * 0.62)),
        W = H * 0.82;
      if (W > rw * 0.6) {
        W = rw * 0.6;
        H = W / 0.82;
      }
      c.S = Math.max(60, Math.min(W * 0.72, rw / 5.2));
      c.root.style.setProperty("--cw", W.toFixed(1) + "px");
      c.root.style.setProperty("--ch", H.toFixed(1) + "px");
      cfDraw();
    }

    function cfTick(now) {
      const c = cf;
      if (!c) return;
      const dt = Math.min(40, c.last ? now - c.last : 16);
      c.last = now;
      let busy = c.drag;
      if (!c.drag) {
        // lò xo về vị trí đích
        const dp = c.target - c.pos;
        if (Math.abs(dp) > 0.0005) {
          c.pos += dp * (1 - Math.exp(-dt / 110));
          busy = true;
        } else c.pos = c.target;
      }
      cfDraw();
      c.raf = busy ? requestAnimationFrame(cfTick) : 0;
      if (!busy) c.last = 0;
    }

    function cfKick() {
      if (cf && !cf.raf) cf.raf = requestAnimationFrame(cfTick);
    }

    /* Cập nhật danh sách ảnh đang hiện (sau khi tìm kiếm) */
    function cfSync() {
      const c = cf;
      if (!c) return;
      c.vis = c.items.filter((it) => !it.hidden);
      c.k = -1;
      if (c.n !== c.vis.length) {
        const first = c.n < 0;
        c.n = c.vis.length;
        c.target = c.pos = cfSnap(Math.floor((c.n - 1) / 2) + 0.5);
        if (first && !reduce && c.n > 1) {
          c.pos = c.target + 1.8;
          cfKick();
        } // lúc mở: ảnh quét vào từ bên phải
      } else {
        c.target = cfSnap(c.target);
      }
      cfDraw();
    }

    function stopCF() {
      if (!cf) return;
      cancelAnimationFrame(cf.raf);
      clearTimeout(cf.wt);
      cf.ro.disconnect();
      cf = null;
    }

    function buildCF(kind, list) {
      const isAlbum = kind === "albums";
      const root3 = h("div", "ph-cf");
      const stage = h("div", "ph-cf-stage");
      const cap = h("div", "ph-cf-cap");
      root3.append(stage, cap);

      const items = list.map((it) => {
        const key = isAlbum ? "album:" + it.id : it.id;
        const name = isAlbum ? it.name : it.title;
        const el = wire(
          h("div", "ph-cf-item"),
          key,
          isAlbum ? name : it.title + " " + it.album.name,
          () => {
            if (cf && cf.moved) return; // vừa kéo xong thì không tính là click
            if (isAlbum) show(key, true);
            else {
              const v = cf.vis.map((e) => BY[e.dataset.key]);
              openLB(v, Math.max(0, v.indexOf(it)), el);
            }
          },
        );
        el.dataset.label = name;
        el.setAttribute("aria-label", name);
        paint(el, isAlbum ? it.photos[0] : it);
        if (isAlbum) el.append(h("span", "ph-all", name));
        else tileMap.set(it.id, el);
        stage.append(el);
        return el;
      });

      canvas.append(root3);
      const ro = new ResizeObserver(() => cfResize());
      cf = {
        root: root3,
        items,
        vis: items.slice(),
        cap,
        pos: 0,
        target: 0,
        S: 140,
        k: -1,
        n: -1,
        raf: 0,
        last: 0,
        drag: false,
        moved: false,
        wt: 0,
        ro,
      };
      ro.observe(root3);
      cfResize();
      cfSync();

      /* Kéo ngang: chỉ bắt con trỏ khi đã kéo quá 6px để chạm / click vào ảnh vẫn hoạt động */
      let g = null;
      root3.addEventListener("pointerdown", (e) => {
        if (e.pointerType === "mouse" && e.button) return;
        cf.moved = false;
        g = {
          id: e.pointerId,
          x: e.clientX,
          p0: cf.pos,
          lx: e.clientX,
          lt: performance.now(),
          v: 0,
          on: false,
        };
      });
      root3.addEventListener("pointermove", (e) => {
        if (!g || !cf || e.pointerId !== g.id) return;
        const dx = e.clientX - g.x;
        if (!g.on) {
          if (Math.abs(dx) < 6) return;
          g.on = true;
          cf.drag = true;
          cf.moved = true;
          cfKick();
          try {
            root3.setPointerCapture(e.pointerId);
          } catch {}
        }
        const now = performance.now(),
          dt = Math.max(1, now - g.lt);
        g.v = 0.75 * g.v + 0.25 * ((g.lx - e.clientX) / cf.S / dt); // vận tốc (ảnh / ms)
        g.lx = e.clientX;
        g.lt = now;
        const [lo, hi] = cfRange(cf.vis.length);
        const raw = g.p0 - dx / cf.S;
        cf.pos =
          raw < lo
            ? lo - (lo - raw) * 0.35
            : raw > hi
              ? hi + (raw - hi) * 0.35
              : raw; // kéo quá đầu/cuối thì có lực cản
        cf.target = cf.pos;
      });
      const end = (e) => {
        if (!g || e.pointerId !== g.id) return;
        const s = g;
        g = null;
        if (!s.on || !cf) return;
        cf.drag = false;
        const fling =
          e.type === "pointerup" && performance.now() - s.lt < 90 ? s.v : 0; // dừng tay rồi mới thả thì không văng
        cf.target = cfSnap(cf.pos + fling * 260);
        cfKick();
      };
      root3.addEventListener("pointerup", end);
      root3.addEventListener("pointercancel", end);

      /* Lăn chuột / trackpad: đi theo tay, ngừng 140ms thì tự khớp về vị trí gần nhất */
      root3.addEventListener(
        "wheel",
        (e) => {
          if (!cf) return;
          e.preventDefault();
          const d =
            Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
          const [lo, hi] = cfRange(cf.vis.length);
          cf.target = Math.max(lo, Math.min(hi, cf.target + d / (cf.S * 1.6)));
          clearTimeout(cf.wt);
          cf.wt = setTimeout(() => {
            if (cf) {
              cf.target = cfSnap(cf.target);
              cfKick();
            }
          }, 140);
          cfKick();
        },
        { passive: false },
      );
    }

    /* --- Menu: Share --- */
    const link = () => location.href.split("#")[0] + "#" + (sel || cur);
    const shareName = () =>
      sel && BY[sel] ? BY[sel].title : entries[cur].label;
    shBtn.addEventListener("click", () =>
      menu(shBtn, [
        { head: shareName() },
        {
          label: "Copy Link",
          run: async () => {
            try {
              await navigator.clipboard.writeText(link());
              toast("Link copied");
            } catch {
              toast("Could not copy link");
            }
          },
        },
        {
          label: "Email…",
          run: () => {
            location.href =
              "mailto:?subject=" +
              encodeURIComponent(shareName()) +
              "&body=" +
              encodeURIComponent(link());
          },
        },
        {
          label: "Download",
          off: !(sel && BY[sel]),
          run: () => {
            const a = h("a");
            a.href = BY[sel].src;
            a.download =
              BY[sel].title + "." + BY[sel].src.split(".").pop().split("?")[0];
            a.click();
          },
        },
      ]),
    );

    /* --- Menu: More (máy tính) + Menu "…" (điện thoại) --- */
    const sortItems = () => [
      { head: T("Sort by", "Sắp xếp theo") },
      ...[
        ["none", T("Default", "Mặc định")],
        ["az", T("Name (A–Z)", "Tên (A–Z)")],
        ["za", T("Name (Z–A)", "Tên (Z–A)")],
      ].map(([k, l]) => ({
        label: l,
        on: sort === k,
        run: () => {
          sort = k;
          render();
        },
      })),
    ];
    const canPlay = () => kindNow === "photos" && total > 0;

    moBtn.addEventListener("click", () =>
      menu(moBtn, [
        { label: "Slideshow", off: !canPlay(), run: slideshow },
        {
          label: "Open",
          off: !sel,
          run: () =>
            canvas
              .querySelector(`[data-key="${sel}"]`)
              ?.dispatchEvent(new MouseEvent("dblclick", { bubbles: true })),
        },
        { sep: true },
        ...sortItems(),
      ]),
    );

    mMore.addEventListener("click", () =>
      menu(mMore, [
        { head: "Xem dạng" },
        { label: "Lưới", on: vmode === "grid", run: () => setView("grid") },
        { label: "3D", on: vmode === "3d", run: () => setView("3d") },
        { sep: true },
        { label: "Trình chiếu", off: !canPlay(), run: slideshow },
        { sep: true },
        ...sortItems(),
      ]),
    );

    // Đổi kích thước qua mốc 1100px thì vẽ lại (desktop <-> tablet)
    const mq = window.matchMedia("(max-width:1100px)");
    const onMq = () => {
      if (!root.isConnected) {
        mq.removeEventListener("change", onMq);
        return;
      }
      closePop();
      render();
    };
    mq.addEventListener("change", onMq);

    show("collections", false);
  }

  /* ---------- ĐĂNG KÝ APP ---------- */
  (window.WMApps = window.WMApps || {}).photos = {
    title: "Photos",
    w: 980,
    h: 620,
    cls: "is-photos", // class thêm vào cửa sổ (photos.css dùng để ẩn thanh tiêu đề trên máy tính)
    single: true, // không có nút "+ tab"
    build: (body, t, api) => {
      ready =
        ready ||
        Promise.all(GROUPS.map(([k, g]) => load(k, g))).then(() => {
          ALL.length = 0;
          ALBUMS.forEach((a) => ALL.push(...a.photos));
        });
      ready.then(() => build(body, t, api));
    },
  };
})();
