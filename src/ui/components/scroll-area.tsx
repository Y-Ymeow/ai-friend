import { type JSX } from "preact"
import { cn } from "../lib/utils"

function ScrollArea({
  class: className,
  children,
  ...props
}: JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div class={cn("relative overflow-auto", className)} {...props}>
      {children}
    </div>
  )
}

export { ScrollArea }
