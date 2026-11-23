# Paired display learning completion

Migration 0035 adds one-way completion for a paired device's own active student. The device cannot supply a class, completion date, reward amount, teacher identity, or a cancellation state. Module, active term dates, student attendance and passport range/term length are checked under the class lock. Future passport weeks are allowed and receive the existing Monday amount when early; future reading months and July/August are rejected.

The private transaction-scoped context introduced in 0032 is reused with exact student, day, source table and target keys. Existing passport/reading reward triggers retain their versioned, teacher-opt-in, no-XP rules; new ledger rows identify the device. Teacher cancellation still reverses the original effect. Already-completed rows are preserved, re-enabling awards does not backfill them, and receipt failure rolls back completion and coins together.

Receipts deduplicate request UUIDs and reject reuse for another student/target. Direct table writes and teacher mutation functions remain denied to anonymous users. The UI exposes completion only for the selected student's row, with immediate pending feedback and success text verified against the returned state.

Local integration checks cover early 8-coin completion, repeat requests, request conflicts, teacher reversal, reading awards, reward opt-out/re-enable, rollback, absence, term boundary, module off, cross-class student and revoked device. Production build passes. Cloud migration and `PILOT_DISPLAY_LEARNING_COMPLETE_ENABLED` remain disabled pending action-time permission; this document does not claim cloud end-to-end verification.
