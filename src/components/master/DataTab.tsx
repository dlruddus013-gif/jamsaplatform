import {
  Database,
  Download,
  Upload,
  FileSpreadsheet,
  RefreshCw,
  Trash2,
  BarChart3,
  Table2,
  HardDrive,
  Clock,
  ArrowUpDown,
  FileText,
} from 'lucide-react';
import { useState } from 'react';
import Card from '../common/Card';

interface DataTable {
  name: string;
  rows: number;
  size: string;
  lastUpdated: string;
  description: string;
}

const dataTables: DataTable[] = [
  { name: 'reservations', rows: 15842, size: '12.4MB', lastUpdated: '2분 전', description: '예약 데이터' },
  { name: 'facilities', rows: 6, size: '24KB', lastUpdated: '3일 전', description: '시설 정보' },
  { name: 'programs', rows: 18, size: '156KB', lastUpdated: '1일 전', description: '체험 프로그램' },
  { name: 'agencies', rows: 12, size: '48KB', lastUpdated: '5일 전', description: '대행사 정보' },
  { name: 'users', rows: 24, size: '32KB', lastUpdated: '1시간 전', description: '관리자 계정' },
  { name: 'activity_logs', rows: 48523, size: '45.2MB', lastUpdated: '방금 전', description: '활동 로그' },
  { name: 'chat_messages', rows: 3241, size: '2.8MB', lastUpdated: '10분 전', description: '채팅 메시지' },
  { name: 'schedules', rows: 892, size: '1.2MB', lastUpdated: '30분 전', description: '일정 데이터' },
  { name: 'notifications', rows: 2156, size: '1.8MB', lastUpdated: '5분 전', description: '알림 데이터' },
  { name: 'form_configs', rows: 4, size: '16KB', lastUpdated: '1주 전', description: '예약 폼 설정' },
];

export default function DataTab() {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<'name' | 'rows' | 'size'>('name');

  const filteredTables = dataTables
    .filter((t) => t.name.includes(searchQuery) || t.description.includes(searchQuery))
    .sort((a, b) => {
      if (sortField === 'name') return a.name.localeCompare(b.name);
      if (sortField === 'rows') return b.rows - a.rows;
      return 0;
    });

  const totalRows = dataTables.reduce((sum, t) => sum + t.rows, 0);
  const totalSizeMB = 63.7;

  return (
    <div className="space-y-4">
      {/* 데이터 요약 */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card-bg border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Table2 className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">테이블</span>
          </div>
          <p className="text-xl font-bold">{dataTables.length}개</p>
        </div>
        <div className="bg-card-bg border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">전체 행</span>
          </div>
          <p className="text-xl font-bold">{totalRows.toLocaleString()}</p>
        </div>
        <div className="bg-card-bg border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <HardDrive className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">DB 크기</span>
          </div>
          <p className="text-xl font-bold">{totalSizeMB}MB</p>
        </div>
        <div className="bg-card-bg border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-text-muted" />
            <span className="text-xs text-text-muted">마지막 백업</span>
          </div>
          <p className="text-xl font-bold text-sm mt-1">2시간 전</p>
        </div>
      </div>

      {/* 데이터 테이블 관리 */}
      <Card
        title="데이터 테이블"
        subtitle="Supabase 데이터베이스 테이블 현황"
        action={
          <div className="flex items-center gap-2">
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-museum-green bg-museum-green/10 rounded-lg hover:bg-museum-green/20 transition-colors">
              <Download className="w-3.5 h-3.5" />
              전체 백업
            </button>
            <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors">
              <Upload className="w-3.5 h-3.5" />
              데이터 복원
            </button>
          </div>
        }
        padding="none"
      >
        <div className="px-4 py-3 border-b border-border flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Database className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="테이블명 검색..."
              className="pl-9 pr-4 py-1.5 w-full text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-museum-green/20"
            />
          </div>
        </div>

        <table className="w-full">
          <thead>
            <tr className="border-b border-border bg-gray-50/50">
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">
                <button
                  onClick={() => setSortField('name')}
                  className="flex items-center gap-1 hover:text-text-primary"
                >
                  테이블명
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-text-muted">설명</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted">
                <button
                  onClick={() => setSortField('rows')}
                  className="flex items-center gap-1 ml-auto hover:text-text-primary"
                >
                  행 수
                  <ArrowUpDown className="w-3 h-3" />
                </button>
              </th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted">크기</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-text-muted">마지막 업데이트</th>
              <th className="text-center px-4 py-2.5 text-xs font-semibold text-text-muted">작업</th>
            </tr>
          </thead>
          <tbody>
            {filteredTables.map((table) => (
              <tr key={table.name} className="border-b border-border hover:bg-gray-50 transition-colors">
                <td className="px-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-museum-green" />
                    <span className="text-sm font-mono font-medium">{table.name}</span>
                  </div>
                </td>
                <td className="px-4 py-2.5 text-sm text-text-secondary">{table.description}</td>
                <td className="px-4 py-2.5 text-sm text-right font-mono">{table.rows.toLocaleString()}</td>
                <td className="px-4 py-2.5 text-sm text-right text-text-secondary">{table.size}</td>
                <td className="px-4 py-2.5 text-sm text-right text-text-muted">{table.lastUpdated}</td>
                <td className="px-4 py-2.5">
                  <div className="flex items-center justify-center gap-1">
                    <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="CSV 내보내기">
                      <FileSpreadsheet className="w-3.5 h-3.5 text-text-secondary" />
                    </button>
                    <button className="p-1 hover:bg-gray-100 rounded transition-colors" title="조회">
                      <FileText className="w-3.5 h-3.5 text-text-secondary" />
                    </button>
                    <button className="p-1 hover:bg-red-50 rounded transition-colors" title="초기화">
                      <Trash2 className="w-3.5 h-3.5 text-danger" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
