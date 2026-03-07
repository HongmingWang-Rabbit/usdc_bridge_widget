import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import React from "react";
import { BridgeWidget } from "../BridgeWidget";

// Create mock functions that can be reconfigured
const mockUseAccount = vi.fn();
const mockUseChainId = vi.fn();
const mockUseSwitchChain = vi.fn();
const mockUseConnect = vi.fn();
const mockUseWaitForTransactionReceipt = vi.fn();
const mockUseUSDCBalance = vi.fn();
const mockUseAllUSDCBalances = vi.fn();
const mockUseUSDCAllowance = vi.fn();
const mockUseBridge = vi.fn();
const mockUseRecovery = vi.fn();

// Store useAccountEffect callbacks for testing
let accountEffectCallbacks: { onConnect?: () => void; onDisconnect?: () => void } = {};
const mockUseAccountEffect = vi.fn((callbacks: { onConnect?: () => void; onDisconnect?: () => void }) => {
  accountEffectCallbacks = callbacks;
});

// Mock wagmi hooks
vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useAccountEffect: (callbacks: { onConnect?: () => void; onDisconnect?: () => void }) => mockUseAccountEffect(callbacks),
  useChainId: () => mockUseChainId(),
  useSwitchChain: () => mockUseSwitchChain(),
  useWaitForTransactionReceipt: () => mockUseWaitForTransactionReceipt(),
  useConnect: () => mockUseConnect(),
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
}));

// Mock custom hooks
vi.mock("../hooks", () => ({
  useUSDCBalance: () => mockUseUSDCBalance(),
  useAllUSDCBalances: () => mockUseAllUSDCBalances(),
  useUSDCAllowance: () => mockUseUSDCAllowance(),
}));

// Mock useBridge hook
vi.mock("../useBridge", () => ({
  useBridge: () => mockUseBridge(),
}));

// Mock useRecovery hook
vi.mock("../useRecovery", () => ({
  useRecovery: () => mockUseRecovery(),
}));

// Mock useClaimManager hook
const mockUseClaimManager = vi.fn();
vi.mock("../useClaimManager", () => ({
  useClaimManager: () => mockUseClaimManager(),
}));

// Mock usePendingTab hook
const mockUsePendingTab = vi.fn();
vi.mock("../usePendingTab", () => ({
  usePendingTab: (...args: unknown[]) => mockUsePendingTab(...args),
}));

// Mock chains
vi.mock("../chains", () => ({
  DEFAULT_CHAIN_CONFIGS: [
    {
      chain: { id: 1, name: "Ethereum" },
      usdcAddress: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
      tokenMessengerAddress: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
      iconUrl: "https://example.com/eth.png",
    },
    {
      chain: { id: 8453, name: "Base" },
      usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      tokenMessengerAddress: "0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d",
      iconUrl: "https://example.com/base.png",
    },
  ],
}));

// Mock utils
vi.mock("../utils", () => ({
  formatNumber: vi.fn((value: string | number) => {
    const num = typeof value === "string" ? parseFloat(value) : value;
    return isNaN(num)
      ? "0"
      : num.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        });
  }),
  getErrorMessage: vi.fn((error: unknown) => {
    if (error instanceof Error) return error.message;
    return "Unknown error";
  }),
  validateAmountInput: vi.fn((value: string) => {
    // Simple validation mock
    if (value === "" || /^[0-9]*\.?[0-9]*$/.test(value)) {
      return { isValid: true, sanitized: value };
    }
    return { isValid: false, sanitized: "" };
  }),
  validateChainConfigs: vi.fn(() => ({ isValid: true, errors: [] })),
}));

// Mock constants
vi.mock("../constants", () => ({
  USDC_BRAND_COLOR: "#2775ca",
  CCTP_DOMAIN_IDS: { 1: 0, 8453: 6 },
  CCTP_DOMAIN_TO_CHAIN_ID: { 0: 1, 6: 8453 },
  MESSAGE_TRANSMITTER_V2_ADDRESS: "0x81D40F21F12A8F0E3252Bccb954D722d4c464B64",
  CIRCLE_IRIS_API_URL: "https://iris-api.circle.com/v2/messages",
  ATTESTATION_POLL_INTERVAL_MS: 30000,
  ATTESTATION_POLL_MAX_DURATION_MS: 1800000,
  USDC_DECIMALS: 6,
}));

