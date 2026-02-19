import { type FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";
import { Button } from "../components/button";
import { Badge } from "../components/badge";
import { cn } from "../lib/utils";
import type { Friend, Conversation } from "../../types";

interface Props {
  friends: Friend[];
  conversations: Conversation[];
  currentConvId: string | null;
  onSelectConv: (id: string) => void;
  onStartChat: (friendId: string) => void;
  onShowFriendDetail: (friendId: string) => void;
  onDeleteConv: (id: string) => void;
  onDeleteFriend: (id: string) => void;
  onAddFriend: () => void;
  onCreateGroup: () => void;
  onSettings: () => void;
}

export const Sidebar: FunctionalComponent<Props> = ({
  friends,
  conversations,
  currentConvId,
  onSelectConv,
  onStartChat,
  onShowFriendDetail,
  onDeleteConv,
  onDeleteFriend,
  onAddFriend,
  onCreateGroup,
  onSettings,
}) => {
  const [expanded, setExpanded] = useState<"friends" | "conversations" | null>("conversations");
  const [contextMenu, setContextMenu] = useState<{ type: "friend" | "conv"; id: string; x: number; y: number; } | null>(null);

  useEffect(() => {
    const closeMenu = () => setContextMenu(null);
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, []);

  const getConvName = (conv: Conversation): string => {
    if (conv.name) return conv.name;
    if (conv.type === "private") {
      return friends.find((f) => f.id === conv.friendIds[0])?.name || "未知";
    }
    return `群聊 (${conv.friendIds.length})`;
  };

  const getConvAvatar = (conv: Conversation): string | null => {
    if (conv.type === "private") {
      return friends.find((f) => f.id === conv.friendIds[0])?.avatar || null;
    }
    return null;
  };

  const getPrivateConvId = (friendId: string): string | null => {
    const conv = conversations.find((c) => c.type === "private" && c.friendIds[0] === friendId);
    return conv?.id || null;
  };

  const handleContextMenu = (e: Event, type: "friend" | "conv", id: string) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    setContextMenu({ type, id, x: rect.left, y: rect.bottom + 4 });
  };

  return (
    <div class="h-full flex flex-col bg-surface border-r border-border">
      <div class="flex-shrink-0 h-12 px-3 flex items-center justify-between border-b border-border">
        <span class="font-semibold text-accent">AI 朋友</span>
        <Button variant="ghost" size="sm" onClick={onSettings}>⚙</Button>
      </div>

      <div class="flex-shrink-0">
        <button
          class="w-full px-3 py-2 flex items-center justify-between text-sm text-muted hover:text-white"
          onClick={() => setExpanded(expanded === "friends" ? null : "friends")}
        >
          <span>好友 ({friends.length})</span>
          <span class="text-xs">{expanded === "friends" ? "▼" : "▶"}</span>
        </button>

        {expanded === "friends" && (
          <div class="px-2 pb-2 space-y-1">
            {friends.map((friend) => {
              const convId = getPrivateConvId(friend.id);
              const isActive = convId && currentConvId === convId;
              return (
                <div
                  key={friend.id}
                  class={cn("p-2 rounded cursor-pointer flex items-center gap-2 relative group", isActive ? "bg-accent/20" : "hover:bg-surface-hover")}
                  onClick={() => onShowFriendDetail(friend.id)}
                  onContextMenu={(e) => handleContextMenu(e as any, "friend", friend.id)}
                >
                  <div class="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-sm overflow-hidden">
                  {friend.avatar ? <img src={friend.avatar} alt={friend.name} class="w-full h-full object-cover" /> : friend.name.charAt(0)}
                </div>
                  <div class="flex-1 min-w-0">
                    <div class="text-sm truncate">{friend.name}</div>
                    <div class="text-xs text-muted truncate">{friend.personality}</div>
                  </div>
                </div>
              );
            })}
            <div class="flex gap-1 pt-1">
              <Button variant="outline" size="sm" class="flex-1 text-xs" onClick={onAddFriend}>+ 好友</Button>
              <Button variant="outline" size="sm" class="flex-1 text-xs" onClick={onCreateGroup}>+ 群聊</Button>
            </div>
          </div>
        )}
      </div>

      <div class="flex-1 flex flex-col min-h-0">
        <button
          class="w-full px-3 py-2 flex items-center justify-between text-sm text-muted hover:text-white border-t border-border"
          onClick={() => setExpanded(expanded === "conversations" ? null : "conversations")}
        >
          <span>会话 ({conversations.length})</span>
          <span class="text-xs">{expanded === "conversations" ? "▼" : "▶"}</span>
        </button>

        {expanded === "conversations" && (
          <div class="flex-1 overflow-auto px-2 pb-2 space-y-1">
            {conversations.map((conv) => {
              const convName = getConvName(conv);
              const isActive = currentConvId === conv.id;
              return (
                <div
                  key={conv.id}
                  class={cn("p-2 rounded cursor-pointer flex items-center gap-2 relative group", isActive ? "bg-accent/20" : "hover:bg-surface-hover")}
                  onClick={() => onSelectConv(conv.id)}
                  onContextMenu={(e) => handleContextMenu(e as any, "conv", conv.id)}
                >
                  <div class="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-sm overflow-hidden">
                  {getConvAvatar(conv) ? <img src={getConvAvatar(conv)!} alt={convName} class="w-full h-full object-cover" /> : convName.charAt(0)}
                </div>
                  <div class="flex-1 min-w-0">
                    <div class="flex items-center gap-1">
                      <span class="text-sm truncate">{convName}</span>
                      <Badge variant={conv.type === "private" ? "default" : "secondary"} class="text-[10px]">{conv.type === "private" ? "私" : "群"}</Badge>
                    </div>
                    {conv.lastMessage && <div class="text-xs text-muted truncate">{conv.lastMessage}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {contextMenu && (
        <div
          class="fixed z-50 bg-surface border border-border rounded-lg shadow-lg py-1 min-w-[100px]"
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          {contextMenu.type === "friend" && (
            <>
              <button class="w-full px-3 py-1.5 text-sm text-left hover:bg-surface-hover" onClick={() => onStartChat(contextMenu.id)}>开始聊天</button>
              <button class="w-full px-3 py-1.5 text-sm text-left hover:bg-surface-hover" onClick={() => onShowFriendDetail(contextMenu.id)}>查看资料</button>
              <button class="w-full px-3 py-1.5 text-sm text-left text-danger hover:bg-surface-hover" onClick={() => onDeleteFriend(contextMenu.id)}>删除好友</button>
            </>
          )}
          {contextMenu.type === "conv" && (
            <button class="w-full px-3 py-1.5 text-sm text-left text-danger hover:bg-surface-hover" onClick={() => onDeleteConv(contextMenu.id)}>删除会话</button>
          )}
        </div>
      )}
    </div>
  );
};
