# RIT Certificate Generator

Password-protected website that fills Canva certificate templates (blank PNG exports) with names typed in or
uploaded from Excel, downloads them as a ZIP of PDFs, and emails each person their certificate from
`rit.ecertificate@gmail.com`.

- **Next.js 16** on **Vercel**. Designs are HTML; certificates are rendered in the browser (HTML → image → PDF with
  pdf-lib), so the list of people is never stored on the server.
- Designs and uploaded images are stored in **Supabase Postgres** (`cg_designs`, `cg_assets`, created automatically).
- Email goes through Gmail (Nodemailer + Google App Password), one message per person with the PDF attached.

## Using it

1. Sign in with the admin password.
2. **Designs** (home page) shows every certificate design, grouped by event. The 16 RIT designs recreated from the
   original Canva certificates can be added with one click the first time.
3. **Edit** opens the Canva-style editor:
   - click anything to select it, drag to move, drag the handles to resize, the round handle to rotate
     (pink guides snap to the page centre and other items);
   - double-click text to type; select words to make them bold / italic / underlined / superscript or recolour them;
   - the left panel adds headings, text, shapes, **fill-in fields** (`{Name}`, `{Department}`, `{Position}`, `{Title}`,
     `{Date}`, custom ones), images and signatures (**Images** → upload your own or use the RIT library), and
     lists all **Layers** (reorder, hide, lock);
   - the right panel changes fonts, sizes, colours (incl. gold gradients), spacing, alignment, page size and background;
   - Ctrl+Z / Ctrl+Shift+Z undo/redo, Ctrl+D duplicate, Ctrl+C / Ctrl+V copy/paste, arrows nudge, Delete removes;
   - changes save automatically.
4. **Create certificates**: type names, paste cells from Excel, or **Upload Excel / CSV** (headings like `Name`,
   `Department`, `Email` are matched automatically). Designs of the same event can be mixed per row (e.g. Winner /
   Participation) with a “Certificate type” column. The preview is exactly what the PDF looks like.
5. **Download ZIP** → one PDF per person, named after them. **Email** → edit the subject/message (`{Name}`, `{Event}`,
   `{Type}`, any field), send yourself a test, then email everyone. Keep the tab open while it sends; failed rows can be
   retried and a CSV report downloaded. Gmail allows roughly 500 emails a day.

Everything a certificate needs — text, fields, logos, signatures, background — is part of the editable design, so a new
event (e.g. **Academic Staff College**) is: duplicate a similar design, change the heading and wording, save.

Original Canva artwork was cut into separate images by `scripts/extract_art.py` (logos, signatures, seals →
`public/assets/brand/`, text-free frames → `public/assets/backgrounds/`). To use a new Canva frame, export it from Canva
**with the text hidden** and upload it as the background in the editor.

## Setup

### Environment variables

| Name | What |
| --- | --- |
| `ADMIN_PASSWORD` | Shared password for the login screen |
| `AUTH_SECRET` | Long random string that signs the login cookie (`openssl rand -hex 32`) |
| `GMAIL_USER` | `rit.ecertificate@gmail.com` |
| `GMAIL_APP_PASSWORD` | Google **App Password** for that account (not the normal password) |
| `MAIL_FROM_NAME` | Sender name, e.g. `Rajalakshmi Institute of Technology` |
| `DATABASE_URL` | Supabase **Transaction pooler** connection string (Dashboard → Connect → Transaction pooler, port 6543). Empty = local `.data/` folder (development only). |

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
