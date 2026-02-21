/**
 * @MODULE_ID core.ai-router
 * @STAGE global
 * @DATA_INPUTS ["prompt", "provider_order"]
 * @REQUIRED_TOOLS ["logManagementProtocol"]
 */
import { logManagementProtocol } from "@/core/agent-factory";
import Anthropic from "@anthropic-ai/sdk";

type ProviderId = "openai" | "anthropic" | "google" | "groq";

type SmartAIRequest = {
  prompt: string;
  userId?: string | null;
  organizationId?: string | null;
};

type SmartAIResponse = {
  text: string;
  providerUsed: ProviderId;
  failoverUsed: boolean;
};

type ProviderHandler = (prompt: string) => Promise<string>;

const normalizeProvider = (value: string | undefined): ProviderId | null => {
  if (!value) return null;
  const lower = value.trim().toLowerCase();
  if (lower === "openai" || lower === "anthropic" || lower === "google" || lower === "groq") {
    return lower;
  }
  return null;
};

const parseProviders = (value: string | undefined): ProviderId[] => {
  if (!value) return [];
  return value
    .split(",")
    .map((item) => normalizeProvider(item))
    .filter((item): item is ProviderId => Boolean(item));
};

const detectRateLimit = (error: unknown) => {
  const message =
    error instanceof Error ? error.message : String(error ?? "");
  return /rate limit|429|too many requests/i.test(message);
};

const providerHandlers: Record<ProviderId, ProviderHandler> = {
  openai: async (prompt) => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error("OpenAI API key missing.");
    }
    return `OpenAI response placeholder: ${prompt}`;
  },
  anthropic: async (prompt) => {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error("Anthropic API key missing.");
    }
    
    // Initialize Claude (Anthropic) client
    const anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
    
    // Call Claude API
    const message = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022", // Latest Claude 3.5 Sonnet
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    });
    
    // Extract text from response
    const textContent = message.content.find((block) => block.type === "text");
    if (!textContent || textContent.type !== "text") {
      throw new Error("No text content in Claude response");
    }
    
    return textContent.text;
  },
  google: async (prompt) => {
    if (!process.env.GOOGLE_AI_API_KEY) {
      throw new Error("Google AI API key missing.");
    }
    return `Google AI response placeholder: ${prompt}`;
  },
  groq: async (prompt) => {
    if (!process.env.GROQ_API_KEY) {
      throw new Error("Groq API key missing.");
    }
    return `Groq response placeholder: ${prompt}`;
  },
};

const buildProviderOrder = (): ProviderId[] => {
  const primary = normalizeProvider(process.env.AI_PRIMARY_PROVIDER) ?? "openai";
  const backups = parseProviders(process.env.AI_BACKUP_PROVIDERS);
  const all = [primary, ...backups].filter(Boolean);
  return Array.from(new Set(all));
};

export const getSmartAIResponse = async ({
  prompt,
  userId,
  organizationId,
}: SmartAIRequest): Promise<SmartAIResponse> => {
  const providerOrder = buildProviderOrder();
  let lastError: unknown = null;

  for (let index = 0; index < providerOrder.length; index += 1) {
    const provider = providerOrder[index];
    const handler = providerHandlers[provider];
    try {
      const text = await handler(prompt);
      const failoverUsed = index > 0;
      if (failoverUsed && userId) {
        await logManagementProtocol({
          userId,
          organizationId: organizationId ?? null,
          agentName: "Koordinator",
          summary: "Primärsystem ausgelastet – wechsle auf Backup-Intelligenz.",
          details: `Failover from ${providerOrder[0]} to ${provider}.`,
        });
      }
      return {
        text,
        providerUsed: provider,
        failoverUsed,
      };
    } catch (error) {
      const rateLimited = detectRateLimit(error);
      lastError = rateLimited
        ? new Error("Rate limit hit on provider.")
        : error;
      if (index === providerOrder.length - 1) {
        break;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("All AI providers failed.");
};
