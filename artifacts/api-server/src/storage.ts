import {
  users,
  colleges,
  careerPaths,
  scholarships,
  userPreferences,
  savedPlans,
  userProfiles,
  savedColleges,
  savedCareers,
  savedScholarships,
  comprehensivePlans,
  userPlans,
  planCareers,
  planColleges,
  planScholarships,
  type User,
  type UpsertUser,
  type College,
  type InsertCollege,
  type CareerPath,
  type InsertCareerPath,
  type Scholarship,
  type InsertScholarship,
  type UserPreferences,
  type InsertUserPreferences,
  type SavedPlan,
  type InsertSavedPlan,
  type UserProfile,
  type InsertUserProfile,
  type SavedCollege,
  type InsertSavedCollege,
  type SavedCareer,
  type InsertSavedCareer,
  type SavedScholarship,
  type InsertSavedScholarship,
  type ComprehensivePlan,
  type InsertComprehensivePlan,
  type UserPlan,
  type InsertUserPlan,
  type PlanCareer,
  type InsertPlanCareer,
  type PlanCollege,
  type InsertPlanCollege,
  type PlanScholarship,
  type InsertPlanScholarship,
} from "@workspace/db";
import { db } from "./db";
import { eq, like, and, or, desc, gte, sql } from "drizzle-orm";


export interface CollegeFilters {
  page: number;
  limit: number;
  state?: string;
  type?: string;
  sport?: string;
  minTuition?: number;
  maxTuition?: number;
  minAcceptance?: number;
  maxAcceptance?: number;
  search?: string;
}

export interface IStorage {
  // Authentication
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: any): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUserProfile(userId: string, updates: Partial<any>): Promise<User | undefined>;

  // College operations
  getColleges(limit?: number): Promise<College[]>;
  getFastColleges(limit: number): Promise<College[]>;
  getCollegesPaginated(page: number, limit: number): Promise<College[]>;
  getFilteredColleges(filters: CollegeFilters): Promise<College[]>;
  getCollegeById(id: number): Promise<College | undefined>;
  createCollege(college: InsertCollege): Promise<College>;
  searchColleges(query: string): Promise<College[]>;
  clearColleges(): Promise<void>;
  
  // Career path operations
  getCareerPaths(): Promise<CareerPath[]>;
  getCareerPathById(id: number): Promise<CareerPath | undefined>;
  createCareerPath(career: InsertCareerPath): Promise<CareerPath>;
  searchCareerPaths(query: string): Promise<CareerPath[]>;
  
  // Scholarship operations
  getScholarships(): Promise<Scholarship[]>;
  getScholarshipById(id: number): Promise<Scholarship | undefined>;
  createScholarship(scholarship: InsertScholarship): Promise<Scholarship>;
  searchScholarships(query: string): Promise<Scholarship[]>;
  
  // User preferences operations
  createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences>;
  getUserPreferences(userId?: string): Promise<UserPreferences[]>;
  
  // Saved plans operations
  getSavedPlans(userId?: string): Promise<SavedPlan[]>;
  getSavedPlanById(id: number): Promise<SavedPlan | undefined>;
  createSavedPlan(plan: InsertSavedPlan): Promise<SavedPlan>;
  deleteSavedPlan(id: number): Promise<boolean>;

  // User Plans System
  createUserPlan(plan: InsertUserPlan): Promise<UserPlan>;
  getUserPlans(userId: string): Promise<UserPlan[]>;
  getUserPlan(planId: number): Promise<UserPlan | undefined>;
  updateUserPlan(planId: number, plan: Partial<InsertUserPlan>): Promise<UserPlan | undefined>;
  deleteUserPlan(planId: number): Promise<boolean>;

  // Plan Careers
  addCareerToPlan(planId: number, career: InsertPlanCareer): Promise<PlanCareer>;
  getPlanCareers(planId: number): Promise<PlanCareer[]>;
  removeCareerFromPlan(planId: number, careerId: number): Promise<boolean>;
  updatePlanCareer(careerId: number, updates: Partial<InsertPlanCareer>): Promise<PlanCareer | undefined>;

  // Plan Colleges
  addCollegeToPlan(planId: number, college: InsertPlanCollege): Promise<PlanCollege>;
  getPlanColleges(planId: number): Promise<PlanCollege[]>;
  removeCollegeFromPlan(planId: number, collegeId: number): Promise<boolean>;
  updatePlanCollege(collegeId: number, updates: Partial<InsertPlanCollege>): Promise<PlanCollege | undefined>;

  // Plan Scholarships
  addScholarshipToPlan(planId: number, scholarship: InsertPlanScholarship): Promise<PlanScholarship>;
  getPlanScholarships(planId: number): Promise<PlanScholarship[]>;
  removeScholarshipFromPlan(planId: number, scholarshipId: number): Promise<boolean>;
  
  // Legacy support
  createUserProfile(profile: InsertUserProfile): Promise<UserProfile>;
  getUserProfile(sessionId: string): Promise<UserProfile | undefined>;
  saveCollege(data: InsertSavedCollege): Promise<SavedCollege>;
  saveCareer(data: InsertSavedCareer): Promise<SavedCareer>;
  saveScholarship(data: InsertSavedScholarship): Promise<SavedScholarship>;
  getSavedColleges(sessionId: string): Promise<SavedCollege[]>;
  getSavedCareers(sessionId: string): Promise<SavedCareer[]>;
  getSavedScholarships(
    sessionId: string,
  ): Promise<
    (SavedScholarship & {
      scholarshipName: string | null;
      // True when the saved row's scholarshipId no longer exists in the
      // canonical `scholarships` table (e.g. legacy 9999 placeholders).
      // The UI uses this to show a clear "no longer available" placeholder
      // and let the user clean the orphan up from their saved list.
      scholarshipMissing: boolean;
    })[]
  >;
  removeSavedCollege(userId: string, id: number): Promise<boolean>;
  removeSavedCareer(userId: string, id: number): Promise<boolean>;
  removeSavedScholarship(userId: string, id: number): Promise<boolean>;
  updateSavedCollege(
    userId: string,
    id: number,
    updates: Partial<Pick<SavedCollege, "notes" | "priority">>,
  ): Promise<SavedCollege | undefined>;
  updateSavedScholarship(
    userId: string,
    id: number,
    updates: Partial<Pick<SavedScholarship, "notes" | "applicationStatus">>,
  ): Promise<SavedScholarship | undefined>;
  updateSavedCareer(
    userId: string,
    id: number,
    updates: Partial<Pick<SavedCareer, "notes">>,
  ): Promise<SavedCareer | undefined>;
  createComprehensivePlan(plan: InsertComprehensivePlan): Promise<ComprehensivePlan>;
  getComprehensivePlans(sessionId: string): Promise<ComprehensivePlan[]>;
}

