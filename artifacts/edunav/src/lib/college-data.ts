import { type College } from "@shared/schema";

// Sports program information and requirements
export const SPORTS_INFO = {
  soccer: {
    name: "Soccer",
    icon: "⚽",
    description: "Association football, popular globally with opportunities at all levels",
    seasons: ["Fall", "Spring"],
    scholarshipAvailability: "High",
    walkOnOpportunities: "Common",
  },
  basketball: {
    name: "Basketball",
    icon: "🏀", 
    description: "Fast-paced team sport with high visibility and competition",
    seasons: ["Winter"],
    scholarshipAvailability: "High",
    walkOnOpportunities: "Limited",
  },
  tennis: {
    name: "Tennis",
    icon: "🎾",
    description: "Individual and doubles sport with year-round training",
    seasons: ["Fall", "Spring"],
    scholarshipAvailability: "Medium",
    walkOnOpportunities: "Common",
  },
  swimming: {
    name: "Swimming",
    icon: "🏊",
    description: "Individual and relay events in pool competitions",
    seasons: ["Fall", "Winter", "Spring"],
    scholarshipAvailability: "Medium",
    walkOnOpportunities: "Common",
  },
  hockey: {
    name: "Hockey",
    icon: "🏒",
    description: "Fast-paced ice sport, especially popular in northern regions",
    seasons: ["Winter"],
    scholarshipAvailability: "High",
    walkOnOpportunities: "Limited",
  },
  track: {
    name: "Track & Field",
    icon: "🏃",
    description: "Various running, jumping, and throwing events",
    seasons: ["Fall", "Winter", "Spring"],
    scholarshipAvailability: "Medium",
    walkOnOpportunities: "Very Common",
  },
  volleyball: {
    name: "Volleyball",
    icon: "🏐",
    description: "Team sport played both indoors and on beach",
    seasons: ["Fall"],
    scholarshipAvailability: "Medium",
    walkOnOpportunities: "Common",
  },
  rugby: {
    name: "Rugby",
    icon: "🏉",
    description: "Physical team sport with growing popularity",
    seasons: ["Fall", "Spring"],
    scholarshipAvailability: "Low",
    walkOnOpportunities: "Very Common",
  },
};

// Academic level descriptions and GPA ranges
export const ACADEMIC_LEVELS = {
  high: {
    name: "High Performance",
    gpaRange: "3.7 - 4.0",
    description: "Top 10% of class, excellent academic record",
    collegeTypes: ["Research Universities", "Highly Selective Colleges"],
    scholarshipOpportunities: "Excellent",
  },
  medium: {
    name: "Good Performance", 
    gpaRange: "3.0 - 3.6",
    description: "Top 25% of class, solid academic foundation",
    collegeTypes: ["State Universities", "Regional Colleges"],
    scholarshipOpportunities: "Good",
  },
  developing: {
    name: "Developing Performance",
    gpaRange: "2.5 - 2.9", 
    description: "Working to improve academic performance",
    collegeTypes: ["Community Colleges", "Open Admission Colleges"],
    scholarshipOpportunities: "Limited",
  },
};

// Scholarship types and descriptions
export const SCHOLARSHIP_TYPES = {
  academic: {
    name: "Academic Scholarships",
    description: "Merit-based awards for high academic achievement",
    requirements: "High GPA, test scores, class rank",
    renewability: "Usually renewable with maintained GPA",
  },
  athletic: {
    name: "Athletic Scholarships", 
    description: "Performance-based awards for sports excellence",
    requirements: "Proven athletic ability, coach recommendation",
    renewability: "Performance and eligibility dependent",
  },
  "need-based": {
    name: "Need-Based Aid",
    description: "Financial assistance based on family income",
    requirements: "FAFSA completion, demonstrated financial need",
    renewability: "Annual review of financial status",
  },
  "merit-based": {
    name: "Merit Scholarships",
    description: "Awards for overall excellence and leadership",
    requirements: "Combination of academics, activities, leadership",
    renewability: "Maintained standards required",
  },
  international: {
    name: "International Student Aid",
    description: "Special funding for students from other countries",
    requirements: "International student status, various criteria",
    renewability: "Varies by program",
  },
  entrance: {
    name: "Entrance Awards",
    description: "Automatic awards for meeting admission criteria",
    requirements: "Meeting specific GPA or test score thresholds",
    renewability: "Often first-year only",
  },
  leadership: {
    name: "Leadership Scholarships",
    description: "Recognition for demonstrated leadership abilities",
    requirements: "Leadership roles, community service, recommendations",
    renewability: "Continued leadership involvement",
  },
};

