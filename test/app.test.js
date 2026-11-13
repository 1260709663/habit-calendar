/**
 * 训练日主流程：辅助动作、次要部位、周统计口径、改部位、暂停、摘要、打勾、趋势
 */
module.exports.run = async (t) => {
  const dk = t.dk;
  const seed = {
    sessions: {
      [dk(-3)]: {
        type: 'push', ab: 'A',
        items: [{
          name: '辅助引体向上', part: '背', also: ['臂'], assist: true, unit: '次', note: '',
          sets: [[40, 8, null, true]],
        }],
      },
      [dk(-1)]: {
        type: 'legs', ab: 'A',
        items: [{
          name: '深蹲', part: '腿', unit: '次', note: '',
          sets: [[10, 20, null, false], [10, 20, null, false], [10, 20, null, false], [10, 16, null, false]],
        }],
      },
    },
    exercises: { '辅助引体向上': '背', '深蹲': '腿' },
    templates: {},
  };

  const app = t.boot({ seed });
  const { $, $$, click, setVal, chip, items, lastItem, addEx, ensureOpen, checks, stored, goDay } = app;

  // 0. 添加区默认收起，点开再收起
  t.ok(!!$('#tDay .addtoggle'), '没有「＋ 添加动作」按钮');
  t.eq($('#tDay .addbody').hidden, true, '添加区默认应收起');
  click($('#tDay .addtoggle'));
  t.eq($('#tDay .addbody').hidden, false, '点开后添加区应展开');
  click($('#tDay .addtoggle'));
  t.eq($('#tDay .addbody').hidden, true, '再点应收起');

  // 1. 辅助动作：容量不计、摘要带「辅」、组行标注、反向 PR
  addEx('辅助引体向上', '背', 35, 8, 2);
  const it1 = items().find((el) => el.querySelector('.iname').textContent === '辅助引体向上');
  t.ok(!!it1, '辅助动作没添加成功');
  t.contains(it1.querySelector('.isets').textContent, '辅', '辅助摘要缺前缀');
  t.contains($('#tDay .daysum').textContent, '容量 0 kg', '辅助动作不该计入容量');
  t.ok(it1.classList.contains('pr'), '35kg 比历史 40kg 更轻，应判定为 PR');
  ensureOpen();
  t.contains(Array.from($$('#tDay .setrow span')).map((x) => x.textContent).join('|'), '辅助 kg ×', '组行没标注「辅助」');

  // 2. 复合动作带出次要部位
  addEx('卧推', '胸', 60, 8, 2);
  const it2 = lastItem();
  const alsoTxt = it2.querySelector('.ialso') ? it2.querySelector('.ialso').textContent : '';
  t.contains(alsoTxt, '肩', '卧推没带出次要部位「肩」');

  // 3. 次要部位不计入周统计组数
  const shoulderRow = $$('#tWeek .wrow').find((r) => r.querySelector('span').textContent === '肩');
  t.ok(!!shoulderRow, '周统计里找不到「肩」');
  if (shoulderRow) t.contains(shoulderRow.querySelector('b').textContent, '0 组', '次要部位不该计入组数');

  // 4. 改部位 + 列表去重
  goDay(-2);
  addEx('髋外展', '臀', 30, 15, 2);
  click(chip('腿'));
  t.notContains($$('#tDay .qchip').map((b) => b.dataset.name).join(','), '髋外展', '髋外展不该出现在「腿」列表');
  click(chip('臀'));
  t.contains($$('#tDay .qchip').map((b) => b.dataset.name).join(','), '髋外展', '髋外展应出现在「臀」列表');

  ensureOpen();
  const partBtn = lastItem().querySelector('[data-act="part"]');
  t.ok(!!partBtn, '没有「改部位」按钮');
  click(partBtn);
  t.eq($('#partModal').hidden, false, '部位面板没打开');
  click($$('#partPick [data-pk]').find((b) => b.dataset.pk === '腿'));
  t.eq($('#partModal').hidden, true, '选完部位面板没关闭');
  t.eq(lastItem().querySelector('.ipart').textContent, '腿', '部位没改成「腿」');
  t.eq((stored().overrides || {})['髋外展'], '腿', '部位覆盖没落盘');

  // 5. 训练暂停 / 继续
  const startBtn = $('#tDay [data-act="startTrain"]');
  if (startBtn) click(startBtn);
  t.ok(!!$('#trainClock'), '开始训练后没有时钟');
  click($('#tDay [data-act="pauseTrain"]'));
  t.ok(!!$('#tDay .trainbar.pause'), '暂停状态没生效');
  t.ok(!!$('#tDay [data-act="resumeTrain"]'), '暂停后没有「继续」按钮');
  click($('#tDay [data-act="resumeTrain"]'));
  t.ok(!!$('#trainClock'), '继续后时钟没恢复');

  // 6. 摘要压缩（重量相同、次数不同）
  goDay(-1);
  const squat = items().find((el) => el.querySelector('.iname').textContent === '深蹲');
  t.ok(!!squat, '找不到深蹲记录');
  if (squat) t.eq(squat.querySelector('.isets').textContent, '10×20/20/20/16', '摘要压缩不正确');

  // 7. 打勾起表
  goDay(0);
  ensureOpen();
  click(lastItem().querySelector('.setcheck'));
  t.eq($('#restBar').hidden, false, '打勾后没有起表');
  t.eq($('#restTime').textContent, '1:30', '倒计时初值不对');
  click($('#restSkip'));

  // 8. 辅助动作的趋势不显示 1RM
  const assIdx = items().findIndex((el) => el.querySelector('.iname').textContent === '辅助引体向上');
  t.ok(assIdx >= 0, '找不到辅助动作');
  if (assIdx >= 0) {
    if (!items()[assIdx].classList.contains('open')) click(items()[assIdx].querySelector('.itemhead'));
    click(items()[assIdx].querySelector('[data-act="chart"]'));
    t.notContains($('#mPr').textContent, '1RM', '辅助趋势不该出现 1RM');
    t.contains($('#mPr').textContent, '最低辅助', '辅助趋势缺少「最低辅助」');
    click($('#tClose'));
  }

  t.eq(app.errors.length, 0, '运行期报错: ' + app.errors.join(' | '));
  app.close();
};
