const W = 280, H = 392, D = 16, S = 8;          // D, S phải khớp --D, --S trong CSS
const G_MAX = 0;                                // phải khớp --G trong CSS
const $ = id => document.getElementById(id);
const view = $('view'), book = $('book'), shadow = $('shadow');
const gR = $('gR'), gL = $('gL'), gL2 = $('gL2');
const spine = $('spine'), sface = $('sface'), ssc = $('ssc');
const shF = $('shF'), shB = $('shB'), shR = $('shR');
const coverFace = document.querySelector('.face.front.cover');
const coverDisp = coverFace.querySelector('.display');

// cả hai nửa nghiêng quanh CÙNG một trục: tâm trục giữa, ngang mặt màn hình -> hai màn hình chạm nhau, chỉ gập ở giữa
gR.style.transformOrigin  = `${-S / 2}px 50% ${D / 2}px`;
gL2.style.transformOrigin = `${-S / 2}px 50% 0px`;

/* sinh các lớp titan cho mỗi khối để có độ dày thật */
function addLayers(parent) {
  for (let z = -D / 2; z <= D / 2; z++) {
    const l = document.createElement('div');
    l.className = 'layer';
    l.style.transform = `translateZ(${z}px)`;
    parent.insertBefore(l, parent.firstChild);
  }
}
document.querySelectorAll('.panel').forEach(addLayers);
addLayers(spine);

/* nút vật lý: nhô nhẹ khỏi thân máy */
const BD = D - 4;
const PROUD = 4;
function addSideBtn(panel, y, h) {      // cạnh phải
  for (let z = -BD / 2; z <= BD / 2; z++) {
    const l = document.createElement('div');
    l.className = 'hwl';
    l.style.cssText = `left:${W - 1 + S / 2}px;top:${y}px;width:${PROUD + 1}px;height:${h}px;transform:translateZ(${z}px)`;
    panel.appendChild(l);
  }
}
function addTopBtn(panel, x, w) {       // cạnh trên
  for (let z = -BD / 2; z <= BD / 2; z++) {
    const l = document.createElement('div');
    l.className = 'hwl';
    l.style.cssText = `left:${x + S / 2}px;top:${-PROUD}px;width:${w}px;height:${PROUD + 1}px;transform:translateZ(${z}px)`;
    panel.appendChild(l);
  }
}
const baseP = $('basePanel');
addSideBtn(baseP, 108, 22);
addSideBtn(baseP, 138, 40);
addTopBtn(baseP, 127, 34);
addTopBtn(baseP, 170, 38);

let p = 0, T = 0, raf, mx = 0, my = 0;
const lerp = (a, b, k) => a + (b - a) * k;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = k => k < .5 ? 4*k*k*k : 1 - Math.pow(-2*k + 2, 3) / 2;

function fit() { return Math.min(innerWidth / (W * 2 + S + 140), innerHeight / (H + 190), 1.7); }

function render() {
  const t   = T * p;                    // độ nghiêng mỗi nửa (chữ V)
  const phi = 180 * p;                  // góc lật của bản lề trái quanh trục giữa
  const q   = 1 - p;
  const sinR = Math.sin(phi * Math.PI / 180);
  const fold = Math.sin(p * Math.PI);
  const vK = clamp(t / 40);             // 0..1 mức gập chữ V

  gR.style.transform  = `rotateY(${-t}deg)`;
  gL.style.transform  = `translateZ(${D / 2}px) rotateY(${-phi}deg)`;
  gL2.style.transform = `rotateY(${t}deg)`;

  // trục giữa: chỉ còn khi máy gần gập; vừa mở ra là thu về 0 và ẩn hẳn
  const sp = clamp(1 - p / 0.2);                 // 1 khi gập, 0 khi p ≥ 0.2
  spine.style.transform  = `translateZ(${D / 2 * q}px) scale3d(${sp},1,${1 + q})`;
  view.style.setProperty('--open', (1 - sp).toFixed(2));
//   view.style.setProperty('--open', (1 - sp).toFixed(2));   // khối đen nối chỉ hiện khi máy đã mở

  // bo góc trái của khung đen (mặt ngoài) khi gập; vừa mở ra là về 0 để hai màn hình chạm nhau vuông vức
  const rL = 7 * sp;
  coverFace.style.borderRadius = `${rL}px 44px 44px ${rL}px`;
  coverDisp.style.borderRadius = `${rL * .6}px 36px 36px ${rL * .6}px`;
  sface.style.clipPath   = `inset(-3px 0 -3px ${-3 * q}px)`;

  // ánh sáng: nhẹ, đồng đều, không tạo mảng xám lớn
  shF.style.opacity = .32 * sinR;
  shB.style.opacity = .22 * fold + .16 * vK;
  shR.style.opacity = .14 * vK;

  book.style.transform = `translateX(${-W / 2 * q}px)`;
  view.style.transform = `scale(${fit()}) rotateX(${my * -7}deg) rotateY(${mx * 10 + (t ? -t * .15 : 0)}deg)`;

  shadow.style.left  = lerp(W, 0, p) + 'px';
  shadow.style.width = lerp(W + S, W * 2 + S, p) + 'px';
}

function animate(to) {
  cancelAnimationFrame(raf);
  const from = p, dur = 1500 * Math.abs(to - from) + 1, t0 = performance.now();
  (function step(now) {
    const k = clamp((now - t0) / dur);
    p = lerp(from, to, ease(k)); render();
    if (k < 1) raf = requestAnimationFrame(step);
  })(t0);
}

$('toggle').onclick = () => {
  const open = p < .5;
  $('toggle').textContent = open ? 'Gập máy' : 'Mở máy';
  animate(open ? 1 : 0);
};
$('bend').oninput = e => {
  T = +e.target.value;
  if (T > 0 && p < 1) { $('toggle').textContent = 'Gập máy'; animate(1); } else render();
};
addEventListener('pointermove', e => { mx = e.clientX / innerWidth - .5; my = e.clientY / innerHeight - .5; render(); });
addEventListener('resize', render);
render();