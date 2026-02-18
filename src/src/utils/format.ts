// ============================================================================
// 포맷팅 유틸리티
// ============================================================================

/** 원화 포맷 */
export function fmtWon(n: number): string {
  return n.toLocaleString('ko-KR');
}

/** 숫자를 한글로 변환 */
export function numKor(n: number): string {
  if (n === 0) return '영';
  const units = ['', '만', '억'];
  const digits = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  const tens = ['', '십', '백', '천'];
  let result = '';
  let idx = 0;
  while (n > 0) {
    const chunk = n % 10000;
    n = Math.floor(n / 10000);
    if (chunk > 0) {
      let cs = '';
      let c = chunk;
      for (let i = 0; i < 4 && c > 0; i++) {
        const d = c % 10;
        c = Math.floor(c / 10);
        if (d > 0) cs = (d === 1 && i > 0 ? '' : digits[d]) + tens[i] + cs;
      }
      result = cs + units[idx] + result;
    }
    idx++;
  }
  return result;
}

/** 오늘 날짜 (YYYY-MM-DD) */
export function today(): string {
  return new Date().toISOString().split('T')[0];
}

/** 월 포맷 (YYYY-MM → YYYY년 MM월) */
export function fmtMonth(s: string): string {
  const [y, m] = s.split('-');
  return `${y}년 ${parseInt(m)}월`;
}

/** 날짜 포맷 (YYYY-MM-DD → MM/DD) */
export function fmtShortDate(s: string): string {
  const [, m, d] = s.split('-');
  return `${parseInt(m)}/${parseInt(d)}`;
}

/** 요일 이름 */
export function getDayName(dateStr: string): string {
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  return days[new Date(dateStr).getDay()];
}

/** 채팅 시간 포맷 */
export function formatChatTime(ts: string): string {
  if (!ts) return '';
  const d = new Date(ts);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return '방금';
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  return d.toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
}

/** 시간 문자열을 슬롯 인덱스로 변환 */
export function timeToIndex(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return (h - 10) * 2 + (m >= 30 ? 1 : 0);
}

/** 날짜 유효성 검증 */
export function isValidDate(dateStr: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(dateStr);
}

/** 전화번호 포맷 */
export function fmtPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}
