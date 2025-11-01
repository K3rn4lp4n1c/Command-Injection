from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
from subprocess import run, PIPE, CalledProcessError
from werkzeug.utils import secure_filename
from functools import wraps

import json
import os
import tempfile

app = Flask(__name__)
CORS(app)

TEST_ASSET = "exiftool_test.png"
app.config["MAX_CONTENT_LENGTH"] = 50 * 1024 * 1024  # 50 MiB

def log_req(f):
    @wraps(f)
    def wrapper(*args, **kwargs):
        client = request.headers.get("X-Forwarded-For", request.remote_addr)
        print(f"-> {request.method} {request.full_path} from {client}", flush=True)
        resp = make_response(f(*args, **kwargs))
        print(f"<- {resp.status_code} {request.path}", flush=True)
        return resp
    return wrapper

@app.route("/metadata", methods=["POST", "OPTIONS"])
@log_req
def metadata():
    if request.method == "OPTIONS":
        return ("", 204)

    if "file" not in request.files:
        return jsonify({"ok": False, "error": "Malformed request"}), 400

    file_storage = request.files["file"]
    if not file_storage.filename:
        return jsonify({"ok": False, "error": "Invalid file"}), 400
    
    path = secure_filename(file_storage.filename)
    create_temp = False
    try:
        if TEST_ASSET not in path:
            _, ext = os.path.splitext(path)
            with tempfile.NamedTemporaryFile(delete=False, prefix="upload_", suffix=(ext or ""), dir=None) as tmp:
                create_temp = True  
                path = tmp.name
            file_storage.save(path)
        try:
            proc = run(f"exiftool -j {path}", stdout=PIPE, stderr=PIPE, shell=True, check=True, text=True)
        except CalledProcessError as e:
            return jsonify({
                "ok": False,
                "error": "Image Checker failed.",
            }), 500

        try:
            payload = json.loads(proc.stdout)
        except json.JSONDecodeError:
            print(proc.stdout, proc.stderr)
            return jsonify({
                "ok": False,
                "error": "Exiftool output is invalid",
            }), 500
        except Exception as e:
            print("Unexpected error parsing exiftool output:", str(e))
            return jsonify({
                "ok": False,
                "error": "Unexpected error parsing Exiftool output",
            }), 500
        is_image = False

        try:
            first = mime = None
            if isinstance(payload, list) and len(payload) > 0 and isinstance(payload[0], dict):
                first = payload[0]
            elif isinstance(payload, dict):
                first = payload

            if isinstance(first, dict):
                mime = first.get("MIMEType", "")
            if isinstance(mime, str) and mime.lower().startswith("image/"):
                is_image = True
        except Exception:
            is_image = False

        return jsonify({"ok": True, "is_image": is_image}), 200
    
    finally:
        if create_temp and path and os.path.exists(path):
            try:
                os.remove(path)
            except OSError:
                # best-effort cleanup
                pass

@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok"}), 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)