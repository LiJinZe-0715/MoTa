"""本地静态服务器（只用 Python 标准库）。

用法：
    python tools/serve.py [--bind 0.0.0.0] [--port 8123]

根目录固定为仓库根目录（tools/ 的上一级，与当前工作目录无关），只开放
`/`、`/index.html`、`/css/…`、`/js/…`，其它路径一律 404，也不列目录。
所有响应都带禁止缓存的头，改完文件刷新就是新版；默认只听本机，
`--bind 0.0.0.0` 时手机等局域网设备也能连。Ctrl+C 退出。

另有成绩接口（design/DESIGN.md §8.7）：
    POST /api/clears  收一条「打通一幕」的成绩，追加到 logs/clears.jsonl（同 id 不重复写）
    GET  /api/clears  返回全部成绩（JSON 数组）

另有札记接口（design/DESIGN.md §8.9）：
    POST /api/messages  收一批右侧札记，追加到 logs/messages/<runId>.log
                        （调试模式写 debug.log，没有 runId 的写 norun.log）
"""

import argparse
import datetime
import functools
import json
import os
import posixpath
import socket
import sys
import threading
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NO_CACHE_HEADERS = (
    ('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0'),
    ('Pragma', 'no-cache'),
    ('Expires', '0'),
)
LOG_DIR = os.path.join(ROOT, 'logs')
LOG_FILE = os.path.join(LOG_DIR, 'clears.jsonl')
MSG_DIR = os.path.join(LOG_DIR, 'messages')
LOG_LOCK = threading.Lock()
MAX_BODY = 8 * 1024 * 1024
MSG_BODY_MAX = 1024 * 1024
ROUTE_MAX = 30000
MSG_LINES_MAX = 3000
CONTENT_TYPES = {
    '.js': 'text/javascript',
    '.css': 'text/css; charset=utf-8',
    '.html': 'text/html; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.json': 'application/json; charset=utf-8',
}


def normalise_path(raw_path):
    """去掉查询串和片段、URL 解码、规范化；不安全时返回 None。"""
    path = raw_path.split('#', 1)[0].split('?', 1)[0]
    if '\\' in path:
        return None
    try:
        path = unquote(path, errors='strict')
    except ValueError:
        return None
    if '\\' in path or '..' in path or '\x00' in path:
        return None
    if not path.startswith('/'):
        return None
    path = posixpath.normpath(path)
    if '..' in path.split('/'):
        return None
    return '/' + path.lstrip('/')


def _is_int(v):
    return isinstance(v, int) and not isinstance(v, bool)


def validate_clear(rec):
    """检查一条成绩是否符合 §8.7 的格式；合格返回 None，否则返回出错原因。"""
    if not isinstance(rec, dict):
        return 'body must be a JSON object'
    if rec.get('v') != 1:
        return 'v must be 1'
    for key in ('id', 'runId', 'actTitle', 'at'):
        if not isinstance(rec.get(key), str) or not rec[key] or len(rec[key]) > 200:
            return '%s must be a non-empty string' % key
    if not _is_int(rec.get('act')) or rec['act'] < 1:
        return 'act must be a positive integer'
    if rec['id'] != '%s-%d' % (rec['runId'], rec['act']):
        return 'id must be <runId>-<act>'
    if rec.get('rank') is not None and not isinstance(rec.get('rank'), str):
        return 'rank must be a string or null'
    if not isinstance(rec.get('final'), bool):
        return 'final must be a boolean'
    for key in ('floor', 'hp', 'atk', 'def', 'gold', 'steps'):
        if not _is_int(rec.get(key)) or rec[key] < 0:
            return '%s must be a non-negative integer' % key
    keys = rec.get('keys')
    if not isinstance(keys, dict) or any(not _is_int(keys.get(k)) or keys[k] < 0 for k in ('yellow', 'blue', 'red')):
        return 'keys must have non-negative integers yellow, blue, red'
    doors = rec.get('closedDoors')
    if doors is not None:
        if not isinstance(doors, list) or len(doors) > 300:
            return 'closedDoors must be a list'
        for d in doors:
            if (not isinstance(d, list) or len(d) != 4 or not _is_int(d[0]) or d[0] < 1
                    or not _is_int(d[1]) or not 0 <= d[1] <= 10 or not _is_int(d[2]) or not 0 <= d[2] <= 10
                    or d[3] not in ('Y', 'B', 'R')):
                return 'closedDoors entries must be [floor, x, y, "Y"|"B"|"R"]'
    build = rec.get('build')
    if build is not None:
        if not isinstance(build, dict) or any(not isinstance(build.get(k), str) or len(build[k]) > 100
                                              for k in ('version', 'data', 'engine')):
            return 'build must be {version, data, engine} strings'
    builds = rec.get('builds')
    if builds is not None:
        if not isinstance(builds, list) or len(builds) > 50 or any(not isinstance(b, str) or len(b) > 200 for b in builds):
            return 'builds must be a list of strings'
    route = rec.get('route')
    if route is not None:
        if not isinstance(route, list):
            return 'route must be a list'
        if len(route) > ROUTE_MAX:
            return 'route must have at most %d entries' % ROUTE_MAX
        for entry in route:
            if not isinstance(entry, dict):
                return 'route entries must be objects'
    return None


