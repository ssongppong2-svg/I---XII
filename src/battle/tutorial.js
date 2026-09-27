// 튜토리얼 — 1장 이야기 전투 두 번(03 학습 전투 B01 · 06 시장 B02)에 녹인 안내. 해 보면 넘어가고(until), '다음'으로 넘길 수도 있다
// 대본 B01: 이동 · 위험 칸 · 카드 코스트 → 재귀 설명창(03-010 주인공의 한마디 — 안내를 끄면 battle.js가 두 번째 루프에)
import { H } from './core.js';
import { viewRoot } from './view.js';
import { SFX } from '../ui/sfx.js';
import { typeInto } from '../ui/typewriter.js';

const STEPS = {
  1: [
    { title: '이동', until: 'moved', hi: '#board',
      text: '<kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> 또는 옆 칸을 클릭해 한 칸 움직여 보세요. 이동도 카드도 모두 <b>1코스트</b>, 한 루프에 <b>4코스트</b>예요. 턴 종료 버튼은 없어요 — 코스트를 다 쓰면 다음 루프가 시작돼요.' },
    { title: '적의 순번', until: 'next', hi: '#roster',
      text: '적은 <b>2코스트마다</b> 한 번 움직여요. 머리 위 숫자 <b>1</b>은 “내 다음 행동이 끝나면 움직인다”는 뜻. 분홍 표식이 뜬 칸에 공격이 떨어져요 — 그 칸 밖에서 행동을 끝내면 맞지 않아요.' },
    { title: '카드', until: 'card', hi: '#hand',
      text: '카드를 클릭하거나 <kbd>1</kbd>~<kbd>6</kbd>을 눌러 보세요. 공격 카드는 <b>적이 닿는 방향</b>으로 쏴요. 여러 방향이 가능하면 판의 칸을 눌러 조준하고, 한 번 더 누르면 써요.' },
    { title: '재귀', until: 'next', sfx: 'tick', say: true,
      text: '쓰러져도 끝이 아니에요 — <b>재귀</b>. 마지막으로 새긴 <b>재귀 지점</b>으로 돌아가요. 이야기 칸의 전투는 시작하기 직전에, 보스는 들어가는 순간에 저절로 새겨져요(횟수를 쓰지 않아요). 지도의 「저장」으로 직접 새길 수도 있어요.' },
    { title: '처치', until: 'next',
      text: '적을 모두 쓰러뜨리면 승리예요. 이기면 부품과 카드를 얻어요. 적을 누르면(마우스는 올리면) 체력과 다음 행동이 왼쪽에 나와요. 이 안내는 <kbd>H</kbd> 규칙에서 다시 볼 수 있어요.' },
  ],
  2: [
    { title: '기습 폭격', until: 'ambushFired', hi: '#pips',
      text: '빨간 줄은 <b>기습 폭격</b>이에요. 루프의 <b>2번째 행동이 끝나는 순간</b> 터져요. 두 번째 행동은 빨간 줄 밖에서 끝내세요. (코스트 칸의 빨간 표식이 그 순간)' },
    { title: '과부하', until: 'next', hi: '.olw',
      text: '강한 카드는 <b>과부하</b>를 채워요. 100이 되면 4코스트 동안 <b>마비</b> — 눌러도 코스트만 빠지고 제자리예요. 「냉각 성수」로 식힐 수 있어요.' },
    { title: '뽑기', until: 'next', hi: '#drawBtn',
      text: '손패가 모자라면 <kbd>Q</kbd> 또는 오른쪽 아래 뽑기로 <b>1코스트에 한 장</b> 더 뽑아요. 루프가 시작될 때도 3장까지 채워져요.' },
    { title: '코스트 칸의 점', until: 'next', hi: '#pips',
      text: '코스트 칸 아래의 점은 <b>그 행동이 끝난 뒤 움직일 적</b>이에요. 분홍 = 공격, 회색 = 이동. 이 두 가지만 보면 언제 어디가 위험한지 알 수 있어요.' },
  ],
};

let T = null;   // { set, i, onDone, box }

export function startTutorial(n, onDone) {
  stopTutorial();
  const steps = STEPS[n];
  if (!steps) return;
  T = { n, steps, i: 0, onDone };
  H.tut = ev => tutEvent(ev);
  show();
}
export function stopTutorial() {
  if (!T) return;
  clearHi();
  if (T.box) T.box.remove();
  T = null;
  H.tut = () => {};
}
function clearHi() { const r = viewRoot(); if (r) r.querySelectorAll('.tut-hi').forEach(e => e.classList.remove('tut-hi')); }

function show() {
  const root = viewRoot();
  if (!T || !root) return;
  clearHi();
  const s = T.steps[T.i];
  if (!T.box) {
    T.box = document.createElement('div');
    T.box.className = 'tut';
    T.box.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      SFX.click();
      if (b.dataset.a === 'skip') finish(true); else advance();
    });
    root.appendChild(T.box);
  }
  const waiting = s.until !== 'next';
  T.box.innerHTML = `<span class="tut-n">${T.i + 1}/${T.steps.length}</span>
    <div class="tut-b"><b>${s.title}</b><p class="tut-t"></p>${waiting ? '<span class="tut-wait">▶ 직접 해 보세요</span>' : ''}</div>
    <div class="tut-btns"><button type="button" data-a="next">${waiting ? '넘기기' : T.i === T.steps.length - 1 ? '알겠어요' : '다음'}</button><button type="button" class="skip" data-a="skip">안내 끄기</button></div>`;
  T.box.style.animation = 'none'; void T.box.offsetWidth; T.box.style.animation = '';
  typeInto(T.box.querySelector('.tut-t'), s.text, { mul: 0.5, sound: 'soft' });
  if (s.sfx && SFX[s.sfx]) SFX[s.sfx]();   // 재귀 — 짧은 바늘 소리
  if (s.say) H.storySay();   // 대본 03-010 — 설명창이 열리는 순간 주인공이 한마디 (대사는 이야기 칸의 enc.say)
  if (s.hi) { const el = root.querySelector(s.hi); if (el) el.classList.add('tut-hi'); }
}
function advance() {
  if (!T) return;
  T.i++;
  if (T.i >= T.steps.length) finish(false); else show();
}
function finish(skipped) {
  const cb = T && T.onDone;
  stopTutorial();
  if (cb) cb(skipped);
}
function tutEvent(ev) {
  if (!T) return;
  const s = T.steps[T.i];
  if (s && s.until === ev) setTimeout(advance, 450);
}
export const tutorialActive = () => !!T;
