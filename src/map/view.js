// 톱니 지도 그리기 · 돌리기 — 칸 톱니를 놋쇠 축으로 잇고, 칸을 끝낼 때마다 모든 톱니가 함께 돈다
// 고를 수 있는 길은 축을 따라 빛이 흐르고, 칸 이름은 나무판에 적는다
import { gearD } from '../ui/gearpath.js';
import { NODE_TYPES } from '../data/nodes.js';
import { RM } from '../core/util.js';
import { art } from '../ui/assets.js';

const DEG = 180 / Math.PI;
const f1 = v => Math.round(v * 10) / 10;
const teethOf = r => Math.max(8, Math.round(r / 4.2));   // 크고 뭉툭한 이 — 작은 톱니 9개, 보스 19개

// 보스 톱니 가운데의 시계판 (로마 숫자 · 눈금)
function bossDial(n, hour) {
  const R = n.r * 0.56;
  let s = `<circle class="dial" r="${f1(R)}"/>`;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r1 = R * 0.86, r2 = i % 3 === 0 ? R * 0.7 : R * 0.78;
    s += `<line class="dtick" x1="${f1(Math.cos(a) * r1)}" y1="${f1(Math.sin(a) * r1)}" x2="${f1(Math.cos(a) * r2)}" y2="${f1(Math.sin(a) * r2)}"/>`;
  }
  s += `<text class="dnum" y="${f1(-R * 0.36)}">${hour}</text>`;
  return s;
}

// 톱니에 박힌 볼트 — 도는 게 눈에 보이게
function bolts(n) {
  const k = n.type === 'boss' ? 8 : 5, R = n.r * 0.64;
  let s = '';
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 - Math.PI / 2;
    s += `<circle class="bolt" cx="${f1(Math.cos(a) * R)}" cy="${f1(Math.sin(a) * R)}" r="${n.type === 'boss' ? 3.4 : 2.6}"/>`;
  }
  return s;
}

// 나무판 이름표 — 글자 폭에 맞춰 판 길이를 정한다
const textW = s => [...s].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 15.5 : ch === ' ' ? 5 : 9), 0);
function tag(n, label) {
  const w = Math.round(textW(label) + 40), h = 32, y = n.r + 24;
  const plank = art('ui-plank-thin');
  const board = plank ? `<image href="${plank}" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" preserveAspectRatio="none"/>`
    : `<rect class="tag-bg" x="${-w / 2}" y="${-h / 2}" width="${w}" height="${h}" rx="4"/>`;
  return `<g class="tag" transform="translate(0 ${y})">${board}<text class="lbl" y="1">${label}</text></g>`;
}

