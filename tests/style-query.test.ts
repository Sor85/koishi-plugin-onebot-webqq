import { describe, expect, it } from 'vitest'
import {
  allStyles,
  collectClientSources,
  declarationValue,
  hasRule,
  ruleBlock,
  ruleDeclarations,
  sourceBetween,
  styleSourceFiles,
  styleSources,
  withoutComments,
} from './helpers/style-query'

/** 只用来测查询器自己的外部行为，故意把各种坑写在一份最小样式源里。 */
const fixture = `
/* 注释里带花括号：.decoy { color: #f00 } 不是规则。 */
.alpha,
.beta {
  padding: 8px;
  // 行注释里也写一次 .decoy { color: #f00 }
  color: #111;

  &:hover {
    color: #222;
  }

  .child {
    margin: 4px;
  }

  gap: 2px;
}

.gamma {
  padding: 1px;
}

.gamma {
  padding: 2px;
}

.delta {
  border: 0;
}

.epsilon {
  z-index: 7;
}

body :is(.zeta, .eta) {
  outline: none;
}

@keyframes spin {
  0% {
    transform: rotate(0deg);
  }

  100% {
    transform: rotate(360deg);
  }
}
`

describe('样式查询：取规则的本级声明', () => {
  it('只取本级，子规则里的声明不算', () => {
    const alpha = ruleDeclarations('.alpha', fixture)

    expect(alpha).toContain('padding: 8px')
    expect(alpha).toContain('color: #111')
    // 本级声明可以出现在嵌套块之后，同样要收进来。
    expect(alpha).toContain('gap: 2px')
    expect(alpha).not.toContain('color: #222')
    expect(alpha).not.toContain('margin: 4px')
    expect(alpha).not.toContain('&:hover')
    expect(alpha).not.toContain('.child')
  })

  it('逗号选择器列表的成员和第一项都算规则', () => {
    expect(ruleDeclarations('.beta', fixture)).toContain('padding: 8px')
    expect(ruleDeclarations('.alpha', fixture)).toBe(ruleDeclarations('.beta', fixture))
  })

  it('找不到目标就报错，并带上选择器', () => {
    expect(() => ruleDeclarations('.nope', fixture)).toThrowError(/\.nope/)
  })

  it('同一个选择器有多处定义时报错，要求收窄来源', () => {
    expect(() => ruleDeclarations('.gamma', fixture)).toThrowError(/2 处定义/)
    // 收窄之后各自唯一。
    expect(ruleDeclarations('.gamma', sourceBetween('.gamma {', '.gamma {', fixture))).toContain('padding: 1px')
  })

  it('带花括号的注释不参与切片', () => {
    expect(hasRule('.decoy', fixture)).toBe(false)
    expect(ruleDeclarations('.alpha', fixture)).not.toContain('decoy')
    expect(withoutComments(fixture)).not.toContain('decoy')
  })

  it('括号里的逗号不是选择器边界', () => {
    // `:is(.zeta, .eta)` 是一条选择器，不是三条；否则 .zeta 会被当成有自己的规则。
    expect(hasRule('.zeta', fixture)).toBe(false)
    expect(hasRule('body :is(.zeta, .eta)', fixture)).toBe(true)
  })
})

describe('样式查询：问规则是否存在', () => {
  it('存在与内容是两个问题，不存在时返回 false 而不是报错', () => {
    expect(hasRule('.alpha', fixture)).toBe(true)
    expect(hasRule('.nope', fixture)).toBe(false)
  })

  it('多处定义不影响存在性判断', () => {
    expect(hasRule('.gamma', fixture)).toBe(true)
  })
})

describe('样式查询：取块的全部内容', () => {
  it('@keyframes 的全部关键帧都在里面', () => {
    const spin = ruleBlock('@keyframes spin', fixture)

    expect(spin).toContain('transform: rotate(0deg)')
    expect(spin).toContain('transform: rotate(360deg)')
  })

  it('规则的块含嵌套子规则，可以当嵌套查询的来源', () => {
    const alpha = ruleBlock('.alpha', fixture)

    expect(alpha).toContain('.child')
    expect(ruleDeclarations('.child', alpha)).toContain('margin: 4px')
  })
})

describe('样式查询：取两个字面量之间', () => {
  it('任一端找不到都报错', () => {
    expect(() => sourceBetween('.nope {', '.alpha {', fixture)).toThrowError(/\.nope \{/)
    expect(() => sourceBetween('.alpha,', '.nope {', fixture)).toThrowError(/\.nope \{/)
  })
})

describe('样式查询：取某条声明的值', () => {
  it('取本级声明的值', () => {
    expect(declarationValue('.epsilon', 'z-index', fixture)).toBe('7')
  })

  it('目标规则缺这条声明时报错，不会读到后面某条无关规则的值', () => {
    // 惰性正则在这里会一路扫到 .epsilon 的 z-index，读出一个不属于 .delta 的值。
    expect(() => declarationValue('.delta', 'z-index', fixture)).toThrowError(/没有声明 z-index/)
  })
})

describe('样式查询：默认来源', () => {
  it('覆盖磁盘上全部样式文件，包括曾经漏在外面的浮层样式与盒模型基线', async () => {
    const onDisk = (await collectClientSources())
      .map((file) => file.path)
      .filter((path) => path.endsWith('.scss'))
    const declared = Object.values(styleSourceFiles).map((path) => `client/${path}`)

    // 漏登记一个样式文件时，针对它的规则查询会静默查不到，那个文件就只剩最弱的整文件守卫。
    expect(declared.slice().sort()).toEqual(onDisk.slice().sort())
    // 这三条各代表一个曾经查不到的文件：浮层与交互样式、盒模型基线、排版基线。
    expect(hasRule('.webqq-context-menu-item')).toBe(true)
    expect(ruleBlock('.onebot-webqq-host', styleSources.boxModel)).toContain('box-sizing: border-box')
    expect(ruleDeclarations('.onebot-webqq-host', styleSources.typography)).toContain('font-size: var(--onebot-webqq-font-md)')
  })

  it('按 @use 的层叠顺序拼接', () => {
    // 顺序错了会让「谁覆盖谁」这类判断量错对象。
    let cursor = 0
    for (const source of Object.values(styleSources)) {
      const found = allStyles.indexOf(source, cursor)
      expect(found).toBeGreaterThanOrEqual(cursor)
      cursor = found + source.length
    }
  })
})
