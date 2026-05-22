import { useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bookmark, Loader2, Eye, EyeOff } from "lucide-react";
import { Link, Redirect, useSearch } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { trackEvent } from "@/lib/analytics";
import { readPendingSaveSummary } from "@/components/saved-plan-button";
import logoImage from "@assets/097FA70F-1753-4CC9-83A6-E318880BD31D_1771156440772.png";

export default function AuthPage() {
  const { user, isLoading, login, register, isLoggingIn, isRegistering } = useAuth();
  const { toast } = useToast();
  const search = useSearch();
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const redirectTo = useMemo(() => {
    const params = new URLSearchParams(search);
    const raw = params.get("redirect");
    if (!raw) return "/";
    if (!raw.startsWith("/") || raw.startsWith("//")) return "/";
    return raw;
  }, [search]);

  // Snapshot the pending-save intent at mount so we can reassure the
  // signed-out user about what they're signing in to save. Read once via
  // the lazy initializer because the intent in sessionStorage can change
  // mid-session (e.g. they tap a different Save button) and we only want
  // to surface the one they came in with. The intent itself stays in
  // storage so SavedPlanButton can still auto-save after the redirect.
  const [pendingSave] = useState(() => readPendingSaveSummary());
  const pendingSaveLabel = pendingSave
    ? pendingSave.label ?? "your selected item"
    : null;

  const [loginForm, setLoginForm] = useState({ username: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    email: "",
    firstName: "",
    lastName: "",
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-[#6C2BD9]" />
      </div>
    );
  }

  if (user) {
    return <Redirect to={redirectTo} />;
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginForm.username || !loginForm.password) {
      toast({ title: "Error", description: "Please fill in all fields", variant: "destructive" });
      return;
    }
    try {
      await login({ username: loginForm.username, password: loginForm.password });
      trackEvent("login_success");
      toast({ title: "Welcome back!", description: "You have successfully signed in." });
    } catch (error: any) {
      toast({ title: "Login failed", description: error.message || "Invalid credentials", variant: "destructive" });
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!registerForm.username || !registerForm.password) {
      toast({ title: "Error", description: "Username and password are required", variant: "destructive" });
      return;
    }
    if (registerForm.password !== registerForm.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (registerForm.password.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }
    try {
      await register({
        username: registerForm.username,
        password: registerForm.password,
        email: registerForm.email || undefined,
        firstName: registerForm.firstName || undefined,
        lastName: registerForm.lastName || undefined,
      });
      trackEvent("signup_success");
      toast({ title: "Account created!", description: "Welcome to RS EduNav!" });
    } catch (error: any) {
      toast({ title: "Registration failed", description: error.message || "Could not create account", variant: "destructive" });
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-[400px]">
        <div className="flex flex-col items-center mb-8">
          <img
            src={logoImage}
            alt="RS EduNav"
            className="w-16 h-16 sm:w-20 sm:h-20 object-contain mb-4"
          />
          <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-gray-900">
            RS EduNav
          </h1>
          <p className="text-sm text-gray-400 mt-1 tracking-wide">
            Educational Intelligence
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6 sm:p-8">
          {pendingSaveLabel ? (
            <div
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#6C2BD9]/20 bg-[#6C2BD9]/5 px-3 py-2.5 text-sm text-gray-700"
              data-testid="banner-pending-save"
            >
              <Bookmark
                className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#6C2BD9]"
                aria-hidden="true"
              />
              <span>
                {isLoginMode ? "Sign in" : "Sign up"} to save{" "}
                <span
                  className="font-semibold text-gray-900"
                  data-testid="text-pending-save-label"
                >
                  {pendingSaveLabel}
                </span>{" "}
                to your plan.
              </span>
            </div>
          ) : null}
          <h2 className="text-lg font-semibold text-gray-900 text-center mb-1">
            {isLoginMode ? "Sign in to your account" : "Create your account"}
          </h2>
          <p className="text-sm text-gray-400 text-center mb-6">
            {isLoginMode
              ? "Enter your credentials to continue"
              : "Get started with personalized guidance"}
          </p>

          {isLoginMode ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="login-username" className="text-sm font-medium text-gray-700">
                  Username
                </Label>
                <Input
                  id="login-username"
                  type="text"
                  placeholder="Enter your username"
                  value={loginForm.username}
                  onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                  data-testid="input-login-username"
                  className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#6C2BD9] focus:ring-[#6C2BD9]/20 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="login-password" className="text-sm font-medium text-gray-700">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    data-testid="input-login-password"
                    className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#6C2BD9] focus:ring-[#6C2BD9]/20 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <button
                type="submit"
                disabled={isLoggingIn}
                data-testid="button-login"
                className="w-full h-11 rounded-lg bg-gradient-to-r from-[#6C2BD9] to-[#A855F7] text-white font-medium text-sm hover:opacity-90 active:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="register-firstName" className="text-sm font-medium text-gray-700">
                    First Name
                  </Label>
                  <Input
                    id="register-firstName"
                    type="text"
                    placeholder="John"
                    value={registerForm.firstName}
                    onChange={(e) => setRegisterForm({ ...registerForm, firstName: e.target.value })}
                    data-testid="input-register-firstName"
                    className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#6C2BD9] focus:ring-[#6C2BD9]/20 transition-colors"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="register-lastName" className="text-sm font-medium text-gray-700">
                    Last Name
                  </Label>
                  <Input
                    id="register-lastName"
                    type="text"
                    placeholder="Doe"
                    value={registerForm.lastName}
                    onChange={(e) => setRegisterForm({ ...registerForm, lastName: e.target.value })}
                    data-testid="input-register-lastName"
                    className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#6C2BD9] focus:ring-[#6C2BD9]/20 transition-colors"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="register-email" className="text-sm font-medium text-gray-700">
                  Email
                </Label>
                <Input
                  id="register-email"
                  type="email"
                  placeholder="john@example.com"
                  value={registerForm.email}
                  onChange={(e) => setRegisterForm({ ...registerForm, email: e.target.value })}
                  data-testid="input-register-email"
                  className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#6C2BD9] focus:ring-[#6C2BD9]/20 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="register-username" className="text-sm font-medium text-gray-700">
                  Username <span className="text-[#A855F7]">*</span>
                </Label>
                <Input
                  id="register-username"
                  type="text"
                  placeholder="Choose a username"
                  value={registerForm.username}
                  onChange={(e) => setRegisterForm({ ...registerForm, username: e.target.value })}
                  required
                  data-testid="input-register-username"
                  className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#6C2BD9] focus:ring-[#6C2BD9]/20 transition-colors"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="register-password" className="text-sm font-medium text-gray-700">
                  Password <span className="text-[#A855F7]">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Min 6 characters"
                    value={registerForm.password}
                    onChange={(e) => setRegisterForm({ ...registerForm, password: e.target.value })}
                    required
                    data-testid="input-register-password"
                    className="h-11 rounded-lg border-gray-200 bg-gray-50/50 focus:bg-white focus:border-[#6C2BD9] focus:ring-[#6C2BD9]/20 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="register-confirmPassword" className="text-sm font-medium text-gray-700">
                  Confirm Password <span className="text-[#A855F7]">*</span>
                </Label>
                <div className="relative">
                  <Input
                    id="register-confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm your password"
                    value={registerForm.confirmPassword}
                    onChange={(e) => setRegisterForm({ ...registerForm, confirmPassword: e.target.value })}
                    required
                    data-testid="input-register-confirmPassword"
                    className="h-11 rounded-lg border-gray-200 bg-gray-200/50 focus:bg-white focus:border-[#6C2BD9] focus:ring-[#6C2BD9]/20 transition-colors pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <p
                className="text-xs text-gray-500 text-center leading-relaxed mt-2"
                data-testid="text-signup-terms-notice"
              >
                By creating an account, you agree to our{" "}
                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#6C2BD9] hover:underline"
                  data-testid="link-signup-terms"
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium text-[#6C2BD9] hover:underline"
                  data-testid="link-signup-privacy"
                >
                  Privacy Policy
                </a>
                .
              </p>
              <button
                type="submit"
                disabled={isRegistering}
                data-testid="button-register"
                className="w-full h-11 rounded-lg bg-gradient-to-r from-[#6C2BD9] to-[#A855F7] text-white font-medium text-sm hover:opacity-90 active:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-2"
              >
                {isRegistering ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create Account"
                )}
              </button>
            </form>
          )}

          <div className="mt-5 pt-5 border-t border-gray-100 text-center">
            <button
              type="button"
              onClick={() => setIsLoginMode(!isLoginMode)}
              className="text-sm text-gray-500 hover:text-[#6C2BD9] transition-colors"
              data-testid="button-toggle-auth-mode"
            >
              {isLoginMode ? (
                <>
                  Don't have an account?{" "}
                  <span className="font-medium text-[#6C2BD9]">Sign up</span>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <span className="font-medium text-[#6C2BD9]">Sign in</span>
                </>
              )}
            </button>
          </div>
        </div>

        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-gray-300">
          <span>Careers</span>
          <span className="w-1 h-1 rounded-full bg-gray-200" />
          <span>Colleges</span>
          <span className="w-1 h-1 rounded-full bg-gray-200" />
          <span>Scholarships</span>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs text-gray-400">
          <Link
            href="/privacy"
            className="text-gray-500 hover:text-[#6C2BD9] transition-colors"
            data-testid="link-auth-privacy"
          >
            Privacy Policy
          </Link>
          <span className="text-gray-300">·</span>
          <Link
            href="/support"
            className="text-gray-500 hover:text-[#6C2BD9] transition-colors"
            data-testid="link-auth-support"
          >
            Support
          </Link>
          <span className="text-gray-300">·</span>
          <Link
            href="/terms"
            className="text-gray-500 hover:text-[#6C2BD9] transition-colors"
            data-testid="link-auth-terms"
          >
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
