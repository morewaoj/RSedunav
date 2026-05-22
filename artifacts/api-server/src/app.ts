import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import {
  CSP_BASE_DIRECTIVES as SHARED_CSP_BASE_DIRECTIVES,
  CSP_REPORT_GROUP,
  CSP_REPORT_ONLY_GROUP,
  CSP_REPORT_PATH,
  buildReportingEndpointsHeader,
  buildReportToHeader,
  toHelmetDirectives,
} from "@workspace/security-headers";
import healthRouter from "./routes/health";
import cspReportRouter from "./routes/csp-report";
import { logger } from "./lib/logger";

const app: Express = express();

// CSP allow-list and Reporting-API plumbing are owned by the shared
// `@workspace/security-headers` lib (see lib/security-headers/src/index.mjs)
// so the api-server and the web app (artifacts/edunav/security-headers.mjs)
// can't drift apart. A change like "drop https://replit.com from script-src"
// only has to be made in one place.
//
// `report-uri` (CSP2, still honoured by most browsers) and `report-to`
// (CSP3, paired with the `Reporting-Endpoints` / `Report-To` headers below)
// are wired up together to maximise coverage. The path is same-origin to
// the API server, so a relative URL works in every deployment.
//
// The receiver in ./routes/csp-report.ts tells enforced vs. report-only
// reports apart via the standard `disposition` field ("enforce" vs.
// "report") rather than the group name, so both groups currently point at
// the same URL.
//
// Directives shared between the enforced policy and the parallel
// report-only trial policy come from the shared base. Layering them here
// (rather than redeclaring them) means the two helmet middlewares below
// can't drift apart accidentally — the report-only policy is meant to be
// at least as strict as the enforced one (otherwise it just produces noise
// without teaching us anything new). `upgradeInsecureRequests` is the
// api-server's own extra: the web app expresses it through its meta tag
// instead.
const CSP_BASE_DIRECTIVES = {
  ...toHelmetDirectives(SHARED_CSP_BASE_DIRECTIVES),
  defaultSrc: ["'self'"],
  upgradeInsecureRequests: [],
};

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      ...CSP_BASE_DIRECTIVES,
      // Tell browsers where to POST CSP violation reports. Without these,
      // a violation (e.g., an attempt to embed an HTML error page in an
      // iframe from a disallowed origin) is blocked silently and never
      // shows up in our logs. The matching `Reporting-Endpoints` /
      // `Report-To` headers are set by the middleware below.
      reportUri: [CSP_REPORT_PATH],
      reportTo: [CSP_REPORT_GROUP],
    },
  },
  // Belt-and-braces companion to frame-ancestors for legacy browsers that
  // don't honour CSP3. Helmet defaults to SAMEORIGIN today; setting it
  // explicitly keeps the protection stable across helmet upgrades.
  frameguard: { action: "sameorigin" },
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: { policy: "cross-origin" },
}));

// Parallel `Content-Security-Policy-Report-Only` header. Browsers send
// reports for it but never block anything, so we can trial tighter rules
// safely: edit the directives below, ship, watch the api-server logs for
// `disposition: "report"` warnings (see ./routes/csp-report.ts), then once
// a release is clean, promote the rule into `CSP_BASE_DIRECTIVES` so it
// becomes enforced. The web app uses the same pattern in
// artifacts/edunav/security-headers.mjs (`CSP_REPORT_ONLY_DIRECTIVES`).
//
// Initial value: identical to the enforced policy. Swap in stricter
// directives here when you're ready to start an experiment. Keep the
// report-only policy at least as strict as the enforced one — making it
// looser doesn't relax enforcement (the enforced header still applies) and
// just produces confusing reports.
app.use(helmet.contentSecurityPolicy({
  directives: {
    ...CSP_BASE_DIRECTIVES,
    reportUri: [CSP_REPORT_PATH],
    // Distinct group from the enforced header so the Reporting-Endpoints /
    // Report-To plumbing stays tidy if the two policies are ever pointed at
    // different URLs.
    reportTo: [CSP_REPORT_ONLY_GROUP],
  },
  reportOnly: true,
}));

// Modern Reporting API headers. Helmet only emits the CSP `report-to`
// directive; the browser still needs the `Reporting-Endpoints` (current
// spec) and `Report-To` (legacy implementations) headers to know which URL
// each named group resolves to. Setting both maximises compatibility
// across Chrome/Edge versions. Both the enforced and report-only groups
// are declared (by the shared helpers) so reports for the parallel
// `Content-Security-Policy-Report-Only` header reach the same endpoint.
// The group names must match the `report-to` directives in the CSP
// headers above.
const REPORTING_ENDPOINTS_HEADER = buildReportingEndpointsHeader();
const REPORT_TO_HEADER = buildReportToHeader();

app.use((_req, res, next) => {
  res.setHeader("Reporting-Endpoints", REPORTING_ENDPOINTS_HEADER);
  res.setHeader("Report-To", REPORT_TO_HEADER);
  next();
});

app.use(hpp());

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { message: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
  // CSP reports are sent automatically by browsers and a single page can
  // generate many in quick succession, so they have their own limiter below.
  skip: (req) => !req.path.startsWith('/api') || req.path === '/api/csp-report',
});

const cspReportLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { message: "Too many CSP reports." },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: "Too many login attempts, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);
app.use('/api/csp-report', cspReportLimiter);
app.use('/api/login', authLimiter);
app.use('/api/register', authLimiter);

const STATIC_ALLOWED_ORIGINS = new Set<string>([
  "https://edunav.replit.app",
]);

if (process.env.REPLIT_DOMAINS) {
  for (const d of process.env.REPLIT_DOMAINS.split(",")) {
    const trimmed = d.trim();
    if (trimmed) STATIC_ALLOWED_ORIGINS.add(`https://${trimmed}`);
  }
}

if (process.env.REPLIT_DEV_DOMAIN) {
  STATIC_ALLOWED_ORIGINS.add(`https://${process.env.REPLIT_DEV_DOMAIN}`);
}

// Replit dev/preview domains are used only for in-development preview
// testing. We deliberately do NOT broaden this to *.replit.app — production
// is reachable only through the explicit static allowlist above.
const ALLOWED_ORIGIN_PATTERNS: RegExp[] = [
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)*\.replit\.dev$/i,
];

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header: native mobile fetches, server-to-server, curl, etc.
      // Some WebView/file:// clients send the literal string "null".
      if (!origin || origin === "null") return callback(null, true);
      if (STATIC_ALLOWED_ORIGINS.has(origin)) return callback(null, true);
      if (ALLOWED_ORIGIN_PATTERNS.some((p) => p.test(origin))) {
        return callback(null, true);
      }
      // Disallowed origin: don't emit CORS headers so the browser blocks the
      // response. Avoid throwing so we don't surface a 500 to legitimate
      // server-side callers; the request still won't be usable cross-origin.
      return callback(null, false);
    },
    credentials: true,
  }),
);
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

app.use("/api", healthRouter);
app.use("/api", cspReportRouter);

export default app;
