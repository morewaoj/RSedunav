import { useMemo, useState } from 'react';
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Award,
  Calendar,
  CheckCircle,
  AlertCircle,
  Search,
  Filter,
  Star,
  DollarSign,
  School,
  ExternalLink,
  Target,
  Users,
  Building,
  ShieldCheck,
  Clock,
  Bell,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from "@/hooks/use-auth.js";
import { apiRequest, getQueryFn, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SavedBadge } from "@/components/saved-badge";
import {
  isScholarshipSaved as isScholarshipSavedLookup,
  useSavedItems,
} from "@/hooks/use-saved-items";
import {
  MatchReasonChips,
  pickMatchReasons,
} from "@/components/match-reason-chips";
import {
  MatchedOnlyEmptyHint,
  MatchedOnlyToggle,
  useMatchedOnlyFilter,
} from "@/components/matched-only-filter";

type ScholarshipRecsResponse = {
  recommendations?: Array<{
    scholarship: Scholarship;
    matchScore: number;
    matchReasons?: string[] | null;
  }>;
};

interface VerifiedScholarship {
  id: number;
  name: string;
  provider: string;
  type: string;
  state?: string;
  industryTags?: string[];
  awardMin?: number;
  awardMax?: number;
  amount: number;
  currency?: string;
  deadlineAt?: string;
  opensAt?: string;
  deadline?: string;
  url: string;
  website?: string;
  eligibility?: Record<string, any>;
  eligibilityRequirements: string[];
  targetDemographics: string[];
  applicationRequirements: string[];
  description?: string;
  renewable?: boolean;
  sourceName: string;
  sourceUrl?: string;
  sourceLastVerifiedAt?: string;
  isActive?: boolean;
  notes?: string;
}

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
  eligibilityRequirements?: string[];
  website?: string;
  targetDemographics?: string[];
  applicationRequirements?: string[];
}

interface ScholarshipMatch {
  scholarship: Scholarship;
  matchScore: number;
  matchReasons: string[];
  eligibilityStatus: 'eligible' | 'likely-eligible' | 'check-requirements';
}

const ITEMS_PER_PAGE = 6;

