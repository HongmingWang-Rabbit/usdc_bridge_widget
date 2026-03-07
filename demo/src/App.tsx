import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  WagmiProvider,
  createConfig,
  http,
  fallback,
  useAccount,
  useDisconnect,
  useConnect,
  useChainId,
  useSwitchChain,
  useBalance,
} from "wagmi";
import { mainnet, arbitrum, base, optimism, polygon, avalanche, linea, sei } from "wagmi/chains";
import { injected, coinbaseWallet, walletConnect } from "wagmi/connectors";
import {
  BridgeWidget,
  themePresets,
  createChainConfig,
  // Import custom chains from the widget
  unichain,
  hyperEvm,
  plume,
  codex,
  sonic,
  worldchain,
  xdc,
  ink,
} from "../../src";
import type { BridgeWidgetTheme, BridgeChainConfig } from "../../src";

/**
 * WalletConnect Project ID
 *
 * To get a real project ID:
 * 1. Go to https://cloud.walletconnect.com
 * 2. Create a new project (free)
 * 3. Copy your Project ID and set it as VITE_WALLETCONNECT_PROJECT_ID env variable
 *    or create a .env file in the demo folder with:
 *    VITE_WALLETCONNECT_PROJECT_ID=your_project_id_here
 *
 * Note: WalletConnect connector is only included when a valid project ID is provided.
 * Without it, only injected wallets (MetaMask, etc.) and Coinbase Wallet will be available.
 */
const WALLET_CONNECT_PROJECT_ID = import.meta.env.VITE_WALLETCONNECT_PROJECT_ID;

// Build connectors list - only include WalletConnect if a valid project ID is provided
function getConnectors() {
  const connectors = [
    injected(),
    coinbaseWallet({ appName: "USDC Bridge Demo" }),
  ];

  // Add WalletConnect only if project ID is configured
  // Note: The walletConnect signature is marked deprecated in favor of @reown/appkit,
  // but it still works. Migration to AppKit is optional for wagmi v2.x.
  // See: https://docs.reown.com/appkit/upgrade/from-wagmi
  if (WALLET_CONNECT_PROJECT_ID) {
    const wcConnector = walletConnect({
      projectId: WALLET_CONNECT_PROJECT_ID,
      showQrModal: true,
      metadata: {
        name: "USDC Bridge Demo",
        description: "Demo app for USDC Bridge Widget",
        url: typeof window !== "undefined" ? window.location.origin : "https://example.com",
        icons: ["https://avatars.githubusercontent.com/u/37784886"],
      },
    });
    connectors.push(wcConnector as ReturnType<typeof injected>);
  }

  return connectors;
}

// All supported chains with their RPC URLs
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const allChains = [
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
  avalanche,
  linea,
  sonic,
  worldchain,
  sei,
  xdc,
  ink,
  unichain,
  hyperEvm,
  plume,
  codex,
] as any; // Type assertion needed due to viem version mismatch between packages

