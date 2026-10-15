/* Strict JSON for ExtendScript (ES3). Never evaluates configuration as code. */
AELocalToolkit.json = (function () {
  function stringify(value) {
    function quote(s) {
      return '"' + String(s).replace(/[\\"\u0000-\u001f]/g, function (c) {
        var escapes = { '"': '\\"', '\\': '\\\\', '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' };
        return escapes[c] || '\\u' + ('0000' + c.charCodeAt(0).toString(16)).slice(-4);
      }) + '"';
    }
    if (value === null) return 'null';
    if (typeof value === 'string') return quote(value);
    if (typeof value === 'number') return isFinite(value) ? String(value) : 'null';
    if (typeof value === 'boolean') return String(value);
    if (typeof value !== 'object') return undefined;
    var parts = [], i, encoded;
    if (value instanceof Array) {
      for (i = 0; i < value.length; i++) parts.push(stringify(value[i]) || 'null');
      return '[' + parts.join(',') + ']';
    }
    for (i in value) {
      if (Object.prototype.hasOwnProperty.call(value, i)) {
        encoded = stringify(value[i]);
        if (encoded !== undefined) parts.push(quote(i) + ':' + encoded);
      }
    }
    return '{' + parts.join(',') + '}';
  }
  function parse(source) {
    var text = String(source).replace(/^\uFEFF/, ''), at = 0;
    function fail() { throw new Error('无效 JSON，位置 ' + at); }
    function space() { while (/[\x20\t\r\n]/.test(text.charAt(at)) && at < text.length) at++; }
    function string() {
      var out = '', c, hex;
      at++;
      while (at < text.length) {
        c = text.charAt(at++);
        if (c === '"') return out;
        if (c === '\\') {
          c = text.charAt(at++);
          if (c === 'u') {
            hex = text.substr(at, 4);
            if (!/^[0-9a-fA-F]{4}$/.test(hex)) fail();
            out += String.fromCharCode(parseInt(hex, 16)); at += 4;
          } else {
            var escapes = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
            if (!Object.prototype.hasOwnProperty.call(escapes, c)) fail();
            out += escapes[c];
          }
        } else {
          if (c.charCodeAt(0) < 32) fail();
          out += c;
        }
      }
      fail();
    }
    function value(depth) {
      if (depth > 100) throw new Error('JSON 嵌套过深');
      space();
      var c = text.charAt(at), result, key, match;
      if (c === '"') return string();
      if (c === '{' || c === '[') {
        var object = c === '{', end = object ? '}' : ']';
        result = object ? {} : []; at++; space();
        if (text.charAt(at) === end) { at++; return result; }
        while (at < text.length) {
          if (object) {
            if (text.charAt(at) !== '"') fail();
            key = string();
            if (key === '__proto__' || key === 'constructor' || key === 'prototype') throw new Error('不支持的 JSON 字段');
            space(); if (text.charAt(at++) !== ':') fail();
            result[key] = value(depth + 1);
          } else result.push(value(depth + 1));
          space(); c = text.charAt(at++);
          if (c === end) return result;
          if (c !== ',') fail();
          space();
        }
        fail();
      }
      match = /^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/.exec(text.slice(at));
      if (!match) fail();
      at += match[0].length;
      if (match[0] === 'true') return true;
      if (match[0] === 'false') return false;
      if (match[0] === 'null') return null;
      result = Number(match[0]); if (!isFinite(result)) fail(); return result;
    }
    var result = value(0); space(); if (at !== text.length) fail(); return result;
  }
  return { parse: parse, stringify: stringify };
})();
