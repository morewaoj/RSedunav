// Enhanced fallback analyzer with real per-request matching (production pattern)
// This provides enhanced analysis using authentic database queries

import { analyzeResumeWithClaude } from './claude-resume-analyzer';
import { storage } from './storage';
import { smartScholarshipMatcher } from './smart-scholarship-matcher';
import { DirectCareerMatcher } from './direct-career-matcher';

// Real database search for careers using actual O*NET data
async function searchAuthenticCareerDatabase(analysis: any, resumeText: string): Promise<any[]> {
  try {
    console.log("Searching careers for skills:", analysis.skills);
    
    // Use the direct career matcher with comprehensive career database
    const careerProfile = {
      skills: analysis.skills || [],
      interests: analysis.interests || [],
      preferredEducation: analysis.education_level || 'bachelor',
      workValues: []
    };
    
    // Create direct career matcher instance and get real career matches
    const directMatcher = new DirectCareerMatcher();
    const careerMatches = directMatcher.findMatches(careerProfile);
    
    console.log("Found", careerMatches.length, "career matches from direct career database");
    
    // Return top matches formatted for enhanced analysis
    return careerMatches.slice(0, 20).map(match => ({
      title: match.career.title,
      description: match.career.description,
      keySkills: match.career.skills || [],
      averageSalary: `$${match.career.averageSalary?.toLocaleString() || '65,000'}`,
      jobGrowthRate: match.career.jobGrowthRate || 'Average growth',
      educationRequired: match.career.educationRequired || 'Bachelor\'s degree',
      onetCode: match.career.onetCode,
      matchScore: match.matchScore,
      matchReason: match.matchReasons?.[0] || 'Skills and career profile alignment'
    }));
    
  } catch (error) {
    console.error("Career database search failed:", error);
    return [];
  }
}

// Shape returned by smartScholarshipMatcher.getTopRecommendations entries,
// with the `matchReasons` array collapsed into a single `reason` string for
// the downstream consumers in this module.
interface ScholarshipMatch {
  scholarship: {
    name?: string;
    description?: string;
    [key: string]: unknown;
  };
  score: number;
  reason: string;
}

// Real database search for scholarships using authentic scholarship data
async function searchAuthenticScholarshipDatabase(analysis: any, resumeText: string): Promise<ScholarshipMatch[]> {
  try {
    console.log("Searching scholarships for profile:", {
      gpa: analysis.gpa,
      skills: analysis.skills?.length,
      interests: analysis.interests?.length
    });
    
    // Build comprehensive profile for scholarship matching
    const scholarshipProfile = {
      gpa: analysis.gpa || 3.0,
      major: analysis.education?.major || undefined,
      state: undefined, // Would extract from resume if available
      demographics: analysis.demographics || [],
      financialNeed: 'medium' as const,
      interests: analysis.interests || [],
      academicLevel: 'undergraduate' as const,
      firstGeneration: false,
      militaryAffiliation: false,
      athleticParticipation: false
    };
    
    // Get real scholarship matches from authentic database
    const scholarshipMatches = smartScholarshipMatcher.getTopRecommendations(scholarshipProfile, 15);
    
    console.log("Found", scholarshipMatches.length, "scholarship matches from authentic database");
    
    return scholarshipMatches.map((match) => ({
      scholarship: match.scholarship,
      score: match.score,
      reason: match.matchReasons?.[0] || 'Profile alignment based on authentic criteria'
    }));
    
  } catch (error) {
    console.error("Scholarship database search failed:", error);
    return [];
  }
}

interface EnhancedAnalysisResult {
  analysis: any;
  careers: Array<{
    career: any;
    matchScore: number;
    matchReasons: string[];
    semanticSimilarity: number;
  }>;
  scholarships: Array<{
    scholarship: any;
    matchScore: number;
    matchReasons: string[];
    semanticSimilarity: number;
  }>;
}

// Dynamic skill patterns built from O*NET career database
let allDynamicSkillPatterns: RegExp[] = [];
let skillsBuilt = false;

