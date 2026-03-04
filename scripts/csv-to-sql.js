const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

const csvDir = path.join(__dirname, '../ESCO dataset - v1.2.1 - classification - en - csv');
const outputDir = path.join(__dirname, '../sql-output');

// Create output directory if it doesn't exist
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const tableMapping = {
    'conceptSchemes_en.csv': {
        tableName: 'concept_schemes',
        columns: ['concept_type', 'concept_scheme_uri', 'preferred_label', 'title', 'status', 'description', 'has_top_concept']
    },
    'ISCOGroups_en.csv': {
        tableName: 'isco_groups',
        columns: ['concept_type', 'concept_uri', 'code', 'preferred_label', 'status', 'alt_labels', 'in_scheme', 'description']
    },
    'occupations_en.csv': {
        tableName: 'occupations',
        columns: ['concept_type', 'concept_uri', 'isco_group', 'preferred_label', 'alt_labels', 'hidden_labels', 'status', 'modified_date', 'regulated_profession_note', 'scope_note', 'definition', 'in_scheme', 'description', 'code', 'nace_code']
    },
    'skills_en.csv': {
        tableName: 'skills',
        columns: ['concept_type', 'concept_uri', 'skill_type', 'reuse_level', 'preferred_label', 'alt_labels', 'hidden_labels', 'status', 'modified_date', 'scope_note', 'definition', 'in_scheme', 'description']
    },
    'skillGroups_en.csv': {
        tableName: 'skill_groups',
        columns: ['concept_type', 'concept_uri', 'preferred_label', 'alt_labels', 'hidden_labels', 'status', 'modified_date', 'scope_note', 'in_scheme', 'description', 'code']
    },
    'broaderRelationsOccPillar_en.csv': {
        tableName: 'broader_relations_occ_pillar',
        columns: ['concept_type', 'concept_uri', 'concept_label', 'broader_type', 'broader_uri', 'broader_label']
    },
    'broaderRelationsSkillPillar_en.csv': {
        tableName: 'broader_relations_skill_pillar',
        columns: ['concept_type', 'concept_uri', 'concept_label', 'broader_type', 'broader_uri', 'broader_label']
    },
    'occupationSkillRelations_en.csv': {
        tableName: 'occupation_skill_relations',
        columns: ['occupation_uri', 'occupation_label', 'relation_type', 'skill_type', 'skill_uri', 'skill_label']
    },
    'skillSkillRelations_en.csv': {
        tableName: 'skill_skill_relations',
        columns: ['original_skill_uri', 'original_skill_type', 'relation_type', 'related_skill_type', 'related_skill_uri']
    },
    'skillsHierarchy_en.csv': {
        tableName: 'skills_hierarchy',
        columns: ['level_0_uri', 'level_0_preferred_term', 'level_1_uri', 'level_1_preferred_term', 'level_2_uri', 'level_2_preferred_term', 'level_3_uri', 'level_3_preferred_term', 'description', 'scope_note', 'level_0_code', 'level_1_code', 'level_2_code', 'level_3_code']
    },
    'digitalSkillsCollection_en.csv': {
        tableName: 'digital_skills_collection',
        columns: ['concept_type', 'concept_uri', 'preferred_label', 'status', 'skill_type', 'reuse_level', 'alt_labels', 'description', 'broader_concept_uri', 'broader_concept_pt']
    },
    'greenSkillsCollection_en.csv': {
        tableName: 'green_skills_collection',
        columns: ['concept_type', 'concept_uri', 'preferred_label', 'status', 'skill_type', 'reuse_level', 'alt_labels', 'description', 'broader_concept_uri', 'broader_concept_pt']
    },
    'transversalSkillsCollection_en.csv': {
        tableName: 'transversal_skills_collection',
        columns: ['concept_type', 'concept_uri', 'skill_type', 'reuse_level', 'preferred_label', 'status', 'alt_labels', 'description', 'broader_concept_uri', 'broader_concept_pt']
    },
    'languageSkillsCollection_en.csv': {
        tableName: 'language_skills_collection',
        columns: ['concept_type', 'concept_uri', 'skill_type', 'reuse_level', 'preferred_label', 'status', 'alt_labels', 'description', 'broader_concept_uri', 'broader_concept_pt']
    },
    'digCompSkillsCollection_en.csv': {
        tableName: 'digcomp_skills_collection',
        columns: ['concept_type', 'concept_uri', 'preferred_label', 'status', 'skill_type', 'reuse_level', 'alt_labels', 'description', 'broader_concept_uri', 'broader_concept_pt']
    },
    'researchSkillsCollection_en.csv': {
        tableName: 'research_skills_collection',
        columns: ['concept_type', 'concept_uri', 'preferred_label', 'status', 'skill_type', 'reuse_level', 'alt_labels', 'description', 'broader_concept_uri', 'broader_concept_pt']
    },
    'researchOccupationsCollection_en.csv': {
        tableName: 'research_occupations_collection',
        columns: ['concept_type', 'concept_uri', 'preferred_label', 'status', 'alt_labels', 'description', 'broader_concept_uri', 'broader_concept_pt']
    },
    'greenShareOcc_en.csv': {
        tableName: 'green_share_occ',
        columns: ['occupation_uri', 'occupation_label', 'green_share', 'description']
    },
    'dictionary_en.csv': {
        tableName: 'dictionary',
        columns: ['filename', 'data_header', 'property', 'description']
    }
};

