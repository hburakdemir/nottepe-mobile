// Web'deki constants/Avatarconfig.js portu — tüm avatar sabitleri burada.
// Pixel-art SVG avatar: her parça bir dikdörtgen (rect) listesi, 32x40 grid üzerinde.

export const BG_COLORS = [
  '#454040',
  '#1B0C0C',
  '#576A8F',
  '#ACBAC4',
  '#E8EDF2',
  '#EDE9E6',
  '#6FCF97',
  '#1F6F5F',
  '#F8DE22',
  '#2F2FE4',
  '#28396C',
  '#FF3E9B',
  '#FF88BA',
  '#8F0177',
  '#612D53',
  '#982598',
  '#E6501B',
  '#C3110C',
  '#740A03',
  '#C00707',
  '#0f172a',
  '#1e293b',
  '#064e3b',
  '#422006',
];

export const SKIN_COLORS = [
  '#FDDBB4',
  '#F5CBA7',
  '#F1C27D',
  '#FFCBA4',
  '#FFB347',
  '#E0AC69',
  '#C68642',
  '#D4956A',
  '#A0522D',
  '#8D5524',
  '#5C3317',
  '#4a2511',
  '#7B3F00',
  '#3d1c02',
  '#f9e4d4',
  '#D9B99B',
  '#C4A882',
  '#b07d4a',
  '#9a6b3a',
  '#6b3d1e',
];

export const HAIR_COLORS = [
  '#1a1a1a',
  '#2c3e50',
  '#2c1e0f',
  '#4a2c2a',
  '#6b3a2a',
  '#8B4513',
  '#A0522D',
  '#C17817',
  '#D4A017',
  '#deb887',
  '#F5CBA7',
  '#e8d5b7',
  '#fffdd0',
  '#808080',
  '#a8a8a8',
  '#d4d4d4',
  '#FF4500',
  '#c0392b',
  '#e91e8c',
  '#9b59b6',
  '#2F2FE4',
  '#FF3737',
  '#c0392b',
  '#FF0000',
];

export const BROW_COLORS = [
  '#1a1a1a',
  '#2c1e0f',
  '#4a2c2a',
  '#6b3a2a',
  '#8B4513',
  '#A0522D',
  '#C17817',
  '#808080',
  '#a8a8a8',
  '#FF4500',
  '#c0392b',
  '#9b59b6',
  '#2F2FE4',
  '#e91e8c',
  '#D50000',
  '#5E0006',
  '#7B0008',
  '#9A000A',
  '#BB000C',
];

export const BEARD_COLORS = [
  '#1a1a1a',
  '#2c1e0f',
  '#4a2c2a',
  '#6b3a2a',
  '#8B4513',
  '#A0522D',
  '#C17817',
  '#808080',
  '#a8a8a8',
  '#d4d4d4',
  '#FF4500',
  '#c0392b',
  '#2c3e50',
  '#2F2FE4',
  '#FF3E9B',
  '#5E0006',
  '#7B0008',
  '#9A000A',
  '#BB000C',
  '#D50000',
];

export const EYE_COLORS = [
  '#1a1a1a',
  '#2563eb',
  '#1d4ed8',
  '#059669',
  '#065f46',
  '#92400e',
  '#7c3aed',
  '#b45309',
  '#6b7280',
  '#dc2626',
  '#0ea5e9',
  '#84cc16',
  '#FF0000',
];

export const LIP_COLORS = [
  '#CAAA98',
  '#ffffff',
  '#000000',
  '#E0AC69',
  '#C68642',
  '#D4956A',
  '#d4756a',
  '#c0392b',
  '#e74c3c',
  '#f39c12',
  '#e91e8c',
  '#9b59b6',
  '#ff6b9d',
  '#ff8fab',
  '#c2185b',
  '#ad1457',
  '#880e4f',
  '#b71c1c',
  '#f06292',
  '#f48fb1',
  '#ffb3ba',
  '#8d1b3d',
  '#5d0e2b',
  '#ff1744',
  '#d50000',
];

