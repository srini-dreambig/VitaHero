# VitaHero Upload Key (KEEP THIS SAFE)

This keystore signs every VitaHero release bundle for Google Play.

- File: releases/vitahero-upload-key.jks
- Alias: vitahero
- Store password: VitaHero2026Upload
- Key password: VitaHero2026Upload (same as store password)
- SHA1 fingerprint: 32:6C:3E:AD:57:DF:C0:50:2F:6B:CD:84:26:4E:13:17:F6:E0:45:83
- Valid for: 10,000 days

## Rules

1. NEVER lose this file — if it is lost, new updates can only be shipped after
   Google approves another upload key reset (days of downtime).
2. Keep at least one backup copy somewhere safe (password manager, secure drive).
3. Do not share the passwords in public.
4. Builds are wired automatically: android/local.properties points to this file.
   If you build on another machine, copy this keystore and repeat the
   local.properties entries.
