// 난이도 I~XII — 숫자(적 체력)는 단계마다 커지고, 규칙은 아래 표대로 쌓인다
export const DIFFS = [
  null,
  { rule: '기본 난이도', saves: 6 },
  { rule: '적 체력이 단계마다 +5%씩 늘기 시작', saves: 6 },
  { rule: '재귀 저장 5번', saves: 5 },
  { rule: '정예가 특성을 하나 더 가짐', saves: 5 },
  { rule: '휴식 회복량 −1 · 저장 4번', saves: 4 },
  { rule: '경계도가 1.25배로 오름', saves: 4 },
  { rule: '상점 가격 +20%', saves: 4 },
  { rule: '시작 최대 HP −1 · 저장 3번', saves: 3 },
  { rule: '중간 보스 · 보스 체력 +15%', saves: 3 },
  { rule: '휴식 기습 확률 +10%p · 저장 2번', saves: 2 },
  { rule: '기습 폭격 +2칸', saves: 2 },
  { rule: '보스 턴 공격 피해 +1 · 저장 1번', saves: 1 },
];

// 단계 d(1~12)에서 실제로 쓰는 값
export function diffMods(d) {
  d = Math.max(1, Math.min(12, d | 0));
  return {
    level: d,
    saves: DIFFS[d].saves,
    foeHp: 1 + 0.05 * (d - 1),                // 적 체력 배율
    eliteTrait: d >= 4,                        // 정예 특성 +1
    restHeal: d >= 5 ? -1 : 0,
    alertMul: d >= 6 ? 1.25 : 1,
    shopMul: d >= 7 ? 1.2 : 1,
    maxHp: d >= 8 ? -1 : 0,
    bossHp: d >= 9 ? 1.15 : 1,
    restAmbush: d >= 10 ? 0.10 : 0,
    ambushPlus: d >= 11 ? 2 : 0,
    bossDmg: d >= 12 ? 1 : 0,
  };
}

// 그 단계까지 쌓인 규칙 목록 (난이도 화면에 표시)
export function rulesUpTo(d) {
  const out = [];
  for (let i = 1; i <= d; i++) if (i > 1) out.push({ level: i, text: DIFFS[i].rule });
  return out;
}
