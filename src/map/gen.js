// 톱니 지도 만들기 — 챕터 하나 = 톱니 장치 하나
// 1) 층마다 톱니 수 → 2) 교차 없는 연결(놋쇠 축) → 3) 칸 종류 → 4) 위치 · 크기 · 도는 방향
import { makeRng, hashSeed } from '../core/rng.js';
import { NODE_TYPES } from '../data/nodes.js';
import { EVENT_POOL } from '../data/events.js';

export const MAP_BOX = { x0: 100, x1: 1760, y0: 250, y1: 860, cy: 555 };
// 사이 층(톱니 2개)은 가운데 줄을 비우고 위아래로 — 가운데 줄은 이야기 칸과 그 이름표 자리
const SPLIT = 135;

// 두 층 사이의 교차 없는 연결: 계단처럼 한쪽씩 전진하며 모든 칸을 잇고, 몇 개를 덧붙인다
function linkLayers(m, n, R) {
  const edges = [[0, 0]];
  let i = 0, j = 0;
  while (i < m - 1 || j < n - 1) {
    if (i === m - 1) j++;
    else if (j === n - 1) i++;
    else {
      const pi = (i + 1) / Math.max(1, m - 1), pj = (j + 1) / Math.max(1, n - 1);
      if (Math.abs(pi - pj) < 0.15 && R.chance(0.55)) { i++; j++; }
      else if (pi < pj) i++; else j++;
    }
    edges.push([i, j]);
  }
  // 덧붙이기 — 교차하지 않고, 한 톱니에서 나가는/들어오는 연결이 3개를 넘지 않게
  const crosses = (a, b) => edges.some(([x, y]) => (x < a && y > b) || (x > a && y < b));
  const outDeg = a => edges.filter(e => e[0] === a).length;
  const inDeg = b => edges.filter(e => e[1] === b).length;
  for (let a = 0; a < m; a++) for (const b of [0, 1, 2, 3].map(k => k).filter(k => k < n)) {
    if (edges.some(e => e[0] === a && e[1] === b)) continue;
    const near = edges.some(e => e[0] === a && Math.abs(e[1] - b) === 1);
    if (!near || crosses(a, b) || outDeg(a) >= 3 || inDeg(b) >= 3) continue;
    if (R.chance(0.22)) edges.push([a, b]);
  }
  return edges;
}

// opt.seenEvents = { 사건 id: 본 횟수 } — 예전 판에서 덜 본 사건부터 나온다
export function genMap(ch, seed, opt = {}) {
  const R = makeRng(hashSeed(seed, 'map', ch.num));
  const L = ch.layers;
  // 1) 층마다 톱니 수 (옆 층과 너무 차이 나지 않게)
  const widths = [];
  for (let i = 0; i < L; i++) {
    if (ch.fixed[i]) { widths.push(ch.fixed[i].length); continue; }
    let w = R.int(ch.width[0], ch.width[1]);
    const prev = widths[i - 1] || w;
    if (Math.abs(w - prev) > 2) w = prev + Math.sign(w - prev) * 2;
    widths.push(w);
  }
  // 2) 톱니 · 연결
  const nodes = {}, layers = [];
  for (let i = 0; i < L; i++) {
    layers.push([]);
    for (let k = 0; k < widths[i]; k++) {
      const id = `n${i}_${k}`;
      nodes[id] = { id, layer: i, idx: k, type: null, next: [], prev: [] };
      layers[i].push(id);
    }
  }
  const edges = [];
  for (let i = 0; i < L - 1; i++) {
    for (const [a, b] of linkLayers(widths[i], widths[i + 1], R)) {
      const A = layers[i][a], B = layers[i + 1][b];
      nodes[A].next.push(B); nodes[B].prev.push(A);
      edges.push([A, B]);
    }
  }
  // 3) 칸 종류
  assignTypes(ch, nodes, layers, R);
  // 감시 톱니 (3시 전) — 이야기 칸 · 보스는 빼고
  if (!ch.hunted) {
    for (const id of Object.keys(nodes)) {
      const n = nodes[id];
      if (n.layer >= 3 && n.layer < L - 2 && !['boss', 'elite', 'midboss', 'story'].includes(n.type) && R.chance(ch.watched)) n.watched = true;
    }
  }
  // 칸마다 내용 씨앗 · 전투 구성 · 사건
  const events = eventBag(makeRng(hashSeed(seed, 'events', ch.num)), EVENT_POOL[ch.num] || EVENT_POOL[1], opt.seenEvents || {});
  for (const id of Object.keys(nodes)) fillContent(ch, nodes[id], R, seed, events);
  // 4) 위치 · 크기 · 도는 방향
  layout(nodes, layers, L, R);
  return { chapter: ch.num, nodes, layers, edges, arc: 0, start: layers[0][0] };
}

