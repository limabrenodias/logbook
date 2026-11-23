"""Logbook for Anki — logs the time you spend reviewing each deck to your Logbook.

Tools → Logbook… : paste your token (Logbook → Setup → Connections), choose a language
for each deck, and you're done. It sends after every review session and when Anki
closes. Re-sending a day updates it, so nothing is ever counted twice.
"""
from __future__ import annotations
from aqt import mw, gui_hooks
from aqt.qt import (QAction, QDialog, QVBoxLayout, QHBoxLayout, QFormLayout, QLabel, QLineEdit, QComboBox,
                    QPushButton, QTreeWidget, QTreeWidgetItem, QHeaderView, QSpinBox, QMessageBox, QTimer)
from aqt.utils import tooltip
from . import core

LANGS = ["French", "Polish", "German", "Spanish", "English", "Portuguese", "Italian", "Dutch", "Russian", "Ukrainian",
         "Czech", "Swedish", "Japanese", "Korean", "Chinese", "Arabic", "Turkish", "Greek", "Aviation", "Programming"]
TYPES = ["Vocabulary", "Grammar", "Reading", "Listening", "Mixed", "Pronunciation", "Speaking", "Writing"]
IGNORE = "— don't log —"
NOT_SET = "— not set —"
SAME = "— same as parent deck —"


def cfg():
    c = mw.addonManager.getConfig(__name__) or {}
    c.setdefault("token", ""); c.setdefault("decks", {}); c.setdefault("resend_days", 3); c.setdefault("last", ""); c.setdefault("lists", None)
    return c


def save_cfg(c):
    mw.addonManager.writeConfig(__name__, c)


def rollover():
    try:
        return int(mw.col.get_config("rollover", 4))
    except Exception:
        return 4


def gather(days):
    col = mw.col
    names = {d.id: d.name for d in col.decks.all_names_and_ids()}
    rows = col.db.all(core.REVLOG_SQL, core.since_ms(days))
    return core.collect(rows, names, cfg()["decks"], rollover())


def gather_stats():
    """Cards, retention and reviews due for each deck you've given a language."""
    col = mw.col
    names = {d.name: d.id for d in col.decks.all_names_and_ids()}
    day = core.anki_day(int(__import__("time").time() * 1000), rollover())
    out = []
    for name, rule in cfg()["decks"].items():
        if rule.get("ignore") or name not in names:
            continue
        ids = list(col.decks.deck_and_child_ids(names[name]))
        st = core.deck_stats(col.db.all, col.sched.today, ids, core.since_ms(30))
        if st:
            out.append({"date": day, "deck": name[:200], "subject": rule.get("subject"), "data": st})
    return out


NOTE_TYPE = "Logbook word"
FRONT = '<div class="lb-word">{{Word}}</div>{{#Sentence}}<div class="lb-sent">{{Sentence}}</div>{{/Sentence}}'
BACK = ('{{FrontSide}}<hr id=answer>{{#Meaning}}<div class="lb-mean">{{Meaning}}</div>{{/Meaning}}'
        '{{^Meaning}}<div class="lb-look"><a href="https://en.wiktionary.org/wiki/{{text:Word}}">Look up “{{Word}}”</a>'
        ' — then add the meaning with Edit.</div>{{/Meaning}}'
        '<div class="lb-meta">{{Language}}{{#Source}} · {{Source}}{{/Source}}{{#Link}} · <a href="{{Link}}">open the page</a>{{/Link}}</div>')
CSS = (".card{font-family:-apple-system,Segoe UI,Inter,sans-serif;font-size:20px;text-align:center;color:#1d1d1f;background:#fff}"
       ".lb-word{font-size:34px;font-weight:700;margin:12px 0}.lb-sent{font-size:19px;color:#444;line-height:1.5;max-width:640px;margin:0 auto}"
       ".lb-mean{font-size:24px;margin:10px 0}.lb-look{font-size:16px;color:#666}.lb-meta{font-size:13px;color:#888;margin-top:18px}"
       ".nightMode .card,.night_mode .card{background:#1e1e1e;color:#eee}.nightMode .lb-sent{color:#bbb}")


