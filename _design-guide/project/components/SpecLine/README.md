# SpecLine

A row of short facts in `spec-label` caps, split by 1px `line` hairlines, borrowed from the legend on an architect's floor plan. It is the system's identity motif: it appears in the hero, under plan names and in the closing band.

**The consumer provides** two to four facts, each two to four words, all true and checkable (channels, terms, bedroom counts). Wrap it in a `ul` with an `aria-label` that says what the facts describe.

**Rules**
- Facts only. No adjectives ("premium", "seamless"), no numbers without a source.
- Never above a headline as an eyebrow; it sits below or beside the thing it describes.
- On `teal-deep` use `iv-spec--band`.
