import { type FunctionalComponent } from "preact"
import { useState } from "preact/hooks"
import { Card, CardHeader, CardTitle, CardContent } from "./card"
import { Button } from "./button"

interface Props {
  open: boolean
  onClose: () => void
  onAdd: (data: { 
    name: string
    personality: string
    gender?: "female" | "male" | "other"
    height?: number
    weight?: number
    age?: number
  }) => void
}

export const AddFriendDialog: FunctionalComponent<Props> = ({ open, onClose, onAdd }) => {
  const [name, setName] = useState("")
  const [personality, setPersonality] = useState("")
  const [gender, setGender] = useState<"female" | "male" | "other">("female")
  const [height, setHeight] = useState("")
  const [weight, setWeight] = useState("")
  const [age, setAge] = useState("")

  const handleAdd = () => {
    if (!name.trim()) return
    onAdd({ 
      name: name.trim(), 
      personality: personality.trim() || "一个有趣的朋友",
      gender,
      height: height ? Number(height) : undefined,
      weight: weight ? Number(weight) : undefined,
      age: age ? Number(age) : undefined,
    })
    setName("")
    setPersonality("")
    setHeight("")
    setWeight("")
    setAge("")
    onClose()
  }

  if (!open) return null

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <Card class="w-full max-w-sm max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>添加朋友</CardTitle>
        </CardHeader>
        <CardContent class="space-y-4">
          <div>
            <label class="block text-sm font-medium mb-1">名字 *</label>
            <input
              type="text"
              value={name}
              onInput={e => setName((e.target as HTMLInputElement).value)}
              class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
              placeholder="给 TA 起个名字"
            />
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">性别</label>
            <div class="flex gap-2">
              <label class="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="gender"
                  checked={gender === "female"}
                  onChange={() => setGender("female")}
                  class="w-4 h-4"
                />
                女
              </label>
              <label class="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="gender"
                  checked={gender === "male"}
                  onChange={() => setGender("male")}
                  class="w-4 h-4"
                />
                男
              </label>
              <label class="flex items-center gap-1 text-sm">
                <input
                  type="radio"
                  name="gender"
                  checked={gender === "other"}
                  onChange={() => setGender("other")}
                  class="w-4 h-4"
                />
                其他
              </label>
            </div>
          </div>
          
          <div class="grid grid-cols-3 gap-2">
            <div>
              <label class="block text-sm font-medium mb-1">身高 (cm)</label>
              <input
                type="number"
                value={height}
                onInput={e => setHeight((e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent text-sm"
                placeholder="165"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">体重 (kg)</label>
              <input
                type="number"
                value={weight}
                onInput={e => setWeight((e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent text-sm"
                placeholder="50"
              />
            </div>
            <div>
              <label class="block text-sm font-medium mb-1">年龄</label>
              <input
                type="number"
                value={age}
                onInput={e => setAge((e.target as HTMLInputElement).value)}
                class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent text-sm"
                placeholder="20"
              />
            </div>
          </div>
          
          <div>
            <label class="block text-sm font-medium mb-1">性格</label>
            <textarea
              value={personality}
              onInput={e => setPersonality((e.target as HTMLTextAreaElement).value)}
              class="w-full px-3 py-2 rounded-lg border border-border bg-surface focus:outline-none focus:ring-1 focus:ring-accent resize-none h-20"
              placeholder="描述性格，如：开朗、幽默..."
            />
          </div>
          
          <div class="flex gap-2">
            <Button variant="outline" class="flex-1" onClick={onClose}>取消</Button>
            <Button class="flex-1" onClick={handleAdd} disabled={!name.trim()}>添加</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
