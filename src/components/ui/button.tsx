import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-400 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
  {
    variants: {
      variant: {
        default: "bg-zinc-100 text-zinc-900 shadow hover:bg-zinc-200 active:bg-zinc-300",
        destructive: "bg-red-600 text-white shadow-sm hover:bg-red-700 active:bg-red-800",
        outline: "border border-zinc-800 bg-zinc-900/60 hover:bg-zinc-800 text-zinc-200 active:bg-zinc-700",
        secondary: "bg-zinc-800 text-zinc-100 hover:bg-zinc-700 active:bg-zinc-600",
        ghost: "hover:bg-zinc-800 text-zinc-300 hover:text-zinc-100 active:bg-zinc-700",
        link: "text-zinc-300 underline-offset-4 hover:underline",
        accent: "bg-emerald-600 text-white shadow hover:bg-emerald-500 active:bg-emerald-700"
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-10 rounded-md px-6 text-base",
        icon: "h-9 w-9 p-0",
        xsIcon: "h-7 w-7 p-0 text-xs"
      }
    },
    defaultVariants: {
      variant: "default",
      size: "default"
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
