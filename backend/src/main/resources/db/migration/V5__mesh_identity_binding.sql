ALTER TABLE device ADD COLUMN mesh_bound_at TIMESTAMP WITH TIME ZONE;
CREATE UNIQUE INDEX device_mesh_identity_unique ON device(mesh_node);
