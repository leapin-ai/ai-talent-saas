const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const crypto = require('crypto');

const csvDir = path.join(__dirname, '../ESCO dataset - v1.2.1 - classification - en - csv');
const outputDir = path.join(__dirname, '../sql-output');

// 创建输出目录
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 雪花ID生成器（简化版）
const EPOCH = 1704067200000; // 2024-01-01 00:00:00 UTC
let sequence = 0;
let lastTimestamp = 0;

// 从URI生成ID（确保相同URI生成相同ID）
function getIdFromUri(uri) {
    if (!uri || uri === '') return 'NULL';
    if (uriToId.has(uri)) {
        return uriToId.get(uri);
    }
    // 使用URI的哈希值生成雪花ID
    const hash = crypto.createHash('md5').update(uri).digest('hex');
    const hashNum = BigInt('0x' + hash.substring(0, 15));
    const timestamp = Number(hashNum % BigInt(Date.now() - EPOCH)) + EPOCH;
    const sequence = Number(hashNum % 4096);
    const workerId = Number(hashNum % 32);
    const dataCenterId = Number(hashNum % 32);

    const snowflakeId = ((timestamp - EPOCH) << 22n) | (BigInt(dataCenterId) << 17n) | (BigInt(workerId) << 12n) | BigInt(sequence);
    const idStr = snowflakeId.toString();
    uriToId.set(uri, idStr);
    return idStr;
}

