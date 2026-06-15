# Quality Guidelines

> Code quality standards for frontend development.

---

## Overview

<!--
Document your project's quality standards here.

Questions to answer:
- What patterns are forbidden?
- What linting rules do you enforce?
- What are your testing requirements?
- What code review standards apply?
-->

(To be filled by the team)

---

## Forbidden Patterns

<!-- Patterns that should never be used and why -->

(To be filled by the team)

---

## Required Patterns

<!-- Patterns that must always be used -->

(To be filled by the team)

---

## Testing Requirements

<!-- What level of testing is expected -->

(To be filled by the team)

---

## Code Review Checklist

<!-- What reviewers should check -->

(To be filled by the team)

## 多机器人胶囊头像组

### 触发范围
- 修改 `client/Capsule.vue` 或 `client/styles/capsule.scss` 中的 OneBot 多机器人头像组时适用。

### 契约
- 折叠态最多显示 3 个机器人头像；超过 3 个时额外显示一个 `+N` 数字头像，数字表示剩余机器人数量，字号需要小到能完整显示。
- 折叠态头像从右侧锚定并向左堆叠；多机器人左侧头像胶囊默认使用折叠宽度，悬停或键盘聚焦时左侧头像胶囊和头像组必须同步向左扩张，不能推动右侧正文。
- `.onebot-webqq__avatar-capsule` 和 `.onebot-webqq__bot-stack` 必须保留 `width 0.18s ease` 过渡，用来连续展开/折叠左侧可视区域；删除这个宽度过渡会让胶囊直接闪到终态。
- 视觉上必须仍然是一整颗连续胶囊：背景、边框、圆角、阴影和毛玻璃只能画在外层 `.onebot-webqq` 上；左侧 `.onebot-webqq__avatar-capsule` 和右侧 `.onebot-webqq__body` 只是布局/交互区域，不能各自画成两个独立胶囊。
- 胶囊必须拆成左侧 `.onebot-webqq__avatar-capsule` 和右侧 `.onebot-webqq__body` 两个兄弟区域；右侧正文必须作为外层视觉胶囊 `.onebot-webqq` 的同级固定覆盖层，不参与头像组展开的 flex 重新排布，也不能成为 Anime.js layout root 的后代。展开小胶囊或切换机器人时，机器人名称和状态文字不能出现左右位移、透明度或缩放动画。
- 多机器人头像组的展开、折叠和切换位置动画必须使用 Anime.js layout 的 `record()` / `animate()`，不要用 CSS `right`、`width`、`transform` transition 手写布局动画；固定定位只能放在 `.onebot-webqq-host` 上，layout root 必须是 `.onebot-webqq-layout-root`，它的 DOM 子树只能包含外层视觉胶囊 `.onebot-webqq`、左侧 `.onebot-webqq__avatar-capsule` 和头像区域，不能包含右侧正文。这样 Anime.js 能记录外层右锚定胶囊向左扩张的位移，用来抵消当前头像在头像组内的右移，保证当前头像屏幕坐标不动，同时避免 fixed/absolute root 触发 Anime.js 的绝对坐标路径导致头像层脱离原位。`.onebot-webqq-host` 必须固定为 `height: 52px` 且 `line-height: 0`，`.onebot-webqq-layout-root` 必须是 `display: block` 且固定同高；否则 Anime.js 动画中临时把视觉胶囊改成 absolute 时，inline baseline 行盒会改变 fixed host 高度，导致 bottom 锚定的整颗胶囊上下跳。
- 余量数字头像必须和头像保持相同大小、宽度与折叠步进，放在最后一个可见头像的下层，文字靠左显示，并确保数字本身可见，不能浮在头像上层或居中显示。
- 多机器人头像组无论折叠还是展开，都只在当前选中的机器人头像上显示在线状态点。
- 头像图形引导必须渲染在当前选中的机器人头像内部，并且层级必须低于在线状态点和消息计数；多机器人时当前机器人头像固定在最右侧。
- 头像图形引导只允许首次使用自动展示，或点击胶囊非头像区域时手动展示；点击头像不应触发引导。
- 胶囊标题和状态文字只有在内容真实溢出时才显示 HeroUI 风格 tooltip；不要绑定原生 `title`，也不要让未溢出的文字 hover 时出现悬浮提示。
- active 机器人不能靠 `translateY()` 产生垂直偏移；折叠态所有头像必须在同一水平线上。
- 折叠态必须保证当前选中的机器人头像可见，避免切到第 4 个之后被余量数字隐藏。

### 必要测试
- `tests/capsule.test.ts` 和 `tests/style.test.ts` 需要覆盖折叠上限、`+N` 余量、右锚点同步展开、左侧头像胶囊和右侧正文拆分、视觉表面只画在外层单胶囊、正文固定右锚点且不进入 Anime.js layout、余量数字下层靠左显示且使用头像同款折叠步进、Anime.js layout `record()` / `animate()` 且 root 只能是非 fixed 的 `.onebot-webqq-layout-root`、外层视觉胶囊和左侧头像区域、fixed host 与 layout root 的固定高度和行盒约束、只当前 bot 显示状态点、头像引导在当前 bot 内部且位于在线状态点和消息计数下、头像引导触发范围、胶囊文字 HeroUI 风格 tooltip 仅溢出时显示、active 不垂直偏移且无额外强调框。
