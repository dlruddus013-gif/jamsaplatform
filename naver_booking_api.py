"""
============================================================
네이버 스마트플레이스 예약 관리 API
- 로그인 → 예매현황 크롤링 → 이용완료 처리
- FastAPI 기반 REST API
============================================================
"""

import asyncio
import json
import os
import re
import time
import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from playwright.async_api import async_playwright, Browser, BrowserContext, Page

# ──────────────────────────────────────────────
# 설정
# ──────────────────────────────────────────────
CONFIG = {
    "NAVER_ID": "jamsa0433",
    "NAVER_PW": "skyeduc0089@",
    "BIZ_ID": "784618",
    "BASE_URL": "https://partner.booking.naver.com",
    "LOGIN_URL": "https://nid.naver.com/nidlogin.login",
    "SESSION_TIMEOUT_MIN": 30,       # 세션 유효시간(분)
    "DATA_DIR": "./booking_data",    # 크롤링 데이터 저장
    "COOKIE_FILE": "./naver_cookies.json",  # 쿠키 저장 파일
}

os.makedirs(CONFIG["DATA_DIR"], exist_ok=True)


def has_saved_cookies() -> bool:
    """저장된 쿠키 파일이 있는지 확인"""
    if not os.path.exists(CONFIG["COOKIE_FILE"]):
        return False
    try:
        with open(CONFIG["COOKIE_FILE"], 'r') as f:
            cookies = json.load(f)
        # 쿠키가 비어있으면 False
        if not cookies or len(cookies) == 0:
            return False
        # 쿠키 저장 시간 확인 (7일 초과면 만료 처리)
        file_time = os.path.getmtime(CONFIG["COOKIE_FILE"])
        age_days = (time.time() - file_time) / 86400
        if age_days > 7:
            logger.info("⏰ 저장된 쿠키가 7일 지남 → 재인증 필요")
            return False
        return True
    except:
        return False


async def save_cookies():
    """현재 브라우저 쿠키를 파일로 저장"""
    if browser_state["context"]:
        cookies = await browser_state["context"].cookies()
        with open(CONFIG["COOKIE_FILE"], 'w', encoding='utf-8') as f:
            json.dump(cookies, f, ensure_ascii=False, indent=2)
        logger.info(f"🍪 쿠키 {len(cookies)}개 저장 완료 → 다음부터 자동 로그인됩니다")


async def load_cookies():
    """저장된 쿠키를 브라우저에 로드"""
    if not os.path.exists(CONFIG["COOKIE_FILE"]):
        return False
    try:
        with open(CONFIG["COOKIE_FILE"], 'r') as f:
            cookies = json.load(f)
        if browser_state["context"] and cookies:
            await browser_state["context"].add_cookies(cookies)
            logger.info(f"🍪 저장된 쿠키 {len(cookies)}개 로드 완료")
            return True
    except Exception as e:
        logger.warning(f"⚠️ 쿠키 로드 실패: {e}")
    return False

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("NaverBooking")

# ──────────────────────────────────────────────
# 전역 상태
# ──────────────────────────────────────────────
browser_state = {
    "playwright": None,
    "browser": None,
    "context": None,
    "page": None,
    "logged_in": False,
    "login_time": None,
    "last_crawl": None,
    "cached_bookings": [],
    "cached_calendar": {},
    "headless": None,
}


# ──────────────────────────────────────────────
# Pydantic 모델
# ──────────────────────────────────────────────
class BookingItem(BaseModel):
    status: str                    # 확정, 이용완료, 예매취소, 노쇼
    name: str                      # 예매자명
    phone: str                     # 전화번호
    booking_id: str                # 예매번호
    use_date: str                  # 이용일
    product: Optional[str] = None  # 상품명
    email: Optional[str] = None
    booking_type: Optional[str] = None  # 예매유형
    payment_status: Optional[str] = None
    payment_amount: Optional[int] = None
    payment_method: Optional[str] = None
    npay_order_no: Optional[str] = None
    entry_path: Optional[str] = None  # 유입경로

class CalendarDay(BaseModel):
    date: str
    remaining: int
    completed: int

class CompleteRequest(BaseModel):
    booking_ids: List[str]         # 이용완료 처리할 예매번호 목록

class CompleteResult(BaseModel):
    booking_id: str
    success: bool
    message: str

class BatchCompleteResponse(BaseModel):
    total: int
    success_count: int
    fail_count: int
    results: List[CompleteResult]