export class DatabaseStorage implements IStorage {
  private static collegeCache: College[] | null = null;
  private static lastCacheTime: number = 0;
  private static readonly CACHE_DURATION = 600000; // 10 minutes

  // Authentication
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(userData: any): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async updateUserProfile(userId: string, updates: Partial<any>): Promise<User | undefined> {
    // Re-throw errors so the route handler can detect unique-constraint
    // violations (e.g. on email) and retry without the offending field.
    const [updatedUser] = await db
      .update(users)
      .set({
        ...updates,
        updatedAt: new Date()
      })
      .where(eq(users.id, userId))
      .returning();
    return updatedUser || undefined;
  }

  // College operations
  async getColleges(limit: number = 500): Promise<College[]> {
    const now = Date.now();
    if (DatabaseStorage.collegeCache && 
        (now - DatabaseStorage.lastCacheTime) < DatabaseStorage.CACHE_DURATION) {
      return DatabaseStorage.collegeCache.slice(0, limit);
    }

    const results = await db.select().from(colleges).limit(limit);
    if (limit >= 500) {
      DatabaseStorage.collegeCache = results;
      DatabaseStorage.lastCacheTime = now;
    }
    return results;
  }

  // V2 Search implementation with true cursor pagination
  async searchCollegesV2(params: {
    q?: string;
    state?: string; 
    type?: string;
    majors?: string[];
    limit: number;
    cursor?: string;
    sort: "rating" | "name";
    order: "asc" | "desc";
  }) {
    try {
      console.log("SearchV2 params:", params);
      
      const clauses: string[] = [];
      const vals: any[] = [];
      const add = (sql: string, v?: any) => { 
        clauses.push(sql); 
        if (v !== undefined) vals.push(v); 
      };

      if (params.q) add(`(name ILIKE $${vals.length+1} OR city ILIKE $${vals.length+1})`, `%${params.q}%`);
      if (params.state) add(`LOWER(state) = LOWER($${vals.length+1})`, params.state);
      if (params.type) add(`LOWER(type) = LOWER($${vals.length+1})`, params.type);
      
      // Handle majors filtering with program matching
      if (params.majors?.length) {
        // Map both short values AND full labels to searchable keywords
        const majorMap: Record<string, string[]> = {
          // Short values (from search.tsx)
          'technology': ['University', 'Institute', 'College', 'Tech', 'Polytechnic'],
          'healthcare': ['University', 'Medical', 'Health', 'College'],
          'business': ['University', 'Business', 'College', 'State'],
          'engineering': ['University', 'Institute', 'Tech', 'Polytechnic', 'Engineering'],
          'education': ['University', 'College', 'State', 'Education'],
          'arts': ['University', 'Arts', 'College', 'Design'],
          'science': ['University', 'Institute', 'College', 'Science', 'Research'],
          'communications': ['University', 'College', 'Communication', 'Media'],
          'law': ['University', 'Law', 'College', 'Justice'],
          // Full labels (from real-time-college-search.tsx)
          'technology & computer science': ['University', 'Institute', 'College', 'Tech', 'Polytechnic'],
          'healthcare & medicine': ['University', 'Medical', 'Health', 'College'],
          'business & finance': ['University', 'Business', 'College', 'State'],
          'education & teaching': ['University', 'College', 'State', 'Education'],
          'arts & design': ['University', 'Arts', 'College', 'Design'],
          'science & research': ['University', 'Institute', 'College', 'Science', 'Research'],
          'communications & media': ['University', 'College', 'Communication', 'Media'],
          'law & legal studies': ['University', 'Law', 'College', 'Justice']
        };
        
        const programKeywords = params.majors.flatMap(major => {
          const key = major.toLowerCase();
          return majorMap[key] || ['University', 'College']; // Broad fallback
        });
        
        // Create broad search conditions for college matching
        const programConditions = programKeywords.map((_, idx) => 
          `(name ILIKE $${vals.length + idx + 1} OR description ILIKE $${vals.length + idx + 1})`
        ).join(' OR ');
        if (programConditions) {
          add(`(${programConditions})`);
          programKeywords.forEach(keyword => vals.push(`%${keyword}%`));
        }
      }

      const whereClause = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
      
      const sortCol = params.sort === "name" ? "name" : "rating";
      const orderDir = params.order.toUpperCase() === "ASC" ? "ASC" : "DESC";

      // Decode cursor for pagination
      let cursorClause = "";
      if (params.cursor) {
        try {
          const decoded = JSON.parse(Buffer.from(params.cursor, "base64").toString("utf8"));
          const key = decoded[sortCol];
          const id = decoded.id;
          cursorClause = ` AND (${sortCol}, id) ${orderDir === "DESC" ? "<" : ">"} ($${vals.length+1}, $${vals.length+2})`;
          vals.push(key, id);
        } catch (e) {
          console.warn("Invalid cursor, ignoring:", params.cursor);
        }
      }

      const query = `
        WITH filtered AS (
          SELECT *
          FROM colleges
          ${whereClause}${cursorClause}
        ),
        counted AS (
          SELECT id, name, city, state, type, tuition, rating, website, description,
                 acceptance_rate as "acceptanceRate", graduation_rate as "graduationRate",
                 sat_avg as "satAvg", sat_low as "satLow", sat_high as "satHigh",
                 COUNT(*) OVER() AS total
          FROM filtered
          ORDER BY ${sortCol} ${orderDir} NULLS LAST, name ASC, id ${orderDir}
          LIMIT $${vals.length+1}
        )
        SELECT * FROM counted;
      `;
      vals.push(params.limit);

      console.log("Executing query with values:", vals);
      
      // Execute raw query using pool from db.ts
      const { pool } = await import('./db');
      const result = await pool.query(query, vals);
      const rows = result.rows;

      // Transform results
      const colleges = rows.map(college => ({
        ...college,
        tuitionInState: college.tuition,
        tuitionOutOfState: Math.round(college.tuition * 1.5),
        acceptanceRate: college.acceptanceRate / 100,
        graduationRate: college.graduationRate / 100,
        averageSAT: college.satAvg || 1200,
        satLow: college.satLow,
        satHigh: college.satHigh,
        programs: college.programs || ['Business', 'Engineering', 'Liberal Arts'],
        industries: ['Technology', 'Healthcare', 'Business'],
        scholarships: []
      }));

      // Build next cursor
      let nextCursor: string | null = null;
      if (rows.length === params.limit) {
        const lastRow = rows[rows.length - 1];
        const cursorData = { [sortCol]: lastRow[sortCol], id: lastRow.id };
        nextCursor = Buffer.from(JSON.stringify(cursorData)).toString("base64");
      }

      const total = rows[0]?.total || 0;
      
      console.log(`SearchV2 returning ${colleges.length} colleges out of ${total} total`);

      return { rows: colleges, total, nextCursor };
      
    } catch (error) {
      console.error("Error in searchCollegesV2:", error);
      // Fallback to simple query
      const fallbackResults = await this.getFastColleges(params.limit);
      return { 
        rows: fallbackResults, 
        total: fallbackResults.length, 
        nextCursor: null 
      };
    }
  }

