'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Search, X, FileText, Calendar, Trophy } from 'lucide-react';
import { COMPETITIONS } from '@/lib/football/competitions';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface SearchResult {
  type: 'league' | 'blog' | 'match';
  title: string;
  url: string;
  subtitle?: string;
}

export function SearchModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const router = useRouter();

  const search = useCallback((searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      return;
    }

    const q = searchQuery.toLowerCase();
    const newResults: SearchResult[] = [];

    // Search competitions
    COMPETITIONS.forEach((comp) => {
      if (comp.name.toLowerCase().includes(q)) {
        newResults.push({
          type: 'league',
          title: comp.name,
          url: `/predictions/${comp.id}`,
          subtitle: comp.category.replace('-', ' '),
        });
      }
    });

    // Limit results
    setResults(newResults.slice(0, 8));
  }, []);

  useEffect(() => {
    search(query);
  }, [query, search]);

  // Keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(true);
      }
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleSelect = (url: string) => {
    setIsOpen(false);
    setQuery('');
    router.push(url);
  };

  const getTypeIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'league':
        return <Trophy className="h-4 w-4 text-primary" />;
      case 'blog':
        return <FileText className="h-4 w-4 text-blue-500" />;
      case 'match':
        return <Calendar className="h-4 w-4 text-green-500" />;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors text-muted-foreground hover:text-foreground hover:bg-muted/50"
          aria-label="Search"
        >
          <Search className="h-4 w-4" />
          <span className="hidden sm:inline text-xs opacity-70">⌘K</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg p-0 gap-0">
        <div className="flex items-center gap-3 p-4 border-b">
          <Search className="h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search leagues..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 bg-transparent border-none outline-none text-base placeholder:text-muted-foreground"
            autoFocus
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 hover:bg-muted rounded transition-colors"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {results.length > 0 ? (
            <div className="p-2">
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.url}-${index}`}
                  onClick={() => handleSelect(result.url)}
                  className={cn(
                    'w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors text-left',
                    'group'
                  )}
                >
                  <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 group-hover:bg-primary/10 transition-colors">
                    {getTypeIcon(result.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{result.title}</p>
                    {result.subtitle && (
                      <p className="text-xs text-muted-foreground capitalize">
                        {result.subtitle}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          ) : query ? (
            <div className="p-8 text-center text-muted-foreground">
              <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No results found for "{query}"</p>
            </div>
          ) : (
            <div className="p-4">
              <p className="text-xs text-muted-foreground mb-2">Quick links</p>
              <div className="grid grid-cols-2 gap-2">
                {COMPETITIONS.slice(0, 6).map((comp) => (
                  <Link
                    key={comp.id}
                    href={`/predictions/${comp.id}`}
                    onClick={() => setIsOpen(false)}
                    className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-sm"
                  >
                    <Trophy className="h-4 w-4 text-primary" />
                    <span className="truncate">{comp.name}</span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center justify-between p-3 border-t bg-muted/30 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">↵</kbd>
              to select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">↑↓</kbd>
              to navigate
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-muted text-xs">esc</kbd>
            to close
          </span>
        </div>
      </DialogContent>
    </Dialog>
  );
}
