/* =========================================================
   js/trail.js: ô vuông chạy theo chuột, NHỎ → LỚN theo thứ tự lướt
   - Chạy trong .hero và mọi vùng có thuộc tính data-trail (nạp dùng chung .trail / .pop trong css/portfolio.css)
   - Ô đầu của một lần lướt nhỏ nhất, mỗi ô sau lớn dần tới MAX; dừng chuột là bắt đầu lại từ ô nhỏ
   - Mượt trên iOS / Safari: chỉ đổi transform + opacity (chạy bằng GPU), dùng sẵn một bể ô (không tạo / xoá DOM khi lướt),
     không đọc kích thước trong lúc lướt, listener passive. Tắt trên màn hình cảm ứng và khi bật "giảm chuyển động"
========================================================= */
(() => {
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!Element.prototype.animate) return;

  /* ---------- Chỉnh ở đây ---------- */
  const MIN = 18;      // px: cỡ ô đầu tiên
  const MAX = 130;     // px: cỡ lớn nhất
  const STEPS = 14;    // số ô để lớn dần từ MIN tới MAX
  const GAP = 56;      // px: khoảng cách tối thiểu giữa 2 ô
  const SPREAD = 1.1;  // khoảng cách tới ô sau = cỡ ô hiện tại × số này (ô càng to càng thưa, không chồng dày)
  const IDLE = 320;    // ms dừng chuột thì lần lướt sau bắt đầu lại từ ô nhỏ
  const LIFE = 1100;   // ms: thời gian sống của mỗi ô
  const POOL = 14;     // số ô dùng lại luân phiên
  const COLORS = [     // cặp màu gradient (trên → dưới)
    ['#ff9ccc', '#ff4fa3'], ['#ffd84d', '#ffb400'], ['#1a1a20', '#07070a'],
    ['#ff5fe0', '#c126d6'], ['#62c84f', '#2a9a2a'], ['#4f9be8', '#2a5fc4'], ['#c4ec34', '#8fc400']
  ];
  const ZONE = '.hero, [data-trail]';

  let host = document.querySelector('.trail');
  if (!host) {
    host = document.createElement('div');
    host.className = 'trail';
    host.setAttribute('aria-hidden', 'true');
    document.body.append(host);
  }

  const pool = [];
  let next = 0, k = 0, dist = 0, need = 56, lx = 0, ly = 0, lt = 0, last = -1, live = false;

  const build = () => {
    for (let n = 0; n < POOL; n++) {
      const p = document.createElement('div');
      const i = document.createElement('i');
      p.className = 'pop';
      p.append(i);
      host.append(p);
      pool.push({ p, i, a: null });
    }
  };

  const spawn = (x, y) => {
    if (!pool.length) build();

    // cỡ tăng dần theo thứ tự, đường cong mềm (smoothstep) để ô đầu nhỏ rõ và ô cuối không tăng đột ngột
    const t = Math.min(k / (STEPS - 1), 1);
    const s = Math.round(MIN + (MAX - MIN) * t * t * (3 - 2 * t));
    k++;
    need = Math.max(GAP, s * SPREAD);

    const item = pool[next];
    next = (next + 1) % POOL;
    if (item.a) item.a.cancel();

    item.p.style.width = item.p.style.height = s + 'px';
    item.p.style.transform = 'translate3d(' + (x - s / 2) + 'px,' + (y - s / 2) + 'px,0)';

    let c;
    do { c = (Math.random() * COLORS.length) | 0; } while (c === last);
    last = c;
    item.i.style.background = 'linear-gradient(135deg,' + COLORS[c][0] + ',' + COLORS[c][1] + ')';

    // phóng từ 0 lên đúng cỡ → giữ → thu lại và mờ đi
    item.a = item.i.animate([
      { transform: 'scale(0)', opacity: 1, easing: 'cubic-bezier(.2,.9,.25,1)' },
      { transform: 'scale(1)', opacity: 1, offset: .22 },
      { transform: 'scale(1)', opacity: 1, offset: .7, easing: 'ease-in' },
      { transform: 'scale(.8)', opacity: 0 }
    ], { duration: LIFE });
  };

  addEventListener('pointermove', e => {
    if (e.pointerType !== 'mouse') return;

    const zone = e.target instanceof Element && e.target.closest(ZONE);
    if (!zone) { live = false; return; }

    const now = performance.now();
    if (!live || now - lt > IDLE) {          // lần lướt mới: về ô nhỏ nhất và đặt ô đầu ngay
      k = 0;
      dist = GAP;
    } else {
      dist += Math.hypot(e.clientX - lx, e.clientY - ly);
    }
    lx = e.clientX;
    ly = e.clientY;
    lt = now;
    live = true;

    if (dist < need) return;
    dist = 0;
    spawn(lx, ly);
  }, { passive: true });

  document.addEventListener('pointerleave', () => { live = false; });
})();