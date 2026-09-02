# 05 — 服务端兜底改读配置规格

**What to build:** 消掉服务端的第二份默认值。服务端有约三十处「配置项 ?? 字面量」形式的兜底，其中撤回标记和 character thinking 显示这两项的兜底各写了两遍。全部改为读配置规格。这是 expand–contract 里的一个迁移批次，运行时行为不变，没有用户可见变化。

**Blocked by:** 04 — 配置规格 module 与双向键集断言。

**Status:** ready-for-agent

**参考:** `.scratch/config-spec/spec.md` 的 Implementation Decisions「服务端」一节。

- [ ] 服务端不再出现「配置项 ?? 字面量」形式的第二份默认值
- [ ] 历史条数、图片代理缓存三项、运行时 bot 模式、bot selfId 集合、协议选择、模拟 bot 数量、撤回标记、character thinking 显示、模拟环境、调试开关的默认值全部来自配置规格
- [ ] 同一配置项在多处消费时读到同一个默认值
- [ ] 依赖具体配置值的既有运行时行为测试全部仍然通过，包括撤回标记、character thinking 显示、协议选择、模拟环境
- [ ] 本 ticket 作废的源码文本断言在本 ticket 内删除，不留给后续 ticket
- [ ] 服务端构建通过
- [ ] 全量测试通过
