"""Play a recorded message to a list of farmers through Exotel.

    python broadcast.py plan   --list farmers.csv --campaign gram-oct --crop Gram
    python broadcast.py send   --list farmers.csv --campaign gram-oct --crop Gram           (practice run, no calls)
    python broadcast.py send   --list farmers.csv --campaign gram-oct --crop Gram --live    (real calls)
    python broadcast.py status --campaign gram-oct

Safety rules built in:
  * Only farmers marked consent=yes are called.
  * Nobody is called twice in the same campaign.
  * Calls only between 9:00 and 21:00 (India time).
  * Without --live nothing is dialled.
Uses only the Python standard library, so there is nothing to install.
"""
import argparse
import base64
import configparser
import csv
import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

HERE = Path(__file__).resolve().parent
IST = timezone(timedelta(hours=5, minutes=30))
CALL_HOURS = (9, 21)  # start hour inclusive, end hour exclusive
LOG_FIELDS = ["phone", "name", "village", "call_sid", "requested_at", "status", "duration", "note"]
YES = {"yes", "y", "haan", "ha", "1", "true", "हाँ", "हां"}


# ---------- config ----------
def load_config(path):
    if not path.exists():
        sys.exit(f"Config file not found: {path}\nCopy config.example.ini to config.ini and fill it in.")
    cp = configparser.ConfigParser()
    cp.read(path, encoding="utf-8")
    c = cp["exotel"]
    cfg = {k: c.get(k, "").strip() for k in ("sid", "api_key", "api_token", "subdomain", "caller_id", "flow_app_id", "api_base")}
    cfg["seconds_between_calls"] = c.getfloat("seconds_between_calls", 3)
    cfg["max_calls_per_run"] = c.getint("max_calls_per_run", 200)
    cfg["ring_timeout"] = c.getint("ring_timeout", 30)
    cfg["cost_per_call"] = c.getfloat("cost_per_call_rupees", 1.0)
    return cfg


def require_live_config(cfg):
    missing = [k for k in ("sid", "api_key", "api_token", "subdomain", "caller_id", "flow_app_id") if not cfg[k]]
    if missing:
        sys.exit("Fill these in config.ini before making real calls: " + ", ".join(missing))
    if not cfg["caller_id"].replace("+91", "").lstrip("0").startswith("140"):
        sys.exit("caller_id must be your 140-series promotional number from Exotel.\n"
                 "TRAI allows recorded promotional calls only from 140-series numbers;\n"
                 "calling from a normal number can get all your phone numbers disconnected.")


# ---------- farmers list ----------
def normalise_phone(raw):
    digits = "".join(ch for ch in str(raw) if ch.isdigit())
    if len(digits) > 10 and digits.startswith("91"):
        digits = digits[2:]
    digits = digits.lstrip("0") if len(digits) == 11 else digits
    if len(digits) == 10 and digits[0] in "6789":
        return "+91" + digits
    return None


def read_list(path):
    with open(path, newline="", encoding="utf-8-sig") as f:
        rows = list(csv.DictReader(f))
    # Accept any capitalisation of column names (the sales app exports "Name", "Phone", ...).
    return [{(k or "").strip().lower(): (v or "").strip() for k, v in r.items()} for r in rows]


def log_path(campaign):
    safe = "".join(ch for ch in campaign if ch.isalnum() or ch in "-_")
    if not safe:
        sys.exit("Give the campaign a simple name, e.g. --campaign gram-oct")
    return HERE / f"calls-{safe}.csv"


