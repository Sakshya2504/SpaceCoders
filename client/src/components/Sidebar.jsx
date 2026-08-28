import { Activity, ClipboardPlus, FileClock, LayoutDashboard, ListOrdered, ShieldCheck } from 'lucide-react';
import { NavLink } from 'react-router-dom';

const links = [
  ['/dashboard', 'Command Centre', LayoutDashboard],
  ['/intake', 'Patient Intake', ClipboardPlus],
  ['/queue', 'Live Queue', ListOrdered],
  ['/audit', 'Audit Trail', FileClock]
];

export default function Sidebar({ user }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark"><Activity size={21} /></div>
        <div>
          <strong>PatientTriage<span>.ai</span></strong>
          <small>EMERGENCY CARE PLATFORM</small>
        </div>
      </div>

      <div className="nav-caption">OPERATIONS</div>
      <nav className="sidebar-nav">
        {links.map(([to, label, Icon]) => (
          <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
            <Icon size={18} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="sidebar-bottom">
        <div className="demo-badge"><ShieldCheck size={15} /> Synthetic data environment</div>
        <div className="user-mini">
          <div className="avatar">{user?.name?.slice(0, 1) || 'U'}</div>
          <div className="user-mini-copy">
            <strong>{user?.name || 'User'}</strong>
            <small>{user?.role?.replaceAll('_', ' ') || 'role'}</small>
          </div>
        </div>
      </div>
    </aside>
  );
}
