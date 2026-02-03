# Phase 29: FAQ & SEO - Context

**Gathered:** 2026-02-03
**Status:** Ready for planning

<domain>
## Phase Boundary

Auto-generate FAQ section from match data with Schema.org FAQPage integration. This phase delivers the FAQ content generation logic, visual presentation as accordion, and JSON-LD schema markup — not additional match page features or new content types.

</domain>

<decisions>
## Implementation Decisions

### Question Generation
- Generate 5 questions per match (focused set covering essentials)
- Questions vary by match state — different sets for upcoming vs finished
- Live matches: include FAQ but with appropriate questions for in-progress state
- **Upcoming match topics:** Kickoff time, predictions summary, how to watch, venue
- **Finished match topics:** Final score, prediction accuracy (which models got it right), goalscorers

### Answer Content Style
- Tone: Factual and direct — straight answers without fluff
- Length: 1-2 sentences per answer — concise and to the point
- Model names: Yes, mention specific top models (e.g., "GPT-4, Claude, and Gemini predict a home win")
- Internal links: Include where relevant (link to league page, related matches)

### FAQ Presentation
- Display style: Accordion (collapsible Q&A)
- Default state: First item expanded, rest collapsed
- Section heading: "Frequently Asked Questions"
- Multi-open: Yes, allow multiple accordion items open simultaneously

### Schema Structure
- Organization: Single @graph containing both SportsEvent and FAQPage schemas
- Schema sync: FAQ schema questions must exactly match visible FAQ text (Google penalizes mismatch)
- eventStatus mapping: upcoming→EventScheduled, live→EventMovedOnline (or similar), finished→EventCompleted
- Validation: Manual validation using Google Rich Results Test

### Claude's Discretion
- Exact question wording (within topic constraints)
- How to handle edge cases (matches with missing data)
- Specific internal link targets
- Accordion animation/transition styling

</decisions>

<specifics>
## Specific Ideas

- Answers should mirror what users searching for match info typically want to know
- Top model names add credibility to prediction answers
- Single @graph avoids duplicate schema issues in search console

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-faq-seo*
*Context gathered: 2026-02-03*
