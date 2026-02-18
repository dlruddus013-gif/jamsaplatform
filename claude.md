# 한국잠사박물관 통합 운영 플랫폼

## 프로젝트 개요
한국잠사박물관의 AI 기반 통합 운영 플랫폼입니다.
예약 관리, 직원 관리, 재고 관리, 마케팅 자동화 등 10개 모듈로 구성된 SaaS 시스템입니다.

## 기술 스택
- **프론트엔드**: React 18 + TypeScript + Tailwind CSS
- **백엔드**: Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **상태관리**: Zustand 또는 React Query
- **빌드**: Vite
- **배포**: Vercel / Supabase Edge Functions
- **외부 연동**: KakaoTalk API, PG결제 API, Google Analytics

## 프로젝트 구조
```
src/
├── api/                  # Supabase 클라이언트 & API 함수
│   ├── supabase.ts       # Supabase 초기화
│   ├── reservation.ts    # 예약 API
│   ├── employee.ts       # 직원 API
│   ├── inventory.ts      # 재고 API
│   └── marketing.ts      # 마케팅 API
├── components/           # React 컴포넌트
│   ├── common/           # 공통 UI (Button, Modal, Table, Form)
│   ├── reservation/      # 예약 관리 모듈
│   ├── employee/         # 직원 관리 모듈
│   ├── inventory/        # 재고 관리 모듈
│   ├── marketing/        # 마케팅 자동화 모듈
│   ├── pos/              # POS 연동 모듈
│   ├── analytics/        # 분석 대시보드
│   ├── safety/           # 안전 관리 모듈
│   ├── pricing/          # 동적 가격 모듈
│   ├── education/        # 교육 프로그램 모듈
│   └── regional/         # 지역 관광 연계 모듈
├── hooks/                # 커스텀 훅
├── utils/                # 유틸리티 함수
├── types/                # TypeScript 타입 정의
├── stores/               # 상태 관리
└── styles/               # 글로벌 스타일
supabase/
├── migrations/           # DB 마이그레이션
├── functions/            # Edge Functions
└── seed.sql              # 시드 데이터
```

## 10개 모듈 매핑
| # | 모듈명 | 디렉토리 | 상태 |
|---|--------|----------|------|
| 1 | 예약 관리 슈퍼앱 | reservation/ | MVP 완료 |
| 2 | 직원 관리 시스템 | employee/ | MVP 완료 |
| 3 | 마케팅 자동화 | marketing/ | MVP 완료 |
| 4 | 재고 관리 | inventory/ | 개발중 |
| 5 | POS 연동 | pos/ | 개발중 |
| 6 | 수요 예측 | analytics/ | 계획 |
| 7 | 안전 관리 | safety/ | 계획 |
| 8 | 동적 가격 | pricing/ | 계획 |
| 9 | 교육 프로그램 | education/ | 계획 |
| 10 | 지역 관광 연계 | regional/ | 계획 |

## 코딩 규칙

### 필수 규칙
- 모든 UI 텍스트, 주석, 에러 메시지는 **한국어**로 작성
- 컴포넌트는 **함수형 컴포넌트 + TypeScript** 사용
- Supabase 테이블에는 반드시 **RLS 정책** 적용
- API 호출 시 반드시 **에러 핸들링** 포함
- 모바일 반응형 **필수** (모바일 퍼스트)

### Supabase 규칙
- 테이블명: snake_case (예: `group_reservations`)
- 칼럼명: snake_case (예: `created_at`, `visitor_count`)
- RLS 정책: 각 테이블별 CRUD 정책 반드시 설정
- Edge Function: Deno 런타임, TypeScript 사용

### React 컴포넌트 규칙
- 파일명: PascalCase (예: `ReservationTable.tsx`)
- 훅 파일명: camelCase (예: `useReservation.ts`)
- 공통 컴포넌트는 `components/common/`에 배치
- Props 타입은 `types/` 폴더에 별도 정의

### 스타일 규칙
- Tailwind CSS 유틸리티 클래스 우선
- 복잡한 스타일은 @apply 또는 CSS Module 사용
- 색상 팔레트: 박물관 브랜딩 컬러 (#2D5016 그린 계열)

## 서브에이전트 활용 가이드

복잡한 작업 시 다음 순서로 서브에이전트를 활용:
1. **plan-agent**: 작업 범위와 영향도 분석
2. **explore-agent**: 기존 코드와 DB 스키마 탐색
3. **모듈별 전문 에이전트**: 실제 구현
4. **test-agent**: 테스트 작성 및 검증
5. **review-agent**: 코드 품질 검토

## Agent Teams 사용 시 파일 소유권
멀티에이전트 병렬 작업 시, 다음 소유권 규칙을 반드시 준수:
- 각 팀원은 자신의 모듈 디렉토리만 수정
- 공통 파일(types/, utils/, api/supabase.ts)은 리더만 수정
- DB 마이그레이션은 한 번에 하나의 팀원만 작업
- 같은 파일을 두 팀원이 동시에 수정하지 않도록 태스크 의존성 설정

## 커밋 규칙
```
feat(모듈명): 기능 설명
fix(모듈명): 버그 수정 설명
refactor(모듈명): 리팩토링 설명
docs: 문서 수정
test: 테스트 추가/수정
```
예시: `feat(reservation): 단체 예약 카카오톡 알림 기능 추가`
