<template>
  <div :class="['chat-capsule-webqq', `is-theme-${webQQTheme}`, `is-chat-style-${webQQChatStyle}`, `is-color-${webQQColorMode}`]" :style="webQQAccentStyle" role="dialog" aria-label="WebQQ 观察窗" @click="closeNoticeMenu">
    <aside class="chat-capsule-webqq__sidebar">
      <div class="chat-capsule-webqq__tabs-row">
        <div class="chat-capsule-webqq__tabs">
          <button :class="{ 'is-active': activeTab === 'recent' }" type="button" @click="selectTab('recent')">
            <svg class="chat-capsule-webqq__tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M12 7v5l3 2"></path>
            </svg>
            最近
          </button>
          <button :class="{ 'is-active': activeTab === 'friends' }" type="button" @click="selectTab('friends')">
            <svg class="chat-capsule-webqq__tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="8" r="4"></circle>
              <path d="M5 21a7 7 0 0 1 14 0"></path>
            </svg>
            好友
          </button>
          <button :class="{ 'is-active': activeTab === 'groups' }" type="button" @click="selectTab('groups')">
            <svg class="chat-capsule-webqq__tab-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="9" cy="8" r="3.5"></circle>
              <circle cx="17" cy="9" r="3"></circle>
              <path d="M2.5 21a6.5 6.5 0 0 1 13 0"></path>
              <path d="M14 16.5A5 5 0 0 1 21.5 21"></path>
            </svg>
            群组
          </button>
        </div>
        <span class="chat-capsule-webqq__notify-wrap" @click.stop>
          <button :class="['chat-capsule-webqq__notify', { 'is-active': noticeOpen }]" type="button" aria-label="通知" @click="openNotices">
            <svg class="chat-capsule-webqq__notify-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 18a3 3 0 0 1-6 0"></path>
              <path d="M19 16H5c1.4-1.4 2-3.2 2-5.5a5 5 0 0 1 10 0c0 2.3.6 4.1 2 5.5Z"></path>
            </svg>
          </button>
          <div v-if="noticeOpen" class="chat-capsule-webqq__notice-menu">
            <div class="chat-capsule-webqq__notice-tabs">
              <button :class="{ 'is-active': noticeMenuTab === 'friends' }" type="button" @click="noticeMenuTab = 'friends'">好友申请</button>
              <button :class="{ 'is-active': noticeMenuTab === 'groups' }" type="button" @click="noticeMenuTab = 'groups'">群通知</button>
            </div>
            <div class="chat-capsule-webqq__notice-menu-body">
              <div v-if="noticeLoading" class="chat-capsule-webqq__notice-empty">加载中</div>
              <div v-else-if="noticeErrorText" class="chat-capsule-webqq__notice-empty is-error">{{ noticeErrorText }}</div>
              <div v-else-if="!filteredNotices.length" class="chat-capsule-webqq__notice-empty">暂无通知</div>
              <div v-else class="chat-capsule-webqq__notices">
                <article v-for="notice in filteredNotices" :key="notice.id" class="chat-capsule-webqq__notice-card">
                  <img v-if="notice.avatar" class="chat-capsule-webqq__notice-avatar" :src="withProxy(notice.avatar)" :alt="notice.title">
                  <span v-else class="chat-capsule-webqq__notice-avatar"></span>
                  <div class="chat-capsule-webqq__notice-main">
                    <strong class="chat-capsule-webqq__notice-title">{{ notice.title }}</strong>
                    <span>{{ notice.subtitle }}</span>
                    <template v-if="notice.comment">
                      <small v-for="line in formatNoticeComment(notice.comment)" :key="line" class="chat-capsule-webqq__notice-comment">{{ line }}</small>
                    </template>
                  </div>
                  <div class="chat-capsule-webqq__notice-side">
                    <span v-if="canHandleNotice(notice)" class="chat-capsule-webqq__notice-actions">
                      <button type="button" :disabled="handlingNoticeId === notice.id" @click="handleNotice(notice, true)">同意</button>
                      <button type="button" :disabled="handlingNoticeId === notice.id" @click="handleNotice(notice, false)">拒绝</button>
                    </span>
                    <span v-else-if="getHandledNoticeStatusText(notice)" :class="['chat-capsule-webqq__notice-result', `is-${notice.status}`]">{{ getHandledNoticeStatusText(notice) }}</span>
                    <time v-if="notice.time" class="chat-capsule-webqq__notice-time">{{ formatNoticeTime(notice.time) }}</time>
                  </div>
                </article>
              </div>
            </div>
          </div>
        </span>
      </div>
      <div v-if="activeTab !== 'recent'" class="chat-capsule-webqq__search">
        <svg class="chat-capsule-webqq__search-icon" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="11" cy="11" r="7"></circle>
          <path d="m16 16 4 4"></path>
        </svg>
        <input
          v-model="searchQuery"
          type="text"
          :placeholder="activeTab === 'friends' ? '搜索好友...' : '搜索群组...'"
        >
      </div>
      <div class="chat-capsule-webqq__list">
        <button
          v-for="item in recentItems"
          v-show="activeTab === 'recent'"
          :key="`recent:${item.type}:${item.peerId}`"
          :class="['chat-capsule-webqq__contact', { 'is-active': currentPeerId === item.peerId }]"
          type="button"
          @click="selectRecent(item)"
        >
          <span class="chat-capsule-webqq__contact-avatar">
            <img :src="withProxy(item.avatar)" :alt="item.name">
            <span v-if="getUnreadCount(item.type, item.peerId)" class="chat-capsule-webqq__contact-unread">{{ getUnreadText(getUnreadCount(item.type, item.peerId)) }}</span>
          </span>
          <span class="chat-capsule-webqq__contact-info">
            <strong>{{ item.name }}</strong>
            <small>{{ getContactSubtitle(item.type, item.peerId, item.summary || item.subtitle) }}</small>
          </span>
          <time v-if="getContactTime(item.type, item.peerId, item.time)" class="chat-capsule-webqq__contact-time">{{ formatListTime(getContactTime(item.type, item.peerId, item.time)) }}</time>
        </button>
        <div v-if="activeTab === 'recent' && !recentItems.length" class="chat-capsule-webqq__empty-list">
          暂无最近会话
        </div>
        <section v-for="category in visibleFriendCategories" v-show="activeTab === 'friends'" :key="category.id" class="chat-capsule-webqq__friend-category">
          <h4 class="chat-capsule-webqq__friend-category-title">{{ category.name }}</h4>
          <button
            v-for="friend in category.friends"
            :key="friend.userId"
            :class="['chat-capsule-webqq__contact', { 'is-active': currentPeerId === friend.userId }]"
            type="button"
            @click="selectFriend(friend)"
          >
            <span class="chat-capsule-webqq__contact-avatar">
              <img :src="withProxy(friend.avatar)" :alt="friend.name">
              <span v-if="getUnreadCount('friend', friend.userId)" class="chat-capsule-webqq__contact-unread">{{ getUnreadText(getUnreadCount('friend', friend.userId)) }}</span>
            </span>
            <span class="chat-capsule-webqq__contact-info">
              <strong>{{ friend.name }}</strong>
              <small>{{ getContactSubtitle('friend', friend.userId, friend.nickname) }}</small>
            </span>
            <time v-if="getContactTime('friend', friend.userId)" class="chat-capsule-webqq__contact-time">{{ formatListTime(getContactTime('friend', friend.userId)) }}</time>
          </button>
        </section>
        <div v-if="activeTab === 'friends' && !visibleFriends.length" class="chat-capsule-webqq__empty-list">
          暂无好友
        </div>
        <button
          v-for="group in visibleGroups"
          v-show="activeTab === 'groups'"
          :key="group.groupId"
          :class="['chat-capsule-webqq__contact', { 'is-active': currentPeerId === group.groupId }]"
          type="button"
          @click="selectGroup(group)"
        >
          <span class="chat-capsule-webqq__contact-avatar">
            <img :src="withProxy(group.avatar)" :alt="group.name">
            <span v-if="getUnreadCount('group', group.groupId)" class="chat-capsule-webqq__contact-unread">{{ getUnreadText(getUnreadCount('group', group.groupId)) }}</span>
          </span>
          <span class="chat-capsule-webqq__contact-info">
            <strong>{{ group.name }}</strong>
            <small>{{ getContactSubtitle('group', group.groupId, getGroupSubtitle(group)) }}</small>
          </span>
          <time v-if="getContactTime('group', group.groupId)" class="chat-capsule-webqq__contact-time">{{ formatListTime(getContactTime('group', group.groupId)) }}</time>
        </button>
        <div v-if="activeTab === 'groups' && !visibleGroups.length" class="chat-capsule-webqq__empty-list">
          暂无群组
        </div>
      </div>
    </aside>
    <section class="chat-capsule-webqq__chat">
      <div class="chat-capsule-webqq__chat-main">
        <header class="chat-capsule-webqq__chat-header">
          <div class="chat-capsule-webqq__chat-title">
            <img v-if="currentAvatar" class="chat-capsule-webqq__chat-avatar" :src="withProxy(currentAvatar)" :alt="currentTitle">
            <div>
              <strong>{{ currentTitle }}</strong>
              <span>{{ currentSubtitle }}</span>
            </div>
          </div>
          <button v-if="currentChat?.type === 'group'" :class="{ 'is-active': groupInfoOpen }" type="button" aria-label="更多群信息" @click="toggleGroupInfo">
            <svg class="chat-capsule-webqq__header-icon" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="19" cy="12" r="1"></circle>
              <circle cx="5" cy="12" r="1"></circle>
            </svg>
          </button>
        </header>
        <div class="chat-capsule-webqq__chat-body">
          <div ref="messagePane" class="chat-capsule-webqq__messages" @scroll="updateMessageTracking">
            <template v-if="loading">
              <div class="chat-capsule-webqq__placeholder">加载中</div>
            </template>
            <template v-else-if="errorText">
              <div class="chat-capsule-webqq__placeholder is-error">{{ errorText }}</div>
            </template>
            <template v-else-if="!currentChat">
              <div class="chat-capsule-webqq__placeholder">选择一个会话</div>
            </template>
            <template v-else-if="!visibleMessages.length">
              <div class="chat-capsule-webqq__placeholder">暂无消息</div>
            </template>
            <template v-else>
              <template v-for="(message, index) in visibleMessages" :key="message.id || message.sequence">
                <div
                  :class="['chat-capsule-webqq__message', `is-${message.direction}`, getMessageClusterClass(index), { 'is-merged': isMergedMessage(index), 'is-thinking': isBotThinkingMessage(message) }]"
                >
                  <span class="chat-capsule-webqq__message-avatar-wrap">
                    <img class="chat-capsule-webqq__message-avatar" :src="withProxy(message.senderAvatar)" :alt="message.senderName">
                    <span v-if="message.senderAffinity != null && showWebQQAffinity" class="chat-capsule-webqq__message-affinity">
                      <svg class="chat-capsule-webqq__message-affinity-icon" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"></path>
                      </svg>
                      {{ message.senderAffinity }}
                    </span>
                  </span>
                  <div class="chat-capsule-webqq__message-content">
                    <div v-if="!isMergedMessage(index)" class="chat-capsule-webqq__sender-line">
                      <template v-if="message.direction === 'outgoing'">
                        <span v-if="getSenderAuthorityText(message)" :class="['chat-capsule-webqq__sender-badge', getSenderAuthorityClass(message)]">{{ getSenderAuthorityText(message) }}</span>
                        <span v-if="message.senderLevel && !hideWebQQGroupLevel" class="chat-capsule-webqq__sender-badge is-level">{{ formatSenderLevel(message.senderLevel) }}</span>
                        <span class="chat-capsule-webqq__message-name">{{ message.senderName }}</span>
                        <span v-if="message.senderRelationship && showWebQQRelationship" class="chat-capsule-webqq__sender-badge is-relationship">{{ message.senderRelationship }}</span>
                      </template>
                      <template v-if="message.direction === 'incoming'">
                        <span class="chat-capsule-webqq__message-name">{{ message.senderName }}</span>
                        <span v-if="message.senderRelationship && showWebQQRelationship" class="chat-capsule-webqq__sender-badge is-relationship">{{ message.senderRelationship }}</span>
                        <span v-if="message.senderLevel && !hideWebQQGroupLevel" class="chat-capsule-webqq__sender-badge is-level">{{ formatSenderLevel(message.senderLevel) }}</span>
                        <span v-if="getSenderAuthorityText(message)" :class="['chat-capsule-webqq__sender-badge', getSenderAuthorityClass(message)]">{{ getSenderAuthorityText(message) }}</span>
                      </template>
                    </div>
                    <div class="chat-capsule-webqq__message-body">
                      <div v-if="isImageOnlyMessage(message)" class="chat-capsule-webqq__message-media">
                        <button class="chat-capsule-webqq__message-image" type="button" aria-label="查看大图" @click="openImagePreview(message.elements[0].url)">
                          <img :src="withProxy(message.elements[0].url)" alt="图片" @load="handleMessageImageLoad">
                        </button>
                      </div>
                      <div v-else class="chat-capsule-webqq__bubble">
                        <span v-if="isBotThinkingMessage(message)" class="chat-capsule-webqq__thinking-dots" aria-label="机器人正在思考">
                          <span v-for="dot in 3" :key="dot" class="chat-capsule-webqq__thinking-dot"></span>
                        </span>
                        <template v-else v-for="(run, runIndex) in getWebQQElementRuns(message.elements)" :key="`${message.id}:run:${runIndex}`">
                          <span v-if="run.type === 'inline'" class="chat-capsule-webqq__inline-run">
                            <template v-for="element in run.elements" :key="`${message.id}:inline:${runIndex}:${element.type}:${element.text || element.url || element.title || ''}`">
                              <span v-if="element.type === 'text'">{{ element.text }}</span>
                              <span v-else>{{ element.text || message.summary }}</span>
                            </template>
                          </span>
                          <div v-else-if="run.element.type === 'quote'" class="chat-capsule-webqq__quote">
                            <strong v-if="run.element.title" class="chat-capsule-webqq__quote-title">{{ run.element.title }}</strong>
                            <span>{{ run.element.text || '[引用消息]' }}</span>
                          </div>
                          <button
                            v-else-if="run.element.type === 'forward'"
                            class="chat-capsule-webqq__quote chat-capsule-webqq__forward"
                            type="button"
                            :disabled="!run.element.items?.length"
                            aria-label="查看合并转发消息"
                            @click.stop="openForwardDialog(run.element)"
                          >
                            <strong class="chat-capsule-webqq__quote-title">{{ run.element.title || '合并转发' }}</strong>
                            <template v-if="run.element.items?.length">
                              <span v-for="(item, itemIndex) in getForwardPreviewItems(run.element)" :key="`${message.id}:forward:${runIndex}:${itemIndex}`">
                                {{ getForwardItemName(item) }}：{{ getForwardPreviewText(item) }}
                              </span>
                              <span class="chat-capsule-webqq__forward-entry">查看{{ run.element.items.length }}条转发消息</span>
                            </template>
                            <span v-else>{{ run.element.text || '[合并转发]' }}</span>
                          </button>
                          <div
                            v-else-if="run.element.type === 'card'"
                            class="chat-capsule-webqq__card"
                          >
                            <img v-if="run.element.imageUrl" class="chat-capsule-webqq__card-cover" :src="withProxy(run.element.imageUrl)" alt="">
                            <span class="chat-capsule-webqq__card-content">
                              <strong class="chat-capsule-webqq__card-title">{{ run.element.title || '卡片消息' }}</strong>
                              <span v-if="run.element.text" class="chat-capsule-webqq__card-desc">{{ run.element.text }}</span>
                              <span v-if="run.element.source" class="chat-capsule-webqq__card-source">{{ run.element.source }}</span>
                            </span>
                          </div>
                          <button v-else-if="run.element.type === 'image' && run.element.url" class="chat-capsule-webqq__message-image" type="button" aria-label="查看大图" @click="openImagePreview(run.element.url)">
                            <img :src="withProxy(run.element.url)" alt="图片" @load="handleMessageImageLoad">
                          </button>
                          <span v-else>{{ run.element.text || message.summary }}</span>
                        </template>
                      </div>
                      <div class="chat-capsule-webqq__message-time">{{ formatTime(message.time) }}</div>
                    </div>
                  </div>
                </div>
                <div
                  v-if="getLastOutgoingClusterThinkingMessage(index)"
                  class="chat-capsule-webqq__thinking-row"
                >
                  <button
                    class="chat-capsule-webqq__thinking-toggle"
                    type="button"
                    :aria-expanded="isThinkingExpanded(getLastOutgoingClusterThinkingMessage(index))"
                    @click="toggleThinking(getLastOutgoingClusterThinkingMessage(index))"
                  >
                    <span
                      v-if="getLastOutgoingClusterThinkingMessage(index).thinking.usage"
                      class="chat-capsule-webqq__thinking-usage"
                      aria-label="本次 token 用量"
                    >
                      <svg class="chat-capsule-webqq__thinking-usage-icon is-input" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 20V8"></path>
                        <path d="m7 13 5-5 5 5"></path>
                        <path d="M5 4h14"></path>
                      </svg>
                      <span>{{ getLastOutgoingClusterThinkingMessage(index).thinking.usage.inputTokens }}</span>
                      <svg class="chat-capsule-webqq__thinking-usage-icon is-output" viewBox="0 0 24 24" aria-hidden="true">
                        <path d="M12 4v12"></path>
                        <path d="m7 11 5 5 5-5"></path>
                        <path d="M5 20h14"></path>
                      </svg>
                      <span>{{ getLastOutgoingClusterThinkingMessage(index).thinking.usage.outputTokens }}</span>
                    </span>
                    <span>{{ formatThinkingDuration(getLastOutgoingClusterThinkingMessage(index).thinking.durationMs) }}</span>
                    <svg class="chat-capsule-webqq__thinking-chevron" viewBox="0 0 16 16" aria-hidden="true">
                      <path d="M6 3.5 10.5 8 6 12.5"></path>
                    </svg>
                  </button>
                  <div
                    v-if="isThinkingExpanded(getLastOutgoingClusterThinkingMessage(index))"
                    class="chat-capsule-webqq__thinking-content"
                  >{{ getLastOutgoingClusterThinkingMessage(index).thinking.content }}</div>
                </div>
              </template>
            </template>
          </div>
          <Transition name="webqq-scroll-bottom">
            <button
              v-if="!trackingMessages && visibleMessages.length"
              class="chat-capsule-webqq__scroll-bottom"
              type="button"
              aria-label="返回底部"
              @click="returnMessagesToBottom"
            >
              <svg class="chat-capsule-webqq__scroll-bottom-icon" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M12 5v14"></path>
                <path d="m7 14 5 5 5-5"></path>
              </svg>
            </button>
          </Transition>
        </div>
      </div>
      <aside v-if="groupInfoOpen && currentChat?.type === 'group'" class="chat-capsule-webqq__group-info">
        <header class="chat-capsule-webqq__group-info-header">
          <strong>群信息</strong>
        </header>
        <div class="chat-capsule-webqq__group-info-body">
          <section class="chat-capsule-webqq__group-announcements">
            <h3>群公告</h3>
            <div v-if="groupInfoLoading" class="chat-capsule-webqq__group-empty">加载中</div>
            <div v-else-if="groupInfoErrorText" class="chat-capsule-webqq__group-empty is-error">{{ groupInfoErrorText }}</div>
            <div v-else-if="!groupInfo.announcements.length" class="chat-capsule-webqq__group-empty">暂无群公告</div>
            <article v-for="announcement in groupInfo.announcements" v-else :key="announcement.id" class="chat-capsule-webqq__group-announcement">
              <p>{{ announcement.content }}</p>
              <time v-if="announcement.time">{{ formatNoticeTime(announcement.time) }}</time>
            </article>
          </section>
          <section class="chat-capsule-webqq__group-members">
            <h3>群成员</h3>
            <input v-model="groupInfoSearchQuery" type="text" placeholder="搜索群昵称或 QQ 号">
            <div v-if="groupInfoLoading" class="chat-capsule-webqq__group-empty">加载中</div>
            <div v-else-if="groupInfoErrorText" class="chat-capsule-webqq__group-empty is-error">{{ groupInfoErrorText }}</div>
            <div v-else-if="!visibleGroupMembers.length" class="chat-capsule-webqq__group-empty">暂无群成员</div>
            <div v-else class="chat-capsule-webqq__group-member-list">
              <article v-for="member in visibleGroupMembers" :key="member.userId" class="chat-capsule-webqq__group-member">
                <img :src="withProxy(member.avatar)" :alt="getGroupMemberName(member)">
                <span>
                  <strong>{{ getGroupMemberName(member) }}</strong>
                  <small>{{ member.userId }}</small>
                </span>
                <em v-if="member.role">{{ member.role }}</em>
              </article>
            </div>
          </section>
        </div>
      </aside>
    </section>
    <div
      v-if="forwardDialog"
      class="chat-capsule-webqq__forward-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="合并转发消息"
      tabindex="0"
      @click.self="closeForwardDialog"
      @keydown.esc="closeForwardDialog"
    >
      <div class="chat-capsule-webqq__forward-modal" @click.stop>
        <header class="chat-capsule-webqq__forward-modal-header">
          <strong>{{ forwardDialog.title || '合并转发' }}</strong>
          <button type="button" aria-label="关闭合并转发消息" @click="closeForwardDialog">
            <svg class="chat-capsule-webqq__header-icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d="M6 6l12 12"></path>
              <path d="M18 6L6 18"></path>
            </svg>
          </button>
        </header>
        <div class="chat-capsule-webqq__forward-modal-body">
          <article v-for="(item, itemIndex) in forwardDialogItems" :key="`forward:${itemIndex}`" :class="['chat-capsule-webqq__message', 'is-incoming', getForwardItemClusterClass(itemIndex), { 'is-merged': isMergedForwardItem(itemIndex) }]">
            <img class="chat-capsule-webqq__message-avatar" :src="withProxy(getForwardItemAvatar(item))" :alt="getForwardItemName(item)">
            <div class="chat-capsule-webqq__message-content">
              <div v-if="!isMergedForwardItem(itemIndex)" class="chat-capsule-webqq__sender-line">
                <span class="chat-capsule-webqq__message-name">{{ getForwardItemName(item) }}</span>
              </div>
              <div class="chat-capsule-webqq__message-body">
                <div class="chat-capsule-webqq__bubble">
                  <template v-for="(run, runIndex) in getWebQQElementRuns(item.elements)" :key="`forward:${itemIndex}:run:${runIndex}`">
                    <span v-if="run.type === 'inline'" class="chat-capsule-webqq__inline-run">
                      <template v-for="element in run.elements" :key="`forward:${itemIndex}:inline:${runIndex}:${element.type}:${element.text || element.url || element.title || ''}`">
                        <span v-if="element.type === 'text'">{{ element.text }}</span>
                        <span v-else>{{ element.text || '[消息]' }}</span>
                      </template>
                    </span>
                    <div v-else-if="run.element.type === 'quote'" class="chat-capsule-webqq__quote">
                      <strong v-if="run.element.title" class="chat-capsule-webqq__quote-title">{{ run.element.title }}</strong>
                      <span>{{ run.element.text || '[引用消息]' }}</span>
                    </div>
                    <button
                      v-else-if="run.element.type === 'forward'"
                      class="chat-capsule-webqq__quote chat-capsule-webqq__forward"
                      type="button"
                      :disabled="!run.element.items?.length"
                      aria-label="查看合并转发消息"
                      @click.stop="openForwardDialog(run.element)"
                    >
                      <strong class="chat-capsule-webqq__quote-title">{{ run.element.title || '合并转发' }}</strong>
                      <span>{{ run.element.text || '[合并转发]' }}</span>
                    </button>
                    <div
                      v-else-if="run.element.type === 'card'"
                      class="chat-capsule-webqq__card"
                    >
                      <img v-if="run.element.imageUrl" class="chat-capsule-webqq__card-cover" :src="withProxy(run.element.imageUrl)" alt="">
                      <span class="chat-capsule-webqq__card-content">
                        <strong class="chat-capsule-webqq__card-title">{{ run.element.title || '卡片消息' }}</strong>
                        <span v-if="run.element.text" class="chat-capsule-webqq__card-desc">{{ run.element.text }}</span>
                        <span v-if="run.element.source" class="chat-capsule-webqq__card-source">{{ run.element.source }}</span>
                      </span>
                    </div>
                    <button v-else-if="run.element.type === 'image' && run.element.url" class="chat-capsule-webqq__message-image" type="button" aria-label="查看大图" @click="openImagePreview(run.element.url)">
                      <img :src="withProxy(run.element.url)" alt="图片" @load="handleMessageImageLoad">
                    </button>
                    <span v-else>{{ run.element.text || '[消息]' }}</span>
                  </template>
                </div>
              </div>
            </div>
          </article>
          <div v-if="!forwardDialogItems.length" class="chat-capsule-webqq__forward-modal-empty">暂无消息</div>
        </div>
      </div>
    </div>
    <div
      v-if="imagePreviewUrl"
      ref="imagePreview"
      class="chat-capsule-webqq__image-preview"
      role="dialog"
      aria-modal="true"
      aria-label="图片预览"
      tabindex="0"
      @click.stop.self="closeImagePreview"
      @keydown.esc="closeImagePreview"
    >
      <button class="chat-capsule-webqq__image-preview-close" type="button" aria-label="关闭图片预览" @click="closeImagePreview">
        <svg class="chat-capsule-webqq__header-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 6l12 12"></path>
          <path d="M18 6L6 18"></path>
        </svg>
      </button>
      <img :src="imagePreviewUrl" alt="图片预览">
    </div>
  </div>
