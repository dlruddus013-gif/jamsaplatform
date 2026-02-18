import Sidebar from './components/common/Sidebar';
import Header from './components/common/Header';
import ToastContainer from './components/common/Toast';
import MasterPage from './pages/MasterPage';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import ReservationPage from './pages/ReservationPage';
import SchedulePage from './pages/SchedulePage';
import ChatPage from './pages/ChatPage';
import AgencyPage from './pages/AgencyPage';
import { useAppStore } from './stores/appStore';

function App() {
  const { activeMainTab } = useAppStore();

  function renderPage() {
    switch (activeMainTab) {
      case 'master':
        return <MasterPage />;
      case 'dashboard':
        return <DashboardPage />;
      case 'calendar':
        return <CalendarPage />;
      case 'reservation':
        return <ReservationPage />;
      case 'schedule':
        return <SchedulePage />;
      case 'chat':
        return <ChatPage />;
      case 'agency':
        return <AgencyPage />;
      default:
        return <DashboardPage />;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {renderPage()}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}

export default App;
