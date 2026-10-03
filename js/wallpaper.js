/* =========================================================
   wallpaper.js: đổi hình nền kiểu macOS
   - Chuột phải vào nền desktop -> "Change Wallpaper…"
   - Hoặc bấm logo ở menubar (như menu Apple)
   - Lưu lựa chọn (localStorage), đổi có hiệu ứng mờ dần
   - Nền tối -> thêm class "wp-dark" lên <body> (chữ icon chuyển trắng)
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  /* dark: true/false = tự khai báo (chắc chắn nhất, nhất là khi mở file trực tiếp).
     Bỏ dark đi thì ảnh sẽ được đo độ sáng tự động (chỉ chạy khi có server). */
  const WALLPAPERS = [
    { name: "Wall 1",   img: "assets/wallpapers/wall_1.jpg.png", dark: true },
    { name: "Wall 2",   img: "assets/wallpapers/wall_2.jpg.png", dark: true },
    { name: "Lavender", bg: "linear-gradient(135deg,#c9c3ff,#a8d0ff 45%,#f3c6ff)", dark: false },
    { name: "Sunset",   bg: "linear-gradient(135deg,#ffd1a8,#ff9fb8 50%,#9d8cff)", dark: false },
    { name: "Ocean",    bg: "linear-gradient(135deg,#9be3ff,#5aa2ff 50%,#6c5cff)", dark: false },
    { name: "Mint",     bg: "linear-gradient(135deg,#c9ffe0,#8fe3d6 50%,#8fb8ff)", dark: false },
    { name: "Night",    bg: "linear-gradient(135deg,#1b1740,#3a2a78 50%,#0f3a6d)", dark: true }
  ];

  const KEY = "portfolio-wallpaper";
  const TRIGGERS = '#menubar .logo, .dock-icon[data-label="Settings"]';
  const desktop = document.querySelector("#desktop");
  if (!desktop) return;

  /* ---------- CSS ---------- */
  const style = document.createElement("style");
  style.textContent = `
    .wp-layer{position:fixed;inset:0;z-index:-1;opacity:0;transition:opacity .7s ease}
    .wp-layer.on{opacity:1}
    .wp-menu,.wp-picker{position:fixed;z-index:9000;color:#14142b;
      font:13px -apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",Arial,sans-serif;
      background:linear-gradient(160deg,rgba(255,255,255,.62),rgba(255,255,255,.4));
      border:1px solid rgba(255,255,255,.6);box-shadow:0 12px 34px rgba(0,0,0,.2);
      -webkit-backdrop-filter:blur(20px) saturate(160%);backdrop-filter:blur(20px) saturate(160%)}
    .wp-menu{min-width:190px;padding:5px;border-radius:12px}
    .wp-menu button{display:block;width:100%;padding:6px 10px;border:0;border-radius:7px;
      background:none;font:inherit;color:inherit;text-align:left;cursor:default}
    .wp-menu button:hover{background:#0a84ff;color:#fff}
    .wp-picker{left:50%;bottom:130px;translate:-50% 0;width:min(560px,calc(100vw - 32px));
      box-sizing:border-box;padding:18px;border-radius:26px}
    .wp-title{margin:0 0 12px;font-size:15px;font-weight:600;text-align:center}
    .wp-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:12px}
    .wp-thumb{aspect-ratio:16/10;border:0;border-radius:12px;cursor:pointer;
      background-size:cover;background-position:center;box-shadow:inset 0 0 0 1px rgba(0,0,0,.12)}
    .wp-thumb[aria-pressed="true"]{box-shadow:0 0 0 2px #fff,0 0 0 4px #0a84ff}
    @media (prefers-reduced-motion:reduce){.wp-layer{transition:none}}
  `;
  document.head.append(style);

  /* ---------- Hai lớp nền để cross-fade ---------- */
  const layers = [0, 1].map(() => {
    const d = document.createElement("div");
    d.className = "wp-layer";
    d.setAttribute("aria-hidden", "true");
    document.body.prepend(d);
    return d;
  });

  let cur = 0;
  let active = -1;

  const css = (w) => (w.img ? `url("${w.img}") center / cover no-repeat` : w.bg);
  const setDark = (on) => document.body.classList.toggle("wp-dark", on);

  /* Nền tối? Ưu tiên khai báo tay; không có thì đo độ sáng ảnh */
  function detectDark(w, done) {
    if (w.dark !== undefined) return done(w.dark);
    if (!w.img) return done(false);

    const im = new Image();
    im.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = c.height = 16;
        const x = c.getContext("2d", { willReadFrequently: true });
        x.drawImage(im, 0, 0, 16, 16);

        const p = x.getImageData(0, 0, 16, 16).data;
        let sum = 0;
        for (let i = 0; i < p.length; i += 4) sum += 0.2126 * p[i] + 0.7152 * p[i + 1] + 0.0722 * p[i + 2];
        done(sum / (p.length / 4) < 140);
      } catch {
        done(false);                                  // file:// chặn đọc pixel -> khai báo dark tay
      }
    };
    im.onerror = () => done(false);
    im.src = w.img;
  }

  function apply(i) {
    const w = WALLPAPERS[i];
    if (!w || i === active) return;
    active = i;
    detectDark(w, setDark);

    const next = layers[1 - cur];
    const show = () => {
      next.style.background = css(w);
      next.classList.add("on");
      layers[cur].classList.remove("on");
      cur = 1 - cur;
    };

    if (w.img) {                                      // đợi ảnh tải xong rồi mới chuyển
      const im = new Image();
      im.onload = show;
      im.onerror = show;
      im.src = w.img;
    } else {
      show();
    }

    try { localStorage.setItem(KEY, String(i)); } catch {}
    document.querySelectorAll(".wp-thumb").forEach((b, n) => b.setAttribute("aria-pressed", String(n === i)));
  }

  /* ---------- Bảng chọn ---------- */
  let picker = null;

  function closePicker() {
    picker?.remove();
    picker = null;
  }

  function openPicker() {
    closeMenu();
    if (picker) return;

    picker = document.createElement("div");
    picker.className = "wp-picker";
    picker.setAttribute("role", "dialog");
    picker.setAttribute("aria-label", "Wallpaper");
    picker.innerHTML = '<h2 class="wp-title">Wallpaper</h2><div class="wp-grid"></div>';

    const grid = picker.querySelector(".wp-grid");

    WALLPAPERS.forEach((w, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "wp-thumb";
      b.title = w.name;
      b.setAttribute("aria-label", w.name);
      b.setAttribute("aria-pressed", String(i === active));
      b.style.background = css(w);
      b.style.backgroundSize = "cover";
      b.addEventListener("click", () => apply(i));
      grid.append(b);
    });

    document.body.append(picker);
  }

  /* ---------- Menu chuột phải ---------- */
  let menu = null;

  function closeMenu() {
    menu?.remove();
    menu = null;
  }

  desktop.addEventListener("contextmenu", (e) => {
    if (e.target.closest(".desk-icon, .sticky-note, .group-overlay")) return;
    e.preventDefault();
    closeMenu();

    menu = document.createElement("div");
    menu.className = "wp-menu";
    menu.setAttribute("role", "menu");
    menu.innerHTML = '<button type="button" role="menuitem">Change Wallpaper…</button>';
    menu.querySelector("button").addEventListener("click", openPicker);
    document.body.append(menu);

    menu.style.left = `${Math.min(e.clientX, innerWidth - menu.offsetWidth - 8)}px`;
    menu.style.top = `${Math.min(e.clientY, innerHeight - menu.offsetHeight - 8)}px`;
  });

  /* ---------- Logo menubar / icon Settings (nếu có) ---------- */
  document.querySelectorAll(TRIGGERS).forEach((el) => {
    el.style.cursor = "pointer";
    el.addEventListener("click", (e) => { e.stopPropagation(); openPicker(); });
  });

  /* ---------- Đóng khi bấm ra ngoài / Esc ---------- */
  document.addEventListener("pointerdown", (e) => {
    if (menu && !e.target.closest(".wp-menu")) closeMenu();
    if (picker && !e.target.closest(".wp-picker, " + TRIGGERS)) closePicker();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    closeMenu();
    closePicker();
  });

  /* ---------- Khôi phục lựa chọn đã lưu (chưa lưu thì giữ nền cũ) ---------- */
  try {
    const saved = localStorage.getItem(KEY);
    if (saved !== null) apply(Number(saved));
  } catch {}
});