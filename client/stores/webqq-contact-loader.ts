import type { WebQQContacts } from '../state'

const webQQContactsRetryLimit = 10
const webQQContactsRetryDelayMs = 800

function waitWebQQContactsRetry() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, webQQContactsRetryDelayMs)
  })
}

export async function requestWebQQContactsWithRetry(requestContacts: () => Promise<WebQQContacts>) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await requestContacts()
    } catch (error) {
      if (attempt >= webQQContactsRetryLimit) throw error
      await waitWebQQContactsRetry()
    }
  }
}
