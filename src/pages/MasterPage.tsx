import {
  Building,
  Database,
  Shield,
  User,
  FileText,
  Building2,
  Settings,
} from 'lucide-react';
import TabNavigation from '../components/common/TabNavigation';
import FacilityTab from '../components/master/FacilityTab';
import DataTab from '../components/master/DataTab';
import AdminTab from '../components/master/AdminTab';
import AccountTab from '../components/master/AccountTab';
import ReservationFormTab from '../components/master/ReservationFormTab';
import AgencyMasterTab from '../components/master/AgencyMasterTab';
import SystemTab from '../components/master/SystemTab';
import { useAppStore } from '../stores/appStore';
import type { MasterSubTab } from '../types';

const masterTabs: { id: MasterSubTab; label: string; icon: React.ReactNode }[] = [
  { id: 'facility', label: '시설', icon: <Building className="w-3.5 h-3.5" /> },
  { id: 'data', label: '데이터', icon: <Database className="w-3.5 h-3.5" /> },
  { id: 'admin', label: '관리자', icon: <Shield className="w-3.5 h-3.5" /> },
  { id: 'account', label: '계정', icon: <User className="w-3.5 h-3.5" /> },
  { id: 'reservationForm', label: '예약폼', icon: <FileText className="w-3.5 h-3.5" /> },
  { id: 'agency', label: '대행사', icon: <Building2 className="w-3.5 h-3.5" /> },
  { id: 'system', label: '시스템', icon: <Settings className="w-3.5 h-3.5" /> },
];

function renderContent(tab: MasterSubTab) {
  switch (tab) {
    case 'facility':
      return <FacilityTab />;
    case 'data':
      return <DataTab />;
    case 'admin':
      return <AdminTab />;
    case 'account':
      return <AccountTab />;
    case 'reservationForm':
      return <ReservationFormTab />;
    case 'agency':
      return <AgencyMasterTab />;
    case 'system':
      return <SystemTab />;
    default:
      return <SystemTab />;
  }
}

export default function MasterPage() {
  const { activeMasterSubTab, setActiveMasterSubTab } = useAppStore();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">마스터 설정</h1>
          <p className="text-xs text-text-muted mt-0.5">시스템 설정 및 관리 도구</p>
        </div>
      </div>

      <TabNavigation
        tabs={masterTabs}
        activeTab={activeMasterSubTab}
        onTabChange={(id) => setActiveMasterSubTab(id as MasterSubTab)}
        variant="pills"
        size="sm"
      />

      <div>{renderContent(activeMasterSubTab)}</div>
    </div>
  );
}
