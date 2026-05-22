// Enhanced API route with Claude AI Pipeline integration
import type { Express } from "express";
import { claudePipelineService } from './claude-pipeline-service';

export function registerClaudeEnhancedRoutes(app: Express) {
  // Claude-powered career exploration endpoint
  app.post('/api/claude/explore-career', async (req, res): Promise<void> => {
    try {
      const { interest, skills, experience, education, preferences } = req.body;
      
      console.log(`🤖 Claude API: Processing career exploration request for ${interest}`);
      
      // Validate input
      if (!interest || typeof interest !== 'string') {
        res.status(400).json({ 
          error: 'Invalid input: interest is required and must be a string' 
        });
        return;
      }

      // Process through Claude pipeline
      const claudeInput = {
        interest,
        skills: skills || [],
        experience: experience || 'Entry level',
        education: education || 'Bachelor\'s degree',
        preferences: preferences || {}
      };

      const analysis = await claudePipelineService.processCareerExploration(claudeInput);
      const formattedResults = claudePipelineService.formatForFrontend(analysis, interest);

      console.log(`✅ Claude API: Returning ${formattedResults.careerOptions.length} career recommendations`);
      
      res.json({
        success: true,
        data: formattedResults,
        claudeInsights: formattedResults.claudeInsights,
        timestamp: new Date().toISOString(),
        source: 'claude-ai-pipeline'
      });

    } catch (error) {
      console.error('Claude enhanced route error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: (error as Error).message,
        source: 'claude-ai-pipeline'
      });
    }
  });

  // Claude-powered resume analysis endpoint
  app.post('/api/claude/analyze-resume', async (req, res): Promise<void> => {
    try {
      const { resumeText, targetInterest } = req.body;
      
      if (!resumeText || typeof resumeText !== 'string') {
        res.status(400).json({ 
          error: 'Invalid input: resumeText is required and must be a string' 
        });
        return;
      }

      console.log(`🤖 Claude API: Analyzing resume for ${targetInterest || 'general'} careers`);

      // Extract skills and experience from resume using Claude
      const extractedData = await claudePipelineService.extractResumeData(resumeText);
      
      // Get career recommendations based on extracted data
      const claudeInput = {
        interest: targetInterest || extractedData.suggestedInterests?.[0] || 'Technology',
        skills: extractedData.skills || [],
        experience: extractedData.experience || 'Entry level',
        education: extractedData.education || 'Bachelor\'s degree',
        preferences: extractedData.preferences || {}
      };

      const analysis = await claudePipelineService.processCareerExploration(claudeInput);
      const formattedResults = claudePipelineService.formatForFrontend(analysis, claudeInput.interest);

      res.json({
        success: true,
        extractedData,
        careerRecommendations: formattedResults,
        claudeInsights: formattedResults.claudeInsights,
        timestamp: new Date().toISOString(),
        source: 'claude-resume-analysis'
      });

    } catch (error) {
      console.error('Claude resume analysis error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: (error as Error).message,
        source: 'claude-resume-analysis'
      });
    }
  });

  // Claude-powered skill gap analysis
  app.post('/api/claude/skill-gap-analysis', async (req, res): Promise<void> => {
    try {
      const { currentSkills, targetCareer, experience } = req.body;
      
      if (!currentSkills || !targetCareer) {
        res.status(400).json({ 
          error: 'Invalid input: currentSkills and targetCareer are required' 
        });
        return;
      }

      console.log(`🤖 Claude API: Analyzing skill gap for ${targetCareer}`);

      const claudeInput = {
        interest: targetCareer as string,
        skills: currentSkills as string[],
        experience: (experience as string) || 'Entry level',
        education: "Bachelor's degree",
      };

      const analysis = await claudePipelineService.processCareerExploration(claudeInput);

      res.json({
        success: true,
        skillGapAnalysis: analysis.skillGapAnalysis,
        marketInsights: analysis.marketInsights,
        personalizedAdvice: analysis.personalizedAdvice,
        recommendedCareerPath: analysis.topCareers[0],
        timestamp: new Date().toISOString(),
        source: 'claude-skill-gap-analysis'
      });

    } catch (error) {
      console.error('Claude skill gap analysis error:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: (error as Error).message,
        source: 'claude-skill-gap-analysis'
      });
    }
  });
}