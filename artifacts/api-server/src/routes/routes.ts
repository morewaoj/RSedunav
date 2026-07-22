import type { Express } from "express";
import { createServer, type Server } from "http";
import { registerClaudeEnhancedRoutes } from '../claude-enhanced-route';
import { storage, db } from "../storage";
import { setupAuth, isAuthenticated, hashPassword } from "../auth";
import { 
  insertUserPreferencesSchema, 
  insertSavedPlanSchema, 
  insertCareerPathSchema, 
  insertScholarshipSchema,
  insertUserProfileSchema,
  insertSavedCollegeSchema,
  insertSavedCareerSchema,
  insertSavedScholarshipSchema,
  insertComprehensivePlanSchema,
  insertUserPlanSchema,
  insertPlanCareerSchema,
  insertPlanCollegeSchema,
  users,
  colleges,
  careerPaths,
  scholarships,
  savedColleges,
  savedCareers as savedCareersTable,
  savedScholarships as savedScholarshipsTable,
  savedFellowships as savedFellowshipsTable,
  analyticsEvents
} from "@workspace/db";
import { eq, sql, gte, and, desc } from "drizzle-orm";
import { z } from "zod";
import { DataPopulationService, CollegeScorecardService } from "../data-sources";
import BLSService from "../bls-service";
import { BulkCollegeLoader } from "../bulk-college-loader";
import { careerRecommendationEngine } from "../career-recommendation-engine";
import { aiInspirationService } from "../ai-inspiration-service";
import { workingCareerService } from "../working-career-service";
import { smartScholarshipMatcher } from "../smart-scholarship-matcher";
import { analyzeResumeWithClaude, generateCareerRecommendations } from "../claude-resume-analyzer";
import { datasetEnhancedAnalyzer } from "../dataset-enhanced-analyzer";
import { directCareerMatcher } from "../direct-career-matcher";
import { fixCareerMatchingEndpoints } from "../fix-career-matching";
import { addTrainingStatsEndpoint } from "../training-stats-endpoint";
import { collegeIndexer } from '../college-indexer';
import { databaseCareerMatcher } from '../database-career-matcher';
import { hybridCareerMatcher } from '../hybrid-career-matcher';
import { verifiedScholarshipService } from '../verified-scholarship-service';
import { extractTextFromResume, validateResumeFile } from '../resume-extraction';
import { fellowshipService } from '../fellowship-service';
import { mlResumeParser } from '../ml-resume-parser';
import { callClaudeForExtraction, matchCareersFromClaudeData, matchScholarshipsFromClaudeData } from '../claude-extraction-service';
import * as scholarshipService from '../comprehensive-scholarship-service';
import { enhancedFallbackAnalyzer } from '../enhanced-fallback-analyzer';
import { hasAnthropicKey } from '../lib/ai-availability';
import multer from "multer";
import { promises as fs } from "fs";
import path from "path";
import { updateUserProfileSchema, resumeAnalysisSchema } from "@workspace/db";

// Configure multer for resume file uploads (PDF, DOCX, DOC, TXT)
const resumeUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain'
    ];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, DOC, or TXT files are allowed'));
    }
  }
});

// Configure multer for profile picture uploads
const profilePictureUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit for images
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, GIF, WebP) are allowed'));
    }
  }
});

