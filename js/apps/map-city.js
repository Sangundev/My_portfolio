/* =========================================================
   js/apps/map-city.js: thành phố diorama ban ngày (phong cách mô hình 3D isometric)
   Nạp TRƯỚC js/apps/map.js. map.js gọi window.MapCity.create({...}) trong makeBoard().

   PHONG CÁCH: nền lát xám sáng, phố nhựa tối có vạch giữa + vạch qua đường, nhà tường kem / xám sáng,
   mái ngói cam / xanh teal / xám phẳng, tháp kính xanh ngọc / xanh trời.

   BẢN VÁ "ĐƯỜNG LIỀN MẠCH" (sửa lỗi các lớp chồng lên nhau):
   - MỘT mạng đường duy nhất trên lưới block 32px. Đại lộ (AVENUES) cũng nằm trên lưới => không còn
     đường cong / đường chéo đè lên lưới phố, không còn vạch vàng + lề sáng chồng nhau.
   - Vẽ theo từng lớp cho TOÀN BỘ mạng: lề sáng -> mặt nhựa -> (sông) -> cầu -> vạch giữa -> vạch qua đường -> tên đường.
     Ngã tư / góc rẽ được lấp vuông vức; vạch giữa dừng trước ngã tư.
   - Đường tự cắt bỏ ở nơi có công viên, sân bay, bệ điểm mốc, khu công trình đặc trưng và sông
     (đại lộ băng qua sông bằng cầu). Phố nhỏ dừng đúng bờ sông.
   - 4 điểm mốc + sân bay + công viên nằm GỌN trong các ô block (bệ 3 x 2 block), mép bệ trùng lề phố.
   - Sông chạy trong cột block giữa Nasani và Miniai, không còn bị bệ điểm mốc che mất.
   - Công trình đặc trưng (SIG) né đại lộ; phố nhỏ bị cắt ở phần nằm trong khu đó.

   BẢN VÁ "HÌNH HỌC KHỐI NHÀ" (khe hở / nhô ra / mất toà):
   - Mỗi khối xếp chồng mang lv = số tầng nằm dưới nó. map.js nâng tầng k lên k / 16 px, nên tường tầng trên luôn
     cao hơn mái tầng dưới ở MỌI tầng (trước đây từ tầng 3 trở đi tường cắt mái => khe sáng ở cạnh góc).
   - Mỗi khối mang ax, ay = tâm toà. map.js gom ô LOD theo tâm toà => đế và tháp không bị tách làm đôi.
   - Công trình đặc trưng (SIG): mỗi toà một gid riêng (tầng trên thừa hưởng gid của đế). resolveOverlaps chỉ bỏ
     đúng toà bị chồng, không còn xoá cả cụm của một khu.
   - Mái hiên cửa hàng (K.low) bị giới hạn trong phần đất trống của chính ô đó, không chọc sang nhà bên cạnh.
   - Khối kết nối kính của Nasani thấp hơn toà chính một chút => mái không còn trùng mặt phẳng (z-fight).
   - validate(): kiểm tra khối lơ lửng / nhô ra khỏi đế / hai toà chồng nhau. Gọi MapCity.debug.validate()
     trong console sau khi mở app; kết quả đúng là [].
========================================================= */
(() => {
  const M = 0.67;
  const FL = 3.4 * M;
  const fl = (n) => n * FL;
  const ML = 0.4;
  const flm = (n) => n * FL;
  const GROUND = "#d4d2c9";
  const SS = 0.5;
  const MAJOR_FLOORS = 4;
  const MAJOR_H = fl(MAJOR_FLOORS);

  /* ---------- LƯỚI CHUNG ---------- */
  const U = 16; // ô lưới
  const B = 2 * U; // block 32px: phố chạy trên các đường biên block
  const SM = 2.5; // lề từ tim phố tới mép nhà
  const SI = 0.45; // khe giữa hai nhà cùng block
  const SW_MIN = 3.0; // bề rộng phố thường
  const SW_MAIN = 4.2; // bề rộng đại lộ
  const RIVER_CLEAR = 10.4; // nhà cách tim sông tối thiểu (nửa lòng sông + kè)
  const CASE = "#e9e7df"; // lề sáng của đường
  const ASPH = "#4d5361"; // mặt nhựa
  const TRIM = 3.2; // vạch giữa dừng cách tim ngã tư

  /* ---------- BỐ CỤC BLOCK: bệ điểm mốc, sân bay, đại lộ ---------- */
  const PW = 3,
    PH = 2; // bệ điểm mốc = 3 x 2 block
  const PADS = {
    nasani: [0, 0],
    miniai: [4, 1],
    hutech: [7, 0],
    digibird: [6, 3],
  }; // [cột block, hàng block]
  const AIR = [0, 3]; // bệ sân bay
  const padRect = (bx, by) => [
    bx * B + SM,
    by * B + SM,
    (bx + PW) * B - SM,
    (by + PH) * B - SM,
  ];

  /* Đại lộ: các đỉnh là (cột, hàng) của NÚT LƯỚI, đi dọc đường lưới */
  const AVENUES = [
    {
      label: "Phạm Văn Đồng",
      pts: [
        [0, 3],
        [10, 3],
      ],
    },
    {
      label: "Mai Chí Thọ",
      pts: [
        [0, 5],
        [10, 5],
      ],
    },
    {
      label: "Xa lộ Hà Nội",
      pts: [
        [10, 0],
        [10, 5],
      ],
    },
    {
      label: "Cộng Hòa",
      pts: [
        [3, 0],
        [3, 5],
      ],
    },
    {
      label: "Điện Biên Phủ",
      pts: [
        [4, 0],
        [4, 3],
      ],
    },
    {
      label: "Nguyễn Hữu Cảnh",
      pts: [
        [7, 0],
        [7, 3],
      ],
    },
  ];

  /* ---------- BẢNG MÀU DIORAMA DÙNG CHUNG ---------- */
  const CR = ["#ebe5d5", "#e2dccb", "#d8d9d6", "#efe9db", "#e6e0d2"];
  const GL = [
    ["gl2", "glass:#6cc6c8"],
    ["gl3", "glass:#79b2d4"],
  ];
  const DAY = "day:#6f8fae";

  /* ---------- CÁC KHU ---------- */
  const D = { pitch: U, fill: 0.985, wf: [0.9, 1], df: [0.9, 1] };

  const ZONES = [
    {
      id: "cbd",
      name: "Trung tâm",
      lat: 10.78,
      lng: 106.6995,
      rx: 2.3,
      ry: 1.7,
      ground: "#8fb4ff",
      style: {
        ...D,
        fl: [3, 22],
        sk: 1.3,
        gl: 0.5,
        kinds: { tower: 0.32, office: 0.42, low: 0.26 },
      },
    },

    {
      id: "thaodien",
      name: "Thảo Điền – An Phú",
      lat: 10.804,
      lng: 106.738,
      rx: 2.1,
      ry: 1.5,
      ground: "#f0b66a",
      style: {
        ...D,
        fl: [3, 14],
        sk: 1.4,
        gl: 0.6,
        kinds: { villa: 0.5, tower: 0.1, town: 0.3, low: 0.1 },
      },
    },

    {
      id: "binhtrung",
      name: "Bình Trưng – An Khánh",
      lat: 10.7885,
      lng: 106.7585,
      rx: 2.6,
      ry: 1.8,
      ground: "#7fc4e8",
      style: {
        ...D,
        fl: [4, 14],
        sk: 1.3,
        gl: 0.55,
        kinds: { town: 0.4, office: 0.3, tower: 0.12, low: 0.18 },
      },
    },

    {
      id: "binhthanh",
      name: "Bình Thạnh",
      lat: 10.806,
      lng: 106.708,
      rx: 2.5,
      ry: 1.5,
      ground: "#a9a0f0",
      style: {
        ...D,
        fl: [3, 16],
        sk: 1.5,
        gl: 0.5,
        kinds: { town: 0.4, office: 0.25, tower: 0.15, low: 0.2 },
      },
    },

    {
      id: "vanphuc",
      name: "Vạn Phúc",
      lat: 10.8425,
      lng: 106.711,
      rx: 2.8,
      ry: 2.1,
      ground: "#f2a06a",
      style: {
        ...D,
        fl: [3, 5],
        sk: 1,
        gl: 0.5,
        kinds: { nc: 0.92, low: 0.08 },
      },
    },

    {
      id: "hitech",
      name: "Khu Công nghệ cao",
      lat: 10.8553,
      lng: 106.7852,
      rx: 3.4,
      ry: 2.5,
      ground: "#6fd6b0",
      style: {
        ...D,
        fill: 0.98,
        fl: [2, 6],
        sk: 1.2,
        gl: 0.65,
        kinds: { wh: 0.3, campus: 0.4, tech: 0.3 },
      },
    },

    {
      id: "qtsc",
      name: "Công viên phần mềm Quang Trung",
      lat: 10.8535,
      lng: 106.6265,
      rx: 2.2,
      ry: 1.7,
      ground: "#6fd0e0",
      style: {
        ...D,
        fl: [4, 10],
        sk: 1.2,
        gl: 0.7,
        kinds: { tech: 0.55, campus: 0.25, low: 0.2 },
      },
    },

    {
      id: "tsn",
      name: "Sân bay Tân Sơn Nhất",
      lat: 10.8188,
      lng: 106.652,
      px: [48, 128],
      rx: 2.6,
      ry: 1.4,
      ground: "#d8dfeb",
      style: {
        pitch: B,
        fill: 0.95,
        wf: [0.7, 0.9],
        df: [0.6, 0.85],
        fl: [1, 3],
        sk: 1,
        gl: 0.4,
        kinds: { low: 0.55, wh: 0.45 },
      },
    },
  ];

  /* phần bản đồ ngoài các khu: cùng lưới, cùng vật liệu */
  const BASE = {
    ...D,
    fl: [2, 5],
    sk: 1.6,
    gl: 0.5,
    kinds: { low: 0.45, town: 0.35, office: 0.12, tower: 0.08 },
  };

  /* ---------- CÔNG TRÌNH ĐẶC TRƯNG TỪNG KHU (SIG) ---------- */
  const cr = (x, y) => CR[Math.abs(Math.round(x * 7 + y * 3)) % CR.length];
  const hs = (x, y, w, d, f, roof = "tl", o = {}) => ({
    k: "b",
    x,
    y,
    w,
    d,
    f,
    cls: "dz lit " + roof,
    b: cr(x, y),
    lit: DAY,
    ...o,
  });
  const gt = (x, y, w, d, f, g = "gl2", o = {}) => ({
    k: "b",
    x,
    y,
    w,
    d,
    f,
    cls: `dz ${g} lit rp`,
    lit: g === "gl2" ? "glass:#6cc6c8" : "glass:#79b2d4",
    ...o,
  });
  const pd = (x, y, w, d, f) => ({
    k: "b",
    x,
    y,
    w,
    d,
    f,
    cls: "dz st lit",
    lit: "day:#8b7a5c",
  });
  const cp = (x, y, w, d, f, o = {}) => ({
    k: "b",
    x,
    y,
    w,
    d,
    f,
    cls: "dz cp lit rp",
    lit: DAY,
    ...o,
  });
  const row = (x0, y, n, w, d, fls) =>
    Array.from({ length: n }, (_, i) =>
      hs(
        x0 + i * (w + 1.5),
        y,
        w,
        d,
        fls[i % fls.length],
        i % 3 === 2 ? "sl" : "tl",
      ),
    );

  const SIG = {
    cbd: [
      { k: "f", x: -34, y: 22, w: 62, d: 50, cls: "plaza" },
      hs(-34, 22, 42, 30, 2, "tl"),
      cp(-34, 22, 9, 9, 9, { zf: 2 }),
      gt(34, -18, 24, 24, 22, "gl2"),
      gt(62, -18, 20, 20, 17, "gl3"),
      { k: "tr", x: -66, y: 4, n: 4, dx: 0, dy: 16 },
    ],
    thaodien: [
      { k: "f", x: 0, y: 40, w: 90, d: 12, cls: "water" },
      { k: "f", x: -10, y: -6, w: 30, d: 22, cls: "grass" },
      hs(-52, -10, 24, 18, 3, "tl"),
      { k: "f", x: -52, y: 6, w: 12, d: 7, cls: "water" },
      hs(38, -10, 24, 18, 3, "sl"),
      { k: "f", x: 38, y: 6, w: 12, d: 7, cls: "water" },
      cp(0, 20, 20, 12, 2),
      { k: "tr", x: -40, y: 52, n: 6, dx: 16, dy: 0 },
    ],
    binhtrung: [
      { k: "f", x: 0, y: 44, w: 96, d: 8, cls: "water" },
      gt(-30, -6, 22, 22, 21, "gl2"),
      gt(0, -6, 22, 22, 17, "gl3"),
      gt(30, -6, 22, 22, 19, "gl2"),
      pd(0, 20, 80, 10, 3),
      { k: "tr", x: -44, y: 32, n: 6, dx: 17, dy: 0 },
    ],
    binhthanh: [
      { k: "f", x: 0, y: 28, w: 86, d: 8, cls: "road" },
      { k: "f", x: -30, y: -4, w: 38, d: 30, cls: "grass" },
      { k: "tr", x: -46, y: -10, n: 3, dx: 10, dy: 8 },
      gt(14, -10, 20, 20, 18, "gl3"),
      gt(40, -6, 18, 18, 13, "gl2"),
      pd(14, 12, 40, 8, 4),
    ],
    vanphuc: [
      { k: "f", x: 0, y: 0, w: 76, d: 54, cls: "grass" },
      { k: "f", x: 0, y: -16, w: 30, d: 14, cls: "water" },
      { k: "f", x: 0, y: 8, w: 24, d: 24, cls: "plaza" },
      { k: "b", x: 0, y: 8, w: 12, d: 12, f: 0.5, cls: "dz cp" },
      { k: "b", x: 0, y: 8, w: 4, d: 4, f: 3, zf: 0.5, cls: "dz cp" },
      { k: "tr", x: -30, y: -4, n: 4, dx: 0, dy: 10 },
      { k: "tr", x: 30, y: -4, n: 4, dx: 0, dy: 10 },
      { k: "tr", x: -20, y: 22, n: 5, dx: 10, dy: 0 },
    ],
    hitech: [
      { k: "f", x: 0, y: 0, w: 74, d: 40, cls: "solar" },
      { k: "f", x: 0, y: 46, w: 74, d: 30, cls: "solar" },
      { k: "b", x: -40, y: -40, w: 36, d: 20, f: 2, cls: "dz wh" },
      { k: "b", x: 4, y: -40, w: 36, d: 20, f: 2, cls: "dz wh" },
      gt(44, -40, 22, 18, 5, "gl2"),
    ],
    qtsc: [
      { k: "f", x: 0, y: 0, w: 70, d: 26, cls: "water" },
      { k: "f", x: 0, y: -46, w: 100, d: 12, cls: "plaza" },
      gt(-36, -32, 28, 18, 6, "gl2"),
      gt(0, -32, 28, 18, 8, "gl2"),
      cp(36, -32, 28, 18, 5),
      { k: "tr", x: -42, y: 20, n: 6, dx: 17, dy: 0 },
    ],
    tsn: [],
  };

  /* ---------- MÔ HÌNH CHI TIẾT 4 ĐIỂM MỐC (m, gốc = ghim) ----------
     Mô hình được co / dịch cho vừa bệ 3 x 2 block (xem placeSites). Các dải "asph / zebra" của mô hình cũ đã bỏ:
     bệ nay được bao bởi chính mạng phố chung.
     zf = tầng được đặt LÊN trên một khối khác có chiều cao zf tầng (landmark() gắn lv = 1 cho khối đó,
     và lv + 1 cho bể nước / máy kỹ thuật "plant" đặt tiếp lên trên). */
  
    /* Mái 4 mái dốc dựng bằng các bậc thu nhỏ dần. Gọi: ...hipRoof(x, y, w, d, zf, lv, opts)
     zf = chiều cao (tầng) của toà bên dưới; lv = số tầng nằm dưới phần diềm mái (toà đặt trên đất => 1)
     opts: cls ("ot" cam, "gy" xám), st (cao mỗi bậc), n (số bậc), ins (độ thu mỗi bậc), ew (diềm mái nhô ra) */
  const hipRoof = (x, y, w, d, zf, lv = 1, o = {}) => {
    const cls = "dz " + (o.cls || "ot"),
      st = o.st || 0.38,
      n = o.n || 3,
      eave = 0.14,
      ew = o.ew != null ? o.ew : 1.6,
      ins = Math.min(w, d) * (o.ins || 0.16);
    const out = [{ k: "b", x, y, w: w + ew, d: d + ew, f: eave, zf, cls, lv }];
    for (let i = 0; i < n; i++)
      out.push({
        k: "b",
        x,
        y,
        w: Math.max(2, w - 2 * ins * i),
        d: Math.max(2, d - 2 * ins * i),
        f: st,
        zf: zf + eave + i * st,
        cls,
        lv: lv + 1 + i,
      });
    out[out.length - 1].tp = 1; // đỉnh mái: để ghim / bệ nằm trên mái
    return out;
  };
     const MODELS = {
    hutech: [
      { k: "f", x: 0, y: 26, w: 58, d: 26, cls: "court" },
      { k: "f", x: 0, y: 50, w: 246, d: 8, cls: "lawn" },
      {
        k: "b",
        x: 0,
        y: -8,
        w: 72,
        d: 30,
        f: 9,
        cls: "dz lit",
        lit: "stripe:#3d5f8c",
        main: 1,
        roof: "plant",
      },
      {
        k: "b",
        x: 64,
        y: -4,
        w: 44,
        d: 40,
        f: 8,
        cls: "dz lit",
        lit: "stripe:#3d5f8c",
        roof: "plant",
      },
      {
        k: "b",
        x: -62,
        y: 0,
        w: 46,
        d: 22,
        f: 4,
        cls: "dz sl lit",
        lit: "day:#6d90b5",
      },
      {
        k: "b",
        x: -104,
        y: -6,
        w: 34,
        d: 18,
        f: 3,
        cls: "dz lit",
        lit: "day:#6d90b5",
      },
      {
        k: "b",
        x: -30,
        y: -50,
        w: 50,
        d: 18,
        f: 3,
        cls: "dz lit",
        roof: "tile",
        lit: "day:#6d90b5",
      },
      {
        k: "b",
        x: 36,
        y: -50,
        w: 46,
        d: 18,
        f: 3,
        cls: "dz lit",
        roof: "tile",
        lit: "day:#6d90b5",
      },
      { k: "tr", x: -104, y: 50, n: 9, dx: 26, dy: 0 },
      { k: "tr", x: -112, y: -34, n: 3, dx: 0, dy: 16 },
    ],
    miniai: [
      {
        k: "b",
        x: -84,
        y: -30,
        w: 52,
        d: 18,
        f: 4,
        cls: "dz sl lit",
        lit: "day:#7b93b0",
      },
      {
        k: "b",
        x: -28,
        y: -30,
        w: 52,
        d: 18,
        f: 5,
        cls: "dz tl lit",
        lit: "day:#7b93b0",
        main: 1,
      },
      {
        k: "b",
        x: 28,
        y: -30,
        w: 52,
        d: 18,
        f: 4,
        cls: "dz sl lit",
        lit: "day:#7b93b0",
      },
      {
        k: "b",
        x: 84,
        y: -30,
        w: 52,
        d: 18,
        f: 4,
        cls: "dz tl lit",
        lit: "day:#7b93b0",
      },
      {
        k: "b",
        x: -70,
        y: 38,
        w: 56,
        d: 14,
        f: 3,
        cls: "dz tl lit",
        lit: "day:#7b93b0",
      },
      {
        k: "b",
        x: 0,
        y: 38,
        w: 56,
        d: 14,
        f: 3,
        cls: "dz sl lit",
        lit: "day:#7b93b0",
      },
      {
        k: "b",
        x: 70,
        y: 38,
        w: 56,
        d: 14,
        f: 3,
        cls: "dz tl lit",
        lit: "day:#7b93b0",
      },
      { k: "tr", x: -76, y: -12, n: 8, dx: 22, dy: 0 },
      { k: "tr", x: -76, y: 25, n: 8, dx: 22, dy: 0 },
    ],
    /* Digibird (ảnh thực tế): toà góc, tầng trệt kem + kính xanh lá, 4 tầng vách kính xanh dương, gờ mái xám */
    digibird: [
      { k: "f", x: -72, y: -40, w: 44, d: 24, cls: "courtp" },
      { k: "f", x: 0, y: 32, w: 74, d: 12, cls: "plaza" },
      // tầng trệt
      { k: "b", x: 0, y: 0, w: 44, d: 36, f: 1.7, cls: "dz cp lit", b: "#e9e6da", lit: "day:#5f9a84", lv: 0 },
      // 4 tầng kính xanh dương (thụt vào một chút)
      { k: "b", x: 0, y: 0, w: 41, d: 33, f: 4, zf: 1.7, cls: "dz gl3 lit", b: "#2a5fc4", lit: "glass:#2f6bd6", lv: 1 },
      // gờ mái xám
      { k: "b", x: 0, y: 0, w: 41, d: 33, f: 0.45, zf: 5.7, cls: "dz rf", b: "#8a909c", main: 1, lv: 2 },
      // phòng kỹ thuật nhỏ trên mái
      { k: "b", x: 8, y: -6, w: 10, d: 8, f: 0.7, zf: 6.15, cls: "dz rf", tp: 1, lv: 3 },
      // nhà thấp màu trắng hai bên + dãy phía sau
      { k: "b", x: -48, y: 2, w: 28, d: 30, f: 3, cls: "dz cp lit", b: "#f0eee8", lit: "day:#7b93b0" },
      { k: "b", x: 48, y: 6, w: 28, d: 24, f: 4, cls: "dz cp lit", b: "#f0eee8", lit: "day:#7b93b0" },
      { k: "b", x: 0, y: -40, w: 60, d: 14, f: 2, cls: "dz wh" },
      { k: "tr", x: -92, y: 46, n: 8, dx: 26, dy: 0 },
      { k: "tr", x: 40, y: -50, n: 3, dx: 22, dy: 0 },
    ],
    nasani: [
      { k: "f", x: 62, y: 34, w: 70, d: 14, cls: "lawn" },
      { k: "f", x: -4, y: 28, w: 54, d: 9, cls: "canopy" },
      {
        k: "b",
        x: 0,
        y: -8,
        w: 48,
        d: 30,
        f: 8,
        cls: "dz lit",
        lit: "day:#5f86ad",
        main: 1,
        roof: "plant",
      },
      {
        /* khối kết nối kính: cắm sâu 0,25 vào thân toà (mặt trước toà ở y = 7) => không khe hở.
           Thấp hơn toà chính 0,15 tầng để mái không trùng mặt phẳng với mái toà (tránh z-fight ở phần cắm vào). */
        k: "b",
        x: 0,
        y: 8,
        w: 14,
        d: 2.5,
        f: 7.85,
        cls: "dz gl2 lit",
        lit: "glass:#4fb6b8",
      },
      {
        k: "b",
        x: 62,
        y: -8,
        w: 44,
        d: 36,
        f: 9,
        cls: "dz lit",
        b: "#f2f0ea",
        lit: "day:#6d8fb3",
      },
      {
        k: "b",
        x: -58,
        y: -4,
        w: 40,
        d: 26,
        f: 6,
        cls: "dz lit",
        b: "#f6efe8",
        lit: "day:#6d8fb3",
      },
      { k: "tr", x: -96, y: 38, n: 7, dx: 26, dy: 0 },
      { k: "tr", x: 92, y: -34, n: 2, dx: 0, dy: 18 },
    ],
  };

  const extList = (list, sc) => {
    let ex = 0,
      ey = 0;
    list.forEach((p) => {
      if (p.k === "tr") {
        ex = Math.max(
          ex,
          Math.abs(p.x),
          Math.abs(p.x + (p.n - 1) * (p.dx || 0)),
        );
        ey = Math.max(
          ey,
          Math.abs(p.y),
          Math.abs(p.y + (p.n - 1) * (p.dy || 0)),
        );
      } else {
        ex = Math.max(ex, Math.abs(p.x) + p.w / 2);
        ey = Math.max(ey, Math.abs(p.y) + p.d / 2);
      }
    });
    return [ex * sc, ey * sc];
  };

  /* vạch qua đường (zebra): băng qua con đường có hướng (ux,uy), rộng w, tại (x,y) */
  function zebra(g, x, y, ux, uy, w) {
    const nx = -uy,
      ny = ux,
      n = Math.max(3, Math.round(w / 0.9)),
      len = 1.5;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const t = -w / 2 + 0.4 + ((w - 0.8) * k) / (n - 1);
      const px = x + nx * t,
        py = y + ny * t;
      g.moveTo(px - (ux * len) / 2, py - (uy * len) / 2);
      g.lineTo(px + (ux * len) / 2, py + (uy * len) / 2);
    }
    g.stroke();
  }

  const hash2 = (a, b) => {
    let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };

  /* phần đất dùng được của một ô: lề phố ở mép block, khe nhỏ giữa hai nhà trong block */
  const span = (g, p) =>
    p >= B
      ? [g + SM, p - 2 * SM]
      : g % B === 0
        ? [g + SM, p - SM - SI]
        : [g + SI, p - SM - SI];

  function create(X) {
    const {
      BW,
      BH,
      PX_KM,
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
    } = X;
    const rng = mulberry(11);
    const R = (a, b) => a + rng() * (b - a);
    const pick = (a) => a[(rng() * a.length) | 0];
    const lowQ = window.matchMedia("(max-width:1100px)").matches;

    const Z = ZONES.map((z) => {
      const [x, y] = z.px || geo(z.lat, z.lng);
      return { ...z, x, y, rx: z.rx * PX_KM, ry: z.ry * PX_KM, top: 24 };
    });
    const inZ = (z, x, y) =>
      ((x - z.x) / z.rx) ** 2 + ((y - z.y) / z.ry) ** 2 < 1;
    const zoneAt = (x, y) => Z.find((z) => inZ(z, x, y));

    /* ----- MẠNG ĐƯỜNG THỐNG NHẤT: toàn bộ nằm trên lưới block => không thể đè lệch nhau ----- */
    const NX = Math.floor(BW / B),
      NY = Math.floor(BH / B);
    const avKey = new Map(),
      avRects = [];
    AVENUES.forEach((a) => {
      for (let k = 1; k < a.pts.length; k++) {
        const [i0, j0] = a.pts[k - 1],
          [i1, j1] = a.pts[k];
        if (j0 === j1) {
          for (let i = Math.min(i0, i1); i < Math.max(i0, i1); i++) {
            avKey.set(`h:${i}:${j0}`, a);
            avRects.push([i * B, j0 * B - 2.4, (i + 1) * B, j0 * B + 2.4]);
          }
        } else {
          for (let j = Math.min(j0, j1); j < Math.max(j0, j1); j++) {
            avKey.set(`v:${i0}:${j}`, a);
            avRects.push([i0 * B - 2.4, j * B, i0 * B + 2.4, (j + 1) * B]);
          }
        }
      }
    });
    /* mỗi "đoạn" = một cạnh block (từ nút lưới tới nút kế tiếp); đoạn cuối kéo tới mép bản đồ */
    const units = [];
    for (let j = 0; j <= NY; j++) {
      for (let i = 0; i <= NX; i++) {
        const x0 = i * B,
          y0 = j * B,
          x1 = i < NX ? x0 + B : BW;
        if (x1 - x0 > 1)
          units.push({
            h: true,
            i,
            j,
            x0,
            y0,
            x1,
            y1: y0,
            end: i < NX,
            key: `h:${i}:${j}`,
          });
      }
    }
    for (let i = 0; i <= NX; i++) {
      for (let j = 0; j <= NY; j++) {
        const x0 = i * B,
          y0 = j * B,
          y1 = j < NY ? y0 + B : BH;
        if (y1 - y0 > 1)
          units.push({
            h: false,
            i,
            j,
            x0,
            y0,
            x1: x0,
            y1,
            end: j < NY,
            key: `v:${i}:${j}`,
          });
      }
    }
    units.forEach((u) => {
      u.av = avKey.get(u.key);
      u.w = u.av ? SW_MAIN : SW_MIN;
      u.len = u.h ? u.x1 - u.x0 : u.y1 - u.y0;
    });
    const pt = (u, t) => (u.h ? [u.x0 + t, u.y0] : [u.x0, u.y0 + t]);

    /* ----- BẢNG CHIẾM CHỖ: không cho hai công trình đè lên nhau ----- */
    const OC = 12,
      occ = new Map();
    const hit = (x0, y0, x1, y1, m) => {
      x0 -= m;
      y0 -= m;
      x1 += m;
      y1 += m;
      for (let i = Math.floor(x0 / OC); i <= Math.floor(x1 / OC); i++) {
        for (let j = Math.floor(y0 / OC); j <= Math.floor(y1 / OC); j++) {
          const a = occ.get(i * 1000 + j);
          if (a)
            for (const r of a)
              if (!(x1 <= r[0] || x0 >= r[2] || y1 <= r[1] || y0 >= r[3]))
                return true;
        }
      }
      return false;
    };
    const reserve = (x0, y0, x1, y1) => {
      const r = [x0, y0, x1, y1];
      for (let i = Math.floor(x0 / OC); i <= Math.floor(x1 / OC); i++) {
        for (let j = Math.floor(y0 / OC); j <= Math.floor(y1 / OC); j++) {
          const k = i * 1000 + j;
          (occ.get(k) || occ.set(k, []).get(k)).push(r);
        }
      }
    };
    const insideOutline = (x0, y0, x1, y1) =>
      [
        [x0, y0],
        [x1, y0],
        [x0, y1],
        [x1, y1],
      ].every((p) => inPoly(p[0], p[1], OUTLINE));
    /* hình chữ nhật có chạm đại lộ / sông không */
    const clearWater = (x0, y0, x1, y1) => {
      for (const r of avRects)
        if (x0 < r[2] && x1 > r[0] && y0 < r[3] && y1 > r[1]) return false;
      for (let i = 0; i < 5; i++) {
        for (let j = 0; j < 5; j++) {
          const px = x0 + ((x1 - x0) * i) / 4,
            py = y0 + ((y1 - y0) * j) / 4;
          if (nearPoly(px, py, RIVER, RIVER_CLEAR)) return false;
        }
      }
      return true;
    };
    const ok = (x0, y0, x1, y1) =>
      insideOutline(x0, y0, x1, y1) && clearWater(x0, y0, x1, y1);

    /* ----- 4 điểm mốc + sân bay: bệ lát nằm đúng trong các ô block ----- */
    function placeSites() {
      COMPANIES.forEach((c) => {
        const bl = PADS[c.id];
        if (!bl) return;
        const pad = padRect(bl[0], bl[1]);
        let x0 = 1e9,
          x1 = -1e9,
          y0 = 1e9,
          y1 = -1e9;
        (MODELS[c.id] || []).forEach((p) => {
          if (p.k === "f") return;
          if (p.k === "tr") {
            const ex = p.x + (p.n - 1) * (p.dx || 0),
              ey = p.y + (p.n - 1) * (p.dy || 0);
            x0 = Math.min(x0, p.x, ex);
            x1 = Math.max(x1, p.x, ex);
            y0 = Math.min(y0, p.y, ey);
            y1 = Math.max(y1, p.y, ey);
          } else {
            x0 = Math.min(x0, p.x - p.w / 2);
            x1 = Math.max(x1, p.x + p.w / 2);
            y0 = Math.min(y0, p.y - p.d / 2);
            y1 = Math.max(y1, p.y + p.d / 2);
          }
        });
        const s = Math.min(
          ML,
          (pad[2] - pad[0] - 7) / (x1 - x0),
          (pad[3] - pad[1] - 7) / (y1 - y0),
        );
        c.sc = s;
        c.pad = pad;
        c.x = (pad[0] + pad[2]) / 2 - ((x0 + x1) / 2) * s; // gốc mô hình (= ghim) sao cho cả mô hình nằm giữa bệ
        c.y = (pad[1] + pad[3]) / 2 - ((y0 + y1) / 2) * s;
      });
    }
    placeSites();

    const lmRect = new Map();
    COMPANIES.forEach((c) => {
      if (!c.pad) return;
      lmRect.set(c.id, c.pad);
      reserve(...c.pad);
    });
    const AIR_RECT = padRect(AIR[0], AIR[1]);
    reserve(...AIR_RECT);
    TOWERS.forEach((t) => {
      const h = t.tiers[0][0] / 2 + 3;
      reserve(t.x - h, t.y - h, t.x + h, t.y + h);
    });
    PARKS.forEach((p) =>
      reserve(p.x - 1, p.y - 1, p.x + p.w + 1, p.y + p.h + 1),
    );

    /* công trình đặc trưng từng khu: tự tìm chỗ trống gần tâm khu (né sông + đại lộ) */
    const sigPos = {},
      sigRects = [];
    Z.forEach((z, zi) => {
      const sg = SIG[z.id];
      if (!sg) return;
      const [ex, ey] = extList(sg, SS);
      const px = ex + 2,
        py = ey + 2;
      for (const rf of [0, 0.18, 0.34, 0.5, 0.66, 0.82]) {
        for (let a = 0; a < 12; a++) {
          const ang = (a * Math.PI) / 6 + zi * 0.35;
          const cx = z.x + Math.cos(ang) * z.rx * rf,
            cy = z.y + Math.sin(ang) * z.ry * rf;
          const x0 = cx - px,
            y0 = cy - py,
            x1 = cx + px,
            y1 = cy + py;
          if (!ok(x0, y0, x1, y1) || hit(x0, y0, x1, y1, 0)) continue;
          sigPos[z.id] = [cx, cy];
          sigRects.push([x0, y0, x1, y1]);
          reserve(x0, y0, x1, y1);
          return;
        }
      }
    });

    const majors = [],
      minors = [],
      lmBoxes = [],
      lmSpecs = []; // lmSpecs: mọi khối 3D của điểm mốc + cầu (chỉ để validate())
    let gid = 0;
    const ground = { flats: [], trees: [] };
    const site = { flats: [], trees: [] };
    let cf = [],
      ct = [];
    let curRoof = "tl";

    const roofOf = (gx, gy) => {
      const u = hash2(Math.floor(gx / B), Math.floor(gy / B));
      let r = u < 0.45 ? "tl" : u < 0.78 ? "sl" : "fg";
      if (rng() < 0.16) r = pick(["tl", "sl", "fg"]);
      return r;
    };

    const nF = (s, cx, cy, z) => {
      let t;
      if (z) {
        const d = Math.min(1, Math.hypot((cx - z.x) / z.rx, (cy - z.y) / z.ry));
        t = 0.62 * (1 - d) + 0.38 * Math.pow(rng(), s.sk || 1);
      } else t = Math.pow(rng(), s.sk || 1.5);
      return Math.round(s.fl[0] + (s.fl[1] - s.fl[0]) * t);
    };
    const dim = (s, p) => [p * R(s.wf[0], s.wf[1]), p * R(s.df[0], s.df[1])];
    const glass = (s) => (rng() < (s.gl ?? 0.55) ? GL[0] : GL[1]);

    /* trả về spec vừa tạo để nơi gọi gắn thêm lv (số tầng nằm dưới) hoặc att (gắn vào tường) */
    const box = (S, cx, cy, w, d, h, z, cls, b, lit, mn = 2.5) => {
      const W = Math.max(w, mn),
        D2 = Math.max(d, mn);
      const o = {
        k: "b",
        x: cx - W / 2,
        y: cy - D2 / 2,
        w: W,
        d: D2,
        h,
        z,
        cls,
      };
      if (b) o.b = b;
      if (lit) {
        o.lit = lit;
        o.wx = (rng() * 23) | 0;
        o.wy = (rng() * 19) | 0;
      }
      S.push(o);
      return o;
    };
    const flat = (cx, cy, w, d, cls) => {
      cf.push({ x: cx - w / 2, y: cy - d / 2, w, d, cls });
    };
    const tree = (x, y) => {
      if (!lowQ) ct.push({ x, y });
    };

    const K = {
      tower(f, cx, cy, s, p, z) {
        const [W, D2] = dim(s, p),
          ph = fl(R(2, 3)),
          h = fl(nF(s, cx, cy, z)),
          g = glass(s);
        box(f, cx, cy, W, D2, ph, 0, "dz st lit", null, "day:#8b7a5c"); // lv 0 (đế)
        box(
          f,
          cx,
          cy,
          W * 0.72,
          D2 * 0.72,
          h,
          ph,
          `dz ${g[0]} lit rp`,
          null,
          g[1],
        ).lv = 1;
        let top = ph + h;
        if (h > fl(10)) {
          // mũ tháp 2 bậc cho tháp cao: lv 2 và 3 (mỗi bậc nằm trên một khối đã được nâng)
          box(f, cx, cy, W * 0.46, D2 * 0.46, fl(1.5), top, "dz rf", null, null).lv = 2;
          box(f, cx, cy, W * 0.2, D2 * 0.2, fl(2.5), top + fl(1.5), "dz rf", null, null).lv = 3;
          top += fl(4);
        }
        return top;
      },
      office(f, cx, cy, s, p, z) {
        const [w, d] = dim(s, p),
          h = fl(nF(s, cx, cy, z));
        if (rng() < 0.55) {
          const g = glass(s);
          box(f, cx, cy, w, d, h, 0, `dz ${g[0]} lit rp`, null, g[1]);
        } else box(f, cx, cy, w, d, h, 0, "dz lit rp", pick(CR), DAY);
        return h;
      },
      low(f, cx, cy, s, p) {
        const [w, d] = dim(s, p),
          h = fl(Math.round(R(2, 4)));
        box(f, cx, cy, w, d, h, 0, "dz lit " + curRoof, pick(CR), DAY);
        /* mái hiên cửa hàng ở mặt tiền (phía Nam), dày tối đa 1,0 và KHÔNG vượt quá phần đất trống phía Nam của chính ô này:
           (p - d) / 2 là khoảng trống tới mép ô, +0,3 vừa lọt vào khe SI giữa hai hàng nhà => không chọc sang nhà bên cạnh. */
        const aw = Math.min(1.0, (p - d) / 2 + 0.3);
        const awc = pick(["tl", "sl"]),
          awb = pick(["#c8602f", "#2f7f8f", "#d9a441"]);
        if (w > 7 && aw >= 0.5) {
          box(f, cx, cy + d / 2 + aw / 2, w * 0.7, aw, 0.5, fl(1), "dz " + awc, awb, null, 0.4).att = 1;
        }
        return h;
      },
      town(f, cx, cy, s, p, z) {
        const [w, d] = dim(s, p),
          n = Math.min(nF(s, cx, cy, z), 6),
          h = fl(n);
        box(f, cx, cy, w, d, h, 0, "dz lit " + curRoof, pick(CR), DAY);
        return h;
      },
            nc(f, cx, cy, s, p) {
        const w = p,
          d = p,
          n = rng() < 0.5 ? 5 : 4,
          h = fl(n),
          ph = fl(1.4);
        // tầng trệt be đậm (cửa vòm tối)
        box(f, cx, cy, w, d, ph, 0, "dz lit nb", "#e2cfa3", "day:#4a3f36");
        // các tầng trên: kem, cửa kính tối
        box(f, cx, cy, w, d, h - ph, ph, "dz lit nc", "#f1e8d2", "day:#3f4d6b").lv = 1;
        // dải ban công đen nhô nhẹ (ở tầng 3)
        const bz = ph + fl(1.5);
        box(f, cx, cy, w + 0.3, d + 0.3, 0.4, bz, "dz ds", null, null).lv = 2;
        f[f.length - 1].att = 1;
        // gờ mái kem
        box(f, cx, cy, w + 0.3, d + 0.3, 0.5, h, "dz nc", "#f1e8d2", null).lv = 2;
        f[f.length - 1].att = 1;
        // mái mansard xanh than, 2 bậc
        box(f, cx, cy, w * 0.94, d * 0.94, 1.0, h + 0.5, "dz mf", "#39425e", null).lv = 3;
        box(f, cx, cy, w * 0.66, d * 0.66, 0.9, h + 1.5, "dz mf", "#39425e", null).lv = 4;
        // cửa mái (dormer) ở mặt trước
        box(f, cx, cy + d * 0.41, w * 0.22, d * 0.1, 0.9, h + 1.5, "dz nc", "#f1e8d2", null, 1).lv = 4;
        return h + 2.4;
      },
      villa(f, cx, cy, s, p) {
        let top = 0;
        for (let i = 0; i < 2; i++)
          for (let j = 0; j < 2; j++) {
            const h = fl(2 + (rng() < 0.4 ? 1 : 0));
            box(
              f,
              cx + (i - 0.5) * p * 0.5,
              cy + (j - 0.5) * p * 0.5,
              p * 0.46,
              p * 0.46,
              h,
              0,
              "dz lit " + curRoof,
              pick(CR),
              DAY,
            );
            top = Math.max(top, h);
          }
        return top;
      },
      wh(f, cx, cy, s, p) {
        const [w, d] = dim(s, p),
          h = fl(R(1.6, 2.4));
        box(f, cx, cy, w, d, h, 0, "dz wh", null, null);
        return h;
      },
      campus(f, cx, cy, s, p, z) {
        const [w, d] = dim(s, p),
          h = fl(Math.min(nF(s, cx, cy, z), 8));
        flat(cx, cy, Math.min(p, w + 1.2), Math.min(p, d + 1.2), "grass");
        box(
          f,
          cx,
          cy,
          w * 0.86,
          d * 0.86,
          h,
          0,
          "dz cp lit rp",
          null,
          h > fl(4) ? "stripe:#3d5f8c" : DAY,
        );
        tree(cx + w / 2 - 0.6, cy);
        return h;
      },
      tech(f, cx, cy, s, p, z) {
        const [w, d] = dim(s, p),
          h = fl(nF(s, cx, cy, z)),
          g = glass(s);
        flat(cx, cy, Math.min(p, w + 1.2), Math.min(p, d + 1.2), "plaza");
        box(f, cx, cy, w * 0.9, d * 0.9, h, 0, `dz ${g[0]} lit rp`, null, g[1]);
        return h;
      },
    };

    function greenCell(sx, sy, sw, sh, cx, cy) {
      const x0 = sx,
        y0 = sy,
        x1 = sx + sw,
        y1 = sy + sh;
      if (!ok(x0, y0, x1, y1) || hit(x0, y0, x1, y1, 0)) return;
      reserve(x0, y0, x1, y1);
      ground.flats.push({
        x: sx,
        y: sy,
        w: sw,
        d: sh,
        cls: rng() < 0.6 ? "grass" : "plaza",
      });
      tree(cx, cy);
    }

    const tmp = [];
    function run(z, s) {
      const p = s.pitch;
      const x0 = z ? Math.floor((z.x - z.rx) / p) * p : 0;
      const y0 = z ? Math.floor((z.y - z.ry) / p) * p : 0;
      const x1 = z ? z.x + z.rx : BW,
        y1 = z ? z.y + z.ry : BH;
      const keys = Object.keys(s.kinds),
        tot = keys.reduce((a, k) => a + s.kinds[k], 0);
      for (let gy = y0; gy < y1; gy += p) {
        for (let gx = x0; gx < x1; gx += p) {
          const [sx, sw] = span(gx, p),
            [sy, sh] = span(gy, p);
          const cx = sx + sw / 2,
            cy = sy + sh / 2,
            q = Math.min(sw, sh);
          if (z ? zoneAt(cx, cy) !== z : zoneAt(cx, cy)) continue;
          curRoof = roofOf(gx, gy);
          if (rng() > s.fill) {
            greenCell(sx, sy, sw, sh, cx, cy);
            continue;
          }
          let t = rng() * tot,
            kind = keys[0];
          for (const k of keys) {
            t -= s.kinds[k];
            if (t <= 0) {
              kind = k;
              break;
            }
          }
          tmp.length = 0;
          cf = [];
          ct = [];
          const top = K[kind](tmp, cx, cy, s, q, z);
          let bx0 = 1e9,
            by0 = 1e9,
            bx1 = -1e9,
            by1 = -1e9;
          for (const o of tmp) {
            bx0 = Math.min(bx0, o.x);
            by0 = Math.min(by0, o.y);
            bx1 = Math.max(bx1, o.x + o.w);
            by1 = Math.max(by1, o.y + o.d);
          }
          for (const o of cf) {
            bx0 = Math.min(bx0, o.x);
            by0 = Math.min(by0, o.y);
            bx1 = Math.max(bx1, o.x + o.w);
            by1 = Math.max(by1, o.y + o.d);
          }
          if (!ok(bx0, by0, bx1, by1) || hit(bx0, by0, bx1, by1, 0.3)) {
            greenCell(sx, sy, sw, sh, cx, cy);
            continue;
          }
          reserve(bx0, by0, bx1, by1);
          const id = ++gid;
          const dst = top >= MAJOR_H ? majors : minors;
          for (let i = 0; i < tmp.length; i++) {
            tmp[i].gid = id;
            tmp[i].ax = cx; // tâm toà: map.js gom ô LOD theo đây
            tmp[i].ay = cy;
            dst.push(tmp[i]);
          }
          ground.flats.push(...cf);
          ground.trees.push(...ct);
          if (z && top > z.top) z.top = top;
        }
      }
    }

    function placeSig(z) {
      const pos = sigPos[z.id];
      if (!pos) return;
      const [ox, oy] = pos;
      const solids = []; // gom cả cụm trước, rồi mới gán gid theo từng toà
      SIG[z.id].forEach((p, i) => {
        if (p.k === "f") {
          ground.flats.push({
            x: ox + (p.x - p.w / 2) * SS,
            y: oy + (p.y - p.d / 2) * SS,
            w: p.w * SS,
            d: p.d * SS,
            cls: p.cls,
          });
          return;
        }
        if (p.k === "tr") {
          for (let n = 0; n < p.n; n++)
            if (!lowQ)
              ground.trees.push({
                x: ox + (p.x + n * (p.dx || 0)) * SS,
                y: oy + (p.y + n * (p.dy || 0)) * SS,
              });
          return;
        }
        const w = p.w * SS,
          d = p.d * SS,
          h = fl(p.f),
          zz = fl(p.zf || 0),
          cx = ox + p.x * SS,
          cy = oy + p.y * SS;
        solids.push({
          k: "b",
          x: cx - w / 2,
          y: cy - d / 2,
          w,
          d,
          h,
          z: zz,
          cls: p.cls,
          b: p.b,
          lit: p.lit,
          wx: (i * 7) % 23,
          wy: (i * 5) % 19,
        });
        if (zz + h > z.top) z.top = zz + h;
      });
      if (!solids.length) return;

      /* MỖI TOÀ MỘT gid: khối đặt trên đất (z = 0) là một toà; khối xếp chồng (z > 0) thừa hưởng gid của khối nó nằm trên.
         Nhờ vậy resolveOverlaps chỉ bỏ đúng toà bị chồng, không xoá cả cụm công trình của khu. */
      const base = solids.filter((o) => !(o.z > 0));
      base.forEach((o, n) => {
        o.gid = `S${z.id}:${n}`;
        o.lv = 0;
      });
      solids
        .filter((o) => o.z > 0)
        .forEach((o, n) => {
          const cx = o.x + o.w / 2,
            cy = o.y + o.d / 2;
          const inside = (b) =>
            cx > b.x && cx < b.x + b.w && cy > b.y && cy < b.y + b.d;
          const sup =
            base.find((b) => inside(b) && Math.abs(b.h - o.z) < 0.01) ||
            base.find(inside);
          o.gid = sup ? sup.gid : `S${z.id}:x${n}`;
          o.lv = 1;
        });

      /* cả toà (đế + tầng trên) đi CHUNG một lớp LOD và chung một ô cắt => không còn cảnh tháp còn mà đế biến mất */
      const groups = new Map();
      solids.forEach((o) =>
        (groups.get(o.gid) || groups.set(o.gid, []).get(o.gid)).push(o),
      );
      groups.forEach((l) => {
        const a = l.find((o) => !(o.z > 0)) || l[0];
        l.forEach((o) => {
          o.ax = a.x + a.w / 2;
          o.ay = a.y + a.d / 2;
        });
        const peak = Math.max(...l.map((o) => o.z + o.h));
        (peak >= MAJOR_H ? majors : minors).push(...l);
      });
    }

    /* Quét lần cuối: toà nào vẫn ĐÈ THẬT lên toà khác (hoặc lên bệ điểm mốc) thì bỏ, thay bằng sân cỏ.
       Chỉ xét khối đặt trên đất (z = 0): khối xếp chồng đi theo toà của nó (cùng gid). Vì SIG nay có gid riêng cho
       từng toà, một toà chồng lấn chỉ làm mất đúng toà đó. */
    function resolveOverlaps() {
      const CS = 16,
        EPS = -0.15,
        cells = new Map();
      const each = (o, f) => {
        for (
          let i = Math.floor(o.x / CS);
          i <= Math.floor((o.x + o.w) / CS);
          i++
        )
          for (
            let j = Math.floor(o.y / CS);
            j <= Math.floor((o.y + o.d) / CS);
            j++
          )
            f(i * 4096 + j);
      };
      const cross = (a, b) =>
        a.x < b.x + b.w + EPS &&
        a.x + a.w > b.x - EPS &&
        a.y < b.y + b.d + EPS &&
        a.y + a.d > b.y - EPS;
      const test = (o) => {
        for (const r of lmRect.values())
          if (o.x < r[2] && o.x + o.w > r[0] && o.y < r[3] && o.y + o.d > r[1])
            return true;
        let bad = false;
        each(o, (k) => {
          const a = cells.get(k);
          if (a && !bad)
            for (const r of a)
              if (cross(o, r)) {
                bad = true;
                break;
              }
        });
        return bad;
      };
      const groups = new Map();
      for (const o of majors.concat(minors)) {
        if (o.z > 0) continue;
        const a = groups.get(o.gid);
        a ? a.push(o) : groups.set(o.gid, [o]);
      }
      const tall = (l) => Math.max(...l.map((o) => o.h));
      const dead = new Set();
      [...groups.entries()]
        .sort((a, b) => tall(b[1]) - tall(a[1]))
        .forEach(([id, l]) => {
          if (l.some(test)) {
            dead.add(id);
            let x0 = 1e9,
              y0 = 1e9,
              x1 = -1e9,
              y1 = -1e9;
            l.forEach((o) => {
              x0 = Math.min(x0, o.x);
              y0 = Math.min(y0, o.y);
              x1 = Math.max(x1, o.x + o.w);
              y1 = Math.max(y1, o.y + o.d);
            });
            ground.flats.push({
              x: x0,
              y: y0,
              w: x1 - x0,
              d: y1 - y0,
              cls: "grass",
            });
            return;
          }
          l.forEach((o) =>
            each(o, (k) => (cells.get(k) || cells.set(k, []).get(k)).push(o)),
          );
        });
      const keep = (a) => {
        let k = 0;
        for (const o of a) if (!dead.has(o.gid)) a[k++] = o;
        a.length = k;
      };
      keep(majors);
      keep(minors);
    }
        /* Sân bay Tân Sơn Nhất 3D (nằm gọn trong AIR_RECT 91 x 59):
       nhà ga mái xám + 2 cánh, đài chỉ huy 3 tầng kính, bãi đỗ, bãi cỏ + cây, 3 máy bay ở sân đỗ.
       Toạ độ viết theo hệ cục bộ (0,0 = góc trên trái của bệ). */
    function airport() {
      const [X0, Y0] = AIR_RECT;
      const flatA = (x, y, w, d, cls) =>
        ground.flats.push({ x: X0 + x, y: Y0 + y, w, d, cls });
      const b = (x, y, w, d, h, z, cls, lit, lv, att) => {
        const o = { k: "b", x, y, w, d, h, z, cls, lv: lv || 0 };
        if (lit) o.lit = lit;
        if (att) o.att = 1; // phần nhô ra (mái, cánh): bỏ qua khi validate()
        return o;
      };
      let n = 0;
      const grp = (id, cx, cy, list) => {
        list.forEach((o) => {
          o.gid = "TSN:" + id;
          o.ax = X0 + cx;
          o.ay = Y0 + cy;
          o.x += X0;
          o.y += Y0;
          o.wx = (n * 7) % 23;
          o.wy = (n * 5) % 19;
          n++;
        });
        const peak = Math.max(...list.map((o) => o.z + o.h));
        (peak >= MAJOR_H ? majors : minors).push(...list);
      };
      const GL = "glass:#79b2d4",
        GN = "glass:#6cc6c8",
        DY = "day:#6f8fae";

      // mặt đất: nền phẳng (không kẻ ô), sân đỗ máy bay, bãi cỏ, bãi đỗ xe
      flatA(0, 0, 91, 59, "tarmac");
      flatA(12, 4, 70, 16, "park");
      flatA(4, 46, 44, 12, "grass");
      flatA(52, 46, 22, 12, "park");

      // nhà ga chính: thân kính + mái 3 bậc thu dần (gần giống mái cong)
      const H1 = fl(2.5);
      grp("term", 47, 32, [
        b(14, 24, 66, 16, H1, 0, "dz gl3 lit", GL),
        b(30, 40, 30, 4, fl(1.6), 0, "dz cp lit", DY),
        b(12, 22, 70, 20, 0.5, H1, "dz ar", null, 1, 1),
        b(18, 25, 58, 14, 1.1, H1 + 0.5, "dz ar", null, 2, 1),
        b(28, 28, 38, 8, 1.1, H1 + 1.6, "dz ar", null, 3, 1),
      ]);

      // hai cánh nhà ga (cầu hành khách)
      const H2 = fl(2);
      grp("pierL", 7, 23, [
        b(2, 6, 10, 34, H2, 0, "dz cp lit", DY),
        b(1, 5, 12, 36, 0.5, H2, "dz ar", null, 1, 1),
      ]);
      grp("pierR", 86, 23, [
        b(82, 6, 9, 34, H2, 0, "dz cp lit", DY),
        b(81, 5, 11, 36, 0.5, H2, "dz ar", null, 1, 1),
      ]);

      // đài chỉ huy không lưu (góc phải, xa hàng cây): thân trắng + 2 tầng buồng kính + mái + chỏm tròn
      grp("tower", 82, 52, [
        b(80.3, 50.3, 3.4, 3.4, 30, 0, "dz cp"),
        b(78.5, 48.5, 7, 7, 2.4, 30, "dz gl2 lit", GN, 1, 1),
        b(77.8, 47.8, 8.4, 8.4, 0.5, 32.4, "dz rf", null, 2, 1),
        b(79.5, 49.5, 5, 5, 1.8, 32.9, "dz gl2 lit", GN, 3, 1),
        b(78.8, 48.8, 6.4, 6.4, 0.5, 34.7, "dz rf", null, 4, 1),
        b(81, 51, 2, 2, 2, 35.2, "dz cp", null, 5, 1),
      ]);

      // 3 máy bay thân rộng trên sân đỗ (mũi quay về phía nhà ga, +y)
      [26, 47, 68].forEach((cx, i) => {
        const cy = 12;
        const L = [
          b(cx - 0.9, cy - 6, 1.8, 12, 1.5, 0, "dz cp"), // thân
          b(cx - 0.6, cy + 6, 1.2, 0.9, 1.1, 0, "dz cp"), // mũi thon
          b(cx - 0.6, cy + 4.6, 1.2, 0.9, 0.2, 1.5, "dz sp", null, 1, 1), // kính buồng lái
          b(cx - 0.15, cy - 6, 0.3, 2.2, 1.4, 1.5, "dz cp", null, 1, 1), // đuôi đứng (chân)
          b(cx - 0.15, cy - 6, 0.3, 1.4, 1.0, 2.9, "dz cp", null, 2, 1), // đuôi đứng (đỉnh)
        ];
        [-1, 1].forEach((s) => {
          // dải [x trong, x ngoài] -> hộp có x nhỏ nhất ở bên trái
          const bw = (a, c, y0, y1, h, z, cls, lv) =>
            b(s < 0 ? cx - c : cx + a, cy + y0, c - a, y1 - y0, h, z, cls, null, lv, 1);
          L.push(
            bw(0.9, 2.5, -1.2, 1.8, 0.3, 0.45, "dz cp", 0), // cánh: gốc
            bw(2.5, 4.1, -2.2, 0.6, 0.3, 0.45, "dz cp", 0), // cánh: giữa (cụp ra sau)
            bw(4.1, 5.5, -3.2, -0.8, 0.3, 0.45, "dz cp", 0), // cánh: mút
            bw(2.5, 3.6, 0.6, 2.8, 0.8, 0, "dz rf", 0), // động cơ trước cánh
            bw(0.9, 2.4, -6, -4.4, 0.25, 1.0, "dz cp", 0), // cánh đuôi ngang
          );
        });
        grp("plane" + i, cx, cy, L);
      });

      // cây chỉ nằm trong bãi cỏ (x 4..48, y 46..58), cách nhà ga >= 6px và cách đài chỉ huy rất xa
      if (!lowQ) {
        for (let x = 10; x <= 42; x += 8)
          ground.trees.push({ x: X0 + x, y: Y0 + 52 });
      }
    }
    function fillCity() {
      airport();
      Z.forEach(placeSig);
      Z.forEach((z) => run(z, z.style));
      run(null, BASE);
      resolveOverlaps();
      return { majors, minors };
    }

    /* điểm mốc: chỉ trả khối 3D; sân / cây được vẽ vào canvas. Mô hình nằm gọn trong bệ c.pad, tỉ lệ c.sc */
    function landmark(c) {
      const spec = MODELS[c.id],
        out = [],
        s = c.sc || ML,
        pad = c.pad;
      const inPad = (x, y, m) =>
        x > pad[0] + m && x < pad[2] - m && y > pad[1] + m && y < pad[3] - m;
      site.flats.push({
        x: pad[0],
        y: pad[1],
        w: pad[2] - pad[0],
        d: pad[3] - pad[1],
        cls: "pave",
      });
      let top = 0;
      spec.forEach((p, i) => {
        if (p.k === "f") {
          const x0 = Math.max(c.x + (p.x - p.w / 2) * s, pad[0]),
            y0 = Math.max(c.y + (p.y - p.d / 2) * s, pad[1]);
          const x1 = Math.min(c.x + (p.x + p.w / 2) * s, pad[2]),
            y1 = Math.min(c.y + (p.y + p.d / 2) * s, pad[3]);
          if (x1 > x0 && y1 > y0)
            site.flats.push({
              x: x0,
              y: y0,
              w: x1 - x0,
              d: y1 - y0,
              cls: p.cls,
            });
          return;
        }
        if (p.k === "tr") {
          for (let n = 0; n < p.n; n++) {
            const tx = c.x + (p.x + n * (p.dx || 0)) * s,
              ty = c.y + (p.y + n * (p.dy || 0)) * s;
            if (!lowQ && inPad(tx, ty, 2)) site.trees.push({ x: tx, y: ty });
          }
          return;
        }
        const cx = c.x + p.x * s,
          cy = c.y + p.y * s,
          w = p.w * s,
          d = p.d * s,
          h = flm(p.f),
          z = flm(p.zf || 0);
        const lv0 = z > 0 ? 1 : 0; // khối đặt trên khối khác (zf) là tầng 1
        const o = {
          k: "b",
          x: cx - w / 2,
          y: cy - d / 2,
          w,
          d,
          h,
          z,
          cls: (p.main ? "co " : "") + p.cls + (p.roof === "tile" ? " tl" : ""),
          c: c.color,
          lit: p.lit || DAY,
          wx: (i * 7) % 23,
          wy: (i * 5) % 19,
          b: p.b,
          gid: "L" + c.id,
          lv: p.lv != null ? p.lv : lv0,
        };
        out.push(o);
        if (z === 0) lmBoxes.push(o);
        let t = z + h;
        if (p.roof === "plant") {
          out.push({
            k: "b",
            x: cx - w * 0.22,
            y: cy - d * 0.22,
            w: w * 0.44,
            d: d * 0.44,
            h: flm(1.4),
            z: t,
            cls: "rf",
            gid: "L" + c.id,
            lv: (p.lv != null ? p.lv : lv0) + 1, // nằm trên mái khối bên dưới => nâng thêm một tầng
          });
          t += flm(1.4);
        }
        if (p.main || p.tp) top = Math.max(top, t);
      });
      out.push(...bridges3d());
      lmSpecs.push(...out);
      return { specs: out, top: top || 40 };
    }

    /* ----- ÁNH KHU rất nhẹ (chỉ tô màu, KHÔNG vẽ đường) ----- */
    function drawGround(g) {
      Z.forEach((z) => {
        g.save();
        g.translate(z.x, z.y);
        g.scale(1, z.ry / z.rx);
        const rg = g.createRadialGradient(0, 0, 0, 0, 0, z.rx);
        rg.addColorStop(0, z.ground + "22");
        rg.addColorStop(0.7, z.ground + "0c");
        rg.addColorStop(1, z.ground + "00");
        g.fillStyle = rg;
        g.beginPath();
        g.arc(0, 0, z.rx, 0, Math.PI * 2);
        g.fill();
        g.restore();
      });
    }

    /* ----- MẠNG ĐƯỜNG: tính MỘT LẦN (sau fillCity) ----- */
    /* ---------- 1) net(): mạng đường, mọi đường cắt ngang sông đều có cầu ---------- */
    let NET = null;
    function net() {
      if (NET) return NET;
      const EX = [
        ...lmRect.values(),
        AIR_RECT,
        ...PARKS.map((p) => [p.x, p.y, p.x + p.w, p.y + p.h]),
        ...sigRects,
      ];
      const inEx = (x, y) => {
        for (const r of EX)
          if (x > r[0] && x < r[2] && y > r[1] && y < r[3]) return true;
        return false;
      };
      const inRv = (x, y) => nearPoly(x, y, RIVER, 10.6);

      /* các đoạn liên tiếp "true": trả về [t đầu, t cuối] theo khoảng cách dọc đường */
      const runsOf = (fl2, ts) => {
        const o = [];
        let a = null,
          b = 0;
        fl2.forEach((f, k) => {
          if (f) {
            if (a == null) a = ts[k];
            b = ts[k];
          } else if (a != null) {
            o.push([a, b]);
            a = null;
          }
        });
        if (a != null) o.push([a, b]);
        return o;
      };
      /* các đoạn liên tiếp "true": trả về [chỉ số đầu, chỉ số cuối] */
      const idxRuns = (arr) => {
        const o = [];
        let a = -1;
        arr.forEach((f, k) => {
          if (f) {
            if (a < 0) a = k;
          } else if (a >= 0) {
            o.push([a, k - 1]);
            a = -1;
          }
        });
        if (a >= 0) o.push([a, arr.length - 1]);
        return o;
      };

      const f2 = (v) => v.toFixed(2);
      const nodes = new Map();
      const arm = (i, j, dx, dy, w, len) => {
        const k = i + ":" + j;
        let n = nodes.get(k);
        if (!n) nodes.set(k, (n = { x: i * B, y: j * B, arms: [], w: 0 }));
        n.arms.push({ dx, dy, w, len });
        n.w = Math.max(n.w, w);
      };
      const N = {
        nodes,
        bridges: [],
        labels: [],
        lamps: [],
        pn: "",
        pm: "",
        cn: "",
        cm: "",
      };
      const lab = new Map();

      for (const u of units) {
        const cnt = Math.max(2, Math.ceil(u.len / 1.5) + 1);
        const ts = [],
          wet = [],
          blk = [],
          land = [],
          road = [];
        for (let k = 0; k < cnt; k++) {
          const t = (u.len * k) / (cnt - 1),
            p = pt(u, t);
          const rv = inRv(p[0], p[1]),
            ex = inEx(p[0], p[1]);
          ts.push(t);
          wet.push(rv); // điểm nằm trên sông
          blk.push(ex); // điểm nằm trong công viên / bệ / khu đặc trưng
          land.push(!ex && !rv); // đất liền có thể đặt đường (dùng cho vạch giữa)
          road.push(!ex && (!!u.av || !rv)); // mặt nhựa liên tục (đại lộ đi thẳng qua sông)
        }

        /* MỌI đường cắt ngang sông đều có cầu: đại lộ như cũ, phố nhỏ nếu hai bờ đều còn đất */
        let bridged = false;
        for (const [s0, e0] of idxRuns(wet)) {
          const proper = s0 > 0 && e0 < cnt - 1; // thật sự băng qua sông, không chỉ chạm mép
          if (!u.av && !proper) continue; // phố nhỏ chỉ chạm mép sông => dừng ở bờ như cũ
          const i0 = Math.max(0, s0 - 1),
            i1 = Math.min(cnt - 1, e0 + 1);
          let clear = true;
          for (let k = i0; k <= i1; k++)
            if (blk[k]) {
              clear = false;
              break;
            } // dính công viên / bệ => bỏ cầu
          if (!clear) continue;
          for (let k = s0; k <= e0; k++) road[k] = true; // lấp nhựa liền qua sông
          N.bridges.push({ u, t0: ts[i0], t1: ts[i1] }); // cầu đi từ mép bờ này sang mép bờ kia
          bridged = true;
        }

        /* mặt nhựa + ngã tư (chạy liền qua cầu) */
        for (const [a, b] of runsOf(road, ts)) {
          if (b - a < 6) continue; // bỏ đoạn cụt quá ngắn
          const sa = a <= 0.01,
            sb = b >= u.len - 0.01 && u.end;
          const [x0, y0] = pt(u, a),
            [x1, y1] = pt(u, b);
          const seg = `M${f2(x0)} ${f2(y0)}L${f2(x1)} ${f2(y1)}`;
          if (u.av) N.pm += seg;
          else N.pn += seg;
          if (sa) arm(u.i, u.j, u.h ? 1 : 0, u.h ? 0 : 1, u.w, b - a);
          if (sb)
            arm(
              u.h ? u.i + 1 : u.i,
              u.h ? u.j : u.j + 1,
              u.h ? -1 : 0,
              u.h ? 0 : -1,
              u.w,
              b - a,
            );
          if (u.av && sa && b >= u.len - 0.01 && !bridged)
            (lab.get(u.av) || lab.set(u.av, []).get(u.av)).push(u);
        }

        /* vạch giữa: chỉ vẽ trên đất liền (trên cầu 3D có vạch riêng trong CSS) */
        for (const [a, b] of runsOf(land, ts)) {
          const sa = a <= 0.01,
            sb = b >= u.len - 0.01 && u.end;
          if (b - a <= (sa ? TRIM : 0) + (sb ? TRIM : 0) + 0.5) continue;
          const [cx0, cy0] = pt(u, sa ? a + TRIM : a),
            [cx1, cy1] = pt(u, sb ? b - TRIM : b);
          const cs = `M${f2(cx0)} ${f2(cy0)}L${f2(cx1)} ${f2(cy1)}`;
          if (u.av) N.cm += cs;
          else N.cn += cs;
        }

        /* đèn đường: 2 cột / đoạn đại lộ, so le hai bên, chỉ đặt trên đất liền */
        if (u.av) {
          [8, 24].forEach((t, n) => {
            const k = Math.round((t / u.len) * (cnt - 1));
            if (!land[k]) return;
            const p0 = pt(u, t),
              side = (n % 2 ? 1 : -1) * (u.w / 2 + 1.1);
            N.lamps.push({
              x: p0[0] + (u.h ? 0 : side),
              y: p0[1] + (u.h ? side : 0),
            });
          });
        }
      }

      /* tên đại lộ: đặt ở giữa các đoạn nguyên vẹn (không có cầu) */
      lab.forEach((list, av) => {
        const n = list.length;
        const idx =
          n < 3
            ? [Math.floor(n / 2)]
            : [Math.floor(n * 0.3), Math.floor(n * 0.7)];
        idx.forEach((k) => {
          const u = list[k],
            p = pt(u, u.len / 2);
          N.labels.push({
            x: p[0],
            y: p[1],
            ang: u.h ? 0 : -Math.PI / 2,
            text: av.label,
          });
        });
      });

      NET = N;
      return N;
    }

    /* lớp 1 (vẽ TRƯỚC sông): lề sáng của MỌI đường -> mặt nhựa của MỌI đường -> lấp vuông ngã tư / góc rẽ */
    function roadsBase(g) {
      const N = net(),
        P = (d) => new Path2D(d);
      const nodeSq = (extra, col) => {
        g.fillStyle = col;
        for (const n of N.nodes.values()) {
          if (n.arms.length < 2) continue;
          const s = n.w + extra;
          g.fillRect(n.x - s / 2, n.y - s / 2, s, s);
        }
      };
      g.save();
      g.lineCap = "butt";
      g.strokeStyle = CASE;
      g.lineWidth = SW_MIN + 1.0;
      g.stroke(P(N.pn));
      g.lineWidth = SW_MAIN + 1.0;
      g.stroke(P(N.pm));
      nodeSq(1.0, CASE);
      g.strokeStyle = ASPH;
      g.lineWidth = SW_MIN;
      g.stroke(P(N.pn));
      g.lineWidth = SW_MAIN;
      g.stroke(P(N.pm));
      nodeSq(0, ASPH);
      /* đèn đường: bóng + cột + bóng đèn */
      for (const L of N.lamps) {
        g.fillStyle = "rgba(0,0,0,.25)";
        g.beginPath();
        g.ellipse(L.x + 0.5, L.y + 0.6, 0.9, 0.5, 0, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "#9aa0ad";
        g.beginPath();
        g.arc(L.x, L.y, 0.45, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = "rgba(255,236,170,.9)";
        g.beginPath();
        g.arc(L.x, L.y, 0.22, 0, Math.PI * 2);
        g.fill();
      }
      g.restore();
    }

    /* lớp 2 (vẽ SAU sông): cầu -> vạch giữa -> tên đường -> vạch qua đường */
    function roadsTop(g) {
      const N = net(),
        P = (d) => new Path2D(d);
      g.save();
      g.lineCap = "butt";

      /* bóng đổ của cầu xuống mặt nước */
      for (const b of N.bridges) {
        const [x0, y0] = pt(b.u, b.t0),
          [x1, y1] = pt(b.u, b.t1);
        g.strokeStyle = "rgba(8,24,70,.28)";
        g.lineWidth = b.u.w + 2.2;
        g.beginPath();
        g.moveTo(x0 + 1.2, y0 + 1.6);
        g.lineTo(x1 + 1.2, y1 + 1.6);
        g.stroke();
      }

      /* mặt cầu phẳng: lề sáng + nhựa, cùng bề rộng với đường trên bờ => nối khít */
      for (const b of N.bridges) {
        const [x0, y0] = pt(b.u, b.t0),
          [x1, y1] = pt(b.u, b.t1);
        const p = P(
          `M${x0.toFixed(2)} ${y0.toFixed(2)}L${x1.toFixed(2)} ${y1.toFixed(2)}`,
        );
        g.strokeStyle = CASE;
        g.lineWidth = b.u.w + 1.0;
        g.stroke(p);
        g.strokeStyle = ASPH;
        g.lineWidth = b.u.w;
        g.stroke(p);
      }

      /* vạch giữa */
      g.setLineDash([1.6, 1.4]);
      g.strokeStyle = "rgba(255,255,255,.7)";
      g.lineWidth = 0.3;
      g.stroke(P(N.cn)); // phố thường
      g.setLineDash([]);
      g.strokeStyle = "rgba(244,196,48,.95)";
      g.lineWidth = 0.34;
      g.stroke(P(N.cm)); // đại lộ

      /* tên đại lộ */
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.font = `600 ${(SW_MAIN * 0.62).toFixed(2)}px "Segoe UI", Arial, sans-serif`;
      for (const L of N.labels) {
        const tw = g.measureText(L.text).width;
        if (tw > B - 8) continue;
        g.save();
        g.translate(L.x, L.y);
        g.rotate(L.ang);
        g.fillStyle = ASPH;
        g.fillRect(-tw / 2 - 0.8, -SW_MAIN / 2 + 0.3, tw + 1.6, SW_MAIN - 0.6);
        g.fillStyle = "rgba(255,255,255,.92)";
        g.fillText(L.text, 0, 0.1);
        g.restore();
      }

      /* vạch qua đường ở ngã ba / ngã tư */
      g.strokeStyle = "rgba(255,255,255,.92)";
      g.lineWidth = 0.45;
      for (const n of N.nodes.values()) {
        if (n.arms.length < 3) continue;
        for (const a of n.arms) {
          if (a.len < 9) continue;
          const d = n.w / 2 + 1.3;
          zebra(g, n.x + a.dx * d, n.y + a.dy * d, a.dx, a.dy, a.w);
        }
      }
      g.restore();
    }

    /* ----- VẼ SẴN: mặt phẳng, bóng đổ, nhà thấp (chi tiết mái), cây ----- */
    const roofCol = (m) => {
      const c = " " + m.cls + " ";
      return / tl /.test(c)
        ? "#c8602f"
        : / sl /.test(c)
          ? "#2f7f8f"
          : / gr /.test(c)
            ? "#5b9f6c"
            : / fg /.test(c)
              ? "#cfd0cc"
              : / wh /.test(c)
                ? "#c3c8d2"
                : / gl2 /.test(c)
                  ? "#aee9e4"
                  : / gl3 /.test(c)
                    ? "#bcd0ee"
                    : / rf /.test(c)
                      ? "#c9ced9"
                      : / ct /.test(c)
                        ? m.b || "#b4533c"
                        : / st /.test(c)
                          ? "#cdbf9f"
                          : / cp /.test(c)
                            ? "#e4e2dc"
                            : "#dcdad3";
    };
        /* vẽ cây nhiều loại lên canvas mặt đất. Loại cây băm từ vị trí => cố định mỗi lần mở app */
    function paintTrees(g, T) {
      const TAU = Math.PI * 2;
      const kindOf = (h) =>
        h < 0.4 ? "round" : h < 0.55 ? "pine" : h < 0.68 ? "palm" : h < 0.8 ? "cherry" : h < 0.9 ? "bush" : "willow";
      const SIZE = { round: 1, pine: 0.9, palm: 1.1, cherry: 1, bush: 0.6, willow: 1.15 };
      const dot = (x, y, r, col) => {
        g.fillStyle = col;
        g.beginPath();
        g.arc(x, y, r, 0, TAU);
        g.fill();
      };
      const list = T.map((t) => {
        const h = hash2(Math.round(t.x * 10), Math.round(t.y * 10)),
          k = kindOf(h),
          v = (h * 7) % 1;
        return { x: t.x, y: t.y, k, v, r: 2.6 * SIZE[k] * (0.74 + 0.5 * v) };
      }).sort((a, b) => a.y - b.y);

      // bóng đổ trước, để mọi tán cây nằm trên bóng
      g.fillStyle = "rgba(0,0,0,.26)";
      g.beginPath();
      for (const t of list) {
        g.moveTo(t.x + t.r * 0.4 + t.r, t.y + t.r * 0.5);
        g.arc(t.x + t.r * 0.4, t.y + t.r * 0.5, t.r, 0, TAU);
      }
      g.fill();

      for (const { x, y, r, k, v } of list) {
        if (k === "round") {
          const c = [["#2f8f3b", "#52b556"], ["#36963f", "#58bb5c"], ["#40a04a", "#68c568"]][Math.floor(v * 3)];
          dot(x, y, r, c[0]);
          dot(x - r * 0.2, y - r * 0.25, r * 0.7, c[1]);
          dot(x - r * 0.4, y - r * 0.45, r * 0.28, "rgba(230,255,200,.5)");
        } else if (k === "pine") {
          dot(x, y, r * 0.9, "#1d6338");
          dot(x, y, r * 0.66, "#2a7d45");
          dot(x, y, r * 0.42, "#3b9a58");
          dot(x - r * 0.05, y - r * 0.08, r * 0.16, "#8ad69a");
        } else if (k === "palm") {
          g.save();
          g.translate(x, y);
          for (let i = 0; i < 8; i++) {
            g.rotate(TAU / 8);
            g.fillStyle = i % 2 ? "#3d9a3f" : "#4fb04a";
            g.beginPath();
            g.ellipse(r * 0.55, 0, r * 0.62, r * 0.17, 0, 0, TAU);
            g.fill();
          }
          g.restore();
          dot(x, y, r * 0.2, "#7a5a2b");
        } else if (k === "cherry") {
          dot(x, y, r, "#e07aa3");
          dot(x - r * 0.35, y - r * 0.15, r * 0.55, "#f2a0c0");
          dot(x + r * 0.3, y + r * 0.2, r * 0.5, "#f4a8c4");
          dot(x - r * 0.15, y - r * 0.4, r * 0.3, "#fde0ea");
        } else if (k === "bush") {
          dot(x, y, r, "#3f9a45");
          dot(x - r * 0.25, y - r * 0.3, r * 0.6, "#78c477");
        } else {
          dot(x, y, r, "#86b44a");
          dot(x - r * 0.15, y - r * 0.2, r * 0.7, "#b2d664");
          dot(x - r * 0.35, y - r * 0.4, r * 0.3, "#dcef9a");
        }
      }
    }
    function bake(g) {
      let cur = "";
      const fillWith = (c) => {
        if (c !== cur) g.fillStyle = cur = c;
      };
      const rrect = (x, y, w, d, r) => {
        g.beginPath();
        if (g.roundRect) g.roundRect(x, y, w, d, r);
        else g.rect(x, y, w, d);
      };
      const lines = (xs, ys, f, col, lw) => {
        g.strokeStyle = col;
        g.lineWidth = lw;
        g.beginPath();
        for (let x = f.x + xs[0]; x < f.x + f.w - 0.5; x += xs[1]) {
          g.moveTo(x, f.y);
          g.lineTo(x, f.y + f.d);
        }
        for (let y = f.y + ys[0]; y < f.y + f.d - 0.5; y += ys[1]) {
          g.moveTo(f.x, y);
          g.lineTo(f.x + f.w, y);
        }
        g.stroke();
      };

      ground.flats.forEach((f) => {
        const k = f.cls;
        if (k === "grass") {
          fillWith("#62ad66");
          rrect(f.x, f.y, f.w, f.d, 1.6);
          g.fill();
          fillWith("rgba(40,120,60,.26)");
          for (let x = f.x + 1.2; x < f.x + f.w - 1; x += 3.4)
            g.fillRect(x, f.y + 0.5, 1.5, f.d - 1);
        } else if (k === "plaza") {
          fillWith("#dcdad1");
          g.fillRect(f.x, f.y, f.w, f.d);
          lines([3, 4], [3, 4], f, "rgba(110,115,130,.28)", 0.3);
        } else if (k === "water") {
          cur = "";
          const rr = Math.min(f.w, f.d) * 0.45;
          const wg = g.createLinearGradient(
            f.x,
            f.y,
            f.x + f.w * 0.4,
            f.y + f.d,
          );
          wg.addColorStop(0, "#5a9bf0");
          wg.addColorStop(1, "#2f63d0");
          g.fillStyle = wg;
          rrect(f.x, f.y, f.w, f.d, rr);
          g.fill();
          g.strokeStyle = "rgba(225,232,245,.6)";
          g.lineWidth = 0.5;
          g.stroke();
          fillWith("rgba(220,235,255,.35)");
          rrect(
            f.x + f.w * 0.14,
            f.y + f.d * 0.22,
            f.w * 0.42,
            Math.max(0.8, f.d * 0.1),
            1,
          );
          g.fill();
        } else if (k === "tarmac") {
          fillWith("#d9d7ce");
          g.fillRect(f.x, f.y, f.w, f.d);
        } else if (k === "park") {
          fillWith("#4d5361");
          rrect(f.x, f.y, f.w, f.d, 2);
          g.fill();
          g.strokeStyle = "rgba(255,255,255,.7)";
          g.lineWidth = 0.35;
          g.beginPath();
          for (let x = f.x + 2; x < f.x + f.w - 1; x += 2.6) {
            g.moveTo(x, f.y + 1.5);
            g.lineTo(x, f.y + f.d * 0.4);
            g.moveTo(x, f.y + f.d * 0.6);
            g.lineTo(x, f.y + f.d - 1.5);
          }
          g.stroke();
        } else if (k === "solar") {
          cur = "";
          const sg = g.createLinearGradient(f.x, f.y, f.x + f.w, f.y + f.d);
          sg.addColorStop(0, "#2a4a94");
          sg.addColorStop(1, "#1a3068");
          g.fillStyle = sg;
          rrect(f.x, f.y, f.w, f.d, 1.5);
          g.fill();
          lines([2, 3.2], [2, 4], f, "rgba(170,205,255,.6)", 0.3);
        } else if (k === "road") {
          fillWith("#4d5361");
          g.fillRect(f.x, f.y, f.w, f.d);
          g.strokeStyle = "rgba(255,255,255,.7)";
          g.lineWidth = 0.4;
          g.setLineDash([2, 2]);
          g.beginPath();
          g.moveTo(f.x, f.y + f.d / 2);
          g.lineTo(f.x + f.w, f.y + f.d / 2);
          g.stroke();
          g.setLineDash([]);
        } else if (k === "field") {
          cur = "";
          g.fillStyle = "#1f6a3f";
          rrect(f.x, f.y, f.w, f.d, 2);
          g.fill();
          g.fillStyle = "#1a5c37";
          for (let x = f.x; x < f.x + f.w; x += 8) g.fillRect(x, f.y, 4, f.d);
          g.strokeStyle = "rgba(255,255,255,.8)";
          g.lineWidth = 0.45;
          g.strokeRect(f.x + 0.8, f.y + 0.8, f.w - 1.6, f.d - 1.6);
          g.beginPath();
          g.moveTo(f.x + f.w / 2, f.y);
          g.lineTo(f.x + f.w / 2, f.y + f.d);
          g.stroke();
          g.beginPath();
          g.arc(
            f.x + f.w / 2,
            f.y + f.d / 2,
            Math.min(f.w, f.d) * 0.16,
            0,
            Math.PI * 2,
          );
          g.stroke();
        }
      });

      fillWith("rgba(60,55,80,.2)");
      const shadow = (m) => {
        if (m.z > 0 || m.h < 4) return;
        const o = Math.min(m.h * 0.22, 9);
        g.fillRect(m.x + o, m.y + o, m.w, m.d);
        g.fillRect(m.x + o * 0.5, m.y + o * 0.5, m.w, m.d); // lớp phụ: bóng đậm dần về phía chân tòa
      };
      for (const m of minors) shadow(m);
      for (const m of majors) shadow(m);

      for (const m of minors) {
        fillWith(roofCol(m));
        g.fillRect(m.x, m.y, m.w, m.d);
        const c = " " + m.cls + " ";
        if (/ tl | sl /.test(c)) {
          const hz = m.w >= m.d;
          fillWith("rgba(255,255,255,.14)");
          if (hz) g.fillRect(m.x, m.y, m.w, m.d / 2);
          else g.fillRect(m.x, m.y, m.w / 2, m.d);
          fillWith("rgba(0,0,0,.12)");
          if (hz) g.fillRect(m.x, m.y + m.d / 2, m.w, m.d / 2);
          else g.fillRect(m.x + m.w / 2, m.y, m.w / 2, m.d);
          fillWith("rgba(255,255,255,.3)");
          if (hz) g.fillRect(m.x, m.y + m.d / 2 - 0.3, m.w, 0.6);
          else g.fillRect(m.x + m.w / 2 - 0.3, m.y, 0.6, m.d);
        } else if (/ gr /.test(c)) {
          fillWith("rgba(255,255,255,.2)");
          g.fillRect(m.x, m.y + m.d / 2 - 0.3, m.w, 0.6);
        } else if (/ wh /.test(c)) {
          fillWith("rgba(0,0,0,.14)");
          for (let x = m.x + 1.6; x < m.x + m.w; x += 2.4)
            g.fillRect(x, m.y, 0.5, m.d);
        } else if (/ fg | gl2 | gl3 | cp /.test(c) && m.w > 6 && m.d > 5) {
          fillWith("rgba(40,55,90,.22)");
          g.fillRect(m.x + m.w * 0.16, m.y + m.d * 0.2, m.w * 0.3, m.d * 0.3);
          g.fillRect(
            m.x + m.w * 0.58,
            m.y + m.d * 0.55,
            m.w * 0.24,
            m.d * 0.24,
          );
        }
        if (m.h > 5 && m.z === 0) {
          fillWith("rgba(255,255,255,.16)");
          g.fillRect(m.x, m.y, m.w, 0.7);
          g.fillRect(m.x, m.y, 0.7, m.d);
        }
      }

      g.strokeStyle = "rgba(70,55,50,.32)";
      g.lineWidth = 0.22;
      g.beginPath();
      for (const m of minors) if (m.z === 0) g.rect(m.x, m.y, m.w, m.d);
      g.stroke();

      if (ground.trees.length) paintTrees(g, ground.trees);
    }

    /* ----- VẼ SẴN nền 4 điểm mốc: bệ lát (cùng màu nền), sân, cây ----- */
    function bakeSites(g) {
      const rrect = (x, y, w, d, r) => {
        g.beginPath();
        if (g.roundRect) g.roundRect(x, y, w, d, r);
        else g.rect(x, y, w, d);
      };
      site.flats.forEach((f) => {
        const k = f.cls;
        if (k === "pave") {
          g.fillStyle = GROUND;
          g.fillRect(f.x, f.y, f.w, f.d);
        } else if (k === "court" || k === "courtp") {
          const pk = k === "courtp";
          g.fillStyle = pk ? "#e68a82" : "#c4584a";
          rrect(f.x, f.y, f.w, f.d, 1.2);
          g.fill();
          g.fillStyle = pk ? "#86d49a" : "#2f9a8a";
          g.fillRect(f.x + 1.6, f.y + 1.6, f.w - 3.2, f.d - 3.2);
          g.strokeStyle = "rgba(255,255,255,.9)";
          g.lineWidth = 0.35;
          g.strokeRect(f.x + 2.6, f.y + 2.6, f.w - 5.2, f.d - 5.2);
          g.beginPath();
          g.moveTo(f.x + f.w / 2, f.y + 2.6);
          g.lineTo(f.x + f.w / 2, f.y + f.d - 2.6);
          g.stroke();
        } else if (k === "lawn") {
          g.fillStyle = "#62ad66";
          rrect(f.x, f.y, f.w, f.d, 2);
          g.fill();
          g.fillStyle = "rgba(40,120,60,.28)";
          for (let x = f.x + 2; x < f.x + f.w - 2; x += 5)
            g.fillRect(x, f.y + 0.6, 2.4, f.d - 1.2);
        } else if (k === "canopy") {
          g.fillStyle = "rgba(0,0,0,.28)";
          rrect(f.x + 0.8, f.y + 1.2, f.w, f.d, f.d * 0.5);
          g.fill();
          g.fillStyle = "#f3f5f8";
          rrect(f.x, f.y, f.w, f.d, f.d * 0.5);
          g.fill();
          g.fillStyle = "rgba(120,185,205,.75)";
          rrect(f.x + f.w * 0.52, f.y + 1.2, f.w * 0.4, f.d - 2.4, 1.2);
          g.fill();
        }
      });

      g.fillStyle = "rgba(60,55,80,.2)";
      for (const m of lmBoxes) {
        if (m.z > 0 || m.h < 4) continue;
        const o = Math.min(m.h * 0.22, 9);
        g.fillRect(m.x + o, m.y + o, m.w, m.d);
        g.fillRect(m.x + o * 0.5, m.y + o * 0.5, m.w, m.d);
      }

      if (site.trees.length) paintTrees(g, site.trees);
    }

    /* ----- CẦU 3D -----
       Bề rộng cầu = u.w + 1.0 (bằng lề sáng của đường trên bờ) => hai đầu cầu khớp khít với đường.
       Tầng (lv): mố / trụ / dốc nằm trên đất (lv 0); mặt cầu nằm trên mố (lv 1); lan can nằm trên mặt cầu (lv 2). */
    let bridgesGiven = false;
    function bridges3d() {
      if (bridgesGiven) return []; // chỉ trả khối cầu một lần duy nhất
      bridgesGiven = true;
      const N = net(),
        out = [];

      /* một khối chữ nhật dọc theo đường u, từ t = ta tới tb, lệch ngang off, nửa rộng hw */
      const add = (u, ta, tb, off, hw, h, z, cls, lv) => {
        ta = Math.max(0, ta);
        tb = Math.min(u.len, tb);
        if (tb - ta < 0.2) return;
        const [xa, ya] = pt(u, ta),
          [xb, yb] = pt(u, tb);
        out.push(
          u.h
            ? { k: "b", x: xa, y: ya + off - hw, w: xb - xa, d: 2 * hw, h, z, cls, lv, gid: "BR" }
            : { k: "b", x: xa + off - hw, y: ya, w: 2 * hw, d: yb - ya, h, z, cls, lv, gid: "BR" },
        );
      };

      const DECK_Z = 1.0,
        DECK_H = 1.0; // mặt cầu nâng 1,0, dày 1,0 => mặt trên ở độ cao 2,0
      const TOP = DECK_Z + DECK_H;
      const ABUT = 1.6; // chiều dài mố cầu ở mỗi đầu
      const STEP = TOP / 3; // 2 bậc dốc: ground -> 0,67 -> 1,33 -> mặt cầu 2,0 (mỗi bậc cao đều nhau)

      for (const b of N.bridges) {
        const u = b.u,
          hw = (u.w + 1.0) / 2,
          L = b.t1 - b.t0; // bề rộng = lề sáng của đường trên bờ
        const road = `br ${u.h ? "bh" : "bv"} ${u.av ? "av" : "mn"}`;
        const ab = Math.min(ABUT, L / 3);

        add(u, b.t0, b.t1, 0, hw, DECK_H, DECK_Z, road, 1); // mặt cầu (nằm trên mố / trụ)

        /* mố cầu: lấp kín khoảng hở dưới mặt cầu ở hai đầu (trước đây nhìn xuyên được từ bên hông) */
        add(u, b.t0, b.t0 + ab, 0, hw, DECK_Z, 0, "pr", 0);
        add(u, b.t1 - ab, b.t1, 0, hw, DECK_Z, 0, "pr", 0);

        /* 2 bậc dốc mỗi đầu, cao dần tới sát mặt cầu */
        add(u, b.t0 - 0.8, b.t0, 0, hw, STEP * 2, 0, road, 0);
        add(u, b.t0 - 1.6, b.t0 - 0.8, 0, hw, STEP, 0, road, 0);
        add(u, b.t1, b.t1 + 0.8, 0, hw, STEP * 2, 0, road, 0);
        add(u, b.t1 + 0.8, b.t1 + 1.6, 0, hw, STEP, 0, road, 0);

        if (L > 12)
          // 1 trụ giữa, chỉ cầu dài mới cần
          add(u, b.t0 + L / 2 - 0.6, b.t0 + L / 2 + 0.6, 0, hw - 0.5, DECK_Z, 0, "pr", 0);

        [-1, 1].forEach((s) =>
          // lan can hai bên: nằm trên mặt cầu => tầng 2
          add(u, b.t0, b.t1, s * (hw - 0.28), 0.28, 0.6, TOP, "rl", 2),
        );
      }
      return out;
    }

    const zoneTags = () =>
      Z.filter(
        (z) =>
          z.id !== "tsn" &&
          /* bỏ nhãn khu có điểm mốc nằm trong: nhãn sẽ đè lên toà nhà, mà điểm mốc đã có nhãn riêng */
          !COMPANIES.some(
            (c) => ((c.x - z.x) / z.rx) ** 2 + ((c.y - z.y) / z.ry) ** 2 < 1,
          ),
      ).map((z) => ({
        name: z.name,
        x: z.x,
        y: z.y - z.ry * 0.55,
        z: 10,
      }));
    const siteRects = () =>
      site.flats
        .filter((f) => f.cls === "pave")
        .map((f) => [f.x, f.y, f.x + f.w, f.y + f.d]);

    /* ----- KIỂM TRA HÌNH HỌC (gọi sau khi mở app: MapCity.debug.validate()) -----
       Trả về mảng lỗi; [] là sạch.
       - floating: khối xếp chồng (z > 0) không có khối nào đỡ bên dưới (đỉnh khối dưới != đáy khối trên)
       - overhang: khối xếp chồng nhô ra ngoài mép khối đỡ nó
       - overlap : hai toà khác nhau chồng lên nhau trên mặt đất quá 0,15 px
       Bỏ qua: mặt cầu (đỡ bằng mố + trụ, không phải một khối) và mái hiên gắn tường (att). */
    function validate() {
      const all = majors.concat(minors, lmSpecs).filter((o) => o.k === "b");
      const E = 0.02,
        top = (o) => o.z + o.h,
        issues = [];
      const over = (a, b) =>
        a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.d && a.y + a.d > b.y;

      all.forEach((o) => {
        if (!(o.z > 0) || o.att || / br /.test(" " + o.cls + " ")) return;
        const sup = all.filter(
          (b) => b !== o && Math.abs(top(b) - o.z) < 0.02 && over(o, b),
        );
        if (!sup.length) return issues.push({ t: "floating", o });
        const inside = (b) =>
          o.x >= b.x - E &&
          o.y >= b.y - E &&
          o.x + o.w <= b.x + b.w + E &&
          o.y + o.d <= b.y + b.d + E;
        if (!sup.some(inside)) issues.push({ t: "overhang", o });
      });

      const grid = new Map();
      all
        .filter((o) => !(o.z > 0))
        .forEach((o) => {
          for (let i = Math.floor(o.x / 16); i <= Math.floor((o.x + o.w) / 16); i++)
            for (let j = Math.floor(o.y / 16); j <= Math.floor((o.y + o.d) / 16); j++) {
              const k = i * 4096 + j,
                a = grid.get(k) || grid.set(k, []).get(k);
              for (const b of a)
                if (
                  b.gid !== o.gid &&
                  over(o, b) &&
                  Math.min(o.x + o.w, b.x + b.w) - Math.max(o.x, b.x) > 0.15 &&
                  Math.min(o.y + o.d, b.y + b.d) - Math.max(o.y, b.y) > 0.15
                )
                  issues.push({ t: "overlap", o, b });
              a.push(o);
            }
        });
      return issues;
    }

    return {
      fillCity,
      landmark,
      drawGround,
      roadsBase,
      roadsTop,
      bake,
      bakeSites,
      zoneTags,
      zebra,
      siteRects,
      placeSites,
      bridges3d,
      validate,
      stats: () => ({
        majors: majors.length,
        minors: minors.length,
        flats: ground.flats.length,
        trees: ground.trees.length,
        sig: Object.keys(sigPos),
        lm: [...lmRect],
      }),
    };
  }

  window.MapCity = { create, ZONES, BASE, MODELS, SIG, AVENUES, PADS };
})();