export const OUTFIT_COLORS = [
  '#1e3a5f',
  '#2F5755',
  '#7c1d1d',
  '#4a1d96',
  '#1a1a2e',
  '#ec4899',
  '#f97316',
  '#0ea5e9',
  '#84cc16',
  '#64748b',
  '#ffffff',
  '#fef3c7',
  '#fce7f3',
  '#d1fae5',
  '#e0e7ff',
  '#111827',
  '#7f1d1d',
  '#365314',
  '#1e1b4b',
  '#831843',
];

export const OUTFIT_PATTERN_COLORS = [
  '#ffffff',
  '#f8f8f8',
  '#1a1a1a',
  '#e11d48',
  '#2563eb',
  '#16a34a',
  '#d97706',
  '#7c3aed',
  '#0891b2',
  '#be123c',
  '#fbbf24',
  '#34d399',
  '#f472b6',
  '#a3e635',
  '#c4b5fd',
];

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
  c?: string;
  rx?: number;
  type?: 'text' | 'image';
  fontSize?: number;
  content?: string;
  href?: string;
}

export const FACES: Rect[][] = [
  [{ x: 8, y: 7, w: 16, h: 16 }],
  [
    { x: 10, y: 6, w: 12, h: 1 },
    { x: 8, y: 7, w: 16, h: 14 },
    { x: 10, y: 21, w: 12, h: 1 },
  ],
  [
    { x: 10, y: 5, w: 12, h: 1 },
    { x: 9, y: 6, w: 14, h: 16 },
    { x: 10, y: 22, w: 12, h: 1 },
  ],
  [
    { x: 12, y: 6, w: 8, h: 1 },
    { x: 10, y: 7, w: 12, h: 2 },
    { x: 8, y: 9, w: 16, h: 8 },
    { x: 10, y: 17, w: 12, h: 2 },
    { x: 12, y: 19, w: 8, h: 1 },
  ],
  [{ x: 7, y: 8, w: 18, h: 14 }],
  [
    { x: 8, y: 7, w: 6, h: 2 },
    { x: 18, y: 7, w: 6, h: 2 },
    { x: 7, y: 9, w: 18, h: 10 },
    { x: 9, y: 19, w: 14, h: 2 },
    { x: 11, y: 21, w: 10, h: 1 },
    { x: 13, y: 22, w: 6, h: 1 },
  ],
  [
    { x: 11, y: 6, w: 10, h: 2 },
    { x: 8, y: 8, w: 16, h: 12 },
    { x: 11, y: 20, w: 10, h: 2 },
  ],
  [
    { x: 14, y: 6, w: 4, h: 2 },
    { x: 12, y: 8, w: 8, h: 2 },
    { x: 10, y: 10, w: 12, h: 2 },
    { x: 8, y: 12, w: 16, h: 8 },
  ],
  [{ x: 10, y: 8, w: 12, h: 12 }],
  [{ x: 11, y: 5, w: 10, h: 20 }],
  [
    { x: 9, y: 5, w: 14, h: 2 },
    { x: 8, y: 7, w: 16, h: 14 },
  ],
  [
    { x: 9, y: 6, w: 14, h: 1 },
    { x: 8, y: 7, w: 16, h: 13 },
    { x: 9, y: 20, w: 14, h: 1 },
  ],
  [
    { x: 10, y: 6, w: 12, h: 10 },
    { x: 9, y: 16, w: 14, h: 4 },
    { x: 11, y: 20, w: 10, h: 2 },
    { x: 13, y: 22, w: 6, h: 1 },
  ],
  [
    { x: 8, y: 6, w: 16, h: 8 },
    { x: 9, y: 14, w: 14, h: 4 },
    { x: 11, y: 18, w: 10, h: 2 },
    { x: 13, y: 20, w: 6, h: 1 },
  ],
  [
    { x: 7, y: 8, w: 18, h: 12 },
    { x: 8, y: 7, w: 16, h: 1 },
    { x: 8, y: 20, w: 16, h: 1 },
  ],
];

