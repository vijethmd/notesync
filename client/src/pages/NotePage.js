import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { notesAPI, imagesAPI } from '../api';
import CollaboratorModal from '../components/CollaboratorModal';
import './NotePage.css';

export default function NotePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const token = localStorage.getItem('token');
  const { emit, on, connected } = useSocket(token);

  const [note, setNote] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [remoteCursors, setRemoteCursors] = useState({}); // socketId -> {username,color,x,y}
  const [typingUsers, setTypingUsers] = useState([]);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [initialContent, setInitialContent] = useState(null);
  const [resizing, setResizing] = useState(null); // {img, startX, startW}

  const editorRef = useRef(null);
  const saveTimer = useRef(null);
  const typingTimer = useRef(null);
  const isTypingRef = useRef(false);
  const isRemoteUpdate = useRef(false);
  const loadedRef = useRef(false);
  const fileInputRef = useRef(null);

  // ── Apply initial content once editor renders ──
  useEffect(() => {
    if (initialContent === null) return;
    if (editorRef.current) editorRef.current.innerHTML = initialContent;
  }, [initialContent]);

  // ── Socket lifecycle ──
  useEffect(() => {
    if (!connected) return;

    emit('join-note', id);

    const removeJoined = on('note-joined', ({ note: n, activeUsers: users }) => {
      setNote(n); setTitle(n.title);
      setInitialContent(n.content || '');
      setActiveUsers(users);
      loadedRef.current = true;
      setLoading(false);
    });

    const removeUpdated = on('content-updated', ({ content, title: t }) => {
      isRemoteUpdate.current = true;
      if (content !== undefined && editorRef.current) {
        const clean = content.replace(/<button[^>]*class="image-delete-btn"[^>]*>.*?<\/button>/gi, '');
        const scrollTop = editorRef.current.scrollTop;
        editorRef.current.innerHTML = clean;
        editorRef.current.scrollTop = scrollTop;
        attachImageHandlers();
      }
      if (t !== undefined) setTitle(t);
      isRemoteUpdate.current = false;
    });

    const removeActiveUsers = on('active-users', (users) => setActiveUsers(users));
    const removeUserJoined = on('user-joined', () => {});
    const removeUserLeft = on('user-left', ({ socketId }) => {
      setRemoteCursors(prev => { const n = { ...prev }; delete n[socketId]; return n; });
    });
    const removeTyping = on('user-typing', ({ username, color, isTyping }) => {
      setTypingUsers(prev => isTyping
        ? prev.includes(username) ? prev : [...prev, username]
        : prev.filter(u => u !== username)
      );
    });

    // ── Remote cursors ──
    const removeCursor = on('cursor-updated', ({ socketId, username, color, position }) => {
      if (!editorRef.current) return;
      setRemoteCursors(prev => ({ ...prev, [socketId]: { username, color, ...position } }));
    });

    const removeError = on('error', msg => { setError(msg); setLoading(false); });

    // HTTP fallback
    const fallback = setTimeout(async () => {
      if (!loadedRef.current) {
        try {
          const res = await notesAPI.getOne(id);
          setNote(res.data); setTitle(res.data.title);
          setInitialContent(res.data.content || '');
        } catch { setError('Failed to load note'); }
        finally { setLoading(false); }
      }
    }, 3000);

    return () => {
      clearTimeout(fallback);
      emit('leave-note', id);
      [removeJoined, removeUpdated, removeActiveUsers, removeUserJoined,
       removeUserLeft, removeTyping, removeCursor, removeError].forEach(fn => fn?.());
    };
  }, [id, connected]);

  // ── Save + emit changes ──
  const emitChange = useCallback((content, t) => {
    if (isRemoteUpdate.current) return;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setSaving(true);
      emit('content-change', { noteId: id, content, title: t });
      setTimeout(() => setSaving(false), 600);
    }, 400);
  }, [id, emit]);

  // ── Typing indicator ──
  const handleTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emit('typing', { noteId: id, isTyping: true });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      emit('typing', { noteId: id, isTyping: false });
    }, 1500);
  }, [id, emit]);

  // ── Mouse move → broadcast cursor position ──
  const handleMouseMove = useCallback((e) => {
    if (!editorRef.current) return;
    const rect = editorRef.current.getBoundingClientRect();
    const position = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    emit('cursor-move', { noteId: id, position });
  }, [id, emit]);

  const handleInput = useCallback(() => {
    if (isRemoteUpdate.current || !editorRef.current) return;
    handleTyping();
    const content = editorRef.current.innerHTML;
    const t = title;
    emitChange(content, t);
  }, [emitChange, handleTyping, title]);

  const handleTitleChange = useCallback((e) => {
    const t = e.target.value;
    setTitle(t);
    const content = editorRef.current?.innerHTML || '';
    emitChange(content, t);
  }, [emitChange]);

  // ── Image handlers (delete button + resize handles) ──
  const attachImageHandlers = useCallback(() => {
    if (!editorRef.current) return;
    editorRef.current.querySelectorAll('.note-image-wrapper').forEach(wrapper => {
      if (wrapper.dataset.handled) return;
      wrapper.dataset.handled = 'true';

      const img = wrapper.querySelector('img');
      if (!img) return;

      // Delete button
      let deleteBtn = wrapper.querySelector('.image-delete-btn');
      if (!deleteBtn) {
        deleteBtn = document.createElement('button');
        deleteBtn.className = 'image-delete-btn';
        deleteBtn.innerHTML = '×';
        deleteBtn.contentEditable = 'false';
        wrapper.appendChild(deleteBtn);
      }
      deleteBtn.onclick = () => {
        wrapper.remove();
        emitChange(editorRef.current.innerHTML, title);
      };

      // Resize handle
      let handle = wrapper.querySelector('.resize-handle');
      if (!handle) {
        handle = document.createElement('div');
        handle.className = 'resize-handle';
        handle.contentEditable = 'false';
        handle.innerHTML = '↔';
        wrapper.appendChild(handle);
      }

      handle.onmousedown = (e) => {
        e.preventDefault();
        const startX = e.clientX;
        const startW = img.offsetWidth;
        const minW = 80;
        const maxW = editorRef.current.offsetWidth - 32;

        const onMove = (me) => {
          const newW = Math.min(maxW, Math.max(minW, startW + (me.clientX - startX)));
          img.style.width = newW + 'px';
          img.style.maxWidth = '100%';
        };
        const onUp = () => {
          document.removeEventListener('mousemove', onMove);
          document.removeEventListener('mouseup', onUp);
          emitChange(editorRef.current.innerHTML, title);
        };
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
      };

      // Touch resize
      handle.ontouchstart = (e) => {
        e.preventDefault();
        const startX = e.touches[0].clientX;
        const startW = img.offsetWidth;
        const minW = 80;
        const maxW = editorRef.current.offsetWidth - 32;
        const onMove = (te) => {
          const newW = Math.min(maxW, Math.max(minW, startW + (te.touches[0].clientX - startX)));
          img.style.width = newW + 'px';
        };
        const onEnd = () => {
          document.removeEventListener('touchmove', onMove);
          document.removeEventListener('touchend', onEnd);
          emitChange(editorRef.current.innerHTML, title);
        };
        document.addEventListener('touchmove', onMove, { passive: false });
        document.addEventListener('touchend', onEnd);
      };
    });
  }, [emitChange, title]);

  // Re-attach image handlers when content loads
  useEffect(() => {
    if (initialContent !== null) setTimeout(attachImageHandlers, 100);
  }, [initialContent]);

  // ── Upload image helper ──
  const uploadAndInsert = useCallback(async (file) => {
    if (!file?.type.startsWith('image/')) return;
    try {
      const res = await imagesAPI.upload(file);
      const url = res.data.url;
      const wrapper = document.createElement('div');
      wrapper.className = 'note-image-wrapper';
      wrapper.contentEditable = 'false';
      const img = document.createElement('img');
      img.src = url; img.alt = 'image'; img.style.width = '320px'; img.style.maxWidth = '100%';
      const caption = document.createElement('div');
      caption.className = 'image-caption'; caption.contentEditable = 'true';
      caption.setAttribute('placeholder', 'Add a caption…');
      wrapper.appendChild(img); wrapper.appendChild(caption);
      const sel = window.getSelection();
      if (sel?.rangeCount) {
        const range = sel.getRangeAt(0);
        range.collapse(false); range.insertNode(wrapper);
        range.setStartAfter(wrapper); range.collapse(true);
        sel.removeAllRanges(); sel.addRange(range);
      } else { editorRef.current?.appendChild(wrapper); }
      attachImageHandlers();
      emitChange(editorRef.current.innerHTML, title);
    } catch (err) { console.error('Image upload failed', err); }
  }, [attachImageHandlers, emitChange, title]);

  // ── Paste handler ──
  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        await uploadAndInsert(item.getAsFile());
        return;
      }
    }
  }, [uploadAndInsert]);

  // ── Drag & drop ──
  const handleDrop = useCallback(async (e) => {
    e.preventDefault(); setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) await uploadAndInsert(file);
  }, [uploadAndInsert]);

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'I') {
        e.preventDefault(); fileInputRef.current?.click();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const wordCount = (editorRef.current?.innerText || '').split(/\s+/).filter(Boolean).length;

  if (loading) return (
    <div className="note-loading-screen">
      <div className="note-loading-logo"><span style={{color:'#d4a853'}}>✦</span> NoteSync</div>
      <div className="note-loading-bar"><div className="note-loading-fill" /></div>
    </div>
  );

  if (error) return (
    <div className="note-error-screen">
      <p>{error}</p>
      <button onClick={() => navigate('/')}>← Back to notes</button>
    </div>
  );

  const isOwner = note?.owner?._id === user._id || note?.owner === user._id;

  return (
    <div className="note-page">
      {/* Header */}
      <header className="note-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Notes</button>
        <div className="note-header-center">
          {typingUsers.length > 0 && (
            <span className="typing-indicator">
              {typingUsers.slice(0,2).join(', ')} {typingUsers.length === 1 ? 'is' : 'are'} typing…
            </span>
          )}
        </div>
        <div className="note-header-right">
          {saving && <span className="saving-dot">saving…</span>}
          <div className="active-users-row">
            {activeUsers.filter(u => u.userId !== user._id).slice(0, 4).map(u => (
              <div key={u.socketId} className="active-avatar" style={{ background: u.color }} title={u.username}>
                {u.username[0].toUpperCase()}
              </div>
            ))}
          </div>
          <button className="toolbar-btn" onClick={() => fileInputRef.current?.click()} title="Insert image (⌘⇧I)">⌃ Image</button>
          {isOwner && (
            <button className="share-btn" onClick={() => setShowCollabModal(true)}>Share</button>
          )}
        </div>
      </header>

      {/* Editor area */}
      <div className="note-body">
        <div className="note-editor-wrap">
          <input
            className="note-title-input"
            value={title}
            onChange={handleTitleChange}
            placeholder="Untitled Note"
          />
          <div className="note-meta-bar">
            <span>{wordCount} words</span>
            <span>{editorRef.current?.innerText?.length || 0} chars</span>
            {note?.lastEditedBy && <span>Last edited by {note.lastEditedBy.username}</span>}
          </div>

          {/* Cursor container — absolute overlay over editor */}
          <div className="cursor-overlay">
            {Object.entries(remoteCursors).map(([sid, c]) => (
              <div
                key={sid}
                className="remote-cursor"
                style={{ left: c.x, top: c.y, '--cursor-color': c.color }}
              >
                <div className="cursor-caret" />
                <div className="cursor-label">{c.username}</div>
              </div>
            ))}
          </div>

          <div
            ref={editorRef}
            className={`note-editor ${dragOver ? 'drag-over' : ''}`}
            contentEditable
            suppressContentEditableWarning
            onInput={handleInput}
            onPaste={handlePaste}
            onMouseMove={handleMouseMove}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            data-placeholder="Start writing…"
            spellCheck
          />
        </div>
      </div>

      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { if (e.target.files?.[0]) { uploadAndInsert(e.target.files[0]); e.target.value = ''; } }} />

      {showCollabModal && note && (
        <CollaboratorModal
          note={note}
          onClose={() => setShowCollabModal(false)}
          onUpdate={setNote}
        />
      )}
    </div>
  );
}
