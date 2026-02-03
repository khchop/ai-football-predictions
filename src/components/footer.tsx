import Link from 'next/link';
import { Calendar, Trophy, Home, FileText, Sparkles, Calculator } from 'lucide-react';
import { COMPETITIONS } from '@/lib/football/competitions';
import { CopyrightYear } from './copyright-year';

export function Footer() {
  return (
    <footer className="border-t border-border/50 bg-muted/30">
      <div className="container mx-auto px-4 max-w-7xl py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg gradient-primary flex items-center justify-center">
                <Sparkles className="h-4 w-4 text-white" />
              </div>
              <span className="font-bold">AI Predictions</span>
            </Link>
            <p className="text-sm text-muted-foreground">
              Compare 29 open-source AI models predicting football matches across 17 competitions.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold mb-4">Quick Access</h3>
            <nav className="flex flex-col gap-2" aria-label="Quick links">
              <Link href="/matches" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Calendar className="h-4 w-4" />
                Matches
              </Link>
              <Link href="/leaderboard" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Trophy className="h-4 w-4" />
                Leaderboard
              </Link>
              <Link href="/methodology" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Calculator className="h-4 w-4" />
                Methodology
              </Link>
              <Link href="/blog" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <FileText className="h-4 w-4" />
                Blog
              </Link>
              <Link href="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                <Home className="h-4 w-4" />
                Home
              </Link>
            </nav>
          </div>

          {/* Competitions - European */}
          <div>
            <h3 className="font-semibold mb-4">European Competitions</h3>
            <nav className="flex flex-col gap-2" aria-label="European competitions">
              {COMPETITIONS.filter(c => c.category === 'club-europe').map(comp => (
                <Link
                  key={comp.id}
                  href={`/leagues/${comp.id}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{comp.icon || '⚽'}</span>
                  <span>{comp.name}</span>
                </Link>
              ))}
            </nav>
          </div>

          {/* Competitions - Domestic & International */}
          <div>
            <h3 className="font-semibold mb-4">Domestic & International</h3>
            <nav className="flex flex-col gap-2" aria-label="Domestic and international competitions">
              {COMPETITIONS.filter(c => c.category !== 'club-europe').map(comp => (
                <Link
                  key={comp.id}
                  href={`/leagues/${comp.id}`}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <span>{comp.icon || '⚽'}</span>
                  <span>{comp.name}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © <CopyrightYear /> AI Football Predictions. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Built with Next.js, Tailwind CSS, and shadcn/ui
          </p>
        </div>
      </div>
    </footer>
  );
}
