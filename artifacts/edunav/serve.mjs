import http from "node:http";
import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SECURITY_HEADERS } from "./security-headers.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, "dist/public");

const rawPort = process.env.PORT;
if (!rawPort) {
  throw new Error("PORT environment variable is required but was not provided.");
}
const port = Number(rawPort);
if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".mjs": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".map": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".wasm": "application/wasm",
};

function mimeFor(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

function applySecurityHeaders(res) {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(name, value);
  }
}

function isWithinPublicDir(target) {
  const resolved = path.resolve(target);
  return resolved === publicDir || resolved.startsWith(publicDir + path.sep);
}

async function fileExists(p) {
  try {
    const stat = await fs.stat(p);
    return stat.isFile();
  } catch {
    return false;
  }
}

async function sendFile(req, res, filePath, statusCode = 200) {
  const contentType = mimeFor(filePath);
  const cacheControl = contentType.startsWith("text/html")
    ? "no-cache"
    : "public, max-age=31536000, immutable";

  applySecurityHeaders(res);
  res.setHeader("Content-Type", contentType);
  res.setHeader("Cache-Control", cacheControl);
  res.statusCode = statusCode;

  if (req.method === "HEAD") {
    res.end();
    return;
  }

  await new Promise((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on("error", reject);
    stream.on("end", resolve);
    stream.pipe(res);
  });
}

function sendStatus(res, statusCode, message) {
  applySecurityHeaders(res);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.end(message);
}

const indexHtmlPath = path.join(publicDir, "index.html");

const server = http.createServer(async (req, res) => {
  try {
    if (req.method !== "GET" && req.method !== "HEAD") {
      sendStatus(res, 405, "Method Not Allowed");
      return;
    }

    const url = new URL(req.url ?? "/", "http://localhost");
    let pathname = decodeURIComponent(url.pathname);

    if (pathname.includes("\0")) {
      sendStatus(res, 400, "Bad Request");
      return;
    }

    if (pathname.endsWith("/")) {
      pathname += "index.html";
    }

    const candidate = path.join(publicDir, pathname);

    if (!isWithinPublicDir(candidate)) {
      sendStatus(res, 403, "Forbidden");
      return;
    }

    if (await fileExists(candidate)) {
      await sendFile(req, res, candidate);
      return;
    }

    // SPA fallback: serve index.html for unknown routes (no file extension).
    if (!path.extname(pathname) && (await fileExists(indexHtmlPath))) {
      await sendFile(req, res, indexHtmlPath);
      return;
    }

    sendStatus(res, 404, "Not Found");
  } catch (err) {
    console.error("Server error:", err);
    if (!res.headersSent) {
      sendStatus(res, 500, "Internal Server Error");
    } else {
      res.destroy(err instanceof Error ? err : undefined);
    }
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`EduNav static server listening on port ${port}`);
});