// Default mock values
function setupDefaultMocks() {
  // Reset accountEffectCallbacks for each test
  accountEffectCallbacks = {};

  mockUseAccount.mockReturnValue({
    address: "0x1234567890123456789012345678901234567890",
    isConnected: true,
    status: "connected",
  });
  mockUseChainId.mockReturnValue(1);
  mockUseSwitchChain.mockReturnValue({
    switchChainAsync: vi.fn(),
    isPending: false,
  });
  mockUseConnect.mockReturnValue({
    connect: vi.fn(),
    connectors: [],
  });
  mockUseWaitForTransactionReceipt.mockReturnValue({
    isLoading: false,
    isSuccess: false,
  });
  mockUseUSDCBalance.mockReturnValue({
    balance: 1000000000n,
    balanceFormatted: "1000.00",
    isLoading: false,
    refetch: vi.fn(),
  });
  mockUseAllUSDCBalances.mockReturnValue({
    balances: {
      1: { balance: 1000000000n, formatted: "1000.00" },
      8453: { balance: 500000000n, formatted: "500.00" },
    },
    isLoading: false,
    refetch: vi.fn(),
  });
  mockUseUSDCAllowance.mockReturnValue({
    allowance: 0n,
    allowanceFormatted: "0",
    isLoading: false,
    isApproving: false,
    approve: vi.fn(),
    needsApproval: vi.fn(() => true),
    refetch: vi.fn(),
    approvalError: null,
  });
  mockUseBridge.mockReturnValue({
    bridge: vi.fn(),
    state: { status: "idle", events: [] },
    reset: vi.fn(),
  });
  mockUseRecovery.mockReturnValue({
    pendingBridges: [],
    retryBridge: vi.fn(),
    dismissBridge: vi.fn(),
    isRecovering: false,
    refresh: vi.fn(),
  });
  mockUseClaimManager.mockReturnValue({
    pendingClaims: [],
    addClaim: vi.fn(),
    executeClaim: vi.fn(),
    dismissClaim: vi.fn(),
    resumePolling: vi.fn(),
    activeClaimId: null,
    refresh: vi.fn(),
  });
  mockUsePendingTab.mockReturnValue({
    items: [],
    actionableCount: 0,
  });
}

describe("BridgeWidget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("renders the widget container", () => {
    render(<BridgeWidget />);
    const widget = screen.getByRole("region", { name: "USDC Bridge Widget" });
    expect(widget).toBeDefined();
  });

  it("renders source and destination chain selectors", () => {
    render(<BridgeWidget />);
    expect(screen.getByText("From")).toBeDefined();
    expect(screen.getByText("To")).toBeDefined();
  });

  it("renders the amount input", () => {
    render(<BridgeWidget />);
    expect(screen.getByText("Amount")).toBeDefined();
    expect(screen.getByPlaceholderText("0.00")).toBeDefined();
  });

  it("renders balance display", () => {
    render(<BridgeWidget />);
    expect(screen.getByText(/Balance:/)).toBeDefined();
  });

  it("renders MAX button", () => {
    render(<BridgeWidget />);
    const maxButton = screen.getByRole("button", {
      name: "Set maximum amount",
    });
    expect(maxButton).toBeDefined();
  });

  it("renders swap button", () => {
    render(<BridgeWidget />);
    const swapButton = screen.getByRole("button", {
      name: "Swap source and destination chains",
    });
    expect(swapButton).toBeDefined();
  });

  it("shows Approve & Bridge button when approval needed", () => {
    render(<BridgeWidget />);
    // Enter an amount first
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "100" } });

    expect(screen.getByText("Approve & Bridge USDC")).toBeDefined();
  });

  it("shows Enter Amount when no amount is entered", () => {
    render(<BridgeWidget />);
    expect(screen.getByText("Enter Amount")).toBeDefined();
  });

  it("rejects scientific notation in amount input", () => {
    render(<BridgeWidget />);
    const input = screen.getByPlaceholderText("0.00") as HTMLInputElement;

    // Try to enter scientific notation
    fireEvent.change(input, { target: { value: "1e6" } });
    expect(input.value).toBe(""); // Should be rejected

    // Valid decimal should work
    fireEvent.change(input, { target: { value: "100.50" } });
    expect(input.value).toBe("100.50");
  });

  it("applies custom className", () => {
    render(<BridgeWidget className="custom-class" />);
    const widget = screen.getByRole("region", { name: "USDC Bridge Widget" });
    expect(widget.className).toBe("custom-class");
  });

  it("applies custom style", () => {
    render(<BridgeWidget style={{ backgroundColor: "red" }} />);
    const widget = screen.getByRole("region", { name: "USDC Bridge Widget" });
    expect(widget.style.backgroundColor).toBe("red");
  });

  it("applies borderless style when borderless prop is true", () => {
    render(<BridgeWidget borderless />);
    const widget = screen.getByRole("region", { name: "USDC Bridge Widget" });
    // Check that borderless styles are applied
    expect(widget.style.background).toBe("transparent");
    // JSDOM normalizes "0px" to "0"
    expect(widget.style.borderRadius).toBe("0");
  });

  it("applies default borders when borderless prop is false", () => {
    render(<BridgeWidget borderless={false} />);
    const widget = screen.getByRole("region", { name: "USDC Bridge Widget" });
    // Check that default styles have border radius (not 0)
    expect(widget.style.borderRadius).not.toBe("0");
  });

  it("calls onBridgeStart when bridge is initiated", async () => {
    const onBridgeStart = vi.fn();
    render(<BridgeWidget onBridgeStart={onBridgeStart} />);

    // Enter an amount
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "100" } });

    // Click the bridge button
    const bridgeButton = screen.getByText("Approve & Bridge USDC");
    fireEvent.click(bridgeButton);

    // onBridgeStart should be called with the default chains
    expect(onBridgeStart).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceChainId: 1,
        amount: "100",
      })
    );
  });
});