</template>

<script lang="ts" setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { receive, send, withProxy } from '@koishijs/client'
import { capsule, hideWebQQGroupLevel, showWebQQAffinity, showWebQQRelationship, sortWebQQGroupMembers, useBotAvatarThemeColor, webQQAccentColor, webQQAvatarAccentColor, webQQChatStyle, webQQColorMode, webQQStorageBackend, webQQTheme, webQQTotalUnread } from './state'
import type { WebQQContacts, WebQQForwardItem, WebQQFriend, WebQQGroup, WebQQGroupInfo, WebQQGroupMember, WebQQLiveMessage, WebQQMessage, WebQQNotice } from './state'
import { applyCachedWebQQSenderMetadata, rememberWebQQSenderMetadata, type WebQQSenderMetadataCache } from './webqq-sender-metadata'
import {
  loadBrowserWebQQStoredState,
  loadCachedWebQQMessages as loadStoredWebQQMessages,
  loadRemoteWebQQStoredState as loadRemoteWebQQStoredStateFromBackend,
  persistWebQQStoredState,
  saveCachedWebQQMessages as saveStoredWebQQMessages,
  type ConversationSummary,
  type WebQQStoredState,
} from './stores/webqq-storage'
import {
  formatListTime,
  formatNoticeTime,
  formatSenderLevel,
  formatThinkingDuration,
  formatTime,
  getForwardItemAvatar as getForwardItemAvatarFromView,
  getForwardItemClusterClass as getForwardItemClusterClassFromView,
  getForwardItemName,
  getForwardPreviewItems as getForwardPreviewItemsFromView,
  getForwardPreviewText,
  getMessageClusterClass as getMessageClusterClassFromView,
  getUnreadText,
  getWebQQElementRuns,
  isImageOnlyMessage,
  isMergedForwardItem as isMergedForwardItemFromView,
  isMergedMessage as isMergedMessageFromView,
  type WebQQMessageElement,
} from './utils/webqq-message-view'
import {
  canHandleNotice,
  formatNoticeComment,
  getHandledNoticeStatusText,
  sortPendingNotices,
} from './utils/webqq-notice-view'