  async getFastColleges(limit: number = 200): Promise<College[]> {
    try {
      // Get colleges with optimized query, ordered by rating and popularity
      const results = await db
        .select()
        .from(colleges)
        .orderBy(desc(colleges.rating), colleges.name)
        .limit(limit);
      
      // Transform to expected format with calculated fields
      return results.map(college => ({
        ...college,
        tuitionInState: college.tuition,
        tuitionOutOfState: Math.round(college.tuition * 1.5),
        acceptanceRate: college.acceptanceRate / 100,
        graduationRate: college.graduationRate / 100,
        averageSAT: college.satAvg || 1200,
        satLow: college.satLow,
        satHigh: college.satHigh,
        programs: ['Business', 'Engineering', 'Liberal Arts'],
        industries: ['Technology', 'Healthcare', 'Business'],
        scholarships: []
      }));
    } catch (error) {
      console.error("Error in getFastColleges:", error);
      // Fallback to regular method
      return this.getColleges(limit);
    }
  }

  async searchCollegesByCareer(career: string, limit: number = 100): Promise<College[]> {
    try {
      // Map careers to relevant college programs and types
      const careerToPrograms: Record<string, string[]> = {
        'technology': ['Computer Science', 'Engineering', 'Information Technology'],
        'healthcare': ['Medicine', 'Nursing', 'Health Sciences', 'Biology'],
        'business': ['Business', 'Economics', 'Finance', 'Marketing'],
        'education': ['Education', 'Teaching', 'Liberal Arts'],
        'engineering': ['Engineering', 'Computer Science', 'Mathematics'],
        'arts': ['Liberal Arts', 'Fine Arts', 'Design', 'Media'],
        'science': ['Biology', 'Chemistry', 'Physics', 'Environmental Science']
      };

      const programs = careerToPrograms[career.toLowerCase()] || ['Business', 'Liberal Arts'];
      
      const results = await db
        .select()
        .from(colleges)
        .orderBy(desc(colleges.rating), colleges.name)
        .limit(limit);
      
      return results.map(college => ({
        ...college,
        tuitionInState: college.tuition,
        tuitionOutOfState: Math.round(college.tuition * 1.5),
        acceptanceRate: college.acceptanceRate / 100,
        graduationRate: college.graduationRate / 100,
        averageSAT: college.satAvg || 1200,
        satLow: college.satLow,
        satHigh: college.satHigh,
        programs: programs,
        industries: ['Technology', 'Healthcare', 'Business'],
        scholarships: []
      }));
    } catch (error) {
      console.error("Error in searchCollegesByCareer:", error);
      return this.getFastColleges(limit);
    }
  }

