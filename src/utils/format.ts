// 숫자 포맷 (천 단위 콤마)
export function formatNumber(num: number): string {
  return num.toLocaleString('ko-KR');
}

// 금액 포맷
export function formatCurrency(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

// 날짜 포맷
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
}

// 시간 포맷
export function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 날짜+시간 포맷
export function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// 상대 시간 포맷
export function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const date = new Date(dateStr);
  const diff = now.getTime() - date.getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  if (hours < 24) return `${hours}시간 전`;
  if (days < 7) return `${days}일 전`;
  return formatDate(dateStr);
}

// 전화번호 포맷
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
  }
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
  }
  return phone;
}

// 예약 상태 라벨
export function getReservationStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    pending: '대기중',
    confirmed: '확정',
    cancelled: '취소',
    completed: '완료',
    noshow: '미방문',
  };
  return labels[status] || status;
}

// 예약 상태 색상
export function getReservationStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    cancelled: 'bg-red-100 text-red-800',
    completed: 'bg-blue-100 text-blue-800',
    noshow: 'bg-gray-100 text-gray-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

// 결제 상태 라벨
export function getPaymentStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    unpaid: '미결제',
    partial: '부분결제',
    paid: '결제완료',
    refunded: '환불',
  };
  return labels[status] || status;
}

// 시설 상태 라벨
export function getFacilityStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    active: '운영중',
    maintenance: '점검중',
    closed: '폐쇄',
    reserved: '예약됨',
  };
  return labels[status] || status;
}

// 퍼센트 포맷
export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

// 파일 크기 포맷
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)}GB`;
}