export default function ComprehensiveScholarships() {
  const { user } = useAuth();
  const { keys: savedKeys } = useSavedItems();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedProvider, setSelectedProvider] = useState<string>('all');
  const [selectedState, setSelectedState] = useState<string>('all');
  const [minAmount, setMinAmount] = useState<string>('');
  const [renewableOnly, setRenewableOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [showForYou, setShowForYou] = useState(true);

  // Fetch verified scholarships from database with source tracking
  const { data: verifiedScholarships = [], isLoading: isLoadingVerified } = useQuery<VerifiedScholarship[]>({
    queryKey: ['/api/verified-scholarships'],
  });

  // Get user's saved scholarships
  const { data: savedScholarships = [] } = useQuery<any[]>({
    queryKey: ['/api/verified-scholarships/saved'],
    enabled: !!user,
  });

  // Get user's deadline notifications
  const { data: notifications = [] } = useQuery<any[]>({
    queryKey: ['/api/verified-scholarships/notifications'],
    enabled: !!user,
  });

  // Save scholarship mutation
  const saveScholarshipMutation = useMutation({
    mutationFn: async (scholarshipId: number) => {
      const response = await apiRequest('POST', '/api/verified-scholarships/save', {
        scholarshipId
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/verified-scholarships/saved'] });
      toast({
        title: "Scholarship Saved",
        description: "You'll receive deadline reminders at 30, 14, 7, 3, and 1 days before the deadline.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save scholarship. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Fetch authentic scholarships from database (legacy)
  const { data: authenticScholarships = [], isLoading: isLoadingAuthentic } = useQuery<Scholarship[]>({
    queryKey: ['/api/scholarships/authentic'],
  });

  // Personalized recommendations. This used to be a separate query that
  // POSTed a hardcoded fake profile (GPA 3.5, "Computer Science", "Georgia")
  // to /api/scholarships/recommendations regardless of who was signed in —
  // every user saw recommendations for the same fictional person. This
  // endpoint already did the right thing (reads the real signed-in user's
  // stored profile server-side) but was only being used to look up "why
  // this matched" chip text, not as the actual "For You" list. Consolidated
  // onto the one that was already right instead of maintaining both.
  const profileRecsQ = useQuery<ScholarshipRecsResponse | null>({
    queryKey: ['/api/profile/scholarship-recommendations'],
    queryFn: getQueryFn<ScholarshipRecsResponse | null>({ on401: 'returnNull' }),
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const recommendations = useMemo(
    () => profileRecsQ.data?.recommendations ?? [],
    [profileRecsQ.data]
  );

  // Recs don't echo a stable id, so key on normalized name (matches mobile).
  const reasonsByName = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const entry of profileRecsQ.data?.recommendations ?? []) {
      const name = entry.scholarship?.name?.trim().toLowerCase();
      if (!name) continue;
      const reasons = pickMatchReasons(entry.matchReasons);
      if (reasons.length > 0) map.set(name, reasons);
    }
    return map;
  }, [profileRecsQ.data]);

  // The "Matched to me" toggle only makes sense when the signed-in user has
  // at least one personalized scholarship recommendation to filter down to.
  // Keys come from the same normalized-name map the chips use, so the toggle
  // and the chips agree on what counts as a match.
  const hasMatches = !!user && reasonsByName.size > 0;
  const { matchedOnly, setMatchedOnly } = useMatchedOnlyFilter({ hasMatches });

  const isScholarshipSaved = (scholarshipId: number) => {
    return savedScholarships.some((s: any) => s.saved?.scholarshipId === scholarshipId);
  };

  const getDaysUntilDeadline = (deadlineAt?: string) => {
    if (!deadlineAt) return null;
    const deadline = new Date(deadlineAt);
    const now = new Date();
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDeadlineUrgency = (daysLeft: number | null) => {
    if (daysLeft === null) return 'gray';
    if (daysLeft <= 7) return 'red';
    if (daysLeft <= 30) return 'orange';
    return 'green';
  };

  // Filter verified scholarships
  const filteredVerifiedScholarships = verifiedScholarships.filter(s => {
    if (searchTerm && !s.name.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !s.provider.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (selectedType !== 'all' && s.type !== selectedType) return false;
    if (selectedProvider !== 'all' && s.provider !== selectedProvider) return false;
    if (selectedState !== 'all' && s.state !== selectedState) return false;
    if (minAmount && s.amount < parseInt(minAmount)) return false;
    if (renewableOnly && !s.renewable) return false;
    return true;
  });

  // Get unique providers from verified scholarships for the filter
  const getVerifiedProviders = () => {
    const providers = new Set(verifiedScholarships.map(s => s.provider));
    return Array.from(providers).sort();
  };

  // Comprehensive scholarship database available to all US students
  const universalScholarships: Scholarship[] = [
    // Federal Scholarships and Grants
    {
      name: 'Federal Pell Grant',
      amount: 7395,
      type: 'need',
      requirements: ['FAFSA completion', 'Demonstrated financial need', 'U.S. citizen or eligible non-citizen', 'Undergraduate student'],
      renewable: true,
      deadline: 'June 30th (Annual Federal Deadline)',
      provider: 'U.S. Department of Education',
      description: 'The largest federal grant program offering funds that do not have to be repaid to undergraduate students with exceptional financial need',
      applicationLink: 'https://studentaid.gov/h/apply-for-aid/fafsa'
    },
    {
      name: 'Federal Supplemental Educational Opportunity Grant (FSEOG)',
      amount: 4000,
      type: 'need',
      requirements: ['FAFSA completion', 'Exceptional financial need', 'Undergraduate student', 'Priority given to Pell Grant recipients'],
      renewable: true,
      deadline: 'Priority: March 1st',
      provider: 'U.S. Department of Education',
      description: 'Additional federal grant for students with exceptional financial need, awarded through participating schools',
      applicationLink: 'https://studentaid.gov/understand-aid/types/grants/fseog'
    },
    {
      name: 'TEACH Grant',
      amount: 4000,
      type: 'departmental',
      requirements: ['Teaching commitment in high-need field', 'Service in low-income schools', 'Academic achievement', 'Complete Teacher Preparation Program'],
      renewable: true,
      deadline: 'Varies by school',
      provider: 'U.S. Department of Education',
      description: 'For students who commit to teaching in high-need fields at low-income schools for at least four years',
      applicationLink: 'https://studentaid.gov/understand-aid/types/grants/teach'
    },
    {
      name: 'Iraq and Afghanistan Service Grant',
      amount: 7395,
      type: 'need',
      requirements: ['Parent or guardian died in Iraq/Afghanistan service', 'Under 24 or enrolled in college when parent died', 'Not eligible for Pell Grant due to EFC'],
      renewable: true,
      deadline: 'June 30th',
      provider: 'U.S. Department of Education',
      description: 'For students whose parent or guardian died as a result of military service in Iraq or Afghanistan after September 11, 2001',
      applicationLink: 'https://studentaid.gov/understand-aid/types/grants/iraq-afghanistan-service'
    },
    // Major Corporate Scholarships
    {
      name: 'Google Generation Scholarship',
      amount: 10000,
      type: 'departmental',
      requirements: ['Computer Science or related major', 'Minimum 3.2 GPA', 'Leadership experience', 'Commitment to diversity in tech', 'Full-time bachelor\'s student'],
      renewable: true,
      deadline: 'August 14th',
      provider: 'Google Inc.',
      description: 'Supporting the next generation of computer scientists and technologists with focus on diversity, equity, and inclusion',
      applicationLink: 'https://buildyourfuture.withgoogle.com/scholarships/generation-google-scholarship'
    },
    {
      name: 'Microsoft STEM Scholarship',
      amount: 12000,
      type: 'departmental',
      requirements: ['STEM major', 'Demonstrated financial need', 'Leadership in technology', 'Underrepresented minority', 'High school senior'],
      renewable: true,
      deadline: 'March 17th',
      provider: 'Microsoft Corporation',
      description: 'Empowering the next generation of diverse technologists through financial support and mentorship opportunities',
      applicationLink: 'https://www.microsoft.com/en-us/diversity/programs/scholarships'
    },
    {
      name: 'Coca-Cola Scholars Foundation Scholarship',
      amount: 20000,
      type: 'merit',
      requirements: ['High school senior', 'Minimum 3.0 GPA', 'Leadership experience', 'Community service', 'U.S. citizenship', 'Demonstrated achievement'],
      renewable: false,
      deadline: 'September 30th',
      provider: 'Coca-Cola Scholars Foundation',
      description: 'Recognizing exceptional high school students who are making a positive impact in their communities and schools',
      applicationLink: 'https://www.coca-colascholarsfoundation.org/apply'
    },
    // Major Foundation Scholarships
    {
      name: 'Gates Scholarship',
      amount: 50000,
      type: 'need',
      requirements: ['Outstanding academic record', 'Minority status (African American, Hispanic/Latino, Asian Pacific Islander, Native American)', 'Significant financial need', 'Leadership abilities', 'High school senior'],
      renewable: true,
      deadline: 'September 15th',
      provider: 'Bill & Melinda Gates Foundation',
      description: 'Providing full cost of attendance scholarships to outstanding minority students with significant financial need',
      applicationLink: 'https://www.thegatesscholarship.org/scholarship'
    },
    {
      name: 'Jack Kent Cooke Foundation College Scholarship',
      amount: 55000,
      type: 'merit',
      requirements: ['High academic achievement', 'Financial need', 'Outstanding leadership', 'Community college transfer or high school senior', 'Demonstrated persistence'],
      renewable: true,
      deadline: 'November 18th',
      provider: 'Jack Kent Cooke Foundation',
      description: 'The largest private scholarship for two-year and community college transfer students and high school seniors',
      applicationLink: 'https://www.jkcf.org/our-scholarships/college-scholarship-program'
    },
    // Healthcare Scholarships
    {
      name: 'National Health Service Corps Scholarship',
      amount: 50000,
      type: 'departmental',
      requirements: ['Medical, dental, nursing, or behavioral health major', 'Service commitment in underserved areas', 'U.S. citizenship', 'Enrollment in approved program'],
      renewable: true,
      deadline: 'March 31st',
      provider: 'U.S. Department of Health and Human Services',
      description: 'Full tuition plus living stipend in exchange for service commitment in Health Professional Shortage Areas',
      applicationLink: 'https://nhsc.hrsa.gov/scholarships'
    },
    // Diversity and Inclusion Scholarships
    {
      name: 'Hispanic Scholarship Fund',
      amount: 15000,
      type: 'merit',
      requirements: ['Hispanic heritage', 'Minimum 3.0 GPA', 'U.S. citizenship or legal permanent residency', 'Enrollment in accredited institution', 'Financial need'],
      renewable: true,
      deadline: 'February 15th',
      provider: 'Hispanic Scholarship Fund',
      description: 'Empowering Latino families through higher education with the largest source of scholarships for Hispanic students',
      applicationLink: 'https://www.hsf.net/scholarship'
    },
    {
      name: 'United Negro College Fund Scholarship',
      amount: 8000,
      type: 'merit',
      requirements: ['African American heritage', 'Minimum 2.5 GPA', 'Financial need', 'Leadership potential', 'Community involvement'],
      renewable: true,
      deadline: 'Various deadlines',
      provider: 'United Negro College Fund',
      description: 'Supporting African American students in their pursuit of higher education through multiple scholarship programs',
      applicationLink: 'https://uncf.org/scholarships'
    },
    {
      name: 'American Indian College Fund Scholarship',
      amount: 10000,
      type: 'merit',
      requirements: ['American Indian or Alaska Native heritage', 'Minimum 2.0 GPA', 'Financial need', 'Tribal enrollment or descendant status'],
      renewable: true,
      deadline: 'May 31st',
      provider: 'American Indian College Fund',
      description: 'Providing scholarships and support to Native American students pursuing higher education',
      applicationLink: 'https://collegefund.org/students/scholarships'
    },
    // STEM and Professional Scholarships
    {
      name: 'Society of Women Engineers Scholarship',
      amount: 12000,
      type: 'departmental',
      requirements: ['Female student', 'STEM major (Engineering preferred)', 'Minimum 3.5 GPA', 'Leadership experience', 'Community involvement'],
      renewable: true,
      deadline: 'February 15th',
      provider: 'Society of Women Engineers',
      description: 'Encouraging women to pursue careers in science, technology, engineering, and mathematics fields',
      applicationLink: 'https://swe.org/scholarships'
    },
    {
      name: 'National Merit Scholarship',
      amount: 25000,
      type: 'merit',
      requirements: ['High PSAT/NMSQT scores', 'Academic excellence', 'High school senior', 'U.S. citizenship or permanent residency', 'Endorsed by school'],
      renewable: true,
      deadline: 'October (PSAT date)',
      provider: 'National Merit Scholarship Corporation',
      description: 'Recognizing and rewarding academically talented students based on PSAT/NMSQT performance',
      applicationLink: 'https://www.nationalmerit.org/s/1758/interior.aspx?sid=1758&gid=2&pgid=424'
    },
    // Burger King and Food Service
    {
      name: 'Burger King Scholars Program',
      amount: 25000,
      type: 'need',
      requirements: ['High school senior', 'Academic achievement', 'Financial need', 'Community involvement', 'Work experience (preferred)', 'Leadership'],
      renewable: false,
      deadline: 'December 15th',
      provider: 'Burger King Foundation',
      description: 'Supporting students who have overcome obstacles and demonstrated academic achievement despite challenges',
      applicationLink: 'https://www.burgerkingscholarship.com/'
    },
    // Military and Veterans
    {
      name: 'Veterans Education Success Scholarship',
      amount: 7500,
      type: 'merit',
      requirements: ['Veteran status or military dependent', 'Good academic standing', 'Enrollment in degree program', 'Community service', 'Leadership'],
      renewable: true,
      deadline: 'April 1st',
      provider: 'Veterans Education Success',
      description: 'Supporting veterans and their families in pursuing higher education and career goals',
      applicationLink: 'https://veteranseducationsuccess.org/scholarships'
    },
    // Community Service and Leadership
    {
      name: 'Ronald McDonald House Charities Scholarship',
      amount: 5000,
      type: 'merit',
      requirements: ['Academic excellence', 'Community involvement', 'Leadership', 'Financial need', 'High school senior or college student'],
      renewable: false,
      deadline: 'January 15th',
      provider: 'Ronald McDonald House Charities',
      description: 'Supporting students who have shown academic excellence and significant community involvement',
      applicationLink: 'https://www.rmhc.org/what-we-do/rmhc-scholarships'
    },
    // First Generation and Access
    {
      name: 'First Generation Scholarship Program',
      amount: 6000,
      type: 'need',
      requirements: ['First-generation college student', 'Minimum 3.0 GPA', 'Financial need', 'Essay required', 'Community service'],
      renewable: true,
      deadline: 'March 31st',
      provider: 'Various Institutions and Foundations',
      description: 'Supporting first-generation college students achieve their educational goals and break generational barriers',
      applicationLink: 'https://www.firstgen.org/resources'
    },
    // Technology and Innovation
    {
      name: 'Dell Scholars Program',
      amount: 20000,
      type: 'need',
      requirements: ['Financial need', 'Academic potential', 'Desire to succeed', 'Participating in college readiness program', 'Demonstrated grit and potential'],
      renewable: true,
      deadline: 'December 1st',
      provider: 'Michael & Susan Dell Foundation',
      description: 'Supporting students who have overcome significant obstacles and demonstrated determination to succeed',
      applicationLink: 'https://www.dellscholars.org/scholarship/'
    },
    // Additional Merit-Based Scholarships
    {
      name: 'Samuel Huntington Public Service Award',
      amount: 30000,
      type: 'merit',
      requirements: ['Graduating college senior', 'Public service project proposal', 'Leadership experience', 'Community engagement'],
      renewable: false,
      deadline: 'January 17th',
      provider: 'Samuel Huntington Fund',
      description: 'Provides stipends to graduating college students to pursue public service projects anywhere in the world',
      applicationLink: 'https://www.samuelhuntington.info/'
    },
    {
      name: 'SAA Native American Scholarships',
      amount: 6000,
      type: 'academic',
      requirements: ['Native American heritage', 'Archaeology major or related field', 'Academic excellence', 'Community involvement'],
      renewable: true,
      deadline: 'January 31st',
      provider: 'Society for American Archaeology',
      description: 'Promoting cultural heritage preservation through supporting Native American students in archaeology studies',
      applicationLink: 'https://www.saa.org/career-practice/scholarships-grants'
    },
    {
      name: 'LAGRANT Foundation Graduate Scholarship',
      amount: 3750,
      type: 'merit',
      requirements: ['Graduate student', 'Advertising, marketing, or PR major', 'Minimum 3.0 GPA', 'Ethnic minority', 'U.S. citizen'],
      renewable: false,
      deadline: 'January 22nd',
      provider: 'The LAGRANT Foundation',
      description: 'Supporting minority students pursuing careers in advertising, marketing, and public relations',
      applicationLink: 'https://www.lagrantfoundation.org/Scholarship%20Program'
    },
    {
      name: 'LAGRANT Foundation Undergraduate Scholarship',
      amount: 2500,
      type: 'merit',
      requirements: ['Undergraduate student', 'Advertising, marketing, or PR major', 'Minimum 2.75 GPA', 'Ethnic minority', 'U.S. citizen'],
      renewable: false,
      deadline: 'January 22nd',
      provider: 'The LAGRANT Foundation',
      description: 'Empowering minority undergraduates in the communications field with financial support',
      applicationLink: 'https://www.lagrantfoundation.org/Scholarship%20Program'
    },
    {
      name: 'FIRST Scholarship (Rutgers)',
      amount: 5000,
      type: 'merit',
      requirements: ['FIRST Robotics participant', 'Enrolling at Rutgers University', 'STEM major', 'Leadership in robotics'],
      renewable: true,
      deadline: 'February 1st',
      provider: 'Rutgers University',
      description: 'Supporting FIRST Robotics Competition participants pursuing STEM education at Rutgers',
      applicationLink: 'https://www.rutgers.edu/admissions/scholarships'
    },
    {
      name: 'MacCauley Foundation Scholarship',
      amount: 10000,
      type: 'academic',
      requirements: ['Agriculture or animal science major', 'Sheep industry involvement', 'Academic achievement', 'Leadership'],
      renewable: true,
      deadline: 'February 1st',
      provider: 'United Suffolk Sheep Association',
      description: 'Supporting students pursuing education in agriculture and animal sciences with sheep industry focus',
      applicationLink: 'https://u-s-s-a.org/'
    },
    {
      name: 'Antibodies-Online Life Science Scholarship',
      amount: 1000,
      type: 'academic',
      requirements: ['Life sciences major', 'Undergraduate or graduate student', 'Essay submission', 'Interest in research'],
      renewable: false,
      deadline: 'January 22nd',
      provider: 'Antibodies-Online.com',
      description: 'Supporting students pursuing careers in life sciences and biological research',
      applicationLink: 'https://www.antibodies-online.com/scholarship/'
    },
    // Additional Need-Based Scholarships
    {
      name: 'QuestBridge National College Match',
      amount: 100000,
      type: 'need',
      requirements: ['High-achieving low-income student', 'High school senior', 'Strong academics', 'Financial need', 'Leadership'],
      renewable: true,
      deadline: 'September 26th',
      provider: 'QuestBridge',
      description: 'Full four-year scholarships to top colleges for exceptional low-income students, covering tuition, room, and board',
      applicationLink: 'https://www.questbridge.org/high-school-students/national-college-match'
    },
    {
      name: 'Horatio Alger National Scholarship',
      amount: 25000,
      type: 'need',
      requirements: ['High school senior', 'Financial need (family income under $65,000)', 'Perseverance over adversity', 'Minimum 2.0 GPA', 'U.S. citizen'],
      renewable: false,
      deadline: 'October 25th',
      provider: 'Horatio Alger Association',
      description: 'Recognizing students who have faced and overcome great obstacles while maintaining strong character',
      applicationLink: 'https://scholars.horatioalger.org/scholarships/'
    },
    {
      name: 'Ron Brown Scholar Program',
      amount: 40000,
      type: 'need',
      requirements: ['African American high school senior', 'Strong academics', 'Community service', 'Leadership', 'Financial need'],
      renewable: true,
      deadline: 'January 9th',
      provider: 'Ron Brown Scholar Fund',
      description: 'Identifying and supporting community-minded African American high school seniors with leadership potential',
      applicationLink: 'https://www.ronbrown.org/apply'
    },
    {
      name: 'Hagan Scholarship',
      amount: 60000,
      type: 'need',
      requirements: ['High school senior', 'Financial need', 'Rural community', 'Minimum 3.5 GPA', 'Strong work ethic'],
      renewable: true,
      deadline: 'November 15th',
      provider: 'Hagan Scholarship Foundation',
      description: 'Helping high-achieving students from rural areas graduate college debt-free with comprehensive support',
      applicationLink: 'https://haganscholarships.org/'
    },
    {
      name: 'Washington College Grant',
      amount: 12000,
      type: 'need',
      requirements: ['Washington state resident', 'Financial need', 'Enrolled in eligible institution', 'U.S. citizen or eligible non-citizen'],
      renewable: true,
      deadline: 'Varies by college',
      provider: 'Washington Student Achievement Council',
      description: 'Free tuition for eligible Washington residents at public colleges and many private institutions',
      applicationLink: 'https://wsac.wa.gov/wcg'
    },
    {
      name: 'Cal Grant A',
      amount: 14312,
      type: 'need',
      requirements: ['California resident', 'Minimum 3.0 GPA', 'Financial need', 'Enrolled at eligible California institution'],
      renewable: true,
      deadline: 'March 2nd',
      provider: 'California Student Aid Commission',
      description: 'Tuition and fee award for California residents attending qualifying colleges and universities',
      applicationLink: 'https://www.csac.ca.gov/cal-grants'
    },
    {
      name: 'Florida Student Assistance Grant',
      amount: 2610,
      type: 'need',
      requirements: ['Florida resident', 'Financial need', 'Undergraduate student', 'Enrolled at eligible Florida institution'],
      renewable: true,
      deadline: 'May 15th (FAFSA)',
      provider: 'Florida Department of Education',
      description: 'Need-based grant for Florida undergraduate students at public and private institutions',
      applicationLink: 'https://www.floridastudentfinancialaidsg.org/SAPFSAG'
    },
    // Athletic Scholarships
    {
      name: 'NCAA Division I Athletic Scholarship',
      amount: 50000,
      type: 'athletic',
      requirements: ['High school athlete', 'NCAA eligibility', 'Academic requirements met', 'Athletic talent', 'Coach recruitment'],
      renewable: true,
      deadline: 'Varies by sport/school',
      provider: 'NCAA Member Institutions',
      description: 'Full or partial athletic scholarships for student-athletes competing at Division I universities',
      applicationLink: 'https://www.ncaa.org/sports/2014/10/6/scholarships.aspx'
    },
    {
      name: 'Women in Sports Scholarship',
      amount: 5000,
      type: 'athletic',
      requirements: ['Female athlete', 'High school senior', 'Athletic achievement', 'Academic excellence', 'Community involvement'],
      renewable: false,
      deadline: 'February 28th',
      provider: 'Women in Sports Foundation',
      description: 'Supporting female student-athletes who excel in sports and academics',
      applicationLink: 'https://www.womenssportsfoundation.org/'
    },
    // Academic/Departmental Scholarships
    {
      name: 'Barry Goldwater Scholarship',
      amount: 7500,
      type: 'academic',
      requirements: ['STEM major', 'Sophomore or junior', 'Research experience', 'Intent to pursue PhD', 'Minimum 3.0 GPA'],
      renewable: true,
      deadline: 'January 27th',
      provider: 'Barry Goldwater Scholarship Foundation',
      description: 'The premier undergraduate award for future scientists, mathematicians, and engineers',
      applicationLink: 'https://goldwaterscholarship.gov/'
    },
    {
      name: 'Truman Scholarship',
      amount: 30000,
      type: 'academic',
      requirements: ['Junior standing', 'Public service commitment', 'Leadership experience', 'Academic excellence', 'U.S. citizen'],
      renewable: false,
      deadline: 'February 1st',
      provider: 'Harry S. Truman Scholarship Foundation',
      description: 'For college juniors with exceptional leadership potential committed to careers in public service',
      applicationLink: 'https://www.truman.gov/'
    },
    {
      name: 'Udall Scholarship',
      amount: 7000,
      type: 'academic',
      requirements: ['Sophomore or junior', 'Environmental studies or Native American affairs', 'Leadership', 'Academic excellence'],
      renewable: false,
      deadline: 'March 1st',
      provider: 'Morris K. Udall Foundation',
      description: 'For students committed to careers in environment, sustainability, or Native American tribal policy',
      applicationLink: 'https://www.udall.gov/'
    },
    {
      name: 'Fulbright U.S. Student Program',
      amount: 50000,
      type: 'academic',
      requirements: ['Bachelor\'s degree by start date', 'U.S. citizen', 'Research or teaching project abroad', 'Language proficiency for host country'],
      renewable: false,
      deadline: 'October 10th',
      provider: 'U.S. Department of State',
      description: 'Provides grants for individually designed study/research projects or English teaching assistantships abroad',
      applicationLink: 'https://us.fulbrightonline.org/'
    },
    {
      name: 'Regeneron Science Talent Search',
      amount: 250000,
      type: 'merit',
      requirements: ['High school senior', 'Original research project', 'STEM focus', 'U.S. citizen or permanent resident'],
      renewable: false,
      deadline: 'November 9th',
      provider: 'Society for Science',
      description: 'The nation\'s oldest and most prestigious science and math competition for high school seniors',
      applicationLink: 'https://www.societyforscience.org/regeneron-sts/'
    },
    {
      name: 'Davidson Fellows Scholarship',
      amount: 50000,
      type: 'merit',
      requirements: ['Under 18 years old', 'Significant work in STEM, literature, or music', 'U.S. citizen or permanent resident'],
      renewable: false,
      deadline: 'February 12th',
      provider: 'Davidson Institute',
      description: 'Recognizing and supporting profoundly gifted young people who have completed significant work',
      applicationLink: 'https://www.davidsongifted.org/gifted-programs/fellows-scholarship/'
    }
  ];

  // Combine all scholarships
  const allScholarships = [
    ...universalScholarships,
    ...authenticScholarships.map(s => ({
      name: s.name,
      amount: s.amount,
      type: s.type as 'merit' | 'need' | 'athletic' | 'academic' | 'departmental',
      requirements: s.eligibilityRequirements || s.requirements || [],
      renewable: s.renewable,
      deadline: s.deadline,
      provider: s.provider,
      description: s.description,
      applicationLink: s.website || s.applicationLink
    }))
  ];

  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getScholarshipTypeColor = (type: string) => {
    switch (type) {
      case 'merit': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300';
      case 'need': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300';
      case 'athletic': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-300';
      case 'academic': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300';
      case 'departmental': return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const getFilteredScholarships = (scholarships: Scholarship[]) => {
    let filtered = scholarships;
    
    if (selectedType !== 'all') {
      filtered = filtered.filter(s => s.type === selectedType);
    }
    
    if (selectedProvider !== 'all') {
      filtered = filtered.filter(s => s.provider.toLowerCase().includes(selectedProvider.toLowerCase()));
    }
    
    if (minAmount) {
      filtered = filtered.filter(s => s.amount >= parseInt(minAmount));
    }
    
    if (renewableOnly) {
      filtered = filtered.filter(s => s.renewable);
    }
    
    if (searchTerm) {
      filtered = filtered.filter(s => 
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.requirements.some(req => req.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    // "Matched to me" filter — intersect by normalized name (the same key
    // the per-card match-reason chips use), so the toggle and the chips
    // agree on what counts as a match.
    if (matchedOnly && hasMatches) {
      filtered = filtered.filter(s => reasonsByName.has(s.name.trim().toLowerCase()));
    }

    return filtered.sort((a, b) => b.amount - a.amount);
  };

  const getScholarshipTypes = () => {
    return Array.from(new Set(allScholarships.map(s => s.type)));
  };

  const getProviders = () => {
    return Array.from(new Set(allScholarships.map(s => s.provider))).slice(0, 10);
  };

  // Combine and filter all scholarships
  const filteredAllScholarships = getFilteredScholarships(allScholarships);
  
  // Pagination helpers
  const totalPages = Math.ceil(filteredAllScholarships.length / ITEMS_PER_PAGE);
  const paginatedScholarships = filteredAllScholarships.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset page when filters change
  const handleFilterChange = (setter: (val: string) => void, value: string) => {
    setter(value);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 w-full overflow-x-hidden">
      <div className="w-full max-w-4xl mx-auto px-3 py-4">
        {/* Clean Header */}
        <div className="mb-6">
          <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-gray-100 mb-1">
            Scholarships
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Find financial aid opportunities that match your qualifications
          </p>
        </div>

        {/* Compact Stats Bar */}
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg p-3 mb-4 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="text-center flex-1">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">{allScholarships.length}</div>
            <div className="text-xs text-gray-500">Available</div>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
          <div className="text-center flex-1">
            <div className="text-lg font-bold text-green-600">{formatAmount(Math.max(...allScholarships.map(s => s.amount)))}</div>
            <div className="text-xs text-gray-500">Up to</div>
          </div>
          <div className="w-px h-8 bg-gray-200 dark:bg-gray-700"></div>
          <div className="text-center flex-1">
            <div className="text-lg font-bold text-blue-600">{allScholarships.filter(s => s.renewable).length}</div>
            <div className="text-xs text-gray-500">Renewable</div>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <Input
            placeholder="Search scholarships..."
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            className="pl-9 h-10 bg-white dark:bg-gray-800"
          />
        </div>

        {/* Filters Row */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
          <Select value={selectedType} onValueChange={(v) => handleFilterChange(setSelectedType, v)}>
            <SelectTrigger className="w-auto min-w-[100px] h-9 text-sm bg-white dark:bg-gray-800">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {getScholarshipTypes().map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedProvider} onValueChange={(v) => handleFilterChange(setSelectedProvider, v)}>
            <SelectTrigger className="w-auto min-w-[100px] h-9 text-sm bg-white dark:bg-gray-800">
              <SelectValue placeholder="Provider" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Providers</SelectItem>
              {getProviders().map(provider => (
                <SelectItem key={provider} value={provider}>{provider}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Input
            placeholder="Min $"
            value={minAmount}
            onChange={(e) => { setMinAmount(e.target.value); setCurrentPage(1); }}
            type="number"
            className="w-24 h-9 text-sm bg-white dark:bg-gray-800"
          />
        </div>

        {/* "Matched to me" pill — mirrors the just-shipped college search and
            mobile Scholarships tab. Hidden for signed-out users and any case
            with zero personalized recommendations, so the toggle never has a
            chance to render an empty list by accident. */}
        <MatchedOnlyToggle
          hasMatches={hasMatches}
          active={matchedOnly}
          onToggle={() => { setMatchedOnly((v) => !v); setCurrentPage(1); }}
          testId="button-matched-to-me-scholarships"
          containerClassName="flex flex-wrap gap-2 mb-4"
        />

        {/* For You - Personalized Recommendations */}
        {user && recommendations.length > 0 && showForYou && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <Star className="h-5 w-5 text-yellow-500" />
                For You
              </h2>
              <Button variant="ghost" size="sm" onClick={() => setShowForYou(false)} className="text-xs">
                Hide
              </Button>
            </div>
            <div className="space-y-3">
              {recommendations.slice(0, 3).map((rec, idx) => {
                const recIsSaved = isScholarshipSavedLookup(savedKeys, rec.scholarship);
                return (
                <Card key={idx} className="border-l-4 border-l-yellow-500 bg-yellow-50 dark:bg-yellow-900/10">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <h3 className="font-medium text-sm truncate">{rec.scholarship.name}</h3>
                          {recIsSaved && <SavedBadge />}
                          <Badge className="bg-green-100 text-green-800 text-xs shrink-0">
                            {rec.matchScore}% Match
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-600 dark:text-gray-400 truncate">{rec.scholarship.provider}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-lg font-bold text-green-600">{formatAmount(rec.scholarship.amount)}</div>
                        {(() => {
                          const link = (rec.scholarship as { applicationLink?: string; website?: string }).applicationLink
                            || (rec.scholarship as { applicationLink?: string; website?: string }).website
                            || '';
                          return link ? (
                            <Button asChild size="sm" className="mt-1 h-7 text-xs">
                              <a href={link} target="_blank" rel="noopener noreferrer">
                                Apply
                              </a>
                            </Button>
                          ) : (
                            <Button size="sm" className="mt-1 h-7 text-xs" disabled title="No application link available">
                              Apply
                            </Button>
                          );
                        })()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
                );
              })}
            </div>
          </div>
        )}

        {/* Pagination Header */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mb-4 bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="h-8"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="h-8"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Empty-state hint when the "Matched to me" toggle removes every
            result — mirrors the college search "None of these results
            overlap…" copy so users know how to recover. */}
        <MatchedOnlyEmptyHint
          visible={matchedOnly && hasMatches && allScholarships.length > 0 && filteredAllScholarships.length === 0}
          cardClassName="mb-4"
        />

        {/* Scholarship List */}
        <div>
          {paginatedScholarships.length > 0 ? (
            <div className="space-y-4">
              {paginatedScholarships.map((scholarship, index) => {
                const schIsSaved = isScholarshipSavedLookup(savedKeys, scholarship);
                return (
                <Card 
                  key={index} 
                  className="hover:shadow-lg transition-shadow border-l-4 border-l-indigo-500 overflow-hidden"
                  data-testid={`scholarship-card-${index}`}
                >
                  <CardHeader className="pb-3 px-3 sm:px-6">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <CardTitle className="text-base sm:text-lg leading-tight">{scholarship.name}</CardTitle>
                        {schIsSaved && <SavedBadge />}
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="capitalize text-xs">
                          {scholarship.type}
                        </Badge>
                        {scholarship.renewable && (
                          <Badge className="bg-blue-100 text-blue-800 text-xs">Renewable</Badge>
                        )}
                      </div>
                      <CardDescription className="flex items-center gap-1 text-xs">
                        <Building className="h-3 w-3 flex-shrink-0" />
                        <span className="truncate">{scholarship.provider}</span>
                      </CardDescription>
                      <div className="text-xl font-bold text-green-600">
                        {formatAmount(scholarship.amount)}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 sm:px-6 pt-0">
                    <MatchReasonChips
                      reasons={reasonsByName.get(scholarship.name.trim().toLowerCase())}
                      className="flex flex-wrap gap-1.5 mb-3"
                      testId="scholarship-match-reasons"
                    />
                    {scholarship.description && (
                      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">{scholarship.description}</p>
                    )}

                    <div className="space-y-3 mb-3">
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                          Requirements
                        </h4>
                        <ul className="space-y-0.5">
                          {scholarship.requirements.slice(0, 3).map((req, idx) => (
                            <li key={idx} className="text-xs text-gray-600 dark:text-gray-300">
                              • {req}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="text-sm font-medium text-gray-600">
                        Deadline: {scholarship.deadline}
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-t pt-3">
                      <div className="text-xs text-gray-500 truncate">
                        {scholarship.provider}
                      </div>

                      {(() => {
                        const link = scholarship.applicationLink
                          || (scholarship as { website?: string }).website
                          || '';
                        return link ? (
                          <Button asChild size="sm" data-testid={`apply-scholarship-${index}`}>
                            <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                              Apply Now
                              <ExternalLink className="h-4 w-4" />
                            </a>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            disabled
                            title="No application link available"
                            data-testid={`apply-scholarship-${index}`}
                            className="flex items-center gap-1"
                          >
                            Apply Now
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
                );
              })}

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="text-sm text-gray-500">
                    Page {currentPage} of {totalPages} ({filteredAllScholarships.length} total)
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Prev
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-12">
              <Award className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">No Scholarships Found</h3>
              <p className="text-gray-600 dark:text-gray-300">Try adjusting your search or filters.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScholarshipCard({ scholarship, isCompact = false }: { scholarship: Scholarship; isCompact?: boolean }) {
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD',
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getScholarshipTypeColor = (type: string) => {
    switch (type) {
      case 'merit': case 'merit-based': return 'bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900 dark:text-blue-300';
      case 'need': case 'need-based': return 'bg-green-100 text-green-800 border-green-200 dark:bg-green-900 dark:text-green-300';
      case 'athletic': return 'bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900 dark:text-orange-300';
      case 'academic': return 'bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900 dark:text-purple-300';
      case 'departmental': return 'bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-900 dark:text-indigo-300';
      case 'service-based': return 'bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900 dark:text-teal-300';
      case 'diversity': return 'bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900 dark:text-pink-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-700 dark:text-gray-300';
    }
  };

  const requirements = scholarship.requirements || scholarship.eligibilityRequirements || [];
  const applicationLink = scholarship.applicationLink || scholarship.website;

  if (isCompact) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4 border-t">
        <div>
          <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            Requirements
          </h4>
          <div className="space-y-1">
            {requirements.slice(0, 4).map((req, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                {req}
              </div>
            ))}
          </div>
        </div>
        
        {applicationLink && (
          <div className="flex items-center justify-center lg:justify-end">
            <Button 
              asChild
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
            >
              <a 
                href={applicationLink} 
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
    );
  }

  return (
    <Card className="border-l-4 border-l-yellow-500 hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-gray-100 mb-2">
              {scholarship.name}
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-3">{scholarship.description}</p>
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
                <Building className="h-3 w-3 mr-1" />
                {scholarship.provider}
              </Badge>
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-600 mb-1">
              {formatAmount(scholarship.amount)}
            </div>
            <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
              <Calendar className="h-3 w-3" />
              Due: {scholarship.deadline}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500" />
              Requirements
            </h4>
            <div className="space-y-1">
              {requirements.map((req, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                  <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                  {req}
                </div>
              ))}
            </div>
          </div>
          
          {applicationLink && (
            <div className="flex items-center justify-center lg:justify-end">
              <Button 
                asChild
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2"
              >
                <a 
                  href={applicationLink} 
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
  );
}