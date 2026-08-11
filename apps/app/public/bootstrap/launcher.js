(function bootstrapLauncher() {
  "use strict";

  var CACHE_NAME = "z3cz-bootstrap-shell:v1";
  var APP_READY_EVENT = "z3cz-app-ready";
  var API_BASE = "/api";
  var FETCH_TIMEOUT_MS = 30000;
  var MAX_RETRIES = 3;
  var APP_READY_TIMEOUT_MS = 15000;

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

  function dismissLauncherOverlay() {
    if (launcher) {
      launcher.style.visibility = "hidden";
      launcher.style.pointerEvents = "none";
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

  function waitForAppReady() {
    return new Promise(function (resolve) {
      var settled = false;
      function finish() {
        if (settled) {
          return;
        }
        settled = true;
        window.removeEventListener(APP_READY_EVENT, onReady);
        requestAnimationFrame(function () {
          requestAnimationFrame(resolve);
        });
      }
      function onReady() {
        finish();
      }
      window.addEventListener(APP_READY_EVENT, onReady);
      setTimeout(finish, APP_READY_TIMEOUT_MS);
    });
  }

  function fetchJson(url) {
    return fetch(url, { credentials: "same-origin" }).then(function (response) {
      if (!response.ok) {
        throw new Error("Request failed");
      }
      return response.json();
    });
  }

  function fetchWithTimeout(url, init, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var timer = setTimeout(function () {
        reject(new Error("Request timed out"));
      }, timeoutMs);
      fetch(url, init)
        .then(function (response) {
          clearTimeout(timer);
          resolve(response);
        })
        .catch(function (error) {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  function fetchShellBuffer(url, signal) {
    return fetchWithTimeout(
      url,
      {
        credentials: url.indexOf("http") === 0 ? "omit" : "same-origin",
        cache: "no-store",
        mode: url.indexOf("http") === 0 ? "cors" : "same-origin",
        signal: signal,
      },
      FETCH_TIMEOUT_MS
    ).then(function (response) {
      if (!response.ok) {
        throw new Error("Shell download failed");
      }
      return response.arrayBuffer();
    });
  }

  function digestShellHash(buffer) {
    if (typeof crypto === "undefined" || !crypto.subtle) {
      return Promise.resolve("");
    }
    return crypto.subtle.digest("SHA-256", buffer).then(function (hash) {
      return Array.from(new Uint8Array(hash))
        .map(function (byte) {
          return byte.toString(16).padStart(2, "0");
        })
        .join("")
        .slice(0, 16);
    });
  }

  function verifyShellHash(buffer, expectedHash) {
    if (!expectedHash) {
      return Promise.resolve(buffer);
    }
    return digestShellHash(buffer).then(function (hash) {
      if (hash !== expectedHash) {
        throw new Error("Shell hash mismatch");
      }
      return buffer;
    });
  }

  function resolveShellSources(config) {
    if (config.shellSources && config.shellSources.length > 0) {
      return config.shellSources;
    }
    if (config.shell) {
      return [{ url: config.shell, kind: "origin" }];
    }
    return [];
  }

  function fetchShellFromSources(sources, expectedHash) {
    if (!sources || sources.length === 0) {
      return Promise.reject(new Error("No shell sources configured"));
    }

    if (sources.length === 1) {
      var single = sources[0];
      return fetchShellBuffer(single.url).then(function (buffer) {
        return verifyShellHash(buffer, expectedHash);
      });
    }

    var controllers = sources.map(function () {
      return new AbortController();
    });

    var attempts = sources.map(function (source, index) {
      return fetchShellBuffer(source.url, controllers[index].signal)
        .then(function (buffer) {
          return verifyShellHash(buffer, expectedHash).then(function (verified) {
            controllers.forEach(function (controller, controllerIndex) {
              if (controllerIndex !== index) {
                controller.abort();
              }
            });
            return verified;
          });
        });
    });

    return Promise.any(attempts);
  }

  function fetchShell(url, sources, expectedHash) {
    var resolvedSources =
      sources && sources.length > 0 ? sources : [{ url: url, kind: "origin" }];
    var attempt = 0;

    function run() {
      attempt += 1;
      setStatus(
        attempt > 1 ? "Retrying download…" : "Downloading application…"
      );
      return fetchShellFromSources(resolvedSources, expectedHash).catch(
        function (error) {
          if (attempt >= MAX_RETRIES) {
            throw error;
          }
          return run();
        }
      );
    }

    return run();
  }

  function loadStylesheets(cssFiles, fileBytes) {
    cssFiles.forEach(function (href) {
      var link = document.createElement("link");
      link.rel = "stylesheet";
      if (fileBytes && fileBytes[href]) {
        link.href = URL.createObjectURL(
          new Blob([fileBytes[href]], { type: "text/css" })
        );
      } else {
        link.href = href;
        link.crossOrigin = "anonymous";
      }
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
      if (path.slice(-3) !== ".js") {
        return;
      }
      var blob = new Blob([fileBytes[path]], {
        type: "application/javascript",
      });
      blobUrls[path] = URL.createObjectURL(blob);
    });
    installImportMap(blobUrls);
    loadStylesheets(cssFiles, fileBytes);
    var entryUrl = blobUrls[entry] || entry;
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");
      script.type = "module";
      script.src = entryUrl;
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

  function gunzipBytes(compressed) {
    if (typeof DecompressionStream === "undefined") {
      return Promise.reject(new Error("Gzip decompression unavailable"));
    }
    return new Response(
      new Blob([compressed]).stream().pipeThrough(new DecompressionStream("gzip"))
    ).arrayBuffer();
  }

  function parseShellArchive(raw) {
    var bytes = new Uint8Array(raw);
    if (bytes.byteLength < 4) {
      throw new Error("Invalid shell archive");
    }
    var headerLength =
      (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
    var headerStart = 4;
    var headerEnd = headerStart + headerLength;
    if (headerEnd > bytes.byteLength) {
      throw new Error("Invalid shell header");
    }
    var headerText = new TextDecoder().decode(
      bytes.subarray(headerStart, headerEnd)
    );
    var header = JSON.parse(headerText);
    if (!header || !Array.isArray(header.files)) {
      throw new Error("Invalid shell manifest");
    }

    var fileBytes = {};
    var offset = headerEnd;
    header.files.forEach(function (file) {
      if (
        !file ||
        typeof file.path !== "string" ||
        typeof file.size !== "number"
      ) {
        throw new Error("Invalid shell file entry");
      }
      if (offset + file.size > bytes.byteLength) {
        throw new Error("Shell archive truncated");
      }
      fileBytes[file.path] = bytes.subarray(offset, offset + file.size);
      offset += file.size;
    });

    return {
      entry: typeof header.entry === "string" ? header.entry : "",
      css: Array.isArray(header.css) ? header.css : [],
      fileBytes: fileBytes,
    };
  }

  function readCachedShell(shellUrl) {
    if (typeof caches === "undefined") {
      return Promise.resolve(null);
    }
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.match(shellUrl);
    });
  }

  function writeCachedShell(shellUrl, bytes) {
    if (typeof caches === "undefined") {
      return Promise.resolve();
    }
    return caches.open(CACHE_NAME).then(function (cache) {
      return cache.put(
        shellUrl,
        new Response(bytes, {
          headers: { "Content-Type": "application/gzip" },
        })
      );
    });
  }

  function loadShellBytes(config) {
    var sources = resolveShellSources(config);
    var shellUrl = config.shell || (sources[0] && sources[0].url) || "";
    var expectedHash = config.shellHash || "";

    return readCachedShell(shellUrl).then(function (cached) {
      if (cached) {
        setStatus("Starting from cache…");
        return cached.arrayBuffer();
      }
      return fetchShell(shellUrl, sources, expectedHash).then(function (bytes) {
        return writeCachedShell(shellUrl, bytes).then(function () {
          return bytes;
        });
      });
    });
  }

  function loadViaShell(config) {
    if (!config.shell && resolveShellSources(config).length === 0) {
      return loadViaHttp(config.entry, config.css || []);
    }

    return loadShellBytes(config)
      .then(gunzipBytes)
      .then(parseShellArchive)
      .then(function (archive) {
        var entry = archive.entry || config.entry;
        var css = archive.css.length > 0 ? archive.css : config.css || [];
        return mountFromBytes(archive.fileBytes, entry, css);
      });
  }

  function loadApp(config) {
    return loadViaShell(config).catch(function () {
      return loadViaHttp(config.entry, config.css || []);
    });
  }

  function readInlineBootstrap() {
    var element = document.getElementById("z3cz-bootstrap-inline");
    if (!element || !element.textContent) {
      return null;
    }
    try {
      return JSON.parse(element.textContent);
    } catch (_error) {
      return null;
    }
  }

  function mergeBootstrapConfig(remote, inline) {
    if (!inline) {
      return remote;
    }
    return {
      shell: remote.shell || inline.shell || "",
      shellHash: remote.shellHash || inline.shellHash || "",
      entry: remote.entry || inline.entry || "",
      css: remote.css && remote.css.length > 0 ? remote.css : inline.css || [],
      manifestVersion:
        remote.manifestVersion || inline.manifestVersion || inline.shellHash || "",
      shellSources:
        remote.shellSources && remote.shellSources.length > 0
          ? remote.shellSources
          : inline.shell
            ? [{ url: inline.shell, kind: "origin" }]
            : [],
    };
  }

  function finishBootstrap() {
    dismissLauncherOverlay();
    return waitForAppReady().then(function () {
      teardownLauncher();
    });
  }

  function start() {
    clearError();
    setStatus("Loading…");

    fetchJson(API_BASE + "/bootstrap/config")
      .then(function (remote) {
        var config = mergeBootstrapConfig(remote, readInlineBootstrap());
        if (!config || !config.entry) {
          throw new Error("Bootstrap config unavailable");
        }
        return loadApp(config);
      })
      .then(finishBootstrap)
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
