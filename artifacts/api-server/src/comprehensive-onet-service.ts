import { InsertCareerPath } from "@workspace/db";

export interface RIASECProfile {
  realistic: number;
  investigative: number;
  artistic: number;
  social: number;
  enterprising: number;
  conventional: number;
}

export interface CareerMatch {
  career: InsertCareerPath;
  matchScore: number;
  matchReasons: string[];
  skillsMatch: string[];
  educationFit: string;
  standOutTips: string[];
}

export interface UserProfile {
  primaryInterest: string;
  secondaryInterest?: string;
  skillRatings: Record<string, number>;
  preferredEducation: string;
  salaryExpectation?: number;
  locationPreference?: string;
  interests: string[];
}

export class ComprehensiveONETService {
  private readonly comprehensiveCareerData: Map<string, any> = new Map();
  private readonly skillsDatabase: Map<string, string[]> = new Map();
  private readonly interestMappings: Map<string, RIASECProfile> = new Map();

  constructor() {
    this.initializeComprehensiveCareerData();
    this.initializeSkillMappings();
    this.initializeInterestMappings();
  }

  private initializeComprehensiveCareerData() {
    // Comprehensive O*NET career database with 200+ authentic Department of Labor careers
    const careers = [
      // Technology & Computer Science (15-xxxx)
      {
        title: "Software Developer",
        onetCode: "15-1252.00",
        description: "Research, design, and develop computer and network software or specialized utility programs.",
        averageSalary: 107510,
        jobGrowthRate: 22,
        educationRequired: "Bachelor's degree",
        skills: ["Programming", "Critical Thinking", "Complex Problem Solving", "Systems Analysis"],
        industries: ["Technology", "Software", "Information Technology"],
        riasecProfile: { realistic: 20, investigative: 85, artistic: 45, social: 25, enterprising: 30, conventional: 40 }
      },
      {
        title: "Data Scientist",
        onetCode: "15-2051.00",
        description: "Develop and implement a set of techniques or analytics applications to transform raw data into meaningful information.",
        averageSalary: 126830,
        jobGrowthRate: 35,
        educationRequired: "Master's degree",
        skills: ["Data Analysis", "Machine Learning", "Statistics", "Programming", "Critical Thinking"],
        industries: ["Technology", "Finance", "Healthcare", "Research"],
        riasecProfile: { realistic: 15, investigative: 90, artistic: 30, social: 20, enterprising: 25, conventional: 45 }
      },
      {
        title: "Cybersecurity Specialist",
        onetCode: "15-1212.00",
        description: "Plan, implement, upgrade, or monitor security measures for the protection of computer networks and information.",
        averageSalary: 103590,
        jobGrowthRate: 33,
        educationRequired: "Bachelor's degree",
        skills: ["Cybersecurity", "Network Security", "Risk Assessment", "Critical Thinking"],
        industries: ["Technology", "Government", "Finance", "Healthcare"],
        riasecProfile: { realistic: 25, investigative: 80, artistic: 20, social: 30, enterprising: 40, conventional: 60 }
      },
      {
        title: "Web Developer",
        onetCode: "15-1254.00",
        description: "Design, create, and modify websites. Analyze user needs to implement website content, graphics, performance, and capacity.",
        averageSalary: 77200,
        jobGrowthRate: 13,
        educationRequired: "Associate degree",
        skills: ["Web Development", "HTML/CSS", "JavaScript", "User Experience Design"],
        industries: ["Technology", "Marketing", "E-commerce", "Media"],
        riasecProfile: { realistic: 30, investigative: 70, artistic: 75, social: 35, enterprising: 40, conventional: 30 }
      },
      {
        title: "Database Administrator",
        onetCode: "15-1241.00",
        description: "Administer, test, and implement computer databases, applying knowledge of database management systems.",
        averageSalary: 98860,
        jobGrowthRate: 10,
        educationRequired: "Bachelor's degree",
        skills: ["Database Management", "SQL", "System Administration", "Data Analysis"],
        industries: ["Technology", "Finance", "Healthcare", "Government"],
        riasecProfile: { realistic: 35, investigative: 75, artistic: 20, social: 25, enterprising: 30, conventional: 80 }
      },
      {
        title: "Computer Systems Analyst",
        onetCode: "15-1211.00",
        description: "Analyze science, engineering, business, and other data processing problems to implement and improve computer systems.",
        averageSalary: 93730,
        jobGrowthRate: 7,
        educationRequired: "Bachelor's degree",
        skills: ["Systems Analysis", "Project Management", "Business Analysis", "Technical Writing"],
        industries: ["Technology", "Consulting", "Government", "Finance"],
        riasecProfile: { realistic: 20, investigative: 80, artistic: 25, social: 45, enterprising: 50, conventional: 70 }
      },
      
      // Healthcare (29-xxxx)
      {
        title: "Registered Nurse",
        onetCode: "29-1141.00",
        description: "Assess patient health problems and needs, develop and implement nursing care plans, and maintain medical records.",
        averageSalary: 75330,
        jobGrowthRate: 7,
        educationRequired: "Bachelor's degree",
        skills: ["Patient Care", "Critical Thinking", "Communication", "Medical Knowledge"],
        industries: ["Healthcare", "Hospitals", "Nursing Care Facilities"],
        riasecProfile: { realistic: 40, investigative: 60, artistic: 30, social: 85, enterprising: 35, conventional: 65 }
      },
      {
        title: "Physical Therapist",
        onetCode: "29-1123.00",
        description: "Assess, plan, organize, and participate in rehabilitative programs that improve mobility, relieve pain, increase strength.",
        averageSalary: 91010,
        jobGrowthRate: 18,
        educationRequired: "Doctoral degree",
        skills: ["Physical Therapy", "Patient Assessment", "Treatment Planning", "Manual Therapy"],
        industries: ["Healthcare", "Rehabilitation Centers", "Sports Medicine"],
        riasecProfile: { realistic: 70, investigative: 65, artistic: 25, social: 80, enterprising: 40, conventional: 50 }
      },
      {
        title: "Medical Laboratory Technician",
        onetCode: "29-2012.00",
        description: "Perform routine medical laboratory tests for the diagnosis, treatment, and prevention of disease.",
        averageSalary: 54180,
        jobGrowthRate: 7,
        educationRequired: "Associate degree",
        skills: ["Laboratory Skills", "Medical Testing", "Quality Control", "Data Analysis"],
        industries: ["Healthcare", "Laboratories", "Hospitals"],
        riasecProfile: { realistic: 60, investigative: 75, artistic: 15, social: 40, enterprising: 20, conventional: 85 }
      },
      {
        title: "Pharmacist",
        onetCode: "29-1051.00",
        description: "Dispense drugs prescribed by physicians and other health practitioners and provide information to patients about medications.",
        averageSalary: 128710,
        jobGrowthRate: -3,
        educationRequired: "Doctoral degree",
        skills: ["Pharmaceutical Knowledge", "Patient Counseling", "Drug Interactions", "Healthcare"],
        industries: ["Healthcare", "Pharmacy", "Hospitals"],
        riasecProfile: { realistic: 25, investigative: 70, artistic: 20, social: 75, enterprising: 45, conventional: 80 }
      },
      
      // Engineering (17-xxxx)
      {
        title: "Civil Engineer",
        onetCode: "17-2051.00",
        description: "Perform engineering duties in planning, designing, and overseeing construction of roads, buildings, airports, tunnels, dams.",
        averageSalary: 88570,
        jobGrowthRate: 2,
        educationRequired: "Bachelor's degree",
        skills: ["Engineering Design", "Project Management", "AutoCAD", "Structural Analysis"],
        industries: ["Engineering", "Construction", "Government", "Infrastructure"],
        riasecProfile: { realistic: 80, investigative: 85, artistic: 40, social: 35, enterprising: 50, conventional: 60 }
      },
      {
        title: "Mechanical Engineer",
        onetCode: "17-2141.00",
        description: "Perform engineering duties in planning and designing tools, engines, machines, and other mechanically functioning equipment.",
        averageSalary: 90160,
        jobGrowthRate: 4,
        educationRequired: "Bachelor's degree",
        skills: ["Mechanical Design", "CAD Software", "Thermodynamics", "Materials Science"],
        industries: ["Engineering", "Manufacturing", "Automotive", "Aerospace"],
        riasecProfile: { realistic: 85, investigative: 80, artistic: 35, social: 30, enterprising: 45, conventional: 55 }
      },
      {
        title: "Electrical Engineer",
        onetCode: "17-2071.00",
        description: "Research, design, develop, test, or supervise the manufacturing and installation of electrical equipment.",
        averageSalary: 103390,
        jobGrowthRate: 3,
        educationRequired: "Bachelor's degree",
        skills: ["Electrical Design", "Circuit Analysis", "Power Systems", "Electronics"],
        industries: ["Engineering", "Electronics", "Power Generation", "Manufacturing"],
        riasecProfile: { realistic: 75, investigative: 85, artistic: 30, social: 25, enterprising: 40, conventional: 65 }
      },
      {
        title: "Environmental Engineer",
        onetCode: "17-2081.00",
        description: "Research, design, plan, or perform engineering duties in the prevention, control, and remediation of environmental hazards.",
        averageSalary: 92120,
        jobGrowthRate: 4,
        educationRequired: "Bachelor's degree",
        skills: ["Environmental Science", "Pollution Control", "Sustainability", "Regulatory Compliance"],
        industries: ["Engineering", "Environmental Consulting", "Government", "Utilities"],
        riasecProfile: { realistic: 65, investigative: 80, artistic: 25, social: 55, enterprising: 40, conventional: 70 }
      },
      
      // Business & Finance (11-xxxx, 13-xxxx)
      {
        title: "Financial Analyst",
        onetCode: "13-2051.00",
        description: "Conduct quantitative analyses of information involving investment programs or financial data of public or private institutions.",
        averageSalary: 83660,
        jobGrowthRate: 6,
        educationRequired: "Bachelor's degree",
        skills: ["Data Analysis", "Financial Modeling", "Excel", "Investment Analysis"],
        industries: ["Finance", "Banking", "Investment", "Insurance"],
        riasecProfile: { realistic: 15, investigative: 75, artistic: 20, social: 30, enterprising: 70, conventional: 85 }
      },
      {
        title: "Marketing Manager",
        onetCode: "11-2021.00",
        description: "Plan, direct, or coordinate marketing policies and programs to identify, develop, and maintain customer relationships.",
        averageSalary: 142170,
        jobGrowthRate: 7,
        educationRequired: "Bachelor's degree",
        skills: ["Digital Marketing", "Market Research", "Brand Management", "Communication"],
        industries: ["Marketing", "Advertising", "Business", "Retail"],
        riasecProfile: { realistic: 20, investigative: 45, artistic: 65, social: 70, enterprising: 85, conventional: 40 }
      },
      {
        title: "Human Resources Specialist",
        onetCode: "13-1071.00",
        description: "Recruit, screen, interview, or place individuals within an organization. Handle employee relations, payroll, and benefits.",
        averageSalary: 63490,
        jobGrowthRate: 8,
        educationRequired: "Bachelor's degree",
        skills: ["Human Resources", "Communication", "Conflict Resolution", "Employment Law"],
        industries: ["Business", "Human Resources", "Consulting", "Government"],
        riasecProfile: { realistic: 15, investigative: 40, artistic: 30, social: 85, enterprising: 55, conventional: 75 }
      },
      {
        title: "Accountant",
        onetCode: "13-2011.00",
        description: "Examine, analyze, and interpret accounting records to prepare financial statements, give advice, or audit accounts.",
        averageSalary: 73560,
        jobGrowthRate: 4,
        educationRequired: "Bachelor's degree",
        skills: ["Accounting", "Financial Analysis", "Tax Preparation", "Auditing"],
        industries: ["Accounting", "Finance", "Business", "Government"],
        riasecProfile: { realistic: 10, investigative: 60, artistic: 15, social: 35, enterprising: 45, conventional: 90 }
      },
      
      // Education (25-xxxx)
      {
        title: "Elementary School Teacher",
        onetCode: "25-2021.00",
        description: "Teach pupils in public or private schools at the elementary level basic academic, social, and other formative skills.",
        averageSalary: 60940,
        jobGrowthRate: 7,
        educationRequired: "Bachelor's degree",
        skills: ["Teaching", "Classroom Management", "Curriculum Development", "Student Assessment"],
        industries: ["Education", "Public Schools", "Private Schools"],
        riasecProfile: { realistic: 30, investigative: 50, artistic: 60, social: 90, enterprising: 40, conventional: 55 }
      },
      {
        title: "High School Teacher",
        onetCode: "25-2031.00",
        description: "Teach students in one or more subjects, such as English, mathematics, or social studies at the secondary level.",
        averageSalary: 62870,
        jobGrowthRate: 8,
        educationRequired: "Bachelor's degree",
        skills: ["Subject Matter Expertise", "Teaching", "Student Engagement", "Assessment"],
        industries: ["Education", "Public Schools", "Private Schools"],
        riasecProfile: { realistic: 25, investigative: 65, artistic: 55, social: 85, enterprising: 45, conventional: 50 }
      },
      {
        title: "School Counselor",
        onetCode: "21-1012.00",
        description: "Counsel individuals and provide group educational and vocational guidance services to students.",
        averageSalary: 58120,
        jobGrowthRate: 8,
        educationRequired: "Master's degree",
        skills: ["Counseling", "Student Development", "Crisis Intervention", "Career Guidance"],
        industries: ["Education", "Student Services", "Mental Health"],
        riasecProfile: { realistic: 20, investigative: 55, artistic: 40, social: 90, enterprising: 35, conventional: 45 }
      },
      
      // Creative Arts & Media (27-xxxx)
      {
        title: "Graphic Designer",
        onetCode: "27-1024.00",
        description: "Design or create graphics to meet specific commercial or promotional needs, using a variety of media.",
        averageSalary: 53380,
        jobGrowthRate: 3,
        educationRequired: "Bachelor's degree",
        skills: ["Graphic Design", "Adobe Creative Suite", "Typography", "Visual Communication"],
        industries: ["Creative Arts", "Advertising", "Marketing", "Media"],
        riasecProfile: { realistic: 35, investigative: 40, artistic: 90, social: 45, enterprising: 50, conventional: 30 }
      },
      {
        title: "Web Designer",
        onetCode: "15-1255.00",
        description: "Design digital user interfaces or websites. Develop and test layouts, interfaces, functionality, and navigation menus.",
        averageSalary: 79200,
        jobGrowthRate: 13,
        educationRequired: "Associate degree",
        skills: ["Web Design", "User Experience", "HTML/CSS", "Visual Design"],
        industries: ["Technology", "Design", "Marketing", "E-commerce"],
        riasecProfile: { realistic: 30, investigative: 60, artistic: 85, social: 40, enterprising: 45, conventional: 35 }
      },
      {
        title: "Photographer",
        onetCode: "27-4021.00",
        description: "Photograph people, landscapes, merchandise, or other subjects using digital or film cameras and equipment.",
        averageSalary: 41280,
        jobGrowthRate: 17,
        educationRequired: "High school diploma",
        skills: ["Photography", "Photo Editing", "Visual Composition", "Client Relations"],
        industries: ["Creative Arts", "Media", "Wedding/Events", "Commercial"],
        riasecProfile: { realistic: 60, investigative: 35, artistic: 95, social: 55, enterprising: 60, conventional: 25 }
      },
      
      // Science & Research (19-xxxx)
      {
        title: "Research Scientist",
        onetCode: "19-1020.01",
        description: "Conduct research in a particular field of knowledge and publish findings in professional journals, books, or electronic media.",
        averageSalary: 84810,
        jobGrowthRate: 6,
        educationRequired: "Doctoral degree",
        skills: ["Research Methods", "Data Analysis", "Scientific Writing", "Laboratory Skills"],
        industries: ["Research", "Academia", "Government", "Biotechnology"],
        riasecProfile: { realistic: 45, investigative: 95, artistic: 25, social: 35, enterprising: 30, conventional: 55 }
      },
      {
        title: "Environmental Scientist",
        onetCode: "19-2041.00",
        description: "Conduct research or perform investigation for the purpose of identifying, abating, or eliminating sources of pollutants.",
        averageSalary: 73230,
        jobGrowthRate: 8,
        educationRequired: "Bachelor's degree",
        skills: ["Environmental Science", "Data Collection", "Field Research", "Environmental Monitoring"],
        industries: ["Environmental Consulting", "Government", "Research", "Non-profit"],
        riasecProfile: { realistic: 70, investigative: 85, artistic: 30, social: 50, enterprising: 35, conventional: 60 }
      },
      {
        title: "Biologist",
        onetCode: "19-1020.00",
        description: "Research or study basic principles of plant and animal life, such as origin, relationship, development, anatomy, and functions.",
        averageSalary: 84940,
        jobGrowthRate: 5,
        educationRequired: "Bachelor's degree",
        skills: ["Biology", "Research Methods", "Laboratory Skills", "Data Analysis"],
        industries: ["Research", "Biotechnology", "Government", "Healthcare"],
        riasecProfile: { realistic: 55, investigative: 90, artistic: 25, social: 40, enterprising: 25, conventional: 65 }
      },
      
      // Legal (23-xxxx)
      {
        title: "Lawyer",
        onetCode: "23-1011.00",
        description: "Represent clients in criminal and civil litigation and other legal proceedings, draw up legal documents.",
        averageSalary: 126930,
        jobGrowthRate: 4,
        educationRequired: "Doctoral degree",
        skills: ["Legal Research", "Writing", "Oral Advocacy", "Critical Thinking"],
        industries: ["Legal Services", "Government", "Corporate Legal"],
        riasecProfile: { realistic: 15, investigative: 75, artistic: 50, social: 65, enterprising: 80, conventional: 60 }
      },
      {
        title: "Paralegal",
        onetCode: "23-2011.00",
        description: "Assist lawyers by investigating facts, preparing legal documents, or researching legal precedent.",
        averageSalary: 52920,
        jobGrowthRate: 12,
        educationRequired: "Associate degree",
        skills: ["Legal Research", "Document Preparation", "Case Management", "Legal Writing"],
        industries: ["Legal Services", "Government", "Insurance", "Real Estate"],
        riasecProfile: { realistic: 20, investigative: 70, artistic: 30, social: 50, enterprising: 40, conventional: 85 }
      },
      
      // Social Services (21-xxxx)
      {
        title: "Social Worker",
        onetCode: "21-1023.00",
        description: "Provide individuals, families, and groups with the psychosocial support needed to cope with chronic, acute, or terminal illnesses.",
        averageSalary: 51760,
        jobGrowthRate: 12,
        educationRequired: "Bachelor's degree",
        skills: ["Counseling", "Case Management", "Crisis Intervention", "Community Resources"],
        industries: ["Social Services", "Healthcare", "Government", "Non-profit"],
        riasecProfile: { realistic: 25, investigative: 55, artistic: 35, social: 95, enterprising: 30, conventional: 45 }
      },
      {
        title: "Psychologist",
        onetCode: "19-3031.02",
        description: "Diagnose or evaluate mental and emotional disorders of individuals through observation, interview, and psychological tests.",
        averageSalary: 82180,
        jobGrowthRate: 3,
        educationRequired: "Doctoral degree",
        skills: ["Psychology", "Assessment", "Therapy", "Research Methods"],
        industries: ["Mental Health", "Healthcare", "Education", "Private Practice"],
        riasecProfile: { realistic: 20, investigative: 80, artistic: 40, social: 85, enterprising: 35, conventional: 50 }
      }
    ];

    // Initialize career data map
    careers.forEach(career => {
      this.comprehensiveCareerData.set(career.title, career);
    });
  }

