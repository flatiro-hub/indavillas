# Button

Use a button for the one action a section asks the owner to take; at most one primary button per screen.

**Variants**
- `iv-btn iv-btn--primary`: teal fill, `on-teal` text. The section's main action ("Book a free analysis", "Start with Growth").
- `iv-btn iv-btn--secondary`: transparent with a `line-strong` border, `ink` text. The quieter alternative beside a primary.
- `iv-btn iv-btn--band`: outline on `teal-deep`, for the closing band only.
- `iv-btn iv-btn--invert`: `on-band` fill with `teal-deep` text, the primary action inside the band.
- add `iv-btn--sm` for the header CTA (44px tall, still a full tap target).

**The consumer provides** an `<a href>` for navigation or a `<button type>` for form actions, and the label.

**Do**
- Write labels that name the result: "Book a free analysis", "Get a custom quote", "Start with Growth".
- Keep corners at `radius-sm` (2px). Square buttons match square photos.

**Don't**
- No arrows or icons as decoration, no pill shapes, no "Get started" or "Learn more".
- Never two primary buttons side by side.
