# DebtLens live demo manual: every system and its situations

26 November 2026 · Suraj H Deshpande

This is the script for showing DebtLens live: for each of the 15 built-in systems, how to open it, the story to tell, its busiest day and one more situation, with the numbers and the alerts to expect. Every number and time here was produced by DebtLens 2.0.0 with the defaults: 40 hours to fix before the day, 300 simulated days, seed 17. The website and the terminal show the same numbers, because the simulation is deterministic.

## Before the demo

1. **The day before.** Rehearse each situation you plan to show at 2× (press S once in the replay), including the report. Check that your numbers match this manual.
2. **Laptop.** Chrome or Edge, zoom at 100% (Ctrl + 0), other tabs closed, notifications off, charger in. On a projector, press F in the replay for full screen; 1366×768 and 1920×1080 both work.
3. **Ten minutes before.** Open `https://debtlens-bec.vercel.app/api/v1/health?warm=1` once. It wakes the server and loads the MiniLM model: look for `"available":true`. Then open `https://debtlens-bec.vercel.app`.
4. **Open the first system early**, before the judges arrive, so the first open (up to 20 seconds on a cold server) is not in front of them.
5. **Keep the defaults** (40 hours, 300 days) unless a judge asks for something else. Other values give other numbers, which are just as correct.
6. **Terminal (optional).** In the project folder, with the `.venv` from the user guide (section 8), use Windows Terminal, maximised. `--side` needs at least 120 columns.
7. **No internet?** `scripts\windows\start-sqlite.bat` runs the same website on the laptop at `http://localhost:8000`. Run `python -m debtlens model download` beforehand, while you still have internet.
8. **Sound** is off at the start. Press M in the replay for alert beeps if the room has speakers.

## The four steps on the screen

**Simulate → Run a scenario** shows four steps at the top: **1 Pick a system**, **2 Pick a situation**, **3 Watch it happen**, **4 Read the report**. Opening a system from the start page lands on step 2. Each situation card shows its kind, when traffic peaks, what goes wrong and the debt item that guards against it. **Run this day →** simulates 300 days and opens the live replay of one of them; at the end of the day, **Read the report →** opens the report, which is saved under **Reports → Run reports**.

## The live replay screen

The replay plays one typical simulated day minute by minute: the customer's phone on the left, the on-call engineer's screens in the middle, alerts on the right. Nothing is really frozen and no extra requests reach the server, so Esc always closes it.

| Part | What it shows | What to point at |
| --- | --- | --- |
| Top bar | The situation, the simulated day (for example day 7 of 300), the clock, the views and the controls | The clock: the model is hourly, the minutes are spread out for reading |
| Traffic strip | 24 bars, traffic as a multiple of a normal busy hour; yellow line = now; red marks = hours with failing requests | Where the traffic builds, and where the red starts |
| Phone | The customer's steps: a tick when done, a spinner when slow, the app's own error when a module is down | “*App* isn't responding” with Close app / Wait when the way in is down; the attempt count |
| Engineer's numbers | Requests per minute, failing right now, requests failed today, engineer-hours lost, incidents | Hours lost growing while the day goes wrong |
| Bots bar (bot attacks only) | Blue = people, orange = bots that get through, striped = bots blocked at the edge | The striped part appears only after the fixes |
| Module tiles | OK, HOT (85% load or more), DOWN (overloaded), OUTAGE, BAD RELEASE, CRASHED (a random fault), FAILING ← module (a module it depends on is down) | Failures spreading from one module to the ones that call it |
| Alerts | Newest on top, with the time; ⚠ marks the situation's own trouble, ✓ marks trouble a fix prevented; CRITICAL ones page on-call | The engineer-hours each incident costs |
| Frozen device | While half or more of the requests fail, or the way in is down, the lane stops for a moment, turns pale, says (Not Responding) and shows a wait cursor | It then catches up all at once, like a hung laptop |
| End card | Hours lost, incidents, requests failed and the worst hour | **▶ Same day, after the fixes**, **Side by side**, **↺ Replay**, **Read the report →** |

| Key | Does |
| --- | --- |
| Space | Start, pause, resume |
| R | Restart the day |
| 1 / 2 / 3 | Today / After the fixes / Side by side |
| S | Speed: ½×, 1×, 2×, 4× |
| E | Frozen-device effects on or off |
| M | Sound on or off |
| F | Full screen |
| Esc | Close (in full screen, the first Esc leaves full screen) |

The phone runs in real time while the clock runs fast, so the customer can still be on a frozen screen for a few seconds after the dashboard turns green. Quiet hours pass quickly; busy hours play slowly.

## If a judge asks

- *Why do the numbers never reach zero after the fixes?* Every module also fails now and then at random, at the rate of its own past incidents, and a guarded situation still happens on some days. A fix makes a bad day rarer and cheaper, not impossible.
- *Why is the day in the replay not exactly the average?* It is one of the 300 simulated days, picked because it is close to the average both before and after the fixes. The report labels which numbers are the average and which are the day you watched.
- *Why does the regular sprint plan differ from the plan for the day?* The regular plan ranks debt by what it cost in the past, month after month. The plan for the day ranks it by what it protects on that day. When they agree, the report says so.
- *Is the freeze real?* No. It is drawn; Esc closes it, and no extra requests reach the server.

## PayCore (`fintech`): Salary day · Acquiring bank outage

The point to make: for “Salary day”, the plan for the day saves 151.6 h a day where the regular sprint plan saves 134.5 h. “Acquiring bank outage” (outage) costs 38.9 h on an average day today and 10.4 h after its fixes.

**Open it**

1. Start page → **PayCore** → **Open**. You land on **Pick a situation** as Ananya Rao (Engineering lead, payments), the Tech Lead.
2. **Overview** tells the story: One shared database connection pool has caused three checkout outages; separating it costs 16 hours.
3. **Incidents → INC-118** (“Checkout outage: connection pool limit reached again during festive sale”). Its 5 Whys end at “Batch jobs and the API share one connection pool with no isolation”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “Gateway client has no circuit breaker or fallback acquirer” (4 incidents) and “Batch jobs and the API share one connection pool with no isolation” (3 incidents).

**The busiest day: Salary day** (Rush)

5. **Simulate → Run a scenario** → **Salary day** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 197.4 → 45.8 engineer-hours lost, 19.9% → 5.5% of requests failing. The plan (40 h): DEBT-101 Separate connection pools for API traffic and batch jobs (24 h); DEBT-112 Alert and fall back to primary when replica lag exceeds 10 seconds (12 h); DEBT-105 Apply configurable timeouts on the UPI code path (4 h). It saves 151.6 h a day (95% CI 145.2–158), against 134.5 h for the regular sprint plan.
7. The replay opens on day 32 of 300. It plays 04:00 to midnight, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 08:04 db overloaded: 126% of its capacity. About 18.1 engineer-hours to handle.
    - 08:05 gateway failing: it depends on db, which is down. Paging on-call. About 23.6 engineer-hours to handle. The phone freezes: “PayCore checkout isn't responding”.
    - 09:02 checkout failing: it depends on gateway, which is down. Paging on-call. About 8.8 engineer-hours to handle.
    - 10:03 reporting failing: it depends on db, which is down. About 4.5 engineer-hours to handle.
    - 11:04 risk failing: it depends on db, which is down. About 11.2 engineer-hours to handle.
    - Day over: 184 h lost, 14 incidents; the worst hour is 12:00, with 74% of requests failing; everything is back by 21:25.
8. Press **▶ Same day, after the fixes**:
    - 10:05 db went down at 88% load, too close to its limit. About 18.1 engineer-hours to handle.
    - 10:06 gateway failing: it depends on db, which is down. Paging on-call. About 23.6 engineer-hours to handle. The phone freezes: “PayCore checkout isn't responding”.
    - 10:07 reporting failing: it depends on db, which is down. About 4.5 engineer-hours to handle.
    - Day over: 46.2 h lost, 3 incidents; the worst hour is 10:00, with 31% of requests failing; everything is back by 11:29. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “Salary day”, fix in this order: DEBT-101 (24 h), DEBT-112 (12 h), DEBT-105 (4 h).

**The second situation: Acquiring bank outage** (Outage)

10. In the report, press **Try another situation** → **Acquiring bank outage** → **Run this day →**.
11. Average day: 38.9 → 10.4 engineer-hours lost, 6.6% → 1.2% of requests failing. The plan (40 h): DEBT-104 Circuit breaker and fallback acquirer in the gateway client (40 h). It saves 28.5 h a day (95% CI 26.7–30.3), against 3 h for the regular sprint plan. What goes wrong at 18:40 (2 hours): The main acquiring bank stops answering authorisations. DEBT-104 guards against it and is in the plan.
12. The replay opens on day 7 of 300. It plays 11:00 to 23:00, about 35 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 13:18 ledger crashed on its own (a random fault). About 10 engineer-hours to handle.
    - 18:40 ⚠ The main acquiring bank stops answering authorisations.
    - 18:41 gateway stopped answering: what it depends on outside is down. Paging on-call. About 23.6 engineer-hours to handle. The phone freezes: “PayCore checkout isn't responding”.
    - 19:03 checkout failing: it depends on gateway, which is down. Paging on-call. About 8.8 engineer-hours to handle.
    - Day over: 42.4 h lost, 3 incidents; the worst hour is 19:00, with 48% of requests failing; everything is back by 20:09.
