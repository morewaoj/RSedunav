// Shared CSP / Reporting-API source of truth for the web app
// (artifacts/edunav) and the api-server (artifacts/api-server).
//
// Before this lib existed, each artifact maintained its own copy of the
// allow-list (script-src, style-src, etc.) plus the report path and the
// report-only / enforced group names. A change like "drop https://replit.com
// from script-src" had to be remembered in two places, and forgetting one
// side is exactly the kind of mistake the parallel report-only header is
// supposed to catch — but only after a real user trips the missing rule.
//
// Owning the allow-list here closes that gap up front. Each artifact is
// still free to declare its *own* extra directives on top (e.g. the web
// app's `base-uri` / `form-action`, which are header-only directives the
// api-server doesn't need), but the directives listed in
// `CSP_BASE_DIRECTIVES` below are the canonical version that both surfaces
// must agree on.
//
// Authored as plain ESM JavaScript (`.mjs`) rather than TypeScript so the
// web app's raw-Node consumers (`artifacts/edunav/serve.mjs`,
// `artifacts/edunav/vite.config.ts` via Vite's loader) can import it
// directly without a build step. Types for TypeScript consumers
// (the api-server) live in the sibling `index.d.mts` file.

// Endpoint that receives CSP violation reports. The api-server lives at
// /api on the same origin as the web app (the Replit path-based router
// proxies /api → api-server), so a same-origin path works for both the
// legacy `report-uri` directive and the modern `Reporting-Endpoints`
// header.
export const CSP_REPORT_PATH = "/api/csp-report";

// Group name for the enforced CSP's reports.
export const CSP_REPORT_GROUP = "csp-endpoint";

// Distinct group for the parallel report-only (experimental) policy.
// Browsers send reports for the report-only header to whichever endpoint
// group its `report-to` directive names, so keeping the two groups separate
// keeps the Reporting-API plumbing tidy even though both groups currently
// point at the same `/api/csp-report` URL — the receiver in
// `artifacts/api-server/src/routes/csp-report.ts` distinguishes enforced
// vs. report-only reports via the standard `disposition` field
// ("enforce" vs. "report") rather than the group name.
export const CSP_REPORT_ONLY_GROUP = "csp-report-only-endpoint";

// 18 weeks. Tells browsers how long they may cache the Reporting-API
// endpoint registration before refreshing it.
export const CSP_REPORT_TO_MAX_AGE = 10886400;

// Canonical CSP allow-list shared by every surface that emits a Content
// Security Policy. Directive names are kebab-cased (the on-the-wire form);
// `toHelmetDirectives()` below converts them to the camelCase shape helmet
// expects.
//
// The keys here are deliberately the directives the task calls out as the
// "drift-prone" set — script-src/style-src/font-src/img-src/connect-src/
// frame-src/frame-ancestors/object-src. Other directives that one artifact
// needs but the other doesn't (e.g. the web app's `base-uri`,
// `form-action`, `default-src`, or `upgrade-insecure-requests`) are layered
// on by the artifact itself rather than declared here.
export const CSP_BASE_DIRECTIVES = Object.freeze({
  "script-src": Object.freeze(["'self'", "https://replit.com"]),
  "style-src": Object.freeze(["'self'", "https://fonts.googleapis.com"]),
  // `data:` is allowed for fonts so the web app can inline tiny font
  // payloads. The api-server doesn't actually serve fonts but inheriting
  // the same source list keeps the two policies in lockstep.
  "font-src": Object.freeze(["'self'", "data:", "https://fonts.gstatic.com"]),
  "img-src": Object.freeze(["'self'", "data:", "blob:"]),
  "connect-src": Object.freeze(["'self'", "https://replit.com"]),
  "frame-src": Object.freeze(["'self'"]),
  "frame-ancestors": Object.freeze(["'self'"]),
  "object-src": Object.freeze(["'none'"]),
});

// Format a directives object (e.g. `{ "script-src": ["'self'"] }`) into the
// array of `"directive source-1 source-2"` strings used in HTTP CSP header
// values and `<meta http-equiv>` tags. A directive with an empty source
// list is emitted bare (e.g. `upgrade-insecure-requests`).
//
// Iteration order follows insertion order, so callers who want a specific
// directive ordering can rely on the order they spread the bases / extras.
export function formatCspDirectives(directives) {
  const lines = [];
  for (const [name, sources] of Object.entries(directives)) {
    if (!sources || sources.length === 0) {
      lines.push(name);
    } else {
      lines.push(`${name} ${sources.join(" ")}`);
    }
  }
  return lines;
}

// Convert a kebab-cased directives object into the camelCase shape helmet's
// `contentSecurityPolicy` middleware expects (e.g. `script-src` →
// `scriptSrc`). Returns plain mutable arrays because helmet mutates its
// input internally for some directives.
export function toHelmetDirectives(directives) {
  /** @type {Record<string, string[]>} */
  const out = {};
  for (const [name, sources] of Object.entries(directives)) {
    const camel = name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
    out[camel] = sources ? [...sources] : [];
  }
  return out;
}

// Build the value for the modern `Reporting-Endpoints` header. Both the
// enforced and report-only groups are declared so reports for the parallel
// `Content-Security-Policy-Report-Only` header reach the same endpoint.
export function buildReportingEndpointsHeader() {
  return [
    `${CSP_REPORT_GROUP}="${CSP_REPORT_PATH}"`,
    `${CSP_REPORT_ONLY_GROUP}="${CSP_REPORT_PATH}"`,
  ].join(", ");
}

// Build the value for the legacy `Report-To` header (older Reporting-API
// implementations). Each group is its own JSON object; multiple objects are
// comma-separated within a single header value.
export function buildReportToHeader() {
  return [
    JSON.stringify({
      group: CSP_REPORT_GROUP,
      max_age: CSP_REPORT_TO_MAX_AGE,
      endpoints: [{ url: CSP_REPORT_PATH }],
    }),
    JSON.stringify({
      group: CSP_REPORT_ONLY_GROUP,
      max_age: CSP_REPORT_TO_MAX_AGE,
      endpoints: [{ url: CSP_REPORT_PATH }],
    }),
  ].join(", ");
}
