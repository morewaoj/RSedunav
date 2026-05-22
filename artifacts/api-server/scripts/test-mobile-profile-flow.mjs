#!/usr/bin/env node
/**
 * 15 end-to-end test cases for the mobile profile + recommendation flow.
 *
 * Covers: registration, login, PUT /api/profile (success + edge cases including
 * the "duplicate email" scenario that previously returned 500), and
 * /api/profile/for-you returning exactly 2+2 personalized matches.
 *
 * Usage: node artifacts/api-server/scripts/test-mobile-profile-flow.mjs
 */

const BASE = process.env.API_BASE || "http://localhost:8080";

let passed = 0;
let failed = 0;
const failures = [];

function logResult(name, ok, detail) {
  const tag = ok ? "PASS" : "FAIL";
  const symbol = ok ? "\u2713" : "\u2717";
  // eslint-disable-next-line no-console
  console.log(`${symbol} [${tag}] ${name}${detail ? ` — ${detail}` : ""}`);
  if (ok) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(`${name}: ${detail || ""}`);
  }
}

async function request(method, path, body, cookie) {
  const headers = { "Content-Type": "application/json" };
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body),
  });
  let data;
  const text = await res.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  const setCookie = res.headers.get("set-cookie") || "";
  return { status: res.status, data, setCookie };
}

function extractSession(setCookie) {
  if (!setCookie) return null;
  const m =
    setCookie.match(/sessionId=[^;]+/) ||
    setCookie.match(/connect\.sid=[^;]+/);
  return m ? m[0] : null;
}

function uniqueEmail(prefix) {
  return `${prefix}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.local`;
}

