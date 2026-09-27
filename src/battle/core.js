// 전투 규칙 — 6×6 판(보스전은 맨 위 보스 줄 + 6×6) · 4코스트 루프 · 적은 2코스트마다 행동 · 2번째 행동 뒤 기습 폭격 · 보스 턴 공격 · 과부하
// (테스트판 규칙을 옮김. 낮밤 · 핏빛 타일은 뺐다)
// 화면(view) · 연출(fx)은 H에 끼워 넣는다 — 규칙은 화면을 모른다
import { FOES, BOSSES, ELITE_TRAITS } from '../data/foes.js';
import { SHAPES, cardDef } from '../data/cards.js';
import { ITEMS } from '../data/items.js';
import { makeRng, hashSeed } from '../core/rng.js';
import { sleep, iga } from '../core/util.js';

/* ── 판 좌표 — 보스전: 0행은 보스, 1~6행에서 싸운다 / 일반 전투: 0~5행 전부 (6×6) ── */
export const COLS = 6;
export const START_C = Math.floor((COLS - 1) / 2);   // 시작 칸 — 맨 아랫줄 가운데(왼쪽)
export const K = (r, c) => r * COLS + c;
export const RC = k => [Math.floor(k / COLS), k % COLS];
export const inCol = c => c >= 0 && c < COLS;
export const inBoard = (r, c) => r >= 0 && r < B.rows && inCol(c);   // 일반 6줄(0~5) · 보스전 7줄(0 보스 · 1~6 싸움판)
export const DIRS = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
export const DIR_LABEL = { up: '위', down: '아래', left: '왼', right: '오른' };
export const dirOf = (dr, dc) => dr < 0 ? 'up' : dr > 0 ? 'down' : dc < 0 ? 'left' : 'right';
export const manh = (a, b) => Math.abs(a.r - b.r) + Math.abs(a.c - b.c);
export const cheb = (a, b) => Math.max(Math.abs(a.r - b.r), Math.abs(a.c - b.c));
const ROT = {
  up:    ([dr, dc]) => [dr, dc],
  down:  ([dr, dc]) => [-dr, -dc],
  left:  ([dr, dc]) => [-dc, dr],
  right: ([dr, dc]) => [dc, -dr],
};
export const AIM_ORDER = ['up', 'left', 'right', 'down'];

// 상태 (한 번에 전투 하나)
export const B = { tok: 0, started: false, over: true };
// 화면 · 연출 · 이야기 연결 (view.js · fx.js · screens/battle.js가 채운다)
const noop = () => {};
const nop = async () => {};
export const H = {
  render: noop, renderBoard: noop, log: noop, toast: noop, bark: noop, say: noop, pose: noop,
  scene: nop,               // 전투 중 이야기 (이야기 전투 · 보스)
  onInterlude: noop,        // 전투 중 이야기를 틀기 직전 (본 것으로 적어 둔다 — 재도전 때 다시 멈추지 않게)
  tut: noop,                // 튜토리얼 알림 (이벤트 이름)
  fx: new Proxy({}, { get: () => nop }),
  sfx: new Proxy({}, { get: () => noop }),
};

class Abort extends Error {}
export async function wait(ms) { const t = B.tok; await sleep(ms); if (t !== B.tok) throw new Abort(); }

export const inArea = (r, c) => r >= B.top && r < B.rows && inCol(c) && !(B.blocked && B.blocked.has(K(r, c)));
export const colCells = c => B.area.filter(k => k % COLS === c);
export const rowCells = r => Array.from({ length: COLS }, (_, c) => K(r, c)).filter(k => r === 0 || B.area.includes(k));
// 보스 패턴이 쓰는 판 도우미 — 판 크기가 바뀌어도 패턴은 그대로 맞게
const HELP = { get AREA() { return B.area; }, get TOP() { return B.top; }, get LAST() { return B.rows - 1; }, COLS, RC, colCells, rowCells };

export const liveFoes = () => B.foes.filter(f => f.hp > 0);
export const foeAt = (r, c) => B.foes.find(f => f.hp > 0 && f.r === r && f.c === c) || null;
export const foeById = uid => B.foes.find(f => f.uid === uid) || null;
export const T = f => FOES[f.type];
// 몇 번째 행동 뒤에 움직이나: 1 = 내 다음 행동 뒤, 2 = 그다음 행동 뒤
export const dueIn = f => (B.totalP + 1) % 2 === f.ph ? 1 : 2;

/* ═════════════ 전투 준비 ═════════════ */
// enc: { kind:'normal'|'boss', foes:[type], boss, hpMul, hpMulOf:{ 종류: 배율 }, ambush(칸 수), ambushed, narrow, trial, tut, story, elite, signal }
// ctx: { hp, maxHp, deck:[inst], mods, diff, seed, name, items: { potion }, seen: [이미 본 전투 중 이야기] } — 회복약은 전투 중 1코스트, 이기면 남은 수를 돌려준다
export function setupBattle(enc, ctx) {
  B.tok++;
  const mode = enc.kind === 'boss' ? 'boss' : 'normal';
  const m = ctx.mods, d = ctx.diff;
  const R = makeRng(hashSeed(ctx.seed, 'battle'));
  const rows = mode === 'boss' ? 7 : 6;
  Object.assign(B, {
    enc, mode, R, name: ctx.name,
    top: mode === 'boss' ? 1 : 0, rows,
    blocked: enc.narrow ? new Set(Array.from({ length: rows }, (_, r) => [K(r, 0), K(r, COLS - 1)]).flat()) : null,
    loop: 0, loopCost: 4 + (m.costPerLoop || 0), costLeft: 0, spent: 0, totalP: 0,
    ambushAt: 2,
    hp: ctx.hp, maxHp: ctx.maxHp, shield: 0, ol: 0, freeze: 0,
    olMax: 100 + (m.olMax || 0), olReset: 50, freezeCost: Math.max(1, 4 + (m.freezeCost || 0)),
    shieldCap: 2 + (m.shieldCap || 0),
    handRefill: 3 + (m.handRefill || 0), handMax: 6 + (m.handMax || 0),
    ambushCells: enc.ambush ? Math.max(3, enc.ambush + (m.ambushCells || 0) + (d.ambushPlus || 0)) : 0,
    mods: m, diff: d,
    boss: null,
    foes: [], foeUid: 0,
    p: { r: rows - 1, c: START_C }, loopStartP: { r: rows - 1, c: START_C }, faceL: false, aim: null, inspect: null,
    deck: [], hand: [], discard: [], exhausted: [],
    amb: null, ambFired: false, prevAmbKey: '',
    intent: null, atk: null, prevPat: '',
    lastAct: '', chain: 0, lowBarked: false, won: false,
    sel: null, hover: null,
    busy: false, over: false, started: false,
    wardUsed: false, firstStrikeUsed: false, firstKillDone: false,
    stats: { dealt: 0, taken: 0, dodged: 0, cards: 0, kills: 0, freezes: 0, stuns: 0, loops: 0 },
    seen: new Set(ctx.seen || []), pendingScenes: [],   // 전투 중 이야기는 한 판에 한 번 (재도전해도 다시 멈추지 않게)
    logs: [], logSeq: 0,
    signal: !!enc.signal, signals: 0,   // 감시 시계 송신 — 끝난 송신 수(전투가 끝나면 경계가 그만큼 한 단계씩 오른다)
    items: { potion: (ctx.items && ctx.items.potion) || 0 },
    phase: 0,                            // 보스 단계(0부터)
  });
  B.area = [];
  for (let r = B.top; r < B.rows; r++) for (let c = 0; c < COLS; c++) if (inArea(r, c)) B.area.push(K(r, c));
  // 덱 — 인스턴스를 섞어서
  B.deck = R.shuffle(ctx.deck.map(inst => ({ uid: inst.uid, id: inst.id, up: inst.up })));
  // 보스
  if (mode === 'boss') {
    const BD = BOSSES[enc.boss];
    const hp = Math.round(BD.hp * (d.foeHp || 1) * (d.bossHp || 1));
    B.boss = { id: enc.boss, def: BD, hp, max: hp, ol: 0, stun: 0 };
  }
  spawnFoes(enc.foes || [], enc);
  if (enc.ambushed) { for (const f of B.foes) f.ph = 1; B.ambushAt = 1; for (const f of B.foes) planFoe(f); }
}

