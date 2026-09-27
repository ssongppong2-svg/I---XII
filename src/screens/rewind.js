// 재귀 — 쓰러지면 마지막 저장으로. 챕터 끝 · 준비 중 화면도 여기
import { register, go } from '../ui/router.js';
import { RUN, chapterDef, maxHp } from '../game/run.js';
import { rewind, autosave } from '../game/save.js';
import { nextChapter, startChapter, storyOf, sceneOpts } from '../game/flow.js';
import { playScene, dialSVG } from '../scenes/scene.js';
import { loadAll } from '../ui/assets.js';
import { storyArtKeys } from '../ui/foeart.js';
import { RM, sleep } from '../core/util.js';
import { CHAPTERS, LAST_CHAPTER } from '../data/chapters.js';
import { SFX } from '../ui/sfx.js';
import { toast } from '../ui/overlay.js';
import { roman, esc } from '../core/util.js';
import { icon } from '../ui/icons.js';

// 쓰러짐 → 재귀 지점으로. 대본: 전투 패배는 그 전투(체크포인트)의 재시도이며 정사상의 죽음 · 재귀 경험으로 세지 않는다
// 그래서 대사 없이 바늘이 거꾸로 도는 화면만 (누르면 바로 넘어간다)
function rewindFx(holder) {
  holder.innerHTML = `<div class="rewind-bg"><div class="rw-hands"><i></i><i></i></div>
    <div class="rw-note"><b>재귀</b><span>마지막 재귀 지점으로 돌아갑니다</span><small>누르면 바로 넘어가요</small></div></div>`;
  SFX.rewind();
  setTimeout(() => SFX.tick(), 700);
  return new Promise(res => {
    let done = false;
    const fin = () => { if (done) return; done = true; res(); };
    holder.addEventListener('click', fin, { once: true });
    sleep(RM.matches ? 500 : 2100).then(fin);
  });
}

register('rewind', {
  async mount(holder) {
    await rewindFx(holder);
    const ok = rewind();
    if (!ok) { RUN.fallen = false; RUN.hp = maxHp(); startChapter(RUN.chapter); return; }   // 재귀 지점이 없으면 이 장의 처음으로
    // 이야기 전투 직전 · 보스 앞에 새겨진 재귀 지점 — 지도가 아니라 그 칸으로 곧장
    const at = RUN.pending && RUN.map && RUN.map.nodes[RUN.pending];
    if (at) {
      toast(at.type === 'boss' ? '재귀 — 보스 전투를 처음부터' : '재귀 — 전투 직전으로 돌아왔어요', 'gold');
      go(at.type === 'boss' ? 'battle' : 'node', { nodeId: at.id, retry: true });
      return;
    }
    toast(`재귀 — 마지막 저장으로 돌아왔어요 · 남은 저장 ${RUN.saves.left}번`, 'gold');
    go('map', { rewound: true });
  },
});

const fmtTime = ms => { const m = Math.floor((ms || 0) / 60000); return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`; };

let ceHolder = null;
register('chapterend', {
  async mount(holder, params = {}) {
    ceHolder = holder;
    const st = RUN.stats;
    if (params.clear) {
      const ch = chapterDef();
      // 장 끝 장면(1장 = 대본 18 「외투 한 벌의 빚」) — 한 번만. 보다가 끄면 이어 할 때 다시
      const S = storyOf(ch.num), key = `end:${ch.num}`;
      if (S.ending && !(RUN.flags.seen || {})[key]) {
        holder.innerHTML = '<div class="ce-dark"></div>';
        await loadAll(storyArtKeys(S.ending, S.cast));
        if (ceHolder !== holder) return;
        await playScene(S.ending, sceneOpts(chapterDef().encounters.boss.boss));
        if (ceHolder !== holder) return;
        RUN.flags.seen = Object.assign({}, RUN.flags.seen, { [key]: true });
        autosave();
      }
      const end = ch.end || {};
      holder.innerHTML = `<div class="ce${end.quiet ? ' quiet' : ''}">
        <p class="ce-kick">${esc(RUN.name || '???')}의 여정 · ${esc(end.done || `${ch.num}장 완료`)}</p>
        ${end.dial ? `<div class="ce-dial">${dialSVG(ch.hour, end.dial)}</div>` : `<div class="ce-num">${ch.hour}</div>`}
        <h2 class="ce-title">${esc(ch.title)}</h2>
        <p class="ce-sub">${end.dest ? `다음 목적지 — ${esc(end.dest)}` : `${ch.sub} — 권능 하나를 향해, 첫 번째 톱니가 맞물렸다.`}</p>
        ${end.left ? `<p class="ce-left">${esc(end.left)}</p>` : ''}
        <dl class="ce-stats">
          <div><dt>플레이 시간</dt><dd>${fmtTime(RUN.playMs)}</dd></div><div><dt>전투</dt><dd>${st.battles}</dd></div>
          <div><dt>처치</dt><dd>${st.kills}</dd></div><div><dt>재귀(쓰러짐)</dt><dd>${st.deaths}</dd></div>
          <div><dt>덱</dt><dd>${RUN.deck.length}장</dd></div><div><dt>유물</dt><dd>${RUN.relics.length}</dd></div>
        </dl>
        <button class="btn-main" type="button" id="ceGo">${icon('play')}다음 장으로</button></div>`;
      if (end.quiet) SFX.train(); else SFX.win();
      holder.querySelector('#ceGo').addEventListener('click', () => { SFX.click(); nextChapter(); });
      return;
    }
    // 준비 중 — 다음 챕터가 아직 없다
    const n = RUN ? RUN.chapter : 2;
    holder.innerHTML = `<div class="ce">
      <p class="ce-kick">${RUN ? esc(RUN.name || '???') + '의 여정 · 저장됨' : ''}</p>
      <div class="ce-num">${roman(n)}</div>
      <h2 class="ce-title">${n}시 — 준비 중</h2>
      <p class="ce-sub">${n <= LAST_CHAPTER ? `${n}장은 아직 만들고 있어요. 지금까지의 여정은 저장돼 있어서, ${n}장이 추가되면 「이어 하기」로 바로 이어져요.` : '끝.'}</p>
      <button class="btn-main" type="button" id="ceTitle">타이틀로</button></div>`;
    if (RUN) autosave();
    holder.querySelector('#ceTitle').addEventListener('click', () => { SFX.click(); go('title'); });
  },
  unmount() { ceHolder = null; },
});
export const hasChapter = n => !!CHAPTERS[n];
