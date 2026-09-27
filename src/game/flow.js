// 게임 흐름 — 챕터 시작 · 칸 들어가기 · 칸 끝내기 · 전투 구성 · 보상 · 죽음
import { RUN, chapterDef, dm, mods, addAlert, maxHp } from './run.js';
import { BOSSES, FOES } from '../data/foes.js';
import { autosave, writeRecur } from './save.js';
import { CHAPTERS } from '../data/chapters.js';
import { genMap, twoAhead } from '../map/gen.js';
import { makeRng, hashSeed } from '../core/rng.js';
import { POOL } from '../data/cards.js';
import { RELIC_POOL, RELICS } from '../data/relics.js';
import { CH1_STORY } from '../data/story/ch1.js';
import { isFight } from '../data/nodes.js';
import { go } from '../ui/router.js';
import { seenEvents } from './profile.js';

const STORIES = { 1: CH1_STORY };
export const storyOf = n => STORIES[n] || {};
// 이야기 칸의 대본 (지도 칸 → data/story의 s02 · s03 …). 이야기 칸이 아니면 null
export const storyDef = n => (n && n.story ? storyOf(RUN.chapter)[n.story] || null : null);

// 챕터 시작 — 지도를 만들고, 재귀 지점을 자동으로 새긴다
export function startChapter(n) {
  RUN.chapter = n;
  RUN.cleared = 0;
  RUN.reward = null;
  const ch = CHAPTERS[n];
  if (!ch) { autosave(); go('chapterend', { soon: true }); return; }
  RUN.map = genMap(ch, RUN.seed, { seenEvents: seenEvents() });
  RUN.pos = RUN.map.start;
  RUN.visited = [RUN.map.start];
  RUN.pending = null;
  RUN.flags.shortcut = false;
  RUN.alert = 0;
  RUN.saves = { left: dm().saves, max: dm().saves };
  writeRecur({ manual: false });
  go('map', { intro: true });
}

// 지금 고를 수 있는 톱니
export function choices() {
  if (!RUN.map || !RUN.pos) return [];
  if (RUN.flags.shortcut) return twoAhead(RUN.map, RUN.pos);
  return RUN.map.nodes[RUN.pos].next.slice();
}

// 칸 들어가기 — 경계도 반영 → 전투면 전투 화면, 아니면 칸 화면
export function enterNode(id) {
  const node = RUN.map.nodes[id];
  const ch = chapterDef();
  RUN.pos = id;
  RUN.visited.push(id);
  RUN.pending = id;
  RUN.flags.shortcut = false;
  const alertBefore = RUN.alert;
  if (ch.hunted) addAlert(8);
  else if (node.watched) addAlert(20);
  // 보스 앞 — 재귀 지점을 저절로 새긴다(횟수를 쓰지 않는다). 쓰러지면 보스 앞 대화부터 다시
  if (node.type === 'boss') writeRecur({ at: id }); else autosave();
  const gained = RUN.alert - alertBefore;
  if (isFight(node.type) && node.type !== 'trial') go('battle', { nodeId: id, alertGained: gained });
  else go('node', { nodeId: id, alertGained: gained });
}

// 이어 하기 — 끈 자리로: 재귀 연출 · 보상 · 챕터 끝, 아니면 들어가 있던 칸을 처음부터(경계도 등은 이미 반영됨)
export function resumeRun() {
  if (RUN.fallen) { go('rewind'); return; }
  if (RUN.reward) { go('reward'); return; }
  if (RUN.cleared && CHAPTERS[RUN.cleared]) { go('chapterend', { clear: true }); return; }
  if (!CHAPTERS[RUN.chapter] || !RUN.map) { go('chapterend', { soon: true }); return; }
  const id = RUN.pending;
  if (id && RUN.map.nodes[id]) {
    const node = RUN.map.nodes[id];
    if (isFight(node.type) && node.type !== 'trial') go('battle', { nodeId: id, resumed: true });
    else go('node', { nodeId: id, resumed: true });
    return;
  }
  go('map', { resumed: true });
}

// 칸을 끝내고 지도로
export function finishNode({ toMap = true } = {}) {
  RUN.pending = null;
  autosave();
  if (toMap) go('map', { arrive: true });
}

