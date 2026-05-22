import { useState, useMemo } from 'react';
import { useInfiniteQuery } from '@tanstack/react-query';
import { debounce } from '@/lib/debounce';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  School, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Users,
  ExternalLink,
  Search,
  Filter,
  BookOpen
} from 'lucide-react';
import { Link } from 'wouter';
import { SavedBadge } from '@/components/saved-badge';
import { isCollegeSaved, useSavedItems } from '@/hooks/use-saved-items';

interface College {
  id: number;
  name: string;
  location: string;
  state: string;
  type: string;
  tuition: number;
  tuitionInState?: number;
  tuitionOutOfState?: number;
  acceptanceRate: number;
  graduationRate: number;
  averageSAT?: number;
  satLow?: number;
  satHigh?: number;
  programs?: string[];
  scholarships?: any[];
  rating: number;
}

const careerOptions = [
  { value: 'all', label: 'All Majors/Careers' },
  { value: 'technology', label: 'Technology & Computer Science' },
  { value: 'healthcare', label: 'Healthcare & Medicine' },
  { value: 'business', label: 'Business & Finance' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'education', label: 'Education & Teaching' },
  { value: 'arts', label: 'Arts & Design' },
  { value: 'science', label: 'Science & Research' }
];

const stateOptions = [
  'All States', 'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut', 
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa', 'Kansas', 
  'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 
  'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey', 
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma', 'Oregon', 
  'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota', 'Tennessee', 'Texas', 
  'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia', 'Wisconsin', 'Wyoming'
];

