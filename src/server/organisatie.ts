import { createServerFn } from '@tanstack/react-start'
import { eq } from 'drizzle-orm'
import { db } from '#/db/index'
import { organizations, user } from '#/db/schema'
import { requireUser } from '#/server/session'

// Organisator-onboarding (fase H). Een ingelogde gebruiker zonder organisatie
// (bv. een koper uit fase K die zich via Google of e-mailcode heeft aangemeld)
// maakt hier zijn eigen organisatie aan en wordt daarmee organisator: hij krijgt
// een organization_id en dus toegang tot /admin en de organiseer-flow.
// Eén tenant per gebruiker; koppelt netjes op harde regel 3.

export type OrganisatieInput = {
  naam: string
  contactpersoon: string | null
  telefoon: string | null
}

export const wordOrganisator = createServerFn({ method: 'POST' })
  .validator((data: OrganisatieInput): OrganisatieInput => {
    if (!data.naam.trim()) throw new Error('Organisatienaam is verplicht')
    if (
      data.naam.length > 200 ||
      (data.contactpersoon?.length ?? 0) > 200 ||
      (data.telefoon?.length ?? 0) > 50
    ) {
      throw new Error('Invoer te lang')
    }
    return data
  })
  .handler(async ({ data }) => {
    const { userId } = await requireUser()

    // Al organisator? Dan niet nóg een organisatie aanmaken. Eén tenant per user.
    const [huidige] = await db
      .select({ organizationId: user.organizationId })
      .from(user)
      .where(eq(user.id, userId))
      .limit(1)
    if (huidige.organizationId) {
      throw new Error('Je bent al organisator')
    }

    const [org] = await db
      .insert(organizations)
      .values({
        naam: data.naam.trim(),
        contactpersoon: data.contactpersoon?.trim() || null,
        telefoon: data.telefoon?.trim() || null,
      })
      .returning({ id: organizations.id })

    await db
      .update(user)
      .set({ organizationId: org.id, rol: 'organisator', updatedAt: new Date() })
      .where(eq(user.id, userId))

    return { organizationId: org.id }
  })
