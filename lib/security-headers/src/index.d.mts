// Type declarations for the runtime module in `./index.mjs`. Hand-written
// rather than emitted by tsc so the runtime stays a plain `.mjs` file (so
// the web app's raw-Node consumers — `serve.mjs` / `vite.config.ts` — can
// import it without a build step) while TypeScript consumers (the
// api-server) still get full type checking.

export const CSP_REPORT_PATH: "/api/csp-report";
export const CSP_REPORT_GROUP: "csp-endpoint";
export const CSP_REPORT_ONLY_GROUP: "csp-report-only-endpoint";
export const CSP_REPORT_TO_MAX_AGE: number;

export type CspDirectives = Readonly<Record<string, ReadonlyArray<string>>>;

export const CSP_BASE_DIRECTIVES: CspDirectives;

export function formatCspDirectives(directives: CspDirectives): string[];

export function toHelmetDirectives(
  directives: CspDirectives,
): Record<string, string[]>;

export function buildReportingEndpointsHeader(): string;

export function buildReportToHeader(): string;
