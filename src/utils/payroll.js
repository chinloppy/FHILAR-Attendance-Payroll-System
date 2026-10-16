
export const STORAGE_KEY = "fhilar-shared-workspace-v1";

export const DEFAULT_SETTINGS = {
  company: "FHILAR Apparel",
  nightPercent: 10,
  nightStart: "22:00",
  nightEnd: "06:00",
  shifts: {
    day6: {
      label: "Morning · 6 hours",
      start: "08:00",
      end: "14:00",
      rate: 950 / 6
    },
    night6: {
      label: "Evening · 6 hours",
      start: "18:00",
      end: "00:00",
      rate: 950 / 6
    },
    day8: {
      label: "Morning · 8 hours",
      start: "08:00",
      end: "16:00",
      rate: 1250 / 8
    },
    night8: {
      label: "Evening · 8 hours",
      start: "18:00",
      end: "02:00",
      rate: 1250 / 8
    }
  }
};

export const INITIAL_EMPLOYEES = [];

export function phParts(date = new Date()) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Manila",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    })
      .formatToParts(date)
      .filter(p => p.type !== "literal")
      .map(p => [p.type, p.value])
  );
}

export function phDate(date = new Date()) {
  const p = phParts(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function phDateTime(date = new Date()) {
  const p = phParts(date);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export function localInputToISO(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value || "")) {
    throw new Error("Please enter a valid Philippine date and time.");
  }

  const result = new Date(`${value}:00+08:00`);

  if (
    !Number.isFinite(result.getTime()) ||
    phDateTime(result) !== value
  ) {
    throw new Error("The selected date or time is invalid.");
  }

  return result.toISOString();
}

export function displayDateTime(value) {
  return value
    ? new Date(value).toLocaleString("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short"
      })
    : "—";
}

export function displayDate(value) {
  if (!value) return "—";

  return new Date(`${value}T12:00:00+08:00`).toLocaleDateString(
    "en-PH",
    {
      timeZone: "Asia/Manila",
      dateStyle: "medium"
    }
  );
}

export function workDate(record) {
  return phDate(new Date(record.timeIn));
}

export function roundMoney(value) {
  return (
    Math.round(
      (Number(value) + Number.EPSILON) * 100
    ) / 100
  );
}

export function money(value) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(value || 0));
}

export function clockString(value) {
  const [hours, mins] = value.split(":").map(Number);

  return `${hours % 12 || 12}:${String(mins).padStart(
    2,
    "0"
  )} ${hours < 12 ? "AM" : "PM"}`;
}

export function getRate(employee, settings) {
  return employee.customRate !== null &&
    employee.customRate !== undefined &&
    employee.customRate !== ""
    ? Number(employee.customRate)
    : Number(settings.shifts[employee.shift]?.rate || 0);
}

export function getShiftLabel(employee, settings) {
  const shift = settings.shifts[employee.shift];

  return shift
    ? `${clockString(shift.start)}–${clockString(shift.end)}`
    : "Unassigned";
}

export function createRule(settings) {
  return {
    nightPercent: Number(settings.nightPercent),
    nightStart: settings.nightStart,
    nightEnd: settings.nightEnd
  };
}

const clockMinutes = value => {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
};

const overlap = (a, b, c, d) =>
  Math.max(
    0,
    Math.min(b, d) - Math.max(a, c)
  );

/* ==========================
   ACTUAL WORKED-HOUR PAY
========================== */

