import { getDb } from '@/lib/db';
import { modelUsage } from '@/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { OpenRouterProvider, ModelTier } from './providers/openrouter';

// Get today's date in YYYY-MM-DD format
function getTodayDate(): string {
  return new Date().toISOString().split('T')[0];
}

// Get daily budget from environment (default $1.00/day)
export function getDailyBudget(): number {
  const budget = process.env.DAILY_BUDGET;
  return budget ? parseFloat(budget) : 1.00;
}

// Get total spent today across all models
export async function getTodaySpend(): Promise<number> {
  const db = getDb();
  const today = getTodayDate();
  
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(CAST(${modelUsage.totalCost} AS REAL)), 0)`,
    })
    .from(modelUsage)
    .where(eq(modelUsage.date, today));
  
  return parseFloat(result[0]?.total || '0');
}

// Get remaining budget for today
export async function getRemainingBudget(): Promise<number> {
  const spent = await getTodaySpend();
  const budget = getDailyBudget();
  return Math.max(0, budget - spent);
}

// Check if we can afford a prediction with given estimated cost
export async function canAffordPrediction(estimatedCost: number): Promise<boolean> {
  const remaining = await getRemainingBudget();
  return remaining >= estimatedCost;
}

// Check if a provider should be skipped based on tier and budget
export async function shouldSkipProvider(
  provider: OpenRouterProvider | { tier?: ModelTier; estimateCost?: (i: number, o: number) => number }
): Promise<{ skip: boolean; reason?: string }> {
  // Non-OpenRouter providers (Groq, Gemini direct, Mistral direct) are free
  if (!('tier' in provider) || !provider.tier) {
    return { skip: false };
  }

  // Free tier models never skipped
  if (provider.tier === 'free') {
    return { skip: false };
  }

  // Check budget for paid models
  const estimatedCost = provider.estimateCost ? provider.estimateCost(200, 20) : 0;
  const canAfford = await canAffordPrediction(estimatedCost);
  
  if (!canAfford) {
    const remaining = await getRemainingBudget();
    return {
      skip: true,
      reason: `Budget exhausted (remaining: $${remaining.toFixed(4)}, needed: $${estimatedCost.toFixed(4)})`,
    };
  }

  return { skip: false };
}

// Record a prediction's cost (atomic upsert to prevent race conditions)
export async function recordPredictionCost(
  modelId: string,
  cost: number
): Promise<void> {
  const db = getDb();
  const today = getTodayDate();
  const now = new Date().toISOString();

  // Atomic upsert: insert or update in a single operation
  await db
    .insert(modelUsage)
    .values({
      id: uuidv4(),
      date: today,
      modelId,
      predictionsCount: 1,
      totalCost: cost.toFixed(6),
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: [modelUsage.date, modelUsage.modelId],
      set: {
        predictionsCount: sql`${modelUsage.predictionsCount} + 1`,
        totalCost: sql`CAST(CAST(${modelUsage.totalCost} AS NUMERIC) + ${cost} AS TEXT)`,
        updatedAt: now,
      },
    });
}

// Get budget status for display
export async function getBudgetStatus(): Promise<{
  dailyBudget: number;
  spent: number;
  remaining: number;
  percentUsed: number;
}> {
  const dailyBudget = getDailyBudget();
  const spent = await getTodaySpend();
  const remaining = Math.max(0, dailyBudget - spent);
  const percentUsed = dailyBudget > 0 ? (spent / dailyBudget) * 100 : 0;

  return {
    dailyBudget,
    spent,
    remaining,
    percentUsed,
  };
}

// Get usage breakdown by model for today
export async function getTodayUsageByModel(): Promise<
  Array<{
    modelId: string;
    predictionsCount: number;
    totalCost: number;
  }>
> {
  const db = getDb();
  const today = getTodayDate();

  const results = await db
    .select({
      modelId: modelUsage.modelId,
      predictionsCount: modelUsage.predictionsCount,
      totalCost: modelUsage.totalCost,
    })
    .from(modelUsage)
    .where(eq(modelUsage.date, today));

  return results.map((r) => ({
    modelId: r.modelId,
    predictionsCount: r.predictionsCount || 0,
    totalCost: parseFloat(r.totalCost || '0'),
  }));
}
