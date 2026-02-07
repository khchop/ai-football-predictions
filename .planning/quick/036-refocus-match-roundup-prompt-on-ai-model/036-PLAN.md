---
phase: quick-036
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/content/prompts.ts
  - src/lib/content/generator.ts
autonomous: true
---

<objective>
Rewrite post-match roundup prompt to focus exclusively on AI model prediction performance. Remove all sections about match events, tactics, statistics that invite filler text.
</objective>

<tasks>
<task type="auto">
  <name>Task 1: Rewrite roundup prompt and system prompt</name>
  <files>src/lib/content/prompts.ts, src/lib/content/generator.ts</files>
  <action>
  Replace the 7-section roundup structure with AI-prediction-only structure. Remove events, stats, narrative angles sections. Update system prompt to AI prediction analyst role.
  </action>
</task>
</tasks>