const config = createConfig({
  chains: allChains as [typeof mainnet, ...typeof allChains],
  connectors: getConnectors(),
  transports: {
    // Multiple CORS-friendly public RPCs per chain with fallback for reliability.
    // wagmi's fallback() tries each transport in order, moving to the next on failure.
    [mainnet.id]: fallback([
      http("https://ethereum-rpc.publicnode.com"),
      http("https://1rpc.io/eth"),
      http("https://rpc.ankr.com/eth"),
    ]),
    [arbitrum.id]: fallback([
      http("https://arbitrum-one-rpc.publicnode.com"),
      http("https://1rpc.io/arb"),
      http("https://rpc.ankr.com/arbitrum"),
    ]),
    [base.id]: fallback([
      http("https://base-rpc.publicnode.com"),
      http("https://1rpc.io/base"),
      http("https://rpc.ankr.com/base"),
    ]),
    [optimism.id]: fallback([
      http("https://optimism-rpc.publicnode.com"),
      http("https://1rpc.io/op"),
      http("https://rpc.ankr.com/optimism"),
    ]),
    [polygon.id]: fallback([
      http("https://polygon-bor-rpc.publicnode.com"),
      http("https://1rpc.io/matic"),
      http("https://rpc.ankr.com/polygon"),
    ]),
    [avalanche.id]: fallback([
      http("https://avalanche-c-chain-rpc.publicnode.com"),
      http("https://1rpc.io/avax/c"),
      http("https://rpc.ankr.com/avalanche"),
    ]),
    [linea.id]: fallback([
      http("https://1rpc.io/linea"),
      http("https://rpc.linea.build"),
      http("https://linea-rpc.publicnode.com"),
    ]),
    [sei.id]: fallback([
      http("https://evm-rpc.sei-apis.com"),
      http("https://sei-rpc.publicnode.com"),
      http("https://rpc.ankr.com/sei"),
    ]),
    // Custom chains
    [sonic.id]: fallback([
      http("https://rpc.soniclabs.com"),
      http("https://sonic-rpc.publicnode.com"),
    ]),
    [worldchain.id]: fallback([
      http("https://worldchain-mainnet.g.alchemy.com/public"),
      http("https://worldchain-mainnet-rpc.publicnode.com"),
    ]),
    [xdc.id]: fallback([
      http("https://erpc.xinfin.network"),
      http("https://rpc.xinfin.network"),
    ]),
    [ink.id]: fallback([
      http("https://rpc-gel.inkonchain.com"),
      http("https://rpc-qn.inkonchain.com"),
    ]),
    [unichain.id]: fallback([
      http("https://mainnet.unichain.org"),
      http("https://unichain-rpc.publicnode.com"),
    ]),
    [hyperEvm.id]: fallback([
      http("https://rpc.hyperliquid.xyz/evm"),
      http("https://api.hyperliquid.xyz/evm"),
    ]),
    [plume.id]: fallback([
      http("https://rpc.plume.org"),
      http("https://plume-rpc.publicnode.com"),
    ]),
    [codex.id]: fallback([
      http("https://rpc.codex.xyz"),
    ]),
  },
});

const queryClient = new QueryClient();

// Demo chain configs - all chains with transports configured above
// Using type assertion due to minor viem version differences between packages
type ChainParam = Parameters<typeof createChainConfig>[0];
const DEMO_CHAIN_CONFIGS: BridgeChainConfig[] = [
  createChainConfig(mainnet as ChainParam),
  createChainConfig(arbitrum as ChainParam),
  createChainConfig(base as ChainParam),
  createChainConfig(optimism as ChainParam),
  createChainConfig(polygon as ChainParam),
  createChainConfig(avalanche as ChainParam),
  createChainConfig(linea as ChainParam),
  createChainConfig(sonic as ChainParam),
  createChainConfig(worldchain as ChainParam),
  createChainConfig(sei as ChainParam),
  createChainConfig(xdc as ChainParam),
  createChainConfig(ink as ChainParam),
  createChainConfig(unichain as ChainParam),
  createChainConfig(hyperEvm as ChainParam),
  createChainConfig(plume as ChainParam),
  createChainConfig(codex as ChainParam),
];

// Chain info for display with explorer URLs
const CHAIN_INFO: Record<number, { name: string; color: string; explorer: string }> = {
  1: { name: "Ethereum", color: "#627EEA", explorer: "https://etherscan.io" },
  42161: { name: "Arbitrum", color: "#28A0F0", explorer: "https://arbiscan.io" },
  8453: { name: "Base", color: "#0052FF", explorer: "https://basescan.org" },
  10: { name: "Optimism", color: "#FF0420", explorer: "https://optimistic.etherscan.io" },
  137: { name: "Polygon", color: "#8247E5", explorer: "https://polygonscan.com" },
  43114: { name: "Avalanche", color: "#E84142", explorer: "https://snowtrace.io" },
  59144: { name: "Linea", color: "#61DFFF", explorer: "https://lineascan.build" },
  146: { name: "Sonic", color: "#1DB954", explorer: "https://sonicscan.org" },
  480: { name: "World Chain", color: "#000000", explorer: "https://worldchain-mainnet.explorer.alchemy.com" },
  1329: { name: "Sei", color: "#9B1C1C", explorer: "https://seiscan.io" },
  50: { name: "XDC", color: "#1B3C6D", explorer: "https://xdcscan.io" },
  57073: { name: "Ink", color: "#7C3AED", explorer: "https://explorer.inkonchain.com" },
  130: { name: "Unichain", color: "#FF007A", explorer: "https://uniscan.xyz" },
  999: { name: "HyperEVM", color: "#00D395", explorer: "https://hyperscan.xyz" },
  98866: { name: "Plume", color: "#8B5CF6", explorer: "https://explorer.plume.org" },
  81224: { name: "Codex", color: "#F59E0B", explorer: "https://explorer.codex.xyz" },
};

