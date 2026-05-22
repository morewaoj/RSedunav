import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, ExternalLink, Calendar, ArrowLeft, Award, CheckCircle, Clock, AlertTriangle } from "lucide-react";
import { Link } from "wouter";
import { SavedBadge } from "@/components/saved-badge";
import { isScholarshipSaved, useSavedItems } from "@/hooks/use-saved-items";

interface ScholarshipMatch {
  scholarship: {
    id?: number | string;
    name: string;
    amount: number;
    type: string;
    provider: string;
    deadline: string;
    description: string;
    website: string;
  };
  score: number;
  matchScore: number;
  matchReasons: string[];
  daysUntilDeadline: number | null;
  eligibilityStatus: 'eligible' | 'likely-eligible' | 'check-requirements';
}

function DeadlineCountdown({ deadline, daysUntil }: { deadline: string; daysUntil: number | null }) {
  if (daysUntil === null || daysUntil === undefined) return null;
  if (daysUntil > 50) return null;

  if (daysUntil <= 7) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
        <AlertTriangle className="h-3 w-3" />
        {daysUntil <= 0 ? 'Due today' : daysUntil === 1 ? '1 day left' : `${daysUntil} days left`}
      </div>
    );
  }

  if (daysUntil <= 30) {
    return (
      <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-xs font-medium">
        <Clock className="h-3 w-3" />
        {daysUntil} days left
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium">
      <Calendar className="h-3 w-3" />
      {Math.ceil(daysUntil / 7)} weeks left
    </div>
  );
}

export default function ScholarshipMatches() {
  const { data: scholarshipData, isLoading, error } = useQuery({
    queryKey: ["/api/profile/scholarship-matches"],
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

  if (error || scholarshipData?.needsAnalysis) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center py-12">
          <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">No Scholarship Analysis Found</h2>
          <p className="text-muted-foreground mb-6">
            Please analyze your resume first to get personalized scholarship recommendations.
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

  const scholarships = scholarshipData?.scholarships || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'likely-eligible':
        return <Badge className="bg-green-100 text-green-800">Likely Eligible</Badge>;
      case 'eligible':
        return <Badge className="bg-green-100 text-green-800">Eligible</Badge>;
      default:
        return <Badge variant="outline">Check Requirements</Badge>;
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Scholarship Matches</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Based on your profile analysis on {new Date(scholarshipData?.analysisDate).toLocaleDateString()}
          </p>
        </div>
        <Link href="/profile">
          <Button variant="outline">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Profile
          </Button>
        </Link>
      </div>

      {scholarships.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Scholarship Matches</h3>
            <p className="text-muted-foreground">
              We couldn't find scholarship matches. Please update your profile and try again.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {scholarships.map((match: ScholarshipMatch, index: number) => {
            const isSaved = isScholarshipSaved(savedKeys, match.scholarship);
            return (
            <Card key={index} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 flex-wrap">
                      <CardTitle className="text-xl">{match.scholarship.name}</CardTitle>
                      {isSaved && <SavedBadge />}
                      <DeadlineCountdown deadline={match.scholarship.deadline} daysUntil={match.daysUntilDeadline} />
                    </div>
                    <CardDescription className="mt-2">
                      {match.scholarship.description}
                    </CardDescription>
                  </div>
                  {getStatusBadge(match.eligibilityStatus)}
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <DollarSign className="h-4 w-4 mr-2" />
                      <span className="font-medium">Amount:</span>
                      <span className="ml-2">
                        ${match.scholarship.amount?.toLocaleString() || 'Varies'}
                      </span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Award className="h-4 w-4 mr-2" />
                      <span className="font-medium">Type:</span>
                      <span className="ml-2">{match.scholarship.type || 'Merit-based'}</span>
                    </div>
                    <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="h-4 w-4 mr-2" />
                      <span className="font-medium">Deadline:</span>
                      <span className="ml-2">{match.scholarship.deadline || 'Check website'}</span>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">Provider:</span>
                      <span className="ml-2">{match.scholarship.provider || 'Unknown'}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {match.matchReasons && match.matchReasons.length > 0 && (
                      <div>
                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100 mb-2">Why you qualify:</h4>
                        <ul className="space-y-1">
                          {match.matchReasons.map((reason, i) => (
                            <li key={i} className="text-sm text-gray-600 dark:text-gray-400 flex items-start">
                              <CheckCircle className="h-3 w-3 mr-2 mt-0.5 text-green-500 flex-shrink-0" />
                              {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {match.scholarship.website && (
                      <div className="pt-2">
                        <Button variant="outline" size="sm" asChild>
                          <a href={match.scholarship.website} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-3 w-3 mr-1" />
                            Apply Now
                          </a>
                        </Button>
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
