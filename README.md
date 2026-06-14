# LaViaGiusta 🏔️

App mobile e infrastruttura web/backend per la sicurezza in montagna e la promozione turistica del Comune di Valle Castellana.

## Architettura

Il progetto è diviso in tre parti principali:

1. **`backend/`**: Server Node.js (Express, TypeScript, Prisma, PostgreSQL + PostGIS, Redis + BullMQ, Twilio).
2. **`mobile/`**: App mobile React Native (Expo, Mapbox, geolocalizzazione in background, notifiche push).
3. **`shared/`**: Tipi TypeScript e costanti condivisi tra client e server.

## Requisiti

- Node.js (v18+)
- Docker e Docker Desktop
- Expo SDK 56

## Sviluppo Locale

### 1. Database e Redis

Avvia i servizi PostgreSQL (con PostGIS) e Redis:

```bash
docker compose up -d
```

Il database PostgreSQL sarà accessibile sulla porta `5433` (modificata per evitare conflitti con eventuali database locali).

### 2. Backend

Configura il file `.env` ed esegui le migrazioni del database:

```bash
cd backend
npm install
npx prisma migrate dev
npm run db:seed
npm run dev
```

Il server sarà attivo su [http://localhost:3000](http://localhost:3000).

### 3. App Mobile

Installa le dipendenze e avvia l'ambiente di sviluppo Expo:

```bash
cd mobile
npm install
npm start
```
