import { Card, CardContent } from '@/components/ui/card';
import { Calculator, CheckCircle2, XCircle, TrendingUp, Sparkles, Target } from 'lucide-react';
import Link from 'next/link';

import type { Metadata } from 'next';
import { buildGenericTitle, buildGenericDescription } from '@/lib/seo/metadata';
import { BASE_URL } from '@/lib/seo/constants';

export const metadata: Metadata = {
  title: buildGenericTitle('Prediction Methodology'),
  description: buildGenericDescription('Understand how we measure AI prediction accuracy. Our methodology uses tendency points to calculate the percentage of correct match outcome predictions.'),
  alternates: {
    canonical: `${BASE_URL}/methodology`,
  },
  openGraph: {
    title: 'Prediction Methodology | Kroam',
    description: 'Learn how we calculate AI prediction accuracy using the tendency points system.',
    url: `${BASE_URL}/methodology`,
    type: 'website',
    siteName: 'Kroam',
    images: [
      {
        url: `${BASE_URL}/api/og/generic?title=${encodeURIComponent('Prediction Methodology')}`,
        width: 1200,
        height: 630,
        alt: 'Prediction Methodology',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Prediction Methodology | Kroam',
    description: 'Methodology for measuring AI football prediction performance',
    images: [`${BASE_URL}/api/og/generic?title=${encodeURIComponent('Prediction Methodology')}`],
  },
};

export default function MethodologyPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Hero */}
      <section className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
          <Sparkles className="h-4 w-4" />
          <span>Methodology</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">
          How We Calculate Accuracy
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Our methodology for measuring AI prediction performance and ranking models.
        </p>
      </section>

      {/* The Formula */}
      <section>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                <Calculator className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-bold mb-2">Tendency Accuracy Formula</h2>
                <p className="text-muted-foreground">
                  We measure how often a model correctly predicts the match outcome (home win, draw, or away win).
                </p>
              </div>
            </div>

            <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 mb-6">
              <p className="text-sm font-medium text-primary mb-3">Formula</p>
              <div className="font-mono text-lg mb-2">
                <span className="text-foreground">Accuracy = </span>
                <span className="text-green-400">(Correct Tendencies</span>
                <span className="text-foreground"> / </span>
                <span className="text-blue-400">Scored Predictions</span>
                <span className="text-foreground">) × 100</span>
              </div>
              <div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <p className="text-green-400 font-medium mb-1">Correct Tendencies</p>
                  <p className="text-muted-foreground text-xs">
                    Predictions where the model earned tendency points (correctly predicted home win, draw, or away win)
                  </p>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                  <p className="text-blue-400 font-medium mb-1">Scored Predictions</p>
                  <p className="text-muted-foreground text-xs">
                    Total predictions for matches that have finished and been scored (excludes pending/cancelled matches)
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 text-sm">
              <p className="font-medium text-foreground mb-2">Technical Implementation</p>
              <p className="text-muted-foreground">
                We use <code className="px-1.5 py-0.5 rounded bg-muted text-primary">tendencyPoints &gt; 0</code> as the correctness check.
                This ensures only genuinely correct predictions count, as the Kicktipp system awards points only when
                the predicted outcome matches the actual result.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* What Counts as Correct */}
      <section>
        <h2 className="text-2xl font-bold mb-6">What Counts as Correct?</h2>

        <div className="grid gap-4">
          <Card className="bg-green-500/5 border-green-500/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-6 w-6 text-green-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2 text-foreground">Correct Tendency Predictions</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 font-bold">✓</span>
                      <span><strong className="text-foreground">Home Win:</strong> Model predicted home team wins, and home team won</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 font-bold">✓</span>
                      <span><strong className="text-foreground">Draw:</strong> Model predicted a draw, and match ended in a draw</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-400 font-bold">✓</span>
                      <span><strong className="text-foreground">Away Win:</strong> Model predicted away team wins, and away team won</span>
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">
                    These predictions earn tendency points (2-6 points) based on the Kicktipp quota system,
                    which rewards rarer correct predictions with more points.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-red-500/5 border-red-500/20">
            <CardContent className="p-6">
              <div className="flex items-start gap-3">
                <XCircle className="h-6 w-6 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold mb-2 text-foreground">NOT Counted in Accuracy</h3>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-start gap-2">
                      <span className="text-red-400 font-bold">✗</span>
                      <span><strong className="text-foreground">Wrong Tendencies:</strong> Predicted home win but away team won (earns 0 tendency points)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground font-bold">−</span>
                      <span><strong className="text-foreground">Pending Predictions:</strong> Matches that haven't been played yet</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-muted-foreground font-bold">−</span>
                      <span><strong className="text-foreground">Voided Predictions:</strong> Matches that were cancelled or postponed</span>
                    </li>
                  </ul>
                  <p className="text-xs text-muted-foreground mt-3">
                    Note: Exact score accuracy is tracked separately. Accuracy percentage focuses solely on
                    outcome prediction (tendency), not exact scoreline.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Example Calculations */}
      <section>
        <h2 className="text-2xl font-bold mb-6">Example Calculations</h2>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-foreground mb-3">Model A Performance</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total predictions made:</span>
                    <span className="font-mono text-foreground">150</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Matches scored:</span>
                    <span className="font-mono text-foreground">150</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-400">Correct tendencies (earned points):</span>
                    <span className="font-mono text-green-400 font-bold">75</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-400">Wrong tendencies (0 points):</span>
                    <span className="font-mono text-red-400">75</span>
                  </div>
                  <div className="border-t border-border pt-2 mt-3 flex justify-between text-base">
                    <span className="font-semibold text-foreground">Tendency Accuracy:</span>
                    <span className="font-mono font-bold text-primary">50.0%</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">
                    Calculation: (75 correct / 150 scored) × 100 = 50.0%
                  </p>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-foreground mb-3">Model B Performance</h3>
                <div className="bg-muted/50 rounded-lg p-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total predictions made:</span>
                    <span className="font-mono text-foreground">160</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Matches scored:</span>
                    <span className="font-mono text-foreground">145 (15 pending)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-400">Correct tendencies (earned points):</span>
                    <span className="font-mono text-green-400 font-bold">65</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-red-400">Wrong tendencies (0 points):</span>
                    <span className="font-mono text-red-400">80</span>
                  </div>
                  <div className="border-t border-border pt-2 mt-3 flex justify-between text-base">
                    <span className="font-semibold text-foreground">Tendency Accuracy:</span>
                    <span className="font-mono font-bold text-primary">44.8%</span>
                  </div>
                  <p className="text-xs text-muted-foreground pt-2">
                    Calculation: (65 correct / 145 scored) × 100 = 44.8% (pending matches excluded)
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Why This Matters */}
      <section>
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-8">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-3">Why Tendency Accuracy Matters</h2>
                <div className="space-y-3 text-muted-foreground">
                  <p>
                    Football prediction is inherently difficult. Historical data shows that professional bookmakers,
                    with access to vast data and sophisticated models, achieve around 50-55% accuracy on outcome prediction.
                  </p>
                  <p>
                    Our accuracy metric gives you a true picture of model performance. If a model shows 52% tendency accuracy,
                    it genuinely predicts the correct match outcome 52% of the time - better than random chance (33.3% with
                    three outcomes: home/draw/away).
                  </p>
                  <p>
                    Combined with the Kicktipp quota system (which rewards rare correct predictions), this creates a realistic
                    and transparent benchmark for comparing AI models.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Related Links */}
      <section>
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="p-8">
            <h2 className="text-xl font-bold mb-4 text-center">Learn More</h2>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/about"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-card border border-border font-medium hover:bg-muted transition-colors"
              >
                <TrendingUp className="h-4 w-4" />
                How Scoring Works
              </Link>
              <Link
                href="/leaderboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                View Leaderboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
