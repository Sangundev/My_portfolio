/* =========================================================
   js/apps/folders.js: các cửa sổ dạng thư mục (Website / Mobile / Branding / Trash)
   - Tự đăng ký vào window.WMApps, window-manager.js sẽ gọi build()
   - CSS đi kèm: css/apps/folders.css (mọi rule bắt đầu bằng .win.is-folder)
========================================================= */
(() => {
  /* ---------- DỮ LIỆU (sửa ở đây) ---------- */
  // key phải trùng data-open / desktop icon. items rỗng = hiện thông báo "trống"
  const FOLDERS = {
    website_project:  { title: 'Website_project',  items: ['Landing page', 'Dashboard', 'E-commerce', 'Blog'] },
    mobile_project:   { title: 'Mobile_project',   items: ['Food delivery', 'Banking app', 'Fitness'] },
    branding_project: { title: 'Branding_project', items: ['Logo system', 'Packaging', 'Brand guideline'] },
    trash:            { title: 'Trash', items: [], w: 520, h: 360, emptyText: 'Trash is empty' }
  };

  const make = f => (body, _title, api) => {
    body.append(
      f.items.length
        ? api.tiles(f.items.map(n => [n]))
        : api.empty(f.emptyText || 'This folder is empty')
    );
  };

  const reg = (window.WMApps = window.WMApps || {});
  Object.entries(FOLDERS).forEach(([key, f]) => {
    reg[key] = {
      title: f.title,
      w: f.w || 720,
      h: f.h || 480,
      cls: 'is-folder',      // chỉ 1 class, không để dấu cách (classList.add sẽ báo lỗi)
      build: make(f)
    };
  });
})();