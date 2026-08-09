import type { ComputedRef, InjectionKey } from 'vue'

export interface WebQQDialogContext {
  open: ComputedRef<boolean>
  setOpen: (open: boolean) => void
}

export const webQQDialogContextKey: InjectionKey<WebQQDialogContext> = Symbol('webqq-dialog')
