// 尾声：结算并走向结局。判定逻辑在 data/endings.js 的 judgeEnding。
export const SCRIPT = { id: 'ep', nodes: {
  start: { bg: 'ithaca_shore', who: null,
    text: `很多年以后，一个瞎眼的老人坐在爱奥尼亚的某个海边，<br>
      把这个故事唱给渔民听。<br><br>
      他唱的第一句是：<b>ἄνδρα μοι ἔννεπε, Μοῦσα</b>——<br>
      「告诉我，缪斯，那个人的事。」`,
    act: { notes: ['n_homer', 'n_nostos'] },
    next: 'judge' },
  judge: { ending: 'AUTO', text: '' },
} };