def validate_messages(payload):
    """检查一批札记是否符合 §8.9 的格式；合格返回 None，否则返回出错原因。"""
    if not isinstance(payload, dict):
        return 'body must be a JSON object'
    run_id = payload.get('runId')
    if run_id is not None and (not isinstance(run_id, str) or not run_id or len(run_id) > 200):
        return 'runId must be a non-empty string or null'
    if not isinstance(payload.get('debug'), bool):
        return 'debug must be a boolean'
    lines = payload.get('lines')
    if not isinstance(lines, list) or not lines:
        return 'lines must be a non-empty list'
    if len(lines) > MSG_LINES_MAX:
        return 'lines must have at most %d entries' % MSG_LINES_MAX
    for line in lines:
        if not isinstance(line, dict):
            return 'lines entries must be objects'
        for key in ('at', 'v', 'kind', 'text'):
            if not isinstance(line.get(key), str):
                return '%s must be a string' % key
        if not _is_int(line.get('f')) or line['f'] < 1:
            return 'f must be a positive integer'
    return None


def safe_name(name):
    """文件名安全化：只留字母数字和 -_.，其余（含路径字符）换成下划线。"""
    safe = ''.join(ch if (ch.isalnum() or ch in '-_.') else '_' for ch in str(name))
    if not safe or safe.startswith('.'):
        safe = '_' + safe.lstrip('.')
    return safe


def route_path(clear_id):
    """路线日志文件路径：logs/routes/<id>.json；id 里的路径字符一律换成下划线。"""
    return os.path.join(LOG_DIR, 'routes', safe_name(clear_id) + '.json')


def message_path(run_id, debug):
    """札记文件路径：logs/messages/<runId>.log；调试写 debug.log，没有 runId 写 norun.log。"""
    if debug:
        name = 'debug'
    elif run_id:
        name = safe_name(run_id)
    else:
        name = 'norun'
    return os.path.join(MSG_DIR, name + '.log')


def write_messages(path, lines):
    """每条札记一行纯文本：at  v  F<f>  kind  text，text 里的换行换成空格。"""
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'a', encoding='utf-8') as fh:
        for line in lines:
            text = line['text'].replace('\r\n', ' ').replace('\r', ' ').replace('\n', ' ')
            fh.write('%s  %s  F%d  %s  %s\n' % (line['at'], line['v'], line['f'], line['kind'], text))


def write_route(clear_id, route):
    """把一条路线写成 JSON 文件；同 id 已存在时不覆盖。"""
    path = route_path(clear_id)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    if os.path.exists(path):
        return
    with open(path, 'w', encoding='utf-8') as fh:
        json.dump(route, fh, ensure_ascii=False)


def read_clears():
    if not os.path.isfile(LOG_FILE):
        return []
    out = []
    with open(LOG_FILE, encoding='utf-8') as fh:
        for line in fh:
            line = line.strip()
            if not line:
                continue
            try:
                out.append(json.loads(line))
            except ValueError:
                continue
    return out


