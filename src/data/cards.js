// 카드 — 모두 1코스트. 방향이 있는 카드(shape)는 쓸 때 상하좌우 중 적이 닿는 쪽을 고른다
// rarity: basic(시작) · common · rare · legend · cult(사이비, 천막) · curse(저주)
// 효과 필드: dmg 피해 · ol 내 과부하 · bossOl 보스 과부하 · rapid 연사 가중 · persist 상주 · exhaust 소멸(한 전투 한 번)
//           shield 실드 · cool 과부하 감소 · leap 도약 칸 · draw 뽑기 · heal HP · push 밀치기 · delay 맞은 적 다음 행동 건너뜀
//           delayAll 모든 적 다음 행동 건너뜀 · hot 과부하 50 이상이면 피해 배율 · selfHit 내 HP 소모 · back 직전 칸으로 · junk 쓸모 없음(저주)
// up = 강화했을 때 바뀌는 값

// 사거리: 플레이어 기준 [행 변화, 열 변화], 음수 행 = 앞(위). 쓸 때 고른 방향으로 돌린다
export const SHAPES = {
  line1:  { label: '바로 앞 1칸',    cells: [[-1, 0]] },
  fan3:   { label: '앞 3칸 부채꼴',  cells: [[-1, -1], [-1, 0], [-1, 1]] },
  line2:  { label: '직선 2칸',       cells: [[-1, 0], [-2, 0]] },
  line3:  { label: '직선 3칸',       cells: [[-1, 0], [-2, 0], [-3, 0]] },
  pierce: { label: '직선 관통',      cells: [[-1, 0], [-2, 0], [-3, 0], [-4, 0]] },
  far:    { label: '3~4칸 앞',       cells: [[-3, 0], [-4, 0]] },
  side2:  { label: '양옆 2칸',       cells: [[0, -1], [0, 1]] },
  cone4:  { label: '앞 원뿔 4칸',    cells: [[-1, 0], [-2, -1], [-2, 0], [-2, 1]] },
  wide5:  { label: '2칸 앞 가로 5칸', cells: [[-2, -2], [-2, -1], [-2, 0], [-2, 1], [-2, 2]] },
  halo5:  { label: '앞·양옆 5칸',    cells: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1]] },
  ring8:  { label: '주위 8칸',       cells: [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]] },
  cross8: { label: '사방 2칸씩',     cells: [[-1, 0], [-2, 0], [1, 0], [2, 0], [0, -1], [0, -2], [0, 1], [0, 2]] },
};

export const KINDS = {
  melee: { label: '근접',   icon: 'blade' },
  shot:  { label: '사격',   icon: 'shot' },
  far:   { label: '원거리', icon: 'mortar' },
  jam:   { label: '교란',   icon: 'bolt' },
  guard: { label: '방어',   icon: 'shield' },
  cool:  { label: '정비',   icon: 'drop' },
  move:  { label: '기동',   icon: 'leap' },
  cult:  { label: '사이비', icon: 'chalice' },
  curse: { label: '저주',   icon: 'nail' },
};
export const RARITY = {
  basic:  { label: '시작' },
  common: { label: '일반' },
  rare:   { label: '희귀' },
  legend: { label: '전설' },
  cult:   { label: '사이비' },
  curse:  { label: '저주' },
};

