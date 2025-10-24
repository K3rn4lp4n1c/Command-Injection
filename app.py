from flask import Flask, request, jsonify
from flask_cors import CORS
from subprocess import run, PIPE, CalledProcessError

import json
import os

app = Flask(__name__)
CORS(app)

app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MiB

@app.route("/metadata", methods=["POST", "OPTIONS"])
def metadata():
    if request.method == "OPTIONS":
        return ("", 204)

    if "file" not in request.files:
        return jsonify({"ok": False, "error": "No file part in the request (expected field 'file')"}), 400

    file_storage = request.files["file"]
    if not file_storage.filename:
        return jsonify({"ok": False, "error": "Invalid file"}), 400
    
    path = file_storage.filename
    try:
        file_storage.save(path)
        try:
            proc = run(f"exiftool -j {path}", stdout=PIPE, stderr=PIPE, shell=True)
        except CalledProcessError as e:
            return jsonify({
                "ok": False,
                "error": "exiftool failed",
                "stderr": e.stderr.strip(),
                "returncode": e.returncode
            }), 500

        try:
            payload = json.loads(proc.stdout)
        except:
            return jsonify({
                "ok": False,
                "error": "Failed to parse exiftool output as JSON",
            }), 500
        is_image = False

        try:
            first = None
            if isinstance(payload, list) and len(payload) > 0 and isinstance(payload[0], dict):
                first = payload[0]
            elif isinstance(payload, dict):
                first = payload

            if isinstance(first, dict):
                mime = first.get("MIMEType")
            if isinstance(mime, str) and mime.lower().startswith("image/"):
                is_image = True
        except Exception:
            is_image = False

        return jsonify({"ok": True, "is_image": is_image}), 200
    
    finally:
        if path and os.path.exists(path):
            try:
                KEEP = {"app.py", "flag.txt", "test_image.png"}
                for filename in os.listdir("."):
                    if not filename in KEEP and not os.path.isdir(filename):
                        os.remove(filename)
            except OSError:
                pass

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)