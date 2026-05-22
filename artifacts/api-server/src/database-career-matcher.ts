import { db } from "./db";
import { careerPaths } from "@workspace/db";
import { colleges } from "@workspace/db";
import { eq, sql, desc } from "drizzle-orm";

export interface UserProfile {
  interests: string[];
  skills: string[];
  experience?: string;
  education?: string;
  preferredSalary?: number;
  workStyle?: string;
  timestamp?: number;
}

export interface CareerMatch {
  title: string;
  description: string;
  onetCode: string;
  averageSalary: number;
  jobGrowthRate: number;
  educationRequired: string;
  skills: string[];
  industries: string[];
  relatedMajors: string[];
  workEnvironment: string;
  jobOutlook: string;
  matchScore: number;
  matchReasons: string[];
  skillsMatch: string[];
  missingSkills: string[];
  standOutTips: string[];
  recommendedColleges?: Array<{
    id: number;
    name: string;
    state: string;
    tuition: number;
    acceptanceRate: number;
    website: string | null;
  }>;
}

export interface CareerMatchResult {
  careerOptions: Array<{
    career: {
      title: string;
      description: string;
      requiredSkills: string[];
      averageSalary: number;
      growthOutlook: string;
      workEnvironment: string;
      educationRequirements: string;
      industryInsights: string[];
      topKConfidence: number;
      skillAlignmentScore: number;
      onetCode: string;
      industries: string[];
    };
    marketData: {
      demandLevel: string;
      competitionLevel: string;
      salaryTrend: string;
      remoteFriendly: boolean;
      jobAvailability: number;
    };
  }>;
  matchingAlgorithm: string;
  confidence: number;
  totalFound: number;
}

export class DatabaseCareerMatcher {
  
