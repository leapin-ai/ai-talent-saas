-- 为 t_position 添加 development_goal（发展目标）（幂等，仅修改已有表）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_position'
  ) THEN
    ALTER TABLE t_position ADD COLUMN IF NOT EXISTS "development_goal" TEXT;
    COMMENT ON COLUMN t_position."development_goal" IS '发展目标（未来业务目标）';
  END IF;
END $$;
