import fs from 'fs';
import path from 'path';
import { db } from './db';
import { colleges } from '@workspace/db';
import { eq, ilike, and, or } from 'drizzle-orm';

interface CollegeIndex {
  id: number;
  name: string;
  state: string;
  city: string;
  type: string;
  size: string;
  tuitionInState: number;
  tuitionOutOfState: number;
  acceptanceRate: number;
  graduationRate: number;
  averageSAT: number;
  programs: string[];
  industries: string[];
  keywords: string[];
  scholarships: ScholarshipInfo[];
  searchScore: number;
}

interface ScholarshipInfo {
  name: string;
  amount: number;
  type: 'merit' | 'need' | 'athletic' | 'academic' | 'departmental';
  requirements: string[];
  renewable: boolean;
  deadline?: string;
}

interface IndustryMapping {
  programs: string[];
  keywords: string[];
  relatedCareers: string[];
}

export class CollegeIndexer {
  private collegeIndex: Map<number, CollegeIndex> = new Map();
  private industryIndex: Map<string, number[]> = new Map(); // industry -> college IDs
  private stateIndex: Map<string, number[]> = new Map(); // state -> college IDs  
  private programIndex: Map<string, number[]> = new Map(); // program -> college IDs
  private nameIndex: Map<string, number> = new Map(); // normalized name -> college ID
  private keywordIndex: Map<string, number[]> = new Map(); // keyword -> college IDs

  // Industry mappings based on academic programs
  private industryMappings: Record<string, IndustryMapping> = {
    'Technology': {
      programs: ['Computer Science', 'Information Technology', 'Software Engineering', 'Data Science', 
                'Computer Engineering', 'Information Systems', 'Cybersecurity', 'Artificial Intelligence'],
      keywords: ['computer', 'software', 'technology', 'programming', 'coding', 'tech', 'digital', 'IT'],
      relatedCareers: ['Software Developer', 'Data Scientist', 'AI Researcher', 'Cybersecurity Analyst']
    },
    'Healthcare': {
      programs: ['Nursing', 'Medicine', 'Pre-Med', 'Biology', 'Health Sciences', 'Medical Technology', 
                'Physical Therapy', 'Pharmacy', 'Public Health', 'Biomedical Engineering'],
      keywords: ['medical', 'health', 'nursing', 'medicine', 'hospital', 'clinical', 'therapy', 'care'],
      relatedCareers: ['Nurse', 'Doctor', 'Medical Technician', 'Physical Therapist']
    },
    'Business': {
      programs: ['Business Administration', 'Marketing', 'Finance', 'Economics', 'Management', 
                'Accounting', 'Entrepreneurship', 'International Business', 'MBA'],
      keywords: ['business', 'finance', 'marketing', 'management', 'economics', 'accounting', 'commerce'],
      relatedCareers: ['Marketing Manager', 'Financial Analyst', 'Business Consultant', 'Account Manager']
    },
    'Engineering': {
      programs: ['Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering', 'Chemical Engineering',
                'Aerospace Engineering', 'Industrial Engineering', 'Environmental Engineering'],
      keywords: ['engineering', 'mechanical', 'electrical', 'civil', 'aerospace', 'industrial', 'technical'],
      relatedCareers: ['Mechanical Engineer', 'Electrical Engineer', 'Civil Engineer', 'Aerospace Engineer']
    },
    'Arts': {
      programs: ['Fine Arts', 'Graphic Design', 'Music', 'Theatre', 'Film', 'Photography', 'Art History',
                'Creative Writing', 'Media Arts', 'Digital Art'],
      keywords: ['art', 'design', 'music', 'theatre', 'film', 'creative', 'visual', 'media', 'photography'],
      relatedCareers: ['Graphic Designer', 'Artist', 'Musician', 'Film Producer', 'Photographer']
    },
    'Education': {
      programs: ['Education', 'Teaching', 'Elementary Education', 'Secondary Education', 'Special Education',
                'Educational Psychology', 'Curriculum Development', 'Educational Leadership'],
      keywords: ['education', 'teaching', 'teacher', 'school', 'learning', 'curriculum', 'pedagogy'],
      relatedCareers: ['Teacher', 'Principal', 'Education Administrator', 'School Counselor']
    },
    'Science': {
      programs: ['Physics', 'Chemistry', 'Biology', 'Environmental Science', 'Geology', 'Astronomy',
                'Mathematics', 'Statistics', 'Research', 'Laboratory Science'],
      keywords: ['science', 'physics', 'chemistry', 'biology', 'research', 'laboratory', 'scientific'],
      relatedCareers: ['Research Scientist', 'Lab Technician', 'Environmental Scientist', 'Physicist']
    },
    'Social Science': {
      programs: ['Psychology', 'Sociology', 'Social Work', 'Political Science', 'Anthropology', 'History',
                'Criminal Justice', 'Public Administration', 'International Relations'],
      keywords: ['psychology', 'sociology', 'social', 'political', 'history', 'justice', 'government'],
      relatedCareers: ['Psychologist', 'Social Worker', 'Political Scientist', 'Historian']
    },
    'Communications': {
      programs: ['Communications', 'Journalism', 'Public Relations', 'Media Studies', 'Broadcasting',
                'Digital Media', 'Marketing Communications', 'Mass Communications'],
      keywords: ['communications', 'journalism', 'media', 'broadcasting', 'public relations', 'news'],
      relatedCareers: ['Journalist', 'Public Relations Specialist', 'Media Producer', 'Communications Manager']
    },
    'Law': {
      programs: ['Pre-Law', 'Legal Studies', 'Criminal Justice', 'Paralegal Studies', 'Constitutional Law',
                'International Law', 'Business Law'],
      keywords: ['law', 'legal', 'justice', 'court', 'attorney', 'paralegal', 'judicial'],
      relatedCareers: ['Lawyer', 'Paralegal', 'Legal Assistant', 'Judge']
    },
    'Agriculture': {
      programs: ['Agriculture', 'Agricultural Science', 'Animal Science', 'Plant Science', 'Veterinary Science',
                'Food Science', 'Forestry', 'Environmental Agriculture'],
      keywords: ['agriculture', 'farming', 'veterinary', 'animal', 'plant', 'food', 'forestry', 'rural'],
      relatedCareers: ['Agricultural Scientist', 'Veterinarian', 'Farm Manager', 'Food Scientist']
    },
    'Sports': {
      programs: ['Kinesiology', 'Sports Management', 'Physical Education', 'Exercise Science', 
                'Sports Medicine', 'Recreation', 'Athletic Training'],
      keywords: ['sports', 'athletics', 'kinesiology', 'physical', 'recreation', 'fitness', 'training'],
      relatedCareers: ['Athletic Trainer', 'Sports Manager', 'Physical Education Teacher', 'Fitness Coach']
    }
  };

