import { useRef, useEffect, useState } from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number;
  disabled?: boolean;
}

interface TabNavigationProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  variant?: 'default' | 'pills' | 'underline';
  size?: 'sm' | 'md';
}

export default function TabNavigation({
  tabs,
  activeTab,
  onTabChange,
  variant = 'default',
  size = 'md',
}: TabNavigationProps) {
  const tabsRef = useRef<HTMLDivElement>(null);
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });

  useEffect(() => {
    if (variant !== 'underline' || !tabsRef.current) return;

    const activeElement = tabsRef.current.querySelector(`[data-tab="${activeTab}"]`) as HTMLElement;
    if (activeElement) {
      setIndicatorStyle({
        left: activeElement.offsetLeft,
        width: activeElement.offsetWidth,
      });
    }
  }, [activeTab, variant]);

  if (variant === 'pills') {
    return (
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => !tab.disabled && onTabChange(tab.id)}
            disabled={tab.disabled}
            className={`flex items-center gap-1.5 px-3 ${
              size === 'sm' ? 'py-1.5 text-xs' : 'py-2 text-sm'
            } rounded-full font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-museum-green text-white shadow-sm'
                : tab.disabled
                ? 'text-text-muted cursor-not-allowed'
                : 'text-text-secondary hover:bg-gray-100 hover:text-text-primary'
            }`}
          >
            {tab.icon}
            {tab.label}
            {tab.badge !== undefined && tab.badge > 0 && (
              <span
                className={`min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold rounded-full px-1 ${
                  activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-600'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>
    );
  }

  if (variant === 'underline') {
    return (
      <div className="relative" ref={tabsRef}>
        <div className="flex border-b border-border">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              data-tab={tab.id}
              onClick={() => !tab.disabled && onTabChange(tab.id)}
              disabled={tab.disabled}
              className={`flex items-center gap-1.5 px-4 ${
                size === 'sm' ? 'py-2 text-xs' : 'py-3 text-sm'
              } font-medium transition-colors relative ${
                activeTab === tab.id
                  ? 'text-museum-green'
                  : tab.disabled
                  ? 'text-text-muted cursor-not-allowed'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold rounded-full px-1 bg-danger text-white">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>
        <div
          className="absolute bottom-0 h-0.5 bg-museum-green tab-indicator rounded-full"
          style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
        />
      </div>
    );
  }

  // default variant
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => !tab.disabled && onTabChange(tab.id)}
          disabled={tab.disabled}
          className={`flex items-center gap-1.5 px-3 ${
            size === 'sm' ? 'py-1.5 text-xs' : 'py-2 text-sm'
          } rounded-md font-medium transition-all ${
            activeTab === tab.id
              ? 'bg-white text-text-primary shadow-sm'
              : tab.disabled
              ? 'text-text-muted cursor-not-allowed'
              : 'text-text-secondary hover:text-text-primary'
          }`}
        >
          {tab.icon}
          {tab.label}
          {tab.badge !== undefined && tab.badge > 0 && (
            <span
              className={`min-w-[16px] h-4 flex items-center justify-center text-[10px] font-bold rounded-full px-1 ${
                activeTab === tab.id ? 'bg-museum-green text-white' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {tab.badge}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
