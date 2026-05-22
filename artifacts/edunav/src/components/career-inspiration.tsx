import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Lightbulb, Sparkles, TrendingUp, DollarSign, MapPin, Clock, Zap } from "lucide-react";

interface CareerInspiration {
  careerTitle: string;
  description: string;
  whyExciting: string;
  dailyLife: string;
  futureOpportunities: string;
  inspiringFact: string;
  pathToStart: string;
  salaryRange: string;
  relatedFields: string[];
}

export default function CareerInspiration() {
  const { toast } = useToast();
  const [inspirations, setInspirations] = useState<CareerInspiration[]>([]);
  const [selectedInspiration, setSelectedInspiration] = useState<CareerInspiration | null>(null);

  // AI Career Inspiration mutation
  const generateInspirationMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/career-inspiration", {
        quickInspiration: true
      });
      return await response.json();
    },
    onSuccess: (data: CareerInspiration[]) => {
      setInspirations(data);
      if (data.length > 0) {
        setSelectedInspiration(data[0]);
      }
      toast({
        title: "Career Inspiration Generated!",
        description: `Discovered ${data.length} exciting career paths for you.`
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate career inspiration. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleGenerateInspiration = () => {
    generateInspirationMutation.mutate();
  };

  const formatPathSteps = (path: string) => {
    const steps = path.split(/Step \d+:|\d+\./).filter(step => step.trim().length > 0);
    return steps.map((step, index) => (
      <div key={index} className="flex items-start gap-2 mb-2">
        <div className="flex-shrink-0 w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-xs font-medium text-blue-600 dark:text-blue-300">
          {index + 1}
        </div>
        <span className="text-sm">{step.trim()}</span>
      </div>
    ));
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-2 mb-4">
          <Sparkles className="h-8 w-8 text-purple-600" />
          <h1 className="text-3xl font-bold">Career Inspiration Generator</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-300 mb-6">
          Discover exciting career possibilities powered by AI. Get instant inspiration for your future path.
        </p>
        
        <Button 
          onClick={handleGenerateInspiration}
          disabled={generateInspirationMutation.isPending}
          size="lg"
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white"
        >
          {generateInspirationMutation.isPending ? (
            <>
              <Zap className="h-5 w-5 mr-2 animate-spin" />
              Generating Inspiration...
            </>
          ) : (
            <>
              <Lightbulb className="h-5 w-5 mr-2" />
              Generate Career Inspiration
            </>
          )}
        </Button>
      </div>

      {inspirations.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Career List */}
          <div className="lg:col-span-1">
            <h3 className="text-lg font-semibold mb-4">Inspired Careers</h3>
            <div className="space-y-3">
              {inspirations.map((inspiration, index) => (
                <Card 
                  key={index}
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedInspiration?.careerTitle === inspiration.careerTitle 
                      ? 'ring-2 ring-purple-500 bg-purple-50 dark:bg-purple-950' 
                      : ''
                  }`}
                  onClick={() => setSelectedInspiration(inspiration)}
                >
                  <CardContent className="p-4">
                    <h4 className="font-medium text-sm">{inspiration.careerTitle}</h4>
                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">
                      {inspiration.description}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          {/* Selected Career Details */}
          {selectedInspiration && (
            <div className="lg:col-span-3">
              <Card className="h-fit">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-purple-600" />
                        {selectedInspiration.careerTitle}
                      </CardTitle>
                      <CardDescription className="mt-2 text-base">
                        {selectedInspiration.description}
                      </CardDescription>
                    </div>
                    <Badge variant="secondary" className="ml-4">
                      <DollarSign className="h-3 w-3 mr-1" />
                      {selectedInspiration.salaryRange}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-6">
                  {/* Why Exciting */}
                  <div>
                    <h4 className="font-semibold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-2">
                      <Zap className="h-4 w-4" />
                      Why This Career is Exciting
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300">{selectedInspiration.whyExciting}</p>
                  </div>

                  <Separator />

                  {/* Daily Life */}
                  <div>
                    <h4 className="font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      A Day in the Life
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300">{selectedInspiration.dailyLife}</p>
                  </div>

                  <Separator />

                  {/* Future Opportunities */}
                  <div>
                    <h4 className="font-semibold text-green-600 dark:text-green-400 mb-2 flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" />
                      Future Opportunities
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300">{selectedInspiration.futureOpportunities}</p>
                  </div>

                  <Separator />

                  {/* Inspiring Fact */}
                  <div className="bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-950 dark:to-blue-950 p-4 rounded-lg">
                    <h4 className="font-semibold text-purple-700 dark:text-purple-300 mb-2 flex items-center gap-2">
                      <Lightbulb className="h-4 w-4" />
                      Inspiring Fact
                    </h4>
                    <p className="text-gray-700 dark:text-gray-300 italic">{selectedInspiration.inspiringFact}</p>
                  </div>

                  <Separator />

                  {/* Path to Start */}
                  <div>
                    <h4 className="font-semibold text-orange-600 dark:text-orange-400 mb-3 flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      How to Get Started
                    </h4>
                    <div className="space-y-2">
                      {formatPathSteps(selectedInspiration.pathToStart)}
                    </div>
                  </div>

                  <Separator />

                  {/* Related Fields */}
                  <div>
                    <h4 className="font-semibold text-gray-700 dark:text-gray-300 mb-3">Related Career Fields</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedInspiration.relatedFields.map((field, index) => (
                        <Badge key={index} variant="outline" className="text-xs">
                          {field}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      )}

      {inspirations.length === 0 && !generateInspirationMutation.isPending && (
        <div className="text-center py-12">
          <Lightbulb className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-600 dark:text-gray-400 mb-2">
            Ready for Inspiration?
          </h3>
          <p className="text-gray-500 dark:text-gray-500">
            Click the button above to discover exciting career opportunities powered by AI.
          </p>
        </div>
      )}
    </div>
  );
}