import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import {
  ChevronDownIcon,
  SwapIcon,
  SpinnerIcon,
  CheckIcon,
  ErrorIcon,
  ExternalLinkIcon,
  WalletIcon,
} from "../icons";

describe("ChevronDownIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<ChevronDownIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("applies default size", () => {
    const { container } = render(<ChevronDownIcon />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("16");
    expect(svg?.getAttribute("height")).toBe("16");
  });

  it("applies custom size", () => {
    const { container } = render(<ChevronDownIcon size={24} />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("24");
    expect(svg?.getAttribute("height")).toBe("24");
  });

  it("applies custom color", () => {
    const { container } = render(<ChevronDownIcon color="#ff0000" />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("stroke")).toBe("#ff0000");
  });

  it("applies custom style", () => {
    const { container } = render(
      <ChevronDownIcon style={{ opacity: 0.5 }} />
    );
    const svg = container.querySelector("svg");
    expect(svg?.style.opacity).toBe("0.5");
  });
});

describe("SwapIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<SwapIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("has default size of 20", () => {
    const { container } = render(<SwapIcon />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("20");
  });
});

describe("SpinnerIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<SpinnerIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("has animation style", () => {
    const { container } = render(<SpinnerIcon />);
    const svg = container.querySelector("svg");
    expect(svg?.style.animation).toContain("spin");
  });
});

describe("CheckIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<CheckIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("has check path", () => {
    const { container } = render(<CheckIcon />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).toContain("5 13");
  });
});

describe("ErrorIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<ErrorIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("has X path", () => {
    const { container } = render(<ErrorIcon />);
    const path = container.querySelector("path");
    expect(path?.getAttribute("d")).toContain("6 18");
  });
});

describe("ExternalLinkIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<ExternalLinkIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("has default size of 16", () => {
    const { container } = render(<ExternalLinkIcon />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("16");
  });
});

describe("WalletIcon", () => {
  it("renders an SVG element", () => {
    const { container } = render(<WalletIcon />);
    const svg = container.querySelector("svg");
    expect(svg).toBeDefined();
  });

  it("has default size of 20", () => {
    const { container } = render(<WalletIcon />);
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("width")).toBe("20");
  });
});

describe("All icons", () => {
  const icons = [
    { Component: ChevronDownIcon, name: "ChevronDownIcon" },
    { Component: SwapIcon, name: "SwapIcon" },
    { Component: SpinnerIcon, name: "SpinnerIcon" },
    { Component: CheckIcon, name: "CheckIcon" },
    { Component: ErrorIcon, name: "ErrorIcon" },
    { Component: ExternalLinkIcon, name: "ExternalLinkIcon" },
    { Component: WalletIcon, name: "WalletIcon" },
  ];

  icons.forEach(({ Component, name }) => {
    it(`${name} is accessible (aria-hidden)`, () => {
      const { container } = render(<Component />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("aria-hidden")).toBe("true");
    });

    it(`${name} uses currentColor by default`, () => {
      const { container } = render(<Component />);
      const svg = container.querySelector("svg");
      expect(svg?.getAttribute("stroke")).toBe("currentColor");
    });
  });
});
