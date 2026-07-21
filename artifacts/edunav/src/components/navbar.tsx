import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { GraduationCap, Menu, Shield } from "lucide-react";
import { Link, useLocation } from "wouter";
import { PrefetchLink } from "@/lib/prefetch-link";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/", label: "Dashboard", id: "dashboard" },
  { href: "/search", label: "College Search", id: "search" },
  { href: "/career-explorer", label: "Career Explorer", id: "careers" },
  { href: "/job-market", label: "Job Market", id: "jobmarket" },
  { href: "/scholarships", label: "Scholarships", id: "scholarships" },
  { href: "/fellowships", label: "Fellowships", id: "fellowships" },
  { href: "/saved", label: "My Plan", id: "saved" },
  { href: "/profile", label: "My Profile", id: "profile" },
];

export default function Navbar() {
  const [location] = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();

  const isActiveLink = (href: string) => {
    if (href === "/" && location === "/") return true;
    if (href !== "/" && location.startsWith(href)) return true;
    return false;
  };

  const NavLinks = ({ mobile = false, onItemClick }: { mobile?: boolean; onItemClick?: () => void }) => (
    <>
      {navItems.map((item) => (
        <PrefetchLink key={item.id} href={item.href}>
          <span
            className={`${
              mobile 
                ? "flex items-center px-4 py-3 text-base font-medium rounded-xl cursor-pointer transition-all duration-200" 
                : "relative px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-all duration-200"
            } ${
              isActiveLink(item.href)
                ? mobile
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-primary bg-primary/10 shadow-sm"
                : mobile
                ? "text-foreground hover:bg-muted hover:text-foreground"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
            onClick={onItemClick}
          >
            {item.label}
          </span>
        </PrefetchLink>
      ))}
      {user?.isAdmin && (
        <PrefetchLink href="/director">
          <span
            className={`${
              mobile 
                ? "flex items-center px-4 py-3 text-base font-medium rounded-xl cursor-pointer transition-all duration-200" 
                : "relative px-4 py-2 text-sm font-medium rounded-lg cursor-pointer transition-all duration-200"
            } ${
              isActiveLink("/director")
                ? mobile
                  ? "bg-amber-600 text-white shadow-sm"
                  : "text-amber-600 bg-amber-100 shadow-sm"
                : mobile
                ? "text-amber-600 hover:bg-amber-50"
                : "text-amber-600 hover:bg-amber-50"
            }`}
            onClick={onItemClick}
          >
            <Shield className="w-4 h-4 mr-1 inline" />
            Director
          </span>
        </PrefetchLink>
      )}
    </>
  );

  return (
    <header className="bg-background/95 backdrop-blur-lg border-b border-border/50 sticky top-0 z-50 professional-shadow">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          {/* Logo */}
          <Link href="/">
            <div className="flex items-center hover:opacity-80 transition-all duration-300 cursor-pointer group">
              <div className="p-2 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors mr-4">
                <GraduationCap className="text-primary h-8 w-8" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground tracking-tight">RS EduNav</h1>
                <p className="text-xs text-muted-foreground font-medium">Educational Intelligence</p>
              </div>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden lg:flex items-center space-x-1">
            <NavLinks />
          </nav>

          {/* Mobile Menu Button */}
          <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="lg:hidden p-2 rounded-xl">
                <Menu className="h-6 w-6" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-80 bg-background/95 backdrop-blur-lg">
              <SheetTitle className="sr-only">Navigation menu</SheetTitle>
              <SheetDescription className="sr-only">
                Links to the main sections of RS EduNav
              </SheetDescription>
              <div className="flex flex-col h-full">
                <div className="flex items-center mb-8 pt-4">
                  <div className="p-2 rounded-xl bg-primary/10 mr-4">
                    <GraduationCap className="text-primary h-8 w-8" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-foreground">RS EduNav</h1>
                    <p className="text-xs text-muted-foreground font-medium">Educational Intelligence</p>
                  </div>
                </div>
                <nav className="flex-1">
                  <div className="space-y-1">
                    <NavLinks mobile onItemClick={() => setIsMobileMenuOpen(false)} />
                  </div>
                </nav>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
