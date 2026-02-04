# Phase 33: HTML Sanitization - Context

**Gathered:** 2026-02-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Strip HTML artifacts from all LLM-generated content. This covers three areas: updating prompts to request plain text, sanitizing output before database save, and cleaning existing content via migration. The result is match pages that render without visible HTML tags or entities.

</domain>

<decisions>
## Implementation Decisions

### Stripping Rules
- Convert HTML tags to plain text equivalents (`<br>` → newline, `<p>` → double-newline, strip `<strong>`/`<em>` keeping inner text)
- Decode HTML entities to characters (`&amp;` → `&`, `&nbsp;` → space, `&quot;` → `"`)
- Claude's discretion on markdown preservation (likely preserve for structured content like FAQs)
- Claude's discretion on nested/malformed HTML handling (best-effort robust approach)

### LLM Prompt Wording
- Add plain text instruction to ALL content prompts (pre-match, post-match, betting, FAQ)
- Claude's discretion on exact wording, placement, and whether to suggest alternative formats
- Goal: effective instruction without bloating prompts

### Migration Handling
- Clean in place — no backup of original HTML-polluted content
- Migrate ALL generated content fields (not just visible ones)
- Verify migration success — run check after to confirm no HTML remains
- Claude's discretion on migration mechanism (script vs Drizzle migration)

### Edge Cases
- Same rules apply to all content types including blogs — everything should be plain text
- Claude's discretion on legitimate angle brackets (preserve math/comparison, strip only actual tags)
- Claude's discretion on whether stripping changes meaning (use judgment, not blind rules)
- Claude's discretion on application scope (determine based on where HTML issues originate)

### Claude's Discretion
- Markdown preservation decisions per content type
- Nested/malformed HTML handling approach
- Prompt wording and placement
- Migration mechanism choice
- Angle bracket handling for non-tag uses
- Scope of where sanitization is applied

</decisions>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches. Key principle is that HTML should never be visible to end users on any page.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 33-html-sanitization*
*Context gathered: 2026-02-04*
