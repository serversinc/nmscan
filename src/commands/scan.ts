import { BaseCommand } from "@adonisjs/ace";
import { existsSync, readdirSync, statSync } from "fs";
import { join } from "path";
import { cwd } from "process";

// @ts-ignore
import fastFolderSizeSync from "fast-folder-size/sync.js";

export class Scan extends BaseCommand {
  static commandName = "scan";
  static description = "Scans directory for node_modules";

  promptDirectory() {
    return this.prompt.ask("Enter Directory ('./projects')");
  }

  async run() {
    try {
      const directory = await this.promptDirectory();
      const dir_folders = join(cwd(), directory);

      const nm_dirs = await scanDirectories(dir_folders);

      this.ui.logger.info(`Found ${nm_dirs.length} node_module folders`);

      this.ui.logger.info(`Calculating size on disk (this may take some time)`);
      const folderSizes = await getFolderSizes(nm_dirs);

      const table = this.ui.table();
      table.head(["Path", "Size"]);

      // Optionally define column widths
      table.columnWidths([70, 30]);

      // Add new rows
      folderSizes.map(dir => {
        table.row([dir.path, `${this.ui.colors.green(formatSize(dir.size!))}`]);
      });

      // Render the table
      table.render();

      let total_size = 0;
      folderSizes.map(i => (total_size += i.size));

      this.ui.logger.info(`Total size: ${formatSize(total_size)}`);
    } catch (error) {
      console.log(error);
    }
  }
}

async function getFolderSizes(paths: string[]): Promise<{ path: string; size: number }[]> {
  return paths.map(path => {
    return {
      path: path,
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
