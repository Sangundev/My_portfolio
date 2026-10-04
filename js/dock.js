(() => {
  const dock = document.getElementById('dock');
  if (!dock) return;
  if (dock.dataset.dockReady) return;                       // chống chạy 2 lần (sinh ra 2 nút More)
  dock.dataset.dockReady = '1';

  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const originalItems = [...dock.querySelectorAll('.dock-icon, .dock-sep')];

  /* ---------- Nhãn: data-label > title > alt (không ghi đè nhãn đã có) ---------- */
  originalItems.forEach(it => {
    if (!it.classList.contains('dock-icon')) return;
    const label = it.dataset.label || it.getAttribute('title') || it.querySelector('img')?.alt || '';
    it.dataset.label = label;
    it.setAttribute('aria-label', label);
    it.removeAttribute('title');
  });

  const tip = document.createElement('div');
  tip.className = 'dock-tip';
  tip.setAttribute('aria-hidden', 'true');
  document.body.append(tip);

  /* ---------- Nảy khi bấm (chỉ khi app chưa mở) ---------- */
  dock.addEventListener('click', e => {
    const ic = e.target.closest('.dock-icon');
    if (!ic || reduce.matches || ic.classList.contains('running')) return;
    ic.classList.remove('bounce');
    void ic.offsetWidth;
    ic.classList.add('bounce');
    ic.addEventListener('animationend', () => ic.classList.remove('bounce'), { once: true });
  });

  /* =====================================================
     PHÓNG TO KIỂU macOS
     - base[i]: tâm icon theo bố cục gốc (không đổi khi phóng to)
     - Icon phóng to bằng transform; dock nới rộng bằng --ex
     ===================================================== */
  let items = [], isIcon = [], base = [], cur = [], tgt = [];
  let sz = 76, raf = 0, over = false, hov = -1;

  const enabled = () => fine.matches && innerWidth > 768 && !reduce.matches;

  function measure() {
    items = [...dock.querySelectorAll(':scope > .dock-icon, :scope > .dock-sep')];
    isIcon = items.map(n => n.classList.contains('dock-icon'));
    sz = items.find((n, i) => isIcon[i])?.offsetWidth || 76;
    const left = dock.getBoundingClientRect().left + dock.clientLeft;
    base = items.map(n => left + n.offsetLeft + n.offsetWidth / 2);
    cur = items.map(() => 1);
    tgt = items.map(() => 1);
  }

  function clear() {
    items.forEach(n => (n.style.transform = ''));
    dock.style.removeProperty('--ex');
    tip.classList.remove('on');
  }

  function frame() {
    let moving = false;
    cur = cur.map((c, i) => {
      const d = tgt[i] - c;
      if (Math.abs(d) < 0.002) return tgt[i];
      moving = true;
      return c + d * 0.26;
    });

    const extra = items.map((_, i) => (isIcon[i] ? sz * (cur[i] - 1) : 0));
    const total = extra.reduce((a, b) => a + b, 0);
    let run = 0;
    items.forEach((n, i) => {
      const tx = run + extra[i] / 2 - total / 2;
      run += extra[i];
      n.style.transform = isIcon[i]
        ? `translateX(${tx.toFixed(2)}px) scale(${cur[i].toFixed(3)})`
        : `translateX(${tx.toFixed(2)}px)`;
    });
    dock.style.setProperty('--ex', total / 2 + 'px');

    if (hov >= 0 && items[hov]) {                           // nhãn bám theo icon
      const r = items[hov].getBoundingClientRect();
      tip.style.left = r.left + r.width / 2 + 'px';
      tip.style.top = r.top - 8 + 'px';
    }

    raf = moving ? requestAnimationFrame(frame) : 0;
    if (!moving && !over) clear();
  }
  const start = () => { if (!raf) raf = requestAnimationFrame(frame); };

  dock.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch') return;
    if (!over) { over = true; measure(); }

    const mag = enabled();                                  // phóng to có điều kiện; nhãn thì luôn hiện
    const MAX = innerWidth > 1024 ? 1.6 : 1.35;
    const R = sz * 2.5;                                     // bán kính ảnh hưởng
    let best = -1, bd = Infinity;
    items.forEach((_, i) => {
      if (!isIcon[i]) { tgt[i] = 1; return; }
      const d = Math.abs(e.clientX - base[i]);
      tgt[i] = mag && d < R ? 1 + (MAX - 1) * (Math.cos(Math.PI * d / R) + 1) / 2 : 1;
      if (d < bd) { bd = d; best = i; }
    });

    hov = bd < sz * 0.75 ? best : -1;
    if (hov >= 0) {
      const text = items[hov].dataset.label || '';
      if (tip.textContent !== text) tip.textContent = text;
    }
    tip.classList.toggle('on', hov >= 0);
    start();
  });

  dock.addEventListener('pointerleave', () => {
    over = false; hov = -1;
    tgt = tgt.map(() => 1);
    tip.classList.remove('on');
    start();
  });

  /* =====================================================
     MORE: màn hình nhỏ gom bớt icon vào popup
     ===================================================== */
  /* Số icon hiện trên dock:
     - Điện thoại (≤768px): 3 app + nút More
     - Còn lại: tự tính theo chiều rộng thật, icon nào không vừa thì cho vào More */
  const visibleCount = () => {
    const w = innerWidth;
    if (w <= 768) return 3;
    const sz = parseFloat(getComputedStyle(dock).getPropertyValue('--sz')) || 76;
    const unit = sz + 3;                                              // icon + khoảng cách
    const seps = originalItems.filter(n => n.classList.contains('dock-sep')).length;
    const total = originalItems.length - seps;
    const avail = w - 32 - (fine.matches ? sz * 1.5 : 0);             // chừa chỗ cho hiệu ứng phóng to
    if (total * unit + seps * 4 + 6 <= avail) return Infinity;
    return Math.max(3, Math.floor((avail - 6 - unit - seps * 4) / unit));
  };

  /* Dọn mọi nút More cũ TRƯỚC khi tạo nút mới (luôn chỉ còn đúng 1 nút) */
  dock.querySelectorAll('.dock-more').forEach(n => n.remove());

  const moreButton = document.createElement('div');
  moreButton.className = 'dock-more';
  moreButton.setAttribute('role', 'button');
  moreButton.tabIndex = 0;
  moreButton.setAttribute('aria-label', 'Launchpad');
  moreButton.innerHTML =
    '<img src="assets/dock/Launchpad.png" alt="" decoding="async" />';
  dock.append(moreButton);

  document.querySelectorAll('.dock-more-panel').forEach(n => n.remove());   // dọn popup cũ nếu có

  const morePanel = document.createElement('div');
  morePanel.className = 'dock-more-panel';
  document.body.append(morePanel);

  const closeMore = () => morePanel.classList.remove('open');

  function addPopupItem(item) {
    const img = item.querySelector('img');
    if (!img) return;
    const p = document.createElement('div');
    p.className = 'dock-more-item';
    p.setAttribute('role', 'button');
    p.tabIndex = 0;
    p.setAttribute('aria-label', item.dataset.label || '');
    p.append(img.cloneNode());
    p.addEventListener('click', ev => {
      ev.stopPropagation();
      closeMore();
      if (item.dataset.open && window.WM) WM.open(item.dataset.open, item);
    });
    morePanel.append(p);
  }

  function updateDock() {
    const limit = visibleCount();
    morePanel.replaceChildren();
    closeMore();
    originalItems.forEach(n => n.remove());

    /* Xoá mọi nút More khác nút của mình (nếu script khác chèn thêm) */
    dock.querySelectorAll('.dock-more').forEach(n => { if (n !== moreButton) n.remove(); });
    if (moreButton.parentNode !== dock) dock.append(moreButton);   // phòng nút bị gỡ nhầm

    const keep = [], hidden = [];
    let n = 0;
    originalItems.forEach(it => {
      if (!it.classList.contains('dock-icon')) return keep.push(it);
      (n++ < limit ? keep : hidden).push(it);
    });

    const clean = [];                                       // bỏ separator thừa
    keep.forEach(it => {
      const sep = it.classList.contains('dock-sep');
      if (sep && (!clean.length || clean.at(-1).classList.contains('dock-sep'))) return;
      clean.push(it);
    });
    while (clean.length && clean.at(-1).classList.contains('dock-sep')) clean.pop();

    clean.forEach(it => dock.insertBefore(it, moreButton));
    hidden.forEach(addPopupItem);
    moreButton.style.display = hidden.length ? 'flex' : 'none';

    clear();
    requestAnimationFrame(measure);
  }

  moreButton.addEventListener('click', e => {
    e.stopPropagation();
    morePanel.classList.toggle('open');
  });
  document.addEventListener('click', e => {
    if (!morePanel.contains(e.target) && !moreButton.contains(e.target)) closeMore();
  });

  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(updateDock, 100); });

  updateDock();
})();