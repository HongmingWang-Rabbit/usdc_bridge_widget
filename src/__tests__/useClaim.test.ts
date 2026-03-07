import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseCCTPMessage, formatUSDCAmount, pollAttestationOnce } from "../useClaim";
import {
  CCTP_DOMAIN_IDS,
  CCTP_DOMAIN_TO_CHAIN_ID,
  MESSAGE_TRANSMITTER_V2_ADDRESS,
  CIRCLE_IRIS_API_URL,
  ATTESTATION_POLL_INTERVAL_MS,
  ATTESTATION_POLL_MAX_DURATION_MS,
} from "../constants";

describe("parseCCTPMessage", () => {
  // Build a realistic CCTP message hex for testing
  // Message header:
  //   version (4 bytes): 00000000
  //   sourceDomain (4 bytes): 00000001 (Avalanche = domain 1)
  //   destinationDomain (4 bytes): 00000010 (Sei = domain 16)
  //   nonce (8 bytes): 0000000000000001
  //   sender (32 bytes): zeros + address
  //   recipient (32 bytes): zeros + address
  //   destinationCaller (32 bytes): zeros
  // Message body (BurnMessage):
  //   version (4 bytes): 00000000
  //   burnToken (32 bytes): zeros + token address
  //   mintRecipient (32 bytes): zeros + 0x1234567890abcdef1234567890abcdef12345678
  //   amount (32 bytes): 99000000 (99 USDC = 99 * 10^6)
  //   messageSender (32 bytes): zeros

  const version = "00000000";
  const sourceDomain = "00000001"; // Avalanche
  const destinationDomain = "00000010"; // Sei (domain 16)
  const nonce = "0000000000000001";
  const sender = "0".repeat(64);
  const recipient = "0".repeat(64);
  const destinationCaller = "0".repeat(64);

  // Body
  const bodyVersion = "00000000";
  const burnToken = "0".repeat(64);
  const mintRecipient =
    "0".repeat(24) + "1234567890abcdef1234567890abcdef12345678";
  // 99 USDC = 99_000_000 = 0x5E69EC0
  const amount =
    "0".repeat(56) + "05e69ec0";
  const messageSender = "0".repeat(64);

  const header =
    version +
    sourceDomain +
    destinationDomain +
    nonce +
    sender +
    recipient +
    destinationCaller;

  const body = bodyVersion + burnToken + mintRecipient + amount + messageSender;
  const messageHex = "0x" + header + body;

  it("extracts destination domain correctly", () => {
    const result = parseCCTPMessage(messageHex);
    expect(result.destinationDomain).toBe(16); // Sei
  });

  it("extracts mint recipient correctly", () => {
    const result = parseCCTPMessage(messageHex);
    expect(result.mintRecipient.toLowerCase()).toBe(
      "0x1234567890abcdef1234567890abcdef12345678"
    );
  });

  it("extracts amount correctly", () => {
    const result = parseCCTPMessage(messageHex);
    expect(result.amount).toBe(BigInt(99_000_000)); // 99 USDC in raw units
  });

  it("works without 0x prefix", () => {
    const result = parseCCTPMessage(messageHex.slice(2));
    expect(result.destinationDomain).toBe(16);
    expect(result.amount).toBe(BigInt(99_000_000));
  });

  it("parses V2 messages correctly (148-byte header)", () => {
    // V2 header: version(4) + sourceDomain(4) + destDomain(4) + nonce(32)
    //   + sender(32) + recipient(32) + destCaller(32)
    //   + minFinalityThreshold(4) + finalityThresholdExecuted(4)
    const v2Version = "00000001";
    const v2SourceDomain = "00000010"; // Sei (domain 16)
    const v2DestDomain = "00000003"; // Arbitrum (domain 3)
    const v2Nonce = "0".repeat(64); // 32 bytes
    const v2Sender = "0".repeat(64);
    const v2Recipient = "0".repeat(64);
    const v2DestCaller = "0".repeat(64);
    const v2MinFinality = "00000000";
    const v2FinalityExecuted = "00000000";

    // Body (same layout as V1)
    const v2BodyVersion = "00000000";
    const v2BurnToken = "0".repeat(64);
    const v2MintRecipient = "0".repeat(24) + "abcdefabcdefabcdefabcdefabcdefabcdefabcd";
    const v2Amount = "0".repeat(56) + "00989680"; // 10_000_000 = 10 USDC
    const v2MessageSender = "0".repeat(64);

    const v2Header =
      v2Version + v2SourceDomain + v2DestDomain + v2Nonce +
      v2Sender + v2Recipient + v2DestCaller +
      v2MinFinality + v2FinalityExecuted;
    const v2Body = v2BodyVersion + v2BurnToken + v2MintRecipient + v2Amount + v2MessageSender;
    const v2MessageHex = "0x" + v2Header + v2Body;

    const result = parseCCTPMessage(v2MessageHex);
    expect(result.destinationDomain).toBe(3); // Arbitrum
    expect(result.mintRecipient.toLowerCase()).toBe(
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd"
    );
    expect(result.amount).toBe(BigInt(10_000_000)); // 10 USDC
  });
});

