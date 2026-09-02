# 03 — 配置模块目录化并保持引用路径

**What to build:** 为「配置规格与 Schema 必须分文件」腾出结构。把现有 Schema 声明移入一个配置目录，目录对外仍以同一个模块名被引用，因此二十多处现有引用零改动。纯搬移，无行为变化。

**Blocked by:** 01 — 配置面板契约断言改读 Schema 运行时节点（否则本 ticket 还要顺手修一批钉住源文件路径的断言）。

**Status:** resolved

**参考:** `.scratch/config-spec/spec.md` 的 Implementation Decisions；分文件的理由见 ADR 0003。

- [x] Schema 声明移入配置目录，目录以同一模块名对外暴露
- [x] 现有引用该模块的代码零改动
- [x] 对外导出的配置类型与插件入口导出方式不变
- [x] 服务端构建与前端构建均通过
- [x] 全量测试通过

## Comments

- `git mv src/config.ts src/config/schema.ts`，并把内部的 `'./onebot/protocol'` 改成 `'../onebot/protocol'`。新增 `src/config/index.ts` 只做 `export * from './schema'`，把 ADR 0003 的分文件理由写在注释里。
- 13 个引用点（`'./config'`、`'../config'`、`'../../config'`、测试里的 `'../src/config'`）全部零改动，目录名替代文件名后模块名不变。
- 对外导出面未变：`lib/index.d.ts` 仍是 `export { Config } from './config'`，`lib/config/schema.d.ts` 里的 `Config` 仍是逐字段展开的 `interface` 加 `declare const Config: Schema<Config>`，使用者的 IDE 提示不退化。
- `yarn build`（`build:types` + tsup CJS + vite lib）与 `yarn typecheck`、514 条测试全部通过。
- ADR 0001 的「目标后端文件树」里仍写着 `src/config.ts`。没有改那份已接受的 ADR，改为在 ADR 0003 的决策里补一行记录目录化后的实际布局。