function assignTypes(ch, nodes, layers, R) {
  const L = layers.length;
  // 고정 층 — 'story:s02'는 이야기 칸 (대본의 뼈대)
  for (let i = 0; i < L; i++) if (ch.fixed[i]) layers[i].forEach((id, k) => {
    const [t, story] = ch.fixed[i][k].split(':');
    nodes[id].type = t;
    if (story) nodes[id].story = story;
  });
  const free = [];
  for (let i = 0; i < L; i++) if (!ch.fixed[i]) free.push(...layers[i]);
  const okAt = (t, n) => {
    if (ch.from[t] && n.layer < ch.from[t]) return false;
    if (ch.noRepeat.includes(t)) {
      const nb = [...n.prev, ...n.next].map(x => nodes[x].type);
      if (nb.includes(t)) return false;
    }
    // 보스 바로 앞 휴식 층과 휴식이 이어지지 않게
    if (t === 'rest' && n.next.some(x => nodes[x].type === 'rest')) return false;
    return true;
  };
  // 최소 개수부터 채운다
  const order = R.shuffle(free.slice());
  for (const [t, cnt] of Object.entries(ch.atLeast)) {
    let placed = 0;
    for (const id of order) {
      if (placed >= cnt) break;
      const n = nodes[id];
      if (n.type || !okAt(t, n)) continue;
      n.type = t; placed++;
    }
  }
  // 나머지는 비율대로
  for (const id of free) {
    const n = nodes[id];
    if (n.type) continue;
    const cands = Object.entries(ch.weights).filter(([t]) => okAt(t, n));
    n.type = cands.length ? R.weighted(cands) : 'battle';
  }
}

// 사건 주머니 — 한 지도에 같은 사건이 두 번 나오지 않게 하나씩 꺼낸다. 안 본 것(섞어서) → 덜 본 것 순, 다 꺼내면 새로 섞는다
function eventBag(r, pool, seen) {
  const fresh = r.shuffle(pool.filter(id => !seen[id]));
  const old = r.shuffle(pool.filter(id => seen[id])).sort((a, b) => seen[a] - seen[b]);
  let list = [...fresh, ...old], i = 0;
  return () => {
    if (i >= list.length) { list = r.shuffle(pool.slice()); i = 0; }
    return list[i++];
  };
}

function fillContent(ch, n, R, seed, events) {
  n.seed = hashSeed(seed, ch.num, n.id);
  const r = makeRng(n.seed);
  const E = ch.encounters;
  if (n.type === 'battle' || n.type === 'ambush' || n.type === 'trial') {
    const pool = n.layer >= E.hardFrom ? E.normal : E.easy;
    n.enc = { kind: 'normal', foes: r.pick(pool).slice() };
  }
  else if (n.type === 'elite') n.enc = null;       // 지도 전체를 본 뒤 번갈아 정한다(아래 layout 전에 처리)
  else if (n.type === 'story') n.enc = null;       // 이야기 칸 — 대사 · 전투는 대본(data/story)이 정한다
  else if (n.type === 'boss') n.enc = Object.assign({ kind: 'boss' }, E.boss);
  else if (n.type === 'event') n.event = events();
  else if (n.type === 'alley') n.alley = r.pick(['hide', 'narrow', 'deal', 'shortcut']);
  if (n.type === 'trial') n.trial = r.pick(['untouched', 'swift', 'frugal']);
  if (n.type === 'elite') n.eliteIdx = null;
}

