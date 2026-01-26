import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Brain, TrendingUp, Target, Zap } from 'lucide-react';

interface PredictionSummaryData {
  totalPredictions: number;
  avgPointsPerPrediction: number;
  tendencyAccuracy: number;
  exactScoreAccuracy: number;
  mostPredictedResult: 'H' | 'D' | 'A';
  confidence: number;
  predictionBreakdown: Array<{
    resultType: string;
    count: number;
    avgPoints: number;
  }>;
}

interface CompetitionPredictionSummaryProps {
  summary: PredictionSummaryData;
}

function ResultBadge({ result, count, percentage }: { result: string; count: number; percentage: number }) {
  const colors: Record<string, string> = {
    'H': 'bg-green-600',
    'D': 'bg-yellow-500',
    'A': 'bg-red-600',
  };
  
  const labels: Record<string, string> = {
    'H': 'Home Win',
    'D': 'Draw',
    'A': 'Away Win',
  };
  
  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
      <div className={`w-8 h-8 rounded flex items-center justify-center text-white font-bold text-sm ${colors[result] || 'bg-gray-500'}`}>
        {result}
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{labels[result] || result}</p>
        <p className="text-xs text-muted-foreground">{count} predictions</p>
      </div>
      <div className="text-right">
        <p className="text-sm font-semibold">{percentage.toFixed(1)}%</p>
        <p className="text-xs text-muted-foreground">avg {percentage > 0 ? (count / percentage * 100).toFixed(1) : 0} pts</p>
      </div>
    </div>
  );
}

export async function CompetitionPredictionSummary({ summary }: CompetitionPredictionSummaryProps) {
  if (!summary || summary.totalPredictions === 0) {
    return (
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Prediction Insights
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm text-center py-8">
            No prediction data available for this competition yet.
          </p>
        </CardContent>
      </Card>
    );
  }
  
  const total = summary.predictionBreakdown.reduce((sum, p) => sum + p.count, 0) || 1;
  
  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          AI Prediction Insights
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Model Consensus */}
        <div className="mb-6 p-4 rounded-lg bg-primary/5 border border-primary/10">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">Model Consensus</span>
            </div>
            <span className="text-xs text-muted-foreground">
              {summary.confidence}% confidence
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <ResultBadge 
              result={summary.mostPredictedResult} 
              count={summary.predictionBreakdown.find(p => p.resultType === summary.mostPredictedResult)?.count || 0}
              percentage={summary.confidence}
            />
            <div className="text-center px-3">
              <p className="text-xs text-muted-foreground mb-1">AI Average</p>
              <p className="text-lg font-bold text-primary">{summary.avgPointsPerPrediction}</p>
              <p className="text-xs text-muted-foreground">pts/prediction</p>
            </div>
          </div>
        </div>
        
        {/* Prediction Breakdown */}
        <div className="mb-6">
          <p className="text-sm text-muted-foreground mb-3">Prediction Distribution</p>
          <div className="space-y-2">
            {summary.predictionBreakdown.map((p) => (
              <ResultBadge 
                key={p.resultType}
                result={p.resultType}
                count={p.count}
                percentage={(p.count / total) * 100}
              />
            ))}
          </div>
        </div>
        
        {/* Accuracy Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Target className="h-4 w-4 text-green-500" />
              <span className="text-xs text-muted-foreground">Tendency Accuracy</span>
            </div>
            <p className="text-2xl font-bold">{summary.tendencyAccuracy}%</p>
            <p className="text-xs text-muted-foreground">correct result</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 mb-1">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className="text-xs text-muted-foreground">Exact Score</span>
            </div>
            <p className="text-2xl font-bold">{summary.exactScoreAccuracy}%</p>
            <p className="text-xs text-muted-foreground">perfect match</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
