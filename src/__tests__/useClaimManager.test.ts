import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useClaimManager } from "../useClaimManager";
import {
  savePendingClaim,
  loadPendingClaims,
  removePendingClaim,
} from "../storage";

const mockUseAccount = vi.fn();
const mockUseChainId = vi.fn();
const mockUseSwitchChain = vi.fn();
const mockUseWriteContract = vi.fn();
const mockUseWaitForTransactionReceipt = vi.fn();

vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useChainId: () => mockUseChainId(),
  useSwitchChain: () => mockUseSwitchChain(),
  useWriteContract: () => mockUseWriteContract(),
  useWaitForTransactionReceipt: () => mockUseWaitForTransactionReceipt(),
}));

vi.mock("../constants", () => ({
  CCTP_DOMAIN_IDS: { 1: 0, 8453: 6 },
  CCTP_DOMAIN_TO_CHAIN_ID: { 0: 1, 6: 8453 },
  MESSAGE_TRANSMITTER_V2_ADDRESS: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
  CIRCLE_IRIS_API_URL: "https://iris-api.circle.com/v2/messages",
  ATTESTATION_POLL_INTERVAL_MS: 30000,
  ATTESTATION_POLL_MAX_DURATION_MS: 1800000,
  USDC_DECIMALS: 6,
}));

vi.mock("../utils", () => ({
  getErrorMessage: vi.fn((err: unknown) =>
    err instanceof Error ? err.message : "Unknown error"
  ),
  ensureHexPrefix: vi.fn((hex: string) =>
    hex.startsWith("0x") ? hex : `0x${hex}`
  ),
}));

function setupDefaultMocks() {
  mockUseAccount.mockReturnValue({
    address: "0x1234567890123456789012345678901234567890",
    isConnected: true,
  });
  mockUseChainId.mockReturnValue(8453);
  mockUseSwitchChain.mockReturnValue({
    switchChainAsync: vi.fn(),
  });
  mockUseWriteContract.mockReturnValue({
    writeContractAsync: vi.fn().mockResolvedValue("0xtxhash"),
  });
  mockUseWaitForTransactionReceipt.mockReturnValue({
    isSuccess: false,
  });
}