# ──────────────────────────────────────────────
# 브라우저 관리
# ──────────────────────────────────────────────
async def init_browser(headless: bool = None):
    """Playwright 브라우저 초기화
    headless=None이면 자동 판단:
      - 저장된 쿠키 있음 → 숨김모드(True)
      - 쿠키 없음 → 화면표시(False) = 처음이니까 직접 인증해야 함
    """
    if browser_state["browser"] is not None:
        return

    if headless is None:
        headless = has_saved_cookies()  # 쿠키 있으면 숨김, 없으면 화면표시

    mode_text = "숨김모드(서버)" if headless else "🖥️ 화면모드(인증용)"
    logger.info(f"🌐 브라우저 시작: {mode_text}")

    if not headless:
        logger.info("━" * 50)
        logger.info("📢 처음 실행이라 브라우저 화면이 뜹니다!")
        logger.info("📢 네이버 인증을 완료해주세요. 자동으로 진행됩니다.")
        logger.info("📢 한번만 하면 다음부터는 화면 없이 자동으로 돌아갑니다!")
        logger.info("━" * 50)

    pw = await async_playwright().start()
    browser_state["playwright"] = pw
    browser_state["browser"] = await pw.chromium.launch(
        headless=headless,
        args=["--no-sandbox", "--disable-setuid-sandbox"]
    )
    browser_state["context"] = await browser_state["browser"].new_context(
        viewport={"width": 1920, "height": 1080},
        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        locale="ko-KR",
    )
    browser_state["page"] = await browser_state["context"].new_page()
    browser_state["headless"] = headless
    logger.info("✅ 브라우저 초기화 완료")


async def close_browser():
    """브라우저 종료"""
    if browser_state["browser"]:
        await browser_state["browser"].close()
    if browser_state["playwright"]:
        await browser_state["playwright"].stop()
    browser_state.update({"playwright": None, "browser": None, "context": None, "page": None, "logged_in": False, "headless": None})
    logger.info("🔴 브라우저 종료")


def is_session_valid() -> bool:
    """세션 유효성 확인"""
    if not browser_state["logged_in"] or not browser_state["login_time"]:
        return False
    elapsed = (datetime.now() - browser_state["login_time"]).total_seconds() / 60
    return elapsed < CONFIG["SESSION_TIMEOUT_MIN"]


