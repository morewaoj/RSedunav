import { db } from "./db";
import { careerPaths } from "@workspace/db";
import { desc } from "drizzle-orm";
import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (apiKey) {
    openaiClient = new OpenAI({ apiKey });
    return openaiClient;
  }
  return null;
}

export interface HybridUserProfile {
  interests: string[];
  skills: string[];
  experience?: string;
  education?: string;
  preferredSalary?: number;
  workStyle?: string;
  workValues?: string[];
  industries?: string[];
  timestamp?: number;
}

export interface HybridCareerMatch {
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
  semanticScore: number;
  structuredScore: number;
  confidenceLevel: 'high' | 'medium' | 'low';
}

// ─── Strict matching helpers ───────────────────────────────────────────────

const STOPWORDS = new Set([
  'a', 'an', 'and', 'or', 'the', 'of', 'to', 'in', 'on', 'for', 'with', 'at',
  'by', 'from', 'as', 'is', 'it', 'be', 'are', 'was', 'were',
]);

function normalize(s: string): string {
  return (s || '').toLowerCase().trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(/[\s,/&\-_().]+/)
    .map(t => t.replace(/[^a-z0-9+#]/g, ''))
    .filter(t => t.length > 0 && !STOPWORDS.has(t));
}

function tokenSet(s: string): Set<string> {
  return new Set(tokenize(s));
}

/** True iff `b` appears as a whole-word substring inside `a`. */
function containsAsWord(a: string, b: string): boolean {
  if (!a || !b) return false;
  const escaped = b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(a);
}

/**
 * Strict token overlap: returns true iff the two strings share at least one
 * non-stopword token of length >= 2 (allowing short tech tokens like "ai", "ml", "qa").
 */
function shareToken(a: string, b: string): boolean {
  const at = tokenSet(a);
  const bt = tokenSet(b);
  for (const t of at) {
    if (t.length >= 2 && bt.has(t)) return true;
  }
  return false;
}

/**
 * Phrase match: every token in the (shorter) phrase appears as a token in the other.
 * E.g. "machine learning" matches "machine learning engineer" but NOT just "machine".
 */
function phraseMatch(needle: string, haystack: string): boolean {
  const nt = tokenize(needle);
  const ht = tokenSet(haystack);
  if (nt.length === 0) return false;
  return nt.every(t => ht.has(t));
}

// ─── Taxonomies (sorted by length desc at lookup time) ─────────────────────

interface SkillTaxonomyEntry {
  canonical: string;
  category: string;
  importance: number;
  related: string[];
}

const SKILL_TAXONOMY: Record<string, SkillTaxonomyEntry> = {
  'javascript': { canonical: 'JavaScript', category: 'programming', importance: 90, related: ['js', 'node', 'nodejs', 'react', 'angular', 'vue', 'typescript', 'ts', 'ecmascript', 'frontend', 'front-end', 'web development'] },
  'python': { canonical: 'Python', category: 'programming', importance: 90, related: ['django', 'flask', 'pandas', 'numpy', 'scripting', 'pytorch', 'tensorflow'] },
  'java': { canonical: 'Java', category: 'programming', importance: 85, related: ['jvm', 'spring', 'springboot', 'kotlin', 'android'] },
  'sql': { canonical: 'SQL/Databases', category: 'data', importance: 85, related: ['database', 'mysql', 'postgresql', 'postgres', 'oracle', 'mongodb', 'nosql', 'data management'] },
  'machine learning': { canonical: 'Machine Learning', category: 'ai', importance: 95, related: ['ml', 'ai', 'artificial intelligence', 'deep learning', 'neural networks', 'tensorflow', 'pytorch'] },
  'data analysis': { canonical: 'Data Analysis', category: 'analytics', importance: 85, related: ['analytics', 'statistics', 'tableau', 'powerbi', 'data visualization', 'business intelligence'] },
  'cloud computing': { canonical: 'Cloud Computing', category: 'infrastructure', importance: 88, related: ['aws', 'azure', 'gcp', 'google cloud', 'devops'] },
  'project management': { canonical: 'Project Management', category: 'business', importance: 80, related: ['pm', 'agile', 'scrum', 'kanban', 'jira', 'planning', 'coordination'] },
  'communication': { canonical: 'Communication', category: 'soft_skill', importance: 75, related: ['public speaking', 'presentation', 'verbal', 'written', 'interpersonal'] },
  'leadership': { canonical: 'Leadership', category: 'soft_skill', importance: 80, related: ['management', 'team lead', 'supervision', 'mentoring', 'directing', 'executive'] },
  'problem solving': { canonical: 'Problem Solving', category: 'cognitive', importance: 85, related: ['analytical', 'troubleshooting', 'debugging', 'critical thinking'] },
  'design': { canonical: 'Design', category: 'creative', importance: 80, related: ['ui', 'ux', 'graphic design', 'visual design', 'figma', 'photoshop', 'illustrator', 'user interface', 'user experience', 'typography', 'branding'] },
  'marketing': { canonical: 'Marketing', category: 'business', importance: 75, related: ['digital marketing', 'seo', 'social media', 'content marketing', 'advertising', 'brand'] },
  'finance': { canonical: 'Finance', category: 'business', importance: 80, related: ['financial analysis', 'accounting', 'budgeting', 'forecasting', 'investment', 'banking', 'excel'] },
  'healthcare': { canonical: 'Healthcare', category: 'domain', importance: 85, related: ['medical', 'medicine'] },
  'nursing': { canonical: 'Nursing', category: 'health', importance: 90, related: ['rn', 'bedside care'] },
  'engineering': { canonical: 'Engineering', category: 'technical', importance: 85, related: ['mechanical', 'electrical', 'civil', 'structural', 'systems', 'industrial', 'engineering design'] },
  'research': { canonical: 'Research', category: 'academic', importance: 80, related: ['scientific research', 'investigation', 'laboratory', 'academic research'] },
  'customer service': { canonical: 'Customer Service', category: 'service', importance: 70, related: ['support', 'client relations', 'help desk', 'customer support'] },
  'sales': { canonical: 'Sales', category: 'business', importance: 75, related: ['selling', 'business development', 'account management', 'negotiation', 'revenue'] },
  'writing': { canonical: 'Writing', category: 'creative', importance: 75, related: ['content writing', 'copywriting', 'technical writing', 'editing', 'documentation'] },
  'cybersecurity': { canonical: 'Cybersecurity', category: 'security', importance: 90, related: ['security', 'information security', 'network security', 'ethical hacking', 'penetration testing', 'firewall', 'incident response'] },
  'networking': { canonical: 'Networking', category: 'infrastructure', importance: 80, related: ['network administration', 'cisco', 'tcp/ip', 'routing', 'switching'] },
  'mobile development': { canonical: 'Mobile Development', category: 'programming', importance: 85, related: ['ios', 'android', 'swift', 'kotlin', 'react native', 'flutter', 'mobile apps'] },
  'automation': { canonical: 'Automation', category: 'technical', importance: 85, related: ['scripting', 'rpa', 'process automation', 'workflow automation'] },
  'teaching': { canonical: 'Teaching', category: 'education', importance: 75, related: ['education', 'training', 'instruction', 'tutoring', 'learning strategies', 'curriculum'] },
  'c++': { canonical: 'C++', category: 'programming', importance: 85, related: ['cpp', 'systems programming', 'embedded', 'game development'] },
  'r programming': { canonical: 'R Programming', category: 'data', importance: 80, related: ['rstudio', 'statistical analysis'] },
  'devops': { canonical: 'DevOps', category: 'infrastructure', importance: 88, related: ['ci/cd', 'docker', 'kubernetes', 'jenkins', 'deployment'] },
  'testing': { canonical: 'Software Testing', category: 'quality', importance: 75, related: ['qa', 'quality assurance', 'test automation', 'selenium', 'unit testing'] },
  'physical therapy': { canonical: 'Physical Therapy', category: 'health', importance: 90, related: ['rehabilitation', 'manual therapy', 'exercise prescription', 'sports medicine'] },
  'occupational therapy': { canonical: 'Occupational Therapy', category: 'health', importance: 90, related: ['adaptive equipment', 'patient assessment', 'treatment planning'] },
  'speech therapy': { canonical: 'Speech Therapy', category: 'health', importance: 90, related: ['speech language pathology', 'communication disorders', 'language assessment'] },
  'pharmacy': { canonical: 'Pharmacy', category: 'health', importance: 90, related: ['pharmaceutical', 'drug interactions', 'clinical knowledge'] },
  'dental': { canonical: 'Dental Care', category: 'health', importance: 88, related: ['dentistry', 'oral health', 'dental hygiene', 'dental radiography', 'preventive care'] },
  'social work': { canonical: 'Social Work', category: 'service', importance: 80, related: ['counseling', 'case management', 'crisis intervention', 'community resources'] },
  'human resources': { canonical: 'Human Resources', category: 'business', importance: 80, related: ['hr', 'recruiting', 'employment law', 'conflict resolution', 'people operations'] },
  'mathematics': { canonical: 'Mathematics', category: 'analytical', importance: 85, related: ['math', 'calculus', 'algebra', 'statistics', 'mathematical modeling'] },
  'cad': { canonical: 'CAD', category: 'technical', importance: 80, related: ['cad software', 'autocad', 'solidworks', 'engineering drawing'] },
  'environmental': { canonical: 'Environmental Science', category: 'domain', importance: 80, related: ['water treatment', 'air quality', 'waste management', 'environmental regulations', 'sustainability'] },
  'biomedical': { canonical: 'Biomedical', category: 'health', importance: 85, related: ['medical devices', 'biotechnology', 'biomedical engineering', 'product design'] },
  'manufacturing': { canonical: 'Manufacturing', category: 'industrial', importance: 80, related: ['production', 'production planning', 'process improvement', 'industrial', 'assembly'] },
  'quality assurance': { canonical: 'Quality Assurance', category: 'quality', importance: 80, related: ['qa', 'quality control', 'attention to detail', 'inspection', 'measurement'] },
  'consulting': { canonical: 'Consulting', category: 'business', importance: 80, related: ['advisory', 'strategy', 'management consulting', 'professional services'] },
  'legal': { canonical: 'Legal', category: 'professional', importance: 85, related: ['law', 'compliance', 'regulatory', 'attorney', 'paralegal', 'contracts'] },
};

interface InterestTaxonomyEntry {
  canonical: string;
  industries: string[];
  related: string[];
}

const INTEREST_TAXONOMY: Record<string, InterestTaxonomyEntry> = {
  'technology': { canonical: 'Technology', industries: ['Technology', 'Software', 'IT', 'Information Technology', 'Software Development'], related: ['tech', 'software', 'computers', 'digital', 'innovation', 'programming', 'coding'] },
  'healthcare': { canonical: 'Healthcare', industries: ['Healthcare', 'Hospitals', 'Medical', 'Health Services', 'Nursing Homes', 'Pharmacy', 'Dentistry', 'Rehabilitation'], related: ['medical', 'health', 'medicine', 'patient care', 'clinical', 'wellness'] },
  'finance': { canonical: 'Finance', industries: ['Finance', 'Banking', 'Financial Services', 'Investment', 'Insurance'], related: ['banking', 'investment', 'accounting', 'fintech', 'economics', 'trading'] },
  'education': { canonical: 'Education', industries: ['Education', 'Public Schools', 'Private Schools', 'Schools', 'Academia', 'Training'], related: ['teaching', 'learning', 'academic', 'instruction', 'university', 'curriculum'] },
  'engineering': { canonical: 'Engineering', industries: ['Engineering', 'Engineering Services', 'Manufacturing', 'Construction', 'Industrial', 'Aerospace', 'Automotive'], related: ['mechanical', 'electrical', 'civil', 'structural', 'industrial', 'building'] },
  'business': { canonical: 'Business', industries: ['Business', 'Consulting', 'Management', 'Corporate'], related: ['management', 'consulting', 'strategy', 'operations', 'enterprise', 'corporate'] },
  'science': { canonical: 'Science', industries: ['Science', 'Research', 'Biotech', 'Pharmaceutical', 'Medical Devices'], related: ['research', 'laboratory', 'scientific', 'biotech', 'pharmaceutical', 'biology', 'chemistry'] },
  'arts': { canonical: 'Creative Arts', industries: ['Arts', 'Design', 'Design Services', 'Entertainment', 'Media', 'Publishing', 'Advertising'], related: ['creative', 'artistic', 'visual', 'music', 'film', 'graphic'] },
  'law': { canonical: 'Legal', industries: ['Legal', 'Law', 'Compliance', 'Court', 'Law Firm'], related: ['legal', 'attorney', 'lawyer', 'justice', 'court', 'compliance', 'regulatory', 'paralegal'] },
  'marketing': { canonical: 'Marketing', industries: ['Marketing', 'Advertising', 'Media', 'Communications'], related: ['advertising', 'branding', 'digital marketing', 'promotion', 'pr', 'communications'] },
  'environment': { canonical: 'Environmental', industries: ['Environmental', 'Environmental Services', 'Sustainability', 'Energy'], related: ['sustainability', 'green', 'conservation', 'renewable', 'ecology', 'climate'] },
  'sports': { canonical: 'Sports', industries: ['Sports', 'Recreation', 'Fitness', 'Athletics', 'Sports Medicine'], related: ['athletics', 'fitness', 'recreation', 'coaching', 'physical education'] },
  'nonprofit': { canonical: 'Nonprofit', industries: ['Nonprofit', 'Social Services', 'NGO', 'Charity'], related: ['charity', 'social work', 'community', 'volunteer', 'advocacy', 'humanitarian'] },
  'government': { canonical: 'Government', industries: ['Government', 'Public Sector', 'Policy', 'Federal'], related: ['public sector', 'policy', 'administration', 'civic', 'public service', 'federal'] },
  'data': { canonical: 'Data Science', industries: ['Technology', 'Analytics', 'Business Intelligence', 'Data', 'Finance'], related: ['analytics', 'big data', 'data analysis', 'business intelligence', 'statistics'] },
  'security': { canonical: 'Security', industries: ['Security', 'Cybersecurity', 'Defense', 'Technology', 'Government'], related: ['cybersecurity', 'information security', 'defense', 'protection', 'risk'] },
  'manufacturing': { canonical: 'Manufacturing', industries: ['Manufacturing', 'Industrial', 'Operations', 'Quality Assurance'], related: ['production', 'factory', 'industrial', 'operations', 'assembly', 'supply chain'] },
  'retail': { canonical: 'Retail', industries: ['Retail', 'Sales', 'Customer Service'], related: ['store', 'commerce', 'shopping', 'merchandising'] },
  'consulting': { canonical: 'Consulting', industries: ['Consulting', 'Business', 'Management'], related: ['advisory', 'strategy', 'management consulting', 'analyst', 'professional services'] },
  'social work': { canonical: 'Social Work', industries: ['Social Services', 'Healthcare', 'Nonprofit', 'Government'], related: ['counseling', 'community', 'welfare', 'advocacy', 'case management'] },
  'creative': { canonical: 'Creative', industries: ['Design', 'Design Services', 'Marketing', 'Media', 'Advertising', 'Arts', 'Publishing'], related: ['design', 'art', 'graphic', 'visual', 'artistic', 'media'] },
  'research': { canonical: 'Research', industries: ['Research', 'Science', 'Technology', 'Academia', 'Healthcare', 'Medical Devices', 'Pharmaceuticals'], related: ['scientific', 'study', 'analysis', 'investigation', 'laboratory', 'academic'] },
  'helping people': { canonical: 'Helping People', industries: ['Healthcare', 'Social Services', 'Education', 'Nonprofit'], related: ['service', 'care', 'community', 'support', 'patient', 'counseling'] },
};

// Pre-sort keys longest-first so multi-word keys ("machine learning") win over substrings ("machine").
const SKILL_KEYS_BY_LEN = Object.keys(SKILL_TAXONOMY).sort((a, b) => b.length - a.length);
const INTEREST_KEYS_BY_LEN = Object.keys(INTEREST_TAXONOMY).sort((a, b) => b.length - a.length);

interface CanonSkill { original: string; canonical: string; importance: number; category: string; related: string[]; }
interface CanonInterest { original: string; canonical: string; industries: string[]; related: string[]; }

function canonicalizeSkill(input: string): CanonSkill {
  const normalized = normalize(input);
  const inputTokens = tokenSet(normalized);

  for (const key of SKILL_KEYS_BY_LEN) {
    const t = SKILL_TAXONOMY[key];
    if (normalized === key || normalized === t.canonical.toLowerCase()) {
      return { original: input, canonical: t.canonical, importance: t.importance, category: t.category, related: t.related };
    }
    if (t.related.some(r => normalize(r) === normalized)) {
      return { original: input, canonical: t.canonical, importance: t.importance, category: t.category, related: t.related };
    }
    if (phraseMatch(key, normalized) || phraseMatch(normalized, key)) {
      return { original: input, canonical: t.canonical, importance: t.importance, category: t.category, related: t.related };
    }
    for (const r of t.related) {
      if (phraseMatch(r, normalized) || phraseMatch(normalized, r)) {
        return { original: input, canonical: t.canonical, importance: t.importance, category: t.category, related: t.related };
      }
    }
  }

  for (const key of SKILL_KEYS_BY_LEN) {
    const t = SKILL_TAXONOMY[key];
    if (inputTokens.has(key)) {
      return { original: input, canonical: t.canonical, importance: t.importance, category: t.category, related: t.related };
    }
  }

  return { original: input, canonical: input.trim() || normalized, importance: 60, category: 'general', related: [] };
}

function canonicalizeSkills(skills: string[]): CanonSkill[] {
  const out: CanonSkill[] = [];
  const seen = new Set<string>();
  for (const s of skills) {
    if (!s) continue;
    const c = canonicalizeSkill(s);
    if (seen.has(c.canonical.toLowerCase())) continue;
    seen.add(c.canonical.toLowerCase());
    out.push(c);
  }
  return out;
}

function canonicalizeInterest(input: string): CanonInterest {
  const normalized = normalize(input);

  for (const key of INTEREST_KEYS_BY_LEN) {
    const t = INTEREST_TAXONOMY[key];
    if (normalized === key || normalized === t.canonical.toLowerCase()) {
      return { original: input, canonical: t.canonical, industries: t.industries, related: t.related };
    }
    if (t.related.some(r => normalize(r) === normalized)) {
      return { original: input, canonical: t.canonical, industries: t.industries, related: t.related };
    }
    if (phraseMatch(key, normalized) || phraseMatch(normalized, key)) {
      return { original: input, canonical: t.canonical, industries: t.industries, related: t.related };
    }
    for (const r of t.related) {
      if (phraseMatch(r, normalized) || phraseMatch(normalized, r)) {
        return { original: input, canonical: t.canonical, industries: t.industries, related: t.related };
      }
    }
  }

  return { original: input, canonical: input.trim() || normalized, industries: [input.trim()], related: [] };
}

function canonicalizeInterests(interests: string[]): CanonInterest[] {
  const out: CanonInterest[] = [];
  const seen = new Set<string>();
  for (const i of interests) {
    if (!i) continue;
    const c = canonicalizeInterest(i);
    if (seen.has(c.canonical.toLowerCase())) continue;
    seen.add(c.canonical.toLowerCase());
    out.push(c);
  }
  return out;
}

// ─── Matcher ───────────────────────────────────────────────────────────────

export class HybridCareerMatcher {
  private embeddingCache: Map<string, number[]> = new Map();
  private careerEmbeddingsCache: Map<number, number[]> = new Map();

  async matchCareers(userProfile: HybridUserProfile): Promise<{
    careerOptions: HybridCareerMatch[];
    matchingAlgorithm: string;
    confidence: number;
    totalFound: number;
    performanceMetrics: Record<string, number>;
  }> {
    const startTime = Date.now();
    const metrics = { canonicalization: 0, embedding: 0, matching: 0, total: 0 };

    const canonStart = Date.now();
    const canonSkills = canonicalizeSkills(userProfile.skills || []);
    const canonInterests = canonicalizeInterests(userProfile.interests || []);
    metrics.canonicalization = Date.now() - canonStart;

    const allCareers = await db.select().from(careerPaths).orderBy(desc(careerPaths.averageSalary));
    if (allCareers.length === 0) throw new Error("No careers found in database");

    const hasEmbedding = !!process.env.OPENAI_API_KEY;
    const semanticWeight = hasEmbedding ? 0.30 : 0.05;
    const structuredWeight = 1 - semanticWeight;

    let userEmbedding: number[] | null = null;
    if (hasEmbedding) {
      const embStart = Date.now();
      const profileText = this.buildProfileText(userProfile, canonSkills, canonInterests);
      userEmbedding = await this.getEmbedding(profileText);
      metrics.embedding = Date.now() - embStart;
    }

    const matchStart = Date.now();
    const matches: HybridCareerMatch[] = [];

    for (const career of allCareers) {
      const match = await this.calculateHybridMatch(
        career,
        userProfile,
        canonSkills,
        canonInterests,
        userEmbedding,
        semanticWeight,
        structuredWeight,
      );
      if (match.matchScore >= 35) matches.push(match);
    }

    matches.sort((a, b) => b.matchScore - a.matchScore);
    metrics.matching = Date.now() - matchStart;
    metrics.total = Date.now() - startTime;

    const topMatches = matches.slice(0, 10);

    return {
      careerOptions: topMatches,
      matchingAlgorithm: hasEmbedding
        ? "Hybrid v3 (Strict Token Matching + Semantic Embeddings)"
        : "Strict Token Matching v3 (taxonomy-driven)",
      confidence: topMatches.length > 0 ? Math.round(topMatches[0].matchScore) : 0,
      totalFound: matches.length,
      performanceMetrics: metrics,
    };
  }

  private buildProfileText(
    profile: HybridUserProfile,
    canonSkills: CanonSkill[],
    canonInterests: CanonInterest[],
  ): string {
    const parts: string[] = [];
    if (canonSkills.length > 0) parts.push(`Skills: ${canonSkills.map(s => s.canonical).join(', ')}`);
    if (canonInterests.length > 0) parts.push(`Interests: ${canonInterests.map(i => i.canonical).join(', ')}`);
    if (profile.education) parts.push(`Education: ${profile.education}`);
    if (profile.workValues?.length) parts.push(`Values: ${profile.workValues.join(', ')}`);
    return parts.join('. ');
  }

  private async getEmbedding(text: string): Promise<number[] | null> {
    const cacheKey = text.slice(0, 200);
    if (this.embeddingCache.has(cacheKey)) return this.embeddingCache.get(cacheKey)!;
    const client = getOpenAIClient();
    if (!client) return null;
    try {
      const resp = await client.embeddings.create({ model: 'text-embedding-3-small', input: text });
      const emb = resp.data[0].embedding;
      this.embeddingCache.set(cacheKey, emb);
      return emb;
    } catch (e) {
      console.warn('OpenAI embedding error:', e);
      return null;
    }
  }

  private async getCareerEmbedding(career: any): Promise<number[] | null> {
    if (this.careerEmbeddingsCache.has(career.id)) return this.careerEmbeddingsCache.get(career.id)!;
    const text = `${career.title}. ${career.description}. Skills: ${(career.skills || []).join(', ')}. Industries: ${(career.industries || []).join(', ')}.`;
    const emb = await this.getEmbedding(text);
    if (emb) this.careerEmbeddingsCache.set(career.id, emb);
    return emb;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dot = 0, na = 0, nb = 0;
    for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
    const d = Math.sqrt(na) * Math.sqrt(nb);
    return d === 0 ? 0 : dot / d;
  }

  private async calculateHybridMatch(
    career: any,
    userProfile: HybridUserProfile,
    canonSkills: CanonSkill[],
    canonInterests: CanonInterest[],
    userEmbedding: number[] | null,
    semanticWeight: number,
    structuredWeight: number,
  ): Promise<HybridCareerMatch> {
    const matchReasons: string[] = [];
    const skillsMatch: string[] = [];
    const missingSkills: string[] = [];

    let semanticScore = 0;
    if (userEmbedding) {
      const careerEmb = await this.getCareerEmbedding(career);
      if (careerEmb) {
        const sim = this.cosineSimilarity(userEmbedding, careerEmb);
        semanticScore = Math.min(100, sim * 100 + 25);
      }
    }

    const components: Array<{ name: string; score: number; weight: number }> = [];

    const skillScore = this.scoreSkills(canonSkills, career, skillsMatch, missingSkills);
    components.push({ name: 'skills', score: skillScore, weight: 0.45 });
    if (skillScore >= 75) matchReasons.push(`Excellent skill alignment (${Math.round(skillScore)}%)`);
    else if (skillScore >= 55) matchReasons.push(`Strong skills match`);
    else if (skillScore >= 35) matchReasons.push(`Some relevant skills`);

    const interestScore = this.scoreInterests(canonInterests, career);
    components.push({ name: 'interests', score: interestScore, weight: 0.35 });
    if (interestScore >= 75) matchReasons.push(`Strong fit with your interests`);
    else if (interestScore >= 50) matchReasons.push(`Good interest alignment`);

    let educationScore = 70;
    let educationGap = 0;
    if (userProfile.education) {
      const r = this.scoreEducation(userProfile.education, career.educationRequired);
      educationScore = r.score;
      educationGap = r.gap;
      components.push({ name: 'education', score: educationScore, weight: 0.15 });
      if (educationScore >= 80) matchReasons.push(`Education meets requirements`);
    }

    if (userProfile.preferredSalary) {
      const sal = this.scoreSalary(userProfile.preferredSalary, career.averageSalary);
      components.push({ name: 'salary', score: sal, weight: 0.05 });
    }

    if (userProfile.workValues?.length) {
      const v = this.scoreWorkValues(userProfile.workValues, career);
      components.push({ name: 'workValues', score: v, weight: 0.05 });
    }

    const totalW = components.reduce((s, c) => s + c.weight, 0);
    const structured = components.reduce((s, c) => s + c.score * (c.weight / totalW), 0);

    let final = (semanticScore * semanticWeight) + (structured * structuredWeight);

    // Hard caps for accuracy:
    if (canonInterests.length > 0 && interestScore < 15 && skillScore < 40) {
      final = Math.min(final, 35);
      matchReasons.push('Limited interest & skill alignment');
    } else if (canonInterests.length > 0 && interestScore < 25) {
      final = Math.min(final, 55);
    }
    if (canonSkills.length > 0 && skillScore < 15 && interestScore < 40) {
      final = Math.min(final, 40);
    }
    if (educationGap >= 2) {
      // Soft penalty rather than hard cap — passionate aspirational matches still rank
      final = final * 0.85;
      matchReasons.push(`Requires more education than current level`);
    }

    let confidenceLevel: 'high' | 'medium' | 'low' = 'low';
    if (final >= 75 && skillScore >= 50 && interestScore >= 50) confidenceLevel = 'high';
    else if (final >= 55 && (skillScore >= 40 || interestScore >= 50)) confidenceLevel = 'medium';

    const standOutTips = this.generateTips(career, skillsMatch, missingSkills);
    if (matchReasons.length === 0) matchReasons.push('Potential career path worth exploring');

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
      matchScore: Math.round(Math.max(1, Math.min(99, final))),
      matchReasons,
      skillsMatch,
      missingSkills: missingSkills.slice(0, 5),
      standOutTips,
      semanticScore: Math.round(semanticScore),
      structuredScore: Math.round(structured),
      confidenceLevel,
    };
  }

  /** Returns 1.0 for exact/canonical match, 0.5 for fuzzy token-overlap match, 0 for no match */
  private skillMatchStrength(userSkill: CanonSkill, careerSkill: string): number {
    const cs = normalize(careerSkill);
    const uc = normalize(userSkill.canonical);
    if (cs === uc) return 1.0;
    if (phraseMatch(uc, cs) || phraseMatch(cs, uc)) return 1.0;
    for (const r of userSkill.related) {
      const nr = normalize(r);
      if (cs === nr) return 1.0;
      if (phraseMatch(nr, cs) || phraseMatch(cs, nr)) return 1.0;
    }
    // Token overlap fallback. Single-word overlap (e.g., "therapy", "patient", "care")
    // is too weak to imply same skill — require 2+ shared meaningful tokens.
    const ut = tokenSet(uc);
    const ct = tokenSet(cs);
    let shared = 0;
    for (const t of ut) {
      if (t.length >= 4 && ct.has(t)) shared++;
    }
    if (shared >= 2) return 1.0; // Two or more shared tokens — strong signal
    return 0;
  }

  private skillsMatchCareerSkill(userSkill: CanonSkill, careerSkill: string): boolean {
    return this.skillMatchStrength(userSkill, careerSkill) > 0;
  }

  private scoreSkills(
    userSkills: CanonSkill[],
    career: any,
    skillsMatch: string[],
    missingSkills: string[],
  ): number {
    const careerSkills: string[] = career.skills || [];
    if (userSkills.length === 0) return 25;
    if (careerSkills.length === 0) return 50;

    const careerSkillCanonical = careerSkills.map(s => canonicalizeSkill(s));

    let weightedScore = 0;
    let totalWeight = 0;

    for (const cs of careerSkillCanonical) {
      const w = cs.importance || 70;
      totalWeight += w;
      // Pick the user skill with strongest match to this career-skill canonical
      let bestStrength = 0;
      let bestMatch: CanonSkill | null = null;
      for (const us of userSkills) {
        const exact = normalize(us.canonical) === normalize(cs.canonical);
        const strength = exact ? 1.0 : this.skillMatchStrength(us, cs.canonical);
        if (strength > bestStrength) {
          bestStrength = strength;
          bestMatch = us;
          if (strength === 1.0) break;
        }
      }
      if (bestMatch && bestStrength > 0) {
        weightedScore += w * bestStrength;
        if (!skillsMatch.includes(bestMatch.canonical)) skillsMatch.push(bestMatch.canonical);
      }
    }

    // Also count user skills that match career skills via token overlap (catches off-taxonomy career strings)
    for (const us of userSkills) {
      if (skillsMatch.includes(us.canonical)) continue;
      const hit = careerSkills.find(cs => this.skillsMatchCareerSkill(us, cs));
      if (hit) skillsMatch.push(us.canonical);
    }

    for (const cs of careerSkills) {
      const csCanon = canonicalizeSkill(cs);
      const matched = userSkills.some(us =>
        normalize(us.canonical) === normalize(csCanon.canonical) ||
        this.skillsMatchCareerSkill(us, cs),
      );
      if (!matched) missingSkills.push(cs);
    }

    let coverage = totalWeight > 0 ? weightedScore / totalWeight : 0;
    // Bonus for having multiple matches (depth signal):
    const bonus = skillsMatch.length >= 3 ? 0.10 : skillsMatch.length >= 2 ? 0.05 : 0;
    coverage = Math.min(1, coverage + bonus);
    return Math.round(coverage * 95);
  }

  private scoreInterests(userInterests: CanonInterest[], career: any): number {
    if (userInterests.length === 0) return 50;
    const careerIndustries: string[] = career.industries || [];
    const careerTitle = normalize(career.title);
    const careerDesc = normalize(career.description || '');

    let totalScore = 0;
    for (const interest of userInterests) {
      let s = 0;
      // Direct industry overlap (whole-word, multi-token)
      for (const myInd of interest.industries) {
        for (const careerInd of careerIndustries) {
          if (normalize(myInd) === normalize(careerInd)) { s = Math.max(s, 100); break; }
          if (phraseMatch(myInd, careerInd) || phraseMatch(careerInd, myInd)) { s = Math.max(s, 90); }
          else if (shareToken(myInd, careerInd)) { s = Math.max(s, 60); }
        }
        if (s >= 100) break;
      }
      // Canonical interest token in career title
      if (s < 80) {
        if (containsAsWord(careerTitle, normalize(interest.canonical))) s = Math.max(s, 80);
        else {
          for (const r of interest.related) {
            if (containsAsWord(careerTitle, normalize(r))) { s = Math.max(s, 70); break; }
          }
        }
      }
      // Canonical / related in description
      if (s < 50) {
        if (containsAsWord(careerDesc, normalize(interest.canonical))) s = Math.max(s, 50);
        else {
          for (const r of interest.related) {
            if (containsAsWord(careerDesc, normalize(r))) { s = Math.max(s, 40); break; }
          }
        }
      }
      totalScore += s;
    }
    return Math.min(95, Math.round(totalScore / userInterests.length));
  }

  private scoreEducation(userEdu: string, requiredEdu: string): { score: number; gap: number } {
    const levels: Record<string, number> = {
      'high school': 1, 'diploma': 1, 'ged': 1,
      'some college': 2, 'associate': 2, "associate's": 2,
      'bachelor': 3, "bachelor's": 3, 'undergraduate': 3,
      'master': 4, "master's": 4, 'graduate': 4, 'mba': 4,
      'doctoral': 5, 'doctorate': 5, 'phd': 5, 'professional': 5, 'md': 5, 'jd': 5,
    };
    const get = (s: string) => {
      const n = normalize(s);
      let best = 0;
      for (const [k, v] of Object.entries(levels)) if (n.includes(k) && v > best) best = v;
      return best || 2;
    };
    const u = get(userEdu);
    const r = get(requiredEdu);
    const gap = Math.max(0, r - u);
    if (u >= r) return { score: 95, gap: 0 };
    if (gap === 1) return { score: 70, gap };
    if (gap === 2) return { score: 40, gap };
    return { score: 20, gap };
  }

  private scoreSalary(pref: number, actual: number): number {
    if (!actual) return 50;
    const ratio = actual / pref;
    if (ratio >= 1.3) return 98;
    if (ratio >= 1.1) return 95;
    if (ratio >= 1.0) return 90;
    if (ratio >= 0.85) return 80;
    if (ratio >= 0.7) return 65;
    return 45;
  }

  private scoreWorkValues(values: string[], career: any): number {
    const text = normalize(`${career.description || ''} ${career.workEnvironment || ''} ${career.jobOutlook || ''}`);
    const map: Record<string, string[]> = {
      'work-life balance': ['flexible', 'remote', 'balance', 'hybrid', 'part-time'],
      'high salary': ['competitive', 'lucrative', 'high-paying', 'compensation'],
      'job security': ['stable', 'secure', 'growing', 'demand', 'essential'],
      'creativity': ['creative', 'innovative', 'design', 'artistic'],
      'helping others': ['help', 'service', 'support', 'care', 'community', 'patient'],
      'leadership': ['lead', 'manage', 'direct', 'supervise', 'executive'],
      'autonomy': ['independent', 'autonomous', 'self-directed', 'flexible'],
      'teamwork': ['team', 'collaborate', 'cooperative', 'group'],
      'learning': ['growth', 'development', 'training', 'advancement'],
      'travel': ['travel', 'remote', 'field', 'client-facing'],
    };
    let hits = 0;
    for (const v of values) {
      const kws = map[normalize(v)] || [normalize(v)];
      if (kws.some(k => containsAsWord(text, k))) hits++;
    }
    return values.length > 0 ? Math.round((hits / values.length) * 100) : 50;
  }

  private generateTips(career: any, skillsMatch: string[], missingSkills: string[]): string[] {
    const tips: string[] = [];
    if (missingSkills.length > 0) tips.push(`Build expertise in: ${missingSkills.slice(0, 3).join(', ')}`);
    if (career.industries?.[0]) tips.push(`Network with professionals in ${career.industries[0]}`);
    if (skillsMatch.length > 0) tips.push(`Highlight your ${skillsMatch.slice(0, 2).join(' and ')} expertise`);
    if (career.relatedMajors?.[0]) tips.push(`Consider coursework in ${career.relatedMajors[0]}`);
    tips.push(`Research ${career.title} certifications to stand out`);
    return tips.slice(0, 4);
  }
}

export const hybridCareerMatcher = new HybridCareerMatcher();
