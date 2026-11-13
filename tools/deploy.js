#!/usr/bin/env node
/**
 * 一条命令发布。
 *
 *   node tools/deploy.js              发布到 GitHub Pages
 *   node tools/deploy.js --dry-run    只检查，不提交不推送
 *   node tools/deploy.js --no-tag     不打标签
 *
 * 它按顺序做这些事，任何一步失败就停下：
 *   1. 工作区必须干净（先把改动 commit 掉）
 *   2. 应用文件有变更时，自动把 sw.js 的 CACHE 版本号 +1
 *   3. 跑全部测试
 *   4. 打标签 vN（N 自增）
 *   5. 推送（失败自动重试）
 *   6. 拉线上文件与本地逐字节比对，等到一致为止
 *
 * 令牌：设置 GITHUB_TOKEN 环境变量则用它推送；不设则走 git 已保存的凭据。
 */
const { execFileSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const APP_FILE = 'habit-calendar.html';
const SW_FILE = 'sw.js';
const PAGES = process.env.PAGES_URL || 'https://1260709663.github.io/habit-calendar/';
const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const NO_TAG = args.includes('--no-tag');

const c = {
  dim: (s) => '\x1b[2m' + s + '\x1b[0m',
  green: (s) => '\x1b[32m' + s + '\x1b[0m',
  red: (s) => '\x1b[31m' + s + '\x1b[0m',
  yellow: (s) => '\x1b[33m' + s + '\x1b[0m',
  bold: (s) => '\x1b[1m' + s + '\x1b[0m',
};
const step = (n, msg) => console.log('\n' + c.bold('[' + n + '/6]') + ' ' + msg);
const die = (msg) => { console.error('\n' + c.red('✗ ' + msg)); process.exit(1); };
const note = (msg) => console.log('    ' + c.dim(msg));

function git(argv, opts) {
  return execFileSync('git', argv, Object.assign({ cwd: ROOT, encoding: 'utf8' }, opts)).trim();
}

function authArgs() {
  const t = process.env.GITHUB_TOKEN;
  if (!t) return [];
  const basic = Buffer.from('x-access-token:' + t).toString('base64');
  return ['-c', 'http.extraheader=AUTHORIZATION: basic ' + basic];
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function pushWithRetry(times) {
  for (let i = 1; i <= times; i++) {
    const r = spawnSync('git', authArgs().concat(['push', 'origin', 'main', '--tags']), {
      cwd: ROOT, encoding: 'utf8',
    });
    if (r.status === 0) return true;
    const err = (r.stderr || '').trim().split('\n').slice(-2).join(' ');
    note('第 ' + i + ' 次推送失败: ' + err);
    if (i < times) await sleep(4000);
  }
  return false;
}

async function fetchPage(url) {
  const res = await fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'cb=' + Date.now());
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

(async () => {
  // 1. 工作区
  step(1, '检查工作区');
  const dirty = git(['status', '--porcelain']);
  if (dirty) {
    console.log(dirty);
    die('工作区有未提交的改动，先 commit 再发布（deploy 会把 sw 版本号单独提一个 commit）');
  }
  git(['fetch', 'origin'], { stdio: 'ignore' });
  const head = git(['rev-parse', 'HEAD']);
  const remote = git(['rev-parse', 'origin/main']);
  const pending = git(['log', '--oneline', 'origin/main..HEAD']);
  note('本地 ' + head.slice(0, 7) + ' / 远端 ' + remote.slice(0, 7));
  if (!pending) {
    console.log(c.green('\n没有需要发布的提交，收工。'));
    return;
  }
  console.log(pending.split('\n').map((l) => '    · ' + l).join('\n'));

  // 2. 判断是否需要 bump sw
  step(2, '检查缓存版本号');
  const appChanged = git(['diff', '--name-only', 'origin/main..HEAD', '--', APP_FILE]) !== '';
  const swNow = /CACHE\s*=\s*'([^']+)'/.exec(fs.readFileSync(path.join(ROOT, SW_FILE), 'utf8'));
  if (!swNow) die(SW_FILE + ' 里找不到 CACHE 版本号');
  const cur = swNow[1];
  if (!appChanged) {
    note('应用文件没变，跳过 bump（当前 ' + cur + '）');
  } else {
    const next = cur.replace(/v(\d+)$/, (m, d) => 'v' + (Number(d) + 1));
    if (next === cur) die('无法从 "' + cur + '" 推出下一个版本号，请手工确认格式为 xxx-vN');
    note('应用有变更：' + cur + ' → ' + next);
    if (DRY) {
      note('（dry-run，不实际修改）');
    } else {
      const sw = path.join(ROOT, SW_FILE);
      fs.writeFileSync(sw, fs.readFileSync(sw, 'utf8').replace(cur, next));
      git(['add', SW_FILE]);
      git(['commit', '-m', 'chore: sw 缓存版本 ' + cur + ' -> ' + next]);
      note('已提交版本号变更');
    }
  }

  // 3. 测试
  step(3, '跑测试');
  const t = spawnSync(process.execPath, ['test/run.js'], { cwd: ROOT, stdio: 'inherit' });
  if (t.status !== 0) die('测试未通过，已中止发布');
  note('测试通过');

  // 4. 标签
  step(4, '打标签');
  const tags = git(['tag', '-l', 'v*']).split('\n').filter(Boolean);
  const maxN = tags.reduce((m, x) => {
    const n = Number((/^v(\d+)$/.exec(x) || [])[1]);
    return isFinite(n) && n > m ? n : m;
  }, 0);
  const newTag = 'v' + (maxN + 1);
  if (NO_TAG) {
    note('已指定 --no-tag，跳过');
  } else if (DRY) {
    note('（dry-run）将创建 ' + newTag);
  } else {
    git(['tag', newTag]);
    note('已创建 ' + newTag);
  }

  if (DRY) {
    console.log(c.yellow('\n--dry-run 结束，未推送。'));
    return;
  }

  // 5. 推送
  step(5, '推送');
  const target = git(['rev-parse', 'HEAD']);
  if (!(await pushWithRetry(4))) die('推送失败（已重试 4 次）。可改用 tmp/replay-remote.js');
  note('推送成功');

  // 6. 校验线上
  step(6, '校验线上文件');
  const local = fs.readFileSync(path.join(ROOT, APP_FILE));
  const deadline = Date.now() + 180000;
  let ok = false;
  while (Date.now() < deadline) {
    try {
      const remoteBuf = await fetchPage(PAGES + APP_FILE);
      if (remoteBuf.equals(local)) { ok = true; break; }
      note('线上还是旧版本（' + remoteBuf.length + ' / ' + local.length + ' 字节），等待构建…');
    } catch (e) {
      note('拉取失败: ' + e.message);
    }
    await new Promise((r) => setTimeout(r, 15000));
  }
  if (!ok) die('3 分钟内线上未更新，去 Actions 看看 Pages 构建状态');
  console.log(c.green('\n✓ 发布完成 ' + target.slice(0, 7) + (NO_TAG ? '' : ' · ' + newTag)) +
    '\n  ' + PAGES + '\n  手机上关掉桌面图标重开一次即可更新');
})().catch((e) => die(e && e.stack ? e.stack : String(e)));
