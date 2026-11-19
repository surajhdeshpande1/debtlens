# DebtLens scenario packs: live demo manual

19 November 2026 · Suraj H Deshpande

## Before the demo

Every replay shows the same day with the same numbers each time, so one rehearsal per pack is enough. All numbers in this manual use the defaults: 40 hours to fix before the event and 300 simulated days.

1. **The day before.** Rehearse each pack you plan to show at 2× speed (press S once in the replay). Check that your numbers match the ones in this manual.
2. **Laptop.** Chrome or Edge, zoom at 100%, other tabs closed, charger in. On a projector, press F in the replay for full screen; 1366×768 and 1920×1080 both work.
3. **Ten minutes before.** Open `https://debtlens-bec.vercel.app/api/v1/health?warm=1` once. It wakes the server and loads the MiniLM model: look for `"available":true`. Then open `https://debtlens-bec.vercel.app`.
4. **Open the first pack early.** Open it once before the judges arrive, so the first open (about 3 seconds) is not in front of them.
5. **Keep the defaults** (40 h, 300 days) unless a judge asks for something else. Other values give different numbers, which are still correct.
6. **Terminal (optional).** In the project folder, with the `.venv` from `docs/LOCAL_SETUP.md`, use Windows Terminal or PowerShell, maximised. `--side` needs at least 120 columns.
7. **No internet?** `scripts\windows\start-sqlite.bat` runs the same site on the laptop at `http://localhost:8000`. Run `python -m debtlens model download` beforehand, while you still have internet.
8. **Sound** is off by default. Press M in the replay for alert beeps if the room has speakers.

## The live replay screen

The replay plays one typical simulated day minute by minute: the customer's phone on the left, the on-call engineer's screens in the middle, alerts on the right. Nothing is really frozen and no extra requests reach the server, so Esc always closes it.

| Part | What it shows | What to point at |
| --- | --- | --- |
| Top bar | Event, simulated day (for example day 141 of 300), clock, views, controls | The clock: the model is hourly, the minutes are spread out for reading |
| Traffic strip | 24 bars, traffic as a multiple of a normal peak hour; yellow line = now; red marks = hours with failing requests | The spike, and where the red starts |
| Phone | The customer's steps: tick when done, spinner when slow, the app's own error in red when a module is down | "&lt;App&gt; isn't responding" with Close app / Wait when the way in is down; the attempt count |
| Engineer tiles | Requests per minute, failing right now, requests failed today, engineer hours lost, incidents | Hours lost growing during the spike |
| Bots bar (bot attacks only) | Blue = people, orange = bots that get through, striped = bots blocked at the edge | The striped part appears only after the fixes |
| Module tiles | OK (green), HOT at 85% load or more (amber), DOWN (red), FAILING ← module (orange: a module it depends on is down) | Failures spreading from one module to the ones that call it |
| Alerts | Newest on top, with time and severity; CRITICAL ones page on-call; recoveries in green | The cost of each incident in engineer hours |
| Frozen device | When half the requests fail or the way in is down, the lane stops for a second or two, turns pale, says (Not Responding) and shows a wait cursor; the browser tab title says (Not Responding) | It then catches up all at once, like a hung laptop |
| End card | Hours lost, incidents, requests failed and the worst hour of the day | The button to the same day after the fixes |

| Key | Does |
| --- | --- |
| Space | Start, pause, resume |
| R | Restart the day |
| 1 / 2 / 3 | Today / After the fixes / Side by side |
| S | Speed: 1×, 2×, 4×, ½× |
| E | Frozen-device effects on or off |
| M | Sound on or off |
| F | Full screen |
| Esc | Close (in full screen, the first Esc leaves full screen) |

## RailYatra (`tatkal`): Tatkal at 10 AM and booking bots

The point to make: the right debt to fix depends on the day ahead. Before the Tatkal rush the spike plan saves 85.7 h where the regular sprint plan saves 34.6 h; against booking bots an 8-hour rate limit, DEBT-508, decides the day.

**Open it**

1. Home page → **Scenario packs** → RailYatra card → role **Tech Lead** → **Open**. Already inside a sandbox? Pick RailYatra in the drop-down in the top bar.
2. The home screen's headline: berths are allotted without a row lock, so every Tatkal rush can double-book a seat; fixing it costs 20 hours.