13. Press **▶ Same day, after the fixes**:
    - 13:18 ledger crashed on its own (a random fault). About 10 engineer-hours to handle.
    - 18:40 ✓ The circuit breaker tripped in 20 seconds and sent payments to the backup acquirer.
    - Day over: 10 h lost, 1 incident; everything is back by 14:14. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s fintech -e acquirer-outage --live --side` plays the same day 7, then prints the same report.

## CareStream HIS (`healthtech`): Monday morning OPD rush · SMS gateway outage on a Monday

The point to make: for “Monday morning OPD rush”, the plan for the day saves 59 h a day, about what the regular sprint plan saves. “SMS gateway outage on a Monday” (outage) costs 55.8 h on an average day today and 9.5 h after its fixes.

**Open it**

1. Start page → **CareStream HIS** → **Open**. You land on **Pick a situation** as Rahul Patil (Engineering lead, clinical systems), the Tech Lead.
2. **Overview** tells the story: An in-memory HL7 queue has dropped ICU vitals and lab results three times; a durable queue costs 28 hours.
3. **Incidents → INC-218** (“Vitals stream dropped again during ICU shift change”). Its 5 Whys end at “HL7 listener uses an in-memory queue that drops messages when full”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “HL7 listener uses an in-memory queue that drops messages when full” (3 incidents) and “Patient matching uses exact name and date-of-birth comparison” (3 incidents).

**The busiest day: Monday morning OPD rush** (Rush)

5. **Simulate → Run a scenario** → **Monday morning OPD rush** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 79.2 → 20.3 engineer-hours lost, 9.1% → 1.9% of requests failing. The plan (30 of the 40 hours): DEBT-211 Paginate and archive vitals history (12 h); DEBT-206 Asynchronous notification queue with retries and priorities (14 h); DEBT-210 Row-level lock on OPD slot reservation (4 h). It saves 59 h a day (95% CI 54.3–63.6); the regular sprint plan saves about the same (59.2 h).
7. The replay opens on day 213 of 300. It plays 05:00 to 23:00, about 70 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 09:02 db overloaded: 112% of its capacity. About 17.5 engineer-hours to handle.
    - 09:04 appointments failing: it depends on db, which is down. Paging on-call. About 14 engineer-hours to handle.
    - 09:04 emr failing: it depends on db, which is down. About 7.5 engineer-hours to handle.
    - 09:05 billing failing: it depends on db, which is down. About 15.8 engineer-hours to handle.
    - 09:05 pharmacy failing: it depends on db, which is down. About 10.8 engineer-hours to handle.
    - Day over: 81.5 h lost, 6 incidents; the worst hour is 09:00, with 55% of requests failing; everything is back by 20:07.
8. Press **▶ Same day, after the fixes**:
    - 19:22 billing crashed on its own (a random fault). About 15.8 engineer-hours to handle.
    - Day over: 15.8 h lost, 1 incident; the worst hour is 19:00, with 12% of requests failing; everything is back by 20:07. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “Monday morning OPD rush”, fix in this order: DEBT-211 (12 h), DEBT-206 (14 h), DEBT-210 (4 h). That leaves 10 h of the budget for other work.

**The second situation: SMS gateway outage on a Monday** (Outage)

10. In the report, press **Try another situation** → **SMS gateway outage on a Monday** → **Run this day →**.
11. Average day: 55.8 → 9.5 engineer-hours lost, 8.1% → 1.1% of requests failing. The plan (30 of the 40 hours): DEBT-206 Asynchronous notification queue with retries and priorities (14 h); DEBT-211 Paginate and archive vitals history (12 h); DEBT-210 Row-level lock on OPD slot reservation (4 h). It saves 46.3 h a day (95% CI 42.3–50.3); the regular sprint plan saves about the same (46.4 h). What goes wrong at 08:25 (2 hours): The SMS gateway stops accepting token and report messages. DEBT-206 guards against it and is in the plan.
12. The replay opens on day 238 of 300. It plays 06:00 to 14:00, about 25 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 08:25 ⚠ The SMS gateway stops accepting token and report messages.
    - 08:26 notify stopped answering: what it depends on outside is down. Paging on-call. About 14 engineer-hours to handle.
    - 09:02 db went down at 90% load, too close to its limit. About 17.5 engineer-hours to handle.
    - 09:14 pharmacy crashed on its own (a random fault). About 10.8 engineer-hours to handle.
    - 10:03 billing failing: it depends on db, which is down. About 15.8 engineer-hours to handle.
    - Day over: 58.2 h lost, 4 incidents; the worst hour is 09:00, with 26% of requests failing; everything is back by 11:20.
13. Press **▶ Same day, after the fixes**:
    - 08:25 ✓ Messages waited in the queue and went out when the gateway came back.
    - 09:14 pharmacy crashed on its own (a random fault). About 10.8 engineer-hours to handle.
    - Day over: 10.8 h lost, 1 incident; the worst hour is 09:00, with 10% of requests failing; everything is back by 10:11. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s healthtech -e sms-outage --live --side` plays the same day 238, then prints the same report.

## ShopSwift (`ecommerce`): Diwali sale · Order events replayed

The point to make: for “Diwali sale”, the plan for the day saves 26.4 h a day where the regular sprint plan saves 9.5 h. “Order events replayed” (retry storm) costs 51.4 h on an average day today and 3 h after its fixes.

**Open it**

1. Start page → **ShopSwift** → **Open**. You land on **Pick a situation** as Deepa Krishnan (Engineering lead, commerce), the Tech Lead.
2. **Overview** tells the story: Stock is only decremented after payment, so every flash sale oversells; reserving at checkout costs 24 hours.
3. **Incidents → INC-321** (“Flash sale oversold limited-edition sneakers”). Its 5 Whys end at “Stock is decremented after payment instead of reserved at checkout”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “Stock is decremented after payment instead of reserved at checkout” (3 incidents).

**The busiest day: Diwali sale** (Rush)

5. **Simulate → Run a scenario** → **Diwali sale** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 53.4 → 27.1 engineer-hours lost, 7.1% → 4.6% of requests failing. The plan (38 of the 40 hours): DEBT-301 Reserve stock at checkout with expiring holds (24 h); DEBT-302 Load tests for flash-sale concurrency (10 h); DEBT-314 Batch writes in the bulk price update job (4 h). It saves 26.4 h a day (95% CI 24–28.8), against 9.5 h for the regular sprint plan.
7. The replay opens on day 209 of 300. It plays 05:00 to midnight, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 17:29 search crashed on its own (a random fault). Paging on-call. About 12.8 engineer-hours to handle. The phone freezes: “ShopSwift isn't responding”.
    - 20:03 search overloaded: 117% of its capacity. Paging on-call. About 12.8 engineer-hours to handle.
    - 20:09 inventory overloaded: 121% of its capacity. About 21.2 engineer-hours to handle.
    - 20:10 warehouse failing: it depends on inventory, which is down. About 7.5 engineer-hours to handle.
    - Day over: 54.4 h lost, 4 incidents; the worst hour is 20:00, with 26% of requests failing; everything is back by 22:18.
8. Press **▶ Same day, after the fixes**:
    - 17:29 search crashed on its own (a random fault). Paging on-call. About 12.8 engineer-hours to handle. The phone freezes: “ShopSwift isn't responding”.
    - 20:03 search overloaded: 117% of its capacity. Paging on-call. About 12.8 engineer-hours to handle.
    - Day over: 25.7 h lost, 2 incidents; the worst hour is 17:00, with 20% of requests failing; everything is back by 22:18. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “Diwali sale”, fix in this order: DEBT-301 (24 h), DEBT-302 (10 h), DEBT-314 (4 h).

**The second situation: Order events replayed** (Retry storm)

10. In the report, press **Try another situation** → **Order events replayed** → **Run this day →**.
11. Average day: 51.4 → 3 engineer-hours lost, 4.4% → 0.2% of requests failing. The plan (32 of the 40 hours): DEBT-306 Idempotent order-event consumer in the warehouse (8 h); DEBT-301 Reserve stock at checkout with expiring holds (24 h). It saves 48.4 h a day (95% CI 46.6–50.2), against 2.1 h for the regular sprint plan. What goes wrong at 15:00 (3 hours): The warehouse processes six hours of order events twice. DEBT-306 guards against it and is in the plan. What goes wrong at 15:00 (3 hours): Duplicate reservations flood inventory. DEBT-306 guards against it and is in the plan.
12. The replay opens on day 6 of 300. It plays 11:00 to 21:00, about 40 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 15:00 ⚠ Duplicate reservations flood inventory. inventory is down to 30% of its capacity.
    - 15:00 ⚠ The warehouse processes six hours of order events twice. warehouse is down to 15% of its capacity.
    - 15:02 inventory overloaded: 151% of its capacity. About 21.2 engineer-hours to handle.
    - 15:04 cart failing: it depends on inventory, which is down. Paging on-call. About 8.8 engineer-hours to handle.
    - 15:05 warehouse overloaded: 135% of its capacity. About 7.5 engineer-hours to handle.
    - Day over: 51.5 h lost, 4 incidents; the worst hour is 16:00, with 44% of requests failing; everything is back by 18:22.
13. Press **▶ Same day, after the fixes**:
    - 15:00 ⚠ Duplicate reservations flood inventory. inventory is down to 72% of its capacity (softened by the fix).
    - 15:00 ⚠ The warehouse processes six hours of order events twice. warehouse is down to 66% of its capacity (softened by the fix).
    - Nothing fails all day.
    - Day over: 0 h lost, 0 incidents. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s ecommerce -e event-replay --live --side` plays the same day 6, then prints the same report.

## CampusOne ERP (`college`): Exam results day · Biometric sync floods the database

The point to make: for “Exam results day”, the plan for the day saves 40.6 h a day where the regular sprint plan saves 19.2 h. “Biometric sync floods the database” (database) costs 44.4 h on an average day today and 3 h after its fixes.

**Open it**

1. Start page → **CampusOne ERP** → **Open**. You land on **Pick a situation** as Harish Kulkarni (ERP development lead), the Tech Lead.
2. **Overview** tells the story: The results portal recomputes every SGPA on every page view and has crashed on three result days; precomputing costs 16 hours.
3. **Incidents → INC-422** (“Result portal crashed again for odd-semester results”). Its 5 Whys end at “Results are computed on the fly instead of precomputed and cached”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “Results are computed on the fly instead of precomputed and cached” (3 incidents) and “Payment callback handling is not idempotent” (3 incidents).

**The busiest day: Exam results day** (Rush)

5. **Simulate → Run a scenario** → **Exam results day** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 48.7 → 8.1 engineer-hours lost, 11.9% → 1% of requests failing. The plan (35 of the 40 hours): DEBT-401 Precompute results and serve cached result pages (16 h); DEBT-413 Batch attendance saves in one transaction (5 h); DEBT-408 Queued SMS sending with retries (8 h); DEBT-411 Centralise grade and SGPA rules (6 h). It saves 40.6 h a day (95% CI 37.8–43.4), against 19.2 h for the regular sprint plan.
7. The replay opens on day 19 of 300. It plays 06:00 to 22:00, about 75 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 10:07 results overloaded: 120% of its capacity. Paging on-call. About 25.4 engineer-hours to handle.
    - 11:03 reports failing: it depends on results, which is down. About 7.5 engineer-hours to handle.
    - 16:19 fees crashed on its own (a random fault). About 10 engineer-hours to handle.
    - Day over: 42.9 h lost, 3 incidents; the worst hour is 10:00, with 33% of requests failing; everything is back by 17:07.
8. Press **▶ Same day, after the fixes**:
    - 16:19 fees crashed on its own (a random fault). About 10 engineer-hours to handle.
    - Day over: 10 h lost, 1 incident; the worst hour is 16:00, with 3% of requests failing; everything is back by 17:07. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “Exam results day”, fix in this order: DEBT-401 (16 h), DEBT-413 (5 h), DEBT-408 (8 h), DEBT-411 (6 h). That leaves 5 h of the budget for other work.

**The second situation: Biometric sync floods the database** (Database)

10. In the report, press **Try another situation** → **Biometric sync floods the database** → **Run this day →**.
11. Average day: 44.4 → 3 engineer-hours lost, 4.8% → 0.2% of requests failing. The plan (5 of the 40 hours): DEBT-413 Batch attendance saves in one transaction (5 h). It saves 41.4 h a day (95% CI 39.4–43.4); the regular sprint plan saves about the same (41.5 h). What goes wrong at 09:30 (2 hours): Ten thousand single-row attendance saves hit the database. DEBT-413 guards against it and is in the plan.
12. The replay opens on day 200 of 300. It plays 06:00 to 14:00, about 25 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 08:07 library crashed on its own (a random fault). About 3 engineer-hours to handle.
    - 09:30 ⚠ Ten thousand single-row attendance saves hit the database. db is down to 12% of its capacity.
    - 09:33 db overloaded: 219% of its capacity. About 12.5 engineer-hours to handle.
    - 10:02 exams failing: it depends on db, which is down. About 10.5 engineer-hours to handle.
    - 10:03 results failing: it depends on exams, which is down. About 10.9 engineer-hours to handle.
    - Day over: 36.9 h lost, 4 incidents; everything is back by 11:19.
13. Press **▶ Same day, after the fixes**:
    - 08:07 library crashed on its own (a random fault). About 3 engineer-hours to handle.
    - 09:30 ⚠ Ten thousand single-row attendance saves hit the database. db is down to 65% of its capacity (softened by the fix).
    - Day over: 3 h lost, 1 incident; everything is back by 09:26. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s college -e attendance-sync --live --side` plays the same day 200, then prints the same report.

