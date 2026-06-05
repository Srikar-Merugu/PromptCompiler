const PROVIDERS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash-001',
  },
};

function buildSystemPrompt(tone) {
  const wordTargets = {
    standard: '80-120 words each',
    detailed: '120-200 words each',
    expert: '200-350 words each',
  };
  const target = wordTargets[tone] || wordTargets.detailed;

  return `You are PromptCompiler, an expert prompt engineer. Analyze the user's input and generate 3 optimized prompts (${target}).

Step 1 — Determine:
- Core intent
- Category (one of): Coding, UI/UX, Image Generation, Content Writing, Marketing, Career, Research, Business, Automation
- Confidence score 0.0-1.0

Step 2 — Apply strategy:
- Coding: Architecture-first. Role: Principal Engineer.
- UI/UX: Design-thinking. Role: UX Director.
- Image Generation: Visual direction. Role: Art Director.
- Content Writing: Narrative-first. Role: Editor-in-Chief.
- Marketing: Conversion-focused. Role: Marketing Director.
- Career: Narrative-impact. Role: Career Coach.
- Research: Methodology-driven. Role: Research Director.
- Business: ROI-focused. Role: Business Strategist.
- Automation: Workflow-efficiency. Role: Automation Architect.

Step 3 — Generate 3 prompts using the strategy above:

PROMPT 1 — PLAN: Strategic prompt with role, objectives, requirements, and output format.

PROMPT 2 — BUILD: Execution prompt with deliverables, steps, and quality criteria.

PROMPT 3 — OPTIMIZE: Review prompt with evaluation criteria and improvements.

RULES:
- Use specific details from the user's input — never templates
- Each prompt must be self-contained and ready to use
- Output ONLY valid JSON:
{
  "category": "...",
  "confidence": 0.95,
  "analysis": "brief explanation",
  "prompts": {
    "plan": "...",
    "build": "...",
    "optimize": "..."
  }
}`;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { input, tone, provider } = req.body;

  if (!input || input.trim().length < 3) {
    return res.status(400).json({ error: 'Input must be at least 3 characters' });
  }

  const key = process.env.LLM_API_KEY;
  if (!key) {
    return res.status(400).json({
      error: 'LLM_API_KEY not configured',
      hint: 'Add LLM_API_KEY in Vercel dashboard Environment Variables',
    });
  }

  const providerConfig = PROVIDERS[provider || 'openai'] || PROVIDERS.openai;
  const model = providerConfig.defaultModel;

  try {
    const response = await fetch(`${providerConfig.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://promptcompiler.vercel.app' } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: buildSystemPrompt(tone || 'detailed') },
          { role: 'user', content: input },
        ],
        temperature: 0.8,
        max_tokens: 2048,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(502).json({
        error: `LLM API error: ${data.error?.message || response.statusText}`,
      });
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) {
      return res.status(502).json({ error: 'Empty response from LLM' });
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(502).json({ error: 'LLM response did not contain valid JSON' });
    }

    const result = JSON.parse(jsonMatch[0]);

    if (!result.prompts?.plan || !result.prompts?.build || !result.prompts?.optimize) {
      return res.status(502).json({ error: 'LLM response missing required prompt fields' });
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
};
