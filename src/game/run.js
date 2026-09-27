// 한 판(런)의 상태 — 덱 · 유물 · 이식 · HP · 부품 · 톱니 조각 · 경계도 · 지도 위치
import { STARTER, CARDS, canUpgrade } from '../data/cards.js';
import { RELICS, IMPLANTS } from '../data/relics.js';
import { diffMods } from '../data/difficulty.js';
import { CHAPTERS } from '../data/chapters.js';
import { ITEMS } from '../data/items.js';
import { clamp } from '../core/util.js';

export const BASE_HP = 5;
export const SAVE_V = 2;   // 저장 판 — 2: 1장이 최종 대본(이야기 칸 · 가방 · 경계 단계)으로 바뀐 판. 예전 판은 이어 할 수 없다
export let RUN = null;
export function setRun(r) { RUN = r; }

export function newRun({ name, diff }) {
  const d = diffMods(diff);
  const base = BASE_HP + d.maxHp;
  RUN = {
    v: SAVE_V,
    seed: (Math.random() * 2 ** 32) >>> 0,
    diff: d.level, name,
    created: Date.now(), playMs: 0,
    chapter: 1,
    hp: base, maxHpBase: base,
    parts: 40, shards: 0,
    deck: STARTER.map((id, i) => ({ uid: i + 1, id, up: 0 })), uidSeq: STARTER.length,
    relics: [], implants: [],
    alert: 0,
    items: { potion: 0, kit: 0 },   // 가방 — 회복약 · 정비 부품
    goal: '',                        // 지도 위 목표 한 줄 (이야기가 갱신)
    saves: { left: d.saves, max: d.saves },
    map: null, pos: null, visited: [],
    pending: null,          // 들어간 칸 (전투 중에 끄면 이어 할 때 그 칸을 처음부터)
    reward: null,           // 받을 전리품 (승리 대사 · 보상 화면에서 끄면 이어 할 때 그 자리로)
    fallen: false,          // 쓰러짐 (재귀 연출 중에 끄면 이어 할 때 재귀로)
    cleared: 0,             // 보스를 쓰러뜨린 장 (챕터 끝 화면에서 끄면 이어 할 때 그 화면으로)
    flags: { lore: {}, tutorial: {}, seen: {}, shortcut: false },
    stats: { battles: 0, elites: 0, deaths: 0, kills: 0, dealt: 0, taken: 0, saves: 0 },
    recur: 0,               // 재귀한 횟수 (전투 속 무작위를 바꾸는 데 씀)
    removeCost: 60,
  };
  return RUN;
}

export const chapterDef = () => CHAPTERS[RUN.chapter] || null;
export const dm = () => diffMods(RUN.diff);

// 유물 · 이식에서 오는 수치를 합친다
const ADD_KEYS = ['maxHp', 'handMax', 'handRefill', 'olMax', 'freezeCost', 'shieldCap', 'ambushCells', 'restHeal', 'leapPlus', 'allDmg', 'firstStrike', 'shardBonus', 'forgeFree', 'deathWard', 'costPerLoop', 'lowHpDmg'];
const MUL_KEYS = ['alertMul', 'shopMul', 'nailOlMul', 'elitePartsMul', 'bossOlMul'];
export function mods() {
  const m = { kindDmg: {}, on: [] };
  ADD_KEYS.forEach(k => { m[k] = 0; });
  MUL_KEYS.forEach(k => { m[k] = 1; });
  const srcs = [...RUN.relics.map(id => RELICS[id]), ...RUN.implants.map(id => IMPLANTS[id])].filter(Boolean);
  for (const s of srcs) {
    const x = s.mods || {};
    ADD_KEYS.forEach(k => { if (x[k]) m[k] += x[k]; });
    MUL_KEYS.forEach(k => { if (x[k]) m[k] *= x[k]; });
    if (x.kindDmg) for (const [k, v] of Object.entries(x.kindDmg)) m.kindDmg[k] = (m.kindDmg[k] || 0) + v;
    if (s.on) m.on.push(s.on);
  }
  return m;
}

