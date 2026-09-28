// 무대(1920×1080)를 창 크기에 맞춰 비율 그대로 확대·축소 — 남는 곳은 검은 여백
import { $ } from '../core/util.js';

export const STAGE_W = 1920, STAGE_H = 1080;
export function fitStage() {
  const s = Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H);
  $('#app').style.setProperty('--scale', s.toFixed(4));
}
export function stageScale() {
  return Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H) || 1;
}
// 화면 좌표(clientX/Y) → 무대 좌표
export function toStage(x, y) {
  const r = $('#app').getBoundingClientRect();
  const s = r.width / STAGE_W || 1;
  return { x: (x - r.left) / s, y: (y - r.top) / s };
}