## RailYatra (`tatkal`): Tatkal opening at 10 AM · Tatkal booking bots

The point to make: for “Tatkal opening at 10 AM”, the plan for the day saves 62.7 h a day where the regular sprint plan saves 24.3 h. “Tatkal booking bots” (bots) costs 183.9 h on an average day today and 106 h after its fixes.

**Open it**

1. Start page → **RailYatra** → **Open**. You land on **Pick a situation** as Lakshmi Narayanan (Engineering lead, reservations), the Tech Lead.
2. **Overview** tells the story: Berths are allotted without a row lock, so every Tatkal rush can double-book a seat; fixing it costs 20 hours.
3. **Incidents → INC-519** (“Duplicate berth allocation on the Shatabdi”). Its 5 Whys end at “Berth allocation reads and writes seats without a row-level lock”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “Berth allocation reads and writes seats without a row-level lock” (3 incidents) and “OTP SMS share one queue with bulk promotional messages” (3 incidents).

**The busiest day: Tatkal opening at 10 AM** (Rush)

5. **Simulate → Run a scenario** → **Tatkal opening at 10 AM** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 124.5 → 61.8 engineer-hours lost, 28.4% → 10.4% of requests failing. The plan (37 of the 40 hours): DEBT-503 Serve seat availability from a precomputed cache (12 h); DEBT-502 Virtual waiting room: a durable queue for the Tatkal window (16 h); DEBT-507 Separate priority queue for OTP SMS (6 h); DEBT-510 Index PNR lookups by passenger mobile number (3 h). It saves 62.7 h a day (95% CI 58.5–66.8), against 24.3 h for the regular sprint plan.
7. The replay opens on day 60 of 300. It plays 06:00 to 19:00, about 55 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 10:03 search overloaded: 137% of its capacity. Paging on-call. About 21 engineer-hours to handle.
    - 10:03 seats went down at 96% load, too close to its limit. About 23.3 engineer-hours to handle.
    - 10:04 gateway failing: it depends on search, which is down. Paging on-call. About 52.5 engineer-hours to handle. The phone freezes: “RailYatra isn't responding”.
    - 10:05 refunds failing: it depends on seats, which is down. About 7.5 engineer-hours to handle.
    - 15:20 seats crashed on its own (a random fault). About 23.3 engineer-hours to handle.
    - Day over: 135.2 h lost, 6 incidents; the worst hour is 10:00, with 33% of requests failing; everything is back by 16:22.
8. Press **▶ Same day, after the fixes**:
    - 10:03 seats went down at 96% load, too close to its limit. About 23.3 engineer-hours to handle.
    - 10:05 refunds failing: it depends on seats, which is down. About 7.5 engineer-hours to handle.
    - 15:20 seats crashed on its own (a random fault). About 23.3 engineer-hours to handle.
    - 15:23 refunds failing: it depends on seats, which is down. About 7.5 engineer-hours to handle.
    - Day over: 61.7 h lost, 4 incidents; the worst hour is 10:00, with 1% of requests failing; everything is back by 16:22. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “Tatkal opening at 10 AM”, fix in this order: DEBT-503 (12 h), DEBT-502 (16 h), DEBT-507 (6 h), DEBT-510 (3 h).

**The second situation: Tatkal booking bots** (Bots)

10. In the report, press **Try another situation** → **Tatkal booking bots** → **Run this day →**.
11. Average day: 183.9 → 106 engineer-hours lost, 71% → 25.2% of requests failing. The plan (36 of the 40 hours): DEBT-508 Throttle logins and rate-limit bots before the Tatkal window (8 h); DEBT-502 Virtual waiting room: a durable queue for the Tatkal window (16 h); DEBT-503 Serve seat availability from a precomputed cache (12 h). It saves 77.9 h a day (95% CI 71.1–84.6), against 5.8 h for the regular sprint plan. Bots are 75% of the extra traffic; DEBT-508 blocks 90% of them at the edge and is in the plan.
12. The replay opens on day 2 of 300. It plays 06:00 to 17:00, about 45 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 10:03 search overloaded: 328% of its capacity. Paging on-call. About 21 engineer-hours to handle.
    - 10:03 seats overloaded: 232% of its capacity. About 23.3 engineer-hours to handle.
    - 10:04 gateway overloaded: 262% of its capacity. Paging on-call. About 52.5 engineer-hours to handle. The phone freezes: “RailYatra isn't responding”.
    - 10:04 pnr overloaded: 157% of its capacity. About 6 engineer-hours to handle.
    - 10:05 db overloaded: 219% of its capacity. About 10 engineer-hours to handle.
    - Day over: 185.4 h lost, 10 incidents; the worst hour is 11:00, with 100% of requests failing; everything is back by 12:30.
13. Press **▶ Same day, after the fixes**:
    - 10:05 db overloaded: 103% of its capacity. About 10 engineer-hours to handle.
    - 10:06 pnr failing: it depends on db, which is down. About 6 engineer-hours to handle.
    - 10:07 refunds failing: it depends on db, which is down. About 7.5 engineer-hours to handle.
    - 10:08 booking overloaded: 114% of its capacity. Paging on-call. About 28 engineer-hours to handle.
    - Day over: 104 h lost, 5 incidents; the worst hour is 10:00, with 47% of requests failing; everything is back by 11:29. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s tatkal -e tatkal-bots --live --side` plays the same day 2, then prints the same report.

## NiveshTrade (`broker`): Union Budget day · Credential-stuffing attack

The point to make: for “Union Budget day”, the plan for the day saves 62.6 h a day where the regular sprint plan saves 34.9 h. “Credential-stuffing attack” (bots) costs 107.7 h on an average day today and 7.1 h after its fixes.

**Open it**

1. Start page → **NiveshTrade** → **Open**. You land on **Pick a situation** as Ananya Iyer (Engineering lead, trading), the Tech Lead.
2. **Overview** tells the story: The exchange gateway has no circuit breaker or failover line, so every line drop leaves orders stuck in 'pending'; fixing it costs 14 hours.
3. **Incidents → INC-620** (“Orders stuck in pending again during a line failure”). Its 5 Whys end at “The exchange gateway has no circuit breaker or failover to the backup line”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “One process fans out every tick to every socket in a single loop” (3 incidents) and “The exchange gateway has no circuit breaker or failover to the backup line” (3 incidents).

**The busiest day: Union Budget day** (Rush)

5. **Simulate → Run a scenario** → **Union Budget day** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 128.6 → 66 engineer-hours lost, 18.7% → 10.5% of requests failing. The plan (40 h): DEBT-608 Separate connection pools for trading and back-office batch jobs (10 h); DEBT-602 Serve RMS checks from cached holdings and margins (12 h); DEBT-613 Paginate and archive trade history older than two years (6 h); DEBT-605 Row-level locks and a version column on order updates (6 h); DEBT-610 Send order alerts through a durable queue (6 h). It saves 62.6 h a day (95% CI 59.2–66), against 34.9 h for the regular sprint plan.
7. The replay opens on day 236 of 300. It plays 06:00 to 18:00, about 50 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 11:01 notify overloaded: 109% of its capacity. About 7.5 engineer-hours to handle.
    - 11:02 marketdata overloaded: 109% of its capacity. Paging on-call. About 37.3 engineer-hours to handle.
    - 11:05 rms overloaded: 137% of its capacity. About 17.5 engineer-hours to handle.
    - 11:06 charts overloaded: 109% of its capacity. About 10 engineer-hours to handle.
    - 11:06 orders overloaded: 113% of its capacity. Paging on-call. About 23.6 engineer-hours to handle.
    - Day over: 120 h lost, 7 incidents; the worst hour is 11:00, with 75% of requests failing; everything is back by 13:08.
8. Press **▶ Same day, after the fixes**:
    - 11:02 marketdata overloaded: 109% of its capacity. Paging on-call. About 37.3 engineer-hours to handle.
    - 11:05 rms went down at 82% load, too close to its limit. About 17.5 engineer-hours to handle.
    - 11:06 charts overloaded: 109% of its capacity. About 10 engineer-hours to handle.
    - Day over: 64.8 h lost, 3 incidents; the worst hour is 11:00, with 30% of requests failing; everything is back by 12:29. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “Union Budget day”, fix in this order: DEBT-608 (10 h), DEBT-602 (12 h), DEBT-613 (6 h), DEBT-605 (6 h), DEBT-610 (6 h).

**The second situation: Credential-stuffing attack** (Bots)

10. In the report, press **Try another situation** → **Credential-stuffing attack** → **Run this day →**.
11. Average day: 107.7 → 7.1 engineer-hours lost, 92.4% → 6.1% of requests failing. The plan (5 of the 40 hours): DEBT-607 Rate limits and exponential backoff for login retries (5 h). It saves 100.6 h a day (95% CI 97.8–103.4); the regular sprint plan saves about the same (100.8 h). Bots are 97% of the extra traffic; DEBT-607 blocks 95% of them at the edge and is in the plan.
12. The replay opens on day 210 of 300. It plays 00:00 to 16:00, about 70 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 02:04 auth overloaded: 241% of its capacity. Paging on-call. About 21 engineer-hours to handle. The phone freezes: “NiveshTrade isn't responding”.
    - 02:09 db overloaded: 151% of its capacity. About 10 engineer-hours to handle.
    - 03:03 funds failing: it depends on db, which is down. About 9 engineer-hours to handle.
    - 04:04 exchange failing: it depends on db, which is down. About 16 engineer-hours to handle.
    - 06:04 exchange failing: it depends on db, which is down. About 16 engineer-hours to handle.
    - Day over: 106.1 h lost, 9 incidents; the worst hour is 02:00, with 100% of requests failing; everything is back by 13:18.
13. Press **▶ Same day, after the fixes**:
    - 12:36 charts crashed on its own (a random fault). About 6 engineer-hours to handle.
    - Day over: 6 h lost, 1 incident; everything is back by 13:18. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s broker -e credential-stuffing --live --side` plays the same day 210, then prints the same report.

