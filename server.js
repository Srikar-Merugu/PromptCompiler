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
  return PROVIDERS[provider] || PROVIDERS.openai;
}

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

app.post('/api/compile', async (req, res) => {
  const { input, tone, provider, apiKey } = req.body;

  if (!input || input.trim().length < 3) {
    return res.status(400).json({ error: 'Input must be at least 3 characters' });
  }

  const key = apiKey || process.env.LLM_API_KEY;
  if (!key) {
    return res.status(400).json({
      error: 'API key is required',
      hint: 'Enter your API key in the sidebar settings, or set LLM_API_KEY in .env',
    });
  }

  const providerConfig = getProviderConfig(provider || 'openai');
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
      max_tokens: 2048,
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
