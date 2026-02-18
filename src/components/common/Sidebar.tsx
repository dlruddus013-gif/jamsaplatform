import {
  LayoutDashboard,
  Calendar,
  ClipboardList,
  Clock,
  MessageSquare,
  Building2,
  Shield,
  ChevronLeft,
  ChevronRight,
  Landmark,
} from 'lucide-react';
import { useAppStore } from '../../stores/appStore';
import type { MainTab } from '../../types';

const menuItems: { id: MainTab; label: string; icon: typeof LayoutDashboard; badge?: number }[] = [
  { id: 'master', label: '마스터', icon: Shield },
  { id: 'dashboard', label: '대시보드', icon: LayoutDashboard },
  { id: 'calendar', label: '캘린더', icon: Calendar },
  { id: 'reservation', label: '예약관리', icon: ClipboardList, badge: 5 },
  { id: 'schedule', label: '일정표', icon: Clock },
  { id: 'chat', label: '채팅', icon: MessageSquare, badge: 3 },
  { id: 'agency', label: '대행사', icon: Building2 },
];

export default function Sidebar() {
  const { activeMainTab, setActiveMainTab, sidebarCollapsed, toggleSidebar } = useAppStore();

  return (
    <aside
      className={`bg-sidebar-bg text-white h-screen sticky top-0 flex flex-col sidebar-transition ${
        sidebarCollapsed ? 'w-16' : 'w-56'
      }`}
    >
      {/* 로고 */}
      <div className="h-14 flex items-center px-4 border-b border-white/10 shrink-0">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-8 h-8 rounded-lg bg-museum-green flex items-center justify-center shrink-0">
            <Landmark className="w-4.5 h-4.5 text-white" />
          </div>
          {!sidebarCollapsed && (
            <div className="whitespace-nowrap">
              <p className="text-sm font-bold leading-tight">잠사박물관</p>
              <p className="text-[10px] text-silk-gold-light font-medium">플레이팝</p>
            </div>
          )}
        </div>
      </div>

      {/* 메뉴 */}
      <nav className="flex-1 py-3 overflow-y-auto">
        <div className="px-3 space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeMainTab === item.id;

            return (
              <button
                key={item.id}
                onClick={() => setActiveMainTab(item.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all text-sm ${
                  isActive
                    ? 'bg-museum-green text-white font-medium shadow-lg shadow-museum-green/30'
                    : 'text-gray-300 hover:bg-sidebar-hover hover:text-white'
                }`}
                title={sidebarCollapsed ? item.label : undefined}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.badge && (
                      <span
                        className={`min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full ${
                          isActive ? 'bg-white/20 text-white' : 'bg-danger text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {sidebarCollapsed && item.badge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-danger text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* 접기/펼치기 */}
      <div className="border-t border-white/10 p-3">
        <button
          onClick={toggleSidebar}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-gray-400 hover:bg-sidebar-hover hover:text-white transition-colors text-xs"
        >
          {sidebarCollapsed ? (
            <ChevronRight className="w-4 h-4" />
          ) : (
            <>
              <ChevronLeft className="w-4 h-4" />
              <span>접기</span>
            </>
          )}
        </button>
      </div>
    </aside>
  );
}
