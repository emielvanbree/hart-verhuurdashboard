# Delivery Report — Verhuurdashboard
**'t Hart Verloskunde | Salesupply BT**
**Gebouwd:** 7 juni 2026 | **Stack:** Node.js + Express + @libsql/client + React (Vite)

---

## Status: ✅ Volledig functioneel

**API-tests: 29/29 geslaagd**
**Playwright-tests: 10 scenario's geschreven (uitvoeren lokaal met `npx playwright test`)**

---

## Opgeleverde functionaliteit

### Kernflows (alle Must-requirements uit FD)
| FR | Omschrijving | Status |
|----|-------------|--------|
| FR-001 | Login/logout met username + password | ✅ |
| FR-002 | Badartikelen toevoegen, bewerken, deactiveren (admin) | ✅ |
| FR-003 | Reservering aanmaken via uitgerekende datum | ✅ |
| FR-004 | Beschikbaarheidsvenster -4w tot +3w op uitgerekende datum | ✅ |
| FR-005 | Meerdere artikelen per reservering | ✅ |
| FR-006 | Dubbelboekingspreventie via periode-overlap logica | ✅ |
| FR-007 | Uitleenovereenkomst PDF genereren | ✅ |
| FR-008 | Overeenkomst per e-mail verstuurd (SMTP/Graph/dev) | ✅ |
| FR-009 | Signed agreement opgeslagen in dossier | ✅ |
| FR-010 | Ophalen + betaling registreren | ✅ |
| FR-011 | Factuur PDF genereren op ophalen | ✅ |
| FR-012 | Factuur printen en/of mailen | ✅ |
| FR-013 | Retour per artikel registreren → status AVAILABLE | ✅ |
| FR-014 | Retourchecklist (compleet/schoon/disposables) | ✅ |
| FR-015 | Borgafrekening automatisch berekend | ✅ |
| FR-016 | Vrije-tekst extra factuur met vooringevulde standaardteksten | ✅ |
| FR-017 | Creditnota €77,50 bij ongeopende disposables | ✅ |
| FR-018 | Alle documenten als PDF opgeslagen in dossier | ✅ |
| FR-019 | Te-laat-overzicht op dashboard | ✅ |
| FR-020 | Reservering annuleren (→ artikelen direct AVAILABLE) | ✅ |
| FR-021 | Bevallingsdatum optioneel registreren | ✅ |
| FR-022 | Retourdeadline: 3 werkdagen na bevalling; fallback pickup+14d | ✅ |
| FR-023 | Responsive layout (desktop primary, tablet-friendly) | ✅ |
| FR-024 | Zoeken en filteren in verhuuroverzicht | ✅ |
| FR-025 | Volledig audittrail per dossier | ✅ |

### Extra functionaliteit (boven op FD)
- **OQ-009 Walk-in uitleen** — directe uitleen zonder reservering
- **Wachtlijst** — toevoegen/beheren/afhandelen met type-voorkeur
- **Vervangingswaarschuwing** — bad bij 40+ uitleningen gemarkeerd op dashboard
- **Beschikbaarheidslogica** — periode-overlap (niet alleen status), toekomstige reserveringen worden correct geblokkeerd
- **Financiële velden** — `invoice_status`, `deposit_paid`, `settlement_status`, `deadline_type` (estimated/definitive)
- **E-mail methoden** — SMTP, Microsoft Graph API én developer-modus (bestanden)
- **Aanpasbare documenttemplates** — beheerder kan teksten, voorwaarden, koptekst aanpassen
- **8 badsetten** vooraf ingezaaid (Bad 1–8, MINI/Normaal met correcte maten)
- **Gebruikersbeheer** — aanmaken, bewerken, deactiveren
- **Cliëntnummer** — automatisch oplopend (14001, 14002, …)

---

## Borgafrekening (getest)
| Situatie | Extra factuur | Creditnota |
|---------|--------------|------------|
| Op tijd + schoon | — | — |
| Te laat | €30 | — |
| Vies | €30 | — |
| Te laat + vies | €60 | — |
| Disposables ongeopend | — | €77,50 |
| Te laat + disposables | €30 | €77,50 |
| Vies + disposables | €30 | €77,50 |

---

## Lokaal starten

```
# Windows (dubbelklik of in terminal):
start.bat

# Of PowerShell:
.\start.ps1

# Of handmatig:
npm install --ignore-scripts
cd client && npm install && npm run build && cd ..
npm start
# Open http://localhost:3000
```

**Eerste inloggegevens:**
- Admin: `admin@thart.nl` / `Admin123!`
- Assistent: `assistent@thart.nl` / `Assistent123!`

> Bij eerste login wordt gevraagd het wachtwoord te wijzigen.

---

## Playwright E2E tests lokaal draaien

```bash
npm install
npx playwright install chromium
npx playwright test
```

---

## Productie-deployment

De app draait lokaal met SQLite + lokale bestanden. Voor deployment op Salesupply Kubernetes:
1. Swap `@libsql/client` → PostgreSQL via Prisma of Drizzle
2. PDFs naar S3-compatible object storage (TransIP)
3. Stel `SESSION_SECRET` in als omgevingsvariabele
4. E-mail configureren via instellingenpagina (SMTP of Microsoft Graph)

---

## Open punten voor go-live

| # | Punt | Eigenaar |
|---|------|---------|
| OQ-001 | Digitale handtekeningprovider keuze | Salesupply BT |
| OQ-002 | SMTP/Graph configureren met echte credentials | 't Hart |
| OQ-003 | GDPR Art. 9 bevestiging met DPO | Emiel van Bree |
| OQ-005 | Admin routes VPN-beperken? | Salesupply BT |
| OQ-006 | Standaardvervangingskosten bij incomplete set | 't Hart |

