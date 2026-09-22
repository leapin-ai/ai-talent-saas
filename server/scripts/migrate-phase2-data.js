/**
 * 一次性导入：skill/verdict → outlook + t_position_task；技能就绪 → t_employee_task_readiness。
 * 依赖服务已 sync 出新表。用法：在 server 目录、已配置 DB_* 环境变量时
 *   node scripts/migrate-phase2-data.js
 * 可重复执行：已有任务行的岗位跳过。
 */
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const loadEnvFile = file => {
  if (!fs.existsSync(file)) {
    return;
  }
  fs.readFileSync(file, 'utf8')
    .split('\n')
    .forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        return;
      }
      const index = trimmed.indexOf('=');
      if (index <= 0) {
        return;
      }
      const key = trimmed.slice(0, index);
      let value = trimmed.slice(index + 1);
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
};

const CHANGE = {
  must_build: 'critical_to_build',
  ai_emerging: 'ai_emerging',
  new: 'new',
  enhanced: 'increasing',
  stable: 'stable',
  declining: 'decreasing'
};

const main = async () => {
  loadEnvFile(path.resolve(__dirname, '../../.env'));
  loadEnvFile(path.resolve(__dirname, '../.env'));
  const client = new Client({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 5432),
    database: process.env.DB_DATABASE,
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD
  });
  await client.connect();
  const sqlPath = path.resolve(__dirname, '../sql/升级phase2-data-contract.sql');
  await client.query(fs.readFileSync(sqlPath, 'utf8'));

  const table = await client.query(`SELECT to_regclass('public.t_position_task') AS name`);
  if (!table.rows[0].name) {
    console.log('t_position_task 尚不存在，请先启动服务完成 sync 后再跑本脚本');
    await client.end();
    return;
  }

  const positions = await client.query(`
    SELECT id, tenant_id, skill, verdict
    FROM t_position
    WHERE deleted_at IS NULL
  `);
  let imported = 0;
  let skipped = 0;
  for (const row of positions.rows) {
    const existing = await client.query(`SELECT 1 FROM t_position_task WHERE position_id = $1 AND deleted_at IS NULL LIMIT 1`, [row.id]);
    if (existing.rowCount) {
      skipped += 1;
      continue;
    }
    const skills = Array.isArray(row.skill) ? row.skill : [];
    for (let index = 0; index < skills.length; index += 1) {
      const skill = skills[index] || {};
      const title = typeof skill.name === 'string' ? skill.name.trim() : '';
      if (!title) {
        continue;
      }
      await client.query(
        `INSERT INTO t_position_task
          (activity_group, sort_order, title, description, importance_now, importance_future, change_tag, confidence, detail, position_id, tenant_id, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,NOW(),NOW())`,
        [
          'Imported',
          index,
          title,
          '',
          Number(skill.importanceNow) || 1,
          Number(skill.importanceYear) || 1,
          CHANGE[skill.change] || 'stable',
          ['high', 'medium', 'low'].includes(skill.confidence) ? skill.confidence : 'medium',
          JSON.stringify({ citations: Array.isArray(skill.contentItems) ? skill.contentItems : [] }),
          row.id,
          row.tenant_id
        ]
      );
    }
    imported += 1;
  }
  console.log(JSON.stringify({ importedPositions: imported, skippedPositions: skipped }));
  await client.end();
};

main().catch(error => {
  console.error(error);
  process.exit(1);
});
