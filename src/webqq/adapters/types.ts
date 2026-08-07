import type { createMockWebQQService } from './mock/service'
import type { createOneBotWebQQService } from './onebot/service'

// register / console / live-runtime 共用 service 形状；真实 OneBot 与开发者模拟环境需同构。
export type WebQQService =
  | ReturnType<typeof createOneBotWebQQService>
  | ReturnType<typeof createMockWebQQService>