// Theme preset options for the selector
const THEME_OPTIONS: { key: keyof typeof themePresets; label: string }[] = [
  { key: "dark", label: "Dark" },
  { key: "light", label: "Light" },
  { key: "blue", label: "Blue" },
  { key: "green", label: "Green" },
];

// Wallet Modal Component
function WalletModal({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { connect, connectors, isPending } = useConnect();

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)",
          borderRadius: "16px",
          padding: "24px",
          minWidth: "320px",
          maxWidth: "400px",
          border: "1px solid rgba(255,255,255,0.1)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <h2
            style={{
              color: "#fff",
              margin: 0,
              fontSize: "18px",
              fontWeight: 600,
            }}
          >
            Connect Wallet
          </h2>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#888",
              fontSize: "24px",
              cursor: "pointer",
              padding: "4px",
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {connectors.map((connector) => (
            <button
              key={connector.uid}
              onClick={() => {
                connect({ connector });
                onClose();
              }}
              disabled={isPending}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "14px 16px",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.1)",
                background: "rgba(255,255,255,0.05)",
                color: "#fff",
                cursor: isPending ? "wait" : "pointer",
                fontSize: "14px",
                fontWeight: 500,
                transition: "all 0.2s",
                textAlign: "left",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.1)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.2)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)";
              }}
            >
              <WalletIcon type={connector.name} />
              <span style={{ flex: 1 }}>{connector.name}</span>
              {isPending && <span style={{ color: "#888" }}>Connecting...</span>}
            </button>
          ))}
        </div>

        <p
          style={{
            color: "#666",
            fontSize: "11px",
            marginTop: "16px",
            marginBottom: 0,
            textAlign: "center",
          }}
        >
          By connecting, you agree to the Terms of Service
        </p>
      </div>
    </div>
  );
}

// Wallet icon based on connector name
function WalletIcon({ type }: { type: string }) {
  const iconStyle = {
    width: "32px",
    height: "32px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
    fontWeight: "bold",
  };

  if (type.toLowerCase().includes("metamask") || type.toLowerCase().includes("injected")) {
    return (
      <div style={{ ...iconStyle, background: "linear-gradient(135deg, #E2761B, #F6851B)" }}>
        🦊
      </div>
    );
  }
  if (type.toLowerCase().includes("walletconnect")) {
    return (
      <div style={{ ...iconStyle, background: "linear-gradient(135deg, #3B99FC, #2B6CB0)" }}>
        🔗
      </div>
    );
  }
  if (type.toLowerCase().includes("coinbase")) {
    return (
      <div style={{ ...iconStyle, background: "linear-gradient(135deg, #0052FF, #0040C8)" }}>
        💰
      </div>
    );
  }
  return (
    <div style={{ ...iconStyle, background: "linear-gradient(135deg, #6366f1, #a855f7)" }}>
      👛
    </div>
  );
}

