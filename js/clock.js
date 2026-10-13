(() => {
  const el = document.getElementById('clock');
  if (!el) return;

  // desktop: "Tue Oct 13 9:41 PM"; điện thoại: "9:41" như iPhone
  const full = new Intl.DateTimeFormat('en-US', {
    weekday: 'short', month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit'
  });
  const hm = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });
  const phone = window.matchMedia('(max-width:768px)');

  let last = '';
  const tick = () => {
    const d = new Date();
    const s = phone.matches
      ? hm.format(d).replace(/\s?[AP]M/i, '')
      : full.format(d).replace(/,/g, '');
    if (s !== last) { el.textContent = s; last = s; }
  };

  phone.addEventListener('change', () => { last = ''; tick(); });
  tick();
  setInterval(tick, 1000);
})();