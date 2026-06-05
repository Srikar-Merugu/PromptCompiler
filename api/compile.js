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

DELIVER THE FOLLOWING SECTIONS with specific, actionable content — no generic advice:

1. REQUIREMENTS ANALYSIS
   - Functional requirements (user stories, core features, v1 scope)
   - Non-functional requirements (performance, scalability, security)
   - Out-of-scope items for v1

2. SYSTEM ARCHITECTURE
   - High-level architecture overview (components, services, roles)
   - Data flow between components
   - Integration points and third-party services
   - Architecture decisions specific to ${tech}

3. TECH STACK
   - Recommended stack with justification for each choice
   - Alternatives considered and why rejected
   - Specific to: ${tech}

4. DATA DESIGN
   - Entity-relationship overview
   - Core schemas with key fields and data types
   - Data access patterns

5. API / INTERFACE DESIGN
   - API style with justification
   - Core endpoints or interface groups
   - Auth model
   - Rate limiting, pagination, versioning

6. PROJECT STRUCTURE
   - Directory tree layout
   - Module boundaries and responsibilities
   - Monorepo vs polyrepo decision

7. ROADMAP
   - Phase 1 (MVP): must-have features
   - Phase 2 (Growth): enhancements
   - Phase 3 (Enterprise): advanced capabilities

8. SECURITY DESIGN
   - Auth flow
   - Input validation strategy
   - Secrets management
   - Compliance requirements

9. SCALABILITY & PERFORMANCE
   - Expected load model
   - Scaling decisions
   - Caching strategy
   - Known bottlenecks and mitigations

10. KEY DECISIONS & TRADEOFFS
    - 5-6 architectural decisions with rationale and tradeoffs

Output only the blueprint. Be specific and concrete.`;
}

function assembleBuildPrompt(input, analysis, depth) {
  const tech = analysis.technologies?.length ? analysis.technologies.join(', ') : 'appropriate technologies';
  const areas = analysis.focusAreas?.length ? analysis.focusAreas.join(', ') : 'core implementation';
  const goal = analysis.userGoal || input.slice(0, 100);

  return `You are a Senior Software Engineer building production-grade systems.

OBJECTIVE:
Implement a complete, working solution for: ${goal}

CONTEXT:
Project: ${input}
Category: ${analysis.category}
Technology Stack: ${tech}
Implementation Focus: ${areas}
Quality Level: ${depth}

ASSUMPTION: Architecture is already designed. Your job is to WRITE CODE — complete, working, production-ready.

IMPLEMENTATION REQUIREMENTS:

1. PROJECT SCAFFOLD
   - All files with exact paths (show directory tree first)
   - Dependency configuration with pinned versions
   - Environment configuration documentation
   - All config files

2. CORE IMPLEMENTATION
   - All routes, controllers, handlers with validation
   - Business logic layer — fully implemented, no stubs
   - Data access layer with models/queries
   - Database migrations and seed data
   - Middleware: auth, validation, logging, error handling, CORS

3. ${analysis.category === 'UI/UX' || analysis.category === 'Coding' ? 'FRONTEND / CLIENT' : 'DELIVERABLES'}
   - Complete component/module hierarchy
   - State management
   - API client layer with error handling
   - Form validation and error display
   - Responsive design, empty states, error boundaries

4. AUTHENTICATION & AUTHORIZATION
   - Complete auth flow (register, verify, login, refresh, logout)
   - Protected route middleware
   - Role-based access control

5. DATABASE
   - Full schema definitions with relationships
   - Migration files in order
   - Seed scripts with realistic data

6. INTEGRATIONS
   - Complete integration code for external services
   - Webhook handlers with signature verification
   - API key management patterns

7. ERROR HANDLING
   - Consistent error response schema
   - Centralized error handler
   - Structured logging

8. VALIDATION
   - Input validation schemas for every endpoint
   - Type safety throughout

9. TESTS
   - Unit tests for core business logic
   - Integration tests for critical endpoints
   - Test utilities and fixtures

Rules:
- Write complete, runnable code. No truncation. No TODOs.
- Every function fully implemented.
- Production-grade quality throughout.`;
}

function assembleOptimizePrompt(input, analysis, depth) {
  const tech = analysis.technologies?.length ? analysis.technologies.join(', ') : 'the stack';
  const areas = analysis.focusAreas?.length ? analysis.focusAreas.join(', ') : 'all areas';
  const goal = analysis.userGoal || input.slice(0, 100);

  return `You are a Principal Engineer, Security Architect, and DevOps Expert.

