import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '#/db/index'
import { scannerSessions, scans, tickets } from '#/db/schema'
import { requireAuth } from '#/server/session'
import type { ScanResultaat } from '#/lib/scanResult'

// Fase F — live teller en scanlog. Alles org-gescoopt (harde regel 3).

export type EventStats = {
  verkocht: number // uitgegeven en niet ingetrokken
  binnen: number // gescand (gebruikt) en niet ingetrokken
  buiten: number // verkocht - binnen
  ingetrokken: number
}

export const getEventStats = createServerFn({ method: 'GET' })
  .validator((eventId: string) => {
    if (!eventId) throw new Error('eventId ontbreekt')
    return eventId
  })
  .handler(async ({ data: eventId }): Promise<EventStats> => {
    const { organizationId } = await requireAuth()

    const [rij] = await db
      .select({
        verkocht: sql<number>`count(*) filter (where ${tickets.ingetrokken_op} is null)`,
        binnen: sql<number>`count(*) filter (where ${tickets.gebruikt_op} is not null and ${tickets.ingetrokken_op} is null)`,
        ingetrokken: sql<number>`count(*) filter (where ${tickets.ingetrokken_op} is not null)`,
      })
      .from(tickets)
      .where(
        and(
          eq(tickets.event_id, eventId),
          eq(tickets.organization_id, organizationId),
        ),
      )

    const verkocht = Number(rij.verkocht)
    const binnen = Number(rij.binnen)
    return {
      verkocht,
      binnen,
      buiten: verkocht - binnen,
      ingetrokken: Number(rij.ingetrokken),
    }
  })

export type ScanLogRegel = {
  id: string
  tijdstip_server: string
  tijdstip_client: string | null
  resultaat: ScanResultaat
  koper_naam: string | null
  sessie_label: string | null
}

export const listScans = createServerFn({ method: 'GET' })
  .validator((eventId: string) => {
    if (!eventId) throw new Error('eventId ontbreekt')
    return eventId
  })
  .handler(async ({ data: eventId }): Promise<ScanLogRegel[]> => {
    const { organizationId } = await requireAuth()

    const rows = await db
      .select({
        id: scans.id,
        tijdstip_server: scans.tijdstip_server,
        tijdstip_client: scans.tijdstip_client,
        resultaat: scans.resultaat,
        koper_naam: tickets.koper_naam,
        sessie_label: scannerSessions.label,
      })
      .from(scans)
      .innerJoin(tickets, eq(scans.ticket_id, tickets.id))
      .leftJoin(
        scannerSessions,
        eq(scans.scanner_sessie_id, scannerSessions.id),
      )
      .where(
        and(
          eq(scans.event_id, eventId),
          eq(scans.organization_id, organizationId),
        ),
      )
      .orderBy(desc(scans.tijdstip_server))
      .limit(1000)

    return rows.map((r) => ({
      id: r.id,
      tijdstip_server: r.tijdstip_server.toISOString(),
      tijdstip_client: r.tijdstip_client
        ? r.tijdstip_client.toISOString()
        : null,
      resultaat: r.resultaat,
      koper_naam: r.koper_naam,
      sessie_label: r.sessie_label,
    }))
  })