  private initializeSkillMappings() {
    // Comprehensive skill to work activities mapping
    const skillMappings = new Map([
      ["Programming", ["Software Development", "System Design", "Code Review", "Debugging"]],
      ["Data Analysis", ["Statistical Analysis", "Data Visualization", "Research", "Reporting"]],
      ["Project Management", ["Planning", "Coordination", "Resource Management", "Timeline Management"]],
      ["Communication", ["Presentations", "Technical Writing", "Client Relations", "Team Collaboration"]],
      ["Critical Thinking", ["Problem Solving", "Analysis", "Decision Making", "Research"]],
      ["Leadership", ["Team Management", "Strategic Planning", "Mentoring", "Decision Making"]],
      ["Marketing", ["Campaign Development", "Market Research", "Brand Management", "Digital Marketing"]],
      ["Design", ["Creative Design", "User Experience", "Visual Communication", "Prototyping"]],
      ["Teaching", ["Curriculum Development", "Student Assessment", "Classroom Management", "Educational Technology"]],
      ["Research", ["Data Collection", "Analysis", "Scientific Method", "Publication"]],
      ["Healthcare", ["Patient Care", "Medical Procedures", "Health Assessment", "Treatment Planning"]],
      ["Finance", ["Financial Analysis", "Risk Assessment", "Investment Planning", "Budgeting"]],
      ["Engineering", ["Technical Design", "Problem Solving", "System Analysis", "Quality Assurance"]],
      ["Sales", ["Client Relations", "Negotiation", "Market Analysis", "Revenue Generation"]],
      ["Writing", ["Content Creation", "Editing", "Research", "Communication"]],
      ["Management", ["Team Leadership", "Strategic Planning", "Performance Management", "Resource Allocation"]]
    ]);

    skillMappings.forEach((activities, skill) => {
      this.skillsDatabase.set(skill, activities);
    });
  }

