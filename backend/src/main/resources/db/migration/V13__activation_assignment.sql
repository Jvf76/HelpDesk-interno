ALTER TABLE activation_token ADD COLUMN responsible VARCHAR(120);
ALTER TABLE activation_token ADD COLUMN store_name VARCHAR(120);
ALTER TABLE device ADD COLUMN store_name VARCHAR(120);
