/**
 * Google Fonts available in the editor. Each entry's `spec` is the css2 family query — it must only
 * request weights/styles the family actually ships, or Google rejects the stylesheet, which is why
 * every family gets its own <link>.
 */
export const FONTS: { family: string; spec: string; weights: number[]; italic: boolean; category: string }[] = [
  { family: "Lora", spec: "Lora:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700", weights: [400, 500, 600, 700], italic: true, category: "Serif" },
  { family: "Playfair Display", spec: "Playfair+Display:ital,wght@0,400;0,600;0,700;0,800;0,900;1,400;1,700", weights: [400, 600, 700, 800, 900], italic: true, category: "Serif" },
  { family: "Merriweather", spec: "Merriweather:ital,wght@0,400;0,700;0,900;1,400;1,700", weights: [400, 700, 900], italic: true, category: "Serif" },
  { family: "EB Garamond", spec: "EB+Garamond:ital,wght@0,400;0,600;0,700;1,400;1,700", weights: [400, 600, 700], italic: true, category: "Serif" },
  { family: "Cormorant Garamond", spec: "Cormorant+Garamond:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700", weights: [400, 500, 600, 700], italic: true, category: "Serif" },
  { family: "Libre Baskerville", spec: "Libre+Baskerville:ital,wght@0,400;0,700;1,400", weights: [400, 700], italic: true, category: "Serif" },
  { family: "DM Serif Display", spec: "DM+Serif+Display:ital@0;1", weights: [400], italic: true, category: "Serif" },
  { family: "Cinzel", spec: "Cinzel:wght@400;600;700;900", weights: [400, 600, 700, 900], italic: false, category: "Serif" },
  { family: "Montserrat", spec: "Montserrat:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700", weights: [300, 400, 500, 600, 700, 800], italic: true, category: "Sans" },
  { family: "Poppins", spec: "Poppins:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400;1,700", weights: [300, 400, 500, 600, 700, 800], italic: true, category: "Sans" },
  { family: "Hanken Grotesk", spec: "Hanken+Grotesk:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700", weights: [400, 500, 600, 700], italic: true, category: "Sans" },
  { family: "Inter", spec: "Inter:ital,wght@0,400;0,500;0,600;0,700;1,400;1,700", weights: [400, 500, 600, 700], italic: true, category: "Sans" },
  { family: "Roboto", spec: "Roboto:ital,wght@0,400;0,500;0,700;1,400;1,700", weights: [400, 500, 700], italic: true, category: "Sans" },
  { family: "Open Sans", spec: "Open+Sans:ital,wght@0,400;0,600;0,700;1,400;1,700", weights: [400, 600, 700], italic: true, category: "Sans" },
  { family: "Oswald", spec: "Oswald:wght@400;500;600;700", weights: [400, 500, 600, 700], italic: false, category: "Display" },
  { family: "Russo One", spec: "Russo+One", weights: [400], italic: false, category: "Display" },
  { family: "Audiowide", spec: "Audiowide", weights: [400], italic: false, category: "Display" },
  { family: "Bebas Neue", spec: "Bebas+Neue", weights: [400], italic: false, category: "Display" },
  { family: "Anton", spec: "Anton", weights: [400], italic: false, category: "Display" },
  { family: "Space Mono", spec: "Space+Mono:ital,wght@0,400;0,700;1,400", weights: [400, 700], italic: true, category: "Mono" },
  { family: "Great Vibes", spec: "Great+Vibes", weights: [400], italic: false, category: "Script" },
  { family: "Alex Brush", spec: "Alex+Brush", weights: [400], italic: false, category: "Script" },
  { family: "Dancing Script", spec: "Dancing+Script:wght@400;700", weights: [400, 700], italic: false, category: "Script" },
];

export const fontHref = (spec: string) => `https://fonts.googleapis.com/css2?family=${spec}&display=block`;
