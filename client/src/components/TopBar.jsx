import { LogOut, Radio } from 'lucide-react';
import AlertCenter from './AlertCenter';

export default function TopBar({ title, health, user, onLogout, socket }) {
  return (
    <header className="topbar">
      <div>
        <div className="breadcrumbs">PATIENTTRIAGE.AI / OPERATIONS</div>
        <h1>{title}</h1>
      </div>

      <div className="topbar-actions">
        <div className="health-pill">
          <span className="health-dot" />AI: {health.aiEngine}
        </div>
        <div className="health-pill">
          <Radio size={14} />Realtime: {health.realtime}
        </div>
        <AlertCenter socket={socket} />
        <div className="user-chip">
          <span>{user?.name}</span>
          <small>{user?.role?.replaceAll('_', ' ')}</small>
        </div>
        <button className="icon-button" onClick={onLogout} aria-label="Log out">
          <LogOut size={17} />
        </button>
      </div>
    </header>
  );
}