function spawnFoes(types, enc) {
  const me = B.p, R = B.R;
  const rows = [B.top, B.top + 1];
  const taken = [];
  const near = (r, c) => taken.some(t => Math.abs(t.r - r) + Math.abs(t.c - c) <= 1);
  // 처음부터 불공평하지 않게: 사격형은 나와 줄이 어긋나게, 폭탄형은 던지는 거리(2~3) 밖에서
  const fair = (ai, r, c) => ai === 'line' || ai === 'charge' ? r !== me.r && c !== me.c : ai === 'bomber' || ai === 'chaser' ? manh({ r, c }, me) >= 4 : ai === 'mortar' ? manh({ r, c }, me) >= 3 : true;
  types.forEach((type, i) => {
    const D = FOES[type];
    if (!D) return;
    const free = B.area.map(RC).filter(([r, c]) => !(r === me.r && c === me.c) && !taken.some(t => t.r === r && t.c === c));
    const tiers = [
      free.filter(([r, c]) => rows.includes(r) && !near(r, c) && fair(D.ai, r, c)),
      free.filter(([r, c]) => rows.includes(r) && fair(D.ai, r, c)),
      free.filter(([r]) => rows.includes(r)),
      free,
    ];
    const cands = tiers.find(t => t.length);
    if (!cands) return;
    const [r, c] = R.pick(cands);
    taken.push({ r, c });
    const hp = Math.max(1, Math.round(D.hp * (B.diff.foeHp || 1) * (enc.hpMul || 1) * ((enc.hpMulOf || {})[type] || 1)));
    const f = { uid: ++B.foeUid, type, r, c, hp, max: hp, ph: (i + 1) % 2, face: 'down', flip: false, intent: null, skip: false, traits: [], volley: 0 };
    if (B.signal && type === 'watcher') f.sig = SIGNAL_TURNS;   // 송신까지 남은 행동 수
    // 정예 특성 (난이도 IV부터)
    if (D.elite && B.diff.eliteTrait) f.traits.push(R.pick(Object.keys(ELITE_TRAITS)));
    B.foes.push(f);
  });
  for (const f of B.foes) {
    planFoe(f);
    if (dueIn(f) === 1 && f.intent.kind === 'atk') f.intent = { kind: 'wait' };   // 첫 행동 전에 바로 맞는 일은 없게
  }
}

/* ═════════════ 사거리 · 조준 ═════════════ */
export function shapeCells(shape, p, dir) {
  return SHAPES[shape].cells.map(ROT[dir]).map(([dr, dc]) => [p.r + dr, p.c + dc]).filter(([r, c]) => inBoard(r, c));
}
// 그 방향으로 썼을 때 맞는 것: 범위 안의 적 · 보스 줄(0행)
export function strikeTargets(shape, p, dir) {
  const cells = shapeCells(shape, p, dir);
  const has = new Set(cells.map(([r, c]) => K(r, c)));
  const foes = liveFoes().filter(f => has.has(K(f.r, f.c)));
  const bcols = B.mode === 'boss' ? cells.filter(([r]) => r === 0).map(([, c]) => c) : [];
  return { cells, foes, bcols, boss: bcols.length > 0, n: foes.length + (bcols.length ? 1 : 0) };
}
export function validDirs(def) { return def.shape ? AIM_ORDER.filter(d => strikeTargets(def.shape, B.p, d).n > 0) : []; }
export function aimFor(def) {
  const v = validDirs(def);
  if (!v.length) return null;
  if (B.aim && v.includes(B.aim)) return B.aim;
  let best = v[0], bs = -1;
  for (const d of v) {
    const t = strikeTargets(def.shape, B.p, d);
    const s = t.foes.length + (t.boss ? 1.5 : 0);
    if (s > bs) { bs = s; best = d; }
  }
  return best;
}
export function dirAtCell(def, r, c) {
  const inShape = d => shapeCells(def.shape, B.p, d).some(([rr, cc]) => rr === r && cc === c);
  const aim = aimFor(def);
  if (aim && inShape(aim)) return aim;
  return validDirs(def).find(inShape) || null;
}
// 보스전: 위로 썼을 때 보스 줄(0행)에 닿는 거리
export function reachText(shape) {
  const n = (B.rows || 7) - 1;
  const rows = Array.from({ length: n }, (_, i) => i + 1).filter(r => SHAPES[shape].cells.some(([dr]) => r + dr === 0));
  if (rows.length === n) return '어디서나 명중';
  if (!rows.length) return '위로 쓰면 닿지 않음';
  if (rows.length === 1) return `거리 ${rows[0]}에서만 명중`;
  return `거리 ${rows[0]}~${rows[rows.length - 1]}에서 명중`;
}

