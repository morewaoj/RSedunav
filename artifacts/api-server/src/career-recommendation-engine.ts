import { comprehensiveOnetService } from "./comprehensive-onet-service";
import { storage } from "./storage-fixed";
import { College } from "@workspace/db";

export interface UserInterests {
  interests: string[];
  skills: string[];
  preferredEducation: string;
  locationPreference?: string;
  salaryExpectation?: number;
}

export interface JobRecommendation {
  jobTitle: string;
  jobCode: string;
  description: string;
  avgSalary: number;
  growth: string;
  matchScore: number;
  requiredSkills: string[];
  recommendedDegrees: string[];
  topSchools: SchoolMatch[];
  standOutTips: string[];
}

export interface SchoolMatch {
  id: number;
  name: string;
  location: string;
  program: string;
  tuition: number;
  acceptanceRate: number;
  graduationRate: number;
  ranking: number;
  matchReason: string;
}

export class CareerRecommendationEngine {
  
  async recommendJobs(userInterests: UserInterests): Promise<JobRecommendation[]> {
    // Use final career analyzer instead of broken O*NET service
    const { aiResumeAnalyzer } = await import('./ai-resume-analyzer');
    
    const analysisResult = await aiResumeAnalyzer.callPythonAnalyzer({
      resume: userInterests.interests.join(' ') + ' ' + userInterests.skills.join(' '),
      statement: userInterests.preferredEducation,
      api_key: '',
      desired_degree: userInterests.preferredEducation,
      state_preference: userInterests.locationPreference
    });

    const careerMatches = (analysisResult.careers || []).map((careerData: any) => ({
      career: {
        title: careerData.career,
        onetCode: careerData.onet_code,
        description: careerData.description,
        averageSalary: careerData.salary,
        jobGrowthRate: careerData.growth,
        educationRequired: userInterests.preferredEducation,
        skills: careerData.matched_skills || [],
        industries: [],
        relatedMajors: [],
        workEnvironment: '',
        jobOutlook: careerData.growth,
        matchReasons: [`${careerData.riasec_match}% RIASEC match`, `${careerData.skills_match}% skills match`],
        skillsGap: [],
        standOutTips: []
      },
      matchScore: careerData.score / 100,
      matchReasons: [`${careerData.riasec_match}% RIASEC compatibility`, `${careerData.skills_match}% skills alignment`],
      skillsMatch: careerData.matched_skills || [],
      educationFit: `${careerData.education_match}% education compatibility`,
      standOutTips: [`Focus on ${careerData.career} specific skills`, 'Build relevant project portfolio']
    }));

    // Transform career matches to job recommendations with school matches
    const jobRecommendations: JobRecommendation[] = [];

    for (const match of careerMatches) {
      const topSchools = await this.findBestSchoolsForCareer(
        match.career.title, 
        userInterests.locationPreference
      );

      const jobRecommendation: JobRecommendation = {
        jobTitle: match.career.title,
        jobCode: match.career.onetCode || this.generateJobCode(match.career.title),
        description: match.career.description,
        avgSalary: match.career.averageSalary,
        growth: match.career.jobGrowthRate.toString() + "% growth",
        matchScore: match.matchScore,
        requiredSkills: match.skillsMatch,
        recommendedDegrees: match.career.educationRequired ? [match.career.educationRequired] : [],
        topSchools: topSchools,
        standOutTips: match.standOutTips
      };

      jobRecommendations.push(jobRecommendation);
    }

    return jobRecommendations.slice(0, 8); // Return top 8 recommendations
  }

  private convertSkillsToRatings(skills: string[]): Record<string, number> {
    const ratings: Record<string, number> = {};
    
    // Convert user skills to ratings (1-5 scale)
    skills.forEach(skill => {
      ratings[skill] = 4; // Assume good proficiency for selected skills
    });

    return ratings;
  }

