# 한국잠사박물관 홈페이지 (Vercel + Supabase)

정적 사이트 + Supabase(ewxquecxsxsfhyzfaaci) 연동.
- 가격표: `silk_web_config` 테이블 key=`prices` 의 data.items (Supabase 대시보드에서 수정)
- 단체 견적 접수: `silk_web_quotes` 테이블에 저장 (익명 쓰기만, 읽기는 대시보드)

## 배포
```
npx vercel --prod
```
(이 폴더에서 실행 · 처음 1회 Vercel 로그인)
