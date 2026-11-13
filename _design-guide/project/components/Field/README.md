# Field

A labelled input for the lead forms (free analysis, Foundation snapshot, custom quote).

**Structure:** `div.iv-field` > `label[for]` + `input` or `select` + `span.iv-field__hint`. Add `iv-field--error` and `aria-invalid="true"` on the input to show an error; the hint then holds the error message and is linked with `aria-describedby`.

**The consumer provides** a unique `id`, a label written as a question or a noun ("Where is the villa?", "WhatsApp number"), and validation.

**Rules**
- Labels sit above inputs and never disappear; placeholders are examples, not labels.
- Inputs are 52px tall, `paper` fill, `line-strong` border (3:1 in both themes), `radius-sm`.
- Error text says what is wrong and how to fix it. Colour alone never carries the error.
