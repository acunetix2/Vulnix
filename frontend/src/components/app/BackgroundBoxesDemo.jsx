"use client";
import { Boxes } from "../ui/background-boxes";
import { cn } from "@/lib/utils";

export function BackgroundBoxesDemo({ className }) {
  return (
    <div
      className={cn(
        "pointer-events-none relative h-96 w-full overflow-hidden bg-slate-900",
        className,
      )}
      aria-hidden="true"
    >
      <div className="pointer-events-none absolute inset-0 z-20 h-full w-full bg-slate-900 [mask-image:radial-gradient(transparent,white)]" />
      <Boxes />
    </div>
  );
}