// 转义字符串
function escapeString(str) {
    if (str === null || str === undefined || str === '') {
        return 'NULL';
    }
    let escaped = String(str)
        .replace(/'/g, "''")
        .replace(/\n/g, ' ')
        .replace(/\r/g, ' ')
        .replace(/\t/g, ' ');
    if (escaped.length > 5000) escaped = escaped.substring(0, 5000);
    return `'${escaped}'`;
}

// 转义布尔值
function escapeBoolean(str) {
    if (str === 'true' || str === true) return 'true';
    if (str === 'false' || str === false) return 'false';
    return 'NULL';
}

// 转义数字
function escapeNumber(str) {
    if (str === null || str === undefined || str === '') {
        return 'NULL';
    }
    const num = parseFloat(str);
    return isNaN(num) ? 'NULL' : num.toString();
}

// 转义数组（处理包含换行的字段）
function escapeArray(str) {
    if (str === null || str === undefined || str === '') {
        return 'NULL';
    }
    let escaped = String(str)
        .replace(/\n/g, ' | ')
        .replace(/\r/g, ' ')
        .replace(/\t/g, ' ')
        .replace(/'/g, "''");
    if (escaped.length > 2000) escaped = escaped.substring(0, 2000);
    return `'${escaped}'`;
}

// 读取CSV文件
function readCsvFile(filePath) {
    return new Promise((resolve, reject) => {
        const rows = [];
        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => rows.push(row))
            .on('end', () => resolve(rows))
            .on('error', reject);
    });
}

// 生成建表和插入SQL
function generateCreateTableAndInsert(tableName, columns, data, idGenerator) {
    let sql = `-- ${tableName}\n`;
    sql += `DROP TABLE IF EXISTS ${tableName} CASCADE;\n\n`;
    sql += `CREATE TABLE ${tableName} (\n`;
    sql += `    id BIGINT PRIMARY KEY,\n`;
    sql += columns.map(col => `    ${col.name} ${col.type}`).join(',\n');
    sql += '\n);\n\n';

    if (data.length === 0) {
        sql += `-- No data to insert\n`;
        return sql;
    }

    const columnNames = columns.map(col => col.name).join(', ');

    // 批量插入（每批1000条）
    const batchSize = 1000;
    const batches = [];
    for (let i = 0; i < data.length; i += batchSize) {
        batches.push(data.slice(i, i + batchSize));
    }

    sql += `INSERT INTO ${tableName} (${columnNames}) VALUES\n`;
    sql += batches.map(batch => {
        return batch.map(row => {
            return `(${idGenerator(row)})`;
        }).join(',\n');
    }).join(',\n');

    sql += ';\n\n';

    return sql;
}

// ============================================
// 1. ISCO Groups (ISCO分类表)
// ============================================
async function processISCOGroups() {
    console.log('Processing ISCO Groups...');
    const rows = await readCsvFile(path.join(csvDir, 'ISCOGroups_en.csv'));

    const sql = generateCreateTableAndInsert('isco_groups', [
        { name: 'uri', type: 'VARCHAR(255) UNIQUE' },
        { name: 'code', type: 'VARCHAR(50)' },
        { name: 'name', type: 'VARCHAR(500)' },
        { name: 'status', type: 'VARCHAR(50)' },
        { name: 'alt_labels', type: 'TEXT' },
        { name: 'description', type: 'TEXT' }
    ], rows, (row) => {
        const uri = row.conceptUri;
        const id = getIdFromUri(uri);
        return `${id}, ${escapeString(uri)}, ${escapeString(row.code)}, ${escapeString(row.preferredLabel)}, ${escapeString(row.status)}, ${escapeArray(row.altLabels)}, ${escapeArray(row.description)}`;
    });

    fs.writeFileSync(path.join(outputDir, '01_isco_groups.sql'), sql);
    stats.iscoGroups = rows.length;
    console.log(`  ✓ Generated 01_isco_groups.sql with ${rows.length} records`);
}

// ============================================
// 2. Skill Groups (技能组表)
// ============================================
async function processSkillGroups() {
    console.log('Processing Skill Groups...');
    const rows = await readCsvFile(path.join(csvDir, 'skillGroups_en.csv'));

    const sql = generateCreateTableAndInsert('skill_groups', [
        { name: 'uri', type: 'VARCHAR(255) UNIQUE' },
        { name: 'code', type: 'VARCHAR(50)' },
        { name: 'name', type: 'VARCHAR(500)' },
        { name: 'status', type: 'VARCHAR(50)' },
        { name: 'alt_labels', type: 'TEXT' },
        { name: 'description', type: 'TEXT' }
    ], rows, (row) => {
        const uri = row.conceptUri;
        const id = getIdFromUri(uri);
        return `${id}, ${escapeString(uri)}, ${escapeString(row.code)}, ${escapeString(row.preferredLabel)}, ${escapeString(row.status)}, ${escapeArray(row.altLabels)}, ${escapeArray(row.description)}`;
    });

    fs.writeFileSync(path.join(outputDir, '02_skill_groups.sql'), sql);
    stats.skillGroups = rows.length;
    console.log(`  ✓ Generated 02_skill_groups.sql with ${rows.length} records`);
}

// ============================================
// 3. Occupations (职业表)
// ============================================
async function processOccupations() {
    console.log('Processing Occupations...');
    const rows = await readCsvFile(path.join(csvDir, 'occupations_en.csv'));

    const sql = generateCreateTableAndInsert('occupations', [
        { name: 'uri', type: 'VARCHAR(255) UNIQUE' },
        { name: 'isco_group_id', type: 'BIGINT' },
        { name: 'isco_code', type: 'VARCHAR(50)' },
        { name: 'code', type: 'VARCHAR(50)' },
        { name: 'name', type: 'VARCHAR(500)' },
        { name: 'alt_labels', type: 'TEXT' },
        { name: 'description', type: 'TEXT' },
        { name: 'status', type: 'VARCHAR(50)' },
        { name: 'nace_code', type: 'VARCHAR(50)' }
    ], rows, (row) => {
        const uri = row.conceptUri;
        const id = getIdFromUri(uri);
        const iscoGroupId = getIdFromUri(`http://data.europa.eu/esco/isco/${row.iscoGroup}`);
        return `${id}, ${escapeString(uri)}, ${iscoGroupId}, ${escapeString(row.iscoGroup)}, ${escapeString(row.code)}, ${escapeString(row.preferredLabel)}, ${escapeArray(row.altLabels)}, ${escapeArray(row.description)}, ${escapeString(row.status)}, ${escapeString(row.naceCode)}`;
    });

    fs.writeFileSync(path.join(outputDir, '03_occupations.sql'), sql);
    stats.occupations = rows.length;
    console.log(`  ✓ Generated 03_occupations.sql with ${rows.length} records`);
}

// ============================================
// 4. Skills (技能表)
// ============================================
async function processSkills() {
    console.log('Processing Skills...');
    const rows = await readCsvFile(path.join(csvDir, 'skills_en.csv'));

    const sql = generateCreateTableAndInsert('skills', [
        { name: 'uri', type: 'VARCHAR(255) UNIQUE' },
        { name: 'name', type: 'VARCHAR(500)' },
        { name: 'type', type: 'VARCHAR(50)' },
        { name: 'reuse_level', type: 'VARCHAR(50)' },
        { name: 'alt_labels', type: 'TEXT' },
        { name: 'description', type: 'TEXT' },
        { name: 'definition', type: 'TEXT' },
        { name: 'status', type: 'VARCHAR(50)' }
    ], rows, (row) => {
        const uri = row.conceptUri;
        const id = getIdFromUri(uri);
        let type = row.skillType;
        if (type === 'skill/competence') type = 'skill';
        return `${id}, ${escapeString(uri)}, ${escapeString(row.preferredLabel)}, ${escapeString(type)}, ${escapeString(row.reuseLevel)}, ${escapeArray(row.altLabels)}, ${escapeArray(row.description)}, ${escapeArray(row.definition)}, ${escapeString(row.status)}`;
    });

    fs.writeFileSync(path.join(outputDir, '04_skills.sql'), sql);
    stats.skills = rows.length;
    console.log(`  ✓ Generated 04_skills.sql with ${rows.length} records`);
}

// ============================================
// 5. Occupation Skill Relations (职业-技能关联)
// ============================================
async function processOccupationSkillRelations() {
    console.log('Processing Occupation Skill Relations...');
    const rows = await readCsvFile(path.join(csvDir, 'occupationSkillRelations_en.csv'));

    const sql = generateCreateTableAndInsert('occupation_skill_relations', [
        { name: 'occupation_id', type: 'BIGINT' },
        { name: 'occupation_name', type: 'VARCHAR(500)' },
        { name: 'skill_id', type: 'BIGINT' },
        { name: 'skill_name', type: 'VARCHAR(500)' },
        { name: 'skill_type', type: 'VARCHAR(50)' },
        { name: 'is_essential', type: 'BOOLEAN' }
    ], rows, (row) => {
        const occupationId = getIdFromUri(row.occupationUri);
        const skillId = getIdFromUri(row.skillUri);
        let skillType = row.skillType;
        if (skillType === 'skill/competence') skillType = 'skill';
        return `${snowflake.generate()}, ${occupationId}, ${escapeString(row.occupationLabel)}, ${skillId}, ${escapeString(row.skillLabel)}, ${escapeString(skillType)}, ${escapeBoolean(row.relationType === 'essential')}`;
    });

    fs.writeFileSync(path.join(outputDir, '05_occupation_skill_relations.sql'), sql);
    stats.occupationSkillRelations = rows.length;
    console.log(`  ✓ Generated 05_occupation_skill_relations.sql with ${rows.length} records`);
}

// ============================================
// 6. Skill Skill Relations (技能-技能关联)
// ============================================
async function processSkillSkillRelations() {
    console.log('Processing Skill Skill Relations...');
    const rows = await readCsvFile(path.join(csvDir, 'skillSkillRelations_en.csv'));

    const sql = generateCreateTableAndInsert('skill_skill_relations', [
        { name: 'original_skill_id', type: 'BIGINT' },
        { name: 'original_skill_type', type: 'VARCHAR(50)' },
        { name: 'related_skill_id', type: 'BIGINT' },
        { name: 'related_skill_type', type: 'VARCHAR(50)' },
        { name: 'is_essential', type: 'BOOLEAN' }
    ], rows, (row) => {
        const originalSkillId = getIdFromUri(row.originalSkillUri);
        const relatedSkillId = getIdFromUri(row.relatedSkillUri);
        let originalType = row.originalSkillType;
        let relatedType = row.relatedSkillType;
        if (originalType === 'skill/competence') originalType = 'skill';
        if (relatedType === 'skill/competence') relatedType = 'skill';
        return `${snowflake.generate()}, ${originalSkillId}, ${escapeString(originalType)}, ${relatedSkillId}, ${escapeString(relatedType)}, ${escapeBoolean(row.relationType === 'essential')}`;
    });

    fs.writeFileSync(path.join(outputDir, '06_skill_skill_relations.sql'), sql);
    stats.skillSkillRelations = rows.length;
    console.log(`  ✓ Generated 06_skill_skill_relations.sql with ${rows.length} records`);
}

// ============================================
// 7. Broader Occ Pillar (职业层级)
// ============================================
async function processBroaderOccPillar() {
    console.log('Processing Broader Occ Pillar...');
    const rows = await readCsvFile(path.join(csvDir, 'broaderRelationsOccPillar_en.csv'));

    const sql = generateCreateTableAndInsert('broader_occ_pillar', [
        { name: 'uri', type: 'VARCHAR(255) UNIQUE' },
        { name: 'name', type: 'VARCHAR(500)' },
        { name: 'parent_id', type: 'BIGINT' },
        { name: 'parent_name', type: 'VARCHAR(500)' }
    ], rows, (row) => {
        const uri = row.conceptUri;
        const id = getIdFromUri(uri);
        const parentId = getIdFromUri(row.broaderUri);
        return `${id}, ${escapeString(uri)}, ${escapeString(row.conceptLabel)}, ${parentId}, ${escapeString(row.broaderLabel)}`;
    });

    fs.writeFileSync(path.join(outputDir, '07_broader_occ_pillar.sql'), sql);
    stats.broaderOccPillar = rows.length;
    console.log(`  ✓ Generated 07_broader_occ_pillar.sql with ${rows.length} records`);
}

// ============================================
// 8. Broader Skill Pillar (技能层级)
// ============================================
async function processBroaderSkillPillar() {
    console.log('Processing Broader Skill Pillar...');
    const rows = await readCsvFile(path.join(csvDir, 'broaderRelationsSkillPillar_en.csv'));

    const sql = generateCreateTableAndInsert('broader_skill_pillar', [
        { name: 'uri', type: 'VARCHAR(255) UNIQUE' },
        { name: 'name', type: 'VARCHAR(500)' },
        { name: 'parent_id', type: 'BIGINT' },
        { name: 'parent_name', type: 'VARCHAR(500)' }
    ], rows, (row) => {
        const uri = row.conceptUri;
        const id = getIdFromUri(uri);
        const parentId = getIdFromUri(row.broaderUri);
        return `${id}, ${escapeString(uri)}, ${escapeString(row.conceptLabel)}, ${parentId}, ${escapeString(row.broaderLabel)}`;
    });

    fs.writeFileSync(path.join(outputDir, '08_broader_skill_pillar.sql'), sql);
    stats.broaderSkillPillar = rows.length;
    console.log(`  ✓ Generated 08_broader_skill_pillar.sql with ${rows.length} records`);
}

// ============================================
// 9. Skills Hierarchy (四级技能分类)
// ============================================
async function processSkillsHierarchy() {
    console.log('Processing Skills Hierarchy...');
    const rows = await readCsvFile(path.join(csvDir, 'skillsHierarchy_en.csv'));

    const sql = generateCreateTableAndInsert('skills_hierarchy', [
        { name: 'level_0_id', type: 'BIGINT' },
        { name: 'level_0_name', type: 'VARCHAR(500)' },
        { name: 'level_1_id', type: 'BIGINT' },
        { name: 'level_1_name', type: 'VARCHAR(500)' },
        { name: 'level_2_id', type: 'BIGINT' },
        { name: 'level_2_name', type: 'VARCHAR(500)' },
        { name: 'level_3_id', type: 'BIGINT' },
        { name: 'level_3_name', type: 'VARCHAR(500)' },
        { name: 'description', type: 'TEXT' },
        { name: 'scope_note', type: 'TEXT' }
    ], rows, (row) => {
        return `${snowflake.generate()}, ${getIdFromUri(row['Level 0 URI'])}, ${escapeString(row['Level 0 preferred term'])}, ${getIdFromUri(row['Level 1 URI'])}, ${escapeString(row['Level 1 preferred term'])}, ${getIdFromUri(row['Level 2 URI'])}, ${escapeString(row['Level 2 preferred term'])}, ${getIdFromUri(row['Level 3 URI'])}, ${escapeString(row['Level 3 preferred term'])}, ${escapeString(row.Description)}, ${escapeString(row['Scope note'])}`;
    });

    fs.writeFileSync(path.join(outputDir, '09_skills_hierarchy.sql'), sql);
    stats.skillsHierarchy = rows.length;
    console.log(`  ✓ Generated 09_skills_hierarchy.sql with ${rows.length} records`);
}

// ============================================
// 10. Green Share Occ (绿色技能占比)
// ============================================
async function processGreenShareOcc() {
    console.log('Processing Green Share Occ...');
    const rows = await readCsvFile(path.join(csvDir, 'greenShareOcc_en.csv'));

    const sql = generateCreateTableAndInsert('green_share_occ', [
        { name: 'isco_level', type: 'VARCHAR(50)' },
        { name: 'uri', type: 'VARCHAR(255) UNIQUE' },
        { name: 'code', type: 'VARCHAR(50)' },
        { name: 'name', type: 'VARCHAR(500)' },
        { name: 'green_share', type: 'NUMERIC(10,6)' },
        { name: 'description', type: 'TEXT' }
    ], rows, (row) => {
        const uri = row.conceptUri;
        const id = getIdFromUri(uri);
        // 读取所有列来获取description
        const description = row.description || '';
        return `${id}, ${escapeString(row.conceptType)}, ${escapeString(uri)}, ${escapeString(row.code)}, ${escapeString(row.preferredLabel)}, ${escapeNumber(row.greenShare)}, ${escapeArray(description)}`;
    });

    fs.writeFileSync(path.join(outputDir, '10_green_share_occ.sql'), sql);
    stats.greenShareOcc = rows.length;
    console.log(`  ✓ Generated 10_green_share_occ.sql with ${rows.length} records`);
}

// ============================================
// 11-17. 专题技能集合
// ============================================
async function processSkillCollections() {
    const collections = [
        { name: 'digital_skills', file: 'digitalSkillsCollection_en.csv', output: '11_digital_skills.sql' },
        { name: 'green_skills', file: 'greenSkillsCollection_en.csv', output: '12_green_skills.sql' },
        { name: 'transversal_skills', file: 'transversalSkillsCollection_en.csv', output: '13_transversal_skills.sql' },
        { name: 'language_skills', file: 'languageSkillsCollection_en.csv', output: '14_language_skills.sql' },
        { name: 'digcomp_skills', file: 'digCompSkillsCollection_en.csv', output: '15_digcomp_skills.sql' },
        { name: 'research_skills', file: 'researchSkillsCollection_en.csv', output: '16_research_skills.sql' },
        { name: 'research_occupations', file: 'researchOccupationsCollection_en.csv', output: '17_research_occupations.sql', isOccupation: true }
    ];

    for (const collection of collections) {
        console.log(`Processing ${collection.name}...`);
        const rows = await readCsvFile(path.join(csvDir, collection.file));

        const sql = generateCreateTableAndInsert(collection.name, [
            { name: 'uri', type: 'VARCHAR(255) UNIQUE' },
            { name: 'name', type: 'VARCHAR(500)' },
            { name: 'status', type: 'VARCHAR(50)' },
            { name: 'type', type: 'VARCHAR(50)' },
            { name: 'reuse_level', type: 'VARCHAR(50)' },
            { name: 'alt_labels', type: 'TEXT' },
            { name: 'description', type: 'TEXT' },
            { name: 'parent_id', type: 'BIGINT' },
            { name: 'parent_name', type: 'VARCHAR(500)' }
        ], rows, (row) => {
            const uri = row.conceptUri;
            const id = getIdFromUri(uri);
            let type = row.skillType;
            if (type === 'skill/competence') type = 'skill';
            const parentId = getIdFromUri(row.broaderConceptUri);
            return `${id}, ${escapeString(uri)}, ${escapeString(row.preferredLabel)}, ${escapeString(row.status)}, ${escapeString(type)}, ${escapeString(row.reuseLevel)}, ${escapeArray(row.altLabels)}, ${escapeArray(row.description)}, ${parentId}, ${escapeString(row.broaderConceptPT)}`;
        });

        fs.writeFileSync(path.join(outputDir, collection.output), sql);
        stats[collection.name.replace(/_/g, '')] = rows.length;
        console.log(`  ✓ Generated ${collection.output} with ${rows.length} records`);
    }
}

// ============================================
// 18. 外键约束
// ============================================
function generateForeignKeys() {
    let sql = `-- ============================================\n`;
    sql += `-- 外键约束\n`;
    sql += `-- ============================================\n\n`;

    // Occupations 外键
    sql += `-- Occupations 外键\n`;
    sql += `ALTER TABLE occupations ADD CONSTRAINT fk_occupations_isco_group\n`;
    sql += `    FOREIGN KEY (isco_group_id) REFERENCES isco_groups(id) ON DELETE SET NULL;\n\n`;

    // Occupation Skill Relations 外键
    sql += `-- Occupation Skill Relations 外键\n`;
    sql += `ALTER TABLE occupation_skill_relations ADD CONSTRAINT fk_osr_occupation\n`;
    sql += `    FOREIGN KEY (occupation_id) REFERENCES occupations(id) ON DELETE CASCADE;\n\n`;
    sql += `ALTER TABLE occupation_skill_relations ADD CONSTRAINT fk_osr_skill\n`;
    sql += `    FOREIGN KEY (skill_id) REFERENCES skills(id) ON DELETE CASCADE;\n\n`;

    // Skill Skill Relations 外键
    sql += `-- Skill Skill Relations 外键\n`;
    sql += `ALTER TABLE skill_skill_relations ADD CONSTRAINT fk_ssr_original_skill\n`;
    sql += `    FOREIGN KEY (original_skill_id) REFERENCES skills(id) ON DELETE CASCADE;\n\n`;
    sql += `ALTER TABLE skill_skill_relations ADD CONSTRAINT fk_ssr_related_skill\n`;
    sql += `    FOREIGN KEY (related_skill_id) REFERENCES skills(id) ON DELETE CASCADE;\n\n`;

    // Broader Occ Pillar 外键
    sql += `-- Broader Occ Pillar 外键\n`;
    sql += `ALTER TABLE broader_occ_pillar ADD CONSTRAINT fk_bop_parent\n`;
    sql += `    FOREIGN KEY (parent_id) REFERENCES isco_groups(id) ON DELETE SET NULL;\n\n`;

    // Broader Skill Pillar 外键
    sql += `-- Broader Skill Pillar 外键\n`;
    sql += `ALTER TABLE broader_skill_pillar ADD CONSTRAINT fk_bsp_parent\n`;
    sql += `    FOREIGN KEY (parent_id) REFERENCES skill_groups(id) ON DELETE SET NULL;\n\n`;

    // Skills Hierarchy 外键
    sql += `-- Skills Hierarchy 外键\n`;
    sql += `ALTER TABLE skills_hierarchy ADD CONSTRAINT fk_sh_level_0\n`;
    sql += `    FOREIGN KEY (level_0_id) REFERENCES skills(id) ON DELETE SET NULL;\n\n`;
    sql += `ALTER TABLE skills_hierarchy ADD CONSTRAINT fk_sh_level_1\n`;
    sql += `    FOREIGN KEY (level_1_id) REFERENCES skills(id) ON DELETE SET NULL;\n\n`;
    sql += `ALTER TABLE skills_hierarchy ADD CONSTRAINT fk_sh_level_2\n`;
    sql += `    FOREIGN KEY (level_2_id) REFERENCES skills(id) ON DELETE SET NULL;\n\n`;
    sql += `ALTER TABLE skills_hierarchy ADD CONSTRAINT fk_sh_level_3\n`;
    sql += `    FOREIGN KEY (level_3_id) REFERENCES skills(id) ON DELETE SET NULL;\n\n`;

    // Green Share Occ 外键
    sql += `-- Green Share Occ 外键\n`;
    sql += `ALTER TABLE green_share_occ ADD CONSTRAINT fk_gso_isco\n`;
    sql += `    FOREIGN KEY (uri) REFERENCES isco_groups(uri) ON DELETE CASCADE;\n\n`;

    fs.writeFileSync(path.join(outputDir, '18_foreign_keys.sql'), sql);
    console.log(`  ✓ Generated 18_foreign_keys.sql`);
}

// ============================================
// 19. 索引
// ============================================
function generateIndexes() {
    let sql = `-- ============================================\n`;
    sql += `-- 索引\n`;
    sql += `-- ============================================\n\n`;

    // Occupations 索引
    sql += `-- Occupations 索引\n`;
    sql += `CREATE INDEX idx_occupations_isco_group ON occupations(isco_group_id);\n`;
    sql += `CREATE INDEX idx_occupations_code ON occupations(code);\n`;
    sql += `CREATE INDEX idx_occupations_name ON occupations USING gin(to_tsvector('english', name));\n\n`;

    // Skills 索引
    sql += `-- Skills 索引\n`;
    sql += `CREATE INDEX idx_skills_type ON skills(type);\n`;
    sql += `CREATE INDEX idx_skills_reuse_level ON skills(reuse_level);\n`;
    sql += `CREATE INDEX idx_skills_name ON skills USING gin(to_tsvector('english', name));\n\n`;

    // Occupation Skill Relations 索引
    sql += `-- Occupation Skill Relations 索引\n`;
    sql += `CREATE INDEX idx_osr_occupation ON occupation_skill_relations(occupation_id);\n`;
    sql += `CREATE INDEX idx_osr_skill ON occupation_skill_relations(skill_id);\n`;
    sql += `CREATE INDEX idx_osr_is_essential ON occupation_skill_relations(is_essential);\n\n`;

    // Skill Skill Relations 索引
    sql += `-- Skill Skill Relations 索引\n`;
    sql += `CREATE INDEX idx_ssr_original_skill ON skill_skill_relations(original_skill_id);\n`;
    sql += `CREATE INDEX idx_ssr_related_skill ON skill_skill_relations(related_skill_id);\n\n`;

    // Broader Pillar 索引
    sql += `-- Broader Pillar 索引\n`;
    sql += `CREATE INDEX idx_bop_parent ON broader_occ_pillar(parent_id);\n`;
    sql += `CREATE INDEX idx_bsp_parent ON broader_skill_pillar(parent_id);\n\n`;

    // Green Share Occ 索引
    sql += `-- Green Share Occ 索引\n`;
    sql += `CREATE INDEX idx_gso_green_share ON green_share_occ(green_share DESC);\n\n`;

    fs.writeFileSync(path.join(outputDir, '19_indexes.sql'), sql);
    console.log(`  ✓ Generated 19_indexes.sql`);
}

// ============================================
// 主函数
// ============================================
async function main() {
    console.log('Starting ESCO database initialization...\n');

    try {
        // 按顺序处理
        await processISCOGroups();
        await processSkillGroups();
        await processOccupations();
        await processSkills();
        await processOccupationSkillRelations();
        await processSkillSkillRelations();
        await processBroaderOccPillar();
        await processBroaderSkillPillar();
        await processSkillsHierarchy();
        await processGreenShareOcc();
        await processSkillCollections();

        // 生成外键和索引
        generateForeignKeys();
        generateIndexes();

        // 生成执行脚本
        generateExecutionScript();

        // 输出统计信息
        console.log('\n========================================');
        console.log('Statistics:');
        console.log('========================================');
        console.log(`ISCO Groups:           ${stats.iscoGroups}`);
        console.log(`Skill Groups:          ${stats.skillGroups}`);
        console.log(`Occupations:           ${stats.occupations}`);
        console.log(`Skills:                ${stats.skills}`);
        console.log(`Occupation-Skill Rel:  ${stats.occupationSkillRelations}`);
        console.log(`Skill-Skill Rel:       ${stats.skillSkillRelations}`);
        console.log(`Broader Occ Pillar:    ${stats.broaderOccPillar}`);
        console.log(`Broader Skill Pillar:  ${stats.broaderSkillPillar}`);
        console.log(`Skills Hierarchy:      ${stats.skillsHierarchy}`);
        console.log(`Green Share Occ:       ${stats.greenShareOcc}`);
        console.log('========================================');
        console.log(`\n✓ All SQL files generated in: ${outputDir}`);
        console.log(`\nRun the following command to import:`);
        console.log(`  bash ${path.join(outputDir, 'import.sh')}`);

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// ============================================
// 生成执行脚本
// ============================================
function generateExecutionScript() {
    const script = `#!/bin/bash

# ESCO Database Import Script
# Usage: bash import.sh [database_name] [user] [password]

DB_NAME=\${1:-"esco"}
DB_USER=\${2:-"postgres"}
DB_PASSWORD=\${3:-""}

export PGPASSWORD=\$DB_PASSWORD

echo "Creating database..."
psql -U \$DB_USER -c "DROP DATABASE IF EXISTS \$DB_NAME;"
psql -U \$DB_USER -c "CREATE DATABASE \$DB_NAME;"

echo "Importing data..."
cd "\$(dirname "\$0")"

for file in *.sql; do
    if [ "\$file" != "import.sh" ]; then
        echo "Importing \$file..."
        psql -U \$DB_USER -d \$DB_NAME -f "\$file"
    fi
done

echo "✓ Import complete!"
`;

    fs.writeFileSync(path.join(outputDir, 'import.sh'), script);
    fs.chmodSync(path.join(outputDir, 'import.sh'), '755');
    console.log(`  ✓ Generated import.sh`);
}

// 运行主函数
main();
