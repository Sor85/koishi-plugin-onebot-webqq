# Architecture Notes

本项目是 Koishi 插件 `onebot-webqq`。当前目标是小步整理架构，不改变现有功能、配置、事件名、数据结构和用户可见行为。

## 入口

- 后端源码入口：`src/index.ts`
- 发布后端入口：`lib/index.js`
- 前端源码入口：`client/index.ts`
- 前端构建入口：`vite.config.mts`
- 控制台挂载组件：`client/Capsule.vue`

## 当前模块

- `src/index.ts`：Koishi 插件入口，负责服务注入、配置导出、ChatLuna 状态监听和顶层注册编排
- `src/chatluna/character-lock.ts`：ChatLuna character 响应锁同步 helper，负责包裹 acquire/release 并在 dispose 恢复原方法
- `src/console/entry.ts`：Koishi Console 前端入口注册 helper，负责 entry 文件路径和初始配置数据
- `src/webqq/console.ts`：WebQQ Console RPC listener 注册 helper，负责联系人、消息、群信息、通知、状态存储和消息缓存的 console 事件桥
- `src/config.ts`：插件配置类型和 Koishi 配置 schema
- `src/onebot/index.ts`：OneBot action 适配入口，负责联系人、群信息、历史消息、通知和图片 action 的服务编排
- `src/onebot/actions.ts`：OneBot bot 选择和 action 调用 helper
- `src/onebot/card.ts`：OneBot JSON/XML/lightapp 卡片消息解析 helper
- `src/onebot/contacts.ts`：OneBot 好友、好友分组、群列表和最近会话类型标准化 helper
- `src/onebot/data.ts`：OneBot 返回值字段读取和基础数据转换 helper
- `src/onebot/display.ts`：OneBot WebQQ 展示字段派生 helper，负责头像 URL、群角色和群副标题
- `src/onebot/group-info.ts`：OneBot 群成员和群公告标准化 helper
- `src/onebot/images.ts`：OneBot 图片元素和 `get_image` 结果解析 helper
- `src/onebot/message-elements.ts`：OneBot 表情元素和消息元素摘要 helper
- `src/onebot/messages.ts`：OneBot 历史消息、引用和合并转发消息标准化 helper
- `src/onebot/notices.ts`：OneBot 群系统通知标准化 helper
- `src/onebot/text.ts`：OneBot 文本和 @ 标记内容提取 helper
- `src/onebot/types.ts`：OneBot WebQQ DTO 类型
- `src/state/index.ts`：后端胶囊状态机，负责收发计数、当前会话、模型用量和思考时长
- `src/state/types.ts`：后端胶囊状态输入和快照类型
- `src/chatluna/message-input.ts`：ChatLuna/Koishi session 到胶囊状态输入的组装 helper
- `src/shared/structured-text.ts`：通用结构化文本读取 helper，用于从 LangChain 消息、Koishi 元素和对象字段中提取文本
- `src/chatluna/thinking.ts`：ChatLuna character 回复解析，负责读取 after-chat 文本并提取 `<think>` 内容
- `src/webqq/affinity.ts`：ChatLuna 好感度记录读取和 WebQQ 消息徽标补齐
- `src/webqq/event-notices.ts`：WebQQ 事件通知构造 helper，负责把 Koishi 好友申请和群成员退出事件转换为 WebQQNotice
- `src/webqq/group-sender-metadata.ts`：WebQQ 群成员身份 metadata 查询 helper，负责 OneBot 群成员信息 action 调用和返回值整理
- `src/webqq/image-url-resolver.ts`：WebQQ 图片代理 URL helper，负责注册 `/chat-capsule/webqq/image/:id` 代理路由并生成缓存 URL
- `src/webqq/live-cache.ts`：WebQQ live 消息缓存纯 helper，负责会话 key、消息去重合并、排序和 limit 裁剪
- `src/webqq/live-elements.ts`：WebQQ live 元素标准化 helper，负责 Koishi live 元素、引用、图片、卡片和摘要到 WebQQ message element 的转换
- `src/webqq/live-message.ts`：WebQQ live message payload 构造 helper，负责把 Koishi session 和标准化元素组装为 WebQQ live 消息
- `src/webqq/live-runtime.ts`：WebQQ live 消息运行态，负责 live 缓存、pending thinking、群成员 metadata 刷新和前端广播
- `src/webqq/sender-metadata.ts`：WebQQ live 发送者群身份 metadata 读取、比较、填充和替换 helper
- `src/webqq/session.ts`：WebQQ session 展示信息 helper，负责 bot/profile、用户昵称、头像、peer 和 live 方向等纯读取逻辑
- `src/webqq/storage.ts`：WebQQ 会话状态和消息缓存的 Koishi 数据库存储 helper
- `client/index.ts`：Koishi Console 前端入口，负责读取 entry data、初始化前端全局状态、监听胶囊更新并注册全局组件
- `client/state.ts`：前端共享类型和响应式状态
- `client/stores/webqq-state.ts`：WebQQ 最近会话和未读数的前端状态类型与纯更新 helper
- `client/stores/webqq-contacts.ts`：WebQQ 联系人和当前会话状态 composable，负责 tab、搜索、联系人列表、最近会话、当前聊天头部和会话选择构造
- `client/stores/webqq-conversation-state.ts`：WebQQ 最近会话摘要和未读数状态 composable，负责 hydrate/persist、摘要更新、未读计数和总未读派生
- `client/stores/webqq-forward-dialog.ts`：WebQQ 合并转发弹窗状态 composable，负责弹窗内容、预览条数、默认头像和当前聊天样式下的聚合 class
- `client/stores/webqq-group-info.ts`：WebQQ 群信息面板状态 composable，负责群公告、群成员、搜索、加载状态和打开切换
- `client/stores/webqq-image-preview.ts`：WebQQ 图片预览状态 composable，负责预览 URL、打开和关闭
- `client/stores/webqq-message-cache.ts`：WebQQ 消息缓存 backend wrapper，负责为组件隐藏 browser/Koishi 存储后端参数传递
- `client/stores/webqq-message-list.ts`：WebQQ 消息列表展示状态 composable，负责消息 ref、临时思考消息、可见消息、消息聚类和 append 后的底部跟随
- `client/stores/webqq-message-scroll.ts`：WebQQ 消息滚动状态 composable，负责消息面板 ref、底部跟随、返回底部和图片加载后的滚动
- `client/stores/webqq-notices.ts`：WebQQ 通知菜单状态 composable，负责通知列表、分类过滤、加载状态、打开切换和处理状态
- `client/stores/webqq-sender-metadata.ts`：WebQQ 发送者身份缓存 composable，负责当前会话上下文下的缓存写入和消息补齐
- `client/stores/webqq-storage.ts`：WebQQ 最近会话、未读数和消息缓存的前端存储分支
- `client/stores/webqq-thinking-expansion.ts`：WebQQ 思考内容展开状态 composable，负责 completed thinking 的展开集合和切换
- `client/utils/webqq-contact-view.ts`：WebQQ 联系人和最近会话展示纯函数，负责会话 key、聊天选择构造、当前聊天头部、群聊副标题、联系人搜索过滤、最近会话列表、摘要时间和未读数读取
- `client/utils/webqq-message-view.ts`：WebQQ 消息展示纯函数，负责消息 key、消息合并、未读数、时间、临时思考消息构造、思考耗时、completed thinking 聚合、消息元素分组、合并转发预览文案、消息聚类 class、群成员名称和发送者徽标判断
- `client/utils/webqq-notice-view.ts`：WebQQ 通知展示纯函数，负责通知排序、申请备注拆行、已处理状态文案和可处理状态判断
- `client/utils/webqq-theme-view.ts`：WebQQ 主题色展示纯函数，负责 accent 颜色校验、头像主题色优先级和 CSS 变量对象生成
- `client/api/webqq.ts`：前端 WebQQ Console RPC thin wrapper，负责封装 `send('chat-capsule/webqq/...')` 调用和默认返回值
- `client/Capsule.vue`：右下角胶囊外壳和 WebQQ 面板开关
- `client/components/WebQQSidebar.vue`：WebQQ 侧栏展示组件，负责 tab、搜索、通知入口和联系人列表组合
- `client/components/WebQQMessageList.vue`：WebQQ 消息列表展示组件，负责消息气泡、图片、引用、卡片、合并转发预览和 completed thinking 展示
- `client/components/WebQQContactList.vue`：WebQQ 最近会话、好友分组和群组列表展示组件
- `client/components/WebQQForwardModal.vue`：WebQQ 合并转发消息弹窗展示组件
- `client/components/WebQQGroupInfoPanel.vue`：WebQQ 群信息面板展示组件
- `client/components/WebQQImagePreview.vue`：WebQQ 图片预览遮罩展示组件
- `client/components/WebQQNoticeMenu.vue`：WebQQ 好友申请和群通知菜单展示组件
- `client/WebQQObserver.vue`：WebQQ 主界面编排组件，负责联系人、消息、通知、群信息、缓存、滚动、图片预览和面板状态连接
- `client/stores/webqq-live-messages.ts`：WebQQ live 消息接收 composable，负责前端实时消息落库、摘要和未读数更新
- `client/stores/webqq-message-history.ts`：WebQQ 消息首屏加载、历史翻页、缓存合并和加载错误状态
- `client/webqq-message-cache.ts`：浏览器 IndexedDB 消息缓存
- `client/webqq-sender-metadata.ts`：前端群成员身份缓存补齐
- `client/style.scss`：前端样式入口，继续承接全局 keyframes、reduced-motion 和响应式样式
- `client/styles/capsule.scss`：右下角胶囊外壳基础样式
- `client/styles/webqq-shell.scss`：WebQQ 面板外壳、侧栏、通知入口、搜索和联系人列表基础样式
- `client/styles/webqq-chat.scss`：WebQQ 聊天容器、顶部栏、消息滚动容器和返回底部按钮样式
- `client/styles/webqq-group-info.scss`：WebQQ 群信息面板、公告和成员列表样式
- `client/styles/webqq-notices.scss`：WebQQ 通知列表、通知卡片和处理状态样式
- `client/styles/webqq-messages.scss`：WebQQ 消息列表、气泡、引用、转发预览、发送者徽标和 thinking 展示样式
- `client/styles/webqq-message-cards.scss`：WebQQ 卡片消息预览样式
- `client/styles/webqq-message-overlays.scss`：WebQQ 合并转发弹窗和图片预览遮罩样式
- `client/styles/webqq-message-effects.scss`：WebQQ inline 文本片段和临时 thinking dots 动效样式
- `client/styles/theme-colors.scss`：胶囊和 WebQQ 的主题、暗色和 auto 配色覆盖样式

