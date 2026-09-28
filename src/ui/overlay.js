// 알림 · 확인 창 · 시트 · 툴팁
import { $, el, esc } from '../core/util.js';
import { toStage } from './stage.js';
import { SFX } from './sfx.js';
import { typeInto } from './typewriter.js';

let toastTimer = 0;
export function toast(msg, tone = '') {
  const t = $('#toast');
  if (!t) return;
  typeInto(t, esc(msg), { mul: 0.3, cursor: false });
  t.className = 'toast' + (tone ? ' ' + tone : '');
  t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 1700);
}

// 확인 창 — 버튼을 누르면 그 값으로 끝난다. Esc = 마지막 버튼(보통 취소)
let modalOpen = null;
export const isModalOpen = () => !!modalOpen;
export function confirmBox({ title, text = '', buttons = [{ label: '확인', value: true, main: true }, { label: '취소', value: false }], html = false }) {
  return new Promise(res => {
    closeModal();
    const box = el(`<div class="modal" role="dialog" aria-modal="true">
      <div class="modal-box">
        ${title ? `<h3>${esc(title)}</h3>` : ''}
        ${text ? `<p>${html ? text : esc(text)}</p>` : ''}
        <div class="m-btns">${buttons.map((b, i) => `<button type="button" class="${b.main ? 'btn-main' : 'btn-sub'}${b.danger ? ' danger' : ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div>
      </div></div>`);
    const done = v => { if (modalOpen !== box) return; box.remove(); modalOpen = null; res(v); };
    box.addEventListener('click', e => {
      const b = e.target.closest('button[data-i]');
      if (b) { SFX.click(); done(buttons[+b.dataset.i].value); }
    });
    box._esc = () => done(buttons[buttons.length - 1].value);
    box._enter = () => { const m = buttons.findIndex(b => b.main); done(buttons[m >= 0 ? m : 0].value); };
    $('#app').appendChild(box);
    modalOpen = box;
    const first = box.querySelector('.btn-main') || box.querySelector('button');
    if (first) first.focus({ preventScroll: true });
  });
}
export function closeModal() { if (modalOpen) { const m = modalOpen; modalOpen = null; m.remove(); } }
export function modalKey(e) {
  if (!modalOpen) return false;
  if (e.key === 'Escape') { e.preventDefault(); modalOpen._esc(); }
  return true;   // 창이 떠 있는 동안 다른 입력은 막는다 (Enter는 포커스된 버튼이 처리)
}

// 시트(덱 보기 · 설정 · 유물 등) — 하나씩만
let sheetOpen = null;
export const isSheetOpen = () => !!sheetOpen;
export function openSheet({ title, sub = '', body, wide = false, onClose }) {
  closeSheet();
  const sh = el(`<div class="sheet"><div class="sheet-panel${wide ? ' wide' : ''}" role="dialog" aria-modal="true">
      <div class="sheet-head"><h3>${esc(title)}</h3>${sub ? `<span class="sh-sub">${sub}</span>` : ''}<button class="icon-btn x" type="button" data-close aria-label="닫기">×</button></div>
      <div class="sheet-body"></div></div></div>`);
  const bodyEl = sh.querySelector('.sheet-body');
  if (typeof body === 'string') bodyEl.innerHTML = body; else if (body) bodyEl.appendChild(body);
  sh.addEventListener('click', e => { if (e.target === sh || e.target.closest('[data-close]')) closeSheet(); });
  sh._onClose = onClose;
  $('#app').appendChild(sh);
  sheetOpen = sh;
  return bodyEl;
}
export function closeSheet() {
  if (!sheetOpen) return;
  const sh = sheetOpen; sheetOpen = null;
  sh.remove();
  if (sh._onClose) sh._onClose();
}
export function sheetKey(e) {
  if (!sheetOpen) return false;
  if (e.key === 'Escape') { e.preventDefault(); closeSheet(); }
  return true;
}

// 툴팁 — 마우스를 올린 요소 옆에. data-tip(HTML) 또는 함수로 내용
let tipEl = null;
export function showTip(html, clientX, clientY) {
  hideTip();
  tipEl = el(`<div class="tip">${html}</div>`);
  $('#app').appendChild(tipEl);
  placeTip(clientX, clientY);
}
export function placeTip(clientX, clientY) {
  if (!tipEl) return;
  const p = toStage(clientX, clientY);
  const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let x = p.x + 18, y = p.y + 18;
  if (x + w > 1900) x = p.x - w - 18;
  if (y + h > 1060) y = p.y - h - 18;
  tipEl.style.left = Math.max(10, x) + 'px';
  tipEl.style.top = Math.max(10, y) + 'px';
}
export function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }

// 요소 안의 [data-tip] 들에 툴팁 붙이기 (내용은 getHtml(target))
export function bindTips(root, getHtml) {
  root.addEventListener('pointerover', e => {
    const t = e.target.closest('[data-tip]');
    if (!t || !root.contains(t) || e.pointerType !== 'mouse') return;
    const html = getHtml ? getHtml(t) : t.dataset.tip;
    if (html) showTip(html, e.clientX, e.clientY);
  });
  root.addEventListener('pointermove', e => { if (tipEl) placeTip(e.clientX, e.clientY); });
  root.addEventListener('pointerout', e => {
    const t = e.target.closest('[data-tip]');
    if (t && !t.contains(e.relatedTarget)) hideTip();
  });
}