## ZaikaNow (`food`): IPL final night · Coupon-abuse bots

The point to make: for “IPL final night”, the plan for the day saves 60.2 h a day where the regular sprint plan saves 41.9 h. “Coupon-abuse bots” (bots) costs 112.9 h on an average day today and 28.3 h after its fixes.

**Open it**

1. Start page → **ZaikaNow** → **Open**. You land on **Pick a situation** as Shreya Banerjee (Engineering lead, ordering), the Tech Lead.
2. **Overview** tells the story: Riders are assigned in one city-wide batch every 60 seconds, so every big match night leaves thousands of orders waiting; fixing it costs 20 hours.
3. **Incidents → INC-719** (“Riders not assigned for 25 minutes during the semi-final”). Its 5 Whys end at “Rider assignment runs as one city-wide batch every 60 seconds”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “Rider assignment runs as one city-wide batch every 60 seconds” (3 incidents) and “Menu availability is cached without invalidation when restaurants change it” (3 incidents).

**The busiest day: IPL final night** (Rush)

5. **Simulate → Run a scenario** → **IPL final night** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 145.6 → 85.4 engineer-hours lost, 20.6% → 14.1% of requests failing. The plan (37 of the 40 hours): DEBT-701 Assign riders continuously from a per-zone queue of workers (20 h); DEBT-709 Separate connection pools for order writes and analytics batch jobs (8 h); DEBT-711 Send push notifications through a durable queue (6 h); DEBT-712 Index menu items by restaurant and availability (3 h). It saves 60.2 h a day (95% CI 55.8–64.5), against 41.9 h for the regular sprint plan.
7. The replay opens on day 268 of 300. It plays 10:00 to midnight, about 55 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 20:02 orders went down at 85% load, too close to its limit. About 22.5 engineer-hours to handle.
    - 20:08 dispatch went down at 88% load, too close to its limit. Paging on-call. About 42 engineer-hours to handle.
    - 21:03 cart went down at 96% load, too close to its limit. Paging on-call. About 15.2 engineer-hours to handle.
    - 21:04 menu overloaded: 109% of its capacity. About 15 engineer-hours to handle.
    - 21:07 search overloaded: 137% of its capacity. Paging on-call. About 17.5 engineer-hours to handle.
    - Day over: 151.2 h lost, 7 incidents; the worst hour is 21:00, with 70% of requests failing; everything is back by 23:27.
8. Press **▶ Same day, after the fixes**:
    - 21:03 cart went down at 96% load, too close to its limit. Paging on-call. About 15.2 engineer-hours to handle.
    - 21:03 orders went down at 82% load, too close to its limit. About 22.5 engineer-hours to handle.
    - 21:07 search overloaded: 137% of its capacity. Paging on-call. About 17.5 engineer-hours to handle.
    - 21:09 app went down at 96% load, too close to its limit. Paging on-call. About 31.5 engineer-hours to handle. The phone freezes: “ZaikaNow isn't responding”.
    - Day over: 86.7 h lost, 4 incidents; the worst hour is 21:00, with 52% of requests failing; everything is back by 23:08. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “IPL final night”, fix in this order: DEBT-701 (20 h), DEBT-709 (8 h), DEBT-711 (6 h), DEBT-712 (3 h).

**The second situation: Coupon-abuse bots** (Bots)

10. In the report, press **Try another situation** → **Coupon-abuse bots** → **Run this day →**.
11. Average day: 112.9 → 28.3 engineer-hours lost, 68.9% → 9.1% of requests failing. The plan (29 of the 40 hours): DEBT-715 Rate limits and device checks on coupon redemption (8 h); DEBT-710 Serve area restaurant lists from a precomputed cache (12 h); DEBT-712 Index menu items by restaurant and availability (3 h); DEBT-702 Invalidate the menu cache when a restaurant changes availability or prices (6 h). It saves 84.6 h a day (95% CI 82.3–86.9), against 20.2 h for the regular sprint plan. Bots are 85% of the extra traffic; DEBT-715 blocks 90% of them at the edge and is in the plan.
12. The replay opens on day 114 of 300. It plays 10:00 to midnight, about 55 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 19:02 menu overloaded: 182% of its capacity. About 15 engineer-hours to handle.
    - 19:02 orders overloaded: 104% of its capacity. About 22.5 engineer-hours to handle.
    - 19:05 app overloaded: 161% of its capacity. Paging on-call. About 31.5 engineer-hours to handle. The phone freezes: “ZaikaNow isn't responding”.
    - 19:08 search overloaded: 228% of its capacity. About 12.5 engineer-hours to handle.
    - 19:09 cart overloaded: 161% of its capacity. Paging on-call. About 15.2 engineer-hours to handle.
    - Day over: 114.7 h lost, 6 incidents; the worst hour is 19:00, with 93% of requests failing; everything is back by 23:23.
13. Press **▶ Same day, after the fixes**:
    - 20:04 app went down at 93% load, too close to its limit. Paging on-call. About 31.5 engineer-hours to handle. The phone freezes: “ZaikaNow isn't responding”.
    - Day over: 31.5 h lost, 1 incident; the worst hour is 20:00, with 36% of requests failing; everything is back by 22:14. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s food -e coupon-bots --live --side` plays the same day 114, then prints the same report.

## KhelStream (`stream`): World Cup final · Restreaming bots

The point to make: for “World Cup final”, the plan for the day saves 78.3 h a day where the regular sprint plan saves 50.9 h. “Restreaming bots” (bots) costs 241.7 h on an average day today and 65.4 h after its fixes.

**Open it**

1. Start page → **KhelStream** → **Open**. You land on **Pick a situation** as Priya Raghavan (Engineering lead, playback), the Tech Lead.
2. **Overview** tells the story: Every playback start checks the subscription in the database, so the toss knocks over streams, licences and logins together; fixing it costs 20 hours.
3. **Incidents → INC-820** (“Video not starting for many viewers at the toss”). Its 5 Whys end at “Every playback start checks entitlement in the database”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “Every playback start checks entitlement in the database” (6 incidents) and “Ad break length is hard-coded instead of read from the live signal” (3 incidents).

**The busiest day: World Cup final** (Rush)

5. **Simulate → Run a scenario** → **World Cup final** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 156 → 77.8 engineer-hours lost, 25.7% → 11.7% of requests failing. The plan (38 of the 40 hours): DEBT-808 Serve cached live manifests from the edge for two seconds (10 h); DEBT-809 Separate connection pools for playback reads and billing batch jobs (8 h); DEBT-801 Serve cached entitlements from a signed playback token (20 h). It saves 78.3 h a day (95% CI 74.1–82.4), against 50.9 h for the regular sprint plan.
7. The replay opens on day 236 of 300. It plays 09:00 to midnight, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 19:04 playback overloaded: 118% of its capacity. Paging on-call. About 44.3 engineer-hours to handle.
    - 20:05 cdn overloaded: 145% of its capacity. Paging on-call. About 31.5 engineer-hours to handle.
    - 20:06 db overloaded: 105% of its capacity. About 15 engineer-hours to handle.
    - 20:09 subs failing: it depends on db, which is down. About 15 engineer-hours to handle.
    - 20:12 drm failing: it depends on subs, which is down. About 25 engineer-hours to handle.
    - Day over: 169.3 h lost, 7 incidents; the worst hour is 21:00, with 70% of requests failing; everything is back by 22:26.
8. Press **▶ Same day, after the fixes**:
    - 20:38 auth crashed on its own (a random fault). Paging on-call. About 26.2 engineer-hours to handle. The phone freezes: “KhelStream isn't responding”.
    - 20:39 playback failing: it depends on auth, which is down. Paging on-call. About 44.3 engineer-hours to handle.
    - 21:05 scores overloaded: 109% of its capacity. Paging on-call. About 12.2 engineer-hours to handle.
    - Day over: 82.8 h lost, 3 incidents; the worst hour is 21:00, with 52% of requests failing; everything is back by 22:26. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “World Cup final”, fix in this order: DEBT-808 (10 h), DEBT-809 (8 h), DEBT-801 (20 h).

**The second situation: Restreaming bots** (Bots)

10. In the report, press **Try another situation** → **Restreaming bots** → **Run this day →**.
11. Average day: 241.7 → 65.4 engineer-hours lost, 53.7% → 10.4% of requests failing. The plan (40 h): DEBT-814 Tokenised manifest URLs and per-device rate limits (10 h); DEBT-809 Separate connection pools for playback reads and billing batch jobs (8 h); DEBT-808 Serve cached live manifests from the edge for two seconds (10 h); DEBT-810 Timeouts on ad and licence calls during playback start (4 h); DEBT-806 Optimistic version checks instead of row locks for device limits (8 h). It saves 176.3 h a day (95% CI 170.4–182.3), against 40.4 h for the regular sprint plan. Bots are 50% of the extra traffic; DEBT-814 blocks 90% of them at the edge and is in the plan.
12. The replay opens on day 129 of 300. It plays 09:00 to midnight, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 13:02 playback went down at 69% load, too close to its limit. Paging on-call. About 44.3 engineer-hours to handle.
    - 14:02 cdn overloaded: 129% of its capacity. Paging on-call. About 31.5 engineer-hours to handle.
    - 15:07 db went down at 88% load, too close to its limit. About 15 engineer-hours to handle.
    - 15:10 subs failing: it depends on db, which is down. About 15 engineer-hours to handle.
    - 15:13 drm failing: it depends on subs, which is down. Paging on-call. About 35 engineer-hours to handle.
    - Day over: 249.1 h lost, 11 incidents; the worst hour is 20:00, with 100% of requests failing; everything is back by 22:30.
13. Press **▶ Same day, after the fixes**:
    - 19:04 playback went down at 94% load, too close to its limit. Paging on-call. About 44.3 engineer-hours to handle.
    - 21:01 db went down at 85% load, too close to its limit. About 15 engineer-hours to handle.
    - Day over: 59.3 h lost, 2 incidents; the worst hour is 19:00, with 24% of requests failing; everything is back by 22:24. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s stream -e restream-bots --live --side` plays the same day 129, then prints the same report.

