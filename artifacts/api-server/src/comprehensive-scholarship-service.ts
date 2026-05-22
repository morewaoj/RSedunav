import { type InsertScholarship } from "@workspace/db";
import { getDeadlineStatus, sortByDeadlineUrgency, type DeadlineStatus } from "./shared/scholarship-utils";

export interface ScholarshipFilters {
  type?: string;
  minAmount?: number;
  maxAmount?: number;
  renewable?: boolean;
  provider?: string;
  targetDemographic?: string;
  state?: string;
  field?: string;
  excludeExpired?: boolean;
  urgencyFilter?: 'all' | 'urgent' | 'closing-soon' | 'upcoming';
}

export interface ScholarshipWithStatus extends InsertScholarship {
  deadlineStatus: DeadlineStatus;
}

export class ComprehensiveScholarshipService {
  getAuthenticScholarships(): InsertScholarship[] {
    return [
      // ============================================
      // FEDERAL SCHOLARSHIPS & GRANTS (2025-2026)
      // ============================================
      {
        name: "Pell Grant",
        amount: 7395,
        type: "need-based",
        eligibilityRequirements: ["FAFSA completion", "U.S. citizenship or eligible non-citizen", "Exceptional financial need", "Undergraduate enrollment"],
        deadline: "June 30, 2026",
        renewable: true,
        provider: "U.S. Department of Education",
        url: "https://studentaid.gov/understand-aid/types/grants/pell",

        website: "https://studentaid.gov/understand-aid/types/grants/pell",
        description: "Federal grant for undergraduate students with exceptional financial need. Does not need to be repaid.",
        targetDemographics: ["undergraduate students", "low-income families"],
        applicationRequirements: ["FAFSA form", "High school diploma or GED", "Social Security card", "Tax returns"]
      },
      {
        name: "Federal Supplemental Educational Opportunity Grant (FSEOG)",
        amount: 4000,
        type: "need-based",
        eligibilityRequirements: ["FAFSA completion", "Exceptional financial need", "Pell Grant recipient priority", "Undergraduate status"],
        deadline: "Varies by school",
        renewable: true,
        provider: "U.S. Department of Education",
        url: "https://studentaid.gov/understand-aid/types/grants/fseog",

        website: "https://studentaid.gov/understand-aid/types/grants/fseog",
        description: "Federal grant for undergraduates with exceptional financial need, priority given to Pell Grant recipients.",
        targetDemographics: ["undergraduate students", "Pell Grant recipients"],
        applicationRequirements: ["FAFSA form", "School financial aid application", "Verification documents"]
      },
      {
        name: "TEACH Grant",
        amount: 4000,
        type: "service-based",
        eligibilityRequirements: ["Teaching commitment agreement", "High-need field", "Low-income school service", "3.25 GPA minimum"],
        deadline: "Varies by school",
        renewable: true,
        provider: "U.S. Department of Education",
        url: "https://studentaid.gov/understand-aid/types/grants/teach",

        website: "https://studentaid.gov/understand-aid/types/grants/teach",
        description: "Grant for students who agree to teach in high-need fields at low-income schools for four years.",
        targetDemographics: ["education students", "future teachers"],
        applicationRequirements: ["FAFSA form", "TEACH Grant Agreement to Serve", "Entrance counseling"]
      },
      {
        name: "Iraq and Afghanistan Service Grant",
        amount: 7395,
        type: "service-based",
        eligibilityRequirements: ["Parent/guardian died in Iraq/Afghanistan service", "Under 24 or enrolled when parent died", "Not Pell eligible due to low EFC"],
        deadline: "June 30, 2026",
        renewable: true,
        provider: "U.S. Department of Education",
        url: "https://studentaid.gov/understand-aid/types/grants/iraq-afghanistan-service",

        website: "https://studentaid.gov/understand-aid/types/grants/iraq-afghanistan-service",
        description: "Grant for students whose parent or guardian died as a result of military service in Iraq or Afghanistan after 9/11.",
        targetDemographics: ["military families", "children of deceased veterans"],
        applicationRequirements: ["FAFSA form", "Death certificate", "Military service documentation"]
      },
      {
        name: "Federal Work-Study Program",
        amount: 4000,
        type: "need-based",
        eligibilityRequirements: ["Financial need", "Undergraduate or graduate status", "Part-time work commitment"],
        deadline: "Varies by school",
        renewable: true,
        provider: "U.S. Department of Education",
        url: "https://studentaid.gov/understand-aid/types/work-study",

        website: "https://studentaid.gov/understand-aid/types/work-study",
        description: "Federal program providing part-time employment for students with financial need.",
        targetDemographics: ["undergraduate students", "graduate students", "low-income families"],
        applicationRequirements: ["FAFSA", "Work-study job application", "Employment eligibility verification"]
      },

      // ============================================
      // STATE SCHOLARSHIPS (2025-2026)
      // ============================================
      
      // California
      {
        name: "Cal Grant A",
        amount: 12570,
        type: "need-based",
        eligibilityRequirements: ["California residency", "Financial need", "GPA requirement", "UC or CSU enrollment"],
        deadline: "March 2, 2026",
        renewable: true,
        provider: "California Student Aid Commission",
        url: "https://www.csac.ca.gov/cal-grants",

        website: "https://www.csac.ca.gov/cal-grants",
        description: "California state grant for students attending University of California or California State University schools.",
        targetDemographics: ["California residents", "UC/CSU students"],
        applicationRequirements: ["FAFSA or CA Dream Act Application", "GPA verification", "School certification"]
      },
      {
        name: "Cal Grant B",
        amount: 1656,
        type: "need-based",
        eligibilityRequirements: ["California residency", "High financial need", "Disadvantaged background", "First-generation college"],
        deadline: "March 2, 2026",
        renewable: true,
        provider: "California Student Aid Commission",
        url: "https://www.csac.ca.gov/cal-grants",

        website: "https://www.csac.ca.gov/cal-grants",
        description: "California grant for disadvantaged students with living allowance and tuition assistance.",
        targetDemographics: ["California residents", "first-generation college students", "disadvantaged backgrounds"],
        applicationRequirements: ["FAFSA or CA Dream Act Application", "Income verification", "Academic records"]
      },

      // Texas
      {
        name: "TEXAS Grant",
        amount: 5000,
        type: "need-based",
        eligibilityRequirements: ["Texas residency", "Financial need", "Recommended high school program completion", "Public university enrollment"],
        deadline: "March 15, 2026",
        renewable: true,
        provider: "Texas Higher Education Coordinating Board",
        url: "https://www.tgslc.org/students-parents/grants-scholarships/texas-grant.cfm",

        website: "https://www.tgslc.org/students-parents/grants-scholarships/texas-grant.cfm",
        description: "Texas state grant for students with financial need attending Texas public universities.",
        targetDemographics: ["Texas residents", "public university students"],
        applicationRequirements: ["FAFSA", "High school transcript", "Texas residency documentation"]
      },
      {
        name: "Top 10% Scholarship (Texas)",
        amount: 2000,
        type: "merit-based",
        eligibilityRequirements: ["Texas residency", "Top 10% high school class rank", "Texas public university enrollment"],
        deadline: "May 1, 2026",
        renewable: true,
        provider: "Texas Higher Education Coordinating Board",
        url: "https://www.tgslc.org/students-parents/grants-scholarships/top-ten-percent-scholarship.cfm",

        website: "https://www.tgslc.org/students-parents/grants-scholarships/top-ten-percent-scholarship.cfm",
        description: "Texas scholarship for students graduating in the top 10% of their high school class.",
        targetDemographics: ["Texas residents", "high academic achievers"],
        applicationRequirements: ["High school transcript", "Class rank verification", "University application"]
      },

      // New York
      {
        name: "Tuition Assistance Program (TAP)",
        amount: 5665,
        type: "need-based",
        eligibilityRequirements: ["New York residency", "Family income under $80,000", "Approved NY institution", "Full-time enrollment"],
        deadline: "June 30, 2026",
        renewable: true,
        provider: "New York State Higher Education Services Corporation",
        url: "https://www.hesc.ny.gov/pay-for-college/apply-for-financial-aid/nys-tap.html",

        website: "https://www.hesc.ny.gov/pay-for-college/apply-for-financial-aid/nys-tap.html",
        description: "New York state grant for residents attending approved postsecondary institutions in New York.",
        targetDemographics: ["New York residents", "middle-income families"],
        applicationRequirements: ["FAFSA", "TAP application", "Income verification", "Academic progress verification"]
      },
      {
        name: "Excelsior Scholarship",
        amount: 5500,
        type: "need-based",
        eligibilityRequirements: ["New York residency", "Family income up to $125,000", "SUNY or CUNY enrollment", "Full-time study"],
        deadline: "June 30, 2026",
        renewable: true,
        provider: "New York State Higher Education Services Corporation",
        url: "https://www.hesc.ny.gov/pay-for-college/apply-for-financial-aid/nys-excelsior-scholarship.html",

        website: "https://www.hesc.ny.gov/pay-for-college/apply-for-financial-aid/nys-excelsior-scholarship.html",
        description: "New York scholarship covering tuition at SUNY and CUNY schools for middle-class families.",
        targetDemographics: ["New York residents", "SUNY/CUNY students", "middle-income families"],
        applicationRequirements: ["FAFSA", "TAP application", "Excelsior application", "Income documentation"]
      },

      // Georgia
      {
        name: "Georgia HOPE Scholarship",
        amount: 4000,
        type: "merit-based",
        eligibilityRequirements: ["Georgia resident", "High school GPA 3.0+", "Georgia high school diploma", "Full-time enrollment"],
        deadline: "Last day of classes",
        renewable: true,
        provider: "Georgia Student Finance Commission",
        url: "https://www.gafutures.org/hope-state-aid-programs/hope-scholarship/",

        website: "https://www.gafutures.org/hope-state-aid-programs/hope-scholarship/",
        description: "Georgia's lottery-funded merit scholarship for residents attending eligible colleges.",
        targetDemographics: ["Georgia residents", "undergraduate students"],
        applicationRequirements: ["FAFSA", "Georgia high school transcript", "Enrollment verification"]
      },
      {
        name: "Zell Miller Scholarship",
        amount: 5000,
        type: "merit-based",
        eligibilityRequirements: ["Georgia resident", "High school GPA 3.7+", "SAT 1200+ or ACT 26+", "Georgia high school diploma"],
        deadline: "Last day of classes",
        renewable: true,
        provider: "Georgia Student Finance Commission",
        url: "https://www.gafutures.org/hope-state-aid-programs/zell-miller-scholarship/",

        website: "https://www.gafutures.org/hope-state-aid-programs/zell-miller-scholarship/",
        description: "Georgia's premier merit scholarship covering full tuition at public colleges for top students.",
        targetDemographics: ["Georgia residents", "high achievers", "undergraduate students"],
        applicationRequirements: ["FAFSA", "Georgia high school transcript", "SAT/ACT scores", "Enrollment verification"]
      },

      // Florida
      {
        name: "Florida Bright Futures Scholarship",
        amount: 3200,
        type: "merit-based",
        eligibilityRequirements: ["Florida resident", "High school diploma", "SAT/ACT scores", "Community service hours"],
        deadline: "August 31, 2026",
        renewable: true,
        provider: "Florida Department of Education",
        url: "https://www.floridastudentfinancialaid.org/ssfad/bf/",

        website: "https://www.floridastudentfinancialaid.org/ssfad/bf/",
        description: "Florida's lottery-funded merit scholarship program for high school graduates.",
        targetDemographics: ["Florida residents", "high school graduates"],
        applicationRequirements: ["High school transcript", "SAT/ACT scores", "Community service documentation"]
      },

      // Other States
      {
        name: "Illinois Monetary Award Program (MAP)",
        amount: 4968,
        type: "need-based",
        eligibilityRequirements: ["Illinois resident", "U.S. citizen or permanent resident", "Financial need", "Undergraduate status"],
        deadline: "September 30, 2026",
        renewable: true,
        provider: "Illinois Student Assistance Commission",
        url: "https://www.isac.org/students/during-college/types-of-financial-aid/grants-scholarships/monetary-award-program/",

        website: "https://www.isac.org/students/during-college/types-of-financial-aid/grants-scholarships/monetary-award-program/",
        description: "Illinois state grant for undergraduate students with financial need.",
        targetDemographics: ["Illinois residents", "undergraduate students"],
        applicationRequirements: ["FAFSA", "Illinois residency verification", "Enrollment verification"]
      },
      {
        name: "Pennsylvania State Grant",
        amount: 4348,
        type: "need-based",
        eligibilityRequirements: ["Pennsylvania resident", "U.S. citizen or permanent resident", "Financial need", "Undergraduate status"],
        deadline: "May 1, 2026",
        renewable: true,
        provider: "Pennsylvania Higher Education Assistance Agency",
        url: "https://www.pheaa.org/funding-opportunities/state-grant-program/",

        website: "https://www.pheaa.org/funding-opportunities/state-grant-program/",
        description: "Pennsylvania state grant program for undergraduate students with financial need.",
        targetDemographics: ["Pennsylvania residents", "undergraduate students"],
        applicationRequirements: ["FAFSA", "PA residency verification", "Academic progress verification"]
      },
      {
        name: "North Carolina Need-Based Scholarship",
        amount: 7500,
        type: "need-based",
        eligibilityRequirements: ["North Carolina resident", "Exceptional financial need", "Full-time enrollment", "Academic progress"],
        deadline: "March 15, 2026",
        renewable: true,
        provider: "North Carolina State Education Assistance Authority",
        url: "https://www.cfnc.org/pay-for-college/apply-for-financial-aid/nc-financial-aid-programs/",

        website: "https://www.cfnc.org/pay-for-college/apply-for-financial-aid/nc-financial-aid-programs/",
        description: "North Carolina grant program for students with exceptional financial need.",
        targetDemographics: ["North Carolina residents", "undergraduate students"],
        applicationRequirements: ["FAFSA", "NC residency verification", "Income documentation"]
      },
      {
        name: "Ohio College Opportunity Grant",
        amount: 3000,
        type: "need-based",
        eligibilityRequirements: ["Ohio resident", "Financial need", "Undergraduate status", "Enrolled at eligible institution"],
        deadline: "October 1, 2026",
        renewable: true,
        provider: "Ohio Department of Higher Education",
        url: "https://www.ohiohighered.org/ocog",

        website: "https://www.ohiohighered.org/ocog",
        description: "Ohio state grant program for undergraduate students with financial need.",
        targetDemographics: ["Ohio residents", "undergraduate students"],
        applicationRequirements: ["FAFSA", "Ohio residency verification", "Enrollment confirmation"]
      },
      {
        name: "Michigan Competitive Scholarship",
        amount: 1000,
        type: "merit-based",
        eligibilityRequirements: ["Michigan resident", "ACT score 23+ or SAT 1200+", "Financial need", "Full-time enrollment"],
        deadline: "March 1, 2026",
        renewable: true,
        provider: "Michigan Department of Treasury",
        url: "https://www.michigan.gov/mistudentaid/grants-scholarships/michigan-competitive-scholarship",

        website: "https://www.michigan.gov/mistudentaid/grants-scholarships/michigan-competitive-scholarship",
        description: "Michigan merit-based scholarship for residents with financial need and academic achievement.",
        targetDemographics: ["Michigan residents", "undergraduate students"],
        applicationRequirements: ["FAFSA", "SAT/ACT scores", "Michigan residency verification"]
      },

      // ============================================
      // STEM SCHOLARSHIPS (2025-2026)
      // ============================================
      {
        name: "National Science Foundation Graduate Research Fellowship",
        amount: 37000,
        type: "merit-based",
        eligibilityRequirements: ["U.S. citizenship", "STEM field enrollment", "Graduate student status", "Research proposal"],
        deadline: "October 21, 2026",
        renewable: true,
        provider: "National Science Foundation",
        url: "https://www.nsfgrfp.org/",

        website: "https://www.nsfgrfp.org/",
        description: "Prestigious fellowship supporting graduate students in STEM fields with three years of funding.",
        targetDemographics: ["STEM graduate students", "researchers"],
        applicationRequirements: ["Research proposal", "Transcripts", "Letters of recommendation", "Personal statement"]
      },
      {
        name: "Society of Women Engineers Scholarship",
        amount: 15000,
        type: "merit-based",
        eligibilityRequirements: ["Female gender", "ABET-accredited engineering program", "Minimum 3.0 GPA", "SWE membership"],
        deadline: "February 15, 2026",
        renewable: true,
        provider: "Society of Women Engineers",
        url: "https://swe.org/scholarships/",

        website: "https://swe.org/scholarships/",
        description: "Scholarships for women pursuing engineering and technology degrees.",
        targetDemographics: ["women in engineering", "STEM students"],
        applicationRequirements: ["SWE membership", "Transcripts", "Essays", "Letters of recommendation"]
      },
      {
        name: "Google Lime Scholarship",
        amount: 10000,
        type: "merit-based",
        eligibilityRequirements: ["Disability status", "Computer science or related field", "Strong academic record", "Leadership experience"],
        deadline: "December 1, 2026",
        renewable: false,
        provider: "Google and Lime Connect",
        url: "https://www.limeconnect.com/opportunities/page/google-lime-scholarship",

        website: "https://www.limeconnect.com/opportunities/page/google-lime-scholarship",
        description: "Scholarship for students with disabilities pursuing computer science degrees.",
        targetDemographics: ["students with disabilities", "computer science students"],
        applicationRequirements: ["Disability documentation", "Transcripts", "Essays", "Resume"]
      },
      {
        name: "SMART Scholarship (Science, Mathematics & Research for Transformation)",
        amount: 25000,
        type: "service-based",
        eligibilityRequirements: ["U.S. citizenship", "STEM major", "GPA 3.0+", "Department of Defense service commitment"],
        deadline: "December 1, 2026",
        renewable: true,
        provider: "U.S. Department of Defense",
        url: "https://www.smartscholarship.org/",

        website: "https://www.smartscholarship.org/",
        description: "Full tuition, stipend, and guaranteed employment for STEM students committed to DoD service.",
        targetDemographics: ["STEM students", "future defense employees"],
        applicationRequirements: ["STEM enrollment verification", "Transcripts", "Essays", "Background check"]
      },

      // ============================================
      // HEALTHCARE SCHOLARSHIPS (2025-2026)
      // ============================================
      {
        name: "National Health Service Corps Scholarship",
        amount: 50000,
        type: "service-based",
        eligibilityRequirements: ["Health profession program", "Service commitment", "U.S. citizenship", "Academic performance"],
        deadline: "April 18, 2026",
        renewable: true,
        provider: "Health Resources and Services Administration",
        url: "https://nhsc.hrsa.gov/scholarships",

        website: "https://nhsc.hrsa.gov/scholarships",
        description: "Full tuition scholarship for health professional students who commit to serving in underserved areas.",
        targetDemographics: ["health profession students", "future healthcare providers"],
        applicationRequirements: ["Service commitment contract", "Transcripts", "Personal statement", "Letters of recommendation"]
      },
      {
        name: "American Nurses Association Scholarship",
        amount: 10000,
        type: "merit-based",
        eligibilityRequirements: ["Nursing program enrollment", "Minimum 3.0 GPA", "ANA membership recommended", "Community service"],
        deadline: "April 1, 2026",
        renewable: false,
        provider: "American Nurses Association",
        url: "https://www.nursingworld.org/foundation/scholarships/",

        website: "https://www.nursingworld.org/foundation/scholarships/",
        description: "Scholarships for nursing students pursuing BSN, MSN, or doctoral degrees in nursing.",
        targetDemographics: ["nursing students", "healthcare professionals"],
        applicationRequirements: ["Nursing program verification", "Transcripts", "Personal statement", "Community service documentation"]
      },
      {
        name: "Tylenol Future Care Scholarship",
        amount: 10000,
        type: "merit-based",
        eligibilityRequirements: ["Healthcare major", "Undergraduate or graduate", "GPA 3.0+", "Community involvement"],
        deadline: "April 30, 2026",
        renewable: false,
        provider: "Johnson & Johnson",
        url: "https://www.tylenol.com/scholarship",

        website: "https://www.tylenol.com/scholarship",
        description: "Scholarship for students pursuing careers in healthcare and medicine.",
        targetDemographics: ["healthcare students", "nursing students", "pre-med students"],
        applicationRequirements: ["Healthcare program enrollment", "Transcripts", "Essay", "Community service documentation"]
      },

      // ============================================
      // DIVERSITY SCHOLARSHIPS (2025-2026)
      // ============================================
      {
        name: "United Negro College Fund Scholarships",
        amount: 8000,
        type: "need-based",
        eligibilityRequirements: ["African American ethnicity", "Financial need", "UNCF member institution enrollment", "Academic merit"],
        deadline: "March 31, 2026",
        renewable: true,
        provider: "United Negro College Fund",
        url: "https://scholarships.uncf.org/",

        website: "https://scholarships.uncf.org/",
        description: "Various scholarships for African American students attending UNCF member institutions.",
        targetDemographics: ["African American students", "UNCF member students"],
        applicationRequirements: ["UNCF application", "FAFSA", "Transcripts", "Personal statement"]
      },
      {
        name: "UNCF/Koch Scholars Program",
        amount: 20000,
        type: "merit-based",
        eligibilityRequirements: ["African American ethnicity", "Business/economics major", "UNCF member institution", "Minimum 3.0 GPA"],
        deadline: "February 28, 2026",
        renewable: true,
        provider: "United Negro College Fund and Koch Foundation",
        url: "https://scholarships.uncf.org/Program/Details/99ed2bfe-7cce-4c9d-bc1e-d11b5ce6d6c5",

        website: "https://scholarships.uncf.org/Program/Details/99ed2bfe-7cce-4c9d-bc1e-d11b5ce6d6c5",
        description: "Scholarship for African American students pursuing business, economics, or entrepreneurship degrees.",
        targetDemographics: ["African American students", "business students"],
        applicationRequirements: ["UNCF application", "Transcripts", "Essays", "Financial documents"]
      },
      {
        name: "Hispanic Scholarship Fund",
        amount: 5000,
        type: "merit-based",
        eligibilityRequirements: ["Hispanic heritage", "Minimum 3.0 GPA", "Accredited institution enrollment", "U.S. citizenship or permanent residency"],
        deadline: "February 15, 2026",
        renewable: true,
        provider: "Hispanic Scholarship Fund",
        url: "https://www.hsf.net/scholarship/",

        website: "https://www.hsf.net/scholarship/",
        description: "Scholarships for Hispanic American students pursuing higher education.",
        targetDemographics: ["Hispanic students", "Latino students"],
        applicationRequirements: ["HSF application", "Transcripts", "FAFSA", "Personal statement"]
      },
      {
        name: "Thurgood Marshall College Fund Scholarship",
        amount: 6000,
        type: "merit-based",
        eligibilityRequirements: ["HBCU enrollment", "GPA 3.0+", "Leadership experience", "Community service"],
        deadline: "March 15, 2026",
        renewable: true,
        provider: "Thurgood Marshall College Fund",
        url: "https://www.tmcf.org/our-scholarships/",

        website: "https://www.tmcf.org/our-scholarships/",
        description: "Scholarships for students attending publicly-supported Historically Black Colleges and Universities.",
        targetDemographics: ["HBCU students", "African American students"],
        applicationRequirements: ["TMCF application", "Transcripts", "Essay", "Leadership documentation"]
      },
      {
        name: "American Indian College Fund Scholarships",
        amount: 6000,
        type: "need-based",
        eligibilityRequirements: ["Native American heritage", "Financial need", "Academic merit", "Tribal enrollment or descendant status"],
        deadline: "May 31, 2026",
        renewable: true,
        provider: "American Indian College Fund",
        url: "https://collegefund.org/students/scholarships/",

        website: "https://collegefund.org/students/scholarships/",
        description: "Scholarships for Native American students attending tribal colleges and mainstream institutions.",
        targetDemographics: ["Native American students", "tribal college students"],
        applicationRequirements: ["Tribal enrollment verification", "FAFSA", "Transcripts", "Personal essay"]
      },
      {
        name: "Asian & Pacific Islander American Scholarship Fund",
        amount: 10000,
        type: "merit-based",
        eligibilityRequirements: ["Asian American or Pacific Islander heritage", "Academic excellence", "Leadership experience", "Financial need"],
        deadline: "January 15, 2026",
        renewable: true,
        provider: "APIASF",
        url: "https://www.apiasf.org/scholarships/",

        website: "https://www.apiasf.org/scholarships/",
        description: "Scholarships for Asian American and Pacific Islander students pursuing higher education.",
        targetDemographics: ["Asian American students", "Pacific Islander students"],
        applicationRequirements: ["APIASF application", "Transcripts", "FAFSA", "Leadership portfolio"]
      },
      {
        name: "Point Foundation LGBTQ Scholarship",
        amount: 25000,
        type: "merit-based",
        eligibilityRequirements: ["LGBTQ identity", "Academic excellence", "Leadership experience", "Financial need", "Community involvement"],
        deadline: "January 27, 2026",
        renewable: true,
        provider: "Point Foundation",
        url: "https://pointfoundation.org/point-apply/",

        website: "https://pointfoundation.org/point-apply/",
        description: "Comprehensive scholarship program for LGBTQ students with academic merit and leadership.",
        targetDemographics: ["LGBTQ students", "community leaders"],
        applicationRequirements: ["Point application", "Transcripts", "FAFSA", "Leadership documentation", "Personal statement"]
      },

      // ============================================
      // MILITARY SCHOLARSHIPS (2025-2026)
      // ============================================
      {
        name: "Yellow Ribbon Program",
        amount: 25000,
        type: "service-based",
        eligibilityRequirements: ["Post-9/11 GI Bill eligibility", "Participating school enrollment", "Veteran or dependent status", "Maximum benefit rate"],
        deadline: "Varies by school",
        renewable: true,
        provider: "U.S. Department of Veterans Affairs",
        url: "https://www.va.gov/education/about-gi-bill-benefits/post-9-11/yellow-ribbon-program/",

        website: "https://www.va.gov/education/about-gi-bill-benefits/post-9-11/yellow-ribbon-program/",
        description: "VA program that helps pay tuition and fees at private colleges and graduate schools.",
        targetDemographics: ["veterans", "military dependents"],
        applicationRequirements: ["Certificate of Eligibility", "School enrollment", "VA Form 22-1990"]
      },
      {
        name: "Military Child Education Coalition Scholarship",
        amount: 5000,
        type: "merit-based",
        eligibilityRequirements: ["Military child status", "Academic achievement", "Leadership activities", "Community service"],
        deadline: "February 1, 2026",
        renewable: false,
        provider: "Military Child Education Coalition",
        url: "https://www.militarychild.org/",

        website: "https://www.militarychild.org/",
        description: "Scholarships for military children pursuing undergraduate education.",
        targetDemographics: ["military children", "military families"],
        applicationRequirements: ["Military affiliation documentation", "Transcripts", "Leadership portfolio", "Essays"]
      },
      {
        name: "Pat Tillman Foundation Scholarship",
        amount: 10000,
        type: "merit-based",
        eligibilityRequirements: ["Veteran or military spouse status", "Leadership potential", "Service commitment", "Academic performance"],
        deadline: "February 26, 2026",
        renewable: true,
        provider: "Pat Tillman Foundation",
        url: "https://pattillmanfoundation.org/apply/",

        website: "https://pattillmanfoundation.org/apply/",
        description: "Scholarships for veterans and military spouses pursuing higher education to create positive impact.",
        targetDemographics: ["veterans", "military spouses", "service members"],
        applicationRequirements: ["Military service documentation", "Academic transcripts", "Leadership examples", "Service commitment essay"]
      },
      {
        name: "Children of Fallen Patriots Foundation",
        amount: 10000,
        type: "need-based",
        eligibilityRequirements: ["Child of fallen service member", "Undergraduate or graduate enrollment", "Financial need"],
        deadline: "Rolling admissions",
        renewable: true,
        provider: "Children of Fallen Patriots Foundation",
        url: "https://www.fallenpatriots.org/",

        website: "https://www.fallenpatriots.org/",
        description: "Scholarships for children who lost a parent in military service.",
        targetDemographics: ["children of fallen soldiers", "Gold Star families"],
        applicationRequirements: ["Military death documentation", "FAFSA", "Transcripts", "Personal statement"]
      },

      // ============================================
      // MAJOR PRIVATE FOUNDATION SCHOLARSHIPS (2025-2026)
      // ============================================
      {
        name: "Gates Scholarship",
        amount: 50000,
        type: "merit-based",
        eligibilityRequirements: ["High school senior", "Minority student", "Pell Grant eligible", "GPA 3.3+", "Leadership experience"],
        deadline: "September 15, 2026",
        renewable: true,
        provider: "Gates Foundation",
        url: "https://www.thegatesscholarship.org/",

        website: "https://www.thegatesscholarship.org/",
        description: "Full-ride scholarship for exceptional minority students with leadership potential.",
        targetDemographics: ["African American", "American Indian", "Asian Pacific Islander", "Hispanic American"],
        applicationRequirements: ["Application essays", "Transcripts", "Letters of recommendation", "FAFSA"]
      },
      {
        name: "Jack Kent Cooke Foundation Scholarship",
        amount: 40000,
        type: "merit-based",
        eligibilityRequirements: ["High academic achievement", "Financial need", "Leadership potential", "High school senior"],
        deadline: "November 17, 2026",
        renewable: true,
        provider: "Jack Kent Cooke Foundation",
        url: "https://www.jkcf.org/our-scholarships/college-scholarship-program/",

        website: "https://www.jkcf.org/our-scholarships/college-scholarship-program/",
        description: "Comprehensive scholarship for high-achieving students with financial need.",
        targetDemographics: ["high-achieving students", "low-income families"],
        applicationRequirements: ["Application essays", "Transcripts", "SAT/ACT scores", "Financial documentation"]
      },
      {
        name: "Dell Scholars Program",
        amount: 20000,
        type: "merit-based",
        eligibilityRequirements: ["Participating high school", "GPA 2.4+", "Financial need", "College participation plan"],
        deadline: "December 1, 2026",
        renewable: true,
        provider: "Michael & Susan Dell Foundation",
        url: "https://www.dellscholars.org/",

        website: "https://www.dellscholars.org/",
        description: "Scholarship and support program for students who demonstrate determination despite challenges.",
        targetDemographics: ["first-generation college students", "low-income families"],
        applicationRequirements: ["Online application", "Essays", "Transcripts", "Financial information"]
      },
      {
        name: "Horatio Alger National Scholarship",
        amount: 25000,
        type: "merit-based",
        eligibilityRequirements: ["Financial need", "Overcome significant obstacles", "Academic achievement", "Community involvement"],
        deadline: "October 25, 2026",
        renewable: false,
        provider: "Horatio Alger Association",
        url: "https://scholars.horatioalger.org/scholarships/",

        website: "https://scholars.horatioalger.org/scholarships/",
        description: "National scholarship for students who have overcome adversity and demonstrate perseverance.",
        targetDemographics: ["students who overcame adversity", "low-income families"],
        applicationRequirements: ["Online application", "Essays about overcoming obstacles", "Transcripts", "Income verification"]
      },
      {
        name: "QuestBridge National College Match",
        amount: 60000,
        type: "need-based",
        eligibilityRequirements: ["High academic achievement", "Low-income family", "First-generation college student preferred"],
        deadline: "September 27, 2026",
        renewable: true,
        provider: "QuestBridge",
        url: "https://www.questbridge.org/high-school-students/national-college-match",

        website: "https://www.questbridge.org/high-school-students/national-college-match",
        description: "Full-ride scholarship matching high-achieving, low-income students with top colleges.",
        targetDemographics: ["low-income students", "first-generation college students", "high-achieving students"],
        applicationRequirements: ["QuestBridge application", "Essays", "Transcripts", "Income verification"]
      },
      {
        name: "Coca-Cola Scholars Program",
        amount: 20000,
        type: "merit-based",
        eligibilityRequirements: ["High school senior", "GPA 3.0+", "Leadership and service", "U.S. citizen"],
        deadline: "October 31, 2026",
        renewable: false,
        provider: "Coca-Cola Scholars Foundation",
        url: "https://www.coca-colascholarsfoundation.org/",

        website: "https://www.coca-colascholarsfoundation.org/",
        description: "Achievement-based scholarship for exceptional high school seniors.",
        targetDemographics: ["high school seniors", "community leaders"],
        applicationRequirements: ["Online application", "Leadership documentation", "Transcripts", "Essays"]
      },
      {
        name: "Elks National Foundation Most Valuable Student",
        amount: 12500,
        type: "merit-based",
        eligibilityRequirements: ["High school senior", "U.S. citizen", "Academic achievement", "Leadership", "Financial need"],
        deadline: "November 5, 2026",
        renewable: true,
        provider: "Elks National Foundation",
        url: "https://www.elks.org/scholars/scholarships/mvs.cfm",

        website: "https://www.elks.org/scholars/scholarships/mvs.cfm",
        description: "Competitive scholarship based on scholarship, leadership, and financial need.",
        targetDemographics: ["high school seniors", "students with financial need"],
        applicationRequirements: ["Application", "Essays", "Transcripts", "Letters of recommendation"]
      },

      // ============================================
      // CORPORATE SCHOLARSHIPS (2025-2026)
      // ============================================
      {
        name: "Amazon Future Engineer Scholarship",
        amount: 10000,
        type: "merit-based",
        eligibilityRequirements: ["Computer science major", "Underrepresented group", "Financial need", "High school senior"],
        deadline: "January 17, 2026",
        renewable: true,
        provider: "Amazon",
        url: "https://www.amazonfutureengineer.com/scholarships",

        website: "https://www.amazonfutureengineer.com/scholarships",
        description: "Scholarship for underrepresented students pursuing computer science degrees.",
        targetDemographics: ["underrepresented minorities", "women in STEM", "computer science students"],
        applicationRequirements: ["Application", "Essays", "Transcripts", "Financial documentation"]
      },
      {
        name: "Microsoft Scholarship Program",
        amount: 12000,
        type: "diversity",
        eligibilityRequirements: ["Underrepresented minority", "STEM field", "U.S. citizenship", "Full-time enrollment"],
        deadline: "February 8, 2026",
        renewable: true,
        provider: "Microsoft",
        url: "https://careers.microsoft.com/students/us/en/usscholarshipprogram",

        website: "https://careers.microsoft.com/students/us/en/usscholarshipprogram",
        description: "Scholarship to increase diversity in technology fields.",
        targetDemographics: ["underrepresented minorities", "women in technology", "STEM students"],
        applicationRequirements: ["Application", "Essays", "Transcripts", "Letters of recommendation"]
      },
      {
        name: "Google Generation Scholarship",
        amount: 10000,
        type: "diversity",
        eligibilityRequirements: ["Underrepresented group in tech", "Computer science major", "Strong academic record"],
        deadline: "December 5, 2026",
        renewable: false,
        provider: "Google",
        url: "https://buildyourfuture.withgoogle.com/scholarships/generation-google-scholarship",

        website: "https://buildyourfuture.withgoogle.com/scholarships/generation-google-scholarship",
        description: "Scholarship for underrepresented students in computer science and technology.",
        targetDemographics: ["underrepresented minorities", "women in tech", "computer science students"],
        applicationRequirements: ["Online application", "Essays", "Transcripts", "Resume"]
      },
      {
        name: "Starbucks College Achievement Plan",
        amount: 25000,
        type: "merit-based",
        eligibilityRequirements: ["Starbucks partner", "Arizona State University Online enrollment", "Part-time work commitment"],
        deadline: "Rolling admissions",
        renewable: true,
        provider: "Starbucks Corporation",
        url: "https://www.starbucks.com/careers/working-at-starbucks/education",

        website: "https://www.starbucks.com/careers/working-at-starbucks/education",
        description: "Tuition coverage for Starbucks partners pursuing degrees through ASU Online.",
        targetDemographics: ["Starbucks employees", "working students"],
        applicationRequirements: ["Employment verification", "ASU admission", "Work schedule commitment"]
      },
      {
        name: "Walmart Associate Scholarship",
        amount: 5000,
        type: "merit-based",
        eligibilityRequirements: ["Walmart associate or dependent", "Part-time or full-time employee", "Academic achievement"],
        deadline: "February 1, 2026",
        renewable: true,
        provider: "Walmart Foundation",
        url: "https://opportunity.walmart.com/content/opportunity/en_us/programs/education/associates-scholarships.html",

        website: "https://opportunity.walmart.com/content/opportunity/en_us/programs/education/associates-scholarships.html",
        description: "Scholarship for Walmart associates and their dependents pursuing higher education.",
        targetDemographics: ["Walmart employees", "employee dependents"],
        applicationRequirements: ["Employment verification", "Transcripts", "Application form"]
      },

      // ============================================
      // CAREER-SPECIFIC SCHOLARSHIPS (2025-2026)
      // ============================================
      {
        name: "NEA Foundation Student Achievement Grant",
        amount: 5000,
        type: "merit-based",
        eligibilityRequirements: ["Education field", "Project proposal", "Student achievement focus", "Teaching credential pursuit"],
        deadline: "February 1, 2026",
        renewable: false,
        provider: "National Education Association Foundation",
        url: "https://www.neafoundation.org/for-educators/student-achievement-grants/",

        website: "https://www.neafoundation.org/for-educators/student-achievement-grants/",
        description: "Grants for future teachers and education professionals to improve student achievement.",
        targetDemographics: ["education students", "future teachers"],
        applicationRequirements: ["Project proposal", "Budget plan", "Academic transcripts", "Letters of recommendation"]
      },
      {
        name: "AICPA Accounting Scholarship",
        amount: 10000,
        type: "merit-based",
        eligibilityRequirements: ["Accounting major", "Minimum 3.0 GPA", "150 credit hour commitment", "CPA exam intention"],
        deadline: "April 1, 2026",
        renewable: true,
        provider: "American Institute of CPAs",
        url: "https://www.aicpa.org/career/scholarships-and-awards",

        website: "https://www.aicpa.org/career/scholarships-and-awards",
        description: "Scholarships for students pursuing accounting degrees and CPA certification.",
        targetDemographics: ["accounting students", "future CPAs"],
        applicationRequirements: ["Academic transcripts", "Personal statement", "Letters of recommendation", "Resume"]
      },
      {
        name: "American Bar Association Legal Opportunity Scholarship",
        amount: 15000,
        type: "diversity",
        eligibilityRequirements: ["Underrepresented minority", "Law school enrollment", "Financial need", "Academic merit"],
        deadline: "March 2, 2026",
        renewable: true,
        provider: "American Bar Association",
        url: "https://www.americanbar.org/groups/diversity/disabilitylaw/resources/scholarship/",

        website: "https://www.americanbar.org/groups/diversity/disabilitylaw/resources/scholarship/",
        description: "Scholarships to increase diversity in the legal profession.",
        targetDemographics: ["underrepresented minorities", "law students"],
        applicationRequirements: ["Law school acceptance", "Diversity statement", "Transcripts", "Financial documentation"]
      },
      {
        name: "Future Journalists Scholarship",
        amount: 7500,
        type: "merit-based",
        eligibilityRequirements: ["Journalism or communications major", "Portfolio submission", "Minimum 3.0 GPA", "Career commitment"],
        deadline: "January 31, 2026",
        renewable: false,
        provider: "Society of Professional Journalists",
        url: "https://www.spj.org/scholarships.asp",

        website: "https://www.spj.org/scholarships.asp",
        description: "Scholarships for students pursuing careers in journalism and communications.",
        targetDemographics: ["journalism students", "communications majors"],
        applicationRequirements: ["Portfolio of work", "Academic transcripts", "Career statement", "Letters of recommendation"]
      },
      {
        name: "Foot Locker Scholar Athletes Program",
        amount: 20000,
        type: "athletic",
        eligibilityRequirements: ["High school senior", "Student-athlete", "GPA 3.0+", "Community involvement"],
        deadline: "December 17, 2026",
        renewable: true,
        provider: "Foot Locker Foundation",
        url: "https://www.footlockerscholarathletes.com/",

        website: "https://www.footlockerscholarathletes.com/",
        description: "Scholarship for student-athletes who excel in academics, athletics, and community service.",
        targetDemographics: ["student-athletes", "high school seniors"],
        applicationRequirements: ["Application", "Athletic participation verification", "Transcripts", "Community service documentation"]
      },
      {
        name: "Burger King Scholars Program",
        amount: 1000,
        type: "merit-based",
        eligibilityRequirements: ["High school senior", "GPA 2.5+", "Work experience", "Community involvement"],
        deadline: "December 15, 2026",
        renewable: false,
        provider: "Burger King Foundation",
        url: "https://www.burgerkingfoundation.org/",

        website: "https://www.burgerkingfoundation.org/",
        description: "Scholarship for students who demonstrate academic achievement and work ethic.",
        targetDemographics: ["working students", "high school seniors"],
        applicationRequirements: ["Online application", "Transcripts", "Work experience documentation", "Essay"]
      }
    ];
  }

