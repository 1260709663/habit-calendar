/**
 * 存档格式版本：schemaVersion 与逐级迁移。
 * 目标是“旧数据永远能读、新字段永远补齐、失败不崩”。
 */
module.exports.run = async (t) => {
  const dk = t.dk;

  // 1. 最老的存档：没有 schemaVersion，sets 只有两位，没有 unit/also/assist
  const v1 = {
    sessions: {
      [dk(-2)]: {
        type: 'push', ab: 'A',
        items: [
          { name: '卧推', part: '胸', note: '', sets: [[60, 8], [60, 8]] },
          { name: '辅助引体向上', part: '背', note: '', sets: [[40, 8]] },
        ],
      },
    },
    exercises: {},
    templates: {},
  };

  const app = t.boot({ seed: v1 });
  t.eq(app.errors.length, 0, 'v1 存档加载报错: ' + app.errors.join(' | '));
  app.goDay(-2);
  t.eq(app.items().length, 2, 'v1 存档应读出 2 个动作');

  // 触发落盘，检查升级后的结构
  app.ensureOpen();
  app.click(app.lastItem().querySelector('.setcheck'));
  const saved = app.stored();
  t.eq(saved.schemaVersion, 3, '落盘时应写入当前 schemaVersion');

  const it0 = saved.sessions[dk(-2)].items[0];
  t.eq(it0.sets[0].length, 5, 'sets 应补齐到 5 位');
  t.eq(it0.sets[0][3], false, '补齐的完成位应为 false');
  t.eq(it0.sets[0][4], false, '补齐的热身位应为 false');
  t.eq(it0.unit, '次', '缺 unit 应推断为次');
  t.ok(Array.isArray(it0.also) && it0.also.indexOf('肩') !== -1, '卧推应补出次要部位');
  t.eq(it0.assist, false, '卧推不是辅助动作');

  const it1 = saved.sessions[dk(-2)].items[1];
  t.eq(it1.assist, true, '辅助引体向上应标记为辅助');
  t.eq(saved.sessions[dk(-2)].pausedAt, 0, 'session 应补 pausedAt');
  t.eq(saved.sessions[dk(-2)].pausedMs, 0, 'session 应补 pausedMs');
  t.eq(saved.sessions[dk(-2)].feel, null, 'session 应补 feel');
  t.ok(!saved.overrides || typeof saved.overrides === 'object', 'overrides 应为对象');

  // 2. 显式写成 v1 的存档，与缺省等价
  const v1Explicit = Object.assign({}, JSON.parse(JSON.stringify(v1)), { schemaVersion: 1 });
  const app2 = t.boot({ seed: v1Explicit });
  t.eq(app2.errors.length, 0, '显式 v1 存档加载报错: ' + app2.errors.join(' | '));
  app2.goDay(-2);
  t.eq(app2.items().length, 2, '显式 v1 存档应读出 2 个动作');

  // 3. 已经是当前版本：迁移应幂等，不重复处理
  const v3 = JSON.parse(JSON.stringify(saved));
  const app3 = t.boot({ seed: v3 });
  t.eq(app3.errors.length, 0, 'v3 存档加载报错: ' + app3.errors.join(' | '));
  app3.goDay(-2);
  app3.ensureOpen();
  app3.click(app3.lastItem().querySelector('.setcheck'));
  const saved3 = app3.stored();
  t.eq(saved3.sessions[dk(-2)].items[0].sets[0].length, 5, '重复迁移不应改变 sets 长度');
  t.eq(saved3.schemaVersion, 3, 'schemaVersion 应保持 3');

  // 4. 来自更新版本的存档：不该崩，能降级读取
  const future = JSON.parse(JSON.stringify(v3));
  future.schemaVersion = 99;
  const app4 = t.boot({ seed: future });
  t.eq(app4.errors.length, 0, '未来版本存档加载报错: ' + app4.errors.join(' | '));
  app4.goDay(-2);
  t.eq(app4.items().length, 2, '未来版本存档仍应读出数据');

  app.close();
  app2.close();
  app3.close();
  app4.close();
};
