/**
 * 训练评估卡：结束后出现、指标、与上次同类型对比、主观三档
 */
module.exports.run = async (t) => {
  const dk = t.dk;
  const now = Date.now();
  const seed = {
    sessions: {
      [dk(-7)]: {
        type: 'legs', ab: 'A',
        items: [{
          name: '深蹲', part: '腿', unit: '次', note: '',
          sets: [[100, 8, 2, true], [100, 8, 2, true]],
        }],
      },
      [dk(0)]: {
        type: 'legs', ab: 'A',
        startAt: now - 3600000, endAt: now - 600000, est: false,
        items: [
          {
            name: '深蹲', part: '腿', also: ['臀'], unit: '次', note: '',
            sets: [[50, 8, null, true, true], [100, 8, 1, true], [100, 8, 1, true]],
          },
          { name: '腿举', part: '腿', unit: '次', note: '', sets: [[120, 12, 3, true]] },
        ],
      },
    },
    exercises: { '深蹲': '腿', '腿举': '腿' },
    templates: {},
  };

  const app = t.boot({ seed });
  const { $, $$, click, stored } = app;

  const card = $('#tDay .repcard');
  t.ok(!!card, '训练结束后没出现评估卡');
  if (!card) { app.close(); return; }

  const txt = card.textContent;
  t.contains(txt, '本次训练', '评估卡缺标题');
  t.contains(txt, '50 分钟', '时长应为 3600000-600000=50 分钟');
  t.contains(txt, '3 组', '工作组数应为 3（热身不计）');
  t.contains(txt, '含 1 组热身', '评估卡没标热身组数');
  t.contains(txt, '容量', '评估卡缺容量行');
  t.contains(txt, '比上次', '缺少与上次同类型的对比');
  t.contains(txt, 'RIR≤1', '缺强度分布');
  t.contains(txt, '臀', '部位行应带上次多出的部位');

  // 主观三档
  const btns = $$('#tDay .feelbtn');
  t.eq(btns.length, 3, '应有三档按钮');
  click(btns.find((b) => b.dataset.v === 'ok'));
  t.eq((stored().sessions[dk(0)] || {}).feel, 'ok', '感受没落盘');
  t.ok($$('#tDay .feelbtn').find((b) => b.dataset.v === 'ok').classList.contains('on'), '选中态没生效');
  click($$('#tDay .feelbtn').find((b) => b.dataset.v === 'ok'));
  t.eq((stored().sessions[dk(0)] || {}).feel, null, '再点一次应取消');

  // 未结束训练不显示评估卡
  const before = $('#tDays [data-key="' + dk(-1) + '"]');
  if (before) {
    click(before);
    t.eq(!!$('#tDay .repcard'), false, '没有结束训练不该出现评估卡');
  }

  t.eq(app.errors.length, 0, '运行期报错: ' + app.errors.join(' | '));
  app.close();
};
