// test/integration/mcp-parity.test.ts

import { manageLabelTool } from "../../src/adapters/mcp/tools";

describe("MCP parity", () => {
  it("supports label justification in manage_label schema", () => {
    const props = manageLabelTool.inputSchema.properties as Record<string, any>;
    expect(props.justify).toBeDefined();
    expect(props.justify.properties.horizontal.enum).toContain("left");
    expect(props.justify.properties.vertical.enum).toContain("bottom");
  });
});
