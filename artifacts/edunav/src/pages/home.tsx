import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth.js";
import { Brain, Search, Target, TrendingUp, BookOpen, LogOut } from "lucide-react";
import { Link } from "wouter";
import { trackEvent } from "@/lib/analytics";

export default function Home() {
  const { user, logout } = useAuth();

  useEffect(() => { trackEvent("page_view", { page: "home" }); }, []);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto page-enter">
          {/* Welcome Header */}
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
              Your personalized dashboard
            </div>
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white bg-clip-text text-transparent">
              Welcome back, {user?.firstName || user?.email?.split('@')[0] || "Student"}!
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-300 mb-8 max-w-2xl mx-auto">
              Continue your educational and career journey with personalized insights
            </p>
            <Button 
              onClick={logout} 
              variant="outline" 
              className="rounded-xl px-6 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all duration-300"
              data-testid="button-signout"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>

          {/* Quick Actions */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            <Link href="/profile">
              <Card className="card-premium cursor-pointer group hover-lift">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Brain className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-lg">AI Career Analysis</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Upload your resume for personalized career recommendations
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/search">
              <Card className="card-premium cursor-pointer group hover-lift">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Search className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-lg">Find Colleges</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Search through thousands of colleges with authentic data
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/scholarships">
              <Card className="card-premium cursor-pointer group hover-lift">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Target className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-lg">Scholarships</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Discover federal, state, and private scholarship opportunities
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/job-market">
              <Card className="card-premium cursor-pointer group hover-lift">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <TrendingUp className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-lg">Job Market</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Real-time labor market data and salary insights
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/career-explorer">
              <Card className="card-premium cursor-pointer group hover-lift">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-rose-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <Target className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-lg">Career Explorer</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Explore career paths with insights from 78,000+ resumes
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>

            <Link href="/fellowships">
              <Card className="card-premium cursor-pointer group hover-lift">
                <CardHeader className="pb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                    <BookOpen className="h-7 w-7 text-white" />
                  </div>
                  <CardTitle className="text-lg">Fellowships</CardTitle>
                  <CardDescription className="text-sm leading-relaxed">
                    Find graduate and postdoctoral fellowship opportunities
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          </div>

          {/* Get Started Section */}
          <Card className="card-premium overflow-hidden">
            <CardHeader className="border-b border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center">
                  <Target className="h-5 w-5 text-white" />
                </div>
                <div>
                  <CardTitle className="text-lg">Get Started</CardTitle>
                  <CardDescription>
                    Begin your journey with these recommended actions
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="list-item-interactive bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-100 dark:border-blue-800/30">
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white">Complete your profile</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Help our AI provide better recommendations
                  </p>
                </div>
                <Link href="/profile">
                  <Button className="btn-premium text-white rounded-xl">
                    Start
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}