export default function EnhancedCollegeSearch() {
  const { keys: savedKeys } = useSavedItems();
  const [q, setQ] = useState('');
  const [stateCode, setStateCode] = useState('');
  const [type, setType] = useState('');
  const [majors, setMajors] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const hasSignal = Boolean((q && q.trim().length >= 2) || stateCode || type || majors.length > 0);

  const baseParams = useMemo(() => ({
    q: q.trim() || undefined,
    state: stateCode || undefined,
    type: type || undefined,
    sort: 'rating',
    order: 'desc',
    limit: 30,
  }), [q, stateCode, type]);

  const fetchPage = async ({ pageParam }: { pageParam?: string }) => {
    const url = new URL('/api/colleges/search', window.location.origin);
    Object.entries(baseParams).forEach(([k,v]) => v && url.searchParams.set(k, String(v)));
    majors.forEach(m => url.searchParams.append('majors', m));
    if (pageParam) url.searchParams.set('cursor', pageParam);

    const res = await fetch(url.toString(), { credentials: 'include' });
    if (!res.ok) throw new Error('Search failed');
    return res.json() as Promise<{ data: College[]; pageInfo: { nextCursor: string|null; total: number } }>;
  };

  const { data, isLoading, fetchNextPage, hasNextPage, isFetching } = useInfiniteQuery({
    queryKey: ['/api/colleges/search', baseParams, majors],
    queryFn: fetchPage,
    enabled: hasSignal, // nothing will load until the user types/filters
    getNextPageParam: (last) => last.pageInfo.nextCursor ?? undefined,
  });

  const colleges = data?.pages.flatMap(p => p.data) ?? [];
  const total = data?.pages[0]?.pageInfo?.total ?? 0;

  const onSearchChange = useMemo(() => debounce((val: string) => setQ(val), 250), []);

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <School className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">College Explorer</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Search thousands of US colleges by career focus, location, and preferences. 
            Find the perfect college for your academic and career goals.
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
              {/* Search Input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                <Input
                  placeholder="Search colleges (min 2 chars)..."
                  onChange={(e) => onSearchChange(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Career Filter */}
              <Select value={majors[0] || 'all'} onValueChange={(value) => setMajors(value === 'all' ? [] : [value])}>
                <SelectTrigger>
                  <BookOpen className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Majors/Careers" />
                </SelectTrigger>
                <SelectContent>
                  {careerOptions.map(option => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* State Filter */}
              <Select value={stateCode} onValueChange={setStateCode}>
                <SelectTrigger>
                  <MapPin className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  {stateOptions.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Type Filter */}
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <School className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="public">Public</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Results Info and Clear Filters */}
            <div className="flex justify-between items-center">
              <div>
                {!hasSignal ? (
                  <p className="text-gray-600">Type at least 2 characters or select a filter to search</p>
                ) : isFetching ? (
                  <p className="text-gray-600">Loading...</p>
                ) : (
                  <p className="text-gray-600">Found {total} colleges</p>
                )}
              </div>
              {hasSignal && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setQ('');
                    setStateCode('');
                    setType('');
                    setMajors([]);
                  }}
                  className="text-sm"
                >
                  Clear All Filters
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Loading State */}
        {isLoading && hasSignal && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading colleges...</p>
          </div>
        )}

        {/* No Signal State */}
        {!hasSignal && (
          <Card className="text-center py-12">
            <CardContent>
              <School className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Start Your Search</h3>
              <p className="text-gray-600">Use the search box or filters above to find colleges that match your interests.</p>
            </CardContent>
          </Card>
        )}

        {/* College Results */}
        {hasSignal && !isLoading && (
        <div className="grid gap-6">
          {colleges.map((college) => (
            <Card key={college.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2 flex items-center gap-2 flex-wrap">
                      <Link href={`/college/${college.id}`} className="hover:text-blue-600">
                        {college.name}
                      </Link>
                      {isCollegeSaved(savedKeys, college) && <SavedBadge />}
                    </h3>
                    <div className="flex items-center gap-2 text-gray-600 mb-3">
                      <MapPin className="h-4 w-4" />
                      <span>{college.location}</span>
                      <Badge variant="outline">{college.type}</Badge>
                      {college.rating >= 4 && (
                        <Badge className="bg-yellow-100 text-yellow-800">⭐ Top Rated</Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {formatTuition(college.tuitionInState || college.tuition)}
                    </div>
                    <div className="text-sm text-gray-600">In-State Tuition</div>
                  </div>
                </div>

                {/* College Stats */}
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
                      {college.satLow && college.satHigh 
                        ? `${college.satLow}-${college.satHigh}`
                        : college.averageSAT || 'N/A'}
                    </div>
                    <div className="text-sm text-gray-600">SAT Range</div>
                  </div>
                  
                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-900">
                      {formatTuition(college.tuitionOutOfState || college.tuition * 1.5)}
                    </div>
                    <div className="text-sm text-gray-600">Out-of-State</div>
                  </div>
                </div>

                {/* Programs for Selected Career */}
                {college.programs && college.programs.length > 0 && (
                  <div className="border-t pt-4 mb-4">
                    <h4 className="font-medium text-gray-900 mb-2">
                      Popular Programs
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {college.programs.slice(0, 6).map((program, idx) => (
                        <Badge key={idx} variant="secondary" className="text-xs">
                          {program}
                        </Badge>
                      ))}
                      {college.programs.length > 6 && (
                        <Badge variant="outline" className="text-xs">
                          +{college.programs.length - 6} more
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="mt-4 pt-4 border-t">
                  <Button asChild className="w-full sm:w-auto">
                    <Link href={`/college/${college.id}`}>
                      View Details & Scholarships
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Load More Button */}
          {hasNextPage && (
            <div className="text-center mt-6">
              <Button 
                onClick={() => fetchNextPage()} 
                disabled={isFetching}
                variant="outline"
                size="lg"
              >
                {isFetching ? 'Loading...' : 'Load More Colleges'}
              </Button>
            </div>
          )}

          {colleges.length === 0 && !isLoading && (
            <Card className="text-center py-12">
              <CardContent>
                <School className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No Colleges Found</h3>
                <p className="text-gray-600">Try adjusting your search criteria or filters.</p>
              </CardContent>
            </Card>
          )}
        </div>
        )}
      </div>
    </div>
  );
}