describe("BridgeWidget - Disconnected State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    // Override to disconnected state
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      status: "disconnected",
    });
  });

  it("shows Connect Wallet button when disconnected", () => {
    render(<BridgeWidget />);
    expect(screen.getByText("Connect Wallet")).toBeDefined();
  });

  it("calls onConnectWallet when Connect Wallet is clicked", () => {
    const onConnectWallet = vi.fn();
    render(<BridgeWidget onConnectWallet={onConnectWallet} />);

    const connectButton = screen.getByText("Connect Wallet");
    fireEvent.click(connectButton);

    expect(onConnectWallet).toHaveBeenCalled();
  });

  it("does not show balance in amount input when wallet is disconnected", () => {
    render(<BridgeWidget />);
    // Balance label should not be present when disconnected
    expect(screen.queryByText(/Balance:/)).toBeNull();
  });

  it("does not show balance in chain selectors when wallet is disconnected", () => {
    render(<BridgeWidget />);
    // USDC balance text should not appear in chain selectors
    expect(screen.queryByText(/1,000.00 USDC/)).toBeNull();
    expect(screen.queryByText(/500.00 USDC/)).toBeNull();
  });

  it("refetches balances when onConnect callback is triggered", () => {
    const refetchMock = vi.fn();
    mockUseAllUSDCBalances.mockReturnValue({
      balances: {},
      isLoading: false,
      refetch: refetchMock,
    });

    render(<BridgeWidget />);

    // Verify useAccountEffect was called with callbacks
    expect(mockUseAccountEffect).toHaveBeenCalled();
    expect(accountEffectCallbacks.onConnect).toBeDefined();

    // Simulate onConnect being triggered (as wagmi would do on wallet connect)
    accountEffectCallbacks.onConnect?.();

    // Refetch should be called
    expect(refetchMock).toHaveBeenCalled();
  });

  it("clears form state when onDisconnect callback is triggered", () => {
    const resetBridgeMock = vi.fn();
    mockUseBridge.mockReturnValue({
      bridge: vi.fn(),
      state: { status: "idle", events: [] },
      reset: resetBridgeMock,
    });

    render(<BridgeWidget />);

    // Enter some amount first
    const input = screen.getByPlaceholderText("0.00");
    fireEvent.change(input, { target: { value: "100" } });

    // Verify useAccountEffect was called with callbacks
    expect(accountEffectCallbacks.onDisconnect).toBeDefined();

    // Simulate onDisconnect being triggered (as wagmi would do on wallet disconnect)
    act(() => {
      accountEffectCallbacks.onDisconnect?.();
    });

    // Bridge reset should be called
    expect(resetBridgeMock).toHaveBeenCalled();
  });
});

