// 유물 — 얻으면 전부 켜진다 (개수 제한 없음)
// mods: 늘 적용되는 수치 · on: 전투 중 때맞춰 일어나는 효과 (battle/engine.js가 읽는다)
// rarity: common · rare · boss · dark(암시장 — 대가가 붙음)
export const RELICS = {
  // ── 일반
  rusty_gear:    { name: '녹슨 톱니바퀴', icon: 'gear', rarity: 'common', desc: '전투를 시작할 때 실드 1.', on: { battleStart: { shield: 1 } } },
  cooling_coil:  { name: '냉각 코일', icon: 'coil', rarity: 'common', desc: '루프를 시작할 때 과부하 −10.', on: { loopStart: { cool: 10 } } },
  cult_beads:    { name: '신도의 묵주', icon: 'beads', rarity: 'common', desc: '휴식할 때 HP를 1 더 회복한다.', mods: { restHeal: 1 } },
  brass_compass: { name: '황동 나침반', icon: 'compass', rarity: 'common', desc: '경계도가 25% 덜 오른다.', mods: { alertMul: 0.75 } },
  spare_mag:     { name: '여분의 탄창', icon: 'deck', rarity: 'common', desc: '손패 최대 +1.', mods: { handMax: 1 } },
  broken_hand:   { name: '부서진 초침', icon: 'nail', rarity: 'common', desc: '적을 쓰러뜨릴 때마다 과부하 −15.', on: { kill: { cool: 15 } } },
  wind_heart:    { name: '태엽 심장', icon: 'heart', rarity: 'common', desc: '최대 HP +1.', mods: { maxHp: 1 } },
  foresight:     { name: '예지의 렌즈', icon: 'lens', rarity: 'common', desc: '기습 폭격이 1칸 줄어든다.', mods: { ambushCells: -1 } },
  hunter_mark:   { name: '사냥꾼의 표식', icon: 'target', rarity: 'common', desc: '전투마다 처음 쓰는 공격 카드 피해 +5.', mods: { firstStrike: 5 } },
  mech_wrench:   { name: '정비공의 렌치', icon: 'wrench', rarity: 'common', desc: '강화소에서 한 장 더 무료로 강화한다.', mods: { forgeFree: 1 } },
  // ── 희귀
  check_valve:   { name: '역류 방지 밸브', icon: 'drop', rarity: 'rare', desc: '장력 가속 못총에 맞아도 과부하가 절반만 찬다.', mods: { nailOlMul: 0.5 } },
  martyr_mark:   { name: '순교자의 성흔', icon: 'flame', rarity: 'rare', desc: 'HP가 1일 때 공격 카드 피해 +50%.', mods: { lowHpDmg: 0.5 } },
  watcher_eye:   { name: '감시자의 눈알', icon: 'eye', rarity: 'rare', desc: '정예 · 보스 전투의 부품 보상 +50%.', mods: { elitePartsMul: 1.5 } },
  shard_pouch:   { name: '톱니 조각 주머니', icon: 'shard', rarity: 'rare', desc: '정예 · 보스 전투에서 톱니 조각을 1개 더 얻는다.', mods: { shardBonus: 1 } },
  tension_spring:{ name: '장력 스프링', icon: 'spring', rarity: 'rare', desc: '도약 카드의 도약 거리 +1.', mods: { leapPlus: 1 } },
  holy_lens:     { name: '성광 렌즈', icon: 'gem', rarity: 'rare', desc: '사격 카드 피해 +2.', mods: { kindDmg: { shot: 2 } } },
  ward_charm:    { name: '방벽 부적', icon: 'shield', rarity: 'rare', desc: '실드를 3겹까지 두를 수 있다.', mods: { shieldCap: 1 } },
  bell_clapper:  { name: '종의 추', icon: 'bell', rarity: 'rare', desc: '루프를 시작할 때 카드를 1장 더 보충한다.', mods: { handRefill: 1 } },
  // ── 보스
  recur_glass:   { name: '재귀의 모래시계', icon: 'hourglass', rarity: 'boss', desc: '전투마다 한 번, 쓰러질 피해를 막고 HP 1로 버틴다.', mods: { deathWard: 1 } },
  twelve_gear:   { name: '열두 톱니', icon: 'sigil', rarity: 'boss', desc: '루프당 코스트 +1 (기습 폭격은 그대로 2번째 행동 뒤).', mods: { costPerLoop: 1 } },
  watch_core:    { name: '감시 코어', icon: 'clockeye', rarity: 'boss', desc: '보스에게 주는 과부하 +50%.', mods: { bossOlMul: 1.5 } },
  // ── 암시장 (대가가 있다)
  blood_chalice: { name: '핏빛 성배', icon: 'chalice', rarity: 'dark', desc: '전투마다 처음 적을 쓰러뜨리면 HP +1. 대가: 최대 HP −1.', mods: { maxHp: -1 }, on: { firstKill: { heal: 1 } } },
  forbidden_chip:{ name: '금지된 칩', icon: 'chip', rarity: 'dark', desc: '공격 카드 피해 +2. 대가: 루프를 시작할 때 과부하 +10.', mods: { allDmg: 2 }, on: { loopStart: { ol: 10 } } },
  hollow_crown:  { name: '속 빈 왕관', icon: 'crown', rarity: 'dark', desc: '상점 가격 −30%. 대가: 경계도가 1.5배로 오른다.', mods: { shopMul: 0.7, alertMul: 1.5 } },
};

// 기계 이식 — 기계 이식소에서 톱니 조각으로. 되돌릴 수 없다 (유물처럼 늘 켜짐)
export const IMPLANTS = {
  exo_frame:   { name: '강화 외골격', icon: 'heart', desc: '최대 HP +1 (이식할 때 1 회복).', mods: { maxHp: 1 } },
  extra_core:  { name: '추가 연산기', icon: 'chip', desc: '손패 최대 +1.', mods: { handMax: 1 } },
  cool_loop:   { name: '냉각 순환기', icon: 'coil', desc: '과부하 한계 +20 (120까지 버틴다).', mods: { olMax: 20 } },
  reflex_net:  { name: '반사 신경망', icon: 'shield', desc: '전투를 시작할 때 실드 1.', on: { battleStart: { shield: 1 } } },
  spring_amp:  { name: '태엽 증폭기', icon: 'spring', desc: '공격 카드 피해 +1.', mods: { allDmg: 1 } },
  shutoff:     { name: '감각 차단기', icon: 'bolt', desc: '과부하 마비가 1코스트 짧아진다.', mods: { freezeCost: -1 } },
  optic_link:  { name: '광학 연결', icon: 'eye', desc: '경계도가 20% 덜 오른다.', mods: { alertMul: 0.8 } },
  grip_servo:  { name: '쥠 서보', icon: 'wrench', desc: '루프를 시작할 때 카드를 1장 더 보충한다.', mods: { handRefill: 1 } },
};

export const RELIC_POOL = rarity => Object.keys(RELICS).filter(k => RELICS[k].rarity === rarity);
