let topZ = 50;

function openWindow(key){
  const win = document.getElementById('window-' + key);
  if(!win) return;
  win.classList.add('open');
  bringToFront(win);
}

function bringToFront(win){
  document.querySelectorAll('.window').forEach(w => w.classList.remove('active'));
  topZ += 1;
  win.style.zIndex = topZ;
  win.classList.add('active');
}

function closeWindow(win){
  win.classList.remove('open');
}

document.querySelectorAll('.desk-icon[data-open], .menu-item[data-open]').forEach(el => {
  el.addEventListener('dblclick', () => openWindow(el.dataset.open));
  el.addEventListener('click', () => openWindow(el.dataset.open));
});

document.querySelectorAll('.window').forEach(win => {
  const bar = win.querySelector('.window-bar');
  bar.addEventListener('dblclick', e => {
    if(e.target === bar) closeWindow(win);
  });

  win.addEventListener('mousedown', () => bringToFront(win));

  let dragging = false, offX = 0, offY = 0;

  const startDrag = (x, y) => {
    dragging = true;
    const r = win.getBoundingClientRect();
    offX = x - r.left;
    offY = y - r.top;
    bringToFront(win);
  };
  const moveDrag = (x, y) => {
    if(!dragging) return;
    let nx = x - offX;
    let ny = y - offY;
    nx = Math.max(0, Math.min(window.innerWidth - win.offsetWidth, nx));
    ny = Math.max(34, Math.min(window.innerHeight - 80, ny));
    win.style.left = nx + 'px';
    win.style.right = 'auto';
    win.style.top = ny + 'px';
  };

  bar.addEventListener('mousedown', e => startDrag(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => moveDrag(e.clientX, e.clientY));
  window.addEventListener('mouseup', () => dragging = false);

  bar.addEventListener('touchstart', e => {
    const t = e.touches[0];
    startDrag(t.clientX, t.clientY);
  }, { passive:true });
  window.addEventListener('touchmove', e => {
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, { passive:true });
  window.addEventListener('touchend', () => dragging = false);

  win.querySelector('.win-dot.red').style.cursor = 'pointer';
  win.querySelector('.win-dot.red').addEventListener('click', () => closeWindow(win));
});