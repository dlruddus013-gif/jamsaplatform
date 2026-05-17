"""
la2fdoci.com (윈티켓) 파트너 관리자 API 모듈
==============================================
잠사박물관 눈썰매장 주문관리 크롤링 및 사용처리 연동

사용법:
    from la2fdoci_api import WinnTicketAPI
    
    api = WinnTicketAPI()
    api.login("jamsa", "1234")
    
    # 주문 목록 조회
    orders = api.get_orders(start_date="2026-02-28", end_date="2026-02-28")
    
    # 휴대폰번호로 검색
    orders = api.search_by_phone("010-2037-5015")
    
    # 이름으로 검색
    orders = api.search_by_name("엄혜지")
    
    # 사용완료 처리 (내부 DB ID 사용)
    api.mark_as_used(782608)
    
    # 일괄 사용완료 처리 (한번의 JSON 요청)
    api.bulk_update_status([782608, 782607, 782606], status="사용완료")

확인된 엔드포인트:
    - 로그인:     POST /partner/login.do (form-urlencoded)
    - 주문조회:   GET  /partner/order/orderList.do (query params)
    - 상태변경:   POST /partner/order/changeStatus.do (JSON)
                  Payload: {"status": 0|1|2, "ids": [내부ID, ...]}

작성일: 2026-02-28
대상: la2fdoci.com/partner (잠사박물관 눈썰매장 주문관리)
"""

import re
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from dataclasses import dataclass, field, asdict
from enum import Enum

import requests
from bs4 import BeautifulSoup

# ============================================================
# 설정
# ============================================================
BASE_URL = "https://la2fdoci.com/partner"
LOGIN_URL = f"{BASE_URL}/login.do"
ORDER_LIST_URL = f"{BASE_URL}/order/orderList.do"

logger = logging.getLogger("la2fdoci_api")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")


# ============================================================
# 데이터 모델
# ============================================================
class CouponStatus(Enum):
    """쿠폰 상태"""
    AVAILABLE = "사용가능"     # 사용 가능
    USED = "사용완료"          # 사용 완료
    CANCELLED = "취소"         # 취소
    EXPIRED = "기간만료"       # 기간 만료


class SearchType(Enum):
    """검색 유형"""
    NAME = "이름"
    PHONE = "휴대폰번호"


class DateType(Enum):
    """날짜 유형"""
    PURCHASE = 1   # 구매일


@dataclass
class Order:
    """주문 데이터"""
    internal_id: int = 0                # 내부 DB ID (changeStatus.do에서 사용)
    no: str = ""                        # 번호 (화면 표시용)
    order_id: str = ""                  # 주문번호 (예: L260228084706816)
    product_name: str = ""              # 상품명
    reservation_date: str = ""          # 예약일자
    sale_price: int = 0                 # 판매가
    supply_price: int = 0              # 공급가
    coupon_no: str = ""                # 쿠폰번호 (예: qwlkqwkljkewlk55)
    valid_period: str = ""             # 유효기간
    company: str = ""                  # 회사(기관명)
    buyer_name: str = ""               # 이름
    phone: str = ""                    # 휴대폰번호
    sent_at: str = ""                  # 발송일시
    remaining_total: str = ""          # 잔여/총수량 (예: 0/1)
    status: str = ""                   # 상태 (사용가능/사용완료/취소)
    processed_at: str = ""             # 처리일시

    def to_dict(self) -> dict:
        return asdict(self)


@dataclass
class OrderListResult:
    """주문 목록 조회 결과"""
    total_orders: int = 0           # 총 주문 건수
    total_quantity: int = 0         # 총 수량
    total_sale_price: int = 0       # 총 판매가
    total_supply_price: int = 0     # 총 공급가
    orders: List[Order] = field(default_factory=list)
    page: int = 1
    has_more: bool = False


