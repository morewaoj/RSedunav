import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  __MAX_TRACKED_KEYS_FOR_TESTS,
  __UNKNOWN_PAYLOAD_KEY_FOR_TESTS,
  __flushCspAggregationNow,
  __recordCspUnrecognisedForTests,
  __recordCspViolationForTests,
  __resetCspAggregation,
} from "./csp-report";

interface CapturedWarn {
  obj: Record<string, unknown>;
  msg: string;
}

function createCapturingLogger() {
  const warns: CapturedWarn[] = [];
  const log = {
    warn(obj: Record<string, unknown>, msg: string) {
      warns.push({ obj, msg });
    },
    info() {},
    error() {},
    debug() {},
    trace() {},
    fatal() {},
  } as unknown as Parameters<typeof __recordCspViolationForTests>[1];
  return { log, warns };
}

beforeEach(() => {
  __resetCspAggregation();
});

test("first occurrence of a unique key is logged immediately as a WARN", () => {
  const { log, warns } = createCapturingLogger();

  __recordCspViolationForTests(
    {
      reportType: "csp-report",
      violatedDirective: "script-src",
      effectiveDirective: "script-src",
      blockedUri: "https://evil.example/x.js",
      sourceFile: "https://app.example/page",
    },
    log,
  );

  assert.equal(warns.length, 1, "first occurrence should emit one WARN");
  assert.equal(warns[0].msg, "CSP violation reported");
  assert.equal(warns[0].obj.aggregated, undefined);
  // Reports without an explicit disposition (e.g. legacy CSP2) are treated
  // as enforced and the field is normalised so operators can always filter.
  assert.equal(warns[0].obj.disposition, "enforce");
  assert.equal(
    warns[0].obj.dedupeKey,
    "enforce|script-src|https://evil.example/x.js|https://app.example/page",
  );
});

test("duplicate occurrences in the same window do not emit additional WARNs", () => {
  const { log, warns } = createCapturingLogger();
  const entry = {
    reportType: "csp-report" as const,
    effectiveDirective: "img-src",
    blockedUri: "https://cdn.example/pixel.gif",
    sourceFile: "https://app.example/home",
  };

  __recordCspViolationForTests(entry, log);
  __recordCspViolationForTests(entry, log);
  __recordCspViolationForTests(entry, log);
  __recordCspViolationForTests(entry, log);

  assert.equal(
    warns.length,
    1,
    "only the first of N identical reports should be logged inline",
  );
  assert.equal(warns[0].obj.aggregated, undefined);
});

test("flush helper emits a single summary WARN with count > 1 and window bounds", () => {
  const { log, warns } = createCapturingLogger();
  const entry = {
    reportType: "csp-report" as const,
    effectiveDirective: "connect-src",
    blockedUri: "https://tracker.example",
    sourceFile: "https://app.example/dash",
    userAgent: "TestAgent/1.0",
  };

  const before = Date.now();
  __recordCspViolationForTests(entry, log);
  __recordCspViolationForTests(entry, log);
  __recordCspViolationForTests(entry, log);

  const inlineCount = warns.length;
  assert.equal(inlineCount, 1, "expected the first occurrence to log inline");

  __flushCspAggregationNow(log);
  const after = Date.now();

  const summaries = warns.slice(inlineCount);
  assert.equal(summaries.length, 1, "flush should emit exactly one summary");
  const summary = summaries[0];
  assert.equal(summary.msg, "CSP violation aggregated");
  assert.equal(summary.obj.aggregated, true);
  assert.equal(summary.obj.count, 3);
  assert.equal(summary.obj.additionalOccurrences, 2);
  assert.equal(summary.obj.effectiveDirective, "connect-src");

  const windowStart = summary.obj.windowStartMs;
  const windowEnd = summary.obj.windowEndMs;
  assert.equal(typeof windowStart, "number");
  assert.equal(typeof windowEnd, "number");
  assert.ok(
    (windowStart as number) >= before && (windowStart as number) <= after,
    "windowStartMs should be inside the recorded interval",
  );
  assert.ok(
    (windowEnd as number) >= (windowStart as number) &&
      (windowEnd as number) <= after,
    "windowEndMs should be at or after windowStartMs and not in the future",
  );
});

test("flush emits nothing for keys that only fired once", () => {
  const { log, warns } = createCapturingLogger();
  __recordCspViolationForTests(
    {
      reportType: "csp-report",
      effectiveDirective: "frame-src",
      blockedUri: "https://iframe.example",
      sourceFile: "https://app.example/x",
    },
    log,
  );
  assert.equal(warns.length, 1);

  __flushCspAggregationNow(log);

  assert.equal(
    warns.length,
    1,
    "single-occurrence keys should not produce a summary on flush",
  );
});

test("unrecognised payloads are deduped under the __unrecognised__ key", () => {
  const { log, warns } = createCapturingLogger();
  const payloadA = { totally: "made up" };
  const payloadB = { also: "weird", v: 2 };

  __recordCspUnrecognisedForTests(payloadA, "AgentA/1.0", log);
  __recordCspUnrecognisedForTests(payloadB, "AgentB/1.0", log);
  __recordCspUnrecognisedForTests(payloadA, "AgentA/1.0", log);

  assert.equal(
    warns.length,
    1,
    "only the first unrecognised payload should log inline; rest dedupe",
  );
  assert.equal(warns[0].msg, "CSP report received with unrecognised payload");
  assert.equal(warns[0].obj.dedupeKey, __UNKNOWN_PAYLOAD_KEY_FOR_TESTS);
  assert.equal(__UNKNOWN_PAYLOAD_KEY_FOR_TESTS, "__unrecognised__");

  __flushCspAggregationNow(log);

  assert.equal(warns.length, 2, "flush should add a single summary WARN");
  const summary = warns[1];
  assert.equal(summary.msg, "CSP report unrecognised payloads aggregated");
  assert.equal(summary.obj.aggregated, true);
  assert.equal(summary.obj.count, 3);
  assert.equal(summary.obj.additionalOccurrences, 2);
  assert.equal(summary.obj.dedupeKey, __UNKNOWN_PAYLOAD_KEY_FOR_TESTS);
  assert.equal(typeof summary.obj.windowStartMs, "number");
  assert.equal(typeof summary.obj.windowEndMs, "number");
});

