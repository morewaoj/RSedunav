/**
 * Demo mode for store screenshots and onboarding previews.
 *
 * When demo mode is active, `apiRequest` / `apiGet` short-circuit known GET
 * endpoints to canned, realistic data so every screen renders end-to-end with
 * believable content WITHOUT a real account, resume, or AI processing. This
 * is the prerequisite for capturing literal store screenshots from the
 * running app.
 *
 * Activation:
 *   - Build-time:  EXPO_PUBLIC_DEMO=1 (baked into the bundle)
 *   - Runtime:     append ?demo=1 to the URL (web only)
 *
 * Demo mode is OFF by default and must be explicitly enabled. It never
 * activates unless one of the two switches above is set.
 */

export type DemoUser = {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  isAdmin?: boolean;
};

export const DEMO_USER: DemoUser = {
  id: "demo-user-1",
  username: "alex.rivera",
  email: "alex@example.com",
  firstName: "Alex",
  lastName: "Rivera",
  isAdmin: false,
};

export function isDemoMode(): boolean {
  if (process.env["EXPO_PUBLIC_DEMO"] === "1") return true;
  if (typeof window !== "undefined" && typeof window.location !== "undefined") {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("demo") === "1") return true;
      // Also persist a flag so subsequent navigations within the SPA stay in
      // demo mode without needing to re-add ?demo=1 to every route.
      if (typeof window.sessionStorage !== "undefined") {
        if (window.sessionStorage.getItem("edunav.demoMode") === "1") {
          return true;
        }
      }
    } catch {
      // ignore
    }
  }
  return false;
}

/**
 * Persist the demo flag in sessionStorage so internal navigations
 * (which drop the URL query) keep demo mode active.
 */
export function persistDemoFlag(): void {
  if (typeof window === "undefined") return;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("demo") === "1" && typeof window.sessionStorage !== "undefined") {
      window.sessionStorage.setItem("edunav.demoMode", "1");
    }
  } catch {
    // ignore
  }
}

// ---------- canned API payloads ----------

const DEMO_PROFILE = {
  id: 101,
  userId: DEMO_USER.id,
  firstName: "Alex",
  lastName: "Rivera",
  email: "alex@example.com",
  major: "Computer Science",
  state: "CA",
  city: "San Jose",
  academicLevel: "undergraduate",
  interests: ["Software Development", "Data Science", "UX Design"],
  resumeFileName: "alex_rivera_resume.pdf",
  resumeAnalysisResults: {
    skills: ["Python", "JavaScript", "React", "SQL", "Statistics"],
    interests: ["AI", "Design"],
    keywords: ["Python", "React", "SQL"],
  },
  notificationsEnabled: true,
};

