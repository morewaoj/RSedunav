import { db } from "./db";
import { colleges, careerPaths, scholarships } from "@workspace/db";
import { eq } from "drizzle-orm";

// Minimal raw response shapes from external feeds we ingest. Both APIs return
// open-ended documents — these interfaces capture only the fields actually
// read by the transformers below, so adding new fields later just requires
// extending the local interface rather than chasing `any` casts.
interface ScorecardSchool {
  [key: string]: unknown;
  ['school.name']: string;
  ['school.city']?: string;
  ['school.state']: string;
  ['school.school_url']?: string | null;
  ['school.ownership']?: number;
  ['latest.cost.tuition.in_state']?: number;
  ['latest.cost.tuition.out_of_state']?: number;
  ['latest.admissions.admission_rate.overall']?: number;
  ['latest.completion.completion_rate_4yr_100nt']?: number;
  ['latest.admissions.sat_scores.75th_percentile.critical_reading']?: number;
  ['latest.admissions.sat_scores.75th_percentile.math']?: number;
  ['latest.earnings.10_yrs_after_entry.median']?: number;
  ['latest.student.size']?: number;
}

interface OnetOccupation {
  title: string;
  code: string;
  description?: string;
}

// College Scorecard API Integration
export class CollegeScorecardService {
  private readonly baseUrl = "https://api.data.gov/ed/collegescorecard/v1/schools";
  
  async fetchColleges(params: {
    state?: string;
    page?: number;
    per_page?: number;
  } = {}) {
    if (!process.env.COLLEGE_SCORECARD_API_KEY) {
      throw new Error('College Scorecard API key is required');
    }

    const queryParams = new URLSearchParams({
      api_key: process.env.COLLEGE_SCORECARD_API_KEY,
      per_page: (params.per_page || 100).toString(),
      page: (params.page || 0).toString(),
      'school.operating': '1',
      'school.degrees_awarded.predominant': '3',
      'latest.academics.program_available.assoc_or_bachelors': 'true',
      fields: [
        'id',
        'school.name',
        'school.city',
        'school.state',
        'school.school_url',
        'school.ownership',
        'latest.cost.tuition.in_state',
        'latest.cost.tuition.out_of_state',
        'latest.admissions.admission_rate.overall',
        'latest.completion.completion_rate_4yr_100nt',
        'latest.student.size',
        'latest.admissions.sat_scores.75th_percentile.critical_reading',
        'latest.admissions.sat_scores.75th_percentile.math',
        'latest.earnings.10_yrs_after_entry.median',
        'school.accreditor'
      ].join(','),
      ...(params.state && { 'school.state': params.state })
    });

    const response = await fetch(`${this.baseUrl}?${queryParams}`);
    
    if (!response.ok) {
      throw new Error(`College Scorecard API error: ${response.status}`);
    }

    const data = (await response.json()) as { results?: ScorecardSchool[] };
    return data.results || [];
  }

  transformToSchema(rawData: ScorecardSchool[]) {
    console.log(`Transforming ${rawData.length} colleges from College Scorecard`);
    
    return rawData
      .filter(school => {
        const hasRequired = school['school.name'] && school['school.state'];
        if (!hasRequired) {
          console.log(`Filtering out college missing required fields:`, school);
        }
        return hasRequired;
      })
      .map(school => {
        const transformed = {
          name: school['school.name'],
          location: `${school['school.city'] || 'Unknown'}, ${school['school.state']}, United States`,
          country: 'United States',
          state: school['school.state'],
          city: school['school.city'] || 'Unknown',
          tuition: school['latest.cost.tuition.in_state'] || school['latest.cost.tuition.out_of_state'] || 0,
          acceptanceRate: Math.round((school['latest.admissions.admission_rate.overall'] || 0.5) * 100),
          graduationRate: Math.round((school['latest.completion.completion_rate_4yr_100nt'] || 0.7) * 100),
          type: school['school.ownership'] === 1 ? 'public' : 'private',
          website: school['school.school_url'] || null,
          description: this.generateDescription(school),
          imageUrl: null,
          rating: this.calculateRating(school),
          sportsPrograms: this.getSportsPrograms(school['school.state']),
          academicLevel: this.determineAcademicLevel(school),
          scholarships: this.getScholarshipTypes(school),
          walkOnAvailable: true,
          coachName: null,
          coachEmail: null,
          coachPhone: null
        };
        
        console.log(`Transformed college: ${transformed.name} - $${transformed.tuition}`);
        return transformed;
      });
  }

