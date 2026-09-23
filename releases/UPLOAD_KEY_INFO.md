# The upload key

**The key this file used to describe is burned. It must be replaced before
the first upload to Google Play.**

`releases/vitahero-upload-key.jks` and `android/app/play-upload-key.jks` were
both committed to this repository, and the store and key passwords were
written in plain text in this file beside them. Deleting them does not undo
that: every clone and every fork still has them, and so does anyone who has
ever had read access. A signing key that is public is a key somebody else can
sign a build with.

Nothing has shipped yet — no bundle has been uploaded, so no user has ever
trusted this key — which is why this is a chore rather than an incident. It
stops being a chore the moment a build goes up signed with it.

## Replacing it

1. Generate a new keystore, outside the repository.
2. Point `android/local.properties` at it (that file is git-ignored). The four
   names `android/app/build.gradle.kts` actually reads are `VITAHERO_KEYSTORE`
   (the path), `VITAHERO_KEYSTORE_PASSWORD`, `VITAHERO_KEY_ALIAS` and
   `VITAHERO_KEY_PASSWORD`. Environment variables of the same names work too.
   With none of them set the release build is unsigned, which fails at upload
   rather than quietly producing something that looks signed.
3. Put the same four in the repository's CI secrets for android-publish.yml.
4. Register the new SHA-1 and SHA-256 in the Firebase console, along with the
   Play app-signing certificate and the debug key. Firebase phone OTP will not
   send a code to a build whose fingerprint it does not know, which means
   nobody can sign in at all.
5. Keep one backup somewhere that is not a git repository.

## Where the secrets live

In `android/local.properties` on the machine that builds, and in CI secrets.
Never in a tracked file. `.gitignore` already refuses `*.jks`, `*.keystore`
and `android/local.properties`; this file is the part that was missing.