const DEMO_CAREER_RECS = {
  analysisDate: new Date().toISOString(),
  needsAnalysis: false,
  careers: [
    {
      score: 96,
      matchScore: 96,
      reason: "Matches Python & React skills; Aligns with problem-solving interests",
      matchReasons: [
        "Matches Python & React skills",
        "Aligns with problem-solving interests",
      ],
      career: {
        title: "Software Engineer",
        description:
          "Design, build, test, and maintain software systems and applications across web, mobile, and infrastructure.",
        averageSalary: 95000,
        onetCode: "15-1252.00",
        growthOutlook: "Much faster than average",
        requiredSkills: ["Python", "JavaScript", "Algorithms", "Git", "SQL"],
        keySkills: ["Python", "JavaScript", "Git"],
        educationRequired: "Bachelor's degree",
        matchScore: 96,
        matchReason:
          "Matches Python & React skills; Aligns with problem-solving interests",
        matchReasons: [
          "Matches Python & React skills",
          "Aligns with problem-solving interests",
        ],
      },
    },
    {
      score: 91,
      matchScore: 91,
      reason: "Matches Figma + UX research; Aligns with creative interest",
      matchReasons: [
        "Matches Figma + UX research",
        "Aligns with creative interest",
      ],
      career: {
        title: "Product Designer",
        description:
          "Lead design for digital products from research through high-fidelity prototypes and shipped features.",
        averageSalary: 88000,
        onetCode: "27-1024.00",
        growthOutlook: "Faster than average",
        requiredSkills: ["Figma", "UX research", "Prototyping", "Design systems"],
        keySkills: ["Figma", "Prototyping"],
        educationRequired: "Bachelor's degree",
        matchScore: 91,
        matchReason: "Matches Figma + UX research; Aligns with creative interest",
        matchReasons: [
          "Matches Figma + UX research",
          "Aligns with creative interest",
        ],
      },
    },
    {
      score: 87,
      matchScore: 87,
      reason: "Matches statistics & ML coursework",
      matchReasons: ["Matches statistics & ML coursework"],
      career: {
        title: "Data Scientist",
        description:
          "Apply statistics, machine learning, and engineering to extract insight from large datasets.",
        averageSalary: 112000,
        onetCode: "15-2051.00",
        growthOutlook: "Much faster than average",
        requiredSkills: ["Python", "Statistics", "Machine Learning", "SQL"],
        keySkills: ["Python", "Statistics"],
        educationRequired: "Master's degree",
        matchScore: 87,
        matchReason: "Matches statistics & ML coursework",
        matchReasons: ["Matches statistics & ML coursework"],
      },
    },
    {
      score: 82,
      matchScore: 82,
      reason: "Aligns with analytical & business interests",
      matchReasons: ["Aligns with analytical & business interests"],
      career: {
        title: "Data Analyst",
        description:
          "Translate business questions into data analyses and dashboards that drive decisions.",
        averageSalary: 72000,
        onetCode: "15-2041.00",
        growthOutlook: "Faster than average",
        requiredSkills: ["SQL", "Excel", "Tableau", "Statistics"],
        keySkills: ["SQL", "Tableau"],
        educationRequired: "Bachelor's degree",
        matchScore: 82,
        matchReason: "Aligns with analytical & business interests",
        matchReasons: ["Aligns with analytical & business interests"],
      },
    },
    {
      score: 78,
      matchScore: 78,
      reason: "Strong fit for design + research backgrounds",
      matchReasons: ["Strong fit for design + research backgrounds"],
      career: {
        title: "UX Researcher",
        description:
          "Plan and run user studies that shape product strategy and design decisions.",
        averageSalary: 84000,
        onetCode: "19-3033.00",
        growthOutlook: "Faster than average",
        requiredSkills: [
          "User research",
          "Interviewing",
          "Synthesis",
          "Prototyping",
        ],
        keySkills: ["User research", "Interviewing"],
        educationRequired: "Bachelor's degree",
        matchScore: 78,
        matchReason: "Strong fit for design + research backgrounds",
        matchReasons: ["Strong fit for design + research backgrounds"],
      },
    },
  ],
};

const DEMO_HYBRID_MATCH = {
  success: true,
  data: {
    confidence: 0.93,
    totalFound: 5,
    careerOptions: DEMO_CAREER_RECS.careers.map((c) => ({
      career: {
        title: c.career.title,
        description: c.career.description,
        requiredSkills: c.career.requiredSkills,
        averageSalary: c.career.averageSalary,
        growthOutlook: c.career.growthOutlook,
        educationRequirements: c.career.educationRequired,
        topKConfidence: c.score / 100,
        onetCode: c.career.onetCode,
      },
      marketData: {
        demandLevel: "High demand",
        remoteFriendly: true,
        jobAvailability: 12000,
      },
      matchDetails: {
        matchReasons: c.matchReasons,
      },
    })),
  },
};

