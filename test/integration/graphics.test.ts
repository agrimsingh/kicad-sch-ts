// test/integration/graphics.test.ts

import { Schematic } from "../../src";

describe("Graphics elements", () => {
  it("parses polyline, arc, circle, bezier, and image elements", () => {
    const content = `
(kicad_sch
  (version 20250114)
  (generator "eeschema")
  (generator_version "9.0")
  (uuid "11111111-1111-1111-1111-111111111111")
  (paper "A4")
  (lib_symbols)
  (polyline
    (pts (xy 0 0) (xy 10 0))
    (stroke (width 0.15) (type solid))
    (uuid "22222222-2222-2222-2222-222222222222")
  )
  (arc
    (start 0 0)
    (mid 5 5)
    (end 10 0)
    (stroke (width 0.15) (type solid))
    (fill (type none))
    (uuid "33333333-3333-3333-3333-333333333333")
  )
  (circle
    (center 5 5)
    (radius 2.5)
    (stroke (width 0.15) (type solid))
    (fill (type none))
    (uuid "44444444-4444-4444-4444-444444444444")
  )
  (bezier
    (pts (xy 0 0) (xy 5 10) (xy 10 0))
    (stroke (width 0.15) (type solid))
    (fill (type none))
    (uuid "55555555-5555-5555-5555-555555555555")
  )
  (image
    (at 10 10)
    (scale 1.0)
    (data "abcd")
    (uuid "66666666-6666-6666-6666-666666666666")
  )
  (sheet_instances (path "/" (page "1")))
  (embedded_fonts no)
)
`;

    const sch = Schematic.fromString(content);
    expect(sch.polylines.length).toBe(1);
    expect(sch.arcs.length).toBe(1);
    expect(sch.circles.length).toBe(1);
    expect(sch.beziers.length).toBe(1);
    expect(sch.images.length).toBe(1);
  });

  it("serializes graphics elements added via collections", () => {
    const sch = Schematic.create("Graphics");

    sch.polylines.add({
      points: [
        { x: 0, y: 0 },
        { x: 10, y: 0 },
      ],
    });
    sch.arcs.add({
      start: { x: 0, y: 0 },
      mid: { x: 5, y: 5 },
      end: { x: 10, y: 0 },
    });
    sch.circles.add({
      center: { x: 5, y: 5 },
      radius: 2.5,
    });
    sch.beziers.add({
      points: [
        { x: 0, y: 0 },
        { x: 5, y: 10 },
        { x: 10, y: 0 },
      ],
    });
    sch.images.add({
      position: { x: 10, y: 10 },
      scale: 1.0,
      data: "abcd",
    });

    const output = sch.format();
    const parsed = Schematic.fromString(output);

    expect(parsed.polylines.length).toBe(1);
    expect(parsed.arcs.length).toBe(1);
    expect(parsed.circles.length).toBe(1);
    expect(parsed.beziers.length).toBe(1);
    expect(parsed.images.length).toBe(1);
  });
});
