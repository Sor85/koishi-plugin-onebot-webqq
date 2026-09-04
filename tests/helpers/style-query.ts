import { readdir, readFile } from 'node:fs/promises'

const clientDir = new URL('../../client/', import.meta.url)

const read = (path: string) => readFile(new URL(path, clientDir), 'utf8')

/**
 * 全部样式源的路径，键序即 client/style.scss 的 @use 顺序。
 *
 * 顺序就是层叠顺序，拼接串要和真实产物一致，否则「谁覆盖谁」这类判断会量错对象。
 * 这份清单必须覆盖**全部**样式文件：漏掉一个，针对它的规则查询会静默查不到，那个文件就只剩
 * 「整份源码里出现过这串字」这种最弱的守卫。webqq-interactions.scss 曾经就是这样漏在外面，
 * 它 1503 行、占全部样式源的 28%。tests/style-query.test.ts 有一条守卫比对这份清单与磁盘实况。
 */
export const styleSourceFiles = {
  boxModel: 'webqq/styles/webqq-box-model.scss',
  typography: 'webqq/styles/webqq-typography.scss',
  capsule: 'capsule/styles.scss',
  shell: 'webqq/styles/webqq-shell.scss',
  chat: 'webqq/styles/webqq-chat.scss',
  groupInfo: 'webqq/styles/webqq-group-info.scss',
  notices: 'webqq/styles/webqq-notices.scss',
  messages: 'webqq/styles/webqq-messages.scss',
  messageCards: 'webqq/styles/webqq-message-cards.scss',
  messageOverlays: 'webqq/styles/webqq-message-overlays.scss',
  messageEffects: 'webqq/styles/webqq-message-effects.scss',
  interactions: 'webqq/styles/webqq-interactions.scss',
  themeColors: 'webqq/styles/theme-colors.scss',
  entry: 'style.scss',
} as const

export type StyleSourceName = keyof typeof styleSourceFiles

/** 全部样式源的内容，键与 styleSourceFiles 一致。 */
export const styleSources = Object.fromEntries(
  await Promise.all(
    Object.entries(styleSourceFiles).map(async ([name, path]) => [name, await read(path)] as const),
  ),
) as Record<StyleSourceName, string>

/** 规则查询的默认来源：全部样式源按层叠顺序拼接。 */
export const allStyles = Object.values(styleSources).join('\n')

/**
 * 递归收集 client 下的样式源与单文件组件，路径形如 `client/webqq/styles/webqq-chat.scss`。
 *
 * 全树遍历只在两处需要：比对上面那份清单与磁盘实况，以及排版守卫扫描字号野值（它连 .vue
 * 一起扫）。这里给出唯一一份实现，避免两个测试文件各写一遍遍历。
 */
export async function collectClientSources(dir = clientDir): Promise<{ path: string, text: string }[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: { path: string, text: string }[] = []
  for (const entry of entries) {
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir)
    if (entry.isDirectory()) files.push(...await collectClientSources(child))
    else if (entry.name.endsWith('.scss') || entry.name.endsWith('.vue')) {
      files.push({ path: child.pathname.slice(child.pathname.indexOf('/client/') + 1), text: await readFile(child, 'utf8') })
    }
  }
  return files
}

/**
 * 去掉注释再解析。
 *
 * 注释里带花括号和选择器字面量是常态（盒模型基线的注释里就写着 `* { box-sizing }`），
 * 不剥注释的切片器会把注释当成规则前导，或者让断言命中注释里的字面量而不是真的声明。
 *
 * 每个调用点都重新剥一遍。这里不做记忆化：整套守卫跑在两三百毫秒量级，缓存买不到任何人感觉得到
 * 的东西，代价是给一层纯函数加上状态。真的慢到要处理时，主要开销是唯一性检查的全量扫描而不是
 * 这里（见 ADR 0011 的后果）。
 */
export function withoutComments(style: string) {
  return style
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .filter((line) => !line.trim().startsWith('//'))
    .join('\n')
}

/** 按顶层逗号切前导选择器：括号里的逗号（`:is(a, b)`、`:not(a, b)`）不是选择器边界。 */
function splitSelectors(prelude: string) {
  const selectors: string[] = []
  let depth = 0
  let current = ''
  for (const char of prelude) {
    if (char === '(' || char === '[') depth += 1
    else if (char === ')' || char === ']') depth -= 1
    else if (char === ',' && depth === 0) {
      selectors.push(current.trim())
      current = ''
      continue
    }
    current += char
  }
  selectors.push(current.trim())
  return selectors.filter(Boolean)
}

function closingBrace(style: string, openIndex: number, label: string) {
  let depth = 0
  for (let index = openIndex; index < style.length; index += 1) {
    if (style[index] === '{') depth += 1
    else if (style[index] === '}') {
      depth -= 1
      if (depth === 0) return index
    }
  }
  throw new Error(`${label} 的花括号没有闭合`)
}

