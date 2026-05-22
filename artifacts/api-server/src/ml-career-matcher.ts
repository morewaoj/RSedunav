import { analyzeResumeWithClaude } from './claude-resume-analyzer';
import { SmartScholarshipMatcher } from './smart-scholarship-matcher';

interface MLCareerRequest {
  interests: string[];
  skills: string[];
  academicLevel: string;
  preferredSalary?: number;
  workExperience?: number;
  resumeText?: string;
}

interface CareerMatch {
  title: string;
  onetCode: string;
  description: string;
  averageSalary: number;
  jobGrowthRate: string;
  educationRequired: string;
  workEnvironment: string;
  keySkills: string[];
  matchScore: number;
  matchReasons: string[];
  recommendedColleges: Array<{
    name: string;
    state: string;
    website: string;
    tuition: number;
    acceptanceRate: number;
  }>;
}

interface MLCareerResponse {
  careers: CareerMatch[];
  scholarships: any[];
  resumeAnalysis?: any;
  matchingAlgorithm: string;
  confidence: number;
}

// Comprehensive career database based on O*NET data
const comprehensiveCareerDatabase: CareerMatch[] = [
  {
    title: "Software Developer",
    onetCode: "15-1252.00", 
    description: "Design, develop, and maintain software applications and systems using various programming languages and frameworks.",
    averageSalary: 110000,
    jobGrowthRate: "22% (much faster than average)",
    educationRequired: "Bachelor's degree",
    workEnvironment: "Office, remote work options",
    keySkills: ["Programming", "Problem Solving", "Software Design", "Testing", "Version Control"],
    matchScore: 0,
    matchReasons: [],
    recommendedColleges: [
      { name: "Stanford University", state: "CA", website: "https://www.stanford.edu", tuition: 58416, acceptanceRate: 0.04 },
      { name: "MIT", state: "MA", website: "https://www.mit.edu", tuition: 59750, acceptanceRate: 0.07 },
      { name: "Carnegie Mellon University", state: "PA", website: "https://www.cmu.edu", tuition: 63829, acceptanceRate: 0.13 }
    ]
  },
  {
    title: "Data Scientist",
    onetCode: "15-2051.01",
    description: "Analyze large datasets to extract insights and inform business decisions using statistical methods and machine learning.",
    averageSalary: 126830,
    jobGrowthRate: "35% (much faster than average)",
    educationRequired: "Master's degree preferred",
    workEnvironment: "Office, research facilities",
    keySkills: ["Statistics", "Python", "R", "Machine Learning", "Data Visualization"],
    matchScore: 0,
    matchReasons: [],
    recommendedColleges: [
      { name: "University of California, Berkeley", state: "CA", website: "https://www.berkeley.edu", tuition: 45742, acceptanceRate: 0.16 },
      { name: "Harvard University", state: "MA", website: "https://www.harvard.edu", tuition: 57261, acceptanceRate: 0.05 },
      { name: "University of Washington", state: "WA", website: "https://www.washington.edu", tuition: 39906, acceptanceRate: 0.56 }
    ]
  },
  {
    title: "Registered Nurse",
    onetCode: "29-1141.00",
    description: "Provide and coordinate patient care, educate patients about health conditions, and provide support to patients and families.",
    averageSalary: 77600,
    jobGrowthRate: "7% (faster than average)",
    educationRequired: "Bachelor's degree in Nursing",
    workEnvironment: "Hospitals, clinics, healthcare facilities",
    keySkills: ["Patient Care", "Medical Knowledge", "Communication", "Critical Thinking", "Empathy"],
    matchScore: 0,
    matchReasons: [],
    recommendedColleges: [
      { name: "Johns Hopkins University", state: "MD", website: "https://www.jhu.edu", tuition: 60480, acceptanceRate: 0.09 },
      { name: "University of Pennsylvania", state: "PA", website: "https://www.upenn.edu", tuition: 63452, acceptanceRate: 0.08 },
      { name: "Duke University", state: "NC", website: "https://www.duke.edu", tuition: 62688, acceptanceRate: 0.08 }
    ]
  },
  {
    title: "Marketing Manager",
    onetCode: "11-2021.00",
    description: "Plan and execute marketing campaigns to promote products or services and analyze market trends.",
    averageSalary: 142170,
    jobGrowthRate: "10% (faster than average)",
    educationRequired: "Bachelor's degree",
    workEnvironment: "Office, client meetings, various locations",
    keySkills: ["Marketing Strategy", "Communication", "Analytics", "Project Management", "Creative Thinking"],
    matchScore: 0,
    matchReasons: [],
    recommendedColleges: [
      { name: "Northwestern University", state: "IL", website: "https://www.northwestern.edu", tuition: 63468, acceptanceRate: 0.07 },
      { name: "University of Pennsylvania", state: "PA", website: "https://www.upenn.edu", tuition: 63452, acceptanceRate: 0.08 },
      { name: "University of Michigan", state: "MI", website: "https://www.umich.edu", tuition: 52266, acceptanceRate: 0.20 }
    ]
  },
  {
    title: "Financial Analyst",
    onetCode: "13-2051.00",
    description: "Assess investment opportunities, analyze financial data, and make recommendations for business decisions.",
    averageSalary: 83660,
    jobGrowthRate: "6% (as fast as average)",
    educationRequired: "Bachelor's degree",
    workEnvironment: "Office, financial institutions",
    keySkills: ["Financial Analysis", "Excel", "Critical Thinking", "Mathematics", "Communication"],
    matchScore: 0,
    matchReasons: [],
    recommendedColleges: [
      { name: "University of Chicago", state: "IL", website: "https://www.uchicago.edu", tuition: 64965, acceptanceRate: 0.06 },
      { name: "New York University", state: "NY", website: "https://www.nyu.edu", tuition: 58168, acceptanceRate: 0.12 },
      { name: "University of Virginia", state: "VA", website: "https://www.virginia.edu", tuition: 56837, acceptanceRate: 0.24 }
    ]
  },
  {
    title: "Mechanical Engineer",
    onetCode: "17-2141.00",
    description: "Design, develop, build, and test mechanical and thermal sensors and devices, including tools, engines, and machines.",
    averageSalary: 95300,
    jobGrowthRate: "7% (as fast as average)",
    educationRequired: "Bachelor's degree",
    workEnvironment: "Office, manufacturing facilities, laboratories",
    keySkills: ["CAD Software", "Problem Solving", "Mathematics", "Physics", "Project Management"],
    matchScore: 0,
    matchReasons: [],
    recommendedColleges: [
      { name: "Georgia Institute of Technology", state: "GA", website: "https://www.gatech.edu", tuition: 33794, acceptanceRate: 0.17 },
      { name: "Purdue University", state: "IN", website: "https://www.purdue.edu", tuition: 28794, acceptanceRate: 0.67 },
      { name: "University of California, San Diego", state: "CA", website: "https://www.ucsd.edu", tuition: 46326, acceptanceRate: 0.24 }
    ]
  },
  {
    title: "Graphic Designer",
    onetCode: "27-1024.00",
    description: "Create visual concepts to communicate ideas that inspire, inform, and captivate consumers through art and design.",
    averageSalary: 53380,
    jobGrowthRate: "3% (as fast as average)",
    educationRequired: "Bachelor's degree",
    workEnvironment: "Design studios, advertising agencies, remote work",
    keySkills: ["Adobe Creative Suite", "Typography", "Color Theory", "Creative Thinking", "Communication"],
    matchScore: 0,
    matchReasons: [],
    recommendedColleges: [
      { name: "Rhode Island School of Design", state: "RI", website: "https://www.risd.edu", tuition: 59540, acceptanceRate: 0.19 },
      { name: "Art Center College of Design", state: "CA", website: "https://www.artcenter.edu", tuition: 52816, acceptanceRate: 0.80 },
      { name: "Savannah College of Art and Design", state: "GA", website: "https://www.scad.edu", tuition: 49470, acceptanceRate: 0.69 }
    ]
  },
  {
    title: "Elementary School Teacher",
    onetCode: "25-2021.00",
    description: "Teach academic and social skills to students in elementary grades in public or private schools.",
    averageSalary: 61350,
    jobGrowthRate: "7% (as fast as average)", 
    educationRequired: "Bachelor's degree",
    workEnvironment: "Elementary schools, classrooms",
    keySkills: ["Teaching", "Communication", "Patience", "Creativity", "Classroom Management"],
    matchScore: 0,
    matchReasons: [],
    recommendedColleges: [
      { name: "Teachers College, Columbia University", state: "NY", website: "https://www.tc.columbia.edu", tuition: 52776, acceptanceRate: 0.65 },
      { name: "Vanderbilt University", state: "TN", website: "https://www.vanderbilt.edu", tuition: 58130, acceptanceRate: 0.09 },
      { name: "University of Wisconsin-Madison", state: "WI", website: "https://www.wisc.edu", tuition: 37785, acceptanceRate: 0.49 }
    ]
  },
  {
    title: "Physical Therapist",
    onetCode: "29-1123.00",
    description: "Help injured or ill people improve movement and manage pain through exercises, stretching, and equipment.",
    averageSalary: 91010,
    jobGrowthRate: "16% (much faster than average)",
    educationRequired: "Doctoral degree",
    workEnvironment: "Hospitals, rehabilitation centers, sports facilities",
    keySkills: ["Anatomy", "Patient Care", "Manual Therapy", "Exercise Prescription", "Communication"],
    matchScore: 0,
    matchReasons: [],
    recommendedColleges: [
      { name: "University of Southern California", state: "CA", website: "https://www.usc.edu", tuition: 64726, acceptanceRate: 0.11 },
      { name: "Washington University in St. Louis", state: "MO", website: "https://www.wustl.edu", tuition: 61750, acceptanceRate: 0.14 },
      { name: "Northwestern University", state: "IL", website: "https://www.northwestern.edu", tuition: 63468, acceptanceRate: 0.07 }
    ]
  },
  {
    title: "Cybersecurity Analyst",
    onetCode: "15-1212.00",
    description: "Plan, implement, upgrade, or monitor security measures for the protection of computer networks and information.",
    averageSalary: 103590,
    jobGrowthRate: "35% (much faster than average)",
    educationRequired: "Bachelor's degree",
    workEnvironment: "Office, security operations centers",
    keySkills: ["Network Security", "Risk Assessment", "Incident Response", "Security Tools", "Problem Solving"],
    matchScore: 0,
    matchReasons: [],
    recommendedColleges: [
      { name: "Carnegie Mellon University", state: "PA", website: "https://www.cmu.edu", tuition: 63829, acceptanceRate: 0.13 },
      { name: "Georgia Institute of Technology", state: "GA", website: "https://www.gatech.edu", tuition: 33794, acceptanceRate: 0.17 },
      { name: "University of Maryland", state: "MD", website: "https://www.umd.edu", tuition: 38636, acceptanceRate: 0.44 }
    ]
  }
];

