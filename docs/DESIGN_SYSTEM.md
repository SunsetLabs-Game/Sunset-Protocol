# Obsidian Core — Sunset Visual DNA

> The design language for Sunset's interface layer.
> Not a theme. A discipline.

---

## Philosophy

Obsidian Core is not "black with gold."
It is **control, warmth, and precision.**

Gold is the atmosphere.
Black is the anchor.
Red is the warning.

If something ever feels like it "stands out too much," you have already broken the balance.

---

## 1. Color Architecture

### The Ratio

This is the single most important rule. Everything else follows from it.

| Role | Weight | Purpose |
|------|--------|---------|
| Gold / warm metallic neutrals | 60% | Primary surfaces, visual atmosphere, brand presence |
| Black / deep charcoals | 25% | Contrast, framing, fine detail, structural anchors |
| Neutrals (soft ivories, muted taupes, smoke grays) | 14% | Text, secondary surfaces, dividers |
| Red | 1% | Signal only — error, warning, critical state |

If you exceed these proportions, the interface becomes ornamental.

### Gold Owns the Canvas

Gold is not an accent anymore — it is the field the product lives in.

Use it as the dominant visual presence. But never use loud, flat yellow. Work with two depth levels:

- **Primary field** — muted brushed gold (`#C9A94E`, `#B8975A`, `#A7864D` or similar).
- **Soft elevated surfaces** — lighter champagne or sand-gold variations with restrained contrast.

Depth is not created with gloss or theatrical metallic effects.
It is created with **subtle contrast**.

The interface should feel like finely finished metal under controlled light.

### Black Does Not Dominate — It Defines

Black now exists to sharpen the composition.

**Correct uses:**

- Key typography on gold surfaces.
- Hairline borders, dividers, and framing.
- Input outlines, icons, tab indicators, data contrast.
- Dense modules that need stronger legibility or restraint.

**Never:**

- Let black reclaim the whole interface.
- Turn black into heavy slabs unless you need a deliberate anchor.
- Use pure black everywhere with no tonal variation.

Black should feel like **lacquered precision**, not emptiness.

If you use it too much, the system collapses back into a generic dark fintech aesthetic.

**Tone guidance:** Avoid `#FFD700` (that is casino, not sophistication). Target muted, warm metallics — think `#C9A94E`, `#B8975A`, `#D6C08A`, or similar desaturated golds. The gold should feel calm, architectural, and expensive.

### Red Is Not Identity — It Is Signal

Red is never the protagonist.

**Use only for:**

- Error states.
- Warnings.
- Critical status indicators.
- Destructive action confirmation.

**Never:**

- As a background.
- As a primary brand color.
- Decoratively.

Red is tension. And tension is used with purpose.

**Critical rule:** Never combine red and gold in the same component. That looks heavy and baroque — the opposite of what we want.

---

## 2. Typography

If the design is elegant but the typography is generic, everything collapses.

### Principles

- Modern sans-serif. Clean geometry.
- Medium weight as the base — not thin, not bold.
- Generous vertical spacing. Let lines breathe.
- Elegance comes from **rhythm and air**, not from the font itself.

### Hierarchy

| Level | Color | Weight | Usage |
|-------|-------|--------|-------|
| Display / Hero | Deep black (`#111111`) | Semibold | Page titles, hero headlines, principal numeric emphasis |
| Section headings | Carbon (`#1F1F1F`) | Medium | Card headers, section labels |
| Body text | Soft charcoal (`#3B3B3B`) | Regular | Descriptions, values, secondary content |
| Captions / labels | Warm gray (`#6B645A`) | Regular | Metadata, timestamps, tertiary info |
| Disabled / inactive | Dusty taupe (`#938A7A`) | Regular | Unavailable states |

Pure white should be rare. On a gold-led system, elegance comes from dark ink against warm surfaces, not from high-luminance text everywhere.

---

## 3. Composition and Spatial Hierarchy

Obsidian Core is built on:

- **Generous negative space.** Components need air.
- **Clear separation.** Nothing compressed.
- **Visual breathing room.** If elements are crammed together, it is no longer elegant.

Luxury needs to breathe.

### Spacing Philosophy

- Padding inside components: generous, never tight.
- Gaps between sections: large enough to create clear visual separation.
- Cards and panels: float with space around them — never edge-to-edge unless intentional.
- One piece of content per visual region. Avoid cognitive overload.

### Depth Model

Build depth through **layering**, not shadows:

