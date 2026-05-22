import { Router, type IRouter, type Request, type Response } from "express";
import express from "express";
import { logger } from "../lib/logger";

const router: IRouter = Router();

// CSP reports use non-standard content types that express.json() does not
// parse by default. Accept all of the variants browsers send today.
const cspBodyParser = express.json({
  type: [
    "application/csp-report",
    "application/reports+json",
    "application/json",
  ],
  limit: "32kb",
});

interface CspReportLogContext {
  reportType: "csp-report" | "report-to" | "unknown";
  documentUri?: string;
  referrer?: string;
  blockedUri?: string;
  violatedDirective?: string;
  effectiveDirective?: string;
  originalPolicy?: string;
  disposition?: string;
  sourceFile?: string;
  lineNumber?: number;
  columnNumber?: number;
  statusCode?: number;
  scriptSample?: string;
  userAgent?: string;
}

function pickStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function pickNum(value: unknown): number | undefined {
  return typeof value === "number" ? value : undefined;
}

function fromCspReport(report: Record<string, unknown>): CspReportLogContext {
  return {
    reportType: "csp-report",
    documentUri: pickStr(report["document-uri"]),
    referrer: pickStr(report["referrer"]),
    blockedUri: pickStr(report["blocked-uri"]),
    violatedDirective: pickStr(report["violated-directive"]),
    effectiveDirective: pickStr(report["effective-directive"]),
    originalPolicy: pickStr(report["original-policy"]),
    disposition: pickStr(report["disposition"]),
    sourceFile: pickStr(report["source-file"]),
    lineNumber: pickNum(report["line-number"]),
    columnNumber: pickNum(report["column-number"]),
    statusCode: pickNum(report["status-code"]),
    scriptSample: pickStr(report["script-sample"]),
  };
}

function fromReportToBody(body: Record<string, unknown>): CspReportLogContext {
  return {
    reportType: "report-to",
    documentUri: pickStr(body["documentURL"]),
    referrer: pickStr(body["referrer"]),
    blockedUri: pickStr(body["blockedURL"]),
    effectiveDirective: pickStr(body["effectiveDirective"]),
    originalPolicy: pickStr(body["originalPolicy"]),
    disposition: pickStr(body["disposition"]),
    sourceFile: pickStr(body["sourceFile"]),
    lineNumber: pickNum(body["lineNumber"]),
    columnNumber: pickNum(body["columnNumber"]),
    statusCode: pickNum(body["statusCode"]),
    scriptSample: pickStr(body["sample"]),
  };
}

// In-memory aggregation: a single misconfigured deploy can cause every
// visitor to fire several CSP reports per page load. Without aggregation a
// few thousand pageviews would each emit several near-identical pino WARNs,
// drowning out other warnings. We log the first occurrence of every unique
// (disposition, directive, blocked URI, source file) tuple immediately so
// the alerting signal isn't lost, then collapse subsequent duplicates into
// a single summary WARN per window. Including disposition in the key keeps
// reports from the enforced policy (`disposition: "enforce"`) and the
// parallel report-only trial policy (`disposition: "report"`) tracked as
// distinct aggregations — otherwise an enforced violation and a report-only
// violation against the same resource would collapse together and operators
// couldn't tell trial signal apart from live blocking.
const AGGREGATION_WINDOW_MS = 5 * 60 * 1000;
// Cap the aggregator so a malicious or buggy client that emits unbounded
// unique keys can't grow this map without bound. Above the cap we fall back
// to the original "log every report" behaviour, which is still rate-limited
// at the express layer.
const MAX_TRACKED_KEYS = 1000;
const UNKNOWN_PAYLOAD_KEY = "__unrecognised__";

interface AggregatedEntry {
  key: string;
  count: number;
  windowStartMs: number;
  lastSeenMs: number;
  sample: CspReportLogContext;
  unrecognisedSample?: unknown;
}

const aggregated = new Map<string, AggregatedEntry>();

// Browsers send `disposition: "enforce"` for the live CSP header and
// `disposition: "report"` for `Content-Security-Policy-Report-Only`. Older
// CSP2 reports may omit the field entirely; treat missing values as
// "enforce" since legacy `Content-Security-Policy` is always enforcing.
type NormalisedDisposition = "enforce" | "report";
function normaliseDisposition(value: string | undefined): NormalisedDisposition {
  return value === "report" ? "report" : "enforce";
}

function dedupeKey(entry: CspReportLogContext): string {
  return [
    normaliseDisposition(entry.disposition),
    entry.effectiveDirective ?? entry.violatedDirective ?? "",
    entry.blockedUri ?? "",
    entry.sourceFile ?? "",
  ].join("|");
}

// Distinct log messages per disposition so operators can grep / filter the
// api-server logs to isolate report-only trial signal from live enforced
// blocking, without having to also match on a structured field.
function inlineMessage(entry: CspReportLogContext): string {
  return normaliseDisposition(entry.disposition) === "report"
    ? "CSP report-only violation reported"
    : "CSP violation reported";
}
function aggregatedMessage(entry: CspReportLogContext): string {
  return normaliseDisposition(entry.disposition) === "report"
    ? "CSP report-only violation aggregated"
    : "CSP violation aggregated";
}

