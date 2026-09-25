"""Turn a RimWorld save into Sanity NDJSON: one colony, the pawns it remembers, and every record.

A record is one thing the save can prove happened: a tale, a letter, a message or a
conversation from the play log. Stories in the Tattler may only claim what records say.
"""
import argparse
import gzip
import json
import os
import re
import xml.etree.ElementTree as ET
from collections import Counter
from pathlib import Path

TICKS_PER_DAY = 60000
TICKS_PER_HOUR = 2500
GAME = os.environ.get("RIMWORLD_DIR", r"D:\SteamLibrary\steamapps\common\RimWorld")
LABELS = Path(__file__).resolve().parent / "def_labels.json"
WORKSHOP = os.environ.get("WORKSHOP_DIR", r"C:\tmp\steamcmd\steamapps\workshop\content\294100")

# What each tale means, in the paper's words. Tales carry no text of their own.
TALE_VERBS = {
    "AttendedParty": "{0} attended a party thrown by {1}",
    "Aurora": "{0} saw an aurora",
    "Breakup": "{0} broke up with {1}",
    "CaravanFormed": "{0} set out with a caravan",
    "CompletedLongConstructionProject": "{0} finished building {s}",
    "CompletedLongCraftingProject": "{0} finished crafting {s}",
    "Eclipse": "{0} saw an eclipse",
    "Exhausted": "{0} collapsed from exhaustion",
    "FinishedResearchProject": "{0} finished researching {s}",
    "GainedMasterSkillWithPassion": "{0} became a master of {s}",
    "HeatstrokeRevealed": "{0} came down with heatstroke",
    "HypothermiaRevealed": "{0} came down with hypothermia",
    "LandedInPod": "{0} landed in a drop pod",
    "Marriage": "{0} married {1}",
    "PlayedGame": "{0} played a game",
    "ReadBook": "{0} read a book",
    "SocialFight": "{0} got into a fist fight with {1}",
    "TradedWith": "{0} traded with {1}",
    "VisitedGrave": "{0} visited the grave of {1}",
    "WalkedNaked": "{0} walked around naked",
    "WasOnFire": "{0} caught fire",
    "Wounded": "{0} was wounded by {1}",
}
INTERACTIONS = {"Chitchat": "chatted with", "DeepTalk": "had a deep talk with", "Slight": "insulted"}
COLOR_TAG = re.compile(r"</?color[^>]*>")
FACTION_TAG = re.compile(r"\(\*\w+(=[^)]*)?\)|\(/\w+\)")


def clean(text):
    return FACTION_TAG.sub("", COLOR_TAG.sub("", text or "")).strip()


