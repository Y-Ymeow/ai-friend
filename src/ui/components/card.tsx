import { type JSX } from "preact"
import { cn } from "../lib/utils"

function Card({ class: className, ...props }: JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      class={cn(
        "rounded-xl border border-border bg-surface text-white shadow",
        className
      )}
      {...props}
    />
  )
}

function CardHeader({ class: className, ...props }: JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      class={cn("flex flex-col space-y-1.5 p-6", className)}
      {...props}
    />
  )
}

function CardTitle({ class: className, ...props }: JSX.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      class={cn("font-semibold leading-none tracking-tight", className)}
      {...props}
    />
  )
}

function CardDescription({ class: className, ...props }: JSX.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      class={cn("text-sm text-muted", className)}
      {...props}
    />
  )
}

function CardContent({ class: className, ...props }: JSX.HTMLAttributes<HTMLDivElement>) {
  return <div class={cn("p-6 pt-0", className)} {...props} />
}

function CardFooter({ class: className, ...props }: JSX.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      class={cn("flex items-center p-6 pt-0", className)}
      {...props}
    />
  )
}

export { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent }
