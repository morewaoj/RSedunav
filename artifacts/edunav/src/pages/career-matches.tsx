import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { 
  Search, TrendingUp, DollarSign, GraduationCap, 
  Target, Lightbulb, MapPin, Star, CheckCircle
} from "lucide-react";
import { SavedBadge } from "@/components/saved-badge";
import { isCareerSaved, useSavedItems } from "@/hooks/use-saved-items";

interface CareerMatch {
  title: string;
  onetCode: string;
  matchScore: number;
  confidence: number;
  salary: {
    median: number;
    range: string;
  };
  education: string;
  growth: string;
  matchReasons: string[];
  skillsGap: string[];
  standOutTips: string[];
}

interface UserProfile {
  interests: string[];
  skills: string[];
  preferredEducation: string;
  gpa?: number;
  salaryExpectation?: number;
  locationPreference?: string;
  workValues?: string[];
}

export default function CareerMatches() {
  const { keys: savedKeys } = useSavedItems();
  const [userProfile, setUserProfile] = useState<UserProfile>({
    interests: [],
    skills: [],
    preferredEducation: "bachelor",
    workValues: []
  });

  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);

  const availableInterests = [
    "Information Technology", "Healthcare", "Engineering", "Business", 
    "Education", "Finance", "Science", "Art & Design", "Marketing",
    "Psychology", "Social Work", "Agriculture", "Manufacturing",
    "Construction", "Transportation", "Legal", "Government"
  ];

  const availableSkills = [
    "Programming", "Critical Thinking", "Mathematics", "Communication",
    "Problem Solving", "Leadership", "Project Management", "Data Analysis",
    "Writing", "Research", "Customer Service", "Sales", "Teaching",
    "Counseling", "Design", "Engineering Design", "Medical Knowledge",
    "Financial Analysis", "Marketing Strategy", "Public Speaking"
  ];

  const careerMatchMutation = useMutation({
    mutationFn: async (profile: UserProfile): Promise<CareerMatch[]> => {
      const response = await fetch('/api/career-paths/matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile)
      });

      if (!response.ok) {
        throw new Error('Career matching failed');
      }

      return response.json();
    }
  });

  const handleFindMatches = () => {
    const profile: UserProfile = {
      ...userProfile,
      interests: selectedInterests,
      skills: selectedSkills
    };
    careerMatchMutation.mutate(profile);
  };

  const formatSalary = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return "bg-green-600 text-white";
    if (score >= 60) return "bg-blue-600 text-white";
    if (score >= 40) return "bg-yellow-600 text-white";
    return "bg-gray-600 text-white";
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Career Matching
        </h1>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Discover your ideal career path using authentic O*NET data and machine learning algorithms.
        </p>
      </div>

      {/* User Profile Input */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Build Your Profile
          </CardTitle>
          <CardDescription>
            Tell us about your interests and skills to get personalized career recommendations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Interests Selection */}
          <div>
            <Label className="text-base font-medium">Select Your Interests (Choose up to 5)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
              {availableInterests.map((interest) => (
                <div key={interest} className="flex items-center space-x-2">
                  <Checkbox
                    id={interest}
                    checked={selectedInterests.includes(interest)}
                    onCheckedChange={(checked) => {
                      if (checked && selectedInterests.length < 5) {
                        setSelectedInterests([...selectedInterests, interest]);
                      } else if (!checked) {
                        setSelectedInterests(selectedInterests.filter(i => i !== interest));
                      }
                    }}
                    disabled={!selectedInterests.includes(interest) && selectedInterests.length >= 5}
                  />
                  <Label htmlFor={interest} className="text-sm">{interest}</Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Selected: {selectedInterests.length}/5
            </p>
          </div>

          {/* Skills Selection */}
          <div>
            <Label className="text-base font-medium">Select Your Skills (Choose up to 7)</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
              {availableSkills.map((skill) => (
                <div key={skill} className="flex items-center space-x-2">
                  <Checkbox
                    id={skill}
                    checked={selectedSkills.includes(skill)}
                    onCheckedChange={(checked) => {
                      if (checked && selectedSkills.length < 7) {
                        setSelectedSkills([...selectedSkills, skill]);
                      } else if (!checked) {
                        setSelectedSkills(selectedSkills.filter(s => s !== skill));
                      }
                    }}
                    disabled={!selectedSkills.includes(skill) && selectedSkills.length >= 7}
                  />
                  <Label htmlFor={skill} className="text-sm">{skill}</Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              Selected: {selectedSkills.length}/7
            </p>
          </div>

          {/* Education and Preferences */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="education">Preferred Education Level</Label>
              <Select value={userProfile.preferredEducation} onValueChange={(value) => 
                setUserProfile({...userProfile, preferredEducation: value})
              }>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="high school">High School</SelectItem>
                  <SelectItem value="associate">Associate Degree</SelectItem>
                  <SelectItem value="bachelor">Bachelor's Degree</SelectItem>
                  <SelectItem value="master">Master's Degree</SelectItem>
                  <SelectItem value="doctoral">Doctoral Degree</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="salary">Desired Salary (Optional)</Label>
              <Input
                id="salary"
                type="number"
                placeholder="e.g., 75000"
                value={userProfile.salaryExpectation || ""}
                onChange={(e) => setUserProfile({
                  ...userProfile, 
                  salaryExpectation: e.target.value ? parseInt(e.target.value) : undefined
                })}
              />
            </div>
          </div>

          <Button 
            onClick={handleFindMatches}
            disabled={selectedInterests.length === 0 || careerMatchMutation.isPending}
            className="w-full"
            size="lg"
          >
            <Search className="h-4 w-4 mr-2" />
            {careerMatchMutation.isPending ? "Finding Matches..." : "Find Career Matches"}
          </Button>
        </CardContent>
      </Card>

      {/* Career Match Results */}
      {careerMatchMutation.data && careerMatchMutation.data.length > 0 && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Your Career Matches</h2>
            <Badge variant="secondary" className="text-sm">
              {careerMatchMutation.data.length} matches found
            </Badge>
          </div>

          <div className="grid gap-6">
            {careerMatchMutation.data
              .filter((match) => match.title) // Filter out invalid entries
              .map((match: CareerMatch, index: number) => {
              const isSaved = isCareerSaved(savedKeys, match);
              return (
              <Card key={index} className="border-l-4 border-l-blue-500">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <CardTitle className="text-xl">{match.title}</CardTitle>
                        {isSaved && <SavedBadge />}
                        <Badge className={`${getMatchScoreColor(match.matchScore)} border-0`}>
                          {match.matchScore}% Match
                        </Badge>
                      </div>
                      <CardDescription className="text-base">
                        O*NET Code: {match.onetCode} • Confidence: {match.confidence}%
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                
                <CardContent className="space-y-6">
                  {/* Key Metrics */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="flex items-center gap-2 p-2 bg-green-50 rounded">
                      <DollarSign className="h-4 w-4 text-green-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs text-gray-600">Median Salary</div>
                        <div className="font-semibold text-green-600 text-sm">
                          {formatSalary(match.salary?.median || 0)}
                        </div>
                        <div className="text-xs text-gray-500">{match.salary?.range}</div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 p-2 bg-blue-50 rounded">
                      <TrendingUp className="h-4 w-4 text-blue-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs text-gray-600">Job Growth</div>
                        <div className="font-semibold text-blue-600 text-sm">
                          {match.growth || "Data not available"}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 p-2 bg-purple-50 rounded sm:col-span-2 lg:col-span-1">
                      <GraduationCap className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      <div className="min-w-0">
                        <div className="text-xs text-gray-600">Education</div>
                        <div className="font-semibold text-sm">{match.education || "Not specified"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Match Reasons */}
                  {match.matchReasons && match.matchReasons.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Why This Matches You
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {match.matchReasons.map((reason, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <Star className="h-3 w-3 text-yellow-500 mt-1 flex-shrink-0" />
                            {reason}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Skills to Develop */}
                  {match.skillsGap && match.skillsGap.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2">Skills to Develop</h4>
                      <div className="flex flex-wrap gap-2">
                        {match.skillsGap.slice(0, 5).map((skill, i) => (
                          <Badge key={i} variant="outline" className="text-xs">
                            {skill}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Stand Out Tips */}
                  {match.standOutTips && match.standOutTips.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Lightbulb className="h-4 w-4 text-yellow-600" />
                        How to Stand Out
                      </h4>
                      <ul className="space-y-1 text-sm">
                        {match.standOutTips.slice(0, 3).map((tip, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <span className="text-yellow-600 font-bold">•</span>
                            {tip}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                </CardContent>
              </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Error State */}
      {careerMatchMutation.isError && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="text-center text-red-600">
              <p className="font-medium">Unable to find career matches</p>
              <p className="text-sm mt-1">Please try again or adjust your selections.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results State */}
      {careerMatchMutation.data && careerMatchMutation.data.length === 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="pt-6">
            <div className="text-center text-yellow-800">
              <p className="font-medium">No career matches found</p>
              <p className="text-sm mt-1">Try broadening your interests or skills selection.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}