import { type FunctionalComponent } from "preact"
import { useState, useRef, useEffect } from "preact/hooks"
import { Button } from "../components/button"
import { cn } from "../lib/utils"
import { compressImage } from "../../lib/image"
import { getShowImages } from "../../db/db"
import type { Message, Friend, Conversation } from "../../types"

interface Props {
  conversation: Conversation | null
  messages: Message[]
  friends: Friend[]
  generatingIds: Set<string>
  isWaiting?: boolean
  onSend: (content: string, images: string[]) => void
  onTyping?: () => void
  onShowDetail?: (friendId: string) => void
  onLoadMore?: (limit: number, offset: number) => void
  onRetry?: () => void
  disabled?: boolean
  onOpenSidebar: () => void
}

export const ChatArea: FunctionalComponent<Props> = ({
  conversation, messages, friends, generatingIds, isWaiting, onSend, onTyping, onShowDetail, onLoadMore, onRetry, disabled, onOpenSidebar
}) => {
  const [text, setText] = useState("")
  const [images, setImages] = useState<string[]>([])
  const [offset, setOffset] = useState(0)
  const [previewIndex, setPreviewIndex] = useState<number | null>(null)
  const showImages = getShowImages()
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setOffset(0)
  }, [conversation?.id])

  useEffect(() => {
    if (offset === 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" })
    }
  }, [messages.length])

  const adjustTextareaHeight = () => {
    const ta = textareaRef.current
    if (!ta) return
    ta.style.height = 'auto'
    const lineHeight = 20
    const maxLines = 5
    const maxHeight = lineHeight * maxLines
    ta.style.height = Math.min(ta.scrollHeight, maxHeight) + 'px'
  }

  useEffect(() => {
    adjustTextareaHeight()
  }, [text])

  const handleSend = () => {
    if ((!text.trim() && images.length === 0) || disabled) return
    onSend(text.trim(), images)
    setText("")
    setImages([])
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFiles = async (e: Event) => {
    const files = (e.target as HTMLInputElement).files
    if (!files) return
    const fileArr = Array.from(files).slice(0, 4 - images.length)
    for (const file of fileArr) {
      const result = await compressImage(file)
      setImages(prev => [...prev, result.base64])
    }
    ;(e.target as HTMLInputElement).value = ''
  }

  const handleLoadMore = () => {
    const nextOffset = offset + 20
    setOffset(nextOffset)
    if (onLoadMore) onLoadMore(20, nextOffset)
  }

  const getTitle = (): string => {
    if (!conversation) return 'AI 朋友'
    if (conversation.name) return conversation.name
    if (conversation.type === 'private') {
      return friends.find(f => f.id === conversation.friendIds[0])?.name || '聊天'
    }
    return `群聊 (${conversation.friendIds.length}人)`
  }

  const getTitleAvatar = (): string | null => {
    if (!conversation) return null
    if (conversation.type === 'private') {
      return friends.find(f => f.id === conversation.friendIds[0])?.avatar || null
    }
    return null
  }

  const handleTitleClick = () => {
    if (conversation?.type === 'private' && onShowDetail) {
      onShowDetail(conversation.friendIds[0])
    }
  }

  return (
    <div class="h-full flex flex-col bg-background">
      <header class="flex-shrink-0 h-12 px-3 flex items-center gap-2 border-b border-border">
        <button class="lg:hidden text-xl text-muted hover:text-white" onClick={onOpenSidebar}>☰</button>
        {conversation && getTitleAvatar() && (
          <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
            <img src={getTitleAvatar()!} alt={getTitle()} class="w-full h-full object-cover" />
          </div>
        )}
        <h1 
          class={cn("font-semibold truncate", conversation?.type === 'private' && "cursor-pointer hover:text-accent")} 
          onClick={handleTitleClick}
        >
          {getTitle()}
        </h1>
      </header>

      <div class="flex-1 overflow-auto p-4 pb-20 lg:pb-4 space-y-3">
        {conversation && messages.length >= 20 && (
          <div class="text-center py-2">
            <button onClick={handleLoadMore} class="text-xs text-accent hover:underline">查看更多历史消息</button>
          </div>
        )}

        {!conversation ? (
          <div class="h-full flex items-center justify-center text-muted">
            <div class="text-center"><div class="text-4xl mb-2">💬</div><p>选择一个会话开始聊天</p></div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.senderId === 'user'
            const friend = friends.find(f => f.id === msg.senderId)
            const isTyping = generatingIds.has(msg.senderId)

            return (
              <div key={msg.id} class={cn("flex gap-2 group", isUser && "flex-row-reverse")}>
                <div class={cn("w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm overflow-hidden", isUser ? "bg-accent text-white" : "bg-surface-hover")}>
                  {isUser ? '我' : friend?.avatar ? <img src={friend.avatar} alt={friend.name} class="w-full h-full object-cover" /> : (friend?.name || '友').charAt(0)}
                </div>
                <div class={cn("max-w-[75%] rounded-2xl px-3 py-2 relative", isUser ? "bg-accent text-white rounded-tr-sm" : "bg-surface-hover rounded-tl-sm")}>
                  {!isUser && (
                    <div class="text-xs text-muted mb-1 flex items-center gap-2">
                      {friend?.name || msg.senderName}
                      {isTyping && <span class="text-accent animate-pulse">输入中...</span>}
                    </div>
                  )}
                  {msg.images && msg.images.length > 0 && showImages && (
                    <div class="flex flex-wrap gap-1 mb-1">
                      {msg.images.map((img, i) => (
                        <img key={i} src={img} class="max-w-[120px] max-h-[120px] rounded cursor-pointer" onClick={() => setPreviewIndex(i)} />
                      ))}
                    </div>
                  )}
                  {msg.content && <p class="text-sm whitespace-pre-wrap">{msg.content}</p>}
                  
                  {isUser && onRetry && (
                    <button 
                      onClick={onRetry} 
                      class="absolute -left-10 top-1/2 -translate-y-1/2 p-2 text-muted opacity-0 group-hover:opacity-100 hover:text-accent transition-all text-lg"
                      title="重试 AI 响应"
                    >
                      🔄
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
        
        {generatingIds.size > 0 && (
          <div class="text-center text-muted text-sm italic">
            {[...generatingIds].map(id => friends.find(f => f.id === id)?.name).filter(Boolean).join('、')} 正在回复...
          </div>
        )}
        {isWaiting && <div class="text-center text-muted text-sm italic">等待更多输入... (3秒后回复)</div>}
        <div ref={bottomRef} />
      </div>

      {images.length > 0 && (
        <div class="fixed lg:relative bottom-[72px] lg:bottom-auto left-0 right-0 lg:left-auto lg:right-auto z-10 lg:z-auto px-3 pt-2 pb-2 lg:pb-0 flex gap-2 flex-wrap border-t border-border bg-background lg:bg-transparent lg:flex-shrink-0">
          {images.map((img, i) => (
            <div key={i} class="relative group">
              <img src={img} class="w-16 h-16 object-cover rounded border border-border" />
              <button
                onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                class="absolute -top-1 -right-1 w-5 h-5 bg-danger text-white rounded-full text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
              >×</button>
            </div>
          ))}
          <button
            onClick={() => setImages([])}
            class="w-16 h-16 flex items-center justify-center border border-dashed border-border rounded text-muted text-xs hover:border-accent hover:text-accent transition-colors"
          >清除全部</button>
        </div>
      )}

      <div class="fixed lg:relative bottom-0 left-0 right-0 lg:left-auto lg:right-auto z-10 lg:z-auto p-3 border-t border-border bg-background lg:bg-transparent flex gap-2 items-end">
        <input ref={fileRef} type="file" accept="image/*" multiple class="hidden" onChange={handleFiles} />
        <Button variant="outline" size="icon" onClick={() => fileRef.current?.click()} disabled={images.length >= 4}>🖼</Button>
        <textarea
          ref={textareaRef}
          value={text}
          onInput={e => {
            setText((e.target as HTMLTextAreaElement).value)
            if (onTyping) onTyping()
          }}
          onKeyDown={handleKey}
          placeholder="输入消息..."
          rows={1}
          class="flex-1 px-3 py-2 rounded-2xl border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent resize-none overflow-hidden leading-5"
          style={{ maxHeight: '100px' }}
        />
        <Button onClick={handleSend} disabled={!text.trim() && images.length === 0}>发送</Button>
      </div>

      {previewIndex !== null && (
        <div class="fixed inset-0 z-50 bg-black/90 flex items-center justify-center" onClick={() => setPreviewIndex(null)}>
          <img src={messages.flatMap(m => m.images || [])[previewIndex]} class="max-w-full max-h-full" />
        </div>
      )}
    </div>
  )
}
