// Serves the static export in out/ the way GitHub Pages does: directory URLs,
// the site's own 404 page, and nothing else. Used by `npm run preview` and the
// browser tests. Run `npm run build` first.
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const out = fileURLToPath(new URL("../out", import.meta.url));
const port = Number(process.env.PORT ?? 8124);
const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".woff2": "font/woff2", ".ico": "image/x-icon", ".png": "image/png", ".jpg": "image/jpeg", ".txt": "text/plain" };

const resolve = async (path) => {
  try {
    const info = await stat(path);
    return info.isDirectory() ? resolve(join(path, "index.html")) : path;
  } catch { return null; }
};

createServer(async (req, res) => {
  const url = normalize(decodeURIComponent(new URL(req.url, "http://x").pathname));
  const file = await resolve(join(out, url));
  const send = file ?? join(out, "404.html");
  res.writeHead(file ? 200 : 404, { "content-type": TYPES[extname(send)] ?? "application/octet-stream" });
  createReadStream(send).pipe(res);
}).listen(port, () => console.log(`Serving out/ on http://localhost:${port}`));
