export function logProviderError(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[provider:${context}] ${error.message}`, { stack: error.stack });
    return;
  }
  console.error(`[provider:${context}]`, { error });
}
