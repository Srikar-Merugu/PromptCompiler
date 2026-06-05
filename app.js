/* =============================================
   PromptCompiler V2 — app.js
   ChatGPT-Style Interface Engine
   ============================================= */

'use strict';

// =============================================
// DOMAIN DETECTION
// =============================================
const DOMAIN_PATTERNS = {
  'Full Stack':       /\b(full.?stack|fullstack|next\.?js|nuxt|remix|t3|mean|mern|pern)\b/i,
  'Frontend':         /\b(react|vue|angular|svelte|frontend|ui|dashboard|landing|tailwind|css|figma)\b/i,
  'Backend':          /\b(backend|server|api|rest|graphql|node|express|fastapi|django|flask|rails|spring|nest\.?js)\b/i,
  'Mobile':           /\b(mobile|ios|android|react native|flutter|swift|kotlin|expo)\b/i,
  'AI / ML':          /\b(ai|llm|gpt|claude|gemini|langchain|rag|embedding|vector|chatbot|agent|nlp|openai|hugging)\b/i,
  'SaaS':             /\b(saas|subscription|stripe|billing|tenant|multi.?tenant|freemium|product)\b/i,
  'DevOps / Cloud':   /\b(devops|docker|kubernetes|k8s|aws|gcp|azure|terraform|ci.?cd|deploy|helm|infra)\b/i,
  'Data Engineering': /\b(data|analytics|warehouse|etl|spark|kafka|airflow|dbt|sql|postgres|clickhouse|pipeline)\b/i,
  'Cybersecurity':    /\b(security|auth|oauth|jwt|penetration|vulnerability|encrypt|ssl|tls|firewall)\b/i,
  'Automation':       /\b(automat|workflow|script|bot|scraper|crawl|cron|task|schedule)\b/i,
  'Research':         /\b(research|analysis|study|literature|survey|paper|investigate)\b/i,
};

function detectDomain(text) {
  if (!text || text.trim().length < 5) return null;
  for (const [domain, pattern] of Object.entries(DOMAIN_PATTERNS)) {
    if (pattern.test(text)) return domain;
  }
  return 'Software Development';
}

// =============================================
// HISTORY STORE (localStorage)
// =============================================
const HISTORY_KEY = 'pc_history_v2';

function loadHistory() {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
  } catch { return []; }
}

function saveHistory(history) {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 20)));
  } catch {}
}

function addToHistory(label) {
  const history = loadHistory();
  const entry = { id: Date.now(), label, ts: new Date().toISOString() };
  history.unshift(entry);
  saveHistory(history);
  renderHistory();
}

// =============================================
// DOM REFERENCES
// =============================================
const sidebar         = document.getElementById('sidebar');
const sidebarOverlay  = document.getElementById('sidebar-overlay');
const sidebarToggle   = document.getElementById('sidebar-toggle');
const newChatBtn      = document.getElementById('new-chat-btn');
const historyList     = document.getElementById('history-list');

const welcomeScreen   = document.getElementById('welcome-screen');
const messagesContainer = document.getElementById('messages-container');

const userInputEl     = document.getElementById('user-input');
const compileBtn      = document.getElementById('compile-btn');

const toneSelect      = document.getElementById('tone-select');
const domainSelect    = document.getElementById('domain-select');
const modelSelect     = document.getElementById('model-select');

const detectedBadge   = document.getElementById('detected-badge');
const detectedText    = document.getElementById('detected-text');

const toast           = document.getElementById('toast');

const suggestionChips = document.querySelectorAll('.suggestion-chip');

// =============================================
// SIDEBAR TOGGLE (MOBILE)
// =============================================
sidebarToggle?.addEventListener('click', () => {
  sidebar.classList.toggle('open');
  sidebarOverlay.classList.toggle('show');
});

sidebarOverlay?.addEventListener('click', () => {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
});

// =============================================
// NEW CHAT
// =============================================
newChatBtn?.addEventListener('click', () => {
  resetToWelcome();
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
});

function resetToWelcome() {
  messagesContainer.innerHTML = '';
  messagesContainer.style.display = 'none';
  welcomeScreen.style.display = 'flex';
  userInputEl.value = '';
  autoResize();
  compileBtn.disabled = true;
  detectedBadge.style.display = 'none';
}

