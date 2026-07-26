import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { eventAgenda, eventFaq, eventSprekers, events } from '#/db/schema'
import { requireAuth } from '#/server/session'

// Beheer van publieke event-inhoud (sprekers, agenda, FAQ) voor de admin.
// Auth-gescoopt op organization_id (harde regel 3), gemodelleerd naar
// src/server/ticketTypes.ts.

async function assertEventInOrg(eventId: string, organizationId: string) {
  const rows = await db
    .select({ id: events.id })
    .from(events)
    .where(and(eq(events.id, eventId), eq(events.organization_id, organizationId)))
    .limit(1)
  if (rows.length === 0) throw new Error('Event niet gevonden')
}

// --- Sprekers ---

export const listSprekers = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }) => {
    const { organizationId } = await requireAuth()
    return db
      .select()
      .from(eventSprekers)
      .where(and(eq(eventSprekers.event_id, eventId), eq(eventSprekers.organization_id, organizationId)))
      .orderBy(asc(eventSprekers.volgorde))
  })

export const createSpreker = createServerFn({ method: 'POST' })
  .validator((data: { event_id: string; naam: string; rol: string; avatar_url: string }) => {
    if (!data.naam.trim()) throw new Error('Naam is verplicht')
    return data
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    await assertEventInOrg(data.event_id, organizationId)
    const bestaand = await db
      .select({ id: eventSprekers.id })
      .from(eventSprekers)
      .where(eq(eventSprekers.event_id, data.event_id))
    const [rij] = await db
      .insert(eventSprekers)
      .values({
        event_id: data.event_id,
        organization_id: organizationId,
        naam: data.naam.trim(),
        rol: data.rol.trim() || null,
        avatar_url: data.avatar_url.trim() || null,
        volgorde: String(bestaand.length),
      })
      .returning()
    return rij
  })

export const deleteSpreker = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { organizationId } = await requireAuth()
    await db
      .delete(eventSprekers)
      .where(and(eq(eventSprekers.id, id), eq(eventSprekers.organization_id, organizationId)))
    return { ok: true }
  })

// --- Agenda ---

export const listAgenda = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }) => {
    const { organizationId } = await requireAuth()
    return db
      .select()
      .from(eventAgenda)
      .where(and(eq(eventAgenda.event_id, eventId), eq(eventAgenda.organization_id, organizationId)))
      .orderBy(asc(eventAgenda.volgorde))
  })

export const createAgenda = createServerFn({ method: 'POST' })
  .validator((data: { event_id: string; tijd: string; titel: string; subtitel: string; beschrijving: string }) => {
    if (!data.tijd.trim()) throw new Error('Tijd is verplicht')
    if (!data.titel.trim()) throw new Error('Titel is verplicht')
    return data
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    await assertEventInOrg(data.event_id, organizationId)
    const bestaand = await db
      .select({ id: eventAgenda.id })
      .from(eventAgenda)
      .where(eq(eventAgenda.event_id, data.event_id))
    const [rij] = await db
      .insert(eventAgenda)
      .values({
        event_id: data.event_id,
        organization_id: organizationId,
        tijd: data.tijd.trim(),
        titel: data.titel.trim(),
        subtitel: data.subtitel.trim() || null,
        beschrijving: data.beschrijving.trim() || null,
        volgorde: String(bestaand.length),
      })
      .returning()
    return rij
  })

export const deleteAgenda = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { organizationId } = await requireAuth()
    await db.delete(eventAgenda).where(and(eq(eventAgenda.id, id), eq(eventAgenda.organization_id, organizationId)))
    return { ok: true }
  })

// --- FAQ ---

export const listFaq = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }) => {
    const { organizationId } = await requireAuth()
    return db
      .select()
      .from(eventFaq)
      .where(and(eq(eventFaq.event_id, eventId), eq(eventFaq.organization_id, organizationId)))
      .orderBy(asc(eventFaq.volgorde))
  })

export const createFaq = createServerFn({ method: 'POST' })
  .validator((data: { event_id: string; vraag: string; antwoord: string }) => {
    if (!data.vraag.trim()) throw new Error('Vraag is verplicht')
    return data
  })
  .handler(async ({ data }) => {
    const { organizationId } = await requireAuth()
    await assertEventInOrg(data.event_id, organizationId)
    const bestaand = await db.select({ id: eventFaq.id }).from(eventFaq).where(eq(eventFaq.event_id, data.event_id))
    const [rij] = await db
      .insert(eventFaq)
      .values({
        event_id: data.event_id,
        organization_id: organizationId,
        vraag: data.vraag.trim(),
        antwoord: data.antwoord.trim() || null,
        volgorde: String(bestaand.length),
      })
      .returning()
    return rij
  })

export const deleteFaq = createServerFn({ method: 'POST' })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { organizationId } = await requireAuth()
    await db.delete(eventFaq).where(and(eq(eventFaq.id, id), eq(eventFaq.organization_id, organizationId)))
    return { ok: true }
  })
