import { type FunctionalComponent } from "preact"
import { useState, useRef } from "preact/hooks"
import { Button } from "../components/button"
import { Card, CardHeader, CardTitle, CardContent } from "../components/card"
import { getAppConfig, setAppConfig, exportDatabase, importDatabase, clearDatabase, getShowImages, setShowImages, getUserName, setUserName } from "../../db/db"
import { CHAT_MODELS, type AIProvider, type AppConfig, type CustomModel } from "../../types"

interface Props { onBack: () => void; onReset: () => void }

type SettingsTab = 'basic' | 'models' | 'prompts' | 'data'

// 默认 Prompts
const DEFAULT_PROMPTS = {
  systemPrefix: "【角色扮演指令】\n你正在进行沉浸式角色扮演，",
  systemSuffix: "\n\n【回复规范】\n1. 真人社交语境回复，简短随性，像真人聊天一样。\n2. 支持 [CONTINUE] 表示连发消息。\n3. 支持 [GEN_IMAGE: 描述词] 主动分享图片（描述词用中文，尽量详细）。",
  autoReplyPrefix: "(",
  autoReplySuffix: ")",
}

export const SettingsPage: FunctionalComponent<Props> = ({ onBack, onReset }) => {
  const [config, setConfig] = useState<AppConfig>(getAppConfig())
  const [activeProvider, setActiveProvider] = useState<AIProvider>(config.activeProvider)
  const [imageProvider, setImageProvider] = useState<AIProvider>(config.imageProvider || 'zhipu')
  const [showImages, setShowImagesState] = useState(getShowImages())
  const [userName, setUserNameState] = useState(getUserName())
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const [activeTab, setActiveTab] = useState<SettingsTab>('basic')
  const fileRef = useRef<HTMLInputElement>(null)
  
  // Prompts 配置
  const [prompts, setPrompts] = useState(() => {
    const saved = localStorage.getItem("custom_prompts")
    return saved ? JSON.parse(saved) : DEFAULT_PROMPTS
  })

  const handleSave = () => {
    setAppConfig({ ...config, activeProvider, imageProvider })
    setUserName(userName)
    setShowImages(showImages)
    localStorage.setItem("custom_prompts", JSON.stringify(prompts))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  
  const updateProviderConfig = (provider: AIProvider, updates: any) => {
    const newProviders = { ...config.providers }
    newProviders[provider] = { ...newProviders[provider], ...updates }
    setConfig({ ...config, providers: newProviders })
  }
  
  const handleRestoreDefaultPrompts = () => {
    if (!confirm("确定恢复默认 Prompts 吗？")) return
    setPrompts(DEFAULT_PROMPTS)
  }

  const handleImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!confirm("确定导入吗？这将覆盖所有数据。")) return;
    setImporting(true);
    try { await importDatabase(file); alert("导入成功！"); location.reload(); }
    catch (e: any) { alert("导入失败：" + e.message); }
    finally { setImporting(false); }
  }

  const currentChat = config.providers[activeProvider]
  const currentImage = config.providers[imageProvider]

  const renderTabButton = (tab: SettingsTab, label: string, icon: string) => (
    <button
      onClick={() => setActiveTab(tab)}
      class={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
        activeTab === tab 
          ? 'bg-accent text-white' 
          : 'text-muted hover:bg-surface-hover'
      }`}
    >
      <span>{icon}</span>
      {label}
    </button>
  )

  return (
    <div class="h-full overflow-auto p-4 max-w-4xl mx-auto text-sm">
      <div class="flex items-center gap-3 mb-6">
        <button class="text-xl text-muted hover:text-white" onClick={onBack}>←</button>
        <h1 class="text-xl font-semibold">设置</h1>
      </div>

      {/* Tab 导航 */}
      <div class="flex gap-2 mb-6 border-b border-border pb-2">
        {renderTabButton('basic', '基础', '⚙️')}
        {renderTabButton('models', '模型', '🤖')}
        {renderTabButton('prompts', 'Prompts', '📝')}
        {renderTabButton('data', '数据', '💾')}
      </div>

      {/* 基础设置 */}
      {activeTab === 'basic' && (
        <div class="space-y-4">
          <Card>
            <CardHeader><CardTitle>个人设置</CardTitle></CardHeader>
            <CardContent class="space-y-4">
              <div>
                <label class="block font-medium mb-1">我的昵称</label>
                <input
                  type="text"
                  value={userName}
                  onInput={e => setUserNameState((e.target as HTMLInputElement).value)}
                  class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:ring-1 focus:ring-accent"
                  placeholder="用户在聊天中的显示名称"
                />
                <p class="text-xs text-muted mt-1">AI 和朋友会在聊天中看到这个名字</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>显示设置</CardTitle></CardHeader>
            <CardContent class="space-y-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={showImages} onChange={e => setShowImagesState((e.target as HTMLInputElement).checked)} class="w-4 h-4" />
                <span class="font-medium text-xs">在聊天中显示图片内容</span>
              </label>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={config.imageGenerationEnabled} onChange={e => setConfig({ ...config, imageGenerationEnabled: (e.target as HTMLInputElement).checked })} class="w-4 h-4" />
                <span class="font-medium text-xs">允许 AI 主动在回复中发图</span>
              </label>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 模型设置 */}
      {activeTab === 'models' && (
        <div class="space-y-4">
          {/* 对话模型 */}
          <Card>
            <CardHeader><CardTitle>对话模型</CardTitle></CardHeader>
            <CardContent class="space-y-4">
              <div>
                <label class="block font-medium mb-1">活跃对话提供商</label>
                <select value={activeProvider} onChange={e => setActiveProvider((e.target as HTMLSelectElement).value as AIProvider)} class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:ring-1 focus:ring-accent">
                  <option value="zhipu">智谱 AI (GLM)</option>
                  <option value="google">Google (Gemma/Gemini)</option>
                  <option value="groq">Groq (Llama)</option>
                  <option value="volcengine">火山引擎 (豆包)</option>
                  <option value="modelscope">魔搭 (通义千问)</option>
                  <option value="custom">✨ 自定义模型</option>
                </select>
              </div>
              <div class="p-3 rounded-lg bg-surface-hover border border-border space-y-4">
                <div>
                  <label class="block font-medium mb-1 text-xs">API Key</label>
                  <input type="password" value={currentChat.apiKey} onInput={e => updateProviderConfig(activeProvider, { apiKey: (e.target as HTMLInputElement).value })} class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:ring-1 focus:ring-accent" placeholder="API Key" />
                </div>
                <div>
                  <label class="block font-medium mb-1 text-xs">Base URL (可选)</label>
                  <input
                    type="text"
                    value={currentChat.baseUrl || ""}
                    onInput={e => updateProviderConfig(activeProvider, { baseUrl: (e.target as HTMLInputElement).value })}
                    class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:ring-1 focus:ring-accent"
                    placeholder="默认使用官方 API 地址"
                  />
                </div>
                
                {/* 自定义模型管理 */}
                {activeProvider === 'custom' ? (
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <label class="block font-medium text-xs">我的模型</label>
                      <button onClick={() => window.open('https://github.com/Y-Ymeow/ai-friends-app/blob/main/README.md', '_blank')} class="text-xs px-2 py-1 bg-accent text-white rounded">查看文档</button>
                    </div>
                    <p class="text-xs text-muted">自定义模型功能请参考 GitHub 文档配置</p>
                  </div>
                ) : (
                  <div>
                    <label class="block font-medium mb-1 text-xs">对话模型</label>
                    <select value={currentChat.chatModel} onChange={e => updateProviderConfig(activeProvider, { chatModel: (e.target as HTMLSelectElement).value })} class="w-full px-3 py-2 rounded-lg border border-border bg-surface">
                      {CHAT_MODELS[activeProvider].map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 生图模型 */}
          <Card>
            <CardHeader><CardTitle>生图模型</CardTitle></CardHeader>
            <CardContent class="space-y-4">
              <div>
                <label class="block font-medium mb-1">活跃生图提供商</label>
                <select value={imageProvider} onChange={e => setImageProvider((e.target as HTMLSelectElement).value as AIProvider)} class="w-full px-3 py-2 rounded-lg border border-border bg-surface">
                  <option value="zhipu">智谱 AI (推荐)</option>
                </select>
              </div>
              {imageProvider === 'zhipu' && (
                <div class="p-3 rounded-lg bg-surface-hover border border-border space-y-4">
                  <div>
                    <label class="block font-medium mb-1 text-xs">尺寸</label>
                    <select value={currentImage.imageSize} onChange={e => updateProviderConfig('zhipu', { imageSize: (e.target as HTMLSelectElement).value })} class="w-full p-1.5 rounded border border-border bg-surface text-xs">
                      <option value="1280x1280">1:1 (1280)</option>
                      <option value="1024x1024">1:1 (1024)</option>
                    </select>
                  </div>
                  <div>
                    <label class="block font-medium mb-1 text-xs">图像清晰度</label>
                    <select value={currentImage.imageQuality || "hd"} onChange={e => updateProviderConfig('zhipu', { imageQuality: (e.target as HTMLSelectElement).value as "hd" | "standard" })} class="w-full p-1.5 rounded border border-border bg-surface text-xs">
                      <option value="hd">高清 (HD)</option>
                      <option value="standard">标准</option>
                    </select>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Prompts 设置 */}
      {activeTab === 'prompts' && (
        <div class="space-y-4">
          <Card>
            <CardHeader>
              <div class="flex justify-between items-center">
                <CardTitle>系统提示词配置</CardTitle>
                <Button variant="outline" size="sm" onClick={handleRestoreDefaultPrompts}>🔄 恢复默认</Button>
              </div>
            </CardHeader>
            <CardContent class="space-y-4">
              <div>
                <label class="block font-medium mb-1 text-xs">提示词前缀</label>
                <textarea
                  value={prompts.systemPrefix}
                  onInput={e => setPrompts({ ...prompts, systemPrefix: (e.target as HTMLTextAreaElement).value })}
                  class="w-full p-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent text-xs h-32 font-mono"
                  placeholder="系统提示词的前缀部分..."
                />
                <p class="text-xs text-muted mt-1">这部分会放在系统提示词的开头，通常包含角色扮演的核心指令</p>
              </div>
              <div>
                <label class="block font-medium mb-1 text-xs">提示词后缀</label>
                <textarea
                  value={prompts.systemSuffix}
                  onInput={e => setPrompts({ ...prompts, systemSuffix: (e.target as HTMLTextAreaElement).value })}
                  class="w-full p-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent text-xs h-32 font-mono"
                  placeholder="系统提示词的后缀部分..."
                />
                <p class="text-xs text-muted mt-1">这部分会放在系统提示词的末尾，通常包含回复规范</p>
              </div>
              <div>
                <label class="block font-medium mb-1 text-xs">自动回复前缀</label>
                <input
                  type="text"
                  value={prompts.autoReplyPrefix}
                  onInput={e => setPrompts({ ...prompts, autoReplyPrefix: (e.target as HTMLInputElement).value })}
                  class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:ring-1 focus:ring-accent text-xs font-mono"
                  placeholder="("
                />
                <p class="text-xs text-muted mt-1">自动回复时包裹提示词的前缀</p>
              </div>
              <div>
                <label class="block font-medium mb-1 text-xs">自动回复后缀</label>
                <input
                  type="text"
                  value={prompts.autoReplySuffix}
                  onInput={e => setPrompts({ ...prompts, autoReplySuffix: (e.target as HTMLInputElement).value })}
                  class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:ring-1 focus:ring-accent text-xs font-mono"
                  placeholder=")"
                />
                <p class="text-xs text-muted mt-1">自动回复时包裹提示词的后缀</p>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>💡 使用说明</CardTitle></CardHeader>
            <CardContent class="text-xs text-muted space-y-2">
              <p>• 系统提示词由 <strong>前缀 + 角色信息 + 后缀</strong> 组成</p>
              <p>• 角色信息是动态生成的，包含角色名、性格、心情等</p>
              <p>• 修改后记得点击底部的"保存所有配置"按钮</p>
              <p>• 点击"恢复默认"可以重置为初始配置</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 数据管理 */}
      {activeTab === 'data' && (
        <Card>
          <CardHeader><CardTitle>数据管理</CardTitle></CardHeader>
          <CardContent class="space-y-3">
            <div class="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={async () => { const blob = await exportDatabase(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `backup-${new Date().toISOString().split('T')[0]}.db`; a.click(); }}>📤 导出</Button>
              <input ref={fileRef} type="file" accept=".db,.sqlite" class="hidden" onChange={handleImport} />
              <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>📥 {importing ? "中..." : "导入"}</Button>
            </div>
            <Button variant="destructive" class="w-full" onClick={async () => { if (confirm("确定要清空所有数据吗？")) { await clearDatabase(); onReset(); } }}>🗑️ 清空所有数据</Button>
          </CardContent>
        </Card>
      )}

      {/* 保存按钮 */}
      <Button class="w-full mt-6" onClick={handleSave}>{saved ? "已保存 ✓" : "保存所有配置"}</Button>
    </div>
  )
}