**Tell the story (about 1 minute)**

3. **Incidents → INC-519** (duplicate berth allocation on the Shatabdi). It is flagged as a regression of INC-503, and its 5 Whys end at "Berth allocation reads and writes seats without a row-level lock".
4. **Causal analysis**: that cause and "OTP SMS share one queue with bulk promotional messages" each lead to 3 incidents.

**Simulate the Tatkal rush**

5. **Simulation Lab → Load spike**. Event: **Tatkal opening at 10 AM (25× peak)**, under Rush-hour traffic. Leave 40 hours and 300 days. Press **Simulate the day**.
6. You should see 131.7 → 46.1 engineer hours lost and 30.4% → 7.5% of requests failing. The plan (37 h): DEBT-502 virtual waiting room (16 h), DEBT-503 availability cache (12 h), DEBT-510 PNR index (3 h), DEBT-507 OTP queue (6 h). It saves 85.7 h (95% CI 82.5–88.8) against 34.6 h for the regular sprint plan.

**Watch it live**

7. Press **▶ Live replay**, then **▶ Start the day**, then F. Simulated day 23 plays from 06:00 to 17:00, about 44 seconds at 1×.
8. What happens today:
    - 10:03 search is overloaded at 137% of capacity. Priya's seat check fails: "Could not fetch availability. Request timed out."
    - 10:04 the gateway and PNR overload. From her next attempt the app freezes: "RailYatra isn't responding".
    - 10:05 the central database goes down at 91% load; at 10:06 payments fails with it: "Payment pending: money may be debited. Do not pay again."
    - Worst hour 10:00, with 65% of requests failing; all clear at 12:27. Day over: 132.9 h lost, 6 incidents.
9. Press **▶ Same day, after the fixes**. The gateway and search hold, so the app no longer freezes. The database still goes down at 10:05 and takes payments and PNR with it, so Priya can still see "Payment pending" (worst hour 21% failing). Day over: 48.6 h, 3 incidents.
10. Press **Side by side** (or 3): the left lane freezes while the right one keeps booking.

**The bot attack**

11. Change the event to **Tatkal booking bots (60× peak)**, under Bot attacks. It simulates at once.
12. You should see 180.7 → 85.2 h and 71.8% → 19.8% failing. Bots are 60% of the extra traffic, and DEBT-508 (throttle logins and rate-limit bots before the Tatkal window, 8 h) blocks 90% of them. The plan (38 h): DEBT-508, DEBT-502, DEBT-512, DEBT-507. It saves 95.5 h against 4.9 h for the regular sprint plan, which leaves DEBT-508 out.
13. **▶ Live replay** (day 141): search and seats overload at 10:03, the gateway and PNR at 10:04, the database at 10:05, then booking, SMS and login by 10:09. At 10:00 all requests fail and the lane freezes again and again. Day over: 185.4 h, 10 incidents.
14. **After the fixes**: the bots bar shows the striped part blocked at the edge. The gateway, login and database hold; search, seats, booking, PNR and refunds still go down at 10:03–10:05 (worst hour 47% failing). Day over: 85.8 h, 5 incidents.

**In the terminal**

15. `python -m debtlens simulate spike -s tatkal -e tatkal-bots --live --side` plays the same day 141 with the same totals.

**If a judge asks**

- *Why does the regular plan miss DEBT-508?* It ranks debt by the hours it cost in the past. DEBT-508 has no incidents yet, so it ranks low, but it decides the bot day.
- *Is the freeze real?* No. It is drawn; Esc closes it, and no extra requests reach the server.

## NiveshTrade (`broker`): Budget day and a credential-stuffing attack

The point to make: on Budget day the spike plan saves 81.4 h where the regular sprint plan saves 45.3 h. The credential-stuffing attack is the honest exception: both plans contain the 5-hour login rate limit DEBT-607, so both save the whole day.

**Open it**

1. Home page → **Scenario packs** → NiveshTrade card → role **Tech Lead** → **Open** (or pick it in the top-bar drop-down).
2. The headline: the exchange gateway has no circuit breaker or failover line, so every line drop leaves orders stuck in "pending"; fixing it costs 14 hours.

**Tell the story**

