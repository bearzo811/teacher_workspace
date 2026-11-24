# Custom duty planning

Local implementation: migration 0038, teacher `/workspace/duty`, pure planner and integration tests. User authorized pilot cloud activation on 2026-11-24; cloud verification is still pending at this point.

Teachers define up to 30 jobs across six parallel groups, 1–15 slots each, weight 1–10, and optional non-overlap with all other work. Within a group a student receives at most one job/day. Exclusive roles are allocated first; those students are excluded from other groups. The remaining slots use deterministic minimum-cost matching, balancing role repetition and cumulative weighted burden. These are planning weights, not coins/XP. Historical published assignments feed later previews; actual substitute-completion adjustments are not yet connected.

The nine-person example is opt-in, not imposed on other teachers: blackboard/table 1 exclusive; front/middle/back sweep and mop 6; garbage 2; grade-two buckets 3 + cart 1; grade-four buckets 3 + cart 1. Thus eight students can do both carry and cleaning/garbage, while the blackboard/table student does only that role. Labels do not append arbitrary slot numbers.

Only actual calendar school days are scheduled. Preview uses the whole chosen range then filters by month, so each month does not restart the rotation. Invalid staffing produces reasons and disables publication. Preview requires an explicit teacher confirmation before publishing.

Published plans and role rows are immutable to ordinary roles. First publication may cover the full term; later versions must start after today, preserving prior records. Month/history queries choose the latest applicable revision for each day. A changed calendar can leave newly added school days unplanned, which the UI explicitly reports. No silent extra assignment or reward occurs.

Publication validates complete school-day/job-slot coverage, active own-class roster, same-class student IDs, group/exclusive constraints, active term, expected revision and exact roster snapshot. It deduplicates request UUIDs with a canonical payload hash. Invalid rows or constraint failures roll back the entire plan. Limits: 100 versions/term, 20,000 role rows/publication and 3 MB schedule JSON; server action limit is 4 MB. Anonymous and device roles receive no duty access here.

35 local tests and build pass, including synthetic SQL isolation, invalid/partial schedules, stale roster/calendar/revision, request replay, history retention, no duplicate future assignments, anonymous/cross-class/module-off denial, 1/9/15-person algorithm cases and fair nine-person role counts. Local browser verified the nine-person example and one-person insufficient-staffing block. Evidence: `/private/tmp/teacher-pilot-duty-nine-preview.png`, `/private/tmp/teacher-pilot-duty-understaffed.png`.

Not complete: manual swaps, voluntary substitution/teacher-approved +3 coins/makeup tracking, paired lunch duty view, actual substitute burden in future rotation, physical touchscreen and 4K acceptance. Do not present the entire duty/substitute module as finished.
