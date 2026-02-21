import { type FunctionalComponent } from "preact";
import { useState, useEffect } from "preact/hooks";
import { Button } from "../components/button";
import { Card } from "../components/card";
import { Badge } from "../components/badge";
import {
  friends,
  updateFriend,
  fetchMemories,
  addMemory,
  removeMemory,
} from "../../store";
import { getMessages } from "../../db/db";
import { generateAvatar, generateFriendState } from "../../ai/client";
import type { Memory } from "../../types";

interface Props { friendId: string; onBack: () => void; }

export const FriendDetailPage: FunctionalComponent<Props> = ({ friendId, onBack }) => {
  // 使用 .value 确保响应式
  const friend = friends.value.find((f) => f.id === friendId);
  
  const [memories, setMemories] = useState<Memory[]>([]);
  const [isGeneratingAvatar, setIsGeneratingAvatar] = useState(false);
  const [isRefreshingState, setIsRefreshingState] = useState(false);
  const [newMemory, setNewMemory] = useState("");
  
  // 编辑状态
  const [isEditingPersonality, setIsEditingPersonality] = useState(false);
  const [personalityText, setPersonalityText] = useState("");
  const [isEditingAppearance, setIsEditingAppearance] = useState(false);
  const [appearanceText, setAppearanceText] = useState("");

  useEffect(() => {
    if (friendId) { setMemories(fetchMemories(friendId)); }
    if (friend) { 
      setPersonalityText(friend.personality); 
      setAppearanceText(friend.appearance); 
    }
  }, [friendId, friend]);

  if (!friend) return <div class="p-4 text-center"><p>找不到朋友信息</p><Button onClick={onBack} class="mt-4">返回</Button></div>;

  const handleUpdateField = (field: 'personality' | 'appearance', value: string) => {
    updateFriend(friendId, { [field]: value });
    if (field === 'personality') setIsEditingPersonality(false);
    if (field === 'appearance') setIsEditingAppearance(false);
  };

  const handleGenerateAvatar = async () => {
    if (!confirm("确定重新生成头像吗？这将参考你的“外貌描述”设定。")) return;
    setIsGeneratingAvatar(true);
    try { const url = await generateAvatar(friend); updateFriend(friendId, { avatar: url }); }
    catch (err: any) { alert("生成失败: " + err.message); }
    finally { setIsGeneratingAvatar(false); }
  };

  const handleRefreshState = async () => {
    setIsRefreshingState(true);
    try {
      const msgs = getMessages(friendId, 10);
      const recent = msgs.map(m => ({ senderName: m.senderName, content: m.content, timestamp: m.timestamp }));
      const newState = await generateFriendState(friend, recent);
      if (newState) updateFriend(friendId, { 
        outfit: newState.outfit, 
        physicalCondition: newState.physicalCondition, 
        mood: newState.mood, 
        lastStateUpdate: Date.now() 
      });
    }
    catch (err: any) { alert("刷新失败: " + err.message); }
    finally { setIsRefreshingState(false); }
  };

  return (
    <div class="h-full flex flex-col bg-background text-sm">
      <header class="h-12 px-4 flex items-center justify-between border-b border-border bg-background flex-shrink-0 sticky top-0 z-10">
        <div class="flex items-center gap-3">
          <button class="text-xl text-muted hover:text-white" onClick={onBack}>←</button>
          <h1 class="font-semibold">朋友资料</h1>
        </div>
      </header>

      <div class="p-4 space-y-6 max-w-2xl mx-auto w-full pb-20">
        {/* 头像与基础信息 */}
        <div class="flex flex-col items-center space-y-4 py-4">
          <div class="relative">
            <div class="w-32 h-32 rounded-full overflow-hidden ring-4 ring-accent/20 shadow-2xl bg-surface">
              {friend.avatar ? (
                <img src={friend.avatar} alt={friend.name} class="w-full h-full object-cover" />
              ) : (
                <div class="w-full h-full flex items-center justify-center text-4xl font-bold text-muted">
                  {friend.name.charAt(0)}
                </div>
              )}
            </div>
            <button 
              onClick={handleGenerateAvatar} 
              disabled={isGeneratingAvatar} 
              class="absolute bottom-0 right-0 w-10 h-10 bg-accent text-white rounded-full shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-all disabled:opacity-50 border-4 border-background"
            >
              {isGeneratingAvatar ? "..." : "✨"}
            </button>
          </div>
          <div class="text-center">
            <h2 class="text-3xl font-bold tracking-tight">{friend.name}</h2>
            <div class="flex gap-2 mt-3 justify-center">
              <Badge variant="outline" class="px-3">亲密度 {friend.intimacy}</Badge>
              <Badge class={friend.mood > 70 ? "bg-success px-3" : friend.mood > 30 ? "bg-warning px-3" : "bg-danger px-3"}>
                心情 {friend.mood}
              </Badge>
            </div>
            {/* 基本数据 */}
            <div class="flex gap-4 mt-2 justify-center text-xs text-muted">
              {friend.gender && (
                <span>{friend.gender === "female" ? "♀" : friend.gender === "male" ? "♂" : "⚧"}</span>
              )}
              {friend.height && <span>{friend.height}cm</span>}
              {friend.weight && <span>{friend.weight}kg</span>}
              {friend.age && <span>{friend.age}岁</span>}
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 实时状态卡片 */}
          <Card class="p-5 space-y-4 border-accent/10 bg-accent/[0.02]">
            <div class="flex justify-between items-center border-b border-border pb-2">
              <h3 class="font-bold flex items-center gap-2 text-accent">
                <span>📍</span> 实时状态
              </h3>
              <button 
                onClick={handleRefreshState} 
                disabled={isRefreshingState} 
                class="text-[10px] px-2 py-1 rounded-md bg-accent text-white hover:bg-accent/80 transition-colors shadow-sm"
              >
                {isRefreshingState ? "刷新中..." : "AI 刷新"}
              </button>
            </div>
            <div class="space-y-3">
              <div class="flex justify-between items-center bg-background/50 p-2.5 rounded-xl border border-border/50">
                <span class="text-muted text-xs">今日穿搭</span>
                <span class="font-bold text-sm">{friend.outfit}</span>
              </div>
              <div class="flex justify-between items-center bg-background/50 p-2.5 rounded-xl border border-border/50">
                <span class="text-muted text-xs">当前体感</span>
                <span class="font-bold text-sm">{friend.physicalCondition}</span>
              </div>
              <p class="text-[10px] text-muted text-right italic pt-1">
                更新于 {new Date(friend.lastStateUpdate).toLocaleTimeString()}
              </p>
            </div>
          </Card>

          {/* 性格设定卡片 */}
          <Card class="p-5 space-y-4">
            <div class="flex justify-between items-center border-b border-border pb-2">
              <h3 class="font-bold flex items-center gap-2">
                <span>📝</span> 性格设定
              </h3>
              {!isEditingPersonality && (
                <button 
                  onClick={() => setIsEditingPersonality(true)} 
                  class="text-[10px] px-2 py-1 rounded-md bg-surface-hover text-accent border border-accent/20 hover:bg-accent/5 transition-colors font-bold"
                >
                  修改
                </button>
              )}
            </div>
            {isEditingPersonality ? (
              <div class="space-y-3">
                <textarea 
                  value={personalityText} 
                  onInput={e => setPersonalityText((e.target as HTMLTextAreaElement).value)} 
                  class="w-full p-3 bg-surface rounded-xl border border-accent/30 focus:ring-2 focus:ring-accent/20 focus:outline-none text-xs h-32 resize-none"
                />
                <div class="flex justify-end gap-3">
                  <button onClick={() => setIsEditingPersonality(false)} class="text-xs text-muted">取消</button>
                  <button onClick={() => handleUpdateField('personality', personalityText)} class="text-xs bg-accent text-white px-3 py-1 rounded-lg">保存</button>
                </div>
              </div>
            ) : (
              <p class="text-xs text-muted leading-relaxed italic p-2 bg-surface/30 rounded-lg border border-dashed border-border">
                "{friend.personality}"
              </p>
            )}
          </Card>
        </div>

        {/* 外貌特征卡片 */}
        <Card class="p-5 space-y-4">
          <div class="flex justify-between items-center border-b border-border pb-2">
            <h3 class="font-bold flex items-center gap-2">
              <span>👗</span> 外貌描述
            </h3>
            {!isEditingAppearance && (
              <button 
                onClick={() => setIsEditingAppearance(true)} 
                class="text-[10px] px-2 py-1 rounded-md bg-surface-hover text-accent border border-accent/20 hover:bg-accent/5 transition-colors font-bold"
              >
                修改
              </button>
            )}
          </div>
          {isEditingAppearance ? (
            <div class="space-y-3">
              <textarea 
                value={appearanceText} 
                onInput={e => setAppearanceText((e.target as HTMLTextAreaElement).value)} 
                class="w-full p-3 bg-surface rounded-xl border border-accent/30 focus:ring-2 focus:ring-accent/20 focus:outline-none text-xs h-32 resize-none"
              />
              <div class="flex justify-end gap-3">
                <button onClick={() => setIsEditingAppearance(false)} class="text-xs text-muted">取消</button>
                <button onClick={() => handleUpdateField('appearance', appearanceText)} class="text-xs bg-accent text-white px-3 py-1 rounded-lg">保存</button>
              </div>
            </div>
          ) : (
            <p class="text-xs text-muted leading-relaxed p-2">
              {friend.appearance || "暂无描述"}
            </p>
          )}
        </Card>

        {/* 记忆碎片卡片 */}
        <div class="space-y-4">
          <h3 class="font-bold px-1 flex items-center gap-2">
            <span>🧠</span> 记忆碎片 ({memories.length})
          </h3>
          <Card class="p-5 space-y-5">
            <div class="flex gap-2">
              <input 
                type="text" 
                value={newMemory} 
                onInput={e => setNewMemory((e.target as HTMLInputElement).value)} 
                placeholder="添加一条记忆..." 
                class="flex-1 px-3 py-2 bg-surface rounded-xl border border-border text-xs focus:outline-none" 
              />
              <Button size="sm" onClick={() => {
                if (newMemory.trim()) {
                  addMemory({ friendId, content: newMemory.trim(), importance: 5, type: "fact", timestamp: Date.now() });
                  setNewMemory("");
                  setMemories(fetchMemories(friendId));
                }
              }}>记录</Button>
            </div>
            <div class="space-y-2">
              {memories.length === 0 ? (
                <p class="text-center py-4 text-xs text-muted">目前还没有记忆...</p>
              ) : (
                memories.map(m => (
                  <div key={m.id} class="flex justify-between items-start p-3 rounded-2xl bg-surface-hover group border border-transparent hover:border-border transition-all">
                    <div class="space-y-1 flex-1">
                      <p class="text-xs">{m.content}</p>
                      <p class="text-[10px] text-muted">{new Date(m.timestamp).toLocaleDateString()}</p>
                    </div>
                    <button onClick={() => {
                      removeMemory(m.id);
                      setMemories(fetchMemories(friendId));
                    }} class="text-muted opacity-0 group-hover:opacity-100 hover:text-danger p-1">
                      🗑️
                    </button>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
