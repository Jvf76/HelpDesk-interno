ALTER TABLE remote_session ADD COLUMN active_until TIMESTAMP WITH TIME ZONE;
ALTER TABLE remote_session ADD COLUMN native_diagnostic VARCHAR(1000);
-- No attempt from an older timing contract may be extended by deployment.
UPDATE remote_session SET phase_deadline=CURRENT_TIMESTAMP WHERE ended_at IS NULL;
