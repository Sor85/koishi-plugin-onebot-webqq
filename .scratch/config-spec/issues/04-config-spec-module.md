# 04 — 配置规格 module 与双向键集断言

**What to build:** 配置项的默认值从此只写一次。建立配置规格——插件全部 31 个配置项的唯一权威声明，Schema 的默认值改从它读取。同时加一条双向键集断言，让「漏掉一个配置项」从静默出错变成编译失败。这是整套改动的 expand 步骤：规格与现有字面量并存，后续 ticket 再按消费方逐个迁移。

**Blocked by:** 03 — 配置模块目录化并保持引用路径。

**Status:** resolved

**参考:** `.scratch/config-spec/spec.md`；koishi 依赖禁令与配置类型不派生的理由见 ADR 0003。

- [x] 配置规格声明全部 31 个配置项，逐项记录键名、默认值、是否为镜像配置项、空字符串是否视为未设置
- [x] 配置规格支持「无默认值」形态；好感度 scopeId 使用该形态且不是镜像配置项
- [x] 配置规格不引用 koishi，也不引用任何间接引用 koishi 的 module（ADR 0003）
- [x] Schema 的默认值全部改为从配置规格读取
- [x] Schema 的分组划分、分组顺序、字段顺序、控件类型、数值上下限、说明文案全部不变
- [x] 对外导出的配置类型仍是手写 interface，未改为派生类型（ADR 0003）
- [x] 存在一条双向键集断言：配置规格键集与该配置类型键集完全相等，多一个或少一个都编译失败
- [x] 从配置规格里删掉任一项后编译失败，向配置规格里加一项而不同步配置类型也编译失败
- [x] 完整构建后重启，逐组核对配置面板的分组、字段顺序、控件与文案，与改动前一致
- [x] 全量测试通过

## Comments

- 新增 `src/config/spec.ts`：`configSpec` 用 `satisfies Record<string, ConfigItemSpec>` 而不是类型标注——标注会把 `mirrored` 收敛成 `boolean`，镜像配置项就无法在类型层面筛出来。枚举与数组默认值需要显式 `as`，否则字面量被放宽成 `string` / `never[]`。
- 「无默认值」形态就是省略 `default` 键。`DefaultedConfigKey` 把没有默认值的配置项从 `readConfigDefault` / `readConfigValue` 的入参里排除，因此 `readConfigValue(config, 'webQQAffinityScopeId')` 直接编译报错，而不是返回一个假默认值。
- 规格只 `import type { WebQQProtocol } from '../onebot/protocol'`（该 module 零依赖），其余取值联合类型 `WebQQChatStyle` / `WebQQColorMode` / `WebQQStorageBackend` 由规格自己声明，`schema.ts` 与前端都引用规格的这一份。
- `src/config/index.ts` 只 re-export `./schema`，**没有**顺带 re-export 规格。如果 `'../config'` 也能拿到规格，前端某天写成 `from '../../src/config'` 就会把整个 koishi 静默打进浏览器产物；现在前端只有 `'../../src/config/spec'` 这一条路可走。
- 双向键集断言落在 `schema.ts` 末尾：`AssertTrue<KeySetsEqual<keyof Config, ConfigKey>>`。另加一条 `_SpecDefaultsMatchConfig`，断言规格默认值能落进 `Config` 的字段类型，防止两处对同一配置项的取值类型漂移。两条都是非导出类型别名，不进 `.d.ts`、不产生运行时代码。
- 三个方向都实测过编译失败：删掉规格里的 `webQQMockEnvironment`、往规格里加一项而不同步 `Config`、把 `historyLimit` 默认值改成字符串。
- 配置面板契约由 `tests/config-panel.test.ts` 的 36 条断言守着，默认值改读规格后全绿；真实控制台里也逐组核对过五个分组、31 个字段的顺序、四组单选控件的取值顺序、颜色选择器、表格与活动选择控件、以及全部说明文案。
- 代码审查后收窄导出面：`configSpec` 本体、`ConfigSpec`、`ConfigItemSpec` 都改为不导出。默认值只能经 `readConfigDefault` / `readConfigValue` / `readMirroredConfigValues` 取，因此数组默认值的逐次复制无法被绕过。`ConfigKey` / `DefaultedConfigKey` / `MirroredConfigKey` / `ConfigValue` / `ConfigInput` / `MirroredConfigValues` 出现在导出函数签名里，声明文件需要它们，保留。
