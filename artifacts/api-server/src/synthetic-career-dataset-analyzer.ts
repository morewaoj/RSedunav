// Synthetic Career Dataset Analyzer - Process career matching patterns
import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';

interface SyntheticCareerRecord {
  targetCareer: string;
  jobDescription: string;
  resume: string;
  matchScore: number;
}

interface CareerMatchPattern {
  career: string;
  avgMatchScore: number;
  totalOccurrences: number;
  scoreDistribution: { [score: number]: number };
  commonDescriptionPatterns: string[];
  resumePatterns: string[];
}

export class SyntheticCareerAnalyzer {
  private careerRecords: SyntheticCareerRecord[] = [];
  private careerPatterns: Map<string, CareerMatchPattern> = new Map();
  private initialized = false;

  constructor() {
    this.initializeFromDataset();
  }

  private async initializeFromDataset() {
    console.log("🎯 Initializing Synthetic Career Dataset Analyzer...");
    
    try {
      await this.loadCareerData();
      this.analyzeCareerMatchingPatterns();
      this.initialized = true;
      console.log("✅ Synthetic Career analysis ready with matching patterns");
    } catch (error) {
      console.error("Synthetic Career dataset initialization failed:", error);
      this.loadFallbackPatterns();
      this.initialized = true;
    }
  }

  private async loadCareerData(): Promise<void> {
    return new Promise((resolve, reject) => {
      const careerPath = path.join(process.cwd(), 'attached_assets', 'Synthetic_Career_Matching_Dataset_1753821198906.csv');
      
      if (!fs.existsSync(careerPath)) {
        console.log("Synthetic career dataset not found, using fallback");
        resolve();
        return;
      }

      fs.createReadStream(careerPath)
        .pipe(csv())
        .on('data', (row) => {
          try {
            this.careerRecords.push({
              targetCareer: row.target_career || '',
              jobDescription: row.job_description || '',
              resume: row.resume || '',
              matchScore: parseInt(row.match_score) || 0
            });
          } catch (parseError) {
            console.warn("Failed to parse synthetic career record:", parseError);
          }
        })
        .on('end', () => {
          console.log(`📊 Processed ${this.careerRecords.length} synthetic career records`);
          resolve();
        })
        .on('error', reject);
    });
  }

  private analyzeCareerMatchingPatterns() {
    const careerGroups = new Map<string, SyntheticCareerRecord[]>();
    
    // Group records by career
    for (const record of this.careerRecords) {
      if (!careerGroups.has(record.targetCareer)) {
        careerGroups.set(record.targetCareer, []);
      }
      careerGroups.get(record.targetCareer)!.push(record);
    }

    // Analyze each career's patterns
    for (const [career, records] of Array.from(careerGroups.entries())) {
      const scores = records.map(r => r.matchScore);
      const avgScore = scores.reduce((sum, score) => sum + score, 0) / scores.length;
      
      // Score distribution
      const scoreDistribution: { [score: number]: number } = {};
      for (const score of scores) {
        scoreDistribution[score] = (scoreDistribution[score] || 0) + 1;
      }

      // Extract common patterns from descriptions and resumes
      const descriptions = records.map(r => r.jobDescription);
      const resumes = records.map(r => r.resume);
      
      const commonDescPatterns = this.extractCommonPatterns(descriptions);
      const resumePatterns = this.extractCommonPatterns(resumes);

      this.careerPatterns.set(career, {
        career,
        avgMatchScore: Math.round(avgScore * 100) / 100,
        totalOccurrences: records.length,
        scoreDistribution,
        commonDescriptionPatterns: commonDescPatterns,
        resumePatterns: resumePatterns
      });
    }

    console.log(`🎯 Built career patterns for ${this.careerPatterns.size} synthetic careers`);
  }

  private extractCommonPatterns(texts: string[]): string[] {
    const wordFreq = new Map<string, number>();
    
    for (const text of texts) {
      const words = text.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 3 && !this.isStopWord(word));
      
      for (const word of words) {
        wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
      }
    }

