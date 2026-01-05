// src/adapters/mcp/tools/manage-symbol-library.ts

import { getSymbolCache } from "../../../library/cache";

type ManageSymbolLibraryAction =
  | "list_paths"
  | "set_paths"
  | "add_path"
  | "add_sym_lib_table"
  | "list_libraries"
  | "stats";

interface ManageSymbolLibraryArgs {
  action: ManageSymbolLibraryAction;
  path?: string;
  paths?: string[];
}

export const manageSymbolLibraryTool = {
  name: "manage_symbol_library",
  description: "Manage KiCad symbol library paths for pin discovery",
  inputSchema: {
    type: "object",
    properties: {
      action: {
        type: "string",
        enum: [
          "list_paths",
          "set_paths",
          "add_path",
          "add_sym_lib_table",
          "list_libraries",
          "stats",
        ],
        description: "Library management action to perform",
      },
      path: {
        type: "string",
        description: "Single path for add_path or add_sym_lib_table",
      },
      paths: {
        type: "array",
        items: { type: "string" },
        description: "Full list of library paths for set_paths",
      },
    },
    required: ["action"],
  },
};

export async function handleManageSymbolLibrary(
  args: ManageSymbolLibraryArgs
): Promise<{
  success: boolean;
  message?: string;
  paths?: string[];
  libraries?: string[];
  stats?: {
    totalSymbolsCached: number;
    totalLibrariesLoaded: number;
    libraryStats: Array<{
      library: string;
      symbolCount: number;
      loadTime: number;
      lastAccessed: number;
    }>;
  };
}> {
  const cache = getSymbolCache();
  const { action, path, paths } = args;

  switch (action) {
    case "list_paths":
      return {
        success: true,
        paths: cache.getLibraryPaths(),
      };

    case "set_paths":
      if (!paths) {
        throw new Error("paths required for set_paths");
      }
      cache.setLibraryPaths(paths);
      return {
        success: true,
        message: "Library paths updated",
        paths: cache.getLibraryPaths(),
      };

    case "add_path":
      if (!path) {
        throw new Error("path required for add_path");
      }
      cache.addLibraryPath(path);
      return {
        success: true,
        message: `Added library path: ${path}`,
        paths: cache.getLibraryPaths(),
      };

    case "add_sym_lib_table":
      if (!path) {
        throw new Error("path required for add_sym_lib_table");
      }
      cache.addSymLibTable(path);
      return {
        success: true,
        message: `Loaded sym-lib-table: ${path}`,
        paths: cache.getLibraryPaths(),
      };

    case "list_libraries":
      return {
        success: true,
        libraries: cache.getLibraryNames(),
      };

    case "stats": {
      const stats = cache.getPerformanceStats();
      const libraryStats = Array.from(stats.libraryStats.entries()).map(
        ([library, entry]) => ({
          library,
          symbolCount: entry.symbolCount,
          loadTime: entry.loadTime,
          lastAccessed: entry.lastAccessed,
        })
      );
      return {
        success: true,
        stats: {
          totalSymbolsCached: stats.totalSymbolsCached,
          totalLibrariesLoaded: stats.totalLibrariesLoaded,
          libraryStats,
        },
      };
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
