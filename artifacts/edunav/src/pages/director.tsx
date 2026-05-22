import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useAppliedStyle } from "@/hooks/use-applied-style";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Users, 
  Briefcase, 
  DollarSign, 
  TrendingUp,
  Search,
  ChevronDown,
  ChevronUp,
  School,
  Award,
  BookOpen
} from "lucide-react";
import Navbar from "@/components/navbar";

interface UserSelection {
  id: string;
  username: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  gpa: number | null;
  major: string | null;
  state: string | null;
  academicLevel: string | null;
  interests: string[] | null;
  demographics: string[] | null;
  profileCompleteness: number | null;
  createdAt: string | null;
  savedColleges: number;
  savedCareers: number;
  savedScholarships: number;
  savedFellowships: number;
  selections: {
    colleges: any[];
    careers: any[];
    scholarships: any[];
    fellowships: any[];
  };
}

function InterestBar({ percent }: { percent: number }) {
  const ref = useAppliedStyle<HTMLDivElement>({ width: `${percent}%` });
  return (
    <div
      ref={ref}
      className="bg-blue-600 h-full rounded-full transition-all"
    />
  );
}

interface AdminStats {
  overview: {
    totalUsers: number;
    totalColleges: number;
    totalCareers: number;
    totalScholarships: number;
  };
  popularColleges: { name: string; saveCount: number }[];
  popularCareers: { title: string; saveCount: number }[];
  topInterests: { interest: string; count: number }[];
}

