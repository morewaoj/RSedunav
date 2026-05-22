import { aiResumeAnalyzer } from './ai-resume-analyzer';

export class WorkingCareerService {
  async findCareerMatches(userProfile: any): Promise<any[]> {
    const analysisResult = await aiResumeAnalyzer.callPythonAnalyzer({
      resume: (userProfile.interests || []).join(' ') + ' ' + (userProfile.skills || []).join(' '),
      statement: userProfile.preferredEducation || 'bachelor',
      api_key: '',
      desired_degree: userProfile.preferredEducation || 'bachelor',
      state_preference: userProfile.locationPreference || ''
    });

    return (analysisResult.careers || []).map((careerData: any) => ({
      career: {
        title: careerData.career,
        onetCode: careerData.onet_code,
        description: careerData.description,
        averageSalary: careerData.salary,
        jobGrowthRate: careerData.growth,
        educationRequired: userProfile.preferredEducation || 'Bachelor\'s',
        skills: careerData.matched_skills || [],
        industries: [],
        relatedMajors: [],
        workEnvironment: 'Professional environment',
        jobOutlook: careerData.growth,
        matchReasons: [`${careerData.riasec_match}% RIASEC match`, `${careerData.skills_match}% skills match`],
        skillsGap: [],
        standOutTips: [`Focus on ${careerData.career} specific skills`]
      },
      matchScore: careerData.score / 100,
      matchReasons: [`${careerData.riasec_match}% RIASEC compatibility`, `${careerData.skills_match}% skills alignment`],
      skillsMatch: careerData.matched_skills || [],
      educationFit: `${careerData.education_match}% education compatibility`,
      standOutTips: [`Focus on ${careerData.career} specific skills`, 'Build relevant portfolio']
    }));
  }

  async findOptimalCareers(userProfile: any, limit: number = 10): Promise<any[]> {
    const matches = await this.findCareerMatches(userProfile);
    return matches.slice(0, limit).map(match => ({
      jobTitle: match.career.title,
      jobCode: match.career.onetCode,
      description: match.career.description,
      avgSalary: match.career.averageSalary,
      growth: match.career.jobGrowthRate,
      requiredSkills: match.career.skills,
      recommendedDegrees: [match.career.educationRequired],
      standOutTips: match.standOutTips,
      careerPathway: [match.career.title],
      outlook: match.career.jobOutlook,
      tags: ['ai-matched']
    }));
  }

  getAllCareers(): any[] {
    return [];
  }
}

export const workingCareerService = new WorkingCareerService();