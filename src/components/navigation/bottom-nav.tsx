'use client';

import { usePathname } from 'next/navigation';
import { Home, Calendar, Trophy, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HoverPrefetchLink } from './hover-prefetch-link';

/**
 * Mobile bottom navigation bar.
 *
 * Research shows bottom navigation is 21% faster for mobile task completion
 * compared to hamburger menus (49% of users navigate with thumb only).
 *
 * Features:
 * - Fixed at bottom of viewport with safe area padding for iOS
 * - Hidden on md+ breakpoints (desktop uses header nav)
 * - 44px minimum touch targets (WCAG 2.5.5 AAA)
 * - Intent-based prefetching via HoverPrefetchLink
 * - Matches header nav items for consistency
 */

const navItems = [
  { href: '/', label: 'Home', icon: Home },
  { href: '/matches', label: 'Matches', icon: Calendar },
  { href: '/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/blog', label: 'Blog', icon: FileText },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/50 bg-background/95 backdrop-blur-md safe-area-pb"
      aria-label="Primary mobile navigation"
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <HoverPrefetchLink
              key={item.href}
              href={item.href}
              aria-current={isActive ? 'page' : undefined}
              className={cn(
                'flex flex-col items-center justify-center gap-1 w-full h-full min-h-[44px]',
                'text-xs font-medium transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2',
                isActive ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
              <span>{item.label}</span>
            </HoverPrefetchLink>
          );
        })}
      </div>
    </nav>
  );
}