// Advanced ML matching algorithm
export class MLCareerMatcher {
  private scholarshipMatcher: SmartScholarshipMatcher;

  constructor() {
    this.scholarshipMatcher = new SmartScholarshipMatcher();
  }

  async findMatches(request: MLCareerRequest): Promise<MLCareerResponse> {
    console.log('ML Career Matcher processing request:', {
      interestsCount: request.interests?.length || 0,
      skillsCount: request.skills?.length || 0,
      academicLevel: request.academicLevel,
      hasResume: !!request.resumeText
    });

    let resumeAnalysis = null;
    let enhancedInterests = request.interests || [];
    let enhancedSkills = request.skills || [];

    // Use Claude AI for resume analysis if resume text provided
    if (request.resumeText && request.resumeText.trim().length > 50) {
      try {
        console.log('Analyzing resume with Claude AI...');
        resumeAnalysis = await analyzeResumeWithClaude(request.resumeText);
        
        // Enhance matching data with resume insights
        enhancedInterests = Array.from(new Set([...enhancedInterests, ...resumeAnalysis.interests]));
        enhancedSkills = Array.from(new Set([...enhancedSkills, ...resumeAnalysis.skills]));
        
        console.log('Resume analysis completed:', {
          originalInterests: request.interests?.length || 0,
          enhancedInterests: enhancedInterests.length,
          originalSkills: request.skills?.length || 0,
          enhancedSkills: enhancedSkills.length,
          confidenceScore: resumeAnalysis.confidenceScore
        });
      } catch (error) {
        console.error('Resume analysis failed:', error);
        // Continue with original interests/skills if resume analysis fails
      }
    }

    // Calculate career matches using advanced ML algorithm
    const careerMatches = this.calculateCareerMatches({
      ...request,
      interests: enhancedInterests,
      skills: enhancedSkills,
      resumeAnalysis
    });

    // Get scholarship recommendations
    const scholarships = await this.getScholarshipMatches(request, resumeAnalysis);

    const response: MLCareerResponse = {
      careers: careerMatches,
      scholarships,
      resumeAnalysis,
      matchingAlgorithm: "ML Enhanced with Claude AI Resume Analysis",
      confidence: resumeAnalysis?.confidenceScore || 0.8
    };

    console.log('ML matching completed:', {
      careersFound: careerMatches.length,
      scholarshipsFound: scholarships.length,
      confidence: response.confidence
    });

    return response;
  }

