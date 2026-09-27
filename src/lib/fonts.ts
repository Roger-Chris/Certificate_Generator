/**
 * Google Fonts available for certificate text. Each entry's `spec` is the css2 family
 * query — it must only request weights/styles the family actually ships, or Google
 * rejects the whole stylesheet, which is why every family gets its own <link>.
 */
export const FONTS: { family: string; spec: string; weights: number[]; italic: boolean }[] = [
  { family: "Lora", spec: "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700", weights: [400, 500, 600, 700], italic: true },
  { family: "Playfair Display", spec: "Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;1,400;1,700", weights: [400, 600, 700, 800], italic: true },
  { family: "Montserrat", spec: "Montserrat:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700", weights: [400, 500, 600, 700], italic: true },
  { family: "Poppins", spec: "Poppins:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700", weights: [400, 500, 600, 700], italic: true },
  { family: "Hanken Grotesk", spec: "Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700", weights: [400, 500, 600, 700], italic: true },
  { family: "Open Sans", spec: "Open+Sans:ital,wght@0,400;0,600;0,700;1,400;1,700", weights: [400, 600, 700], italic: true },
  { family: "Roboto", spec: "Roboto:ital,wght@0,400;0,500;0,700;1,400;1,700", weights: [400, 500, 700], italic: true },
  { family: "Merriweather", spec: "Merriweather:ital,wght@0,400;0,700;1,400;1,700", weights: [400, 700], italic: true },
  { family: "EB Garamond", spec: "EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700", weights: [400, 600, 700], italic: true },
  { family: "Cormorant Garamond", spec: "Cormorant+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700", weights: [400, 600, 700], italic: true },
  { family: "Libre Baskerville", spec: "Libre+Baskerville:ital,wght@0,400;0,700;1,400", weights: [400, 700], italic: true },
  { family: "Cinzel", spec: "Cinzel:wght@400;600;700", weights: [400, 600, 700], italic: false },
  { family: "DM Serif Display", spec: "DM+Serif+Display:ital@0;1", weights: [400], italic: true },
  { family: "Great Vibes", spec: "Great+Vibes", weights: [400], italic: false },
  { family: "Alex Brush", spec: "Alex+Brush", weights: [400], italic: false },
];

export const fontHref = (spec: string) => `https://fonts.googleapis.com/css2?family=${spec}&display=block`;
