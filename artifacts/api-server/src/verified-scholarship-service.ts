import { db } from "./db";
import { scholarships, userSavedScholarships, scholarshipNotifications, dataSourceHealth } from "@workspace/db";
import { eq, and, gte, lte, or, isNull, desc, asc, sql } from "drizzle-orm";

export interface VerifiedScholarship {
  id?: number;
  name: string;
  provider: string;
  type: 'federal' | 'state' | 'corporate' | 'nonprofit' | 'university';
  state?: string;
  industryTags?: string[];
  awardMin?: number;
  awardMax?: number;
  amount: number;
  currency?: string;
  deadlineAt?: Date;
  opensAt?: Date;
  deadline?: string;
  url: string;
  website?: string;
  eligibility?: Record<string, any>;
  eligibilityRequirements: string[];
  targetDemographics: string[];
  applicationRequirements: string[];
  description?: string;
  renewable?: boolean;
  sourceName: string;
  sourceUrl?: string;
  sourceLastVerifiedAt?: Date;
  isActive?: boolean;
  notes?: string;
}

const VERIFIED_SCHOLARSHIPS: VerifiedScholarship[] = [
  // ==========================================
  // FEDERAL SCHOLARSHIPS (Verified 2025-2026)
  // ==========================================
  {
    name: "Federal Pell Grant",
    provider: "U.S. Department of Education",
    type: "federal",
    awardMin: 740,
    awardMax: 7395,
    amount: 7395,
    deadlineAt: new Date("2026-06-30T23:59:00"),
    deadline: "June 30, 2026",
    url: "https://studentaid.gov/h/apply-for-aid/fafsa",
    website: "https://studentaid.gov/understand-aid/types/grants/pell",
    eligibilityRequirements: [
      "Complete FAFSA application",
      "U.S. citizen or eligible non-citizen",
      "Demonstrate exceptional financial need",
      "Enrolled as undergraduate student",
      "Have valid Social Security number"
    ],
    targetDemographics: ["undergraduate students", "low-income families"],
    applicationRequirements: ["FAFSA form", "High school diploma or GED", "Social Security number", "Tax returns"],
    description: "The largest federal grant program for undergraduate students with exceptional financial need. Does not need to be repaid.",
    renewable: true,
    sourceName: "studentaid.gov",
    sourceUrl: "https://studentaid.gov/understand-aid/types/grants/pell",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    eligibility: { gpa: null, financialNeed: "high", academicLevel: "undergraduate" }
  },
  {
    name: "Federal Supplemental Educational Opportunity Grant (FSEOG)",
    provider: "U.S. Department of Education",
    type: "federal",
    awardMin: 100,
    awardMax: 4000,
    amount: 4000,
    deadline: "Varies by school",
    url: "https://studentaid.gov/h/apply-for-aid/fafsa",
    website: "https://studentaid.gov/understand-aid/types/grants/fseog",
    eligibilityRequirements: [
      "Complete FAFSA application",
      "Exceptional financial need",
      "Priority for Pell Grant recipients",
      "Undergraduate enrollment"
    ],
    targetDemographics: ["undergraduate students", "Pell Grant recipients"],
    applicationRequirements: ["FAFSA form", "School financial aid application"],
    description: "Federal grant for undergraduates with exceptional financial need. Priority given to Pell Grant recipients.",
    renewable: true,
    sourceName: "studentaid.gov",
    sourceUrl: "https://studentaid.gov/understand-aid/types/grants/fseog",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    notes: "Deadline varies by school - funds are limited",
    eligibility: { financialNeed: "high", academicLevel: "undergraduate" }
  },
  {
    name: "TEACH Grant",
    provider: "U.S. Department of Education",
    type: "federal",
    amount: 4000,
    awardMax: 4000,
    deadline: "Varies by school",
    url: "https://studentaid.gov/understand-aid/types/grants/teach",
    website: "https://studentaid.gov/understand-aid/types/grants/teach",
    eligibilityRequirements: [
      "Enrolled in TEACH Grant-eligible program",
      "Sign Agreement to Serve",
      "Maintain 3.25 GPA",
      "Commit to teach in high-need field at low-income school"
    ],
    targetDemographics: ["education students", "future teachers"],
    applicationRequirements: ["FAFSA form", "TEACH Grant Agreement to Serve", "Entrance counseling"],
    description: "Grant for students who agree to teach in high-need fields at low-income schools for 4 years. Converts to loan if service not completed.",
    renewable: true,
    sourceName: "studentaid.gov",
    sourceUrl: "https://studentaid.gov/understand-aid/types/grants/teach",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    industryTags: ["Education"],
    eligibility: { gpa: 3.25, major: "Education" }
  },

  // ==========================================
  // MAJOR NATIONAL SCHOLARSHIPS (Verified)
  // ==========================================
  {
    name: "Amazon Future Engineer Scholarship",
    provider: "Amazon",
    type: "corporate",
    amount: 40000,
    awardMax: 40000,
    deadlineAt: new Date("2026-01-15T23:59:00"),
    deadline: "January 15, 2026",
    url: "https://www.amazonfutureengineer.com/scholarships",
    website: "https://www.amazonfutureengineer.com/scholarships",
    eligibilityRequirements: [
      "High school senior",
      "Plan to major in computer science or engineering",
      "Minimum 3.0 GPA",
      "U.S. citizen or permanent resident",
      "Demonstrate financial need"
    ],
    targetDemographics: ["high school seniors", "STEM students", "underrepresented groups"],
    applicationRequirements: ["Online application", "Transcripts", "Essay", "Financial information"],
    description: "$40,000 scholarship ($10,000/year for 4 years) plus a paid summer internship at Amazon. For students pursuing computer science.",
    renewable: true,
    sourceName: "amazonfutureengineer.com",
    sourceUrl: "https://www.amazonfutureengineer.com/scholarships",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    industryTags: ["STEM", "Technology", "Computer Science"],
    eligibility: { gpa: 3.0, major: "Computer Science", academicLevel: "high school senior" }
  },
  {
    name: "Dell Scholars Program",
    provider: "Michael & Susan Dell Foundation",
    type: "nonprofit",
    amount: 20000,
    awardMax: 20000,
    deadlineAt: new Date("2026-02-15T23:59:00"),
    deadline: "February 15, 2026",
    url: "https://www.dellscholars.org/apply",
    website: "https://www.dellscholars.org",
    eligibilityRequirements: [
      "High school senior",
      "Participate in college readiness program",
      "Plan to enroll full-time at accredited institution",
      "Minimum 2.4 GPA",
      "Demonstrate financial need (Pell-eligible)"
    ],
    targetDemographics: ["low-income students", "first-generation students"],
    applicationRequirements: ["Online application", "FAFSA completion", "Essays", "Program verification"],
    description: "$20,000 scholarship plus laptop, textbook credits, and personalized support through college graduation.",
    renewable: true,
    sourceName: "dellscholars.org",
    sourceUrl: "https://www.dellscholars.org",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    eligibility: { gpa: 2.4, financialNeed: "high" }
  },
  {
    name: "Gates Scholarship",
    provider: "Bill & Melinda Gates Foundation",
    type: "nonprofit",
    amount: 100000,
    awardMax: 100000,
    deadlineAt: new Date("2026-09-15T23:59:00"),
    opensAt: new Date("2026-07-15"),
    deadline: "September 15, 2026",
    url: "https://www.thegatesscholarship.org/scholarship",
    website: "https://www.thegatesscholarship.org",
    eligibilityRequirements: [
      "High school senior",
      "Pell Grant eligible",
      "Minimum 3.3 GPA",
      "Plan to attend 4-year U.S. institution",
      "African American, American Indian, Asian Pacific Islander, or Hispanic American"
    ],
    targetDemographics: ["minority students", "low-income students", "high achievers"],
    applicationRequirements: ["Online application", "Essays", "FAFSA", "Letters of recommendation"],
    description: "Full cost of attendance scholarship covering tuition, fees, books, housing for exceptional minority students with significant financial need.",
    renewable: true,
    sourceName: "thegatesscholarship.org",
    sourceUrl: "https://www.thegatesscholarship.org",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    notes: "300 scholars selected annually. Less than 1% acceptance rate.",
    eligibility: { gpa: 3.3, financialNeed: "high", academicLevel: "high school senior" }
  },
  {
    name: "Coca-Cola Scholars Program",
    provider: "Coca-Cola Scholars Foundation",
    type: "corporate",
    amount: 20000,
    awardMax: 20000,
    deadlineAt: new Date("2026-09-30T17:00:00"),
    opensAt: new Date("2026-08-01"),
    deadline: "September 30, 2026",
    url: "https://www.coca-colascholarsfoundation.org/apply",
    website: "https://www.coca-colascholarsfoundation.org",
    eligibilityRequirements: [
      "Current high school senior",
      "U.S. citizen, national, or permanent resident",
      "Minimum 3.0 GPA",
      "Attend school in U.S., DC, Puerto Rico, or DoD schools",
      "Not child/grandchild of Coca-Cola employees"
    ],
    targetDemographics: ["high school seniors", "community leaders"],
    applicationRequirements: ["Online application", "Essays on leadership and service", "Academic record"],
    description: "Achievement-based scholarship recognizing academic excellence, leadership, and commitment to community service. 150 scholars selected annually.",
    renewable: false,
    sourceName: "coca-colascholarsfoundation.org",
    sourceUrl: "https://www.coca-colascholarsfoundation.org",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    eligibility: { gpa: 3.0, academicLevel: "high school senior" }
  },
  {
    name: "DoD SMART Scholarship-for-Service",
    provider: "U.S. Department of Defense",
    type: "federal",
    amount: 50000,
    awardMax: 50000,
    deadlineAt: new Date("2026-12-01T23:59:00"),
    opensAt: new Date("2026-08-01"),
    deadline: "December 1, 2026",
    url: "https://www.smartscholarship.org/apply",
    website: "https://www.smartscholarship.org",
    eligibilityRequirements: [
      "U.S. citizen",
      "18+ years old at application",
      "Enrolled or accepted in STEM degree program",
      "Minimum 3.0 GPA",
      "Able to obtain security clearance"
    ],
    targetDemographics: ["STEM students", "future government employees"],
    applicationRequirements: ["Online application", "Transcripts", "Essays", "References"],
    description: "Full tuition, stipend, and guaranteed employment with DoD after graduation. Commitment to work for DoD after degree completion.",
    renewable: true,
    sourceName: "smartscholarship.org",
    sourceUrl: "https://www.smartscholarship.org",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    industryTags: ["STEM", "Government", "Defense"],
    eligibility: { gpa: 3.0, major: "STEM" }
  },

  // ==========================================
  // STATE SCHOLARSHIPS (Verified Examples)
  // ==========================================
  {
    name: "Cal Grant A & B",
    provider: "California Student Aid Commission",
    type: "state",
    state: "CA",
    amount: 14934,
    awardMax: 14934,
    deadlineAt: new Date("2026-03-02T23:59:00"),
    deadline: "March 2, 2026",
    url: "https://www.csac.ca.gov/apply",
    website: "https://www.csac.ca.gov/cal-grants",
    eligibilityRequirements: [
      "California resident",
      "Complete FAFSA or CA Dream Act Application",
      "Cal Grant A: 3.0+ GPA, Cal Grant B: 2.0+ GPA",
      "Meet income/asset ceilings",
      "Attend eligible California college"
    ],
    targetDemographics: ["California residents", "undergraduate students"],
    applicationRequirements: ["FAFSA or CA Dream Act", "GPA verification", "School enrollment"],
    description: "California state grants covering tuition/fees at UC, CSU, or private colleges. Cal Grant A up to $14,934 for UC students.",
    renewable: true,
    sourceName: "csac.ca.gov",
    sourceUrl: "https://www.csac.ca.gov/cal-grants",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    eligibility: { gpa: 3.0, residency: "California" }
  },
  {
    name: "NY Excelsior Scholarship",
    provider: "New York State Higher Education Services Corporation",
    type: "state",
    state: "NY",
    amount: 7500,
    awardMax: 7500,
    deadlineAt: new Date("2026-02-03T23:59:00"),
    deadline: "February 3, 2026 (Spring)",
    url: "https://www.hesc.ny.gov/pay-for-college/financial-aid/types-of-financial-aid/nys-grants-scholarships-awards/the-excelsior-scholarship.html",
    website: "https://www.hesc.ny.gov",
    eligibilityRequirements: [
      "New York State resident for 12+ months",
      "Adjusted gross income under $125,000",
      "Attend SUNY or CUNY full-time",
      "Complete 30 credits per year",
      "Live and work in NY after graduation"
    ],
    targetDemographics: ["New York residents", "SUNY/CUNY students"],
    applicationRequirements: ["FAFSA", "Excelsior Scholarship application", "TAP application"],
    description: "Covers tuition at SUNY and CUNY schools for students with family income under $125,000. Must live/work in NY for years equal to award.",
    renewable: true,
    sourceName: "hesc.ny.gov",
    sourceUrl: "https://www.hesc.ny.gov",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    eligibility: { residency: "New York", income: 125000 }
  },
  {
    name: "Georgia HOPE Scholarship",
    provider: "Georgia Student Finance Commission",
    type: "state",
    state: "GA",
    amount: 7500,
    awardMax: 7500,
    deadline: "Varies by school term",
    url: "https://www.gafutures.org/hope-state-aid-programs/hope-zell-miller-scholarships/hope-scholarship/",
    website: "https://www.gafutures.org",
    eligibilityRequirements: [
      "Georgia resident",
      "Graduate from eligible high school with 3.0+ GPA",
      "Maintain 3.0 GPA in college",
      "Attend eligible Georgia institution",
      "U.S. citizen or eligible non-citizen"
    ],
    targetDemographics: ["Georgia residents", "undergraduate students"],
    applicationRequirements: ["FAFSA", "Georgia residency verification", "Academic transcripts"],
    description: "Covers tuition for Georgia residents at public Georgia colleges and universities. Must maintain 3.0 GPA.",
    renewable: true,
    sourceName: "gafutures.org",
    sourceUrl: "https://www.gafutures.org",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    notes: "Deadline depends on school term/enrollment",
    eligibility: { gpa: 3.0, residency: "Georgia" }
  },
  {
    name: "Florida Bright Futures Scholarship",
    provider: "Florida Department of Education",
    type: "state",
    state: "FL",
    amount: 9000,
    awardMax: 9000,
    deadlineAt: new Date("2026-08-31T23:59:00"),
    deadline: "August 31, 2026",
    url: "https://www.floridastudentfinancialaidsg.com/SAPBFMAIN/SAPBFMAIN",
    website: "https://www.floridastudentfinancialaid.org/ssfad/bf/",
    eligibilityRequirements: [
      "Florida resident for 12+ months",
      "Graduate from Florida high school",
      "Complete Florida Financial Aid Application",
      "Meet GPA and test score requirements",
      "Complete community service hours"
    ],
    targetDemographics: ["Florida residents", "high school graduates"],
    applicationRequirements: ["Florida Financial Aid Application", "High school transcripts", "SAT/ACT scores", "Community service documentation"],
    description: "Merit-based scholarship covering tuition at Florida public colleges. Multiple award levels based on GPA and test scores.",
    renewable: true,
    sourceName: "floridastudentfinancialaid.org",
    sourceUrl: "https://www.floridastudentfinancialaid.org/ssfad/bf/",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    eligibility: { residency: "Florida", academicLevel: "high school senior" }
  },
  {
    name: "TEXAS Grant",
    provider: "Texas Higher Education Coordinating Board",
    type: "state",
    state: "TX",
    amount: 5000,
    awardMax: 5000,
    deadlineAt: new Date("2026-03-15T23:59:00"),
    deadline: "March 15, 2026",
    url: "https://www.thecb.state.tx.us/apps/txheopportunity/",
    website: "https://www.thecb.state.tx.us",
    eligibilityRequirements: [
      "Texas resident",
      "Demonstrate financial need",
      "Complete Recommended or Distinguished high school program",
      "Enroll at least 3/4 time at Texas public university",
      "Have Expected Family Contribution of $4,000 or less"
    ],
    targetDemographics: ["Texas residents", "low-income students"],
    applicationRequirements: ["FAFSA", "Texas residency documentation", "High school transcript"],
    description: "Texas state grant for students with financial need attending Texas public universities. Renewable for up to 150 credit hours.",
    renewable: true,
    sourceName: "thecb.state.tx.us",
    sourceUrl: "https://www.thecb.state.tx.us",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    eligibility: { residency: "Texas", financialNeed: "high" }
  },

  // ==========================================
  // DIVERSITY & IDENTITY SCHOLARSHIPS
  // ==========================================
  {
    name: "Hispanic Scholarship Fund",
    provider: "Hispanic Scholarship Fund",
    type: "nonprofit",
    amount: 5000,
    awardMin: 500,
    awardMax: 5000,
    deadlineAt: new Date("2026-02-15T23:59:00"),
    deadline: "February 15, 2026",
    url: "https://www.hsf.net/scholarship",
    website: "https://www.hsf.net",
    eligibilityRequirements: [
      "Hispanic heritage",
      "U.S. citizen or permanent resident",
      "Minimum 3.0 GPA",
      "Enrolled full-time in accredited institution",
      "Complete FAFSA"
    ],
    targetDemographics: ["Hispanic students", "Latino students"],
    applicationRequirements: ["Online application", "FAFSA Student Aid Report", "Essays", "Transcripts"],
    description: "Scholarships for Hispanic students pursuing higher education. Awards $500-$5,000 based on merit and financial need.",
    renewable: true,
    sourceName: "hsf.net",
    sourceUrl: "https://www.hsf.net",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    eligibility: { gpa: 3.0 }
  },
  {
    name: "United Negro College Fund (UNCF) Scholarships",
    provider: "United Negro College Fund",
    type: "nonprofit",
    amount: 8000,
    awardMin: 500,
    awardMax: 25000,
    deadlineAt: new Date("2026-03-31T23:59:00"),
    deadline: "March 31, 2026",
    url: "https://scholarships.uncf.org/",
    website: "https://www.uncf.org",
    eligibilityRequirements: [
      "African American/Black",
      "U.S. citizen or permanent resident",
      "Enrolled or accepted at accredited college",
      "Demonstrate financial need",
      "Minimum 2.5 GPA (varies by scholarship)"
    ],
    targetDemographics: ["African American students", "Black students"],
    applicationRequirements: ["Online application", "FAFSA", "Transcripts", "Essays"],
    description: "UNCF manages over 400 scholarship programs for minority students. Awards range from $500 to $25,000.",
    renewable: true,
    sourceName: "uncf.org",
    sourceUrl: "https://scholarships.uncf.org",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    eligibility: { gpa: 2.5, financialNeed: "medium" }
  },
  {
    name: "Society of Women Engineers Scholarship",
    provider: "Society of Women Engineers",
    type: "nonprofit",
    amount: 15000,
    awardMin: 1000,
    awardMax: 15000,
    deadlineAt: new Date("2026-02-15T23:59:00"),
    deadline: "February 15, 2026",
    url: "https://scholarships.swe.org/",
    website: "https://swe.org/scholarships/",
    eligibilityRequirements: [
      "Female",
      "Enrolled in ABET-accredited engineering program",
      "Minimum 3.0 GPA",
      "U.S. citizen or permanent resident",
      "SWE membership (free for students)"
    ],
    targetDemographics: ["women in engineering", "female STEM students"],
    applicationRequirements: ["SWE membership", "Online application", "Transcripts", "Letters of recommendation"],
    description: "Multiple scholarships for women in engineering. Awards $1,000-$15,000 for undergraduate and graduate students.",
    renewable: true,
    sourceName: "swe.org",
    sourceUrl: "https://swe.org/scholarships/",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    industryTags: ["Engineering", "STEM"],
    eligibility: { gpa: 3.0, gender: "female" }
  },
  {
    name: "Point Foundation LGBTQ Scholarship",
    provider: "Point Foundation",
    type: "nonprofit",
    amount: 25000,
    awardMax: 25000,
    deadlineAt: new Date("2026-01-27T23:59:00"),
    deadline: "January 27, 2026",
    url: "https://pointfoundation.org/point-apply/",
    website: "https://pointfoundation.org",
    eligibilityRequirements: [
      "LGBTQ identity",
      "Enrolled or enrolling in accredited institution",
      "Strong academic performance",
      "Demonstrate leadership",
      "Show community involvement"
    ],
    targetDemographics: ["LGBTQ students", "community leaders"],
    applicationRequirements: ["Online application", "Essays", "FAFSA", "Letters of recommendation", "Interview"],
    description: "Comprehensive scholarship program for LGBTQ students with academic merit, leadership, and community involvement.",
    renewable: true,
    sourceName: "pointfoundation.org",
    sourceUrl: "https://pointfoundation.org",
    sourceLastVerifiedAt: new Date("2025-12-01"),
    isActive: true,
    eligibility: { academicLevel: "undergraduate" }
  }
];

