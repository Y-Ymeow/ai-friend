import { useState, useEffect, useCallback } from "preact/hooks"
import { initDb } from "./db/db"
import {
  friends, conversations, currentConversationId, messages,
  refreshAll, createFriend, startPrivateChat, createGroupChat,
  selectConversation, sendUserMessage, resetAllData,
  deleteFriend, deleteConversation,
  isGenerating, generatingFriendIds, isWaiting, notifyTyping,
  startAppServices, retryAIResponse, refreshMessages,
  deleteMessage, clearChat
} from "./store"
import { navigate, currentPage, routeParams, initRouter } from "./router"
import { Sidebar } from "./ui/components/sidebar"
import { ChatArea } from "./ui/components/chat-area"
import { AddFriendDialog } from "./ui/components/add-friend-dialog"
import { CreateGroupDialog } from "./ui/components/create-group-dialog"
import { SettingsPage } from "./ui/pages/settings"
import { FriendDetailPage } from "./ui/pages/friend-detail"

export function App() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddFriend, setShowAddFriend] = useState(false)
  const [showCreateGroup, setShowCreateGroup] = useState(false)
  const [showSidebar, setShowSidebar] = useState(false)

  useEffect(() => {
    initDb().then(() => {
      initRouter()
      refreshAll()
      startAppServices()
      setLoading(false)
    }).catch(err => {
      console.error(err)
      setError(err.message || "初始化失败")
      setLoading(false)
    })
  }, [])

  useEffect(() => {
    if (currentPage.value === 'chat' && routeParams.value.id) {
      selectConversation(routeParams.value.id)
    }
  }, [currentPage.value, routeParams.value.id])

  const handleAddFriend = useCallback((data: { 
    name: string
    personality: string
    gender?: "female" | "male" | "other"
    height?: number
    weight?: number
    age?: number
  }) => {
    createFriend({
      id: `friend_${Date.now()}`,
      name: data.name,
      personality: data.personality,
      gender: data.gender,
      height: data.height,
      weight: data.weight,
      age: data.age,
    })
    setShowAddFriend(false)
  }, [])

  const handleStartChat = useCallback((friendId: string) => {
    const convId = startPrivateChat(friendId)
    if (convId) navigate('chat', { id: convId })
    setShowSidebar(false)
  }, [])

  const handleSelectConv = useCallback((id: string) => {
    if (id) {
      selectConversation(id)
      navigate('chat', { id })
    }
    setShowSidebar(false)
  }, [])

  const handleCreateGroup = useCallback((name: string, friendIds: string[]) => {
    const convId = createGroupChat(name, friendIds)
    setShowCreateGroup(false)
    if (convId) navigate('chat', { id: convId })
    setShowSidebar(false)
  }, [])

  const handleDeleteFriend = useCallback((id: string) => {
    if (confirm('确定删除该好友？相关会话也会被删除。')) deleteFriend(id)
  }, [])

  const handleDeleteConv = useCallback((id: string) => {
    if (confirm('确定删除该会话？')) {
      deleteConversation(id)
      if (currentConversationId.value === id) {
        currentConversationId.value = null
        navigate('home')
      }
    }
  }, [])

  const handleSend = useCallback(async (content: string, images: string[]) => {
    const errors = await sendUserMessage(content, images)
    if (errors.length > 0) {
      setError(errors.join('\n'))
      setTimeout(() => setError(null), 3000)
    }
  }, [])

  const handleDeleteMessage = useCallback((msgId: string) => {
    deleteMessage(msgId)
  }, [])

  const handleClearChat = useCallback(() => {
    if (currentConversationId.value) {
      clearChat(currentConversationId.value)
    }
  }, [])

  const handleRetry = useCallback(() => {
    retryAIResponse()
  }, [])

  const handleReset = useCallback(() => {
    resetAllData()
    navigate('home')
  }, [])

  if (loading) {
    return <div class="h-dvh flex items-center justify-center bg-background text-muted">加载中...</div>
  }

  if (currentPage.value === 'settings') {
    return <div class="h-dvh bg-background"><SettingsPage onBack={() => navigate('home')} onReset={handleReset} /></div>
  }

  if (currentPage.value === 'friend-detail' && routeParams.value.id) {
    return <div class="h-dvh bg-background"><FriendDetailPage friendId={routeParams.value.id} onBack={() => navigate('chat', { id: currentConversationId.value || "" })} /></div>
  }

  const currentConv = conversations.value.find(c => c.id === currentConversationId.value)
  const sidebarProps = {
    friends: friends.value,
    conversations: conversations.value,
    currentConvId: currentConversationId.value,
    onSelectConv: handleSelectConv,
    onStartChat: handleStartChat,
    onShowFriendDetail: (id: string) => navigate('friend-detail', { id }),
    onDeleteConv: handleDeleteConv,
    onDeleteFriend: handleDeleteFriend,
    onAddFriend: () => setShowAddFriend(true),
    onCreateGroup: () => setShowCreateGroup(true),
    onSettings: () => navigate('settings'),
  }

  return (
    <div class="h-dvh flex bg-background">
      {error && (
        <div class="fixed top-0 left-0 right-0 z-50 bg-danger/20 text-danger px-4 py-2 text-sm text-center">
          {error} <button class="ml-2 underline" onClick={() => setError(null)}>关闭</button>
        </div>
      )}
      <div class="hidden lg:block w-64 flex-shrink-0"><Sidebar {...sidebarProps} /></div>
      {showSidebar && <div class="lg:hidden fixed inset-0 z-40 bg-black/50" onClick={() => setShowSidebar(false)} />}
      <div class={`lg:hidden fixed left-0 top-0 bottom-0 z-50 w-64 transition-transform ${showSidebar ? 'translate-x-0' : '-translate-x-full'}`}><Sidebar {...sidebarProps} /></div>
      <div class="flex-1 min-w-0">
        <ChatArea
          conversation={currentConv || null}
          messages={messages.value}
          friends={friends.value}
          generatingIds={generatingFriendIds.value}
          isWaiting={isWaiting.value}
          onSend={handleSend}
          onTyping={notifyTyping}
          onShowDetail={(id) => navigate('friend-detail', { id })}
          onLoadMore={(limit, offset) => refreshMessages(limit, offset)}
          onRetry={handleRetry}
          onDeleteMessage={handleDeleteMessage}
          onClearChat={handleClearChat}
          disabled={isGenerating.value}
          onOpenSidebar={() => setShowSidebar(true)}
        />
      </div>
      <AddFriendDialog open={showAddFriend} onClose={() => setShowAddFriend(false)} onAdd={handleAddFriend} />
      <CreateGroupDialog open={showCreateGroup} friends={friends.value} preSelectedIds={[]} onClose={() => setShowCreateGroup(false)} onCreate={handleCreateGroup} />
    </div>
  )
}