// 도약 착지점: 적은 뛰어넘을 수 있지만 적 위에는 내릴 수 없다 — 닿는 가장 먼 빈칸
export function leapTarget(dir, max) {
  const [dr, dc] = DIRS[dir];
  let t = null;
  for (let d = 1; d <= max; d++) {
    const r = B.p.r + dr * d, c = B.p.c + dc * d;
    if (!inBoard(r, c) || r < B.top) break;
    if (!inArea(r, c)) continue;            // 막힌 칸(좁은 골목)은 넘을 수는 있다
    if (!foeAt(r, c)) t = { r, c, dist: d };
  }
  return t;
}
export const leapOf = def => def.leap ? def.leap + (B.mods.leapPlus || 0) : 0;

/* ═════════════ 기습 폭격 — 가로·세로 줄 조각을 합쳐 정확히 n칸 ═════════════ */
function canEscape(set, p) {
  return Object.values(DIRS).some(([dr, dc]) => { const r = p.r + dr, c = p.c + dc; return inArea(r, c) && !set.has(K(r, c)) && !foeAt(r, c); });
}
function genAmbush(n, p, prevKey) {
  const R = B.R, me = K(p.r, p.c);
  const cols = Array.from({ length: COLS }, (_, c) => c).filter(c => B.area.some(k => k % COLS === c));
  const c0 = Math.min(...cols), c1 = Math.max(...cols);
  const rows = B.rows - B.top, last = B.rows - 1;
  n = Math.min(n, B.area.length - 2);
  for (let t = 0; t < 2000; t++) {
    const set = new Set(), segs = [];
    let over = false;
    for (let i = 0; set.size < n && i < 8; i++) {
      const horiz = R.chance(0.5);
      const full = horiz ? c1 - c0 + 1 : rows;
      const len = R.chance(0.45) ? full : R.int(2, Math.max(2, Math.min(3, full)));
      const through = i === 0 && R.chance(0.8);        // 첫 줄은 대개 나를 노린다
      let idx, start;
      if (horiz) {
        idx = through ? p.r : R.int(B.top, last);
        start = through ? R.int(Math.max(c0, p.c - len + 1), Math.min(p.c, c1 - len + 1)) : R.int(c0, c1 - len + 1);
      } else {
        idx = through ? p.c : R.pick(cols);
        start = through ? R.int(Math.max(B.top, p.r - len + 1), Math.min(p.r, B.rows - len)) : R.int(B.top, B.rows - len);
      }
      const cells = [];
      for (let j = 0; j < len; j++) cells.push(horiz ? K(idx, start + j) : K(start + j, idx));
      if (cells.some(k => !B.area.includes(k))) continue;
      const added = cells.filter(k => !set.has(k)).length;
      if (!added) continue;
      if (set.size + added > n) { over = true; break; }
      cells.forEach(k => set.add(k));
      segs.push({ horiz, idx, start, len });
    }
    if (over || set.size !== n) continue;
    const key = [...set].sort((a, b) => a - b).join('.');
    if (key === prevKey) continue;
    const onMe = set.has(me);
    if (onMe && !canEscape(set, p)) continue;              // 첫 이동 한 번으로 피할 수 있어야 한다
    if (!onMe && R.chance(0.8)) continue;                  // 대부분은 내 칸을 덮는다
    return { cells: set, segs, key };
  }
  // 예비안: 내 가로줄
  const set = new Set(), segs = [];
  const row = B.area.filter(k => RC(k)[0] === p.r);
  row.forEach(k => set.add(k));
  segs.push({ horiz: true, idx: p.r, start: RC(row[0])[1], len: row.length });
  return { cells: set, segs, key: [...set].sort((a, b) => a - b).join('.') };
}

/* ═════════════ 적 행동 계획 ═════════════ */
const faceToward = (f, p) => {
  const dr = p.r - f.r, dc = p.c - f.c;
  if (Math.abs(dr) >= Math.abs(dc)) return dr < 0 ? 'up' : 'down';
  return dc < 0 ? 'left' : 'right';
};
export const inFront = (f, p) => f.face === 'up' ? p.r < f.r : f.face === 'down' ? p.r > f.r : f.face === 'left' ? p.c < f.c : p.c > f.c;
const cellSet = list => new Set(list.filter(([r, c]) => inArea(r, c)).map(([r, c]) => K(r, c)));
function lineFrom(f, dir) {
  const [dr, dc] = DIRS[dir], out = [];
  for (let r = f.r + dr, c = f.c + dc; inBoard(r, c) && r >= B.top; r += dr, c += dc) out.push([r, c]);
  return cellSet(out);
}
const front3 = (f, face) => cellSet([[-1, -1], [-1, 0], [-1, 1]].map(ROT[face]).map(([dr, dc]) => [f.r + dr, f.c + dc]));
const front6 = (f, face) => cellSet([[-1, -1], [-1, 0], [-1, 1], [-2, -1], [-2, 0], [-2, 1]].map(ROT[face]).map(([dr, dc]) => [f.r + dr, f.c + dc]));
const plusAt = p => cellSet([[0, 0], [-1, 0], [1, 0], [0, -1], [0, 1]].map(([dr, dc]) => [p.r + dr, p.c + dc]));
const ringAt = p => cellSet([[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]].map(([dr, dc]) => [p.r + dr, p.c + dc]));
export const SIGNAL_TURNS = 4;   // 감시 시계가 송신을 끝내기까지 자기 행동 수 — 그 전에 부수면 막는다
// 돌진 길 — 그 방향으로 판 끝(또는 다른 적 앞)까지. 예고할 때 정해지고 바뀌지 않는다
function chargePath(f, dir) {
  const [dr, dc] = DIRS[dir], out = [];
  for (let r = f.r + dr, c = f.c + dc; inArea(r, c); r += dr, c += dc) {
    if (B.foes.some(g => g !== f && g.hp > 0 && g.r === r && g.c === c)) break;
    out.push([r, c]);
  }
  return out;
}
// 이동 계획용 빈칸: 내 칸 · 다른 적 · 다른 적이 가기로 한 칸은 피한다
function freeForPlan(r, c, f) {
  if (!inArea(r, c) || (B.p.r === r && B.p.c === c)) return false;
  return !B.foes.some(g => g !== f && g.hp > 0 && ((g.r === r && g.c === c) || (g.intent && g.intent.kind === 'move' && g.intent.to.r === r && g.intent.to.c === c)));
}
// 한 칸(또는 step칸 직선) 이동 중 가장 점수가 높은 곳. 제자리보다 나아질 때만 움직인다
function moveIntent(f, score, step = 1) {
  let best = null, bs = score({ r: f.r, c: f.c });
  for (const [dir, [dr, dc]] of B.R.shuffle(Object.entries(DIRS))) {
    for (let s = 1; s <= step; s++) {
      const r = f.r + dr * s, c = f.c + dc * s;
      if (!freeForPlan(r, c, f)) break;
      const v = score({ r, c });
      if (v > bs) { bs = v; best = { kind: 'move', dir, to: { r, c }, dist: s }; }
    }
  }
  return best || { kind: 'wait' };
}

