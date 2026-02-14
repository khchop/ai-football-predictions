/**
 * Discord Webhook Notification Service
 *
 * Sends rich embed alerts to Discord when models are auto-disabled
 * or show regression. Gracefully degrades when DISCORD_WEBHOOK_URL
 * is not configured.
 *
 * Fire-and-forget pattern: Never throws, logs errors internally.
 */

import { loggers } from '@/lib/logger/modules';

// ----- Type Definitions -----

interface DiscordEmbed {
  title: string;
  description?: string;
  color: number;
  fields: Array<{
    name: string;
    value: string;
    inline?: boolean;
  }>;
  timestamp?: string;
  footer?: {
    text: string;
  };
}

interface AutoDisableParams {
  modelId: string;
  displayName: string;
  consecutiveFailures: number;
  failureReason: string;
  lastSuccessAt: string | null;
  errorType?: string;
}

export interface PredictionRunFailure {
  modelId: string;
  displayName: string;
  errorType: string;
  errorMessage: string;
}

interface RegressionItem {
  modelId: string;
  displayName: string;
  previousSuccessRate: number;
  currentSuccessRate: number;
  drop: number;
  severity: 'warning' | 'critical';
}

// ----- Core Send Function -----

/**
 * Send a Discord webhook notification with rich embed.
 * Gracefully returns if DISCORD_WEBHOOK_URL is not set.
 * Logs errors but never throws (fire-and-forget).
 */
async function sendDiscordAlert(embed: DiscordEmbed): Promise<void> {
  // Read directly from process.env (avoid env.ts getter which throws)
  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

  if (!webhookUrl) {
    loggers.discord.debug('DISCORD_WEBHOOK_URL not set, skipping alert');
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        embeds: [embed],
      }),
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      const text = await response.text();
      loggers.discord.error(
        {
          status: response.status,
          statusText: response.statusText,
          body: text.substring(0, 200),
        },
        'Discord webhook request failed'
      );
    } else {
      loggers.discord.debug({ title: embed.title }, 'Discord alert sent successfully');
    }
  } catch (error) {
    // Never throw - fire and forget
    const errorMsg = error instanceof Error ? error.message : String(error);
    loggers.discord.error(
      { error: errorMsg, title: embed.title },
      'Failed to send Discord alert'
    );
  }
}

// ----- Alert Builders -----

/**
 * Send auto-disable alert when a model hits the consecutive failure threshold.
 */
export async function sendAutoDisableAlert(params: AutoDisableParams): Promise<void> {
  const { modelId, displayName, consecutiveFailures, failureReason, lastSuccessAt, errorType } = params;

  const embed: DiscordEmbed = {
    title: '🔴 Model Auto-Disabled',
    color: 0xff0000, // Red
    fields: [
      {
        name: 'Model',
        value: `${displayName}\n\`${modelId}\``,
        inline: false,
      },
      {
        name: 'Consecutive Failures',
        value: String(consecutiveFailures),
        inline: true,
      },
      {
        name: 'Last Success',
        value: lastSuccessAt || 'Never',
        inline: true,
      },
      {
        name: 'Error Type',
        value: errorType || 'unknown',
        inline: true,
      },
      {
        name: 'Error Details',
        value: failureReason.substring(0, 200),
        inline: false,
      },
      {
        name: 'Suggested Action',
        value: `Check model status on OpenRouter dashboard. If persistent, consider archiving:\n\`\`\`sql\nUPDATE models SET archived = true WHERE id = '${modelId}';\n\`\`\``,
        inline: false,
      },
    ],
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Auto-Disable Alert | Threshold: 5 failures',
    },
  };

  await sendDiscordAlert(embed);
}

/**
 * Send regression alert when daily stats show models dropping >10% success rate.
 */