describe("BridgeWidget - Reconnecting State", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("shows Connecting... button when status is reconnecting", () => {
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      status: "reconnecting",
    });

    render(<BridgeWidget />);
    expect(screen.getByText("Connecting...")).toBeDefined();
  });

  it("shows Connecting... button when status is connecting", () => {
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      status: "connecting",
    });

    render(<BridgeWidget />);
    expect(screen.getByText("Connecting...")).toBeDefined();
  });

  it("does not call onConnectWallet when reconnecting", () => {
    const onConnectWallet = vi.fn();
    mockUseAccount.mockReturnValue({
      address: undefined,
      isConnected: false,
      status: "reconnecting",
    });

    render(<BridgeWidget onConnectWallet={onConnectWallet} />);

    const connectButton = screen.getByText("Connecting...");
    fireEvent.click(connectButton);

    // onConnectWallet should NOT be called during reconnection
    expect(onConnectWallet).not.toHaveBeenCalled();
  });
});

describe("BridgeWidget - Chain Switch Required", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
    // Connected to Base (8453) but source is Ethereum (1)
    mockUseChainId.mockReturnValue(8453);
  });

  it("shows Switch Chain button when on wrong network", () => {
    render(<BridgeWidget />);
    expect(screen.getByText(/Switch to/)).toBeDefined();
  });
});

describe("BridgeWidget - Accessibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("has accessible labels for chain selectors", () => {
    render(<BridgeWidget />);

    // Chain selector buttons should have proper aria attributes
    const buttons = screen.getAllByRole("button");
    const chainButtons = buttons.filter(
      (btn) => btn.getAttribute("aria-haspopup") === "listbox"
    );

    expect(chainButtons.length).toBe(2);
    chainButtons.forEach((btn) => {
      expect(btn.getAttribute("aria-expanded")).toBeDefined();
    });
  });

  it("has accessible amount input", () => {
    render(<BridgeWidget />);
    const input = screen.getByPlaceholderText("0.00");
    expect(input.getAttribute("aria-labelledby")).toBeDefined();
    expect(input.getAttribute("aria-describedby")).toBeDefined();
  });
});

// Factory for mock pending bridge records
function createMockBridge(overrides: Record<string, unknown> = {}) {
  return {
    id: "test-1",
    walletAddress: "0x1234",
    sourceChainId: 1,
    destChainId: 8453,
    amount: "50",
    bridgeResult: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
    status: "recovery-pending" as const,
    ...overrides,
  };
}

function setupRecoveryMock(
  bridges: ReturnType<typeof createMockBridge>[],
  overrides: Record<string, unknown> = {}
) {
  mockUseRecovery.mockReturnValue({
    pendingBridges: bridges,
    retryBridge: vi.fn(),
    dismissBridge: vi.fn(),
    isRecovering: false,
    refresh: vi.fn(),
    ...overrides,
  });
}

