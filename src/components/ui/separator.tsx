import { ComponentPropsWithoutRef, ElementRef, forwardRef } from "react";
import * as SeparatorPrimitive from "@radix-ui/react-separator";
import { cn } from "@/src/lib/utils";

const Separator = forwardRef<
  ElementRef<typeof SeparatorPrimitive.Root>,
  ComponentPropsWithoutRef<typeof SeparatorPrimitive.Root>
>(
  (
    { className, orientation = "horizontal", decorative = true, ...props },
    ref
  ) => (
    <SeparatorPrimitive.Root ref={ref} decorative={decorative} orientation={orientation} {...props}
      className={cn(
        "shrink-0 bg-zinc-800",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className
      )}
    />
  )
);
Separator.displayName = SeparatorPrimitive.Root.displayName;

export { Separator };