# ============================================================
# API 클래스
# ============================================================
class WinnTicketAPI:
    """
    la2fdoci.com 파트너 관리자 API
    
    로그인 → 세션 쿠키 기반 인증
    주문 조회 → HTML 파싱
    상태 변경 → 폼 POST
    """
    
    def __init__(self, base_url: str = BASE_URL, timeout: int = 15):
        self.base_url = base_url
        self.timeout = timeout
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                          "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
            "Accept-Encoding": "gzip, deflate, br",
        })
        self._logged_in = False
        self._user_id = ""
    
    # ----------------------------------------------------------
    # 1. 로그인
    # ----------------------------------------------------------
    def login(self, user_id: str, password: str) -> bool:
        """
        파트너 로그인
        
        POST /partner/login.do
        Content-Type: application/x-www-form-urlencoded
        
        Body:
            userId=jamsa&userPw=1234
        
        Returns:
            True if login successful
        """
        try:
            resp = self.session.post(
                f"{self.base_url}/login.do",
                data={
                    "userId": user_id,
                    "userPw": password,
                },
                allow_redirects=True,
                timeout=self.timeout,
            )
            
            # 로그인 성공 시 주문 목록 페이지로 리다이렉트되거나
            # 세션 쿠키가 설정됨
            if resp.status_code == 200:
                # 로그인 실패 시 다시 로그인 페이지가 표시됨
                if "orderList" in resp.url or "주문관리" in resp.text:
                    self._logged_in = True
                    self._user_id = user_id
                    logger.info(f"로그인 성공: {user_id}")
                    return True
                
                # URL로 판별 안 되면 페이지 내용으로 판별
                if "로그인" in resp.text and "아이디" in resp.text and "비밀번호" in resp.text:
                    # 로그인 페이지가 다시 나타남 = 실패
                    logger.warning("로그인 실패: 아이디/비밀번호 확인 필요")
                    return False
                
                # 그 외의 경우 성공으로 간주
                self._logged_in = True
                self._user_id = user_id
                logger.info(f"로그인 성공 (추정): {user_id}")
                return True
            
            logger.warning(f"로그인 실패: HTTP {resp.status_code}")
            return False
            
        except Exception as e:
            logger.error(f"로그인 에러: {e}")
            return False
    
    def is_logged_in(self) -> bool:
        return self._logged_in
    
    # ----------------------------------------------------------
    # 2. 주문 목록 조회
    # ----------------------------------------------------------
    def get_orders(
        self,
        start_date: Optional[str] = None,
        end_date: Optional[str] = None,
        date_all: bool = True,
        coupon_status: Optional[List[str]] = None,
        search_type: Optional[str] = None,
        search_keyword: Optional[str] = None,
        page: int = 1,
    ) -> OrderListResult:
        """
        주문 목록 조회
        
        GET/POST /partner/order/orderList.do
        
        Parameters:
            start_date:     시작일 (YYYY-MM-DD)
            end_date:       종료일 (YYYY-MM-DD)
            date_all:       전체기간 여부
            coupon_status:  쿠폰 상태 필터 ["사용가능","사용완료","취소","기간만료"]
            search_type:    검색유형 ("이름" / "휴대폰번호")
            search_keyword: 검색어
            page:           페이지 번호
        
        URL 파라미터 예시:
            dateType=1
            &dateAll=true
            &startDate=2026-02-28
            &endDate=2026-02-28
            &datespan=
            &couponStatus=사용가능
            &couponStatus=사용완료
            &couponStatus=취소
            &couponStatus=기간만료
            &searchType=휴대폰번호
            &searchKeyword=010-2037-5015
            &page=1
        """
        self._ensure_login()
        
        today = datetime.now().strftime("%Y-%m-%d")
        if not start_date:
            start_date = today
        if not end_date:
            end_date = today
        
        # 기본 쿠폰 상태: 전체
        if coupon_status is None:
            coupon_status = ["사용가능", "사용완료", "취소", "기간만료"]
        
        # ============================================================
        # 실제 확인된 파라미터 (Network > Payload 탭)
        # ============================================================
        # 상태 필터 boolean 매핑
        status_param_map = {
            "사용가능": "use",
            "사용완료": "useComplete",
            "취소": "cancel",
            "기간만료": "expire",
        }
        
        # 검색 조건 매핑 (searchCnd 값)
        search_cnd_map = {
            "이름": "recvName",
            "휴대폰번호": "recvPhone",
        }
        
        # 파라미터 조립 (순서 유지)
        param_list = [
            ("dateType", 1),
            ("dateAll", "true"),
            ("dateAll", "false"),
            ("startDate", start_date),
            ("endDate", end_date),
            ("datespan", ""),
        ]
        
        # 쿠폰 상태 필터 (각각 true/false 쌍으로 전송)
        for status_name, param_name in status_param_map.items():
            is_active = status_name in coupon_status
            param_list.append((param_name, "true" if is_active else "false"))
            param_list.append((param_name, "false" if is_active else "true"))
        
        # state 파라미터 (빈 값)
        param_list.append(("state", ""))
        
        # 검색 조건
        if search_type and search_keyword:
            cnd = search_cnd_map.get(search_type, search_type)
            param_list.append(("searchCnd", cnd))
            param_list.append(("searchWrd", search_keyword))
            param_list.append(("btSearch", "검색"))
        
        try:
            resp = self.session.get(
                f"{self.base_url}/order/orderList.do",
                params=param_list,
                timeout=self.timeout,
            )
            resp.raise_for_status()
            return self._parse_order_list(resp.text, page)
            
        except Exception as e:
            logger.error(f"주문 목록 조회 에러: {e}")
            return OrderListResult()
    
    def search_by_phone(self, phone: str, **kwargs) -> OrderListResult:
        """휴대폰번호로 주문 검색"""
        return self.get_orders(
            search_type="휴대폰번호",
            search_keyword=phone,
            **kwargs,
        )
    
    def search_by_name(self, name: str, **kwargs) -> OrderListResult:
        """이름으로 주문 검색"""
        return self.get_orders(
            search_type="이름",
            search_keyword=name,
            **kwargs,
        )
    
    def get_today_orders(self, **kwargs) -> OrderListResult:
        """오늘 주문 조회"""
        today = datetime.now().strftime("%Y-%m-%d")
        return self.get_orders(
            start_date=today,
            end_date=today,
            date_all=False,
            **kwargs,
        )
    
    def get_available_orders(self, **kwargs) -> OrderListResult:
        """사용가능 주문만 조회"""
        return self.get_orders(
            coupon_status=["사용가능"],
            **kwargs,
        )
    
    def get_all_orders(self, max_pages: int = 50) -> List[Order]:
        """
        전체 주문 목록 조회 (페이징 처리)
        
        Returns:
            전체 주문 리스트
        """
        all_orders = []
        page = 1
        
        while page <= max_pages:
            result = self.get_orders(page=page, date_all=True)
            all_orders.extend(result.orders)
            
            if not result.has_more:
                break
            
            page += 1
            time.sleep(0.5)  # 서버 부하 방지
        
        logger.info(f"전체 주문 {len(all_orders)}건 조회 완료")
        return all_orders
    
    # ----------------------------------------------------------
    # 3. 상태 변경 (사용완료 처리)
    # ----------------------------------------------------------
    def update_status(
        self,
        order_no,
        status: str = "사용완료",
    ) -> bool:
        """
        쿠폰 상태 변경 (사용완료/사용가능/취소)
        
        POST /partner/order/changeStatus.do
        Content-Type: application/json
        X-Requested-With: XMLHttpRequest
        
        Payload:
            {"status": 0, "ids": [782608]}
        
        Parameters:
            order_no:   내부 DB ID (int 또는 int 리스트)
                        ※ 화면의 '번호' 컬럼이 아닌 내부 ID
                        ※ HTML 체크박스 value 또는 파싱으로 추출
            status:     변경할 상태 ("사용완료"/"사용가능"/"취소")
        
        Status codes:
            0 = 사용가능
            1 = 사용완료
            2 = 취소
        
        Returns:
            True if successful
        """
        self._ensure_login()
        
        # ============================================================
        # 확인된 엔드포인트: POST /partner/order/changeStatus.do
        # Content-Type: application/json (Request Payload)
        # 
        # Payload 구조:
        #   { "status": 0, "ids": [782608] }
        #
        # status 값:
        #   0 = 사용가능
        #   1 = 사용완료  (추정)
        #   2 = 취소      (추정)
        #
        # ids: 내부 DB ID 배열 (주문 번호가 아님!)
        # ============================================================
        CHANGE_STATUS_URL = f"{self.base_url}/order/changeStatus.do"
        
        # 상태값 → 숫자 매핑
        STATUS_CODE_MAP = {
            "사용가능": 0,
            "사용완료": 1,
            "취소": 2,
        }
        
        status_code = STATUS_CODE_MAP.get(status)
        if status_code is None:
            logger.error(f"알 수 없는 상태값: {status}")
            return False
        
        # ids 파라미터 처리 (단일 또는 배열)
        if isinstance(order_no, list):
            ids = [int(x) for x in order_no]
        else:
            ids = [int(order_no)]
        
        import json
        
        try:
            resp = self.session.post(
                CHANGE_STATUS_URL,
                json={"status": status_code, "ids": ids},
                headers={
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest",
                },
                timeout=self.timeout,
            )
            
            if resp.status_code == 200:
                logger.info(f"✅ 상태 변경 성공: ids={ids} → {status} (code={status_code})")
                return True
            else:
                logger.warning(f"❌ 상태 변경 실패: HTTP {resp.status_code}")
                return False
            
        except Exception as e:
            logger.error(f"상태 변경 에러: {e}")
            return False
    
    def mark_as_used(self, internal_id) -> bool:
        """사용완료 처리 (편의 메서드)"""
        return self.update_status(internal_id, status="사용완료")
    
    def mark_as_available(self, internal_id) -> bool:
        """사용가능으로 복원"""
        return self.update_status(internal_id, status="사용가능")
    
    def mark_as_cancelled(self, internal_id) -> bool:
        """취소 처리"""
        return self.update_status(internal_id, status="취소")
    
    def bulk_update_status(
        self,
        internal_ids: List[int],
        status: str = "사용완료",
    ) -> bool:
        """
        일괄 상태 변경 (한번의 요청으로 처리)
        
        changeStatus.do는 ids 배열을 지원하므로
        여러 건을 한번에 처리 가능.
        
        Parameters:
            internal_ids: 내부 DB ID 리스트 [782608, 782607, ...]
            status: 변경할 상태
        
        Returns:
            True if successful
            
        사용 예시:
            api.bulk_update_status([782608, 782607], status="사용완료")
        """
        return self.update_status(internal_ids, status=status)
    
    # ----------------------------------------------------------
    # 4. 상세내역 조회
    # ----------------------------------------------------------
    def get_order_detail(self, order_no: str) -> Optional[Dict]:
        """
        주문 상세내역 조회
        
        추정 엔드포인트:
            GET /partner/order/orderDetail.do?no={order_no}
            또는
            GET /partner/order/detail.do?no={order_no}
        
        Note:
            스크린샷의 "상세내역" 버튼 클릭 시 호출되는 URL을
            브라우저 개발자도구에서 확인 필요
        """
        self._ensure_login()
        
        detail_urls = [
            f"{self.base_url}/order/orderDetail.do",
            f"{self.base_url}/order/detail.do",
        ]
        
        for url in detail_urls:
            try:
                resp = self.session.get(
                    url,
                    params={"no": order_no},
                    timeout=self.timeout,
                )
                if resp.status_code == 200 and len(resp.text) > 200:
                    return self._parse_order_detail(resp.text)
            except requests.RequestException:
                continue
        
        logger.warning(f"상세내역 조회 실패: {order_no}")
        return None
    
    # ----------------------------------------------------------
    # 5. 엔드포인트 자동 탐지 (초기 설정용)
    # ----------------------------------------------------------
    def discover_status_endpoint(self) -> Optional[Dict]:
        """
        상태 변경 엔드포인트 자동 탐지
        
        주문 목록 페이지의 JavaScript를 분석하여
        상태 변경 시 호출되는 실제 URL과 파라미터를 찾습니다.
        
        Returns:
            {"url": "실제URL", "method": "POST", "params": {...}} 또는 None
        """
        self._ensure_login()
        
        try:
            resp = self.session.get(
                f"{self.base_url}/order/orderList.do",
                params={"dateType": 1, "dateAll": "true"},
                timeout=self.timeout,
            )
            
            html = resp.text
            
            # JavaScript에서 상태변경 관련 함수 찾기
            patterns = [
                # AJAX 호출 패턴
                r"(?:url|action)\s*[:=]\s*['\"]([^'\"]*(?:status|update|change)[^'\"]*)['\"]",
                # function 정의 패턴
                r"function\s+\w*(?:status|update|change|modify)\w*\s*\([^)]*\)\s*\{([^}]+)\}",
                # $.ajax, $.post, fetch 패턴
                r"(?:\$\.(?:ajax|post|get)|fetch)\s*\(\s*['\"]([^'\"]+)['\"]",
                # form action 패턴
                r"<form[^>]*action=['\"]([^'\"]*(?:status|update)[^'\"]*)['\"]",
            ]
            
            found_endpoints = []
            for pattern in patterns:
                matches = re.findall(pattern, html, re.IGNORECASE | re.DOTALL)
                found_endpoints.extend(matches)
            
            if found_endpoints:
                logger.info(f"발견된 엔드포인트 후보: {found_endpoints}")
                return {
                    "candidates": found_endpoints,
                    "raw_js_snippets": [
                        m for m in re.findall(
                            r'(?:function\s+\w*(?:status|change|update)\w*[^}]+})',
                            html, re.IGNORECASE
                        )
                    ]
                }
            
            # select 태그의 onchange 이벤트 확인
            soup = BeautifulSoup(html, "html.parser")
            selects = soup.select("select")
            for sel in selects:
                onchange = sel.get("onchange", "")
                if onchange:
                    logger.info(f"Select onchange 발견: {onchange}")
                    found_endpoints.append(onchange)
            
            return {"candidates": found_endpoints} if found_endpoints else None
            
        except Exception as e:
            logger.error(f"엔드포인트 탐지 에러: {e}")
            return None
    
    # ----------------------------------------------------------
    # 내부 메서드
    # ----------------------------------------------------------
    def _ensure_login(self):
        if not self._logged_in:
            raise RuntimeError("로그인이 필요합니다. api.login(user_id, password)를 먼저 호출하세요.")
    
    def _parse_order_list(self, html: str, page: int = 1) -> OrderListResult:
        """주문 목록 HTML 파싱"""
        soup = BeautifulSoup(html, "html.parser")
        result = OrderListResult(page=page)
        
        # 상단 요약 정보 파싱 (주문: 8,773건 / 수량: 29,419장 / 판매가: 0원 / 공급가: 0원)
        summary_text = soup.get_text()
        summary_match = re.search(
            r"주문\s*:\s*([\d,]+)건.*?수량\s*:\s*([\d,]+)장.*?판매가\s*:\s*([\d,]+)원.*?공급가\s*:\s*([\d,]+)원",
            summary_text
        )
        if summary_match:
            result.total_orders = int(summary_match.group(1).replace(",", ""))
            result.total_quantity = int(summary_match.group(2).replace(",", ""))
            result.total_sale_price = int(summary_match.group(3).replace(",", ""))
            result.total_supply_price = int(summary_match.group(4).replace(",", ""))
        
        # 테이블 행 파싱
        table = soup.select_one("table")
        if not table:
            return result
        
        rows = table.select("tr")
        header_found = False
        
        for row in rows:
            # 헤더 행 건너뛰기
            if row.select("th"):
                header_found = True
                continue
            
            if not header_found:
                continue
            
            cols = row.select("td")
            if len(cols) < 10:
                continue
            
            try:
                # 내부 DB ID 추출 (체크박스 value에서)
                checkbox = row.select_one("input[type='checkbox']")
                internal_id = 0
                if checkbox:
                    val = checkbox.get("value", "0")
                    try:
                        internal_id = int(val)
                    except ValueError:
                        internal_id = 0
                
                order = Order(
                    internal_id=internal_id,                       # 내부 DB ID
                    no=self._clean_text(cols[1]),                  # 번호
                    order_id=self._clean_text(cols[2]),            # 주문번호
                    product_name=self._clean_text(cols[3]),        # 상품명
                    reservation_date=self._clean_text(cols[4]),    # 예약일자
                    sale_price=self._parse_int(cols[5]),           # 판매가
                    supply_price=self._parse_int(cols[6]),         # 공급가
                    coupon_no=self._clean_text(cols[7]),           # 쿠폰번호
                    valid_period=self._clean_text(cols[8]),        # 유효기간
                    company=self._clean_text(cols[9]),             # 회사(기관명)
                    buyer_name=self._clean_text(cols[10]),         # 이름
                    phone=self._clean_text(cols[11]),              # 휴대폰번호
                    sent_at=self._clean_text(cols[12]),            # 발송일시
                    remaining_total=self._clean_text(cols[13]),    # 잔여/총수량
                    status=self._clean_text(cols[14]),             # 상태
                    processed_at=self._clean_text(cols[16]) if len(cols) > 16 else "",
                )
                
                # 체크박스 열(0번째) 건너뛰기 보정
                # 실제 컬럼 순서가 다를 수 있으므로 인덱스 조정 가능
                if order.order_id or order.coupon_no:
                    result.orders.append(order)
                    
            except (IndexError, ValueError) as e:
                logger.debug(f"행 파싱 건너뜀: {e}")
                continue
        
        # 페이징 확인
        paging = soup.select(".paging a, .pagination a, [onclick*='page']")
        if paging:
            result.has_more = True
        
        logger.info(f"주문 {len(result.orders)}건 파싱 완료 (전체: {result.total_orders}건)")
        return result
    
    def _parse_order_detail(self, html: str) -> Dict:
        """주문 상세 HTML 파싱"""
        soup = BeautifulSoup(html, "html.parser")
        detail = {}
        
        # 테이블 기반 상세정보 파싱
        for row in soup.select("tr"):
            th = row.select_one("th, td.label")
            td = row.select_one("td:not(.label)")
            if th and td:
                key = self._clean_text_elem(th)
                value = self._clean_text_elem(td)
                if key:
                    detail[key] = value
        
        return detail
    
    @staticmethod
    def _clean_text(element) -> str:
        """HTML 요소에서 깨끗한 텍스트 추출"""
        if element is None:
            return ""
        text = element.get_text(strip=True)
        return re.sub(r'\s+', ' ', text).strip()
    
    @staticmethod
    def _clean_text_elem(element) -> str:
        if element is None:
            return ""
        return element.get_text(strip=True)
    
    @staticmethod
    def _parse_int(element) -> int:
        """텍스트에서 숫자 추출"""
        if element is None:
            return 0
        text = element.get_text(strip=True)
        numbers = re.findall(r'\d+', text.replace(",", ""))
        return int("".join(numbers)) if numbers else 0
    
    def __repr__(self):
        status = "로그인됨" if self._logged_in else "미로그인"
        return f"<WinnTicketAPI({self._user_id or 'N/A'}, {status})>"


