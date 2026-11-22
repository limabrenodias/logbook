"""Logbook for Anki — logs the time you spend reviewing each deck to your Logbook.

Tools → Logbook… : paste your token (Logbook → Setup → Connections), choose a language
for each deck, and you're done. It sends after every review session and when Anki
closes. Re-sending a day updates it, so nothing is ever counted twice.
"""
from __future__ import annotations
from aqt import mw, gui_hooks
from aqt.qt import (QAction, QDialog, QVBoxLayout, QHBoxLayout, QFormLayout, QLabel, QLineEdit, QComboBox,
                    QPushButton, QTableWidget, QTableWidgetItem, QHeaderView, QSpinBox, QMessageBox, QTimer)
from aqt.utils import tooltip
from . import core

LANGS = ["French", "Polish", "German", "Spanish", "English", "Portuguese", "Italian", "Dutch", "Russian", "Ukrainian",
         "Czech", "Swedish", "Japanese", "Korean", "Chinese", "Arabic", "Turkish", "Greek", "Aviation", "Programming"]
TYPES = ["Vocabulary", "Grammar", "Reading", "Listening", "Mixed", "Pronunciation", "Speaking", "Writing"]
IGNORE = "— don't log —"
NOT_SET = "— not set —"


def cfg():
    c = mw.addonManager.getConfig(__name__) or {}
    c.setdefault("token", ""); c.setdefault("decks", {}); c.setdefault("resend_days", 3); c.setdefault("last", "")
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


def sync(days=None, quiet=True):
    c = cfg()
    if not c["token"] or not mw.col:
        return
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

    def work():
        return core.send(c["token"], entries)

    def done(fut):
        c2 = cfg()
        try:
            n = fut.result()
            import datetime
            c2["last"] = f"Sent {n} day·deck totals at {datetime.datetime.now():%H:%M}"
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
        self.days = QSpinBox(); self.days.setRange(1, 60); self.days.setValue(int(c.get("resend_days", 3)))
        self.days.setSuffix(" days")
        form.addRow("Re-check the last", self.days)
        lay.addLayout(form)
        lay.addWidget(QLabel("<b>Decks</b> — subdecks follow their parent unless you set them too."))
        self.table = QTableWidget(0, 4)
        self.table.setHorizontalHeaderLabels(["Deck", "Logged as", "Type", "Last 30 days"])
        self.table.horizontalHeader().setSectionResizeMode(0, QHeaderView.ResizeMode.Stretch)
        lay.addWidget(self.table)
        self.fill(c)
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

    def fill(self, c):
        names = sorted(d.name for d in mw.col.decks.all_names_and_ids())
        try:
            _, minutes = self.minutes_30()
        except Exception:
            minutes = {}
        shown = [n for n in names if "::" not in n] + [n for n in names if "::" in n and n in c["decks"]]
        self.rows = []
        for n in shown:
            r = self.table.rowCount(); self.table.insertRow(r)
            self.table.setItem(r, 0, QTableWidgetItem(n.replace("::", " › ")))
            rule = c["decks"].get(n)
            subj = QComboBox(); subj.setEditable(True)
            subj.addItems([NOT_SET, IGNORE] + LANGS)
            if rule:
                subj.setCurrentText(IGNORE if rule.get("ignore") else rule.get("subject", NOT_SET))
            typ = QComboBox(); typ.addItems(TYPES)
            if rule and rule.get("type"):
                typ.setCurrentText(rule["type"])
            self.table.setCellWidget(r, 1, subj); self.table.setCellWidget(r, 2, typ)
            self.table.setItem(r, 3, QTableWidgetItem(f"{round(minutes.get(n, 0) / 60000)} min"))
            self.rows.append((n, subj, typ))

    def minutes_30(self):
        names = {d.id: d.name for d in mw.col.decks.all_names_and_ids()}
        rows = mw.col.db.all(core.REVLOG_SQL, core.since_ms(30))
        per = {}
        for _, ms, did in rows:
            top = names.get(did, "").split("::")[0]
            per[top] = per.get(top, 0) + (ms or 0)
        return None, per

    def read(self):
        c = cfg()
        c["token"] = self.token.text().strip()
        c["resend_days"] = self.days.value()
        decks = {}
        for n, subj, typ in self.rows:
            v = subj.currentText().strip()
            if v == IGNORE:
                decks[n] = {"ignore": True}
            elif v and v != NOT_SET:
                decks[n] = {"subject": v[:60], "type": typ.currentText()}
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