// Account Info Component
function AccountInfo() {
  const { address, connector } = useAccount();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain, chains } = useSwitchChain();
  const { data: balance, isLoading: isBalanceLoading } = useBalance({ address });
  const [showChainMenu, setShowChainMenu] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const currentChain = CHAIN_INFO[chainId] || { name: "Unknown", color: "#888", explorer: "https://etherscan.io" };

  // Get explorer URL for address
  const getExplorerUrl = (chainId: number, addr: string) => {
    const chain = CHAIN_INFO[chainId];
    const baseUrl = chain?.explorer || "https://etherscan.io";
    return `${baseUrl}/address/${addr}`;
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        marginBottom: "24px",
      }}
    >
      {/* Chain Selector */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowChainMenu(!showChainMenu)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 14px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              background: currentChain.color,
            }}
          />
          {currentChain.name}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showChainMenu && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 50 }}
              onClick={() => setShowChainMenu(false)}
            />
            <div
              style={{
                position: "absolute",
                top: "100%",
                left: 0,
                marginTop: "8px",
                background: "rgba(30, 30, 46, 0.98)",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
                minWidth: "180px",
                zIndex: 100,
                overflow: "hidden",
              }}
            >
              {chains.map((chain) => {
                const info = CHAIN_INFO[chain.id] || { name: chain.name, color: "#888" };
                return (
                  <button
                    key={chain.id}
                    onClick={() => {
                      switchChain({ chainId: chain.id });
                      setShowChainMenu(false);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      width: "100%",
                      padding: "12px 14px",
                      border: "none",
                      background: chainId === chain.id ? "rgba(255,255,255,0.1)" : "transparent",
                      color: "#fff",
                      cursor: "pointer",
                      fontSize: "13px",
                      textAlign: "left",
                    }}
                    onMouseEnter={(e) => {
                      if (chainId !== chain.id) {
                        e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (chainId !== chain.id) {
                        e.currentTarget.style.background = "transparent";
                      }
                    }}
                  >
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        background: info.color,
                      }}
                    />
                    <span style={{ flex: 1 }}>{info.name}</span>
                    {chainId === chain.id && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Account Menu */}
      <div style={{ position: "relative" }}>
        <button
          onClick={() => setShowAccountMenu(!showAccountMenu)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 14px",
            borderRadius: "12px",
            border: "1px solid rgba(255,255,255,0.15)",
            background: "rgba(255,255,255,0.05)",
            color: "#fff",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: 500,
          }}
        >
          <WalletIcon type={connector?.name || ""} />
          <div style={{ textAlign: "left" }}>
            <div style={{ fontFamily: "monospace", fontSize: "13px" }}>
              {address?.slice(0, 6)}...{address?.slice(-4)}
            </div>
            {isBalanceLoading ? (
              <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                Loading...
              </div>
            ) : balance ? (
              <div style={{ fontSize: "11px", color: "#888", marginTop: "2px" }}>
                {(Number(balance.value) / 10 ** balance.decimals).toFixed(4)} {balance.symbol}
              </div>
            ) : null}
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {showAccountMenu && (
          <>
            <div
              style={{ position: "fixed", inset: 0, zIndex: 50 }}
              onClick={() => setShowAccountMenu(false)}
            />
            <div
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                marginTop: "8px",
                background: "rgba(30, 30, 46, 0.98)",
                borderRadius: "12px",
                border: "1px solid rgba(255,255,255,0.1)",
                boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
                minWidth: "200px",
                zIndex: 100,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "14px",
                  borderBottom: "1px solid rgba(255,255,255,0.1)",
                }}
              >
                <div style={{ fontSize: "11px", color: "#888", marginBottom: "4px" }}>
                  Connected with {connector?.name}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: "12px", color: "#fff" }}>
                  {address}
                </div>
              </div>

              <button
                onClick={() => {
                  navigator.clipboard.writeText(address || "");
                  setShowAccountMenu(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "12px 14px",
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "13px",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span>📋</span>
                <span>Copy Address</span>
              </button>

              <button
                onClick={() => {
                  const explorerUrl = getExplorerUrl(chainId, address || "");
                  window.open(explorerUrl, "_blank");
                  setShowAccountMenu(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  width: "100%",
                  padding: "12px 14px",
                  border: "none",
                  background: "transparent",
                  color: "#fff",
                  cursor: "pointer",
                  fontSize: "13px",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "transparent";
                }}
              >
                <span>🔗</span>
                <span>View on Explorer</span>
              </button>

              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
                <button
                  onClick={() => {
                    disconnect();
                    setShowAccountMenu(false);
                  }}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    width: "100%",
                    padding: "12px 14px",
                    border: "none",
                    background: "transparent",
                    color: "#ef4444",
                    cursor: "pointer",
                    fontSize: "13px",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = "rgba(239,68,68,0.1)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span>🚪</span>
                  <span>Disconnect</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Connect Wallet Button
function ConnectButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "12px 20px",
        borderRadius: "12px",
        border: "none",
        background: "linear-gradient(135deg, #6366f1 0%, #a855f7 100%)",
        color: "#fff",
        cursor: "pointer",
        fontSize: "14px",
        fontWeight: 600,
        marginBottom: "24px",
        boxShadow: "0 4px 14px rgba(99, 102, 241, 0.4)",
      }}
    >
      <span>👛</span>
      Connect Wallet
    </button>
  );
}

