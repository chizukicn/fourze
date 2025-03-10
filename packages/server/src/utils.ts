import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { promises as dns } from "node:dns";
import net from "node:net";

import os from "node:os";
import path from "node:path";
import { isNumber, isString, normalizeURL } from "@fourze/core";
import { loopbackHosts, wildcardHosts } from "./constants";

export const isWindows = os.platform() === "win32";
/**
 *  port @vitejs/vite by @yyx990803 (Evan You) (MIT License)
 */
export function normalizePath(id: string) {
  return path.posix.normalize(isWindows ? normalizeURL(id) : id);
}

export function defineEnvs(
  env: Record<string, any>,
  prefix = ""
): Record<string, string> {
  return Object.fromEntries(
    Object.entries(env).map(([key, value]) => {
      return [`${prefix}${key}`, JSON.stringify(value)];
    })
  );
}

export async function getLocalhostAddressIfDiffersFromDNS(): Promise<
string | undefined
> {
  const [nodeResult, dnsResult] = await Promise.all([
    dns.lookup("localhost"),
    dns.lookup("localhost", { verbatim: true })
  ]);
  const isSame
    = nodeResult.family === dnsResult.family
      && nodeResult.address === dnsResult.address;
  return isSame ? undefined : nodeResult.address;
}

export interface Hostname {
  /** undefined sets the default behaviour of server.listen */
  host: string | undefined;
  /** resolve to localhost when possible */
  name: string;
}

export async function resolveHostname(
  optionsHost?: string | boolean
): Promise<Hostname> {
  let host: string | undefined;
  if (optionsHost === undefined || optionsHost === false) {
    // Use a secure default
    host = "localhost";
  } else if (optionsHost === true) {
    // If passed --host in the CLI without arguments
    host = undefined; // undefined typically means 0.0.0.0 or :: (listen on all IPs)
  } else {
    host = optionsHost;
  }

  // Set host name to localhost when possible
  let name = host === undefined || wildcardHosts.has(host) ? "localhost" : host;

  if (host === "localhost") {
    // See #8647 for more details.
    const localhostAddr = await getLocalhostAddressIfDiffersFromDNS();
    if (localhostAddr) {
      name = localhostAddr;
    }
  }

  return { host, name };
}

export function isAddressInfo(value: any): value is AddressInfo {
  return !!value?.address;
}

interface ResolvedServerUrls {
  local: string[];
  network: string[];
}

export interface ResolveServerOptions {
  host?: string;
  https?: boolean;
}
/**
 * @see https://github.com/vitejs/vite/blob/main/packages/vite/src/node/utils.ts
 * @param sever
 * @param options
 * @returns
 */
export async function resolveServerUrls(server: Server, options: ResolveServerOptions = {}): Promise<ResolvedServerUrls> {
  const address = server.address();

  if (!isAddressInfo(address)) {
    return {
      local: [],
      network: []
    };
  }
  const local: string[] = [];
  const network: string[] = [];

  const hostname = await resolveHostname(options.host ?? address.address);
  const protocol = options.https ? "https" : "http";
  const port = address.port;

  if (hostname.host && loopbackHosts.has(hostname.host)) {
    let hostnameName = hostname.name;
    if (net.isIPv6(hostnameName)) {
      hostnameName = `[${hostnameName}]`;
    }
    local.push(`${protocol}://${hostnameName}:${port}`);
  } else {
    Object.values(os.networkInterfaces())
      .flatMap((nInterface) => nInterface ?? [])
      .filter((detail) => {
        return detail
          && detail.address
          && ((isString(detail.family) && detail.family === "IPv4")
            || (isNumber(detail.family) && detail.family === 4));
      })
      .forEach((detail) => {
        let host = detail.address.replace("127.0.0.1", hostname.name);
        // ipv6 host
        if (net.isIPv6(host)) {
          host = `[${host}]`;
        }
        const url = `${protocol}://${host}:${port}`;
        if (detail.address.includes("127.0.0.1")) {
          local.push(url);
        } else {
          network.push(url);
        }
      });
  }

  return {
    local,
    network
  };
}

export interface NormalizedAddressOptions {
  protocol?: "http" | "https" | false;
  hostname?: string;
  /**
   * @default ""
   */
  base?: string;
}

/**
 *  格式化服务器地址
 * @param address
 * @returns
 */
export function normalizeAddress(address: AddressInfo | string | null, options: NormalizedAddressOptions = {}) {
  if (isString(address)) {
    return address;
  }
  const protocol = options.protocol ?? "http";
  const base = options.base ?? "";
  if (isAddressInfo(address)) {
    const port = address.port;
    let host = options.hostname ?? address.address;
    if (host) {
      if (net.isIPv6(host)) {
        host = `[${host}]`;
      }
      if (protocol) {
        return `${protocol}://${host}:${port}${base}`;
      }
      return `${host}:${port}${base}`;
    }
  }
  return null;
}