// 전투 구성 — 칸 종류 · 챕터 · 경계도(50 이상이면 증원)
export function encounterFor(node, extra = {}) {
  const ch = chapterDef();
  const E = ch.encounters;
  const R = makeRng(hashSeed(RUN.seed, node.id, 'enc'));
  let enc;
  switch (node.type) {
    case 'elite': {
      if (!E.elite.length) { enc = { kind: 'normal', foes: R.pick(E.normal).slice(), ambush: ch.ambush.normal, sub: '전투' }; break; }   // 정예가 없는 장 (1장)
      const e = E.elite[(node.eliteIdx || 0) % E.elite.length];
      enc = { kind: 'normal', foes: e.foes.slice(), ambush: ch.ambush.elite, elite: true, story: e.story, sub: '정예' };
      break;
    }
    // 이야기 칸의 전투 — 대본이 정한 적 그대로(증원 없음). 앞 대사는 칸 화면에서(선택 · 재귀 지점), 승리 대사는 전투 뒤
    case 'story': {
      const d = storyDef(node) || {};
      const e = d.enc || { foes: E.easy[0] };
      enc = { kind: 'normal', foes: e.foes.slice(), hpMul: e.hpMul, ambush: e.ambush !== undefined ? e.ambush : ch.ambush.normal, tut: e.tut, signal: !!e.signal,
        sub: e.sub || d.title, story: node.story, storyBattle: true, noReinforce: true };
      // 사건에서 세운 깃발에 따라 적이 약해진다 — { 깃발: { 적 종류: 체력 배율 } } (예: 새끼 돌진 기계를 데려왔으면 돌진 기계가 머뭇거린다)
      for (const [flag, mul] of Object.entries(e.flagMul || {})) if ((RUN.flags.ev || {})[flag]) enc.hpMulOf = Object.assign({}, enc.hpMulOf, mul);
      // 고른 경로에 따라 배치가 달라진다 (09 — 가림길: 구석에서 시작 · 송신이 늦다 / 직행: 판 가운데)
      for (const [flag, r] of Object.entries(e.routes || {})) if ((RUN.flags.ev || {})[flag]) {
        if (r.start) enc.start = { r: r.start[0], c: r.start[1] };
        if (r.sig) enc.sig = r.sig;
        if (r.foeCols) enc.foeCols = r.foeCols.slice();
        if (r.sub) enc.sub = r.sub;
      }
      break;
    }
    case 'boss':
      enc = { kind: 'boss', boss: E.boss.boss, foes: E.boss.adds.slice(), ambush: ch.ambush.boss, story: E.boss.story, sub: '보스' };
      break;
    case 'caught':
      enc = { kind: 'normal', foes: E.caught.slice(), ambush: ch.ambush.elite, sub: '발각 — 감시대 급습', caught: true };
      break;
    default: {
      const foes = (node.enc && node.enc.foes) ? node.enc.foes.slice() : R.pick(E.easy).slice();
      enc = { kind: 'normal', foes, ambush: ch.ambush.normal, sub: node.type === 'ambush' ? '기습' : node.type === 'trial' ? '시험' : '전투' };
      if (node.type === 'ambush') { enc.ambushed = true; enc.partsMul = 1.5; }
      if (node.type === 'trial') enc.trial = node.trial;
    }
  }
  Object.assign(enc, extra);
  // 경계도 50 이상 — 일반 전투에 한 명 더
  if (['battle', 'ambush', 'trial', 'alley', 'rest', 'event'].includes(node.type) && !enc.noReinforce && RUN.alert >= 50) {
    enc.foes.push(R.pick(E.reinforce));
    enc.reinforced = true;
  }
  enc.foeTitle = enc.foes.some(t => FOES[t] && FOES[t].machine) ? '회종시 기계' : '인류 정부군';
  if (enc.story) {
    const S = storyOf(ch.num);
    const st = S[enc.story] || {};
    if (!enc.storyBattle) enc.intro = st.intro;
    enc.win = st.win;
    enc.interludes = { start: st.start, phase2: st.phase2, phase3: st.phase3, half: st.half, stun1: st.stun1, freeze1: S.freeze1, blast1: S.blast1 };
  }
  enc.seed = hashSeed(RUN.seed, node.id, 'battle', RUN.recur || 0, RUN.visited.length);
  return enc;
}

