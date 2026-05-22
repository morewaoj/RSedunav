import { db } from "./db";
import { fellowships, savedFellowships, type InsertFellowship, type Fellowship } from "@workspace/db";
import { eq, and, ilike, or, sql, desc, asc } from "drizzle-orm";

// Authentic fellowship data from real programs
const authenticFellowships: InsertFellowship[] = [
  // National Science Foundation
  {
    name: "NSF Graduate Research Fellowship Program (GRFP)",
    provider: "National Science Foundation",
    type: "research",
    category: "STEM",
    amount: 37000,
    amountType: "stipend",
    duration: "3 years",
    deadline: "October 2026",
    website: "https://www.nsfgrfp.org/",
    description: "The NSF GRFP recognizes and supports outstanding graduate students in NSF-supported STEM disciplines. Fellows receive a three-year annual stipend of $37,000 along with a $12,000 cost of education allowance.",
    eligibilityRequirements: ["U.S. citizen, national, or permanent resident", "Enrolled in research-based master's or doctoral program", "Early-stage graduate student (first or second year)", "Pursuing degree in NSF-supported field"],
    targetDemographics: ["graduate students", "STEM researchers", "early-career scientists"],
    applicationRequirements: ["Personal statement", "Graduate research plan", "Three reference letters", "Transcripts"],
    fields: ["engineering", "computer science", "mathematics", "physics", "chemistry", "biology", "geosciences", "psychology", "social sciences", "STEM education"],
    academicLevel: ["graduate", "masters", "doctoral"],
    citizenshipRequirements: ["US citizen", "permanent resident"],
    minGpa: 3.5,
    benefits: ["$37,000 annual stipend", "$12,000 education allowance", "Research flexibility", "Professional development"],
    renewable: false,
    competitive: "very-high",
    isActive: true
  },
  // Fulbright
  {
    name: "Fulbright U.S. Student Program",
    provider: "U.S. Department of State",
    type: "research",
    category: "interdisciplinary",
    amount: 25000,
    amountType: "full-support",
    duration: "9-12 months",
    deadline: "October 2026",
    website: "https://us.fulbrightonline.org/",
    description: "The Fulbright U.S. Student Program offers grants for individually designed study/research projects or for English Teaching Assistant Programs. Fellows study, conduct research, or teach English abroad for one academic year.",
    eligibilityRequirements: ["U.S. citizen", "Bachelor's degree by start of grant", "Proficiency in host country language", "Good health"],
    targetDemographics: ["recent graduates", "graduate students", "young professionals"],
    applicationRequirements: ["Statement of Grant Purpose", "Personal Statement", "Three letters of recommendation", "Language evaluation", "Transcripts"],
    fields: ["all disciplines", "humanities", "social sciences", "STEM", "arts", "education"],
    academicLevel: ["graduate", "postbaccalaureate"],
    citizenshipRequirements: ["US citizen"],
    minGpa: 3.0,
    benefits: ["Round-trip airfare", "Living stipend", "Health insurance", "Language training", "Cultural enrichment"],
    renewable: false,
    competitive: "very-high",
    isActive: true
  },
  // Ford Foundation
  {
    name: "Ford Foundation Fellowship Program",
    provider: "Ford Foundation",
    type: "research",
    category: "interdisciplinary",
    amount: 27000,
    amountType: "stipend",
    duration: "3 years (predoctoral)",
    deadline: "December 2026",
    website: "https://sites.nationalacademies.org/PGA/FordFellowships/",
    description: "The Ford Foundation Fellowship Programs seek to increase the diversity of the nation's college and university faculties by increasing their ethnic and racial diversity, maximize the educational benefits of diversity, and increase the number of professors who can and will use diversity as a resource for enriching the education of all students.",
    eligibilityRequirements: ["U.S. citizen or national", "Evidence of superior academic achievement", "Committed to diversity and cross-cultural understanding", "Pursuing PhD or ScD"],
    targetDemographics: ["underrepresented minorities", "doctoral students", "aspiring faculty"],
    applicationRequirements: ["Personal statement", "Research statement", "Three letters of recommendation", "Transcripts", "Previous research description"],
    fields: ["all research-based disciplines", "humanities", "social sciences", "STEM", "interdisciplinary"],
    academicLevel: ["doctoral"],
    citizenshipRequirements: ["US citizen", "US national"],
    minGpa: 3.5,
    benefits: ["$27,000 annual stipend", "Conference travel allowance", "Access to Ford Fellow community", "Mentoring opportunities"],
    renewable: true,
    competitive: "very-high",
    isActive: true
  },
  // Hertz Foundation
  {
    name: "Hertz Fellowship",
    provider: "Fannie and John Hertz Foundation",
    type: "research",
    category: "STEM",
    amount: 34000,
    amountType: "stipend",
    duration: "5 years",
    deadline: "October 2026",
    website: "https://www.hertzfoundation.org/",
    description: "The Hertz Fellowship is the most generous STEM fellowship in the country, providing five years of support and lifelong connection to the Hertz community. Fellows are selected for their intellect, their ingenuity, and their potential to bring meaningful improvement to society.",
    eligibilityRequirements: ["U.S. citizen or permanent resident", "Applying to or enrolled in PhD program", "Pursuing physical, biological, or engineering sciences", "Demonstrated innovation"],
    targetDemographics: ["STEM doctoral students", "innovative researchers", "future leaders"],
    applicationRequirements: ["Essays", "Four letters of recommendation", "Transcripts", "Two technical interviews"],
    fields: ["applied physical sciences", "biological sciences", "engineering", "mathematics"],
    academicLevel: ["doctoral"],
    citizenshipRequirements: ["US citizen", "permanent resident"],
    minGpa: 3.7,
    benefits: ["$34,000+ annual stipend", "Full tuition coverage", "Hertz community access", "Lifelong mentoring"],
    renewable: true,
    competitive: "very-high",
    isActive: true
  },
  // DOE SCGSR
  {
    name: "DOE Office of Science Graduate Student Research (SCGSR)",
    provider: "U.S. Department of Energy",
    type: "research",
    category: "STEM",
    amount: 3000,
    amountType: "stipend",
    duration: "3-12 months",
    deadline: "May 2026",
    website: "https://science.osti.gov/wdts/scgsr",
    description: "The SCGSR program provides supplemental funds for graduate students to conduct part of their dissertation research at a DOE national laboratory in collaboration with a DOE laboratory scientist.",
    eligibilityRequirements: ["U.S. citizen or permanent resident", "Currently enrolled PhD student", "Dissertation research in DOE-relevant area", "Faculty advisor approval"],
    targetDemographics: ["PhD students", "STEM researchers", "national lab collaborators"],
    applicationRequirements: ["Research proposal", "Letter of support from faculty advisor", "Letter of support from DOE lab scientist", "Transcripts"],
    fields: ["physics", "chemistry", "materials science", "biology", "environmental science", "computer science", "mathematics"],
    academicLevel: ["doctoral"],
    citizenshipRequirements: ["US citizen", "permanent resident"],
    minGpa: 3.0,
    benefits: ["Monthly stipend supplement", "Travel reimbursement", "Access to DOE facilities", "Professional networking"],
    renewable: false,
    competitive: "high",
    isActive: true
  },
  // NIH F31
  {
    name: "NIH Ruth L. Kirschstein Predoctoral Fellowship (F31)",
    provider: "National Institutes of Health",
    type: "research",
    category: "STEM",
    amount: 27324,
    amountType: "stipend",
    duration: "Up to 5 years",
    deadline: "April, August, December (rolling)",
    website: "https://researchtraining.nih.gov/programs/fellowships/F31",
    description: "The F31 provides predoctoral research training support for promising doctoral candidates who will be performing dissertation research and training in scientific health-related fields relevant to the NIH mission.",
    eligibilityRequirements: ["U.S. citizen or permanent resident", "Enrolled in PhD program in biomedical field", "Have dissertation committee formed", "Mentor committed to training"],
    targetDemographics: ["biomedical PhD students", "health researchers", "diverse candidates"],
    applicationRequirements: ["Specific aims", "Research strategy", "Training plan", "Letters of support", "Biosketch"],
    fields: ["biomedical sciences", "behavioral sciences", "clinical research", "public health", "nursing"],
    academicLevel: ["doctoral"],
    citizenshipRequirements: ["US citizen", "permanent resident"],
    minGpa: 3.0,
    benefits: ["$27,324 annual stipend", "Tuition and fees", "Institutional allowance", "Travel funds"],
    renewable: true,
    competitive: "high",
    isActive: true
  },
  // AAUW
  {
    name: "AAUW American Fellowship",
    provider: "American Association of University Women",
    type: "dissertation",
    category: "interdisciplinary",
    amount: 30000,
    amountType: "stipend",
    duration: "1 year",
    deadline: "November 2026",
    website: "https://www.aauw.org/resources/programs/fellowships-grants/current-opportunities/american/",
    description: "American Fellowships support women doctoral candidates completing dissertations and scholars seeking funds for postdoctoral research leave or preparing completed research for publication.",
    eligibilityRequirements: ["U.S. citizen or permanent resident", "Women scholars", "Doctoral candidate or postdoctoral researcher", "Final year of dissertation or postdoc research"],
    targetDemographics: ["women", "doctoral candidates", "postdoctoral researchers"],
    applicationRequirements: ["Project narrative", "Resume/CV", "Three letters of recommendation", "Transcripts"],
    fields: ["all disciplines", "humanities", "social sciences", "STEM", "arts", "education"],
    academicLevel: ["doctoral", "postdoc"],
    citizenshipRequirements: ["US citizen", "permanent resident"],
    minGpa: 3.0,
    benefits: ["$30,000 dissertation fellowship", "$50,000 postdoctoral fellowship", "Professional development"],
    renewable: false,
    competitive: "high",
    isActive: true
  },
  // Soros Fellowship
  {
    name: "Paul & Daisy Soros Fellowships for New Americans",
    provider: "Paul & Daisy Soros Foundation",
    type: "academic",
    category: "interdisciplinary",
    amount: 90000,
    amountType: "full-support",
    duration: "2 years",
    deadline: "October 2026",
    website: "https://www.pdsoros.org/",
    description: "The Paul & Daisy Soros Fellowships for New Americans honors the contributions of immigrants and children of immigrants to the United States. The program awards up to 30 Fellowships annually to outstanding New Americans who are pursuing graduate study.",
    eligibilityRequirements: ["New American (immigrant, DACA, or child of immigrants)", "30 years old or younger", "Pursuing full-time graduate study", "Have bachelor's degree or in final year"],
    targetDemographics: ["immigrants", "children of immigrants", "DACA recipients", "graduate students"],
    applicationRequirements: ["Essays", "Resume", "Two letters of recommendation", "Transcripts", "Interview (if selected)"],
    fields: ["all graduate programs", "law", "medicine", "MBA", "PhD", "MFA", "public policy"],
    academicLevel: ["graduate", "professional", "doctoral"],
    citizenshipRequirements: ["US citizen", "permanent resident", "DACA recipient"],
    minGpa: 3.5,
    benefits: ["Up to $90,000 over two years", "Full tuition support", "Living stipend", "Community of fellows"],
    renewable: false,
    competitive: "very-high",
    isActive: true
  },
  // Marshall Scholarship
  {
    name: "Marshall Scholarship",
    provider: "Marshall Aid Commemoration Commission",
    type: "academic",
    category: "interdisciplinary",
    amount: 50000,
    amountType: "full-support",
    duration: "2-3 years",
    deadline: "September 2026",
    website: "https://www.marshallscholarship.org/",
    description: "Marshall Scholarships finance young Americans of high ability to study for a graduate degree in the United Kingdom. Up to 50 Scholars are selected each year to study at the graduate level at a UK institution in any field.",
    eligibilityRequirements: ["U.S. citizen", "Bachelor's degree by start of scholarship", "GPA of at least 3.7", "Strong leadership record"],
    targetDemographics: ["recent graduates", "young professionals", "future leaders"],
    applicationRequirements: ["Personal statement", "Proposed academic program", "Four letters of recommendation", "Transcripts", "Interview"],
    fields: ["all disciplines", "humanities", "social sciences", "STEM", "arts", "law", "business"],
    academicLevel: ["graduate", "masters", "doctoral"],
    citizenshipRequirements: ["US citizen"],
    minGpa: 3.7,
    benefits: ["Full tuition", "Living expenses", "Airfare", "Book grant", "Research expenses"],
    renewable: true,
    competitive: "very-high",
    isActive: true
  },
  // Rhodes Scholarship
  {
    name: "Rhodes Scholarship",
    provider: "Rhodes Trust",
    type: "academic",
    category: "interdisciplinary",
    amount: 75000,
    amountType: "full-support",
    duration: "2-3 years",
    deadline: "October 2026",
    website: "https://www.rhodeshouse.ox.ac.uk/scholarships/",
    description: "The Rhodes Scholarship is the oldest and most celebrated international fellowship award, enabling outstanding young people from around the world to study at the University of Oxford.",
    eligibilityRequirements: ["U.S. citizen or permanent resident", "Age 18-24 at time of application", "Bachelor's degree by October of year following application", "Outstanding academic and personal achievements"],
    targetDemographics: ["outstanding graduates", "future leaders", "high achievers"],
    applicationRequirements: ["Personal statement", "Eight letters of recommendation", "Transcripts", "Multiple interviews"],
    fields: ["all disciplines at Oxford", "humanities", "sciences", "social sciences", "law"],
    academicLevel: ["graduate", "masters", "doctoral"],
    citizenshipRequirements: ["US citizen", "permanent resident"],
    minGpa: 3.8,
    benefits: ["Full tuition at Oxford", "Living stipend", "Airfare", "Health insurance", "Rhodes community"],
    renewable: true,
    competitive: "very-high",
    isActive: true
  },
  // Goldwater Scholarship
  {
    name: "Barry Goldwater Scholarship",
    provider: "Barry Goldwater Scholarship Foundation",
    type: "research",
    category: "STEM",
    amount: 7500,
    amountType: "stipend",
    duration: "1-2 years",
    deadline: "January 2027",
    website: "https://goldwaterscholarship.gov/",
    description: "The Goldwater Scholarship Program was established to encourage outstanding students to pursue research careers in mathematics, natural sciences, and engineering. Awards cover the cost of tuition, fees, books, and room and board up to $7,500 annually.",
    eligibilityRequirements: ["U.S. citizen or permanent resident", "Sophomore or junior standing", "Pursuing STEM research career", "3.0+ GPA"],
    targetDemographics: ["undergraduates", "STEM majors", "future researchers"],
    applicationRequirements: ["Research essay", "Three letters of recommendation", "Transcripts", "Nomination by institution"],
    fields: ["mathematics", "natural sciences", "engineering"],
    academicLevel: ["undergraduate"],
    citizenshipRequirements: ["US citizen", "permanent resident"],
    minGpa: 3.0,
    benefits: ["Up to $7,500 per year", "Goldwater Scholar distinction", "Networking opportunities"],
    renewable: true,
    competitive: "very-high",
    isActive: true
  },
  // Truman Scholarship
  {
    name: "Harry S. Truman Scholarship",
    provider: "Harry S. Truman Scholarship Foundation",
    type: "professional",
    category: "social-sciences",
    amount: 30000,
    amountType: "full-support",
    duration: "Graduate study",
    deadline: "February 2027",
    website: "https://www.truman.gov/",
    description: "Truman Scholarships are awarded to college juniors who plan to pursue careers in public service. Scholars receive funding for graduate study, leadership training, and career counseling.",
    eligibilityRequirements: ["U.S. citizen", "College junior", "Committed to career in public service", "Top quarter of class"],
    targetDemographics: ["public service leaders", "change agents", "policy makers"],
    applicationRequirements: ["Policy proposal", "Leadership record", "Letters of recommendation", "Transcripts", "Interviews"],
    fields: ["public policy", "government", "education", "public health", "environment", "social work"],
    academicLevel: ["undergraduate", "graduate"],
    citizenshipRequirements: ["US citizen"],
    minGpa: 3.0,
    benefits: ["$30,000 for graduate study", "Leadership training", "Truman community", "Career counseling"],
    renewable: false,
    competitive: "very-high",
    isActive: true
  },
  // Gates Cambridge
  {
    name: "Gates Cambridge Scholarship",
    provider: "Bill and Melinda Gates Foundation",
    type: "academic",
    category: "interdisciplinary",
    amount: 60000,
    amountType: "full-support",
    duration: "Full course of study",
    deadline: "October 2026",
    website: "https://www.gatescambridge.org/",
    description: "Gates Cambridge Scholarships are awarded to outstanding applicants from countries outside the UK to pursue a full-time postgraduate degree in any subject at the University of Cambridge.",
    eligibilityRequirements: ["Non-UK citizen", "Applying to University of Cambridge", "Outstanding academic record", "Leadership potential"],
    targetDemographics: ["international students", "future leaders", "scholars"],
    applicationRequirements: ["Personal statement", "Research proposal", "Letters of recommendation", "Transcripts", "Interview"],
    fields: ["all disciplines at Cambridge", "sciences", "humanities", "social sciences", "arts"],
    academicLevel: ["graduate", "masters", "doctoral"],
    citizenshipRequirements: ["US citizen", "international"],
    minGpa: 3.8,
    benefits: ["Full tuition", "Living allowance", "Airfare", "Academic development funding"],
    renewable: true,
    competitive: "very-high",
    isActive: true
  },
  // SSRC
  {
    name: "SSRC International Dissertation Research Fellowship (IDRF)",
    provider: "Social Science Research Council",
    type: "dissertation",
    category: "social-sciences",
    amount: 25000,
    amountType: "grant",
    duration: "9-12 months",
    deadline: "November 2026",
    website: "https://www.ssrc.org/programs/idrf/",
    description: "The IDRF program supports distinguished graduate students in the humanities and social sciences who are conducting dissertation research outside the United States.",
    eligibilityRequirements: ["Enrolled in PhD program at U.S. institution", "ABD status", "Conducting international dissertation research", "Humanities or social sciences"],
    targetDemographics: ["doctoral candidates", "international researchers", "social scientists"],
    applicationRequirements: ["Research proposal", "Bibliography", "Fieldwork timeline", "Letters of recommendation", "Transcripts"],
    fields: ["anthropology", "economics", "history", "political science", "sociology", "area studies", "humanities"],
    academicLevel: ["doctoral"],
    citizenshipRequirements: ["US citizen", "permanent resident", "international"],
    minGpa: 3.0,
    benefits: ["Up to $25,000 stipend", "Research expenses", "Health insurance supplement"],
    renewable: false,
    competitive: "high",
    isActive: true
  },
  // Boren Fellowship
  {
    name: "David L. Boren Fellowship",
    provider: "National Security Education Program",
    type: "research",
    category: "social-sciences",
    amount: 30000,
    amountType: "grant",
    duration: "12-24 months",
    deadline: "January 2027",
    website: "https://www.borenawards.org/fellowships",
    description: "Boren Fellowships provide funding for U.S. graduate students to study less commonly taught languages in regions critical to U.S. national security interests.",
    eligibilityRequirements: ["U.S. citizen", "Graduate student", "Studying critical language", "Committed to federal service"],
    targetDemographics: ["graduate students", "language learners", "future federal employees"],
    applicationRequirements: ["Personal statement", "Language study plan", "Letters of recommendation", "Transcripts", "Security clearance"],
    fields: ["language study", "international relations", "area studies", "national security"],
    academicLevel: ["graduate", "doctoral"],
    citizenshipRequirements: ["US citizen"],
    minGpa: 3.0,
    benefits: ["Up to $30,000", "Language training", "Cultural immersion", "Federal career path"],
    renewable: false,
    competitive: "high",
    isActive: true
  },
  // Mellon/ACLS
  {
    name: "Mellon/ACLS Dissertation Completion Fellowship",
    provider: "American Council of Learned Societies",
    type: "dissertation",
    category: "humanities",
    amount: 40000,
    amountType: "stipend",
    duration: "1 academic year",
    deadline: "October 2026",
    website: "https://www.acls.org/programs/dcf/",
    description: "The Mellon/ACLS Dissertation Completion Fellowship supports a year of research and writing to help advanced graduate students in the humanities and related social sciences complete their dissertations.",
    eligibilityRequirements: ["Enrolled in PhD program at U.S. or Canadian institution", "ABD status", "Humanities or related social sciences", "Expected completion within fellowship year"],
    targetDemographics: ["ABD students", "humanities scholars", "dissertation writers"],
    applicationRequirements: ["Dissertation abstract", "Research statement", "Writing sample", "Letters of recommendation"],
    fields: ["humanities", "history", "philosophy", "literature", "art history", "musicology", "religious studies"],
    academicLevel: ["doctoral"],
    citizenshipRequirements: ["US citizen", "permanent resident", "international"],
    minGpa: 3.0,
    benefits: ["$40,000 stipend", "Research funds", "University fees paid"],
    renewable: false,
    competitive: "very-high",
    isActive: true
  },
  // HHMI Gilliam Fellowship
  {
    name: "HHMI Gilliam Fellows Program",
    provider: "Howard Hughes Medical Institute",
    type: "research",
    category: "STEM",
    amount: 53000,
    amountType: "stipend",
    duration: "Up to 5 years",
    deadline: "January 2027",
    website: "https://www.hhmi.org/science-education/programs/gilliam-fellows-program",
    description: "The Gilliam Fellows Program supports exceptional graduate students who are committed to advancing diversity and inclusion in the sciences. Fellows are paired with faculty advisors to form a dynamic advising partnership.",
    eligibilityRequirements: ["U.S. citizen or permanent resident", "Graduate student in biomedical sciences", "Committed to diversity in STEM", "Advisor must also apply"],
    targetDemographics: ["underrepresented minorities", "biomedical PhD students", "diversity advocates"],
    applicationRequirements: ["Personal statement", "Research description", "Advisor mentoring statement", "Letters of recommendation"],
    fields: ["biomedical sciences", "life sciences", "chemistry", "physics", "computational biology"],
    academicLevel: ["doctoral"],
    citizenshipRequirements: ["US citizen", "permanent resident"],
    minGpa: 3.0,
    benefits: ["$53,000 annual stipend", "Annual meeting attendance", "Mentoring support", "Professional development"],
    renewable: true,
    competitive: "very-high",
    isActive: true
  },
  // Knight-Hennessy
  {
    name: "Knight-Hennessy Scholars Program",
    provider: "Stanford University",
    type: "academic",
    category: "interdisciplinary",
    amount: 90000,
    amountType: "full-support",
    duration: "Up to 3 years",
    deadline: "October 2026",
    website: "https://knight-hennessy.stanford.edu/",
    description: "Knight-Hennessy Scholars develops a community of future global leaders who will work together to find creative solutions to the world's greatest challenges. Scholars receive full funding for graduate study at Stanford.",
    eligibilityRequirements: ["Bachelor's degree within 10 years", "Applying to Stanford graduate program", "Demonstrated leadership", "Civic mindset"],
    targetDemographics: ["future leaders", "change-makers", "graduate students"],
    applicationRequirements: ["Personal essays", "Resume", "Three letters of recommendation", "Two short videos", "Interview"],
    fields: ["all Stanford graduate programs", "business", "law", "medicine", "engineering", "education", "arts"],
    academicLevel: ["graduate", "professional", "doctoral"],
    citizenshipRequirements: ["US citizen", "international"],
    minGpa: 3.5,
    benefits: ["Full tuition", "Living stipend", "Graduate fellowship", "Global travel", "Leadership development"],
    renewable: true,
    competitive: "very-high",
    isActive: true
  }
];

