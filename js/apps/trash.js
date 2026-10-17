/* =========================================================
   js/apps/trash.js: app Trash (cửa sổ riêng, kiểu macOS)
   - Tự đăng ký vào window.WMApps.trash, window-manager.js sẽ gọi build()
   - Mở bằng data-open="trash" (icon Trash ngoài desktop, icon Trash ở dock, mục Trash ở sidebar Finder)
   - Bấm = chọn, bấm đúp = hiện thông báo (điện thoại / tablet: chạm = hiện thông báo)
   - CSS đi kèm: css/apps/trash.css
   - Muốn đổi nội dung: sửa SUB và ITEMS bên dưới
========================================================= */
(() => {
  /* ---------- DỮ LIỆU (sửa ở đây) ---------- */
  const SUB = "I said, don't look!";           // dòng phụ dưới chữ "Trash" + nội dung thông báo khi mở file

  const svgUri = s => 'data:image/svg+xml,' + encodeURIComponent(s);

  // Icon file .txt vẽ bằng SVG nên không cần file ảnh
  const TXT_ICON = svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<path d="M14 4h26l12 12v44H14z" fill="#fff" stroke="#d0d0d4" stroke-width="2"/>' +
    '<path d="M40 4v12h12" fill="#ececef" stroke="#d0d0d4" stroke-width="2" stroke-linejoin="round"/></svg>'
  );

  // Ảnh dự phòng cho breakdown.img khi chưa có file assets/trash/breakdown.png
  const PIC_FALLBACK = svgUri(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">' +
    '<rect width="64" height="64" fill="#d3262f"/>' +
    '<ellipse cx="32" cy="40" rx="12" ry="15" fill="#2a0a0c"/>' +
    '<circle cx="23" cy="24" r="3" fill="#fff"/><circle cx="41" cy="24" r="3" fill="#fff"/></svg>'
  );

  // icon: đường dẫn ảnh | photo: true = khung ảnh có viền trắng (như ảnh chụp)
  const ITEMS = [
    { name: 'World Domination Plan.txt', icon: TXT_ICON },
    { name: 'breakdown.img',             icon: 'assets/trash/breakdown.png', photo: true },
    { name: 'sorry_no thanks.pdf',       icon: 'assets/folders/pdf.png' },
    { name: 'portfolio_2024.com',        icon: 'assets/dock/Safari.png' }
  ];

  /* ---------- HÀM PHỤ ---------- */
  const h = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };

  /* ---------- BUILD ---------- */
  function build(body, _title, api) {
    const { isMobile } = api;
    body.classList.add('flush', 'tr-body');

    const root = h('div', 'tr');

    // Tiêu đề + dòng phụ (vùng .win-drag: kéo được cả cửa sổ)
    const head = h('header', 'tr-head win-drag');
    head.append(h('h3', 'tr-title', 'Trash'), h('p', 'tr-sub', SUB));

    const grid = h('div', 'tr-grid');

    // Thông báo nhỏ phía dưới
    const toast = h('div', 'tr-toast');
    toast.hidden = true;
    let tt;
    const say = m => {
      toast.textContent = m;
      toast.hidden = false;
      clearTimeout(tt);
      tt = setTimeout(() => { toast.hidden = true; }, 1600);
    };

    const items = [];
    const select = el => items.forEach(n => n.classList.toggle('sel', n === el));

    ITEMS.forEach(it => {
      const el = h('div', 'tr-item' + (it.photo ? ' photo' : ''));
      el.setAttribute('role', 'button');
      el.tabIndex = 0;
      el.setAttribute('aria-label', it.name);

      const im = new Image();
      im.src = it.icon;
      im.alt = '';
      im.draggable = false;
      if (it.photo) im.onerror = () => { im.onerror = null; im.src = PIC_FALLBACK; };

      el.append(im, h('span', 'tr-name', it.name));

      el.addEventListener('click', e => {
        e.stopPropagation();
        select(el);
        // cảm ứng / phím Enter: hiện thông báo luôn; chuột: bấm = chọn, bấm đúp = thông báo
        if (isMobile() || e.detail === 0) say(SUB);
      });
      el.addEventListener('dblclick', e => {
        e.stopPropagation();
        select(el);
        say(SUB);
      });

      items.push(el);
      grid.append(el);
    });

    grid.addEventListener('click', () => select(null));

    root.append(head, grid, toast);
    body.append(root);
  }

  /* ---------- ĐĂNG KÝ APP ---------- */
  (window.WMApps = window.WMApps || {}).trash = {
    title: 'Trash',
    w: 720,
    h: 420,
    cls: 'is-trash',         // class thêm vào cửa sổ (trash.css dùng để ẩn thanh tiêu đề trên máy tính)
    single: true,            // không hiện nút "+" mở tab mới
    build
  };
})();