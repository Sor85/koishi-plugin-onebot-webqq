# 08 — 草稿文字不再继承宿主字号

**What to build:** 修一处既存的排版缺陷。`.onebot-webqq-webqq__send-text` 与 `.onebot-webqq-webqq__send-placeholder` 都声明了 `font: inherit`，但插件根容器 `.onebot-webqq-webqq` 从没声明过基准字号，Koishi 控制台的 `body` 也没有（只给了 `--el-font-size-base: 14px` 这种令牌，不设 `font-size`）。于是这两处的字号一路继承到浏览器默认值 **16px**，而同一个表单里的文件名、回复条等文字是 12/13px。

管理员看到的症状是：输入框里打出来的字比周围 UI 大一号，占位文案「发送消息」同样偏大。这正是全局排版规则里描述的「某一行文字莫名比周围大一号」——上一轮已经为浮层修过一次同类问题（`fix：右键菜单等浮层不再依赖宿主 CSS reset`），输入区是同一个坑的另一处。

**Blocked by:** None。

**Status:** ready-for-agent

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

- [ ] 插件根容器显式声明基准字号与行高，不依赖宿主与浏览器默认值
- [ ] 草稿文字与占位文案落到字号标度上，和同一表单里的其他文字协调
- [ ] 通过 portal/teleport 挂到根容器之外的浮层各自仍有基准字号（上一轮已修的部分不得回退）
- [ ] 存在守卫断言：根容器声明了基准字号；样式源里 `__send-text` 与 `__send-placeholder` 的字号不再依赖继承
- [ ] 真实浏览器实测：遍历输入区节点读 computed `font-size`，取值集合落在标度内，Chrome 与 Firefox 一致
- [ ] 全量测试通过

## Comments

- 本轮（输入区搬迁）没有动任何 SCSS，搬迁前后 `.onebot-webqq-webqq__send` 的祖先链一致，所以这是既存缺陷而非回归；因为「除搬迁与附件清空外不改任何行为」，当轮没有顺手修。
- 注意别只给 `.onebot-webqq-webqq__send-text` 补一个 `font-size` 就收工：`font: inherit` 是为了压掉 `contenteditable` 与表单控件的浏览器默认字体族才写的，根因在根容器缺基准字号。按全局规则的做法是在根容器上声明基准字号与行高，再让标度令牌接管具体档位。
