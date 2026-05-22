import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Briefcase, TrendingUp, GraduationCap, ArrowLeft, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { SavedBadge } from "@/components/saved-badge";
import { isCareerSaved, useSavedItems } from "@/hooks/use-saved-items";

interface CareerMatch {
  career: {
    title: string;
    description: string;
    averageSalary: number;
    jobGrowthRate: number;
    education: string;
    skills: string[];
    onetCode?: string | null;
  };
  score: number;
  matchReasons: string[];
}

interface CareerData {
  careers: CareerMatch[];
  analysisDate: string;
  needsAnalysis?: boolean;
}

export default function CareerRecommendations() {
  const { data: careerData, isLoading, error } = useQuery<CareerData>({
    queryKey: ["/api/profile/career-recommendations"],
  });
  const { keys: savedKeys } = useSavedItems();

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-48 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  if (error || careerData?.needsAnalysis) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Briefcase className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">No Career Analysis Found</h2>
          <p className="text-muted-foreground mb-6">
            Please analyze your resume first to get personalized career recommendations.
          </p>
          <Link href="/profile">
            <Button>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Go to Profile
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const careers = careerData?.careers || [];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Career Recommendations</h1>
          <p className="text-gray-600 mt-2">
            Based on your resume analysis on {new Date(careerData?.analysisDate).toLocaleDateString()}
          </p>
        </div>
        <Link href="/profile">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Button>
        </Link>
      </div>

      {careers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Briefcase className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Career Matches</h3>
            <p className="text-muted-foreground">
              We couldn't find career matches. Please update your profile and try again.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {careers.map((match: CareerMatch, index: number) => {
            const isSaved = isCareerSaved(savedKeys, match.career);
            return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-xl">{match.career.title}</CardTitle>
                      {isSaved && <SavedBadge />}
                    </div>
                    <CardDescription className="mt-2">
                      {match.career.description}
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {isSaved && <SavedBadge />}
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle className="h-3 w-3" />
                      Recommended
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center text-sm text-gray-600">
                      <TrendingUp className="h-4 w-4 mr-2" />
                      <span className="font-medium">Average Salary:</span>
                      <span className="ml-2">
                        ${match.career.averageSalary?.toLocaleString() || 'N/A'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <GraduationCap className="h-4 w-4 mr-2" />
                      <span className="font-medium">Education:</span>
                      <span className="ml-2">{match.career.education || "Bachelor's"}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600">
                      <Briefcase className="h-4 w-4 mr-2" />
                      <span className="font-medium">Growth Rate:</span>
                      <span className="ml-2">{match.career.jobGrowthRate || 'N/A'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {match.matchReasons && match.matchReasons.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-900 mb-2">Why this matches you:</h4>
                        <ul className="space-y-1">
                          {match.matchReasons.map((reason, i) => (
                            <li key={i} className="text-sm text-gray-600 flex items-start">
                              <CheckCircle className="h-3 w-3 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {match.career.skills && match.career.skills.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-900 mb-2">Key Skills:</h4>
                        <div className="flex flex-wrap gap-1">
                          {match.career.skills.slice(0, 5).map((skill, i) => (
                            <Badge key={i} variant="outline" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}