// 다음 행동 계획 — 계획하는 순간 내 위치를 기준으로 칸이 정해진다
export function planFoe(f) {
  const p = B.p, D = FOES[f.type];
  let it;
  if (f.skip) { it = { kind: 'wait', skipped: true }; }
  else if (D.ai === 'line') {
    if (f.r === p.r || f.c === p.c) {
      const dir = f.r === p.r ? (p.c < f.c ? 'left' : 'right') : (p.r < f.r ? 'up' : 'down');
      it = { kind: 'atk', dir, cells: lineFrom(f, dir) };
    } else it = moveIntent(f, q => (q.r === p.r || q.c === p.c ? 10 : 0) - Math.abs(manh(q, p) - 3));
  } else if (D.ai === 'guard') {
    f.face = faceToward(f, p);
    if (cheb(f, p) === 1 || (D.wide && cheb(f, p) === 2 && inFront(f, p) && front6(f, f.face).has(K(p.r, p.c)))) it = { kind: 'atk', dir: f.face, cells: D.wide ? front6(f, f.face) : front3(f, f.face) };
    else it = moveIntent(f, q => -manh(q, p));
  } else if (D.ai === 'chaser') {
    f.face = faceToward(f, p);
    if (cheb(f, p) === 1) it = { kind: 'atk', dir: f.face, cells: front3(f, f.face) };
    else {
      it = moveIntent(f, q => -manh(q, p) - (cheb(q, p) === 1 ? 0 : 0.5), D.step || 1);
      if (it.kind === 'move') f.face = it.dir;
    }
  } else if (D.ai === 'charge') {
    // 돌진 — 같은 줄이면 그 줄을 따라 돌진 예고, 아니면 줄을 맞추되 거리를 두는 자리로 한 칸
    const path = f.r === p.r || f.c === p.c ? chargePath(f, f.r === p.r ? (p.c < f.c ? 'left' : 'right') : (p.r < f.r ? 'up' : 'down')) : [];
    if (path.length) {
      const dir = f.r === p.r ? (p.c < f.c ? 'left' : 'right') : (p.r < f.r ? 'up' : 'down');
      it = { kind: 'atk', dir, cells: cellSet(path), path };
      f.face = dir;
    } else {
      it = moveIntent(f, q => (q.r === p.r || q.c === p.c ? 10 - Math.abs(manh(q, p) - 3) : -0.2 * manh(q, p)));
      if (it.kind === 'move') f.face = it.dir;
    }
  } else if (D.ai === 'mortar') {
    // 곡사포 — 움직이지 않는다. 내 자리에 십자 5칸 · 둘레 8칸(가운데 안전)을 번갈아. 바로 옆에 붙으면 못 쏜다
    if (cheb(f, p) <= 1) it = { kind: 'wait', close: true };
    else {
      const ring = f.volley % 2 === 1;
      it = { kind: 'atk', dir: null, cells: ring ? ringAt(p) : plusAt(p), center: { r: p.r, c: p.c }, ring };
    }
  } else {   // bomber
    const d = manh(f, p);
    if (d >= 2 && d <= 3) it = { kind: 'atk', dir: null, cells: plusAt(p), center: { r: p.r, c: p.c } };
    else it = moveIntent(f, q => -Math.abs(manh(q, p) - 2.5));
  }
  f.intent = it;
  if (D.ai === 'line' || D.ai === 'bomber' || D.ai === 'mortar') f.face = faceToward(f, p);
  const hx = p.c - f.c;
  if (D.noFlip) f.flip = false;
  else if (hx) f.flip = hx > 0 ? D.native === 'L' : D.native === 'R';
}

/* ═════════════ 흐름 ═════════════ */
export async function run(fn) {
  if (B.busy || B.over) return;
  const t = B.tok;
  B.busy = true; H.render();
  try { await fn(); }
  catch (e) { if (!(e instanceof Abort)) console.error(e); }
  if (t === B.tok) { B.busy = false; H.render(); }
}

export function log(t, cls = '') { B.logs.push({ t, cls }); if (B.logs.length > 40) B.logs.shift(); B.logSeq++; }

function drawOne() {
  if (!B.deck.length) {
    if (!B.discard.length) return false;
    B.deck = B.R.shuffle(B.discard); B.discard = [];
    log('버린 카드를 섞어 덱을 채웠다', 'dim');
  }
  const inst = B.deck.pop();
  B.hand.push(inst);
  const def = cardDef(inst);
  if (def && def.drawOl) addOverload(def.drawOl, def.name);
  return true;
}
function drawUpTo(n) { while (B.hand.length < Math.min(n, B.handMax)) if (!drawOne()) break; }
function pickPattern() {
  const def = B.boss.def;
  const ids = def.phases ? def.phases[B.phase].pats : null;
  const pats = ids ? def.patterns.filter(p => ids.includes(p.id)) : def.patterns;
  const ok = pats.filter(p => p.id !== B.prevPat);
  return B.R.pick(ok.length ? ok : pats);
}
// 보스 단계 — 체력이 문턱(at)을 넘으면 다음 단계: 턴 공격이 바뀌고, 그 단계 이야기(phase2 · phase3)를 한 번 튼다
function bossPhaseCheck() {
  if (!B.boss) return;
  const ph = B.boss.def.phases;
  if (!ph) { if (B.boss.hp <= B.boss.max * 0.5) queueInterlude('half'); return; }
  while (B.phase + 1 < ph.length && B.boss.hp <= B.boss.max * ph[B.phase + 1].at) {
    B.phase++;
    log(`${B.boss.def.name} — ${B.phase + 1}단계 「${ph[B.phase].name}」`, 'warn');
    queueInterlude('phase' + (B.phase + 1));
    H.sfx.warn();
  }
}
export const bossPhaseName = () => B.boss && B.boss.def.phases ? `${B.phase + 1}단계 · ${B.boss.def.phases[B.phase].name}` : '';
export const ambushOn = () => B.ambushCells > 0;

