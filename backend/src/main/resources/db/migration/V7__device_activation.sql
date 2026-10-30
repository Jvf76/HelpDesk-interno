ALTER TABLE device ADD COLUMN organization VARCHAR(40) NOT NULL DEFAULT 'UAI_TELECOM';
ALTER TABLE device ADD COLUMN public_code VARCHAR(20);
UPDATE device SET public_code=UPPER(SUBSTRING(REPLACE(CAST(id AS VARCHAR),'-',''),1,12));
CREATE UNIQUE INDEX device_public_code_unique ON device(public_code);
ALTER TABLE remote_session ALTER COLUMN technician_id DROP NOT NULL;
ALTER TABLE remote_session ADD COLUMN requester_device_id UUID REFERENCES device(id);
ALTER TABLE remote_session ADD COLUMN requester_name VARCHAR(200);
ALTER TABLE remote_session ADD COLUMN requester_code VARCHAR(20);
ALTER TABLE remote_session ADD COLUMN windows_user VARCHAR(120);
CREATE TABLE activation_token (
 id UUID PRIMARY KEY, token_hash VARCHAR(64) UNIQUE NOT NULL,
 organization VARCHAR(40) NOT NULL, issued_by UUID NOT NULL REFERENCES app_user(id),
 expires_at TIMESTAMP WITH TIME ZONE NOT NULL, state VARCHAR(20) NOT NULL,
 target_id UUID REFERENCES device(id), installation_id UUID, credential_hash VARCHAR(64),
 device_id UUID REFERENCES device(id)
);
