import { type FunctionalComponent } from "preact";
import { useState, useRef, useEffect } from "preact/hooks";
import { Button } from "../components/button";
import { cn } from "../lib/utils";
import { compressImage } from "../../lib/image";
import { getShowImages, getAppConfig, setAppConfig } from "../../db/db";
import type { Message, Friend, Conversation } from "../../types";

interface Props {
  conversation: Conversation | null;
  messages: Message[];
  friends: Friend[];
  generatingIds: Set<string>;
  isWaiting?: boolean;
  onSend: (content: string, images: string[]) => void;
  onTyping?: () => void;
  onShowDetail?: (friendId: string) => void;
  onLoadMore?: (limit: number, offset: number) => void;
  onRetry?: () => void;
  onDeleteMessage?: (msgId: string) => void;
  onClearChat?: () => void;
  disabled?: boolean;
  onOpenSidebar: () => void;
}

export const ChatArea: FunctionalComponent<Props> = ({
  conversation,
  messages,
  friends,
  generatingIds,
  isWaiting,
  onSend,
  onTyping,
  onShowDetail,
  onLoadMore,
  onRetry,
  onDeleteMessage,
  onClearChat,
  disabled,
  onOpenSidebar,
}) => {
  const [text, setText] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [offset, setOffset] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiImageGen, setAiImageGen] = useState(
    getAppConfig().imageGenerationEnabled,
  );
  const [showActionMenu, setShowActionMenu] = useState<string | null>(null);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const showImages = getShowImages();
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setOffset(0);
  }, [conversation?.id]);

  useEffect(() => {
    if (offset === 0) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages.length]);

  // 同步 AI 生图状态到全局配置
  const toggleAiImageGen = () => {
    const newVal = !aiImageGen;
    setAiImageGen(newVal);
    const config = getAppConfig();
    setAppConfig({ ...config, imageGenerationEnabled: newVal });
  };

  const handleSend = () => {
    if ((!text.trim() && images.length === 0) || disabled) return;
    onSend(text.trim(), images);
    setText("");
    setImages([]);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKey = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFiles = async (e: Event) => {
    const files = (e.target as HTMLInputElement).files;
    if (!files) return;
    const fileArr = Array.from(files).slice(0, 4 - images.length);
    for (const file of fileArr) {
      const result = await compressImage(file);
      setImages((prev) => [...prev, result.base64]);
    }
    (e.target as HTMLInputElement).value = "";
  };

  // 长按开始（手机端）
  const handleLongPressStart = (msgId: string) => {
    const timer = setTimeout(() => {
      setShowActionMenu(msgId === showActionMenu ? null : msgId);
    }, 500);
    setLongPressTimer(timer);
  };

  // 长按结束（手机端）
  const handleLongPressEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const getTitle = (): string => {
    if (!conversation) return "AI 朋友";
    if (conversation.name) return conversation.name;
    if (conversation.type === "private") {
      return (
        friends.find((f) => f.id === conversation.friendIds[0])?.name || "聊天"
      );
    }
    return `群聊 (${conversation.friendIds.length}人)`;
  };

  const getTitleAvatar = (): string | null => {
    if (!conversation) return null;
    if (conversation.type === "private") {
      return (
        friends.find((f) => f.id === conversation.friendIds[0])?.avatar || null
      );
    }
    return null;
  };

  return (
    <div class="h-dvh flex flex-col bg-background">
      <header class="fixed lg:relative top-0 left-0 right-0 lg:left-auto lg:right-auto lg:top-auto z-20 h-12 px-3 flex items-center justify-between border-b border-border bg-background">
        <div class="flex items-center gap-2">
          <button
            class="lg:hidden text-xl text-muted hover:text-white"
            onClick={onOpenSidebar}
          >
            ☰
          </button>
          {conversation && getTitleAvatar() && (
            <div class="w-8 h-8 rounded-full overflow-hidden flex-shrink-0">
              <img
                src={getTitleAvatar()!}
                alt={getTitle()}
                class="w-full h-full object-cover"
              />
            </div>
          )}
          <h1
            class={cn(
              "font-semibold truncate",
              conversation?.type === "private" &&
                "cursor-pointer hover:text-accent",
            )}
            onClick={() =>
              conversation?.type === "private" &&
              onShowDetail?.(conversation.friendIds[0])
            }
          >
            {getTitle()}
          </h1>
        </div>
        {conversation && (
          <button
            onClick={onClearChat}
            class="text-sm text-muted hover:text-danger transition-colors px-2 py-1"
            title="清空聊天记录"
          >
            🗑️
          </button>
        )}
      </header>

      <div class="flex-1 overflow-y-auto overflow-x-hidden p-4 pt-14 lg:pt-4 space-y-3">
        {conversation && messages.length >= 20 && (
          <div class="text-center py-2">
            <button
              onClick={() => onLoadMore?.(20, offset + 20)}
              class="text-xs text-accent hover:underline"
            >
              查看更多历史消息
            </button>
          </div>
        )}

        {!conversation ? (
          <div class="h-full flex items-center justify-center text-muted">
            <div class="text-center">
              <div class="text-4xl mb-2">💬</div>
              <p>选择一个会话开始聊天</p>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            const isUser = msg.senderId === "user";
            const friend = friends.find((f) => f.id === msg.senderId);
            const isTyping = generatingIds.has(msg.senderId);
            const isActionMenuOpen = showActionMenu === msg.id;

            return (
              <div key={msg.id} class="relative group">
                <div class={cn("flex gap-2", isUser && "flex-row-reverse")}>
                  <div
                    class={cn(
                      "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-sm overflow-hidden",
                      isUser ? "bg-accent text-white" : "bg-surface-hover",
                    )}
                  >
                    {isUser ? (
                      "我"
                    ) : friend?.avatar ? (
                      <img
                        src={friend.avatar}
                        alt={friend.name}
                        class="w-full h-full object-cover"
                      />
                    ) : (
                      (friend?.name || "友").charAt(0)
                    )}
                  </div>
                  <div
                    class={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 relative",
                      isUser
                        ? "bg-accent text-white rounded-tr-sm"
                        : "bg-surface-hover rounded-tl-sm",
                    )}
                    // 手机端长按支持
                    onTouchStart={() => handleLongPressStart(msg.id)}
                    onTouchEnd={handleLongPressEnd}
                    onMouseDown={() => handleLongPressStart(msg.id)}
                    onMouseUp={handleLongPressEnd}
                    onMouseLeave={handleLongPressEnd}
                  >
                    {!isUser && (
                      <div class="text-xs text-muted mb-1 flex items-center gap-2">
                        {friend?.name || msg.senderName}
                        {isTyping && (
                          <span class="text-accent animate-pulse">
                            正在输入...
                          </span>
                        )}
                      </div>
                    )}
                    {msg.images && msg.images.length > 0 && showImages && (
                      <div class="flex flex-wrap gap-1 mb-1">
                        {msg.images.map((img, i) => (
                          <img
                            key={i}
                            src={img}
                            class="max-w-[180px] max-h-[240px] rounded-lg cursor-zoom-in border border-border/50"
                            onClick={() => setPreviewUrl(img)}
                          />
                        ))}
                      </div>
                    )}
                    {msg.content && (
                      <p class="text-sm whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    )}

                    {/* 消息操作按钮 - 桌面端悬停显示，手机端长按显示 */}
                    <div
                      class={cn(
                        "absolute top-1/2 -translate-y-1/2 flex gap-1 transition-all duration-200 z-10",
                        "opacity-0 group-hover:opacity-100",
                        isActionMenuOpen ? "opacity-100" : "",
                        isUser ? "-left-16" : "-right-16",
                      )}
                    >
                      {/* 用户消息显示重试按钮（重试 AI 回复） */}
                      {isUser && onRetry && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onRetry?.();
                            setShowActionMenu(null);
                          }}
                          class="w-8 h-8 flex items-center justify-center bg-surface border border-border rounded-full text-sm text-muted hover:text-accent hover:border-accent transition-colors shadow-lg touch-manipulation"
                          title="重试 AI 回复"
                        >
                          🔄
                        </button>
                      )}
                      {/* 删除按钮：所有消息都可删除 */}
                      {onDeleteMessage && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteMessage(msg.id);
                            setShowActionMenu(null);
                          }}
                          class="w-8 h-8 flex items-center justify-center bg-surface border border-border rounded-full text-sm text-muted hover:text-danger hover:border-danger transition-colors shadow-lg touch-manipulation"
                          title="删除"
                        >
                          ❌
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}

        {generatingIds.size > 0 && (
          <div class="text-center text-muted text-xs italic py-2">
            {[...generatingIds]
              .map((id) => friends.find((f) => f.id === id)?.name)
              .filter(Boolean)
              .join("、")}{" "}
            正在思考...
          </div>
        )}
        {isWaiting && (
          <div class="text-center text-muted text-xs italic py-2">
            正在等待更多输入 (3s)...
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* 点击空白处关闭操作菜单 */}
      {showActionMenu && (
        <div
          class="fixed inset-0 z-30"
          onClick={() => setShowActionMenu(null)}
        />
      )}

      {images.length > 0 && (
        <div class="flex-shrink-0 px-3 py-2 flex gap-2 flex-wrap border-t border-border bg-surface/50">
          {images.map((img, i) => (
            <div key={i} class="relative group">
              <img
                src={img}
                class="w-16 h-16 object-cover rounded-lg border border-border shadow-sm"
              />
              <button
                onClick={() =>
                  setImages((prev) => prev.filter((_, idx) => idx !== i))
                }
                class="absolute -top-2 -right-2 w-5 h-5 bg-danger text-white rounded-full text-xs shadow-md flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
          <button
            onClick={() => setImages([])}
            class="w-16 h-16 flex flex-col items-center justify-center border border-dashed border-border rounded-lg text-muted text-[10px] hover:border-accent hover:text-accent transition-colors"
          >
            <span>🗑️</span>
            <span>清除</span>
          </button>
        </div>
      )}

      <div class="flex-shrink-0 p-3 border-t border-border flex gap-2 items-end bg-background">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          class="hidden"
          onChange={handleFiles}
        />

        <div class="flex gap-1">
          <Button
            variant="outline"
            size="icon"
            class={cn(
              "rounded-full",
              aiImageGen
                ? "text-accent border-accent bg-accent/10"
                : "text-muted",
            )}
            onClick={toggleAiImageGen}
            title={aiImageGen ? "AI 生图已开启" : "AI 生图已关闭"}
          >
            {aiImageGen ? "✨" : "🪄"}
          </Button>
          <Button
            variant="outline"
            size="icon"
            class="rounded-full text-muted"
            onClick={() => fileRef.current?.click()}
            disabled={images.length >= 4}
          >
            🖼️
          </Button>
        </div>

        <textarea
          ref={textareaRef}
          value={text}
          onInput={(e) => {
            setText((e.target as HTMLTextAreaElement).value);
            if (onTyping) onTyping();
          }}
          onKeyDown={handleKey}
          placeholder="给朋友发消息..."
          rows={1}
          class="flex-1 px-4 py-2.5 rounded-2xl border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent resize-none overflow-hidden leading-5 text-sm"
          style={{ maxHeight: "120px" }}
        />
        <Button
          onClick={handleSend}
          class="rounded-full px-5"
          disabled={!text.trim() && images.length === 0}
        >
          发送
        </Button>
      </div>

      {previewUrl && (
        <div
          class="fixed inset-0 z-50 bg-black/95 flex items-center justify-center p-4"
          onClick={() => setPreviewUrl(null)}
        >
          <img
            src={previewUrl}
            class="max-w-full max-h-full object-contain rounded shadow-2xl"
          />
          <button
            class="absolute top-4 right-4 text-white text-3xl"
            onClick={() => setPreviewUrl(null)}
          >
            &times;
          </button>
        </div>
      )}
    </div>
  );
};
