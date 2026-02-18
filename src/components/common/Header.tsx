import {
  Bell,
  Search,
  ChevronDown,
  Settings,
  LogOut,
  User,
  Moon,
  Sun,
  Menu,
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useAppStore } from '../../stores/appStore';
import { formatRelativeTime } from '../../utils/format';

export default function Header() {
  const {
    currentUser,
    notifications,
    unreadNotificationCount,
    markNotificationRead,
    toggleSidebar,
  } = useAppStore();

  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [darkMode, setDarkMode] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 bg-white border-b border-border flex items-center justify-between px-4 sticky top-0 z-30">
      {/* 좌측: 사이드바 토글 + 검색 */}
      <div className="flex items-center gap-3">
        <button
          onClick={toggleSidebar}
          className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors lg:hidden"
        >
          <Menu className="w-5 h-5 text-text-secondary" />
        </button>

        <div className="relative hidden sm:block">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="검색 (예약번호, 고객명, 프로그램...)"
            className="pl-9 pr-4 py-1.5 w-72 text-sm border border-border rounded-lg bg-page-bg focus:outline-none focus:ring-2 focus:ring-museum-green/20 focus:border-museum-green transition-all"
          />
        </div>
      </div>

      {/* 우측: 알림 + 사용자 메뉴 */}
      <div className="flex items-center gap-2">
        {/* 다크모드 토글 */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
        >
          {darkMode ? (
            <Sun className="w-4.5 h-4.5 text-text-secondary" />
          ) : (
            <Moon className="w-4.5 h-4.5 text-text-secondary" />
          )}
        </button>

        {/* 알림 */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
          >
            <Bell className="w-4.5 h-4.5 text-text-secondary" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center badge-pulse">
                {unreadNotificationCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-border overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <h3 className="font-semibold text-sm">알림</h3>
                <span className="text-xs text-text-muted">
                  {unreadNotificationCount}개 읽지 않음
                </span>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-8 text-center text-text-muted text-sm">
                    알림이 없습니다
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <button
                      key={notif.id}
                      onClick={() => markNotificationRead(notif.id)}
                      className={`w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-border/50 transition-colors ${
                        !notif.read ? 'bg-blue-50/50' : ''
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${
                            notif.type === 'info'
                              ? 'bg-info'
                              : notif.type === 'success'
                              ? 'bg-success'
                              : notif.type === 'warning'
                              ? 'bg-warning'
                              : 'bg-danger'
                          }`}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{notif.title}</p>
                          <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">
                            {notif.message}
                          </p>
                          <p className="text-xs text-text-muted mt-1">
                            {formatRelativeTime(notif.created_at)}
                          </p>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
              <button className="w-full px-4 py-2.5 text-center text-xs text-museum-green font-medium hover:bg-gray-50 transition-colors">
                전체 알림 보기
              </button>
            </div>
          )}
        </div>

        {/* 사용자 메뉴 */}
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="flex items-center gap-2 pl-3 pr-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <div className="w-7 h-7 rounded-full bg-museum-green text-white flex items-center justify-center text-xs font-bold">
              {currentUser?.name?.charAt(0) || 'U'}
            </div>
            <span className="text-sm font-medium hidden sm:block">
              {currentUser?.name || '사용자'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-text-muted" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-border overflow-hidden z-50">
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm font-semibold">{currentUser?.name}</p>
                <p className="text-xs text-text-muted">{currentUser?.email}</p>
                <span className="inline-block mt-1 px-2 py-0.5 bg-museum-green/10 text-museum-green text-[10px] font-medium rounded-full">
                  {currentUser?.role === 'superadmin' ? '최고관리자' : '관리자'}
                </span>
              </div>
              <div className="py-1">
                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                  <User className="w-4 h-4 text-text-secondary" />
                  내 프로필
                </button>
                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm hover:bg-gray-50 transition-colors">
                  <Settings className="w-4 h-4 text-text-secondary" />
                  설정
                </button>
              </div>
              <div className="border-t border-border py-1">
                <button className="w-full flex items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-red-50 transition-colors">
                  <LogOut className="w-4 h-4" />
                  로그아웃
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
