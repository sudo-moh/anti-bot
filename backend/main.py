from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, HTMLResponse
from fastapi.staticfiles import StaticFiles
import json
import os

app = FastAPI()


frontend_path = os.path.join(os.getcwd(), "../frontend")

# Serve JS, CSS, images, etc.
app.mount("/static", StaticFiles(directory=frontend_path), name="static")

@app.get("/", response_class=HTMLResponse)
async def serve_index(request: Request):
    # 1. Read index.html
    index_path = os.path.join(frontend_path, "index.html")
    with open(index_path, "r", encoding="utf-8") as f:
        html = f.read()

    # 2. Prepare backend request data
    backend = {
        "method": request.method,
        "url": str(request.url),
        "client": {
            "host": request.client.host if request.client else None,
            "port": request.client.port if request.client else None,
        },
        "headers": dict(request.headers),
        "query_params": dict(request.query_params),
        "cookies": request.cookies,
        "path_params": request.path_params,
        "scope": {
            "http_version": request.scope.get("http_version"),
            "scheme": request.scope.get("scheme"),
            "type": request.scope.get("type"),
            "server": request.scope.get("server"),
            "client": request.scope.get("client"),
            "headers": [
                (k.decode(), v.decode()) for k, v in request.scope.get("headers", [])
            ],
        },
    }

    # 3. Inject BEFORE sending HTML to browser
    injected = f"""
    <script>
        window.__FIRST_REQUEST__ = {json.dumps(backend)};
    </script>
        <script src="/static/http-request.js"></script>
    """

    # Put it in <head> so JS files can use it immediately
    html = html.replace("</head>", injected + "</head>")

    # 4. Return modified HTML
    return HTMLResponse(html)






if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