  async getCollegesPaginated(page: number, limit: number): Promise<College[]> {
    const offset = (page - 1) * limit;
    return await db.select().from(colleges).limit(limit).offset(offset);
  }

  async getFilteredColleges(filters: CollegeFilters): Promise<College[]> {
    const conditions = [];

    if (filters.state) {
      conditions.push(eq(colleges.state, filters.state));
    }
    if (filters.search) {
      conditions.push(
        or(
          like(colleges.name, `%${filters.search}%`),
          like(colleges.city, `%${filters.search}%`),
          like(colleges.state, `%${filters.search}%`)
        )
      );
    }

    const offset = (filters.page - 1) * filters.limit;
    const baseQuery = db.select().from(colleges);
    const filteredQuery =
      conditions.length > 0 ? baseQuery.where(and(...conditions)) : baseQuery;
    return await filteredQuery.limit(filters.limit).offset(offset);
  }

  async getCollegeById(id: number): Promise<College | undefined> {
    const [college] = await db.select().from(colleges).where(eq(colleges.id, id));
    return college || undefined;
  }

  async createCollege(college: InsertCollege): Promise<College> {
    const [newCollege] = await db.insert(colleges).values(college).returning();
    DatabaseStorage.collegeCache = null; // Invalidate cache
    return newCollege;
  }

