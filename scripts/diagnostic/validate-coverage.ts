/**
 * Model Coverage Validation Script
 *
 * Performs offline (no API keys needed) validation of model coverage and
 * configuration completeness across all 42 LLM providers.
 *
 * Checks:
 * - All providers have valid id, name, model, and pricing
 * - Synthetic models: fallback mapping status
 * - Special config coverage: promptVariant and responseHandler settings
 * - Identifies "risk models" (Synthetic, no fallback, default config)
 *
 * Usage: npm run validate:coverage
 *
 * Phase 57: Fallback expansion audit and coverage validation
 */

import { ALL_PROVIDERS, MODEL_FALLBACKS } from '../../src/lib/llm';
import { PromptVariant } from '../../src/lib/llm/prompt-variants';
import { ResponseHandler } from '../../src/lib/llm/response-handlers';

// ============================================================================
// TYPES
// ============================================================================

interface ModelValidation {
  id: string;
  name: string;
  displayName: string;
  provider: 'together' | 'synthetic';
  hasValidId: boolean;
  hasValidName: boolean;
  hasValidModel: boolean;
  hasValidPricing: boolean;
  hasFallback: boolean;
  fallbackTarget: string | null;
  promptVariant: string;
  responseHandler: string;
  hasSpecialConfig: boolean;
  isCovered: boolean;
  isRiskModel: boolean;
  errors: string[];
}

interface CoverageReport {
  totalModels: number;
  togetherCount: number;
  syntheticCount: number;
  fallbackCount: number;
  specialConfigCount: number;
  coveredCount: number;
  uncoveredCount: number;
  coveragePercent: number;
  riskModels: string[];
  misconfigured: string[];
  validations: ModelValidation[];
}

// ============================================================================
// VALIDATION LOGIC
// ============================================================================

function validateModel(provider: typeof ALL_PROVIDERS[number]): ModelValidation {
  const errors: string[] = [];

  // Basic field validation
  const hasValidId = typeof provider.id === 'string' && provider.id.length > 0;
  if (!hasValidId) errors.push('Missing or empty id');

  const hasValidName = typeof provider.name === 'string' && provider.name.length > 0;
  if (!hasValidName) errors.push('Missing or empty name');

  const hasValidModel = typeof provider.model === 'string' && provider.model.length > 0;
  if (!hasValidModel) errors.push('Missing or empty model');

  // Pricing validation - access through the pricing property
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const providerImpl = provider as any;
  const pricing = providerImpl.pricing as { promptPer1M: number; completionPer1M: number } | undefined;
  const hasValidPricing = !!(pricing && pricing.promptPer1M > 0 && pricing.completionPer1M > 0);
  if (!hasValidPricing) errors.push('Missing or zero pricing');

  // Provider type detection
  const isSynthetic = provider.name === 'synthetic';
  const providerType: 'together' | 'synthetic' = isSynthetic ? 'synthetic' : 'together';

  // Fallback check (only relevant for Synthetic models)
  const hasFallback = isSynthetic && provider.id in MODEL_FALLBACKS;
  const fallbackTarget = hasFallback ? MODEL_FALLBACKS[provider.id] : null;

  // Prompt config check
  const promptConfig = providerImpl.promptConfig as {
    promptVariant?: PromptVariant;
    responseHandler?: ResponseHandler;
    timeoutMs?: number;
  } | undefined;

  const promptVariant = promptConfig?.promptVariant || PromptVariant.BASE;
  const responseHandler = promptConfig?.responseHandler || ResponseHandler.DEFAULT;
  const hasSpecialConfig = promptVariant !== PromptVariant.BASE || responseHandler !== ResponseHandler.DEFAULT;

  // Coverage determination:
  // A model is "covered" if ANY of these is true:
  // (a) It's a Together AI model (reliable baseline)
  // (b) It has a fallback mapping to Together AI
  // (c) It has special promptVariant + responseHandler configured
  const isCovered = !isSynthetic || hasFallback || hasSpecialConfig;

  // Risk model = Synthetic + no fallback + default config
  const isRiskModel = isSynthetic && !hasFallback && !hasSpecialConfig;

  return {
    id: provider.id,
    name: provider.name,
    displayName: provider.displayName,
    provider: providerType,
    hasValidId,
    hasValidName,
    hasValidModel,
    hasValidPricing,
    hasFallback,
    fallbackTarget,
    promptVariant,
    responseHandler,
    hasSpecialConfig,
    isCovered,
    isRiskModel,
    errors,
  };
}