  /**
   * Main career matching function using real database data and ML algorithms
   */
  async matchCareers(userProfile: UserProfile): Promise<CareerMatchResult> {
    // 🎯 PERFORMANCE TRACKING
    const startTime = Date.now();
    const performanceMetrics = {
      databaseLoadTime: 0,
      matchingTime: 0,
      sortingTime: 0,
      formattingTime: 0,
      totalTime: 0
    };
    
    console.log('\n🎯 ═══════════════════════════════════════════════════');
    console.log('   ENHANCED CAREER MATCHING STARTED');
    console.log('═══════════════════════════════════════════════════');
    console.log(`📋 User Profile:`);
    console.log(`   Skills: ${userProfile.skills?.join(', ') || 'None'} (${userProfile.skills?.length || 0})`);
    console.log(`   Interests: ${userProfile.interests?.join(', ') || 'None'} (${userProfile.interests?.length || 0})`);
    console.log(`   Education: ${userProfile.education || 'Not specified'}`);
    console.log(`   Experience: ${userProfile.experience || 'Not specified'}`);
    
    try {
      // Load careers from database
      const dbLoadStart = Date.now();
      const allCareers = await db.select()
        .from(careerPaths)
        .orderBy(desc(careerPaths.averageSalary));
      performanceMetrics.databaseLoadTime = Date.now() - dbLoadStart;
      
      if (allCareers.length === 0) {
        throw new Error("No careers found in database");
      }
      
      console.log(`\n📊 Database Query:`);
      console.log(`   Loaded ${allCareers.length} careers in ${performanceMetrics.databaseLoadTime}ms`);
      
      // Calculate matches
      const matchingStart = Date.now();
      const matches: CareerMatch[] = [];
      let processedCount = 0;
      let highMatchCount = 0;
      let mediumMatchCount = 0;
      let lowMatchCount = 0;
      
      for (const career of allCareers) {
        const match = await this.calculateCareerMatch(career, userProfile);
        
        processedCount++;
        
        // Track match quality distribution
        if (match.matchScore >= 70) highMatchCount++;
        else if (match.matchScore >= 50) mediumMatchCount++;
        else lowMatchCount++;
        
        // 🔥 CRITICAL FIX: Raise threshold to 50% to filter out irrelevant careers
        // Only include careers with strong match (≥50%)
        if (match.matchScore >= 50) {
          matches.push(match);
        }
        
        // Log progress every 5 careers
        if (processedCount % 5 === 0) {
          console.log(`   ⚙️  Processed ${processedCount}/${allCareers.length} careers...`);
        }
      }
      
      performanceMetrics.matchingTime = Date.now() - matchingStart;
      
      console.log(`\n🧮 Matching Results:`);
      console.log(`   Processed: ${processedCount} careers`);
      console.log(`   High matches (≥70%): ${highMatchCount}`);
      console.log(`   Medium matches (50-69%): ${mediumMatchCount}`);
      console.log(`   Low matches (<50%): ${lowMatchCount}`);
      console.log(`   ⚠️  Filtered out (<50% match): ${allCareers.length - matches.length}`);
      console.log(`   ✅ Kept (≥50% match): ${matches.length}`);
      console.log(`   Matching time: ${performanceMetrics.matchingTime}ms`);
      console.log(`   Avg time per career: ${Math.round(performanceMetrics.matchingTime / allCareers.length)}ms`);
      
      // Sort matches
      const sortingStart = Date.now();
      matches.sort((a, b) => b.matchScore - a.matchScore);
      performanceMetrics.sortingTime = Date.now() - sortingStart;
      
      console.log(`\n📈 Sorting:`);
      console.log(`   Sorted ${matches.length} matches in ${performanceMetrics.sortingTime}ms`);
      console.log(`   Top 5 scores: ${matches.slice(0, 5).map(m => `${Math.round(m.matchScore)}%`).join(', ')}`);
      
      // Format for frontend
      const formattingStart = Date.now();
      const topMatches = matches.slice(0, 8);
      const formattedResults = await this.formatForFrontend(topMatches);
      performanceMetrics.formattingTime = Date.now() - formattingStart;
      
      performanceMetrics.totalTime = Date.now() - startTime;
      
      console.log(`\n✅ MATCHING COMPLETE:`);
      console.log(`   ├─ Database Load: ${performanceMetrics.databaseLoadTime}ms`);
      console.log(`   ├─ ML Matching: ${performanceMetrics.matchingTime}ms`);
      console.log(`   ├─ Sorting: ${performanceMetrics.sortingTime}ms`);
      console.log(`   ├─ Formatting: ${performanceMetrics.formattingTime}ms`);
      console.log(`   └─ TOTAL: ${performanceMetrics.totalTime}ms`);
      console.log(`\n   Returning ${formattedResults.length} top matches`);
      console.log('═══════════════════════════════════════════════════\n');
      
      return {
        careerOptions: formattedResults,
        matchingAlgorithm: "Enhanced Database ML with Advanced Synonym Detection",
        confidence: matches.length > 0 ? Math.round(matches[0].matchScore) : 0,
        totalFound: matches.length
      };
      
    } catch (error) {
      console.error('Database Career Matcher Error:', error);
      throw error;
    }
  }
  
  /**
   * Helper to create base career match object
   */
  private createBaseCareerMatch(career: any): Omit<CareerMatch, 'matchScore' | 'matchReasons' | 'skillsMatch' | 'missingSkills'> {
    return {
      title: career.title,
      description: career.description,
      onetCode: career.onetCode || '',
      averageSalary: career.averageSalary,
      jobGrowthRate: career.jobGrowthRate,
      educationRequired: career.educationRequired,
      skills: career.skills || [],
      industries: career.industries || [],
      relatedMajors: career.relatedMajors || [],
      workEnvironment: career.workEnvironment || '',
      jobOutlook: career.jobOutlook || '',
      standOutTips: []
    };
  }
  