// 유물 · 이식의 때맞춘 효과
function relicOn(when, ctx = {}) {
  for (const on of B.mods.on || []) {
    const e = on[when];
    if (!e) continue;
    if (e.shield) { B.shield = Math.min(B.shieldCap, B.shield + e.shield); log(`유물 — 실드 +${e.shield}`, 'ok'); }
    if (e.cool && B.ol > 0) { B.ol = Math.max(0, B.ol - e.cool); log(`유물 — 과부하 −${e.cool}`, 'ok'); }
    if (e.ol) addOverload(e.ol, '유물의 대가');
    if (e.heal) { const b = B.hp; B.hp = Math.min(B.maxHp, B.hp + e.heal); if (B.hp > b) { log(`유물 — HP +${B.hp - b}`, 'ok'); H.fx.heal(); } }
  }
}

export async function startBattle() {
  if (B.started) return;
  B.started = true; B.over = false;
  relicOn('battleStart');
  const n = liveFoes().length;
  log(B.mode === 'boss' ? `${B.boss.def.name} — 교전 개시` : `적 ${n} — 교전 개시`, 'dim');
  if (B.enc.ambushed) log('기습! 적이 먼저 움직인다', 'warn');
  await run(() => startLoop());
}

async function startLoop() {
  B.loop++; B.stats.loops = B.loop;
  B.costLeft = B.loopCost; B.spent = 0;
  B.atk = null; B.ambFired = false; B.amb = null; B.intent = null;
  B.loopStartP = { r: B.p.r, c: B.p.c };
  drawUpTo(B.handRefill);
  relicOn('loopStart');
  // 정예 특성: 재생
  for (const f of liveFoes()) if (f.traits.includes('regen') && f.hp < f.max) { f.hp = Math.min(f.max, f.hp + 2); H.fx.foeHeal(f); }
  if (B.loop === 2 && B.enc.ambushed) B.ambushAt = 2;
  const parts = [];
  if (ambushOn()) {
    B.amb = genAmbush(B.ambushCells, B.p, B.prevAmbKey);
    B.prevAmbKey = B.amb.key;
    parts.push(`기습 ${B.amb.cells.size}칸 예고`);
  }
  if (B.mode === 'boss') {
    const pat = pickPattern();
    B.prevPat = pat.id;
    B.intent = { pat, q: pat.roll ? pat.roll(B.R) : {} };
    parts.push(`턴 공격 「${pat.name}」`);
  }
  log(`루프 ${B.loop}${parts.length ? ' — ' + parts.join(' · ') : ''}`, 'dim');
  H.sfx.arm(); H.render(); H.fx.arming();
  H.tut('loop');
  await wait(220);
}

export function validate(a) {
  if (a.type === 'move') {
    const [dr, dc] = DIRS[a.dir];
    const r = B.p.r + dr, c = B.p.c + dc;
    if (B.mode === 'boss' && r < B.top && inCol(c)) return '보스가 버틴 줄로는 들어갈 수 없어요';
    if (!inBoard(r, c)) return '판 끝이에요';
    if (!inArea(r, c)) return '막힌 칸이에요';
    const f = foeAt(r, c);
    if (f) return `${T(f).name}${iga(T(f).name)} 막고 있어요`;
    return null;
  }
  if (a.type === 'potion') {
    if (!(B.items.potion > 0)) return '회복약이 없어요';
    if (B.hp >= B.maxHp) return 'HP가 가득 차 있어요';
    return null;
  }
  if (a.type === 'draw') {
    if (B.hand.length >= B.handMax) return `손패가 가득 찼어요 (최대 ${B.handMax}장)`;
    if (!B.deck.length && !B.discard.length) return '더 뽑을 카드가 없어요';
    return null;
  }
  if (a.type === 'card') {
    const inst = B.hand[a.i];
    if (!inst) return '카드가 없어요';
    const def = cardDef(inst);
    if (def.shape) {
      const v = validDirs(def);
      if (!v.length) return B.mode === 'boss' ? `사거리 밖 — 보스는 ${reachText(def.shape)}` : '사거리 밖 — 어느 방향에도 닿는 적이 없어요';
      if (a.dir && !v.includes(a.dir)) return `${DIR_LABEL[a.dir]}쪽에는 닿는 적이 없어요`;
    }
    if (def.leap && !def.shape) {
      if (!a.dir) return '도약할 방향을 고르세요 — WASD 또는 점선 칸';
      if (!leapTarget(a.dir, a.dist || leapOf(def))) return '그 방향으로는 도약할 수 없어요';
    }
    if (def.back && B.p.r === B.loopStartP.r && B.p.c === B.loopStartP.c) return '이미 이번 루프의 첫 칸에 있어요';
    if (def.back && foeAt(B.loopStartP.r, B.loopStartP.c)) return '돌아갈 칸을 적이 막고 있어요';
    if (def.selfHit && B.hp <= def.selfHit) return 'HP가 모자라요';
    return null;
  }
  return '알 수 없는 행동';
}

export function act(a) {
  if (!B.started || B.busy || B.over) return false;
  if (a.type === 'card' && B.hand[a.i]) {
    const def = cardDef(B.hand[a.i]);
    if (def.shape && !a.dir) a.dir = aimFor(def) || undefined;
  }
  if (B.freeze <= 0) {
    const err = validate(a);
    if (err) { H.toast(err); H.sfx.deny(); return false; }
  }
  run(() => doAct(a));
  return true;
}

async function doAct(a) {
  const frozen = B.freeze > 0;
  const downAtPay = B.boss && B.boss.stun > 0;
  B.sel = null; B.hover = null;
  // ① 코스트 지불
  B.costLeft--; B.spent++; B.totalP++;
  if (frozen) B.freeze--;
  if (downAtPay) B.boss.stun--;
  const last = B.costLeft <= 0;
  H.render();
  // ② 행동 (마비 중이면 코스트만 날아간다)
  if (frozen) await fizzle(a); else await resolve(a);
  if (B.over) return;
  // ③ 적 — 순번이 된 적이 예고대로 이동 또는 공격하고, 다음 행동을 예고
  await foesAct();
  if (B.over) return;
  // ④ 기습(2번째 행동 뒤) → 턴 공격 범위 공개 · 마지막 행동 뒤 턴 공격
  const bossDown = downAtPay || (B.boss && B.boss.stun > 0);
  if (B.spent === B.ambushAt && !B.ambFired) {
    await fireAmbush(bossDown);
    if (B.over) return;
    if (B.intent) { revealAttack(); await wait(160); }
  }
  if (last && B.intent) { await fireAttack(bossDown); if (B.over) return; }
  // ⑤ 전투 중 이야기 → ⑥ 루프 끝
  await flushInterludes();
  if (last) { await endLoop(); await startLoop(); }
}