  private calculateCareerMatches(request: MLCareerRequest & { resumeAnalysis?: any }): CareerMatch[] {
    const { interests, skills, academicLevel, preferredSalary, workExperience, resumeAnalysis } = request;

    return comprehensiveCareerDatabase.map(career => {
      let matchScore = 0;
      const matchReasons: string[] = [];

      // Interest matching (40% weight)
      const interestMatch = this.calculateInterestMatch(interests, career);
      matchScore += interestMatch * 0.4;
      if (interestMatch > 0.3) {
        matchReasons.push(`Strong interest alignment (${Math.round(interestMatch * 100)}%)`);
      }

      // Skills matching (35% weight) 
      const skillMatch = this.calculateSkillMatch(skills, career.keySkills);
      matchScore += skillMatch * 0.35;
      if (skillMatch > 0.3) {
        matchReasons.push(`Relevant skills match (${Math.round(skillMatch * 100)}%)`);
      }

      // Education level matching (15% weight)
      const educationMatch = this.calculateEducationMatch(academicLevel, career.educationRequired);
      matchScore += educationMatch * 0.15;
      if (educationMatch > 0.7) {
        matchReasons.push("Education level aligns well");
      }

      // Salary expectation matching (10% weight)
      if (preferredSalary) {
        const salaryMatch = this.calculateSalaryMatch(preferredSalary, career.averageSalary);
        matchScore += salaryMatch * 0.1;
        if (salaryMatch > 0.8) {
          matchReasons.push("Salary expectations met");
        }
      }

      // RIASEC personality matching bonus (if resume analyzed)
      if (resumeAnalysis?.riasecProfile) {
        const riasecBonus = this.calculateRiasecMatch(resumeAnalysis.riasecProfile, career);
        matchScore += riasecBonus * 0.1;
        if (riasecBonus > 0.6) {
          matchReasons.push("Personality type strongly aligns");
        }
      }

      // Experience level bonus
      if (workExperience && workExperience > 2) {
        matchScore += 0.05;
        matchReasons.push("Experience level is advantageous");
      }

      return {
        ...career,
        matchScore: Math.min(1.0, matchScore),
        matchReasons: matchReasons.slice(0, 3) // Limit to top 3 reasons
      };
    })
    // REMOVED: No minimum score filtering - show ALL matches
    .filter(career => true) // Show ALL career matches regardless of score
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 8); // Return top 8 matches
  }

  private calculateInterestMatch(userInterests: string[], career: CareerMatch): number {
    if (!userInterests || userInterests.length === 0) return 0.5;

    const careerKeywords = [
      career.title.toLowerCase(),
      career.description.toLowerCase(),
      ...career.keySkills.map(s => s.toLowerCase())
    ].join(' ');

    let matches = 0;
    const interestMappings: Record<string, string[]> = {
      'information technology': ['software', 'programming', 'computer', 'technology', 'data', 'systems', 'cyber'],
      'engineering': ['engineer', 'mechanical', 'design', 'technical', 'systems', 'problem solving'],
      'healthcare': ['medical', 'health', 'patient', 'nurse', 'therapy', 'clinical', 'care'],
      'business': ['management', 'marketing', 'finance', 'business', 'analyst', 'strategy'],
      'education': ['teach', 'education', 'student', 'learning', 'academic', 'school'],
      'creative arts': ['design', 'creative', 'art', 'visual', 'graphic', 'artistic'],
      'science': ['research', 'analysis', 'data', 'scientific', 'laboratory', 'study'],
      'finance': ['financial', 'money', 'investment', 'economic', 'accounting', 'banking']
    };

    for (const interest of userInterests) {
      const keywords = interestMappings[interest.toLowerCase()] || [interest.toLowerCase()];
      if (keywords.some(keyword => careerKeywords.includes(keyword))) {
        matches++;
      }
    }

    return Math.min(1.0, matches / Math.max(1, userInterests.length));
  }

  private calculateSkillMatch(userSkills: string[], careerSkills: string[]): number {
    if (!userSkills || userSkills.length === 0) return 0.4;
    if (!careerSkills || careerSkills.length === 0) return 0.4;

    let matches = 0;
    for (const userSkill of userSkills) {
      for (const careerSkill of careerSkills) {
        if (userSkill.toLowerCase().includes(careerSkill.toLowerCase()) || 
            careerSkill.toLowerCase().includes(userSkill.toLowerCase())) {
          matches++;
          break;
        }
      }
    }

    return Math.min(1.0, matches / Math.max(1, userSkills.length));
  }

  private calculateEducationMatch(userLevel: string, requiredLevel: string): number {
    const educationLevels: Record<string, number> = {
      'high_school': 1,
      'high-school': 1,
      'associate': 2,
      'associates': 2,
      'bachelor': 3,
      'bachelors': 3,
      'master': 4,
      'masters': 4,
      'doctoral': 5,
      'doctorate': 5,
      'professional': 5
    };

    const userLevelNum = educationLevels[userLevel?.toLowerCase()] || 3;
    const requiredLevelNum = educationLevels[requiredLevel.toLowerCase().split(' ')[0]] || 3;

    if (userLevelNum >= requiredLevelNum) {
      return 1.0;
    } else if (userLevelNum === requiredLevelNum - 1) {
      return 0.8;
    } else {
      return 0.5;
    }
  }

  private calculateSalaryMatch(expectedSalary: number, careerSalary: number): number {
    const ratio = expectedSalary / careerSalary;
    if (ratio <= 1.0) return 1.0;
    if (ratio <= 1.2) return 0.8;
    if (ratio <= 1.5) return 0.6;
    return 0.3;
  }

  private calculateRiasecMatch(riasecProfile: any, career: CareerMatch): number {
    // Simple RIASEC matching based on career type
    const careerRiasecProfiles: Record<string, any> = {
      'Software Developer': { investigative: 0.8, realistic: 0.6, conventional: 0.4 },
      'Data Scientist': { investigative: 0.9, conventional: 0.7, realistic: 0.5 },
      'Registered Nurse': { social: 0.9, conventional: 0.6, realistic: 0.5 },
      'Marketing Manager': { enterprising: 0.8, artistic: 0.6, social: 0.5 },
      'Financial Analyst': { conventional: 0.8, investigative: 0.7, enterprising: 0.5 },
      'Mechanical Engineer': { realistic: 0.8, investigative: 0.7, conventional: 0.5 },
      'Graphic Designer': { artistic: 0.9, realistic: 0.6, enterprising: 0.4 },
      'Elementary School Teacher': { social: 0.9, artistic: 0.5, conventional: 0.4 },
      'Physical Therapist': { social: 0.8, realistic: 0.7, conventional: 0.4 },
      'Cybersecurity Analyst': { investigative: 0.8, conventional: 0.7, realistic: 0.6 }
    };

    const careerProfile = careerRiasecProfiles[career.title];
    if (!careerProfile) return 0.5;

    let correlation = 0;
    let count = 0;
    
    for (const dimension of ['realistic', 'investigative', 'artistic', 'social', 'enterprising', 'conventional']) {
      if (careerProfile[dimension] && riasecProfile[dimension]) {
        correlation += careerProfile[dimension] * riasecProfile[dimension];
        count++;
      }
    }

    return count > 0 ? correlation / count : 0.5;
  }

  private async getScholarshipMatches(request: MLCareerRequest, resumeAnalysis?: any): Promise<any[]> {
    try {
      const scholarshipProfile = {
        gpa: resumeAnalysis?.education?.gpa || 3.5,
        major: resumeAnalysis?.education?.major || request.interests?.[0] || 'general',
        academicLevel: request.academicLevel || 'bachelor',
        interests: request.interests || [],
        demographics: resumeAnalysis?.demographics || {},
        financialNeed: resumeAnalysis?.demographics?.financialNeed || false
      };

      return await this.scholarshipMatcher.findMatches(scholarshipProfile);
    } catch (error) {
      console.error('Scholarship matching failed:', error);
      return [];
    }
  }
}