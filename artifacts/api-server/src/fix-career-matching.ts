import type { Express } from "express";
import { directCareerMatcher } from "./direct-career-matcher";

// Replace all broken career matching services with working analyzer
export function fixCareerMatchingEndpoints(app: Express) {
  
  // Fix /api/recommend-jobs endpoint
  app.post("/api/recommend-jobs", async (req, res) => {
    try {
      const userProfile = req.body;
      console.log("Direct career matching - User profile:", userProfile);
      
      const matches = directCareerMatcher.findMatches(userProfile);

      const recommendations = matches.map(match => ({
        jobTitle: match.career.title,
        jobCode: match.career.onetCode,
        description: match.career.description,
        avgSalary: match.career.averageSalary,
        growth: match.career.jobGrowthRate,
        matchScore: match.matchScore,
        requiredSkills: match.career.skills,
        recommendedDegrees: match.career.relatedMajors,
        standOutTips: match.career.standOutTips,
        topSchools: []
      })).slice(0, 10);

      console.log(`Direct matcher returned ${recommendations.length} career matches with real scores`);
      res.json(recommendations);
    } catch (error) {
      console.error('Direct career matching error:', error);
      res.status(500).json({ message: "Failed to find career matches" });
    }
  });

  // Fix /api/career-paths/matches endpoint
  app.post("/api/career-paths/matches", async (req, res) => {
    try {
      const userProfile = req.body;
      console.log("🔍 BACKEND: Direct career path matching - User profile:", userProfile);
      
      const matches = directCareerMatcher.findMatches(userProfile);

      console.log(`🎯 BACKEND: Direct matcher returned ${matches.length} career path matches with real scores`);
      console.log("📊 BACKEND: First match structure:", matches[0] ? Object.keys(matches[0]) : 'no matches');
      console.log("🚀 BACKEND: Sending to frontend:", JSON.stringify(matches).substring(0, 200) + "...");
      
      res.json(matches);
    } catch (error) {
      console.error("❌ BACKEND: Direct career path matching error:", error);
      res.status(500).json({ message: "Failed to find career matches" });
    }
  });

  // Fix /api/profile/career-recommendations endpoint
  app.get("/api/profile/career-recommendations", async (req: any, res): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ message: "Unauthorized" }); return; }

      const user = await (await import('./storage-fixed')).storage.getUser(userId);
      if (!user) { res.status(404).json({ message: "User not found" }); return; }

      const userProfile = {
        interests: user.interests || [],
        skills: user.aiKeywords || [],
        preferredEducation: user.academicLevel || 'undergraduate',
        locationPreference: user.state || ''
      };

      console.log("Direct profile career matching - User profile:", userProfile);
      const matches = directCareerMatcher.findMatches(userProfile);

      res.json({
        careers: matches.map(match => ({
          career: match.career,
          matchScore: match.matchScore,
          matchReasons: match.matchReasons,
          skillsMatch: match.skillsMatch,
          educationFit: match.educationFit,
          standOutTips: match.standOutTips
        }))
      });
    } catch (error) {
      console.error("Career recommendation error:", error);
      res.status(500).json({ message: "Failed to get career recommendations" });
    }
  });

  console.log("Fixed all career matching endpoints to use working analyzer instead of broken services");
}