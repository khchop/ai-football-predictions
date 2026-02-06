import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import { ViewTransition } from "react";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { BottomNav } from "@/components/navigation/bottom-nav";
import { Analytics } from "@/components/analytics";
import { ErrorBoundaryProvider } from "@/components/error-boundary-provider";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Providers } from "./providers";
import { buildRootOrganizationSchema, buildRootWebSiteSchema, buildSoftwareApplicationSchema } from "@/lib/seo/schema/root";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "AI Football Predictions | Kroam",
    template: "%s",
  },
  description: "Compare 42 AI models predicting Champions League, Premier League & 15 more competitions. See which AI model performs best using the Kicktipp scoring system in real-time.",
  keywords: ["AI", "football", "predictions", "machine learning", "Champions League", "Premier League", "AI betting", "football AI", "prediction accuracy", "open source AI", "Llama", "Qwen", "DeepSeek", "Mistral"],
  metadataBase: new URL('https://kroam.xyz'),
  openGraph: {
    title: "AI Football Predictions - 42 AI Models Compete",
    description: "Compare 42 AI models predicting football across 17 competitions. See which AI model performs best.",
    url: 'https://kroam.xyz',
    siteName: 'Kroam',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: '/api/og/generic?title=AI+Football+Predictions',
        width: 1200,
        height: 630,
        alt: 'Kroam - AI Football Predictions',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: "AI Football Predictions - 42 Models Compete",
    description: "See which AI is best at predicting football matches across 17 leagues",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Single @graph with all root schemas (SCHEMA-01: no duplication)
  const rootGraph = {
    '@context': 'https://schema.org',
    '@graph': [
      buildRootOrganizationSchema(),
      buildRootWebSiteSchema(),
      buildSoftwareApplicationSchema(),
    ],
  };

  // Static skeleton fallbacks for PPR (prerendered instantly)
  const NavigationSkeleton = () => (
    <header className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-md">
      <div className="container mx-auto px-4 max-w-7xl">
        <div className="flex h-14 items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
            <div className="h-4 w-24 rounded bg-muted animate-pulse hidden sm:block" />
          </div>
          <nav className="flex items-center gap-1">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-8 w-20 rounded-lg bg-muted animate-pulse" />
            ))}
          </nav>
        </div>
      </div>
    </header>
  );

  const BottomNavSkeleton = () => (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden border-t border-border/50 bg-background/95 backdrop-blur-md safe-area-pb">
      <div className="flex items-center justify-around h-16">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <div className="h-5 w-5 rounded bg-muted animate-pulse" />
            <div className="h-3 w-12 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    </nav>
  );

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.className} antialiased min-h-screen bg-background flex flex-col`}>
        {/* Root @graph: Organization, WebSite, SoftwareApplication */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(rootGraph) }}
        />
        {/* Umami Analytics */}
        <Analytics />

        <Providers>
          {/* Background gradient effect */}
          <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
            <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-primary/5 blur-3xl" />
            <div className="absolute top-1/3 -left-40 h-80 w-80 rounded-full bg-muted/10 blur-3xl" />
          </div>

          <TooltipProvider delayDuration={300} skipDelayDuration={100}>
            {/* Navigation wrapped in Suspense for PPR compatibility */}
            <Suspense fallback={<NavigationSkeleton />}>
              <Navigation />
            </Suspense>

            <ViewTransition>
              <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl pb-20 md:pb-0">
                <Suspense>
                  <ErrorBoundaryProvider>
                    {children}
                  </ErrorBoundaryProvider>
                </Suspense>
              </main>
            </ViewTransition>

            <Footer />
            {/* Bottom nav wrapped in Suspense for PPR compatibility */}
            <Suspense fallback={<BottomNavSkeleton />}>
              <BottomNav />
            </Suspense>
          </TooltipProvider>
        </Providers>
      </body>
    </html>
  );
}
