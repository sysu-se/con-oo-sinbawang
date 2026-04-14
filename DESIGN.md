# DESIGN.md

## 实现概览

保留两个核心领域对象 `Sudoku` 和 `Game`

- `Sudoku` 负责当前局面，负责 fixed cell，负责冲突检测和完成态判断，也负责序列化和外表化
- `Game` 负责会话级操作，持有当前 `Sudoku`，管理 `undoStack` 和 `redoStack`，提供 `guess()` `undo()` 和 `redo()`
- Svelte 界面通过 `src/node_modules/@sudoku/stores/grid.js` 这个 store adapter 间接消费领域对象

---

## A. 领域对象如何被消费

### 1. View 层直接消费的是什么

View 层直接消费 store adapter，通过它读取 `Game` 和 `Sudoku` 导出的响应式快照

- `src/node_modules/@sudoku/stores/grid.js` 内部持有 `currentGame`
- `currentGame` 内部再持有当前 `Sudoku`
- 组件通过 `$store` 读取 adapter 暴露出来的响应式快照

`Game` 和 `Sudoku` 都是普通 JS 对象，本身不提供 Svelte 可直接订阅的更新通知
adapter 负责把领域状态转换成 UI 可消费的响应式数据

### 2. View 层拿到的数据是什么

View 层拿到的数据有这些

- `grid` 是初始题盘，用来区分固定格和用户填写格
- `userGrid` 是当前局面
- `invalidCells` 是冲突坐标
- `isSolved` 是领域层计算出的完成态
- `canUndo` 和 `canRedo` 表示当前是否可撤销和可重做
- `gameWon` 由 `isSolved` 派生
- `keyboardDisabled` 由现有 UI 状态派生

组件消费关系如下

- `src/components/Board/index.svelte` 消费 `$userGrid` 和 `$invalidCells`
- `src/components/Controls/ActionBar/Actions.svelte` 消费 `$canUndo` 和 `$canRedo`
- `src/node_modules/@sudoku/stores/game.js` 消费 `isSolved`
- `src/node_modules/@sudoku/stores/keyboard.js` 消费 `grid` `cursor` 和 `gamePaused`

### 3. 用户操作如何进入领域对象

#### 普通输入

- `src/components/Controls/Keyboard.svelte` 调用 `userGrid.set($cursor, num)`
- adapter 把它转换成 `currentGame.guess({ row, col, value })`
- `Game.guess()` 再调用 `Sudoku.guess()`
- 成功后执行 `syncFromGame()`，把最新快照发布给 UI

#### Undo 和 Redo

- `src/components/Controls/ActionBar/Actions.svelte` 调用 `userGrid.undo()` 和 `userGrid.redo()`
- adapter 内部调用 `currentGame.undo()` 和 `currentGame.redo()`
- 成功后执行 `syncFromGame()`

#### Hint

- `userGrid.applyHint($cursor)` 先求出提示值
- 再调用 `currentGame.guess(...)`
- Hint 走的也是 `guess()` 路径，会进入历史，并且可以被 `undo()`

#### 开始一局游戏

- `startNew(...)` 和 `startCustom(...)` 更新 `grid`
- `grid.subscribe(...)` 触发后，adapter 用新题盘重新创建 `Sudoku` 和 `Game`
- 然后 `syncFromGame()` 发布新局面的快照

### 4. 领域对象变化后 Svelte 为什么会更新

Svelte 更新的直接原因是 adapter 调用了 store 的 `set(...)`

更新路径如下

1. 用户操作进入 `Game` 和 `Sudoku`
2. 领域对象内部状态变化
3. adapter 调用 `syncFromGame()`
4. `syncFromGame()` 重新读取领域对象快照
5. adapter 执行 `userGrid.set(...)` `invalidCells.set(...)` `isSolved.set(...)` `canUndo.set(...)` 和 `canRedo.set(...)`
6. 组件里的 `$store` 收到新值后自动重渲染

store adapter 是响应式边界

---

## B. 响应式机制说明

### 1. 你依赖的是 `store` `$:` 重新赋值 还是其他机制

依赖的核心机制

- `writable(...)` 用来发布可订阅状态
- 组件里的 `$store` 会自动订阅 store，并在值变化后更新 UI
- `derived(...)` 用来基于已有 store 派生 UI 状态
- adapter 里显式调用 `set(...)`，把领域对象的新快照推送给 Svelte