class FellowshipService {
  async seedFellowships() {
    const existingFellowships = await db.select().from(fellowships);
    if (existingFellowships.length > 0) {
      console.log(`Fellowships already seeded: ${existingFellowships.length} fellowships`);
      return;
    }

    console.log("Seeding fellowship database...");
    for (const fellowship of authenticFellowships) {
      await db.insert(fellowships).values(fellowship);
    }
    console.log(`Successfully seeded ${authenticFellowships.length} fellowships`);
  }

  async getAllFellowships(): Promise<Fellowship[]> {
    return db.select().from(fellowships).where(eq(fellowships.isActive, true));
  }

  async getFellowshipById(id: number): Promise<Fellowship | undefined> {
    const results = await db.select().from(fellowships).where(eq(fellowships.id, id));
    return results[0];
  }

  async searchFellowships(params: {
    query?: string;
    category?: string;
    type?: string;
    academicLevel?: string;
    minAmount?: number;
    maxAmount?: number;
    citizenship?: string;
  }): Promise<Fellowship[]> {
    let query = db.select().from(fellowships).where(eq(fellowships.isActive, true));

    const results = await query;
    let filtered = results;

    if (params.query) {
      const searchTerm = params.query.toLowerCase();
      filtered = filtered.filter(f => 
        f.name.toLowerCase().includes(searchTerm) ||
        f.provider.toLowerCase().includes(searchTerm) ||
        f.description?.toLowerCase().includes(searchTerm) ||
        f.fields?.some(field => field.toLowerCase().includes(searchTerm))
      );
    }

    if (params.category) {
      filtered = filtered.filter(f => f.category === params.category);
    }

    if (params.type) {
      filtered = filtered.filter(f => f.type === params.type);
    }

    if (params.academicLevel) {
      filtered = filtered.filter(f => 
        f.academicLevel?.includes(params.academicLevel!) ||
        f.academicLevel?.includes('graduate')
      );
    }

    if (params.minAmount) {
      filtered = filtered.filter(f => f.amount >= params.minAmount!);
    }

    if (params.maxAmount) {
      filtered = filtered.filter(f => f.amount <= params.maxAmount!);
    }

    if (params.citizenship) {
      filtered = filtered.filter(f => 
        f.citizenshipRequirements?.includes(params.citizenship!) ||
        f.citizenshipRequirements?.includes('international')
      );
    }

    return filtered;
  }

