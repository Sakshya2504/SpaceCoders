import {
  Activity,
  ClipboardPlus,
  FileClock,
  LayoutDashboard,
  ListOrdered,
  ShieldCheck
} from 'lucide-react';
import { NavLink } from 'react-router-dom';

// Keep navigation focused on the actual workflow used by the care team.
const NAV_ITEMS = [
  { to: '/dashboard', label: 'Command Centre', Icon: LayoutDashboard },
  { to: '/intake', label: 'Patient Intake', Icon: ClipboardPlus },
  { to: '/queue', label: 'Live Queue', Icon: ListOrdered },
  { to: '/audit', label: 'Audit Trail', Icon: FileClock }
];

function getInitial(name) {
  return name?.trim()?.charAt(0)?.toUpperCase() || 'U';
}

function formatRole(role) {
  return String(role || 'role').replaceAll('_', ' ');
}

export default function Sidebar({ user }) {
  return (
    <aside className="sidebar" aria-label="Primary navigation">
      <div className="brand">
        <div className="brand-mark" aria-hidden="true">
          <Activity size={21} />
        </div>
        <div>
          <strong>
            PatientTriage<span>.ai</span>
          </strong>
          <small>Emergency care platform</small>
        </div>
      </div>

      <div className="nav-caption">OPERATIONS</div>

      <nav className="sidebar-nav">
        {NAV_ITEMS.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="demo-badge">
          <ShieldCheck size={15} aria-hidden="true" />
          Safety-first workflow
        </div>

        <div className="user-mini">
          <div className="avatar" aria-hidden="true">
            {getInitial(user?.name)}
          </div>
          <div className="user-mini-copy">
            <strong>{user?.name || 'User'}</strong>
            <small>{formatRole(user?.role)}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