export function buildMapSVG(map, { hour = 'I' } = {}) {
  const nodes = Object.values(map.nodes);
  let links = '', nds = '';
  for (const [A, B] of map.edges) {
    const a = map.nodes[A], b = map.nodes[B];
    const d = Math.hypot(b.x - a.x, b.y - a.y), ux = (b.x - a.x) / d, uy = (b.y - a.y) / d;
    const x1 = f1(a.x + ux * (a.r + 3)), y1 = f1(a.y + uy * (a.r + 3)), x2 = f1(b.x - ux * (b.r + 3)), y2 = f1(b.y - uy * (b.r + 3));
    const seg = `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`;
    links += `<g class="lk" data-from="${A}" data-to="${B}"><line class="lk-bed" ${seg}/><line class="lk-rod" ${seg}/><line class="lk-flow" ${seg}/></g>`;
  }
  for (const n of nodes) {
    const T = NODE_TYPES[n.type] || NODE_TYPES.battle;
    const big = n.type === 'boss';
    nds += `<g class="gn t-${n.type}${n.watched ? ' watched' : ''}" data-id="${n.id}" transform="translate(${n.x} ${n.y})" style="--tone:${T.tone}">
      <circle class="halo" r="${n.r + 16}"/>
      <circle class="shade" r="${n.r + 3}" cy="6"/>
      <g class="rot"><path class="body" d="${gearD(n.r, teethOf(n.r), n.r * 0.22)}"/><circle class="groove" r="${f1(n.r * 0.8)}"/>${bolts(n)}</g>
      <circle class="plate" r="${f1(n.r * (big ? 0.62 : 0.5))}"/>
      ${big ? bossDial(n, hour) : ''}
      <use class="ico" href="#i-${T.icon}" x="${big ? -22 : -13}" y="${big ? -4 : -13}" width="${big ? 44 : 26}" height="${big ? 44 : 26}"/>
      ${n.watched ? `<g class="watch" transform="translate(${f1(n.r * 0.74)} ${f1(-n.r * 0.74)})"><circle r="11"/><use href="#i-eye" x="-8" y="-8" width="16" height="16"/></g>` : ''}
      ${tag(n, T.label)}
    </g>`;
  }
  return `<svg class="mech" viewBox="0 0 1920 1080" aria-label="톱니 지도">
    <defs>
      <linearGradient id="gBrass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#E7C27A"/><stop offset=".55" stop-color="#B58A45"/><stop offset="1" stop-color="#7A5A28"/></linearGradient>
      <linearGradient id="gIron" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9C8F86"/><stop offset=".6" stop-color="#5C5250"/><stop offset="1" stop-color="#342E2E"/></linearGradient>
      <linearGradient id="gBlood" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#D0705F"/><stop offset=".55" stop-color="#8A2A24"/><stop offset="1" stop-color="#4A1214"/></linearGradient>
      <linearGradient id="gDark" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6A5E52"/><stop offset="1" stop-color="#352E28"/></linearGradient>
      <filter id="fGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <g class="links">${links}</g>
    <g class="nodes">${nds}</g>
  </svg>`;
}

// 돌리기 — 모든 톱니의 각도 = phase + spin × arc / r (층마다 도는 방향이 번갈아)
export function makeTurner(svg, map) {
  const items = [];
  for (const el of svg.querySelectorAll('.gn')) {
    const n = map.nodes[el.dataset.id];
    items.push({ el: el.querySelector('.rot'), phase: n.phase, k: n.spin * DEG / n.r });
  }
  let arc = map.arc || 0, raf = 0;
  const apply = a => { for (const it of items) it.el.setAttribute('transform', `rotate(${(it.phase + it.k * a).toFixed(2)})`); };
  apply(arc);
  return {
    get arc() { return arc; },
    set(a) { arc = a; apply(arc); map.arc = arc; },
    // by만큼 부드럽게 돌린다 — 도는 동안 지나온 축에도 빛이 흐른다
    turn(by, ms = 1200, ease = t => 1 - Math.pow(1 - t, 3)) {
      cancelAnimationFrame(raf);
      const from = arc, to = arc + by;
      if (RM.matches) ms = Math.min(ms, 200);
      svg.classList.add('turning');
      return new Promise(res => {
        const t0 = performance.now();
        const step = now => {
          const t = Math.min(1, (now - t0) / ms);
          arc = from + (to - from) * ease(t);
          apply(arc);
          if (t < 1) raf = requestAnimationFrame(step);
          else { map.arc = arc; svg.classList.remove('turning'); res(); }
        };
        raf = requestAnimationFrame(step);
      });
    },
    stop() { cancelAnimationFrame(raf); map.arc = arc; svg.classList.remove('turning'); },
  };
}

// 표식이 축을 따라 건너가는 발걸음 (지름길이면 두 칸 앞까지 곧장)
export function linkPoints(map, from, to, hops = 3) {
  const a = map.nodes[from], b = map.nodes[to];
  const pts = [];
  for (let i = 0; i <= hops; i++) {
    const t = i / hops;
    pts.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, r: i === 0 ? a.r : i === hops ? b.r : 12 });
  }
  return pts;
}
