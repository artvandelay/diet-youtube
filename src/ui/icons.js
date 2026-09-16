export function svg(path, size = 20) {
  return `<svg viewBox="0 0 24 24" width="${size}" height="${size}" aria-hidden="true" fill="currentColor">${path}</svg>`;
}

export const ICONS = {
  sliders: `<path d="M3 6h10v2H3V6zm0 10h6v2H3v-2zm8 2v-2h10v2H11zM21 8h-6V6h6v2zM9 11H3v2h6v2l3-3-3-3v2zm12 0h-8v2h8v-2z"/>`,
  close: `<path d="M18.3 5.71 12 12.01l-6.3-6.3-1.4 1.41 6.29 6.29-6.3 6.3 1.42 1.4 6.29-6.29 6.3 6.3 1.4-1.42-6.29-6.29 6.3-6.3z"/>`,
  pencil: `<path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 0 0 0-1.41l-2.34-2.34a1 1 0 0 0-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>`,
  check: `<path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>`,
};