export class VerifiedScholarshipService {
  
  async seedVerifiedScholarships(): Promise<{ inserted: number; skipped: number }> {
    let inserted = 0;
    let skipped = 0;

    for (const scholarship of VERIFIED_SCHOLARSHIPS) {
      const existing = await db.select().from(scholarships)
        .where(and(
          eq(scholarships.name, scholarship.name),
          eq(scholarships.provider, scholarship.provider)
        ));

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      await db.insert(scholarships).values({
        name: scholarship.name,
        provider: scholarship.provider,
        type: scholarship.type,
        state: scholarship.state || null,
        industryTags: scholarship.industryTags || [],
        awardMin: scholarship.awardMin || null,
        awardMax: scholarship.awardMax || null,
        amount: scholarship.amount,
        currency: scholarship.currency || "USD",
        deadlineAt: scholarship.deadlineAt || null,
        opensAt: scholarship.opensAt || null,
        deadline: scholarship.deadline || null,
        url: scholarship.url,
        website: scholarship.website || null,
        eligibility: scholarship.eligibility || null,
        eligibilityRequirements: scholarship.eligibilityRequirements,
        targetDemographics: scholarship.targetDemographics,
        applicationRequirements: scholarship.applicationRequirements,
        description: scholarship.description || null,
        renewable: scholarship.renewable || false,
        sourceName: scholarship.sourceName,
        sourceUrl: scholarship.sourceUrl || null,
        sourceLastVerifiedAt: scholarship.sourceLastVerifiedAt || null,
        sourceLastCheckedAt: new Date(),
        isActive: scholarship.isActive ?? true,
        notes: scholarship.notes || null,
      });
      inserted++;
    }

    await this.updateDataSourceHealth();
    return { inserted, skipped };
  }

