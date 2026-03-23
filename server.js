import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dbMiddleware from './db-middleware.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 10000;

// DB admin panel at /db (before static files)
app.use(dbMiddleware);

app.use(express.static(path.join(__dirname, 'dist')));

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Database admin: http://localhost:${PORT}/db`);
});
