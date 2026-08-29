import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { socket } from './socket';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Audit from './pages/Audit';
import Dashboard from './pages/Dashboard';
import Intake from './pages/Intake';
import Login from './pages/Login';
import PatientDetail from './pages/PatientDetail';
import PastPatients from './pages/PastPatients';
import Queue from './pages/Queue';
import Signup from './pages/Signup';

function isAuthenticated() {
  return Boolean(localStorage.getItem('pt_token'));
}

function ProtectedRoute({ children }) {
  // This is only a presentation-level guard. The API still validates the JWT
  // and role on every protected request.
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

function getPageTitle(pathname) {
  if (pathname.startsWith('/patients/')) return 'Patient Review';
  if (pathname === '/intake') return 'Patient Intake';
  if (pathname === '/queue') return 'Live Queue';
  if (pathname === '/past-patients') return 'Past Patients';
  if (pathname === '/audit') return 'Audit Trail';
  return 'ED Command Centre';
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [health, setHealth] = useState({
    aiEngine: 'ONLINE',
    database: 'ONLINE',
    realtime: 'DISCONNECTED'
  });

  const user = JSON.parse(localStorage.getItem('pt_user') || 'null');

  useEffect(() => {
    socket.connect();

    const handleHealth = value => {
      setHealth(current => ({ ...current, ...value }));
    };
    const handleConnect = () => {
      setHealth(current => ({ ...current, realtime: 'CONNECTED' }));
    };
    const handleDisconnect = () => {
      setHealth(current => ({ ...current, realtime: 'DISCONNECTED' }));
    };

    socket.on('system:health', handleHealth);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);

    return () => {
      socket.off('system:health', handleHealth);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.disconnect();
    };
  }, []);

  const logout = () => {
    localStorage.removeItem('pt_token');
    localStorage.removeItem('pt_user');
    socket.disconnect();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <main className="main-area">
        <TopBar
          title={getPageTitle(location.pathname)}
          health={health}
          user={user}
          onLogout={logout}
          socket={socket}
        />
        <div className="page-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard health={health} />} />
            <Route path="/intake" element={<Intake />} />
            <Route path="/queue" element={<Queue />} />
            <Route path="/past-patients" element={<PastPatients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/audit" element={<Audit />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="*"
        element={
          <ProtectedRoute>
            <Shell />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
