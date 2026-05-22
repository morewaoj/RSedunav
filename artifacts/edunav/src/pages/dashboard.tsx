import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GraduationCap, University, Banknote, Trophy } from "lucide-react";
import { Link } from "wouter";
import { trackEvent } from "@/lib/analytics";

export default function Dashboard() {
  useEffect(() => { trackEvent("view_dashboard"); }, []);

  return (
    <main className="min-h-screen">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-primary/10 to-secondary/5 border-b border-border/50">
        <div className="absolute inset-0 bg-grid-white/10 [mask-image:linear-gradient(0deg,transparent,black)]" />
        <div className="relative max-w-7xl mx-auto px-6 lg:px-8 py-24">
          <div className="text-center space-y-8">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium border border-primary/20">
              <Trophy className="w-4 h-4 mr-2" />
              Educational Intelligence Platform
            </div>
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-foreground tracking-tight">
              Your Path to
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent block">
                College Success
              </span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Discover US colleges, scholarships, and career paths with authentic data from College Scorecard, 
              O*NET, and verified scholarship sources tailored to your goals.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Link href="/search">
                <Button size="lg" className="btn-primary text-lg px-8 py-4">
                  <GraduationCap className="w-5 h-5 mr-2" />
                  Start Your Journey
                </Button>
              </Link>
              <Link href="/career-explorer">
                <Button size="lg" variant="outline" className="text-lg px-8 py-4">
                  Explore 32+ O*NET Careers
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          <Card className="card-elevated group hover:scale-105 transition-all duration-300">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <GraduationCap className="w-8 h-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Find Colleges</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Search authentic College Scorecard data with 6,400+ US institutions by academics, sports, and location.
              </p>
              <Link href="/search">
                <Button className="w-full btn-primary">
                  Start Search
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="card-elevated group hover:scale-105 transition-all duration-300">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-emerald-500/10 rounded-2xl flex items-center justify-center group-hover:bg-emerald-500/20 transition-colors">
                <Trophy className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Career Paths</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Explore careers with O*NET data including salaries, growth rates, and education requirements.
              </p>
              <Link href="/career-explorer">
                <Button variant="outline" className="w-full">
                  Explore Careers
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="card-elevated group hover:scale-105 transition-all duration-300">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-amber-500/10 rounded-2xl flex items-center justify-center group-hover:bg-amber-500/20 transition-colors">
                <Banknote className="w-8 h-8 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Scholarships</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Access 51 authentic scholarships from federal, state, and private sources worth up to $60,000.
              </p>
              <Link href="/scholarships">
                <Button variant="outline" className="w-full">
                  Find Scholarships
                </Button>
              </Link>
            </CardContent>
          </Card>

          <Card className="card-elevated group hover:scale-105 transition-all duration-300">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 mx-auto mb-6 bg-purple-500/10 rounded-2xl flex items-center justify-center group-hover:bg-purple-500/20 transition-colors">
                <University className="w-8 h-8 text-purple-600" />
              </div>
              <h3 className="text-xl font-semibold text-foreground mb-3">Job Market</h3>
              <p className="text-muted-foreground mb-6 leading-relaxed">
                Real-time labor market data and employment projections from Bureau of Labor Statistics.
              </p>
              <Link href="/job-market">
                <Button variant="outline" className="w-full">
                  View Market Data
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}