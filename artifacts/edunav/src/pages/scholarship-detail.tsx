import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useRoute } from 'wouter';
import { Award, Calendar, DollarSign, ExternalLink, Repeat } from 'lucide-react';

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

// Subset of /api/profile/scholarship-recommendations — we only need each
// entry's name (the recs endpoint doesn't echo a stable id, so we key by
// normalized name like the Scholarships search and tab cards do) and its
// matchReasons so the detail screen can show the same "why this matched"
// chips the list cards already render.
type ScholarshipRecsResponse = {
  recommendations?: Array<{
    scholarship?: { name?: string | null } | null;
    matchReasons?: string[] | null;
  }>;
};

interface Scholarship {
  id: number;
  name: string;
  provider?: string | null;
  type?: string | null;
  amount?: number | null;
  awardMin?: number | null;
  awardMax?: number | null;
  deadline?: string | null;
  website?: string | null;
  url?: string | null;
  description?: string | null;
  renewable?: boolean | null;
  eligibilityRequirements?: string[] | null;
  applicationRequirements?: string[] | null;
  targetDemographics?: string[] | null;
}

function formatAmount(s: Scholarship) {
  if (typeof s.amount === 'number' && s.amount > 0) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: 0,
    }).format(s.amount);
  }
  if (
    typeof s.awardMin === 'number' &&
    typeof s.awardMax === 'number' &&
    s.awardMin > 0 &&
    s.awardMax > 0
  ) {
    const fmt = (n: number) =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
      }).format(n);
    return `${fmt(s.awardMin)} – ${fmt(s.awardMax)}`;
  }
  return 'Varies';
}

export default function ScholarshipDetail() {
  const [, params] = useRoute('/scholarship/:id');
  const id = params?.id ?? '';
  const { user } = useAuth();

  const { data: scholarship, isLoading, error } = useQuery<Scholarship>({
    queryKey: ['/api/scholarships', id],
    queryFn: async () => {
      const res = await fetch(`/api/scholarships/${encodeURIComponent(id)}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error('Scholarship not found');
        throw new Error('Failed to fetch scholarship');
      }
      return (await res.json()) as Scholarship;
    },
    enabled: !!id,
  });

  // Pull the user's personalized scholarship matches so the detail header
  // can show the same "why this matched" chips the search and tab list
  // cards already render. Auth-gated; signed-out users get null and we
  // simply skip the chip row.
  const recsQ = useQuery<ScholarshipRecsResponse | null>({
    queryKey: ['/api/profile/scholarship-recommendations'],
    queryFn: getQueryFn<ScholarshipRecsResponse | null>({ on401: 'returnNull' }),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Recs don't echo a stable id, so we key by normalized name (mirrors the
  // Scholarships search page and the mobile Scholarships tab). Build the
  // lookup once per recs payload, then look up the displayed scholarship.
  const reasonsByName = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of recsQ.data?.recommendations ?? []) {
      const name = entry.scholarship?.name?.trim().toLowerCase();
      if (!name) continue;
      const reasons = pickMatchReasons(entry.matchReasons);
      if (reasons.length > 0) map.set(name, reasons);
    }
    return map;
  }, [recsQ.data]);

  const matchReasons = useMemo<string[]>(() => {
    const key = scholarship?.name?.trim().toLowerCase();
    if (!key) return [];
    return reasonsByName.get(key) ?? [];
  }, [reasonsByName, scholarship?.name]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading scholarship details...</p>
        </div>
      </div>
    );
  }

  if (error || !scholarship) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto text-center py-12">
          <Award className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">
            Scholarship Not Found
          </h2>
          <p className="text-gray-600 mb-6">
            This scholarship isn't in our index right now.
          </p>
          <Button asChild>
            <Link href="/scholarships">Back to Scholarships</Link>
          </Button>
        </div>
      </div>
    );
  }

  const eligibility = Array.isArray(scholarship.eligibilityRequirements)
    ? scholarship.eligibilityRequirements
    : [];
  const requirements = Array.isArray(scholarship.applicationRequirements)
    ? scholarship.applicationRequirements
    : [];
  const demographics = Array.isArray(scholarship.targetDemographics)
    ? scholarship.targetDemographics
    : [];
  const link = scholarship.website || scholarship.url || null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Button asChild variant="outline" className="mb-4">
            <Link href="/scholarships">← Back to Scholarships</Link>
          </Button>
          <div className="text-center">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
              {scholarship.name}
            </h1>
            {scholarship.provider && (
              <p className="text-lg text-gray-600">{scholarship.provider}</p>
            )}
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              {scholarship.type && (
                <Badge variant="outline">{scholarship.type}</Badge>
              )}
              {scholarship.renewable && (
                <Badge className="bg-emerald-100 text-emerald-800">
                  <Repeat className="h-3 w-3 mr-1" />
                  Renewable
                </Badge>
              )}
            </div>
            <MatchReasonChips
              reasons={matchReasons.length > 0 ? matchReasons : undefined}
              className="flex flex-wrap justify-center gap-1.5 mt-3"
              testId="scholarship-match-reasons"
              size="md"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <DollarSign className="h-5 w-5 text-green-600 mx-auto mb-1" />
              <div className="text-xl font-bold text-green-600">
                {formatAmount(scholarship)}
              </div>
              <div className="text-xs text-gray-600 mt-1">Award Amount</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <Calendar className="h-5 w-5 text-blue-600 mx-auto mb-1" />
              <div className="text-base font-semibold text-blue-700">
                {scholarship.deadline || 'See provider'}
              </div>
              <div className="text-xs text-gray-600 mt-1">Deadline</div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {scholarship.description && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    About this scholarship
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    {scholarship.description}
                  </p>
                </CardContent>
              </Card>
            )}

            {eligibility.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Eligibility
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    {eligibility.map((item, i) => (
                      <li key={`${item}-${i}`}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {requirements.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Application Requirements
                  </h3>
                  <ul className="list-disc pl-5 space-y-1 text-gray-700">
                    {requirements.map((item, i) => (
                      <li key={`${item}-${i}`}>{item}</li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}

            {demographics.length > 0 && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-3">
                    Who it's for
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {demographics.map((d, i) => (
                      <Badge key={`${d}-${i}`} variant="secondary">
                        {d}
                      </Badge>
                    ))}
                  </div>
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
                  kind="scholarship"
                  scholarshipId={scholarship.id}
                  scholarshipName={scholarship.name}
                  deadline={scholarship.deadline ?? null}
                  label={scholarship.name}
                />
              </CardContent>
            </Card>

            <SavedNoteSection
              kind="scholarship"
              itemId={scholarship.id}
              label={scholarship.name}
            />

            {link && (
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Apply
                  </h3>
                  <Button asChild className="w-full">
                    <a href={link} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Visit Application Page
                    </a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