type ChatSelection =
  | { type: 'friend'; peerId: string; name: string; subtitle: string; avatar: string }
  | { type: 'group'; peerId: string; name: string; subtitle: string; avatar: string }

type RecentItem = ChatSelection & { summary?: string; time?: number }
type FriendCategoryView = { id: string; name: string; friends: WebQQFriend[] }
type WebQQThinkingMessage = WebQQMessage & { thinking: NonNullable<WebQQMessage['thinking']> }

const props = defineProps<{ visible: boolean }>()
const webQQContactsRetryLimit = 10
const webQQContactsRetryDelayMs = 800
const defaultWebQQForwardAvatar = 'https://q1.qlogo.cn/g?b=qq&nk=0&s=640'
const webQQForwardPreviewLimit = 4

const activeTab = ref<'recent' | 'friends' | 'groups'>('recent')
const searchQuery = ref('')
const contacts = ref<WebQQContacts>({ friends: [], groups: [] })
const currentChat = ref<ChatSelection>()
const conversationSummaries = ref<Record<string, ConversationSummary>>({})
const conversationUnreadCounts = ref<Record<string, number>>({})
const senderMetadataCache = ref<WebQQSenderMetadataCache>({})
const stored = loadBrowserWebQQStoredState(webQQStorageBackend.value)
conversationSummaries.value = stored.conversationSummaries
conversationUnreadCounts.value = stored.conversationUnreadCounts
const messages = ref<WebQQMessage[]>([])
const notices = ref<WebQQNotice[]>([])
const messagePane = ref<HTMLElement>()
const imagePreview = ref<HTMLElement>()
const imagePreviewUrl = ref('')
const forwardDialog = ref<WebQQMessageElement>()
const trackingMessages = ref(true)
const returningMessagesToBottom = ref(false)
const expandedThinkingMessageIds = ref(new Set<string>())
const historyLoading = ref(false)
const historyExhausted = ref(false)
const noticeOpen = ref(false)
const noticeMenuTab = ref<'friends' | 'groups'>('friends')
const noticeLoading = ref(false)
const handlingNoticeId = ref('')
const loading = ref(false)
const noticeErrorText = ref('')
const errorText = ref('')
const groupInfoOpen = ref(false)
const groupInfoLoading = ref(false)
const groupInfoErrorText = ref('')
const groupInfoSearchQuery = ref('')
const groupInfo = ref<WebQQGroupInfo>({ announcements: [], members: [] })