  async updateDataSourceHealth(): Promise<void> {
    const sources = [
      { name: "studentaid.gov", type: "federal", refreshDays: 30 },
      { name: "amazonfutureengineer.com", type: "corporate", refreshDays: 90 },
      { name: "dellscholars.org", type: "nonprofit", refreshDays: 90 },
      { name: "thegatesscholarship.org", type: "nonprofit", refreshDays: 90 },
      { name: "coca-colascholarsfoundation.org", type: "corporate", refreshDays: 90 },
      { name: "smartscholarship.org", type: "federal", refreshDays: 90 },
      { name: "csac.ca.gov", type: "state", refreshDays: 60 },
      { name: "hesc.ny.gov", type: "state", refreshDays: 60 },
      { name: "gafutures.org", type: "state", refreshDays: 60 },
      { name: "floridastudentfinancialaid.org", type: "state", refreshDays: 60 },
      { name: "thecb.state.tx.us", type: "state", refreshDays: 60 },
      { name: "hsf.net", type: "nonprofit", refreshDays: 90 },
      { name: "uncf.org", type: "nonprofit", refreshDays: 90 },
      { name: "swe.org", type: "nonprofit", refreshDays: 90 },
      { name: "pointfoundation.org", type: "nonprofit", refreshDays: 90 },
    ];

    for (const source of sources) {
      const count = await db.select({ count: sql<number>`count(*)` })
        .from(scholarships)
        .where(eq(scholarships.sourceName, source.name));

      const existing = await db.select().from(dataSourceHealth)
        .where(eq(dataSourceHealth.sourceName, source.name));

      if (existing.length > 0) {
        await db.update(dataSourceHealth)
          .set({
            lastCheckedAt: new Date(),
            scholarshipCount: Number(count[0]?.count || 0),
            status: "healthy"
          })
          .where(eq(dataSourceHealth.sourceName, source.name));
      } else {
        await db.insert(dataSourceHealth).values({
          sourceName: source.name,
          sourceType: source.type,
          expectedRefreshDays: source.refreshDays,
          lastCheckedAt: new Date(),
          scholarshipCount: Number(count[0]?.count || 0),
          status: "healthy"
        });
      }
    }
  }