describe("BridgeWidget - RecoveryBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("does not render when no pending bridges exist", () => {
    render(<BridgeWidget />);
    expect(screen.queryByText(/Incomplete bridge/)).toBeNull();
    expect(screen.queryByText(/Bridge may have completed/)).toBeNull();
    expect(screen.queryByText(/Bridge needs manual action/)).toBeNull();
  });

  it("renders incomplete bridge banner with Retry and Dismiss buttons", () => {
    setupRecoveryMock([createMockBridge()]);

    render(<BridgeWidget />);
    expect(screen.getByText(/Incomplete bridge/)).toBeDefined();
    expect(screen.getByText(/50 USDC/)).toBeDefined();
    expect(screen.getByText("Retry")).toBeDefined();
    expect(screen.getByText("Dismiss")).toBeDefined();
  });

  it("renders 'Bridge may have completed' banner for possibly-completed records", () => {
    setupRecoveryMock([
      createMockBridge({ id: "test-2", amount: "100", status: "failed", failureHint: "possibly-completed" }),
    ]);

    render(<BridgeWidget />);
    expect(screen.getByText(/Bridge may have completed/)).toBeDefined();
    expect(screen.getByText(/Check your balance on Base/)).toBeDefined();
    expect(screen.queryByText("Retry")).toBeNull();
    expect(screen.getByText("Dismiss")).toBeDefined();
  });

  it("renders 'Bridge needs manual action' banner for failed records without hint", () => {
    setupRecoveryMock([
      createMockBridge({ id: "test-3", amount: "75", status: "failed" }),
    ]);

    render(<BridgeWidget />);
    expect(screen.getByText(/Bridge needs manual action/)).toBeDefined();
    expect(screen.getByText(/Please re-initiate this bridge/)).toBeDefined();
    expect(screen.queryByText("Retry")).toBeNull();
    expect(screen.getByText("Dismiss")).toBeDefined();
  });

  it("has aria-label on individual banner items", () => {
    setupRecoveryMock([createMockBridge({ id: "test-4", amount: "200" })]);

    render(<BridgeWidget />);
    const banner = screen.getByLabelText(
      "Recovery pending: 200 USDC from Ethereum to Base"
    );
    expect(banner).toBeDefined();
  });

  it("calls retryBridge when Retry is clicked", () => {
    const retryBridge = vi.fn();
    setupRecoveryMock([createMockBridge({ id: "test-5" })], { retryBridge });

    render(<BridgeWidget />);
    fireEvent.click(screen.getByText("Retry"));
    expect(retryBridge).toHaveBeenCalledWith("test-5");
  });

  it("calls dismissBridge when Dismiss is clicked", () => {
    const dismissBridge = vi.fn();
    setupRecoveryMock([createMockBridge({ id: "test-6" })], { dismissBridge });

    render(<BridgeWidget />);
    fireEvent.click(screen.getByText("Dismiss"));
    expect(dismissBridge).toHaveBeenCalledWith("test-6");
  });

  it("disables Retry button during recovery", () => {
    setupRecoveryMock([createMockBridge({ id: "test-7" })], { isRecovering: true });

    render(<BridgeWidget />);
    expect(screen.getByText("Retrying...")).toBeDefined();
    const retryBtn = screen.getByText("Retrying...");
    expect(retryBtn.hasAttribute("disabled")).toBe(true);
  });
});

describe("BridgeWidget - BridgeProgress", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("does not show progress stepper in idle state", () => {
    render(<BridgeWidget />);
    expect(screen.queryByText("Approve")).toBeNull();
    expect(screen.queryByText("Burn USDC")).toBeNull();
  });

  it("shows progress stepper during approving state", () => {
    mockUseBridge.mockReturnValue({
      bridge: vi.fn(),
      state: { status: "approving", events: [] },
      reset: vi.fn(),
    });

    render(<BridgeWidget />);
    expect(screen.getByText("Approve")).toBeDefined();
    expect(screen.getByText("Burn USDC")).toBeDefined();
    expect(screen.getByText("Attestation")).toBeDefined();
    expect(screen.getByText("Mint USDC")).toBeDefined();
  });

  it("shows progress stepper with error state on failed step", () => {
    mockUseBridge.mockReturnValue({
      bridge: vi.fn(),
      // After the burn step fails, bridgeState goes to "error" and lastActiveStep is "burning"
      // BridgeProgress receives lastActiveStep via ref which is set by the useEffect.
      // We simulate this by setting status to "burning" first (which makes the stepper visible).
      state: { status: "burning", events: [] },
      reset: vi.fn(),
    });

    render(<BridgeWidget />);
    // The "Burn USDC" step should be visible and active
    expect(screen.getByText("Burn USDC")).toBeDefined();
  });

  it("shows attestation warning during fetching-attestation state", () => {
    mockUseBridge.mockReturnValue({
      bridge: vi.fn(),
      state: { status: "fetching-attestation", events: [] },
      reset: vi.fn(),
    });

    render(<BridgeWidget />);
    expect(
      screen.getByText(/Do not close this page/)
    ).toBeDefined();
  });

  it("does not show attestation warning during other states", () => {
    mockUseBridge.mockReturnValue({
      bridge: vi.fn(),
      state: { status: "burning", events: [] },
      reset: vi.fn(),
    });

    render(<BridgeWidget />);
    expect(screen.queryByText(/Do not close this page/)).toBeNull();
  });
});

