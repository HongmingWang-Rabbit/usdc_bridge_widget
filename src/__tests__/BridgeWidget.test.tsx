import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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

// Mock wagmi hooks
vi.mock("wagmi", () => ({
  useAccount: () => mockUseAccount(),
  useChainId: () => mockUseChainId(),
  useSwitchChain: () => mockUseSwitchChain(),
  useWaitForTransactionReceipt: () => mockUseWaitForTransactionReceipt(),
  useConnect: () => mockUseConnect(),
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
}));

// Default mock values
function setupDefaultMocks() {
  mockUseAccount.mockReturnValue({
    address: "0x1234567890123456789012345678901234567890",
    isConnected: true,
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
