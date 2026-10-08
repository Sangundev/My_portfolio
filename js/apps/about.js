/* =========================================================
   js/apps/about.js: giao diện About gồm 4 cửa sổ mở cùng lúc
   - about        : cửa sổ chữ "About"
   - about_ngoc   : cửa sổ ảnh "Ngoc"
   - about_sang   : cửa sổ ảnh "Sang"
   - about_music  : mini-player kiểu Spotify trên macOS (không có thanh tiêu đề)
   Bấm About Me (desktop) -> mở cả 4, hiện ra ngay đúng vị trí đã định.
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

  // Bố cục (px, giữ nguyên kích thước thật): [x, y, rộng, cao]
  // Gốc (0,0) là góc trên trái của cả cụm; cả cụm được căn giữa màn hình.
  const DOCK = 96;                       // chừa chỗ cho dock phía dưới
  const GROUP = [1304, 753];             // kích thước cả cụm, dùng để căn giữa
  const LAYOUT = {
    about_ngoc:  [0,   0,   444, 487],   // trái trên
    about:       [310, 282, 588, 372],   // đè lên góc phải-dưới của Ngoc
    about_sang:  [860, 39,  444, 314],   // phải trên, About đè nhẹ lên mép trái
    about_music: [883, 607, 330, 146]    // dưới Sang, chạm nhẹ mép phải của About
  };

  /* ---------- ICON ---------- */
  const svg = (p, fill) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true"${fill ? ' fill="currentColor" stroke="none"' : ''}>${p}</svg>`;
  const IC = {
    add:     '<circle cx="12" cy="12" r="8.5"/><path d="M12 8.5v7M8.5 12h7"/>',
    check:   '<circle cx="12" cy="12" r="8.5"/><path d="M8.5 12.5l2.5 2.5 4.5-5"/>',
    shuffle: '<path d="M4 7h3.5c4 0 5 10 9 10H20M4 17h3.5c1.5 0 2.5-1.3 3.5-3M13 10c1-1.7 2-3 3.5-3H20M18 5l2 2-2 2M18 15l2 2-2 2"/>',
    repeat:  '<path d="M4 11V9a3 3 0 013-3h11M15 3l3 3-3 3M20 13v2a3 3 0 01-3 3H6M9 21l-3-3 3-3"/>',
    prev:    '<path d="M6 5h2v14H6zM19 5v14L9.5 12z"/>',
    next:    '<path d="M16 5h2v14h-2zM5 5v14l9.5-7z"/>',
    play:    '<path d="M8 5.5v13l11-6.5z"/>',
    pause:   '<path d="M7 5h3.5v14H7zM13.5 5H17v14h-3.5z"/>',
    device:  '<rect x="5" y="3.5" width="14" height="17" rx="2"/><circle cx="12" cy="14.5" r="3"/><path d="M12 7h.01"/>',
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
    s = Math.max(0, Math.round(s || 0));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  /* ---------- CỬA SỔ CHỮ "About" ---------- */
  function buildAbout(body, _title, api) {
    const { h } = api;
    body.classList.add('flush');

    const page = h('div', 'about-page');

    const pics = h('div', 'about-pics');            // chỉ hiện trên tablet / điện thoại (xem about.css)
    PHOTOS.forEach(p => {
      const f = h('figure');
      const im = new Image();
      im.src = p.src; im.alt = p.name; im.draggable = false;
      f.append(im, h('figcaption', null, p.name));
      pics.append(f);
    });

    const text = h('div', 'about-text');
    text.append(...TEXT.map(t => h('p', null, t)));

    page.append(pics, text);
    body.append(page);

    // Desktop: mở thêm các cửa sổ còn lại sau khi cửa sổ About đã tạo xong
    if (!api.isMobile()) queueMicrotask(() => layout(api));
  }

  /* Mở đủ 4 cửa sổ rồi ghim vào đúng vị trí.
     - Cửa sổ mới mở bị ẩn ngay (class about-hide) nên không thấy cảnh chạy từ giữa màn hình ra.
     - Chờ hệ thống mở cửa sổ xong (style ngừng thay đổi) rồi hủy animation, ghim vị trí, hiện ra.
     - Cửa sổ đã được xếp trước đó (người dùng có thể đã kéo đi) thì giữ nguyên. */
  function layout(api) {
    const set = [
      ['about_ngoc',  api.open('about_ngoc')],
      ['about_sang',  api.open('about_sang')],
      ['about',       api.open('about')],
      ['about_music', api.open('about_music')]
    ];
    const host = set[2][1] && set[2][1].el.parentElement;
    if (!host) return;

    const fresh = set.filter(([, w]) => w && w.el && !w.el.dataset.aboutPlaced);
    if (!fresh.length) return;

    fresh.forEach(([, w]) => {
      w.el.dataset.aboutPlaced = '1';
      w.el.classList.add('about-hide');
    });

    const place = () => {
      const cw = host.clientWidth, ch = host.clientHeight - DOCK;
      const ox = Math.max(12, Math.round((cw - GROUP[0]) / 2));
      const oy = Math.max(12, Math.round((ch - GROUP[1]) / 2));

      fresh.forEach(([key, w]) => {
        const [x, y, ww, hh] = LAYOUT[key];
        const el = w.el;
        if (el.getAnimations) el.getAnimations().forEach(a => a.cancel());
        Object.assign(el.style, {
          transition: 'none',
          animation: 'none',
          transform: 'none',
          clipPath: 'none',
          filter: 'none',
          opacity: '1',
          left: ox + x + 'px',
          top: oy + y + 'px',
          width: ww + 'px',
          height: hh + 'px'
        });
      });
    };

    place();

    let settle, hard, done = false;
    const mo = new MutationObserver(() => {      // hệ thống còn đang ghi style -> chờ thêm
      clearTimeout(settle);
      settle = setTimeout(finish, 150);
    });
    function finish() {
      if (done) return;
      done = true;
      mo.disconnect();
      clearTimeout(settle);
      clearTimeout(hard);
      place();                                   // ghi đè lần cuối rồi mới hiện
      fresh.forEach(([, w]) => {
        // gỡ các style tạm: để CSS / chế độ "xem tất cả cửa sổ" tự điều khiển transform, opacity...
        ['transform', 'clip-path', 'filter', 'opacity', 'transition']
          .forEach(p => w.el.style.removeProperty(p));
        w.el.classList.remove('about-hide');
      });
    }
    fresh.forEach(([, w]) => mo.observe(w.el, { attributes: true, attributeFilter: ['style'] }));
    settle = setTimeout(finish, 150);
    hard = setTimeout(finish, 1500);             // chốt chặn: tối đa 1.5s
  }

  /* ---------- CỬA SỔ ẢNH ---------- */
  const buildPhoto = p => (body, _title, api) => {
    body.classList.add('flush');
    const im = new Image();
    im.src = p.src; im.alt = p.name; im.draggable = false;
    im.className = 'about-photo';
    body.append(im);
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
        <button class="mw-btn mw-more" type="button" aria-label="Add to playlist">${svg(IC.add)}</button>
        <button class="mw-btn mw-queue" type="button" aria-label="Queue">${svg(IC.queue)}</button>
      </div>
      <div class="mw-ctrl">
        <button class="mw-btn" data-a="shuffle" type="button" aria-label="Shuffle">${svg(IC.shuffle)}</button>
        <button class="mw-btn" data-a="prev" type="button" aria-label="Previous">${svg(IC.prev, true)}</button>
        <button class="mw-btn mw-play" data-a="play" type="button"></button>
        <button class="mw-btn" data-a="next" type="button" aria-label="Next">${svg(IC.next, true)}</button>
        <button class="mw-btn" data-a="repeat" type="button" aria-label="Repeat">${svg(IC.repeat)}</button>
      </div>
      <div class="mw-time">
        <span class="mw-cur">0:00</span>
        <div class="mw-track mw-seek"><i></i></div>
        <span class="mw-dur">0:00</span>
      </div>
      <div class="mw-foot">
        <div class="mw-fl">
          <span class="mw-ic">${svg(IC.nowplaying)}</span>
          <span class="mw-ic">${svg(IC.lyrics)}</span>
        </div>
        <div class="mw-fr">
          <span class="mw-ic">${svg(IC.laptop)}</span>
          <div class="mw-vol">${svg(IC.volume)}<div class="mw-track mw-volbar"><i></i></div></div>
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
    let idx = 0, saved = false, shuffle = false, repeat = false;

    /* thanh trượt dùng chung: bấm hoặc kéo; không cho kéo cả cửa sổ khi đang chỉnh */
    const slider = (el, onChange) => {
      const calc = e => {
        const r = el.getBoundingClientRect();
        onChange(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)));
      };
      el.addEventListener('pointerdown', e => {
        e.stopPropagation();
        el.setPointerCapture(e.pointerId);
        calc(e);
        const move = ev => calc(ev);
        const up = () => {
          el.removeEventListener('pointermove', move);
          el.removeEventListener('pointerup', up);
        };
        el.addEventListener('pointermove', move);
        el.addEventListener('pointerup', up);
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
    };
    const paintVol = () => { volFill.style.width = audio.volume * 100 + '%'; };

    function load(i, autoplay) {
      idx = (i + TRACKS.length) % TRACKS.length;
      const t = TRACKS[idx];
      title.textContent = t.title;
      artist.textContent = t.artist;
      cover.classList.toggle('noimg', !t.cover);
      cim.onerror = () => cover.classList.add('noimg');
      cim.src = t.cover || '';
      saved = false;
      paintSave();
      seekFill.style.width = '0%';
      cur.textContent = '0:00';
      dur.textContent = '0:00';
      audio.src = t.src || '';
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
      return true;
    };

    audio.addEventListener('timeupdate', () => {
      if (dead()) return;
      const d = audio.duration || 0;
      seekFill.style.width = (d ? (audio.currentTime / d) * 100 : 0) + '%';
      cur.textContent = fmt(audio.currentTime);
    });
    audio.addEventListener('loadedmetadata', () => { dur.textContent = fmt(audio.duration); });
    audio.addEventListener('play', paintPlay);
    audio.addEventListener('pause', paintPlay);
    audio.addEventListener('error', () => play.classList.add('off'));
    audio.addEventListener('ended', () => {
      if (TRACKS.length > 1) next();
      else { audio.currentTime = 0; paintPlay(); }
    });

    play.addEventListener('click', () => {
      if (!TRACKS[idx].src) return;
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
    });
    btn('repeat').addEventListener('click', e => {
      repeat = !repeat;
      audio.loop = repeat;
      e.currentTarget.classList.toggle('on', repeat);
    });
    /* nút Save (trái tim) chỉ đánh dấu; mở Spotify thật nằm trong menu "+" */
    save.addEventListener('click', () => { saved = !saved; paintSave(); });

    /* menu "+" */
    const menu = q('.mw-menu');
    const openLink = () => window.open(spotifyUrl(TRACKS[idx]), '_blank', 'noopener');
    const toggleMenu = on => { menu.hidden = !on; };
    q('.mw-more').addEventListener('click', () => toggleMenu(true));
    q('.mw-queue').addEventListener('click', openLink);
    q('.mw-x').addEventListener('click', () => toggleMenu(false));
    menu.addEventListener('pointerdown', e => e.stopPropagation());
    menu.querySelector('[data-m="play"]').addEventListener('click', openLink);
    menu.querySelector('[data-m="save"]').addEventListener('click', openLink);
    const copyBtn = menu.querySelector('[data-m="copy"]');
    copyBtn.addEventListener('click', async () => {
      const label = copyBtn.querySelector('span');
      const url = spotifyUrl(TRACKS[idx]);
      try { await navigator.clipboard.writeText(url); }
      catch {                                            // trình duyệt chặn clipboard: dùng cách cũ
        const ta = document.createElement('textarea');
        ta.value = url; document.body.append(ta); ta.select();
        try { document.execCommand('copy'); } catch {}
        ta.remove();
      }
      label.textContent = 'Copied!';
      setTimeout(() => { label.textContent = 'Copy link'; }, 1500);
    });

    slider(seek, f => { if (audio.duration) audio.currentTime = f * audio.duration; });
    slider(volBar, f => { audio.volume = f; paintVol(); });

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