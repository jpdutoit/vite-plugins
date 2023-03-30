import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { Plugin } from "vite";

export interface ViteTscBuildPluginOptions {
  /// Whether to enable the plugin, defaults to true
  enabled?: boolean;

  /// tsc command line arguments, defaults to ["-b"]
  tsc?: string[];
}
/// vite-plugin-tsc-build - Production build using tsc
export default function tscBuildPlugin({
  enabled = true,
  tsc = ["-b"],
}: ViteTscBuildPluginOptions = {}): Plugin {
  if (!enabled) return { name: "vite-plugin-tsc-build" };

  return {
    name: "vite-plugin-tsc-build",
    enforce: "pre",

    async buildStart() {
      await runTscBuild(tsc);
    },

    async transform(_code, filename) {
      if (!hasTSExtension(filename)) return null;

      const jsFilename = convertToJSFileExtension(filename);
      const outFilename = rewriteSrcToOutDir(jsFilename);

      const code = maybeReadFileSync(outFilename);
      if (!code) {
        console.debug(
          `vite-plugin-tsc-build: Could not find file './${path.relative(
            process.cwd(),
            outFilename
          )}'`
        );
        return null;
      }

      return {
        code,
        map: maybeReadFileSync(outFilename + ".map"),
      };
    },
  };
}

function maybeReadFileSync(filename: string) {
  try {
    return fs.readFileSync(filename, "utf-8");
  } catch (_) {
    return undefined;
  }
}

function runTscBuild(tscArgs: string[]) {
  return new Promise<void>((resolve, reject) => {
    console.log("vite-plugin-tsc-build: tsc", ...tscArgs);
    const tsc = spawn("tsc", tscArgs);
    const stdout: string[] = [];
    const stderr: string[] = [];

    tsc.stdout.on("data", (data) => {
      stdout.push(data.toString());
    });

    tsc.stderr.on("data", (data) => {
      stderr.push(data.toString());
    });

    tsc.on("close", (code) => {
      if (stdout.length > 0) console.log(stdout.join(""));
      if (stderr.length > 0) console.log(stderr.join(""));
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`tsc build exited with code ${code}`));
      }
    });
  });
}

function hasTSExtension(filename: string) {
  const extension = path.extname(filename);
  return extension === ".ts" || extension === ".tsx";
}

function rewriteSrcToOutDir(filename: string) {
  return filename.replace(
    /(^|\/)src(\/|\\)/,
    (_, pre, post) => `${pre}dist${post}`
  );
}

function convertToJSFileExtension(filename: string) {
  return filename.replace(/\.ts(x?)$/, (_, x) => `.js${x}`);
}
