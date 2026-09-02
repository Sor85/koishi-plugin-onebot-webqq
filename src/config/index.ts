// 配置目录的对外门面：`'../config'` 这个模块名保持不变，二十多处现有引用零改动。
//
// `schema.ts` 引用了 koishi，只允许被服务端引用。ADR 0003：配置规格在 `./spec.ts`，与它分文件，
// 且不引用 koishi——前端 vite 构建的 external 列表不含 koishi，规格一旦（直接或间接）引用 koishi，
// 整个 koishi 会被打进浏览器产物，而且不产生任何报错。
//
// 这里**不** re-export 规格：如果 `'../config'` 也能拿到规格，前端某天把 import 写成
// `'../../src/config'` 就会静默触发上面那个回归。服务端与前端都走完整路径 `'…/config/spec'`。
export * from './schema'
