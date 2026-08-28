import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, Check, ChevronDown, Clock3, ShieldAlert, X } from 'lucide-react';
import api from '../api';

const EVENT_META = {
  ESCALATION: { title: 'Immediate escalation', tone: 'critical', icon: ShieldAlert },
  DETERIORATION_DETECTED: { title: 'Deterioration detected', tone: 'critical', icon: AlertTriangle },
  TRIAGE_SCORED: { title: 'New triage recommendation', tone: 'info', icon: Clock3 },
  CLINICIAN_OVERRIDE: { title: 'Clinician override', tone: 'warning', icon: AlertTriangle },
  FAIL_OPEN: { title: 'AI fail-open', tone: 'warning', icon: AlertTriangle },
  SURGE_SIMULATION: { title: 'Surge simulation completed', tone: 'info', icon: Bell },
};

const WATCHED_EVENTS = new Set(Object.keys(EVENT_META));

function normalizeEvent(event, source = 'live') {
  const meta = EVENT_META[event.eventType] || { title: event.eventType || 'System alert', tone: 'info', icon: Bell };
  return {
    id: event.eventId || `${event.eventType}-${event.timestamp}-${Math.random()}`,
    eventType: event.eventType,
    title: meta.title,
    tone: meta.tone,
    icon: meta.icon,
    patientId: event.patientId || null,
    actorRole: event.actorRole || 'SYSTEM',
    timestamp: event.timestamp || new Date().toISOString(),
    source,
    read: false,
  };
}

export default function AlertCenter({ socket }) {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const unread = useMemo(() => alerts.filter((item) => !item.read).length, [alerts]);

  useEffect(() => {
    let mounted = true;

    api.get('/audit?limit=30')
      .then((response) => {
        if (!mounted) return;
        const history = (response.data.data || [])
          .filter((event) => WATCHED_EVENTS.has(event.eventType))
          .slice(0, 12)
          .map((event) => normalizeEvent(event, 'history'));
        setAlerts(history);
      })
      .catch(() => {});

    const onAlertEvent = (payload) => {
      const eventType = payload?.eventType;
      if (!WATCHED_EVENTS.has(eventType)) return;
      const next = normalizeEvent(payload, 'live');
      setAlerts((current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 20));
      if (next.tone === 'critical') {
        setToast(next);
        window.setTimeout(() => setToast((current) => current?.id === next.id ? null : current), 6000);
      }
    };

    const eventMap = {
      escalation: 'ESCALATION',
      deterioration: 'DETERIORATION_DETECTED',
      override: 'CLINICIAN_OVERRIDE',
      'triage:completed': 'TRIAGE_SCORED',
      'surge:completed': 'SURGE_SIMULATION',
    };

    const handlers = Object.entries(eventMap).map(([socketEvent, eventType]) => {
      const handler = (payload = {}) => onAlertEvent({ ...payload, eventType, timestamp: payload.timestamp || new Date().toISOString() });
      socket.on(socketEvent, handler);
      return [socketEvent, handler];
    });

    return () => {
      mounted = false;
      handlers.forEach(([socketEvent, handler]) => socket.off(socketEvent, handler));
    };
  }, [socket]);

  const markAllRead = () => setAlerts((current) => current.map((item) => ({ ...item, read: true })));
  const dismiss = (id) => setAlerts((current) => current.filter((item) => item.id !== id));
  const markRead = (id) => setAlerts((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));

  return (
    <div className="alert-center">
      <button
        className={`alert-bell ${unread ? 'has-alerts' : ''}`}
        aria-label="Open alerts"
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={16} />
        {unread > 0 && <span className="alert-count">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && (
        <div className="alert-panel">
          <div className="alert-panel-head">
            <div>
              <strong>Safety alerts</strong>
              <small>{unread} unread · realtime monitoring</small>
            </div>
            <button className="alert-read-button" onClick={markAllRead}>Mark all read</button>
          </div>

          {!alerts.length && (
            <div className="alert-empty">
              <Check size={18} />
              <span>No active alerts</span>
            </div>
          )}

          {alerts.map((item) => {
            const Icon = item.icon;
            return (
              <button key={item.id} className={`alert-item ${item.tone} ${item.read ? 'read' : ''}`} onClick={() => markRead(item.id)}>
                <span className="alert-item-icon"><Icon size={15} /></span>
                <span className="alert-item-content">
                  <strong>{item.title}</strong>
                  <small>{item.patientId || 'SYSTEM'} · {new Date(item.timestamp).toLocaleString()}</small>
                </span>
                <span className="alert-item-actions">
                  {!item.read && <span className="alert-unread-dot" />}
                  <X size={14} onClick={(event) => { event.stopPropagation(); dismiss(item.id); }} />
                </span>
              </button>
            );
          })}
        </div>
      )}

      {toast && (
        <div className={`alert-toast ${toast.tone}`}>
          <span className="alert-item-icon"><ShieldAlert size={16} /></span>
          <div>
            <strong>{toast.title}</strong>
            <small>{toast.patientId || 'SYSTEM'} requires attention.</small>
          </div>
          <button aria-label="Close alert" onClick={() => setToast(null)}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}
