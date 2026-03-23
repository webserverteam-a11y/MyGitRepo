import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';
import dbMiddleware from './db-middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 10000;
const DB_PATH = path.join(__dirname, 'data.db');

// ── DB helpers ────────────────────────────────────────
function getDb() {
  return new Database(DB_PATH);
}

function initDb() {
  const db = getDb();
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS app_config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
  db.close();
}

initDb();

// ── Middleware ─────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));

// DB admin panel at /db-access
app.use(dbMiddleware);

// ── API: Tasks ────────────────────────────────────────
app.get('/api/tasks', (_req, res) => {
  const db = getDb();
  try {
    const rows = db.prepare('SELECT data FROM tasks ORDER BY id').all();
    res.json(rows.map(r => JSON.parse(r.data)));
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

app.put('/api/tasks', (req, res) => {
  const tasks = req.body;
  if (!Array.isArray(tasks)) return res.status(400).json({ error: 'Expected array' });
  const db = getDb();
  try {
    db.transaction(() => {
      db.prepare('DELETE FROM tasks').run();
      const ins = db.prepare('INSERT INTO tasks (id, data) VALUES (?, ?)');
      for (const t of tasks) ins.run(t.id, JSON.stringify(t));
    })();
    res.json({ ok: true, count: tasks.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// ── API: Config (admin_options, users, nav_access) ────
app.get('/api/config/:key', (req, res) => {
  const db = getDb();
  try {
    const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(req.params.key);
    res.json(row ? JSON.parse(row.value) : null);
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

app.put('/api/config/:key', (req, res) => {
  const db = getDb();
  try {
    db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(
      req.params.key, JSON.stringify(req.body)
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// ── API: Login ────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { name, password } = req.body;
  const db = getDb();
  try {
    const row = db.prepare("SELECT value FROM app_config WHERE key = 'users'").get();
    const users = row ? JSON.parse(row.value) : [];
    const user = users.find(u => u.name.toLowerCase() === name.toLowerCase() && u.password === password);
    if (user) {
      const { password: _, ...safe } = user;
      res.json({ ok: true, user: safe });
    } else {
      res.status(401).json({ error: 'Invalid credentials' });
    }
  } catch (e) {
    res.status(500).json({ error: e.message });
  } finally {
    db.close();
  }
});

// ── Static + SPA fallback ─────────────────────────────
app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database admin: http://localhost:${PORT}/db-access`);
});