## 简单目录规则

- `src/config.ts`：后端插件配置 schema 和配置类型
- `src/chatluna/character-lock.ts`：后端 ChatLuna character 响应锁同步
- `src/console/entry.ts`：后端 Koishi Console 前端入口注册
- `src/console/`：后端 Koishi Console 子领域 helper，放控制台 entry 和后续 Console 相关 glue
- `src/webqq/console.ts`：后端 WebQQ Console RPC listener 注册
- `src/state/index.ts`：后端内存状态机，对外继续通过 `src/state` 导入
- `src/state/types.ts`：后端内存状态输入和快照类型
- `src/chatluna/message-input.ts`：后端 ChatLuna message/session 输入组装 helper
- `src/shared/structured-text.ts`：后端通用文本读取 helper
- `src/shared/`：后端跨领域纯 helper，只放多个领域共同依赖的小工具
- `src/chatluna/thinking.ts`：ChatLuna 思考内容解析 helper
- `src/chatluna/`：后端 ChatLuna 子领域 helper，放 character lock、消息输入和 thinking 解析
- `src/onebot/index.ts`：OneBot 协议读取和数据标准化入口，对外继续通过 `src/onebot` 导入
- `src/onebot/actions.ts`：OneBot bot 选择和 action 调用
- `src/onebot/card.ts`：OneBot JSON/XML/lightapp 卡片消息解析
- `src/onebot/contacts.ts`：OneBot 好友、好友分组、群列表和最近会话类型标准化
- `src/onebot/data.ts`：OneBot 返回值字段读取和基础数据转换
- `src/onebot/display.ts`：OneBot WebQQ 展示字段派生
- `src/onebot/group-info.ts`：OneBot 群成员和群公告标准化
- `src/onebot/images.ts`：OneBot 图片元素和 `get_image` 结果解析
- `src/onebot/message-elements.ts`：OneBot 表情元素和消息元素摘要
- `src/onebot/messages.ts`：OneBot 历史消息、引用和合并转发消息标准化
- `src/onebot/notices.ts`：OneBot 群系统通知标准化
- `src/onebot/text.ts`：OneBot 文本和 @ 标记内容提取
- `src/onebot/types.ts`：OneBot WebQQ DTO 类型
- `src/onebot/`：后端 OneBot 子领域 helper，按职责放置 OneBot 相关纯函数和类型
- `src/webqq/affinity.ts`：后端 WebQQ 好感度读取和消息字段补齐
- `src/webqq/event-notices.ts`：后端 WebQQ session 事件通知 payload 构造
- `src/webqq/group-sender-metadata.ts`：后端 WebQQ 群成员身份 metadata 查询
- `src/webqq/image-url-resolver.ts`：后端 WebQQ 图片代理 URL 注册和解析
- `src/webqq/live-cache.ts`：后端 WebQQ live 消息缓存 key 和合并纯 helper
- `src/webqq/live-message.ts`：后端 WebQQ live 消息 payload 构造
- `src/webqq/live-runtime.ts`：后端 WebQQ live 消息运行态，负责 live 缓存、pending thinking、群成员 metadata 刷新和前端广播
- `src/webqq/sender-metadata.ts`：后端 WebQQ 发送者身份 metadata 纯 helper
- `src/webqq/session.ts`：后端 WebQQ session 派生展示字段 helper
- `src/webqq/storage.ts`：后端 WebQQ 持久化和缓存读写
- `src/webqq/`：后端 WebQQ 子领域 helper，放 Console listener、live 消息、session、storage 和 sender metadata 相关逻辑
- `src/*.ts`：后端小模块，按真实职责命名，领域目录成熟后再逐步迁移
- `client/api/`：前端 Console RPC thin wrapper，只放网络事件调用和默认返回值，不放 UI 状态
- `client/components/`：前端展示组件，按完整展示区域拆分，避免拆单个按钮或图标
- `client/*.vue`：前端入口和仍未迁移的 WebQQ 展示组件，状态与请求编排继续留在 stores 或主界面组件
- `client/stores/`：前端响应式状态或 composable，按 WebQQ 联系人、消息、滚动、通知等真实状态边界拆分
- `client/styles/`：前端样式 partial，按完整界面区域拆分，入口仍由 `client/style.scss` 统一引入
- `client/utils/`：前端纯函数和浏览器小工具
- `client/types.ts`：后续如果前端类型继续增长，再从 `client/state.ts` 拆出

