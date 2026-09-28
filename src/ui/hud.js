// 지도 · 칸 화면 위쪽 막대에 같이 쓰는 조각 — 경계 게이지(0 · 1 · 2단계) · 가방(회복약 · 정비 부품)
import { RUN, alertStage, ALERT_STAGE_AT, bag, usePotion, maxHp } from '../game/run.js';
import { ITEMS } from '../data/items.js';
import { icon } from './icons.js';
import { SFX } from './sfx.js';
import { toast } from './overlay.js';

export function alertGaugeHTML() {
  const st = alertStage();
  return `<span class="alert-g st${st}" title="경계 — 0~100. ${ALERT_STAGE_AT[1]} · ${ALERT_STAGE_AT[2]}에서 한 단계씩 오른다(0 · 1 · 2단계). 높을수록 휴식 습격 · 적 증원, 100이면 발각">${icon('eye')}<span class="bar${RUN.alert >= 70 ? ' hot' : ''}" style="--v:${RUN.alert / 100}"><i></i><em style="left:${ALERT_STAGE_AT[1]}%"></em><em style="left:${ALERT_STAGE_AT[2]}%"></em></span><b>${RUN.alert}</b><span class="stg">${st}단계</span></span>`;
}

export function bagHTML() {
  const b = bag(), full = RUN.hp >= maxHp();
  const why = !b.potion ? ' — 없음' : full ? ' — HP가 가득 차 있다' : ' — 눌러서 쓴다';
  return `<span class="bag">
    <button class="bag-it potion" type="button" data-bag="potion"${!b.potion || full ? ' disabled' : ''} title="${ITEMS.potion.desc}${why}">${icon(ITEMS.potion.icon)}<b>${b.potion}</b><small>회복약</small></button>
    <span class="bag-it kit" title="${ITEMS.kit.desc}">${icon(ITEMS.kit.icon)}<b>${b.kit}</b><small>정비 부품</small></span>
  </span>`;
}

// 회복약 단추 — 그린 뒤마다 다시 건다. 쓰면 HP +2 (코스트 없음), after()로 화면을 다시 그린다
export function bindBag(box, after) {
  const pb = box && box.querySelector('[data-bag="potion"]');
  if (!pb) return;
  pb.addEventListener('click', () => {
    const got = usePotion();
    if (!got) { SFX.deny(); return; }
    SFX.heal(); toast(`회복약 — HP +${got}`);
    after();
  });
}
