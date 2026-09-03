import { computed, ref, type Ref } from 'vue'
import { readWebQQErrorMessage } from '../utils/webqq-error'

// 两类对话框共用这句兜底：错误落点只写一处，改文案不会漏掉一条路径。
const actionFailureText = '操作失败'

/**
 * 输入对话框的一次征询。提交回调是 spec 的字段而不是旁边的可变量：
 * 「对话框开着」与「提交回调在场」因此是同一个事实，不可能出现开着但没回调的中间态。
 */
export interface WebQQActionDialogSpec {
  title: string
  description?: string
  placeholder?: string
  value?: string
  confirmText?: string
  submit: (value: string) => void | Promise<void>
}

/** 确认对话框的一次征询。字段与协议都与输入对话框不同，因此是两份独立类型而不是联合类型。 */
export interface WebQQConfirmDialogSpec {
  title: string
  description: string
  confirmText: string
  submit: () => Promise<void>
}

// 模板侧的双向绑定接这个计算值：置为关闭就清掉 spec，于是取消、Escape、点遮罩三条关闭路径
// 都自动清掉提交回调，不需要各自补一行。
function toDialogOpenFlag<T>(spec: Ref<T | undefined>) {
  return computed({
    get: () => !!spec.value,
    set: (open: boolean) => {
      if (!open) spec.value = undefined
    },
  })
}

export function useWebQQActionDialogs(options: { errorText: Ref<string> }) {
  const actionDialogSpec = ref<WebQQActionDialogSpec>()
  const confirmDialogSpec = ref<WebQQConfirmDialogSpec>()
  const actionDialogOpen = toDialogOpenFlag(actionDialogSpec)
  const confirmDialogOpen = toDialogOpenFlag(confirmDialogSpec)

  function reportActionFailure(error: unknown) {
    options.errorText.value = readWebQQErrorMessage(error, actionFailureText)
  }

  function openActionDialog(spec: WebQQActionDialogSpec) {
    actionDialogSpec.value = spec
  }

  function openConfirmDialog(spec: WebQQConfirmDialogSpec) {
    confirmDialogSpec.value = spec
  }

  // 输入型协议：先关，再跑动作，失败只落到共享的错误横幅上（ADR 0007）。
  function confirmActionDialog(value: string) {
    const spec = actionDialogSpec.value
    actionDialogSpec.value = undefined
    void Promise.resolve(spec?.submit(value)).catch(reportActionFailure)
  }

  // 确认型协议：组件自持提交态并 await 这一轮，成功才清 spec，失败时 spec 留在原地供重试。
  function confirmDestructiveAction(resolve: () => void, reject: (error: unknown) => void) {
    const spec = confirmDialogSpec.value
    void Promise.resolve(spec?.submit()).then(() => {
      confirmDialogSpec.value = undefined
      resolve()
    }, (error) => {
      reportActionFailure(error)
      reject(error)
    })
  }

  return {
    actionDialogSpec,
    confirmDialogSpec,
    actionDialogOpen,
    confirmDialogOpen,
    openActionDialog,
    openConfirmDialog,
    confirmActionDialog,
    confirmDestructiveAction,
  }
}
