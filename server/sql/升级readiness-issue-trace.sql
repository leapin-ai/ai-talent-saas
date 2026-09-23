-- 纠错反馈表补快照/处理字段（幂等；新环境靠 sync 建表）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_readiness_issue'
  ) THEN
    ALTER TABLE t_readiness_issue ADD COLUMN IF NOT EXISTS "activity_group" VARCHAR(200);
    COMMENT ON COLUMN t_readiness_issue."activity_group" IS '反馈时活动分组快照';

    ALTER TABLE t_readiness_issue ADD COLUMN IF NOT EXISTS "current" INTEGER;
    COMMENT ON COLUMN t_readiness_issue."current" IS '反馈时当前水平快照 0-5';

    ALTER TABLE t_readiness_issue ADD COLUMN IF NOT EXISTS "required" INTEGER;
    COMMENT ON COLUMN t_readiness_issue."required" IS '反馈时要求水平快照 0-5';

    ALTER TABLE t_readiness_issue ADD COLUMN IF NOT EXISTS "readiness_status" VARCHAR(16);
    COMMENT ON COLUMN t_readiness_issue."readiness_status" IS '反馈时就绪状态快照';

    ALTER TABLE t_readiness_issue ADD COLUMN IF NOT EXISTS "confidence" VARCHAR(16);
    COMMENT ON COLUMN t_readiness_issue."confidence" IS '反馈时置信度快照';

    ALTER TABLE t_readiness_issue ADD COLUMN IF NOT EXISTS "reported_by" BIGINT;
    COMMENT ON COLUMN t_readiness_issue."reported_by" IS '提交人 tenant_user id';

    ALTER TABLE t_readiness_issue ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMP WITH TIME ZONE;
    COMMENT ON COLUMN t_readiness_issue."resolved_at" IS '处理时间';

    ALTER TABLE t_readiness_issue ADD COLUMN IF NOT EXISTS "resolved_by" BIGINT;
    COMMENT ON COLUMN t_readiness_issue."resolved_by" IS '处理人 tenant_user id';

    ALTER TABLE t_readiness_issue ADD COLUMN IF NOT EXISTS "resolve_note" TEXT;
    COMMENT ON COLUMN t_readiness_issue."resolve_note" IS '处理备注';
  END IF;
END $$;
