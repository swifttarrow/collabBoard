/**
 * Command registry types - shared by CommandPalette and AI Chat.
 */

export type CommandCategory =
  | "tools"
  | "view"
  | "edit"
  | "version"
  | "ai"
  | "collaboration"
  | "debug";

export type CommandDefinition<TParams = unknown> = {
  id: string;
  name: string;
  description: string;
  category: CommandCategory;
  /** Handler for direct execution (command palette). May be async. */
  handler?: (params: TParams) => void | Promise<void>;
  /** Keywords for search/fuzzy match */
  keywords?: string[];
};

/** AI Chat maps user input to CommandDefinition + args, or a MacroPlan. */
export type MacroPlan = {
  commands: Array<{ definitionId: string; args?: Record<string, unknown> }>;
};