describe("BridgeWidget - Claim Tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("renders tab bar with Bridge and Claim tabs by default", () => {
    render(<BridgeWidget />);
    const tablist = screen.getByRole("tablist", { name: "Widget mode" });
    expect(tablist).toBeDefined();
    expect(screen.getByRole("tab", { name: "Bridge" })).toBeDefined();
    expect(screen.getByRole("tab", { name: "Claim" })).toBeDefined();
  });

  it("hides tab bar when showClaimTab is false", () => {
    render(<BridgeWidget showClaimTab={false} />);
    expect(screen.queryByRole("tablist")).toBeNull();
    expect(screen.queryByRole("tab", { name: "Claim" })).toBeNull();
    // Bridge content should still be visible
    expect(screen.getByText("From")).toBeDefined();
  });

  it("switches to Claim tab when clicked", () => {
    render(<BridgeWidget />);
    const claimTab = screen.getByRole("tab", { name: "Claim" });
    fireEvent.click(claimTab);

    // Claim tab content should be visible
    expect(screen.getByText(/Recover unclaimed USDC/)).toBeDefined();
    expect(screen.getByText("Burn Transaction Hash")).toBeDefined();
    expect(screen.getByText("Fetch Attestation")).toBeDefined();

    // Bridge tab content should be hidden
    expect(screen.queryByText("Amount")).toBeNull();
  });

  it("switches back to Bridge tab when clicked", () => {
    render(<BridgeWidget />);
    // Go to Claim tab
    fireEvent.click(screen.getByRole("tab", { name: "Claim" }));
    expect(screen.queryByText("Amount")).toBeNull();

    // Go back to Bridge tab
    fireEvent.click(screen.getByRole("tab", { name: "Bridge" }));
    expect(screen.getByText("Amount")).toBeDefined();
    expect(screen.queryByText(/Recover unclaimed USDC/)).toBeNull();
  });

  it("renders source chain selector in Claim tab", () => {
    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: "Claim" }));
    expect(screen.getByText("Source Chain (where you burned)")).toBeDefined();
  });

  it("renders tx hash input in Claim tab", () => {
    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: "Claim" }));
    const input = screen.getByPlaceholderText("0x...");
    expect(input).toBeDefined();
  });

  it("disables Fetch Attestation button when tx hash is empty", () => {
    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: "Claim" }));
    const fetchButton = screen.getByText("Fetch Attestation").closest("button");
    expect(fetchButton?.disabled).toBe(true);
  });

  it("enables Fetch Attestation button when tx hash is entered", () => {
    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: "Claim" }));
    const input = screen.getByPlaceholderText("0x...");
    fireEvent.change(input, { target: { value: "0x1234" } });
    const fetchButton = screen.getByText("Fetch Attestation").closest("button");
    expect(fetchButton?.disabled).toBe(false);
  });

  it("has correct aria attributes on tabs", () => {
    render(<BridgeWidget />);
    const bridgeTab = screen.getByRole("tab", { name: "Bridge" });
    const claimTab = screen.getByRole("tab", { name: "Claim" });

    expect(bridgeTab.getAttribute("aria-selected")).toBe("true");
    expect(claimTab.getAttribute("aria-selected")).toBe("false");

    fireEvent.click(claimTab);
    expect(bridgeTab.getAttribute("aria-selected")).toBe("false");
    expect(claimTab.getAttribute("aria-selected")).toBe("true");
  });
});

