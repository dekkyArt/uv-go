/**
 * The container of the fixed layers (the live sky, the pinned bar, the toolbar): a sibling of
 * `[data-page]`, never inside it. The page scales back under an open sheet, and a transformed
 * ancestor would re-anchor anything `position: fixed` to the whole document. The sheet makes this
 * container inert together with the page. Created on first use, after the page in `<body>`.
 */
export function fixedLayers(): HTMLElement {
  let el = document.querySelector<HTMLElement>('[data-fixed-layers]');
  if (el === null) {
    el = document.createElement('div');
    el.setAttribute('data-fixed-layers', '');
    document.body.append(el);
  }
  return el;
}
