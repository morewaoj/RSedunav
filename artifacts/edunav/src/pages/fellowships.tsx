import { useState } from 'react';
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
  Search,
  Star,
  DollarSign,
  ExternalLink,
  Target,
  Users,
  Building,
  Clock,
  Bookmark,
  BookmarkCheck,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Briefcase,
  Globe,
  Sparkles,
  ArrowLeft
} from 'lucide-react';
import { useAuth } from "@/hooks/use-auth.js";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";
import Navbar from "@/components/navbar";
import {
  clearPendingFellowshipSave,
  readPendingFellowshipSave,
  writePendingFellowshipSave,
} from "@/components/saved-plan-button";
import { useResumePendingSave } from "@/hooks/use-resume-pending-save";

interface Fellowship {
  id: number;
  name: string;
  provider: string;
  type: string;
  category?: string;
  amount: number;
  amountType?: string;
  duration?: string;
  deadline?: string;
  website?: string;
  description?: string;
  eligibilityRequirements: string[];
  targetDemographics: string[];
  applicationRequirements: string[];
  fields?: string[];
  academicLevel?: string[];
  citizenshipRequirements?: string[];
  minGpa?: number;
  benefits?: string[];
  renewable?: boolean;
  competitive?: string;
  isActive?: boolean;
}

interface FellowshipMatch {
  fellowship: Fellowship;
  matchScore: number;
  matchReasons: string[];
}

const ITEMS_PER_PAGE = 6;

