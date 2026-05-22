// Web app's CSP / Reporting-API configuration. The shared allow-list and
// reporting plumbing live in `@workspace/security-headers` (see
// `lib/security-headers/src/index.mjs`); this file layers the web app's
// own extras on top and exports the final header values consumed by
// `vite.config.ts` (for the build-time meta tag) and `serve.mjs` (for the
// runtime HTTP headers).
//
// The api-server (`artifacts/api-server/src/app.ts`) imports the same
// shared module so a change like "drop https://replit.com from script-src"
// only has to be made in one place.

import {
  CSP_BASE_DIRECTIVES,
  CSP_REPORT_GROUP,
  CSP_REPORT_ONLY_GROUP,
  CSP_REPORT_PATH,
  buildReportingEndpointsHeader,
  buildReportToHeader,
  formatCspDirectives,
} from "@workspace/security-headers";

// Web-app-only directives that aren't part of the shared base. These are
// either header- and meta-safe directives the api-server doesn't need
// (`base-uri`, `form-action`) or generic policy bits the web app prefers
// to express explicitly in its meta tag (`default-src`,
// `upgrade-insecure-requests`). The api-server handles the latter through
// helmet's built-in defaults.
const WEB_EXTRA_DIRECTIVES = {
  "default-src": ["'self'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "upgrade-insecure-requests": [],
};

// `frame-ancestors` is meta-tag-illegal (browsers ignore it from a
// <meta http-equiv> tag), so the meta-only directive list strips it from
// the shared base.
const { "frame-ancestors": _frameAncestors, ...META_SAFE_BASE_DIRECTIVES } =
  CSP_BASE_DIRECTIVES;

// Directives that work in both a `<meta http-equiv>` tag and an HTTP
// header. Header-only directives (frame-ancestors, report-uri, report-to)
// are added to `CSP_HEADER_VALUE` below.
export const CSP_META_DIRECTIVES = formatCspDirectives({
  ...META_SAFE_BASE_DIRECTIVES,
  ...WEB_EXTRA_DIRECTIVES,
});

// Full CSP for HTTP responses, including frame-ancestors and the reporting
// directives. `report-uri` is the legacy CSP2 directive (still honoured by
// most browsers) and `report-to` is the CSP3 directive that pairs with the
// `Reporting-Endpoints` header below. Sending both maximises coverage.
// Neither reporting directive is honoured when CSP is delivered via a
// `<meta http-equiv>` tag, which is why these only live in the header
// value.
export const CSP_HEADER_VALUE = [
  ...formatCspDirectives({
    ...CSP_BASE_DIRECTIVES,
    ...WEB_EXTRA_DIRECTIVES,
  }),
  `report-uri ${CSP_REPORT_PATH}`,
  `report-to ${CSP_REPORT_GROUP}`,
].join("; ");

// === Experimental, report-only policy ====================================
//
// Browsers honour a parallel `Content-Security-Policy-Report-Only` header
// that *only* sends violation reports — it never blocks anything. We use
// it to safely trial tighter CSP rules before flipping them on for real:
//
//   1. Tighten the report-only policy below — for example, build it from a
//      stricter version of `CSP_BASE_DIRECTIVES` (drop `data:` from
//      `img-src`, or remove `https://replit.com` from `script-src`).
//   2. Ship and watch the api-server logs from
//      `artifacts/api-server/src/routes/csp-report.ts`. Reports from this
//      header arrive with `disposition: "report"`; enforced violations
//      have `disposition: "enforce"`. The aggregator already groups by
//      directive and blocked URI so a noisy mistake won't flood the logs.
//   3. Once a release goes by with no unexpected `disposition: "report"`
//      warnings, promote the rule into `CSP_BASE_DIRECTIVES` (in
//      `lib/security-headers/src/index.mjs`) so it becomes enforced on
//      *both* surfaces. Then leave the report-only policy one step ahead
//      of the enforced one for the next experiment.
//
// Keep the report-only policy at least as strict as the enforced one.
// Making it *looser* doesn't actually relax enforcement (the enforced
// header still applies) and just produces confusing reports.
//
// Initial value: identical to the enforced policy. Swap in stricter
// directives here when you're ready to start an experiment.
export const CSP_REPORT_ONLY_DIRECTIVES = formatCspDirectives({
  ...CSP_BASE_DIRECTIVES,
  ...WEB_EXTRA_DIRECTIVES,
});

export const CSP_REPORT_ONLY_HEADER_VALUE = [
  ...CSP_REPORT_ONLY_DIRECTIVES,
  `report-uri ${CSP_REPORT_PATH}`,
  `report-to ${CSP_REPORT_ONLY_GROUP}`,
].join("; ");

export const SECURITY_HEADERS = {
  "Content-Security-Policy": CSP_HEADER_VALUE,
  "Content-Security-Policy-Report-Only": CSP_REPORT_ONLY_HEADER_VALUE,
  // Modern Reporting API (Chrome/Edge). The group names must match the
  // `report-to` directives in the CSP headers above. Multiple groups are
  // comma-separated within a single header value.
  "Reporting-Endpoints": buildReportingEndpointsHeader(),
  // Legacy Report-To header for older Reporting API implementations.
  "Report-To": buildReportToHeader(),
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};
