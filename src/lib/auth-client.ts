import { createAuthClient } from 'better-auth/react'
import { emailOTPClient } from 'better-auth/client/plugins'

// Client voor login. baseURL leeg → zelfde origin als de app. De emailOTP-plugin
// geeft toegang tot authClient.emailOtp.* (kopers-login met e-mailcode).
export const authClient = createAuthClient({
  plugins: [emailOTPClient()],
})

export const { signIn, signOut, useSession } = authClient
