# Add is_anchor column to target_goals_week table

This migration adds the `is_anchor` column to the `target_goals_week` table to support the same anchor/auto distribution logic used for months.

## SQL to run:

```sql
-- Add is_anchor column to target_goals_week
ALTER TABLE target_goals_week 
ADD COLUMN IF NOT EXISTS is_anchor BOOLEAN DEFAULT false;

-- Update existing rows to mark them as anchors (since they were manually set)
UPDATE target_goals_week SET is_anchor = true WHERE is_anchor IS NULL;

-- Set default for new rows
ALTER TABLE target_goals_week 
ALTER COLUMN is_anchor SET DEFAULT false;
```

## Verification

After running the migration, verify with:

```sql
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'target_goals_week' AND column_name = 'is_anchor';
```
