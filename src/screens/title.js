// 타이틀 — 이어 하기 · 새 게임 · 설정 · 규칙
import { register, go } from '../ui/router.js';
import { icon } from '../ui/icons.js';
import { art } from '../ui/assets.js';
import { hasSave, peekSave, loadAuto, clearRun } from '../game/save.js';
import { confirmBox } from '../ui/overlay.js';
import { openSettings, openHelp, toggleSound } from '../ui/menus.js';
import { SFX, initAudio } from '../ui/sfx.js';
import { roman, esc } from '../core/util.js';
import { CHAPTERS } from '../data/chapters.js';
import { resumeRun } from '../game/flow.js';

let root = null, focus = 0;
const fmtTime = ms => { const m = Math.floor((ms || 0) / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };

function clockSVG() {
  let s = '<svg class="ti-clock" viewBox="0 0 1040 1040" aria-hidden="true"><circle cx="520" cy="520" r="500" stroke-width="3"/><circle cx="520" cy="520" r="440" stroke-width="1.5"/>';
  for (let i = 1; i <= 12; i++) {
    const a = i / 12 * Math.PI * 2 - Math.PI / 2;
    s += `<text x="${520 + Math.cos(a) * 380}" y="${520 + Math.sin(a) * 380}">${roman(i)}</text>`;
  }
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2;
    const r1 = 440, r2 = i % 5 === 0 ? 470 : 456;
    s += `<line x1="${520 + Math.cos(a) * r1}" y1="${520 + Math.sin(a) * r1}" x2="${520 + Math.cos(a) * r2}" y2="${520 + Math.sin(a) * r2}" stroke="#E8D2A0" stroke-width="${i % 5 === 0 ? 4 : 1.5}"/>`;
  }
  s += '<line class="h" x1="520" y1="520" x2="520" y2="300" stroke-width="16"/><line class="m" x1="520" y1="560" x2="520" y2="160" stroke-width="6"/><circle cx="520" cy="520" r="18" fill="#E8D2A0"/></svg>';
  return s;
}

function mount(holder) {
  root = holder;
  const save = hasSave() ? peekSave() : null;
  const hero = art('hero');
  const saveSub = save ? `${esc(save.name || '???')} · ${CHAPTERS[save.chapter] ? `${roman(save.chapter)}장 ${CHAPTERS[save.chapter].title}` : `${roman(save.chapter)}장 (준비 중)`} · 난이도 ${roman(save.diff)} · ${fmtTime(save.playMs)}` : '저장된 여정이 없어요';
  holder.innerHTML = `${clockSVG()}
    <div class="ti-art">${hero ? `<img src="${hero}" alt="" draggable="false">` : ''}</div>
    <div class="ti-menu">
      <div class="logo" aria-label="I — XII"><span>I</span><i></i><span>XII</span></div>
      <p class="logo-sub">열두 개의 시(時)를 되찾는 이야기</p>
      <div class="ti-btns">
        ${save ? `<button class="ti-btn main" data-a="continue" type="button">${icon('play')}<span><b>이어 하기</b><small>${saveSub}</small></span></button>` : ''}
        <button class="ti-btn${save ? '' : ' main'}" data-a="new" type="button">${icon('hourglass')}<span><b>새 게임</b><small>${save ? '지금 여정을 지우고 처음부터' : '난이도를 고르고 깨어난다'}</small></span></button>
        <button class="ti-btn" data-a="settings" type="button">${icon('gear')}<span><b>설정</b><small>소리 · 글자 속도 · 화면 흔들림 · 튜토리얼</small></span></button>
        <button class="ti-btn" data-a="help" type="button">${icon('help')}<span><b>규칙과 조작</b><small>톱니 지도 · 전투 · 재귀</small></span></button>
      </div>
    </div>
    <p class="ti-foot"><b>I — XII</b> · 1장 「재귀」까지 · 스팀(PC) 1920×1080 · 소리 <b>M</b></p>`;
  holder.querySelector('.ti-btns').addEventListener('click', e => { const b = e.target.closest('.ti-btn'); if (b) doAction(b.dataset.a); });
  holder.querySelector('.ti-btns').addEventListener('pointerover', e => { if (e.target.closest('.ti-btn')) SFX.hover(); });
  focus = 0;
}

async function doAction(a) {
  initAudio();
  SFX.click();
  if (a === 'continue') {
    const r = loadAuto();
    if (!r) { go('title'); return; }
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
  if (a === 'settings') openSettings();
  if (a === 'help') openHelp();
}

function onKey(e) {
  const btns = [...root.querySelectorAll('.ti-btn')];
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    focus = (focus + (e.key === 'ArrowDown' ? 1 : -1) + btns.length) % btns.length;
    btns.forEach((b, i) => b.classList.toggle('focus', i === focus));
    SFX.hover();
    return true;
  }
  if (e.key === 'Enter' || e.code === 'Space') { e.preventDefault(); const b = btns[focus]; if (b) doAction(b.dataset.a); return true; }
  if (e.code === 'KeyM') { toggleSound(); return true; }
  if (e.code === 'KeyH') { openHelp(); return true; }
  return false;
}

register('title', { mount, onKey });