export default function Fellowships() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');

  const { data: fellowships = [], isLoading: isLoadingFellowships } = useQuery<Fellowship[]>({
    queryKey: ['/api/fellowships'],
  });

  const { data: savedFellowships = [], isLoading: isLoadingSavedFellowships } = useQuery<any[]>({
    queryKey: ['/api/fellowships/saved'],
    enabled: !!user,
  });

  // /api/fellowships/match requires auth and reads the signed-in user's
  // actual stored profile server-side — was previously calling
  // /api/fellowships/match-public with a hardcoded fake profile (GPA 3.5,
  // "Technology, Research", graduate), so every user got the same
  // fictional person's matches regardless of who they actually were.
  const { data: matchedFellowships, isLoading: isLoadingMatches } = useQuery<{ matches: FellowshipMatch[] }>({
    queryKey: ['/api/fellowships/match', user?.id],
    queryFn: async () => {
      const response = await apiRequest('POST', '/api/fellowships/match', {});
      return response.json();
    },
    enabled: activeTab === 'for-you' && !!user,
  });

  const saveFellowshipMutation = useMutation({
    mutationFn: async (fellowshipId: number) => {
      const response = await apiRequest('POST', `/api/fellowships/${fellowshipId}/save`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fellowships/saved'] });
      toast({
        title: "Fellowship Saved",
        description: "Added to your saved fellowships.",
      });
    },
    onError: (e) => {
      toast({
        title: "Couldn't save fellowship",
        description: e instanceof Error ? e.message : "Please try again.",
        variant: "destructive"
      });
    }
  });

  const unsaveFellowshipMutation = useMutation({
    mutationFn: async (fellowshipId: number) => {
      const response = await apiRequest('DELETE', `/api/fellowships/${fellowshipId}/save`, {});
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/fellowships/saved'] });
      toast({
        title: "Fellowship Removed",
        description: "Removed from your saved fellowships.",
      });
    }
  });

  const isFellowshipSaved = (fellowshipId: number) => {
    return savedFellowships.some((s: any) => s.fellowshipId === fellowshipId);
  };

  const handleSaveToggle = (fellowship: Fellowship) => {
    if (isFellowshipSaved(fellowship.id)) {
      unsaveFellowshipMutation.mutate(fellowship.id);
      return;
    }
    // Match the careers/colleges/scholarships flow: instead of toasting
    // an error and dropping the click on the floor, queue the user's
    // pending intent and bounce them through /auth so we can finish the
    // save automatically once they're signed in.
    if (!user) {
      writePendingFellowshipSave({
        fellowshipId: fellowship.id,
        label: fellowship.name,
      });
      navigate(`/auth?redirect=${encodeURIComponent("/fellowships")}`);
      return;
    }
    saveFellowshipMutation.mutate(fellowship.id);
  };

  // Once the user comes back from /auth (or signs in any other way),
  // pick up the pending fellowship save and finish it automatically so
  // they don't have to find the same card and tap Save a second time.
  // The shared hook handles the ref guard + the wait for the saved
  // fellowships query so this stays in lock-step with every other Save
  // surface (colleges / careers / scholarships in SavedPlanButton).
  useResumePendingSave({
    enabled: !!user,
    isReady: !isLoadingSavedFellowships,
    readIntent: readPendingFellowshipSave,
    clearIntent: clearPendingFellowshipSave,
    isAlreadySaved: (intent) => isFellowshipSaved(intent.fellowshipId),
    onResume: (intent) => saveFellowshipMutation.mutate(intent.fellowshipId),
  });

  const filteredFellowships = fellowships.filter(fellowship => {
    const matchesSearch = searchTerm === '' || 
      fellowship.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fellowship.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fellowship.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      fellowship.fields?.some(f => f.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'all' || fellowship.category === selectedCategory;
    const matchesType = selectedType === 'all' || fellowship.type === selectedType;
    const matchesLevel = selectedLevel === 'all' || 
      fellowship.academicLevel?.includes(selectedLevel);

    return matchesSearch && matchesCategory && matchesType && matchesLevel;
  });

  const totalPages = Math.ceil(filteredFellowships.length / ITEMS_PER_PAGE);
  const paginatedFellowships = filteredFellowships.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  const getCategoryColor = (category?: string) => {
    const colors: Record<string, string> = {
      'STEM': 'bg-blue-100 text-blue-800',
      'humanities': 'bg-purple-100 text-purple-800',
      'social-sciences': 'bg-green-100 text-green-800',
      'arts': 'bg-pink-100 text-pink-800',
      'interdisciplinary': 'bg-amber-100 text-amber-800'
    };
    return colors[category || ''] || 'bg-gray-100 text-gray-800';
  };

  const getCompetitivenessColor = (competitive?: string) => {
    const colors: Record<string, string> = {
      'very-high': 'bg-red-100 text-red-800',
      'high': 'bg-orange-100 text-orange-800',
      'moderate': 'bg-green-100 text-green-800'
    };
    return colors[competitive || ''] || 'bg-gray-100 text-gray-800';
  };

  const formatAmount = (amount: number, amountType?: string) => {
    if (amountType === 'full-support') {
      return `$${amount.toLocaleString()}+ (Full Support)`;
    }
    return `$${amount.toLocaleString()}`;
  };

  const FellowshipCard = ({ fellowship, matchScore, matchReasons }: { 
    fellowship: Fellowship; 
    matchScore?: number; 
    matchReasons?: string[];
  }) => (
    <Card className="hover:shadow-lg transition-all duration-300 border-l-4 border-l-primary/50">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-2">
          <div className="flex-1">
            <CardTitle className="text-lg font-semibold line-clamp-2">
              {fellowship.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <Building className="h-4 w-4" />
              {fellowship.provider}
            </CardDescription>
          </div>
          <div className="flex flex-col items-end gap-2">
            {matchScore !== undefined && (
              <Badge className="bg-green-500 text-white">
                {matchScore}% Match
              </Badge>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => handleSaveToggle(fellowship)}
              className={isFellowshipSaved(fellowship.id) ? "text-yellow-500" : "text-gray-400"}
            >
              {isFellowshipSaved(fellowship.id) ? (
                <BookmarkCheck className="h-5 w-5" />
              ) : (
                <Bookmark className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge className={getCategoryColor(fellowship.category)}>
            {fellowship.category || 'General'}
          </Badge>
          <Badge variant="outline" className="capitalize">
            {fellowship.type}
          </Badge>
          {fellowship.competitive && (
            <Badge className={getCompetitivenessColor(fellowship.competitive)}>
              {fellowship.competitive.replace('-', ' ')} competition
            </Badge>
          )}
        </div>

        <p className="text-sm text-muted-foreground line-clamp-3">
          {fellowship.description}
        </p>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <span className="font-medium">{formatAmount(fellowship.amount, fellowship.amountType)}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            <span>{fellowship.duration || 'Varies'}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-orange-600" />
            <span>{fellowship.deadline || 'See website'}</span>
          </div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-4 w-4 text-purple-600" />
            <span className="capitalize">{fellowship.academicLevel?.join(', ') || 'Graduate'}</span>
          </div>
        </div>

        {fellowship.minGpa && (
          <div className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-indigo-600" />
            <span>Minimum GPA: {fellowship.minGpa}</span>
          </div>
        )}

        {matchReasons && matchReasons.length > 0 && (
          <div className="bg-green-50 rounded-lg p-3 space-y-1">
            <p className="text-xs font-medium text-green-800">Why this matches you:</p>
            {matchReasons.slice(0, 3).map((reason, i) => (
              <p key={i} className="text-xs text-green-700 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> {reason}
              </p>
            ))}
          </div>
        )}

        {fellowship.benefits && fellowship.benefits.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground">Benefits:</p>
            <div className="flex flex-wrap gap-1">
              {fellowship.benefits.slice(0, 4).map((benefit, i) => (
                <Badge key={i} variant="secondary" className="text-xs">
                  {benefit}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          {fellowship.website && (
            <Button 
              className="flex-1"
              onClick={() => window.open(fellowship.website, '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Apply Now
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <Navbar />
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Link href="/">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <Award className="h-8 w-8 text-primary" />
              Fellowships
            </h1>
            <p className="text-gray-600 mt-1">
              Discover prestigious fellowships for graduate study and research
            </p>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full max-w-md grid-cols-3">
            <TabsTrigger value="all" className="flex items-center gap-2">
              <Globe className="h-4 w-4" />
              All Fellowships
            </TabsTrigger>
            <TabsTrigger value="for-you" className="flex items-center gap-2">
              <Target className="h-4 w-4" />
              For You
            </TabsTrigger>
            <TabsTrigger value="saved" className="flex items-center gap-2">
              <Bookmark className="h-4 w-4" />
              Saved
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="space-y-6">
            <Card className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search fellowships..."
                    value={searchTerm}
                    onChange={(e) => {
                      setSearchTerm(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="pl-10"
                  />
                </div>
                <Select value={selectedCategory} onValueChange={(v) => { setSelectedCategory(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    <SelectItem value="STEM">STEM</SelectItem>
                    <SelectItem value="humanities">Humanities</SelectItem>
                    <SelectItem value="social-sciences">Social Sciences</SelectItem>
                    <SelectItem value="arts">Arts</SelectItem>
                    <SelectItem value="interdisciplinary">Interdisciplinary</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedType} onValueChange={(v) => { setSelectedType(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="research">Research</SelectItem>
                    <SelectItem value="academic">Academic</SelectItem>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="dissertation">Dissertation</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={selectedLevel} onValueChange={(v) => { setSelectedLevel(v); setCurrentPage(1); }}>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Academic Level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Levels</SelectItem>
                    <SelectItem value="undergraduate">Undergraduate</SelectItem>
                    <SelectItem value="graduate">Graduate</SelectItem>
                    <SelectItem value="masters">Masters</SelectItem>
                    <SelectItem value="doctoral">Doctoral</SelectItem>
                    <SelectItem value="postdoc">Postdoc</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </Card>

            {isLoadingFellowships ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-gray-200 rounded w-3/4" />
                      <div className="h-4 bg-gray-200 rounded w-1/2 mt-2" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded" />
                        <div className="h-4 bg-gray-200 rounded w-5/6" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                <div className="flex justify-between items-center">
                  <p className="text-sm text-muted-foreground">
                    Showing {paginatedFellowships.length} of {filteredFellowships.length} fellowships
                  </p>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {paginatedFellowships.map(fellowship => (
                    <FellowshipCard key={fellowship.id} fellowship={fellowship} />
                  ))}
                </div>

                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-8">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="for-you" className="space-y-6">
            <Card className="p-6 bg-gradient-to-r from-primary/5 to-primary/10">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-primary/20 rounded-full">
                  <Target className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg">Personalized Fellowship Matches</h3>
                  <p className="text-sm text-muted-foreground">
                    Fellowships matched to your profile, interests, and academic goals
                  </p>
                </div>
              </div>
            </Card>

            {!user ? (
              <Card className="p-8 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Sign In for Personalized Matches</h3>
                <p className="text-muted-foreground mb-4">
                  Create an account so we can match fellowships to your actual profile
                </p>
                <Link href="/auth">
                  <Button>Sign In</Button>
                </Link>
              </Card>
            ) : isLoadingMatches ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {[1, 2, 3].map(i => (
                  <Card key={i} className="animate-pulse">
                    <CardHeader>
                      <div className="h-6 bg-gray-200 rounded w-3/4" />
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="h-4 bg-gray-200 rounded" />
                        <div className="h-4 bg-gray-200 rounded w-5/6" />
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : matchedFellowships?.matches && matchedFellowships.matches.length > 0 ? (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {matchedFellowships.matches.map(match => (
                  <FellowshipCard 
                    key={match.fellowship.id} 
                    fellowship={match.fellowship}
                    matchScore={match.matchScore}
                    matchReasons={match.matchReasons}
                  />
                ))}
              </div>
            ) : (
              <Card className="p-8 text-center">
                <Target className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Complete Your Profile</h3>
                <p className="text-muted-foreground mb-4">
                  Add your interests, GPA, and academic level to get personalized fellowship recommendations
                </p>
                <Link href="/profile">
                  <Button>Update Profile</Button>
                </Link>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="saved" className="space-y-6">
            {!user ? (
              <Card className="p-8 text-center">
                <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">Sign In to Save Fellowships</h3>
                <p className="text-muted-foreground mb-4">
                  Create an account to save fellowships and track your applications
                </p>
                <Link href="/auth">
                  <Button>Sign In</Button>
                </Link>
              </Card>
            ) : savedFellowships.length === 0 ? (
              <Card className="p-8 text-center">
                <Bookmark className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-semibold text-lg mb-2">No Saved Fellowships</h3>
                <p className="text-muted-foreground mb-4">
                  Browse fellowships and click the bookmark icon to save them here
                </p>
                <Button onClick={() => setActiveTab('all')}>
                  Browse Fellowships
                </Button>
              </Card>
            ) : (
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {savedFellowships.map((saved: any) => 
                  saved.fellowship && (
                    <FellowshipCard 
                      key={saved.id} 
                      fellowship={saved.fellowship}
                    />
                  )
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
