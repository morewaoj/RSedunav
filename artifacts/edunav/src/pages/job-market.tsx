import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Search as SearchIcon, 
  TrendingUp, 
  TrendingDown, 
  Minus,
  DollarSign, 
  MapPin, 
  BarChart3,
  Clock,
  Users
} from "lucide-react";

interface JobMarketData {
  career: string;
  seriesId: string;
  medianAnnualWage: number;
  hourlyWage: number;
  trend: 'rising' | 'declining' | 'stable';
  trendPercentage: number;
  year: string;
  period: string;
  data: any[];
}

interface StateJobData {
  state: string;
  seriesId: string;
  medianAnnualWage: number;
  year: string;
  employment: number | null;
  data: any[];
}

interface SupportedCareer {
  title: string;
  key: string;
  seriesId: string;
}

const US_STATES = [
  { code: 'CA', name: 'California' },
  { code: 'TX', name: 'Texas' },
  { code: 'FL', name: 'Florida' },
  { code: 'NY', name: 'New York' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'IL', name: 'Illinois' },
  { code: 'OH', name: 'Ohio' },
  { code: 'GA', name: 'Georgia' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'MI', name: 'Michigan' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'IN', name: 'Indiana' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MD', name: 'Maryland' },
  { code: 'WI', name: 'Wisconsin' }
];

export default function JobMarket() {
  const [selectedCareer, setSelectedCareer] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("CA");
  const [seriesIdInput, setSeriesIdInput] = useState("");
  
  // Load supported careers from BLS mapping
  const { data: supportedCareers = [], isLoading: careersLoading } = useQuery<SupportedCareer[]>({
    queryKey: ['/api/job-market/careers'],
    staleTime: 60 * 60 * 1000, // Cache for 1 hour
  });

  // Get job data for selected career
  const { data: jobData, isLoading: jobDataLoading, error: jobDataError } = useQuery<JobMarketData>({
    queryKey: [`/api/job-market/career/${encodeURIComponent(selectedCareer || '')}`],
    enabled: !!selectedCareer,
    staleTime: 15 * 60 * 1000, // Cache for 15 minutes
  });

  // Get state-specific data for selected career
  const { data: stateJobData, isLoading: stateDataLoading } = useQuery<StateJobData>({
    queryKey: [`/api/job-market/state/${selectedState}/career/${encodeURIComponent(selectedCareer || '')}`],
    enabled: !!selectedCareer && !!selectedState,
    staleTime: 15 * 60 * 1000,
  });

  // Get data by BLS series ID
  const { data: seriesData, isLoading: seriesLoading } = useQuery<{data: any[]}>({
    queryKey: [`/api/job-market/series/${seriesIdInput}`],
    enabled: seriesIdInput.length > 10,
    staleTime: 15 * 60 * 1000,
  });

  // Cache management using localStorage
  useEffect(() => {
    const cacheKey = 'job-market-cache';
    const cached = localStorage.getItem(cacheKey);
    
    if (jobData && selectedCareer) {
      const cacheData = cached ? JSON.parse(cached) : {};
      cacheData[selectedCareer] = {
        data: jobData,
        timestamp: Date.now()
      };
      localStorage.setItem(cacheKey, JSON.stringify(cacheData));
    }
  }, [jobData, selectedCareer]);

  const displayedCareers: SupportedCareer[] = supportedCareers;

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rising':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <TrendingDown className="h-4 w-4 text-red-600" />;
      default:
        return <Minus className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'rising':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  if (careersLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading job market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Job Market Intelligence</h1>
        <p className="text-gray-600">Real-time wage data and employment trends from the Bureau of Labor Statistics</p>
      </div>

      <Tabs defaultValue="careers" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="careers">Career Search</TabsTrigger>
          <TabsTrigger value="states">State Analysis</TabsTrigger>
          <TabsTrigger value="series">BLS Series Lookup</TabsTrigger>
        </TabsList>

        <TabsContent value="careers" className="space-y-6">
          {/* Career Selection */}
          <div className="max-w-md">
            <Select value={selectedCareer} onValueChange={setSelectedCareer}>
              <SelectTrigger>
                <SelectValue placeholder="Select a career to view job market data" />
              </SelectTrigger>
              <SelectContent>
                {displayedCareers.map((career) => (
                  <SelectItem key={career.key} value={career.key}>
                    {career.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Job Data Display */}
          {selectedCareer && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {jobDataLoading ? (
                <div className="col-span-full text-center py-8">
                  <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Loading wage data...</p>
                </div>
              ) : jobDataError ? (
                <div className="col-span-full">
                  <Card className="border-red-200 bg-red-50">
                    <CardContent className="p-6">
                      <p className="text-red-600">
                        Unable to load job data. This career may not be available in the BLS database.
                      </p>
                    </CardContent>
                  </Card>
                </div>
              ) : jobData ? (
                <>
                  {/* Wage Information */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-green-600" />
                        Wage Information
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">Median Annual Wage</p>
                          <p className="text-2xl font-bold text-green-600">
                            ${jobData.medianAnnualWage.toLocaleString()}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Hourly Wage</p>
                          <p className="text-lg font-semibold">
                            ${jobData.hourlyWage.toFixed(2)}/hour
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Data Year</p>
                          <p className="text-sm">{jobData.year}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trend Analysis */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-blue-600" />
                        Wage Trend
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          {getTrendIcon(jobData.trend)}
                          <span className={`font-semibold ${getTrendColor(jobData.trend)}`}>
                            {jobData.trend.charAt(0).toUpperCase() + jobData.trend.slice(1)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Year-over-Year Change</p>
                          <p className={`text-lg font-semibold ${getTrendColor(jobData.trend)}`}>
                            {jobData.trendPercentage > 0 ? '+' : ''}{jobData.trendPercentage}%
                          </p>
                        </div>
                        <Badge variant={jobData.trend === 'rising' ? 'default' : jobData.trend === 'declining' ? 'destructive' : 'secondary'}>
                          {jobData.trend === 'rising' ? 'Growing Market' : 
                           jobData.trend === 'declining' ? 'Declining Market' : 
                           'Stable Market'}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* BLS Series Info */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-purple-600" />
                        Data Source
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div>
                          <p className="text-sm text-gray-600">BLS Series ID</p>
                          <p className="text-sm font-mono bg-gray-100 p-1 rounded">
                            {jobData.seriesId}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Career Title</p>
                          <p className="font-semibold">{jobData.career}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Source</p>
                          <p className="text-sm">OEWS - Occupational Employment and Wage Statistics</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : null}
            </div>
          )}
        </TabsContent>

        <TabsContent value="states" className="space-y-6">
          {/* State Analysis */}
          <div className="grid gap-4 md:grid-cols-2">
            <Select value={selectedState} onValueChange={setSelectedState}>
              <SelectTrigger>
                <SelectValue placeholder="Select a state" />
              </SelectTrigger>
              <SelectContent>
                {US_STATES.map((state) => (
                  <SelectItem key={state.code} value={state.code}>
                    {state.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCareer} onValueChange={setSelectedCareer}>
              <SelectTrigger>
                <SelectValue placeholder="Select a career to compare" />
              </SelectTrigger>
              <SelectContent>
                {supportedCareers.map((career) => (
                  <SelectItem key={career.key} value={career.key}>
                    {career.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* State Comparison */}
          {selectedCareer && selectedState && (
            <div className="grid gap-6 md:grid-cols-2">
              {/* National Data */}
              {jobData && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-blue-600" />
                      National Average
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Median Annual Wage</p>
                        <p className="text-xl font-bold text-blue-600">
                          ${jobData.medianAnnualWage.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Career</p>
                        <p className="font-semibold">{jobData.career}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* State Data */}
              {stateDataLoading ? (
                <Card>
                  <CardContent className="p-6">
                    <div className="text-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                      <p className="mt-2 text-gray-600">Loading state data...</p>
                    </div>
                  </CardContent>
                </Card>
              ) : stateJobData ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5 text-green-600" />
                      {US_STATES.find(s => s.code === selectedState)?.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-gray-600">Median Annual Wage</p>
                        <p className="text-xl font-bold text-green-600">
                          ${stateJobData.medianAnnualWage.toLocaleString()}
                        </p>
                      </div>
                      {jobData && (
                        <div>
                          <p className="text-sm text-gray-600">vs. National Average</p>
                          <p className={`font-semibold ${
                            stateJobData.medianAnnualWage > jobData.medianAnnualWage 
                              ? 'text-green-600' 
                              : stateJobData.medianAnnualWage < jobData.medianAnnualWage 
                                ? 'text-red-600' 
                                : 'text-gray-600'
                          }`}>
                            {stateJobData.medianAnnualWage > jobData.medianAnnualWage ? '+' : ''}
                            ${(stateJobData.medianAnnualWage - jobData.medianAnnualWage).toLocaleString()}
                            {' '}({(((stateJobData.medianAnnualWage - jobData.medianAnnualWage) / jobData.medianAnnualWage) * 100).toFixed(1)}%)
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="border-yellow-200 bg-yellow-50">
                  <CardContent className="p-6">
                    <p className="text-yellow-800">
                      State-specific data not available for this career in {US_STATES.find(s => s.code === selectedState)?.name}.
                    </p>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="series" className="space-y-6">
          {/* BLS Series Lookup */}
          <div className="space-y-4">
            <div>
              <label htmlFor="seriesId" className="block text-sm font-medium text-gray-700 mb-2">
                BLS Series ID
              </label>
              <Input
                id="seriesId"
                placeholder="Enter BLS series ID (e.g., OEUN000000000000151131)"
                value={seriesIdInput}
                onChange={(e) => setSeriesIdInput(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-gray-500 mt-1">
                Find series IDs at: <a href="https://download.bls.gov/pub/time.series/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">BLS Time Series Catalog</a>
              </p>
            </div>

            {seriesLoading && (
              <Card>
                <CardContent className="p-6">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="mt-2 text-gray-600">Loading series data...</p>
                  </div>
                </CardContent>
              </Card>
            )}

            {seriesData && (
              <Card>
                <CardHeader>
                  <CardTitle>Series Data: {seriesIdInput}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <div>
                        <p className="text-sm text-gray-600">Latest Value</p>
                        <p className="text-lg font-semibold">{seriesData.data[0]?.value}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Year</p>
                        <p className="text-lg font-semibold">{seriesData.data[0]?.year}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Period</p>
                        <p className="text-lg font-semibold">{seriesData.data[0]?.period}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="font-semibold mb-2">Recent Data Points</h4>
                      <div className="space-y-1">
                        {seriesData.data.slice(0, 5).map((point: any, index: number) => (
                          <div key={index} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                            <span className="text-sm">{point.year} {point.period}</span>
                            <span className="font-medium">{point.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}