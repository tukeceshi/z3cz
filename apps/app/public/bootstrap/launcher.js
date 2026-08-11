(function bootstrapLauncher() {
  "use strict";

  var CACHE_PREFIX = "z3cz-bootstrap:v1:";
  var API_BASE = "/api";

  var launcher = document.getElementById("z3cz-launcher");
  var statusEl = document.getElementById("z3cz-launcher-status");
  var errorEl = document.getElementById("z3cz-launcher-error");
  var retryBtn = document.getElementById("z3cz-launcher-retry");

  function setStatus(text) {
    if (statusEl) {
      statusEl.textContent = text;
    }
  }

  function showError(message) {
    if (errorEl) {
      errorEl.hidden = false;
      errorEl.textContent = message;
    }
    if (retryBtn) {
      retryBtn.hidden = false;
    }
  }

  function clearError() {
    if (errorEl) {
      errorEl.hidden = true;
      errorEl.textContent = "";
    }
    if (retryBtn) {
      retryBtn.hidden = true;
    }
  }

  function teardownLauncher() {
    var script = document.querySelector('script[src="/bootstrap/launcher.js"]');
    if (script && script.parentNode) {
      script.parentNode.removeChild(script);
    }
    if (launcher && launcher.parentNode) {
      launcher.parentNode.removeChild(launcher);
    }
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Request failed");
      }
      return response.json();
    });
  }

  function loadStylesheets(cssFiles) {
    cssFiles.forEach(function (href) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      link.crossOrigin = "anonymous";
      document.head.appendChild(link);
    });
  }

  function loadViaHttp(entry, cssFiles) {
    loadStylesheets(cssFiles);
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.type = "module";
      script.src = entry;
      script.crossOrigin = "anonymous";
      script.onload = function () {
        resolve();
      };
      script.onerror = function () {
        reject(new Error("Failed to load application"));
      };
      document.body.appendChild(script);
    });
  }

  function bytesToBase64(bytes) {
    var chunkSize = 0x8000;
    var binary = "";
    for (var index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode.apply(
        null,
        bytes.subarray(index, index + chunkSize)
      );
    }
    return btoa(binary);
  }

  function base64ToBytes(base64) {
    var binary = atob(base64);
    var bytes = new Uint8Array(binary.length);
    for (var index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  function readCache(cacheKey) {
    try {
      var raw = sessionStorage.getItem(cacheKey);
      if (!raw) {
        return null;
      }
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || !parsed.files) {
        return null;
      }
      return parsed.files;
    } catch (_error) {
      return null;
    }
  }

  function writeCache(cacheKey, files) {
    sessionStorage.setItem(cacheKey, JSON.stringify({ files: files }));
  }

  function installImportMap(blobUrls) {
    var imports = {};
    Object.keys(blobUrls).forEach(function (path) {
      imports[path] = blobUrls[path];
    });
    var script = document.createElement("script");
    script.type = "importmap";
    script.textContent = JSON.stringify({ imports: imports });
    document.head.appendChild(script);
  }

  function mountFromBytes(fileBytes, entry, cssFiles) {
    var blobUrls = {};
    Object.keys(fileBytes).forEach(function (path) {
      var blob = new Blob([fileBytes[path]], {
        type: "application/javascript",
      });
      blobUrls[path] = URL.createObjectURL(blob);
    });
    installImportMap(blobUrls);
    loadStylesheets(cssFiles);
    return import(entry).then(function () {
      Object.keys(blobUrls).forEach(function (path) {
        URL.revokeObjectURL(blobUrls[path]);
      });
    });
  }

  function getWebSocketBaseUrl() {
    var cfg = window.__Z3CZ_WS__ || {};
    var viaProxy = cfg.viaProxy === true;
    var wsHost = typeof cfg.wsHost === "string" ? cfg.wsHost : "";
    var apiBase =
      typeof cfg.apiBase === "string" && cfg.apiBase.length > 0
        ? cfg.apiBase
        : API_BASE;

    if (!viaProxy && wsHost.length > 0) {
      return wsHost.replace(/\/$/, "");
    }

    if (apiBase.indexOf("http://") === 0 || apiBase.indexOf("https://") === 0) {
      return apiBase.replace(/^http/, "ws").replace(/\/$/, "");
    }

    // Vite /api proxy cannot upgrade @hono/node-ws; connect to API directly in dev.
    if (!viaProxy && apiBase.charAt(0) === "/") {
      return "ws://localhost:3102";
    }

    var origin = location.origin.replace(/^http/, "ws");
    return origin + apiBase.replace(/\/$/, "");
  }

  function wsUrl() {
    return getWebSocketBaseUrl() + "/bootstrap/ws";
  }

  function fetchAllOverWs(files) {
    return new Promise(function (resolve, reject) {
      var socket = new WebSocket(wsUrl());
      var transfers = {};
      var completed = 0;

      files.forEach(function (file, index) {
        transfers[index + 1] = {
          path: file.path,
          chunks: [],
          receivedSize: 0,
          expectedSize: file.size || 0,
          done: false,
        };
      });

      function updateProgress() {
        var totalExpected = 0;
        var totalReceived = 0;
        files.forEach(function (_file, index) {
          var transfer = transfers[index + 1];
          totalExpected += transfer.expectedSize;
          totalReceived += transfer.receivedSize;
        });
        if (totalExpected > 0) {
          setStatus(
            "Downloading " +
              completed +
              "/" +
              files.length +
              " · " +
              Math.min(100, Math.round((totalReceived / totalExpected) * 100)) +
              "%"
          );
        } else {
          setStatus("Downloading " + completed + "/" + files.length);
        }
      }

      function maybeFinish() {
        if (completed < files.length) {
          return;
        }
        socket.close();
        var fileBytes = {};
        files.forEach(function (_file, index) {
          var transfer = transfers[index + 1];
          var merged = new Uint8Array(transfer.receivedSize);
          var offset = 0;
          transfer.chunks.forEach(function (chunk) {
            merged.set(chunk, offset);
            offset += chunk.length;
          });
          fileBytes[transfer.path] = merged;
        });
        resolve(fileBytes);
      }

      socket.onopen = function () {
        files.forEach(function (file, index) {
          socket.send(
            JSON.stringify({ op: "fetch", id: index + 1, path: file.path })
          );
        });
      };

      socket.onmessage = function (event) {
        if (typeof event.data === "string") {
          var message = JSON.parse(event.data);
          var transfer = transfers[message.id];
          if (!transfer) {
            return;
          }
          if (message.op === "begin") {
            transfer.expectedSize = message.size || transfer.expectedSize;
            updateProgress();
            return;
          }
          if (message.op === "done") {
            transfer.done = true;
            completed += 1;
            updateProgress();
            maybeFinish();
            return;
          }
          if (message.op === "error") {
            reject(new Error(message.message || "WebSocket download failed"));
          }
          return;
        }

        var buffer = new Uint8Array(event.data);
        if (buffer.byteLength < 4) {
          return;
        }
        var frameId =
          (buffer[0] << 24) |
          (buffer[1] << 16) |
          (buffer[2] << 8) |
          buffer[3];
        var transfer = transfers[frameId];
        if (!transfer) {
          return;
        }
        var payload = buffer.subarray(4);
        transfer.chunks.push(payload);
        transfer.receivedSize += payload.byteLength;
        updateProgress();
      };

      socket.onerror = function () {
        reject(new Error("WebSocket connection failed"));
      };

      socket.onclose = function () {
        if (completed < files.length) {
          reject(new Error("WebSocket closed"));
        }
      };
    });
  }

  function loadViaWs(config) {
    var cacheKey = CACHE_PREFIX + config.manifestVersion;
    var cached = readCache(cacheKey);
    if (cached) {
      setStatus("Starting from cache…");
      var cachedBytes = {};
      Object.keys(cached).forEach(function (path) {
        cachedBytes[path] = base64ToBytes(cached[path]);
      });
      return mountFromBytes(cachedBytes, config.entry, config.css);
    }

    setStatus("Connecting…");
    return fetchAllOverWs(config.files).then(function (fileBytes) {
      var encoded = {};
      Object.keys(fileBytes).forEach(function (path) {
        encoded[path] = bytesToBase64(fileBytes[path]);
      });
      writeCache(cacheKey, encoded);
      return mountFromBytes(fileBytes, config.entry, config.css);
    });
  }

  function start() {
    clearError();
    setStatus("Loading…");

    fetchJson(API_BASE + "/bootstrap/config")
      .then(function (config) {
        if (!config || !config.entry) {
          throw new Error("Bootstrap config unavailable");
        }

        if (!config.enabled) {
          return loadViaHttp(config.entry, config.css || []);
        }

        return loadViaWs(config);
      })
      .then(function () {
        teardownLauncher();
      })
      .catch(function (error) {
        setStatus("Unable to load");
        showError(error && error.message ? error.message : "Load failed");
      });
  }

  if (retryBtn) {
    retryBtn.addEventListener("click", start);
  }

  start();
})();
