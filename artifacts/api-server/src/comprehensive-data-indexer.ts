import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

interface ComprehensiveCareerData {
  title: string;
  onetCode: string;
  description: string;
  skills: string[];
  interests: string[];
  industries: string[];
  education: string;
  salary: number;
  growth: string;
  workActivities: string[];
  workContext: string[];
  workValues: string[];
  riasec: string[];
  knowledge: string[];
  abilities: string[];
  tools: string[];
}

interface SkillIndex {
  [skill: string]: {
    careers: string[];
    salaryRange: { min: number; max: number; avg: number };
    demandLevel: string;
    industries: string[];
  };
}

interface InterestIndex {
  [interest: string]: {
    careers: string[];
    salaryRange: { min: number; max: number; avg: number };
    industries: string[];
    marketOutlook: string;
    riasecAlignment: string[];
  };
}

class ComprehensiveDataIndexer {
  private careerDatabase: ComprehensiveCareerData[] = [];
  private skillIndex: SkillIndex = {};
  private interestIndex: InterestIndex = {};
  private industryIndex: { [industry: string]: string[] } = {};
  private salaryIndex: { [range: string]: string[] } = {};
  
  constructor() {
    console.log('🏗️ Initializing Comprehensive Data Indexer...');
  }

  async loadAllDatasets() {
    console.log('📊 Loading all career datasets for comprehensive indexing...');
    
    // Load O*NET reference files
    await this.loadONETReferenceData();
    
    // Load resume datasets
    await this.loadResumeDatasets();
    
    // Load synthetic career data
    await this.loadSyntheticCareerData();
    
    // Build comprehensive indexes
    this.buildComprehensiveIndexes();
    
    console.log(`✅ Comprehensive indexing complete:
    - ${this.careerDatabase.length} careers indexed
    - ${Object.keys(this.skillIndex).length} skills indexed  
    - ${Object.keys(this.interestIndex).length} interests indexed
    - ${Object.keys(this.industryIndex).length} industries indexed`);
  }

  private async loadONETReferenceData() {
    const dataFiles = [
      'Interests_1749748623551.txt',
      'Skills to Work Activities_1749748603626.txt', 
      'Technology Skills_1749748678650.txt',
      'Work Values_1749748611435.txt',
      'Knowledge_1749748581889.txt',
      'Basic Interests to RIASEC_1749748568584.txt',
      'Alternate Titles_1749748630702.txt'
    ];

    for (const file of dataFiles) {
      const filePath = path.join('./attached_assets', file);
      if (fs.existsSync(filePath)) {
        console.log(`📋 Loading O*NET reference: ${file}`);
        await this.processONETFile(filePath);
      }
    }
  }

  private async loadResumeDatasets() {
    const resumeFiles = [
      'AI_Resume_Screening_1753820723446.csv',
      'Resume_1753820281179.csv', 
      'Synthetic_Career_Matching_Dataset_1753821198906.csv',
      'resume_job_matching_dataset_1753820272355.csv'
    ];

    for (const file of resumeFiles) {
      const filePath = path.join('./attached_assets', file);
      if (fs.existsSync(filePath)) {
        console.log(`📄 Processing resume dataset: ${file}`);
        await this.processResumeDataset(filePath);
      }
    }
  }

  private async loadSyntheticCareerData() {
    const syntheticPath = path.join('./attached_assets', 'Synthetic_Career_Matching_Dataset_1753821198906.csv');
    if (fs.existsSync(syntheticPath)) {
      console.log('🔬 Processing synthetic career matching data...');
      await this.processSyntheticCareerData(syntheticPath);
    }
  }

