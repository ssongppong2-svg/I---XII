// 사건(?) — 짧은 선택 한 장면. 이야기가 아니라 거래 · 도박
// run(G)는 결과 문장을 돌려준다. G = 톱니 칸 도우미 (screens/nodes.js)
// cond(G) = 고를 수 있는 조건 (없으면 늘 가능)
export const EVENTS = {
  broken_eye: {
    title: '쓰러진 감시 눈', icon: 'eye',
    text: '골목 바닥에 감시 눈 하나가 떨어져 있다. 렌즈에 금이 갔지만, 아직 희미하게 윙윙거린다.',
    options: [
      { label: '부품을 뜯어 간다', desc: '부품 +30 · 경계도 +10', run: G => { G.parts(30); G.alert(10); return '렌즈를 비틀어 빼자 짧은 경보가 울렸다가 끊겼다.'; } },
      { label: '태엽을 다시 감아 준다', desc: '경계도 −15', run: G => { G.alert(-15); return '감시 눈이 잠시 당신을 바라보다가, 조용히 빛을 끄고 굴러갔다. 오늘 본 것을 잊어 줄 모양이다.'; } },
      { label: '지나친다', desc: '아무 일도 없다', run: () => '당신은 발소리를 죽이고 지나갔다.' },
    ],
  },
  supply_crate: {
    title: '버려진 보급 상자', icon: 'bag',
    text: '인류 정부군의 문장이 찍힌 상자가 반쯤 열린 채 버려져 있다. 안쪽에서 기름 냄새가 난다.',
    options: [
      { label: '손을 넣어 본다', desc: '반반: 부품 +45 / 저주 카드 「녹」', run: G => {
        if (G.chance(0.5)) { G.parts(45); return '부품 꾸러미가 잡혔다. 운이 좋았다.'; }
        G.curse('rust'); return '녹슨 쇳조각에 손을 베었다. 녹이 카드 사이로 스며든다.';
      } },
      { label: '지나친다', desc: '아무 일도 없다', run: () => '함정일지도 모른다. 당신은 상자를 두고 떠났다.' },
    ],
  },
  stopped_clock: {
    title: '멈춘 시계탑', icon: 'hourglass',
    text: '작은 시계탑의 바늘이 1시를 조금 넘긴 채 멈춰 있다. 태엽 구멍이 당신을 기다리는 것 같다.',
    options: [
      { label: '태엽을 감는다', desc: 'HP −1 · 톱니 조각 +2', cond: G => G.hp() > 1, run: G => { G.hurt(1); G.shards(2); return '손끝이 찢어질 만큼 태엽을 감았다. 톱니 몇 개가 떨어져 나와 손에 남았다.'; } },
      { label: '바늘을 되돌린다', desc: '카드 1장 무작위 강화', cond: G => G.canUpgrade(), run: G => { const n = G.upgradeRandom(); return `바늘이 한 칸 거꾸로 돌자, 「${n}」의 기억이 또렷해졌다.`; } },
      { label: '떠난다', desc: '아무 일도 없다', run: () => '시계탑은 계속 멈춰 있었다.' },
    ],
  },
  hidden_believer: {
    title: '숨어 사는 신도', icon: 'beads',
    text: '무너진 벽 틈에서 누군가 떨리는 손으로 묵주를 쥐고 있다. 당신을 보자 숨을 삼킨다. "…정말, 돌아오셨군요."',
    options: [
      { label: '축복을 받는다', desc: 'HP +1', run: G => { G.heal(1); return '신도는 당신의 손등에 이마를 댔다. 따뜻한 무언가가 몸 안으로 번졌다.'; } },
      { label: '멀리 보낸다', desc: '경계도 −10', run: G => { G.alert(-10); return '"여기 있으면 위험해." 신도는 고개를 끄덕이고 어둠 속으로 사라졌다. 당신의 흔적도 함께.'; } },
    ],
  },
  searchlight: {
    title: '탐조등 아래', icon: 'eye',
    text: '광장을 가로지르는 탐조등이 일정한 간격으로 돌아간다. 건너편까지는 스무 걸음.',
    options: [
      { label: '빛이 지나간 틈에 달린다', desc: '반반: 무사히 / 경계도 +25', run: G => {
        if (G.chance(0.5)) return '빛이 등 뒤를 스치고 지나갔다. 아무도 보지 못했다.';
        G.alert(25); return '빛 끝자락에 걸렸다. 어딘가에서 경보가 짧게 울렸다.';
      } },
      { label: '탐조등을 부순다', desc: '감시 눈 둘과 전투 · 이기면 부품 +40', run: G => { G.fight({ foes: ['watcher', 'watcher'], bonusParts: 40 }); return '돌을 집어 던지자 빛이 꺼졌다. 곧 감시 눈 둘이 날아왔다.'; } },
      { label: '돌아간다', desc: '경계도 +5', run: G => { G.alert(5); return '멀리 돌아가느라 시간이 걸렸다.'; } },
    ],
  },
  rusted_doll: {
    title: '녹슨 자동인형', icon: 'gear',
    text: '벽에 기댄 자동인형이 삐걱거리며 고개를 든다. "…한…시…? 돌아…왔…어…?"',
    options: [
      { label: '고쳐 준다', desc: '부품 −25 · 무작위 유물', cond: G => G.partsNow() >= 25, run: G => { G.parts(-25); const n = G.relic('common'); return `자동인형은 고친 손으로 품에서 무언가를 꺼내 건넸다. — 「${n}」.`; } },
      { label: '짐을 맡긴다', desc: '카드 1장 없애기', run: G => { G.removePick(); return '"맡아… 둘게…" 자동인형은 카드 한 장을 소중하게 품었다.'; } },
      { label: '작별한다', desc: '아무 일도 없다', run: () => '"…또… 와…" 자동인형의 눈빛이 천천히 꺼졌다.' },
    ],
  },
  blood_altar: {
    title: '핏자국 제단', icon: 'chalice',
    text: '누군가 급하게 만든 제단에 아직 마르지 않은 피가 고여 있다. 당신의 이름이 서툰 글씨로 새겨져 있다.',
    options: [
      { label: '피를 바친다', desc: 'HP −1 · 사이비 카드 1장 고르기', cond: G => G.hp() > 1, run: G => { G.hurt(1); G.cardPick('cult'); return '피가 제단의 홈을 따라 흐르자, 누군가의 기도가 손에 쥐어졌다.'; } },
      { label: '이름을 지운다', desc: '경계도 −20', run: G => { G.alert(-20); return '당신은 제단에 새겨진 이름을 긁어 지웠다. 아직은, 알려지면 안 된다.'; } },
      { label: '떠난다', desc: '아무 일도 없다', run: () => '당신은 제단을 뒤로했다.' },
    ],
  },
};
export const EVENT_POOL = { 1: Object.keys(EVENTS) };
