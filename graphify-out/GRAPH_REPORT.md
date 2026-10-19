# Graph Report - node-eseme-finale  (2026-10-19)

## Corpus Check
- 72 files · ~16,962 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 4, .example 1, .css 1)

## Summary
- 422 nodes · 908 edges · 13 communities (12 shown, 1 thin omitted)
- Extraction: 93% EXTRACTED · 7% INFERRED · 0% AMBIGUOUS · INFERRED: 62 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `bd5d8e28`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- ProjectPage.jsx
- taskController.js
- seed.js
- backend/package.json
- authController.js
- projectController.js
- helpers.js
- sockets/index.js
- frontend/package.json
- projectRoutes.js
- notificationController.js
- TaskFlow
- routes/index.js

## God Nodes (most connected - your core abstractions)
1. `useToast()` - 20 edges
2. `requiredText()` - 17 edges
3. `react` - 17 edges
4. `mongoose` - 15 edges
5. `useAuth()` - 15 edges
6. `formatDate()` - 13 edges
7. `emitToProject()` - 12 edges
8. `react-router-dom` - 12 edges
9. `api` - 12 edges
10. `updateTask()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `Architettura e scelte` --references--> `errorHandler()`  [INFERRED]
  README.md → backend/src/middleware/errorHandler.js
- `Architettura e scelte` --references--> `authenticateToken()`  [INFERRED]
  README.md → backend/src/utils/token.js
- `Architettura e scelte` --references--> `loadProject()`  [INFERRED]
  README.md → backend/src/middleware/projectAccess.js
- `Architettura e scelte` --references--> `canView()`  [INFERRED]
  README.md → backend/src/middleware/projectAccess.js
- `Architettura e scelte` --references--> `requireMember()`  [INFERRED]
  README.md → backend/src/middleware/projectAccess.js

## Import Cycles
- None detected.

## Communities (13 total, 1 thin omitted)

### Community 0 - "ProjectPage.jsx"
Cohesion: 0.10
Nodes (52): api, getToken(), request(), setToken(), toQuery(), App(), Avatar(), COLORS (+44 more)

### Community 1 - "taskController.js"
Cohesion: 0.08
Nodes (50): { emitToProject }, Message, { requiredText }, sendMessage(), addMember(), AppError, { emitToProject, joinProjectRoom, leaveProjectRoom, notifyUser }, removeMember() (+42 more)

### Community 2 - "seed.js"
Cohesion: 0.05
Nodes (41): bcrypt, daysFromNow(), Message, mongoose, { mongoUri }, Project, seed(), Task (+33 more)

### Community 3 - "backend/package.json"
Cohesion: 0.05
Nodes (44): dependencies, bcryptjs, cors, dotenv, express, jsonwebtoken, mongoose, multer (+36 more)

### Community 4 - "authController.js"
Cohesion: 0.09
Nodes (26): AppError, bcrypt, login(), logout(), me(), register(), { requiredText }, RevokedToken (+18 more)

### Community 5 - "projectController.js"
Cohesion: 0.08
Nodes (23): AppError, archiveProject(), deleteProject(), fs, listPublic(), Message, path, Project (+15 more)

### Community 6 - "helpers.js"
Cohesion: 0.17
Nodes (18): { app, request, connect, disconnect, createUser, createProject, authed }, { app, request, connect, disconnect, createUser, authed }, app, authed(), connect(), createProject(), createUser(), disconnect() (+10 more)

### Community 7 - "sockets/index.js"
Cohesion: 0.10
Nodes (16): mongoose, { mongoUri }, app, connectDB, http, initSockets, { port }, start() (+8 more)

### Community 8 - "frontend/package.json"
Cohesion: 0.10
Nodes (19): dependencies, react, react-dom, react-router-dom, socket.io-client, devDependencies, vite, @vitejs/plugin-react (+11 more)

### Community 9 - "projectRoutes.js"
Cohesion: 0.16
Nodes (17): AppError, canView(), loadProject(), mongoose, Project, requireMember(), requireOwner(), { auth } (+9 more)

### Community 10 - "notificationController.js"
Cohesion: 0.19
Nodes (11): AppError, listNotifications(), markAllRead(), markRead(), mongoose, Notification, mongoose, notificationSchema (+3 more)

### Community 11 - "TaskFlow"
Cohesion: 0.15
Nodes (12): Account di prova (dopo `npm run seed`), API REST, Collection Postman, Come si avvia, Configurazione (`backend/.env`), Eventi Socket.IO, Funzionalità, Possibili estensioni (+4 more)

## Knowledge Gaps
- **5 isolated node(s):** `dotenv`, `jest`, `nodemon`, `socket.io-client`, `socket.io-client`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 197 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **1 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `mongoose` connect `seed.js` to `taskController.js`, `backend/package.json`, `helpers.js`, `sockets/index.js`, `projectRoutes.js`, `notificationController.js`?**
  _High betweenness centrality (0.196) - this node is a cross-community bridge._
- **What connects `dotenv`, `jest`, `nodemon` to the rest of the system?**
  _5 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `ProjectPage.jsx` be split into smaller, more focused modules?**
  _Cohesion score 0.09802012333657903 - nodes in this community are weakly interconnected._
- **Why does `react` connect `ProjectPage.jsx` to `frontend/package.json`?**
  _High betweenness centrality (0.100) - this node is a cross-community bridge._
- **Should `taskController.js` be split into smaller, more focused modules?**
  _Cohesion score 0.08166969147005444 - nodes in this community are weakly interconnected._
- **Why does `Architettura e scelte` connect `projectRoutes.js` to `TaskFlow`, `backend/package.json`, `authController.js`?**
  _High betweenness centrality (0.064) - this node is a cross-community bridge._
- **Should `seed.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05052790346907994 - nodes in this community are weakly interconnected._