function createWebQQStoredState(): WebQQStoredState {
  return {
    conversationSummaries: conversationSummaries.value,
    conversationUnreadCounts: conversationUnreadCounts.value,
  }
}

function applyWebQQStoredState(stored: WebQQStoredState) {
  conversationSummaries.value = stored.conversationSummaries
  conversationUnreadCounts.value = stored.conversationUnreadCounts
}

function persistWebQQState() {
  persistWebQQStoredState(webQQStorageBackend.value, createWebQQStoredState())
}

async function loadRemoteWebQQStoredState() {
  const stored = await loadRemoteWebQQStoredStateFromBackend(webQQStorageBackend.value)
  if (stored) applyWebQQStoredState(stored)
}

async function loadCachedWebQQMessages(type: ChatSelection['type'], peerId: string) {
  return loadStoredWebQQMessages(type, peerId, webQQStorageBackend.value)
}

async function saveCachedWebQQMessages(type: ChatSelection['type'], peerId: string, messages: WebQQMessage[]) {
  await saveStoredWebQQMessages(type, peerId, messages, webQQStorageBackend.value)
}

function normalizeAccentColor(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color) ? color : '#2563eb'
}

function hexToRgba(color: string, opacity: number) {
  const normalized = normalizeAccentColor(color)
  const red = Number.parseInt(normalized.slice(1, 3), 16)
  const green = Number.parseInt(normalized.slice(3, 5), 16)
  const blue = Number.parseInt(normalized.slice(5, 7), 16)
  return `rgba(${red}, ${green}, ${blue}, ${opacity})`
}

