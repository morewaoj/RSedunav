// Direct career matcher to eliminate 0.00% scoring issues
export class DirectCareerMatcher {
  private careerDatabase = [
    {
      title: "Software Engineer",
      onetCode: "15-1252.00",
      description: "Design, develop, and maintain software applications and systems",
      averageSalary: 107000,
      jobGrowthRate: "22% (Much faster than average)",
      educationRequired: "Bachelor's degree",
      skills: ["javascript", "python", "react", "node.js", "sql", "git", "problem solving"],
      riasecProfile: { realistic: 0.3, investigative: 0.8, artistic: 0.2, social: 0.1, enterprising: 0.2, conventional: 0.4 },
      industries: ["Technology", "Software Development", "IT Services"],
      relatedMajors: ["Computer Science", "Software Engineering", "Information Technology"]
    },
    {
      title: "Product Manager",
      onetCode: "11-9041.00",
      description: "Plan and coordinate product development and marketing strategies",
      averageSalary: 115000,
      jobGrowthRate: "19% (Much faster than average)",
      educationRequired: "Bachelor's degree",
      skills: ["project management", "market research", "data analysis", "strategic planning", "communication"],
      riasecProfile: { realistic: 0.1, investigative: 0.5, artistic: 0.3, social: 0.6, enterprising: 0.9, conventional: 0.4 },
      industries: ["Technology", "Business", "Product Development"],
      relatedMajors: ["Business Administration", "Marketing", "Computer Science"]
    },
    {
      title: "Data Scientist",
      onetCode: "15-2051.01",
      description: "Analyze complex data to help organizations make better decisions",
      averageSalary: 126000,
      jobGrowthRate: "35% (Much faster than average)",
      educationRequired: "Master's degree",
      skills: ["python", "sql", "machine learning", "data analysis", "statistics", "excel"],
      riasecProfile: { realistic: 0.2, investigative: 0.9, artistic: 0.1, social: 0.2, enterprising: 0.3, conventional: 0.6 },
      industries: ["Technology", "Analytics", "Research"],
      relatedMajors: ["Data Science", "Statistics", "Computer Science", "Mathematics"]
    },
    {
      title: "Registered Nurse",
      onetCode: "29-1141.00",
      description: "Provide and coordinate patient care, educate patients about health conditions",
      averageSalary: 75000,
      jobGrowthRate: "7% (Faster than average)",
      educationRequired: "Bachelor's degree",
      skills: ["patient care", "nursing", "medical terminology", "emergency care", "documentation"],
      riasecProfile: { realistic: 0.4, investigative: 0.6, artistic: 0.1, social: 0.8, enterprising: 0.2, conventional: 0.5 },
      industries: ["Healthcare", "Medical Services", "Hospitals"],
      relatedMajors: ["Nursing", "Health Sciences", "Biology"]
    },
    {
      title: "Marketing Manager",
      onetCode: "11-2021.00",
      description: "Plan and coordinate marketing policies and programs",
      averageSalary: 95000,
      jobGrowthRate: "10% (Faster than average)",
      educationRequired: "Bachelor's degree",
      skills: ["marketing", "digital marketing", "content creation", "data analysis", "communication"],
      riasecProfile: { realistic: 0.1, investigative: 0.4, artistic: 0.7, social: 0.6, enterprising: 0.8, conventional: 0.3 },
      industries: ["Marketing", "Advertising", "Business"],
      relatedMajors: ["Marketing", "Business Administration", "Communications"]
    },
    {
      title: "Financial Analyst",
      onetCode: "13-2051.00",
      description: "Conduct quantitative analyses of information for investment decisions",
      averageSalary: 83000,
      jobGrowthRate: "6% (As fast as average)",
      educationRequired: "Bachelor's degree",
      skills: ["financial analysis", "excel", "accounting", "budgeting", "investment analysis"],
      riasecProfile: { realistic: 0.1, investigative: 0.7, artistic: 0.1, social: 0.3, enterprising: 0.5, conventional: 0.8 },
      industries: ["Finance", "Banking", "Investment"],
      relatedMajors: ["Finance", "Economics", "Accounting", "Business"]
    },
    {
      title: "Graphic Designer",
      onetCode: "27-1024.00",
      description: "Create visual concepts to communicate ideas that inspire and inform consumers",
      averageSalary: 52000,
      jobGrowthRate: "3% (As fast as average)",
      educationRequired: "Bachelor's degree",
      skills: ["graphic design", "photoshop", "illustrator", "creative thinking", "branding"],
      riasecProfile: { realistic: 0.3, investigative: 0.2, artistic: 0.9, social: 0.3, enterprising: 0.4, conventional: 0.2 },
      industries: ["Design", "Advertising", "Media"],
      relatedMajors: ["Graphic Design", "Art", "Visual Communications"]
    },
    {
      title: "Teacher",
      onetCode: "25-2031.00",
      description: "Educate students in elementary or secondary schools",
      averageSalary: 60000,
      jobGrowthRate: "8% (Faster than average)",
      educationRequired: "Bachelor's degree",
      skills: ["teaching", "curriculum development", "classroom management", "communication"],
      riasecProfile: { realistic: 0.2, investigative: 0.4, artistic: 0.5, social: 0.9, enterprising: 0.3, conventional: 0.4 },
      industries: ["Education", "Public Service", "Schools"],
      relatedMajors: ["Education", "Subject-specific majors", "Child Development"]
    }
  ];

