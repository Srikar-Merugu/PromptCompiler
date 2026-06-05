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

  return `You are PromptCompiler. Generate 3 MASTER-LEVEL prompts (${quality}, 150-300 words each).

First classify: category (Coding|UI/UX|Image Generation|Content Writing|Marketing|Career|Research|Business|Automation), confidence 0-1.

Apply category lens:
- Coding → Principal Engineer: architecture, tech stack, data flow, API, security, testing
- UI/UX → UX Director: research, IA, design system, accessibility, interaction
- Image Gen → Art Director: composition, lighting, color, style, technical params
- Content → Editor-in-Chief: audience, tone, SEO, hooks, CTAs
- Marketing → Marketing Director: value prop, persona, channels, CRO, KPIs
- Career → Career Coach: STAR, framing, skills, impact quantification
- Research → Research Director: hypothesis, lit review, methodology, analysis
- Business → Strategist: market, financial model, risk, GTM
- Automation → Automation Architect: process map, error handling, monitoring

Each prompt's text must START WITH its stage heading, then the content:

PROMPT 1 — PLAN (Strategy & Architecture)
[follow with: Requirements Analysis, System Architecture, Tech Stack, Data Design, API/Interface Design, Project Structure, Roadmap, Security, Scalability, Key Decisions]

PROMPT 2 — BUILD (Implementation & Execution)
[follow with: Scaffold, Core Implementation, Deliverables, Auth, Database, Integrations, Error Handling, Validation, Tests]

PROMPT 3 — OPTIMIZE (Review & Refinement)
[follow with: Code Quality, Security Audit, Performance, Bugs & Edge Cases, Refactoring, Test Coverage, Observability, Deployment/CI-CD, Documentation, Scorecard]

CRITICAL: Content must be 100% AI-GENERATED for this specific input. Use the section lists above as format guide only. Every prompt must:
- Reference specific technologies, features, and context from the user input
- Feel hand-crafted with concrete details
- Be self-contained and ready to copy-paste
- Never reuse wording between different inputs
- Address the end AI directly (no "based on your request")

Output JSON: {"category":"...","confidence":0.95,"analysis":"...","prompts":{"plan":"...","build":"...","optimize":"..."}}`; }

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
        max_tokens: 1500,
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(502).json({
        error: `LLM API error: ${data.error?.message || response.statusText}`,
      });
    }

    const content = data.choices?.[0]?.message?.content;
    if (!content) return res.status(502).json({ error: 'Empty response from LLM' });

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: 'Response not valid JSON' });

    const result = JSON.parse(jsonMatch[0]);
    if (!result.prompts?.plan || !result.prompts?.build || !result.prompts?.optimize) {
      return res.status(502).json({ error: 'Missing required prompt fields' });
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
};
