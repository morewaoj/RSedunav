import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  School, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Users,
  Award,
  ExternalLink
} from 'lucide-react';
import { Link } from 'wouter';

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
  programs?: string[];
  scholarships?: any[];
}

// Hardcoded sample colleges for immediate display
const sampleColleges: College[] = [
  {
    id: 1,
    name: "University of Georgia",
    location: "Athens, GA",
    state: "Georgia",
    type: "Public",
    tuition: 12080,
    tuitionInState: 12080,
    tuitionOutOfState: 32220,
    acceptanceRate: 0.49,
    graduationRate: 0.85,
    averageSAT: 1350,
    programs: ["Business", "Engineering", "Journalism", "Agriculture"],
    scholarships: []
  },
  {
    id: 2,
    name: "Georgia Institute of Technology",
    location: "Atlanta, GA",
    state: "Georgia",
    type: "Public",
    tuition: 12852,
    tuitionInState: 12852,
    tuitionOutOfState: 33794,
    acceptanceRate: 0.17,
    graduationRate: 0.93,
    averageSAT: 1470,
    programs: ["Engineering", "Computer Science", "Business", "Architecture"],
    scholarships: []
  },
  {
    id: 3,
    name: "Emory University",
    location: "Atlanta, GA",
    state: "Georgia",
    type: "Private",
    tuition: 57120,
    tuitionInState: 57120,
    tuitionOutOfState: 57120,
    acceptanceRate: 0.13,
    graduationRate: 0.92,
    averageSAT: 1480,
    programs: ["Liberal Arts", "Business", "Medicine", "Law"],
    scholarships: []
  },
  {
    id: 4,
    name: "University of California, Berkeley",
    location: "Berkeley, CA",
    state: "California",
    type: "Public",
    tuition: 14312,
    tuitionInState: 14312,
    tuitionOutOfState: 44066,
    acceptanceRate: 0.11,
    graduationRate: 0.92,
    averageSAT: 1420,
    programs: ["Engineering", "Business", "Liberal Arts", "Computer Science"],
    scholarships: []
  },
  {
    id: 5,
    name: "Harvard University",
    location: "Cambridge, MA",
    state: "Massachusetts",
    type: "Private",
    tuition: 54269,
    tuitionInState: 54269,
    tuitionOutOfState: 54269,
    acceptanceRate: 0.03,
    graduationRate: 0.98,
    averageSAT: 1520,
    programs: ["Liberal Arts", "Business", "Law", "Medicine"],
    scholarships: []
  }
];

interface SimpleCollegeDisplayProps {
  colleges?: College[];
  isLoading?: boolean;
}

export default function SimpleCollegeDisplay({ colleges: propColleges, isLoading: propIsLoading }: SimpleCollegeDisplayProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Fetch colleges with API if not provided
  const { data: apiColleges = [], isLoading: apiIsLoading } = useQuery<College[]>({
    queryKey: ['/api/colleges', 'fast'],
    queryFn: async () => {
      const response = await fetch('/api/colleges/fast?limit=50');
      if (!response.ok) throw new Error('Failed to fetch colleges');
      return response.json();
    },
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    enabled: true // Always fetch real data
  });
  
  // Prioritize real API data over sample data
  const displayColleges = propColleges || apiColleges || sampleColleges;
  const isLoading = propIsLoading || (apiIsLoading && !propColleges && displayColleges.length === 0);
  
  console.log('College data status:', {
    propColleges: propColleges?.length || 0,
    apiColleges: apiColleges.length,
    sampleColleges: sampleColleges.length,
    displayColleges: displayColleges.length,
    isLoading: isLoading
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

  // Filter colleges based on search
  const filteredColleges = displayColleges.filter(college => 
    !searchTerm || 
    college.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    college.location.toLowerCase().includes(searchTerm.toLowerCase()) ||
    college.state.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Show loading only if we have no data at all
  if (isLoading && displayColleges.length === 0) {
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
            Explore top colleges across the United States with detailed information about tuition, 
            acceptance rates, and available programs.
          </p>
        </div>

        {/* Quick Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search colleges by name, city, or state..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full max-w-md mx-auto block px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Results Summary */}
        <div className="mb-6">
          <p className="text-lg text-gray-600 text-center">
            Showing {filteredColleges.length} of {displayColleges.length} colleges
            {apiColleges.length > 0 && (
              <span className="text-sm text-green-600 ml-2">• Live data from database</span>
            )}
            {apiColleges.length === 0 && !isLoading && (
              <span className="text-sm text-blue-600 ml-2">• Sample data</span>
            )}
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
                      <span>{college.location}</span>
                      <Badge variant="outline">{college.type}</Badge>
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

                {/* Programs */}
                {college.programs && college.programs.length > 0 && (
                  <div className="border-t pt-4 mb-4">
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

                {/* View Details Button */}
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
              <p className="text-gray-600">Try adjusting your search terms.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}