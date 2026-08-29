import assert from "node:assert/strict";
import test from "node:test";
import {
  addCalendarDays,
  displayCoins,
  effectKey,
  gamificationProgress,
  isCompletedOnTime,
  isPastLocalDeadline,
  taipeiDateString,
} from "../src/lib/gamification";
import { schoolWeekForDate } from "../src/lib/schoolWeek";
import { subjectHasClassOnDate } from "../src/lib/coursePlanSchedule";

test("level curve uses cumulative 100 × current level thresholds", () => {
  assert.deepEqual(gamificationProgress(0), {
    level: 1,
    totalXp: 0,
    currentLevelXp: 0,
    nextLevelXp: 100,
    progressPercent: 0,
  });
  assert.equal(gamificationProgress(99).level, 1);
  assert.deepEqual(gamificationProgress(100), {
    level: 2,
    totalXp: 100,
    currentLevelXp: 0,
    nextLevelXp: 200,
    progressPercent: 0,
  });
  assert.equal(gamificationProgress(299).level, 2);
  assert.deepEqual(gamificationProgress(300), {
    level: 3,
    totalXp: 300,
    currentLevelXp: 0,
    nextLevelXp: 300,
    progressPercent: 0,
  });
});

test("coin display floors hidden net debt at zero", () => {
  assert.equal(displayCoins(-3), 0);
  assert.equal(displayCoins(0), 0);
  assert.equal(displayCoins(8), 8);
});

test("Taipei date and deadline checks are calendar based", () => {
  const beforeTaipeiMidnight = new Date("2026-08-09T15:59:59.000Z");
  const afterTaipeiMidnight = new Date("2026-08-09T16:00:01.000Z");
  assert.equal(taipeiDateString(beforeTaipeiMidnight), "2026-08-09");
  assert.equal(taipeiDateString(afterTaipeiMidnight), "2026-08-10");
  assert.equal(isCompletedOnTime(beforeTaipeiMidnight, "2026-08-09"), true);
  assert.equal(isCompletedOnTime(afterTaipeiMidnight, "2026-08-09"), false);
  assert.equal(isPastLocalDeadline("2026-08-09", afterTaipeiMidnight), true);
});

test("calendar math and effect keys are deterministic", () => {
  assert.equal(addCalendarDays("2026-02-28", 1), "2026-03-01");
  assert.equal(
    effectKey("homework", "abc", "student", "completion"),
    "homework:abc:student:completion",
  );
});

test("school week for a date uses the class week-one start", () => {
  assert.deepEqual(
    schoolWeekForDate({
      weekOneStartDate: "",
      date: "2026-08-31",
    }),
    { week: null, label: null },
  );
  assert.deepEqual(
    schoolWeekForDate({
      weekOneStartDate: "2026-08-31",
      termEndDate: "2027-01-20",
      date: "2026-08-31",
    }),
    { week: 1, label: "第 1 週" },
  );
  assert.deepEqual(
    schoolWeekForDate({
      weekOneStartDate: "2026-08-31",
      termEndDate: "2027-01-20",
      date: "2026-09-07",
    }),
    { week: 2, label: "第 2 週" },
  );
});

test("math has no class on Thursday; Chinese still does", () => {
  assert.equal(subjectHasClassOnDate("math", "2026-09-03"), false);
  assert.equal(subjectHasClassOnDate("math", "2026-09-02"), true);
  assert.equal(subjectHasClassOnDate("chinese", "2026-09-03"), true);
});
