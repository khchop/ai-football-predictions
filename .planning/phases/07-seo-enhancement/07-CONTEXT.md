# Phase 7: SEO Enhancement - Context

**Gathered:** 2026-02-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Search engines understand and surface predictions through structured data and optimized metadata. This phase adds Schema.org markup to all page types, optimizes OG/Twitter cards, and ensures Google Rich Results Test passes without errors.

</domain>

<decisions>
## Implementation Decisions

### Schema.org Mapping
- Match pages: SportsEvent + nested Review (prediction as assessment)
- Blog roundups: Article + ItemList (list of matches covered)
- Competition pages: Claude's discretion on schema type (research best practice)
- Model pages: Claude's discretion on whether structured data adds value
- Homepage: WebSite + SearchAction (enables sitelinks searchbox)

### Accuracy Labeling
- Social share label: "Prediction Accuracy: X%" (simpler than "Tendency Accuracy")
- OG descriptions for matches: Prediction-focused ("AI predicts 2-1 home win for Arsenal vs Chelsea on Feb 15")
- Search snippet accuracy: Claude's discretion based on SEO best practices
- Date format in titles: Claude's discretion balancing readability and SEO

### Page Priority
- Which pages matter most: Claude's discretion based on traffic analysis
- Past match indexing: Claude's discretion based on sports content SEO patterns
- Sitemap: Dynamic generation (auto-updates when content added)

### Validation Strategy
- Development validation: Claude's discretion on testing approach
- Post-launch monitoring: Search Console + alerts on structured data errors
- Debug indicators: Claude's discretion on whether dev tools needed
- Rollout: All page types at once in single release

### Claude's Discretion
- Competition page schema type (SportsOrganization vs CollectionPage vs other)
- Model page structured data (ProfilePage vs skip)
- Whether accuracy belongs in meta descriptions
- Date format for blog roundup titles
- Testing approach (manual vs automated vs both)
- Debug mode implementation
- Past match indexing strategy

</decisions>

<specifics>
## Specific Ideas

- Match OG descriptions should include the predicted score: "AI predicts 2-1 home win"
- Homepage should have SearchAction to enable Google sitelinks searchbox
- Monitoring should alert on structured data errors, not just passive Search Console checking

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 07-seo-enhancement*
*Context gathered: 2026-02-02*
