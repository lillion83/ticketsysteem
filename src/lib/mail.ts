// Transactionele mail via de Brevo REST API. Bewust geen SDK-dependency: één
// POST met een fetch is alles wat we nodig hebben.

const BREVO_ENDPOINT = 'https://api.brevo.com/v3/smtp/email'

export type MailBijlage = {
  /** Bestandsnaam zoals de ontvanger hem ziet. */
  naam: string
  /** Inhoud; wordt base64 richting Brevo gestuurd. */
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
 * Verstuurt één mail. Zonder BREVO_API_KEY wordt er niets verstuurd maar alleen
 * gelogd — zo werkt lokaal ontwikkelen zonder key, en faalt de uitgifteflow niet
 * op een ontbrekend geheim.
 */
export async function verstuurMail(input: MailInput): Promise<MailResultaat> {
  const apiKey = process.env.BREVO_API_KEY
  const afzenderEmail = process.env.BREVO_AFZENDER_EMAIL
  const afzenderNaam = process.env.BREVO_AFZENDER_NAAM ?? 'Ticketsysteem'

  if (!apiKey || !afzenderEmail) {
    console.warn(
      `[mail] BREVO_API_KEY of BREVO_AFZENDER_EMAIL ontbreekt — niet verstuurd. Zou gaan naar ${input.naar}: "${input.onderwerp}"`,
    )
    return { verzonden: false, reden: 'geen-api-key' }
  }

  const body = {
    sender: { name: afzenderNaam, email: afzenderEmail },
    to: [{ email: input.naar, name: input.naarNaam || undefined }],
    subject: input.onderwerp,
    htmlContent: input.html,
    attachment: input.bijlagen?.map((b) => ({
      name: b.naam,
      content: b.inhoud.toString('base64'),
    })),
  }

  const response = await fetch(BREVO_ENDPOINT, {
    method: 'POST',
    headers: {
      'api-key': apiKey,
      'content-type': 'application/json',
      accept: 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Brevo weigerde de mail (${response.status}): ${detail}`)
  }

  const data = (await response.json().catch(() => null)) as {
    messageId?: string
  } | null
  return { verzonden: true, messageId: data?.messageId ?? null }
}
