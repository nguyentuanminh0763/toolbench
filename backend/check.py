"""Safety net for the encryption and settings-merge paths.

    uv run python check.py        # must print "7/7 PASS"

Run it after touching crypto.py, db.py or auth.py. These are the two places
where a silent mistake is expensive: one loses the user's API keys, the other
hands them to the browser in clear text. Everything else in this boilerplate
is visible on screen the moment it breaks; these are not.

Plain asserts, no pytest — one fewer dependency, and it runs anywhere.
"""
import tempfile
from pathlib import Path

from app import crypto, db

PASSWORD = "a test password"


def fresh_db():
    """Point db at a throwaway file so a real data.db is never touched."""
    db.DB_PATH = Path(tempfile.mkdtemp()) / "check.db"
    db.init()
    crypto.unlock_with(crypto.derive(PASSWORD, crypto.new_salt()))


def t1_roundtrip():
    fresh_db()
    db.put("wp_app_password", "hunter2 with spaces")
    assert db.get("wp_app_password") == "hunter2 with spaces"


def t2_ciphertext_on_disk():
    """The whole point: the plain value must not appear in the file."""
    fresh_db()
    db.put("wp_app_password", "AIza-VERY-SECRET")
    assert db.raw("wp_app_password").startswith(crypto.PREFIX)
    assert b"AIza-VERY-SECRET" not in db.DB_PATH.read_bytes()


def t3_wrong_key_yields_nothing():
    """Not garbage, not a partial string — a wrong key must read as empty, or
    a corrupted credential gets sent to a live API."""
    fresh_db()
    db.put("wp_app_password", "AIza-VERY-SECRET")
    crypto.unlock_with(crypto.derive("the wrong password", crypto.new_salt()))
    assert db.get("wp_app_password") == ""


def t4_locked_reads_empty():
    fresh_db()
    db.put("gemini_keys", '[{"id":"a","name":"Main","value":"K1"}]')
    crypto.lock()
    assert db.get_list("gemini_keys") == []
    crypto.unlock_with(crypto.derive(PASSWORD, crypto.new_salt()))  # relock for later


def t5_snapshot_masks_and_hides():
    fresh_db()
    db.put("wp_app_password", "abcdEFGH1234")
    db.put("wp_base", "https://example.com")
    db.set_raw("auth_salt", "some-salt")
    out = db.snapshot()
    assert out["wp_app_password"] == db.MASK + "1234", out["wp_app_password"]
    assert out["wp_base"] == "https://example.com"
    assert "auth_salt" not in out, "internal rows must never reach the browser"


def t6_merge_keeps_masked_adds_new():
    """The one users would notice: adding a spare key must not wipe the first."""
    fresh_db()
    db.put("gemini_keys", '[{"id":"a","name":"Main","value":"REAL-1"}]')
    incoming = (
        '[{"id":"a","name":"Main","value":"' + db.MASK + 'AL-1"},'
        '{"id":"b","name":"Spare","value":"REAL-2"}]'
    )
    db.put("gemini_keys", db.merge_keys("gemini_keys", incoming))
    assert db.get_list("gemini_keys") == ["REAL-1", "REAL-2"]


def t7_merge_survives_rename_and_delete():
    fresh_db()
    db.put(
        "gemini_keys",
        '[{"id":"a","name":"Main","value":"REAL-1"},'
        '{"id":"b","name":"Spare","value":"REAL-2"},'
        '{"id":"c","name":"Third","value":"REAL-3"}]',
    )
    # Drop the middle one and rename the first, both still masked.
    incoming = (
        '[{"id":"a","name":"Primary","value":"' + db.MASK + 'AL-1"},'
        '{"id":"c","name":"Third","value":"' + db.MASK + 'AL-3"}]'
    )
    db.put("gemini_keys", db.merge_keys("gemini_keys", incoming))
    got = [(e["name"], e["value"]) for e in db.get_keys("gemini_keys")]
    assert got == [("Primary", "REAL-1"), ("Third", "REAL-3")], got


if __name__ == "__main__":
    tests = [t1_roundtrip, t2_ciphertext_on_disk, t3_wrong_key_yields_nothing,
             t4_locked_reads_empty, t5_snapshot_masks_and_hides,
             t6_merge_keeps_masked_adds_new, t7_merge_survives_rename_and_delete]
    passed = 0
    for t in tests:
        try:
            t()
            print(f"  PASS  {t.__name__}")
            passed += 1
        except Exception as e:
            print(f"  FAIL  {t.__name__}: {type(e).__name__}: {e}")
    print(f"\n{passed}/{len(tests)} PASS")
    raise SystemExit(0 if passed == len(tests) else 1)
