const fs = require('fs');
const path = require('path');
const { createT } = require('./helpers');

(async () => {
  const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.test.js')).sort();
  if (!files.length) { console.log('没有找到测试文件'); process.exit(1); }

  let passed = 0;
  const failed = [];

  for (const f of files) {
    const t = createT();
    const mod = require(path.join(__dirname, f));
    const label = f.replace(/\.test\.js$/, '');
    try {
      await mod.run(t);
    } catch (e) {
      t.ok(false, '执行抛异常: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e));
    }
    if (t.fails.length) {
      failed.push(label);
      console.log('✗ ' + label);
      t.fails.forEach((m) => console.log('    · ' + m));
    } else {
      passed += 1;
      console.log('✓ ' + label);
    }
  }

  console.log('');
  console.log(passed + ' 通过' + (failed.length ? '，' + failed.length + ' 失败：' + failed.join('、') : ''));
  process.exit(failed.length ? 1 : 0);
})();
