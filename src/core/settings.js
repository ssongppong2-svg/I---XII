// 플레이어 설정 — 소리(전체 · 배경음) · 글자 속도 · 화면 흔들림 · 튜토리얼
import { read, write } from './store.js';

const KEY = 'settings.v1';
const DEFAULTS = {
  sound: true,
  volume: 0.6,            // 0 ~ 1 (전체)
  music: 0.8,             // 배경음 0 ~ 1 — 화면마다 깔리는 소리 · 음악 · 장면의 배경 소리 (전체 음량에 곱한다)
  textSpeed: 'normal',    // slow · normal · fast · instant
  autoSpeed: 'normal',    // 자동 넘김 빠르기: slow · normal · fast
  battleSpeed: 'normal',  // 전투 연출(적의 움직임 · 타격 · 폭발 사이의 멈춤): normal · fast
  shake: true,            // 화면 흔들림
  tutorial: true,         // 1장 튜토리얼 안내
};
export const TEXT_SPEED = { slow: 48, normal: 30, fast: 14, instant: 0 };   // 글자 하나당 ms
export const AUTO_SPEED = { slow: 1.6, normal: 1, fast: 0.6 };
export const BATTLE_PACE = { normal: 1, fast: 0.55 };                    // 전투 연출의 멈춤 길이 배율

const saved = read(KEY, {}) || {};
export const SET = Object.assign({}, DEFAULTS, saved);
if (!(SET.textSpeed in TEXT_SPEED)) SET.textSpeed = DEFAULTS.textSpeed;
if (!(SET.autoSpeed in AUTO_SPEED)) SET.autoSpeed = DEFAULTS.autoSpeed;
if (!(SET.battleSpeed in BATTLE_PACE)) SET.battleSpeed = DEFAULTS.battleSpeed;
SET.volume = Math.max(0, Math.min(1, Number(SET.volume) || 0));
SET.music = Math.max(0, Math.min(1, Number.isFinite(Number(SET.music)) ? Number(SET.music) : DEFAULTS.music));

const subs = new Set();
export function onSettings(fn) { subs.add(fn); return () => subs.delete(fn); }

export function setSetting(k, v) {
  SET[k] = v;
  write(KEY, SET);
  subs.forEach(fn => fn(k, v));
}
