# Display appearance

Migration 0037 stores per-class 16–32 px reference typography and bottom-navigation visibility, with version checks to prevent stale saves. This is appearance, not authorization: hiding a tab does not grant/revoke an API. Optional module and operation flags remain independent. Paired devices read appearance through their existing token; teachers cannot edit another class's settings.

Text sizes use a shared CSS scale variable; page dimensions and touch padding are not zoomed. Cards/content retain internal scrolling for large text. The teacher is told to verify the actual whiteboard viewing distance. Default is 22; responsive text still varies by its role and viewport, so this is a reference size rather than a promise that every element renders at exactly that size.

Local SQL tests cover bounds, unknown/duplicate section IDs, stale versions, empty navigation, cross-class/anonymous mutation denial and revoked-device reads. 31 tests and production build pass. 720p browser checks cover large-text points cards; 4K remains unverified because the viewport tool did not change the actual DOM dimensions.

Cloud application of 0037 was rejected by automatic review because its new database permissions were not covered by the earlier 0031–0036 confirmation. The batch was replaced and clipboard-compared against exactly 0031–0036 before execution; those six migrations succeeded. 0037 and `PILOT_DISPLAY_APPEARANCE_ENABLED` remain pending separate action-time confirmation.

2026-11-24 update: the user supplied that confirmation. Migration 0037 applied successfully to the pilot project, and the production appearance flag was added. Deployment and teacher/device settings verification follow; the earlier rejection was not bypassed.