  async searchColleges(query: string): Promise<College[]> {
    return await db
      .select()
      .from(colleges)
      .where(
        or(
          like(colleges.name, `%${query}%`),
          like(colleges.city, `%${query}%`),
          like(colleges.state, `%${query}%`)
        )
      )
      .limit(50);
  }

  async clearColleges(): Promise<void> {
    await db.delete(colleges);
    DatabaseStorage.collegeCache = null;
  }

  // Career operations
  async getCareerPaths(): Promise<CareerPath[]> {
    return await db.select().from(careerPaths).limit(1000);
  }

  async getCareerPathById(id: number): Promise<CareerPath | undefined> {
    const [career] = await db.select().from(careerPaths).where(eq(careerPaths.id, id));
    return career || undefined;
  }

  async createCareerPath(career: InsertCareerPath): Promise<CareerPath> {
    const [newCareer] = await db.insert(careerPaths).values(career).returning();
    return newCareer;
  }

  async searchCareerPaths(query: string): Promise<CareerPath[]> {
    return await db
      .select()
      .from(careerPaths)
      .where(
        or(
          like(careerPaths.title, `%${query}%`),
          like(careerPaths.description, `%${query}%`)
        )
      )
      .limit(50);
  }

  // Scholarship operations
  async getScholarships(): Promise<Scholarship[]> {
    return await db.select().from(scholarships).limit(1000);
  }

  async getScholarshipById(id: number): Promise<Scholarship | undefined> {
    const [scholarship] = await db.select().from(scholarships).where(eq(scholarships.id, id));
    return scholarship || undefined;
  }

  async createScholarship(scholarship: InsertScholarship): Promise<Scholarship> {
    const [newScholarship] = await db.insert(scholarships).values(scholarship).returning();
    return newScholarship;
  }

  async searchScholarships(query: string): Promise<Scholarship[]> {
    return await db
      .select()
      .from(scholarships)
      .where(
        or(
          like(scholarships.name, `%${query}%`),
          like(scholarships.description, `%${query}%`)
        )
      )
      .limit(50);
  }

  // User Plans System
  async createUserPlan(plan: InsertUserPlan): Promise<UserPlan> {
    const [newPlan] = await db
      .insert(userPlans)
      .values({
        ...plan,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      .returning();
    return newPlan;
  }

  async getUserPlans(userId: string): Promise<UserPlan[]> {
    return await db.select().from(userPlans).where(eq(userPlans.userId, userId));
  }

  async getUserPlan(planId: number): Promise<UserPlan | undefined> {
    const [plan] = await db.select().from(userPlans).where(eq(userPlans.id, planId));
    return plan || undefined;
  }

  async updateUserPlan(planId: number, plan: Partial<InsertUserPlan>): Promise<UserPlan | undefined> {
    const [updatedPlan] = await db
      .update(userPlans)
      .set({
        ...plan,
        updatedAt: new Date().toISOString()
      })
      .where(eq(userPlans.id, planId))
      .returning();
    return updatedPlan || undefined;
  }

  async deleteUserPlan(planId: number): Promise<boolean> {
    try {
      await db.delete(planCareers).where(eq(planCareers.planId, planId));
      await db.delete(planColleges).where(eq(planColleges.planId, planId));
      const result = await db.delete(userPlans).where(eq(userPlans.id, planId));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error deleting user plan:", error);
      return false;
    }
  }

  // Plan Careers
  async addCareerToPlan(planId: number, career: InsertPlanCareer): Promise<PlanCareer> {
    const now = new Date().toISOString();
    const [newCareer] = await db
      .insert(planCareers)
      .values({
        ...career,
        planId,
        createdAt: now
      })
      .returning();
    return newCareer;
  }

  async getPlanCareers(planId: number): Promise<PlanCareer[]> {
    return await db.select().from(planCareers).where(eq(planCareers.planId, planId));
  }

  async removeCareerFromPlan(planId: number, careerId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(planCareers)
        .where(and(eq(planCareers.planId, planId), eq(planCareers.id, careerId)));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error removing career from plan:", error);
      return false;
    }
  }

  async updatePlanCareer(careerId: number, updates: Partial<InsertPlanCareer>): Promise<PlanCareer | undefined> {
    const [updatedCareer] = await db
      .update(planCareers)
      .set(updates)
      .where(eq(planCareers.id, careerId))
      .returning();
    return updatedCareer || undefined;
  }

  // Plan Colleges
  async addCollegeToPlan(planId: number, college: InsertPlanCollege): Promise<PlanCollege> {
    const now = new Date().toISOString();
    const [newCollege] = await db
      .insert(planColleges)
      .values({
        ...college,
        planId,
        createdAt: now
      })
      .returning();
    return newCollege;
  }

  async getPlanColleges(planId: number): Promise<PlanCollege[]> {
    return await db.select().from(planColleges).where(eq(planColleges.planId, planId));
  }

  async removeCollegeFromPlan(planId: number, collegeId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(planColleges)
        .where(and(eq(planColleges.planId, planId), eq(planColleges.id, collegeId)));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error removing college from plan:", error);
      return false;
    }
  }