describe("useClaimManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setupDefaultMocks();
  });

  it("returns empty claims when disabled", () => {
    const { result } = renderHook(() =>
      useClaimManager({ enabled: false })
    );
    expect(result.current.pendingClaims).toHaveLength(0);
  });

  it("returns empty claims when not connected", () => {
    mockUseAccount.mockReturnValue({ address: undefined, isConnected: false });
    const { result } = renderHook(() => useClaimManager());
    expect(result.current.pendingClaims).toHaveLength(0);
  });

  it("loads existing claims from localStorage on mount", () => {
    const address = "0x1234567890123456789012345678901234567890";
    savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      burnTxHash: "0xabc",
      status: "attestation-ready",
    });

    const { result } = renderHook(() => useClaimManager());
    expect(result.current.pendingClaims).toHaveLength(1);
    expect(result.current.pendingClaims[0].burnTxHash).toBe("0xabc");
  });

  it("addClaim saves to localStorage and adds to state", () => {
    const { result } = renderHook(() => useClaimManager());

    act(() => {
      result.current.addClaim({
        walletAddress: "0x1234",
        sourceChainId: 1,
        burnTxHash: "0xdef",
        status: "attestation-ready",
      });
    });

    expect(result.current.pendingClaims).toHaveLength(1);
    expect(result.current.pendingClaims[0].burnTxHash).toBe("0xdef");
  });

  it("addClaim returns the id", () => {
    const { result } = renderHook(() => useClaimManager());

    let id: string | null = null;
    act(() => {
      id = result.current.addClaim({
        walletAddress: "0x1234",
        sourceChainId: 1,
        burnTxHash: "0xghi",
        status: "attestation-ready",
      });
    });

    expect(id).not.toBeNull();
    expect(typeof id).toBe("string");
  });

  it("addClaim deduplicates by burnTxHash", () => {
    const { result } = renderHook(() => useClaimManager());

    let id1: string | null = null;
    let id2: string | null = null;
    act(() => {
      id1 = result.current.addClaim({
        walletAddress: "0x1234",
        sourceChainId: 1,
        burnTxHash: "0xdup",
        status: "attestation-ready",
      });
    });
    act(() => {
      id2 = result.current.addClaim({
        walletAddress: "0x1234",
        sourceChainId: 1,
        burnTxHash: "0xdup",
        status: "attestation-ready",
      });
    });

    // Should return the same id and not create a duplicate
    expect(id1).toBe(id2);
    expect(result.current.pendingClaims).toHaveLength(1);
  });

  it("dismissClaim removes from state and localStorage", () => {
    const address = "0x1234567890123456789012345678901234567890";
    const saved = savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      burnTxHash: "0xabc",
      status: "attestation-ready",
    });

    const { result } = renderHook(() => useClaimManager());
    expect(result.current.pendingClaims).toHaveLength(1);

    act(() => {
      result.current.dismissClaim(saved!.id);
    });

    expect(result.current.pendingClaims).toHaveLength(0);
    // Verify removed from localStorage
    const claims = loadPendingClaims(address);
    expect(claims).toHaveLength(0);
  });

  it("activeClaimId is null initially", () => {
    const { result } = renderHook(() => useClaimManager());
    expect(result.current.activeClaimId).toBeNull();
  });

  it("refresh reloads claims from localStorage", () => {
    const { result } = renderHook(() => useClaimManager());
    expect(result.current.pendingClaims).toHaveLength(0);

    // Add a claim directly to localStorage
    const address = "0x1234567890123456789012345678901234567890";
    savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      burnTxHash: "0xnew",
      status: "attestation-ready",
    });

    act(() => {
      result.current.refresh();
    });

    expect(result.current.pendingClaims).toHaveLength(1);
  });

  it("executeClaim calls writeContractAsync with correct args", async () => {
    const writeContractAsync = vi.fn().mockResolvedValue("0xclaimhash");
    mockUseWriteContract.mockReturnValue({ writeContractAsync });

    const address = "0x1234567890123456789012345678901234567890";
    const saved = savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      destinationChainId: 8453,
      burnTxHash: "0xburn",
      amount: "50",
      attestation: { message: "0xmsg", attestation: "0xatt", status: "complete" },
      mintRecipient: "0xrecipient",
      status: "attestation-ready",
    });

    const { result } = renderHook(() => useClaimManager());
    expect(result.current.pendingClaims).toHaveLength(1);

    await act(async () => {
      await result.current.executeClaim(saved!.id);
    });

    expect(writeContractAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        functionName: "receiveMessage",
        args: ["0xmsg", "0xatt"],
        chainId: 8453,
      })
    );
  });

  it("executeClaim sets activeClaimId during execution", async () => {
    let resolveWrite: (val: string) => void;
    const writePromise = new Promise<string>((r) => { resolveWrite = r; });
    mockUseWriteContract.mockReturnValue({
      writeContractAsync: vi.fn().mockReturnValue(writePromise),
    });

    const address = "0x1234567890123456789012345678901234567890";
    const saved = savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      destinationChainId: 8453,
      burnTxHash: "0xburn2",
      amount: "100",
      attestation: { message: "0xmsg", attestation: "0xatt", status: "complete" },
      status: "attestation-ready",
    });

    const { result } = renderHook(() => useClaimManager());

    // Start execution without awaiting
    let execPromise: Promise<void>;
    act(() => {
      execPromise = result.current.executeClaim(saved!.id);
    });

    // activeClaimId should be set
    expect(result.current.activeClaimId).toBe(saved!.id);

    // Resolve the write
    await act(async () => {
      resolveWrite!("0xtxhash");
      await execPromise!;
    });
  });

  it("executeClaim sets error on writeContractAsync failure", async () => {
    mockUseWriteContract.mockReturnValue({
      writeContractAsync: vi.fn().mockRejectedValue(new Error("tx reverted")),
    });

    const address = "0x1234567890123456789012345678901234567890";
    const saved = savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      destinationChainId: 8453,
      burnTxHash: "0xburn3",
      amount: "25",
      attestation: { message: "0xmsg", attestation: "0xatt", status: "complete" },
      status: "attestation-ready",
    });

    const onClaimError = vi.fn();
    const { result } = renderHook(() => useClaimManager({ onClaimError }));

    await act(async () => {
      await result.current.executeClaim(saved!.id);
    });

    // Claim should be in error state
    expect(result.current.pendingClaims[0].status).toBe("error");
    expect(result.current.activeClaimId).toBeNull();
    expect(onClaimError).toHaveBeenCalled();
  });

  it("executeClaim allows retry from error state with attestation", async () => {
    const writeContractAsync = vi.fn().mockResolvedValue("0xretryhash");
    mockUseWriteContract.mockReturnValue({ writeContractAsync });

    const address = "0x1234567890123456789012345678901234567890";
    const saved = savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      destinationChainId: 8453,
      burnTxHash: "0xburn4",
      amount: "75",
      attestation: { message: "0xmsg", attestation: "0xatt", status: "complete" },
      status: "error",
      error: "previous failure",
    });

    const { result } = renderHook(() => useClaimManager());

    await act(async () => {
      await result.current.executeClaim(saved!.id);
    });

    // Should have called writeContractAsync even from error state
    expect(writeContractAsync).toHaveBeenCalled();
  });

  it("executeClaim sets error when claim has no attestation", async () => {
    const writeContractAsync = vi.fn();
    mockUseWriteContract.mockReturnValue({ writeContractAsync });

    const address = "0x1234567890123456789012345678901234567890";
    const saved = savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      burnTxHash: "0xburn5",
      status: "attestation-ready",
    });

    const { result } = renderHook(() => useClaimManager());

    await act(async () => {
      await result.current.executeClaim(saved!.id);
    });

    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(result.current.pendingClaims[0].status).toBe("error");
    expect(result.current.pendingClaims[0].error).toContain("Attestation data is missing");
  });

  it("executeClaim switches chain when needed", async () => {
    const switchChainAsync = vi.fn().mockResolvedValue(undefined);
    mockUseSwitchChain.mockReturnValue({ switchChainAsync });
    const writeContractAsync = vi.fn().mockResolvedValue("0xhash");
    mockUseWriteContract.mockReturnValue({ writeContractAsync });
    // Current chain is 1 (Ethereum), claim destination is 8453 (Base)
    mockUseChainId.mockReturnValue(1);

    const address = "0x1234567890123456789012345678901234567890";
    const saved = savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      destinationChainId: 8453,
      burnTxHash: "0xswitch",
      amount: "10",
      attestation: { message: "0xmsg", attestation: "0xatt", status: "complete" },
      status: "attestation-ready",
    });

    const { result } = renderHook(() => useClaimManager());

    await act(async () => {
      await result.current.executeClaim(saved!.id);
    });

    expect(switchChainAsync).toHaveBeenCalledWith({ chainId: 8453 });
    expect(writeContractAsync).toHaveBeenCalled();
  });

  it("executeClaim sets error when chain switch fails", async () => {
    const switchChainAsync = vi.fn().mockRejectedValue(new Error("User rejected"));
    mockUseSwitchChain.mockReturnValue({ switchChainAsync });
    const writeContractAsync = vi.fn();
    mockUseWriteContract.mockReturnValue({ writeContractAsync });
    mockUseChainId.mockReturnValue(1);

    const address = "0x1234567890123456789012345678901234567890";
    const saved = savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      destinationChainId: 8453,
      burnTxHash: "0xswitchfail",
      amount: "10",
      attestation: { message: "0xmsg", attestation: "0xatt", status: "complete" },
      status: "attestation-ready",
    });

    const { result } = renderHook(() => useClaimManager());

    await act(async () => {
      await result.current.executeClaim(saved!.id);
    });

    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(result.current.pendingClaims[0].status).toBe("error");
    expect(result.current.pendingClaims[0].error).toContain("Failed to switch chain");
    expect(result.current.activeClaimId).toBeNull();
  });

  it("resumePolling resets status to fetching-attestation", () => {
    const address = "0x1234567890123456789012345678901234567890";
    const saved = savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      burnTxHash: "0xresume",
      status: "error",
      error: "poll failed",
    });

    const { result } = renderHook(() => useClaimManager());
    expect(result.current.pendingClaims[0].status).toBe("error");

    act(() => {
      result.current.resumePolling(saved!.id);
    });

    expect(result.current.pendingClaims[0].status).toBe("fetching-attestation");
    expect(result.current.pendingClaims[0].error).toBeUndefined();
  });

  it("calls onPendingClaimDetected when claims exist on mount", () => {
    const address = "0x1234567890123456789012345678901234567890";
    savePendingClaim({
      walletAddress: address.toLowerCase(),
      sourceChainId: 1,
      burnTxHash: "0xdetect",
      status: "attestation-ready",
    });

    const onPendingClaimDetected = vi.fn();
    renderHook(() => useClaimManager({ onPendingClaimDetected }));

    expect(onPendingClaimDetected).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ burnTxHash: "0xdetect" }),
      ])
    );
  });

  it("does not call onPendingClaimDetected when no claims exist", () => {
    const onPendingClaimDetected = vi.fn();
    renderHook(() => useClaimManager({ onPendingClaimDetected }));

    expect(onPendingClaimDetected).not.toHaveBeenCalled();
  });
});