const webQQEffectiveAccentColor = computed(() => {
  if (useBotAvatarThemeColor.value) {
    if (webQQAvatarAccentColor.value) return normalizeAccentColor(webQQAvatarAccentColor.value)
    return '#2563eb'
  }
  return normalizeAccentColor(webQQAccentColor.value)
})

const webQQAccentStyle = computed(() => ({
  '--chat-capsule-webqq-accent': webQQEffectiveAccentColor.value,
  '--chat-capsule-webqq-accent-soft': hexToRgba(webQQEffectiveAccentColor.value, 0.14),
  '--chat-capsule-webqq-accent-hover': hexToRgba(webQQEffectiveAccentColor.value, 0.18),
  '--chat-capsule-webqq-accent-shadow': hexToRgba(webQQEffectiveAccentColor.value, 0.24),
}))

const visibleFriends = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return contacts.value.friends
  return contacts.value.friends.filter((friend) => {
    return friend.name.toLowerCase().includes(query) ||
      friend.nickname.toLowerCase().includes(query) ||
      friend.userId.includes(searchQuery.value)
  })
})
const visibleGroups = computed(() => {
  const query = searchQuery.value.trim().toLowerCase()
  if (!query) return contacts.value.groups
  return contacts.value.groups.filter((group) => {
    return group.name.toLowerCase().includes(query) || group.groupId.includes(searchQuery.value)
  })
})
const visibleFriendCategories = computed<FriendCategoryView[]>(() => {
  const query = searchQuery.value.trim().toLowerCase()
  const categories = contacts.value.friendCategories?.length
    ? contacts.value.friendCategories
    : [{ id: 'all', name: '好友', friends: contacts.value.friends }]
  return categories.map((category) => ({
    id: category.id,
    name: category.name,
    friends: category.friends.filter((friend) => {
      if (!query) return true
      return friend.name.toLowerCase().includes(query) ||
        friend.nickname.toLowerCase().includes(query) ||
        friend.userId.includes(searchQuery.value)
    }),
  })).filter((category) => category.friends.length)
})
const recentItems = computed<RecentItem[]>(() => {
  const items = new Map<string, RecentItem>()
  for (const item of contacts.value.recent ?? []) {
    items.set(getChatKey(item.type, item.peerId), item)
  }
  for (const [key, summary] of Object.entries(conversationSummaries.value)) {
    const item = findContactByKey(key)
    if (!item) continue
    items.set(key, {
      ...item,
      summary: summary.summary,
      time: summary.time,
    })
  }
  return [...items.values()].sort((left, right) => (right.time || 0) - (left.time || 0))
})
const currentPeerId = computed(() => currentChat.value?.peerId)
const currentTitle = computed(() => currentChat.value?.name || 'WebQQ')
const currentSubtitle = computed(() => currentChat.value ? getChatSubtitle(currentChat.value) : '好友 / 群聊')
const currentAvatar = computed(() => currentChat.value?.avatar || '')
const totalUnreadCount = computed(() => Object.values(conversationUnreadCounts.value).reduce((sum, count) => sum + count, 0))
const filteredNotices = computed(() => {
  return sortPendingNotices(notices.value.filter((notice) => {
    return noticeMenuTab.value === 'friends'
      ? notice.type === 'friend-request'
      : notice.type === 'group-notice'
  }))
})
const visibleGroupMembers = computed(() => {
  const query = groupInfoSearchQuery.value.trim().toLowerCase()
  const members = query ? groupInfo.value.members.filter((member) => {
    return member.card.toLowerCase().includes(query) ||
      member.nickname.toLowerCase().includes(query) ||
      member.userId.includes(groupInfoSearchQuery.value)
  }) : groupInfo.value.members
  return sortWebQQGroupMembers(members)
})
const botThinkingMessage = computed<WebQQMessage | undefined>(() => {
  const conversation = capsule.value?.conversation
  const bot = capsule.value?.bot
  if (!currentChat.value || !conversation || !bot || conversation.activityText !== '正在思考') return
  const peerId = currentChat.value.type === 'group'
    ? conversation.channelId
    : conversation.userId || conversation.channelId
  if (peerId !== currentChat.value.peerId) return
  if (hasOutgoingMessageAfter(conversation.timestamp)) return
  const targetName = conversation.userName || currentChat.value.name
  return {
    id: `thinking:${currentChat.value.type}:${currentChat.value.peerId}:${conversation.timestamp}`,
    sequence: `thinking:${conversation.timestamp}`,
    time: conversation.timestamp,
    senderId: bot.selfId,
    senderName: bot.name || '机器人',
    senderAvatar: bot.avatar || (bot.selfId ? `https://q1.qlogo.cn/g?b=qq&nk=${bot.selfId}&s=640` : ''),
    senderRole: conversation.senderRole,
    senderLevel: conversation.senderLevel,
    senderTitle: conversation.senderTitle,
    direction: 'outgoing',
    summary: targetName ? `正在回复 ${targetName}` : '正在思考',
    elements: [{ type: 'unknown', text: '正在思考' }],
  }
})
const visibleMessages = computed(() => {
  const cachedMessages = messages.value.map(applyMessageSenderMetadata)
  return botThinkingMessage.value ? [...cachedMessages, applyMessageSenderMetadata(botThinkingMessage.value)] : cachedMessages
})
const forwardDialogItems = computed(() => forwardDialog.value?.items ?? [])

