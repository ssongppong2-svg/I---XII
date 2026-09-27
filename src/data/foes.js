// 적 — 2코스트마다 이동 또는 공격 1회. 다음 행동은 판에 미리 예고되고, 예고된 칸은 실행 때 바뀌지 않는다
// ai: line(같은 줄이면 끝까지 사격) · guard(정면 반감 · 앞 3칸) · bomber(2~3칸 밖 십자 폭탄 · 쓰러지면 자폭) · chaser(최대 step칸 달려와 앞 3칸 물기)
// art = assets 그림 이름 (스탠딩: art, 격자 SD: art-sd). 없으면 임시 그림(foeart.js)
// native = 그림이 원래 바라보는 쪽 (L 왼 · R 오른)

export const FOES = {
  // ── 1 · 2장: 기계 (그림은 나중에 — 지금은 임시 그림)
  watcher: { name: '감시 눈', short: '감시 눈', ai: 'line', hp: 10, dmg: 1, atk: '감시 광선', atkShort: '광선', art: 'machine-watcher', native: 'R', machine: true,
    desc: '나와 같은 가로·세로줄에 서면 그 줄을 판 끝까지 광선으로 태운다. 줄을 맞추되 거리를 벌린다.' },
  hound: { name: '태엽 사냥개', short: '사냥개', ai: 'chaser', hp: 12, dmg: 1, step: 2, atk: '물어뜯기', atkShort: '물기', art: 'machine-hound', native: 'L', machine: true,
    desc: '한 번에 두 칸까지 달려온다. 바로 옆(대각선 포함)에 닿으면 앞 3칸을 물어뜯는다.' },
  warden: { name: '방벽 기계', short: '방벽', ai: 'guard', hp: 20, dmg: 2, guard: 0.5, atk: '내려찍기', atkShort: '내려찍기', art: 'machine-warden', native: 'L', machine: true,
    desc: '바로 앞 3칸을 내려찍는다. 방패판이 달린 정면에서 받는 피해는 절반 — 옆이나 뒤를 노릴 것.' },
  beetle: { name: '폭뢰 딱정벌레', short: '딱정벌레', ai: 'bomber', hp: 8, dmg: 1, blast: 8, blastMe: 1, atk: '폭뢰 투척', atkShort: '투척', art: 'machine-beetle', native: 'L', machine: true,
    desc: '2~3칸 떨어진 곳에 폭뢰를 던져 십자 5칸을 터뜨린다. 쓰러지면 주변 8칸에서 자폭 — 다른 적도 휘말린다.' },
  // 1장 정예
  gatekeeper: { name: '수문장', short: '수문장', ai: 'guard', hp: 40, dmg: 2, guard: 0.5, wide: true, atk: '충격 강타', atkShort: '강타', art: 'machine-gatekeeper', native: 'L', machine: true, elite: true,
    desc: '감시 구역 문을 지키는 거대한 방벽 기계. 앞 두 줄 6칸을 내려찍는다. 정면에서 받는 피해는 절반.' },
  alpha: { name: '사냥개 우두머리', short: '우두머리', ai: 'chaser', hp: 30, dmg: 2, step: 2, atk: '목덜미 물기', atkShort: '물기', art: 'machine-alpha', native: 'L', machine: true, elite: true,
    desc: '무리를 이끄는 태엽 사냥개. 두 칸씩 달려와 앞 3칸을 물어뜯는다. 한 번 물리면 2 피해.' },

  // ── 3장부터: 무장한 인간 (그림 있음)
  rifle: { name: '시계 사수', short: '사수', ai: 'line', hp: 12, dmg: 1, atk: '관통 사격', atkShort: '사격', art: 'enemy-rifle', native: 'R', human: true,
    desc: '나와 같은 가로·세로줄에 서면 그 줄을 판 끝까지 꿰뚫어 쏜다. 줄을 맞추되 거리를 벌린다.' },
  shield: { name: '방패 기사', short: '기사', ai: 'guard', hp: 20, dmg: 2, guard: 0.5, atk: '내려찍기', atkShort: '내려찍기', art: 'enemy-shield', native: 'L', human: true,
    desc: '바로 앞 3칸을 내려찍는다. 방패를 든 정면에서 받는 피해는 절반 — 옆이나 뒤를 노릴 것.' },
  bomb: { name: '폭탄병', short: '폭탄병', ai: 'bomber', hp: 10, dmg: 1, blast: 8, blastMe: 1, atk: '폭탄 투척', atkShort: '투척', art: 'enemy-bomb', native: 'L', human: true,
    desc: '2~3칸 떨어진 곳에 폭탄을 던져 십자 5칸을 터뜨린다. 쓰러지면 주변 8칸에서 자폭 — 다른 적도 휘말린다.' },
};

