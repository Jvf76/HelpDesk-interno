ALTER TABLE remote_session ADD COLUMN phase VARCHAR(40) NOT NULL DEFAULT 'REQUESTED';
ALTER TABLE remote_session ADD COLUMN phase_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE remote_session ADD COLUMN phase_deadline TIMESTAMP WITH TIME ZONE;
ALTER TABLE remote_session ADD COLUMN requested_mode VARCHAR(10);
UPDATE remote_session SET phase='TERMINATED' WHERE ended_at IS NOT NULL;
-- Existing in-flight sessions are not reauthorized by an upgrade.
UPDATE remote_session SET phase_deadline=CURRENT_TIMESTAMP WHERE ended_at IS NULL;
CREATE TABLE remote_transition (
 id UUID PRIMARY KEY,
 session_id UUID NOT NULL REFERENCES remote_session(id) ON DELETE CASCADE,
 previous_state VARCHAR(40), next_state VARCHAR(40) NOT NULL,
 component VARCHAR(30) NOT NULL, occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
 elapsed_ms BIGINT NOT NULL, error_code VARCHAR(60), safe_message VARCHAR(200) NOT NULL
);
CREATE INDEX remote_transition_session_time ON remote_transition(session_id,occurred_at);
