# Institutional relationships pilot

This optional, closed-by-default view displays four roster listings, not ownership edges. It never enters graph-model, portfolio totals, security equivalence or issuer identity resolution. The launcher opens a separate modal; closing restores the unchanged portfolio state.

## Verified evidence

Retrieved 2026-10-21 from official institutional pages:

- https://www.cfr.org/membership/corporate-members: roster explicitly current as of September 3, 2026. Microsoft Corporation and NVIDIA appear in Bronze. Both are corporate_member edges.
- https://www.chathamhouse.org/members-and-partners/corporate-membership: Apple appears in Partners; NVIDIA appears in Major corporate members. No roster as-of date is stated. Apple is represented as listed_partner, not a generalized funding relationship.

Source-as-of and retrieval dates are separate. Retrieval is not tenure or proof of continued membership. All relationship start and end dates are unknown. Categories are literal roster categories, never converted into dollar amounts. Advertised membership fees do not establish actual payments. No people, donations, control, policy influence, issuer joins, or security joins are asserted. This is an incomplete convenience sample, not a complete member register or a statement about absent relationships.

## Implementation boundaries

src/institutional-data.js holds isolated organization-label identities, official evidence references, and a strict field allowlist. Additional people, financial fields, joins, unknown source references, duplicate relationships and invented tenure are rejected. Extending this scope requires a deliberate schema/evidence review; the pilot is not an ingestion pipeline.

The view presents labeled directional relationship cards, an entity filter, and expandable evidence. The explicit category and relationship type remain visible. A native modal supplies focus containment, Escape dismissal and background inertness. Close restores focus; each open starts with all four listings. Responsive acceptance covers 320px, 390px and 1280px widths, no horizontal overflow, source expansion and unchanged holdings state/totals. No new third-party dependencies or requests on initial load are introduced.