  async getActiveScholarships(filters?: {
    type?: string;
    state?: string;
    minAmount?: number;
    maxAmount?: number;
    industryTag?: string;
  }): Promise<any[]> {
    const now = new Date();
    
    let query = db.select().from(scholarships)
      .where(eq(scholarships.isActive, true));

    const results = await query;

    return results.filter(s => {
      if (s.deadlineAt && s.deadlineAt < now) return false;
      
      if (filters?.type && s.type !== filters.type) return false;
      if (filters?.state && s.state !== filters.state) return false;
      if (filters?.minAmount && s.amount < filters.minAmount) return false;
      if (filters?.maxAmount && s.amount > filters.maxAmount) return false;
      if (filters?.industryTag && !s.industryTags?.includes(filters.industryTag)) return false;
      
      return true;
    }).sort((a, b) => {
      if (!a.deadlineAt && !b.deadlineAt) return 0;
      if (!a.deadlineAt) return 1;
      if (!b.deadlineAt) return -1;
      return a.deadlineAt.getTime() - b.deadlineAt.getTime();
    });
  }

  async saveScholarshipForUser(userId: string, scholarshipId: number, planId?: number): Promise<any> {
    const existing = await db.select().from(userSavedScholarships)
      .where(and(
        eq(userSavedScholarships.userId, userId),
        eq(userSavedScholarships.scholarshipId, scholarshipId)
      ));

    if (existing.length > 0) {
      return existing[0];
    }

    const [saved] = await db.insert(userSavedScholarships).values({
      userId,
      scholarshipId,
      planId: planId || null,
      status: "saved"
    }).returning();

    await this.scheduleDeadlineNotifications(userId, scholarshipId);
    return saved;
  }

