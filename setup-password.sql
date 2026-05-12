-- ============================================
-- Password Setup - Run this in Supabase SQL Editor
-- ============================================

-- Enable pgcrypto for secure password hashing
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Table to store the hashed password (only one row allowed)
CREATE TABLE site_config (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  password_hash TEXT NOT NULL
);

-- Lock down the table completely - no one can read it via the API
ALTER TABLE site_config ENABLE ROW LEVEL SECURITY;

-- Store the password (hashed with bcrypt)
-- Change 'odlingslansen2026' to your desired password
INSERT INTO site_config (password_hash)
VALUES (crypt('odlingslansen2026', gen_salt('bf')));

-- Server-side function to verify password (runs with elevated privileges)
CREATE OR REPLACE FUNCTION verify_password(input_password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  stored_hash TEXT;
BEGIN
  SELECT password_hash INTO stored_hash FROM site_config WHERE id = 1;
  RETURN stored_hash = crypt(input_password, stored_hash);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