export const HAIR_STYLES: (Rect[] | null)[] = [
  [],
  [{ x: 8, y: 4, w: 16, h: 5 }],
  [
    { x: 7, y: 3, w: 18, h: 6 },
    { x: 6, y: 9, w: 2, h: 4 },
    { x: 24, y: 9, w: 2, h: 4 },
  ],
  [
    { x: 7, y: 3, w: 18, h: 6 },
    { x: 5, y: 9, w: 3, h: 9 },
    { x: 24, y: 9, w: 3, h: 9 },
  ],
  [
    { x: 14, y: 1, w: 4, h: 9 },
    { x: 8, y: 5, w: 6, h: 5 },
    { x: 18, y: 5, w: 6, h: 5 },
  ],
  [
    { x: 8, y: 3, w: 16, h: 8 },
    { x: 6, y: 7, w: 2, h: 3 },
    { x: 24, y: 7, w: 2, h: 3 },
  ],
  [
    { x: 8, y: 5, w: 2, h: 5 },
    { x: 11, y: 2, w: 2, h: 8 },
    { x: 15, y: 1, w: 2, h: 8 },
    { x: 19, y: 2, w: 2, h: 8 },
    { x: 22, y: 5, w: 2, h: 5 },
  ],
  [
    { x: 6, y: 3, w: 20, h: 9 },
    { x: 4, y: 7, w: 4, h: 5 },
    { x: 24, y: 7, w: 4, h: 5 },
    { x: 7, y: 2, w: 18, h: 2 },
  ],
  [
    { x: 7, y: 3, w: 18, h: 6 },
    { x: 5, y: 8, w: 3, h: 5 },
    { x: 7, y: 3, w: 4, h: 8 },
  ],
  [
    { x: 8, y: 3, w: 16, h: 6 },
    { x: 25, y: 7, w: 3, h: 10 },
  ],
  [
    { x: 7, y: 3, w: 18, h: 6 },
    { x: 5, y: 9, w: 4, h: 20 },
    { x: 23, y: 9, w: 4, h: 20 },
  ],
  [
    { x: 7, y: 3, w: 18, h: 6 },
    { x: 5, y: 9, w: 3, h: 12 },
    { x: 4, y: 21, w: 4, h: 6 },
    { x: 24, y: 9, w: 3, h: 12 },
    { x: 24, y: 21, w: 4, h: 6 },
    { x: 5, y: 27, w: 3, h: 3 },
    { x: 24, y: 27, w: 3, h: 3 },
  ],
  [
    { x: 7, y: 3, w: 18, h: 7 },
    { x: 5, y: 10, w: 3, h: 8 },
    { x: 4, y: 18, w: 4, h: 6 },
    { x: 3, y: 24, w: 3, h: 4 },
    { x: 24, y: 10, w: 3, h: 8 },
    { x: 24, y: 18, w: 4, h: 6 },
    { x: 26, y: 24, w: 3, h: 4 },
  ],
  [
    { x: 7, y: 3, w: 18, h: 6 },
    { x: 5, y: 9, w: 3, h: 3 },
    { x: 4, y: 12, w: 3, h: 3 },
    { x: 5, y: 15, w: 3, h: 3 },
    { x: 4, y: 18, w: 3, h: 3 },
    { x: 5, y: 21, w: 3, h: 3 },
    { x: 4, y: 24, w: 3, h: 3 },
    { x: 24, y: 9, w: 3, h: 3 },
    { x: 25, y: 12, w: 3, h: 3 },
    { x: 24, y: 15, w: 3, h: 3 },
    { x: 25, y: 18, w: 3, h: 3 },
    { x: 24, y: 21, w: 3, h: 3 },
    { x: 25, y: 24, w: 3, h: 3 },
  ],
  [
    { x: 7, y: 3, w: 18, h: 6 },
    { x: 5, y: 9, w: 3, h: 8 },
    { x: 24, y: 9, w: 3, h: 8 },
    { x: 6, y: 17, w: 20, h: 2 },
  ],
  [
    { x: 7, y: 3, w: 18, h: 6 },
    { x: 5, y: 9, w: 3, h: 6 },
    { x: 24, y: 9, w: 3, h: 6 },
    { x: 5, y: 15, w: 22, h: 1 },
  ],
  [
    { x: 9, y: 4, w: 14, h: 4 },
    { x: 8, y: 5, w: 16, h: 3 },
    { x: 6, y: 8, w: 2, h: 2 },
    { x: 24, y: 8, w: 2, h: 2 },
  ],
  [
    { x: 7, y: 3, w: 18, h: 6 },
    { x: 5, y: 9, w: 4, h: 14 },
    { x: 23, y: 9, w: 4, h: 14 },
    { x: 12, y: 1, w: 8, h: 5 },
  ],
  [
    { x: 7, y: 3, w: 18, h: 6 },
    { x: 22, y: 1, w: 6, h: 6 },
  ],
  [
    { x: 8, y: 5, w: 16, h: 4 },
    { x: 13, y: 1, w: 6, h: 5 },
  ],
];

