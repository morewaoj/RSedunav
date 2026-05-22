import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, GraduationCap, DollarSign, TrendingUp, MapPin, Plus, Target, Lightbulb } from "lucide-react";
import { SavedBadge } from "@/components/saved-badge";
import { isCareerSaved, useSavedItems } from "@/hooks/use-saved-items";

interface CareerMatch {
  career: {
    title: string;
    onetCode: string;
    description: string;
    averageSalary: number;
    jobGrowthRate: string;
    educationRequired: string;
    skills: string[];
    industries: string[];
    relatedMajors: string[];
    workEnvironment: string;
    jobOutlook: string;
    matchReasons: string[];
    skillsGap: string[];
    standOutTips: string[];
  };
  matchScore: number;
  matchReasons: string[];
  skillsMatch: string[];
  educationFit: string;
  standOutTips: string[];
  recommendedColleges?: any[];
  availableScholarships?: any[];
}

interface UserInterests {
  interests: string[];
  skills: string[];
  preferredEducation: string;
  locationPreference?: string;
  salaryExpectation?: number;
  workValues?: string[];
}

export default function CareerPathsUnified() {
  const { toast } = useToast();
  const { keys: savedKeys } = useSavedItems();
  const [userInterests, setUserInterests] = useState<UserInterests>({
    interests: [],
    skills: [],
    preferredEducation: "bachelor",
    locationPreference: "all-states",
    salaryExpectation: undefined
  });
  const [selectedCareer, setSelectedCareer] = useState<any>(null);
  const [showRecommendations, setShowRecommendations] = useState(false);

  // Fetch comprehensive interests from O*NET database
  const { data: comprehensiveInterests, isLoading: interestsLoading } = useQuery({
    queryKey: ["/api/comprehensive-interests"],
    queryFn: async () => {
      const response = await fetch("/api/comprehensive-interests");
      return response.json();
    }
  });

  const availableInterests = comprehensiveInterests?.map(item => item.name) || [
    "Technology", "Healthcare", "Education", "Business", "Creative Arts",
    "Science", "Engineering", "Social Services", "Finance", "Marketing"
  ];

  // Fetch comprehensive skills from O*NET database
  const { data: comprehensiveSkills, isLoading: skillsLoading } = useQuery({
    queryKey: ["/api/comprehensive-skills"],
    queryFn: async () => {
      const response = await fetch("/api/comprehensive-skills");
      return response.json();
    }
  });

  const availableSkills = comprehensiveSkills?.map(item => item.name) || [
    "Programming", "Data Analysis", "Communication", "Leadership", "Problem Solving",
    "Critical Thinking", "Teamwork", "Customer Service", "Research", "Writing",
    "Project Management", "Mathematics", "Science", "Design", "Sales",
    "Marketing", "Teaching", "Counseling", "Mechanical", "Technical Support",
    "Public Speaking", "Time Management", "Organization", "Attention to Detail",
    "Creativity", "Innovation", "Analytical Thinking", "Decision Making",
    "Negotiation", "Conflict Resolution", "Active Listening", "Empathy",
    "Adaptability", "Flexibility", "Multi-tasking", "Computer Literacy",
    "Microsoft Office", "Database Management", "Web Development", "Mobile Development",
    "Cloud Computing", "Machine Learning", "Artificial Intelligence", "Statistics",
    "Financial Analysis", "Accounting", "Budgeting", "Strategic Planning",
    "Quality Assurance", "Testing", "Documentation", "Training", "Mentoring",
    "Supervision", "People Management", "Operations Management", "Supply Chain",
    "Logistics Coordination", "Event Planning", "Social Media", "Content Creation",
    "SEO/SEM", "Digital Marketing", "Brand Management", "Market Research",
    "Clinical Skills", "Patient Care", "Medical Knowledge", "Laboratory Skills",
    "Equipment Operation", "Safety Protocols", "Regulatory Compliance",
    "Legal Research", "Contract Review", "Case Management", "Court Procedures",
    "Construction Planning", "Blueprint Reading", "Electrical Work", "Plumbing",
    "Carpentry", "Welding", "Heavy Machinery", "Automotive Repair",
    "Diagnosis", "Maintenance", "Installation", "Troubleshooting"
  ];


  // Enhanced hybrid career matching with semantic embeddings + structured scoring
  const careerMatchingMutation = useMutation({
    mutationFn: async (interests: UserInterests) => {
      const requestData = {
        interests: interests.interests,
        skills: interests.skills,
        education: interests.preferredEducation,
        workValues: interests.workValues || [],
        timestamp: Date.now()
      };
      const response = await apiRequest("POST", "/api/hybrid-career-match", requestData);
      const data = await response.json();
      
      if (data.success && data.data?.careerOptions) {
        return data.data.careerOptions;
      }
      return data;
    },
    onSuccess: (data) => {
      setShowRecommendations(true);
      let numMatches = Array.isArray(data)
        ? data.length
        : Array.isArray(data?.careers)
        ? data.careers.length
        : 0;
      toast({
        title: "Career Matches Found",
        description: `Found ${numMatches} personalized career paths using O*NET data.`
      });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: "Failed to find career matches. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Always normalize the result to an array for mapping
  const getCareerMatches = () => {
    const raw = careerMatchingMutation.data;
    console.log('🔍 DEBUGGING CAREER MATCHES:');
    console.log('Raw API response:', raw);
    console.log('Type of raw:', typeof raw);
    console.log('Is array:', Array.isArray(raw));
    console.log('Keys in raw:', raw ? Object.keys(raw) : 'null/undefined');
    
    if (!raw) {
      console.log('❌ No raw data returned');
      return [];
    }
    
    if (Array.isArray(raw)) {
      console.log('✅ Raw is array with length:', raw.length);
      console.log('First item structure:', raw[0] ? Object.keys(raw[0]) : 'empty array');
      console.log('First item data:', raw[0]);
      
      // Additional safety check - make sure array is not empty
      if (raw.length === 0) {
        console.log('⚠️ Array exists but is empty');
        return [];
      }
      
      // Validate that items have the expected structure
      const validMatches = raw.filter(item => 
        item && 
        (item.career || item.title || item.jobTitle) &&
        typeof item === 'object'
      );
      
      console.log('✅ Valid matches found:', validMatches.length);
      return validMatches;
    }
    
    if (raw.careers && Array.isArray(raw.careers)) {
      console.log('✅ Found careers array with length:', raw.careers.length);
      return raw.careers;
    }
    
    if (raw.results && Array.isArray(raw.results)) {
      console.log('✅ Found results array with length:', raw.results.length);
      return raw.results;
    }
    
    if (raw.careerOptions && Array.isArray(raw.careerOptions)) {
      console.log('✅ Found careerOptions array with length:', raw.careerOptions.length);
      return raw.careerOptions;
    }
    
    console.log('❌ No recognized array structure found');
    console.log('Raw data keys:', raw ? Object.keys(raw) : 'null');
    return [];
  };

  const matches = getCareerMatches();
  console.log('🎯 Final processed matches:', matches);
  console.log('📊 Number of matches to display:', matches.length);

  const handleFindMatches = () => {
    if (userInterests.interests.length === 0 || userInterests.skills.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select at least one interest and one skill.",
        variant: "destructive"
      });
      return;
    }
    careerMatchingMutation.mutate(userInterests);
  };

  const handleInterestToggle = (interest: string, checked: boolean) => {
    if (checked && userInterests.interests.length < 3) {
      setUserInterests(prev => ({
        ...prev,
        interests: [...prev.interests, interest]
      }));
    } else if (!checked) {
      setUserInterests(prev => ({
        ...prev,
        interests: prev.interests.filter(i => i !== interest)
      }));
    }
  };

  const handleSkillToggle = (skill: string, checked: boolean) => {
    if (checked && userInterests.skills.length < 3) {
      setUserInterests(prev => ({
        ...prev,
        skills: [...prev.skills, skill]
      }));
    } else if (!checked) {
      setUserInterests(prev => ({
        ...prev,
        skills: prev.skills.filter(s => s !== skill)
      }));
    }
  };

  // Direct career exploration mutation
  const careerExplorationMutation = useMutation({
    mutationFn: async (interestsList: string[]) => {
      if (interestsList.length === 0) {
        throw new Error("Please select at least one interest");
      }
      
      const response = await fetch(`/api/explore-interests?interests=${interestsList.join(',')}`);
      if (!response.ok) {
        throw new Error('Failed to explore careers');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setShowRecommendations(true);
      toast({
        title: "Career Exploration Complete", 
        description: `Found ${data.careerOptions?.length || 0} careers matching your ${data.interests?.length || 0} interests`
      });
    },
    onError: (error) => {
      toast({
        title: "Exploration Failed",
        description: error.message || "Failed to explore careers",
        variant: "destructive"
      });
    }
  });

  if (showRecommendations) {
    return (
      <div className="max-w-6xl mx-auto p-3 sm:p-6">
        <div className="text-center mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">Your Career Path Matches</h1>
          <p className="text-sm sm:text-base text-gray-600 px-2">Personalized career recommendations using authentic O*NET data</p>
          <Button 
            variant="outline" 
            onClick={() => setShowRecommendations(false)}
            className="mt-4 w-full sm:w-auto"
            size="sm"
          >
            Update Preferences
          </Button>
        </div>
        
        <div className="mb-4 p-4 bg-gray-100 rounded">
          <p className="text-sm">Debug Info:</p>
          <p className="text-xs">showRecommendations: {showRecommendations.toString()}</p>
          <p className="text-xs">hasData: {(!!careerMatchingMutation.data).toString()}</p>
          <p className="text-xs">matches.length: {matches.length}</p>
          <p className="text-xs">isLoading: {careerMatchingMutation.isPending.toString()}</p>
          <pre className="text-xs max-h-40 overflow-auto">
            {JSON.stringify(careerMatchingMutation.data, null, 2)}
          </pre>
        </div>

        {careerMatchingMutation.isPending && (
          <div className="text-center p-8">
            <p className="text-gray-600">Loading career matches...</p>
          </div>
        )}

        {/* Force show debug info */}
        <div className="mb-4 p-4 bg-yellow-100 rounded border">
          <p className="font-bold text-sm">DEBUGGING DISPLAY LOGIC:</p>
          <p className="text-xs">matches.length: {matches.length}</p>
          <p className="text-xs">matches type: {typeof matches}</p>
          <p className="text-xs">matches isArray: {Array.isArray(matches).toString()}</p>
          <p className="text-xs">Raw mutation data exists: {!!careerMatchingMutation.data ? 'YES' : 'NO'}</p>
          <p className="text-xs">showRecommendations: {showRecommendations.toString()}</p>
          <p className="text-xs">isPending: {careerMatchingMutation.isPending.toString()}</p>
        </div>

        {matches.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {matches.map((match: any, index: number) => {
              const career = match.career || match;
              const isSaved = isCareerSaved(savedKeys, {
                title: career.title ?? career.jobTitle,
                onetCode: career.onetCode ?? career.jobCode,
              });
              return (
              <Card key={index} className="hover:shadow-lg transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base sm:text-lg flex-wrap">
                        <Briefcase className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
                        <span className="truncate">{career.title || career.jobTitle}</span>
                        {isSaved && <SavedBadge />}
                      </CardTitle>
                      <CardDescription className="mt-1 text-xs sm:text-sm">
                        O*NET: {career.onetCode || career.jobCode}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="text-xs flex-shrink-0 self-start">
                      {Math.round((match.matchScore || career.matchScore || 0) * 100)}% match
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 pt-0">
                  <p className="text-xs sm:text-sm text-gray-600 line-clamp-3">{career.description}</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 flex-shrink-0" />
                      <span className="truncate">{new Intl.NumberFormat('en-US', { 
                        style: 'currency', 
                        currency: 'USD',
                        maximumFractionDigits: 0,
                        notation: 'compact'
                      }).format(career.averageSalary || career.avgSalary || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 flex-shrink-0" />
                      <span className="truncate">{career.jobGrowthRate || career.growth || 'Average'}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs sm:text-sm">
                    <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 text-purple-600 flex-shrink-0" />
                    <span className="truncate">{career.educationRequired || career.recommendedDegrees?.[0] || "Bachelor's degree"}</span>
                  </div>

                  <div className="space-y-2 sm:space-y-3">
                    {match.matchReasons && match.matchReasons.length > 0 && (
                      <div>
                        <span className="text-xs sm:text-sm font-medium text-green-700">Match Reasons:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {match.matchReasons.slice(0, 2).map((reason: string, idx: number) => (
                            <Badge key={idx} variant="outline" className="text-xs">
                              {reason}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    <div>
                      <span className="text-xs sm:text-sm font-medium text-blue-700">Key Skills:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {(career.skills || career.requiredSkills || []).slice(0, 2).map((skill: string, idx: number) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {(match.recommendedColleges || career.topSchools) && (match.recommendedColleges || career.topSchools).length > 0 && (
                      <div className="hidden sm:block">
                        <span className="text-xs sm:text-sm font-medium text-purple-700">Top Schools:</span>
                        <div className="mt-1 space-y-1">
                          {(match.recommendedColleges || career.topSchools || []).slice(0, 2).map((college: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between p-2 bg-purple-50 rounded text-xs">
                              <span className="font-medium truncate">{college.name}</span>
                              <span className="text-purple-600 ml-2">{college.state}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <Dialog>
                    <DialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="w-full text-xs sm:text-sm"
                        size="sm"
                        onClick={() => setSelectedCareer(match)}
                      >
                        <Plus className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                        <span className="hidden sm:inline">View Details</span>
                        <span className="sm:hidden">Details</span>
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl w-[95vw] max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-base sm:text-lg">{selectedCareer?.career?.title}</DialogTitle>
                        <DialogDescription className="text-sm">
                          Complete career details and planning options
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex items-center gap-2">
                            <DollarSign className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="font-medium">{new Intl.NumberFormat('en-US', { 
                                style: 'currency', 
                                currency: 'USD',
                                maximumFractionDigits: 0 
                              }).format(selectedCareer?.career?.averageSalary || 0)}</p>
                              <p className="text-sm text-gray-600">Average salary</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-blue-600" />
                            <div>
                              <p className="font-medium">{selectedCareer?.career?.jobGrowthRate || 'Average'}</p>
                              <p className="text-sm text-gray-600">Job growth</p>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h4 className="font-medium mb-2">Description</h4>
                          <p className="text-sm text-gray-600">{selectedCareer?.career?.description}</p>
                        </div>

                        {selectedCareer?.matchReasons && selectedCareer.matchReasons.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Why This Matches You</h4>
                            <div className="space-y-1">
                              {selectedCareer.matchReasons.map((reason: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="text-sm">{reason}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedCareer?.career?.skills && selectedCareer.career.skills.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Required Skills</h4>
                            <div className="flex flex-wrap gap-2">
                              {selectedCareer.career.skills.map((skill: string, idx: number) => (
                                <Badge key={idx} variant="outline">{skill}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedCareer?.standOutTips && selectedCareer.standOutTips.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Tips to Stand Out</h4>
                            <div className="space-y-1">
                              {selectedCareer.standOutTips.map((tip: string, idx: number) => (
                                <div key={idx} className="flex items-center gap-2">
                                  <Lightbulb className="h-4 w-4 text-yellow-500" />
                                  <span className="text-sm">{tip}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {selectedCareer?.recommendedColleges && selectedCareer.recommendedColleges.length > 0 && (
                          <div>
                            <h4 className="font-medium mb-2">Recommended Colleges</h4>
                            <div className="space-y-2">
                              {selectedCareer.recommendedColleges.slice(0, 5).map((college: any, idx: number) => (
                                <div key={idx} className="flex items-center justify-between p-3 border rounded">
                                  <div>
                                    <p className="font-medium">{college.name}</p>
                                    <p className="text-sm text-gray-600">{college.location}</p>
                                  </div>
                                  <Badge variant="secondary">{college.match}% match</Badge>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
              );
            })}
          </div>
        ) : !careerMatchingMutation.isPending ? (
          <div className="text-center p-8">
            <p className="text-gray-600">No career matches found. Try adjusting your preferences.</p>
            <div className="mt-4 p-4 bg-red-50 rounded text-left">
              <p className="text-sm text-red-600">Debug info:</p>
              <p className="text-xs">Data exists: {!!careerMatchingMutation.data ? 'Yes' : 'No'}</p>
              <p className="text-xs">Raw data: {JSON.stringify(careerMatchingMutation.data)}</p>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-3 sm:p-6">
      <div className="text-center mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Career Path Discovery</h1>
        <p className="text-sm sm:text-base text-gray-600 px-2">Find careers that match your interests and skills using authentic O*NET data</p>
      </div>

      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Tell Us About Your Interests
            </CardTitle>
            <CardDescription>
              Select the areas that interest you most (choose multiple)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {availableInterests.map((interest) => (
                <div key={interest} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                  <Checkbox
                    id={interest}
                    checked={userInterests.interests.includes(interest)}
                    onCheckedChange={(checked) => handleInterestToggle(interest, !!checked)}
                  />
                  <Label htmlFor={interest} className="text-xs sm:text-sm cursor-pointer flex-1">{interest}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              Your Skills & Strengths
            </CardTitle>
            <CardDescription>
              Select skills you have or want to develop
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
              {availableSkills.map((skill) => (
                <div key={skill} className="flex items-center space-x-2 p-2 rounded hover:bg-gray-50">
                  <Checkbox
                    id={skill}
                    checked={userInterests.skills.includes(skill)}
                    onCheckedChange={(checked) => handleSkillToggle(skill, !!checked)}
                  />
                  <Label htmlFor={skill} className="text-xs sm:text-sm cursor-pointer flex-1">{skill}</Label>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Career Preferences
            </CardTitle>
            <CardDescription>
              Help us match you with the right opportunities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="education" className="text-xs sm:text-sm">Preferred Education Level</Label>
                <Select
                  value={userInterests.preferredEducation}
                  onValueChange={(value) => setUserInterests(prev => ({ ...prev, preferredEducation: value }))}
                >
                  <SelectTrigger className="h-10 text-xs sm:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="high-school">High School</SelectItem>
                    <SelectItem value="certificate">Certificate/Vocational</SelectItem>
                    <SelectItem value="associate">Associate Degree</SelectItem>
                    <SelectItem value="bachelor">Bachelor's Degree</SelectItem>
                    <SelectItem value="master">Master's Degree</SelectItem>
                    <SelectItem value="doctoral">Doctoral Degree</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="salary" className="text-xs sm:text-sm">Expected Salary</Label>
                <Input
                  id="salary"
                  type="number"
                  placeholder="e.g., 65000"
                  className="h-10 text-xs sm:text-sm"
                  value={userInterests.salaryExpectation || ""}
                  onChange={(e) => setUserInterests(prev => ({ 
                    ...prev, 
                    salaryExpectation: e.target.value ? parseInt(e.target.value) : undefined
                  }))}
                />
              </div>
            </div>

            <Button 
              onClick={handleFindMatches} 
              disabled={careerMatchingMutation.isPending}
              className="w-full h-12 text-sm sm:text-base"
              size="lg"
            >
              {careerMatchingMutation.isPending ? "Finding Career Matches..." : "Find My Career Path"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}