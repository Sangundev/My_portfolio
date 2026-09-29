function tickClock(){
  const el = document.getElementById('clock');
  if(!el) return;
  const d = new Date();
  const day = d.toLocaleDateString('en-US', { weekday:'long' });
  const date = d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
  el.textContent = `${day}, ${date}   ${time}`;
}
tickClock();
setInterval(tickClock, 1000 * 10);