// 시험 조건
export const TRIALS = {
  untouched: { name: '무결', desc: '한 번도 맞지 않고 이겨라', ok: r => r.stats.taken === 0 },
  swift:     { name: '신속', desc: '4루프 안에 이겨라', ok: r => r.stats.loops <= 4 },
  frugal:    { name: '절제', desc: '카드를 6장 이하만 쓰고 이겨라', ok: r => r.stats.cards <= 6 },
};

// 카드 보상 — 3장 (희귀도 가중)
export function cardChoices(R, tier, n = 3, exclude = []) {
  const W = { normal: [['common', 70], ['rare', 27], ['legend', 3]], elite: [['common', 45], ['rare', 45], ['legend', 10]], boss: [['rare', 70], ['legend', 30]], shop: [['common', 60], ['rare', 32], ['legend', 8]], cult: [['cult', 100]], high: [['rare', 75], ['legend', 25]] }[tier];
  const out = [];
  for (let i = 0; i < 30 && out.length < n; i++) {
    const rar = R.weighted(W);
    const pool = POOL(rar).filter(id => !out.includes(id) && !exclude.includes(id));
    if (pool.length) out.push(R.pick(pool));
  }
  return out;
}
export function relicChoice(R, tiers = [['common', 65], ['rare', 35]], n = 1) {
  const out = [];
  for (let i = 0; i < 40 && out.length < n; i++) {
    const rar = R.weighted(tiers);
    const pool = RELIC_POOL(rar).filter(id => !RUN.relics.includes(id) && !out.includes(id));
    if (pool.length) out.push(R.pick(pool));
  }
  return out;
}

// 전투 보상 목록
export function rewardsFor(node, enc, result) {
  const ch = chapterDef();
  const R = makeRng(hashSeed(RUN.seed, node.id, 'reward', enc.caught ? 'c' : ''));
  const M = mods();
  const kind = node.type === 'boss' ? 'boss' : node.type === 'elite' ? 'elite' : 'normal';
  const out = { parts: 0, shards: 0, relics: [], relicPick: [], cards: [], note: [] };
  let parts = R.int(...ch.parts[kind]);
  if (kind !== 'normal') parts *= M.elitePartsMul;
  if (enc.partsMul) parts *= enc.partsMul;
  if (enc.bonusParts) parts += enc.bonusParts;
  if (enc.tut === 1) parts *= 0.6;   // 학습 전투 (02)
  out.parts = Math.round(parts);
  if (kind === 'elite') { out.shards = 1 + M.shardBonus; out.relics = relicChoice(R); }
  if (kind === 'boss') { out.shards = 3 + M.shardBonus; out.relicPick = relicChoice(R, [['boss', 100]], 3); }
  if (enc.caught) { out.shards += 1; out.note.push('발각 전투를 이겨 경계도가 50으로 내려갔다'); }
  if (enc.trial) {
    const T = TRIALS[enc.trial];
    if (T && T.ok(result)) { out.note.push(`시험 「${T.name}」 통과`); out.relics.push(...relicChoice(R, [['common', 40], ['rare', 60]])); out.shards += 1; }
    else if (T) out.note.push(`시험 「${T.name}」 실패 — 추가 보상 없음`);
  }
  out.cards = cardChoices(R, kind === 'normal' ? 'normal' : kind);
  return out;
}

// 챕터 끝 (보스 뒤) → 다음 챕터 (없으면 준비 중)
export function nextChapter() {
  const n = RUN.chapter + 1;
  RUN.hp = maxHp();
  startChapter(n);
}

export const relicName = id => (RELICS[id] ? RELICS[id].name : id);

// 이야기 · 보스 대사 창 — 보스 모니터(이름 · 그림) · 이 장의 등장인물
export function sceneOpts(bossId) {
  const bd = BOSSES[bossId] || BOSSES.watchtower;
  return { bossName: bd.name, bossArt: bd.artFull, bossBar: `출입 통제 방송 · ${bd.name}`, cast: storyOf(RUN.chapter).cast || {} };
}
