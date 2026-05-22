import { db } from "./db";
import { colleges } from "@workspace/db";

// Minimal raw response shape from the College Scorecard API. Only fields we
// actually read are listed; the index signature keeps unknown fields visible
// without forcing `any` casts at every access site.
interface ScorecardSchool {
  [key: string]: unknown;
  ['school.name']: string;
  ['school.city']: string;
  ['school.state']: string;
  ['school.school_url']?: string | null;
  ['school.ownership']?: number;
  ['school.operating']?: number;
  ['school.degrees_awarded.predominant']?: number;
  ['latest.admissions.admission_rate.overall']?: number;
  ['latest.cost.tuition.in_state']?: number;
  ['latest.cost.tuition.out_of_state']?: number;
  ['latest.student.size']?: number;
  ['latest.completion.completion_rate_4yr_100nt']?: number;
}

export class BulkCollegeLoader {
  private readonly baseUrl = "https://api.data.gov/ed/collegescorecard/v1/schools.json";
  private readonly apiKey = process.env.COLLEGE_SCORECARD_API_KEY;
  private readonly perPage = 100;
  
  async loadAllColleges(): Promise<{ total: number; pages: number; inserted: number }> {
    if (!this.apiKey) {
      throw new Error('College Scorecard API key is required');
    }

    let totalInserted = 0;
    let currentPage = 0;
    let hasMoreData = true;

    console.log('Starting bulk college data fetch from College Scorecard API...');

    while (hasMoreData) {
      try {
        const url = `${this.baseUrl}?api_key=${this.apiKey}&per_page=${this.perPage}&page=${currentPage}&fields=id,school.name,school.city,school.state,school.school_url,school.ownership,school.degrees_awarded.predominant,latest.admissions.admission_rate.overall,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state,latest.student.size,latest.completion.completion_rate_4yr_100nt,school.operating`;

        console.log(`Fetching page ${currentPage}...`);
        const response = await fetch(url);
        
        if (!response.ok) {
          throw new Error(`API request failed: ${response.status} ${response.statusText}`);
        }

        const data = (await response.json()) as { results?: ScorecardSchool[] };
        const collegesBatch = data.results || [];
        
        if (collegesBatch.length === 0) {
          console.log(`No more data found on page ${currentPage}. Stopping.`);
          hasMoreData = false;
          break;
        }

        // Process this batch of colleges
        for (const college of collegesBatch) {
          if (this.isValidCollege(college)) {
            const transformedCollege = this.transformCollegeData(college);
            
            try {
              // Use UPSERT to prevent duplicates based on name + state combination
              await db.insert(colleges)
                .values(transformedCollege)
                .onConflictDoUpdate({
                  target: [colleges.name, colleges.state],
                  set: {
                    description: transformedCollege.description,
                    tuition: transformedCollege.tuition,
                    acceptanceRate: transformedCollege.acceptanceRate,
                    graduationRate: transformedCollege.graduationRate,
                    rating: transformedCollege.rating
                  }
                });
              totalInserted++;
            } catch (error) {
              // Skip duplicates or invalid entries
              console.log(`Skipped college: ${college['school.name']} - ${error}`);
            }
          }
        }

        console.log(`Page ${currentPage} complete. Inserted ${totalInserted} colleges so far.`);
        currentPage++;

        // Add a small delay to respect API rate limits
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`Error fetching page ${currentPage}:`, error);
        // Continue with next page rather than failing completely
        currentPage++;
        
        if (currentPage > 100) {
          console.log('Reached maximum pages limit. Stopping.');
          hasMoreData = false;
        }
      }
    }

    console.log(`Bulk loading complete. Total colleges inserted: ${totalInserted}`);
    
