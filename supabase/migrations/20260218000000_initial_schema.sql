-- ============================================================
-- 잠사박물관 플레이팝 - 초기 데이터베이스 스키마
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. 사용자 프로필
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- 2. 시설
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

-- 3. 프로그램
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

-- 4. 대행사
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

-- 5. 예약
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

CREATE INDEX idx_reservations_date ON reservations(date);
CREATE INDEX idx_reservations_status ON reservations(status);
CREATE INDEX idx_reservations_customer_phone ON reservations(customer_phone);
CREATE INDEX idx_reservations_number ON reservations(reservation_number);

-- 6. 일정
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
CREATE INDEX idx_schedules_date ON schedules(date);

-- 7. 채팅방
CREATE TABLE IF NOT EXISTS chat_rooms (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('direct', 'group', 'channel')),
  participants UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;

-- 8. 채팅 메시지
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
CREATE INDEX idx_chat_messages_room ON chat_messages(room_id);

-- 9. 알림
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

-- 10. 활동 로그
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
CREATE INDEX idx_activity_logs_created ON activity_logs(created_at DESC);

-- 11. 예약 폼 설정
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

-- 12. 시스템 업데이트 기록
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

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_facilities_updated BEFORE UPDATE ON facilities FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_programs_updated BEFORE UPDATE ON programs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_agencies_updated BEFORE UPDATE ON agencies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_reservations_updated BEFORE UPDATE ON reservations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_schedules_updated BEFORE UPDATE ON schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_chat_rooms_updated BEFORE UPDATE ON chat_rooms FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trigger_form_configs_updated BEFORE UPDATE ON reservation_form_configs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
