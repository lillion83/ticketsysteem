// Rollen (fase J). Eén bron van waarheid voor de drie rollen en waar elke rol
// na inloggen heen gaat. De DB-enum `gebruiker_rol` spiegelt deze waarden.

export type Rol = 'admin' | 'organisator' | 'koper'

export const ROL_LABEL: Record<Rol, string> = {
  admin: 'Admin',
  organisator: 'Organisator',
  koper: 'Koper',
}

/**
 * Het dashboard waar een rol na inloggen thuishoort. Onbekend/leeg → koper,
 * de minst bevoorrechte rol.
 */
export function homePathForRole(rol: string | null | undefined): string {
  switch (rol) {
    case 'admin':
      return '/platform'
    case 'organisator':
      return '/admin'
    default:
      return '/mijn-ticket'
  }
}
