# Phase 4: Content Pipeline - Context

**Gathered:** 2026-01-27
**Status:** Ready for planning

<domain>
## Phase Boundary

Automated match roundup generation triggered on match completion. Combines match data, model predictions, and LLM-generated narrative into rich HTML content for match pages. Roundups are generated once (static) and served from cache.

</domain>

<decisions>
## Implementation Decisions

### Roundup Structure
- Full roundup format with all sections: scoreboard header, events timeline, model predictions table, top performers, narrative analysis
- Ordering: Score → Events → Analysis
- Extended stats included: possession, shots, corners, xG metrics
- Model predictions displayed in table format with accuracy columns (which models predicted correctly)

### Content Style
- Balanced tone: mix of storytelling with key stats highlighted
- Long form narrative: 1000+ words with deep analysis
- Rich formatting: headers, bullet points for stats, occasional emoji for emphasis
- Specific model references: name models that performed well/badly in analysis

### Uniqueness/Freshness
- Hybrid approach: templates with varying intros, smart angle selection, unique LLM generation
- Similarity detection: compare against recent roundups, regenerate if too similar
- Contextual angles: detect derbies, comebacks, upsets and apply different narrative angles
- No quotes: stick to facts and analysis only (no fictional or real quotes)

### Trigger & Output
- Trigger timing: short delay (30-60 seconds) after final score to wait for official data
- Data sources combined: match data + all model predictions + recent form + head-to-head history
- Output format: HTML with rich formatting for match page display
- Caching: static (generate once, serve from cache forever)

### Claude's Discretion
- Exact HTML component structure and styling
- Prompt engineering approach for LLM output
- Similarity detection algorithm (threshold, comparison method)
- Smart angle detection (rivalry detection, comeback thresholds)

</decisions>

<specifics>
## Specific Ideas

- Match events include possession percentage, shots on target, corners, xG
- Table shows each model's prediction vs actual result with accuracy percentage
- Rich formatting with bullet points for stats breakdown
- Occasional emoji for emphasis (not excessive)
- Contextual angles for: local derbies, comeback wins, upset victories, milestone performances

</specifics>

<deferred>
## Deferred Ideas

- Real post-match quotes if available from API-Football (future enhancement)
- Video highlights integration (separate phase)
- Interactive match timeline (separate phase)

</deferred>

---

*Phase: 04-content-pipeline*
*Context gathered: 2026-01-27*
