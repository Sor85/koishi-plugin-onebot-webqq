import { describe, expect, it, vi } from 'vitest'

// koishi 的包入口在 vitest 的 ESM 环境里加载不起来（@koishijs/loader 的 CJS 互操作会抛
// "Class extends value is not a constructor"），因此这里只把 koishi 的 Schema 替换成它
// 真正的实现 schemastery（两者是同一个对象），断言读到的仍是真实的 Schema 运行时节点。
vi.mock('koishi', async () => ({ Schema: (await import('schemastery')).default }))

const { Config } = await import('../src')

// 配置面板的渲染契约：分组名称与顺序、字段顺序、控件 role、默认值、数值上下限、说明文案。
// 断言全部读取 Schema 运行时节点，不匹配源码文本；因此换行或改写法不会误报，改错默认值一定报错。
const NO_DEFAULT = Symbol('no-default')

type FieldContract = {
  key: string
  type: string
  /** 契约里的默认值；NO_DEFAULT 表示该配置项不带默认值 */
  default: unknown
  description: string
  role?: string
  min?: number
  max?: number
  step?: number
  /** union 控件的取值与说明，按面板上的显示顺序 */
  options?: Array<[unknown, string]>
  /** array 控件的元素类型 */
  inner?: string
}

type GroupContract = {
  name: string
  fields: FieldContract[]
}

const PANEL: GroupContract[] = [
  {
    name: '连接设置',
    fields: [
      {
        key: 'onebotUseRuntimeBots',
        type: 'boolean',
        default: true,
        description: '使用当前运行时里所有可用的 OneBot 机器人，关闭后只使用下方 selfId 集合',
      },
      {
        key: 'onebotSelfIds',
        type: 'array',
        default: [],
        role: 'table',
        inner: 'string',
        description: '关闭运行时全量模式时允许使用的 OneBot 机器人 selfId 集合',
      },
      {
        key: 'onebotProtocol',
        type: 'union',
        default: 'napcat',
        role: 'radio',
        options: [['napcat', 'NapCat'], ['llbot', 'LLBot']],
        description: 'WebQQ 读取接口使用的 OneBot 实现协议',
      },
    ],
  },
  {
    name: '历史与缓存',
    fields: [
      {
        key: 'historyLimit',
        type: 'number',
        default: 100,
        step: 1,
        min: 1,
        max: 100,
        description: '每次加载聊天历史的消息数量',
      },
      {
        key: 'webQQMessageCacheLimit',
        type: 'number',
        default: 100,
        step: 1,
        min: 1,
        max: 1000,
        description: '每个 WebQQ 会话保留的最近消息缓存数量',
      },
      {
        key: 'webQQStorageBackend',
        type: 'union',
        default: 'koishi',
        role: 'radio',
        options: [['koishi', 'Koishi 数据库'], ['browser', '浏览器']],
        description: 'WebQQ 状态存储后端',
      },
      {
        key: 'webQQImageCacheEnabled',
        type: 'boolean',
        default: true,
        description: '启用 WebQQ 图片代理内存缓存，会额外占用服务器内存',
      },
      {
        key: 'webQQImageCacheLimitMB',
        type: 'number',
        default: 100,
        step: 1,
        min: 1,
        max: 4096,
        description: 'WebQQ 图片代理内存缓存总上限，单位 MB',
      },
      {
        key: 'webQQImageCacheItemLimitMB',
        type: 'number',
        default: 10,
        step: 1,
        min: 1,
        max: 1024,
        description: '单张 WebQQ 图片超过此大小时不写入内存缓存，单位 MB',
      },
    ],
  },
  {
    name: '小胶囊设置',
    fields: [
      {
        key: 'enableCapsuleFrostedGlass',
        type: 'boolean',
        default: true,
        description: '启用小胶囊毛玻璃效果',
      },
      {
        key: 'useCompactCapsuleShadow',
        type: 'boolean',
        default: true,
        description: '使用较窄的小胶囊阴影，关闭后使用较宽的阴影',
      },
      {
        key: 'showWebQQCapsuleUnread',
        type: 'boolean',
        default: true,
        description: '在小胶囊 bot 头像上显示 WebQQ 总未读数',
      },
      {
        key: 'hiddenCapsuleActivityIds',
        type: 'array',
        default: ['logs'],
        role: 'onebot-webqq-activity-select',
        inner: 'string',
        description: '不显示小胶囊的控制台侧栏项',
      },
    ],
  },
  {
    name: 'WebQQ 设置',
    fields: [
      {
        key: 'enableWebQQFrostedGlass',
        type: 'boolean',
        default: true,
        description: '启用 WebQQ 毛玻璃效果',
      },
      {
        key: 'enableWebQQSend',
        type: 'boolean',
        default: false,
        description: '启用 WebQQ 消息发送功能',
      },
      {
        key: 'webQQChatStyle',
        type: 'union',
        default: 'tim',
        role: 'radio',
        options: [['tim', 'TIM'], ['qq', 'QQ']],
        description: 'WebQQ 聊天页面样式',
      },
      {
        key: 'webQQTimBubbleTail',
        type: 'boolean',
        default: true,
        description: '显示 TIM 气泡小尖角',
      },
      {
        key: 'webQQColorMode',
        type: 'union',
        default: 'auto',
        role: 'radio',
        options: [['auto', '自动'], ['light', '明亮'], ['dark', '暗色']],
        description: 'WebQQ 颜色模式',
      },
      {
        key: 'webQQAccentColor',
        type: 'string',
        default: '#2563eb',
        role: 'color',
        description: 'WebQQ 强调色',
      },
      {
        key: 'allowWebQQResize',
        type: 'boolean',
        default: false,
        description: '允许拖动 WebQQ 以调整窗口宽高',
      },
      {
        key: 'webQQMarkRecalledMessages',
        type: 'boolean',
        default: true,
        description: '保留被撤回的 WebQQ 消息并显示删除线。关闭后显示撤回事件并移除原消息',
      },
      {
        key: 'hideWebQQGroupLevel',
        type: 'boolean',
        default: true,
        description: '隐藏 WebQQ 消息中的群等级徽标',
      },
      {
        key: 'showWebQQAffinity',
        type: 'boolean',
        default: false,
        description: '在 WebQQ 用户昵称右侧显示 ChatLuna 好感度',
      },
      {
        key: 'showWebQQRelationship',
        type: 'boolean',
        default: false,
        description: '在 WebQQ 用户昵称右侧显示 ChatLuna 关系',
      },
      {
        key: 'showWebQQCharacterThinking',
        type: 'boolean',
        default: true,
        description: '在 WebQQ 中显示 chatluna-character 的 think 内容',
      },
      {
        key: 'showWebQQThinkingTokens',
        type: 'boolean',
        default: true,
        description: '在 WebQQ 中显示 ChatLuna 输入/输出 token，使用主插件时需关闭`showWebQQCharacterThinking`才能正常显示',
      },
      {
        key: 'showWebQQThinkingTiming',
        type: 'boolean',
        default: true,
        description: '在 WebQQ 中显示 ChatLuna TTFT、TPS 和 Total，使用主插件时需关闭`showWebQQCharacterThinking`才能正常显示',
      },
      {
        key: 'webQQAffinityScopeId',
        type: 'string',
        default: NO_DEFAULT,
        description: 'ChatLuna 好感度插件的 scopeId，留空且当前只有一个 scopeId 时自动使用',
      },
    ],
  },
  {
    name: '开发者选项',
    fields: [
      {
        key: 'onebotMockBotCount',
        type: 'number',
        default: 0,
        step: 1,
        min: 0,
        max: 20,
        description: '额外模拟的 OneBot 机器人数量，勿动',
      },
      {
        key: 'webQQMockEnvironment',
        type: 'boolean',
        default: false,
        description: '启用 WebQQ 开发者模拟环境',
      },
      {
        key: 'debug',
        type: 'boolean',
        default: false,
        description: '显示调试信息',
      },
    ],
  },
]

