-- 为 t_position 添加 AI 岗位分析独立状态字段（幂等）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_position'
  ) THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 't_position' AND column_name = 'analysis_status'
    ) THEN
      ALTER TABLE t_position
        ADD COLUMN "analysis_status" VARCHAR(32) NOT NULL DEFAULT 'idle';
      COMMENT ON COLUMN t_position."analysis_status" IS 'AI岗位分析状态 idle|generating|completed';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 't_position' AND column_name = 'analysis_progress'
    ) THEN
      ALTER TABLE t_position
        ADD COLUMN "analysis_progress" INTEGER NOT NULL DEFAULT 0;
      COMMENT ON COLUMN t_position."analysis_progress" IS 'AI岗位分析进度 0-100';
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 't_position' AND column_name = 'analysis_task_id'
    ) THEN
      ALTER TABLE t_position
        ADD COLUMN "analysis_task_id" VARCHAR(255);
      COMMENT ON COLUMN t_position."analysis_task_id" IS 'AI岗位分析手动任务ID';
    END IF;
  END IF;
END $$;
