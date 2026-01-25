import { describe, it, expect } from "vitest";
import {
  USDC_DECIMALS,
  USDC_ADDRESSES,
  TOKEN_MESSENGER_V2_ADDRESS,
  TOKEN_MESSENGER_ADDRESSES,
  CHAIN_ICONS,
  MAX_USDC_AMOUNT,
  MIN_USDC_AMOUNT,
  DEFAULT_LOCALE,
} from "../constants";

describe("USDC Constants", () => {
  it("has correct USDC decimals", () => {
    expect(USDC_DECIMALS).toBe(6);
  });

  it("has USDC address for Ethereum mainnet", () => {
    expect(USDC_ADDRESSES[1]).toBe(
      "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"
    );
  });

  it("all USDC addresses are valid hex strings", () => {
    Object.values(USDC_ADDRESSES).forEach((address) => {
      expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });
});

describe("Token Messenger Constants", () => {
  it("has valid V2 address", () => {
    expect(TOKEN_MESSENGER_V2_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("all chain messenger addresses use V2 address", () => {
    Object.values(TOKEN_MESSENGER_ADDRESSES).forEach((address) => {
      expect(address).toBe(TOKEN_MESSENGER_V2_ADDRESS);
    });
  });

  it("has messenger addresses for all USDC chains", () => {
    Object.keys(USDC_ADDRESSES).forEach((chainId) => {
      expect(TOKEN_MESSENGER_ADDRESSES[Number(chainId)]).toBeDefined();
    });
  });
});

describe("Chain Icons", () => {
  it("has icon URLs for major chains", () => {
    expect(CHAIN_ICONS[1]).toBeDefined(); // Ethereum
    expect(CHAIN_ICONS[42161]).toBeDefined(); // Arbitrum
    expect(CHAIN_ICONS[8453]).toBeDefined(); // Base
  });

  it("all icon URLs are valid URLs", () => {
    Object.values(CHAIN_ICONS).forEach((url) => {
      expect(url).toMatch(/^https?:\/\/.+/);
    });
  });
});

describe("Amount Constants", () => {
  it("MAX_USDC_AMOUNT is a reasonable value (100 billion)", () => {
    expect(MAX_USDC_AMOUNT).toBe("100000000000");
    expect(parseFloat(MAX_USDC_AMOUNT)).toBe(100_000_000_000);
  });

  it("MIN_USDC_AMOUNT is smallest USDC unit", () => {
    expect(MIN_USDC_AMOUNT).toBe("0.000001");
    expect(parseFloat(MIN_USDC_AMOUNT)).toBe(0.000001);
  });

  it("DEFAULT_LOCALE is en-US for consistent financial display", () => {
    expect(DEFAULT_LOCALE).toBe("en-US");
  });
});
