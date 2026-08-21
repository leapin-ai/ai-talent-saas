-- file-manager file_record 增加 options 扩展字段（幂等，仅修改已有表）
-- 对应 @kne/fastify-file-manager 3.x model: libs/models/file-record.js

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_file_manager_file_record'
  ) THEN
    ALTER TABLE t_file_manager_file_record
      ADD COLUMN IF NOT EXISTS "options" JSONB DEFAULT '{}'::jsonb;
    COMMENT ON COLUMN t_file_manager_file_record."options" IS '扩展字段';
  END IF;
END $$;
