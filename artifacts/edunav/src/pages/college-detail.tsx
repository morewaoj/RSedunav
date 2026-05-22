import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, School, ExternalLink, Award, DollarSign, Users, Clock, BookOpen } from 'lucide-react';
import { Link } from 'wouter';
import { SavedNoteSection } from '@/components/saved-note-section';
import { SavedPlanButton } from '@/components/saved-plan-button';
import { useAuth } from '@/hooks/use-auth.js';
import { getQueryFn } from '@/lib/queryClient';
import {
  MatchReasonChips,
  pickMatchReasons,
} from '@/components/match-reason-chips';

// Subset of /api/profile/college-recommendations response — we only need
// each entry's college id (to find this college) and its matchReasons so
// the detail page can show the same "why this matched" chips the list
// cards on /search already render.
type CollegeRecsResponse = {
  colleges?: Array<{
    college?: { id?: number | string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

interface College {
  id: number;
  name: string;
  location: string;
  city: string;
  state: string;
  tuition: number;
  tuitionInState?: number;
  tuitionOutOfState?: number;
  acceptanceRate: number;
  graduationRate: number;
  type: string;
  rating: number;
  programs?: string[];
  website?: string;
  description?: string;
  averageSAT?: number;
  sportsPrograms?: string[];
  academicLevel?: string;
}

export default function CollegeDetail() {
  const [match, params] = useRoute('/college/:id');
  const collegeId = params?.id;
  const { user } = useAuth();

  const { data: college, isLoading, error } = useQuery<College>({
    queryKey: ['/api/colleges', collegeId],
    queryFn: async () => {
      const res = await fetch(`/api/colleges/${collegeId}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('College not found');
        throw new Error('Failed to fetch college');
      }
      return res.json();
    },
    enabled: !!collegeId,
  });

  // Pull the user's personalized college matches so we can show the same
  // "why this matched" chips the /search list cards already render. Allowed
  // to fail quietly (signed-out users get null, anything else is just no
  // chip).
  const recsQ = useQuery<CollegeRecsResponse | null>({
    queryKey: ['/api/profile/college-recommendations'],
    queryFn: getQueryFn<CollegeRecsResponse | null>({ on401: 'returnNull' }),
    enabled: !!user,
  });

  // Find this college in the recommendations payload (ids may arrive as
  // numbers from live responses or strings from cached ones, so normalize)
  // and pull its matchReasons to drive the chips.
  const matchReasons = useMemo<string[]>(() => {
    if (!collegeId) return [];
    const target = String(collegeId);
    for (const entry of recsQ.data?.colleges ?? []) {
      const id = entry.college?.id;
      if (id == null) continue;
      if (String(id) === target) {
        return pickMatchReasons(entry.matchReasons);
      }
    }
    return [];
  }, [recsQ.data, collegeId]);

  const formatTuition = (amount: number) => {
    if (amount === 0) return 'Not Available';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (rate: number) => {
    if (rate === 0) return 'N/A';
    const percentage = rate > 1 ? rate : rate * 100;
    return `${Math.round(percentage)}%`;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading college details...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !college) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <School className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">College Not Found</h2>
            <p className="text-gray-600 mb-6">The college you're looking for doesn't exist or has been removed.</p>
            <Button asChild>
              <Link href="/search">Back to Search</Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button asChild variant="outline" className="mb-4">
            <Link href="/search">← Back to Search</Link>
          </Button>
          
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-4">{college.name}</h1>
            <div className="flex items-center justify-center gap-2 text-lg text-gray-600 mb-4">
              <MapPin className="h-5 w-5" />
              <span>{college.location}</span>
              <Badge variant="outline" className="ml-2">{college.type}</Badge>
              {college.rating >= 8 && (
                <Badge className="bg-yellow-100 text-yellow-800 ml-2">⭐ Top Rated</Badge>
              )}
            </div>
            {college.description && (
              <p
                className={`text-xl text-gray-600 max-w-3xl mx-auto ${
                  matchReasons.length > 0 ? 'mb-4' : ''
                }`}
              >
                {college.description}
              </p>
            )}
            <MatchReasonChips
              reasons={matchReasons.length > 0 ? matchReasons : undefined}
              className="flex flex-wrap justify-center gap-1.5 mb-4"
              testId="college-match-reasons"
              size="md"
            />
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-blue-600 mb-1">
                {formatPercentage(college.acceptanceRate)}
              </div>
              <div className="text-sm text-gray-600">Acceptance Rate</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-green-600 mb-1">
                {formatPercentage(college.graduationRate)}
              </div>
              <div className="text-sm text-gray-600">Graduation Rate</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-purple-600 mb-1">
                {college.averageSAT || 'N/A'}
              </div>
              <div className="text-sm text-gray-600">Average SAT</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4 text-center">
              <div className="text-2xl font-bold text-orange-600 mb-1">
                {college.rating}/10
              </div>
              <div className="text-sm text-gray-600">Rating</div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Tuition & Costs */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                  <DollarSign className="h-5 w-5 mr-2" />
                  Tuition & Costs
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {formatTuition(college.tuitionInState || college.tuition)}
                    </div>
                    <div className="text-gray-600">In-State Tuition (Annual)</div>
                  </div>
                  <div>
                    <div className="text-3xl font-bold text-orange-600 mb-1">
                      {formatTuition(college.tuitionOutOfState || college.tuition * 1.5)}
                    </div>
                    <div className="text-gray-600">Out-of-State Tuition (Annual)</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Academic Programs */}
            {college.programs && college.programs.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <BookOpen className="h-5 w-5 mr-2" />
                    Academic Programs
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {college.programs.map((program, idx) => (
                      <Badge key={idx} variant="secondary">
                        {program}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sports Programs */}
            {college.sportsPrograms && college.sportsPrograms.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                    <Award className="h-5 w-5 mr-2" />
                    Sports Programs
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {college.sportsPrograms.map((sport, idx) => (
                      <Badge key={idx} variant="outline">
                        {sport}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Your saved note (if this college is in your plan) */}
            <SavedNoteSection
              kind="college"
              itemId={college.id}
              label={college.name}
            />

            {/* Quick Actions */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                <div className="space-y-3">
                  <SavedPlanButton
                    kind="college"
                    collegeId={college.id}
                    label={college.name}
                  />
                  {college.website && (
                    <Button asChild variant="outline" className="w-full">
                      <a href={college.website} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visit Website
                      </a>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* College Info */}
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">College Information</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Type:</span>
                    <span className="font-medium">{college.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Level:</span>
                    <span className="font-medium">{college.academicLevel || 'University'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">State:</span>
                    <span className="font-medium">{college.state}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">City:</span>
                    <span className="font-medium">{college.city}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}