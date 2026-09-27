// 자주 쓰는 도구 모음
export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

// 연출 대기 — 움직임 줄이기 설정이면 짧게
export const sleep = ms => new Promise(r => setTimeout(r, RM.matches ? ms * 0.35 : ms));
export const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

// 화면에 넣는 사용자 입력(주인공 이름 등)은 반드시 이스케이프
const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ESC[c]);

// 한국어 조사 — 받침 여부로 고른다 (영문 · 숫자는 받침 없음으로 본다)
function hasBatchim(word) {
  const w = String(word ?? '').trim();
  if (!w) return false;
  const ch = w.charCodeAt(w.length - 1) - 0xAC00;
  return ch >= 0 && ch < 11172 && ch % 28 !== 0;
}
export const iga = w => hasBatchim(w) ? '이' : '가';
export const eulreul = w => hasBatchim(w) ? '을' : '를';
export const eunneun = w => hasBatchim(w) ? '은' : '는';
export const irago = w => hasBatchim(w) ? '이라고' : '라고';
export const iya = w => hasBatchim(w) ? '이야' : '야';
export const ah = w => hasBatchim(w) ? '아' : '야';   // 부를 때: 철수야 · 민준아
export const iyeo = w => hasBatchim(w) ? '이여' : '여';   // 신이여 · 크로노스여
export const isiyeo = w => hasBatchim(w) ? '이시여' : '시여';   // 신이시여 · 크로노스시여

// 로마 숫자 (1~13)
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII'];
export const roman = n => ROMAN[n] || String(n);

// 요소 하나를 잠깐 깜빡이게 (클래스를 붙였다 뗀다)
export function flash(el, cls, ms) {
  if (!el) return;
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), ms);
}

// 템플릿 문자열 → 요소
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

export const sum = a => a.reduce((s, v) => s + v, 0);
export const uniq = a => [...new Set(a)];
export const deepCopy = o => JSON.parse(JSON.stringify(o));
