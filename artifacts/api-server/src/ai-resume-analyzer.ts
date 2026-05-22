import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import { resumeAnalysisSchema } from '@workspace/db';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ResumeAnalysisResult {
  interests: string[];
  skills: string[];
  gpa: number | null;
  education_level: string;
  demographics: string[];
  analysis_confidence: 'high' | 'medium' | 'low';
}

export class AIResumeAnalyzer {
  async analyzeResume(resumeText: string, personalStatement: string, options?: {
    apiKey?: string;
    desiredDegree?: string;
    statePreference?: string;
  }): Promise<ResumeAnalysisResult> {
    try {
      // Prepare enhanced data for Python analysis
      const analysisInput = {
        resume: resumeText,
        statement: personalStatement || "",
        api_key: options?.apiKey || process.env.COLLEGE_SCORECARD_API_KEY || "",
        desired_degree: options?.desiredDegree || "Bachelor's",
        state_preference: options?.statePreference
      };

      // Call enhanced Python analyzer
      const analysisResult = await this.callPythonAnalyzer(analysisInput);
      
      // Validate and return result with scholarships data preserved
      const validatedResult = resumeAnalysisSchema.parse(analysisResult);
      
      // Ensure scholarships are preserved in the response
      if (analysisResult.scholarships && !validatedResult.scholarships) {
        (validatedResult as any).scholarships = analysisResult.scholarships;
      }
      
      return validatedResult;

    } catch (error) {
      console.error('Resume analysis error:', error);
      
      // Return fallback analysis with proper structure
      const fallbackResult = {
        interests: [],
        skills: [],
        gpa: null,
        education_level: 'undergraduate',
        demographics: [],
        analysis_confidence: 'low' as const
      };
      
      // Validate fallback result
      const validatedFallback = resumeAnalysisSchema.parse(fallbackResult);
      return validatedFallback;
    }
  }

  public async callPythonAnalyzer(input: { 
    resume: string; 
    statement: string; 
    api_key?: string; 
    desired_degree?: string; 
    state_preference?: string 
  }): Promise<any> {
    return new Promise((resolve, reject) => {
      const pythonScriptPath = path.join(__dirname, 'simple-career-analyzer.py');
      const python = spawn('python3', [pythonScriptPath]);

      let result = '';
      let error = '';

      // Send input to Python script
      python.stdin.write(JSON.stringify(input));
      python.stdin.end();

      // Collect output
      python.stdout.on('data', (data) => {
        result += data.toString();
      });

      python.stderr.on('data', (data) => {
        error += data.toString();
      });

      python.on('close', (code) => {
        if (code !== 0) {
          console.error('Python script error:', error);
          reject(new Error(`Python script failed with code ${code}: ${error}`));
          return;
        }

        try {
          const parsed = JSON.parse(result.trim());
          
          // Debug log to see what Python returns
          console.log('Python script complete result:', JSON.stringify(parsed, null, 2));
          
          // Handle errors returned by Python script
          if (parsed.error) {
            console.error('Python analysis error:', parsed.error);
            resolve(parsed); // Return the error result with fallback values
          } else {
            console.log('Python scholarships found:', parsed.scholarships?.length || 0);
            resolve(parsed);
          }
        } catch (parseError) {
          console.error('Failed to parse Python output:', parseError);
          console.error('Raw Python output:', result);
          reject(new Error('Failed to parse analysis results'));
        }
      });

      python.on('error', (err) => {
        console.error('Failed to start Python process:', err);
        reject(err);
      });
    });
  }

  calculateProfileCompleteness(user: any): number {
    let completeness = 0;
    const fields = [
      'gpa', 'state', 'major', 'academicLevel', 'financialNeed', 
      'demographics', 'interests', 'personalStatement'
    ];

    fields.forEach(field => {
      if (user[field]) {
        if (Array.isArray(user[field])) {
          completeness += user[field].length > 0 ? 12.5 : 0;
        } else {
          completeness += 12.5;
        }
      }
    });

    return Math.round(completeness);
  }

  generateProfileInsights(user: any): string[] {
    const insights = [];

    if (user.gpa && user.gpa >= 3.5) {
      insights.push("Strong academic performance opens doors to merit-based scholarships");
    }

    if (user.demographics?.includes('first-generation')) {
      insights.push("First-generation status qualifies you for specialized support programs");
    }

    if (user.demographics?.includes('STEM student') && user.gpa && user.gpa >= 3.0) {
      insights.push("STEM focus with solid GPA makes you competitive for technology scholarships");
    }

    if (user.interests?.length >= 3) {
      insights.push("Diverse interests expand your scholarship and career opportunities");
    }

    if (user.aiKeywords?.length >= 5) {
      insights.push("AI analysis identified strong keyword matches for targeted recommendations");
    }

    return insights;
  }
}

export const aiResumeAnalyzer = new AIResumeAnalyzer();