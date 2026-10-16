
import {
  phDate,
  phDateTime,
  roundMoney
} from "./payroll";

// Classroom demo policy, not statutory deductions.

export const LATE_BRACKETS = [
  { min: 1, max: 10, percent: 0.3 },
  { min: 11, max: 20, percent: 0.6 },
  { min: 21, max: 30, percent: 0.9 },
  { min: 31, max: 59, percent: 1.2 }
];

const MINUTE = 60000;
const DAY = 86400000;

export function shiftCalendarDate(
  date,
  difference = 0
) {
  const d = new Date(`${date}T12:00:00Z`);

  if (!Number.isFinite(d.getTime())) {
    throw new Error("Invalid work date.");
  }

  return new Date(
    d.getTime() + difference * DAY
  )
    .toISOString()
    .slice(0, 10);
}

export function isScheduledWeekday(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date || "")) {
    return false;
  }

  const day = new Date(
    `${date}T12:00:00Z`
  ).getUTCDay();

  return day >= 1 && day <= 5;
}

export function previousWorkingDate(
  date = phDate()
) {
  let candidate = shiftCalendarDate(date, -1);

  while (!isScheduledWeekday(candidate)) {
    candidate = shiftCalendarDate(candidate, -1);
  }

  return candidate;
}

export function approvedLeaveForDay(
  leaves,
  employeeId,
  day
) {
  return (leaves || []).find(
    leave =>
      leave.employeeId === employeeId &&
      leave.status === "Approved" &&
      leave.start <= day &&
      leave.end >= day &&
      (
        leave.type === "Maternity Leave" ||
        isScheduledWeekday(day)
      )
  );
}

export function pendingLeaveForDay(
  leaves,
  employeeId,
  day
) {
  return (leaves || []).find(
    leave =>
      leave.employeeId === employeeId &&
      leave.status === "Pending" &&
      leave.start <= day &&
      leave.end >= day &&
      (
        leave.type === "Maternity Leave" ||
        isScheduledWeekday(day)
      )
  );
}

/* ==========================
   AUTOMATIC LATE DETECTION
========================== */

export function calculateLate(record, settings) {
  const noRecord = {
    minutesLate: 0,
    percent: 0,
    deduction: 0,
    dailyPay: 0,
    status: "Not evaluated",
    scheduledDate: null,
    scheduledStart: null
  };

  if (!record?.timeIn) return noRecord;

  const shift = settings?.shifts?.[record.shift];

  if (
    !shift ||
    !/^\d\d:\d\d$/.test(shift.start || "") ||
    !/^\d\d:\d\d$/.test(shift.end || "")
  ) {
    return noRecord;
  }

  const stamp = new Date(record.timeIn);

  if (!Number.isFinite(stamp.getTime())) {
    return noRecord;
  }

  const ph = phDateTime(stamp);
  const clockDate = ph.slice(0, 10);
  const clockTime = ph.slice(11, 16);

  let scheduledDate = clockDate;

  // Supports overnight evening shifts.
  if (
    shift.end <= shift.start &&
    shift.start >= "12:00" &&
    clockTime < "12:00"
  ) {
    scheduledDate = shiftCalendarDate(
      clockDate,
      -1
    );
  }

  const scheduledStart = new Date(
    `${scheduledDate}T${shift.start}:00+08:00`
  );

  const minutesLate = Math.max(
    0,
    Math.ceil(
      (
        stamp.getTime() -
        scheduledStart.getTime()
      ) / MINUTE
    )
  );

  const [startH, startM] =
    shift.start.split(":").map(Number);

  const [endH, endM] =
    shift.end.split(":").map(Number);

  let shiftMinutes =
    endH * 60 + endM -
    (startH * 60 + startM);

  if (shiftMinutes <= 0) {
    shiftMinutes += 1440;
  }

  const rate = Number(
    record.rate ?? shift.rate
  );

  const dailyPay =
    Number.isFinite(rate) && rate > 0
      ? roundMoney(
          rate * shiftMinutes / 60
        )
      : 0;

  if (minutesLate === 0) {
    return {
      minutesLate: 0,
      percent: 0,
      deduction: 0,
      dailyPay,
      status: "On Time",
      scheduledDate,
      scheduledStart:
        scheduledStart.toISOString()
    };
  }

  if (minutesLate >= 60) {
    return {
      minutesLate,
      percent: 0,
      deduction: 0,
      dailyPay,
      status: "Absent cutoff · for review",
      scheduledDate,
      scheduledStart:
        scheduledStart.toISOString()
    };
  }

  const bracket = LATE_BRACKETS.find(
    item =>
      minutesLate >= item.min &&
      minutesLate <= item.max
  );

  const percent = bracket?.percent ?? 0;

  return {
    minutesLate,
    percent,
    deduction: roundMoney(
      dailyPay * percent / 100
    ),
    dailyPay,
    status: "Late",
    scheduledDate,
    scheduledStart:
      scheduledStart.toISOString()
  };
}

/* ==========================
   LOCKED LATE SNAPSHOTS
========================== */

export function lateForRecord(record, settings) {
  if (
    record?.late &&
    Number.isFinite(
      Number(record.late.minutesLate)
    )
  ) {
    return record.late;
  }

  return calculateLate(record, settings);
}

export function attendanceForDay(
  records,
  employeeId,
  day,
  settings
) {
  return (records || []).find(
    record =>
      record.employeeId === employeeId &&
      lateForRecord(
        record,
        settings
      ).scheduledDate === day
  );
}

/* ==========================
   DAILY EMPLOYEE STATUS
========================== */

export function monitorDay(
  employee,
  day,
  data
) {
  const attendance = attendanceForDay(
    data.attendance,
    employee.id,
    day,
    data.settings
  );

  if (attendance) {
    const late = lateForRecord(
      attendance,
      data.settings
    );

    return {
      type:
        late.minutesLate >= 60
          ? "Cutoff Flag"
          : late.minutesLate > 0
          ? "Late"
          : "Present",
      attendance,
      late
    };
  }

  const leave = approvedLeaveForDay(
    data.leaves,
    employee.id,
    day
  );

  if (leave) {
    return {
      type: "Approved Leave",
      leave
    };
  }

  const pending = pendingLeaveForDay(
    data.leaves,
    employee.id,
    day
  );

  if (pending) {
    return {
      type: "Pending Leave",
      leave: pending
    };
  }

  const absence = (
    data.absences || []
  ).find(
    item =>
      item.employeeId === employee.id &&
      item.date === day
  );

  if (absence) {
    return {
      type: "Absent",
      absence
    };
  }

  if (!isScheduledWeekday(day)) {
    return { type: "Rest Day" };
  }

  if (day >= phDate()) {
    return { type: "Not Finalized" };
  }

  return { type: "Missing Record" };
}
