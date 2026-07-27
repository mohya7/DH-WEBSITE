Digital Hub — IIS static publish package
==========================================

This folder is the PUBLIC website only (no Node.js required).

Do NOT open index.html by double-clicking.
Use IIS (or any HTTP server). Opening via file:// blocks the hero
fluid ES module and the page will look incomplete.

IIS quick setup
---------------
1. Copy this entire "publish" folder to your server
   (e.g. C:\inetpub\wwwroot\digital-hub).
2. IIS Manager → Sites → Add Website
   - Physical path: that folder
   - Binding: http, port 80 (or your host/header)
3. App Pool: No Managed Code (.NET CLR version = No Managed Code)
4. Browse http://your-site/

Admin / CMS
-----------
Content Studio (admin/) needs Node.js (npm start). It is not included
in this static package. Publish content locally/on Node first, then
re-run "npm run build" and redeploy this folder.
