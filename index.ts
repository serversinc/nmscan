import { HelpCommand, Kernel } from "@adonisjs/ace";
import { Scan } from "./src/commands/scan.js";

Kernel.defaultCommand = Scan;

export const kernel = Kernel.create();

kernel.defineFlag("help", {
  type: "boolean",
  description: HelpCommand.description,
});