type EyeStyleFn = (skinColor: string, eyeColor: string) => Rect[];
export const EYE_STYLES: EyeStyleFn[] = [
  (sk, ec) => [
    { x: 11, y: 14, w: 2, h: 2 },
    { x: 19, y: 14, w: 2, h: 2 },
  ],
  (sk, ec) => [
    { x: 10, y: 13, w: 4, h: 3, c: ec },
    { x: 18, y: 13, w: 4, h: 3, c: ec },
    { x: 11, y: 14, w: 2, h: 1, c: '#fff' },
    { x: 19, y: 14, w: 2, h: 1, c: '#fff' },
  ],
  (sk, ec) => [
    { x: 10, y: 14, w: 4, h: 1, c: ec },
    { x: 18, y: 14, w: 4, h: 1, c: ec },
  ],
  (sk, ec) => [
    { x: 10, y: 14, w: 4, h: 2, c: ec },
    { x: 18, y: 14, w: 4, h: 2, c: ec },
    { x: 11, y: 13, w: 2, h: 1, c: ec },
    { x: 19, y: 13, w: 2, h: 1, c: ec },
  ],
  (sk, ec) => [
    { x: 10, y: 14, w: 4, h: 1, c: '#1a1a1a' },
    { x: 18, y: 14, w: 4, h: 1, c: '#1a1a1a' },
  ],
  (sk, ec) => [
    { x: 12, y: 13, w: 2, h: 4, c: ec },
    { x: 10, y: 14, w: 6, h: 2, c: ec },
    { x: 18, y: 13, w: 2, h: 4, c: ec },
    { x: 17, y: 14, w: 6, h: 2, c: ec },
  ],
  (sk, ec) => [
    { x: 9, y: 13, w: 5, h: 3, c: '#333' },
    { x: 18, y: 13, w: 5, h: 3, c: '#333' },
    { x: 14, y: 14, w: 4, h: 1, c: '#555' },
    { x: 11, y: 14, w: 2, h: 1, c: ec },
    { x: 20, y: 14, w: 2, h: 1, c: ec },
  ],
  (sk, ec) => [
    { x: 10, y: 14, w: 4, h: 1, c: '#1a1a1a' },
    { x: 18, y: 14, w: 4, h: 2, c: ec },
  ],
  (sk, ec) => [
    { x: 10, y: 13, w: 2, h: 2, c: ec },
    { x: 12, y: 13, w: 2, h: 2, c: ec },
    { x: 9, y: 14, w: 2, h: 2, c: ec },
    { x: 13, y: 14, w: 2, h: 2, c: ec },
    { x: 10, y: 16, w: 3, h: 1, c: ec },
    { x: 18, y: 13, w: 2, h: 2, c: ec },
    { x: 20, y: 13, w: 2, h: 2, c: ec },
    { x: 17, y: 14, w: 2, h: 2, c: ec },
    { x: 21, y: 14, w: 2, h: 2, c: ec },
    { x: 18, y: 16, w: 3, h: 1, c: ec },
  ],
];

