import { Card, CardContent } from '@/components/ui/card';
import { Calendar, Bot, Trophy, Target, Sparkles, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export const metadata = {
  title: 'How It Works - AI Football Predictions',
  description: 'Learn how our AI models predict football match scores and compete against each other.',
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-12">
      {/* Hero */}
      <section className="text-center py-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm mb-4">
          <Sparkles className="h-4 w-4" />
          <span>How It Works</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">
          AI Models Compete to Predict Football
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          We test multiple AI models on their ability to predict football match scores.
          Each model gets the same information and makes its prediction independently.
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
                <h3 className="text-xl font-semibold mb-2">1. Daily Fixture Fetch</h3>
                <p className="text-muted-foreground">
                  Every day, we fetch upcoming matches from major competitions including the 
                  UEFA Champions League, Premier League, Europa League, Conference League, 
                  World Cup, and international tournaments. We track fixtures up to 48 hours ahead.
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
                  About 1 hour before each match kicks off, when lineups are confirmed, we send the same prompt to each AI model.
                  The models only receive the team names, competition, and match date - they must 
                  use their training data to make predictions.
                </p>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
                  <p className="text-muted-foreground mb-2"># Example prompt:</p>
                  <p className="text-foreground">
                    Predict the final score: Real Madrid vs Monaco<br />
                    Competition: UEFA Champions League<br />
                    Respond with JSON: {`{"home_score": X, "away_score": Y}`}
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
                <h3 className="text-xl font-semibold mb-2">3. Scoring System</h3>
                <p className="text-muted-foreground mb-4">
                  After each match finishes, we compare predictions to the actual result 
                  and award points:
                </p>
                <div className="grid sm:grid-cols-3 gap-4">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-green-400">3</p>
                    <p className="text-sm text-muted-foreground">Exact Score</p>
                    <p className="text-xs text-green-400/70 mt-1">Perfect prediction</p>
                  </div>
                  <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-yellow-400">1</p>
                    <p className="text-sm text-muted-foreground">Correct Result</p>
                    <p className="text-xs text-yellow-400/70 mt-1">Win/Draw/Loss right</p>
                  </div>
                  <div className="bg-muted/50 border border-border rounded-lg p-4 text-center">
                    <p className="text-3xl font-bold text-muted-foreground">0</p>
                    <p className="text-sm text-muted-foreground">Wrong</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">Incorrect prediction</p>
                  </div>
                </div>
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
                <h3 className="text-xl font-semibold mb-2">4. Leaderboard Rankings</h3>
                <p className="text-muted-foreground">
                  Models are ranked by their average points per prediction. We track exact score 
                  percentage, correct result percentage, and total points. Over time, we can see 
                  which AI models are best at predicting football matches.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* AI Models */}
      <section>
        <h2 className="text-2xl font-bold mb-6">AI Models We Test</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            { name: 'Llama 3.3 70B', provider: 'Groq', tier: 'Free' },
            { name: 'Llama 3.1 8B', provider: 'Groq', tier: 'Free' },
            { name: 'Gemini 2.0 Flash', provider: 'Google', tier: 'Free' },
            { name: 'Llama 3.3 70B', provider: 'Cloudflare', tier: 'Free' },
            { name: 'Llama 3.2 3B', provider: 'OpenRouter', tier: 'Free' },
            { name: 'Gemma 2 9B', provider: 'OpenRouter', tier: 'Free' },
            { name: 'Llama 3.1 8B', provider: 'Together AI', tier: 'Free' },
            { name: 'Mistral Small', provider: 'Mistral', tier: 'Free' },
            { name: 'Llama 3.1 8B', provider: 'Hugging Face', tier: 'Free' },
          ].map((model, i) => (
            <div 
              key={i} 
              className="p-4 rounded-lg bg-card/50 border border-border/50 flex items-center justify-between"
            >
              <div>
                <p className="font-medium">{model.name}</p>
                <p className="text-sm text-muted-foreground">{model.provider}</p>
              </div>
              <span className="px-2 py-1 rounded text-xs bg-primary/10 text-primary">
                {model.tier}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="text-center py-8">
        <Card className="bg-gradient-to-r from-primary/10 to-accent/10 border-primary/20">
          <CardContent className="p-8">
            <h2 className="text-2xl font-bold mb-2">Ready to see the predictions?</h2>
            <p className="text-muted-foreground mb-6">
              Check out upcoming matches and see which AI models are leading.
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
