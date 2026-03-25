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

  // ── 获取 Google 模型 ──
  if (googleApiKey && !googleApiKey.includes('your_')) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${googleApiKey}`
      );
      const data = await res.json();

      const googleModels = (data.models ?? [])
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

      allModels = [...allModels, ...googleModels];
    } catch (e) {
      console.error('Failed to fetch Google models', e);
    }
  }

  if (allModels.length === 0) {
    return Response.json({ error: 'No API keys configured or failed to fetch models' }, { status: 500 });
  }

  return Response.json({ models: allModels });
}