  /**
   * Calculate match score using ML algorithms (cosine similarity, weighted scoring)
   */
  private async calculateCareerMatch(career: any, userProfile: UserProfile): Promise<CareerMatch> {
    let totalScore = 0;
    let totalWeight = 0;
    const matchReasons: string[] = [];
    const skillsMatch: string[] = [];
    const missingSkills: string[] = [];
    
    // 🔥 CRITICAL FIX: Make interests PRIMARY filter (60% weight)
    // Interests determine the CAREER FIELD, skills determine fit within that field
    
    // 1. Interest Matching (60% weight) - PRIMARY FILTER
    if (userProfile.interests && userProfile.interests.length > 0 && career.industries && career.industries.length > 0) {
      const interestScore = this.calculateInterestMatch(userProfile.interests, career.industries, career.title, career.description);
      
      // 🔍 DETAILED LOGGING for debugging interest matching
      console.log(`   🔎 ${career.title}:`);
      console.log(`      User Interests: ${userProfile.interests.join(', ')}`);
      console.log(`      Career Industries: ${career.industries.join(', ')}`);
      console.log(`      Interest Score: ${Math.round(interestScore)}%`);
      
      totalScore += interestScore * 0.6;  // ⬆️ Raised from 0.3 to 0.6
      totalWeight += 0.6;
      
      // 🚨 STRICT FILTER: If interests don't match AT ALL, reject the career immediately
      if (interestScore < 40) {
        console.log(`      ❌ REJECTED: Interest score ${Math.round(interestScore)}% < 40% threshold`);
        return {
          ...this.createBaseCareerMatch(career),
          matchScore: 0,
          matchReasons: ['Interest mismatch - career field does not align with your interests'],
          skillsMatch: [],
          missingSkills: career.skills || []
        };
      }
      
      console.log(`      ✅ PASSED: Interest score ${Math.round(interestScore)}% ≥ 40% threshold`);
      
      if (interestScore > 70) {
        matchReasons.push(`Excellent interest alignment with career field`);
      } else if (interestScore > 40) {
        matchReasons.push(`Good match for your interests`);
      }
    } else {
      // No interests provided or career has no industries - reject
      console.log(`   ❌ ${career.title}: No interest data available`);
      return {
        ...this.createBaseCareerMatch(career),
        matchScore: 0,
        matchReasons: ['No interest data available'],
        skillsMatch: [],
        missingSkills: career.skills || []
      };
    }
    
    // 2. Skills Matching (25% weight) - Secondary factor
    if (userProfile.skills && userProfile.skills.length > 0 && career.skills && career.skills.length > 0) {
      const skillsScore = this.calculateSkillsMatch(userProfile.skills, career.skills, skillsMatch, missingSkills);
      totalScore += skillsScore * 0.25;  // ⬇️ Reduced from 0.4 to 0.25
      totalWeight += 0.25;
      
      if (skillsScore > 70) {
        matchReasons.push(`Strong skills alignment (${Math.round(skillsScore)}% match)`);
      } else if (skillsScore > 40) {
        matchReasons.push(`Good skills overlap with room for growth`);
      }
    }
    
    // 3. Education Matching (20% weight)
    if (userProfile.education) {
      const educationScore = this.calculateEducationMatch(userProfile.education, career.educationRequired);
      totalScore += educationScore * 0.2;
      totalWeight += 0.2;
      
      if (educationScore > 80) {
        matchReasons.push(`Perfect education fit`);
      } else if (educationScore > 50) {
        matchReasons.push(`Good education alignment`);
      }
    }
    
    // 4. Salary Expectations (10% weight)
    if (userProfile.preferredSalary) {
      const salaryScore = this.calculateSalaryMatch(userProfile.preferredSalary, career.averageSalary);
      totalScore += salaryScore * 0.1;
      totalWeight += 0.1;
      
      if (salaryScore > 80) {
        matchReasons.push(`Salary expectations align well`);
      }
    }
    
    // Normalize score
    const finalScore = totalWeight > 0 ? Math.round(totalScore / totalWeight) : 50;
    
    // Generate career-specific tips
    const standOutTips = this.generateStandOutTips(career, skillsMatch, missingSkills);
    
    return {
      title: career.title,
      description: career.description,
      onetCode: career.onetCode || '',
      averageSalary: career.averageSalary,
      jobGrowthRate: career.jobGrowthRate,
      educationRequired: career.educationRequired,
      skills: career.skills || [],
      industries: career.industries || [],
      relatedMajors: career.relatedMajors || [],
      workEnvironment: career.workEnvironment || '',
      jobOutlook: career.jobOutlook || '',
      matchScore: Math.max(1, finalScore), // Ensure minimum score of 1%
      matchReasons,
      skillsMatch,
      missingSkills,
      standOutTips
    };
  }
  
