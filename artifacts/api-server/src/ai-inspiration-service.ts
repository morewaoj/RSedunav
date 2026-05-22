import Anthropic from '@anthropic-ai/sdk';

// the newest Anthropic model is "claude-sonnet-4-20250514" which was released May 14, 2025. Use this by default unless user has already selected claude-3-7-sonnet-20250219
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface CareerInspiration {
  careerTitle: string;
  description: string;
  whyExciting: string;
  dailyLife: string;
  futureOpportunities: string;
  inspiringFact: string;
  pathToStart: string;
  salaryRange: string;
  relatedFields: string[];
}

export class AIInspirationService {
  async generateCareerInspiration(
    interests?: string[],
    skills?: string[],
    personalityTraits?: string[]
  ): Promise<CareerInspiration[]> {
    try {
      const prompt = this.buildInspirationPrompt(interests, skills, personalityTraits);
      
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
      });

      const textBlock = response.content.find(block => block.type === 'text');
      const content = textBlock ? (textBlock as any).text : '';
      return this.parseCareerInspirations(content);
    } catch (error) {
      console.error('AI inspiration generation error:', error);
      throw new Error('Failed to generate career inspiration');
    }
  }

  private buildInspirationPrompt(
    interests?: string[],
    skills?: string[],
    personalityTraits?: string[]
  ): string {
    const userContext = this.buildUserContext(interests, skills, personalityTraits);
    
    return `You are a career inspiration expert. Generate 3 exciting and diverse career recommendations that will inspire someone to explore new possibilities.

${userContext}

For each career, provide:
1. Career Title
2. Description (2-3 sentences about what they do)
3. Why Exciting (what makes this career thrilling and meaningful)
4. Daily Life (what a typical day looks like)
5. Future Opportunities (growth potential and emerging trends)
6. Inspiring Fact (a fascinating statistic or story)
7. Path to Start (3-4 practical first steps)
8. Salary Range (realistic expectations)
9. Related Fields (3-4 connected career areas)

Focus on:
- Emerging and future-focused careers
- Careers that make a real impact
- Diverse industries and work styles
- Realistic but inspiring opportunities

Format your response as valid JSON with this structure:
{
  "careers": [
    {
      "careerTitle": "Career Name",
      "description": "Brief description...",
      "whyExciting": "What makes it thrilling...",
      "dailyLife": "Typical day activities...",
      "futureOpportunities": "Growth and trends...",
      "inspiringFact": "Fascinating fact...",
      "pathToStart": "Step 1: ... Step 2: ... Step 3: ...",
      "salaryRange": "$X - $Y annually",
      "relatedFields": ["Field1", "Field2", "Field3", "Field4"]
    }
  ]
}`;
  }

  private buildUserContext(
    interests?: string[],
    skills?: string[],
    personalityTraits?: string[]
  ): string {
    let context = "Generate inspiring career recommendations";
    
    if (interests && interests.length > 0) {
      context += ` for someone interested in: ${interests.join(', ')}`;
    }
    
    if (skills && skills.length > 0) {
      context += ` with skills in: ${skills.join(', ')}`;
    }
    
    if (personalityTraits && personalityTraits.length > 0) {
      context += ` who is: ${personalityTraits.join(', ')}`;
    }
    
    if (!interests && !skills && !personalityTraits) {
      context = "Generate 3 diverse and inspiring career recommendations that showcase exciting opportunities across different industries and work styles.";
    }
    
    return context + ".";
  }

  private parseCareerInspirations(content: string): CareerInspiration[] {
    try {
      const parsed = JSON.parse(content);
      return parsed.careers || [];
    } catch (error) {
      console.error('Failed to parse AI response:', error);
      
      // Fallback parsing for non-JSON responses
      return this.fallbackParse(content);
    }
  }

  private fallbackParse(content: string): CareerInspiration[] {
    // Simple fallback if JSON parsing fails
    const careers: CareerInspiration[] = [];
    const sections = content.split(/\d\.\s*/).filter(section => section.trim().length > 0);
    
    sections.forEach(section => {
      const lines = section.split('\n').filter(line => line.trim().length > 0);
      if (lines.length >= 8) {
        careers.push({
          careerTitle: this.extractField(lines, 'title') || 'Exciting Career Opportunity',
          description: this.extractField(lines, 'description') || 'An innovative career path with great potential.',
          whyExciting: this.extractField(lines, 'exciting') || 'Offers meaningful impact and growth opportunities.',
          dailyLife: this.extractField(lines, 'daily') || 'Dynamic and engaging work environment.',
          futureOpportunities: this.extractField(lines, 'future') || 'Strong growth potential in emerging markets.',
          inspiringFact: this.extractField(lines, 'fact') || 'This field is rapidly evolving with new opportunities.',
          pathToStart: this.extractField(lines, 'path') || 'Start with research and skill development.',
          salaryRange: this.extractField(lines, 'salary') || '$50,000 - $80,000 annually',
          relatedFields: ['Business', 'Technology', 'Innovation', 'Leadership']
        });
      }
    });
    
    return careers.slice(0, 3); // Limit to 3 careers
  }

  private extractField(lines: string[], keyword: string): string | null {
    const line = lines.find(l => l.toLowerCase().includes(keyword));
    return line ? line.split(':').slice(1).join(':').trim() : null;
  }

  // Generate quick inspiration without user context
  async generateQuickInspiration(): Promise<CareerInspiration[]> {
    const inspirationThemes = [
      ['Technology', 'Innovation', 'Future'],
      ['Healthcare', 'Helping Others', 'Science'],
      ['Creative Arts', 'Design', 'Expression'],
      ['Environment', 'Sustainability', 'Impact'],
      ['Business', 'Leadership', 'Growth']
    ];
    
    const randomTheme = inspirationThemes[Math.floor(Math.random() * inspirationThemes.length)];
    return this.generateCareerInspiration(randomTheme);
  }
}

export const aiInspirationService = new AIInspirationService();