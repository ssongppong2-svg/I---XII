// 적 — 2코스트마다 이동 또는 공격 1회. 다음 행동은 판에 미리 예고되고, 예고된 칸은 실행 때 바뀌지 않는다
// ai: line(같은 줄이면 끝까지 사격) · guard(정면 반감 · 앞 3칸) · bomber(2~3칸 밖 십자 폭탄 · 쓰러지면 자폭) · chaser(최대 step칸 달려와 앞 3칸 물기)
//     charge(같은 줄이면 그 줄을 따라 돌진 — 부딪칠 때까지 내달려 멈춘 자리에 선다) · mortar(움직이지 않고 내 자리에 십자 5칸 · 둘레 8칸을 번갈아 낙하)
// noFlip = 좌우로 뒤집지 않는다(시계 문자판처럼 뒤집히면 어색한 그림)
// art = assets 그림 이름 (스탠딩: art, 격자 SD: art-sd). 없으면 임시 그림(foeart.js)
// native = 그림이 원래 바라보는 쪽 (L 왼 · R 오른)

export const FOES = {
  // ── 1장: 회종시의 자동 기계 (대본 — 감시 시계 · 돌진 기계 · 곡사포 기계)
  watcher: { name: '감시 시계', short: '감시 시계', ai: 'line', hp: 10, dmg: 1, atk: '감시 광선', atkShort: '광선', art: 'machine-watcher', native: 'L', noFlip: true, machine: true,
    desc: '미등록 동력을 찾아 떠다니는 시계. 나와 같은 가로·세로줄에 서면 그 줄을 판 끝까지 광선으로 태운다. 송신을 준비하는 전투에서는 송신이 끝나기 전에 부숴야 경계가 오르지 않는다.' },
  charger: { name: '돌진 기계', short: '돌진 기계', ai: 'charge', hp: 14, dmg: 1, atk: '돌진', atkShort: '돌진', art: 'machine-charger', native: 'L', machine: true,
    desc: '송곳 머리의 돌격 기계. 나와 같은 줄에 서면 그 줄을 따라 돌진을 예고하고, 부딪칠 때까지 내달려 멈춘 자리에 선다. 예고된 줄에서 비켜서면 헛돌진.' },
  mortar: { name: '곡사포 기계', short: '곡사포', ai: 'mortar', hp: 16, dmg: 1, atk: '낙하 포격', atkShort: '포격', art: 'machine-mortar', native: 'L', machine: true, still: true,
    desc: '움직이지 않는 곡사포. 내 자리를 겨눠 십자 5칸 → 둘레 8칸을 번갈아 떨어뜨린다(둘레일 때는 가운데가 안전). 바로 옆(대각선 포함)에 붙으면 쏘지 못한다.' },

  // ── 2장용으로 보관 (1장 구성에서 뺌 — 그림은 나중에, 지금은 임시 그림)
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
// phases = 단계 — 남은 체력 비율이 at 이하가 되면 그 단계의 턴 공격(pats)을 쓰고, 이야기 phase2 · phase3을 한 번씩 튼다
export const BOSSES = {
  watchtower: {
    name: '대형 감시기계', sub: '외곽 출입문 · 현 소유자: 인류', hp: 150, art: 'boss', artFull: 'boss-full', nailOl: 30,
    adds: ['watcher', 'charger'],
    olName: '명령판 과부하',   // 과부하 막대 이름 — 덧붙인 명령판이 약점
    phases: [
      { at: 1,    name: '통행 심사',      pats: ['aim', 'volley', 'front', 'rear'] },
      { at: 0.66, name: '인류 보호 절차', pats: ['cross', 'checker', 'ring', 'volley'] },
      { at: 0.33, name: '영구 폐쇄',      pats: ['close', 'cross', 'checker'] },
    ],
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
      // 3단계 — 출입문 폐쇄: 내 옆 두 세로줄만 남기고 전부. 범위가 공개되면(2번째 행동 뒤) 한 칸 옆으로 비켜야 산다
      { id: 'close',   name: '전 구역 폐쇄',     dmg: 2, aimed: true, desc: '내 옆 두 세로줄만 남기고 전부 — 옆으로 비켜설 것',
        roll: R => ({ u: R.next() }),
        make: (p, q, H) => {
          const right = p.c + 2 <= H.COLS - 1, left = p.c - 2 >= 0;
          const safe = right && (!left || q.u < 0.5) ? [p.c + 1, p.c + 2] : [p.c - 1, p.c - 2];
          return H.AREA.filter(k => !safe.includes(H.RC(k)[1]));
        } },
    ],
    barks: {
      start:  ['외곽 출입 심사를 시작합니다.'],
      attack: ['통행을 허가할 수 없습니다.', '미등록 동력체를 회수합니다.', '비인간 통행 구역, 폐쇄.', '심사 계속.'],
      stun:   ['명령판 과부하— 재기동 중…', '판정… 지연… 판정…'],
      freeze: ['동력체 정지 확인.', '회수 가능.'],
      low:    ['명령판 손상. 운영 기준… 유지.'],
      win:    ['……기존 운영 규정을 불러옵니다.'],
      lose:   ['회수 완료. 출입 기록을 갱신합니다.'],
    },
  },
};

// 적이 말풍선으로 하는 말 (공격할 때 가끔 · 쓰러질 때)
export const FOE_BARKS = {
  watcher:    { atk: ['통행 허가를 확인합니다.', '미등록 동력체.', '회수 절차.'], die: ['보고… 두절…'], signal: ['위치 송신 완료.', '내부 순찰에 공유합니다.'] },
  charger:    { atk: ['경로 차단.', '(송곳 머리가 회전한다)', '돌진.'], die: ['(바퀴가 헛돈다)'] },
  mortar:     { atk: ['경비 절차.', '낙하 좌표 확정.', '(포신이 기울어진다)'], die: ['포신… 정지…'] },
  hound:      { atk: ['크르르…!', '(톱니 이빨이 맞물린다)'], die: ['끼잉…'] },
  warden:     { atk: ['구역 봉쇄.', '압착.'], die: ['방벽… 해제…'] },
  beetle:     { atk: ['(째깍째깍째깍)', '폭뢰, 투하.'], die: ['(째깍—)'] },
  gatekeeper: { atk: ['통과 불허.', '구역 수호.'], die: ['문이… 열린다…'] },
  alpha:      { atk: ['(쇳소리 섞인 울부짖음)', '크아아…!'], die: ['(태엽이 풀리는 소리)'] },
  rifle:      { atk: ['조준 완료.', '사격.', '시각 기록.'], die: ['시각… 정지…'] },
  shield:     { atk: ['방패, 전진!', '짓눌러라.'], die: ['전열… 붕괴…'] },
  bomb:       { atk: ['정화한다!', '불꽃을!'], die: ['하, 하하… 같이 가자아!'] },
};