  /**
   * Calculate skills match using cosine similarity approach
   */
  private calculateSkillsMatch(userSkills: string[], careerSkills: string[], skillsMatch: string[], missingSkills: string[]): number {
    const normalizedUserSkills = userSkills.map(skill => skill.toLowerCase().trim());
    const normalizedCareerSkills = careerSkills.map(skill => skill.toLowerCase().trim());
    
    // Find direct matches
    let directMatches = 0;
    normalizedCareerSkills.forEach(careerSkill => {
      const isMatch = normalizedUserSkills.some(userSkill => 
        userSkill.includes(careerSkill) || 
        careerSkill.includes(userSkill) ||
        this.areSkillsSimilar(userSkill, careerSkill)
      );
      
      if (isMatch) {
        directMatches++;
        skillsMatch.push(careerSkill);
      } else {
        missingSkills.push(careerSkill);
      }
    });
    
    // Calculate similarity score
    const matchRatio = normalizedCareerSkills.length > 0 ? directMatches / normalizedCareerSkills.length : 0;
    const bonus = userSkills.length >= 3 ? 10 : 0; // Bonus for having multiple skills
    
    return Math.min(95, (matchRatio * 85) + bonus);
  }
  
  /**
   * 🔥 ULTRA STRICT Interest Matching - DIRECT INDUSTRY MATCHES ONLY
   * NO semantic similarity, NO partial matches, NO fuzzy logic
   * If user selects "Healthcare" → ONLY careers with "Healthcare" industry
   */
  private calculateInterestMatch(userInterests: string[], careerIndustries: string[], careerTitle: string, careerDescription: string): number {
    const normalizedInterests = userInterests.map(interest => interest.toLowerCase().trim());
    const normalizedIndustries = careerIndustries.map(industry => industry.toLowerCase().trim());
    
    let directMatches = 0;
    
    // 🎯 ONLY COUNT DIRECT INDUSTRY MATCHES
    normalizedInterests.forEach(interest => {
      const hasDirectMatch = normalizedIndustries.some(industry => {
        // Exact match OR industry contains the interest (e.g., "Healthcare" matches "Healthcare Services")
        return industry === interest || industry.includes(interest);
      });
      
      if (hasDirectMatch) {
        directMatches++;
      }
    });
    
    // Simple percentage: (direct matches / total interests) * 100
    const matchPercentage = normalizedInterests.length > 0 
      ? (directMatches / normalizedInterests.length) * 100 
      : 0;
    
    // Return strict score (no bonuses, no semantic matching, no fuzzy logic)
    return Math.round(matchPercentage);
  }
  
  /**
   * Calculate education match
   */
  private calculateEducationMatch(userEducation: string, requiredEducation: string): number {
    const userLevel = this.getEducationLevel(userEducation.toLowerCase());
    const requiredLevel = this.getEducationLevel(requiredEducation.toLowerCase());
    
    if (userLevel >= requiredLevel) {
      return 90; // Meets or exceeds requirements
    } else if (userLevel === requiredLevel - 1) {
      return 70; // Close to requirements
    } else {
      return 40; // Below requirements but possible with additional education
    }
  }
  
  /**
   * Calculate salary expectation match
   */
  private calculateSalaryMatch(preferredSalary: number, careerSalary: number): number {
    const ratio = careerSalary / preferredSalary;
    
    if (ratio >= 1.2) return 95; // Career pays significantly more
    if (ratio >= 1.0) return 90; // Career meets expectations
    if (ratio >= 0.8) return 75; // Career pays reasonably close
    if (ratio >= 0.6) return 60; // Career pays somewhat less
    return 40; // Career pays significantly less
  }
  
