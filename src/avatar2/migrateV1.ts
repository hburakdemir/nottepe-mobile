// ─── v1 → Avatar 2.0 ──────────────────────────────────────────────────────────
// core.ts ile birlikte web ve mobilde BİREBİR aynı taşınır (asıl kopya web'de).
//
// v1 avatar dizinle saklanıyor (`hair: 3`) ve vücut tipi taşımıyor. Burada her v1
// dizini için elle seçilmiş en yakın 2.0 karşılığı var; renkler v1 paletinden
// hex olarak alınıyor, böylece ten, saç ve kıyafet rengi aynı kalıyor.
// Vücut tipi kıyafetten ve sakaldan tahmin ediliyor; emin olunamazsa
// `sexGuessed: false` dönüyor ve uygulama ilk açılışta kullanıcıya soruyor.
//
// Diziler web'deki client/src/constants/Avatarconfig.js'in 14.10.2026 hâliyle
// aynı: FACES 15, HAIR 20, EYE 9, BROW 10, BEARD 9, OUTFIT 11.

import { normalize, type AvatarV2 } from './core';

const V1 = {
  BG: ['#454040', '#1B0C0C', '#576A8F', '#ACBAC4', '#E8EDF2', '#EDE9E6', '#6FCF97', '#1F6F5F', '#F8DE22', '#2F2FE4', '#28396C', '#FF3E9B', '#FF88BA', '#8F0177', '#612D53', '#982598', '#E6501B', '#C3110C', '#740A03', '#C00707', '#0f172a', '#1e293b', '#064e3b', '#422006'],
  SKIN: ['#FDDBB4', '#F5CBA7', '#F1C27D', '#FFCBA4', '#FFB347', '#E0AC69', '#C68642', '#D4956A', '#A0522D', '#8D5524', '#5C3317', '#4a2511', '#7B3F00', '#3d1c02', '#f9e4d4', '#D9B99B', '#C4A882', '#b07d4a', '#9a6b3a', '#6b3d1e'],
  HAIR: ['#1a1a1a', '#2c3e50', '#2c1e0f', '#4a2c2a', '#6b3a2a', '#8B4513', '#A0522D', '#C17817', '#D4A017', '#deb887', '#F5CBA7', '#e8d5b7', '#fffdd0', '#808080', '#a8a8a8', '#d4d4d4', '#FF4500', '#c0392b', '#e91e8c', '#9b59b6', '#2F2FE4', '#FF3737', '#c0392b', '#FF0000'],
  BEARD: ['#1a1a1a', '#2c1e0f', '#4a2c2a', '#6b3a2a', '#8B4513', '#A0522D', '#C17817', '#808080', '#a8a8a8', '#d4d4d4', '#FF4500', '#c0392b', '#2c3e50', '#2F2FE4', '#FF3E9B', '#5E0006', '#7B0008', '#9A000A', '#BB000C', '#D50000'],
  EYE: ['#1a1a1a', '#2563eb', '#1d4ed8', '#059669', '#065f46', '#92400e', '#7c3aed', '#b45309', '#6b7280', '#dc2626', '#0ea5e9', '#84cc16', '#FF0000'],
  // Web'deki "#ffff" ve "#00000" mobildeki gibi tam yazıldı (tarayıcıda zaten beyaz ve siyah çiziliyordu).
  LIP: ['#CAAA98', '#ffffff', '#000000', '#E0AC69', '#C68642', '#D4956A', '#d4756a', '#c0392b', '#e74c3c', '#f39c12', '#e91e8c', '#9b59b6', '#ff6b9d', '#ff8fab', '#c2185b', '#ad1457', '#880e4f', '#b71c1c', '#f06292', '#f48fb1', '#ffb3ba', '#8d1b3d', '#5d0e2b', '#ff1744', '#d50000'],
  OUTFIT: ['#1e3a5f', '#2F5755', '#7c1d1d', '#4a1d96', '#1a1a2e', '#ec4899', '#f97316', '#0ea5e9', '#84cc16', '#64748b', '#ffffff', '#fef3c7', '#fce7f3', '#d1fae5', '#e0e7ff', '#111827', '#7f1d1d', '#365314', '#1e1b4b', '#831843'],
  PATTERN: ['#ffffff', '#f8f8f8', '#1a1a1a', '#e11d48', '#2563eb', '#16a34a', '#d97706', '#7c3aed', '#0891b2', '#be123c', '#fbbf24', '#34d399', '#f472b6', '#a3e635', '#c4b5fd'],
};

