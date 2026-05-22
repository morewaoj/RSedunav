#!/usr/bin/env node
/**
 * Verifies the API server refuses to be embedded in third-party iframes.
 *
 * Hits a sample API route on the running api-server and asserts both the
 * modern `Content-Security-Policy: frame-ancestors 'self'` directive and
 * the legacy `X-Frame-Options: SAMEORIGIN` header are present on the
 * response. Also sanity-checks that ordinary API behavior (200 + JSON body
 * + CORS) is unaffected.
 *
 * Usage:
 *   node artifacts/api-server/scripts/test-frame-protection.mjs
 *   API_BASE=http://localhost:8080 node artifacts/api-server/scripts/test-frame-protection.mjs
 */

const BASE = process.env.API_BASE || "http://localhost:8080";

let passed = 0;
let failed = 0;
const failures = [];

function assert(name, ok, detail) {
  const tag = ok ? "PASS" : "FAIL";
  const symbol = ok ? "\u2713" : "\u2717";
  // eslint-disable-next-line no-console
  console.log(`${symbol} [${tag}] ${name}${detail ? ` \u2014 ${detail}` : ""}`);
  if (ok) passed += 1;
  else {
    failed += 1;
    failures.push(`${name}: ${detail || ""}`);
  }
}

async function main() {
  let res;
  try {
    res = await fetch(`${BASE}/api/healthz`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(`Could not reach ${BASE}/api/healthz: ${err.message}`);
    console.error("Start the api-server workflow first.");
    process.exit(1);
  }

  const body = await res.text();

  assert(
    "GET /api/healthz returns 200",
    res.status === 200,
    `got ${res.status}`,
  );

  assert(
    "JSON body still parses (no CORS/JSON regression)",
    (() => {
      try {
        return JSON.parse(body).status === "ok";
      } catch {
        return false;
      }
    })(),
    `body=${body.slice(0, 80)}`,
  );

  const csp = res.headers.get("content-security-policy") || "";
  assert(
    "CSP header includes frame-ancestors 'self'",
    /(^|;\s*)frame-ancestors\s+'self'(\s|;|$)/.test(csp),
    `csp=${csp}`,
  );

  // A third-party origin (e.g. https://evil.example) is *not* 'self', so a
  // browser that honours frame-ancestors will refuse to render the response
  // in an <iframe>. Make sure no wildcard or third-party origin slipped in.
  assert(
    "frame-ancestors does not allow third-party origins",
    !/frame-ancestors[^;]*\*/.test(csp) &&
      !/frame-ancestors[^;]*https?:\/\//.test(csp),
    `csp=${csp}`,
  );

  const xfo = res.headers.get("x-frame-options");
  assert(
    "X-Frame-Options is SAMEORIGIN (legacy fallback)",
    typeof xfo === "string" && xfo.toUpperCase() === "SAMEORIGIN",
    `xfo=${xfo}`,
  );

  // CORS sanity check: a request with an Origin header from one of the
  // allow-listed dev domains should still receive Access-Control-Allow-* on
  // success. We only check the header is *not* mistakenly cleared by the
  // helmet changes; we don't assert a specific origin since the allow-list
  // is environment-dependent.
  const corsRes = await fetch(`${BASE}/api/healthz`, {
    headers: { Origin: "https://edunav.replit.app" },
  });
  assert(
    "CORS preflight/origin handling still works",
    corsRes.headers.get("access-control-allow-origin") ===
      "https://edunav.replit.app",
    `acao=${corsRes.headers.get("access-control-allow-origin")}`,
  );

  // eslint-disable-next-line no-console
  console.log(`\n${passed} passed, ${failed} failed`);
  if (failed > 0) {
    // eslint-disable-next-line no-console
    console.error(
      "Failures:\n" + failures.map((f) => `  - ${f}`).join("\n"),
    );
    process.exit(1);
  }
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
