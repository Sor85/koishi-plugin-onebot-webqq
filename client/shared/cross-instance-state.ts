// 跨模块实例共享状态：把「挂到全局对象、按键去重、首次创建」收成一处。
//
// 机制：portal + Vite @fs 会把同一份源码解析成多个模块实例——dev 入口走 node_modules 软链路径，
// 子模块被 Vite 改写成真实源码路径，且部分改写会带上 `?v=<browserHash>`、部分不带，同一个文件
// 因此出现带/不带版本号的两个 URL、两份模块作用域。写入方与读取方落在不同实例上时，模块顶层的
// 响应式引用就是两份：一侧写，另一侧永远读不到。
//
// 兜底做法是把状态挂到全局对象上并按键去重：无论源码被解析成几份模块实例，同一个键只创建一次，
// 所有实例拿到的都是那唯一一份。漏掉这层兜底不会报错，只会在开发环境里表现成怪现象；具体症状
// 各不相同，写在各自调用点旁边。
//
// 这个 module 只回答「如何共享」：它不认识任何具体领域的状态名，键由调用点以完整字符串字面量
// 给出（排查时在浏览器里看到的键，回到源码要能直接 grep 到），卸载时清理什么由组合根决定。
// 准入门槛见 ADR 0008。
export function defineCrossInstanceState<T extends object>(key: string, create: () => T): T {
  const scope = globalThis as typeof globalThis & Record<string, T | undefined>
  const shared = scope[key]
  if (shared) return shared
  const created = create()
  scope[key] = created
  return created
}
