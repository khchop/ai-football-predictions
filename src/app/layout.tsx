import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Analytics } from "@/components/analytics";
import Link from "next/link";
import { Sparkles, Trophy } from "lucide-react";
import { COMPETITIONS } from "@/lib/football/competitions";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Football Predictions - 29 Open-Source Models Compete | kroam.xyz",
  description: "Compare 29 open-source AI models predicting Champions League, Premier League & 15 more competitions. See which AI model performs best using the Kicktipp scoring system. Updated in real-time.",
  keywords: ["AI", "football", "predictions", "machine learning", "Champions League", "Premier League", "AI betting", "football AI", "prediction accuracy", "open source AI", "Llama", "Qwen", "DeepSeek", "Mistral"],
  metadataBase: new URL('https://kroam.xyz'),
  alternates: {
    canonical: 'https://kroam.xyz',
    languages: {
      'en-US': 'https://kroam.xyz',
      'en': 'https://kroam.xyz',
      // Future i18n support
      'de': 'https://de.kroam.xyz',
      'es': 'https://es.kroam.xyz',
      'fr': 'https://fr.kroam.xyz',
      'it': 'https://it.kroam.xyz',
    },
  },
  openGraph: {
    title: "AI Football Predictions - 29 Open-Source Models Compete",
    description: "Compare 29 open-source AI models predicting football across 17 competitions. See which AI model performs best.",
    url: 'https://kroam.xyz',
    siteName: 'kroam.xyz',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: "AI Football Predictions - 29 Models Compete",
    description: "See which open-source AI is best at predicting football matches",
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
  const organizationSchema = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "kroam.xyz",
    "url": "https://kroam.xyz",
    "description": "AI football prediction platform comparing 29 open-source AI models on match predictions across 17 competitions",
    "logo": "https://kroam.xyz/logo.png",
  };

  const websiteSchema = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "kroam.xyz - AI Football Predictions",
    "url": "https://kroam.xyz",
    "description": "Compare 29 open-source AI models predicting football matches across Champions League, Premier League, and 15 more competitions",
    "potentialAction": {
      "@type": "SearchAction",
      "target": {
        "@type": "EntryPoint",
        "urlTemplate": "https://kroam.xyz/matches?q={search_term_string}"
      },
      "query-input": "required name=search_term_string"
    },
    "inLanguage": "en-US"
  };

  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "kroam.xyz - AI Football Prediction Platform",
    "description": "Compare and track AI model predictions for football matches using the Kicktipp scoring system",
    "applicationCategory": "SportsApplication",
    "url": "https://kroam.xyz",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    "operatingSystem": "Web",
    "isAccessibleForFree": true,
    "inLanguage": "en-US"
  };

  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased min-h-screen bg-background flex flex-col`}>
        {/* Organization Schema */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }}
        />
         {/* WebSite Schema */}
         <script
           type="application/ld+json"
           dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
         />
         {/* SoftwareApplication Schema */}
         <script
           type="application/ld+json"
           dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationSchema) }}
         />
          {/* Umami Analytics */}
        <Analytics />
        {/* Background gradient effect */}
        <div className="fixed inset-0 -z-10 overflow-hidden pointer-events-none">
          <div className="absolute -top-40 -right-40 h-80 w-80 rounded-full bg-purple-500/10 blur-3xl" />
          <div className="absolute top-1/3 -left-40 h-80 w-80 rounded-full bg-indigo-500/10 blur-3xl" />
        </div>
        
        <Navigation />
        
        <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
          {children}
        </main>
        
        <footer className="border-t border-border/50 mt-auto">
          <div className="container mx-auto px-4 py-8 max-w-7xl">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 mb-6">
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-6 w-6 rounded gradient-primary flex items-center justify-center">
                    <Sparkles className="h-3 w-3 text-white" />
                  </div>
                  <span className="font-semibold">AI Predictions</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Compare 29 AI models predicting football matches across 17 competitions.
                </p>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-3">Leagues</h4>
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  {COMPETITIONS.slice(0, 8).map((comp) => (
                    <Link 
                      key={comp.id}
                      href={`/leagues/${comp.id}`}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {comp.name}
                    </Link>
                  ))}
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-3">More</h4>
                <div className="space-y-2">
                  <Link href="/matches" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
                    All Matches
                  </Link>
                  <Link href="/leaderboard" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Leaderboard
                  </Link>
                  <Link href="/blog" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Blog
                  </Link>
                </div>
              </div>
              
              <div>
                <h4 className="font-medium text-sm mb-3">About</h4>
                <div className="space-y-2">
                  <Link href="/about" className="block text-xs text-muted-foreground hover:text-foreground transition-colors">
                    About
                  </Link>
                  <a 
                    href="https://github.com" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="block text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    GitHub
                  </a>
                </div>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4 border-t border-border/30">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">AI Football Predictions</span>
              </div>
              
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Data from API-Football</span>
                <span>•</span>
                <span>For entertainment only</span>
              </div>
            </div>
          </div>
        </footer>
      </body>
    </html>
  );
}
