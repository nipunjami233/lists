// App-level config. Override via environment variables to personalize a deployment
// without committing personal info to source control.

export const APP_NAME = process.env.NEXT_PUBLIC_APP_NAME || 'Lists'
export const APP_TAGLINE = process.env.NEXT_PUBLIC_APP_TAGLINE || 'Shared lists for the household'