export async function sendRegressionAlert(regressions: RegressionItem[]): Promise<void> {
  if (regressions.length === 0) {
    return;
  }

  const hasCritical = regressions.some((r) => r.severity === 'critical');
  const criticalCount = regressions.filter((r) => r.severity === 'critical').length;
  const warningCount = regressions.filter((r) => r.severity === 'warning').length;

  // Limit to 10 regressions (Discord embed field limit is 25, but keep readable)
  const displayRegressions = regressions.slice(0, 10);

  const embed: DiscordEmbed = {
    title: `⚠️ Model Regression Detected (${regressions.length})`,
    description: `${criticalCount} critical, ${warningCount} warning`,
    color: hasCritical ? 0xff0000 : 0xffa500, // Red if any critical, orange if warnings only
    fields: displayRegressions.map((r) => ({
      name: `${r.severity === 'critical' ? '🔴' : '🟡'} ${r.displayName}`,
      value: `${r.previousSuccessRate.toFixed(1)}% → ${r.currentSuccessRate.toFixed(1)}% (drop: ${r.drop.toFixed(1)}%)`,
      inline: false,
    })),
    timestamp: new Date().toISOString(),
    footer: {
      text: 'Regression Alert | Threshold: >10% drop',
    },
  };

  // Add suggested action field
  embed.fields.push({
    name: 'Suggested Action',
    value: 'Review model health in admin dashboard at `/admin`',
    inline: false,
  });

  await sendDiscordAlert(embed);
}

/**
 * Send prediction run summary when any models fail during prediction generation.
 * Groups failures by error type for easy troubleshooting.
 */
export async function sendPredictionRunSummary(params: {
  matchLabel: string;
  totalModels: number;
  successful: number;
  failed: number;
  failures: PredictionRunFailure[];
}): Promise<void> {
  const { matchLabel, totalModels, successful, failed, failures } = params;

  // No notification for clean runs
  if (failures.length === 0) {
    return;
  }

  try {
    // Color: orange if < 50% failed, red if >= 50% failed
    const color = failed >= totalModels / 2 ? 0xff0000 : 0xffa500;

    // Group failures by errorType
    const groupedFailures = failures.reduce<Record<string, PredictionRunFailure[]>>((acc, failure) => {
      if (!acc[failure.errorType]) {
        acc[failure.errorType] = [];
      }
      acc[failure.errorType].push(failure);
      return acc;
    }, {});

    // Build fields for each error type group
    const fields: Array<{ name: string; value: string; inline: boolean }> = [];
    let totalShown = 0;
    const LIMIT = 10; // Show at most 10 failures total

    for (const [errorType, groupFailures] of Object.entries(groupedFailures)) {
      if (totalShown >= LIMIT) break;

      const failuresToShow = groupFailures.slice(0, LIMIT - totalShown);
      const value = failuresToShow
        .map(f => {
          const truncatedMsg = f.errorMessage.substring(0, 80);
          return `- ${f.displayName}: ${truncatedMsg}`;
        })
        .join('\n');

      fields.push({
        name: `${errorType} (${groupFailures.length} model${groupFailures.length > 1 ? 's' : ''})`,
        value,
        inline: false,
      });

      totalShown += failuresToShow.length;
    }

    // Add "+N more" if we hit the limit
    if (failures.length > LIMIT) {
      const remaining = failures.length - LIMIT;
      fields.push({
        name: 'Additional Failures',
        value: `(+${remaining} more failure${remaining > 1 ? 's' : ''})`,
        inline: false,
      });
    }

    const embed: DiscordEmbed = {
      title: `Prediction Run: ${successful}/${totalModels} succeeded`,
      description: matchLabel,
      color,
      fields,
      timestamp: new Date().toISOString(),
      footer: {
        text: 'Prediction Run Summary',
      },
    };

    await sendDiscordAlert(embed);
  } catch (error) {
    // Fire-and-forget: log errors but never throw
    const errorMsg = error instanceof Error ? error.message : String(error);
    loggers.discord.error(
      { error: errorMsg, matchLabel },
      'Failed to send prediction run summary'
    );
  }
}
