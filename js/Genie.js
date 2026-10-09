/* =========================================================
   js/genie.js: hiệu ứng Genie của macOS (chạy bằng GPU, không tính toán mỗi khung hình)
   - Cửa sổ được chia thành các dải ngang. Mỗi dải được bẻ thành hình thang
     (matrix3d), hai dải kề nhau dùng chung cạnh => mép cửa sổ là đường cong liền.
   - Genie.run(el, dir, pt, done)
       el   : phần tử cửa sổ (.win)
       dir  : 'in'  = hút vào icon (thu nhỏ, đóng)
              'out' = bung ra từ icon (mở, khôi phục)
       pt   : { x, y, w, el? } tâm icon trên màn hình + bề ngang icon (px).
              el (tuỳ chọn): phần tử icon; nếu nằm trong #dock thì cửa sổ chỉ hiện phía trên mép icon.
       done : gọi khi chạy xong (luôn bất đồng bộ)
   - Cửa sổ thật phải được ẩn bởi người gọi trong lúc chạy (xem window-manager.js)
   - Yêu cầu CSS: .gn-s { position:absolute; left:0; top:0; transform-origin:0 0; overflow:hidden; will-change:transform }
                  .gn-clone phải có kích thước rõ ràng (width/height lấy từ --gw / --gh)

   CÁCH CHẠY (để mượt như iOS):
   1. Tính SẴN toàn bộ khung hình (keyframes matrix3d) ngay từ đầu.
   2. Giao cho Web Animations API chạy: transform + opacity được trình duyệt
      chạy thẳng trên luồng compositor (GPU). Trong lúc chạy, JavaScript KHÔNG làm gì,
      nên dù luồng chính có bận (đóng cửa sổ, cập nhật dock...) hiệu ứng vẫn mượt.
   3. Animation được tạo ở trạng thái tạm dừng, chờ 3 khung hình cho các lớp dựng xong
      rồi mới phát => không bị mất đoạn đầu.
   4. Bản sao được làm nhẹ (bỏ backdrop-filter, animation, shadow) và số dải tự giảm
      theo độ nặng của cửa sổ.
   5. Máy không hỗ trợ element.animate: tự dùng vòng requestAnimationFrame với cùng dữ liệu.
========================================================= */
(() => {
  /* ---------- CẤU HÌNH (chỉnh ở đây) ---------- */
  const SLOT_LAG = 0.45;                       // độ trễ giữa dải đáy (đi trước) và dải đỉnh (đi sau)
  const DUR = { in: 520, out: 460 };           // ms
  const EXTRA = 0.8;                           // px chồng giữa các dải để không hở đường chỉ
  const KEYFRAMES = 36;                        // số khung tính sẵn (nhiều hơn = chuyển động chính xác hơn)
  const MIN_STRIPS = 8;                        // ít nhất bao nhiêu dải
  const MAX_STRIPS = 12;                       // nhiều nhất khi cửa sổ nhẹ (tăng lên ~20-24 nếu muốn đường cong mịn hơn)
  const MAX_STRIPS_BUSY = 8;                   // khi nhiều Genie chạy cùng lúc
  const NODE_BUDGET = 2500;                    // tổng số node DOM được phép nhân bản (N dải x số node cửa sổ)
  const UNDER_DOCK = false;                    // true = cửa sổ chui xuống dưới dock (đẹp hơn nhưng dock phải làm mờ lại mỗi khung => giật)
  const MIN_STRIP_PX = 18;                     // mỗi dải cao tối thiểu (px)
  const KEEP_BLUR = false;                     // true = giữ backdrop-filter trong bản sao (đẹp hơn nhưng nặng hơn)

  let layer = null;
  let active = 0;                              // số Genie đang chạy
  let styled = false;

  /* CSS làm nhẹ bản sao: tự chèn, không cần sửa file css */
  const injectCss = () => {
    if (styled) return;
    styled = true;
    const st = document.createElement('style');
    st.textContent =
      '#genie .gn-s{contain:layout paint style;backface-visibility:hidden;transform-origin:0 0}' +
      '#genie .gn-clone,#genie .gn-clone *{animation:none!important;transition:none!important;will-change:auto!important}' +
      // không dùng contain:strict: nó ép size containment, nếu .gn-clone chưa có kích thước rõ ràng thì sập về 0x0
      '#genie .gn-clone{box-shadow:none!important;border-radius:0!important;contain:layout paint style}' +
      (KEEP_BLUR ? '' :
        '#genie .gn-clone,#genie .gn-clone *{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}');
    document.head.append(st);
  };

  const getLayer = () => {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.id = 'genie';
    document.body.append(layer);
    return layer;
  };

  // Đặt lớp hiệu ứng ngay dưới dock: cửa sổ hút vào icon sẽ chui xuống dưới dock
  const underDock = host => {
    const dock = document.getElementById('dock');
    const z = dock ? parseInt(getComputedStyle(dock).zIndex, 10) : NaN;
    if (Number.isFinite(z)) host.style.setProperty('z-index', String(z - 1), 'important');
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const later = fn => { if (fn) queueMicrotask(fn); };     // done luôn chạy SAU đoạn code gọi Genie.run
  const ease = t => 0.5 * t + 0.5 * (t * t * (3 - 2 * t)); // hơi chậm ở hai đầu cho tự nhiên

  /* Ma trận matrix3d ánh xạ hình chữ nhật (0,0)-(w,h) lên một tứ giác bất kỳ.
     p0 = trái-trên, p1 = phải-trên, p2 = phải-dưới, p3 = trái-dưới (toạ độ màn hình).
     Cần transform-origin: 0 0 trên mỗi dải. */
  function quadMatrix(w, h, p0, p1, p2, p3) {
    const dx1 = p1[0] - p2[0], dx2 = p3[0] - p2[0], dx3 = p0[0] - p1[0] + p2[0] - p3[0];
    const dy1 = p1[1] - p2[1], dy2 = p3[1] - p2[1], dy3 = p0[1] - p1[1] + p2[1] - p3[1];
    let g = 0, k = 0;
    if (dx3 || dy3) {
      const det = dx1 * dy2 - dx2 * dy1;
      if (Math.abs(det) < 1e-9) return null;
      g = (dx3 * dy2 - dx2 * dy3) / det;
      k = (dx1 * dy3 - dx3 * dy1) / det;
    }
    const a = p1[0] - p0[0] + g * p1[0], b = p1[1] - p0[1] + g * p1[1];
    const c = p3[0] - p0[0] + k * p3[0], d = p3[1] - p0[1] + k * p3[1];
    return `matrix3d(${a / w},${b / w},0,${g / w},${c / h},${d / h},0,${k / h},0,0,1,0,${p0[0]},${p0[1]},0,1)`;
  }

  // Dải bị ép phẳng: vẫn là matrix3d (để nội suy giữa các khung không bị lỗi), nhưng thu về gần 0
  const collapsed = (x, y) => `matrix3d(0.001,0,0,0,0,0.001,0,0,0,0,1,0,${x},${y},0,1)`;

  /* Chọn số dải theo độ nặng của cửa sổ */
  function stripCount(el, height) {
    const nodes = Math.max(1, el.getElementsByTagName('*').length);
    const cap = active > 1 ? MAX_STRIPS_BUSY : MAX_STRIPS;
    const byBudget = Math.floor(NODE_BUDGET / nodes);
    const byHeight = Math.floor(height / MIN_STRIP_PX);
    return clamp(Math.min(byBudget, byHeight, cap), MIN_STRIPS, Math.max(MIN_STRIPS, cap));
  }

  function run(el, dir, pt, done) {
    const r = el.getBoundingClientRect();
    const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!r.width || !r.height || document.hidden || reduce) { later(done); return; }

    // pt thiếu / sai => hút về giữa mép dưới màn hình thay vì báo lỗi
    if (!pt || !Number.isFinite(pt.x) || !Number.isFinite(pt.y)) {
      pt = { x: innerWidth / 2, y: innerHeight, w: 56 };
    }

    injectCss();
    active++;
    const host = getLayer();
    if (UNDER_DOCK) underDock(host);
    const wrap = document.createElement('div');                   // mỗi lần chạy 1 lớp riêng
    wrap.style.cssText = 'position:absolute;inset:0;pointer-events:none';
    wrap.inert = true;
    wrap.setAttribute('aria-hidden', 'true');

    const N = stripCount(el, r.height);
    const hs = r.height / N;
    const cx = r.left + r.width / 2;
    const se = clamp((pt.w || 56) / r.width, 0.01, 1);            // tỉ lệ bề ngang khi tới icon
    const rad = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0;   // bo góc đúng theo cửa sổ (widget nhạc bo lớn hơn)

    /* --- Bản chụp nhanh của cửa sổ (không phải cửa sổ thật) --- */
    const snap = el.cloneNode(true);
    ['is-min', 'gn-skip', 'gn-hide', 'is-active', 'is-closing', 'from-icon', 'anim', 'dragging', 'about-boot']
      .forEach(c => snap.classList.remove(c));
    snap.classList.add('gn-clone');
    snap.removeAttribute('role');
    snap.removeAttribute('id');
    snap.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    snap.querySelectorAll('audio, video, script').forEach(n => n.remove());
    snap.querySelectorAll('iframe').forEach(f => {
      const d = document.createElement('div');
      d.className = 'empty';
      d.textContent = 'PDF';
      f.replaceWith(d);
    });
    snap.querySelectorAll('[hidden], .rs').forEach(n => n.remove());   // tab đang ẩn, tay kéo giãn: không cần trong bản sao
    snap.querySelectorAll('img').forEach(i => {
      i.loading = 'eager';
      i.decoding = 'async';
    });
    snap.style.cssText = `--gw:${r.width}px;--gh:${r.height}px`;

    /* --- Các dải: mỗi dải là 1 bản sao, chỉ hở ra đúng phần của nó --- */
    const strips = [];
    const frag = document.createDocumentFragment();
    for (let i = 0; i < N; i++) {
      const s = document.createElement('div');
      s.className = 'gn-s';
      s.style.width = r.width + 'px';
      s.style.height = (hs + EXTRA) + 'px';
      if (rad) {                                                       // chỉ 2 dải ngoài cùng cần bo góc
        if (i === 0) s.style.borderRadius = `${rad}px ${rad}px 0 0`;
        if (i === N - 1) s.style.borderRadius = `0 0 ${rad}px ${rad}px`;
      }
      const c = i === 0 ? snap : snap.cloneNode(true);
      c.style.top = (-i * hs) + 'px';
      s.append(c);
      frag.append(s);
      strips.push(s);
    }
    wrap.append(frag);

    /* --- Tính tư thế các "đường ngang" ở tiến độ p (0 = cửa sổ nguyên, 1 = thu về icon) --- */
    const Y = new Array(N + 1), L = new Array(N + 1), R = new Array(N + 1);
    const e = EXTRA / hs;

    const pose = p => {
      for (let j = 0; j <= N; j++) {
        const v = j / N;                                          // 0 = mép trên, 1 = mép dưới
        const q = clamp((p - (1 - v) * SLOT_LAG) / (1 - SLOT_LAG), 0, 1);
        const y0 = r.top + v * r.height;
        const y = y0 + (pt.y - y0) * q * q;                       // tăng tốc về phía icon
        const x = cx + (pt.x - cx) * (q * q * (3 - 2 * q));       // lệch ngang mượt (đường cong chữ S)
        const wd = r.width * (1 + (se - 1) * (1 - (1 - q) * (1 - q)));
        Y[j] = j ? Math.max(y, Y[j - 1]) : y;                     // giữ thứ tự từ trên xuống
        L[j] = x - wd / 2; R[j] = x + wd / 2;
      }
      const m = new Array(N);
      for (let i = 0; i < N; i++) {
        const dy = Y[i + 1] - Y[i];
        const yB = Y[i + 1] + dy * e;
        const lB = L[i + 1] + (L[i + 1] - L[i]) * e;
        const rB = R[i + 1] + (R[i + 1] - R[i]) * e;
        m[i] = (dy > 0.05 &&
          quadMatrix(r.width, hs + EXTRA, [L[i], Y[i]], [R[i], Y[i]], [rB, yB], [lB, yB])) ||
          collapsed((L[i] + R[i]) / 2, Y[i]);
      }
      return { m, op: p > 0.88 ? clamp((1 - p) / 0.12, 0, 1) : 1 };   // mờ dần ở cuối
    };

    /* --- Tính sẵn toàn bộ khung hình (theo chiều thời gian thực của hiệu ứng) --- */
    const frames = [];
    for (let k = 0; k < KEYFRAMES; k++) {
      const t = ease(k / (KEYFRAMES - 1));
      frames.push(pose(dir === 'in' ? t : 1 - t));
    }

    /* --- Chạy --- */
    const dur = DUR[dir] || DUR.in;
    let finished = false;
    const anims = [];
    let safety = 0;

    const end = () => {
      if (finished) return;
      finished = true;
      clearTimeout(safety);
      anims.forEach(a => { try { a.cancel(); } catch {} });
      active = Math.max(0, active - 1);
      wrap.remove();
      later(done);
    };

    // Đặt tư thế đầu ngay (giống hệt cửa sổ thật) rồi mới hiện lên
    strips.forEach((s, i) => { s.style.transform = frames[0].m[i]; });
    wrap.style.opacity = String(frames[0].op);

    // Icon nằm trong dock => cửa sổ chỉ hiện phía TRÊN mép icon, trông như chui vào sau icon
    // (không cần hạ z-index nên dock không phải làm mờ lại mỗi khung)
    const ie = pt.el;
    if (ie && ie.isConnected && ie.closest && ie.closest('#dock')) {
      const ir = ie.getBoundingClientRect();
      if (ir.height) {
        const cut = ir.top + ir.height * 0.1;                     // chui sâu vào icon thêm 10% cho liền mạch
        wrap.style.clipPath = `inset(0 0 ${Math.max(0, document.documentElement.clientHeight - cut)}px 0)`;
      }
    }
    host.append(wrap);

    if (typeof wrap.animate === 'function') {
      // Mỗi dải 1 animation transform; cả lớp 1 animation opacity. Tất cả chạy trên compositor.
      const timing = { duration: dur, easing: 'linear', fill: 'both' };
      strips.forEach((s, i) => {
        anims.push(s.animate(
          frames.map((f, k) => ({ transform: f.m[i], offset: k / (KEYFRAMES - 1) })), timing));
      });
      const opAnim = wrap.animate(
        frames.map((f, k) => ({ opacity: f.op, offset: k / (KEYFRAMES - 1) })), timing);
      anims.push(opAnim);
      anims.forEach(a => a.pause());                              // tạm dừng, chờ các lớp dựng xong
      opAnim.onfinish = end;

      // Chờ 3 khung hình rồi mới phát => không mất đoạn đầu do trình duyệt đang dựng lớp
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(() => {
        if (finished) return;
        anims.forEach(a => a.play());
      })));
      safety = setTimeout(end, dur + 900);
    } else {
      // Dự phòng: vòng rAF dùng chính dữ liệu đã tính sẵn
      const last = KEYFRAMES - 1;
      let t0 = 0;
      const tick = now => {
        if (finished) return;
        const t = clamp((now - t0) / dur, 0, 1);
        const f = frames[Math.round(t * last)];
        strips.forEach((s, i) => { s.style.transform = f.m[i]; });
        wrap.style.opacity = String(f.op);
        if (t < 1) requestAnimationFrame(tick); else end();
      };
      requestAnimationFrame(() => requestAnimationFrame(now => { t0 = now; tick(now); }));
      safety = setTimeout(end, dur + 900);
    }
  }

  window.Genie = { run };
})();