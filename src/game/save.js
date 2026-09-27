// 저장 — 이어 하기(늘 자동) · 재귀 지점(챕터 시작 · 이야기 전투 직전 · 보스 앞은 자동 + 지도에서 직접, 횟수 제한)
import { read, write, remove } from '../core/store.js';
import { RUN, setRun, SAVE_V } from './run.js';
import { deepCopy } from '../core/util.js';

const AUTO = 'run.auto.v1';
const RECUR = 'run.recur.v1';

let lastTick = performance.now();
function stampPlayTime() {
  const now = performance.now();
  if (RUN) RUN.playMs = (RUN.playMs || 0) + Math.min(now - lastTick, 60000);   // 오래 비운 시간은 빼고
  lastTick = now;
}
export function resetClock() { lastTick = performance.now(); }

export function autosave() {
  if (!RUN) return;
  stampPlayTime();
  write(AUTO, RUN);
}
export function hasSave() { const r = read(AUTO); return !!(r && r.v === SAVE_V && r.name); }
export function peekSave() { const r = read(AUTO); return r && r.v === SAVE_V ? r : null; }
// 예전 판의 여정 (1장 지도가 대본대로 바뀌기 전) — 이어 할 수 없어서 타이틀에서 알려 주고 지운다
export function oldSave() { const r = read(AUTO); return !!(r && r.v !== SAVE_V); }
export function loadAuto() {
  const r = read(AUTO);
  if (!r || r.v !== SAVE_V) return null;
  r.items = r.items || { potion: 0, kit: 0 };
  setRun(r);
  resetClock();
  return r;
}

// 재귀 지점 새기기 — 자동(챕터 시작 · 이야기 전투 직전 · 보스 앞)이면 횟수를 쓰지 않는다
// at = 칸 id — 재귀하면 지도가 아니라 그 칸으로 곧장 돌아간다 (이야기 전투는 전투 시작으로, 보스는 보스 앞 대화로)
export function writeRecur({ manual = false, at = null } = {}) {
  if (!RUN) return false;
  if (manual) {
    if (RUN.saves.left <= 0) return false;
    RUN.saves.left--;
    RUN.stats.saves++;
  }
  stampPlayTime();
  const snap = deepCopy(RUN);
  snap.pending = at || null; snap.reward = null; snap.fallen = false; snap.cleared = 0;
  write(RECUR, snap);
  write(AUTO, RUN);
  return true;
}
export function hasRecur() { const r = read(RECUR); return !!(r && r.v === SAVE_V); }

// 재귀 — 마지막 저장으로. 통계 · 재귀 횟수 · 본 이야기 · 플레이 시간은 이어 간다
export function rewind() {
  const snap = read(RECUR);
  if (!snap || snap.v !== SAVE_V) return false;
  stampPlayTime();
  const keep = { stats: RUN.stats, recur: (RUN.recur || 0) + 1, playMs: RUN.playMs, seen: RUN.flags.seen, tutorial: RUN.flags.tutorial };
  const r = deepCopy(snap);
  r.stats = keep.stats; r.stats.deaths++;
  r.recur = keep.recur;
  r.playMs = keep.playMs;
  r.flags.seen = Object.assign({}, r.flags.seen, keep.seen);
  r.flags.tutorial = Object.assign({}, r.flags.tutorial, keep.tutorial);
  r.reward = null; r.fallen = false; r.cleared = 0;   // pending은 재귀 지점 그대로 (이야기 전투 · 보스 앞이면 그 칸)
  r.items = r.items || { potion: 0, kit: 0 };
  setRun(r);
  write(AUTO, r);
  return true;
}

export function clearRun() { remove(AUTO); remove(RECUR); setRun(null); }
