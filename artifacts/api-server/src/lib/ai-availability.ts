// Several services attempt an Anthropic/OpenAI call before falling back to an
// algorithmic path. When no key is configured, that attempt is guaranteed to
// fail (the SDKs throw a synchronous auth error), so callers check these
// first and skip straight to the fallback instead of paying for a doomed
// try/catch round every request.
export function hasAnthropicKey(): boolean {
  return Boolean(
    process.env.AI_INTEGRATIONS_ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY,
  );
}

export function hasOpenAIKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