依赖的核心是 store `$store` 和显式 `set(...)`
`$:` 只在少数组件里做局部派生

### 2. 你的方案中哪些数据是响应式暴露给 UI 的

- `grid`
- `userGrid`
- `invalidCells`
- `isSolved`
- `canUndo`
- `canRedo`
- `gameWon`
- `gamePaused`
- `keyboardDisabled`

这些数据都是渲染需要看到的状态，或者交互按钮需要判断的状态

### 3. 哪些状态留在领域对象内部

- `Game` 内部持有的 `currentSudoku`
- `undoHistory` 和 `redoHistory`
- `Sudoku` 内部的 `grid` 原始引用
- `Sudoku` 内部的 `initialGrid` 原始引用
- 冲突检测 序列化校验 和深拷贝等辅助逻辑

UI 看到的是这些内部状态经过 adapter 转换后的快照

### 4. 如果不用你的方案而是直接 mutate 内部对象 会出现什么问题

如果直接修改领域对象内部字段或二维数组，主要会出现三个问题

#### 4.1 UI 可能不刷新

普通对象内部字段变化不会自动通知 Svelte
数据变化后，如果 adapter 没有重新 `set(...)`，组件里的 `$store` 就不会收到新值

#### 4.2 容易绕过领域规则

直接改数组会绕过下面这些逻辑

- `guess(...)`
- fixed cell 保护
- Undo 和 Redo 历史记录
- 冲突检测和完成态同步

UI 和领域对象状态会失去一致性

#### 4.3 UI 快照会变旧

例如盘面可能被改了，但 `invalidCells` `isSolved` `canUndo` 和 `canRedo` 都没有同步更新，结果就是数据和界面不同步

---

## C. 改进说明

### 1. 相比 HW1 你改进了什么

这次主要有四类改进

#### 1.1 `Sudoku` 承担了更多真正的领域职责

现在的 `Sudoku` 负责下面这些事情

- `9x9` 结构校验
- `0..9` 值域校验
- fixed cell 建模
- `getCell(row, col)` 单格读取
- `getInvalidCells()` 冲突检测
- `isSolved()` 完成态判断

#### 1.2 `Game` 的封装边界更干净

`Game` 通过 `Sudoku.getCell()` 获取旧值，再通过 `Sudoku.guess()` 执行写入

`Game` 不需要知道 `Sudoku` 的内部表示细节

#### 1.3 序列化协议更完整

- `Sudoku.toJSON()` 和 `Game.toJSON()` 会输出 `type` 和 `version`
- `createSudokuFromJSON()` 和 `createGameFromJSON()` 会真正校验这些字段
- `Sudoku` 还会保留 `initialGrid`，保证恢复后 fixed cell 信息不丢失

#### 1.4 领域对象真正接入了真实界面

真实流程里的开始新局 普通输入 Hint Undo 和 Redo 以及完成态更新，统一通过 adapter 进入 `Game` 和 `Sudoku`

### 2. 为什么 HW1 中的做法不足以支撑真实接入

HW1 的主要问题在于对象和真实界面之间没有稳定的桥接层

#### 2.1 领域对象和真实界面是脱开的

如果 `Sudoku` 和 `Game` 只在测试里使用，而真实界面仍然直接改数组，那就不能算真正接入

#### 2.2 响应式边界不明确

普通 JS 对象不会自动驱动 Svelte 刷新
缺少 adapter 时，即使领域对象设计得不错，UI 也不一定会跟着更新

#### 2.3 规则容易漂到 UI 层

如果 `Sudoku` 本身没有承担 fixed cell 冲突检测和完成态这些职责，相关逻辑就会散落到 store 或组件里，导致职责边界变差

### 3. 你的新设计有哪些 trade-off

我选择的是 store adapter，让 `Game` 和 `Sudoku` 保持普通领域对象

#### 优点

- 领域层保持纯粹，不依赖 Svelte
- `Sudoku` 和 `Game` 仍然容易单独测试
- 组件层只负责读状态和发命令
- 响应式边界集中在 adapter，结构更清晰

#### 代价

- 需要维护一个 `syncFromGame()`
- 每次同步都要把领域状态复制成 UI 快照
- adapter 会多一层桥接代码

我接受这个 trade-off，是因为它把领域逻辑和 Svelte 响应式分在了不同层里
领域对象只负责业务，adapter 只负责同步，组件只负责消费和触发操作，三层职责更清楚
