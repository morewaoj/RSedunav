import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Award,
  Gift,
  Calendar,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  Star,
  Users,
  DollarSign,
  School,
  ExternalLink
} from 'lucide-react';

interface Scholarship {
  name: string;
  amount: number;
  type: 'merit' | 'need' | 'athletic' | 'academic' | 'departmental';
  requirements: string[];
  renewable: boolean;
  deadline: string;
  provider: string;
  description: string;
  applicationLink?: string;
}

export default function UniversalScholarships() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');

  // Comprehensive scholarship database available to all US students
  const universalScholarships: Scholarship[] = [
    // Federal Scholarships and Grants
    {
      name: 'Pell Grant',
      amount: 7395,
      type: 'need',
      requirements: ['FAFSA completion', 'Demonstrated financial need', 'U.S. citizen or eligible non-citizen', 'Undergraduate student'],
      renewable: true,
      deadline: 'June 30th (Federal Deadline)',
      provider: 'U.S. Department of Education',
      description: 'The largest federal grant program offering funds that do not have to be repaid',
      applicationLink: 'https://studentaid.gov/h/apply-for-aid/fafsa'
    },
    {
      name: 'Cal Grant',
      amount: 12970,
      type: 'need',
      requirements: ['California residents', 'Financial need', 'GPA requirements', 'FAFSA and GPA verification form'],
      renewable: true,
      deadline: 'March 2nd',
      provider: 'California Student Aid Commission',
      description: 'State grant for California residents attending college in California',
      applicationLink: 'https://www.csac.ca.gov/cal-grants'
    },
    {
      name: 'TEACH Grant',
      amount: 4000,
      type: 'departmental',
      requirements: ['Teaching commitment', 'High-need field', 'Low-income schools', 'Academic achievement'],
      renewable: true,
      deadline: 'Varies by school',
      provider: 'U.S. Department of Education',
      description: 'For students who commit to teaching in high-need fields at low-income schools',
      applicationLink: 'https://studentaid.gov/understand-aid/types/grants/teach'
    },
    {
      name: 'SMART Grant',
      amount: 4000,
      type: 'academic',
      requirements: ['STEM major', 'Pell Grant recipient', 'Junior or senior year', 'Minimum 3.0 GPA'],
      renewable: true,
      deadline: 'June 30th',
      provider: 'U.S. Department of Education',
      description: 'For Pell Grant recipients majoring in STEM fields',
      applicationLink: 'https://studentaid.gov/understand-aid/types/grants/smart-academic-competitiveness'
    },
    {
      name: 'Iraq and Afghanistan Service Grant',
      amount: 7395,
      type: 'need',
      requirements: ['Parent or guardian died in Iraq/Afghanistan', 'Under 24 or enrolled in college when parent died', 'Not eligible for Pell Grant'],
      renewable: true,
      deadline: 'June 30th',
      provider: 'U.S. Department of Education',
      description: 'For students whose parent or guardian died as a result of military service in Iraq or Afghanistan',
      applicationLink: 'https://studentaid.gov/understand-aid/types/grants/iraq-afghanistan-service'
    },

    {
      name: 'Federal Supplemental Educational Opportunity Grant (SEOG)',
      amount: 4000,
      type: 'need',
      requirements: ['FAFSA completion', 'Exceptional financial need', 'Undergraduate student', 'Priority given to Pell Grant recipients'],
      renewable: true,
      deadline: 'Priority: March 1st',
      provider: 'U.S. Department of Education',
      description: 'Additional federal grant for students with exceptional financial need',
      applicationLink: 'https://studentaid.gov/understand-aid/types/grants/fseog'
    },
    {
      name: 'Google Computer Science Scholarship',
      amount: 10000,
      type: 'departmental',
      requirements: ['Computer Science or related major', 'Minimum 3.2 GPA', 'Leadership experience', 'Commitment to diversity in tech'],
      renewable: true,
      deadline: 'December 1st',
      provider: 'Google Inc.',
      description: 'Supporting the next generation of computer scientists and technologists',
      applicationLink: 'https://buildyourfuture.withgoogle.com/scholarships'
    },
    {
      name: 'Microsoft STEM Scholarship',
      amount: 12000,
      type: 'departmental',
      requirements: ['STEM major', 'Demonstrated financial need', 'Leadership in technology', 'Underrepresented minority'],
      renewable: true,
      deadline: 'February 15th',
      provider: 'Microsoft Corporation',
      description: 'Empowering the next generation of diverse technologists',
      applicationLink: 'https://www.microsoft.com/en-us/diversity/programs/scholarships'
    },
    {
      name: 'National Health Service Corps Scholarship',
      amount: 50000,
      type: 'departmental',
      requirements: ['Medical, dental, nursing, or behavioral health major', 'Service commitment in underserved areas', 'U.S. citizenship'],
      renewable: true,
      deadline: 'March 31st',
      provider: 'U.S. Department of Health and Human Services',
      description: 'Full tuition plus stipend in exchange for service commitment',
      applicationLink: 'https://nhsc.hrsa.gov/scholarships'
    },
    {
      name: 'Coca-Cola Scholars Foundation Scholarship',
      amount: 20000,
      type: 'merit',
      requirements: ['High school senior', 'Minimum 3.0 GPA', 'Leadership experience', 'Community service', 'U.S. citizenship'],
      renewable: false,
      deadline: 'October 31st',
      provider: 'Coca-Cola Scholars Foundation',
      description: 'Recognizing exceptional high school students who are making a positive impact',
      applicationLink: 'https://www.coca-colascholarsfoundation.org/apply'
    },
    {
      name: 'Gates Millennium Scholars Program',
      amount: 25000,
      type: 'merit',
      requirements: ['Outstanding academic record', 'Minority status', 'Significant financial need', 'Leadership abilities'],
      renewable: true,
      deadline: 'January 15th',
      provider: 'Bill & Melinda Gates Foundation',
      description: 'Supporting outstanding minority students through college and graduate school',
      applicationLink: 'https://www.thegatesscholarship.org/scholarship'
    },
    {
      name: 'Jack Kent Cooke Foundation College Scholarship',
      amount: 55000,
      type: 'merit',
      requirements: ['High academic achievement', 'Financial need', 'Outstanding leadership', 'Community college transfer or high school senior'],
      renewable: true,
      deadline: 'November 18th',
      provider: 'Jack Kent Cooke Foundation',
      description: 'The largest private scholarship for two-year and community college transfer students',
      applicationLink: 'https://www.jkcf.org/our-scholarships/college-scholarship-program'
    },
    {
      name: 'Ronald McDonald House Charities Scholarship',
      amount: 5000,
      type: 'merit',
      requirements: ['Academic excellence', 'Community involvement', 'Leadership', 'Financial need'],
      renewable: false,
      deadline: 'January 15th',
      provider: 'Ronald McDonald House Charities',
      description: 'Supporting students who have shown academic excellence and community involvement',
      applicationLink: 'https://www.rmhc.org/what-we-do/rmhc-scholarships'
    },
    {
      name: 'Hispanic Scholarship Fund',
      amount: 15000,
      type: 'merit',
      requirements: ['Hispanic heritage', 'Minimum 3.0 GPA', 'U.S. citizenship or legal permanent residency', 'Enrollment in accredited institution'],
      renewable: true,
      deadline: 'February 15th',
      provider: 'Hispanic Scholarship Fund',
      description: 'Empowering Latino families through higher education',
      applicationLink: 'https://www.hsf.net/scholarship'
    },
    {
      name: 'United Negro College Fund Scholarship',
      amount: 8000,
      type: 'merit',
      requirements: ['African American heritage', 'Minimum 2.5 GPA', 'Financial need', 'Leadership potential'],
      renewable: true,
      deadline: 'Various deadlines',
      provider: 'United Negro College Fund',
      description: 'Supporting African American students in their pursuit of higher education',
      applicationLink: 'https://uncf.org/scholarships'
    },
    {
      name: 'American Indian College Fund Scholarship',
      amount: 10000,
      type: 'merit',
      requirements: ['American Indian or Alaska Native heritage', 'Minimum 2.0 GPA', 'Financial need', 'Tribal enrollment'],
      renewable: true,
      deadline: 'May 31st',
      provider: 'American Indian College Fund',
      description: 'Providing scholarships and support to Native American students',
      applicationLink: 'https://collegefund.org/students/scholarships'
    },
    {
      name: 'First Generation Matching Grant Program',
      amount: 6000,
      type: 'need',
      requirements: ['First-generation college student', 'Minimum 3.0 GPA', 'Financial need', 'Essay required'],
      renewable: true,
      deadline: 'March 31st',
      provider: 'Various Institutions',
      description: 'Supporting first-generation college students achieve their educational goals',
      applicationLink: 'https://www.firstgen.org/resources'
    },
    {
      name: 'Women in STEM Scholarship',
      amount: 12000,
      type: 'departmental',
      requirements: ['Female student', 'STEM major', 'Minimum 3.5 GPA', 'Research interest or experience'],
      renewable: true,
      deadline: 'April 30th',
      provider: 'Society of Women Engineers',
      description: 'Encouraging women to pursue careers in science, technology, engineering, and mathematics',
      applicationLink: 'https://swe.org/scholarships'
    },
    {
      name: 'Veterans Education Success Scholarship',
      amount: 7500,
      type: 'merit',
      requirements: ['Veteran status or military dependent', 'Good academic standing', 'Enrollment in degree program', 'Community service'],
      renewable: true,
      deadline: 'April 1st',
      provider: 'Veterans Education Success',
      description: 'Supporting veterans and their families in pursuing higher education',
      applicationLink: 'https://veteranseducationsuccess.org/scholarships'
    }
  ];

  const formatTuition = (amount: number) => {
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
    let filtered = universalScholarships;
    
    if (selectedType !== 'all') {
      filtered = filtered.filter(s => s.type === selectedType);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    return filtered;
  };

  const getTotalValue = () => {
    return getFilteredScholarships().reduce((total, scholarship) => total + scholarship.amount, 0);
  };

  const getScholarshipTypes = () => {
    return Array.from(new Set(universalScholarships.map(s => s.type)));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Award className="h-10 w-10 text-yellow-600" />
            <h1 className="text-4xl font-bold text-gray-900">Universal Scholarships</h1>
          </div>
          <p className="text-xl text-gray-600 max-w-4xl mx-auto">
            Discover comprehensive scholarship opportunities available to all students across the United States. 
            These scholarships never disappear from filters and remain accessible to everyone.
          </p>
        </div>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold mb-2">{universalScholarships.length}</div>
              <div className="text-green-100">Available Scholarships</div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold mb-2">
                {formatTuition(Math.max(...universalScholarships.map(s => s.amount)))}
              </div>
              <div className="text-blue-100">Highest Award</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
            <CardContent className="p-6 text-center">
              <div className="text-2xl font-bold mb-2">
                {formatTuition(getTotalValue())}
              </div>
              <div className="text-purple-100">Total Available</div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6 text-center">
              <div className="text-3xl font-bold mb-2">
                {universalScholarships.filter(s => s.renewable).length}
              </div>
              <div className="text-orange-100">Renewable Awards</div>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
                  <Input
                    placeholder="Search scholarships by name, provider, or description..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant={selectedType === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedType('all')}
                className={selectedType === 'all' ? 'bg-blue-600 text-white font-semibold' : ''}
              >
                All ({universalScholarships.length})
              </Button>
              {getScholarshipTypes().map(type => (
                <Button
                  key={type}
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedType(type)}
                  className={`${selectedType === type ? getScholarshipTypeColor(type) + ' border-2 font-semibold' : 'hover:' + getScholarshipTypeColor(type)}`}
                >
                  {type} ({universalScholarships.filter(s => s.type === type).length})
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Scholarship Grid */}
        <div className="grid gap-6">
          {getFilteredScholarships().map((scholarship, index) => (
            <Card key={index} className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-gray-900 mb-2">
                      {scholarship.name}
                    </h3>
                    <p className="text-gray-600 mb-3">{scholarship.description}</p>
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
                      <Badge variant="outline" className="text-blue-600 border-blue-200">
                        <School className="h-3 w-3 mr-1" />
                        {scholarship.provider}
                      </Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {formatTuition(scholarship.amount)}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <Calendar className="h-3 w-3" />
                      Due: {scholarship.deadline}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-2 flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-blue-500" />
                      Requirements
                    </h4>
                    <div className="space-y-1">
                      {scholarship.requirements.map((req, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-sm text-gray-600">
                          <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                          {req}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {scholarship.applicationLink && (
                    <div className="flex items-center justify-center lg:justify-end">
                      <Button 
                        asChild
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
                      >
                        <a 
                          href={scholarship.applicationLink} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2"
                        >
                          Apply Now
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {getFilteredScholarships().length === 0 && (
          <Card className="text-center py-12">
            <CardContent>
              <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No scholarships found</h3>
              <p className="text-gray-600">Try adjusting your search terms or filters.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}