// test/unit/logger.test.ts

import { createLogger, formatError } from "../../src/core/logger";

describe("Logger", () => {
  it("filters logs below configured level", () => {
    const entries: string[] = [];
    const logger = createLogger({
      level: "info",
      sink: (entry) => entries.push(entry.level),
    });

    logger.debug("debug");
    logger.info("info");
    logger.warn("warn");

    expect(entries).toEqual(["info", "warn"]);
  });

  it("formats errors safely", () => {
    expect(formatError(new Error("boom"))).toBe("boom");
    expect(formatError("oops")).toBe("oops");
  });
});
