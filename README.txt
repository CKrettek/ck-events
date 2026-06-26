CK Events Email V1

Neu:
- Netlify Function: netlify/functions/send-rsvp-email.js
- Nach RSVP wird automatisch eine Mail an Christian und an den Gast gesendet.
- Versand über Resend.

Wichtig:
Vor dem Test in Netlify unter Site configuration > Environment variables eintragen:
RESEND_API_KEY = Ihr Resend API Key

Dann diesen Ordner neu deployen.

Test:
1. RSVP mit Ihrer eigenen E-Mail absenden.
2. Prüfen, ob eine Mail an krettek@hotmail.com ankommt.
3. Falls Gast-Mail mit onboarding@resend.dev nicht an externe Empfänger geht, brauchen wir eine verifizierte Domain.