1. **Canvas** — the broad muted gold field. Quiet, warm, controlled.
2. **Surface** — the primary gold field.
3. **Element** — champagne, sand, or muted metallic modules sitting inside that field.
4. **Anchor** — black accents, typography, controls, and disciplined contrast points.

Avoid drop shadows. If you must use them, they should be nearly invisible — a 1-2px soft blur at very low opacity. The palette should derive separation from tone, edge control, and material contrast.

---

## 4. Component Guidelines

### Buttons

- **Primary CTA:** Gold background with black text or iconography. It can be more present now, but still compact and precise.
- **Secondary:** Pale gold or transparent with a thin black or warm-neutral border. Dark text.
- **Destructive:** Ghost with red text/border. Never a solid red fill.
- **Disabled:** Reduced contrast, never glossy, never bright.

Buttons are never large. They are precise, compact, purposeful.

### Cards and Panels

- Background: warm gold, champagne, or softly desaturated metallic neutrals.
- Border: 1px, very subtle dark line or slightly darker tonal edge.
- Corner radius: small and consistent. Nothing excessively rounded.
- Content inside: well-spaced, never cramped.

### Inputs and Forms

- Understated. Thin borders, generous height.
- Focus state: thin black border, underline, or crisp contrast shift.
- Error state: thin red border. Never a red background fill.
- Placeholder text: warm gray, never distracting.

### Tables and Data

- Minimal grid lines. Use spacing and alternating subtle tonal rows instead of heavy borders.
- Header row: slightly bolder text, no background fill.
- Selected/active row: subtle dark keyline, dense text contrast, or a restrained tonal shift.

### Navigation

- Active tab/item: black underline, black label, or disciplined dark chip treatment. Small, precise.
- Inactive items: warm muted neutrals.
- Hover: slight darkening or contrast increase, never a flashy color jump.

### Modals and Overlays

- Warm dark backdrop with subtle opacity.
- Modal surface: elevated gold or champagne card treatment with black detail accents.
- Focus is maintained through contrast, not animation.

---

## 5. Motion and Animation

Obsidian Core does not perform. It transitions.

- Animations are subtle and functional: state changes, page transitions, micro-feedback.
- Duration: fast (150-250ms). Never slow or dramatic.
- Easing: ease-out for entrances, ease-in for exits.
- No bouncing, no spring physics, no flashy effects.
- Loading states: minimal — a thin black progress bar, quiet spinner, or low-contrast tonal sweep.

If the animation draws attention to itself, it is wrong.

---

## 6. What to Avoid

This is where most implementations fail.

- **Overloaded hero sections.** Keep them stark and powerful.
- **Bright illustrations** or images with saturated colors. They clash with the palette.
- **Flat yellow fills.** They erase sophistication instantly.
- **Red as identity.** Red is strictly signal.
- **Excessive animation.** No shimmer effects, no particle backgrounds, no parallax.
- **Shiny gradients, glows, or fake reflections.** None.
- **Black taking over entire pages without reason.** That undoes the new hierarchy.
- **Mixing red and gold in one component.** Heavy and baroque.
- **Using bright gold (`#FFD700`).** That is a casino.

Obsidian Core does not need to prove anything.
And that is precisely what makes it powerful.

---

## 7. Psychology Behind the Style

This matters for product positioning.

**Gold led by black detail communicates:**

- Exclusivity
- Warm authority
- Security
- Solidity
- Financial confidence
- Technical maturity

**It does not communicate:**

- Fun
- Youth
- Casual community

**It is ideal for:**

- Financial infrastructure
- DeFi dashboards and protocols
- Block explorers
- Developer tools
- Institutional crypto products
- Premium platforms

Sunset is a shielded concentrated liquidity protocol. Users are trusting it with private financial operations. The interface must project that trust through visual discipline.

---

## 8. Where This Aesthetic Excels

- Minimalist landing page with a powerful headline.
- Financial dashboards with dense but breathable data.
- Serious blockchain explorers.
- Institutional-grade crypto products.
- Technical infrastructure interfaces.

If the product demands solidity, this aesthetic elevates it.

---

## 9. The Hidden Truth

The real luxury is not the color.
It is the **proportion**.

Gold can now occupy larger surfaces, but only when its tone is restrained and the black detailing remains disciplined.

Space always communicates more than decoration.

Restraint always wins.

---

*Obsidian Core lives in structured minimalism. Every pixel earns its place.*
