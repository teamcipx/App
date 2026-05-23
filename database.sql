-- Run this SQL in your Supabase SQL Editor to create the necessary tables.

CREATE TABLE IF NOT EXISTS settings (
  id integer PRIMARY KEY DEFAULT 1,
  daily_ad_limit integer NOT NULL DEFAULT 10,
  coins_per_ad integer NOT NULL DEFAULT 100,
  min_withdraw integer NOT NULL DEFAULT 5000,
  coin_rate numeric NOT NULL DEFAULT 0.01,
  notice_text text NOT NULL DEFAULT 'Welcome to xN Coin!',
  notice_active boolean NOT NULL DEFAULT true
);

INSERT INTO settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS users (
  telegram_id bigint PRIMARY KEY,
  balance integer NOT NULL DEFAULT 0,
  ads_watched_today integer NOT NULL DEFAULT 0,
  last_ad_date text NOT NULL DEFAULT '',
  referred_by bigint REFERENCES users(telegram_id),
  is_banned boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS withdrawals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL REFERENCES users(telegram_id),
  method text NOT NULL,
  details text NOT NULL,
  amount integer NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  url text NOT NULL,
  reward integer NOT NULL DEFAULT 80,
  wait_time integer NOT NULL DEFAULT 30,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id bigint NOT NULL REFERENCES users(telegram_id),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  last_completed timestamp with time zone DEFAULT now(),
  UNIQUE(telegram_id, task_id)
);

-- Disable RLS for now so the app works with Anon key, or add policies
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals DISABLE ROW LEVEL SECURITY;
ALTER TABLE tasks DISABLE ROW LEVEL SECURITY;
ALTER TABLE user_tasks DISABLE ROW LEVEL SECURITY;

-- Note: Since we are using an Anon Key for the MVP without authentication, 
-- we will not enable Row Level Security (RLS) for now. 
-- In a production environment, you MUST implement RLS and authenticate users properly 
-- via Supabase Auth or a Service Role Key backend.
