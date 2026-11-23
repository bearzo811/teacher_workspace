# Display visual verification — 2026-11-23

Local development fixtures use the actual display view components, synthetic data only, and no database calls. `/display/preview` returns not-found outside development. Development uses `.next-dev` so a production build cannot overwrite its running cache.

Checked points and debt cards with 1, 9, and 15 students at 1280×720 and 3840×2160. Fixed points cards hiding coins/XP and debt cards hiding category counts. Final 4K font-size changes rechecked with 15 students: no document overflow and no debt card overflow. Names, gate labels, and category counts stay visible; long middle content may scroll inside a card at 720p.

Calendar with 50 synthetic countdowns at 1280×720: document does not overflow; countdown pane has its own scroll area and `overscroll-behavior: contain`. Reading matrices with 15 students retain 30 total data rows across two tables inside the scrollable content area, while seat selection and navigation remain outside that area.

Evidence: `/private/tmp/teacher-pilot-debts-15-4k-final.png`, `/private/tmp/teacher-pilot-points-15-4k-final.png`, `/private/tmp/teacher-pilot-learning-15-720.png`. These are local artifacts, not repository assets.

This verifies browser geometry, not physical whiteboard readability, all browser zoom settings, all routes, or production database permissions. Learning writes and lunch still require further implementation/verification.
