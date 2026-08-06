import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("leaves ordinary values alone", () => {
    expect(csvCell("Pothole")).toBe("Pothole");
    expect(csvCell(42)).toBe("42");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("quotes anything that would break the row", () => {
    expect(csvCell("Market Road, near the bus stop")).toBe('"Market Road, near the bus stop"');
    expect(csvCell('He said "fix it"')).toBe('"He said ""fix it"""');
    expect(csvCell("line one\nline two")).toBe('"line one\nline two"');
  });

  it("defuses values Excel would run as a formula", () => {
    // A complaint description starting with "=" is a CSV injection, not a quirk.
    expect(csvCell("=1+1")).toBe("\t=1+1");
    expect(csvCell("+HYPERLINK(...)")).toBe("\t+HYPERLINK(...)");
    expect(csvCell("-2")).toBe("\t-2");
    expect(csvCell("@SUM(A1)")).toBe("\t@SUM(A1)");
    // …and quotes it too when it also contains a comma
    expect(csvCell("=cmd,exe")).toBe('"\t=cmd,exe"');
  });

  it("writes dates in a form a spreadsheet parses", () => {
    expect(csvCell(new Date("2026-07-12T09:30:00Z"))).toBe("2026-07-12 09:30:00");
  });
});

describe("toCsv", () => {
  it("starts with a BOM so Excel reads it as UTF-8", () => {
    const csv = toCsv(["code", "title"], [["CC-2026-01042", "गड्ढा मार्केट रोड पर"]]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("गड्ढा");
  });

  it("uses CRLF line endings and ends with one", () => {
    const csv = toCsv(["a", "b"], [["1", "2"], ["3", "4"]]);
    expect(csv.slice(1)).toBe("a,b\r\n1,2\r\n3,4\r\n");
  });

  it("keeps the column count stable when a value is missing", () => {
    const csv = toCsv(["a", "b", "c"], [[1, null, 3]]);
    expect(csv.slice(1).split("\r\n")[1]).toBe("1,,3");
  });
});
