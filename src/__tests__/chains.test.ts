import { describe, it, expect } from "vitest";
import {
  createChainConfig,
  DEFAULT_CHAIN_CONFIGS,
  unichain,
  hyperEvm,
  plume,
  monad,
  codex,
  mainnet,
} from "../chains";
import { USDC_ADDRESSES, TOKEN_MESSENGER_V2_ADDRESS } from "../constants";

describe("Custom Chain Definitions", () => {
  it("unichain has correct chain ID", () => {
    expect(unichain.id).toBe(130);
    expect(unichain.name).toBe("Unichain");
  });

  it("hyperEvm has correct chain ID", () => {
    expect(hyperEvm.id).toBe(999);
    expect(hyperEvm.name).toBe("HyperEVM");
  });

  it("plume has correct chain ID", () => {
    expect(plume.id).toBe(98866);
    expect(plume.name).toBe("Plume");
  });

  it("monad has correct chain ID", () => {
    expect(monad.id).toBe(10200);
    expect(monad.name).toBe("Monad");
  });

  it("codex has correct chain ID", () => {
    expect(codex.id).toBe(81224);
    expect(codex.name).toBe("Codex");
  });

  it("all custom chains have valid RPC URLs", () => {
    [unichain, hyperEvm, plume, monad, codex].forEach((chain) => {
      expect(chain.rpcUrls.default.http).toBeDefined();
      expect(chain.rpcUrls.default.http.length).toBeGreaterThan(0);
    });
  });
});

describe("createChainConfig", () => {
  it("creates config with default addresses from constants", () => {
    const config = createChainConfig(mainnet);
    expect(config.chain).toBe(mainnet);
    expect(config.usdcAddress).toBe(USDC_ADDRESSES[1]);
    expect(config.tokenMessengerAddress).toBe(TOKEN_MESSENGER_V2_ADDRESS);
  });

  it("allows overriding USDC address", () => {
    const customAddress = "0x1234567890123456789012345678901234567890" as const;
    const config = createChainConfig(mainnet, { usdcAddress: customAddress });
    expect(config.usdcAddress).toBe(customAddress);
  });

  it("allows overriding token messenger address", () => {
    const customAddress = "0x1234567890123456789012345678901234567890" as const;
    const config = createChainConfig(mainnet, {
      tokenMessengerAddress: customAddress,
    });
    expect(config.tokenMessengerAddress).toBe(customAddress);
  });

  it("allows overriding icon URL", () => {
    const customIcon = "https://example.com/icon.png";
    const config = createChainConfig(mainnet, { iconUrl: customIcon });
    expect(config.iconUrl).toBe(customIcon);
  });
});

describe("DEFAULT_CHAIN_CONFIGS", () => {
  it("has multiple chain configurations", () => {
    expect(DEFAULT_CHAIN_CONFIGS.length).toBeGreaterThan(10);
  });

  it("all configs have valid chain objects", () => {
    DEFAULT_CHAIN_CONFIGS.forEach((config) => {
      expect(config.chain).toBeDefined();
      expect(config.chain.id).toBeTypeOf("number");
      expect(config.chain.name).toBeTypeOf("string");
    });
  });

  it("all configs have valid USDC addresses", () => {
    DEFAULT_CHAIN_CONFIGS.forEach((config) => {
      expect(config.usdcAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  it("all configs have token messenger addresses", () => {
    DEFAULT_CHAIN_CONFIGS.forEach((config) => {
      expect(config.tokenMessengerAddress).toBeDefined();
      expect(config.tokenMessengerAddress).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  it("includes Ethereum mainnet", () => {
    const ethereumConfig = DEFAULT_CHAIN_CONFIGS.find(
      (c) => c.chain.id === 1
    );
    expect(ethereumConfig).toBeDefined();
    expect(ethereumConfig?.chain.name).toBe("Ethereum");
  });

  it("includes all supported custom chains", () => {
    // Note: Monad (10200) is not included as it's not yet supported by Circle Bridge Kit
    const supportedCustomChainIds = [130, 999, 98866, 81224]; // unichain, hyperEvm, plume, codex
    supportedCustomChainIds.forEach((id) => {
      const config = DEFAULT_CHAIN_CONFIGS.find((c) => c.chain.id === id);
      expect(config).toBeDefined();
    });
  });

  it("monad chain is exported but not in defaults (not yet supported)", () => {
    // Monad is defined for future use but not in DEFAULT_CHAIN_CONFIGS
    const monadConfig = DEFAULT_CHAIN_CONFIGS.find((c) => c.chain.id === 10200);
    expect(monadConfig).toBeUndefined();
  });

  it("has no duplicate chain IDs", () => {
    const chainIds = DEFAULT_CHAIN_CONFIGS.map((c) => c.chain.id);
    const uniqueIds = new Set(chainIds);
    expect(uniqueIds.size).toBe(chainIds.length);
  });
});
