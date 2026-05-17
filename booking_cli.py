"""
============================================================
잠사플레이팜 예약 관리 CLI
서버 없이 직접 실행하는 커맨드라인 도구
============================================================

사용법:
  python booking_cli.py login              # 로그인
  python booking_cli.py list               # 오늘 예약 목록
  python booking_cli.py list --date 2026-02-28
  python booking_cli.py detail 1169863657  # 예매 상세
  python booking_cli.py complete 1169863657       # 단건 이용완료
  python booking_cli.py auto                      # 오늘 확정 자동 이용완료
"""

import asyncio
import sys
import json
from datetime import datetime

# 서버 모듈 임포트
from naver_booking_api import (
    naver_login, ensure_login, crawl_booking_list,
    crawl_booking_detail, process_complete, auto_complete_today,
    crawl_calendar, close_browser, browser_state, CONFIG
)


def print_table(bookings):
    """예약 목록 테이블 출력"""
    if not bookings:
        print("  📭 예약이 없습니다.")
        return

    print(f"\n  {'상태':^6} │ {'예매자':^8} │ {'전화번호':^15} │ {'예매번호':^12} │ {'이용일':^12}")
    print("  " + "─" * 70)
    for b in bookings:
        status = b.get('status', '')[:4]
        name = b.get('name', '')[:6]
        phone = b.get('phone', '')
        bid = b.get('booking_id', '')
        date = b.get('use_date', '')
        print(f"  {status:^6} │ {name:^8} │ {phone:^15} │ {bid:^12} │ {date:^12}")
    print(f"\n  총 {len(bookings)}건\n")


async def main():
    if len(sys.argv) < 2:
        print(__doc__)
        return

    cmd = sys.argv[1].lower()

    try:
        if cmd == "login":
            print("🔑 네이버 로그인 중...")
            print("   (처음이면 브라우저 화면이 뜹니다 → 인증만 하면 끝!)")
            success = await naver_login()
            print("✅ 로그인 성공! 쿠키 저장됨 → 다음부터 자동 로그인" if success else "❌ 로그인 실패")

        elif cmd == "list":
            date = sys.argv[2] if len(sys.argv) > 2 and sys.argv[2].startswith("20") else None
            status = "all"
            for i, arg in enumerate(sys.argv):
                if arg == "--date" and i + 1 < len(sys.argv):
                    date = sys.argv[i + 1]
                if arg == "--status" and i + 1 < len(sys.argv):
                    status = sys.argv[i + 1]

            print(f"📋 예약 목록 조회... (날짜: {date or '오늘'}, 상태: {status})")
            bookings = await crawl_booking_list(date_from=date, status_filter=status)
            print_table(bookings)

            # JSON 저장
            print(f"  💾 booking_data/ 폴더에 저장됨")

        elif cmd == "calendar":
            print("📅 예매현황 캘린더 조회...")
            data = await crawl_calendar()
            print(json.dumps(data, ensure_ascii=False, indent=2))

        elif cmd == "detail":
            if len(sys.argv) < 3:
                print("사용법: python booking_cli.py detail {예매번호}")
                return
            bid = sys.argv[2]
            print(f"📄 예매 상세 조회: {bid}")
            detail = await crawl_booking_detail(bid)
            for k, v in detail.items():
                if v:
                    print(f"  {k:>14}: {v}")

        elif cmd == "complete":
            if len(sys.argv) < 3:
                print("사용법: python booking_cli.py complete {예매번호}")
                return
            bid = sys.argv[2]
            print(f"⚡ 이용완료 처리: {bid}")
            result = await process_complete(bid)
            emoji = "✅" if result["success"] else "❌"
            print(f"  {emoji} {result['message']}")

        elif cmd == "auto":
            print("🤖 오늘 확정 예약 자동 이용완료 처리...")
            result = await auto_complete_today()
            print(f"\n  처리 결과:")
            print(f"  - 대상: {result.get('total', result.get('count', 0))}건")
            if 'results' in result:
                for r in result['results']:
                    emoji = "✅" if r["success"] else "❌"
                    print(f"  {emoji} {r['booking_id']}: {r['message']}")
            else:
                print(f"  {result.get('message', '')}")

        else:
            print(__doc__)

    finally:
        await close_browser()


if __name__ == "__main__":
    asyncio.run(main())