## 重构原则

- 每次只移动一个文件或一个小职责
- 优先拆超过 500 行且经常改动的文件
- 优先提取独立、低副作用、已有测试覆盖的逻辑
- 不改事件名、配置项、存储 key、消息结构、CSS class 和可见文案
- 不继续拆单个按钮、标题、图标或几行模板这类微组件；前端组件拆分必须对应完整展示区域或明确状态边界
- 不为了目录好看新增空抽象
- 不顺手重写稳定逻辑

## 当前高风险区域

- `src/index.ts` 已拆出 Console entry、WebQQ RPC listener、character 响应锁同步和 WebQQ live runtime，但仍承担插件入口、ChatLuna 活动状态和顶层注册编排
- `client/WebQQObserver.vue` 已拆出 API、侧栏、消息列表、消息历史加载和实时消息接收，但仍承担联系人加载、通知和多块面板连接
- `client/style.scss` 已拆出主要界面区域样式和主题色覆盖，但全局 keyframes、reduced-motion 和响应式样式仍集中，需要继续谨慎按职责处理
- `src/webqq/live-runtime.ts` 和 `src/onebot/messages.ts` 存在 live 消息与历史消息标准化的相似逻辑，后续修改容易漂移
- `src/onebot/types.ts` 与 `client/state.ts` 各自维护 WebQQ DTO 类型，后续协议字段变更需要同步检查