## SawariGo (`rides`): New Year's Eve · Fare-scraping bots

The point to make: for “New Year's Eve”, the plan for the day saves 57.2 h a day where the regular sprint plan saves 39.1 h. “Fare-scraping bots” (bots) costs 109 h on an average day today and 27 h after its fixes.

**Open it**

1. Start page → **SawariGo** → **Open**. You land on **Pick a situation** as Neeraj Chauhan (Engineering lead, marketplace), the Tech Lead.
2. **Overview** tells the story: Matching searches every driver in the city for every ride request, so every busy night leaves riders searching; a geospatial index costs 12 hours.
3. **Incidents → INC-920** (“Riders waiting 20 minutes for a match across the city”). Its 5 Whys end at “Matching searches every driver in the city instead of nearby cells”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “Driver location pings are written to the main database every 3 seconds” (4 incidents) and “Matching searches every driver in the city instead of nearby cells” (3 incidents).

**The busiest day: New Year's Eve** (Rush)

5. **Simulate → Run a scenario** → **New Year's Eve** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 102.7 → 45.5 engineer-hours lost, 14.9% → 5.7% of requests failing. The plan (39 of the 40 hours): DEBT-910 Separate connection pools for trips and location writes (8 h); DEBT-906 Dedicated priority queue for SOS alerts (6 h); DEBT-901 Geospatial index of drivers by map cell (12 h); DEBT-911 Serve cached fare estimates per route for 60 seconds (8 h); DEBT-909 Send trip notifications through a durable queue (5 h). It saves 57.2 h a day (95% CI 53.9–60.5), against 39.1 h for the regular sprint plan.
7. The replay opens on day 176 of 300. It plays 06:00 to midnight, about 60 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 22:02 rider overloaded: 121% of its capacity. Paging on-call. About 14 engineer-hours to handle. The phone freezes: “SawariGo isn't responding”.
    - 23:03 matching overloaded: 124% of its capacity. About 23 engineer-hours to handle.
    - 23:05 notify overloaded: 109% of its capacity. About 7.5 engineer-hours to handle.
    - 23:06 trips failing: it depends on notify, which is down. Paging on-call. About 16.3 engineer-hours to handle.
    - 23:08 db overloaded: 117% of its capacity. About 20 engineer-hours to handle.
    - Day over: 103.6 h lost, 6 incidents; the worst hour is 23:00, with 83% of requests failing.
8. Press **▶ Same day, after the fixes**:
    - 23:09 driver overloaded: 102% of its capacity. Paging on-call. About 22.8 engineer-hours to handle.
    - 23:12 matching failing: it depends on driver, which is down. About 23 engineer-hours to handle.
    - Day over: 45.8 h lost, 2 incidents; the worst hour is 23:00, with 28% of requests failing. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “New Year's Eve”, fix in this order: DEBT-910 (8 h), DEBT-906 (6 h), DEBT-901 (12 h), DEBT-911 (8 h), DEBT-909 (5 h).

**The second situation: Fare-scraping bots** (Bots)

10. In the report, press **Try another situation** → **Fare-scraping bots** → **Run this day →**.
11. Average day: 109 → 27 engineer-hours lost, 40.8% → 7.3% of requests failing. The plan (36 of the 40 hours): DEBT-914 Rate-limit fare estimate requests per device and API key (6 h); DEBT-903 Fare holds: honour the quoted fare for two minutes (8 h); DEBT-911 Serve cached fare estimates per route for 60 seconds (8 h); DEBT-910 Separate connection pools for trips and location writes (8 h); DEBT-904 Lock the driver's state when assigning a ride (6 h). It saves 82 h a day (95% CI 79.6–84.4), against 11.7 h for the regular sprint plan. Bots are 60% of the extra traffic; DEBT-914 blocks 90% of them at the edge and is in the plan.
12. The replay opens on day 281 of 300. It plays 00:00 to midnight, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 10:31 notify crashed on its own (a random fault). About 4.5 engineer-hours to handle.
    - 19:09 rider overloaded: 129% of its capacity. Paging on-call. About 14 engineer-hours to handle. The phone freezes: “SawariGo isn't responding”.
    - 21:26 matching crashed on its own (a random fault). About 23 engineer-hours to handle.
    - 22:09 pricing overloaded: 145% of its capacity. Paging on-call. About 18.7 engineer-hours to handle.
    - 23:01 maps overloaded: 140% of its capacity. Paging on-call. About 17.5 engineer-hours to handle.
    - Day over: 113.9 h lost, 7 incidents; the worst hour is 23:00, with 100% of requests failing; everything is back by 11:09.
13. Press **▶ Same day, after the fixes**:
    - 10:31 notify crashed on its own (a random fault). About 4.5 engineer-hours to handle.
    - 21:26 matching crashed on its own (a random fault). About 23 engineer-hours to handle.
    - Day over: 27.5 h lost, 2 incidents; everything is back by 22:19. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s rides -e fare-scrapers --live --side` plays the same day 281, then prints the same report.

## TaxSetu (`taxfiling`): ITR deadline night (31 July) · Credential stuffing on PAN login

The point to make: for “ITR deadline night (31 July)”, the plan for the day saves 86.7 h a day where the regular sprint plan saves 51.8 h. “Credential stuffing on PAN login” (bots) costs 119.7 h on an average day today and 8.7 h after its fixes.

**Open it**

1. Start page → **TaxSetu** → **Open**. You land on **Pick a situation** as Radhika Sundaram (Engineering lead, e-filing), the Tech Lead.
2. **Overview** tells the story: Uploads are processed inside the web request, so every deadline night ends with returns stuck in 'processing'; a durable queue costs 12 hours.
3. **Incidents → INC-1020** (“Return uploads stuck in processing”). Its 5 Whys end at “Uploads are processed synchronously in the web request”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “Every form step fetches prefill data live instead of once per session” (4 incidents) and “E-verification OTPs share the SMS queue with bulk reminder messages” (3 incidents).

**The busiest day: ITR deadline night (31 July)** (Rush)

5. **Simulate → Run a scenario** → **ITR deadline night (31 July)** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 140.2 → 53.5 engineer-hours lost, 24.3% → 9% of requests failing. The plan (40 h): DEBT-1009 Separate connection pools for filing and batch processing jobs (8 h); DEBT-1006 Process uploads asynchronously from a durable queue (12 h); DEBT-1001 Precompute prefill data once per session and serve it cached (12 h); DEBT-1002 Separate priority queue for e-verification OTP SMS (6 h); DEBT-1008 Index the password history table by PAN (2 h). It saves 86.7 h a day (95% CI 81.9–91.5), against 51.8 h for the regular sprint plan.
7. The replay opens on day 22 of 300. It plays 05:00 to midnight, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 20:03 prefill went down at 91% load, too close to its limit. About 18.8 engineer-hours to handle.
    - 21:07 login overloaded: 103% of its capacity. Paging on-call. About 17.5 engineer-hours to handle. The phone freezes: “TaxSetu isn't responding”.
    - 22:01 db overloaded: 117% of its capacity. About 10 engineer-hours to handle.
    - 22:05 everify overloaded: 109% of its capacity. Paging on-call. About 18.7 engineer-hours to handle.
    - 22:08 notify went down at 96% load, too close to its limit. About 10 engineer-hours to handle.
    - Day over: 141.4 h lost, 7 incidents; the worst hour is 23:00, with 87% of requests failing.
8. Press **▶ Same day, after the fixes**:
    - 22:08 login went down at 96% load, too close to its limit. Paging on-call. About 17.5 engineer-hours to handle. The phone freezes: “TaxSetu isn't responding”.
    - 22:08 notify went down at 96% load, too close to its limit. About 10 engineer-hours to handle.
    - 23:02 forms overloaded: 101% of its capacity. Paging on-call. About 24.5 engineer-hours to handle.
    - Day over: 52 h lost, 3 incidents; the worst hour is 23:00, with 44% of requests failing. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “ITR deadline night (31 July)”, fix in this order: DEBT-1009 (8 h), DEBT-1006 (12 h), DEBT-1001 (12 h), DEBT-1002 (6 h), DEBT-1008 (2 h).

**The second situation: Credential stuffing on PAN login** (Bots)

10. In the report, press **Try another situation** → **Credential stuffing on PAN login** → **Run this day →**.
11. Average day: 119.7 → 8.7 engineer-hours lost, 51.4% → 2% of requests failing. The plan (32 of the 40 hours): DEBT-1014 Rate limits and CAPTCHA after failed PAN logins (6 h); DEBT-1009 Separate connection pools for filing and batch processing jobs (8 h); DEBT-1008 Index the password history table by PAN (2 h); DEBT-1011 Rate limit bulk reminder campaigns on deadline day (4 h); DEBT-1006 Process uploads asynchronously from a durable queue (12 h). It saves 111 h a day (95% CI 108.4–113.7), against 18.9 h for the regular sprint plan. Bots are 70% of the extra traffic; DEBT-1014 blocks 90% of them at the edge and is in the plan.
12. The replay opens on day 19 of 300. It plays 05:00 to midnight, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 20:02 notify overloaded: 116% of its capacity. Paging on-call. About 14 engineer-hours to handle.
    - 20:03 everify failing: it depends on notify, which is down. About 13.3 engineer-hours to handle.
    - 20:06 db overloaded: 141% of its capacity. About 10 engineer-hours to handle.
    - 20:06 login overloaded: 154% of its capacity. Paging on-call. About 17.5 engineer-hours to handle. The phone freezes: “TaxSetu isn't responding”.
    - 20:08 payments crashed on its own (a random fault). About 8 engineer-hours to handle.
    - Day over: 133.4 h lost, 10 incidents; the worst hour is 23:00, with 100% of requests failing; everything is back by 23:22.
13. Press **▶ Same day, after the fixes**:
    - 20:08 payments crashed on its own (a random fault). About 8 engineer-hours to handle.
    - Day over: 8 h lost, 1 incident; everything is back by 21:20. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s taxfiling -e pan-login-bots --live --side` plays the same day 19, then prints the same report.

## ShowPass (`tickets`): Stadium tour on-sale at noon · Scalper bots at the drop

The point to make: for “Stadium tour on-sale at noon”, the plan for the day saves 75.3 h a day where the regular sprint plan saves 51.3 h. “Scalper bots at the drop” (bots) costs 163.7 h on an average day today and 55.6 h after its fixes.

**Open it**

1. Start page → **ShowPass** → **Open**. You land on **Pick a situation** as Rekha Menon (Engineering lead, ticketing), the Tech Lead.
2. **Overview** tells the story: The waiting room keeps queue positions in memory, so one crash at the drop lets every fan in at once; a durable queue costs 14 hours.
3. **Incidents → INC-1120** (“Waiting room admitted everyone after a crash”). Its 5 Whys end at “The waiting room keeps queue positions in memory”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “The waiting room keeps queue positions in memory” (3 incidents) and “Seat holds are released only by a cron job every 10 minutes” (3 incidents).

