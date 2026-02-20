import { type FunctionalComponent } from "preact"
import { useState, useRef } from "preact/hooks"
import { Button } from "../components/button"
import { Card, CardHeader, CardTitle, CardContent } from "../components/card"
import { getAppConfig, setAppConfig, exportDatabase, importDatabase, clearDatabase, getShowImages, setShowImages } from "../../db/db"
import { CHAT_MODELS, type AIProvider, type AppConfig } from "../../types"

interface Props { onBack: () => void; onReset: () => void }

export const SettingsPage: FunctionalComponent<Props> = ({ onBack, onReset }) => {
  const [config, setConfig] = useState<AppConfig>(getAppConfig())
  const [activeProvider, setActiveProvider] = useState<AIProvider>(config.activeProvider)
  const [imageProvider, setImageProvider] = useState<AIProvider>(config.imageProvider || 'zhipu')
  const [showImages, setShowImagesState] = useState(getShowImages())
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSave = () => { setAppConfig({ ...config, activeProvider, imageProvider }); setShowImages(showImages); setSaved(true); setTimeout(() => setSaved(false), 2000); }
  const updateProviderConfig = (provider: AIProvider, updates: any) => { const newProviders = { ...config.providers }; newProviders[provider] = { ...newProviders[provider], ...updates }; setConfig({ ...config, providers: newProviders }); }

  const handleImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    if (!confirm("确定导入吗？这将覆盖所有数据。")) return;
    setImporting(true);
    try { await importDatabase(file); alert("导入成功！"); location.reload(); }
    catch (e: any) { alert("导入失败: " + e.message); }
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
        <CardHeader><CardTitle>1. 对话后端 (Chat)</CardTitle></CardHeader>
        <CardContent class="space-y-4">
          <div>
            <label class="block font-medium mb-1">活跃对话提供商</label>
            <select value={activeProvider} onChange={e => setActiveProvider((e.target as HTMLSelectElement).value as AIProvider)} class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:ring-1 focus:ring-accent">
              <option value="zhipu">智谱 AI (GLM)</option>
              <option value="google">Google (Gemma/Gemini)</option>
              <option value="groq">Groq (Llama)</option>
            </select>
          </div>
          <div class="p-3 rounded-lg bg-surface-hover border border-border space-y-4">
            <div>
              <label class="block font-medium mb-1 text-xs">API Key</label>
              <input type="password" value={currentChat.apiKey} onInput={e => updateProviderConfig(activeProvider, { apiKey: (e.target as HTMLInputElement).value })} class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:ring-1 focus:ring-accent" placeholder="API Key" />
            </div>
            <div>
              <label class="block font-medium mb-1 text-xs">对话模型</label>
              <select value={currentChat.chatModel} onChange={e => updateProviderConfig(activeProvider, { chatModel: (e.target as HTMLSelectElement).value })} class="w-full px-3 py-2 rounded-lg border border-border bg-surface">
                {CHAT_MODELS[activeProvider].map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
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
                <label class="block font-medium mb-1 text-xs">尺寸</label>
                <select value={currentImage.imageSize} onChange={e => updateProviderConfig('zhipu', { imageSize: (e.target as HTMLSelectElement).value })} class="w-full p-1.5 rounded border border-border bg-surface text-xs">
                  <option value="1280x1280">1:1 (1280)</option>
                  <option value="1024x1024">1:1 (1024)</option>
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