// Theme Selector Component
function ThemeSelector({
  selectedTheme,
  onSelect,
}: {
  selectedTheme: keyof typeof themePresets;
  onSelect: (theme: keyof typeof themePresets) => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        gap: "8px",
        marginBottom: "24px",
      }}
    >
      {THEME_OPTIONS.map((option) => (
        <button
          key={option.key}
          onClick={() => onSelect(option.key)}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border:
              selectedTheme === option.key
                ? "2px solid #6366f1"
                : "1px solid rgba(255,255,255,0.15)",
            background:
              selectedTheme === option.key
                ? "rgba(99, 102, 241, 0.2)"
                : "rgba(255,255,255,0.05)",
            color: selectedTheme === option.key ? "#fff" : "#888",
            cursor: "pointer",
            fontSize: "13px",
            fontWeight: selectedTheme === option.key ? 600 : 400,
            transition: "all 0.2s",
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function BridgeDemo() {
  const { isConnected } = useAccount();
  const [showWalletModal, setShowWalletModal] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<keyof typeof themePresets>("dark");

  // Get the current theme based on selection
  const currentTheme: BridgeWidgetTheme = themePresets[selectedTheme];

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f0f23 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "20px",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <h1
        style={{
          color: "#fff",
          marginBottom: "8px",
          fontSize: "28px",
          fontWeight: 700,
        }}
      >
        USDC Bridge Widget Demo
      </h1>
      <p
        style={{
          color: "#888",
          marginBottom: "24px",
          fontSize: "14px",
        }}
      >
        Cross-chain USDC transfers powered by Circle CCTP
      </p>

      {isConnected ? (
        <AccountInfo />
      ) : (
        <ConnectButton onClick={() => setShowWalletModal(true)} />
      )}

      {/* Theme Selector */}
      <ThemeSelector selectedTheme={selectedTheme} onSelect={setSelectedTheme} />

      <BridgeWidget
        chains={DEMO_CHAIN_CONFIGS}
        defaultSourceChainId={1}
        defaultDestinationChainId={8453}
        onConnectWallet={() => setShowWalletModal(true)}
        onBridgeStart={(params) => {
          console.log("Bridge started:", params);
        }}
        onBridgeSuccess={(params) => {
          console.log("Bridge success:", params);
          alert(`Bridge successful! TX: ${params.txHash}`);
        }}
        onBridgeError={(error) => {
          console.error("Bridge error:", error);
        }}
        enablePersistence={true}
        onPendingBridgeDetected={(bridges) => {
          console.log("Pending bridges detected:", bridges);
        }}
        onRecoveryComplete={(params) => {
          console.log("Recovery complete:", params);
          alert(`Recovery successful! ${params.amount} USDC bridged`);
        }}
        onRecoveryError={(error) => {
          console.error("Recovery error:", error);
        }}
        theme={currentTheme}
      />

      <div
        style={{
          marginTop: "24px",
          display: "flex",
          gap: "16px",
          fontSize: "12px",
        }}
      >
        <a
          href="https://github.com/anthropics/usdc-bridge-widget"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#888", textDecoration: "none" }}
        >
          GitHub
        </a>
        <a
          href="https://developers.circle.com/stablecoins/docs/cctp-getting-started"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#888", textDecoration: "none" }}
        >
          CCTP Docs
        </a>
      </div>

      <WalletModal isOpen={showWalletModal} onClose={() => setShowWalletModal(false)} />
    </div>
  );
}

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <BridgeDemo />
      </QueryClientProvider>
    </WagmiProvider>
  );
}

export default App;