type BrowStyleFn = (browColor: string) => Rect[];
export const BROW_STYLES: BrowStyleFn[] = [
  () => [],
  (bc) => [
    { x: 10, y: 11, w: 4, h: 1, c: bc },
    { x: 18, y: 11, w: 4, h: 1, c: bc },
  ],
  (bc) => [
    { x: 10, y: 12, w: 2, h: 1, c: bc },
    { x: 12, y: 11, w: 2, h: 1, c: bc },
    { x: 18, y: 11, w: 2, h: 1, c: bc },
    { x: 20, y: 12, w: 2, h: 1, c: bc },
  ],
  (bc) => [
    { x: 10, y: 11, w: 4, h: 2, c: bc },
    { x: 18, y: 11, w: 4, h: 2, c: bc },
  ],
  (bc) => [
    { x: 10, y: 12, w: 2, h: 1, c: bc },
    { x: 12, y: 11, w: 2, h: 1, c: bc },
    { x: 20, y: 12, w: 2, h: 1, c: bc },
    { x: 18, y: 11, w: 2, h: 1, c: bc },
  ],
  (bc) => [
    { x: 10, y: 10, w: 4, h: 1, c: bc },
    { x: 18, y: 10, w: 4, h: 1, c: bc },
  ],
  (bc) => [
    { x: 11, y: 11, w: 2, h: 1, c: bc },
    { x: 13, y: 10, w: 2, h: 1, c: bc },
    { x: 19, y: 10, w: 2, h: 1, c: bc },
    { x: 21, y: 11, w: 2, h: 1, c: bc },
  ],
  (bc) => [
    { x: 10, y: 9, w: 4, h: 1, c: bc },
    { x: 18, y: 9, w: 4, h: 1, c: bc },
  ],
  (bc) => [
    { x: 9, y: 11, w: 6, h: 2, c: bc },
    { x: 17, y: 11, w: 6, h: 2, c: bc },
  ],
  (bc) => [
    { x: 11, y: 11, w: 3, h: 1, c: bc },
    { x: 18, y: 11, w: 3, h: 1, c: bc },
  ],
];

type BeardStyleFn = (beardColor: string) => Rect[];
export const BEARD_STYLES: BeardStyleFn[] = [
  () => [],
  (bc) => [
    { x: 11, y: 20, w: 2, h: 1, c: bc },
    { x: 15, y: 21, w: 2, h: 1, c: bc },
    { x: 19, y: 20, w: 2, h: 1, c: bc },
  ],
  (bc) => [
    { x: 13, y: 20, w: 6, h: 3, c: bc },
    { x: 14, y: 23, w: 4, h: 2, c: bc },
  ],
  (bc) => [
    { x: 9, y: 19, w: 14, h: 2, c: bc },
    { x: 8, y: 21, w: 16, h: 3, c: bc },
    { x: 10, y: 24, w: 12, h: 2, c: bc },
  ],
  (bc) => [{ x: 11, y: 19, w: 10, h: 2, c: bc }],
  (bc) => [
    { x: 9, y: 19, w: 14, h: 2, c: bc },
    { x: 8, y: 21, w: 16, h: 4, c: bc },
    { x: 10, y: 25, w: 12, h: 3, c: bc },
    { x: 12, y: 28, w: 8, h: 2, c: bc },
  ],
  (bc) => [
    { x: 8, y: 16, w: 2, h: 6, c: bc },
    { x: 22, y: 16, w: 2, h: 6, c: bc },
  ],
  (bc) => [
    { x: 9, y: 19, w: 14, h: 2, c: bc },
    { x: 8, y: 21, w: 16, h: 3, c: bc },
    { x: 9, y: 24, w: 3, h: 4, c: bc },
    { x: 20, y: 24, w: 3, h: 4, c: bc },
  ],
  (bc) => [{ x: 14, y: 19, w: 4, h: 2, c: bc }],
];