const CONTRACT_FIELDS = PANEL.flatMap((group) => group.fields)
const GROUP_NODES = Config.list ?? []

function contractDefaults() {
  const defaults: Record<string, unknown> = {}
  for (const field of CONTRACT_FIELDS) {
    if (field.default !== NO_DEFAULT) defaults[field.key] = field.default
  }
  return defaults
}

describe('配置面板契约', () => {
  it('由五个分组交叉组成，分组名称与顺序固定', () => {
    expect(Config.type).toBe('intersect')
    expect(GROUP_NODES.map((group) => group.meta.description)).toEqual(PANEL.map((group) => group.name))
  })

  it('每个分组的字段顺序固定，且不含未登记在契约里的字段', () => {
    for (const [index, group] of PANEL.entries()) {
      expect(Object.keys(GROUP_NODES[index]?.dict ?? {})).toEqual(group.fields.map((field) => field.key))
    }
  })

  it('覆盖插件全部 31 个配置项', () => {
    expect(CONTRACT_FIELDS).toHaveLength(31)
    expect(GROUP_NODES.flatMap((group) => Object.keys(group.dict ?? {}))).toHaveLength(31)
  })

  it('留空配置时按 Schema 默认值展开', () => {
    expect(Config({})).toEqual(contractDefaults())
  })

  it('好感度 scopeId 是唯一没有默认值的配置项', () => {
    const withoutDefault = CONTRACT_FIELDS.filter((field) => field.default === NO_DEFAULT)
    expect(withoutDefault.map((field) => field.key)).toEqual(['webQQAffinityScopeId'])
    expect(Config({})).not.toHaveProperty('webQQAffinityScopeId')
  })
})

describe.each(PANEL)('配置分组 $name', ({ name, fields }) => {
  const group = GROUP_NODES[PANEL.findIndex((item) => item.name === name)]

  it.each(fields)('$key 的默认值、控件与说明文案', (field) => {
    const node = group?.dict?.[field.key]
    expect(node).toBeDefined()
    if (!node) return

    expect(node.type).toBe(field.type)
    expect(node.meta.description).toBe(field.description)
    expect(node.meta.role).toBe(field.role)
    expect(node.meta.step).toBe(field.step)
    expect(node.meta.min).toBe(field.min)
    expect(node.meta.max).toBe(field.max)

    if (field.default === NO_DEFAULT) expect('default' in node.meta).toBe(false)
    else expect(node.meta.default).toEqual(field.default)

    if (field.options) {
      expect((node.list ?? []).map((option) => [option.value, option.meta.description])).toEqual(field.options)
    } else {
      expect(node.list).toBeUndefined()
    }

    expect(node.inner?.type).toBe(field.inner)
  })
})