// 정예 특성 (난이도 IV부터 정예에게 하나 더) — battle/engine.js가 읽는다
export const ELITE_TRAITS = {
  plated:  { name: '강철 외피', desc: '받는 피해 −1' },
  regen:   { name: '재생', desc: '루프를 시작할 때 HP +2' },
  frenzy:  { name: '광폭', desc: 'HP가 절반 이하면 피해 +1' },
};

// 보스 — 맨 윗줄(보스 줄)을 통째로 차지하고 그 아래 6×6에서 싸운다(1~6행). 루프 시작 때 턴 공격 패턴 예고, 2번째 행동 뒤 기습 폭격, 마지막 행동 뒤 턴 공격
// make(p, q, H): p = 내 위치, q = 패턴 무작위값, H = 판 도우미(colCells · rowCells · AREA · RC · TOP 첫 줄 · LAST 끝 줄 · COLS 칸 수)
export const BOSSES = {
  watchtower: {
    name: '대형 감시기계', sub: '인류 정부군 · 감시탑의 눈', hp: 150, art: 'boss', artFull: 'boss-full', nailOl: 30,
    adds: ['watcher', 'beetle'],
    patterns: [
      { id: 'aim',     name: '장력 못총 · 조준', dmg: 2, nail: true, aimed: true, desc: '내가 선 세로줄을 관통 사격',
        make: (p, q, H) => H.colCells(p.c) },
      { id: 'volley',  name: '못총 일제사격',    dmg: 1, nail: true, aimed: true, desc: '내 세로줄과 멀리 떨어진 세로줄 하나',
        roll: R => ({ u: R.next() }),
        make: (p, q, H) => { const far = Array.from({ length: H.COLS }, (_, c) => c).filter(c => Math.abs(c - p.c) >= 2); return [...H.colCells(p.c), ...H.colCells(far[Math.floor(q.u * far.length)])]; } },
      { id: 'front',   name: '정면 제압',        dmg: 2, desc: '보스 바로 앞 두 줄 (거리 1~2)',
        make: (p, q, H) => [...H.rowCells(H.TOP), ...H.rowCells(H.TOP + 1)] },
      { id: 'rear',    name: '후방 포격',        dmg: 1, desc: '맨 뒤 두 줄 (거리 5~6)',
        make: (p, q, H) => [...H.rowCells(H.LAST - 1), ...H.rowCells(H.LAST)] },
      { id: 'checker', name: '바둑판 폭격',      dmg: 1, aimed: true, desc: '내 칸을 포함한 엇갈린 칸',
        make: (p, q, H) => H.AREA.filter(k => { const [r, c] = H.RC(k); return (r + c) % 2 === (p.r + p.c) % 2; }) },
      { id: 'ring',    name: '포위 사격',        dmg: 1, nail: true, desc: '가장자리 한 바퀴',
        make: (p, q, H) => H.AREA.filter(k => { const [r, c] = H.RC(k); return r === H.TOP || r === H.LAST || c === 0 || c === H.COLS - 1; }) },
      { id: 'cross',   name: '십자 조준',        dmg: 2, aimed: true, desc: '내 가로줄과 세로줄',
        make: (p, q, H) => [...H.rowCells(p.r), ...H.colCells(p.c)] },
    ],
    barks: {
      start:  ['좌표 고정. 재처분을 시작한다.'],
      attack: ['장전 완료. 발사.', '처분 집행.', '못, 가속.', '회피 예측 수정.'],
      stun:   ['회로 과부하— 재부팅 중…', '경고. 출력 저하… 출력 저하…'],
      freeze: ['처분 대상, 기능 정지 확인.', '움직임 없음. 지금이다.'],
      low:    ['외장 손상 치명적… 교전 계속.'],
      win:    ['시스템… 종…료…'],
      lose:   ['재처분 완료. 기록을 갱신한다.'],
    },
  },
};

// 적이 말풍선으로 하는 말 (공격할 때 가끔 · 쓰러질 때)
export const FOE_BARKS = {
  watcher:    { atk: ['조준 고정.', '감시 광선 발사.', '대상 포착.'], die: ['감시… 두절…'] },
  hound:      { atk: ['크르르…!', '(톱니 이빨이 맞물린다)'], die: ['끼잉…'] },
  warden:     { atk: ['구역 봉쇄.', '압착.'], die: ['방벽… 해제…'] },
  beetle:     { atk: ['(째깍째깍째깍)', '폭뢰, 투하.'], die: ['(째깍—)'] },
  gatekeeper: { atk: ['통과 불허.', '구역 수호.'], die: ['문이… 열린다…'] },
  alpha:      { atk: ['(쇳소리 섞인 울부짖음)', '크아아…!'], die: ['(태엽이 풀리는 소리)'] },
  rifle:      { atk: ['조준 완료.', '사격.', '시각 기록.'], die: ['시각… 정지…'] },
  shield:     { atk: ['방패, 전진!', '짓눌러라.'], die: ['전열… 붕괴…'] },
  bomb:       { atk: ['정화한다!', '불꽃을!'], die: ['하, 하하… 같이 가자아!'] },
};