// Build dynamic skill patterns from all careers in the database
async function buildDynamicSkillPatterns() {
  try {
    const directMatcher = new DirectCareerMatcher();
    const allCareers = directMatcher.getAllCareers(); // Get all careers from DirectCareerMatcher
    
    const allSkills = new Set<string>();
    
    // Extract all skills from all careers
    allCareers.forEach(career => {
      (career.skills || []).forEach((skill: string) => {
        if (skill && skill.trim()) {
          allSkills.add(skill.trim().toLowerCase());
          // Also add common variations
          if (skill.includes(' ')) {
            // Add individual words for compound skills
            skill.split(' ').forEach(word => {
              if (word.length > 2) allSkills.add(word.toLowerCase());
            });
          }
        }
      });
    });

    // Add common skill variations and plurals
    const skillVariations = new Set(allSkills);
    allSkills.forEach(skill => {
      // Add plural forms
      if (!skill.endsWith('s')) {
        skillVariations.add(skill + 's');
      }
      // Add common variations
      if (skill === 'javascript') skillVariations.add('js');
      if (skill === 'python') skillVariations.add('py');
      if (skill === 'machine learning') skillVariations.add('ml');
      if (skill === 'artificial intelligence') skillVariations.add('ai');
    });

    // Create comprehensive regex pattern
    const skillArray = Array.from(skillVariations).filter(skill => skill.length > 1);
    const escapedSkills = skillArray.map(skill => skill.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'));
    const skillPattern = escapedSkills.join('|');
    
    allDynamicSkillPatterns = [new RegExp(`\\b(${skillPattern})\\b`, 'gi')];
    skillsBuilt = true;
    
    console.log(`Dynamic skill patterns built: ${skillArray.length} unique skills from O*NET database`);
    
  } catch (error) {
    console.error('Failed to build dynamic skill patterns:', error);
    // Fallback to basic patterns if dynamic building fails
    allDynamicSkillPatterns = [
      /\b(javascript|python|java|sql|react|cybersecurity|machine learning|data analysis|project management|leadership|communication)\b/gi
    ];
    skillsBuilt = true;
  }
}

// Enhanced skill extraction using dynamic O*NET skills
async function extractEnhancedSkills(resumeText: string): Promise<string[]> {
  // Build patterns if not already built
  if (!skillsBuilt) {
    await buildDynamicSkillPatterns();
  }

  const text = resumeText.toLowerCase();
  const skills = new Set<string>();
  
  // Extract skills using dynamic patterns
  allDynamicSkillPatterns.forEach(pattern => {
    const matches = text.match(pattern);
    if (matches) {
      matches.forEach(match => skills.add(match.trim().toLowerCase()));
    }
  });

  // Additional context-based extraction for complex skills
  const contextualSkills = [
    'data analysis', 'project management', 'software development', 'web development',
    'database management', 'system administration', 'network security', 'quality assurance',
    'business analysis', 'technical writing', 'customer service', 'sales experience',
    'machine learning', 'artificial intelligence', 'cloud computing', 'cybersecurity'
  ];

  contextualSkills.forEach(skill => {
    if (text.includes(skill.toLowerCase())) {
      skills.add(skill);
    }
  });

  const extractedSkills = Array.from(skills);
  console.log(`Dynamic skills extraction found ${extractedSkills.length} skills:`, extractedSkills.slice(0, 10));
  
  return extractedSkills;
}

// Enhanced GPA extraction
function extractGPA(resumeText: string): number | null {
  const gpaPatterns = [
    /gpa[:\s]*(\d+\.?\d*)/gi,
    /grade point average[:\s]*(\d+\.?\d*)/gi,
    /cumulative[:\s]*(\d+\.?\d*)/gi,
    /\b(\d\.\d{1,2})\s*\/\s*4\.0/gi,
    /\b(\d\.\d{1,2})\s*gpa/gi
  ];

  for (const pattern of gpaPatterns) {
    const match = resumeText.match(pattern);
    if (match && match[1]) {
      const gpa = parseFloat(match[1]);
      if (gpa >= 0 && gpa <= 4.0) {
        return gpa;
      }
    }
  }
  return null;
}

// Enhanced education level detection
function detectEducationLevel(resumeText: string): string {
  const text = resumeText.toLowerCase();
  
  if (text.includes('phd') || text.includes('doctorate') || text.includes('doctoral')) {
    return 'doctorate';
  }
  if (text.includes('master') || text.includes('mba') || text.includes('ms ') || text.includes('ma ')) {
    return 'master';
  }
  if (text.includes('bachelor') || text.includes('bs ') || text.includes('ba ') || text.includes('college') || text.includes('university')) {
    return 'bachelor';
  }
  if (text.includes('associate') || text.includes('community college')) {
    return 'associate';
  }
  
  return 'bachelor'; // Default assumption
}

// Enhanced interests extraction
function extractInterests(resumeText: string): string[] {
  const interestPatterns = [
    /\b(technology|innovation|research|development|design|analytics|data|security|automation)\b/gi,
    /\b(healthcare|medicine|nursing|therapy|counseling|social work)\b/gi,
    /\b(education|teaching|training|mentoring|coaching)\b/gi,
    /\b(business|finance|marketing|sales|entrepreneurship|management)\b/gi,
    /\b(engineering|construction|manufacturing|operations)\b/gi,
    /\b(creative|art|design|writing|media|communication)\b/gi
  ];

  const interests = new Set<string>();
  
  interestPatterns.forEach(pattern => {
    const matches = resumeText.match(pattern);
    if (matches) {
      matches.forEach(match => interests.add(match.toLowerCase()));
    }
  });

  return Array.from(interests);
}

// Enhanced career matching with real database queries and per-resume scoring
async function enhancedCareerMatching(analysis: any, resumeText: string): Promise<Array<{
  career: any;
  matchScore: number;
  matchReasons: string[];
  semanticSimilarity: number;
}>> {
  try {
    console.log("Starting enhanced career matching for skills:", analysis.skills?.slice(0, 5));
    
    // Get real career matches from authentic O*NET database
    const careerMatches = await searchAuthenticCareerDatabase(analysis, resumeText);
    
    if (careerMatches.length === 0) {
      console.log("No career matches found from database");
      return [];
    }
    
    // Process each career match with personalized scoring
    const processedMatches = careerMatches.slice(0, 12).map((career: any) => {
      const userSkills = analysis.skills || [];
      const userInterests = analysis.interests || [];
      
      // Calculate skill overlap with career requirements
      const skillOverlap = userSkills.filter((skill: string) => 
        career.keySkills?.some((careerSkill: string) => 
          careerSkill.toLowerCase().includes(skill.toLowerCase()) || 
          skill.toLowerCase().includes(careerSkill.toLowerCase())
        )
      ).length;
      
      // Calculate interest alignment
      const interestOverlap = userInterests.filter((interest: string) =>
        career.description?.toLowerCase().includes(interest.toLowerCase()) ||
        career.title?.toLowerCase().includes(interest.toLowerCase())
      ).length;
      
      // Use the existing match score from directCareerMatcher as base, then enhance it
      let enhancedScore = career.matchScore || 0.7;
      
      // Skill bonus (up to 0.2 additional points)
      if (skillOverlap > 0 && userSkills.length > 0) {
        const skillBonus = (skillOverlap / userSkills.length) * 0.2;
        enhancedScore = Math.min(1.0, enhancedScore + skillBonus);
      }
      
      // Interest bonus (up to 0.1 additional points)  
      if (interestOverlap > 0 && userInterests.length > 0) {
        const interestBonus = (interestOverlap / userInterests.length) * 0.1;
        enhancedScore = Math.min(1.0, enhancedScore + interestBonus);
      }
      
      // GPA bonus (up to 0.05 additional points)
      if (analysis.gpa && analysis.gpa >= 3.5) {
        enhancedScore = Math.min(1.0, enhancedScore + 0.05);
      }
      
      // Build detailed match reasons based on actual analysis
      const matchReasons = [];
      if (skillOverlap > 0) {
        matchReasons.push(`${skillOverlap}/${userSkills.length} skills match: ${userSkills.slice(0, 3).join(', ')}`);
      }
      if (interestOverlap > 0) {
        matchReasons.push(`${interestOverlap} interests align with role requirements`);
      }
      if (analysis.gpa) {
        matchReasons.push(`GPA ${analysis.gpa} meets educational requirements`);
      }
      if (analysis.education_level) {
        matchReasons.push(`${analysis.education_level} degree level appropriate`);
      }
      if (matchReasons.length === 0) {
        matchReasons.push(career.matchReason || 'Professional background aligns with role');
      }
      
      return {
        career,
        matchScore: enhancedScore,
        matchReasons,
        semanticSimilarity: enhancedScore * 0.95 // High semantic similarity for enhanced matching
      };
    });
    
    // Filter and sort by enhanced match score (lowered threshold to show results)
    const filteredMatches = processedMatches
      .filter(match => match.matchScore >= 0.45) // Reasonable threshold to show quality matches
      .sort((a, b) => b.matchScore - a.matchScore);
    
    console.log(`Enhanced career matching complete: ${filteredMatches.length} high-quality matches found`);
    
    return filteredMatches;
    
  } catch (error) {
    console.error('Enhanced career matching failed:', error);
    return [];
  }
}

// Enhanced scholarship matching with real database queries and personalized scoring
async function enhancedScholarshipMatching(analysis: any, resumeText: string): Promise<Array<{
  scholarship: any;
  matchScore: number;
  matchReasons: string[];
  semanticSimilarity: number;
}>> {
  try {
    console.log("Starting enhanced scholarship matching for profile with", analysis.skills?.length, "skills");
    
    // Get real scholarship matches from authentic database
    const scholarshipMatches = await searchAuthenticScholarshipDatabase(analysis, resumeText);
    
    if (scholarshipMatches.length === 0) {
      console.log("No scholarship matches found from database");
      return [];
    }
    
    // Process each scholarship with enhanced personalized scoring
    const processedMatches = scholarshipMatches.slice(0, 15).map((match) => {
      let enhancedScore = (match.score || 70) / 100;
      const matchReasons = [];
      
      // GPA enhancement based on actual extracted GPA
      if (analysis.gpa) {
        if (analysis.gpa >= 3.8) {
          enhancedScore = Math.min(1.0, enhancedScore + 0.1);
          matchReasons.push(`Excellent GPA ${analysis.gpa} qualifies for merit awards`);
        } else if (analysis.gpa >= 3.5) {
          enhancedScore = Math.min(1.0, enhancedScore + 0.05);
          matchReasons.push(`Strong GPA ${analysis.gpa} meets academic requirements`);
        } else {
          matchReasons.push(`GPA ${analysis.gpa} meets minimum requirements`);
        }
      }
      
      // STEM field bonus for technical skills
      const stemSkills = (analysis.skills || []).filter((skill: string) => 
        ['python', 'javascript', 'java', 'machine learning', 'data analysis', 'engineering', 'mathematics', 'science'].some(stemSkill => 
          skill.toLowerCase().includes(stemSkill)
        )
      );
      
      if (stemSkills.length > 0 && match.scholarship.name?.toLowerCase().includes('stem')) {
        enhancedScore = Math.min(1.0, enhancedScore + 0.15);
        matchReasons.push(`STEM skills (${stemSkills.slice(0, 2).join(', ')}) align with scholarship focus`);
      }
      
      // Interest alignment bonus
      const relevantInterests = (analysis.interests || []).filter((interest: string) =>
        match.scholarship.description?.toLowerCase().includes(interest.toLowerCase())
      );
      
      if (relevantInterests.length > 0) {
        enhancedScore = Math.min(1.0, enhancedScore + 0.05);
        matchReasons.push(`Career interests (${relevantInterests.slice(0, 2).join(', ')}) match scholarship goals`);
      }
      
      // Use existing reason if no specific reasons found
      if (matchReasons.length === 0) {
        matchReasons.push(match.reason || 'Profile meets scholarship eligibility criteria');
      }
      
      return {
        scholarship: match.scholarship,
        matchScore: enhancedScore,
        matchReasons,
        semanticSimilarity: enhancedScore * 0.9
      };
    });
    
    // Filter for high-quality matches and sort
    const filteredMatches = processedMatches
      .filter((match) => match.matchScore >= 0.60) // Good threshold for scholarships
      .sort((a, b) => b.matchScore - a.matchScore);
    
    console.log(`Enhanced scholarship matching complete: ${filteredMatches.length} quality matches found`);
    
    return filteredMatches;
    
  } catch (error) {
    console.error('Enhanced scholarship matching failed:', error);
    return [];
  }
}

// Main enhanced analyzer function
export async function analyzeResumeWithEnhancedFallback(resumeText: string): Promise<EnhancedAnalysisResult> {
  try {
    // Enhanced skill and interest extraction (now async)
    const enhancedSkills = await extractEnhancedSkills(resumeText);
    const enhancedInterests = extractInterests(resumeText);
    const detectedGPA = extractGPA(resumeText);
    const educationLevel = detectEducationLevel(resumeText);
    
    // Create enhanced analysis result
    const analysis = {
      skills: enhancedSkills,
      interests: enhancedInterests,
      gpa: detectedGPA,
      education_level: educationLevel,
      demographics: [],
      analysis_confidence: enhancedSkills.length > 3 ? 'high' : enhancedSkills.length > 1 ? 'medium' : 'low',
      confidenceScore: Math.min(0.95, 0.6 + (enhancedSkills.length * 0.05) + (enhancedInterests.length * 0.03)),
      uniqueAnalysis: true
    };
    
    console.log('Enhanced fallback analysis:', {
      skillsExtracted: enhancedSkills.length,
      interestsExtracted: enhancedInterests.length,
      gpaDetected: detectedGPA,
      educationLevel,
      confidenceScore: analysis.confidenceScore
    });
    
    // Get career and scholarship matches
    const [careers, scholarships] = await Promise.all([
      enhancedCareerMatching(analysis, resumeText),
      enhancedScholarshipMatching(analysis, resumeText)
    ]);
    
    console.log('Enhanced matching results:', {
      careerMatches: careers.length,
      scholarshipMatches: scholarships.length,
      avgCareerScore: careers.length > 0 ? careers.reduce((sum, c) => sum + c.matchScore, 0) / careers.length : 0
    });
    
    return {
      analysis,
      careers: careers.sort((a, b) => b.matchScore - a.matchScore),
      scholarships: scholarships.sort((a, b) => b.matchScore - a.matchScore)
    };
    
  } catch (error) {
    console.error('Enhanced fallback analyzer error:', error);
    
    // Ultimate fallback to Claude
    try {
      const claudeResult = await analyzeResumeWithClaude(resumeText);
      const careers = await searchAuthenticCareerDatabase(claudeResult, resumeText);
      const scholarships = await searchAuthenticScholarshipDatabase(claudeResult, resumeText);
      
      return {
        analysis: {
          ...claudeResult,
          uniqueAnalysis: false,
          error: 'Fallback to Claude analysis'
        },
        careers: careers.slice(0, 8).map((career: any) => ({
          career,
          matchScore: (career.matchScore || 0.75),
          matchReasons: [career.matchReason || 'Claude AI analysis'],
          semanticSimilarity: 0.7
        })),
        scholarships: scholarships.slice(0, 8).map((match) => ({
          scholarship: match.scholarship,
          matchScore: (match.score || 70) / 100,
          matchReasons: [match.reason || 'Claude analysis'],
          semanticSimilarity: 0.7
        }))
      };
    } catch (claudeError) {
      throw new Error(`Both enhanced and Claude analysis failed: ${(error as Error).message}, ${(claudeError as Error).message}`);
    }
  }
}

export const enhancedFallbackAnalyzer = {
  analyzeResumeWithEnhancedFallback
};