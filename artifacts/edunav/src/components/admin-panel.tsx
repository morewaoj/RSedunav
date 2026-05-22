import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Database, Download, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { College } from "@shared/schema";

export default function AdminPanel() {
  const [loadingProgress, setLoadingProgress] = useState(0);
  const queryClient = useQueryClient();

  const { data: colleges } = useQuery<College[]>({
    queryKey: ["/api/colleges"],
  });

  const bulkLoadMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/bulk-load-colleges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to load colleges: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colleges"] });
      setLoadingProgress(100);
    },
    onError: (error) => {
      console.error("Bulk load error:", error);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/refresh-colleges", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new Error(`Failed to refresh colleges: ${response.statusText}`);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/colleges"] });
      setLoadingProgress(100);
    },
    onError: (error) => {
      console.error("Refresh error:", error);
    },
  });

  const handleBulkLoad = () => {
    setLoadingProgress(0);
    bulkLoadMutation.mutate();
  };

  const handleRefresh = () => {
    setLoadingProgress(0);
    refreshMutation.mutate();
  };

  const currentCount = colleges?.length || 0;
  const isLoading = bulkLoadMutation.isPending || refreshMutation.isPending;

  // Calculate college type distribution
  const collegeStats = colleges?.reduce((acc, college) => {
    acc.total++;
    if (college.academicLevel === 'associate') acc.community++;
    if (college.type === 'public') acc.public++;
    if (college.type === 'private') acc.private++;
    return acc;
  }, { total: 0, community: 0, public: 0, private: 0 }) || { total: 0, community: 0, public: 0, private: 0 };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">College Data Management</h1>
          <p className="text-muted-foreground">
            Load comprehensive U.S. college data from the Department of Education College Scorecard API
          </p>
        </div>

        {/* Current Status */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Current Database Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{collegeStats.total}</div>
                <div className="text-sm text-muted-foreground">Total Colleges</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{collegeStats.community}</div>
                <div className="text-sm text-muted-foreground">Community Colleges</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{collegeStats.public}</div>
                <div className="text-sm text-muted-foreground">Public Institutions</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">{collegeStats.private}</div>
                <div className="text-sm text-muted-foreground">Private Institutions</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Loading Actions */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Download className="h-5 w-5" />
                Bulk Load All Colleges
              </CardTitle>
              <CardDescription>
                Load all 6,000+ U.S. colleges and universities from the College Scorecard API
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">4-Year Universities</Badge>
                  <Badge variant="outline">Community Colleges</Badge>
                  <Badge variant="outline">Technical Schools</Badge>
                  <Badge variant="outline">Graduate Schools</Badge>
                </div>
                
                {isLoading && (
                  <div className="space-y-2">
                    <Progress value={loadingProgress} className="w-full" />
                    <p className="text-sm text-muted-foreground">
                      Loading authentic college data from College Scorecard API...
                    </p>
                  </div>
                )}

                <Button 
                  onClick={handleBulkLoad} 
                  disabled={isLoading}
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Loading Colleges...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Load All U.S. Colleges
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <RefreshCw className="h-5 w-5" />
                Refresh Database
              </CardTitle>
              <CardDescription>
                Clear existing data and reload fresh college information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Clear Cache</Badge>
                  <Badge variant="secondary">Fresh Data</Badge>
                  <Badge variant="secondary">Updated Tuition</Badge>
                </div>

                <Button 
                  onClick={handleRefresh} 
                  disabled={isLoading}
                  variant="outline"
                  className="w-full"
                >
                  {isLoading ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Refreshing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Refresh All Data
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Status Messages */}
        {bulkLoadMutation.isSuccess && (
          <Card className="border-green-200 bg-green-50">
            <CardContent className="flex items-center gap-2 pt-6">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-green-800">
                Successfully loaded colleges from College Scorecard API
              </span>
            </CardContent>
          </Card>
        )}

        {bulkLoadMutation.isError && (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="flex items-center gap-2 pt-6">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <span className="text-red-800">
                Error loading colleges. Please check your API key and try again.
              </span>
            </CardContent>
          </Card>
        )}

        {/* Expected Results */}
        <Card>
          <CardHeader>
            <CardTitle>Expected Results</CardTitle>
            <CardDescription>
              What you'll get from the complete College Scorecard dataset
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h4 className="font-medium">Institution Types</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• 1,500+ Community Colleges</li>
                  <li>• 2,000+ Public Universities</li>
                  <li>• 1,800+ Private Colleges</li>
                  <li>• 700+ Technical Schools</li>
                </ul>
              </div>
              <div className="space-y-2">
                <h4 className="font-medium">Authentic Data Fields</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Real tuition costs (in-state/out-of-state)</li>
                  <li>• Actual acceptance rates</li>
                  <li>• Current graduation rates</li>
                  <li>• Student enrollment numbers</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}