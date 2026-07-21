import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  integer,
  boolean,
  json,
  real
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for traditional authentication
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  username: varchar("username").unique().notNull(),
  password: varchar("password").notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  phone: varchar("phone"),
  dateOfBirth: varchar("date_of_birth"),
  bio: text("bio"),
  graduationYear: integer("graduation_year"),
  // Enhanced profile fields for AI-powered matching
  gpa: real("gpa"),
  state: varchar("state"),
  major: varchar("major"),
  academicLevel: varchar("academic_level"), // undergraduate, graduate
  financialNeed: varchar("financial_need"), // high, medium, low
  demographics: text("demographics").array(), // first-generation, military, etc.
  interests: text("interests").array(), // career interests
  personalStatement: text("personal_statement"),
  resumeUrl: varchar("resume_url"),
  resumeFileData: text("resume_file_data"),
  resumeFileName: varchar("resume_file_name"),
  resumeFileType: varchar("resume_file_type"),
  resumeUploadDate: timestamp("resume_upload_date"),
  aiKeywords: text("ai_keywords").array(),
  aiAnalysisDate: timestamp("ai_analysis_date"),
  resumeAnalysisResults: jsonb("resume_analysis_results"),
  profilePicture: text("profile_picture"), // Base64 image data
  profileCompleteness: integer("profile_completeness").default(0), // 0-100%
  forYouCache: jsonb("for_you_cache"), // Cached personalized recommendations
  forYouCacheDate: timestamp("for_you_cache_date"), // When cache was last updated
  isAdmin: boolean("is_admin").default(false), // Admin users can view all users
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const colleges = pgTable("colleges", {
  id: serial("id").primaryKey(),
  // Unique so onConflictDoNothing() calls in data-loader.ts/data-sources.ts
  // actually do something — without this, every server restart that hits
  // the "database already populated" top-up path re-inserted the same
  // hardcoded popularColleges list as brand-new duplicate rows every time,
  // since there was no constraint for a conflict to ever occur against.
  name: text("name").notNull().unique(),
  location: text("location").notNull(),
  country: text("country").notNull(),
  state: text("state"),
  city: text("city").notNull(),
  tuition: integer("tuition").notNull(),
  acceptanceRate: integer("acceptance_rate").notNull(),
  graduationRate: integer("graduation_rate").notNull(),
  type: text("type").notNull(), // public, private
  sportsPrograms: text("sports_programs").array().notNull(),
  academicLevel: text("academic_level").notNull(), // high, medium, developing
  scholarships: text("scholarships").array().notNull(),
  walkOnAvailable: boolean("walk_on_available").notNull().default(false),
  coachName: text("coach_name"),
  coachEmail: text("coach_email"),
  coachPhone: text("coach_phone"),
  website: text("website"),
  description: text("description"),
  imageUrl: text("image_url"),
  rating: integer("rating").default(4),
  satAvg: integer("sat_avg"),
  satLow: integer("sat_low"),
  satHigh: integer("sat_high"),
});

export const userPreferences = pgTable("user_preferences", {
  id: serial("id").primaryKey(),
  sport: text("sport"),
  academicLevel: text("academic_level"),
  location: text("location"),
  tuitionCap: integer("tuition_cap"),
  minAcceptanceRate: integer("min_acceptance_rate"),
  minGraduationRate: integer("min_graduation_rate"),
  createdAt: text("created_at").notNull(),
});

export const savedPlans = pgTable("saved_plans", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  collegeIds: integer("college_ids").array().notNull(),
  preferences: json("preferences"),
  createdAt: text("created_at").notNull(),
});

export const careerPaths = pgTable("career_paths", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  averageSalary: integer("average_salary").notNull(),
  jobGrowthRate: real("job_growth_rate").notNull(),
  educationRequired: text("education_required").notNull(),
  skills: text("skills").array().notNull(),
  industries: text("industries").array().notNull(),
  relatedMajors: text("related_majors").array().notNull(),
  workEnvironment: text("work_environment"),
  jobOutlook: text("job_outlook"),
  onetCode: text("onet_code"),
  // 🎯 NEW: Importance weights for vector-based matching
  skillImportance: jsonb("skill_importance"), // { "tech_001": 90, "soft_002": 75, ... }
  interestAlignment: jsonb("interest_alignment"), // { "int_tech_001": 95, "int_health_001": 20, ... }
  // Education constraints
  minimumEducation: text("minimum_education"), // hard requirement
  licensingRequired: boolean("licensing_required").default(false),
  certifications: text("certifications").array(),
});

