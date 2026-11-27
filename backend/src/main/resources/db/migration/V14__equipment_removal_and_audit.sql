ALTER TABLE device ADD COLUMN removed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE device ADD CONSTRAINT removed_device_revoked CHECK (removed_at IS NULL OR revoked=TRUE);
ALTER TABLE printer ADD COLUMN removed_at TIMESTAMP WITH TIME ZONE;
CREATE TABLE printer_change(
 id UUID PRIMARY KEY, printer_id VARCHAR(40) NOT NULL REFERENCES printer(id),
 action VARCHAR(40) NOT NULL, before_value VARCHAR(200), after_value VARCHAR(200),
 changed_at TIMESTAMP WITH TIME ZONE NOT NULL
);
CREATE INDEX printer_change_history ON printer_change(printer_id,changed_at);
CREATE INDEX audit_resource_history ON audit_event(resource_id,created_at);
