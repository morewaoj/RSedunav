import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  School, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Users,
  Search,
  Award,
  Calendar,
  CheckCircle,
  ExternalLink
} from 'lucide-react';
import { Link } from 'wouter';

interface College {
  id: number;
  name: string;
  location: string;
  state: string;
  type: string;
  tuitionInState: number;
  tuitionOutOfState: number;
  acceptanceRate: number;
  graduationRate: number;
  averageSAT: number;
  satLow?: number;
  satHigh?: number;
  programs?: string[];
  industries?: string[];
  scholarships?: ScholarshipInfo[];
}

interface ScholarshipInfo {
  name: string;
  amount: number;
  type: 'merit' | 'need' | 'athletic' | 'academic' | 'departmental';
  requirements: string[];
  renewable: boolean;
  deadline?: string;
}

export default function SimpleCollegeSearch() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('all');
  const [selectedType, setSelectedType] = useState('all');

  // Fetch colleges with optimized loading - fallback to working endpoint
  const { data: colleges = [], isLoading } = useQuery<College[]>({
    queryKey: ['/api/colleges', 'optimized'],
    queryFn: async () => {
      // Try fast endpoint first, fallback to regular if it fails
      try {
        const response = await fetch('/api/colleges/fast?limit=50');
        if (response.ok) {
          return response.json();
        }
      } catch (error) {
        console.log('Fast endpoint failed, using regular endpoint');
      }
      
      // Fallback to regular endpoint with small limit
      const response = await fetch('/api/colleges?limit=50');
      if (!response.ok) throw new Error('Failed to fetch colleges');
      return response.json();
    },
    staleTime: 10 * 60 * 1000, // Cache for 10 minutes
    refetchOnWindowFocus: false
  });

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
    return `${Math.round(rate * 100)}%`;
  };

  const getScholarshipTypeColor = (type: string) => {
    switch (type) {
      case 'merit': return 'bg-blue-100 text-blue-800';
      case 'need': return 'bg-green-100 text-green-800';
      case 'athletic': return 'bg-orange-100 text-orange-800';
      case 'academic': return 'bg-purple-100 text-purple-800';
      case 'departmental': return 'bg-indigo-100 text-indigo-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getTotalScholarshipValue = (scholarships: ScholarshipInfo[] = []) => {
    return scholarships.reduce((total, scholarship) => total + scholarship.amount, 0);
  };

  // Filter colleges based on search criteria
  const filteredColleges = colleges.filter(college => {
    const matchesSearch = !searchTerm || 
      college.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      college.location?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      college.state.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesState = selectedState === 'all' || 
      college.state.toLowerCase() === selectedState.toLowerCase();
    
    const matchesType = selectedType === 'all' || 
      college.type.toLowerCase().includes(selectedType.toLowerCase());
    
    return matchesSearch && matchesState && matchesType;
  });

  // Get unique states and types for filters
  const states = Array.from(new Set(colleges.map(c => c.state))).sort();
  const types = Array.from(new Set(colleges.map(c => c.type))).sort();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading colleges...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <School className="h-8 w-8 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">College Search</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Explore thousands of colleges across the United States with detailed information about tuition, 
            acceptance rates, and available scholarships.
          </p>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    placeholder="Search colleges by name, city, or state..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="All States" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All States</SelectItem>
                  {states.map(state => (
                    <SelectItem key={state} value={state}>{state}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger>
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {types.map(type => (
                    <SelectItem key={type} value={type}>{type}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-lg text-gray-600">
            Showing {filteredColleges.length} of {colleges.length} colleges
          </p>
        </div>

        {/* College Results */}
        <div className="grid gap-6">
          {filteredColleges.map((college) => (
            <Card key={college.id} className="hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      <Link href={`/college/${college.id}`} className="hover:text-blue-600">
                        {college.name}
                      </Link>
                    </h3>
                    <div className="flex items-center gap-2 text-gray-600 mb-3">
                      <MapPin className="h-4 w-4" />
                      <span>{college.location || college.state}</span>
                      <Badge variant="outline">{college.type}</Badge>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {formatTuition(college.tuitionInState)}
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
                      {formatTuition(college.tuitionOutOfState)}
                    </div>
                    <div className="text-sm text-gray-600">Out-of-State</div>
                  </div>
                </div>

                {/* Scholarships Section */}
                {college.scholarships && college.scholarships.length > 0 && (
                  <div className="border-t pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium text-gray-900 flex items-center gap-2">
                        <Award className="h-4 w-4 text-yellow-600" />
                        Available Scholarships ({college.scholarships.length})
                      </h4>
                      <div className="text-lg font-semibold text-green-600">
                        Total: {formatTuition(getTotalScholarshipValue(college.scholarships))}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {college.scholarships.slice(0, 4).map((scholarship, idx) => (
                        <div key={idx} className="bg-gray-50 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <h5 className="font-medium text-gray-900 text-sm">
                              {scholarship.name}
                            </h5>
                            <Badge className={getScholarshipTypeColor(scholarship.type)}>
                              {scholarship.type}
                            </Badge>
                          </div>
                          
                          <div className="flex items-center justify-between">
                            <span className="text-lg font-semibold text-green-600">
                              {formatTuition(scholarship.amount)}
                            </span>
                            {scholarship.renewable && (
                              <Badge variant="outline" className="text-xs">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Renewable
                              </Badge>
                            )}
                          </div>
                          
                          {scholarship.deadline && (
                            <div className="flex items-center gap-1 text-xs text-gray-600 mt-1">
                              <Calendar className="h-3 w-3" />
                              Due: {scholarship.deadline}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    
                    {college.scholarships.length > 4 && (
                      <div className="mt-3">
                        <Button variant="outline" size="sm" asChild>
                          <Link href={`/college/${college.id}`}>
                            View All {college.scholarships.length} Scholarships
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Programs */}
                {college.programs && college.programs.length > 0 && (
                  <div className="border-t pt-4 mt-4">
                    <h4 className="font-medium text-gray-900 mb-2">Popular Programs</h4>
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

                {/* Actions */}
                <div className="mt-4 pt-4 border-t">
                  <Button asChild className="w-full md:w-auto">
                    <Link href={`/college/${college.id}`}>
                      View Full Details
                      <ExternalLink className="h-4 w-4 ml-2" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredColleges.length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <School className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No colleges found</h3>
              <p className="text-gray-600">Try adjusting your search terms or filters.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}