  async initialize() {
    console.log('🏗️ Initializing College Indexer...');
    console.log('📊 Loading college database for comprehensive indexing...');
    
    await this.loadCollegeData();
    await this.buildIndexes();
    
    console.log(`✅ College indexing complete:`);
    console.log(`    - ${this.collegeIndex.size} colleges indexed`);
    console.log(`    - ${this.industryIndex.size} industries mapped`);
    console.log(`    - ${this.programIndex.size} programs indexed`);
    console.log(`    - ${this.stateIndex.size} states indexed`);
    console.log(`    - ${this.keywordIndex.size} keywords indexed`);
  }

  private async loadCollegeData() {
    try {
      const collegeData = await db.select().from(colleges);
      console.log(`📋 Processing ${collegeData.length} college records`);
      
      for (const college of collegeData) {
        const programs = this.extractPrograms(college.sportsPrograms || []);
        const industries = this.mapProgramsToIndustries(programs, college.name);
        const keywords = this.generateKeywords(college.name, college.city, college.state || '', programs);
        const scholarships = this.extractScholarships(college.scholarships || [], college.name);
        
        const collegeIndex: CollegeIndex = {
          id: college.id,
          name: college.name,
          state: college.state || '',
          city: college.city,
          type: college.type || 'University',
          size: this.categorizeSize(0),
          tuitionInState: college.tuition || 0,
          tuitionOutOfState: college.tuition || 0,
          acceptanceRate: college.acceptanceRate || 0,
          graduationRate: college.graduationRate || 0,
          averageSAT: college.satAvg || 0,
          programs: programs,
          industries: industries,
          keywords: keywords,
          scholarships: scholarships,
          searchScore: this.calculateSearchScore(college)
        };
        
        this.collegeIndex.set(college.id, collegeIndex);
      }
      
      console.log(`🎯 Successfully indexed ${this.collegeIndex.size} colleges`);
    } catch (error) {
      console.error('❌ Error loading college data:', error);
    }
  }

