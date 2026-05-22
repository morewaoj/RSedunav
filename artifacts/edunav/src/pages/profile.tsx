import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trackEvent } from "@/lib/analytics";
import { 
  User, 
  GraduationCap, 
  Brain, 
  Target, 
  TrendingUp, 
  Award,
  BookOpen,
  MapPin,
  DollarSign,
  Users,
  Lightbulb,
  FileText,
  Sparkles,
  CheckCircle,
  AlertCircle,
  Star,
  Zap,
  BarChart3,
  Upload,
  Download,
  Trash2,
  Briefcase,
  Lock,
  Eye,
  EyeOff
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth.js";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";

interface UserProfile {
  id: string;
  username: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  dateOfBirth?: string;
  bio?: string;
  gpa?: number;
  state?: string;
  major?: string;
  graduationYear?: number;
  academicLevel?: 'undergraduate' | 'graduate';
  financialNeed?: 'high' | 'medium' | 'low';
  demographics?: string[];
  interests?: string[];
  personalStatement?: string;
  aiKeywords?: string[];
  aiAnalysisDate?: string;
  profileCompleteness?: number;
  profilePicture?: string;
  insights?: string[];
  resumeAnalysisResults?: any;
  resumeFileName?: string;
  resumeFileType?: string;
  resumeUploadDate?: string;
}

interface ScholarshipRecommendation {
  scholarship: {
    name: string;
    amount: number;
    type: string;
    deadline: string;
    description: string;
    provider: string;
    website: string;
  };
  matchScore: number;
  matchReasons: string[];
  eligibilityStatus: 'eligible' | 'likely-eligible' | 'check-requirements';
}

interface CareerRecommendation {
  career: {
    title: string;
    description: string;
    averageSalary: number;
    jobGrowthRate: number;
    educationRequired: string;
    skills: string[];
    industries: string[];
  };
  matchScore: number;
  matchReasons: string[];
}

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [selectedDemographics, setSelectedDemographics] = useState<string[]>([]);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [analysisResults, setAnalysisResults] = useState<any>(null);
  
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gpa, setGpa] = useState("");
  const [major, setMajor] = useState("");
  const [graduationYear, setGraduationYear] = useState("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedAcademicLevel, setSelectedAcademicLevel] = useState<string>("");
  const [selectedFinancialNeed, setSelectedFinancialNeed] = useState<string>("");
  
  // Password state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Get user profile
  const { data: profile, isLoading: profileLoading, refetch: refetchProfile } = useQuery<UserProfile>({
    queryKey: ['/api/profile'],
    enabled: !!user,
  });

  // Get unified "For You" recommendations - ALWAYS fresh, never cached
  const { data: forYouData, isLoading: forYouLoading, refetch: refetchForYou } = useQuery<{
    scholarships: any[];
    careers: any[];
    profileUsed: any;
    profileCompleteness: number;
    recommendations: { total: number; scholarshipCount: number; careerCount: number };
    tips: string[];
  }>({
    queryKey: ['/api/profile/for-you'],
    enabled: !!user,
    staleTime: 0, // Always fetch fresh data
    gcTime: 0, // Don't cache results
  });

  // Get profile analytics
  const { data: analytics } = useQuery({
    queryKey: ['/api/profile/analytics'],
    enabled: !!user,
  });

  // Profile update mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (profileData: any) => {
      const response = await apiRequest('PUT', '/api/profile', profileData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Profile updated",
        description: "Your personalized recommendations are being refreshed...",
      });
      // Invalidate all queries to get fresh data based on new profile
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile/for-you'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile/scholarship-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile/career-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile/analytics'] });
      // Force refetch to get latest saved profile data
      refetchProfile();
      refetchForYou();
    },
    onError: (error: Error) => {
      toast({
        title: "Update failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Profile picture upload mutation
  const uploadProfilePictureMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('profilePicture', file);
      
      const response = await fetch('/api/upload-profile-picture', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Profile picture updated",
        description: "Your profile picture has been successfully uploaded.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      refetchProfile();
    },
    onError: (error: Error) => {
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Resume file upload mutation
  const [, setLocation] = useLocation();

  const uploadResumeMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('resume', file);
      
      const response = await fetch('/api/upload-resume', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Upload failed');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      trackEvent("resume_upload");
      setAnalysisResults(data);
      setUploadProgress('success');
      setSelectedFile(null);
      
      const skillCount = data.analysis?.skills?.length || 0;
      const interestCount = data.analysis?.interests?.length || 0;
      
      toast({
        title: "Resume saved",
        description: `Found ${skillCount} skills and ${interestCount} interests. Check the For You tab for updated career and scholarship matches.`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile/for-you'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile/scholarship-recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/profile/career-recommendations'] });
      refetchProfile();
      refetchForYou();
    },
    onError: (error: Error) => {
      setUploadProgress('error');
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteResumeMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('DELETE', '/api/resume');
      return response.json();
    },
    onSuccess: () => {
      setAnalysisResults(null);
      setUploadProgress('idle');
      toast({
        title: "Resume removed",
        description: "Your resume has been removed from your profile.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/profile'] });
      refetchProfile();
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to remove resume",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || "");
      setLastName(profile.lastName || "");
      setEmail(profile.email || "");
      setPhone(profile.phone || "");
      setDateOfBirth(profile.dateOfBirth || "");
      setGpa(profile.gpa ? String(profile.gpa) : "");
      setMajor(profile.major || "");
      setGraduationYear(profile.graduationYear ? String(profile.graduationYear) : "");
      setSelectedState(profile.state || "");
      setSelectedAcademicLevel(profile.academicLevel || "");
      setSelectedFinancialNeed(profile.financialNeed || "");
      setSelectedDemographics(profile.demographics || []);
      setSelectedInterests(profile.interests || []);
      if (profile.resumeAnalysisResults) {
        setAnalysisResults(profile.resumeAnalysisResults);
      }
    }
  }, [profile]);

  const handleSavePassword = async () => {
    if (!newPassword) {
      toast({
        title: "Error",
        description: "Please enter a password",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword.length < 6) {
      toast({
        title: "Error",
        description: "Password must be at least 6 characters",
        variant: "destructive",
      });
      return;
    }
    
    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      });
      return;
    }
    
    setPasswordSaving(true);
    try {
      const response = await apiRequest("POST", "/api/auth/set-password", { password: newPassword });
      if (response.ok) {
        toast({
          title: "Success",
          description: "Password saved successfully! You can now log in with your username and password.",
        });
        setNewPassword("");
        setConfirmPassword("");
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.message || "Failed to save password",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to save password",
        variant: "destructive",
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleSaveProfile = () => {
    const profileData: any = {};
    if (firstName) profileData.firstName = firstName;
    if (lastName) profileData.lastName = lastName;
    if (email) profileData.email = email;
    if (phone) profileData.phone = phone;
    if (dateOfBirth) profileData.dateOfBirth = dateOfBirth;
    if (gpa) profileData.gpa = parseFloat(gpa);
    if (major) profileData.major = major;
    if (graduationYear) profileData.graduationYear = parseInt(graduationYear);
    if (selectedState) profileData.state = selectedState;
    if (selectedAcademicLevel) profileData.academicLevel = selectedAcademicLevel;
    if (selectedFinancialNeed) profileData.financialNeed = selectedFinancialNeed;
    profileData.demographics = selectedDemographics;
    profileData.interests = selectedInterests;

    updateProfileMutation.mutate(profileData);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setUploadProgress('idle');
    }
  };

  const handleUploadResume = () => {
    if (!selectedFile) {
      toast({
        title: "No file selected",
        description: "Please select a resume file to upload.",
        variant: "destructive",
      });
      return;
    }

    // Clear old analysis results immediately when starting new upload
    setAnalysisResults(null);
    setUploadProgress('uploading');
    uploadResumeMutation.mutate(selectedFile);
  };

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const availableDemographics = [
    'first-generation',
    'STEM student',
    'military/veteran',
    'international student',
    'low-income',
    'underrepresented minority',
    'women in STEM',
    'rural background',
    'non-traditional student',
    'community college transfer'
  ];

  const availableInterests = [
    'Artificial Intelligence & Machine Learning',
    'Cybersecurity',
    'Cloud Computing',
    'Software Engineering',
    'Data Analytics & Science',
    'Healthcare & Medicine',
    'Business & Finance',
    'Education & Teaching',
    'Engineering',
    'Creative Arts & Design',
    'Environmental Science',
    'Social Work',
    'Law & Legal Studies',
    'Research & Development'
  ];

  const usStates = [
    'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 'Delaware',
    'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky',
    'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
    'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico',
    'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania',
    'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont',
    'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
  ];

  if (profileLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-gray-100 mb-1 md:mb-2">Your Profile</h1>
            <p className="text-sm md:text-lg text-gray-600 dark:text-gray-300">
              Complete your profile for personalized scholarship and career recommendations
            </p>
          </div>
          {profile?.profileCompleteness !== undefined && (
            <div className="flex items-center gap-3 sm:flex-col sm:items-end">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                <span className="text-sm md:text-lg font-semibold">{profile.profileCompleteness}% Complete</span>
              </div>
              <Progress value={profile.profileCompleteness} className="w-24 md:w-32" />
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="for-you" className="space-y-6">
        <TabsList className="grid grid-cols-3 w-full gap-0.5 h-auto p-0.5">
          <TabsTrigger value="for-you" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 text-[10px] sm:text-xs min-h-[40px]" data-testid="tab-for-you">
            <Star className="h-3.5 w-3.5" />
            <span className="leading-tight">For You</span>
          </TabsTrigger>
          <TabsTrigger value="profile" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 text-[10px] sm:text-xs min-h-[40px]" data-testid="tab-profile">
            <User className="h-3.5 w-3.5" />
            <span className="leading-tight">Profile</span>
          </TabsTrigger>
          <TabsTrigger value="ai-analysis" className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-1 text-[10px] sm:text-xs min-h-[40px]" data-testid="tab-resume">
            <Brain className="h-3.5 w-3.5" />
            <span className="leading-tight">Resume</span>
          </TabsTrigger>
        </TabsList>

        {/* For You Tab - Personalized Recommendations */}
        <TabsContent value="for-you" className="space-y-6">
          {forYouLoading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Finding your personalized matches...</p>
            </div>
          ) : (
            <>
              {/* Profile Summary */}
              <Card className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-blue-100 rounded-full">
                        <Star className="h-5 w-5 text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-gray-100">Personalized For You</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Based on your {forYouData?.profileUsed?.interests?.length || 0} interests, {forYouData?.profileUsed?.demographics?.length || 0} demographics
                          {forYouData?.profileUsed?.gpa && `, ${forYouData.profileUsed.gpa} GPA`}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                      {forYouData?.recommendations?.total || 0} matches found
                    </Badge>
                  </div>
                </CardContent>
              </Card>

              {/* Tips for better matches */}
              {forYouData?.tips && forYouData.tips.length > 0 && (
                <Card className="border-amber-200 bg-amber-50 dark:bg-amber-900/20">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <Lightbulb className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-amber-800 dark:text-amber-200">Tips for better matches</h4>
                        <ul className="mt-2 space-y-1">
                          {forYouData.tips.map((tip, i) => (
                            <li key={i} className="text-sm text-amber-700 dark:text-amber-300 flex items-center gap-2">
                              <span className="text-amber-400">•</span> {tip}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Scholarships For You */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Award className="h-5 w-5 text-green-600" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Scholarships For You</h2>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {forYouData?.recommendations?.scholarshipCount || 0} matches
                  </Badge>
                </div>
                
                {forYouData?.scholarships && forYouData.scholarships.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {forYouData.scholarships.map((item, index) => (
                      <Card key={index} className="border-green-100 hover:shadow-md transition-shadow" data-testid={`scholarship-card-${index}`}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm line-clamp-2">
                              {item.scholarship?.name}
                            </h3>
                            <Badge className={`shrink-0 ml-2 ${
                              item.matchLevel === 'High' ? 'bg-green-600 text-white' :
                              item.matchLevel === 'Medium' ? 'bg-yellow-500 text-white' :
                              'bg-gray-400 text-white'
                            }`}>
                              {item.matchLevel || 'Low'} Match
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-green-700 font-medium mb-2">
                            <DollarSign className="h-4 w-4" />
                            <span>${(item.scholarship?.amount || 0).toLocaleString()}</span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                            {item.scholarship?.description}
                          </p>
                          
                          {item.matchReasons && item.matchReasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {item.matchReasons.slice(0, 2).map((reason: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs bg-green-50 text-green-700">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {item.scholarship?.deadline && (
                            <div className="flex items-center gap-2 mt-1">
                              <p className="text-xs text-gray-500">
                                Deadline: {item.scholarship.deadline}
                              </p>
                              {(() => {
                                const days = item.daysUntilDeadline;
                                if (days === null || days === undefined || days > 50) return null;
                                if (days <= 7) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 border border-red-200 text-red-700 text-[10px] font-medium">
                                      {days <= 0 ? 'Due today' : days === 1 ? '1 day left' : `${days} days left`}
                                    </span>
                                  );
                                }
                                if (days <= 30) {
                                  return (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-medium">
                                      {days} days left
                                    </span>
                                  );
                                }
                                return (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-[10px] font-medium">
                                    {Math.ceil(days / 7)} weeks left
                                  </span>
                                );
                              })()}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center">
                      <Award className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 mb-2">Add your GPA, major, or demographics in the Profile tab to see scholarship matches</p>
                      <p className="text-xs text-gray-400">You can also upload a resume to automatically fill in your profile</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Careers For You */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Briefcase className="h-5 w-5 text-purple-600" />
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Careers For You</h2>
                  <Badge variant="secondary" className="bg-purple-100 text-purple-800">
                    {forYouData?.recommendations?.careerCount || 0} matches
                  </Badge>
                </div>
                
                {forYouData?.careers && forYouData.careers.length > 0 ? (
                  <div className="grid gap-4 md:grid-cols-2">
                    {forYouData.careers.map((item, index) => (
                      <Card key={index} className="border-purple-100 hover:shadow-md transition-shadow" data-testid={`career-card-${index}`}>
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">
                              {item.career?.title}
                            </h3>
                            <Badge className={`shrink-0 ml-2 ${
                              item.matchLevel === 'High' ? 'bg-purple-600 text-white' :
                              item.matchLevel === 'Medium' ? 'bg-yellow-500 text-white' :
                              'bg-gray-400 text-white'
                            }`}>
                              {item.matchLevel || 'Low'} Match
                            </Badge>
                          </div>
                          <div className="flex items-center gap-2 text-purple-700 font-medium mb-2">
                            <DollarSign className="h-4 w-4" />
                            <span>${(item.career?.averageSalary || 0).toLocaleString()}/year</span>
                            {item.career?.jobGrowthRate && (
                              <>
                                <TrendingUp className="h-4 w-4 ml-2" />
                                <span className="text-green-600">{item.career.jobGrowthRate}% growth</span>
                              </>
                            )}
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-2 mb-3">
                            {item.career?.description}
                          </p>
                          
                          {item.matchReasons && item.matchReasons.length > 0 && (
                            <div className="flex flex-wrap gap-1 mb-2">
                              {item.matchReasons.slice(0, 2).map((reason: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs bg-purple-50 text-purple-700">
                                  {reason}
                                </Badge>
                              ))}
                            </div>
                          )}
                          {item.career?.skills && item.career.skills.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {item.career.skills.slice(0, 3).map((skill: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-xs">
                                  {skill}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="border-dashed">
                    <CardContent className="p-6 text-center">
                      <Briefcase className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-500 mb-2">Select career interests in the Profile tab or upload a resume to see career matches</p>
                      <p className="text-xs text-gray-400">Your resume skills and profile interests work together to find the best career matches</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </>
          )}
        </TabsContent>

        {/* Profile Setup Tab */}
        <TabsContent value="profile" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Academic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  Academic Information
                </CardTitle>
                <CardDescription>
                  Your academic background helps us find relevant opportunities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="firstName">First Name</Label>
                    <Input
                      id="firstName"
                      placeholder="John"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input
                      id="lastName"
                      placeholder="Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john.smith@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="phone">Phone Number</Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="(555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="dateOfBirth">Date of Birth</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => setDateOfBirth(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label htmlFor="graduationYear">Expected Graduation Year</Label>
                    <Input
                      id="graduationYear"
                      type="number"
                      min="2024"
                      max="2035"
                      placeholder="2026"
                      value={graduationYear}
                      onChange={(e) => setGraduationYear(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="gpa">GPA (0.0 - 4.0)</Label>
                  <Input
                    id="gpa"
                    type="number"
                    step="0.1"
                    min="0"
                    max="4.0"
                    value={gpa}
                    onChange={(e) => setGpa(e.target.value)}
                    placeholder="3.5"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="state">State of Residence</Label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger id="state" className="mt-1">
                      <SelectValue placeholder="Select your state" />
                    </SelectTrigger>
                    <SelectContent>
                      {usStates.map(st => (
                        <SelectItem key={st} value={st}>{st}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="major">Major/Field of Study</Label>
                  <Input
                    id="major"
                    value={major}
                    onChange={(e) => setMajor(e.target.value)}
                    placeholder="Computer Science"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="academicLevel">Academic Level</Label>
                  <Select value={selectedAcademicLevel} onValueChange={setSelectedAcademicLevel}>
                    <SelectTrigger id="academicLevel" className="mt-1">
                      <SelectValue placeholder="Select level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="undergraduate">Undergraduate</SelectItem>
                      <SelectItem value="graduate">Graduate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="financialNeed">Financial Need Level</Label>
                  <Select value={selectedFinancialNeed} onValueChange={setSelectedFinancialNeed}>
                    <SelectTrigger id="financialNeed" className="mt-1">
                      <SelectValue placeholder="Select need level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="high">High Need</SelectItem>
                      <SelectItem value="medium">Medium Need</SelectItem>
                      <SelectItem value="low">Low Need</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            {/* Personal Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Profile Picture & Demographics
                </CardTitle>
                <CardDescription>
                  Add your photo and background information for personalized matching
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Profile Picture Upload */}
                <div>
                  <Label>Profile Picture</Label>
                  <div className="mt-2 flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                      {profile?.profilePicture ? (
                        <img 
                          src={profile.profilePicture} 
                          alt="Profile" 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-8 w-8 text-gray-400" />
                      )}
                    </div>
                    <div>
                      <input
                        type="file"
                        id="profile-picture"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            // Check file size (5MB limit)
                            if (file.size > 5 * 1024 * 1024) {
                              toast({
                                title: "File too large",
                                description: "Please select an image smaller than 5MB.",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            // Check file type
                            if (!file.type.startsWith('image/')) {
                              toast({
                                title: "Invalid file type",
                                description: "Please select an image file (JPG, PNG, GIF, WebP).",
                                variant: "destructive",
                              });
                              return;
                            }
                            
                            uploadProfilePictureMutation.mutate(file);
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById('profile-picture')?.click()}
                        disabled={uploadProfilePictureMutation.isPending}
                      >
                        <Upload className={`h-4 w-4 mr-2 ${uploadProfilePictureMutation.isPending ? 'animate-spin' : ''}`} />
                        {uploadProfilePictureMutation.isPending ? 'Uploading...' : 'Upload Photo'}
                      </Button>
                      <p className="text-sm text-gray-500 mt-1">
                        JPG, PNG or GIF. Max 5MB.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Demographics (Select all that apply)</Label>
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    {availableDemographics.map(demo => (
                      <div key={demo} className="flex items-center space-x-2">
                        <Checkbox
                          id={demo}
                          checked={selectedDemographics.includes(demo)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedDemographics(prev => [...prev, demo]);
                            } else {
                              setSelectedDemographics(prev => prev.filter(d => d !== demo));
                            }
                          }}
                        />
                        <Label htmlFor={demo} className="text-sm">
                          {demo.charAt(0).toUpperCase() + demo.slice(1)}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Career Interests (Select up to 5)</Label>
                  <div className="grid grid-cols-1 gap-2 mt-2 max-h-48 overflow-y-auto">
                    {availableInterests.map(interest => (
                      <div key={interest} className="flex items-center space-x-2">
                        <Checkbox
                          id={interest}
                          checked={selectedInterests.includes(interest)}
                          onCheckedChange={(checked) => {
                            if (checked && selectedInterests.length < 5) {
                              setSelectedInterests(prev => [...prev, interest]);
                            } else if (!checked) {
                              setSelectedInterests(prev => prev.filter(i => i !== interest));
                            }
                          }}
                          disabled={!selectedInterests.includes(interest) && selectedInterests.length >= 5}
                        />
                        <Label htmlFor={interest} className="text-sm">
                          {interest}
                        </Label>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {selectedInterests.length}/5
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                Security Settings
              </CardTitle>
              <CardDescription>
                Set or update your password to enable login with username and password
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4 max-w-md">
                <div>
                  <Label htmlFor="newPassword">New Password</Label>
                  <div className="relative mt-1">
                    <Input
                      id="newPassword"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter new password (min 6 characters)"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4 text-gray-400" />
                      ) : (
                        <Eye className="h-4 w-4 text-gray-400" />
                      )}
                    </Button>
                  </div>
                </div>
                
                <div>
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="mt-1"
                  />
                </div>
                
                <Button 
                  onClick={handleSavePassword}
                  disabled={passwordSaving || !newPassword || !confirmPassword}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {passwordSaving ? "Saving..." : "Save Password"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button 
              onClick={handleSaveProfile}
              disabled={updateProfileMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {updateProfileMutation.isPending ? "Saving..." : "Save Profile"}
            </Button>
          </div>
        </TabsContent>

        {/* Resume Tab */}
        <TabsContent value="ai-analysis" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Resume
              </CardTitle>
              <CardDescription>
                Upload and save your resume for personalized career and scholarship matching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Show saved resume if exists */}
              {profile?.resumeFileName && (
                <div className="p-4 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <h3 className="font-semibold text-green-900 dark:text-green-100">Saved Resume</h3>
                  </div>
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-green-600 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-green-900 dark:text-green-100 truncate">{profile.resumeFileName}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Uploaded {profile.resumeUploadDate ? new Date(profile.resumeUploadDate).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'recently'}
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open('/api/resume/download', '_blank')}
                        className="text-green-700 border-green-300 hover:bg-green-100"
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteResumeMutation.mutate()}
                        disabled={deleteResumeMutation.isPending}
                        className="text-red-600 border-red-300 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload section */}
              <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 text-center hover:border-purple-400 transition-colors">
                <Upload className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                <Label htmlFor="resume-upload" className="cursor-pointer">
                  <span className="text-purple-600 hover:text-purple-700 font-medium">
                    {profile?.resumeFileName ? 'Click to replace resume' : 'Click to upload'}
                  </span>
                  <span className="text-gray-500 dark:text-gray-400"> or drag and drop</span>
                </Label>
                <p className="text-xs text-gray-400 mt-1">PDF, DOCX, DOC, or TXT (max 10MB)</p>
                <input
                  id="resume-upload"
                  type="file"
                  accept=".pdf,.docx,.doc,.txt"
                  onChange={handleFileChange}
                  className="hidden"
                  data-testid="input-resume-file"
                />
              </div>

              {selectedFile && (
                <div className="flex items-center gap-3 p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                  <FileText className="h-5 w-5 text-purple-600" />
                  <div className="flex-1">
                    <p className="font-medium text-purple-900 dark:text-purple-100">{selectedFile.name}</p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedFile(null);
                      setUploadProgress('idle');
                    }}
                    className="text-purple-600 hover:text-purple-800"
                  >
                    Remove
                  </Button>
                </div>
              )}

              <Button 
                onClick={handleUploadResume}
                disabled={uploadResumeMutation.isPending || !selectedFile}
                className="bg-purple-600 hover:bg-purple-700 w-full"
                data-testid="button-analyze-resume"
              >
                {uploadResumeMutation.isPending ? (
                  <>
                    <Brain className="h-4 w-4 mr-2 animate-spin" />
                    Saving & Analyzing...
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4 mr-2" />
                    {profile?.resumeFileName ? 'Replace & Analyze Resume' : 'Upload & Analyze Resume'}
                  </>
                )}
              </Button>

              {/* Extracted Keywords - compact display */}
              {profile?.aiKeywords && profile.aiKeywords.length > 0 && (
                <div className="p-4 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-purple-600" />
                      <h3 className="font-medium text-purple-900 dark:text-purple-100 text-sm">Extracted Skills & Keywords</h3>
                    </div>
                    {profile.aiAnalysisDate && (
                      <span className="text-xs text-purple-500">
                        {new Date(profile.aiAnalysisDate).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.aiKeywords.map(keyword => (
                      <Badge key={keyword} variant="secondary" className="bg-purple-100 dark:bg-purple-900/40 text-purple-800 dark:text-purple-200 text-xs">
                        {keyword}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-2">
                    These keywords are used alongside your profile to find matching careers and scholarships in the For You tab.
                  </p>
                </div>
              )}

              {/* Resume interests extracted */}
              {profile?.interests && profile.interests.length > 0 && (
                <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="h-4 w-4 text-blue-600" />
                    <h3 className="font-medium text-blue-900 dark:text-blue-100 text-sm">Your Interests</h3>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {profile.interests.map(interest => (
                      <Badge key={interest} variant="secondary" className="bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 text-xs">
                        {interest}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
