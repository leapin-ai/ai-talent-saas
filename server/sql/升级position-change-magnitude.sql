-- 为 t_position 添加岗位变化幅度字段（幂等）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_position'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 't_position' AND column_name = 'change_magnitude'
    ) THEN
      ALTER TABLE t_position
        ADD COLUMN "change_magnitude" VARCHAR(16) NOT NULL DEFAULT 'low';
      COMMENT ON COLUMN t_position."change_magnitude" IS '岗位变化幅度 low|medium|high（由 skill.change 汇总，AI 分析写入）';
    END IF;
  END IF;
END $$;