function generateReport(): CoverageReport {
  const validations = ALL_PROVIDERS.map(validateModel);

  const togetherCount = validations.filter(v => v.provider === 'together').length;
  const syntheticCount = validations.filter(v => v.provider === 'synthetic').length;
  const fallbackCount = validations.filter(v => v.hasFallback).length;
  const specialConfigCount = validations.filter(v => v.hasSpecialConfig).length;
  const coveredCount = validations.filter(v => v.isCovered).length;
  const uncoveredCount = validations.filter(v => !v.isCovered).length;
  const coveragePercent = (coveredCount / validations.length) * 100;
  const riskModels = validations.filter(v => v.isRiskModel).map(v => v.id);
  const misconfigured = validations.filter(v => v.errors.length > 0).map(v => v.id);

  return {
    totalModels: validations.length,
    togetherCount,
    syntheticCount,
    fallbackCount,
    specialConfigCount,
    coveredCount,
    uncoveredCount,
    coveragePercent,
    riskModels,
    misconfigured,
    validations,
  };
}

// ============================================================================
// OUTPUT FORMATTING
// ============================================================================

function printReport(report: CoverageReport): void {
  console.log('');
  console.log('============================================================================');
  console.log('MODEL COVERAGE VALIDATION REPORT');
  console.log('============================================================================');
  console.log('');

  // Summary
  console.log('## Summary');
  console.log('');
  console.log(`Total models:        ${report.totalModels} (${report.togetherCount} Together + ${report.syntheticCount} Synthetic)`);
  console.log(`Fallback coverage:   ${report.fallbackCount}/${report.syntheticCount} Synthetic models have Together AI fallbacks`);
  console.log(`Special configs:     ${report.specialConfigCount} models have non-default promptVariant/responseHandler`);
  console.log(`Theoretical coverage:${report.coveredCount}/${report.totalModels} (${report.coveragePercent.toFixed(1)}%)`);
  console.log(`Uncovered models:    ${report.uncoveredCount}`);
  console.log('');

  // Fallback mappings
  console.log('## Fallback Mappings');
  console.log('');
  const fallbackModels = report.validations.filter(v => v.hasFallback);
  if (fallbackModels.length === 0) {
    console.log('No fallback mappings configured.');
  } else {
    console.log('| Synthetic Model          | Together Fallback    |');
    console.log('|--------------------------|----------------------|');
    for (const model of fallbackModels) {
      console.log(`| ${model.id.padEnd(24)} | ${(model.fallbackTarget || '-').padEnd(20)} |`);
    }
  }
  console.log('');

  // Special config models
  console.log('## Special Configurations');
  console.log('');
  const specialModels = report.validations.filter(v => v.hasSpecialConfig);
  if (specialModels.length === 0) {
    console.log('No models with special configurations.');
  } else {
    console.log('| Model                        | Prompt Variant       | Response Handler     |');
    console.log('|------------------------------|----------------------|----------------------|');
    for (const model of specialModels) {
      console.log(`| ${model.id.padEnd(28)} | ${model.promptVariant.padEnd(20)} | ${model.responseHandler.padEnd(20)} |`);
    }
  }
  console.log('');

  // Risk models (uncovered)
  if (report.riskModels.length > 0) {
    console.log('## Risk Models (Synthetic, no fallback, default config)');
    console.log('');
    console.log('These models have no Together AI fallback AND use default prompt/handler config.');
    console.log('If they fail, there is no automatic recovery path.');
    console.log('');
    for (const id of report.riskModels) {
      console.log(`  - ${id}`);
    }
    console.log('');
  }

  // Misconfigured models
  if (report.misconfigured.length > 0) {
    console.log('## Misconfigured Models');
    console.log('');
    for (const id of report.misconfigured) {
      const validation = report.validations.find(v => v.id === id);
      if (validation) {
        console.log(`  - ${id}: ${validation.errors.join(', ')}`);
      }
    }
    console.log('');
  }

  // Per-provider breakdown
  console.log('## Per-Provider Breakdown');
  console.log('');
  console.log('| Model                        | Provider  | Fallback | Special Config | Covered |');
  console.log('|------------------------------|-----------|----------|----------------|---------|');
  for (const v of report.validations) {
    const fallback = v.hasFallback ? `-> ${v.fallbackTarget}` : '-';
    const special = v.hasSpecialConfig ? `${v.promptVariant}` : '-';
    const covered = v.isCovered ? 'YES' : 'NO';
    console.log(`| ${v.id.padEnd(28)} | ${v.provider.padEnd(9)} | ${fallback.padEnd(8)} | ${special.padEnd(14)} | ${covered.padEnd(7)} |`);
  }
  console.log('');

  // Final status
  console.log('============================================================================');
  if (report.misconfigured.length > 0) {
    console.log(`RESULT: FAIL - ${report.misconfigured.length} model(s) misconfigured`);
  } else {
    console.log(`RESULT: PASS - All ${report.totalModels} models properly configured`);
    if (report.riskModels.length > 0) {
      console.log(`WARNING: ${report.riskModels.length} risk model(s) have no fallback or special config`);
    }
  }
  console.log('============================================================================');
  console.log('');
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  const report = generateReport();
  printReport(report);

  // Exit 1 if any model is misconfigured (missing id, name, model, or pricing)
  if (report.misconfigured.length > 0) {
    process.exit(1);
  }

  // Exit 0 - all validations passed
  // Risk models are warnings, not failures (they work, just have no recovery path)
  process.exit(0);
}

main();
