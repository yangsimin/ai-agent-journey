export async function GET() {
  const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  let allModels: any[] = [];

  // 获取 Google 模型
  if (googleApiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${googleApiKey}`
      );
      const data = await res.json();

      const googleModels = (data.models ?? [])
        .filter((m: any) =>
          m.supportedGenerationMethods?.includes('generateContent')
        )
        .map((m: any) => ({
          id: m.name.replace('models/', ''), // e.g. "gemini-2.0-flash"
          displayName: m.displayName ?? m.name,
          description: m.description || '',
          inputTokenLimit: m.inputTokenLimit || 0,
          thinking: m.thinking || false,
          provider: 'google'
        }));
      
      allModels = [...allModels, ...googleModels];
    } catch (e) {
      console.error('Failed to fetch Google models', e);
    }
  }

  // 注入 Anthropic 模型 (因为 Anthropic 没有公开的 list models API，通常写死常用的)
  if (anthropicApiKey) {
    const anthropicModels = [
      {
        id: 'claude-3-7-sonnet-20250219',
        displayName: 'Claude 3.7 Sonnet',
        description: 'Anthropic 最智能的模型',
        inputTokenLimit: 200000,
        provider: 'anthropic'
      },
      {
        id: 'claude-3-5-haiku-20241022',
        displayName: 'Claude 3.5 Haiku',
        description: 'Anthropic 速度最快的模型',
        inputTokenLimit: 200000,
        provider: 'anthropic'
      },
      {
        id: 'claude-3-opus-20240229',
        displayName: 'Claude 3 Opus',
        description: 'Anthropic 强大的复杂任务模型',
        inputTokenLimit: 200000,
        provider: 'anthropic'
      }
    ];
    allModels = [...allModels, ...anthropicModels];
  }

  if (allModels.length === 0) {
    return Response.json({ error: 'No API keys configured or failed to fetch models' }, { status: 500 });
  }

  return Response.json({ models: allModels });
}