async function foesAct() {
  const due = liveFoes().filter(f => B.totalP % 2 === f.ph);
  if (!due.length) return;
  for (const f of due) {
    if (f.hp <= 0) continue;
    const skipped = !!(f.intent && f.intent.skipped);
    await foeExecute(f);
    if (B.over) return;
    // 감시 시계 송신 — 제 행동을 마칠 때마다 한 칸(멈춘 동안은 그대로). 끝나면 경계 한 단계 (전투가 끝난 뒤 반영)
    if (f.sig > 0 && f.hp > 0 && !skipped && --f.sig === 0) {
      B.signals++;
      log(`${T(f).name} — 위치 송신 완료. 경계가 한 단계 오른다`, 'bad');
      H.say(f, 'signal'); H.sfx.alarm(); H.toast('감시 시계가 위치를 송신했다 — 경계 +1단계');
      H.tut('signal');
    }
  }
  for (const f of due) if (f.hp > 0) { f.skip = false; planFoe(f); }
  H.render();
  H.tut('foesActed');
}

async function foeExecute(f) {
  const it = f.intent, D = T(f);
  if (!it || it.kind === 'wait') { if (it && it.skipped) log(`${D.name} — 행동을 건너뛰었다`, 'ok'); return; }
  if (it.kind === 'move') {
    const { r, c } = it.to;
    if (!inArea(r, c) || foeAt(r, c) || (B.p.r === r && B.p.c === c)) {
      log(`${D.name} — 길이 막혀 제자리`, 'dim');
      H.fx.bump(f);
      await wait(150);
      return;
    }
    f.r = r; f.c = c;
    H.sfx.fstep(); H.render();
    await wait(it.dist > 1 ? 220 : 170);
    return;
  }
  if (B.R.chance(0.45)) H.say(f, 'atk');
  let dmg = D.dmg + (f.traits.includes('frenzy') && f.hp <= f.max / 2 ? 1 : 0);
  if (it.path) {
    // 돌진 — 예고한 길을 따라가다 나를 만나면 부딪치고 그 앞에 멈춘다. 다른 적이 길을 막으면 그 앞에서 멈춘다
    let land = null, hit = false;
    for (const [r, c] of it.path) {
      if (B.p.r === r && B.p.c === c) { hit = true; break; }
      if (foeAt(r, c)) break;
      land = { r, c };
    }
    await H.fx.foeAttack(f, Object.assign({}, it, { land, hit }));
    if (land) { f.r = land.r; f.c = land.c; H.render(); }
    if (hit) await damagePlayer(dmg, { src: `${D.name} ${D.atk}` });
    else { B.stats.dodged++; log(`${D.name} ${D.atk} — 헛돌진`, 'ok'); }
    return;
  }
  if (D.ai === 'mortar') f.volley++;
  await H.fx.foeAttack(f, it);
  if (it.cells.has(K(B.p.r, B.p.c))) await damagePlayer(dmg, { src: `${D.name} ${D.atk}` });
  else { B.stats.dodged++; log(`${D.name} ${D.atk} — 회피`, 'ok'); }
}

// 적 쓰러짐 — 폭탄형은 그 자리에서 자폭(주변 8칸, 다른 적 · 보스도 맞고 연쇄)
async function foeDown(f) {
  if (f.gone) return;
  f.gone = true; f.hp = 0; f.intent = null;
  B.stats.kills++;
  if (B.inspect === f.uid) B.inspect = null;
  log(`${T(f).name} 쓰러짐`, 'ok');
  H.say(f, 'die');
  H.fx.foeDie(f); H.render();
  relicOn('kill');
  if (!B.firstKillDone) { B.firstKillDone = true; relicOn('firstKill'); }
  await wait(260);
  if (T(f).blast) await bombBlast(f);
}
async function bombBlast(f) {
  const D = T(f);
  const cells = [];
  for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
    const r = f.r + dr, c = f.c + dc;
    if ((dr || dc) && inBoard(r, c)) cells.push([r, c]);
  }
  const set = new Set(cells.map(([r, c]) => K(r, c)));
  log(`${D.name} 자폭 — 주변 8칸 폭발`, 'warn');
  queueInterlude('blast1');
  await H.fx.blast(cells);
  const bcols = B.mode === 'boss' ? cells.filter(([r]) => r === 0).map(([, c]) => c) : [];
  if (bcols.length && B.boss.hp > 0) {
    B.boss.hp = Math.max(0, B.boss.hp - D.blast);
    B.stats.dealt += D.blast;
    H.fx.bossHit(bcols, D.blast, false);
    log(`자폭에 보스가 휘말림 — ${D.blast} 피해`, 'ok');
    bossPhaseCheck();
  }
  const caught = liveFoes().filter(g => set.has(K(g.r, g.c)));
  for (const g of caught) {
    const d = hurtFoe(g, D.blast, {});
    log(`자폭에 ${T(g).name}${iga(T(g).name)} 휘말림 — ${d} 피해`, 'ok');
  }
  H.render();
  if (set.has(K(B.p.r, B.p.c))) { await damagePlayer(D.blastMe, { src: `${D.name} 자폭` }); if (B.over) return; }
  for (const g of caught) if (g.hp <= 0) { await foeDown(g); if (B.over) return; }
}
function hurtFoe(g, dmg, o) {
  let d = dmg;
  if (g.traits.includes('plated')) d = Math.max(1, d - 1);
  g.hp = Math.max(0, g.hp - d);
  B.stats.dealt += d;
  H.fx.foeHit(g, d, o);
  return d;
}

// 승리: 보스전은 보스 HP 0 · 그 밖은 적 전멸
async function checkWin() {
  if (B.over) return true;
  if (B.mode === 'boss' ? B.boss.hp <= 0 : !liveFoes().length) { await victory(); return true; }
  return false;
}

async function fireAmbush(bossDown) {
  B.ambFired = true;
  const amb = B.amb;
  if (!amb) return;
  if (bossDown) {
    log('기습 폭격 무력화 — 보스 과부하 정지 중', 'ok');
    await H.fx.cancel(amb.cells);
    B.amb = null; H.render();
    return;
  }
  const hit = amb.cells.has(K(B.p.r, B.p.c));
  await H.fx.ambushBlast(amb);
  B.amb = null; H.render();
  H.tut('ambushFired', { hit });
  if (hit) await damagePlayer(1, { src: '기습 폭격' });
  else { B.stats.dodged++; log('기습 폭격 — 회피', 'ok'); }
}

function revealAttack() {
  if (!B.intent || B.atk) return;
  B.atk = new Set(B.intent.pat.make(B.p, B.intent.q, HELP));
  H.sfx.warn(); H.render(); H.fx.reveal();
}

