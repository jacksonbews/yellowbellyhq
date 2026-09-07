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
  clientId: "",
  sheetId: "",
  tab: "Contacts"
};