  getScholarshipsWithStatus(): ScholarshipWithStatus[] {
    return this.getAuthenticScholarships().map(scholarship => ({
      ...scholarship,
      deadlineStatus: getDeadlineStatus(scholarship.deadline)
    }));
  }

  getActiveScholarships(): ScholarshipWithStatus[] {
    return this.getScholarshipsWithStatus()
      .filter(s => s.deadlineStatus.status !== 'expired');
  }

  getUrgentScholarships(): ScholarshipWithStatus[] {
    return this.getScholarshipsWithStatus()
      .filter(s => s.deadlineStatus.status === 'urgent' || s.deadlineStatus.status === 'closing-soon')
      .sort((a, b) => (a.deadlineStatus.daysUntil || 999) - (b.deadlineStatus.daysUntil || 999));
  }

  searchScholarships(query: string, filters?: ScholarshipFilters): InsertScholarship[] {
    let scholarships = filters?.excludeExpired !== false 
      ? this.getActiveScholarships() 
      : this.getScholarshipsWithStatus();

    // Urgency filter
    if (filters?.urgencyFilter && filters.urgencyFilter !== 'all') {
      scholarships = scholarships.filter(s => {
        switch (filters.urgencyFilter) {
          case 'urgent':
            return s.deadlineStatus.status === 'urgent';
          case 'closing-soon':
            return s.deadlineStatus.status === 'urgent' || s.deadlineStatus.status === 'closing-soon';
          case 'upcoming':
            return s.deadlineStatus.status !== 'expired';
          default:
            return true;
        }
      });
    }

    let filtered = scholarships as InsertScholarship[];

    // Text search
    if (query) {
      const queryLower = query.toLowerCase();
      filtered = filtered.filter(scholarship => 
        scholarship.name.toLowerCase().includes(queryLower) ||
        (scholarship.description && scholarship.description.toLowerCase().includes(queryLower)) ||
        scholarship.targetDemographics.some(demo => demo.toLowerCase().includes(queryLower)) ||
        scholarship.eligibilityRequirements.some(req => req.toLowerCase().includes(queryLower))
      );
    }

    // Apply filters
    if (filters) {
      if (filters.type) {
        filtered = filtered.filter(s => s.type === filters.type);
      }
      
      if (filters.minAmount) {
        filtered = filtered.filter(s => s.amount >= filters.minAmount!);
      }
      
      if (filters.maxAmount) {
        filtered = filtered.filter(s => s.amount <= filters.maxAmount!);
      }
      
      if (filters.renewable !== undefined) {
        filtered = filtered.filter(s => s.renewable === filters.renewable);
      }
      
      if (filters.provider) {
        filtered = filtered.filter(s => s.provider.toLowerCase().includes(filters.provider!.toLowerCase()));
      }
      
      if (filters.targetDemographic) {
        filtered = filtered.filter(s => 
          s.targetDemographics.some(demo => 
            demo.toLowerCase().includes(filters.targetDemographic!.toLowerCase())
          )
        );
      }
      
      if (filters.state) {
        filtered = filtered.filter(s => 
          s.name.toLowerCase().includes(filters.state!.toLowerCase()) ||
          s.targetDemographics.some(demo => 
            demo.toLowerCase().includes(filters.state!.toLowerCase())
          )
        );
      }
      
      if (filters.field) {
        filtered = filtered.filter(s => 
          s.targetDemographics.some(demo => 
            demo.toLowerCase().includes(filters.field!.toLowerCase())
          ) ||
          s.eligibilityRequirements.some(req => 
            req.toLowerCase().includes(filters.field!.toLowerCase())
          )
        );
      }
    }

    // Sort by deadline urgency
    return sortByDeadlineUrgency(filtered);
  }

  getFilterOptions() {
    const scholarships = this.getAuthenticScholarships();
    
    const types = new Set<string>();
    const providers = new Set<string>();
    const demographics = new Set<string>();
    
    scholarships.forEach(scholarship => {
      types.add(scholarship.type);
      providers.add(scholarship.provider);
      scholarship.targetDemographics.forEach(demo => demographics.add(demo));
    });

    return {
      types: Array.from(types).sort(),
      providers: Array.from(providers).sort(),
      demographics: Array.from(demographics).sort(),
      amountRanges: [
        { label: "Under $5,000", min: 0, max: 4999 },
        { label: "$5,000 - $9,999", min: 5000, max: 9999 },
        { label: "$10,000 - $19,999", min: 10000, max: 19999 },
        { label: "$20,000 - $49,999", min: 20000, max: 49999 },
        { label: "$50,000+", min: 50000, max: 999999 }
      ]
    };
  }
}

export const scholarshipService = new ComprehensiveScholarshipService();

// Export function for easy access
export function getAllScholarships() {
  return scholarshipService.getAuthenticScholarships();
}

export function getActiveScholarships() {
  return scholarshipService.getActiveScholarships();
}

export function getUrgentScholarships() {
  return scholarshipService.getUrgentScholarships();
}
