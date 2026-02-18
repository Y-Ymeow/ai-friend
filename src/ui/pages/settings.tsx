import { type FunctionalComponent } from "preact"
import { useState, useRef } from "preact/hooks"
import { Button } from "../components/button"
import { Card, CardHeader, CardTitle, CardContent } from "../components/card"
import { getZhipuConfig, setZhipuConfig, exportDatabase, importDatabase, clearDatabase } from "../../db/db"
import { CHAT_MODELS } from "../../types"

interface Props {
  onBack: () => void
  onReset: () => void
}

export const SettingsPage: FunctionalComponent<Props> = ({ onBack, onReset }) => {
  const config = getZhipuConfig()
  const [apiKey, setApiKey] = useState(config?.apiKey || "")
  const [chatModel, setChatModel] = useState(config?.chatModel || "GLM-4.6V-Flash")
  const [saved, setSaved] = useState(false)
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleSave = () => {
    setZhipuConfig({ apiKey, chatModel })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleExport = async () => {
    try {
      const blob = await exportDatabase()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `ai-friends-backup-${new Date().toISOString().slice(0, 10)}.db`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert("导出失败: " + (e as Error).message)
    }
  }

  const handleImport = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    
    if (!confirm("导入将覆盖当前所有数据，确定继续？")) {
      ;(e.target as HTMLInputElement).value = ""
      return
    }

    setImporting(true)
    try {
      await importDatabase(file)
      alert("导入成功！页面将刷新")
      location.reload()
    } catch (err) {
      alert("导入失败: " + (err as Error).message)
    } finally {
      setImporting(false)
      ;(e.target as HTMLInputElement).value = ""
    }
  }

  const handleClear = async () => {
    if (!confirm("确定要清空所有数据吗？此操作不可恢复！")) return
    if (!confirm("再次确认：清空所有好友、会话和消息？")) return
    
    await clearDatabase()
    onReset()
    alert("数据已清空")
  }

  return (
    <div class="h-full overflow-auto p-4 max-w-lg mx-auto">
      {/* 头部 */}
      <div class="flex items-center gap-3 mb-6">
        <button class="text-xl text-muted hover:text-white" onClick={onBack}>←</button>
        <h1 class="text-xl font-semibold">设置</h1>
      </div>

      {/* API 配置 */}
      <Card class="mb-4">
        <CardHeader>
          <CardTitle>智谱 AI 配置</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">API Key</label>
            <input
              type="password"
              value={apiKey}
              onInput={e => setApiKey((e.target as HTMLInputElement).value)}
              class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="从 open.bigmodel.cn 获取"
            />
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">对话模型</label>
            <div class="space-y-2">
              {CHAT_MODELS.map(model => (
                <label key={model.id} class="flex items-start gap-2 p-2 rounded border border-border cursor-pointer hover:bg-surface-hover">
                  <input
                    type="radio"
                    name="chatModel"
                    checked={chatModel === model.id}
                    onChange={() => setChatModel(model.id)}
                    class="mt-1"
                  />
                  <div>
                    <div class="font-medium">{model.name}</div>
                    <div class="text-xs text-muted">{model.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <Button class="w-full" onClick={handleSave}>
            {saved ? "已保存 ✓" : "保存配置"}
          </Button>
        </CardContent>
      </Card>

      {/* 数据管理 */}
      <Card>
        <CardHeader>
          <CardTitle>数据管理</CardTitle>
        </CardHeader>
        <CardContent class="space-y-3">
          <Button variant="outline" class="w-full" onClick={handleExport}>
            📤 导出数据
          </Button>

          <input
            ref={fileRef}
            type="file"
            accept=".db,.sqlite,.sqlite3"
            class="hidden"
            onChange={handleImport}
          />
          <Button 
            variant="outline" 
            class="w-full" 
            onClick={() => fileRef.current?.click()}
            disabled={importing}
          >
            {importing ? "导入中..." : "📥 导入数据"}
          </Button>

          <Button variant="destructive" class="w-full" onClick={handleClear}>
            🗑️ 清空数据
          </Button>
        </CardContent>
      </Card>

      {/* 说明 */}
      <div class="mt-6 text-xs text-muted text-center">
        <p>数据存储在浏览器 IndexedDB 中</p>
        <p>建议定期导出备份</p>
      </div>
    </div>
  )
}
