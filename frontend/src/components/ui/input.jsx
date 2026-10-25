import { Input as InputPrimitive } from "@base-ui/react/input"
import { cva } from "class-variance-authority";
import { cn } from "cn"

// Same three steps as Button, so a form row never has to invent a height to
// keep its control and its action level.
const inputVariants = cva(
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-3 py-1 text-base transition-colors outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:border-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
  {
    variants: {
      size: {
        sm: "h-8 text-[0.8rem]",
        default: "h-9",
        lg: "h-10 px-3",
      },
    },
    defaultVariants: {
      size: "default",
    },
  }
)

function Input({
  className,
  type,
  size = "default",
  ...props
}) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      data-size={size}
      className={cn(inputVariants({ size }), className)}
      {...props}
    />
  )
}

export { Input }
