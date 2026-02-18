-- 잠사박물관 플레이팝 - 시드 데이터

-- 시설 데이터
INSERT INTO facilities (name, type, capacity, location, floor, status, description, equipment, operating_hours) VALUES
('제1전시관', 'exhibition', 100, '본관 1층', '1층', 'active', '잠사 역사와 실크 문화 상설 전시관', ARRAY['프로젝터','음향시스템','조명','CCTV'], '{"weekday":{"open":"09:00","close":"18:00"},"weekend":{"open":"10:00","close":"17:00"}}'),
('체험교실 A', 'experience', 30, '별관 1층', '1층', 'active', '누에고치 공예 및 실크 염색 체험', ARRAY['작업대','염색도구','건조기','세면대'], '{"weekday":{"open":"09:30","close":"17:30"},"weekend":{"open":"10:00","close":"16:00"}}'),
('체험교실 B', 'experience', 25, '별관 2층', '2층', 'maintenance', '전통 직조 및 견직물 만들기 체험', ARRAY['직조기','작업대','재봉틀'], '{"weekday":{"open":"09:30","close":"17:30"},"weekend":{"open":"10:00","close":"16:00"}}'),
('야외체험장', 'outdoor', 80, '야외', '야외', 'active', '뽕나무 밭과 누에 사육장 관찰', ARRAY['텐트','벤치','음향시스템'], '{"weekday":{"open":"09:00","close":"18:00"},"weekend":{"open":"09:00","close":"18:00"}}'),
('세미나실', 'meeting', 40, '본관 2층', '2층', 'active', '회의 및 교육 세미나 다목적 공간', ARRAY['빔프로젝터','화이트보드','마이크'], '{"weekday":{"open":"09:00","close":"18:00"},"weekend":{"open":"10:00","close":"17:00"}}'),
('교육관', 'education', 60, '본관 3층', '3층', 'active', '단체 교육 프로그램 대형 시설', ARRAY['대형스크린','음향시스템','조명','녹화장비'], '{"weekday":{"open":"09:00","close":"18:00"},"weekend":{"open":"10:00","close":"17:00"}}');

-- 프로그램 데이터
INSERT INTO programs (name, description, category, duration_minutes, min_participants, max_participants, price_adult, price_child, materials, status) VALUES
('누에고치 공예체험', '누에고치를 이용한 다양한 공예품 만들기', 'experience', 120, 5, 30, 18000, 15000, ARRAY['누에고치','접착제','장식재료'], 'active'),
('실크 스카프 염색', '천연 염료 사용 실크 스카프 염색', 'experience', 90, 5, 25, 25000, 20000, ARRAY['실크 스카프','천연 염료','고무줄'], 'active'),
('전통 직조 체험', '전통 베틀을 이용한 직조 체험', 'experience', 120, 3, 15, 30000, 25000, ARRAY['실','베틀','바늘'], 'active'),
('잠사 역사 투어', '잠사 산업 역사와 발전 가이드 투어', 'education', 60, 10, 50, 10000, 8000, ARRAY['교육자료'], 'active'),
('견직물 만들기', '직접 견직물을 짜보는 심화 체험', 'experience', 180, 3, 10, 40000, 35000, ARRAY['견사','직조기','도안'], 'active');

-- 대행사 데이터
INSERT INTO agencies (name, business_number, contact_person, phone, email, address, commission_rate, status, contract_start, contract_end, total_reservations, total_revenue) VALUES
('행복투어', '123-45-67890', '김행복', '02-1234-5678', 'happy@tour.com', '서울시 종로구', 10.00, 'active', '2025-01-01', '2025-12-31', 156, 23400000),
('교육나라', '234-56-78901', '이교육', '02-2345-6789', 'edu@nara.com', '경기도 수원시', 8.00, 'active', '2025-03-01', '2026-02-28', 89, 15680000),
('신나는 여행', '345-67-89012', '박여행', '031-3456-7890', 'fun@travel.com', '인천시 남동구', 12.00, 'active', '2025-06-01', '2026-05-31', 45, 8100000);