3. **Incidents → INC-620** (orders stuck in pending again during a line failure). It is flagged as a regression of INC-605; its 5 Whys end at "The exchange gateway has no circuit breaker or failover to the backup line".
4. **Causal analysis**: that cause and "One process fans out every tick to every socket in a single loop" each lead to 3 incidents.

**Simulate Budget day**

5. **Simulation Lab → Load spike** → event **Union Budget day (12× peak)** → **Simulate the day**.
6. You should see 141.1 → 59.7 engineer hours lost and 18.3% → 8.5% of requests failing. The plan (39 h): DEBT-601 tick fan-out through a queue (20 h), DEBT-608 separate connection pools (10 h), DEBT-613 archive old trade history (6 h), DEBT-609 candle index (3 h). It saves 81.4 h (95% CI 78.6–84.3) against 45.3 h.

**Watch it live**

7. **▶ Live replay** → **▶ Start the day**. Day 89 plays from 06:00 to 18:00, about 50 seconds at 1×.
8. What happens today (Rahul, buying shares at the open):
    - 11:01 SMS overloads; 11:02 market data goes down: "Prices not updating. Showing last known price."
    - 11:05 the risk check (RMS) is at 137%: "RMS timeout. Order rejected." At 11:06 orders, charts and holdings go down: "Order failed. Please try again."
    - 11:09 the database goes down; at 11:12 login fails with it and the app freezes: "NiveshTrade isn't responding".
    - Worst hour 11:00, 91% failing; all clear at 13:08. Day over: 140.9 h, 8 incidents.
9. **After the fixes**: market data, the database and login hold, so the app never freezes; SMS, RMS, orders and holdings still go down at 11:01–11:06 (worst hour 45%). Day over: 62.6 h, 4 incidents.
10. **Side by side** to show both.

**The bot attack**

11. Event **Credential-stuffing attack (32× peak)**, under Bot attacks.
12. You should see 107.6 → 0.0 h and 92.4% → 0.0% failing. Bots are 97% of the extra traffic; DEBT-607 (rate limits and exponential backoff for login retries, 5 h) blocks 95% of them. The plan (37 h): DEBT-607, DEBT-603 circuit breaker (14 h), DEBT-604 client order IDs (8 h), DEBT-606 UPI reconciliation (10 h). The regular sprint plan also saves 107.6 h: DEBT-607 is cheap and its login incidents already cost about 34 hours a month.
13. **▶ Live replay** (day 12, from 00:00, about 56 seconds): at 02:04 login is at 241% and the app freezes; orders fail at 02:06 and the database at 02:09. Holdings, funds, RMS and the exchange link then fail one after another until 07:03. At 02:00 all requests fail. Day over: 107.6 h, 9 incidents.
14. **After the fixes**: nothing breaks all day. 0 h, 0 incidents.

**In the terminal**

15. `python -m debtlens simulate spike -s broker -e credential-stuffing --live --side`

**If a judge asks**

- *Why show a case where the plans agree?* Because DebtLens is not built to disagree: when the debt that already costs the most is also the one the day needs, both plans pick it.

## ZaikaNow (`food`): IPL final night and coupon-abuse bots

The point to make: on the final the spike plan saves 90.3 h where the regular sprint plan saves 59.6 h, and against coupon bots an 8-hour fix (DEBT-715) turns a 109-hour night into a quiet one.

**Open it**

1. Home page → **Scenario packs** → ZaikaNow card → role **Tech Lead** → **Open**.
2. The headline: riders are assigned in one city-wide batch every 60 seconds, so every big match night leaves thousands of orders waiting; fixing it costs 20 hours.

**Tell the story**

3. **Incidents → INC-719** (riders not assigned for 25 minutes during the semi-final). It is flagged as a regression of INC-709; its 5 Whys end at "Rider assignment runs as one city-wide batch every 60 seconds".
4. **Causal analysis**: that cause and "Menu availability is cached without invalidation when restaurants change it" each lead to 3 incidents.

**Simulate the final**

5. **Simulation Lab → Load spike** → event **IPL final night (9× peak)** → **Simulate the day**.
6. You should see 157.4 → 67.1 engineer hours lost and 21.6% → 12.4% of requests failing. The plan (37 h): DEBT-701 per-zone rider assignment (20 h), DEBT-709 separate connection pools (8 h), DEBT-711 push notifications through a queue (6 h), DEBT-712 menu index (3 h). It saves 90.3 h (95% CI 87.2–93.3) against 59.6 h.

