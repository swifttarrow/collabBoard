/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { DraftShapesLayer } from "../DraftShapesLayer";

vi.mock("react-konva", () => ({
  Rect: ({
    x,
    y,
    width,
    height,
  }: {
    x?: number;
    y?: number;
    width?: number;
    height?: number;
  }) => (
    <div
      data-kind="rect"
      data-x={String(x)}
      data-y={String(y)}
      data-width={String(width)}
      data-height={String(height)}
    />
  ),
  Line: ({ points }: { points?: number[] }) => (
    <div data-kind="line" data-points={points?.join(",")} />
  ),
}));

describe("DraftShapesLayer", () => {
  it("renders nothing when all drafts are null", () => {
    const { container } = render(
      <DraftShapesLayer
        shapeDraft={null}
        boxSelectDraft={null}
        lineCreationDraft={null}
      />
    );
    expect(container.querySelector("[data-x], [data-points]")).toBeNull();
  });

  it("renders draft rect when shapeDraft is rect", () => {
    const { container } = render(
      <DraftShapesLayer
        shapeDraft={{
          type: "rect",
          bounds: { x: 10, y: 20, width: 100, height: 80 },
        }}
        boxSelectDraft={null}
        lineCreationDraft={null}
      />
    );
    const rect = container.querySelector('[data-kind="rect"]');
    expect(rect).toBeInTheDocument();
    expect(rect).toHaveAttribute("data-x", "10");
    expect(rect).toHaveAttribute("data-y", "20");
    expect(rect).toHaveAttribute("data-width", "100");
    expect(rect).toHaveAttribute("data-height", "80");
  });

  it("renders draft circle when shapeDraft is circle", () => {
    const { container } = render(
      <DraftShapesLayer
        shapeDraft={{
          type: "circle",
          bounds: { x: 0, y: 0, width: 60, height: 60 },
        }}
        boxSelectDraft={null}
        lineCreationDraft={null}
      />
    );
    const rects = container.querySelectorAll('[data-kind="rect"]');
    expect(rects).toHaveLength(1);
    // Circle: center (30,30), size 60 -> rect at (0,0) 60x60
    expect(rects[0]).toHaveAttribute("data-x", "0");
    expect(rects[0]).toHaveAttribute("data-width", "60");
  });

  it("renders box select draft", () => {
    const { container } = render(
      <DraftShapesLayer
        shapeDraft={null}
        boxSelectDraft={{ x: 5, y: 10, width: 50, height: 30 }}
        lineCreationDraft={null}
      />
    );
    const rect = container.querySelector('[data-kind="rect"]');
    expect(rect).toHaveAttribute("data-x", "5");
    expect(rect).toHaveAttribute("data-y", "10");
    expect(rect).toHaveAttribute("data-width", "50");
    expect(rect).toHaveAttribute("data-height", "30");
  });

  it("renders draft line when shapeDraft is line", () => {
    const { container } = render(
      <DraftShapesLayer
        shapeDraft={{
          type: "line",
          bounds: { x1: 0, y1: 0, x2: 100, y2: 50 },
        }}
        boxSelectDraft={null}
        lineCreationDraft={null}
      />
    );
    const line = container.querySelector('[data-kind="line"]');
    expect(line).toHaveAttribute("data-points", "0,0,100,50");
  });

  it("renders line creation draft", () => {
    const { container } = render(
      <DraftShapesLayer
        shapeDraft={null}
        boxSelectDraft={null}
        lineCreationDraft={{
          startX: 10,
          startY: 20,
          endX: 110,
          endY: 70,
        }}
      />
    );
    const line = container.querySelector('[data-kind="line"]');
    expect(line).toHaveAttribute("data-points", "10,20,110,70");
  });
});