  private async processONETFile(filePath: string) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    // Extract career-related data based on file type
    if (filePath.includes('Interests')) {
      this.processInterestsFile(lines);
    } else if (filePath.includes('Skills')) {
      this.processSkillsFile(lines);
    } else if (filePath.includes('Knowledge')) {
      this.processKnowledgeFile(lines);
    } else if (filePath.includes('RIASEC')) {
      this.processRiasecFile(lines);
    }
  }

  private processInterestsFile(lines: string[]) {
    for (const line of lines) {
      if (line.includes('\t') || line.includes(',')) {
        const parts = line.split(/[\t,]/);
        if (parts.length >= 2) {
          const interest = parts[1]?.trim();
          if (interest && interest.length > 2) {
            if (!this.interestIndex[interest]) {
              this.interestIndex[interest] = {
                careers: [],
                salaryRange: { min: 30000, max: 150000, avg: 65000 },
                industries: [],
                marketOutlook: 'Stable',
                riasecAlignment: []
              };
            }
          }
        }
      }
    }
  }

  private processSkillsFile(lines: string[]) {
    for (const line of lines) {
      if (line.includes('\t') || line.includes(',')) {
        const parts = line.split(/[\t,]/);
        for (const part of parts) {
          const skill = part.trim();
          if (skill && skill.length > 2 && !skill.match(/^\d/)) {
            if (!this.skillIndex[skill]) {
              this.skillIndex[skill] = {
                careers: [],
                salaryRange: { min: 35000, max: 120000, avg: 70000 },
                demandLevel: 'Moderate',
                industries: []
              };
            }
          }
        }
      }
    }
  }

  private processKnowledgeFile(lines: string[]) {
    for (const line of lines) {
      const parts = line.split(/[\t,]/);
      for (const part of parts) {
        const knowledge = part.trim();
        if (knowledge && knowledge.length > 3) {
          if (!this.skillIndex[knowledge]) {
            this.skillIndex[knowledge] = {
              careers: [],
              salaryRange: { min: 40000, max: 130000, avg: 75000 },
              demandLevel: 'Growing',
              industries: []
            };
          }
        }
      }
    }
  }

  private processRiasecFile(lines: string[]) {
    for (const line of lines) {
      const parts = line.split(/[\t,]/);
      if (parts.length >= 2) {
        const interest = parts[0]?.trim();
        const riasec = parts[1]?.trim();
        if (interest && riasec && this.interestIndex[interest]) {
          this.interestIndex[interest].riasecAlignment.push(riasec);
        }
      }
    }
  }

  private async processResumeDataset(filePath: string) {
    return new Promise<void>((resolve) => {
      const results: any[] = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          this.extractCareersFromResumeData(results);
          resolve();
        });
    });
  }

  private async processSyntheticCareerData(filePath: string) {
    return new Promise<void>((resolve) => {
      const results: any[] = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          this.extractCareersFromSyntheticData(results);
          resolve();
        });
    });
  }

  private extractCareersFromResumeData(data: any[]) {
    console.log(`📊 Processing ${data.length} resume records`);
    let careerCount = 0;
    
    for (const record of data) {
      // Try multiple field variations for job titles
      const jobTitle = record['Job Role'] || record['Job Title'] || record['job_title'] || record['title'] || 
                      record['Position'] || record['Role'] || record['Job_Title'] || 
                      record['position'] || record['role'] || record['occupation'];
      
      if (jobTitle && typeof jobTitle === 'string' && jobTitle.length > 2) {
        // Use enriched skills based on job title instead of noisy CSV data
        const skills = this.enrichSkillsForCareer(jobTitle.toLowerCase(), []);
        const education = record['Education'] || record['education'] || record['Education Level'] || 
                         record['education_level'] || record['degree'] || 'Bachelor';
        const industry = record['Industry'] || record['industry'] || record['Sector'] || 
                        record['sector'] || record['field'] || 'Technology';
        
        const career: ComprehensiveCareerData = {
          title: this.cleanJobTitle(jobTitle),
          onetCode: this.generateONETCode(jobTitle),
          description: this.generateJobDescription(jobTitle, skills),
          skills: skills,
          interests: this.mapSkillsToInterests(skills, jobTitle),
          industries: this.extractIndustriesFromJob(jobTitle, industry),
          education: education,
          salary: this.estimateSalary(jobTitle, skills),
          growth: this.estimateGrowth(jobTitle),
          workActivities: this.generateWorkActivities(skills),
          workContext: ['Professional environment'],
          workValues: ['Achievement', 'Independence'],
          riasec: this.mapToRiasec(jobTitle, skills),
          knowledge: skills.filter(s => s.length > 3),
          abilities: this.generateAbilities(skills),
          tools: this.generateTools(skills)
        };
        
        this.careerDatabase.push(career);
        careerCount++;
      }
    }
    
    console.log(`🎯 Extracted ${careerCount} careers from resume dataset`);
  }

  private extractCareersFromSyntheticData(data: any[]) {
    console.log(`📊 Processing ${data.length} synthetic career records`);
    let careerCount = 0;
    
    for (const record of data) {
      // Try multiple field variations for career titles
      const career = record['target_career'] || record['career_field'] || record['Career'] || record['job'] || 
                    record['job_title'] || record['position'] || record['role'] || 
                    record['Job_Title'] || record['Position'];
      
      if (career && typeof career === 'string' && career.length > 2) {
        const skills = this.parseSkillsFromRecord(record);
        const industries = this.extractIndustries(record);
        
        const careerData: ComprehensiveCareerData = {
          title: this.cleanJobTitle(career),
          onetCode: this.generateONETCode(career),
          description: record['description'] || record['job_description'] || this.generateJobDescription(career, skills),
          skills: skills,
          interests: this.mapSkillsToInterests(skills, career),
          industries: industries,
          education: record['education_required'] || record['education'] || record['Education'] || 'Bachelor',
          salary: this.parseSalary(record['salary']) || this.estimateSalary(career, skills),
          growth: record['growth_rate'] || record['job_growth'] || this.estimateGrowth(career),
          workActivities: this.generateWorkActivities(skills),
          workContext: ['Professional environment'],
          workValues: ['Achievement', 'Recognition'],
          riasec: this.mapToRiasec(career, skills),
          knowledge: skills,
          abilities: this.generateAbilities(skills),
          tools: this.generateTools(skills)
        };
        
        this.careerDatabase.push(careerData);
        careerCount++;
      }
    }
    
    console.log(`🎯 Extracted ${careerCount} careers from synthetic dataset`);
  }

  private extractSkillsFromText(text: string): string[] {
    if (!text) return ['Communication', 'Problem Solving'];
    
    const comprehensiveSkills = [
      // Technical Skills
      'Programming', 'Python', 'JavaScript', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Swift',
      'React', 'Angular', 'Vue.js', 'Node.js', 'Express', 'Django', 'Flask', 'Spring',
      'Data Analysis', 'Machine Learning', 'Deep Learning', 'AI', 'Data Science', 'Statistics',
      'SQL', 'MongoDB', 'PostgreSQL', 'MySQL', 'Redis', 'Elasticsearch',
      'AWS', 'Azure', 'Google Cloud', 'Docker', 'Kubernetes', 'DevOps', 'CI/CD',
      'Git', 'GitHub', 'Version Control', 'Agile', 'Scrum', 'Project Management',
      
      // Business Skills  
      'Marketing', 'Digital Marketing', 'SEO', 'SEM', 'Content Marketing', 'Social Media',
      'Sales', 'Business Development', 'Account Management', 'Customer Success',
      'Finance', 'Accounting', 'Financial Analysis', 'Budgeting', 'Investment',
      'Strategy', 'Business Analysis', 'Process Improvement', 'Operations',
      
      // Healthcare Skills
      'Nursing', 'Patient Care', 'Medical', 'Healthcare', 'Clinical', 'Pharmacy',
      'Surgery', 'Diagnosis', 'Treatment', 'Emergency Care', 'Rehabilitation',
      'Mental Health', 'Therapy', 'Counseling', 'Social Work',
      
      // Education Skills
      'Teaching', 'Education', 'Curriculum Development', 'Training', 'Learning',
      'Research', 'Academic Writing', 'Presentation', 'Public Speaking',
      
      // Creative Skills
      'Design', 'Graphic Design', 'UI/UX', 'Web Design', 'Photography', 'Video Production',
      'Writing', 'Content Creation', 'Copywriting', 'Editing', 'Translation',
      'Art', 'Music', 'Animation', '3D Modeling',
      
      // Engineering Skills
      'Engineering', 'Mechanical Engineering', 'Electrical Engineering', 'Civil Engineering',
      'Software Engineering', 'Chemical Engineering', 'Biomedical Engineering',
      'CAD', 'AutoCAD', 'SolidWorks', 'Manufacturing', 'Quality Control',
      
      // Soft Skills
      'Leadership', 'Management', 'Team Management', 'Communication', 'Collaboration',
      'Problem Solving', 'Critical Thinking', 'Decision Making', 'Time Management',
      'Organization', 'Attention to Detail', 'Customer Service', 'Negotiation'
    ];
    
    const foundSkills = comprehensiveSkills.filter(skill => 
      text.toLowerCase().includes(skill.toLowerCase())
    );
    
    // Extract skills from comma-separated or pipe-separated lists
    const skillList = text.split(/[,|;]/).map(s => s.trim()).filter(s => s.length > 2 && s.length < 30);
    foundSkills.push(...skillList);
    
    return foundSkills.length > 0 ? [...new Set(foundSkills)] : ['Communication', 'Problem Solving'];
  }

  private parseSkillsFromRecord(record: any): string[] {
    // Only use enriched profession-specific skills based on job title
    // This avoids the 50K+ noisy skills from CSV data
    const career = record['job_role'] || record['Job_Title'] || record['job_title'] || record['position'] || '';
    const enrichedSkills = this.enrichSkillsForCareer(career.toLowerCase(), []);
    
    return enrichedSkills.length > 0 ? enrichedSkills : ['Communication', 'Teamwork', 'Problem Solving'];
  }
  
  private enrichSkillsForCareer(careerLower: string, existingSkills: string[]): string[] {
    const skills = [...existingSkills];
    
    // Transferable skills that apply to most careers
    const universalSkills = ['Communication', 'Teamwork', 'Problem Solving', 'Time Management', 'Critical Thinking'];
    
    // Add profession-specific skills based on career keywords
    const professionMap = {
      // Food Service & Hospitality
      'barista|coffee|cafe': ['Customer Service', 'Food Safety', 'Cash Handling', 'Multitasking', 'Beverage Preparation'],
      'waiter|waitress|server': ['Customer Service', 'Communication', 'Multitasking', 'Memory Skills', 'Table Service'],
      'chef|cook': ['Cooking', 'Food Safety', 'Kitchen Management', 'Recipe Development', 'Time Management'],
      'bartender': ['Customer Service', 'Mixology', 'Inventory Management', 'Cash Handling', 'Communication'],
      
      // Public Service & Safety
      'police|officer|law enforcement': ['Law Enforcement', 'Public Safety', 'Crisis Management', 'Conflict Resolution', 'Physical Fitness'],
      'firefighter': ['Emergency Response', 'Physical Fitness', 'Teamwork', 'Safety Procedures', 'Equipment Operation'],
      'paramedic|emt': ['Emergency Medical Care', 'Patient Assessment', 'Crisis Management', 'Communication', 'Physical Stamina'],
      
      // Healthcare & Social Services
      'psychologist|therapist|counselor': ['Active Listening', 'Empathy', 'Mental Health Assessment', 'Counseling', 'Crisis Intervention'],
      'social worker': ['Case Management', 'Advocacy', 'Counseling', 'Community Resources', 'Cultural Competency'],
      'nurse|nursing': ['Patient Care', 'Medical Knowledge', 'Communication', 'Critical Thinking', 'Compassion'],
      'doctor|physician': ['Medical Diagnosis', 'Patient Care', 'Clinical Skills', 'Decision Making', 'Medical Knowledge'],
      
      // Trades & Technical
      'electrician': ['Electrical Systems', 'Troubleshooting', 'Safety Compliance', 'Blueprint Reading', 'Manual Dexterity'],
      'plumber': ['Plumbing Systems', 'Troubleshooting', 'Customer Service', 'Physical Strength', 'Problem Solving'],
      'carpenter': ['Woodworking', 'Blueprint Reading', 'Measurement', 'Tool Operation', 'Attention to Detail'],
      'mechanic': ['Automotive Repair', 'Diagnostics', 'Troubleshooting', 'Tool Proficiency', 'Problem Solving'],
      
      // Business & Management
      'manager|management': ['Leadership', 'Team Management', 'Strategic Planning', 'Decision Making', 'Communication'],
      'accountant': ['Accounting', 'Financial Analysis', 'Attention to Detail', 'Tax Knowledge', 'Excel'],
      'sales': ['Sales', 'Negotiation', 'Communication', 'Relationship Building', 'Persuasion'],
      'marketing': ['Marketing Strategy', 'Brand Management', 'Digital Marketing', 'Analytics', 'Creativity'],
      
      // Education
      'teacher|educator|instructor': ['Teaching', 'Lesson Planning', 'Classroom Management', 'Communication', 'Patience'],
      'tutor': ['Subject Expertise', 'One-on-One Teaching', 'Patience', 'Communication', 'Adaptability'],
      
      // Retail & Customer Service
      'retail|cashier|clerk': ['Customer Service', 'Cash Handling', 'Product Knowledge', 'Organization', 'Communication'],
      'customer service': ['Customer Service', 'Communication', 'Conflict Resolution', 'Patience', 'Active Listening'],
      
      // Warehouse & Logistics
      'warehouse': ['Inventory Management', 'Forklift Operation', 'Organization', 'Physical Stamina', 'Safety Procedures'],
      'driver|delivery': ['Safe Driving', 'Time Management', 'Customer Service', 'Route Planning', 'Physical Fitness'],
      
      // Creative & Media
      'designer|design': ['Creativity', 'Design Software', 'Visual Communication', 'Attention to Detail', 'Problem Solving'],
      'writer|author': ['Writing', 'Research', 'Editing', 'Creativity', 'Communication'],
      'photographer': ['Photography', 'Photo Editing', 'Creativity', 'Technical Skills', 'Attention to Detail'],
      
      // Technology (complement existing tech skills)
      'developer|programmer': ['Programming', 'Problem Solving', 'Debugging', 'Code Review', 'Technical Documentation'],
      'analyst': ['Data Analysis', 'Critical Thinking', 'Excel', 'Reporting', 'Attention to Detail'],
      
      // Legal
      'lawyer|attorney|legal': ['Legal Research', 'Writing', 'Negotiation', 'Critical Thinking', 'Public Speaking'],
      'paralegal|legal assistant': ['Legal Research', 'Document Preparation', 'Organization', 'Attention to Detail', 'Communication'],
      
      // Science & Engineering
      'scientist|researcher': ['Research', 'Data Analysis', 'Scientific Method', 'Technical Writing', 'Critical Thinking'],
      'engineer': ['Engineering Design', 'Problem Solving', 'Technical Analysis', 'Project Management', 'Mathematics']
    };
    
    // Add skills based on career match
    for (const [pattern, profSkills] of Object.entries(professionMap)) {
      if (new RegExp(pattern).test(careerLower)) {
        skills.push(...profSkills);
        break; // Only add one set of profession-specific skills
      }
    }
    
    // Always add 2-3 universal transferable skills if not present
    const skillsLower = skills.map(s => s.toLowerCase());
    const skillsToAdd = universalSkills.filter(us => !skillsLower.includes(us.toLowerCase())).slice(0, 3);
    skills.push(...skillsToAdd);
    
    // Remove duplicates and filter out generic entries
    return [...new Set(skills)].filter(s => s && s !== 'General Skills' && s.length > 2);
  }

  private mapSkillsToInterests(skills: string[], jobTitle: string = ''): string[] {
    const comprehensiveMapping: { [key: string]: string[] } = {
      // Technology & Programming
      'Programming': ['Technology', 'Innovation', 'Problem Solving'],
      'Python': ['Technology', 'Data Science', 'Automation'],
      'JavaScript': ['Technology', 'Web Development', 'Innovation'],
      'Data Analysis': ['Technology', 'Research', 'Analytics'],
      'Machine Learning': ['Technology', 'Innovation', 'Research'],
      'AI': ['Technology', 'Innovation', 'Research'],
      'DevOps': ['Technology', 'Operations', 'Automation'],
      'Cybersecurity': ['Technology', 'Security', 'Problem Solving'],
      
      // Business & Finance
      'Marketing': ['Business', 'Communication', 'Creativity'],
      'Sales': ['Business', 'Communication', 'Persuasion'],
      'Finance': ['Business', 'Mathematics', 'Analytics'],
      'Accounting': ['Business', 'Detail Oriented', 'Mathematics'],
      'Strategy': ['Business', 'Leadership', 'Planning'],
      'Project Management': ['Business', 'Leadership', 'Organization'],
      
      // Healthcare & Medical
      'Healthcare': ['Healthcare', 'Helping Others', 'Science'],
      'Nursing': ['Healthcare', 'Helping Others', 'Patient Care'],
      'Medical': ['Healthcare', 'Science', 'Helping Others'],
      'Surgery': ['Healthcare', 'Precision', 'Science'],
      'Therapy': ['Healthcare', 'Helping Others', 'Psychology'],
      'Pharmacy': ['Healthcare', 'Science', 'Detail Oriented'],
      
      // Education & Training
      'Teaching': ['Education', 'Social Service', 'Communication'],
      'Training': ['Education', 'Leadership', 'Communication'],
      'Research': ['Research', 'Science', 'Analysis'],
      'Writing': ['Communication', 'Creativity', 'Language'],
      
      // Creative & Design
      'Design': ['Arts', 'Creativity', 'Visual'],
      'Graphic Design': ['Arts', 'Creativity', 'Technology'],
      'Photography': ['Arts', 'Creativity', 'Visual'],
      'Video Production': ['Arts', 'Creativity', 'Technology'],
      'Animation': ['Arts', 'Technology', 'Creativity'],
      
      // Engineering & Manufacturing
      'Engineering': ['Technology', 'Problem Solving', 'Mathematics'],
      'Mechanical': ['Engineering', 'Manufacturing', 'Problem Solving'],
      'Civil': ['Engineering', 'Construction', 'Planning'],
      'Electrical': ['Engineering', 'Technology', 'Problem Solving'],
      'Manufacturing': ['Operations', 'Quality Control', 'Engineering'],
      
      // Legal & Government
      'Legal': ['Law', 'Research', 'Communication'],
      'Law': ['Law', 'Research', 'Justice'],
      'Government': ['Public Service', 'Policy', 'Administration'],
      
      // Science & Environment
      'Science': ['Research', 'Discovery', 'Analysis'],
      'Environmental': ['Environment', 'Science', 'Sustainability'],
      'Chemistry': ['Science', 'Research', 'Laboratory'],
      'Biology': ['Science', 'Research', 'Life Sciences'],
      
      // Social & Human Services
      'Social Work': ['Social Service', 'Helping Others', 'Community'],
      'Psychology': ['Psychology', 'Helping Others', 'Research'],
      'Counseling': ['Psychology', 'Helping Others', 'Communication'],
      'Community': ['Social Service', 'Leadership', 'Organization']
    };
    
    const interests = new Set<string>();
    
    // Map skills to interests
    for (const skill of skills) {
      for (const [key, interestList] of Object.entries(comprehensiveMapping)) {
        if (skill.toLowerCase().includes(key.toLowerCase())) {
          interestList.forEach(interest => interests.add(interest));
        }
      }
    }
    
    // Map job title to interests
    const jobTitleLower = jobTitle.toLowerCase();
    for (const [key, interestList] of Object.entries(comprehensiveMapping)) {
      if (jobTitleLower.includes(key.toLowerCase())) {
        interestList.forEach(interest => interests.add(interest));
      }
    }
    
    // Add contextual interests based on job patterns
    if (jobTitleLower.includes('manager') || jobTitleLower.includes('director')) {
      interests.add('Leadership');
      interests.add('Business');
    }
    if (jobTitleLower.includes('analyst') || jobTitleLower.includes('researcher')) {
      interests.add('Research');
      interests.add('Analytics');
    }
    if (jobTitleLower.includes('developer') || jobTitleLower.includes('engineer')) {
      interests.add('Technology');
      interests.add('Problem Solving');
    }
    
    return interests.size > 0 ? Array.from(interests) : ['Professional Development', 'Problem Solving'];
  }

  private generateONETCode(title: string): string {
    const hash = title.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const prefix = Math.floor(hash % 99) + 10;
    const suffix = Math.floor(hash % 9999) + 1000;
    return `${prefix}-${suffix}.00`;
  }
  
  private parseSalary(salaryStr: any): number | null {
    if (!salaryStr) return null;
    
    const salaryString = String(salaryStr).replace(/[\$,]/g, '');
    const salary = parseFloat(salaryString);
    
    return (!isNaN(salary) && salary > 0) ? salary : null;
  }

  private generateJobDescription(title: string, skills: string[]): string {
    return `${title} professionals utilize ${skills.slice(0, 3).join(', ')} to deliver high-quality results in their field. This role requires strong analytical thinking and the ability to work both independently and as part of a team.`;
  }

  private estimateSalary(title: string, skills: string[]): number {
    let baseSalary = 50000;
    
    if (title.toLowerCase().includes('engineer') || skills.some(s => s.toLowerCase().includes('programming'))) {
      baseSalary = 75000;
    } else if (title.toLowerCase().includes('manager') || title.toLowerCase().includes('director')) {
      baseSalary = 85000;
    } else if (title.toLowerCase().includes('analyst') || skills.some(s => s.toLowerCase().includes('data'))) {
      baseSalary = 65000;
    } else if (title.toLowerCase().includes('nurse') || title.toLowerCase().includes('healthcare')) {
      baseSalary = 70000;
    }
    
    return baseSalary + (skills.length * 2000);
  }

  private estimateGrowth(title: string): string {
    if (title.toLowerCase().includes('cyber') || title.toLowerCase().includes('data')) {
      return '15% growth';
    } else if (title.toLowerCase().includes('nurse') || title.toLowerCase().includes('healthcare')) {
      return '12% growth';
    } else if (title.toLowerCase().includes('software') || title.toLowerCase().includes('developer')) {
      return '18% growth';
    }
    return '7% growth';
  }

  private generateWorkActivities(skills: string[]): string[] {
    return skills.slice(0, 5).map(skill => `Working with ${skill}`);
  }

  private mapToRiasec(title: string, skills: string[]): string[] {
    const riasec = [];
    
    if (skills.some(s => s.toLowerCase().includes('programming') || s.toLowerCase().includes('data'))) {
      riasec.push('Investigative');
    }
    if (title.toLowerCase().includes('manager') || skills.some(s => s.toLowerCase().includes('leadership'))) {
      riasec.push('Enterprising');
    }
    if (title.toLowerCase().includes('artist') || title.toLowerCase().includes('design')) {
      riasec.push('Artistic');
    }
    if (title.toLowerCase().includes('nurse') || title.toLowerCase().includes('teacher')) {
      riasec.push('Social');
    }
    if (title.toLowerCase().includes('mechanic') || title.toLowerCase().includes('engineer')) {
      riasec.push('Realistic');
    }
    if (title.toLowerCase().includes('accountant') || title.toLowerCase().includes('clerk')) {
      riasec.push('Conventional');
    }
    
    return riasec.length > 0 ? riasec : ['General'];
  }

  private generateAbilities(skills: string[]): string[] {
    return skills.map(skill => `${skill} proficiency`);
  }

  private generateTools(skills: string[]): string[] {
    return skills.map(skill => `${skill} software/tools`);
  }

  private extractIndustries(record: any): string[] {
    const industry = record['industry'] || record['Industry'] || record['sector'] || record['Sector'];
    if (industry && industry.length > 2) {
      return [industry];
    }
    
    // Infer industry from other fields
    const jobTitle = (record['job_title'] || record['Job Title'] || record['Position'] || '').toLowerCase();
    const skills = (record['skills'] || record['Skills'] || '').toLowerCase();
    
    if (jobTitle.includes('software') || jobTitle.includes('developer') || skills.includes('programming')) {
      return ['Technology', 'Software'];
    } else if (jobTitle.includes('nurse') || jobTitle.includes('medical') || skills.includes('healthcare')) {
      return ['Healthcare', 'Medical'];
    } else if (jobTitle.includes('teacher') || jobTitle.includes('education') || skills.includes('teaching')) {
      return ['Education', 'Academic'];
    } else if (jobTitle.includes('marketing') || jobTitle.includes('sales') || skills.includes('marketing')) {
      return ['Marketing', 'Business'];
    } else if (jobTitle.includes('finance') || jobTitle.includes('accounting') || skills.includes('finance')) {
      return ['Finance', 'Banking'];
    } else if (jobTitle.includes('engineer') && !jobTitle.includes('software')) {
      return ['Engineering', 'Manufacturing'];
    } else if (jobTitle.includes('design') || skills.includes('design')) {
      return ['Design', 'Creative'];
    }
    
    return ['Professional Services', 'General'];
  }
  
  private extractIndustriesFromJob(jobTitle: string, defaultIndustry: string): string[] {
    const jobLower = jobTitle.toLowerCase();
    
    const industryMap: { [key: string]: string[] } = {
      'software': ['Technology', 'Software', 'IT'],
      'developer': ['Technology', 'Software'],
      'programmer': ['Technology', 'Software'], 
      'data': ['Technology', 'Data Science', 'Analytics'],
      'nurse': ['Healthcare', 'Medical', 'Hospitals'],
      'doctor': ['Healthcare', 'Medical'],
      'physician': ['Healthcare', 'Medical'],
      'therapist': ['Healthcare', 'Rehabilitation'],
      'teacher': ['Education', 'Academic'],
      'professor': ['Education', 'Academic', 'Research'],
      'instructor': ['Education', 'Training'],
      'marketing': ['Marketing', 'Advertising', 'Business'],
      'sales': ['Sales', 'Business', 'Retail'],
      'finance': ['Finance', 'Banking', 'Investment'],
      'accountant': ['Finance', 'Accounting'],
      'engineer': ['Engineering', 'Manufacturing', 'Construction'],
      'architect': ['Architecture', 'Construction', 'Design'],
      'designer': ['Design', 'Creative', 'Media'],
      'lawyer': ['Legal', 'Law Firms', 'Government'],
      'consultant': ['Consulting', 'Professional Services'],
      'manager': ['Management', 'Business', 'Operations'],
      'analyst': ['Analytics', 'Consulting', 'Finance'],
      'scientist': ['Research', 'Science', 'Academic'],
      'researcher': ['Research', 'Academic', 'Science']
    };
    
    for (const [key, industries] of Object.entries(industryMap)) {
      if (jobLower.includes(key)) {
        return industries;
      }
    }
    
    return defaultIndustry ? [defaultIndustry, 'Professional Services'] : ['Professional Services'];
  }
  
  private cleanJobTitle(title: string): string {
    return title.trim()
      .replace(/[^\w\s\-\.]/g, '')
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  private buildComprehensiveIndexes() {
    console.log('🔍 Building comprehensive career indexes...');
    
    // Build skill index with filtering to remove O*NET technical identifiers
    for (const career of this.careerDatabase) {
      for (const skill of career.skills) {
        // Filter out noisy O*NET identifiers and invalid skills
        if (!this.isValidInterestOrSkill(skill)) {
          continue; // Skip invalid skills
        }
        
        if (!this.skillIndex[skill]) {
          this.skillIndex[skill] = {
            careers: [],
            salaryRange: { min: 30000, max: 150000, avg: 65000 },
            demandLevel: 'Moderate',
            industries: []
          };
        }
        
        this.skillIndex[skill].careers.push(career.title);
        this.skillIndex[skill].industries.push(...career.industries);
        
        // Update salary range
        if (career.salary < this.skillIndex[skill].salaryRange.min) {
          this.skillIndex[skill].salaryRange.min = career.salary;
        }
        if (career.salary > this.skillIndex[skill].salaryRange.max) {
          this.skillIndex[skill].salaryRange.max = career.salary;
        }
        this.skillIndex[skill].salaryRange.avg = Math.round(
          (this.skillIndex[skill].salaryRange.min + this.skillIndex[skill].salaryRange.max) / 2
        );
      }
      
      // Build interest index with filtering to remove O*NET technical identifiers
      for (const interest of career.interests) {
        // Filter out noisy O*NET identifiers and invalid interests
        if (!this.isValidInterestOrSkill(interest)) {
          continue; // Skip invalid interests
        }
        
        if (!this.interestIndex[interest]) {
          this.interestIndex[interest] = {
            careers: [],
            salaryRange: { min: 30000, max: 150000, avg: 65000 },
            industries: [],
            marketOutlook: 'Stable',
            riasecAlignment: []
          };
        }
        
        this.interestIndex[interest].careers.push(career.title);
        this.interestIndex[interest].industries.push(...career.industries);
      }
      
      // Build industry index  
      for (const industry of career.industries) {
        if (!this.industryIndex[industry]) {
          this.industryIndex[industry] = [];
        }
        this.industryIndex[industry].push(career.title);
      }
    }
    
    // Deduplicate arrays
    this.deduplicateIndexes();
  }

  private deduplicateIndexes() {
    for (const skill of Object.keys(this.skillIndex)) {
      this.skillIndex[skill].careers = [...new Set(this.skillIndex[skill].careers)];
      this.skillIndex[skill].industries = [...new Set(this.skillIndex[skill].industries)];
    }
    
    for (const interest of Object.keys(this.interestIndex)) {
      this.interestIndex[interest].careers = [...new Set(this.interestIndex[interest].careers)];
      this.interestIndex[interest].industries = [...new Set(this.interestIndex[interest].industries)];
    }
    
    for (const industry of Object.keys(this.industryIndex)) {
      this.industryIndex[industry] = [...new Set(this.industryIndex[industry])];
    }
  }

  // Helper to filter out technical O*NET identifiers and keep only real interests/skills
  private isValidInterestOrSkill(name: string): boolean {
    const invalidPatterns = [
      /^\d+\.[A-Z]\.\d+/,
      /element\s+(id|name)/i,
      /^(skills|work|activities|basic|interests|knowledge|abilities|values|tools)\s+(element|id|name)/i,
      /^(or|and|the|a|an)\s/i,
      /,$/,
      /^surroundings$/i,
      /^materials$/i,
      /^actions$/i,
      /^events$/i,
      /^services$/i,
      /^people$/i,
      /^parts$/i,
      /^general\s+skills$/i,
      // Generic O*NET work activities that aren't useful skills
      /(reading|judging|making|updating|working|drafting|laying|interpreting|training|providing|performing|communicating|establishing|assisting|selling|resolving|coordinating|developing|organizing|scheduling|guiding|coaching|thinking|repairing|operating|controlling|inspecting|estimating|documenting)\s+(comprehension|qualities|decisions|knowledge|computers|out|meaning|teaching|consultation|administrative|supervisors|relationships|caring|influencing|conflicts|work|relationships|organizing|directing|motivating|creatively|mechanically|equipment|conditions|quantities|use|information)/i,
      /(getting|identifying|judging|processing|evaluating|monitoring|analyzing)\s+(information|data|objects|processes|qualities)/i,
      /\b(to|from|with|for)\s+(determine|develop|perform)/i,
      /compliance\s+with\s+standards/i,
      /^(communicating|establishing|providing|performing|training|interpreting|organizing|coordinating|developing|scheduling|monitoring|inspecting|documenting)\s+/i,
      /\s+(others|people|supervisors|peers|subordinates|organization|activities|information|relationships)$/i
    ];
    
    if (!name || name.trim().length < 3) return false;
    if (invalidPatterns.some(pattern => pattern.test(name))) return false;
    
    return true;
  }

  // Public methods for querying indexes
  getSkillsIndex() {
    return Object.keys(this.skillIndex)
      .filter(skill => this.isValidInterestOrSkill(skill))
      .map(skill => ({
        name: skill,
        careerCount: this.skillIndex[skill].careers.length,
        averageSalary: this.skillIndex[skill].salaryRange.avg,
        demandLevel: this.skillIndex[skill].demandLevel,
        topCareers: this.skillIndex[skill].careers.slice(0, 5)
      }))
      .filter(skill => skill.careerCount > 0) // Only show skills with associated careers
      .sort((a, b) => b.careerCount - a.careerCount);
  }

  getInterestsIndex() {
    return Object.keys(this.interestIndex)
      .filter(interest => this.isValidInterestOrSkill(interest))
      .map(interest => ({
        name: interest,
        careerCount: this.interestIndex[interest].careers.length,
        averageSalary: this.interestIndex[interest].salaryRange.avg,
        marketOutlook: this.interestIndex[interest].marketOutlook,
        topCareers: this.interestIndex[interest].careers.slice(0, 5)
      }))
      .filter(interest => interest.careerCount > 0) // Only show interests with associated careers
      .sort((a, b) => b.careerCount - a.careerCount);
  }

  findCareersByInterests(interests: string[]): ComprehensiveCareerData[] {
    const matchingCareers = new Set<string>();
    
    for (const interest of interests) {
      if (this.interestIndex[interest]) {
        this.interestIndex[interest].careers.forEach(career => matchingCareers.add(career));
      }
    }
    
    return this.careerDatabase.filter(career => 
      matchingCareers.has(career.title) ||
      career.interests.some(i => interests.includes(i))
    ).slice(0, 20); // Return up to 20 matches
  }

  findCareersBySkills(skills: string[]): ComprehensiveCareerData[] {
    const matchingCareers = new Set<string>();
    
    for (const skill of skills) {
      if (this.skillIndex[skill]) {
        this.skillIndex[skill].careers.forEach(career => matchingCareers.add(career));
      }
    }
    
    return this.careerDatabase.filter(career => 
      matchingCareers.has(career.title) ||
      career.skills.some(s => skills.includes(s))
    ).slice(0, 20);
  }

  getAllCareers(): ComprehensiveCareerData[] {
    return this.careerDatabase;
  }
}

export const comprehensiveDataIndexer = new ComprehensiveDataIndexer();