**The busiest day: Stadium tour on-sale at noon** (Rush)

5. **Simulate → Run a scenario** → **Stadium tour on-sale at noon** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 129 → 53.8 engineer-hours lost, 30.7% → 12.6% of requests failing. The plan (40 h): DEBT-1101 Keep waiting-room positions in a durable queue (14 h); DEBT-1108 Use a shared connection pool for login (4 h); DEBT-1102 Precompute the seat map and serve it cached with live updates (8 h); DEBT-1111 Serve cached event pages from the edge (6 h); DEBT-1103 Sell seats with a row-level lock (8 h). It saves 75.3 h a day (95% CI 70.8–79.7), against 51.3 h for the regular sprint plan.
7. The replay opens on day 292 of 300. It plays 07:00 to 22:00, about 70 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 12:01 waitroom overloaded: 109% of its capacity. Paging on-call. About 42 engineer-hours to handle. The phone freezes: “ShowPass isn't responding”.
    - 12:05 checkout overloaded: 101% of its capacity. Paging on-call. About 21 engineer-hours to handle.
    - 12:05 notify overloaded: 109% of its capacity. About 7.5 engineer-hours to handle.
    - 12:07 web failing: it depends on checkout, which is down. Paging on-call. About 23.3 engineer-hours to handle.
    - 12:08 seatmap overloaded: 136% of its capacity. About 14.2 engineer-hours to handle.
    - Day over: 138.8 h lost, 7 incidents; the worst hour is 12:00, with 75% of requests failing; everything is back by 13:23.
8. Press **▶ Same day, after the fixes**:
    - 12:05 checkout overloaded: 101% of its capacity. Paging on-call. About 21 engineer-hours to handle.
    - 12:05 notify overloaded: 109% of its capacity. About 7.5 engineer-hours to handle.
    - 12:07 web failing: it depends on checkout, which is down. Paging on-call. About 23.3 engineer-hours to handle.
    - Day over: 51.8 h lost, 3 incidents; the worst hour is 12:00, with 50% of requests failing; everything is back by 13:20. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “Stadium tour on-sale at noon”, fix in this order: DEBT-1101 (14 h), DEBT-1108 (4 h), DEBT-1102 (8 h), DEBT-1111 (6 h), DEBT-1103 (8 h).

**The second situation: Scalper bots at the drop** (Bots)

10. In the report, press **Try another situation** → **Scalper bots at the drop** → **Run this day →**.
11. Average day: 163.7 → 55.6 engineer-hours lost, 49.7% → 11.4% of requests failing. The plan (40 h): DEBT-1106 Per-account purchase limits and bot rate limits (10 h); DEBT-1101 Keep waiting-room positions in a durable queue (14 h); DEBT-1108 Use a shared connection pool for login (4 h); DEBT-1102 Precompute the seat map and serve it cached with live updates (8 h); DEBT-1110 Timeouts on payment gateway calls in checkout (4 h). It saves 108.1 h a day (95% CI 103.7–112.5), against 7.6 h for the regular sprint plan. Bots are 60% of the extra traffic; DEBT-1106 blocks 90% of them at the edge and is in the plan.
12. The replay opens on day 141 of 300. It plays 07:00 to 22:00, about 70 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 12:01 waitroom overloaded: 182% of its capacity. Paging on-call. About 42 engineer-hours to handle. The phone freezes: “ShowPass isn't responding”.
    - 12:02 auth overloaded: 195% of its capacity. Paging on-call. About 21 engineer-hours to handle.
    - 12:02 web overloaded: 161% of its capacity. Paging on-call. About 23.3 engineer-hours to handle.
    - 12:05 checkout overloaded: 168% of its capacity. Paging on-call. About 21 engineer-hours to handle.
    - 12:05 notify overloaded: 123% of its capacity. About 4.5 engineer-hours to handle.
    - Day over: 168.1 h lost, 9 incidents; the worst hour is 12:00, with 100% of requests failing; everything is back by 13:23.
13. Press **▶ Same day, after the fixes**:
    - 12:05 checkout went down at 94% load, too close to its limit. Paging on-call. About 21 engineer-hours to handle.
    - 12:07 web failing: it depends on checkout, which is down. Paging on-call. About 23.3 engineer-hours to handle.
    - 12:09 catalog overloaded: 131% of its capacity. About 10 engineer-hours to handle.
    - Day over: 54.3 h lost, 3 incidents; the worst hour is 12:00, with 53% of requests failing; everything is back by 13:20. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s tickets -e scalper-bots --live --side` plays the same day 141, then prints the same report.

## ParikshaNet (`exam`): Entrance exam day · Database failover mid-exam

The point to make: for “Entrance exam day”, the plan for the day saves 168.9 h a day where the regular sprint plan saves 137.2 h. “Database failover mid-exam” (database) costs 58 h on an average day today and 3.7 h after its fixes.

**Open it**

1. Start page → **ParikshaNet** → **Open**. You land on **Pick a situation** as Arjun Nair (Engineering lead, exam delivery), the Tech Lead.
2. **Overview** tells the story: Autosave writes every keystroke to the database, so answers go missing whenever it stalls; keeping answers in the browser costs 12 hours.
3. **Incidents → INC-1218** (“Answers missing after a refresh”). Its 5 Whys end at “Autosave writes every keystroke straight to the database”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “All centres start the session at 09:30 with no staggered login window” (3 incidents) and “Autosave writes every keystroke straight to the database” (3 incidents).

**The busiest day: Entrance exam day** (Rush)

5. **Simulate → Run a scenario** → **Entrance exam day** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 305.9 → 137 engineer-hours lost, 25.4% → 12.4% of requests failing. The plan (40 h): DEBT-1211 Separate connection pools for exam traffic and admin reports (6 h); DEBT-1205 Batch writes from autosave every 30 seconds (6 h); DEBT-1203 Pre-render the question paper and serve it cached, encrypted per session (14 h); DEBT-1207 Upload snapshots asynchronously through a queue to object storage (10 h); DEBT-1213 Paginate the live candidate grid in the invigilator console (4 h). It saves 168.9 h a day (95% CI 161.8–176), against 137.2 h for the regular sprint plan.
7. The replay opens on day 240 of 300. It plays 05:00 to 22:00, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 08:34 paper crashed on its own (a random fault). Paging on-call. About 21 engineer-hours to handle.
    - 09:02 autosave overloaded: 120% of its capacity. Paging on-call. About 39.7 engineer-hours to handle.
    - 09:02 db overloaded: 117% of its capacity. About 20 engineer-hours to handle.
    - 09:04 proctor overloaded: 129% of its capacity. Paging on-call. About 23.3 engineer-hours to handle.
    - 09:05 submit overloaded: 109% of its capacity. About 16.7 engineer-hours to handle.
    - Day over: 301.4 h lost, 14 incidents; the worst hour is 09:00, with 71% of requests failing; everything is back by 15:30.
8. Press **▶ Same day, after the fixes**:
    - 08:34 paper crashed on its own (a random fault). Paging on-call. About 21 engineer-hours to handle.
    - 09:05 submit overloaded: 109% of its capacity. About 16.7 engineer-hours to handle.
    - 09:09 login overloaded: 109% of its capacity. Paging on-call. About 29.2 engineer-hours to handle. The phone freezes: “ParikshaNet isn't responding”.
    - 12:30 submit crashed on its own (a random fault). About 16.7 engineer-hours to handle.
    - Day over: 139.9 h lost, 6 incidents; the worst hour is 09:00, with 25% of requests failing; everything is back by 15:30. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “Entrance exam day”, fix in this order: DEBT-1211 (6 h), DEBT-1205 (6 h), DEBT-1203 (14 h), DEBT-1207 (10 h), DEBT-1213 (4 h).

**The second situation: Database failover mid-exam** (Database)

10. In the report, press **Try another situation** → **Database failover mid-exam** → **Run this day →**.
11. Average day: 58 → 3.7 engineer-hours lost, 4.9% → 0.3% of requests failing. The plan (12 of the 40 hours): DEBT-1204 Keep answers in the browser and sync with backoff (12 h). It saves 54.4 h a day (95% CI 51.4–57.3); the regular sprint plan saves about the same (54.5 h). What goes wrong at 11:00 (1 hour): The primary database fails over; connections to it break. DEBT-1204 guards against it and is in the plan.
12. The replay opens on day 1 of 300. It plays 06:00 to 16:00, about 40 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 11:00 ⚠ The primary database fails over; connections to it break. db is down to 15% of its capacity.
    - 11:04 db overloaded: 260% of its capacity. About 20 engineer-hours to handle.
    - 11:07 paper failing: it depends on db, which is down. About 15 engineer-hours to handle.
    - 11:07 proctor failing: it depends on db, which is down. Paging on-call. About 23.3 engineer-hours to handle.
    - Day over: 58.3 h lost, 3 incidents; the worst hour is 11:00, with 52% of requests failing; everything is back by 12:30.
13. Press **▶ Same day, after the fixes**:
    - 11:00 ⚠ The primary database fails over; connections to it break. db is down to 66% of its capacity (softened by the fix).
    - Nothing fails all day.
    - Day over: 0 h lost, 0 incidents. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s exam -e db-failover --live --side` plays the same day 1, then prints the same report.

## UdanAir (`airline`): Fare sale at noon · Seat-spinning bots

The point to make: for “Fare sale at noon”, the plan for the day saves 79.9 h a day where the regular sprint plan saves 42.3 h. “Seat-spinning bots” (bots) costs 127.5 h on an average day today and 3.7 h after its fixes.

**Open it**

1. Start page → **UdanAir** → **Open**. You land on **Pick a situation** as Karan Malhotra (Engineering lead, digital), the Tech Lead.
2. **Overview** tells the story: Every call to the GDS waits 30 seconds when it is down, so one slow dependency freezes booking and check-in; a circuit breaker with cached availability costs 16 hours.
3. **Incidents → INC-1317** (“GDS timeout froze bookings”). Its 5 Whys end at “There is no circuit breaker or cached availability when the GDS is down”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “Fare buckets are computed on every search instead of precomputed” (3 incidents) and “The whole fare cache expires at once with no jitter” (3 incidents).

**The busiest day: Fare sale at noon** (Rush)

