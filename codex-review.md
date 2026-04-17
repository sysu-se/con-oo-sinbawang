# con-oo-sinbawang - Review

## Review 结论

这份代码已经把领域对象接进了真实的开始游戏、渲染、输入和撤销重做流程，基本摆脱了只在测试里可用的状态；但接入层没有完全收口，Svelte 侧仍保留了旧 grid store 作为并行真相源，导致领域模型、适配层和组件之间的边界还不够干净，整体属于能工作但设计质量仍有明显改进空间的实现。

## 总体评价

| 维度 | 评价 |
| --- | --- |
| OOP | good |
| JS Convention | good |
| Sudoku Business | good |
| OOD | fair |

## 缺点

### 1. UI 仍并行依赖旧 grid store，领域对象不是唯一真相源

- 严重程度：core
- 位置：src/node_modules/@sudoku/stores/grid.js:22-73; src/components/Board/index.svelte:48-51; src/node_modules/@sudoku/stores/keyboard.js:6-10
- 原因：当前局面虽然来自 currentGame 和 userGrid，但是否为题面给定数字、键盘是否可编辑等关键判断仍通过旧的 $grid[y][x] === 0 完成，而不是通过 Sudoku.isFixed 或适配层暴露的领域状态完成。这样 View 同时依赖旧数组和领域对象两套模型，违背了真实界面真正消费领域对象的目标，也让题面语义分散在 UI 与 store 之间。

### 2. 适配层靠手工同步多个 store，响应式边界分散

- 严重程度：major
- 位置：src/node_modules/@sudoku/stores/grid.js:56-103
- 原因：syncFromGame 每次都先 getSudoku 克隆，再分别 set 到 userGrid、invalidCells、canUndo、canRedo、isSolved。领域层没有稳定的单一 UI 快照接口，任何新增命令都必须记得补一次同步，否则就会出现部分 store 落后的隐性 bug。对 Svelte 来说，这种命令式扇出同步比一个收敛的 custom store 或 adapter 更脆弱。

### 3. undo 和 redo 不校验回放是否真正成功

- 严重程度：major
- 位置：src/domain/game.js:100-119
- 原因：undo 和 redo 调用 applyValue 之后直接改写历史栈并返回 true，完全忽略 Sudoku.guess 的返回值。如果反序列化进来的历史与当前棋盘不一致，或者后续规则调整导致该步不可重放，历史会继续推进但棋盘可能并未变化。对于负责历史管理的 Game，这会破坏撤销重做语义的可靠性。

### 4. Sudoku 反序列化对 initialGrid 缺失的降级语义过于隐式

- 严重程度：minor
- 位置：src/domain/sudoku.js:55-62; src/domain/sudoku.js:230-247
- 原因：当 JSON 缺少 initialGrid 时，代码会把当前 grid 复制成 initialGrid。这样恢复一个已进行中的棋盘时，所有当前非零格都会被当作固定题面。虽然自家 toJSON 目前会带上 initialGrid，但这个默认值会让边界输入的业务语义悄悄改变，接口契约不够清晰。

## 优点

### 1. Sudoku 的边界校验和封装比较完整

- 位置：src/domain/sudoku.js:6-62; src/domain/sudoku.js:171-227
- 原因：对 grid shape、坐标和值域都做了显式校验，并通过闭包和 defensive copy 保护内部数组，getGrid、clone、toJSON 都避免了把可变内部状态直接暴露出去。

### 2. Game 与 Sudoku 的职责边界基本清楚

- 位置：src/domain/game.js:54-139
- 原因：棋盘读写、固定格判断和校验留在 Sudoku，Game 负责当前 Sudoku 与撤销重做历史，至少没有把历史逻辑重新塞回棋盘对象里。

### 3. 历史记录采用增量而不是整盘快照

- 位置：src/domain/game.js:81-98; src/domain/game.js:100-119
- 原因：撤销栈只记录 row、col、before、after，成本比整盘 clone 更低，也让新输入清空 redo 这样的命令语义实现得比较直接。

### 4. 真实交互已经走进领域对象

- 位置：src/node_modules/@sudoku/stores/grid.js:52-103; src/components/Controls/Keyboard.svelte:10-25; src/components/Controls/ActionBar/Actions.svelte:13-28
- 原因：键盘输入、Hint 写入、Undo、Redo 都是调用 currentGame.guess、undo、redo，而不是在组件里直接修改二维数组，这一点满足了作业最核心的真实接入要求。

### 5. 当前棋盘渲染来自领域对象导出的响应式状态

- 位置：src/node_modules/@sudoku/stores/grid.js:60-68; src/components/Board/index.svelte:40-51
- 原因：Board 渲染的是 userGrid，而 userGrid 由 currentGame.getSudoku().getGrid 同步得到；invalidCells、isSolved、canUndo、canRedo 也都由领域对象结果驱动，说明渲染刷新链路已经打通。

## 补充说明

- 本次仅静态阅读了 src/domain/* 以及直接关联的 src/node_modules/@sudoku/stores/*、src/components/* 接入代码，未运行测试，也未实际点击 Svelte 界面。
- 关于开始一局游戏、用户输入、Undo/Redo、胜利联动和界面自动更新的判断，基于 src/node_modules/@sudoku/game.js、src/node_modules/@sudoku/stores/grid.js 与组件引用关系的静态推断。
- 本次没有把 DESIGN.md 的文档解释质量计入评分；文档要求来自 作业要求.md，但这里主要审查代码实现本身。
