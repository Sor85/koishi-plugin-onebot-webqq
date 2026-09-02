import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const chatStyles = await readFile(new URL('../client/webqq/styles/webqq-chat.scss', import.meta.url), 'utf8')
const interactionStyles = await readFile(new URL('../client/webqq/styles/webqq-interactions.scss', import.meta.url), 'utf8')

// 这里只锁输入区的视觉契约：行为断言全部打在 WebQQComposer 的挂载面上。
describe('WebQQ 回复与提及输入 UI', () => {
  it('行内 mention token 以内联块渲染，不再有独立提及行的样式', () => {
    expect(chatStyles).toContain('.onebot-webqq-webqq__composer-mention')
    expect(chatStyles).toContain('display: inline-flex')
    expect(chatStyles).not.toContain('.onebot-webqq-webqq__send-mentions')
  })

  it('候选菜单自然展开，不创建内部滚动条', () => {
    const menuRule = chatStyles.slice(
      chatStyles.indexOf('.onebot-webqq-webqq__mention-menu {'),
      chatStyles.indexOf('.onebot-webqq-webqq__mention-menu-item {'),
    )
    expect(menuRule).not.toContain('overflow: auto')
    expect(menuRule).not.toContain('overflow-y: auto')
    expect(menuRule).not.toContain('max-height: 220px')
  })

  it('回复条和附件共用发送控件上方的可换行上下文层，并显式恢复文本行高', () => {
    expect(chatStyles).toMatch(/\.onebot-webqq-webqq__send-context\s*\{[^}]*flex-wrap:\s*wrap/s)
    expect(chatStyles).not.toContain('.onebot-webqq-webqq__send-attachments.has-reply')
    expect(interactionStyles).toMatch(/\.onebot-webqq-webqq__reply-draft\s*\{[^}]*line-height:\s*18px/s)
  })
})