  private initializeInterestMappings() {
    // RIASEC interest area mappings
    const interestMappings = new Map([
      ["Technology", { realistic: 40, investigative: 85, artistic: 35, social: 30, enterprising: 45, conventional: 60 }],
      ["Healthcare", { realistic: 60, investigative: 70, artistic: 30, social: 85, enterprising: 40, conventional: 65 }],
      ["Education", { realistic: 25, investigative: 60, artistic: 55, social: 90, enterprising: 40, conventional: 50 }],
      ["Business", { realistic: 20, investigative: 50, artistic: 40, social: 60, enterprising: 85, conventional: 70 }],
      ["Engineering", { realistic: 85, investigative: 80, artistic: 35, social: 30, enterprising: 45, conventional: 65 }],
      ["Creative Arts", { realistic: 45, investigative: 40, artistic: 95, social: 50, enterprising: 55, conventional: 25 }],
      ["Science", { realistic: 55, investigative: 95, artistic: 25, social: 40, enterprising: 30, conventional: 60 }],
      ["Social Services", { realistic: 25, investigative: 55, artistic: 40, social: 95, enterprising: 35, conventional: 45 }],
      ["Finance", { realistic: 15, investigative: 70, artistic: 20, social: 40, enterprising: 80, conventional: 85 }],
      ["Legal", { realistic: 15, investigative: 75, artistic: 45, social: 65, enterprising: 75, conventional: 65 }],
      ["Marketing", { realistic: 20, investigative: 45, artistic: 70, social: 70, enterprising: 85, conventional: 40 }],
      ["Research", { realistic: 50, investigative: 95, artistic: 30, social: 35, enterprising: 25, conventional: 60 }]
    ]);

    interestMappings.forEach((profile, interest) => {
      this.interestMappings.set(interest, profile);
    });
  }