// Enhanced verified scholarships with source tracking
export const scholarships = pgTable("scholarships", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  type: text("type").notNull(), // federal, state, corporate, nonprofit, university
  state: text("state"), // nullable, e.g., "CA", "NY", null for federal
  industryTags: text("industry_tags").array(), // ["STEM", "Healthcare"]
  awardMin: integer("award_min"),
  awardMax: integer("award_max"),
  amount: integer("amount").notNull(), // keeping for backward compatibility
  currency: text("currency").default("USD"),
  deadlineAt: timestamp("deadline_at"), // actual deadline timestamp
  opensAt: timestamp("opens_at"), // when applications open
  deadline: text("deadline"), // legacy text deadline for display
  url: text("url").notNull(), // official application link
  website: text("website"), // official info page
  eligibility: jsonb("eligibility"), // { gpa, major, classYear, residency, etc. }
  eligibilityRequirements: text("eligibility_requirements").array().notNull(),
  targetDemographics: text("target_demographics").array().notNull(),
  applicationRequirements: text("application_requirements").array().notNull(),
  description: text("description"),
  renewable: boolean("renewable").default(false),
  // Source verification tracking
  sourceName: text("source_name").notNull().default("manual"), // "official", "studentaid.gov", etc.
  sourceUrl: text("source_url"), // where we got the data
  sourceLastCheckedAt: timestamp("source_last_checked_at"),
  sourceLastVerifiedAt: timestamp("source_last_verified_at"),
  sourceChecksum: text("source_checksum"), // hash of key fields for change detection
  isActive: boolean("is_active").default(true),
  notes: text("notes"), // e.g., "deadline varies by term"
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User saved scholarships with status tracking
export const userSavedScholarships = pgTable("user_saved_scholarships", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  planId: integer("plan_id"), // optional link to a user plan
  scholarshipId: integer("scholarship_id").notNull(),
  savedAt: timestamp("saved_at").defaultNow(),
  status: text("status").default("saved"), // saved, applied, submitted, won, not_interested
  customDeadlineOverride: timestamp("custom_deadline_override"),
  applicationNotes: text("application_notes"),
  submittedAt: timestamp("submitted_at"),
  resultAt: timestamp("result_at"),
});

// Scholarship notifications for deadline alerts
export const scholarshipNotifications = pgTable("scholarship_notifications", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  scholarshipId: integer("scholarship_id").notNull(),
  type: text("type").notNull(), // deadline_30, deadline_14, deadline_7, deadline_3, deadline_1, expired, source_changed
  scheduledFor: timestamp("scheduled_for").notNull(),
  sentAt: timestamp("sent_at"),
  channel: text("channel").default("in_app"), // in_app, email, sms, push
  payload: jsonb("payload"), // notification content
  read: boolean("read").default(false),
});

// Data source health tracking
export const dataSourceHealth = pgTable("data_source_health", {
  id: serial("id").primaryKey(),
  sourceName: text("source_name").notNull().unique(),
  sourceType: text("source_type").notNull(), // federal, state, corporate
  expectedRefreshDays: integer("expected_refresh_days").default(30),
  lastCheckedAt: timestamp("last_checked_at"),
  lastChangedAt: timestamp("last_changed_at"),
  status: text("status").default("healthy"), // healthy, stale, failing
  lastError: text("last_error"),
  scholarshipCount: integer("scholarship_count").default(0),
});