  private getSportsPrograms(state: string): string[] {
    // Common sports programs based on regional preferences
    const baseSports = ['basketball', 'soccer', 'tennis', 'swimming', 'track', 'volleyball'];
    const regionalSports: Record<string, string[]> = {
      'CA': ['basketball', 'soccer', 'tennis', 'swimming', 'track', 'volleyball', 'water polo'],
      'TX': ['football', 'basketball', 'baseball', 'soccer', 'track', 'tennis'],
      'FL': ['football', 'basketball', 'baseball', 'soccer', 'swimming', 'tennis', 'golf'],
      'PA': ['football', 'basketball', 'soccer', 'track', 'wrestling', 'tennis'],
      'MI': ['football', 'basketball', 'hockey', 'soccer', 'track', 'swimming'],
      'AZ': ['basketball', 'baseball', 'soccer', 'tennis', 'golf', 'track']
    };
    
    return regionalSports[state] || baseSports;
  }

  private determineAcademicLevel(school: ScorecardSchool): string {
    const admissionRate = school['latest.admissions.admission_rate.overall'] || 0.5;
    const satReading = school['latest.admissions.sat_scores.75th_percentile.critical_reading'] || 0;
    const satMath = school['latest.admissions.sat_scores.75th_percentile.math'] || 0;
    const avgSat = (satReading + satMath) / 2;

    if (admissionRate < 0.2 || avgSat > 1400) return 'high';
    if (admissionRate < 0.5 || avgSat > 1200) return 'medium';
    return 'developing';
  }

  private getScholarshipTypes(school: ScorecardSchool): string[] {
    const scholarships = ['need-based'];
    const admissionRate = school['latest.admissions.admission_rate.overall'] || 0.5;
    
    if (admissionRate < 0.3) scholarships.push('academic', 'merit-based');
    if (school['school.ownership'] === 1) scholarships.push('state-grants');
    
    return scholarships;
  }

  private calculateRating(school: ScorecardSchool): number {
    let score = 3; // Base rating
    
    const admissionRate = school['latest.admissions.admission_rate.overall'] || 0.5;
    const graduationRate = school['latest.completion.completion_rate_4yr_100nt'] || 0.7;
    const earnings = school['latest.earnings.10_yrs_after_entry.median'] || 40000;
    
    if (admissionRate < 0.2) score += 1;
    if (graduationRate > 0.8) score += 0.5;
    if (earnings > 50000) score += 0.5;
    
    return Math.min(5, Math.round(score * 2) / 2);
  }

  private generateDescription(school: ScorecardSchool): string {
    const type = school['school.ownership'] === 1 ? 'public' : 'private';
    const size = school['latest.student.size'] ?? 0;
    const sizeDesc = size > 15000 ? 'large' : size > 5000 ? 'mid-sized' : 'small';
    
    return `${type.charAt(0).toUpperCase() + type.slice(1)} ${sizeDesc} university known for comprehensive academic programs and student success.`;
  }
}

// O*NET Web Services Integration
export class ONETService {
  private readonly baseUrl = "https://services.onetcenter.org/ws/online";
  private readonly auth = "onet_ws:password"; // Default credentials for basic access
  
