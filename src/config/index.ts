// 配置目录的对外门面：`'../config'` 这个模块名保持不变，二十多处现有引用零改动。
//
// `schema.ts` 引用了 koishi，只允许被服务端引用。ADR 0003：将来要加的配置规格 module 必须
// 与它分文件，且不得引用 koishi——前端 vite 构建的 external 列表不含 koishi，规格一旦（直接或
// 间接）引用 koishi，整个 koishi 会被打进浏览器产物，而且不产生任何报错。
export * from './schema'