// Fellowships table - similar to scholarships but for graduate/postdoc opportunities
export const fellowships = pgTable("fellowships", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  provider: text("provider").notNull(),
  type: text("type").notNull(), // research, professional, academic, postdoc, dissertation
  category: text("category"), // STEM, humanities, social-sciences, arts, interdisciplinary
  amount: integer("amount").notNull(),
  amountType: text("amount_type").default("stipend"), // stipend, grant, tuition, full-support
  duration: text("duration"), // e.g., "1 year", "2 years", "3-5 years"
  deadline: text("deadline"),
  deadlineAt: timestamp("deadline_at"),
  website: text("website"),
  description: text("description"),
  eligibilityRequirements: text("eligibility_requirements").array().notNull(),
  targetDemographics: text("target_demographics").array().notNull(),
  applicationRequirements: text("application_requirements").array().notNull(),
  fields: text("fields").array(), // specific fields/disciplines
  academicLevel: text("academic_level").array(), // graduate, postdoc, doctoral, masters
  citizenshipRequirements: text("citizenship_requirements").array(), // US citizen, permanent resident, international
  minGpa: real("min_gpa"),
  benefits: text("benefits").array(), // health insurance, travel funds, research funds
  hostInstitutions: text("host_institutions").array(), // specific universities/labs if applicable
  renewable: boolean("renewable").default(false),
  competitive: text("competitive").default("high"), // high, very-high, moderate
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User saved fellowships
export const savedFellowships = pgTable("saved_fellowships", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  fellowshipId: integer("fellowship_id").notNull(),
  applicationStatus: text("application_status").default("interested"), // interested, preparing, applied, awarded, rejected
  deadline: text("deadline"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// Fellowships saved to specific plans
export const planFellowships = pgTable("plan_fellowships", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  fellowshipId: integer("fellowship_id").notNull(),
  notes: text("notes"),
  priority: text("priority").default("medium"), // high, medium, low
  createdAt: text("created_at").notNull(),
});

// User profiles with skills assessment and preferences
export const userProfiles = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(), // Session-based user ID
  primaryInterest: text("primary_interest"),
  secondaryInterest: text("secondary_interest"),
  skillRatings: json("skill_ratings"), // { "Programming": 8, "Critical Thinking": 7 }
  gpa: real("gpa"),
  locationPreference: text("location_preference"),
  preferredEducation: text("preferred_education"),
  salaryExpectation: integer("salary_expectation"),
  workValues: text("work_values").array(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Saved colleges per user
export const savedColleges = pgTable("saved_colleges", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  collegeId: integer("college_id").notNull(),
  notes: text("notes"),
  priority: text("priority").default("medium"), // high, medium, low
  createdAt: text("created_at").notNull(),
});

// Saved careers per user
export const savedCareers = pgTable("saved_careers", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  careerTitle: text("career_title").notNull(),
  matchScore: integer("match_score"),
  skillsGap: text("skills_gap").array(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// Saved scholarships per user
export const savedScholarships = pgTable("saved_scholarships", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  scholarshipId: integer("scholarship_id").notNull(),
  // Snapshot of the scholarship's name at save time. Used as a fallback for
  // matching the "Saved" badge on list pages when the displayed scholarship
  // lacks a stable id (curated picks, recommendations, hardcoded entries),
  // so a slightly different display name (extra punctuation, year suffix)
  // can still be canonically matched against what the user saved.
  scholarshipName: text("scholarship_name"),
  applicationStatus: text("application_status").default("interested"), // interested, applied, awarded, rejected
  deadline: text("deadline"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// User plans - each user can create multiple plans
export const userPlans = pgTable("user_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// Career matches saved to specific plans
export const planCareers = pgTable("plan_careers", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  careerTitle: text("career_title").notNull(),
  onetCode: text("onet_code").notNull(),
  salary: json("salary"), // { median: number, range: string }
  education: text("education").notNull(),
  growth: text("growth").notNull(),
  matchReasons: text("match_reasons").array().notNull(),
  skillsGap: text("skills_gap").array().notNull(),
  standOutTips: text("stand_out_tips").array().notNull(),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// Schools saved to specific plans
export const planColleges = pgTable("plan_colleges", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  collegeId: integer("college_id").notNull(),
  notes: text("notes"),
  priority: text("priority").default("medium"), // high, medium, low
  createdAt: text("created_at").notNull(),
});

// Scholarships saved to specific plans
export const planScholarships = pgTable("plan_scholarships", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id").notNull(),
  scholarshipName: text("scholarship_name").notNull(),
  amount: text("amount").notNull(),
  deadline: text("deadline"),
  provider: text("provider"),
  matchScore: integer("match_score"),
  matchReasons: text("match_reasons").array(),
  website: text("website"),
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
});

// Comprehensive saved plans with career matching (keeping for backward compatibility)
export const comprehensivePlans = pgTable("comprehensive_plans", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  careerGoal: text("career_goal").notNull(),
  matchedSchools: json("matched_schools"), // Array of college IDs with match scores
  requiredSkills: text("required_skills").array(),
  missingSkills: text("missing_skills").array(),
  recommendedCourses: text("recommended_courses").array(),
  scholarships: json("scholarships"), // Array of scholarship IDs
  timeline: json("timeline"), // Milestone timeline
  notes: text("notes"),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

// 🎯 NEW: User interaction tracking for learning-to-rank feedback loop
export const userCareerInteractions = pgTable("user_career_interactions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  careerTitle: text("career_title").notNull(),
  careerId: integer("career_id"), // Optional FK to career_paths
  // User actions
  viewed: boolean("viewed").default(false),
  clicked: boolean("clicked").default(false),
  expanded: boolean("expanded").default(false),
  saved: boolean("saved").default(false),
  ignored: boolean("ignored").default(false),
  // Context when interaction occurred
  matchScore: integer("match_score"), // What score did we show?
  userSkills: text("user_skills").array(), // What skills did user have?
  userInterests: text("user_interests").array(), // What interests did user have?
  // Metadata
  sessionId: text("session_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertCollegeSchema = createInsertSchema(colleges).omit({
  id: true,
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
});

export const insertSavedPlanSchema = createInsertSchema(savedPlans).omit({
  id: true,
  createdAt: true,
});

export const insertCareerPathSchema = createInsertSchema(careerPaths).omit({
  id: true,
});

export const insertScholarshipSchema = createInsertSchema(scholarships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSavedScholarshipSchema = createInsertSchema(userSavedScholarships).omit({
  id: true,
  savedAt: true,
});

export const insertScholarshipNotificationSchema = createInsertSchema(scholarshipNotifications).omit({
  id: true,
});

export const insertDataSourceHealthSchema = createInsertSchema(dataSourceHealth).omit({
  id: true,
});

export const insertUserProfileSchema = createInsertSchema(userProfiles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedCollegeSchema = createInsertSchema(savedColleges).omit({
  id: true,
  createdAt: true,
});

export const insertSavedCareerSchema = createInsertSchema(savedCareers).omit({
  id: true,
  createdAt: true,
});

export const insertSavedScholarshipSchema = createInsertSchema(savedScholarships).omit({
  id: true,
  createdAt: true,
});

export const insertComprehensivePlanSchema = createInsertSchema(comprehensivePlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// New schemas for user plans system
export const insertUserPlanSchema = createInsertSchema(userPlans).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPlanCareerSchema = createInsertSchema(planCareers).omit({
  id: true,
  createdAt: true,
});

export const insertPlanCollegeSchema = createInsertSchema(planColleges).omit({
  id: true,
  createdAt: true,
});

export const insertPlanScholarshipSchema = createInsertSchema(planScholarships).omit({
  id: true,
  createdAt: true,
});

export const insertUserCareerInteractionSchema = createInsertSchema(userCareerInteractions).omit({
  id: true,
  createdAt: true,
});

// Fellowship schemas
export const insertFellowshipSchema = createInsertSchema(fellowships).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSavedFellowshipSchema = createInsertSchema(savedFellowships).omit({
  id: true,
  createdAt: true,
});

export const insertPlanFellowshipSchema = createInsertSchema(planFellowships).omit({
  id: true,
  createdAt: true,
});

// Enhanced User Profile Schema for AI-powered matching
export const insertEnhancedUserSchema = createInsertSchema(users).omit({
  id: true,
  password: true,
  createdAt: true,
  updatedAt: true,
});

// User Profile Update Schema
export const updateUserProfileSchema = z.object({
  gpa: z.number().min(0).max(4.0).optional(),
  state: z.string().optional(),
  major: z.string().optional(),
  academicLevel: z.enum(['undergraduate', 'graduate']).optional(),
  financialNeed: z.enum(['high', 'medium', 'low']).optional(),
  demographics: z.array(z.string()).optional(),
  interests: z.array(z.string()).optional(),
  personalStatement: z.string().optional(),
});

// AI Resume Analysis Schema
export const resumeAnalysisSchema = z.object({
  interests: z.array(z.string()),
  skills: z.array(z.string()),
  gpa: z.number().nullable(),
  education_level: z.string(),
  demographics: z.array(z.string()),
  analysis_confidence: z.enum(['high', 'medium', 'low']),
  scholarships: z.array(z.any()).optional(), // Allow scholarships from Python script
  careers: z.array(z.any()).optional(), // Allow careers from Python script
  riasec_profile: z.array(z.number()).optional(), // Allow RIASEC data
  debug_info: z.any().optional() // Allow debug information
});

// Relations
export const userPlansRelations = relations(userPlans, ({ many }) => ({
  careers: many(planCareers),
  colleges: many(planColleges),
  scholarships: many(planScholarships),
}));

export const planCareersRelations = relations(planCareers, ({ one }) => ({
  plan: one(userPlans, {
    fields: [planCareers.planId],
    references: [userPlans.id],
  }),
}));

export const planCollegesRelations = relations(planColleges, ({ one }) => ({
  plan: one(userPlans, {
    fields: [planColleges.planId],
    references: [userPlans.id],
  }),
  college: one(colleges, {
    fields: [planColleges.collegeId],
    references: [colleges.id],
  }),
}));

export const planScholarshipsRelations = relations(planScholarships, ({ one }) => ({
  plan: one(userPlans, {
    fields: [planScholarships.planId],
    references: [userPlans.id],
  }),
}));

// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertCollege = z.infer<typeof insertCollegeSchema>;
export type College = typeof colleges.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type UserPreferences = typeof userPreferences.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertSavedPlan = z.infer<typeof insertSavedPlanSchema>;
export type SavedPlan = typeof savedPlans.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertCareerPath = z.infer<typeof insertCareerPathSchema>;
export type CareerPath = typeof careerPaths.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertScholarship = z.infer<typeof insertScholarshipSchema>;
export type Scholarship = typeof scholarships.$inferSelect;

// New types for enhanced save/sync system
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertUserProfile = z.infer<typeof insertUserProfileSchema>;
export type UserProfile = typeof userProfiles.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertSavedCollege = z.infer<typeof insertSavedCollegeSchema>;
export type SavedCollege = typeof savedColleges.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertSavedCareer = z.infer<typeof insertSavedCareerSchema>;
export type SavedCareer = typeof savedCareers.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertSavedScholarship = z.infer<typeof insertSavedScholarshipSchema>;
export type SavedScholarship = typeof savedScholarships.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertComprehensivePlan = z.infer<typeof insertComprehensivePlanSchema>;
export type ComprehensivePlan = typeof comprehensivePlans.$inferSelect;

// User plans system types
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertUserPlan = z.infer<typeof insertUserPlanSchema>;
export type UserPlan = typeof userPlans.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertPlanCareer = z.infer<typeof insertPlanCareerSchema>;
export type PlanCareer = typeof planCareers.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertPlanCollege = z.infer<typeof insertPlanCollegeSchema>;
export type PlanCollege = typeof planColleges.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertPlanScholarship = z.infer<typeof insertPlanScholarshipSchema>;
export type PlanScholarship = typeof planScholarships.$inferSelect;

// Authentication types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// User interaction tracking types
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertUserCareerInteraction = z.infer<typeof insertUserCareerInteractionSchema>;
export type UserCareerInteraction = typeof userCareerInteractions.$inferSelect;

// Enhanced scholarship types
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertUserSavedScholarship = z.infer<typeof insertUserSavedScholarshipSchema>;
export type UserSavedScholarship = typeof userSavedScholarships.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertScholarshipNotification = z.infer<typeof insertScholarshipNotificationSchema>;
export type ScholarshipNotification = typeof scholarshipNotifications.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertDataSourceHealth = z.infer<typeof insertDataSourceHealthSchema>;
export type DataSourceHealth = typeof dataSourceHealth.$inferSelect;

// Fellowship types
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertFellowship = z.infer<typeof insertFellowshipSchema>;
export type Fellowship = typeof fellowships.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertSavedFellowship = z.infer<typeof insertSavedFellowshipSchema>;
export type SavedFellowship = typeof savedFellowships.$inferSelect;
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertPlanFellowship = z.infer<typeof insertPlanFellowshipSchema>;
export type PlanFellowship = typeof planFellowships.$inferSelect;

// Analytics events table
export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: serial("id").primaryKey(),
    eventId: varchar("event_id"),
    anonymousId: varchar("anonymous_id"),
    userId: varchar("user_id"),
    eventName: varchar("event_name").notNull(),
    properties: jsonb("properties"),
    ipAddress: varchar("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_events_created_at").on(table.createdAt),
    index("idx_events_name_created").on(table.eventName, table.createdAt),
    index("idx_events_user_created").on(table.userId, table.createdAt),
    index("idx_events_anon_created").on(table.anonymousId, table.createdAt),
  ],
);

export const insertAnalyticsEventSchema = createInsertSchema(analyticsEvents).omit({ id: true, createdAt: true });
// @ts-ignore - drizzle-zod 0.8.x emits zod v4 internals that fail zod v3 ZodType constraint
export type InsertAnalyticsEvent = z.infer<typeof insertAnalyticsEventSchema>;
export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
