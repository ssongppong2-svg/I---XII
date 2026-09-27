// 톱니 지도 그리기 · 돌리기 — SVG 한 장에 칸 톱니와 사이 톱니를 그리고, arc(맞물린 둘레를 따라 이동한 거리)로 전부 함께 돌린다
import { gearD, spokeHolesD, circleD } from '../ui/gearpath.js';
import { NODE_TYPES } from '../data/nodes.js';
import { RM } from '../core/util.js';

const DEG = 180 / Math.PI;
const f1 = v => Math.round(v * 10) / 10;

function nodeBody(n) {
  let d = gearD(n.r, n.teeth);
  if (n.r >= 40) d += spokeHolesD(n.r * 0.46, n.r * 0.72, n.type === 'boss' ? 8 : 5);
  else d += spokeHolesD(n.r * 0.5, n.r * 0.7, 4, 22);
  return d;
}
function idlerBody(g) {
  return gearD(g.r, g.teeth) + circleD(Math.max(2.2, g.r * 0.3));
}

// 보스 톱니 가운데의 시계판 (로마 숫자 · 눈금)
function bossDial(n, hour) {
  const R = n.r * 0.58;
  let s = `<circle class="dial" r="${f1(R)}"/>`;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const r1 = R * 0.86, r2 = i % 3 === 0 ? R * 0.7 : R * 0.78;
    s += `<line class="dtick" x1="${f1(Math.cos(a) * r1)}" y1="${f1(Math.sin(a) * r1)}" x2="${f1(Math.cos(a) * r2)}" y2="${f1(Math.sin(a) * r2)}"/>`;
  }
  s += `<text class="dnum" y="${f1(-R * 0.36)}">${hour}</text>`;
  return s;
}

export function buildMapSVG(map, { hour = 'I' } = {}) {
  const nodes = Object.values(map.nodes);
  let idl = '', nds = '', axles = '';
  for (const [A, B] of map.edges) {
    const a = map.nodes[A], b = map.nodes[B];
    axles += `<line class="axle" data-e="${A}>${B}" x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}"/>`;
  }
  for (const g of map.idlers) {
    idl += `<g class="idl" data-from="${g.from}" data-to="${g.to}" transform="translate(${g.x} ${g.y})"><g class="rot"><path d="${idlerBody(g)}" fill-rule="evenodd"/></g><circle class="pin" r="${f1(Math.max(1.6, g.r * 0.18))}"/></g>`;
  }
  for (const n of nodes) {
    const T = NODE_TYPES[n.type] || NODE_TYPES.battle;
    const big = n.type === 'boss';
    nds += `<g class="gn t-${n.type}${n.watched ? ' watched' : ''}" data-id="${n.id}" transform="translate(${n.x} ${n.y})" style="--tone:${T.tone}">
      <circle class="halo" r="${n.r + 14}"/>
      <g class="rot"><path class="body" d="${nodeBody(n)}" fill-rule="evenodd"/></g>
      <circle class="rim" r="${f1(n.r * (big ? 0.64 : 0.46))}"/>
      ${big ? bossDial(n, hour) : ''}
      <use class="ico" href="#i-${T.icon}" x="${big ? -22 : -13}" y="${big ? -4 : -13}" width="${big ? 44 : 26}" height="${big ? 44 : 26}"/>
      ${n.watched ? `<g class="watch" transform="translate(${f1(n.r * 0.72)} ${f1(-n.r * 0.72)})"><circle r="11"/><use href="#i-eye" x="-8" y="-8" width="16" height="16"/></g>` : ''}
      <text class="lbl" y="${n.r + 26}">${T.label}</text>
    </g>`;
  }
  return `<svg class="mech" viewBox="0 0 1920 1080" aria-label="톱니 지도">
    <defs>
      <radialGradient id="gBrass" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#F6DC9C"/><stop offset=".45" stop-color="#B98D3E"/><stop offset="1" stop-color="#5E4318"/></radialGradient>
      <radialGradient id="gIron" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#9A8C84"/><stop offset=".5" stop-color="#4E4648"/><stop offset="1" stop-color="#1E1A1E"/></radialGradient>
      <radialGradient id="gSteel" cx="35%" cy="30%" r="85%"><stop offset="0" stop-color="#C8BBA0"/><stop offset=".55" stop-color="#7A6848"/><stop offset="1" stop-color="#3A2F1E"/></radialGradient>
      <radialGradient id="gBlood" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#E88A7A"/><stop offset=".45" stop-color="#8E2A26"/><stop offset="1" stop-color="#3A0C10"/></radialGradient>
      <radialGradient id="gDark" cx="35%" cy="30%" r="80%"><stop offset="0" stop-color="#5A5046"/><stop offset=".6" stop-color="#2E2822"/><stop offset="1" stop-color="#15120F"/></radialGradient>
      <filter id="fGlow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
    </defs>
    <g class="axles">${axles}</g>
    <g class="idlers">${idl}</g>
    <g class="nodes">${nds}</g>
    <g class="marker" id="mapMarker"></g>
  </svg>`;
}

// 돌리기 — 모든 톱니의 각도 = phase + spin × arc / r
export function makeTurner(svg, map) {
  const items = [];
  for (const el of svg.querySelectorAll('.gn')) {
    const n = map.nodes[el.dataset.id];
    items.push({ el: el.querySelector('.rot'), phase: n.phase, k: n.spin * DEG / n.r });
  }
  const idEls = svg.querySelectorAll('.idl');
  map.idlers.forEach((g, i) => items.push({ el: idEls[i].querySelector('.rot'), phase: g.phase, k: g.spin * DEG / g.r }));
  let arc = map.arc || 0, raf = 0;
  const apply = a => { for (const it of items) it.el.setAttribute('transform', `rotate(${(it.phase + it.k * a).toFixed(2)})`); };
  apply(arc);
  return {
    get arc() { return arc; },
    set(a) { arc = a; apply(arc); map.arc = arc; },
    // by만큼 부드럽게 돌린다
    turn(by, ms = 1200, ease = t => 1 - Math.pow(1 - t, 3)) {
      cancelAnimationFrame(raf);
      const from = arc, to = arc + by;
      if (RM.matches) ms = Math.min(ms, 200);
      return new Promise(res => {
        const t0 = performance.now();
        const step = now => {
          const t = Math.min(1, (now - t0) / ms);
          arc = from + (to - from) * ease(t);
          apply(arc);
          if (t < 1) raf = requestAnimationFrame(step);
          else { map.arc = arc; res(); }
        };
        raf = requestAnimationFrame(step);
      });
    },
    stop() { cancelAnimationFrame(raf); map.arc = arc; },
  };
}

// 칸 사이 사슬(사이 톱니)의 중심점들 — 표식이 따라 걷는 길
export function chainPoints(map, from, to) {
  const a = map.nodes[from], b = map.nodes[to];
  const pts = map.idlers.filter(g => g.from === from && g.to === to).sort((x, y) => x.i - y.i).map(g => ({ x: g.x, y: g.y, r: g.r }));
  return [{ x: a.x, y: a.y, r: a.r }, ...pts, { x: b.x, y: b.y, r: b.r }];
}