  async matchFellowships(userProfile: {
    gpa?: number;
    interests?: string[];
    academicLevel?: string;
    major?: string;
    demographics?: string[];
  }): Promise<{ fellowship: Fellowship; matchScore: number; matchReasons: string[] }[]> {
    const allFellowships = await this.getAllFellowships();
    const matches: { fellowship: Fellowship; matchScore: number; matchReasons: string[] }[] = [];

    for (const fellowship of allFellowships) {
      let score = 40; // Base score
      const reasons: string[] = [];

      // GPA matching
      if (userProfile.gpa) {
        if (fellowship.minGpa && userProfile.gpa >= fellowship.minGpa) {
          score += 20;
          reasons.push("GPA meets requirements");
        } else if (fellowship.minGpa && userProfile.gpa < fellowship.minGpa) {
          score -= 30;
          reasons.push("GPA below minimum requirement");
        } else {
          score += 10;
          reasons.push("GPA requirement flexible");
        }
      }

      // Academic level matching
      if (userProfile.academicLevel && fellowship.academicLevel) {
        if (fellowship.academicLevel.includes(userProfile.academicLevel)) {
          score += 15;
          reasons.push(`Designed for ${userProfile.academicLevel} students`);
        } else if (fellowship.academicLevel.includes('graduate')) {
          score += 5;
          reasons.push("Open to graduate students");
        }
      }

      // Interest/Field matching
      if (userProfile.interests && fellowship.fields) {
        const matchingFields = fellowship.fields.filter(field =>
          userProfile.interests!.some(interest =>
            field.toLowerCase().includes(interest.toLowerCase()) ||
            interest.toLowerCase().includes(field.toLowerCase())
          )
        );
        if (matchingFields.length > 0) {
          score += 15 + (matchingFields.length * 5);
          reasons.push(`Matches your interests: ${matchingFields.slice(0, 3).join(", ")}`);
        }
      }

      // Major matching
      if (userProfile.major && fellowship.fields) {
        if (fellowship.fields.some(f => f.toLowerCase().includes(userProfile.major!.toLowerCase()))) {
          score += 10;
          reasons.push("Aligns with your major");
        }
      }

      // Demographics matching
      if (userProfile.demographics && fellowship.targetDemographics) {
        const matchingDemo = fellowship.targetDemographics.filter(demo =>
          userProfile.demographics!.some(d => 
            demo.toLowerCase().includes(d.toLowerCase()) ||
            d.toLowerCase().includes(demo.toLowerCase())
          )
        );
        if (matchingDemo.length > 0) {
          score += 10;
          reasons.push("Targeted to your demographic");
        }
      }

      // Award amount bonus
      if (fellowship.amount >= 30000) {
        score += 5;
        reasons.push("High value award");
      }

      // Cap score at 100
      score = Math.min(100, Math.max(0, score));

      if (score >= 40) {
        matches.push({
          fellowship,
          matchScore: score,
          matchReasons: reasons.length > 0 ? reasons : ["General eligibility"]
        });
      }
    }

    // Sort by match score descending
    matches.sort((a, b) => b.matchScore - a.matchScore);
    return matches;
  }