export const maxHp = () => Math.max(1, RUN.maxHpBase + mods().maxHp);
export function fixHp() { RUN.hp = clamp(RUN.hp, 0, maxHp()); }

// ── 자원
export function gainParts(n) { RUN.parts = Math.max(0, RUN.parts + Math.round(n)); }
export function gainShards(n) { RUN.shards = Math.max(0, RUN.shards + n); }
export function heal(n) { const before = RUN.hp; RUN.hp = clamp(RUN.hp + n, 0, maxHp()); return RUN.hp - before; }
export function hurt(n) { RUN.hp = Math.max(0, RUN.hp - n); RUN.stats.taken += n; return RUN.hp; }

// 경계도 — 오를 때만 배율(난이도 · 유물)을 곱한다
export function addAlert(n) {
  const before = RUN.alert;
  const v = n > 0 ? n * dm().alertMul * mods().alertMul : n;
  RUN.alert = clamp(Math.round(RUN.alert + v), 0, 100);
  return RUN.alert - before;
}
// 경계 단계 — 게이지 0~100을 0 · 1 · 2 세 단계로 (대본의 '경계도 +1' = 한 단계, 최대 2)
export const ALERT_STAGE_AT = [0, 34, 67];
export const alertStage = (v = RUN.alert) => (v >= ALERT_STAGE_AT[2] ? 2 : v >= ALERT_STAGE_AT[1] ? 1 : 0);
export function alertStageUp() {
  const s = alertStage();
  if (s >= 2) return 0;
  const before = RUN.alert;
  RUN.alert = Math.max(RUN.alert, ALERT_STAGE_AT[s + 1]);
  return RUN.alert - before;
}
// 휴식 습격 확률 — 단계마다 15 · 25 · 35% (+ 난이도 X부터 +10%p). 회복을 먼저 한 뒤 판정한다
export const restAmbushChance = () => Math.min(0.9, [0.15, 0.25, 0.35][alertStage()] + (dm().restAmbush || 0));

// ── 가방
export const bag = () => (RUN.items = RUN.items || { potion: 0, kit: 0 });
export function addItem(id, n = 1) { const b = bag(); b[id] = Math.max(0, (b[id] || 0) + n); return b[id]; }
// 지도 · 칸 화면에서 회복약 — 코스트 없음. 회복한 만큼 돌려준다 (가득 차 있으면 쓰지 않는다)
export function usePotion() {
  const b = bag();
  if (!b.potion || RUN.hp >= maxHp()) return 0;
  b.potion--;
  return heal(ITEMS.potion.heal);
}

// ── 덱
export function addCard(id, up = 0) {
  if (!CARDS[id]) return null;
  const inst = { uid: ++RUN.uidSeq, id, up: up ? 1 : 0 };
  RUN.deck.push(inst);
  return inst;
}
export function removeCard(uid) {
  const i = RUN.deck.findIndex(c => c.uid === uid);
  if (i < 0) return null;
  return RUN.deck.splice(i, 1)[0];
}
export function upgradeCard(uid) {
  const c = RUN.deck.find(x => x.uid === uid);
  if (!c || !canUpgrade(c)) return false;
  c.up = 1;
  return true;
}

// ── 유물 · 이식
export function addRelic(id) {
  if (!RELICS[id] || RUN.relics.includes(id)) return false;
  const before = maxHp();
  RUN.relics.push(id);
  const d = maxHp() - before;
  if (d > 0) RUN.hp += d; else fixHp();
  return true;
}
export function addImplant(id) {
  if (!IMPLANTS[id] || RUN.implants.includes(id)) return false;
  const before = maxHp();
  RUN.implants.push(id);
  const d = maxHp() - before;
  if (d > 0) RUN.hp += d;
  return true;
}
export const hasRelic = id => RUN.relics.includes(id);
