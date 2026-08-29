import { LogOut, Radio } from 'lucide-react';
import AlertCenter from './AlertCenter';

function getHealthClass(status) {
  const normalized = String(status || '').toUpperCase();

  if (normalized === 'ONLINE' || normalized === 'CONNECTED') {
    return 'health-online';
  }

  if (normalized === 'FAIL-OPEN' || normalized === 'DEGRADED') {
    return 'health-warning';
  }

  return 'health-offline';
}

function formatRole(role) {
  return String(role || 'role').replaceAll('_', ' ');
}

/**
 * The top bar stays deliberately small: it gives the care team the current
 * page, system state, alerts, and session controls without competing with
 * patient information in the main workspace.
 */
export default function TopBar({ title, health, user, onLogout, socket }) {
  const aiStatus = health?.aiEngine || 'UNKNOWN';
  const realtimeStatus = health?.realtime || 'DISCONNECTED';

  return (
    <header className="topbar">
      <div className="topbar-heading">
        <div className="breadcrumbs">PATIENTTRIAGE.AI / OPERATIONS</div>
        <h1>{title}</h1>
      </div>

      <div className="topbar-actions">
        <div className={`health-pill ${getHealthClass(aiStatus)}`}>
          <span className="health-dot" />
          AI: {aiStatus}
        </div>

        <div className={`health-pill ${getHealthClass(realtimeStatus)}`}>
          <Radio size={14} aria-hidden="true" />
          Realtime: {realtimeStatus}
        </div>

        <AlertCenter socket={socket} />

        <div className="user-chip" title={user?.name || 'Signed-in user'}>
          <span>{user?.name || 'User'}</span>
          <small>{formatRole(user?.role)}</small>
        </div>

        <button
          className="icon-button"
          type="button"
          onClick={onLogout}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={17} aria-hidden="true" />
        </button>
      </div>
    </header>
  );
}
