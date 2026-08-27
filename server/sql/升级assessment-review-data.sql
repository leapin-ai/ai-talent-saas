-- 完善档案生成任务：审核数据 + 关联手动任务 ID
DO
$$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 't_assessment'
          AND column_name = 'review_data'
    ) THEN
        ALTER TABLE t_assessment
            ADD COLUMN review_data JSONB NOT NULL DEFAULT '{}'::jsonb;

        COMMENT ON COLUMN t_assessment.review_data IS '生成任务完成后写入的审核用档案数据';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 't_assessment'
          AND column_name = 'generate_task_id'
    ) THEN
        ALTER TABLE t_assessment
            ADD COLUMN generate_task_id VARCHAR(255);

        COMMENT ON COLUMN t_assessment.generate_task_id IS '完善档案生成审核手动任务ID';
    END IF;
END $$;
