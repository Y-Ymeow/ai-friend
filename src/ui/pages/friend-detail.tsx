import { type FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Badge } from "../components/badge";
import { ScrollArea } from "../components/scroll-area";
import {
  friends,
  updateFriend,
  fetchMemories,
  addMemory,
  removeMemory,
} from "../../store";
import { generateAvatar } from "../../db/db";
import type { Friend, Memory } from "../../types";

interface Props {
  friendId: string;
  onBack: () => void;
}

export const FriendDetailPage: FunctionalComponent<Props> = ({
  friendId,
  onBack,
}) => {
  const [friend, setFriend] = useState<Friend | null>(null);
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);

  const refreshData = () => {
    const f = friends.value.find((f) => f.id === friendId);
    if (f) {
      setFriend({ ...f });
      setMemories(fetchMemories(friendId));
    }
  };

  useEffect(() => {
    refreshData();
  }, [friendId, friends.value]);

  if (!friend) return <div class="p-8 text-center text-muted">加载中...</div>;

  const handleUpdate = (updates: Partial<Friend>) => {
    updateFriend(friendId, updates);
  };

  const handleAddMemory = () => {
    if (!newMemory.trim()) return;
    addMemory({
      friendId,
      content: newMemory.trim(),
      importance: 5,
      type: "fact",
      timestamp: Date.now(),
    });
    setNewMemory("");
    refreshData();
  };

  const handleRemoveMemory = (id: string) => {
    removeMemory(id);
    refreshData();
  };

  const refreshState = () => {
    const outfits = [
      "卫衣",
      "连衣裙",
      "小西装",
      "睡衣",
      "运动服",
      "衬衫",
      "针织衫",
      "牛仔夹克",
    ];
    const physicals = [
      "精力充沛",
      "元气满满",
      "有点想睡觉",
      "想吃甜食",
      "心情大好",
      "状态一般",
      "有点感冒",
    ];
    handleUpdate({
      outfit: outfits[Math.floor(Math.random() * outfits.length)],
      physicalCondition:
        physicals[Math.floor(Math.random() * physicals.length)],
      lastStateUpdate: Date.now(),
    });
  };

  const handleGenerateAvatar = async () => {
    if (!friend || isGeneratingAvatar) return;
    setIsGeneratingAvatar(true);
    try {
      const avatarUrl = await generateAvatar(friend);
      handleUpdate({ avatar: avatarUrl });
      refreshData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "生成头像失败");
    } finally {
      setIsGeneratingAvatar(false);
    }
  };

  return (
    <div class="h-full flex flex-col bg-background text-foreground">
      {/* 磨砂感头部 */}
      <header class="flex-shrink-0 h-16 px-6 flex items-center gap-4 border-b border-border bg-surface/50 backdrop-blur-md sticky top-0 z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={onBack}
          class="rounded-full"
        >
          <span class="text-xl">←</span>
        </Button>
        <div class="flex-1">
          <h1 class="font-bold text-lg leading-none">{friend.name}</h1>
          <p class="text-xs text-muted mt-1">资料与状态管理</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={refreshState}
          class="rounded-full gap-2 px-4"
        >
          ✨ 刷新状态
        </Button>
      </header>

      <ScrollArea class="flex-1 px-6 py-8">
        <div class="max-w-2xl mx-auto space-y-10 pb-12">
          {/* 核心状态看板 */}
          <section class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="col-span-1 md:col-span-2 flex flex-col items-center py-4 mb-4">
              <div class="relative group">
                <div class="w-24 h-24 rounded-full bg-gradient-to-br from-accent to-accent/40 flex items-center justify-center text-3xl font-bold shadow-lg shadow-accent/20 overflow-hidden">
                  {friend.avatar ? (
                    <img src={friend.avatar} alt={friend.name} class="w-full h-full object-cover" />
                  ) : (
                    friend.name.charAt(0)
                  )}
                </div>
                <button
                  onClick={handleGenerateAvatar}
                  disabled={isGeneratingAvatar}
                  class="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-accent text-white text-xs flex items-center justify-center shadow-md hover:bg-accent/80 transition-opacity opacity-0 group-hover:opacity-100 disabled:opacity-50"
                  title="生成头像"
                >
                  {isGeneratingAvatar ? "⏳" : "🎨"}
                </button>
              </div>
              <Badge variant="outline" class="px-3 py-1 mt-3">
                亲密度 Lv.{(friend.intimacy / 100).toFixed(0)}
              </Badge>
            </div>

            <Card class="p-5 bg-surface/30 border-none shadow-sm space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-muted uppercase tracking-wider">
                  今日心情
                </span>
                <span class="text-sm font-mono text-accent">
                  {friend.mood}%
                </span>
              </div>
              <div class="h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  class="h-full bg-accent transition-all duration-700"
                  style={{ width: `${friend.mood}%` }}
                />
              </div>
            </Card>

            <Card class="p-5 bg-surface/30 border-none shadow-sm space-y-3">
              <div class="flex justify-between items-center">
                <span class="text-xs font-bold text-muted uppercase tracking-wider">
                  羁绊等级
                </span>
                <span class="text-sm font-mono text-warning">
                  {friend.intimacy}/1000
                </span>
              </div>
              <div class="h-1.5 bg-background rounded-full overflow-hidden">
                <div
                  class="h-full bg-warning transition-all duration-700"
                  style={{ width: `${(friend.intimacy / 1000) * 100}%` }}
                />
              </div>
            </Card>

            <div class="grid grid-cols-2 gap-4 col-span-1 md:col-span-2">
              <div class="p-4 rounded-2xl bg-surface/20 border border-border/50">
                <div class="text-[10px] text-muted font-bold uppercase mb-1">
                  今日穿搭
                </div>
                <div class="text-sm font-medium">{friend.outfit}</div>
              </div>
              <div class="p-4 rounded-2xl bg-surface/20 border border-border/50">
                <div class="text-[10px] text-muted font-bold uppercase mb-1">
                  当前体感
                </div>
                <div class="text-sm font-medium">
                  {friend.physicalCondition}
                </div>
              </div>
            </div>
          </section>

          {/* 自动回复设置 */}
          <section class="space-y-3">
            <h3 class="text-sm font-bold px-1 text-muted uppercase tracking-widest">
              系统设置
            </h3>
            <Card class="p-5 flex items-center justify-between bg-surface/40 border-border/50">
              <div>
                <div class="font-semibold">定时主动联系</div>
                <div class="text-xs text-muted mt-0.5">
                  静默超过 {friend.autoReply.idleMinutes} 分钟后触发
                </div>
              </div>
              <button
                onClick={() =>
                  handleUpdate({
                    autoReply: {
                      ...friend.autoReply,
                      enabled: !friend.autoReply.enabled,
                    },
                  })
                }
                class={`w-12 h-6 rounded-full transition-all duration-300 relative ${friend.autoReply.enabled ? "bg-accent" : "bg-muted"}`}
              >
                <div
                  class={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-300 shadow-sm ${friend.autoReply.enabled ? "left-7" : "left-1"}`}
                />
              </button>
            </Card>
          </section>

          {/* 记忆宫殿 */}
          <section class="space-y-4">
            <div class="flex items-center justify-between px-1">
              <h3 class="text-sm font-bold text-muted uppercase tracking-widest">
                记忆宫殿
              </h3>
              <Badge variant="secondary" class="font-mono">
                {memories.length}
              </Badge>
            </div>

            <div class="grid gap-3">
              {memories.map((m) => (
                <div
                  key={m.id}
                  class="p-4 rounded-2xl bg-surface/40 border border-border/50 flex items-start gap-4 group relative hover:border-accent/30 transition-colors"
                >
                  <div class="w-2 h-2 rounded-full bg-accent/40 mt-1.5 flex-shrink-0" />
                  <div class="flex-1 text-sm leading-relaxed text-foreground/90">
                    {m.content}
                  </div>
                  <button
                    onClick={() => handleRemoveMemory(m.id)}
                    class="opacity-0 group-hover:opacity-100 text-danger text-xs px-2 py-1 hover:bg-danger/10 rounded-md transition-all"
                  >
                    遗忘
                  </button>
                </div>
              ))}

              <div class="flex gap-2 mt-4">
                <input
                  value={newMemory}
                  onInput={(e) =>
                    setNewMemory((e.target as HTMLInputElement).value)
                  }
                  onKeyDown={(e) => e.key === "Enter" && handleAddMemory()}
                  placeholder="记录一件对他而言重要的事..."
                  class="flex-1 bg-surface/60 border border-border/50 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                />
                <Button onClick={handleAddMemory} class="rounded-xl px-6">
                  记录
                </Button>
              </div>
            </div>
          </section>

          {/* 性格核心 */}
          <section class="space-y-3 pb-10">
            <div class="flex items-center justify-between px-1">
              <h3 class="text-sm font-bold text-muted uppercase tracking-widest">
                性格核心
              </h3>
              <button
                class="text-xs text-accent font-medium hover:underline"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? "锁定并保存" : "解除锁定"}
              </button>
            </div>
            <Card
              class={
                "p-5 bg-surface/20 border-border/30 transition-all" +
                (isEditing && "ring-2 ring-accent/30 bg-surface/40")
              }
            >
              {isEditing ? (
                <textarea
                  value={friend.personality}
                  onInput={(e) =>
                    handleUpdate({
                      personality: (e.target as HTMLTextAreaElement).value,
                    })
                  }
                  class="w-full bg-transparent border-none outline-none text-sm leading-relaxed resize-none font-medium text-foreground"
                  rows={6}
                  placeholder="用一段话描述这个朋友的性格、背景和说话习惯..."
                />
              ) : (
                <div class="text-sm leading-relaxed text-muted italic whitespace-pre-wrap">
                  {friend.personality || "暂无性格描述"}
                </div>
              )}
            </Card>
          </section>
        </div>
      </ScrollArea>
    </div>
  );
};