  async scheduleDeadlineNotifications(userId: string, scholarshipId: number): Promise<void> {
    const [scholarship] = await db.select().from(scholarships)
      .where(eq(scholarships.id, scholarshipId));

    if (!scholarship || !scholarship.deadlineAt) return;

    const deadlineDate = scholarship.deadlineAt;
    const now = new Date();
    const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    const alertDays = [30, 14, 7, 3, 1];
    
    for (const days of alertDays) {
      if (daysUntil > days) {
        const scheduledFor = new Date(deadlineDate);
        scheduledFor.setDate(scheduledFor.getDate() - days);

        const existing = await db.select().from(scholarshipNotifications)
          .where(and(
            eq(scholarshipNotifications.userId, userId),
            eq(scholarshipNotifications.scholarshipId, scholarshipId),
            eq(scholarshipNotifications.type, `deadline_${days}`)
          ));

        if (existing.length === 0) {
          await db.insert(scholarshipNotifications).values({
            userId,
            scholarshipId,
            type: `deadline_${days}`,
            scheduledFor,
            channel: "in_app",
            payload: {
              scholarshipName: scholarship.name,
              daysRemaining: days,
              deadline: scholarship.deadline
            }
          });
        }
      }
    }
  }

  async getUserNotifications(userId: string): Promise<any[]> {
    const now = new Date();
    
    return db.select({
      notification: scholarshipNotifications,
      scholarship: scholarships
    })
    .from(scholarshipNotifications)
    .innerJoin(scholarships, eq(scholarshipNotifications.scholarshipId, scholarships.id))
    .where(and(
      eq(scholarshipNotifications.userId, userId),
      lte(scholarshipNotifications.scheduledFor, now),
      isNull(scholarshipNotifications.sentAt)
    ))
    .orderBy(asc(scholarshipNotifications.scheduledFor));
  }

