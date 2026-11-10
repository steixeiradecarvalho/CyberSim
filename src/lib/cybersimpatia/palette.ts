/** Keep in sync with the @theme tokens in src/styles.css. Canvas cannot read utilities. */
export const PALETTE = {
  ink: "#07090c",
  panel: "#12171c",
  bone: "#e7e2d4",
  mute: "#8d968c",
  flow: "#3dcaa8",
  tension: "#e4a15a",
  mediate: "#d4c4a8",
  line: "#2c3834",
} as const;

export const RGB = {
  ink: [7, 9, 12],
  flow: [61, 202, 168],
  tension: [228, 161, 90],
  bone: [231, 226, 212],
  mediate: [212, 196, 168],
} as const;
