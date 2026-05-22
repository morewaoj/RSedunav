import { useQuery } from '@tanstack/react-query';
import { useRoute } from 'wouter';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DollarSign, ExternalLink, School, Award } from 'lucide-react';
import { Link } from 'wouter';
import { SavedBadge } from '@/components/saved-badge';
import { isScholarshipSaved, useSavedItems } from '@/hooks/use-saved-items';

interface Scholarship {
  id?: number;
  name: string;
  amount: string;
  description?: string;
  eligibility?: string;
  deadline?: string;
  website?: string;
  type?: string;
}

interface College {
  id: number;
  name: string;
  location: string;
  state: string;
}

export default function CollegeScholarships() {
  const [match, params] = useRoute('/college/:id/scholarships');
  const collegeId = params?.id;

  const { data: college, isLoading: collegeLoading } = useQuery<College>({
    queryKey: ['/api/colleges', collegeId],
    queryFn: async () => {
      const res = await fetch(`/api/colleges/${collegeId}`);
      if (!res.ok) throw new Error('Failed to fetch college');
      return res.json();
    },
    enabled: !!collegeId,
  });

  const { data: scholarships = [], isLoading: scholarshipsLoading } = useQuery<Scholarship[]>({
    queryKey: ['/api/colleges', collegeId, 'scholarships'],
    queryFn: async () => {
      const res = await fetch(`/api/colleges/${collegeId}/scholarships`);
      if (!res.ok) throw new Error('Failed to fetch scholarships');
      return res.json();
    },
    enabled: !!collegeId,
  });

  const isLoading = collegeLoading || scholarshipsLoading;
  const { keys: savedKeys } = useSavedItems();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading scholarships...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button asChild variant="outline" className="mb-4">
            <Link href={`/college/${collegeId}`}>← Back to College Details</Link>
          </Button>
          
          {college && (
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Scholarships at {college.name}
              </h1>
              <p className="text-lg text-gray-600">{college.location}</p>
            </div>
          )}
        </div>

        {/* Scholarships List */}
        {scholarships.length > 0 ? (
          <div className="space-y-6">
            {scholarships.map((scholarship, index) => {
              const isSaved = isScholarshipSaved(savedKeys, scholarship);
              return (
              <Card key={scholarship.id || index} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-2">
                        <h3 className="text-xl font-semibold text-gray-900">
                          {scholarship.name}
                        </h3>
                        {isSaved && <SavedBadge />}
                      </div>
                      <div className="flex items-center gap-2 mb-3">
                        <Badge variant="secondary" className="flex items-center gap-1">
                          <DollarSign className="h-3 w-3" />
                          {scholarship.amount}
                        </Badge>
                        {scholarship.type && (
                          <Badge variant="outline">{scholarship.type}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {scholarship.description && (
                    <p className="text-gray-600 mb-4">{scholarship.description}</p>
                  )}

                  {scholarship.eligibility && (
                    <div className="mb-4">
                      <h4 className="font-medium text-gray-900 mb-2">Eligibility Requirements:</h4>
                      <p className="text-sm text-gray-600">{scholarship.eligibility}</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    {scholarship.deadline && (
                      <div className="text-sm text-gray-600">
                        <span className="font-medium">Deadline:</span> {scholarship.deadline}
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      {scholarship.website && (
                        <Button asChild size="sm">
                          <a href={scholarship.website} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="h-4 w-4 mr-2" />
                            Apply Now
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <DollarSign className="h-16 w-16 mx-auto mb-4 opacity-50" />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Scholarships Available</h3>
            <p className="text-gray-600 max-w-md mx-auto mb-6">
              This college doesn't have specific scholarships listed yet. Check our comprehensive scholarship database for opportunities that may apply.
            </p>
            <Button asChild>
              <Link href="/scholarships">Browse All Scholarships</Link>
            </Button>
          </div>
        )}

        {/* Additional Resources */}
        <Card className="mt-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Additional Resources</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button asChild variant="outline" className="h-auto p-4 text-left">
                <Link href="/scholarships">
                  <div>
                    <div className="font-medium">General Scholarships</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Browse 50+ scholarships available to all students
                    </div>
                  </div>
                </Link>
              </Button>
              
              <Button asChild variant="outline" className="h-auto p-4 text-left">
                <Link href="/profile">
                  <div>
                    <div className="font-medium">Get Personalized Matches</div>
                    <div className="text-sm text-gray-600 mt-1">
                      Complete your profile for tailored scholarship recommendations
                    </div>
                  </div>
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}