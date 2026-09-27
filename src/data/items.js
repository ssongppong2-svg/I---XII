// 가방 — 대본 1장의 회복 소모품 · 정비 부품. 부품(돈)과는 따로 센다
// potion: 지도 · 칸 화면에서는 언제든(코스트 없음), 전투 중에는 1코스트
// kit: 멈춘 기계를 고치는 사건 선택지에 쓴다 (1장 04 녹슨 자동인형 등)
export const ITEMS = {
  potion: { name: '회복약', icon: 'drop', heal: 2, price: 30, desc: 'HP +2. 지도 · 칸 화면에서는 언제든, 전투 중에는 1코스트 (E).' },
  kit:    { name: '정비 부품', icon: 'wrench', price: 25, desc: '멈춘 기계를 고칠 때 쓴다 — 사건의 선택지에 필요하다.' },
};
export const ITEM_IDS = Object.keys(ITEMS);
