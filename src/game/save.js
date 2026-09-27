// 저장 — 이어 하기(늘 자동) · 재귀 지점(챕터 시작 자동 + 지도에서 직접, 횟수 제한)
import { read, write, remove } from '../core/store.js';
import { RUN, setRun } from './run.js';
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
export function hasSave() { const r = read(AUTO); return !!(r && r.v === 1 && r.name); }
export function peekSave() { const r = read(AUTO); return r && r.v === 1 ? r : null; }
export function loadAuto() {
  const r = read(AUTO);
  if (!r || r.v !== 1) return null;
  setRun(r);
  resetClock();
  return r;
}

// 재귀 지점 새기기 — 챕터 시작(자동)이면 횟수를 쓰지 않는다
export function writeRecur({ manual = false } = {}) {
  if (!RUN) return false;
  if (manual) {
    if (RUN.saves.left <= 0) return false;
    RUN.saves.left--;
    RUN.stats.saves++;
  }
  stampPlayTime();
  const snap = deepCopy(RUN);
  snap.pending = null; snap.reward = null; snap.fallen = false; snap.cleared = 0;
  write(RECUR, snap);
  write(AUTO, RUN);
  return true;
}
export function hasRecur() { return !!read(RECUR); }

// 재귀 — 마지막 저장으로. 통계 · 재귀 횟수 · 본 이야기 · 플레이 시간은 이어 간다
export function rewind() {
  const snap = read(RECUR);
  if (!snap) return false;
  stampPlayTime();
  const keep = { stats: RUN.stats, recur: (RUN.recur || 0) + 1, playMs: RUN.playMs, seen: RUN.flags.seen, tutorial: RUN.flags.tutorial };
  const r = deepCopy(snap);
  r.stats = keep.stats; r.stats.deaths++;
  r.recur = keep.recur;
  r.playMs = keep.playMs;
  r.flags.seen = Object.assign({}, r.flags.seen, keep.seen);
  r.flags.tutorial = Object.assign({}, r.flags.tutorial, keep.tutorial);
  r.pending = null; r.reward = null; r.fallen = false; r.cleared = 0;
  setRun(r);
  write(AUTO, r);
  return true;
}

export function clearRun() { remove(AUTO); remove(RECUR); setRun(null); }