def ensure_note_type():
    mm = mw.col.models
    m = (getattr(mm, "by_name", None) or mm.byName)(NOTE_TYPE)
    if m:
        return m
    m = mm.new(NOTE_TYPE)
    for f in ["Word", "Sentence", "Meaning", "Language", "Source", "Link"]:
        (getattr(mm, "add_field", None) or mm.addField)(m, (getattr(mm, "new_field", None) or mm.newField)(f))
    t = (getattr(mm, "new_template", None) or mm.newTemplate)("Recognise")
    t["qfmt"], t["afmt"] = FRONT, BACK
    (getattr(mm, "add_template", None) or mm.addTemplate)(m, t)
    m["css"] = CSS
    mm.add(m)
    return (getattr(mm, "by_name", None) or mm.byName)(NOTE_TYPE)


def _search_escape(v: str) -> str:
    return "".join("\\" + ch if ch in '\\"*_:()' else ch for ch in v)


def pull_words(quiet=True):
    """Words you saved in Logbook (Alt+click with the browser tracker) become cards in your “Logbook words” deck."""
    c = cfg()
    if not c["token"] or not mw.col or not c.get("words_to_anki", True):
        return
    token = c["token"]

    def done(fut):
        try:
            words = fut.result()
        except Exception as e:
            print("Logbook words:", e)
            return
        if not words or not mw.col:
            return
        m = ensure_note_type()
        deck_id = mw.col.decks.id(cfg().get("words_deck") or "Logbook words")
        handled = []
        for w in words:
            try:
                found = mw.col.find_notes('"note:%s" "Word:%s" "Language:%s"' % (NOTE_TYPE, _search_escape(w["word"]), _search_escape(w["lang"])))
                if not found:
                    note = mw.col.new_note(m) if hasattr(mw.col, "new_note") else mw.col.newNote()
                    import html
                    note["Word"] = html.escape(w["word"])
                    note["Sentence"] = core.sentence_html(w.get("sentence") or "", w["word"])
                    note["Language"] = html.escape(w.get("lang") or "")
                    note["Source"] = html.escape(w.get("source") or "")
                    note["Link"] = html.escape(w.get("url") or "")
                    if hasattr(mw.col, "add_note"):
                        mw.col.add_note(note, deck_id)
                    else:
                        note.model()["did"] = deck_id
                        mw.col.addNote(note)
                handled.append(w["id"])
            except Exception as e:
                print("Logbook word:", w.get("word"), e)
        if handled:
            mw.taskman.run_in_background(lambda: core.mark_words(token, handled), lambda f: None)
            new = len(handled)
            tooltip(f"Logbook: {new} saved word{'s' if new != 1 else ''} added to Anki")
            try:
                mw.reset()
            except Exception:
                pass

    mw.taskman.run_in_background(lambda: core.fetch_words(token), done)


def sync(days=None, quiet=True):
    c = cfg()
    if not c["token"] or not mw.col:
        return
    pull_words(quiet)
    days = days if days is not None else int(c.get("resend_days", 3))
    try:
        entries, _ = gather(days)
    except Exception as e:  # collection closed, etc.
        if not quiet:
            QMessageBox.warning(mw, "Logbook", f"Couldn't read your reviews: {e}")
        return
    if not entries:
        if not quiet:
            tooltip("Logbook: nothing to send yet")
        return

    stats = []
    try:
        if c.get("stats_day") != core.anki_day(int(__import__("time").time() * 1000), rollover()) or not quiet:
            stats = gather_stats()
    except Exception as e:
        print("Logbook stats:", e)

    def work():
        n = core.send(c["token"], entries)
        if stats:
            try:
                core.send_stats(c["token"], stats)
            except Exception as e:
                print("Logbook stats:", e)
        return n

    def done(fut):
        c2 = cfg()
        try:
            n = fut.result()
            import datetime
            c2["last"] = f"Sent {n} day·deck totals at {datetime.datetime.now():%H:%M}" + (" (and deck statistics)" if stats else "")
            if stats:
                c2["stats_day"] = stats[0]["date"]
            save_cfg(c2)
            if not quiet:
                tooltip(f"Logbook: sent {n} entries")
        except Exception as e:
            c2["last"] = f"Last try failed: {e}"
            save_cfg(c2)
            if not quiet:
                QMessageBox.warning(mw, "Logbook", str(e))

    mw.taskman.run_in_background(work, done)


