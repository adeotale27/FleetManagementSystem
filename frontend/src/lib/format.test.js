import { dmy, dmyDateTime } from "./format";

describe("date formatting", () => {
  it("formats ISO dates as day-month-year without changing ISO date values", () => {
    expect(dmy("2026-10-09")).toBe("09-10-2026");
    expect(dmy("2026-10-09T03:30:00Z")).toBe("09-10-2026");
    expect(dmy("")).toBe("—");
  });

  it("formats timestamps in Indian time with a day-month-year date", () => {
    expect(dmyDateTime("2026-10-09T03:30:00Z")).toBe("09-10-2026, 09:00 am IST");
    expect(dmyDateTime("2026-10-09T03:30:00Z", true)).toBe("09-10-2026, 09:00:00 am IST");
    expect(dmyDateTime("not a date")).toBe("not a date");
  });
});
