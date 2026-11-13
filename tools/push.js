#!/usr/bin/env node
/**
 * git push 不可用时的兜底：用 GitHub Git Data API 精确重放本地提交。
 *
 * 原理：提交的 SHA 只由 tree、父提交、作者、时间、message 决定，
 * 所以按原样重建出来的提交和本地完全一致，远端历史不会分叉。
 *
 *   node tools/push.js           把 origin/main..HEAD 推上去，并补建缺失的标签
 *
 * 需要 GITHUB_TOKEN 环境变量（Bearer 令牌）。
 */
const { execFileSync } = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const TOKEN = process.env.GITHUB_TOKEN;
if (!TOKEN) {
  console.error('缺少 GITHUB_TOKEN 环境变量');
  process.exit(1);
}

function git(argv) {
  const out = execFileSync('git', argv, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return out == null ? '' : String(out).trim();
}

const remoteUrl = git(['remote', 'get-url', 'origin']);
const m = /github\.com[:/]([^/]+)\/([^/.]+)/.exec(remoteUrl);
if (!m) {
  console.error('无法从 origin 解析出 GitHub 仓库: ' + remoteUrl);
  process.exit(1);
}
const OWNER = m[1];
const REPO = m[2];
const API = 'https://api.github.com/repos/' + OWNER + '/' + REPO;
const H = {
  Authorization: 'Bearer ' + TOKEN,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'habit-calendar-push',
  'Content-Type': 'application/json',
};

async function api(pathname, opts) {
  const res = await fetch(API + pathname, Object.assign({}, opts, { headers: H }));
  const text = await res.text();
  if (!res.ok) throw new Error(res.status + ' ' + text.slice(0, 300));
  return text ? JSON.parse(text) : null;
}

(async () => {
  const base = git(['rev-parse', 'refs/remotes/origin/main']);
  const list = git(['log', '--reverse', '--format=%H', base + '..HEAD']).split('\n').filter(Boolean);
  console.log('待重放提交: ' + list.length);

  let parent = base;
  const seen = new Set();
  for (const sha of list) {
    const meta = git(['show', '-s', '--format=%T|%an|%ae|%aI|%cn|%ce|%cI', sha]).split('|');
    const tree = meta[0];
    // 注意：GitHub 不归一化 message，格式里已有一个换行，这里必须精确补一个
    const message = git(['show', '-s', '--format=%B', sha]).replace(/\n+$/, '') + '\n';
    const entries = git(['ls-tree', '-r', sha]).split('\n').filter(Boolean).map((line) => {
      const mm = /^(\d+) (\w+) ([0-9a-f]+)\t(.+)$/.exec(line);
      return { mode: mm[1], type: mm[2], sha: mm[3], path: mm[4] };
    });

    for (const e of entries) {
      if (seen.has(e.sha)) continue;
      const buf = execFileSync('git', ['cat-file', 'blob', e.sha], { cwd: ROOT, maxBuffer: 64 * 1024 * 1024 });
      const blob = await api('/git/blobs', {
        method: 'POST',
        body: JSON.stringify({ content: buf.toString('base64'), encoding: 'base64' }),
      });
      if (blob.sha !== e.sha) throw new Error('blob 不一致: ' + e.path);
      seen.add(e.sha);
    }

    const newTree = await api('/git/trees', {
      method: 'POST',
      body: JSON.stringify({ tree: entries.map((e) => ({ path: e.path, mode: e.mode, type: 'blob', sha: e.sha })) }),
    });
    if (newTree.sha !== tree) throw new Error('tree 不一致: ' + newTree.sha + ' != ' + tree);

    const commit = await api('/git/commits', {
      method: 'POST',
      body: JSON.stringify({
        message: message,
        tree: tree,
        parents: [parent],
        author: { name: meta[1], email: meta[2], date: meta[3] },
        committer: { name: meta[4], email: meta[5], date: meta[6] },
      }),
    });
    if (commit.sha !== sha) throw new Error('commit 不一致: ' + commit.sha + ' != ' + sha);
    console.log('✓ ' + sha.slice(0, 7) + ' ' + git(['show', '-s', '--format=%s', sha]));
    parent = sha;
  }

  await api('/git/refs/heads/main', { method: 'PATCH', body: JSON.stringify({ sha: parent, force: true }) });
  git(['update-ref', 'refs/remotes/origin/main', parent]);
  console.log('远端 main -> ' + parent.slice(0, 7));

  // 补建远端缺失的标签
  const tags = git(['tag', '-l']).split('\n').filter(Boolean);
  let made = 0;
  for (const t of tags) {
    const sha = git(['rev-parse', t + '^{commit}']);
    const res = await fetch(API + '/git/refs', {
      method: 'POST', headers: H, body: JSON.stringify({ ref: 'refs/tags/' + t, sha }),
    });
    if (res.ok) { made++; continue; }
    if (res.status !== 422) console.log('标签 ' + t + ' 失败: ' + res.status);
  }
  if (made) console.log('补建标签 ' + made + ' 个');
})().catch((e) => {
  console.error('失败: ' + (e && e.message ? e.message : e));
  process.exit(1);
});
