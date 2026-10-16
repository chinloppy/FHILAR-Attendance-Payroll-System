import { calculatePay, createRule, DEFAULT_SETTINGS, getRate, INITIAL_EMPLOYEES, localInputToISO } from "./payroll";

function entry(shiftId, dateIn, clockIn, dateOut, clockOut, breakStart = null, breakEnd = null) {
const employee = { shift: shiftId, customRate: null };  return {
    timeIn: localInputToISO(`${dateIn}T${clockIn}`),
    timeOut: clockOut ? localInputToISO(`${dateOut}T${clockOut}`) : null,
    rate: getRate(employee, DEFAULT_SETTINGS), rule: createRule(DEFAULT_SETTINGS),
    breakStart: breakStart ? localInputToISO(breakStart) : null,
    breakEnd: breakEnd ? localInputToISO(breakEnd) : null
  };
}

test("6-hour day and 8-hour day full shift pay", () => {
  expect(calculatePay(entry("day6", "2026-10-09", "08:00", "2026-10-09", "14:00")).gross).toBe(950);
  expect(calculatePay(entry("day8", "2026-10-09", "08:00", "2026-10-09", "16:00")).gross).toBe(1250);
});

test("night differential is counted across midnight", () => {
  const six = calculatePay(entry("night6", "2026-10-09", "18:00", "2026-10-10", "00:00"));
  expect(six.nightHours).toBe(2);
  expect(six.gross).toBe(981.67);
  const eight = calculatePay(entry("night8", "2026-10-09", "18:00", "2026-10-10", "02:00"));
  expect(eight.nightHours).toBe(4);
  expect(eight.gross).toBe(1312.5);
});

test("partial shifts pay only for actual hours", () => {
  expect(calculatePay(entry("day6", "2026-10-09", "08:00", "2026-10-09", "11:00")).gross).toBe(475);
  expect(calculatePay(entry("night6", "2026-10-09", "18:00", "2026-10-09", "22:00")).gross).toBe(633.33);
});

test("night unpaid break is removed from worked and eligible night hours", () => {
  const result = calculatePay(entry("night8", "2026-10-09", "18:00", "2026-10-10", "02:00",
    "2026-10-09T22:30", "2026-10-09T23:00"));
  expect(result.hours).toBe(7.5);
  expect(result.nightHours).toBe(3.5);
  expect(result.gross).toBe(1226.57);
});

test("incomplete attendance has no completed pay", () => {
  expect(calculatePay(entry("day6", "2026-10-09", "08:00", "2026-10-09", null)).gross).toBe(0);
});

test("invalid break is rejected", () => {
  expect(() => calculatePay(entry("day6", "2026-10-09", "08:00", "2026-10-09", "14:00",
    "2026-10-09T06:00", "2026-10-09T07:00"))).toThrow();
});
