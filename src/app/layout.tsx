import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navigation } from "@/components/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";

const inter = Inter({
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Football Predictions - Compare AI Models",
  description: "See which AI models are best at predicting football match scores. Champions League, Premier League, World Cup and more.",
  keywords: ["AI", "football", "predictions", "machine learning", "Champions League", "Premier League"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} antialiased min-h-screen bg-background flex flex-col`}>
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
          <div className="container mx-auto px-4 py-6 max-w-7xl">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded gradient-primary flex items-center justify-center">
                  <Sparkles className="h-3 w-3 text-white" />
                </div>
                <span className="text-sm text-muted-foreground">AI Football Predictions</span>
              </div>
              
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <Link href="/about" className="hover:text-foreground transition-colors">About</Link>
                <Link href="/leaderboard" className="hover:text-foreground transition-colors">Leaderboard</Link>
                <Link href="/matches" className="hover:text-foreground transition-colors">Matches</Link>
              </div>
            </div>
            <p className="text-xs text-muted-foreground/50 text-center mt-4">
              Data from API-Football. For entertainment only.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}
