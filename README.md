# RIT Certificate Generator

Password-protected website that fills Canva certificate templates (blank PNG exports) with names typed in or
uploaded from Excel, downloads them as a ZIP of PDFs, and emails each person their certificate from
`rit.ecertificate@gmail.com`.

- **Next.js 16** on **Vercel**. Certificates are drawn in the browser (canvas → PDF with pdf-lib), so
  nothing about the people is stored on the server.
- Templates live in the repo under `public/templates/<event>/` (PNG files + `event.json`).
- Email goes through Gmail (Nodemailer + Google App Password), one message per person with the PDF attached.

## Using it

1. Sign in with the admin password.
2. Pick an event → pick the design (Winner / Participation / …).
3. Type names in the table, paste cells straight from Excel, or **Upload Excel / CSV** (headers such as
   `Name`, `Department`, `Email` are matched automatically; you can fix the mapping before importing).
   Use **Sample Excel** to get a sheet with the right headers.
4. Check the live preview (use ‹ › to step through people). A ⚠ appears if a long name had to be shrunk a lot.
5. **Download ZIP** → one PDF per person, named after them.
6. **Email**: edit the subject/message (`{Name}`, `{Event}`, `{Type}`, `{Department / Institution}` …),
   send yourself a test, then **Email N people**. Keep the tab open while it sends; failed rows can be retried and a
   CSV report downloaded. Gmail allows roughly 500 emails/day per account.

## Adding a new event (e.g. Academic Staff College)

1. In Canva, export the certificate as **PNG** with the fill-in lines left empty (one PNG per design).
2. Open **Template editor** → type the event name → **Add design (PNG)**.
3. Green bars show the blank lines found on the image — click one to drop a text field on it. Drag to fine-tune,
   pick the font/size/colour to match Canva, and choose which column each field shows.
4. **Download template folder (.zip)**, unzip it into `public/templates/`, then commit and push:

   ```bash
   git add public/templates && git commit -m "Add Academic Staff College template" && git push
   ```

   Vercel redeploys automatically and the event shows up on the home page.

`event.json` reference (units are image pixels; `y` is the text baseline, just above the line):

```json
{
  "name": "Event name",
  "description": "Dates / venue",
  "order": 10,
  "columns": [{ "key": "name", "label": "Name", "aliases": ["full name"], "default": "" }],
  "variants": [{
    "id": "participation", "label": "Participation", "image": "participation.png", "width": 2000, "height": 1414,
    "fields": [{ "key": "name", "x": 760, "y": 703, "width": 470, "fontFamily": "Lora", "fontSize": 40,
                 "fontWeight": 700, "color": "#0d4a8b", "align": "center", "transform": "title" }]
  }],
  "email": { "subject": "Your {Event} certificate", "body": "Dear {Name}, ..." }
}
```

Fonts available for fields are listed in `src/lib/fonts.ts` (Google Fonts); add a family there if Canva used another.

## Setup

### Environment variables

| Name | What |
| --- | --- |
| `ADMIN_PASSWORD` | Shared password for the login screen |
| `AUTH_SECRET` | Long random string that signs the login cookie (`openssl rand -hex 32`) |
| `GMAIL_USER` | `rit.ecertificate@gmail.com` |
| `GMAIL_APP_PASSWORD` | Google **App Password** for that account (not the normal password) |
| `MAIL_FROM_NAME` | Sender name, e.g. `Rajalakshmi Institute of Technology` |

**Gmail App Password:** sign in to the Gmail account → Google Account → Security → turn on 2-Step Verification →
search "App passwords" → create one named "Certificate Generator" → copy the 16 characters into
`GMAIL_APP_PASSWORD` (locally in `.env.local`, and in Vercel → Project → Settings → Environment Variables).

### Local development

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

### Deploy to Vercel

1. Push this folder to a GitHub repository.
2. In Vercel: **Add New → Project → Import** the repo (framework is detected as Next.js).
3. Add the environment variables above, then **Deploy**.

Every push to the main branch redeploys.
