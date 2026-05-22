import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  School, 
  MapPin, 
  DollarSign, 
  TrendingUp, 
  Users,
  Star,
  Award,
  Gift,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'wouter';

interface ScholarshipInfo {
  name: string;
  amount: number;
  type: 'merit' | 'need' | 'athletic' | 'academic' | 'departmental';
  requirements: string[];
  renewable: boolean;
  deadline?: string;
}

interface CollegeDetails {
  id: number;
  name: string;
  state: string;
  city: string;
  type: string;
  size: string;
  tuitionInState: number;
  tuitionOutOfState: number;
  acceptanceRate: number;
  graduationRate: number;
  averageSAT: number;
  programs: string[];
  industries: string[];
  scholarships: ScholarshipInfo[];
  searchScore: number;
}

interface CollegeScholarshipDetailsProps {
  collegeId?: string;
}

export default function CollegeScholarshipDetails({ collegeId }: CollegeScholarshipDetailsProps) {
  const [selectedType, setSelectedType] = useState<string>('all');

  // Mock college data - in real app, this would come from API
  const mockCollege: CollegeDetails = {
    id: 1446,
    name: "Massachusetts Institute of Technology",
    state: "MA",
    city: "Cambridge",
    type: "private",
    size: "Small",
    tuitionInState: 60156,
    tuitionOutOfState: 60156,
    acceptanceRate: 5,
    graduationRate: 82,
    averageSAT: 1520,
    programs: ["Computer Science", "Engineering", "Physics", "Mathematics"],
    industries: ["Technology", "Engineering", "Science"],
    scholarships: [
      {
        name: "MIT Merit Scholarship",
        amount: 12500,
        type: "merit",
        requirements: ["Minimum 3.5 GPA", "SAT 1200+ or ACT 26+", "Full-time enrollment"],
        renewable: true,
        deadline: "March 1st"
      },
      {
        name: "MIT Need-Based Grant",
        amount: 8500,
        type: "need",
        requirements: ["FAFSA completion", "Demonstrated financial need", "Minimum 2.5 GPA"],
        renewable: true,
        deadline: "April 15th"
      },
      {
        name: "Presidential Excellence Award",
        amount: 25000,
        type: "academic",
        requirements: ["Minimum 3.8 GPA", "SAT 1400+ or ACT 32+", "Leadership experience", "Essay required"],
        renewable: true,
        deadline: "February 1st"
      },
      {
        name: "STEM Innovation Scholarship",
        amount: 15000,
        type: "departmental",
        requirements: ["STEM major declaration", "Minimum 3.5 GPA", "Research interest statement"],
        renewable: true,
        deadline: "March 15th"
      },
      {
        name: "MIT Athletic Scholarship",
        amount: 18000,
        type: "athletic",
        requirements: ["Athletic eligibility", "NCAA clearinghouse approval", "Minimum 2.5 GPA"],
        renewable: true,
        deadline: "February 15th"
      }
    ],
    searchScore: 105
  };

  const formatTuition = (amount: number) => {
    if (amount === 0) return 'Not Available';
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getScholarshipTypeColor = (type: string) => {
    switch (type) {
      case 'merit': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'need': return 'bg-green-100 text-green-800 border-green-200';
      case 'athletic': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'academic': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'departmental': return 'bg-indigo-100 text-indigo-800 border-indigo-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getFilteredScholarships = () => {
    if (selectedType === 'all') return mockCollege.scholarships;
    return mockCollege.scholarships.filter(s => s.type === selectedType);
  };

  const getTotalScholarshipValue = (scholarships: ScholarshipInfo[]) => {
    return scholarships.reduce((total, scholarship) => total + scholarship.amount, 0);
  };

  const getScholarshipTypes = () => {
    const types = Array.from(new Set(mockCollege.scholarships.map(s => s.type)));
    return types;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Link href="/college-search">
            <Button variant="outline" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Search
            </Button>
          </Link>
          
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">{mockCollege.name}</h1>
                <div className="flex items-center gap-4 text-gray-600 mb-4">
                  <div className="flex items-center gap-1">
                    <MapPin className="h-4 w-4" />
                    {mockCollege.city}, {mockCollege.state}
                  </div>
                  <div className="flex items-center gap-1">
                    <School className="h-4 w-4" />
                    {mockCollege.type} • {mockCollege.size}
                  </div>
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="text-center p-2 rounded-lg bg-blue-50">
                    <div className="text-2xl font-bold text-blue-600">
                      {formatTuition(mockCollege.tuitionInState)}
                    </div>
                    <div className="text-sm text-gray-600">Annual Tuition</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-green-50">
                    <div className="text-2xl font-bold text-green-600">{mockCollege.acceptanceRate}%</div>
                    <div className="text-sm text-gray-600">Acceptance Rate</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-purple-50">
                    <div className="text-2xl font-bold text-purple-600">{mockCollege.graduationRate}%</div>
                    <div className="text-sm text-gray-600">Graduation Rate</div>
                  </div>
                  <div className="text-center p-2 rounded-lg bg-orange-50">
                    <div className="text-2xl font-bold text-orange-600">{mockCollege.averageSAT}</div>
                    <div className="text-sm text-gray-600">Average SAT</div>
                  </div>
                </div>
              </div>
              
              <div className="text-right">
                <Badge className="bg-yellow-100 text-yellow-800 mb-2">
                  Match Score: {mockCollege.searchScore}
                </Badge>
                <div className="text-3xl font-bold text-green-600">
                  {formatTuition(getTotalScholarshipValue(mockCollege.scholarships))}
                </div>
                <div className="text-sm text-gray-600">Total Scholarship Value</div>
              </div>
            </div>
          </div>
        </div>

        {/* Scholarship Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-3xl font-bold">
                    {mockCollege.scholarships.length}
                  </div>
                  <div className="text-green-100">Available Scholarships</div>
                </div>
                <Award className="h-8 w-8 text-green-100" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {formatTuition(Math.max(...mockCollege.scholarships.map(s => s.amount)))}
                  </div>
                  <div className="text-blue-100">Highest Award</div>
                </div>
                <Gift className="h-8 w-8 text-blue-100" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-2xl font-bold">
                    {mockCollege.scholarships.filter(s => s.renewable).length}
                  </div>
                  <div className="text-purple-100">Renewable Awards</div>
                </div>
                <CheckCircle className="h-8 w-8 text-purple-100" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Scholarship Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Scholarship Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2 mb-6">
              <Button
                variant={selectedType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('all')}
                className={selectedType === 'all' ? 'bg-blue-600 text-white font-semibold' : ''}
              >
                All ({mockCollege.scholarships.length})
              </Button>
              {getScholarshipTypes().map(type => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className={`${selectedType === type ? getScholarshipTypeColor(type) + ' border-2 font-semibold' : 'hover:' + getScholarshipTypeColor(type)}`}
                >
                  {type} ({mockCollege.scholarships.filter(s => s.type === type).length})
                </Button>
              ))}
            </div>

            {/* Scholarship Cards */}
            <div className="grid gap-6">
              {getFilteredScholarships().map((scholarship, index) => (
                <Card key={index} className="border-l-4 border-l-blue-500">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                          {scholarship.name}
                        </h3>
                        <div className="flex items-center gap-2 mb-3">
                          <Badge className={getScholarshipTypeColor(scholarship.type)}>
                            {scholarship.type}
                          </Badge>
                          {scholarship.renewable && (
                            <Badge variant="outline" className="text-green-600 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Renewable
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-3xl font-bold text-green-600 mb-1">
                          {formatTuition(scholarship.amount)}
                        </div>
                        {scholarship.deadline && (
                          <div className="flex items-center gap-1 text-sm text-gray-600">
                            <Calendar className="h-3 w-3" />
                            Due: {scholarship.deadline}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-blue-500" />
                        Requirements
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {scholarship.requirements.map((req, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                            <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                            {req}
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Apply Section */}
        <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
          <CardContent className="p-8 text-center">
            <h3 className="text-2xl font-bold mb-4">Ready to Apply?</h3>
            <p className="text-blue-100 mb-6 max-w-2xl mx-auto">
              Start your application to {mockCollege.name} and be considered for these scholarships. 
              Early applications typically receive priority consideration for financial aid.
            </p>
            <div className="flex items-center justify-center gap-4">
              <Button size="lg" variant="secondary">
                Visit College Website
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}