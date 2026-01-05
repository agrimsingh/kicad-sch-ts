// test/integration/coordinate-system.test.ts

import { Schematic, setConfig, resetConfig } from "../../src";

describe("Coordinate system configuration", () => {
  afterEach(() => {
    resetConfig();
  });

  it("flips Y coordinates when using the standard coordinate system", () => {
    setConfig({ coordinateSystem: "standard" });

    const sch = Schematic.create("Coords");
    const label = sch.labels.add({
      text: "SIG",
      position: { x: 10, y: 5 },
    });

    expect(label.position.x).toBe(10);
    expect(label.position.y).toBe(-5);
  });
});