const DEMO_SCHOLARSHIP_RECS = {
  totalMatches: 5,
  recommendations: [
    {
      score: 95,
      matchReasons: ["First-gen college student", "STEM major"],
      scholarship: {
        id: 1,
        name: "Gates Millennium Scholarship",
        provider: "Bill & Melinda Gates Foundation",
        amount: 40000,
        website: "https://www.thegatesscholarship.org",
        description:
          "Renewable scholarship for outstanding minority high school seniors with significant financial need.",
        type: "Merit + Need",
        deadline: "January 15, 2027",
        deadlineAt: "2027-01-15T00:00:00Z",
        isActive: true,
        eligibilityRequirements: [
          "First-generation college student",
          "Minimum GPA 3.3",
          "Pell-eligible",
        ],
        targetDemographics: ["First-generation", "Underrepresented minority"],
        fields: ["STEM", "Education", "Public health", "Library science"],
        minGpa: 3.3,
        renewable: true,
      },
    },
    {
      score: 92,
      matchReasons: ["High school senior", "Leadership focus"],
      scholarship: {
        id: 2,
        name: "Coca-Cola Scholars Program",
        provider: "The Coca-Cola Scholars Foundation",
        amount: 20000,
        website: "https://www.coca-colascholarsfoundation.org",
        description:
          "Achievement-based scholarship awarded to 150 high school seniors each year.",
        type: "Merit",
        deadline: "October 31, 2026",
        deadlineAt: "2026-10-31T00:00:00Z",
        isActive: true,
        eligibilityRequirements: [
          "Current high school senior",
          "Minimum GPA 3.0",
          "Demonstrated leadership",
        ],
        targetDemographics: ["High school senior"],
        fields: [],
        minGpa: 3.0,
        renewable: false,
      },
    },
    {
      score: 88,
      matchReasons: ["Heritage match", "GPA 3.5+"],
      scholarship: {
        id: 3,
        name: "Hispanic Scholarship Fund",
        provider: "Hispanic Scholarship Fund",
        amount: 5000,
        website: "https://www.hsf.net",
        description:
          "Need-based award for students of Hispanic heritage pursuing higher education.",
        type: "Need + Heritage",
        deadline: "February 15, 2027",
        deadlineAt: "2027-02-15T00:00:00Z",
        isActive: true,
        eligibilityRequirements: [
          "Hispanic heritage",
          "Minimum GPA 3.0",
          "U.S. citizen or eligible non-citizen",
        ],
        targetDemographics: ["Hispanic / Latino"],
        fields: [],
        minGpa: 3.0,
        renewable: true,
      },
    },
    {
      score: 84,
      matchReasons: ["STEM major", "Women in tech"],
      scholarship: {
        id: 4,
        name: "Society of Women Engineers Scholarship",
        provider: "SWE",
        amount: 12000,
        website: "https://swe.org/scholarships",
        description:
          "Supports women pursuing ABET-accredited engineering, technology, or computing degrees.",
        type: "Merit",
        deadline: "May 1, 2026",
        deadlineAt: "2026-05-01T00:00:00Z",
        isActive: true,
        eligibilityRequirements: [
          "Female-identifying",
          "Engineering / CS major",
          "Minimum GPA 3.5",
        ],
        targetDemographics: ["Women"],
        fields: ["Engineering", "Computer Science"],
        minGpa: 3.5,
        renewable: true,
      },
    },
    {
      score: 80,
      matchReasons: ["California resident", "Public university"],
      scholarship: {
        id: 5,
        name: "California Aggie Scholarship",
        provider: "UC Davis",
        amount: 7500,
        website: "https://financialaid.ucdavis.edu",
        description:
          "Need-based scholarship for California residents enrolling at UC Davis.",
        type: "Need",
        deadline: "March 2, 2027",
        deadlineAt: "2027-03-02T00:00:00Z",
        isActive: true,
        eligibilityRequirements: [
          "California resident",
          "Admitted to UC Davis",
          "FAFSA filed",
        ],
        targetDemographics: ["California resident"],
        fields: [],
        minGpa: 3.0,
        renewable: true,
      },
    },
  ],
};

const DEMO_SCHOLARSHIPS_LIST = DEMO_SCHOLARSHIP_RECS.recommendations.map(
  (r) => r.scholarship,
);

const DEMO_FOR_YOU = {
  freshlyGenerated: false,
  recommendations: {
    careerCount: DEMO_CAREER_RECS.careers.length,
    scholarshipCount: DEMO_SCHOLARSHIP_RECS.recommendations.length,
  },
  careers: DEMO_CAREER_RECS.careers.slice(0, 3).map((c) => ({
    matchScore: c.score,
    career: {
      title: c.career.title,
      description: c.career.description,
      averageSalary: c.career.averageSalary,
      onetCode: c.career.onetCode,
    },
  })),
  scholarships: DEMO_SCHOLARSHIP_RECS.recommendations.slice(0, 3).map((s) => ({
    matchScore: s.score,
    scholarship: s.scholarship,
    deadline: s.scholarship.deadline,
    deadlineAt: s.scholarship.deadlineAt,
    isActive: s.scholarship.isActive,
  })),
};

