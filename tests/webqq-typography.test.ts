import { describe, expect, it } from 'vitest'
import { collectClientSources, ruleDeclarations, styleSources, withoutComments } from './helpers/style-query'

/** 全树扫描的来源：字号野值可能出现在任何 .scss 或单文件组件里，所以不用样式查询的那份清单。 */
const sweepSources = await collectClientSources()

const typographyStyle = styleSources.typography
const boxModelStyle = styleSources.boxModel
const styleEntry = styleSources.entry
const chatStyle = styleSources.chat

/** 取第 ruleIndex 条规则的前导选择器清单。排版守卫特有的遍历方式，不进样式查询 module。 */
function selectorList(style: string, ruleIndex: number) {
  const clean = withoutComments(style)
  const braceIndex = nthIndexOf(clean, '{', ruleIndex)
  const start = clean.lastIndexOf('}', braceIndex) + 1
  return clean.slice(start, braceIndex).split(',').map((item) => item.trim()).filter(Boolean)
}

function nthIndexOf(text: string, needle: string, nth: number) {
  let index = -1
  for (let count = 0; count <= nth; count += 1) {
    index = text.indexOf(needle, index + 1)
    if (index < 0) throw new Error(`样式里没有第 ${nth + 1} 个 ${needle}`)
  }
  return index
}

// 与 webqq-box-model.scss 同一份清单：插件自己的宿主壳，加上 Portal/Teleport 到 body 的五个浮层根。
const bodyLevelSurfaceRoots = [
  '.onebot-webqq-host',
  '.webqq-context-menu-content',
  '.webqq-dialog-layer',
  '.onebot-webqq-webqq__portal-page',
  '.onebot-webqq-webqq__notice-menu',
  '.onebot-webqq-webqq__scrollbar-overlay',
]

const fontScale = {
  '--onebot-webqq-font-2xs': '10px',
  '--onebot-webqq-font-xs': '11px',
  '--onebot-webqq-font-sm': '12px',
  '--onebot-webqq-font-md': '13px',
  '--onebot-webqq-font-lg': '14px',
  '--onebot-webqq-font-xl': '15px',
  '--onebot-webqq-font-2xl': '16px',
}

describe('WebQQ 排版基线', () => {
  it('基准字号声明在插件根与每个 body 级浮层根上', () => {
    // 宿主 Koishi 控制台只给 body 设 margin 与 font-family，不设 font-size；缺这份基线时
    // 没有显式字号的节点会一路继承到浏览器默认的 16px（实测草稿文字就是这样比气泡大一号）。
    expect(selectorList(typographyStyle, 0)).toEqual(bodyLevelSurfaceRoots)
    expect(typographyStyle).toContain('font-size: var(--onebot-webqq-font-md)')
    // 浮层清单必须与盒模型基线的那份逐字一致：漏登记一个浮层，那棵子树的令牌会解析失败并退回继承值。
    const boxModelRoots = selectorList(boxModelStyle, 0)
    expect(boxModelRoots).toEqual(bodyLevelSurfaceRoots)
  })

  it('字号标度是集中定义的七档令牌，覆盖角标到弹窗标题', () => {
    for (const [token, value] of Object.entries(fontScale)) {
      expect(typographyStyle, `缺少字号档位 ${token}`).toContain(`${token}: ${value};`)
    }
    // 档位数量锁住：新增文字要么落在现有档位，要么先扩展标度并同步这份断言。
    expect(typographyStyle.match(/--onebot-webqq-font-[a-z0-9]+:/g)).toHaveLength(Object.keys(fontScale).length)
  })

  it('行高基准覆盖观察窗与全部浮层，但不覆盖小胶囊的宿主壳', () => {
    const lineHeightRoots = selectorList(typographyStyle, 1)
    expect(lineHeightRoots).toEqual([
      '.onebot-webqq-webqq',
      ...bodyLevelSurfaceRoots.filter((root) => root !== '.onebot-webqq-host'),
    ])
    expect(typographyStyle).toContain('--onebot-webqq-line-height-md: 20px;')
    expect(typographyStyle).toContain('line-height: var(--onebot-webqq-line-height-md)')
    // 宿主壳上的 line-height: 0 是小胶囊压掉行内空白的既有基线，覆盖它会改变胶囊几何。
    expect(lineHeightRoots).not.toContain('.onebot-webqq-host')
  })
})

describe('WebQQ 字号标度', () => {
  it('排版基线紧跟盒模型基线输出，令牌先于用到它们的规则', () => {
    const uses = [...styleEntry.matchAll(/@use\s+'([^']+)'/g)].map((match) => match[1])
    expect(uses.slice(0, 2)).toEqual(['./webqq/styles/webqq-box-model', './webqq/styles/webqq-typography'])
  })

  it('样式源里的字号一律取自标度令牌，非排版用途必须就地写明理由', () => {
    const offScale: string[] = []
    for (const { path, text } of sweepSources) {
      const lines = text.split('\n')
      lines.forEach((line, index) => {
        const match = /font-size: *([^;]+);/.exec(line)
        if (!match) return
        const value = match[1].trim()
        if (value.startsWith('var(--onebot-webqq-font-')) return
        // 非排版用途（图标字形、箭头字形、压掉行内空白、几何派生字号）允许写字面值，
        // 但必须在紧邻的注释里说明它不是排版档位，否则视为漏用令牌。
        const reason = lines.slice(0, index).reverse()
          .slice(0, 3)
          .filter((previous) => previous.trim().startsWith('//'))
          .join('\n')
        if (/不是排版(字号|档位)/.test(reason)) return
        offScale.push(`${path}:${index + 1} font-size: ${value}`)
      })
    }
    expect(offScale).toEqual([])
  })

  it('草稿文字与占位文案不自己声明字号，由基准解析出正文档位', () => {
    // 这两处写 font: inherit 是为了压掉 contenteditable 与表单控件自带的字体族；
    // 一旦它们自己声明字号，基准就失去意义，改基准也不会再反映到草稿上。
    for (const selector of ['.onebot-webqq-webqq__send-text', '.onebot-webqq-webqq__send-placeholder']) {
      const body = ruleDeclarations(selector, chatStyle)
      expect(body, `${selector} 需要 font: inherit`).toContain('font: inherit')
      expect(body, `${selector} 不应自己声明字号`).not.toContain('font-size')
    }
  })
})


