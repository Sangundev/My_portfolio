/* =========================================================
   js/apps/map.js: app Design Journey (bản đồ 3D TP.HCM, phong cách diorama ban ngày)
   - Tự đăng ký vào window.WMApps.map, window-manager.js sẽ gọi build()
   - Vị trí các mốc dựng từ TỌA ĐỘ THẬT (lat/lng) rồi được CĂN VÀO Ô BLOCK gần nhất (bệ 3 x 2 block)
   - Khung bản đồ ôm sát 4 điểm mốc (PADX / PADY), viền hình chữ nhật bo góc
   - Mặt đất VẼ MỘT LẦN lên canvas; chỉ công trình cao + 4 điểm mốc là khối 3D
   - Zoom gần: nhà thấp mới dựng thành khối 3D, và chỉ ở các ô gần tâm màn hình (LOD + cắt ô)
   - Camera: kéo = di chuyển (có quán tính), cuộn / chụm = zoom mượt, Shift + kéo (hoặc chuột phải) = xoay / nghiêng
   - CSS đi kèm: css/apps/map.css
   - Ảnh (tuỳ chọn): assets/journey/<id>/cover.jpg, 1.jpg, 2.jpg

   THAY ĐỔI SO VỚI BẢN TRƯỚC (sửa hình học 3D):
   - cuboid(): THÊM tham số lv = số tầng nằm dưới hộp. Hộp ở tầng k được nâng k * Z_LIFT (trước đây chỉ nâng
     đúng 1 lần). Nhờ đó tường tầng trên luôn bắt đầu CAO HƠN mặt mái tầng dưới (h + 1/64) ở MỌI tầng; trước đây
     từ tầng thứ 3 trở đi (Landmark 81, mũ tháp, bể nước trên mái, lan can cầu) tường lại thấp hơn mái 1/64 và cắt
     mặt mái => Chromium cắt đôi mặt, lộ khe sáng dọc cạnh góc.
   - cuboid(): lượng tử hoá theo CẠNH (x và x + w), không theo (x, w) riêng lẻ => hai hộp liền kề dùng chung
     đúng một toạ độ cạnh, không còn khe / chồng mí 1/64 px.
   - tileOf(): gom theo TÂM TOÀ (ax, ay do map-city.js gắn) thay vì tâm từng khối. Đế và tháp của cùng một toà
     luôn nằm chung một ô LOD => không còn cảnh tháp còn mà đế biến mất khi cắt ô.
   - makeBoard(): gắn window.MapCity.debug = C. Dùng MapCity.debug.validate() trong console để kiểm tra
     khối lơ lửng / nhô ra / chồng lên nhau.
   - variantOf(): kiểu cửa sổ băm theo TOÀ (gid / màu công ty) thay vì theo từng khối.
   - apply(): chỉ ghi style nhãn khi vị trí đổi (bớt ghi DOM mỗi khung hình).
   - Yêu cầu map-city.js bản mới (C.roadsBase / C.roadsTop / C.placeSites / C.validate).
========================================================= */
(() => {
  /* ---------- BẢN ĐỒ: khung toạ độ + tỉ lệ ---------- */
  const PX_KM = 12.5; // 1 km = 12,5 px
  const ZONE_KM = 19; // px / km dùng RIÊNG cho bán kính các khu (map-city.js)
  const PADX = 58; // px chừa hai bên (Tây / Đông)
  const PADY = 42; // px chừa phía Bắc / Nam
  const KX = 109.3 * PX_KM; // px / độ kinh (tại vĩ độ ~10.8°)
  const KY = 110.6 * PX_KM; // px / độ vĩ
  // cực Tây = Nasani (106.6265), Đông = HUTECH (106.7852), Bắc = HUTECH (10.8553), Nam = Digibird (10.7905)
  const LNG0 = 106.6265 - PADX / KX,
    LNG1 = 106.7852 + PADX / KX; // Tây -> Đông
  const LAT0 = 10.7905 - PADY / KY,
    LAT1 = 10.8553 + PADY / KY; // Nam -> Bắc
  const BW = Math.round((LNG1 - LNG0) * KX);
  const BH = Math.round((LAT1 - LAT0) * KY);
  const GX = 0,
    GY = 0;
  const geo = (lat, lng) => [(lng - LNG0) * KX, (LAT1 - lat) * KY];

  /* ---------- TỐI ƯU: cắt ô + mức chi tiết (LOD) ---------- */
  const TILE = 150;
  const LOD_IN = 1.8,
    LOD_OUT = 1.55;
  const QL = [
    { minR: 170, majR: 230 },
    { minR: 240, majR: 330 },
    { minR: 320, majR: 460 },
  ];

  // Viền bản đồ: hình chữ nhật bo góc, ôm sát khung
  const OUTLINE = (() => {
    const r = 16,
      n = 4,
      pts = [];
    const corner = (cx, cy, a0) => {
      for (let i = 0; i <= n; i++) {
        const a = ((a0 + (90 * i) / n) * Math.PI) / 180;
        pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
      }
    };
    corner(r, r, 180);
    corner(BW - r, r, 270);
    corner(BW - r, BH - r, 0);
    corner(r, BH - r, 90);
    return pts;
  })();

  /* Sông Sài Gòn (toạ độ px của bản đồ, sẽ được làm mượt).
     Chạy dọc cột block thứ 4 (x 96..128) giữa Nasani và Miniai, rồi uốn xuống phía Nam, né mọi bệ điểm mốc. */
  const RIVER_KEY = [
    [112, -8],
    [112, 40],
    [112, 104],
    [114, 128],
    [122, 142],
    [134, 146],
    [144, 156],
    [144, 182],
  ];

  /* Công viên: căn đúng ô block (mép trùng lề phố) để không đè lên phố nào */
  const PARKS = [
    { x: 4 * 32 + 2.5, y: 2.5, w: 2 * 32 - 5, h: 32 - 5 },
    { x: 7 * 32 + 2.5, y: 2 * 32 + 2.5, w: 3 * 32 - 5, h: 32 - 5 },
    { x: 2.5, y: 2 * 32 + 2.5, w: 2 * 32 - 5, h: 32 - 5 },
  ];

  // Sân bay Tân Sơn Nhất (bệ 3 x 2 block, góc dưới trái) + Landmark 81 (nằm giữa một block)
  const AIRPORT = { p: [48, 128], rot: -28 };
  const TOWERS = [
    {
      p: [176, 112],
      name: "Landmark 81",
      tiers: [
        [20, 40],
        [15, 22],
        [9, 16],
        [3, 12],
      ],
    },
  ];
  const TAGS = [
    { name: "Sông Sài Gòn", p: [112, 46], z: 3, cls: "river" },
    { name: "Tân Sơn Nhất", p: AIRPORT.p, z: 4, cls: "air" },
  ];

  /* ---------- CÁC MỐC (thứ tự = dòng thời gian; HUTECH hiển thị đầu tiên) ---------- */
  const COMPANIES = [
    {
      id: "hutech",
      name: "HUTECH",
      role: "Sinh viên thiết kế",
      years: "Đại học",
      color: "#fbbf24",
      lat: 10.8553,
      lng: 106.7852,
      h: 66,
      address: "Khu Công nghệ cao XLHN, Tăng Nhơn Phú, TP. Hồ Chí Minh",
      tasks: [
        "Học nền tảng thiết kế: bố cục, màu sắc, chữ, trải nghiệm người dùng",
        "Làm đồ án và bài tập nhóm, tập trình bày ý tưởng trước lớp",
        "Xây dựng những sản phẩm đầu tiên cho portfolio",
      ],
      projects: [
        { name: "Đồ án tiêu biểu", img: "assets/journey/hutech/1.jpg" },
        { name: "Bài tập nhóm", img: "assets/journey/hutech/2.jpg" },
      ],
      lesson:
        "Nơi mình học cách biến một ý tưởng mơ hồ thành thứ nhìn thấy được và giải thích được.",
      cover: "assets/journey/hutech/cover.jpg",
    },
    {
      id: "miniai",
      name: "Miniai",
      role: "UI/UX Designer",
      years: "2021 – 2022",
      color: "#a78bfa",
      lat: 10.8425,
      lng: 106.711,
      h: 62,
      address:
        "152 Đường 16, Khu Đô Thị Vạn Phúc, Phường Hiệp Bình, TP. Hồ Chí Minh",
      tasks: [
        "Thiết kế giao diện website và ứng dụng di động",
        "Xây dựng wireframe và prototype cho từng tính năng",
        "Làm việc cùng developer để bàn giao thiết kế",
      ],
      projects: [
        { name: "Ứng dụng đặt lịch", img: "assets/journey/miniai/1.jpg" },
        { name: "Landing page", img: "assets/journey/miniai/2.jpg" },
      ],
      lesson:
        "Những dự án đầu tiên dạy tôi cách biến yêu cầu mơ hồ thành giao diện rõ ràng.",
      cover: "assets/journey/miniai/cover.jpg",
    },
    {
      id: "digibird",
      name: "Digibird",
      role: "UI/UX Designer",
      years: "2022 – 2023",
      color: "#4da3ff",
      lat: 10.7905,
      lng: 106.757,
      h: 78,
      address: "62 Lương Định Của, Phường Bình Trưng Tây, Thủ Đức, TP.HCM",
      tasks: [
        "Thiết kế giao diện website và sản phẩm số",
        "Xây dựng layout, component và prototype",
        "Phối hợp với developer và team để phát triển sản phẩm",
      ],
      projects: [
        { name: "Dashboard quản trị", img: "assets/journey/digibird/1.jpg" },
        { name: "Website thương mại", img: "assets/journey/digibird/2.jpg" },
      ],
      lesson:
        "Lần đầu được làm việc với khách hàng nước ngoài, tôi học được cách lắng nghe, phân tích và giải quyết vấn đề trong môi trường thực tế.",
      cover: "assets/journey/digibird/cover.jpg",
    },
    {
      id: "nasani",
      name: "Nasani",
      aka: "Nina",
      role: "Product Designer",
      years: "2023 – 2024",
      color: "#4ade80",
      lat: 10.8535,
      lng: 106.6265,
      h: 70,
      address:
        "Công viên phần mềm Quang Trung, Tòa nhà Saigon ICT, Lô 46 Quang Trung, Phường Trung Mỹ Tây, TP. Hồ Chí Minh",
      tasks: [
        "Dẫn dắt thiết kế cho một sản phẩm từ ý tưởng tới ra mắt",
        "Xây dựng design system dùng chung cho cả team",
        "Làm việc với dữ liệu người dùng để cải thiện trải nghiệm",
      ],
      projects: [
        { name: "Design system", img: "assets/journey/nasani/1.jpg" },
        { name: "Ứng dụng tài chính", img: "assets/journey/nasani/2.jpg" },
      ],
      lesson:
        "Một design system tốt giúp cả team đi nhanh hơn mà vẫn giữ được sự nhất quán.",
      cover: "assets/journey/nasani/cover.jpg",
    },
  ];

  const TXT = {
    title: "Design Journey",
    lead: "Hành trình phát triển nghề nghiệp qua những điểm dừng thực tế.",
    sub: "Bản đồ TP.HCM thu gọn quanh 4 điểm: đúng hướng Bắc, số km hiển thị là khoảng cách thật giữa các cột mốc.",
    sign1: "Ho Chi Minh City",
    sign2: "My work. My journey.",
    tasks: "Công việc chính",
    projects: "Dự án tiêu biểu",
    lesson: "Những điều tôi học được",
    dist: "Khoảng cách tới các mốc khác",
    distNote:
      "Khoảng cách thật theo đường chim bay (bản đồ đã được thu nhỏ). Quãng đường đi thực tế dài hơn.",
    maps: "Mở trên Google Maps",
  };

  const DEF = { rz: -28, rx: 58 }; // góc nhìn mặc định (rz = 0 là Bắc hướng lên)
  const MQ = window.matchMedia("(max-width:1100px)");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const small = () => MQ.matches;

  COMPANIES.forEach((c) => {
    [c.x, c.y] = geo(c.lat, c.lng); // vị trí tạm; map-city.js (placeSites) căn lại vào bệ block
  });
  TOWERS.forEach((t) => {
    [t.x, t.y] = t.p;
  });

  /* ---------- ICON ---------- */
  const IC = {
    building:
      '<rect x="5" y="3.5" width="14" height="17" rx="2"/><path d="M9 8h2M13 8h2M9 12h2M13 12h2M10 20.5v-4h4v4"/>',
    pin: '<path d="M12 20.5s-6-5.2-6-9.7a6 6 0 0112 0c0 4.5-6 9.7-6 9.7z"/><circle cx="12" cy="10.8" r="2.2"/>',
    link: '<path d="M10 14l8-8M12 6h6v6M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"/>',
    plus: '<path d="M6.5 12h11M12 6.5v11"/>',
    minus: '<path d="M6.5 12h11"/>',
    rotL: '<path d="M5.5 12a6.5 6.5 0 106.5-6.5H8.5"/><path d="M10.5 3L8 5.5 10.5 8"/>',
    rotR: '<path d="M18.5 12a6.5 6.5 0 11-6.5-6.5h3.5"/><path d="M13.5 3L16 5.5 13.5 8"/>',
    reset:
      '<circle cx="12" cy="12" r="6.5"/><circle cx="12" cy="12" r="1.6"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/>',
    arrow: '<path d="M12 19.5V5M6.5 10.5L12 5l5.5 5.5"/>',
  };
  const svgIc = (k) =>
    `<svg viewBox="0 0 24 24" aria-hidden="true">${IC[k]}</svg>`;
  const ic = (k) => `<span class="ic">${svgIc(k)}</span>`;

  /* ---------- HÀM PHỤ ---------- */
  const el = (tag, cls, html) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  };
  const ESC = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ESC[ch]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const RAD = Math.PI / 180;

  const mulberry = (a) => () => {
    // random có hạt giống: mỗi lần mở app thành phố giống hệt nhau
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const inPoly = (x, y, P) => {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const xi = P[i][0],
        yi = P[i][1],
        xj = P[j][0],
        yj = P[j][1];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi)
        c = !c;
    }
    return c;
  };

  const nearPoly = (x, y, P, r) => {
    // điểm (x,y) có cách đường gấp khúc P dưới r px không
    const r2 = r * r;
    for (let i = 1; i < P.length; i++) {
      const ax = P[i - 1][0],
        ay = P[i - 1][1],
        dx = P[i][0] - ax,
        dy = P[i][1] - ay;
      const t = clamp(
        ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1),
        0,
        1,
      );
      const px = ax + dx * t - x,
        py = ay + dy * t - y;
      if (px * px + py * py < r2) return true;
    }
    return false;
  };

  function smoothPts(P, n = 8) {
    // Catmull-Rom: nối các điểm thành đường cong mượt
    const out = [];
    for (let i = 0; i < P.length - 1; i++) {
      const p0 = P[i - 1] || P[i],
        p1 = P[i],
        p2 = P[i + 1],
        p3 = P[i + 2] || p2;
      for (let k = 0; k < n; k++) {
        const t = k / n,
          t2 = t * t,
          t3 = t2 * t;
        const f = (a, b, c, d) =>
          0.5 *
          (2 * b +
            (-a + c) * t +
            (2 * a - 5 * b + 4 * c - d) * t2 +
            (-a + 3 * b - 3 * c + d) * t3);
        out.push([
          f(p0[0], p1[0], p2[0], p3[0]),
          f(p0[1], p1[1], p2[1], p3[1]),
        ]);
      }
    }
    out.push(P[P.length - 1]);
    return out;
  }

  const RIVER = smoothPts(RIVER_KEY);
  const pathOf = (P) =>
    "M" + P.map((p) => p[0].toFixed(1) + " " + p[1].toFixed(1)).join("L");

  /* ---------- KHOẢNG CÁCH + HƯỚNG THẬT ---------- */
  function distKm(a, b) {
    // haversine
    const dLat = (b.lat - a.lat) * RAD,
      dLng = (b.lng - a.lng) * RAD;
    const h =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
  }
  function bearing(a, b) {
    // độ, tính từ Bắc theo chiều kim đồng hồ
    const dl = (b.lng - a.lng) * RAD,
      la = a.lat * RAD,
      lb = b.lat * RAD;
    const y = Math.sin(dl) * Math.cos(lb);
    const x =
      Math.cos(la) * Math.sin(lb) - Math.sin(la) * Math.cos(lb) * Math.cos(dl);
    return (Math.atan2(y, x) / RAD + 360) % 360;
  }
  const DIRS = [
    "Bắc",
    "Đông Bắc",
    "Đông",
    "Đông Nam",
    "Nam",
    "Tây Nam",
    "Tây",
    "Tây Bắc",
  ];
  const dirName = (b) => DIRS[Math.round(b / 45) % 8];
  const fmtKm = (k) => k.toFixed(1).replace(".", ",") + " km";

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

  /* ---------- MẶT ĐẤT: vẽ MỘT LẦN lên canvas ----------
     Thứ tự lớp (từ dưới lên) được cố định để không còn lớp nào chồng sai vị trí:
       nền -> ánh khu -> ĐƯỜNG (lề + nhựa) -> công viên / sân bay / nhà thấp + sân + cây -> SÔNG
       -> cầu + vạch giữa + tên đường + vạch qua đường -> tuyến hành trình -> quầng màu -> bệ điểm mốc */
  function drawGround(C) {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const SC = Math.min(
      small() ? 5 : clamp(dpr * 6, 7, 10),
      Math.sqrt(8e6 / (BW * BH)),
      8192 / Math.max(BW, BH),
    );
    const cv = document.createElement("canvas");
    cv.width = Math.round(BW * SC);
    cv.height = Math.round(BH * SC);
    cv.style.cssText = `display:block;width:${BW}px;height:${BH}px`;
    const g = cv.getContext("2d");
    if (!g) return cv;
    g.scale(SC, SC);
    g.lineCap = g.lineJoin = "round";
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = "high";
    const P2 = (d) => new Path2D(d);
    const rr = (x, y, w, h, r) => {
      g.beginPath();
      if (g.roundRect) g.roundRect(x, y, w, h, r);
      else g.rect(x, y, w, h);
    };
    const strokeLayers = (path, layers) => {
      for (const [w, c] of layers) {
        g.lineWidth = w;
        g.strokeStyle = c;
        g.stroke(path);
      }
    };

    /* viền bản đồ cắt thẳng trong canvas */
    const poly = new Path2D();
    OUTLINE.forEach((p, i) =>
      i ? poly.lineTo(p[0], p[1]) : poly.moveTo(p[0], p[1]),
    );
    poly.closePath();

    g.save();
    g.clip(poly);

    // 1. nền tấm mô hình: MỘT màu lát phẳng cho cả bản đồ
    g.fillStyle = "#d4d2c9";
    g.fillRect(0, 0, BW, BH);

    // 2. ánh khu rất nhẹ
    C.drawGround(g);

    // 3. mạng đường (lề sáng + mặt nhựa) của MỌI phố và đại lộ, vẽ gộp một lượt
    C.roadsBase(g);

    // 4. công viên kiểu Nhật: hồ, lối đi cong, đảo cỏ tròn, hoa anh đào, torii, đình, cầu đỏ
    const drawPark = (p, n) => {
      const r = mulberry(31 + n * 17),
        flip = n % 2 ? -1 : 1,
        TAU = Math.PI * 2;
      const U = (u) => (flip > 0 ? u : 1 - u);
      const px = (u) => p.x + p.w * U(u),
        py = (v) => p.y + p.h * v;

      g.save();
      rr(p.x, p.y, p.w, p.h, 3);
      g.clip();

      // cỏ nền
      const gg = g.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
      gg.addColorStop(0, "#72bd73");
      gg.addColorStop(1, "#5aa862");
      g.fillStyle = gg;
      g.fillRect(p.x, p.y, p.w, p.h);

      // hồ nước: 2 elip chồng nhau tạo hình tự nhiên
      const hc = [px(0.28), py(0.34)],
        hr = [p.w * 0.2, p.h * 0.26];
      const pond = [
        [hc[0], hc[1], hr[0], hr[1]],
        [hc[0] + hr[0] * 0.75 * flip, hc[1] + hr[1] * 0.2, hr[0] * 0.7, hr[1] * 0.8],
      ];
      const inPond = (x, y, m = 1.15) =>
        pond.some(([cx, cy, rx, ry]) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 < m);
      const pondPath = () => {
        g.beginPath();
        pond.forEach(([cx, cy, rx, ry]) => {
          g.moveTo(cx + rx, cy);
          g.ellipse(cx, cy, rx, ry, 0, 0, TAU);
        });
      };
      pondPath();
      g.fillStyle = "#e3eff0"; // viền đá sáng quanh hồ
      g.lineWidth = 1.6;
      g.strokeStyle = "#e3eff0";
      g.stroke();
      const wg = g.createLinearGradient(hc[0] - hr[0], hc[1] - hr[1], hc[0] + hr[0], hc[1] + hr[1]);
      wg.addColorStop(0, "#4cb6e0");
      wg.addColorStop(1, "#2a7fc4");
      pondPath();
      g.fillStyle = wg;
      g.fill();
      g.fillStyle = "rgba(220,240,255,.38)"; // vệt sáng mặt nước
      g.beginPath();
      g.ellipse(hc[0] - hr[0] * 0.2, hc[1] - hr[1] * 0.3, hr[0] * 0.45, hr[1] * 0.14, 0, 0, TAU);
      g.fill();

      // tre ven hồ (cọng mảnh màu vàng xanh)
      g.strokeStyle = "#b6da52";
      g.lineWidth = 0.25;
      g.beginPath();
      for (let k = 0; k < 9; k++) {
        const bx = hc[0] - hr[0] * 0.9 + (k * hr[0] * 1.8) / 8,
          by = hc[1] - hr[1] * 0.95;
        g.moveTo(bx, by);
        g.lineTo(bx + 0.2, by - 1.7);
      }
      g.stroke();

      // lối đi lát đá uốn cong băng qua công viên
      const xs = flip > 0 ? p.x - 2 : p.x + p.w + 2,
        xe = flip > 0 ? p.x + p.w + 2 : p.x - 2;
      const lane = new Path2D();
      lane.moveTo(xs, py(0.8));
      lane.bezierCurveTo(px(0.25), py(0.55), px(0.5), py(1.05), px(0.75), py(0.62));
      lane.lineTo(xe, py(0.7));
      g.lineCap = "butt";
      g.strokeStyle = "#cfcdc4";
      g.lineWidth = 3.8;
      g.stroke(lane);
      g.strokeStyle = "#eceae3";
      g.lineWidth = 3;
      g.stroke(lane);
      g.strokeStyle = "rgba(110,115,130,.35)"; // vân lát đá
      g.lineWidth = 0.2;
      g.setLineDash([0.9, 0.9]);
      g.stroke(lane);
      g.setLineDash([]);
      g.lineCap = "round";

      // đảo cỏ tròn có viền lát
      const isl = [
        [px(0.1), py(0.68), 3.2],
        [px(0.44), py(0.82), 2.6],
        [px(0.9), py(0.28), 2.8],
      ];
      isl.forEach(([x, y, rad]) => {
        g.fillStyle = "#e8e6df";
        g.beginPath();
        g.arc(x, y, rad + 1.3, 0, TAU);
        g.fill();
        g.fillStyle = "#82c985";
        g.beginPath();
        g.arc(x, y, rad, 0, TAU);
        g.fill();
      });

      // sân chơi: cát + bể bơi nhỏ
      g.fillStyle = "#dcbc8c";
      g.beginPath();
      g.ellipse(px(0.62), py(0.4), p.w * 0.08, p.h * 0.14, 0.2, 0, TAU);
      g.fill();
      g.fillStyle = "#5cc6dc";
      g.beginPath();
      g.ellipse(px(0.76), py(0.46), p.w * 0.06, p.h * 0.1, -0.2, 0, TAU);
      g.fill();

      // cầu đỏ bắc qua hồ + đình nhỏ trên đảo
      const bx = pond[1][0],
        by = pond[1][1];
      g.strokeStyle = "#c4372f";
      g.lineWidth = 1.1;
      g.beginPath();
      g.moveTo(bx - 1.4 * flip, by + pond[1][3] * 0.95);
      g.lineTo(bx + 1.8 * flip, by + pond[1][3] * 1.25);
      g.stroke();
      const hx = bx + pond[1][2] * 0.2 * flip,
        hy = by - pond[1][3] * 0.1;
      g.fillStyle = "#eceae2";
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k * TAU) / 6;
        g.lineTo(hx + Math.cos(a) * 1.8, hy + Math.sin(a) * 1.8);
      }
      g.closePath();
      g.fill();
      g.fillStyle = "#8a7f78";
      g.beginPath();
      g.arc(hx, hy, 1, 0, TAU);
      g.fill();

      // cổng torii đỏ
      const tx = px(0.54),
        ty = py(0.62);
      g.fillStyle = "#d6403a";
      g.fillRect(tx - 1.3, ty - 1.4, 0.45, 2.6);
      g.fillRect(tx + 0.85, ty - 1.4, 0.45, 2.6);
      g.fillRect(tx - 1.7, ty - 1.5, 3.4, 0.5);

      // cây: gom hết rồi sắp theo y để tán cây phía sau nằm dưới
      const T = [];
      isl.forEach(([x, y], i) => T.push({ x, y, rad: 2, t: i === 1 ? "g" : "p" }));
      const cnt = Math.round((p.w * p.h) / 60);
      for (let k = 0; k < cnt; k++) {
        const x = p.x + 2.5 + r() * (p.w - 5),
          y = p.y + 2.5 + r() * (p.h - 5);
        if (inPond(x, y)) continue;
        if (isl.some(([ix, iy, ir]) => Math.hypot(x - ix, y - iy) < ir + 2.2)) continue;
        if (Math.hypot(x - tx, y - ty) < 3) continue;
        const u = r();
        T.push({ x, y, rad: 1.7 + r() * 1.5, t: u < 0.18 ? "p" : u < 0.3 ? "w" : "g" });
      }
      T.sort((a, b) => a.y - b.y);
      const COL = {
        p: ["#d9628f", "#f08cb2", "#fbd0e0"], // hoa anh đào
        w: ["#6fb04a", "#98cc66", "#d6ef9a"], // liễu
        g: ["#2f8f3b", "#4fb256", "#8fd98c"], // cây xanh
      };
      T.forEach(({ x, y, rad, t }) => {
        const [c1, c2, c3] = COL[t];
        g.fillStyle = "rgba(0,0,0,.26)";
        g.beginPath();
        g.arc(x + rad * 0.4, y + rad * 0.5, rad, 0, TAU);
        g.fill();
        g.fillStyle = c1;
        g.beginPath();
        g.arc(x, y, rad, 0, TAU);
        g.fill();
        g.fillStyle = c2;
        g.beginPath();
        g.arc(x - rad * 0.2, y - rad * 0.25, rad * 0.72, 0, TAU);
        g.fill();
        g.fillStyle = c3;
        g.beginPath();
        g.arc(x - rad * 0.4, y - rad * 0.45, rad * 0.3, 0, TAU);
        g.fill();
      });

      g.restore();
      rr(p.x, p.y, p.w, p.h, 3);
      g.strokeStyle = "rgba(30,100,50,.3)";
      g.lineWidth = 0.4;
      g.stroke();
    };
    PARKS.forEach((p, n) => drawPark(p, n));

    // 5. sân bay Tân Sơn Nhất: nhà ga + đường băng có vạch + đèn (nằm giữa bệ 3 x 2 block)
    g.save();
    g.translate(AIRPORT.p[0], AIRPORT.p[1]);
    g.rotate(AIRPORT.rot * RAD);
    g.scale(0.5, 0.5);
    [
      [-76, -6, 152, 12, 5, "#4d5361"],
      [-56, 16, 112, 9, 4, "#4d5361"],
      [-24, -34, 48, 16, 4, "#eceae3"],
    ].forEach(([x, y, w, h, r, f]) => {
      g.fillStyle = f;
      rr(x, y, w, h, r);
      g.fill();
      g.strokeStyle = "rgba(255,255,255,.9)";
      g.lineWidth = 1;
      g.stroke();
    });
    g.strokeStyle = "rgba(255,255,255,.85)";
    g.lineWidth = 1.2;
    g.setLineDash([7, 6]);
    g.beginPath();
    g.moveTo(-70, 0);
    g.lineTo(70, 0);
    g.moveTo(-50, 20.5);
    g.lineTo(50, 20.5);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = "rgba(255,226,140,.95)";
    g.beginPath();
    for (let x = -72; x <= 72; x += 9) {
      g.moveTo(x + 0.9, -6);
      g.arc(x, -6, 0.9, 0, Math.PI * 2);
      g.moveTo(x + 0.9, 6);
      g.arc(x, 6, 0.9, 0, Math.PI * 2);
    }
    g.fill();
    g.restore();

    // 6. nhà thấp + sân + hồ + cây (đã "nướng" sẵn)
    C.bake(g);

    // 7. sông: kè sáng + dòng nước + vệt sáng giữa dòng (vẽ SAU đường nên phố nhỏ dừng đúng bờ)
    strokeLayers(P2(pathOf(RIVER)), [
      [20, "rgba(120,130,150,.22)"],
      [16, "#ecebe3"],
      [13, "#2c64c8"],
      [9.5, "#4a8cf0"],
      [3.4, "rgba(190,220,255,.5)"],
    ]);

    // 8. cầu (đại lộ băng qua sông) + vạch giữa + tên đường + vạch qua đường
    C.roadsTop(g);

    // 9. (đã bỏ) tuyến nét đứt giữa các mốc

    // 10. quầng màu rất nhẹ quanh 4 khu (đánh dấu điểm mốc trên nền sáng)
    COMPANIES.forEach((c) => {
      const wide = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, 64);
      wide.addColorStop(0, c.color + "44");
      wide.addColorStop(0.6, c.color + "16");
      wide.addColorStop(1, c.color + "00");
      g.fillStyle = wide;
      g.fillRect(c.x - 64, c.y - 64, 128, 128);
    });

    // 11. nền diorama của 4 điểm mốc: bệ lát phẳng + sân + cây, vẽ SAU cùng
    C.bakeSites(g);
    g.restore();

    // nét cắt mép bản đồ: quầng mờ + vạch sáng mảnh
    g.strokeStyle = "rgba(120,150,255,.12)";
    g.lineWidth = 5;
    g.stroke(poly);
    g.strokeStyle = "rgba(150,175,255,.4)";
    g.lineWidth = 2;
    g.stroke(poly);
    g.strokeStyle = "rgba(235,240,255,.95)";
    g.lineWidth = 0.7;
    g.stroke(poly);
    return cv;
  }

  /* ---------- HỘP 3D ----------
     Tạo từ một mẫu có sẵn (cloneNode) thay cho innerHTML: nhanh hơn nhiều khi dựng hàng trăm khối. */
  const BOX_T = el(
    "div",
    "",
    '<i class="t"></i><i class="s fr"></i><i class="s bk"></i><i class="s rt"></i><i class="s lf"></i>',
  );

  /* Kết cấu cửa sổ: vẽ MỘT LẦN bằng canvas cho mỗi màu đèn, dùng làm một lớp nền duy nhất. */
  const CELL_W = 3.6,
    CELL_H = 2.28;
  const TEX = new Map();
  let texStyle = null;
  const texCss = [];
  let texFlush = 0;

  /* vẽ MỘT ô cửa. Quy ước: ĐÁY canvas = phía MÁI của tường (khớp cách CSS xoay các mặt bên) */
  function drawCell(g, W, H, kind, col, v) {
    g.clearRect(0, 0, W, H);

    if (kind === "glass") {
      // vách kính: tấm kính + khung nhôm mảnh
      g.fillStyle = col;
      g.fillRect(0, 0, W, H);
      const m = Math.round(H * 0.07);
      const gr = g.createLinearGradient(0, 0, W, H);
      gr.addColorStop(0, "rgba(255,255,255,.34)");
      gr.addColorStop(0.55, "rgba(255,255,255,.06)");
      gr.addColorStop(1, "rgba(10,60,90,.22)");
      g.fillStyle = gr;
      g.fillRect(m, m, W - 2 * m, H - 2 * m);
      g.strokeStyle = "rgba(8,50,80,.4)";
      g.lineWidth = m;
      g.strokeRect(m / 2, m / 2, W - m, H - m);
      return;
    }

    if (kind === "stripe") {
      // mặt đứng sọc đứng + băng sàn (khối HUTECH)
      g.globalAlpha = 0.92;
      g.fillStyle = col;
      g.fillRect(W * 0.31, 0, W * 0.38, H);
      g.globalAlpha = 0.6;
      g.fillStyle = "#ffffff";
      g.fillRect(0, H * 0.78, W, H * 0.1);
      g.globalAlpha = 1;
      return;
    }

    /* "day": cửa sổ có lề đều bốn phía, 3 kiểu xen kẽ để các toà không giống hệt nhau */
    const win = (x, y, w, h) => {
      g.fillStyle = col;
      g.fillRect(x, y, w, h);
      g.fillStyle = "rgba(255,255,255,.38)"; // phản quang ở mép trên của cửa (đáy canvas = phía trên)
      g.fillRect(x, y + h * 0.72, w, h * 0.28);
      g.strokeStyle = "rgba(30,50,80,.38)";
      g.lineWidth = 1.4;
      g.strokeRect(x + 0.7, y + 0.7, w - 1.4, h - 1.4);
    };
    let wx, wy, ww, wh;
    if (v === 1) {
      // cửa đôi
      ww = W * 0.26;
      wh = H * 0.6;
      wy = (H - wh) / 2;
      win(W * 0.2, wy, ww, wh);
      win(W * 0.54, wy, ww, wh);
      wx = W * 0.2;
      ww = W * 0.6;
    } else if (v === 2) {
      // cửa rộng + ban công
      ww = W * 0.64;
      wh = H * 0.5;
      wx = (W - ww) / 2;
      wy = H * 0.3;
      win(wx, wy, ww, wh);
      g.fillStyle = "rgba(60,50,45,.28)";
      g.fillRect(wx - W * 0.03, H * 0.16, ww + W * 0.06, H * 0.08); // lan can nhô ra dưới cửa
    } else {
      // cửa đơn
      ww = W * 0.6;
      wh = H * 0.6;
      wx = (W - ww) / 2;
      wy = (H - wh) / 2;
      win(wx, wy, ww, wh);
    }
    g.fillStyle = "rgba(255,255,255,.72)"; // bệ cửa (phía dưới thật = đỉnh canvas)
    g.fillRect(wx - W * 0.03, wy - H * 0.07, ww + W * 0.06, H * 0.07);
  }

  function texId(lit, v = 0) {
    const ci = lit.indexOf(":");
    const kind = ci > 0 ? lit.slice(0, ci) : "day",
      col = ci > 0 ? lit.slice(ci + 1) : lit;
    if (kind !== "day") v = 0; // chỉ nhà thường mới có nhiều kiểu cửa
    const key = lit + "|" + v;
    let id = TEX.get(key);
    if (id != null) return id;
    id = TEX.size;
    TEX.set(key, id);

    const W = 114,
      H = 72; // 114/72 = 1,583 khớp CELL_W/CELL_H (3,6/2,28): nét ngang và dọc dày bằng nhau
    const a = document.createElement("canvas");
    a.width = W;
    a.height = H;
    drawCell(a.getContext("2d"), W, H, kind, col, v);

    const b = document.createElement("canvas"); // bản chuyển vị cho mặt trái / phải
    b.width = H;
    b.height = W;
    const gb = b.getContext("2d");
    gb.setTransform(0, 1, 1, 0, 0, 0); // (x, y) -> (y, x)
    gb.drawImage(a, 0, 0);

    texCss.push(`.mp-bx[data-w="${id}"]{--tw:url("${a.toDataURL()}");--tw2:url("${b.toDataURL()}")}`);
    if (!texFlush)
      texFlush = requestAnimationFrame(() => {
        texFlush = 0;
        if (!texStyle) {
          texStyle = document.createElement("style");
          document.head.append(texStyle);
        }
        texStyle.textContent += texCss.splice(0).join("");
      });
    return id;
  }

  /* NÂNG TẦNG (Z_LIFT): hộp ở tầng k (k hộp nằm dưới nó) được nâng k * 1/16.
     Mặt mái của hộp nằm ở (đáy + h + 1/64). Tường hộp tầng trên bắt đầu ở (đáy mình + k/16) nên luôn cao hơn mái
     tầng dưới ít nhất ~2/64 (kể cả sai số làm tròn 1/64), tức KHÔNG BAO GIỜ cắt mặt mái đó.
     Hai mặt phẳng cắt nhau làm Chromium cắt đôi mặt khi sắp xếp độ sâu => khe sáng dọc cạnh góc.
     Khe nâng ~0,4 px ở zoom tối đa và lộ ra chính mặt mái tầng dưới nên không thấy "lỗ".
     lv bỏ trống thì mặc định: z > 0 => 1 tầng (tương thích code cũ). */
  const Z_LIFT = 1 / 16;

  function cuboid(x, y, w, d, h, z, cls, vars, wid, lv) {
    const b = BOX_T.cloneNode(true);
    b.className = "mp-bx " + cls;
    const q = (v) => Math.round(v * 64) / 64; // bội của 1/64 px: trùng đúng độ chia của trình duyệt, không bị làm tròn lại
    /* lượng tử hoá theo CẠNH: hai hộp liền kề (x1 của hộp này = x0 của hộp kia) dùng chung đúng một toạ độ */
    const xe = q(x + w),
      ye = q(y + d);
    x = q(x);
    y = q(y);
    w = xe - x;
    d = ye - y;
    h = q(h);
    if (lv == null) lv = z > 0 ? 1 : 0;
    z = z > 0 ? q(z) + Z_LIFT * lv : 0;
    let fit = "";
    if (wid != null) {
      const nc = Math.max(1, Math.round(w / CELL_W));
      const nd = Math.max(1, Math.round(d / CELL_W));
      const nr = Math.max(1, Math.round(h / CELL_H));
      fit = `--cw:${q(w / nc)}px;--cd:${q(d / nd)}px;--ch:${q(h / nr)}px;`;
    }
    b.style.cssText =
      `left:${x}px;top:${y}px;width:${w}px;height:${d}px;--h:${h}px;` +
      fit +
      (z ? `transform:translateZ(${z}px);` : "") +
      (vars || "");
    if (wid != null) b.dataset.w = wid;
    return b;
  }

  /* kiểu cửa sổ (0..2): băm theo TOÀ (gid; với điểm mốc là màu công ty) => đế, thân và tầng trên cùng một toà có cùng kiểu cửa.
     Cố định mỗi lần mở app. */
  const variantOf = (s) => {
    const k = String(s.gid ?? s.c ?? Math.round(s.x * 10) + "," + Math.round(s.y * 10));
    let h = 2166136261;
    for (let i = 0; i < k.length; i++)
      h = Math.imul(h ^ k.charCodeAt(i), 16777619);
    return (h >>> 0) % 3;
  };

  /* bản vẽ (spec) từ map-city.js -> phần tử HTML */
  function boxEl(s) {
    let v = "";
    if (s.c) v += `--c:${s.c};`;
    if (s.b) v += `--b:${s.b};`;
    if (s.lit) v += `--wx:${s.wx || 0}px;--wy:${s.wy || 0}px;`;
    return cuboid(
      s.x,
      s.y,
      s.w,
      s.d,
      s.h,
      s.z,
      s.cls,
      v,
      s.lit ? texId(s.lit, variantOf(s)) : null,
      s.lv,
    );
  }
  function flatEl(s) {
    const n = el("div", "mp-flat " + s.cls);
    n.style.cssText = `left:${s.x.toFixed(1)}px;top:${s.y.toFixed(1)}px;width:${s.w.toFixed(1)}px;height:${s.d.toFixed(1)}px;transform:translateZ(${s.z}px);--c:${s.c};`;
    return n;
  }

  /* chia bản vẽ vào ô lưới TILE x TILE; mk() tạo ô mới khi gặp ô chưa có.
     Dùng TÂM TOÀ (ax, ay) nếu có: mọi khối của một toà (đế, tháp, mũ tháp) luôn vào CÙNG một ô,
     nên cắt LOD không bao giờ tách một toà làm đôi. */
  function tileOf(map, s, mk) {
    const tx = Math.floor((s.ax ?? s.x + s.w / 2) / TILE),
      ty = Math.floor((s.ay ?? s.y + s.d / 2) / TILE),
      key = tx + "_" + ty;
    let t = map.get(key);
    if (!t) {
      t = mk();
      t.x0 = tx * TILE;
      t.y0 = ty * TILE;
      t.x1 = t.x0 + TILE;
      t.y1 = t.y0 + TILE;
      map.set(key, t);
    }
    return t;
  }

  /* Dựng toàn bộ đế + thành phố vào board.
     Trả về { markers, bills, lod, lbls } */
  function makeBoard(board, onPick) {
    const C = window.MapCity.create({
      BW,
      BH,
      PX_KM: ZONE_KM,
      geo,
      mulberry,
      inPoly,
      nearPoly,
      OUTLINE,
      RIVER,
      PARKS,
      AIRPORT,
      TOWERS,
      COMPANIES,
      GX,
      GY,
    });
    window.MapCity.debug = C; // gỡ lỗi: MapCity.debug.validate() trong console
    const bills = []; // { el, x, y, z, ar, deg }: nhãn 2D, vị trí được chiếu từ toạ độ bản đồ
    const lbls = el("div", "mp-lbls"); // lớp nhãn phẳng phủ lên cảnh 3D (chữ nét, không bị nội suy)

    board.append(el("div", "mp-layer mp-shadow"));
    /* thành bản đồ: mỗi cạnh của viền là một mặt đứng => thấy rõ "nét cắt" dày của mô hình */
    const WT = 15,
      nO = OUTLINE.length;
    for (let i = 0; i < nO; i++) {
      const a = OUTLINE[i],
        b = OUTLINE[(i + 1) % nO];
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        len = Math.hypot(dx, dy) || 1;
      const L = 26 + 9 * (-dx / len) - 4 * (dy / len); // hướng mặt: quay về Nam thì sáng hơn
      const wall = el("div", "mp-wall");
      wall.style.cssText =
        `left:${a[0].toFixed(1)}px;top:${a[1].toFixed(1)}px;width:${(len + 0.8).toFixed(1)}px;height:${WT}px;transform:rotateZ(${(Math.atan2(dy, dx) / RAD).toFixed(2)}deg) rotateX(-90deg);` +
        `background:repeating-linear-gradient(180deg,rgba(255,255,255,.07) 0 1px,transparent 1px 5px),linear-gradient(180deg,hsl(228 55% ${L + 9}%),hsl(231 50% ${L}%) 30%,hsl(234 55% ${Math.max(8, L - 11)}%));`;
      board.append(wall);
    }

    const city = C.fillCity(); // { majors, minors } (bản vẽ, chưa phải HTML)
    const lms = COMPANIES.map((c) => C.landmark(c)); // phải chạy TRƯỚC drawGround (cây quanh toà được vẽ sẵn)

    const top = el("div", "mp-layer mp-top");
    top.append(drawGround(C));
    board.append(top);

    const lod = {
      majTiles: new Map(),
      minTiles: [],
      minWrap: null,
      buildTile: null,
      ready: null,
    };

    /* --- nhà cao: khối 3D chia ô, dựng dần từng đợt cho khỏi đứng hình lúc mở app --- */
    const majWrap = el("div", "mp-city");
    const place = (s) => {
      const t = tileOf(lod.majTiles, s, () => {
        const e = el("div", "mp-tile");
        majWrap.append(e);
        return { el: e, on: true };
      });
      t.el.append(boxEl(s));
    };
    const queue = city.majors.slice().reverse();
    const pump = () => {
      const t0 = performance.now();
      while (queue.length && performance.now() - t0 < 3.5) place(queue.pop());
      if (queue.length) requestAnimationFrame(pump);
      else if (lod.ready) lod.ready(); // ô nhà cao mới dựng xong: áp lại LOD
    };

    /* --- nhà thấp: giữ bản vẽ theo ô, dựng khối 3D dần (tối đa 2 ô / lần) và luôn hiện ở mọi mức zoom --- */
    const minWrap = el("div", "mp-city");
    const mm = new Map();
    city.minors.forEach((s) =>
      tileOf(mm, s, () => ({ el: null, specs: [], on: false })).specs.push(s),
    );
    lod.minTiles = [...mm.values()];
    lod.minWrap = minWrap;
    lod.buildTile = (t) => {
      const e = el("div", "mp-tile");
      const f = document.createDocumentFragment();
      t.specs.forEach((s) => f.append(boxEl(s)));
      t.specs = null; // đã dựng xong: bỏ bản vẽ để giải phóng bộ nhớ
      e.append(f);
      minWrap.append(e);
      t.el = e;
      t.on = true;
    };

    /* --- phần còn lại (luôn có): Landmark 81, nhãn, chip, 4 điểm mốc --- */
    const mainWrap = el("div", "mp-city");
    const frag = document.createDocumentFragment();

    /* tháp cao (Landmark 81 kiểu ảnh mẫu): đế đá, thân kính, 4 cột góc, vành, mái tám cạnh cam, cột ăng-ten */
    TOWERS.forEach((t) => {
      const glassT = texId("glass:#7f9fc4"),
        stoneT = texId("day:#8b7a5c");
      const V = "--wx:3px;--wy:5px;";
      const bx = (dx, dy, w, d, h, z, lv, cls, tex) =>
        frag.append(
          cuboid(t.x + dx - w / 2, t.y + dy - d / 2, w, d, h, z, cls, V, tex, lv),
        );
      bx(0, 0, 26, 26, 6, 0, 0, "dz st lit", stoneT); // đế
      // [cạnh, cao, z]: thân thu nhỏ dần theo bậc
      [[18, 30, 6], [14, 30, 36], [11, 26, 66], [8, 22, 92]].forEach(([s, h, z], i) => {
        bx(0, 0, s, s, h, z, i + 1, "dz gl4 lit", glassT); // khối kính, đủ 4 mặt
      });
      bx(0, 0, 9, 9, 2, 114, 5, "dz gy", null); // mái đỉnh (xám, hết màu cam)
      bx(0, 0, 1.6, 1.6, 28, 116, 6, "dz sp", null); // ăng-ten
      t.top = 144;
    });

    /* nhãn địa danh nhỏ: sông, sân bay, Landmark 81, tên khu */
    const tagOf = (name, x, y, z, cls) => {
      const t = el(
        "div",
        "mp-mk mp-tg",
        `<span class="mp-tag ${cls || ""}">${esc(name)}</span>`,
      );
      lbls.append(t);
      bills.push({ el: t, x, y, z });
    };
    TAGS.forEach((t) => tagOf(t.name, t.p[0], t.p[1], t.z, t.cls));
    TOWERS.forEach((t) => tagOf(t.name, t.x, t.y, t.top + 8, "tower"));
    C.zoneTags().forEach((t) => tagOf(t.name, t.x, t.y, t.z, "zone"));

    /* chip khoảng cách + hướng ở giữa mỗi chặng của hành trình */
    for (let i = 1; i < COMPANIES.length; i++) {
      const a = COMPANIES[i - 1],
        b = COMPANIES[i];
      const brg = bearing(a, b);
      const t = el(
        "div",
        "mp-mk mp-sg",
        `<span class="mp-seg"><i class="ar">${svgIc("arrow")}</i><b>${fmtKm(distKm(a, b))}</b><small>${dirName(brg)}</small></span>`,
      );
      lbls.append(t);
      bills.push({
        el: t,
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2,
        z: 100,
        ar: t.querySelector(".ar"),
        deg: brg,
      });
    }

    /* điểm mốc: mô hình toà nhà + bệ + vòng sóng + ghim */
    const markers = new Map();
    const glows = new Map();
    COMPANIES.forEach((c, i) => {
      lms[i].specs.forEach((s) =>
        frag.append(s.k === "f" ? flatEl(s) : boxEl(s)),
      );
      const z = lms[i].top;

      const gp = c.pad,
        gs = 54; // đường kính vòng sóng (px), nhỏ quanh chân toà
      const glow = el("div", "mp-glow");
      glow.style.cssText = `left:${(gp[0] + gp[2]) / 2 - gs / 2}px;top:${(gp[1] + gp[3]) / 2 - gs / 2}px;width:${gs}px;height:${gs}px;--c:${c.color};`;
      frag.append(glow);
      glows.set(c.id, glow);

      const mk = el(
        "div",
        "mp-mk",
        `<button class="mp-bob" type="button" aria-label="${esc(c.name)}, ${esc(c.years)}">
          <span class="mp-lab">${ic("building")}<span><b>${esc(c.name)}</b><small>${esc(c.years)}</small></span></span>
          <span class="mp-pin"></span></button>`,
      );
      mk.style.cssText = `--c:${c.color};`;
      mk.firstChild.addEventListener("click", () => onPick(c.id));
      lbls.append(mk);
      markers.set(c.id, mk);
      bills.push({ el: mk, x: c.x, y: c.y, z: z + 1 });
    });

    mainWrap.append(frag);
    board.append(majWrap, minWrap, mainWrap);
    TRAIL = makeTrail(board, lbls, bills, markers, glows);
    requestAnimationFrame(pump); // dựng nhà cao sau khung hình đầu tiên
    return { markers, bills, lod, lbls };
  }

    /* ---------- NHÂN VẬT ĐI BỘ + ĐƯỜNG VÀNG GIỮA CÁC MỐC ---------- */
  const GRID = 32; // khớp block của map-city.js

  /* Tuyến tới từng mốc, tính theo ô block [i, j] (x = i*32, y = j*32).
     Để [] thì mốc đó dùng tuyến tự động. */
  const DEBUG_GRID = false; // true: hiện số ngã tư i,j trên bản đồ
  const ROUTE_VIA = {
    // chặng "từ>tới": danh sách ngã tư [i, j] nhân vật đi qua theo thứ tự
    "hutech>miniai": [],
    "miniai>digibird": [], // chặng 2 -> 3: điền các ngã tư của đoạn đường ở ảnh 2
    "digibird>nasani": [],
  };
  let TRAIL = null; // makeBoard() gán, select() gọi TRAIL.go(id)

  const MAN =
    '<svg class="mp-man" viewBox="0 0 34 34" aria-hidden="true">' +
    '<ellipse cx="17" cy="33" rx="9" ry="1.8" fill="rgba(0,0,0,.35)"/>' +
    /* đứng yên (khi tới mốc) */
    '<g class="stand" transform="translate(8 0)">' +
    '<rect x="5.6" y="19" width="3.2" height="13" rx="1.4" fill="#2b3350"/>' +
    '<rect x="9.2" y="19" width="3.2" height="13" rx="1.4" fill="#2b3350"/>' +
    '<rect class="arm" x="2" y="10.5" width="2.8" height="9" rx="1.4"/>' +
    '<rect class="arm" x="13.2" y="10.5" width="2.8" height="9" rx="1.4"/>' +
    '<rect class="tor" x="4.6" y="9.5" width="8.8" height="11" rx="3"/>' +
    '<circle cx="9" cy="5.2" r="3.9" fill="#f2c9a0"/>' +
    '<path d="M5 5.2a4 4 0 018 0c-2-1.6-6-1.6-8 0z" fill="#222222"/></g>' +
    /* chạy xe máy (khi đang trên đường) */
    '<g class="ride">' +
    '<g class="wh"><circle cx="8" cy="27" r="4.6" fill="none" stroke="#1b1b20" stroke-width="2.2"/><path d="M8 22.8v8.4M3.8 27h8.4" stroke="#8a8f9c" stroke-width=".8"/></g>' +
    '<g class="wh"><circle cx="27" cy="27" r="4.6" fill="none" stroke="#1b1b20" stroke-width="2.2"/><path d="M27 22.8v8.4M22.8 27h8.4" stroke="#8a8f9c" stroke-width=".8"/></g>' +
    '<path d="M8 27L14 21H23L27 27" fill="none" stroke="#c0392b" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M27 27L23.5 19M24 20.5L22.5 15" fill="none" stroke="#444a58" stroke-width="1.8" stroke-linecap="round"/>' +
    '<rect x="10.5" y="19.2" width="9" height="2.4" rx="1" fill="#222"/>' +
    '<circle cx="28" cy="20" r="1.3" fill="#ffe58a"/>' +
    '<rect x="14" y="17" width="3" height="8" rx="1.5" fill="#2b3350"/>' +
    '<rect class="tor" x="12" y="9" width="8" height="10" rx="3"/>' +
    '<rect class="arm" x="18" y="10.5" width="6.5" height="2.8" rx="1.4" transform="rotate(30 18 11.9)"/>' +
    '<circle cx="16" cy="5" r="3.6" fill="#f2c9a0"/>' +
    '<path d="M12.4 5a3.6 3.6 0 017.2 0c-2-1.4-5.2-1.4-7.2 0z" fill="#222222"/></g></svg>';

  function makeTrail(board, lbls, bills, markers, glows) {
    if (!COMPANIES[0].pad) return null;
    const NX = Math.floor(BW / GRID),
      NY = Math.floor(BH / GRID),
      W1 = NX + 1,
      N = W1 * (NY + 1);
    /* vùng không được đi xuyên qua: bệ các mốc, công viên, sân bay */
    const blocked = COMPANIES.filter((c) => c.pad).map((c) => c.pad);
    PARKS.forEach((p) => blocked.push([p.x, p.y, p.x + p.w, p.y + p.h]));
    blocked.push([2.5, 3 * GRID + 2.5, 3 * GRID - 2.5, 5 * GRID - 2.5]);

    const id = (i, j) => j * W1 + i;
    const xy = (k) => [(k % W1) * GRID, ((k / W1) | 0) * GRID];
    const edgeCost = (i0, j0, i1, j1) => {
      const x0 = i0 * GRID,
        y0 = j0 * GRID,
        x1 = i1 * GRID,
        y1 = j1 * GRID;
      const mx = (x0 + x1) / 2,
        my = (y0 + y1) / 2;
      for (const r of blocked)
        if (mx > r[0] && mx < r[2] && my > r[1] && my < r[3]) return -1;
      let pen = 0; // cắt ngang sông: phạt nặng để ưu tiên đường khác
      for (let k = 0; k <= 4; k++) {
        if (nearPoly(x0 + ((x1 - x0) * k) / 4, y0 + ((y1 - y0) * k) / 4, RIVER, 10.6)) {
          pen = 40;
          break;
        }
      }
      return GRID + pen;
    };
    const dijkstra = (src) => {
      const dist = new Array(N).fill(Infinity),
        prev = new Array(N).fill(-1),
        done = new Array(N).fill(false);
      dist[src] = 0;
      for (;;) {
        let u = -1,
          best = Infinity;
        for (let k = 0; k < N; k++)
          if (!done[k] && dist[k] < best) {
            best = dist[k];
            u = k;
          }
        if (u < 0) break;
        done[u] = true;
        const i = u % W1,
          j = (u / W1) | 0;
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const a = i + di,
            b = j + dj;
          if (a < 0 || b < 0 || a > NX || b > NY) continue;
          const w = edgeCost(i, j, a, b);
          if (w < 0) continue;
          const v = id(a, b);
          if (dist[u] + w < dist[v]) {
            dist[v] = dist[u] + w;
            prev[v] = u;
          }
        }
      }
      return { dist, prev };
    };
    /* 4 ngã tư ở góc bệ của một mốc */
    const cornersOf = (c) => {
      const p = c.pad,
        i0 = Math.round((p[0] - 2.5) / GRID),
        j0 = Math.round((p[1] - 2.5) / GRID),
        i1 = Math.round((p[2] + 2.5) / GRID),
        j1 = Math.round((p[3] + 2.5) / GRID);
      return [[i0, j0], [i1, j0], [i0, j1], [i1, j1]]
        .filter(([i, j]) => i <= NX && j <= NY)
        .map(([i, j]) => id(i, j));
    };
    const routeTo = (src, c) => {
      const { dist, prev } = dijkstra(src);
      let best = -1;
      cornersOf(c).forEach((k) => {
        if (dist[k] < Infinity && (best < 0 || dist[k] < dist[best])) best = k;
      });
      if (best < 0) return null;
      const nodes = [];
      for (let k = best; k >= 0; k = prev[k]) nodes.push(k);
      return nodes.reverse();
    };

    /* người bắt đầu ở HUTECH: góc bệ gần Miniai nhất */
    let here = cornersOf(COMPANIES[0])[0],
      bd = Infinity;
    cornersOf(COMPANIES[0]).forEach((k) => {
      const { dist } = dijkstra(k);
      cornersOf(COMPANIES[1] || COMPANIES[0]).forEach((m) => {
        if (dist[m] < bd) {
          bd = dist[m];
          here = k;
        }
      });
    });

    /* lớp đường vàng nằm sát mặt đất */
    const layer = el(
      "div",
      "mp-layer mp-trail",
      `<svg viewBox="0 0 ${BW} ${BH}" aria-hidden="true"><path class="g"/><path class="u"/><path class="l"/></svg>`,
    );
    board.append(layer);
    const paths = [...layer.querySelectorAll("path")];
    if (DEBUG_GRID) {
      let tx = "";
      for (let i = 0; i <= NX; i++)
        for (let j = 0; j <= NY; j++)
          tx += `<circle cx="${i * GRID}" cy="${j * GRID}" r="1.6" fill="#e11d48"/><text x="${i * GRID + 2.5}" y="${j * GRID - 2.5}" font-size="5.5" font-weight="700" fill="#e11d48" stroke="#fff" stroke-width=".9" paint-order="stroke">${i},${j}</text>`;
      layer.firstChild.insertAdjacentHTML("beforeend", tx);
    }

    /* người đi bộ: nhãn 2D đứng thẳng, được chiếu như ghim */
    const man = el("div", "mp-mk mp-walker", MAN);
    lbls.append(man);
    const mansvg = man.firstChild;

    /* nhân vật đứng ở mốc c: ẩn ghim + nhãn + sóng của mốc đó (c = null: hiện lại hết) */
    const setHere = (c) => {
      markers.forEach((m, k) => m.classList.toggle("here", !!c && k === c.id));
      glows.forEach((gl, k) => gl.classList.toggle("here", !!c && k === c.id));
    };

    /* điểm xuất phát: sân của HUTECH (nếu có), không thì giữa bệ */
    const hc = COMPANIES[0];
    const crt = ((window.MapCity && window.MapCity.MODELS[hc.id]) || []).find(
      (p) => p.k === "f" && p.cls === "court",
    );
    const startPt = crt
      ? [hc.x + crt.x * hc.sc, hc.y + crt.y * hc.sc]
      : [(hc.pad[0] + hc.pad[2]) / 2, (hc.pad[1] + hc.pad[3]) / 2];
    const wb = { el: man, x: startPt[0], y: startPt[1], z: 1.5, k: 0.35 }; // k = hệ số cỡ nhân vật so với zoom
    bills.push(wb);
    setHere(COMPANIES[0]); // lúc mở app nhân vật đang đứng ở HUTECH
    setHere(COMPANIES[0]); // lúc mở app nhân vật đang đứng ở HUTECH

    /* màu áo theo mốc đích [R, G, B]: đổi dần khi nhân vật đi tới mốc đó */
    const SHIRT = {
      hutech: [249, 115, 22], // cam
      miniai: [24, 24, 28], // đen
      digibird: [250, 250, 252], // trắng
      nasani: [38, 50, 84], // vest xanh navy đậm
    };
    let col = (SHIRT[COMPANIES[0].id] || [249, 115, 22]).slice();
    const setCol = (a) => {
      col = a;
      mansvg.style.setProperty("--sh", `rgb(${a.map(Math.round).join(",")})`);
      mansvg.style.setProperty(
        "--sha",
        `rgb(${a.map((v) => Math.round(v * 0.86)).join(",")})`,
      );
    };
    setCol(col);

    let anim = 0,
      pending = here,
      pendPos = startPt.slice(),
      colTo = col.slice(),
      curC = COMPANIES[0],
      pendC = COMPANIES[0];

    const go = (cid, redraw, cam) => {
      const c = COMPANIES.find((o) => o.id === cid);
      if (!c || !c.pad) return;
      if (anim) {
        // đang đi dở: nhảy tới đích cũ rồi đi tiếp
        cancelAnimationFrame(anim);
        anim = 0;
        here = pending;
        curC = pendC;
        [wb.x, wb.y] = pendPos;
        setCol(colTo);
        man.classList.remove("walk");
      }
      setHere(null); // rời mốc: ghim + sóng hiện lại
      const nodes = routeTo(here, c);
      if (!nodes) {
        paths.forEach((p) => p.setAttribute("d", ""));
        man.classList.remove("walk");
        redraw();
        return;
      }
      /* đi ngang ra đường đối diện bệ hiện tại (phía mốc đích), rồi chạy thẳng tới đúng hàng của ghim,
         rẽ vào ghim. Nếu đường đó không sát bệ đích thì dùng tuyến theo phố như cũ. */
      const roadX =
        c.x < curC.x ? curC.pad[0] - 2.5 : curC.pad[2] + 2.5;
      const direct =
        Math.abs(roadX - (c.pad[2] + 2.5)) < 1 ||
        Math.abs(roadX - (c.pad[0] - 2.5)) < 1;
      let pts;
      if (direct) {
        pts = [[wb.x, wb.y], [roadX, wb.y], [roadX, c.y], [c.x, c.y]];
      } else {
        const hp = xy(here),
          lp = xy(nodes[nodes.length - 1]);
        pts = [[wb.x, wb.y], [hp[0], wb.y]].concat(nodes.map(xy), [
          [lp[0], c.y],
          [c.x, c.y],
        ]);
      }
      /* tuyến riêng của mốc đích (ROUTE_VIA): có thì dùng thay tuyến tự động */
      const via = ROUTE_VIA[curC.id + ">" + c.id] || ROUTE_VIA[c.id];
      if (via && via.length) {
        const raw = [
          [wb.x, wb.y],
          ...via.map(([i, j]) => [i * GRID, j * GRID]),
          [c.x, c.y],
        ];
        pts = [raw[0]];
        for (let k = 1; k < raw.length; k++) {
          const p = pts[pts.length - 1],
            q = raw[k];
          if (Math.abs(p[0] - q[0]) > 0.5 && Math.abs(p[1] - q[1]) > 0.5)
            pts.push([q[0], p[1]]); // thêm góc vuông để chỉ đi theo phố
          pts.push(q);
        }
      }
      /* dọn tuyến: bỏ điểm trùng và điểm thẳng hàng (kể cả đi quá rồi quay lại) */
      for (let again = true; again; ) {
        again = false;
        for (let k = 1; k < pts.length - 1; k++) {
          const A = pts[k - 1], B = pts[k], D = pts[k + 1];
          const cr = (B[0] - A[0]) * (D[1] - B[1]) - (B[1] - A[1]) * (D[0] - B[0]);
          const same = Math.abs(B[0] - A[0]) + Math.abs(B[1] - A[1]) < 0.01;
          if (same || Math.abs(cr) < 0.01) {
            pts.splice(k, 1);
            again = true;
            break;
          }
        }
      }
      const seg = [];
      let total = 0;
      for (let i = 1; i < pts.length; i++) {
        const l = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
        seg.push(l);
        total += l;
      }
      const d = "M" + pts.map((p) => p[0] + " " + p[1]).join("L");
      paths.forEach((p) => {
        p.setAttribute("d", d);
        p.style.strokeDasharray = total;
        p.style.strokeDashoffset = reduce ? 0 : total;
      });
      pending = nodes[nodes.length - 1];
      pendPos = [c.x, c.y];
      pendC = c;
      const col0 = col.slice();
      colTo = (SHIRT[c.id] || col0).slice(); // màu áo của mốc đích
      if (reduce) {
        here = pending;
        curC = pendC;
        [wb.x, wb.y] = pendPos;
        setCol(colTo);
        setHere(c);
        redraw();
        return;
      }
      const ms = clamp(total * 45, 1800, 7000),
        t0 = performance.now() + 350; // chờ camera bay đi một chút rồi mới đi
      man.classList.add("walk");
      const step = (now) => {
        if (!man.isConnected) return;
        if (now < t0) {
          anim = requestAnimationFrame(step);
          return;
        }
        const k = Math.min(1, (now - t0) / ms),
          e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
        let dd = e * total,
          i = 0;
        while (i < seg.length - 1 && dd > seg[i]) {
          dd -= seg[i];
          i++;
        }
        const t = seg[i] ? Math.min(1, dd / seg[i]) : 1;
        const ax = pts[i][0],
          ay = pts[i][1],
          bx = pts[i + 1][0],
          by = pts[i + 1][1];
        wb.x = ax + (bx - ax) * t;
        wb.y = ay + (by - ay) * t;
        const a = cam.rz * RAD,
          sx = (bx - ax) * Math.cos(a) - (by - ay) * Math.sin(a);
        if (Math.abs(sx) > 0.01) mansvg.style.transform = `scaleX(${sx < 0 ? -1 : 1})`;
        setCol(col0.map((v, n) => v + (colTo[n] - v) * e));
        paths.forEach((p) => (p.style.strokeDashoffset = total * (1 - e)));
        redraw();
        if (k < 1) anim = requestAnimationFrame(step);
        else {
          anim = 0;
          here = pending;
          curC = pendC;
          man.classList.remove("walk"); // xuống xe, đứng yên
          setHere(curC); // ẩn ghim + nhãn + sóng của mốc đang đứng
        }
      };
      anim = requestAnimationFrame(step);
    };

    const halt = () => {
      if (!anim) return;
      cancelAnimationFrame(anim);
      anim = 0;
      here = pending;
      curC = pendC;
      [wb.x, wb.y] = pendPos;
      setTone(toneTo);
      man.classList.remove("walk");
      setHere(curC);
      paths.forEach((p) => (p.style.strokeDashoffset = 0));
    };
    return { go, halt };
  }
  /* ---------- BUILD ---------- */
  function build(body) {
    body.classList.add("flush", "mp-body");
    const BY = {};
    COMPANIES.forEach((c) => (BY[c.id] = c));

    const root = el("div", "mp");
    root.style.setProperty("--bw", BW + "px");
    root.style.setProperty("--bh", BH + "px");
    root.tabIndex = -1;
    const view = el("div", "mp-view");
    const world = el("div", "mp-world");
    const board = el("div", "mp-board");
    world.append(board);
    view.append(world);

    /* --- giao diện phủ lên --- */
    const title = el(
      "div",
      "mp-title",
      `<h1>${esc(TXT.title)}</h1><p>${esc(TXT.lead)}</p><p class="sub">${esc(TXT.sub)}</p>`,
    );
    const sign = el(
      "div",
      "mp-sign",
      `<em>${esc(TXT.sign1)}</em><span>${esc(TXT.sign2)}</span>`,
    );
    const scaleEl = el(
      "div",
      "mp-scale",
      `<span class="bar"></span><span class="tx"></span>`,
    );
    const scaleBar = scaleEl.firstChild,
      scaleTx = scaleEl.lastChild;

    const compass = el(
      "button",
      "mp-compass",
      `<span class="n">N</span><span class="mp-needle"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" stroke-opacity=".5" stroke-width="1.2"/><path d="M12 3.8l3.2 8.2H8.8z" fill="currentColor"/><path d="M12 20.2L8.8 12h6.4z" fill="currentColor" fill-opacity=".3"/></svg></span>`,
    );
    compass.type = "button";
    compass.setAttribute("aria-label", "Về hướng Bắc");
    const needle = compass.lastChild;

    const mkBtn = (label, icon) => {
      const b = el("button", "mp-b", ic(icon));
      b.type = "button";
      b.setAttribute("aria-label", label);
      b.title = label;
      return b;
    };
    const bRotL = mkBtn("Xoay trái (Q)", "rotL");
    const bRotR = mkBtn("Xoay phải (E)", "rotR");
    const bOut = mkBtn("Thu nhỏ (-)", "minus");
    const bIn = mkBtn("Phóng to (+)", "plus");
    const bReset = mkBtn("Xem toàn cảnh", "reset");
    const ctl = el("div", "mp-ctl");
    const pill = el("div", "mp-pill");
    pill.append(bRotL, bRotR, bOut, bIn, bReset);
    ctl.append(pill);

    const legend = el("div", "mp-legend");
    legend.setAttribute("aria-label", "Dòng thời gian");
    const legendBtns = COMPANIES.map((c, i) => {
      const b = el(
        "button",
        "mp-lg",
        `<span class="no">${i + 1}</span><span><small>${esc(c.years)}</small><b>${esc(c.name)}</b></span>`,
      );
      b.type = "button";
      b.style.setProperty("--c", c.color);
      b.addEventListener("click", () => select(c.id));
      legend.append(b);
      return b;
    });

    const info = el(
      "aside",
      "mp-info",
      `<div class="mp-wbar"><button class="mp-dot r" type="button" aria-label="Đóng"></button><i class="mp-dot y"></i><i class="mp-dot g"></i></div><div class="mp-scroll"></div>`,
    );
    info.setAttribute("aria-hidden", "true");
    const scroll = info.lastChild;

    const loading = el("div", "mp-loading", "Đang tải bản đồ…");
    root.append(view, title, sign, scaleEl, compass, ctl, legend, info, loading);
    body.append(root);

    let markers = new Map(),
      bills = [],
      lod = { minTiles: [], majTiles: new Map(), ready: null },
      lbls = el("div", "mp-lbls");
    view.append(lbls); // lớp rỗng, boot() sẽ thay bằng lớp thật

    /* --- camera --- */
    const cam = {
      cx: BW / 2,
      cy: BH / 2 + 10,
      s: 0.6,
      rz: DEF.rz,
      rx: DEF.rx,
      ox: 0,
      oy: 0,
    };
    let VW = 0,
      VH = 0; // kích thước khung nhìn (cập nhật trong ResizeObserver) để chiếu nhãn 2D
    const KEYS = ["cx", "cy", "rz", "rx", "ox", "oy"];
    const clampS = (s) => clamp(s, 0.5, 8); // zoom tối đa 8: khớp độ nét canvas mặt đất + kết cấu cửa sổ
    let raf = 0,
      zraf = 0,
      graf = 0,
      zt = null; // raf: bay camera, zraf: zoom mượt, graf: quán tính kéo
    let sel = null,
      dragged = false,
      userMoved = false,
      frozen = false;
    let lrz = NaN,
      lvis = "",
      lscale = "";

    function setMoving(on) {
      root.classList.toggle("moving", on);
    }

    /* ---------- LOD: chỉ dựng / hiện thứ gần tâm màn hình, tự giảm chất lượng khi máy yếu ---------- */
    let base = 1.35; // mức zoom của toàn cảnh (cập nhật trong overview())
    let Q = small() ? 1 : 2,
      wq = -1,
      nearOn = false;

    const tileDist = (t) => {
      const dx = Math.max(t.x0 - cam.cx, 0, cam.cx - t.x1),
        dy = Math.max(t.y0 - cam.cy, 0, cam.cy - t.y1);
      return Math.hypot(dx, dy);
    };

    let lcx = -1e9,
      lcy = -1e9,
      lq = -1;
    function updateLOD() {
      if (Q !== wq) {
        wq = Q;
        world.classList.remove("q0", "q1", "q2");
        world.classList.add("q" + Q);
      }
      const near = cam.s / base >= (nearOn ? LOD_OUT : LOD_IN);
      if (near !== nearOn) {
        nearOn = near;
        world.classList.toggle("near", near);
        lbls.classList.toggle("near", near); // nhãn phụ chỉ hiện khi zoom gần
        lcx = -1e9;
      }
      if (
        Math.abs(cam.cx - lcx) < 12 &&
        Math.abs(cam.cy - lcy) < 12 &&
        Q === lq
      )
        return;
      lcx = cam.cx;
      lcy = cam.cy;
      lq = Q;

      const ql = QL[Q],
        cull = nearOn; // toàn cảnh: hiện tất cả; zoom gần mới cắt theo khoảng cách tới tâm
      let built = 0,
        more = false;
      for (const t of lod.minTiles) {
        const on = !cull || tileDist(t) <= ql.minR;
        if (on && !t.el) {
          if (built >= 2) {
            more = true;
            continue;
          }
          lod.buildTile(t);
          built++;
        } else if (t.el && on !== t.on) {
          t.on = on;
          t.el.style.display = on ? "" : "none";
        }
      }
      for (const t of lod.majTiles.values()) {
        const on = !cull || tileDist(t) <= ql.majR;
        if (on !== t.on) {
          t.on = on;
          t.el.style.display = on ? "" : "none";
        }
      }
      if (more) {
        lcx = -1e9;
        queueApply();
      }
    }

    /* đo thời gian khung hình khi đang kéo / zoom / bay camera; chậm kéo dài thì hạ 1 mức chất lượng */
    let lastAp = 0,
      skip = 0,
      samples = [];
    function watchPerf(now) {
      if (!root.classList.contains("moving")) {
        lastAp = 0;
        return;
      }
      if (lastAp) {
        const dt = now - lastAp;
        if (dt < 250) {
          if (skip < 12) skip++;
          else samples.push(dt);
        }
      }
      lastAp = now;
      if (samples.length >= 24) {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        samples = [];
        if (avg > 26 && Q > 0) {
          Q--;
          updateLOD();
        }
      }
    }

    function apply() {
      if (frozen) return;
      world.style.transform = `translate(${cam.ox}px,${cam.oy}px) scale3d(${cam.s},${cam.s},${cam.s}) rotateX(${cam.rx}deg) rotateZ(${cam.rz}deg) translate3d(${-cam.cx}px,${-cam.cy}px,0)`;

      /* nhãn là lớp 2D: chiếu (x, y, z) lên màn hình bằng đúng chuỗi transform của .mp-world + perspective 2200px */
      const rzc = cam.rz !== lrz;
      lrz = cam.rz;
      const W = VW || 1000,
        H = VH || 640,
        D = 2200;
      const cz = Math.cos(cam.rz * RAD),
        sz = Math.sin(cam.rz * RAD);
      const cxr = Math.cos(cam.rx * RAD),
        sxr = Math.sin(cam.rx * RAD);
      const ox = W / 2,
        oy = H * 0.46; // perspective-origin: 50% 46%
      for (const b of bills) {
        const tx = b.x - cam.cx,
          ty = b.y - cam.cy;
        const y1 = tx * sz + ty * cz;
        const X = W / 2 + cam.ox + cam.s * (tx * cz - ty * sz);
        const Y = H / 2 + cam.oy + cam.s * (y1 * cxr - b.z * sxr);
        const k = D / (D - cam.s * (y1 * sxr + b.z * cxr));
        const px = Math.round(ox + (X - ox) * k),
          py = Math.round(oy + (Y - oy) * k);
        const sc = b.k ? Math.round(cam.s * k * b.k * 1000) / 1000 : 1; // b.k: nhãn co giãn theo zoom (nhân vật)
        if (px !== b.px || py !== b.py || sc !== b.sc) {
          // chỉ ghi DOM khi vị trí hoặc cỡ thật sự đổi
          b.px = px;
          b.py = py;
          b.sc = sc;
          b.el.style.transform = b.k
            ? `translate(${px}px,${py}px) scale(${sc})`
            : `translate(${px}px,${py}px)`;
          b.el.style.zIndex = py;
        }
        if (b.ar && rzc)
          b.ar.style.transform = `rotate(${b.deg + cam.rz}deg)`;
      }

      if (rzc) {
        needle.style.transform = `rotate(${cam.rz}deg)`;
        /* chỉ bật các mặt bên đang hướng về camera => còn ~3 mặt / toà thay vì 5 */
        const sx = Math.sin(cam.rz * RAD),
          cy = Math.cos(cam.rz * RAD);
        const VM = 0.4; // bù phối cảnh: tòa ở mép màn hình vẫn thấy cả mặt gần như song song với tia nhìn
        const vis =
          (sx < VM ? "L" : "") +
          (sx > -VM ? "R" : "") +
          (cy > -VM ? "F" : "") +
          (cy < VM ? "B" : "");
        if (vis !== lvis) {
          lvis = vis;
          world.dataset.v = vis;
        }
      }

      /* thước tỉ lệ: độ dài thanh theo mức zoom */
      const pk = PX_KM * cam.s;
      const nice = [0.5, 1, 2, 5, 10, 20].find((k) => k * pk >= 56) || 20;
      const w = Math.round(nice * pk);
      const key = nice + "|" + w;
      if (key !== lscale) {
        lscale = key;
        scaleBar.style.width = w + "px";
        scaleTx.textContent = String(nice).replace(".", ",") + " km";
      }

      updateLOD();
      watchPerf(performance.now());
    }

    let queued = false;
    function queueApply() {
      // gom nhiều pointermove trong 1 khung hình thành 1 lần cập nhật
      if (queued) return;
      queued = true;
      requestAnimationFrame(() => {
        queued = false;
        apply();
      });
    }

    function overview() {
      const W = view.clientWidth || 1000,
        H = view.clientHeight || 640,
        mob = small();
      const s = clampS(
        Math.min(
          (W * 0.94) / (BW * 1.14),
          (H * (mob ? 0.7 : 0.86)) / (BH * 1.1),
        ),
      );
      base = s;
      return {
        cx: BW / 2,
        cy: BH / 2 + 10,
        rz: DEF.rz,
        rx: DEF.rx,
        ox: 0,
        s,
        oy: mob ? -H * 0.04 : H * 0.02,
      };
    }

    function stopAll() {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(zraf);
      cancelAnimationFrame(graf);
      raf = zraf = graf = 0;
      zt = null;
    }

    function fly(to, ms = 900) {
      stopAll();
      const from = { ...cam },
        goal = { ...cam, ...to };
      goal.rz = from.rz + ((((goal.rz - from.rz) % 360) + 540) % 360) - 180; // xoay theo đường ngắn nhất
      if (reduce || ms <= 0) {
        Object.assign(cam, goal);
        apply();
        return;
      }
      setMoving(true);
      const t0 = performance.now();
      const step = (now) => {
        if (!root.isConnected) return;
        const k = Math.min(1, (now - t0) / ms);
        const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
        for (const key of KEYS)
          cam[key] = from[key] + (goal[key] - from[key]) * e;
        cam.s = from.s * Math.pow(goal.s / from.s, e);
        apply();
        if (k < 1) raf = requestAnimationFrame(step);
        else {
          raf = 0;
          setMoving(false);
        }
      };
      raf = requestAnimationFrame(step);
    }

    /* --- chọn / bỏ chọn điểm mốc --- */
    function focusOn(c, ms) {
      const mob = small();
      fly(
        {
          cx: c.x,
          cy: c.y,
          rx: 54,
          s: clampS(overview().s * 2.9),
          ox: mob ? 0 : -(info.offsetWidth + 28) / 2,
          oy: mob ? -view.clientHeight * 0.2 : 0,
        },
        ms,
      );
    }

    function fill(c) {
      info.style.setProperty("--c", c.color);
      const maps =
        "https://www.google.com/maps/search/?api=1&query=" +
        encodeURIComponent(c.address);
      const others = COMPANIES.filter((o) => o !== c)
        .map((o) => {
          const brg = bearing(c, o);
          return `<li style="--c:${o.color}"><i class="ar" style="transform:rotate(${brg.toFixed(0)}deg)">${svgIc("arrow")}</i><span class="nm">${esc(o.name)}</span><span class="dr">${dirName(brg)}</span><b>${fmtKm(distKm(c, o))}</b></li>`;
        })
        .join("");
      const idx = COMPANIES.indexOf(c) + 1;
      scroll.innerHTML = `
        <div class="mp-cover"><span class="mp-step">${idx} / ${COMPANIES.length}</span></div>
        <div class="mp-pbody">
          <div class="mp-hd">${ic("building")}<div><h2>${esc(c.name)}${c.aka ? ` <span class="aka">(${esc(c.aka)})</span>` : ""}</h2><p>${esc(c.role)}</p><p class="yr">${esc(c.years)}</p></div></div>
          <div class="mp-meta">
            <span>${ic("pin")}<span>${esc(c.address)}</span></span>
            <a href="${esc(maps)}" target="_blank" rel="noopener noreferrer">${ic("link")}<span>${esc(TXT.maps)}</span></a>
          </div>
          <h3>${esc(TXT.dist)}</h3>
          <ul class="mp-dist">${others}</ul>
          <p class="mp-note">${esc(TXT.distNote)}</p>
          <h3>${esc(TXT.tasks)}</h3>
          <ul>${c.tasks.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>
          <h3>${esc(TXT.projects)}</h3>
          <div class="mp-proj">${c.projects.map((p) => `<figure class="mp-pj"><i></i><figcaption>${esc(p.name)}</figcaption></figure>`).join("")}</div>
          <h3>${esc(TXT.lesson)}</h3>
          <blockquote>${esc(c.lesson)}</blockquote>
        </div>`;
      bgTry(scroll.querySelector(".mp-cover"), c.cover);
      scroll
        .querySelectorAll(".mp-pj i")
        .forEach((n, i) => bgTry(n, c.projects[i] && c.projects[i].img));
      scroll.scrollTop = 0;
    }

    function select(id) {
      const c = BY[id];
      if (!c) return;
      userMoved = true;
      if (sel === id) return;
      sel = id;
      markers.forEach((m, k) => m.classList.toggle("on", k === id));
      legendBtns.forEach((b, i) =>
        b.classList.toggle("on", COMPANIES[i].id === id),
      );
      fill(c);
      root.classList.add("has-sel", "open");
      info.classList.add("in");
      info.setAttribute("aria-hidden", "false");
      focusOn(c, 1000);
      if (TRAIL) TRAIL.go(id, queueApply, cam);
    }

    function closeInfo() {
      if (!sel) return;
      sel = null;
      markers.forEach((m) => m.classList.remove("on"));
      legendBtns.forEach((b) => b.classList.remove("on"));
      root.classList.remove("has-sel", "open");
      info.classList.remove("in");
      info.setAttribute("aria-hidden", "true");
      fly(overview(), 900);
    }

    info.querySelector(".mp-dot.r").addEventListener("click", closeInfo);

    /* --- nút điều khiển --- */
    const nudge = (d) => {
      userMoved = true;
      fly(d, 320);
    };
    bRotL.addEventListener("click", () => nudge({ rz: cam.rz - 22 }));
    bRotR.addEventListener("click", () => nudge({ rz: cam.rz + 22 }));
    bIn.addEventListener("click", () => nudge({ s: clampS(cam.s * 1.35) }));
    bOut.addEventListener("click", () => nudge({ s: clampS(cam.s / 1.35) }));
    bReset.addEventListener("click", () => {
      if (sel) closeInfo();
      else {
        userMoved = false;
        fly(overview(), 800);
      }
    });
    compass.addEventListener("click", () => nudge({ rz: 0, rx: DEF.rx })); // bấm la bàn = Bắc hướng lên

    /* --- kéo / chụm / cuộn --- */
    const panFrom = (b0, dx, dy) => {
      const a = b0.rz * RAD,
        c = Math.cos(a),
        s = Math.sin(a);
      const ux = dx / b0.s,
        uy = dy / (b0.s * Math.cos(b0.rx * RAD));
      cam.cx = clamp(b0.cx - (ux * c + uy * s), 0, BW);
      cam.cy = clamp(b0.cy - (-ux * s + uy * c), 0, BH);
    };

    const ptrs = new Map();
    let g = null;

    view.addEventListener("pointerdown", (e) => {
      if (e.pointerType === "mouse" && e.button === 1) return;
      freeze(false);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      root.focus({ preventScroll: true });
      stopAll();
      setMoving(false);
      userMoved = true;
      if (ptrs.size === 1) {
        g = {
          mode: e.shiftKey || e.button === 2 ? "rot" : "pan",
          x: e.clientX,
          y: e.clientY,
          moved: false,
          c0: { ...cam },
          hist: [[performance.now(), e.clientX, e.clientY]],
        };
      } else if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        g = {
          mode: "pinch",
          d0: Math.hypot(a.x - b.x, a.y - b.y) || 1,
          s0: cam.s,
          moved: true,
        };
        try {
          view.setPointerCapture(e.pointerId);
        } catch {}
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
        queueApply();
        return;
      }
      const dx = e.clientX - g.x,
        dy = e.clientY - g.y;
      if (!g.moved) {
        if (Math.hypot(dx, dy) < 5) return; // chưa đủ 5px thì vẫn tính là bấm (để bấm ghim được)
        g.moved = true;
        view.classList.add("drag");
        setMoving(true);
        try {
          view.setPointerCapture(e.pointerId);
        } catch {}
      }
      if (g.mode === "rot") {
        cam.rz = g.c0.rz + dx * 0.4;
        cam.rx = clamp(g.c0.rx - dy * 0.2, 34, 72);
      } else {
        panFrom(g.c0, dx, dy);
        const now = performance.now();
        g.hist.push([now, e.clientX, e.clientY]);
        while (g.hist.length > 2 && now - g.hist[0][0] > 90) g.hist.shift();
      }
      g.dx = dx;
      g.dy = dy;
      queueApply();
    });

    /* thả tay: kéo nhanh thì trượt tiếp rồi giảm dần (quán tính) */
    function glide(gs) {
      const h = gs.hist;
      if (!h || h.length < 2 || reduce) return false;
      const a = h[0],
        b = h[h.length - 1],
        dt = b[0] - a[0];
      if (dt < 8 || performance.now() - b[0] > 70) return false;
      let vx = (b[1] - a[1]) / dt,
        vy = (b[2] - a[2]) / dt; // px / ms
      if (Math.hypot(vx, vy) < 0.15) return false;
      let ox = gs.dx,
        oy = gs.dy,
        last = performance.now();
      setMoving(true);
      const step = (now) => {
        const d = Math.min(48, now - last);
        last = now;
        ox += vx * d;
        oy += vy * d;
        const decay = Math.pow(0.94, d / 16);
        vx *= decay;
        vy *= decay;
        panFrom(gs.c0, ox, oy);
        apply();
        if (Math.hypot(vx, vy) > 0.02 && root.isConnected)
          graf = requestAnimationFrame(step);
        else {
          graf = 0;
          setMoving(false);
        }
      };
      graf = requestAnimationFrame(step);
      return true;
    }

    const endPtr = (e) => {
      if (!ptrs.has(e.pointerId)) return;
      ptrs.delete(e.pointerId);
      const gs = g;
      if (gs && gs.moved) {
        dragged = true; // chặn click "ảo" ngay sau khi kéo
        setTimeout(() => {
          dragged = false;
        }, 0);
      }
      if (ptrs.size === 0) {
        g = null;
        view.classList.remove("drag");
        if (gs && gs.moved && gs.mode === "pan" && e.type === "pointerup") {
          if (!glide(gs)) setMoving(false);
        } else setMoving(false);
      } else if (g && g.mode === "pinch") {
        g = null;
      }
    };
    view.addEventListener("pointerup", endPtr);
    view.addEventListener("pointercancel", endPtr);
    view.addEventListener("contextmenu", (e) => e.preventDefault());

    view.addEventListener("click", (e) => {
      // bấm vào nền trống = đóng cửa sổ thông tin
      if (dragged || e.target.closest(".mp-mk")) return;
      closeInfo();
    });

    /* cuộn chuột: đặt mục tiêu zoom, camera tiến dần tới đó => mượt, không giật theo từng nấc */
    const zstep = () => {
      if (zt == null || !root.isConnected) {
        zraf = 0;
        return;
      }
      const d = zt - cam.s;
      if (Math.abs(d) < cam.s * 0.002 || reduce) {
        cam.s = zt;
        zt = null;
        zraf = 0;
        apply();
        setMoving(false);
        return;
      }
      cam.s += d * 0.2;
      apply();
      zraf = requestAnimationFrame(zstep);
    };
    view.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        freeze(false);
        cancelAnimationFrame(raf);
        cancelAnimationFrame(graf);
        raf = graf = 0;
        userMoved = true;
        // Firefox hay gửi deltaMode = 1 (dòng) hoặc 2 (trang): quy về px
        const dy =
          e.deltaMode === 1
            ? e.deltaY * 33
            : e.deltaMode === 2
              ? e.deltaY * 400
              : e.deltaY;
        zt = clampS(
          (zt == null ? cam.s : zt) *
            Math.exp(-dy * (e.ctrlKey ? 0.01 : 0.0015)),
        );
        if (!zraf) {
          setMoving(true);
          zraf = requestAnimationFrame(zstep);
        }
      },
      { passive: false },
    );

    /* --- bàn phím --- */
    root.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "Escape") {
        if (sel) {
          e.preventDefault();
          e.stopPropagation();
          closeInfo();
        }
        return;
      }
      const st = 60;
      if (k.startsWith("Arrow")) {
        e.preventDefault();
        userMoved = true;
        stopAll();
        panFrom(
          cam,
          k === "ArrowLeft" ? st : k === "ArrowRight" ? -st : 0,
          k === "ArrowUp" ? st : k === "ArrowDown" ? -st : 0,
        );
        apply();
      } else if (k === "+" || k === "=") nudge({ s: clampS(cam.s * 1.25) });
      else if (k === "-" || k === "_") nudge({ s: clampS(cam.s / 1.25) });
      else if (k === "q" || k === "Q") nudge({ rz: cam.rz - 22 });
      else if (k === "e" || k === "E") nudge({ rz: cam.rz + 22 });
      else if (k >= "1" && k <= String(COMPANIES.length))
        select(COMPANIES[+k - 1].id);
    });
        function freeze(on) {
      if (on === frozen || !root.isConnected) return;
      frozen = on;
      root.classList.toggle("frz", on);
      if (on) {
        stopAll();
        setMoving(false);
        ptrs.clear();
        g = null;
        view.classList.remove("drag");
        if (TRAIL) TRAIL.halt();
        view.remove(); // gỡ cả cảnh 3D khỏi cửa sổ: Genie chỉ còn tiêu đề + nền, nhẹ như lúc mở
      } else {
        if (!view.isConnected) root.prepend(view); // gắn lại đúng chỗ (lớp dưới cùng)
        lcx = -1e9;
        queueApply();
      }
    }

    function watchWin() {
      const win = root.closest(".win");
      if (!win) return;
      const BUSY = ["is-min", "gn-skip", "gn-hide", "is-closing"];
      const sync = () => {
        if (!root.isConnected) return mo.disconnect();
        // started = false: đang mở lần đầu, không đóng băng
        freeze(started && BUSY.some((c) => win.classList.contains(c)));
      };
      // đóng / thu nhỏ / khôi phục: bám theo class của cửa sổ (gn-hide được gỡ = Genie bung xong => bật lại 3D)
      const mo = new MutationObserver(sync);
      mo.observe(win, { attributes: true, attributeFilter: ["class"] });

      // tắt 3D NGAY khi nhấn nút đỏ / vàng, trước khi click gọi Genie => Genie chỉ bóp mặt đất phẳng
      win.addEventListener(
        "pointerdown",
        (e) => {
          if (!e.target.closest(".light.close, .light.min")) return;
          freeze(true);
          const undo = () => {
            document.removeEventListener("pointerup", undo, true);
            document.removeEventListener("pointercancel", undo, true);
            setTimeout(sync, 300); // click đến trước 300ms; nếu không đóng / thu nhỏ thì bật lại 3D
          };
          document.addEventListener("pointerup", undo, true);
          document.addEventListener("pointercancel", undo, true);
        },
        true,
      );
    }
    /* --- dừng hoạt ảnh vô hạn (ghim nhún) khi app bị che / tab ẩn: đỡ tốn GPU --- */
    let io = null;
    const onVis = () => {
      if (!root.isConnected) {
        document.removeEventListener("visibilitychange", onVis);
        if (io) io.disconnect();
        return;
      } // app đã đóng: gỡ listener
      root.classList.toggle("off", document.hidden);
    };
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((en) =>
        root.classList.toggle("off", !en[en.length - 1].isIntersecting),
      );
      io.observe(root);
    }
    document.addEventListener("visibilitychange", onVis);

    /* --- khởi động: đợi có kích thước rồi mới bay vào toàn cảnh --- */
    let started = false;
    const ro = new ResizeObserver(() => {
      if (!root.isConnected) {
        ro.disconnect();
        return;
      }
      if (!view.clientWidth) return;
      VW = view.clientWidth;
      VH = view.clientHeight;
      if (!started) {
        started = true;
        const ov = overview();
        Object.assign(cam, ov, { s: ov.s * 0.6, rz: -120, rx: 72 });
        apply();
        fly(ov, 1800);
      } else if (sel) {
        focusOn(BY[sel], 0);
      } else if (!userMoved) {
        Object.assign(cam, overview());
        apply();
      } else {
        apply(); // người dùng đã di chuyển camera: chỉ cần chiếu lại nhãn theo kích thước mới
      }
    });
    let booted = false;
    function boot() {
      if (booted || !root.isConnected) return;
      booted = true;
      const r = makeBoard(board, (id) => {
        if (dragged) return;
        select(id);
      });
      markers = r.markers;
      bills = r.bills;
      lod = r.lod;
      lod.ready = () => {
        lcx = -1e9;
        queueApply();
      };
      lbls.replaceWith(r.lbls);
      lbls = r.lbls;
      lcx = -1e9;
      loading.remove();
      watchWin();
      ro.observe(view); // camera chỉ bay vào khi đã có thành phố
      apply();
    }

    // đợi Genie mở xong (class gn-hide được gỡ) rồi mới dựng phần nặng
    const waitGenie = () => {
      const win = root.closest(".win");
      if (win && win.classList.contains("gn-hide")) {
        const t0 = performance.now();
        const poll = () => {
          if (!root.isConnected) return;
          if (!win.classList.contains("gn-hide") || performance.now() - t0 > 2000)
            requestAnimationFrame(boot);
          else requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      } else requestAnimationFrame(boot);
    };
    setTimeout(waitGenie, 0);
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
