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
    standard: 'thorough and actionable',
    detailed: 'comprehensive with specific implementation patterns',
    expert: 'expert-level with edge cases, tradeoffs, and production battle-testing',
  };
  const quality = depth[tone] || depth.detailed;

  return `You are PromptCompiler, a world-class prompt engineering engine. Your output must be MASTER-LEVEL prompts — rich, structured, and production-grade.

Analyze the user's input and determine:
- Core intent / goal
- Category (one of): Coding, UI/UX, Image Generation, Content Writing, Marketing, Career, Research, Business, Automation
- Confidence score 0.0-1.0

Then apply the category-specific engineering strategy and generate 3 optimized prompts (${quality}, 300-800 words each).

CATEGORY STRATEGIES:

**Coding** — Architecture-first. Role: Principal Engineer / Solutions Architect.
- Include: system architecture, tech stack decisions, data flow, API design, folder structure, database schema, security, testing strategy, deployment. Use specific code patterns, frameworks, and libraries relevant to the input.

**UI/UX** — Design-thinking. Role: UX Director / Design Lead.
- Include: user research methodology, information architecture, wireframing approach, visual design system, accessibility standards, interaction patterns, prototyping tools, usability testing plan. Reference specific design principles.

**Image Generation** — Visual direction. Role: Art Director / Prompt Artist.
- Include: composition guidelines, lighting setup, color palette, style references, mood and atmosphere, technical parameters (aspect ratio, camera specs), subject positioning, background treatment, post-processing direction.

**Content Writing** — Narrative-first. Role: Editor-in-Chief / Content Strategist.
- Include: target audience analysis, tone and voice guidelines, content structure, SEO strategy, hook and opening techniques, pacing, calls to action, distribution channels, engagement metrics.

**Marketing** — Conversion-focused. Role: Marketing Director / Growth Lead.
- Include: unique value proposition, target persona, channel strategy, messaging hierarchy, campaign structure, conversion optimization, A/B testing plan, budget allocation, KPI targets, competitive positioning.

**Career** — Narrative-impact. Role: Career Coach / Hiring Manager.
- Include: achievement framing methodology, STAR technique application, skills articulation, personal brand positioning, industry trend alignment, impact quantification, narrative arc development.

**Research** — Methodology-driven. Role: Research Director / Senior Researcher.
- Include: hypothesis formulation, literature review approach, methodology selection, data collection methods, analysis framework, validity threats, ethical considerations, dissemination plan.

**Business** — ROI-focused. Role: Business Strategist / Management Consultant.
- Include: market analysis framework, competitive landscape, financial modeling approach, risk assessment matrix, go-to-market strategy, operational plan, milestone definition, success metrics.

**Automation** — Workflow-efficiency. Role: Automation Architect / DevOps Lead.
- Include: process mapping, tool selection criteria, error handling strategy, monitoring and alerting, rollback procedures, security considerations, performance benchmarks, maintenance plan.

GENERATE 3 PROMPTS:

PROMPT 1 — PLAN (Strategy & Architecture)
A comprehensive planning prompt. Include:
- Authority role definition matching the category
- Specific objectives derived from the user input
- Structured sections with concrete requirements
- Constraints, assumptions, and success criteria
- Expected output format and deliverables
- Reference to specific tools, technologies, or methods

PROMPT 2 — BUILD (Implementation & Execution)
An execution-focused prompt. Include:
- Hands-on expert role definition
- Specific deliverables with quality bar
- Step-by-step execution framework
- Code snippets, patterns, or templates where relevant
- Validation and testing criteria
- Performance and quality expectations

PROMPT 3 — OPTIMIZE (Review & Refinement)
A critical review prompt. Include:
- Senior evaluator role definition
- Specific review criteria organized by category
- Edge cases and failure mode analysis
- Security, performance, and quality checklist
- Actionable improvement directives
- Final deliverable specification

CRITICAL RULES:
- Every prompt must feel HAND-CRAFTED for that specific user input — never copy-paste structure
- Use specific details, names, technologies, and context from the user's input throughout
- Each prompt must be self-contained, ready to copy and use immediately
- Do NOT include meta-commentary like "based on your request" — write the prompt as if addressing the end AI directly
- Vary sentence structure, section organization, and emphasis based on the input
- Two completely different inputs must produce completely different prompt structures

Output ONLY valid JSON:
{
  "category": "...",
  "confidence": 0.95,
  "analysis": "2-3 sentence explanation of the optimization approach",
  "prompts": {
    "plan": "full PLAN prompt text",
    "build": "full BUILD prompt text",
    "optimize": "full OPTIMIZE prompt text"
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
        max_tokens: 4096,
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