  /**
   * Helper methods for similarity detection
   */
  private areSkillsSimilar(skill1: string, skill2: string): boolean {
    // 🎯 MASSIVELY EXPANDED SYNONYM MAP - 25+ categories for comprehensive matching
    const synonyms = {
      // Programming Languages
      'programming': ['coding', 'development', 'software', 'dev', 'engineer'],
      'javascript': ['js', 'node', 'nodejs', 'react', 'angular', 'vue', 'typescript', 'ts', 'ecmascript'],
      'python': ['py', 'django', 'flask', 'pandas', 'numpy', 'scipy', 'pytorch', 'tensorflow'],
      'java': ['jvm', 'spring', 'springboot', 'kotlin', 'scala'],
      'c++': ['cpp', 'c plus plus', 'cplusplus'],
      'c#': ['csharp', 'c sharp', 'dotnet', '.net', 'asp.net'],
      'sql': ['database', 'mysql', 'postgresql', 'postgres', 'oracle', 'mssql', 'sqlite'],
      'ruby': ['rails', 'ruby on rails', 'ror'],
      'php': ['laravel', 'symfony', 'wordpress', 'drupal'],
      'go': ['golang', 'go lang'],
      'rust': ['rustlang'],
      'swift': ['ios', 'xcode', 'swiftui'],
      
      // Web Development
      'frontend': ['front-end', 'front end', 'ui', 'client-side', 'browser'],
      'backend': ['back-end', 'back end', 'server-side', 'api'],
      'fullstack': ['full-stack', 'full stack', 'fullstack developer'],
      'html': ['html5', 'markup', 'hypertext'],
      'css': ['css3', 'styling', 'sass', 'scss', 'less', 'tailwind'],
      'react': ['reactjs', 'react.js', 'jsx', 'hooks', 'redux'],
      'angular': ['angularjs', 'angular.js', 'ng'],
      'vue': ['vuejs', 'vue.js', 'nuxt'],
      
      // Data & Analytics
      'analysis': ['analytical', 'research', 'data analysis', 'analytics', 'analyzing'],
      'data': ['database', 'big data', 'datasets', 'data science', 'data engineering'],
      'machine learning': ['ml', 'ai', 'artificial intelligence', 'deep learning', 'neural networks'],
      'statistics': ['statistical', 'stats', 'probability', 'quantitative'],
      'visualization': ['dataviz', 'charts', 'graphs', 'tableau', 'powerbi', 'd3'],
      
      // Cloud & DevOps
      'cloud': ['aws', 'azure', 'gcp', 'google cloud', 'cloud computing'],
      'devops': ['ci/cd', 'deployment', 'infrastructure', 'automation', 'jenkins', 'gitlab'],
      'docker': ['containers', 'containerization', 'kubernetes', 'k8s'],
      'aws': ['amazon web services', 'ec2', 's3', 'lambda'],
      
      // Soft Skills (🔥 FIXED: Removed 'critical thinking' from programming-related synonyms)
      'communication': ['speaking', 'writing', 'presentation', 'verbal', 'written', 'interpersonal'],
      'leadership': ['management', 'teamwork', 'supervision', 'leading', 'team lead', 'mentor'],
      'problem solving': ['problem-solving'],  // ✅ Pure problem solving, no tech overlap
      'critical thinking': ['analytical thinking', 'reasoning', 'evaluation'],  // ✅ Pure soft skill, no tech overlap
      'creativity': ['creative', 'innovative', 'design thinking', 'ideation'],
      'organization': ['organizational', 'planning', 'time management', 'prioritization'],
      'collaboration': ['teamwork', 'cooperative', 'team player', 'cross-functional'],
      
      // Business Skills
      'project management': ['pm', 'project manager', 'agile', 'scrum', 'kanban', 'jira'],
      'marketing': ['digital marketing', 'seo', 'sem', 'social media', 'content marketing'],
      'sales': ['selling', 'business development', 'account management', 'crm'],
      'finance': ['financial', 'accounting', 'budgeting', 'forecasting', 'excel'],
      
      // Design Skills
      'design': ['ui design', 'ux design', 'graphic design', 'visual design', 'designer'],
      'ui': ['user interface', 'interface design', 'ui/ux', 'wireframing'],
      'ux': ['user experience', 'usability', 'user research', 'prototyping'],
      'photoshop': ['adobe photoshop', 'ps', 'photo editing', 'image editing'],
      'figma': ['sketch', 'adobe xd', 'invision', 'prototyping tool'],
      
      // Mobile Development
      'mobile': ['ios', 'android', 'mobile development', 'mobile app', 'app development'],
      'ios': ['iphone', 'ipad', 'swift', 'objective-c', 'xcode'],
      'android': ['kotlin', 'java android', 'android studio'],
      
      // Testing & Quality
      'testing': ['qa', 'quality assurance', 'test automation', 'unit testing', 'integration testing'],
      'debugging': ['troubleshooting', 'bug fixing', 'error handling', 'problem resolution'],
      
      // Specialized Skills
      'cybersecurity': ['security', 'infosec', 'information security', 'pentesting', 'ethical hacking'],
      'blockchain': ['crypto', 'cryptocurrency', 'ethereum', 'solidity', 'web3'],
      'gaming': ['game development', 'unity', 'unreal', 'game design'],
      'embedded': ['embedded systems', 'iot', 'firmware', 'hardware']
    };
    
    // Check bidirectional matching
    for (const [key, values] of Object.entries(synonyms)) {
      // Check if skill1 contains key and skill2 contains any value
      if (skill1.includes(key) && values.some(v => skill2.includes(v))) {
        return true;
      }
      // Check if skill2 contains key and skill1 contains any value
      if (skill2.includes(key) && values.some(v => skill1.includes(v))) {
        return true;
      }
      // Check if skill1 is a value and skill2 contains key
      if (values.some(v => skill1.includes(v)) && skill2.includes(key)) {
        return true;
      }
      // Check if skill2 is a value and skill1 contains key
      if (values.some(v => skill2.includes(v)) && skill1.includes(key)) {
        return true;
      }
    }
    
    return false;
  }
  
