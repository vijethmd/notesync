import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../api';
import './Notifications.css';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [responding, setResponding] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    notificationsAPI.getAll()
      .then(res => setNotifications(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
    notificationsAPI.markRead().catch(console.error);
  }, []);

  const handle = async (id, action) => {
    setResponding(id);
    try {
      const res = action === 'accept'
        ? await notificationsAPI.accept(id)
        : await notificationsAPI.decline(id);
      setNotifications(prev => prev.map(n => n._id === id ? { ...n, status: action === 'accept' ? 'accepted' : 'declined' } : n));
      if (action === 'accept' && res.data.noteId) {
        navigate(`/note/${res.data.noteId}`);
      }
    } catch (err) { console.error(err); }
    finally { setResponding(null); }
  };

  const pending = notifications.filter(n => n.status === 'pending');
  const past = notifications.filter(n => n.status !== 'pending');

  return (
    <div className="notif-page">
      <header className="notif-header">
        <button className="back-btn-notif" onClick={() => navigate('/')}>← Back</button>
        <div className="notif-header-title">
          <span className="notif-logo-icon">✦</span>
          <h1>Notifications</h1>
        </div>
        <div style={{ width: 80 }} />
      </header>

      <main className="notif-main">
        {loading ? (
          <div className="notif-loading">
            {[1,2,3].map(i => <div key={i} className="notif-skeleton" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="notif-empty">
            <span className="notif-empty-icon">🔔</span>
            <p>No notifications yet</p>
            <span>Invite notifications will appear here</span>
          </div>
        ) : (
          <>
            {pending.length > 0 && (
              <section className="notif-section">
                <h2 className="notif-section-label">Pending Invites</h2>
                {pending.map(n => <NotifCard key={n._id} n={n} onHandle={handle} responding={responding} />)}
              </section>
            )}
            {past.length > 0 && (
              <section className="notif-section">
                <h2 className="notif-section-label">Past</h2>
                {past.map(n => <NotifCard key={n._id} n={n} onHandle={handle} responding={responding} />)}
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function NotifCard({ n, onHandle, responding }) {
  const date = new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const isPending = n.status === 'pending';

  return (
    <div className={`notif-card ${isPending ? 'pending' : ''}`}>
      <div className="notif-avatar" style={{ background: n.sender?.color }}>
        {n.sender?.username?.[0]?.toUpperCase()}
      </div>
      <div className="notif-body">
        <p className="notif-text">
          <strong>{n.sender?.username}</strong> invited you to collaborate on{' '}
          <em>"{n.noteTitle || 'Untitled Note'}"</em>
        </p>
        <p className="notif-meta">
          {date} · {n.permission === 'write' ? 'Can edit' : 'Can read'}
        </p>
        {isPending && (
          <div className="notif-actions">
            <button
              className="notif-accept"
              onClick={() => onHandle(n._id, 'accept')}
              disabled={responding === n._id}
            >
              {responding === n._id ? '…' : 'Accept'}
            </button>
            <button
              className="notif-decline"
              onClick={() => onHandle(n._id, 'decline')}
              disabled={responding === n._id}
            >
              Decline
            </button>
          </div>
        )}
        {!isPending && (
          <span className={`notif-status ${n.status}`}>
            {n.status === 'accepted' ? '✓ Accepted' : '✕ Declined'}
          </span>
        )}
      </div>
    </div>
  );
}