function flushAggregatedReports(log: typeof logger = logger): void {
  if (aggregated.size === 0) return;
  const now = Date.now();
  for (const [key, agg] of aggregated) {
    // count === 1 means the only occurrence was already logged immediately
    // when first seen, so nothing further to emit.
    if (agg.count > 1) {
      const additional = agg.count - 1;
      if (key === UNKNOWN_PAYLOAD_KEY) {
        log.warn(
          {
            cspReport: agg.unrecognisedSample,
            userAgent: agg.sample.userAgent,
            aggregated: true,
            count: agg.count,
            additionalOccurrences: additional,
            dedupeKey: key,
            windowStartMs: agg.windowStartMs,
            windowEndMs: now,
            lastSeenMs: agg.lastSeenMs,
          },
          "CSP report unrecognised payloads aggregated",
        );
      } else {
        log.warn(
          {
            ...agg.sample,
            disposition: normaliseDisposition(agg.sample.disposition),
            aggregated: true,
            count: agg.count,
            additionalOccurrences: additional,
            dedupeKey: key,
            windowStartMs: agg.windowStartMs,
            windowEndMs: now,
            lastSeenMs: agg.lastSeenMs,
          },
          aggregatedMessage(agg.sample),
        );
      }
    }
    aggregated.delete(key);
  }
}

const flushTimer = setInterval(
  () => flushAggregatedReports(logger),
  AGGREGATION_WINDOW_MS,
);
// Don't keep the event loop alive just for the flush timer.
flushTimer.unref?.();

function recordEntry(
  entry: CspReportLogContext,
  log: typeof logger,
): void {
  const key = dedupeKey(entry);
  const now = Date.now();
  const existing = aggregated.get(key);
  if (existing) {
    existing.count += 1;
    existing.lastSeenMs = now;
    // Refresh the sample so the eventual summary carries the most recent
    // contextual fields (user agent, line/column numbers, etc.).
    existing.sample = entry;
    return;
  }
  if (aggregated.size >= MAX_TRACKED_KEYS) {
    // At capacity: log immediately and don't track. The endpoint is still
    // rate limited so this remains bounded in the worst case.
    log.warn(
      {
        ...entry,
        disposition: normaliseDisposition(entry.disposition),
        dedupeKey: key,
      },
      inlineMessage(entry),
    );
    return;
  }
  aggregated.set(key, {
    key,
    count: 1,
    windowStartMs: now,
    lastSeenMs: now,
    sample: entry,
  });
  log.warn(
    {
      ...entry,
      disposition: normaliseDisposition(entry.disposition),
      dedupeKey: key,
    },
    inlineMessage(entry),
  );
}

function recordUnrecognised(
  body: unknown,
  userAgent: string | undefined,
  log: typeof logger,
): void {
  const key = UNKNOWN_PAYLOAD_KEY;
  const now = Date.now();
  const existing = aggregated.get(key);
  if (existing) {
    existing.count += 1;
    existing.lastSeenMs = now;
    existing.unrecognisedSample = body;
    existing.sample = { reportType: "unknown", userAgent };
    return;
  }
  if (aggregated.size >= MAX_TRACKED_KEYS) {
    log.warn(
      { cspReport: body, userAgent, dedupeKey: key },
      "CSP report received with unrecognised payload",
    );
    return;
  }
  aggregated.set(key, {
    key,
    count: 1,
    windowStartMs: now,
    lastSeenMs: now,
    sample: { reportType: "unknown", userAgent },
    unrecognisedSample: body,
  });
  log.warn(
    { cspReport: body, userAgent, dedupeKey: key },
    "CSP report received with unrecognised payload",
  );
}

// Exposed for tests and graceful shutdown hooks.
export function __resetCspAggregation(): void {
  aggregated.clear();
}
export function __flushCspAggregationNow(log: typeof logger = logger): void {
  flushAggregatedReports(log);
}
// Test-only entry points so the dedupe behaviour can be exercised without
// spinning up an HTTP server or mocking pino. They call straight into the
// internal record helpers so future refactors of the route can't silently
// stop logging the first occurrence or stop collapsing duplicates.
export function __recordCspViolationForTests(
  entry: CspReportLogContext,
  log: typeof logger,
): void {
  recordEntry(entry, log);
}
export function __recordCspUnrecognisedForTests(
  body: unknown,
  userAgent: string | undefined,
  log: typeof logger,
): void {
  recordUnrecognised(body, userAgent, log);
}
export const __MAX_TRACKED_KEYS_FOR_TESTS = MAX_TRACKED_KEYS;
export const __UNKNOWN_PAYLOAD_KEY_FOR_TESTS = UNKNOWN_PAYLOAD_KEY;

router.post("/csp-report", cspBodyParser, (req: Request, res: Response) => {
  const userAgent = req.get("user-agent") ?? undefined;
  const body: unknown = req.body;

  const log = (req as Request & { log?: typeof logger }).log ?? logger;

  const entries: CspReportLogContext[] = [];

  // CSP Level 3 / Reporting API: array of report objects with a `body` field.
  if (Array.isArray(body)) {
    for (const item of body) {
      if (
        item &&
        typeof item === "object" &&
        (item as { type?: unknown }).type === "csp-violation" &&
        typeof (item as { body?: unknown }).body === "object" &&
        (item as { body?: unknown }).body !== null
      ) {
        const reportBody = (item as { body: Record<string, unknown> }).body;
        const ctx = fromReportToBody(reportBody);
        const itemUserAgent = pickStr(
          (item as Record<string, unknown>)["user_agent"],
        );
        entries.push({ ...ctx, userAgent: itemUserAgent ?? userAgent });
      }
    }
  } else if (
    body &&
    typeof body === "object" &&
    typeof (body as { "csp-report"?: unknown })["csp-report"] === "object" &&
    (body as { "csp-report"?: unknown })["csp-report"] !== null
  ) {
    // CSP Level 2: { "csp-report": {...} }
    const report = (body as { "csp-report": Record<string, unknown> })[
      "csp-report"
    ];
    entries.push({ ...fromCspReport(report), userAgent });
  }

  if (entries.length === 0) {
    recordUnrecognised(body, userAgent, log);
  } else {
    for (const entry of entries) {
      recordEntry(entry, log);
    }
  }

  res.status(204).end();
});

export default router;