// Utility functions for working with college data
export const getCollegesByCountry = (colleges: College[], country: string): College[] => {
  return colleges.filter(college => 
    college.country.toLowerCase() === country.toLowerCase()
  );
};

export const getCollegesBySport = (colleges: College[], sport: string): College[] => {
  return colleges.filter(college => 
    college.sportsPrograms.includes(sport.toLowerCase())
  );
};

export const getCollegesByTuitionRange = (
  colleges: College[], 
  minTuition: number, 
  maxTuition: number
): College[] => {
  return colleges.filter(college => 
    college.tuition >= minTuition && college.tuition <= maxTuition
  );
};

export const getCollegesByAcceptanceRate = (
  colleges: College[], 
  minRate: number, 
  maxRate: number
): College[] => {
  return colleges.filter(college => 
    college.acceptanceRate >= minRate && college.acceptanceRate <= maxRate
  );
};

export const formatTuition = (tuition: number, currency: string = 'USD'): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(tuition);
};

export const getAffordabilityLevel = (tuition: number): 'low' | 'medium' | 'high' => {
  if (tuition < 15000) return 'low';
  if (tuition < 40000) return 'medium';
  return 'high';
};

export const getCompetitivenessLevel = (acceptanceRate: number): 'highly-selective' | 'selective' | 'moderate' | 'open' => {
  if (acceptanceRate < 25) return 'highly-selective';
  if (acceptanceRate < 50) return 'selective'; 
  if (acceptanceRate < 75) return 'moderate';
  return 'open';
};

// Default search suggestions for US locations
export const LOCATION_SUGGESTIONS = [
  "California",
  "Texas", 
  "Florida",
  "New York",
  "Pennsylvania",
  "Illinois",
  "Ohio",
  "Georgia",
  "North Carolina",
  "Michigan",
  "Los Angeles, CA",
  "New York, NY", 
  "Chicago, IL",
  "Houston, TX",
  "Phoenix, AZ",
  "Philadelphia, PA",
  "San Antonio, TX",
  "San Diego, CA",
  "Dallas, TX",
  "San Jose, CA",
];

// Popular college search combinations
export const POPULAR_SEARCHES = [
  {
    name: "Canadian Soccer Programs",
    criteria: {
      sport: "soccer",
      location: "Canada",
      academicLevel: "medium",
    },
  },
  {
    name: "Affordable Basketball Schools",
    criteria: {
      sport: "basketball", 
      tuitionCap: 30000,
      academicLevel: "medium",
    },
  },
  {
    name: "High Academic Tennis Programs",
    criteria: {
      sport: "tennis",
      academicLevel: "high",
      minGraduationRate: 80,
    },
  },
  {
    name: "Swimming with Scholarships",
    criteria: {
      sport: "swimming",
      academicLevel: "medium",
    },
  },
];

export default {
  SPORTS_INFO,
  ACADEMIC_LEVELS,
  SCHOLARSHIP_TYPES,
  getCollegesByCountry,
  getCollegesBySport,
  getCollegesByTuitionRange,
  getCollegesByAcceptanceRate,
  formatTuition,
  getAffordabilityLevel,
  getCompetitivenessLevel,
  LOCATION_SUGGESTIONS,
  POPULAR_SEARCHES,
};
