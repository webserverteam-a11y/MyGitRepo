import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import type { Plugin } from 'vite';
import Database from 'better-sqlite3';

const DB_PATH = path.resolve(__dirname, 'data.db');

function apiPlugin(): Plugin {
  return {
    name: 'api-middleware',
    configureServer(server) {
      // Initialize DB tables
      const initDb = new Database(DB_PATH);
      initDb.pragma('journal_mode = WAL');
      initDb.exec(`
        CREATE TABLE IF NOT EXISTS tasks (id TEXT PRIMARY KEY, data TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS app_config (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      `);
      initDb.close();

      function getDb() { return new Database(DB_PATH); }

      // API routes (must be registered before other middleware)
      server.middlewares.use((req, res, next) => {
        const url = new URL(req.url || '/', `http://${req.headers.host}`);
        const pathname = url.pathname;

        if (!pathname.startsWith('/api/')) return next();

        // Parse JSON body for PUT/POST
        const readBody = () => new Promise<string>((resolve, reject) => {
          const chunks: Buffer[] = [];
          req.on('data', (c: Buffer) => chunks.push(c));
          req.on('end', () => resolve(Buffer.concat(chunks).toString()));
          req.on('error', reject);
        });

        const sendJson = (data: unknown, status = 200) => {
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(data));
        };

        // GET /api/tasks
        if (pathname === '/api/tasks' && req.method === 'GET') {
          const db = getDb();
          try {
            const rows = db.prepare('SELECT data FROM tasks ORDER BY id').all() as { data: string }[];
            sendJson(rows.map(r => JSON.parse(r.data)));
          } catch (e: any) { sendJson({ error: e.message }, 500); }
          finally { db.close(); }
          return;
        }

        // PUT /api/tasks
        if (pathname === '/api/tasks' && req.method === 'PUT') {
          readBody().then(body => {
            const tasks = JSON.parse(body);
            const db = getDb();
            try {
              db.transaction(() => {
                db.prepare('DELETE FROM tasks').run();
                const ins = db.prepare('INSERT INTO tasks (id, data) VALUES (?, ?)');
                for (const t of tasks) ins.run(t.id, JSON.stringify(t));
              })();
              sendJson({ ok: true });
            } catch (e: any) { sendJson({ error: e.message }, 500); }
            finally { db.close(); }
          });
          return;
        }

        // GET /api/config/:key
        const configMatch = pathname.match(/^\/api\/config\/(.+)$/);
        if (configMatch && req.method === 'GET') {
          const db = getDb();
          try {
            const row = db.prepare('SELECT value FROM app_config WHERE key = ?').get(configMatch[1]) as { value: string } | undefined;
            sendJson(row ? JSON.parse(row.value) : null);
          } catch (e: any) { sendJson({ error: e.message }, 500); }
          finally { db.close(); }
          return;
        }

        // PUT /api/config/:key
        if (configMatch && req.method === 'PUT') {
          readBody().then(body => {
            const db = getDb();
            try {
              db.prepare('INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)').run(configMatch[1], body);
              sendJson({ ok: true });
            } catch (e: any) { sendJson({ error: e.message }, 500); }
            finally { db.close(); }
          });
          return;
        }

        // POST /api/login
        if (pathname === '/api/login' && req.method === 'POST') {
          readBody().then(body => {
            const { name, password } = JSON.parse(body);
            const db = getDb();
            try {
              const row = db.prepare("SELECT value FROM app_config WHERE key = 'users'").get() as { value: string } | undefined;
              const users = row ? JSON.parse(row.value) : [];
              const user = users.find((u: any) => u.name.toLowerCase() === name.toLowerCase() && u.password === password);
              if (user) sendJson({ ok: true, user });
              else sendJson({ error: 'Invalid credentials' }, 401);
            } catch (e: any) { sendJson({ error: e.message }, 500); }
            finally { db.close(); }
          });
          return;
        }

        next();
      });
    },
  };
}

function dbAdminPlugin(): Plugin {
  return {
    name: 'db-admin',
    async configureServer(server) {
      const mod = await import('./db-middleware.js');
      server.middlewares.use(mod.default);
    },
  };
}

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss(), apiPlugin(), dbAdminPlugin()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
