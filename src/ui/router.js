// 화면 전환 — 한 번에 한 화면. 전환할 때 잠깐 검게 닫았다 연다
import { $, sleep } from '../core/util.js';

const screens = new Map();
let current = null;          // { name, api }
let switching = false;

// api: { mount(root, params) → 선택적으로 Promise, unmount(), onKey(e) → true면 처리함 }
export function register(name, api) { screens.set(name, api); }
export const currentScreen = () => (current ? current.name : null);
export const isSwitching = () => switching;

export async function go(name, params = {}, { fade = true } = {}) {
  const api = screens.get(name);
  if (!api) throw new Error(`없는 화면: ${name}`);
  switching = true;
  const f = $('#fade');
  if (fade && current) { f.classList.add('on'); await sleep(280); }
  if (current && current.api.unmount) { try { current.api.unmount(); } catch (e) { console.error(e); } }
  const root = $('#screen');
  root.innerHTML = '';
  const holder = document.createElement('div');
  holder.className = `screen scr-${name}`;
  root.appendChild(holder);
  current = { name, api };
  let ret = null;
  try { ret = api.mount(holder, params); }
  catch (e) { console.error(e); }
  // 화면을 먼저 보여 주고, 화면 안의 긴 흐름(대사 장면 등)은 그 뒤에 이어진다
  if (fade) { f.classList.remove('on'); }
  switching = false;
  if (ret && typeof ret.then === 'function') {
    try { await ret; } catch (e) { console.error(e); }
  }
}

// 전역 키 입력을 지금 화면에 넘긴다 (창 · 대사 장면이 먼저 가져감)
export function routeKey(e) {
  if (!current || switching) return false;
  return current.api.onKey ? !!current.api.onKey(e) : false;
}