function escapeString(str) {
    if (str === null || str === undefined || str === '') {
        return 'NULL';
    }
    let escaped = String(str)
        .replace(/'/g, "''")
        .replace(/\n/g, '\\n')
        .replace(/\r/g, '\\r')
        .replace(/\t/g, '\\t');
    return `'${escaped}'`;
}

function escapeNumber(str) {
    if (str === null || str === undefined || str === '') {
        return 'NULL';
    }
    return str;
}

function convertToSnakeCase(str) {
    return str.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, '').replace(/_/g, ' ');
}

function getColumnTypes(csvFile, tableName) {
    const types = tableMapping[csvFile];
    if (!types) return null;

    const columnDefs = types.columns.map(col => {
        const colLower = col.toLowerCase();
        if (col.includes('uri') || col.includes('code')) {
            return `${col} TEXT`;
        } else if (col.includes('date') || col.includes('modified')) {
            return `${col} TIMESTAMP`;
        } else if (col.includes('share') && csvFile === 'greenShareOcc_en.csv') {
            return `${col} NUMERIC`;
        } else {
            return `${col} TEXT`;
        }
    });

    return columnDefs.join(',\n    ');
}

function processCsvFile(csvFile) {
    return new Promise((resolve, reject) => {
        const tableInfo = tableMapping[csvFile];
        if (!tableInfo) {
            console.log(`Skipping ${csvFile} - no mapping defined`);
            resolve();
            return;
        }

        const tableName = tableInfo.tableName;
        const csvPath = path.join(csvDir, csvFile);
        const sqlPath = path.join(outputDir, `${tableName}.sql`);

        if (!fs.existsSync(csvPath)) {
            console.log(`File not found: ${csvPath}`);
            resolve();
            return;
        }

        console.log(`Processing ${csvFile}...`);

        const rows = [];
        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => {
                rows.push(row);
            })
            .on('end', () => {
                let sql = `-- ESCO ${tableName}\n`;
                sql += `-- Generated from ${csvFile}\n\n`;

                // Create table statement
                sql += `DROP TABLE IF EXISTS ${tableName} CASCADE;\n\n`;
                sql += `CREATE TABLE ${tableName} (\n`;
                sql += `    ${getColumnTypes(csvFile, tableName)}\n`;
                sql += `);\n\n`;

                // Insert statements
                if (rows.length > 0) {
                    const columns = Object.keys(rows[0]);
                    const sqlColumns = columns.map(c => c.replace(/([A-Z])/g, '_$1').toLowerCase()).join(', ');

                    sql += `INSERT INTO ${tableName} (${sqlColumns}) VALUES\n`;

                    const insertStatements = rows.map(row => {
                        const values = columns.map(col => {
                            const value = row[col];
                            const colLower = col.toLowerCase();
                            if (colLower.includes('share') && csvFile === 'greenShareOcc_en.csv') {
                                return escapeNumber(value);
                            }
                            return escapeString(value);
                        });
                        return `(${values.join(', ')})`;
                    });

                    sql += insertStatements.join(',\n');
                    sql += ';\n';
                }

                sql += `\n-- ${tableName}: ${rows.length} records\n`;

                fs.writeFileSync(sqlPath, sql);
                console.log(`  Created ${tableName}.sql with ${rows.length} records`);
                resolve();
            })
            .on('error', reject);
    });
}

async function convertAll() {
    const files = fs.readdirSync(csvDir).filter(f => f.endsWith('.csv'));

    for (const file of files) {
        await processCsvFile(file);
    }

    console.log('\n✓ Conversion complete! SQL files are in:', outputDir);
}

convertAll().catch(console.error);
