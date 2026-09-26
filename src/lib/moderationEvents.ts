// Bir kullanıcı engellendiğinde / engeli kaldırıldığında haber veriyor
// (tabReselect.ts ile aynı desen). react-query'deki listeler zaten
// `invalidateQueries` ile tazeleniyor; bu kanal react-query DIŞINDA kendi
// state'ini tutan listeler için (yorumlar, profil sekmeleri): engellenen
// kişinin satırlarını beklemeden ekrandan düşürebilsinler.
type Listener = (userId: number, blocked: boolean) => void;

const listeners = new Set<Listener>();

export function onBlockChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitBlockChanged(userId: number, blocked: boolean): void {
  listeners.forEach((listener) => listener(userId, blocked));
}
