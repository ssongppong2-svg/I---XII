// 톱니 지도의 칸 종류 16가지 (+ 시작 제단 · 튜토리얼 전투)
// r = 톱니 크기(맞물림 반지름) · tone = 테두리 색
export const NODE_TYPES = {
  start:      { label: '제단',       icon: 'altar',    tone: '#F2D38F', r: 44, desc: '깨어난 곳. 여기서 첫 톱니가 돈다.' },
  battle:     { label: '전투',       icon: 'swords',   tone: '#E0865A', r: 36, desc: '일반 전투. 부품과 카드 한 장을 얻는다.' },
  tutorial:   { label: '첫 전투',    icon: 'swords',   tone: '#E0865A', r: 36, desc: '몸이 싸우는 법을 기억해 낸다 — 튜토리얼 전투.' },
  elite:      { label: '정예',       icon: 'skull',    tone: '#FF5C6E', r: 44, desc: '강한 적과의 전투. 이야기가 있다. 부품 · 톱니 조각 · 유물 · 카드.' },
  midboss:    { label: '중간 보스',  icon: 'eyegear',  tone: '#FF7A45', r: 56, desc: '이 챕터의 중간 보스. 이야기가 있다.' },
  boss:       { label: '보스',       icon: 'clockeye', tone: '#FF3B4E', r: 78, desc: '이 챕터의 끝. 이야기가 있다.' },
  rest:       { label: '휴식',       icon: 'flame',    tone: '#8BDCA6', r: 36, desc: 'HP를 회복한다. 경계도가 높을수록 쉬는 동안 기습당하기 쉽다.' },
  shop:       { label: '상점',       icon: 'bag',      tone: '#E7C27A', r: 36, desc: '부품으로 카드 · 유물을 사고, 카드를 없앤다.' },
  blackmarket:{ label: '암시장',     icon: 'mask',     tone: '#C08A4A', r: 36, desc: '강한 물건을 판다. 값은 부품이 아니다.' },
  forge:      { label: '강화소',     icon: 'anvil',    tone: '#F2B544', r: 36, desc: '카드 한 장을 무료로 강화하고, 톱니 조각으로 더 강화한다.' },
  implant:    { label: '기계 이식소', icon: 'chip',    tone: '#8FD3FF', r: 36, desc: '톱니 조각으로 기계를 몸에 이식한다. 되돌릴 수 없다.' },
  abyss:      { label: '심연',       icon: 'vortex',   tone: '#9C7CFF', r: 36, desc: '무엇이든 돌려준다. 아니면 앗아간다.' },
  trial:      { label: '시험',       icon: 'hourglass',tone: '#7FC8FF', r: 36, desc: '조건이 붙은 도전 전투. 조건을 지키면 보상이 더 있다.' },
  ambush:     { label: '기습',       icon: 'burst',    tone: '#FF6A55', r: 36, desc: '적이 먼저 움직이는 전투. 부품 보상이 많다.' },
  alley:      { label: '골목',       icon: 'alley',    tone: '#B8A89A', r: 36, desc: '무슨 일이 생길지 모른다 — 숨을 곳 · 좁은 전투 · 뒷거래 · 지름길.' },
  tent:       { label: '천막',       icon: 'tent',     tone: '#F07A95', r: 36, desc: '당신을 숭배하는 신도들의 천막. 소식 · 회복 · 사이비 카드.' },
  event:      { label: '사건',       icon: 'help',     tone: '#C9C0D3', r: 36, desc: '짧은 선택. 거래일 수도, 도박일 수도.' },
  shrine:     { label: '유물 제단',  icon: 'gem',      tone: '#F2D38F', r: 36, desc: '유물 두 개 중 하나를 얻는다.' },
};

// 전투가 벌어지는 칸
export const isFight = t => ['battle', 'tutorial', 'elite', 'midboss', 'boss', 'ambush', 'trial'].includes(t);
