require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const ANALYSIS_PROMPT = `Analyze this user request and return ONLY valid JSON:
{
  "category": "Coding|UI/UX|Image Generation|Content Writing|Marketing|Career|Research|Business|Automation",
  "confidence": 0.0-1.0,
  "analysis": "2-3 sentence explanation of the user's core intent",
  "technologies": ["relevant tech, tools, or methods"],
  "focusAreas": ["key aspects to address"],
  "complexity": "simple|medium|complex",
  "userGoal": "what they want to achieve"
}`;

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

function buildDepthDescription(tone) {
  const map = {
    standard: 'concise but complete',
    detailed: 'comprehensive with specific patterns and examples',
    expert: 'expert-level with edge cases, tradeoffs, and production battle-testing',
  };
  return map[tone] || map.detailed;
}

function assemblePlanPrompt(input, analysis, depth) {
  const tech = analysis.technologies?.length ? analysis.technologies.join(', ') : 'appropriate technologies';
  const areas = analysis.focusAreas?.length ? analysis.focusAreas.join(', ') : 'core requirements';
  const goal = analysis.userGoal || input.slice(0, 100);

  return `You are a Principal Solutions Architect and Senior Engineer.

OBJECTIVE:
Create a ${depth} implementation blueprint for: ${goal}

CONTEXT:
Project: ${input}
Category: ${analysis.category}
Key Technologies: ${tech}
Focus Areas: ${areas}

DELIVER THE FOLLOWING SECTIONS with specific, actionable content:

1. REQUIREMENTS ANALYSIS
   - Functional requirements (user stories, core features, v1 scope)
   - Non-functional requirements (performance, scalability, security)
   - Out-of-scope items for v1

2. SYSTEM ARCHITECTURE
   - High-level architecture overview
   - Data flow between components
   - Integration points and third-party services

3. TECH STACK
   - Recommended stack with justification
   - Alternatives considered and why rejected
   - Specific to: ${tech}

4. DATA DESIGN
   - Entity-relationship overview
   - Core schemas with key fields
   - Data access patterns

5. API / INTERFACE DESIGN
   - API style with justification
   - Core endpoints or interface groups
   - Auth model

6. PROJECT STRUCTURE
   - Directory tree layout
   - Module boundaries and responsibilities

7. ROADMAP
   - Phase 1 (MVP), Phase 2 (Growth), Phase 3 (Enterprise)

8. SECURITY DESIGN
   - Auth flow, input validation, secrets management

9. SCALABILITY & PERFORMANCE
   - Expected load, scaling decisions, caching, mitigations

10. KEY DECISIONS & TRADEOFFS
    - 5-6 architectural decisions with rationale

Output only the blueprint. Be specific and concrete.`;
}

function assembleBuildPrompt(input, analysis, depth) {
  const tech = analysis.technologies?.length ? analysis.technologies.join(', ') : 'appropriate technologies';
  const goal = analysis.userGoal || input.slice(0, 100);

  return `You are a Senior Software Engineer building production-grade systems.

OBJECTIVE:
Implement a complete, working solution for: ${goal}

CONTEXT:
Project: ${input}
Category: ${analysis.category}
Technology Stack: ${tech}
Quality Level: ${depth}

IMPLEMENTATION:

1. PROJECT SCAFFOLD — all files with paths, dependency config, env setup
2. CORE IMPLEMENTATION — routes, business logic, data access, middleware
3. DELIVERABLES — complete module hierarchy, state management, API client
4. AUTH — register, verify, login, refresh, logout, guards, RBAC
5. DATABASE — schemas, migrations, seeds
6. INTEGRATIONS — external services, webhooks, API key management
7. ERROR HANDLING — consistent schema, centralized handler, structured logging
8. VALIDATION — input schemas for every endpoint
9. TESTS — unit tests for business logic, integration tests for endpoints

Rules: Complete runnable code. No truncation. No TODOs.`;
}

function assembleOptimizePrompt(input, analysis, depth) {
  const tech = analysis.technologies?.length ? analysis.technologies.join(', ') : 'the stack';
  const goal = analysis.userGoal || input.slice(0, 100);

  return `You are a Principal Engineer, Security Architect, and DevOps Expert.

OBJECTIVE:
Perform a ${depth} audit and production-hardening review of: ${goal}

CONTEXT:
Project: ${input}
Category: ${analysis.category}
Technology Stack: ${tech}

REVIEW EACH SECTION:

1. CODE QUALITY — anti-patterns, SOLID violations, cyclomatic complexity, dead code
2. SECURITY — injections, XSS, CSRF, IDOR, missing auth, exposed secrets, CVE deps, missing headers
3. PERFORMANCE — N+1 queries, missing indexes, slow queries, memory leaks, bundle size, caching
4. BUGS & EDGE CASES — race conditions, null gaps, boundary failures, network handling
5. REFACTORING — extract utilities, DRY, separation of concerns
6. TEST COVERAGE — untested paths, high-risk function tests
7. OBSERVABILITY — structured logging, metrics, error tracking, health checks
8. DEPLOYMENT — Dockerfile, compose, K8s, CI/CD, zero-downtime, rollback
9. DOCUMENTATION — README, API docs, docstrings
10. PRODUCTION SCORECARD — rate each 1-10 with justification

Provide specific fixes for every issue. Never list problems without solutions.`;
}

async function callLLM(key, provider, messages, maxTokens, temperature) {
  const providerConfig = PROVIDERS[provider || 'openrouter'] || PROVIDERS.openrouter;
  const model = providerConfig.defaultModel;

  const response = await fetch(`${providerConfig.baseURL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
      ...(provider === 'openrouter' ? { 'HTTP-Referer': 'http://localhost:3001' } : {}),
    },
    body: JSON.stringify({ model, messages, temperature, max_tokens: maxTokens }),
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error?.message || response.statusText);
  }
  return data.choices?.[0]?.message?.content;
}

app.post('/api/compile', async (req, res) => {
  const { input, tone, provider } = req.body;

  if (!input || input.trim().length < 3) {
    return res.status(400).json({ error: 'Input must be at least 3 characters' });
  }

  const key = process.env.LLM_API_KEY;
  if (!key) {
    return res.status(400).json({ error: 'LLM_API_KEY not configured', hint: 'Set LLM_API_KEY in .env' });
  }

  try {
    const analysisContent = await callLLM(key, provider || 'openrouter', [
      { role: 'system', content: ANALYSIS_PROMPT },
      { role: 'user', content: input },
    ], 500, 0.3);

    const analysisMatch = analysisContent.match(/\{[\s\S]*\}/);
    if (!analysisMatch) return res.status(502).json({ error: 'Analysis not valid JSON' });

    const analysis = JSON.parse(analysisMatch[0]);
    const depth = buildDepthDescription(tone || 'detailed');

    const prompts = {
      plan: assemblePlanPrompt(input, analysis, depth),
      build: assembleBuildPrompt(input, analysis, depth),
      optimize: assembleOptimizePrompt(input, analysis, depth),
    };

    res.json({
      category: analysis.category || 'General',
      confidence: analysis.confidence || 0.8,
      analysis: analysis.analysis || '',
      prompts,
    });

  } catch (err) {
    res.status(500).json({ error: `Error: ${err.message}` });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`PromptCompiler running at http://localhost:${PORT}`));
