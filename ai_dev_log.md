# AI-First Development Log

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
