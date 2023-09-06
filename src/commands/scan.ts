import { BaseCommand } from "@adonisjs/ace";
import { existsSync, readdirSync, rmdirSync, statSync } from "fs";
import { dirname, join } from "path";
import { cwd } from "process";

import { DateTime } from "luxon";

// @ts-ignore
import fastFolderSizeSync from "fast-folder-size/sync.js";

export class Scan extends BaseCommand {
  static commandName = "scan";
  static description = "Scans directory for node_modules";

  promptDirectory() {
    return this.prompt.ask("Enter Directory ('./projects')");
  }

  promptAutoDelete() {
    return this.prompt.confirm("Do you want nmscan to delete node_modules in old folders?");
  }

  promptAutoDeleteAge() {
    return this.prompt.choice("How old should folders be? (days)", ["30", "45", "60", "90"]);
  }

  async run() {
    try {
      const directory = await this.promptDirectory();
      const auto_delete = await this.promptAutoDelete();

      let auto_delete_age: string | undefined;

      if (auto_delete) {
        auto_delete_age = await this.promptAutoDeleteAge();
      }

      const dir_folders = join(cwd(), directory);
      const nm_dirs = scanDirectories(dir_folders);

      this.ui.logger.info(`Found ${nm_dirs.length} node_module folders`);

      this.ui.logger.info(`Calculating size on disk (this may take some time)`);
      const folderSizes = await getFolderSizes(nm_dirs);

      const table = this.ui.table();
      table.head(["Path", "Last Modified", "Size"]);

      let deletion_dirs;
      if (auto_delete) {
        deletion_dirs = folderSizes.filter(i => DateTime.fromJSDate(i.age) < DateTime.now().minus({ days: Number(auto_delete_age) }));
      }

      // Optionally define column widths
      table.columnWidths([70, 40, 30]);

      // Add new rows
      folderSizes.map(dir => {
        table.row([dir.path, `${new Date(dir.age).toISOString()}`, `${this.ui.colors.green(formatSize(dir.size!))}`]);
      });

      // Render the table
      table.render();

      if (auto_delete) {
        deleteDirectories(deletion_dirs!);
      }

      let total_size = 0;
      folderSizes.map(i => (total_size += i.size));

      let clean_size = 0;
      if (auto_delete) {
        deletion_dirs!.map(i => (clean_size += i.size));
      }

      this.ui.logger.info(`Total size: ${formatSize(total_size)}`);
      this.ui.logger.info(`Cleaned size: ${formatSize(clean_size)}`);
    } catch (error) {
      console.log(error);
    }
  }
}

async function getFolderSizes(paths: string[]): Promise<{ path: string; age: Date; size: number }[]> {
  return paths.map(path => {
    return {
      path: path,
      age: statSync(dirname(path)).mtime,
      size: fastFolderSizeSync(path)!,
    };
  });
}

function hasNodeModules(directory: string) {
  const nodeModulesPath = join(directory, "node_modules");
  return existsSync(nodeModulesPath) && statSync(nodeModulesPath).isDirectory();
}

// Function to recursively scan directories
function scanDirectories(currentDir: string): string[] {
  const subdirectories = readdirSync(currentDir, { withFileTypes: true });

  const nm_dirs: string[] = [];

  for (const dirent of subdirectories) {
    const fullPath = join(currentDir, dirent.name);

    if (dirent.isDirectory() && dirent.name !== "node_modules") {
      if (hasNodeModules(fullPath)) {
        nm_dirs.push(join(fullPath, "node_modules"));
      }

      nm_dirs.push(...scanDirectories(fullPath));
    }
  }

  return nm_dirs;
}

function deleteDirectories(dirs: { path: string; age: Date; size: number }[]) {
  return dirs.map(dir => rmdirSync(dir.path, { recursive: true }));
}

function formatSize(sizeInBytes: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let size = sizeInBytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
