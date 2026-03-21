export async function GET() {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'API key not configured' }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`
    );
    const data = await res.json();

    // 只保留支持 generateContent 的模型（即可用于聊天的模型）
    const models = (data.models ?? [])
      .filter((m: any) =>
        m.supportedGenerationMethods?.includes('generateContent')
      )
      .map((m: any) => ({
        id: m.name.replace('models/', ''), // e.g. "gemini-2.0-flash"
        displayName: m.displayName ?? m.name,
        description: m.description || '',
        inputTokenLimit: m.inputTokenLimit || 0,
        thinking: m.thinking || false,
      }));

    return Response.json({ models });
  } catch {
    return Response.json({ error: 'Failed to fetch models' }, { status: 500 });
  }
}