class GameHandler(SimpleHTTPRequestHandler):
    extensions_map = CONTENT_TYPES

    def end_headers(self):
        for name, value in NO_CACHE_HEADERS:
            self.send_header(name, value)
        super().end_headers()

    def _not_found(self):
        body = b'404 Not Found\n'
        self.send_response(404)
        self.send_header('Content-Type', 'text/plain; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def _resolve(self):
        """把请求路径映射到文件系统路径；不允许时返回 None。"""
        path = normalise_path(self.path)
        if path is None:
            return None

        if path in ('/', '/index.html'):
            target = self.translate_path(path)
            if path == '/' and not os.path.isfile(os.path.join(target, 'index.html')):
                return None
            return target

        if not (path.startswith('/css/') or path.startswith('/js/')):
            return None

        target = self.translate_path(path)
        root = os.path.realpath(self.directory)
        if os.path.commonpath((root, os.path.realpath(target))) != root:
            return None
        if os.path.isdir(target):
            return None
        return target

    def send_error(self, code, message=None, explain=None):
        if code == 404:
            self._not_found()
            return
        super().send_error(code, message, explain)

    def _send_json(self, code, payload):
        body = json.dumps(payload, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        if self.command != 'HEAD':
            self.wfile.write(body)

    def _is_api(self):
        return normalise_path(self.path) == '/api/clears'

    def _read_json(self, limit):
        """读请求体并解析 JSON；返回 (payload, 出错原因)。"""
        try:
            length = int(self.headers.get('Content-Length') or 0)
        except ValueError:
            length = -1
        if length <= 0 or length > limit:
            return None, 'body must be 1-%d bytes' % limit
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode('utf-8')), None
        except (UnicodeDecodeError, ValueError):
            return None, 'body is not valid JSON'

    def _post_clear(self):
        rec, error = self._read_json(MAX_BODY)
        if error:
            self._send_json(400, {'ok': False, 'error': error})
            return
        problem = validate_clear(rec)
        if problem:
            self._send_json(400, {'ok': False, 'error': problem})
            return
        route = rec.pop('route', None)
        if route is not None:
            rec['routeEntries'] = len(route)
        if rec.get('build') is None:
            rec['build'] = None  # 旧客户端没带版本：明确记成「无版本」，审计时别猜
        rec['serverAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
        rec['ip'] = self.client_address[0]
        with LOG_LOCK:
            os.makedirs(LOG_DIR, exist_ok=True)
            if route is not None:
                write_route(rec['id'], route)
            if any(old.get('id') == rec['id'] for old in read_clears()):
                self._send_json(200, {'ok': True, 'duplicate': True})
                return
            with open(LOG_FILE, 'a', encoding='utf-8') as fh:
                fh.write(json.dumps(rec, ensure_ascii=False) + '\n')
        self._send_json(200, {'ok': True})

    def _post_messages(self):
        payload, error = self._read_json(MSG_BODY_MAX)
        if error:
            self._send_json(400, {'ok': False, 'error': error})
            return
        problem = validate_messages(payload)
        if problem:
            self._send_json(400, {'ok': False, 'error': problem})
            return
        path = message_path(payload.get('runId'), payload['debug'])
        with LOG_LOCK:
            try:
                write_messages(path, payload['lines'])
            except OSError as exc:
                self._send_json(500, {'ok': False, 'error': 'cannot write log: %s' % exc})
                return
        self._send_json(200, {'ok': True})

    def do_POST(self):
        path = normalise_path(self.path)
        if path == '/api/clears':
            self._post_clear()
        elif path == '/api/messages':
            self._post_messages()
        else:
            self._not_found()

    def _dispatch(self):
        if self._is_api():
            with LOG_LOCK:
                clears = read_clears()
            self._send_json(200, clears)
            return
        if self._resolve() is None:
            self._not_found()
            return
        if self.command == 'HEAD':
            super().do_HEAD()
        else:
            super().do_GET()

    def do_GET(self):
        self._dispatch()

    def do_HEAD(self):
        self._dispatch()

    do_PUT = do_DELETE = do_PATCH = do_OPTIONS = _not_found


def lan_ip():
    """尽力探测本机主 IPv4 地址（只建立 UDP 套接字，不发数据）。"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        sock.connect(('8.8.8.8', 80))
        return sock.getsockname()[0]
    except OSError:
        return None
    finally:
        sock.close()


def main():
    parser = argparse.ArgumentParser(description='本地静态服务器：只开放游戏文件。')
    parser.add_argument('--port', type=int, default=8123, help='监听端口（默认 8123）')
    parser.add_argument('--bind', default='127.0.0.1', help='绑定地址（默认 127.0.0.1）')
    args = parser.parse_args()

    handler = functools.partial(GameHandler, directory=ROOT)
    try:
        httpd = ThreadingHTTPServer((args.bind, args.port), handler)
    except OSError as exc:
        print('Cannot listen on %s:%s - %s' % (args.bind, args.port, exc), file=sys.stderr)
        return 1

    port = httpd.server_address[1]
    if args.bind == '0.0.0.0':
        print('Serving http://127.0.0.1:%d/ (Ctrl+C to stop)' % port, flush=True)
        ip = lan_ip()
        if ip:
            print('LAN: http://%s:%d/' % (ip, port), flush=True)
    else:
        print('Serving http://%s:%d/ (Ctrl+C to stop)' % (args.bind, port), flush=True)

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
    finally:
        httpd.server_close()
    return 0


if __name__ == '__main__':
    sys.exit(main())
