export type ThemeName = "light" | "dark" | "sunrise" | "forest";

export type ThemeOption = {
  id: ThemeName;
  label: string;
  description: string;
  preview: {
    background: string;
    foreground: string;
    card: string;
    accent: string;
  };
};

export const STORAGE_THEME_KEY = "collabboard-theme";

export const DEFAULT_THEME: ThemeName = "light";

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "light",
    label: "Light",
    description: "Clean and bright default workspace",
    preview: {
      background: "hsl(0 0% 100%)",
      foreground: "hsl(0 0% 3.9%)",
      card: "hsl(0 0% 98%)",
      accent: "hsl(0 0% 90%)",
    },
  },
  {
    id: "dark",
    label: "Dark",
    description: "Low-light canvas for focused sessions",
    preview: {
      background: "hsl(0 0% 6%)",
      foreground: "hsl(0 0% 95%)",
      card: "hsl(0 0% 12%)",
      accent: "hsl(220 70% 55%)",
    },
  },
  {
    id: "sunrise",
    label: "Sunrise",
    description: "Warm, high-contrast pastel palette",
    preview: {
      background: "hsl(34 100% 97%)",
      foreground: "hsl(24 35% 20%)",
      card: "hsl(38 100% 93%)",
      accent: "hsl(16 85% 58%)",
    },
  },
  {
    id: "forest",
    label: "Forest",
    description: "Soft green tones with calm contrast",
    preview: {
      background: "hsl(120 24% 95%)",
      foreground: "hsl(150 28% 18%)",
      card: "hsl(132 24% 90%)",
      accent: "hsl(158 42% 36%)",
    },
  },
];

export function isThemeName(value: string): value is ThemeName {
  return THEME_OPTIONS.some((theme) => theme.id === value);
}