function layout(nodes, layers, L, R) {
  const B = MAP_BOX;
  // 정예는 층 순서대로 번갈아 (수문장 · 우두머리)
  let e = 0;
  for (let i = 0; i < L; i++) for (const id of layers[i]) if (nodes[id].type === 'elite') nodes[id].eliteIdx = e++;
  // 층 사이 간격 — 톱니 하나짜리 층끼리(이어지는 이야기 칸)는 조금 붙이고, 보스 앞은 넓게
  const single = i => layers[i].length === 1;
  const gaps = [];
  for (let i = 0; i < L - 1; i++) gaps.push(i === L - 2 ? 1.4 : single(i) && single(i + 1) ? 0.92 : !single(i) && !single(i + 1) ? 1.08 : 1);
  const unit = (B.x1 - B.x0) / gaps.reduce((a, b) => a + b, 0);
  let x = B.x0;
  for (let i = 0; i < L; i++) {
    const ids = layers[i], w = ids.length;
    const span = w === 2 ? SPLIT * 2 : Math.min(B.y1 - B.y0, (w - 1) * 190);
    ids.forEach((id, k) => {
      const n = nodes[id];
      const t = NODE_TYPES[n.type] || NODE_TYPES.battle;
      n.r = t.r;
      n.x = Math.round(x + (w === 1 ? 0 : R.int(-10, 10)));
      n.y = Math.round(w === 1 ? B.cy : B.cy - span / 2 + (span / (w - 1)) * k + R.int(-8, 8));
      n.spin = i % 2 === 0 ? 1 : -1;               // 층마다 번갈아 도는 방향
      n.phase = R.float(0, 360);
      // 이름표 자리 — 사이 층은 바깥쪽(위 톱니는 위, 아래 톱니는 아래)
      if (w === 2) n.tag = k === 0 ? 'up' : 'down';
    });
    if (i < L - 1) x += gaps[i] * unit;
  }
  // 이어지는 톱니 하나짜리 층(이야기 칸 · 시작 · 보스)은 이름표를 위아래로 번갈아 — 옆 이름표와 겹치지 않게. 보스는 늘 아래
  let run = [];
  const flush = () => {
    if (!run.length) return;
    const endsBoss = nodes[run[run.length - 1]].type === 'boss';
    run.forEach((id, k) => { nodes[id].tag = (endsBoss ? (run.length - 1 - k) % 2 : k % 2) ? 'up' : 'down'; });
    run = [];
  };
  for (let i = 0; i < L; i++) { if (single(i)) run.push(layers[i][0]); else flush(); }
  flush();
  // 나란한 사이 층의 이름표가 겹치면(긴 이름 — 「기계 이식소」 등) 뒤쪽 이름표를 바깥으로 한 칸 비켜 둔다
  const tagBox = n => {
    const w = textW((NODE_TYPES[n.type] || NODE_TYPES.battle).label) + 40, dy = n.tag === 'up' ? -(n.r + 24 + (n.tagDy || 0)) : n.r + 24 + (n.tagDy || 0);
    return { x0: n.x - w / 2, x1: n.x + w / 2, y0: n.y + dy - 16, y1: n.y + dy + 16 };
  };
  for (let i = 1; i < L; i++) {
    if (single(i) || single(i - 1)) continue;
    for (const id of layers[i]) {
      const n = nodes[id], b = tagBox(n);
      for (const pid of layers[i - 1]) {
        const a = tagBox(nodes[pid]);
        if (!(a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1)) continue;
        n.tagDy = Math.max(n.tagDy || 0, Math.ceil(n.tag === 'up' ? b.y1 - a.y0 : a.y1 - b.y0) + 4);   // 겹친 만큼 + 4px
      }
    }
  }
}
// 이름표 글자 폭 (map/view.js와 같은 셈)
const textW = s => [...s].reduce((w, ch) => w + (/[가-힣]/.test(ch) ? 15.5 : ch === ' ' ? 5 : 9), 0);

// 칸 종류 개수 (확인용)
export function typeCounts(map) {
  const c = {};
  for (const n of Object.values(map.nodes)) c[n.type] = (c[n.type] || 0) + 1;
  return c;
}

// 지름길: 지금 칸에서 두 칸 앞 톱니들
export function twoAhead(map, id) {
  const out = new Set();
  for (const a of map.nodes[id].next) for (const b of map.nodes[a].next) out.add(b);
  return [...out];
}