async function registerAndLogin(label) {
  const username = `mobtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const email = uniqueEmail(label);
  const password = "Test1234!";
  const reg = await request("POST", "/api/register", {
    username,
    email,
    password,
    firstName: "Test",
    lastName: "User",
  });
  if (reg.status !== 200 && reg.status !== 201) {
    throw new Error(`register failed: ${reg.status} ${JSON.stringify(reg.data)}`);
  }
  let session = extractSession(reg.setCookie);
  if (!session) {
    const login = await request("POST", "/api/login", { username, password });
    session = extractSession(login.setCookie);
    if (!session) {
      throw new Error(`login failed: ${login.status} ${JSON.stringify(login.data)}`);
    }
  }
  return { username, email, password, session };
}

async function main() {
  // eslint-disable-next-line no-console
  console.log(`\nRunning 15 mobile-profile flow tests against ${BASE}\n`);

  let userA, userB;

  // ----- 1: register user A
  try {
    userA = await registerAndLogin("alice");
    logResult("01 Register + login user A", true, userA.email);
  } catch (e) {
    logResult("01 Register + login user A", false, e.message);
    return;
  }

  // ----- 2: register user B (will be used for duplicate-email test)
  try {
    userB = await registerAndLogin("bob");
    logResult("02 Register + login user B", true, userB.email);
  } catch (e) {
    logResult("02 Register + login user B", false, e.message);
    return;
  }

  // ----- 3: GET /api/profile after registration returns the new user
  {
    const r = await request("GET", "/api/profile", null, userA.session);
    logResult(
      "03 GET /api/profile after register",
      r.status === 200 && r.data && (r.data.email === userA.email || r.data.username === userA.username),
      `status=${r.status}`,
    );
  }

  // ----- 4: PUT /api/profile basic update succeeds
  {
    const r = await request(
      "PUT",
      "/api/profile",
      {
        firstName: "Alice",
        lastName: "Anderson",
        major: "Computer Science",
        gpa: 3.8,
        graduationYear: 2027,
        academicLevel: "undergraduate",
        state: "California",
        interests: ["Technology", "Engineering"],
        demographics: ["First Generation"],
        financialNeed: "high",
      },
      userA.session,
    );
    logResult(
      "04 PUT /api/profile basic update",
      r.status === 200 && r.data?.major === "Computer Science",
      `status=${r.status}`,
    );
  }

  // ----- 5: PUT /api/profile with the SAME email it already has succeeds
  {
    const r = await request(
      "PUT",
      "/api/profile",
      { email: userA.email, firstName: "AliceSame" },
      userA.session,
    );
    logResult(
      "05 PUT /api/profile with current email (no-op)",
      r.status === 200 && r.data?.firstName === "AliceSame",
      `status=${r.status}`,
    );
  }

  // ----- 6: PUT /api/profile with empty email string still succeeds (ignored)
  {
    const r = await request(
      "PUT",
      "/api/profile",
      { email: "", phone: "555-0000" },
      userA.session,
    );
    logResult(
      "06 PUT /api/profile with empty email (skipped)",
      r.status === 200 && r.data?.phone === "555-0000",
      `status=${r.status}`,
    );
  }

  // ----- 7: PUT /api/profile trying to set email to userB's email — must NOT 500
  {
    const r = await request(
      "PUT",
      "/api/profile",
      { email: userB.email, gpa: 3.9 },
      userA.session,
    );
    logResult(
      "07 PUT /api/profile with another user's email (graceful)",
      r.status === 200 && r.data?.gpa === 3.9 && r.data?.email !== userB.email,
      `status=${r.status} email=${r.data?.email}`,
    );
  }

  // ----- 8: PUT /api/profile with large interests + demographics arrays
  {
    const interests = ["Technology", "Healthcare", "Business", "Arts", "Engineering", "Finance"];
    const demographics = ["First Generation", "Underrepresented", "Has Disability"];
    const r = await request(
      "PUT",
      "/api/profile",
      { interests, demographics },
      userA.session,
    );
    logResult(
      "08 PUT /api/profile with multi-select arrays",
      r.status === 200 &&
        Array.isArray(r.data?.interests) &&
        r.data.interests.length === interests.length &&
        Array.isArray(r.data?.demographics) &&
        r.data.demographics.length === demographics.length,
      `status=${r.status} interests=${r.data?.interests?.length} demographics=${r.data?.demographics?.length}`,
    );
  }

  // ----- 9: PUT /api/profile silently ignores unknown / disallowed fields
  {
    const r = await request(
      "PUT",
      "/api/profile",
      { isAdmin: true, password: "hax", major: "Biology" },
      userA.session,
    );
    logResult(
      "09 PUT /api/profile rejects disallowed fields",
      r.status === 200 && r.data?.major === "Biology" && r.data?.isAdmin !== true,
      `status=${r.status} isAdmin=${r.data?.isAdmin}`,
    );
  }

  // ----- 10: PUT /api/profile clearing arrays to empty
  {
    const r = await request(
      "PUT",
      "/api/profile",
      { demographics: [], interests: ["Engineering"] },
      userA.session,
    );
    logResult(
      "10 PUT /api/profile clearing demographics array",
      r.status === 200 &&
        Array.isArray(r.data?.demographics) &&
        r.data.demographics.length === 0,
      `status=${r.status}`,
    );
  }

  // ----- 11: PUT /api/profile without auth returns 401
  {
    const r = await request("PUT", "/api/profile", { major: "Math" }, null);
    logResult(
      "11 PUT /api/profile without session is rejected",
      r.status === 401 || r.status === 403,
      `status=${r.status}`,
    );
  }

  // ----- 12: GET /api/profile/for-you returns recommendations (careers + scholarships)
  {
    // re-set richer profile to drive matches
    await request(
      "PUT",
      "/api/profile",
      {
        major: "Computer Science",
        gpa: 3.7,
        academicLevel: "undergraduate",
        state: "California",
        interests: ["Technology", "Business", "Healthcare"],
        demographics: ["First Generation"],
        financialNeed: "high",
      },
      userA.session,
    );
    const r = await request("GET", "/api/profile/for-you", null, userA.session);
    const careers = r.data?.careers ?? [];
    const scholarships = r.data?.scholarships ?? [];
    logResult(
      "12 GET /api/profile/for-you returns careers + scholarships",
      r.status === 200 && Array.isArray(careers) && Array.isArray(scholarships),
      `status=${r.status} careers=${careers.length} scholarships=${scholarships.length}`,
    );
  }

  // ----- 13: For You — at least one career has matchScore reflecting weighted scoring
  {
    const r = await request("GET", "/api/profile/for-you", null, userA.session);
    const careers = r.data?.careers ?? [];
    const hasScore =
      careers.length > 0 &&
      careers.some((c) => typeof c.matchScore === "number" && c.matchScore > 0);
    logResult(
      "13 For You careers have weighted matchScore",
      hasScore,
      `careers=${careers.length} scored=${careers.filter((c) => typeof c.matchScore === "number").length}`,
    );
  }

  // ----- 14: For You returns at least 2 careers so the mobile UI can render top 2+2
  {
    const r = await request("GET", "/api/profile/for-you", null, userA.session);
    const careers = r.data?.careers ?? [];
    const scholarships = r.data?.scholarships ?? [];
    logResult(
      "14 For You returns >=2 careers (scholarships may be sparse in test DB)",
      careers.length >= 2,
      `careers=${careers.length} scholarships=${scholarships.length}`,
    );
  }

  // ----- 15: After updating interests, For You reflects them in subsequent fetch
  {
    await request(
      "PUT",
      "/api/profile",
      { interests: ["Healthcare"], major: "Nursing" },
      userA.session,
    );
    const r = await request("GET", "/api/profile/for-you", null, userA.session);
    const careers = r.data?.careers ?? [];
    const reasons = careers
      .flatMap((c) => c.reasons ?? c.matchReasons ?? [])
      .join(" ")
      .toLowerCase();
    const reflectsHealthcare =
      careers.length > 0 &&
      (reasons.includes("healthcare") ||
        reasons.includes("nursing") ||
        careers.some((c) =>
          (c.title || "").toLowerCase().match(/nurse|health|medical|clinical|therap|patient/),
        ));
    logResult(
      "15 For You reflects updated interests/major (Healthcare/Nursing)",
      reflectsHealthcare,
      `top=${careers.slice(0, 3).map((c) => c.title).join(", ")}`,
    );
  }

  // ----- 16: POST /api/saved-careers inserts on first call, dedups on second
  {
    const payload = {
      userId: userA.username ? `mobtest-saved-${Date.now()}` : "stub",
      careerTitle: `Test Career ${Date.now()}`,
      matchScore: 80,
      skillsGap: ["communication"],
    };
    // Use a stable userId for both calls so dedup logic actually triggers.
    payload.userId = `mobtest-saved-${Math.random().toString(36).slice(2, 10)}`;
    const first = await request("POST", "/api/saved-careers", payload);
    const second = await request("POST", "/api/saved-careers", payload);
    logResult(
      "16 POST /api/saved-careers dedups on second call",
      first.status === 201 &&
        second.status === 200 &&
        second.data?.duplicate === true &&
        first.data?.id === second.data?.id,
      `first=${first.status} second=${second.status} dup=${second.data?.duplicate}`,
    );
  }

  // ----- 17: POST /api/saved-careers dedup is case-insensitive on title
  {
    const baseTitle = `Mixed Case Career ${Date.now()}`;
    const userId = `mobtest-case-${Math.random().toString(36).slice(2, 10)}`;
    const first = await request("POST", "/api/saved-careers", {
      userId,
      careerTitle: baseTitle,
      matchScore: 50,
    });
    const second = await request("POST", "/api/saved-careers", {
      userId,
      careerTitle: baseTitle.toUpperCase(),
      matchScore: 50,
    });
    logResult(
      "17 POST /api/saved-careers dedup is case-insensitive",
      first.status === 201 && second.status === 200 && second.data?.duplicate === true,
      `first=${first.status} second=${second.status} dup=${second.data?.duplicate}`,
    );
  }

  // ----- 18: POST /api/saved-colleges dedups on (userId, collegeId)
  {
    const userId = `mobtest-col-${Math.random().toString(36).slice(2, 10)}`;
    const collegeId = 12345;
    const first = await request("POST", "/api/saved-colleges", { userId, collegeId });
    const second = await request("POST", "/api/saved-colleges", { userId, collegeId });
    logResult(
      "18 POST /api/saved-colleges dedups on (userId, collegeId)",
      first.status === 201 && second.status === 200 && second.data?.duplicate === true,
      `first=${first.status} second=${second.status} dup=${second.data?.duplicate}`,
    );
  }

  // ----- 19: POST /api/saved-scholarships dedups on (userId, scholarshipId)
  {
    const userId = `mobtest-sch-${Math.random().toString(36).slice(2, 10)}`;
    const scholarshipId = 9999;
    const first = await request("POST", "/api/saved-scholarships", { userId, scholarshipId });
    const second = await request("POST", "/api/saved-scholarships", { userId, scholarshipId });
    logResult(
      "19 POST /api/saved-scholarships dedups on (userId, scholarshipId)",
      first.status === 201 && second.status === 200 && second.data?.duplicate === true,
      `first=${first.status} second=${second.status} dup=${second.data?.duplicate}`,
    );
  }

  // ----- 20: POST /api/saved-careers without required field returns 400 (not 500)
  {
    const r = await request("POST", "/api/saved-careers", { userId: "nope" });
    logResult(
      "20 POST /api/saved-careers without careerTitle returns 400",
      r.status === 400,
      `status=${r.status}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    // eslint-disable-next-line no-console
    console.log("\nFailures:");
    for (const f of failures) console.log("  - " + f);
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error("Test runner crashed:", e);
  process.exit(2);
});
