/* =========================================================
   js/apps/about.js: giao diện About gồm 4 cửa sổ mở cùng lúc
   - about        : cửa sổ chữ "About"
   - about_ngoc   : cửa sổ ảnh "Ngoc"
   - about_sang   : cửa sổ ảnh "Sang"
   - about_music  : mini-player kiểu Spotify trên macOS (không có thanh tiêu đề)
   Bấm About Me (desktop) -> mở cả 4, xếp theo bố cục macOS.
   Tablet / điện thoại: chỉ mở 1 cửa sổ About, ảnh nằm trên đầu bài.
   CSS đi kèm: css/apps/about.css
========================================================= */
(() => {
  /* ---------- DỮ LIỆU (sửa ở đây) ---------- */
  const PHOTOS = [
    { key: 'about_ngoc', name: 'Ngoc', src: 'assets/files/me1.png', w: 444, h: 487 },
    { key: 'about_sang', name: 'Sang', src: 'assets/files/me2.png', w: 444, h: 314 }
  ];

  const TEXT = [
    "Hi, I'm Ngọc Sang, a Designer based in Ho Chi Minh City.",
    "I'm passionate about creating clean, modern, and user-friendly digital experiences. My main interests are web design, UI/UX, and visual design. I enjoy turning ideas into simple and meaningful interfaces that not only look good but also feel intuitive to use.",
    "I'm always curious about new technologies and enjoy learning through real projects. I believe good design is about finding the right balance between creativity, function, and user experience.",
    "I'm always looking for new ideas, new challenges, and opportunities to grow as a designer.",
    "Welcome to my portfolio — feel free to explore my work."
  ];

  // Nhạc: thêm nhiều bài thì thêm dòng
  // url: link bài hát trên Spotify, dạng https://open.spotify.com/track/XXXX
  //      (để trống = tự dùng link tìm kiếm theo tên bài + nghệ sĩ)
  const TRACKS = [
    { title: 'Sao Mình Chưa Nắm Tay - Open Ver Tachi Drill',
      artist: 'Chu Duyên, KhangTruongg, Yan Nguyễn, Mimilee',
      cover: 'https://i.scdn.co/image/ab67616d0000b27369faf03203d8984af9ff03d3',
      src: 'assets/system/music1.mp3',
      url: 'https://open.spotify.com/intl-vi/track/6qnLkRxquqrCr7CXbh9czP?si=cda7245bd6f84fdb' }
  ];
  const spotifyUrl = t => t.url ||
    'https://open.spotify.com/search/' + encodeURIComponent(t.title + ' ' + t.artist);
  const LEGAL = {
    privacy: 'https://www.spotify.com/legal/privacy-policy/',
    terms: 'https://www.spotify.com/legal/end-user-agreement/'
  };

  // Bố cục (px, giữ nguyên kích thước thật): [x, y, rộng, cao], gốc (0,0) là góc trên trái của cả cụm
  const DOCK = 96;                       // chừa chỗ cho dock phía dưới
  const GROUP = [1304, 753];             // kích thước cả cụm, dùng để căn giữa
  const LAYOUT = {
    about_ngoc:  [0,   0,   444, 487],   // trái trên
    about:       [310, 282, 588, 372],   // đè lên góc phải-dưới của Ngoc
    about_sang:  [860, 39,  444, 314],   // phải trên, About đè nhẹ lên mép trái
    about_music: [883, 607, 330, 146]    // dưới Sang, chạm nhẹ mép phải của About
  };
  const OPEN_ORDER = ['about_ngoc', 'about_sang', 'about', 'about_music'];  // about_music trên cùng

  /* ---------- ICON ---------- */
  const svg = (p, fill) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"${fill ? ' fill="currentColor" stroke="none"' : ''}>${p}</svg>`;
  const IC = {
    add:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/>',
    shuffle: '<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.5 0 2.5-1.3 3.5-3M13 10c1-1.7 2-3 3.5-3H20M18 5l2 2-2 2M18 15l2 2-2 2"/>',
    repeat:  '<path d="M4 11V9a3 3 0 013-3h11M15 3l3 3-3 3M20 13v2a3 3 0 01-3 3H6M9 21l-3-3 3-3"/>',
    prev:    '<path d="M6 5h2v14H6zM19 5v14L9.5 12z"/>',
    next:    '<path d="M16 5h2v14h-2zM5 5v14l9.5-7z"/>',
    play:    '<path d="M8 5.5v13l11-6.5z"/>',
    pause:   '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
    dots:    '<circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/>',
    close:   '<path d="M6 6l12 12M18 6L6 18"/>',
    share:   '<circle cx="6" cy="12" r="2.2"/><circle cx="17" cy="6" r="2.2"/><circle cx="17" cy="18" r="2.2"/><path d="M8 11l7-4M8 13l7 4"/>',
    spotify: '<circle cx="12" cy="12" r="10" fill="currentColor" stroke="none"/><path d="M6.8 9.6c3.4-1 7-.7 10.2 1M7.3 12.6c2.9-.8 5.6-.5 8.3.9M7.9 15.4c2.4-.6 4.5-.4 6.7.7" stroke="#18181a" stroke-width="1.6"/>',
    volume:  '<path d="M4 9.5h3.5L12 6v12l-4.5-3.5H4zM15.5 9a4 4 0 010 6"/>',
    heart:   '<path d="M12 20.5s-8-4.9-8-10.6A4.4 4.4 0 0112 7.6a4.4 4.4 0 018 2.3c0 5.7-8 10.6-8 10.6z"/>',
    queue:   '<path d="M4 7h11M4 12h11M4 17h6M19 11v6"/><circle cx="17" cy="17.5" r="2"/>',
    nowplaying: '<rect x="3" y="5.5" width="18" height="13" rx="2"/><rect x="6" y="9" width="5" height="6" rx=".8"/><path d="M14 10h4M14 14h3"/>',
    lyrics:  '<path d="M4 7h10M4 12h7M4 17h7"/><circle cx="17.5" cy="15" r="2.5"/><path d="M19.2 16.8L21 19"/>',
    laptop:  '<rect x="5" y="5.5" width="14" height="10" rx="1.5"/><path d="M3 19h18"/>',
    expand:  '<path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/>'
  };

  const fmt = s => {
    s = Number.isFinite(s) ? Math.max(0, Math.round(s)) : 0;   // tránh "Infinity:NaN" khi chưa có duration
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  // Tạo thẻ <img> dùng chung cho cả 2 nơi hiển thị ảnh
  const makeImg = (p, cls) => {
    const im = new Image();
    im.src = p.src;
    im.alt = p.name;
    im.draggable = false;
    im.decoding = 'async';
    if (cls) im.className = cls;
    return im;
  };

  /* ---------- CỬA SỔ CHỮ "About" ---------- */
  let laying = false;   // chặn mở/xếp lặp: api.open('about') bên trong layout có thể gọi lại buildAbout

  function buildAbout(body, _title, api) {
    const { h } = api;
    body.classList.add('flush');

    const page = h('div', 'about-page');

    const pics = h('div', 'about-pics');            // chỉ hiện trên tablet / điện thoại (xem about.css)
    PHOTOS.forEach(p => {
      const f = h('figure');
      f.append(makeImg(p), h('figcaption', null, p.name));
      pics.append(f);
    });

    const text = h('div', 'about-text');
    text.append(...TEXT.map(t => h('p', null, t)));

    page.append(pics, text);
    body.append(page);

    // Desktop: mở thêm các cửa sổ còn lại sau khi cửa sổ About đã tạo xong
    if (!api.isMobile() && !laying) queueMicrotask(() => layout(api));
  }

  const SETTLE_FRAMES = 4;    // số frame liên tiếp WM không đụng vào cửa sổ -> coi là hiệu ứng đã xong
  const SETTLE_MAX = 1500;    // ms, thời gian chờ tối đa

  function layout(api) {
    if (laying) return;
    laying = true;

    const set = OPEN_ORDER
      .map(key => [key, api.open(key)])
      .filter(([, w]) => w);
    const aboutWin = set.find(([key]) => key === 'about');
    const host = aboutWin && aboutWin[1].el.parentElement;
    if (!host) { laying = false; return; }

    // 1) Ẩn hẳn (CSS: .win.about-boot { visibility: hidden !important }) -> không ai thấy hiệu ứng genie
    set.forEach(([, w]) => w.el.classList.add('about-boot'));

    const cw = host.clientWidth, ch = host.clientHeight - DOCK;
    const ox = Math.max(12, Math.round((cw - GROUP[0]) / 2));
    const oy = Math.max(12, Math.round((ch - GROUP[1]) / 2));

    // 2) Mỗi frame: cho hiệu ứng chạy xong ngay, xoá dấu vết, đặt lại đúng vị trí cuối
    const place = () => set.forEach(([key, w]) => {
      const [x, y, ww, hh] = LAYOUT[key];
      const el = w.el;
      if (el.getAnimations) {
        el.getAnimations().forEach(a => { try { a.finish(); } catch { a.cancel(); } });
      }
      ['clipPath', 'filter', 'opacity', 'transformOrigin'].forEach(p => { el.style[p] = ''; });
      el.style.transition = 'none';
      el.style.animation = 'none';
      el.style.transform = 'none';
      Object.assign(el.style, {
        left: ox + x + 'px',
        top: oy + y + 'px',
        width: ww + 'px',
        height: hh + 'px'
      });
    });
    const styleOf = () => set.map(([, w]) => w.el.getAttribute('style')).join('|');
    const animating = () => set.some(([, w]) => w.el.getAnimations && w.el.getAnimations().length);

    const finish = () => {
      place();
      set.forEach(([, w]) => w.el.classList.remove('about-boot'));
      laying = false;
    };

    // 3) Chờ WM thôi ghi đè rồi mới hiện
    place();
    const t0 = performance.now();
    let snap = styleOf(), stable = 0;
    const tick = () => {
      const touched = styleOf() !== snap || animating();
      place();
      snap = styleOf();
      stable = touched ? 0 : stable + 1;
      if (stable >= SETTLE_FRAMES || performance.now() - t0 > SETTLE_MAX) finish();
      else requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  /* ---------- CỬA SỔ ẢNH ---------- */
  const buildPhoto = p => (body) => {
    body.classList.add('flush');
    body.append(makeImg(p, 'about-photo'));
  };

  /* ---------- WIDGET NHẠC (mini-player Spotify trên macOS) ---------- */
  function buildMusic(body, _title, api) {
    body.classList.add('flush');

    const root = api.h('div', 'mw win-drag');
    root.addEventListener('dblclick', e => e.stopPropagation());   // không cho double-click phóng to
    root.innerHTML = `
      <div class="mw-top">
        <div class="mw-cover"><img alt="" draggable="false"></div>
        <div class="mw-info">
          <div class="mw-title"></div>
          <div class="mw-artist"></div>
        </div>
        <button class="mw-btn mw-save" type="button" aria-label="Save"></button>
        <button class="mw-btn mw-more" type="button" aria-label="More options">${svg(IC.dots)}</button>
        <button class="mw-btn mw-queue" type="button" aria-label="Open in Spotify">${svg(IC.queue)}</button>
      </div>
      <div class="mw-ctrl">
        <button class="mw-btn" data-a="shuffle" type="button" aria-label="Shuffle" aria-pressed="false">${svg(IC.shuffle)}</button>
        <button class="mw-btn" data-a="prev" type="button" aria-label="Previous">${svg(IC.prev, true)}</button>
        <button class="mw-btn mw-play" data-a="play" type="button"></button>
        <button class="mw-btn" data-a="next" type="button" aria-label="Next">${svg(IC.next, true)}</button>
        <button class="mw-btn" data-a="repeat" type="button" aria-label="Repeat" aria-pressed="false">${svg(IC.repeat)}</button>
      </div>
      <div class="mw-time">
        <span class="mw-cur">0:00</span>
        <div class="mw-track mw-seek" aria-label="Seek"><i></i></div>
        <span class="mw-dur">0:00</span>
      </div>
      <div class="mw-foot">
        <div class="mw-fl">
          <span class="mw-ic">${svg(IC.nowplaying)}</span>
          <span class="mw-ic">${svg(IC.lyrics)}</span>
        </div>
        <div class="mw-fr">
          <span class="mw-ic">${svg(IC.laptop)}</span>
          <div class="mw-vol">${svg(IC.volume)}<div class="mw-track mw-volbar" aria-label="Volume"><i></i></div></div>
          <span class="mw-ic">${svg(IC.expand)}</span>
        </div>
      </div>
      <div class="mw-menu" hidden>
        <button class="mw-x" type="button" aria-label="Close">${svg(IC.close)}</button>
        <button class="mw-mi" data-m="play" type="button">${svg(IC.spotify)}<span>Play on Spotify</span></button>
        <button class="mw-mi" data-m="save" type="button">${svg(IC.add)}<span>Save on Spotify</span></button>
        <button class="mw-mi" data-m="copy" type="button">${svg(IC.share)}<span>Copy link</span></button>
        <div class="mw-legal">
          <a href="${LEGAL.privacy}" target="_blank" rel="noopener">Privacy Policy</a> ·
          <a href="${LEGAL.terms}" target="_blank" rel="noopener">Terms &amp; Conditions</a>
        </div>
      </div>`;
    body.append(root);

    const q = s => root.querySelector(s);
    const cover = q('.mw-cover'), cim = q('.mw-cover img');
    const title = q('.mw-title'), artist = q('.mw-artist');
    const save = q('.mw-save'), play = q('.mw-play');
    const cur = q('.mw-cur'), dur = q('.mw-dur');
    const seek = q('.mw-seek'), seekFill = seek.firstElementChild;
    const volBar = q('.mw-volbar'), volFill = volBar.firstElementChild;
    const btn = a => q(`[data-a="${a}"]`);

    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = 0.7;
    let idx = 0, saved = false, shuffle = false;

    /* thanh trượt dùng chung: bấm, kéo hoặc dùng phím mũi tên; không cho kéo cả cửa sổ khi đang chỉnh */
    const slider = (el, getValue, onChange) => {
      const clamp = v => Math.max(0, Math.min(1, v));
      const calc = e => {
        const r = el.getBoundingClientRect();
        if (r.width) onChange(clamp((e.clientX - r.left) / r.width));
      };
      el.tabIndex = 0;
      el.setAttribute('role', 'slider');
      el.addEventListener('pointerdown', e => {
        e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        calc(e);
        const end = () => {
          el.removeEventListener('pointermove', calc);
          el.removeEventListener('pointerup', end);
          el.removeEventListener('pointercancel', end);
        };
        el.addEventListener('pointermove', calc);
        el.addEventListener('pointerup', end);
        el.addEventListener('pointercancel', end);
      });
      el.addEventListener('keydown', e => {
        const d = e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 0.05
                : e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -0.05 : 0;
        if (!d) return;
        e.preventDefault();
        e.stopPropagation();
        onChange(clamp(getValue() + d));
      });
    };
    root.querySelectorAll('button').forEach(b =>
      b.addEventListener('pointerdown', e => e.stopPropagation()));

    const paintPlay = () => {
      const p = !audio.paused;
      play.innerHTML = svg(p ? IC.pause : IC.play, true);
      play.setAttribute('aria-label', p ? 'Pause' : 'Play');
    };
    const paintSave = () => {
      save.innerHTML = svg(IC.heart, saved);
      save.classList.toggle('on', saved);
      save.setAttribute('aria-pressed', saved);
    };
    const paintVol = () => { volFill.style.width = audio.volume * 100 + '%'; };
    const progress = () => {
      const d = audio.duration;
      return Number.isFinite(d) && d > 0 ? audio.currentTime / d : 0;
    };

    function load(i, autoplay) {
      idx = (i + TRACKS.length) % TRACKS.length;
      const t = TRACKS[idx];
      title.textContent = t.title;
      artist.textContent = t.artist;

      cover.classList.toggle('noimg', !t.cover);
      cim.onerror = () => cover.classList.add('noimg');
      if (t.cover) cim.src = t.cover; else cim.removeAttribute('src');

      saved = false;
      paintSave();
      seekFill.style.width = '0%';
      cur.textContent = '0:00';
      dur.textContent = '0:00';

      // không gán src = '' (trình duyệt sẽ tải lại chính trang hiện tại và báo lỗi)
      if (t.src) audio.src = t.src; else audio.removeAttribute('src');
      play.classList.toggle('off', !t.src);
      if (autoplay && t.src) audio.play().catch(() => {});
      paintPlay();
    }

    const next = () => {
      const n = shuffle && TRACKS.length > 1
        ? (idx + 1 + Math.floor(Math.random() * (TRACKS.length - 1))) % TRACKS.length
        : idx + 1;
      load(n, true);
    };

    const dead = () => {                       // cửa sổ đã đóng thì dừng nhạc
      if (body.isConnected) return false;
      audio.pause();
      audio.removeAttribute('src');
      audio.load();
      return true;
    };

    audio.addEventListener('timeupdate', () => {
      if (dead()) return;
      seekFill.style.width = progress() * 100 + '%';
      cur.textContent = fmt(audio.currentTime);
    });
    audio.addEventListener('loadedmetadata', () => { dur.textContent = fmt(audio.duration); });
    audio.addEventListener('play', paintPlay);
    audio.addEventListener('pause', paintPlay);
    audio.addEventListener('error', () => {
      if (audio.getAttribute('src')) play.classList.add('off');
    });
    audio.addEventListener('ended', () => {
      if (TRACKS.length > 1) next();
      else { audio.currentTime = 0; paintPlay(); }
    });

    play.addEventListener('click', () => {
      if (dead() || !TRACKS[idx].src) return;
      if (audio.paused) audio.play().catch(() => {}); else audio.pause();
    });
    btn('next').addEventListener('click', () => {
      if (TRACKS.length > 1) next(); else audio.currentTime = 0;
    });
    btn('prev').addEventListener('click', () => {
      if (audio.currentTime > 3 || TRACKS.length < 2) audio.currentTime = 0;   // giống Spotify: >3s thì về đầu bài
      else load(idx - 1, !audio.paused);
    });
    btn('shuffle').addEventListener('click', e => {
      shuffle = !shuffle;
      e.currentTarget.classList.toggle('on', shuffle);
      e.currentTarget.setAttribute('aria-pressed', shuffle);
    });
    btn('repeat').addEventListener('click', e => {
      audio.loop = !audio.loop;
      e.currentTarget.classList.toggle('on', audio.loop);
      e.currentTarget.setAttribute('aria-pressed', audio.loop);
    });
    /* nút Save (trái tim) chỉ đánh dấu; mở Spotify thật nằm trong menu "..." */
    save.addEventListener('click', () => { saved = !saved; paintSave(); });

    /* menu "..." */
    const menu = q('.mw-menu');
    const openLink = () => window.open(spotifyUrl(TRACKS[idx]), '_blank', 'noopener');
    const toggleMenu = on => { menu.hidden = !on; };
    q('.mw-more').addEventListener('click', () => toggleMenu(true));
    q('.mw-queue').addEventListener('click', openLink);      // (bản cũ đăng ký 2 lần -> mở 2 tab)
    q('.mw-x').addEventListener('click', () => toggleMenu(false));
    menu.addEventListener('pointerdown', e => e.stopPropagation());
    menu.querySelector('[data-m="play"]').addEventListener('click', () => { openLink(); toggleMenu(false); });
    menu.querySelector('[data-m="save"]').addEventListener('click', () => { openLink(); toggleMenu(false); });

    const copyBtn = menu.querySelector('[data-m="copy"]');
    const copyLabel = copyBtn.querySelector('span');
    let copyTimer;
    copyBtn.addEventListener('click', async () => {
      const url = spotifyUrl(TRACKS[idx]);
      try { await navigator.clipboard.writeText(url); }
      catch {                                            // trình duyệt chặn clipboard: dùng cách cũ
        const ta = document.createElement('textarea');
        ta.value = url;
        ta.setAttribute('readonly', '');
        ta.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0';
        document.body.append(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        ta.remove();
      }
      copyLabel.textContent = 'Copied!';
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => { copyLabel.textContent = 'Copy link'; }, 1500);
    });

    slider(seek, progress, f => {
      const d = audio.duration;
      if (Number.isFinite(d) && d > 0) {
        audio.currentTime = f * d;
        seekFill.style.width = f * 100 + '%';
      }
    });
    slider(volBar, () => audio.volume, f => { audio.volume = f; paintVol(); });

    paintVol();
    load(0, false);
  }

  /* ---------- ĐĂNG KÝ ---------- */
  const reg = (window.WMApps = window.WMApps || {});

  reg.about = { title: 'About', w: 588, h: 372, cls: 'is-about', build: buildAbout };

  PHOTOS.forEach(p => {
    reg[p.key] = { title: p.name, w: p.w, h: p.h, cls: 'is-photo', build: buildPhoto(p) };
  });

  reg.about_music = { title: 'Music', w: 330, h: 146, cls: 'is-music', build: buildMusic };
})();