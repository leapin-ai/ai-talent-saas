const fs = require('fs');
const csv = require('csv-parser');
const path = require('path');

// CSV文件路径
const csvFilePath = '/Users/linzhipeng/Documents/Github/ai-talent-saas/ESCO dataset - v1.2.1 - classification - en - csv/skills_en.csv';

// 生成的SQL文件路径
const sqlFilePath = '/Users/linzhipeng/Documents/Github/ai-talent-saas/server/sql/import_skills_data.sql';

const skillTypeMap = {
  'knowledge': 'KNOWLEDGE',
  'skill': 'SKILL',
  'competence': 'COMPETENCE',
  'skill/competence': 'SKILL_COMPETENCE'
};

const reuseLevelMap = {
  'cross-sector': 'CROSS_SECTOR',
  'sector-specific': 'SECTOR_SPECIFIC',
  'occupation-specific': 'OCCUPATION_SPECIFIC',
  'transversal': 'TRANSVERSAL'
};

function escapeString(str) {
  if (!str) return 'NULL';
  return "'" + String(str).replace(/'/g, "''").replace(/\\/g, '\\\\') + "'";
}

function escapeArray(arr) {
  if (!arr || arr.length === 0) return "'[]'::jsonb";
  const jsonStr = JSON.stringify(arr);
  return "'" + jsonStr.replace(/'/g, "''") + "'::jsonb";
}

function formatDate(dateStr) {
  if (!dateStr) return 'NULL';
  return escapeString(dateStr);
}

const skills = [];

console.log('开始读取CSV文件...');

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on('data', (row) => {
    // 处理 altLabels
    let altLabels = [];
    if (row.altLabels && row.altLabels.trim()) {
      altLabels = row.altLabels.split('\n').filter(label => label.trim());
    }
    
    // 处理 hiddenLabels
    let hiddenLabels = [];
    if (row.hiddenLabels && row.hiddenLabels.trim()) {
      hiddenLabels = row.hiddenLabels.split('\n').filter(label => label.trim());
    }
    
    // 处理 inScheme
    let inScheme = [];
    if (row.inScheme && row.inScheme.trim()) {
      inScheme = row.inScheme.split(',').map(s => s.trim());
    }
    
    skills.push({
      conceptUri: row.conceptUri,
      conceptType: row.conceptType,
      skillType: skillTypeMap[row.skillType] || 'SKILL',
      reuseLevel: reuseLevelMap[row.reuseLevel] || 'TRANSVERSAL',
      preferredLabel: row.preferredLabel,
      altLabels,
      hiddenLabels,
      status: row.status,
      modifiedDate: row.modifiedDate,
      scopeNote: row.scopeNote,
      definition: row.definition,
      inScheme,
      description: row.description
    });
  })
  .on('end', () => {
    console.log(`读取完成，共 ${skills.length} 条数据`);
    console.log('开始生成SQL文件...');
    
    let sql = `-- ESCO Skills 数据导入\n`;
    sql += `-- 生成时间: ${new Date().toISOString()}\n`;
    sql += `-- 数据量: ${skills.length} 条\n\n`;
    
    sql += `INSERT INTO skills (\n`;
    sql += `  concept_uri,\n`;
    sql += `  concept_type,\n`;
    sql += `  skill_type,\n`;
    sql += `  reuse_level,\n`;
    sql += `  preferred_label,\n`;
    sql += `  alt_labels,\n`;
    sql += `  hidden_labels,\n`;
    sql += `  status,\n`;
    sql += `  modified_date,\n`;
    sql += `  scope_note,\n`;
    sql += `  definition,\n`;
    sql += `  in_scheme,\n`;
    sql += `  description,\n`;
    sql += `  created_at,\n`;
    sql += `  updated_at\n`;
    sql += `) VALUES\n`;
    
    const values = skills.map((skill, index) => {
      const comma = index === skills.length - 1 ? ';' : ',';
      return `  (\n` +
        `    ${escapeString(skill.conceptUri)},\n` +
        `    ${escapeString(skill.conceptType)},\n` +
        `    '${skill.skillType}',\n` +
        `    '${skill.reuseLevel}',\n` +
        `    ${escapeString(skill.preferredLabel)},\n` +
        `    ${escapeArray(skill.altLabels)},\n` +
        `    ${escapeArray(skill.hiddenLabels)},\n` +
        `    ${escapeString(skill.status)},\n` +
        `    ${formatDate(skill.modifiedDate)},\n` +
        `    ${escapeString(skill.scopeNote)},\n` +
        `    ${escapeString(skill.definition)},\n` +
        `    ${escapeArray(skill.inScheme)},\n` +
        `    ${escapeString(skill.description)},\n` +
        `    NOW(),\n` +
        `    NOW()\n` +
        `  )${comma}`;
    });
    
    sql += values.join('\n');
    
    sql += `\n\n-- 查询导入结果\n`;
    sql += `SELECT COUNT(*) as total_skills FROM skills;\n`;
    
    fs.writeFileSync(sqlFilePath, sql, 'utf8');
    console.log(`SQL文件已生成: ${sqlFilePath}`);
    console.log('完成！');
  })
  .on('error', (error) => {
    console.error('读取CSV文件失败:', error);
    process.exit(1);
  });
