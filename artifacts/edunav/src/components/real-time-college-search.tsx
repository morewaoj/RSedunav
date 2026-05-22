import { useMemo, useState } from 'react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { debounce } from '@/lib/debounce';
import { getQueryFn } from '@/lib/queryClient';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Search, 
  MapPin, 
  School, 
  BookOpen, 
  ExternalLink,
  Loader2,
  Heart,
  Star
} from 'lucide-react';
import { Link } from 'wouter';
import Navbar from '@/components/navbar';
import { useLikedColleges } from '@/hooks/use-liked-colleges';
import { useAuth } from '@/hooks/use-auth.js';
import { SavedBadge } from '@/components/saved-badge';
import { isCollegeSaved, useSavedItems } from '@/hooks/use-saved-items';
import {
  MatchReasonChips,
  pickMatchReasons,
} from '@/components/match-reason-chips';
import {
  MatchedOnlyEmptyHint,
  MatchedOnlyToggle,
  useMatchedOnlyFilter,
} from '@/components/matched-only-filter';

// Subset of /api/profile/college-recommendations response — we need each
// entry's college id (to intersect with search results for the "Matched to
// me" filter) plus its per-entry matchReasons so cards can show the same
// "why this matched" chips the mobile app surfaces.
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
  scholarships?: string[];
}

// Career/Major options matching backend mapping system
const careerOptions = [
  { value: 'all', label: 'All Majors/Careers' },
  { value: 'technology', label: 'Technology & Computer Science' },
  { value: 'healthcare', label: 'Healthcare & Medicine' },
  { value: 'business', label: 'Business & Finance' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'education', label: 'Education & Teaching' },
  { value: 'arts', label: 'Arts & Design' },
  { value: 'science', label: 'Science & Research' },
  { value: 'communications', label: 'Communications & Media' },
  { value: 'law', label: 'Law & Legal Studies' }
];

// All 50 US States
const stateOptions = [
  'All States', 'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 
  'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi', 
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 'New Mexico', 'New York', 
  'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 
  'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 
  'West Virginia', 'Wisconsin', 'Wyoming'
];

