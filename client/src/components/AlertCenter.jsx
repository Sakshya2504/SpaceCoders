import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Bell, Check, Clock3, ShieldAlert, X } from 'lucide-react';
import api from '../api';

// Only events that deserve nurse-facing attention are promoted into the alert center.
// Routine audit events remain available on the Audit Trail page.
const EVENT_META = {
  ESCALATION: {
    title: 'Immediate escalation',
    tone: 'critical',
    icon: ShieldAlert
  },
  DETERIORATION_DETECTED: {
    title: 'Deterioration detected',
    tone: 'critical',
    icon: AlertTriangle
  },
  TRIAGE_SCORED: {
    title: 'New triage recommendation',
    tone: 'info',
    icon: Clock3
  },
  CLINICIAN_OVERRIDE: {
    title: 'Clinician override',
    tone: 'warning',
    icon: AlertTriangle
  },
  FAIL_OPEN: {
    title: 'AI fail-open',
    tone: 'warning',
    icon: AlertTriangle
  },
  SURGE_SIMULATION: {
    title: 'Surge simulation completed',
    tone: 'info',
    icon: Bell
  }
};

const WATCHED_EVENTS = new Set(Object.keys(EVENT_META));

function normalizeEvent(event, source) {
  const meta = EVENT_META[event.eventType] || {
    title: event.eventType || 'System alert',
    tone: 'info',
    icon: Bell
  };

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
    read: false
  };
}

export default function AlertCenter({ socket }) {
  const [alerts, setAlerts] = useState([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState(null);

  const unreadCount = useMemo(
    () => alerts.filter(alert => !alert.read).length,
    [alerts]
  );

  useEffect(() => {
    let mounted = true;

    // Seed the dropdown with recent audited events so the user does not need
    // to have the page open at the exact moment an event occurred.
    api.get('/audit?limit=30')
      .then(response => {
        if (!mounted) return;

        const history = (response.data.data || [])
          .filter(event => WATCHED_EVENTS.has(event.eventType))
          .slice(0, 12)
          .map(event => normalizeEvent(event, 'history'));

        setAlerts(history);
      })
      .catch(() => {
        // Alert history is helpful but not critical to the core workflow.
      });

    const handleAlert = payload => {
      const eventType = payload?.eventType;
      if (!WATCHED_EVENTS.has(eventType)) return;

      const nextAlert = normalizeEvent(payload, 'live');
      setAlerts(current => [
        nextAlert,
        ...current.filter(item => item.id !== nextAlert.id)
      ].slice(0, 20));

      // Critical events also receive a visible toast so urgent information
      // is not hidden behind the notification menu.
      if (nextAlert.tone === 'critical') {
        setToast(nextAlert);
        window.setTimeout(() => {
          setToast(current => current?.id === nextAlert.id ? null : current);
        }, 6000);
      }
    };

    const socketEvents = {
      escalation: 'ESCALATION',
      deterioration: 'DETERIORATION_DETECTED',
      override: 'CLINICIAN_OVERRIDE',
      'triage:completed': 'TRIAGE_SCORED',
      'surge:completed': 'SURGE_SIMULATION'
    };

    const handlers = Object.entries(socketEvents).map(([socketEvent, eventType]) => {
      const handler = (payload = {}) => handleAlert({
        ...payload,
        eventType,
        timestamp: payload.timestamp || new Date().toISOString()
      });

      socket.on(socketEvent, handler);
      return [socketEvent, handler];
    });

    return () => {
      mounted = false;
      handlers.forEach(([socketEvent, handler]) => socket.off(socketEvent, handler));
    };
  }, [socket]);

  const markAllRead = () => {
    setAlerts(current => current.map(alert => ({ ...alert, read: true })));
  };

  const markRead = id => {
    setAlerts(current => current.map(alert => (
      alert.id === id ? { ...alert, read: true } : alert
    )));
  };

  const dismiss = id => {
    setAlerts(current => current.filter(alert => alert.id !== id));
  };

  return (
    <div className="alert-center">
      <button
        className={`alert-bell ${unreadCount ? 'has-alerts' : ''}`}
        aria-label={`Open alerts${unreadCount ? `, ${unreadCount} unread` : ''}`}
        onClick={() => setOpen(value => !value)}
      >
        <Bell size={16} />
        {unreadCount > 0 && (
          <span className="alert-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="alert-panel">
          <div className="alert-panel-head">
            <div>
              <strong>Safety alerts</strong>
              <small>{unreadCount} unread · realtime monitoring</small>
            </div>
            <button className="alert-read-button" onClick={markAllRead}>
              Mark all read
            </button>
          </div>

          {!alerts.length && (
            <div className="alert-empty">
              <Check size={18} />
              <span>No active alerts</span>
            </div>
          )}

          {alerts.map(alert => {
            const Icon = alert.icon;

            return (
              <div
                key={alert.id}
                className={`alert-item ${alert.tone} ${alert.read ? 'read' : ''}`}
              >
                <button
                  className="alert-item-main"
                  onClick={() => markRead(alert.id)}
                  aria-label={`Mark ${alert.title} as read`}
                >
                  <span className="alert-item-icon"><Icon size={15} /></span>
                  <span className="alert-item-content">
                    <strong>{alert.title}</strong>
                    <small>
                      {alert.patientId || 'SYSTEM'} · {new Date(alert.timestamp).toLocaleString()}
                    </small>
                  </span>
                </button>

                <span className="alert-item-actions">
                  {!alert.read && <span className="alert-unread-dot" />}
                  <button
                    className="alert-dismiss"
                    aria-label="Dismiss alert"
                    onClick={() => dismiss(alert.id)}
                  >
                    <X size={14} />
                  </button>
                </span>
              </div>
            );
          })}
        </div>
      )}

      {toast && (
        <div className={`alert-toast ${toast.tone}`} role="alert">
          <span className="alert-item-icon"><ShieldAlert size={16} /></span>
          <div>
            <strong>{toast.title}</strong>
            <small>{toast.patientId || 'SYSTEM'} requires attention.</small>
          </div>
          <button aria-label="Close alert" onClick={() => setToast(null)}>
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
