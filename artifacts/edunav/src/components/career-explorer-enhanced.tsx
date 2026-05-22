import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, DollarSign, TrendingUp, Target, Lightbulb, Users } from "lucide-react";
import { SavedBadge } from "@/components/saved-badge";
import { isCareerSaved, useSavedItems } from "@/hooks/use-saved-items";
// import { Skeleton } from "@/components/ui/skeleton"; // Using manual loading instead

interface ComprehensiveSkill {
  name: string;
  averageSalary: number;
  demandLevel: string;
  careerCount: number;
  topCareers: string[];
}

interface ComprehensiveInterest {
  name: string;
  averageSalary: number;
  marketOutlook: string;
  careerCount: number;
  topCareers: string[];
}

interface CareerExplorationResult {
  interests: string[];
  careerOptions: any[];
  totalFound: number;
  matchingMethod: string;
}

export default function CareerExplorerEnhanced() {
  const { toast } = useToast();
  const { keys: savedKeys } = useSavedItems();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Fetch comprehensive skills from O*NET database
  const { data: comprehensiveSkills = [], isLoading: skillsLoading } = useQuery<ComprehensiveSkill[]>({
    queryKey: ["/api/comprehensive-skills"],
    queryFn: async () => {
      const response = await fetch("/api/comprehensive-skills");
      if (!response.ok) throw new Error('Failed to fetch skills');
      return response.json();
    }
  });

  // Fetch comprehensive interests from O*NET database
  const { data: comprehensiveInterests = [], isLoading: interestsLoading } = useQuery<ComprehensiveInterest[]>({
    queryKey: ["/api/comprehensive-interests"],
    queryFn: async () => {
      const response = await fetch("/api/comprehensive-interests");
      if (!response.ok) throw new Error('Failed to fetch interests');
      return response.json();
    }
  });

  // Career exploration mutation using comprehensive O*NET data
  const explorationMutation = useMutation<CareerExplorationResult, Error, string[]>({
    mutationFn: async (interests: string[]) => {
      if (interests.length === 0) {
        throw new Error("Please select at least one interest");
      }
      
      const response = await fetch(`/api/explore-interests?interests=${interests.join(',')}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to explore careers');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setShowResults(true);
      toast({
        title: "Career Exploration Complete",
        description: `Found ${data.careerOptions.length} careers from comprehensive O*NET database`
      });
    },
    onError: (error) => {
      toast({
        title: "Exploration Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleInterestToggle = (interest: string, checked: boolean) => {
    if (checked && selectedInterests.length < 3) {
      setSelectedInterests(prev => [...prev, interest]);
    } else if (!checked) {
      setSelectedInterests(prev => prev.filter(i => i !== interest));
    }
  };

  const handleSkillToggle = (skill: string, checked: boolean) => {
    if (checked && selectedSkills.length < 3) {
      setSelectedSkills(prev => [...prev, skill]);
    } else if (!checked) {
      setSelectedSkills(prev => prev.filter(s => s !== skill));
    }
  };

  const handleExplore = () => {
    if (selectedInterests.length === 0) {
      toast({
        title: "Selection Required", 
        description: "Please select at least one interest to explore careers",
        variant: "destructive"
      });
      return;
    }
    explorationMutation.mutate(selectedInterests);
  };

  if (showResults && explorationMutation.data) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Career Exploration Results</h1>
          <p className="text-gray-600">
            Found {explorationMutation.data.careerOptions.length} careers matching: {explorationMutation.data.interests.join(', ')}
          </p>
          <Button 
            variant="outline" 
            onClick={() => setShowResults(false)}
            className="mt-4"
          >
            Explore Different Interests
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {explorationMutation.data.careerOptions.map((option, index) => {
            const isSaved = isCareerSaved(savedKeys, option?.career ?? {});
            return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <Briefcase className="h-5 w-5" />
                  <span>{option.career.title}</span>
                  {isSaved && <SavedBadge />}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    <span>${option.career.averageSalary?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    <span>{option.career.growthOutlook}</span>
                  </div>
                  <Badge variant="secondary">{option.career.topKConfidence}% match</Badge>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4 line-clamp-3">
                  {option.career.description}
                </p>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {option.career.requiredSkills?.slice(0, 6).map((skill, idx) => (
                        <Badge key={idx} variant="outline">{skill}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Education Required</h4>
                    <p className="text-sm text-gray-600">{option.career.educationRequirements}</p>
                  </div>

                  {option.career.industries && option.career.industries.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Industries</h4>
                      <div className="flex flex-wrap gap-2">
                        {option.career.industries.slice(0, 3).map((industry, idx) => (
                          <Badge key={idx} variant="secondary">{industry}</Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="pt-2 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Market Demand:</span>
                        <p className="font-medium">{option.marketData?.demandLevel || 'Moderate'}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Remote Friendly:</span>
                        <p className="font-medium">{option.marketData?.remoteFriendly ? 'Yes' : 'Limited'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Comprehensive Career Explorer</h1>
        <p className="text-gray-600">Discover careers using authentic O*NET database with 32+ comprehensive career patterns</p>
      </div>

      <div className="space-y-6">
        {/* Interests Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Your Interests
            </CardTitle>
            <CardDescription>
              Choose the fields that interest you most. Data sourced from comprehensive O*NET career database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {interestsLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({length: 12}).map((_, i) => (
                  <div key={i} className="h-10 w-full bg-gray-200 animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                  {comprehensiveInterests.map((interest, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                      <Checkbox
                        id={`interest-${index}`}
                        checked={selectedInterests.includes(interest.name)}
                        onCheckedChange={(checked) => handleInterestToggle(interest.name, !!checked)}
                        disabled={!selectedInterests.includes(interest.name) && selectedInterests.length >= 3}
                      />
                      <Label 
                        htmlFor={`interest-${index}`} 
                        className={`text-sm cursor-pointer flex-1 ${
                          !selectedInterests.includes(interest.name) && selectedInterests.length >= 3 
                            ? 'text-gray-400' : ''
                        }`}
                      >
                        <div>
                          <div className="font-medium">{interest.name}</div>
                          <div className="text-xs text-gray-500">
                            {interest.careerCount} careers • {interest.marketOutlook} outlook
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  Selected: {selectedInterests.join(', ') || 'None'}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Skills Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Your Skills
            </CardTitle>
            <CardDescription>
              Choose skills you have or want to develop. Data from comprehensive O*NET skill patterns.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {skillsLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({length: 12}).map((_, i) => (
                  <div key={i} className="h-10 w-full bg-gray-200 animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                  {comprehensiveSkills.slice(0, 30).map((skill, index) => (
                    <div key={index} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                      <Checkbox
                        id={`skill-${index}`}
                        checked={selectedSkills.includes(skill.name)}
                        onCheckedChange={(checked) => handleSkillToggle(skill.name, !!checked)}
                        disabled={!selectedSkills.includes(skill.name) && selectedSkills.length >= 3}
                      />
                      <Label 
                        htmlFor={`skill-${index}`} 
                        className={`text-sm cursor-pointer flex-1 ${
                          !selectedSkills.includes(skill.name) && selectedSkills.length >= 3 
                            ? 'text-gray-400' : ''
                        }`}
                      >
                        <div>
                          <div className="font-medium">{skill.name}</div>
                          <div className="text-xs text-gray-500">
                            ${skill.averageSalary?.toLocaleString()} avg • {skill.demandLevel} demand
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="mt-4 text-sm text-gray-600">
                  Selected: {selectedSkills.join(', ') || 'None'}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Action Button */}
        <div className="text-center">
          <Button 
            onClick={handleExplore}
            disabled={explorationMutation.isPending || selectedInterests.length === 0}
            size="lg"
            className="px-8"
          >
            {explorationMutation.isPending 
              ? "Exploring O*NET Database..." 
              : `Explore ${selectedInterests.length} Career Field${selectedInterests.length !== 1 ? 's' : ''}`
            }
          </Button>
          {selectedInterests.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">Select at least one interest to begin</p>
          )}
        </div>
      </div>
    </div>
  );
}