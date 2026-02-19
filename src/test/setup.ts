import "@testing-library/jest-dom/vitest";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  (globalThis as unknown as { crypto: Crypto }).crypto = webcrypto as Crypto;
}