export const CARDS = {
  // ── 시작 카드
  gear_cleave: { name: '톱니 베기', kind: 'melee', rarity: 'basic', shape: 'fan3', dmg: 7, up: { dmg: 10 },
    desc: '앞 3칸 부채꼴을 톱니 날로 벤다.' },
  holy_pierce: { name: '성광 관통', kind: 'shot', rarity: 'basic', shape: 'pierce', dmg: 4, up: { dmg: 6 },
    desc: '전방 직선을 끝까지 꿰뚫는다.' },
  prayer_ward: { name: '기도 방벽', kind: 'guard', rarity: 'basic', shield: 1, up: { shield: 2 },
    desc: '다음 피격을 막는 실드를 두른다. 실드는 최대 2겹.' },
  steam_leap: { name: '증기 도약', kind: 'move', rarity: 'basic', leap: 2, up: { leap: 3 },
    desc: '방향을 골라 도약한다. 적은 뛰어넘을 수 있지만 적 위에는 내릴 수 없다.' },
  coolant: { name: '냉각 성수', kind: 'cool', rarity: 'basic', cool: 40, up: { cool: 60 },
    desc: '달아오른 회로를 식혀 과부하를 낮춘다.' },

  // ── 일반
  aimed_shell: { name: '정조준 포격', kind: 'far', rarity: 'common', shape: 'far', dmg: 10, up: { dmg: 14 },
    desc: '3~4칸 앞에 포탄을 떨어뜨린다. 떨어져 있어야 닿는다.' },
  rivet_burst: { name: '리벳 연사', kind: 'shot', rarity: 'common', shape: 'line2', dmg: 3, ol: 10, rapid: 10, persist: true, up: { dmg: 4 },
    desc: '써도 손에 남는다. 연달아 쓸 때마다 과부하가 10씩 더 붙는다.' },
  backflow: { name: '역류 주입', kind: 'jam', rarity: 'common', shape: 'line2', dmg: 3, bossOl: 40, up: { bossOl: 60 },
    desc: '보스 회로에 역류 전류를 흘려 과부하시킨다.' },
  spring_jab: { name: '태엽 찌르기', kind: 'melee', rarity: 'common', shape: 'line1', dmg: 12, up: { dmg: 16 },
    desc: '바로 앞 한 칸을 감아 둔 태엽의 힘으로 꿰뚫는다.' },
  chain_teeth: { name: '사슬 톱니', kind: 'melee', rarity: 'common', shape: 'line3', dmg: 5, up: { dmg: 7 },
    desc: '톱니 사슬을 앞으로 휘감아 세 칸을 긁는다.' },
  pendulum: { name: '추 진자', kind: 'melee', rarity: 'common', shape: 'side2', dmg: 8, up: { dmg: 11 },
    desc: '시계추처럼 양옆을 휩쓴다.' },
  wind_up: { name: '태엽 감기', kind: 'cool', rarity: 'common', draw: 2, up: { draw: 3 },
    desc: '카드를 뽑는다. 손패가 가득 차면 그만큼만.' },
  smoke_step: { name: '연막 걸음', kind: 'move', rarity: 'common', leap: 1, shield: 1, up: { leap: 2 },
    desc: '연기를 뿌리며 한 걸음 옮기고 실드를 두른다.' },
  scatter: { name: '산탄 사격', kind: 'shot', rarity: 'common', shape: 'cone4', dmg: 4, up: { dmg: 6 },
    desc: '앞으로 퍼지는 산탄을 쏜다.' },
  vent_strike: { name: '과열 방출', kind: 'melee', rarity: 'common', shape: 'fan3', dmg: 6, hot: 2, cool: 30, up: { dmg: 8 },
    desc: '과부하가 50 이상이면 피해가 2배. 쓰고 나면 과부하가 내려간다.' },
  iron_ward: { name: '강철 방벽', kind: 'guard', rarity: 'common', shield: 1, cool: 20, up: { shield: 2 },
    desc: '실드를 두르고 회로를 조금 식힌다.' },
  tick_shot: { name: '초침 사격', kind: 'shot', rarity: 'common', shape: 'pierce', dmg: 3, delay: true, up: { dmg: 5 },
    desc: '맞은 적은 다음 행동을 한 번 건너뛴다.' },
  hammer_blow: { name: '파쇄 망치', kind: 'melee', rarity: 'common', shape: 'line1', dmg: 9, push: 1, up: { dmg: 12 },
    desc: '맞은 적을 한 칸 밀쳐 낸다. 밀릴 곳이 막혀 있으면 3 피해를 더 준다.' },

  // ── 희귀
  whirl_saw: { name: '회전 톱날', kind: 'melee', rarity: 'rare', shape: 'ring8', dmg: 6, ol: 20, up: { dmg: 8 },
    desc: '몸을 축으로 톱날을 돌려 주위 8칸을 벤다.' },
  time_stop: { name: '시간 정지', kind: 'jam', rarity: 'rare', delayAll: true, exhaust: true, up: { exhaust: false },
    desc: '모든 적이 다음 행동을 한 번 건너뛴다. 한 전투에 한 번(소멸).' },
  rewind_step: { name: '되감기', kind: 'move', rarity: 'rare', back: true, cool: 30, up: { cool: 50 },
    desc: '이번 루프에 처음 서 있던 칸으로 돌아가고 과부하를 낮춘다.' },
  heavy_mortar: { name: '대형 박격', kind: 'far', rarity: 'rare', shape: 'wide5', dmg: 8, up: { dmg: 11 },
    desc: '두 칸 앞 가로줄 전체에 포탄을 쏟는다.' },
  overload_core: { name: '과부하 핵', kind: 'jam', rarity: 'rare', shape: 'line2', dmg: 2, bossOl: 80, ol: 30, up: { bossOl: 100 },
    desc: '보스 회로를 크게 흔드는 대신 내 몸도 달아오른다.' },

  // ── 전설
  descent: { name: '기계 신의 강림', kind: 'melee', rarity: 'legend', shape: 'halo5', dmg: 18, ol: 40, bossOl: 20, up: { dmg: 24 },
    desc: '앞과 양옆을 불태운다. 몸이 버티지 못한다.' },
  twelfth_bell: { name: '열두 번째 종', kind: 'shot', rarity: 'legend', shape: 'cross8', dmg: 9, ol: 50, up: { dmg: 12 },
    desc: '사방으로 종소리를 터뜨린다. 방향과 상관없이 전부 맞는다.' },

  // ── 사이비 (천막에서)
  zealot_prayer: { name: '광신의 기도', kind: 'cult', rarity: 'cult', shield: 2, exhaust: true, up: { exhaust: false },
    desc: '신도들의 기도가 실드 두 겹이 된다. 한 전투에 한 번(소멸).' },
  blood_communion: { name: '피의 성찬', kind: 'cult', rarity: 'cult', heal: 1, exhaust: true, up: { cool: 30 },
    desc: 'HP를 1 회복한다. 한 전투에 한 번(소멸).' },
  martyr_flame: { name: '순교자의 불꽃', kind: 'cult', rarity: 'cult', shape: 'halo5', dmg: 14, selfHit: 1, up: { dmg: 18 },
    desc: '내 HP를 1 태워 앞과 양옆을 불사른다.' },
  choir: { name: '신도의 합창', kind: 'cult', rarity: 'cult', delayAll: true, cool: 20, exhaust: true, up: { draw: 1 },
    desc: '모든 적이 다음 행동을 건너뛰고 회로가 식는다. 한 전투에 한 번(소멸).' },
  relic_whisper: { name: '성유물의 속삭임', kind: 'cult', rarity: 'cult', draw: 2, shield: 1, exhaust: true, up: { draw: 3 },
    desc: '카드를 뽑고 실드를 두른다. 한 전투에 한 번(소멸).' },

  // ── 저주 (암시장 · 심연)
  rust: { name: '녹', kind: 'curse', rarity: 'curse', junk: true,
    desc: '아무 효과 없다. 1코스트를 써야 손에서 치울 수 있다.' },
  nail_scar: { name: '못 자국', kind: 'curse', rarity: 'curse', junk: true, drawOl: 20,
    desc: '뽑히면 과부하 +20. 1코스트를 써야 손에서 치울 수 있다.' },
};

