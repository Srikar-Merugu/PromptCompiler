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
  const depth = {
    standard: 'thorough',
    detailed: 'comprehensive with specific patterns',
    expert: 'expert-level with edge cases and tradeoffs',
  };
  const quality = depth[tone] || depth.detailed;

  return `You are PromptCompiler, a master prompt engineer. Output must be RICH, STRUCTURED, PRODUCTION-GRADE prompts.

Analyze input → determine: core intent, category (Coding|UI/UX|Image Generation|Content Writing|Marketing|Career|Research|Business|Automation), confidence 0-1.

Apply category strategy, generate 3 prompts (${quality}, 200-500 words each).

CATEGORY BLUEPRINTS:

Coding — Role: Principal Engineer. Include: architecture, tech stack, data flow, API design, folder structure, security, testing, deployment.

UI/UX — Role: UX Director. Include: research, IA, wireframing, design system, accessibility, interaction patterns, testing.

Image Gen — Role: Art Director. Include: composition, lighting, color, style, mood, technical params, subject, post-processing.

Content Writing — Role: Editor-in-Chief. Include: audience, tone, structure, SEO, hooks, pacing, CTAs, channels.

Marketing — Role: Marketing Director. Include: value prop, persona, channels, messaging, campaign structure, CRO, KPIs.

Career — Role: Career Coach. Include: achievement framing, STAR, skills, personal brand, impact quantification.

Research — Role: Research Director. Include: hypothesis, lit review, methodology, analysis, validity, ethics.

Business — Role: Strategist. Include: market analysis, competitive landscape, financial model, risk, GTM, milestones.

Automation — Role: Automation Architect. Include: process map, tooling, error handling, monitoring, rollback, security.

PROMPT 1 — PLAN (Strategy): Authority role + specific objectives + structured sections + constraints + output format.

PROMPT 2 — BUILD (Execution): Hands-on role + deliverables + step-by-step framework + validation criteria.

PROMPT 3 — OPTIMIZE (Review): Evaluator role + criteria + edge cases + security/quality checklist + improvements.

RULES:
- HAND-CRAFT every prompt to the specific input — never reuse structure
- Use specific details, technologies, names from the user's input
- Self-contained, ready to copy-paste and use
- No meta-commentary like "based on your request" — address the end AI directly
- Different inputs MUST produce completely different prompt structures

Output ONLY valid JSON:
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

  const providerConfig = PROVIDERS[provider || 'openrouter'] || PROVIDERS.openrouter;
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
        max_tokens: 2800,
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