**Watch it live**

7. **▶ Live replay** → **▶ Start the day**. Day 235 plays from 10:00 to midnight, about 57 seconds at 1×.
8. What happens today (Arjun, ordering dinner at the innings break):
    - 20:03 search is at 99%: "Search is taking too long."
    - 21:03 the cart and orders go down: "Coupon could not be applied. Try again." and "Order not placed. Please retry."
    - 21:04 rider assignment (122%): "Still looking for a rider…"; 21:05 restaurants' tablets: "Restaurant has not seen your order yet."
    - 22:04 the app itself fails because orders are down, and it freezes: "ZaikaNow isn't responding".
    - Worst hour 21:00, 67% failing; all clear at 23:23. Day over: 160.2 h, 6 incidents.
9. **After the fixes**: orders, rider assignment and the app hold, so it never freezes; search, the cart and the restaurant tablets still go down (worst hour 48%). Day over: 64.2 h, 3 incidents.
10. **Side by side** to show both.

**The bot attack**

11. Event **Coupon-abuse bots (20× peak)**, under Bot attacks.
12. You should see 109.1 → 0.1 h and 69.6% → 0.0% failing. Bots are 85% of the extra traffic; DEBT-715 (rate limits and device checks on coupon redemption, 8 h) blocks 90% of them. The plan (38 h): DEBT-715, DEBT-710 cached restaurant lists (12 h), DEBT-702 menu cache invalidation (6 h), DEBT-706 order-status backoff (12 h). It saves 109.0 h against 23.4 h for the regular sprint plan.
13. **▶ Live replay** (day 26): at 19:02 the menu (182%) and orders go down, at 19:05 the app is at 161% and freezes, then search at 19:08 and the cart at 19:09. Worst hour 19:00, 93% failing. Day over: 110.2 h, 6 incidents.
14. **After the fixes**: nothing breaks. 0 h, 0 incidents.

**In the terminal**

15. `python -m debtlens simulate spike -s food -e coupon-bots --live --side`

## KhelStream (`stream`): the World Cup final and restreaming bots

The point to make: restreaming bots are the costliest day in all seven packs, 269.2 hours, and a 10-hour fix to the stream links (DEBT-814) leads the plan that saves 233.1 h of it. The replays are long, so play them at 2× (press S once).

**Open it**

1. Home page → **Scenario packs** → KhelStream card → role **Tech Lead** → **Open**.
2. The headline: every playback start checks the subscription in the database, so the toss knocks over streams, licences and logins together; fixing it costs 20 hours.

**Tell the story**

3. **Incidents → INC-820** (video not starting for many viewers at the toss). It is flagged as a regression of INC-801; its 5 Whys end at "Every playback start checks entitlement in the database".
4. **Causal analysis**: that cause leads to 6 incidents, the most of any cause in the seven packs.

**Simulate the final**

5. **Simulation Lab → Load spike** → event **World Cup final (20× peak)** → **Simulate the day**.
6. You should see 152.6 → 63.3 engineer hours lost and 26.0% → 11.0% of requests failing. The plan (40 h): DEBT-809 separate connection pools (8 h), DEBT-808 cached live manifests at the edge (10 h), DEBT-804 pushed score updates (8 h), DEBT-806 version checks for device limits (8 h), DEBT-807 batched chat writes (6 h). It saves 89.3 h (95% CI 85.7–92.9) against 39.8 h.

**Watch it live**

7. **▶ Live replay** → **▶ Start the day** → S for 2×. Day 240 plays from 09:00 to midnight, about 79 seconds at 1×.
8. What happens today (the Sharma family, watching on their TV):
    - 18:01 the CDN is at 96%: "Buffering…"
    - 19:04 playback is at 118%: "Something went wrong. Error code PB-503."
    - 20:02 ads fail because the CDN is down: "Ad overran into live play." 20:03 scores: "Scorecard stuck." 20:06 the database and payments go down.
    - 21:04 login goes down and the TV app freezes: "KhelStream isn't responding".
    - Worst hour 21:00, 70% failing; all clear at 22:26. Day over: 156.3 h, 7 incidents.
