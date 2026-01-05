// test/integration/mcp.test.ts

import {
  manageSchematicTool,
  manageComponentTool,
  manageWireTool,
  manageLabelTool,
  searchSymbolsTool,
  runErcTool,
  getSymbolInfoTool,
  discoverPinsTool,
  analyzeConnectivityTool,
  analyzeHierarchyTool,
  handleManageSchematic,
  handleManageComponent,
  handleManageWire,
  handleManageLabel,
  handleRunErc,
  handleAnalyzeConnectivity,
  getCurrentSchematic,
  setCurrentSchematic,
} from "../../src/adapters/mcp/tools";
import { Schematic } from "../../src/core/schematic";
import { join } from "path";

describe("MCP Tools", () => {
  describe("Tool Definitions", () => {
    it("should have correct tool definitions", () => {
      expect(manageSchematicTool.name).toBe("manage_schematic");
      expect(manageSchematicTool.inputSchema).toBeDefined();
      expect(manageSchematicTool.inputSchema.properties.action).toBeDefined();

      expect(manageComponentTool.name).toBe("manage_component");
      expect(manageWireTool.name).toBe("manage_wire");
      expect(manageLabelTool.name).toBe("manage_label");
      expect(searchSymbolsTool.name).toBe("search_symbols");
      expect(runErcTool.name).toBe("run_erc");
      expect(getSymbolInfoTool.name).toBe("get_symbol_info");
      expect(discoverPinsTool.name).toBe("discover_pins");
      expect(analyzeConnectivityTool.name).toBe("analyze_connectivity");
      expect(analyzeHierarchyTool.name).toBe("analyze_hierarchy");
    });

    it("should have required properties in inputSchema", () => {
      expect(manageSchematicTool.inputSchema.required).toContain("action");
      expect(manageComponentTool.inputSchema.required).toContain("action");
      expect(searchSymbolsTool.inputSchema.required).toContain("query");
    });
  });

  describe("Schematic Management", () => {
    beforeEach(() => {
      // Reset schematic state
      setCurrentSchematic(null as any);
    });

    it("should create a new schematic", async () => {
      const result = await handleManageSchematic({
        action: "create",
        title: "Test Schematic",
      });

      expect(result.success).toBe(true);
      expect(result.message).toContain("Test Schematic");
      expect(getCurrentSchematic()).not.toBeNull();
    });

    it("should load a schematic", async () => {
      const schematicPath = join(
        __dirname,
        "../fixtures/rotated_resistor_0deg/rotated_resistor_0deg.kicad_sch"
      );
      
      const result = await handleManageSchematic({
        action: "load",
        path: schematicPath,
      });

      expect(result.success).toBe(true);
      expect(result.components).toBeGreaterThanOrEqual(0);
    });

    it("should get schematic info", async () => {
      await handleManageSchematic({
        action: "create",
        title: "Info Test",
      });

      const result = await handleManageSchematic({ action: "info" });

      expect(result.title).toBe("Info Test");
      expect(result.components).toBe(0);
      expect(result.wires).toBe(0);
    });

    it("should error when no schematic loaded for info", async () => {
      await expect(
        handleManageSchematic({ action: "info" })
      ).rejects.toThrow("No schematic loaded");
    });
  });

  describe("Component Management", () => {
    beforeEach(async () => {
      await handleManageSchematic({ action: "create", title: "Test" });
    });

    it("should add a component", async () => {
      const result = await handleManageComponent({
        action: "add",
        lib_id: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      expect(result.success).toBe(true);
      expect(result.uuid).toBeDefined();
    });

    it("should list components", async () => {
      await handleManageComponent({
        action: "add",
        lib_id: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const result = await handleManageComponent({ action: "list" });
      expect(result.components).toHaveLength(1);
      expect(result.components[0].reference).toBe("R1");
    });

    it("should get a specific component", async () => {
      await handleManageComponent({
        action: "add",
        lib_id: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const result = await handleManageComponent({
        action: "get",
        reference: "R1",
      });
      
      expect(result.reference).toBe("R1");
      expect(result.value).toBe("10k");
      expect(result.libId).toBe("Device:R");
    });

    it("should modify a component", async () => {
      await handleManageComponent({
        action: "add",
        lib_id: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const result = await handleManageComponent({
        action: "modify",
        reference: "R1",
        value: "20k",
      });

      expect(result.success).toBe(true);

      const getResult = await handleManageComponent({
        action: "get",
        reference: "R1",
      });
      expect(getResult.value).toBe("20k");
    });

    it("should remove a component", async () => {
      await handleManageComponent({
        action: "add",
        lib_id: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const result = await handleManageComponent({
        action: "remove",
        reference: "R1",
      });

      expect(result.success).toBe(true);

      const listResult = await handleManageComponent({ action: "list" });
      expect(listResult.components).toHaveLength(0);
    });
  });

  describe("Wire Management", () => {
    beforeEach(async () => {
      await handleManageSchematic({ action: "create", title: "Test" });
    });

    it("should add a wire", async () => {
      const result = await handleManageWire({
        action: "add",
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
      });

      expect(result.success).toBe(true);
      expect(result.uuid).toBeDefined();
    });

    it("should list wires", async () => {
      await handleManageWire({
        action: "add",
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
      });

      const result = await handleManageWire({ action: "list" });
      expect(result.wires).toHaveLength(1);
    });

    it("should remove a wire", async () => {
      const addResult = await handleManageWire({
        action: "add",
        start: { x: 0, y: 0 },
        end: { x: 10, y: 0 },
      });

      const result = await handleManageWire({
        action: "remove",
        uuid: addResult.uuid,
      });

      expect(result.success).toBe(true);

      const listResult = await handleManageWire({ action: "list" });
      expect(listResult.wires).toHaveLength(0);
    });
  });

  describe("Label Management", () => {
    beforeEach(async () => {
      await handleManageSchematic({ action: "create", title: "Test" });
    });

    it("should add a label", async () => {
      const result = await handleManageLabel({
        action: "add",
        text: "VCC",
        position: { x: 50, y: 50 },
      });

      expect(result.success).toBe(true);
      expect(result.uuid).toBeDefined();
    });

    it("should list labels", async () => {
      await handleManageLabel({
        action: "add",
        text: "VCC",
        position: { x: 50, y: 50 },
      });

      const result = await handleManageLabel({ action: "list" });
      expect(result.labels).toHaveLength(1);
      expect(result.labels[0].text).toBe("VCC");
    });
  });

  describe("ERC", () => {
    beforeEach(async () => {
      await handleManageSchematic({ action: "create", title: "Test" });
    });

    it("should run ERC on empty schematic", async () => {
      const result = await handleRunErc({});

      expect(result.passed).toBe(true);
      expect(result.errorCount).toBe(0);
    });

    it("should run ERC with components", async () => {
      await handleManageComponent({
        action: "add",
        lib_id: "Device:R",
        reference: "R1",
        value: "10k",
        position: { x: 100, y: 100 },
      });

      const result = await handleRunErc({});

      expect(result).toBeDefined();
      expect(typeof result.passed).toBe("boolean");
    });
  });

  describe("Connectivity Analysis", () => {
    beforeEach(async () => {
      await handleManageSchematic({ action: "create", title: "Test" });
    });

    it("should analyze nets", async () => {
      const result = await handleAnalyzeConnectivity({ action: "nets" });

      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.nets).toBeDefined();
    });

    it("should find unconnected pins", async () => {
      const result = await handleAnalyzeConnectivity({ action: "unconnected" });

      expect(result.count).toBeGreaterThanOrEqual(0);
      expect(result.pins).toBeDefined();
    });
  });
});
