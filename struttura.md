# Struttura Tecnica del Progetto

Questo documento descrive in dettaglio la struttura tecnica del progetto, gli strumenti utilizzati e le scelte architetturali adottate per garantire scalabilità, collaborazione multiutente e facilità di manutenzione. Non vengono trattate le logiche di business o il funzionamento dell'applicazione.

---

## 1. Stack Tecnologico Principale

- **Frontend**: Next.js (TypeScript, App Router)
  - Rendering SSR/SSG/ISR per performance e SEO
  - Gestione delle rotte tramite file system (cartella `src/app`)
  - Tailwind CSS per la gestione dello stile
  - Modularizzazione tramite componenti React
- **Backend/API**: Next.js API Routes (cartella `src/app/api`)
  - API RESTful serverless deployate su Vercel
  - Gestione autenticazione e logica di business lato server
- **Database**: Supabase (PostgreSQL gestito)
  - Gestione dati relazionali, autenticazione, storage file
  - Migrazioni versionate in SQL (cartella `supabase/migrations`)
  - Policy Row Level Security (RLS) per la sicurezza multiutente
- **Storage**: Supabase Storage
  - Gestione file e allegati (es. immagini, documenti)
- **Deployment**: Vercel
  - Deploy continuo tramite integrazione Git
  - Preview automatiche per ogni branch/pull request
- **Gestione ambiente**: Variabili d’ambiente tramite Vercel e file `.env`

---

## 2. Struttura delle Cartelle

- `src/app/` — Entry point Next.js, suddiviso per rotte e sottosezioni funzionali
  - `api/` — API serverless (es. inviti, suggerimenti, creazione viaggi)
  - `[feature]/` — Ogni funzionalità ha la propria cartella (es. `trip/[id]/meteo/`)
  - Componenti riutilizzabili in `components/`
- `src/lib/` — Librerie e utility condivise
  - Integrazioni con servizi esterni (es. Nominatim, OpenTripMap, meteo)
  - Wrapper Supabase (admin, client, server)
  - Tipizzazioni TypeScript condivise
- `public/` — Asset statici (immagini, icone)
- `supabase/` — Configurazione e migrazioni database
  - `migrations/` — Script SQL versionati per evoluzione schema
- File di configurazione root (`package.json`, `tsconfig.json`, `tailwind.config.ts`, ecc.)

---

## 3. Gestione Collaborazione Multiutente

- **Autenticazione**: Supabase Auth
  - Supporto OAuth, email/password, magic link
  - JWT per autenticazione API
- **Autorizzazione**: Row Level Security (RLS) su PostgreSQL
  - Policy granulari per garantire che ogni utente acceda solo ai dati di propria competenza
  - Trigger e funzioni SQL per automatizzare la gestione dei permessi
- **Collaborazione**: Modello dati relazionale
  - Tabelle con relazioni many-to-many (es. utenti-viaggi, collaboratori)
  - Inviti gestiti tramite API dedicate (`src/app/api/invite/send/`)
  - Notifiche e gestione inviti tramite Supabase e-mail e trigger
- **Realtime**: Supabase Realtime (opzionale)
  - Aggiornamenti in tempo reale su dati condivisi (es. posizione live, modifiche collaboratori)
- **Storage condiviso**: Supabase Storage
  - Accesso controllato tramite policy e signed URLs

---

## 4. DevOps e Best Practice

- **Migrazioni database**: Versionamento tramite file SQL, applicazione automatica in CI/CD
- **CI/CD**: Deploy automatico su Vercel, preview per ogni branch
- **Gestione ambienti**: Separazione ambienti (dev, preview, prod) tramite Vercel e Supabase
- **Sicurezza**: Policy RLS, validazione input lato server, gestione sicura delle chiavi API
- **Testing**: (opzionale, da integrare) — Possibilità di aggiungere test end-to-end e unitari

---

## 5. Integrazioni Esterne

- **Servizi di terze parti**: Integrazione tramite librerie custom in `src/lib/`
  - Esempi: Nominatim (geocoding), OpenTripMap (POI), servizi meteo
- **Gestione API Key**: Variabili d’ambiente e secret management

---

## 6. Scalabilità e Manutenibilità

- **Modularità**: Ogni feature è isolata in una propria cartella, favorendo la scalabilità
- **Tipizzazione**: Uso estensivo di TypeScript per ridurre errori e migliorare l’autocompletamento
- **Configurazione centralizzata**: File di configurazione root e librerie condivise
- **Documentazione**: Struttura chiara e commenti nei punti critici

---

## 7. Strumenti e Tecnologie Utilizzate

- **Next.js** (React, SSR, API Routes)
- **TypeScript**
- **Tailwind CSS**
- **Supabase** (PostgreSQL, Auth, Storage, Realtime)
- **Vercel** (deploy, preview, gestione ambienti)
- **PostgreSQL** (migrazioni, RLS, funzioni SQL custom)
- **CI/CD** (Vercel, GitHub/GitLab)
- **Altri**: PostCSS, librerie di utilità, API esterne

---

> Questa struttura è pensata per progetti moderni, collaborativi e facilmente estendibili, con particolare attenzione alla sicurezza, alla collaborazione multiutente e alla separazione delle responsabilità tra frontend, backend e database.
