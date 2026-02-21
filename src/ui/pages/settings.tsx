import { type FunctionalComponent } from "preact"
import { useState, useRef } from "preact/hooks"
import { Button } from "../components/button"
import { Card, CardHeader, CardTitle, CardContent } from "../components/card"
import { getAppConfig, setAppConfig, exportDatabase, importDatabase, clearDatabase, getShowImages, setShowImages, getUserName, setUserName } from "../../db/db"
import { CHAT_MODELS, type AIProvider, type AppConfig, type CustomModel } from "../../types"

interface Props { onBack: () => void; onReset: () => void }

export const SettingsPage: FunctionalComponent<Props> = ({ onBack, onReset }) => {
  const [config, setConfig] = useState<AppConfig>(getAppConfig())
  const [activeProvider, setActiveProvider] = useState<AIProvider>(config.activeProvider)
  const [imageProvider, setImageProvider] = useState<AIProvider>(config.imageProvider || 'zhipu')
  const [showImages, setShowImagesState] = useState(getShowImages())
  const [userName, setUserNameState] = useState(getUserName())
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  
  // 自定义模型管理
  const [showCustomModelForm, setShowCustomModelForm] = useState(false)
  const [editingModel, setEditingModel] = useState<CustomModel | null>(null)
  const [customModelForm, setCustomModelForm] = useState({
    id: '',
    name: '',
    baseUrl: '',
    apiKey: '',
    supportsVision: false,
  })

  const handleSave = () => {
    setAppConfig({ ...config, activeProvider, imageProvider })
    setUserName(userName)
    setShowImages(showImages)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  
  const updateProviderConfig = (provider: AIProvider, updates: any) => {
    const newProviders = { ...config.providers }
    newProviders[provider] = { ...newProviders[provider], ...updates }
    setConfig({ ...config, providers: newProviders })
  }
  
  // 自定义模型管理函数
  const handleSaveCustomModel = () => {
    if (!customModelForm.id || !customModelForm.name || !customModelForm.baseUrl) {
      alert("请填写必填项")
      return
    }
    const currentModels = currentChat.customModels || []
    let newModels: CustomModel[]
    
    if (editingModel) {
      // 编辑现有模型
      newModels = currentModels.map(m => m.id === editingModel.id ? { ...customModelForm } as CustomModel : m)
    } else {
      // 添加新模型
      if (currentModels.find(m => m.id === customModelForm.id)) {
        alert("模型 ID 已存在")
        return
      }
      newModels = [...currentModels, { ...customModelForm } as CustomModel]
    }
    
    updateProviderConfig('custom', { customModels: newModels })
    setShowCustomModelForm(false)
    setEditingModel(null)
    setCustomModelForm({ id: '', name: '', baseUrl: '', apiKey: '', supportsVision: false })
  }
  
  const handleEditCustomModel = (model: CustomModel) => {
    setEditingModel(model)
    setCustomModelForm({
      id: model.id,
      name: model.name,
      baseUrl: model.baseUrl,
      apiKey: model.apiKey || '',
      supportsVision: model.supportsVision || false,
    })
    setShowCustomModelForm(true)
  }
  
  const handleDeleteCustomModel = (modelId: string) => {
    if (!confirm("确定删除此模型？")) return
    const currentModels = currentChat.customModels || []
    const newModels = currentModels.filter(m => m.id !== modelId)
    updateProviderConfig('custom', { customModels: newModels })
    // 如果当前选中的是被删除的模型，清空选择
    if (currentChat.chatModel === modelId) {
      updateProviderConfig('custom', { chatModel: '' })
    }
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

  return (
    <div class="h-full overflow-auto p-4 max-w-lg mx-auto text-sm">
      <div class="flex items-center gap-3 mb-6">
        <button class="text-xl text-muted hover:text-white" onClick={onBack}>←</button>
        <h1 class="text-xl font-semibold">设置</h1>
      </div>

      <Card class="mb-4">
        <CardHeader><CardTitle>0. 个人设置</CardTitle></CardHeader>
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

      <Card class="mb-4">
        <CardHeader><CardTitle>1. 对话后端 (Chat)</CardTitle></CardHeader>
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
              <p class="text-xs text-muted mt-1">如需使用代理或私有部署可在此填写</p>
            </div>
            
            {/* 自定义模型管理 */}
            {activeProvider === 'custom' && (
              <div class="space-y-3">
                <div class="flex items-center justify-between">
                  <label class="block font-medium text-xs">我的模型</label>
                  <button
                    onClick={() => {
                      setEditingModel(null)
                      setCustomModelForm({ id: '', name: '', baseUrl: '', apiKey: '', supportsVision: false })
                      setShowCustomModelForm(true)
                    }}
                    class="text-xs px-2 py-1 bg-accent text-white rounded hover:bg-accent/80"
                  >
                    + 添加模型
                  </button>
                </div>
                
                {showCustomModelForm && (
                  <div class="p-3 bg-surface rounded-lg border border-border space-y-3">
                    <div>
                      <label class="block text-xs mb-1">模型 ID *</label>
                      <input
                        type="text"
                        value={customModelForm.id}
                        onInput={e => setCustomModelForm({ ...customModelForm, id: (e.target as HTMLInputElement).value })}
                        class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                        placeholder="例如：gpt-4"
                      />
                    </div>
                    <div>
                      <label class="block text-xs mb-1">模型名称 *</label>
                      <input
                        type="text"
                        value={customModelForm.name}
                        onInput={e => setCustomModelForm({ ...customModelForm, name: (e.target as HTMLInputElement).value })}
                        class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                        placeholder="例如：GPT-4"
                      />
                    </div>
                    <div>
                      <label class="block text-xs mb-1">Base URL *</label>
                      <input
                        type="text"
                        value={customModelForm.baseUrl}
                        onInput={e => setCustomModelForm({ ...customModelForm, baseUrl: (e.target as HTMLInputElement).value })}
                        class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                        placeholder="例如：https://api.openai.com/v1/chat/completions"
                      />
                    </div>
                    <div>
                      <label class="block text-xs mb-1">API Key</label>
                      <input
                        type="password"
                        value={customModelForm.apiKey}
                        onInput={e => setCustomModelForm({ ...customModelForm, apiKey: (e.target as HTMLInputElement).value })}
                        class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                        placeholder="可选，留空使用全局配置"
                      />
                    </div>
                    <label class="flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={customModelForm.supportsVision}
                        onChange={e => setCustomModelForm({ ...customModelForm, supportsVision: (e.target as HTMLInputElement).checked })}
                        class="w-4 h-4"
                      />
                      支持视觉（识图）
                    </label>
                    <div class="flex gap-2">
                      <button onClick={handleSaveCustomModel} class="flex-1 px-3 py-1.5 bg-accent text-white rounded text-xs">保存</button>
                      <button onClick={() => setShowCustomModelForm(false)} class="px-3 py-1.5 bg-surface-hover border border-border rounded text-xs">取消</button>
                    </div>
                  </div>
                )}
                
                <div class="space-y-2">
                  {(currentChat.customModels || []).map(model => (
                    <div key={model.id} class="flex items-center justify-between p-2 bg-surface rounded border border-border">
                      <div class="flex-1">
                        <div class="text-xs font-medium">{model.name}</div>
                        <div class="text-[10px] text-muted truncate">{model.baseUrl}</div>
                      </div>
                      <div class="flex gap-1">
                        <button onClick={() => handleEditCustomModel(model)} class="text-xs px-2 py-1 text-accent hover:bg-accent/10 rounded">编辑</button>
                        <button onClick={() => handleDeleteCustomModel(model.id)} class="text-xs px-2 py-1 text-danger hover:bg-danger/10 rounded">删除</button>
                      </div>
                    </div>
                  ))}
                  {(currentChat.customModels || []).length === 0 && (
                    <div class="text-xs text-muted text-center py-4">暂无自定义模型，点击上方"添加模型"开始配置</div>
                  )}
                </div>
                
                <div>
                  <label class="block font-medium mb-1 text-xs">当前使用模型</label>
                  <select
                    value={currentChat.chatModel}
                    onChange={e => updateProviderConfig(activeProvider, { chatModel: (e.target as HTMLSelectElement).value })}
                    class="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs"
                  >
                    <option value="">选择模型...</option>
                    {(currentChat.customModels || []).map(m => (
                      <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            
            {/* 非自定义提供商的模型选择和自定义模型管理 */}
            {activeProvider !== 'custom' && (
              <div class="space-y-4">
                <div>
                  <label class="block font-medium mb-1 text-xs">对话模型</label>
                  <select value={currentChat.chatModel} onChange={e => updateProviderConfig(activeProvider, { chatModel: (e.target as HTMLSelectElement).value })} class="w-full px-3 py-2 rounded-lg border border-border bg-surface">
                    {CHAT_MODELS[activeProvider].map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                </div>
                
                {/* 自定义模型管理（每个提供商都可以有自己的自定义模型） */}
                <div class="pt-3 border-t border-border">
                  <div class="flex items-center justify-between mb-2">
                    <label class="block font-medium text-xs">自定义模型（可选）</label>
                    <button
                      onClick={() => {
                        setEditingModel(null)
                        setCustomModelForm({ id: '', name: '', baseUrl: '', apiKey: '', supportsVision: false })
                        setShowCustomModelForm(true)
                      }}
                      class="text-xs px-2 py-1 bg-accent text-white rounded hover:bg-accent/80"
                    >
                      + 添加
                    </button>
                  </div>
                  
                  {showCustomModelForm && (
                    <div class="p-3 bg-surface rounded-lg border border-border space-y-3">
                      <div>
                        <label class="block text-xs mb-1">模型 ID *</label>
                        <input
                          type="text"
                          value={customModelForm.id}
                          onInput={e => setCustomModelForm({ ...customModelForm, id: (e.target as HTMLInputElement).value })}
                          class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                          placeholder="例如：qwen-max"
                        />
                      </div>
                      <div>
                        <label class="block text-xs mb-1">模型名称 *</label>
                        <input
                          type="text"
                          value={customModelForm.name}
                          onInput={e => setCustomModelForm({ ...customModelForm, name: (e.target as HTMLInputElement).value })}
                          class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                          placeholder="例如：通义千问 Max"
                        />
                      </div>
                      <div>
                        <label class="block text-xs mb-1">Base URL *</label>
                        <input
                          type="text"
                          value={customModelForm.baseUrl}
                          onInput={e => setCustomModelForm({ ...customModelForm, baseUrl: (e.target as HTMLInputElement).value })}
                          class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                          placeholder={activeProvider === 'zhipu' ? "例如：https://open.bigmodel.cn/api/paas/v4/chat/completions" : "例如：https://api.modelscope.cn/api/v1/chat/completions"}
                        />
                      </div>
                      <div>
                        <label class="block text-xs mb-1">API Key</label>
                        <input
                          type="password"
                          value={customModelForm.apiKey}
                          onInput={e => setCustomModelForm({ ...customModelForm, apiKey: (e.target as HTMLInputElement).value })}
                          class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                          placeholder="可选，留空使用全局配置"
                        />
                      </div>
                      <label class="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={customModelForm.supportsVision}
                          onChange={e => setCustomModelForm({ ...customModelForm, supportsVision: (e.target as HTMLInputElement).checked })}
                          class="w-4 h-4"
                        />
                        支持视觉（识图）
                      </label>
                      <div class="flex gap-2">
                        <button onClick={handleSaveCustomModel} class="flex-1 px-3 py-1.5 bg-accent text-white rounded text-xs">保存</button>
                        <button onClick={() => setShowCustomModelForm(false)} class="px-3 py-1.5 bg-surface-hover border border-border rounded text-xs">取消</button>
                      </div>
                    </div>
                  )}
                  
                  <div class="space-y-2 mt-2">
                    {(currentChat.customModels || []).map(model => (
                      <div key={model.id} class="flex items-center justify-between p-2 bg-surface rounded border border-border">
                        <div class="flex-1">
                          <div class="text-xs font-medium">{model.name}</div>
                          <div class="text-[10px] text-muted truncate">{model.baseUrl}</div>
                        </div>
                        <div class="flex gap-1">
                          <button onClick={() => handleEditCustomModel(model)} class="text-xs px-2 py-1 text-accent hover:bg-accent/10 rounded">编辑</button>
                          <button onClick={() => handleDeleteCustomModel(model.id)} class="text-xs px-2 py-1 text-danger hover:bg-danger/10 rounded">删除</button>
                        </div>
                      </div>
                    ))}
                    {(currentChat.customModels || []).length === 0 && (
                      <div class="text-xs text-muted text-center py-2">暂无自定义模型</div>
                    )}
                  </div>
                  
                  {/* 自定义模型选择 */}
                  {(currentChat.customModels || []).length > 0 && (
                    <div>
                      <label class="block font-medium mb-1 text-xs">或使用自定义模型</label>
                      <select
                        value={currentChat.chatModel}
                        onChange={e => updateProviderConfig(activeProvider, { chatModel: (e.target as HTMLSelectElement).value })}
                        class="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs"
                      >
                        <option value="">选择官方模型...</option>
                        {(currentChat.customModels || []).map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card class="mb-4">
        <CardHeader><CardTitle>2. 生图后端 (Image)</CardTitle></CardHeader>
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
                <label class="block font-medium mb-1 text-xs">Base URL (可选)</label>
                <input
                  type="text"
                  value={currentImage.baseUrl || ""}
                  onInput={e => updateProviderConfig('zhipu', { baseUrl: (e.target as HTMLInputElement).value })}
                  class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:ring-1 focus:ring-accent"
                  placeholder="默认使用官方 API 地址"
                />
              </div>
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
          <label class="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={config.imageGenerationEnabled} onChange={e => setConfig({ ...config, imageGenerationEnabled: (e.target as HTMLInputElement).checked })} class="w-4 h-4" />
            <span class="font-medium text-xs">允许 AI 主动在回复中发图</span>
          </label>
          <label class="flex items-center gap-2 cursor-pointer mt-2">
            <input type="checkbox" checked={showImages} onChange={e => setShowImagesState((e.target as HTMLInputElement).checked)} class="w-4 h-4" />
            <span class="font-medium text-xs">在聊天中显示图片内容</span>
          </label>
        </CardContent>
      </Card>

      <Button class="w-full mb-4" onClick={handleSave}>{saved ? "已保存 ✓" : "保存所有配置"}</Button>

      <Card>
        <CardHeader><CardTitle>数据管理</CardTitle></CardHeader>
        <CardContent class="space-y-3">
          <div class="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={async () => { const blob = await exportDatabase(); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `backup.db`; a.click(); }}>📤 导出</Button>
            <input ref={fileRef} type="file" accept=".db,.sqlite" class="hidden" onChange={handleImport} />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={importing}>📥 {importing ? "中..." : "导入"}</Button>
          </div>
          <Button variant="destructive" class="w-full" onClick={async () => { if (confirm("确定要清空所有数据吗？")) { await clearDatabase(); onReset(); } }}>🗑️ 清空所有数据</Button>
        </CardContent>
      </Card>
    </div>
  )
}