// =============================================
// HISTORY RENDERING
// =============================================
function renderHistory() {
  const history = loadHistory();
  historyList.innerHTML = '';

  if (!history.length) {
    historyList.innerHTML = `<p style="font-size:12px;color:var(--text-muted);padding:8px 6px;">No compilations yet</p>`;
    return;
  }

  history.forEach(item => {
    const el = document.createElement('div');
    el.className = 'history-item';
    el.setAttribute('role', 'button');
    el.setAttribute('tabindex', '0');
    el.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
      <span class="history-item-text" title="${escapeHtml(item.label)}">${escapeHtml(item.label)}</span>
    `;
    historyList.appendChild(el);
  });
}

renderHistory();

// =============================================
// SUGGESTION CHIPS
// =============================================
suggestionChips.forEach(chip => {
  chip.addEventListener('click', () => {
    const text = chip.dataset.text;
    userInputEl.value = text;
    autoResize();
    userInputEl.dispatchEvent(new Event('input'));
    userInputEl.focus();
    // Auto-compile on chip click
    setTimeout(() => compileBtn.click(), 100);
  });
});

// =============================================
// TEXTAREA: AUTO-RESIZE & INPUT HANDLING
// =============================================
function autoResize() {
  userInputEl.style.height = 'auto';
  userInputEl.style.height = Math.min(userInputEl.scrollHeight, 200) + 'px';
}

let domainDebounce = null;

userInputEl.addEventListener('input', () => {
  autoResize();
  const val = userInputEl.value.trim();
  compileBtn.disabled = val.length < 3;

  clearTimeout(domainDebounce);
  if (val.length < 5) {
    detectedBadge.style.display = 'none';
    return;
  }
  domainDebounce = setTimeout(() => {
    const domain = detectDomain(val);
    if (domain && domainSelect.value === 'auto') {
      detectedText.textContent = domain;
      detectedBadge.style.display = 'flex';
    } else {
      detectedBadge.style.display = 'none';
    }
  }, 350);
});

// =============================================
// KEYBOARD: Enter to compile, Shift+Enter for newline
// =============================================
userInputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    if (!compileBtn.disabled) compileBtn.click();
  }
});

// =============================================
// COMPILE
// =============================================
compileBtn.addEventListener('click', async () => {
  const input = userInputEl.value.trim();
  if (!input || input.length < 3) return;

  const tone       = toneSelect.value;
  const domainHint = domainSelect.value;
  const model      = modelSelect.value;

  // Switch to chat view
  welcomeScreen.style.display = 'none';
  messagesContainer.style.display = 'flex';

  // Append user message
  appendUserMessage(input);

  // Clear input
  userInputEl.value = '';
  autoResize();
  compileBtn.disabled = true;
  detectedBadge.style.display = 'none';

  // Append thinking indicator
  const thinkingId = appendThinking();

  // Save to history
  const label = input.slice(0, 55) + (input.length > 55 ? '...' : '');
  addToHistory(label);

  // Simulate processing
  await sleep(900 + Math.random() * 700);

  // Generate prompts
  const detected = domainHint === 'auto' ? (detectDomain(input) || 'Software Development') : formatDomainLabel(domainHint);
  const result   = generatePrompts(input, tone, detected, model);

  // Remove thinking
  removeThinking(thinkingId);

  // Append AI response cards
  appendAIResponse(result, detected);

  // Scroll to bottom
  scrollToBottom();

  // Close sidebar on mobile
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
});

// =============================================
// MESSAGE RENDERING
// =============================================
function appendUserMessage(text) {
  const div = document.createElement('div');
  div.className = 'msg-user';
  div.innerHTML = `<div class="msg-user-bubble">${escapeHtml(text)}</div>`;
  messagesContainer.appendChild(div);
  scrollToBottom();
}

let thinkingCounter = 0;

function appendThinking() {
  const id = 'thinking-' + (++thinkingCounter);
  const div = document.createElement('div');
  div.className = 'msg-ai';
  div.id = id;
  div.innerHTML = `
    <div class="msg-ai-avatar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M12 2C10.4 2 9 3 8.5 4.4C7.3 4.1 6 4.7 5.3 5.8C4.2 5.6 3.1 6.3 2.7 7.4C1.6 7.6 1 8.7 1.2 9.8C0.4 10.6 0.3 11.8 0.9 12.7C0.6 13.7 1.1 14.8 2 15.3C2.2 16.4 3.1 17.2 4.2 17.2C4.8 18.1 5.9 18.5 6.9 18.2C7.7 18.9 8.8 19.1 9.8 18.7L10 19.5C10.2 20.4 11 21 11.9 21H12.1C13 21 13.8 20.4 14 19.5L14.2 18.7C15.2 19.1 16.3 18.9 17.1 18.2C18.1 18.5 19.2 18.1 19.8 17.2C20.9 17.2 21.8 16.4 22 15.3C22.9 14.8 23.4 13.7 23.1 12.7C23.7 11.8 23.6 10.6 22.8 9.8C23 8.7 22.4 7.6 21.3 7.4C20.9 6.3 19.8 5.6 18.7 5.8C18 4.7 16.7 4.1 15.5 4.4C15 3 13.6 2 12 2Z" fill="white" opacity="0.2"/>
        <circle cx="9" cy="10.5" r="1" fill="white"/>
        <circle cx="15" cy="10.5" r="1" fill="white"/>
        <path d="M9 14c0 0 1 1.5 3 1.5s3-1.5 3-1.5" stroke="white" stroke-width="1.2" stroke-linecap="round" fill="none"/>
        <path d="M12 1.5v0.8M18.36 3.64l-.6.6M21 10h-0.8M18.36 16.36l-.6-.6M12 19.5v-0.8M5.64 16.36l.6-.6M3 10h0.8M5.64 3.64l.6.6" stroke="white" stroke-width="1.2" stroke-linecap="round" opacity="0.6"/>
      </svg>
    </div>
    <div class="msg-ai-body">
      <div class="msg-ai-name">PromptCompiler</div>
      <div class="thinking-indicator">
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
        <div class="thinking-dot"></div>
      </div>
    </div>
  `;
  messagesContainer.appendChild(div);
  scrollToBottom();
  return id;
}

function removeThinking(id) {
  document.getElementById(id)?.remove();
}

function appendAIResponse({ prompt1, prompt2, prompt3 }, domain) {
  const totalWords = countWords(prompt1 + prompt2 + prompt3);

  const div = document.createElement('div');
  div.className = 'msg-ai';

  div.innerHTML = `
    <div class="msg-ai-avatar">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" fill="currentColor"/>
      </svg>
    </div>
    <div class="msg-ai-body">
      <div class="msg-ai-name">PromptCompiler <span style="font-size:11px;font-weight:400;color:var(--text-muted);margin-left:4px;">3 prompts compiled</span></div>

      <div class="prompt-cards-grid">

        ${buildCardHTML('plan', '01', 'PROMPT 1 — PLAN', 'Planning & Architecture', prompt1)}
        ${buildCardHTML('build', '02', 'PROMPT 2 — BUILD', 'Implementation', prompt2)}
        ${buildCardHTML('opt', '03', 'PROMPT 3 — OPTIMIZE', 'Review, Testing & Optimization', prompt3)}

      </div>

      <div class="stats-bar">
        <span class="stat-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
          Domain: ${escapeHtml(domain)}
        </span>
        <span class="stat-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
          ${totalWords.toLocaleString()} words total
        </span>
        <span class="stat-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
          3 prompts ready
        </span>
      </div>

      <div class="copy-all-row">
        <button class="copy-all-btn" data-all="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg>
          Copy All Three Prompts
        </button>
        <button class="regen-btn" data-regen="true">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.08"/></svg>
          Regenerate
        </button>
      </div>
    </div>
  `;

  messagesContainer.appendChild(div);

  // Attach event handlers
  attachCardEvents(div, prompt1, prompt2, prompt3);
}

function buildCardHTML(type, num, title, subtitle, content) {
  const stripClass = `strip-${type}`;
  const numClass   = `num-${type}`;
  // Preview: first 400 chars
  const preview    = content.slice(0, 400);
  const hasMore    = content.length > 400;

  return `
    <div class="prompt-card" data-type="${type}">
      <div class="card-strip ${stripClass}"></div>
      <div class="card-head">
        <div class="card-title-row">
          <div class="card-num ${numClass}">${num}</div>
          <div>
            <div class="card-title">${escapeHtml(title)}</div>
            <div class="card-subtitle">${escapeHtml(subtitle)}</div>
          </div>
        </div>
        <button class="card-copy-btn" data-copy-type="${type}">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
          Copy
        </button>
      </div>
      <div class="card-body" data-full="${escapeAttr(content)}" data-expanded="false">${escapeHtml(preview)}${hasMore ? '...' : ''}</div>
      ${hasMore ? `
      <button class="card-toggle" data-toggle-type="${type}">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
        Show full prompt
      </button>` : ''}
    </div>
  `;
}

function attachCardEvents(container, prompt1, prompt2, prompt3) {
  const promptMap = { plan: prompt1, build: prompt2, opt: prompt3 };

  // Copy individual card
  container.querySelectorAll('[data-copy-type]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.copyType;
      await copyText(promptMap[type]);
      markCopied(btn);
      showToast('✓ Prompt copied to clipboard!');
    });
  });

  // Expand/collapse card body
  container.querySelectorAll('[data-toggle-type]').forEach(btn => {
    btn.addEventListener('click', () => {
      const type     = btn.dataset.toggleType;
      const card     = container.querySelector(`.prompt-card[data-type="${type}"]`);
      const body     = card.querySelector('.card-body');
      const isExpanded = body.dataset.expanded === 'true';
      const fullText = body.dataset.full;

      if (isExpanded) {
        body.textContent = fullText.slice(0, 400) + '...';
        body.dataset.expanded = 'false';
        btn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          Show full prompt`;
      } else {
        body.textContent = fullText;
        body.dataset.expanded = 'true';
        btn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="18 15 12 9 6 15"/></svg>
          Collapse`;
        setTimeout(() => body.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      }
    });
  });

  // Copy All
  container.querySelectorAll('[data-all]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const all = formatAllPrompts(prompt1, prompt2, prompt3);
      await copyText(all);
      btn.textContent = '✓ Copied!';
      btn.style.background = 'var(--accent)';
      btn.style.color = '#fff';
      setTimeout(() => {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/></svg> Copy All Three Prompts`;
        btn.style.background = '';
        btn.style.color = '';
      }, 2500);
      showToast('✓ All three prompts copied!');
    });
  });

  // Regenerate
  container.querySelectorAll('[data-regen]').forEach(btn => {
    btn.addEventListener('click', () => {
      // Get the last user message text
      const userBubbles = messagesContainer.querySelectorAll('.msg-user-bubble');
      if (!userBubbles.length) return;
      const lastText = userBubbles[userBubbles.length - 1].textContent;
      userInputEl.value = lastText;
      autoResize();
      userInputEl.dispatchEvent(new Event('input'));
      userInputEl.focus();
      setTimeout(() => userInputEl.select(), 50);
      showToast('Edit your prompt and press Enter to regenerate');
    });
  });
}

