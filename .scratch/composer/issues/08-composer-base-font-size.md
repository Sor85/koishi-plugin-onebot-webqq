# 08 — 草稿文字不再继承宿主字号

**What to build:** 修一处既存的排版缺陷。`.onebot-webqq-webqq__send-text` 与 `.onebot-webqq-webqq__send-placeholder` 都声明了 `font: inherit`，但插件根容器 `.onebot-webqq-webqq` 从没声明过基准字号，Koishi 控制台的 `body` 也没有（只给了 `--el-font-size-base: 14px` 这种令牌，不设 `font-size`）。于是这两处的字号一路继承到浏览器默认值 **16px**，而同一个表单里的文件名、回复条等文字是 12/13px。

管理员看到的症状是：输入框里打出来的字比周围 UI 大一号，占位文案「发送消息」同样偏大。这正是全局排版规则里描述的「某一行文字莫名比周围大一号」——上一轮已经为浮层修过一次同类问题（`fix：右键菜单等浮层不再依赖宿主 CSS reset`），输入区是同一个坑的另一处。

**Blocked by:** None。

**Status:** resolved

**参考:** 全局排版规则「基准字号」一节；同类修复见提交 `a0294d3`。领域词汇见 `CONTEXT.md` 的输入区、草稿词条。

实测数据（真实浏览器，输入区独立探针页，Chrome 152 与 Firefox 153 一致）：

```
.onebot-webqq-webqq__send        16px   ← 无人声明，继承宿主
.onebot-webqq-webqq__send-main   16px
.onebot-webqq-webqq__send-text   16px   ← 草稿文字，有 line-height: 20px 但没有 font-size
.onebot-webqq-webqq__send-placeholder 16px
.onebot-webqq-webqq__send-file-base   12px   ← 插件自己声明的字号
其余文字节点                      13px
```

图标按钮与 `input[type=file]` 算出 13.3333px，那是浏览器给表单控件的默认值；这些节点不渲染文字，不在本任务范围内。

- [x] 插件根容器显式声明基准字号与行高，不依赖宿主与浏览器默认值
- [x] 草稿文字与占位文案落到字号标度上，和同一表单里的其他文字协调
- [x] 通过 portal/teleport 挂到根容器之外的浮层各自仍有基准字号（上一轮已修的部分不得回退）
- [x] 存在守卫断言：根容器声明了基准字号；样式源里 `__send-text` 与 `__send-placeholder` 的字号不再依赖继承
- [x] 真实浏览器实测：遍历输入区节点读 computed `font-size`，取值集合落在标度内，Chrome 与 Firefox 一致
- [x] 全量测试通过

## Comments

- 本轮（输入区搬迁）没有动任何 SCSS，搬迁前后 `.onebot-webqq-webqq__send` 的祖先链一致，所以这是既存缺陷而非回归；因为「除搬迁与附件清空外不改任何行为」，当轮没有顺手修。
- 注意别只给 `.onebot-webqq-webqq__send-text` 补一个 `font-size` 就收工：`font: inherit` 是为了压掉 `contenteditable` 与表单控件的浏览器默认字体族才写的，根因在根容器缺基准字号。按全局规则的做法是在根容器上声明基准字号与行高，再让标度令牌接管具体档位。

### 落地方式

- 新增 `client/webqq/styles/webqq-typography.scss`，与 `webqq-box-model.scss` 同一套路：**七档字号标度令牌 + 基准字号**声明在插件宿主壳与五个 body 级浮层根上（清单与盒模型基线逐字相同，守卫测试比对两份清单，新增浮层时漏登记会变红）。样式入口里它紧跟盒模型基线输出，令牌先于用到它们的规则。
- 标度按用途分档，不是按 1px 步进凑数：`2xs 10px` 角标计数、`xs 11px` 微标签、`sm 12px` 次要文字、`md 13px` 正文（同时是基准）、`lg 14px` 强调、`xl 15px` 区域标题、`2xl 16px` 弹窗标题。
- 88 处字面字号换成令牌。两处野值归并到最近档位：`__message-affinity` 的 9px → 10px（好感度角标，实测宽度 +1.1px），日历表头的 12.8px → 13px（那一格原本是 16 的 0.8 倍派生值）。
- 行高基准声明在观察窗根与五个浮层根上（`--onebot-webqq-line-height-md: 20px`），**没有**覆盖 `.onebot-webqq-host`：那里的 `line-height: 0` 是小胶囊压掉行内空白的既有基线，覆盖它会改胶囊几何。守卫测试把这条例外也锁住了。
- 四处字面字号保留，各自就地写明理由，守卫测试要求这类行紧邻的注释里出现「不是排版字号/档位」：窄屏标签的 `font-size: 0`（压掉行内空白）、`.k-icon` 的 22px（Koishi 图标用字号定字形大小）、转发条 `›` 的 20px（箭头字形本身）、资料卡 96px 头像框里首字母的 28px（几何派生字号；头像框尺寸目前是字面值，等它改成尺寸变量时要就地换成 `calc()`，不要提成令牌）。

### 实测验收

把整个观察窗挂进真实 Chrome 152 与 Firefox 153（`.probe-typography` 一次性探针页，`@koishijs/client` 换成桩 + 假数据，不连 Koishi/OneBot/数据库；外层套上真实的 `.onebot-webqq-host`，否则量出来的行高比生产宽松）。逐个浮层采样——主界面、通知菜单、资料卡、消息右键菜单、确认弹窗、群信息面板、消息搜索页，每量完一个整页重载回干净状态，共 **1279 个节点**，治理前后各采一次逐节点比对：

- **字号**：449 处变化，其中**有文字的只有 3 个节点**——`__send-placeholder` 16px→13px、`__send-text` 16px→13px（本 ticket 的正题）、好感度角标 9px→10px（归并）。其余全是无文字的容器与 SVG，看不见。
- **行高**：400 处变化（0px→20px 325 处、normal→20px 75 处），**有文字的节点 0 处**——每一处文字原本就自己声明了行高。
- **几何**：只有 2 个节点变了，都是好感度角标因字号 9→10 宽了 1.1px（高度 15px 不变）。其他 1277 个节点的矩形逐像素不变，包括那 325 个行高从 0 变成 20 的容器。
- **六个根**都实测到基准生效：`font-size: 13px`，行高 20px（`.onebot-webqq-host` 保持 0）。治理后两端**没有任何标度之外的有文字节点**，Chrome 与 Firefox 全部读数一致。

守卫断言在 `tests/webqq-typography.test.ts`（6 条）：浮层清单与盒模型清单一致、七档令牌齐全且取值锁定、行高基准覆盖范围含例外、`@use` 顺序、样式源里没有无理由的字面字号、`__send-text`/`__send-placeholder` 保持 `font: inherit` 且不自己声明字号。失效实测 7 条全部变红：去掉基准字号、浮层清单漏登记、改动正文档位取值、去掉行高基准、排版基线晚于布局规则输出、草稿文字自己写死字号、新增一个标度外的字面字号。

`tests/style.test.ts` 里 8 条、`tests/capsule.test.ts` 里 1 条原本断言字面字号的用例改成断言令牌。探针页与临时脚本已删除，浏览器会话已关闭。
