// Import only the QR encoder; the package root also loads Node image writers.
declare module "qrcode/lib/core/qrcode.js" {
  const QRCode: Pick<typeof import("qrcode"), "create">;
  export default QRCode;
}
