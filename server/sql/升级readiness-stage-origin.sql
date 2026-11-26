-- 就绪度阶段数据：记录版本来源（退回并应用历史版本 / 人工编辑输出）（幂等；新环境靠 sync 建表）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_readiness_stage_data'
  ) THEN
    ALTER TABLE t_readiness_stage_data ADD COLUMN IF NOT EXISTS "origin" JSONB;
    COMMENT ON COLUMN t_readiness_stage_data."origin" IS '版本来源：{ type: restore|edit, fromId, fromVersion }；为空表示正常执行产生';
  END IF;
END $$;
