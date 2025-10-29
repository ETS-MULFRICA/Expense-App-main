-- Store temporary passwords for users after admin reset
CREATE TABLE IF NOT EXISTS temp_passwords (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  temp_password TEXT NOT NULL,
  shown_on_login BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_temp_passwords_user_created ON temp_passwords(user_id, created_at DESC);
