/**
 * 打勾最后一组后的结束确认：弹层、拒绝、重复询问规则、确认结束
 */
module.exports.run = async (t) => {
  const dk = t.dk;
  const app = t.boot({ seed: { sessions: {}, exercises: {}, templates: {} } });
  const { $, click, items, addEx, ensureOpen, stored, goDay } = app;

  goDay(-6);
  addEx('深蹲', '腿', 100, 8, 2);
  ensureOpen();

  const cks = () => [...items()[0].querySelectorAll('.setcheck')];

  // 1. 只完成一组：不弹
  click(cks()[0]);
  t.eq($('#endAsk').hidden, true, '没做完不该弹结束确认');

  // 2. 完成最后一组：弹，但不写结束时间
  click(cks()[1]);
  t.eq($('#endAsk').hidden, false, '打勾最后一组应弹出结束确认');
  t.contains($('#endAskDesc').textContent, '组', '弹层应显示组数');
  t.eq(stored().sessions[dk(-6)].endAt, 0, '未确认前不该写结束时间');

  // 3. 点「还没完」：关闭，继续计时
  click($('#endNo'));
  t.eq($('#endAsk').hidden, true, '点「还没完」应关闭弹层');
  t.eq(stored().sessions[dk(-6)].endAt, 0, '点「还没完」不该结束计时');
  t.ok(!!$('#trainClock'), '点「还没完」应继续保持训练中');

  // 4. 取消再打勾：同一批动作不重复询问
  click(cks()[0]);
  click(cks()[0]);
  t.eq($('#endAsk').hidden, true, '同一批动作取消再打勾不该重复询问');

  // 5. 新增动作并做完：再次询问
  addEx('腿弯举', '腿', 30, 12, 2);
  ensureOpen();
  const cks2 = () => [...items().slice(-1)[0].querySelectorAll('.setcheck')];
  click(cks2()[0]);
  click(cks2()[1]);
  t.eq($('#endAsk').hidden, false, '新增动作做完后应再次询问');

  // 6. 确认结束
  click($('#endYes'));
  t.eq($('#endAsk').hidden, true, '点结束应关闭弹层');
  t.ok(stored().sessions[dk(-6)].endAt > 0, '点结束应写入结束时间');
  t.ok(!!$('#tDay .repcard'), '结束后应出现评估卡');
  t.eq($('#trainClock'), null, '结束后不该还有运行中的时钟');

  app.close();
};
