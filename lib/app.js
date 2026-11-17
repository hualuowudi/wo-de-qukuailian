/*
 * 拾珠绣 · 区块链溯源系统 —— 共享逻辑
 * 纯 JS 实现（浏览器 / Node 通用）：
 *   - SHA-256（UTF-8）
 *   - 稳定字符串化（键排序，保证两端哈希一致）
 *   - 简化区块链：链式哈希 + 校验
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.Trace = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GENESIS_PREV = '0000000000000000000000000000000000000000000000000000000000000000';

  // ---------- 稳定字符串化（递归键排序） ----------
  function stableStringify(value) {
    if (value === null) return 'null';
    var t = typeof value;
    if (t === 'string') return JSON.stringify(value);
    if (t === 'number') return String(value);
    if (t === 'boolean') return value ? 'true' : 'false';
    if (Array.isArray(value)) {
      return '[' + value.map(stableStringify).join(',') + ']';
    }
    var keys = Object.keys(value).sort();
    return '{' + keys.map(function (k) {
      return JSON.stringify(k) + ':' + stableStringify(value[k]);
    }).join(',') + '}';
  }

  // ---------- SHA-256（纯 JS，UTF-8） ----------
  function _genPrimes(n) {
    var primes = [];
    for (var c = 2; primes.length < n; c++) {
      var isP = true;
      for (var i = 0; i < primes.length; i++) {
        var p = primes[i];
        if (p * p > c) break;
        if (c % p === 0) { isP = false; break; }
      }
      if (isP) primes.push(c);
    }
    return primes;
  }

  function _fracRoot(base, primes) {
    // floor(2^32 * frac(root(p)))  ->  无符号 32 位
    return primes.map(function (p) {
      var r = Math.pow(p, 1 / base);
      return Math.floor((r - Math.floor(r)) * 4294967296) >>> 0;
    });
  }

  var _H = _fracRoot(2, _genPrimes(8)); // sqrt
  var _K = _fracRoot(3, _genPrimes(64)); // cbrt

  function _rotr(x, n) { return (x >>> n) | (x << (32 - n)); }

  function sha256Hex(str) {
    var bytes = [];
    var enc = new TextEncoder().encode(str);
    for (var i = 0; i < enc.length; i++) bytes.push(enc[i]);

    var bitLen = bytes.length * 8;
    bytes.push(0x80);
    while (bytes.length % 64 !== 56) bytes.push(0);
    var hi = Math.floor(bitLen / 4294967296);
    var lo = bitLen >>> 0;
    for (var j = 3; j >= 0; j--) bytes.push((hi >>> (j * 8)) & 0xff);
    for (var k2 = 3; k2 >= 0; k2--) bytes.push((lo >>> (k2 * 8)) & 0xff);

    var H = _H.slice();
    for (var off = 0; off < bytes.length; off += 64) {
      var w = new Array(64);
      for (var a = 0; a < 16; a++) {
        w[a] = (bytes[off + a * 4] << 24) | (bytes[off + a * 4 + 1] << 16) |
               (bytes[off + a * 4 + 2] << 8) | bytes[off + a * 4 + 3];
      }
      for (var b = 16; b < 64; b++) {
        var s0 = _rotr(w[b - 15], 7) ^ _rotr(w[b - 15], 18) ^ (w[b - 15] >>> 3);
        var s1 = _rotr(w[b - 2], 17) ^ _rotr(w[b - 2], 19) ^ (w[b - 2] >>> 10);
        w[b] = (w[b - 16] + s0 + w[b - 7] + s1) | 0;
      }
      var a0 = H[0], b0 = H[1], c0 = H[2], d0 = H[3], e0 = H[4], f0 = H[5], g0 = H[6], h0 = H[7];
      for (var d = 0; d < 64; d++) {
        var S1 = _rotr(e0, 6) ^ _rotr(e0, 11) ^ _rotr(e0, 25);
        var ch = (e0 & f0) ^ (~e0 & g0);
        var t1 = (h0 + S1 + ch + _K[d] + w[d]) | 0;
        var S0 = _rotr(a0, 2) ^ _rotr(a0, 13) ^ _rotr(a0, 22);
        var maj = (a0 & b0) ^ (a0 & c0) ^ (b0 & c0);
        var t2 = (S0 + maj) | 0;
        h0 = g0; g0 = f0; f0 = e0; e0 = (d0 + t1) | 0;
        d0 = c0; c0 = b0; b0 = a0; a0 = (t1 + t2) | 0;
      }
      H[0] = (H[0] + a0) | 0; H[1] = (H[1] + b0) | 0; H[2] = (H[2] + c0) | 0; H[3] = (H[3] + d0) | 0;
      H[4] = (H[4] + e0) | 0; H[5] = (H[5] + f0) | 0; H[6] = (H[6] + g0) | 0; H[7] = (H[7] + h0) | 0;
    }
    var out = '';
    for (var e = 0; e < 8; e++) out += (H[e] >>> 0).toString(16).padStart(8, '0');
    return out;
  }

  // ---------- 区块与链 ----------
  function buildBlocks(product, stages) {
    var blocks = [{
      index: 0,
      name: '商品上链',
      data: {
        code: product.code,
        name: product.name,
        price: product.price,
        brand: product.brand,
        origin: product.origin
      }
    }];
    stages.forEach(function (s, i) {
      blocks.push({
        index: i + 1,
        name: s.name,
        data: { name: s.name, time: s.time, place: s.place, operator: s.operator, detail: s.detail }
      });
    });
    return blocks;
  }

  function computeChain(product, stages) {
    var blocks = buildBlocks(product, stages);
    var prev = GENESIS_PREV;
    var chain = [];
    blocks.forEach(function (b) {
      var hash = sha256Hex(stableStringify({ index: b.index, name: b.name, data: b.data, prevHash: prev }));
      chain.push({ index: b.index, name: b.name, data: b.data, prevHash: prev, hash: hash });
      prev = hash;
    });
    return chain;
  }

  function verifyChain(product, stages, storedChain) {
    var cur = computeChain(product, stages);
    if (!storedChain || storedChain.length !== cur.length) {
      return { ok: false, reason: '链上存证缺失或不完整', idx: -1 };
    }
    for (var i = 0; i < cur.length; i++) {
      if (cur[i].hash !== storedChain[i].hash) {
        return { ok: false, reason: '第 ' + i + ' 个区块数据被篡改', idx: i };
      }
      if (cur[i].prevHash !== storedChain[i].prevHash) {
        return { ok: false, reason: '第 ' + i + ' 个区块与前链断裂', idx: i };
      }
    }
    return { ok: true, reason: '链上存证一致，正品', idx: -1 };
  }

  return {
    GENESIS_PREV: GENESIS_PREV,
    stableStringify: stableStringify,
    sha256Hex: sha256Hex,
    buildBlocks: buildBlocks,
    computeChain: computeChain,
    verifyChain: verifyChain
  };
});