def read_log(path):
    if not path.exists():
        return []
    with open(path, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def write_log(path, rows):
    with open(path, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=LOG_FIELDS)
        w.writeheader()
        for r in rows:
            w.writerow({k: r.get(k, "") for k in LOG_FIELDS})


def build_plan(farmers, done_phones, crop, village):
    to_call, skipped, seen = [], [], set()
    for f in farmers:
        name = f.get("name", "")
        phone = normalise_phone(f.get("phone", ""))
        crops = [c.strip().lower() for c in f.get("crops", "").split(",") if c.strip()]
        if not phone:
            skipped.append((name, f.get("phone", ""), "phone number not valid"))
        elif f.get("consent", "").lower() not in YES:
            skipped.append((name, phone, "no consent recorded"))
        elif crop and crop.lower() not in crops:
            skipped.append((name, phone, f"does not grow {crop}"))
        elif village and village.lower() != f.get("village", "").lower():
            skipped.append((name, phone, f"not in {village}"))
        elif phone in done_phones:
            skipped.append((name, phone, "already called in this campaign"))
        elif phone in seen:
            skipped.append((name, phone, "listed twice"))
        else:
            seen.add(phone)
            to_call.append({"phone": phone, "name": name, "village": f.get("village", "")})
    return to_call, skipped


# ---------- Exotel ----------
def api_root(cfg):
    base = cfg["api_base"] or f"https://{cfg['subdomain']}"
    return f"{base.rstrip('/')}/v1/Accounts/{cfg['sid']}"


def exotel_request(cfg, url, data=None):
    token = base64.b64encode(f"{cfg['api_key']}:{cfg['api_token']}".encode()).decode()
    body = urllib.parse.urlencode(data).encode() if data is not None else None
    req = urllib.request.Request(url, data=body, headers={"Authorization": "Basic " + token, "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode() or "{}")


def place_call(cfg, phone, campaign):
    data = {
        "From": phone,
        "CallerId": cfg["caller_id"],
        "Url": f"http://my.exotel.com/{cfg['sid']}/exoml/start_voice/{cfg['flow_app_id']}",
        "TimeOut": cfg["ring_timeout"],
        "CustomField": campaign,
    }
    result = exotel_request(cfg, api_root(cfg) + "/Calls/connect.json", data)
    return result.get("Call", {}).get("Sid", "")


def call_details(cfg, sid):
    call = exotel_request(cfg, f"{api_root(cfg)}/Calls/{sid}.json").get("Call", {})
    return call.get("Status", ""), str(call.get("Duration") or "")


# ---------- commands ----------
def print_plan(to_call, skipped, cfg):
    print(f"\nWill call {len(to_call)} farmers.")
    for p in to_call[:15]:
        print(f"   {p['name'] or '(no name)':25} {p['village']:15} {p['phone']}")
    if len(to_call) > 15:
        print(f"   ... and {len(to_call) - 15} more")
    if skipped:
        print(f"\nSkipping {len(skipped)}:")
        reasons = {}
        for _, _, why in skipped:
            reasons[why] = reasons.get(why, 0) + 1
        for why, n in sorted(reasons.items(), key=lambda x: -x[1]):
            print(f"   {n:4}  {why}")
    print(f"\nEstimated cost: about Rs {len(to_call) * cfg['cost_per_call']:.0f} "
          f"(at Rs {cfg['cost_per_call']:g} per call; check your Exotel plan).")


def cmd_plan(args, cfg):
    done = {r["phone"] for r in read_log(log_path(args.campaign))}
    to_call, skipped = build_plan(read_list(args.list), done, args.crop, args.village)
    print_plan(to_call, skipped, cfg)


def cmd_send(args, cfg):
    path = log_path(args.campaign)
    log = read_log(path)
    to_call, skipped = build_plan(read_list(args.list), {r["phone"] for r in log}, args.crop, args.village)
    to_call = to_call[: cfg["max_calls_per_run"]]
    print_plan(to_call, skipped, cfg)
    if not to_call:
        return
    if not args.live:
        print("\nPRACTICE RUN: no calls made. Add --live to really call.")
        return
    require_live_config(cfg)
    now = datetime.now(IST)
    if not (CALL_HOURS[0] <= now.hour < CALL_HOURS[1]):
        sys.exit(f"It is {now:%H:%M} in India. Calls are only made between {CALL_HOURS[0]}:00 and {CALL_HOURS[1]}:00.")
    if input(f"\nType YES to call {len(to_call)} farmers now: ").strip() != "YES":
        sys.exit("Cancelled. No calls made.")
    placed = 0
    for i, p in enumerate(to_call, 1):
        if datetime.now(IST).hour >= CALL_HOURS[1]:
            print("Reached 9 pm. Stopping; run again tomorrow to call the rest.")
            break
        row = dict(p, requested_at=datetime.now(IST).strftime("%Y-%m-%d %H:%M"))
        try:
            row["call_sid"] = place_call(cfg, p["phone"], args.campaign)
            row["status"] = "requested"
            placed += 1
        except urllib.error.HTTPError as e:
            row["status"], row["note"] = "error", f"HTTP {e.code}: {e.read().decode(errors='replace')[:150]}"
            if e.code in (401, 403):
                log.append(row); write_log(path, log)
                sys.exit("Exotel refused the login. Check api_key, api_token, sid and subdomain in config.ini.")
        except (urllib.error.URLError, TimeoutError) as e:
            row["status"], row["note"] = "error", f"network: {e}"
        log.append(row)
        write_log(path, log)  # save after every call so nothing is lost if stopped
        print(f"[{i}/{len(to_call)}] {p['phone']} {row['status']}")
        time.sleep(cfg["seconds_between_calls"])
    print(f"\nRequested {placed} calls. In about 15 minutes run:\n   python broadcast.py status --campaign {args.campaign}")


def cmd_status(args, cfg):
    path = log_path(args.campaign)
    log = read_log(path)
    if not log:
        sys.exit(f"No calls recorded for campaign '{args.campaign}'.")
    final = {"completed", "failed", "busy", "no-answer", "canceled"}
    pending = [r for r in log if r["call_sid"] and r["status"] not in final]
    if pending:
        require_live_config(cfg)
        for r in pending:
            try:
                r["status"], r["duration"] = call_details(cfg, r["call_sid"])
            except (urllib.error.URLError, TimeoutError) as e:
                r["note"] = f"status check failed: {e}"
        write_log(path, log)
    counts = {}
    for r in log:
        counts[r["status"]] = counts.get(r["status"], 0) + 1
    print(f"\nCampaign {args.campaign}: {len(log)} calls")
    for s, n in sorted(counts.items(), key=lambda x: -x[1]):
        print(f"   {n:4}  {s}")
    listened = [r for r in log if r["status"] == "completed" and r["duration"].isdigit() and int(r["duration"]) >= 20]
    print(f"\n{len(listened)} farmers listened for 20+ seconds. Have staff call them back first:")
    for r in listened[:30]:
        print(f"   {r['name'] or '(no name)':25} {r['village']:15} {r['phone']}")
    print(f"\nFull results: {path}")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Recorded-message calls to farmers through Exotel.")
    ap.add_argument("--config", default=str(HERE / "config.ini"))
    sub = ap.add_subparsers(dest="cmd", required=True)
    for name in ("plan", "send"):
        s = sub.add_parser(name)
        s.add_argument("--list", required=True, help="CSV with name, phone, village, crops, consent")
        s.add_argument("--campaign", required=True, help="short name, e.g. gram-oct")
        s.add_argument("--crop", help="only farmers who grow this crop")
        s.add_argument("--village", help="only farmers from this village")
        if name == "send":
            s.add_argument("--live", action="store_true", help="really make the calls")
    s = sub.add_parser("status")
    s.add_argument("--campaign", required=True)
    args = ap.parse_args(argv)
    cfg = load_config(Path(args.config))
    {"plan": cmd_plan, "send": cmd_send, "status": cmd_status}[args.cmd](args, cfg)


if __name__ == "__main__":
    main()