OBJECTIVE:
Perform a ${depth} audit and production-hardening review of: ${goal}

CONTEXT:
Project: ${input}
Category: ${analysis.category}
Technology Stack: ${tech}
Review Scope: ${areas}

REVIEW EACH SECTION — provide specific code fixes for every issue. Never list problems without solutions.

1. CODE QUALITY
   - Anti-patterns and SOLID violations
   - Functions with high cyclomatic complexity — refactor
   - Dead code and over-engineering
   - Naming and style issues

2. SECURITY AUDIT
   - Injection vulnerabilities with fix code
   - XSS, CSRF attack surfaces with mitigation
   - IDOR vulnerabilities — add auth checks
   - Missing auth guards — add them
   - Sensitive data exposure — sanitize
   - Dependency CVEs — suggest safe versions
   - Hardcoded secrets — fix with proper management
   - Missing security headers — provide middleware

3. PERFORMANCE
   - N+1 query problems — optimized queries
   - Missing indexes — CREATE INDEX statements
   - Slow queries — rewrite
   - Memory leaks and resource exhaustion — fix
   - Bundle size issues — code splitting
   - Caching opportunities — implement
   - Sync blocking operations — convert to async

4. BUG DETECTION & EDGE CASES
   - Race conditions and concurrency bugs
   - Null/undefined handling gaps
   - Boundary condition failures
   - Network failure handling (timeouts, retries, circuit breakers)
   - File upload vulnerabilities
   - Pagination failures on large datasets

5. REFACTORING
   - Extract reusable utilities
   - Consolidate duplicated logic
   - Improve separation of concerns
   - Simplify over-engineering

6. TEST COVERAGE
   - Top 10 untested critical paths
   - Unit tests for 5 highest-risk functions
   - Integration tests for 3 critical flows
   - E2E scenarios for primary journeys

7. OBSERVABILITY
   - Structured logging with correlation IDs
   - Key metrics to expose
   - Error tracking setup
   - Health check endpoints
   - Alerting thresholds

8. DEPLOYMENT & CI/CD
   - Dockerfile (multi-stage, minimal, non-root)
   - Docker-compose for local dev
   - K8s manifests (Deployment, Service, Ingress, HPA, ConfigMap, Secret)
   - CI/CD pipeline (lint → test → build → deploy)
   - Zero-downtime deployment strategy
   - Database migration strategy for prod
   - Rollback procedure

9. DOCUMENTATION
   - Missing README sections
   - API documentation gaps
   - Missing docstrings for public interfaces

10. PRODUCTION READINESS SCORECARD
    Rate each 1-10 with justification:
    | Category | Score | Top Issue |
    | Code Quality | /10 | |
    | Security | /10 | |
    | Performance | /10 | |
    | Test Coverage | /10 | |
    | Observability | /10 | |
    | Deployment | /10 | |
    | Documentation | /10 | |
    OVERALL: /10
    TOP 5 BLOCKERS (with priority)
    TOP 5 POST-LAUNCH improvements (with effort estimate)`;
}

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
    // Phase 1: LLM analyzes the input (cheap, ~200 tokens)
    const analysisResp = await fetch(`${providerConfig.baseURL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        ...(provider === 'openrouter' ? { 'HTTP-Referer': 'https://promptcompiler.vercel.app' } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: ANALYSIS_PROMPT },
          { role: 'user', content: input },
        ],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    const analysisData = await analysisResp.json();
    if (!analysisResp.ok) {
      return res.status(502).json({
        error: `LLM API error: ${analysisData.error?.message || analysisResp.statusText}`,
      });
    }

    const analysisContent = analysisData.choices?.[0]?.message?.content;
    if (!analysisContent) return res.status(502).json({ error: 'Empty analysis from LLM' });

    const analysisMatch = analysisContent.match(/\{[\s\S]*\}/);
    if (!analysisMatch) return res.status(502).json({ error: 'Analysis response not valid JSON' });

    const analysis = JSON.parse(analysisMatch[0]);
    const depth = buildDepthDescription(tone || 'detailed');

    // Phase 2: Assemble prompts using template structures + analysis data
    const prompts = {
      plan: assemblePlanPrompt(input, analysis, depth),
      build: assembleBuildPrompt(input, analysis, depth),
      optimize: assembleOptimizePrompt(input, analysis, depth),
    };

    return res.status(200).json({
      category: analysis.category || 'General',
      confidence: analysis.confidence || 0.8,
      analysis: analysis.analysis || '',
      prompts,
    });

  } catch (err) {
    return res.status(500).json({ error: `Server error: ${err.message}` });
  }
};
