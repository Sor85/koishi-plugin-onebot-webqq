# koishi-plugin-onebot-webqq

在 Koishi 中提供一个 OneBot WebQQ，并在右下角显示当前聊天状态胶囊。它适合在 Koishi Console 里查看 QQ 最近会话、好友、群组、消息历史、实时消息和通知状态，同时对 ChatLuna 的对话状态、思考内容、模型用量和角色关系展示做了特殊适配。

WebQQ 观察窗的大致 UI 设计参考自 [LLBot](https://github.com/LLOneBot/LuckyLilliaBot) 的 WebQQ 体验；本插件按 Koishi Console、Vue 组件和现有 OneBot 数据能力重新实现，不包含 LLBot 前端代码。

## 功能

- 右下角聊天胶囊：显示当前 bot、最近会话、收发计数、ChatLuna 思考状态和 WebQQ 总未读数
- WebQQ：提供最近会话、好友分组、群组列表、搜索和当前聊天消息列表
- 消息展示：支持文本、图片、引用、合并转发、卡片、表情、文件、语音、视频占位和撤回状态
- 群聊信息：支持群公告、群成员列表、成员搜索、群等级/头衔/权限徽标
- 通知菜单：支持好友申请、群申请和部分群事件展示，能处理带 flag 的申请
- 实时同步：监听 Koishi 消息、撤回、系统事件和 OneBot 贴表情事件，并同步更新当前会话
- ChatLuna 联动：显示正在思考、正在对话、模型 token 用量、character `<think>` 字段、好感度和关系徽标
- 缓存与持久化：可选择 Koishi 数据库或浏览器本地存储保存最近会话、未读数和消息缓存
- 主题外观：支持清爽/毛玻璃主题、QQ/TIM 聊天气泡样式、明亮/暗色/自动颜色模式和自定义强调色

## 使用前提

插件需要 Koishi Console，并需要至少一个 OneBot 机器人可用。基础 WebQQ 能力依赖机器人实现提供以下 action：

- 联系人和群组：`get_friend_list`、`get_group_list`
- 历史消息：`get_friend_msg_history`、`get_group_msg_history`
- 消息详情：`get_msg`

以下能力按 OneBot 实现和配置情况启用，缺失时对应功能会降级或不显示：

- 好友分组和最近会话：`get_friends_with_category`、`get_recent_contact`
- 群信息和通知：`get_group_member_list`、`get_group_notice`、`_get_group_notice`、`get_group_system_msg`
- 申请处理：`set_friend_add_request`、`set_group_add_request`
- 富媒体：`get_image`、`get_record`、`voice_msg_to_text`
- 合并转发和贴表情：`get_forward_msg`、`fetch_emoji_like`

当前配置支持 NapCat 和 LLBot 两种协议模式。默认使用 NapCat；如果你的机器人来自 LLBot，请在配置中把 OneBot 实现协议切换为 LLBot。

## 配置

### 连接设置

- `onebotSelfId`：指定读取 WebQQ 数据的 OneBot 机器人 selfId，留空时自动选择第一个支持读取接口的机器人
- `onebotProtocol`：选择 NapCat 或 LLBot 协议模式

### 历史与缓存

- `historyLimit`：每次加载聊天历史的消息数量，默认 100
- `webQQMessageCacheLimit`：每个 WebQQ 会话保留的最近消息缓存数量，默认 100
- `webQQStorageBackend`：选择 Koishi 数据库或浏览器本地存储
- `webQQImageCacheEnabled`：是否启用 WebQQ 图片代理内存缓存
- `webQQImageCacheLimitMB`：图片代理内存缓存总上限，默认 100 MB
- `webQQImageCacheItemLimitMB`：单张图片写入内存缓存的大小上限，默认 10 MB

### 界面外观

- `webQQTheme`：清爽或毛玻璃主题
- `webQQChatStyle`：TIM 或 QQ 聊天页面样式
- `webQQTimBubbleTail`：显示 TIM 气泡小尖角，默认开启
- `webQQColorMode`：自动、明亮或暗色模式
- `webQQAccentColor`：手动主题色
- `useBotAvatarThemeColor`：使用 bot 头像主色作为 WebQQ 主题色

### 消息显示

- `webQQMarkRecalledMessages`：保留被撤回消息并显示删除线，关闭后显示撤回事件并移除原消息
- `hideWebQQGroupLevel`：隐藏群等级徽标
- `showWebQQAffinity`：在用户昵称旁显示 ChatLuna 好感度
- `showWebQQRelationship`：在用户昵称旁显示 ChatLuna 关系
- `webQQAffinityScopeId`：指定 ChatLuna 好感度插件的 scopeId
- `showWebQQCapsuleUnread`：在右下角胶囊 bot 头像上显示 WebQQ 总未读数

### 开发者选项

- `debug`：显示前端调试信息

## 使用方式

安装并启用插件后，Koishi 控制台右下角会出现聊天胶囊。点击胶囊头像可以打开 WebQQ 观察窗。

观察窗目前偏只读：它用于浏览联系人、会话和消息，不提供主动发送消息入口。通知菜单里的好友申请或群申请如果带有可处理 flag，则可以在观察窗内同意或拒绝。

## ChatLuna 联动

安装 ChatLuna 相关插件时，本插件会监听 ChatLuna 的对话生命周期，在胶囊和 WebQQ 消息里显示：

- 当前是否正在思考或正在与某个用户对话
- 最近一次模型调用的输入/输出 token 用量
- character 回复中的 `<think>` 内容和思考耗时
- 好感度、关系、机器人群身份等可选徽标

这些功能都是可选联动。没有 ChatLuna 时，WebQQ 观察窗仍可作为 OneBot 会话观察工具使用。

## 开发

```sh
yarn install
yarn test
yarn build
```

## 许可证

MIT
