# Deploying Athenaeum

Code and data travel separately. Pushing to GitHub moves the code; the data
lives in MongoDB's own directory (`/opt/homebrew/var/mongodb` locally) and has
never been inside this repository. Moving it is a deliberate, separate step —
step 2 below.

## 1. A database that is not your laptop

[MongoDB Atlas](https://cloud.mongodb.com) has a free tier that is plenty for
this.

1. Create a free **M0** cluster.
2. **Database Access** → add a user with *Read and write to any database*.
3. **Network Access** → add an IP. `0.0.0.0/0` works while you are setting up;
   narrow it to your host's addresses afterwards.
4. **Connect → Drivers** → copy the connection string. It looks like:

```
mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
```

If the password contains `@ : / ? # [ ]`, URL-encode it — `@` becomes `%40`.
A password pasted in raw is the single most common reason this step fails.

## 2. Move your data there

```bash
pip install -r tools/requirements.txt

python3 tools/migrate.py --to "mongodb+srv://USER:PASSWORD@cluster0.xxxxx.mongodb.net/"
```

It prints a row per collection and verifies the counts afterwards. It refuses
to overwrite a destination that already holds a catalogue unless you pass
`--replace`, and it fails rather than reporting success if nothing was copied.

Check it landed:

```bash
python3 tools/stats.py --uri "mongodb+srv://..."
```

## 3. Deploy the application

One service serves both the API and the frontend, so there is a single origin —
no CORS to configure and nothing to keep in step.

**Render** — `render.yaml` is committed, so *New → Blueprint* and point it at
the repository. Set `MONGODB_URI` in the dashboard (it is marked `sync: false`
precisely so it never enters git).

**Railway / Fly / any Docker host** — the `Dockerfile` builds the client and
serves it from the API.

**Anywhere else** — `Procfile` runs `node server/index.js`, which serves
`dist/` when it exists.

Required environment:

| | |
|---|---|
| `MONGODB_URI` | the Atlas string from step 1 |
| `MONGODB_DB` | `library_management_system` |
| `NODE_ENV` | `production` |

`PORT` is supplied by the host. `.env.example` lists the optional extras.

## 4. Check it

- `/api/health` returns `{"ok":true,"db":"library_management_system"}`
- The dashboard shows your books and members
- **No amber banner across the top.** That banner means the API could not be
  reached and the app has fallen back to per-browser storage — the failure
  worth catching, because everything else still looks fine.

## Splitting the frontend off (optional)

Only if you want the client on a CDN:

- Build with `VITE_API_URL=https://your-api.example.com/api`
- Set `ALLOWED_ORIGINS=https://your-frontend.example.com` on the API

Both are unnecessary with the single-service setup above.

## Keeping backups

Atlas M0 does not include automated backups.

```bash
python3 tools/migrate.py \
  --from "mongodb+srv://..." --to "mongodb://127.0.0.1:27017" \
  --target-db athenaeum_backup --replace
```

Settings → Backup & Data does the same from inside the application.