    return {
      total: totalInserted,
      pages: currentPage,
      inserted: totalInserted
    };
  }

  private isValidCollege(college: ScorecardSchool): boolean {
    return Boolean(
      college['school.name'] &&
        college['school.state'] &&
        college['school.operating'] === 1
    );
  }

  private transformCollegeData(college: ScorecardSchool) {
    const degreeLevel = college['school.degrees_awarded.predominant'];
    let academicLevel = 'undergraduate';
    let type = college['school.ownership'] === 1 ? 'public' : 'private';
    
    // Determine academic level and type based on degrees awarded
    if (degreeLevel === 1) {
      academicLevel = 'certificate';
    } else if (degreeLevel === 2) {
      academicLevel = 'associate';
      if (type === 'public') {
        type = 'community-college';
      }
    } else if (degreeLevel === 3) {
      academicLevel = 'undergraduate';
    } else if (degreeLevel === 4) {
      academicLevel = 'graduate';
    }

    // Get tuition - prefer in-state for public, use out-of-state as fallback
    const inStateTuition = college['latest.cost.tuition.in_state'];
    const outOfStateTuition = college['latest.cost.tuition.out_of_state'];
    const tuition = inStateTuition || outOfStateTuition || 0;

    // Calculate acceptance rate
    const admissionRate = college['latest.admissions.admission_rate.overall'];
    const acceptanceRate = admissionRate ? Math.round(admissionRate * 100) : 
                          (academicLevel === 'associate' ? 100 : 65); // Community colleges typically open admission

    // Calculate graduation rate
    const completionRate = college['latest.completion.completion_rate_4yr_100nt'];
    const graduationRate = completionRate ? Math.round(completionRate * 100) : 
                          this.getDefaultGraduationRate(academicLevel, type);

    // Determine sports programs based on institution type and size
    const studentSize = college['latest.student.size'] || 0;
    const sportsPrograms = this.getSportsPrograms(college['school.state'], academicLevel, studentSize);

    return {
      name: college['school.name'],
      location: `${college['school.city'] || 'Unknown'}, ${college['school.state']}, United States`,
      country: 'United States',
      state: college['school.state'],
      city: college['school.city'] || 'Unknown',
      tuition: tuition,
      acceptanceRate: acceptanceRate,
      graduationRate: graduationRate,
      type: type,
      website: college['school.school_url'] || null,
      description: this.generateDescription(college),
      imageUrl: null,
      rating: this.calculateRating(tuition, acceptanceRate, graduationRate),
      sportsPrograms: sportsPrograms,
      academicLevel: academicLevel,
      scholarships: this.getScholarshipTypes(type, academicLevel),
      walkOnAvailable: true,
      coachName: null,
      coachEmail: null,
      coachPhone: null
    };
  }

  private getDefaultGraduationRate(academicLevel: string, type: string): number {
    if (academicLevel === 'associate') return 35;
    if (academicLevel === 'certificate') return 65;
    if (type === 'private') return 75;
    return 70; // Public universities
  }

  private getSportsPrograms(state: string, academicLevel: string, studentSize: number): string[] {
    const baseSports = ['basketball', 'soccer', 'tennis'];
    
    if (academicLevel === 'associate' || academicLevel === 'certificate') {
      return baseSports;
    }

    // Add more sports for larger universities
    if (studentSize > 10000) {
      return [...baseSports, 'football', 'baseball', 'swimming', 'track', 'volleyball'];
    } else if (studentSize > 5000) {
      return [...baseSports, 'baseball', 'volleyball', 'track'];
    }
    
    return baseSports;
  }

  private getScholarshipTypes(type: string, academicLevel: string): string[] {
    const baseScholarships = ['need-based'];
    
    if (type === 'private') {
      baseScholarships.push('merit');
    }
    
    if (academicLevel === 'associate' || type === 'community-college') {
      baseScholarships.push('pell-grant');
    }
    
    if (type === 'public') {
      baseScholarships.push('merit', 'state-aid');
    }
    
    return baseScholarships;
  }

  private generateDescription(college: ScorecardSchool): string {
    const name = college['school.name'];
    const city = college['school.city'] || 'Unknown';
    const state = college['school.state'];
    const ownership = college['school.ownership'] === 1 ? 'public' : 'private';
    const degreeLevel = college['school.degrees_awarded.predominant'];
    
    let institutionType = 'institution';
    if (degreeLevel === 2) {
      institutionType = 'community college';
    } else if (degreeLevel === 1) {
      institutionType = 'technical school';
    } else {
      institutionType = 'university';
    }
    
    return `${name} is a ${ownership} ${institutionType} located in ${city}, ${state}.`;
  }

  private calculateRating(tuition: number, acceptanceRate: number, graduationRate: number): number {
    let rating = 3; // Base rating
    
    // Adjust for graduation rate
    if (graduationRate > 85) rating += 1;
    else if (graduationRate > 70) rating += 0.5;
    
    // Adjust for selectivity (lower acceptance rate can indicate higher prestige)
    if (acceptanceRate < 20) rating += 1;
    else if (acceptanceRate < 50) rating += 0.5;
    
    // Adjust for affordability (lower tuition is better for students)
    if (tuition < 10000) rating += 0.5;
    else if (tuition > 50000) rating -= 0.5;
    
    return Math.min(5, Math.max(1, Math.round(rating)));
  }
}