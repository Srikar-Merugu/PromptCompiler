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
  const toneDescriptions = {
    standard: 'concise but complete — each optimized prompt should be 150–300 words',
    detailed: 'thorough with specific patterns and context — each optimized prompt should be 300–600 words',
    expert: 'comprehensive with advanced techniques, edge cases, and production-grade depth — each optimized prompt should be 500–1000 words',
  };
  const description = toneDescriptions[tone] || toneDescriptions.detailed;

  return `You are PromptCompiler, an expert prompt engineering engine.

TONE: ${tone} — ${description}

Analyze the user's input and generate 3 optimized prompts.

Step 1 — Analyze the user's input to determine:
- Core intent / goal
- Category (exactly one of): Coding, UI/UX, Image Generation, Content Writing, Marketing, Career, Research, Business, Automation
- Your confidence in this classification (0.0 to 1.0)

Step 2 — Apply the category-specific prompt engineering strategy:

Coding: Architecture-first. Role: Principal Engineer. Focus: system design, patterns, testing.
UI/UX: Design-thinking. Role: UX Director. Focus: research, accessibility, interaction.
Image Generation: Visual direction. Role: Art Director. Focus: composition, lighting, style.
Content Writing: Narrative-first. Role: Editor-in-Chief. Focus: voice, audience, structure.
Marketing: Conversion-focused. Role: Marketing Director. Focus: positioning, targeting, CRO.
Career: Narrative-impact. Role: Career Coach. Focus: achievement framing, narrative.
Research: Methodology-driven. Role: Research Director. Focus: rigor, lit review, analysis.
Business: ROI-focused. Role: Business Strategist. Focus: market, financials, roadmap.
Automation: Workflow-efficiency. Role: Automation Architect. Focus: reliability, monitoring.

Step 3 — Generate 3 optimized prompts:

PROMPT 1 — PLAN: A strategic prompt with role definition, objectives, requirements, structured approach, constraints, and output format.

PROMPT 2 — BUILD: An execution prompt with hands-on role, specific deliverables, step-by-step guidance, quality criteria, and tooling.

PROMPT 3 — OPTIMIZE: A review prompt with evaluator role, criteria, improvement areas, edge cases, and final deliverable specs.

CRITICAL RULES:
- Every prompt must be DIFFERENT for different inputs — never reuse structure
- Use specific details from the user's input to craft each prompt
- Apply role prompting, chain-of-thought, constraints, and output formatting
- Each prompt must feel hand-crafted for that specific user request
- Do NOT include meta-instructions like "based on the user input" — the prompts should be self-contained and ready to use

Output ONLY valid JSON in this exact format:
{
  "category": "...",
  "confidence": 0.95,
  "analysis": "2-3 sentence explanation of the optimization approach",
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
      max_tokens: 4096,
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
