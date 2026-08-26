-- 为 t_position 表添加 tenant_org_id（关联组织部门，单选）
DO
$$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 't_position'
          AND column_name = 'tenant_org_id'
    ) THEN
        ALTER TABLE t_position
            ADD COLUMN tenant_org_id BIGINT;

        COMMENT ON COLUMN t_position.tenant_org_id IS '所属组织部门';
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS t_position_tenant_org_id
    ON t_position (tenant_org_id)
    WHERE deleted_at IS NULL;
