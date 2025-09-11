from flask import Flask, send_from_directory, request
import os

app = Flask(__name__, static_folder='web')

# Route for the root of the site
@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

# Route for all other static files
@app.route('/<path:path>')
def static_proxy(path):
    return send_from_directory(app.static_folder, path)

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=int(os.environ.get("PORT", 8080)), debug=True)