// =============================================
// PROMPT GENERATION ENGINE
// =============================================
function generatePrompts(input, tone, domain, targetModel) {
  const depthMap = {
    standard: 'comprehensive',
    detailed:  'highly detailed with specific implementation patterns',
    expert:    'expert-level with edge cases, performance tradeoffs, and production battle-testing'
  };
  const depth = depthMap[tone] || 'comprehensive';
  const modelNote = targetModel !== 'general'
    ? `\nTarget AI System: ${capitalize(targetModel)}\n`
    : '';

  return {
    prompt1: buildPlanPrompt(input, domain, depth, modelNote),
    prompt2: buildBuildPrompt(input, domain, depth, modelNote),
    prompt3: buildOptimizePrompt(input, domain, depth, modelNote),
  };
}

function buildPlanPrompt(input, domain, depth, modelNote) {
  return `You are a Principal Solutions Architect and Senior Software Engineer.${modelNote}
TASK:
Create a ${depth} implementation blueprint for the following project.

PROJECT DESCRIPTION:
${input}

DETECTED DOMAIN: ${domain}

Produce each section with specific, actionable content — no generic advice:

1. REQUIREMENTS ANALYSIS
   - Functional requirements (user stories, core features, v1 scope)
   - Non-functional requirements (performance, scalability, availability SLAs, security)
   - Out-of-scope items for v1

2. SYSTEM ARCHITECTURE
   - High-level architecture overview (components, services, and their roles)
   - Data flow between components
   - Integration points and third-party services

3. TECH STACK DECISION
   - Recommended stack with justification for each technology
   - Alternatives considered and why they were rejected
   - Dependency version pinning strategy

4. DATABASE DESIGN
   - Entity-relationship overview
   - Core schemas / collections with key fields and data types
   - Indexing strategy and data access patterns

5. API DESIGN
   - API style (REST / GraphQL / gRPC) with justification
   - Core endpoint groups, HTTP methods, and payload shapes
   - Authentication / authorization model (JWT, OAuth 2.0, RBAC, etc.)
   - Rate limiting, pagination, and versioning strategy

6. FOLDER / PROJECT STRUCTURE
   - Monorepo vs. polyrepo decision with justification
   - Full directory tree layout
   - Module boundaries and responsibilities

7. DEVELOPMENT ROADMAP
   - Phase 1 (MVP): must-have features and acceptance criteria
   - Phase 2 (Growth): enhancements and scaling features
   - Phase 3 (Enterprise): advanced capabilities

8. SECURITY DESIGN
   - Authentication flow (diagram as text)
   - Input validation and sanitization strategy
   - Secrets management approach
   - Compliance requirements (GDPR, SOC 2, HIPAA if applicable)

9. SCALABILITY & PERFORMANCE PLAN
   - Expected load model (requests/sec, users, data volume)
   - Horizontal vs. vertical scaling decisions
   - Caching layers (CDN, Redis, query cache)
   - Known bottlenecks and mitigation strategies

10. KEY TECHNICAL DECISIONS & TRADEOFFS
    - List 6 architectural decisions with rationale and accepted tradeoffs

Output only the blueprint. Be specific and concrete throughout.`;
}