9. **After the fixes**: the CDN, the database and login hold; playback (19:04), payments (20:06) and scores (21:05) still go down (worst hour 33%). Day over: 66.1 h, 3 incidents.
10. **Side by side** to show both.

**The bot attack**

11. Event **Restreaming bots (32× peak)**, under Bot attacks.
12. You should see 269.2 → 36.1 h and 55.2% → 2.1% failing. Bots are 50% of the extra traffic; DEBT-814 (tokenised manifest URLs and per-device rate limits, 10 h) blocks 90% of them. The plan (40 h): DEBT-814, DEBT-808 (10 h), DEBT-801 cached entitlements in a signed playback token (20 h). It saves 233.1 h against 68.1 h for the regular sprint plan.
13. **▶ Live replay** (day 248): the CDN goes down at 14:02 and playback with it ("Error code PB-503"), recovers by 17:10, and goes down again at 18:01. At 19:02 login and payments fail with the database and the TV app freezes; licences fail at 20:03 and the subscription check at 20:06 ("Subscribe to watch this match."). Worst hour 20:00, 100% failing. Day over: 267.4 h, 11 incidents.
14. **After the fixes**: only the database (21:01) and login (21:02) go down, near the end of the match (worst hour 18%). Day over: 33.8 h, 2 incidents.

**In the terminal**

15. `python -m debtlens simulate spike -s stream -e restream-bots --live --side --speed 4`

## SawariGo (`rides`): New Year's Eve and fare-scraping bots

The point to make: the fixes do not have to remove every failure to be worth it. On New Year's Eve the rider app still struggles after the fixes, yet the plan saves 79.6 h against 53.9 h; against fare scrapers a 6-hour rate limit (DEBT-914) saves 111.2 h.

**Open it**

1. Home page → **Scenario packs** → SawariGo card → role **Tech Lead** → **Open**.
2. The headline: matching searches every driver in the city for every ride request, so every busy night leaves riders searching; a geospatial index costs 12 hours.

**Tell the story**

3. **Incidents → INC-920** (riders waiting 20 minutes for a match across the city). It is flagged as a regression of INC-909; its 5 Whys end at "Matching searches every driver in the city instead of nearby cells".
4. **Causal analysis**: "Driver location pings are written to the main database every 3 seconds" leads to 4 incidents, the city-wide search to 3.

**Simulate New Year's Eve**

5. **Simulation Lab → Load spike** → event **New Year's Eve (8× peak)** → **Simulate the day**.
6. You should see 113.1 → 33.5 engineer hours lost and 15.6% → 5.2% of requests failing. The plan (39 h): DEBT-910 separate pools for trips and location writes (8 h), DEBT-906 priority queue for SOS alerts (6 h), DEBT-901 geospatial index (12 h), DEBT-909 trip notifications through a queue (5 h), DEBT-911 cached fare estimates (8 h). It saves 79.6 h (95% CI 77.3–81.9) against 53.9 h.

**Watch it live**

7. **▶ Live replay** → **▶ Start the day**. Day 33 plays from 06:00 to midnight, about 59 seconds at 1×.
8. What happens today (Neha, heading home at 23:45):
    - 21:08 the rider app goes down at 90% load and freezes: "SawariGo isn't responding".
    - 23:03 matching is at 124%: "No drivers available. Try again." The SOS service overloads at the same minute.
    - 23:05 notifications, 23:08 the database, 23:09 driver locations: "Driver location not updating."
    - Worst hour 23:00, 72% failing, and still failing at midnight. Day over: 112.2 h, 6 incidents.
9. **After the fixes**: matching, SOS, notifications and the database hold. The rider app (23:01) and driver locations (23:09) still go down, so Neha still sees the freeze (worst hour 56%). Day over: 36.8 h, 2 incidents.
10. **Side by side** to show both.

**The bot attack**

11. Event **Fare-scraping bots (16× peak)**, under Bot attacks.
12. You should see 112.0 → 0.7 h and 42.0% → 0.2% failing. Bots are 60% of the extra traffic; DEBT-914 (rate-limit fare estimate requests per device and API key, 6 h) blocks 90% of them. The plan uses only 22 of the 40 hours: DEBT-914, DEBT-911 cached fares (8 h), DEBT-903 fare holds (8 h). It saves 111.2 h against 14.8 h for the regular sprint plan.
13. **▶ Live replay** (day 2, a whole day, about 80 seconds: use 2×): at 18:03 the rider app is at 112% and freezes; at 21:09 fares fail ("Could not get fares right now."); then the database (22:01), maps (22:06), matching (23:03) and driver locations (23:09). Worst hour 22:00, 100% failing. Day over: 109.4 h, 6 incidents.
14. **After the fixes**: nothing breaks. 0 h, 0 incidents.

