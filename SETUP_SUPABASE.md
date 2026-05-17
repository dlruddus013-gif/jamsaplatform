# 🔧 Supabase + Vercel 설정 가이드

## 1단계: Supabase 스키마 생성

1. https://supabase.com/dashboard/project/ewxquecxsxsfhyzfaaci 접속
2. 왼쪽 메뉴 → **SQL Editor** 클릭
3. **New query** 클릭
4. `supabase-schema.sql` 파일 내용 전체 붙여넣기
5. **Run** 클릭 → 11개 테이블 생성됨

## 2단계: Service Key 확인

1. Supabase → **Settings** → **API**
2. **service_role** 키 복사 (anon 키 아님!)
3. `.env` 파일에 붙여넣기:
   ```
   SUPABASE_SERVICE_KEY=eyJhbGciOiJI...복사한키...
   ```

## 3단계: 서버 실행

```
START.bat 더블클릭
```

시작 시 이렇게 나오면 Supabase 연결 성공:
```
  ☁️  Supabase: https://ewxquecxsxsfhyzfaaci.supabase.co...
  💾 로컬 복원: 37건 (저장시각: 2026-05-04 ...)
  ☁️  티켓 복원: 0건 추가 (전체 37건)
```

## 4단계: Vercel 배포 (선택)

```bash
# Vercel CLI 설치
npm i -g vercel

# 프로젝트 폴더에서
vercel

# 환경변수 설정
vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_KEY
```

## 데이터 영구 저장 구조

```
크롤링 완료
  ↓
① STATE.tickets 에 추가
  ↓
② 로컬 파일 (.data/tickets.json) 자동 저장
  ↓
③ Supabase (tickets 테이블) 동기화
  ↓
서버 재시작 시
  ↓
① 로컬 파일에서 즉시 복원 (오프라인도 가능)
  ↓
② Supabase에서 추가 복원 (온라인 시)
  ↓
③ 중복 ID 자동 제거
```

## Supabase 테이블 목록 (11개)

| 테이블 | 용도 |
|--------|------|
| tickets | 크롤링 티켓 데이터 (영구) |
| use_history | 사용처리 이력 |
| pos_log | POS 매출 로그 |
| daily_sales | 일일 매출 집계 |
| crawl_logs | 크롤링 로그 |
| msg_history | 메시지 발송 이력 |
| msg_templates | 메시지 템플릿 |
| settings | 시스템 설정 |
| commands | 원격 명령 큐 |
| workers | 워커(PC) 상태 |
| closing_reports | 마감일지 |