def when(tick, start):
    """Colony day and hour. Calendar dates in RimWorld shift with the colony's longitude, days since landing don't."""
    since = int(tick) - start
    return {"tick": int(tick), "colonyDay": since // TICKS_PER_DAY + 1, "hour": since % TICKS_PER_DAY // TICKS_PER_HOUR}


def pawn_name(snapshot):
    n = snapshot.find("name")
    if n is None:
        return {"first": None, "nick": None, "last": None}
    return {k: n.findtext(k) for k in ("first", "nick", "last")}


def short(name):
    return name["nick"] or name["first"] or name["last"]


def full(name):
    first, nick, last = name["first"], name["nick"], name["last"]
    if nick and nick not in (first, last):
        return f"{first} '{nick}' {last}"
    return " ".join(x for x in (first, last) if x)


def humanize(def_name):
    """VFEC_MeatDrying -> meat drying, for defs whose mod isn't installed here."""
    base = def_name.split("_", 1)[1] if re.match(r"^[A-Z][A-Za-z]{1,7}_", def_name) else def_name
    return re.sub(r"(?<=[a-z])(?=[A-Z])", " ", base.replace("_", " ")).lower()


def def_labels(wanted):
    """defName -> label from the game's and mods' Defs, for the defs the save mentions."""
    labels = {}
    roots = [Path(GAME, "Data"), Path(GAME, "Mods"), Path(WORKSHOP)]
    for root in roots:
        if not root.exists():
            continue
        for path in root.rglob("*.xml"):
            if "Defs" not in path.parts:
                continue
            data = path.read_bytes()
            if not any(name.encode() in data for name in wanted - labels.keys()):
                continue
            try:
                tree = ET.fromstring(data)
            except ET.ParseError:
                continue
            for el in tree:
                name, label = el.findtext("defName"), el.findtext("label")
                if name in wanted and label and name not in labels:
                    labels[name] = label
    return labels


def parse(save_path, scan_defs=False):
    opener = gzip.open if str(save_path).endswith(".gz") else open
    with opener(save_path, "rb") as f:
        root = ET.parse(f).getroot()
    game = root.find("game")
    start = int(game.findtext("tickManager/gameStartAbsTick"))
    now = int(game.findtext("tickManager/ticksGame")) + start

    pawns = {}

    def remember(pawn_id, name, snapshot=None, tick=0):
        pid = pawn_id.removeprefix("Thing_")
        p = pawns.setdefault(pid, {"names": [], "lastSeen": 0, "snapshot": None})
        if name and name not in p["names"]:
            p["names"].append(name)
        if snapshot is not None and tick >= p["lastSeen"]:
            p["lastSeen"], p["snapshot"] = tick, snapshot
        return pid

    records, subjects = [], set()
    for tale in game.find("taleManager/tales"):
        tick = int(tale.findtext("date"))
        cast = []
        for key in ("pawnData", "firstPawnData", "secondPawnData"):
            snap = tale.find(key)
            if snap is not None:
                name = pawn_name(snap)
                cast.append((remember(snap.findtext("pawn"), name, snap, tick), name))
        subject = tale.findtext("defData/defName")
        if subject:
            subjects.add(subject)
        records.append({"kind": "tale", "sourceId": tale.findtext("id"), "def": tale.findtext("def"),
                        "subjectDef": subject, "cast": cast, **when(tick, start)})

    for item in game.find("history/archive/archivables"):
        cls = item.get("Class")
        kind = "message" if cls == "Message" else "letter"
        tick = item.findtext("startingTick") if kind == "message" else item.findtext("arrivalTick")
        targets = [t.text for t in item.findall("lookTargets/targets/li") if (t.text or "").startswith("Thing_Human")]
        records.append({"kind": kind, "sourceId": item.findtext("ID"), "def": item.findtext("def"),
                        "letterClass": cls if kind == "letter" else None, "label": clean(item.findtext("label")),
                        "text": clean(item.findtext("text")), "targets": targets, **when(tick, start)})

    # Visitors in the play log only have names on the map or among world pawns.
    names = {}
    for el in root.iter():
        if el.findtext("def") == "Human" and el.find("kindDef") is not None and el.find("name") is not None:
            names["Thing_" + el.findtext("id")] = pawn_name(el)
    for entry in game.find("playLog/entries"):
        if entry.get("Class") != "PlayLogEntry_Interaction":
            continue
        cast = []
        for key in ("initiator", "recipient"):
            pid = entry.findtext(key)
            if pid in names:
                cast.append((remember(pid, names[pid]), names[pid]))
        if len(cast) == 2:
            records.append({"kind": "talk", "sourceId": entry.findtext("logID"), "def": entry.findtext("intDef"),
                            "cast": cast, **when(entry.findtext("ticksAbs"), start)})

    labels = json.loads(LABELS.read_text(encoding="utf-8")) if LABELS.exists() else {}
    if scan_defs:
        labels = {**labels, **def_labels(subjects - labels.keys())}
        LABELS.write_text(json.dumps(dict(sorted(labels.items())), indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    return root, game, start, now, pawns, records, labels


def pawn_doc(pid, p):
    snap = p["snapshot"]
    latest = pawn_name(snap) if snap is not None else p["names"][-1]
    doc = {"_id": f"pawn-{pid}", "_type": "pawn", "thingId": pid, "name": full(latest), "shortName": short(latest),
           "aliases": sorted({full(n) for n in p["names"]} | {x for n in p["names"] for x in n.values() if x}),
           "formerNames": sorted({full(n) for n in p["names"]} - {full(latest)})}
    if snap is not None:
        doc.update({"gender": snap.findtext("gender"), "age": int(snap.findtext("age") or 0) or None,
                    "relationNote": clean(snap.findtext("relationInfo")) or None,
                    "everColonist": snap.findtext("everBeenColonistOrTameAnimal") == "True"})
    return doc


def record_doc(r, pawns, labels):
    doc = {"_type": "record", "kind": r["kind"], "sourceId": r["sourceId"], "def": r["def"],
           "tick": r["tick"], "colonyDay": r["colonyDay"], "hour": r["hour"]}
    if r["kind"] in ("tale", "talk"):
        cast_ids = [pid for pid, _ in r["cast"]]
        who = [full(name) for _, name in r["cast"]]
        if r["kind"] == "tale":
            subject = labels.get(r["subjectDef"]) if r["subjectDef"] else None
            verb = TALE_VERBS.get(r["def"], r["def"] + ": {0}")
            text = verb.format(*(who + ["someone", "someone"]), s=subject or humanize(r["subjectDef"] or "something"))
            doc.update({"subjectDef": r["subjectDef"], "subjectLabel": subject})
        else:
            text = f"{who[0]} {INTERACTIONS.get(r['def'], 'talked to')} {who[1]}"
        doc["text"] = text[0].upper() + text[1:] + "."
    else:
        cast_ids = [t.removeprefix("Thing_") for t in r["targets"] if t.removeprefix("Thing_") in pawns]
        body = r["text"]
        # Letters and messages name pawns in their text without always targeting them.
        for pid, p in pawns.items():
            if pid not in cast_ids and any(re.search(rf"\b{re.escape(a)}\b", body + " " + (r["label"] or ""))
                                          for a in {short(n) for n in p["names"]} | {n["last"] for n in p["names"] if n["last"]}):
                cast_ids.append(pid)
        doc.update({"label": r["label"] or None, "text": body, "letterClass": r["letterClass"]})
    doc["_id"] = f"record-{r['kind']}-{r['sourceId']}"
    doc["pawns"] = [{"_type": "reference", "_ref": f"pawn-{pid}", "_key": pid} for pid in dict.fromkeys(cast_ids)]
    return {k: v for k, v in doc.items() if v is not None}


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("save")
    ap.add_argument("--colony", default="Tribe of Estian")
    ap.add_argument("--out", default=str(Path(__file__).resolve().parent.parent / "data" / "tattler.ndjson"))
    ap.add_argument("--scan-defs", action="store_true", help="look up def labels in the installed game and mods")
    args = ap.parse_args()

    root, game, start, now, pawns, records, labels = parse(args.save, args.scan_defs)
    docs = [record_doc(r, pawns, labels) for r in records]
    mentioned = {ref["_ref"].removeprefix("pawn-") for d in docs for ref in d["pawns"]}
    colony = {"_id": "colony", "_type": "colony", "name": args.colony,
              "gameVersion": root.findtext("meta/gameVersion"), "modCount": len(root.find("meta/modIds")),
              "currentDay": (now - start) // TICKS_PER_DAY + 1,
              "firstRecordDay": min(d["colonyDay"] for d in docs), "recordCount": len(docs)}
    out = [colony] + [pawn_doc(pid, p) for pid, p in pawns.items() if pid in mentioned] + docs

    Path(args.out).parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w", encoding="utf-8", newline="\n") as f:
        for d in out:
            f.write(json.dumps(d, ensure_ascii=False) + "\n")
    print(f"{len(docs)} records ({dict(Counter(d['kind'] for d in docs))}), {len(out) - len(docs) - 1} pawns, "
          f"days {colony['firstRecordDay']}-{colony['currentDay']}, {len(labels)}/{len({r['subjectDef'] for r in records if r.get('subjectDef')})} def labels -> {args.out}")


if __name__ == "__main__":
    main()