describe("formatUSDCAmount", () => {
  it("formats whole amounts", () => {
    expect(formatUSDCAmount(BigInt(99_000_000))).toBe("99");
  });

  it("formats fractional amounts", () => {
    expect(formatUSDCAmount(BigInt(99_500_000))).toBe("99.5");
  });

  it("formats small amounts", () => {
    expect(formatUSDCAmount(BigInt(1))).toBe("0.000001");
  });

  it("formats zero", () => {
    expect(formatUSDCAmount(BigInt(0))).toBe("0");
  });

  it("formats amounts with trailing zeros trimmed", () => {
    expect(formatUSDCAmount(BigInt(1_230_000))).toBe("1.23");
  });

  it("formats large amounts", () => {
    expect(formatUSDCAmount(BigInt(1_000_000_000_000))).toBe("1000000");
  });
});

describe("CCTP constants", () => {
  it("CIRCLE_IRIS_API_URL is correct", () => {
    expect(CIRCLE_IRIS_API_URL).toBe("https://iris-api.circle.com/v2/messages");
  });

  it("MESSAGE_TRANSMITTER_V2_ADDRESS is a valid address", () => {
    expect(MESSAGE_TRANSMITTER_V2_ADDRESS).toMatch(/^0x[a-fA-F0-9]{40}$/);
  });

  it("ATTESTATION_POLL_INTERVAL_MS is 30 seconds", () => {
    expect(ATTESTATION_POLL_INTERVAL_MS).toBe(30_000);
  });

  it("ATTESTATION_POLL_MAX_DURATION_MS is 30 minutes", () => {
    expect(ATTESTATION_POLL_MAX_DURATION_MS).toBe(30 * 60 * 1000);
  });

  it("all domain IDs are unique", () => {
    const domainIds = Object.values(CCTP_DOMAIN_IDS);
    expect(new Set(domainIds).size).toBe(domainIds.length);
  });

  it("reverse mapping is correct for all entries", () => {
    for (const [chainIdStr, domainId] of Object.entries(CCTP_DOMAIN_IDS)) {
      const chainId = Number(chainIdStr);
      expect(CCTP_DOMAIN_TO_CHAIN_ID[domainId]).toBe(chainId);
    }
  });

  it("has domain IDs for well-known chains", () => {
    expect(CCTP_DOMAIN_IDS[1]).toBe(0); // Ethereum
    expect(CCTP_DOMAIN_IDS[43114]).toBe(1); // Avalanche
    expect(CCTP_DOMAIN_IDS[10]).toBe(2); // Optimism
    expect(CCTP_DOMAIN_IDS[42161]).toBe(3); // Arbitrum
    expect(CCTP_DOMAIN_IDS[8453]).toBe(6); // Base
    expect(CCTP_DOMAIN_IDS[137]).toBe(7); // Polygon
    expect(CCTP_DOMAIN_IDS[1329]).toBe(16); // Sei
  });
});

