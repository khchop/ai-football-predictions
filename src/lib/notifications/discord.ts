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
  const { modelId, displayName, consecutiveFailures, failureReason, lastSuccessAt } = params;

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
        name: 'Error',
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