export default function RealTimeCollegeSearch() {
  const [query, setQuery] = useState('');
  const [selectedState, setSelectedState] = useState('All States');
  const [selectedType, setSelectedType] = useState('All Types');
  const [selectedMajor, setSelectedMajor] = useState('All Majors/Careers');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [showLikedColleges, setShowLikedColleges] = useState(false);

  // Use shared hook for liked colleges
  const { likedColleges, toggleLikedCollege, isLiked } = useLikedColleges();
  const { user } = useAuth();
  const { keys: savedKeys } = useSavedItems();

  // Pull the user's personalized college matches so we can offer the same
  // "Matched to me" filter the mobile Colleges tab has. Allowed to fail
  // quietly (signed-out users get null, anything else is just no chip).
  const recsQ = useQuery<CollegeRecsResponse | null>({
    queryKey: ['/api/profile/college-recommendations'],
    queryFn: getQueryFn<CollegeRecsResponse | null>({ on401: 'returnNull' }),
    enabled: !!user,
  });

  // Build a Set of recommended college ids and a parallel id -> reasons map
  // so each rendered card can show the same "why this matched" chips the
  // mobile app surfaces. Ids may arrive as numbers from the live backend or
  // strings from cached responses, so we normalize to strings for stable
  // lookups against the search results.
  const { recommendedIds, reasonsByCollegeId } = useMemo(() => {
    const ids = new Set<string>();
    const reasons = new Map<string, string[]>();
    for (const entry of recsQ.data?.colleges ?? []) {
      const id = entry.college?.id;
      if (id == null) continue;
      const key = String(id);
      ids.add(key);
      const picked = pickMatchReasons(entry.matchReasons);
      if (picked.length > 0) reasons.set(key, picked);
    }
    return { recommendedIds: ids, reasonsByCollegeId: reasons };
  }, [recsQ.data]);

  const hasMatches = !!user && recommendedIds.size > 0;
  const { matchedOnly, setMatchedOnly } = useMatchedOnlyFilter({ hasMatches });

  // Debounce search input - matches your backend timing
  const debouncedSetQuery = useMemo(
    () => debounce((value: string) => setDebouncedQuery(value), 250),
    []
  );

  // Update debounced query when input changes
  const handleQueryChange = (value: string) => {
    setQuery(value);
    debouncedSetQuery(value);
  };

  // Search signal detection - exactly matches your backend hasSignal logic
  const hasSignal = (debouncedQuery && debouncedQuery.trim().length >= 2) || 
                    selectedState !== 'All States' || 
                    selectedType !== 'All Types' || 
                    selectedMajor !== 'All Majors/Careers';

  // Base parameters for API request
  const baseParams = useMemo(() => ({
    q: debouncedQuery.trim() || undefined,
    state: selectedState !== 'All States' ? selectedState : undefined,
    type: selectedType !== 'All Types' ? selectedType.toLowerCase() : undefined,
    majors: selectedMajor !== 'All Majors/Careers' ? [selectedMajor] : undefined,
    sort: 'rating',
    order: 'desc',
    limit: 30,
  }), [debouncedQuery, selectedState, selectedType, selectedMajor]);

  // Connects to your actual /api/colleges/search endpoint
  const fetchCollegePage = async ({ pageParam }: { pageParam?: string }) => {
    const url = new URL('/api/colleges/search', window.location.origin);
    
    // Matches your backend searchSchema validation
    Object.entries(baseParams).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          value.forEach(v => url.searchParams.append(key, v));
        } else {
          url.searchParams.set(key, String(value));
        }
      }
    });
    
    if (pageParam) {
      url.searchParams.set('cursor', pageParam);
    }

    const response = await fetch(url.toString(), { 
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error(`Search failed: ${response.status} ${response.statusText}`);
    }
    
    return response.json() as Promise<{ 
      data: College[]; 
      pageInfo: { nextCursor: string | null; total: number } 
    }>;
  };

  // TanStack Query with real-time database connection
  const { 
    data, 
    isLoading, 
    fetchNextPage, 
    hasNextPage, 
    isFetching,
    error 
  } = useInfiniteQuery({
    queryKey: ['/api/colleges/search', baseParams],
    queryFn: fetchCollegePage,
    enabled: hasSignal, // Only fetch when user provides search criteria
    getNextPageParam: (lastPage) => lastPage.pageInfo.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
    staleTime: 5 * 60 * 1000, // 5-minute cache
    refetchOnWindowFocus: false,
  });

  // Process real database response
  const allColleges = data?.pages?.flatMap(page => page.data || []) || [];
  const totalCount = data?.pages?.[0]?.pageInfo?.total || 0;

  // Apply the optional "Matched to me" client-side filter on top of the
  // server's results. We intersect by id; if matches haven't loaded yet or
  // the user is signed out, we fall through to the unfiltered list.
  const colleges = useMemo(() => {
    if (!matchedOnly || !hasMatches) return allColleges;
    return allColleges.filter((c) => recommendedIds.has(String(c.id)));
  }, [allColleges, matchedOnly, hasMatches, recommendedIds]);
  const visibleCount = colleges.length;

  const formatTuition = (amount: number) => {
    if (amount === 0) return 'Contact School';
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

  const clearAllFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setSelectedState('All States');
    setSelectedType('All Types');
    setSelectedMajor('All Majors/Careers');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <Loader2 className="animate-spin h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Searching authentic college database...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <Navbar />
      <div className="max-w-7xl mx-auto p-4">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <School className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">College Search</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Search 8,825+ authentic US colleges with real-time database connectivity. 
            Like colleges to save them for later.
          </p>
        </div>
        
        {/* Liked Colleges Toggle */}
        <div className="flex justify-center mb-6">
          <Button
            variant={showLikedColleges ? "default" : "outline"}
            onClick={() => setShowLikedColleges(!showLikedColleges)}
            className="flex items-center gap-2"
            data-testid="button-toggle-liked-colleges"
          >
            <Heart className={`h-4 w-4 ${showLikedColleges ? "fill-current" : ""}`} />
            Saved Colleges ({likedColleges.length})
          </Button>
        </div>
        
        {/* Liked Colleges Section */}
        {showLikedColleges && (
          <div className="mb-8">
            <Card>
              <CardContent className="p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Heart className="h-5 w-5 text-red-500 fill-current" />
                  Your Saved Colleges
                </h2>
                {likedColleges.length === 0 ? (
                  <p className="text-gray-600 text-center py-4">
                    You haven't saved any colleges yet. Click the heart button on any college to save it.
                  </p>
                ) : (
                  <div className="space-y-4">
                    {likedColleges.map((college) => (
                      <div key={college.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <Link href={`/college/${college.id}`} className="font-medium text-blue-600 hover:underline">
                            {college.name}
                          </Link>
                          <p className="text-sm text-gray-600">{college.city}, {college.state}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-green-600 font-medium">{formatTuition(college.tuition || 0)}</span>
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                          >
                            <a 
                              href={college.website || `https://${college.name.toLowerCase().replace(/\s+/g, '')}.edu`}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleLikedCollege(college)}
                            className="text-red-500"
                            data-testid={`button-remove-liked-${college.id}`}
                          >
                            <Heart className="h-4 w-4 fill-current" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* College Search Interface */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* College Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  placeholder="Search colleges (min 2 chars)..."
                  value={query}
                  onChange={(e) => handleQueryChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Career/Major Filter */}
              <Select value={selectedMajor} onValueChange={setSelectedMajor}>
                <SelectTrigger>
                  <BookOpen className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Major/Career" />
                </SelectTrigger>
                <SelectContent>
                  {careerOptions.map(option => (
                    <SelectItem key={option.value} value={option.label}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* State Filter */}
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  {stateOptions.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Type Filter */}
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <School className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Select Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All Types">All Types</SelectItem>
                  <SelectItem value="Public">Public</SelectItem>
                  <SelectItem value="Private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results Info and Controls */}
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                {isFetching ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-gray-600">Loading from database...</span>
                  </div>
                ) : (
                  <p className="text-gray-600">
                    {hasSignal
                      ? matchedOnly && hasMatches
                        ? `Showing ${visibleCount.toLocaleString()} of ${totalCount.toLocaleString()} colleges`
                        : `Found ${totalCount.toLocaleString()} colleges`
                      : 'Start searching to see results'}
                  </p>
                )}
                {error && (
                  <span className="text-red-600 text-sm">
                    Database connection error. Please try again.
                  </span>
                )}
              </div>
              {hasSignal && (
                <Button
                  variant="outline"
                  onClick={clearAllFilters}
                  className="text-sm"
                >
                  Clear All Filters
                </Button>
              )}
            </div>

            {/* "Matched to me" filter chip — mirrors the just-shipped mobile
                Colleges tab. Hidden for signed-out users and any case with
                zero personalized recommendations. */}
            <MatchedOnlyToggle
              hasMatches={hasMatches}
              active={matchedOnly}
              onToggle={() => setMatchedOnly((v) => !v)}
              testId="button-matched-to-me-colleges"
              containerClassName="flex flex-wrap gap-2 mt-4"
            />
          </CardContent>
        </Card>

        {/* Welcome Message */}
        {!hasSignal && (
          <div className="text-center py-16">
            <div className="text-gray-400 mb-4">
              <School className="h-20 w-20 mx-auto mb-6 opacity-50" />
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">Start Your College Search</h3>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto mb-8">
              Connect to our live database of 5,999 authentic colleges from the US Department of Education. 
              Search by name, filter by state, or explore by career focus.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-3xl mx-auto text-left">
              <div className="bg-white/60 p-4 rounded-lg">
                <Search className="h-8 w-8 text-blue-600 mb-2" />
            <h4 className="font-semibold mb-1">Live Search</h4>
                <p className="text-sm text-gray-600">Type any college name (minimum 2 characters)</p>
              </div>
              <div className="bg-white/60 p-4 rounded-lg">
                <MapPin className="h-8 w-8 text-green-600 mb-2" />
                <h4 className="font-semibold mb-1">Location Filter</h4>
                <p className="text-sm text-gray-600">Search all 50 US states instantly</p>
              </div>
              <div className="bg-white/60 p-4 rounded-lg">
                <BookOpen className="h-8 w-8 text-purple-600 mb-2" />
                <h4 className="font-semibold mb-1">Career Focus</h4>
                <p className="text-sm text-gray-600">Filter by academic programs and majors</p>
              </div>
            </div>
          </div>
        )}

        {/* College Search Results */}
        {hasSignal && (
          <div className="space-y-6">
            <MatchedOnlyEmptyHint
              visible={matchedOnly && hasMatches && allColleges.length > 0 && colleges.length === 0}
              contentClassName="p-4 flex items-start gap-3 text-sm text-gray-600"
            />
            {colleges.map((college) => (
              <Card key={college.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2 flex-wrap">
                            <Link href={`/college/${college.id}`} className="hover:text-blue-600">
                              {college.name}
                            </Link>
                            {isCollegeSaved(savedKeys, college) && <SavedBadge />}
                          </h3>
                          <div className="flex items-center gap-2 text-gray-600 mb-3">
                            <MapPin className="h-4 w-4" />
                            <span>{college.city}, {college.state}</span>
                            <Badge variant="outline" className="capitalize">{college.type}</Badge>
                            {college.rating >= 4 && (
                              <Badge className="bg-yellow-100 text-yellow-800">
                                <Star className="h-3 w-3 mr-1" />
                                Top Rated
                              </Badge>
                            )}
                          </div>
                          <MatchReasonChips
                            reasons={reasonsByCollegeId.get(String(college.id))}
                            className="flex flex-wrap gap-1.5 mb-3"
                            testId="college-match-reasons"
                          />
                          {college.description && (
                            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{college.description}</p>
                          )}
                        </div>
                        
                        <div className="text-right ml-6">
                          <div className="text-2xl font-bold text-green-600 mb-1">
                            {formatTuition(college.tuitionInState || college.tuition)}
                          </div>
                          <div className="text-sm text-gray-600">In-State Tuition</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* College Statistics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {formatPercentage(college.acceptanceRate)}
                      </div>
                      <div className="text-sm text-gray-600">Acceptance Rate</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {formatPercentage(college.graduationRate)}
                      </div>
                      <div className="text-sm text-gray-600">Graduation Rate</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {college.averageSAT || 'N/A'}
                      </div>
                      <div className="text-sm text-gray-600">Average SAT</div>
                    </div>
                    
                    <div className="text-center">
                      <div className="text-lg font-semibold text-gray-900">
                        {formatTuition(college.tuitionOutOfState || college.tuition * 1.5)}
                      </div>
                      <div className="text-sm text-gray-600">Out-of-State</div>
                    </div>
                  </div>

                  {/* Website Link & Like Button */}
                  <div className="border-t pt-4">
                    <div className="flex flex-wrap gap-3">
                      <Button variant="outline" size="sm" asChild>
                        <a 
                          href={college.website || `https://${college.name.toLowerCase().replace(/\s+/g, '')}.edu`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Visit Website
                        </a>
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => toggleLikedCollege({
                          id: college.id,
                          name: college.name,
                          city: college.city,
                          state: college.state,
                          tuition: college.tuitionInState || college.tuition,
                          website: college.website
                        })}
                        className={isLiked(college.id) ? "text-red-500" : "text-gray-400 hover:text-red-500"}
                        data-testid={`button-like-college-${college.id}`}
                      >
                        <Heart className={`h-4 w-4 ${isLiked(college.id) ? "fill-current" : ""}`} />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Load More Button */}
            {hasNextPage && (
              <div className="text-center py-6">
                <Button 
                  onClick={() => fetchNextPage()} 
                  disabled={isFetching}
                  className="px-8"
                >
                  {isFetching ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading more...
                    </>
                  ) : (
                    'Load More Colleges'
                  )}
                </Button>
              </div>
            )}

            {/* End of Results */}
            {!hasNextPage && colleges.length > 0 && (
              <div className="text-center py-6 text-gray-600">
                <p>You've seen all {totalCount.toLocaleString()} matching colleges from our database.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}