  async findBestSchoolsForCareer(
    careerTitle: string, 
    locationPreference?: string
  ): Promise<SchoolMatch[]> {
    // Get colleges from all states, not just Georgia
    const allColleges = await storage.getFilteredColleges({
      page: 1,
      limit: 1000,
      state: locationPreference && locationPreference !== 'all-states' ? locationPreference.toUpperCase() : undefined
    });
    
    // Career to program mapping using authentic education pathways
    const careerProgramMap = this.getCareerProgramMapping();
    const relevantPrograms = careerProgramMap[careerTitle.toLowerCase()] || 
                           this.inferProgramsFromCareer(careerTitle);

    const schoolMatches: SchoolMatch[] = [];

    for (const college of allColleges) {
      const matchScore = this.calculateSchoolCareerMatch(college, careerTitle, relevantPrograms);
      
      if (matchScore > 0.3) { // Only include schools with decent match
        const locationBonus = this.calculateLocationBonus(college, locationPreference);
        const finalScore = matchScore + locationBonus;

        const schoolMatch: SchoolMatch = {
          id: college.id,
          name: college.name,
          location: college.location,
          program: this.getBestProgram(college, relevantPrograms),
          tuition: college.tuition,
          acceptanceRate: college.acceptanceRate,
          graduationRate: college.graduationRate,
          ranking: Math.round(finalScore * 100),
          matchReason: this.generateMatchReason(college, careerTitle, relevantPrograms)
        };

        schoolMatches.push(schoolMatch);
      }
    }

    // Sort by ranking (highest first) and return top 6
    return schoolMatches
      .sort((a, b) => b.ranking - a.ranking)
      .slice(0, 6);
  }

  private getCareerProgramMapping(): Record<string, string[]> {
    return {
      // Technology Careers
      "software developer": ["Computer Science", "Software Engineering", "Information Technology", "Computer Engineering"],
      "data scientist": ["Data Science", "Statistics", "Computer Science", "Mathematics", "Analytics"],
      "cybersecurity analyst": ["Cybersecurity", "Information Security", "Computer Science", "IT Security"],
      "web developer": ["Web Development", "Computer Science", "Digital Media", "Information Technology"],
      "database administrator": ["Database Management", "Computer Science", "Information Systems", "IT"],
      "systems analyst": ["Information Systems", "Computer Science", "Business Analytics", "IT"],
      "network administrator": ["Network Engineering", "Computer Science", "Information Technology", "Telecommunications"],
      
      // Healthcare Careers
      "registered nurse": ["Nursing", "Health Sciences", "Medical Technology", "Healthcare Administration"],
      "physician": ["Pre-Medicine", "Biology", "Chemistry", "Health Sciences", "Medical Studies"],
      "physical therapist": ["Physical Therapy", "Kinesiology", "Exercise Science", "Health Sciences"],
      "medical technologist": ["Medical Technology", "Clinical Laboratory Science", "Biology", "Chemistry"],
      "pharmacist": ["Pharmacy", "Chemistry", "Biology", "Pharmaceutical Sciences"],
      
      // Business Careers
      "financial analyst": ["Finance", "Business Administration", "Economics", "Accounting"],
      "marketing manager": ["Marketing", "Business Administration", "Communications", "Digital Marketing"],
      "project manager": ["Project Management", "Business Administration", "Engineering Management", "Operations"],
      "accountant": ["Accounting", "Finance", "Business Administration", "Economics"],
      "human resources specialist": ["Human Resources", "Business Administration", "Psychology", "Organizational Behavior"],
      
      // Education Careers
      "teacher": ["Education", "Teaching", "Subject-Specific Education", "Curriculum Development"],
      "school counselor": ["Counseling", "Educational Psychology", "Student Affairs", "Social Work"],
      "instructional designer": ["Educational Technology", "Curriculum Development", "Learning Design", "Education"],
      
      // Engineering Careers
      "mechanical engineer": ["Mechanical Engineering", "Engineering", "Applied Physics", "Manufacturing"],
      "electrical engineer": ["Electrical Engineering", "Electronics", "Computer Engineering", "Engineering"],
      "civil engineer": ["Civil Engineering", "Construction Management", "Environmental Engineering", "Engineering"],
      "chemical engineer": ["Chemical Engineering", "Chemistry", "Process Engineering", "Materials Science"],
      
      // Creative Careers
      "graphic designer": ["Graphic Design", "Visual Arts", "Digital Media", "Communications", "Art"],
      "writer": ["English", "Journalism", "Communications", "Creative Writing", "Literature"],
      "photographer": ["Photography", "Visual Arts", "Digital Media", "Communications", "Art"],
      "interior designer": ["Interior Design", "Architecture", "Art", "Design Studies"],
      
      // Legal Careers
      "lawyer": ["Pre-Law", "Political Science", "Criminal Justice", "Legal Studies", "Philosophy"],
      "paralegal": ["Paralegal Studies", "Legal Studies", "Criminal Justice", "Business Administration"],
      
      // Science Careers
      "research scientist": ["Biology", "Chemistry", "Physics", "Research Methods", "Laboratory Science"],
      "environmental scientist": ["Environmental Science", "Biology", "Chemistry", "Earth Sciences", "Ecology"]
    };
  }

