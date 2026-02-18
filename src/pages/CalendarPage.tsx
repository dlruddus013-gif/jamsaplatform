import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Filter,
  CalendarDays,
} from 'lucide-react';
import Card from '../components/common/Card';

interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  time: string;
  type: 'reservation' | 'program' | 'maintenance' | 'meeting' | 'holiday';
  color: string;
  count?: number;
}

const eventColors: Record<string, string> = {
  reservation: 'bg-blue-500',
  program: 'bg-museum-green',
  maintenance: 'bg-orange-500',
  meeting: 'bg-purple-500',
  holiday: 'bg-red-500',
};

const eventTypeLabels: Record<string, string> = {
  reservation: '예약',
  program: '프로그램',
  maintenance: '점검',
  meeting: '회의',
  holiday: '휴관',
};

export default function CalendarPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // 달력 데이터 생성
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  // 샘플 이벤트
  const events: CalendarEvent[] = [
    { id: '1', title: '한국초등학교 단체', date: `${year}-${String(month + 1).padStart(2, '0')}-05`, time: '10:00', type: 'reservation', color: 'blue', count: 30 },
    { id: '2', title: '누에고치 체험', date: `${year}-${String(month + 1).padStart(2, '0')}-05`, time: '14:00', type: 'program', color: 'green' },
    { id: '3', title: '체험교실B 점검', date: `${year}-${String(month + 1).padStart(2, '0')}-08`, time: '09:00', type: 'maintenance', color: 'orange' },
    { id: '4', title: '운영회의', date: `${year}-${String(month + 1).padStart(2, '0')}-10`, time: '10:00', type: 'meeting', color: 'purple' },
    { id: '5', title: '실크 염색 워크샵', date: `${year}-${String(month + 1).padStart(2, '0')}-12`, time: '10:00', type: 'program', color: 'green' },
    { id: '6', title: '서울중학교', date: `${year}-${String(month + 1).padStart(2, '0')}-12`, time: '13:00', type: 'reservation', color: 'blue', count: 45 },
    { id: '7', title: '정기 휴관일', date: `${year}-${String(month + 1).padStart(2, '0')}-15`, time: '', type: 'holiday', color: 'red' },
    { id: '8', title: '대행사 미팅', date: `${year}-${String(month + 1).padStart(2, '0')}-18`, time: '14:00', type: 'meeting', color: 'purple' },
    { id: '9', title: '직조 체험 프로그램', date: `${year}-${String(month + 1).padStart(2, '0')}-20`, time: '10:00', type: 'program', color: 'green' },
    { id: '10', title: '경기초등학교', date: `${year}-${String(month + 1).padStart(2, '0')}-20`, time: '09:30', type: 'reservation', color: 'blue', count: 60 },
    { id: '11', title: '인천초등학교', date: `${year}-${String(month + 1).padStart(2, '0')}-22`, time: '10:00', type: 'reservation', color: 'blue', count: 35 },
    { id: '12', title: '시설 안전 점검', date: `${year}-${String(month + 1).padStart(2, '0')}-25`, time: '09:00', type: 'maintenance', color: 'orange' },
  ];

  const getEventsForDate = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return events.filter((e) => e.date === dateStr);
  };

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  const today = new Date();
  const isToday = (day: number) =>
    today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  // 날짜 셀 생성
  const calendarCells: { day: number; isCurrentMonth: boolean }[] = [];

  // 이전 달
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarCells.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
  }
  // 현재 달
  for (let i = 1; i <= daysInMonth; i++) {
    calendarCells.push({ day: i, isCurrentMonth: true });
  }
  // 다음 달
  const remaining = 42 - calendarCells.length;
  for (let i = 1; i <= remaining; i++) {
    calendarCells.push({ day: i, isCurrentMonth: false });
  }

  // 선택된 날짜의 이벤트
  const selectedDateStr = selectedDate;
  const selectedEvents = selectedDateStr
    ? events.filter((e) => e.date === selectedDateStr)
    : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">캘린더</h1>
          <p className="text-xs text-text-muted mt-0.5">예약, 프로그램, 일정을 캘린더로 확인</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-3 text-xs mr-4">
            {Object.entries(eventTypeLabels).map(([key, label]) => (
              <span key={key} className="flex items-center gap-1">
                <span className={`w-2.5 h-2.5 rounded-full ${eventColors[key]}`} />
                {label}
              </span>
            ))}
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">
            <Plus className="w-4 h-4" />
            일정 추가
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 캘린더 */}
        <div className="lg:col-span-3">
          <Card padding="none">
            {/* 캘린더 헤더 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <button onClick={prevMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <h2 className="text-base font-bold min-w-[120px] text-center">
                  {year}년 {month + 1}월
                </h2>
                <button onClick={nextMonth} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={goToToday}
                  className="px-2.5 py-1 text-xs font-medium text-museum-green bg-museum-green/10 rounded-lg hover:bg-museum-green/20 transition-colors"
                >
                  오늘
                </button>
              </div>
            </div>

            {/* 요일 헤더 */}
            <div className="grid grid-cols-7 border-b border-border">
              {weekDays.map((day, i) => (
                <div
                  key={day}
                  className={`py-2 text-center text-xs font-semibold ${
                    i === 0 ? 'text-danger' : i === 6 ? 'text-blue-500' : 'text-text-muted'
                  }`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="grid grid-cols-7">
              {calendarCells.map((cell, index) => {
                const dayEvents = cell.isCurrentMonth ? getEventsForDate(cell.day) : [];
                const isSelected =
                  cell.isCurrentMonth &&
                  selectedDateStr ===
                    `${year}-${String(month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`;

                return (
                  <button
                    key={index}
                    onClick={() => {
                      if (cell.isCurrentMonth) {
                        setSelectedDate(
                          `${year}-${String(month + 1).padStart(2, '0')}-${String(cell.day).padStart(2, '0')}`
                        );
                      }
                    }}
                    className={`min-h-[100px] p-1.5 border-b border-r border-border text-left transition-colors ${
                      !cell.isCurrentMonth
                        ? 'bg-gray-50/50 text-text-muted'
                        : isSelected
                        ? 'bg-museum-green/5'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                          cell.isCurrentMonth && isToday(cell.day)
                            ? 'bg-museum-green text-white'
                            : index % 7 === 0
                            ? 'text-danger'
                            : index % 7 === 6
                            ? 'text-blue-500'
                            : ''
                        }`}
                      >
                        {cell.day}
                      </span>
                    </div>
                    <div className="mt-1 space-y-0.5">
                      {dayEvents.slice(0, 3).map((event) => (
                        <div
                          key={event.id}
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-white truncate ${eventColors[event.type]}`}
                        >
                          {event.title}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <p className="text-[10px] text-text-muted text-center">
                          +{dayEvents.length - 3}개
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* 사이드 패널 - 선택 날짜 이벤트 */}
        <div>
          <Card title={selectedDate ? `${selectedDate.split('-')[1]}/${selectedDate.split('-')[2]} 일정` : '일정 선택'} subtitle={selectedEvents.length > 0 ? `${selectedEvents.length}건의 일정` : '날짜를 선택하세요'}>
            {selectedEvents.length > 0 ? (
              <div className="space-y-3">
                {selectedEvents.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 border border-border rounded-xl hover:bg-gray-50 transition-colors cursor-pointer">
                    <div className={`w-1 h-full min-h-[40px] rounded-full ${eventColors[event.type]}`} />
                    <div className="flex-1">
                      <p className="text-sm font-medium">{event.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-text-muted">{event.time || '종일'}</span>
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                          event.type === 'reservation' ? 'bg-blue-100 text-blue-700' :
                          event.type === 'program' ? 'bg-green-100 text-green-700' :
                          event.type === 'maintenance' ? 'bg-orange-100 text-orange-700' :
                          event.type === 'meeting' ? 'bg-purple-100 text-purple-700' :
                          'bg-red-100 text-red-700'
                        }`}>{eventTypeLabels[event.type]}</span>
                      </div>
                      {event.count && (
                        <p className="text-xs text-text-secondary mt-1">{event.count}명</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <CalendarDays className="w-10 h-10 text-text-muted mx-auto mb-2" />
                <p className="text-xs text-text-muted">날짜를 클릭하여 일정을 확인하세요</p>
              </div>
            )}
          </Card>

          {/* 이번 달 요약 */}
          <Card title="이번 달 요약" className="mt-4">
            <div className="space-y-2">
              {Object.entries(eventTypeLabels).map(([key, label]) => {
                const count = events.filter((e) => e.type === key).length;
                return (
                  <div key={key} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${eventColors[key]}`} />
                      <span className="text-sm">{label}</span>
                    </div>
                    <span className="text-sm font-bold">{count}건</span>
                  </div>
                );
              })}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
