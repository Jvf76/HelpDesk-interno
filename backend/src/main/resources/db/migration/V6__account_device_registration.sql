ALTER TABLE device ADD COLUMN registration_id UUID UNIQUE;
ALTER TABLE device ADD COLUMN registration_hash VARCHAR(64);
