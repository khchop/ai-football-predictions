'use client';

import { useState } from 'react';
import { useSwipeable } from 'react-swipeable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';

interface MatchTabsMobileProps {
  children: {
    summary: React.ReactNode;
    stats: React.ReactNode;
    predictions: React.ReactNode;
    analysis: React.ReactNode;
  };
  defaultTab?: 'summary' | 'stats' | 'predictions' | 'analysis';
}

const TAB_ORDER = ['summary', 'stats', 'predictions', 'analysis'] as const;

export function MatchTabsMobile({
  children,
  defaultTab = 'summary',
}: MatchTabsMobileProps) {
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  // Swipe gesture handlers for tab navigation
  const handlers = useSwipeable({
    onSwipedLeft: () => {
      const currentIndex = TAB_ORDER.indexOf(activeTab as any);
      if (currentIndex < TAB_ORDER.length - 1) {
        setActiveTab(TAB_ORDER[currentIndex + 1]);
      }
    },
    onSwipedRight: () => {
      const currentIndex = TAB_ORDER.indexOf(activeTab as any);
      if (currentIndex > 0) {
        setActiveTab(TAB_ORDER[currentIndex - 1]);
      }
    },
    preventScrollOnSwipe: true, // Prevent horizontal scroll during swipe
    trackMouse: false, // Only touch devices, not mouse drag
    delta: 50, // Minimum swipe distance before triggering (pixels)
  });

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
      {/* Tab triggers with 44px minimum touch targets (WCAG 2.5.5 AAA) */}
      <TabsList className="w-full grid grid-cols-4 min-h-[44px]">
        <TabsTrigger value="summary" className="min-h-[44px] px-4">
          Summary
        </TabsTrigger>
        <TabsTrigger value="stats" className="min-h-[44px] px-4">
          Stats
        </TabsTrigger>
        <TabsTrigger value="predictions" className="min-h-[44px] px-4">
          Predictions
        </TabsTrigger>
        <TabsTrigger value="analysis" className="min-h-[44px] px-4">
          Analysis
        </TabsTrigger>
      </TabsList>

      {/* Tab content with swipe handlers attached */}
      <div {...handlers} className="mt-6">
        <TabsContent value="summary">{children.summary}</TabsContent>
        <TabsContent value="stats">{children.stats}</TabsContent>
        <TabsContent value="predictions">{children.predictions}</TabsContent>
        <TabsContent value="analysis">{children.analysis}</TabsContent>
      </div>
    </Tabs>
  );
}
