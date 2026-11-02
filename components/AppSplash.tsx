import splash from '@/lib/splash-screens.json'

/**
 * Schermata di avvio dell'app installata: l'icona al centro e un indicatore di
 * caricamento sotto, finché la pagina non è arrivata tutta.
 *
 * Continua l'immagine di avvio di iOS (stesso fondo, icona della stessa misura
 * e nello stesso punto: le genera `scripts/generate-icons.mjs`) e la schermata
 * di Android (`background_color` del manifest), così al posto dello schermo
 * vuoto e poi degli scheletri si vede il logo fino al contenuto vero.
 *
 * È HTML e CSS puri, senza React: la accende `SPLASH_SCRIPT` nell'<head> solo
 * se l'app è aperta dalla schermata Home (nel browser una ricarica non deve
 * mostrare il logo), e la spegne a `DOMContentLoaded`, che con lo streaming
 * arriva quando tutti i Suspense della pagina sono stati riempiti. Lo stato
 * sta in `data-splash` su <html>, come `data-theme`: il nodo non cambia mai,
 * quindi l'idratazione non ha niente da correggere. Dopo 8 s si spegne
 * comunque, per non coprire una pagina lenta all'infinito.
 */
export const SPLASH_SCRIPT = `(function(){try{var d=document.documentElement;if(!(matchMedia('(display-mode: standalone)').matches||navigator.standalone))return;d.setAttribute('data-splash','on');var f=function(){d.setAttribute('data-splash','off')};document.addEventListener('DOMContentLoaded',f);setTimeout(f,8000)}catch(e){}})();`

export function AppSplash() {
  return (
    <div aria-hidden className="app-splash" style={{ background: splash.background }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/splash-icon.webp" alt="" width={splash.iconSize} height={splash.iconSize} />
      <span className="app-splash-spinner" />
    </div>
  )
}
