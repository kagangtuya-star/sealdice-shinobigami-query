#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const CATEGORY_SPECS = [
  {
    file: 'battlefield.js',
    exportName: 'battlefieldData',
    key: '战场',
    primaryField: '名字',
    detailFields: ['序号', '名字', '效果（表）', '效果（里）'],
    globalOrder: 1,
  },
  {
    file: 'variant.js',
    exportName: 'variantData',
    key: '变调',
    primaryField: '名字',
    detailFields: ['序号', '名字', '描述'],
    globalOrder: 2,
  },
  {
    file: 'ninpo.js',
    exportName: 'ninpoData',
    key: '忍法',
    primaryField: '名字',
    detailFields: ['序号', '分支', '名字', '类别', '距离', '花费', '指定特技', '描述', '效果', '备注'],
    globalOrder: 3,
  },
  {
    file: 'background.js',
    exportName: 'backgroundData',
    key: '背景',
    primaryField: '名字',
    detailFields: ['序号', '类型', '名字', '功绩点', '修得限制', '说明', '描述'],
    globalOrder: 4,
  },
  {
    file: 'ougi_kaihatsu.js',
    exportName: 'ougi_kaihatsuData',
    key: '奥义开发',
    primaryField: '名字',
    detailFields: ['序号', '类型', '名字', '使用范围', '限定流派', '说明', '描述'],
    globalOrder: 5,
  },
  {
    file: 'persona.js',
    exportName: 'personaData',
    key: '人格假面',
    primaryField: '名字',
    detailFields: ['序号', '类型', '名字', '说明', '描述'],
    globalOrder: 6,
  },
  {
    file: 'yuigami.js',
    exportName: 'yuigamiData',
    key: '惟神',
    primaryField: '名字',
    detailFields: ['序号', '名字', '指定特技', '效果', '描述'],
    globalOrder: 7,
  },
  {
    file: 'enemies.js',
    exportName: 'enemiesData',
    key: '敌人',
    primaryField: '名字',
    detailFields: ['序号', '分类', '名字', '出处', '概述', '生命力', '威胁度', '忍具', '奥义数量', '得意分野与特技', '持有的忍法与人格假面', '其他'],
    globalOrder: 8,
  },
  {
    file: 'yoma_weapons.js',
    exportName: 'yoma_weaponsData',
    key: '妖魔武器',
    primaryField: '名字',
    detailFields: ['序号', '名字', '维持功绩点', '说明'],
    globalOrder: 9,
  },
  {
    file: 'ritual_ninpo.js',
    exportName: 'ritual_ninpoData',
    key: '仪式忍法',
    primaryField: '名字',
    detailFields: ['序号', '名字', '韵度', '初期念度', '额外念度', '描述', '效果', '仪式1', '仪式2', '仪式3', '仪式4', '仪式5', '仪式6'],
    globalOrder: 10,
  },
  {
    file: 'mystery.js',
    exportName: 'mysteryData',
    key: '谜团',
    primaryField: '名字',
    detailFields: ['序号', '种类', '名字', '描述', '威胁度', '解除特技', '计划判定', '效果'],
    globalOrder: 11,
  },
  {
    file: 'gedo_ninpo.js',
    exportName: 'gedo_ninpoData',
    key: '外道忍法',
    primaryField: '名字',
    detailFields: ['序号', '來源', '来源', '名字', '類別', '距离', '距離', '花費', '指定特技', '效果', '描述'],
    globalOrder: 12,
  },
];

const DEFAULT_TEMPLATE_FILE = '术语测试-keywords.json';
const DEFAULT_OUTPUT_FILE = '完整术语库-keywords.json';

