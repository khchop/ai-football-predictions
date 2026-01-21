'use client';

import { useState, useId } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CollapsibleProps {
  title: string;
  icon?: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Collapsible({ 
  title, 
  icon, 
  defaultOpen = false, 
  children,
  className 
}: CollapsibleProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className={cn("border-t border-border/50", className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-controls={contentId}
        className="w-full flex items-center justify-between py-4 text-left hover:bg-muted/30 transition-colors -mx-2 px-2 rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-muted-foreground">{title}</span>
        </div>
        <ChevronDown 
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
          aria-hidden="true"
        />
      </button>
      <div 
        id={contentId}
        role="region"
        aria-labelledby={contentId}
        hidden={!isOpen}
        className={cn(
          "overflow-hidden transition-all duration-200",
          isOpen ? "max-h-[1000px] opacity-100 pb-4" : "max-h-0 opacity-0"
        )}
      >
        {children}
      </div>
    </div>
  );
}
