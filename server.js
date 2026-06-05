require('dotenv').config();
const express = require('express');
const OpenAI = require('openai');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const PROVIDERS = {
  openai: {
    baseURL: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    name: 'OpenAI',
  },
  openrouter: {
    baseURL: 'https://openrouter.ai/api/v1',
    defaultModel: 'openai/gpt-4o',
    name: 'OpenRouter',
  },
  gemini: {
    baseURL: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-2.0-flash-001',
    name: 'Gemini',
  },
};

function getProviderConfig(provider) {
  return PROVIDERS[provider] || PROVIDERS.openrouter;
}

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

app.post('/api/compile', async (req, res) => {
  const { input, tone, provider } = req.body;

  if (!input || input.trim().length < 3) {
    return res.status(400).json({ error: 'Input must be at least 3 characters' });
  }

  const key = process.env.LLM_API_KEY;
  if (!key) {
    return res.status(400).json({
      error: 'LLM_API_KEY not configured',
      hint: 'Set LLM_API_KEY in the .env file',
    });
  }

  const providerConfig = getProviderConfig(provider || 'openrouter');
  const model = req.body.model || providerConfig.defaultModel;

  const openai = new OpenAI({
    apiKey: key,
    baseURL: providerConfig.baseURL,
  });

  try {
    const systemPrompt = buildSystemPrompt(tone || 'detailed');

    const completion = await openai.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: input },
      ],
      temperature: 0.8,
      max_tokens: 2800,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      return res.status(500).json({ error: 'Empty response from LLM' });
    }

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return res.status(500).json({ error: 'LLM response did not contain valid JSON' });
    }

    const result = JSON.parse(jsonMatch[0]);

    if (!result.prompts?.plan || !result.prompts?.build || !result.prompts?.optimize) {
      return res.status(500).json({ error: 'LLM response missing required prompt fields' });
    }

    res.json(result);
  } catch (err) {
    console.error('LLM API error:', err.message);
    res.status(500).json({ error: `LLM API error: ${err.message}` });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`PromptCompiler running at http://localhost:${PORT}`);
});