    return Array.from(wordFreq.entries())
      .filter(([word, freq]) => freq >= Math.max(2, texts.length * 0.3))
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([word]) => word);
  }

  private isStopWord(word: string): boolean {
    const stopWords = ['with', 'experience', 'needed', 'professional', 'skilled', 'tools', 'responsibilities', 'typical', 'related', 'certifications'];
    return stopWords.includes(word);
  }

  private loadFallbackPatterns() {
    // Basic fallback patterns
    this.careerPatterns.set('Software Engineer', {
      career: 'Software Engineer',
      avgMatchScore: 3.5,
      totalOccurrences: 50,
      scoreDistribution: { 1: 5, 2: 10, 3: 15, 4: 15, 5: 5 },
      commonDescriptionPatterns: ['software', 'engineer', 'programming'],
      resumePatterns: ['programming', 'development', 'coding']
    });
  }

  // Enhanced career matching using synthetic patterns
  public calculateSyntheticMatchScore(extractedData: any, targetCareer: string): number {
    if (!this.initialized) {
      return 75; // Default score
    }

    const pattern = this.careerPatterns.get(targetCareer);
    if (!pattern) {
      return 70; // Default for unknown careers
    }

    let matchScore = pattern.avgMatchScore * 20; // Base score from historical patterns

    // Resume content matching
    const userSkills = (extractedData.skills || []).map((s: string) => s.toLowerCase());
    const userText = [
      ...(extractedData.skills || []),
      extractedData.education?.major || '',
      ...(extractedData.interests || [])
    ].join(' ').toLowerCase();

    // Check for pattern matches in user data
    let patternMatches = 0;
    for (const resumePattern of pattern.resumePatterns) {
      if (userText.includes(resumePattern) || 
          userSkills.some((skill: string) => skill.includes(resumePattern))) {
        patternMatches++;
      }
    }

    const patternBonus = (patternMatches / pattern.resumePatterns.length) * 20;
    matchScore += patternBonus;

    // Experience bonus based on synthetic data
    const userExp = extractedData.experience_years || 0;
    if (userExp >= 3) {
      matchScore += 10;
    } else if (userExp >= 1) {
      matchScore += 5;
    }

    return Math.min(95, Math.max(20, Math.round(matchScore)));
  }

  // Get career recommendations based on synthetic patterns
  public getCareerRecommendations(extractedData: any): any[] {
    if (!this.initialized) {
      return [];
    }

    const recommendations: any[] = [];

    for (const [career, pattern] of Array.from(this.careerPatterns.entries())) {
      const matchScore = this.calculateSyntheticMatchScore(extractedData, career);
      
      if (matchScore >= 60) {
        recommendations.push({
          title: career,
          matchScore,
          avgHistoricalScore: pattern.avgMatchScore,
          dataPoints: pattern.totalOccurrences,
          keyPatterns: pattern.resumePatterns.slice(0, 4),
          scoreDistribution: pattern.scoreDistribution,
          confidence: Math.min(95, pattern.totalOccurrences * 2) // More data = higher confidence
        });
      }
    }

    return recommendations
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 8);
  }

  // Get performance statistics
  public getPerformanceStats(): any {
    const totalRecords = this.careerRecords.length;
    
    // Score distribution across all records
    const allScores = this.careerRecords.map(r => r.matchScore);
    const avgScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
    
    const scoreDistribution: { [score: number]: number } = {};
    for (const score of allScores) {
      scoreDistribution[score] = (scoreDistribution[score] || 0) + 1;
    }

    const topCareers = Array.from(this.careerPatterns.values())
      .sort((a, b) => b.avgMatchScore - a.avgMatchScore)
      .slice(0, 10)
      .map(pattern => ({
        career: pattern.career,
        avgScore: pattern.avgMatchScore,
        dataPoints: pattern.totalOccurrences,
        keyPatterns: pattern.resumePatterns.slice(0, 3)
      }));

    return {
      totalRecords,
      avgMatchScore: Math.round(avgScore * 100) / 100,
      scoreDistribution,
      careerPatterns: this.careerPatterns.size,
      topPerformingCareers: topCareers,
      initialized: this.initialized
    };
  }

  // Get detailed pattern for specific career
  public getCareerPattern(career: string): CareerMatchPattern | null {
    return this.careerPatterns.get(career) || null;
  }

  // Check if analyzer is ready
  public isInitialized(): boolean {
    return this.initialized;
  }
}

export const syntheticCareerAnalyzer = new SyntheticCareerAnalyzer();