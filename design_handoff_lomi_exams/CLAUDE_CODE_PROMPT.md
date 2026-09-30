# Prompt for Claude Code

Copy the `design_handoff_lomi_exams/` folder into the root of the `exitexam` repo, then paste this into Claude Code:

---

You are implementing a high-fidelity redesign of this repo's web app (`apps/web`, Next.js App Router with Tailwind). The design reference is in `design_handoff_lomi_exams/`. Read `README.md` fully first, then open `Lomi-Exams.dc.html` in a browser (keep `support.js` next to it) and click through every screen with the bottom-right "Screen" dropdown. The HTML is a reference only. Do not ship it or copy its inline-style markup. Rebuild the UI with this codebase's components, Tailwind and route structure.

Rules:
1. Keep every existing API call, auth flow, validation rule and data model. Change UI, copy and information architecture only. Where the design needs data the API doesn't return yet (readiness %, mock trend, heatmap, plan tiers), add a clearly marked TODO and a typed mock, and list these gaps at the end.
2. Rename the product from "Lomi-Test" to "Lomi-Exams" everywhere (metadata, copy, emails). Replace `components/Logo.tsx` with the lemon-slice mark and wordmark from the README.
3. Put the design tokens from the README into `globals.css` / the Tailwind theme as named tokens (brand, ink, line, surface, correct, wrong, warn). Load Outfit and Inter with `next/font`. Don't hard-code hex values in components.
4. Build responsively with the README breakpoints (under 640, 640–1023, 1024 and up): a desktop sidebar, a top bar with bottom tabs on tablet and mobile, and the exam simulator's side grid on desktop versus the 10-question strip and grid overlay on smaller screens. Minimum hit target 44px. Test at 375, 768, 1024 and 1440 widths.
5. Implement the pricing tiers **Starter 300 ETB, Standard 400 ETB, Full prep 500 ETB** in `components/Plans.tsx` and in the backend plan config. Checkout offers telebirr, CBE Birr, card (Chapa) and a bank-transfer receipt upload that feeds the existing admin payments queue.
6. Motion: the landing hero floating shapes, marquee, readiness fill and pulsing dot, as CSS keyframes in a small client component. Disable all of it under `prefers-reduced-motion`.
7. Accessibility: semantic landmarks, visible focus rings (`#A16207`), `aria-pressed`/`role="radio"` on option buttons, labels on icon-only buttons, and exam keyboard shortcuts (← → move, A–D or 1–4 answer, F flag, Esc closes the modal) that are ignored while typing in inputs.

Work in this order, and commit after each step with a short summary:
1. Tokens, fonts, Logo and rename
2. App shell (sidebar, top bar, bottom tabs)
3. Landing (`app/page.tsx` public view, then `f/[slug]`)
4. Auth: sign up, verify, sign in, reset
5. Onboarding (new route `(student)/onboarding`)
6. Today
7. Practice answer view
8. Mocks list, exam simulator, results (new `mocks/[id]/results`)
9. Progress
10. Account
11. Plans and checkout (`(student)/plans`)
12. Admin review, payments and console restyle

When you're done, run lint, typecheck and build. Then report the routes you changed or added, any API gaps with their TODOs, and anything in the design you couldn't match exactly.
