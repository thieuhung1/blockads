(() => {
  const root = globalThis.__NETSHIELD_CONTENT__ || (globalThis.__NETSHIELD_CONTENT__ = {});
  const config = root.config;
  const logger = root.logger;
  const cleanupHandlers = [];
  let protectionActive = false;

  root.modules = root.modules || {};
  root.modules.privacyShield = { init: initPrivacyShield, configure: configurePrivacyShield };

  function configurePrivacyShield(enabled) {
    if (enabled) {
      initPrivacyShield();
      return;
    }

    while (cleanupHandlers.length) {
      const cleanup = cleanupHandlers.pop();
      try {
        cleanup();
      } catch (error) {
        logger.debug('Could not restore a privacy API after disabling protection.', error);
      }
    }
    protectionActive = false;
  }

  function initPrivacyShield() {
    if (protectionActive) return;
    protectionActive = true;

    try {
      overrideProperty(navigator, 'doNotTrack', { get: () => '1', configurable: true });
      overrideProperty(navigator, 'globalPrivacyControl', { get: () => true, configurable: true });
    } catch (error) {
      logger.debug('Could not set privacy signal properties.', error);
    }

    protectClipboard();
    protectCanvas();
    hideBatteryApi();
    protectWebRTCListeners();
  }

  function overrideProperty(target, property, descriptor) {
    const previous = Object.getOwnPropertyDescriptor(target, property);
    const replacement = {
      ...(previous || { configurable: true, enumerable: false }),
      ...descriptor
    };
    if ('value' in descriptor) {
      delete replacement.get;
      delete replacement.set;
    } else if ('get' in descriptor || 'set' in descriptor) {
      delete replacement.value;
      delete replacement.writable;
    }
    Object.defineProperty(target, property, replacement);
    cleanupHandlers.push(() => {
      if (previous) Object.defineProperty(target, property, previous);
      else delete target[property];
    });
  }

  function protectClipboard() {
    const clipboard = navigator.clipboard;
    if (!clipboard || typeof clipboard.readText !== 'function') return;

    const nativeReadText = clipboard.readText;
    try {
      overrideProperty(clipboard, 'readText', { value: function (...args) {
        if (navigator.userActivation && navigator.userActivation.isActive) {
          return Reflect.apply(nativeReadText, clipboard, args);
        }

        logger.debug('Blocked clipboard read without active user activation.');
        return Promise.reject(new DOMException(
          'Bị từ chối bởi NetShield Privacy Shield',
          'NotAllowedError'
        ));
      }, configurable: true, writable: true });
    } catch (error) {
      logger.debug('Could not wrap clipboard.readText.', error);
    }
  }

  function protectCanvas() {
    const canvasPrototype = globalThis.HTMLCanvasElement && HTMLCanvasElement.prototype;
    const contextPrototype = globalThis.CanvasRenderingContext2D && CanvasRenderingContext2D.prototype;
    if (!canvasPrototype || !contextPrototype) return;

    const seeds = new WeakMap();
    const nativeToDataURL = canvasPrototype.toDataURL;
    const nativeToBlob = canvasPrototype.toBlob;
    const nativeGetImageData = contextPrototype.getImageData;

    function isProtectedCanvas(canvas) {
      return canvas && canvas.width > 0 && canvas.height > 0 &&
        canvas.width <= config.canvas.maximumWidth &&
        canvas.height <= config.canvas.maximumHeight;
    }

    function getNoisePoints(canvas) {
      let points = seeds.get(canvas);
      if (points) return points;

      const seed = Math.random();
      points = Array.from({ length: config.canvas.noisePixelCount }, (_, index) => {
        const xFraction = (seed + (index + 1) * 0.61803398875) % 1;
        const yFraction = (seed * 1.41421356237 + (index + 1) * 0.73205080757) % 1;
        return {
          x: Math.floor(xFraction * canvas.width),
          y: Math.floor(yFraction * canvas.height),
          channel: (Math.floor(seed * 3) + index) % 3,
          delta: ((seed + index) % 1) < 0.5 ? 1 : 255
        };
      });
      seeds.set(canvas, points);
      return points;
    }

    function changePixel(pixel, channel, delta) {
      pixel.data[channel] = (pixel.data[channel] + delta) % 256;
      return pixel;
    }

    function addNoiseToCanvasCopy(canvas) {
      if (!isProtectedCanvas(canvas)) return null;

      const copy = document.createElement('canvas');
      copy.width = canvas.width;
      copy.height = canvas.height;
      const context = copy.getContext('2d');
      if (!context) return null;

      context.drawImage(canvas, 0, 0);
      for (const point of getNoisePoints(canvas)) {
        const pixel = Reflect.apply(nativeGetImageData, context, [point.x, point.y, 1, 1]);
        context.putImageData(changePixel(pixel, point.channel, point.delta), point.x, point.y);
      }
      return copy;
    }

    try {
      overrideProperty(canvasPrototype, 'toDataURL', { value: function (type, ...args) {
        try {
          const copy = addNoiseToCanvasCopy(this);
          if (copy) return Reflect.apply(nativeToDataURL, copy, [type, ...args]);
        } catch (error) {
          logger.debug('Canvas toDataURL noise was skipped.', error);
        }
        return Reflect.apply(nativeToDataURL, this, [type, ...args]);
      }, configurable: true, writable: true });
    } catch (error) {
      logger.debug('Could not wrap canvas.toDataURL.', error);
    }

    if (typeof nativeToBlob === 'function') {
      try {
        overrideProperty(canvasPrototype, 'toBlob', { value: function (callback, type, quality) {
          try {
            const copy = addNoiseToCanvasCopy(this);
            if (copy) return Reflect.apply(nativeToBlob, copy, [callback, type, quality]);
          } catch (error) {
            logger.debug('Canvas toBlob noise was skipped.', error);
          }
          return Reflect.apply(nativeToBlob, this, [callback, type, quality]);
        }, configurable: true, writable: true });
      } catch (error) {
        logger.debug('Could not wrap canvas.toBlob.', error);
      }
    }

    try {
      overrideProperty(contextPrototype, 'getImageData', { value: function (...args) {
        const imageData = Reflect.apply(nativeGetImageData, this, args);
        const canvas = this.canvas;
        if (!isProtectedCanvas(canvas)) return imageData;

        const [sourceX = 0, sourceY = 0] = args;
        for (const point of getNoisePoints(canvas)) {
          const localX = point.x - sourceX;
          const localY = point.y - sourceY;
          if (localX < 0 || localY < 0 || localX >= imageData.width || localY >= imageData.height) continue;
          const offset = (localY * imageData.width + localX) * 4;
          imageData.data[offset + point.channel] = (imageData.data[offset + point.channel] + point.delta) % 256;
        }
        return imageData;
      }, configurable: true, writable: true });
    } catch (error) {
      logger.debug('Could not wrap canvas getImageData.', error);
    }
  }

  function hideBatteryApi() {
    if (!('getBattery' in navigator)) return;
    try {
      overrideProperty(navigator, 'getBattery', { value: undefined, configurable: true, writable: true });
    } catch (error) {
      logger.debug('Could not hide navigator.getBattery.', error);
    }
  }

  function protectWebRTCListeners() {
    const PeerConnection = globalThis.RTCPeerConnection;
    if (!PeerConnection || !PeerConnection.prototype) return;

    const prototype = PeerConnection.prototype;
    const nativeAdd = prototype.addEventListener;
    const nativeRemove = prototype.removeEventListener;
    const registrations = new WeakMap();

    function shouldSuppressCandidate(event) {
      const candidate = event && event.candidate && event.candidate.candidate;
      return typeof candidate === 'string' && /\btyp\s+(?:host|srflx)\b/i.test(candidate);
    }

    function createListenerProxy(listener) {
      if (typeof listener === 'function') {
        return new Proxy(listener, {
          apply(target, thisArg, args) {
            if (shouldSuppressCandidate(args[0])) return undefined;
            return Reflect.apply(target, thisArg, args);
          }
        });
      }

      if (listener && typeof listener === 'object') {
        const methodProxies = new WeakMap();
        return new Proxy(listener, {
          get(target, property, receiver) {
            const method = Reflect.get(target, property, receiver);
            if (property !== 'handleEvent' || typeof method !== 'function') return method;

            let proxy = methodProxies.get(method);
            if (!proxy) {
              proxy = new Proxy(method, {
                apply(callback, _thisArg, args) {
                  if (shouldSuppressCandidate(args[0])) return undefined;
                  return Reflect.apply(callback, listener, args);
                }
              });
              methodProxies.set(method, proxy);
            }
            return proxy;
          }
        });
      }

      return listener;
    }

    function captureValue(options) {
      return typeof options === 'boolean' ? options : Boolean(options && options.capture);
    }

    function getListenerMap(peer, eventType, capture, create) {
      let byRegistration = registrations.get(peer);
      if (!byRegistration && create) {
        byRegistration = new Map();
        registrations.set(peer, byRegistration);
      }
      if (!byRegistration) return null;

      const key = `${eventType}:${capture}`;
      let listenerMap = byRegistration.get(key);
      if (!listenerMap && create) {
        listenerMap = new WeakMap();
        byRegistration.set(key, listenerMap);
      }
      return listenerMap || null;
    }

    const cleanupStart = cleanupHandlers.length;
    try {
      overrideProperty(prototype, 'addEventListener', { value: function (type, listener, options) {
        if (type !== 'icecandidate' || !listener || (typeof listener !== 'function' && typeof listener !== 'object')) {
          return Reflect.apply(nativeAdd, this, [type, listener, options]);
        }

        const capture = captureValue(options);
        const listenerMap = getListenerMap(this, type, capture, true);
        let proxy = listenerMap.get(listener);
        if (!proxy) {
          proxy = createListenerProxy(listener);
          listenerMap.set(listener, proxy);
        }
        return Reflect.apply(nativeAdd, this, [type, proxy, options]);
      }, configurable: true, writable: true });

      overrideProperty(prototype, 'removeEventListener', { value: function (type, listener, options) {
        if (type !== 'icecandidate' || !listener || (typeof listener !== 'function' && typeof listener !== 'object')) {
          return Reflect.apply(nativeRemove, this, [type, listener, options]);
        }

        const capture = captureValue(options);
        const listenerMap = getListenerMap(this, type, capture, false);
        const proxy = listenerMap && listenerMap.get(listener);
        const result = Reflect.apply(nativeRemove, this, [type, proxy || listener, options]);
        if (proxy && listenerMap) listenerMap.delete(listener);
        return result;
      }, configurable: true, writable: true });
    } catch (error) {
      while (cleanupHandlers.length > cleanupStart) {
        const cleanup = cleanupHandlers.pop();
        try {
          cleanup();
        } catch (restoreError) {
          logger.debug('Could not restore a partial WebRTC listener hook.', restoreError);
        }
      }
      logger.debug('Could not wrap WebRTC event listeners.', error);
    }
  }
})();