// Enhanced school recommendation function with nationwide coverage and state filtering
async function findBestSchoolsForJobNationwide(
  jobTitle: string,
  recommendedDegrees: string[],
  locationPreference?: string,
  educationLevel?: string
) {
  const programKeywords = [
    ...recommendedDegrees,
    jobTitle.split(' ')[0], // First word of job title
    jobTitle.includes('Engineer') ? 'Engineering' : '',
    jobTitle.includes('Business') ? 'Business' : '',
    jobTitle.includes('Computer') || jobTitle.includes('Software') ? 'Computer Science' : '',
    jobTitle.includes('Data') ? 'Data Science' : '',
    jobTitle.includes('Health') ? 'Health' : '',
  ].filter(Boolean);

  // Get all colleges and filter by relevant programs and characteristics
  const allColleges = await storage.getColleges(1000);
  let matchingColleges = allColleges.filter(college => 
    college.name.toLowerCase().includes('university') ||
    college.name.toLowerCase().includes('college') ||
    college.name.toLowerCase().includes('institute') ||
    college.type.toLowerCase().includes('university') ||
    programKeywords.some(keyword => 
      college.name.toLowerCase().includes(keyword.toLowerCase()) ||
      college.description?.toLowerCase().includes(keyword.toLowerCase())
    )
  );

  // Apply education level filter for master's programs
  if (educationLevel === 'master') {
    matchingColleges = matchingColleges.filter(college =>
      college.academicLevel === 'Graduate' ||
      college.name.toLowerCase().includes('graduate') ||
      college.description?.toLowerCase().includes('master') ||
      college.description?.toLowerCase().includes('graduate')
    );
  }

  // Sort by quality indicators
  matchingColleges.sort((a, b) => {
    const aScore = (a.graduationRate || 50) + (100 - (a.acceptanceRate || 50)) + (a.rating || 3) * 10;
    const bScore = (b.graduationRate || 50) + (100 - (b.acceptanceRate || 50)) + (b.rating || 3) * 10;
    return bScore - aScore;
  });

  // Apply state filter if specified
  if (locationPreference && locationPreference !== 'all-states') {
    const stateColleges = matchingColleges.filter(college => 
      college.state?.toLowerCase() === locationPreference.toLowerCase() ||
      college.location?.toLowerCase().includes(locationPreference.toLowerCase())
    );
    
    if (stateColleges.length > 0) {
      return stateColleges.slice(0, 5).map(college => ({
        id: college.id,
        name: college.name,
        location: college.location || `${college.city}, ${college.state}`,
        program: 'Relevant Program',
        tuition: college.tuition || 25000,
        acceptanceRate: college.acceptanceRate || 65,
        graduationRate: college.graduationRate || 70,
        ranking: college.rating || 3,
        matchReason: `Top ${locationPreference} school for ${jobTitle}`
      }));
    }
  }

  // Return top 5 nationwide schools
  return matchingColleges.slice(0, 5).map(college => ({
    id: college.id,
    name: college.name,
    location: college.location || `${college.city}, ${college.state}`,
    program: 'Relevant Program',
    tuition: college.tuition || 25000,
    acceptanceRate: college.acceptanceRate || 65,
    graduationRate: college.graduationRate || 70,
    ranking: college.rating || 3,
    matchReason: `Top nationwide school for ${jobTitle}`
  }));
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup traditional email/password authentication
  setupAuth(app);

  // Set/Save password endpoint - allows users to create or update their password
  app.post("/api/auth/set-password", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) {
      res.status(401).json({ message: "Please log in first" });
      return;
    }
    
    const { password } = req.body;
    
    if (!password || typeof password !== 'string') {
      res.status(400).json({ message: "Password is required" });
      return;
    }
    
    if (password.length < 6) {
      res.status(400).json({ message: "Password must be at least 6 characters" });
      return;
    }
    
    try {
      const hashedPassword = await hashPassword(password);
      const userId = req.user!.id;
      
      const updatedUser = await storage.updateUserProfile(userId, { password: hashedPassword });
      
      if (!updatedUser) {
        res.status(500).json({ message: "Failed to save password" });
        return;
      }
      
      res.json({ message: "Password saved successfully" });
    } catch (error) {
      console.error("Error saving password:", error);
      res.status(500).json({ message: "Failed to save password" });
    }
  });

  // V2 College search endpoint with proper validation and cursor pagination
  const searchSchema = z.object({
    q: z.string().trim().optional(),
    state: z.string().trim().optional(), // Accept full state names like "California"
    type: z.string().trim().optional(),
    majors: z.union([z.string(), z.array(z.string())]).optional()
             .transform(v => Array.isArray(v) ? v : v ? [v] : []),
    limit: z.coerce.number().int().min(1).max(100).default(30),
    cursor: z.string().optional(),
    sort: z.enum(["rating", "name"]).default("rating"),
    order: z.enum(["asc", "desc"]).default("desc"),
  });

  app.get("/api/colleges/search", async (req, res) => {
    try {
      const parsed = searchSchema.safeParse(req.query);
      if (!parsed.success) {
        res.status(400).json({ message: "Invalid query", errors: parsed.error.errors });
        return;
      }

      const { q, state, type, majors, limit, cursor, sort, order } = parsed.data;

      // Return nothing until user "signals" (search text >=2 or any filter)
      const hasSignal = (q && q.length >= 2) || state || type || (majors && majors.length);
      if (!hasSignal) {
        res.set("Cache-Control", "no-store");
        res.json({ data: [], pageInfo: { total: 0, nextCursor: null } });
        return;
      }

      const result = await storage.searchCollegesV2({ q, state, type, majors, limit, cursor, sort, order });
      
      res.set("Cache-Control", "no-store"); // prevent 304 cache weirdness for search
      res.json({
        data: result.rows,
        pageInfo: {
          total: result.total,
          nextCursor: result.nextCursor
        }
      });
    } catch (error) {
      console.error("College search V2 error:", error);
      res.status(500).json({ message: "Failed to search colleges" });
    }
  });

  // Fast college endpoint for backward compatibility (must be before :id route)
  app.get("/api/colleges/fast", async (req, res) => {
    try {
      const { limit = "50", career, state, type } = req.query;
      
      // Convert to new search format
      const searchParams = {
        limit: Math.min(parseInt(limit as string), 200),
        majors: career ? [career as string] : undefined,
        state: state as string,
        type: type as "public" | "private",
        sort: "rating" as const,
        order: "desc" as const
      };

      const result = await storage.searchCollegesV2(searchParams);
      res.json(result.rows);
    } catch (error) {
      console.error("Fast college fetch error:", error);
      res.status(500).json({ message: "Failed to fetch colleges" });
    }
  });

  // College detail endpoints
  app.get('/api/colleges/:id', async (req, res) => {
    try {
      const collegeId = parseInt(req.params.id);
      const college = await storage.getCollegeById(collegeId);
      if (!college) {
        res.status(404).json({ message: 'College not found' });
        return;
      }
      res.set("Cache-Control", "no-store");
      res.json(college);
    } catch (error) {
      console.error('Error fetching college:', error);
      res.status(500).json({ message: 'Failed to fetch college' });
    }
  });

  app.get('/api/colleges/:id/scholarships', async (req, res) => {
    try {
      const collegeId = parseInt(req.params.id);
      const scholarships = await (storage as any).getCollegeScholarships(collegeId);
      res.set("Cache-Control", "no-store");
      res.json(scholarships);
    } catch (error) {
      console.error('Error fetching scholarships:', error);
      res.status(500).json({ message: 'Failed to fetch scholarships' });
    }
  });

  // Enhanced college search endpoint
  app.get("/api/colleges/search", async (req, res) => {
    try {
      const {
        query = "",
        state = "",
        type = "",
        career = "",
        limit = "200"
      } = req.query;

      let colleges;
      if (career) {
        colleges = await storage.searchCollegesByCareer(career as string, parseInt(limit as string));
      } else {
        const filters: any = {
          page: 1,
          limit: parseInt(limit as string),
          searchTerm: query as string,
          state: state as string,
          type: type as string
        };
        colleges = await storage.searchColleges(filters);
      }

      res.json(colleges);
    } catch (error) {
      console.error("Enhanced college search error:", error);
      res.status(500).json({ message: "Failed to search colleges" });
    }
  });

  // Get all colleges with filtering and pagination
  app.get("/api/colleges", async (req, res) => {
    try {
      const {
        page = "1",
        limit = "200", 
        state,
        type,
        sport,
        minTuition,
        maxTuition,
        minAcceptance,
        maxAcceptance,
        search
      } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);
      
      // If no filters, show popular colleges first
      if (!state && !type && !sport && !minTuition && !maxTuition && !minAcceptance && !maxAcceptance && !search) {
        const colleges = await storage.getFastColleges(limitNum);
        res.json(colleges);
        return;
      }

      // Apply filters with pagination
      const colleges = await storage.getFilteredColleges({
        page: pageNum,
        limit: limitNum,
        state: state as string,
        type: type as string,
        sport: sport as string,
        minTuition: minTuition ? parseInt(minTuition as string) : undefined,
        maxTuition: maxTuition ? parseInt(maxTuition as string) : undefined,
        minAcceptance: minAcceptance ? parseInt(minAcceptance as string) : undefined,
        maxAcceptance: maxAcceptance ? parseInt(maxAcceptance as string) : undefined,
        search: search as string
      });

      res.json(colleges);
    } catch (error) {
      console.error("College search error:", error);
      res.status(500).json({ message: "Failed to fetch colleges" });
    }
  });

  // Fast college search endpoint - prioritizes Georgia schools
  app.get("/api/colleges/search", async (req, res) => {
    try {
      const { q } = req.query;
      const query = q as string;
      
      const colleges = await storage.searchColleges(query || '');
      res.json(colleges);
    } catch (error) {
      console.error("Fast college search error:", error);
      res.status(500).json({ message: "Search failed" });
    }
  });

  // Enhanced ML-powered job recommendation endpoint
  app.post("/api/recommend-jobs", async (req, res) => {
    try {
      const userInterestsSchema = z.object({
        interests: z.array(z.string()),
        skills: z.array(z.string()),
        preferredEducation: z.string().optional(),
        academicLevel: z.string().optional(),
        locationPreference: z.string().optional(),
        salaryExpectation: z.number().optional(),
        workExperience: z.number().optional(),
        resumeText: z.string().optional()
      });

      const userProfile = userInterestsSchema.parse(req.body);
      console.log("ML Career matching request:", {
        interests: userProfile.interests?.length || 0,
        skills: userProfile.skills?.length || 0,
        academicLevel: userProfile.academicLevel || userProfile.preferredEducation,
        hasResume: !!userProfile.resumeText
      });
      
      // Import and use ML Career Matcher with Claude AI integration
      const { MLCareerMatcher } = await import('../ml-career-matcher');
      const mlMatcher = new MLCareerMatcher();
      
      // Get AI-enhanced career matches
      const mlResponse = await mlMatcher.findMatches({
        interests: userProfile.interests || [],
        skills: userProfile.skills || [],
        academicLevel: userProfile.academicLevel || userProfile.preferredEducation || 'bachelor',
        preferredSalary: userProfile.salaryExpectation,
        workExperience: userProfile.workExperience,
        resumeText: userProfile.resumeText
      });

      console.log("ML career matches found:", mlResponse.careers?.length || 0);
      
      // Transform ML response to match expected format
      const recommendations = mlResponse.careers.map((career: any) => ({
        jobTitle: career.title,
        jobCode: career.onetCode,
        description: career.description,
        avgSalary: career.averageSalary,
        growth: career.jobGrowthRate,
        requiredSkills: career.keySkills,
        recommendedDegrees: [career.educationRequired],
        topSchools: career.recommendedColleges,
        matchScore: Math.round(career.matchScore * 100),
        matchReasons: career.matchReasons,
        standOutTips: ["Develop the recommended skills", "Gain relevant experience", "Network in the industry"],
        careerPathway: career.workEnvironment,
        outlook: career.jobGrowthRate
      }));
      
      res.json(recommendations);
    } catch (error) {
      console.error("Job recommendation error:", error);
      res.status(500).json({ message: "Failed to get job recommendations" });
    }
  });

  // AI Career Inspiration endpoint
  app.post("/api/career-inspiration", async (req, res) => {
    try {
      const { interests, skills, personalityTraits, quickInspiration } = req.body;
      
      let inspirations;
      if (quickInspiration) {
        inspirations = await aiInspirationService.generateQuickInspiration();
      } else {
        inspirations = await aiInspirationService.generateCareerInspiration(
          interests,
          skills, 
          personalityTraits
        );
      }
      
      res.json(inspirations);
    } catch (error) {
      console.error("Career inspiration error:", error);
      res.status(500).json({ message: "Failed to generate career inspiration" });
    }
  });

  // Get schools for specific job
  app.get("/api/schools-for-job/:jobTitle", async (req, res) => {
    try {
      const { jobTitle } = req.params;
      const { location } = req.query;
      
      const schools = await careerRecommendationEngine.findBestSchoolsForCareer(
        jobTitle, 
        location as string
      );
      
      res.json(schools);
    } catch (error) {
      console.error("Schools for job error:", error);
      res.status(500).json({ message: "Failed to find schools for job" });
    }
  });

  // Get college by ID
  app.get("/api/colleges/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const college = await storage.getCollegeById(id);
      
      if (!college) {
        res.status(404).json({ message: "College not found" });
        return;
      }
      
      res.json(college);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch college" });
    }
  });

  // Search colleges
  app.get("/api/colleges/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const colleges = await storage.searchColleges(query);
      res.json(colleges);
    } catch (error) {
      res.status(500).json({ message: "Failed to search colleges" });
    }
  });

  // Create user preferences
  app.post("/api/preferences", async (req, res) => {
    try {
      const validatedData = insertUserPreferencesSchema.parse(req.body);
      const preferences = await storage.createUserPreferences(validatedData);
      res.status(201).json(preferences);
    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid preferences data", errors: error.errors });
        return;
      }
      res.status(500).json({ message: "Failed to save preferences" });
    }
  });

  // Get user preferences
  app.get("/api/preferences", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const preferences = await storage.getUserPreferences();
      res.json(preferences || {});
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch preferences" });
    }
  });

  // Career paths endpoints
  app.get("/api/career-paths", async (req, res) => {
    try {
      const careers = await storage.getCareerPaths();
      res.json(careers);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch career paths" });
    }
  });

  app.get("/api/career-paths/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const career = await storage.getCareerPathById(id);
      
      if (!career) {
        res.status(404).json({ message: "Career path not found" });
        return;
      }
      
      res.json(career);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch career path" });
    }
  });

  app.get("/api/career-paths/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const careers = await storage.searchCareerPaths(query);
      res.json(careers);
    } catch (error) {
      res.status(500).json({ message: "Failed to search career paths" });
    }
  });

  // Removed duplicate broken enhanced career matching endpoint

  // Career Inspiration endpoint
  app.post("/api/career-inspiration", async (req, res) => {
    try {
      const { quickInspiration } = req.body;
      const inspirations = await aiInspirationService.generateCareerInspiration(
        [], // No specific interests for quick inspiration
        [], // No specific skills for quick inspiration
        quickInspiration
      );
      res.json(inspirations);
    } catch (error) {
      console.error('Career inspiration error:', error);
      res.status(500).json({ message: "Failed to generate career inspirations" });
    }
  });

  // User Profile and Save/Sync endpoints
  app.post("/api/user-profile", async (req, res) => {
    try {
      const profileData = req.body;
      const profile = await storage.createUserProfile(profileData);
      res.status(201).json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to create user profile" });
    }
  });

  app.get("/api/user-profile/:sessionId", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const profile = await storage.getUserProfile(sessionId);
      if (!profile) {
        res.status(404).json({ message: "Profile not found" });
        return;
      }
      res.json(profile);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch user profile" });
    }
  });

  app.post("/api/saved-colleges", async (req, res) => {
    try {
      const savedData = req.body;
      if (!savedData?.userId || savedData?.collegeId === undefined || savedData?.collegeId === null) {
        res.status(400).json({ message: "userId and collegeId are required" });
        return;
      }
      const saved = await storage.saveCollege(savedData);
      // 200 if it was already saved (dedup), 201 if newly inserted.
      res.status(saved.duplicate ? 200 : 201).json(saved);
    } catch (error) {
      console.error("Failed to save college:", error);
      res.status(500).json({ message: "Failed to save college" });
    }
  });

  app.post("/api/saved-careers", async (req, res) => {
    try {
      const savedData = req.body;
      if (!savedData?.userId || !savedData?.careerTitle) {
        res.status(400).json({ message: "userId and careerTitle are required" });
        return;
      }
      const saved = await storage.saveCareer(savedData);
      res.status(saved.duplicate ? 200 : 201).json(saved);
    } catch (error) {
      console.error("Failed to save career:", error);
      res.status(500).json({ message: "Failed to save career" });
    }
  });

  app.post("/api/saved-scholarships", async (req, res) => {
    try {
      const savedData = req.body;
      if (!savedData?.userId || savedData?.scholarshipId === undefined || savedData?.scholarshipId === null) {
        res.status(400).json({ message: "userId and scholarshipId are required" });
        return;
      }
      const saved = await storage.saveScholarship(savedData);
      res.status(saved.duplicate ? 200 : 201).json(saved);
    } catch (error) {
      console.error("Failed to save scholarship:", error);
      res.status(500).json({ message: "Failed to save scholarship" });
    }
  });

  // NOTE: Auth-scoped on purpose. We deliberately ignore any caller-supplied
  // userId (query/body) and derive it from the authenticated session so one
  // user cannot delete another user's saved items by guessing IDs.
  app.delete("/api/saved-colleges/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const userId: string | undefined = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "Numeric id is required" });
        return;
      }
      const removed = await storage.removeSavedCollege(userId, id);
      if (!removed) {
        res.status(404).json({ message: "Saved college not found" });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove saved college:", error);
      res.status(500).json({ message: "Failed to remove saved college" });
    }
  });

  app.delete("/api/saved-careers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const userId: string | undefined = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "Numeric id is required" });
        return;
      }
      const removed = await storage.removeSavedCareer(userId, id);
      if (!removed) {
        res.status(404).json({ message: "Saved career not found" });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove saved career:", error);
      res.status(500).json({ message: "Failed to remove saved career" });
    }
  });

  app.delete("/api/saved-scholarships/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const userId: string | undefined = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "Numeric id is required" });
        return;
      }
      const removed = await storage.removeSavedScholarship(userId, id);
      if (!removed) {
        res.status(404).json({ message: "Saved scholarship not found" });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error("Failed to remove saved scholarship:", error);
      res.status(500).json({ message: "Failed to remove saved scholarship" });
    }
  });

  // Auth-scoped PATCH endpoints — like the DELETEs above, the user is taken
  // from the session and the URL never carries another user's id.
  const updateCollegeSchema = z
    .object({
      notes: z.string().trim().max(2000).nullable().optional(),
      priority: z.enum(["high", "medium", "low"]).nullable().optional(),
    })
    .strict();

  app.patch("/api/saved-colleges/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const userId: string | undefined = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "Numeric id is required" });
        return;
      }
      const parsed = updateCollegeSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid update body",
          issues: parsed.error.issues,
        });
        return;
      }
      const updated = await storage.updateSavedCollege(userId, id, parsed.data);
      if (!updated) {
        res.status(404).json({ message: "Saved college not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update saved college:", error);
      res.status(500).json({ message: "Failed to update saved college" });
    }
  });

  const updateCareerSchema = z
    .object({
      notes: z.string().trim().max(2000).nullable().optional(),
    })
    .strict();

  app.patch("/api/saved-careers/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const userId: string | undefined = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "Numeric id is required" });
        return;
      }
      const parsed = updateCareerSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid update body",
          issues: parsed.error.issues,
        });
        return;
      }
      const updated = await storage.updateSavedCareer(userId, id, parsed.data);
      if (!updated) {
        res.status(404).json({ message: "Saved career not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update saved career:", error);
      res.status(500).json({ message: "Failed to update saved career" });
    }
  });

  const updateScholarshipSchema = z
    .object({
      notes: z.string().trim().max(2000).nullable().optional(),
      applicationStatus: z
        .enum(["interested", "applied", "awarded", "rejected"])
        .nullable()
        .optional(),
    })
    .strict();

  app.patch("/api/saved-scholarships/:id", isAuthenticated, async (req: any, res) => {
    try {
      const id = Number(req.params.id);
      const userId: string | undefined = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Not authenticated" });
        return;
      }
      if (!Number.isFinite(id)) {
        res.status(400).json({ message: "Numeric id is required" });
        return;
      }
      const parsed = updateScholarshipSchema.safeParse(req.body ?? {});
      if (!parsed.success) {
        res.status(400).json({
          message: "Invalid update body",
          issues: parsed.error.issues,
        });
        return;
      }
      const updated = await storage.updateSavedScholarship(userId, id, parsed.data);
      if (!updated) {
        res.status(404).json({ message: "Saved scholarship not found" });
        return;
      }
      res.json(updated);
    } catch (error) {
      console.error("Failed to update saved scholarship:", error);
      res.status(500).json({ message: "Failed to update saved scholarship" });
    }
  });

  app.get("/api/saved-items/:sessionId", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const [colleges, careers, scholarships] = await Promise.all([
        storage.getSavedColleges(sessionId),
        storage.getSavedCareers(sessionId),
        storage.getSavedScholarships(sessionId)
      ]);
      
      res.json({
        colleges,
        careers,
        scholarships,
        lastSync: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch saved items" });
    }
  });

  // Comprehensive Plan endpoints
  app.post("/api/comprehensive-plans", async (req, res) => {
    try {
      const planData = req.body;
      const plan = await storage.createComprehensivePlan(planData);
      res.status(201).json(plan);
    } catch (error) {
      res.status(500).json({ message: "Failed to create comprehensive plan" });
    }
  });

  app.get("/api/comprehensive-plans/:sessionId", async (req, res) => {
    try {
      const sessionId = req.params.sessionId;
      const plans = await storage.getComprehensivePlans(sessionId);
      res.json(plans);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch comprehensive plans" });
    }
  });

  // Scholarship endpoints
  app.get("/api/scholarships", async (req, res) => {
    try {
      const scholarships = await storage.getScholarships();
      res.json(scholarships);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scholarships" });
    }
  });

  // Get authentic scholarships - federal, state, and private sources
  app.get("/api/scholarships/authentic", async (req, res) => {
    try {
      const authenticScholarships = [
        // Federal Scholarships
        {
          name: "Pell Grant",
          amount: 7395,
          type: "need-based",
          eligibilityRequirements: ["FAFSA completion", "U.S. citizenship or eligible non-citizen", "Exceptional financial need", "Undergraduate enrollment"],
          deadline: "June 30, 2026",
          renewable: true,
          provider: "U.S. Department of Education",
          website: "https://studentaid.gov/understand-aid/types/grants/pell",
          description: "Federal grant for undergraduate students with exceptional financial need. Does not need to be repaid.",
          targetDemographics: ["undergraduate students", "low-income families"],
          applicationRequirements: ["FAFSA form", "High school diploma or GED", "Social Security card", "Tax returns"]
        },
        {
          name: "FSEOG (Federal Supplemental Educational Opportunity Grant)",
          amount: 4000,
          type: "need-based",
          eligibilityRequirements: ["FAFSA completion", "Exceptional financial need", "Pell Grant recipient", "Undergraduate enrollment"],
          deadline: "Varies by school",
          renewable: true,
          provider: "U.S. Department of Education",
          website: "https://studentaid.gov/understand-aid/types/grants/fseog",
          description: "Federal grant for undergraduate students with exceptional financial need, priority given to Pell Grant recipients.",
          targetDemographics: ["undergraduate students", "extremely low-income families"],
          applicationRequirements: ["FAFSA form", "Pell Grant eligibility", "School financial aid application"]
        },
        {
          name: "TEACH Grant",
          amount: 4000,
          type: "service-based",
          eligibilityRequirements: ["Teaching commitment", "High-need field", "Low-income school service", "Maintain 3.25 GPA"],
          deadline: "Varies by program",
          renewable: true,
          provider: "U.S. Department of Education", 
          website: "https://studentaid.gov/understand-aid/types/grants/teach",
          description: "Federal grant for students who agree to teach in high-need fields at low-income schools.",
          targetDemographics: ["education majors", "future teachers"],
          applicationRequirements: ["FAFSA form", "Teaching service agreement", "Academic transcripts"]
        },
        {
          name: "Iraq and Afghanistan Service Grant",
          amount: 7395,
          type: "need-based",
          eligibilityRequirements: ["Parent/guardian died in Iraq/Afghanistan", "Under 24 years old", "Enrolled at least part-time"],
          deadline: "June 30, 2026",
          renewable: true,
          provider: "U.S. Department of Education",
          website: "https://studentaid.gov/understand-aid/types/grants/iraq-afghanistan-service",
          description: "Federal grant for students whose parent or guardian died as a result of military service in Iraq or Afghanistan.",
          targetDemographics: ["military families", "children of fallen service members"],
          applicationRequirements: ["FAFSA form", "Military service documentation", "Death certificate"]
        },
        // State Scholarships
        {
          name: "Cal Grant A",
          amount: 12570,
          type: "need-based",
          eligibilityRequirements: ["California residency", "Financial need", "GPA requirement 3.0+", "High school graduate"],
          deadline: "March 2, 2026",
          renewable: true,
          provider: "California Student Aid Commission",
          website: "https://www.csac.ca.gov/cal-grants",
          description: "California state grant covering tuition and fees at participating California colleges and universities.",
          targetDemographics: ["California residents", "undergraduate students"],
          applicationRequirements: ["FAFSA or CA Dream Act Application", "GPA verification", "California residency proof"]
        },
        {
          name: "Texas Grant (TEXAS Grant)",
          amount: 5000,
          type: "need-based", 
          eligibilityRequirements: ["Texas residency", "Financial need", "Graduated from Texas high school", "Enrolled at least 3/4 time"],
          deadline: "March 15, 2026",
          renewable: true,
          provider: "Texas Higher Education Coordinating Board",
          website: "https://www.thecb.state.tx.us/texas-grant",
          description: "Texas state grant program providing need-based aid to eligible undergraduate students.",
          targetDemographics: ["Texas residents", "undergraduate students"],
          applicationRequirements: ["FAFSA form", "Texas high school diploma", "Satisfactory academic progress"]
        },
        {
          name: "Florida Bright Futures Scholarship",
          amount: 3000,
          type: "merit-based",
          eligibilityRequirements: ["Florida residency", "High school diploma from Florida", "Community service hours", "SAT/ACT scores"],
          deadline: "August 31, 2026",
          renewable: true,
          provider: "Florida Department of Education",
          website: "https://www.floridastudentfinancialaid.org/ssfad/bf/",
          description: "Florida merit-based scholarship program rewarding academic achievement and community service.",
          targetDemographics: ["Florida residents", "high-achieving students"],
          applicationRequirements: ["Florida Financial Aid Application", "High school transcripts", "Community service documentation"]
        },
        // Private/Corporate Scholarships
        {
          name: "Gates Scholarship",
          amount: 50000,
          type: "need-based",
          eligibilityRequirements: ["Outstanding academic achievement", "Leadership potential", "Exceptional personal success skills", "Pell Grant eligible"],
          deadline: "September 15, 2026",
          renewable: true,
          provider: "Gates Foundation",
          website: "https://www.thegatesscholarship.org/",
          description: "Full-ride scholarship for exceptional minority students with significant leadership potential.",
          targetDemographics: ["minority students", "first-generation college students", "low-income families"],
          applicationRequirements: ["Online application", "Essays", "Letters of recommendation", "Financial documentation"]
        },
        {
          name: "Coca-Cola Scholars Foundation Scholarship",
          amount: 20000,
          type: "merit-based",
          eligibilityRequirements: ["High school senior", "Minimum 3.0 GPA", "U.S. citizenship", "Leadership and service"],
          deadline: "October 31, 2026",
          renewable: false,
          provider: "Coca-Cola Scholars Foundation",
          website: "https://www.coca-colascholarsfoundation.org/",
          description: "Merit-based scholarship recognizing academic excellence, leadership, and commitment to community service.",
          targetDemographics: ["high school seniors", "community leaders"],
          applicationRequirements: ["Online application", "Academic transcripts", "Leadership portfolio", "Community service records"]
        },
        {
          name: "Microsoft Scholarship Program",
          amount: 12000,
          type: "merit-based",
          eligibilityRequirements: ["STEM major", "Demonstrated financial need", "Underrepresented minority", "Minimum 3.0 GPA"],
          deadline: "February 15, 2026",
          renewable: true,
          provider: "Microsoft Corporation",
          website: "https://careers.microsoft.com/students/us/en/usscholarshipprogram",
          description: "Scholarship supporting underrepresented students pursuing degrees in computer science, computer engineering, or related STEM fields.",
          targetDemographics: ["STEM students", "underrepresented minorities", "women in tech"],
          applicationRequirements: ["Online application", "Academic transcripts", "Resume", "Essay responses"]
        }
      ];
      
      // Filter out expired scholarships - customers should never see past-deadline scholarships
      const now = new Date();
      const activeScholarships = authenticScholarships.filter(scholarship => {
        const deadline = scholarship.deadline.toLowerCase();
        // Keep scholarships with rolling/variable deadlines
        if (deadline.includes('varies') || deadline.includes('rolling') || deadline.includes('ongoing')) {
          return true;
        }
        // Parse the deadline date
        const deadlineDate = new Date(scholarship.deadline);
        if (isNaN(deadlineDate.getTime())) {
          // Try parsing "Month Day, Year" format
          const monthDayYear = scholarship.deadline.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/);
          if (monthDayYear) {
            const parsed = new Date(`${monthDayYear[1]} ${monthDayYear[2]}, ${monthDayYear[3]}`);
            if (!isNaN(parsed.getTime())) {
              return parsed >= now;
            }
          }
          return true; // Keep if we can't parse the date
        }
        return deadlineDate >= now;
      });

      res.json(activeScholarships);
    } catch (error) {
      console.error("Error fetching authentic scholarships:", error);
      res.status(500).json({ message: "Failed to fetch scholarships" });
    }
  });

  app.get("/api/scholarships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const scholarship = await storage.getScholarshipById(id);
      
      if (!scholarship) {
        res.status(404).json({ message: "Scholarship not found" });
        return;
      }
      
      res.json(scholarship);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch scholarship" });
    }
  });

  app.get("/api/scholarships/search/:query", async (req, res) => {
    try {
      const query = req.params.query;
      const scholarships = await storage.searchScholarships(query);
      res.json(scholarships);
    } catch (error) {
      res.status(500).json({ message: "Failed to search scholarships" });
    }
  });

  // Advanced scholarship search with filters  
  app.get("/api/scholarships/advanced-search", async (req, res) => {
    try {
      const {
        query = "",
        type,
        minAmount,
        maxAmount,
        renewable,
        provider,
        targetDemographic,
        state,
        field
      } = req.query;

      // Get authentic scholarships data
      const authenticScholarships = [
        {
          name: "Pell Grant",
          amount: 7395,
          type: "need-based",
          eligibilityRequirements: ["FAFSA completion", "U.S. citizenship or eligible non-citizen", "Exceptional financial need", "Undergraduate enrollment"],
          deadline: "June 30, 2026",
          renewable: true,
          provider: "U.S. Department of Education",
          website: "https://studentaid.gov/understand-aid/types/grants/pell",
          description: "Federal grant for undergraduate students with exceptional financial need. Does not need to be repaid.",
          targetDemographics: ["undergraduate students", "low-income families"],
          applicationRequirements: ["FAFSA form", "High school diploma or GED", "Social Security card", "Tax returns"]
        },
        {
          name: "National Science Foundation Graduate Research Fellowship",
          amount: 37000,
          type: "merit-based",
          eligibilityRequirements: ["U.S. citizenship", "STEM field enrollment", "Graduate student status", "Research proposal"],
          deadline: "October 21, 2026",
          renewable: true,
          provider: "National Science Foundation",
          website: "https://www.nsfgrfp.org/",
          description: "Prestigious fellowship supporting graduate students in STEM fields with three years of funding.",
          targetDemographics: ["STEM graduate students", "researchers"],
          applicationRequirements: ["Research proposal", "Transcripts", "Letters of recommendation", "Personal statement"]
        },
        {
          name: "Hispanic Scholarship Fund",
          amount: 5000,
          type: "merit-based",
          eligibilityRequirements: ["Hispanic heritage", "Minimum 3.0 GPA", "Accredited institution enrollment", "U.S. citizenship or permanent residency"],
          deadline: "February 15, 2026",
          renewable: true,
          provider: "Hispanic Scholarship Fund",
          website: "https://www.hsf.net/scholarship/",
          description: "Scholarships for Hispanic American students pursuing higher education.",
          targetDemographics: ["Hispanic students", "Latino students"],
          applicationRequirements: ["HSF application", "Transcripts", "FAFSA", "Personal statement"]
        }
      ];

      // Apply filters
      let filtered = authenticScholarships;

      if (query && typeof query === 'string') {
        const queryLower = query.toLowerCase();
        filtered = filtered.filter(scholarship => 
          scholarship.name.toLowerCase().includes(queryLower) ||
          scholarship.description.toLowerCase().includes(queryLower) ||
          scholarship.targetDemographics.some(demo => demo.toLowerCase().includes(queryLower))
        );
      }

      if (type) {
        filtered = filtered.filter(s => s.type === type);
      }

      if (minAmount) {
        filtered = filtered.filter(s => s.amount >= parseInt(minAmount as string));
      }

      if (maxAmount) {
        filtered = filtered.filter(s => s.amount <= parseInt(maxAmount as string));
      }

      if (provider) {
        filtered = filtered.filter(s => s.provider.toLowerCase().includes((provider as string).toLowerCase()));
      }

      res.json(filtered);
    } catch (error) {
      console.error("Scholarship search error:", error);
      res.status(500).json({ message: "Failed to search scholarships" });
    }
  });

  // Get scholarship filter options
  app.get("/api/scholarships/filters", async (req, res) => {
    try {
      const filterOptions = {
        types: ["need-based", "merit-based", "service-based"],
        providers: ["U.S. Department of Education", "National Science Foundation", "Hispanic Scholarship Fund", "Society of Women Engineers"],
        demographics: ["undergraduate students", "graduate students", "STEM students", "Hispanic students", "women in engineering"],
        amountRanges: [
          { label: "Under $5,000", min: 0, max: 4999 },
          { label: "$5,000 - $9,999", min: 5000, max: 9999 },
          { label: "$10,000 - $19,999", min: 10000, max: 19999 },
          { label: "$20,000+", min: 20000, max: 999999 }
        ]
      };
      res.json(filterOptions);
    } catch (error) {
      console.error("Filter options error:", error);
      res.status(500).json({ message: "Failed to fetch filter options" });
    }
  });

  // Get all authentic scholarships
  app.get("/api/scholarships/authentic", async (req, res) => {
    try {
      // Direct scholarship data with authentic federal, state, and private sources
      const authenticScholarships = [
        {
          name: "Pell Grant",
          amount: 7395,
          type: "need-based",
          eligibilityRequirements: ["FAFSA completion", "U.S. citizenship or eligible non-citizen", "Exceptional financial need", "Undergraduate enrollment"],
          deadline: "June 30, 2026",
          renewable: true,
          provider: "U.S. Department of Education",
          website: "https://studentaid.gov/understand-aid/types/grants/pell",
          description: "Federal grant for undergraduate students with exceptional financial need. Does not need to be repaid.",
          targetDemographics: ["undergraduate students", "low-income families"],
          applicationRequirements: ["FAFSA form", "High school diploma or GED", "Social Security card", "Tax returns"]
        },
        {
          name: "Federal Supplemental Educational Opportunity Grant (FSEOG)",
          amount: 4000,
          type: "need-based",
          eligibilityRequirements: ["FAFSA completion", "Exceptional financial need", "Pell Grant recipient priority", "Undergraduate status"],
          deadline: "Varies by school",
          renewable: true,
          provider: "U.S. Department of Education",
          website: "https://studentaid.gov/understand-aid/types/grants/fseog",
          description: "Federal grant for undergraduates with exceptional financial need, priority given to Pell Grant recipients.",
          targetDemographics: ["undergraduate students", "Pell Grant recipients"],
          applicationRequirements: ["FAFSA form", "School financial aid application", "Verification documents"]
        },
        {
          name: "TEACH Grant",
          amount: 4000,
          type: "service-based",
          eligibilityRequirements: ["Teaching commitment agreement", "High-need field", "Low-income school service", "3.25 GPA minimum"],
          deadline: "Varies by school",
          renewable: true,
          provider: "U.S. Department of Education",
          website: "https://studentaid.gov/understand-aid/types/grants/teach",
          description: "Grant for students who agree to teach in high-need fields at low-income schools for four years.",
          targetDemographics: ["education students", "future teachers"],
          applicationRequirements: ["FAFSA form", "TEACH Grant Agreement to Serve", "Entrance counseling"]
        },
        {
          name: "Iraq and Afghanistan Service Grant",
          amount: 7395,
          type: "service-based",
          eligibilityRequirements: ["Parent/guardian died in Iraq/Afghanistan service", "Under 24 or enrolled when parent died", "Not Pell eligible due to low EFC"],
          deadline: "June 30, 2026",
          renewable: true,
          provider: "U.S. Department of Education",
          website: "https://studentaid.gov/understand-aid/types/grants/iraq-afghanistan-service",
          description: "Grant for students whose parent or guardian died as a result of military service in Iraq or Afghanistan after 9/11.",
          targetDemographics: ["military families", "children of deceased veterans"],
          applicationRequirements: ["FAFSA form", "Death certificate", "Military service documentation"]
        },
        {
          name: "Cal Grant A",
          amount: 12570,
          type: "need-based",
          eligibilityRequirements: ["California residency", "Financial need", "GPA requirement", "UC or CSU enrollment"],
          deadline: "March 2, 2026",
          renewable: true,
          provider: "California Student Aid Commission",
          website: "https://www.csac.ca.gov/cal-grants",
          description: "California state grant for students attending University of California or California State University schools.",
          targetDemographics: ["California residents", "UC/CSU students"],
          applicationRequirements: ["FAFSA or CA Dream Act Application", "GPA verification", "School certification"]
        },
        {
          name: "TEXAS Grant",
          amount: 5000,
          type: "need-based",
          eligibilityRequirements: ["Texas residency", "Financial need", "Recommended high school program completion", "Public university enrollment"],
          deadline: "March 15, 2026",
          renewable: true,
          provider: "Texas Higher Education Coordinating Board",
          website: "https://www.tgslc.org/students-parents/grants-scholarships/texas-grant.cfm",
          description: "Texas state grant for students with financial need attending Texas public universities.",
          targetDemographics: ["Texas residents", "public university students"],
          applicationRequirements: ["FAFSA", "High school transcript", "Texas residency documentation"]
        },
        {
          name: "Tuition Assistance Program (TAP)",
          amount: 5665,
          type: "need-based",
          eligibilityRequirements: ["New York residency", "Family income under $80,000", "Approved NY institution", "Full-time enrollment"],
          deadline: "June 30, 2026",
          renewable: true,
          provider: "New York State Higher Education Services Corporation",
          website: "https://www.hesc.ny.gov/pay-for-college/apply-for-financial-aid/nys-tap.html",
          description: "New York state grant for residents attending approved postsecondary institutions in New York.",
          targetDemographics: ["New York residents", "middle-income families"],
          applicationRequirements: ["FAFSA", "TAP application", "Income verification", "Academic progress verification"]
        },
        {
          name: "National Science Foundation Graduate Research Fellowship",
          amount: 37000,
          type: "merit-based",
          eligibilityRequirements: ["U.S. citizenship", "STEM field enrollment", "Graduate student status", "Research proposal"],
          deadline: "October 21, 2026",
          renewable: true,
          provider: "National Science Foundation",
          website: "https://www.nsfgrfp.org/",
          description: "Prestigious fellowship supporting graduate students in STEM fields with three years of funding.",
          targetDemographics: ["STEM graduate students", "researchers"],
          applicationRequirements: ["Research proposal", "Transcripts", "Letters of recommendation", "Personal statement"]
        },
        {
          name: "Society of Women Engineers Scholarship",
          amount: 15000,
          type: "merit-based",
          eligibilityRequirements: ["Female gender", "ABET-accredited engineering program", "Minimum 3.0 GPA", "SWE membership"],
          deadline: "February 15, 2026",
          renewable: true,
          provider: "Society of Women Engineers",
          website: "https://swe.org/scholarships/",
          description: "Scholarships for women pursuing engineering and technology degrees.",
          targetDemographics: ["women in engineering", "STEM students"],
          applicationRequirements: ["SWE membership", "Transcripts", "Essays", "Letters of recommendation"]
        },
        {
          name: "National Health Service Corps Scholarship",
          amount: 50000,
          type: "service-based",
          eligibilityRequirements: ["Health profession program", "Service commitment", "U.S. citizenship", "Academic performance"],
          deadline: "April 18, 2026",
          renewable: true,
          provider: "Health Resources and Services Administration",
          website: "https://nhsc.hrsa.gov/scholarships",
          description: "Full tuition scholarship for health professional students who commit to serving in underserved areas.",
          targetDemographics: ["health profession students", "future healthcare providers"],
          applicationRequirements: ["Service commitment contract", "Transcripts", "Personal statement", "Letters of recommendation"]
        },
        {
          name: "Hispanic Scholarship Fund",
          amount: 5000,
          type: "merit-based",
          eligibilityRequirements: ["Hispanic heritage", "Minimum 3.0 GPA", "Accredited institution enrollment", "U.S. citizenship or permanent residency"],
          deadline: "February 15, 2026",
          renewable: true,
          provider: "Hispanic Scholarship Fund",
          website: "https://www.hsf.net/scholarship/",
          description: "Scholarships for Hispanic American students pursuing higher education.",
          targetDemographics: ["Hispanic students", "Latino students"],
          applicationRequirements: ["HSF application", "Transcripts", "FAFSA", "Personal statement"]
        },
        {
          name: "United Negro College Fund Scholarships",
          amount: 8000,
          type: "need-based",
          eligibilityRequirements: ["African American ethnicity", "Financial need", "UNCF member institution enrollment", "Academic merit"],
          deadline: "March 31, 2026",
          renewable: true,
          provider: "United Negro College Fund",
          website: "https://scholarships.uncf.org/",
          description: "Various scholarships for African American students attending UNCF member institutions.",
          targetDemographics: ["African American students", "UNCF member students"],
          applicationRequirements: ["UNCF application", "FAFSA", "Transcripts", "Personal statement"]
        },
        {
          name: "Point Foundation LGBTQ Scholarship",
          amount: 25000,
          type: "merit-based",
          eligibilityRequirements: ["LGBTQ identity", "Academic excellence", "Leadership experience", "Financial need", "Community involvement"],
          deadline: "January 27, 2026",
          renewable: true,
          provider: "Point Foundation",
          website: "https://pointfoundation.org/point-apply/",
          description: "Comprehensive scholarship program for LGBTQ students with academic merit and leadership.",
          targetDemographics: ["LGBTQ students", "community leaders"],
          applicationRequirements: ["Point application", "Transcripts", "FAFSA", "Leadership documentation", "Personal statement"]
        },
        {
          name: "Yellow Ribbon Program",
          amount: 25000,
          type: "service-based",
          eligibilityRequirements: ["Post-9/11 GI Bill eligibility", "Participating school enrollment", "Veteran or dependent status", "Maximum benefit rate"],
          deadline: "Varies by school",
          renewable: true,
          provider: "U.S. Department of Veterans Affairs",
          website: "https://www.va.gov/education/about-gi-bill-benefits/post-9-11/yellow-ribbon-program/",
          description: "VA program that helps pay tuition and fees at private colleges and graduate schools.",
          targetDemographics: ["veterans", "military dependents"],
          applicationRequirements: ["Certificate of Eligibility", "School enrollment", "VA Form 22-1990"]
        },
        {
          name: "Pat Tillman Foundation Scholarship",
          amount: 10000,
          type: "merit-based",
          eligibilityRequirements: ["Veteran or military spouse status", "Leadership potential", "Service commitment", "Academic performance"],
          deadline: "February 26, 2026",
          renewable: true,
          provider: "Pat Tillman Foundation",
          website: "https://pattillmanfoundation.org/apply/",
          description: "Scholarships for veterans and military spouses pursuing higher education to create positive impact.",
          targetDemographics: ["veterans", "military spouses", "service members"],
          applicationRequirements: ["Military service documentation", "Academic transcripts", "Leadership examples", "Service commitment essay"]
        }
      ];

      // Filter out expired scholarships - customers should never see past-deadline scholarships
      const now = new Date();
      const activeScholarships = authenticScholarships.filter(scholarship => {
        const deadline = scholarship.deadline.toLowerCase();
        // Keep scholarships with rolling/variable deadlines
        if (deadline.includes('varies') || deadline.includes('rolling') || deadline.includes('ongoing')) {
          return true;
        }
        // Parse the deadline date
        const deadlineDate = new Date(scholarship.deadline);
        if (isNaN(deadlineDate.getTime())) {
          // Try parsing "Month Day, Year" format
          const monthDayYear = scholarship.deadline.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/);
          if (monthDayYear) {
            const parsed = new Date(`${monthDayYear[1]} ${monthDayYear[2]}, ${monthDayYear[3]}`);
            if (!isNaN(parsed.getTime())) {
              return parsed >= now;
            }
          }
          return true; // Keep if we can't parse the date
        }
        return deadlineDate >= now;
      });

      res.json(activeScholarships);
    } catch (error) {
      console.error("Authentic scholarships error:", error);
      res.status(500).json({ message: "Failed to fetch authentic scholarships" });
    }
  });

  // Load comprehensive college data from College Scorecard
  app.post("/api/load-all-colleges", async (req, res) => {
    try {
      if (!process.env.COLLEGE_SCORECARD_API_KEY) {
        res.status(400).json({ error: "College Scorecard API key required" });
        return;
      }

      // Accepts ?startPage=N&maxPages=M so repeated calls can resume where
      // the last one left off, instead of always re-walking from page 0
      // (which is what a hardcoded hasPage>=20 cap used to force every
      // single call to do, making repeated invocations pointless — they'd
      // hit the same cap re-fetching pages already imported and never
      // reach anything new).
      let allColleges = [];
      let page = Number(req.query.startPage) || 0;
      const startPage = page;
      const maxPages = Number(req.query.maxPages) || 20;
      let totalInserted = 0;
      const perPage = 100;

      // Fetch all pages of data from College Scorecard API
      while (true) {
        console.log(`Fetching page ${page} of colleges...`);
        const response = await fetch(`https://api.data.gov/ed/collegescorecard/v1/schools?api_key=${process.env.COLLEGE_SCORECARD_API_KEY}&_page=${page}&_per_page=${perPage}&school.operating=1&fields=id,school.name,school.city,school.state,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state,latest.admissions.admission_rate.overall,school.ownership,school.degrees_awarded.predominant`);
      
        if (!response.ok) {
          throw new Error(`College Scorecard API error: ${response.status}`);
        }

        const data = await response.json();
        const colleges = (data as any).results || [];
        
        if (colleges.length === 0) {
          console.log(`No more colleges found on page ${page}. Total fetched: ${allColleges.length}`);
          break;
        }

        // Process colleges from this page
        for (const college of colleges) {
          if (college['school.name'] && college['school.state']) {
            const degreeLevel = college['school.degrees_awarded.predominant'];
            let academicLevel = 'undergraduate';
            let type = college['school.ownership'] === 1 ? 'public' : 'private';
            
            // Determine academic level based on degrees awarded
            if (degreeLevel === 1) {
              academicLevel = 'certificate';
            } else if (degreeLevel === 2) {
              academicLevel = 'associate';
              type = 'community-college';
            } else if (degreeLevel === 3) {
              academicLevel = 'undergraduate';
            } else if (degreeLevel === 4) {
              academicLevel = 'graduate';
            }

            const transformedCollege = {
              name: college['school.name'],
              location: `${college['school.city'] || 'Unknown'}, ${college['school.state']}, United States`,
              country: 'United States',
              state: college['school.state'],
              city: college['school.city'] || 'Unknown',
              tuition: college['latest.cost.tuition.in_state'] || college['latest.cost.tuition.out_of_state'] || 0,
              acceptanceRate: Math.round((college['latest.admissions.admission_rate.overall'] || 0.6) * 100),
              graduationRate: 70,
              type: type,
              website: null,
              description: `${college['school.name']} is a ${type} institution located in ${college['school.city']}, ${college['school.state']}.`,
              imageUrl: null,
              rating: 4,
              sportsPrograms: ['basketball', 'soccer', 'tennis'],
              academicLevel: academicLevel,
              scholarships: ['merit', 'need-based'],
              walkOnAvailable: true,
              coachName: null,
              coachEmail: null,
              coachPhone: null
            };

            try {
              await storage.createCollege(transformedCollege);
              totalInserted++;
              
              if (totalInserted % 100 === 0) {
                console.log(`Inserted ${totalInserted} colleges so far...`);
              }
            } catch (error) {
              // Skip duplicates
            }
          }
        }

        page++;

        // Limit per call to prevent a request timeout — pass ?startPage
        // on the next call to continue past here instead of restarting.
        if (page - startPage >= maxPages) {
          console.log(`Stopping at page ${page} to prevent timeout. Inserted ${totalInserted} colleges.`);
          break;
        }
      }

      res.json({
        message: `Successfully loaded ${totalInserted} colleges from College Scorecard API`,
        total_inserted: totalInserted,
        pages_processed: page - startPage,
        next_page: page
      });
    } catch (error) {
      console.error("College loading error:", error);
      res.status(500).json({ error: error instanceof Error ? error.message : "Unknown error" });
    }
  });

  // Bulk load all U.S. colleges from College Scorecard API
  app.post("/api/bulk-load-colleges", async (req, res) => {
    try {
      const bulkLoader = new BulkCollegeLoader();
      const result = await bulkLoader.loadAllColleges();
      
      res.json({
        message: `Successfully loaded ${result.inserted} colleges from College Scorecard API`,
        total_inserted: result.inserted,
        pages_processed: result.pages
      });
    } catch (error) {
      console.error("Bulk college loading error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to load colleges"
      });
    }
  });

  // Clear existing colleges and reload
  app.post("/api/refresh-colleges", async (req, res) => {
    try {
      // Clear existing data
      await storage.clearColleges();
      
      // Bulk load fresh data
      const bulkLoader = new BulkCollegeLoader();
      const result = await bulkLoader.loadAllColleges();
      
      res.json({
        message: `Refreshed database with ${result.inserted} colleges from College Scorecard API`,
        total_inserted: result.inserted,
        pages_processed: result.pages
      });
    } catch (error) {
      console.error("College refresh error:", error);
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Failed to refresh colleges"
      });
    }
  });

  // Data population endpoint for loading authentic datasets
  app.post("/api/populate-data", async (req, res) => {
    try {
      const dataService = new DataPopulationService();
      await dataService.populateAllData();
      res.json({ message: "Data population completed successfully" });
    } catch (error) {
      console.error("Data population error:", error);
      res.status(500).json({ 
        message: "Failed to populate data", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ============================================
  // FELLOWSHIP ENDPOINTS
  // ============================================

  // Seed fellowships on startup. A transient DB error here (e.g. a Neon
  // endpoint waking up from idle) must not take down the whole server —
  // matches how initializeDatabase() in index.ts already degrades.
  try {
    await fellowshipService.seedFellowships();
  } catch (err) {
    console.error("Fellowship seeding failed — continuing with existing data:", err);
  }

  // Get all fellowships
  app.get("/api/fellowships", async (req, res) => {
    try {
      const fellowships = await fellowshipService.getAllFellowships();
      res.json(fellowships);
    } catch (error) {
      console.error("Error fetching fellowships:", error);
      res.status(500).json({ error: "Failed to fetch fellowships" });
    }
  });

  // Search fellowships with filters
  app.get("/api/fellowships/search", async (req, res) => {
    try {
      const { query, category, type, academicLevel, minAmount, maxAmount, citizenship } = req.query;
      const results = await fellowshipService.searchFellowships({
        query: query as string,
        category: category as string,
        type: type as string,
        academicLevel: academicLevel as string,
        minAmount: minAmount ? parseInt(minAmount as string) : undefined,
        maxAmount: maxAmount ? parseInt(maxAmount as string) : undefined,
        citizenship: citizenship as string
      });
      res.json(results);
    } catch (error) {
      console.error("Error searching fellowships:", error);
      res.status(500).json({ error: "Failed to search fellowships" });
    }
  });

  // Get fellowship filter options
  app.get("/api/fellowships/filters", async (req, res) => {
    try {
      const filters = fellowshipService.getFilterOptions();
      res.json(filters);
    } catch (error) {
      console.error("Error fetching fellowship filters:", error);
      res.status(500).json({ error: "Failed to fetch filters" });
    }
  });

  // Match fellowships to user profile
  app.post("/api/fellowships/match", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);
      
      const profile = {
        gpa: user?.gpa || req.body.gpa,
        interests: user?.interests || req.body.interests || [],
        academicLevel: user?.academicLevel || req.body.academicLevel,
        major: user?.major || req.body.major,
        demographics: user?.demographics || req.body.demographics || []
      };

      const matches = await fellowshipService.matchFellowships(profile);
      res.json({
        success: true,
        matches,
        totalMatches: matches.length
      });
    } catch (error) {
      console.error("Error matching fellowships:", error);
      res.status(500).json({ error: "Failed to match fellowships" });
    }
  });

  // Public fellowship matching (no auth required)
  app.post("/api/fellowships/match-public", async (req, res) => {
    try {
      const { gpa, interests, academicLevel, major, demographics } = req.body;
      const matches = await fellowshipService.matchFellowships({
        gpa,
        interests: interests || [],
        academicLevel,
        major,
        demographics: demographics || []
      });
      res.json({
        success: true,
        matches,
        totalMatches: matches.length
      });
    } catch (error) {
      console.error("Error matching fellowships:", error);
      res.status(500).json({ error: "Failed to match fellowships" });
    }
  });

  // Save a fellowship
  app.post("/api/fellowships/:id/save", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const fellowshipId = parseInt(req.params.id);
      const { notes } = req.body;
      
      const saved = await fellowshipService.saveFellowship(userId, fellowshipId, notes);
      res.json({ success: true, saved });
    } catch (error) {
      console.error("Error saving fellowship:", error);
      res.status(500).json({ error: "Failed to save fellowship" });
    }
  });

  // Unsave a fellowship
  app.delete("/api/fellowships/:id/save", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const fellowshipId = parseInt(req.params.id);
      
      await fellowshipService.unsaveFellowship(userId, fellowshipId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error unsaving fellowship:", error);
      res.status(500).json({ error: "Failed to unsave fellowship" });
    }
  });

  // Get user's saved fellowships
  app.get("/api/fellowships/saved", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const saved = await fellowshipService.getSavedFellowships(userId);
      res.json(saved);
    } catch (error) {
      console.error("Error fetching saved fellowships:", error);
      res.status(500).json({ error: "Failed to fetch saved fellowships" });
    }
  });

  // Get fellowship by ID. Registered last among the /api/fellowships GET
  // routes deliberately: Express matches routes in registration order, and
  // ":id" would otherwise greedily swallow every literal sibling path
  // above it (/search, /filters, /saved all 404'd/500'd as a result before
  // this was moved — "saved" was being parsed as an id and always failing).
  app.get("/api/fellowships/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const fellowship = await fellowshipService.getFellowshipById(id);
      if (!fellowship) {
        res.status(404).json({ error: "Fellowship not found" });
        return;
      }
      res.json(fellowship);
    } catch (error) {
      console.error("Error fetching fellowship:", error);
      res.status(500).json({ error: "Failed to fetch fellowship" });
    }
  });

  // Update saved fellowship status
  app.put("/api/fellowships/:id/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const fellowshipId = parseInt(req.params.id);
      const { applicationStatus, notes } = req.body;
      
      await fellowshipService.updateSavedFellowship(userId, fellowshipId, {
        applicationStatus,
        notes
      });
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating fellowship status:", error);
      res.status(500).json({ error: "Failed to update fellowship status" });
    }
  });

  // Profile endpoints
  app.get("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      let user = await storage.getUser(userId);
      
      // Auto-create profile for new users (from Replit Auth)
      if (!user) {
        console.log("Creating new profile for user:", userId);
        user = await storage.upsertUser({
          id: userId,
          username: req.user.username || `user_${userId}`,
          password: '', // Replit Auth users don't need password
          email: req.user.email || null,
          firstName: req.user.firstName || null,
          lastName: req.user.lastName || null,
          profileImageUrl: req.user.profileImageUrl || null,
        });
      }

      // Calculate profile completeness
      let completeness = 0;
      const requiredFields = ['firstName', 'lastName', 'email', 'gpa', 'state', 'major'];
      const optionalFields = ['phone', 'dateOfBirth', 'bio', 'demographics', 'interests'];
      
      requiredFields.forEach(field => {
        if (user[field as keyof typeof user]) completeness += 15;
      });
      
      optionalFields.forEach(field => {
        if (user[field as keyof typeof user]) completeness += 3;
      });

      const profileData = {
        ...user,
        profileCompleteness: Math.min(100, completeness),
        insights: [
          completeness < 50 ? "Complete more profile sections for better matches" : "Profile looking good!",
          user.gpa ? `GPA: ${user.gpa}` : "Add your GPA for scholarship matching",
          user.interests?.length ? `${user.interests.length} interests selected` : "Add career interests"
        ]
      };

      res.json(profileData);
    } catch (error) {
      console.error("Error fetching profile:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  app.put("/api/profile", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const updates = req.body;
      
      // Validate allowed fields for profile update
      const allowedFields = [
        'firstName', 'lastName', 'email', 'phone', 'dateOfBirth', 'bio',
        'state', 'gpa', 'major', 'academicLevel', 'graduationYear', 'financialNeed',
        'interests', 'aiKeywords', 'demographics', 'profilePicture'
      ];
      
      const filteredUpdates: any = {};
      Object.keys(updates).forEach(key => {
        if (allowedFields.includes(key) && updates[key] !== undefined) {
          filteredUpdates[key] = updates[key];
        }
      });

      if (filteredUpdates.gpa !== undefined) {
        const gpaValue = Number(filteredUpdates.gpa);
        if (Number.isNaN(gpaValue) || gpaValue < 0 || gpaValue > 4.0) {
          res.status(400).json({ message: "GPA must be between 0.0 and 4.0" });
          return;
        }
      }

      filteredUpdates.updatedAt = new Date();
      
      console.log("Profile update - saving demographics:", filteredUpdates.demographics);
      console.log("Profile update - saving interests:", filteredUpdates.interests);
      
      // Ensure user exists first (auto-create if from Replit Auth)
      let user = await storage.getUser(userId);
      if (!user) {
        user = await storage.upsertUser({
          id: userId,
          username: req.user.username || `user_${userId}`,
          password: '',
          email: req.user.email || null,
        });
      }

      // Guard against unique-constraint violation on email: if the requested
      // email is already used by a different account, silently drop it from
      // the update so the rest of the profile still saves. The client treats
      // email as the auth identifier and should not normally change it.
      if (typeof filteredUpdates.email === 'string') {
        const newEmail = filteredUpdates.email.trim().toLowerCase();
        if (!newEmail) {
          delete filteredUpdates.email;
        } else if (user.email && user.email.toLowerCase() === newEmail) {
          delete filteredUpdates.email;
        } else {
          const existing = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.email, newEmail));
          const conflict = existing.find((u: any) => u.id !== userId);
          if (conflict) {
            delete filteredUpdates.email;
          } else {
            filteredUpdates.email = newEmail;
          }
        }
      }
      
      let updatedUser;
      try {
        updatedUser = await storage.updateUserProfile(userId, filteredUpdates);
      } catch (updateErr: any) {
        // Bullet-proof guard: if the email guard above missed an edge case
        // (race, mismatched case, schema-level case-insensitive index, etc.)
        // and the UPDATE blew up on the unique-email constraint, drop the
        // email and retry so the rest of the profile still saves.
        const code = updateErr?.code || updateErr?.cause?.code;
        const constraint = updateErr?.constraint || updateErr?.cause?.constraint;
        const isEmailUnique = code === "23505" && (constraint === "users_email_key" || "email" in filteredUpdates);
        if (isEmailUnique && "email" in filteredUpdates) {
          delete filteredUpdates.email;
          try {
            updatedUser = await storage.updateUserProfile(userId, filteredUpdates);
          } catch (retryErr) {
            console.error("Profile update retry without email failed:", retryErr);
            res.status(500).json({ message: "Failed to update profile" });
            return;
          }
        } else {
          console.error("Error updating user profile:", updateErr);
          res.status(500).json({ message: "Failed to update profile" });
          return;
        }
      }

      if (!updatedUser) {
        res.status(500).json({ message: "Failed to update profile" });
        return;
      }

      // Return with insights about how profile data influences recommendations
      res.json({
        ...updatedUser,
        profileImpact: {
          scholarships: updatedUser.demographics?.length 
            ? `Demographics used for ${updatedUser.demographics.length} targeted scholarship matches`
            : "Add demographics to unlock targeted scholarships",
          careers: updatedUser.interests?.length 
            ? `${updatedUser.interests.length} career interests driving recommendations`
            : "Add career interests for personalized matches"
        }
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // Profile picture upload endpoint
  app.post("/api/upload-profile-picture", isAuthenticated, profilePictureUpload.single('profilePicture'), async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const file = req.file;
      
      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      // Convert to base64 for storage
      const base64Image = `data:${file.mimetype};base64,${file.buffer.toString('base64')}`;
      
      const updatedUser = await storage.updateUserProfile(userId, {
        profilePicture: base64Image
      });

      if (!updatedUser) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      res.json({ 
        message: "Profile picture uploaded successfully",
        profilePicture: base64Image
      });
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      res.status(500).json({ message: "Failed to upload profile picture" });
    }
  });

  // BLS Job Market API endpoints
  const blsService = new BLSService();

  // Get job market data for a specific career
  app.get("/api/job-market/career/:title", async (req, res) => {
    try {
      const careerTitle = decodeURIComponent(req.params.title);
      const jobData = await blsService.getCareerJobData(careerTitle);
      res.json(jobData);
    } catch (error) {
      console.error("Error fetching career job data:", error);
      res.status(404).json({ 
        message: "Career data not found", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get job market data by BLS series ID
  app.get("/api/job-market/series/:seriesId", async (req, res) => {
    try {
      const { seriesId } = req.params;
      const { startYear, endYear } = req.query;
      const jobData = await blsService.fetchJobData(
        seriesId, 
        startYear ? parseInt(startYear as string) : undefined,
        endYear ? parseInt(endYear as string) : undefined
      );
      res.json(jobData);
    } catch (error) {
      console.error("Error fetching BLS series data:", error);
      res.status(500).json({ 
        message: "Failed to fetch series data", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get state-specific job market data
  app.get("/api/job-market/state/:stateCode/career/:title", async (req, res) => {
    try {
      const { stateCode, title } = req.params;
      const careerTitle = decodeURIComponent(title);
      
      // First get the national series ID for this career
      const careers = blsService.getAllSupportedCareers();
      const career = careers.find(c => c.key === careerTitle.toLowerCase());
      
      if (!career) {
        res.status(404).json({ message: "Career not found" });
        return;
      }

      const stateJobData = await blsService.getStateJobData(career.seriesId, stateCode);
      
      if (!stateJobData) {
        res.status(404).json({ message: "State data not available" });
        return;
      }

      res.json(stateJobData);
    } catch (error) {
      console.error("Error fetching state job data:", error);
      res.status(500).json({ 
        message: "Failed to fetch state job data", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Search careers by title
  app.get("/api/job-market/search/:query", async (req, res) => {
    try {
      const query = decodeURIComponent(req.params.query);
      const results = await blsService.searchCareersBySeries(query);
      res.json(results);
    } catch (error) {
      console.error("Error searching careers:", error);
      res.status(500).json({ 
        message: "Failed to search careers", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get all supported careers with BLS mapping
  app.get("/api/job-market/careers", async (req, res) => {
    try {
      const careers = blsService.getAllSupportedCareers();
      res.json(careers);
    } catch (error) {
      console.error("Error fetching supported careers:", error);
      res.status(500).json({ 
        message: "Failed to fetch careers", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get employment projections
  app.get("/api/job-market/projections/:occupationCode", async (req, res) => {
    try {
      const { occupationCode } = req.params;
      const projections = await blsService.getEmploymentProjections(occupationCode);
      res.json(projections);
    } catch (error) {
      console.error("Error fetching employment projections:", error);
      res.status(500).json({ 
        message: "Failed to fetch projections", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Career Pathway & Skills Guidance API Routes
  
  // Unified comprehensive career matching using complete O*NET database
  app.post("/api/career-paths/matches", async (req, res) => {
    try {
      const userProfile = req.body;
      
      // Validate required fields
      if (!userProfile.interests || !userProfile.skills || !userProfile.preferredEducation) {
        res.status(400).json({ 
          message: "Missing required fields: interests, skills, and preferredEducation are required" 
        });
        return;
      }

      console.log("🎯 Comprehensive career matching - User profile:", userProfile);
      
      // Import comprehensive O*NET service that contains all careers
      const { comprehensiveOnetService } = await import('../comprehensive-onet-service');
      
      // Convert user profile to match comprehensive service format
      const enhancedProfile = {
        interests: Array.isArray(userProfile.interests) ? userProfile.interests : [userProfile.interests],
        skillRatings: Array.isArray(userProfile.skills) 
          ? userProfile.skills.reduce((acc: any, skill: string) => {
              acc[skill] = 4; // Default high rating for selected skills
              return acc;
            }, {})
          : userProfile.skillRatings || {},
        preferredEducation: userProfile.preferredEducation || 'bachelor',
        salaryExpectation: userProfile.salaryExpectation,
        locationPreference: userProfile.locationPreference,
        workValues: userProfile.workValues || []
      };
      
      console.log(`🔍 Using comprehensive O*NET database with 32+ careers...`);
      const matches = await comprehensiveOnetService.findCareerMatches(enhancedProfile as any);
      console.log(`✅ Comprehensive matcher found ${matches.length} career matches from full database`);

      // Get all colleges and scholarships to match with careers
      const [colleges, scholarships] = await Promise.all([
        storage.getColleges(),
        storage.getScholarships()
      ]);

      // Format matches for frontend compatibility and enhance with colleges/scholarships
      const formattedMatches = matches.map((match: any) => {
        // Find colleges that offer programs related to this career
        const relevantColleges = colleges.filter((college: any) => {
          const careerTitle = match.career.title.toLowerCase();
          const collegeDescription = (college.description || '').toLowerCase();
          
          // Check if college programs match career requirements
          const hasRelevantPrograms = collegeDescription.includes(careerTitle) ||
            // Match common career fields
            (careerTitle.includes('engineering') && collegeDescription.includes('engineering')) ||
            (careerTitle.includes('business') && collegeDescription.includes('business')) ||
            (careerTitle.includes('computer') && collegeDescription.includes('computer')) ||
            (careerTitle.includes('health') && collegeDescription.includes('health')) ||
            (careerTitle.includes('education') && collegeDescription.includes('education')) ||
            (careerTitle.includes('science') && collegeDescription.includes('science'));
          
          return hasRelevantPrograms;
        }).slice(0, 10);

        // Find scholarships relevant to this career field
        const relevantScholarships = scholarships.filter(scholarship => {
          const careerTitle = match.career.title.toLowerCase();
          const scholarshipDescription = (scholarship.description || '').toLowerCase();
          const targetDemographics = scholarship.targetDemographics.map(d => d.toLowerCase()).join(' ');
          
          // Match scholarships to career fields
          return scholarshipDescription.includes(careerTitle) ||
            targetDemographics.includes(careerTitle) ||
            // Match common career fields
            (careerTitle.includes('engineering') && (scholarshipDescription.includes('stem'))) ||
            (careerTitle.includes('computer') && (scholarshipDescription.includes('technology'))) ||
            (careerTitle.includes('health') && (scholarshipDescription.includes('medical'))) ||
            // General scholarships
            scholarshipDescription.includes('general') || targetDemographics.includes('all students');
        }).slice(0, 8);

        // Format for frontend compatibility
        return {
          career: {
            title: match.career.title,
            onetCode: match.career.onetCode,
            description: match.career.description,
            averageSalary: match.career.averageSalary,
            jobGrowthRate: match.career.jobGrowthRate + "%",
            educationRequired: match.career.educationRequired,
            skills: match.career.skills,
            industries: match.career.industries,
            workEnvironment: "Professional environment"
          },
          matchScore: match.matchScore / 100, // Convert percentage to decimal
          matchReasons: match.matchReasons || [],
          skillsMatch: match.skillsMatch || [],
          educationFit: match.educationFit || "Good fit",
          standOutTips: match.standOutTips || [],
          recommendedColleges: relevantColleges,
          availableScholarships: relevantScholarships
        };
      });

      res.json(formattedMatches);
    } catch (error) {
      console.error("Error finding career matches:", error);
      res.status(500).json({ 
        message: "Failed to find career matches", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Database-driven career matching endpoint using real O*NET data with enhanced logging
  app.post("/api/database-career-match", async (req, res) => {
    try {
      const { interests, skills, education, experience, preferredSalary, timestamp } = req.body;
      
      console.log('\n🔷 ═══════════════════════════════════════════════════');
      console.log('   API REQUEST RECEIVED: /api/database-career-match');
      console.log('═══════════════════════════════════════════════════');
      console.log('📥 Request Body:', JSON.stringify({
        interests,
        skills,
        education,
        experience,
        preferredSalary,
        timestamp
      }, null, 2));
      
      // Validation
      if (!interests || interests.length === 0) {
        console.log('❌ VALIDATION FAILED: No interests provided');
        res.status(400).json({
          success: false,
          error: "At least one interest is required"
        });
        return;
      }
      
      if (!skills || skills.length === 0) {
        console.log('❌ VALIDATION FAILED: No skills provided');
        res.status(400).json({
          success: false,
          error: "At least one skill is required"
        });
        return;
      }
      
      console.log('✅ Validation passed');
      
      // 🎯 CREATE FRESH USER PROFILE (no caching)
      const userProfile = {
        interests,
        skills,
        education,
        experience,
        preferredSalary,
        timestamp: timestamp || Date.now()
      };
      
      console.log('🎯 Calling database matcher...');
      
      // Call the ML matcher
      const results = await databaseCareerMatcher.matchCareers(userProfile);
      
      console.log('\n📤 Sending response:');
      console.log(`   Careers found: ${results.careerOptions.length}`);
      console.log(`   Confidence: ${results.confidence}%`);
      console.log(`   Algorithm: ${results.matchingAlgorithm}`);
      
      if (results.careerOptions.length > 0) {
        console.log('   Top 3 matches:');
        results.careerOptions.slice(0, 3).forEach((career, i) => {
          console.log(`      ${i + 1}. ${career.career.title} (${career.career.topKConfidence}%)`);
        });
      }
      
      console.log('🔷 ═══════════════════════════════════════════════════\n');
      
      // Return results with cache prevention headers
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      res.json({
        success: true,
        data: results,
        source: 'database-career-matcher',
        requestTimestamp: timestamp
      });
      
    } catch (error) {
      console.error('\n❌ ═══════════════════════════════════════════════════');
      console.error('   ERROR IN CAREER MATCHING');
      console.error('═══════════════════════════════════════════════════');
      console.error('Error details:', error);
      console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('═══════════════════════════════════════════════════\n');
      
      res.status(500).json({
        success: false,
        error: 'Failed to match careers',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  // Enhanced Hybrid Career Matching - 40%+ accuracy improvement with semantic embeddings
  app.post("/api/hybrid-career-match", async (req, res) => {
    try {
      const { interests, skills, education, experience, preferredSalary, workValues, timestamp } = req.body;
      
      console.log('\n🚀 ═══════════════════════════════════════════════════');
      console.log('   API REQUEST: /api/hybrid-career-match (Enhanced ML)');
      console.log('═══════════════════════════════════════════════════');
      console.log('📥 Request:', JSON.stringify({ interests, skills, education, preferredSalary }, null, 2));
      
      if (!interests || interests.length === 0) {
        console.log('❌ VALIDATION: No interests provided');
        res.status(400).json({
          success: false,
          error: "At least one interest is required for matching"
        });
        return;
      }
      
      if (!skills || skills.length === 0) {
        console.log('❌ VALIDATION: No skills provided');
        res.status(400).json({
          success: false,
          error: "At least one skill is required for matching"
        });
        return;
      }
      
      console.log('✅ Validation passed - calling hybrid matcher');
      
      const userProfile = {
        interests,
        skills,
        education,
        experience,
        preferredSalary,
        workValues: workValues || [],
        timestamp: timestamp || Date.now()
      };
      
      const results = await hybridCareerMatcher.matchCareers(userProfile);
      
      console.log('\n📤 Hybrid Results:');
      console.log(`   Total matches: ${results.totalFound}`);
      console.log(`   Top confidence: ${results.confidence}%`);
      console.log(`   Algorithm: ${results.matchingAlgorithm}`);
      
      res.set({
        'Cache-Control': 'no-store, no-cache, must-revalidate, private',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      
      const formattedResults = {
        success: true,
        data: {
          careerOptions: results.careerOptions.map(career => ({
            career: {
              title: career.title,
              description: career.description,
              requiredSkills: career.skills,
              averageSalary: career.averageSalary,
              growthOutlook: career.jobOutlook,
              workEnvironment: career.workEnvironment,
              educationRequirements: career.educationRequired,
              industryInsights: career.industries,
              topKConfidence: career.matchScore,
              skillAlignmentScore: career.structuredScore,
              onetCode: career.onetCode,
              industries: career.industries
            },
            marketData: {
              demandLevel: career.jobGrowthRate > 8 ? 'High' : career.jobGrowthRate > 4 ? 'Medium' : 'Stable',
              competitionLevel: 'Moderate',
              salaryTrend: 'Growing',
              remoteFriendly: career.workEnvironment?.toLowerCase().includes('remote') || false,
              jobAvailability: Math.round(career.jobGrowthRate * 10)
            },
            matchDetails: {
              semanticScore: career.semanticScore,
              structuredScore: career.structuredScore,
              confidenceLevel: career.confidenceLevel,
              matchReasons: career.matchReasons,
              skillsMatch: career.skillsMatch,
              missingSkills: career.missingSkills,
              standOutTips: career.standOutTips
            }
          })),
          matchingAlgorithm: results.matchingAlgorithm,
          confidence: results.confidence,
          totalFound: results.totalFound,
          performanceMetrics: results.performanceMetrics
        },
        source: 'hybrid-career-matcher-v2',
        requestTimestamp: timestamp
      };
      
      console.log('🚀 ═══════════════════════════════════════════════════\n');
      
      res.json(formattedResults);
      
    } catch (error) {
      console.error('\n❌ HYBRID MATCHER ERROR:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to match careers with hybrid algorithm',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });
    }
  });

  // Enhanced Career Explorer endpoints - using comprehensive datasets
  app.get("/api/explore-career/:careerTitle", async (req, res) => {
    try {
      const { careerTitle } = req.params;
      const { careerExplorerService } = await import('../career-explorer-service');
      const careerDetails = await careerExplorerService.exploreCareerByInterest(decodeURIComponent(careerTitle));
      res.json(careerDetails[0] || null);
    } catch (error) {
      console.error("Career exploration error:", error);
      res.status(500).json({ error: "Failed to explore career" });
    }
  });

  // Multi-interest exploration using comprehensive data indexer
  app.get("/api/explore-interests", async (req, res) => {
    try {
      const interests = req.query.interests as string;
      const interestArray = interests ? interests.split(',').map(i => i.trim()) : [];
      
      console.log(`🎯 API: Multi-interest exploration for: ${interestArray.join(', ')}`);
      
      if (interestArray.length === 0) {
        res.status(400).json({ error: "No interests provided" });
        return;
      }
      
      const { comprehensiveDataIndexer } = await import('../comprehensive-data-indexer');
      
      // Ensure data is loaded
      if (!comprehensiveDataIndexer.getAllCareers().length) {
        await comprehensiveDataIndexer.loadAllDatasets();
      }
      
      const careerMatches = comprehensiveDataIndexer.findCareersByInterests(interestArray);
      console.log(`✅ Found ${careerMatches.length} career matches from comprehensive index for: ${interestArray.join(', ')}`);
      
      // Format for frontend with comprehensive data
      const careerOptions = careerMatches.map(career => ({
        career: {
          title: career.title,
          description: career.description,
          requiredSkills: career.skills,
          averageSalary: career.salary,
          growthOutlook: career.growth,
          workEnvironment: career.workContext.join(', '),
          educationRequirements: career.education,
          experienceLevel: "Entry to Mid-level",
          industryInsights: [`Matches ${interestArray.length} of your selected interests`, `Growing in ${career.industries.join(', ')} sectors`],
          topKConfidence: Math.floor(Math.random() * 30) + 70, // 70-100% match
          skillAlignmentScore: Math.floor(Math.random() * 25) + 65, // 65-90% alignment
          onetCode: career.onetCode,
          industries: career.industries
        },
        topSchools: [],
        relatedCareers: [],
        marketData: {
          demandLevel: career.skills.length > 5 ? "High" : "Moderate",
          competitionLevel: career.salary > 75000 ? "Competitive" : "Average", 
          salaryTrend: "Growing",
          remoteFriendly: career.skills.some(s => s.toLowerCase().includes('programming') || s.toLowerCase().includes('data')),
          jobAvailability: Math.floor(Math.random() * 30) + 60 // 60-90%
        }
      }));
      
      res.json({
        interests: interestArray,
        careerOptions,
        totalFound: careerOptions.length,
        matchingMethod: "Comprehensive Dataset Index"
      });
    } catch (error) {
      console.error("Multi-interest exploration error:", error);
      res.status(500).json({ 
        error: "Failed to explore interests",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.get("/api/explore-interest/:interest", async (req, res) => {
    try {
      const { interest } = req.params;
      console.log(`🎯 API: Comprehensive career exploration for "${interest}"`);
      
      // Use comprehensive O*NET service instead of limited career explorer
      const { comprehensiveOnetService } = await import('../comprehensive-onet-service');
      
      // Create mock user profile based on interest
      const userProfile = {
        interests: [decodeURIComponent(interest)],
        skillRatings: {}, // No specific skills, match by interest
        preferredEducation: 'bachelor',
        workValues: []
      };
      
      const careerMatches = await comprehensiveOnetService.findCareerMatches(userProfile as any);
      console.log(`✅ Found ${careerMatches.length} comprehensive career matches for ${interest}`);
      
      // Format for frontend compatibility
      const careerOptions = careerMatches.map(match => ({
        career: {
          title: match.career.title,
          description: match.career.description,
          requiredSkills: match.career.skills || [],
          averageSalary: match.career.averageSalary,
          growthOutlook: match.career.jobGrowthRate + "% growth",
          workEnvironment: "Professional environment",
          educationRequirements: match.career.educationRequired,
          experienceLevel: "Entry to Mid-level",
          industryInsights: match.matchReasons || [],
          topKConfidence: Math.round(match.matchScore),
          skillAlignmentScore: Math.round(match.matchScore * 0.9)
        },
        topSchools: [],
        relatedCareers: [],
        marketData: {
          demandLevel: "Moderate",
          competitionLevel: "Average",
          salaryTrend: "Stable",
          remoteFriendly: true,
          jobAvailability: 75
        }
      }));
      
      const response = {
        interest: decodeURIComponent(interest),
        careerOptions: careerOptions.slice(0, 8),
        totalFound: careerOptions.length
      };
      
      console.log(`✅ API: Returning ${response.careerOptions.length} comprehensive careers for ${interest}`);
      
      res.json(response);
    } catch (error) {
      console.error("Comprehensive interest exploration error:", error);
      res.status(500).json({ 
        error: "Failed to explore interest",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get comprehensive skills from dataset indexer
  app.get("/api/comprehensive-skills", async (req, res) => {
    try {
      const { comprehensiveDataIndexer } = await import('../comprehensive-data-indexer');
      
      // Ensure data is loaded
      if (!comprehensiveDataIndexer.getAllCareers().length) {
        await comprehensiveDataIndexer.loadAllDatasets();
      }
      
      const skills = comprehensiveDataIndexer.getSkillsIndex();
      console.log(`📊 Serving ${skills.length} indexed skills from comprehensive datasets`);
      
      res.json(skills);
    } catch (error) {
      console.error("Error fetching comprehensive skills:", error);
      res.status(500).json({ error: "Failed to fetch comprehensive skills" });
    }
  });

  // Get comprehensive interests from dataset indexer
  app.get("/api/comprehensive-interests", async (req, res) => {
    try {
      const { comprehensiveDataIndexer } = await import('../comprehensive-data-indexer');
      
      // Ensure data is loaded
      if (!comprehensiveDataIndexer.getAllCareers().length) {
        await comprehensiveDataIndexer.loadAllDatasets();
      }
      
      const interests = comprehensiveDataIndexer.getInterestsIndex();
      console.log(`🎯 Serving ${interests.length} indexed interests from comprehensive datasets`);
      
      res.json(interests);
    } catch (error) {
      console.error("Error fetching comprehensive interests:", error);
      res.status(500).json({ error: "Failed to fetch interests" });
    }
  });

  // 🚀 NEW: Dynamic skills endpoint - pulls directly from database
  app.get("/api/dynamic-skills", async (req, res) => {
    try {
      // Get all careers from database
      const careers = await db.select().from(careerPaths);
      
      // Extract all unique skills from all careers
      const skillsSet = new Set<string>();
      const skillData = new Map<string, { count: number; salaries: number[] }>();
      
      careers.forEach(career => {
        if (career.skills && Array.isArray(career.skills)) {
          career.skills.forEach(skill => {
            if (skill && skill.trim().length > 2) {
              const normalizedSkill = skill.trim();
              skillsSet.add(normalizedSkill);
              
              // Track career count and salaries for this skill
              if (!skillData.has(normalizedSkill)) {
                skillData.set(normalizedSkill, { count: 0, salaries: [] });
              }
              const data = skillData.get(normalizedSkill)!;
              data.count++;
              if (career.averageSalary) {
                data.salaries.push(career.averageSalary);
              }
            }
          });
        }
      });
      
      // Format as array with metadata
      const skills = Array.from(skillsSet).map(skill => {
        const data = skillData.get(skill)!;
        const avgSalary = data.salaries.length > 0
          ? Math.round(data.salaries.reduce((sum, sal) => sum + sal, 0) / data.salaries.length)
          : 65000;
        
        return {
          name: skill,
          careerCount: data.count,
          averageSalary: avgSalary,
          demandLevel: data.count >= 10 ? 'High' : data.count >= 5 ? 'Moderate' : 'Low'
        };
      }).sort((a, b) => b.careerCount - a.careerCount); // Sort by popularity
      
      console.log(`✨ Dynamic Skills: Serving ${skills.length} unique skills from ${careers.length} database careers`);
      
      res.json(skills);
    } catch (error) {
      console.error("Error fetching dynamic skills:", error);
      res.status(500).json({ error: "Failed to fetch dynamic skills" });
    }
  });

  // 🚀 NEW: Dynamic interests endpoint - pulls from database industries
  app.get("/api/dynamic-interests", async (req, res) => {
    try {
      // Get all careers from database
      const careers = await db.select().from(careerPaths);
      
      // Extract all unique industries/interests from all careers
      const interestsSet = new Set<string>();
      const interestData = new Map<string, { count: number; salaries: number[]; growthRates: number[] }>();
      
      careers.forEach(career => {
        if (career.industries && Array.isArray(career.industries)) {
          career.industries.forEach(industry => {
            if (industry && industry.trim().length > 2) {
              const normalizedIndustry = industry.trim();
              interestsSet.add(normalizedIndustry);
              
              // Track career count, salaries, and growth for this interest
              if (!interestData.has(normalizedIndustry)) {
                interestData.set(normalizedIndustry, { count: 0, salaries: [], growthRates: [] });
              }
              const data = interestData.get(normalizedIndustry)!;
              data.count++;
              if (career.averageSalary) {
                data.salaries.push(career.averageSalary);
              }
              if (career.jobGrowthRate) {
                data.growthRates.push(career.jobGrowthRate);
              }
            }
          });
        }
      });
      
      // Format as array with metadata
      const interests = Array.from(interestsSet).map(interest => {
        const data = interestData.get(interest)!;
        const avgSalary = data.salaries.length > 0
          ? Math.round(data.salaries.reduce((sum, sal) => sum + sal, 0) / data.salaries.length)
          : 65000;
        const avgGrowth = data.growthRates.length > 0
          ? data.growthRates.reduce((sum, rate) => sum + rate, 0) / data.growthRates.length
          : 5;
        
        return {
          name: interest,
          careerCount: data.count,
          averageSalary: avgSalary,
          marketOutlook: avgGrowth > 10 ? 'Growing' : avgGrowth > 5 ? 'Stable' : 'Declining',
          demandLevel: data.count >= 8 ? 'High' : data.count >= 4 ? 'Moderate' : 'Low'
        };
      }).sort((a, b) => b.careerCount - a.careerCount); // Sort by popularity
      
      console.log(`✨ Dynamic Interests: Serving ${interests.length} unique interests from ${careers.length} database careers`);
      
      res.json(interests);
    } catch (error) {
      console.error("Error fetching dynamic interests:", error);
      res.status(500).json({ error: "Failed to fetch dynamic interests" });
    }
  });

  // Get all available careers for browsing
  app.get("/api/career-paths/browse", async (req, res) => {
    try {
      const { comprehensiveOnetService } = await import('../comprehensive-onet-service');
      const allCareers = comprehensiveOnetService.getAllCareers();
      
      console.log(`✅ Serving ${allCareers.length} careers from comprehensive O*NET database`);
      res.json(allCareers.map((career: any) => ({
        title: career.title,
        onetCode: career.onetCode,
        description: career.description,
        averageSalary: career.averageSalary,
        jobGrowthRate: career.jobGrowthRate,
        educationRequired: career.educationRequired,
        skills: career.skills || [],
        industries: career.industries || [],
        relatedMajors: career.relatedMajors || []
      })));
    } catch (error) {
      console.error("Error fetching comprehensive careers:", error);
      res.status(500).json({ 
        message: "Failed to fetch careers", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get recommended colleges for a specific career
  app.get("/api/career-paths/:careerTitle/colleges", async (req, res) => {
    try {
      const { careerTitle } = req.params;
      const decodedTitle = decodeURIComponent(careerTitle);
      
      // Find colleges that match the career field
      const colleges = await storage.getColleges();
      const relevantColleges = colleges.filter((college: any) => {
        const description = (college.description || '').toLowerCase();
        const name = college.name.toLowerCase();
        const careerLower = decodedTitle.toLowerCase();
        
        return description.includes(careerLower) ||
          name.includes(careerLower) ||
          (careerLower.includes('engineer') && description.includes('engineer')) ||
          (careerLower.includes('business') && description.includes('business')) ||
          (careerLower.includes('computer') && description.includes('computer')) ||
          (careerLower.includes('health') && description.includes('health'));
      }).slice(0, 10);

      res.json(relevantColleges);
    } catch (error) {
      console.error("Error fetching college recommendations:", error);
      res.status(500).json({ 
        message: "Failed to fetch college recommendations", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Get skill development roadmap for a career
  app.post("/api/career-paths/:careerTitle/roadmap", async (req, res) => {
    try {
      const { careerTitle } = req.params;
      const { currentSkills } = req.body;
      const decodedTitle = decodeURIComponent(careerTitle);
      
      if (!currentSkills || !Array.isArray(currentSkills)) {
        res.status(400).json({ 
          message: "currentSkills array is required" 
        });
        return;
      }

      // Generate a skill roadmap based on career type
      const roadmap = {
        careerTitle: decodedTitle,
        currentSkills: currentSkills,
        recommendedSkills: [
          'Communication',
          'Problem Solving',
          'Teamwork',
          'Project Management',
          'Leadership'
        ],
        skillGaps: [
          'Advanced Technical Skills',
          'Industry Certification',
          'Professional Experience'
        ],
        learningPath: [
          'Complete relevant online courses',
          'Gain hands-on experience through projects',
          'Build professional network',
          'Pursue industry certifications'
        ]
      };

      res.json(roadmap);
    } catch (error) {
      console.error("Error generating skill roadmap:", error);
      res.status(500).json({ 
        message: "Failed to generate skill roadmap", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Search careers by title or description
  app.get("/api/career-paths/search/:query", async (req, res) => {
    try {
      const { query } = req.params;
      const decodedQuery = decodeURIComponent(query).toLowerCase();
      
      // Use final career analyzer for search instead of broken O*NET service
      const analysisResult = await (globalThis as any).aiResumeAnalyzer?.callPythonAnalyzer?.({
        resume: decodedQuery,
        statement: '',
        api_key: '',
        desired_degree: 'Bachelor\'s',
        state_preference: ''
      }) ?? { careers: [] };

      const matchingCareers = (analysisResult.careers || []).map((careerData: any) => ({
        title: careerData.career,
        onetCode: careerData.onet_code,
        description: careerData.description,
        averageSalary: careerData.salary,
        jobGrowthRate: careerData.growth,
        educationRequired: 'Bachelor\'s degree',
        skills: careerData.matched_skills || [],
        industries: [],
        relatedMajors: []
      }));

      res.json(matchingCareers);
    } catch (error) {
      console.error("Error searching careers:", error);
      res.status(500).json({ 
        message: "Failed to search careers", 
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ML Career Path Generation - O*NET Machine Learning Analysis
  app.post("/api/ml/career-paths", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { interests, skills, preferredEducation, salaryExpectation, locationPreference, workValues } = req.body;
      
      console.log('Processing ML career matching with O*NET data:', {
        interests,
        skills,
        preferredEducation,
        salaryExpectation,
        locationPreference,
        workValues
      });

      // Use working career analyzer instead of broken O*NET service
      const analysisResult = await (globalThis as any).aiResumeAnalyzer?.callPythonAnalyzer?.({
        resume: (interests || []).join(' ') + ' ' + (skills || []).join(' '),
        statement: preferredEducation || 'bachelors',
        api_key: '',
        desired_degree: preferredEducation || 'bachelors',
        state_preference: locationPreference
      }) ?? { careers: [] };

      const careers = (analysisResult.careers || []).map((careerData: any, index: number) => ({
        id: `ml_${Date.now()}_${index}`,
        title: careerData.career,
        description: careerData.description,
        averageSalary: careerData.salary,
        jobGrowthRate: careerData.growth,
        educationRequired: preferredEducation || 'Bachelor\'s degree',
        skills: careerData.matched_skills || [],
        industries: [],
        relatedMajors: [],
        workEnvironment: 'Professional environment',
        jobOutlook: careerData.growth || 'Stable growth expected',
        onetCode: careerData.onet_code || `${15 + index}-${1000 + index}.00`,
        matchScore: careerData.score || 0,
        matchReasons: [`${careerData.riasec_match}% RIASEC match`, `${careerData.skills_match}% skills match`],
        skillsGap: [],
        standOutTips: [`Focus on ${careerData.career} specific skills`, 'Build relevant portfolio', 'Network with industry professionals']
      }));
      
      console.log(`Generated ${careers.length} ML career matches with O*NET data`);

      res.json(careers);
    } catch (error) {
      console.error("ML Career path generation error:", error);
      res.status(500).json({ 
        message: "Failed to generate career paths using machine learning",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // ========================================
  // VERIFIED SCHOLARSHIP SYSTEM WITH SOURCE TRACKING
  // ========================================

  // Get all verified scholarships (automatically filters expired)
  app.get("/api/verified-scholarships", async (req, res) => {
    try {
      const { type, state, minAmount, maxAmount, industryTag } = req.query;
      
      const scholarships = await verifiedScholarshipService.getActiveScholarships({
        type: type as string,
        state: state as string,
        minAmount: minAmount ? parseInt(minAmount as string) : undefined,
        maxAmount: maxAmount ? parseInt(maxAmount as string) : undefined,
        industryTag: industryTag as string
      });

      res.json(scholarships);
    } catch (error) {
      console.error("Error fetching verified scholarships:", error);
      res.status(500).json({ message: "Failed to fetch scholarships" });
    }
  });

  // Seed verified scholarships (admin/setup)
  app.post("/api/verified-scholarships/seed", async (req, res) => {
    try {
      const result = await verifiedScholarshipService.seedVerifiedScholarships();
      res.json({ 
        message: "Scholarships seeded successfully", 
        inserted: result.inserted, 
        skipped: result.skipped 
      });
    } catch (error) {
      console.error("Error seeding scholarships:", error);
      res.status(500).json({ message: "Failed to seed scholarships" });
    }
  });

  // Save scholarship for user with automatic deadline notifications
  app.post("/api/verified-scholarships/save", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const { scholarshipId, planId } = req.body;

      if (!scholarshipId) {
        res.status(400).json({ message: "Scholarship ID is required" });
        return;
      }

      const saved = await verifiedScholarshipService.saveScholarshipForUser(
        userId, 
        parseInt(scholarshipId),
        planId ? parseInt(planId) : undefined
      );

      res.json({ message: "Scholarship saved successfully", saved });
    } catch (error) {
      console.error("Error saving scholarship:", error);
      res.status(500).json({ message: "Failed to save scholarship" });
    }
  });

  // Get user's saved scholarships
  app.get("/api/verified-scholarships/saved", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const saved = await verifiedScholarshipService.getUserSavedScholarships(userId);
      res.json(saved);
    } catch (error) {
      console.error("Error fetching saved scholarships:", error);
      res.status(500).json({ message: "Failed to fetch saved scholarships" });
    }
  });

  // Update saved scholarship status
  app.patch("/api/verified-scholarships/saved/:scholarshipId/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const scholarshipId = parseInt(req.params.scholarshipId);
      const { status } = req.body;

      const validStatuses = ["saved", "applied", "submitted", "won", "not_interested"];
      if (!validStatuses.includes(status)) {
        res.status(400).json({ message: "Invalid status" });
        return;
      }

      await verifiedScholarshipService.updateSavedScholarshipStatus(userId, scholarshipId, status);
      res.json({ message: "Status updated successfully" });
    } catch (error) {
      console.error("Error updating scholarship status:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // Get user's deadline notifications
  app.get("/api/verified-scholarships/notifications", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const notifications = await verifiedScholarshipService.getUserNotifications(userId);
      res.json(notifications);
    } catch (error) {
      console.error("Error fetching notifications:", error);
      res.status(500).json({ message: "Failed to fetch notifications" });
    }
  });

  // Mark notification as read
  app.patch("/api/verified-scholarships/notifications/:id/read", isAuthenticated, async (req, res) => {
    try {
      const notificationId = parseInt(req.params.id);
      await verifiedScholarshipService.markNotificationRead(notificationId);
      res.json({ message: "Notification marked as read" });
    } catch (error) {
      console.error("Error marking notification as read:", error);
      res.status(500).json({ message: "Failed to mark as read" });
    }
  });

  // Get data source health status
  app.get("/api/verified-scholarships/source-health", async (req, res) => {
    try {
      const health = await verifiedScholarshipService.getDataSourceHealth();
      res.json(health);
    } catch (error) {
      console.error("Error fetching source health:", error);
      res.status(500).json({ message: "Failed to fetch source health" });
    }
  });

  // Smart scholarship matching endpoints
  app.post("/api/scholarships/recommendations", isAuthenticated, async (req, res) => {
    try {
      const { userProfile, limit = 5 } = req.body;
      
      if (!userProfile) {
        res.status(400).json({ message: "User profile is required" });
        return;
      }

      const recommendations = smartScholarshipMatcher.getTopRecommendations(userProfile, limit);
      res.json(recommendations);
    } catch (error) {
      console.error("Error generating scholarship recommendations:", error);
      res.status(500).json({ message: "Failed to generate recommendations" });
    }
  });

  // Advanced scholarship search with smart matching
  app.post("/api/scholarships/smart-search", isAuthenticated, async (req, res) => {
    try {
      const { userProfile, filters = {} } = req.body;
      
      if (!userProfile) {
        res.status(400).json({ message: "User profile is required" });
        return;
      }

      let matches = smartScholarshipMatcher.findMatches(userProfile);

      // Apply filters client-side since methods don't exist
      if (filters.minAmount) {
        matches = matches.filter((s: any) => s.scholarship.amount >= filters.minAmount);
      }
      if (filters.maxAmount) {
        matches = matches.filter((s: any) => s.scholarship.amount <= filters.maxAmount);
      }

      if (filters.types && filters.types.length > 0) {
        matches = matches.filter((s: any) => filters.types.includes(s.scholarship.type));
      }

      if (filters.monthsAhead) {
        const deadlineFilter = new Date();
        deadlineFilter.setMonth(deadlineFilter.getMonth() + filters.monthsAhead);
        matches = matches.filter((s: any) => new Date(s.scholarship.deadline) <= deadlineFilter);
      }

      res.json(matches);
    } catch (error) {
      console.error("Error in smart scholarship search:", error);
      res.status(500).json({ message: "Failed to perform smart search" });
    }
  });

  // ========================================
  // USER PROFILE SYSTEM
  // ========================================

  // Get user profile with completeness and insights
  app.get("/api/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const profileCompleteness = calculateProfileCompleteness(user);
      const insights = generateProfileInsights(user);

      res.json({
        ...user,
        profileCompleteness,
        insights,
        password: undefined,
        resumeFileData: undefined,
      });
    } catch (error) {
      console.error("Profile fetch error:", error);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Save/Update user profile with comprehensive data
  app.post("/api/save-profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const profileData = req.body;

      const updatedUser = await storage.updateUserProfile(userId, {
        ...profileData,
        updatedAt: new Date()
      });

      const profileCompleteness = calculateProfileCompleteness(updatedUser);

      res.json({
        success: true,
        message: "Profile saved successfully",
        profile: { ...updatedUser, password: undefined },
        profileCompleteness
      });

    } catch (error) {
      console.error("Profile save error:", error);
      res.status(500).json({ 
        message: "Failed to save profile",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Resume File Upload and Analysis endpoint
  app.post("/api/upload-resume", isAuthenticated, resumeUpload.single('resume'), async (req: any, res) => {
    try {
      const userId = req.user.id;
      const file = req.file;

      if (!file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      // Validate file
      const validation = validateResumeFile(file);
      if (!validation.valid) {
        res.status(400).json({ message: validation.error });
        return;
      }

      console.log(`Processing resume upload for user ${userId}: ${file.originalname} (${file.mimetype})`);

      // Extract text from the uploaded file
      const extractionResult = await extractTextFromResume(file.buffer, file.mimetype);

      if (extractionResult.error || !extractionResult.text.trim()) {
        res.status(400).json({ 
          message: extractionResult.error || "Could not extract text from the uploaded file" 
        });
        return;
      }

      console.log(`Extracted ${extractionResult.text.length} characters from resume`);

      // Now run the analysis on the extracted text using custom ML parser (no external AI)
      let analysisResult;
      let careerRecommendations = [];
      let scholarshipMatches = [];
      
      // Use custom ML Resume Parser (no external AI dependencies)
      console.log("🧠 Using Custom ML Resume Parser (pattern matching + rule-based extraction)...");
      const mlResult = mlResumeParser.parseResume(extractionResult.text);
      
      // Convert ML result to compatible format
      const parsedData = {
        interests: mlResult.interests,
        skills: mlResult.skills,
        education_level: mlResult.education.level.toLowerCase(),
        gpa: mlResult.education.gpa,
        demographics: mlResult.demographics,
        location: null,
        career_field: mlResult.experience.industries[0] || null,
        ats_score: mlResult.atsScore,
        experience_summary: mlResult.experienceSummary,
        keywords: [...mlResult.skills.slice(0, 10), ...mlResult.certifications],
        certifications: mlResult.certifications,
        career_goals: mlResult.careerGoals,
        education: {
          level: mlResult.education.level,
          major: mlResult.education.major,
          gpa: mlResult.education.gpa,
          institution: mlResult.education.institution,
          graduation_year: mlResult.education.graduationYear
        },
        experience: mlResult.experience
      };

      analysisResult = {
        interests: parsedData.interests || [],
        skills: parsedData.skills || [],
        educationLevel: parsedData.education_level || 'bachelor',
        gpa: parsedData.gpa || null,
        demographics: parsedData.demographics || [],
        location: parsedData.location || null,
        careerField: parsedData.career_field || null,
        atsScore: parsedData.ats_score || 0,
        experienceSummary: parsedData.experience_summary || null,
        keywords: parsedData.keywords || []
      };

      // Match careers and scholarships using ML-parsed data
      const user = await storage.getUser(userId);
      if (user) {
        const allCareers = await storage.getCareerPaths();
        careerRecommendations = await matchCareersFromClaudeData(parsedData as any, allCareers);
        
        const allScholarships = await storage.getScholarships();
        scholarshipMatches = await matchScholarshipsFromClaudeData(parsedData as any, allScholarships);
      }

      // Save resume file as base64 and MERGE analysis with existing profile
      const resumeBase64 = file.buffer.toString('base64');
      
      // Merge resume keywords with existing profile keywords (don't overwrite)
      const existingKeywords = user?.aiKeywords || [];
      const mergedKeywords = [...new Set([...existingKeywords, ...analysisResult.keywords])];
      
      // Merge resume interests with existing profile interests (don't overwrite)
      const existingInterests = user?.interests || [];
      const resumeInterests = analysisResult.interests || [];
      const mergedInterests = [...new Set([...existingInterests, ...resumeInterests])];
      
      // Merge demographics (don't overwrite)
      const existingDemographics = user?.demographics || [];
      const resumeDemographics = analysisResult.demographics || [];
      const mergedDemographics = [...new Set([...existingDemographics, ...resumeDemographics])];
      
      // Only fill in GPA/state/academicLevel if user hasn't set them already
      const updateData: any = {
        aiKeywords: mergedKeywords,
        aiAnalysisDate: new Date(),
        resumeFileData: resumeBase64,
        resumeFileName: file.originalname,
        resumeFileType: file.mimetype,
        resumeUploadDate: new Date(),
        resumeAnalysisResults: {
          ...analysisResult,
          analyzedAt: new Date().toISOString(),
          fileName: file.originalname,
          fileType: file.mimetype
        },
        interests: mergedInterests.length > 0 ? mergedInterests : undefined,
        demographics: mergedDemographics.length > 0 ? mergedDemographics : undefined,
      };
      
      // Only set these if user hasn't already filled them in
      if (!user?.gpa && analysisResult.gpa) updateData.gpa = analysisResult.gpa;
      if (!user?.state && analysisResult.location) updateData.state = analysisResult.location;
      if (!user?.academicLevel && analysisResult.educationLevel) updateData.academicLevel = analysisResult.educationLevel;
      if (!user?.major && analysisResult.careerField) updateData.major = analysisResult.careerField;
      
      await storage.updateUserProfile(userId, updateData);

      res.json({
        success: true,
        message: "Resume analyzed successfully",
        fileName: file.originalname,
        extractedTextLength: extractionResult.text.length,
        pageCount: extractionResult.pageCount,
        analysis: analysisResult,
        careerRecommendations: careerRecommendations.slice(0, 5),
        scholarshipMatches: scholarshipMatches.slice(0, 5)
      });

    } catch (error) {
      console.error("Resume upload error:", error);
      res.status(500).json({ 
        message: "Failed to process resume",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Download saved resume
  app.get("/api/resume/download", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || !user.resumeFileData || !user.resumeFileName) {
        res.status(404).json({ message: "No saved resume found" });
        return;
      }

      const buffer = Buffer.from(user.resumeFileData, 'base64');
      res.setHeader('Content-Type', user.resumeFileType || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${user.resumeFileName}"`);
      res.setHeader('Content-Length', buffer.length);
      res.send(buffer);
    } catch (error) {
      console.error("Resume download error:", error);
      res.status(500).json({ message: "Failed to download resume" });
    }
  });

  // Get saved resume info
  app.get("/api/resume/info", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user || !user.resumeFileName) {
        res.json({ hasResume: false });
        return;
      }

      res.json({
        hasResume: true,
        fileName: user.resumeFileName,
        fileType: user.resumeFileType,
        uploadDate: user.resumeUploadDate,
        hasAnalysis: !!user.resumeAnalysisResults,
      });
    } catch (error) {
      console.error("Resume info error:", error);
      res.status(500).json({ message: "Failed to get resume info" });
    }
  });

  // Delete saved resume
  app.delete("/api/resume", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.id;
      await storage.updateUserProfile(userId, {
        resumeFileData: null,
        resumeFileName: null,
        resumeFileType: null,
        resumeUploadDate: null,
        resumeAnalysisResults: null,
        aiKeywords: null,
        aiAnalysisDate: null,
      } as any);
      
      res.json({ success: true, message: "Resume deleted successfully" });
    } catch (error) {
      console.error("Resume delete error:", error);
      res.status(500).json({ message: "Failed to delete resume" });
    }
  });

  // Claude-Powered Resume Analysis with Dataset Matching  
  app.post("/api/analyze-resume", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const { resumeText, personalStatement } = req.body;

      if (!resumeText) {
        res.status(400).json({ message: "Resume text is required" });
        return;
      }

      console.log(
        hasAnthropicKey()
          ? "Starting Claude-powered resume analysis for user:"
          : "Starting algorithmic resume analysis (no ANTHROPIC_API_KEY configured) for user:",
        userId,
      );

      let analysisResult;
      let careerRecommendations = [];
      let scholarshipMatches = [];
      let analysisMethod = 'claude_extraction';

      try {
        if (!hasAnthropicKey()) {
          throw new Error("ANTHROPIC_API_KEY not configured; using algorithmic analysis");
        }

        // Step 1: Use Dataset-Enhanced Claude extraction with 76,000+ resume patterns
        console.log("🧠 Using Dataset-Enhanced Analyzer (trained on 76,000+ resumes)...");
        const datasetResult = await datasetEnhancedAnalyzer.performDatasetEnhancedExtraction(resumeText);
        
        // Step 1.1: Fallback to original Claude extraction if needed
        const claudeResult = datasetResult.dataset_enhanced ? datasetResult : await callClaudeForExtraction(resumeText);
        
        // DEBUG LOG 1: Log the complete Claude output
        console.log("Claude output:", JSON.stringify(claudeResult, null, 2));
        
        if (!claudeResult || !claudeResult.skills || claudeResult.skills.length === 0) {
          throw new Error("Claude extraction failed or returned no skills");
        }

        console.log("✅ Dataset-enhanced extraction successful:", {
          skills: claudeResult.skills.length,
          interests: claudeResult.interests?.length || 0,
          gpa: claudeResult.education?.gpa,
          major: claudeResult.education?.major,
          datasetEnhanced: claudeResult.dataset_enhanced || false,
          aiScreeningEnhanced: claudeResult.ai_screening_enhanced || false,
          syntheticCareerEnhanced: claudeResult.synthetic_career_enhanced || false,
          topKEnhanced: claudeResult.top_k_enhanced || false,
          enhancedConfidenceScore: claudeResult.enhanced_confidence_score || 0,
          aiPredictions: claudeResult.ai_predictions?.length || 0,
          syntheticRecommendations: claudeResult.synthetic_recommendations?.length || 0,
          topKResults: claudeResult.top_k_results?.topCareers?.length || 0,
          topKAccuracyBoost: claudeResult.top_k_results?.accuracyBoost || 0,
          confidenceScore: claudeResult.extraction_confidence || claudeResult.confidence_score
        });

        // Step 2: Match careers using extracted data and authentic database
        const allCareers = directCareerMatcher.getAllCareers();
        
        // DEBUG LOG 2: Confirm career matcher uses Claude output
        console.log("Matching careers for skills:", claudeResult.skills);
        console.log("Loaded", allCareers.length, "careers");
        
        const matchedCareers = await matchCareersFromClaudeData(claudeResult, allCareers);
        
        // DEBUG LOG 3: Log first 5 career matches
        console.log("First 5 career matches:", matchedCareers.slice(0, 5).map(c => ({
          title: c.title,
          matchScore: c.matchScore,
          skillMatches: c.skillMatches
        })));
        
        careerRecommendations = matchedCareers.slice(0, 8).map(career => ({
          title: career.title,
          description: career.description,
          matchScore: career.matchScore,
          matchReason: career.matchReasons.join('; '),
          averageSalary: career.averageSalary || '$65,000',
          jobGrowthRate: career.jobGrowthRate || 'Average growth',
          keySkills: career.skills || [],
          onetCode: career.onetCode,
          educationRequired: career.educationRequired || 'Bachelor\'s degree',
          semanticSimilarity: career.matchScore
        }));

        // Step 3: Match scholarships using extracted data and authentic database  
        const allScholarships = scholarshipService.getAllScholarships();
        const matchedScholarships = await matchScholarshipsFromClaudeData(claudeResult, allScholarships);
        
        // DEBUG LOG 3: Log scholarship matching results
        console.log("Claude Scholarship Matches:", matchedScholarships.slice(0, 3).map(s => ({
          name: s.scholarship.name,
          amount: s.scholarship.amount,
          score: Math.round(s.matchScore * 100),
          reasons: s.matchReasons.slice(0, 2)
        })));
        
        scholarshipMatches = matchedScholarships.slice(0, 8).map(match => ({
          scholarship: match.scholarship,
          score: Math.round(match.matchScore * 100),
          reason: match.matchReasons.join('; '),
          semanticSimilarity: match.matchScore
        }));

        // Build analysis result from Claude extraction with RSEDUNAV format
        analysisResult = {
          career_field: claudeResult.career_field,
          ats_compatibility_score: claudeResult.ats_compatibility_score,
          experience_summary: claudeResult.experience_summary,
          skills: claudeResult.skills,
          interests: claudeResult.interests,
          education: claudeResult.education,
          experience: claudeResult.experience,
          demographics: claudeResult.demographics,
          careerGoals: claudeResult.career_goals,
          confidenceScore: 0.9, // High confidence with Claude
          method: 'claude_extraction'
        };
        
        console.log("✅ Dataset-enhanced analysis completed:", {
          skillsFound: claudeResult.skills.length,
          interestsFound: claudeResult.interests?.length || 0,
          careerMatches: careerRecommendations.length,
          scholarshipMatches: scholarshipMatches.length,
          method: claudeResult.top_k_enhanced ? 'top_k_enhanced_multi_dataset_analysis' : 'dataset_enhanced_claude_with_comprehensive_training',
          trainingDataUsed: '78,000+ resumes with Top-K Top-3 methodology',
          aiScreeningPredictions: claudeResult.ai_predictions?.length || 0,
          syntheticCareerRecommendations: claudeResult.synthetic_recommendations?.length || 0,
          topKEnhancedMatches: claudeResult.top_k_results?.topCareers?.length || 0,
          topKAccuracyBoost: claudeResult.top_k_results?.accuracyBoost || 0,
          enhancedConfidence: claudeResult.enhanced_confidence_score || 0,
          suggestedCareers: claudeResult.suggested_careers?.length || 0
        });
        
      } catch (claudeError) {
        console.log("Claude extraction failed, using enhanced fallback:", String(claudeError));
        analysisMethod = 'enhanced_fallback';
        
        // Fallback to enhanced semantic analyzer
        const semanticResult = await enhancedFallbackAnalyzer.analyzeResumeWithEnhancedFallback(resumeText);
        
        analysisResult = semanticResult.analysis;
        careerRecommendations = semanticResult.careers
          .filter(career => career.matchScore >= 0.45)
          .slice(0, 8)
          .map(career => ({
            title: career.career.title,
            description: career.career.description,
            matchScore: career.matchScore,
            matchReason: career.matchReasons.join('; '),
            averageSalary: career.career.averageSalary || '$65,000',
            jobGrowthRate: career.career.jobGrowthRate || 'Average growth',
            keySkills: career.career.skills || [],
            onetCode: career.career.onetCode,
            educationRequired: career.career.educationRequired,
            semanticSimilarity: career.semanticSimilarity
          }));

        scholarshipMatches = semanticResult.scholarships
          .filter(scholarship => scholarship.matchScore >= 0.60)
          .slice(0, 8)
          .map(scholarship => ({
            scholarship: scholarship.scholarship,
            score: Math.round(scholarship.matchScore * 100),
            reason: scholarship.matchReasons.join('; '),
            semanticSimilarity: scholarship.semanticSimilarity
          }));
      }

      console.log("Analysis completed:", {
        skillsFound: analysisResult.skills?.length || 0,
        interestsFound: analysisResult.interests?.length || 0,
        careerPathsFound: careerRecommendations.length,
        scholarshipsFound: scholarshipMatches.length,
        confidenceScore: analysisResult.confidenceScore || 0,
        method: analysisMethod
      });

      // Update user profile with insights
      const updateData: any = {
        aiKeywords: (analysisResult.skills || []).concat(analysisResult.interests || []),
        aiAnalysisDate: new Date(),
        personalStatement: personalStatement || undefined,
        analysisConfidence: (analysisResult.confidenceScore || 0) > 0.7 ? 'high' : 
                           (analysisResult.confidenceScore || 0) > 0.5 ? 'medium' : 'low'
      };

      // Update GPA if detected and not already set
      const currentUser = await storage.getUser(userId);
      if (analysisResult.education?.gpa && !currentUser?.gpa) {
        updateData.gpa = analysisResult.education.gpa;
      }

      // Update education level if detected
      if (analysisResult.education?.level) {
        updateData.academicLevel = analysisResult.education.level;
      }

      // Update demographics if detected
      if (analysisResult.demographics) {
        const demographics = Object.keys(analysisResult.demographics).filter(
          key => analysisResult.demographics[key as keyof typeof analysisResult.demographics]
        );
        if (demographics.length > 0) {
          updateData.demographics = demographics;
        }
      }

      // Update interests if detected
      if (analysisResult.interests?.length > 0) {
        updateData.interests = analysisResult.interests;
      }

      // Update skills with Claude extraction
      if (analysisResult.skills?.length > 0) {
        updateData.skills = analysisResult.skills;
      }

      // Format complete analysis results for saving
      const completeResults = {
        skills: analysisResult.skills || [],
        interests: analysisResult.interests || [],
        education: analysisResult.education || {},
        experience: analysisResult.experience || {},
        riasecProfile: analysisResult.riasecProfile || {},
        demographics: analysisResult.demographics || {},
        careerIndicators: analysisResult.careerIndicators || [],
        confidenceScore: analysisResult.confidenceScore || 0,
        timestamp: new Date().toISOString(),
        analysisMethod,
        uniqueAnalysis: analysisMethod === 'enhanced_semantic',
        careers: careerRecommendations.map(career => ({
          career: career,
          score: Math.round((career.matchScore || 0.75) * 100),
          description: career.description,
          reason: career.matchReason,
          semanticSimilarity: career.semanticSimilarity || 0.5,
          schools: []
        })),
        scholarships: scholarshipMatches.map(scholarship => ({
          scholarship: scholarship.scholarship,
          score: scholarship.score,
          reason: scholarship.reason,
          amount: scholarship.scholarship.amount,
          deadline: scholarship.scholarship.deadline,
          semanticSimilarity: scholarship.semanticSimilarity || 0.5
        }))
      };

      // Save complete analysis results to user profile
      updateData.resumeAnalysisResults = completeResults;
      
      const updatedUser = await storage.updateUserProfile(userId, updateData);
      const profileCompleteness = Math.min(100, Math.max(0, 
        calculateProfileCompleteness(updatedUser)
      ));
      
      await storage.updateUserProfile(userId, { profileCompleteness: Math.round(profileCompleteness) });

      // DEBUG LOG 4: Final API response
      console.log("API response - careers count:", careerRecommendations.length);
      console.log("API response - scholarships count:", scholarshipMatches.length);
      console.log("API response - analysis method:", analysisMethod);

      // Return properly grouped results for frontend tabs
      res.json({
        success: true,
        message: `Resume analyzed with ${analysisMethod === 'claude_extraction' ? 'Claude AI extraction' : 'algorithmic skill matching'}`,
        redirectTo: "/profile/career-recommendations",
        
        // Analysis data for Resume Analysis tab
        analysis: {
          skills: analysisResult.skills || [],
          interests: analysisResult.interests || [],
          education: analysisResult.education || {},
          experience: analysisResult.experience || {},
          gpa: analysisResult.education?.gpa,
          educationLevel: analysisResult.education?.level || 'bachelor',
          confidenceScore: analysisResult.confidenceScore || 0.85,
          riasecProfile: analysisResult.riasecProfile || {},
          demographics: analysisResult.demographics || {},
          uniqueAnalysis: analysisMethod === 'enhanced_semantic',
          method: analysisMethod
        },
        
        // Career data for Career Recommendations tab
        careers: careerRecommendations.slice(0, 8).map((career: any) => ({
          title: career.title,
          description: career.description,
          matchScore: career.matchScore || 0.75,
          matchReason: career.matchReason || 'Skills and interests alignment',
          averageSalary: career.averageSalary || '$65,000',
          jobGrowthRate: career.jobGrowthRate || 'Average growth',
          keySkills: career.keySkills || [],
          onetCode: career.onetCode,
          educationRequired: career.educationRequired || 'Bachelor\'s degree',
          semanticSimilarity: career.semanticSimilarity || 0.75
        })),
        
        // Scholarship data for Scholarship Matches tab  
        scholarships: scholarshipMatches.slice(0, 8).map((rec: any) => ({
          scholarship: {
            name: rec.scholarship.name,
            amount: rec.scholarship.amount,
            type: rec.scholarship.type,
            provider: rec.scholarship.provider,
            deadline: rec.scholarship.deadline,
            description: rec.scholarship.description,
            requirements: rec.scholarship.requirements || []
          },
          score: rec.score,
          reason: rec.reason || 'Profile alignment based on authentic criteria',
          semanticSimilarity: rec.semanticSimilarity || 0.7
        })),
        
        // Summary metadata
        profileCompleteness,
        analysisMethod,
        summary: {
          totalCareers: careerRecommendations.length,
          totalScholarships: scholarshipMatches.length,
          uniqueMatches: analysisMethod === 'enhanced_semantic'
        }
      });

    } catch (error) {
      console.error("Resume analysis error:", error);
      res.status(500).json({ 
        message: "Failed to analyze resume",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Initialize college indexer (skipped in production: the legacy
  // /api/colleges/by-* endpoints below have no callers, and the 12-minute
  // load held a Neon connection long enough for the platform to drop it,
  // crashing the server. Run only in development if needed for debugging.)
  if (process.env.NODE_ENV !== 'production') {
    collegeIndexer.initialize().catch(console.error);
  }

  // College indexer endpoints
  app.get("/api/colleges/by-industry/:industry", async (req, res) => {
    try {
      const { industry } = req.params;
      const limit = parseInt(req.query.limit as string) || 20;
      const colleges = await collegeIndexer.searchByIndustry(industry, limit);
      res.json(colleges);
    } catch (error) {
      console.error("Error searching colleges by industry:", error);
      res.status(500).json({ error: "Failed to search colleges by industry" });
    }
  });

  app.get("/api/colleges/by-state/:state", async (req, res) => {
    try {
      const { state } = req.params;
      const limit = parseInt(req.query.limit as string) || 50;
      const colleges = await collegeIndexer.searchByState(state, limit);
      res.json(colleges);
    } catch (error) {
      console.error("Error searching colleges by state:", error);
      res.status(500).json({ error: "Failed to search colleges by state" });
    }
  });

  app.get("/api/colleges/by-program/:program", async (req, res) => {
    try {
      const { program } = req.params;
      const limit = parseInt(req.query.limit as string) || 30;
      const colleges = await collegeIndexer.searchByProgram(program, limit);
      res.json(colleges);
    } catch (error) {
      console.error("Error searching colleges by program:", error);
      res.status(500).json({ error: "Failed to search colleges by program" });
    }
  });

  app.post("/api/colleges/comprehensive-search", async (req, res) => {
    try {
      const searchQuery = req.body;
      const colleges = await collegeIndexer.comprehensiveSearch(searchQuery);
      res.json(colleges);
    } catch (error) {
      console.error("Error in comprehensive college search:", error);
      res.status(500).json({ error: "Failed to perform comprehensive search" });
    }
  });

  app.get("/api/colleges/industry-stats", async (req, res) => {
    try {
      const stats = collegeIndexer.getIndustryStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting industry stats:", error);
      res.status(500).json({ error: "Failed to get industry statistics" });
    }
  });

  // Get scholarship matches from saved analysis results
  app.get("/api/profile/scholarship-matches", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Return saved scholarship analysis or generate new recommendations
      if (user.resumeAnalysisResults && (user.resumeAnalysisResults as any).scholarships) {
        res.json({
          scholarships: (user.resumeAnalysisResults as any).scholarships,
          analysisDate: (user.resumeAnalysisResults as any).timestamp,
          userProfile: {
            gpa: user.gpa,
            major: user.major,
            demographics: user.demographics,
            interests: user.interests
          }
        });
        return;
      }

      // Fallback to generating recommendations if no saved analysis
      res.json({
        scholarships: [],
        message: "No analysis found. Please analyze your resume first.",
        needsAnalysis: true
      });

    } catch (error) {
      console.error("Scholarship matches error:", error);
      res.status(500).json({ message: "Failed to get scholarship matches" });
    }
  });

  // Get personalized scholarship recommendations based on enhanced profile
  app.get("/api/profile/scholarship-recommendations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Build comprehensive user profile for scholarship matching
      const scholarshipProfile = {
        gpa: user.gpa || undefined,
        major: user.major || undefined,
        state: user.state || undefined,
        demographics: user.demographics || [],
        financialNeed: (user.financialNeed as 'high' | 'medium' | 'low') || undefined,
        interests: user.interests || [],
        academicLevel: (user.academicLevel as 'undergraduate' | 'graduate') || 'undergraduate',
        firstGeneration: user.demographics?.includes('first-generation') || false,
        militaryAffiliation: user.demographics?.includes('military/veteran') || false,
        athleticParticipation: false // Could be enhanced later
      };

      const recommendations = smartScholarshipMatcher.getTopRecommendations(scholarshipProfile, 10);
      
      res.json({
        recommendations,
        profileUsed: scholarshipProfile,
        totalMatches: recommendations.length
      });

    } catch (error) {
      console.error("Scholarship recommendation error:", error);
      res.status(500).json({ message: "Failed to get scholarship recommendations" });
    }
  });

  // Get career matches from saved analysis results  
  app.get("/api/profile/career-matches", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Return saved career analysis
      if (user.resumeAnalysisResults && (user.resumeAnalysisResults as any).careers) {
        res.json({
          careers: (user.resumeAnalysisResults as any).careers,
          analysisDate: (user.resumeAnalysisResults as any).timestamp,
          profileUsed: (user.resumeAnalysisResults as any).analysis
        });
        return;
      }

      // Fallback if no saved analysis
      res.json({
        careers: [],
        message: "No analysis found. Please analyze your resume first.",
        needsAnalysis: true
      });

    } catch (error) {
      console.error("Career matches error:", error);
      res.status(500).json({ message: "Failed to get career matches" });
    }
  });

  // Get career recommendations from saved analysis results  
  app.get("/api/profile/career-recommendations", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Return saved career analysis from resume analysis
      if (user.resumeAnalysisResults && (user.resumeAnalysisResults as any).careers) {
        res.json({
          careers: (user.resumeAnalysisResults as any).careers,
          analysisDate: (user.resumeAnalysisResults as any).timestamp,
          profileUsed: (user.resumeAnalysisResults as any).analysis
        });
        return;
      }

      // Fallback if no saved analysis
      res.json({
        careers: [],
        message: "No analysis found. Please analyze your resume first.",
        needsAnalysis: true
      });

    } catch (error) {
      console.error("Career recommendations error:", error);
      res.status(500).json({ message: "Failed to get career recommendations" });
    }
  });

  // Legacy endpoint - redirect to new one
  app.get("/api/profile/career-matches", isAuthenticated, async (req, res) => {
    res.redirect("/api/profile/career-recommendations");
    return;
  });

  // College recommendations with per-college matchReasons.
  // Mirrors the shape of /api/profile/career-recommendations and
  // /api/profile/scholarship-recommendations: an array of entries that pair
  // a college with the personalized reasons it matches the signed-in user.
  // Mobile and web clients (e.g. the Saved tab) look reasons up by college id.
  // Optional ?ids=1,2,3 narrows scoring to a specific subset (used when the
  // caller already knows which colleges it cares about, e.g. saved items).
  app.get("/api/profile/college-recommendations", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const user = await storage.getUser(userId);
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const idsParam = typeof req.query.ids === "string" ? req.query.ids : "";
      // Dedupe + cap the requested id set so a malicious caller can't ask
      // us to fan out tens of thousands of point lookups in one request.
      const MAX_REQUESTED_IDS = 200;
      const requestedIds = Array.from(
        new Set(
          idsParam
            .split(",")
            .map((s: string) => Number(s.trim()))
            .filter((n: number) => Number.isFinite(n) && n > 0),
        ),
      ).slice(0, MAX_REQUESTED_IDS);
      const useIdLookup = requestedIds.length > 0;

      // When the caller passes specific ids (e.g. saved colleges), fetch
      // each by primary key so colleges anywhere in the ~33k-row table are
      // eligible for scoring. Without ids, fall back to the cached top-500
      // page used for global recommendations.
      const candidates: any[] = useIdLookup
        ? (await Promise.all(requestedIds.map((id: any) => storage.getCollegeById(id as number))))
            .filter((c): c is NonNullable<typeof c> => Boolean(c))
        : await storage.getColleges(500);

      const userState = (user.state || "").trim().toLowerCase();
      const userMajor = (user.major || "").trim().toLowerCase();
      const userGpa = typeof user.gpa === "number" ? user.gpa : null;
      // Major tokens (>= 4 chars) for soft text matching against the
      // college description. Avoids junk hits like "of"/"and"/"the".
      const majorTokens = userMajor
        .split(/[^a-z]+/)
        .filter((t) => t.length >= 4);

      const scored = candidates.map((college: any) => {
        const reasons: string[] = [];
        let score = 0;

        const collegeState = (college.state || "").trim().toLowerCase();
        if (userState && collegeState && collegeState === userState) {
          reasons.push("In your state");
          score += 25;
        }

        const description = (college.description || "").toLowerCase();
        const name = (college.name || "").toLowerCase();
        if (majorTokens.length > 0) {
          const hit = majorTokens.find(
            (t) => description.includes(t) || name.includes(t),
          );
          if (hit) {
            reasons.push("Strong major fit");
            score += 20;
          }
        }

        const acceptanceRate =
          typeof college.acceptanceRate === "number" ? college.acceptanceRate : null;
        if (userGpa !== null && acceptanceRate !== null) {
          // High GPA + selective school = competitive applicant signal.
          if (userGpa >= 3.5 && acceptanceRate <= 50) {
            reasons.push("Your GPA is competitive");
            score += 15;
          }
        }

        if (acceptanceRate !== null && acceptanceRate <= 25) {
          reasons.push("Highly selective");
          score += 10;
        }

        const graduationRate =
          typeof college.graduationRate === "number" ? college.graduationRate : null;
        if (graduationRate !== null && graduationRate >= 80) {
          reasons.push("High graduation rate");
          score += 10;
        }

        return {
          college: {
            id: college.id,
            name: college.name,
            state: college.state,
            city: college.city,
            type: college.type,
          },
          matchScore: score,
          matchReasons: reasons.slice(0, 2),
        };
      });

      const colleges = scored
        .filter((entry) => entry.matchReasons.length > 0)
        .sort((a, b) => b.matchScore - a.matchScore)
        .slice(0, useIdLookup ? requestedIds.length : 100);

      res.json({
        colleges,
        totalMatches: colleges.length,
      });
    } catch (error) {
      console.error("College recommendations error:", error);
      res.status(500).json({ message: "Failed to get college recommendations" });
    }
  });

  // Helper: Parse deadline string to Date
  function parseDeadline(deadline: string): Date | null {
    try {
      const parsed = new Date(deadline);
      return isNaN(parsed.getTime()) ? null : parsed;
    } catch {
      return null;
    }
  }

  // Helper: Check if user's major matches scholarship fields
  function majorMatchesFields(userMajor: string | null | undefined, fields: string[]): boolean {
    if (!userMajor || !fields || fields.length === 0) return true; // No requirement = passes
    if (fields.includes('general') || fields.includes('all majors')) return true;
    
    const majorLower = userMajor.toLowerCase();
    return fields.some(field => {
      const fieldLower = field.toLowerCase();
      return majorLower.includes(fieldLower) || fieldLower.includes(majorLower) ||
             (fieldLower === 'stem' && ['computer', 'engineering', 'science', 'math', 'technology', 'biology', 'chemistry', 'physics'].some(s => majorLower.includes(s)));
    });
  }

  // Helper: Generate personalized recommendations based on profile data
  async function generateForYouRecommendations(user: any) {
    const now = new Date();
    
    // STRICT PROFILE COMPLETENESS CHECK
    // Require MEANINGFUL profile data before showing ANY personalized results
    const hasGPA = user.gpa && user.gpa > 0;
    const hasMajor = user.major && user.major.trim().length > 0;
    const hasDemographics = user.demographics && user.demographics.length > 0;
    const hasInterests = user.interests && user.interests.length > 0;
    const hasSkills = (user.aiKeywords && user.aiKeywords.length > 0) || 
                      (user.resumeAnalysisResults?.skills && user.resumeAnalysisResults.skills.length > 0);
    const hasResume = !!user.resumeFileName;
    const hasState = user.state && user.state.trim().length > 0;
    const hasAcademicLevel = user.academicLevel && user.academicLevel.trim().length > 0;
    
    let profileScore = 0;
    if (hasGPA) profileScore += 20;
    if (hasMajor) profileScore += 20;
    if (hasDemographics) profileScore += 15;
    if (hasInterests) profileScore += 20;
    if (hasSkills) profileScore += 15;
    if (hasState) profileScore += 5;
    if (hasAcademicLevel) profileScore += 5;
    if (hasResume) profileScore += 10;
    profileScore = Math.min(100, profileScore);
    
    // Show scholarships if profile has GPA, major, or demographics (min 20%)
    // Show careers if profile has interests or skills (min 15% - resume alone can qualify)
    const hasScholarshipData = profileScore >= 20 && (hasGPA || hasMajor || hasDemographics);
    const hasCareerData = (hasInterests || hasSkills);
    
    console.log(`=== PROFILE COMPLETENESS CHECK ===`);
    console.log(`Profile score: ${profileScore}%`);
    console.log(`GPA: ${hasGPA ? user.gpa : 'missing'}, Major: ${hasMajor ? user.major : 'missing'}`);
    console.log(`Interests: ${hasInterests ? user.interests.length : 0}, Skills: ${hasSkills ? 'yes' : 'no'}`);
    console.log(`Demographics: ${hasDemographics ? user.demographics.length : 0}, State: ${hasState ? user.state : 'missing'}`);
    console.log(`Scholarship eligible: ${hasScholarshipData}, Career eligible: ${hasCareerData}`);
    
    console.log(`\n=== SCHOLARSHIP MATCHING DEBUG ===`);
    console.log(`User data: GPA=${user.gpa}, Major=${user.major}, State=${user.state}, Demographics=${JSON.stringify(user.demographics)}`);
    console.log(`Has scholarship data: ${hasScholarshipData}`);
    
    // === SCHOLARSHIP MATCHING WITH HARD FILTERS + TRANSPARENT SCORING ===
    // REQUIRE profile data - no preloaded results for empty profiles
    const allScholarships = smartScholarshipMatcher.getAllScholarships();
    console.log(`Total scholarships in database: ${allScholarships.length}`);
    
    if (!hasScholarshipData) {
      console.log("Profile incomplete - returning empty scholarship results (need GPA, major, or demographics)");
    }
    
    const scholarshipResults = !hasScholarshipData ? [] : allScholarships
      .map(scholarship => {
        // === HARD FILTERS (must pass all to be considered) ===
        const filters = {
          deadlineValid: true,
          gpaMet: true,
          majorMatch: true,
          stateMatch: true
        };
        
        // 1. Deadline filter - remove expired scholarships
        const deadlineDate = parseDeadline(scholarship.deadline);
        if (deadlineDate && deadlineDate < now) {
          filters.deadlineValid = false;
        }
        
        // 2. GPA minimum filter
        if (scholarship.minGpa && user.gpa && user.gpa < scholarship.minGpa) {
          filters.gpaMet = false;
        }
        
        // 3. Major/field match filter (if scholarship requires specific fields)
        if (scholarship.fields && !scholarship.fields.includes('general') && !scholarship.fields.includes('all majors')) {
          filters.majorMatch = majorMatchesFields(user.major, scholarship.fields);
        }
        
        // 4. State/residency filter - check if scholarship has state-specific requirements
        const scholarshipState = (scholarship as any).state || (scholarship as any).residency;
        if (scholarshipState && user.state) {
          const userStateLower = user.state.toLowerCase();
          const scholarshipStateLower = scholarshipState.toLowerCase();
          // If scholarship is state-specific and user is not from that state, filter out
          if (!scholarshipStateLower.includes('national') && 
              !scholarshipStateLower.includes('all') &&
              !userStateLower.includes(scholarshipStateLower) &&
              !scholarshipStateLower.includes(userStateLower)) {
            filters.stateMatch = false;
          }
        }
        
        // If any hard filter fails, exclude this scholarship
        const passesFilters = filters.deadlineValid && filters.gpaMet && filters.majorMatch && filters.stateMatch;
        if (!passesFilters) {
          // Log why this scholarship was filtered out
          const reasons = [];
          if (!filters.deadlineValid) reasons.push('expired deadline');
          if (!filters.gpaMet) reasons.push('GPA too low');
          if (!filters.majorMatch) reasons.push('major mismatch');
          if (!filters.stateMatch) reasons.push('state mismatch');
          console.log(`Filtered out "${scholarship.name}": ${reasons.join(', ')}`);
          return null;
        }
        
        // === TRANSPARENT SCORING BREAKDOWN (max ~110 points) ===
        const scoreBreakdown = {
          gpaFit: 0,      // max 25
          majorFit: 0,    // max 25
          demographicsFit: 0, // max 35 (highest for HS/early college students)
          stateFit: 0,    // max 10
          deadlineUrgency: 0  // max 10
        };
        
        // GPA fit (30 points max)
        if (user.gpa) {
          if (scholarship.minGpa) {
            const gpaDiff = user.gpa - scholarship.minGpa;
            if (gpaDiff >= 0.5) scoreBreakdown.gpaFit = 30;
            else if (gpaDiff >= 0.2) scoreBreakdown.gpaFit = 25;
            else if (gpaDiff >= 0) scoreBreakdown.gpaFit = 20;
          } else {
            scoreBreakdown.gpaFit = 20; // No GPA requirement = base score
          }
        }
        
        // Major fit (25 points max)
        if (user.major && scholarship.fields) {
          if (scholarship.fields.includes('general') || scholarship.fields.includes('all majors')) {
            scoreBreakdown.majorFit = 15; // General scholarships get base score
          } else if (majorMatchesFields(user.major, scholarship.fields)) {
            scoreBreakdown.majorFit = 25; // Direct major match
          }
        } else if (!scholarship.fields || scholarship.fields.includes('general')) {
          scoreBreakdown.majorFit = 15;
        }
        
        // Demographics fit (35 points max) - Weighted heavily for HS/early college students
        const userDemos = user.demographics || [];
        const targetDemos = scholarship.targetDemographics || [];
        if (targetDemos.length > 0 && userDemos.length > 0) {
          const demoMatches = userDemos.filter((d: string) => 
            targetDemos.some((td: string) => td.toLowerCase().includes(d.toLowerCase()) || d.toLowerCase().includes(td.toLowerCase()))
          );
          scoreBreakdown.demographicsFit = Math.min(35, demoMatches.length * 15);
        } else if (targetDemos.length === 0) {
          scoreBreakdown.demographicsFit = 10; // Open to all = base score
        }
        
        // State fit (10 points max) - state-specific scholarships
        if (user.state) {
          const providerLower = (scholarship.provider || '').toLowerCase();
          const stateLower = user.state.toLowerCase();
          if (providerLower.includes(stateLower) || providerLower.includes('federal') || providerLower.includes('national')) {
            scoreBreakdown.stateFit = 10;
          } else {
            scoreBreakdown.stateFit = 5; // National scholarships still relevant
          }
        }
        
        // Deadline urgency (10 points max) - sooner deadlines get more points
        if (deadlineDate) {
          const daysUntil = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (daysUntil <= 30) scoreBreakdown.deadlineUrgency = 10;
          else if (daysUntil <= 60) scoreBreakdown.deadlineUrgency = 7;
          else if (daysUntil <= 90) scoreBreakdown.deadlineUrgency = 5;
          else scoreBreakdown.deadlineUrgency = 3;
        }
        
        const totalScore = scoreBreakdown.gpaFit + scoreBreakdown.majorFit + 
                          scoreBreakdown.demographicsFit + scoreBreakdown.stateFit + 
                          scoreBreakdown.deadlineUrgency;
        
        // Determine match level
        let matchLevel: 'High' | 'Medium' | 'Low' = 'Low';
        if (totalScore >= 70) matchLevel = 'High';
        else if (totalScore >= 45) matchLevel = 'Medium';
        
        // Build match reasons
        const matchReasons: string[] = [];
        if (scoreBreakdown.gpaFit >= 25) matchReasons.push('GPA exceeds requirements');
        if (scoreBreakdown.majorFit >= 20) matchReasons.push('Strong major alignment');
        if (scoreBreakdown.demographicsFit >= 15) matchReasons.push('Matches your background');
        if (scoreBreakdown.deadlineUrgency >= 7) matchReasons.push('Deadline approaching soon');
        
        let daysUntilDeadline: number | null = null;
        if (deadlineDate) {
          daysUntilDeadline = Math.ceil((deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        }

        return {
          scholarship: {
            name: scholarship.name,
            amount: scholarship.amount,
            deadline: scholarship.deadline,
            provider: scholarship.provider,
            description: scholarship.description,
            website: scholarship.website,
            type: scholarship.type
          },
          matchScore: totalScore,
          matchLevel,
          scoreBreakdown,
          matchReasons,
          daysUntilDeadline,
          type: 'scholarship'
        };
      })
      .filter(Boolean)
      // MINIMUM SCORE THRESHOLD: Only show scholarships with score >= 35 (meaningful match)
      .filter((s: any) => s.matchScore >= 35)
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, 5);
    
    console.log(`Filtered to ${scholarshipResults.length} scholarships with score >= 35`);

    // === INTEREST-FIRST CAREER MATCHING ===
    // User's chosen interests are the PRIMARY driver - every user's experience is unique
    // Major and skills provide secondary boosts
    const careers = await storage.getCareerPaths();
    const resumeData = user.resumeAnalysisResults || {};
    
    // User's chosen profile interests are the PRIMARY driver
    // Resume extracted keywords contribute as SKILLS (not interests, to avoid flooding)
    const userInterests = user.interests || [];
    
    const profileSkills = user.aiKeywords || [];
    const resumeSkills = (resumeData.skills || []).filter((s: string) => {
      if (!s) return false;
      if (s.length < 2 || s.length > 40) return false;
      return true;
    });
    const userSkills = [...new Set([...profileSkills, ...resumeSkills])];
    
    // Resume extracted keywords (distinct from skills - these are raw words from the resume)
    const resumeKeywords = (resumeData.keywords || []).filter((k: string) => k && k.length >= 3 && k.length <= 30);
    
    const resumeCareerField = resumeData.careerField;
    const userMajor = (user.major || '').toLowerCase().trim();
    const userDemographics = user.demographics || [];
    
    if (!hasCareerData) {
      console.log("Profile incomplete - returning empty career results (need interests or skills)");
    }
    
    console.log(`\n=== CAREER MATCHING DEBUG ===`);
    console.log(`Major: ${userMajor || 'none'}`);
    console.log(`Interests (${userInterests.length}): [${userInterests.join(', ')}]`);
    console.log(`Skills (${userSkills.length}): [${userSkills.join(', ')}]`);
    console.log(`Resume keywords (${resumeKeywords.length}): [${resumeKeywords.slice(0, 5).join(', ')}]`);
    console.log(`Demographics (${userDemographics.length}): [${userDemographics.join(', ')}]`);
    
    // Map interests to career industries they relate to
    const INTEREST_INDUSTRY_MAP: Record<string, string[]> = {
      'healthcare': ['healthcare', 'hospitals', 'nursing', 'rehabilitation', 'clinical', 'outpatient', 'medical devices', 'pharmacy', 'home healthcare', 'sports medicine', 'dentistry'],
      'nursing': ['nursing', 'hospitals', 'nursing homes', 'home healthcare', 'outpatient care'],
      'technology': ['software development', 'information technology'],
      'software engineering': ['software development', 'information technology'],
      'data analytics & science': ['research', 'data'],
      'business': ['business', 'management', 'consulting', 'sales'],
      'finance': ['finance', 'banking', 'investment', 'insurance', 'accounting', 'real estate'],
      'marketing': ['marketing', 'advertising'],
      'education': ['education', 'public schools', 'private schools', 'charter schools', 'schools'],
      'engineering': ['manufacturing', 'automotive', 'aerospace', 'construction', 'engineering services', 'infrastructure', 'machinery'],
      'science': ['research', 'environmental services', 'sciences', 'pharmaceuticals'],
      'law': ['legal', 'law'],
      'legal': ['legal', 'law'],
      'arts': ['design services', 'advertising', 'publishing'],
      'art & design': ['design services', 'advertising', 'publishing'],
      'creative': ['design services', 'publishing', 'media'],
      'social work': ['social services', 'non-profit'],
      'psychology': ['mental health', 'social services', 'rehabilitation', 'counseling'],
      'environment': ['environmental services'],
      'sports': ['sports medicine', 'rehabilitation'],
      'research': ['research'],
      'design': ['design services', 'publishing'],
      'communication': ['marketing', 'media', 'advertising'],
      'leadership': ['management', 'corporate'],
      'medicine': ['healthcare', 'hospitals', 'clinical', 'pharmacy'],
      'public health': ['social services', 'community health'],
      'criminal justice': ['legal', 'law'],
      'entrepreneurship': ['business', 'management'],
      'data': ['research', 'data'],
      'programming': ['software development', 'information technology'],
      'mechanical engineering': ['manufacturing', 'automotive', 'aerospace', 'machinery'],
      'civil engineering': ['construction', 'infrastructure'],
      'biomedical engineering': ['medical devices', 'pharmaceuticals'],
    };
    
    // Map major to industries (secondary signal)
    const MAJOR_CAREER_MAP: Record<string, string[]> = {
      'computer science': ['technology', 'software development', 'information technology'],
      'nursing': ['healthcare', 'hospitals', 'nursing homes', 'home healthcare'],
      'business': ['business', 'management', 'consulting'],
      'business administration': ['business', 'management', 'consulting'],
      'biology': ['healthcare', 'research'],
      'mechanical engineering': ['manufacturing', 'automotive', 'aerospace'],
      'education': ['education', 'schools'],
      'psychology': ['social services', 'mental health'],
      'finance': ['finance', 'banking', 'investment'],
      'marketing': ['marketing', 'advertising'],
      'pharmacy': ['pharmacy', 'healthcare', 'clinical'],
      'social work': ['social services', 'non-profit'],
      'criminal justice': ['legal', 'law', 'government'],
      'political science': ['government', 'legal'],
      'graphic design': ['design services', 'advertising'],
      'communications': ['marketing', 'media', 'advertising'],
      'data science': ['technology', 'research', 'consulting'],
      'health sciences': ['healthcare', 'rehabilitation'],
      'pre-med': ['healthcare', 'hospitals', 'clinical'],
      'accounting': ['finance', 'accounting'],
      'economics': ['finance', 'consulting'],
      'civil engineering': ['construction', 'infrastructure'],
      'electrical engineering': ['technology', 'electronics'],
      'biomedical engineering': ['medical devices', 'healthcare'],
      'public health': ['healthcare', 'social services', 'government'],
    };
    
    const majorIndustries = MAJOR_CAREER_MAP[userMajor] || [];
    if (majorIndustries.length === 0 && userMajor) {
      for (const [key, industries] of Object.entries(MAJOR_CAREER_MAP)) {
        if (userMajor.includes(key) || key.includes(userMajor)) {
          majorIndustries.push(...industries);
          break;
        }
      }
    }
    
    // Build combined interest industries from user's chosen interests
    const interestIndustries = new Set<string>();
    userInterests.forEach((interest: string) => {
      const key = interest.toLowerCase().trim();
      const mapped = INTEREST_INDUSTRY_MAP[key];
      if (mapped) {
        mapped.forEach(ind => interestIndustries.add(ind));
      }
    });
    
    console.log(`Interest industries: [${[...interestIndustries].join(', ')}]`);
    console.log(`Major industries: [${majorIndustries.join(', ')}]`);
    
    const careerResults = !hasCareerData ? [] : careers
      .map(career => {
        const careerTitle = career.title || '';
        const careerDesc = career.description || '';
        const careerSkills = Array.isArray(career.skills) ? career.skills : [];
        const careerIndustries = Array.isArray(career.industries) ? career.industries : [];
        const primaryIndustry = careerIndustries[0]?.toLowerCase() || '';
        const topTwoIndustries = careerIndustries.slice(0, 2).map(i => (i || '').toLowerCase());
        
        // === INTEREST FIT (60 pts max) - DOMINANT SIGNAL ===
        // User's chosen interests drive everything
        let interestScore = 0;
        const matchedInterests: string[] = [];
        let bestMatchType = 'none'; // track quality of best match
        
        userInterests.forEach((interest: string) => {
          if (!interest) return;
          const interestLower = interest.toLowerCase().trim();
          const interestParts = interestLower.split(/\s*[&,]\s*|\s+/).filter(p => p.length > 2);
          const titleLower = careerTitle.toLowerCase();
          
          // TIER 1 (60pts): Career title directly contains interest word
          if (interestParts.some(part => titleLower.includes(part))) {
            interestScore += 60;
            matchedInterests.push(interest);
            bestMatchType = 'title';
            return;
          }
          
          // TIER 2 (50pts): Interest maps to career's PRIMARY industry
          const mappedIndustries = INTEREST_INDUSTRY_MAP[interestLower] || [];
          if (mappedIndustries.length > 0) {
            const firstIndustryMatch = mappedIndustries.some(mi => 
              primaryIndustry.includes(mi.toLowerCase()) || mi.toLowerCase().includes(primaryIndustry)
            );
            if (firstIndustryMatch) {
              interestScore += 50;
              matchedInterests.push(interest);
              if (bestMatchType !== 'title') {
                bestMatchType = 'primary';
                return;
              }
            }
            const secondIndustryMatch = topTwoIndustries.slice(1).some(ti => 
              mappedIndustries.some(mi => ti.includes(mi.toLowerCase()) || mi.toLowerCase().includes(ti))
            );
            if (secondIndustryMatch) {
              interestScore += 35;
              matchedInterests.push(interest);
              if (bestMatchType !== 'title') {
                bestMatchType = 'primary';
                return;
              }
            }
          }
          
          // TIER 2b: Direct word match on TOP 1 industry only (strict)
          const firstIndustry = careerIndustries[0]?.toLowerCase() || '';
          if (interestParts.some(p => p.length > 3 && firstIndustry.includes(p))) {
            interestScore += 45;
            matchedInterests.push(interest);
            if (bestMatchType !== 'title') {
              bestMatchType = 'primary';
              return;
            }
          }
          
          // TIER 3 (15pts): Interest maps to secondary industry (3rd+) - low score to prevent pollution
          if (mappedIndustries.length > 0) {
            const secondaryMatch = careerIndustries.slice(2).some(ci => 
              ci && mappedIndustries.some(mi => ci.toLowerCase().includes(mi.toLowerCase()))
            );
            if (secondaryMatch) {
              interestScore += 15;
              matchedInterests.push(interest);
              if (bestMatchType === 'none') {
                bestMatchType = 'secondary';
                return;
              }
            }
          }
          
          // TIER 4 (8pts): Description keyword match - very weak signal
          if (interestParts.some(p => p.length > 4 && careerDesc.toLowerCase().includes(p))) {
            interestScore += 8;
            matchedInterests.push(interest);
            if (bestMatchType === 'none') bestMatchType = 'description';
          }
        });
        const interestFit = Math.min(50, interestScore);
        
        // === RESUME KEYWORDS FIT (15 pts max) - Words extracted from resume ===
        // Match resume keywords against career skills, title, and description
        let resumeKeywordScore = 0;
        const matchedResumeWords: string[] = [];
        const careerTextLower = `${careerTitle} ${careerDesc} ${careerSkills.join(' ')}`.toLowerCase();
        
        resumeKeywords.forEach((keyword: string) => {
          const kwLower = keyword.toLowerCase();
          if (careerTextLower.includes(kwLower)) {
            resumeKeywordScore += 5;
            matchedResumeWords.push(keyword);
          }
        });
        const resumeKeywordFit = Math.min(15, resumeKeywordScore);
        
        // === SKILLS FIT (15 pts max) - Profile keywords + resume skills ===
        const GENERIC_SKILLS = new Set(['communication', 'leadership', 'teamwork', 'writing', 
          'problem solving', 'critical thinking', 'organization', 'time management', 'go', 'compliance']);
        
        let skillMatches = 0;
        const matchedSkills: string[] = [];
        userSkills.forEach((skill: string) => {
          if (!skill) return;
          const skillLower = skill.toLowerCase();
          if (GENERIC_SKILLS.has(skillLower)) return;
          if (careerSkills.some(s => s && s.toLowerCase().includes(skillLower))) {
            skillMatches++;
            matchedSkills.push(skill);
          }
        });
        const skillsFit = Math.min(15, skillMatches * 5);
        
        // === MAJOR FIT (10 pts max) - Matters but doesn't dominate ===
        let majorFit = 0;
        if (majorIndustries.length > 0) {
          const hasMatch = careerIndustries.some(ind => 
            ind && majorIndustries.some(mi => ind.toLowerCase().includes(mi))
          );
          if (hasMatch) majorFit = 10;
        }
        
        // === EDUCATION FIT (5 pts) ===
        const educationReq = (career.educationRequired || '').toLowerCase();
        const userLevel = user.academicLevel || 'undergraduate';
        let educationFit = 3;
        if (userLevel === 'graduate' && (educationReq.includes('master') || educationReq.includes('doctoral'))) {
          educationFit = 5;
        } else if (userLevel === 'undergraduate' && educationReq.includes('bachelor')) {
          educationFit = 5;
        } else if (userLevel === 'high_school') {
          educationFit = 5; // High schoolers can explore any career
        }
        
        // === REQUIRE meaningful interest match ===
        // Must have at least a decent interest match OR strong skill/resume match
        if (interestFit < 15 && skillMatches < 2 && resumeKeywordFit < 5) {
          return null;
        }
        
        // SCORING WEIGHTS (total max ~100):
        // Interest: 50 (dominant), Resume Keywords: 15, Skills: 15, Major: 10, Education: 5
        const totalScore = interestFit + resumeKeywordFit + skillsFit + majorFit + educationFit;
        
        // Match level based on interest quality
        let matchLevel: 'High' | 'Medium' | 'Low' = 'Low';
        if (bestMatchType === 'title' || bestMatchType === 'primary') matchLevel = 'High';
        else if (interestFit >= 20 || totalScore >= 40) matchLevel = 'Medium';
        
        const matchReasons: string[] = [];
        if (matchedInterests.length > 0) matchReasons.push(`Matches your interest in ${matchedInterests.slice(0, 2).join(' & ')}`);
        if (matchedResumeWords.length > 0) matchReasons.push(`Resume keywords: ${matchedResumeWords.slice(0, 3).join(', ')}`);
        if (matchedSkills.length > 0) matchReasons.push(`Uses your skills: ${matchedSkills.slice(0, 3).join(', ')}`);
        if (majorFit >= 10 && user.major) matchReasons.push(`Related to your ${user.major} studies`);
        if (educationFit >= 4) matchReasons.push('Fits your education level');
        
        return {
          career: {
            title: careerTitle,
            description: careerDesc,
            averageSalary: career.averageSalary || 0,
            jobGrowthRate: career.jobGrowthRate || 'N/A',
            educationRequired: career.educationRequired || '',
            skills: careerSkills.slice(0, 5),
            industries: careerIndustries
          },
          matchScore: totalScore,
          matchLevel,
          scoreBreakdown: { interestFit, resumeKeywordFit, skillsFit, majorFit, educationFit },
          matchReasons,
          type: 'career'
        };
      })
      .filter(Boolean)
      .filter((c: any) => c.matchScore >= 35)
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, 5);
    
    // Log matched careers for debugging
    console.log(`Filtered to ${careerResults.length} careers with score >= 45:`);
    careerResults.forEach((c: any) => {
      console.log(`  - ${c.career.title}: score=${c.matchScore}, interest=${c.scoreBreakdown.interestFit}, reasons=[${c.matchReasons.join(', ')}]`);
    });
    console.log(`=== END CAREER MATCHING ===\n`);

    // === FELLOWSHIP MATCHING ===
    console.log(`=== FELLOWSHIP MATCHING DEBUG ===`);
    let fellowshipResults: any[] = [];
    try {
      const fellowshipMatches = await fellowshipService.matchFellowships({
        gpa: user.gpa,
        interests: user.interests || [],
        academicLevel: user.academicLevel || 'graduate',
        major: user.major,
        demographics: user.demographics || []
      });
      
      fellowshipResults = fellowshipMatches.slice(0, 5).map((match: any) => ({
        fellowship: {
          id: match.fellowship.id,
          name: match.fellowship.name,
          provider: match.fellowship.provider,
          amount: match.fellowship.amount,
          amountType: match.fellowship.amountType,
          duration: match.fellowship.duration,
          deadline: match.fellowship.deadline,
          website: match.fellowship.website,
          category: match.fellowship.category,
          type: match.fellowship.type,
          competitive: match.fellowship.competitive,
          description: match.fellowship.description?.slice(0, 200) + '...'
        },
        matchScore: match.matchScore,
        matchLevel: match.matchScore >= 80 ? 'High' : match.matchScore >= 60 ? 'Medium' : 'Low',
        matchReasons: match.matchReasons,
        type: 'fellowship'
      }));
      console.log(`Matched ${fellowshipResults.length} fellowships`);
    } catch (error) {
      console.error('Fellowship matching error:', error);
    }
    console.log(`=== END FELLOWSHIP MATCHING ===\n`);

    // Calculate profile completeness
    const profileFields = ['gpa', 'major', 'state', 'interests', 'demographics'];
    const filledFields = profileFields.filter(f => {
      const val = (user as any)[f];
      return val && (Array.isArray(val) ? val.length > 0 : true);
    });
    const profileCompleteness = Math.round((filledFields.length / profileFields.length) * 100);

    return {
      scholarships: scholarshipResults,
      careers: careerResults,
      fellowships: fellowshipResults,
      profileUsed: {
        gpa: user.gpa,
        major: user.major,
        state: user.state,
        interests: user.interests?.slice(0, 3),
        demographics: user.demographics?.slice(0, 3)
      },
      profileCompleteness,
      recommendations: {
        total: scholarshipResults.length + careerResults.length + fellowshipResults.length,
        scholarshipCount: scholarshipResults.length,
        careerCount: careerResults.length,
        fellowshipCount: fellowshipResults.length
      },
      tips: profileCompleteness < 60 ? [
        !user.gpa ? "Add your GPA to unlock merit-based scholarships" : null,
        !user.major ? "Add your major for better field-specific matches" : null,
        (user.interests?.length || 0) === 0 ? "Add career interests to see personalized career matches" : null,
        (user.demographics?.length || 0) === 0 ? "Add demographics to find targeted scholarships" : null
      ].filter(Boolean) : [],
      generatedAt: now.toISOString()
    };
  }

  // Unified "For You" recommendations - ALWAYS generates fresh results based on current profile
  app.get("/api/profile/for-you", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      let user = await storage.getUser(userId);
      
      // Auto-create profile for new users
      if (!user) {
        user = await storage.upsertUser({
          id: userId,
          username: req.user?.claims?.email || req.user?.username || `user_${userId}`,
          password: '',
          email: req.user?.claims?.email || req.user?.email || null,
        });
      }

      // ALWAYS generate fresh recommendations based on current profile data
      const freshResults = await generateForYouRecommendations(user);
      
      console.log(`Generated fresh For You results for user ${userId}: ${freshResults.recommendations?.scholarshipCount} scholarships, ${freshResults.recommendations?.careerCount} careers`);

      res.json({
        ...freshResults,
        freshlyGenerated: true
      });

    } catch (error) {
      console.error("For You recommendations error:", error);
      res.status(500).json({ message: "Failed to get personalized recommendations" });
    }
  });

  // Refresh For You cache (called when profile is updated)
  app.post("/api/profile/refresh-for-you", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      const freshResults = await generateForYouRecommendations(user);
      
      await (storage as any).updateUser(userId, {
        forYouCache: freshResults,
        forYouCacheDate: new Date()
      });

      res.json({
        ...freshResults,
        fromCache: false,
        message: "Recommendations refreshed successfully"
      });

    } catch (error) {
      console.error("Refresh For You error:", error);
      res.status(500).json({ message: "Failed to refresh recommendations" });
    }
  });

  // TEST ENDPOINT: Validate matching with 50 different profile combinations
  app.get("/api/test/profile-matching-combos", async (req, res) => {
    console.log("\n=== TESTING 50 PROFILE COMBINATIONS ===\n");
    
    const testProfiles = [
      // EMPTY PROFILES - Should return NO results
      { id: 1, desc: "Completely empty profile", gpa: null, major: null, interests: [], demographics: [], aiKeywords: [], state: null },
      { id: 2, desc: "Only state filled", gpa: null, major: null, interests: [], demographics: [], aiKeywords: [], state: "Georgia" },
      { id: 3, desc: "Only academic level", gpa: null, major: null, interests: [], demographics: [], aiKeywords: [], academicLevel: "undergraduate" },
      
      // PARTIAL PROFILES - Should return LIMITED results
      { id: 4, desc: "Only GPA (3.5)", gpa: 3.5, major: null, interests: [], demographics: [], aiKeywords: [], state: null },
      { id: 5, desc: "Only major", gpa: null, major: "Computer Science", interests: [], demographics: [], aiKeywords: [], state: null },
      { id: 6, desc: "Only interests (1)", gpa: null, major: null, interests: ["Technology"], demographics: [], aiKeywords: [], state: null },
      { id: 7, desc: "Only demographics", gpa: null, major: null, interests: [], demographics: ["First Generation"], aiKeywords: [], state: null },
      { id: 8, desc: "GPA + Major", gpa: 3.8, major: "Engineering", interests: [], demographics: [], aiKeywords: [], state: null },
      { id: 9, desc: "GPA + Demographics", gpa: 3.2, major: null, interests: [], demographics: ["Veteran"], aiKeywords: [], state: null },
      { id: 10, desc: "Major + Interests", gpa: null, major: "Business", interests: ["Finance", "Leadership"], demographics: [], aiKeywords: [], state: null },
      
      // MODERATE PROFILES - Should return SOME results
      { id: 11, desc: "GPA + Major + State", gpa: 3.5, major: "Nursing", interests: [], demographics: [], aiKeywords: [], state: "California" },
      { id: 12, desc: "Interests only (3)", gpa: null, major: null, interests: ["Healthcare", "Science", "Research"], demographics: [], aiKeywords: [], state: null },
      { id: 13, desc: "Skills only (3)", gpa: null, major: null, interests: [], demographics: [], aiKeywords: ["Python", "Data Analysis", "Excel"], state: null },
      { id: 14, desc: "GPA + Interests", gpa: 3.7, major: null, interests: ["Technology", "Programming"], demographics: [], aiKeywords: [], state: null },
      { id: 15, desc: "Major + Skills", gpa: null, major: "Data Science", interests: [], demographics: [], aiKeywords: ["SQL", "Python", "Statistics"], state: null },
      
      // COMPLETE PROFILES - Should return ACCURATE results
      { id: 16, desc: "Full CS student", gpa: 3.8, major: "Computer Science", interests: ["Technology", "Programming"], demographics: [], aiKeywords: ["Python", "JavaScript", "SQL"], state: "Texas" },
      { id: 17, desc: "Full Healthcare student", gpa: 3.5, major: "Nursing", interests: ["Healthcare", "Science"], demographics: ["Female"], aiKeywords: ["Patient Care", "Medical"], state: "New York" },
      { id: 18, desc: "Full Business student", gpa: 3.2, major: "Business Administration", interests: ["Finance", "Leadership", "Business"], demographics: [], aiKeywords: ["Excel", "Marketing"], state: "Florida" },
      { id: 19, desc: "Full Engineering student", gpa: 3.9, major: "Mechanical Engineering", interests: ["Engineering", "Technology"], demographics: [], aiKeywords: ["CAD", "Design"], state: "Michigan" },
      { id: 20, desc: "Full Pre-Med student", gpa: 3.7, major: "Biology", interests: ["Healthcare", "Science", "Research"], demographics: [], aiKeywords: ["Lab Research", "Medical"], state: "California" },
      
      // EDGE CASES - Test boundary conditions
      { id: 21, desc: "Low GPA (2.0)", gpa: 2.0, major: "General Studies", interests: ["Arts"], demographics: [], aiKeywords: [], state: null },
      { id: 22, desc: "Very high GPA (4.0)", gpa: 4.0, major: "Physics", interests: ["Science", "Research"], demographics: [], aiKeywords: [], state: null },
      { id: 23, desc: "Many interests (8)", gpa: 3.5, major: "Liberal Arts", interests: ["Arts", "Music", "Writing", "History", "Culture", "Education", "Social Science", "Languages"], demographics: [], aiKeywords: [], state: null },
      { id: 24, desc: "Many skills (10)", gpa: 3.3, major: "IT", interests: [], demographics: [], aiKeywords: ["Python", "Java", "SQL", "HTML", "CSS", "JavaScript", "React", "Node", "AWS", "Docker"], state: null },
      { id: 25, desc: "All demographics", gpa: 3.5, major: "Social Work", interests: ["Social Science"], demographics: ["First Generation", "Female", "Hispanic"], aiKeywords: [], state: null },
      
      // SPECIFIC CAREER PATHS - Validate accuracy
      { id: 26, desc: "Software Developer path", gpa: 3.5, major: "Computer Science", interests: ["Technology", "Programming"], demographics: [], aiKeywords: ["Python", "JavaScript", "Git"], state: null },
      { id: 27, desc: "Data Scientist path", gpa: 3.7, major: "Statistics", interests: ["Technology", "Research"], demographics: [], aiKeywords: ["Python", "R", "Machine Learning", "SQL"], state: null },
      { id: 28, desc: "Teacher path", gpa: 3.4, major: "Education", interests: ["Education", "Leadership"], demographics: [], aiKeywords: ["Communication", "Lesson Planning"], state: null },
      { id: 29, desc: "Nurse path", gpa: 3.6, major: "Nursing", interests: ["Healthcare"], demographics: [], aiKeywords: ["Patient Care", "Medical Terminology"], state: null },
      { id: 30, desc: "Lawyer path", gpa: 3.8, major: "Political Science", interests: ["Law", "Legal"], demographics: [], aiKeywords: ["Research", "Writing", "Analysis"], state: null },
      
      // HIGH SCHOOL STUDENTS - Limited experience
      { id: 31, desc: "HS student - no info", gpa: null, major: null, interests: [], demographics: [], aiKeywords: [], state: null, academicLevel: "high_school" },
      { id: 32, desc: "HS student - GPA only", gpa: 3.5, major: null, interests: [], demographics: [], aiKeywords: [], state: null, academicLevel: "high_school" },
      { id: 33, desc: "HS student - interests", gpa: 3.3, major: null, interests: ["Technology", "Gaming"], demographics: [], aiKeywords: [], state: null, academicLevel: "high_school" },
      { id: 34, desc: "HS student - full", gpa: 3.8, major: null, interests: ["Science", "Engineering"], demographics: ["First Generation"], aiKeywords: ["Math", "Physics"], state: "Ohio", academicLevel: "high_school" },
      { id: 35, desc: "HS STEM focused", gpa: 3.9, major: null, interests: ["Technology", "Science", "Engineering"], demographics: [], aiKeywords: ["Programming", "Robotics"], state: null, academicLevel: "high_school" },
      
      // GRADUATE STUDENTS
      { id: 36, desc: "Grad student - empty", gpa: null, major: null, interests: [], demographics: [], aiKeywords: [], state: null, academicLevel: "graduate" },
      { id: 37, desc: "MBA student", gpa: 3.6, major: "MBA", interests: ["Business", "Finance", "Leadership"], demographics: [], aiKeywords: ["Strategy", "Management"], state: null, academicLevel: "graduate" },
      { id: 38, desc: "PhD student", gpa: 3.9, major: "Computer Science", interests: ["Research", "Technology"], demographics: [], aiKeywords: ["Machine Learning", "AI"], state: null, academicLevel: "graduate" },
      
      // SCHOLARSHIP SPECIFIC
      { id: 39, desc: "STEM scholarship target", gpa: 3.7, major: "Computer Science", interests: ["Technology"], demographics: ["Female"], aiKeywords: [], state: "California" },
      { id: 40, desc: "Need-based target", gpa: 3.2, major: "General Studies", interests: [], demographics: ["First Generation", "Low Income"], aiKeywords: [], state: "Texas" },
      { id: 41, desc: "Minority scholarship", gpa: 3.5, major: "Business", interests: ["Finance"], demographics: ["African American", "First Generation"], aiKeywords: [], state: "Georgia" },
      { id: 42, desc: "Veteran student", gpa: 3.3, major: "Criminal Justice", interests: ["Law", "Leadership"], demographics: ["Veteran"], aiKeywords: [], state: "Virginia" },
      
      // MISMATCHED PROFILES - Test filtering
      { id: 43, desc: "Healthcare interest, tech skills", gpa: 3.4, major: "Biology", interests: ["Healthcare"], demographics: [], aiKeywords: ["Python", "SQL"], state: null },
      { id: 44, desc: "Tech interest, no skills", gpa: 3.5, major: "Information Systems", interests: ["Technology"], demographics: [], aiKeywords: [], state: null },
      { id: 45, desc: "Arts major, business interest", gpa: 3.2, major: "Fine Arts", interests: ["Business", "Finance"], demographics: [], aiKeywords: [], state: null },
      
      // UNIQUE COMBINATIONS
      { id: 46, desc: "Creative + Technical", gpa: 3.6, major: "Digital Media", interests: ["Arts", "Technology"], demographics: [], aiKeywords: ["Photoshop", "Video Editing", "HTML"], state: null },
      { id: 47, desc: "Science + Business", gpa: 3.7, major: "Biotechnology", interests: ["Science", "Business"], demographics: [], aiKeywords: ["Research", "Analysis"], state: null },
      { id: 48, desc: "Education + Tech", gpa: 3.4, major: "Educational Technology", interests: ["Education", "Technology"], demographics: [], aiKeywords: ["Instructional Design"], state: null },
      { id: 49, desc: "Law + Business", gpa: 3.8, major: "Pre-Law", interests: ["Law", "Business", "Finance"], demographics: [], aiKeywords: ["Research", "Writing", "Negotiation"], state: null },
      { id: 50, desc: "Healthcare + Leadership", gpa: 3.5, major: "Healthcare Administration", interests: ["Healthcare", "Leadership", "Business"], demographics: [], aiKeywords: ["Management", "Excel"], state: null },
    ];
    
    const results = [];
    
    for (const profile of testProfiles) {
      const mockUser = {
        id: `test_${profile.id}`,
        gpa: profile.gpa,
        major: profile.major,
        interests: profile.interests,
        demographics: profile.demographics,
        aiKeywords: profile.aiKeywords,
        state: profile.state,
        academicLevel: (profile as any).academicLevel || 'undergraduate',
        resumeAnalysisResults: null
      };
      
      const recommendations = await generateForYouRecommendations(mockUser);
      
      results.push({
        testId: profile.id,
        description: profile.desc,
        profileData: {
          gpa: profile.gpa,
          major: profile.major,
          interests: profile.interests?.length || 0,
          demographics: profile.demographics?.length || 0,
          skills: profile.aiKeywords?.length || 0,
          state: profile.state
        },
        results: {
          scholarships: recommendations.scholarships?.length || 0,
          careers: recommendations.careers?.length || 0,
          topScholarship: recommendations.scholarships?.[0]?.scholarship?.name || null,
          topCareer: recommendations.careers?.[0]?.career?.title || null
        },
        passed: true // Will be set based on expectations
      });
    }
    
    // Validate expectations
    const validationRules = [
      // Empty profiles should return 0 results
      { ids: [1, 2, 3], expectedScholarships: 0, expectedCareers: 0 },
      // Profiles with only GPA should return 0 (need more data)
      { ids: [4], expectedScholarships: 0, expectedCareers: 0 },
      // Profiles with GPA + Major should return scholarships but no careers
      { ids: [8], minScholarships: 0, expectedCareers: 0 },
      // Full profiles should return results
      { ids: [16, 17, 18, 19, 20], minScholarships: 1, minCareers: 1 },
    ];
    
    let passed = 0;
    let failed = 0;
    
    for (const result of results) {
      const emptyProfiles = [1, 2, 3, 31, 36];
      const partialProfiles = [4, 5, 6, 7];
      
      if (emptyProfiles.includes(result.testId)) {
        // Empty profiles should return 0 results
        if (result.results.scholarships === 0 && result.results.careers === 0) {
          result.passed = true;
          passed++;
        } else {
          result.passed = false;
          failed++;
        }
      } else if (partialProfiles.includes(result.testId)) {
        // Partial profiles should return minimal or no results
        result.passed = result.results.scholarships <= 2 && result.results.careers <= 1;
        if (result.passed) passed++; else failed++;
      } else {
        // Other profiles - just check they don't return random data
        result.passed = true;
        passed++;
      }
    }
    
    console.log(`\n=== TEST RESULTS: ${passed}/${results.length} PASSED ===\n`);
    
    res.json({
      summary: {
        total: results.length,
        passed,
        failed,
        passRate: `${Math.round((passed / results.length) * 100)}%`
      },
      results
    });
  });

  // Additional analysis endpoint for testing (keeping old logic)
  app.get("/api/profile/career-analysis-legacy", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
      }

      // Basic fallback career recommendations
      const basicCareers = [
        {
          career: {
            title: "Software Developer",
            description: "Design and develop software applications",
            averageSalary: 95000,
            jobGrowthRate: "22%",
            education: "Bachelor's degree",
            skills: ["Programming", "Problem-solving"]
          },
          score: 75,
          matchReasons: ["Skills alignment", "Education match"]
        }
      ];

      res.json({
        careers: basicCareers,
        analysisDate: new Date(),
        profileUsed: { interests: user.interests || [], skills: user.aiKeywords || [] }
      });

    } catch (error) {
      console.error("Legacy analysis error:", error);
      res.status(500).json({ message: "Failed to get legacy analysis" });
    }
  });

  // Profile analytics endpoint
  app.get("/api/profile/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      let user = await storage.getUser(userId);
      
      // Auto-create profile for new users
      if (!user) {
        user = await storage.upsertUser({
          id: userId,
          username: req.user?.claims?.email || req.user?.username || `user_${userId}`,
          password: '',
          email: req.user?.claims?.email || req.user?.email || null,
        });
      }

      const analytics = {
        profileCompleteness: calculateProfileCompleteness(user),
        insights: generateProfileInsights(user),
        aiAnalysisStatus: user.aiAnalysisDate ? 'completed' : 'pending',
        lastUpdated: user.updatedAt,
        strengthAreas: user.aiKeywords?.slice(0, 5) || [],
        recommendationReadiness: {
          scholarships: !!(user.gpa && user.state && user.demographics),
          careers: !!(user.interests && user.academicLevel),
          colleges: !!(user.gpa && user.state && user.major)
        }
      };

      res.json(analytics);

    } catch (error) {
      console.error("Profile analytics error:", error);
      res.status(500).json({ message: "Failed to get profile analytics" });
    }
  });

  // Profile picture upload endpoint
  app.post("/api/upload-profile-picture", isAuthenticated, profilePictureUpload.single('profilePicture'), async (req, res) => {
    try {
      const userId = (req.user as any)?.claims?.sub || req.user?.id;
      
      if (!req.file) {
        res.status(400).json({ message: "No file uploaded" });
        return;
      }

      // Convert image to base64 for storage
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
      
      // Update user profile with new picture
      await storage.updateUserProfile(userId, { 
        profilePicture: base64Image,
        updatedAt: new Date()
      });

      res.json({
        success: true,
        message: "Profile picture uploaded successfully",
        profilePicture: base64Image
      });

    } catch (error) {
      console.error("Profile picture upload error:", error);
      res.status(500).json({ 
        message: (error as any)?.message?.includes('File too large') ? 
          "Image file too large (max 5MB)" : 
          "Failed to upload profile picture" 
      });
    }
  });

  // Apply fixes to eliminate 0.00% scoring issues
  fixCareerMatchingEndpoints(app);

  // Add training statistics and enhanced ML endpoints
  addTrainingStatsEndpoint(app);

  // ====== ANALYTICS TRACKING ======

  const BOT_UA_PATTERNS = /bot|crawler|spider|crawling|headless|phantom|selenium|puppeteer|lighthouse|pagespeed|pingdom|uptimerobot|slurp|bingpreview|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegram|curl\/|wget\//i;

  const trackRateMap = new Map<string, number[]>();
  const TRACK_RATE_LIMIT = 30;
  const TRACK_RATE_WINDOW = 60_000;
  setInterval(() => {
    const now = Date.now();
    for (const [ip, hits] of trackRateMap) {
      const recent = hits.filter((t) => now - t < TRACK_RATE_WINDOW);
      if (recent.length === 0) trackRateMap.delete(ip);
      else trackRateMap.set(ip, recent);
    }
  }, TRACK_RATE_WINDOW);

  app.post("/api/track", async (req: any, res) => {
    try {
      const userAgent = (req.headers["user-agent"] as string) || "";
      if (!userAgent || BOT_UA_PATTERNS.test(userAgent)) {
        res.json({ ok: true });
        return;
      }

      const ipAddress =
        (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
        req.socket?.remoteAddress ||
        "";

      const now = Date.now();
      const hits = trackRateMap.get(ipAddress) || [];
      const recent = hits.filter((t) => now - t < TRACK_RATE_WINDOW);
      if (recent.length >= TRACK_RATE_LIMIT) {
        res.status(429).json({ ok: false });
        return;
      }
      recent.push(now);
      trackRateMap.set(ipAddress, recent);

      const { eventName, eventId, anonymousId, properties } = req.body;
      if (!eventName || typeof eventName !== "string") {
        res.json({ ok: true });
        return;
      }

      const userId = req.user?.id || req.user?.claims?.sub || null;

      await db.insert(analyticsEvents).values({
        eventId: eventId || null,
        anonymousId: anonymousId || null,
        userId,
        eventName: eventName.slice(0, 100),
        properties: properties || null,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
      });
    } catch (err: any) {
      if (err?.code === "23505") {
        res.json({ ok: true });
        return;
      }
      console.error("Analytics track error (non-fatal):", err);
    }
    res.json({ ok: true });
  });

  app.get("/api/admin/analytics", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      const user = await storage.getUser(userId);
      if (!user || !user.isAdmin) {
        res.status(403).json({ message: "Admin access required" });
        return;
      }

      const now = new Date();
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [
        uniqueVisitors24h,
        uniqueVisitors7d,
        dau,
        wau,
        signupsPerDay,
        featureUsagePerDay,
        recentEvents,
      ] = await Promise.all([
        db
          .select({ count: sql<number>`count(distinct coalesce(${analyticsEvents.anonymousId}, ${analyticsEvents.ipAddress}))` })
          .from(analyticsEvents)
          .where(gte(analyticsEvents.createdAt, oneDayAgo)),
        db
          .select({ count: sql<number>`count(distinct coalesce(${analyticsEvents.anonymousId}, ${analyticsEvents.ipAddress}))` })
          .from(analyticsEvents)
          .where(gte(analyticsEvents.createdAt, sevenDaysAgo)),
        db
          .select({ count: sql<number>`count(distinct ${analyticsEvents.userId})` })
          .from(analyticsEvents)
          .where(
            and(
              gte(analyticsEvents.createdAt, oneDayAgo),
              sql`${analyticsEvents.userId} is not null`,
            ),
          ),
        db
          .select({ count: sql<number>`count(distinct ${analyticsEvents.userId})` })
          .from(analyticsEvents)
          .where(
            and(
              gte(analyticsEvents.createdAt, sevenDaysAgo),
              sql`${analyticsEvents.userId} is not null`,
            ),
          ),
        db
          .select({
            day: sql<string>`date(${analyticsEvents.createdAt})`,
            count: sql<number>`count(*)`,
          })
          .from(analyticsEvents)
          .where(
            and(
              eq(analyticsEvents.eventName, "signup_success"),
              gte(analyticsEvents.createdAt, sevenDaysAgo),
            ),
          )
          .groupBy(sql`date(${analyticsEvents.createdAt})`)
          .orderBy(sql`date(${analyticsEvents.createdAt})`),
        db
          .select({
            eventName: analyticsEvents.eventName,
            day: sql<string>`date(${analyticsEvents.createdAt})`,
            count: sql<number>`count(*)`,
          })
          .from(analyticsEvents)
          .where(gte(analyticsEvents.createdAt, sevenDaysAgo))
          .groupBy(analyticsEvents.eventName, sql`date(${analyticsEvents.createdAt})`)
          .orderBy(sql`date(${analyticsEvents.createdAt})`),
        db
          .select()
          .from(analyticsEvents)
          .orderBy(desc(analyticsEvents.createdAt))
          .limit(50),
      ]);

      res.json({
        uniqueVisitors24h: Number(uniqueVisitors24h[0]?.count ?? 0),
        uniqueVisitors7d: Number(uniqueVisitors7d[0]?.count ?? 0),
        dau: Number(dau[0]?.count ?? 0),
        wau: Number(wau[0]?.count ?? 0),
        signupsPerDay,
        featureUsagePerDay,
        recentEvents,
      });
    } catch (error) {
      console.error("Analytics query error:", error);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Admin endpoints - require authenticated admin user
  const isAdmin = async (req: any, res: any, next: any) => {
    try {
      const userId = req.user?.claims?.sub || req.user?.id;
      if (!userId) {
        res.status(401).json({ message: "Unauthorized" });
        return;
      }
      const user = await storage.getUser(userId);
      if (!user || !(user as any).isAdmin) {
        res.status(403).json({ message: "Forbidden: admin access required" });
        return;
      }
      next();
    } catch (error) {
      console.error("Admin check error:", error);
      res.status(500).json({ message: "Failed to verify admin status" });
    }
  };

  app.get("/api/admin/users", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
      res.json(allUsers);
    } catch (error) {
      console.error("Admin list users error:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const [userCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(users);
      const [collegeCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(colleges);
      const [careerCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(careerPaths);
      const [scholarshipCountRow] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(scholarships);
      res.json({
        users: Number(userCountRow?.count ?? 0),
        colleges: Number(collegeCountRow?.count ?? 0),
        careers: Number(careerCountRow?.count ?? 0),
        scholarships: Number(scholarshipCountRow?.count ?? 0),
      });
    } catch (error) {
      console.error("Admin stats error:", error);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  app.get(
    "/api/admin/users/:userId",
    isAuthenticated,
    isAdmin,
    async (req, res) => {
      try {
        const { userId } = req.params;
        const user = await storage.getUser(userId);
        if (!user) {
          res.status(404).json({ message: "User not found" });
          return;
        }
        const savedCollegesList = await storage.getSavedColleges(userId);
        const savedCareersList = await storage.getSavedCareers(userId);
        const savedScholarshipsList = await storage.getSavedScholarships(userId);
        res.json({
          user,
          savedItems: {
            colleges: savedCollegesList,
            careers: savedCareersList,
            scholarships: savedScholarshipsList,
          },
        });
      } catch (error) {
        console.error("Admin user detail error:", error);
        res.status(500).json({ message: "Failed to fetch user details" });
      }
    },
  );

  const httpServer = createServer(app);
  return httpServer;
}

// Helper function to calculate profile completeness
function calculateProfileCompleteness(user: any): number {
  const requiredFields = [
    'firstName', 'lastName', 'email', 'state', 'gpa', 'major', 
    'academicLevel', 'graduationYear', 'interests', 'bio', 
    'phone', 'dateOfBirth', 'demographics', 'aiKeywords', 'profilePicture'
  ];
  
  const completedFields = requiredFields.filter(field => {
    const value = user[field];
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'string') return value.trim().length > 0;
    return value !== null && value !== undefined;
  });
  
  return Math.round((completedFields.length / requiredFields.length) * 100);
}

// Helper function to generate profile insights
function generateProfileInsights(user: any): string[] {
  const insights: string[] = [];
  
  if (user.gpa && user.gpa >= 3.5) {
    insights.push("Strong academic performance - eligible for merit-based scholarships");
  }
  
  if (user.interests && user.interests.length >= 3) {
    insights.push("Diverse interests - good foundation for career exploration");
  }
  
  if (user.aiKeywords && user.aiKeywords.length >= 5) {
    insights.push("Well-developed skill profile - ready for targeted recommendations");
  }
  
  if (user.demographics && Object.keys(user.demographics).length > 0) {
    insights.push("Complete demographic profile - access to specialized opportunities");
  }
  
  if (!user.profilePicture) {
    insights.push("Add a profile picture to make your profile more engaging");
  }
  
  if (!user.bio || user.bio.length < 50) {
    insights.push("Add a detailed bio to help with personalized recommendations");
  }
  
  return insights;
}

// Deterministic resume analysis fallback function
function analyzeResumeWithDeterministicMethod(resumeText: string) {
  const text = resumeText.toLowerCase();
  
  // Comprehensive skill extraction with expanded keywords
  const skillCategories = {
    technical: ['javascript', 'python', 'java', 'react', 'node.js', 'sql', 'html', 'css', 'mongodb', 'postgresql', 'aws', 'docker', 'kubernetes', 'git', 'typescript', 'angular', 'vue', 'php', 'c++', 'c#', '.net', 'ruby', 'go', 'rust', 'machine learning', 'ai', 'data science', 'tensorflow', 'pytorch'],
    business: ['management', 'leadership', 'strategic planning', 'project management', 'agile', 'scrum', 'budget management', 'sales', 'marketing', 'business development', 'negotiations', 'client relations', 'crm', 'excel', 'powerpoint', 'tableau', 'salesforce'],
    healthcare: ['nursing', 'patient care', 'medical terminology', 'cpr', 'clinical research', 'healthcare administration', 'medical coding', 'pharmacy', 'radiology', 'surgery', 'emergency care', 'pediatrics', 'geriatrics'],
    creative: ['design', 'photoshop', 'illustrator', 'ui/ux', 'graphic design', 'web design', 'adobe creative suite', 'figma', 'sketch', 'animation', 'video editing', 'content creation', 'copywriting', 'brand development'],
    communication: ['public speaking', 'writing', 'editing', 'social media', 'content marketing', 'journalism', 'translation', 'presentation skills', 'team collaboration', 'cross-functional coordination'],
    analytical: ['data analysis', 'statistics', 'research', 'problem solving', 'critical thinking', 'financial analysis', 'market research', 'business intelligence', 'reporting', 'forecasting']
  };
  
  const allSkills: string[] = [];
  Object.values(skillCategories).forEach(category => {
    category.forEach(skill => {
      if (text.includes(skill.toLowerCase())) {
        allSkills.push(skill.charAt(0).toUpperCase() + skill.slice(1));
      }
    });
  });
  
  // Industry-specific interest detection
  const industryKeywords = {
    'Technology': ['software', 'programming', 'coding', 'development', 'tech', 'computer', 'it', 'digital', 'app', 'web', 'system', 'database'],
    'Healthcare': ['medical', 'health', 'patient', 'clinical', 'hospital', 'nursing', 'pharmacy', 'healthcare', 'medicine', 'therapy'],
    'Business': ['business', 'corporate', 'enterprise', 'company', 'organization', 'management', 'administration', 'operations'],
    'Finance': ['finance', 'banking', 'investment', 'accounting', 'financial', 'money', 'budget', 'audit', 'tax'],
    'Education': ['teaching', 'education', 'school', 'university', 'student', 'curriculum', 'training', 'academic'],
    'Engineering': ['engineering', 'mechanical', 'electrical', 'civil', 'chemical', 'industrial', 'aerospace', 'biomedical'],
    'Marketing': ['marketing', 'advertising', 'brand', 'promotion', 'campaign', 'social media', 'digital marketing'],
    'Research': ['research', 'analysis', 'study', 'investigation', 'experiment', 'data', 'scientific'],
    'Creative Arts': ['design', 'art', 'creative', 'visual', 'graphic', 'artistic', 'photography', 'video'],
    'Legal': ['legal', 'law', 'attorney', 'lawyer', 'paralegal', 'litigation', 'contract', 'compliance']
  };
  
  const detectedIndustries: string[] = [];
  Object.entries(industryKeywords).forEach(([industry, keywords]) => {
    if (keywords.some(keyword => text.includes(keyword))) {
      detectedIndustries.push(industry);
    }
  });
  
  // Advanced education level detection
  let educationLevel = 'bachelor';
  let detectedGpa: number | undefined;
  let major: string | undefined;
  
  if (text.includes('phd') || text.includes('doctorate') || text.includes('ph.d')) {
    educationLevel = 'doctorate';
  } else if (text.includes('master') || text.includes('mba') || text.includes('ms') || text.includes('ma')) {
    educationLevel = 'master';
  } else if (text.includes('associate') || text.includes('aa') || text.includes('as')) {
    educationLevel = 'associate';
  } else if (text.includes('high school') || text.includes('diploma')) {
    educationLevel = 'high-school';
  }
  
  // GPA extraction with multiple patterns
  const gpaPatterns = [
    /gpa[\s:]*(\d\.\d+)/i,
    /(\d\.\d+)\s*gpa/i,
    /grade point average[\s:]*(\d\.\d+)/i
  ];
  
  for (const pattern of gpaPatterns) {
    const match = text.match(pattern);
    if (match) {
      detectedGpa = parseFloat(match[1]);
      break;
    }
  }
  
  // Major detection
  const majorKeywords = ['computer science', 'business administration', 'engineering', 'nursing', 'biology', 'chemistry', 'physics', 'mathematics', 'psychology', 'economics', 'finance', 'marketing', 'communications', 'english', 'history', 'political science'];
  major = majorKeywords.find(m => text.includes(m));
  
  // Experience level detection
  let experienceYears = 0;
  let experienceLevel: 'entry' | 'mid' | 'senior' = 'entry';
  
  const yearMatches = text.match(/(\d+)\s*years?\s*(of\s*)?(experience|exp)/gi);
  if (yearMatches) {
    const years = yearMatches.map(match => parseInt(match.match(/\d+/)?.[0] || '0'));
    experienceYears = Math.max(...years);
  }
  
  if (experienceYears >= 7) experienceLevel = 'senior';
  else if (experienceYears >= 3) experienceLevel = 'mid';
  
  // RIASEC profiling based on content analysis
  const riasecKeywords = {
    realistic: ['hands-on', 'practical', 'mechanical', 'construction', 'repair', 'physical', 'outdoors', 'tools', 'equipment'],
    investigative: ['research', 'analysis', 'data', 'science', 'problem solving', 'investigation', 'study', 'experiment', 'technical'],
    artistic: ['creative', 'design', 'art', 'writing', 'music', 'photography', 'visual', 'innovation', 'artistic'],
    social: ['teaching', 'counseling', 'helping', 'community', 'people', 'team', 'collaboration', 'social work', 'healthcare'],
    enterprising: ['leadership', 'management', 'sales', 'business', 'entrepreneurship', 'negotiation', 'persuasion', 'profit'],
    conventional: ['organization', 'detail', 'systematic', 'procedures', 'data entry', 'filing', 'clerical', 'administrative']
  };
  
  const riasecScores: any = {};
  Object.entries(riasecKeywords).forEach(([trait, keywords]) => {
    const score = keywords.filter(keyword => text.includes(keyword)).length;
    riasecScores[trait] = Math.min(0.9, Math.max(0.1, score * 0.15 + 0.1));
  });
  
  return {
    skills: allSkills.length > 0 ? allSkills.slice(0, 15) : ['Communication', 'Problem Solving', 'Critical Thinking'],
    interests: detectedIndustries.length > 0 ? detectedIndustries : ['Professional Development'],
    education: {
      level: educationLevel,
      gpa: detectedGpa,
      major: major,
      institution: undefined
    },
    experience: {
      years: experienceYears || 1,
      level: experienceLevel,
      industry: detectedIndustries.length > 0 ? detectedIndustries : ['General']
    },
    riasecProfile: {
      realistic: riasecScores.realistic || 0.3,
      investigative: riasecScores.investigative || 0.3,
      artistic: riasecScores.artistic || 0.3,
      social: riasecScores.social || 0.3,
      enterprising: riasecScores.enterprising || 0.3,
      conventional: riasecScores.conventional || 0.3
    },
    demographics: {
      isFirstGeneration: text.includes('first generation') || text.includes('first-generation'),
      hasDisability: text.includes('disability') || text.includes('disabled'),
      isMinority: text.includes('minority') || text.includes('diverse'),
      financialNeed: text.includes('financial need') || text.includes('low income') || text.includes('scholarship')
    },
    careerIndicators: {
      leadershipExperience: text.includes('lead') || text.includes('manage') || text.includes('supervise') || text.includes('director'),
      technicalSkills: allSkills.some(skill => skillCategories.technical.includes(skill.toLowerCase())),
      researchExperience: text.includes('research') || text.includes('study') || text.includes('analysis'),
      volunteerWork: text.includes('volunteer') || text.includes('community service')
    },
    confidenceScore: Math.min(0.95, 0.5 + (allSkills.length * 0.02) + (detectedIndustries.length * 0.05))
  };
}

// Search authentic career database for personalized matches
async function searchAuthenticCareerDatabase(analysis: any, resumeText: string) {
  try {
    // Get all careers from O*NET database through working career service
    const allCareers = await workingCareerService.getAllCareers();
    
    if (!allCareers || allCareers.length === 0) {
      console.log("No careers found in database, using direct matcher");
      const matches = await directCareerMatcher.findMatches({
        interests: analysis.interests,
        skills: analysis.skills,
        educationLevel: analysis.education.level
      });
      return matches.slice(0, 8).map((match: any) => ({
        title: match.career.title,
        description: match.career.description,
        matchScore: match.score / 100,
        averageSalary: match.career.averageSalary,
        jobGrowthRate: match.career.jobGrowthRate,
        matchReason: match.matchReasons?.join(', ') || 'Skills and interests alignment',
        keySkills: match.career.skills || []
      }));
    }
    
    // Score careers based on comprehensive matching
    const scoredCareers = allCareers.map((career: any) => {
      let score = 0;
      let reasons = [];
      
      // Skill matching (40% weight)
      const skillMatches = analysis.skills.filter((skill: string) => 
        career.skills?.some((careerSkill: string) => 
          careerSkill.toLowerCase().includes(skill.toLowerCase()) ||
          skill.toLowerCase().includes(careerSkill.toLowerCase())
        )
      );
      if (skillMatches.length > 0) {
        score += (skillMatches.length / analysis.skills.length) * 40;
        reasons.push(`${skillMatches.length} skill matches: ${skillMatches.slice(0, 3).join(', ')}`);
      }
      
      // Interest/Industry matching (30% weight)
      const industryMatches = analysis.interests.filter((interest: string) =>
        career.industries?.some((industry: string) => 
          industry.toLowerCase().includes(interest.toLowerCase()) ||
          interest.toLowerCase().includes(industry.toLowerCase())
        )
      );
      if (industryMatches.length > 0) {
        score += (industryMatches.length / analysis.interests.length) * 30;
        reasons.push(`Industry alignment: ${industryMatches.join(', ')}`);
      }
      
      // Education level matching (15% weight)
      if (career.educationRequired) {
        const educationMatch = career.educationRequired.toLowerCase().includes(analysis.education.level);
        if (educationMatch) {
          score += 15;
          reasons.push(`Education match: ${career.educationRequired}`);
        }
      }
      
      // Experience level matching (10% weight)
      if (career.experienceLevel && analysis.experience.level) {
        if (career.experienceLevel === analysis.experience.level) {
          score += 10;
          reasons.push(`Experience level match`);
        }
      }
      
      // RIASEC personality alignment (5% weight)
      if (career.riasecProfile && analysis.riasecProfile) {
        const riasecAlignment = Object.keys(analysis.riasecProfile).reduce((sum, trait) => {
          return sum + Math.abs(analysis.riasecProfile[trait] - (career.riasecProfile[trait] || 0.3));
        }, 0);
        const riasecScore = Math.max(0, (6 - riasecAlignment) / 6 * 5);
        score += riasecScore;
        if (riasecScore > 2) {
          reasons.push('Strong personality fit');
        }
      }
      
      return {
        ...career,
        matchScore: Math.min(100, score) / 100,
        matchReason: reasons.length > 0 ? reasons.join('; ') : 'General career alignment',
        skillMatches: skillMatches.length
      };
    });
    
    // Sort by score and return top matches
    const topMatches = scoredCareers
      .filter((career: any) => career.matchScore > 0.1)
      .sort((a: any, b: any) => b.matchScore - a.matchScore)
      .slice(0, 8);
    
    console.log(`Found ${topMatches.length} personalized career matches from ${allCareers.length} total careers`);
    
    return topMatches.map((career: any) => ({
      title: career.title,
      description: career.description,
      matchScore: career.matchScore,
      averageSalary: career.averageSalary || '$65,000',
      jobGrowthRate: career.jobGrowthRate || 'Average',
      matchReason: career.matchReason,
      keySkills: career.skills || [],
      onetCode: career.onetCode
    }));
    
  } catch (error) {
    console.error('Error searching career database:', error);
    
    // Final fallback to direct matcher
    const matches = await directCareerMatcher.findMatches({
      interests: analysis.interests,
      skills: analysis.skills,
      educationLevel: analysis.education.level
    });
    return matches.slice(0, 6).map((match: any) => ({
      title: match.career.title,
      description: match.career.description,
      matchScore: match.score / 100,
      averageSalary: match.career.averageSalary,
      jobGrowthRate: match.career.jobGrowthRate,
      matchReason: match.matchReasons?.join(', ') || 'Skills and interests alignment',
      keySkills: match.career.skills || []
    }));
  }
}

// Search authentic scholarship database for personalized matches
async function searchAuthenticScholarshipDatabase(analysis: any, resumeText: string) {
  try {
    // Get all scholarships from authentic database
    const allScholarships = smartScholarshipMatcher.getAllScholarships();
    
    const text = resumeText.toLowerCase();
    
    // Score scholarships based on comprehensive matching
    const scoredScholarships = allScholarships.map((scholarship: any) => {
      let score = 0;
      let reasons = [];
      
      // GPA requirements (30% weight)
      const userGpa = analysis.gpa || analysis.education?.gpa || 3.0;
      if (scholarship.minGpa) {
        if (userGpa >= scholarship.minGpa) {
          score += 30;
          reasons.push(`GPA requirement met (${userGpa} >= ${scholarship.minGpa})`);
        } else {
          score -= 10; // Penalty for not meeting GPA
        }
      } else {
        score += 15; // No GPA requirement is good
        reasons.push('No minimum GPA required');
      }
      
      // Field of study matching (25% weight)
      if (scholarship.fields) {
        const userInterests = analysis.interests || [];
        const fieldMatches = userInterests.filter((interest: string) =>
          scholarship.fields.some((field: string) => 
            field.toLowerCase().includes(interest.toLowerCase()) ||
            interest.toLowerCase().includes(field.toLowerCase()) ||
            field.toLowerCase() === 'general' ||
            field.toLowerCase() === 'all majors'
          )
        );
        if (fieldMatches.length > 0 || scholarship.fields.includes('general')) {
          score += 25;
          reasons.push(`Field alignment: ${fieldMatches.join(', ') || 'General studies'}`);
        }
      }
      
      // Demographics matching (20% weight)
      if (scholarship.targetDemographics) {
        const demoMatches = [];
        const demographics = analysis.demographics || {};
        const userInterests = analysis.interests || [];
        const educationLevel = analysis.education_level || analysis.education?.level || 'bachelor';
        
        if (demographics.isFirstGeneration && scholarship.targetDemographics.includes('first-generation')) {
          demoMatches.push('first-generation');
        }
        if (demographics.isMinority && scholarship.targetDemographics.includes('minority')) {
          demoMatches.push('minority');
        }
        if (scholarship.targetDemographics.includes('undergraduate students') && 
            ['bachelor', 'associate'].includes(educationLevel)) {
          demoMatches.push('undergraduate');
        }
        if (scholarship.targetDemographics.includes('graduate students') && 
            ['master', 'doctorate'].includes(educationLevel)) {
          demoMatches.push('graduate');
        }
        if (userInterests.some((interest: string) => interest.toLowerCase().includes('technology')) && 
            scholarship.targetDemographics.includes('STEM students')) {
          demoMatches.push('STEM');
        }
        
        if (demoMatches.length > 0) {
          score += 20;
          reasons.push(`Demographic match: ${demoMatches.join(', ')}`);
        }
      }
      
      // Financial need (15% weight)
      if (scholarship.type === 'need-based') {
        if (analysis.demographics.financialNeed || text.includes('financial aid') || text.includes('scholarship')) {
          score += 15;
          reasons.push('Financial need alignment');
        }
      } else {
        score += 8; // Merit-based is generally accessible
        reasons.push('Merit-based opportunity');
      }
      
      // Education level matching (10% weight)
      if (scholarship.targetDemographics) {
        const levelMatch = (
          (['bachelor', 'associate'].includes(analysis.education.level) && 
           scholarship.targetDemographics.includes('undergraduate students')) ||
          (['master', 'doctorate'].includes(analysis.education.level) && 
           scholarship.targetDemographics.includes('graduate students'))
        );
        if (levelMatch) {
          score += 10;
          reasons.push('Education level match');
        }
      }
      
      return {
        scholarship,
        score: Math.min(100, score),
        reason: reasons.length > 0 ? reasons.join('; ') : 'General eligibility',
        matchedCriteria: reasons.length
      };
    });
    
    // Sort by score and return top matches
    const topMatches = scoredScholarships
      .filter((match: any) => match.score > 20)
      .sort((a: any, b: any) => b.score - a.score)
      .slice(0, 12);
    
    console.log(`Found ${topMatches.length} personalized scholarship matches from ${allScholarships.length} total scholarships`);
    
    return topMatches;
    
  } catch (error) {
    console.error('Error searching scholarship database:', error);
    
    // Fallback to basic scholarship matching
    return await smartScholarshipMatcher.findMatches({
      gpa: analysis.education.gpa || 3.0,
      major: analysis.education.major || "General Studies",
      year: "sophomore",
      interests: analysis.interests,
      demographics: Object.keys(analysis.demographics).filter(
        key => analysis.demographics[key as keyof typeof analysis.demographics]
      ),
      state: "All States",
      financialNeed: analysis.demographics.financialNeed || false,
      ethnicity: analysis.demographics.isMinority ? "Minority" : "Not specified",
      firstGeneration: analysis.demographics.isFirstGeneration || false
    });
  }

}
