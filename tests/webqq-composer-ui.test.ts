import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'

const observerSource = await readFile(new URL('../client/webqq/WebQQObserver.vue', import.meta.url), 'utf8')
const chatStyles = await readFile(new URL('../client/webqq/styles/webqq-chat.scss', import.meta.url), 'utf8')
const interactionStyles = await readFile(new URL('../client/webqq/styles/webqq-interactions.scss', import.meta.url), 'utf8')

describe('WebQQ 回复与提及输入 UI', () => {
  it('使用行内 mention token 与键盘候选菜单，不再渲染独立提及行', () => {
    expect(observerSource).toContain('contenteditable')
    expect(observerSource).toContain('WebQQMentionMenu')
    expect(observerSource).toContain('serializeWebQQComposerDraft')
    expect(observerSource).not.toContain('pendingMentionUserIds')
    expect(observerSource).not.toContain('onebot-webqq-webqq__send-mentions')
    expect(chatStyles).toContain('.onebot-webqq-webqq__composer-mention')
    expect(chatStyles).toContain('display: inline-flex')
  })

  it('中途输入 @ 时使用本次 DOM 草稿计算光标，并在下一微任务再次同步', () => {
    expect(observerSource).toContain('const caret = getComposerCaret(next.tokens)')
    expect(observerSource).toContain('const currentCaret = getComposerCaret()')
    expect(observerSource).toContain('tokenIndex: currentCaret.tokenIndex')
    expect(observerSource).toContain('updateMentionMenuFromDraft(composerDraft.value)')
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
    expect(observerSource).toContain('class="onebot-webqq-webqq__send-context"')
    expect(observerSource).toContain('replyingToMessage || sendFiles.length')
    expect(chatStyles).toMatch(/\.onebot-webqq-webqq__send-context\s*\{[^}]*flex-wrap:\s*wrap/s)
    expect(chatStyles).not.toContain('.onebot-webqq-webqq__send-attachments.has-reply')
    expect(interactionStyles).toMatch(/\.onebot-webqq-webqq__reply-draft\s*\{[^}]*line-height:\s*18px/s)
  })
})