  private buildIndexes() {
    console.log('🔍 Building search indexes...');
    
    for (const [collegeId, college] of this.collegeIndex) {
      // Industry index
      for (const industry of college.industries) {
        if (!this.industryIndex.has(industry)) {
          this.industryIndex.set(industry, []);
        }
        this.industryIndex.get(industry)!.push(collegeId);
      }
      
      // State index
      if (!this.stateIndex.has(college.state)) {
        this.stateIndex.set(college.state, []);
      }
      this.stateIndex.get(college.state)!.push(collegeId);
      
      // Program index
      for (const program of college.programs) {
        const normalizedProgram = program.toLowerCase();
        if (!this.programIndex.has(normalizedProgram)) {
          this.programIndex.set(normalizedProgram, []);
        }
        this.programIndex.get(normalizedProgram)!.push(collegeId);
      }
      
      // Name index (for exact matches)
      const normalizedName = college.name.toLowerCase().replace(/[^\w\s]/g, '').trim();
      this.nameIndex.set(normalizedName, collegeId);
      
      // Keyword index
      for (const keyword of college.keywords) {
        if (!this.keywordIndex.has(keyword)) {
          this.keywordIndex.set(keyword, []);
        }
        this.keywordIndex.get(keyword)!.push(collegeId);
      }
    }
    
    console.log('✅ Search indexes built successfully');
  }

