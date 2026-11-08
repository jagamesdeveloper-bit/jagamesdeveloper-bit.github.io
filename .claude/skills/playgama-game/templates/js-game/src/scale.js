// "Expand" scaling (guide: Responsive layout): the design rectangle is always fully visible and the world
// extends into the extra space on the long side - no bars, no stretching, any aspect ratio incl. 1:1.
import { CONFIG } from './config.js';

export function createView(canvas, onResize) {
  const view = { w: 0, h: 0, dpr: 1, scale: 1, vw: CONFIG.designWidth, vh: CONFIG.designHeight };

  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    view.w = Math.max(1, Math.round(box.width));
    view.h = Math.max(1, Math.round(box.height));
    view.dpr = Math.min(window.devicePixelRatio || 1, CONFIG.maxDpr);
    view.scale = Math.min(view.w / CONFIG.designWidth, view.h / CONFIG.designHeight);
    view.vw = view.w / view.scale;     // visible world size in design units
    view.vh = view.h / view.scale;
    canvas.width = Math.round(view.w * view.dpr);
    canvas.height = Math.round(view.h * view.dpr);
    onResize?.(view);                  // re-layout in place; never restart the scene (1.7.1, 3.2.3)
  }

  new ResizeObserver(resize).observe(canvas.parentElement);
  addEventListener('orientationchange', resize);
  resize();
  return view;
}

/** World origin = screen centre; x in [-vw/2, vw/2], y in [-vh/2, vh/2]. */
export function applyWorld(ctx, view) {
  const k = view.dpr * view.scale;
  ctx.setTransform(k, 0, 0, k, (view.w * view.dpr) / 2, (view.h * view.dpr) / 2);
}
