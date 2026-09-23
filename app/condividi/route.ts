import { NextResponse, type NextRequest } from 'next/server'

/**
 * Arrivo di riserva della condivisione di uno scontrino. Di norma il POST lo
 * intercetta il service worker (`public/sw.js`) e qui non arriva niente:
 * succede solo se il worker non è ancora attivo, per esempio con l'app
 * appena installata e mai aperta. Il file non si legge qui — una foto supera
 * facilmente il limite del corpo delle funzioni — si rimanda alla lista con
 * un messaggio che dice di riprovare.
 */
export function POST(request: NextRequest) {
  return NextResponse.redirect(new URL('/lista?condiviso=non-pronto', request.url), 303)
}

export function GET(request: NextRequest) {
  return NextResponse.redirect(new URL('/lista', request.url))
}