export default function DirectorDashboard() {
  const { user, isLoading: authLoading } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);

  const { data: usersData, isLoading: usersLoading, error: usersError } = useQuery<{ totalUsers: number; users: UserSelection[] }>({
    queryKey: ["/api/admin/users"],
    enabled: !!user,
  });

  const { data: statsData, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    enabled: !!user,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Director Access Required</h1>
          <p className="text-gray-600">Please log in with director credentials to access this page.</p>
        </div>
      </div>
    );
  }

  if (usersError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
          <p className="text-gray-600">You do not have permission to view this page. Director access is required.</p>
        </div>
      </div>
    );
  }

  const filteredUsers = usersData?.users.filter(u => 
    u.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.major?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.state?.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const toggleUserExpand = (userId: string) => {
    setExpandedUser(expandedUser === userId ? null : userId);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Director Dashboard</h1>
          <p className="text-gray-600 mt-2">Monitor student activity and see what careers and colleges your students are interested in.</p>
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students ({usersData?.totalUsers || 0})</TabsTrigger>
            <TabsTrigger value="trends">Trends</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {statsLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[...Array(4)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-16 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-100 rounded-full">
                          <Users className="h-6 w-6 text-blue-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Total Students</p>
                          <p className="text-2xl font-bold">{statsData?.overview.totalUsers || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-100 rounded-full">
                          <School className="h-6 w-6 text-green-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Colleges Available</p>
                          <p className="text-2xl font-bold">{statsData?.overview.totalColleges?.toLocaleString() || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-purple-100 rounded-full">
                          <Briefcase className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Careers Tracked</p>
                          <p className="text-2xl font-bold">{statsData?.overview.totalCareers || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-100 rounded-full">
                          <Award className="h-6 w-6 text-yellow-600" />
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Scholarships</p>
                          <p className="text-2xl font-bold">{statsData?.overview.totalScholarships || 0}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-blue-600" />
                        Most Popular Colleges
                      </CardTitle>
                      <CardDescription>Colleges students are saving most</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {statsData?.popularColleges && statsData.popularColleges.length > 0 ? (
                        <div className="space-y-3">
                          {statsData.popularColleges.slice(0, 5).map((college, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-sm font-medium">{college.name}</span>
                              <Badge variant="secondary">{college.saveCount} saves</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No data yet</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Briefcase className="h-5 w-5 text-purple-600" />
                        Most Popular Careers
                      </CardTitle>
                      <CardDescription>Careers students are most interested in</CardDescription>
                    </CardHeader>
                    <CardContent>
                      {statsData?.popularCareers && statsData.popularCareers.length > 0 ? (
                        <div className="space-y-3">
                          {statsData.popularCareers.slice(0, 5).map((career, i) => (
                            <div key={i} className="flex items-center justify-between">
                              <span className="text-sm font-medium">{career.title}</span>
                              <Badge variant="secondary">{career.saveCount} saves</Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-gray-500 text-sm">No data yet</p>
                      )}
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-green-600" />
                      Top Student Interests
                    </CardTitle>
                    <CardDescription>Most common interests across all students</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {statsData?.topInterests && statsData.topInterests.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {statsData.topInterests.map((item, i) => (
                          <Badge key={i} variant="outline" className="px-3 py-1">
                            {item.interest} ({item.count})
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-sm">No data yet</p>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </TabsContent>

          <TabsContent value="students" className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search by name, major, or state..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Badge variant="secondary" className="text-sm">
                {filteredUsers.length} students
              </Badge>
            </div>

            {usersLoading ? (
              <div className="space-y-4">
                {[...Array(5)].map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-6">
                      <div className="h-20 bg-gray-200 rounded"></div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredUsers.map((student) => (
                  <Card key={student.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div 
                        className="p-4 cursor-pointer hover:bg-gray-50 transition-colors"
                        onClick={() => toggleUserExpand(student.id)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 font-semibold">
                                {(student.firstName?.[0] || student.username?.[0] || '?').toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <h3 className="font-semibold text-gray-900">
                                {student.firstName && student.lastName 
                                  ? `${student.firstName} ${student.lastName}` 
                                  : student.username}
                              </h3>
                              <div className="flex items-center gap-2 text-sm text-gray-500">
                                {student.major && <span>{student.major}</span>}
                                {student.major && student.state && <span>•</span>}
                                {student.state && <span>{student.state}</span>}
                                {student.gpa && (
                                  <>
                                    <span>•</span>
                                    <span>GPA: {student.gpa.toFixed(2)}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-4">
                            <div className="flex gap-2">
                              <Badge variant="outline" className="flex items-center gap-1">
                                <School className="h-3 w-3" />
                                {student.savedColleges}
                              </Badge>
                              <Badge variant="outline" className="flex items-center gap-1">
                                <Briefcase className="h-3 w-3" />
                                {student.savedCareers}
                              </Badge>
                              <Badge variant="outline" className="flex items-center gap-1">
                                <DollarSign className="h-3 w-3" />
                                {student.savedScholarships}
                              </Badge>
                            </div>
                            {expandedUser === student.id ? (
                              <ChevronUp className="h-5 w-5 text-gray-400" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>

                      {expandedUser === student.id && (
                        <div className="border-t bg-gray-50 p-4">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                              <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <School className="h-4 w-4" />
                                Saved Colleges ({student.savedColleges})
                              </h4>
                              {student.selections.colleges.length > 0 ? (
                                <ul className="space-y-1 text-sm">
                                  {student.selections.colleges.slice(0, 5).map((c, i) => (
                                    <li key={i} className="text-gray-600">
                                      {c.collegeName || 'Unknown College'}
                                    </li>
                                  ))}
                                  {student.selections.colleges.length > 5 && (
                                    <li className="text-blue-600">+{student.selections.colleges.length - 5} more</li>
                                  )}
                                </ul>
                              ) : (
                                <p className="text-sm text-gray-400">None saved yet</p>
                              )}
                            </div>

                            <div>
                              <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Briefcase className="h-4 w-4" />
                                Saved Careers ({student.savedCareers})
                              </h4>
                              {student.selections.careers.length > 0 ? (
                                <ul className="space-y-1 text-sm">
                                  {student.selections.careers.slice(0, 5).map((c, i) => (
                                    <li key={i} className="text-gray-600">
                                      {c.careerTitle || 'Unknown Career'}
                                    </li>
                                  ))}
                                  {student.selections.careers.length > 5 && (
                                    <li className="text-blue-600">+{student.selections.careers.length - 5} more</li>
                                  )}
                                </ul>
                              ) : (
                                <p className="text-sm text-gray-400">None saved yet</p>
                              )}
                            </div>

                            <div>
                              <h4 className="font-medium text-gray-700 mb-2 flex items-center gap-2">
                                <Award className="h-4 w-4" />
                                Interests
                              </h4>
                              {student.interests && student.interests.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {student.interests.slice(0, 5).map((interest, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {interest}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-400">No interests set</p>
                              )}
                            </div>
                          </div>

                          {student.demographics && student.demographics.length > 0 && (
                            <div className="mt-4 pt-4 border-t">
                              <h4 className="font-medium text-gray-700 mb-2">Demographics</h4>
                              <div className="flex flex-wrap gap-1">
                                {student.demographics.map((demo, i) => (
                                  <Badge key={i} variant="outline" className="text-xs">
                                    {demo}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}

                {filteredUsers.length === 0 && (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                    <p className="text-gray-500">No students found matching your search.</p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trends" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Student Career Aspirations</CardTitle>
                <CardDescription>See where your students are headed</CardDescription>
              </CardHeader>
              <CardContent>
                {statsData?.topInterests && statsData.topInterests.length > 0 ? (
                  <div className="space-y-4">
                    {statsData.topInterests.map((item, i) => (
                      <div key={i} className="flex items-center gap-4">
                        <div className="w-32 text-sm font-medium text-gray-700">{item.interest}</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                          <InterestBar
                            percent={Math.min(
                              100,
                              (item.count /
                                (statsData.topInterests[0]?.count || 1)) *
                                100,
                            )}
                          />
                        </div>
                        <div className="w-12 text-sm text-gray-500 text-right">{item.count}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500">No trend data available yet.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
