// Scholarship deadline utilities

export interface DeadlineStatus {
  status: 'expired' | 'urgent' | 'closing-soon' | 'upcoming' | 'ongoing';
  daysUntil: number | null;
  label: string;
  urgencyLevel: number; // 0-4 (0 = expired, 4 = plenty of time)
}

export function parseDeadline(deadline: string | null | undefined): Date | null {
  if (!deadline) return null;
  
  // Handle special cases
  const lowerDeadline = deadline.toLowerCase();
  if (lowerDeadline.includes('varies') || 
      lowerDeadline.includes('rolling') || 
      lowerDeadline.includes('last day')) {
    return null; // Ongoing/variable deadline
  }
  
  // Try to parse the date
  const parsed = new Date(deadline);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }
  
  // Try common formats
  const monthDayYear = deadline.match(/(\w+)\s+(\d{1,2}),?\s*(\d{4})/);
  if (monthDayYear) {
    const parsed = new Date(`${monthDayYear[1]} ${monthDayYear[2]}, ${monthDayYear[3]}`);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  
  return null;
}

export function getDeadlineStatus(deadline: string | null | undefined): DeadlineStatus {
  const lowerDeadline = (deadline || '').toLowerCase();
  
  // Handle special cases
  if (!deadline || lowerDeadline.includes('varies') || lowerDeadline.includes('rolling')) {
    return {
      status: 'ongoing',
      daysUntil: null,
      label: 'Rolling/Ongoing',
      urgencyLevel: 4
    };
  }
  
  const deadlineDate = parseDeadline(deadline);
  if (!deadlineDate) {
    return {
      status: 'ongoing',
      daysUntil: null,
      label: 'Check website for deadline',
      urgencyLevel: 3
    };
  }
  
  const now = new Date();
  const diffTime = deadlineDate.getTime() - now.getTime();
  const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (daysUntil < 0) {
    return {
      status: 'expired',
      daysUntil,
      label: 'Deadline Passed',
      urgencyLevel: 0
    };
  }
  
  if (daysUntil <= 7) {
    return {
      status: 'urgent',
      daysUntil,
      label: daysUntil === 0 ? 'Due Today!' : daysUntil === 1 ? '1 day left!' : `${daysUntil} days left!`,
      urgencyLevel: 1
    };
  }
  
  if (daysUntil <= 30) {
    return {
      status: 'closing-soon',
      daysUntil,
      label: `${daysUntil} days left`,
      urgencyLevel: 2
    };
  }
  
  if (daysUntil <= 90) {
    return {
      status: 'upcoming',
      daysUntil,
      label: `${Math.ceil(daysUntil / 7)} weeks left`,
      urgencyLevel: 3
    };
  }
  
  return {
    status: 'upcoming',
    daysUntil,
    label: `${Math.ceil(daysUntil / 30)} months left`,
    urgencyLevel: 4
  };
}

export function formatDeadline(deadline: string | null | undefined): string {
  if (!deadline) return 'Check website';
  
  const deadlineDate = parseDeadline(deadline);
  if (!deadlineDate) return deadline;
  
  return deadlineDate.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });
}

export function sortByDeadlineUrgency<T extends { deadline?: string | null }>(
  scholarships: T[], 
  excludeExpired: boolean = true
): T[] {
  return scholarships
    .map(s => ({
      scholarship: s,
      status: getDeadlineStatus(s.deadline)
    }))
    .filter(item => !excludeExpired || item.status.status !== 'expired')
    .sort((a, b) => {
      // Expired last (or filtered out)
      if (a.status.status === 'expired' && b.status.status !== 'expired') return 1;
      if (b.status.status === 'expired' && a.status.status !== 'expired') return -1;
      
      // Ongoing/rolling at the end of active
      if (a.status.status === 'ongoing' && b.status.status !== 'ongoing') return 1;
      if (b.status.status === 'ongoing' && a.status.status !== 'ongoing') return -1;
      
      // Sort by days until deadline (closest first)
      if (a.status.daysUntil !== null && b.status.daysUntil !== null) {
        return a.status.daysUntil - b.status.daysUntil;
      }
      
      return 0;
    })
    .map(item => item.scholarship);
}
