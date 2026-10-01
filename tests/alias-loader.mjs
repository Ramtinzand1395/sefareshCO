import { pathToFileURL } from "node:url";
import path from "node:path";
import fs from "node:fs";

const rootDir = process.cwd();

export async function resolve(specifier, context, nextResolve) {
  if (specifier === "server-only") {
    return {
      url: "data:text/javascript,export default {};",
      shortCircuit: true,
    };
  }

  if (specifier === "next/navigation") {
    return {
      url: "data:text/javascript,export function redirect() {}; export function usePathname() { return ''; }; export function useRouter() { return {}; };",
      shortCircuit: true,
    };
  }

  if (specifier === "@/auth") {
    return {
      url: "data:text/javascript,export const auth = async () => null; export default {};",
      shortCircuit: true,
    };
  }

  if (specifier.startsWith("@/")) {
    const relativePath = specifier.slice(2);
    let fullPath = path.resolve(rootDir, relativePath);

    if (fs.existsSync(fullPath + ".ts")) {
      fullPath += ".ts";
    } else if (fs.existsSync(fullPath + ".tsx")) {
      fullPath += ".tsx";
    } else if (fs.existsSync(fullPath + ".js")) {
      fullPath += ".js";
    }

    return nextResolve(pathToFileURL(fullPath).href, context);
  }

  return nextResolve(specifier, context);
}
