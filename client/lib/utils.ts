import type { HTMLAttributes } from 'vue'

// 与 sandbox 一致：只做 class 拼接，不依赖 tailwind-merge。
export function cn(...classes: Array<HTMLAttributes['class'] | false | null | undefined>) {
  return classes.flatMap((item) => {
    if (!item) return []
    if (Array.isArray(item)) return item.filter(Boolean)
    return [item]
  }).join(' ')
}
