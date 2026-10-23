# Farmer calls: recorded message to many farmers

This tool phones farmers from your list and plays a recorded message about a new product, in your own voice.
The phone company **Exotel** places the calls. This tool tells Exotel who to call, makes sure the rules are
followed, and shows you afterwards who listened, so your staff can call those farmers back.

## What you need first (one time, about 1–2 weeks)

1. **An Exotel account** at exotel.com. Ask them for **promotional voice broadcast** (voice calls with a recorded message).
2. **A 140-series number** from Exotel. TRAI allows recorded promotional calls **only** from 140-series numbers.
   Calling from a normal mobile or landline number can get **all the shop's phone numbers disconnected**.
3. **DLT registration** of the business and the message script. Exotel helps with this.
4. **A call flow in Exotel** (App Bazaar → create an app) that plays your recording. You can also add
   "press 1 to talk to the shop", which connects the farmer to your shop phone. Note the app's ID.
5. **Record the message** using `message-script.md`, then upload it in that call flow.

## Your farmer list

Make a CSV file (save from Excel as "CSV UTF-8") with these columns:

| name | phone | village | crops | consent |
|---|---|---|---|---|
| Ramesh | 98XXXXXXXX | Dhamna | Gram, Wheat | yes |

- **consent = yes** only for farmers who agreed to get calls from the shop, for example when they gave their
  number at the counter. Everyone else is skipped. Write down when and how each farmer agreed.
- See `farmers.example.csv`. Real lists stay on your computer and are never saved to GitHub.

## How to run it (on a computer with Python)

1. Copy `config.example.ini` to `config.ini` and fill in the details from Exotel.
2. See who would be called and the estimated cost (no calls made):
   ```
   python broadcast.py plan --list farmers.csv --campaign gram-oct --crop Gram
   ```
3. Practice run (no calls made): the same command with `send` instead of `plan`.
4. **Real calls:** add `--live`. It asks you to type `YES` first. To start small, try 10–20 farmers first by
   setting `max_calls_per_run = 20` in `config.ini`.
5. About 15 minutes later, see who answered and listened:
   ```
   python broadcast.py status --campaign gram-oct
   ```
   Give that list to Murari or Saurabh to call back. Farmers who listened are the most likely to buy.

## Built-in safety rules

- Only farmers with **consent = yes** are called.
- **Nobody is called twice** in the same campaign. Use a new campaign name for the next product.
- Calls happen **only between 9 am and 9 pm**, India time.
- Real calls need **both** `--live` and typing `YES`.
- It refuses to call unless the caller number is a **140-series** number.