export const STARTER = [
  'gear_cleave', 'gear_cleave', 'gear_cleave',
  'holy_pierce', 'holy_pierce',
  'prayer_ward', 'prayer_ward',
  'steam_leap', 'steam_leap',
  'coolant',
];

// 카드 인스턴스(덱의 한 장) → 실제 수치 (강화 반영)
export function cardDef(inst) {
  const base = CARDS[inst.id];
  if (!base) return null;
  if (!inst.up || !base.up) return base;
  return Object.assign({}, base, base.up, { name: base.name + '+', upgraded: true });
}
export const canUpgrade = inst => !!(CARDS[inst.id] && CARDS[inst.id].up && !inst.up);
// 강화하면 무엇이 바뀌는지 — 강화소 미리보기 (예: 피해 7→10 · 소멸 없어짐)
const UP_LABEL = { dmg: '피해', shield: '실드', leap: '도약', cool: '과부하 감소', draw: '뽑기', heal: 'HP 회복', bossOl: '보스 과부하', ol: '내 과부하', push: '밀치기', exhaust: '소멸' };
export function upgradeNote(id) {
  const base = CARDS[id];
  if (!base || !base.up) return '';
  return Object.entries(base.up).map(([k, v]) => {
    const L = UP_LABEL[k] || k;
    if (typeof v === 'boolean') return v ? `${L} 붙음` : `${L} 없어짐`;
    return base[k] === undefined ? `${L} ${v} 추가` : `${L} ${base[k]}→${v}`;
  }).join(' · ');
}

// 보상 · 상점에 나오는 카드
export const POOL = rarity => Object.keys(CARDS).filter(k => CARDS[k].rarity === rarity);

// 카드 효과를 한 줄로 (큰 카드 · 설명 칸)
export function effectLine(def) {
  const e = [];
  if (def.shape) e.push(`${SHAPES[def.shape].label} · 피해 ${def.dmg}`);
  if (def.hot) e.push(`과부하 50↑ 피해 ×${def.hot}`);
  if (def.push) e.push(`밀치기 ${def.push}칸`);
  if (def.delay) e.push('맞은 적 행동 건너뜀');
  if (def.delayAll) e.push('모든 적 행동 건너뜀');
  if (def.leap) e.push(`도약 ${def.leap}칸`);
  if (def.back) e.push('처음 칸으로');
  if (def.shield) e.push(`실드 +${def.shield}`);
  if (def.cool) e.push(`과부하 −${def.cool}`);
  if (def.draw) e.push(`뽑기 ${def.draw}`);
  if (def.heal) e.push(`HP +${def.heal}`);
  if (def.selfHit) e.push(`내 HP −${def.selfHit}`);
  if (def.ol) e.push(`내 과부하 +${def.ol}`);
  if (def.bossOl) e.push(`보스 과부하 +${def.bossOl}`);
  if (def.drawOl) e.push(`뽑히면 과부하 +${def.drawOl}`);
  return e.join(' · ');
}
// 큰 카드용 — 큰 숫자(피해 · 실드 · 도약 …)와 꼬리표(과부하 · 보스 · 밀치기 · 정지)가 이미 보여 주는 것을 뺀 나머지 효과
export function extraLine(def) {
  const main = def.shape ? 'shape' : def.shield ? 'shield' : def.leap ? 'leap' : def.heal ? 'heal' : def.draw ? 'draw' : def.cool ? 'cool' : def.delayAll ? 'delayAll' : def.back ? 'back' : '';
  const rest = Object.assign({}, def, { shape: null, ol: null, bossOl: null, push: null, delay: null });
  if (main) rest[main] = null;
  return effectLine(rest);
}