**In the terminal**

15. `python -m debtlens simulate spike -s rides -e fare-scrapers --live --side --speed 4`

**If a judge asks**

- *Why does the plan leave 18 hours unused?* After these three fixes only 0.7 h of the day is left to save, so DebtLens does not spend the other 18 hours.

## TaxSetu (`taxfiling`): ITR deadline night and credential stuffing on PAN login

The point to make: the deadline night has the largest saving of the seven busiest days, 104.8 h against 63.4 h for the regular sprint plan, and a 6-hour CAPTCHA and rate limit (DEBT-1014) turns the bot night from 123.7 h into almost nothing. Both replays cover a long day: play them at 2×.

**Open it**

1. Home page → **Scenario packs** → TaxSetu card → role **Tech Lead** → **Open**.
2. The headline: uploads are processed inside the web request, so every deadline night ends with returns stuck in "processing"; a durable queue costs 12 hours.

**Tell the story**

3. **Incidents → INC-1020** (return uploads stuck in processing). It is flagged as a regression of INC-1013; its 5 Whys end at "Uploads are processed synchronously in the web request".
4. **Causal analysis**: "Every form step fetches prefill data live instead of once per session" leads to 4 incidents; the shared OTP queue and unreconciled challans to 3 each.

**Simulate the deadline night**

5. **Simulation Lab → Load spike** → event **ITR deadline night (31 July) (15× peak)** → **Simulate the day**.
6. You should see 151.9 → 47.1 engineer hours lost and 27.0% → 8.8% of requests failing. The plan (40 h): DEBT-1009 separate connection pools (8 h), DEBT-1006 asynchronous uploads from a queue (12 h), DEBT-1001 cached prefill data (12 h), DEBT-1002 priority queue for e-verification OTPs (6 h), DEBT-1008 password-history index (2 h). It saves 104.8 h (95% CI 102.1–107.5) against 63.4 h.

**Watch it live**

7. **▶ Live replay** → **▶ Start the day** → S for 2×. Day 222 plays from 05:00 to midnight, about 80 seconds at 1×.
8. What happens today (Mr Kulkarni, filing ITR-1 at 23:30 on 31 July):
    - 21:07 login is at 103% and the app freezes: "TaxSetu isn't responding".
    - 21:09 prefill: "Prefill data could not be fetched." 22:01 the database goes down; 22:03 validation fails with it: "Validation timed out. Try again."
    - 22:04 the forms fail because prefill is down: "Session expired. Unsaved data is lost."
    - 22:05 e-verification: "OTP not received. Verify within 30 days." 22:09 uploads: "Submission stuck in processing."
    - Worst hour 22:00, 87% failing; all clear at 23:22. Day over: 158.9 h, 8 incidents.
9. **After the fixes**: prefill, the database, the forms and uploads hold. E-verification (22:05) and SMS (22:08) still go down, and login with them at 22:10, so the app freezes late in the night (worst hour 44%). Day over: 46.2 h, 3 incidents.
10. **Side by side** to show both.

**The bot attack**

11. Event **Credential stuffing on PAN login (25× peak)**, under Bot attacks.
12. You should see 123.7 → 0.1 h and 53.4% → 0.0% failing. Bots are 70% of the extra traffic; DEBT-1014 (rate limits and CAPTCHA after failed PAN logins, 6 h) blocks 90% of them. The plan (38 h): DEBT-1014, DEBT-1009 (8 h), DEBT-1002 (6 h), DEBT-1003 autosave and a longer session (6 h), DEBT-1006 (12 h). It saves 123.6 h against 22.3 h for the regular sprint plan.
13. **▶ Live replay** (day 68): SMS goes down at 20:02, the database and login at 20:06 and the app freezes; prefill (20:09) and the forms (20:11) fail with them. Later, e-verification, validation and uploads fail at 23:03–23:04. Worst hour 23:00, 100% failing. Day over: 123.3 h, 9 incidents.
14. **After the fixes**: nothing breaks. 0 h, 0 incidents.

