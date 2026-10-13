(() => {
  /* ---------- DỮ LIỆU (sửa ở đây) ---------- */
  const PLAYLIST = {
    name: 'vibey hindi',
    owner: 'Inika',
    id: '6qInSAmUkoFbwVotBcoRIG',
    cover: 'https://i.scdn.co/image/ab67616d0000b27369faf03203d8984af9ff03d3'
  };

  /* Danh sách bài (điền tay). Lấy id: Spotify > chuột phải bài hát > Share > Copy Song Link
     -> link dạng https://open.spotify.com/track/XXXXXXXX?si=... thì id là phần XXXXXXXX.
     'cover' là tùy chọn (ảnh bìa riêng của bài), không điền thì dùng ảnh playlist.
     Để mảng rỗng [] thì widget phát nguyên playlist, nút tới/lui bị khóa. */
  const TRACKS = [
    // { id: 'TRACK_ID_1', title: 'Tên bài 1', artist: 'Ca sĩ 1' },
    // { id: 'TRACK_ID_2', title: 'Tên bài 2', artist: 'Ca sĩ 2', cover: 'https://i.scdn.co/image/...' },
  ];

  const ITEMS = TRACKS.length
    ? TRACKS.map(t => ({
        uri: 'spotify:track:' + t.id, title: t.title, artist: t.artist, cover: t.cover || PLAYLIST.cover
      }))
    : [{ uri: 'spotify:playlist:' + PLAYLIST.id, title: PLAYLIST.name, artist: PLAYLIST.owner, cover: PLAYLIST.cover }];

  /* ---------- NẠP SPOTIFY iFRAME API (1 lần) ---------- */
  let apiReady = null;
  const apiQueue = [];
  function withApi(cb) {
    if (apiReady) return cb(apiReady);
    apiQueue.push(cb);
    if (window.__spApiLoading) return;
    window.__spApiLoading = true;
    window.onSpotifyIframeApiReady = api => {
      apiReady = api;
      apiQueue.splice(0).forEach(f => f(api));
    };
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    document.head.append(s);
  }

  const fmt = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  /* ---------- WIDGET ---------- */
  function buildSpotify(body, _title, api) {
    body.classList.add('flush');

    const root = api.h('div', 'sp win-drag');   // win-drag: kéo cửa sổ (desktop)
    root.addEventListener('dblclick', e => e.stopPropagation());
    root.innerHTML =
      '<div class="sp-mini"><img alt="" draggable="false"><span class="sp-eq"><i></i><i></i><i></i><i></i><i></i></span></div>' +
      '<div class="sp-desk"></div><div class="sp-host"></div>' +
      '<div class="sp-card">' +
        '<div class="sp-top">' +
          '<img class="sp-art" alt="" draggable="false">' +
          '<div class="sp-info"><div class="sp-title"></div><div class="sp-artist"></div></div>' +
          '<span class="sp-eq"><i></i><i></i><i></i><i></i><i></i></span>' +
        '</div>' +
        '<div class="sp-time"><span class="sp-cur">0:00</span><div class="sp-track"><i></i></div><span class="sp-rem">-0:00</span></div>' +
        '<div class="sp-ctrl">' +
          '<button class="sp-btn sp-prev" aria-label="Bài trước"><svg viewBox="0 0 24 24"><path d="M11 6v12L2.5 12 11 6zm10.5 0v12L13 12l8.5-6z"/></svg></button>' +
          '<button class="sp-btn sp-play" aria-label="Phát / tạm dừng">' +
            '<svg class="ic-play" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>' +
            '<svg class="ic-pause" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>' +
          '</button>' +
          '<button class="sp-btn sp-next" aria-label="Bài sau"><svg viewBox="0 0 24 24"><path d="M13 6v12l8.5-6L13 6zM2.5 6v12L11 12 2.5 6z"/></svg></button>' +
        '</div>' +
      '</div>';
    body.append(root);

    const $ = s => root.querySelector(s);
    const elTitle = $('.sp-title'), elArtist = $('.sp-artist'), elArt = $('.sp-art');
    const elMini = $('.sp-mini img'), elCur = $('.sp-cur'), elRem = $('.sp-rem');
    const elBar = $('.sp-track i');
    const btnPrev = $('.sp-prev'), btnNext = $('.sp-next'), btnPlay = $('.sp-play');
    const single = ITEMS.length < 2;
    btnPrev.disabled = btnNext.disabled = single;

    let idx = 0, ctrl = null, ended = false, wantPlay = false;

    const show = () => {
      const it = ITEMS[idx];
      elTitle.textContent = it.title;
      elArtist.textContent = it.artist;
      elArt.src = elMini.src = it.cover || '';
      elBar.style.transform = 'scaleX(0)';
      elCur.textContent = '0:00';
      elRem.textContent = '-0:00';
    };
    show();

    const go = (n, autoplay) => {
      idx = (n + ITEMS.length) % ITEMS.length;
      ended = false;
      show();
      if (!ctrl) { wantPlay = autoplay; return; }
      ctrl.loadUri(ITEMS[idx].uri);
      if (autoplay) ctrl.play();
    };

    btnPrev.addEventListener('click', () => go(idx - 1, true));
    btnNext.addEventListener('click', () => go(idx + 1, true));
    btnPlay.addEventListener('click', () => {
      if (!ctrl) { wantPlay = true; return; }
      ctrl.togglePlay();
    });
    [btnPrev, btnNext, btnPlay].forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));

    /* desktop: player Spotify gốc (hiện thấy). điện thoại/tablet: player ngầm + thẻ iOS */
    const desk = $('.sp-desk'), host = $('.sp-host');
    let dead = false, gen = 0, mode = null;

    const startDesk = () => {
      if (desk.firstChild) return;
      const frame = document.createElement('iframe');
      frame.src = `https://open.spotify.com/embed/playlist/${PLAYLIST.id}?utm_source=generator&theme=0`;
      frame.title = 'Spotify playlist';
      frame.height = '152';
      frame.setAttribute('frameborder', '0');
      frame.setAttribute('loading', 'lazy');
      frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      frame.addEventListener('pointerdown', e => e.stopPropagation());   // iframe tự xử lý chuột
      desk.append(frame);
    };
    const stopDesk = () => { desk.innerHTML = ''; };

    const stopCtrl = () => {
      if (ctrl) { try { ctrl.destroy(); } catch (_) {} ctrl = null; }
      host.innerHTML = '';
      root.classList.remove('playing');
    };
    const startCtrl = () => {
      const my = ++gen;
      host.innerHTML = '<div class="sp-slot"></div>';
      withApi(IFrameAPI => {
        if (dead || my !== gen || !body.isConnected) return;
        IFrameAPI.createController(host.firstChild, { uri: ITEMS[idx].uri, width: 300, height: 80 }, c => {
          if (dead || my !== gen) { try { c.destroy(); } catch (_) {} return; }
          ctrl = c;
          c.addListener('playback_update', e => {
            const d = e.data || {};
            root.classList.toggle('playing', !d.isPaused && !d.isBuffering);
            if (d.duration > 0) {
              const p = Math.min(1, d.position / d.duration);
              elBar.style.transform = 'scaleX(' + p + ')';
              elCur.textContent = fmt(d.position);
              elRem.textContent = '-' + fmt(d.duration - d.position);
              /* hết bài -> tự qua bài kế (chỉ khi có danh sách bài) */
              if (!single && !ended && d.position >= d.duration - 400) {
                ended = true;
                go(idx + 1, true);
              }
            }
          });
          if (wantPlay) c.play();
        });
      });
    };
    const setMode = () => {
      const m = window.matchMedia('(max-width: 1024px)').matches ? 'mobile' : 'desktop';
      if (m === mode) return;
      mode = m;
      if (m === 'mobile') { stopDesk(); startCtrl(); }
      else { gen++; stopCtrl(); startDesk(); }
    };

    /* ---------- Dynamic Island: chỉ hiện ở điện thoại/tablet (CSS quyết định) ---------- */
    let win = body.closest('.win');
    const getWin = () => (win = win || body.closest('.win'));
    const mini = $('.sp-mini');

    const mq = window.matchMedia('(max-width: 1024px)');
    const PROPS = ['position','top','left','right','bottom','transform','width','height','border-radius','overflow','z-index'];
    const ISLAND_TOP = 'calc(var(--safe-top, 0px) + (var(--menubar-h, 44px) - 37px) / 2)';
    let applied = false, saved = null;
    const layout = () => {
      const w = getWin();
      if (!w) return;
      if (!mq.matches) {
        if (applied && saved) PROPS.forEach(k =>
          saved[k] ? w.style.setProperty(k, saved[k]) : w.style.removeProperty(k));
        w.classList.remove('sp-open', 'sp-press');
        applied = false;
        return;
      }
      if (!applied) { saved = {}; PROPS.forEach(k => saved[k] = w.style.getPropertyValue(k)); }
      applied = true;
      const open = w.classList.contains('sp-open');
      const S = (k, v) => w.style.setProperty(k, v, 'important');
      S('position', 'fixed');
      S('top', ISLAND_TOP);
      S('left', '0');
      S('right', '0');
      S('bottom', 'auto');
      S('transform', 'none');
      S('overflow', 'hidden');
      S('z-index', '9999');
      S('width',  open ? 'min(340px, calc(100vw - 24px))' : '200px');
      S('height', open ? '162px' : '37px');
      S('border-radius', open ? '40px' : '20px');
    };
    const toggle = open => {
      const w = getWin();
      if (w) w.classList.toggle('sp-open', open);
      layout();
    };
    const onMq = () => { layout(); setMode(); };
    mq.addEventListener('change', onMq);
    layout();
    setMode();
    requestAnimationFrame(layout);
    setTimeout(layout, 300);

    /* Chạm nhanh HOẶC đè lâu (350ms) trên viên thuốc -> bung thẻ */
    const HOLD_MS = 350, MOVE_TOL = 10;
    let pressTimer = null, startX = 0, startY = 0, longFired = false;

    const clearPress = () => {
      clearTimeout(pressTimer);
      pressTimer = null;
      const w = getWin();
      if (w) w.classList.remove('sp-press');
    };

    mini.addEventListener('pointerdown', e => {
      e.stopPropagation();
      startX = e.clientX; startY = e.clientY;
      longFired = false;
      const w = getWin();
      if (w) w.classList.add('sp-press');
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        longFired = true;
        clearPress();
        if (navigator.vibrate) navigator.vibrate(12);
        toggle(true);
      }, HOLD_MS);
    });
    mini.addEventListener('pointermove', e => {
      if (pressTimer && Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_TOL) clearPress();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(t => mini.addEventListener(t, clearPress));
    mini.addEventListener('contextmenu', e => e.preventDefault());
    mini.addEventListener('click', () => { if (!longFired) toggle(true); });

    /* chạm ra ngoài thì thu lại (chỉ xử lý khi đang mở) */
    const outside = e => {
      if (!body.isConnected) return cleanup();
      const w = getWin();
      if (w && w.classList.contains('sp-open') && !w.contains(e.target)) toggle(false);
    };

    /* dọn dẹp khi đóng widget: gỡ listener và hủy player để nhạc dừng */
    const cleanup = () => {
      dead = true;
      gen++;
      mq.removeEventListener('change', onMq);
      document.removeEventListener('pointerdown', outside, true);
      stopCtrl();
      stopDesk();
    };
    document.addEventListener('pointerdown', outside, true);
  }

  /* ---------- ĐĂNG KÝ ---------- */
  const reg = (window.WMApps = window.WMApps || {});
  reg.spotify = {
    title: 'Spotify', w: 340, h: 162, cls: 'is-spotify', build: buildSpotify,
    place: (m, W) => ({ left: Math.max(8, m.cw - W - 18), top: 10 })     // ghim góc phải trên, ngay dưới menubar
  };
})();