// v1 dizini → 2.0 kimliği. Vücut tipine uymayanları normalize() o tipin varsayılanına çeker.
const FACE = ['kare', 'yumusak', 'uzun', 'yuvarlak', 'dolgun', 'kalp', 'oval', 'armut', 'yuvarlak', 'ince', 'kare', 'yumusak', 'oval', 'kalp', 'dolgun'];
const HAIR_K = ['uzun', 'pixie', 'bob', 'bob', 'pixie', 'bob', 'pixie', 'afro', 'lob', 'atkuyrugu', 'uzun', 'dalgali', 'yantarali', 'uzunkivircik', 'lob', 'bob', 'pixie', 'yarimtoplu', 'topuz', 'pixie'];
const HAIR_E = ['yok', 'kisa', 'kisa', 'perdeli', 'undercut', 'perdeli', 'kirpi', 'afro', 'yanayrik', 'samuray', 'uzun', 'uzun', 'uzun', 'kivircik', 'perdeli', 'perdeli', 'kisa', 'samuray', 'samuray', 'kabarik'];
const EYE = ['yuvarlak', 'iri', 'cekik', 'badem', 'yorgun', 'iri', 'yuvarlak', 'kirpan', 'iri'];
const BROW_K = ['ince', 'dogal', 'kavisli', 'kalin', 'kavisli', 'yay', 'kalkik', 'yay', 'kalin', 'ince'];
const BROW_E = ['dogal', 'dogal', 'dogal', 'kalin', 'dogal', 'dogal', 'kalkik', 'dogal', 'kalinduz', 'kisa'];
const BEARD = ['yok', 'kirli', 'keci', 'tam', 'biyik', 'uzunsakal', 'favori', 'kisasakal', 'biyik'];
// 0 Yok, 1 Tişört, 2 Takım, 3 Hoodie, 4 Polo, 5 Çizgili, 6 Bluz, 7 Elbise, 8 V Yaka, 9 Fırfırlı, 10 Kısa Elbise
const OUTFIT_K = ['atlet', 'tisort', 'ceket', 'kapusonlu', 'tisort', 'kazak', 'bluz', 'elbise', 'fiyonklu', 'bluz', 'elbise'];
const OUTFIT_E = ['atlet', 'tisort', 'takim', 'kapusonlu', 'polo', 'kazak', 'tisort', 'tisort', 'polo', 'tisort', 'tisort'];

export interface V1Config {
  bg?: number; skin?: number; face?: number; hair?: number; hairColor?: number; eye?: number; eyeColor?: number;
  brow?: number; browColor?: number; beard?: number; beardColor?: number; outfit?: number; outfitColor?: number;
  outfitColor2?: number; lipColor?: number; jersey?: string | null;
}

const at = <T>(arr: T[], i: number | undefined, fallback = 0): T => arr[Math.min(Math.max(i ?? fallback, 0), arr.length - 1)];

// Vücut tipi tahmini: sakal → erkek; Bluz/Elbise/Fırfırlı/Kısa Elbise → kadın; Takım → erkek.
// Emin olunamazsa null; migrateV1 o zaman saç uzunluğuyla bir varsayım yapar ama
// sexGuessed=false döner, uygulama kullanıcıya sorar.
export function guessSex(v1: V1Config): 'kadin' | 'erkek' | null {
  if ((v1.beard ?? 0) > 0) return 'erkek';
  const o = v1.outfit ?? 0;
  if ([6, 7, 9, 10].includes(o)) return 'kadin';
  if (o === 2) return 'erkek';
  return null;
}

export function isV2(raw: unknown): raw is AvatarV2 { return !!raw && typeof raw === 'object' && (raw as { v?: unknown }).v === 2; }

// `body` verilirse (kullanıcı seçtiyse) tahmin yerine o kullanılır.
export function migrateV1(v1: V1Config | null | undefined, body?: 'kadin' | 'erkek'): { config: AvatarV2; sexGuessed: boolean } {
  const c = v1 || {};
  const guess = guessSex(c);
  // Omza ya da daha aşağı inen v1 saçları (3, 10-15, 17) zayıf bir kadın işareti.
  const b = body ?? guess ?? ([3, 10, 11, 12, 13, 14, 15, 17].includes(c.hair ?? 0) ? 'kadin' : 'erkek');
  const k = b === 'kadin';
  // Eski avatarlar piksel görünümle başlar: bugünkü pikselli kimliklerine en yakın hâl.
  const config = normalize({
    v: 2, style: 'piksel', body: b, face: at(FACE, c.face), skin: at(V1.SKIN, c.skin), bg: at(V1.BG, c.bg),
    hair: at(k ? HAIR_K : HAIR_E, c.hair), hairColor: at(V1.HAIR, c.hairColor),
    eyes: at(EYE, c.eye ?? 1), eyeColor: at(V1.EYE, c.eyeColor),
    brows: at(k ? BROW_K : BROW_E, c.brow), nose: 'kucuk', mouth: 'gulumseme', lip: at(V1.LIP, c.lipColor),
    beard: k ? 'yok' : at(BEARD, c.beard), beardColor: at(V1.BEARD, c.beardColor),
    outfit: at(k ? OUTFIT_K : OUTFIT_E, c.outfit), outfitColor: at(V1.OUTFIT, c.outfitColor), accent: at(V1.PATTERN, c.outfitColor2),
    // v1'deki "gözlüklü göz" (6) 2.0'da göz + kare gözlük
    acc: c.eye === 6 ? 'kare' : 'yok', accColor: '#333333',
  });
  return { config, sexGuessed: body != null || guess != null };
}

// Kayıttan okunan herhangi bir config'i 2.0'a çevirir.
export function toV2(raw: unknown): { config: AvatarV2; sexGuessed: boolean } {
  if (isV2(raw)) return { config: normalize(raw), sexGuessed: true };
  return migrateV1(raw as V1Config);
}
