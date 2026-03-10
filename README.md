# ✦ NoteSync — Real-Time Collaborative Notes

A full-stack real-time collaborative notes app built with React, Express, Node.js, MongoDB, and Socket.io.

---

## 🚀 Features

- **Authentication** — Register/login with JWT tokens, bcrypt password hashing
- **Real-Time Sync** — Socket.io syncs note content live across all collaborators
- **Typing Indicators** — See who is currently typing in the note
- **Active User Presence** — Avatars show who is viewing the note right now
- **Invite Collaborators** — Add users by email with read/write permissions
- **Auto-Save** — Notes are saved to MongoDB on every keystroke (debounced)
- **Dashboard** — Browse your notes and shared notes, search by title/content
- **Word Count & Stats** — Live word and character count in the editor footer

---

## 🗂️ Project Structure

```
collab-notes/
├── server/                  # Express + Node backend
│   ├── models/
│   │   ├── User.js          # Mongoose user schema
│   │   └── Note.js          # Mongoose note schema
│   ├── routes/
│   │   ├── auth.js          # Register, login, /me
│   │   └── notes.js         # CRUD + collaborator routes
│   ├── middleware/
│   │   └── auth.js          # JWT auth middleware
│   ├── socketHandler.js     # All Socket.io logic
│   ├── index.js             # Server entry point
│   ├── .env.example         # Environment variable template
│   └── package.json
│
└── client/                  # React frontend
    ├── src/
    │   ├── api.js            # Axios instance + API helpers
    │   ├── App.js            # Router + protected routes
    │   ├── context/
    │   │   └── AuthContext.js  # Auth state, login/register/logout
    │   ├── hooks/
    │   │   └── useSocket.js    # Socket.io hook (connect, emit, on/off)
    │   ├── pages/
    │   │   ├── AuthPage.js     # Login + Register UI
    │   │   ├── Dashboard.js    # Notes grid, search
    │   │   └── NotePage.js     # Collaborative editor
    │   └── components/
    │       └── CollaboratorModal.js  # Invite / manage collaborators
    └── package.json
```

---

## ⚙️ Setup & Installation

### Prerequisites
- Node.js v18+
- MongoDB (local or MongoDB Atlas)

### 1. Clone and install

```bash
# Install server dependencies
cd server
npm install

# Install client dependencies
cd ../client
npm install
```

### 2. Configure environment

```bash
cd server
cp .env.example .env
```

Edit `.env`:
```
PORT=5000
MONGODB_URI=mongodb://localhost:27017/collab-notes
JWT_SECRET=your_super_secret_key_here
CLIENT_URL=http://localhost:3000
```

### 3. Run the app

**Terminal 1 — Start the server:**
```bash
cd server
npm run dev     # with nodemon (auto-restart)
# OR
npm start       # without nodemon
```

**Terminal 2 — Start the React client:**
```bash
cd client
npm start
```

Open **http://localhost:3000** in your browser.

---

## 🔌 API Endpoints

### Auth
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Get current user |

### Notes
| Method | Route | Description |
|--------|-------|-------------|
| GET | `/api/notes` | Get all user notes |
| GET | `/api/notes/:id` | Get single note |
| POST | `/api/notes` | Create note |
| PUT | `/api/notes/:id` | Update note |
| DELETE | `/api/notes/:id` | Delete note |
| POST | `/api/notes/:id/collaborators` | Add collaborator |
| DELETE | `/api/notes/:id/collaborators/:userId` | Remove collaborator |

---

## ⚡ Socket.io Events

### Client → Server
| Event | Payload | Description |
|-------|---------|-------------|
| `join-note` | `noteId` | Join a note room |
| `leave-note` | `noteId` | Leave a note room |
| `content-change` | `{ noteId, content?, title? }` | Broadcast text changes |
| `cursor-move` | `{ noteId, position }` | Broadcast cursor position |
| `typing` | `{ noteId, isTyping }` | Show/hide typing indicator |

### Server → Client
| Event | Payload | Description |
|-------|---------|-------------|
| `note-joined` | `{ note, activeUsers }` | Initial note data on join |
| `content-updated` | `{ content, title, editedBy }` | Someone changed content |
| `active-users` | `Array` | Updated list of online users |
| `user-joined` | `{ username, color }` | User joined the room |
| `user-left` | `{ socketId, username }` | User left the room |
| `user-typing` | `{ username, color, isTyping }` | Typing indicator update |
| `cursor-updated` | `{ userId, position, color }` | Cursor position update |
| `error` | `string` | Error message |

---

## 🧠 Key React Concepts Used

- **useState** — note content, title, active users, typing users, modals, loading states
- **useEffect** — socket setup/teardown, joining note rooms, listening for events, fallback HTTP fetch
- **useCallback** — stable references for socket event emitters
- **useRef** — debounce timers, typing timers, current content (avoids stale closures)
- **Custom hooks** — `useSocket` abstracts all Socket.io lifecycle management
- **Context** — `AuthContext` provides user state and auth actions globally

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v6 |
| Realtime | Socket.io client |
| HTTP | Axios |
| Backend | Express.js, Node.js |
| WebSocket | Socket.io |
| Database | MongoDB + Mongoose |
| Auth | JWT + bcryptjs |
| Styling | Custom CSS with Google Fonts |
