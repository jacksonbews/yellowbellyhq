/* ================================================================
   YELLOW BELLY HQ — Outreach integrations config
   ----------------------------------------------------------------
   Google Sheets sync for the Outreach page.

   Leave these blank and the tool behaves exactly as the prototype
   does now (a "Saved in Google Drive" confirmation, nothing written).

   Fill them in AFTER doing the Google Cloud setup (see the setup
   guide) and the tool will write every contact you add / import /
   update into a real Google Sheet, live:

     clientId  – your OAuth 2.0 *Web* client ID, ends in
                 ".apps.googleusercontent.com"
     sheetId   – the Sheet's ID, the long code in its URL:
                 docs.google.com/spreadsheets/d/<THIS_PART>/edit
     tab       – the tab (sheet) name to write into

   Only people signed in with a @yellowbellyphoto.com Workspace
   account can sync (the OAuth consent screen is set to "Internal").
   ================================================================ */
window.OUTREACH_GOOGLE = {
  // Web OAuth client (Google Auth Platform → Clients → "YB HQ Outreach"),
  // consent screen carries the gmail.send scope + origin https://ybhq.studio.
  // Enables "Send test now" (real send from the signed-in person's Gmail).
  clientId: "129769311846-iu0cjhbj2gt7c8fgejlpkch95eskh0t3.apps.googleusercontent.com",
  sheetId: "",
  tab: "Contacts"
};
