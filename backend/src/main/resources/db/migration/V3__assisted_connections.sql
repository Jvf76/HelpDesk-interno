ALTER TABLE remote_session ADD COLUMN consent_only BOOLEAN NOT NULL DEFAULT FALSE;
CREATE TABLE connection_attempt (
  attempt_key VARCHAR(64) PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_start TIMESTAMP WITH TIME ZONE NOT NULL
);