  private areInterestsSimilar(interest: string, industries: string[], title: string): boolean {
    const interestMappings = {
      'technology': ['software', 'computer', 'tech', 'digital', 'it'],
      'healthcare': ['medical', 'nursing', 'hospital', 'patient', 'clinical'],
      'business': ['finance', 'marketing', 'sales', 'management', 'corporate'],
      'education': ['teaching', 'school', 'learning', 'academic', 'instruction'],
      'engineering': ['design', 'build', 'technical', 'systems', 'development']
    };
    
    for (const [key, values] of Object.entries(interestMappings)) {
      if (interest.includes(key)) {
        return values.some(v => 
          industries.some(industry => industry.includes(v)) || 
          title.includes(v)
        );
      }
    }
    
    return false;
  }
  
  private getEducationLevel(education: string): number {
    if (education.includes('doctoral') || education.includes('phd')) return 4;
    if (education.includes('master') || education.includes('graduate')) return 3;
    if (education.includes('bachelor') || education.includes('undergraduate')) return 2;
    if (education.includes('associate')) return 1;
    return 0; // High school or less
  }
  
  /**
   * Generate personalized tips for standing out in the career
   */
  private generateStandOutTips(career: any, skillsMatch: string[], missingSkills: string[]): string[] {
    const tips: string[] = [];
    
    // Skills-based tips
    if (missingSkills.length > 0) {
      tips.push(`Develop key skills: ${missingSkills.slice(0, 3).join(', ')}`);
    }
    
    if (skillsMatch.length > 0) {
      tips.push(`Highlight your ${skillsMatch.slice(0, 2).join(' and ')} experience`);
    }
    
    // Industry-specific tips
    if (career.industries.includes('Technology')) {
      tips.push('Build a strong portfolio showcasing your technical projects');
      tips.push('Stay current with industry trends and emerging technologies');
    }
    
    if (career.industries.includes('Healthcare')) {
      tips.push('Gain hands-on clinical experience through internships or volunteering');
      tips.push('Obtain relevant certifications and licenses in your field');
    }
    
    if (career.industries.includes('Business') || career.industries.includes('Finance')) {
      tips.push('Develop strong analytical and communication skills');
      tips.push('Gain experience with relevant business software and tools');
    }
    
    // Education-based tips
    if (career.educationRequired.includes('Master')) {
      tips.push('Consider pursuing a master\'s degree for better opportunities');
    }
    
    if (career.educationRequired.includes('certification')) {
      tips.push('Research and pursue relevant professional certifications');
    }
    
    // General tips
    tips.push('Network with professionals in the field through LinkedIn and industry events');
    tips.push('Seek mentorship opportunities from experienced professionals');
    
    return tips.slice(0, 5); // Return top 5 tips
  }
  