const DEMO_SAVED_ITEMS = {
  careers: [
    {
      id: 1001,
      careerId: 1,
      careerTitle: "Software Engineer",
      title: "Software Engineer",
      name: "Software Engineer",
      matchScore: 96,
      averageSalary: 95000,
      notes: "Apply for summer internships at FAANG and high-growth startups.",
      onetCode: "15-1252.00",
    },
    {
      id: 1002,
      careerId: 2,
      careerTitle: "Product Designer",
      title: "Product Designer",
      name: "Product Designer",
      matchScore: 91,
      averageSalary: 88000,
      notes: "Build a portfolio site with 3 case studies.",
      onetCode: "27-1024.00",
    },
    {
      id: 1003,
      careerId: 3,
      careerTitle: "Data Scientist",
      title: "Data Scientist",
      name: "Data Scientist",
      matchScore: 87,
      averageSalary: 112000,
      notes: "Take Statistics II next term and finish the ML capstone.",
      onetCode: "15-2051.00",
    },
  ],
  colleges: [
    {
      id: 2001,
      collegeId: "stanford",
      name: "Stanford University",
      city: "Stanford",
      state: "CA",
      priority: "high",
      notes: "Reach school. Apply REA in November.",
    },
    {
      id: 2002,
      collegeId: "ucla",
      name: "University of California, Los Angeles",
      city: "Los Angeles",
      state: "CA",
      priority: "medium",
      notes: "Strong CS program. UC application due Nov 30.",
    },
  ],
  scholarships: [
    {
      id: 3001,
      scholarshipId: 1,
      name: "Gates Millennium Scholarship",
      title: "Gates Millennium Scholarship",
      applicationStatus: "interested",
      notes: "Draft personal statement by December.",
      deadline: "January 15, 2027",
      deadlineAt: "2027-01-15T00:00:00Z",
      isActive: true,
    },
    {
      id: 3002,
      scholarshipId: 2,
      name: "Coca-Cola Scholars Program",
      title: "Coca-Cola Scholars Program",
      applicationStatus: "applied",
      notes: "Submitted Oct 28. Awaiting semifinalist announcement.",
      deadline: "October 31, 2026",
      deadlineAt: "2026-10-31T00:00:00Z",
      isActive: true,
    },
    {
      id: 3003,
      scholarshipId: 3,
      name: "Hispanic Scholarship Fund",
      title: "Hispanic Scholarship Fund",
      applicationStatus: "interested",
      notes: "Need 2 letters of recommendation.",
      deadline: "February 15, 2027",
      deadlineAt: "2027-02-15T00:00:00Z",
      isActive: true,
    },
    {
      id: 3004,
      scholarshipId: 4,
      name: "Society of Women Engineers Scholarship",
      title: "Society of Women Engineers Scholarship",
      applicationStatus: "interested",
      notes: "Confirm GPA threshold and ask SWE chapter for endorsement.",
      deadline: "May 1, 2026",
      deadlineAt: "2026-05-01T00:00:00Z",
      isActive: true,
    },
  ],
};

const DEMO_RESUME_INFO = {
  fileName: "alex_rivera_resume.pdf",
  uploadedAt: "2026-04-12T18:42:00Z",
  sizeBytes: 184_320,
  parsed: true,
};

const DEMO_DYNAMIC_SKILLS = [
  "Python",
  "JavaScript",
  "TypeScript",
  "React",
  "Node.js",
  "SQL",
  "Statistics",
  "Machine Learning",
  "Figma",
  "UX research",
  "Prototyping",
  "Excel",
  "Tableau",
  "Communication",
  "Leadership",
].map((name) => ({ name }));

const DEMO_DYNAMIC_INTERESTS = [
  "Software Development",
  "Data Science",
  "UX Design",
  "Artificial Intelligence",
  "Product Management",
  "Cybersecurity",
  "Robotics",
  "Mobile Development",
  "Game Development",
  "Climate Tech",
].map((name) => ({ name }));

const DEMO_COLLEGES: Record<string, Record<string, unknown>> = {
  stanford: {
    id: "stanford",
    name: "Stanford University",
    city: "Stanford",
    state: "CA",
    country: "United States",
    type: "Private",
    website: "https://www.stanford.edu",
    studentSize: 17400,
    tuition: 56000,
    tuitionInState: 56000,
    tuitionOutState: 56000,
    admissionRate: 0.04,
    graduationRate: 0.94,
    rating: 4.9,
    satAvg: 1505,
    satLow: 1440,
    satHigh: 1570,
    description:
      "Top-ranked private research university in the heart of Silicon Valley.",
    programs: ["Computer Science", "Engineering", "Economics", "Biology"],
    popularPrograms: [
      "Computer Science",
      "Engineering",
      "Economics",
      "Biology",
    ],
  },
  ucla: {
    id: "ucla",
    name: "University of California, Los Angeles",
    city: "Los Angeles",
    state: "CA",
    country: "United States",
    type: "Public",
    website: "https://www.ucla.edu",
    studentSize: 46430,
    tuitionInState: 13800,
    tuitionOutState: 46300,
    admissionRate: 0.09,
    graduationRate: 0.91,
    rating: 4.7,
    satAvg: 1410,
    satLow: 1330,
    satHigh: 1530,
    description:
      "Public research university with top programs in CS, engineering, and the arts.",
    programs: [
      "Computer Science",
      "Business Economics",
      "Psychology",
      "Engineering",
    ],
    popularPrograms: [
      "Computer Science",
      "Business Economics",
      "Psychology",
      "Engineering",
    ],
  },
};