  async fetchOccupations(keyword?: string) {
    const params = new URLSearchParams({
      ...(keyword && { keyword }),
      start: '1',
      end: '50'
    });

    const response = await fetch(`${this.baseUrl}/search?${params}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(this.auth).toString('base64')}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`O*NET API error: ${response.status}`);
    }

    const data = (await response.json()) as { occupation?: OnetOccupation[] };
    return data.occupation || [];
  }

  async fetchOccupationDetails(onetCode: string) {
    const response = await fetch(`${this.baseUrl}/occupations/${onetCode}`, {
      headers: {
        'Authorization': `Basic ${Buffer.from(this.auth).toString('base64')}`,
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`O*NET occupation details error: ${response.status}`);
    }

    return response.json();
  }

  transformToSchema(occupations: OnetOccupation[]) {
    return occupations.map(occ => ({
      title: occ.title,
      description: occ.description || `Professional role in ${occ.title.toLowerCase()} field`,
      onetCode: occ.code,
      averageSalary: this.estimateSalary(occ.title),
      jobGrowthRate: this.estimateGrowthRate(occ.title),
      educationRequired: this.determineEducation(occ.title),
      skills: this.getSkills(occ.title),
      industries: this.getIndustries(occ.title),
      relatedMajors: this.getRelatedMajors(occ.title),
      workEnvironment: 'Office and field work environment',
      jobOutlook: 'Positive growth expected'
    }));
  }

  private estimateSalary(title: string): number {
    const salaryMap: Record<string, number> = {
      'software': 95000,
      'engineer': 85000,
      'data scientist': 108000,
      'nurse': 77600,
      'teacher': 60000,
      'analyst': 70000,
      'manager': 90000,
      'developer': 85000,
      'designer': 65000,
      'consultant': 80000
    };

    const key = Object.keys(salaryMap).find(k => title.toLowerCase().includes(k));
    return key ? salaryMap[key] : 55000;
  }

  private estimateGrowthRate(title: string): number {
    const growthMap: Record<string, number> = {
      'software': 22,
      'data scientist': 35,
      'nurse': 7,
      'solar': 52,
      'wind': 68,
      'cybersecurity': 33,
      'healthcare': 15,
      'ai': 40,
      'machine learning': 35
    };

    const key = Object.keys(growthMap).find(k => title.toLowerCase().includes(k));
    return key ? growthMap[key] : 8;
  }

  private determineEducation(title: string): string {
    if (title.toLowerCase().includes('doctor') || title.toLowerCase().includes('physician')) {
      return 'Doctoral degree';
    }
    if (title.toLowerCase().includes('lawyer') || title.toLowerCase().includes('attorney')) {
      return 'Professional degree';
    }
    if (title.toLowerCase().includes('engineer') || title.toLowerCase().includes('scientist')) {
      return "Bachelor's degree";
    }
    return "Bachelor's degree";
  }

  private getSkills(title: string): string[] {
    const skillMap: Record<string, string[]> = {
      'software': ['JavaScript', 'Python', 'React', 'Node.js', 'SQL', 'Git'],
      'data scientist': ['Python', 'R', 'SQL', 'Machine Learning', 'Statistics', 'Tableau'],
      'nurse': ['Patient Care', 'Medical Knowledge', 'Communication', 'Critical Thinking'],
      'engineer': ['Problem Solving', 'Mathematics', 'CAD Software', 'Project Management'],
      'teacher': ['Curriculum Development', 'Classroom Management', 'Assessment', 'Communication']
    };

    const key = Object.keys(skillMap).find(k => title.toLowerCase().includes(k));
    return key ? skillMap[key] : ['Communication', 'Problem Solving', 'Teamwork'];
  }

  private getIndustries(title: string): string[] {
    const industryMap: Record<string, string[]> = {
      'software': ['Technology', 'Finance', 'Healthcare', 'E-commerce'],
      'nurse': ['Healthcare', 'Hospitals', 'Clinics', 'Home Health'],
      'teacher': ['Education', 'Schools', 'Universities', 'Training'],
      'engineer': ['Manufacturing', 'Construction', 'Technology', 'Consulting']
    };

    const key = Object.keys(industryMap).find(k => title.toLowerCase().includes(k));
    return key ? industryMap[key] : ['Various Industries'];
  }

  private getRelatedMajors(title: string): string[] {
    const majorMap: Record<string, string[]> = {
      'software': ['Computer Science', 'Software Engineering', 'Information Technology'],
      'data scientist': ['Data Science', 'Statistics', 'Computer Science', 'Mathematics'],
      'nurse': ['Nursing', 'Health Sciences', 'Biology'],
      'engineer': ['Engineering', 'Mathematics', 'Physics'],
      'teacher': ['Education', 'Subject-specific major', 'Liberal Arts']
    };

    const key = Object.keys(majorMap).find(k => title.toLowerCase().includes(k));
    return key ? majorMap[key] : ['Liberal Arts', 'Business'];
  }
}

// Federal Scholarship Data Service
export class ScholarshipService {
  async fetchFederalPrograms() {
    // Federal Pell Grant and other programs
    return [
      {
        name: "Federal Pell Grant",
        amount: 7395,
        type: "need-based",
        provider: "U.S. Department of Education",
        eligibilityRequirements: ["U.S. Citizen", "Financial Need", "Undergraduate Study"],
        renewable: true,
        description: "Federal grant for undergraduate students with exceptional financial need",
        targetDemographics: ["Low-income students", "First-generation college students"],
        applicationRequirements: ["FAFSA"],
        website: "https://studentaid.gov/understand-aid/types/grants/pell"
      },
      {
        name: "Federal Supplemental Educational Opportunity Grant (FSEOG)",
        amount: 4000,
        type: "need-based",
        provider: "U.S. Department of Education",
        eligibilityRequirements: ["Pell Grant eligible", "Exceptional financial need"],
        renewable: true,
        description: "Additional federal grant for students with exceptional financial need",
        targetDemographics: ["Extremely low-income students"],
        applicationRequirements: ["FAFSA", "School selection"],
        website: "https://studentaid.gov/understand-aid/types/grants/fseog"
      },
      {
        name: "TEACH Grant",
        amount: 4000,
        type: "academic",
        provider: "U.S. Department of Education",
        eligibilityRequirements: ["Teaching commitment", "High academic achievement"],
        renewable: true,
        description: "Grant for students who agree to teach in high-need fields",
        targetDemographics: ["Future teachers", "STEM educators"],
        applicationRequirements: ["FAFSA", "Teaching commitment agreement"],
        website: "https://studentaid.gov/understand-aid/types/grants/teach"
      }
    ];
  }

  async fetchPrivateScholarships() {
    // Major private scholarship programs
    return [
      {
        name: "Gates Scholarship",
        amount: 50000,
        type: "merit-based",
        provider: "Gates Foundation",
        eligibilityRequirements: ["High school senior", "Pell-eligible", "Leadership", "Academic excellence"],
        renewable: true,
        description: "Full scholarship for outstanding minority students",
        targetDemographics: ["Minority students", "Low-income families"],
        applicationRequirements: ["Essays", "Transcripts", "Recommendations", "FAFSA"],
        website: "https://www.thegatesscholarship.org",
        deadline: "September 15, 2024"
      },
      {
        name: "Coca-Cola Scholars Program",
        amount: 20000,
        type: "merit-based",
        provider: "Coca-Cola Scholars Foundation",
        eligibilityRequirements: ["High school senior", "Leadership", "Community service"],
        renewable: false,
        description: "Leadership-focused scholarship program",
        targetDemographics: ["Student leaders", "Community volunteers"],
        applicationRequirements: ["Application", "Leadership portfolio", "Community service records"],
        website: "https://www.coca-colascholarsfoundation.org",
        deadline: "October 31, 2024"
      },
      {
        name: "Jack Kent Cooke Foundation Scholarship",
        amount: 40000,
        type: "academic",
        provider: "Jack Kent Cooke Foundation",
        eligibilityRequirements: ["High academic achievement", "Financial need"],
        renewable: true,
        description: "Comprehensive scholarship for high-achieving students",
        targetDemographics: ["High-achieving students", "Financial need"],
        applicationRequirements: ["Academic records", "Essays", "Financial information"],
        website: "https://www.jkcf.org",
        deadline: "November 18, 2024"
      }
    ];
  }

  transformToSchema(scholarships: any[]) {
    return scholarships.map(scholarship => ({
      ...scholarship,
      deadline: scholarship.deadline || null,
      website: scholarship.website || null,
      description: scholarship.description || null
    }));
  }
}

// Data Population Service
export class DataPopulationService {
  private collegeService = new CollegeScorecardService();
  private onetService = new ONETService();
  private scholarshipService = new ScholarshipService();

  async populateColleges() {
    console.log('Fetching colleges from College Scorecard...');
    
    try {
      // First try a direct API test
      const testColleges = await this.collegeService.fetchColleges({ per_page: 5 });
      console.log(`Test fetch returned ${testColleges.length} colleges`);
      
      if (testColleges.length === 0) {
        console.log('No colleges returned from API');
        return;
      }

      // Transform and insert test data
      const transformedTest = this.collegeService.transformToSchema(testColleges);
      console.log(`Transformed ${transformedTest.length} colleges for insertion`);
      
      for (const college of transformedTest) {
        console.log(`Inserting college: ${college.name} in ${college.state}`);
        await db.insert(colleges).values(college).onConflictDoNothing();
      }
      
      // If test successful, fetch data for major states
      const states = ['CA', 'TX', 'FL', 'NY', 'PA'];
      
      for (const state of states) {
        try {
          const rawColleges = await this.collegeService.fetchColleges({ 
            state, 
            per_page: 20 
          });
          
          const transformedColleges = this.collegeService.transformToSchema(rawColleges);
          
          for (const college of transformedColleges) {
            await db.insert(colleges).values(college).onConflictDoNothing();
          }
          
          console.log(`Populated ${transformedColleges.length} colleges for ${state}`);
        } catch (error) {
          console.error(`Error fetching colleges for ${state}:`, error);
        }
      }
    } catch (error) {
      console.error('Error in college population:', error);
    }
  }

  async populateCareers() {
    console.log('Fetching career data from O*NET...');
    
    const keywords = [
      'software', 'engineer', 'data scientist', 'nurse', 'teacher',
      'analyst', 'manager', 'developer', 'designer', 'consultant'
    ];
    
    for (const keyword of keywords) {
      try {
        const occupations = await this.onetService.fetchOccupations(keyword);
        const transformedCareers = this.onetService.transformToSchema(occupations);
        
        for (const career of transformedCareers) {
          await db.insert(careerPaths).values(career).onConflictDoNothing();
        }
        
        console.log(`Populated ${transformedCareers.length} careers for ${keyword}`);
      } catch (error) {
        console.error(`Error fetching careers for ${keyword}:`, error);
      }
    }
  }

  async populateScholarships() {
    console.log('Populating scholarship data...');
    
    try {
      const federalScholarships = await this.scholarshipService.fetchFederalPrograms();
      const privateScholarships = await this.scholarshipService.fetchPrivateScholarships();
      
      const allScholarships = [
        ...this.scholarshipService.transformToSchema(federalScholarships),
        ...this.scholarshipService.transformToSchema(privateScholarships)
      ];
      
      for (const scholarship of allScholarships) {
        await db.insert(scholarships).values(scholarship).onConflictDoNothing();
      }
      
      console.log(`Populated ${allScholarships.length} scholarships`);
    } catch (error) {
      console.error('Error populating scholarships:', error);
    }
  }

  async populateAllData() {
    console.log('Starting comprehensive data population...');
    
    await this.populateColleges();
    await this.populateCareers();
    await this.populateScholarships();
    
    console.log('Data population complete!');
  }
}

export default {
  CollegeScorecardService,
  ONETService,
  ScholarshipService,
  DataPopulationService
};