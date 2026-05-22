// Custom ML Resume Parser - No External AI Dependencies
// Uses pattern matching, keyword extraction, and rule-based analysis

interface ParsedResume {
  skills: string[];
  education: {
    level: string;
    major: string;
    gpa: number | null;
    institution: string | null;
    graduationYear: number | null;
  };
  interests: string[];
  experience: {
    years: number;
    industries: string[];
    roles: string[];
  };
  demographics: string[];
  careerGoals: string[];
  certifications: string[];
  atsScore: number;
  experienceSummary: string;
}

const SKILL_PATTERNS: Record<string, string[]> = {
  programming: ['python', 'javascript', 'java', 'c++', 'c#', 'ruby', 'go', 'rust', 'typescript', 'php', 'swift', 'kotlin', 'scala', 'r', 'matlab', 'sql', 'html', 'css', 'react', 'angular', 'vue', 'node.js', 'express', 'django', 'flask', 'spring', 'asp.net', 'rails', 'scratch', 'coding', 'programming'],
  data: ['machine learning', 'data analysis', 'data science', 'statistics', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit-learn', 'tableau', 'power bi', 'excel', 'spss', 'sas', 'hadoop', 'spark', 'sql server', 'mongodb', 'postgresql', 'mysql', 'big data', 'data visualization', 'etl', 'data mining', 'spreadsheet', 'google sheets'],
  cloud: ['aws', 'azure', 'gcp', 'google cloud', 'docker', 'kubernetes', 'terraform', 'jenkins', 'ci/cd', 'devops', 'linux', 'unix', 'cloud computing', 'serverless', 'microservices'],
  business: ['project management', 'agile', 'scrum', 'leadership', 'communication', 'teamwork', 'problem solving', 'critical thinking', 'presentation', 'negotiation', 'strategic planning', 'business analysis', 'product management', 'stakeholder management', 'budget management'],
  design: ['ui/ux', 'figma', 'sketch', 'adobe', 'photoshop', 'illustrator', 'indesign', 'user research', 'wireframing', 'prototyping', 'graphic design', 'visual design', 'interaction design', 'canva', 'video editing'],
  healthcare: ['patient care', 'medical terminology', 'hipaa', 'clinical', 'nursing', 'pharmacy', 'laboratory', 'diagnostic', 'therapeutic', 'healthcare administration', 'medical records', 'emr', 'ehr', 'first aid', 'cpr', 'health'],
  finance: ['financial analysis', 'accounting', 'budgeting', 'forecasting', 'auditing', 'tax', 'investment', 'portfolio', 'risk management', 'compliance', 'quickbooks', 'sap', 'oracle financials', 'bloomberg', 'money management'],
  marketing: ['digital marketing', 'seo', 'sem', 'social media', 'content marketing', 'email marketing', 'google analytics', 'marketing automation', 'crm', 'salesforce', 'hubspot', 'brand management', 'market research', 'instagram', 'tiktok', 'youtube'],
  engineering: ['cad', 'solidworks', 'autocad', 'matlab', 'simulation', 'manufacturing', 'quality control', 'lean', 'six sigma', 'mechanical design', 'electrical engineering', 'civil engineering', 'robotics', '3d printing'],
  research: ['research methodology', 'literature review', 'data collection', 'qualitative analysis', 'quantitative analysis', 'statistical analysis', 'peer review', 'publication', 'grant writing', 'laboratory techniques', 'science fair', 'research project'],
  legal: ['legal research', 'contract review', 'litigation', 'compliance', 'regulatory', 'intellectual property', 'corporate law', 'employment law', 'debate', 'mock trial'],
  education: ['curriculum development', 'lesson planning', 'classroom management', 'student assessment', 'educational technology', 'special education', 'tutoring', 'mentoring', 'teaching assistant'],
  creative: ['writing', 'editing', 'copywriting', 'content creation', 'video production', 'photography', 'animation', 'storytelling', 'creative direction', 'blogging', 'journalism', 'poetry', 'creative writing'],
  sales: ['sales', 'customer relationship', 'lead generation', 'cold calling', 'b2b', 'b2c', 'account management', 'territory management', 'sales forecasting', 'closing deals', 'customer service', 'retail'],
  // Student-specific skills
  student_soft: ['time management', 'organization', 'public speaking', 'collaboration', 'adaptability', 'self-motivated', 'detail oriented', 'multitasking', 'reliability', 'punctuality', 'work ethic', 'initiative', 'creativity', 'flexibility'],
  student_academic: ['ap courses', 'honors', 'dean\'s list', 'honor roll', 'valedictorian', 'salutatorian', 'cum laude', 'magna cum laude', 'summa cum laude', 'academic excellence', 'scholarship recipient'],
  student_tech: ['microsoft office', 'google docs', 'powerpoint', 'word', 'typing', 'computer skills', 'internet research', 'zoom', 'google meet', 'slack', 'discord']
};

const EDUCATION_LEVELS: Record<string, string[]> = {
  'PhD': ['ph.d', 'phd', 'doctorate', 'doctoral', 'doctor of philosophy'],
  'Masters': ['master', 'mba', 'm.s.', 'ms', 'm.a.', 'ma', 'msc', 'med', 'mpa', 'mph', 'msw'],
  'Bachelors': ['bachelor', 'b.s.', 'bs', 'b.a.', 'ba', 'bsc', 'undergraduate', 'beng', 'bfa'],
  'Associates': ['associate', 'a.s.', 'as', 'a.a.', 'aa', 'aas'],
  'High School': ['high school', 'ged', 'diploma', 'secondary']
};

const MAJOR_PATTERNS: Record<string, string[]> = {
  'Computer Science': ['computer science', 'cs', 'computing', 'software engineering', 'computer engineering', 'information technology', 'it'],
  'Business': ['business', 'management', 'mba', 'business administration', 'commerce', 'economics', 'finance', 'accounting', 'marketing'],
  'Engineering': ['engineering', 'mechanical', 'electrical', 'civil', 'chemical', 'aerospace', 'biomedical', 'industrial'],
  'Healthcare': ['nursing', 'medicine', 'pre-med', 'health sciences', 'public health', 'pharmacy', 'biology', 'biochemistry'],
  'Arts': ['art', 'design', 'fine arts', 'graphic design', 'music', 'theater', 'film', 'media', 'communications'],
  'Sciences': ['physics', 'chemistry', 'biology', 'mathematics', 'statistics', 'environmental science', 'geology'],
  'Social Sciences': ['psychology', 'sociology', 'political science', 'history', 'anthropology', 'philosophy', 'international relations'],
  'Education': ['education', 'teaching', 'pedagogy', 'curriculum', 'instructional design'],
  'Law': ['law', 'legal studies', 'pre-law', 'criminal justice', 'paralegal']
};

const INDUSTRY_PATTERNS: Record<string, string[]> = {
  'Technology': ['software', 'tech', 'technology', 'startup', 'saas', 'fintech', 'it company', 'digital'],
  'Healthcare': ['hospital', 'clinic', 'healthcare', 'medical', 'pharmaceutical', 'biotech', 'health'],
  'Finance': ['bank', 'investment', 'financial', 'insurance', 'accounting firm', 'wealth management'],
  'Education': ['school', 'university', 'college', 'education', 'academic', 'research institution'],
  'Manufacturing': ['manufacturing', 'factory', 'production', 'industrial', 'automotive'],
  'Retail': ['retail', 'store', 'e-commerce', 'consumer goods', 'shopping'],
  'Consulting': ['consulting', 'advisory', 'professional services'],
  'Government': ['government', 'federal', 'state', 'municipal', 'public sector'],
  'Non-Profit': ['non-profit', 'nonprofit', 'ngo', 'charity', 'foundation']
};

const INTEREST_KEYWORDS = [
  'passionate about', 'interested in', 'enthusiastic about', 'love to', 'enjoy',
  'dedicated to', 'committed to', 'focused on', 'specializing in', 'expertise in',
  'background in', 'experience with', 'skilled in', 'proficient in',
  // Student-friendly phrases
  'want to study', 'planning to major', 'career goal', 'dream job', 'aspire to',
  'hope to become', 'future career', 'want to be', 'interested in becoming'
];

// Student activities and extracurriculars that indicate interests
const STUDENT_ACTIVITIES: Record<string, string[]> = {
  'STEM': ['robotics club', 'science club', 'math club', 'coding club', 'computer club', 'engineering club', 'science olympiad', 'math olympiad', 'hackathon', 'stem program'],
  'Healthcare': ['health club', 'pre-med club', 'red cross', 'hospital volunteer', 'medical shadowing', 'nursing assistant', 'health sciences'],
  'Business': ['deca', 'fbla', 'business club', 'entrepreneurship', 'investment club', 'marketing club', 'economics club', 'finance club'],
  'Arts': ['art club', 'drama club', 'theater', 'band', 'orchestra', 'choir', 'dance team', 'film club', 'photography club', 'creative writing'],
  'Leadership': ['student council', 'student government', 'class president', 'club president', 'team captain', 'peer mentor', 'orientation leader', 'resident advisor', 'ra'],
  'Community Service': ['volunteer', 'community service', 'habitat for humanity', 'food bank', 'animal shelter', 'nonprofit', 'charity', 'service learning', 'key club', 'interact club'],
  'Sports': ['varsity', 'jv', 'junior varsity', 'team sports', 'athletics', 'sports captain', 'basketball', 'football', 'soccer', 'baseball', 'track', 'swimming', 'tennis', 'volleyball'],
  'Journalism': ['newspaper', 'yearbook', 'school paper', 'journalism', 'editor', 'reporter', 'broadcasting'],
  'Environment': ['environmental club', 'sustainability', 'recycling', 'green team', 'climate action', 'nature club'],
  'Languages': ['spanish club', 'french club', 'language club', 'model un', 'international club', 'cultural club']
};

// Coursework patterns that indicate interests
const COURSEWORK_INTERESTS: Record<string, string[]> = {
  'Technology': ['ap computer science', 'computer science', 'programming class', 'web design', 'digital media', 'information technology'],
  'Sciences': ['ap biology', 'ap chemistry', 'ap physics', 'anatomy', 'physiology', 'environmental science', 'earth science'],
  'Mathematics': ['ap calculus', 'ap statistics', 'precalculus', 'algebra', 'geometry', 'trigonometry'],
  'Business': ['economics', 'ap economics', 'business class', 'accounting class', 'marketing class', 'entrepreneurship class'],
  'Healthcare': ['health class', 'medical terminology', 'nursing class', 'cna course', 'health occupations'],
  'Arts': ['art class', 'studio art', 'music theory', 'drama class', 'theater arts', 'creative writing class'],
  'Social Sciences': ['ap psychology', 'ap history', 'government', 'civics', 'sociology', 'anthropology']
};

const CERTIFICATION_PATTERNS = [
  'certified', 'certification', 'certificate', 'license', 'licensed',
  'pmp', 'cpa', 'cfa', 'aws certified', 'azure certified', 'google certified',
  'cisco', 'comptia', 'scrum master', 'six sigma', 'itil', 'prince2'
];

export class MLResumeParser {
  
  parseResume(text: string): ParsedResume {
    const normalizedText = this.normalizeText(text);
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    const skills = this.extractSkills(normalizedText);
    const education = this.extractEducation(normalizedText, lines);
    const experience = this.extractExperience(normalizedText, lines);
    const interests = this.extractInterests(normalizedText);
    const demographics = this.extractDemographics(normalizedText);
    const careerGoals = this.extractCareerGoals(normalizedText);
    const certifications = this.extractCertifications(normalizedText);
    const atsScore = this.calculateATSScore(skills, education, experience, certifications, interests);
    const experienceSummary = this.generateExperienceSummary(experience, skills, interests, education);
    
    return {
      skills,
      education,
      interests,
      experience,
      demographics,
      careerGoals,
      certifications,
      atsScore,
      experienceSummary
    };
  }
  
  private normalizeText(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s\.\,\-\/\@\#\+]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  
  private extractSkills(text: string): string[] {
    const foundSkills = new Set<string>();
    
    for (const [category, patterns] of Object.entries(SKILL_PATTERNS)) {
      for (const pattern of patterns) {
        const regex = new RegExp(`\\b${pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
        if (regex.test(text)) {
          foundSkills.add(this.capitalizeSkill(pattern));
        }
      }
    }
    
    const additionalSkills = this.extractContextualSkills(text);
    additionalSkills.forEach(skill => foundSkills.add(skill));
    
    return Array.from(foundSkills).slice(0, 25);
  }
  
  private extractContextualSkills(text: string): string[] {
    const skills: string[] = [];
    
    const skillSectionMatch = text.match(/skills?[:\s]+([^]*?)(?=education|experience|work|project|$)/i);
    if (skillSectionMatch) {
      const skillSection: string = skillSectionMatch[1] ?? '';
      const skillWords: string[] = skillSection.match(/\b[a-z][a-z\+\#\.]+\b/gi) ?? [];
      skillWords.forEach((word: string) => {
        if (word.length > 2 && word.length < 30) {
          skills.push(this.capitalizeSkill(word));
        }
      });
    }
    
    return skills.slice(0, 10);
  }
  
  private capitalizeSkill(skill: string): string {
    const upperCaseSkills = ['sql', 'html', 'css', 'aws', 'gcp', 'api', 'ci/cd', 'seo', 'sem', 'crm', 'erp', 'ui/ux'];
    if (upperCaseSkills.includes(skill.toLowerCase())) {
      return skill.toUpperCase();
    }
    return skill.split(' ').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
    ).join(' ');
  }
  
  private extractEducation(text: string, lines: string[]): ParsedResume['education'] {
    let level = 'Unknown';
    let major = 'General Studies';
    let gpa: number | null = null;
    let institution: string | null = null;
    let graduationYear: number | null = null;
    
    for (const [eduLevel, patterns] of Object.entries(EDUCATION_LEVELS)) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          level = eduLevel;
          break;
        }
      }
      if (level !== 'Unknown') break;
    }
    
    for (const [majorName, patterns] of Object.entries(MAJOR_PATTERNS)) {
      for (const pattern of patterns) {
        const regex = new RegExp(`\\b${pattern}\\b`, 'i');
        if (regex.test(text)) {
          major = majorName;
          break;
        }
      }
      if (major !== 'General Studies') break;
    }
    
    const gpaMatch = text.match(/gpa[:\s]*(\d+\.?\d*)\s*(?:\/\s*4\.0)?/i) ||
                     text.match(/(\d+\.\d+)\s*(?:\/\s*4\.0)?\s*gpa/i);
    if (gpaMatch) {
      const gpaValue = parseFloat(gpaMatch[1]);
      if (gpaValue >= 0 && gpaValue <= 4.0) {
        gpa = gpaValue;
      } else if (gpaValue > 4.0 && gpaValue <= 100) {
        gpa = (gpaValue / 100) * 4.0;
      }
    }
    
    const universityPatterns = [
      /university\s+of\s+[\w\s]+/gi,
      /[\w\s]+\s+university/gi,
      /[\w\s]+\s+college/gi,
      /[\w\s]+\s+institute/gi
    ];
    
    for (const pattern of universityPatterns) {
      const match = text.match(pattern);
      if (match) {
        institution = match[0].split(' ').map(w => 
          w.charAt(0).toUpperCase() + w.slice(1)
        ).join(' ');
        break;
      }
    }
    
    const yearMatch = text.match(/(?:graduated?|class\s+of|expected)\s*:?\s*(20\d{2})/i) ||
                      text.match(/(20\d{2})\s*(?:-|–)\s*(?:present|current)/i) ||
                      text.match(/\b(20[1-3]\d)\b/);
    if (yearMatch) {
      graduationYear = parseInt(yearMatch[1]);
    }
    
    return { level, major, gpa, institution, graduationYear };
  }
  
  private extractExperience(text: string, lines: string[]): ParsedResume['experience'] {
    let years = 0;
    const industries = new Set<string>();
    const roles = new Set<string>();
    
    const yearPatterns = [
      /(\d+)\+?\s*years?\s+(?:of\s+)?experience/i,
      /experience[:\s]+(\d+)\+?\s*years?/i,
      /over\s+(\d+)\s*years?/i
    ];
    
    for (const pattern of yearPatterns) {
      const match = text.match(pattern);
      if (match) {
        years = parseInt(match[1]);
        break;
      }
    }
    
    if (years === 0) {
      const dateRanges = text.match(/20\d{2}\s*(?:-|–|to)\s*(?:20\d{2}|present|current)/gi) || [];
      let totalMonths = 0;
      for (const range of dateRanges) {
        const years_match = range.match(/(\d{4})/g);
        if (years_match && years_match.length >= 1) {
          const startYear = parseInt(years_match[0]);
          const endYear = range.toLowerCase().includes('present') || range.toLowerCase().includes('current')
            ? new Date().getFullYear()
            : (years_match[1] ? parseInt(years_match[1]) : startYear);
          totalMonths += (endYear - startYear) * 12;
        }
      }
      years = Math.round(totalMonths / 12);
    }
    
    for (const [industry, patterns] of Object.entries(INDUSTRY_PATTERNS)) {
      for (const pattern of patterns) {
        if (text.includes(pattern)) {
          industries.add(industry);
          break;
        }
      }
    }
    
    const rolePatterns = [
      /(?:worked\s+as|position[:\s]+|role[:\s]+|title[:\s]+)([^,\.\n]+)/gi,
      /(senior|junior|lead|principal|staff|associate|manager|director|analyst|engineer|developer|designer|specialist|coordinator|administrator|consultant|intern)/gi
    ];
    
    for (const pattern of rolePatterns) {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        const role = match[1] || match[0];
        if (role.length > 3 && role.length < 50) {
          roles.add(this.capitalizeSkill(role.trim()));
        }
      }
    }
    
    return {
      years: Math.min(years, 50),
      industries: Array.from(industries).slice(0, 5),
      roles: Array.from(roles).slice(0, 10)
    };
  }
  
  private extractInterests(text: string): string[] {
    const interests = new Set<string>();
    const interestStrength = new Map<string, number>();
    
    const addInterest = (name: string, strength: number) => {
      const current = interestStrength.get(name) || 0;
      interestStrength.set(name, Math.max(current, strength));
      interests.add(name);
    };

    const GARBAGE_FILTER = /^(and|the|a|an|to|for|with|in|on|of|at|by|from|or|as|is|it|that|this|provider|elbow|support|nursing elbow|provider and)/i;
    const isGarbage = (text: string) => {
      if (text.length < 3 || text.length > 50) return true;
      if (GARBAGE_FILTER.test(text)) return true;
      if (/^\d+$/.test(text)) return true;
      const words = text.split(/\s+/);
      if (words.length > 6) return true;
      return false;
    };
    
    // Extract from explicit interest keywords (HIGH strength - user stated directly)
    for (const keyword of INTEREST_KEYWORDS) {
      const regex = new RegExp(`${keyword}\\s+([^,\\.\\n]+)`, 'gi');
      const matches = Array.from(text.matchAll(regex));
      for (const match of matches) {
        const interest = match[1].trim();
        if (!isGarbage(interest)) {
          addInterest(this.capitalizeSkill(interest), 3);
        }
      }
    }
    
    // Extract from skill categories - ONLY add if multiple patterns match (not just one stray keyword)
    for (const [category, patterns] of Object.entries(SKILL_PATTERNS)) {
      if (category.startsWith('student_')) continue;
      let matchCount = 0;
      for (const pattern of patterns) {
        if (text.includes(pattern)) matchCount++;
      }
      if (matchCount >= 2) {
        addInterest(this.capitalizeSkill(category), 2);
      }
    }
    
    // Extract from student activities and extracurriculars
    for (const [interest, activities] of Object.entries(STUDENT_ACTIVITIES)) {
      for (const activity of activities) {
        if (text.includes(activity)) {
          addInterest(interest, 2);
          break;
        }
      }
    }
    
    // Extract from coursework
    for (const [interest, courses] of Object.entries(COURSEWORK_INTERESTS)) {
      for (const course of courses) {
        if (text.includes(course)) {
          addInterest(interest, 2);
          break;
        }
      }
    }
    
    // Sort by strength (strongest first) and limit to 8 to avoid flooding profile
    return Array.from(interests)
      .sort((a, b) => (interestStrength.get(b) || 0) - (interestStrength.get(a) || 0))
      .slice(0, 8);
  }
  
  private extractDemographics(text: string): string[] {
    const demographics: string[] = [];
    
    if (/first[\s-]?gen(?:eration)?/i.test(text)) {
      demographics.push('First-Generation Student');
    }
    if (/veteran|military|armed forces/i.test(text)) {
      demographics.push('Veteran');
    }
    if (/underrepresented|minority|diverse/i.test(text)) {
      demographics.push('Underrepresented');
    }
    if (/disability|disabled|ada/i.test(text)) {
      demographics.push('Has Disability');
    }
    if (/low[\s-]?income|financial need|pell grant|fafsa/i.test(text)) {
      demographics.push('Financial Need');
    }
    if (/international student|f-?1 visa|student visa/i.test(text)) {
      demographics.push('International Student');
    }
    if (/transfer student/i.test(text)) {
      demographics.push('Transfer Student');
    }
    
    return demographics;
  }
  
  private extractCareerGoals(text: string): string[] {
    const goals: string[] = [];
    
    const goalPatterns = [
      /(?:seeking|looking for|objective|goal)[:\s]+([^\.]+)/gi,
      /(?:aspire|aim|want)\s+to\s+([^\.]+)/gi,
      /career\s+(?:goal|objective)[:\s]+([^\.]+)/gi
    ];
    
    for (const pattern of goalPatterns) {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        const goal = match[1].trim();
        if (goal.length > 10 && goal.length < 150) {
          goals.push(goal.charAt(0).toUpperCase() + goal.slice(1));
        }
      }
    }
    
    return goals.slice(0, 5);
  }
  
  private extractCertifications(text: string): string[] {
    const certifications = new Set<string>();
    
    for (const pattern of CERTIFICATION_PATTERNS) {
      const regex = new RegExp(`${pattern}[\\s\\w]*(?:in|for)?\\s*([^,\\.\\n]{3,40})`, 'gi');
      const matches = Array.from(text.matchAll(regex));
      for (const match of matches) {
        certifications.add(match[0].trim());
      }
    }
    
    const certPatterns = [
      /aws\s+certified\s+[\w\s]+/gi,
      /google\s+cloud\s+[\w\s]+/gi,
      /microsoft\s+certified\s+[\w\s]+/gi,
      /cisco\s+[\w\s]+/gi,
      /comptia\s+[\w\+]+/gi,
      /pmp/gi,
      /cpa/gi,
      /cfa/gi,
      /six\s+sigma\s+[\w\s]+/gi
    ];
    
    for (const pattern of certPatterns) {
      const matches = Array.from(text.matchAll(pattern));
      for (const match of matches) {
        certifications.add(this.capitalizeSkill(match[0].trim()));
      }
    }
    
    return Array.from(certifications).slice(0, 10);
  }
  
  private calculateATSScore(
    skills: string[],
    education: ParsedResume['education'],
    experience: ParsedResume['experience'],
    certifications: string[],
    interests: string[] = []
  ): number {
    let score = 0;
    
    // Skills (max 25 pts) - more generous for students
    score += Math.min(skills.length * 4, 25);
    
    // Education (max 20 pts) - higher value for high school students
    const eduPoints: Record<string, number> = {
      'PhD': 20,
      'Masters': 18,
      'Bachelors': 16,
      'Associates': 14,
      'High School': 12,  // Increased from 5 - students are in progress
      'Unknown': 8        // Give some credit for having a resume
    };
    score += eduPoints[education.level] || 8;
    
    // GPA bonus (max 10 pts) - more granular for students
    if (education.gpa) {
      if (education.gpa >= 3.8) score += 10;
      else if (education.gpa >= 3.5) score += 8;
      else if (education.gpa >= 3.2) score += 6;
      else if (education.gpa >= 3.0) score += 4;
      else if (education.gpa >= 2.5) score += 2;
    }
    
    // Experience (max 15 pts) - reduced weight for students
    score += Math.min(experience.years * 3, 15);
    
    // Roles/Activities (max 10 pts)
    score += Math.min(experience.roles.length * 2, 10);
    
    // Certifications (max 10 pts)
    score += Math.min(certifications.length * 3, 10);
    
    // Interests/Activities bonus (max 10 pts) - rewards engaged students
    score += Math.min(interests.length * 2, 10);
    
    return Math.min(score, 100);
  }
  
  private generateExperienceSummary(
    experience: ParsedResume['experience'],
    skills: string[],
    interests: string[] = [],
    education?: ParsedResume['education']
  ): string {
    const parts: string[] = [];
    
    // For students with no work experience, focus on education and interests
    if (experience.years === 0) {
      if (education) {
        if (education.level === 'High School') {
          parts.push('High school student');
        } else if (education.level === 'Bachelors' || education.level === 'Associates') {
          parts.push(`College student studying ${education.major || 'undeclared'}`);
        } else {
          parts.push(`${education.level} student`);
        }
        
        if (education.gpa && education.gpa >= 3.0) {
          parts.push(`with ${education.gpa.toFixed(2)} GPA`);
        }
      }
      
      if (interests.length > 0) {
        parts.push(`Interested in ${interests.slice(0, 3).join(', ')}`);
      }
    } else {
      parts.push(`${experience.years}+ years of experience`);
      
      if (experience.industries.length > 0) {
        parts.push(`in ${experience.industries.slice(0, 3).join(', ')}`);
      }
      
      if (experience.roles.length > 0) {
        parts.push(`with roles including ${experience.roles.slice(0, 3).join(', ')}`);
      }
    }
    
    if (skills.length > 0) {
      parts.push(`Key skills: ${skills.slice(0, 5).join(', ')}`);
    }
    
    return parts.length > 0 ? parts.join('. ') + '.' : 'Student with potential - complete your profile for better matching.';
  }
}

export const mlResumeParser = new MLResumeParser();
