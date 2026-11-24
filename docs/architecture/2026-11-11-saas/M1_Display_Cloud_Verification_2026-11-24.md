# Paired display verification — 2026-11-24

Scope: pilot only, synthetic B class `b05562ba-db8b-4772-bfae-1f31ef20d9a7`, synthetic student seat 2. The legacy application/database were untouched.

0031–0036 applied in one transaction after explicit permission. Deployment `dpl_63ZTkyjkfRgjGXxzwvLVzxS9DPuF` is Ready, with six matching flags enabled. 0037 was separately authorized and applied on 2026-11-24; its flag was added for the next deployment.

Observed through the real paired display and teacher UI:

- Today's due fixture was submitted as `pending`, with immediate pending feedback and then handed-in text. It did not receive a homework completion award.
- Morning cleaning created one device receipt and one +2 coin/+2 XP ledger entry. Teacher cancellation restored the balance to zero.
- In week 13, completing week 14 passport gave +8 coins and no XP. Teacher cancellation returned coins to zero.
- November newspaper and reflection were independently completed from the display. Each gave the synthetic class's configured +5 coins and no XP. Teacher reset each to not-started and the displayed balance returned to zero.
- With no selected student, passport and reading render the class matrix; selecting a seat enables that student's completion buttons. Future December/January reading cells have no completion button.
- Routine/passport/reading reward settings were restored OFF through teacher UI after verification.

Temporary due assignment: `a0310036-0000-4000-8000-000000000001`, content `白板繳交驗收（虛構）`, contact 2026-11-20, due 2026-11-23. It still needs recoverable archiving at the end of the full run. The new paired device also still needs revocation. Histories/receipts must be retained.

Remaining checks: per-student preference cloud interaction, appearance teacher/device round trip, calendar scroll/countdown interaction, final read-only cleanup audit. Actual 4K and native pointer drag remain unverified. The browser approval service interrupted the run on 2026-11-23 because of a usage limit; the same action was resumed after the stated reset time, with no alternate browser or policy bypass.

Evidence: `/private/tmp/teacher-pilot-cloud-submission-routine.png`, `/private/tmp/teacher-pilot-cloud-passport-coins.png`, `/private/tmp/teacher-pilot-cloud-reading-coins.png`, `/private/tmp/teacher-pilot-cloud-reflection-coins.png`, `/private/tmp/teacher-pilot-migration-0037.png`.
