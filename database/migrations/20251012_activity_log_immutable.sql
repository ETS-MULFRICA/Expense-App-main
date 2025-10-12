-- Enforce immutability of activity_log without DO blocks for broad compatibility

-- Create or replace trigger function that blocks updates/deletes
CREATE OR REPLACE FUNCTION activity_log_no_update_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'activity_log entries are immutable (no % allowed)', TG_OP;
END;
$$;

-- Recreate triggers idempotently
DROP TRIGGER IF EXISTS prevent_activity_log_update ON activity_log;
CREATE TRIGGER prevent_activity_log_update
BEFORE UPDATE ON activity_log
FOR EACH ROW
EXECUTE FUNCTION activity_log_no_update_delete();

DROP TRIGGER IF EXISTS prevent_activity_log_delete ON activity_log;
CREATE TRIGGER prevent_activity_log_delete
BEFORE DELETE ON activity_log
FOR EACH ROW
EXECUTE FUNCTION activity_log_no_update_delete();