type OutfitStyleFn = (outfitColor: string, patternColor: string) => Rect[];
export const OUTFIT_STYLES: OutfitStyleFn[] = [
  () => [],
  (oc, sc) => [
    { x: 8, y: 24, w: 16, h: 12, c: oc },
    { x: 6, y: 26, w: 3, h: 8, c: oc },
    { x: 23, y: 26, w: 3, h: 8, c: oc },
    { x: 8, y: 24, w: 16, h: 1, c: sc },
    { x: 6, y: 26, w: 3, h: 1, c: sc },
    { x: 23, y: 26, w: 3, h: 1, c: sc },
  ],
  (oc, sc) => [
    { x: 8, y: 24, w: 16, h: 12, c: oc },
    { x: 6, y: 26, w: 3, h: 8, c: oc },
    { x: 23, y: 26, w: 3, h: 8, c: oc },
    { x: 14, y: 24, w: 4, h: 12, c: '#f8f8f8' },
    { x: 15, y: 25, w: 2, h: 10, c: sc },
  ],
  (oc, sc) => [
    { x: 8, y: 24, w: 16, h: 12, c: oc },
    { x: 6, y: 26, w: 3, h: 8, c: oc },
    { x: 23, y: 26, w: 3, h: 8, c: oc },
    { x: 10, y: 24, w: 12, h: 2, c: sc },
    { x: 13, y: 29, w: 6, h: 3, c: sc },
  ],
  (oc, sc) => [
    { x: 8, y: 24, w: 16, h: 12, c: oc },
    { x: 6, y: 26, w: 3, h: 8, c: oc },
    { x: 23, y: 26, w: 3, h: 8, c: oc },
    { x: 12, y: 24, w: 8, h: 3, c: sc },
    { x: 14, y: 24, w: 4, h: 5, c: sc },
  ],
  (oc, sc) => [
    { x: 8, y: 24, w: 16, h: 12, c: oc },
    { x: 6, y: 26, w: 3, h: 8, c: oc },
    { x: 23, y: 26, w: 3, h: 8, c: oc },
    { x: 8, y: 26, w: 16, h: 1, c: sc },
    { x: 8, y: 28, w: 16, h: 1, c: sc },
    { x: 8, y: 30, w: 16, h: 1, c: sc },
    { x: 8, y: 32, w: 16, h: 1, c: sc },
  ],
  (oc, sc) => [
    { x: 9, y: 24, w: 14, h: 10, c: oc },
    { x: 5, y: 25, w: 5, h: 8, c: oc },
    { x: 22, y: 25, w: 5, h: 8, c: oc },
    { x: 9, y: 34, w: 14, h: 2, c: sc },
  ],
  (oc, sc) => [
    { x: 9, y: 24, w: 14, h: 8, c: oc },
    { x: 6, y: 25, w: 4, h: 7, c: oc },
    { x: 22, y: 25, w: 4, h: 7, c: oc },
    { x: 7, y: 32, w: 18, h: 4, c: sc },
    { x: 6, y: 36, w: 20, h: 3, c: sc },
  ],
  (oc, sc) => [
    { x: 9, y: 24, w: 14, h: 10, c: oc },
    { x: 5, y: 25, w: 5, h: 8, c: oc },
    { x: 22, y: 25, w: 5, h: 8, c: oc },
    { x: 14, y: 24, w: 4, h: 1, c: sc },
    { x: 15, y: 25, w: 2, h: 3, c: sc },
  ],
  (oc, sc) => [
    { x: 9, y: 24, w: 14, h: 10, c: oc },
    { x: 5, y: 25, w: 5, h: 7, c: oc },
    { x: 22, y: 25, w: 5, h: 7, c: oc },
    { x: 6, y: 25, w: 2, h: 2, c: sc },
    { x: 9, y: 25, w: 2, h: 2, c: sc },
    { x: 12, y: 25, w: 2, h: 2, c: sc },
    { x: 15, y: 25, w: 2, h: 2, c: sc },
    { x: 18, y: 25, w: 2, h: 2, c: sc },
    { x: 21, y: 25, w: 2, h: 2, c: sc },
  ],
  (oc, sc) => [
    { x: 9, y: 24, w: 14, h: 7, c: oc },
    { x: 7, y: 24, w: 3, h: 5, c: oc },
    { x: 22, y: 24, w: 3, h: 5, c: oc },
    { x: 7, y: 31, w: 18, h: 4, c: sc },
    { x: 6, y: 35, w: 20, h: 4, c: sc },
  ],
];