async function fireAttack(bossDown) {
  if (!B.atk) revealAttack();
  const pat = B.intent.pat;
  if (bossDown) {
    log(`턴 공격 「${pat.name}」 무력화 — 보스 과부하 정지 중`, 'ok');
    await H.fx.cancel(B.atk);
    B.atk = null; H.render();
    return;
  }
  if (B.R.chance(0.35)) H.bark('attack');
  const cells = B.atk;
  const hit = cells.has(K(B.p.r, B.p.c));
  await H.fx.attackBlast(cells, pat);
  B.atk = null; H.render();
  if (hit) await damagePlayer(pat.dmg + (B.diff.bossDmg || 0), { src: `턴 공격 「${pat.name}」`, nail: pat.nail });
  else { B.stats.dodged++; log(`턴 공격 「${pat.name}」 — 회피`, 'ok'); }
}

async function damagePlayer(dmg, o) {
  if (B.shield > 0) {
    B.shield--;
    log(`${o.src} — 실드로 막음`, 'ok');
    H.render(); await H.fx.block();
    return;
  }
  B.hp = Math.max(0, B.hp - dmg);
  B.stats.taken += dmg;
  // 재귀의 모래시계 — 전투마다 한 번 버틴다
  if (B.hp <= 0 && B.mods.deathWard && !B.wardUsed) {
    B.wardUsed = true; B.hp = 1;
    log('재귀의 모래시계 — 쓰러질 피해를 막았다', 'ok');
  }
  log(`${o.src} 명중 — HP −${dmg}`, 'bad');
  H.pose(B.hp <= 1 ? 'wounded' : 'pain', 900);
  H.render(); await H.fx.playerHit(dmg);
  if (B.hp <= 0) { await defeat(); return; }
  if (o.nail) addOverload(Math.round((B.boss ? B.boss.def.nailOl : 30) * (B.mods.nailOlMul || 1)), '장력 가속 못총');
  H.render();
}

export function addOverload(n, src) {
  if (n <= 0) return;
  B.ol = Math.min(B.olMax, B.ol + n);
  log(`${src} — 과부하 +${n}`, 'volt');
  if (B.ol >= B.olMax) {
    B.ol = B.olReset;
    B.freeze = Math.max(B.freeze, B.freezeCost);
    B.stats.freezes++;
    B.lastAct = ''; B.chain = 0;
    log(`과부하 ${B.olMax}! 시스템 정지 — ${B.freezeCost}코스트 동안 마비`, 'volt');
    H.fx.freeze(); H.bark('freeze');
    queueInterlude('freeze1');
    H.tut('freeze');
  }
}
function addBossOl(n) {
  if (n <= 0 || !B.boss) return;
  n = Math.round(n * (B.mods.bossOlMul || 1));
  B.boss.ol = Math.min(100, B.boss.ol + n);
  if (B.boss.ol >= 100) {
    B.boss.ol = 50;
    B.boss.stun = Math.max(B.boss.stun, 4);
    B.stats.stuns++;
    log('보스 과부하! 4코스트 동안 기습 · 턴 공격 정지', 'ok');
    H.fx.stun(); H.bark('stun');
    queueInterlude('stun1');
  }
}

async function fizzle(a) {
  B.lastAct = 'fizzle'; B.chain = 0;
  log(a.type === 'move' ? '마비 — 제자리에서 움직이지 못했다' : a.type === 'draw' ? '마비 — 뽑기 실패, 코스트만 소모' : a.type === 'potion' ? '마비 — 회복약을 꺼내지 못했다' : '마비 — 카드가 작동하지 않았다', 'volt');
  H.sfx.fizzle(); H.fx.fizzle();
  H.render();
  await wait(240);
}

async function resolve(a) {
  if (a.type === 'move') { await doMove(a.dir, 1); B.lastAct = 'move'; B.chain = 0; H.tut('moved'); return; }
  if (a.type === 'potion') {
    B.items.potion--;
    const b = B.hp;
    B.hp = Math.min(B.maxHp, B.hp + ITEMS.potion.heal);
    B.lastAct = 'potion'; B.chain = 0;
    log(`회복약 — HP +${B.hp - b}`, 'ok');
    H.fx.heal(); H.render();
    await wait(220);
    return;
  }
  if (a.type === 'draw') {
    drawOne(); B.lastAct = 'draw'; B.chain = 0;
    log('카드 1장 추가 뽑기'); H.sfx.draw(); H.render();
    H.tut('drew');
    await wait(150);
    return;
  }
  if (a.type === 'card') { await playCard(a); H.tut('card'); }
}

async function doMove(dir, dist) {
  const [, dc] = DIRS[dir];
  const t = leapTarget(dir, dist);
  if (dc) B.faceL = dc < 0;
  if (t) B.p = { r: t.r, c: t.c };
  H.sfx.step(); H.fx.hop();
  H.render();
  await wait(dist > 1 ? 210 : 150);
}

export function nextOl(def, id) {
  return (def.ol || 0) + (def.rapid ? def.rapid * (B.lastAct === id ? B.chain + 1 : 0) : 0);
}
// 이 카드를 지금 쓰면 들어가는 피해 (유물 · 과열 · 성흔 반영)
export function cardDamage(def) {
  if (!def.shape) return 0;
  let d = def.dmg + (B.mods.allDmg || 0) + ((B.mods.kindDmg || {})[def.kind] || 0);
  if (!B.firstStrikeUsed && B.mods.firstStrike) d += B.mods.firstStrike;
  if (def.hot && B.ol >= 50) d *= def.hot;
  if (B.mods.lowHpDmg && B.hp === 1) d = Math.round(d * (1 + B.mods.lowHpDmg));
  return d;
}

