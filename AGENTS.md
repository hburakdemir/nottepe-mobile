# Expo HAS CHANGED

This project is on **Expo SDK 54** (React Native 0.81).

Read the exact versioned docs at https://docs.expo.dev/versions/v54.0.0/ before
writing any code. Do not write against `latest` — the API surface moved a lot
between 54 and 57 (`expo-file-system` alone gained `onProgress`, `AbortSignal`,
async `copy`/`move` and `lastModified` in 56.0.0).

## Do not upgrade the SDK without reading this first

An SDK 54 → 57 upgrade was completed and then **reverted on 2026-09-18**. It
built clean (expo-doctor 21/21, tsc clean, release APK fine) but shipped a
measured JS-thread regression on a real device: **%11.3 of wall time blocked vs
%4.9 on SDK 54** (~3× worse per block), with push transitions stalling mid-slide
and the Profile tab triggering an unresponsive dialog. The app's own diagnostics
badge (`src/lib/diagnostics.ts`) produced both numbers.

The work is preserved on the `sdk57-file-viewer` branch (pushed to origin).
Nothing there is lost — but the branch is **not** ready to merge, and the SDK
part is the reason.

The in-app file viewer that was built on top of that upgrade has since been
**ported back to SDK 54** on `file-viewer-sdk54`, so the viewer does not depend
on the upgrade. Two SDK-54 specifics in that port are easy to undo by accident:
`src/lib/fileCache.ts` downloads through `expo-file-system/legacy`
(`createDownloadResumable`) because v19's `DownloadOptions` has no `onProgress`
and no `signal`, and it reads `file.modificationTime`, not `lastModified` —
the latter is `undefined` on v19 and would make the cache trimmer delete the
entire cache on every open, with no type error. `babel.config.js` branches on
`caller.platform === 'web'` rather than `caller.isDomComponent`; the latter flag
only exists from SDK 57 and would silently always be false here.

If you pick the upgrade back up: the three SDK steps are separate commits
(`64eeeea` 55, `c57b96f` 56, `dce722e` 57) specifically so the regression can be
bisected. Start by building `c57b96f` and measuring with the badge; do not
attempt a fix before you know which step broke it. The strongest suspect is
`react-native-screens` 4.16 → 4.26, because `App.tsx` enables `enableFreeze` and
`src/navigation/MainTabsScreen.tsx` already documents three upstream
"unresponsive" bugs in that library.

Note that SDK 54 already targets Android API 36, so staying here is not a Play
Store blocker.
