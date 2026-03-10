import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../hooks/useSocket';
import { notesAPI, imagesAPI } from '../api';
import CollaboratorModal from '../components/CollaboratorModal';
import './NotePage.css';

export default function NotePage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const token = localStorage.getItem('token');
  const { emit, on, connected } = useSocket(token);

  const [note, setNote] = useState(null);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [error, setError] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [initialContent, setInitialContent] = useState(null); // set once, applied after render

  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const saveTimer = useRef(null);
  const typingTimer = useRef(null);
  const isTypingRef = useRef(false);
  const isRemoteUpdate = useRef(false);
  const activeDeleteBtn = useRef(null); // track current delete button

  // ── Remove any active delete button ──
  const clearDeleteBtn = useCallback(() => {
    if (activeDeleteBtn.current) {
      activeDeleteBtn.current.remove();
      activeDeleteBtn.current = null;
    }
  }, []);

  // ── Show delete button on image wrapper click ──
  const handleEditorClick = useCallback((e) => {
    const wrapper = e.target.closest('.note-image-wrapper');

    // Clicked outside any image → clear button
    if (!wrapper) {
      clearDeleteBtn();
      return;
    }

    // Clicked on the delete button itself → delete the image
    if (e.target.closest('.image-delete-btn')) return;

    // Already showing delete btn for this wrapper → skip
    if (wrapper.querySelector('.image-delete-btn')) return;

    // Clear any previous btn
    clearDeleteBtn();

    const btn = document.createElement('button');
    btn.className = 'image-delete-btn';
    btn.innerHTML = '×';
    btn.title = 'Remove image';
    btn.addEventListener('click', (ev) => {
      ev.stopPropagation();
      wrapper.remove();
      activeDeleteBtn.current = null;
      emitChange();
    });

    wrapper.appendChild(btn);
    activeDeleteBtn.current = btn;
  }, [clearDeleteBtn]); // emitChange added below via ref trick

  // ── Emit content change ──
  const emitChange = useCallback(() => {
    if (isRemoteUpdate.current) return;
    const html = editorRef.current?.innerHTML || '';
    emit('content-change', { noteId: id, content: html });

    if (!isTypingRef.current) {
      isTypingRef.current = true;
      emit('typing', { noteId: id, isTyping: true });
    }
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      isTypingRef.current = false;
      emit('typing', { noteId: id, isTyping: false });
    }, 1500);

    setSaving(true);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => setSaving(false), 1000);
  }, [emit, id]);

  // ── Socket: join note ──
  useEffect(() => {
    if (!connected || !id) return;
    emit('join-note', id);
    return () => emit('leave-note', id);
  }, [connected, id, emit]);

  // ── Socket: event listeners ──
  useEffect(() => {
    const removeNoteJoined = on('note-joined', ({ note: n, activeUsers: users }) => {
      setNote(n);
      setTitle(n.title);
      setInitialContent(n.content || '');
      setActiveUsers(users);
      setLoading(false);
    });

    const removeContentUpdated = on('content-updated', ({ content: c, title: t }) => {
      if (c !== undefined && editorRef.current) {
        // Save scroll position
        const scrollY = window.scrollY;
        isRemoteUpdate.current = true;
        // Strip any delete buttons from incoming HTML before rendering
        const clean = c.replace(/<button class="image-delete-btn"[^>]*>.*?<\/button>/gi, '');
        editorRef.current.innerHTML = clean;
        isRemoteUpdate.current = false;
        window.scrollTo(0, scrollY);
      }
      if (t !== undefined) setTitle(t);
    });

    const removeActiveUsers = on('active-users', setActiveUsers);
    const removeUserLeft = on('user-left', ({ username }) =>
      setTypingUsers(prev => prev.filter(u => u.username !== username))
    );
    const removeUserTyping = on('user-typing', ({ username, color, isTyping }) => {
      if (username === user.username) return;
      setTypingUsers(prev => isTyping
        ? prev.find(u => u.username === username) ? prev : [...prev, { username, color }]
        : prev.filter(u => u.username !== username)
      );
    });
    const removeError = on('error', msg => { setError(msg); setLoading(false); });

    return () => {
      removeNoteJoined(); removeContentUpdated(); removeActiveUsers();
      removeUserLeft(); removeUserTyping(); removeError();
    };
  }, [on, user.username]);

  // ── HTTP fallback ──
  useEffect(() => {
    const t = setTimeout(() => {
      if (loading) {
        notesAPI.getOne(id)
          .then(res => {
            setNote(res.data);
            setTitle(res.data.title);
            setInitialContent(res.data.content || '');
          })
          .catch(err => setError(err.response?.data?.message || 'Failed to load note'))
          .finally(() => setLoading(false));
      }
    }, 3000);
    return () => clearTimeout(t);
  }, [id, loading]);
  // ── Apply initial content once editor is rendered ──
  useEffect(() => {
    if (initialContent === null) return;
    if (editorRef.current) {
      editorRef.current.innerHTML = initialContent;
    }
  }, [initialContent]);


  // ── Insert image at cursor ──
  const insertImageAtCursor = useCallback((url) => {
    const editor = editorRef.current;
    if (!editor) return;
    editor.focus();

    const sel = window.getSelection();
    let range;
    if (sel && sel.rangeCount > 0) {
      range = sel.getRangeAt(0);
    } else {
      range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
    }

    const wrapper = document.createElement('div');
    wrapper.className = 'note-image-wrapper';
    wrapper.contentEditable = 'false';

    const img = document.createElement('img');
    img.src = url;
    img.className = 'note-inline-image';
    img.alt = '';

    // Caption — optional, hidden by default, shown on hover via CSS
    const caption = document.createElement('p');
    caption.className = 'note-image-caption';
    caption.contentEditable = 'true';
    caption.setAttribute('data-placeholder', 'Add a caption… (optional)');

    wrapper.appendChild(img);
    wrapper.appendChild(caption);

    range.deleteContents();
    range.insertNode(wrapper);

    // Move cursor after wrapper
    const after = document.createRange();
    after.setStartAfter(wrapper);
    after.collapse(true);
    sel.removeAllRanges();
    sel.addRange(after);

    // Ensure a paragraph after
    if (!wrapper.nextSibling || wrapper.nextSibling.nodeName !== 'P') {
      const p = document.createElement('p');
      p.innerHTML = '<br>';
      wrapper.insertAdjacentElement('afterend', p);
    }

    emitChange();
  }, [emitChange]);

  // ── Upload image file ──
  const uploadImage = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setUploadingImage(true);
    try {
      const res = await imagesAPI.upload(file);
      insertImageAtCursor(res.data.url);
    } catch (err) {
      console.error('Image upload failed', err);
    } finally {
      setUploadingImage(false);
    }
  }, [insertImageAtCursor]);

  const handleFileSelect = useCallback((e) => {
    const file = e.target.files?.[0];
    if (file) uploadImage(file);
    e.target.value = '';
  }, [uploadImage]);

  const handlePaste = useCallback(async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) await uploadImage(file);
        return;
      }
    }
    setTimeout(() => emitChange(), 0);
  }, [uploadImage, emitChange]);

  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) await uploadImage(file);
  }, [uploadImage]);

  const handleDragOver = useCallback((e) => { e.preventDefault(); setDragOver(true); }, []);
  const handleDragLeave = useCallback(() => setDragOver(false), []);

  const handleKeyDown = useCallback((e) => {
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'i') {
      e.preventDefault();
      fileInputRef.current?.click();
    }
    // Any key clears the delete button
    clearDeleteBtn();
  }, [clearDeleteBtn]);

  const handleEditorInput = useCallback(() => emitChange(), [emitChange]);

  const isOwner = note?.owner?._id === user._id || note?.owner === user._id;
  const getWordCount = () => (editorRef.current?.innerText || '').split(/\s+/).filter(Boolean).length;

  if (loading) return (
    <div className="note-loading">
      <div className="note-loading-inner">
        <div className="note-loading-spinner" />
        <span>Opening note…</span>
      </div>
    </div>
  );

  if (error) return (
    <div className="note-loading">
      <div className="note-error-box">
        <p>{error}</p>
        <button onClick={() => navigate('/')}>← Go back</button>
      </div>
    </div>
  );

  return (
    <div className="note-page">
      <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleFileSelect} />

      <header className="note-header">
        <button className="back-btn" onClick={() => navigate('/')}>← Back</button>
        <div className="note-header-center">
          <div className="note-logo"><span>✦</span> NoteSync</div>
          {uploadingImage && <span className="saving-badge">Uploading…</span>}
          {!uploadingImage && saving && <span className="saving-badge">Saving…</span>}
          {!uploadingImage && !saving && connected && <span className="saved-badge">✓ Saved</span>}
          {!connected && <span className="offline-badge">● Offline</span>}
        </div>
        <div className="note-header-right">
          <button className="image-insert-btn" onClick={() => fileInputRef.current?.click()} title="Insert image (⌘⇧I)" disabled={uploadingImage}>
            {uploadingImage ? <span className="img-btn-spinner" /> : (
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            )}
            <span>Image</span>
          </button>
          <div className="active-users">
            {activeUsers.filter(u => u.userId !== user._id.toString()).map(u => (
              <div key={u.socketId} className="active-avatar" style={{ background: u.color }} title={u.username}>
                {u.username[0].toUpperCase()}
              </div>
            ))}
          </div>
          {isOwner && <button className="collab-btn" onClick={() => setShowCollabModal(true)}>+ Invite</button>}
        </div>
      </header>

      {typingUsers.length > 0 && (
        <div className="typing-bar">
          {typingUsers.map(u => (
            <span key={u.username} className="typing-chip">
              <span className="typing-dot" style={{ background: u.color }} />
              {u.username} is writing…
            </span>
          ))}
        </div>
      )}

      <div className={`editor-wrap ${dragOver ? 'drag-over' : ''}`} onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}>
        <input className="note-title-input" value={title} onChange={e => { setTitle(e.target.value); emit('content-change', { noteId: id, title: e.target.value }); }} placeholder="Untitled" maxLength={200} />
        <div className="editor-divider" />

        {dragOver && (
          <div className="drag-overlay">
            <div className="drag-overlay-inner">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="2"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
              <span>Drop image to insert</span>
            </div>
          </div>
        )}

        <div
          ref={editorRef}
          className="note-content-editor"
          contentEditable
          suppressContentEditableWarning
          onInput={handleEditorInput}
          onPaste={handlePaste}
          onKeyDown={handleKeyDown}
          onClick={handleEditorClick}
          data-placeholder="Start writing… paste or drop images, or click Image above."
          spellCheck
        />

        <div className="editor-hint">
          <span>Tip: paste an image with <kbd>⌘V</kbd> · drag &amp; drop · or click <strong>Image</strong> above · click image to delete</span>
        </div>
      </div>

      <footer className="note-footer">
        <span>{getWordCount()} words</span>
        <span className="footer-sep">·</span>
        <span>{editorRef.current?.innerText?.length || 0} chars</span>
        {note?.collaborators?.length > 0 && (<><span className="footer-sep">·</span><span>{note.collaborators.length} collaborator{note.collaborators.length !== 1 ? 's' : ''}</span></>)}
        {note?.lastEditedBy && (<><span className="footer-sep">·</span><span>Last edit by {note.lastEditedBy.username}</span></>)}
      </footer>

      {showCollabModal && <CollaboratorModal note={note} onClose={() => setShowCollabModal(false)} onUpdate={setNote} />}
    </div>
  );
}
