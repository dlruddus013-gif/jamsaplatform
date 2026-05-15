-- ═══════════════════════════════════════════════════════════════
--  한국잠사박물관 통합 POS 시스템 — Supabase 스키마
--  Supabase SQL Editor에서 실행
-- ═══════════════════════════════════════════════════════════════

-- 1. 티켓 (크롤링 데이터 영구저장)
CREATE TABLE IF NOT EXISTS tickets (
  id TEXT PRIMARY KEY,
  order_no TEXT,
  coupon_no TEXT,
  coupon_nos JSONB DEFAULT '[]',
  internal_ids JSONB DEFAULT '[]',
  source TEXT DEFAULT 'manual',          -- naver, la2fdoci, 현장, okpos
  product TEXT DEFAULT '',
  buyer TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  price INTEGER DEFAULT 0,
  qty INTEGER DEFAULT 1,
  person_count INTEGER DEFAULT 1,
  status TEXT DEFAULT '사용가능',          -- 사용가능, 사용완료, 취소, 부분사용
  naver_status TEXT,
  sms_sent BOOLEAN DEFAULT FALSE,
  use_date TEXT,                           -- 이용 예정일
  book_date TEXT,                          -- 구매일
  valid_date TEXT,                         -- 유효기간
  items JSONB DEFAULT '[]',               -- 세부 품목 [{n, q, p}]
  used_at TIMESTAMPTZ,                    -- 사용처리 시각
  pos_ok BOOLEAN DEFAULT FALSE,
  txn_id TEXT,
  admin_ok TEXT,                           -- 네이버 관리자 처리 결과
  admin_verified TEXT,
  history JSONB DEFAULT '[]',             -- 진행이력 [{action, time, by}]
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_tickets_source ON tickets(source);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_phone ON tickets(phone);
CREATE INDEX IF NOT EXISTS idx_tickets_buyer ON tickets(buyer);
CREATE INDEX IF NOT EXISTS idx_tickets_use_date ON tickets(use_date);
CREATE INDEX IF NOT EXISTS idx_tickets_book_date ON tickets(book_date);
CREATE INDEX IF NOT EXISTS idx_tickets_order_no ON tickets(order_no);
CREATE INDEX IF NOT EXISTS idx_tickets_detected ON tickets(detected_at DESC);

-- 2. 사용이력
CREATE TABLE IF NOT EXISTS use_history (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT REFERENCES tickets(id) ON DELETE SET NULL,
  order_no TEXT,
  buyer TEXT,
  phone TEXT,
  product TEXT,
  qty INTEGER DEFAULT 1,
  price INTEGER DEFAULT 0,
  source TEXT,
  method TEXT DEFAULT 'kiosk',            -- kiosk, qr, manual, pos
  band_count INTEGER DEFAULT 0,           -- 띠지 출력 매수
  printer_type TEXT,                       -- godex-usb, godex-net, browser
  receipt_printed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_use_history_ticket ON use_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_use_history_date ON use_history(created_at DESC);

-- 3. POS 매출 로그
CREATE TABLE IF NOT EXISTS pos_log (
  id BIGSERIAL PRIMARY KEY,
  txn_id TEXT,
  ticket_id TEXT,
  source TEXT,
  buyer TEXT,
  phone TEXT,
  product TEXT,
  amount INTEGER DEFAULT 0,
  qty INTEGER DEFAULT 1,
  items JSONB DEFAULT '[]',
  okpos_synced BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. 일일 매출 집계
CREATE TABLE IF NOT EXISTS daily_sales (
  id BIGSERIAL PRIMARY KEY,
  sale_date DATE NOT NULL,
  total_sales INTEGER DEFAULT 0,
  total_qty INTEGER DEFAULT 0,
  visitors INTEGER DEFAULT 0,
  naver_sales INTEGER DEFAULT 0,
  la2f_sales INTEGER DEFAULT 0,
  walkin_sales INTEGER DEFAULT 0,
  items JSONB DEFAULT '[]',
  hourly JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sale_date)
);

-- 5. 크롤링 로그
CREATE TABLE IF NOT EXISTS crawl_logs (
  id BIGSERIAL PRIMARY KEY,
  source TEXT,                            -- naver, la2fdoci, okpos, system
  level TEXT DEFAULT 'info',              -- info, warning, error, success
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crawl_logs_date ON crawl_logs(created_at DESC);

-- 6. 메시지 발송 이력
CREATE TABLE IF NOT EXISTS msg_history (
  id BIGSERIAL PRIMARY KEY,
  ticket_id TEXT,
  buyer TEXT,
  phone TEXT,
  provider TEXT,                           -- la2fdoci, aligo, kakao
  template_name TEXT,
  message TEXT,
  ok BOOLEAN DEFAULT FALSE,
  detail TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. 메시지 템플릿
CREATE TABLE IF NOT EXISTS msg_templates (
  id TEXT PRIMARY KEY,
  name TEXT,
  type TEXT DEFAULT 'sms',
  body TEXT,
  kakao_code TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. 설정 (키-값)
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. 원격 명령 큐 (Vercel → 로컬 PC)
CREATE TABLE IF NOT EXISTS commands (
  id BIGSERIAL PRIMARY KEY,
  command TEXT NOT NULL,                   -- crawl, use, sync, restart
  params JSONB DEFAULT '{}',
  status TEXT DEFAULT 'pending',           -- pending, processing, done, error
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_commands_status ON commands(status) WHERE status = 'pending';

-- 10. 워커 상태 (로컬 PC 온라인 여부)
CREATE TABLE IF NOT EXISTS workers (
  id TEXT PRIMARY KEY DEFAULT 'main',
  status TEXT DEFAULT 'offline',           -- online, offline
  sessions JSONB DEFAULT '{}',
  last_ping TIMESTAMPTZ DEFAULT NOW(),
  ip TEXT,
  version TEXT
);

-- 11. 마감일지
CREATE TABLE IF NOT EXISTS closing_reports (
  id BIGSERIAL PRIMARY KEY,
  report_date DATE NOT NULL,
  manager TEXT,
  sections JSONB DEFAULT '[]',
  notes JSONB DEFAULT '[]',
  group_entry INTEGER DEFAULT 0,
  total_sales INTEGER DEFAULT 0,
  total_visitors INTEGER DEFAULT 0,
  excel_path TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(report_date)
);

-- ═══ RLS (Row Level Security) ═══
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE use_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pos_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE crawl_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE msg_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE msg_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE commands ENABLE ROW LEVEL SECURITY;
ALTER TABLE workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE closing_reports ENABLE ROW LEVEL SECURITY;

-- Service Key용 전체 접근 정책
CREATE POLICY "service_all" ON tickets FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON use_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON pos_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON daily_sales FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON crawl_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON msg_history FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON msg_templates FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON settings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON commands FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON workers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON closing_reports FOR ALL USING (true) WITH CHECK (true);

-- ═══ 자동 updated_at ═══
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tickets_updated BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ═══ 12. 식당 사전주문 ═══
CREATE TABLE IF NOT EXISTS food_orders (
  id TEXT PRIMARY KEY,
  phone TEXT,
  name TEXT,
  items JSONB DEFAULT '[]',
  total INTEGER DEFAULT 0,
  order_date DATE,
  order_time TEXT,
  status TEXT DEFAULT 'pending',
  cancel_deadline TIMESTAMPTZ,
  ready_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_food_orders_date ON food_orders(order_date DESC);

-- 13. 음식 후기
CREATE TABLE IF NOT EXISTS food_reviews (
  id TEXT PRIMARY KEY,
  phone TEXT,
  name TEXT,
  rating INTEGER DEFAULT 5,
  comment TEXT,
  coupon_code TEXT,
  coupon_used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. 스팟 방문 (스탬프 랠리)
CREATE TABLE IF NOT EXISTS spot_visits (
  id BIGSERIAL PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  spot_id TEXT NOT NULL,
  visited_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(visitor_id, spot_id)
);

CREATE INDEX IF NOT EXISTS idx_spot_visits_visitor ON spot_visits(visitor_id);

-- 15. 스탬프 랠리 보상
CREATE TABLE IF NOT EXISTS stamp_rewards (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  coupon_code TEXT,
  coupon_type TEXT DEFAULT 'juice',
  used BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. 체험단 응모
CREATE TABLE IF NOT EXISTS experience_apps (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  sns TEXT,
  sns_account TEXT,
  followers TEXT,
  experience TEXT,
  prefer_date TEXT,
  intro TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. 이벤트 알림 구독
CREATE TABLE IF NOT EXISTS event_subscribers (
  id BIGSERIAL PRIMARY KEY,
  phone TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18. 상세 리뷰 (입장권 증정)
CREATE TABLE IF NOT EXISTS detailed_reviews (
  id TEXT PRIMARY KEY,
  name TEXT,
  phone TEXT,
  platform TEXT,
  review_url TEXT,
  content TEXT,
  rating INTEGER DEFAULT 5,
  photos INTEGER DEFAULT 0,
  ticket_code TEXT,
  ticket_expiry DATE,
  ticket_used BOOLEAN DEFAULT FALSE,
  ticket_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_detailed_reviews_ticket ON detailed_reviews(ticket_code);

-- 19. 오두막/평상 예약
CREATE TABLE IF NOT EXISTS rental_bookings (
  id TEXT PRIMARY KEY,
  rental_id TEXT,
  rental_name TEXT,
  phone TEXT,
  buyer TEXT,
  booking_date DATE,
  time_slot TEXT DEFAULT '종일',
  price INTEGER DEFAULT 0,
  status TEXT DEFAULT 'confirmed',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rental_bookings_date ON rental_bookings(booking_date);

-- RLS 추가
ALTER TABLE food_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE food_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE spot_visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE stamp_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE experience_apps ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_subscribers ENABLE ROW LEVEL SECURITY;
ALTER TABLE detailed_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE rental_bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_all" ON food_orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON food_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON spot_visits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON stamp_rewards FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON experience_apps FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON event_subscribers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON detailed_reviews FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_all" ON rental_bookings FOR ALL USING (true) WITH CHECK (true);

-- ═══ 오래된 로그 자동 삭제 (30일) ═══
CREATE OR REPLACE FUNCTION cleanup_old_logs()
RETURNS void AS $$
BEGIN
  DELETE FROM crawl_logs WHERE created_at < NOW() - INTERVAL '30 days';
  DELETE FROM commands WHERE created_at < NOW() - INTERVAL '7 days' AND status = 'done';
END;
$$ LANGUAGE plpgsql;