export const OUTFIT_LABELS = ['Yok', 'Tişört', 'Takım', 'Hoodie', 'Polo', 'Çizgili', 'Bluz', 'Elbise', 'V Yaka', 'Fırfırlı', 'Kısa Elbise'];

export interface AvatarConfig {
  bg: number;
  skin: number;
  face: number;
  hair: number;
  hairColor: number;
  eye: number;
  eyeColor: number;
  brow: number;
  browColor: number;
  beard: number;
  beardColor: number;
  outfit: number;
  outfitColor: number;
  outfitColor2: number;
  lipColor: number;
  jersey: string | null;
}

export const DEFAULT_AVATAR_CONFIG: AvatarConfig = {
  bg: 0,
  skin: 0,
  face: 0,
  hair: 0,
  hairColor: 0,
  eye: 0,
  eyeColor: 0,
  brow: 0,
  browColor: 0,
  beard: 0,
  beardColor: 0,
  outfit: 0,
  outfitColor: 0,
  outfitColor2: 0,
  lipColor: 0,
  jersey: null,
};

export interface Jersey {
  id: string;
  label: string;
  shirtColor: string;
  trimColor: string;
  pattern: 'solid' | 'stripe';
  tier: string;
  logo?: Rect[];
}

// Not: FB/BJK gerçek amblemleri (base64 PNG) web'de gömülü — mobilde forma
// listesi admin/moderatör'e özel, düşük öncelikli bir alan olduğu için
// şimdilik yalnızca düz renk/çizgi (logosuz) forma render ediliyor.
export const JERSEYS: Jersey[] = [
  { id: 'tr', label: 'Türkiye', shirtColor: '#D1201F', trimColor: '#FFFFFF', pattern: 'solid', tier: 'free' },
  { id: 'fb', label: 'Fenerbahçe', shirtColor: '#F8DE22', trimColor: '#1E2A5E', pattern: 'stripe', tier: 'free' },
  { id: 'bjk', label: 'Beşiktaş', shirtColor: '#000000', trimColor: '#FFFFFF', pattern: 'stripe', tier: 'free' },
  { id: 'gs', label: 'Galatasaray', shirtColor: '#F5A800', trimColor: '#A50021', pattern: 'stripe', tier: 'free' },
  { id: 'rma', label: 'Real Madrid', shirtColor: '#FDFDFD', trimColor: '#FEBE10', pattern: 'solid', tier: 'free' },
  { id: 'psg', label: 'PSG', shirtColor: '#041E42', trimColor: '#DA291C', pattern: 'solid', tier: 'free' },
  { id: 'juve', label: 'Juventus', shirtColor: '#FFFFFF', trimColor: '#000000', pattern: 'stripe', tier: 'free' },
  { id: 'int', label: 'Inter', shirtColor: '#0068A8', trimColor: '#000000', pattern: 'stripe', tier: 'free' },
  { id: 'mil', label: 'Milan', shirtColor: '#FB090B', trimColor: '#000000', pattern: 'stripe', tier: 'free' },
  { id: 'koc', label: 'Kocaelispor', shirtColor: '#0B6E4F', trimColor: '#000000', pattern: 'stripe', tier: 'free' },
  { id: 'bur', label: 'Bursaspor', shirtColor: '#00A650', trimColor: '#FFFFFF', pattern: 'solid', tier: 'free' },
  { id: 'ibfk', label: 'Başakşehir', shirtColor: '#0B2265', trimColor: '#F58220', pattern: 'solid', tier: 'free' },
  { id: 'kon', label: 'Konyaspor', shirtColor: '#FFFFFF', trimColor: '#0B6E4F', pattern: 'solid', tier: 'free' },
  { id: 'sam', label: 'Samsunspor', shirtColor: '#FFFFFF', trimColor: '#D1201F', pattern: 'stripe', tier: 'free' },
  { id: 'bay', label: 'Bayern Münih', shirtColor: '#DC052D', trimColor: '#FFFFFF', pattern: 'solid', tier: 'free' },
  { id: 'mci', label: 'Manchester City', shirtColor: '#6CABDD', trimColor: '#1C2C5B', pattern: 'solid', tier: 'free' },
  { id: 'liv', label: 'Liverpool', shirtColor: '#C8102E', trimColor: '#F6EB61', pattern: 'solid', tier: 'free' },
  { id: 'ars', label: 'Arsenal', shirtColor: '#EF0107', trimColor: '#FFFFFF', pattern: 'solid', tier: 'free' },
];

