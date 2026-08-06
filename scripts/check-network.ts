/*
 * What the network lookup makes of addresses that really visited.
 *
 *   npx tsx scripts/check-network.ts 13.57.148.235 90.3.82.87
 *
 * With no arguments it uses a fixed set covering each kind, so the
 * classification can be checked without touching the database.
 */

import { describeNetwork, identifyNetwork } from "../src/lib/network";

/* Real addresses from the visit log, one of each kind. */
const SAMPLES = [
  "13.57.148.235", // AWS
  "34.96.52.114", // Google Cloud
  "66.220.149.7", // Facebook's crawler
  "77.42.92.12", // Hetzner
  "142.197.138.130", // Spectrum, someone at home
  "174.193.130.117", // Verizon Wireless, someone on a phone
  "90.3.82.87", // Orange France
  "183.98.20.243", // no reverse record
];

async function main() {
  const ips = process.argv.slice(2);

  for (const ip of ips.length > 0 ? ips : SAMPLES) {
    const identity = await identifyNetwork(ip);

    console.log(
      `  ${ip.padEnd(16)} ${identity.kind.padEnd(12)} ${identity.isMachine ? "machine" : "person "}  ${describeNetwork(identity)}`,
    );
  }
}

main();