/**
 * 规则前导以 `}`、`{`、`;` 为界。
 *
 * `;` 这一项不能省：`.foo { color: red; &:hover { … } }` 里嵌套规则的前导紧跟在声明后面，
 * 只按花括号找边界会把 `color: red; &:hover` 整段当成前导，于是嵌套规则永远查不到。
 */
function preludeStart(style: string, openIndex: number) {
  return Math.max(
    style.lastIndexOf('}', openIndex - 1),
    style.lastIndexOf('{', openIndex - 1),
    style.lastIndexOf(';', openIndex - 1),
  ) + 1
}

function findRules(selector: string, style: string) {
  const bodies: { start: number, end: number }[] = []
  for (let index = style.indexOf('{'); index >= 0; index = style.indexOf('{', index + 1)) {
    if (!splitSelectors(style.slice(preludeStart(style, index), index)).includes(selector)) continue
    bodies.push({ start: index + 1, end: closingBrace(style, index, selector) })
  }
  return bodies
}

/**
 * 定位唯一的一处规则定义。
 *
 * 找不到就报错而不是返回空串：负向断言（「这条规则里不该有 X」）遇到空串会静默变成永真，
 * 选择器改名之后没有任何东西会揭穿它。
 *
 * 多处定义也报错，要求调用点收窄来源。这不是洁癖：靠首命中取值等于让断言依赖规则在文件里的
 * 排列顺序，而首命中那一处未必是断言想量的那一处。
 */
function singleRule(selector: string, source: string) {
  const style = withoutComments(source)
  const bodies = findRules(selector, style)
  if (!bodies.length) throw new Error(`样式源里没有规则 ${selector}`)
  if (bodies.length > 1) {
    throw new Error(
      `样式规则 ${selector} 有 ${bodies.length} 处定义，请把来源收窄到其中一处：指定样式文件，或先切出父规则的 body`,
    )
  }
  return style.slice(bodies[0].start, bodies[0].end)
}

/** 丢掉全部嵌套块，只留本级声明。嵌套规则的前导跟着它的块一起丢。 */
function ownDeclarations(body: string) {
  let declarations = ''
  let cursor = 0
  while (cursor < body.length) {
    const open = body.indexOf('{', cursor)
    if (open < 0) return declarations + body.slice(cursor)
    const segment = body.slice(cursor, open)
    const lastSemicolon = segment.lastIndexOf(';')
    if (lastSemicolon >= 0) declarations += segment.slice(0, lastSemicolon + 1)
    cursor = closingBrace(body, open, '嵌套规则') + 1
  }
  return declarations
}

/**
 * 取规则的**本级声明**。这是默认形态：绝大多数断言要量的声明就写在本级，
 * 一条声明不该因为它出现在某个子规则里就算通过。
 */
export function ruleDeclarations(selector: string, source = allStyles) {
  return ownDeclarations(singleRule(selector, source))
}

/** 问规则是否存在。逗号选择器列表里的成员算存在。 */
export function hasRule(selector: string, source = allStyles) {
  return findRules(selector, withoutComments(source)).length > 0
}

/**
 * 取块的**全部内容**，含嵌套块。
 *
 * 给 `@keyframes`、`@media`、`@container` 这类 body 本来就只有嵌套块的规则，
 * 也给「先取父规则再在里面查子选择器」的嵌套查询当起点。
 */
export function ruleBlock(selector: string, source = allStyles) {
  return singleRule(selector, source)
}

/** 取两个字面量之间。任一端找不到都报错，不返回半截也不返回空串。 */
export function sourceBetween(start: string, end: string, source = allStyles) {
  const style = withoutComments(source)
  const startIndex = style.indexOf(start)
  if (startIndex < 0) throw new Error(`样式源里没有 ${start}`)
  const endIndex = style.indexOf(end, startIndex + start.length)
  if (endIndex < 0) throw new Error(`${start} 之后没有 ${end}`)
  return style.slice(startIndex, endIndex)
}

/**
 * 取规则本级某条声明的值。
 *
 * 目标规则没有这条声明就报错。手写的惰性正则在这种情况下会一路扫到后面某条无关规则的同名声明，
 * 读出来的值看着合理却不属于目标规则——浮层叠放次序那几条断言正是靠这类值互相比较。
 */
export function declarationValue(selector: string, property: string, source = allStyles) {
  const declarations = ownDeclarations(singleRule(selector, source))
  for (const declaration of declarations.split(';')) {
    const colon = declaration.indexOf(':')
    if (colon < 0) continue
    if (declaration.slice(0, colon).trim() !== property) continue
    return declaration.slice(colon + 1).trim()
  }
  throw new Error(`样式规则 ${selector} 没有声明 ${property}`)
}
