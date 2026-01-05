# Holiday pay table

Add this table to store accumulated holiday pay per user.

```sql
CREATE TABLE IF NOT EXISTS holiday_pay (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS idx_holiday_pay_user_id ON holiday_pay(user_id);
```
