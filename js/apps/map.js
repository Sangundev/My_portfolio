/* =========================================================
   js/apps/map.js: app Design Journey (bản đồ 3D TP.HCM)
   - Tự đăng ký vào window.WMApps.map, window-manager.js sẽ gọi build()
   - Cảnh dựng bằng CSS 3D: đế bản đồ (SVG đường / sông / công viên) + nhà hộp 3D + ghim
   - Camera: kéo = di chuyển, cuộn / chụm = zoom, Shift + kéo (hoặc chuột phải) = xoay / nghiêng
   - Bấm ghim hoặc mục ở chú thích: camera bay tới + mở cửa sổ thông tin; Esc / chấm đỏ / bấm nền = quay lại
   - CSS đi kèm: css/apps/map.css
   - Ảnh (tuỳ chọn, thiếu thì dùng hình dự phòng): assets/journey/<id>/cover.jpg, 1.jpg, 2.jpg
========================================================= */
(() => {
  /* ---------- DỮ LIỆU (sửa ở đây) ---------- */
  const BW = 1000, BH = 760;          // kích thước đế bản đồ (px)
  const CELL = 56, GX = 40, GY = 30;  // lưới khu phố: mỗi ô 56px, đường nằm ở ranh giới ô

  // Viền bản đồ (hình khối giống TP.HCM)
  const OUTLINE = [
    [90, 200], [150, 110], [270, 70], [400, 40], [520, 60], [640, 40], [780, 30], [900, 60],
    [950, 150], [930, 260], [960, 350], [920, 450], [960, 540], [880, 640], [760, 700],
    [640, 740], [500, 720], [380, 690], [280, 700], [170, 640], [110, 540], [60, 430], [80, 320],
  ];

  // Sông Sài Gòn (đường cong sẽ được làm mượt)
  const RIVER_KEY = [
    [900, 40], [850, 170], [890, 290], [830, 390], [690, 450], [620, 540], [660, 630], [620, 745],
  ];

  const PARKS = [
    { x: 150, y: 430, w: 140, h: 100 },
    { x: 690, y: 490, w: 150, h: 110 },
    { x: 380, y: 80, w: 100, h: 70 },
  ];

  // Đường lớn chạy theo lưới (số thứ tự cột / hàng của lưới)
  const ROAD_COLS = [4, 9, 14];
  const ROAD_ROWS = [3, 7, 10];

  // Tháp cao ở trung tâm: cell = [cột, hàng], tiers = các tầng chồng lên nhau
  const TOWERS = [
    { cell: [8, 5], tiers: [[64, 120], [46, 80], [28, 70], [8, 60]] },
    { cell: [5, 6], tiers: [[54, 90], [38, 50], [12, 36]] },
  ];

  // Các cột mốc công việc. cell = vị trí trên lưới, h = chiều cao toà nhà
  const COMPANIES = [
    {
      id: "a", name: "Company A", role: "UI/UX Designer", years: "2021 – 2022",
      color: "#a78bfa", cell: [3, 3], h: 62,
      address: "Quận Bình Thạnh, TP.HCM", url: "https://companya.com",
      tasks: [
        "Thiết kế giao diện website và ứng dụng di động",
        "Xây dựng wireframe và prototype cho từng tính năng",
        "Làm việc cùng developer để bàn giao thiết kế",
      ],
      projects: [
        { name: "Ứng dụng đặt lịch", img: "assets/journey/a/1.jpg" },
        { name: "Landing page", img: "assets/journey/a/2.jpg" },
      ],
      lesson: "Những dự án đầu tiên dạy tôi cách biến yêu cầu mơ hồ thành giao diện rõ ràng.",
      cover: "assets/journey/a/cover.jpg",
    },
    {
      id: "b", name: "Company B", role: "UI/UX Designer", years: "2022 – 2023",
      color: "#4da3ff", cell: [8, 2], h: 78,
      address: "Toà nhà XYZ, Quận 1, TP.HCM", url: "https://companyb.com",
      tasks: [
        "Thiết kế giao diện website và sản phẩm số",
        "Xây dựng layout, component và prototype",
        "Phối hợp với developer và team để phát triển sản phẩm",
      ],
      projects: [
        { name: "Dashboard quản trị", img: "assets/journey/b/1.jpg" },
        { name: "Website thương mại", img: "assets/journey/b/2.jpg" },
      ],
      lesson: "Lần đầu được làm việc với khách hàng nước ngoài, tôi học được cách lắng nghe, phân tích và giải quyết vấn đề trong môi trường thực tế.",
      cover: "assets/journey/b/cover.jpg",
    },
    {
      id: "c", name: "Company C", role: "Product Designer", years: "2023 – 2024",
      color: "#4ade80", cell: [12, 5], h: 70,
      address: "Quận 7, TP.HCM", url: "https://companyc.com",
      tasks: [
        "Dẫn dắt thiết kế cho một sản phẩm từ ý tưởng tới ra mắt",
        "Xây dựng design system dùng chung cho cả team",
        "Làm việc với dữ liệu người dùng để cải thiện trải nghiệm",
      ],
      projects: [
        { name: "Design system", img: "assets/journey/c/1.jpg" },
        { name: "Ứng dụng tài chính", img: "assets/journey/c/2.jpg" },
      ],
      lesson: "Một design system tốt giúp cả team đi nhanh hơn mà vẫn giữ được sự nhất quán.",
      cover: "assets/journey/c/cover.jpg",
    },
    {
      id: "d", name: "Company D", role: "Senior Designer", years: "2024 – 2025",
      color: "#fbbf24", cell: [5, 9], h: 66,
      address: "Quận 3, TP.HCM", url: "https://companyd.com",
      tasks: [
        "Định hướng thiết kế cho nhiều sản phẩm cùng lúc",
        "Hướng dẫn designer mới và review thiết kế",
        "Làm việc trực tiếp với đội ngũ sản phẩm và kinh doanh",
      ],
      projects: [
        { name: "Nền tảng học trực tuyến", img: "assets/journey/d/1.jpg" },
        { name: "Ứng dụng giao hàng", img: "assets/journey/d/2.jpg" },
      ],
      lesson: "Thiết kế tốt nhất đến từ việc hiểu rõ vấn đề của người dùng trước khi vẽ bất cứ thứ gì.",
      cover: "assets/journey/d/cover.jpg",
    },
  ];

  const TXT = {
    title: "Design Journey",
    lead: "Hành trình phát triển nghề nghiệp qua những điểm dừng thực tế.",
    sub: "Bản đồ TP.HCM với các cột mốc công việc và dự án quan trọng.",
    sign1: "Ho Chi Minh City",
    sign2: "My work. My journey.",
    tasks: "Công việc chính",
    projects: "Dự án tiêu biểu",
    lesson: "Những điều tôi học được",
  };

  const DEF = { rz: -38, rx: 58 };      // góc nhìn mặc định
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = () => window.matchMedia("(max-width:1100px)").matches;

  COMPANIES.forEach((c) => {
    c.x = GX + c.cell[0] * CELL + CELL / 2;
    c.y = GY + c.cell[1] * CELL + CELL / 2;
  });
  TOWERS.forEach((t) => {
    t.x = GX + t.cell[0] * CELL + CELL / 2;
    t.y = GY + t.cell[1] * CELL + CELL / 2;
  });

  /* ---------- ICON ---------- */
  const IC = {
    building: '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20.5v-4h4v4"/>',
    pin: '<path d="M12 20.5s-6-5.2-6-9.7a6 6 0 0112 0c0 4.5-6 9.7-6 9.7z"/><circle cx="12" cy="10.8" r="2.2"/>',
    link: '<path d="M10 14l8-8M12 6h6v6M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"/>',
    plus: '<path d="M6.5 12h11M12 6.5v11"/>',
    minus: '<path d="M6.5 12h11"/>',
    rotL: '<path d="M5.5 12a6.5 6.5 0 106.5-6.5H8.5"/><path d="M10.5 3L8 5.5 10.5 8"/>',
    rotR: '<path d="M18.5 12a6.5 6.5 0 11-6.5-6.5h3.5"/><path d="M13.5 3L16 5.5 13.5 8"/>',
    reset: '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
  };
  const ic = (k) => `<span class="ic"><svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg></span>`;

  /* ---------- HÀM PHỤ ---------- */
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const esc = (s) =>
    String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  const mulberry = (a) => () => {                       // random có hạt giống: mỗi lần mở app thành phố giống hệt nhau
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const inPoly = (x, y, P) => {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const [xi, yi] = P[i], [xj, yj] = P[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };

  const nearPoly = (x, y, P, r) => {                   // điểm (x,y) có cách đường gấp khúc P dưới r px không
    const r2 = r * r;
    for (let i = 1; i < P.length; i++) {
      const [ax, ay] = P[i - 1], [bx, by] = P[i];
      const dx = bx - ax, dy = by - ay;
      const t = clamp(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1), 0, 1);
      const px = ax + dx * t - x, py = ay + dy * t - y;
      if (px * px + py * py < r2) return true;
    }
    return false;
  };

  const smooth = (P, n = 8) => {                       // Catmull-Rom: nối các điểm thành đường cong mượt
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2] || p2;
      for (let k = 0; k < n; k++) {
        const t = k / n, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
      }
    }
    out.push(P[P.length - 1]);
    return out;
  };

  const RIVER = smooth(RIVER_KEY);
  const pathOf = (P) => "M" + P.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L");

  /* Tải ảnh thật nếu có, không có thì giữ hình dự phòng của CSS */
  const bgTry = (node, src) => {
    if (!src || !node) return;
    const im = new Image();
    im.onload = () => {
      node.style.backgroundImage = `url("${src}")`;
      node.classList.add("img");
    };
    im.src = src;
  };

  /* ---------- ĐẾ BẢN ĐỒ (SVG phẳng) ---------- */
  function mapSVG() {
    let minor = "";
    for (let i = 0; i <= 17; i++) minor += `M${GX + i * CELL} 0V${BH}`;
    for (let j = 0; j <= 13; j++) minor += `M0 ${GY + j * CELL}H${BW}`;
    let majors = "";
    ROAD_COLS.forEach((i) => (majors += `M${GX + i * CELL} 0V${BH}`));
    ROAD_ROWS.forEach((j) => (majors += `M0 ${GY + j * CELL}H${BW}`));

    const parks = PARKS.map(
      (p) =>
        `<rect x="${p.x}" y="${p.y}" width="${p.w}" height="${p.h}" rx="12" fill="#17402f" stroke="#3ddc97" stroke-opacity=".28"/>` +
        `<rect x="${p.x + 8}" y="${p.y + 8}" width="${p.w - 16}" height="${p.h - 16}" rx="8" fill="#1f5a41" opacity=".6"/>`,
    ).join("");

    const glows = COMPANIES.map(
      (c) => `<radialGradient id="mpc-${c.id}"><stop offset="0" stop-color="${c.color}" stop-opacity=".6"/><stop offset="1" stop-color="${c.color}" stop-opacity="0"/></radialGradient>`,
    ).join("");
    const spots = COMPANIES.map((c) => `<circle cx="${c.x}" cy="${c.y}" r="95" fill="url(#mpc-${c.id})"/>`).join("");
    const river = pathOf(RIVER);

    return `<svg viewBox="0 0 ${BW} ${BH}" width="${BW}" height="${BH}" aria-hidden="true">
      <defs>
        <radialGradient id="mpg" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#2a3260"/><stop offset="1" stop-color="#141830"/></radialGradient>
        <filter id="mpb" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="6"/></filter>
        ${glows}
      </defs>
      <rect width="${BW}" height="${BH}" fill="url(#mpg)"/>
      <path d="${minor}" stroke="#8ca0ff" stroke-opacity=".09" stroke-width="1" fill="none"/>
      ${parks}
      ${spots}
      <g filter="url(#mpb)" fill="none" stroke-linecap="round" stroke-linejoin="round">
        <path d="${river}" stroke="#2f6bff" stroke-opacity=".75" stroke-width="58"/>
      </g>
      <path d="${river}" fill="none" stroke="#1b4fd1" stroke-width="40" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${river}" fill="none" stroke="#5aa2ff" stroke-opacity=".55" stroke-width="16" stroke-linecap="round" stroke-linejoin="round"/>
      <g filter="url(#mpb)" fill="none"><path d="${majors}" stroke="#7c8cff" stroke-opacity=".65" stroke-width="7"/></g>
      <path d="${majors}" fill="none" stroke="#a9b8ff" stroke-opacity=".8" stroke-width="2.2"/>
      <polygon points="${OUTLINE.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#96aaff" stroke-opacity=".45" stroke-width="3"/>
    </svg>`;
  }

  /* ---------- HỘP 3D ---------- */
  function cuboid(x, y, w, d, h, z, cls, vars) {
    const b = el("div", "mp-bx " + cls, '<i class="t"></i><i class="s fr"></i><i class="s bk"></i><i class="s rt"></i><i class="s lf"></i>');
    b.style.cssText = `left:${x.toFixed(1)}px;top:${y.toFixed(1)}px;width:${w.toFixed(1)}px;height:${d.toFixed(1)}px;--h:${h.toFixed(1)}px;` + (z ? `transform:translateZ(${z}px);` : "") + (vars || "");
    return b;
  }

  /* Dựng toàn bộ đế + thành phố vào board, trả về map id -> phần tử ghim */
  function makeBoard(board, onPick) {
    const clip = "polygon(" + OUTLINE.map((p) => p[0] + "px " + p[1] + "px").join(",") + ")";

    board.append(el("div", "mp-layer mp-shadow"));
    for (let k = 7; k >= 1; k--) {                     // 7 lớp mỏng xếp chồng = độ dày của đế
      const s = el("div", "mp-layer");
      s.style.clipPath = s.style.webkitClipPath = clip;
      s.style.transform = `translateZ(${-k * 3}px)`;
      s.style.background = `hsl(230 40% ${26 - k * 2.5}%)`;
      board.append(s);
    }
    const top = el("div", "mp-layer mp-top", mapSVG());
    top.style.clipPath = top.style.webkitClipPath = clip;
    board.append(top);

    const city = el("div", "mp-city");
    const rng = mulberry(7);
    const frag = document.createDocumentFragment();

    /* nhà thường: mỗi ô lưới một toà, né sông / công viên / điểm mốc */
    for (let j = 0; j < 13; j++) {
      for (let i = 0; i < 17; i++) {
        const cx = GX + i * CELL + CELL / 2, cy = GY + j * CELL + CELL / 2;
        if (rng() < 0.1) continue;
        const w = 26 + rng() * 20, d = 26 + rng() * 20;
        const x = cx - w / 2, y = cy - d / 2;
        const inside = [[x - 8, y - 8], [x + w + 8, y - 8], [x - 8, y + d + 8], [x + w + 8, y + d + 8]].every((p) => inPoly(p[0], p[1], OUTLINE));
        if (!inside) continue;
        if (nearPoly(cx, cy, RIVER, 38)) continue;
        if (PARKS.some((p) => cx > p.x - 12 && cx < p.x + p.w + 12 && cy > p.y - 12 && cy < p.y + p.h + 12)) continue;
        if (COMPANIES.some((c) => Math.hypot(cx - c.x, cy - c.y) < 62)) continue;
        if (TOWERS.some((t) => Math.hypot(cx - t.x, cy - t.y) < 70)) continue;
        const f = Math.max(0, 1 - Math.hypot(cx - 500, cy - 340) / 380);        // càng gần trung tâm càng cao
        const h = 12 + rng() * rng() * 34 + f * (30 + rng() * 50);
        frag.append(cuboid(x, y, w, d, h, 0, "tn" + ((rng() * 4) | 0)));
        if (h > 55 && rng() < 0.6) frag.append(cuboid(x + w * 0.3, y + d * 0.3, w * 0.4, d * 0.4, 8, h, "tn3"));
      }
    }

    /* tháp cao trung tâm */
    TOWERS.forEach((t) => {
      let z = 0;
      t.tiers.forEach(([s, h]) => {
        frag.append(cuboid(t.x - s / 2, t.y - s / 2, s, s, h, z, "tw"));
        z += h;
      });
    });

    /* cây trong công viên (đứng thẳng, luôn quay mặt về camera) */
    PARKS.forEach((p) => {
      const n = Math.round((p.w * p.h) / 800);
      for (let k = 0; k < n; k++) {
        const tr = el("div", "mp-tree");
        tr.style.left = p.x + 14 + rng() * (p.w - 28) + "px";
        tr.style.top = p.y + 14 + rng() * (p.h - 28) + "px";
        frag.append(tr);
      }
    });

    /* điểm mốc: toà nhà màu + bệ + vòng sóng + ghim */
    const markers = new Map();
    COMPANIES.forEach((c) => {
      const vars = `--c:${c.color};`;
      frag.append(cuboid(c.x - 26, c.y - 26, 52, 52, c.h, 0, "co", vars));
      frag.append(cuboid(c.x - 17, c.y - 17, 34, 34, 14, c.h, "co", vars));
      const z = c.h + 14;

      const ring = el("div", "mp-ring");
      ring.style.cssText = `left:${c.x}px;top:${c.y}px;--c:${c.color};`;
      frag.append(ring);

      const pad = el("div", "mp-pad");
      pad.style.cssText = `left:${c.x}px;top:${c.y}px;--c:${c.color};transform:translateZ(${z + 0.8}px);`;
      frag.append(pad);

      const mk = el("div", "mp-mk", `<button class="mp-bob" type="button" aria-label="${esc(c.name)}, ${esc(c.years)}">
          <span class="mp-lab">${ic("building")}<span><b>${esc(c.name)}</b><small>${esc(c.years)}</small></span></span>
          <span class="mp-pin"></span></button>`);
      mk.style.cssText = `left:${c.x}px;top:${c.y}px;--c:${c.color};--z:${z + 1}px;`;
      mk.querySelector("button").addEventListener("click", () => onPick(c.id));
      frag.append(mk);
      markers.set(c.id, mk);
    });

    city.append(frag);
    board.append(city);
    return markers;
  }

  /* ---------- BUILD ---------- */
  function build(body) {
    body.classList.add("flush", "mp-body");
    const BY = {};
    COMPANIES.forEach((c) => (BY[c.id] = c));

    const root = el("div", "mp");
    root.tabIndex = -1;
    const view = el("div", "mp-view");
    const world = el("div", "mp-world");
    const board = el("div", "mp-board");
    world.append(board);
    view.append(world);

    /* --- giao diện phủ lên --- */
    const title = el("div", "mp-title", `<h1>${esc(TXT.title)}</h1><p>${esc(TXT.lead)}</p><p class="sub">${esc(TXT.sub)}</p>`);
    const sign = el("div", "mp-sign", `<em>${esc(TXT.sign1)}</em><span>${esc(TXT.sign2)}</span>`);

    const compass = el("button", "mp-compass", `<span class="n">N</span><span class="mp-needle"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="1.2"/><path d="M12 3.8l3.2 8.2H8.8z" fill="currentColor"/><path d="M12 20.2L8.8 12h6.4z" fill="currentColor" fill-opacity=".3"/></svg></span>`);
    compass.type = "button";
    compass.setAttribute("aria-label", "Về hướng Bắc");
    const needle = compass.querySelector(".mp-needle");

    const mkBtn = (label, icon) => {
      const b = el("button", "mp-b", ic(icon));
      b.type = "button";
      b.setAttribute("aria-label", label);
      return b;
    };
    const bRotL = mkBtn("Xoay trái", "rotL");
    const bRotR = mkBtn("Xoay phải", "rotR");
    const bOut = mkBtn("Thu nhỏ", "minus");
    const bIn = mkBtn("Phóng to", "plus");
    const bReset = mkBtn("Xem toàn cảnh", "reset");
    const ctl = el("div", "mp-ctl");
    const pill = el("div", "mp-pill");
    pill.append(bRotL, bRotR, bOut, bIn, bReset);
    ctl.append(pill);

    const legend = el("div", "mp-legend");
    legend.setAttribute("aria-label", "Dòng thời gian");
    COMPANIES.forEach((c) => {
      const b = el("button", "mp-lg", `${ic("building")}<span><small>${esc(c.years)}</small><b>${esc(c.name)}</b></span>`);
      b.type = "button";
      b.style.setProperty("--c", c.color);
      b.addEventListener("click", () => select(c.id));
      legend.append(b);
    });

    const info = el("aside", "mp-info", `<div class="mp-wbar"><button class="mp-dot r" type="button" aria-label="Đóng"></button><i class="mp-dot y"></i><i class="mp-dot g"></i></div><div class="mp-scroll"></div>`);
    info.setAttribute("aria-hidden", "true");
    const scroll = info.querySelector(".mp-scroll");

    root.append(view, title, sign, compass, ctl, legend, info);
    body.append(root);

    const markers = makeBoard(board, (id) => {
      if (dragged) return;
      select(id);
    });

    /* --- camera --- */
    const cam = { cx: BW / 2, cy: 390, s: 0.6, rz: DEF.rz, rx: DEF.rx, ox: 0, oy: 0 };
    const KEYS = ["cx", "cy", "rz", "rx", "ox", "oy"];
    const clampS = (s) => clamp(s, 0.25, 4);
    let raf = 0, sel = null, dragged = false, userMoved = false;
    let lrz = NaN, lrx = NaN, lks = NaN;

    function apply() {
      world.style.transform = `translate(${cam.ox}px,${cam.oy}px) scale3d(${cam.s},${cam.s},${cam.s}) rotateX(${cam.rx}deg) rotateZ(${cam.rz}deg) translate3d(${-cam.cx}px,${-cam.cy}px,0)`;
      if (cam.rz !== lrz) { lrz = cam.rz; world.style.setProperty("--rz", cam.rz + "deg"); }
      if (cam.rx !== lrx) { lrx = cam.rx; world.style.setProperty("--rx", cam.rx + "deg"); }
      const ks = +clamp(0.95 / cam.s, 0.62, 1.7).toFixed(2);       // ghim + nhãn co giãn nhẹ để vẫn đọc được
      if (ks !== lks) { lks = ks; world.style.setProperty("--ks", ks); }
      needle.style.transform = `rotate(${cam.rz}deg)`;
    }

    function overview() {
      const W = view.clientWidth || 1000, H = view.clientHeight || 640, mob = small();
      return {
        cx: BW / 2, cy: 390, rz: DEF.rz, rx: DEF.rx, ox: 0,
        s: clampS(Math.min((W * 0.92) / 1256, (H * (mob ? 0.7 : 0.86)) / 780)),
        oy: mob ? -H * 0.04 : H * 0.02,
      };
    }

    function fly(to, ms = 900) {
      cancelAnimationFrame(raf);
      const from = { ...cam }, goal = { ...cam, ...to };
      goal.rz = from.rz + ((((goal.rz - from.rz) % 360) + 540) % 360) - 180;   // xoay theo đường ngắn nhất
      if (reduce || ms <= 0) {
        Object.assign(cam, goal);
        apply();
        return;
      }
      const t0 = performance.now();
      const step = (now) => {
        if (!root.isConnected) return;
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        KEYS.forEach((key) => (cam[key] = from[key] + (goal[key] - from[key]) * e));
        cam.s = from.s * Math.pow(goal.s / from.s, e);
        apply();
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    }

    /* --- chọn / bỏ chọn điểm mốc --- */
    function focusOn(c, ms) {
      const mob = small();
      fly({
        cx: c.x, cy: c.y, rx: 54,
        s: clampS(overview().s * 2.6),
        ox: mob ? 0 : -(info.offsetWidth + 28) / 2,
        oy: mob ? -view.clientHeight * 0.2 : 0,
      }, ms);
    }

    function fill(c) {
      info.style.setProperty("--c", c.color);
      const href = /^https?:\/\//.test(c.url) ? c.url : "#";
      scroll.innerHTML = `
        <div class="mp-cover"></div>
        <div class="mp-pbody">
          <div class="mp-hd">${ic("building")}<div><h2>${esc(c.name)}</h2><p>${esc(c.role)}</p><p class="yr">${esc(c.years)}</p></div></div>
          <div class="mp-meta">
            <span>${ic("pin")}<span>${esc(c.address)}</span></span>
            <a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${ic("link")}<span>${esc(c.url.replace(/^https?:\/\//, ""))}</span></a>
          </div>
          <h3>${esc(TXT.tasks)}</h3>
          <ul>${c.tasks.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <h3>${esc(TXT.projects)}</h3>
          <div class="mp-proj">${c.projects.map((p) => `<figure class="mp-pj"><i></i><figcaption>${esc(p.name)}</figcaption></figure>`).join("")}</div>
          <h3>${esc(TXT.lesson)}</h3>
          <blockquote>${esc(c.lesson)}</blockquote>
        </div>`;
      bgTry(scroll.querySelector(".mp-cover"), c.cover);
      scroll.querySelectorAll(".mp-pj i").forEach((n, i) => bgTry(n, c.projects[i] && c.projects[i].img));
      scroll.scrollTop = 0;
    }

    function select(id) {
      const c = BY[id];
      if (!c) return;
      userMoved = true;
      if (sel === id) return;
      sel = id;
      markers.forEach((m, k) => m.classList.toggle("on", k === id));
      fill(c);
      root.classList.add("has-sel", "open");
      info.classList.add("in");
      info.setAttribute("aria-hidden", "false");
      focusOn(c, 1000);
    }

    function closeInfo() {
      if (!sel) return;
      sel = null;
      markers.forEach((m) => m.classList.remove("on"));
      root.classList.remove("has-sel", "open");
      info.classList.remove("in");
      info.setAttribute("aria-hidden", "true");
      fly(overview(), 900);
    }

    info.querySelector(".mp-dot.r").addEventListener("click", closeInfo);

    /* --- nút điều khiển --- */
    const nudge = (d) => { userMoved = true; fly(d, 320); };
    bRotL.addEventListener("click", () => nudge({ rz: cam.rz - 22 }));
    bRotR.addEventListener("click", () => nudge({ rz: cam.rz + 22 }));
    bIn.addEventListener("click", () => nudge({ s: clampS(cam.s * 1.35) }));
    bOut.addEventListener("click", () => nudge({ s: clampS(cam.s / 1.35) }));
    bReset.addEventListener("click", () => {
      if (sel) closeInfo();
      else { userMoved = false; fly(overview(), 800); }
    });
    compass.addEventListener("click", () => nudge({ rz: DEF.rz, rx: DEF.rx }));

    /* --- kéo / chụm / cuộn --- */
    const panFrom = (base, dx, dy) => {
      const a = (base.rz * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
      const ux = dx / base.s, uy = dy / (base.s * Math.cos((base.rx * Math.PI) / 180));
      cam.cx = clamp(base.cx - (ux * c + uy * s), 0, BW);
      cam.cy = clamp(base.cy - (-ux * s + uy * c), 0, BH);
    };

    const ptrs = new Map();
    let g = null;

    view.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button === 1) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      root.focus({ preventScroll: true });
      cancelAnimationFrame(raf);
      userMoved = true;
      if (ptrs.size === 1) {
        g = { mode: e.shiftKey || e.button === 2 ? "rot" : "pan", x: e.clientX, y: e.clientY, moved: false, c0: { ...cam } };
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        g = { mode: "pinch", d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, s0: cam.s, moved: true };
        try { view.setPointerCapture(e.pointerId); } catch {}
      }
    });

    view.addEventListener("pointermove", (e) => {
      const p = ptrs.get(e.pointerId);
      if (!p || !g) return;
      p.x = e.clientX;
      p.y = e.clientY;
      if (g.mode === "pinch") {
        if (ptrs.size < 2) return;
        const [a, b] = [...ptrs.values()];
        cam.s = clampS((g.s0 * Math.hypot(a.x - b.x, a.y - b.y)) / g.d0);
        apply();
        return;
      }
      const dx = e.clientX - g.x, dy = e.clientY - g.y;
      if (!g.moved) {
        if (Math.hypot(dx, dy) < 5) return;               // chưa đủ 5px thì vẫn tính là bấm (để bấm ghim được)
        g.moved = true;
        view.classList.add("drag");
        try { view.setPointerCapture(e.pointerId); } catch {}
      }
      if (g.mode === "rot") {
        cam.rz = g.c0.rz + dx * 0.4;
        cam.rx = clamp(g.c0.rx - dy * 0.2, 34, 72);
      } else {
        panFrom(g.c0, dx, dy);
      }
      apply();
    });

    const endPtr = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      if (g && g.moved) {
        dragged = true;                                   // chặn click "ảo" ngay sau khi kéo
        setTimeout(() => { dragged = false; }, 0);
      }
      if (ptrs.size === 0) {
        g = null;
        view.classList.remove("drag");
      } else if (g && g.mode === "pinch") {
        g = null;
      }
    };
    view.addEventListener("pointerup", endPtr);
    view.addEventListener("pointercancel", endPtr);
    view.addEventListener("contextmenu", (e) => e.preventDefault());

    view.addEventListener("click", (e) => {                // bấm vào nền trống = đóng cửa sổ thông tin
      if (dragged || e.target.closest(".mp-mk")) return;
      closeInfo();
    });

    view.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        cancelAnimationFrame(raf);
        userMoved = true;
        cam.s = clampS(cam.s * Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)));
        apply();
      },
      { passive: false },
    );

    /* --- bàn phím --- */
    root.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "Escape") {
        if (sel) { e.preventDefault(); e.stopPropagation(); closeInfo(); }
        return;
      }
      const st = 60;
      if (k.startsWith("Arrow")) {
        e.preventDefault();
        userMoved = true;
        cancelAnimationFrame(raf);
        panFrom(cam, k === "ArrowLeft" ? st : k === "ArrowRight" ? -st : 0, k === "ArrowUp" ? st : k === "ArrowDown" ? -st : 0);
        apply();
      } else if (k === "+" || k === "=") nudge({ s: clampS(cam.s * 1.25) });
      else if (k === "-" || k === "_") nudge({ s: clampS(cam.s / 1.25) });
      else if (k === "q" || k === "Q") nudge({ rz: cam.rz - 22 });
      else if (k === "e" || k === "E") nudge({ rz: cam.rz + 22 });
    });

    /* --- khởi động: đợi có kích thước rồi mới bay vào toàn cảnh --- */
    let started = false;
    const ro = new ResizeObserver(() => {
      if (!root.isConnected) { ro.disconnect(); return; }
      if (!view.clientWidth) return;
      if (!started) {
        started = true;
        const ov = overview();
        Object.assign(cam, ov, { s: ov.s * 0.55, rz: -120, rx: 72 });
        apply();
        fly(ov, 1800);
      } else if (sel) {
        focusOn(BY[sel], 0);
      } else if (!userMoved) {
        Object.assign(cam, overview());
        apply();
      }
    });
    ro.observe(view);
    apply();
  }

  /* ---------- ĐĂNG KÝ APP ---------- */
  (window.WMApps = window.WMApps || {}).map = {
    title: "Design Journey",
    w: 1040,
    h: 680,
    cls: "is-map",
    single: true,
    build: (body) => build(body),
  };
})();