// 플레이어 설정 — 소리 · 글자 속도 · 화면 흔들림 · 튜토리얼
import { read, write } from './store.js';

const KEY = 'settings.v1';
const DEFAULTS = {
  sound: true,
  volume: 0.6,            // 0 ~ 1
  textSpeed: 'normal',    // slow · normal · fast · instant
  autoSpeed: 'normal',    // 자동 넘김 빠르기: slow · normal · fast
  shake: true,            // 화면 흔들림
  tutorial: true,         // 1장 튜토리얼 안내
};
export const TEXT_SPEED = { slow: 48, normal: 30, fast: 14, instant: 0 };   // 글자 하나당 ms
export const AUTO_SPEED = { slow: 1.6, normal: 1, fast: 0.6 };

const saved = read(KEY, {}) || {};
export const SET = Object.assign({}, DEFAULTS, saved);
if (!(SET.textSpeed in TEXT_SPEED)) SET.textSpeed = DEFAULTS.textSpeed;
if (!(SET.autoSpeed in AUTO_SPEED)) SET.autoSpeed = DEFAULTS.autoSpeed;
SET.volume = Math.max(0, Math.min(1, Number(SET.volume) || 0));

const subs = new Set();
export function onSettings(fn) { subs.add(fn); return () => subs.delete(fn); }

export function setSetting(k, v) {
  SET[k] = v;
  write(KEY, SET);
  subs.forEach(fn => fn(k, v));
}