  findMatches(userProfile: any) {
    const userSkills = (userProfile.skills || []).map((s: string) => s.toLowerCase());
    const userInterests = (userProfile.interests || []).map((i: string) => i.toLowerCase());
    
    return this.careerDatabase.map(career => {
      // Calculate skill match
      const skillMatches = career.skills.filter(skill => 
        userSkills.some((userSkill: string) => 
          skill.toLowerCase().includes(userSkill) || 
          userSkill.includes(skill.toLowerCase()) ||
          this.fuzzyMatch(skill.toLowerCase(), userSkill)
        )
      );
      const skillScore = skillMatches.length / career.skills.length;

      // Calculate interest match (simple keyword matching)
      const interestScore = userInterests.some((interest: string) => 
        career.title.toLowerCase().includes(interest) ||
        career.description.toLowerCase().includes(interest) ||
        career.industries.some(industry => industry.toLowerCase().includes(interest))
      ) ? 0.8 : 0.3;

      // Calculate education match
      const educationScore = this.getEducationMatch(
        career.educationRequired, 
        userProfile.preferredEducation || 'bachelor'
      );

      // Final weighted score
      const finalScore = (skillScore * 0.5) + (interestScore * 0.3) + (educationScore * 0.2);
      
      return {
        career: {
          title: career.title,
          onetCode: career.onetCode,
          description: career.description,
          averageSalary: career.averageSalary,
          jobGrowthRate: career.jobGrowthRate,
          educationRequired: career.educationRequired,
          skills: career.skills,
          industries: career.industries,
          relatedMajors: career.relatedMajors,
          workEnvironment: 'Professional environment',
          jobOutlook: career.jobGrowthRate,
          matchReasons: [
            `${Math.round(skillScore * 100)}% skills match (${skillMatches.length}/${career.skills.length} skills)`,
            `${Math.round(interestScore * 100)}% interest alignment`,
            `${Math.round(educationScore * 100)}% education compatibility`
          ],
          skillsGap: career.skills.filter(skill => !skillMatches.includes(skill)),
          standOutTips: [`Focus on ${career.title} specific skills`, 'Build relevant portfolio']
        },
        matchScore: finalScore,
        matchReasons: [
          `${Math.round(skillScore * 100)}% skills compatibility`,
          `${Math.round(interestScore * 100)}% interest alignment`
        ],
        skillsMatch: skillMatches,
        educationFit: `${Math.round(educationScore * 100)}% education compatibility`,
        standOutTips: [`Focus on ${career.title} specific skills`, 'Build relevant portfolio']
      };
    }).sort((a, b) => b.matchScore - a.matchScore);
  }

  private fuzzyMatch(str1: string, str2: string): boolean {
    return str1.includes(str2) || str2.includes(str1) || 
           (str1.length > 3 && str2.length > 3 && 
            (str1.substring(0, 4) === str2.substring(0, 4)));
  }

  private getEducationMatch(required: string, preferred: string): number {
    const educationLevels: Record<string, number> = {
      'high school': 1,
      'associate': 2,
      'bachelor': 3,
      'master': 4,
      'doctoral': 5,
      'undergraduate': 3,
      'graduate': 4
    };

    const requiredLevel = educationLevels[required.toLowerCase()] || 3;
    const preferredLevel = educationLevels[preferred.toLowerCase()] || 3;

    if (preferredLevel >= requiredLevel) return 1.0;
    if (preferredLevel === requiredLevel - 1) return 0.8;
    return 0.6;
  }

  // Public method to get all careers for dynamic skill extraction
  getAllCareers() {
    return this.careerDatabase;
  }
}

export const directCareerMatcher = new DirectCareerMatcher();