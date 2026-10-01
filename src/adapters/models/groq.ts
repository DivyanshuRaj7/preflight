import { OpenRouterSemanticProvider } from "./openrouter.js";
import type { FetchFn } from "./openrouter.js";

// Groq direct-API semantic provider. Groq exposes an OpenAI-compatible chat
// endpoint, so this is a thin, honestly-named specialization of the OpenRouter
// adapter (same request/response contract, different endpoint and key) — no
// duplicated HTTP logic, no SDK dependency. All trust rules are inherited:
// strict JSON, provenance validation downstream, never silent fallback.
export const GROQ_PROVIDER_NAME = "groq-semantic";
export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
export const DEFAULT_GROQ_MODEL = "qwen/qwen3.8-27b";

export type GroqOptions = {
  apiKey: string;
  model?: string;
  endpoint?: string;
  timeoutMs?: number;
  fetchFn?: FetchFn;
  sendImage?: boolean;
};

function semanticError(code: "SEMANTIC_UNAVAILABLE", message: string): Error {
  return Object.assign(new Error(`[${code}] ${message}`), { code });
}

export class GroqSemanticProvider extends OpenRouterSemanticProvider {
  override readonly name = GROQ_PROVIDER_NAME;

  constructor(options: GroqOptions) {
    super({
      apiKey: options.apiKey,
      model: options.model ?? DEFAULT_GROQ_MODEL,
      endpoint: options.endpoint ?? GROQ_ENDPOINT,
      timeoutMs: options.timeoutMs,
      fetchFn: options.fetchFn,
      sendImage: options.sendImage,
    });
  }
}

export function createGroqSemanticProvider(
  env: NodeJS.ProcessEnv = process.env,
  overrides?: { fetchFn?: FetchFn; timeoutMs?: number; sendImage?: boolean },
): GroqSemanticProvider {
  const apiKey = env.GROQ_API_KEY ?? "";
  if (!apiKey.trim()) {
    throw semanticError("SEMANTIC_UNAVAILABLE", "GROQ_API_KEY is not set; live semantic inference is unavailable.");
  }
  return new GroqSemanticProvider({
    apiKey,
    model: env.GROQ_MODEL,
    fetchFn: overrides?.fetchFn,
    timeoutMs: overrides?.timeoutMs,
    sendImage: overrides?.sendImage,
  });
}
