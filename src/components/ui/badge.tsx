import { FC } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/src/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-zinc-400 focus:ring-offset-2 whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-transparent bg-zinc-100 text-zinc-900 shadow hover:bg-zinc-200",
        secondary: "border-transparent bg-zinc-800 text-zinc-200 hover:bg-zinc-700",
        destructive: "border-transparent bg-red-900/50 text-red-200 border-red-800/60",
        outline: "text-zinc-300 border-zinc-700",
        success: "border-emerald-800/60 bg-emerald-950/60 text-emerald-300",
        warning: "border-amber-800/60 bg-amber-950/60 text-amber-300",
        info: "border-blue-800/60 bg-blue-950/60 text-blue-300",
        purple: "border-purple-800/60 bg-purple-950/60 text-purple-300"
      }
    },
    defaultVariants: {
      variant: "default"
    }
  }
);

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
  key?: Key;
  className?: string;
  children?: ReactNode;
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "purple" | null;
}

function Badge({ className, variant = "default", children, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