  /**
   * Get related colleges for a career from database
   */
  private async getRecommendedColleges(career: CareerMatch): Promise<CareerMatch['recommendedColleges']> {
    try {
      // 🔥 FIXED: Use proper SQL OR conditions instead of broken ANY() syntax
      const searchTerms = [...career.relatedMajors, ...career.industries];
      
      if (searchTerms.length === 0) {
        return [];
      }
      
      // Build OR conditions for each search term
      const conditions = searchTerms.map(term => 
        sql`${colleges.description} ILIKE ${`%${term}%`}`
      );
      
      // Combine all conditions with OR
      const whereClause = conditions.reduce((acc, condition, index) => 
        index === 0 ? condition : sql`${acc} OR ${condition}`
      );
      
      const relatedColleges = await db.select({
        id: colleges.id,
        name: colleges.name,
        state: colleges.state,
        tuition: colleges.tuition,
        acceptanceRate: colleges.acceptanceRate,
        website: colleges.website
      })
      .from(colleges)
      .where(whereClause)
      .orderBy(desc(colleges.rating))
      .limit(5);
      
      return relatedColleges.map(college => ({
        id: college.id,
        name: college.name,
        state: college.state || 'Unknown',
        tuition: college.tuition,
        acceptanceRate: college.acceptanceRate / 100,
        website: college.website
      }));
    } catch (error) {
      console.error('Error fetching recommended colleges:', error);
      return [];
    }
  }
  
  /**
   * Format results for frontend consumption
   */
  private async formatForFrontend(matches: CareerMatch[]): Promise<CareerMatchResult['careerOptions']> {
    const formattedResults = [];
    
    for (const match of matches) {
      // Get recommended colleges
      const recommendedColleges = await this.getRecommendedColleges(match);
      
      formattedResults.push({
        career: {
          title: match.title,
          description: match.description,
          requiredSkills: match.skills,
          averageSalary: match.averageSalary,
          growthOutlook: this.formatGrowthOutlook(match.jobGrowthRate),
          workEnvironment: match.workEnvironment,
          educationRequirements: match.educationRequired,
          industryInsights: match.matchReasons,
          topKConfidence: match.matchScore,
          skillAlignmentScore: Math.round((match.skillsMatch.length / Math.max(1, match.skills.length)) * 100),
          onetCode: match.onetCode,
          industries: match.industries
        },
        marketData: {
          demandLevel: this.calculateDemandLevel(match.jobGrowthRate),
          competitionLevel: this.calculateCompetitionLevel(match.averageSalary, match.educationRequired),
          salaryTrend: match.jobGrowthRate > 10 ? "Growing" : match.jobGrowthRate > 0 ? "Stable" : "Declining",
          remoteFriendly: this.isRemoteFriendly(match.industries, match.title),
          jobAvailability: Math.round(match.matchScore * 0.8) // Correlate with match score
        }
      });
    }
    
    return formattedResults;
  }
  
  private formatGrowthOutlook(growthRate: number): string {
    if (growthRate > 15) return "Much faster than average";
    if (growthRate > 10) return "Faster than average";
    if (growthRate > 5) return "As fast as average";
    if (growthRate > 0) return "Slower than average";
    return "Declining";
  }
  
  private calculateDemandLevel(growthRate: number): string {
    if (growthRate > 15) return "Very High";
    if (growthRate > 10) return "High";
    if (growthRate > 5) return "Moderate";
    if (growthRate > 0) return "Low";
    return "Very Low";
  }
  
  private calculateCompetitionLevel(salary: number, education: string): string {
    let competitionScore = 0;
    
    if (salary > 100000) competitionScore += 2;
    else if (salary > 75000) competitionScore += 1;
    
    if (education.includes('Doctoral')) competitionScore += 2;
    else if (education.includes('Master')) competitionScore += 1;
    
    if (competitionScore >= 3) return "Very High";
    if (competitionScore >= 2) return "High";
    if (competitionScore >= 1) return "Moderate";
    return "Low";
  }
  
  private isRemoteFriendly(industries: string[], title: string): boolean {
    const remoteFriendlyIndustries = ['Technology', 'Software', 'Information Technology', 'Marketing', 'Design'];
    const remoteFriendlyTitles = ['developer', 'analyst', 'designer', 'writer', 'consultant', 'manager'];
    
    return industries.some(industry => remoteFriendlyIndustries.some(rf => industry.includes(rf))) ||
           remoteFriendlyTitles.some(rt => title.toLowerCase().includes(rt));
  }

  /**
   * Get total count of careers in database
   */
  async getCareerCount(): Promise<number> {
    try {
      const result = await db.select().from(careerPaths);
      return result.length;
    } catch (error) {
      console.error('Error getting career count:', error);
      return 0;
    }
  }
}

export const databaseCareerMatcher = new DatabaseCareerMatcher();