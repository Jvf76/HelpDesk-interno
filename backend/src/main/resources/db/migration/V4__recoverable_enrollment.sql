ALTER TABLE device ADD COLUMN enrollment_receipt_hash VARCHAR(64);
ALTER TABLE device ADD COLUMN enrollment_receipt_expires TIMESTAMP WITH TIME ZONE;
