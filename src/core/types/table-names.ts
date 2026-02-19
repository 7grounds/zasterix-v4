import type { Database } from "./database.types";

export type TableName = keyof Database["public"]["Tables"];

export const TABLE_NAMES = {
  AGENT_DEFINITIONS: "agent_definitions",
  AGENT_TEMPLATES: "agent_templates",
  AGENT_BLUEPRINTS: "agent_blueprints",
  SHARED_LOGIC: "shared_logic",
  BILLING_LOGS: "billing_logs",
  SEARCH_LOGS: "search_logs",
  USER_FLOWS: "user_flows",
  ORGANIZATIONS: "organizations",
  PROFILES: "profiles",
  PROJECTS: "projects",
  USER_PROGRESS: "user_progress",
  UNIVERSAL_HISTORY: "universal_history",
  USER_ASSET_HISTORY: "user_asset_history",
} as const satisfies Record<string, TableName>;
