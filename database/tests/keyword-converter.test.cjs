const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const databaseDir = path.resolve(__dirname, '..');
const scriptPath = path.join(databaseDir, 'convert-keywords.cjs');

test('转换脚本能基于真实数据库生成完整关键词 JSON', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'shinobigami-keywords-'));
  const outFile = path.join(tempDir, 'keywords.json');

  const result = spawnSync(process.execPath, [scriptPath, '--out', outFile], {
    cwd: databaseDir,
    encoding: 'utf8',
  });

  assert.equal(
    result.status,
    0,
    `脚本执行失败。\nstdout:\n${result.stdout}\nstderr:\n${result.stderr}`
  );

  assert.equal(fs.existsSync(outFile), true, '应生成输出文件');

  const records = JSON.parse(fs.readFileSync(outFile, 'utf8'));

  assert.ok(Array.isArray(records), '输出应为数组');
  assert.ok(records.length > 100, '应生成足够多的关键词记录');

  const mage = records.find((item) => item.keyword === '魔道师');
  assert.ok(mage, '应包含敌人数据中的中文主关键词');
  assert.equal(mage.category, '敌人');
  assert.ok(mage.aliases.includes('Mage'), '应将名字中的英文拆为别名');
  assert.match(mage.description, /【分类】常人/);
  assert.match(mage.description, /【持有的忍法与人格假面】/);

  const ninpo = records.find((item) => item.keyword === '威光');
  assert.ok(ninpo, '应包含忍法数据');
  assert.equal(ninpo.category, '忍法');
  assert.match(ninpo.description, /【分支】泛用忍法/);
  assert.match(ninpo.description, /【类别】攻击/);

  const gedo = records.find((item) => item.category === '外道忍法');
  assert.ok(gedo, '应包含外道忍法数据');
  assert.equal(gedo.category, '外道忍法');
  assert.match(gedo.description, /【來源】|【来源】/);

  const intro = records.find((item) => item.keyword === '谜团翻译源自网络。侵删');
  assert.equal(intro, undefined, '应过滤说明性质的导语记录');

  const templateShape = records[0];
  assert.equal(typeof templateShape.id, 'string');
  assert.equal(typeof templateShape.createdAt, 'string');
  assert.equal(typeof templateShape.updatedAt, 'string');
  assert.equal(typeof templateShape.worldId, 'string');
  assert.equal(templateShape.descriptionFormat, 'plain');
  assert.equal(templateShape.display, 'inherit');
  assert.equal(templateShape.isEnabled, true);
});
