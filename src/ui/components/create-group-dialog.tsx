import { type FunctionalComponent } from "preact"
import { useState } from "preact/hooks"
import { Card, CardHeader, CardTitle, CardContent } from "./card"
import { Button } from "./button"
import { Badge } from "./badge"
import type { Friend } from "../../types"

interface Props {
  open: boolean
  friends: Friend[]
  preSelectedIds: string[]
  onClose: () => void
  onCreate: (name: string, friendIds: string[]) => void
}

export const CreateGroupDialog: FunctionalComponent<Props> = ({
  open, friends, preSelectedIds, onClose, onCreate
}) => {
  const [name, setName] = useState("")
  const [ids, setIds] = useState<Set<string>>(new Set(preSelectedIds))

  const toggle = (id: string) => {
    const newSet = new Set(ids)
    if (newSet.has(id)) newSet.delete(id)
    else newSet.add(id)
    setIds(newSet)
  }

  const handleCreate = () => {
    if (ids.size < 2) return
    onCreate(name.trim() || `群聊`, [...ids])
    setName("")
    setIds(new Set())
    onClose()
  }

  if (!open) return null

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <Card class="w-full max-w-sm max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <CardHeader class="flex-shrink-0">
          <CardTitle>创建群聊</CardTitle>
        </CardHeader>
        <CardContent class="flex-1 overflow-auto space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">群名（可选）</label>
            <input
              type="text"
              value={name}
              onInput={e => setName((e.target as HTMLInputElement).value)}
              class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="给群起个名字"
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">选择朋友 ({ids.size}/10)</label>
            <div class="space-y-1 max-h-48 overflow-auto">
              {friends.map(friend => (
                <div
                  key={friend.id}
                  class={`p-2 rounded-lg cursor-pointer flex items-center gap-2 ${ids.has(friend.id) ? 'bg-accent/20' : 'hover:bg-surface-hover'}`}
                  onClick={() => toggle(friend.id)}
                >
                  <div class="w-8 h-8 rounded-full bg-accent/30 flex items-center justify-center text-sm">
                    {friend.name.charAt(0)}
                  </div>
                  <span class="flex-1 truncate">{friend.name}</span>
                  {ids.has(friend.id) && <Badge variant="default" class="text-[10px]">已选</Badge>}
                </div>
              ))}
            </div>
          </div>
          <div class="flex gap-2">
            <Button variant="outline" class="flex-1" onClick={onClose}>取消</Button>
            <Button class="flex-1" onClick={handleCreate} disabled={ids.size < 2}>
              创建 ({ids.size}人)
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