describe("pollAttestationOnce", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns not-found on 404 response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 404 })
    );
    const result = await pollAttestationOnce(0, "0xabc");
    expect(result).toEqual({ status: "not-found" });
  });

  it("throws on non-404 error responses", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(null, { status: 500 })
    );
    await expect(pollAttestationOnce(0, "0xabc")).rejects.toThrow(
      "Iris API returned 500"
    );
  });

  it("returns not-found when messages array is empty", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), { status: 200 })
    );
    const result = await pollAttestationOnce(0, "0xabc");
    expect(result).toEqual({ status: "not-found" });
  });

  it("returns not-found when messages is missing", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({}), { status: 200 })
    );
    const result = await pollAttestationOnce(0, "0xabc");
    expect(result).toEqual({ status: "not-found" });
  });

  it("returns pending when attestation is 'pending'", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [{ message: "0xmsgdata", attestation: "pending" }],
        }),
        { status: 200 }
      )
    );
    const result = await pollAttestationOnce(0, "0xabc");
    expect(result).toEqual({ status: "pending", message: "0xmsgdata" });
  });

  it("throws on unexpected response format (missing message field)", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ messages: [{ noMessage: true }] }),
        { status: 200 }
      )
    );
    await expect(pollAttestationOnce(0, "0xabc")).rejects.toThrow(
      "Unexpected Iris API response format"
    );
  });

  it("returns complete with parsed CCTP data when attestation is ready", async () => {
    // Build a valid CCTP V2 message hex
    // V2 header (148 bytes): version(4) + sourceDomain(4) + destDomain(4) + nonce(32)
    //   + sender(32) + recipient(32) + destCaller(32) + minFinalityThreshold(4) + finalityThresholdExecuted(4)
    const version = "00000001";
    const sourceDomain = "00000000";
    const destDomain = "00000006"; // Base
    const nonce = "0".repeat(64); // 32 bytes for V2
    const sender = "0".repeat(64);
    const recipient = "0".repeat(64);
    const destCaller = "0".repeat(64);
    const minFinalityThreshold = "00000000";
    const finalityThresholdExecuted = "00000000";
    const bodyVersion = "00000000";
    const burnToken = "0".repeat(64);
    const mintRecipientHex = "1234567890abcdef1234567890abcdef12345678".padStart(64, "0");
    const amountHex = (100000000n).toString(16).padStart(64, "0");
    const messageSender = "0".repeat(64);

    const messageHex =
      "0x" +
      version + sourceDomain + destDomain + nonce +
      sender + recipient + destCaller +
      minFinalityThreshold + finalityThresholdExecuted +
      bodyVersion + burnToken + mintRecipientHex + amountHex + messageSender;

    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          messages: [{ message: messageHex, attestation: "0xattestationdata" }],
        }),
        { status: 200 }
      )
    );

    const result = await pollAttestationOnce(0, "0xabc");
    expect(result).not.toBeNull();
    expect(result!.status).toBe("complete");
    expect(result!.message).toBe(messageHex);
    expect(result!.attestation).toBe("0xattestationdata");
    expect(result!.destinationDomain).toBe(6);
    expect(result!.amount).toBe(100000000n);
    expect(result!.mintRecipient).toBe("0x1234567890abcdef1234567890abcdef12345678");
  });

  it("respects abort signal", async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(
      pollAttestationOnce(0, "0xabc", controller.signal)
    ).rejects.toThrow();
  });

  it("constructs URL with domain ID and tx hash", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ messages: [] }), { status: 200 })
    );
    await pollAttestationOnce(3, "0xdeadbeef");
    expect(fetchSpy).toHaveBeenCalledWith(
      `${CIRCLE_IRIS_API_URL}/3?transactionHash=0xdeadbeef`,
      expect.any(Object)
    );
  });
});
