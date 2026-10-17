/* =========================================================
   js/portfolio.js: tương tác nhỏ cho portfolio.html
   - Thanh trên: đổ bóng khi cuộn
   - Menu: tô mục của phần đang xem
   - Hỏi đáp: mở một câu thì các câu khác tự đóng
========================================================= */
(() => {
  const bar = document.querySelector('.bar');
  const links = [...document.querySelectorAll('.bar nav a[href^="#"]')];
  const details = [...document.querySelectorAll('details')];

  const hero = document.querySelector('.hero');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Cuộn trang: đổ bóng thanh trên + độ mờ tiêu đề hero. Gom theo khung hình, không đọc layout lúc cuộn */
  const tl = document.querySelector('.tl');
  const tlItems = tl ? [...tl.querySelectorAll('li')] : [];   // các mốc, để bật chấm xanh khi đường kẻ chạy tới
  const rail = document.querySelector('.rail');
  let heroH = hero ? hero.offsetHeight || 1 : 1, ticking = false, lastP = -1;
  let tlTop = 0, tlH = 1, lastJ = -1;   // vị trí và chiều cao timeline, đo sẵn để lúc cuộn không đọc layout
  let maxScroll = 1, lastS = -1;        // tổng quãng cuộn của trang, đo sẵn cho thanh bên phải
  const measureHero = () => {
    if (hero) heroH = hero.offsetHeight || 1;
    if (tl) { const r = tl.getBoundingClientRect(); tlTop = r.top + window.scrollY; tlH = r.height || 1; }
    maxScroll = Math.max(1, document.documentElement.scrollHeight - innerHeight);
  };
  const update = () => {
    ticking = false;
    const y = window.scrollY;
    if (bar) bar.classList.toggle('scrolled', y > 8);
    if (hero && !reduce) {
      const p = Math.min(1, Math.max(0, y / heroH));
      if (p !== lastP) { lastP = p; hero.style.setProperty('--p', p.toFixed(3)); }
    }
    if (tl) {   // đường kẻ timeline chạy dần; mốc nào đường kẻ đã chạm tới thì chấm sáng lên
      const j = reduce ? 1 : Math.min(1, Math.max(0, (y + innerHeight * 0.8 - tlTop) / (innerHeight * 0.6)));
      if (j !== lastJ) {
        lastJ = j;
        tl.style.setProperty('--j', j.toFixed(3));
        tlItems.forEach((li, i) => li.classList.toggle('on', i === 0 ? j > 0 : j >= i / tlItems.length));
      }
    }
    if (rail) {   // thanh bên phải: hiện khi bắt đầu cuộn, đầy dần đến cuối trang
      rail.classList.toggle('on', y > 8);
      const s = Math.min(1, y / maxScroll);
      if (s !== lastS) { lastS = s; rail.style.setProperty('--s', s.toFixed(3)); }
    }
  };
  const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
  measureHero();   // đo trước khi chạy update lần đầu
  update();
  addEventListener('scroll', onScroll, { passive: true });
  addEventListener('resize', measureHero);
  addEventListener('load', measureHero);

  /* Tô mục menu theo phần đang nằm giữa màn hình */
  const targets = links
    .map(a => document.querySelector(a.getAttribute('href')))
    .filter(Boolean);

  if ('IntersectionObserver' in window && targets.length) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => {
          const on = a.getAttribute('href') === '#' + e.target.id;
          if (on) a.setAttribute('aria-current', 'true');
          else a.removeAttribute('aria-current');
        });
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(t => io.observe(t));
  }
 
  /* Hero: ảnh hiện ra đúng trên đường chuột. Cả vòng đời là MỘT đường cong liền (lớn êm → đỉnh → thu êm) */
  const trail = document.querySelector('.trail');
  if (hero && trail && !reduce) {
    document.body.appendChild(trail);   // lớp phủ toàn màn hình: ô nổi trên cả menu, không bị cắt ở mép hero
    const SRC = [/* 'assets/portfolio/1.jpg', 'assets/portfolio/2.jpg' */];
    const PALETTE = [   // màu thay thế khi chưa có ảnh (SRC trống), xếp xen kẽ để hai ô liền nhau luôn khác tông
      'linear-gradient(135deg,#4a90e2,#2d5fc4)', 'linear-gradient(135deg,#ffd84d,#ffb300)',
      '#0b0b0d',                                 'linear-gradient(135deg,#ff4fd8,#c026d3)',
      'linear-gradient(135deg,#5cc34a,#2f9a2b)', 'linear-gradient(135deg,#ff8a5b,#ff5f3a)',
      'linear-gradient(135deg,#2fd0ff,#18a0ff)', 'linear-gradient(135deg,#ff5f7a,#e0264a)',
      'linear-gradient(135deg,#d9d9de,#6b6b73)', 'linear-gradient(135deg,#a78bfa,#6d3fe0)',
      'linear-gradient(135deg,#ffb08a,#ff8a5b)', 'linear-gradient(135deg,#34e0b4,#0fa37f)',
      'linear-gradient(135deg,#f5f5f7,#c9cad0)', 'linear-gradient(135deg,#ff9ed2,#ff5fa8)',
      'linear-gradient(135deg,#1e2a78,#0b1240)', 'linear-gradient(135deg,#c6f24a,#8cc219)'
    ];
    const DMIN = 760;       // đời ngắn nhất của một ô (ms), khi lướt rất nhanh (trước là 420 nên bị nhanh gấp đôi)
    const DMAX = 1250;      // đời dài nhất của một ô (ms), khi lướt chậm
    const TRAIL = 9;        // số ô muốn thấy cùng lúc trên đường chuột: lớn hơn → dải nhỏ → lớn dài hơn
    const RISE = 1.2;       // lớn hơn → đỉnh đến muộn hơn (1.0 = đỉnh ở giữa, 1.2 ≈ 56%)
    const SOFT = 1.5;       // lớn hơn → lúc bắt đầu và kết thúc êm hơn
    const COUNT = SRC.length || PALETTE.length;
    const POOL = COUNT * Math.ceil(28 / COUNT);   // ~28 ô dùng luân phiên, đủ cho cả khi lướt rất nhanh
    const rand = (a, b) => a + Math.random() * (b - a);

    /* Đường cong dạng chuông, lấy mẫu dày: không có chỗ nối giữa lúc lớn và lúc thu, tốc độ đổi chiều ở đỉnh liền mạch */
    const STEPS = 72;       // lấy mẫu dày hơn nên đường cong không bị gợn khi ô to
    const BELL = Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = i / STEPS;
      const s = Math.pow(Math.max(0, Math.sin(Math.PI * Math.pow(t, RISE))), SOFT);
      return { transform: `scale(${s.toFixed(4)})`, offset: t };
    });

    /* Tải và giải mã trước để ảnh hiện không khựng */
    SRC.forEach(src => {
      const im = new Image();
      im.src = src;
      if (im.decode) im.decode().catch(() => {});
    });

    /* Lớp ngoài .pop giữ vị trí, lớp trong <i> chạy phóng to: hai việc chạy độc lập trên GPU */
    const cells = Array.from({ length: POOL }, (_, i) => {
      const w = document.createElement('div');
      const c = document.createElement('i');
      w.className = 'pop';
      c.style.background = SRC.length ? `url(${SRC[i % COUNT]}) center/cover` : PALETTE[i % COUNT];
      w.appendChild(c);
      trail.appendChild(w);
      return { w, c, a: null };
    });

    /* S: cỡ đỉnh chung của mọi ô, chỉ đo khi tải và khi đổi cỡ cửa sổ */
    let S = 165;
    const measure = () => {
      S = Math.round(Math.min(180, Math.max(120, hero.clientWidth * 0.086)));
      cells.forEach(({ w }) => { w.style.width = w.style.height = S + 'px'; });
    };
    measure();
    addEventListener('resize', measure);
    addEventListener('load', measure);

    let n = 0, speed = 0, lx = -1e9, ly = -1e9;   // speed: tốc độ chuột (px/ms), đã làm mượt; lx, ly: điểm ô gần nhất
    const spawn = (x, y, age = 0) => {
      if (Math.hypot(x - lx, y - ly) < S * 0.45) return;   // quá gần ô trước thì bỏ, không cho chồng cùng tâm
      lx = x; ly = y;

      const k = n++;
      const cell = cells[k % POOL];   // luôn là ô cũ nhất, gần như đã tan nên cắt đi không thấy
      if (cell.a) cell.a.cancel();

      cell.w.style.zIndex = k % 100000;   // ô mới luôn nằm trên ô cũ
      cell.w.style.transform = `translate3d(${(x - S / 2).toFixed(1)}px,${(y - S / 2).toFixed(1)}px,0)`;   // tâm ô nằm đúng trên chuột

      /* Đời ô co giãn theo tốc độ: lướt nhanh đời ngắn, lướt chậm đời dài → luôn có khoảng TRAIL ô ở các cỡ khác nhau */
      const dur = speed ? Math.min(DMAX, Math.max(DMIN, TRAIL * S * 1.1 / speed)) : DMAX;
      cell.a = cell.c.animate(BELL, { duration: dur, fill: 'backwards' });
      cell.a.currentTime = Math.min(Number.isFinite(age) ? age : 0, dur * 0.3);   // tối đa 30% đời: ô luôn bắt đầu từ nhỏ
    };

    /* Khoảng cách giữa hai tâm ô: phần lớn sát nhau, thỉnh thoảng có một chỗ hở */
    const nextGap = () => S * (Math.random() < .15 ? rand(1.4, 1.75) : rand(.95, 1.25));
    let px = null, py = null, pt = 0, need = nextGap();
    const move = (x, y, t) => {
      if (px === null) { px = x; py = y; pt = t; spawn(x, y); return; }
      const dx = x - px, dy = y - py, d = Math.hypot(dx, dy);
      if (!d) return;
      const dt = Math.min(48, Math.max(1, t - pt)) || 16;   // chặn trần: dừng chuột lâu rồi lướt lại không làm ô "già" đột ngột
      speed = speed ? speed * .8 + (d / dt) * .2 : d / dt;   // làm mượt tốc độ để đời ô không giật cục
      const ux = dx / d, uy = dy / d;
      let covered = 0, k = 0;
      while (covered + need <= d && k++ < 8) {   // lướt nhanh vẫn rải đủ ô trên đường đi
        covered += need;
        spawn(px + ux * covered, py + uy * covered, (1 - covered / d) * dt);   // tuổi = thời gian từ lúc chuột đi qua điểm đó
        need = nextGap();
      }
      need -= d - covered;
      if (need <= 0) need = nextGap();
      px = x; py = y; pt = t;
    };

    /* Gom vị trí chuột, xử lý đúng nhịp khung hình */
    let mx = 0, my = 0, pending = false;
    const tick = t => { pending = false; move(mx, my, t); };   // t: mốc thời gian của khung hình
    /* Vùng chạy hiệu ứng: hero và mọi phần tử có data-trail (từ About đến hết trang). Chung một đường chuột nên chuyển vùng vẫn liền mạch */
    const onMove = e => {
      if (e.pointerType !== 'mouse') return;
      mx = e.clientX;
      my = e.clientY;
      if (!pending) { pending = true; requestAnimationFrame(tick); }
    };
    const onLeave = () => { px = py = null; need = nextGap(); speed = 0; lx = ly = -1e9; };
    const onDown = e => spawn(e.clientX, e.clientY);
    [hero, ...document.querySelectorAll('[data-trail]')].forEach(z => {
      z.addEventListener('pointermove', onMove);
      z.addEventListener('pointerleave', onLeave);
      z.addEventListener('pointerdown', onDown);
    });
  }
  /* Hỏi đáp: chỉ giữ một câu mở */
  details.forEach(d => {
    d.addEventListener('toggle', () => {
      if (!d.open) return;
      details.forEach(o => { if (o !== d) o.open = false; });
    });
  });

    /* Selected work: thẻ xếp chồng. Thẻ i bị thẻ i+1 đè dần thì --k đi từ 0 đến 1 (thu nhỏ + tối dần) */
  const stack = document.querySelector('.stack');
  const cards = stack ? [...stack.querySelectorAll('.card')] : [];
  if (cards.length) {
    const desk = matchMedia('(min-width: 861px)');
    let sTop = 0, sH = 1, sGap = 0, sticks = [], lastK = [], sTick = false;
    const FADE = .8;     // thẻ bị đè nhạt đi tối đa bao nhiêu (0 = không nhạt, 1 = biến mất hẳn)
    const SHRINK = .06;  // thẻ bị đè thu nhỏ tối đa bao nhiêu
    const measureStack = () => {
      sTop = stack.getBoundingClientRect().top + window.scrollY;
      sH = cards[0].offsetHeight || 1;
      sGap = cards[1] ? parseFloat(getComputedStyle(cards[1]).marginTop) || 0 : 0;
      sticks = cards.map(c => parseFloat(getComputedStyle(c).top) || 0);   // vị trí dính của từng thẻ, lấy thẳng từ CSS
    };
    const paintStack = () => {
      sTick = false;
      const y = window.scrollY;
      cards.forEach((c, i) => {
        let k = 0;
        if (!reduce && desk.matches && i < cards.length - 1) {
          const nextTop = sTop + (i + 1) * (sH + sGap) - y;   // vị trí thẻ kế tiếp nếu chưa dính
          k = Math.min(1, Math.max(0, (sticks[i] + sH - nextTop) / (sH - (sticks[i + 1] - sticks[i]))));
        }
        k = Math.round(k * 500) / 500;   // làm tròn để bỏ qua thay đổi quá nhỏ, đỡ vẽ lại
        if (k !== lastK[i]) {
          lastK[i] = k;
          c.style.transform = k ? `scale(${(1 - k * SHRINK).toFixed(4)})` : '';
          c.style.opacity = k ? (1 - k * FADE).toFixed(3) : '';   // nhạt dần để lộ nền trang phía sau
        }
      });
    };
    const onStack = () => { if (!sTick) { sTick = true; requestAnimationFrame(paintStack); } };
    const remeasure = () => { measureStack(); onStack(); };
    measureStack();
    paintStack();
    addEventListener('scroll', onStack, { passive: true });
    addEventListener('resize', remeasure);
    addEventListener('load', remeasure);
  }

  /* Additional work: nhãn "View Work" đi theo con trỏ trên ảnh. Chỉ đọc vị trí một lần mỗi khung hình */
  if (!reduce && matchMedia('(hover: hover)').matches) {
    document.querySelectorAll('.t .th').forEach(th => {
      const pill = th.querySelector('.pill');
      if (!pill) return;
      let cx = 0, cy = 0, queued = false;
      const paint = () => {
        queued = false;
        const r = th.getBoundingClientRect();
        pill.style.transform = `translate3d(${(cx - r.left).toFixed(1)}px,${(cy - r.top).toFixed(1)}px,0) translate(-50%,-50%)`;
      };
      th.addEventListener('pointermove', e => {
        cx = e.clientX; cy = e.clientY;
        if (!queued) { queued = true; requestAnimationFrame(paint); }
      });
    });
  }

  /* Practice: đỉnh cong dẹt dần thành đường thẳng khi cuộn tới; mục lục bên trái sáng theo thẻ đang xem */
  const dark = document.querySelector('.dark');
  if (dark) {
    const mkArc = cls => {
      const el = document.createElement('div');
      el.className = cls;
      el.setAttribute('aria-hidden', 'true');
      dark.appendChild(el);
      return el;
    };
    const arc = mkArc('arc'), arcB = mkArc('arc-b');   // arc: đỉnh cong; arcB: đáy cong
    let dTop = 0, dBot = 0, lastR = -1, lastB = -1, dTick = false;
    const measureDark = () => {
      dTop = dark.getBoundingClientRect().top + window.scrollY;
      dBot = dTop + dark.offsetHeight;
    };
    const flat = pos => {   // pos: vị trí một mép của phần tối so với đỉnh màn hình
      const from = innerHeight * .95, to = innerHeight * .2;   // còn sát đáy màn hình: cong hết cỡ; lên gần đỉnh: thẳng hẳn
      return reduce ? 1 : Math.round(Math.min(1, Math.max(0, (pos - to) / (from - to))) * 500) / 500;
    };
    const paintDark = () => {
      dTick = false;
      const y = window.scrollY;
      const r = flat(dTop - y), b = flat(dBot - y);
      if (r !== lastR) { lastR = r; arc.style.transform = `scaleY(${r})`; }
      if (b !== lastB) { lastB = b; arcB.style.transform = `scaleY(${b})`; }
    };
    const onDark = () => { if (!dTick) { dTick = true; requestAnimationFrame(paintDark); } };
    const remDark = () => { measureDark(); onDark(); };
    measureDark();
    paintDark();
    addEventListener('scroll', onDark, { passive: true });
    addEventListener('resize', remDark);
    addEventListener('load', remDark);

    const pn = [...document.querySelectorAll('.pr-nav a')];
    const pcs = pn.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
    if ('IntersectionObserver' in window && pcs.length) {
      const io2 = new IntersectionObserver(entries => {
        entries.forEach(e => {
          if (!e.isIntersecting) return;
          pn.forEach(a => {
            if (a.getAttribute('href') === '#' + e.target.id) a.setAttribute('aria-current', 'true');
            else a.removeAttribute('aria-current');
          });
        });
      }, { rootMargin: '-40% 0px -50% 0px' });
      pcs.forEach(c => io2.observe(c));
    }
  }
})();