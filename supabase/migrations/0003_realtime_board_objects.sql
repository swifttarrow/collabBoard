-- Enable Realtime for board_objects: add to publication and set REPLICA IDENTITY.
-- REPLICA IDENTITY FULL allows receiving old record on UPDATE/DELETE for LWW reconciliation.

alter publication supabase_realtime add table board_objects;

alter table board_objects replica identity full;
