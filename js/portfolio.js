/* =========================================================
   js/portfolio.js: tương tác cho portfolio.html

   Cấu trúc:
   0. Tiện ích + bộ điều phối chung (MỘT listener cuộn, MỘT rAF mỗi khung hình)
   1. Thước chuyển section kiểu iPhone bên phải (tên các phần của trang)
   2. Thanh trên, tiêu đề hero, timeline Experience
   3. Tô mục menu theo phần đang xem
   4. Hero: ô ảnh chạy theo chuột
   5. Decisions: mở một câu thì các câu khác đóng
   6. Selected work: thẻ xếp chồng
   7. Additional work: nhãn "View Work" đi theo con trỏ
   8. Practice: đỉnh và đáy cong dẹt dần + mục lục
   9. Khởi động

   Quy tắc: chỉ ĐO layout trong measurers (lúc tải, đổi cỡ, trang đổi chiều cao);
   lúc cuộn chỉ TÍNH và GHI style, không đọc layout.
========================================================= */
(() => {
  "use strict";

  /* ---------- 0. Tiện ích + bộ điều phối ---------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const root = document.documentElement;
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;

  const painters = []; // (y) => void: chạy mỗi khung hình khi cuộn
  const measurers = []; // () => void: chạy khi tải xong, đổi cỡ, trang đổi chiều cao
  let queued = false;

  const paintAll = () => {
    queued = false;
    const y = scrollY;
    for (const p of painters) p(y);
  };
  const schedule = () => {
    if (!queued) {
      queued = true;
      requestAnimationFrame(paintAll);
    }
  };
  const measureAll = () => {
    for (const m of measurers) m();
    schedule();
  };

  /* Bỏ qua resize do thanh địa chỉ iOS co giãn: chỉ chạy khi rộng đổi, hoặc cao đổi hơn 120px */
  const onResize = (fn) => {
    let w = innerWidth,
      h = innerHeight;
    return () => {
      if (innerWidth === w && Math.abs(innerHeight - h) < 120) return;
      w = innerWidth;
      h = innerHeight;
      fn();
    };
  };

  /* Mục nào đang nằm giữa màn hình thì gắn aria-current cho link tương ứng */
  const spy = (links, rootMargin) => {
    const targets = links
      .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
      .filter(Boolean);
    if (!("IntersectionObserver" in window) || !targets.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          for (const a of links) {
            if (a.getAttribute("href") === "#" + e.target.id)
              a.setAttribute("aria-current", "true");
            else a.removeAttribute("aria-current");
          }
        }
      },
      { rootMargin },
    );
    targets.forEach((t) => io.observe(t));
  };

  /* ---------- 1. Thước chuyển section kiểu iPhone ----------
     Mỗi section là một mốc có tên trên thước. Thước trượt qua vạch vàng cố định ở giữa,
     tên và vạch gần giữa phóng ra mượt, vị trí đuổi theo cuộn có quán tính.
     Trả về hàm (y, on): y = vị trí cuộn, on = có hiện thước hay không */
  const DIAL_SECTIONS = [
    // [selector, tên hiện trên thước]: sửa tên hoặc thêm bớt section ở đây
    [".hero", "Home"],
    ["#journey", "Experience"],
    ["#work", "Work"],
    ["#more", "More work"],
    ["#practice", "Practice"],
    ["#about", "About"],
    ["#decisions", "Decisions"],
    ["#contact", "Contact"],
  ];
  const DSTEP = 0.2; // khoảng giữa hai vạch nhỏ (tính theo khoảng giữa hai section)
  const DPX = 56; // số px giữa hai section liền nhau: lớn hơn thì thước thưa hơn
  const DSMOOTH = 0.38; // thời gian làm mượt (giây): lớn hơn thì thước trôi chậm và êm hơn
  const DREACH = 1; // vạch và tên cách giữa thước trong khoảng này (tính theo khoảng giữa hai section) sẽ phóng ra
  const DREF = 0.35; // section được coi là "đang xem" khi đỉnh của nó lên tới 35% chiều cao màn hình

  function createDial(rail) {
    const items = DIAL_SECTIONS.map(([sel, name]) => ({
      el: $(sel),
      name,
    })).filter((it) => it.el);
    const N = items.length;
    if (N < 2) return null;

    const PAD = 4; // dư ra hai đầu để lấp đầy khung
    const u0 = -PAD; // u: vị trí tính theo số section (0 = section đầu, N-1 = section cuối)
    const u1 = N - 1 + PAD;
    const vals = [];
    const base = []; // độ đậm gốc của từng vạch
    let html = "";
    const sm = (x) => x * x * (3 - 2 * x); // smoothstep: 0 → 1 chuyển trơn tru

    for (let i = 0; ; i++) {
      const u = Math.round((u0 + i * DSTEP) * 10) / 10;
      if (u > u1 + 1e-6) break;
      const whole = Math.abs(u - Math.round(u)) < 1e-6;
      const inside = u >= -1e-6 && u <= N - 1 + 1e-6;
      const y = ((u - u0) * DPX).toFixed(1);
      vals.push(u);
      base.push(!inside ? 0.22 : whole ? 0.85 : 0.45);
      html += `<i class="${((whole ? "mj" : "") + (inside ? "" : " x")).trim()}" style="top:${y}px"></i>`;
      if (whole && inside) {
        html += `<em data-i="${i}" data-n="${Math.round(u)}" style="top:${y}px"></em>`;
      }
    }

    const strip = document.createElement("div");
    strip.className = "rail-strip";
    strip.innerHTML = html;
    const ticks = $$("i", strip);
    const labels = {};
    $$("em", strip).forEach((e) => {
      labels[e.dataset.i] = e;
      e.textContent = items[+e.dataset.n].name; // gán bằng textContent: tên không bị hiểu thành HTML
    });

    rail.replaceChildren(strip);

    let cur = 0, // vị trí đang hiển thị (tính theo số section, trượt mượt)
      tgt = 0, // vị trí đích theo cuộn
      vel = 0, // vận tốc hiện tại của thước (để chuyển động liền mạch khi đích đổi)
      tPrev = 0,
      H = 0,
      raf = 0,
      lastA = 0,
      lastB = -1,
      sy = []; // vị trí cuộn mà tại đó từng section nằm đúng giữa thước

    /* Phóng to vạch và fade-in tên section khi lại gần giữa thước; chỉ đụng vài chục phần tử mỗi khung hình */
    const magnify = () => {
      const a = Math.max(0, Math.floor((cur - DREACH - u0) / DSTEP) - 1);
      const b = Math.min(
        ticks.length - 1,
        Math.ceil((cur + DREACH - u0) / DSTEP) + 1,
      );
      const from = Math.min(a, lastA);
      const to = Math.max(b, lastB);
      for (let i = from; i <= to; i++) {
        const el = ticks[i];
        if (!el) continue;
        const dist = Math.abs(vals[i] - cur);
        const k = sm(1 - Math.min(1, dist / DREACH)); // 1 ở giữa thước, 0 ở rìa vùng
        const on = k > 0.001;
        el.style.transform = on ? `scaleX(${(1 + k * 1.1).toFixed(3)})` : "";
        el.style.opacity = on ? (base[i] + (1 - base[i]) * k).toFixed(3) : "";
        const lb = labels[i];
        if (lb) {
          const hit = dist < 0.12; // tới đúng section thì vạch và tên sáng vàng
          el.classList.toggle("hit", hit);
          lb.classList.toggle("hit", hit);
          lb.style.transform = on ? `scale(${(1 + k * 0.3).toFixed(3)})` : "";
          lb.style.opacity = on ? (k * 0.9).toFixed(3) : "0"; // ẩn hoàn toàn khi ra ngoài vùng
        }
      }
      lastA = a;
      lastB = b;
    };

    const paint = () => {
      strip.style.transform = `translate3d(0,${(H / 2 - (cur - u0) * DPX).toFixed(2)}px,0)`;
      magnify();
    };

    /* Làm mượt kiểu lò xo tới hạn: vận tốc liên tục nên không giật khi đích đổi, tốc độ không phụ thuộc màn hình 60 hay 144Hz */
    const step = (now) => {
      raf = 0;
      const dt = clamp((now - (tPrev || now - 16.7)) / 1000, 0.001, 0.05);
      tPrev = now;
      const omega = 2 / DSMOOTH;
      const x = omega * dt;
      const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
      const before = cur;
      const change = cur - tgt;
      const temp = (vel + omega * change) * dt;
      vel = (vel - omega * temp) * e;
      cur = tgt + (change + temp) * e;
      if (tgt - before > 0 === cur > tgt) {
        // lỡ vọt quá đích thì dừng ngay ở đích
        cur = tgt;
        vel = 0;
      }
      if (Math.abs(tgt - cur) < 0.0005 && Math.abs(vel) < 0.002) {
        cur = tgt;
        vel = 0;
        tPrev = 0;
        paint();
        return;
      }
      paint();
      raf = requestAnimationFrame(step);
    };

    /* Vị trí cuộn y → vị trí liên tục trên thước (0 … N-1), nội suy giữa hai section liền nhau */
    const at = (y) => {
      if (y <= sy[0]) return 0;
      for (let i = 0; i < N - 1; i++) {
        if (y < sy[i + 1]) {
          const span = sy[i + 1] - sy[i];
          return i + (span > 0 ? (y - sy[i]) / span : 0);
        }
      }
      return N - 1;
    };

    /* Vùng nền tối: bật .lt để thước dùng chữ trắng; vùng sáng tắt .lt để dùng màu mực */
    const darkEls = [".dark", ".stack", ".end"].map((s) => $(s)).filter(Boolean);
    let darkRanges = [];

    measurers.push(() => {
      H = rail.clientHeight;
      const max = Math.max(0, root.scrollHeight - innerHeight);
      let prev = 0;
      sy = items.map(({ el }, i) => {
        const top = el.getBoundingClientRect().top + scrollY;
        prev = i === 0 ? 0 : Math.max(prev, clamp(top - innerHeight * DREF, 0, max));
        return prev;
      });
      darkRanges = darkEls.map((el) => {
        const top = el.getBoundingClientRect().top + scrollY;
        return [top, top + el.offsetHeight]; // đo lại mỗi khi trang đổi chiều cao
      });
      paint();
    });

    return (y, on) => {
      rail.classList.toggle("on", on);
      const isDark = darkRanges.some(([a, b]) => y + innerHeight * 0.5 > a && y < b); // giữa màn hình đang ở vùng tối
      rail.classList.toggle("lt", isDark);
      tgt = at(y);
      if (reduce) {
        cur = tgt;
        vel = 0;
        paint();
      } else if (!raf) raf = requestAnimationFrame(step);
    };
  }

  /* ---------- 2. Thanh trên, tiêu đề hero, timeline ---------- */
  const hero = $(".hero");

  function initChrome() {
    const bar = $(".bar");
    const tl = $(".tl");
    const tlItems = tl ? $$("li", tl) : [];
    const rail = $(".rail");
    const dial = rail ? createDial(rail) : null;
    let heroH = 1,
      tlTop = 0,
      lastP = -1,
      lastJ = -1;

    measurers.push(() => {
      if (hero) heroH = hero.offsetHeight || 1;
      if (tl) tlTop = tl.getBoundingClientRect().top + scrollY;
    });

    painters.push((y) => {
      if (bar) bar.classList.toggle("scrolled", y > 8);

      if (hero && !reduce) {
        const p = clamp(y / heroH, 0, 1);
        if (p !== lastP) {
          lastP = p;
          hero.style.setProperty("--p", p.toFixed(3));
        }
      }

      if (tl) {
        // đường kẻ timeline chạy dần; mốc nào đường kẻ đã chạm tới thì chấm sáng lên
        const j = reduce
          ? 1
          : clamp((y + innerHeight * 0.8 - tlTop) / (innerHeight * 0.6), 0, 1);
        if (j !== lastJ) {
          lastJ = j;
          tl.style.setProperty("--j", j.toFixed(3));
          tlItems.forEach((li, i) =>
            li.classList.toggle("on", i === 0 ? j > 0 : j >= i / tlItems.length),
          );
        }
      }

      if (dial) dial(y, y > 8);
    });
  }

  /* ---------- 3. Tô mục menu theo phần đang xem ---------- */
  function initMenuSpy() {
    spy($$('.bar nav a[href^="#"]'), "-45% 0px -50% 0px");
  }

  /* ---------- 4. Hero: ô ảnh chạy theo chuột ----------
     Mỗi ô có một vòng đời dạng chuông (lớn êm → đỉnh → thu êm), tạo animation MỘT lần rồi phát lại.
     Đời ô ngắn khi chuột nhanh, dài khi chuột chậm; ô rải đều theo quãng đường chuột đi. */
  function initTrail() {
    const trail = $(".trail");
    if (
      !hero ||
      !trail ||
      reduce ||
      !matchMedia("(hover: hover) and (pointer: fine)").matches
    )
      return;

    document.body.appendChild(trail); // lớp phủ toàn màn hình: ô nổi trên cả menu, không bị cắt ở mép hero

    const SRC = [
      /* 'assets/portfolio/1.jpg', 'assets/portfolio/2.jpg' */
    ];
    const PALETTE = [
      // màu thay thế khi chưa có ảnh (SRC trống), xếp xen kẽ để hai ô liền nhau luôn khác tông
      "linear-gradient(135deg,#4a90e2,#2d5fc4)",
      "linear-gradient(135deg,#ffd84d,#ffb300)",
      "#0b0b0d",
      "linear-gradient(135deg,#ff4fd8,#c026d3)",
      "linear-gradient(135deg,#5cc34a,#2f9a2b)",
      "linear-gradient(135deg,#ff8a5b,#ff5f3a)",
      "linear-gradient(135deg,#2fd0ff,#18a0ff)",
      "linear-gradient(135deg,#ff5f7a,#e0264a)",
      "linear-gradient(135deg,#d9d9de,#6b6b73)",
      "linear-gradient(135deg,#a78bfa,#6d3fe0)",
      "linear-gradient(135deg,#ffb08a,#ff8a5b)",
      "linear-gradient(135deg,#34e0b4,#0fa37f)",
      "linear-gradient(135deg,#f5f5f7,#c9cad0)",
      "linear-gradient(135deg,#ff9ed2,#ff5fa8)",
      "linear-gradient(135deg,#1e2a78,#0b1240)",
      "linear-gradient(135deg,#c6f24a,#8cc219)",
    ];
    const DMIN = 760; // đời ngắn nhất của một ô (ms), khi lướt rất nhanh
    const DMAX = 1250; // đời dài nhất của một ô (ms), khi lướt chậm
    const TRAIL = 9; // số ô muốn thấy cùng lúc trên đường chuột: lớn hơn → dải nhỏ → lớn dài hơn
    const RISE = 1.2; // lớn hơn → đỉnh đến muộn hơn (1.0 = đỉnh ở giữa, 1.2 ≈ 56%)
    const SOFT = 1.5; // lớn hơn → lúc bắt đầu và kết thúc êm hơn
    const STEPS = 72; // lấy mẫu đường cong dày để không bị gợn khi ô to
    const COUNT = SRC.length || PALETTE.length;
    const POOL = COUNT * Math.ceil(28 / COUNT); // ~28 ô dùng luân phiên, đủ cho cả khi lướt rất nhanh

    /* Đường cong dạng chuông: không có chỗ nối giữa lúc lớn và lúc thu, tốc độ đổi chiều ở đỉnh liền mạch */
    const BELL = Array.from({ length: STEPS + 1 }, (_, i) => {
      const t = i / STEPS;
      const s = Math.pow(
        Math.max(0, Math.sin(Math.PI * Math.pow(t, RISE))),
        SOFT,
      );
      return { transform: `scale(${s.toFixed(4)})`, offset: t };
    });

    /* Tải và giải mã trước để ảnh hiện không khựng */
    SRC.forEach((src) => {
      const im = new Image();
      im.src = src;
      if (im.decode) im.decode().catch(() => {});
    });

    /* Lớp ngoài .pop giữ vị trí, lớp trong <i> chạy phóng to: hai việc chạy độc lập trên GPU */
    const cells = Array.from({ length: POOL }, (_, i) => {
      const w = document.createElement("div");
      const c = document.createElement("i");
      w.className = "pop";
      c.style.background = SRC.length
        ? `url(${SRC[i % COUNT]}) center/cover`
        : PALETTE[i % COUNT];
      w.appendChild(c);
      trail.appendChild(w);
      const a = c.animate(BELL, { duration: DMAX, fill: "backwards" });
      a.cancel(); // tạo MỘT lần, các lần sau chỉ phát lại
      return { w, a, x: 0, y: 0, until: 0 }; // x, y: tâm ô; until: lúc ô gần biến mất (ms)
    });

    /* S: cỡ đỉnh chung của mọi ô */
    let S = 165;
    measurers.push(() => {
      S = Math.round(clamp(hero.clientWidth * 0.086, 120, 180));
      for (const { w } of cells) w.style.width = w.style.height = S + "px";
    });

    let n = 0, // số ô đã sinh
      speed = 0, // tốc độ chuột (px/ms), đã làm mượt
      lx = -1e9, // điểm ô gần nhất
      ly = -1e9;

    const spawn = (x, y, age = 0) => {
      const now = performance.now();
      for (const c of cells) {
        // gần một ô còn đang hiện thì bỏ, không cho chồng lên nhau (rê chuột quanh một điểm)
        if (c.until > now && Math.hypot(x - c.x, y - c.y) < S * 0.8) return;
      }
      lx = x;
      ly = y;

      const k = n++;
      const cell = cells[k % POOL];
      cell.a.cancel();
      cell.w.style.zIndex = k % 100000; // ô mới luôn nằm trên ô cũ
      cell.w.style.transform = `translate3d(${(x - S / 2).toFixed(1)}px,${(y - S / 2).toFixed(1)}px,0)`;

      const dur = speed
        ? clamp((TRAIL * S * 1.1) / speed, DMIN, DMAX)
        : DMAX;
      const a0 = Math.min(Number.isFinite(age) ? age : 0, dur * 0.3); // tối đa 30% đời: ô luôn bắt đầu từ nhỏ
      cell.x = x;
      cell.y = y;
      cell.until = now + dur * 0.85 - a0; // 15% cuối ô đã thu rất nhỏ nên không tính là chiếm chỗ
      cell.a.effect.updateTiming({ duration: dur }); // dùng lại animation tạo sẵn, chỉ đổi thời lượng
      cell.a.play();
      cell.a.currentTime = a0;
    };

    /* Khoảng cách giữa hai tâm ô: phần lớn sát nhau, thỉnh thoảng có một chỗ hở */
    const nextGap = () =>
      S * (Math.random() < 0.15 ? rand(1.4, 1.75) : rand(0.95, 1.25));

    let px = null,
      py = null,
      pt = 0,
      need = nextGap();

    const move = (x, y, t) => {
      if (px === null) {
        px = x;
        py = y;
        pt = t;
        spawn(x, y);
        return;
      }
      const dx = x - px,
        dy = y - py,
        d = Math.hypot(dx, dy);
      if (!d) return;
      const dt = clamp(t - pt, 1, 48) || 16; // chặn trần: dừng chuột lâu rồi lướt lại không làm ô "già" đột ngột
      speed = speed ? speed * 0.8 + (d / dt) * 0.2 : d / dt; // làm mượt tốc độ để đời ô không giật cục
      const ux = dx / d,
        uy = dy / d;
      let covered = 0,
        k = 0;
      while (covered + need <= d && k++ < 8) {
        // lướt nhanh vẫn rải đủ ô trên đường đi
        covered += need;
        spawn(px + ux * covered, py + uy * covered, (1 - covered / d) * dt); // tuổi = thời gian từ lúc chuột đi qua điểm đó
        need = nextGap();
      }
      need -= d - covered;
      if (need <= 0) need = nextGap();
      px = x;
      py = y;
      pt = t;
    };

    /* Gom vị trí chuột, xử lý đúng nhịp khung hình */
    let mx = 0,
      my = 0,
      pending = false;
    const tick = (t) => {
      pending = false;
      move(mx, my, t);
    };
    const onMove = (e) => {
      if (e.pointerType !== "mouse") return;
      mx = e.clientX;
      my = e.clientY;
      if (!pending) {
        pending = true;
        requestAnimationFrame(tick);
      }
    };
    const onLeave = () => {
      px = py = null;
      need = nextGap();
      speed = 0;
      lx = ly = -1e9;
    };
    const onDown = (e) => {
      if (e.pointerType === "mouse") spawn(e.clientX, e.clientY);
    };

    /* Vùng chạy hiệu ứng: hero và mọi phần tử có data-trail. Chung một đường chuột nên chuyển vùng vẫn liền mạch */
    [hero, ...$$("[data-trail]")].forEach((z) => {
      z.addEventListener("pointermove", onMove);
      z.addEventListener("pointerleave", onLeave);
      z.addEventListener("pointerdown", onDown);
    });
  }

  /* ---------- 5. Decisions: chỉ giữ một câu mở, mở và đóng mượt kiểu iOS ----------
     Chiều cao chạy bằng Web Animations với đường cong sheet của iOS; <details> chỉ thật sự đóng sau khi animation xong */
  function initAccordion() {
    const EASE = "cubic-bezier(.32,.72,0,1)"; // đường cong spring của iOS
    const DUR = reduce ? 0 : 480; // ms

    const items = $$("details").map((d) => {
      const sum = $("summary", d);
      const p = $("p", d);
      const it = { d, closing: false, a: null, pa: null };
      d.classList.toggle("is-open", d.open); // .is-open điều khiển dấu +/× trong CSS

      it.go = (open) => {
        const from = d.offsetHeight; // chiều cao lúc này (kể cả đang giữa chừng animation)
        it.a?.cancel();
        it.pa?.cancel();
        it.closing = !open;
        d.classList.toggle("is-open", open);
        d.open = true; // luôn để mở trong lúc chạy, đóng thật sự khi xong
        d.style.overflow = "hidden";
        const to = open ? d.offsetHeight : sum.offsetHeight;

        if (!DUR || from === to) {
          d.open = open;
          d.style.overflow = "";
          it.closing = false;
          return;
        }

        const a = d.animate(
          { height: [from + "px", to + "px"] },
          { duration: DUR, easing: EASE },
        );
        it.a = a;
        if (p)
          it.pa = p.animate(
            { opacity: open ? [0, 1] : [1, 0] },
            {
              duration: open ? DUR * 0.9 : DUR * 0.45,
              delay: open ? DUR * 0.1 : 0,
              easing: "ease-out",
              fill: "both",
            },
          );
        a.onfinish = () => {
          if (it.a !== a) return;
          it.pa?.cancel();
          d.open = open;
          d.style.overflow = "";
          it.closing = false;
          it.a = it.pa = null;
        };
      };

      sum.addEventListener("click", (e) => {
        e.preventDefault(); // tự điều khiển mở/đóng thay vì để trình duyệt nhảy ngay
        const open = !(d.open && !it.closing);
        it.go(open);
        if (open)
          for (const o of items)
            if (o !== it && o.d.open && !o.closing) o.go(false);
      });
      return it;
    });
  }