export function calculatePay(record) {
  const empty = {
    hours: 0,
    nightHours: 0,
    basePay: 0,
    nightPay: 0,
    gross: 0,
    breakMinutes: 0
  };

  if (!record.timeIn || !record.timeOut) {
    return empty;
  }

  const start = new Date(record.timeIn).getTime();
  const end = new Date(record.timeOut).getTime();

  const totalMinutes = Math.round(
    (end - start) / 60000
  );

  if (
    !Number.isFinite(totalMinutes) ||
    totalMinutes <= 0 ||
    totalMinutes > 1440
  ) {
    throw new Error(
      "Completed shifts must last 1 minute to 24 hours."
    );
  }

  const hasStart = Boolean(record.breakStart);
  const hasEnd = Boolean(record.breakEnd);

  if (hasStart !== hasEnd) {
    throw new Error(
      "Provide both start and end of an unpaid break."
    );
  }

  let breakStart = null;
  let breakEnd = null;
  let breakMinutes = 0;

  if (hasStart) {
    breakStart = new Date(record.breakStart).getTime();
    breakEnd = new Date(record.breakEnd).getTime();

    if (
      !Number.isFinite(breakStart) ||
      !Number.isFinite(breakEnd) ||
      breakStart < start ||
      breakEnd > end ||
      breakEnd <= breakStart
    ) {
      throw new Error(
        "Unpaid breaks must fall entirely inside the shift."
      );
    }

    breakMinutes = Math.round(
      (breakEnd - breakStart) / 60000
    );
  }

  const workedMinutes = totalMinutes - breakMinutes;

  if (workedMinutes <= 0) {
    throw new Error(
      "Worked time must be greater than zero."
    );
  }

  const rate = Number(record.rate);
  const rule = record.rule;

  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Invalid hourly rate.");
  }

  const premium = Number(rule?.nightPercent);

  if (
    !Number.isFinite(premium) ||
    premium < 0 ||
    premium > 100 ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      rule?.nightStart || ""
    ) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(
      rule?.nightEnd || ""
    ) ||
    rule.nightStart === rule.nightEnd
  ) {
    throw new Error("Invalid night-pay settings.");
  }

  // PH is UTC+8 year-round.
  const offset = 8 * 60 * 60000;
  const dayMS = 86400000;

  const startPH = start + offset;
  const endPH = end + offset;

  const first =
    Math.floor(startPH / dayMS) * dayMS - dayMS;

  const nightStart = clockMinutes(rule.nightStart);
  const nightEnd = clockMinutes(rule.nightEnd);

  let nightMinutes = 0;

  for (
    let day = first;
    day <= endPH;
    day += dayMS
  ) {
    const windowStart =
      day + nightStart * 60000;

    const windowEnd =
      day +
      nightEnd * 60000 +
      (nightEnd < nightStart ? dayMS : 0);

    let coverage = overlap(
      startPH,
      endPH,
      windowStart,
      windowEnd
    );

    if (breakStart !== null) {
      coverage -= overlap(
        breakStart + offset,
        breakEnd + offset,
        windowStart,
        windowEnd
      );
    }

    nightMinutes += Math.max(
      0,
      coverage / 60000
    );
  }

  const hours = workedMinutes / 60;

  const nightHours = Math.min(
    hours,
    nightMinutes / 60
  );

  const basePay = roundMoney(hours * rate);

  const nightPay = roundMoney(
    nightHours * rate * premium / 100
  );

  return {
    hours,
    nightHours,
    basePay,
    nightPay,
    gross: roundMoney(basePay + nightPay),
    breakMinutes
  };
}

/* ==========================
   PAYROLL LINE GENERATION
========================== */

export function createPayrollLines(employees, records) {
  return employees
    .map(employee => {
      const own = records.filter(
        record => record.employeeId === employee.id
      );

      if (!own.length) return null;

      const totals = own.reduce(
        (acc, record) => {
          const calculated = calculatePay(record);

          for (const field of [
            "hours",
            "nightHours",
            "basePay",
            "nightPay",
            "gross"
          ]) {
            acc[field] += calculated[field];
          }

          return acc;
        },
        {
          hours: 0,
          nightHours: 0,
          basePay: 0,
          nightPay: 0,
          gross: 0
        }
      );

      for (const field of [
        "basePay",
        "nightPay",
        "gross"
      ]) {
        totals[field] = roundMoney(totals[field]);
      }

      return {
        employeeId: employee.id,
        name: employee.name,
        position: employee.position,
        ...totals,
        attendance: own.map(record => ({
          ...record
        }))
      };
    })
    .filter(Boolean);
}

export const runTotal = run =>
  roundMoney(
    run.lines.reduce(
      (total, line) => total + line.gross,
      0
    )
  );

/* ==========================
   SHARED COMPANY WORKSPACE
========================== */

export function createInitialData() {
  return {
    version: 1,
    settings: JSON.parse(
      JSON.stringify(DEFAULT_SETTINGS)
    ),
    employees: [],
    attendance: [],
    leaves: [],
    absences: [],
    runs: []
  };
}

export function loadData() {
  const saved = localStorage.getItem(STORAGE_KEY);

  if (saved === null) {
    return createInitialData();
  }

  let parsed;

  try {
    parsed = JSON.parse(saved);
  } catch {
    throw new Error(
      "Shared workspace data cannot be read. Existing records were not deleted."
    );
  }

  if (
    parsed?.version !== 1 ||
    !Array.isArray(parsed.employees) ||
    !Array.isArray(parsed.attendance) ||
    !Array.isArray(parsed.runs) ||
    !parsed.settings?.shifts
  ) {
    throw new Error(
      "Saved shared workspace has an invalid format."
    );
  }

  return {
    ...parsed,

    leaves: Array.isArray(parsed.leaves)
      ? parsed.leaves
      : [],

    absences: Array.isArray(parsed.absences)
      ? parsed.absences
      : []
  };
}

export function saveData(data) {
  const value = JSON.stringify(data);

  if (
    localStorage.getItem(STORAGE_KEY) !== value
  ) {
    localStorage.setItem(STORAGE_KEY, value);
  }
}