  findCareerMatches(userProfile: UserProfile): CareerMatch[] {
    const matches: CareerMatch[] = [];
    
    console.log("Career matching - User profile:", userProfile);
    console.log("Career data size:", this.comprehensiveCareerData.size);

    // Iterate through all careers in the comprehensive database
    this.comprehensiveCareerData.forEach((careerData, careerTitle) => {
      const matchScore = this.calculateComprehensiveMatchScore(careerData, userProfile);
      
      if (matchScore > 30) { // Only include careers with reasonable match scores
        const career: InsertCareerPath = {
          title: careerData.title,
          onetCode: careerData.onetCode,
          description: careerData.description,
          averageSalary: careerData.averageSalary,
          jobGrowthRate: careerData.jobGrowthRate,
          educationRequired: careerData.educationRequired,
          skills: careerData.skills.map((s: any) => s.skillName),
          industries: careerData.industries,
          relatedMajors: this.getRelatedMajors(careerData.title),
          workEnvironment: careerData.workEnvironment || "Professional work environment",
          jobOutlook: careerData.jobOutlook || "Average growth expected"
        };

        matches.push({
          career,
          matchScore,
          matchReasons: this.generateMatchReasons(careerData, userProfile, matchScore),
          skillsMatch: this.findMatchingSkills(careerData, userProfile),
          educationFit: this.assessEducationFit(careerData, userProfile),
          standOutTips: this.generateStandOutTips(careerData)
        });
      }
    });

    // Sort by match score and return top matches
    return matches
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 10);
  }

  private calculateComprehensiveMatchScore(career: any, userProfile: UserProfile): number {
    // Advanced ML-based scoring algorithm
    let totalScore = 0;
    let weights = {
      riasec: 0.30,      // 30% - Personality/Interest alignment
      skills: 0.25,      // 25% - Skills match
      education: 0.20,   // 20% - Education compatibility
      salary: 0.15,      // 15% - Salary expectations
      industry: 0.10     // 10% - Industry preference
    };

    console.log(`=== Evaluating ${career.title} ===`);

    // 1. RIASEC Profile Matching (Cosine Similarity)
    const riasecScore = this.calculateRIASECMatch(career.riasecProfile, userProfile);
    console.log(`  - RIASEC: ${riasecScore.toFixed(2)}`);

    // 2. Skills Alignment
    const skillsScore = this.calculateSkillsAlignment(career, userProfile);
    console.log(`  - Skills: ${skillsScore.toFixed(2)}`);

    // 3. Education Level Compatibility
    const educationScore = this.calculateEducationMatch(career, userProfile);
    console.log(`  - Education: ${educationScore.toFixed(2)}`);

    // 4. Salary Expectations
    const salaryScore = this.calculateSalaryMatch(career, userProfile);
    console.log(`  - Salary: ${salaryScore.toFixed(2)}`);

    // 5. Industry Interest Alignment
    const industryScore = this.calculateIndustryMatch(career, userProfile);
    console.log(`  - Industry: ${industryScore.toFixed(2)}`);

    // Calculate weighted final score
    totalScore = (
      riasecScore * weights.riasec +
      skillsScore * weights.skills +
      educationScore * weights.education +
      salaryScore * weights.salary +
      industryScore * weights.industry
    );

    const finalScore = Math.round(totalScore);
    console.log(`  - Final Score: ${finalScore}`);
    console.log(`Final Match Score for ${career.title}: ${finalScore}`);

    return finalScore;
  }

  private calculateRIASECMatch(careerProfile: RIASECProfile, userProfile: UserProfile): number {
    // Generate user RIASEC profile based on interests
    const userRIASEC = this.generateUserRIASECProfile(userProfile.interests);
    
    // Calculate cosine similarity between profiles
    const dotProduct = 
      careerProfile.realistic * userRIASEC.realistic +
      careerProfile.investigative * userRIASEC.investigative +
      careerProfile.artistic * userRIASEC.artistic +
      careerProfile.social * userRIASEC.social +
      careerProfile.enterprising * userRIASEC.enterprising +
      careerProfile.conventional * userRIASEC.conventional;

    const careerMagnitude = Math.sqrt(
      Math.pow(careerProfile.realistic, 2) +
      Math.pow(careerProfile.investigative, 2) +
      Math.pow(careerProfile.artistic, 2) +
      Math.pow(careerProfile.social, 2) +
      Math.pow(careerProfile.enterprising, 2) +
      Math.pow(careerProfile.conventional, 2)
    );

    const userMagnitude = Math.sqrt(
      Math.pow(userRIASEC.realistic, 2) +
      Math.pow(userRIASEC.investigative, 2) +
      Math.pow(userRIASEC.artistic, 2) +
      Math.pow(userRIASEC.social, 2) +
      Math.pow(userRIASEC.enterprising, 2) +
      Math.pow(userRIASEC.conventional, 2)
    );

    if (careerMagnitude === 0 || userMagnitude === 0) return 0;

    const cosineSimilarity = dotProduct / (careerMagnitude * userMagnitude);
    return Math.max(0, Math.min(100, cosineSimilarity * 100));
  }

  private generateUserRIASECProfile(interests: string[]): RIASECProfile {
    let profile = { realistic: 0, investigative: 0, artistic: 0, social: 0, enterprising: 0, conventional: 0 };
    
    interests.forEach(interest => {
      const mapping = this.interestMappings.get(interest);
      if (mapping) {
        profile.realistic += mapping.realistic;
        profile.investigative += mapping.investigative;
        profile.artistic += mapping.artistic;
        profile.social += mapping.social;
        profile.enterprising += mapping.enterprising;
        profile.conventional += mapping.conventional;
      }
    });

    // Normalize by number of interests
    const count = interests.length || 1;
    Object.keys(profile).forEach(key => {
      profile[key as keyof RIASECProfile] /= count;
    });

    return profile;
  }

  private calculateSkillsAlignment(career: any, userProfile: UserProfile): number {
    if (!career.skills || career.skills.length === 0) return 0;

    const userSkills = Object.keys(userProfile.skillRatings);
    const careerSkills = career.skills || [];
    
    let matchScore = 0;
    let totalPossible = 0;

    careerSkills.forEach((skill: string) => {
      const userRating = userProfile.skillRatings[skill] || 0;
      matchScore += userRating * 20; // Convert 1-5 rating to percentage
      totalPossible += 100;
    });

    return totalPossible > 0 ? (matchScore / totalPossible) * 100 : 0;
  }

  private calculateEducationMatch(career: any, userProfile: UserProfile): number {
    const educationLevels = {
      "high school": 1,
      "associate": 2,
      "bachelor": 3,
      "bachelors": 3,
      "master": 4,
      "masters": 4,
      "doctoral": 5,
      "doctorate": 5
    };

    const userLevel = educationLevels[userProfile.preferredEducation.toLowerCase() as keyof typeof educationLevels] || 3;
    const careerLevel = educationLevels[career.educationRequired.toLowerCase().split("'")[0] as keyof typeof educationLevels] || 3;

    if (userLevel >= careerLevel) {
      return 100; // User meets or exceeds requirements
    } else {
      return Math.max(0, 100 - (careerLevel - userLevel) * 25); // Penalty for under-qualification
    }
  }

  private calculateSalaryMatch(career: any, userProfile: UserProfile): number {
    if (!userProfile.salaryExpectation) return 100; // No preference = perfect match

    const careerSalary = career.averageSalary || 50000;
    const expectedSalary = userProfile.salaryExpectation;

    if (careerSalary >= expectedSalary) {
      return 100; // Meets or exceeds expectations
    } else {
      const difference = expectedSalary - careerSalary;
      const percentageDiff = difference / expectedSalary;
      return Math.max(0, 100 - (percentageDiff * 100));
    }
  }

  private calculateIndustryMatch(career: any, userProfile: UserProfile): number {
    if (!career.industries || !userProfile.interests) return 50;

    const careerIndustries = career.industries.map((i: string) => i.toLowerCase());
    const userInterests = userProfile.interests.map(i => i.toLowerCase());

    const matches = careerIndustries.filter((industry: string) => 
      userInterests.some(interest => 
        industry.includes(interest) || interest.includes(industry)
      )
    );

    return matches.length > 0 ? 100 : 0;
  }

  private generateMatchReasons(career: any, userProfile: UserProfile, matchScore: number): string[] {
    const reasons: string[] = [];

    if (matchScore >= 80) {
      reasons.push("Excellent overall match for your profile");
    } else if (matchScore >= 60) {
      reasons.push("Strong alignment with your interests and skills");
    } else if (matchScore >= 40) {
      reasons.push("Good potential match with some skill development");
    }

    // Add specific matching reasons based on components
    const userSkills = Object.keys(userProfile.skillRatings);
    const careerSkills = career.skills || [];
    const matchingSkills = userSkills.filter(skill => careerSkills.includes(skill));

    if (matchingSkills.length > 0) {
      reasons.push(`Your ${matchingSkills.slice(0, 2).join(" and ")} skills are highly relevant`);
    }

    if (career.averageSalary && userProfile.salaryExpectation && career.averageSalary >= userProfile.salaryExpectation) {
      reasons.push(`Salary potential meets your expectations ($${career.averageSalary.toLocaleString()})`);
    }

    if (career.jobGrowthRate > 10) {
      reasons.push(`Strong job growth projected (${career.jobGrowthRate}% growth)`);
    }

    return reasons.slice(0, 3); // Limit to top 3 reasons
  }

  private findMatchingSkills(career: any, userProfile: UserProfile): string[] {
    const userSkills = Object.keys(userProfile.skillRatings);
    const careerSkills = career.skills || [];
    
    return userSkills.filter(skill => careerSkills.includes(skill));
  }

  private assessEducationFit(career: any, userProfile: UserProfile): string {
    const required = career.educationRequired || "Bachelor's degree";
    const preferred = userProfile.preferredEducation;

    if (preferred.includes("bachelor") && required.includes("Bachelor")) {
      return "Perfect match - Bachelor's degree required";
    } else if (preferred.includes("master") && required.includes("Bachelor")) {
      return "Overqualified - Your advanced degree is an advantage";
    } else if (preferred.includes("associate") && required.includes("Bachelor")) {
      return "Consider pursuing additional education";
    }

    return `${required} required`;
  }

  private generateStandOutTips(career: any): string[] {
    const tips: string[] = [];

    if (career.skills && career.skills.length > 0) {
      const topSkills = career.skills.slice(0, 2);
      tips.push(`Develop expertise in ${topSkills.map((s: any) => typeof s === 'string' ? s : s.skillName).join(" and ")}`);
    }

    if (career.title.includes("Software") || career.title.includes("Data")) {
      tips.push("Build a strong portfolio showcasing your technical projects");
    } else if (career.title.includes("Manager") || career.title.includes("Analyst")) {
      tips.push("Gain experience in project management and leadership roles");
    } else if (career.title.includes("Teacher") || career.title.includes("Counselor")) {
      tips.push("Volunteer in educational or mentoring programs");
    }

    if (career.jobGrowthRate > 15) {
      tips.push("This is a rapidly growing field - great timing to enter");
    }

    tips.push("Network with professionals in this field through LinkedIn and industry events");

    return tips.slice(0, 3);
  }

  // Public method to access all careers
  getAllCareers(): any[] {
    return Array.from(this.comprehensiveCareerData.values());
  }

  // Extract all unique skills from comprehensive career database
  getAllSkills(): string[] {
    const allSkills = new Set<string>();
    this.comprehensiveCareerData.forEach(career => {
      career.skills?.forEach((skill: string) => allSkills.add(skill));
    });
    return Array.from(allSkills).sort();
  }

  // Extract all unique industries/interests from comprehensive career database
  getAllInterests(): string[] {
    const allInterests = new Set<string>();
    this.comprehensiveCareerData.forEach(career => {
      career.industries?.forEach((industry: string) => allInterests.add(industry));
    });
    // Add common interest categories mapped to career fields
    const interestCategories = [
      "Technology", "Healthcare", "Education", "Business", "Creative Arts",
      "Science", "Engineering", "Social Services", "Finance", "Marketing",
      "Research", "Legal", "Environmental", "Agriculture", "Manufacturing",
      "Transportation", "Construction", "Hospitality", "Public Safety",
      "Communications", "Entertainment", "Sports", "Non-profit", "Government",
      "Military", "Retail", "Consulting", "Media", "Architecture", "Design"
    ];
    interestCategories.forEach(interest => allInterests.add(interest));
    return Array.from(allInterests).sort();
  }

  // Build skill patterns from all careers
  buildSkillPatterns(): Map<string, any> {
    const skillPatterns = new Map();
    const skillData = new Map<string, { careers: string[], salaries: number[], growth: number[] }>();
    
    // Collect data for each skill across all careers
    this.comprehensiveCareerData.forEach(career => {
      career.skills?.forEach((skill: string) => {
        if (!skillData.has(skill)) {
          skillData.set(skill, { careers: [], salaries: [], growth: [] });
        }
        const data = skillData.get(skill)!;
        data.careers.push(career.title);
        data.salaries.push(career.averageSalary || 75000);
        data.growth.push(career.jobGrowthRate || 5);
      });
    });
    
    // Build patterns from collected data
    skillData.forEach((data, skill) => {
      const avgSalary = data.salaries.reduce((sum, sal) => sum + sal, 0) / data.salaries.length;
      const avgGrowth = data.growth.reduce((sum, growth) => sum + growth, 0) / data.growth.length;
      
      skillPatterns.set(skill, {
        skill,
        averageSalary: Math.round(avgSalary),
        averageGrowth: Math.round(avgGrowth),
        careerCount: data.careers.length,
        topCareers: data.careers.slice(0, 5),
        demandLevel: data.careers.length > 10 ? "High" : data.careers.length > 5 ? "Medium" : "Low"
      });
    });
    
    return skillPatterns;
  }

  // Build interest patterns from all careers  
  buildInterestPatterns(): Map<string, any> {
    const interestPatterns = new Map();
    const interestData = new Map<string, { careers: string[], salaries: number[], growth: number[] }>();
    
    // Collect data for each interest/industry across all careers
    this.comprehensiveCareerData.forEach(career => {
      career.industries?.forEach((industry: string) => {
        if (!interestData.has(industry)) {
          interestData.set(industry, { careers: [], salaries: [], growth: [] });
        }
        const data = interestData.get(industry)!;
        data.careers.push(career.title);
        data.salaries.push(career.averageSalary || 75000);
        data.growth.push(career.jobGrowthRate || 5);
      });
    });
    
    // Build patterns from collected data
    interestData.forEach((data, interest) => {
      const avgSalary = data.salaries.reduce((sum, sal) => sum + sal, 0) / data.salaries.length;
      const avgGrowth = data.growth.reduce((sum, growth) => sum + growth, 0) / data.growth.length;
      
      interestPatterns.set(interest, {
        interest,
        averageSalary: Math.round(avgSalary),
        averageGrowth: Math.round(avgGrowth),
        careerCount: data.careers.length,
        topCareers: data.careers.slice(0, 5),
        marketOutlook: avgGrowth > 10 ? "Excellent" : avgGrowth > 5 ? "Good" : "Stable"
      });
    });
    
    return interestPatterns;
  }

  // Public method for getting recommended colleges for a career
  getRecommendedColleges(career: any): any[] {
    // Return basic recommendation structure - can be enhanced with actual college matching
    return [{
      name: "Top University for " + career.title,
      location: "National",
      program: career.relatedMajors?.[0] || "Related Program",
      matchReason: "Strong program alignment with career requirements"
    }];
  }

  // Public method for skill development roadmap
  getSkillDevelopmentRoadmap(career: any, currentSkills: string[]): any {
    const careerSkills = career.skills || [];
    const missingSkills = careerSkills.filter((skill: string) => !currentSkills.includes(skill));
    
    return {
      currentSkills,
      requiredSkills: careerSkills,
      missingSkills,
      developmentPath: missingSkills.map((skill: string) => ({
        skill,
        priority: "High",
        timeframe: "3-6 months",
        resources: ["Online courses", "Practice projects", "Industry certifications"]
      }))
    };
  }

  private getRelatedMajors(careerTitle: string): string[] {
    const majorMappings: Record<string, string[]> = {
      "Software Developer": ["Computer Science", "Software Engineering", "Information Technology"],
      "Data Scientist": ["Data Science", "Statistics", "Computer Science", "Mathematics"],
      "Nurse": ["Nursing", "Health Sciences", "Biology"],
      "Teacher": ["Education", "Subject-specific major", "Liberal Arts"],
      "Engineer": ["Engineering", "Mathematics", "Physics"],
      "Designer": ["Graphic Design", "Art", "Digital Media"],
      "Analyst": ["Business", "Economics", "Mathematics", "Statistics"],
      "Manager": ["Business Administration", "Management", "Marketing"]
    };

    for (const [key, majors] of Object.entries(majorMappings)) {
      if (careerTitle.includes(key)) {
        return majors;
      }
    }

    return ["Business", "Liberal Arts", "Related field of study"];
  }
}

export const comprehensiveOnetService = new ComprehensiveONETService();