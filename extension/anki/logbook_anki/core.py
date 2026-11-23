"""Logbook for Anki — pure logic (no Anki imports), so it can be tested on its own.

Reads Anki's review history (the revlog table), adds up the time spent per deck per
day, and turns it into Logbook entries. Anki records how long you took to answer each
card (capped by the deck option "Maximum answer seconds"), so this is the real time
you spent reviewing, not an estimate.
"""
from __future__ import annotations
import datetime as _dt
import json
import urllib.request
import urllib.error

SB_URL = "https://bhbvnjcyubwrnebgewmj.supabase.co"
SB_KEY = "sb_publishable_VvI57sGerWzNx9HkWIExzA_w0fhKsJa"


def anki_day(ms: int, rollover: int) -> str:
    """The study day a review belongs to, using Anki's own 'next day starts at' hour."""
    t = _dt.datetime.fromtimestamp(ms / 1000) - _dt.timedelta(hours=rollover)
    return t.date().isoformat()


def rule_for(deck_name: str, mapping: dict):
    """Find the setting for a deck: its own, or the closest parent deck's (A::B::C → A::B → A)."""
    parts = deck_name.split("::")
    for i in range(len(parts), 0, -1):
        key = "::".join(parts[:i])
        if key in mapping:
            return key, mapping[key]
    return None, None


def collect(rows, deck_names: dict, mapping: dict, rollover: int = 4):
    """rows: (review_ms, time_ms, deck_id). deck_names: {deck_id: 'Full::Name'}.
    Returns (entries, unmapped) where unmapped = {deck name: ms} for decks without a setting."""
    sums, unmapped, name_of = {}, {}, {}
    for rid, ms_spent, did in rows:
        if not ms_spent or ms_spent <= 0:
            continue
        name = deck_names.get(did)
        if name is None:
            continue
        key, rule = rule_for(name, mapping)
        if rule is None:
            top = name.split("::")[0]
            unmapped[top] = unmapped.get(top, 0) + ms_spent
            continue
        if rule.get("ignore"):
            continue
        day = anki_day(rid, rollover)
        k = (day, key)
        sums[k] = sums.get(k, 0) + ms_spent
        name_of[key] = rule
    entries = []
    for (day, key), ms in sorted(sums.items()):
        minutes = round(ms / 60000)
        if minutes < 1:
            continue
        rule = name_of[key]
        entries.append({
            "date": day, "subject": rule["subject"], "type": rule.get("type") or "Vocabulary",
            "minutes": min(minutes, 1440), "activity": ("Anki · " + key.replace("::", " › "))[:300],
            "src": "anki", "ext_id": day + "|" + key[:200],
        })
    return entries, unmapped


def send(token: str, entries: list, timeout: int = 20):
    """Send entries to Logbook (in chunks). Re-sending the same day and deck updates it — never duplicates."""
    sent = 0
    for i in range(0, len(entries), 400):
        part = entries[i:i + 400]
        body = json.dumps({"p_token": token, "p_entries": part}).encode()
        req = urllib.request.Request(SB_URL + "/rest/v1/rpc/ingest", data=body, method="POST",
                                     headers={"Content-Type": "application/json", "apikey": SB_KEY})
        try:
            with urllib.request.urlopen(req, timeout=timeout) as r:
                r.read()
        except urllib.error.HTTPError as e:
            msg = e.read().decode("utf-8", "replace")
            if "invalid token" in msg or e.code == 401:
                raise RuntimeError("The token was rejected — copy it again from Logbook → Setup → Connections.")
            raise RuntimeError(f"Logbook answered {e.code}: {msg[:200]}")
        except urllib.error.URLError as e:
            raise RuntimeError(f"No connection to Logbook ({e.reason}). It will try again later.")
        sent += len(part)
    return sent


REVLOG_SQL = ("select r.id, r.time, case when c.odid != 0 then c.odid else c.did end "
              "from revlog r join cards c on c.id = r.cid where r.id >= ?")


def since_ms(days: int) -> int:
    if days <= 0:
        return 0
    start = _dt.datetime.now() - _dt.timedelta(days=days)
    return int(start.timestamp() * 1000)


# ── Deck statistics (sent once a day) ──────────────────────────────────────
def deck_stats(db_all, today_day: int, deck_ids: list, since_ms_30: int):
    """db_all(sql, *args) -> rows. deck_ids: the deck and its subdecks. today_day: Anki's day number (col.sched.today).
    Returns cards by stage, 30-day retention of mature cards, reviews due tomorrow and reviews in the last 7 days."""
    if not deck_ids:
        return None
    ids = ",".join(str(int(i)) for i in deck_ids)
    inn = f"(did in ({ids}) or odid in ({ids}))"
    # type: 0 new, 1 learning, 2 review, 3 relearning; queue -1 = suspended
    r = db_all(f"select sum(type=0), sum(type in (1,3)), sum(type=2 and ivl<21), sum(type=2 and ivl>=21), "
               f"sum(queue=-1), count() from cards where {inn}")[0]
    new, learning, young, mature, suspended, total = [int(x or 0) for x in r]
    due = db_all(f"select count() from cards where {inn} and queue in (2,3) and due <= ?", today_day + 1)[0][0] or 0
    ret = db_all(f"select sum(r.ease>1), count() from revlog r join cards c on c.id=r.cid "
                 f"where (c.did in ({ids}) or c.odid in ({ids})) and r.type=1 and r.lastIvl>=21 and r.id>=?", since_ms_30)[0]
    passed, n = int(ret[0] or 0), int(ret[1] or 0)
    week = db_all(f"select count() from revlog r join cards c on c.id=r.cid where (c.did in ({ids}) or c.odid in ({ids})) "
                  f"and r.id>=?", since_ms(7))[0][0] or 0
    return {"new": new, "learning": learning, "young": young, "mature": mature, "suspended": suspended, "total": total,
            "due_tomorrow": int(due), "retention": round(passed / n, 4) if n else None, "retention_n": n, "reviews_7d": int(week)}


def send_stats(token: str, stats: list, timeout: int = 20):
    if not stats:
        return 0
    body = json.dumps({"p_token": token, "p_stats": stats}).encode()
    req = urllib.request.Request(SB_URL + "/rest/v1/rpc/ingest_stats", data=body, method="POST",
                                 headers={"Content-Type": "application/json", "apikey": SB_KEY})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            r.read()
    except urllib.error.HTTPError as e:
        if e.code == 404:   # the Logbook database doesn't have update 5 yet — time logging still works
            return 0
        raise RuntimeError(f"Logbook answered {e.code} for statistics")
    return len(stats)


def fetch_lists(token: str, timeout: int = 8):
    """Your own subjects and activity types from your Logbook account (needs database update 6).
    Returns {"username", "subjects": [...], "types": [...]} or None if it can't be reached."""
    body = json.dumps({"p_token": token}).encode()
    req = urllib.request.Request(SB_URL + "/rest/v1/rpc/token_lists", data=body, method="POST",
                                 headers={"Content-Type": "application/json", "apikey": SB_KEY})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            j = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if "invalid token" in e.read().decode("utf-8", "replace"):
            raise RuntimeError("The token was rejected — copy it again from Logbook → Setup → Connections.")
        return None
    except Exception:
        return None
    if not isinstance(j, dict):
        return None
    return {"username": j.get("username") or "", "subjects": [s for s in (j.get("subjects") or []) if s][:80],
            "types": [t for t in (j.get("types") or []) if t][:60]}

