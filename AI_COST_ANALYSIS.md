# AI-First Development Log + Cost Analysis

## Tools & Workflow

I used **Cursor + Codex** as my primary AI-first workflow (meeting the requirement to use at least two tools).

Workflow used:

- Prompt-driven implementation for feature work and bug fixes
- Iterative loop: prompt -> generated code -> run tests -> refine
- Parallelized agent workflows for independent tasks (including worktree-based isolation)
- Human review of behavior and acceptance criteria before finalizing changes

## MCP Usage

No MCP integrations were used in this assignment.

## Effective Prompts (Actual Prompts)

1. "Launch agents in parallel, one dedicated worktree per fix, with focused commits. Implement: AI guardrails (>100 entity cap, rate limiting, irrelevant-request filtering), replace native confirm with shadCN dialog, fix sticker dropdown direction from bottom toolbar, fix black sticky color intent, and add E2E coverage for core user journeys."
2. "Implement the full Resilient Canvas spec (local-first ops, persistent outbox, snapshot/revision model, deterministic state machine, reconnect/rebase behavior, conflict handling, failure modes, UX indicators, and required tests)."
3. "These E2E tests look mocked. For E2E, I don't want any mocks - run against real app behavior and dependencies."
4. "Remove the extra intent-classification LLM call. Use a single tool-enabled OpenAI pass where the model decides and invokes tools directly."
5. "Add debug instrumentation and help me optimize latency: per-call timings, tool timings, token usage, and a breakdown that identifies the biggest bottleneck."

## Code Analysis

- **AI-generated code:** 100%
- **Hand-written code:** 0%

## Strengths & Limitations

**Where AI excelled**

- Fast iteration on implementation and test scaffolding
- Efficient parallel handling of multiple independent fixes
- Good at quickly narrowing bottlenecks when telemetry/logs were available

**Where AI struggled**

- Needed explicit constraints to avoid undesired mocking in E2E
- Required clear guardrails for behavior-sensitive production expectations

## Key Learnings

- Prompt specificity and constraints strongly affect output quality
- Parallelized coding-agent workflows improve throughput, but still need human validation
- Instrumentation (latency + token usage + request counts) is essential for optimization and cost control

---

# AI Cost Analysis

## Development & Testing Costs (Actual)

### Cursor

- composer-1.5: **220.4M tokens**, **$65.75 included**
- Auto (Unlimited): **189.8M tokens**, **$0.00**
- **Cursor total:** **410.2M tokens**, **$65.75**

### OpenAI API

- **Total spend:** $9.50
- **Total tokens:** 34,782,318
- **Output tokens:** 283,692
- **Input tokens (derived):** 34,498,626
- **Total API requests:** 1,067

### Combined Observed AI Spend

- **Total spend:** **$75.25**
- **Total tokens:** **444,982,318**
- **Total requests:** **1,067 (+ Cursor internal requests)**

---

## Production Cost Projections (LLM Only)

### Assumptions

- Example projection only, using current usage numbers
- Average AI commands per user per session: **8**
- Average sessions per user per month: **4**
- Average commands per user per month: **32**
- Effective OpenAI cost per command (from actuals):
$9.50 / 1,067 requests = **$0.0089/request**

### Monthly LLM Cost Projection


| Users   | Estimated LLM Cost / Month |
| ------- | -------------------------- |
| 100     | $28.48                     |
| 1,000   | $284.82                    |
| 10,000  | $2,848.17                  |
| 100,000 | $28,481.72                 |


---

## Production Cost Projections (Infra Only - Separate)

### Assumptions

- Next.js app hosting + API runtime
- Managed Postgres + Realtime + storage
- Observability (logs/metrics), CDN/egress, worker/queue processing
- Costs scale approximately with active usage and realtime event volume


| Users   | App Hosting | DB + Realtime | Storage | Observability | CDN/Egress | Workers/Queues | Total Infra / Month |
| ------- | ----------- | ------------- | ------- | ------------- | ---------- | -------------- | ------------------- |
| 100     | $25         | $25           | $10     | $15           | $5         | $10            | **$90**             |
| 1,000   | $80         | $120          | $30     | $35           | $20        | $40            | **$325**            |
| 10,000  | $350        | $900          | $180    | $150          | $140       | $300           | **$2,020**          |
| 100,000 | $2,500      | $7,500        | $1,400  | $900          | $1,200     | $2,400         | **$15,900**         |


---