  async updatePlanCollege(collegeId: number, updates: Partial<InsertPlanCollege>): Promise<PlanCollege | undefined> {
    const [updatedCollege] = await db
      .update(planColleges)
      .set(updates)
      .where(eq(planColleges.id, collegeId))
      .returning();
    return updatedCollege || undefined;
  }

  // Plan Scholarships
  async addScholarshipToPlan(planId: number, scholarship: InsertPlanScholarship): Promise<PlanScholarship> {
    const now = new Date().toISOString();
    const [newScholarship] = await db
      .insert(planScholarships)
      .values({
        ...scholarship,
        planId,
        createdAt: now
      })
      .returning();
    return newScholarship;
  }

  async getPlanScholarships(planId: number): Promise<PlanScholarship[]> {
    return await db.select().from(planScholarships).where(eq(planScholarships.planId, planId));
  }

  async removeScholarshipFromPlan(planId: number, scholarshipId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(planScholarships)
        .where(and(eq(planScholarships.planId, planId), eq(planScholarships.id, scholarshipId)));
      return result.rowCount !== null && result.rowCount > 0;
    } catch (error) {
      console.error("Error removing scholarship from plan:", error);
      return false;
    }
  }

  // Legacy support methods
  async createUserPreferences(preferences: InsertUserPreferences): Promise<UserPreferences> {
    const [newPreferences] = await db.insert(userPreferences).values({
      ...preferences,
      createdAt: new Date().toISOString()
    }).returning();
    return newPreferences;
  }

  async getUserPreferences(): Promise<UserPreferences[]> {
    return await db.select().from(userPreferences);
  }

  async getSavedPlans(): Promise<SavedPlan[]> {
    return await db.select().from(savedPlans);
  }

  async getSavedPlanById(id: number): Promise<SavedPlan | undefined> {
    const [plan] = await db.select().from(savedPlans).where(eq(savedPlans.id, id));
    return plan || undefined;
  }

  async createSavedPlan(plan: InsertSavedPlan): Promise<SavedPlan> {
    const [newPlan] = await db.insert(savedPlans).values({
      ...plan,
      createdAt: new Date().toISOString()
    }).returning();
    return newPlan;
  }

  async deleteSavedPlan(id: number): Promise<boolean> {
    const result = await db.delete(savedPlans).where(eq(savedPlans.id, id));
    return result.rowCount !== null && result.rowCount > 0;
  }

  async createUserProfile(profile: InsertUserProfile): Promise<UserProfile> {
    const now = new Date().toISOString();
    const [userProfile] = await db
      .insert(userProfiles)
      .values({
        ...profile,
        createdAt: now,
        updatedAt: now
      })
      .returning();
    return userProfile;
  }

  async getUserProfile(sessionId: string): Promise<UserProfile | undefined> {
    const [profile] = await db.select().from(userProfiles).where(eq(userProfiles.userId, sessionId));
    return profile;
  }

  async saveCollege(data: InsertSavedCollege): Promise<SavedCollege & { duplicate?: boolean }> {
    // Dedup: never insert the same (userId, collegeId) twice — return the
    // existing row so the client can show "already in your plan".
    const existing = await db
      .select()
      .from(savedColleges)
      .where(and(eq(savedColleges.userId, data.userId), eq(savedColleges.collegeId, data.collegeId)))
      .limit(1);
    if (existing.length > 0) {
      return { ...existing[0], duplicate: true };
    }
    const now = new Date().toISOString();
    const [saved] = await db.insert(savedColleges).values({
      ...data,
      createdAt: now,
      notes: data.notes || null,
      priority: data.priority || null
    }).returning();
    return saved;
  }

  async saveCareer(data: InsertSavedCareer & {
    onetCode?: string | null;
    salary?: unknown;
    education?: string | null;
    growth?: string | null;
    matchReasons?: string[] | null;
    standOutTips?: string[] | null;
  }): Promise<SavedCareer & { duplicate?: boolean }> {
    // Dedup by (userId, careerTitle) — case-insensitive so the same career
    // title with different casing (e.g. from cards vs saved-search fallback)
    // doesn't create a duplicate row.
    const existing = await db
      .select()
      .from(savedCareers)
      .where(and(
        eq(savedCareers.userId, data.userId),
        sql`lower(${savedCareers.careerTitle}) = lower(${data.careerTitle})`,
      ))
      .limit(1);
    if (existing.length > 0) {
      return { ...existing[0], duplicate: true };
    }
    // Insert only the columns the table actually has. Extra fields the caller
    // may pass (onetCode, salary, education, growth, matchReasons,
    // standOutTips) are intentionally dropped — they don't exist on the
    // saved_careers schema and aren't needed to render the saved row.
    const now = new Date().toISOString();
    const skillsGap = Array.isArray(data.skillsGap) ? data.skillsGap : [];
    const matchScore = typeof data.matchScore === "number" ? data.matchScore : 0;
    const [saved] = await db
      .insert(savedCareers)
      .values({
        userId: data.userId,
        careerTitle: data.careerTitle,
        matchScore,
        skillsGap,
        notes: data.notes ?? null,
        createdAt: now,
      })
      .returning();
    return saved;
  }

  async saveScholarship(data: InsertSavedScholarship): Promise<SavedScholarship & { duplicate?: boolean }> {
    const existing = await db
      .select()
      .from(savedScholarships)
      .where(and(eq(savedScholarships.userId, data.userId), eq(savedScholarships.scholarshipId, data.scholarshipId)))
      .limit(1);
    if (existing.length > 0) {
      return { ...existing[0], duplicate: true };
    }
    const now = new Date().toISOString();
    // If the client didn't supply a name (older client, or recreate-undo
    // flow), look it up from the canonical scholarships table so the
    // saved row still ends up with a usable display name for the badge
    // fallback on list pages.
    let scholarshipName: string | null =
      typeof data.scholarshipName === "string" && data.scholarshipName.trim()
        ? data.scholarshipName.trim()
        : null;
    if (!scholarshipName) {
      const [src] = await db
        .select({ name: scholarships.name })
        .from(scholarships)
        .where(eq(scholarships.id, data.scholarshipId))
        .limit(1);
      scholarshipName = src?.name ?? null;
    }
    const [saved] = await db.insert(savedScholarships).values({
      ...data,
      createdAt: now,
      deadline: data.deadline || null,
      notes: data.notes || null,
      applicationStatus: data.applicationStatus || null,
      scholarshipName,
    }).returning();
    return saved;
  }

  async getSavedColleges(sessionId: string): Promise<SavedCollege[]> {
    return await db.select().from(savedColleges).where(eq(savedColleges.userId, sessionId));
  }

  async getSavedCareers(sessionId: string): Promise<SavedCareer[]> {
    return await db.select().from(savedCareers).where(eq(savedCareers.userId, sessionId));
  }

  async getSavedScholarships(sessionId: string): Promise<
    (SavedScholarship & {
      scholarshipName: string | null;
      scholarshipMissing: boolean;
    })[]
  > {
    // LEFT JOIN with scholarships so the response always includes a usable
    // display name. Prefer the snapshot stored on the saved row (which
    // covers curated/recommendation rows that aren't in the scholarships
    // table); fall back to the canonical name from `scholarships` when the
    // saved row was persisted before we started recording the snapshot.
    //
    // We also surface a `scholarshipMissing` flag for legacy rows whose
    // `scholarshipId` no longer resolves to a row in `scholarships` AND
    // that don't carry a snapshot name either (e.g. the 9999 placeholders).
    // These would otherwise render with no title and a broken Saved badge,
    // so the UI uses the flag to show a clear "no longer available"
    // placeholder and let the user remove the orphan in one tap.
    const rows = await db
      .select({
        saved: savedScholarships,
        sourceName: scholarships.name,
        sourceId: scholarships.id,
      })
      .from(savedScholarships)
      .leftJoin(scholarships, eq(savedScholarships.scholarshipId, scholarships.id))
      .where(eq(savedScholarships.userId, sessionId));
    return rows.map(({ saved, sourceName, sourceId }) => {
      const snapshot =
        typeof saved.scholarshipName === "string" && saved.scholarshipName.trim().length > 0
          ? saved.scholarshipName
          : null;
      const canonicalName =
        typeof sourceName === "string" && sourceName.trim().length > 0 ? sourceName : null;
      // The canonical row is missing when the LEFT JOIN didn't match (no
      // sourceId). We only flag the row as orphaned when there's also no
      // snapshot name to fall back on — a row with a snapshot still has a
      // usable label and shouldn't be surfaced as broken.
      const scholarshipMissing = sourceId == null && snapshot == null;
      return {
        ...saved,
        scholarshipName: snapshot ?? canonicalName,
        scholarshipMissing,
      };
    });
  }

  async removeSavedCollege(userId: string, id: number): Promise<boolean> {
    const result = await db
      .delete(savedColleges)
      .where(and(eq(savedColleges.id, id), eq(savedColleges.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async removeSavedCareer(userId: string, id: number): Promise<boolean> {
    const result = await db
      .delete(savedCareers)
      .where(and(eq(savedCareers.id, id), eq(savedCareers.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async removeSavedScholarship(userId: string, id: number): Promise<boolean> {
    const result = await db
      .delete(savedScholarships)
      .where(and(eq(savedScholarships.id, id), eq(savedScholarships.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async updateSavedCollege(
    userId: string,
    id: number,
    updates: Partial<Pick<SavedCollege, "notes" | "priority">>,
  ): Promise<SavedCollege | undefined> {
    const patch: Partial<Pick<SavedCollege, "notes" | "priority">> = {};
    if (Object.prototype.hasOwnProperty.call(updates, "notes")) {
      patch.notes = updates.notes ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "priority")) {
      patch.priority = updates.priority ?? null;
    }
    if (Object.keys(patch).length === 0) {
      const [existing] = await db
        .select()
        .from(savedColleges)
        .where(and(eq(savedColleges.id, id), eq(savedColleges.userId, userId)))
        .limit(1);
      return existing;
    }
    const [updated] = await db
      .update(savedColleges)
      .set(patch)
      .where(and(eq(savedColleges.id, id), eq(savedColleges.userId, userId)))
      .returning();
    return updated;
  }

  async updateSavedCareer(
    userId: string,
    id: number,
    updates: Partial<Pick<SavedCareer, "notes">>,
  ): Promise<SavedCareer | undefined> {
    const patch: Partial<Pick<SavedCareer, "notes">> = {};
    if (Object.prototype.hasOwnProperty.call(updates, "notes")) {
      patch.notes = updates.notes ?? null;
    }
    if (Object.keys(patch).length === 0) {
      const [existing] = await db
        .select()
        .from(savedCareers)
        .where(and(eq(savedCareers.id, id), eq(savedCareers.userId, userId)))
        .limit(1);
      return existing;
    }
    const [updated] = await db
      .update(savedCareers)
      .set(patch)
      .where(and(eq(savedCareers.id, id), eq(savedCareers.userId, userId)))
      .returning();
    return updated;
  }

  async updateSavedScholarship(
    userId: string,
    id: number,
    updates: Partial<Pick<SavedScholarship, "notes" | "applicationStatus">>,
  ): Promise<SavedScholarship | undefined> {
    const patch: Partial<Pick<SavedScholarship, "notes" | "applicationStatus">> = {};
    if (Object.prototype.hasOwnProperty.call(updates, "notes")) {
      patch.notes = updates.notes ?? null;
    }
    if (Object.prototype.hasOwnProperty.call(updates, "applicationStatus")) {
      patch.applicationStatus = updates.applicationStatus ?? null;
    }
    if (Object.keys(patch).length === 0) {
      const [existing] = await db
        .select()
        .from(savedScholarships)
        .where(and(eq(savedScholarships.id, id), eq(savedScholarships.userId, userId)))
        .limit(1);
      return existing;
    }
    const [updated] = await db
      .update(savedScholarships)
      .set(patch)
      .where(and(eq(savedScholarships.id, id), eq(savedScholarships.userId, userId)))
      .returning();
    return updated;
  }

  async createComprehensivePlan(plan: InsertComprehensivePlan): Promise<ComprehensivePlan> {
    const now = new Date().toISOString();
    const [comprehensive] = await db.insert(comprehensivePlans).values({
      ...plan,
      createdAt: now,
      updatedAt: now,
      scholarships: plan.scholarships || null,
      notes: plan.notes || null,
      matchedSchools: plan.matchedSchools || null,
      requiredSkills: plan.requiredSkills || null,
      missingSkills: plan.missingSkills || null,
      recommendedCourses: plan.recommendedCourses || null,
      timeline: plan.timeline || null
    }).returning();
    return comprehensive;
  }

  async getComprehensivePlans(sessionId: string): Promise<ComprehensivePlan[]> {
    return await db.select().from(comprehensivePlans).where(eq(comprehensivePlans.userId, sessionId));
  }
}

export const storage = new DatabaseStorage();
export { db };