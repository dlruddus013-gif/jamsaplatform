-- ============================================================
-- 잠사박물관 플레이팝 - Supabase SQL Editor 실행용
-- 이 SQL을 Supabase 대시보드 > SQL Editor 에 붙여넣기하세요
-- ============================================================

-- UUID 확장
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. 사용자 프로필 (auth.users 참조 없이 독립 운영)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('superadmin', 'admin', 'manager', 'staff', 'viewer')),
  phone TEXT,
  department TEXT,
  avatar_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_public_read" ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles_public_write" ON profiles FOR ALL USING (true);

-- ============================================================
-- 2. 시설
-- ============================================================
CREATE TABLE IF NOT EXISTS facilities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('exhibition', 'experience', 'education', 'event', 'meeting', 'outdoor')),
  capacity INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL,
  floor TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'maintenance', 'closed', 'reserved')),
  description TEXT,
  equipment TEXT[] DEFAULT '{}',
  operating_hours JSONB NOT NULL DEFAULT '{}',
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE facilities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "facilities_public_read" ON facilities FOR SELECT USING (true);
CREATE POLICY "facilities_public_write" ON facilities FOR ALL USING (true);

-- ============================================================
-- 3. 프로그램
-- ============================================================
CREATE TABLE IF NOT EXISTS programs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('experience', 'education', 'exhibition', 'event', 'special')),
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  min_participants INTEGER NOT NULL DEFAULT 1,
  max_participants INTEGER NOT NULL DEFAULT 30,
  price_adult INTEGER NOT NULL DEFAULT 0,
  price_child INTEGER NOT NULL DEFAULT 0,
  price_group INTEGER,
  materials TEXT[] DEFAULT '{}',
  requirements TEXT,
  facility_id UUID REFERENCES facilities(id),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'draft')),
  image_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "programs_public_read" ON programs FOR SELECT USING (true);
CREATE POLICY "programs_public_write" ON programs FOR ALL USING (true);

-- ============================================================
-- 4. 대행사
-- ============================================================
CREATE TABLE IF NOT EXISTS agencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  business_number TEXT UNIQUE,
  contact_person TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT,
  commission_rate NUMERIC(5,2) NOT NULL DEFAULT 10.00,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  contract_start DATE,
  contract_end DATE,
  total_reservations INTEGER DEFAULT 0,
  total_revenue BIGINT DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE agencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "agencies_public_read" ON agencies FOR SELECT USING (true);
CREATE POLICY "agencies_public_write" ON agencies FOR ALL USING (true);

-- ============================================================
-- 5. 예약
-- ============================================================
CREATE TABLE IF NOT EXISTS reservations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_number TEXT UNIQUE NOT NULL,
  facility_id UUID REFERENCES facilities(id),
  program_id UUID REFERENCES programs(id),
  agency_id UUID REFERENCES agencies(id),
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  organization TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  visitor_count INTEGER NOT NULL DEFAULT 1,
  adult_count INTEGER NOT NULL DEFAULT 0,
  child_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'noshow')),
  payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'partial', 'paid', 'refunded')),
  payment_amount BIGINT NOT NULL DEFAULT 0,
  course_type TEXT DEFAULT 'A' CHECK (course_type IN ('A', 'B', 'C', 'D', 'custom')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reservations_public_read" ON reservations FOR SELECT USING (true);
CREATE POLICY "reservations_public_write" ON reservations FOR ALL USING (true);

CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations(date);
CREATE INDEX IF NOT EXISTS idx_reservations_status ON reservations(status);
CREATE INDEX IF NOT EXISTS idx_reservations_customer_phone ON reservations(customer_phone);
CREATE INDEX IF NOT EXISTS idx_reservations_number ON reservations(reservation_number);

-- ============================================================
-- 6. 일정
-- ============================================================
CREATE TABLE IF NOT EXISTS schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('program', 'maintenance', 'meeting', 'event', 'holiday', 'other')),
  facility_id UUID REFERENCES facilities(id),
  assigned_to TEXT[] DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  color TEXT,
  recurrence JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules_public_read" ON schedules FOR SELECT USING (true);
CREATE POLICY "schedules_public_write" ON schedules FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_schedules_date ON schedules(date);

-- ============================================================
-- 7. 채팅방
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'channel')),
  participants UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_rooms_public_read" ON chat_rooms FOR SELECT USING (true);
