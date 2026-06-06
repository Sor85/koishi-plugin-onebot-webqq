# Architecture Notes

本项目是 Koishi 插件 `onebot-webqq`。当前目标是小步整理架构，不改变现有功能、配置、事件名、数据结构和用户可见行为。

## 入口

- 后端源码入口：`src/index.ts`
- 发布后端入口：`lib/index.js`
- 前端源码入口：`client/index.ts`
- 前端构建入口：`vite.config.mts`
- 控制台挂载组件：`client/Capsule.vue`

## 当前模块

- `src/index.ts`：Koishi 插件入口，负责服务注入、配置导出、console 事件桥、ChatLuna 状态监听、WebQQ live 消息桥接和存储注册
- `src/config.ts`：插件配置类型和 Koishi 配置 schema
- `src/onebot.ts`：OneBot action 适配，负责联系人、群信息、历史消息、通知、图片、引用和合并转发的读取与标准化
- `src/state.ts`：后端胶囊状态机，负责收发计数、当前会话、模型用量和思考时长
- `src/webqq-affinity.ts`：ChatLuna 好感度记录读取和 WebQQ 消息徽标补齐
- `src/webqq-storage.ts`：WebQQ 会话状态和消息缓存的 Koishi 数据库存储 helper
- `client/index.ts`：Koishi Console 前端入口，负责读取 entry data、初始化前端全局状态、监听胶囊更新并注册全局组件
- `client/state.ts`：前端共享类型和响应式状态
- `client/Capsule.vue`：右下角胶囊外壳和 WebQQ 面板开关
- `client/WebQQObserver.vue`：WebQQ 主界面，当前包含联系人、聊天记录、通知、群信息、缓存、滚动、图片预览和合并转发弹窗
- `client/webqq-message-cache.ts`：浏览器 IndexedDB 消息缓存
- `client/webqq-sender-metadata.ts`：前端群成员身份缓存补齐
- `client/style.scss`：胶囊和 WebQQ 面板全部样式

## 简单目录规则

- `src/config.ts`：后端插件配置 schema 和配置类型
- `src/state.ts`：后端内存状态机
- `src/onebot.ts`：OneBot 协议读取和数据标准化
- `src/webqq-affinity.ts`：后端 WebQQ 好感度读取和消息字段补齐
- `src/webqq-storage.ts`：后端 WebQQ 持久化和缓存读写
- `src/*.ts`：后端小模块，按真实职责命名，避免新建空泛目录
- `client/components/`：后续拆出的 Vue 展示组件
- `client/stores/`：后续拆出的前端响应式状态或 composable
- `client/utils/`：后续拆出的纯函数和浏览器小工具
- `client/types.ts`：后续如果前端类型继续增长，再从 `client/state.ts` 拆出

## 重构原则

- 每次只移动一个文件或一个小职责
- 优先拆超过 500 行且经常改动的文件
- 优先提取独立、低副作用、已有测试覆盖的逻辑
- 不改事件名、配置项、存储 key、消息结构、CSS class 和可见文案
- 不为了目录好看新增空抽象
- 不顺手重写稳定逻辑

## 当前高风险区域

- `src/index.ts` 同时承担插件入口、console RPC、live 消息标准化、ChatLuna 状态、数据库存储和好感度读取
- `client/WebQQObserver.vue` 同时承担视图、请求、缓存、滚动、未读数、通知和弹窗状态
- `client/style.scss` 体量过大，且强绑定 `Capsule.vue` 和 `WebQQObserver.vue` 的 class 结构
- `src/index.ts` 和 `src/onebot.ts` 存在 live 消息与历史消息标准化的相似逻辑，后续修改容易漂移
- `src/onebot.ts` 与 `client/state.ts` 各自维护 WebQQ DTO 类型，后续协议字段变更需要同步检查
