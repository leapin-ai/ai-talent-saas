-- 采集邀请无租户账号时，assessment.tenant_user_id 可空（幂等，仅修改已有表）

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 't_assessment'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 't_assessment'
        AND column_name = 'tenant_user_id'
        AND is_nullable = 'NO'
    ) THEN
      ALTER TABLE t_assessment ALTER COLUMN "tenant_user_id" DROP NOT NULL;
    END IF;
    COMMENT ON COLUMN t_assessment."tenant_user_id" IS '租户用户ID（采集邀请无账号时可空）';
  END IF;
END $$;