export function jerseyBodyRects(team: Jersey): Rect[] {
  const base: Rect[] = [
    { x: 8, y: 24, w: 16, h: 12, c: team.shirtColor },
    { x: 6, y: 26, w: 3, h: 8, c: team.shirtColor },
    { x: 23, y: 26, w: 3, h: 8, c: team.shirtColor },
  ];
  if (team.pattern === 'stripe') {
    base.push({ x: 11, y: 24, w: 3, h: 12, c: team.trimColor }, { x: 18, y: 24, w: 3, h: 12, c: team.trimColor });
  }
  if (team.logo) base.push(...team.logo);
  return base;
}

export function darkenHex(hex: string): string {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = Math.max(0, (n >> 16) - 40);
  const g = Math.max(0, ((n >> 8) & 255) - 40);
  const b = Math.max(0, (n & 255) - 40);
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('');
}

function randomInt(max: number) {
  return Math.floor(Math.random() * max);
}

export function generateRandomConfig(): AvatarConfig {
  const validHairIndices = HAIR_STYLES.map((s, i) => i).filter((i) => HAIR_STYLES[i] !== null);
  return {
    bg: randomInt(BG_COLORS.length),
    skin: randomInt(SKIN_COLORS.length),
    face: randomInt(FACES.length),
    hair: validHairIndices[randomInt(validHairIndices.length)],
    hairColor: randomInt(HAIR_COLORS.length),
    eye: randomInt(EYE_STYLES.length),
    eyeColor: randomInt(EYE_COLORS.length),
    brow: randomInt(BROW_STYLES.length),
    browColor: randomInt(BROW_COLORS.length),
    beard: randomInt(BEARD_STYLES.length),
    beardColor: randomInt(BEARD_COLORS.length),
    outfit: randomInt(OUTFIT_STYLES.length),
    outfitColor: randomInt(OUTFIT_COLORS.length),
    outfitColor2: randomInt(OUTFIT_PATTERN_COLORS.length),
    lipColor: randomInt(LIP_COLORS.length),
    jersey: null,
  };
}