function parseArgs(argv) {
  const options = {
    cwd: process.cwd(),
    template: DEFAULT_TEMPLATE_FILE,
    out: DEFAULT_OUTPUT_FILE,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--template') {
      options.template = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--out') {
      options.out = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--cwd') {
      options.cwd = argv[index + 1];
      index += 1;
      continue;
    }
    if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function showHelp() {
  console.log('用法: node convert-keywords.cjs [--cwd 数据目录] [--template 模板JSON] [--out 输出JSON]');
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function resolvePath(baseDir, targetPath) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(baseDir, targetPath);
}

function parseDataArray(filePath, exportName) {
  const source = fs.readFileSync(filePath, 'utf8');
  const pattern = new RegExp(`export\\s+const\\s+${exportName}\\s*=\\s*(\\[[\\s\\S]*\\]);?\\s*$`);
  const match = source.match(pattern);

  if (!match) {
    throw new Error(`无法在 ${filePath} 中找到导出数组 ${exportName}`);
  }

  return vm.runInNewContext(match[1], Object.create(null), { timeout: 1000 });
}

function splitPrimaryName(rawValue) {
  const parts = String(rawValue || '')
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  return {
    keyword: parts[0] || '',
    aliases: parts.slice(1),
  };
}

function uniqueStrings(values) {
  const seen = new Set();
  const result = [];

  values.forEach((value) => {
    const text = String(value || '').trim();
    if (!text || seen.has(text)) {
      return;
    }
    seen.add(text);
    result.push(text);
  });

  return result;
}

function shouldKeepRow(row, category) {
  const { keyword } = splitPrimaryName(row[category.primaryField]);
  if (!keyword) {
    return false;
  }

  const nonEmptyFields = category.detailFields.filter((field) => String(row[field] || '').trim() !== '');
  return nonEmptyFields.length > 1;
}

function buildDescription(row, category) {
  return category.detailFields
    .map((field) => {
      const value = String(row[field] || '').trim();
      if (!value) {
        return '';
      }
      const formattedValue = value
        .split(/\r?\n/)
        .map((line, index) => (index === 0 ? line : `  ${line}`))
        .join('\n');
      return `【${field}】${formattedValue}`;
    })
    .filter(Boolean)
    .join('\n');
}

function buildStableId(categoryKey, sequence, keyword) {
  return crypto
    .createHash('sha1')
    .update(`${categoryKey}\u0000${sequence}\u0000${keyword}`)
    .digest('hex')
    .slice(0, 16);
}

function buildTemplateDefaults(templateRecords) {
  const firstRecord = Array.isArray(templateRecords) && templateRecords.length > 0 ? templateRecords[0] : {};
  const now = new Date().toISOString();

  return {
    createdAt: firstRecord.createdAt || now,
    updatedAt: firstRecord.updatedAt || now,
    worldId: firstRecord.worldId || '',
    matchMode: firstRecord.matchMode || 'plain',
    descriptionFormat: firstRecord.descriptionFormat || 'plain',
    display: firstRecord.display || 'inherit',
    isEnabled: typeof firstRecord.isEnabled === 'boolean' ? firstRecord.isEnabled : true,
    createdBy: firstRecord.createdBy || '',
    updatedBy: firstRecord.updatedBy || '',
  };
}

function createKeywordRecord(row, category, templateDefaults, sortOrder) {
  const { keyword, aliases } = splitPrimaryName(row[category.primaryField]);
  const sequence = String(row.序号 || '').trim();

  return {
    id: buildStableId(category.key, sequence, keyword),
    createdAt: templateDefaults.createdAt,
    updatedAt: templateDefaults.updatedAt,
    worldId: templateDefaults.worldId,
    keyword,
    category: category.key,
    aliases: uniqueStrings(aliases),
    matchMode: 'plain',
    description: buildDescription(row, category),
    descriptionFormat: templateDefaults.descriptionFormat,
    display: templateDefaults.display,
    sortOrder,
    isEnabled: templateDefaults.isEnabled,
    createdBy: templateDefaults.createdBy,
    updatedBy: templateDefaults.updatedBy,
  };
}

function convertDatabase(options = {}) {
  const cwd = options.cwd || process.cwd();
  const templatePath = resolvePath(cwd, options.template || DEFAULT_TEMPLATE_FILE);
  const templateRecords = readJson(templatePath);
  const templateDefaults = buildTemplateDefaults(templateRecords);

  const categories = [...CATEGORY_SPECS].sort((left, right) => left.globalOrder - right.globalOrder);
  const records = [];
  const stats = [];
  let sortOrder = 1;

  categories.forEach((category) => {
    const filePath = resolvePath(cwd, category.file);
    const rows = parseDataArray(filePath, category.exportName);
    const usableRows = rows.filter((row) => shouldKeepRow(row, category));

    usableRows.forEach((row) => {
      records.push(createKeywordRecord(row, category, templateDefaults, sortOrder));
      sortOrder += 1;
    });

    stats.push({
      category: category.key,
      count: usableRows.length,
      file: category.file,
    });
  });

  return {
    records,
    stats,
    templatePath,
  };
}

function writeOutput(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(records, null, 2)}\n`, 'utf8');
}

function formatStats(stats) {
  return stats.map((item) => `${item.category}: ${item.count}`).join('\n');
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    showHelp();
    return;
  }

  const outputPath = resolvePath(options.cwd, options.out);
  const result = convertDatabase(options);
  writeOutput(outputPath, result.records);

  console.log(`已生成 ${result.records.length} 条关键词记录`);
  console.log(`模板来源: ${result.templatePath}`);
  console.log(`输出文件: ${outputPath}`);
  console.log(formatStats(result.stats));
}

if (require.main === module) {
  main();
}

module.exports = {
  CATEGORY_SPECS,
  buildDescription,
  buildTemplateDefaults,
  convertDatabase,
  createKeywordRecord,
  parseArgs,
  parseDataArray,
  shouldKeepRow,
  splitPrimaryName,
};
