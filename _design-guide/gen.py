import json, sys, os
root = sys.argv[1]
C = [
 ("limewash",  "#F3F4F1", "#0E1513", "Page ground. Named after the lime plaster walls of the villas we run. The default surface for every page."),
 ("paper",     "#FBFBF9", "#151E1B", "Raised surface: plan cards, form panels, the header once it turns solid. Never used as the page ground."),
 ("stone",     "#E6E8E3", "#1B2622", "Quiet alternate band for a section that needs separation without a colour change. Use at most once between two limewash sections."),
 ("line",      "#C9CEC7", "#3A4844", "Hairline rules and dividers (1px). Decorative only, never the only border of a control."),
 ("line-strong","#7F8984", "#6E7B76", "Input and checkbox borders, 3:1 on limewash and paper in both themes."),
 ("ink",       "#1A2220", "#ECEEE9", "Headings and body text on limewash, paper, stone and teal-tint."),
 ("ink-soft",  "#47524E", "#BAC2BD", "Lead paragraphs and secondary copy on limewash, paper, stone and teal-tint."),
 ("ink-mute",  "#5C6763", "#959F9A", "Captions, sources and spec labels on limewash, paper, stone and teal-tint (4.7:1 or better)."),
 ("teal",      "#13564F", "#86C0B5", "The brand colour. Primary button fill, text links, active nav, focus ring. As text, on limewash, paper, stone and teal-tint."),
 ("on-teal",   "#F3F4F1", "#0E1513", "Text and icons on a teal fill (primary button)."),
 ("teal-deep", "#0B3430", "#102F2A", "The one dark band per page: the closing call to action and the footer. Text on it is on-band."),
 ("on-band",   "#F3F4F1", "#ECEEE9", "Headings and body text on teal-deep."),
 ("band-soft", "#AFC4BE", "#A9BFB9", "Secondary text on teal-deep (7.4:1)."),
 ("teal-tint", "#E1EBE8", "#16302C", "Tinted panel behind a highlighted figure or the selected plan. Text on it is ink."),
 ("brass",     "#A47C3A", "#C7A263", "The accent. The logo mark on teal-deep, the 1px rule above a figure, the active underline. Graphic use only, never body text."),
 ("brass-ink", "#7A5A22", "#D6B67A", "Brass as text: the single small spec label that needs to stand out, on limewash or paper."),
 ("alert",     "#A3402A", "#E8866E", "Form errors only, always with a written message beside it."),
]
tokens = {
 "name": "IndaVillas", "version": 1,
 "color": {"themes": [{"id": "light", "name": "Light"}, {"id": "dark", "name": "Dark"}],
   "tokens": [{"name": n, "value": {"light": l, "dark": d}, "usage": u} for n, l, d, u in C]},
 "type": {
   "fonts": [
     {"family": "Bodoni Moda", "file": "fonts/BodoniModa-Variable.woff2", "weight": "400 700", "style": "normal"},
     {"family": "Hanken Grotesk", "file": "fonts/HankenGrotesk-Variable.woff2", "weight": "300 700", "style": "normal"}],
   "families": {"display": "\"Bodoni Moda\", \"Didot\", \"Bodoni 72\", Georgia, serif",
                "text": "\"Hanken Grotesk\", \"Helvetica Neue\", Arial, sans-serif"},
   "groups": [
     {"name": "Display", "family": "display", "styles": [
       {"name": "display-xl", "fontSize": "72px", "lineHeight": "76px", "fontWeight": 400, "letterSpacing": "-0.01em", "opticalSize": 96, "sample": "Your villa, run like a business.", "usage": "The hero headline only. One per page. Mobile: display-lg."},
       {"name": "display-lg", "fontSize": "52px", "lineHeight": "56px", "fontWeight": 400, "letterSpacing": "-0.01em", "opticalSize": 72, "sample": "One team, one system.", "usage": "Section headline that opens a chapter of the page. Mobile: heading-1."},
       {"name": "heading-1", "fontSize": "38px", "lineHeight": "44px", "fontWeight": 400, "opticalSize": 48, "sample": "Three phases from launch to full rate.", "usage": "Section headline inside a chapter."},
       {"name": "heading-2", "fontSize": "28px", "lineHeight": "34px", "fontWeight": 500, "opticalSize": 28, "sample": "Rate strategy and dynamic pricing", "usage": "Card and plan names, sub-section heads."},
       {"name": "figure", "fontSize": "56px", "lineHeight": "56px", "fontWeight": 400, "opticalSize": 96, "sample": "$3,999", "usage": "Prices and revenue figures. Always paired with a spec-label underneath that says what the number is and where it comes from."}]},
     {"name": "Text", "family": "text", "styles": [
       {"name": "lead", "fontSize": "19px", "lineHeight": "30px", "fontWeight": 300, "sample": "We help owners of 5+ bedroom luxury villas grow rental revenue within 90 days.", "usage": "The paragraph under a display headline. Max 52 characters wide. Colour ink-soft."},
       {"name": "title", "fontSize": "18px", "lineHeight": "26px", "fontWeight": 600, "sample": "Photo shoot with 100+ photos", "usage": "List item heads, form panel titles."},
       {"name": "body", "fontSize": "16px", "lineHeight": "26px", "fontWeight": 400, "sample": "You keep the asset; we run the commercial side.", "usage": "All running text. Max 68 characters wide."},
       {"name": "body-sm", "fontSize": "14px", "lineHeight": "22px", "fontWeight": 400, "sample": "Setup included, billed once a year.", "usage": "Notes under prices, form hints, footer text."},
       {"name": "button", "fontSize": "15px", "lineHeight": "20px", "fontWeight": 600, "letterSpacing": "0.01em", "sample": "Book a free analysis", "usage": "Buttons and the header CTA."},
       {"name": "spec-label", "fontSize": "12px", "lineHeight": "16px", "fontWeight": 600, "letterSpacing": "0.08em", "sample": "5 BEDROOMS / UP TO 12 GUESTS", "usage": "Uppercase spec labels in SpecLine and under a figure. Mirrors the legend on an architect's floor plan. Never above a headline as an eyebrow."},
       {"name": "caption", "fontSize": "13px", "lineHeight": "18px", "fontWeight": 400, "sample": "Source: AirDNA, Bali 4 bedroom villas, last 12 months.", "usage": "Photo captions and data sources. Colour ink-mute."}]}]},
 "spacing": {"tokens": [
   {"name": "space-4", "value": "4px", "usage": "Icon to label."},
   {"name": "space-8", "value": "8px", "usage": "Between a figure and its spec-label; inside chips."},
   {"name": "space-12", "value": "12px", "usage": "Between list items in a plan card."},
   {"name": "space-16", "value": "16px", "usage": "Mobile side gutter; label to input."},
   {"name": "space-24", "value": "24px", "usage": "Headline to lead; card padding on mobile."},
   {"name": "space-32", "value": "32px", "usage": "Card padding on desktop; between form fields groups."},
   {"name": "space-48", "value": "48px", "usage": "Desktop side gutter; lead to buttons in the hero."},
   {"name": "space-64", "value": "64px", "usage": "Mobile section padding."},
   {"name": "space-96", "value": "96px", "usage": "Standard desktop section padding."},
   {"name": "space-128", "value": "128px", "usage": "Chapter breaks: before a display-lg headline and around full-bleed photos. Whitespace is the luxury signal."}]},
 "radius": {"tokens": [
   {"name": "radius-0", "value": "0", "usage": "Photos, bands, the hero. Architecture is square; so are our pictures."},
   {"name": "radius-sm", "value": "2px", "usage": "Buttons, inputs, chips."},
   {"name": "radius-md", "value": "6px", "usage": "Plan cards, form panels, dialogs. The largest radius in the system."},
   {"name": "radius-full", "value": "999px", "usage": "Only the 8px status dot. Never a button or a card."}]},
 "shadow": {"note": "Borders before shadows. The only shadow is for things that float above content.", "tokens": [
   {"name": "shadow-float", "value": {"light": "0 1px 2px rgba(11, 52, 48, 0.06), 0 12px 32px rgba(11, 52, 48, 0.10)", "dark": "0 1px 2px rgba(0, 0, 0, 0.4), 0 12px 32px rgba(0, 0, 0, 0.45)"}, "usage": "The solid header after scrolling, menus and dialogs. Nothing else."}]},
}
os.makedirs(f"{root}/project", exist_ok=True)
json.dump(tokens, open(f"{root}/project/tokens.json", "w"), indent=2, ensure_ascii=False)

