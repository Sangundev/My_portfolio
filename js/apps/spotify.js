(() => {
  'use strict';

  /* ---------- DỮ LIỆU (sửa ở đây) ---------- */
  const PLAYLIST = {
    name: 'Grey D',
    owner: 'Sang',
    id: '6qInSAmUkoFbwVotBcoRIG',
    cover: 'https://i.scdn.co/image/ab67616d0000b27369faf03203d8984af9ff03d3'
  };

  /* Chỉ cần dán ID bài. Muốn tự đặt tên thì dùng { id, title, artist, cover } */
  const TRACKS = [
    '6piRVMiebMCZii8GPoLBwS',
  ];

  const ITEMS = TRACKS.length
    ? TRACKS.map(t => {
        t = typeof t === 'string' ? { id: t } : t;
        return {
          uri: 'spotify:track:' + t.id,
          title: t.title || 'Đang tải…',
          artist: t.artist || PLAYLIST.name,
          cover: t.cover || PLAYLIST.cover,
          auto: !t.title
        };
      })
    : [{ uri: 'spotify:playlist:' + PLAYLIST.id, title: PLAYLIST.name, artist: PLAYLIST.owner, cover: PLAYLIST.cover }];
  const SINGLE = ITEMS.length < 2;

  const MOBILE_Q = '(max-width: 1024px)';
  const HOLD_MS = 350, MOVE_TOL = 10, END_GAP = 400;

  const EQ = '<span class="sp-eq"><i></i><i></i><i></i><i></i><i></i></span>';
  const CARD = `
    <div class="sp-card">
      <div class="sp-top">
        <img class="sp-art" alt="" draggable="false">
        <div class="sp-info"><div class="sp-title"></div><div class="sp-artist"></div></div>
        ${EQ}
      </div>
      <div class="sp-time"><span class="sp-cur">0:00</span><div class="sp-track"><i></i></div><span class="sp-rem">-0:00</span></div>
      <div class="sp-ctrl">
        <button class="sp-btn sp-prev" aria-label="Bài trước"><svg viewBox="0 0 24 24"><path d="M11 6v12L2.5 12 11 6zm10.5 0v12L13 12l8.5-6z"/></svg></button>
        <button class="sp-btn sp-play" aria-label="Phát / tạm dừng">
          <svg class="ic-play" viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>
          <svg class="ic-pause" viewBox="0 0 24 24"><path d="M6 4h4v16H6zM14 4h4v16h-4z"/></svg>
        </button>
        <button class="sp-btn sp-next" aria-label="Bài sau"><svg viewBox="0 0 24 24"><path d="M13 6v12l8.5-6L13 6zM2.5 6v12L11 12 2.5 6z"/></svg></button>
      </div>
    </div>`;

  /* ---------- NẠP SPOTIFY iFRAME API ---------- */
  let spApi = null, apiLoading = false;
  const apiQueue = [];
  function withApi(cb) {
    if (spApi) return cb(spApi);
    apiQueue.push(cb);
    if (apiLoading) return;
    apiLoading = true;
    window.onSpotifyIframeApiReady = a => { spApi = a; apiQueue.splice(0).forEach(f => f(a)); };
    const s = document.createElement('script');
    s.src = 'https://open.spotify.com/embed/iframe-api/v1';
    s.async = true;
    s.onerror = () => { apiLoading = false; apiQueue.length = 0; s.remove(); };
    document.head.append(s);
  }

  const fmt = ms => {
    const s = Math.max(0, Math.floor(ms / 1000));
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  };

  /* ---------- WIDGET ---------- */
  function buildSpotify(body, _title, api) {
    body.classList.add('flush');

    /* (1) TAB: nội dung của cửa sổ. Desktop = player gốc; mobile = thẻ iOS đầy đủ */
    const root = api.h('div', 'sp win-drag');
    root.addEventListener('dblclick', e => e.stopPropagation());
    root.innerHTML = '<div class="sp-desk"></div>' + CARD;
    body.append(root);

    /* (2) ĐẢO: phần tử riêng gắn vào body, KHÔNG phụ thuộc cửa sổ -> luôn ghim trên đỉnh */
    const island = document.createElement('div');
    island.className = 'sp sp-island';
    island.innerHTML = `<div class="sp-mini"><img alt="" draggable="false">${EQ}</div><div class="sp-host"></div>` + CARD;

    const bind = el => {
      const q = s => el.querySelector(s);
      return {
        el, title: q('.sp-title'), artist: q('.sp-artist'), art: q('.sp-art'), mini: q('.sp-mini img'),
        cur: q('.sp-cur'), rem: q('.sp-rem'), bar: q('.sp-track i'),
        prev: q('.sp-prev'), next: q('.sp-next'), play: q('.sp-play')
      };
    };
    const views = [bind(root), bind(island)];
    const desk = root.querySelector('.sp-desk');
    const host = island.querySelector('.sp-host');
    const mini = island.querySelector('.sp-mini');

    const mq = window.matchMedia(MOBILE_Q);
    let idx = 0, ctrl = null, ended = false, wantPlay = false;
    let dead = false, gen = 0, mode = null, lastCur = -1;

    /* ----- dọn dẹp: tab bị đóng (gỡ khỏi DOM) -> bỏ đảo, dừng nhạc ----- */
    const cleanup = () => {
      if (dead) return;
      dead = true;
      gen++;
      clearInterval(watch);
      mq.removeEventListener('change', onMq);
      document.removeEventListener('pointerdown', outside, true);
      stopCtrl();
      stopDesk();
      island.remove();
    };
    const alive = () => {
      if (dead) return false;
      if (!body.isConnected) { cleanup(); return false; }
      return true;
    };
    const watch = setInterval(alive, 800);   // đóng tab từ màn hình app switcher cũng bắt được

    /* ----- hiển thị bài hiện tại ----- */
    const show = () => {
      const it = ITEMS[idx];
      views.forEach(v => {
        v.title.textContent = it.title;
        v.artist.textContent = it.artist;
        v.art.src = it.cover || '';
        if (v.mini) v.mini.src = it.cover || '';
        v.bar.style.transform = 'scaleX(0)';
        v.cur.textContent = '0:00';
        v.rem.textContent = '-0:00';
      });
      lastCur = -1;
    };
    show();

    /* tự lấy tên bài + ảnh bìa từ Spotify oEmbed */
    ITEMS.forEach((it, i) => {
      if (!it.auto) return;
      const url = 'https://open.spotify.com/track/' + it.uri.split(':')[2];
      fetch('https://open.spotify.com/oembed?url=' + encodeURIComponent(url))
        .then(r => r.json())
        .then(j => {
          if (dead) return;
          if (j.title) it.title = j.title;
          if (j.thumbnail_url) it.cover = j.thumbnail_url;
          if (i === idx) show();
        })
        .catch(() => {});
    });

    const go = (n, autoplay) => {
      idx = (n + ITEMS.length) % ITEMS.length;
      ended = false;
      show();
      if (!ctrl) { wantPlay = autoplay; return; }
      ctrl.loadUri(ITEMS[idx].uri);
      if (autoplay) ctrl.play();
    };

    views.forEach(v => {
      v.prev.disabled = v.next.disabled = SINGLE;
      v.prev.addEventListener('click', () => go(idx - 1, true));
      v.next.addEventListener('click', () => go(idx + 1, true));
      v.play.addEventListener('click', () => { ctrl ? ctrl.togglePlay() : (wantPlay = true); });
      [v.prev, v.next, v.play].forEach(b => b.addEventListener('pointerdown', e => e.stopPropagation()));
    });

    /* ----- desktop: player gốc trong tab ----- */
    const startDesk = () => {
      if (desk.firstChild) return;
      const frame = document.createElement('iframe');
      frame.src = `https://open.spotify.com/embed/playlist/${PLAYLIST.id}?utm_source=generator&theme=0`;
      frame.title = 'Spotify playlist';
      frame.height = '152';
      frame.setAttribute('frameborder', '0');
      frame.setAttribute('loading', 'lazy');
      frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture';
      frame.addEventListener('pointerdown', e => e.stopPropagation());
      desk.append(frame);
    };
    const stopDesk = () => { desk.textContent = ''; };

    /* ----- mobile: player ngầm nằm trong ĐẢO (không bị ẩn khi đổi app) ----- */
    const stopCtrl = () => {
      if (ctrl) { try { ctrl.destroy(); } catch (_) {} ctrl = null; }
      host.textContent = '';
      views.forEach(v => v.el.classList.remove('playing'));
    };

    const onPlayback = e => {
      if (!alive()) return;
      const d = e.data || {};
      const playing = !d.isPaused && !d.isBuffering;
      views.forEach(v => v.el.classList.toggle('playing', playing));
      if (!(d.duration > 0)) return;

      const scale = `scaleX(${Math.min(1, d.position / d.duration)})`;
      views.forEach(v => { v.bar.style.transform = scale; });
      const sec = Math.floor(d.position / 1000);
      if (sec !== lastCur) {
        lastCur = sec;
        views.forEach(v => {
          v.cur.textContent = fmt(d.position);
          v.rem.textContent = '-' + fmt(d.duration - d.position);
        });
      }
      if (SINGLE) return;
      if (d.position < d.duration - 1500) ended = false;
      else if (!ended && d.position >= d.duration - END_GAP) { ended = true; go(idx + 1, true); }
    };

    const startCtrl = () => {
      const my = ++gen;
      host.innerHTML = '<div class="sp-slot"></div>';
      withApi(IFrameAPI => {
        if (dead || my !== gen || !body.isConnected) return;
        IFrameAPI.createController(host.firstChild, { uri: ITEMS[idx].uri, width: 300, height: 80 }, c => {
          if (dead || my !== gen) { try { c.destroy(); } catch (_) {} return; }
          ctrl = c;
          c.addListener('playback_update', onPlayback);
          if (wantPlay) { wantPlay = false; c.play(); }
        });
      });
    };

    const setMode = () => {
      const m = mq.matches ? 'mobile' : 'desktop';
      if (m === mode) return;
      mode = m;
      if (m === 'mobile') {
        stopDesk();
        document.body.append(island);
        idx = 0;
        ended = false;
        show();
        wantPlay = true;   // controller tạo xong sẽ tự phát bài đầu
        startCtrl();
      } else {
        gen++;
        stopCtrl();
        toggle(false);
        island.remove();
        startDesk();
      }
    };

    /* ----- mở / thu đảo ----- */
    function outside(e) {
      if (!alive()) return;
      if (!island.contains(e.target)) toggle(false);
    }
    function toggle(open) {
      island.classList.toggle('sp-open', open);
      island.classList.remove('sp-press');
      document.removeEventListener('pointerdown', outside, true);
      if (open) document.addEventListener('pointerdown', outside, true);
    }
    function onMq() {
      if (!alive()) return;
      setMode();
    }

    mq.addEventListener('change', onMq);
    setMode();

    /* Chạm nhanh HOẶC đè lâu trên viên thuốc -> bung thẻ */
    let pressTimer = 0, startX = 0, startY = 0, longFired = false;
    const clearPress = () => {
      clearTimeout(pressTimer);
      pressTimer = 0;
      island.classList.remove('sp-press');
    };
    mini.addEventListener('pointerdown', e => {
      e.stopPropagation();
      startX = e.clientX; startY = e.clientY;
      longFired = false;
      island.classList.add('sp-press');
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
  }

  /* ---------- ĐĂNG KÝ ---------- */
  const reg = (window.WMApps = window.WMApps || {});
  reg.spotify = {
    title: 'Spotify', w: 340, h: 162, cls: 'is-spotify', build: buildSpotify,
    place: (m, W) => ({ left: Math.max(8, m.cw - W - 18), top: 10 })
  };
})();