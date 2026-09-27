# Beyond Doc Design System

Source: HeroUI Pro Design System `9c5e95fa-9b3c-43e1-8da7-aee041fee951`

## Direction

- Theme: Glass
- Product accent: `#D9321C`
- Typography: Manrope for Latin, Noto Sans Thai for Thai
- Base radius: `16px`; field radius: `32px`
- Spacing scale: `4px`
- Blur: `20px` in light mode, `36px` in dark mode

The application uses semantic HeroUI tokens. Components must not branch on light or dark mode to choose raw colors.

## Component rules

- Use HeroUI components for interactive controls and HeroUI Pro for application patterns such as AppLayout, Sidebar, Stepper, Segment, and NativeSelect.
- Use `bg-surface`, `bg-surface-secondary`, `text-foreground`, `text-muted`, `border-border`, and status tokens instead of hard-coded neutral colors.
- Use `variant="primary"` for the main action, `secondary` or `ghost` for alternatives, and semantic danger variants for destructive actions.
- Use `onPress` on HeroUI controls.
- Keep glass depth subtle: one surface layer, tokenized borders, and no extra card shadows.
- Printable documents remain an intentional white canvas and do not inherit application glass surfaces.

## Theme behavior

`next-themes` stores `light`, `dark`, or `system` and applies HeroUI's standard `light` and `dark` classes. The glass look comes from semantic token overrides rather than replacing the base theme class, so every HeroUI component receives the complete foreground, surface, field, and state token set. The theme switcher is available in the application navbar and on the login screen.

## Accessibility

- Every icon-only action needs an accessible label and tooltip.
- Focus styling must use the accent-derived `--focus` token.
- Status must be communicated by text or icon as well as color.
- Interactive targets should remain comfortable on touch devices.

## Charts and motion

- Use HeroUI Pro chart subpath imports with semantic colors and theme-aware tooltips.
- The six-month trend represents document value, not cash flow. Payment distribution counts non-draft, non-cancelled payment-enabled documents; it does not estimate partially paid amounts.
- Keep empty states truthful: zero baselines or a neutral empty ring, with no synthetic business data.
- Page and wizard transitions fade for 180ms. Dashboard sections enter over 320ms with small stagger delays; charts animate over 600ms.
- Respect `prefers-reduced-motion`; CSS motion also respects HeroUI's `data-reduce-motion` override. Avoid transform-based page wrappers so sticky and fixed form controls retain their positioning.
- Keep navigation immediate and animate only actionable quick links on hover. Preserve form values when moving backwards through the wizard.

## Responsive layout

- Keep HeroUI's native mobile drawer at widths up to 768px. Default to the icon sidebar on tablets up to 1024px; users can still expand it manually.
- Use 16px outer gutters on phones and 24px from the small breakpoint. Stack form fields and wizard totals before adding desktop columns.
- Do not position status badges over names. Wrap actions and preserve readable input widths, especially item names.
- Tables scroll inside their own container, never by widening the application. Dialogs use dynamic viewport height and scrollable bodies.
- Preserve browser zoom, use at least 16px input text on coarse pointers, and account for safe-area insets in shell and sticky actions.
- Validate at 320, 390, 768, 834, 1024 and 1440px widths plus a short landscape viewport. Viewport checks do not replace testing on physical Safari/iOS devices.
