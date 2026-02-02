# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased] - 2026-02-02

### Fixed

#### Accuracy Calculation Correction

We fixed a bug in how model accuracy was calculated. The previous formula incorrectly counted some predictions as "correct" when they should not have been counted.

**What changed:**
- Old formula: Counted predictions where `tendencyPoints` was not null (included 0-point wrong predictions)
- New formula: Counts predictions where `tendencyPoints > 0` (only genuinely correct predictions)

**Impact:**
- Most models show ~48% lower accuracy than before
- This is the CORRECT accuracy - the old numbers were inflated
- Rankings may shift slightly as the correction affects some models more than others

**Example corrections:**

| Model | Old Accuracy | New Accuracy | Change |
|-------|--------------|--------------|--------|
| Qwen 2.5 72B Turbo (Alibaba) | 99.3% | 50.7% | -48.6% |
| DeepSeek R1 (Reasoning) | 94.2% | 43.5% | -50.7% |
| Mistral Small 3 24B (Mistral) | 94.3% | 34.2% | -60.1% |

**Why this matters:**

The corrected numbers give you a true picture of model performance. A model showing 52% accuracy now genuinely predicts correctly 52% of the time.

Football prediction is inherently difficult - professional bookmakers with sophisticated models achieve around 50-55% accuracy on outcome prediction. The new accuracy numbers reflect this reality.

**Technical details:**

The bug existed in the database query used to calculate accuracy:
```sql
-- Old (incorrect) - counted both correct AND wrong predictions
WHERE tendencyPoints IS NOT NULL

-- New (correct) - counts only correct predictions
WHERE tendencyPoints > 0
```

When a model predicts the wrong outcome, it receives 0 tendency points (not null, but zero). The old formula counted these as "correct" predictions, artificially inflating accuracy by including wrong predictions in both numerator and denominator.

**Rollback:**

Historical data is preserved for 30 days in the `stats_pre_migration` table. If you notice any issues, please report them.

**More information:**

See our [Methodology page](/methodology) for full details on how we calculate accuracy.

---
