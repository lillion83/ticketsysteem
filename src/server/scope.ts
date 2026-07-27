import { createServerOnlyFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { eq } from 'drizzle-orm'
import type { Column, SQL } from 'drizzle-orm'
import { db } from '#/db/index'
import { events } from '#/db/schema'
import { auth } from '#/lib/auth'

export type SessieRol = { userId: string; rol: string; organizationId: string | null }

/** Ingelogde gebruiker + rol, zonder org-eis. Server-only. */
export const sessieRol = createServerOnlyFn(async (): Promise<SessieRol> => {
  const session = await auth.api.getSession({ headers: getRequest().headers })
  if (!session?.user) throw new Error('Niet ingelogd')
  const u = session.user as { organizationId?: string; rol?: string }
  return { userId: session.user.id, rol: u.rol ?? 'koper', organizationId: u.organizationId ?? null }
})

/**
 * Org-filter voor een WHERE. De admin (fase J) leest/bewerkt cross-org, dus geen
 * filter; iedereen anders wordt strikt op de eigen org gescoopt (harde regel 3).
 */
export function orgWhere(column: Column, ctx: SessieRol): SQL | undefined {
  if (ctx.rol === 'admin') return undefined
  return eq(column, ctx.organizationId ?? '')
}

/**
 * Bepaalt in welke organisatie een bewerking op EVENT-INHOUD valt (fase J).
 * - organisator: alleen de eigen org; het event moet daarin vallen (zelfde
 *   gedrag als requireAuth + de oude assertEventInOrg).
 * - admin: mag de inhoud van elk event bewerken → de org van het event zelf.
 *
 * Dit is de gedocumenteerde uitzondering op harde regel 3, hier uitgebreid naar
 * SCHRIJVEN op event-inhoud (naam/datum/status, tickettypes, sprekers/agenda/faq)
 * — bewust NIET naar tickets uitgeven, scannen of reserveringen. Server-only.
 */
export const requireContentAccess = createServerOnlyFn(
  async (eventId: string): Promise<{ userId: string; organizationId: string }> => {
    const session = await auth.api.getSession({ headers: getRequest().headers })
    if (!session?.user) throw new Error('Niet ingelogd')
    const u = session.user as { organizationId?: string; rol?: string }

    const rows = await db
      .select({ org: events.organization_id })
      .from(events)
      .where(eq(events.id, eventId))
      .limit(1)
    if (rows.length === 0) throw new Error('Event niet gevonden')
    const ev = rows[0]

    if (u.rol === 'admin') {
      return { userId: session.user.id, organizationId: ev.org }
    }
    if (!u.organizationId || ev.org !== u.organizationId) {
      throw new Error('Geen toegang tot dit event')
    }
    return { userId: session.user.id, organizationId: u.organizationId }
  },
)
