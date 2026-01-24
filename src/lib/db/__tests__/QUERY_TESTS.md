# Database Query Tests

## Overview

This document describes the test cases for the new database query functions:
- `getModelRank(modelId)` - Returns the global rank of a model based on average points
- `getModelResultTypeBreakdown(modelId)` - Returns prediction breakdown by result type (H/D/A)

## Test Cases

### getModelRank

#### Test 1: Basic Ranking
**Setup:**
- Model A with 5 predictions averaging 10.5 points
- Model B with 6 predictions averaging 8.3 points  
- Model C with 4 predictions averaging 6.0 points

**Expected:**
- getModelRank('A') returns 1
- getModelRank('B') returns 2
- getModelRank('C') returns 3

#### Test 2: Model with No Predictions
**Setup:**
- Model D with 0 predictions
- Models A, B, C as above

**Expected:**
- getModelRank('D') returns 4 (ranked below all models with predictions)

#### Test 3: Ties in Rankings
**Setup:**
- Model A with avg 10.5 points
- Model B with avg 10.5 points
- Model C with avg 8.0 points

**Expected:**
- Both Model A and B should rank as 1 (or implementation-specific handling)
- Model C should rank as 2

#### Test 4: Single Prediction Per Model
**Setup:**
- Model A with 1 prediction scoring 5 points (avg: 5)
- Model B with 1 prediction scoring 10 points (avg: 10)

**Expected:**
- getModelRank('A') returns 2
- getModelRank('B') returns 1

### getModelResultTypeBreakdown

#### Test 5: All Result Types Present
**Setup:**
- Model X with:
  - 10 Home predictions: 6 correct (avg: 8 pts)
  - 5 Draw predictions: 2 correct (avg: 5 pts)
  - 8 Away predictions: 4 correct (avg: 6 pts)

**Expected:**
```javascript
[
  { resultType: 'H', count: 10, avgPoints: 8, accuracy: 60.0 },
  { resultType: 'D', count: 5, avgPoints: 5, accuracy: 40.0 },
  { resultType: 'A', count: 8, avgPoints: 6, accuracy: 50.0 },
]
```

#### Test 6: Missing Result Type (Draw)
**Setup:**
- Model Y with:
  - 10 Home predictions: 7 correct (avg: 9 pts)
  - 0 Draw predictions
  - 6 Away predictions: 3 correct (avg: 4 pts)

**Expected:**
```javascript
[
  { resultType: 'H', count: 10, avgPoints: 9, accuracy: 70.0 },
  { resultType: 'D', count: 0, avgPoints: 0, accuracy: 0 },
  { resultType: 'A', count: 6, avgPoints: 4, accuracy: 50.0 },
]
```

#### Test 7: Consistent Ordering
**Setup:**
- Any model with various predictions

**Expected:**
- Results always in order: [Home, Draw, Away]
- Independent of which types have data

#### Test 8: Accuracy Calculation
**Setup:**
- Model Z with:
  - 4 Home predictions: 3 correct
  - 2 Draw predictions: 1 correct
  - 4 Away predictions: 1 correct

**Expected:**
```javascript
[
  { resultType: 'H', count: 4, avgPoints: ?, accuracy: 75.0 },  // 3/4 = 75%
  { resultType: 'D', count: 2, avgPoints: ?, accuracy: 50.0 },  // 1/2 = 50%
  { resultType: 'A', count: 4, avgPoints: ?, accuracy: 25.0 },  // 1/4 = 25%
]
```

#### Test 9: No Predictions at All
**Setup:**
- Model W with 0 scored predictions

**Expected:**
```javascript
[
  { resultType: 'H', count: 0, avgPoints: 0, accuracy: 0 },
  { resultType: 'D', count: 0, avgPoints: 0, accuracy: 0 },
  { resultType: 'A', count: 0, avgPoints: 0, accuracy: 0 },
]
```

#### Test 10: Only Scored Predictions
**Setup:**
- Model V with:
  - 10 Home predictions with status='scored': 6 correct
  - 5 Home predictions with status='pending': should be ignored
  - 3 Home predictions with status='cancelled': should be ignored

**Expected:**
```javascript
[
  { resultType: 'H', count: 10, avgPoints: ?, accuracy: 60.0 },  // Only scored (6/10)
  { resultType: 'D', count: 0, avgPoints: 0, accuracy: 0 },
  { resultType: 'A', count: 0, avgPoints: 0, accuracy: 0 },
]
```

## Implementation Notes

### Performance Considerations

1. **getModelRank**: 
   - Single query approach reduces database load
   - Future optimization: Consider 5-10 minute caching
   - Currently O(n) where n = number of active models with predictions

2. **getModelResultTypeBreakdown**:
   - Single database query with GROUP BY
   - Result post-processing to ensure all 3 types present
   - Performance: O(p) where p = predictions for this model

### Edge Cases Handled

- Models with no predictions
- Result types with no predictions  
- Division by zero in accuracy calculation (handled by SQL CASE expression)
- NULL values in aggregation functions

### Database Assumptions

- `predictions.totalPoints` nullable, treated as 0
- `predictions.predictedResult` values: 'H', 'D', 'A'
- `predictions.status` typically 'scored' or 'pending'
- `models.active` boolean flag for active/inactive models

## Running the Tests

When a testing framework is set up (Jest recommended):

```bash
npm install --save-dev jest @jest/globals @types/jest ts-jest
npm test
```

Current status: Tests documented, ready for implementation with test framework.
