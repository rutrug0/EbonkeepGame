type TooltipOverlayPosition = {
  left: number;
  top: number;
};

type TooltipOverlaySizing = {
  width: number;
  estimatedHeight: number;
  cursorOffset?: number;
  viewportPadding?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function buildTooltipPositionFromPointer(
  clientX: number,
  clientY: number,
  sizing: TooltipOverlaySizing
): TooltipOverlayPosition {
  const cursorOffset = sizing.cursorOffset ?? 18;
  const viewportPadding = sizing.viewportPadding ?? 16;
  const hasRoomOnRight = window.innerWidth - clientX >= sizing.width + viewportPadding;
  const left = hasRoomOnRight
    ? Math.min(window.innerWidth - viewportPadding - sizing.width, clientX + cursorOffset)
    : Math.max(viewportPadding, clientX - cursorOffset - sizing.width);
  const top = clamp(
    clientY,
    viewportPadding + sizing.estimatedHeight / 2,
    window.innerHeight - viewportPadding - sizing.estimatedHeight / 2
  );

  return { left, top };
}

export function buildTooltipPositionFromElement(
  target: HTMLElement,
  sizing: TooltipOverlaySizing
): TooltipOverlayPosition {
  const cursorOffset = sizing.cursorOffset ?? 18;
  const viewportPadding = sizing.viewportPadding ?? 16;
  const rect = target.getBoundingClientRect();
  const hasRoomOnRight = window.innerWidth - rect.right >= sizing.width + viewportPadding;
  const left = hasRoomOnRight
    ? Math.min(window.innerWidth - viewportPadding - sizing.width, rect.right + cursorOffset)
    : Math.max(viewportPadding, rect.left - cursorOffset - sizing.width);
  const top = clamp(
    rect.top + rect.height / 2,
    viewportPadding + sizing.estimatedHeight / 2,
    window.innerHeight - viewportPadding - sizing.estimatedHeight / 2
  );

  return { left, top };
}

export type { TooltipOverlayPosition, TooltipOverlaySizing };
