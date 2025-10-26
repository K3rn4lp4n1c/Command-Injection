from flask import Flask, request, jsonify
from flask_cors import CORS
from subprocess import run, PIPE, CalledProcessError
from werkzeug.utils import secure_filename

import json
import os
import tempfile

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
    
    path = secure_filename(file_storage.filename)
    try:
        if path != "exiftool_test.png":
            _, ext = os.path.splitext(path)
            with tempfile.NamedTemporaryFile(delete=False, prefix="upload_", suffix=(ext or ""), dir=None) as tmp:
                path = tmp.name
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
            print(proc.stdout)
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
        if path and os.path.exists(path) and path.startswith('upload_'):
            try:
                os.remove(path)
            except OSError:
                # best-effort cleanup
                pass

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)