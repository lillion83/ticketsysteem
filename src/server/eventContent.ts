import { createServerFn } from '@tanstack/react-start'
import { and, asc, eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { eventAgenda, eventFaq, eventSprekers } from '#/db/schema'
import { orgWhere, requireContentAccess, sessieRol } from '#/server/scope'

// Beheer van publieke event-inhoud (sprekers, agenda, FAQ). Org-gescoopt voor
// organisatoren; de admin mag cross-org bewerken (fase J), via
// requireContentAccess / orgWhere.

// --- Sprekers ---

export const listSprekers = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }) => {
    const { organizationId } = await requireContentAccess(eventId)
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
    const { organizationId } = await requireContentAccess(data.event_id)
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
    const ctx = await sessieRol()
    await db
      .delete(eventSprekers)
      .where(and(eq(eventSprekers.id, id), orgWhere(eventSprekers.organization_id, ctx)))
    return { ok: true }
  })

// --- Agenda ---

export const listAgenda = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }) => {
    const { organizationId } = await requireContentAccess(eventId)
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
    const { organizationId } = await requireContentAccess(data.event_id)
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
    const ctx = await sessieRol()
    await db.delete(eventAgenda).where(and(eq(eventAgenda.id, id), orgWhere(eventAgenda.organization_id, ctx)))
    return { ok: true }
  })

// --- FAQ ---

export const listFaq = createServerFn({ method: 'GET' })
  .validator((eventId: string) => eventId)
  .handler(async ({ data: eventId }) => {
    const { organizationId } = await requireContentAccess(eventId)
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
    const { organizationId } = await requireContentAccess(data.event_id)
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
    const ctx = await sessieRol()
    await db.delete(eventFaq).where(and(eq(eventFaq.id, id), orgWhere(eventFaq.organization_id, ctx)))
    return { ok: true }
  })
