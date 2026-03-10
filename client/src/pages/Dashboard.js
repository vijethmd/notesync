import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { notesAPI, foldersAPI, notificationsAPI } from '../api';
import './Dashboard.css';

const FOLDER_ICONS = ['📁','📝','💡','🎨','📚','🔬','💼','🏠','⭐','🎯'];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notes, setNotes] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [activeFolder, setActiveFolder] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [showMoveModal, setShowMoveModal] = useState(null);
  const [newFolder, setNewFolder] = useState({ name: '', icon: '📁' });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    Promise.all([notesAPI.getAll(), foldersAPI.getAll(), notificationsAPI.getUnreadCount()])
      .then(([nRes, fRes, cRes]) => { setNotes(nRes.data); setFolders(fRes.data); setUnreadCount(cRes.data.count); })
      .catch(console.error).finally(() => setLoading(false));
  }, []);

  const createNote = async () => {
    try {
      const res = await notesAPI.create({ title: '', content: '', folder: activeFolder && activeFolder !== '__root__' ? activeFolder : null });
      navigate(`/note/${res.data._id}`);
    } catch (err) { console.error(err); }
  };

  const deleteNote = async (e, id) => {
    e.stopPropagation(); setDeleting(id);
    try { await notesAPI.delete(id); setNotes(notes.filter(n => n._id !== id)); }
    catch (err) { console.error(err); } finally { setDeleting(null); }
  };

  const createFolder = async (e) => {
    e.preventDefault();
    try {
      const res = await foldersAPI.create(newFolder);
      setFolders([res.data, ...folders]);
      setNewFolder({ name: '', icon: '📁' });
      setShowFolderModal(false);
    } catch (err) { console.error(err); }
  };

  const deleteFolder = async (e, id) => {
    e.stopPropagation();
    try {
      await foldersAPI.delete(id);
      setFolders(folders.filter(f => f._id !== id));
      setNotes(notes.map(n => n.folder?._id === id ? { ...n, folder: null } : n));
      if (activeFolder === id) setActiveFolder(null);
    } catch (err) { console.error(err); }
  };

  const moveNote = async (noteId, folderId) => {
    try {
      await foldersAPI.moveNote(noteId, folderId);
      setNotes(notes.map(n => n._id === noteId ? { ...n, folder: folderId ? folders.find(f => f._id === folderId) : null } : n));
      setShowMoveModal(null);
    } catch (err) { console.error(err); }
  };

  const filteredNotes = notes.filter(n => {
    const matchSearch = !search || n.title.toLowerCase().includes(search.toLowerCase()) || n.content.replace(/<[^>]*>/g, '').toLowerCase().includes(search.toLowerCase());
    const matchFolder = activeFolder === null ? true : activeFolder === '__root__' ? !n.folder : n.folder?._id === activeFolder;
    return matchSearch && matchFolder;
  });
  const myNotes = filteredNotes.filter(n => n.owner._id === user._id);
  const sharedNotes = filteredNotes.filter(n => n.owner._id !== user._id);

  return (
    <div className="dashboard">
      <header className="dash-header">
        <div className="dash-logo"><span className="dash-logo-icon">✦</span><span>NoteSync</span></div>
        <div className="dash-search">
          <span className="search-icon">⌕</span>
          <input placeholder="Search notes…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="dash-user">
          <button className="notif-bell" onClick={() => navigate('/notifications')}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
          </button>
          <div className="user-avatar" style={{ background: user.color }}>{user.username[0].toUpperCase()}</div>
          <span className="user-name">{user.username}</span>
          <button className="logout-btn" onClick={logout}>Sign out</button>
        </div>
        <button className="mobile-menu-btn" onClick={() => setMenuOpen(!menuOpen)}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
        </button>
      </header>

      {menuOpen && (
        <div className="mobile-menu">
          <button onClick={() => { navigate('/notifications'); setMenuOpen(false); }}>🔔 Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}</button>
          <button onClick={() => { logout(); setMenuOpen(false); }}>Sign out</button>
        </div>
      )}

      <div className="dash-body">
        <aside className="dash-sidebar">
          <div className="sidebar-section">
            <button className={`sidebar-item ${activeFolder === null ? 'active' : ''}`} onClick={() => setActiveFolder(null)}>
              <span>📋</span> All Notes <span className="sidebar-count">{notes.filter(n=>n.owner._id===user._id).length}</span>
            </button>
            <button className={`sidebar-item ${activeFolder === '__root__' ? 'active' : ''}`} onClick={() => setActiveFolder('__root__')}>
              <span>📄</span> Unfiled <span className="sidebar-count">{notes.filter(n=>n.owner._id===user._id&&!n.folder).length}</span>
            </button>
          </div>
          {folders.length > 0 && (
            <div className="sidebar-section">
              <div className="sidebar-label">Folders</div>
              {folders.map(f => (
                <div key={f._id} className="sidebar-folder-row">
                  <button className={`sidebar-item ${activeFolder === f._id ? 'active' : ''}`} onClick={() => setActiveFolder(f._id)}>
                    <span>{f.icon}</span>
                    <span className="sidebar-folder-name">{f.name}</span>
                    <span className="sidebar-count">{notes.filter(n=>n.folder?._id===f._id).length}</span>
                  </button>
                  <button className="folder-delete-btn" onClick={e => deleteFolder(e, f._id)}>×</button>
                </div>
              ))}
            </div>
          )}
          <button className="new-folder-btn" onClick={() => setShowFolderModal(true)}>+ New Folder</button>
        </aside>

        <main className="dash-main">
          <div className="dash-top">
            <div className="dash-heading">
              <h1 className="dash-title">{activeFolder === null ? 'All Notes' : activeFolder === '__root__' ? 'Unfiled' : folders.find(f=>f._id===activeFolder)?.name || 'Notes'}</h1>
              <p className="dash-count">{filteredNotes.length} {filteredNotes.length===1?'note':'notes'}</p>
            </div>
            <button className="new-note-btn" onClick={createNote}><span className="btn-plus">+</span> New Note</button>
          </div>

          {loading ? (
            <div className="dash-loading">{[1,2,3,4].map(i=><div key={i} className="note-skeleton"/>)}</div>
          ) : filteredNotes.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">✦</span>
              <p>{search ? 'No notes match your search.' : 'No notes here yet.'}</p>
              {!search && <button className="new-note-btn" onClick={createNote}>Begin writing</button>}
            </div>
          ) : (
            <>
              {myNotes.length > 0 && (
                <section className="notes-section">
                  {sharedNotes.length > 0 && <h2 className="section-label">My Notes</h2>}
                  <div className="notes-grid">
                    {myNotes.map(note => (
                      <NoteCard key={note._id} note={note} userId={user._id}
                        onOpen={() => navigate(`/note/${note._id}`)}
                        onDelete={e => deleteNote(e, note._id)}
                        onMove={() => setShowMoveModal(note._id)}
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
                      <NoteCard key={note._id} note={note} userId={user._id}
                        onOpen={() => navigate(`/note/${note._id}`)} isShared />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </main>
      </div>

      {showFolderModal && (
        <div className="modal-overlay" onClick={() => setShowFolderModal(false)}>
          <div className="modal-card small-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>New Folder</h2>
              <button className="modal-close" onClick={() => setShowFolderModal(false)}>×</button>
            </div>
            <form onSubmit={createFolder} className="folder-form">
              <div className="auth-field">
                <label>Folder Name</label>
                <input type="text" placeholder="e.g. Work, Personal…" value={newFolder.name} onChange={e=>setNewFolder({...newFolder,name:e.target.value})} required autoFocus />
              </div>
              <div className="auth-field">
                <label>Icon</label>
                <div className="icon-grid">
                  {FOLDER_ICONS.map(icon=>(
                    <button key={icon} type="button" className={`icon-btn${newFolder.icon===icon?' selected':''}`} onClick={()=>setNewFolder({...newFolder,icon})}>{icon}</button>
                  ))}
                </div>
              </div>
              <button className="auth-submit" type="submit" disabled={!newFolder.name}>Create Folder</button>
            </form>
          </div>
        </div>
      )}

      {showMoveModal && (
        <div className="modal-overlay" onClick={() => setShowMoveModal(null)}>
          <div className="modal-card small-modal" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <h2>Move Note</h2>
              <button className="modal-close" onClick={() => setShowMoveModal(null)}>×</button>
            </div>
            <div className="move-list">
              <button className="move-item" onClick={() => moveNote(showMoveModal, null)}><span>📄</span> No folder</button>
              {folders.map(f=>(
                <button key={f._id} className="move-item" onClick={()=>moveNote(showMoveModal,f._id)}><span>{f.icon}</span> {f.name}</button>
              ))}
              {folders.length === 0 && <p className="no-folders-msg">Create a folder first.</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function NoteCard({ note, onOpen, onDelete, onMove, isDeleting, isShared }) {
  const preview = note.content.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,130);
  const date = new Date(note.updatedAt).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
  return (
    <div className="note-card" onClick={onOpen}>
      {note.folder && <div className="note-folder-tag">{note.folder.icon} {note.folder.name}</div>}
      <div className="note-card-top">
        <h3 className="note-card-title">{note.title||'Untitled'}</h3>
        {!isShared && (
          <div className="note-card-actions" onClick={e=>e.stopPropagation()}>
            {onMove && <button className="card-action-btn" onClick={onMove} title="Move">⤴</button>}
            {onDelete && <button className="delete-btn" onClick={onDelete} disabled={isDeleting}>{isDeleting?'…':'×'}</button>}
          </div>
        )}
      </div>
      <p className="note-card-preview">{preview||'Empty note…'}</p>
      <div className="note-card-footer">
        <span className="note-date">{date}</span>
        {isShared ? (
          <div className="note-owner" style={{background:note.owner.color}} title={note.owner.username}>{note.owner.username[0].toUpperCase()}</div>
        ) : note.collaborators?.length > 0 && (
          <div className="collab-avatars">
            {note.collaborators.slice(0,3).map(c=>(
              <div key={c._id} className="collab-avatar" style={{background:c.user?.color}} title={c.user?.username}>{c.user?.username?.[0]?.toUpperCase()}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
