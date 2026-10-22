# Project Experiences

Chronological notes from the project chats and work completed so far. Each entry represents one project chat, dated by the chat's start date.

## 2026-10-12 — Build Oro Toto website

- Created the responsive Oro Toto storefront with product cards, custom SVG product art, navigation, a shopping cart, and a demo contact form.
- Follow-up work in this chat included local-server setup and review. A review flagged that LAN binding should not expose project files; the current server uses an explicit public-file allowlist while retaining home-network access.

## 2026-10-12 — Add Reports page flow

- Added a Reports page and an Analyze Inventory subpage, connected through the site's hash navigation.
- At that point, the report displayed the storefront catalog because the site did not yet have inventory quantities.

## 2026-10-12 — Add inventory update button

- Added CSV inventory import to Analyze Inventory. The user clarified that imports should replace the current inventory for the browser session only.
- The importer validates the existing schema: `ID`, `Product`, `Category`, `Purity`, `Weight_g`, `Cost_USD`, `Price_USD`, and `Stock`. Invalid files leave the current inventory intact.
- Session-only storage means imports survive navigation within the same open tab, but reset after a refresh or tab close.

## 2026-10-12 — Add a hot-reload web server

- Added a dependency-free Node server and `start-server.bat` for local hosting with live reload and home-network access.
- Port `5173` was already occupied by a previously started instance, causing `EADDRINUSE`. The existing instance was stopped and the server was updated to show a clearer occupied-port message.

## 2026-10-12 — Add Orototo Git remote

- Initialized the repository on `main` and added `https://github.com/albertcapacitacion/orototo.git` as `origin`.

## 2026-10-15 — Integrate Formspree with cart

- Added cart order submission through Formspree, including required customer name and email, cart contents, and subtotal.
- The cart clears only after a successful response; failed requests preserve items for retry. A submitted cart is protected from accidental duplicate submission.
- The work was committed and pushed to `origin/main`.

## 2026-10-15 — Deploy site to GitHub Pages

- Published the site at [albertcapacitacion.github.io/orototo](https://albertcapacitacion.github.io/orototo/). HTTPS is enabled, and pushes to `main` trigger deployment.

## 2026-10-19 — Check inventory list persistence

- Confirmed that imported inventory remains in browser memory while navigating between pages in the same open tab.
- A refresh or closing the tab clears the import; persistent storage was not added.

## 2026-10-19 — Add inventory dashboard

- Replaced the initial inventory table view with a dashboard that remains hidden until a CSV upload succeeds. A failed upload preserves the existing session inventory.
- Added KPI cards for product count, units on hand, inventory at cost, potential retail value, and potential gross profit. Potential values use listed price and unit cost and exclude expenses.
- Added category charts for units and cost value, status counts, search, category and stock filters, and a product table with stock value.
- Added top-level highlights for the highest-cost product, total potential retail value, and every product with fewer than five units, including zero-stock items.
- Near out of stock is defined as fewer than five units; zero stock is also called out separately as out of stock. Purity remains part of the import schema but is omitted from business indicators.
- The dashboard is styled for mobile screens. A Playwright browser check with a synthetic four-product CSV confirmed the top highlights, near-out-of-stock filter, product search, and reset behavior. At a 390 px viewport there was no horizontal overflow, and the browser console had no errors.

## 2026-10-22 — Connect the local catalog and order database

- Kept the existing Node/HTML/CSS/JS application and added a Web Request/Response API with an isolated SQLite adapter. Sites deployment is deferred; a D1 adapter and hosted runtime verification are still required.
- After explicit approval, backed up SQLite, generated four demo product photos, assigned relative image paths, and made A1–A4 visible. Prices and other product data were preserved.
- Order saves use a transaction, database prices, historical item snapshots, and a unique request key so network retries do not insert duplicate orders.
- Kept Formspree after the database save. Browser testing showed a failed notification can be retried without another order insert. Database and notification success are reported separately; uncertain email retries can still duplicate an email.
- Restricted live reload to frontend source files, preventing database writes from interrupting checkout. Runtime databases and backup/test files are Git-ignored and are excluded from public-file serving.
- Seven API tests passed, including an injected item-insert failure proving full rollback. Playwright used an isolated DB and mocked Formspree to verify successful checkout, notification retry, preserved cart after save failure, all four loaded images, and mobile layout.
- Windows sandbox browser/network isolation required launching both the QA browser and a loopback-only QA server outside the sandbox. This avoided mistaking connectivity restrictions for an application defect.

## 2026-10-22 — Fix first-run setup and checkout review findings

- Added an explicit Node first-run initializer that reuses the existing schema and seed SQL. It reserves a new database filename exclusively and refuses to overwrite an existing file. Fresh-install creation, preparation, and refusal to overwrite were verified in an isolated installation.
- An input-event reset could create duplicate orders after a successful save whose response was lost. Retry keys now follow trimmed customer details and a sorted, aggregated cart, so whitespace edits and add/remove actions that restore the same order retain its key.
- Orders now include the displayed unit prices. The server checks those against current DB prices inside the transaction, rejects stale quotes without inserting records, and returns the prices for review. The frontend updates the cart total and requires a second submission.
- Eleven automated tests passed. Playwright reproduced a lost response after a real save, retried after whitespace edits and a restored cart, confirmed stale-price review, and verified Formspree notification retry. Browser checks used a separate fresh installation and mocked Formspree; the working database was not modified.
- Fixed the port-80 Host-header check: browsers omit the default HTTP port, so the allowlist now accepts portless localhost/127.0.0.1 only when configured for port 80. In-memory handler checks verify accepted hosts and continued rejection of unrelated hosts and wrong ports without opening the database.