class Settings(QDialog):
    def __init__(self):
        super().__init__(mw)
        self.setWindowTitle("Logbook for Anki")
        self.resize(620, 560)
        c = cfg()
        lay = QVBoxLayout(self)
        intro = QLabel("Logs the time you spend reviewing to your Logbook — one entry per deck per day.<br>"
                       "Get a token in Logbook → <b>Setup → Connections</b> → Create token → Copy.")
        intro.setWordWrap(True)
        lay.addWidget(intro)
        form = QFormLayout()
        self.token = QLineEdit(c["token"]); self.token.setEchoMode(QLineEdit.EchoMode.Password)
        self.token.setPlaceholderText("Paste your token")
        form.addRow("Token", self.token)
        self.token.editingFinished.connect(self.load_lists)
        self.days = QSpinBox(); self.days.setRange(1, 60); self.days.setValue(int(c.get("resend_days", 3)))
        self.days.setSuffix(" days")
        form.addRow("Re-check the last", self.days)
        from aqt.qt import QCheckBox
        self.words = QCheckBox("Add the words I save in Logbook to Anki, in this deck:")
        self.words.setChecked(bool(c.get("words_to_anki", True)))
        self.words_deck = QLineEdit(c.get("words_deck") or "Logbook words")
        wrow = QHBoxLayout(); wrow.addWidget(self.words); wrow.addWidget(self.words_deck)
        form.addRow("Saved words", wrow)
        lay.addLayout(form)
        lay.addWidget(QLabel("<b>Decks</b> — click ▸ to open a deck and set its subdecks. "
                             "A subdeck left on “same as parent” is logged together with its parent."))
        self.source = QLabel("")
        self.source.setWordWrap(True)
        lay.addWidget(self.source)
        self.tree = QTreeWidget()
        self.tree.setColumnCount(4)
        self.tree.setHeaderLabels(["Deck", "Logged as", "Type", "Last 30 days"])
        self.tree.header().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        lay.addWidget(self.tree)
        self.lists = c.get("lists")
        self.fill(c)
        if c["token"]:
            QTimer.singleShot(50, self.load_lists)
        self.status = QLabel(c.get("last") or "Not sent yet.")
        self.status.setWordWrap(True)
        lay.addWidget(self.status)
        row = QHBoxLayout()
        self.back = QComboBox(); self.back.addItems(["last 30 days", "last 365 days", "all my history"])
        b_hist = QPushButton("Send history"); b_hist.clicked.connect(self.send_history)
        row.addWidget(QLabel("Fill in")); row.addWidget(self.back); row.addWidget(b_hist); row.addStretch(1)
        b_save = QPushButton("Save"); b_save.setDefault(True); b_save.clicked.connect(self.save)
        row.addWidget(b_save)
        lay.addLayout(row)

    def options(self):
        L = self.lists or {}
        subs, typs = L.get("subjects") or [], L.get("types") or []
        if L:
            self.source.setText(f"Subjects and types come from your Logbook{(' (@' + L['username'] + ')') if L.get('username') else ''}. "
                                "Add or rename them in Logbook, then reopen this window. You can also type a new one here.")
        else:
            self.source.setText("Showing a default list — paste your token to use the subjects and types from your own Logbook.")
        return (subs or LANGS), (typs or TYPES)

    def fill(self, c):
        self.tree.clear()
        subs, typs = self.options()
        names = sorted(d.name for d in mw.col.decks.all_names_and_ids())
        try:
            minutes = self.minutes_30()
        except Exception:
            minutes = {}
        items, self.rows = {}, []
        for n in names:  # sorted, so a parent always comes before its subdecks
            parent = n.rsplit("::", 1)[0] if "::" in n else None
            it = QTreeWidgetItem([n.split("::")[-1], "", "", f"{round(minutes.get(n, 0) / 60000)} min"])
            (items[parent].addChild(it) if parent in items else self.tree.addTopLevelItem(it))
            items[n] = it
            first = SAME if parent in items else NOT_SET
            rule = c["decks"].get(n)
            subj = QComboBox(); subj.setEditable(True)
            own = rule.get("subject") if rule and not rule.get("ignore") else None
            subj.addItems([first, IGNORE] + subs + ([own] if own and own not in subs else []))
            if rule:
                subj.setCurrentText(IGNORE if rule.get("ignore") else rule.get("subject", first))
            typ = QComboBox(); typ.setEditable(True)
            t_own = rule.get("type") if rule else None
            typ.addItems(typs + ([t_own] if t_own and t_own not in typs else []))
            if t_own:
                typ.setCurrentText(t_own)
            self.tree.setItemWidget(it, 1, subj); self.tree.setItemWidget(it, 2, typ)
            self.rows.append((n, subj, typ))
        # open the decks that have a subdeck with its own setting, so you can see it
        for n in c["decks"]:
            p = n
            while "::" in p:
                p = p.rsplit("::", 1)[0]
                if p in items:
                    items[p].setExpanded(True)
        for col in (1, 2, 3):
            self.tree.resizeColumnToContents(col)

    def minutes_30(self):
        names = {d.id: d.name for d in mw.col.decks.all_names_and_ids()}
        per = {}
        for _, ms, did in mw.col.db.all(core.REVLOG_SQL, core.since_ms(30)):
            parts = names.get(did, "").split("::")
            for i in range(1, len(parts) + 1):  # a subdeck's time also counts in each parent's total
                k = "::".join(parts[:i])
                per[k] = per.get(k, 0) + (ms or 0)
        return per

    def load_lists(self):
        tok = self.token.text().strip()
        if not tok:
            return
        def work():
            return core.fetch_lists(tok)
        def done(fut):
            try:
                L = fut.result()
            except Exception as e:
                self.source.setText(str(e)); return
            if not L or L == self.lists:
                return
            keep = self.read()          # keep what you've chosen so far in this window
            self.lists = L
            c = cfg(); c["lists"] = L; save_cfg(c)
            self.fill(keep)
        mw.taskman.run_in_background(work, done)

    def read(self):
        c = cfg()
        c["token"] = self.token.text().strip()
        c["resend_days"] = self.days.value()
        c["words_to_anki"] = self.words.isChecked()
        c["words_deck"] = (self.words_deck.text().strip() or "Logbook words")[:80]
        decks = {}
        for n, subj, typ in self.rows:
            v = subj.currentText().strip()
            if v == IGNORE:
                decks[n] = {"ignore": True}
            elif v and v not in (NOT_SET, SAME):
                decks[n] = {"subject": v[:60], "type": (typ.currentText().strip() or "Mixed")[:40]}
        c["decks"] = decks
        return c

    def save(self):
        save_cfg(self.read())
        sync(quiet=False)
        self.accept()

    def send_history(self):
        save_cfg(self.read())
        days = {0: 30, 1: 365, 2: 0}[self.back.currentIndex()]
        sync(days=days, quiet=False)


def open_settings():
    Settings().exec()


action = QAction("Logbook…", mw)
action.triggered.connect(open_settings)
mw.form.menuTools.addAction(action)
mw.addonManager.setConfigAction(__name__, open_settings)

# send after each review session, when Anki closes, and every 10 minutes while open
gui_hooks.reviewer_will_end.append(lambda: QTimer.singleShot(1500, sync))
gui_hooks.profile_will_close.append(lambda: sync())
_timer = QTimer(mw)
_timer.timeout.connect(lambda: sync())
_timer.start(10 * 60 * 1000)
