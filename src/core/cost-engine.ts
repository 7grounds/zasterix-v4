/**
 * @MODULE_ID core.cost-engine
 * @STAGE global
 * @DATA_INPUTS ["tokens", "provider"]
 * @REQUIRED_TOOLS []
 */
type ProviderId = "openai" | "anthropic" | "google" | "groq";

type ProviderPricing = {
  perThousandUsd: number;
};

const DEFAULT_PRICING: Record<ProviderId, ProviderPricing> = {
  openai: { perThousandUsd: 0.6 },
  anthropic: { perThousandUsd: 0.8 },
  google: { perThousandUsd: 0.5 },
  groq: { perThousandUsd: 0.1 },
};

const FX_RATE_CHF_PER_USD = 0.92;

export const estimateTokens = (input: string) => {
  const normalized = input.trim();
  if (!normalized) return 0;
  return Math.ceil(normalized.length / 4);
};

export const calculateCost = ({
  tokens,
  provider,
  pricing = DEFAULT_PRICING,
  fxRate = FX_RATE_CHF_PER_USD,
}: {
  tokens: number;
  provider: ProviderId;
  pricing?: Record<ProviderId, ProviderPricing>;
  fxRate?: number;
}) => {
  const perThousand = pricing[provider]?.perThousandUsd ?? 0;
  const costUsd = (tokens / 1000) * perThousand;
  const costChf = costUsd * fxRate;

  return {
    costUsd,
    costChf,
  };
};

export const simulateGrowthCost = ({
  provider,
  avgTokensPerRequest,
  requestsPerUser,
  newUsers,
}: {
  provider: ProviderId;
  avgTokensPerRequest: number;
  requestsPerUser: number;
  newUsers: number;
}) => {
  const totalRequests = newUsers * requestsPerUser;
  const totalTokens = totalRequests * avgTokensPerRequest;
  const { costUsd, costChf } = calculateCost({
    tokens: totalTokens,
    provider,
  });

  return {
    totalRequests,
    totalTokens,
    costUsd,
    costChf,
  };
};
