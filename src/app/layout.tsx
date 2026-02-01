import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Analytics } from "@/components/analytics";
import { ErrorBoundaryProvider } from "@/components/error-boundary-provider";

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
          <ErrorBoundaryProvider>
            {children}
          </ErrorBoundaryProvider>
        </main>

        <Footer />
      </body>
    </html>
  );
}
