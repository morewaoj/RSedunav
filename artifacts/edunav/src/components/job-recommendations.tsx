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
import { Briefcase, GraduationCap, DollarSign, TrendingUp, MapPin, Plus } from "lucide-react";

interface JobRecommendation {
  jobTitle: string;
  jobCode: string;
  description: string;
  avgSalary: number;
  growth: string;
  requiredSkills: string[];
  recommendedDegrees: string[];
  topSchools: SchoolMatch[];
  standOutTips: string[];
  careerPathway?: string[];
  outlook?: string;
}

interface SchoolMatch {
  id: number;
  name: string;
  location: string;
  program: string;
  tuition: number;
  acceptanceRate: number;
  graduationRate: number;
  ranking: number;
  matchReason: string;
}

interface UserInterests {
  interests: string[];
  skills: string[];
  preferredEducation: string;
  locationPreference?: string;
  salaryExpectation?: number;
}

export default function JobRecommendations() {
  const { toast } = useToast();
  const [userInterests, setUserInterests] = useState<UserInterests>({
    interests: [],
    skills: [],
    preferredEducation: "bachelor",
    locationPreference: "all-states",
    salaryExpectation: 50000
  });
  const [showRecommendations, setShowRecommendations] = useState(false);


  // Job recommendations mutation
  const recommendJobsMutation = useMutation({
    mutationFn: async (interests: UserInterests) => {
      const response = await apiRequest("POST", "/api/recommend-jobs", interests);
      return await response.json();
    },
    onSuccess: () => {
      setShowRecommendations(true);
      toast({
        title: "Job Recommendations Ready",
        description: "Found personalized career paths based on your interests."
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to get job recommendations. Please try again.",
        variant: "destructive"
      });
    }
  });


  const handleGetRecommendations = () => {
    if (userInterests.interests.length === 0 || userInterests.skills.length === 0) {
      toast({
        title: "Missing Information",
        description: "Please select at least one interest and one skill.",
        variant: "destructive"
      });
      return;
    }
    recommendJobsMutation.mutate(userInterests);
  };


  const toggleInterest = (interest: string) => {
    setUserInterests(prev => ({
      ...prev,
      interests: prev.interests.includes(interest)
        ? prev.interests.filter(i => i !== interest)
        : [...prev.interests, interest]
    }));
  };

  const toggleSkill = (skill: string) => {
    setUserInterests(prev => ({
      ...prev,
      skills: prev.skills.includes(skill)
        ? prev.skills.filter(s => s !== skill)
        : [...prev.skills, skill]
    }));
  };

  const interestOptions = [
    "Technology", "Healthcare", "Business", "Education", "Engineering", 
    "Creative Arts", "Science", "Legal", "Finance", "Marketing",
    "Agriculture", "Architecture", "Aviation", "Construction", "Cybersecurity",
    "Environmental Science", "Fashion", "Food Service", "Government", "Human Resources",
    "Information Technology", "Insurance", "Journalism", "Library Science", "Manufacturing",
    "Military", "Music", "Non-Profit", "Photography", "Psychology",
    "Real Estate", "Recreation", "Retail", "Social Work", "Sports",
    "Transportation", "Travel", "Veterinary", "Web Development"
  ];

  const skillOptions = [
    "Communication", "Problem Solving", "Programming", "Data Analysis", 
    "Project Management", "Leadership", "Writing", "Research", "Design", "Teaching",
    "Critical Thinking", "Mathematics", "Public Speaking", "Time Management", "Teamwork",
    "Customer Service", "Sales", "Negotiation", "Foreign Languages", "Computer Skills",
    "Creative Thinking", "Attention to Detail", "Adaptability", "Decision Making", "Conflict Resolution",
    "Financial Analysis", "Strategic Planning", "Quality Control", "Training", "Mentoring",
    "Technical Writing", "Data Visualization", "Database Management", "Network Administration", "Cybersecurity",
    "Digital Marketing", "Social Media", "Graphic Design", "Video Editing", "Photography",
    "Engineering Design", "Scientific Research", "Laboratory Skills", "Statistical Analysis", "Machine Learning"
  ];

  if (!showRecommendations) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">AI Career Recommendations</h1>
          <p className="text-gray-600">Get personalized job recommendations with top schools for your career path</p>
        </div>

        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Tell Us About Your Interests</CardTitle>
            <CardDescription>Select your interests, skills, and preferences to get personalized recommendations</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label className="text-base font-medium mb-3 block">Your Interests</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {interestOptions.map(interest => (
                  <div key={interest} className="flex items-center space-x-2">
                    <Checkbox
                      id={interest}
                      checked={userInterests.interests.includes(interest)}
                      onCheckedChange={() => toggleInterest(interest)}
                    />
                    <Label htmlFor={interest}>{interest}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <Label className="text-base font-medium mb-3 block">Your Skills</Label>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                {skillOptions.map(skill => (
                  <div key={skill} className="flex items-center space-x-2">
                    <Checkbox
                      id={skill}
                      checked={userInterests.skills.includes(skill)}
                      onCheckedChange={() => toggleSkill(skill)}
                    />
                    <Label htmlFor={skill}>{skill}</Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="education">Preferred Education Level</Label>
                <Select value={userInterests.preferredEducation} onValueChange={(value) => 
                  setUserInterests(prev => ({ ...prev, preferredEducation: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="highschool">High School</SelectItem>
                    <SelectItem value="associate">Associate Degree</SelectItem>
                    <SelectItem value="bachelor">Bachelor's Degree</SelectItem>
                    <SelectItem value="master">Master's Degree</SelectItem>
                    <SelectItem value="doctorate">Doctorate</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="location">Preferred State</Label>
                <Select value={userInterests.locationPreference || "all-states"} onValueChange={(value) => 
                  setUserInterests(prev => ({ ...prev, locationPreference: value }))
                }>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all-states">All States</SelectItem>
                    <SelectItem value="CA">California</SelectItem>
                    <SelectItem value="TX">Texas</SelectItem>
                    <SelectItem value="NY">New York</SelectItem>
                    <SelectItem value="FL">Florida</SelectItem>
                    <SelectItem value="GA">Georgia</SelectItem>
                    <SelectItem value="PA">Pennsylvania</SelectItem>
                    <SelectItem value="IL">Illinois</SelectItem>
                    <SelectItem value="OH">Ohio</SelectItem>
                    <SelectItem value="NC">North Carolina</SelectItem>
                    <SelectItem value="MI">Michigan</SelectItem>
                    <SelectItem value="VA">Virginia</SelectItem>
                    <SelectItem value="WA">Washington</SelectItem>
                    <SelectItem value="AZ">Arizona</SelectItem>
                    <SelectItem value="MA">Massachusetts</SelectItem>
                    <SelectItem value="TN">Tennessee</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="salary">Expected Salary</Label>
                <Input
                  id="salary"
                  type="number"
                  placeholder="e.g., 50000"
                  value={userInterests.salaryExpectation || ""}
                  onChange={(e) => setUserInterests(prev => ({ 
                    ...prev, 
                    salaryExpectation: parseInt(e.target.value) || undefined
                  }))}
                />
              </div>
            </div>

            <Button 
              onClick={handleGetRecommendations} 
              disabled={recommendJobsMutation.isPending}
              className="w-full"
            >
              {recommendJobsMutation.isPending ? "Getting Recommendations..." : "Get Job Recommendations"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Your Career Recommendations</h1>
        <p className="text-gray-600">Personalized job matches based on machine learning analysis</p>
        <Button 
          variant="outline" 
          onClick={() => setShowRecommendations(false)}
          className="mt-4"
        >
          Update Preferences
        </Button>
      </div>

      {recommendJobsMutation.data && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {(recommendJobsMutation.data as JobRecommendation[])?.map((job: JobRecommendation, index: number) => (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Briefcase className="h-5 w-5" />
                      {job.jobTitle}
                    </CardTitle>
                    <CardDescription className="mt-2">{job.description}</CardDescription>
                  </div>
                  <Badge variant="secondary">Recommended</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-green-600" />
                    <span>${job.avgSalary.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-blue-600" />
                    <span>{job.growth}</span>
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Required Skills</Label>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {job.requiredSkills.slice(0, 4).map((skill, i) => (
                      <Badge key={i} variant="outline" className="text-xs">{skill}</Badge>
                    ))}
                  </div>
                </div>

                <div>
                  <Label className="text-sm font-medium">Top Schools ({job.topSchools.length})</Label>
                  <div className="mt-2 space-y-2">
                    {job.topSchools.slice(0, 2).map((school, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="font-medium">{school.name}</span>
                        <span className="text-gray-600">${school.tuition.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="flex-1">
                        <GraduationCap className="h-4 w-4 mr-2" />
                        View Schools
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Best Schools for {job.jobTitle}</DialogTitle>
                        <DialogDescription>Top-ranked institutions for your career path</DialogDescription>
                      </DialogHeader>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        {job.topSchools.map((school, i) => (
                          <Card key={i}>
                            <CardContent className="p-4">
                              <div className="flex justify-between items-start mb-2">
                                <h4 className="font-medium">{school.name}</h4>
                                <Badge>#{school.ranking}</Badge>
                              </div>
                              <p className="text-sm text-gray-600 mb-2">{school.location}</p>
                              <p className="text-sm mb-2"><strong>Program:</strong> {school.program}</p>
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <span>Tuition: ${school.tuition.toLocaleString()}</span>
                                <span>Accept Rate: {school.acceptanceRate}%</span>
                              </div>
                              <p className="text-xs text-gray-600 mt-2">{school.matchReason}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>

                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}