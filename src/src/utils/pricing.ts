// ============================================================================
// 견적/가격 계산 유틸리티
// ============================================================================
import type { Booking, FormConfig, QuoteResult, QuoteItem } from '@/types';
import { fmtWon } from './format';

export interface PriceInfo {
  entryChild: number;
  entryElem: number;
  entryTeacher: number;
  freeRatioChild: number;
  freeRatioElem: number;
  addonMap: Record<string, number>;
}

/** FormConfig에서 가격 정보 추출 */
export function getPrices(cfg: FormConfig): PriceInfo {
  const addonMap: Record<string, number> = {};
  cfg.addons.forEach((a) => {
    addonMap[a.name] = a.price;
  });
  return {
    entryChild: cfg.entryP1,
    entryElem: cfg.entryP2,
    entryTeacher: cfg.entryTea,
    freeRatioChild: cfg.freeRatioChild,
    freeRatioElem: cfg.freeRatioElem,
    addonMap,
  };
}

/** 예약 견적 계산 */
export function calcQuote(bk: Booking, cfg: FormConfig): QuoteResult {
  const P = getPrices(cfg);
  const items: QuoteItem[] = [];

  // 실제 or 예약 인원
  const useActual = bk.actualStudents != null;
  const stu = useActual ? (bk.actualStudents ?? 0) : bk.students;
  const tea = useActual
    ? (bk.actualTeachers ?? bk.teachers)
    : bk.teachers;
  const childN = useActual
    ? (bk.actualStudentsChild ?? stu)
    : bk.studentsChild || stu;
  const elemN = useActual
    ? (bk.actualStudentsElem ?? 0)
    : bk.studentsElem || 0;

  // 입장료 단가
  const ePC =
    bk.actualEntryPrices?.child != null
      ? bk.actualEntryPrices.child
      : P.entryChild;
  const ePE =
    bk.actualEntryPrices?.elem != null
      ? bk.actualEntryPrices.elem
      : P.entryElem;
  const ePT =
    bk.actualEntryPrices?.teacher != null
      ? bk.actualEntryPrices.teacher
      : P.entryTeacher;

  // 기본입장
  if (childN > 0)
    items.push({ cat: '체험료', name: '기본입장-유아', qty: childN, unit: ePC, total: childN * ePC });
  if (elemN > 0)
    items.push({ cat: '체험료', name: '기본입장-초등', qty: elemN, unit: ePE, total: elemN * ePE });

  // 인솔자 무료 계산
  const freeFromChild =
    P.freeRatioChild > 0 ? Math.floor(childN / P.freeRatioChild) : 0;
  const freeFromElem =
    P.freeRatioElem > 0 ? Math.floor(elemN / P.freeRatioElem) : 0;
  const freeTea = freeFromChild + freeFromElem;
  const paidTea = Math.max(0, tea - freeTea);
  if (paidTea > 0)
    items.push({
      cat: '체험료',
      name: `인솔자 입장료 (${freeTea}명 무료, ${paidTea}명 유료)`,
      qty: paidTea,
      unit: ePT,
      total: paidTea * ePT,
    });

  // 부가체험
  if (bk.actualAddonQty?.length) {
    bk.actualAddonQty.forEach((aq) => {
      const defPrice = P.addonMap[aq.name] || 0;
      const price = aq.price != null ? aq.price : defPrice;
      if (aq.qty > 0)
        items.push({
          cat: '체험료',
          name: `${aq.name} 체험`,
          qty: aq.qty,
          unit: price,
          total: aq.qty * price,
        });
    });
  } else if (bk.addons?.length) {
    bk.addons.forEach((a) => {
      for (const [aName, aPrice] of Object.entries(P.addonMap)) {
        if (a.includes(aName)) {
          items.push({
            cat: '체험료',
            name: `${aName} 체험`,
            qty: stu,
            unit: aPrice,
            total: stu * aPrice,
          });
          break;
        }
      }
    });
  }

  // 단체식
  if (bk.actualMealQty && bk.meal && bk.meal !== '이용안함') {
    const mealMenu = cfg.meals.find((m) => m.name === bk.meal) || cfg.meals[0];
    if (mealMenu) {
      const mq = bk.actualMealQty;
      const p1 = mq.priceChild != null ? mq.priceChild : mealMenu.p1;
      const p2 = mq.priceElem != null ? mq.priceElem : mealMenu.p2;
      if (mq.child > 0)
        items.push({ cat: '급식', name: `단체식-유아(${mealMenu.name})`, qty: mq.child, unit: p1, total: mq.child * p1 });
      if (mq.elem > 0)
        items.push({ cat: '급식', name: `단체식-초등(${mealMenu.name})`, qty: mq.elem, unit: p2, total: mq.elem * p2 });
      if (mq.teacher > 0)
        items.push({ cat: '급식', name: `단체식-인솔(${mealMenu.name})`, qty: mq.teacher, unit: p2, total: mq.teacher * p2 });
    }
  } else if (bk.meal && bk.meal !== '이용안함') {
    const mealMenu = cfg.meals.find((m) => m.name === bk.meal) || cfg.meals[0];
    if (mealMenu) {
      if (childN > 0)
        items.push({ cat: '급식', name: `단체식-유아(${mealMenu.name})`, qty: childN, unit: mealMenu.p1, total: childN * mealMenu.p1 });
      if (elemN > 0)
        items.push({ cat: '급식', name: `단체식-초등(${mealMenu.name})`, qty: elemN, unit: mealMenu.p2, total: elemN * mealMenu.p2 });
      if (tea > 0)
        items.push({ cat: '급식', name: `단체식-인솔(${mealMenu.name})`, qty: tea, unit: mealMenu.p2, total: tea * mealMenu.p2 });
    }
  }

  const grandTotal = items.reduce((s, i) => s + i.total, 0);
  return { items, grandTotal };
}

/** 견적 총액 간편 계산 */
export function getEstimate(bk: Booking, cfg: FormConfig): number {
  return calcQuote(bk, cfg).grandTotal;
}

/** 견적 HTML 생성 */
export function genQuoteHTML(quote: QuoteResult, bookingName: string): string {
  const rows = quote.items
    .map(
      (i) =>
        `<tr><td>${i.name}</td><td style="text-align:center">${i.qty}</td><td style="text-align:right">${fmtWon(i.unit)}원</td><td style="text-align:right">${fmtWon(i.total)}원</td></tr>`
    )
    .join('');
  return `
    <h3>${bookingName} 견적서</h3>
    <table style="width:100%;border-collapse:collapse;font-size:12px;">
      <tr style="background:#f5f5f5;">
        <th style="padding:6px;text-align:left;">항목</th>
        <th style="padding:6px;text-align:center;">수량</th>
        <th style="padding:6px;text-align:right;">단가</th>
        <th style="padding:6px;text-align:right;">금액</th>
      </tr>
      ${rows}
      <tr style="font-weight:700;background:#e8f5e9;">
        <td colspan="3" style="padding:8px;">합계</td>
        <td style="padding:8px;text-align:right;color:#1a472a;">${fmtWon(quote.grandTotal)}원</td>
      </tr>
    </table>
  `;
}