5. **Simulate → Run a scenario** → **Fare sale at noon** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 130.8 → 50.9 engineer-hours lost, 26% → 9.4% of requests failing. The plan (40 h): DEBT-1301 Precompute fare buckets per route and serve them from a cache (14 h); DEBT-1309 Precompute seat maps per flight and serve them cached (8 h); DEBT-1302 Refresh fares ahead of expiry and serve cached fares (6 h); DEBT-1308 Separate connection pools for sales traffic and revenue reports (6 h); DEBT-1312 Pre-render the sale page and fare calendar at the edge (6 h). It saves 79.9 h a day (95% CI 76.2–83.5), against 42.3 h for the regular sprint plan.
7. The replay opens on day 107 of 300. It plays 06:00 to 23:00, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 12:01 checkin overloaded: 109% of its capacity. About 14.2 engineer-hours to handle.
    - 12:02 web overloaded: 137% of its capacity. Paging on-call. About 14 engineer-hours to handle. The phone freezes: “UdanAir isn't responding”.
    - 12:04 db overloaded: 117% of its capacity. About 15 engineer-hours to handle.
    - 12:05 fares overloaded: 137% of its capacity. About 15 engineer-hours to handle.
    - 12:05 notify overloaded: 109% of its capacity. About 11.7 engineer-hours to handle.
    - Day over: 125.8 h lost, 7 incidents; the worst hour is 12:00, with 69% of requests failing; everything is back by 14:22.
8. Press **▶ Same day, after the fixes**:
    - 12:01 checkin overloaded: 109% of its capacity. About 14.2 engineer-hours to handle.
    - 12:05 notify overloaded: 109% of its capacity. About 11.7 engineer-hours to handle.
    - 12:09 seats went down at 96% load, too close to its limit. Paging on-call. About 24.5 engineer-hours to handle.
    - Day over: 50.3 h lost, 3 incidents; the worst hour is 12:00, with 29% of requests failing; everything is back by 13:21. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “Fare sale at noon”, fix in this order: DEBT-1301 (14 h), DEBT-1309 (8 h), DEBT-1302 (6 h), DEBT-1308 (6 h), DEBT-1312 (6 h).

**The second situation: Seat-spinning bots** (Bots)

10. In the report, press **Try another situation** → **Seat-spinning bots** → **Run this day →**.
11. Average day: 127.5 → 3.7 engineer-hours lost, 37.1% → 0.1% of requests failing. The plan (40 h): DEBT-1306 Rate-limit unpaid seat holds per account and device (6 h); DEBT-1301 Precompute fare buckets per route and serve them from a cache (14 h); DEBT-1309 Precompute seat maps per flight and serve them cached (8 h); DEBT-1312 Pre-render the sale page and fare calendar at the edge (6 h); DEBT-1302 Refresh fares ahead of expiry and serve cached fares (6 h). It saves 123.9 h a day (95% CI 120.8–126.9), against 118.6 h for the regular sprint plan. Bots are 70% of the extra traffic; DEBT-1306 blocks 90% of them at the edge and is in the plan.
12. The replay opens on day 22 of 300. It plays 09:00 to 16:00, about 20 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 12:02 web overloaded: 137% of its capacity. Paging on-call. About 14 engineer-hours to handle. The phone freezes: “UdanAir isn't responding”.
    - 12:04 db overloaded: 117% of its capacity. About 15 engineer-hours to handle.
    - 12:05 fares overloaded: 137% of its capacity. About 15 engineer-hours to handle.
    - 12:05 notify overloaded: 109% of its capacity. About 11.7 engineer-hours to handle.
    - 12:05 search overloaded: 137% of its capacity. Paging on-call. About 31.5 engineer-hours to handle.
    - Day over: 126.7 h lost, 7 incidents; the worst hour is 12:00, with 83% of requests failing; everything is back by 13:21.
13. Press **▶ Same day, after the fixes**:
    - Nothing fails all day.
    - Day over: 0 h lost, 0 incidents. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s airline -e seat-spinning --live --side` plays the same day 22, then prints the same report.

## SlotSetu (`appointments`): New slots open at 17:00 · A data-centre zone loses power

The point to make: for “New slots open at 17:00”, the plan for the day saves 73.4 h a day where the regular sprint plan saves 42 h. “A data-centre zone loses power” (zone lost) costs 105.5 h on an average day today and 11.9 h after its fixes.

**Open it**

1. Start page → **SlotSetu** → **Open**. You land on **Pick a situation** as Lakshmi Narayan (Engineering lead), the Tech Lead.
2. **Overview** tells the story: Agents' scripts take most new slots within minutes because nothing stops them; a CAPTCHA, per-Aadhaar limits and randomised release cost 8 hours.
3. **Incidents → INC-1417** (“Touts' scripts again took the slots”). Its 5 Whys end at “The portal has no CAPTCHA, per-Aadhaar limits or randomised slot release”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “Slot availability is computed on every request” (3 incidents) and “The portal has no CAPTCHA, per-Aadhaar limits or randomised slot release” (3 incidents).

**The busiest day: New slots open at 17:00** (Rush)

5. **Simulate → Run a scenario** → **New slots open at 17:00** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 108.6 → 35.2 engineer-hours lost, 29.7% → 8% of requests failing. The plan (40 h): DEBT-1401 Precompute availability per office and serve it cached (12 h); DEBT-1412 Pre-render the portal's static pages and serve them cached from a CDN (4 h); DEBT-1410 Separate connection pools for citizens and back-office jobs (6 h); DEBT-1402 Rate limits, CAPTCHA and per-Aadhaar caps on booking (8 h); DEBT-1407 Queue SMS confirmations with retries (4 h); DEBT-1411 Load test the 17:00 release at 25x (6 h). It saves 73.4 h a day (95% CI 69.8–77), against 42 h for the regular sprint plan.
7. The replay opens on day 47 of 300. It plays 00:00 to midnight, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 04:02 reports went down at 91% load, too close to its limit. About 6.5 engineer-hours to handle.
    - 17:02 portal overloaded: 137% of its capacity. Paging on-call. About 28 engineer-hours to handle.
    - 17:04 db overloaded: 117% of its capacity. About 10 engineer-hours to handle.
    - 17:07 notify overloaded: 109% of its capacity. About 10 engineer-hours to handle.
    - 17:08 booking overloaded: 101% of its capacity. Paging on-call. About 23.8 engineer-hours to handle.
    - Day over: 106.3 h lost, 6 incidents; the worst hour is 17:00, with 67% of requests failing; everything is back by 18:23.
8. Press **▶ Same day, after the fixes**:
    - 04:02 reports went down at 91% load, too close to its limit. About 6.5 engineer-hours to handle.
    - 17:02 portal went down at 82% load, too close to its limit. Paging on-call. About 28 engineer-hours to handle.
    - Day over: 34.5 h lost, 2 incidents; the worst hour is 17:00, with 19% of requests failing; everything is back by 18:10. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “New slots open at 17:00”, fix in this order: DEBT-1401 (12 h), DEBT-1412 (4 h), DEBT-1410 (6 h), DEBT-1402 (8 h), DEBT-1407 (4 h), DEBT-1411 (6 h).

**The second situation: A data-centre zone loses power** (Zone lost)

10. In the report, press **Try another situation** → **A data-centre zone loses power** → **Run this day →**.
11. Average day: 105.5 → 11.9 engineer-hours lost, 20.3% → 0.3% of requests failing. The plan (36 of the 40 hours): DEBT-1408 Run in both data-centre zones with automatic failover (20 h); DEBT-1401 Precompute availability per office and serve it cached (12 h); DEBT-1412 Pre-render the portal's static pages and serve them cached from a CDN (4 h). It saves 93.6 h a day (95% CI 90.6–96.7), against 43 h for the regular sprint plan. What goes wrong at 17:10 (1 hour): One zone loses power; the portal loses half its servers. DEBT-1408 guards against it and is in the plan.
12. The replay opens on day 210 of 300. It plays 00:00 to midnight, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 17:10 ⚠ One zone loses power; the portal loses half its servers. Every module is down to 50% of its capacity.
    - 17:12 reports overloaded: 182% of its capacity. About 6.5 engineer-hours to handle.
    - 17:15 db overloaded: 112% of its capacity. About 10 engineer-hours to handle.
    - 17:15 documents went down at 93% load, too close to its limit. About 12.5 engineer-hours to handle.
    - 17:16 portal overloaded: 131% of its capacity. Paging on-call. About 28 engineer-hours to handle.
    - Day over: 105.5 h lost, 7 incidents; the worst hour is 17:00, with 64% of requests failing; everything is back by 22:25.
13. Press **▶ Same day, after the fixes**:
    - 17:10 ⚠ One zone loses power; the portal loses half its servers. Every module is down to 80% of its capacity (softened by the fix).
    - 17:12 reports overloaded: 114% of its capacity. About 6.5 engineer-hours to handle.
    - 21:03 reports went down at 91% load, too close to its limit. About 6.5 engineer-hours to handle.
    - Day over: 13 h lost, 2 incidents; everything is back by 22:25. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s appointments -e zone-power --live --side` plays the same day 210, then prints the same report.

## TurantMart (`grocery`): Diwali evening · Scripts at a limited drop

The point to make: for “Diwali evening”, the plan for the day saves 68.6 h a day where the regular sprint plan saves 40.7 h. “Scripts at a limited drop” (bots) costs 150 h on an average day today and 6.1 h after its fixes.

**Open it**

1. Start page → **TurantMart** → **Open**. You land on **Pick a situation** as Divya Pillai (Engineering lead, consumer), the Tech Lead.
2. **Overview** tells the story: UPI runs through one provider, so every provider wobble fails payments at the busiest minute; switching automatically to a second provider costs 10 hours.
3. **Incidents → INC-1517** (“UPI failing intermittently”). Its 5 Whys end at “UPI runs through a single provider with no automatic switch”, and **Similar incidents** lists the earlier reports of the same problem.
4. **Incidents → Root causes**: the chains meet at “A campaign switch flushes the whole offer cache” (3 incidents) and “Every store syncs its full inventory at once” (3 incidents).

**The busiest day: Diwali evening** (Rush)

5. **Simulate → Run a scenario** → **Diwali evening** → **Run this day →**, with 40 hours and 300 days.
6. Average day: 131.7 → 63.1 engineer-hours lost, 22.7% → 7.2% of requests failing. The plan (36 of the 40 hours): DEBT-1508 Separate connection pools for orders and analytics jobs (6 h); DEBT-1509 Precompute store stock per product and serve it cached for 5 seconds (6 h); DEBT-1507 Push order updates to the app as notifications instead of polling (10 h); DEBT-1511 Index search by store and availability (4 h); DEBT-1505 Rate limits per account and device on limited drops (6 h); DEBT-1512 Idempotency key per checkout (4 h). It saves 68.6 h a day (95% CI 64.2–73), against 40.7 h for the regular sprint plan.
7. The replay opens on day 10 of 300. It plays 06:00 to midnight, about 80 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 17:01 catalog went down at 89% load, too close to its limit. Paging on-call. About 14 engineer-hours to handle.
    - 18:05 riders went down at 82% load, too close to its limit. About 15 engineer-hours to handle.
    - 18:08 orders failing: it depends on riders, which is down. Paging on-call. About 19.2 engineer-hours to handle.
    - 18:09 cart failing: it depends on orders, which is down. Paging on-call. About 19.2 engineer-hours to handle.
    - 19:02 db overloaded: 117% of its capacity. About 15 engineer-hours to handle.
    - Day over: 131.8 h lost, 8 incidents; the worst hour is 20:00, with 78% of requests failing; everything is back by 22:29.
