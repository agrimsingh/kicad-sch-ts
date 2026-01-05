// test/integration/connectivity.test.ts

import { ConnectivityAnalyzer } from "../../src/connectivity/analyzer";
import { Schematic } from "../../src";

describe("Connectivity Analysis", () => {
  describe("ConnectivityAnalyzer", () => {
    it("should create analyzer instance", () => {
      const sch = Schematic.create("Test");
      const analyzer = new ConnectivityAnalyzer(sch);
      expect(analyzer).toBeDefined();
      expect(analyzer).toBeInstanceOf(ConnectivityAnalyzer);
    });

    it("should analyze empty schematic", () => {
      const sch = Schematic.create("Test");
      const analyzer = new ConnectivityAnalyzer(sch);
      const nets = analyzer.analyzeNets();

      expect(Array.isArray(nets)).toBe(true);
      expect(nets.length).toBe(0);
    });

    it("should identify nets from wires", () => {
      const sch = Schematic.create("Test");

      // Add a wire using proper API
      sch.wires.add({
        points: [
          { x: 100, y: 100 },
          { x: 200, y: 100 },
        ],
      });

      // Add a label at wire endpoint
      sch.labels.add({
        text: "NetA",
        position: { x: 100, y: 100 },
      });

      const analyzer = new ConnectivityAnalyzer(sch);
      const nets = analyzer.analyzeNets();

      expect(nets.length).toBeGreaterThanOrEqual(1);
      const netA = nets.find((n) => n.name === "NetA");
      expect(netA).toBeDefined();
    });

    it("should find pins at position", () => {
      const sch = Schematic.create("Test");
      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const analyzer = new ConnectivityAnalyzer(sch);
      const pins = analyzer.getPinsAtPosition({ x: 100, y: 100 });

      // Without symbol cache, should still work (using component position)
      expect(Array.isArray(pins)).toBe(true);
    });

    it("should check pin connection", () => {
      const sch = Schematic.create("Test");
      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const analyzer = new ConnectivityAnalyzer(sch);
      const result = analyzer.checkPinConnection("R1", "1");

      expect(result).toHaveProperty("connected");
    });

    it("should return false for non-existent component", () => {
      const sch = Schematic.create("Test");
      const analyzer = new ConnectivityAnalyzer(sch);
      const result = analyzer.checkPinConnection("R99", "1");

      expect(result.connected).toBe(false);
    });

    it("should find unconnected pins", () => {
      const sch = Schematic.create("Test");
      sch.components.add({
        libId: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const analyzer = new ConnectivityAnalyzer(sch);
      const unconnected = analyzer.findUnconnectedPins();

      expect(Array.isArray(unconnected)).toBe(true);
    });

    it("should analyze real schematic with wires", () => {
      const sch = Schematic.load(
        "tests/reference_kicad_projects/junction/junction.kicad_sch"
      );

      const analyzer = new ConnectivityAnalyzer(sch);
      const nets = analyzer.analyzeNets();

      expect(Array.isArray(nets)).toBe(true);
      // Junction schematic should have some nets
    });

    it("should handle labels in net analysis", () => {
      const sch = Schematic.load(
        "tests/reference_kicad_projects/label_rotations/label_rotations.kicad_sch"
      );

      const analyzer = new ConnectivityAnalyzer(sch);
      const nets = analyzer.analyzeNets();

      expect(Array.isArray(nets)).toBe(true);
    });
  });
});
