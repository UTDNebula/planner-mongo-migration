Initialize MongoDB source and Postgres target databases

```bash
docker compose up -d
```

Restore MongoDB database

```bash
./restore.sh -d cluster0 -p /path/to/dump/cluster0
```

Run migration script

```bash
npm run migrate
```