function getGroupSubtitle(group: WebQQGroup) {
  return `群聊 ${group.groupId} · ${group.memberCount} 人`
}

function selectTab(tab: 'recent' | 'friends' | 'groups') {
  activeTab.value = tab
  noticeOpen.value = false
}

function getChatSubtitle(chat: ChatSelection) {
  if (chat.type !== 'group') return chat.subtitle
  const group = contacts.value.groups.find((item) => item.groupId === chat.peerId)
  return group ? getGroupSubtitle(group) : chat.subtitle
}

function getChatKey(type: ChatSelection['type'], peerId: string) {
  return `${type}:${peerId}`
}

function findContactByKey(key: string): RecentItem | undefined {
  const [type, peerId] = key.split(':', 2)
  if (type === 'friend') {
    const friend = contacts.value.friends.find((item) => item.userId === peerId)
    if (!friend) return
    return {
      type: 'friend',
      peerId: friend.userId,
      name: friend.name,
      subtitle: friend.nickname,
      avatar: friend.avatar,
    }
  }
  if (type === 'group') {
    const group = contacts.value.groups.find((item) => item.groupId === peerId)
    if (!group) return
    return {
      type: 'group',
      peerId: group.groupId,
      name: group.name,
      subtitle: getGroupSubtitle(group),
      avatar: group.avatar,
    }
  }
}

function updateConversationSummary(type: ChatSelection['type'], peerId: string, message?: WebQQMessage) {
  if (!message) return
  conversationSummaries.value = {
    ...conversationSummaries.value,
    [getChatKey(type, peerId)]: {
      summary: message.summary,
      time: message.time,
    },
  }
  persistWebQQState()
}

function getContactSummary(type: ChatSelection['type'], peerId: string) {
  return conversationSummaries.value[getChatKey(type, peerId)]
}

function getContactSubtitle(type: ChatSelection['type'], peerId: string, fallback: string) {
  return getContactSummary(type, peerId)?.summary || fallback
}

function getContactTime(type: ChatSelection['type'], peerId: string, fallback = 0) {
  return getContactSummary(type, peerId)?.time || fallback
}

function getUnreadCount(type: ChatSelection['type'], peerId: string) {
  return conversationUnreadCounts.value[getChatKey(type, peerId)] || 0
}

function increaseUnreadCount(type: ChatSelection['type'], peerId: string) {
  const key = getChatKey(type, peerId)
  conversationUnreadCounts.value = {
    ...conversationUnreadCounts.value,
    [key]: getUnreadCount(type, peerId) + 1,
  }
  persistWebQQState()
}

function clearUnreadCount(type: ChatSelection['type'], peerId: string) {
  const key = getChatKey(type, peerId)
  if (!conversationUnreadCounts.value[key]) return
  const next = { ...conversationUnreadCounts.value }
  delete next[key]
  conversationUnreadCounts.value = next
  persistWebQQState()
}

function clearCurrentUnreadCount() {
  if (!currentChat.value) return
  clearUnreadCount(currentChat.value.type, currentChat.value.peerId)
}

function getMessageKey(message: WebQQMessage) {
  return message.id || message.sequence || `${message.senderId}:${message.time}:${message.summary}`
}

function mergeWebQQMessage(current: WebQQMessage | undefined, next: WebQQMessage) {
  if (!current) return next
  if (!next.thinking && !current.thinking) return { ...current, ...next }
  return {
    ...current,
    ...next,
    thinking: next.thinking || current.thinking,
  }
}

