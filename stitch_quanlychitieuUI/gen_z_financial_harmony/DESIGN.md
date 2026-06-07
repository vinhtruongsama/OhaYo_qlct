---
name: Gen Z Financial Harmony
colors:
  surface: '#fafaeb'
  surface-dim: '#dbdbcd'
  surface-bright: '#fafaeb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f4f5e6'
  surface-container: '#efefe0'
  surface-container-high: '#e9e9db'
  surface-container-highest: '#e3e3d5'
  on-surface: '#1b1c14'
  on-surface-variant: '#42484a'
  inverse-surface: '#2f3128'
  inverse-on-surface: '#f1f2e3'
  outline: '#72787a'
  outline-variant: '#c2c7ca'
  surface-tint: '#4b626a'
  primary: '#4b626a'
  on-primary: '#ffffff'
  primary-container: '#aec6cf'
  on-primary-container: '#3c535b'
  inverse-primary: '#b2cad3'
  secondary: '#6a596d'
  on-secondary: '#ffffff'
  secondary-container: '#f3dbf4'
  on-secondary-container: '#705e73'
  tertiary: '#516161'
  on-tertiary: '#ffffff'
  tertiary-container: '#b4c6c5'
  on-tertiary-container: '#435352'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#cee7f0'
  primary-fixed-dim: '#b2cad3'
  on-primary-fixed: '#061e25'
  on-primary-fixed-variant: '#344a52'
  secondary-fixed: '#f3dbf4'
  secondary-fixed-dim: '#d6bfd7'
  on-secondary-fixed: '#241728'
  on-secondary-fixed-variant: '#524155'
  tertiary-fixed: '#d4e6e5'
  tertiary-fixed-dim: '#b8cac9'
  on-tertiary-fixed: '#0e1e1e'
  on-tertiary-fixed-variant: '#3a4a49'
  background: '#fafaeb'
  on-background: '#1b1c14'
  surface-variant: '#e3e3d5'
typography:
  headline-lg:
    fontFamily: Quicksand
    fontSize: 30px
    fontWeight: '700'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Quicksand
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 30px
  headline-md:
    fontFamily: Quicksand
    fontSize: 22px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-padding-mobile: 16px
  container-padding-desktop: 40px
  gutter: 20px
  section-gap: 32px
---

## Brand & Style
The design system focuses on a demographic that values transparency, ease of use, and emotional well-being in financial management. The brand personality is approachable, optimistic, and non-judgmental, moving away from the intimidating, cold nature of traditional banking.

The style is **Modern Corporate with a Soft Minimalist twist**. It utilizes a "Soft UI" approach—characterized by gentle rounded corners, a pastel-rich palette, and subtle depth—to reduce the cognitive load and stress associated with money management. The interface should feel like a lifestyle companion rather than a ledger.

## Colors
The color strategy employs a "Calm Palette" to neutralize the anxiety of tracking expenses. 
- **Primary (Pastel Blue):** Used for main actions, active states, and primary navigation.
- **Secondary (Pastel Purple):** Reserved for secondary features, savings goals, and decorative accents.
- **Backgrounds:** Ivory White is the base surface. Light Mint and Lavender are used for section differentiation to create a soft, tiled appearance.
- **Functional:** Income is represented by a soft green, while expenses and warnings use a muted red-pink or orange to signal attention without inducing panic.

## Typography
This design system uses a dual-font strategy. **Quicksand** provides a friendly, rounded geometric feel for headings, making the Vietnamese tone feel conversational and modern. **Inter** is used for body text and data points to ensure maximum legibility for financial figures and long-form information.

Line heights are generous to maintain a "breathable" layout. For Vietnamese diacritics, ensure that the line-height is never tighter than 1.4x the font size to prevent character clipping.

## Layout & Spacing
The system utilizes a **Fluid Grid** with fixed maximum widths for desktop viewing to prevent data stretching. 
- **Mobile:** Single column with 16px horizontal margins.
- **Desktop:** 12-column grid with a max-width of 1200px, 20px gutters, and 40px side margins.
- **Rhythm:** All spacing follows an 8px base unit. Component internal padding should favor 16px (2x) and 24px (3x) to match the soft, airy aesthetic.

## Elevation & Depth
Depth is created through **Tonal Layering** and **Ambient Shadows**. 
- **Surface Level 0:** Ivory White background (#FFFFF0).
- **Surface Level 1 (Cards):** White (#FFFFFF) with a very soft, diffused shadow: `0px 4px 20px rgba(174, 198, 207, 0.15)`. The shadow color is tinted with the Primary Pastel Blue to keep it "airy" rather than "dirty" (grey).
- **Surface Level 2 (Modals/Popovers):** White with a slightly more pronounced shadow: `0px 8px 30px rgba(0, 0, 0, 0.08)`.
Avoid hard borders; use subtle changes in background color (e.g., Light Mint or Lavender) to define content areas.

## Shapes
The shape language is defined by **High Circularity**. 
- Standard components (Buttons, Inputs) use a 12px-16px radius.
- Large containers and Cards use a more pronounced 24px radius to emphasize the "soft" brand personality.
- Interactive elements should never have sharp corners, reinforcing the safe and friendly environment.

## Components
- **Buttons:** Use high-contrast pastel fills for primary actions. Text is bold and centered. Hover states involve a slight scale-up (1.02x) rather than a drastic color change.
- **Cards:** The cornerstone of the UI. Cards must have a 24px corner radius and a subtle ambient shadow. Backgrounds for cards can vary between White, Light Mint, or Pastel Pink to categorize different financial streams.
- **Input Fields:** Backgrounds should be a slightly darker shade than the surface they sit on (e.g., a Creamy Yellow card uses a slightly darker Ivory input). Borders are only used on focus, appearing in the Primary Pastel Blue.
- **Chips:** Used for transaction categories (e.g., "Ăn uống", "Di chuyển"). These should be pill-shaped with a 32px radius and use low-opacity versions of the primary/secondary colors.
- **Progress Bars:** Thicker than standard (approx 12px height) with fully rounded caps, using the secondary Pastel Purple to track savings goals.
- **Lists:** Transaction lists should be "uncontained" (no outer border), using 16px vertical spacing between items and subtle 1px dividers in a 10% opacity version of the primary color.