# ============================================================
# 편의 함수: 빠른 사용
# ============================================================
def quick_connect(user_id: str = "jamsa", password: str = "1234") -> WinnTicketAPI:
    """빠른 연결"""
    api = WinnTicketAPI()
    if not api.login(user_id, password):
        raise ConnectionError("로그인 실패")
    return api


def fetch_and_process(
    user_id: str = "jamsa",
    password: str = "1234",
    phone: Optional[str] = None,
    auto_mark_used: bool = False,
) -> List[Order]:
    """
    주문 조회 + 선택적 사용완료 처리
    
    사용 예시:
        # 조회만
        orders = fetch_and_process(phone="010-2037-5015")
        
        # 조회 후 자동 사용완료 처리
        orders = fetch_and_process(phone="010-2037-5015", auto_mark_used=True)
    """
    api = quick_connect(user_id, password)
    
    if phone:
        result = api.search_by_phone(phone)
    else:
        result = api.get_today_orders()
    
    if auto_mark_used:
        for order in result.orders:
            if order.status == "사용가능" and order.internal_id:
                api.mark_as_used(order.internal_id)
    
    return result.orders


# ============================================================
# CLI 실행
# ============================================================
if __name__ == "__main__":
    import argparse
    import json
    
    parser = argparse.ArgumentParser(description="la2fdoci.com 주문 관리 API")
    parser.add_argument("--id", default="jamsa", help="관리자 ID")
    parser.add_argument("--pw", default="1234", help="비밀번호")
    parser.add_argument("--action", choices=["list", "search", "use", "discover"],
                        default="list", help="수행할 작업")
    parser.add_argument("--phone", help="검색할 휴대폰번호")
    parser.add_argument("--name", help="검색할 이름")
    parser.add_argument("--ids", nargs="+", type=int, help="상태 변경할 내부 DB ID (복수 가능)")
    parser.add_argument("--status", default="사용완료",
                        choices=["사용가능", "사용완료", "취소"],
                        help="변경할 상태")
    parser.add_argument("--date", help="조회 날짜 (YYYY-MM-DD)")
    
    args = parser.parse_args()
    
    api = WinnTicketAPI()
    
    if not api.login(args.id, args.pw):
        print("❌ 로그인 실패")
        exit(1)
    
    print(f"✅ 로그인 성공: {args.id}")
    
    if args.action == "list":
        result = api.get_orders(
            start_date=args.date,
            end_date=args.date,
            date_all=not bool(args.date),
        )
        print(f"\n📋 주문 목록 (총 {result.total_orders}건)")
        for o in result.orders:
            print(f"  [ID:{o.internal_id}] {o.buyer_name} | {o.phone} | {o.coupon_no} | {o.status}")
    
    elif args.action == "search":
        if args.phone:
            result = api.search_by_phone(args.phone)
        elif args.name:
            result = api.search_by_name(args.name)
        else:
            print("--phone 또는 --name을 지정하세요")
            exit(1)
        
        print(f"\n🔍 검색 결과 ({len(result.orders)}건)")
        for o in result.orders:
            print(f"  [ID:{o.internal_id}] {o.buyer_name} | {o.coupon_no} | {o.status}")
    
    elif args.action == "use":
        if not args.ids:
            print("--ids를 지정하세요 (예: --ids 782608 782607)")
            exit(1)
        
        success = api.bulk_update_status(args.ids, args.status)
        print(f"{'✅' if success else '❌'} 상태 변경: {args.ids} → {args.status}")
    
    elif args.action == "discover":
        info = api.discover_status_endpoint()
        if info:
            print("\n🔍 발견된 엔드포인트 후보:")
            print(json.dumps(info, ensure_ascii=False, indent=2))
        else:
            print("엔드포인트를 찾지 못했습니다.")