function buildBuildPrompt(input, domain, depth, modelNote) {
  return `You are an Elite Senior Software Engineer building production-grade systems.${modelNote}
TASK:
Implement the complete, working solution for the project below at ${depth} quality.

PROJECT DESCRIPTION:
${input}

DETECTED DOMAIN: ${domain}

ASSUMPTION: Architecture is already designed. Your job is to WRITE CODE — complete, working, production-ready.

IMPLEMENTATION REQUIREMENTS:

1. PROJECT SCAFFOLD
   - All files with exact paths (show directory tree first)
   - package.json / requirements.txt / go.mod with pinned dependency versions
   - .env.example with all required environment variables documented
   - All configuration files (tsconfig, eslint, prettier, dockerfile, docker-compose)

2. BACKEND IMPLEMENTATION
   - All API routes, controllers / handlers with request validation
   - Business logic layer (services) — fully implemented, no stubs
   - Data access layer (repositories) with ORM models or raw queries
   - Database migrations and seed scripts
   - Middleware: authentication, validation, rate limiting, CORS, logging, error handling

3. FRONTEND / CLIENT (if applicable)
   - Full component hierarchy with routing
   - State management implementation (zustand, redux, context — whichever fits)
   - API client layer with error handling, loading states, and retry logic
   - Form validation (client-side + API error display)
   - Responsive layouts, empty states, error boundaries, skeleton loaders

4. AUTHENTICATION & AUTHORIZATION
   - Complete auth flow: register, email verify, login, refresh token, logout
   - Protected route middleware / guards
   - Role-based access control (RBAC) implementation

5. DATABASE
   - Full schema definitions / ORM models with relationships
   - Migration files in correct order
   - Seed scripts with realistic development data

6. THIRD-PARTY INTEGRATIONS
   - Complete integration code for all external services
   - Webhook handlers with signature verification
   - API key and secret rotation patterns

7. ERROR HANDLING
   - Consistent error response schema across all endpoints
   - Centralized error handler with categorized error types
   - Structured logging (JSON format with request ID, user ID, timestamp, duration)

8. VALIDATION
   - Input validation schemas (Zod / Joi / Pydantic) for every endpoint
   - Type safety enforced throughout (TypeScript strict mode or typed equivalents)

9. UNIT & INTEGRATION TESTS
   - Unit tests for all core business logic functions
   - Integration tests for all critical API endpoints
   - Test utilities, fixtures, and mock factories

Rules:
- Write complete, runnable code. No truncation. No "// TODO: implement".
- Add inline comments for all non-obvious logic.
- Every function must be fully implemented.`;
}

