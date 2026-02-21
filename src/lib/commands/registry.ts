/**
 * Command registry - shared by CommandPalette and AI Chat.
 * AI Chat maps user input to tools; palette uses direct handlers.
 */

import type { CommandDefinition } from "./types";

/** Commands that the AI can execute via tools. Used for help / discovery. */
export const AI_CAPABLE_COMMANDS: CommandDefinition[] = [
  { id: "create-sticky", name: "Add sticky", description: "Create sticky notes", category: "tools", keywords: ["sticky", "note", "add"] },
  { id: "create-shape", name: "Add shape", description: "Create rectangles and circles", category: "tools", keywords: ["rect", "circle", "shape"] },
  { id: "create-frame", name: "Add frame", description: "Create frames for grouping", category: "tools", keywords: ["frame", "group"] },
  { id: "move", name: "Move objects", description: "Move or rearrange objects", category: "edit", keywords: ["move", "arrange"] },
  { id: "resize", name: "Resize", description: "Resize objects or frames", category: "edit", keywords: ["resize", "fit"] },
  { id: "change-color", name: "Change color", description: "Change object colors", category: "edit", keywords: ["color", "recolor"] },
  { id: "arrange-grid", name: "Arrange in grid", description: "Arrange objects in a grid", category: "edit", keywords: ["grid", "arrange"] },
  { id: "space-evenly", name: "Space evenly", description: "Space objects evenly", category: "edit", keywords: ["space", "distribute"] },
  { id: "find", name: "Find", description: "Find objects by text", category: "edit", keywords: ["find", "search"] },
  { id: "zoom-in", name: "Zoom in", description: "Zoom in", category: "view", keywords: ["zoom", "in"] },
  { id: "zoom-out", name: "Zoom out", description: "Zoom out", category: "view", keywords: ["zoom", "out"] },
  { id: "zoom-fit", name: "Zoom to fit", description: "Frame all content", category: "view", keywords: ["fit", "show all"] },
];