CREATE POLICY "chat_rooms_public_write" ON chat_rooms FOR ALL USING (true);

-- ============================================================
-- 8. 채팅 메시지
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  room_id UUID REFERENCES chat_rooms(id) ON DELETE CASCADE,
  sender_id UUID,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text' CHECK (type IN ('text', 'image', 'file', 'system')),
  file_url TEXT,
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "chat_messages_public_read" ON chat_messages FOR SELECT USING (true);
CREATE POLICY "chat_messages_public_write" ON chat_messages FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_chat_messages_room ON chat_messages(room_id);

-- ============================================================
-- 9. 알림
-- ============================================================
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  title TEXT NOT NULL,
  message TEXT,
  type TEXT NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "notifications_public_read" ON notifications FOR SELECT USING (true);
CREATE POLICY "notifications_public_write" ON notifications FOR ALL USING (true);

-- ============================================================
-- 10. 활동 로그
-- ============================================================
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID,
  user_name TEXT NOT NULL,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "activity_logs_public_read" ON activity_logs FOR SELECT USING (true);
CREATE POLICY "activity_logs_public_write" ON activity_logs FOR ALL USING (true);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON activity_logs(created_at DESC);

-- ============================================================
-- 11. 예약 폼 설정
-- ============================================================
CREATE TABLE IF NOT EXISTS reservation_form_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  fields JSONB NOT NULL DEFAULT '[]',
  programs TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT false,
  require_payment BOOLEAN DEFAULT false,
  confirmation_message TEXT,
  cancellation_policy TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE reservation_form_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "form_configs_public_read" ON reservation_form_configs FOR SELECT USING (true);
CREATE POLICY "form_configs_public_write" ON reservation_form_configs FOR ALL USING (true);

-- ============================================================
-- 12. 시스템 업데이트 기록
-- ============================================================
CREATE TABLE IF NOT EXISTS system_updates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version TEXT NOT NULL,
  build_number TEXT,
  description TEXT,
  type TEXT NOT NULL CHECK (type IN ('update', 'migration', 'patch')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'applied', 'failed', 'rolled_back')),
  applied_at TIMESTAMPTZ,
  applied_by UUID,
  rollback_available BOOLEAN DEFAULT false,
  size_kb INTEGER DEFAULT 0,
  changelog TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE system_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "system_updates_public_read" ON system_updates FOR SELECT USING (true);
CREATE POLICY "system_updates_public_write" ON system_updates FOR ALL USING (true);

-- ============================================================
-- updated_at 자동 업데이트 트리거
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_profiles_updated') THEN
    CREATE TRIGGER trigger_profiles_updated BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_facilities_updated') THEN
    CREATE TRIGGER trigger_facilities_updated BEFORE UPDATE ON facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_programs_updated') THEN
    CREATE TRIGGER trigger_programs_updated BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_agencies_updated') THEN
    CREATE TRIGGER trigger_agencies_updated BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_reservations_updated') THEN
    CREATE TRIGGER trigger_reservations_updated BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_schedules_updated') THEN
    CREATE TRIGGER trigger_schedules_updated BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_chat_rooms_updated') THEN
    CREATE TRIGGER trigger_chat_rooms_updated BEFORE UPDATE ON chat_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_form_configs_updated') THEN
    CREATE TRIGGER trigger_form_configs_updated BEFORE UPDATE ON reservation_form_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- ============================================================
-- 시드 데이터 삽입
-- ============================================================

