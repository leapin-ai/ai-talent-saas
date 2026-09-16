-- 采集邀请：token → code（@kne/fastify-shorten）
-- Sequelize alter 不会重命名列，且会先建 code 唯一索引导致 column "code" does not exist
DO
$$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 't_talent_collect_invite'
          AND column_name = 'code'
    ) THEN
        ALTER TABLE t_talent_collect_invite
            ADD COLUMN code VARCHAR(255);

        COMMENT ON COLUMN t_talent_collect_invite.code IS '采集邀请短链码（@kne/fastify-shorten）';
    END IF;

    IF EXISTS (
        SELECT 1
        FROM pg_indexes
        WHERE tablename = 't_talent_collect_invite'
          AND indexname = 't_talent_collect_invite_token'
    ) THEN
        DROP INDEX IF EXISTS t_talent_collect_invite_token;
    END IF;

    IF EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_name = 't_talent_collect_invite'
          AND column_name = 'token'
    ) THEN
        ALTER TABLE t_talent_collect_invite
            DROP COLUMN token;
    END IF;
END $$;
