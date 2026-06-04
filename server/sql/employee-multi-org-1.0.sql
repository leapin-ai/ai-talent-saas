-- 为 t_employee 表添加 tenant_org_ids 字段（JSONB 数组，支持多组织）
DO
$$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 't_employee'
          AND column_name = 'tenant_org_ids'
    ) THEN
        ALTER TABLE t_employee
            ADD COLUMN tenant_org_ids JSONB NOT NULL DEFAULT '[]'::jsonb;

        COMMENT ON COLUMN t_employee.tenant_org_ids IS '所属组织（可多选）';
    END IF;
END $$;

-- 兼容旧数据：把现有 tenant_org_id（外键）回填到 tenant_org_ids 数组
UPDATE t_employee
SET tenant_org_ids = jsonb_build_array(tenant_org_id::text)
WHERE tenant_org_id IS NOT NULL
  AND tenant_org_ids = '[]'::jsonb;
