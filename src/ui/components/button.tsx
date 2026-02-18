import { type JSX } from "preact"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-accent text-white shadow hover:bg-accent-hover",
        destructive: "bg-danger text-white shadow-sm hover:bg-danger/80",
        outline: "border border-border shadow-sm hover:bg-surface-hover",
        secondary: "bg-surface text-white shadow-sm hover:bg-surface-hover",
        ghost: "hover:bg-surface-hover",
        link: "text-accent underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends JSX.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({
  class: className,
  variant,
  size,
  ...props
}: ButtonProps) {
  return (
    <button
      class={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  )
}