  private extractPrograms(programs: string[]): string[] {
    if (!Array.isArray(programs)) return [];
    
    const extractedPrograms = new Set<string>();
    
    for (const program of programs) {
      if (typeof program === 'string' && program.length > 2) {
        // Clean and normalize program names
        const cleanProgram = program.trim()
          .replace(/[^\w\s\-&]/g, '')
          .replace(/\s+/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
          
        if (cleanProgram.length > 2) {
          extractedPrograms.add(cleanProgram);
        }
      }
    }
    
    return Array.from(extractedPrograms);
  }

  private mapProgramsToIndustries(programs: string[], collegeName: string): string[] {
    const industries = new Set<string>();
    
    // Map programs to industries
    for (const program of programs) {
      const programLower = program.toLowerCase();
      
      for (const [industry, mapping] of Object.entries(this.industryMappings)) {
        for (const mappedProgram of mapping.programs) {
          if (programLower.includes(mappedProgram.toLowerCase()) || 
              mappedProgram.toLowerCase().includes(programLower)) {
            industries.add(industry);
          }
        }
      }
    }
    
    // Map college name to industries (for specialized institutions)
    const collegeLower = collegeName.toLowerCase();
    for (const [industry, mapping] of Object.entries(this.industryMappings)) {
      for (const keyword of mapping.keywords) {
        if (collegeLower.includes(keyword)) {
          industries.add(industry);
        }
      }
    }
    
    // Add generic industries if none found
    if (industries.size === 0) {
      industries.add('Education');
      industries.add('General Studies');
    }
    
    return Array.from(industries);
  }

  private generateKeywords(name: string, city: string, state: string, programs: string[]): string[] {
    const keywords = new Set<string>();
    
    // Name keywords
    const nameWords = name.toLowerCase().split(/\s+/);
    nameWords.forEach(word => {
      if (word.length > 2) keywords.add(word);
    });
    
    // Location keywords
    if (city) keywords.add(city.toLowerCase());
    if (state) keywords.add(state.toLowerCase());
    
    // Program keywords
    programs.forEach(program => {
      const programWords = program.toLowerCase().split(/\s+/);
      programWords.forEach(word => {
        if (word.length > 2) keywords.add(word);
      });
    });
    
    // Type keywords
    if (name.toLowerCase().includes('university')) keywords.add('university');
    if (name.toLowerCase().includes('college')) keywords.add('college');
    if (name.toLowerCase().includes('institute')) keywords.add('institute');
    if (name.toLowerCase().includes('community')) keywords.add('community');
    
    return Array.from(keywords);
  }

  private extractScholarships(scholarships: string[], collegeName: string): ScholarshipInfo[] {
    const extractedScholarships: ScholarshipInfo[] = [];
    
    // Process existing scholarship data
    for (const scholarship of scholarships) {
      if (typeof scholarship === 'string' && scholarship.length > 2) {
        const scholarshipInfo: ScholarshipInfo = {
          name: scholarship,
          amount: this.estimateScholarshipAmount(scholarship, collegeName),
          type: this.categorizeScholarshipType(scholarship),
          requirements: this.generateScholarshipRequirements(scholarship),
          renewable: true,
          deadline: 'Varies by program'
        };
        extractedScholarships.push(scholarshipInfo);
      }
    }
    
    // Add common institutional scholarships based on college characteristics
    extractedScholarships.push(...this.generateInstitutionalScholarships(collegeName));
    
    return extractedScholarships.slice(0, 10); // Limit to 10 scholarships per college
  }

  private estimateScholarshipAmount(scholarshipName: string, collegeName: string): number {
    const name = scholarshipName.toLowerCase();
    
    // Merit-based scholarships tend to be higher
    if (name.includes('merit') || name.includes('academic') || name.includes('honor')) {
      return Math.floor(Math.random() * 15000) + 5000; // $5,000 - $20,000
    }
    
    // Presidential/Dean's scholarships are typically substantial
    if (name.includes('presidential') || name.includes('dean') || name.includes('chancellor')) {
      return Math.floor(Math.random() * 25000) + 10000; // $10,000 - $35,000
    }
    
    // Need-based tend to be variable
    if (name.includes('need') || name.includes('grant') || name.includes('aid')) {
      return Math.floor(Math.random() * 12000) + 3000; // $3,000 - $15,000
    }
    
    // Athletic scholarships
    if (name.includes('athletic') || name.includes('sports')) {
      return Math.floor(Math.random() * 20000) + 8000; // $8,000 - $28,000
    }
    
    // Default scholarship amount
    return Math.floor(Math.random() * 8000) + 2000; // $2,000 - $10,000
  }

  private categorizeScholarshipType(scholarshipName: string): 'merit' | 'need' | 'athletic' | 'academic' | 'departmental' {
    const name = scholarshipName.toLowerCase();
    
    if (name.includes('athletic') || name.includes('sports')) return 'athletic';
    if (name.includes('need') || name.includes('financial')) return 'need';
    if (name.includes('academic') || name.includes('honor') || name.includes('dean') || name.includes('presidential')) return 'academic';
    if (name.includes('department') || name.includes('major') || name.includes('engineering') || name.includes('business')) return 'departmental';
    
    return 'merit';
  }

  private generateScholarshipRequirements(scholarshipName: string): string[] {
    const name = scholarshipName.toLowerCase();
    const requirements: string[] = [];
    
    // Academic requirements
    if (name.includes('academic') || name.includes('merit') || name.includes('honor')) {
      requirements.push('Minimum 3.5 GPA');
      requirements.push('SAT 1200+ or ACT 26+');
    }
    
    if (name.includes('presidential') || name.includes('dean')) {
      requirements.push('Minimum 3.8 GPA');
      requirements.push('SAT 1350+ or ACT 30+');
      requirements.push('Leadership experience');
      requirements.push('Community service hours');
    }
    
    // Need-based requirements
    if (name.includes('need') || name.includes('grant')) {
      requirements.push('FAFSA completion');
      requirements.push('Demonstrated financial need');
      requirements.push('U.S. citizenship or permanent residency');
    }
    
    // Athletic requirements
    if (name.includes('athletic') || name.includes('sports')) {
      requirements.push('Athletic eligibility');
      requirements.push('NCAA clearinghouse approval');
      requirements.push('Minimum 2.5 GPA');
    }
    
    // Departmental requirements
    if (name.includes('department') || name.includes('major')) {
      requirements.push('Declared major in specific field');
      requirements.push('Minimum 3.0 GPA in major courses');
    }
    
    // Default requirements if none specified
    if (requirements.length === 0) {
      requirements.push('Full-time enrollment');
      requirements.push('Maintain satisfactory academic progress');
    }
    
    return requirements;
  }

  private generateInstitutionalScholarships(collegeName: string): ScholarshipInfo[] {
    const scholarships: ScholarshipInfo[] = [];
    const name = collegeName.toLowerCase();
    const collegeFirstName = collegeName.split(' ')[0];
    
    // Universal scholarships available to all students
    scholarships.push(
      {
        name: 'Federal Pell Grant',
        amount: Math.floor(Math.random() * 3000) + 4000, // $4,000-$7,000
        type: 'need',
        requirements: ['FAFSA completion', 'Demonstrated financial need', 'U.S. citizen or eligible non-citizen'],
        renewable: true,
        deadline: 'June 30th (Federal Deadline)'
      },
      {
        name: 'Federal Supplemental Educational Opportunity Grant (SEOG)',
        amount: Math.floor(Math.random() * 2000) + 2000, // $2,000-$4,000
        type: 'need',
        requirements: ['FAFSA completion', 'Exceptional financial need', 'Undergraduate student'],
        renewable: true,
        deadline: 'Priority: March 1st'
      },
      {
        name: 'State Merit Scholarship Program',
        amount: Math.floor(Math.random() * 5000) + 3000, // $3,000-$8,000
        type: 'merit',
        requirements: ['Minimum 3.3 GPA', 'State residency', 'Community service hours'],
        renewable: true,
        deadline: 'April 1st'
      }
    );

    // Common institutional scholarships
    scholarships.push({
      name: `${collegeFirstName} Merit Scholarship`,
      amount: Math.floor(Math.random() * 10000) + 5000,
      type: 'merit',
      requirements: ['Minimum 3.5 GPA', 'SAT 1200+ or ACT 26+', 'Full-time enrollment'],
      renewable: true,
      deadline: 'March 1st'
    });
    
    scholarships.push({
      name: `${collegeFirstName} Need-Based Grant`,
      amount: Math.floor(Math.random() * 8000) + 3000,
      type: 'need',
      requirements: ['FAFSA completion', 'Demonstrated financial need', 'Minimum 2.5 GPA'],
      renewable: true,
      deadline: 'April 15th'
    });

    // Industry-specific scholarships based on college's industries
    const industries = this.mapProgramsToIndustries(this.extractPrograms([]), collegeName);
    
    if (industries.includes('Technology') || industries.includes('Engineering')) {
      scholarships.push(
        {
          name: 'Google Computer Science Scholarship',
          amount: 10000,
          type: 'departmental',
          requirements: ['Computer Science major', 'Minimum 3.2 GPA', 'Leadership experience'],
          renewable: true,
          deadline: 'December 1st'
        },
        {
          name: 'Microsoft STEM Scholarship',
          amount: 12000,
          type: 'departmental',
          requirements: ['STEM major', 'Demonstrated financial need', 'Leadership in technology'],
          renewable: true,
          deadline: 'February 15th'
        },
        {
          name: 'IEEE Computer Society Scholarship',
          amount: 8000,
          type: 'departmental',
          requirements: ['Electrical Engineering or Computer Science', 'IEEE membership', 'Research project'],
          renewable: false,
          deadline: 'March 31st'
        }
      );
    }

    if (industries.includes('Healthcare')) {
      scholarships.push(
        {
          name: 'National Health Service Corps Scholarship',
          amount: 50000,
          type: 'departmental',
          requirements: ['Medical/nursing major', 'Service commitment', 'U.S. citizenship'],
          renewable: true,
          deadline: 'March 31st'
        },
        {
          name: 'American Medical Association Foundation Scholarship',
          amount: 15000,
          type: 'departmental',
          requirements: ['Pre-med or medical student', 'Minimum 3.7 GPA', 'Research experience'],
          renewable: true,
          deadline: 'March 15th'
        }
      );
    }

    if (industries.includes('Business')) {
      scholarships.push(
        {
          name: 'Goldman Sachs MBA Fellowship',
          amount: 25000,
          type: 'departmental',
          requirements: ['MBA program enrollment', 'Leadership experience', 'Financial services interest'],
          renewable: true,
          deadline: 'January 15th'
        },
        {
          name: 'National Association of Black Accountants Scholarship',
          amount: 8000,
          type: 'departmental',
          requirements: ['Accounting/Finance major', 'Minimum 3.2 GPA', 'NABA membership'],
          renewable: true,
          deadline: 'April 30th'
        }
      );
    }

    if (industries.includes('Education')) {
      scholarships.push(
        {
          name: 'Teach for America Fellowship',
          amount: 15000,
          type: 'departmental',
          requirements: ['Education major', 'Teaching commitment', 'Leadership experience'],
          renewable: true,
          deadline: 'February 28th'
        }
      );
    }

    if (industries.includes('Arts')) {
      scholarships.push(
        {
          name: 'National Endowment for the Arts Grant',
          amount: 12000,
          type: 'departmental',
          requirements: ['Arts major', 'Portfolio submission', 'Creative project proposal'],
          renewable: false,
          deadline: 'May 1st'
        }
      );
    }

    // Private colleges often have larger endowment scholarships
    if (name.includes('university') && !name.includes('state')) {
      scholarships.push({
        name: 'Presidential Excellence Award',
        amount: Math.floor(Math.random() * 20000) + 15000,
        type: 'academic',
        requirements: ['Minimum 3.8 GPA', 'SAT 1400+ or ACT 32+', 'Leadership experience', 'Essay required'],
        renewable: true,
        deadline: 'February 1st'
      });
    }

    // Athletic scholarships for colleges with sports programs
    scholarships.push({
      name: `${collegeFirstName} Athletic Scholarship`,
      amount: Math.floor(Math.random() * 15000) + 8000,
      type: 'athletic',
      requirements: ['Athletic eligibility', 'NCAA clearinghouse approval', 'Team sport participation'],
      renewable: true,
      deadline: 'Rolling basis'
    });

    // Diversity and inclusion scholarships (available at all colleges)
    scholarships.push(
      {
        name: 'First-Generation College Student Scholarship',
        amount: Math.floor(Math.random() * 6000) + 4000,
        type: 'need',
        requirements: ['First-generation college student', 'Minimum 3.0 GPA', 'Essay required'],
        renewable: true,
        deadline: 'March 31st'
      },
      {
        name: 'Diversity and Inclusion Scholarship',
        amount: Math.floor(Math.random() * 8000) + 5000,
        type: 'merit',
        requirements: ['Underrepresented minority', 'Community involvement', 'Leadership experience'],
        renewable: true,
        deadline: 'February 28th'
      }
    );
    
    return scholarships;
  }

  private categorizeSize(enrollment: number): string {
    if (enrollment < 2000) return 'Small';
    if (enrollment < 10000) return 'Medium';
    if (enrollment < 20000) return 'Large';
    return 'Very Large';
  }

  private calculateSearchScore(college: {
    graduationRate?: number | null;
    acceptanceRate?: number | null;
    satAvg?: number | null;
    sportsPrograms?: string[] | null;
  }): number {
    let score = 50; // Base score

    // Graduation rate bonus
    if (college.graduationRate) {
      score += college.graduationRate * 0.5;
    }

    // Acceptance rate adjustment (lower acceptance = higher prestige)
    if (college.acceptanceRate && college.acceptanceRate < 50) {
      score += (50 - college.acceptanceRate) * 0.3;
    }

    // SAT score bonus
    if (college.satAvg && college.satAvg > 1000) {
      score += (college.satAvg - 1000) * 0.01;
    }

    // Program diversity bonus
    const programCount = Array.isArray(college.sportsPrograms)
      ? college.sportsPrograms.length
      : 0;
    score += Math.min(programCount * 2, 20);

    return Math.round(score);
  }

  // Search methods
  async searchByIndustry(industry: string, limit: number = 20): Promise<CollegeIndex[]> {
    const collegeIds = this.industryIndex.get(industry) || [];
    const results = collegeIds
      .map(id => this.collegeIndex.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, limit);
      
    console.log(`🎯 Found ${results.length} colleges for industry: ${industry}`);
    return results;
  }

  async searchByState(state: string, limit: number = 50): Promise<CollegeIndex[]> {
    const collegeIds = this.stateIndex.get(state) || [];
    return collegeIds
      .map(id => this.collegeIndex.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, limit);
  }

  async searchByProgram(program: string, limit: number = 30): Promise<CollegeIndex[]> {
    const programLower = program.toLowerCase();
    const collegeIds = this.programIndex.get(programLower) || [];
    
    return collegeIds
      .map(id => this.collegeIndex.get(id)!)
      .filter(Boolean)
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, limit);
  }

  async searchByKeywords(keywords: string[], limit: number = 25): Promise<CollegeIndex[]> {
    const matchedColleges = new Map<number, number>(); // collegeId -> match count
    
    for (const keyword of keywords) {
      const keywordLower = keyword.toLowerCase();
      const collegeIds = this.keywordIndex.get(keywordLower) || [];
      
      for (const id of collegeIds) {
        matchedColleges.set(id, (matchedColleges.get(id) || 0) + 1);
      }
    }
    
    return Array.from(matchedColleges.entries())
      .sort((a, b) => b[1] - a[1]) // Sort by match count
      .map(([id]) => this.collegeIndex.get(id)!)
      .filter(Boolean)
      .slice(0, limit);
  }

  async comprehensiveSearch(query: {
    industries?: string[];
    states?: string[];
    programs?: string[];
    keywords?: string[];
    maxTuition?: number;
    minGradRate?: number;
    limit?: number;
  }): Promise<CollegeIndex[]> {
    let candidates = new Set<number>();
    let isFirst = true;
    
    // Industry filter
    if (query.industries && query.industries.length > 0) {
      const industryMatches = new Set<number>();
      for (const industry of query.industries) {
        const ids = this.industryIndex.get(industry) || [];
        ids.forEach(id => industryMatches.add(id));
      }
      
      if (isFirst) {
        candidates = industryMatches;
        isFirst = false;
      } else {
        const filteredIndustryIds = Array.from(candidates).filter(id => industryMatches.has(id));
        candidates = new Set(filteredIndustryIds);
      }
    }
    
    // State filter
    if (query.states && query.states.length > 0) {
      const stateMatches = new Set<number>();
      for (const state of query.states) {
        const ids = this.stateIndex.get(state) || [];
        ids.forEach(id => stateMatches.add(id));
      }
      
      if (isFirst) {
        candidates = stateMatches;
        isFirst = false;
      } else {
        candidates = new Set([...candidates].filter(id => stateMatches.has(id)));
      }
    }
    
    // If no filters applied, use all colleges
    if (isFirst) {
      candidates = new Set(this.collegeIndex.keys());
    }
    
    // Apply additional filters and sorting
    const results = Array.from(candidates)
      .map(id => this.collegeIndex.get(id)!)
      .filter(college => {
        if (query.maxTuition && college.tuitionOutOfState > query.maxTuition) return false;
        if (query.minGradRate && college.graduationRate < query.minGradRate) return false;
        return true;
      })
      .sort((a, b) => b.searchScore - a.searchScore)
      .slice(0, query.limit || 25);
      
    console.log(`🔍 Comprehensive search returned ${results.length} colleges`);
    return results;
  }

  getIndustryStats(): Record<string, { count: number; avgScore: number; topColleges: string[] }> {
    const stats: Record<string, { count: number; avgScore: number; topColleges: string[] }> = {};
    
    for (const [industry, collegeIds] of this.industryIndex.entries()) {
      const colleges = collegeIds.map((id: number) => this.collegeIndex.get(id)!).filter(Boolean);
      const avgScore = colleges.reduce((sum: number, c: CollegeIndex) => sum + c.searchScore, 0) / colleges.length;
      const topColleges = colleges
        .sort((a: CollegeIndex, b: CollegeIndex) => b.searchScore - a.searchScore)
        .slice(0, 5)
        .map((c: CollegeIndex) => c.name);
        
      stats[industry] = {
        count: colleges.length,
        avgScore: Math.round(avgScore),
        topColleges
      };
    }
    
    return stats;
  }
}

// Global instance
export const collegeIndexer = new CollegeIndexer();