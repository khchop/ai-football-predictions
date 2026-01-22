# Database Migration Instructions

## Run the Betting System Migration

You need to run this ONCE before the betting system can work.

---

## Option A: Via Coolify Terminal (Recommended)

1. **Open Coolify Dashboard**
   - Navigate to your application

2. **Open Terminal**
   - Click "Terminal" or SSH into the container

3. **Run Migration**
   ```bash
   cd /app
   npm run migrate:betting
   ```

4. **Expected Output:**
   ```
   🔗 Connecting to database...
   ✅ Connected to database

   [1/6] Running: Add odds columns to match_analysis
      ✅ Success

   [2/6] Running: Create seasons table
      ✅ Success

   [3/6] Running: Create model_balances table
      ✅ Success

   [4/6] Running: Create bets table
      ✅ Success

   [5/6] Running: Initialize 2024-2025 season
      ✅ Success

   [6/6] Running: Initialize model balances
      ✅ Success

   🔍 Verifying tables...
      Found 3/3 tables:
      - bets
      - model_balances
      - seasons

   ✅ Migration completed successfully!
   ```

---

## Option B: Manual SQL (If you have direct DB access)

If you use pgAdmin, psql, or any PostgreSQL client:

1. Connect to your database
2. Run the SQL file: `migrations/001_betting_system.sql`

---

## What This Migration Does

1. ✅ Adds 15 new odds columns to `match_analysis` table
   - Double Chance odds (1X, X2, 12)
   - Over/Under odds (0.5, 1.5, 2.5, 3.5, 4.5)
   - BTTS odds (Yes, No)

2. ✅ Creates 3 new tables:
   - `seasons` - Track betting seasons
   - `model_balances` - Each model's virtual money balance
   - `bets` - Individual bet records

3. ✅ Initializes current season (2024-2025)

4. ✅ Gives all active models €1,000 starting balance

---

## After Migration

Once migration is complete, you can continue with development. The app will:
- Fetch all odds types from API-Football
- Models will place 3 bets per match
- Track profit/loss instead of points

---

## Troubleshooting

### Error: "DATABASE_URL is not configured"
- Make sure DATABASE_URL environment variable is set in Coolify

### Error: "relation does not exist"
- One of the base tables (models, matches) might be missing
- Check that your database is properly initialized

### Error: "column already exists"
- Safe to ignore - migration uses IF NOT EXISTS
- Column was added in a previous attempt

---

## Need Help?

If migration fails, share the error output and I can help debug.
