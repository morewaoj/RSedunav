import { Link as WouterLink, LinkProps } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useCallback } from "react";

interface PrefetchLinkProps extends LinkProps {
  prefetchKey?: string | string[];
  children?: React.ReactNode;
}

export function PrefetchLink({ 
  href, 
  prefetchKey, 
  children, 
  ...props 
}: PrefetchLinkProps) {
  const handleMouseEnter = useCallback(() => {
    // Prefetch the route chunk
    if (href) {
      // Dynamic import the route component to prefetch its bundle
      switch (href) {
        case '/search':
          import('@/components/real-time-college-search');
          break;
        case '/college-search':
          import('@/components/enhanced-college-search');
          break;
        case '/career-explorer':
          import('@/components/simplified-career-explorer');
          break;
        case '/scholarships':
          import('@/pages/comprehensive-scholarships');
          break;
        case '/profile':
          import('@/pages/profile');
          break;
        case '/job-market':
          import('@/pages/job-market');
          break;
      }
    }

    // Prefetch data if key provided
    if (prefetchKey) {
      const keys = Array.isArray(prefetchKey) ? prefetchKey : [prefetchKey];
      keys.forEach(key => {
        queryClient.prefetchQuery({
          queryKey: [key],
          staleTime: 5 * 60 * 1000, // 5 minutes
        });
      });
    }
  }, [href, prefetchKey]);

  return (
    <WouterLink 
      href={href} 
      onMouseEnter={handleMouseEnter}
      {...props}
    >
      {children}
    </WouterLink>
  );
}