  async saveFellowship(userId: string, fellowshipId: number, notes?: string) {
    const existing = await db
      .select()
      .from(savedFellowships)
      .where(and(
        eq(savedFellowships.userId, userId),
        eq(savedFellowships.fellowshipId, fellowshipId)
      ));

    if (existing.length > 0) {
      return existing[0];
    }

    const fellowship = await this.getFellowshipById(fellowshipId);
    
    const [saved] = await db.insert(savedFellowships).values({
      userId,
      fellowshipId,
      deadline: fellowship?.deadline || null,
      notes: notes || null,
      createdAt: new Date().toISOString()
    }).returning();

    return saved;
  }

  async unsaveFellowship(userId: string, fellowshipId: number) {
    await db.delete(savedFellowships).where(and(
      eq(savedFellowships.userId, userId),
      eq(savedFellowships.fellowshipId, fellowshipId)
    ));
  }

  async getSavedFellowships(userId: string) {
    const saved = await db
      .select()
      .from(savedFellowships)
      .where(eq(savedFellowships.userId, userId));

    const fellowshipIds = saved.map(s => s.fellowshipId);
    const fellowshipDetails = await Promise.all(
      fellowshipIds.map(id => this.getFellowshipById(id))
    );

    return saved.map((s, i) => ({
      ...s,
      fellowship: fellowshipDetails[i]
    })).filter(s => s.fellowship);
  }

  async updateSavedFellowship(userId: string, fellowshipId: number, updates: {
    applicationStatus?: string;
    notes?: string;
  }) {
    await db.update(savedFellowships)
      .set(updates)
      .where(and(
        eq(savedFellowships.userId, userId),
        eq(savedFellowships.fellowshipId, fellowshipId)
      ));
  }

  getFilterOptions() {
    return {
      types: ["research", "professional", "academic", "postdoc", "dissertation"],
      categories: ["STEM", "humanities", "social-sciences", "arts", "interdisciplinary"],
      academicLevels: ["undergraduate", "graduate", "masters", "doctoral", "postdoc"],
      amountRanges: [
        { label: "Under $10,000", min: 0, max: 10000 },
        { label: "$10,000 - $30,000", min: 10000, max: 30000 },
        { label: "$30,000 - $50,000", min: 30000, max: 50000 },
        { label: "Over $50,000", min: 50000, max: null }
      ],
      competitiveness: ["moderate", "high", "very-high"]
    };
  }
}

export const fellowshipService = new FellowshipService();
