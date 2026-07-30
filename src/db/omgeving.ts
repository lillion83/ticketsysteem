import { closeDb } from './index'
import { omgevingsInfo } from './guard'

// Leest alleen, wijzigt niets: waar wijst deze configuratie naartoe?
// Draaien met: npm run db:omgeving  (of :test / :prod)
//
// Dit is het commando om te draaien vóór je iets doet waarvan je niet zeker weet
// welke database je raakt. Sneller dan psql erbij pakken, en het toont beide
// markeringen naast elkaar, zodat een mismatch meteen opvalt.

async function toonOmgeving() {
  const info = await omgevingsInfo()

  const regels: Array<[string, string]> = [
    ['APP_ENV', info.appEnv ?? '(niet gezet)'],
    ['DB-marker', info.dbMarker ?? '(niet gezet)'],
    ['database', info.database],
    ['host', info.host],
    ['UPLOAD_DIR', process.env.UPLOAD_DIR ?? '(niet gezet → ./uploads)'],
    ['PUBLIC_BASE_URL', process.env.PUBLIC_BASE_URL ?? '(niet gezet)'],
    ['PORT', process.env.PORT ?? '(niet gezet)'],
    [
      'mail',
      process.env.MAIL_API_KEY
        ? 'ECHTE key — mail gaat er werkelijk uit'
        : 'geen key → alleen console',
    ],
  ]

  const breedte = Math.max(...regels.map(([label]) => label.length))
  console.log('')
  for (const [label, waarde] of regels) {
    console.log(`  ${label.padEnd(breedte)}  ${waarde}`)
  }
  console.log('')

  if (info.dbMarker === 'production') {
    console.log(
      '  ⚠  Dit is de PRODUCTIEDATABASE. Seed- en resetscripts weigeren hier.',
    )
  } else if (!info.klopt) {
    console.log(
      '  ⚠  APP_ENV en de DB-marker kloppen niet met elkaar. Waarschijnlijk het',
    )
    console.log(
      '     verkeerde env-bestand bij deze database — niet gebruiken tot dit klopt.',
    )
  } else {
    console.log(`  ✓  Consistente ${info.appEnv}-omgeving.`)
  }
  console.log('')
}

toonOmgeving()
  .then(() => closeDb())
  .then(() => process.exit(0))
  .catch(async (fout) => {
    console.error(fout instanceof Error ? fout.message : fout)
    await closeDb().catch(() => {})
    process.exit(1)
  })
