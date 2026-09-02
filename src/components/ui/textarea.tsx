import * as React from "react";
import { cn } from "@/src/lib/utils";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea ref={ref} {...props}
        className={cn(
          "flex min-h-15 w-full rounded-lg border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-zinc-100 shadow-sm placeholder:text-zinc-500 focus-visible:outline-none focus-visible:border-zinc-500 focus-visible:ring-1 focus-visible:ring-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 resize-none font-sans",
          className
        )}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
