import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Bell,
  Check,
  Clock3,
  ShieldAlert,
  X
} from 'lucide-react';
import api from '../api';

// Only events that deserve nurse-facing attention are promoted into the alert center.
// Routine audit activity remains available from the Audit Trail page.
const EVENT_META = {
  ESCALATION: {
    title: 'Immediate escalation',
    description: 'A high-priority safety event needs review.',
    tone: 'critical',
    icon: ShieldAlert
  },
  DETERIORATION_DETECTED: {
    title: 'Deterioration detected',
    description: 'New observations increased the patient\'s priority.',
    tone: 'critical',
    icon: AlertTriangle
  },
  TRIAGE_SCORED: {
    title: 'New triage recommendation',
    description: 'A fresh recommendation is available for review.',
    tone: 'info',
    icon: Clock3
  },
  CLINICIAN_OVERRIDE: {
    title: 'Clinician override',
    description: 'A clinician changed the model recommendation.',
    tone: 'warning',
    icon: AlertTriangle
  },
  FAIL_OPEN: {
    title: 'AI fail-open',
    description: 'The model is unavailable and manual triage is active.',
    tone: 'warning',
    icon: AlertTriangle
  },
  SURGE_SIMULATION: {
    title: 'Surge simulation completed',
    description: 'The queue simulation has finished.',
    tone: 'info',
    icon: Bell
  }
};

const WATCHED_EVENTS = new Set(Object.keys(EVENT_META));

function normalizeEvent(event, source) {
  const meta = EVENT_META[event.eventType] || {
    title: event.eventType || 'System alert',
    description: 'Review the associated event for more information.',
    tone: 'info',
    icon: Bell
  };

  return {
    id: event.eventId || `${event.eventType}-${event.timestamp}-${Math.random()}`,
    eventType: event.eventType,
    title: meta.title,
    description: meta.description,
    tone: meta.tone,
    icon: meta.icon,
    patientId: event.patientId || null,
    actorRole: event.actorRole || 'SYSTEM',
    timestamp: event.timestamp || new Date().toISOString(),
    source,
    read: false
  };
}

function formatAlertTime(timestamp) {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return 'Unknown time';

  return date.toLocaleString([], {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  });
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

    // Load recent history once so an alert is not missed simply because the
    // clinician was on another page when the event happened.
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
        // Alert history is helpful, but a history request failure should not
        // interrupt patient care or disable the rest of the portal.
      });

    const handleAlert = payload => {
      const eventType = payload?.eventType;
      if (!WATCHED_EVENTS.has(eventType)) return;

      const nextAlert = normalizeEvent(payload, 'live');

      setAlerts(current => [
        nextAlert,
        ...current.filter(item => item.id !== nextAlert.id)
      ].slice(0, 20));

      // Critical events also get a toast so they are visible without opening
      // the notification menu.
      if (nextAlert.tone === 'critical') {
        setToast(nextAlert);

        window.setTimeout(() => {
          setToast(current => (
            current?.id === nextAlert.id ? null : current
          ));
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
        type="button"
        aria-expanded={open}
        aria-label={`Open alerts${unreadCount ? `, ${unreadCount} unread` : ''}`}
        onClick={() => setOpen(value => !value)}
      >
        <Bell size={17} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="alert-count">{unreadCount > 9 ? '9+' : unreadCount}</span>
        )}
      </button>

      {open && (
        <div className="alert-panel" role="dialog" aria-label="Safety alerts">
          <div className="alert-panel-head">
            <div>
              <strong>Safety alerts</strong>
              <small>
                {unreadCount ? `${unreadCount} unread` : 'All caught up'} · realtime monitoring
              </small>
            </div>
            {unreadCount > 0 && (
              <button
                className="alert-read-button"
                type="button"
                onClick={markAllRead}
              >
                Mark all read
              </button>
            )}
          </div>

          {!alerts.length && (
            <div className="alert-empty">
              <Check size={18} aria-hidden="true" />
              <div>
                <strong>No active alerts</strong>
                <span>New safety events will appear here automatically.</span>
              </div>
            </div>
          )}

          {alerts.map(alert => {
            const Icon = alert.icon;

            return (
              <article
                key={alert.id}
                className={`alert-item ${alert.tone} ${alert.read ? 'read' : ''}`}
              >
                <button
                  className="alert-item-main"
                  type="button"
                  onClick={() => markRead(alert.id)}
                  aria-label={`${alert.read ? 'Viewed' : 'Mark as read'}: ${alert.title}`}
                >
                  <span className="alert-item-icon">
                    <Icon size={15} aria-hidden="true" />
                  </span>

                  <span className="alert-item-content">
                    <strong>{alert.title}</strong>
                    <span>{alert.description}</span>
                    <small>
                      {alert.patientId || 'SYSTEM'} · {formatAlertTime(alert.timestamp)}
                    </small>
                  </span>
                </button>

                <div className="alert-item-actions">
                  {!alert.read && <span className="alert-unread-dot" aria-label="Unread" />}
                  <button
                    className="alert-dismiss"
                    type="button"
                    aria-label="Dismiss alert"
                    onClick={() => dismiss(alert.id)}
                  >
                    <X size={14} aria-hidden="true" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {toast && (
        <div className={`alert-toast ${toast.tone}`} role="alert">
          <span className="alert-item-icon">
            <ShieldAlert size={16} aria-hidden="true" />
          </span>
          <div>
            <strong>{toast.title}</strong>
            <small>{toast.patientId || 'SYSTEM'} requires attention.</small>
          </div>
          <button
            type="button"
            aria-label="Close alert"
            onClick={() => setToast(null)}
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}