function buildOptimizePrompt(input, domain, depth, modelNote) {
  return `You are a Principal Engineer, Security Architect, and DevOps Expert.${modelNote}
TASK:
Perform a ${depth} audit and production-hardening review of the implemented solution.

PROJECT DESCRIPTION:
${input}

DETECTED DOMAIN: ${domain}

REVIEW EACH SECTION — provide specific code fixes for every issue found. Never list problems without solutions.

1. CODE QUALITY REVIEW
   - Anti-patterns, SOLID principle violations, and code smells
   - Functions with high cyclomatic complexity (>10) — provide refactored versions
   - Dead code, redundant logic, over-engineering
   - Naming clarity improvements
   - Code consistency and style adherence issues

2. SECURITY AUDIT
   - SQL/NoSQL injection vulnerabilities with fix
   - XSS, CSRF attack surfaces with mitigation code
   - IDOR vulnerabilities — show authorization check fixes
   - Missing auth/authorization guards — add them
   - Sensitive data in logs, errors, or API responses — sanitize
   - Dependency CVEs — identify and suggest safe versions
   - Hardcoded secrets or insecure storage — fix with proper secrets management
   - Missing security headers — provide middleware code (CSP, HSTS, X-Frame-Options, etc.)

3. PERFORMANCE ANALYSIS
   - N+1 query problems — show optimized queries with eager loading
   - Missing database indexes — provide CREATE INDEX statements
   - Slow or unoptimized queries — rewrite them
   - Memory leaks and resource exhaustion patterns — fix them
   - Frontend bundle size issues — code splitting and lazy loading opportunities
   - Caching opportunities — implement Redis or CDN caching where beneficial
   - Synchronous blocking operations — convert to async

4. BUG DETECTION & EDGE CASES
   - Race conditions and concurrency bugs
   - Null/undefined handling gaps
   - Integer overflow and boundary condition failures
   - Network failure scenarios — implement timeouts, retries, circuit breakers
   - File upload vulnerabilities — size limits, MIME validation, malware scanning hooks
   - Pagination failures on large datasets

5. REFACTORING
   - Extract reusable utilities, hooks, and middleware
   - Consolidate duplicated logic (DRY principle)
   - Improve separation of concerns
   - Simplify over-engineered abstractions

6. TEST COVERAGE GAPS
   - Identify top 10 untested critical paths
   - Write unit tests for the 5 highest-risk functions
   - Write integration tests for 3 critical API flows
   - Write E2E test scenarios for primary user journeys

7. OBSERVABILITY & MONITORING
   - Structured logging setup with correlation IDs
   - Key metrics to expose (Prometheus / Datadog format)
   - Error tracking integration (Sentry setup code)
   - Health check endpoint implementation (/health, /ready)
   - Alerting thresholds and runbook outline

8. DEPLOYMENT & CI/CD READINESS
   - Dockerfile — multi-stage build, minimal final image, non-root user
   - docker-compose for local development
   - Kubernetes manifests (Deployment, Service, Ingress, HPA, ConfigMap, Secret)
   - GitHub Actions CI/CD pipeline (lint → test → build → deploy)
   - Zero-downtime deployment strategy
   - Database migration strategy for production deployments
   - Rollback procedure documentation

9. DOCUMENTATION AUDIT
   - Missing or incomplete README sections
   - API documentation gaps — generate OpenAPI 3.0 spec for missing endpoints
   - Missing JSDoc / docstrings for public interfaces
   - Operations runbook for common failure scenarios

10. PRODUCTION READINESS SCORECARD
    Rate each category 1–10 with specific justification:
    | Category        | Score | Top Issue                  |
    |-----------------|-------|----------------------------|
    | Code Quality    |  /10  | [specific issue]           |
    | Security        |  /10  | [specific issue]           |
    | Performance     |  /10  | [specific issue]           |
    | Test Coverage   |  /10  | [specific issue]           |
    | Observability   |  /10  | [specific issue]           |
    | Deployment      |  /10  | [specific issue]           |
    | Documentation   |  /10  | [specific issue]           |

    OVERALL SCORE: /10
    TOP 5 BLOCKERS before production launch (with fix priority)
    TOP 5 POST-LAUNCH improvements (with effort estimate)`;
}

