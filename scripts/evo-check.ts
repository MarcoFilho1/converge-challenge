import { config } from "dotenv";
config({ path: ".env" });

async function main() {
  const m = await import("../src/lib/whatsapp/evolution");
  await m.ensureInstance();
  await m.ensureInstance();
  const qr = await m.getQr();
  console.log("state:", await m.getState());
  console.log("qr base64 prefix:", qr.base64?.slice(0, 22), "count:", qr.count);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
