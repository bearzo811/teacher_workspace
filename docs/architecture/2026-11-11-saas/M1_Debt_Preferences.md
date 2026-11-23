# Personal debt display preferences

Migration 0036 stores active-term, per-student ordering and a switch for the two secondary display items. The existing latest-work → passport → reading default remains when no override is saved. Explicit priorities come first; newly appearing debt retains default relative order after them. Completed/archived keys never resurrect a task, and preferences never change gate decisions, counts, grades or rewards.

The teacher editor supports native drag/drop and a position selector for keyboard/touch operation. Save uses an expected version to reject overwriting a newer teacher change. Reset submits an empty override. The paired display reads only its own class's preferences through the existing debt snapshot, with disabled modules returning no preferences.

Local integration checks cover student/term ownership, foreign teacher denial, anonymous mutation denial, stale versions, duplicate keys, removed assignments, out-of-term reading, device revocation, and preference reads. A pure ordering test covers stale keys and new/default items. Local browser verified position selection and the secondary-items switch; native pointer drag/drop and cloud persistence still need end-to-end verification.

`PILOT_DEBT_PREFERENCES_ENABLED` remains off and migration 0036 is not applied to cloud until action-time authorization. The legacy site is untouched.
