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
- 折叠态最多显示 3 个机器人头像；超过 3 个时额外显示一个纯数字头像，数字表示剩余机器人数量，不显示 `+` 号。
- 折叠态头像从右侧锚定并向左堆叠；悬停或键盘聚焦时，父级胶囊和头像组必须同步向左扩张，不能向右挤压胶囊正文，也不能让展开头像露出胶囊外。
- 多机器人头像组的展开、折叠和切换位置动画必须使用 Anime.js layout 的 `record()` / `animate()`，不要用 CSS `right`、`width`、`transform` transition 手写布局动画。
- 余量数字头像必须放在最后一个可见头像的下层，文字靠左显示，并确保数字本身可见，不能浮在头像上层或居中显示。
- 多机器人头像组无论折叠还是展开，都只在当前选中的机器人头像上显示在线状态点。
- 头像图形引导必须渲染在当前选中的机器人头像内部；多机器人时当前机器人头像固定在最右侧。
- active 机器人不能靠 `translateY()` 产生垂直偏移；折叠态所有头像必须在同一水平线上。
- 折叠态必须保证当前选中的机器人头像可见，避免切到第 4 个之后被 `+N` 隐藏。

### 必要测试
- `tests/capsule.test.ts` 需要覆盖折叠上限、纯数字余量、右锚点展开、父级胶囊同步扩张、余量数字下层靠左显示、Anime.js layout `record()` / `animate()`、只当前 bot 显示状态点、头像引导在当前 bot 内部、active 不垂直偏移。
