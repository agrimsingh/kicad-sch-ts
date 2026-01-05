// src/adapters/cli/commands/find-libraries.ts

import { Command } from "commander";
import { getSymbolCache } from "../../../library/cache";
import chalk from "chalk";

export const findLibrariesCommand = new Command("find-libraries")
  .description("Find and list available KiCAD symbol libraries")
  .option("-s, --search <query>", "Search for symbols")
  .option("-l, --library <name>", "List symbols in a specific library")
  .action(async (options) => {
    const cache = getSymbolCache();

    if (options.search) {
      console.log(chalk.blue(`Searching for: ${options.search}`));
      const results = cache.searchSymbols(options.search, 20);

      if (results.length === 0) {
        console.log(chalk.yellow("No symbols found"));
      } else {
        for (const symbol of results) {
          console.log(chalk.green(`  ${symbol.libId}`));
          if (symbol.description) {
            console.log(chalk.gray(`    ${symbol.description}`));
          }
        }
      }
    } else if (options.library) {
      const symbols = cache.getLibrarySymbols(options.library);
      console.log(
        chalk.blue(`Library: ${options.library} (${symbols.length} symbols)`)
      );

      for (const symbol of symbols.slice(0, 50)) {
        console.log(chalk.green(`  ${symbol.name}`));
      }

      if (symbols.length > 50) {
        console.log(chalk.gray(`  ... and ${symbols.length - 50} more`));
      }
    } else {
      const libraries = cache.getLibraryNames();
      console.log(chalk.blue(`Found ${libraries.length} libraries:`));

      for (const lib of libraries) {
        console.log(chalk.green(`  ${lib}`));
      }
    }
  });