# ──────────────────────────────────────────────
# 네이버 로그인
# ──────────────────────────────────────────────
async def naver_login() -> bool:
    """네이버 로그인 (자동 모드 전환)
    
    동작 방식:
    1. 저장된 쿠키가 있으면 → 숨김모드로 쿠키 로그인 시도
    2. 쿠키 로그인 실패하면 → 브라우저 닫고 화면모드로 재시작
    3. 쿠키가 없으면 → 처음부터 화면모드로 시작
    4. 로그인 성공하면 → 쿠키 저장 (다음부턴 숨김모드)
    """
    await init_browser()  # 자동으로 headless 판단
    page = browser_state["page"]

    # ── 1단계: 저장된 쿠키로 빠른 로그인 시도 ──
    if has_saved_cookies():
        logger.info("🍪 저장된 쿠키로 로그인 시도...")
        await load_cookies()

        try:
            test_url = f"{CONFIG['BASE_URL']}/bizes/{CONFIG['BIZ_ID']}/booking-calendar-view"
            await page.goto(test_url, wait_until="networkidle", timeout=20000)
            await page.wait_for_timeout(2000)

            current_url = page.url
            if "partner.booking.naver.com" in current_url and "nidlogin" not in current_url:
                browser_state["logged_in"] = True
                browser_state["login_time"] = datetime.now()
                logger.info("✅ 쿠키 로그인 성공! (화면 없이 자동 로그인됨)")
                return True

            logger.info("⚠️ 쿠키 만료됨 → 화면모드로 재로그인...")
        except:
            logger.info("⚠️ 쿠키 로그인 실패 → 화면모드로 재로그인...")

        # 쿠키 실패 → 브라우저 닫고 화면모드로 재시작
        await close_browser()
        await init_browser(headless=False)
        page = browser_state["page"]

    # ── 2단계: ID/PW 로그인 ──
    try:
        login_url = f"{CONFIG['LOGIN_URL']}?mode=form&url=https%3A%2F%2Fpartner.booking.naver.com%2Fbizes%2F{CONFIG['BIZ_ID']}%2Fbooking-calendar-view"
        await page.goto(login_url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # ID/전화번호 탭 클릭
        try:
            id_tab = page.locator('a:has-text("ID/전화번호"), li:has-text("ID/전화번호")')
            if await id_tab.count() > 0:
                await id_tab.first.click()
                await page.wait_for_timeout(500)
        except:
            pass

        # 아이디 입력
        await page.evaluate(f'''() => {{
            const input = document.querySelector('#id');
            if (input) {{
                input.focus();
                input.value = '{CONFIG["NAVER_ID"]}';
                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                input.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}
        }}''')
        await page.wait_for_timeout(500)

        # 비밀번호 입력
        await page.evaluate(f'''() => {{
            const input = document.querySelector('#pw');
            if (input) {{
                input.focus();
                input.value = '{CONFIG["NAVER_PW"]}';
                input.dispatchEvent(new Event('input', {{ bubbles: true }}));
                input.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}
        }}''')
        await page.wait_for_timeout(500)

        # 로그인 버튼 클릭
        login_btn = page.locator('#log\\.login, button:has-text("로그인"), .btn_login')
        await login_btn.first.click()
        await page.wait_for_timeout(5000)

        # ── 3단계: 2차 인증 대기 (화면모드일 때) ──
        current_url = page.url

        # 바로 성공한 경우
        if "partner.booking.naver.com" in current_url:
            await _login_success()
            return True

        # 2차 인증 필요 → 사용자가 직접 처리할 때까지 대기
        if not browser_state.get("headless", True):
            logger.info("━" * 50)
            logger.info("📢 브라우저에서 네이버 인증을 완료해주세요!")
            logger.info("📢 (문자인증, QR인증, 캡챠 등)")
            logger.info("📢 최대 2분 동안 기다립니다...")
            logger.info("━" * 50)

            # 최대 120초 대기 (2초 간격으로 체크)
            for i in range(60):
                await page.wait_for_timeout(2000)
                current_url = page.url

                # 스마트플레이스로 이동하면 성공
                if "partner.booking.naver.com" in current_url:
                    await _login_success()
                    return True

                # "나중에 등록" 등 팝업 자동 처리
                try:
                    skip_btn = page.locator('button:has-text("나중에 등록"), a:has-text("나중에"), button:has-text("건너뛰기")')
                    if await skip_btn.count() > 0:
                        await skip_btn.first.click()
                        await page.wait_for_timeout(2000)
                except:
                    pass

                if i % 10 == 9:
                    remaining = (60 - i) * 2
                    logger.info(f"⏳ 인증 대기 중... (남은 시간: {remaining}초)")

            logger.error("❌ 2분 초과 - 인증 시간 초과")
        else:
            # 숨김모드에서 실패 → 화면모드로 재시도
            logger.info("⚠️ 숨김모드에서 로그인 실패 → 화면모드로 전환")
            await close_browser()
            await init_browser(headless=False)
            return await naver_login()  # 재귀호출 (화면모드로)

        return False

    except Exception as e:
        logger.error(f"❌ 로그인 실패: {e}")
        return False


async def _login_success():
    """로그인 성공 후처리 (쿠키 저장 + 상태 업데이트)"""
    browser_state["logged_in"] = True
    browser_state["login_time"] = datetime.now()
    await save_cookies()  # 🍪 쿠키 저장 → 다음엔 숨김모드로 자동 로그인

    if not browser_state.get("headless", True):
        logger.info("━" * 50)
        logger.info("✅ 로그인 성공! 쿠키가 저장되었습니다.")
        logger.info("✅ 다음부터는 브라우저 화면 없이 자동으로 돌아갑니다!")
        logger.info("━" * 50)
        # 화면모드로 인증 완료 → 숨김모드로 전환
        logger.info("🔄 숨김모드로 전환 중...")
        await close_browser()
        await init_browser(headless=True)
        await load_cookies()
        # 다시 스마트플레이스 접속
        page = browser_state["page"]
        await page.goto(
            f"{CONFIG['BASE_URL']}/bizes/{CONFIG['BIZ_ID']}/booking-calendar-view",
            wait_until="networkidle", timeout=30000
        )
        browser_state["logged_in"] = True
        browser_state["login_time"] = datetime.now()
        logger.info("✅ 숨김모드 전환 완료! 서버 정상 운영 시작")
    else:
        logger.info("✅ 로그인 성공! (숨김모드)")


async def ensure_login():
    """로그인 상태 보장"""
    if not is_session_valid():
        logger.info("🔄 세션 만료, 재로그인...")
        success = await naver_login()
        if not success:
            raise HTTPException(status_code=401, detail="네이버 로그인 실패. 캡챠 또는 2차인증이 필요할 수 있습니다.")


# ──────────────────────────────────────────────
# 데이터 크롤링
# ──────────────────────────────────────────────
async def crawl_calendar(start_date: str = None, end_date: str = None) -> Dict:
    """예매현황 캘린더 데이터 크롤링"""
    await ensure_login()
    page = browser_state["page"]

    url = f"{CONFIG['BASE_URL']}/bizes/{CONFIG['BIZ_ID']}/booking-calendar-view"
    await page.goto(url, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(3000)

    # 페이지에서 데이터 추출
    calendar_data = await page.evaluate('''() => {
        const result = { period: "", products: [] };

        // 기간 정보
        const periodEl = document.querySelector('[class*="period"], [class*="date-range"]');
        if (periodEl) result.period = periodEl.textContent.trim();

        // 테이블 데이터 추출
        const rows = document.querySelectorAll('table tbody tr, [class*="calendar"] [class*="row"]');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td, [class*="cell"]');
            const productNameEl = row.querySelector('[class*="product"], th, td:first-child');
            if (productNameEl && cells.length > 0) {
                const product = { name: productNameEl.textContent.trim(), days: [] };
                cells.forEach(cell => {
                    const text = cell.textContent.trim();
                    const remaining = text.match(/잔여\\s*(\\d+[,\\d]*)/);
                    const completed = text.match(/완료\\s*(\\d+)/);
                    product.days.push({
                        remaining: remaining ? parseInt(remaining[1].replace(',','')) : null,
                        completed: completed ? parseInt(completed[1]) : null,
                        raw: text
                    });
                });
                result.products.push(product);
            }
        });

        return result;
    }''')

    browser_state["cached_calendar"] = calendar_data
    browser_state["last_crawl"] = datetime.now().isoformat()

    # 저장
    save_path = os.path.join(CONFIG["DATA_DIR"], f"calendar_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(save_path, 'w', encoding='utf-8') as f:
        json.dump(calendar_data, f, ensure_ascii=False, indent=2)

    return calendar_data


async def crawl_booking_list(
    date_from: str = None,
    date_to: str = None,
    status_filter: str = "all",
    place_name: str = None
) -> List[Dict]:
    """예매자관리 목록 크롤링"""
    await ensure_login()
    page = browser_state["page"]

    # 기본 날짜 설정 (오늘)
    if not date_from:
        date_from = datetime.now().strftime("%Y-%m-%d")
    if not date_to:
        date_to = date_from

    # 예매자관리 페이지 이동
    url = f"{CONFIG['BASE_URL']}/bizes/{CONFIG['BIZ_ID']}/booking-list-view"
    await page.goto(url, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(3000)

    # 업체 선택 (드롭다운에서 선택)
    if place_name:
        try:
            dropdown = page.locator('[class*="select"], [class*="dropdown"]').first
            await dropdown.click()
            await page.wait_for_timeout(500)
            option = page.locator(f'text="{place_name}"')
            if await option.count() > 0:
                await option.first.click()
                await page.wait_for_timeout(2000)
        except:
            pass

    # 상태 필터 처리
    status_map = {
        "confirmed": "확정",
        "completed": "이용완료",
        "cancelled": "예매취소",
        "noshow": "노쇼",
        "all": "전체"
    }

    if status_filter != "all" and status_filter in status_map:
        try:
            filter_btn = page.locator(f'button:has-text("{status_map[status_filter]}"), [class*="tab"]:has-text("{status_map[status_filter]}")')
            if await filter_btn.count() > 0:
                await filter_btn.first.click()
                await page.wait_for_timeout(2000)
        except:
            pass

    # 테이블 데이터 추출
    bookings = await page.evaluate('''() => {
        const result = [];
        const rows = document.querySelectorAll('table tbody tr, [class*="booking-item"], [class*="list-item"]');

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 4) {
                const statusEl = row.querySelector('[class*="badge"], [class*="status"], [class*="state"]');
                const status = statusEl ? statusEl.textContent.trim() : (cells[0] ? cells[0].textContent.trim() : "");
                
                // 체크박스 셀을 건너뜀
                let offset = 0;
                if (cells[0] && cells[0].querySelector('input[type="checkbox"]')) offset = 1;

                result.push({
                    status: status,
                    name: cells[offset + 1] ? cells[offset + 1].textContent.trim() : "",
                    phone: cells[offset + 2] ? cells[offset + 2].textContent.trim() : "",
                    booking_id: cells[offset + 3] ? cells[offset + 3].textContent.trim() : "",
                    use_date: cells[offset + 4] ? cells[offset + 4].textContent.trim() : "",
                });
            }
        });

        return result;
    }''')

    browser_state["cached_bookings"] = bookings
    browser_state["last_crawl"] = datetime.now().isoformat()

    # 저장
    save_path = os.path.join(CONFIG["DATA_DIR"], f"bookings_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
    with open(save_path, 'w', encoding='utf-8') as f:
        json.dump(bookings, f, ensure_ascii=False, indent=2)

    logger.info(f"📋 예매 {len(bookings)}건 크롤링 완료")
    return bookings


async def crawl_booking_detail(booking_id: str) -> Dict:
    """예매 상세정보 크롤링"""
    await ensure_login()
    page = browser_state["page"]

    url = f"{CONFIG['BASE_URL']}/bizes/{CONFIG['BIZ_ID']}/booking-list-view/bookings/{booking_id}"
    await page.goto(url, wait_until="networkidle", timeout=30000)
    await page.wait_for_timeout(2000)

    detail = await page.evaluate('''() => {
        const getText = (label) => {
            const allEls = document.querySelectorAll('dt, th, label, [class*="label"], [class*="key"]');
            for (const el of allEls) {
                if (el.textContent.trim().includes(label)) {
                    const next = el.nextElementSibling || el.parentElement.querySelector('dd, td, [class*="value"]');
                    if (next) return next.textContent.trim();
                }
            }
            // 대체: 텍스트 기반 탐색
            const all = document.body.innerText;
            const regex = new RegExp(label + '\\s*[:：]?\\s*(.+)', 'm');
            const m = all.match(regex);
            return m ? m[1].split('\\n')[0].trim() : null;
        };

        return {
            name: getText('예매자'),
            phone: getText('전화번호'),
            booking_id: getText('예매번호'),
            booking_type: getText('예매유형'),
            email: getText('이메일'),
            product: getText('상품'),
            use_date: getText('이용일'),
            quantity: getText('수량'),
            entry_path: getText('유입경로'),
            payment_status: getText('결제상태'),
            npay_order_no: getText('NPay주문번호'),
            payment_method: getText('결제수단'),
            payment_amount: getText('결제금액'),
        };
    }''')

    logger.info(f"📄 예매 상세 크롤링: {booking_id} → {detail.get('name', 'N/A')}")
    return detail


# ──────────────────────────────────────────────
# 이용완료 처리
# ──────────────────────────────────────────────
async def process_complete(booking_id: str) -> Dict:
    """단건 이용완료 처리"""
    await ensure_login()
    page = browser_state["page"]

    try:
        # 예매 상세 페이지 이동
        url = f"{CONFIG['BASE_URL']}/bizes/{CONFIG['BIZ_ID']}/booking-list-view/bookings/{booking_id}"
        await page.goto(url, wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(2000)

        # "이용완료" 버튼 찾기 및 클릭
        complete_btn = page.locator('button:has-text("이용완료"), a:has-text("이용완료")')
        if await complete_btn.count() == 0:
            return {"booking_id": booking_id, "success": False, "message": "이용완료 버튼을 찾을 수 없습니다. 이미 처리되었거나 취소된 예약일 수 있습니다."}

        await complete_btn.last.click()
        await page.wait_for_timeout(2000)

        # 확인 팝업이 있으면 처리
        try:
            confirm_btn = page.locator('button:has-text("확인"), button:has-text("이용완료")')
            popup_count = await confirm_btn.count()
            if popup_count > 0:
                # 마지막 (가장 위에 뜨는) 확인 버튼 클릭
                await confirm_btn.last.click()
                await page.wait_for_timeout(3000)
        except:
            pass

        # 성공 확인 - URL이 /complete로 변경되었는지
        current_url = page.url
        if "/complete" in current_url:
            # 이용완료 확인 페이지에서 최종 "이용완료" 버튼 클릭
            try:
                final_btn = page.locator('button:has-text("이용완료")')
                if await final_btn.count() > 0:
                    await final_btn.last.click()
                    await page.wait_for_timeout(2000)
            except:
                pass

            logger.info(f"✅ 이용완료 처리 성공: {booking_id}")
            return {"booking_id": booking_id, "success": True, "message": "이용완료 처리 완료"}

        # 상태 확인
        page_text = await page.evaluate('() => document.body.innerText')
        if "이용완료" in page_text:
            logger.info(f"✅ 이용완료 처리 성공: {booking_id}")
            return {"booking_id": booking_id, "success": True, "message": "이용완료 처리 완료"}

        return {"booking_id": booking_id, "success": False, "message": f"처리 결과 불확실. URL: {current_url}"}

    except Exception as e:
        logger.error(f"❌ 이용완료 처리 실패 [{booking_id}]: {e}")
        return {"booking_id": booking_id, "success": False, "message": str(e)}


async def batch_complete(booking_ids: List[str]) -> Dict:
    """다건 이용완료 일괄 처리"""
    results = []
    success = 0
    fail = 0

    for bid in booking_ids:
        result = await process_complete(bid)
        results.append(result)
        if result["success"]:
            success += 1
        else:
            fail += 1
        # 요청 간 딜레이 (과부하 방지)
        await asyncio.sleep(1)

    return {
        "total": len(booking_ids),
        "success_count": success,
        "fail_count": fail,
        "results": results
    }


# ──────────────────────────────────────────────
# 자동 처리: 오늘 확정 → 이용완료
# ──────────────────────────────────────────────
async def auto_complete_today() -> Dict:
    """오늘 이용일인 '확정' 상태 예약 자동 이용완료 처리"""
    today = datetime.now().strftime("%Y-%m-%d")
    today_short = datetime.now().strftime("%m. %d")  # "02. 28" 형식

    # 확정 상태만 크롤링
    bookings = await crawl_booking_list(status_filter="all")

    # 오늘 날짜 + 확정 상태 필터
    target_ids = []
    for b in bookings:
        is_today = today in b.get("use_date", "") or today_short in b.get("use_date", "")
        is_confirmed = "확정" in b.get("status", "")
        if is_today and is_confirmed:
            bid = b.get("booking_id", "").strip()
            if bid:
                target_ids.append(bid)

    if not target_ids:
        return {"message": "오늘 이용완료 처리할 확정 예약이 없습니다.", "count": 0, "results": []}

    logger.info(f"🎯 오늘 확정 예약 {len(target_ids)}건 이용완료 처리 시작")
    result = await batch_complete(target_ids)
    return result


# ──────────────────────────────────────────────
# FastAPI 앱
# ──────────────────────────────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("🚀 서버 시작")
    yield
    await close_browser()
    logger.info("🛑 서버 종료")

app = FastAPI(
    title="네이버 스마트플레이스 예약 관리 API",
    description="한국잠사플레이팜 네이버 예약 크롤링 및 이용완료 처리",
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ──── API 엔드포인트 ────

@app.get("/", response_class=HTMLResponse)
async def dashboard():
    """관리 대시보드"""
    return get_dashboard_html()


@app.post("/api/login")
async def api_login():
    """네이버 로그인"""
    success = await naver_login()
    if success:
        return {"status": "ok", "message": "로그인 성공", "login_time": browser_state["login_time"].isoformat()}
    raise HTTPException(status_code=401, detail="로그인 실패")


@app.get("/api/status")
async def api_status():
    """시스템 상태 확인"""
    return {
        "logged_in": browser_state["logged_in"],
        "session_valid": is_session_valid(),
        "login_time": browser_state["login_time"].isoformat() if browser_state["login_time"] else None,
        "last_crawl": browser_state["last_crawl"],
        "cached_bookings_count": len(browser_state["cached_bookings"]),
        "has_saved_cookies": has_saved_cookies(),
        "headless_mode": browser_state.get("headless"),
    }


@app.get("/api/calendar")
async def api_calendar():
    """예매현황 캘린더 데이터"""
    data = await crawl_calendar()
    return {"status": "ok", "data": data}


@app.get("/api/bookings")
async def api_bookings(
    date_from: str = Query(None, description="시작일 (YYYY-MM-DD)"),
    date_to: str = Query(None, description="종료일 (YYYY-MM-DD)"),
    status: str = Query("all", description="상태필터: all, confirmed, completed, cancelled, noshow"),
    place: str = Query(None, description="업체명"),
):
    """예매 목록 조회"""
    bookings = await crawl_booking_list(
        date_from=date_from,
        date_to=date_to,
        status_filter=status,
        place_name=place,
    )
    return {
        "status": "ok",
        "count": len(bookings),
        "date_from": date_from,
        "date_to": date_to,
        "bookings": bookings,
    }


@app.get("/api/bookings/{booking_id}")
async def api_booking_detail(booking_id: str):
    """예매 상세정보 조회"""
    detail = await crawl_booking_detail(booking_id)
    return {"status": "ok", "data": detail}


@app.post("/api/complete/{booking_id}")
async def api_complete_single(booking_id: str):
    """단건 이용완료 처리"""
    result = await process_complete(booking_id)
    if result["success"]:
        return {"status": "ok", **result}
    raise HTTPException(status_code=400, detail=result["message"])


@app.post("/api/complete/batch")
async def api_complete_batch(request: CompleteRequest):
    """다건 이용완료 일괄 처리"""
    result = await batch_complete(request.booking_ids)
    return {"status": "ok", **result}


@app.post("/api/complete/auto-today")
async def api_auto_complete():
    """오늘 확정 예약 자동 이용완료"""
    result = await auto_complete_today()
    return {"status": "ok", **result}


@app.get("/api/cache")
async def api_cache():
    """캐시된 데이터 조회"""
    return {
        "last_crawl": browser_state["last_crawl"],
        "bookings": browser_state["cached_bookings"],
        "calendar": browser_state["cached_calendar"],
    }


# ──────────────────────────────────────────────
# 대시보드 HTML
# ──────────────────────────────────────────────
def get_dashboard_html():
    return """<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>잠사플레이팜 예약 관리 API</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'Pretendard','Apple SD Gothic Neo',sans-serif; background:#0f172a; color:#e2e8f0; min-height:100vh; }
  .container { max-width:960px; margin:0 auto; padding:24px 16px; }
  h1 { font-size:28px; font-weight:700; margin-bottom:8px; color:#38bdf8; }
  .sub { color:#94a3b8; margin-bottom:32px; font-size:14px; }
  .card { background:#1e293b; border-radius:12px; padding:20px; margin-bottom:16px; border:1px solid #334155; }
  .card h3 { font-size:16px; color:#38bdf8; margin-bottom:12px; display:flex; align-items:center; gap:8px; }
  .endpoint { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid #334155; flex-wrap:wrap; }
  .endpoint:last-child { border-bottom:none; }
  .method { font-size:11px; font-weight:700; padding:3px 8px; border-radius:4px; min-width:50px; text-align:center; }
  .get { background:#065f46; color:#6ee7b7; }
  .post { background:#92400e; color:#fbbf24; }
  .path { font-family:'Fira Code',monospace; font-size:13px; color:#e2e8f0; }
  .desc { font-size:12px; color:#94a3b8; width:100%; padding-left:60px; }
  .btn { display:inline-block; padding:10px 20px; background:#0ea5e9; color:white; border:none; border-radius:8px; cursor:pointer; font-size:14px; font-weight:600; text-decoration:none; }
  .btn:hover { background:#0284c7; }
  .btn-warn { background:#f59e0b; }
  .btn-warn:hover { background:#d97706; }
  .btn-success { background:#10b981; }
  .btn-success:hover { background:#059669; }
  .actions { display:flex; gap:10px; flex-wrap:wrap; margin:16px 0; }
  #result { background:#0f172a; border:1px solid #334155; border-radius:8px; padding:16px; font-family:'Fira Code',monospace; font-size:12px; white-space:pre-wrap; max-height:500px; overflow-y:auto; margin-top:16px; color:#a5f3fc; display:none; }
  .status-dot { width:8px; height:8px; border-radius:50%; display:inline-block; }
  .dot-red { background:#ef4444; }
  .dot-green { background:#22c55e; }
  .loading { display:none; color:#fbbf24; margin:8px 0; }
</style>
</head>
<body>
<div class="container">
  <h1>🐛 잠사플레이팜 예약 관리 API</h1>
  <p class="sub">네이버 스마트플레이스 예약 크롤링 및 이용완료 자동 처리</p>

  <div class="card">
    <h3><span class="status-dot dot-red" id="statusDot"></span> 시스템 상태</h3>
    <div id="statusInfo">로딩 중...</div>
    <div id="cookieInfo" style="margin-top:8px;font-size:13px;color:#94a3b8;"></div>
    <div class="actions">
      <button class="btn" onclick="callApi('/api/login','POST')">🔑 로그인</button>
      <button class="btn btn-success" onclick="callApi('/api/status','GET')">📊 상태확인</button>
    </div>
    <div style="margin-top:12px;padding:12px;background:#0f172a;border-radius:8px;font-size:12px;color:#94a3b8;line-height:1.8;">
      💡 <b style="color:#fbbf24;">자동 모드 전환:</b><br>
      • 처음 실행 → 브라우저 화면이 뜹니다 → 네이버 인증만 하면 끝!<br>
      • 인증 완료 후 → 쿠키 자동 저장 → 다음부터 화면 없이 자동 작동<br>
      • 설정 변경할 것 없이 그냥 실행만 하세요 🎉
    </div>
  </div>

  <div class="card">
    <h3>📋 데이터 크롤링</h3>
    <div class="actions">
      <button class="btn" onclick="callApi('/api/calendar','GET')">📅 캘린더 데이터</button>
      <button class="btn" onclick="callApi('/api/bookings','GET')">📝 예매 목록</button>
      <button class="btn" onclick="callApi('/api/bookings?status=confirmed','GET')">✅ 확정만</button>
      <button class="btn" onclick="callApi('/api/cache','GET')">💾 캐시 조회</button>
    </div>
  </div>

  <div class="card">
    <h3>⚡ 이용완료 처리</h3>
    <div class="actions">
      <button class="btn btn-warn" onclick="callApi('/api/complete/auto-today','POST')">🤖 오늘 자동처리</button>
      <input type="text" id="bookingIdInput" placeholder="예매번호 입력" style="padding:10px;border-radius:8px;border:1px solid #334155;background:#0f172a;color:#e2e8f0;font-size:14px;">
      <button class="btn btn-success" onclick="completeSingle()">이용완료</button>
    </div>
  </div>

  <div class="card">
    <h3>📌 API 엔드포인트</h3>
    <div class="endpoint">
      <span class="method post">POST</span>
      <span class="path">/api/login</span>
      <span class="desc">네이버 로그인</span>
    </div>
    <div class="endpoint">
      <span class="method get">GET</span>
      <span class="path">/api/status</span>
      <span class="desc">시스템 상태 확인</span>
    </div>
    <div class="endpoint">
      <span class="method get">GET</span>
      <span class="path">/api/calendar</span>
      <span class="desc">예매현황 캘린더</span>
    </div>
    <div class="endpoint">
      <span class="method get">GET</span>
      <span class="path">/api/bookings?status=confirmed&date_from=2026-02-28</span>
      <span class="desc">예매 목록 조회 (상태/날짜 필터)</span>
    </div>
    <div class="endpoint">
      <span class="method get">GET</span>
      <span class="path">/api/bookings/{booking_id}</span>
      <span class="desc">예매 상세정보</span>
    </div>
    <div class="endpoint">
      <span class="method post">POST</span>
      <span class="path">/api/complete/{booking_id}</span>
      <span class="desc">단건 이용완료 처리</span>
    </div>
    <div class="endpoint">
      <span class="method post">POST</span>
      <span class="path">/api/complete/batch</span>
      <span class="desc">다건 일괄 이용완료 (body: {"booking_ids": [...]})</span>
    </div>
    <div class="endpoint">
      <span class="method post">POST</span>
      <span class="path">/api/complete/auto-today</span>
      <span class="desc">오늘 확정 예약 자동 이용완료</span>
    </div>
  </div>

  <div class="loading" id="loading">⏳ 처리 중...</div>
  <pre id="result"></pre>
</div>

<script>
async function callApi(path, method='GET', body=null) {
  const loading = document.getElementById('loading');
  const result = document.getElementById('result');
  loading.style.display = 'block';
  result.style.display = 'none';

  try {
    const opts = { method };
    if (body) { opts.headers = {'Content-Type':'application/json'}; opts.body = JSON.stringify(body); }
    const res = await fetch(path, opts);
    const data = await res.json();
    result.textContent = JSON.stringify(data, null, 2);
    result.style.display = 'block';
    checkStatus();
  } catch(e) {
    result.textContent = 'Error: ' + e.message;
    result.style.display = 'block';
  }
  loading.style.display = 'none';
}

function completeSingle() {
  const bid = document.getElementById('bookingIdInput').value.trim();
  if (!bid) { alert('예매번호를 입력하세요'); return; }
  callApi('/api/complete/' + bid, 'POST');
}

async function checkStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();
    const dot = document.getElementById('statusDot');
    const info = document.getElementById('statusInfo');
    const cookie = document.getElementById('cookieInfo');
    if (data.session_valid) {
      dot.className = 'status-dot dot-green';
      info.innerHTML = `✅ 로그인됨 | 마지막 크롤: ${data.last_crawl || '없음'} | 캐시: ${data.cached_bookings_count}건`;
    } else {
      dot.className = 'status-dot dot-red';
      info.innerHTML = '❌ 로그인 필요 (로그인 버튼을 눌러주세요)';
    }
    const cookieStatus = data.has_saved_cookies ? '🍪 저장된 쿠키 있음 (자동 로그인 가능)' : '🆕 첫 실행 (인증 필요)';
    const modeStatus = data.headless_mode === true ? '숨김모드' : data.headless_mode === false ? '화면모드' : '대기';
    cookie.innerHTML = `${cookieStatus} | 현재: ${modeStatus}`;
  } catch(e) {}
}
checkStatus();
</script>
</body>
</html>"""


# ──────────────────────────────────────────────
# 실행
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
