import { Switch, Route, Redirect, Link, Router as WouterRouter } from "wouter";
import { Suspense, lazy } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth.js";
import Navbar from "@/components/navbar";
import { ProtectedRoute } from "@/lib/protected-route";

// Fast-loading components (keep eager)
import NotFound from "@/pages/not-found";

// Lazy-loaded pages for code splitting
const Home = lazy(() => import("@/pages/home"));
const Search = lazy(() => import("@/pages/search"));
const Results = lazy(() => import("@/pages/results"));
const CareerMatches = lazy(() => import("@/pages/career-matches"));
const SimplifiedCareerExplorer = lazy(() => import("./components/simplified-career-explorer"));
const EnhancedCollegeSearch = lazy(() => import("./components/enhanced-college-search"));
const RealTimeCollegeSearch = lazy(() => import("./components/real-time-college-search"));
const CollegeDetail = lazy(() => import("./pages/college-detail"));
const CareerDetail = lazy(() => import("./pages/career-detail"));
const ScholarshipDetail = lazy(() => import("./pages/scholarship-detail"));
const CollegeScholarships = lazy(() => import("./pages/college-scholarships"));
const CollegeScholarshipDetails = lazy(() => import("./pages/college-scholarship-details"));
const ComprehensiveScholarships = lazy(() => import("./pages/comprehensive-scholarships"));
const JobMarket = lazy(() => import("@/pages/job-market"));
const ProfilePage = lazy(() => import("@/pages/profile"));
const CareerRecommendations = lazy(() => import("@/pages/career-recommendations"));
const ScholarshipMatches = lazy(() => import("@/pages/scholarship-matches"));
const Fellowships = lazy(() => import("@/pages/fellowships"));
const Admin = lazy(() => import("@/pages/admin"));
const Director = lazy(() => import("@/pages/director"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Landing = lazy(() => import("@/pages/landing"));
const AuthPage = lazy(() => import("@/pages/auth-page"));
const Privacy = lazy(() => import("@/pages/privacy"));
const Support = lazy(() => import("@/pages/support"));
const Terms = lazy(() => import("@/pages/terms"));
const Saved = lazy(() => import("@/pages/saved"));

// Loading component for smooth transitions
const PageLoader = () => (
  <div className="flex items-center justify-center min-h-[50vh]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

// The landing/marketing content (built into AuthPage — see the comment
// there) must paint on first render with no dependency on the
// /api/auth/user round trip resolving: that call can take 30-60s while the
// Render backend cold-starts. Root previously went through ProtectedRoute,
// which showed a blank full-screen spinner for the entire isLoading window
// before even redirecting to /auth. Render AuthPage directly instead, and
// swap to Home only once the auth check confirms a logged-in session.
function RootRoute() {
  const { user, isLoading } = useAuth();

  if (!isLoading && user) {
    return (
      <Route path="/">
        <Navbar />
        <Home />
      </Route>
    );
  }

  return (
    <Route path="/">
      <AuthPage />
    </Route>
  );
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <RootRoute />
        <Route path="/search">
          <RealTimeCollegeSearch />
        </Route>
        <ProtectedRoute path="/college-search">
          <EnhancedCollegeSearch />
        </ProtectedRoute>
        <Route path="/college/:id">
          <CollegeDetail />
        </Route>
        <Route path="/college/:id/scholarships">
          <CollegeScholarships />
        </Route>
        <Route path="/career/:id">
          <CareerDetail />
        </Route>
        <Route path="/scholarship/:id">
          <ScholarshipDetail />
        </Route>
        <ProtectedRoute path="/scholarships">
          <ComprehensiveScholarships />
        </ProtectedRoute>
        <ProtectedRoute path="/results">
          <Results />
        </ProtectedRoute>
        {/* Redirect old career-paths route to career-explorer */}
        <Route path="/career-paths">
          <Redirect to="/career-explorer" />
        </Route>
        <ProtectedRoute path="/career-explorer">
          <SimplifiedCareerExplorer />
        </ProtectedRoute>
        <ProtectedRoute path="/job-market">
          <JobMarket />
        </ProtectedRoute>

        <ProtectedRoute path="/profile">
          <ProfilePage />
        </ProtectedRoute>
        <ProtectedRoute path="/saved">
          <Saved />
        </ProtectedRoute>
        <ProtectedRoute path="/career-recommendations">
          <CareerRecommendations />
        </ProtectedRoute>
        <ProtectedRoute path="/profile/career-recommendations">
          <CareerRecommendations />
        </ProtectedRoute>
        <ProtectedRoute path="/scholarship-matches">
          <ScholarshipMatches />
        </ProtectedRoute>
        <ProtectedRoute path="/profile/scholarship-matches">
          <ScholarshipMatches />
        </ProtectedRoute>
        <Route path="/fellowships">
          <Fellowships />
        </Route>
        <ProtectedRoute path="/admin">
          <Admin />
        </ProtectedRoute>
        <ProtectedRoute path="/director">
          <Director />
        </ProtectedRoute>
        <Route path="/auth">
          <AuthPage />
        </Route>
        <Route path="/privacy">
          <Privacy />
        </Route>
        <Route path="/support">
          <Support />
        </Route>
        <Route path="/terms">
          <Terms />
        </Route>
        <Route path="/welcome">
          <Landing />
        </Route>
        <Route>
          <NotFound />
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 flex flex-col">
              <Toaster />
              <div className="flex-1">
                <Router />
              </div>
              <footer className="py-6 text-sm text-muted-foreground bg-background/80 backdrop-blur-sm border-t border-border">
                <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                  <div>built by RS</div>
                  <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
                    <Link href="/privacy" className="hover:text-foreground hover:underline" data-testid="link-footer-privacy">
                      Privacy
                    </Link>
                    <Link href="/support" className="hover:text-foreground hover:underline" data-testid="link-footer-support">
                      Support
                    </Link>
                    <Link href="/terms" className="hover:text-foreground hover:underline" data-testid="link-footer-terms">
                      Terms
                    </Link>
                  </nav>
                </div>
              </footer>
            </div>
          </WouterRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
