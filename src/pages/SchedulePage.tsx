import { useState } from 'react';
import {
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Users,
  MapPin,
} from 'lucide-react';
import Card from '../components/common/Card';

interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  endTime: string;
  type: string;
  facility: string;
  staff: string[];
  color: string;
}

const timeSlots = Array.from({ length: 20 }, (_, i) => {
  const h = Math.floor(i / 2) + 8;
  const m = i % 2 === 0 ? '00' : '30';
  return `${String(h).padStart(2, '0')}:${m}`;
});

const daySchedules: Record<string, ScheduleItem[]> = {
  '월': [
    { id: '1', title: '누에고치 공예체험', time: '10:00', endTime: '12:00', type: '프로그램', facility: '체험교실A', staff: ['김직원', '이직원'], color: 'bg-blue-500' },
    { id: '2', title: '실크 염색 체험', time: '14:00', endTime: '16:00', type: '프로그램', facility: '체험교실A', staff: ['박직원'], color: 'bg-green-500' },
    { id: '3', title: '전시실 가이드', time: '10:00', endTime: '11:00', type: '전시', facility: '제1전시관', staff: ['최직원'], color: 'bg-purple-500' },
  ],
  '화': [
    { id: '4', title: '한국초등학교 단체', time: '09:30', endTime: '12:00', type: '단체예약', facility: '교육관', staff: ['김직원', '박직원', '이직원'], color: 'bg-orange-500' },
    { id: '5', title: '직조 체험', time: '14:00', endTime: '16:00', type: '프로그램', facility: '체험교실B', staff: ['이직원'], color: 'bg-teal-500' },
  ],
  '수': [
    { id: '6', title: '시설 점검', time: '09:00', endTime: '10:00', type: '점검', facility: '전체', staff: ['관리팀'], color: 'bg-yellow-500' },
    { id: '7', title: '견직물 만들기', time: '10:00', endTime: '12:00', type: '프로그램', facility: '체험교실A', staff: ['김직원'], color: 'bg-indigo-500' },
    { id: '8', title: '운영 회의', time: '14:00', endTime: '15:00', type: '회의', facility: '세미나실', staff: ['전 직원'], color: 'bg-pink-500' },
  ],
  '목': [
    { id: '9', title: '서울중학교 단체', time: '10:00', endTime: '15:00', type: '단체예약', facility: '교육관', staff: ['김직원', '박직원', '이직원', '최직원'], color: 'bg-orange-500' },
  ],
  '금': [
    { id: '10', title: '누에고치 공예체험', time: '10:00', endTime: '12:00', type: '프로그램', facility: '체험교실A', staff: ['김직원'], color: 'bg-blue-500' },
    { id: '11', title: '야외 체험활동', time: '13:00', endTime: '15:00', type: '프로그램', facility: '야외체험장', staff: ['이직원', '박직원'], color: 'bg-emerald-500' },
    { id: '12', title: '주간 정산 회의', time: '16:00', endTime: '17:00', type: '회의', facility: '세미나실', staff: ['관리자'], color: 'bg-pink-500' },
  ],
};

const weekDays = ['월', '화', '수', '목', '금'];

export default function SchedulePage() {
  const [selectedDay, setSelectedDay] = useState('월');
  const [viewMode, setViewMode] = useState<'timetable' | 'list'>('timetable');

  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay() + 1);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">일정표</h1>
          <p className="text-xs text-text-muted mt-0.5">주간 프로그램 및 업무 일정</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => setViewMode('timetable')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'timetable' ? 'bg-white shadow-sm' : ''
              }`}
            >
              시간표
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                viewMode === 'list' ? 'bg-white shadow-sm' : ''
              }`}
            >
              리스트
            </button>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-museum-green rounded-lg hover:bg-museum-green-light transition-colors">
            <Plus className="w-4 h-4" />
            일정 추가
          </button>
        </div>
      </div>

      {/* 주간 네비게이션 */}
      <Card padding="none">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h2 className="text-sm font-bold">
            {weekStart.getFullYear()}년 {weekStart.getMonth() + 1}월 {weekStart.getDate()}일 ~ 주간
          </h2>
          <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* 요일 탭 */}
        <div className="flex border-b border-border">
          {weekDays.map((day, index) => {
            const dayDate = new Date(weekStart);
            dayDate.setDate(weekStart.getDate() + index);
            const isToday = dayDate.toDateString() === today.toDateString();
            const scheduleCount = daySchedules[day]?.length || 0;

            return (
              <button
                key={day}
                onClick={() => setSelectedDay(day)}
                className={`flex-1 py-3 text-center transition-colors relative ${
                  selectedDay === day
                    ? 'bg-museum-green/5'
                    : 'hover:bg-gray-50'
                }`}
              >
                <p className={`text-xs ${isToday ? 'text-museum-green font-bold' : 'text-text-muted'}`}>
                  {day}
                </p>
                <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-museum-green' : ''}`}>
                  {dayDate.getDate()}
                </p>
                {scheduleCount > 0 && (
                  <span className="absolute top-2 right-2 w-4 h-4 bg-museum-green text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {scheduleCount}
                  </span>
                )}
                {selectedDay === day && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-museum-green" />
                )}
              </button>
            );
          })}
        </div>

        {/* 일정 목록 */}
        <div className="p-4">
          {viewMode === 'timetable' ? (
            <div className="relative">
              {/* 타임라인 */}
              {timeSlots.filter((_, i) => i % 2 === 0).map((time) => (
                <div key={time} className="flex items-start gap-4 min-h-[60px] border-b border-border/50">
                  <span className="text-xs text-text-muted w-12 pt-1 shrink-0">{time}</span>
                  <div className="flex-1 py-1">
                    {(daySchedules[selectedDay] || [])
                      .filter((s) => s.time === time)
                      .map((schedule) => (
                        <div
                          key={schedule.id}
                          className={`${schedule.color} text-white rounded-lg p-2.5 mb-1 cursor-pointer hover:opacity-90 transition-opacity`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="text-sm font-bold">{schedule.title}</p>
                              <p className="text-xs opacity-80 mt-0.5">
                                {schedule.time} - {schedule.endTime}
                              </p>
                            </div>
                            <span className="text-[10px] font-medium bg-white/20 px-1.5 py-0.5 rounded">
                              {schedule.type}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-2 text-xs opacity-80">
                            <span className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {schedule.facility}
                            </span>
                            <span className="flex items-center gap-1">
                              <Users className="w-3 h-3" />
                              {schedule.staff.join(', ')}
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {(daySchedules[selectedDay] || []).map((schedule) => (
                <div
                  key={schedule.id}
                  className="flex items-center gap-4 p-3 border border-border rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
                >
                  <div className={`w-1.5 h-12 rounded-full ${schedule.color}`} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium">{schedule.title}</p>
                      <span className="text-[10px] font-medium bg-gray-100 px-1.5 py-0.5 rounded">
                        {schedule.type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-text-muted">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {schedule.time} - {schedule.endTime}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {schedule.facility}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {schedule.staff.join(', ')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
              {(!daySchedules[selectedDay] || daySchedules[selectedDay].length === 0) && (
                <div className="text-center py-12">
                  <Clock className="w-10 h-10 text-text-muted mx-auto mb-2" />
                  <p className="text-sm text-text-muted">이 날의 일정이 없습니다</p>
                </div>
              )}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