//

  /* ---------- 6. Selected work: thẻ xếp chồng ----------
     Thẻ i bị thẻ i+1 đè dần thì k đi từ 0 đến 1 (thu nhỏ + nhạt dần, k = 1 thì biến mất) */
  function initStack() {
    const stack = $(".stack");
    const cards = stack ? $$(".card", stack) : [];
    if (!cards.length) return;

    const desk = matchMedia("(min-width: 861px)");
    const FADE = 1; // thẻ bị đè nhạt đi tối đa bao nhiêu (0 = không nhạt, 1 = biến mất hẳn)
    const F0 = 0.06; // thẻ sau ló lên được bấy nhiêu phần màn hình thì thẻ trước bắt đầu thu nhỏ và nhạt
    const F1 = 0.85; // thẻ sau lướt lên được bấy nhiêu phần màn hình thì thẻ trước biến mất hẳn
    const SHRINK = 0.06; // thẻ bị đè thu nhỏ tối đa bao nhiêu
    let sTop = 0,
      sH = 1,
      sGap = 0;
    const lastK = [];

    measurers.push(() => {
      sTop = stack.getBoundingClientRect().top + scrollY;
      sH = cards[0].offsetHeight || 1;
      sGap = cards[1]
        ? parseFloat(getComputedStyle(cards[1]).marginTop) || 0
        : 0;
    });

    painters.push((y) => {
      const last = cards.length - 1;
      cards.forEach((c, i) => {
        let k = 0;
        if (!reduce && desk.matches && i < last) {
          const nextTop = sTop + (i + 1) * (sH + sGap) - y; // vị trí đỉnh thẻ kế tiếp so với đỉnh màn hình nếu chưa dính
          const rise = (innerHeight - nextTop) / innerHeight; // thẻ kế tiếp đã lướt lên bao nhiêu phần màn hình
          k = clamp((rise - F0) / (F1 - F0), 0, 1);
        }
        k = Math.round(k * 500) / 500; // làm tròn để bỏ qua thay đổi quá nhỏ, đỡ vẽ lại
        if (k === lastK[i]) return;
        lastK[i] = k;
        c.style.transform = k ? `scale(${(1 - k * SHRINK).toFixed(4)})` : "";
        c.style.opacity = k ? (1 - k * FADE).toFixed(3) : "";
      });
    });
  }

  /* ---------- 7. Additional work: nhãn "View Work" đi theo con trỏ ---------- */
  function initPills() {
    if (reduce || !matchMedia("(hover: hover)").matches) return;
    $$(".t .th, .card .shot").forEach((th) => {
      const pill = $(".pill", th);
      if (!pill) return;
      let cx = 0,
        cy = 0,
        queuedPill = false;
      const paint = () => {
        queuedPill = false;
        const r = th.getBoundingClientRect(); // chỉ đọc vị trí một lần mỗi khung hình
        pill.style.transform = `translate3d(${(cx - r.left).toFixed(1)}px,${(cy - r.top).toFixed(1)}px,0) translate(-50%,-50%)`;
      };
      th.addEventListener("pointermove", (e) => {
        cx = e.clientX;
        cy = e.clientY;
        if (!queuedPill) {
          queuedPill = true;
          requestAnimationFrame(paint);
        }
      });
    });
  }

  /* ---------- 8. Practice: đỉnh và đáy cong dẹt dần thành đường thẳng khi cuộn tới ---------- */
  function initDark() {
    const dark = $(".dark");
    if (!dark) return;

    const mk = (cls) => {
      const el = document.createElement("div");
      el.className = cls;
      el.setAttribute("aria-hidden", "true");
      dark.appendChild(el);
      return el;
    };
    const arcTop = mk("arc"); // đỉnh cong
    const arcBot = mk("arc-b"); // đáy cong
    let dTop = 0,
      dBot = 0,
      lastT = -1,
      lastB = -1;

    /* pos: vị trí một mép của phần tối so với đỉnh màn hình */
    const flat = (pos) => {
      if (reduce) return 1;
      const from = innerHeight * 0.95; // còn sát đáy màn hình: cong hết cỡ
      const to = innerHeight * 0.2; // lên gần đỉnh: thẳng hẳn
      return Math.round(clamp((pos - to) / (from - to), 0, 1) * 500) / 500;
    };

    measurers.push(() => {
      dTop = dark.getBoundingClientRect().top + scrollY;
      dBot = dTop + dark.offsetHeight;
    });

    painters.push((y) => {
      const t = flat(dTop - y);
      const b = flat(dBot - y);
      if (t !== lastT) {
        lastT = t;
        arcTop.style.transform = `scaleY(${t})`;
      }
      if (b !== lastB) {
        lastB = b;
        arcBot.style.transform = `scaleY(${b})`;
      }
    });

    spy($$(".pr-nav a"), "-40% 0px -50% 0px"); // mục lục bên trái sáng theo thẻ đang xem
  }

  /* ---------- 8a. Nút lên đầu trang ---------- */
  function initTop() {
    const btn = $(".top");
    if (!btn) return;
    let shown = false;
    painters.push((y) => {
      const on = y > innerHeight * 0.6; // qua khoảng 60% màn hình đầu thì hiện
      if (on === shown) return;
      shown = on;
      btn.classList.toggle("on", on);
    });
    btn.addEventListener("click", () => {
      scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" });
    });
  }

  /* ---------- 8b. Hiện dần khi cuộn tới ----------
     Chữ: trượt lên + rõ nét dần ("up"). Ảnh, thẻ, câu hỏi: phóng nhẹ từ 95% ("pop").
     Phần tử cùng vào màn hình một lúc được so le 80ms. Hiện xong thì gỡ data-r để trả lại hover và nhấn như cũ */
  function initReveal() {
    if (reduce || !("IntersectionObserver" in window)) return;

    const TEXT = [
      ".journey > small",
      ".journey h2",
      ".journey .sub",
      ".tl li",
      ".work .w > *",
      ".card .info",
      ".card dl",
      ".add-head > *",
      ".two > small",
      ".two > div > h2",
      ".two > div > p",
      ".pr-sub",
      ".pr-nav",
      ".dec-sub",
      ".mq",
      ".end .w > small",
      ".end .w > h2",
      ".end .w > p",
      ".reach li",
      ".foot-in",
    ];
    const MEDIA = [".card .shot", ".add-grid .t", ".pc", ".faq details"];
    const mark = (list, kind) =>
      list.forEach((s) =>
        $$(s).forEach((el) => {
          if (!el.dataset.r) el.dataset.r = kind; // phần tử trùng selector chỉ gắn một lần
        }),
      );
    mark(TEXT, "up");
    mark(MEDIA, "pop");

    const left = new Set($$("[data-r]"));

    const finish = (el) => {
      left.delete(el);
      io.unobserve(el);
      el.removeAttribute("data-r");
      el.classList.remove("in");
      el.style.removeProperty("--d");
    };

    const io = new IntersectionObserver(
      (entries) => {
        let n = 0;
        entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top ||
              a.boundingClientRect.left - b.boundingClientRect.left,
          )
          .forEach((e) => {
            const el = e.target;
            const delay = Math.min(n++, 5) * 80;
            el.style.setProperty("--d", delay + "ms");
            el.classList.add("in");
            io.unobserve(el);
            setTimeout(() => finish(el), delay + 1100);
          });
        // phần tử đã nằm hẳn phía trên màn hình (tải lại giữa trang): hiện luôn, không animate
        for (const e of entries)
          if (!e.isIntersecting && e.boundingClientRect.bottom <= 0)
            finish(e.target);
      },
      { rootMargin: "0px 0px -8% 0px" },
    );
    left.forEach((el) => io.observe(el));

    /* Nhảy nhanh qua một đoạn (bấm menu): IntersectionObserver có thể bỏ sót phần tử vừa lướt qua,
       nên khi ngừng cuộn 150ms thì quét một lần để mở nốt những phần tử đã nằm phía trên */
    let t = 0;
    const sweep = () => {
      for (const el of [...left])
        if (el.getBoundingClientRect().bottom < 0) finish(el);
    };
    addEventListener(
      "scroll",
      () => {
        clearTimeout(t);
        t = setTimeout(sweep, 150);
      },
      { passive: true },
    );
  }

  /* ---------- 8c. Tiêu đề section: lướt qua thì nhảy lên và mờ dần ----------
     p đi từ 0 (tiêu đề còn dưới thanh trên) đến 1 (đã trượt hẳn lên); dùng smoothstep nên khởi đầu và kết thúc êm */
  function initHeadings() {
    if (reduce) return;
    const JUMP = 56; // px: tiêu đề nhảy lên thêm tối đa bấy nhiêu
    const pageTop = (el) => {
      let t = 0; // offsetTop không bị ảnh hưởng bởi transform nên đo lại lúc nào cũng đúng
      for (let n = el; n; n = n.offsetParent) t += n.offsetTop;
      return t;
    };
    const heads = $$(
      ".journey h2, .work .w h2, .add-head h2, .dark h2, #about h2, #decisions h2, .end h2",
    ).map((el) => {
      el.style.willChange = "transform, opacity";
      return { el, top: 0, h: 1, last: -1 };
    });
    if (!heads.length) return;

    measurers.push(() => {
      for (const o of heads) {
        o.top = pageTop(o.el);
        o.h = o.el.offsetHeight || 1;
      }
    });

    painters.push((y) => {
      for (const o of heads) {
        let p = clamp((y + 80 - o.top) / (o.h + 60), 0, 1);
        p = Math.round(p * p * (3 - 2 * p) * 200) / 200;
        if (p === o.last) continue;
        o.last = p;
        o.el.style.transform = p ? `translate3d(0,${(-p * JUMP).toFixed(1)}px,0)` : "";
        o.el.style.opacity = p ? (1 - p * 0.9).toFixed(3) : "";
      }
    });
  }

  /* ---------- 8d. Header đổi trắng/đen theo vùng phía sau ----------
     Điểm đo nằm giữa thanh header (y + 28). Thẻ Selected work dính cách đỉnh 72px nên chỉ thẻ cuối, lúc trượt qua header, mới đè lên header */
  function initBarTone() {
    const bar = $(".bar");
    if (!bar) return;
    const stack = $(".stack");
    const lastCard = stack ? stack.lastElementChild : null;
    let ranges = [],
      last = null;

    measurers.push(() => {
      ranges = [];
      for (const s of [".dark", ".end"]) {
        const el = $(s);
        if (el) {
          const t = el.getBoundingClientRect().top + scrollY;
          ranges.push([t, t + el.offsetHeight]);
        }
      }
      if (stack && lastCard) {
        const t = stack.getBoundingClientRect().top + scrollY;
        const b = t + stack.offsetHeight;
        const desk = matchMedia("(min-width: 861px)").matches;
        ranges.push(desk ? [b - lastCard.offsetHeight, b] : [t, b]); // mobile: thẻ cuộn bình thường nên cả cụm là vùng tối
      }
    });

    painters.push((y) => {
      const p = y + 28;
      const dark = ranges.some(([a, b]) => p > a && p < b);
      if (dark === last) return;
      last = dark;
      bar.classList.toggle("lt", dark);
    });
  }

  /* ---------- 8e. Menu bảng trượt bên phải ---------- */
  function initMenu() {
    const menu = $(".menu");
    const bg = $(".menu-bg");
    const openBtn = $(".menu-btn");
    const closeBtn = $(".menu-x");
    if (!menu || !openBtn || !closeBtn) return;
    let from = null;

    const set = (on) => {
      menu.classList.toggle("on", on);
      if (bg) bg.classList.toggle("on", on);
      menu.setAttribute("aria-hidden", on ? "false" : "true");
      openBtn.setAttribute("aria-expanded", on ? "true" : "false");
      root.classList.toggle("menu-open", on);
      if (on) {
        from = document.activeElement;
        closeBtn.focus({ preventScroll: true });
      } else if (from) {
        from.focus({ preventScroll: true });
      }
    };

    openBtn.addEventListener("click", () => set(true));
    closeBtn.addEventListener("click", () => set(false));
    if (bg) bg.addEventListener("click", () => set(false)); // bấm vùng tối bên trái thì đóng
    menu.addEventListener("click", (e) => {
      if (e.target.closest("a")) set(false); // bấm một mục thì đóng menu, trang tự cuộn tới đó
    });
    addEventListener("keydown", (e) => {
      if (e.key === "Escape" && menu.classList.contains("on")) set(false);
    });
  }
  /* ---------- 8f. Practice: một dải lụa xanh dương dày chuyển động trên nền đen (WebGL shader) ---------- */
  function initGlow() {
    const dark = $(".dark");
    if (!dark) return;

    const SCALE = 0.5; // độ phân giải so với kích thước thật: nhỏ hơn thì nhẹ hơn
    const SPEED = 0.6; // tốc độ chuyển động: lớn hơn thì dải trôi nhanh hơn
    const COLORS = [
      // 0 = màu sáng của lõi và các sợi lụa, 1 = màu thân và vùng tỏa (0 đến 1). Xanh dương Apple #0a84ff = [0.039, 0.518, 1.0]
      [0.5, 0.78, 1.0], // xanh dương sáng (lõi)
      [0.039, 0.518, 1.0], // xanh dương Apple (thân và vùng tỏa)
    ];

    const cv = document.createElement("canvas");
    cv.className = "glow";
    cv.setAttribute("aria-hidden", "true");
    const gl = cv.getContext("webgl", {
      alpha: true,
      antialias: false,
      powerPreference: "low-power",
    });
    if (!gl) return;

    const VS = `attribute vec2 a;void main(){gl_Position=vec4(a,0.0,1.0);}`;
    const FS = `
      precision mediump float;
      uniform vec2 uR;
      uniform float uT;
      uniform vec3 uA;
      uniform vec3 uB;
      void main() {
        vec2 p = (gl_FragCoord.xy - 0.5 * uR) / uR.x * 2.0;
        // đường uốn của dải: chéo từ dưới trái lên trên phải, thêm hai sóng chậm để mềm như lụa
        float cur = 0.38 * p.x
          + 0.26 * sin(p.x * 1.3 + uT * 0.30)
          + 0.12 * sin(p.x * 2.7 - uT * 0.22 + 1.7);
        float d = p.y - cur;
        // bề dày dải đổi dọc theo chiều dài: chỗ phình chỗ thon (dày hơn bản trước khoảng 4 lần)
        float w = 0.2 + 0.14 * (0.5 + 0.5 * sin(p.x * 1.8 - uT * 0.25 + 0.8));
        float halo = exp(-d * d / (w * w * 2.2));          // vùng tỏa rộng, mềm
        float body = exp(-d * d / (w * w * 0.35));         // thân sáng ở giữa dải
        float cw = w * 0.07;
        float core = exp(-d * d / (cw * cw));              // lõi sáng mảnh
        float strands = 0.0;
        for (int i = 0; i < 4; i++) {
          float o = (float(i) - 1.5) * w * 0.28;
          float e = d - o;
          float sw = w * 0.05;
          strands += exp(-e * e / (sw * sw));              // các sợi lụa mảnh
        }
        vec3 col = uB * (halo * 0.32 + body * 0.38) + uA * (core * 0.55 + strands * 0.16);
        float a = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
        gl_FragColor = vec4(min(col, vec3(a)), a);
      }`;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VS);
    const fs = compile(gl.FRAGMENT_SHADER, FS);
    if (!vs || !fs) return;
    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
    gl.useProgram(prog);

    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW); // một tam giác phủ kín màn hình
    const loc = gl.getAttribLocation(prog, "a");
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

    const uR = gl.getUniformLocation(prog, "uR");
    const uT = gl.getUniformLocation(prog, "uT");
    gl.uniform3fv(gl.getUniformLocation(prog, "uA"), COLORS[0]);
    gl.uniform3fv(gl.getUniformLocation(prog, "uB"), COLORS[1]);

    dark.insertBefore(cv, dark.firstChild);

    const render = (sec) => {
      gl.uniform1f(uT, sec * SPEED);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    let vis = false,
      raf = 0;
    const t0 = performance.now();
    const loop = (now) => {
      raf = 0;
      render((now - t0) / 1000);
      if (vis && !document.hidden) raf = requestAnimationFrame(loop);
    };
    const start = () => {
      if (!reduce && vis && !document.hidden && !raf) raf = requestAnimationFrame(loop);
    };

    measurers.push(() => {
      const w = Math.max(2, Math.round(dark.clientWidth * SCALE));
      const h = Math.max(2, Math.round(dark.clientHeight * SCALE));
      if (cv.width !== w || cv.height !== h) {
        cv.width = w;
        cv.height = h;
      }
      gl.viewport(0, 0, w, h);
      gl.uniform2f(uR, w, h);
      render(reduce ? 4 : (performance.now() - t0) / 1000); // reduce: vẽ một khung tĩnh
    });

    if ("IntersectionObserver" in window && !reduce) {
      new IntersectionObserver((es) => {
        vis = es[es.length - 1].isIntersecting;
        start();
      }).observe(dark);
    }
    document.addEventListener("visibilitychange", start);
  }

  /* ---------- 9. Khởi động ---------- */
  initChrome();
  initMenuSpy();
  initTrail();
  initAccordion();
  initStack();
  initPills();
  initDark();
  initGlow();
  initBarTone();
  initMenu();
  initHeadings();
  initTop();
  initReveal();

  for (const m of measurers) m(); // đo trước khi vẽ lần đầu
  for (const p of painters) p(scrollY);

  addEventListener("scroll", schedule, { passive: true });
  addEventListener("resize", onResize(measureAll));
  addEventListener("load", measureAll);

  /* Trang đổi chiều cao (mở câu hỏi, ảnh tải xong...) thì đo lại, để thước zoom và các mốc luôn đúng.
     Chờ trang ngừng đổi ~90ms rồi đo một lần, để animation mở câu hỏi không bị đo lại mỗi khung hình */
  if ("ResizeObserver" in window) {
    let h = root.scrollHeight,
      t = 0;
    new ResizeObserver(() => {
      const nh = root.scrollHeight;
      if (nh === h) return;
      h = nh;
      clearTimeout(t);
      t = setTimeout(measureAll, 90);
    }).observe(document.body);
  }
})();
