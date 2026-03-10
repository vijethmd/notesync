import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notesAPI } from '../api';
import './Dashboard.css';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    notesAPI.getAll()
      .then(res => setNotes(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const createNote = async () => {
    try {
      const res = await notesAPI.create({ title: '', content: '' });
      navigate(`/note/${res.data._id}`);
    } catch (err) { console.error(err); }
  };

  const deleteNote = async (e, id) => {
    e.stopPropagation();
    setDeleting(id);
    try {
      await notesAPI.delete(id);
      setNotes(notes.filter(n => n._id !== id));
    } catch (err) { console.error(err); }
    finally { setDeleting(null); }
  };

  const filtered = notes.filter(n =>
    n.title.toLowerCase().includes(search.toLowerCase()) ||
    n.content.toLowerCase().includes(search.toLowerCase())
  );
  const myNotes = filtered.filter(n => n.owner._id === user._id);
  const sharedNotes = filtered.filter(n => n.owner._id !== user._id);

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-logo">
          <span className="dash-logo-icon">✦</span>
          NoteSync
        </div>

        <div className="dash-search">
          <span className="search-icon">⌕</span>
          <input
            placeholder="Search notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="dash-user">
          <div className="user-avatar" style={{ background: user.color }}>
            {user.username[0].toUpperCase()}
          </div>
          <span className="user-name">{user.username}</span>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="dash-main">
        <div className="dash-top">
          <div className="dash-heading">
            <h1 className="dash-title">Your Notes</h1>
            <p className="dash-count">
              {notes.length} {notes.length === 1 ? 'note' : 'notes'}
            </p>
          </div>
          <button className="new-note-btn" onClick={createNote}>
            <span className="btn-plus">+</span> New Note
          </button>
        </div>

        {loading ? (
          <div className="dash-loading">
            {[1,2,3,4].map(i => <div key={i} className="note-skeleton" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <span className="empty-icon">✦</span>
            <p>{search ? 'No notes match your search.' : 'Your canvas is empty.\nCreate your first note.'}</p>
            {!search && <button className="new-note-btn" onClick={createNote}>Begin writing</button>}
          </div>
        ) : (
          <>
            {myNotes.length > 0 && (
              <section className="notes-section">
                <h2 className="section-label">My Notes</h2>
                <div className="notes-grid">
                  {myNotes.map(note => (
                    <NoteCard
                      key={note._id}
                      note={note}
                      userId={user._id}
                      onOpen={() => navigate(`/note/${note._id}`)}
                      onDelete={e => deleteNote(e, note._id)}
                      isDeleting={deleting === note._id}
                    />
                  ))}
                </div>
              </section>
            )}
            {sharedNotes.length > 0 && (
              <section className="notes-section">
                <h2 className="section-label">Shared with me</h2>
                <div className="notes-grid">
                  {sharedNotes.map(note => (
                    <NoteCard
                      key={note._id}
                      note={note}
                      userId={user._id}
                      onOpen={() => navigate(`/note/${note._id}`)}
                      isShared
                    />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function NoteCard({ note, onOpen, onDelete, isDeleting, isShared }) {
  const preview = note.content.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 130);
  const date = new Date(note.updatedAt).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric'
  });

  return (
    <div className="note-card" onClick={onOpen}>
      <div className="note-card-top">
        <h3 className="note-card-title">{note.title || 'Untitled'}</h3>
        {!isShared && onDelete && (
          <button className="delete-btn" onClick={onDelete} disabled={isDeleting} title="Delete">
            {isDeleting ? '…' : '×'}
          </button>
        )}
      </div>
      <p className="note-card-preview">{preview || 'Empty note…'}</p>
      <div className="note-card-footer">
        <span className="note-date">{date}</span>
        {isShared ? (
          <div className="note-owner" style={{ background: note.owner.color }} title={note.owner.username}>
            {note.owner.username[0].toUpperCase()}
          </div>
        ) : note.collaborators?.length > 0 && (
          <div className="collab-avatars">
            {note.collaborators.slice(0, 3).map(c => (
              <div key={c._id} className="collab-avatar" style={{ background: c.user?.color }} title={c.user?.username}>
                {c.user?.username?.[0]?.toUpperCase()}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
