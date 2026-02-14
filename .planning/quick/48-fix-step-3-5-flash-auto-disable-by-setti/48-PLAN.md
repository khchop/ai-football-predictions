---
phase: quick-048
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - src/lib/llm/providers/openrouter.ts
autonomous: true
must_haves:
  truths:
    - "Step 3.5 Flash has supportsJsonMode: false in its config"
    - "OpenRouter API no longer receives response_format: json_object for this model"
  artifacts:
    - path: "src/lib/llm/providers/openrouter.ts"
      provides: "Fixed Step 3.5 Flash config with supportsJsonMode: false"
      contains: "supportsJsonMode.*false"
---

<objective>
Fix Step 3.5 Flash (OpenRouter) auto-disabling by setting `supportsJsonMode: false` in its provider config. The model doesn't support `response_format: { type: 'json_object' }` but the empty options object `{}` defaults to `true`, causing a 400 error on every request.
</objective>

<tasks>

<task type="auto">
  <name>Task 1: Set supportsJsonMode: false for Step 3.5 Flash</name>
  <files>src/lib/llm/providers/openrouter.ts</files>
  <action>
Change the empty options `{}` on line 280 to `{ supportsJsonMode: false }`.
  </action>
  <verify>
TypeScript compilation passes.
  </verify>
  <done>
Step 3.5 Flash config has supportsJsonMode: false, preventing the unsupported response_format parameter from being sent.
  </done>
</task>

</tasks>
