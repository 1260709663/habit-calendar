const { JSDOM, VirtualConsole } = require('jsdom');
const fs = require('fs');
const path = require('path');

const APP = path.join(__dirname, '..', 'habit-calendar.html');
const STORE_KEY = 'gym-log-v1';

/** 相对今天的日期键，例如 dk(-1) = 昨天。测试里不要写死日期。 */
function dk(off) {
  const d = new Date();
  d.setDate(d.getDate() + off);
  const p = (x) => String(x).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

/** 断言收集器 */
function createT() {
  const fails = [];
  return {
    fails,
    ok(cond, msg) {
      if (!cond) fails.push(msg);
    },
    eq(actual, expected, msg) {
      if (actual !== expected) fails.push(msg + '（实际 ' + JSON.stringify(actual) + '，期望 ' + JSON.stringify(expected) + '）');
    },
    contains(hay, needle, msg) {
      if (String(hay).indexOf(needle) === -1) fails.push(msg + '（实际内容不含「' + needle + '」）');
    },
    notContains(hay, needle, msg) {
      if (String(hay).indexOf(needle) !== -1) fails.push(msg + '（不应含「' + needle + '」）');
    },
    boot,
    dk,
  };
}

/**
 * 启动一个应用实例。
 * opts.seed  写入 localStorage 的存档
 * opts.confirm  confirm 返回值（默认 true）
 */
function boot(opts) {
  opts = opts || {};
  const errors = [];

  const vc = new VirtualConsole();
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e.detail ? e.detail.stack || e.detail : e.message)));
  vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

  let oscCount = 0;

  const dom = new JSDOM(fs.readFileSync(APP, 'utf8'), {
    url: 'https://example.com/app',
    runScripts: 'dangerously',
    virtualConsole: vc,
    beforeParse(w) {
      w.alert = (m) => errors.push('alert: ' + m);
      w.confirm = () => (opts.confirm === undefined ? true : opts.confirm);
      w.prompt = (m, d) => d;
      class FakeCtx {
        constructor() { this.state = 'running'; this.currentTime = 0; this.destination = {}; }
        createOscillator() {
          oscCount += 1;
          return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} };
        }
        createGain() {
          return { gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
        }
        resume() { this.state = 'running'; }
      }
      w.AudioContext = FakeCtx;
      if (opts.seed) w.localStorage.setItem(STORE_KEY, JSON.stringify(opts.seed));
    },
  });

  const win = dom.window;
  const doc = win.document;
  const $ = (s, r) => (r || doc).querySelector(s);
  const $$ = (s, r) => Array.from((r || doc).querySelectorAll(s));

  const click = (el) => {
    if (!el) throw new Error('click(): 元素不存在');
    el.dispatchEvent(new win.MouseEvent('click', { bubbles: true }));
  };

  const setVal = (sel, v) => {
    const el = typeof sel === 'string' ? $(sel) : sel;
    if (!el) throw new Error('setVal(): 找不到 ' + sel);
    el.value = String(v);
    el.dispatchEvent(new win.Event('input', { bubbles: true }));
  };

  const chip = (p) => $$('#tDay .pchip').find((b) => b.dataset.p === p);
  const seg = (m) => $$('#tDay .seg').find((b) => b.dataset.mode === m);
  const items = () => $$('#tDay .item');
  const lastItem = () => items().slice(-1)[0];

  // 添加区默认收起，操作前先展开，贴近真实点击路径
  const openAdd = () => {
    const body = $('#tDay .addbody');
    if (body && body.hidden) click($('#tDay .addtoggle'));
  };

  const addEx = (name, part, w, r, n) => {
    openAdd();
    click(chip(part));
    setVal('#exName', name);
    setVal('#exW', w);
    setVal('#exR', r);
    setVal('#exS', n);
    click($('#exAdd'));
  };

  const addTimed = (name, part, unit, val, n) => {
    openAdd();
    click(chip(part));
    if (!seg('时').classList.contains('on')) click(seg('时'));
    const u = $('#exUnit');
    u.value = unit;
    u.dispatchEvent(new win.Event('change', { bubbles: true }));
    setVal('#exName', name);
    setVal('#exR', val);
    setVal('#exS', n);
    click($('#exAdd'));
  };

  const ensureOpen = () => {
    const el = lastItem();
    if (el && !el.classList.contains('open')) click(el.querySelector('.itemhead'));
  };

  const checks = (i) => items()[i].querySelectorAll('.setcheck');

  const stored = () => JSON.parse(win.localStorage.getItem(STORE_KEY));

  const goDay = (off) => {
    const btn = $('#tDays [data-key="' + dk(off) + '"]');
    if (!btn) throw new Error('日历上找不到 ' + dk(off) + '（可能跨月）');
    click(btn);
  };

  return {
    win, doc, $, $$, click, setVal, chip, seg, items, lastItem, addEx, addTimed,
    ensureOpen, checks, stored, goDay, errors,
    osc: () => oscCount,
    close: () => win.close(),
  };
}

module.exports = { createT, boot, dk };