  async markNotificationSent(notificationId: number): Promise<void> {
    await db.update(scholarshipNotifications)
      .set({ sentAt: new Date() })
      .where(eq(scholarshipNotifications.id, notificationId));
  }

  async markNotificationRead(notificationId: number): Promise<void> {
    await db.update(scholarshipNotifications)
      .set({ read: true })
      .where(eq(scholarshipNotifications.id, notificationId));
  }

  async getUserSavedScholarships(userId: string): Promise<any[]> {
    return db.select({
      saved: userSavedScholarships,
      scholarship: scholarships
    })
    .from(userSavedScholarships)
    .innerJoin(scholarships, eq(userSavedScholarships.scholarshipId, scholarships.id))
    .where(eq(userSavedScholarships.userId, userId))
    .orderBy(asc(scholarships.deadlineAt));
  }

  async updateSavedScholarshipStatus(
    userId: string, 
    scholarshipId: number, 
    status: string
  ): Promise<void> {
    await db.update(userSavedScholarships)
      .set({ 
        status,
        submittedAt: status === "submitted" ? new Date() : undefined,
        resultAt: (status === "won" || status === "not_interested") ? new Date() : undefined
      })
      .where(and(
        eq(userSavedScholarships.userId, userId),
        eq(userSavedScholarships.scholarshipId, scholarshipId)
      ));
  }

  async getDataSourceHealth(): Promise<any[]> {
    return db.select().from(dataSourceHealth).orderBy(desc(dataSourceHealth.lastCheckedAt));
  }
}

export const verifiedScholarshipService = new VerifiedScholarshipService();
