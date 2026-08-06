import { promises as dns } from "node:dns";

/*
 * Who a visitor's address belongs to.
 *
 * What this can and cannot tell you is worth being plain about, because
 * the obvious question — "whose device is this?" — has no answer here.
 *
 * A browser never tells a website the name of the machine or the person
 * using it. There is no API for it and there never has been; it is the
 * point of the sandbox. The only things a site sees are the address the
 * request came from and whatever the browser volunteers about itself.
 *
 * So this resolves the address to the network that owns it. For a
 * person at home that is their internet provider — Spectrum, Orange,
 * Verizon — which identifies the company, never the subscriber. What it
 * does identify precisely is traffic that is not a person at all:
 * crawlers and rented servers announce themselves clearly, and on this
 * site they are a large share of what looks like an audience.
 *
 * Someone who signs in names themselves, and their earlier anonymous
 * visits are joined up to that account. That remains the only route
 * from a visit to a person.
 */

export type NetworkKind =
  | "datacenter"
  | "crawler"
  | "mobile"
  | "residential"
  | "business"
  | "unknown";

export interface NetworkIdentity {
  hostname: string | null;
  /* The company that owns the address range, when the name says. */
  organisation: string | null;
  kind: NetworkKind;
  /* True when this is server traffic rather than a person browsing. */
  isMachine: boolean;
}

/*
 * Reverse lookups are slow and the answers do not change. The admin
 * renders many rows at once and would otherwise ask for the same
 * address a dozen times per page.
 */
const cache = new Map<string, { value: NetworkIdentity; expiresAt: number }>();

const CACHE_MS = 60 * 60 * 1000;

const LOOKUP_TIMEOUT_MS = 1_500;

/*
 * Names that say the address belongs to rented infrastructure. Matched
 * on the hostname, which is how these hosts identify themselves.
 */
const DATACENTER = [
  "amazonaws.com",
  "compute-1.amazonaws.com",
  "googleusercontent.com",
  "1e100.net",
  "azure.com",
  "cloudapp.net",
  "digitalocean.com",
  "linode.com",
  "vultr.com",
  "your-server.de",
  "hetzner",
  "ovh.net",
  "ovh.com",
  "hwclouds-dns.com",
  "alicloud",
  "aliyun",
  "oracle.com",
  "scaleway",
  "contabo",
  "leaseweb",
];

const CRAWLER = [
  "fbsv.net",
  "googlebot.com",
  "search.msn.com",
  "crawl.baidu.com",
  "yandex",
  "applebot.apple.com",
  "petalsearch",
  "ahrefs",
  "semrush",
];

const MOBILE = ["myvzw.com", "mycingular", "t-mobile", "3g", "lte", "mobile"];

const RESIDENTIAL = [
  "res.",
  "dsl",
  "cable",
  "broadband",
  "abo.",
  "dyn.",
  "dynamic",
  "sub-",
  "client",
  "pool",
  "customer",
];

function classify(hostname: string): NetworkKind {
  const lower = hostname.toLowerCase();

  /* Crawlers before datacentres: a crawler runs on rented hardware. */
  if (CRAWLER.some((needle) => lower.includes(needle))) {
    return "crawler";
  }

  if (DATACENTER.some((needle) => lower.includes(needle))) {
    return "datacenter";
  }

  if (MOBILE.some((needle) => lower.includes(needle))) {
    return "mobile";
  }

  if (RESIDENTIAL.some((needle) => lower.includes(needle))) {
    return "residential";
  }

  return "business";
}

/*
 * The registrable part of the hostname, which is the bit that names a
 * company: "syn-142-197-138-130.res.spectrum.com" -> "spectrum.com".
 *
 * Two-part suffixes like .co.uk need the extra label or the answer is
 * the suffix rather than the company.
 */
const TWO_PART_SUFFIXES = new Set([
  "co.uk",
  "co.kr",
  "co.jp",
  "com.au",
  "com.br",
  "co.nz",
  "or.kr",
  "ne.jp",
]);

function organisationOf(hostname: string): string | null {
  const labels = hostname.toLowerCase().replace(/\.$/, "").split(".");

  if (labels.length < 2) {
    return null;
  }

  const lastTwo = labels.slice(-2).join(".");

  const registrable = TWO_PART_SUFFIXES.has(lastTwo)
    ? labels.slice(-3).join(".")
    : lastTwo;

  return registrable || null;
}

async function reverse(ip: string): Promise<string | null> {
  try {
    const names = await Promise.race([
      dns.reverse(ip),
      new Promise<string[]>((_, reject) =>
        setTimeout(
          () => reject(new Error("reverse lookup timed out")),
          LOOKUP_TIMEOUT_MS,
        ),
      ),
    ]);

    return names[0] ?? null;
  } catch {
    /*
     * Most addresses have no reverse record at all — roughly half of
     * this site's visitors. That is ordinary, not a failure.
     */
    return null;
  }
}

export async function identifyNetwork(
  ip: string | null | undefined,
): Promise<NetworkIdentity> {
  const unknown: NetworkIdentity = {
    hostname: null,
    organisation: null,
    kind: "unknown",
    isMachine: false,
  };

  if (!ip || ip === "unknown" || ip === "::1" || ip.startsWith("127.")) {
    return unknown;
  }

  const cached = cache.get(ip);

  if (cached && cached.expiresAt > Date.now()) {
    return cached.value;
  }

  const hostname = await reverse(ip);

  const value: NetworkIdentity = hostname
    ? (() => {
        const kind = classify(hostname);

        return {
          hostname,
          organisation: organisationOf(hostname),
          kind,
          isMachine: kind === "datacenter" || kind === "crawler",
        };
      })()
    : unknown;

  cache.set(ip, { value, expiresAt: Date.now() + CACHE_MS });

  return value;
}

/* Resolve a page's worth of addresses at once, without a stampede. */
export async function identifyNetworks(
  ips: (string | null | undefined)[],
): Promise<Map<string, NetworkIdentity>> {
  const distinct = [...new Set(ips.filter((ip): ip is string => Boolean(ip)))];

  const results = await Promise.all(
    distinct.map(async (ip) => [ip, await identifyNetwork(ip)] as const),
  );

  return new Map(results);
}

export function describeNetwork(identity: NetworkIdentity): string {
  if (!identity.hostname) {
    return "no reverse record";
  }

  const label: Record<NetworkKind, string> = {
    datacenter: "server",
    crawler: "crawler",
    mobile: "mobile network",
    residential: "home broadband",
    business: "network",
    unknown: "network",
  };

  return `${identity.organisation ?? identity.hostname} · ${label[identity.kind]}`;
}
