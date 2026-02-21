import { type FunctionalComponent } from "preact"
import { useState, useRef } from "preact/hooks"
import { Button } from "../components/button"
import { Card, CardHeader, CardTitle, CardContent } from "../components/card"
import { getAppConfig, setAppConfig, exportDatabase, importDatabase, clearDatabase, getShowImages, setShowImages, getUserName, setUserName } from "../../db/db"
import { CHAT_MODELS, type AIProvider, type AppConfig, type CustomModel } from "../../types"
import { DEFAULT_PROMPTS, type PromptConfig } from "../../ai/prompts"

interface Props { onBack: () => void; onReset: () => void }

type SettingsTab = 'basic' | 'models' | 'prompts' | 'data'

// 自定义 Provider 类型
interface CustomProvider {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: CustomModel[]
  chatModel?: string
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
  
  const [prompts, setPrompts] = useState<PromptConfig>(() => {
    const saved = localStorage.getItem("custom_prompts")
    return saved ? JSON.parse(saved) : DEFAULT_PROMPTS
  })
  
  // 自定义 Provider 管理
  const [customProviders, setCustomProviders] = useState<CustomProvider[]>(() => {
    const saved = localStorage.getItem("custom_providers")
    return saved ? JSON.parse(saved) : []
  })
  
  const [showProviderForm, setShowProviderForm] = useState(false)
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null)
  const [providerForm, setProviderForm] = useState({
    id: '',
    name: '',
    baseUrl: '',
    apiKey: '',
  })
  
  const [showModelForm, setShowModelForm] = useState(false)
  const [editingModel, setEditingModel] = useState<CustomModel | null>(null)
  const [modelForm, setModelForm] = useState({
    id: '',
    name: '',
    supportsVision: false,
  })

  const handleSave = () => {
    setAppConfig({ ...config, activeProvider, imageProvider })
    setUserName(userName)
    setShowImages(showImages)
    localStorage.setItem("custom_prompts", JSON.stringify(prompts))
    localStorage.setItem("custom_providers", JSON.stringify(customProviders))
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }
  
  const updateProviderConfig = (provider: AIProvider, updates: any) => {
    const newProviders = { ...config.providers }
    newProviders[provider] = { ...newProviders[provider], ...updates }
    setConfig({ ...config, providers: newProviders })
  }
  
  // 自定义 Provider 管理
  const handleSaveProvider = () => {
    if (!providerForm.id || !providerForm.name || !providerForm.baseUrl || !providerForm.apiKey) {
      alert("请填写必填项")
      return
    }
    
    if (editingProviderId) {
      // 编辑现有 provider
      setCustomProviders(customProviders.map(p => 
        p.id === editingProviderId ? { ...p, ...providerForm } : p
      ))
    } else {
      // 添加新 provider
      if (customProviders.find(p => p.id === providerForm.id)) {
        alert("Provider ID 已存在")
        return
      }
      setCustomProviders([...customProviders, { ...providerForm, models: [] }])
    }
    
    setShowProviderForm(false)
    setEditingProviderId(null)
    setProviderForm({ id: '', name: '', baseUrl: '', apiKey: '' })
  }
  
  const handleEditProvider = (provider: CustomProvider) => {
    setEditingProviderId(provider.id)
    setProviderForm({
      id: provider.id,
      name: provider.name,
      baseUrl: provider.baseUrl,
      apiKey: provider.apiKey,
    })
    setShowProviderForm(true)
  }
  
  const handleDeleteProvider = (providerId: string) => {
    if (!confirm("确定删除此 Provider？这将同时删除所有相关模型。")) return
    setCustomProviders(customProviders.filter(p => p.id !== providerId))
    // 如果当前使用的是被删除的 provider，切换回默认
    if (activeProvider === providerId as AIProvider) {
      setActiveProvider('zhipu')
    }
  }
  
  const handleSelectProvider = (providerId: string) => {
    setActiveProvider(providerId as AIProvider)
    // 初始化 provider 配置
    const provider = customProviders.find(p => p.id === providerId)
    if (provider) {
      updateProviderConfig(providerId as AIProvider, {
        provider: providerId as AIProvider,
        apiKey: provider.apiKey,
        baseUrl: provider.baseUrl,
        chatModel: provider.chatModel || '',
      })
    }
  }
  
  // 自定义模型管理（支持默认 provider 和自定义 provider）
  const handleSaveModel = () => {
    if (!modelForm.id || !modelForm.name) {
      alert("请填写必填项")
      return
    }

    const currentCustomProvider = customProviders.find(p => p.id === activeProvider)
    
    if (currentCustomProvider) {
      // 自定义 provider 的模型保存
      let newModels: CustomModel[]
      if (editingModel) {
        newModels = currentCustomProvider.models.map(m => m.id === editingModel.id ? { ...modelForm } as CustomModel : m)
      } else {
        if (currentCustomProvider.models.find(m => m.id === modelForm.id)) {
          alert("模型 ID 已存在")
          return
        }
        newModels = [...currentCustomProvider.models, { ...modelForm } as CustomModel]
      }

      setCustomProviders(customProviders.map(p =>
        p.id === activeProvider ? { ...p, models: newModels } : p
      ))

      if (!editingModel && !currentCustomProvider.chatModel) {
        updateProviderConfig(activeProvider, { chatModel: modelForm.id })
      }
    } else {
      // 默认 provider 的模型保存（保存到 config.providers）
      const currentModels = currentChat.customModels || []
      let newModels: CustomModel[]
      if (editingModel) {
        newModels = currentModels.map(m => m.id === editingModel.id ? { ...modelForm } as CustomModel : m)
      } else {
        if (currentModels.find(m => m.id === modelForm.id)) {
          alert("模型 ID 已存在")
          return
        }
        newModels = [...currentModels, { ...modelForm } as CustomModel]
      }

      updateProviderConfig(activeProvider, { customModels: newModels })

      if (!editingModel && !currentChat.chatModel) {
        updateProviderConfig(activeProvider, { chatModel: modelForm.id })
      }
    }

    setShowModelForm(false)
    setEditingModel(null)
    setModelForm({ id: '', name: '', supportsVision: false })
  }
  
  const handleEditModel = (model: CustomModel) => {
    setEditingModel(model)
    setModelForm({
      id: model.id,
      name: model.name,
      supportsVision: model.supportsVision || false,
    })
    setShowModelForm(true)
  }
  
  const handleDeleteModel = (modelId: string) => {
    if (!confirm("确定删除此模型？")) return
    const currentProvider = customProviders.find(p => p.id === activeProvider)
    if (!currentProvider) return
    
    const newModels = currentProvider.models.filter(m => m.id !== modelId)
    setCustomProviders(customProviders.map(p => 
      p.id === activeProvider ? { ...p, models: newModels } : p
    ))
    
    if (currentProvider.chatModel === modelId) {
      updateProviderConfig(activeProvider, { chatModel: '' })
    }
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
  const currentCustomProvider = customProviders.find(p => p.id === activeProvider)

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

      <div class="flex gap-2 mb-6 border-b border-border pb-2">
        {renderTabButton('basic', '基础', '⚙️')}
        {renderTabButton('models', '模型', '🤖')}
        {renderTabButton('prompts', 'Prompts', '📝')}
        {renderTabButton('data', '数据', '💾')}
      </div>

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

      {activeTab === 'models' && (
        <div class="space-y-4">
          {/* 自定义 Provider 管理 */}
          <Card>
            <CardHeader>
              <div class="flex justify-between items-center">
                <CardTitle>自定义 API 提供商</CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingProviderId(null)
                    setProviderForm({ id: '', name: '', baseUrl: '', apiKey: '' })
                    setShowProviderForm(true)
                  }}
                >
                  + 添加 Provider
                </Button>
              </div>
            </CardHeader>
            <CardContent class="space-y-3">
              {showProviderForm && (
                <div class="p-3 bg-surface rounded-lg border border-border space-y-3">
                  <div>
                    <label class="block text-xs mb-1">Provider ID *</label>
                    <input
                      type="text"
                      value={providerForm.id}
                      onInput={e => setProviderForm({ ...providerForm, id: (e.target as HTMLInputElement).value })}
                      class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                      placeholder="例如：openai"
                    />
                  </div>
                  <div>
                    <label class="block text-xs mb-1">Provider 名称 *</label>
                    <input
                      type="text"
                      value={providerForm.name}
                      onInput={e => setProviderForm({ ...providerForm, name: (e.target as HTMLInputElement).value })}
                      class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                      placeholder="例如：OpenAI"
                    />
                  </div>
                  <div>
                    <label class="block text-xs mb-1">Base URL *</label>
                    <input
                      type="text"
                      value={providerForm.baseUrl}
                      onInput={e => setProviderForm({ ...providerForm, baseUrl: (e.target as HTMLInputElement).value })}
                      class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                      placeholder="例如：https://api.openai.com/v1/chat/completions"
                    />
                  </div>
                  <div>
                    <label class="block text-xs mb-1">API Key *</label>
                    <input
                      type="password"
                      value={providerForm.apiKey}
                      onInput={e => setProviderForm({ ...providerForm, apiKey: (e.target as HTMLInputElement).value })}
                      class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                      placeholder="sk-..."
                    />
                  </div>
                  <div class="flex gap-2">
                    <button onClick={handleSaveProvider} class="flex-1 px-3 py-1.5 bg-accent text-white rounded text-xs">保存</button>
                    <button onClick={() => { setShowProviderForm(false); setEditingProviderId(null) }} class="px-3 py-1.5 bg-surface-hover border border-border rounded text-xs">取消</button>
                  </div>
                </div>
              )}
              
              <div class="space-y-2">
                {customProviders.map(provider => (
                  <div
                    key={provider.id}
                    class={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      activeProvider === provider.id ? 'bg-accent/10 border-accent' : 'bg-surface border-border'
                    }`}
                    onClick={() => handleSelectProvider(provider.id)}
                  >
                    <div class="flex-1">
                      <div class="text-sm font-medium">{provider.name}</div>
                      <div class="text-[10px] text-muted truncate">{provider.baseUrl}</div>
                      <div class="text-[10px] text-muted mt-1">{provider.models.length} 个模型</div>
                    </div>
                    <div class="flex gap-1" onClick={e => e.stopPropagation()}>
                      <button onClick={() => handleEditProvider(provider)} class="text-xs px-2 py-1 text-accent hover:bg-accent/10 rounded">编辑</button>
                      <button onClick={() => handleDeleteProvider(provider.id)} class="text-xs px-2 py-1 text-danger hover:bg-danger/10 rounded">删除</button>
                    </div>
                  </div>
                ))}
                {customProviders.length === 0 && (
                  <div class="text-xs text-muted text-center py-4">暂无自定义 Provider，点击上方"添加 Provider"开始配置</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 对话模型配置 */}
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
                  {customProviders.map(p => (
                    <option key={p.id} value={p.id}>{p.name} (自定义)</option>
                  ))}
                </select>
              </div>
              
              <div class="p-3 rounded-lg bg-surface-hover border border-border space-y-4">
                {/* 自定义 Provider 显示 API 信息 */}
                {currentCustomProvider && (
                  <div class="text-xs text-muted space-y-1">
                    <div>Base URL: {currentCustomProvider.baseUrl}</div>
                    <div>API Key: {currentCustomProvider.apiKey.slice(0, 8)}...</div>
                  </div>
                )}
                
                {/* 官方 Provider 显示 API Key 和 Base URL 输入 */}
                {!currentCustomProvider && (
                  <>
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
                    <div>
                      <label class="block font-medium mb-1 text-xs">最大重试次数 (429 错误)</label>
                      <input
                        type="number"
                        min="0"
                        max="10"
                        value={currentChat.maxRetries ?? 3}
                        onInput={e => updateProviderConfig(activeProvider, { maxRetries: Number((e.target as HTMLInputElement).value) })}
                        class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:ring-1 focus:ring-accent"
                        placeholder="3"
                      />
                      <p class="text-xs text-muted mt-1">遇到 429 错误时的最大重试次数，默认 3 次，使用指数退避策略</p>
                    </div>
                  </>
                )}
                
                {/* 官方模型 */}
                {CHAT_MODELS[activeProvider] && CHAT_MODELS[activeProvider].length > 0 && (
                  <div>
                    <label class="block font-medium mb-1 text-xs">官方模型</label>
                    <select
                      value={currentChat.chatModel}
                      onChange={e => updateProviderConfig(activeProvider, { chatModel: (e.target as HTMLSelectElement).value })}
                      class="w-full px-3 py-2 rounded-lg border border-border bg-surface mb-3"
                    >
                      {CHAT_MODELS[activeProvider].map(m => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                
                {/* 自定义模型管理 */}
                <div class="pt-3 border-t border-border">
                  <div class="flex items-center justify-between mb-2">
                    <label class="block font-medium text-xs">自定义模型</label>
                    <button
                      onClick={() => {
                        setEditingModel(null)
                        setModelForm({ id: '', name: '', supportsVision: false })
                        setShowModelForm(true)
                      }}
                      class="text-xs px-2 py-1 bg-accent text-white rounded"
                    >
                      + 添加模型
                    </button>
                  </div>
                  
                  {showModelForm && (
                    <div class="p-3 bg-surface rounded-lg border border-border space-y-3">
                      <div>
                        <label class="block text-xs mb-1">模型 ID *</label>
                        <input
                          type="text"
                          value={modelForm.id}
                          onInput={e => setModelForm({ ...modelForm, id: (e.target as HTMLInputElement).value })}
                          class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                          placeholder="例如：gpt-4"
                        />
                      </div>
                      <div>
                        <label class="block text-xs mb-1">模型名称 *</label>
                        <input
                          type="text"
                          value={modelForm.name}
                          onInput={e => setModelForm({ ...modelForm, name: (e.target as HTMLInputElement).value })}
                          class="w-full px-2 py-1.5 rounded border border-border bg-background text-xs"
                          placeholder="例如：GPT-4"
                        />
                      </div>
                      <label class="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={modelForm.supportsVision}
                          onChange={e => setModelForm({ ...modelForm, supportsVision: (e.target as HTMLInputElement).checked })}
                          class="w-4 h-4"
                        />
                        支持视觉（识图）
                      </label>
                      <div class="flex gap-2">
                        <button onClick={handleSaveModel} class="flex-1 px-3 py-1.5 bg-accent text-white rounded text-xs">保存</button>
                        <button onClick={() => { setShowModelForm(false); setEditingModel(null) }} class="px-3 py-1.5 bg-surface-hover border border-border rounded text-xs">取消</button>
                      </div>
                    </div>
                  )}
                  
                  <div class="space-y-2 mt-2">
                    {(currentCustomProvider?.models || []).map(model => (
                      <div key={model.id} class="flex items-center justify-between p-2 bg-surface rounded border border-border">
                        <div class="flex-1">
                          <div class="text-xs font-medium">{model.name}</div>
                          <div class="text-[10px] text-muted">{model.id}{model.supportsVision ? ' · 支持视觉' : ''}</div>
                        </div>
                        <div class="flex gap-1">
                          <button onClick={() => handleEditModel(model)} class="text-xs px-2 py-1 text-accent hover:bg-accent/10 rounded">编辑</button>
                          <button onClick={() => handleDeleteModel(model.id)} class="text-xs px-2 py-1 text-danger hover:bg-danger/10 rounded">删除</button>
                        </div>
                      </div>
                    ))}
                    {(currentCustomProvider?.models || []).length === 0 && (
                      <div class="text-xs text-muted text-center py-2">暂无自定义模型</div>
                    )}
                  </div>
                  
                  {(currentCustomProvider?.models?.length || 0) > 0 && (
                    <div class="mt-3">
                      <label class="block font-medium mb-1 text-xs">当前使用模型</label>
                      <select
                        value={currentChat.chatModel}
                        onChange={e => updateProviderConfig(activeProvider, { chatModel: (e.target as HTMLSelectElement).value })}
                        class="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs"
                      >
                        <option value="">选择模型...</option>
                        {currentCustomProvider?.models.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.id})</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
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
                  class="w-full p-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent text-xs h-48 font-mono whitespace-pre-wrap"
                />
                <p class="text-xs text-muted mt-1">包含角色扮演指令、角色信息等，会动态插入时间、角色数据</p>
              </div>
              <div>
                <label class="block font-medium mb-1 text-xs">提示词后缀</label>
                <textarea
                  value={prompts.systemSuffix}
                  onInput={e => setPrompts({ ...prompts, systemSuffix: (e.target as HTMLTextAreaElement).value })}
                  class="w-full p-3 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent text-xs h-48 font-mono whitespace-pre-wrap"
                />
                <p class="text-xs text-muted mt-1">包含对话方式、特殊标记说明等</p>
              </div>
              <div class="grid grid-cols-2 gap-4">
                <div>
                  <label class="block font-medium mb-1 text-xs">自动回复前缀</label>
                  <input
                    type="text"
                    value={prompts.autoReplyPrefix}
                    onInput={e => setPrompts({ ...prompts, autoReplyPrefix: (e.target as HTMLInputElement).value })}
                    class="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs font-mono"
                    placeholder="("
                  />
                </div>
                <div>
                  <label class="block font-medium mb-1 text-xs">自动回复后缀</label>
                  <input
                    type="text"
                    value={prompts.autoReplySuffix}
                    onInput={e => setPrompts({ ...prompts, autoReplySuffix: (e.target as HTMLInputElement).value })}
                    class="w-full px-3 py-2 rounded-lg border border-border bg-surface text-xs font-mono"
                    placeholder=")"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader><CardTitle>💡 使用说明</CardTitle></CardHeader>
            <CardContent class="text-xs text-muted space-y-2">
              <p>• 系统提示词由 <strong>前缀 + 角色信息 + 后缀</strong> 组成</p>
              <p>• 角色信息是动态生成的，包含：时间、性格、心情、身体状况、穿着、外貌、关系、基本数据（性别/身高/体重/年龄）</p>
              <p>• 记忆信息会自动附加到提示词末尾，每条记忆带有时间戳</p>
              <p>• 修改后记得点击底部的"保存所有配置"按钮</p>
              <p>• 点击"恢复默认"可以重置为初始配置</p>
            </CardContent>
          </Card>
        </div>
      )}

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

      <Button class="w-full mt-6" onClick={handleSave}>{saved ? "已保存 ✓" : "保存所有配置"}</Button>
    </div>
  )
}
