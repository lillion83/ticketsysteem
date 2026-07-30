// Vangnet tegen omgevingen die met de verkeerde gegevens draaien. Draait op
// module-scope, dus bij het eerste server-request al — net als de
// DATABASE_URL-controle in src/db/index.ts, waar dit patroon zich al bewijst.
//
// ALLEEN importeren uit server-code (src/db/index.ts, src/lib/auth.ts). Nooit uit
// een routecomponent of iets dat in de clientbundel belandt: een throw op
// module-scope zou daar de hele pagina slopen.
//
// Wat dit NIET is: de garantie. Die zit in de mapscheiding en in het feit dat
// `.env.production` alleen in de productiemap bestaat en door nitro in dev-mode
// nooit wordt ingelezen (nitro leest `.env.${mode}`). Dit is de laatste melding
// vóórdat er echte mail uitgaat of een productielink in een ticket belandt.

const PRODUCTIE_HOST = 'tickets.mijnonline.shop'

function fout(regels: Array<string>): never {
  throw new Error(['Omgevingsfout:', ...regels].join('\n'))
}

const appEnv = process.env.APP_ENV

if (!appEnv) {
  fout([
    '  APP_ENV is niet gezet.',
    '',
    '  Elk env-bestand hoort te zeggen in welke omgeving het thuishoort:',
    '    .env             APP_ENV=development',
    '    .env.test        APP_ENV=test',
    '    .env.production  APP_ENV=production',
    '',
    '  Zonder die regel kan niets controleren of je met de juiste database en',
    '  de juiste sleutels draait. Zie docs/SETUP-WINDOWS.md.',
  ])
}

if (appEnv !== 'production') {
  // Een echte mailkey buiten productie betekent dat een test echte mail naar
  // echte kopers stuurt, vanaf het productiedomein. Dit is precies wat er kon
  // gebeuren toen `.env.local` de dev-server overschreef.
  if (process.env.MAIL_API_KEY) {
    fout([
      `  APP_ENV=${appEnv}, maar MAIL_API_KEY is gevuld.`,
      '',
      '  Een niet-productieomgeving mag geen echte mailkey hebben: een test zou',
      '  dan echte mail versturen. Laat MAIL_API_KEY leeg — mail gaat dan naar',
      '  de console, wat voor ontwikkelen precies genoeg is.',
    ])
  }

  const urls = [process.env.PUBLIC_BASE_URL, process.env.BETTER_AUTH_URL]
  if (urls.some((u) => u?.includes(PRODUCTIE_HOST))) {
    fout([
      `  APP_ENV=${appEnv}, maar PUBLIC_BASE_URL of BETTER_AUTH_URL wijst naar ${PRODUCTIE_HOST}.`,
      '',
      '  Dan komen ticketlinks en scanner-koppel-QR’s op productie uit, terwijl je',
      '  in een testomgeving werkt. Zet beide op je eigen adres, bijvoorbeeld',
      '  http://localhost:3300.',
    ])
  }
} else {
  // De omgekeerde fout: een productiedeploy met een dev-env. Zonder https werkt
  // de camera-API van de scanner niet en klopt geen enkele ticketlink.
  const base = process.env.PUBLIC_BASE_URL
  if (!base?.startsWith('https://')) {
    fout([
      `  APP_ENV=production, maar PUBLIC_BASE_URL is ${base ?? 'niet gezet'}.`,
      '',
      '  Productie hoort een https-adres te hebben: de camera-API van de scanner',
      '  eist een secure context, en ticketlinks in mail moeten publiek werken.',
    ])
  }
}

export {}
