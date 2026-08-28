import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { socket } from './socket';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Intake from './pages/Intake';
import Queue from './pages/Queue';
import PatientDetail from './pages/PatientDetail';
import Audit from './pages/Audit';

function Protected({ children }) {
  return localStorage.getItem('pt_token') ? children : <Navigate to="/login" replace />;
}

function Shell() {
  const location = useLocation();
  const navigate = useNavigate();
  const [health, setHealth] = useState({ aiEngine: 'ONLINE', database: 'ONLINE', realtime: 'DISCONNECTED' });
  const user = JSON.parse(localStorage.getItem('pt_user') || 'null');

  useEffect(() => {
    socket.connect();
    const onHealth = value => setHealth(old => ({ ...old, ...value, realtime: 'CONNECTED' }));
    const onConnect = () => setHealth(old => ({ ...old, realtime: 'CONNECTED' }));
    const onDisconnect = () => setHealth(old => ({ ...old, realtime: 'DISCONNECTED' }));
    socket.on('system:health', onHealth);
    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    return () => {
      socket.off('system:health', onHealth);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.disconnect();
    };
  }, []);

  const title = location.pathname.startsWith('/patients') ? 'Patient Review'
    : location.pathname === '/intake' ? 'Patient Intake'
    : location.pathname === '/queue' ? 'Live Queue'
    : location.pathname === '/audit' ? 'Audit Trail'
    : 'ED Command Centre';

  const logout = () => {
    localStorage.clear();
    socket.disconnect();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <Sidebar user={user} />
      <main className="main-area">
        <TopBar title={title} health={health} user={user} onLogout={logout} />
        <div className="page-content">
          <Routes>
            <Route path="/dashboard" element={<Dashboard health={health} />} />
            <Route path="/intake" element={<Intake />} />
            <Route path="/queue" element={<Queue />} />
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
      <Route path="*" element={<Protected><Shell /></Protected>} />
    </Routes>
  );
}
