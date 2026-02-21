"use client";

import { Check, Palette } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/ThemeProvider";
import { THEME_OPTIONS } from "@/components/theme/themes";

export function ThemePickerDialog() {
  const { theme, setTheme } = useTheme();

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Choose theme" title="Choose theme">
          <Palette className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Choose a theme</DialogTitle>
          <DialogDescription>
            Pick how your workspace looks. Light is the default theme.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2">
          {THEME_OPTIONS.map((option) => {
            const selected = option.id === theme;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setTheme(option.id)}
                className={cn(
                  "group rounded-lg border p-3 text-left transition-colors",
                  selected
                    ? "border-primary bg-accent/40"
                    : "border-border hover:border-foreground/30 hover:bg-accent/20"
                )}
                aria-pressed={selected}
              >
                <div className="mb-3 flex items-start justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{option.label}</p>
                    <p className="text-xs text-muted-foreground">{option.description}</p>
                  </div>
                  {selected && <Check className="mt-0.5 h-4 w-4 text-primary" />}
                </div>
                <div
                  className="overflow-hidden rounded-md border"
                  style={{ borderColor: option.preview.accent }}
                >
                  <div
                    className="flex items-center justify-between px-2 py-1.5"
                    style={{ backgroundColor: option.preview.card }}
                  >
                    <div
                      className="h-2.5 w-12 rounded"
                      style={{ backgroundColor: option.preview.foreground, opacity: 0.2 }}
                    />
                    <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: option.preview.accent }} />
                  </div>
                  <div
                    className="space-y-2 px-2 py-2.5"
                    style={{ backgroundColor: option.preview.background }}
                  >
                    <div
                      className="h-2 rounded"
                      style={{ backgroundColor: option.preview.foreground, opacity: 0.25 }}
                    />
                    <div
                      className="h-2 w-4/5 rounded"
                      style={{ backgroundColor: option.preview.foreground, opacity: 0.2 }}
                    />
                    <div className="h-2 w-1/2 rounded" style={{ backgroundColor: option.preview.accent }} />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
