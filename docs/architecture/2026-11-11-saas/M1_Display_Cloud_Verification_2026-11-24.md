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

Follow-up verification supersedes the remaining-check list above:

- Teacher saved passport-first ordering and hid the secondary two items; the paired display showed that passport alone while retaining all category counts and gates. Reset restored latest-work-first plus the next two items. Preference version 2 ends with empty overrides and `show_more=true`.
- Teacher changed the reference font 22→28 and hid learning/lunch/student navigation. On the paired debt page, the measured student-heading font changed 16→20.3636 px while actual viewport stayed 1280×720; only the selected bottom tabs remained. Restored font 22 and all six section choices, appearance version 2.
- At November 24 the display's November calendar showed the existing synthetic January 15, 2027 event with 52 days remaining, no document overflow. This checks cross-year countdown independence; long-list scrolling is a separate local scenario.
- Cleanup audit confirmed 0 coins/0 XP, all three completion-award switches OFF, fixture assignment archived, one submission receipt, one routine receipt and three learning receipts. No histories or receipts were purged. The new device was revoked through teacher UI and the display then denied calendar access.
- Actual mouse dragging in the development fixture initially failed with native HTML drag/drop. Replaced with pointer capture on explicit drag handles, retained position selectors for keyboard/touch fallback, and verified a real native drag moved passport from third to first. Physical touchscreen dragging and actual 4K remain outstanding.

Additional evidence: `/private/tmp/teacher-pilot-cloud-personal-order.png`, `/private/tmp/teacher-pilot-cloud-appearance.png`, `/private/tmp/teacher-pilot-cloud-countdown.png`, `/private/tmp/teacher-pilot-cloud-cleanup.png`, `/private/tmp/teacher-pilot-cloud-revoked.png`, `/private/tmp/teacher-pilot-pointer-drag-order.png`.

The local 50-countdown fixture was also scrolled with an actual native scroll action at an observed 1280×720: countdown `scrollTop=720`, document `scrollTop=0`, bottom navigation stayed at y=641. Evidence: `/private/tmp/teacher-pilot-calendar-contained-scroll.png`. This is a local synthetic interaction, not a 4K test.

Evidence: `/private/tmp/teacher-pilot-cloud-submission-routine.png`, `/private/tmp/teacher-pilot-cloud-passport-coins.png`, `/private/tmp/teacher-pilot-cloud-reading-coins.png`, `/private/tmp/teacher-pilot-cloud-reflection-coins.png`, `/private/tmp/teacher-pilot-migration-0037.png`.
