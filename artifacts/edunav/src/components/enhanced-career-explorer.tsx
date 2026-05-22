// Enhanced Career Explorer Component - Dataset Integration
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Search, MapPin, TrendingUp, DollarSign, Users, GraduationCap } from "lucide-react";
import { Separator } from "@/components/ui/separator";

interface CareerExplorationData {
  career: {
    title: string;
    description: string;
    requiredSkills: string[];
    averageSalary: number;
    growthOutlook: string;
    workEnvironment: string;
    educationRequirements: string;
    experienceLevel: string;
    industryInsights: string[];
  };
  topSchools: {
    name: string;
    location: string;
    programStrength: string;
    ranking: number;
    tuitionRange: string;
    acceptanceRate: string;
    specialties: string[];
  }[];
  relatedCareers: {
    title: string;
    similarity: number;
    transitionDifficulty: string;
  }[];
  marketData: {
    demandLevel: string;
    competitionLevel: string;
    salaryTrend: string;
    remoteFriendly: boolean;
    jobAvailability: number;
  };
}

export default function EnhancedCareerExplorer() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInterest, setSelectedInterest] = useState("");
  const [selectedCareer, setSelectedCareer] = useState("");

  // Popular interests for quick exploration
  const popularInterests = [
    "Technology", "Healthcare", "Business", "Education", "Design", 
    "Finance", "Marketing", "Engineering", "Science", "Arts"
  ];

  // Query for interest-based exploration
  const { data: interestResults, isLoading: isLoadingInterest } = useQuery({
    queryKey: ["/api/explore-interest", selectedInterest],
    enabled: !!selectedInterest,
  });

  // Query for detailed career exploration
  const { data: careerDetails, isLoading: isLoadingCareer } = useQuery<CareerExplorationData>({
    queryKey: ["/api/explore-career", selectedCareer],
    enabled: !!selectedCareer,
  });

  const handleInterestClick = (interest: string) => {
    setSelectedInterest(interest);
    setSelectedCareer(""); // Clear career selection
  };

  const handleCareerSelect = (careerTitle: string) => {
    setSelectedCareer(careerTitle);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Career Explorer
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Discover career paths using insights from 78,000+ resume analyses and comprehensive industry data
          </p>
        </div>

        {/* Search Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Explore by Interest
            </CardTitle>
            <CardDescription>
              Select an interest area to discover related careers with detailed insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-4">
              {popularInterests.map((interest) => (
                <Button
                  key={interest}
                  variant={selectedInterest === interest ? "default" : "outline"}
                  size="sm"
                  onClick={() => handleInterestClick(interest)}
                >
                  {interest}
                </Button>
              ))}
            </div>
            
            <div className="flex gap-2">
              <Input
                placeholder="Or type a custom interest..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    handleInterestClick(searchQuery.trim());
                  }
                }}
              />
              <Button 
                onClick={() => searchQuery.trim() && handleInterestClick(searchQuery.trim())}
                disabled={!searchQuery.trim()}
              >
                Explore
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Interest Results */}
        {selectedInterest && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Careers in {selectedInterest}</CardTitle>
              <CardDescription>
                Powered by AI screening data and synthetic career matching patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingInterest ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2">Loading career options...</p>
                </div>
              ) : interestResults?.careerOptions && interestResults.careerOptions.length > 0 ? (
                <div>
                  <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
                    Found {interestResults.careerOptions.length} career matches for {interestResults.interest}
                  </div>
                  <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {interestResults.careerOptions.map((match: any, index: number) => (
                      <Card 
                        key={index} 
                        className="cursor-pointer hover:shadow-lg transition-shadow"
                        onClick={() => handleCareerSelect(match.career?.title || "Untitled")}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between mb-2">
                            <CardTitle className="text-lg">{match.career?.title || "Untitled Career"}</CardTitle>
                            {match.career?.topKConfidence && (
                              <Badge variant="default" className="text-xs">
                                {match.career.topKConfidence}% match
                              </Badge>
                            )}
                          </div>
                          <div className="flex gap-2">
                            <Badge variant="secondary" className="w-fit text-xs">
                              ${match.career?.averageSalary?.toLocaleString() || '75,000'} avg
                            </Badge>
                            {match.career?.skillAlignmentScore && (
                              <Badge variant="outline" className="w-fit text-xs">
                                {match.career.skillAlignmentScore}% skills
                              </Badge>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="pt-0">
                          <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                            {match.career?.description?.substring(0, 120) || 'Professional role with growth opportunities'}...
                          </p>
                          <div className="flex flex-wrap gap-1 mb-2">
                            {(match.career?.requiredSkills || []).slice(0, 3).map((skill: string, i: number) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {skill}
                              </Badge>
                            ))}
                            {(!match.career?.requiredSkills || match.career.requiredSkills.length === 0) && (
                              <Badge variant="outline" className="text-xs">View Details</Badge>
                            )}
                          </div>
                          {match.career?.matchReasons && match.career.matchReasons.length > 0 && (
                            <div className="text-xs text-blue-600 dark:text-blue-400">
                              • {match.career.matchReasons[0]}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ) : selectedInterest ? (
                <div className="text-center py-8 text-gray-500">
                  <p>Loading career matches for "{selectedInterest}"...</p>
                  <p className="text-sm mt-2">Please wait while we process your request</p>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>Select an interest area above to explore career matches</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Detailed Career Information */}
        {selectedCareer && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-2xl">{careerDetails?.career.title}</CardTitle>
                    <CardDescription className="text-lg mt-2">
                      {careerDetails?.career.description}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="text-lg px-3 py-1">
                    <DollarSign className="h-4 w-4 mr-1" />
                    ${careerDetails?.career.averageSalary?.toLocaleString()}
                  </Badge>
                </div>
              </CardHeader>
            </Card>

            <Tabs defaultValue="overview" className="w-full">
              <TabsList className="grid w-full grid-cols-4">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="schools">Top Schools</TabsTrigger>
                <TabsTrigger value="related">Related Careers</TabsTrigger>
                <TabsTrigger value="market">Market Data</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="h-5 w-5" />
                        Requirements
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <h4 className="font-semibold mb-2">Education</h4>
                        <p className="text-sm">{careerDetails?.career.educationRequirements}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Experience Level</h4>
                        <p className="text-sm">{careerDetails?.career.experienceLevel}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Work Environment</h4>
                        <p className="text-sm">{careerDetails?.career.workEnvironment}</p>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5" />
                        Required Skills
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-2">
                        {careerDetails?.career.requiredSkills?.map((skill, index) => (
                          <Badge key={index} variant="secondary">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Industry Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold mb-2">Growth Outlook</h4>
                        <p className="text-sm">{careerDetails?.career.growthOutlook}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold mb-2">Key Insights</h4>
                        <ul className="text-sm space-y-1">
                          {careerDetails?.career.industryInsights?.map((insight, index) => (
                            <li key={index} className="flex items-start">
                              <span className="w-2 h-2 bg-blue-500 rounded-full mt-2 mr-2 flex-shrink-0"></span>
                              {insight}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="schools" className="space-y-4">
                <div className="grid gap-4">
                  {careerDetails?.topSchools?.map((school, index) => (
                    <Card key={index}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <h3 className="text-lg font-semibold">{school.name}</h3>
                            <p className="text-sm text-gray-600 dark:text-gray-300 flex items-center gap-1">
                              <MapPin className="h-4 w-4" />
                              {school.location}
                            </p>
                          </div>
                          <Badge variant="outline">
                            #{school.ranking} Ranked
                          </Badge>
                        </div>
                        
                        <div className="grid md:grid-cols-3 gap-4 text-sm">
                          <div>
                            <span className="font-semibold">Program Strength:</span>
                            <p>{school.programStrength}</p>
                          </div>
                          <div>
                            <span className="font-semibold">Tuition Range:</span>
                            <p>{school.tuitionRange}</p>
                          </div>
                          <div>
                            <span className="font-semibold">Acceptance Rate:</span>
                            <p>{school.acceptanceRate}</p>
                          </div>
                        </div>
                        
                        <Separator className="my-4" />
                        
                        <div>
                          <span className="font-semibold text-sm">Specialties:</span>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {school.specialties?.map((specialty, i) => (
                              <Badge key={i} variant="outline" className="text-xs">
                                {specialty}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="related" className="space-y-4">
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {careerDetails?.relatedCareers?.map((career, index) => (
                    <Card 
                      key={index}
                      className="cursor-pointer hover:shadow-lg transition-shadow"
                      onClick={() => handleCareerSelect(career.title)}
                    >
                      <CardContent className="pt-6">
                        <h3 className="text-lg font-semibold mb-2">{career.title}</h3>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span>Similarity:</span>
                            <Badge variant="secondary">{career.similarity}%</Badge>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span>Transition:</span>
                            <Badge 
                              variant={career.transitionDifficulty === 'Easy' ? 'default' : 'outline'}
                            >
                              {career.transitionDifficulty}
                            </Badge>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="market" className="space-y-4">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle>Market Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span>Demand Level:</span>
                        <Badge 
                          variant={careerDetails?.marketData.demandLevel === 'High' ? 'default' : 'secondary'}
                        >
                          {careerDetails?.marketData.demandLevel}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Competition:</span>
                        <Badge variant="outline">
                          {careerDetails?.marketData.competitionLevel}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Salary Trend:</span>
                        <Badge variant="secondary">
                          {careerDetails?.marketData.salaryTrend}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Remote Friendly:</span>
                        <Badge variant={careerDetails?.marketData.remoteFriendly ? 'default' : 'outline'}>
                          {careerDetails?.marketData.remoteFriendly ? 'Yes' : 'Limited'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Job Availability</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">
                          {careerDetails?.marketData.jobAvailability}%
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-300">
                          Based on recruitment data from our AI screening dataset
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </div>
    </div>
  );
}