// ---------- dispatcher ----------

/**
 * Returns canned response for the given request, or `undefined` if the
 * request should fall through to the real network. Keep this dispatcher
 * pure: only return data that is genuinely seeded above.
 */
export function getDemoResponse(
  method: string,
  path: string,
  _body?: unknown,
): unknown | undefined {
  // Strip query string for matching, but keep the parsed query for routes
  // that key on it (e.g. /api/scholarships?name=...).
  const [pathOnly, qs] = path.split("?", 2);
  const query = new URLSearchParams(qs ?? "");

  // --- Auth ---
  if (method === "GET" && pathOnly === "/api/auth/user") {
    return DEMO_USER;
  }
  if (method === "POST" && pathOnly === "/api/login") return DEMO_USER;
  if (method === "POST" && pathOnly === "/api/register") return DEMO_USER;
  if (method === "POST" && pathOnly === "/api/logout") return undefined; // no-op, fine to fall through

  // --- Profile ---
  if (method === "GET" && pathOnly === "/api/profile") return DEMO_PROFILE;
  if (method === "PUT" && pathOnly === "/api/profile") return DEMO_PROFILE;
  if (method === "GET" && pathOnly === "/api/profile/career-recommendations")
    return DEMO_CAREER_RECS;
  if (
    method === "GET" &&
    pathOnly === "/api/profile/scholarship-recommendations"
  )
    return DEMO_SCHOLARSHIP_RECS;
  if (method === "GET" && pathOnly === "/api/profile/for-you") return DEMO_FOR_YOU;
  if (method === "GET" && pathOnly === "/api/resume/info") return DEMO_RESUME_INFO;

  // --- Saved items ---
  if (method === "GET" && pathOnly.startsWith("/api/saved-items/")) {
    return DEMO_SAVED_ITEMS;
  }
  if (
    method === "POST" &&
    (pathOnly === "/api/saved-careers" ||
      pathOnly === "/api/saved-colleges" ||
      pathOnly === "/api/saved-scholarships")
  ) {
    return { duplicate: false };
  }
  if (
    (method === "DELETE" || method === "PATCH") &&
    /^\/api\/saved-(careers|colleges|scholarships)\//.test(pathOnly)
  ) {
    return {};
  }

  // --- Career match (mutation triggered by Careers tab) ---
  if (method === "POST" && pathOnly === "/api/hybrid-career-match") {
    return DEMO_HYBRID_MATCH;
  }

  // --- Scholarships ---
  if (method === "GET" && pathOnly === "/api/scholarships") {
    return DEMO_SCHOLARSHIPS_LIST;
  }
  if (method === "GET" && /^\/api\/scholarships\/\d+$/.test(pathOnly)) {
    const idStr = pathOnly.split("/").pop();
    const id = Number(idStr);
    return DEMO_SCHOLARSHIPS_LIST.find((s) => s.id === id) ?? null;
  }
  if (method === "GET" && pathOnly.startsWith("/api/scholarships/search/")) {
    const q = decodeURIComponent(pathOnly.slice("/api/scholarships/search/".length))
      .toLowerCase()
      .trim();
    return DEMO_SCHOLARSHIPS_LIST.filter((s) =>
      (s.name as string).toLowerCase().includes(q),
    );
  }

  // --- Dynamic options for Careers picker ---
  if (method === "GET" && pathOnly === "/api/dynamic-skills")
    return DEMO_DYNAMIC_SKILLS;
  if (method === "GET" && pathOnly === "/api/dynamic-interests")
    return DEMO_DYNAMIC_INTERESTS;

  // --- Colleges ---
  if (method === "GET" && pathOnly.startsWith("/api/colleges/")) {
    const id = decodeURIComponent(pathOnly.slice("/api/colleges/".length));
    return DEMO_COLLEGES[id] ?? DEMO_COLLEGES.stanford;
  }
  if (method === "GET" && pathOnly === "/api/colleges") {
    void query; // placeholder for future search filters
    return Object.values(DEMO_COLLEGES);
  }

  return undefined;
}
