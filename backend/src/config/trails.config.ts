export interface TrailConfigItem {
  code: string;
  name: string;
  description: string;
  difficulty: 'T' | 'E' | 'EE' | 'EEA';
  gpxFilename: string;
  watchdogTolerancePct?: number;
  surfaceType?: string;
  isLoop?: boolean;
  seasonalClosure?: string;
  avgDurationMinutes?: number;
}

export const trailsConfig: TrailConfigItem[] = [
  // ── T01 · Sentiero dei Castagni (Viola) ────────────────────────────────────
  {
    code: 'T01',
    name: 'Sentiero dei Castagni (Viola)',
    description: 'Passeggiata turistica immersa tra i secolari boschi di castagno della vallata di Valle Castellana. Il percorso ad anello si sviluppa tra 647 e 1231 m di quota, offrendo scorci suggestivi sulla valle del Tronto e sulla catena dei Monti della Laga. Ideale per famiglie e principianti in ogni stagione.',
    difficulty: 'T',
    gpxFilename: 'Sentiero dei Castagni (viola)REV1.gpx',
    watchdogTolerancePct: 30,
    surfaceType: 'Terra battuta / Fogliame',
    isLoop: true,
  },

  // ── T02 · Sentiero di San Sisto (Blu) ──────────────────────────────────────
  {
    code: 'T02',
    name: 'Sentiero di San Sisto (Blu)',
    description: 'Percorso escursionistico che conduce ai ruderi storici dell\'eremo rurale di San Sisto, con vista panoramica sulla vallata. Il sentiero si sviluppa lungo il crinale tra boschi di faggio e praterie d\'alta quota, con dislivello costante tra 742 e 1203 m. Percorso non ad anello: necessario tornare sul medesimo tracciato.',
    difficulty: 'E',
    gpxFilename: 'Sentiero di San Sisto (BLU).gpx',
    watchdogTolerancePct: 40,
    surfaceType: 'Sentiero roccioso / sterrato',
    isLoop: false,
  },

  // ── T03 · Sentiero di Cucciola (Rosso) ─────────────────────────────────────
  {
    code: 'T03',
    name: 'Sentiero di Cucciola (Rosso)',
    description: 'Percorso breve ma intenso che guadagna rapidamente quota passando per la zona nota come Cucciola. In soli 1.1 km si salgono circa 164 m di dislivello tra i 888 e i 1052 m, attraversando un bosco misto di faggi e querce. Ottimo per un allenamento veloce o come variante di altri sentieri della rete.',
    difficulty: 'E',
    gpxFilename: 'Sentiero di Cucciola (ROSSO).gpx',
    watchdogTolerancePct: 35,
    surfaceType: 'Sentiero boschivo / Terra compatta',
    isLoop: false,
    avgDurationMinutes: 55,
  },

  // ── T04 · Sentiero delle Aquile (Verde) ────────────────────────────────────
  {
    code: 'T04',
    name: 'Sentiero delle Aquile (Verde)',
    description: 'Il percorso più panoramico della rete sentieristica di Valle Castellana. Si sviluppa per 10 km tra i 562 e i 1195 m di quota, attraversando praterie aperte dove è possibile avvistare rapaci — aquile reali e falchi pellegrini — che nidificano sulle pareti rocciose del Gran Sasso - Monti della Laga. Tratto finale esposto: si raccomanda attrezzatura adeguata.',
    difficulty: 'E',
    gpxFilename: 'Sentiero delle Aquile (VERDE).gpx',
    watchdogTolerancePct: 40,
    surfaceType: 'Sentiero di mezzacosta / Erba e roccia',
    isLoop: false,
  },

  // ── T05 · Sentiero della Mora (Giallo) ─────────────────────────────────────
  {
    code: 'T05',
    name: 'Sentiero della Mora (Giallo)',
    description: 'Il percorso più lungo e impegnativo della rete: 16.4 km con quota variabile tra 636 e 1292 m. Il sentiero attraversa l\'intero arco boschivo meridionale del territorio comunale, passando per antichi carbonili e vecchie mulattiere. La zona della Mora è nota per la presenza di more selvatiche e mirtilli in estate. Richiede buona preparazione atletica e autonomia idrica.',
    difficulty: 'EE',
    gpxFilename: 'Sentiero della mora (GIALLO).gpx',
    watchdogTolerancePct: 45,
    surfaceType: 'Mulattiera / Sentiero su cresta',
    isLoop: false,
  },

  // ── T06 · Sentiero del Traliccio (Nero) ────────────────────────────────────
  {
    code: 'T06',
    name: 'Sentiero del Traliccio (Nero)',
    description: 'Percorso tecnico breve (1.6 km) ma con forte dislivello: +281 m tra 831 e 1112 m. Deve il suo nome al traliccio dell\'alta tensione visibile sulla cima, che ne segna il punto di arrivo. Terreno ripido e a tratti scivoloso, spesso utilizzato dagli escursionisti esperti come esercizio di allenamento. Sconsigliato in condizioni di terreno bagnato.',
    difficulty: 'EE',
    gpxFilename: 'Sentiero del Traliccio (NERO).gpx',
    watchdogTolerancePct: 35,
    surfaceType: 'Sentiero ripido / Terreno instabile',
    isLoop: false,
    avgDurationMinutes: 70,
  },

  // ── T07 · Sentiero dell'Ara Martese (Azzurro) ──────────────────────────────
  {
    code: 'T07',
    name: 'Sentiero dell\'Ara Martese (Azzurro)',
    description: 'Percorso di cresta ad alta quota che si sviluppa tra i 1194 e i 1323 m, raggiungendo l\'Ara Martese: un\'area di interesse storico-archeoastronomico dove si trovano antiche pietre incise di epoca pre-romana. Il sentiero di 2.2 km offre viste a 360° sulla Valle dell\'Arno e sui Monti della Laga. Esposizione al vento: consigliato in giornate di bassa ventosità.',
    difficulty: 'EE',
    gpxFilename: 'Sentiero dell\'Ara Martese (AZZURRO).gpx',
    watchdogTolerancePct: 40,
    surfaceType: 'Sentiero di cresta / Pietrame',
    isLoop: false,
    avgDurationMinutes: 90,
  },
];
