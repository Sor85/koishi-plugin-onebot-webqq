import { describe, expect, it } from 'vitest'
import {
  WEBQQ_PANEL_ENTRY_GAP,
  WEBQQ_PANEL_VIEWPORT_MARGIN_X,
  WEBQQ_PANEL_VIEWPORT_MARGIN_Y,
  resolveWebQQPanelAnchor,
} from '../../client/webqq/utils/webqq-panel-anchor'

const entry = { right: 24, bottom: 56, height: 50 }
const panel = { width: 1040, height: 656 }

describe('观察窗跟随入口的落位', () => {
  it('默认锚点下与样式表里的 right: 24px / bottom: 116px 一致', () => {
    expect(resolveWebQQPanelAnchor({
      entry,
      panel,
      viewport: { width: 1440, height: 900 },
    })).toEqual({ right: 24, bottom: 116 })
  })

  it('入口右缘跟随拖动结果', () => {
    expect(resolveWebQQPanelAnchor({
      entry: { ...entry, right: 200 },
      panel,
      viewport: { width: 1440, height: 900 },
    }).right).toBe(200)
  })

  it('入口靠左时不把窗体左缘推出视口', () => {
    expect(resolveWebQQPanelAnchor({
      entry: { ...entry, right: 900 },
      panel,
      viewport: { width: 1440, height: 900 },
    }).right).toBe(1440 - 1040 - WEBQQ_PANEL_VIEWPORT_MARGIN_X)
  })

  it('窗体比视口还宽时保右缘', () => {
    expect(resolveWebQQPanelAnchor({
      entry: { ...entry, right: 24 },
      panel: { width: 1200, height: 400 },
      viewport: { width: 1000, height: 900 },
    }).right).toBe(WEBQQ_PANEL_VIEWPORT_MARGIN_X)
  })

  it('入口上方放不下就翻到入口下方，而不是压在入口上', () => {
    // 入口下缘离视口下缘 700px，即入口位于视口上部；窗体 420 高，上方只剩 130。
    expect(resolveWebQQPanelAnchor({
      entry: { ...entry, bottom: 700 },
      panel: { width: 640, height: 420 },
      viewport: { width: 1440, height: 900 },
    }).bottom).toBe(700 - WEBQQ_PANEL_ENTRY_GAP - 420)
  })

  it('翻到下方后窗体整块在入口下缘以下', () => {
    const anchor = resolveWebQQPanelAnchor({
      entry: { ...entry, bottom: 700 },
      panel: { width: 640, height: 420 },
      viewport: { width: 1440, height: 900 },
    })

    expect(anchor.bottom + 420).toBeLessThanOrEqual(700)
  })

  it('上下都放不下时保下缘可见，让顶部溢出', () => {
    expect(resolveWebQQPanelAnchor({
      entry: { ...entry, bottom: 400 },
      panel: { width: 640, height: 700 },
      viewport: { width: 1440, height: 720 },
    }).bottom).toBe(720 - 700 - WEBQQ_PANEL_VIEWPORT_MARGIN_Y)
  })

  it('窗体比视口还高时贴住下缘的最小间距', () => {
    expect(resolveWebQQPanelAnchor({
      entry: { ...entry, bottom: 200 },
      panel: { width: 640, height: 900 },
      viewport: { width: 1440, height: 700 },
    }).bottom).toBe(WEBQQ_PANEL_VIEWPORT_MARGIN_Y)
  })

  it('入口贴着视口下缘时仍然向上展开', () => {
    expect(resolveWebQQPanelAnchor({
      entry: { ...entry, bottom: 8 },
      panel: { width: 640, height: 420 },
      viewport: { width: 1440, height: 900 },
    }).bottom).toBe(8 + 50 + WEBQQ_PANEL_ENTRY_GAP)
  })
})
