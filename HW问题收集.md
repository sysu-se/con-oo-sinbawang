# HW问题收集

## 已解决

1. 领域对象接入后界面不刷新
   1. 上下文: 在 HW1.1 里先完成 `Sudoku` 和 `Game` 后，我一开始只是让对象内部自己改状态，但 Svelte 组件没有跟着更新，因为普通 JS 对象不会自动触发界面响应
   2. 解决手段: 我在Coding Agent帮助下学习了现有 store 的组织方式，在 `src/node_modules/@sudoku/stores/grid.js` 增加 store adapter，用 `syncFromGame()` 把领域对象快照同步到 `userGrid` `invalidCells` `isSolved` `canUndo` `canRedo`，再让组件只消费这些 store

2. 输入 Hint Undo Redo 走了不同路径，历史记录容易不一致
   1. 上下文: 在把真实界面接到领域层时，如果普通输入通过 `guess()`，但 Hint 直接改数组，或者 adapter 不判断返回值就强制同步，就会出现无变化也重算、Hint 不能稳定进入历史、Undo Redo 状态不一致等问题
   2. 解决手段: 通过与舍友讨论，改为把普通输入 Hint Undo Redo 都统一收束到 `Game.guess()` `undo()` `redo()` 这条路径上，并且只在领域对象返回成功时才执行 `syncFromGame()`；Hint 也改成先 `guess` 成功再扣次数

3. 本地构建过程不稳定，测试通过但打包失败
   1. 上下文: 在 HW1.1 验证阶段，我遇到过依赖版本和构建流程问题，比如 `postcss-load-config` 兼容性问题，以及开发服务还占着 `dist` 导致 `npm run build` 清理失败
   2. 解决手段: 我一边查现有配置一边对照报错定位，最后调整了 `package.json` 里的相关依赖版本，去掉了有问题的 `postcss-clean` 配置，并在重新构建前停止占用 `dist` 的开发进程，最终把测试和构建都跑通了

## 未解决

1. store adapter 层缺少自动化测试
   1. 上下文: 目前测试主要覆盖 `src/domain/`，但真实界面依赖的 adapter 逻辑，比如坐标映射 `syncFromGame()` 触发时机 `canUndo` `canRedo` 更新，主要还是靠浏览器手工验证
   2. 尝试解决手段: 目前只能靠手工回归保证功能正确，后续如果继续完善，应该补一层针对 store adapter 的自动化测试

2. `syncFromGame()` 还有重复计算和多次深拷贝
   1. 上下文: 现在每次同步都要重新取 `Sudoku` 快照，再算冲突 再同步多个 store；从实现上看，`getInvalidCells()` 和 `isSolved()` 之间也还有重复扫描的空间，整体更偏向先求正确再求精简
   2. 尝试解决手段: 考虑过缓存一次冲突结果，或者减少 clone 链带来的重复开销，但这个问题目前没有继续优化。我暂时接受这份实现成本，优先保证作业功能和结构清楚

3. 序列化能力还没有进入真实保存和恢复流程
   1. 上下文: `toJSON()` 和 `fromJSON()` 在 HW1 和 HW1.1 里已经实现并通过测试，但真实界面里还没有 save load 入口，刷新页面后状态不会恢复
   2. 尝试解决手段: 尝试过把序列化结果接到本地存储或导入导出流程里，但未成功，这个问题目前还停留在领域层能力阶段，尚未接到真实 UI