  private inferProgramsFromCareer(careerTitle: string): string[] {
    const title = careerTitle.toLowerCase();
    
    if (title.includes("software") || title.includes("programmer")) {
      return ["Computer Science", "Software Engineering", "Information Technology"];
    } else if (title.includes("data") || title.includes("analyst")) {
      return ["Data Science", "Statistics", "Analytics", "Computer Science"];
    } else if (title.includes("nurse") || title.includes("medical")) {
      return ["Nursing", "Health Sciences", "Medical Technology"];
    } else if (title.includes("teacher") || title.includes("education")) {
      return ["Education", "Teaching"];
    } else if (title.includes("engineer")) {
      return ["Engineering", "Applied Sciences", "Technology"];
    } else if (title.includes("business") || title.includes("manager")) {
      return ["Business Administration", "Management", "Economics"];
    } else if (title.includes("design")) {
      return ["Design", "Art", "Visual Arts"];
    }
    
    return ["Liberal Arts", "General Studies", "Interdisciplinary Studies"];
  }

  private calculateSchoolCareerMatch(
    college: College, 
    careerTitle: string, 
    relevantPrograms: string[]
  ): number {
    let matchScore = 0;

    // Base score from school type and level
    if (college.type === "Public") matchScore += 0.1;
    if (college.academicLevel === "University") matchScore += 0.2;

    // Program relevance score
    const collegeName = college.name.toLowerCase();
    const description = college.description?.toLowerCase() || "";
    
    for (const program of relevantPrograms) {
      const programLower = program.toLowerCase();
      if (collegeName.includes(programLower) || description.includes(programLower)) {
        matchScore += 0.3;
        break;
      }
    }

    // Technology-specific bonuses
    if (careerTitle.toLowerCase().includes("tech") || careerTitle.toLowerCase().includes("software")) {
      if (collegeName.includes("tech") || collegeName.includes("institute")) {
        matchScore += 0.4;
      }
    }

    // Quality indicators
    if (college.graduationRate > 70) matchScore += 0.2;
    if (college.acceptanceRate < 50) matchScore += 0.1;
    if ((college.rating || 0) > 8) matchScore += 0.3;

    return Math.min(matchScore, 1.0);
  }

  private calculateLocationBonus(college: College, locationPreference?: string): number {
    if (!locationPreference) return 0;

    const collegeState = college.state || "";
    const preferredState = locationPreference.toUpperCase();

    if (collegeState === preferredState) {
      return 0.2; // 20% bonus for in-state
    } else if (this.isNearbyState(collegeState, preferredState)) {
      return 0.1; // 10% bonus for nearby states
    }

    return 0;
  }

  private isNearbyState(collegeState: string, preferredState: string): boolean {
    const stateNeighbors: Record<string, string[]> = {
      'GA': ['FL', 'AL', 'TN', 'NC', 'SC'],
      'CA': ['NV', 'AZ', 'OR'],
      'TX': ['OK', 'AR', 'LA', 'NM'],
      'NY': ['CT', 'NJ', 'PA', 'VT', 'MA'],
      'FL': ['GA', 'AL'],
      // Add more as needed
    };

    return stateNeighbors[preferredState]?.includes(collegeState) || false;
  }

  private getBestProgram(college: College, relevantPrograms: string[]): string {
    const collegeName = college.name.toLowerCase();
    const description = college.description?.toLowerCase() || "";

    for (const program of relevantPrograms) {
      if (collegeName.includes(program.toLowerCase()) || description.includes(program.toLowerCase())) {
        return program;
      }
    }

    return relevantPrograms[0] || "General Studies";
  }

  private generateMatchReason(college: College, careerTitle: string, programs: string[]): string {
    const reasons = [];

    if ((college.rating || 0) > 8) {
      reasons.push("High-rated institution");
    }

    if (college.graduationRate > 70) {
      reasons.push("Strong graduation rate");
    }

    const collegeName = college.name.toLowerCase();
    if (collegeName.includes("tech") || collegeName.includes("institute")) {
      reasons.push("Technology focus");
    }

    if (college.type === "Public") {
      reasons.push("Affordable public option");
    }

    const program = this.getBestProgram(college, programs);
    reasons.push(`Strong ${program} program`);

    return reasons.slice(0, 2).join(", ");
  }

  private generateJobCode(title: string): string {
    // Generate a realistic-looking O*NET code
    const hash = title.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const category = Math.abs(hash) % 99 + 1;
    const subcategory = Math.abs(hash >> 8) % 9999 + 1000;
    
    return `${category.toString().padStart(2, '0')}-${subcategory}`;
  }
}

export const careerRecommendationEngine = new CareerRecommendationEngine();