**In the terminal**

15. `python -m debtlens simulate spike -s taxfiling -e pan-login-bots --live --side --speed 4`

## ShowPass (`tickets`): the stadium on-sale and scalper bots

The point to make: at noon the queue itself falls over first. The spike plan starts with a durable waiting room and saves 104.7 h against 67.4 h; against scalper bots, per-account limits (DEBT-1106) save 156.6 h where the regular sprint plan saves 5.8 h.

**Open it**

1. Home page → **Scenario packs** → ShowPass card → role **Tech Lead** → **Open**.
2. The headline: the waiting room keeps queue positions in memory, so one crash at the drop lets every fan in at once; a durable queue costs 14 hours.

**Tell the story**

3. **Incidents → INC-1120** (waiting room admitted everyone after a crash). It is flagged as a regression of INC-1101; its 5 Whys end at "The waiting room keeps queue positions in memory".
4. **Causal analysis**: that cause, the cron job that releases seat holds every 10 minutes and the missing payment reconciliation each lead to 3 incidents.

**Simulate the on-sale**

5. **Simulation Lab → Load spike** → event **Stadium tour on-sale at noon (30× peak)** → **Simulate the day**.
6. You should see 146.8 → 42.0 engineer hours lost and 36.8% → 11.9% of requests failing. The plan (40 h): DEBT-1101 durable waiting-room queue (14 h), DEBT-1108 shared connection pool for login (4 h), DEBT-1103 row-level lock on seat sales (8 h), DEBT-1102 cached seat map (8 h), DEBT-1111 cached event pages at the edge (6 h). It saves 104.7 h (95% CI 101.8–107.7) against 67.4 h.

**Watch it live**

7. **▶ Live replay** → **▶ Start the day**. Day 213 plays from 07:00 to 22:00, about 68 seconds at 1×.
8. What happens today (Divya, buying two tickets):
    - 12:01 the waiting room is at 109% and the app freezes: "ShowPass isn't responding".
    - 12:02 login goes down; 12:04 the website fails with it: "Too many requests. Please try again."
    - 12:05 checkout: "Checkout failed. Your seats were released." 12:08 the seat map (136%): "Seat map failed to load." 12:09 seat holds: "These seats were just taken."
    - Worst hour 12:00, 100% failing; all clear at 13:23. Day over: 152.3 h, 7 incidents.
9. **After the fixes**: the queue, login, website and seat map hold, so the app never freezes; checkout (12:05) and seat holds (12:09) still go down (worst hour 25%). Day over: 41.8 h, 2 incidents.
10. **Side by side** to show both.

**The bot attack**

11. Event **Scalper bots at the drop (50× peak)**, under Bot attacks.
12. You should see 159.2 → 2.6 h and 49.3% → 0.7% failing. Bots are 60% of the extra traffic; DEBT-1106 (per-account purchase limits and bot rate limits, 10 h) blocks 90% of them. The plan (40 h): DEBT-1106, DEBT-1102 (8 h), DEBT-1111 (6 h), DEBT-1108 (4 h), DEBT-1103 (8 h), DEBT-1110 checkout payment timeouts (4 h). It saves 156.6 h against 5.8 h.
13. **▶ Live replay** (day 1): the waiting room is at 182% at 12:01 and the app freezes; login and the website go down at 12:02, checkout and SMS at 12:05, the seat map (228%) at 12:08, the catalogue and seat holds at 12:09. Worst hour 12:00, 100% failing. Day over: 156.8 h, 8 incidents.
14. **After the fixes**: nothing breaks. 0 h, 0 incidents.

**In the terminal**

15. `python -m debtlens simulate spike -s tickets -e scalper-bots --live --side`

## Using your own pack file

This shows the judges that DebtLens is not tied to the bundled data: change a pack in front of them and the results change with it.

