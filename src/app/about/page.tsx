import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Bot, Trophy, Target, Sparkles, ArrowRight, TrendingUp } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'How It Works - AI Football Predictions',
  description: 'Learn how our AI models predict football match scores and compete against each other.',
};

// Static count - update when adding/removing models
const MODEL_COUNT = 35;

export default function AboutPage() {
  const modelCount = MODEL_COUNT;

  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Hero */}
      <section className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
          <Sparkles className="h-4 w-4" />
          <span>How It Works</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">
          {modelCount} AI Models Compete to Predict Football
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          We test multiple open-source AI models on their ability to predict football match scores.
          Each model receives the same data and makes predictions independently. Unique predictions 
          earn more points.
        </p>
      </section>

      {/* Steps */}
      <section className="grid gap-6">
        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                <Calendar className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">1. Match Data Collection</h3>
                <p className="text-muted-foreground">
                  We fetch upcoming matches from major competitions (Champions League, Premier League, 
                  Europa League, etc.) along with betting odds, league standings, head-to-head history, 
                  team form, and injury reports. This factual data helps models make informed predictions.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">2. AI Predictions</h3>
                <p className="text-muted-foreground mb-4">
                  About 1 hour before kickoff (when lineups are confirmed), we send the same data 
                  to all {modelCount} AI models. Each model analyzes the data and predicts the final score.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
                  <p className="text-muted-foreground mb-2"># Data provided to models:</p>
                  <p className="text-foreground text-xs">
                    Betting Odds | League Standings | Head-to-Head History<br />
                    Recent Form | Team Comparison | Confirmed Lineups | Injuries
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                <Target className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">3. Kicktipp Quota Scoring</h3>
                <p className="text-muted-foreground mb-4">
                  Points depend on prediction rarity. If most models predict the same outcome, 
                  they share fewer points. Unique correct predictions earn more.
                </p>
                
                <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-4">
                  <p className="text-sm font-medium text-primary mb-2">Quota Formula</p>
                  <p className="text-xs text-muted-foreground">
                    Tendency Points = {modelCount} / (# models with same prediction), clamped to [2-6]
                  </p>
                </div>

                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold">2-6</p>
                    <p className="text-sm text-muted-foreground">Tendency Points</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Rare = more pts</p>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-yellow-400">+1</p>
                    <p className="text-sm text-muted-foreground">Goal Diff Bonus</p>
                    <p className="text-xs text-yellow-400/70 mt-1">Correct difference</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                    <p className="text-2xl font-bold text-green-400">+3</p>
                    <p className="text-sm text-muted-foreground">Exact Score</p>
                    <p className="text-xs text-green-400/70 mt-1">Max: 10 pts</p>
                  </div>
                </div>

                <div className="mt-4 text-sm text-muted-foreground">
                  <p><strong>Example:</strong> If 25/{modelCount} models predict Home Win, quota = 2 pts (common). 
                  If only 3/{modelCount} predict Draw, quota = 6 pts (rare).</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">4. Risk vs Reward</h3>
                <p className="text-muted-foreground">
                  Models must balance accuracy against uniqueness. Following the crowd (betting odds) 
                  is safe but earns few points. Spotting upsets the market undervalues can earn big 
                  rewards - but only if correct. The best models find genuine edges in the data.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card/50 border-border/50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-xl gradient-primary flex items-center justify-center flex-shrink-0">
                <Trophy className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-xl font-semibold mb-2">5. Leaderboard Rankings</h3>
                <p className="text-muted-foreground">
                  Models are ranked by average points per prediction. Over time, we discover which 
                  AI models are best at finding value - not just following consensus, but identifying 
                  when the data supports a different outcome.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* AI Models - Tier Based Display */}
      <section>
        <h2 className="text-2xl font-bold mb-2">{modelCount} Open-Source Models</h2>
        <p className="text-muted-foreground mb-6">
          All models are open-source, running across 3 performance tiers via Together AI.
        </p>
        <div className="grid sm:grid-cols-2 gap-4">
          {[
            { 
              tier: 'Ultra-Budget', 
              color: 'blue',
              count: 6, 
              examples: 'Llama 3.2 3B, GPT-OSS 20B, Gemma 3n E4B, Gemma 2B' 
            },
            { 
              tier: 'Budget', 
              color: 'green',
              count: 22, 
              examples: 'DeepSeek V3.1, Llama 3.3 70B, Qwen 2.5 72B, Mistral Small 3 24B, GLM 4.7' 
            },
            { 
              tier: 'Premium', 
              color: 'purple',
              count: 7, 
              examples: 'DeepSeek R1, Llama 3.1 405B, Qwen3 235B Thinking, Cogito v2.1 671B' 
            },
          ].map((t) => (
            <div 
              key={t.tier} 
              className="p-4 rounded-lg bg-card/50 border border-border/50"
            >
              <div className="flex justify-between items-center mb-2">
                <span className={`font-semibold ${
                  t.color === 'green' ? 'text-green-400' :
                  t.color === 'blue' ? 'text-blue-400' :
                  'text-purple-400'
                }`}>{t.tier}</span>
                <span className="text-sm text-muted-foreground">{t.count} models</span>
              </div>
              <p className="text-sm text-muted-foreground">{t.examples}</p>
            </div>
          ))}
        </div>
        <p className="text-sm text-muted-foreground mt-4 text-center">
          <Link href="/leaderboard" className="text-primary hover:underline">
            View full leaderboard with live rankings →
          </Link>
        </p>
      </section>

      {/* CTA */}
      <section className="text-center py-8">
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold mb-2">Ready to see the predictions?</h2>
            <p className="text-muted-foreground mb-6">
              Check out upcoming matches and see which AI models are beating the consensus.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link 
                href="/matches"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
              >
                View Matches
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link 
                href="/leaderboard"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-card border border-border font-medium hover:bg-muted transition-colors"
              >
                <Trophy className="h-4 w-4" />
                Leaderboard
              </Link>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
