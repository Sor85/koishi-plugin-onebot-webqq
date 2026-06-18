# Issue tracker: GitHub

本仓库的 issues 和 PRD 存放在 GitHub Issues。所有操作优先使用 `gh` CLI。

## 约定

- 创建 issue：`gh issue create --title "..." --body "..."`
- 读取 issue：`gh issue view <number> --comments`
- 列出 issue：`gh issue list --state open --json number,title,body,labels,comments`
- 评论 issue：`gh issue comment <number> --body "..."`
- 添加或移除标签：`gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- 关闭 issue：`gh issue close <number> --comment "..."`

在仓库 clone 内运行时，`gh` 会从 `git remote -v` 推断仓库。

## 当 skill 要求 “publish to the issue tracker”

创建 GitHub issue。

## 当 skill 要求 “fetch the relevant ticket”

运行 `gh issue view <number> --comments`。
