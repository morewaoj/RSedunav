import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Briefcase, DollarSign, TrendingUp, Target, Users, ArrowLeft, Search } from "lucide-react";
import { useAuth } from "@/hooks/use-auth.js";
import { SavedBadge } from "@/components/saved-badge";
import { isCareerSaved, useSavedItems } from "@/hooks/use-saved-items";
import { getQueryFn } from "@/lib/queryClient";
import {
  MatchReasonChips,
  pickMatchReasons,
} from "@/components/match-reason-chips";
import {
  MatchedOnlyEmptyHint,
  MatchedOnlyToggle,
  useMatchedOnlyFilter,
} from "@/components/matched-only-filter";

// Subset of /api/profile/career-recommendations response — we need each
// entry's title (case-insensitive) and onetCode so we can intersect with
// the on-demand match results when "Matched to me" is on, plus the
// per-entry matchReasons so cards can show the same "why this matched"
// chips the mobile app surfaces. Mirrors the mobile Careers tab.
type CareerRecsResponse = {
  careers?: Array<{
    career?: { title?: string | null; onetCode?: string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

interface Skill {
  name: string;
  careerCount: number;
  averageSalary: number;
  demandLevel: string;
  topCareers: string[];
}

interface Interest {
  name: string;
  careerCount: number;
  averageSalary: number;
  marketOutlook: string;
  topCareers: string[];
}

interface CareerResult {
  career: {
    title: string;
    description: string;
    requiredSkills: string[];
    averageSalary: number;
    growthOutlook: string;
    workEnvironment: string;
    educationRequirements: string;
    industryInsights: string[];
    topKConfidence: number;
    skillAlignmentScore: number;
    onetCode: string;
    industries: string[];
  };
  marketData: {
    demandLevel: string;
    competitionLevel: string;
    salaryTrend: string;
    remoteFriendly: boolean;
    jobAvailability: number;
  };
}

export default function SimplifiedCareerExplorer() {
  const { toast } = useToast();
  const { user } = useAuth();
  const { keys: savedKeys } = useSavedItems();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedSkills, setSelectedSkills] = useState<string[]>([]);
  const [showResults, setShowResults] = useState(false);

  // 🔍 Search state for filtering
  const [skillSearchQuery, setSkillSearchQuery] = useState("");
  const [interestSearchQuery, setInterestSearchQuery] = useState("");

  // Pull the user's saved profile-based career matches so the results view
  // can offer the same "Matched to me" filter the mobile Careers tab has.
  // Allowed to fail quietly (signed-out users get null, anything else is
  // just no chip).
  const careerRecsQ = useQuery<CareerRecsResponse | null>({
    queryKey: ["/api/profile/career-recommendations"],
    queryFn: getQueryFn<CareerRecsResponse | null>({ on401: "returnNull" }),
    enabled: !!user,
  });

  // Lookup sets keyed by both normalized title and onetCode so an on-demand
  // result matches if either side agrees with the saved recommendations.
  // Resilient to small formatting differences between the two pipelines.
  // Parallel maps keyed the same way let each rendered card pull the
  // saved-recommendation matchReasons for "why this matched" chips.
  const recommendedKeys = useMemo(() => {
    const titles = new Set<string>();
    const onetCodes = new Set<string>();
    const reasonsByTitle = new Map<string, string[]>();
    const reasonsByOnetCode = new Map<string, string[]>();
    for (const entry of careerRecsQ.data?.careers ?? []) {
      const title = entry.career?.title?.trim().toLowerCase();
      const code = entry.career?.onetCode?.trim();
      const picked = pickMatchReasons(entry.matchReasons);
      if (title) {
        titles.add(title);
        if (picked.length > 0) reasonsByTitle.set(title, picked);
      }
      if (code) {
        onetCodes.add(code);
        if (picked.length > 0) reasonsByOnetCode.set(code, picked);
      }
    }
    return { titles, onetCodes, reasonsByTitle, reasonsByOnetCode };
  }, [careerRecsQ.data]);

  const hasMatches =
    !!user && (recommendedKeys.titles.size > 0 || recommendedKeys.onetCodes.size > 0);
  const { matchedOnly, setMatchedOnly } = useMatchedOnlyFilter({ hasMatches });

  // 🚀 UPGRADED: Fetch skills from dynamic database endpoint (instead of hardcoded)
  const { data: skills = [], isLoading: skillsLoading } = useQuery<Skill[]>({
    queryKey: ["/api/dynamic-skills"],
    queryFn: async () => {
      const response = await fetch("/api/dynamic-skills");
      if (!response.ok) throw new Error('Failed to fetch dynamic skills');
      return response.json();
    }
  });

  // 🚀 UPGRADED: Fetch interests from dynamic database endpoint (instead of hardcoded)
  const { data: interests = [], isLoading: interestsLoading } = useQuery<Interest[]>({
    queryKey: ["/api/dynamic-interests"],
    queryFn: async () => {
      const response = await fetch("/api/dynamic-interests");
      if (!response.ok) throw new Error('Failed to fetch dynamic interests');
      return response.json();
    }
  });

  // Career exploration using database career matcher with ML algorithms
  // 🚀 FIXED: Added timestamp + cache clearing to prevent old results from showing
  const explorationMutation = useMutation<{ success: boolean; data: { careerOptions: CareerResult[]; totalFound: number; matchingAlgorithm: string; confidence: number } }, Error, { interests: string[]; skills: string[] }>({
    mutationFn: async ({ interests, skills }: { interests: string[]; skills: string[] }) => {
      if (interests.length === 0) {
        throw new Error("Please select at least one interest");
      }
      
      if (skills.length === 0) {
        throw new Error("Please select at least one skill");
      }
      
      // 🎯 Add timestamp to ensure fresh results (no caching)
      const timestamp = Date.now();
      
      const response = await fetch('/api/hybrid-career-match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache'
        },
        body: JSON.stringify({
          interests,
          skills,
          education: 'Bachelor\'s degree',
          experience: 'Entry level',
          workValues: [],
          timestamp
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || 'Failed to match careers from database');
      }
      return response.json();
    },
    onSuccess: (response) => {
      setShowResults(true);
      if (response.data.careerOptions.length === 0) {
        toast({
          title: "No Matches Found",
          description: "Try different skills or interests to find career matches",
          variant: "destructive"
        });
      } else {
        toast({
          title: "Career Matching Complete",
          description: `Found ${response.data.careerOptions.length} matching careers`
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Career Matching Failed",
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
    // 🔥 CRITICAL FIX: Reset mutation data BEFORE new search to prevent old results from showing
    explorationMutation.reset();
    explorationMutation.mutate({ interests: selectedInterests, skills: selectedSkills });
  };
  
  // 🔥 CRITICAL FIX: Handler to go back that CLEARS all old data
  const handleBackToSelection = () => {
    explorationMutation.reset(); // Clear old mutation data
    setShowResults(false);
  };

  // 🔍 Filter skills and interests based on search queries
  const filteredSkills = skills.filter(skill =>
    skill.name.toLowerCase().includes(skillSearchQuery.toLowerCase())
  );

  const filteredInterests = interests.filter(interest =>
    interest.name.toLowerCase().includes(interestSearchQuery.toLowerCase())
  );

  // 🔥 CRITICAL FIX: Show loading indicator when mutation is pending
  if (explorationMutation.isPending) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-center">Matching Careers...</CardTitle>
            <CardDescription className="text-center">
              Processing your profile with ML algorithms to find the best career matches
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-sm text-gray-600">
              Analyzing {selectedInterests.length} interests and {selectedSkills.length} skills
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // 🔥 CRITICAL FIX: Only show results when we have data AND not currently loading a new search
  if (showResults && explorationMutation.data && !explorationMutation.isPending) {
    const allCareerResults = explorationMutation.data.data.careerOptions;
    // Apply the optional "Matched to me" client-side filter on top of the
    // on-demand match results. We accept a hit on either the normalized
    // title or the onetCode to be resilient to small formatting differences
    // between the two pipelines (mirrors the mobile Careers tab).
    const filteredResults = matchedOnly && hasMatches
      ? allCareerResults.filter((r) => {
          const title = r.career.title?.trim().toLowerCase() ?? "";
          const code = r.career.onetCode?.trim() ?? "";
          return (
            (title.length > 0 && recommendedKeys.titles.has(title)) ||
            (code.length > 0 && recommendedKeys.onetCodes.has(code))
          );
        })
      : allCareerResults;
    const totalCount = allCareerResults.length;
    const visibleCount = filteredResults.length;
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Career Results</h1>
          <p className="text-gray-600">
            {matchedOnly && hasMatches
              ? `Showing ${visibleCount} of ${totalCount} matching careers`
              : `Found ${totalCount} matching careers`}
          </p>
          <p className="text-sm text-blue-600 mt-1">
            Confidence: {Math.round(explorationMutation.data.data.confidence)}% | Selected: {selectedInterests.join(', ')}
          </p>
          <Button 
            variant="outline" 
            onClick={handleBackToSelection}
            className="mt-4"
            data-testid="button-back-to-selection"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Selection
          </Button>
          <MatchedOnlyToggle
            hasMatches={hasMatches}
            active={matchedOnly}
            onToggle={() => setMatchedOnly((v) => !v)}
            testId="button-matched-to-me-careers"
            containerClassName="flex justify-center mt-4"
          />
        </div>

        <MatchedOnlyEmptyHint
          visible={matchedOnly && hasMatches && totalCount > 0 && visibleCount === 0}
          cardClassName="max-w-2xl mx-auto mb-6"
          contentClassName="p-4 flex items-start gap-3 text-sm text-gray-600"
        />

        {/* 🚀 NO RESULTS UI - Show helpful message when no careers match (≥60% threshold) */}
        {explorationMutation.data.data.careerOptions.length === 0 && (
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">No High-Quality Matches Found</CardTitle>
              <CardDescription className="text-center">
                We couldn't find careers that meet the 60% match threshold with your selected profile
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <p className="text-sm text-blue-900 dark:text-blue-100 mb-2">
                  <strong>Your Selection:</strong>
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Interests:</strong> {selectedInterests.join(', ')}
                </p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  <strong>Skills:</strong> {selectedSkills.join(', ')}
                </p>
              </div>
              
              <div className="space-y-2">
                <h4 className="font-medium">Try these tips:</h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-gray-600 dark:text-gray-400">
                  <li>Select more general interests (e.g., "Technology" instead of specific niches)</li>
                  <li>Choose broader skills (e.g., "Programming" instead of specific languages)</li>
                  <li>Try different combinations of interests and skills</li>
                  <li>Consider related fields you might be interested in</li>
                </ul>
              </div>

              <Button 
                onClick={handleBackToSelection}
                className="w-full"
                data-testid="button-try-different-selection"
              >
                Try Different Selection
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {filteredResults.map((result, index) => {
            const titleKey = result.career.title?.trim().toLowerCase() ?? "";
            const codeKey = result.career.onetCode?.trim() ?? "";
            const isSaved = isCareerSaved(savedKeys, result.career);
            // Pull the saved-recommendation reasons by either onetCode or
            // normalized title — same fallback logic the "Matched to me"
            // filter uses, so a card that qualifies for the filter also
            // gets chips. Cards outside the user's recommendations get
            // none and render unchanged.
            const reasonChips =
              (codeKey.length > 0 && recommendedKeys.reasonsByOnetCode.get(codeKey)) ||
              (titleKey.length > 0 && recommendedKeys.reasonsByTitle.get(titleKey)) ||
              undefined;
            return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 flex-wrap">
                  <Briefcase className="h-5 w-5" />
                  <span>{result.career.title}</span>
                  {isSaved && <SavedBadge />}
                </CardTitle>
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1">
                    <DollarSign className="h-4 w-4" />
                    <span>${result.career.averageSalary?.toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-4 w-4" />
                    <span>{result.career.growthOutlook}</span>
                  </div>
                  <Badge variant="secondary">{result.career.topKConfidence}% match</Badge>
                </div>
                <MatchReasonChips
                  reasons={reasonChips || undefined}
                  className="flex flex-wrap gap-1.5 mt-2"
                  testId="career-match-reasons"
                />
              </CardHeader>
              <CardContent>
                <p className="text-gray-700 mb-4">
                  {result.career.description}
                </p>

                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium mb-2">Required Skills</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.career.requiredSkills.slice(0, 6).map((skill, idx) => (
                        <Badge key={idx} variant="outline">{skill}</Badge>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Education</h4>
                    <p className="text-sm text-gray-600">{result.career.educationRequirements}</p>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">Industries</h4>
                    <div className="flex flex-wrap gap-2">
                      {result.career.industries.slice(0, 3).map((industry, idx) => (
                        <Badge key={idx} variant="secondary">{industry}</Badge>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2 border-t">
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Market Demand:</span>
                        <p className="font-medium">{result.marketData.demandLevel}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Remote Friendly:</span>
                        <p className="font-medium">{result.marketData.remoteFriendly ? 'Yes' : 'Limited'}</p>
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
        <h1 className="text-3xl font-bold mb-2">Career Explorer</h1>
        <p className="text-gray-600">Select your interests and skills to find matching careers using ML algorithms and real O*NET database</p>
        <p className="text-sm text-blue-600 mt-1">Powered by machine learning career matching with authentic career data</p>
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
              Choose what interests you most
            </CardDescription>
          </CardHeader>
          <CardContent>
            {interestsLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({length: 12}).map((_, i) => (
                  <div key={i} className="h-8 w-full bg-gray-200 animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <>
                {/* 🔍 Search Input for Interests */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder=""
                      value={interestSearchQuery}
                      onChange={(e) => setInterestSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-interest-search"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {filteredInterests.length} of {interests.length} interests shown
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                  {filteredInterests.slice(0, 50).map((interest, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Checkbox
                        id={`interest-${index}`}
                        checked={selectedInterests.includes(interest.name)}
                        onCheckedChange={(checked) => handleInterestToggle(interest.name, !!checked)}
                        disabled={!selectedInterests.includes(interest.name) && selectedInterests.length >= 3}
                        data-testid={`checkbox-interest-${interest.name.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                      <Label 
                        htmlFor={`interest-${index}`} 
                        className={`text-sm cursor-pointer ${
                          !selectedInterests.includes(interest.name) && selectedInterests.length >= 3 
                            ? 'text-gray-400' : ''
                        }`}
                      >
                        {interest.name}
                      </Label>
                    </div>
                  ))}
                </div>
                {filteredInterests.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No interests match your search</p>
                )}
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
              Choose skills you have or want to develop
            </CardDescription>
          </CardHeader>
          <CardContent>
            {skillsLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {Array.from({length: 12}).map((_, i) => (
                  <div key={i} className="h-8 w-full bg-gray-200 animate-pulse rounded" />
                ))}
              </div>
            ) : (
              <>
                {/* 🔍 Search Input for Skills */}
                <div className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder=""
                      value={skillSearchQuery}
                      onChange={(e) => setSkillSearchQuery(e.target.value)}
                      className="pl-10"
                      data-testid="input-skill-search"
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {filteredSkills.length} of {skills.length} skills shown
                  </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 max-h-48 overflow-y-auto">
                  {filteredSkills.slice(0, 50).map((skill, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Checkbox
                        id={`skill-${index}`}
                        checked={selectedSkills.includes(skill.name)}
                        onCheckedChange={(checked) => handleSkillToggle(skill.name, !!checked)}
                        disabled={!selectedSkills.includes(skill.name) && selectedSkills.length >= 3}
                        data-testid={`checkbox-skill-${skill.name.toLowerCase().replace(/\s+/g, '-')}`}
                      />
                      <Label 
                        htmlFor={`skill-${index}`} 
                        className={`text-sm cursor-pointer ${
                          !selectedSkills.includes(skill.name) && selectedSkills.length >= 3 
                            ? 'text-gray-400' : ''
                        }`}
                      >
                        {skill.name}
                      </Label>
                    </div>
                  ))}
                </div>
                {filteredSkills.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No skills match your search</p>
                )}
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
              ? "Matching Careers with ML..." 
              : `Match Careers with AI`
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