function rememberMessageSenderMetadata(type: ChatSelection['type'], peerId: string, nextMessages: WebQQMessage[]) {
  senderMetadataCache.value = rememberWebQQSenderMetadata(senderMetadataCache.value, type, peerId, nextMessages)
}

function applyMessageSenderMetadata(message: WebQQMessage) {
  if (!currentChat.value) return message
  return applyCachedWebQQSenderMetadata(senderMetadataCache.value, currentChat.value.type, currentChat.value.peerId, message)
}

function isBotThinkingMessage(message: WebQQMessage) {
  return message.id === botThinkingMessage.value?.id
}

function isThinkingExpanded(message: WebQQMessage) {
  return expandedThinkingMessageIds.value.has(getMessageKey(message))
}

function toggleThinking(message: WebQQMessage) {
  const key = getMessageKey(message)
  const next = new Set(expandedThinkingMessageIds.value)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  expandedThinkingMessageIds.value = next
}

function isSameOutgoingClusterMessage(left: WebQQMessage | undefined, right: WebQQMessage | undefined) {
  return !!left &&
    !!right &&
    left.direction === 'outgoing' &&
    right.direction === 'outgoing' &&
    left.senderId === right.senderId
}

function getLastOutgoingClusterThinkingMessage(index: number): WebQQThinkingMessage | undefined {
  const message = visibleMessages.value[index]
  if (!message || message.direction !== 'outgoing') return
  if (isSameOutgoingClusterMessage(message, visibleMessages.value[index + 1])) return
  for (let cursor = index; cursor >= 0; cursor--) {
    const candidate = visibleMessages.value[cursor]
    if (!candidate) break
    if (!isSameOutgoingClusterMessage(message, candidate)) break
    if (candidate.thinking?.content) return {
      ...candidate,
      thinking: candidate.thinking,
    }
  }
}

function hasOutgoingMessageAfter(timestamp: number) {
  return messages.value.some((message) => message.direction === 'outgoing' && message.time >= timestamp)
}

function getForwardItemAvatar(item: WebQQForwardItem) {
  return getForwardItemAvatarFromView(item, defaultWebQQForwardAvatar)
}

function getForwardPreviewItems(element: WebQQMessageElement) {
  return getForwardPreviewItemsFromView(element, webQQForwardPreviewLimit)
}

function isMergedForwardItem(index: number) {
  return isMergedForwardItemFromView(forwardDialogItems.value, index, webQQChatStyle.value)
}

function getForwardItemClusterClass(index: number) {
  return getForwardItemClusterClassFromView(forwardDialogItems.value, index, webQQChatStyle.value)
}

function isMergedMessage(index: number) {
  return isMergedMessageFromView(messages.value, index, webQQChatStyle.value)
}

function getMessageClusterClass(index: number) {
  return getMessageClusterClassFromView(messages.value, index, webQQChatStyle.value)
}

function appendMessage(message: WebQQMessage) {
  messages.value = mergeMessages(messages.value, [message])
  if (trackingMessages.value) scrollMessagesToBottom()
}

function mergeMessages(currentMessages: WebQQMessage[], nextMessages: WebQQMessage[]) {
  const merged = new Map(currentMessages.map((item) => [getMessageKey(item), item]))
  for (const message of nextMessages) {
    const key = getMessageKey(message)
    merged.set(key, mergeWebQQMessage(merged.get(key), message))
  }
  return [...merged.values()].sort((a, b) => a.time - b.time)
}

function isMessagePaneAtBottom() {
  const pane = messagePane.value
  if (!pane) return true
  return pane.scrollHeight - pane.scrollTop - pane.clientHeight <= 8
}

function updateMessageTracking() {
  const atBottom = isMessagePaneAtBottom()
  if (returningMessagesToBottom.value) {
    trackingMessages.value = true
    if (atBottom) returningMessagesToBottom.value = false
    if (atBottom) clearCurrentUnreadCount()
    return
  }
  trackingMessages.value = atBottom
  if (trackingMessages.value) clearCurrentUnreadCount()
  if (shouldLoadOlderMessages()) loadOlderMessages()
}

function handleMessageImageLoad() {
  if (trackingMessages.value) scrollMessagesToBottom()
}

// 打开结构化合并转发浮层，按 LLBot 的 modal 方式展示详情。
function openForwardDialog(element: WebQQMessageElement) {
  if (!element.items?.length) return
  noticeOpen.value = false
  forwardDialog.value = element
}

// 清空合并转发浮层，恢复当前聊天面板。
function closeForwardDialog() {
  forwardDialog.value = undefined
}

// 打开图片预览并把焦点移到遮罩，便于使用 Esc 关闭。
async function openImagePreview(url: string) {
  imagePreviewUrl.value = withProxy(url)
  await nextTick()
  imagePreview.value?.focus()
}

// 清空当前预览图，恢复聊天窗口交互。
function closeImagePreview() {
  imagePreviewUrl.value = ''
}

async function scrollMessagesToBottom(behavior: ScrollBehavior = 'auto') {
  await nextTick()
  const pane = messagePane.value
  if (!pane) return
  pane.scrollTo({
    top: pane.scrollHeight,
    behavior,
  })
}

function returnMessagesToBottom() {
  returningMessagesToBottom.value = true
  trackingMessages.value = true
  scrollMessagesToBottom('smooth')
}

function waitWebQQContactsRetry() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, webQQContactsRetryDelayMs)
  })
}

async function requestWebQQContacts() {
  return await send('chat-capsule/webqq/contacts') as WebQQContacts || { friends: [], groups: [] }
}

async function loadContacts() {
  loading.value = true
  errorText.value = ''
  try {
    for (let attempt = 1; attempt <= webQQContactsRetryLimit; attempt++) {
      try {
        contacts.value = await requestWebQQContacts()
        return
      } catch (error) {
        if (attempt === webQQContactsRetryLimit) throw error
        await waitWebQQContactsRetry()
      }
    }
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '加载联系人失败'
  } finally {
    loading.value = false
  }
}

async function loadNotices() {
  noticeLoading.value = true
  noticeErrorText.value = ''
  try {
    notices.value = await send('chat-capsule/webqq/notices') as WebQQNotice[] || []
  } catch (error) {
    noticeErrorText.value = error instanceof Error ? error.message : '加载通知失败'
  } finally {
    noticeLoading.value = false
  }
}

function openNotices() {
  noticeOpen.value = !noticeOpen.value
  if (noticeOpen.value) loadNotices()
}

function closeNoticeMenu() {
  noticeOpen.value = false
  closeForwardDialog()
}

async function loadGroupInfo() {
  if (currentChat.value?.type !== 'group') return
  groupInfoLoading.value = true
  groupInfoErrorText.value = ''
  try {
    groupInfo.value = await send('chat-capsule/webqq/group-info', {
      groupId: currentChat.value.peerId,
    }) as WebQQGroupInfo || { announcements: [], members: [] }
  } catch (error) {
    groupInfoErrorText.value = error instanceof Error ? error.message : '加载群信息失败'
  } finally {
    groupInfoLoading.value = false
  }
}