1. On a pack card, press **⬇ .json** to save it as `<code>.debtlens-pack.json` (for example `tatkal.debtlens-pack.json`).
2. Open it in Notepad or VS Code and change something visible: the system's `name`, a spike `profile` value (for example the 10:00 hour from 25 to 40), or add an incident.
3. On the home page, drop the file on the **Open a pack file** card (or click "Choose or drop a .json file"). DebtLens checks the file first and lists every problem it finds, with where it is.
4. Fix any problem it lists, pick a role and press **Open pack**. The pack opens in a sandbox like the bundled ones, live replay included.
5. A pack without a `journey` still gets a live replay: DebtLens builds a simple customer journey from the modules people enter through.
6. In the terminal, `python -m debtlens pack validate my-pack.json` gives the same check, and `--scenario my-pack.json` runs any command on it.

The file format, with every field, is in `docs/PACKS.md` in the repository.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| The first page or pack takes a few seconds | The free server was asleep. Open the health link from "Before the demo" ten minutes early. |
| The replay does not move | It is paused: press Space. If you switched tabs or minimised the browser, it pauses on its own and resumes when you come back. |
| Your numbers differ from this manual | Hours to fix before it or Simulated days was changed. Set them back to 40 and 300 and simulate again. |
| The incident is not flagged as a regression | The MiniLM model had not loaded yet. Open the health link, wait for `"available":true`, then reload. |
| The freezing is too much for the room | Press E to turn the frozen-device effects off; everything else keeps playing. |
| The replay is too slow or too fast | Press S to cycle 1×, 2×, 4× and ½×. Quiet hours already pass quickly. |
| The projector cuts off the edges | Press F for full screen; the layout adjusts to any size from 1366×768 up. |
| "Session expired" or a sign-in page | Sandboxes last 24 hours. Go to the home page and open the pack again. |
| The terminal replay looks broken | Use Windows Terminal or PowerShell and maximise it; `--side` needs 120 columns, otherwise it plays today and then after the fixes. |
| No internet in the hall | Run `scripts\windows\start-sqlite.bat` and open `http://localhost:8000`. |

## Quick reference

Averages over 300 simulated days with 40 hours to fix before the event; the replay columns are the one day the live replay shows (today → after the fixes). The website showed these same numbers on 19 November 2026.

| Pack | Busiest day | Hours lost, now → after | Saves vs regular plan | Replay day | Bot attack | Hours lost, now → after | Saves vs regular plan | Replay day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RailYatra `tatkal` | Tatkal at 10 AM, 25× | 131.7 → 46.1 | 85.7 vs 34.6 | #23: 132.9 → 48.6 | Booking bots, 60× (DEBT-508) | 180.7 → 85.2 | 95.5 vs 4.9 | #141: 185.4 → 85.8 |
| NiveshTrade `broker` | Budget day, 12× | 141.1 → 59.7 | 81.4 vs 45.3 | #89: 140.9 → 62.6 | Credential stuffing, 32× (DEBT-607) | 107.6 → 0.0 | 107.6 vs 107.6 | #12: 107.6 → 0.0 |
| ZaikaNow `food` | IPL final, 9× | 157.4 → 67.1 | 90.3 vs 59.6 | #235: 160.2 → 64.2 | Coupon bots, 20× (DEBT-715) | 109.1 → 0.1 | 109.0 vs 23.4 | #26: 110.2 → 0.0 |
| KhelStream `stream` | World Cup final, 20× | 152.6 → 63.3 | 89.3 vs 39.8 | #240: 156.3 → 66.1 | Restreaming bots, 32× (DEBT-814) | 269.2 → 36.1 | 233.1 vs 68.1 | #248: 267.4 → 33.8 |
| SawariGo `rides` | New Year's Eve, 8× | 113.1 → 33.5 | 79.6 vs 53.9 | #33: 112.2 → 36.8 | Fare scrapers, 16× (DEBT-914) | 112.0 → 0.7 | 111.2 vs 14.8 | #2: 109.4 → 0.0 |
| TaxSetu `taxfiling` | ITR deadline night, 15× | 151.9 → 47.1 | 104.8 vs 63.4 | #222: 158.9 → 46.2 | PAN login bots, 25× (DEBT-1014) | 123.7 → 0.1 | 123.6 vs 22.3 | #68: 123.3 → 0.0 |
| ShowPass `tickets` | Stadium on-sale, 30× | 146.8 → 42.0 | 104.7 vs 67.4 | #213: 152.3 → 41.8 | Scalper bots, 50× (DEBT-1106) | 159.2 → 2.6 | 156.6 vs 5.8 | #1: 156.8 → 0.0 |