-- 시설 데이터
INSERT INTO facilities (name, type, capacity, location, floor, status, description, equipment, operating_hours) VALUES
('제1전시관', 'exhibition', 100, '본관 1층', '1층', 'active', '잠사 역사와 실크 문화 상설 전시관', ARRAY['프로젝터','음향시스템','조명','CCTV'], '{"weekday":{"open":"09:00","close":"18:00"},"weekend":{"open":"10:00","close":"17:00"}}'),
('체험교실 A', 'experience', 30, '별관 1층', '1층', 'active', '누에고치 공예 및 실크 염색 체험', ARRAY['작업대','염색도구','건조기','세면대'], '{"weekday":{"open":"09:30","close":"17:30"},"weekend":{"open":"10:00","close":"16:00"}}'),
('체험교실 B', 'experience', 25, '별관 2층', '2층', 'maintenance', '전통 직조 및 견직물 만들기 체험', ARRAY['직조기','작업대','재봉틀'], '{"weekday":{"open":"09:30","close":"17:30"},"weekend":{"open":"10:00","close":"16:00"}}'),
('야외체험장', 'outdoor', 80, '야외', '야외', 'active', '뽕나무 밭과 누에 사육장 관찰', ARRAY['텐트','벤치','음향시스템'], '{"weekday":{"open":"09:00","close":"18:00"},"weekend":{"open":"09:00","close":"18:00"}}'),
('세미나실', 'meeting', 40, '본관 2층', '2층', 'active', '회의 및 교육 세미나 다목적 공간', ARRAY['빔프로젝터','화이트보드','마이크'], '{"weekday":{"open":"09:00","close":"18:00"},"weekend":{"open":"10:00","close":"17:00"}}'),
('교육관', 'education', 60, '본관 3층', '3층', 'active', '단체 교육 프로그램 대형 시설', ARRAY['대형스크린','음향시스템','조명','녹화장비'], '{"weekday":{"open":"09:00","close":"18:00"},"weekend":{"open":"10:00","close":"17:00"}}')
ON CONFLICT DO NOTHING;

-- 프로그램 데이터
INSERT INTO programs (name, description, category, duration_minutes, min_participants, max_participants, price_adult, price_child, materials, status) VALUES
('누에고치 공예체험', '누에고치를 이용한 다양한 공예품 만들기', 'experience', 120, 5, 30, 18000, 15000, ARRAY['누에고치','접착제','장식재료'], 'active'),
('실크 스카프 염색', '천연 염료 사용 실크 스카프 염색', 'experience', 90, 5, 25, 25000, 20000, ARRAY['실크 스카프','천연 염료','고무줄'], 'active'),
('전통 직조 체험', '전통 베틀을 이용한 직조 체험', 'experience', 120, 3, 15, 30000, 25000, ARRAY['실','베틀','바늘'], 'active'),
('잠사 역사 투어', '잠사 산업 역사와 발전 가이드 투어', 'education', 60, 10, 50, 10000, 8000, ARRAY['교육자료'], 'active'),
('견직물 만들기', '직접 견직물을 짜보는 심화 체험', 'experience', 180, 3, 10, 40000, 35000, ARRAY['견사','직조기','도안'], 'active')
ON CONFLICT DO NOTHING;

-- 대행사 데이터
INSERT INTO agencies (name, business_number, contact_person, phone, email, address, commission_rate, status, contract_start, contract_end, total_reservations, total_revenue) VALUES
('행복투어', '123-45-67890', '김행복', '02-1234-5678', 'happy@tour.com', '서울시 종로구', 10.00, 'active', '2025-01-01', '2025-12-31', 156, 23400000),
('교육나라', '234-56-78901', '이교육', '02-2345-6789', 'edu@nara.com', '경기도 수원시', 8.00, 'active', '2025-03-01', '2026-02-28', 89, 15680000),
('신나는 여행', '345-67-89012', '박여행', '031-3456-7890', 'fun@travel.com', '인천시 남동구', 12.00, 'active', '2025-06-01', '2026-05-31', 45, 8100000)
ON CONFLICT DO NOTHING;

-- 시스템 업데이트 기록
INSERT INTO system_updates (version, build_number, description, type, status, applied_at, rollback_available, size_kb, changelog) VALUES
('v2.10.0', 'Build 20260213', '예약 시스템 성능 개선 및 대행사 모듈 추가', 'update', 'applied', '2026-02-13 10:00:00+09', true, 45, ARRAY['예약 시스템 성능 개선','대행사 관리 모듈 추가','캘린더 뷰 개선','UI/UX 전반적 개선']),
('v2.9.0', 'Build 20260115', '채팅 및 일정표 도입', 'update', 'applied', '2026-01-15 09:00:00+09', false, 65, ARRAY['채팅 시스템 도입','일정표 모듈 추가','KakaoTalk 알림톡 연동']),
('v2.8.0', 'Build 20251220', '대시보드 및 검색 강화', 'update', 'applied', '2025-12-20 10:00:00+09', false, 52, ARRAY['대시보드 통계 차트 추가','프로그램 관리 개선','검색 기능 강화'])
ON CONFLICT DO NOTHING;

-- 관리자 프로필 생성
INSERT INTO profiles (email, name, role, department, is_active) VALUES
('admin@jamsa.museum', '관리자', 'superadmin', '운영팀', true)
ON CONFLICT DO NOTHING;