function toggleGroupInfo() {
  groupInfoOpen.value = !groupInfoOpen.value
  if (groupInfoOpen.value) loadGroupInfo()
}

async function loadMessages() {
  if (!currentChat.value) return
  trackingMessages.value = true
  historyExhausted.value = false
  loading.value = true
  errorText.value = ''
  try {
    const cachedMessages = await loadCachedWebQQMessages(currentChat.value.type, currentChat.value.peerId)
    messages.value = cachedMessages
    messages.value = await send('chat-capsule/webqq/messages', {
      type: currentChat.value.type,
      peerId: currentChat.value.peerId,
    }) as WebQQMessage[] || []
    messages.value = mergeMessages(cachedMessages, messages.value)
    rememberMessageSenderMetadata(currentChat.value.type, currentChat.value.peerId, messages.value)
    updateConversationSummary(currentChat.value.type, currentChat.value.peerId, messages.value[messages.value.length - 1])
    await saveCachedWebQQMessages(currentChat.value.type, currentChat.value.peerId, messages.value)
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '加载聊天历史失败'
  } finally {
    loading.value = false
  }
  if (!errorText.value && trackingMessages.value) await scrollMessagesToBottom()
}

function shouldLoadOlderMessages() {
  const pane = messagePane.value
  return !!currentChat.value &&
    !!pane &&
    pane.scrollTop <= 8 &&
    messages.value.length > 0 &&
    !historyLoading.value &&
    !historyExhausted.value
}

async function loadOlderMessages() {
  if (!currentChat.value || historyLoading.value || historyExhausted.value) return
  const pane = messagePane.value
  const previousScrollHeight = pane?.scrollHeight ?? 0
  const previousCount = messages.value.length
  historyLoading.value = true
  try {
    const olderMessages = await send('chat-capsule/webqq/messages', {
      type: currentChat.value.type,
      peerId: currentChat.value.peerId,
      beforeSequence: messages.value[0]?.sequence,
    }) as WebQQMessage[] || []
    rememberMessageSenderMetadata(currentChat.value.type, currentChat.value.peerId, olderMessages)
    messages.value = mergeMessages(olderMessages, messages.value)
    updateConversationSummary(currentChat.value.type, currentChat.value.peerId, messages.value[messages.value.length - 1])
    await saveCachedWebQQMessages(currentChat.value.type, currentChat.value.peerId, messages.value)
    historyExhausted.value = messages.value.length === previousCount
    await nextTick()
    if (pane) pane.scrollTop = pane.scrollHeight - previousScrollHeight
  } catch (error) {
    errorText.value = error instanceof Error ? error.message : '加载更早聊天历史失败'
  } finally {
    historyLoading.value = false
  }
}

function selectFriend(friend: WebQQFriend) {
  noticeOpen.value = false
  groupInfoOpen.value = false
  currentChat.value = {
    type: 'friend',
    peerId: friend.userId,
    name: friend.name,
    subtitle: friend.nickname,
    avatar: friend.avatar,
  }
  clearCurrentUnreadCount()
  loadMessages()
}

function selectGroup(group: WebQQGroup) {
  noticeOpen.value = false
  currentChat.value = {
    type: 'group',
    peerId: group.groupId,
    name: group.name,
    subtitle: getGroupSubtitle(group),
    avatar: group.avatar,
  }
  clearCurrentUnreadCount()
  loadMessages()
}

function selectRecent(item: RecentItem) {
  noticeOpen.value = false
  if (item.type !== 'group') groupInfoOpen.value = false
  currentChat.value = {
    type: item.type,
    peerId: item.peerId,
    name: item.name,
    subtitle: item.subtitle,
    avatar: item.avatar,
  }
  clearCurrentUnreadCount()
  loadMessages()
}

function getGroupMemberName(member: WebQQGroupMember) {
  return member.card || member.nickname || member.userId
}

async function handleNotice(notice: WebQQNotice, approve: boolean) {
  if (!notice.flag) return
  handlingNoticeId.value = notice.id
  noticeErrorText.value = ''
  try {
    await send('chat-capsule/webqq/notice-action', {
      id: notice.id,
      type: notice.type,
      flag: notice.flag,
      subType: notice.subType,
      approve,
    })
    await loadNotices()
  } catch (error) {
    noticeErrorText.value = error instanceof Error ? error.message : '处理通知失败'
  } finally {
    handlingNoticeId.value = ''
  }
}

function getSenderAuthorityText(message: WebQQMessage) {
  return message.senderTitle || message.senderRole || ''
}

function getSenderAuthorityClass(message: WebQQMessage) {
  if (message.senderRole === '群主') return 'is-owner'
  if (message.senderRole === '管理员') return 'is-admin'
  return 'is-title'
}

async function saveLiveWebQQMessage(payload: WebQQLiveMessage) {
  const cachedMessages = await loadCachedWebQQMessages(payload.type, payload.peerId)
  await saveCachedWebQQMessages(payload.type, payload.peerId, mergeMessages(cachedMessages, [payload.message]))
}

receive('chat-capsule/webqq/message', (payload: WebQQLiveMessage) => {
  rememberMessageSenderMetadata(payload.type, payload.peerId, [payload.message])
  updateConversationSummary(payload.type, payload.peerId, payload.message)
  if (
    currentChat.value?.type !== payload.type ||
    currentChat.value.peerId !== payload.peerId
  ) {
    if (payload.message.direction === 'incoming') increaseUnreadCount(payload.type, payload.peerId)
    saveLiveWebQQMessage(payload).catch(() => {})
    return
  }
  if (
    payload.message.direction === 'incoming' &&
    (!props.visible || !trackingMessages.value)
  ) increaseUnreadCount(payload.type, payload.peerId)
  appendMessage(payload.message)
  saveCachedWebQQMessages(payload.type, payload.peerId, messages.value).catch(() => {})
})

watch(() => props.visible, (visible) => {
  if (!visible) return
  clearCurrentUnreadCount()
  if (trackingMessages.value) scrollMessagesToBottom()
})

watch(totalUnreadCount, (count) => {
  webQQTotalUnread.value = count
}, { immediate: true })

watch(() => botThinkingMessage.value, (message) => {
  if (message && currentChat.value) rememberMessageSenderMetadata(currentChat.value.type, currentChat.value.peerId, [message])
  if (trackingMessages.value) scrollMessagesToBottom()
})

watch(() => currentChat.value?.peerId, () => {
  groupInfoSearchQuery.value = ''
  if (currentChat.value?.type !== 'group') {
    groupInfoOpen.value = false
    return
  }
  if (groupInfoOpen.value) loadGroupInfo()
})

onMounted(async () => {
  await loadRemoteWebQQStoredState()
  await loadContacts()
})
</script>
