/**
 * 存档兼容：旧格式（无 unit / also / assist / 暂停字段、sets 只有两位）能否被正确升级
 */
module.exports.run = async (t) => {
  const dk = t.dk;
  const legacy = {
    sessions: {
      [dk(-2)]: {
        type: 'push', ab: 'A',
        items: [
          { name: '卧推', part: '胸', note: '', sets: [[60, 8], [60, 8]] },
          { name: '辅助引体向上', part: '背', note: '', sets: [[40, 8]] },
          { name: '平板支撑', part: '核心', note: '', sets: [[60, 1]] },
        ],
      },
    },
    exercises: { '卧推': '胸', '辅助引体向上': '背', '平板支撑': '核心' },
    templates: {},
  };

  const app = t.boot({ seed: legacy });
  const { $, click, stored, goDay, ensureOpen, lastItem, items } = app;

  t.eq(app.errors.length, 0, '旧存档加载报错: ' + app.errors.join(' | '));

  goDay(-2);
  t.eq(items().length, 3, '旧存档应读出 3 个动作');

  // 打一个勾触发落盘，读取升级后的结构
  ensureOpen();
  click(lastItem().querySelector('.setcheck'));

  const saved = stored().sessions[dk(-2)];
  t.ok(!!saved, '落盘后找不到该天记录');
  if (saved) {
    const it = saved.items[0];
    t.eq(it.sets[0].length, 5, 'sets 应升级为 5 位（重量/次数/RIR/完成/热身）');
    t.eq(it.sets[0][4], false, '旧组不该被标成热身');
    t.eq(it.unit, '次', '缺 unit 时应推断为「次」');
    t.ok(Array.isArray(it.also) && it.also.indexOf('肩') !== -1, '卧推应自动带出次要部位「肩」');
    t.eq(it.assist, false, '卧推不该是辅助动作');

    t.eq(saved.items[1].assist, true, '名字含「辅助」应自动识别为辅助动作');
    t.eq(saved.items[2].unit, '秒', '平板支撑应推断为「秒」');

    t.ok(saved.overrides === undefined || typeof saved.overrides === 'object', '顶层不该出现非法 overrides');
    t.eq(saved.pausedAt, 0, '旧记录缺 pausedAt 时应补 0');
    t.eq(saved.feel, null, '旧记录缺 feel 时应为 null');
  }

  app.close();
};
