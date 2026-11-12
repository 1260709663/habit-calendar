/**
 * 热身组：生成、显示、统计排除、打勾起表、改组数、清除
 */
module.exports.run = async (t) => {
  const dk = t.dk;
  const app = t.boot({
    seed: { sessions: {}, exercises: { '深蹲': '腿' }, templates: {} },
  });
  const { $, $$, click, items, lastItem, addEx, ensureOpen } = app;

  const day = dk(0);
  addEx('深蹲', '腿', 100, 8, 2);
  ensureOpen();

  const wbtn = lastItem().querySelector('[data-act="warm"]');
  t.ok(!!wbtn, '没有「热身」按钮');
  click(wbtn);
  t.eq($('#warmModal').hidden, false, '热身弹窗没打开');
  click($$('#warmPick [data-wk]').find((b) => b.dataset.wk === '3'));

  const rows = lastItem().querySelectorAll('.setrow');
  t.eq(rows.length, 5, '应为 3 组热身 + 2 组工作');
  t.eq($$('#tDay .setrow.warm').length, 3, '热身组样式没生效');
  t.eq($$('#tDay .setsplit').length, 2, '缺少「热身 / 工作组」分隔');
  t.eq(Number($$('#tDay .setrow.warm input[data-f="w"]')[0].value), 50, '第一组热身应为 100×50%');

  const sum = lastItem().querySelector('.isets').textContent;
  t.ok(sum.indexOf('W3') === 0, '摘要应带 W3 前缀，实际 ' + sum);
  t.contains(sum, '100×8×2', '摘要只应显示工作组');
  t.contains($('#tDay .daysum').textContent, '含 3 组热身', '当日摘要没标热身组数');
  t.contains($('#tDay .daysum').textContent, '容量 1.6 吨', '容量只应统计工作组 100×8×2');

  // 热身组打勾也要起表
  click(lastItem().querySelectorAll('.setcheck')[0]);
  t.eq($('#restBar').hidden, false, '热身组打勾没有起表');
  click($('#restSkip'));

  // 改组数 → 1 组
  click(lastItem().querySelector('[data-act="warm"]'));
  click($$('#warmPick [data-wk]').find((b) => b.dataset.wk === '1'));
  t.eq($$('#tDay .setrow.warm').length, 1, '重设热身为 1 组失败');

  // 清除热身
  click(lastItem().querySelector('[data-act="warm"]'));
  click($$('#warmPick [data-wk]').find((b) => b.dataset.wk === '0'));
  t.eq($$('#tDay .setrow.warm').length, 0, '清除热身失败');
  t.notContains(items()[0].querySelector('.isets').textContent, 'W', '清除后摘要不该还有 W 前缀');

  t.eq(app.errors.length, 0, '运行期报错: ' + app.errors.join(' | '));
  app.close();
};