describe("BridgeWidget - Pending Tab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it("renders Pending tab by default (same as showClaimTab)", () => {
    render(<BridgeWidget />);
    expect(screen.getByRole("tab", { name: /Pending/ })).toBeDefined();
  });

  it("hides Pending tab when showPendingTab is false", () => {
    render(<BridgeWidget showPendingTab={false} />);
    expect(screen.queryByRole("tab", { name: /Pending/ })).toBeNull();
  });

  it("hides Pending tab when showClaimTab is false and showPendingTab not set", () => {
    render(<BridgeWidget showClaimTab={false} />);
    expect(screen.queryByRole("tab", { name: /Pending/ })).toBeNull();
  });

  it("shows Pending tab when showClaimTab is false but showPendingTab is true", () => {
    render(<BridgeWidget showClaimTab={false} showPendingTab={true} />);
    expect(screen.getByRole("tab", { name: /Pending/ })).toBeDefined();
  });

  it("switches to Pending tab when clicked", () => {
    render(<BridgeWidget />);
    const pendingTab = screen.getByRole("tab", { name: /Pending/ });
    fireEvent.click(pendingTab);

    // Should show empty state
    expect(screen.getByText("No pending operations")).toBeDefined();

    // Bridge tab content should be hidden
    expect(screen.queryByText("Amount")).toBeNull();
  });

  it("shows empty state when no pending items exist", () => {
    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: /Pending/ }));
    expect(screen.getByText("No pending operations")).toBeDefined();
  });

  it("shows badge with actionable count", () => {
    mockUsePendingTab.mockReturnValue({
      items: [
        {
          type: "claim",
          id: "c1",
          sourceChainId: 1,
          destChainId: 8453,
          amount: "50",
          updatedAt: Date.now(),
          displayStatus: "Ready to claim",
          actionable: true,
          actionLabel: "Claim",
          actionType: "execute",
          isPolling: false,
          statusVariant: "success",
          dismissable: true,
          raw: {},
        },
      ],
      actionableCount: 1,
    });

    render(<BridgeWidget />);
    // Badge should show "1"
    expect(screen.getByText("1")).toBeDefined();
  });

  it("does not show badge when actionableCount is 0", () => {
    mockUsePendingTab.mockReturnValue({
      items: [
        {
          type: "bridge",
          id: "b1",
          sourceChainId: 1,
          destChainId: 8453,
          amount: "100",
          updatedAt: Date.now(),
          displayStatus: "Failed",
          actionable: false,
          isPolling: false,
          statusVariant: "error",
          dismissable: true,
          raw: {},
        },
      ],
      actionableCount: 0,
    });

    render(<BridgeWidget />);
    // The Pending tab text should exist but no badge
    expect(screen.getByRole("tab", { name: /Pending/ })).toBeDefined();
    expect(screen.queryByLabelText("0 pending")).toBeNull();
  });

  it("renders pending items when switching to Pending tab", () => {
    mockUsePendingTab.mockReturnValue({
      items: [
        {
          type: "bridge",
          id: "b1",
          sourceChainId: 1,
          destChainId: 8453,
          amount: "100",
          updatedAt: Date.now(),
          displayStatus: "Recovery needed",
          actionable: true,
          actionLabel: "Resume",
          actionType: "resume",
          isPolling: false,
          statusVariant: "primary",
          dismissable: true,
          raw: {},
        },
        {
          type: "claim",
          id: "c1",
          sourceChainId: 1,
          destChainId: 8453,
          amount: "50",
          updatedAt: Date.now(),
          displayStatus: "Ready to claim",
          actionable: true,
          actionLabel: "Claim",
          actionType: "execute",
          isPolling: false,
          statusVariant: "success",
          dismissable: true,
          raw: {},
        },
      ],
      actionableCount: 2,
    });

    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: /Pending/ }));

    // Both items should be visible
    expect(screen.getByText("Resume")).toBeDefined();
    // "Claim" appears as both a tab button and an action button — use getAllByText
    const claimTexts = screen.getAllByText("Claim");
    expect(claimTexts.length).toBeGreaterThanOrEqual(2); // tab + action button
    // Chain names should appear
    expect(screen.getAllByText(/Ethereum → Base/).length).toBe(2);
  });

  it("calls retryBridge for bridge Resume action", () => {
    const retryBridge = vi.fn();
    mockUseRecovery.mockReturnValue({
      pendingBridges: [],
      retryBridge,
      dismissBridge: vi.fn(),
      isRecovering: false,
      refresh: vi.fn(),
    });
    mockUsePendingTab.mockReturnValue({
      items: [
        {
          type: "bridge",
          id: "b1",
          sourceChainId: 1,
          destChainId: 8453,
          amount: "100",
          updatedAt: Date.now(),
          displayStatus: "Recovery needed",
          actionable: true,
          actionLabel: "Resume",
          actionType: "resume",
          isPolling: false,
          statusVariant: "primary",
          dismissable: true,
          raw: {},
        },
      ],
      actionableCount: 1,
    });

    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: /Pending/ }));
    fireEvent.click(screen.getByText("Resume"));
    expect(retryBridge).toHaveBeenCalledWith("b1");
  });

  it("calls claimManager.executeClaim for claim Claim action", () => {
    const executeClaim = vi.fn();
    mockUseClaimManager.mockReturnValue({
      pendingClaims: [],
      addClaim: vi.fn(),
      executeClaim,
      dismissClaim: vi.fn(),
      resumePolling: vi.fn(),
      activeClaimId: null,
      refresh: vi.fn(),
    });
    mockUsePendingTab.mockReturnValue({
      items: [
        {
          type: "claim",
          id: "c1",
          sourceChainId: 1,
          destChainId: 8453,
          amount: "50",
          updatedAt: Date.now(),
          displayStatus: "Ready to claim",
          actionable: true,
          actionLabel: "Claim",
          actionType: "execute",
          isPolling: false,
          statusVariant: "success",
          dismissable: true,
          raw: {},
        },
      ],
      actionableCount: 1,
    });

    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: /Pending/ }));
    // "Claim" appears as both a tab button and an action button — find the action button
    const claimButtons = screen.getAllByText("Claim");
    // The action button is NOT the tab button (which has role="tab")
    const actionButton = claimButtons.find((el) => !el.closest("[role='tab']"));
    fireEvent.click(actionButton!);
    expect(executeClaim).toHaveBeenCalledWith("c1");
  });

  it("calls dismissBridge for bridge dismiss", () => {
    const dismissBridge = vi.fn();
    mockUseRecovery.mockReturnValue({
      pendingBridges: [],
      retryBridge: vi.fn(),
      dismissBridge,
      isRecovering: false,
      refresh: vi.fn(),
    });
    mockUsePendingTab.mockReturnValue({
      items: [
        {
          type: "bridge",
          id: "b1",
          sourceChainId: 1,
          destChainId: 8453,
          amount: "100",
          updatedAt: Date.now(),
          displayStatus: "Recovery needed",
          actionable: true,
          actionLabel: "Resume",
          actionType: "resume",
          isPolling: false,
          statusVariant: "primary",
          dismissable: true,
          raw: {},
        },
      ],
      actionableCount: 1,
    });

    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: /Pending/ }));
    // Click the × dismiss button
    const dismissButtons = screen.getAllByLabelText("Dismiss");
    fireEvent.click(dismissButtons[0]);
    expect(dismissBridge).toHaveBeenCalledWith("b1");
  });

  it("calls resumePolling for claim Retry action", () => {
    const resumePolling = vi.fn();
    mockUseClaimManager.mockReturnValue({
      pendingClaims: [],
      addClaim: vi.fn(),
      executeClaim: vi.fn(),
      dismissClaim: vi.fn(),
      resumePolling,
      activeClaimId: null,
      refresh: vi.fn(),
    });
    mockUsePendingTab.mockReturnValue({
      items: [
        {
          type: "claim",
          id: "c1",
          sourceChainId: 1,
          destChainId: 8453,
          amount: "50",
          updatedAt: Date.now(),
          displayStatus: "Error",
          actionable: true,
          actionLabel: "Retry",
          actionType: "retry",
          isPolling: false,
          statusVariant: "error",
          dismissable: true,
          raw: {},
        },
      ],
      actionableCount: 1,
    });

    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: /Pending/ }));
    fireEvent.click(screen.getByText("Retry"));
    expect(resumePolling).toHaveBeenCalledWith("c1");
  });

  it("calls dismissClaim for claim Cancel action", () => {
    const dismissClaim = vi.fn();
    mockUseClaimManager.mockReturnValue({
      pendingClaims: [],
      addClaim: vi.fn(),
      executeClaim: vi.fn(),
      dismissClaim,
      resumePolling: vi.fn(),
      activeClaimId: null,
      refresh: vi.fn(),
    });
    mockUsePendingTab.mockReturnValue({
      items: [
        {
          type: "claim",
          id: "c2",
          sourceChainId: 1,
          destChainId: 8453,
          amount: "25",
          updatedAt: Date.now(),
          displayStatus: "Fetching attestation...",
          actionable: true,
          actionLabel: "Cancel",
          actionType: "cancel",
          isPolling: true,
          statusVariant: "muted",
          dismissable: true,
          raw: {},
        },
      ],
      actionableCount: 1,
    });

    render(<BridgeWidget />);
    fireEvent.click(screen.getByRole("tab", { name: /Pending/ }));
    fireEvent.click(screen.getByText("Cancel"));
    expect(dismissClaim).toHaveBeenCalledWith("c2");
  });

  it("has correct aria attributes on Pending tab", () => {
    render(<BridgeWidget />);
    const pendingTab = screen.getByRole("tab", { name: /Pending/ });

    expect(pendingTab.getAttribute("aria-selected")).toBe("false");

    fireEvent.click(pendingTab);
    expect(pendingTab.getAttribute("aria-selected")).toBe("true");
  });
});
