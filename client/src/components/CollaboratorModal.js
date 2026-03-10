import { useState } from 'react';
import { notesAPI } from '../api';
import './CollaboratorModal.css';

export default function CollaboratorModal({ note, onClose, onUpdate }) {
  const [email, setEmail] = useState('');
  const [permission, setPermission] = useState('write');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const res = await notesAPI.addCollaborator(note._id, { email, permission });
      onUpdate(res.data);
      setSuccess(`Collaborator added!`);
      setEmail('');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to add collaborator');
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId) => {
    try {
      await notesAPI.removeCollaborator(note._id, userId);
      onUpdate({
        ...note,
        collaborators: note.collaborators.filter((c) => c.user._id !== userId),
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to remove');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Manage Access</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form className="modal-form" onSubmit={handleAdd}>
          <div className="modal-field-row">
            <input
              type="email"
              placeholder="Invite by email..."
              value={email}
              onChange={(e) => { setEmail(e.target.value); setError(''); setSuccess(''); }}
              required
            />
            <select value={permission} onChange={(e) => setPermission(e.target.value)}>
              <option value="write">Can edit</option>
              <option value="read">Can read</option>
            </select>
            <button type="submit" disabled={loading}>
              {loading ? '...' : 'Invite'}
            </button>
          </div>
        </form>

        {error && <div className="modal-error">{error}</div>}
        {success && <div className="modal-success">{success}</div>}

        <div className="modal-section">
          <div className="modal-section-label">Owner</div>
          <div className="collab-item">
            <div className="collab-avatar-big" style={{ background: note.owner.color }}>
              {note.owner.username[0].toUpperCase()}
            </div>
            <div className="collab-info">
              <span className="collab-name">{note.owner.username}</span>
              <span className="collab-email">{note.owner.email}</span>
            </div>
            <span className="perm-badge owner">Owner</span>
          </div>
        </div>

        {note.collaborators?.length > 0 && (
          <div className="modal-section">
            <div className="modal-section-label">Collaborators ({note.collaborators.length})</div>
            {note.collaborators.map((c) => (
              <div key={c._id} className="collab-item">
                <div className="collab-avatar-big" style={{ background: c.user?.color }}>
                  {c.user?.username?.[0]?.toUpperCase()}
                </div>
                <div className="collab-info">
                  <span className="collab-name">{c.user?.username}</span>
                  <span className="collab-email">{c.user?.email}</span>
                </div>
                <span className={`perm-badge ${c.permission}`}>
                  {c.permission === 'write' ? 'Can edit' : 'Can read'}
                </span>
                <button
                  className="remove-collab-btn"
                  onClick={() => handleRemove(c.user._id)}
                  title="Remove"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
