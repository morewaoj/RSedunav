import { useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Brain, Target, TrendingUp, Award } from "lucide-react";

export default function Landing() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    document.title = "RS EduNav — AI-powered college, career, and scholarship guidance";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content =
      "RS EduNav helps students discover careers, colleges, and scholarships with personalized AI recommendations.";
  }, []);

  const handleLogin = () => {
    setLocation("/auth");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-6xl mx-auto">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="flex items-center justify-center mb-6">
              <GraduationCap className="h-16 w-16 text-blue-600 mr-4" />
              <h1 className="text-5xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                EduNav
              </h1>
            </div>
            <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-8">
              Transform your educational and career journey with personalized recommendations, 
              authentic data insights, and smart planning tools.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button onClick={handleLogin} size="lg" className="text-lg px-8 py-3">
                Get Started
              </Button>
              <Button variant="outline" size="lg" className="text-lg px-8 py-3">
                Learn More
              </Button>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-16">
            <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-800/80 border-0 shadow-xl">
              <CardHeader>
                <Brain className="h-12 w-12 text-blue-600 mb-4" />
                <CardTitle className="text-xl">AI Career Matching</CardTitle>
                <CardDescription>
                  Advanced machine learning algorithms analyze your interests and skills to recommend personalized career paths with 70%+ accuracy.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-800/80 border-0 shadow-xl">
              <CardHeader>
                <Target className="h-12 w-12 text-green-600 mb-4" />
                <CardTitle className="text-xl">College Recommendations</CardTitle>
                <CardDescription>
                  Discover colleges that align with your career goals using authentic data from thousands of institutions nationwide.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-800/80 border-0 shadow-xl">
              <CardHeader>
                <Award className="h-12 w-12 text-purple-600 mb-4" />
                <CardTitle className="text-xl">Scholarship Database</CardTitle>
                <CardDescription>
                  Access comprehensive scholarship opportunities with real federal, state, and private funding sources.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-800/80 border-0 shadow-xl">
              <CardHeader>
                <TrendingUp className="h-12 w-12 text-orange-600 mb-4" />
                <CardTitle className="text-xl">Labor Market Insights</CardTitle>
                <CardDescription>
                  Real-time job market data and salary trends from Bureau of Labor Statistics to inform your decisions.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-800/80 border-0 shadow-xl">
              <CardHeader>
                <GraduationCap className="h-12 w-12 text-indigo-600 mb-4" />
                <CardTitle className="text-xl">Skill Development</CardTitle>
                <CardDescription>
                  Identify skill gaps and get personalized learning paths to enhance your career readiness.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <Card className="backdrop-blur-sm bg-white/80 dark:bg-slate-800/80 border-0 shadow-xl max-w-2xl mx-auto">
              <CardContent className="pt-8 pb-8">
                <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Future?</h2>
                <p className="text-lg text-slate-600 dark:text-slate-300 mb-6">
                  Join thousands of students who have discovered their ideal career paths through our platform.
                </p>
                <Button onClick={handleLogin} size="lg" className="text-lg px-12 py-3">
                  Start Your Journey
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}