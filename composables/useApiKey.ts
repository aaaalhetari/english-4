export function useApiKey() {
  // Stored in localStorage on this device only. Sent directly to Anthropic's
  // API per request - never stored on any server.
  const apiKey = useLocalStorage<string>('vocab_app_api_key', '')

  function hasKey() {
    return !!apiKey.value && apiKey.value.trim().length > 0
  }

  function clearKey() {
    apiKey.value = ''
  }

  return { apiKey, hasKey, clearKey }
}
