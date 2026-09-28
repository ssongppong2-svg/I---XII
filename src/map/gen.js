// 톱니 지도 만들기 — 챕터 하나 = 톱니 장치 하나
// 1) 층마다 톱니 수 → 2) 교차 없는 연결(놋쇠 축) → 3) 칸 종류 → 4) 위치 · 크기 · 도는 방향
import { makeRng, hashSeed } from '../core/rng.js';
import { NODE_TYPES } from '../data/nodes.js';
import { EVENT_POOL, EVENTS } from '../data/events.js';

// 지도 칸 — 한 줄이면 가운데(cy), 두 줄이면 rows[0] · rows[1] (위 줄은 왼쪽 → 오른쪽, 아래 줄은 오른쪽 → 왼쪽)
export const MAP_BOX = { x0: 118, x1: 1762, y0: 250, y1: 860, cy: 555, rows: [370, 712] };
// 사이 층(톱니 2개)은 가운데 줄을 비우고 위아래로 — 가운데 줄은 이야기 칸과 그 이름표 자리
const SPLIT = 135, SPLIT2 = 70;   // 한 줄 지도 · 두 줄 지도

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
  // 칸마다 내용 씨앗 · 전투 구성 · 사건 (사건은 그 층의 때에 맞는 것만 — 오르가 함께인지, 잃은 뒤인지)
  const events = eventBag(makeRng(hashSeed(seed, 'events', ch.num)), EVENT_POOL[ch.num] || EVENT_POOL[1], opt.seenEvents || {});
  for (const i of layers.keys()) for (const id of layers[i]) fillContent(ch, nodes[id], R, seed, events, nodes);
  // 4) 위치 · 크기 · 도는 방향
  layout(nodes, layers, L, R, ch);
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
  const moodOf = n => { const ph = (ch.phases || {})[n.layer]; return ph && ch.moods && ch.moods[ph] || null; };
  const okAt = (t, n) => {
    const mood = moodOf(n);
    if (mood && !mood[t]) return false;   // 그때에 맞지 않는 칸 (오르를 잃은 뒤의 상점 · 심연 등)
    if (ch.from[t] && n.layer < ch.from[t]) return false;
    // 이야기 칸과 같은 일을 바로 옆에 두지 않는다
    const near = (ch.avoidNear || {})[t];
    if (near && [...n.prev, ...n.next].some(x => near.includes(nodes[x].story))) return false;
    if (ch.noRepeat.includes(t)) {
      const nb = [...n.prev, ...n.next].map(x => nodes[x].type);
      if (nb.includes(t)) return false;
    }
    // 보스 바로 앞 휴식 층과 휴식이 이어지지 않게
    if (t === 'rest' && n.next.some(x => nodes[x].type === 'rest')) return false;
    return true;
  };
  // 최소 개수부터 채운다 — 놓을 자리가 적은 종류부터 (휴식은 이야기 칸 옆 · 오르를 잃은 뒤에는 못 놓아 자리가 가장 적다.
  // 정해 둔 순서대로 채우면 앞 종류가 그 몇 안 되는 자리를 먼저 차지해 휴식이 하나도 없는 지도가 생긴다)
  const order = R.shuffle(free.slice());
  const room = t => free.filter(id => okAt(t, nodes[id])).length;
  const need = Object.entries(ch.atLeast).map(([t, cnt]) => [t, cnt, room(t)]).sort((x, y) => x[2] - y[2]);
  for (const [t, cnt] of need) {
    let placed = 0;
    for (const id of order) {
      if (placed >= cnt) break;
      const n = nodes[id];
      if (n.type || !okAt(t, n)) continue;
      n.type = t; placed++;
    }
  }
  // 나머지는 비율대로 (그때의 비율이 따로 있으면 그것으로)
  for (const id of free) {
    const n = nodes[id];
    if (n.type) continue;
    const cands = Object.entries(moodOf(n) || ch.weights).filter(([t]) => okAt(t, n));
    n.type = cands.length ? R.weighted(cands) : 'battle';
  }
}

// 사건 주머니 — 한 지도에 같은 사건이 두 번 나오지 않게 하나씩 꺼낸다. 안 본 것(섞어서) → 덜 본 것 순
// phase = 그 층의 때(a · b · c) — 사건의 phase 목록에 있는 것만 (없으면 아무 때나). 맞는 게 다 떨어지면 이미 쓴 것 중에서
function eventBag(r, pool, seen) {
  const fresh = r.shuffle(pool.filter(id => !seen[id]));
  const old = r.shuffle(pool.filter(id => seen[id])).sort((a, b) => seen[a] - seen[b]);
  const list = [...fresh, ...old], used = new Set();
  const fits = (id, ph) => !ph || !EVENTS[id] || !EVENTS[id].phase || EVENTS[id].phase.includes(ph);
  return ph => {
    let id = list.find(x => !used.has(x) && fits(x, ph));
    if (!id) id = r.pick(list.filter(x => fits(x, ph)).length ? list.filter(x => fits(x, ph)) : list);
    used.add(id);
    return id;
  };
}