8. Press **▶ Same day, after the fixes**:
    - 18:05 riders went down at 82% load, too close to its limit. About 15 engineer-hours to handle.
    - 19:07 catalog went down at 82% load, too close to its limit. Paging on-call. About 14 engineer-hours to handle.
    - 19:08 stores overloaded: 109% of its capacity. About 16.7 engineer-hours to handle.
    - 19:09 cart went down at 91% load, too close to its limit. Paging on-call. About 19.2 engineer-hours to handle.
    - Day over: 64.9 h lost, 4 incidents; the worst hour is 19:00, with 38% of requests failing; everything is back by 21:19. Then **Side by side** (3).
9. Press **Read the report →**. Its first recommendation: To be ready for “Diwali evening”, fix in this order: DEBT-1508 (6 h), DEBT-1509 (6 h), DEBT-1507 (10 h), DEBT-1511 (4 h), DEBT-1505 (6 h), DEBT-1512 (4 h). That leaves 4 h of the budget for other work.

**The second situation: Scripts at a limited drop** (Bots)

10. In the report, press **Try another situation** → **Scripts at a limited drop** → **Run this day →**.
11. Average day: 150 → 6.1 engineer-hours lost, 45.5% → 0.6% of requests failing. The plan (32 of the 40 hours): DEBT-1505 Rate limits per account and device on limited drops (6 h); DEBT-1509 Precompute store stock per product and serve it cached for 5 seconds (6 h); DEBT-1508 Separate connection pools for orders and analytics jobs (6 h); DEBT-1507 Push order updates to the app as notifications instead of polling (10 h); DEBT-1512 Idempotency key per checkout (4 h). It saves 144 h a day (95% CI 142.3–145.6), against 132.2 h for the regular sprint plan. Bots are 80% of the extra traffic; DEBT-1505 blocks 90% of them at the edge and is in the plan.
12. The replay opens on day 45 of 300. It plays 15:00 to 23:00, about 25 seconds at 1×. Press **▶ Start the day**, then F. The first alerts today:
    - 17:01 catalog overloaded: 102% of its capacity. Paging on-call. About 14 engineer-hours to handle.
    - 17:02 riders went down at 77% load, too close to its limit. About 15 engineer-hours to handle.
    - 17:06 stores went down at 82% load, too close to its limit. About 16.7 engineer-hours to handle.
    - 17:08 orders went down at 82% load, too close to its limit. About 13.8 engineer-hours to handle.
    - 18:01 app overloaded: 123% of its capacity. Paging on-call. About 18.7 engineer-hours to handle.
    - Day over: 152.3 h lost, 10 incidents; the worst hour is 18:00, with 100% of requests failing; everything is back by 20:25.
13. Press **▶ Same day, after the fixes**:
    - 18:06 search went down at 76% load, too close to its limit. About 10 engineer-hours to handle. The phone freezes: “TurantMart isn't responding”.
    - Day over: 10 h lost, 1 incident; everything is back by 19:16. Then **Side by side** (3).

**In the terminal**

14. `python -m debtlens simulate spike -s grocery -e drop-scripts --live --side` plays the same day 45, then prints the same report.

## Using your own pack file

This shows the judges that DebtLens is not tied to the bundled data: change a pack in front of them and the results change with it. Pack files are opened on the website only.

1. On a pack's card on the start page, press **pack file** to save it as `<code>.debtlens-pack.json` (for example `tatkal.debtlens-pack.json`).
2. Open it in Notepad or VS Code and change something visible: the system's `name`, the busiest day's `peak` or a value in its `profile` (for example the 10:00 hour from 25 to 40), or add an incident or a situation.
3. On the start page, drop the file on the **Upload a scenario pack** card (or press **Choose or drop a .json file**). DebtLens checks the whole file and lists every problem at once, with where it is.
4. Fix anything it lists and press **Open pack**. The pack opens as a private sandbox on **Pick a situation**, live replay and report included. **⚙ → Reset this sandbox** returns to the file you uploaded.
5. A pack without a `journey` still gets a live replay: DebtLens builds a simple customer journey from the modules people enter through.

The file format, with every field, is in `docs/PACKS.md`; the user guide (section 6) has a small pack to start from.

## If something goes wrong

| What you see | What to do |
| --- | --- |
| The first system takes up to 20 seconds to open | The free server was asleep. Open the health link from "Before the demo" ten minutes early. |
| The replay does not move | It is paused: press Space. If you switched tabs or minimised the browser, it paused on its own. |
| The replay did not open after **Run this day →** | Press **▶ Watch the day** on step 3. |
| Your numbers differ from this manual | The hours or the simulated days were changed. Set them back to 40 and 300 and run the day again. |
| **Similar incidents** looks weak | The MiniLM model had not loaded yet. Open the health link, wait for `"available":true`, then reload. |
| The freezing is too much for the room | Press E to turn the frozen-device effects off; everything else keeps playing. |
| The replay is too slow or too fast | Press S to cycle ½×, 1×, 2× and 4×. |
| The projector cuts off the edges | Press F for full screen; the layout adjusts to any size from 1366×768 up. |
| "That project is not available to you." | Sandboxes last 24 hours. Go to the start page and open the system again. |
| The terminal replay looks broken | Use Windows Terminal, maximised; `--side` needs 120 columns, otherwise it plays today and then after the fixes. |
| No internet in the hall | Run `scripts\windows\start-sqlite.bat` and open `http://localhost:8000`. |

## Quick reference

Engineer-hours lost: the average over 300 simulated days with 40 hours to fix before the day, the hours the plan for the day saves against the regular sprint plan, and the day the live replay shows (today → after the fixes).

| System | Busiest day | Average, today → after | Saves vs regular plan | Replay day | Second situation | Average, today → after | Saves vs regular plan | Replay day |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PayCore `fintech` | Salary day | 197.4 → 45.8 | 151.6 vs 134.5 | #32: 184 → 46.2 | Acquiring bank outage (`acquirer-outage`) | 38.9 → 10.4 | 28.5 vs 3 | #7: 42.4 → 10 |
| CareStream HIS `healthtech` | Monday morning OPD rush | 79.2 → 20.3 | 59 vs 59.2 | #213: 81.5 → 15.8 | SMS gateway outage on a Monday (`sms-outage`) | 55.8 → 9.5 | 46.3 vs 46.4 | #238: 58.2 → 10.8 |
| ShopSwift `ecommerce` | Diwali sale | 53.4 → 27.1 | 26.4 vs 9.5 | #209: 54.4 → 25.7 | Order events replayed (`event-replay`) | 51.4 → 3 | 48.4 vs 2.1 | #6: 51.5 → 0 |
| CampusOne ERP `college` | Exam results day | 48.7 → 8.1 | 40.6 vs 19.2 | #19: 42.9 → 10 | Biometric sync floods the database (`attendance-sync`) | 44.4 → 3 | 41.4 vs 41.5 | #200: 36.9 → 3 |
| RailYatra `tatkal` | Tatkal opening at 10 AM | 124.5 → 61.8 | 62.7 vs 24.3 | #60: 135.2 → 61.7 | Tatkal booking bots (`tatkal-bots`) | 183.9 → 106 | 77.9 vs 5.8 | #2: 185.4 → 104 |
| NiveshTrade `broker` | Union Budget day | 128.6 → 66 | 62.6 vs 34.9 | #236: 120 → 64.8 | Credential-stuffing attack (`credential-stuffing`) | 107.7 → 7.1 | 100.6 vs 100.8 | #210: 106.1 → 6 |
| ZaikaNow `food` | IPL final night | 145.6 → 85.4 | 60.2 vs 41.9 | #268: 151.2 → 86.7 | Coupon-abuse bots (`coupon-bots`) | 112.9 → 28.3 | 84.6 vs 20.2 | #114: 114.7 → 31.5 |
| KhelStream `stream` | World Cup final | 156 → 77.8 | 78.3 vs 50.9 | #236: 169.3 → 82.8 | Restreaming bots (`restream-bots`) | 241.7 → 65.4 | 176.3 vs 40.4 | #129: 249.1 → 59.3 |
| SawariGo `rides` | New Year's Eve | 102.7 → 45.5 | 57.2 vs 39.1 | #176: 103.6 → 45.8 | Fare-scraping bots (`fare-scrapers`) | 109 → 27 | 82 vs 11.7 | #281: 113.9 → 27.5 |
| TaxSetu `taxfiling` | ITR deadline night (31 July) | 140.2 → 53.5 | 86.7 vs 51.8 | #22: 141.4 → 52 | Credential stuffing on PAN login (`pan-login-bots`) | 119.7 → 8.7 | 111 vs 18.9 | #19: 133.4 → 8 |
| ShowPass `tickets` | Stadium tour on-sale at noon | 129 → 53.8 | 75.3 vs 51.3 | #292: 138.8 → 51.8 | Scalper bots at the drop (`scalper-bots`) | 163.7 → 55.6 | 108.1 vs 7.6 | #141: 168.1 → 54.3 |
| ParikshaNet `exam` | Entrance exam day | 305.9 → 137 | 168.9 vs 137.2 | #240: 301.4 → 139.9 | Database failover mid-exam (`db-failover`) | 58 → 3.7 | 54.4 vs 54.5 | #1: 58.3 → 0 |
| UdanAir `airline` | Fare sale at noon | 130.8 → 50.9 | 79.9 vs 42.3 | #107: 125.8 → 50.3 | Seat-spinning bots (`seat-spinning`) | 127.5 → 3.7 | 123.9 vs 118.6 | #22: 126.7 → 0 |
| SlotSetu `appointments` | New slots open at 17:00 | 108.6 → 35.2 | 73.4 vs 42 | #47: 106.3 → 34.5 | A data-centre zone loses power (`zone-power`) | 105.5 → 11.9 | 93.6 vs 43 | #210: 105.5 → 13 |
| TurantMart `grocery` | Diwali evening | 131.7 → 63.1 | 68.6 vs 40.7 | #10: 131.8 → 64.9 | Scripts at a limited drop (`drop-scripts`) | 150 → 6.1 | 144 vs 132.2 | #45: 152.3 → 10 |