async function playCard(a) {
  const inst = B.hand[a.i];
  const def = cardDef(inst);
  const chain = B.lastAct === inst.id ? B.chain + 1 : 0;
  B.stats.cards++;
  if (!def.persist) {
    B.hand.splice(a.i, 1);
    if (def.exhaust) { B.exhausted.push(inst); log(`${def.name} — 소멸`, 'dim'); } else B.discard.push(inst);
  }
  H.render();
  if (def.junk) {
    log(`${def.name} — 손에서 치웠다`, 'dim');
    H.sfx.card();
    await wait(160);
    B.lastAct = inst.id; B.chain = 0;
    return;
  }
  if (def.selfHit) {
    B.hp = Math.max(1, B.hp - def.selfHit); B.stats.taken += def.selfHit;
    log(`${def.name} — HP −${def.selfHit}`, 'bad');
    H.render(); await H.fx.playerHit(def.selfHit);
  }
  if (def.back) {
    log(`${def.name} — 이번 루프의 첫 칸으로`);
    B.p = { r: B.loopStartP.r, c: B.loopStartP.c };
    H.sfx.step(); H.fx.hop(); H.render();
    await wait(210);
  }
  if (def.leap && !def.shape) { log(`${def.name} — 도약`); await doMove(a.dir, a.dist || leapOf(def)); }
  if (def.shape) {
    const dmg = cardDamage(def);
    const dir = a.dir || aimFor(def) || 'up';
    const tg = strikeTargets(def.shape, B.p, dir);
    if (dir === 'left' || dir === 'right') B.faceL = dir === 'left';
    B.aim = dir;
    B.firstStrikeUsed = true;
    H.pose('aim', 750);
    await H.fx.cardStrike(tg.cells, def);
    const parts = [], downs = [];
    let dealt = 0;
    if (tg.boss) {
      B.boss.hp = Math.max(0, B.boss.hp - dmg);
      dealt += dmg; B.stats.dealt += dmg;
      H.fx.bossHit(tg.bcols, dmg, dmg >= 15);
      parts.push(`보스 ${dmg}`);
    }
    for (const f of tg.foes) {
      const D = T(f);
      const guarded = !!D.guard && inFront(f, B.p);
      let d0 = guarded ? Math.ceil(dmg * D.guard) : dmg;
      const d = hurtFoe(f, d0, { big: dmg >= 15, guarded });
      dealt += d;
      parts.push(`${D.short} ${d}${guarded ? '(방패)' : ''}`);
      if (def.delay && f.hp > 0) { f.skip = true; f.intent = { kind: 'wait', skipped: true }; }
      if (def.push && f.hp > 0) await pushFoe(f, dir, def.push);
      if (f.hp <= 0) downs.push(f);
    }
    H.sfx.hit(dmg >= 15);
    log(`${def.name} — ${parts.join(' · ') || '빗나감'}`);
    H.render();
    for (const f of downs) { await foeDown(f); if (B.over) return; }
    if (await checkWin()) return;
    if (tg.boss) {
      if (!B.lowBarked && B.boss.hp <= B.boss.max * 0.3) { B.lowBarked = true; H.bark('low'); }
      bossPhaseCheck();
      if (def.bossOl) addBossOl(def.bossOl);
    }
    const ol = (def.ol || 0) + (def.rapid ? def.rapid * chain : 0);
    if (ol) addOverload(ol, def.rapid && chain ? `${def.name} ${chain + 1}연사` : def.name);
    H.render();
    await wait(230);
  }
  if (def.delayAll) {
    for (const f of liveFoes()) { f.skip = true; f.intent = { kind: 'wait', skipped: true }; }
    log(`${def.name} — 모든 적이 다음 행동을 건너뛴다`, 'ok');
    H.fx.timeStop(); H.render();
    await wait(260);
  }
  if (def.shield) {
    B.shield = Math.min(B.shieldCap, B.shield + def.shield);
    log(`${def.name} — 실드 ${B.shield}겹`, 'ok');
    H.sfx.ward(); H.fx.ward(); H.render();
    await wait(220);
  }
  if (def.cool) {
    const before = B.ol;
    B.ol = Math.max(0, B.ol - def.cool);
    if (before !== B.ol) log(`${def.name} — 과부하 ${before} → ${B.ol}`, 'ok');
    H.sfx.cool(); H.render();
    await wait(160);
  }
  if (def.heal) {
    const b = B.hp;
    B.hp = Math.min(B.maxHp, B.hp + def.heal);
    log(`${def.name} — HP +${B.hp - b}`, 'ok');
    H.fx.heal(); H.render();
    await wait(200);
  }
  if (def.draw) {
    let n = 0;
    for (let i = 0; i < def.draw; i++) { if (B.hand.length >= B.handMax) break; if (drawOne()) n++; }
    log(`${def.name} — 카드 ${n}장 뽑기`);
    H.sfx.draw(); H.render();
    await wait(160);
  }
  B.lastAct = inst.id; B.chain = chain;
}

// 밀치기 — 한 칸씩 밀고, 막히면 3 피해
async function pushFoe(f, dir, n) {
  const [dr, dc] = DIRS[dir];
  for (let i = 0; i < n; i++) {
    const r = f.r + dr, c = f.c + dc;
    if (inArea(r, c) && !foeAt(r, c) && !(B.p.r === r && B.p.c === c)) {
      f.r = r; f.c = c;
      if (f.intent && f.intent.kind === 'atk') planFoe(f);   // 밀려나면 다시 겨눈다
      H.render(); await wait(120);
    } else {
      const d = hurtFoe(f, 3, {});
      log(`${T(f).name} — 벽에 부딪혀 ${d} 피해`, 'ok');
      await wait(120);
      break;
    }
  }
}

async function endLoop() { B.amb = null; B.atk = null; H.render(); await wait(200); }

// 전투 중 이야기 (정예 · 보스 전투에만 대본이 있다)
export function queueInterlude(key) {
  const scripts = B.enc.interludes;
  if (!B.started || B.seen.has(key) || !scripts || !scripts[key]) return;
  B.seen.add(key);
  B.pendingScenes.push(key);
}
async function flushInterludes() {
  while (B.pendingScenes.length && !B.over) {
    const key = B.pendingScenes.shift();
    if (H.onInterlude) H.onInterlude(key);
    await H.scene(B.enc.interludes[key]);
  }
}

async function victory() {
  B.over = true; B.won = true; B.sel = null; B.hover = null; B.inspect = null;
  H.sfx.win(); H.render(); H.bark('win');
  if (B.mode === 'boss') await H.fx.bossDown(); else await wait(500);
  if (B.onEnd) B.onEnd(true);
}
async function defeat() {
  B.over = true; B.sel = null; B.hover = null; B.inspect = null;
  H.sfx.lose(); H.render(); H.bark('lose');
  await H.fx.playerDown();
  if (B.onEnd) B.onEnd(false);
}

// 개발 · 시험용 — 적 하나 처치 / 즉시 승리
export async function debugKill() { const f = liveFoes()[0]; if (f) await run(async () => { await foeDown(f); if (!B.over) await checkWin(); }); }
export async function debugLose() { await run(async () => { B.hp = 0; await defeat(); }); }
// 시험용 — 보스 체력을 비율로 깎고 단계를 판정한다 (단계 대사까지)
export async function debugHurtBoss(frac) { await run(async () => { if (!B.boss) return; B.boss.hp = Math.max(1, Math.floor(B.boss.max * frac)); bossPhaseCheck(); H.render(); await flushInterludes(); }); }
export async function debugWin() { await run(async () => { if (B.boss) B.boss.hp = 0; for (const f of liveFoes()) { f.hp = 0; f.gone = true; } await victory(); }); }
export const helpers = HELP;
