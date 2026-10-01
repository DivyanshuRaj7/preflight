import { describe, expect, it } from "vitest";
import { parseSendImageFlag, resolveSemanticProvider } from "../../src/adapters/extraction/factory.js";
import { GeminiSemanticProvider } from "../../src/adapters/models/gemini.js";
import { OpenRouterSemanticProvider } from "../../src/adapters/models/openrouter.js";

const deps = { stubDocuments: {}, ocrDocuments: {} } as never;

describe("environment configuration", () => {
  it("parses the shared image flag consistently", () => {
    expect(parseSendImageFlag({ SEMANTIC_SEND_IMAGE: "true" } as NodeJS.ProcessEnv)).toBe(true);
    expect(parseSendImageFlag({ SEMANTIC_SEND_IMAGE: "True" } as NodeJS.ProcessEnv)).toBe(true);
    expect(parseSendImageFlag({ SEMANTIC_SEND_IMAGE: "1" } as NodeJS.ProcessEnv)).toBe(true);
    expect(parseSendImageFlag({ SEMANTIC_SEND_IMAGE: "yes" } as NodeJS.ProcessEnv)).toBe(false);
    expect(parseSendImageFlag({} as NodeJS.ProcessEnv)).toBe(false);
  });

  it("gemini selection requires the Gemini key, not the OpenRouter key", () => {
    expect(() =>
      resolveSemanticProvider(deps, { SEMANTIC_PROVIDER: "gemini" } as NodeJS.ProcessEnv),
    ).toThrowError(/GEMINI_API_KEY/);
    expect(() =>
      resolveSemanticProvider(
        deps,
        { SEMANTIC_PROVIDER: "gemini", OPENROUTER_API_KEY: "other-key" } as NodeJS.ProcessEnv,
      ),
    ).toThrowError(/GEMINI_API_KEY/);
  });

  it("openrouter selection requires the OpenRouter key, not the Gemini key", () => {
    expect(() =>
      resolveSemanticProvider(deps, { SEMANTIC_PROVIDER: "openrouter" } as NodeJS.ProcessEnv),
    ).toThrowError(/OPENROUTER_API_KEY/);
  });

  it("forwards the image flag to both live providers identically", () => {
    const gemini = resolveSemanticProvider(deps, {
      SEMANTIC_PROVIDER: "gemini",
      GEMINI_API_KEY: "k",
      SEMANTIC_SEND_IMAGE: "true",
    } as NodeJS.ProcessEnv);
    const openrouter = resolveSemanticProvider(deps, {
      SEMANTIC_PROVIDER: "openrouter",
      OPENROUTER_API_KEY: "k",
      SEMANTIC_SEND_IMAGE: "true",
    } as NodeJS.ProcessEnv);
    expect(gemini).toBeInstanceOf(GeminiSemanticProvider);
    expect(openrouter).toBeInstanceOf(OpenRouterSemanticProvider);
    // White-box read: proves the shared flag reaches both providers identically.
    const flagOf = (p: unknown) => (p as { sendImage?: boolean }).sendImage;
    expect(flagOf(gemini)).toBe(true);
    expect(flagOf(openrouter)).toBe(true);
    const off = resolveSemanticProvider(deps, {
      SEMANTIC_PROVIDER: "gemini",
      GEMINI_API_KEY: "k",
    } as NodeJS.ProcessEnv);
    expect(flagOf(off)).toBe(false);
  });

  it("missing keys fail closed with typed errors", () => {
    for (const env of [{ SEMANTIC_PROVIDER: "gemini" }, { SEMANTIC_PROVIDER: "openrouter" }]) {
      try {
        resolveSemanticProvider(deps, env as NodeJS.ProcessEnv);
        expect.unreachable("should have thrown SEMANTIC_UNAVAILABLE");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("SEMANTIC_UNAVAILABLE");
      }
    }
  });
});
