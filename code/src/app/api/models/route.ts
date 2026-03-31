// Hardcoded fallback list used when Google's API is unreachable (e.g., network/proxy restrictions)
const GOOGLE_FALLBACK_MODELS = [
  { id: 'gemini-2.5-flash', displayName: 'Gemini 2.5 Flash', description: 'Fast, efficient multimodal model', inputTokenLimit: 1048576, thinking: false, provider: 'google' },
  { id: 'gemini-2.5-pro', displayName: 'Gemini 2.5 Pro', description: 'Most capable Gemini model', inputTokenLimit: 1048576, thinking: true, provider: 'google' },
  { id: 'gemini-2.0-flash', displayName: 'Gemini 2.0 Flash', description: 'Next-gen speed and performance', inputTokenLimit: 1048576, thinking: false, provider: 'google' },
  { id: 'gemini-2.0-flash-thinking-exp', displayName: 'Gemini 2.0 Flash Thinking', description: 'Flash model with thinking mode', inputTokenLimit: 1048576, thinking: true, provider: 'google' },
  { id: 'gemini-1.5-pro', displayName: 'Gemini 1.5 Pro', description: 'Long context, complex tasks', inputTokenLimit: 2097152, thinking: false, provider: 'google' },
  { id: 'gemini-1.5-flash', displayName: 'Gemini 1.5 Flash', description: 'Fast and versatile', inputTokenLimit: 1048576, thinking: false, provider: 'google' },
];

export async function GET() {
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  const anthropicBaseUrl = process.env.ANTHROPIC_BASE_URL;

  let allModels: Array<{ id: string; displayName: string; description: string; inputTokenLimit: number; thinking: boolean; provider: string }> = [];

  // ── 从 Anthropic 网关动态获取模型列表 ──
  if (anthropicApiKey && anthropicBaseUrl) {
    try {
      const res = await fetch(`${anthropicBaseUrl.replace(/\/v1\/?$/, '')}/v1/models`, {
        headers: { Authorization: `Bearer ${anthropicApiKey}` },
      });
      const data = await res.json();

      if (data.data && Array.isArray(data.data)) {
        const gatewayModels = data.data.map((m: { id: string }) => {
          const shortName = m.id.includes('/') ? m.id.split('/').pop()! : m.id;
          return {
            id: m.id,
            displayName: shortName,
            description: `网关模型: ${m.id}`,
            inputTokenLimit: 200000,
            thinking: false,
            provider: 'anthropic',
          };
        });
        allModels = [...allModels, ...gatewayModels];
      }
    } catch (e) {
      console.error('Failed to fetch gateway models', e);
    }
  }

  // ── 获取 Google 模型（网络不通时使用内置备用列表）──
  if (googleApiKey && !googleApiKey.includes('your_')) {
    let googleModels: typeof GOOGLE_FALLBACK_MODELS = [];
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${googleApiKey}`,
        { signal: AbortSignal.timeout(8000) } // 8s timeout to fail fast
      );
      const data = await res.json();

      googleModels = (data.models ?? [])
        .filter((m: { supportedGenerationMethods?: string[] }) =>
          m.supportedGenerationMethods?.includes('generateContent')
        )
        .map((m: { name: string; displayName?: string; description?: string; inputTokenLimit?: number; thinking?: boolean }) => ({
          id: m.name.replace('models/', ''),
          displayName: m.displayName ?? m.name,
          description: m.description || '',
          inputTokenLimit: m.inputTokenLimit || 0,
          thinking: m.thinking || false,
          provider: 'google',
        }));
    } catch (e) {
      console.error('Failed to fetch Google models, using fallback list', e);
      googleModels = GOOGLE_FALLBACK_MODELS;
    }

    allModels = [...allModels, ...googleModels];
  }

  if (allModels.length === 0) {
    return Response.json({ error: 'No API keys configured or failed to fetch models' }, { status: 500 });
  }

  return Response.json({ models: allModels });
}
