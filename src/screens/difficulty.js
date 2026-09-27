// 난이도 — 시계 바늘로 I~XII 중 하나를 고른다 → 프롤로그(01 회상 · 02 각성) → 1장 지도 (이름은 04에서)
import { register, go } from '../ui/router.js';
import { DIFFS, diffMods } from '../data/difficulty.js';
import { roman } from '../core/util.js';
import { SFX } from '../ui/sfx.js';
import { newRun, RUN, BASE_HP } from '../game/run.js';
import { playScene } from '../scenes/scene.js';
import { PROLOGUE, PROLOGUE_CAST } from '../data/story/prologue.js';
import { CH1_CAST } from '../data/story/ch1.js';
import { storyArtKeys } from '../ui/foeart.js';
import { startChapter } from '../game/flow.js';
import { resetClock } from '../game/save.js';
import { loadAll } from '../ui/assets.js';

let root = null, sel = 1;

function mount(holder) {
  root = holder;
  sel = 1;
  let face = '<svg class="face" viewBox="0 0 760 760" aria-hidden="true"><circle class="rim" cx="380" cy="380" r="370"/><circle class="rim2" cx="380" cy="380" r="300"/>';
  for (let i = 0; i < 60; i++) {
    const a = i / 60 * Math.PI * 2, big = i % 5 === 0;
    const r1 = 350, r2 = big ? 322 : 336;
    face += `<line class="tick${big ? ' big' : ''}" x1="${380 + Math.cos(a) * r1}" y1="${380 + Math.sin(a) * r1}" x2="${380 + Math.cos(a) * r2}" y2="${380 + Math.sin(a) * r2}"/>`;
  }
  face += '</svg>';
  let nums = '';
  for (let i = 1; i <= 12; i++) {
    const a = i / 12 * Math.PI * 2 - Math.PI / 2;
    nums += `<button class="df-num${i >= 9 ? ' hard' : ''}" type="button" data-d="${i}" style="left:${380 + Math.cos(a) * 250}px;top:${380 + Math.sin(a) * 250}px" aria-label="난이도 ${roman(i)}">${roman(i)}</button>`;
  }
  holder.innerHTML = `
    <div class="df-head"><h2>시각을 고르세요</h2><p>바늘이 가리키는 시각이 난이도예요. I이 가장 쉽고, XII가 가장 어려워요. 규칙은 시각이 늦을수록 하나씩 쌓여요.</p></div>
    <div class="df-clock">${face}${nums}<div class="df-hand" id="dfHand"><i></i></div><div class="df-hub"></div></div>
    <div class="df-panel">
      <div class="df-title"><b id="dfNum">I</b><span id="dfName"></span></div>
      <dl class="df-stats" id="dfStats"></dl>
      <ul class="df-rules" id="dfRules"></ul>
      <div class="df-btns"><button class="btn-main" type="button" id="dfGo">이 시각에 깨어난다</button><button class="btn-sub" type="button" id="dfBack">돌아가기</button></div>
    </div>`;
  holder.querySelector('.df-clock').addEventListener('click', e => { const b = e.target.closest('.df-num'); if (b) pick(+b.dataset.d); });
  holder.querySelector('#dfGo').addEventListener('click', start);
  holder.querySelector('#dfBack').addEventListener('click', () => { SFX.click(); go('title'); });
  pick(1, true);
}

const NAMES = ['', '처음 깨어난 시각', '조금 늦은 시각', '재귀가 줄어드는 시각', '정예가 날카로워지는 시각', '쉬기 어려운 시각', '감시가 짙은 시각', '값이 오르는 시각', '몸이 약한 시각', '보스가 단단한 시각', '쉴 곳이 없는 시각', '폭격이 넓은 시각', '열두 시 — 가장 늦은 시각'];
function pick(d, quiet) {
  sel = Math.max(1, Math.min(12, d));
  if (!quiet) SFX.tick();
  root.querySelectorAll('.df-num').forEach(b => b.classList.toggle('on', +b.dataset.d === sel));
  root.querySelector('#dfHand').style.rotate = `${sel * 30}deg`;
  root.querySelector('#dfNum').textContent = roman(sel);
  root.querySelector('#dfName').textContent = NAMES[sel];
  const m = diffMods(sel);
  root.querySelector('#dfStats').innerHTML = `<div><dt>적 체력</dt><dd>${Math.round(m.foeHp * 100)}%</dd></div><div><dt>재귀 저장 (챕터마다)</dt><dd>${m.saves}번</dd></div><div><dt>시작 HP</dt><dd>${BASE_HP + m.maxHp}</dd></div>`;
  const rules = ['<li class="base"><b>I</b>기본 — 재귀 저장 6번 · HP 5</li>'];
  for (let i = 2; i <= sel; i++) rules.push(`<li class="${i === sel ? 'new' : ''}"><b>${roman(i)}</b>${DIFFS[i].rule}</li>`);
  root.querySelector('#dfRules').innerHTML = rules.slice(-8).join('');
}

let starting = false;
async function start() {
  if (starting) return;
  starting = true;
  SFX.save();
  newRun({ name: '', diff: sel });
  resetClock();
  await go('prologue');
  starting = false;
}

function onKey(e) {
  if (e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.code === 'KeyD' || e.code === 'KeyW') { e.preventDefault(); pick(sel % 12 + 1); return true; }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowDown' || e.code === 'KeyA' || e.code === 'KeyS') { e.preventDefault(); pick((sel + 10) % 12 + 1); return true; }
  if (e.key === 'Enter') { e.preventDefault(); start(); return true; }
  if (e.key === 'Escape') { go('title'); return true; }
  return false;
}

register('difficulty', { mount, onKey });

// 프롤로그 — 01 작업실의 마지막 손님(회상) → 02 숨을 쉬는 순서(각성) → 1장 지도
// 이름은 아직 정하지 않는다 — 04에서 마르트가 접힌 그림을 꺼낼 때 (그 전까지 이름 칸은 ???)
register('prologue', {
  async mount(holder) {
    holder.style.background = '#000';
    await new Promise(r => setTimeout(r, 300));
    const cast = Object.assign({}, CH1_CAST, PROLOGUE_CAST);
    await loadAll(storyArtKeys(PROLOGUE, cast));
    await playScene(PROLOGUE, { cast, onName: n => { RUN.name = n; } });
    startChapter(1);
  },
});
