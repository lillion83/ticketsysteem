// Transactionele mail via de Resend REST API. Bewust geen SDK-dependency: één
// POST met een fetch is alles wat we nodig hebben. Providerneutrale env-namen
// (MAIL_*), zodat een eventuele volgende overstap opnieuw alleen dit bestand
// raakt.

const RESEND_ENDPOINT = 'https://api.resend.com/emails'

export type MailBijlage = {
  /** Bestandsnaam zoals de ontvanger hem ziet. */
  naam: string
  /** Inhoud; wordt base64 richting Resend gestuurd. */
  inhoud: Buffer
}

export type MailInput = {
  naar: string
  naarNaam?: string | null
  onderwerp: string
  html: string
  bijlagen?: Array<MailBijlage>
}

export type MailResultaat =
  | { verzonden: true; messageId: string | null }
  | { verzonden: false; reden: string }

/**
 * Verstuurt één mail. Zonder MAIL_API_KEY wordt er niets verstuurd maar alleen
 * gelogd — zo werkt lokaal ontwikkelen zonder key, en faalt de uitgifteflow niet
 * op een ontbrekend geheim.
 */
export async function verstuurMail(input: MailInput): Promise<MailResultaat> {
  const apiKey = process.env.MAIL_API_KEY
  const afzenderEmail = process.env.MAIL_AFZENDER_EMAIL
  const afzenderNaam = process.env.MAIL_AFZENDER_NAAM ?? 'Ticketsysteem'

  if (!apiKey || !afzenderEmail) {
    console.warn(
      `[mail] MAIL_API_KEY of MAIL_AFZENDER_EMAIL ontbreekt — niet verstuurd. Zou gaan naar ${input.naar}: "${input.onderwerp}"`,
    )
    return { verzonden: false, reden: 'geen-api-key' }
  }

  const body = {
    // Resend wil "Naam <email>" of een kaal adres.
    from: `${afzenderNaam} <${afzenderEmail}>`,
    to: [input.naar],
    subject: input.onderwerp,
    html: input.html,
    attachments: input.bijlagen?.map((b) => ({
      filename: b.naam,
      content: b.inhoud.toString('base64'),
    })),
  }

  const response = await fetch(RESEND_ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Resend weigerde de mail (${response.status}): ${detail}`)
  }

  const data = (await response.json().catch(() => null)) as {
    id?: string
  } | null
  return { verzonden: true, messageId: data?.id ?? null }
}
