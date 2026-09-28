// 타이틀 — 폐허 도시 그림 위 오른쪽에 Start · Settings · Credits · Exit (나무판)
// Start: 저장이 있으면 Continue · New Game 중에서, 없으면 바로 난이도로
import { register, go } from '../ui/router.js';
import { bgImgHTML } from '../ui/assets.js';
import { hasSave, peekSave, loadAuto, clearRun, oldSave } from '../game/save.js';
import { confirmBox } from '../ui/overlay.js';
import { openSettings, openHelp, toggleSound } from '../ui/menus.js';
import { SFX, initAudio } from '../ui/sfx.js';
import { roman, esc } from '../core/util.js';
import { CHAPTERS } from '../data/chapters.js';
import { CREDITS } from '../data/credits.js';
import { resumeRun } from '../game/flow.js';

let root = null, focus = 0, page = 'main';
const fmtTime = ms => { const m = Math.floor((ms || 0) / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };

const MAIN = [['start', 'Start'], ['settings', 'Settings'], ['credits', 'Credits'], ['exit', 'Exit']];
const START = [['continue', 'Continue'], ['new', 'New Game'], ['back', 'Back']];

function saveLine() {
  const s = hasSave() ? peekSave() : null;
  if (!s) return '';
  const ch = CHAPTERS[s.chapter] ? `${s.chapter}장 「${CHAPTERS[s.chapter].title}」` : `${s.chapter}장 (준비 중)`;
  // 이름 · 장 / 난이도 · 시간 / 지금 목표 — 줄마다 나눠서 (좁은 메뉴 폭에서 글이 어중간하게 꺾이지 않게. 쉬었다 와도 어디까지 왔는지 바로 알게)
  const goal = s.goal && CHAPTERS[s.chapter] && !s.cleared ? `<small>목표 — ${esc(s.goal)}</small>` : '';
  return `<span>${esc(s.name || '???')} · ${ch}</span><span>난이도 ${roman(s.diff)} · ${fmtTime(s.playMs)}</span>${goal}`;
}

function menuHTML(items) {
  return items.map(([a, label], i) => `<button class="ti-item" type="button" data-a="${a}" style="--i:${i}"><span>${label}</span></button>`
    + (a === 'continue' ? `<p class="ti-save">${saveLine()}</p>` : '')).join('');
}
function showPage(p) {
  page = p;
  const box = root.querySelector('#tiMenu');
  box.innerHTML = menuHTML(p === 'start' ? START : MAIN);
  box.dataset.page = p;
  setFocus(0, false);
}
function setFocus(i, sound = true) {
  const items = [...root.querySelectorAll('.ti-item')];
  if (!items.length) return;
  focus = (i + items.length) % items.length;
  items.forEach((b, k) => b.classList.toggle('on', k === focus));
  if (sound) SFX.hover();
}

function mount(holder) {
  root = holder;
  SFX.bed('title');   // 오르골 가락 (소리를 켜기 전이면 처음 누를 때부터)
  holder.innerHTML = `${bgImgHTML('bg-title', 'ti-bg')}<div class="ti-shade"></div>
    <div class="ti-logo" aria-label="I — XII"><div class="logo"><span>I</span><i></i><span>XII</span></div><p class="logo-sub">열두 개의 시(時)를 되찾는 이야기</p></div>
    <nav class="ti-menu" id="tiMenu" aria-label="메뉴"></nav>
    <p class="ti-foot"><kbd>↑</kbd><kbd>↓</kbd> 고르기 · <kbd>Enter</kbd> 들어가기 · <kbd>H</kbd> 규칙과 조작 · <kbd>M</kbd> 소리</p>
    <div class="ti-credits" id="tiCredits" hidden></div>`;
  const menu = holder.querySelector('#tiMenu');
  menu.addEventListener('click', e => { const b = e.target.closest('.ti-item'); if (b) doAction(b.dataset.a); });
  menu.addEventListener('pointerover', e => {
    const b = e.target.closest('.ti-item');
    if (!b) return;
    const i = [...menu.querySelectorAll('.ti-item')].indexOf(b);
    if (i !== focus) setFocus(i);
  });
  holder.querySelector('#tiCredits').addEventListener('click', e => { if (e.target.closest('[data-close]') || e.target.id === 'tiCredits') closeCredits(); });
  showPage('main');
}

async function doAction(a) {
  initAudio();
  SFX.click();
  if (a === 'start') {
    if (hasSave()) { showPage('start'); return; }
    // 예전 판의 여정 — 1장이 전면 개작본으로 바뀌어 이어 할 수 없다
    if (oldSave()) {
      const ok = await confirmBox({ title: '예전 판의 여정이 있어요', text: '1장 이야기가 새로 쓰여서(전면 개작본) 예전 여정은 이어 할 수 없어요. 새 게임을 시작하면 예전 여정은 지워져요.', buttons: [{ label: '새 게임', value: true, main: true }, { label: '돌아가기', value: false }] });
      if (!ok) return;
      clearRun();
    }
    go('difficulty');
    return;
  }
  if (a === 'back') { showPage('main'); return; }
  if (a === 'continue') {
    const r = loadAuto();
    if (!r) { showPage('main'); return; }
    resumeRun();
    return;
  }
  if (a === 'new') {
    if (hasSave()) {
      const ok = await confirmBox({ title: '새 게임을 시작할까요?', text: '지금 여정과 재귀 지점이 모두 지워져요.', buttons: [{ label: '처음부터', value: true, main: true, danger: true }, { label: '돌아가기', value: false }] });
      if (!ok) return;
      clearRun();
    }
    go('difficulty');
    return;
  }
  if (a === 'settings') { openSettings(); return; }
  if (a === 'credits') { openCredits(); return; }
  if (a === 'exit') {
    const ok = await confirmBox({ title: '게임을 끝낼까요?', text: '여정은 자동으로 저장돼 있어요.', buttons: [{ label: '끝낸다', value: true, main: true }, { label: '돌아가기', value: false }] });
    if (!ok) return;
    window.close();
    // 브라우저 탭은 스크립트로 닫을 수 없다 — 스팀 판에서는 창이 닫힌다
    setTimeout(() => { if (root) confirmBox({ title: '창을 닫으면 끝나요', text: '브라우저에서는 게임이 탭을 직접 닫을 수 없어요. 탭을 닫아 주세요.', buttons: [{ label: '확인', value: true, main: true }] }); }, 250);
  }
}

// 제작진 — 이름이 비어 있으면 빈 자리(밑줄)
function openCredits() {
  const box = root.querySelector('#tiCredits');
  box.innerHTML = `<div class="tc-board">
    <h3>I — XII</h3><p class="tc-sub">열두 개의 시(時)를 되찾는 이야기</p>
    <dl>${CREDITS.map(c => `<div><dt>${esc(c.role)}</dt><dd>${c.names.length ? c.names.map(esc).join('<br>') : '<span class="tc-blank"></span>'}</dd></div>`).join('')}</dl>
    <button class="btn-sub" type="button" data-close>Back</button></div>`;
  box.hidden = false;
}
function closeCredits() { const box = root.querySelector('#tiCredits'); if (!box.hidden) { box.hidden = true; SFX.click(); } }

function onKey(e) {
  if (!root.querySelector('#tiCredits').hidden) {
    if (e.key === 'Escape' || e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); closeCredits(); }
    return true;
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); setFocus(focus + (e.key === 'ArrowDown' ? 1 : -1)); return true; }
  if (e.key === 'Enter' || e.code === 'Space') {
    e.preventDefault();
    const b = root.querySelectorAll('.ti-item')[focus];
    if (b) doAction(b.dataset.a);
    return true;
  }
  if (e.key === 'Escape' && page === 'start') { SFX.click(); showPage('main'); return true; }
  if (e.code === 'KeyM') { toggleSound(); return true; }
  if (e.code === 'KeyH') { openHelp(); return true; }
  return false;
}

register('title', { mount, onKey, unmount() { root = null; } });
