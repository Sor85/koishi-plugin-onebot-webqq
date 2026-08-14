import { describe, expect, it } from 'vitest'
import { getDesktopNoticeMenuPosition } from '../../client/webqq/utils/notice-menu-position'

describe('desktop notice menu position', () => {
  it('centers the menu under the bell with an 8px gap', () => {
    expect(getDesktopNoticeMenuPosition({
      left: 200,
      width: 36,
      bottom: 120,
    })).toEqual({
      top: 128,
      left: 218,
    })
  })
})