# first tokens.css, laid out as the format's compiled shape
out = ["/* IndaVillas — generated from tokens.json */"]
for f in tokens["type"]["fonts"]:
    out.append(f'@font-face {{ font-family: "{f["family"]}"; src: url("fonts/{os.path.basename(f["file"])}") format("woff2"); font-weight: {f["weight"]}; font-style: normal; font-display: swap; }}')
def block(sel, theme):
    lines = [f"  --{t['name']}: {t['value'][theme]};" for t in tokens["color"]["tokens"]]
    lines += [f"  --{t['name']}: {t['value'][theme]};" for t in tokens["shadow"]["tokens"]]
    return sel + " {\n" + "\n".join(lines) + "\n}"
out.append(block(':root, [data-theme="light"]', "light"))
out.append(block('[data-theme="dark"]', "dark"))
rl = [f"  --{t['name']}: {t['value']};" for t in tokens["spacing"]["tokens"] + tokens["radius"]["tokens"]]
rl += [f"  --font-{k}: {v};" for k, v in tokens["type"]["families"].items()]
out.append(":root {\n" + "\n".join(rl) + "\n}")
for g in tokens["type"]["groups"]:
    for s in g["styles"]:
        css = [f"font-family: var(--font-{g['family']})", f"font-size: {s['fontSize']}", f"line-height: {s['lineHeight']}", f"font-weight: {s['fontWeight']}"]
        if "letterSpacing" in s: css.append(f"letter-spacing: {s['letterSpacing']}")
        if "opticalSize" in s: css.append(f"font-variation-settings: 'opsz' {s['opticalSize']}")
        out.append(f".{s['name']} {{ " + "; ".join(css) + "; }")
open(f"{root}/project/tokens.css", "w").write("\n".join(out) + "\n")
print("ok")