// =============================================
// UTILITIES
// =============================================
function formatAllPrompts(p1, p2, p3) {
  const sep = '='.repeat(72);
  return `PROMPT 1 — PLAN\n${sep}\n${p1}\n\n\nPROMPT 2 — BUILD\n${sep}\n${p2}\n\n\nPROMPT 3 — OPTIMIZE\n${sep}\n${p3}`;
}

function formatDomainLabel(val) {
  const map = {
    fullstack: 'Full Stack', frontend: 'Frontend', backend: 'Backend',
    mobile: 'Mobile', ai: 'AI / ML', saas: 'SaaS', devops: 'DevOps / Cloud',
    data: 'Data Engineering', security: 'Cybersecurity',
  };
  return map[val] || 'Software Development';
}

function countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function scrollToBottom() {
  const chatArea = document.querySelector('.chat-area');
  if (chatArea) chatArea.scrollTop = chatArea.scrollHeight;
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// =============================================
// CLIPBOARD
// =============================================
async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

function markCopied(btn) {
  const original = btn.innerHTML;
  btn.classList.add('copied');
  btn.innerHTML = `
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
    Copied!
  `;
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.innerHTML = original;
  }, 2200);
}

// =============================================
// TOAST
// =============================================
let toastTimer;
function showToast(msg) {
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
}

// =============================================
// INIT
// =============================================
userInputEl.focus();
