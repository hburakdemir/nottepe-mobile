import React, { createContext, useContext } from 'react';
import type { ProfileMode } from './profileCommon';

/**
 * Şablonun hangi profili çizdiği. Sekmeler bunu context'ten okuyor.
 *
 * NEDEN CONTEXT, NEDEN PROP DEĞİL: yedi sekmenin her biri zaten beş prop
 * alıyor (`ProfileTabProps`) ve hepsi `React.memo`'lu. `username`/`readOnly`
 * prop olarak eklenseydi her sekme imzasına iki alan daha girerdi; context
 * değeri ise şablonun ömrü boyunca DEĞİŞMİYOR (tek `useMemo`), yani ne memo'yu
 * bozuyor ne de gereksiz render üretiyor.
 */
export interface ProfileScopeValue {
  mode: ProfileMode;
  /** `undefined` = oturum sahibinin kendi profili (`*.getMine()` uçları). */
  username?: string;
  /** Profil sahibinin kullanıcı kimliği — forum etkinliği bunu istiyor. */
  profileId?: string | number;
  /** `true` → sekmeler silme/düzenleme mutasyonlarını HİÇ kurmuyor. */
  readOnly: boolean;
}

const DEFAULT_SCOPE: ProfileScopeValue = { mode: 'me', readOnly: false };

const ProfileScopeContext = createContext<ProfileScopeValue>(DEFAULT_SCOPE);

export function ProfileScopeProvider({
  value,
  children,
}: {
  value: ProfileScopeValue;
  children: React.ReactNode;
}) {
  return <ProfileScopeContext.Provider value={value}>{children}</ProfileScopeContext.Provider>;
}

export function useProfileScope(): ProfileScopeValue {
  return useContext(ProfileScopeContext);
}
