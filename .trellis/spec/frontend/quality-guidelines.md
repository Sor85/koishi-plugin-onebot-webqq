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
- 折叠态最多显示 3 个机器人头像；超过 3 个时额外显示一个 `+N` 数字头像，数字表示剩余机器人数量。
- 折叠态头像从右侧锚定并向左堆叠；悬停或键盘聚焦时，父级胶囊和头像组必须同步向左扩张，不能向右挤压胶囊正文，也不能让展开头像露出胶囊外。
- `+N` 数字头像必须放在最后一个可见头像的下层，文字靠左显示，不能浮在头像上层或居中显示。
- 折叠态不显示机器人在线状态点；悬停或键盘聚焦展开后才显示状态点。
- active 机器人不能靠 `translateY()` 产生垂直偏移；折叠态所有头像必须在同一水平线上。
- 折叠态必须保证当前选中的机器人头像可见，避免切到第 4 个之后被 `+N` 隐藏。

### 必要测试
- `tests/capsule.test.ts` 需要覆盖折叠上限、`+N`、右锚点展开、父级胶囊同步扩张、`+N` 下层靠左显示、折叠态隐藏状态点、active 不垂直偏移。
