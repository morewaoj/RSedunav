import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useRoute } from 'wouter';
import { Briefcase, DollarSign, GraduationCap, TrendingUp, ExternalLink } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SavedNoteSection } from '@/components/saved-note-section';
import { SavedPlanButton } from '@/components/saved-plan-button';
import { useAuth } from '@/hooks/use-auth.js';
import { getQueryFn } from '@/lib/queryClient';
import {
  MatchReasonChips,
  pickMatchReasons,
} from '@/components/match-reason-chips';

// Subset of /api/profile/career-recommendations response — we need each
// entry's title (case-insensitive) and onetCode so we can find this career
// in the saved recommendations, plus the per-entry matchReasons so the
// detail page can show the same "why this matched" chips the
// /career-explorer list cards render.
type CareerRecsResponse = {
  careers?: Array<{
    career?: { title?: string | null; onetCode?: string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

interface CareerPath {
  id: number;
  title: string;
  description?: string | null;
  averageSalary?: number | null;
  jobGrowthRate?: number | null;
  educationRequired?: string | null;
  skills?: string[] | null;
  industries?: string[] | null;
  workEnvironment?: string | null;
  jobOutlook?: string | null;
  relatedMajors?: string[] | null;
  onetCode?: string | null;
}

function formatSalary(amount?: number | null) {
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    return 'N/A';
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function CareerDetail() {
  const { user } = useAuth();
  const [, params] = useRoute('/career/:id');
  const rawId = params?.id ?? '';
  const decoded = (() => {
    try {
      return decodeURIComponent(rawId);
    } catch {
      return rawId;
    }
  })();
  const isNumeric = /^\d+$/.test(decoded);

  const { data: career, isLoading, error } = useQuery<CareerPath | null>({
    queryKey: ['/api/career-paths/lookup', decoded],
    queryFn: async () => {
      if (!decoded) return null;
      if (isNumeric) {
        const direct = await fetch(`/api/career-paths/${encodeURIComponent(decoded)}`);
        if (direct.ok) return (await direct.json()) as CareerPath;
        if (direct.status !== 404) throw new Error('Failed to fetch career');
      }
      const search = await fetch(
        `/api/career-paths/search/${encodeURIComponent(decoded)}`,
      );
      if (!search.ok) throw new Error('Failed to fetch career');
      const matches = (await search.json()) as CareerPath[];
      if (!Array.isArray(matches) || matches.length === 0) return null;
      const lower = decoded.toLowerCase();
      return (
        matches.find((m) => (m?.title ?? '').toLowerCase() === lower) ??
        matches[0] ??
        null
      );
    },
    enabled: !!decoded,
  });

  // Pull the user's saved profile-based career matches so we can show the
  // same "why this matched" chips the /career-explorer list cards render.
  // Allowed to fail quietly (signed-out users get null, anything else is
  // just no chip).
  const careerRecsQ = useQuery<CareerRecsResponse | null>({
    queryKey: ['/api/profile/career-recommendations'],
    queryFn: getQueryFn<CareerRecsResponse | null>({ on401: 'returnNull' }),
    enabled: !!user,
  });

  // Find this career in the recommendations payload and pull its
  // matchReasons. Match by onetCode when available, otherwise fall back to
  // a normalized title comparison — same dual-key approach the list view
  // uses, so the two surfaces stay in sync.
  const matchReasons = useMemo<string[]>(() => {
    if (!career) return [];
    const targetTitle = career.title?.trim().toLowerCase();
    const targetCode = career.onetCode?.trim();
    for (const entry of careerRecsQ.data?.careers ?? []) {
      const entryTitle = entry.career?.title?.trim().toLowerCase();
      const entryCode = entry.career?.onetCode?.trim();
      const titleMatches = !!targetTitle && !!entryTitle && entryTitle === targetTitle;
      const codeMatches = !!targetCode && !!entryCode && entryCode === targetCode;
      if (titleMatches || codeMatches) {
        return pickMatchReasons(entry.matchReasons);
      }
    }
    return [];
  }, [careerRecsQ.data, career]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading career details...</p>
        </div>
      </div>
    );
  }

  if (error || !career) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto text-center py-12">
          <Briefcase className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Career Not Found</h2>
          <p className="text-gray-600 mb-6">
            The career you're looking for isn't in our index.
          </p>
          <Button asChild>
            <Link href="/career-explorer">Back to Career Explorer</Link>
          </Button>
        </div>
      </div>
    );
  }

  const skills = Array.isArray(career.skills) ? career.skills : [];
  const industries = Array.isArray(career.industries) ? career.industries : [];
  const majors = Array.isArray(career.relatedMajors) ? career.relatedMajors : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button asChild variant="outline" className="mb-4">
            <Link href="/career-explorer">← Back to Career Explorer</Link>
          </Button>
          <div className="text-center">
            <h1 className="text-4xl font-bold text-gray-900 mb-3">{career.title}</h1>
            {career.description && (
              <p className="text-lg text-gray-600 max-w-3xl mx-auto">
                {career.description}
              </p>
            )}
            <MatchReasonChips
              reasons={matchReasons.length > 0 ? matchReasons : undefined}
              className="flex flex-wrap justify-center gap-1.5 mt-3"
              testId="career-match-reasons"
              size="md"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-green-600">
                {formatSalary(career.averageSalary)}
              </div>
              <div className="text-xs text-gray-600 mt-1">Average Salary</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <TrendingUp className="h-5 w-5 text-blue-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-blue-600">
                {typeof career.jobGrowthRate === 'number'
                  ? `${career.jobGrowthRate}%`
                  : 'N/A'}
              </div>
              <div className="text-xs text-gray-600 mt-1">Projected Growth</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <GraduationCap className="h-5 w-5 text-purple-600 mx-auto mb-1" />
              <div className="text-sm font-semibold text-purple-700 leading-tight">
                {career.educationRequired || 'See requirements'}
              </div>
              <div className="text-xs text-gray-600 mt-2">Education</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {skills.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Key Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((s, i) => (
                      <Badge key={`${s}-${i}`} variant="secondary">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {industries.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Industries
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {industries.map((s, i) => (
                      <Badge key={`${s}-${i}`} variant="outline">
                        {s}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {career.workEnvironment && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Work Environment
                  </h3>
                  <p className="text-gray-700">{career.workEnvironment}</p>
                </CardContent>
              </Card>
            )}

            {career.jobOutlook && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    Job Outlook
                  </h3>
                  <p className="text-gray-700">{career.jobOutlook}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  My Plan
                </h3>
                <SavedPlanButton
                  kind="career"
                  careerTitle={career.title}
                  label={career.title}
                />
              </CardContent>
            </Card>

            <SavedNoteSection
              kind="career"
              itemTitle={career.title}
              label={career.title}
            />

            {majors.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Related Majors
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {majors.map((m, i) => (
                      <Badge key={`${m}-${i}`} variant="secondary">
                        {m}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Explore More
                </h3>
                <Button asChild className="w-full">
                  <Link href="/job-market">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    View Job Market
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
