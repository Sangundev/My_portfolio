/* =========================================================
   js/apps/contact.js: thẻ "Get In Touch" (không khung cửa sổ, nằm thẳng trên desktop)
   - Thẻ giấy có vân, kéo được bằng cách giữ vào thẻ
   - Số điện thoại / email / LinkedIn là link thật (tel:, mailto:, https:)
   - Rê chuột vào thẻ: hiện nút đỏ ở góc trên trái để đóng (trên cảm ứng luôn hiện)
   CSS đi kèm: css/apps/contact.css
   Đăng ký: window.WMApps.contact  (mở bằng data-open="contact")
========================================================= */
(() => {
  /* ---------- DỮ LIỆU (sửa ở đây) ---------- */
  const INFO = {
    heading: "Get In Touch",
    lines: [
      "Let's build something cool.",
      "Or just talk design. Either works.",
    ],
    phone: "+84 37 405 9466",
    email: "nguyenngocsang1682@gmail.com",
    linkedin: "https://www.linkedin.com/in/your-profile",
    linkedinLabel: "LinkedIn",
    photo: "assets/system/namecard.png",
  };

  // Kích thước thẻ (px) + lề trong suốt quanh thẻ để bóng đổ không bị cắt
  const CARD = { w: 486, h: 310, margin: 44 };

  // Vân giấy: nhiễu fractal + chiếu sáng nghiêng => nổi vân như giấy dày
  const PAPER_SVG =
    "<svg xmlns='http://www.w3.org/2000/svg' width='256' height='256'>" +
    "<filter id='p' x='0' y='0' width='100%' height='100%'>" +
    "<feTurbulence type='fractalNoise' baseFrequency='.7' numOctaves='4' stitchTiles='stitch' result='n'/>" +
    "<feDiffuseLighting in='n' lighting-color='#fff' surfaceScale='1.6'>" +
    "<feDistantLight azimuth='50' elevation='60'/></feDiffuseLighting></filter>" +
    "<rect width='100%' height='100%' filter='url(#p)'/></svg>";

  const esc = (s) =>
    String(s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  function build(body, _title, api) {
    body.classList.add("flush");

    const root = api.h("div", "ct");
    root.style.setProperty(
      "--paper",
      `url("data:image/svg+xml,${encodeURIComponent(PAPER_SVG)}")`,
    );

    const tel = "tel:" + INFO.phone.replace(/[^\d+]/g, "");
    root.innerHTML = `
      <div class="ct-wrap" style="--cw:${CARD.w}px;--ch:${CARD.h}px">
        <div class="ct-tilt">
        <article class="ct-card">
          <button class="ct-x" type="button" aria-label="Close">
            <svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3.5 3.5l5 5m0-5l-5 5"/></svg>
          </button>
          <h1 class="ct-h">${esc(INFO.heading)}</h1>
          <p class="ct-sub">${INFO.lines.map(esc).join("<br>")}</p>
          <div class="ct-art"></div>
          <address class="ct-info">
            <a href="${esc(tel)}">${esc(INFO.phone)}</a>
            <a href="mailto:${esc(INFO.email)}">${esc(INFO.email)}</a>
            <a href="${esc(INFO.linkedin)}" target="_blank" rel="noopener">${esc(INFO.linkedinLabel)}</a>
          </address>
          <i class="ct-shade"></i><i class="ct-holo"></i><i class="ct-glare"></i>
        </article>
        </div>
      </div>`;
    body.append(root);

    /* hình góc trái dưới: ảnh của bạn, hoặc điện thoại vẽ bằng CSS (không dùng id để Genie nhân bản không vỡ) */
    const art = root.querySelector(".ct-art");
    const phone = () => {
      const p = api.h("div", "ct-phone");
      p.append(api.h("i", "ct-cam"), api.h("i", "ct-band"));
      return p;
    };
    if (INFO.photo) {
      const im = new Image();
      im.className = "ct-photo";
      im.alt = "";
      im.draggable = false;
      im.onerror = () => im.replaceWith(phone());
      im.src = INFO.photo;
      art.append(im);
    } else {
      art.append(phone());
    }

    /* ---------- CHUYỂN ĐỘNG: một vòng lặp duy nhất, mỗi khung hình ghi biến lên .ct-tilt ---------- */
    const wrap = root.querySelector(".ct-wrap");
    const card = root.querySelector(".ct-card");
    const tilt = root.querySelector(".ct-tilt");
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

    const cur = { nx: 0, ny: 0, mx: 50, my: 30, rz: 0, sc: 1 }; // giá trị đang hiển thị
    const tgt = { nx: 0, ny: 0, mx: 50, my: 30, rz: 0, sc: 1 }; // giá trị muốn tới
    let px = 0,
      py = 0,
      vx = 0,
      vy = 0; // vị trí lệch của thẻ + vận tốc (px, px/s)
    let dragging = false,
      hovering = false,
      moved = false;
    let raf = 0,
      last = 0;

    const K = 170,
      D = 15; // lò xo: K càng lớn về càng nhanh; D càng nhỏ càng nảy nhiều

    function frame(now) {
      raf = 0;
      if (!root.isConnected) return; // cửa sổ đã đóng
      const dt = Math.min(0.032, (now - last) / 1000 || 0.016);
      last = now;
      let busy = dragging;

      if (dragging) {
        // vận tốc giảm dần nếu giữ yên tay
        const f = Math.exp(-dt * 12);
        vx *= f;
        vy *= f;
      } else if (px || py || vx || vy) {
        // thả tay: lò xo kéo về 0
        vx += (-K * px - D * vx) * dt;
        vy += (-K * py - D * vy) * dt;
        px += vx * dt;
        py += vy * dt;
        if (Math.abs(px) + Math.abs(py) + Math.abs(vx) + Math.abs(vy) < 0.05) {
          px = py = vx = vy = 0;
        } else busy = true;
      }

      tgt.rz = reduce ? 0 : clamp(vx / 100, -7, 7); // nghiêng theo tốc độ ngang
      const k = 1 - Math.exp(-dt * 14); // làm mượt các giá trị còn lại
      for (const key in cur) {
        const d = tgt[key] - cur[key];
        cur[key] += d * k;
        if (Math.abs(d) > 0.002) busy = true;
      }

      wrap.style.translate = `${px.toFixed(2)}px ${py.toFixed(2)}px`;
      const s = tilt.style;
      s.setProperty("--nx", cur.nx.toFixed(3));
      s.setProperty("--ny", cur.ny.toFixed(3));
      s.setProperty("--mx", cur.mx.toFixed(1) + "%");
      s.setProperty("--my", cur.my.toFixed(1) + "%");
      s.setProperty("--rz", cur.rz.toFixed(2) + "deg");
      s.setProperty("--sc", cur.sc.toFixed(4));

      if (busy) raf = requestAnimationFrame(frame);
    }
    const kick = () => {
      if (!raf) {
        last = performance.now();
        raf = requestAnimationFrame(frame);
      }
    };

    /* rê chuột: nghiêng 3D + ánh sáng theo con trỏ (đo trên khung đứng yên .ct-wrap) */
    if (!reduce) {
      wrap.addEventListener("pointerenter", (e) => {
        if (e.pointerType !== "mouse") return;
        hovering = true;
        root.classList.add("hot");
        if (!dragging) tgt.sc = 1.02;
        kick();
      });
      wrap.addEventListener("pointermove", (e) => {
        if (e.pointerType !== "mouse" || dragging) return;
        const r = wrap.getBoundingClientRect();
        if (!r.width || !r.height) return;
        const x = clamp((e.clientX - r.left) / r.width, 0, 1);
        const y = clamp((e.clientY - r.top) / r.height, 0, 1);
        tgt.nx = x * 2 - 1;
        tgt.ny = y * 2 - 1;
        tgt.mx = x * 100;
        tgt.my = y * 100;
        kick();
      });
      wrap.addEventListener("pointerleave", () => {
        hovering = false;
        root.classList.remove("hot");
        if (!dragging) {
          tgt.nx = 0;
          tgt.ny = 0;
          tgt.sc = 1;
        }
        kick();
      });
    }

    /* kéo thẻ đi khắp màn hình, thả ra thì nảy về chỗ cũ (lò xo ở trên) */
    let id = null,
      sx = 0,
      sy = 0,
      gx = 0,
      gy = 0,
      cx = 0,
      cy = 0,
      lx = 0,
      ly = 0,
      lt = 0;

    card.addEventListener("pointerdown", (e) => {
      if (
        (e.pointerType === "mouse" && e.button) ||
        e.target.closest("a, button")
      )
        return;
      e.stopPropagation(); // không cho trình quản lý cửa sổ kéo cả cửa sổ
      const r = wrap.getBoundingClientRect();
      id = e.pointerId;
      dragging = true;
      moved = false;
      sx = e.clientX;
      sy = e.clientY;
      gx = e.clientX - px;
      gy = e.clientY - py; // điểm nắm, tính cả khi thẻ đang nảy dở
      cx = r.left + r.width / 2 - px; // tâm thẻ ở vị trí gốc
      cy = r.top + r.height / 2 - py;
      lx = px;
      ly = py;
      lt = performance.now();
      vx = vy = 0;
      tgt.sc = 1.045;
      tgt.nx = 0;
      tgt.ny = 0; // nhấc thẻ lên, bỏ nghiêng theo chuột
      root.classList.add("moving");
      card.setPointerCapture(id);
      kick();
    });

    card.addEventListener("pointermove", (e) => {
      if (!dragging || e.pointerId !== id) return;
      if (!moved && Math.hypot(e.clientX - sx, e.clientY - sy) < 4) return;
      moved = true;

      // giữ tâm thẻ luôn nằm trong màn hình
      px = clamp(cx + e.clientX - gx, 24, innerWidth - 24) - cx;
      py = clamp(cy + e.clientY - gy, 24, innerHeight - 24) - cy;

      const now = performance.now(),
        dt = (now - lt) / 1000;
      if (dt > 0) {
        // vận tốc, để thả ra thì thẻ văng theo đà
        vx = vx * 0.5 + ((px - lx) / dt) * 0.5;
        vy = vy * 0.5 + ((py - ly) / dt) * 0.5;
      }
      lx = px;
      ly = py;
      lt = now;
      kick();
    });

    const drop = (e) => {
      if (!dragging || (e && e.pointerId !== id)) return;
      dragging = false;
      root.classList.remove("moving");
      vx = clamp(vx, -2500, 2500);
      vy = clamp(vy, -2500, 2500);
      if (reduce) {
        px = py = vx = vy = 0;
      } // giảm chuyển động: về chỗ cũ ngay
      tgt.sc = hovering ? 1.02 : 1;
      kick();
    };
    ["pointerup", "pointercancel", "lostpointercapture"].forEach((t) =>
      card.addEventListener(t, drop),
    );

    // vừa kéo xong thì không kích hoạt click nhầm vào link
    root.addEventListener(
      "click",
      (e) => {
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
          moved = false;
        }
      },
      true,
    );
    // Vừa kéo xong thì không kích hoạt click nhầm
    root.addEventListener(
      "click",
      (e) => {
        if (moved) {
          e.preventDefault();
          e.stopPropagation();
          moved = false;
        }
      },
      true,
    );

    /* nút đóng */
    root.querySelector(".ct-x").addEventListener("click", (e) => {
      e.stopPropagation();
      if (window.WM) WM.close("contact");
    });
  }

  /* ---------- ĐĂNG KÝ ---------- */
  const reg = (window.WMApps = window.WMApps || {});
  reg.contact = {
    title: "Contact",
    w: CARD.w + CARD.margin * 2,
    h: CARD.h + CARD.margin * 2,
    cls: "is-contact",
    build,
  };
})();
