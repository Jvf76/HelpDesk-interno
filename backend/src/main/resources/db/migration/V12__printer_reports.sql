CREATE TABLE printer (id VARCHAR(40) PRIMARY KEY, label VARCHAR(100) NOT NULL, serial VARCHAR(60), supported BOOLEAN NOT NULL, collector UUID REFERENCES device(id));
INSERT INTO printer (id,label,serial,supported) VALUES
('lexmark-lab','Lexmark MX511de','701533HH09191',TRUE),
('ricoh-3710','Ricoh SP 3710SF',NULL,FALSE),
('ricoh-varjao','Ricoh 4510 · Varjão de Minas','G156R730202',FALSE),
('brother-paracatu','Brother · Paracatu',NULL,FALSE);
CREATE TABLE printer_job (id UUID PRIMARY KEY, batch UUID NOT NULL, printer_id VARCHAR(40) NOT NULL REFERENCES printer(id), collector UUID, status VARCHAR(24) NOT NULL, requested_at TIMESTAMP WITH TIME ZONE NOT NULL, received_at TIMESTAMP WITH TIME ZONE, pdf BYTEA);
CREATE INDEX printer_batch ON printer_job(batch);
CREATE INDEX printer_queue ON printer_job(collector,status,requested_at);