test("enforced and report-only violations are tracked as separate aggregations", () => {
  const { log, warns } = createCapturingLogger();
  const sharedFields = {
    reportType: "csp-report" as const,
    effectiveDirective: "img-src",
    blockedUri: "https://cdn.example/pixel.gif",
    sourceFile: "https://app.example/home",
  };

  // Same resource, different policies. These must not collapse together.
  __recordCspViolationForTests(
    { ...sharedFields, disposition: "enforce" },
    log,
  );
  __recordCspViolationForTests(
    { ...sharedFields, disposition: "report" },
    log,
  );
  // A second hit of each, to confirm the dedupe still works *within* a
  // disposition.
  __recordCspViolationForTests(
    { ...sharedFields, disposition: "enforce" },
    log,
  );
  __recordCspViolationForTests(
    { ...sharedFields, disposition: "report" },
    log,
  );

  assert.equal(
    warns.length,
    2,
    "each disposition should log its own first-occurrence WARN",
  );
  assert.equal(warns[0].msg, "CSP violation reported");
  assert.equal(warns[0].obj.disposition, "enforce");
  assert.equal(warns[1].msg, "CSP report-only violation reported");
  assert.equal(warns[1].obj.disposition, "report");
  // The dedupe keys must differ so the aggregator stores them in separate
  // buckets — that's what keeps trial signal isolated from live blocking.
  assert.notEqual(warns[0].obj.dedupeKey, warns[1].obj.dedupeKey);
  assert.match(String(warns[0].obj.dedupeKey), /^enforce\|/);
  assert.match(String(warns[1].obj.dedupeKey), /^report\|/);

  __flushCspAggregationNow(log);

  const summaries = warns.slice(2);
  assert.equal(
    summaries.length,
    2,
    "flush should emit one summary per disposition, not a merged one",
  );
  const enforceSummary = summaries.find(
    (w) => w.obj.disposition === "enforce",
  );
  const reportSummary = summaries.find((w) => w.obj.disposition === "report");
  assert.ok(enforceSummary, "missing enforced summary");
  assert.ok(reportSummary, "missing report-only summary");
  assert.equal(enforceSummary!.msg, "CSP violation aggregated");
  assert.equal(reportSummary!.msg, "CSP report-only violation aggregated");
  assert.equal(enforceSummary!.obj.count, 2);
  assert.equal(reportSummary!.obj.count, 2);
});

test("at MAX_TRACKED_KEYS the aggregator falls back to per-request logging", () => {
  const { log, warns } = createCapturingLogger();

  // Fill the aggregator to capacity with unique keys. Each unique key logs
  // one inline WARN as the "first occurrence", so we expect exactly
  // MAX_TRACKED_KEYS WARNs after this loop.
  for (let i = 0; i < __MAX_TRACKED_KEYS_FOR_TESTS; i++) {
    __recordCspViolationForTests(
      {
        reportType: "csp-report",
        effectiveDirective: "script-src",
        blockedUri: `https://evil.example/${i}.js`,
        sourceFile: "https://app.example/page",
      },
      log,
    );
  }
  assert.equal(warns.length, __MAX_TRACKED_KEYS_FOR_TESTS);

  // The next two unique keys can no longer be tracked. They must each be
  // logged inline (per-request fallback) instead of being silently dropped.
  __recordCspViolationForTests(
    {
      reportType: "csp-report",
      effectiveDirective: "script-src",
      blockedUri: "https://evil.example/overflow-a.js",
      sourceFile: "https://app.example/page",
    },
    log,
  );
  __recordCspViolationForTests(
    {
      reportType: "csp-report",
      effectiveDirective: "script-src",
      blockedUri: "https://evil.example/overflow-b.js",
      sourceFile: "https://app.example/page",
    },
    log,
  );
  assert.equal(warns.length, __MAX_TRACKED_KEYS_FOR_TESTS + 2);

  // And repeating an overflow key still logs every time, because nothing
  // is being tracked for that key.
  __recordCspViolationForTests(
    {
      reportType: "csp-report",
      effectiveDirective: "script-src",
      blockedUri: "https://evil.example/overflow-a.js",
      sourceFile: "https://app.example/page",
    },
    log,
  );
  assert.equal(
    warns.length,
    __MAX_TRACKED_KEYS_FOR_TESTS + 3,
    "overflow keys should keep logging inline since they are not aggregated",
  );

  // Likewise, at capacity an unrecognised payload also falls back to
  // per-request logging instead of being aggregated.
  __recordCspUnrecognisedForTests({ x: 1 }, "AgentZ", log);
  __recordCspUnrecognisedForTests({ x: 2 }, "AgentZ", log);
  assert.equal(warns.length, __MAX_TRACKED_KEYS_FOR_TESTS + 5);
  assert.equal(
    warns.at(-1)?.msg,
    "CSP report received with unrecognised payload",
  );
});
