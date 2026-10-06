/* =========================================================
   js/genie.js: hiệu ứng Genie của macOS (bản đường cong mượt)
   - Cửa sổ được chia thành các dải ngang. Mỗi dải KHÔNG còn là hình chữ nhật
     mà được bẻ thành hình thang (matrix3d), hai dải kề nhau dùng chung cạnh
     => mép cửa sổ là một đường cong liền, không còn bậc thang.
   - Genie.run(el, dir, pt, done)
       el   : phần tử cửa sổ (.win)
       dir  : 'in'  = hút vào icon (thu nhỏ, đóng)
              'out' = bung ra từ icon (mở, khôi phục)
       pt   : { x, y, w } tâm icon trên màn hình + bề ngang icon (px)
       done : gọi khi chạy xong
   - Cửa sổ thật phải được ẩn bởi người gọi trong lúc chạy (xem window-manager.js)
========================================================= */
(() => {
  const SLOT_LAG = 0.45;                       // độ trễ giữa dải đáy (đi trước) và dải đỉnh (đi sau)
  const DUR = { in: 600, out: 520 };           // ms
  const EXTRA = 0.8;                           // px chồng giữa các dải để không hở đường chỉ

  let layer = null;
  const getLayer = () => {
    if (layer && layer.isConnected) return layer;
    layer = document.createElement('div');
    layer.id = 'genie';
    document.body.append(layer);
    return layer;
  };

  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  /* Ma trận matrix3d ánh xạ hình chữ nhật (0,0)-(w,h) lên một tứ giác bất kỳ.
     p0 = trái-trên, p1 = phải-trên, p2 = phải-dưới, p3 = trái-dưới (toạ độ màn hình).
     Đây là phép biến đổi phối cảnh (homography) chuẩn "square to quad". */
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

  function run(el, dir, pt, done) {
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) { done && done(); return; }

    const host = getLayer();
    const wrap = document.createElement('div');                   // mỗi lần chạy 1 lớp riêng => nhiều Genie cùng lúc không đè nhau
    wrap.style.cssText = 'position:absolute;inset:0';
    host.append(wrap);

    const N = clamp(Math.round(r.height / 14), 24, 40);           // số dải (nhiều hơn => cong mượt hơn)
    const hs = r.height / N;
    const cx = r.left + r.width / 2;
    const se = clamp((pt.w || 56) / r.width, 0.05, 0.3);          // tỉ lệ bề ngang khi tới icon

    /* --- Bản chụp nhanh của cửa sổ (không phải cửa sổ thật) --- */
    const snap = el.cloneNode(true);
    ['is-min', 'gn-skip', 'gn-hide', 'is-active', 'is-closing', 'from-icon', 'anim', 'dragging']
      .forEach(c => snap.classList.remove(c));
    snap.classList.add('gn-clone');
    snap.removeAttribute('role');
    snap.removeAttribute('id');
    snap.querySelectorAll('iframe').forEach(f => {                // không nạp lại PDF cho từng dải
      const d = document.createElement('div');
      d.className = 'empty';
      d.textContent = 'PDF';
      f.replaceWith(d);
    });
    snap.querySelectorAll('img').forEach(i => {                   // ảnh trong bản sao phải tải ngay, không lazy
      i.loading = 'eager';
      i.decoding = 'sync';
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
      const c = i === 0 ? snap : snap.cloneNode(true);
      c.style.top = (-i * hs) + 'px';
      s.append(c);
      frag.append(s);
      strips.push(s);
    }
    wrap.append(frag);

    /* --- Tư thế các "đường ngang" ở tiến độ p (0 = cửa sổ nguyên, 1 = thu về icon) --- */
    const Y = new Array(N + 1), L = new Array(N + 1), R = new Array(N + 1);

    const apply = p => {
      for (let j = 0; j <= N; j++) {
        const v = j / N;                                          // 0 = mép trên, 1 = mép dưới
        const q = clamp((p - (1 - v) * SLOT_LAG) / (1 - SLOT_LAG), 0, 1);
        const y0 = r.top + v * r.height;
        const y = y0 + (pt.y - y0) * q * q;                       // tăng tốc về phía icon
        const x = cx + (pt.x - cx) * (q * q * (3 - 2 * q));       // lệch ngang mượt (đường cong chữ S)
        const wd = r.width * (1 + (se - 1) * (1 - (1 - q) * (1 - q)));   // thu hẹp nhanh ở đầu
        Y[j] = y; L[j] = x - wd / 2; R[j] = x + wd / 2;
      }

      const e = EXTRA / hs;
      for (let i = 0; i < N; i++) {
        const dy = Y[i + 1] - Y[i];
        // kéo dài cạnh dưới thêm 1 chút (theo đúng hướng của dải) để các dải chồng nhẹ lên nhau
        const yB = Y[i + 1] + dy * e;
        const lB = L[i + 1] + (L[i + 1] - L[i]) * e;
        const rB = R[i + 1] + (R[i + 1] - R[i]) * e;
        const m = dy > 0.05
          ? quadMatrix(r.width, hs + EXTRA, [L[i], Y[i]], [R[i], Y[i]], [rB, yB], [lB, yB])
          : null;
        strips[i].style.transform = m || 'scale(0)';
      }

      wrap.style.opacity = p > 0.88 ? String(clamp((1 - p) / 0.12, 0, 1)) : '1';   // mờ dần ở cuối
    };

    /* --- Vòng chạy --- */
    const dur = DUR[dir] || DUR.in;
    const t0 = performance.now();
    let finished = false;

    const end = () => {
      if (finished) return;
      finished = true;
      wrap.remove();
      done && done();
    };

    const tick = now => {
      if (finished) return;
      const t = clamp((now - t0) / dur, 0, 1);
      apply(dir === 'in' ? t : 1 - t);
      if (t < 1) requestAnimationFrame(tick); else end();
    };

    apply(dir === 'in' ? 0 : 1);
    requestAnimationFrame(tick);
    setTimeout(end, dur + 150);                                    // phòng khi tab bị ẩn làm requestAnimationFrame dừng
  }

  window.Genie = { run };
})();