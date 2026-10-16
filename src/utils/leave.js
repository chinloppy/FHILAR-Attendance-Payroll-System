
/*
  FHILAR APPAREL
  LEAVE MANAGEMENT UTILITIES

  Frontend-only classroom demonstration.

  FHILAR demo benefits:
  - Sick Leave: 20 working days per year
  - Vacation Leave: 20 working days per year

  Temporary working schedule:
  - Monday to Friday
  - Public holidays are not excluded yet

  Maternity leave:
  - Uses calendar days
  - Eligibility must be verified separately
  - SSS benefit calculations are not included yet
*/

export const LEAVE_POLICY = {
  "Sick Leave": 20,
  "Vacation Leave": 20
};

export const MATERNITY_CASES = {
  live: {
    label: "Live childbirth · 105 calendar days",
    days: 105
  },
  solo: {
    label: "Eligible solo parent · 120 calendar days",
    days: 120
  },
  loss: {
    label: "Miscarriage / ETP · 60 calendar days",
    days: 60
  }
};

const DAY = 24 * 60 * 60 * 1000;

/* ========================================
   DATE VALIDATION
======================================== */

function toUTC(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date || ""))) {
    throw new Error("Choose a valid leave date.");
  }

  const value = new Date(`${date}T12:00:00Z`);

  if (
    !Number.isFinite(value.getTime()) ||
    value.toISOString().slice(0, 10) !== date
  ) {
    throw new Error("Invalid calendar date.");
  }

  return value;
}

/* ========================================
   MATERNITY LEAVE END DATE
======================================== */

export function maternityEndDate(
  start,
  maternityCase = "live"
) {
  const caseInfo = MATERNITY_CASES[maternityCase];

  if (!caseInfo) {
    throw new Error(
      "Choose a valid maternity leave category."
    );
  }

  return new Date(
    toUTC(start).getTime() +
    (caseInfo.days - 1) * DAY
  )
    .toISOString()
    .slice(0, 10);
}

/* ========================================
   COUNT LEAVE DAYS
======================================== */

export function leaveDayCount(request) {
  const start = toUTC(request.start);
  const end = toUTC(request.end);

  if (end < start) {
    throw new Error(
      "End date cannot be before start date."
    );
  }

  const calendarDays =
    Math.round((end - start) / DAY) + 1;

  // Maternity leave counts calendar days.
  if (request.type === "Maternity Leave") {
    return calendarDays;
  }

  // Sick and vacation leave count
  // Monday-Friday working days.
  let workingDays = 0;

  for (let n = 0; n < calendarDays; n += 1) {
    const weekday = new Date(
      start.getTime() + n * DAY
    ).getUTCDay();

    if (weekday !== 0 && weekday !== 6) {
      workingDays += 1;
    }
  }

  return workingDays;
}

/* ========================================
   EMPLOYEE LEAVE BALANCES
======================================== */

export function leaveBalance(
  leaves,
  employeeId,
  year,
  type,
  excludeId = null
) {
  const allowance = LEAVE_POLICY[type];

  if (allowance === undefined) {
    return null;
  }

  const entries = (leaves || []).filter(
    item =>
      item.id !== excludeId &&
      item.employeeId === employeeId &&
      item.type === type &&
      item.start?.slice(0, 4) === String(year)
  );

  const used = entries
    .filter(item => item.status === "Approved")
    .reduce(
      (sum, item) => sum + leaveDayCount(item),
      0
    );

  const pending = entries
    .filter(item => item.status === "Pending")
    .reduce(
      (sum, item) => sum + leaveDayCount(item),
      0
    );

  return {
    allowance,
    used,
    pending,
    available: Math.max(
      0,
      allowance - used - pending
    )
  };
}

/* ========================================
   VALIDATE LEAVE REQUEST
======================================== */

export function validateLeaveRequest(
  input,
  data,
  excludeId = null
) {
  const employee = (data.employees || []).find(
    employee => employee.id === input.employeeId
  );

  if (!employee || !employee.active) {
    throw new Error(
      "Select an active employee."
    );
  }

  const validTypes = [
    ...Object.keys(LEAVE_POLICY),
    "Maternity Leave"
  ];

  if (!validTypes.includes(input.type)) {
    throw new Error(
      "Choose a valid leave type."
    );
  }

  const start = toUTC(input.start);
  const end = toUTC(input.end);

  if (end < start) {
    throw new Error(
      "End date cannot be before start date."
    );
  }

  if (
    String(input.reason || "").trim().length > 240
  ) {
    throw new Error(
      "Reason must be 240 characters or less."
    );
  }

  const days = leaveDayCount(input);

  /* MATERNITY VALIDATION */

  if (input.type === "Maternity Leave") {
    if (!MATERNITY_CASES[input.maternityCase]) {
      throw new Error(
        "Select a valid maternity leave category."
      );
    }

    if (
      input.end !==
      maternityEndDate(
        input.start,
        input.maternityCase
      )
    ) {
      throw new Error(
        "Maternity leave must cover the selected calendar-day entitlement."
      );
    }
  } else {

    /* SICK / VACATION VALIDATION */

    if (
      input.start.slice(0, 4) !==
      input.end.slice(0, 4)
    ) {
      throw new Error(
        "For SL/VL, file separate requests for different calendar years."
      );
    }

    if (
      !days ||
      days > LEAVE_POLICY[input.type]
    ) {
      throw new Error(
        "Select working days within the annual leave allowance."
      );
    }

    const remaining = leaveBalance(
      data.leaves || [],
      input.employeeId,
      input.start.slice(0, 4),
      input.type,
      excludeId
    );

    if (days > remaining.available) {
      throw new Error(
        `Insufficient ${input.type} credits: ${remaining.available} day(s) available.`
      );
    }
  }

  /* PREVENT OVERLAPPING REQUESTS */

  const overlapping = (data.leaves || []).some(
    item =>
      item.id !== excludeId &&
      item.employeeId === input.employeeId &&
      ["Pending", "Approved"].includes(
        item.status
      ) &&
      input.start <= item.end &&
      input.end >= item.start
  );

  if (overlapping) {
    throw new Error(
      "Dates overlap another pending or approved leave request."
    );
  }

  return days;
}

/* ========================================
   CREATE LEAVE REQUEST
======================================== */

export function createLeaveRequest(
  input,
  data,
  admin
) {
  const normalized = {
    employeeId: input.employeeId,
    type: input.type,
    start: input.start,

    end:
      input.type === "Maternity Leave"
        ? maternityEndDate(
            input.start,
            input.maternityCase || "live"
          )
        : input.end,

    maternityCase:
      input.type === "Maternity Leave"
        ? input.maternityCase || "live"
        : null,

    reason: String(
      input.reason || ""
    ).trim()
  };

  const days = validateLeaveRequest(
    normalized,
    data
  );

  return {
    ...normalized,

    id: `LV-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 7)}`,

    days,
    status: "Pending",

    submittedAt: new Date().toISOString(),
    submittedBy: admin?.id || null,
    submittedByName: admin?.name || "Admin",

    reviewedAt: null,
    reviewedBy: null
  };
}