function fillContent(ch, n, R, seed, events, nodes) {
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
  else if (n.type === 'event') n.event = events((ch.phases || {})[n.layer]);
  else if (n.type === 'alley') n.alley = r.pick(skippable(nodes, n.id) ? ['hide', 'narrow', 'deal', 'shortcut'] : ['hide', 'narrow', 'deal']);   // 지름길은 건너뛸 수 있는 자리에서만
  if (n.type === 'trial') n.trial = r.pick(['untouched', 'swift', 'frugal']);
  if (n.type === 'elite') n.eliteIdx = null;
}

function layout(nodes, layers, L, R, ch = {}) {
  const B = MAP_BOX;
  // 정예는 층 순서대로 번갈아 (수문장 · 우두머리)
  let e = 0;
  for (let i = 0; i < L; i++) for (const id of layers[i]) if (nodes[id].type === 'elite') nodes[id].eliteIdx = e++;
  const single = i => layers[i].length === 1;
  // 줄 나누기 — turn이 있으면 두 줄 (위 줄 왼→오, 아래 줄 오→왼 · 끝에 보스). 없으면 한 줄
  const turn = ch.turn && ch.turn > 1 && ch.turn < L ? ch.turn : L;
  const rows = turn < L ? [[0, turn - 1], [turn, L - 1]] : [[0, L - 1]];
  const two = rows.length === 2;
  const split = two ? SPLIT2 : SPLIT;
  rows.forEach(([a, b], ri) => {
    const cy = two ? B.rows[ri] : B.cy;
    // 층 사이 간격 — 톱니 하나짜리 층끼리(이어지는 이야기 칸)는 조금 붙이고, 보스 앞은 넓게
    const gaps = [];
    for (let i = a; i < b; i++) gaps.push(i === L - 2 ? 1.4 : single(i) && single(i + 1) ? 0.92 : !single(i) && !single(i + 1) ? 1.08 : 1);
    const unit = (B.x1 - B.x0) / Math.max(1, gaps.reduce((s, g) => s + g, 0));
    const dir = ri === 0 ? 1 : -1;
    let x = ri === 0 ? B.x0 : B.x1;
    for (let i = a; i <= b; i++) {
      const ids = layers[i], w = ids.length;
      const span = w === 2 ? split * 2 : Math.min(two ? 260 : B.y1 - B.y0, (w - 1) * (two ? 130 : 190));
      ids.forEach((id, k) => {
        const n = nodes[id];
        const t = NODE_TYPES[n.type] || NODE_TYPES.battle;
        n.r = t.r;
        n.row = ri;
        n.x = Math.round(x + (w === 1 ? 0 : R.int(-10, 10)));
        n.y = Math.round(w === 1 ? cy : cy - span / 2 + (span / (w - 1)) * k + R.int(-6, 6));
        n.spin = i % 2 === 0 ? 1 : -1;               // 층마다 번갈아 도는 방향
        n.phase = R.float(0, 360);
        // 이름표 자리 — 사이 층은 바깥쪽(위 톱니는 위, 아래 톱니는 아래)
        if (w === 2) n.tag = k === 0 ? 'up' : 'down';
      });
      if (i < b) x += dir * gaps[i - a] * unit;
    }
  });
  // 이어지는 톱니 하나짜리 층(이야기 칸 · 시작 · 보스)은 이름표를 위아래로 번갈아 — 옆 이름표와 겹치지 않게. 보스는 늘 아래
  // 두 줄이면 줄을 넘어가는 축(세로)을 이름표가 가리지 않게: 위 줄 끝 칸은 위, 아래 줄 첫 칸은 아래
  const tagRun = (run, lastUp) => {
    const endsBoss = nodes[run[run.length - 1]].type === 'boss';
    run.forEach((id, k) => {
      let up = endsBoss ? (run.length - 1 - k) % 2 === 1 : k % 2 === 1;
      if (lastUp) up = (run.length - 1 - k) % 2 === 0;   // 끝에서부터 위 · 아래 · 위 …
      nodes[id].tag = up ? 'up' : 'down';
    });
  };
  rows.forEach(([a, b], ri) => {
    let run = [];
    const flush = (atEnd = false) => { if (run.length) tagRun(run, two && ri === 0 && atEnd); run = []; };
    for (let i = a; i <= b; i++) {
      if (single(i)) run.push(layers[i][0]); else flush();
    }
    flush(true);
    if (two && ri === 1 && single(a)) {   // 아래 줄 첫 칸 — 세로 축을 피해 아래로 (다음 칸부터 번갈아)
      let up = false;
      for (let i = a; i <= b && single(i); i++) { if (nodes[layers[i][0]].type === 'boss') break; nodes[layers[i][0]].tag = up ? 'up' : 'down'; up = !up; }
    }
  });
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
// 바로 다음 층이 모두 사이 칸일 때만 건너뛸 수 있다 — 이야기 칸 · 보스는 건너뛰지 않는다 (1장: 사이 층 3 → 5층의 05만)
function skippable(nodes, id) {
  const next = nodes[id].next.map(x => nodes[x]);
  return next.length > 0 && next.every(n => !['story', 'boss', 'start'].includes(n.type) && n.next.length > 0);
}
export const canShortcut = (map, id) => !!(map && map.nodes[id]) && skippable(map.nodes, id);
export function twoAhead(map, id) {
  const out = new Set();
  for (const a of map.nodes[id].next) for (const b of map.nodes[a].next) out.add(b);
  return [...out];
}
