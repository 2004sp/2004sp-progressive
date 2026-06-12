// src/3rdparty/audio.js
(function() {
  window.AudioContext = window.AudioContext || window.webkitAudioContext;
  if (window.AudioContext) {
    window.audioContext = new window.AudioContext({ sampleRate: 22050 });
    window.__wsdbg?.("audio: AudioContext created, state=" + window.audioContext.state + " sampleRate=" + window.audioContext.sampleRate);
  } else {
    window.__wsdbg?.("audio: AudioContext NOT available");
  }
  var _sessionFixed = false;
  function unlockAudio() {
    if (!window.audioContext)
      return;
    var stateBefore = window.audioContext.state;
    if (!_sessionFixed) {
      _sessionFixed = true;
      try {
        var sr = 22050, ns = 100, ds = ns * 2;
        var ab = new ArrayBuffer(44 + ds);
        var dv = new DataView(ab);
        var ws = function(pos, s) {
          for (var i = 0;i < s.length; i++)
            dv.setUint8(pos + i, s.charCodeAt(i));
        };
        ws(0, "RIFF");
        dv.setUint32(4, 36 + ds, true);
        ws(8, "WAVE");
        ws(12, "fmt ");
        dv.setUint32(16, 16, true);
        dv.setUint16(20, 1, true);
        dv.setUint16(22, 1, true);
        dv.setUint32(24, sr, true);
        dv.setUint32(28, sr * 2, true);
        dv.setUint16(32, 2, true);
        dv.setUint16(34, 16, true);
        ws(36, "data");
        dv.setUint32(40, ds, true);
        var blob = new Blob([ab], { type: "audio/wav" });
        var url = URL.createObjectURL(blob);
        window._silentAudioEl = new Audio(url);
        window._silentAudioEl.setAttribute("playsinline", "");
        window._silentAudioEl.loop = true;
        window._silentAudioEl.volume = 0.001;
        window._silentAudioEl.play().catch(function(e) {
          window.__wsdbg?.("audio: silent <audio>.play() failed: " + e);
        });
        window.__wsdbg?.("audio: silent looping <audio> started for iOS session fix");
      } catch (e) {
        window.__wsdbg?.("audio: session fix failed: " + e);
      }
    }
    try {
      var buf = window.audioContext.createBuffer(1, 1, 22050);
      var src = window.audioContext.createBufferSource();
      src.buffer = buf;
      src.connect(window.audioContext.destination);
      src.start(0);
    } catch (e) {
      window.__wsdbg?.("audio: silent buffer play threw: " + e);
    }
    if (window.audioContext.state !== "running") {
      window.audioContext.resume().catch(function(e) {
        window.__wsdbg?.("audio: resume() rejected: " + e);
      });
    }
    window.__wsdbg?.("audio: unlockAudio state " + stateBefore + " -> " + window.audioContext.state);
  }
  ["touchstart", "touchend", "click"].forEach(function(ev) {
    document.addEventListener(ev, unlockAudio, { passive: true });
  });
  window.audioContext.addEventListener("statechange", function() {
    window.__wsdbg?.("audio: statechange -> " + window.audioContext.state);
  });
  document.addEventListener("visibilitychange", function() {
    if (!document.hidden && window.audioContext) {
      window.audioContext.resume().catch(function() {});
    }
  });
})();
var waveGain;
async function playWave(data) {
  if (!window.audioContext)
    return;
  if (!waveGain) {
    waveGain = window.audioContext.createGain();
    waveGain.connect(window.audioContext.destination);
  }
  if (window.audioContext.state !== "running") {
    await window.audioContext.resume().catch(function() {});
  }
  try {
    const audioBuffer = await window.audioContext.decodeAudioData(new Uint8Array(data).buffer);
    let bufferSource = window.audioContext.createBufferSource();
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(waveGain);
    bufferSource.start();
  } catch (e) {
    console.error(e);
  }
}
function setWaveVolume(dB) {
  if (!window.audioContext)
    return;
  if (!waveGain) {
    waveGain = window.audioContext.createGain();
    waveGain.connect(window.audioContext.destination);
  }
  waveGain.gain.value = Math.pow(10, dB / 20);
}

// src/3rdparty/tinymidipcm/tinymidipcm.mjs
async function loadTinyMidiPCM(moduleArg = {}) {
  var moduleRtn;
  var Module = moduleArg;
  var ENVIRONMENT_IS_WEB = true;
  var ENVIRONMENT_IS_WORKER = false;
  var ENVIRONMENT_IS_NODE = false;
  var ENVIRONMENT_IS_SHELL = false;
  var arguments_ = [];
  var thisProgram = "./this.program";
  var quit_ = (status, toThrow) => {
    throw toThrow;
  };
  var _scriptName = import.meta.url;
  var scriptDirectory = "";
  function locateFile(path) {
    if (Module["locateFile"]) {
      return Module["locateFile"](path, scriptDirectory);
    }
    return scriptDirectory + path;
  }
  var readAsync, readBinary;
  if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    try {
      scriptDirectory = new URL(".", _scriptName).href;
    } catch {}
    {
      readAsync = async (url) => {
        var response = await fetch(url, { credentials: "same-origin" });
        if (response.ok) {
          return response.arrayBuffer();
        }
        throw new Error(response.status + " : " + response.url);
      };
    }
  } else {}
  var out = console.log.bind(console);
  var err = console.error.bind(console);
  var wasmBinary;
  var ABORT = false;
  var EXITSTATUS;
  function assert(condition, text) {
    if (!condition) {
      abort(text);
    }
  }
  var isFileURI = (filename) => filename.startsWith("file://");
  var readyPromiseResolve, readyPromiseReject;
  var HEAP8, HEAPU8, HEAP16, HEAPU16, HEAP32, HEAPU32, HEAPF32, HEAPF64;
  var HEAP64, HEAPU64;
  var runtimeInitialized = false;
  function updateMemoryViews() {
    var b = wasmMemory.buffer;
    HEAP8 = new Int8Array(b);
    HEAP16 = new Int16Array(b);
    Module["HEAPU8"] = HEAPU8 = new Uint8Array(b);
    HEAPU16 = new Uint16Array(b);
    HEAP32 = new Int32Array(b);
    HEAPU32 = new Uint32Array(b);
    HEAPF32 = new Float32Array(b);
    HEAPF64 = new Float64Array(b);
    HEAP64 = new BigInt64Array(b);
    HEAPU64 = new BigUint64Array(b);
  }
  function preRun() {
    if (Module["preRun"]) {
      if (typeof Module["preRun"] == "function")
        Module["preRun"] = [Module["preRun"]];
      while (Module["preRun"].length) {
        addOnPreRun(Module["preRun"].shift());
      }
    }
    callRuntimeCallbacks(onPreRuns);
  }
  function initRuntime() {
    runtimeInitialized = true;
    wasmExports["__wasm_call_ctors"]();
  }
  function postRun() {
    if (Module["postRun"]) {
      if (typeof Module["postRun"] == "function")
        Module["postRun"] = [Module["postRun"]];
      while (Module["postRun"].length) {
        addOnPostRun(Module["postRun"].shift());
      }
    }
    callRuntimeCallbacks(onPostRuns);
  }
  function abort(what) {
    Module["onAbort"]?.(what);
    what = "Aborted(" + what + ")";
    err(what);
    ABORT = true;
    what += ". Build with -sASSERTIONS for more info.";
    var e = new WebAssembly.RuntimeError(what);
    readyPromiseReject?.(e);
    throw e;
  }
  var wasmBinaryFile;
  function findWasmBinary() {
    if (Module["locateFile"]) {
      return locateFile("tinymidipcm.wasm");
    }
    return new URL("tinymidipcm.wasm", import.meta.url).href;
  }
  function getBinarySync(file) {
    if (file == wasmBinaryFile && wasmBinary) {
      return new Uint8Array(wasmBinary);
    }
    if (readBinary) {
      return readBinary(file);
    }
    throw "both async and sync fetching of the wasm failed";
  }
  async function getWasmBinary(binaryFile) {
    if (!wasmBinary) {
      try {
        var response = await readAsync(binaryFile);
        return new Uint8Array(response);
      } catch {}
    }
    return getBinarySync(binaryFile);
  }
  async function instantiateArrayBuffer(binaryFile, imports) {
    try {
      var binary = await getWasmBinary(binaryFile);
      var instance = await WebAssembly.instantiate(binary, imports);
      return instance;
    } catch (reason) {
      err(`failed to asynchronously prepare wasm: ${reason}`);
      abort(reason);
    }
  }
  async function instantiateAsync(binary, binaryFile, imports) {
    if (!binary) {
      try {
        var response = fetch(binaryFile, { credentials: "same-origin" });
        var instantiationResult = await WebAssembly.instantiateStreaming(response, imports);
        return instantiationResult;
      } catch (reason) {
        err(`wasm streaming compile failed: ${reason}`);
        err("falling back to ArrayBuffer instantiation");
      }
    }
    return instantiateArrayBuffer(binaryFile, imports);
  }
  function getWasmImports() {
    var imports = {
      env: wasmImports,
      wasi_snapshot_preview1: wasmImports
    };
    return imports;
  }
  async function createWasm() {
    function receiveInstance(instance, module) {
      wasmExports = instance.exports;
      assignWasmExports(wasmExports);
      updateMemoryViews();
      return wasmExports;
    }
    function receiveInstantiationResult(result2) {
      return receiveInstance(result2["instance"]);
    }
    var info = getWasmImports();
    if (Module["instantiateWasm"]) {
      return new Promise((resolve, reject) => {
        Module["instantiateWasm"](info, (inst, mod) => {
          resolve(receiveInstance(inst, mod));
        });
      });
    }
    wasmBinaryFile ??= findWasmBinary();
    var result = await instantiateAsync(wasmBinary, wasmBinaryFile, info);
    var exports = receiveInstantiationResult(result);
    return exports;
  }

  class ExitStatus {
    name = "ExitStatus";
    constructor(status) {
      this.message = `Program terminated with exit(${status})`;
      this.status = status;
    }
  }
  var callRuntimeCallbacks = (callbacks) => {
    while (callbacks.length > 0) {
      callbacks.shift()(Module);
    }
  };
  var onPostRuns = [];
  var addOnPostRun = (cb) => onPostRuns.push(cb);
  var onPreRuns = [];
  var addOnPreRun = (cb) => onPreRuns.push(cb);
  function getValue(ptr, type = "i8") {
    if (type.endsWith("*"))
      type = "*";
    switch (type) {
      case "i1":
        return HEAP8[ptr];
      case "i8":
        return HEAP8[ptr];
      case "i16":
        return HEAP16[ptr >> 1];
      case "i32":
        return HEAP32[ptr >> 2];
      case "i64":
        return HEAP64[ptr >> 3];
      case "float":
        return HEAPF32[ptr >> 2];
      case "double":
        return HEAPF64[ptr >> 3];
      case "*":
        return HEAPU32[ptr >> 2];
      default:
        abort(`invalid type for getValue: ${type}`);
    }
  }
  var noExitRuntime = true;
  function setValue(ptr, value, type = "i8") {
    if (type.endsWith("*"))
      type = "*";
    switch (type) {
      case "i1":
        HEAP8[ptr] = value;
        break;
      case "i8":
        HEAP8[ptr] = value;
        break;
      case "i16":
        HEAP16[ptr >> 1] = value;
        break;
      case "i32":
        HEAP32[ptr >> 2] = value;
        break;
      case "i64":
        HEAP64[ptr >> 3] = BigInt(value);
        break;
      case "float":
        HEAPF32[ptr >> 2] = value;
        break;
      case "double":
        HEAPF64[ptr >> 3] = value;
        break;
      case "*":
        HEAPU32[ptr >> 2] = value;
        break;
      default:
        abort(`invalid type for setValue: ${type}`);
    }
  }
  var stackRestore = (val) => __emscripten_stack_restore(val);
  var stackSave = () => _emscripten_stack_get_current();
  var getHeapMax = () => 2147483648;
  var alignMemory = (size, alignment) => {
    return Math.ceil(size / alignment) * alignment;
  };
  var growMemory = (size) => {
    var oldHeapSize = wasmMemory.buffer.byteLength;
    var pages = (size - oldHeapSize + 65535) / 65536 | 0;
    try {
      wasmMemory.grow(pages);
      updateMemoryViews();
      return 1;
    } catch (e) {}
  };
  var _emscripten_resize_heap = (requestedSize) => {
    var oldSize = HEAPU8.length;
    requestedSize >>>= 0;
    var maxHeapSize = getHeapMax();
    if (requestedSize > maxHeapSize) {
      return false;
    }
    for (var cutDown = 1;cutDown <= 4; cutDown *= 2) {
      var overGrownHeapSize = oldSize * (1 + 0.2 / cutDown);
      overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
      var newSize = Math.min(maxHeapSize, alignMemory(Math.max(requestedSize, overGrownHeapSize), 65536));
      var replacement = growMemory(newSize);
      if (replacement) {
        return true;
      }
    }
    return false;
  };
  {
    if (Module["noExitRuntime"])
      noExitRuntime = Module["noExitRuntime"];
    if (Module["print"])
      out = Module["print"];
    if (Module["printErr"])
      err = Module["printErr"];
    if (Module["wasmBinary"])
      wasmBinary = Module["wasmBinary"];
    if (Module["arguments"])
      arguments_ = Module["arguments"];
    if (Module["thisProgram"])
      thisProgram = Module["thisProgram"];
    if (Module["preInit"]) {
      if (typeof Module["preInit"] == "function")
        Module["preInit"] = [Module["preInit"]];
      while (Module["preInit"].length > 0) {
        Module["preInit"].shift()();
      }
    }
  }
  Module["setValue"] = setValue;
  Module["getValue"] = getValue;
  var _malloc, _free, _tsf_load_memory, _tsf_close, _tsf_reset, _tsf_set_output, _realloc, _tsf_channel_set_bank_preset, _tml_load_memory, _midi_render, __emscripten_stack_restore, __emscripten_stack_alloc, _emscripten_stack_get_current, memory, __indirect_function_table, wasmMemory;
  function assignWasmExports(wasmExports2) {
    _malloc = Module["_malloc"] = wasmExports2["malloc"];
    _free = Module["_free"] = wasmExports2["free"];
    _tsf_load_memory = Module["_tsf_load_memory"] = wasmExports2["tsf_load_memory"];
    _tsf_close = Module["_tsf_close"] = wasmExports2["tsf_close"];
    _tsf_reset = Module["_tsf_reset"] = wasmExports2["tsf_reset"];
    _tsf_set_output = Module["_tsf_set_output"] = wasmExports2["tsf_set_output"];
    _realloc = Module["_realloc"] = wasmExports2["realloc"];
    _tsf_channel_set_bank_preset = Module["_tsf_channel_set_bank_preset"] = wasmExports2["tsf_channel_set_bank_preset"];
    _tml_load_memory = Module["_tml_load_memory"] = wasmExports2["tml_load_memory"];
    _midi_render = Module["_midi_render"] = wasmExports2["midi_render"];
    __emscripten_stack_restore = wasmExports2["_emscripten_stack_restore"];
    __emscripten_stack_alloc = wasmExports2["_emscripten_stack_alloc"];
    _emscripten_stack_get_current = wasmExports2["emscripten_stack_get_current"];
    memory = wasmMemory = wasmExports2["memory"];
    __indirect_function_table = wasmExports2["__indirect_function_table"];
  }
  var wasmImports = {
    emscripten_resize_heap: _emscripten_resize_heap
  };
  function run() {
    preRun();
    function doRun() {
      Module["calledRun"] = true;
      if (ABORT)
        return;
      initRuntime();
      readyPromiseResolve?.(Module);
      Module["onRuntimeInitialized"]?.();
      postRun();
    }
    if (Module["setStatus"]) {
      Module["setStatus"]("Running...");
      setTimeout(() => {
        setTimeout(() => Module["setStatus"](""), 1);
        doRun();
      }, 1);
    } else {
      doRun();
    }
  }
  var wasmExports;
  wasmExports = await createWasm();
  run();
  if (runtimeInitialized) {
    moduleRtn = Module;
  } else {
    moduleRtn = new Promise((resolve, reject) => {
      readyPromiseResolve = resolve;
      readyPromiseReject = reject;
    });
  }
  return moduleRtn;
}
var tinymidipcm_default = loadTinyMidiPCM;

// src/3rdparty/tinymidipcm.js
class TinyMidiPCM {
  constructor(options = {}) {
    this.wasmModule = undefined;
    this.soundfontBufferPtr = 0;
    this.soundfontPtr = 0;
    this.midiBufferPtr = 0;
    this.renderInterval = options.renderInterval || 100;
    this.sampleRate = options.sampleRate || 44100;
    this.channels = options.channels || 2;
    this.gain = options.gain || 0;
    if (!options.bufferSize) {
      this.setBufferDuration(1);
    } else {
      this.bufferSize = options.bufferSize;
    }
    this.onPCMData = options.onPCMData || (() => {});
    this.onRenderEnd = options.onRenderEnd || (() => {});
    this.renderTimer = undefined;
    this.test = 0;
  }
  async init() {
    if (this.wasmModule) {
      return;
    }
    this.wasmModule = await tinymidipcm_default();
    this.pcmBufferPtr = this.wasmModule._malloc(this.bufferSize);
    this.msecsPtr = this.wasmModule._malloc(8);
  }
  setBufferDuration(seconds) {
    this.bufferSize = 4 * this.sampleRate * this.channels * seconds;
  }
  ensureInitialized() {
    if (!this.wasmModule) {
      throw new Error(`${this.constructor.name} not initalized. call .init()`);
    }
  }
  setSoundfont(buffer) {
    this.ensureInitialized();
    const { _malloc, _free, _tsf_load_memory, _tsf_set_output } = this.wasmModule;
    _free(this.soundfontBufferPtr);
    this.soundfontBufferPtr = _malloc(buffer.length);
    this.wasmModule.HEAPU8.set(buffer, this.soundfontBufferPtr);
    this.soundfontPtr = _tsf_load_memory(this.soundfontBufferPtr, buffer.length);
    _tsf_set_output(this.soundfontPtr, this.channels === 2 ? 0 : 2, this.sampleRate, this.gain);
  }
  getPCMBuffer() {
    this.ensureInitialized();
    const pcm = new Uint8Array(this.bufferSize);
    pcm.set(this.wasmModule.HEAPU8.subarray(this.pcmBufferPtr, this.pcmBufferPtr + this.bufferSize));
    return pcm;
  }
  getMIDIMessagePtr(midiBuffer) {
    const { _malloc, _free, _tml_load_memory } = this.wasmModule;
    _free(this.midiBufferPtr);
    this.midiBufferPtr = _malloc(midiBuffer.length);
    this.wasmModule.HEAPU8.set(midiBuffer, this.midiBufferPtr);
    return _tml_load_memory(this.midiBufferPtr, midiBuffer.length);
  }
  renderMIDIMessage(midiMessagePtr) {
    const { _midi_render } = this.wasmModule;
    return _midi_render(this.soundfontPtr, midiMessagePtr, this.channels, this.sampleRate, this.pcmBufferPtr, this.bufferSize, this.msecsPtr);
  }
  render(midiBuffer) {
    this.ensureInitialized();
    if (!this.soundfontPtr) {
      throw new Error("no soundfont buffer set. call .setSoundfont");
    }
    window.clearTimeout(this.renderTimer);
    const { setValue, getValue, _tsf_reset, _tsf_channel_set_bank_preset } = this.wasmModule;
    setValue(this.msecsPtr, 0, "double");
    _tsf_reset(this.soundfontPtr);
    _tsf_channel_set_bank_preset(this.soundfontPtr, 9, 128, 0);
    let midiMessagePtr = this.getMIDIMessagePtr(midiBuffer);
    const boundRender = function() {
      midiMessagePtr = this.renderMIDIMessage(midiMessagePtr);
      const pcm = this.getPCMBuffer();
      this.onPCMData(pcm);
      if (midiMessagePtr) {
        this.renderTimer = setTimeout(boundRender, this.renderInterval);
      } else {
        this.onRenderEnd(getValue(this.msecsPtr, "double"));
      }
    }.bind(this);
    this.renderTimer = setTimeout(() => {
      boundRender();
    }, 16);
  }
}
var _pendingMidi = null;
(async () => {
  const channels = 2;
  const sampleRate = 22050;
  const flushTime = 250;
  const renderInterval = 30;
  const fadeseconds = 2;
  let midiTimeout = null;
  let fadeTimeout = null;
  let samples = new Float32Array;
  let gainNode = null;
  function ensureGainNode() {
    if (!gainNode && window.audioContext) {
      gainNode = window.audioContext.createGain();
      gainNode.gain.setValueAtTime(0.1, window.audioContext.currentTime);
      gainNode.connect(window.audioContext.destination);
    }
    return gainNode;
  }
  let lastTime = 0;
  let bufferSources = [];
  const tinyMidiPCM = new TinyMidiPCM({
    renderInterval,
    onPCMData: (pcm) => {
      let float32 = new Float32Array(pcm.buffer);
      let temp = new Float32Array(samples.length + float32.length);
      temp.set(samples, 0);
      temp.set(float32, samples.length);
      samples = temp;
    },
    onRenderEnd: (ms) => {},
    bufferSize: 1024 * 100,
    sampleRate
  });
  window.__wsdbg?.("midi: WASM init starting");
  await tinyMidiPCM.init();
  window.__wsdbg?.("midi: WASM init done");
  const soundfontUrl = new URL("SCC1_Florestan.sf2", import.meta.url);
  window.__wsdbg?.("midi: fetching soundfont from " + soundfontUrl);
  const soundfontRes = await fetch(soundfontUrl);
  window.__wsdbg?.("midi: soundfont fetch status=" + soundfontRes.status);
  const soundfontBuffer = new Uint8Array(await soundfontRes.arrayBuffer());
  window.__wsdbg?.("midi: soundfont loaded, bytes=" + soundfontBuffer.length);
  tinyMidiPCM.setSoundfont(soundfontBuffer);
  window.__wsdbg?.("midi: soundfont set, ready to play");
  let _flushCount = 0;
  function flush() {
    if (!window.audioContext || !samples.length) {
      return;
    }
    if (window.audioContext.state !== "running") {
      window.__wsdbg?.("midi: flush skipped, state=" + window.audioContext.state);
      return;
    }
    const gn = ensureGainNode();
    if (!gn)
      return;
    if (_flushCount < 3) {
      _flushCount++;
      let maxSample = 0;
      for (let i = 0;i < Math.min(samples.length, 2000); i++) {
        const v = Math.abs(samples[i]);
        if (v > maxSample)
          maxSample = v;
      }
      window.__wsdbg?.("midi: flush#" + _flushCount + " samples=" + samples.length + " gain=" + gn.gain.value.toFixed(3) + " maxSample=" + maxSample.toFixed(6) + " lastTime=" + lastTime.toFixed(3) + " now=" + window.audioContext.currentTime.toFixed(3));
    }
    let bufferSource = window.audioContext.createBufferSource();
    const length = samples.length / channels;
    const audioBuffer = window.audioContext.createBuffer(channels, length, sampleRate);
    for (let channel = 0;channel < channels; channel++) {
      const audioData = audioBuffer.getChannelData(channel);
      let offset = channel;
      for (let i = 0;i < length; i++) {
        audioData[i] = samples[offset];
        offset += channels;
      }
    }
    if (lastTime < window.audioContext.currentTime) {
      lastTime = window.audioContext.currentTime;
    }
    bufferSource.buffer = audioBuffer;
    bufferSource.connect(gn);
    bufferSource.start(lastTime);
    bufferSources.push(bufferSource);
    lastTime += audioBuffer.duration;
    samples = new Float32Array;
  }
  let flushInterval;
  function fadeOut(callback) {
    const currentTime = window.audioContext.currentTime;
    const gn = ensureGainNode();
    if (gn) {
      gn.gain.cancelScheduledValues(currentTime);
      gn.gain.setTargetAtTime(0, currentTime, 0.5);
    }
    return setTimeout(callback, fadeseconds * 1000);
  }
  function stop() {
    if (flushInterval) {
      clearInterval(flushInterval);
    }
    samples = new Float32Array;
    if (bufferSources.length) {
      const gn = ensureGainNode();
      const temp = gn ? gn.gain.value : 0;
      if (gn)
        gn.gain.setValueAtTime(0, window.audioContext.currentTime);
      bufferSources.forEach((bufferSource) => {
        bufferSource.stop(window.audioContext.currentTime);
      });
      bufferSources = [];
      if (gn)
        gn.gain.setValueAtTime(temp, window.audioContext.currentTime);
    }
  }
  function startNow(vol, midiBuffer) {
    window.__wsdbg?.("midi: startNow vol=" + vol + " state=" + window.audioContext.state + " t=" + window.audioContext.currentTime.toFixed(3));
    if (vol !== -1) {
      window._tinyMidiVolume(vol);
    }
    lastTime = window.audioContext.currentTime;
    flushInterval = setInterval(flush, flushTime);
    tinyMidiPCM.render(midiBuffer);
  }
  function start(vol, midiBuffer) {
    if (!window.audioContext)
      return;
    window.__wsdbg?.("midi: start vol=" + vol + " ctx.state=" + window.audioContext.state);
    if (window.audioContext.state === "running") {
      startNow(vol, midiBuffer);
    } else {
      let onStateChange = function() {
        if (window.audioContext && window.audioContext.state === "running") {
          window.audioContext.removeEventListener("statechange", onStateChange);
          startNow(vol, midiBuffer);
        }
      };
      window.audioContext.resume().catch(function() {});
      window.audioContext.addEventListener("statechange", onStateChange);
    }
  }
  window._tinyMidiStop = async (fade) => {
    if (fade) {
      fadeTimeout = fadeOut(() => {
        stop();
      });
    } else {
      stop();
      clearTimeout(midiTimeout);
      clearTimeout(fadeTimeout);
    }
  };
  window._tinyMidiVolume = (vol = 1) => {
    const gn = ensureGainNode();
    if (gn)
      gn.gain.setValueAtTime(vol, window.audioContext.currentTime);
  };
  window._tinyMidiPlay = async (midiBuffer, vol, fade) => {
    _pendingMidi = null;
    if (!midiBuffer) {
      return;
    }
    window.__wsdbg?.("midi: _tinyMidiPlay vol=" + vol + " fade=" + fade + " buf=" + midiBuffer.length + " ctx.state=" + window.audioContext?.state);
    await window._tinyMidiStop(fade);
    if (fade) {
      midiTimeout = setTimeout(() => {
        start(vol, midiBuffer);
      }, fadeseconds * 1000);
    } else {
      start(vol, midiBuffer);
    }
  };
  if (_pendingMidi) {
    const { data, dB, fade } = _pendingMidi;
    _pendingMidi = null;
    window._tinyMidiPlay(data, Math.pow(10, dB / 20), fade);
  }
})();
function playMidi(data, dB, fade) {
  if (window._tinyMidiPlay) {
    window._tinyMidiPlay(data, Math.pow(10, dB / 20), fade);
  } else {
    _pendingMidi = { data, dB, fade };
  }
}
function setMidiVolume(dB) {
  if (window._tinyMidiVolume) {
    window._tinyMidiVolume(Math.pow(10, dB / 20));
  }
}
function stopMidi(fade) {
  if (window._tinyMidiStop) {
    window._tinyMidiStop(fade);
  }
}

// src/datastruct/Linkable.ts
class Linkable {
  key = 0n;
  next = null;
  prev = null;
  unlink() {
    if (this.prev != null) {
      this.prev.next = this.next;
      if (this.next) {
        this.next.prev = this.prev;
      }
      this.next = null;
      this.prev = null;
    }
  }
}

// src/datastruct/Linkable2.ts
class Linkable2 extends Linkable {
  next2 = null;
  prev2 = null;
  unlink2() {
    if (this.prev2 !== null) {
      this.prev2.next2 = this.next2;
      if (this.next2) {
        this.next2.prev2 = this.prev2;
      }
      this.next2 = null;
      this.prev2 = null;
    }
  }
}

// src/datastruct/LinkList.ts
class LinkList {
  sentinel = new Linkable;
  cursor = null;
  constructor() {
    this.sentinel.next = this.sentinel;
    this.sentinel.prev = this.sentinel;
  }
  clear() {
    while (true) {
      const node = this.sentinel.next;
      if (node === this.sentinel) {
        return;
      }
      node?.unlink();
    }
  }
  push(node) {
    if (node.prev) {
      node.unlink();
    }
    node.prev = this.sentinel.prev;
    node.next = this.sentinel;
    if (node.prev) {
      node.prev.next = node;
    }
    node.next.prev = node;
  }
  pushFront(node) {
    if (node.prev) {
      node.unlink();
    }
    node.prev = this.sentinel;
    node.next = this.sentinel.next;
    node.prev.next = node;
    if (node.next) {
      node.next.prev = node;
    }
  }
  popFront() {
    const node = this.sentinel.next;
    if (node === this.sentinel) {
      return null;
    }
    node?.unlink();
    return node;
  }
  head() {
    const node = this.sentinel.next;
    if (node === this.sentinel) {
      this.cursor = null;
      return null;
    }
    this.cursor = node?.next ?? null;
    return node;
  }
  tail() {
    const node = this.sentinel.prev;
    if (node === this.sentinel) {
      this.cursor = null;
      return null;
    }
    this.cursor = node?.prev ?? null;
    return node;
  }
  next() {
    const node = this.cursor;
    if (node === this.sentinel) {
      this.cursor = null;
      return null;
    }
    this.cursor = node?.next ?? null;
    return node;
  }
  prev() {
    const node = this.cursor;
    if (node === this.sentinel) {
      this.cursor = null;
      return null;
    }
    this.cursor = node?.prev ?? null;
    return node;
  }
}

// src/util/JsUtil.ts
var sleep = async (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var downloadUrl = async (url) => new Uint8Array(await (await fetch(url)).arrayBuffer());
function arraycopy(src, srcPos, dst, dstPos, length) {
  while (length--)
    dst[dstPos++] = src[srcPos++];
}
function bytesToBigInt(bytes) {
  let result = 0n;
  for (let index = 0;index < bytes.length; index++) {
    result = result << 8n | BigInt(bytes[index]);
  }
  return result;
}
function bigIntToBytes(bigInt) {
  const bytes = [];
  while (bigInt > 0n) {
    bytes.unshift(Number(bigInt & 0xffn));
    bigInt >>= 8n;
  }
  if (bytes[0] & 128) {
    bytes.unshift(0);
  }
  return new Uint8Array(bytes);
}
function bigIntModPow(base, exponent, modulus) {
  let result = 1n;
  while (exponent > 0n) {
    if (exponent % 2n === 1n) {
      result = result * base % modulus;
    }
    base = base * base % modulus;
    exponent >>= 1n;
  }
  return result;
}

// src/io/Packet.ts
class Packet extends Linkable2 {
  static CRC32_POLYNOMIAL = 3988292384;
  static crctable = new Int32Array(256);
  static bitmask = new Uint32Array(33);
  static cacheMin = new LinkList;
  static cacheMid = new LinkList;
  static cacheMax = new LinkList;
  static cacheMinCount = 0;
  static cacheMidCount = 0;
  static cacheMaxCount = 0;
  static {
    for (let i = 0;i < 32; i++) {
      Packet.bitmask[i] = (1 << i) - 1;
    }
    Packet.bitmask[32] = 4294967295;
    for (let i = 0;i < 256; i++) {
      let remainder = i;
      for (let bit = 0;bit < 8; bit++) {
        if ((remainder & 1) === 1) {
          remainder = remainder >>> 1 ^ Packet.CRC32_POLYNOMIAL;
        } else {
          remainder >>>= 1;
        }
      }
      Packet.crctable[i] = remainder;
    }
  }
  static getcrc(src, offset, length) {
    let crc = 4294967295;
    for (let i = offset;i < length; i++) {
      crc = crc >>> 8 ^ this.crctable[(crc ^ src[i]) & 255];
    }
    return ~crc;
  }
  static checkcrc(src, offset, length, expected = 0) {
    return Packet.getcrc(src, offset, length) == expected;
  }
  view;
  data;
  pos = 0;
  bitPos = 0;
  random = null;
  constructor(src) {
    if (!src) {
      throw new Error;
    }
    super();
    if (src instanceof Int8Array) {
      this.data = new Uint8Array(src.buffer, src.byteOffset, src.byteLength);
    } else {
      this.data = src;
    }
    this.view = new DataView(this.data.buffer, this.data.byteOffset, this.data.byteLength);
  }
  get length() {
    return this.view.byteLength;
  }
  get available() {
    return this.view.byteLength - this.pos;
  }
  static alloc(type) {
    let cached = null;
    if (type === 0 && Packet.cacheMinCount > 0) {
      Packet.cacheMinCount--;
      cached = Packet.cacheMin.popFront();
    } else if (type === 1 && Packet.cacheMidCount > 0) {
      Packet.cacheMidCount--;
      cached = Packet.cacheMid.popFront();
    } else if (type === 2 && Packet.cacheMaxCount > 0) {
      Packet.cacheMaxCount--;
      cached = Packet.cacheMax.popFront();
    }
    if (cached) {
      cached.pos = 0;
      return cached;
    }
    if (type === 0) {
      return new Packet(new Uint8Array(100));
    } else if (type === 1) {
      return new Packet(new Uint8Array(5000));
    } else {
      return new Packet(new Uint8Array(30000));
    }
  }
  release() {
    this.pos = 0;
    if (this.length === 100 && Packet.cacheMinCount < 1000) {
      Packet.cacheMin.push(this);
      Packet.cacheMinCount++;
    } else if (this.length === 5000 && Packet.cacheMidCount < 250) {
      Packet.cacheMid.push(this);
      Packet.cacheMidCount++;
    } else if (this.length === 30000 && Packet.cacheMaxCount < 50) {
      Packet.cacheMax.push(this);
      Packet.cacheMaxCount++;
    }
  }
  g1() {
    return this.view.getUint8(this.pos++);
  }
  g1b() {
    return this.view.getInt8(this.pos++);
  }
  g2() {
    const result = this.view.getUint16(this.pos);
    this.pos += 2;
    return result;
  }
  g2b() {
    const result = this.view.getInt16(this.pos);
    this.pos += 2;
    return result;
  }
  g3() {
    const result = this.view.getUint8(this.pos++) << 16 | this.view.getUint16(this.pos);
    this.pos += 2;
    return result;
  }
  g4() {
    const result = this.view.getInt32(this.pos);
    this.pos += 4;
    return result;
  }
  g8() {
    const result = this.view.getBigInt64(this.pos);
    this.pos += 8;
    return result;
  }
  gsmart() {
    return this.view.getUint8(this.pos) < 128 ? this.g1() - 64 : this.g2() - 49152;
  }
  gsmarts() {
    return this.view.getUint8(this.pos) < 128 ? this.g1() : this.g2() - 32768;
  }
  gjstr() {
    const view = this.view;
    const length = view.byteLength;
    let str = "";
    let b;
    while ((b = view.getUint8(this.pos++)) !== 10 && this.pos < length) {
      str += String.fromCharCode(b);
    }
    return str;
  }
  gdata(length, offset, dest) {
    dest.set(this.data.subarray(this.pos, this.pos + length), offset);
    this.pos += length;
  }
  pIsaac(opcode) {
    this.view.setUint8(this.pos++, opcode + (this.random?.nextInt ?? 0) & 255);
  }
  p1(value) {
    this.view.setUint8(this.pos++, value);
  }
  p2(value) {
    this.view.setUint16(this.pos, value);
    this.pos += 2;
  }
  ip2(value) {
    this.view.setUint16(this.pos, value, true);
    this.pos += 2;
  }
  p3(value) {
    this.view.setUint8(this.pos++, value >> 16);
    this.view.setUint16(this.pos, value);
    this.pos += 2;
  }
  p4(value) {
    this.view.setInt32(this.pos, value);
    this.pos += 4;
  }
  ip4(value) {
    this.view.setInt32(this.pos, value, true);
    this.pos += 4;
  }
  p8(value) {
    this.view.setBigInt64(this.pos, value);
    this.pos += 8;
  }
  pjstr(str) {
    const view = this.view;
    const length = str.length;
    for (let i = 0;i < length; i++) {
      view.setUint8(this.pos++, str.charCodeAt(i));
    }
    view.setUint8(this.pos++, 10);
  }
  pdata(src, length, offset) {
    this.data.set(src.subarray(offset, offset + length), this.pos);
    this.pos += length - offset;
  }
  psize1(size) {
    this.view.setUint8(this.pos - size - 1, size);
  }
  bits() {
    this.bitPos = this.pos << 3;
  }
  bytes() {
    this.pos = this.bitPos + 7 >>> 3;
  }
  gBit(n) {
    let bytePos = this.bitPos >>> 3;
    let remaining = 8 - (this.bitPos & 7);
    let value = 0;
    this.bitPos += n;
    for (;n > remaining; remaining = 8) {
      value += (this.view.getUint8(bytePos++) & Packet.bitmask[remaining]) << n - remaining;
      n -= remaining;
    }
    if (n === remaining) {
      value += this.view.getUint8(bytePos) & Packet.bitmask[remaining];
    } else {
      value += this.view.getUint8(bytePos) >>> remaining - n & Packet.bitmask[n];
    }
    return value;
  }
  rsaenc(mod, exp) {
    const length = this.pos;
    this.pos = 0;
    const temp = new Uint8Array(length);
    this.gdata(length, 0, temp);
    const bigRaw = bytesToBigInt(temp);
    const bigEnc = bigIntModPow(bigRaw, exp, mod);
    const rawEnc = bigIntToBytes(bigEnc);
    this.pos = 0;
    this.p1(rawEnc.length);
    this.pdata(rawEnc, rawEnc.length, 0);
  }
}

// src/client/InputTracking.ts
class InputTracking {
  static active = false;
  static old = null;
  static out = null;
  static lastTime = 0;
  static trackedCount = 0;
  static lastMoveTime = 0;
  static lastX = 0;
  static lastY = 0;
  static activate() {
    this.old = Packet.alloc(1);
    this.out = null;
    this.lastTime = performance.now();
    this.active = true;
  }
  static deactivate() {
    this.active = false;
    this.old = null;
    this.out = null;
  }
  static flush() {
    let buffer = null;
    if (this.out && this.active) {
      buffer = this.out;
    }
    this.out = null;
    return buffer;
  }
  static stop() {
    let buffer = null;
    if (this.old && this.old.pos > 0 && this.active) {
      buffer = this.old;
    }
    this.deactivate();
    return buffer;
  }
  static ensureCapacity(n) {
    if (!this.old) {
      return;
    }
    if (this.old.pos + n >= 500) {
      const buffer = this.old;
      this.old = Packet.alloc(1);
      this.out = buffer;
    }
  }
  static mousePressed(x, y, button, _pointerType) {
    if (!this.old) {
      return;
    }
    if (!this.active && (x >= 0 && x < 789 && y >= 0 && y < 532)) {
      return;
    }
    this.trackedCount++;
    const now = performance.now();
    let delta = (now - this.lastTime) / 10 | 0;
    if (delta > 250) {
      delta = 250;
    }
    this.lastTime = now;
    this.ensureCapacity(5);
    if (button === 2) {
      this.old.p1(1);
    } else {
      this.old.p1(2);
    }
    this.old.p1(delta);
    this.old.p3(x + (y << 10));
  }
  static mouseReleased(button, _pointerType) {
    if (!this.old) {
      return;
    }
    if (!this.active) {
      return;
    }
    this.trackedCount++;
    const now = performance.now();
    let delta = (now - this.lastTime) / 10 | 0;
    if (delta > 250) {
      delta = 250;
    }
    this.lastTime = now;
    this.ensureCapacity(2);
    if (button === 2) {
      this.old.p1(3);
    } else {
      this.old.p1(4);
    }
    this.old.p1(delta);
  }
  static mouseMoved(x, y, _pointerType) {
    if (!this.old) {
      return;
    }
    if (!this.active && (x >= 0 && x < 789 && y >= 0 && y < 532)) {
      return;
    }
    const now = performance.now();
    if (now - this.lastMoveTime < 50) {
      return;
    }
    this.lastMoveTime = now;
    this.trackedCount++;
    let delta = (now - this.lastTime) / 10 | 0;
    if (delta > 250) {
      delta = 250;
    }
    this.lastTime = now;
    if (x - this.lastX < 8 && x - this.lastX >= -8 && y - this.lastY < 8 && y - this.lastY >= -8) {
      this.ensureCapacity(3);
      this.old.p1(5);
      this.old.p1(delta);
      this.old.p1(x + (y - this.lastY + 8 << 4) + 8 - this.lastX);
    } else if (x - this.lastX < 128 && x - this.lastX >= -128 && y - this.lastY < 128 && y - this.lastY >= -128) {
      this.ensureCapacity(4);
      this.old.p1(6);
      this.old.p1(delta);
      this.old.p1(x + 128 - this.lastX);
      this.old.p1(y + 128 - this.lastY);
    } else {
      this.ensureCapacity(5);
      this.old.p1(7);
      this.old.p1(delta);
      this.old.p3(x + (y << 10));
    }
    this.lastX = x;
    this.lastY = y;
  }
  static keyPressed(key) {
    if (!this.old) {
      return;
    }
    if (!this.active) {
      return;
    }
    this.trackedCount++;
    const now = performance.now();
    let delta = (now - this.lastTime) / 10 | 0;
    if (delta > 250) {
      delta = 250;
    }
    this.lastTime = now;
    if (key === 1000) {
      key = 11;
    } else if (key === 1001) {
      key = 12;
    } else if (key === 1002) {
      key = 14;
    } else if (key === 1003) {
      key = 15;
    } else if (key >= 1008) {
      key -= 992;
    }
    this.ensureCapacity(3);
    this.old.p1(8);
    this.old.p1(delta);
    this.old.p1(key);
  }
  static keyReleased(key) {
    if (!this.old) {
      return;
    }
    if (!this.active) {
      return;
    }
    this.trackedCount++;
    const now = performance.now();
    let delta = (now - this.lastTime) / 10 | 0;
    if (delta > 250) {
      delta = 250;
    }
    this.lastTime = now;
    if (key === 1000) {
      key = 11;
    } else if (key === 1001) {
      key = 12;
    } else if (key === 1002) {
      key = 14;
    } else if (key === 1003) {
      key = 15;
    } else if (key >= 1008) {
      key -= 992;
    }
    this.ensureCapacity(3);
    this.old.p1(9);
    this.old.p1(delta);
    this.old.p1(key);
  }
  static focusGained() {
    if (!this.old) {
      return;
    }
    if (!this.active) {
      return;
    }
    this.trackedCount++;
    const now = performance.now();
    let delta = (now - this.lastTime) / 10 | 0;
    if (delta > 250) {
      delta = 250;
    }
    this.lastTime = now;
    this.ensureCapacity(2);
    this.old.p1(10);
    this.old.p1(delta);
  }
  static focusLost() {
    if (!this.old) {
      return;
    }
    if (!this.active) {
      return;
    }
    this.trackedCount++;
    const now = performance.now();
    let delta = (now - this.lastTime) / 10 | 0;
    if (delta > 250) {
      delta = 250;
    }
    this.lastTime = now;
    this.ensureCapacity(2);
    this.old.p1(11);
    this.old.p1(delta);
  }
  static mouseEntered() {
    if (!this.old) {
      return;
    }
    if (!this.active) {
      return;
    }
    this.trackedCount++;
    const now = performance.now();
    let delta = (now - this.lastTime) / 10 | 0;
    if (delta > 250) {
      delta = 250;
    }
    this.lastTime = now;
    this.ensureCapacity(2);
    this.old.p1(12);
    this.old.p1(delta);
  }
  static mouseExited() {
    if (!this.old) {
      return;
    }
    if (!this.active) {
      return;
    }
    this.trackedCount++;
    const now = performance.now();
    let delta = (now - this.lastTime) / 10 | 0;
    if (delta > 250) {
      delta = 250;
    }
    this.lastTime = now;
    this.ensureCapacity(2);
    this.old.p1(13);
    this.old.p1(delta);
  }
}

// src/client/KeyCodes.ts
var CanvasEnabledKeys = ["F11", "F12"];
var KeyCodes = new Map;
KeyCodes.set("ArrowLeft", { code: 37, ch: 1 });
KeyCodes.set("ArrowRight", { code: 39, ch: 2 });
KeyCodes.set("ArrowUp", { code: 38, ch: 3 });
KeyCodes.set("ArrowDown", { code: 40, ch: 4 });
KeyCodes.set("Control", { code: 17, ch: 5 });
KeyCodes.set("Shift", { code: 16, ch: 6 });
KeyCodes.set("Alt", { code: 18, ch: 7 });
KeyCodes.set("Backspace", { code: 8, ch: 8 });
KeyCodes.set("Tab", { code: 9, ch: 9 });
KeyCodes.set("Enter", { code: 10, ch: 10 });
KeyCodes.set("Escape", { code: 27, ch: 27 });
KeyCodes.set(" ", { code: 32, ch: 32 });
KeyCodes.set("Delete", { code: 127, ch: 127 });
KeyCodes.set("Home", { code: 36, ch: 1000 });
KeyCodes.set("End", { code: 35, ch: 1001 });
KeyCodes.set("PageUp", { code: 33, ch: 1002 });
KeyCodes.set("PageDown", { code: 34, ch: 1003 });
KeyCodes.set("F1", { code: 112, ch: 1008 });
KeyCodes.set("F2", { code: 113, ch: 1009 });
KeyCodes.set("F3", { code: 114, ch: 1010 });
KeyCodes.set("F4", { code: 115, ch: 1011 });
KeyCodes.set("F5", { code: 116, ch: 1012 });
KeyCodes.set("F6", { code: 117, ch: 1013 });
KeyCodes.set("F7", { code: 118, ch: 1014 });
KeyCodes.set("F8", { code: 119, ch: 1015 });
KeyCodes.set("F9", { code: 120, ch: 1016 });
KeyCodes.set("F10", { code: 121, ch: 1017 });
KeyCodes.set("F11", { code: 122, ch: 1018 });
KeyCodes.set("F12", { code: 123, ch: 1019 });
KeyCodes.set("CapsLock", { code: 20, ch: 65535 });
KeyCodes.set("Meta", { code: 524, ch: 65535 });
KeyCodes.set("Insert", { code: 155, ch: 65535 });
KeyCodes.set("`", { code: 192, ch: 96 });
KeyCodes.set("~", { code: 192, ch: 126 });
KeyCodes.set("!", { code: 49, ch: 33 });
KeyCodes.set("@", { code: 50, ch: 64 });
KeyCodes.set("#", { code: 51, ch: 35 });
KeyCodes.set("£", { code: 51, ch: 163 });
KeyCodes.set("$", { code: 52, ch: 36 });
KeyCodes.set("%", { code: 53, ch: 37 });
KeyCodes.set("^", { code: 54, ch: 94 });
KeyCodes.set("&", { code: 55, ch: 38 });
KeyCodes.set("*", { code: 56, ch: 42 });
KeyCodes.set("(", { code: 57, ch: 40 });
KeyCodes.set(")", { code: 48, ch: 41 });
KeyCodes.set("-", { code: 45, ch: 45 });
KeyCodes.set("_", { code: 45, ch: 95 });
KeyCodes.set("=", { code: 61, ch: 61 });
KeyCodes.set("+", { code: 61, ch: 43 });
KeyCodes.set("[", { code: 91, ch: 91 });
KeyCodes.set("{", { code: 91, ch: 123 });
KeyCodes.set("]", { code: 93, ch: 93 });
KeyCodes.set("}", { code: 93, ch: 125 });
KeyCodes.set("\\", { code: 92, ch: 92 });
KeyCodes.set("|", { code: 92, ch: 124 });
KeyCodes.set(";", { code: 59, ch: 59 });
KeyCodes.set(":", { code: 59, ch: 58 });
KeyCodes.set("'", { code: 222, ch: 39 });
KeyCodes.set('"', { code: 222, ch: 34 });
KeyCodes.set(",", { code: 44, ch: 44 });
KeyCodes.set("<", { code: 44, ch: 60 });
KeyCodes.set(".", { code: 46, ch: 46 });
KeyCodes.set(">", { code: 46, ch: 62 });
KeyCodes.set("/", { code: 47, ch: 47 });
KeyCodes.set("?", { code: 47, ch: 63 });
KeyCodes.set("0", { code: 48, ch: 48 });
KeyCodes.set("1", { code: 49, ch: 49 });
KeyCodes.set("2", { code: 50, ch: 50 });
KeyCodes.set("3", { code: 51, ch: 51 });
KeyCodes.set("4", { code: 52, ch: 52 });
KeyCodes.set("5", { code: 53, ch: 53 });
KeyCodes.set("6", { code: 54, ch: 54 });
KeyCodes.set("7", { code: 55, ch: 55 });
KeyCodes.set("8", { code: 56, ch: 56 });
KeyCodes.set("9", { code: 57, ch: 57 });
KeyCodes.set("a", { code: 65, ch: 97 });
KeyCodes.set("b", { code: 66, ch: 98 });
KeyCodes.set("c", { code: 67, ch: 99 });
KeyCodes.set("d", { code: 68, ch: 100 });
KeyCodes.set("e", { code: 69, ch: 101 });
KeyCodes.set("f", { code: 70, ch: 102 });
KeyCodes.set("g", { code: 71, ch: 103 });
KeyCodes.set("h", { code: 72, ch: 104 });
KeyCodes.set("i", { code: 73, ch: 105 });
KeyCodes.set("j", { code: 74, ch: 106 });
KeyCodes.set("k", { code: 75, ch: 107 });
KeyCodes.set("l", { code: 76, ch: 108 });
KeyCodes.set("m", { code: 77, ch: 109 });
KeyCodes.set("n", { code: 78, ch: 110 });
KeyCodes.set("o", { code: 79, ch: 111 });
KeyCodes.set("p", { code: 80, ch: 112 });
KeyCodes.set("q", { code: 81, ch: 113 });
KeyCodes.set("r", { code: 82, ch: 114 });
KeyCodes.set("s", { code: 83, ch: 115 });
KeyCodes.set("t", { code: 84, ch: 116 });
KeyCodes.set("u", { code: 85, ch: 117 });
KeyCodes.set("v", { code: 86, ch: 118 });
KeyCodes.set("w", { code: 87, ch: 119 });
KeyCodes.set("x", { code: 88, ch: 120 });
KeyCodes.set("y", { code: 89, ch: 121 });
KeyCodes.set("z", { code: 90, ch: 122 });
KeyCodes.set("A", { code: 65, ch: 65 });
KeyCodes.set("B", { code: 66, ch: 66 });
KeyCodes.set("C", { code: 67, ch: 67 });
KeyCodes.set("D", { code: 68, ch: 68 });
KeyCodes.set("E", { code: 69, ch: 69 });
KeyCodes.set("F", { code: 70, ch: 70 });
KeyCodes.set("G", { code: 71, ch: 71 });
KeyCodes.set("H", { code: 72, ch: 72 });
KeyCodes.set("I", { code: 73, ch: 73 });
KeyCodes.set("J", { code: 74, ch: 74 });
KeyCodes.set("K", { code: 75, ch: 75 });
KeyCodes.set("L", { code: 76, ch: 76 });
KeyCodes.set("M", { code: 77, ch: 77 });
KeyCodes.set("N", { code: 78, ch: 78 });
KeyCodes.set("O", { code: 79, ch: 79 });
KeyCodes.set("P", { code: 80, ch: 80 });
KeyCodes.set("Q", { code: 81, ch: 81 });
KeyCodes.set("R", { code: 82, ch: 82 });
KeyCodes.set("S", { code: 83, ch: 83 });
KeyCodes.set("T", { code: 84, ch: 84 });
KeyCodes.set("U", { code: 85, ch: 85 });
KeyCodes.set("V", { code: 86, ch: 86 });
KeyCodes.set("W", { code: 87, ch: 87 });
KeyCodes.set("X", { code: 88, ch: 88 });
KeyCodes.set("Y", { code: 89, ch: 89 });
KeyCodes.set("Z", { code: 90, ch: 90 });

// src/graphics/Canvas.ts
var canvas = document.getElementById("canvas");
var canvas2d = canvas?.getContext("2d", {
  desynchronized: false,
  alpha: false
});

// src/graphics/Pix2D.ts
class Pix2D extends Linkable2 {
  static pixels = new Int32Array;
  static width = 0;
  static height = 0;
  static clipMinX = 0;
  static clipMaxX = 0;
  static clipMinY = 0;
  static clipMaxY = 0;
  static sizeX = 0;
  static maxX = 0;
  static maxY = 0;
  static setPixels(pixels, width, height) {
    this.pixels = pixels;
    this.width = width;
    this.height = height;
    this.setClipping(0, 0, width, height);
  }
  static resetClipping() {
    this.clipMinX = 0;
    this.clipMinY = 0;
    this.clipMaxX = this.width;
    this.clipMaxY = this.height;
    this.sizeX = this.clipMaxX - 1;
    this.maxX = this.clipMaxX / 2 | 0;
  }
  static setClipping(x1, y1, x2, y2) {
    if (x1 < 0) {
      x1 = 0;
    }
    if (y1 < 0) {
      y1 = 0;
    }
    if (x2 > this.width) {
      x2 = this.width;
    }
    if (y2 > this.height) {
      y2 = this.height;
    }
    this.clipMinY = y1;
    this.clipMaxY = y2;
    this.clipMinX = x1;
    this.clipMaxX = x2;
    this.sizeX = this.clipMaxX - 1;
    this.maxX = this.clipMaxX / 2 | 0;
    this.maxY = this.clipMaxY / 2 | 0;
  }
  static cls() {
    const len = this.width * this.height;
    for (let i = 0;i < len; i++) {
      this.pixels[i] = 0;
    }
  }
  static fillRectTrans(x, y, width, height, rgb, alpha) {
    if (x < this.clipMinX) {
      width -= this.clipMinX - x;
      x = this.clipMinX;
    }
    if (y < this.clipMinY) {
      height -= this.clipMinY - y;
      y = this.clipMinY;
    }
    if (x + width > this.clipMaxX) {
      width = this.clipMaxX - x;
    }
    if (y + height > this.clipMaxY) {
      height = this.clipMaxY - y;
    }
    const invAlpha = 256 - alpha;
    const r0 = (rgb >> 16 & 255) * alpha;
    const g0 = (rgb >> 8 & 255) * alpha;
    const b0 = (rgb & 255) * alpha;
    const step = this.width - width;
    let offset = x + y * this.width;
    for (let i = 0;i < height; i++) {
      for (let j = -width;j < 0; j++) {
        const r1 = (this.pixels[offset] >> 16 & 255) * invAlpha;
        const g1 = (this.pixels[offset] >> 8 & 255) * invAlpha;
        const b1 = (this.pixels[offset] & 255) * invAlpha;
        const mixed = (r0 + r1 >> 8 << 16) + (g0 + g1 >> 8 << 8) + (b0 + b1 >> 8);
        this.pixels[offset++] = mixed;
      }
      offset += step;
    }
  }
  static fillRect(x, y, width, height, rgb) {
    if (x < this.clipMinX) {
      width -= this.clipMinX - x;
      x = this.clipMinX;
    }
    if (y < this.clipMinY) {
      height -= this.clipMinY - y;
      y = this.clipMinY;
    }
    if (x + width > this.clipMaxX) {
      width = this.clipMaxX - x;
    }
    if (y + height > this.clipMaxY) {
      height = this.clipMaxY - y;
    }
    const step = this.width - width;
    let offset = x + y * this.width;
    for (let i = -height;i < 0; i++) {
      for (let j = -width;j < 0; j++) {
        this.pixels[offset++] = rgb;
      }
      offset += step;
    }
  }
  static drawRect(x, y, w, h, rgb) {
    this.hline(x, y, w, rgb);
    this.hline(x, y + h - 1, w, rgb);
    this.vline(x, y, h, rgb);
    this.vline(x + w - 1, y, h, rgb);
  }
  static drawRectTrans(x, y, w, h, rgb, alpha) {
    this.hlineTrans(x, y, w, rgb, alpha);
    this.hlineTrans(x, y + h - 1, w, rgb, alpha);
    if (h >= 3) {
      this.vlineTrans(x, y, h, rgb, alpha);
      this.vlineTrans(x + w - 1, y, h, rgb, alpha);
    }
  }
  static hline(x, y, width, rgb) {
    if (y < this.clipMinY || y >= this.clipMaxY) {
      return;
    }
    if (x < this.clipMinX) {
      width -= this.clipMinX - x;
      x = this.clipMinX;
    }
    if (x + width > this.clipMaxX) {
      width = this.clipMaxX - x;
    }
    const off = x + y * this.width;
    for (let i = 0;i < width; i++) {
      this.pixels[off + i] = rgb;
    }
  }
  static hlineTrans(x, y, width, rgb, alpha) {
    if (y < this.clipMinY || y >= this.clipMaxY) {
      return;
    }
    if (x < this.clipMinX) {
      width -= this.clipMinX - x;
      x = this.clipMinX;
    }
    if (x + width > this.clipMaxX) {
      width = this.clipMaxX - x;
    }
    const invAlpha = 256 - alpha;
    const r0 = (rgb >> 16 & 255) * alpha;
    const g0 = (rgb >> 8 & 255) * alpha;
    const b0 = (rgb & 255) * alpha;
    const _step = this.width - width;
    let offset = x + y * this.width;
    for (let i = 0;i < width; i++) {
      const r1 = (this.pixels[offset] >> 16 & 255) * invAlpha;
      const g1 = (this.pixels[offset] >> 8 & 255) * invAlpha;
      const b1 = (this.pixels[offset] & 255) * invAlpha;
      const mixed = (r0 + r1 >> 8 << 16) + (g0 + g1 >> 8 << 8) + (b0 + b1 >> 8);
      this.pixels[offset++] = mixed;
    }
  }
  static vline(x, y, height, rgb) {
    if (x < this.clipMinX || x >= this.clipMaxX) {
      return;
    }
    if (y < this.clipMinY) {
      height -= this.clipMinY - y;
      y = this.clipMinY;
    }
    if (y + height > this.clipMaxY) {
      height = this.clipMaxY - y;
    }
    const off = x + y * this.width;
    for (let i = 0;i < height; i++) {
      this.pixels[off + i * this.width] = rgb;
    }
  }
  static vlineTrans(x, y, height, rgb, alpha) {
    if (x < this.clipMinX || x >= this.clipMaxX) {
      return;
    }
    if (y < this.clipMinY) {
      height -= this.clipMinY - y;
      y = this.clipMinY;
    }
    if (y + height > this.clipMaxY) {
      height = this.clipMaxY - y;
    }
    const invAlpha = 256 - alpha;
    const r0 = (rgb >> 16 & 255) * alpha;
    const g0 = (rgb >> 8 & 255) * alpha;
    const b0 = (rgb & 255) * alpha;
    let offset = x + y * this.width;
    for (let i = 0;i < height; i++) {
      const r1 = (this.pixels[offset] >> 16 & 255) * invAlpha;
      const g1 = (this.pixels[offset] >> 8 & 255) * invAlpha;
      const b1 = (this.pixels[offset] & 255) * invAlpha;
      const mixed = (r0 + r1 >> 8 << 16) + (g0 + g1 >> 8 << 8) + (b0 + b1 >> 8);
      this.pixels[offset] = mixed;
      offset += this.width;
    }
  }
  static fillCircle(xCenter, yCenter, yRadius, rgb, alpha) {
    const invAlpha = 256 - alpha;
    const r0 = (rgb >> 16 & 255) * alpha;
    const g0 = (rgb >> 8 & 255) * alpha;
    const b0 = (rgb & 255) * alpha;
    let yStart = yCenter - yRadius;
    if (yStart < 0) {
      yStart = 0;
    }
    let yEnd = yCenter + yRadius;
    if (yEnd >= this.height) {
      yEnd = this.height - 1;
    }
    for (let y = yStart;y <= yEnd; y++) {
      const midpoint = y - yCenter;
      const xRadius = Math.sqrt(yRadius * yRadius - midpoint * midpoint) | 0;
      let xStart = xCenter - xRadius;
      if (xStart < 0) {
        xStart = 0;
      }
      let xEnd = xCenter + xRadius;
      if (xEnd >= this.width) {
        xEnd = this.width - 1;
      }
      let offset = xStart + y * this.width;
      for (let x = xStart;x <= xEnd; x++) {
        const r1 = (this.pixels[offset] >> 16 & 255) * invAlpha;
        const g1 = (this.pixels[offset] >> 8 & 255) * invAlpha;
        const b1 = (this.pixels[offset] & 255) * invAlpha;
        const mixed = (r0 + r1 >> 8 << 16) + (g0 + g1 >> 8 << 8) + (b0 + b1 >> 8);
        this.pixels[offset++] = mixed;
      }
    }
  }
}

// src/graphics/Pix8.ts
class Pix8 extends Pix2D {
  data;
  bpal;
  wi;
  hi;
  xof;
  yof;
  owi;
  ohi;
  constructor(width, height, palette) {
    super();
    this.data = new Int8Array(width * height);
    this.wi = this.owi = width;
    this.hi = this.ohi = height;
    this.xof = this.yof = 0;
    this.bpal = palette;
  }
  static depack(jag, name, sprite = 0) {
    const dat = new Packet(jag.read(name + ".dat"));
    const index = new Packet(jag.read("index.dat"));
    index.pos = dat.g2();
    const owi = index.g2();
    const ohi = index.g2();
    const bpalCount = index.g1();
    const bpal = new Int32Array(bpalCount);
    for (let i = 0;i < bpalCount - 1; i++) {
      bpal[i + 1] = index.g3();
    }
    for (let i = 0;i < sprite; i++) {
      index.pos += 2;
      dat.pos += index.g2() * index.g2();
      index.pos += 1;
    }
    if (dat.pos > dat.length || index.pos > index.length) {
      throw new Error;
    }
    const xof = index.g1();
    const yof = index.g1();
    const wi = index.g2();
    const hi = index.g2();
    const image = new Pix8(wi, hi, bpal);
    image.xof = xof;
    image.yof = yof;
    image.owi = owi;
    image.ohi = ohi;
    const encoding = index.g1();
    if (encoding === 0) {
      for (let i = 0;i < image.wi * image.hi; i++) {
        image.data[i] = dat.g1b();
      }
    } else if (encoding === 1) {
      for (let x = 0;x < image.wi; x++) {
        for (let y = 0;y < image.hi; y++) {
          image.data[x + y * image.wi] = dat.g1b();
        }
      }
    }
    return image;
  }
  halveSize() {
    this.owi |= 0;
    this.ohi |= 0;
    this.owi /= 2;
    this.ohi /= 2;
    this.owi |= 0;
    this.ohi |= 0;
    const pixels = new Int8Array(this.owi * this.ohi);
    let off = 0;
    for (let y = 0;y < this.hi; y++) {
      for (let x = 0;x < this.wi; x++) {
        pixels[(x + this.xof >> 1) + (y + this.yof >> 1) * this.owi] = this.data[off++];
      }
    }
    this.data = pixels;
    this.wi = this.owi;
    this.hi = this.ohi;
    this.xof = 0;
    this.yof = 0;
  }
  trim() {
    if (this.wi === this.owi && this.hi === this.ohi) {
      return;
    }
    const pixels = new Int8Array(this.owi * this.ohi);
    let off = 0;
    for (let y = 0;y < this.hi; y++) {
      for (let x = 0;x < this.wi; x++) {
        pixels[x + this.xof + (y + this.yof) * this.owi] = this.data[off++];
      }
    }
    this.data = pixels;
    this.wi = this.owi;
    this.hi = this.ohi;
    this.xof = 0;
    this.yof = 0;
  }
  rgbAdjust(r, g, b) {
    for (let i = 0;i < this.bpal.length; i++) {
      let red = this.bpal[i] >> 16 & 255;
      red += r;
      if (red < 0) {
        red = 0;
      } else if (red > 255) {
        red = 255;
      }
      let green = this.bpal[i] >> 8 & 255;
      green += g;
      if (green < 0) {
        green = 0;
      } else if (green > 255) {
        green = 255;
      }
      let blue = this.bpal[i] & 255;
      blue += b;
      if (blue < 0) {
        blue = 0;
      } else if (blue > 255) {
        blue = 255;
      }
      this.bpal[i] = (red << 16) + (green << 8) + blue;
    }
  }
  hflip() {
    const pixels = this.data;
    const width = this.wi;
    const height = this.hi;
    for (let y = 0;y < height; y++) {
      const div = width / 2 | 0;
      for (let x = 0;x < div; x++) {
        const off1 = x + y * width;
        const off2 = width - x - 1 + y * width;
        const tmp = pixels[off1];
        pixels[off1] = pixels[off2];
        pixels[off2] = tmp;
      }
    }
  }
  vflip() {
    const pixels = this.data;
    const width = this.wi;
    const height = this.hi;
    for (let y = 0;y < (height / 2 | 0); y++) {
      for (let x = 0;x < width; x++) {
        const off1 = x + y * width;
        const off2 = x + (height - y - 1) * width;
        const tmp = pixels[off1];
        pixels[off1] = pixels[off2];
        pixels[off2] = tmp;
      }
    }
  }
  plotSprite(x, y) {
    x |= 0;
    y |= 0;
    x += this.xof;
    y += this.yof;
    let dstOff = x + y * Pix2D.width;
    let srcOff = 0;
    let h = this.hi;
    let w = this.wi;
    let dstStep = Pix2D.width - w;
    let srcStep = 0;
    if (y < Pix2D.clipMinY) {
      const cutoff = Pix2D.clipMinY - y;
      h -= cutoff;
      y = Pix2D.clipMinY;
      srcOff += cutoff * w;
      dstOff += cutoff * Pix2D.width;
    }
    if (y + h > Pix2D.clipMaxY) {
      h -= y + h - Pix2D.clipMaxY;
    }
    if (x < Pix2D.clipMinX) {
      const cutoff = Pix2D.clipMinX - x;
      w -= cutoff;
      x = Pix2D.clipMinX;
      srcOff += cutoff;
      dstOff += cutoff;
      srcStep += cutoff;
      dstStep += cutoff;
    }
    if (x + w > Pix2D.clipMaxX) {
      const cutoff = x + w - Pix2D.clipMaxX;
      w -= cutoff;
      srcStep += cutoff;
      dstStep += cutoff;
    }
    if (w > 0 && h > 0) {
      this.plot(w, h, this.data, srcOff, srcStep, Pix2D.pixels, dstOff, dstStep);
    }
  }
  plot(w, h, src, srcOff, srcStep, dst, dstOff, dstStep) {
    const qw = -(w >> 2);
    w = -(w & 3);
    for (let y = -h;y < 0; y++) {
      for (let x = qw;x < 0; x++) {
        let palIndex = src[srcOff++];
        if (palIndex === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = this.bpal[palIndex & 255];
        }
        palIndex = src[srcOff++];
        if (palIndex === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = this.bpal[palIndex & 255];
        }
        palIndex = src[srcOff++];
        if (palIndex === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = this.bpal[palIndex & 255];
        }
        palIndex = src[srcOff++];
        if (palIndex === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = this.bpal[palIndex & 255];
        }
      }
      for (let x = w;x < 0; x++) {
        const palIndex = src[srcOff++];
        if (palIndex === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = this.bpal[palIndex & 255];
        }
      }
      dstOff += dstStep;
      srcOff += srcStep;
    }
  }
  scalePlotSprite(arg0, arg1, arg2, arg3) {
    try {
      const local2 = this.wi;
      const local5 = this.hi;
      let local7 = 0;
      let local9 = 0;
      const _local15 = (local2 << 16) / arg2 | 0;
      const _local21 = (local5 << 16) / arg3 | 0;
      const local24 = this.owi;
      const local27 = this.ohi;
      const local33 = (local24 << 16) / arg2 | 0;
      const local39 = (local27 << 16) / arg3 | 0;
      arg0 = arg0 + (this.xof * arg2 + local24 - 1) / local24 | 0;
      arg1 = arg1 + (this.yof * arg3 + local27 - 1) / local27 | 0;
      if (this.xof * arg2 % local24 != 0) {
        local7 = (local24 - this.xof * arg2 % local24 << 16) / arg2 | 0;
      }
      if (this.yof * arg3 % local27 != 0) {
        local9 = (local27 - this.yof * arg3 % local27 << 16) / arg3 | 0;
      }
      arg2 = arg2 * (this.wi - (local7 >> 16)) / local24 | 0;
      arg3 = arg3 * (this.hi - (local9 >> 16)) / local27 | 0;
      let local133 = arg0 + arg1 * Pix2D.width;
      let local137 = Pix2D.width - arg2;
      let local144;
      if (arg1 < Pix2D.clipMinY) {
        local144 = Pix2D.clipMinY - arg1;
        arg3 -= local144;
        arg1 = 0;
        local133 += local144 * Pix2D.width;
        local9 += local39 * local144;
      }
      if (arg1 + arg3 > Pix2D.clipMaxY) {
        arg3 -= arg1 + arg3 - Pix2D.clipMaxY;
      }
      if (arg0 < Pix2D.clipMinX) {
        local144 = Pix2D.clipMinX - arg0;
        arg2 -= local144;
        arg0 = 0;
        local133 += local144;
        local7 += local33 * local144;
        local137 += local144;
      }
      if (arg0 + arg2 > Pix2D.clipMaxX) {
        local144 = arg0 + arg2 - Pix2D.clipMaxX;
        arg2 -= local144;
        local137 += local144;
      }
      this.plotScale(Pix2D.pixels, this.data, this.bpal, local7, local9, local133, local137, arg2, arg3, local33, local39, local2);
    } catch (_e) {
      console.log("error in sprite clipping routine");
    }
  }
  plotScale(dst, src, bpal, offW, offH, dstOff, dstStep, w, h, scaleCropWidth, scaleCropHeight, arg11) {
    try {
      const lastOffW = offW;
      for (let y = -h;y < 0; y++) {
        const offY = (offH >> 16) * arg11;
        for (let x = -w;x < 0; x++) {
          const rgb = src[(offW >> 16) + offY];
          if (rgb == 0) {
            dstOff++;
          } else {
            dst[dstOff++] = bpal[rgb & 255];
          }
          offW += scaleCropWidth;
        }
        offH += scaleCropHeight;
        offW = lastOffW;
        dstOff += dstStep;
      }
    } catch (_e) {
      console.log("error in plot_scale");
    }
  }
}

// src/util/Arrays.ts
class TypedArray1d extends Array {
  constructor(length, defaultValue) {
    super(length);
    for (let l = 0;l < length; l++) {
      this[l] = defaultValue;
    }
  }
}

class TypedArray2d extends Array {
  constructor(length, width, defaultValue) {
    super(length);
    for (let l = 0;l < length; l++) {
      this[l] = new Array(width);
      for (let w = 0;w < width; w++) {
        this[l][w] = defaultValue;
      }
    }
  }
}

class TypedArray3d extends Array {
  constructor(length, width, height, defaultValue) {
    super(length);
    for (let l = 0;l < length; l++) {
      this[l] = new Array(width);
      for (let w = 0;w < width; w++) {
        this[l][w] = new Array(height);
        for (let h = 0;h < height; h++) {
          this[l][w][h] = defaultValue;
        }
      }
    }
  }
}

class TypedArray4d extends Array {
  constructor(length, width, height, space, defaultValue) {
    super(length);
    for (let l = 0;l < length; l++) {
      this[l] = new Array(width);
      for (let w = 0;w < width; w++) {
        this[l][w] = new Array(height);
        for (let h = 0;h < height; h++) {
          this[l][w][h] = new Array(space);
          for (let s = 0;s < space; s++) {
            this[l][w][h][s] = defaultValue;
          }
        }
      }
    }
  }
}

class Uint8Array3d extends Array {
  constructor(length, width, height) {
    super(length);
    for (let l = 0;l < length; l++) {
      this[l] = new Array(width);
      for (let w = 0;w < width; w++) {
        this[l][w] = new Uint8Array(height);
      }
    }
  }
}

class Int32Array2d extends Array {
  constructor(length, width) {
    super(length);
    for (let l = 0;l < length; l++) {
      this[l] = new Int32Array(width);
    }
  }
}

class Int32Array3d extends Array {
  constructor(length, width, height) {
    super(length);
    for (let l = 0;l < length; l++) {
      this[l] = new Array(width);
      for (let w = 0;w < width; w++) {
        this[l][w] = new Int32Array(height);
      }
    }
  }
}

// src/dash3d/Pix3D.ts
class Pix3D extends Pix2D {
  static lowMem = false;
  static lowDetail = true;
  static divTable = new Int32Array(512);
  static divTable2 = new Int32Array(2048);
  static sinTable = new Int32Array(2048);
  static cosTable = new Int32Array(2048);
  static colourTable = new Int32Array(65536);
  static textures = new TypedArray1d(50, null);
  static textureTranslucent = new TypedArray1d(50, false);
  static averageTextureRgb = new Int32Array(50);
  static activeTexels = new TypedArray1d(50, null);
  static textureCycle = new Int32Array(50);
  static texPal = new TypedArray1d(50, null);
  static textureCount = 0;
  static originX = 0;
  static originY = 0;
  static texelPool = null;
  static poolSize = 0;
  static opaque = false;
  static cycle = 0;
  static scanline = new Int32Array;
  static hclip = false;
  static trans = 0;
  static {
    for (let i = 1;i < 512; i++) {
      this.divTable[i] = 32768 / i | 0;
    }
    for (let i = 1;i < 2048; i++) {
      this.divTable2[i] = 65536 / i | 0;
    }
    for (let i = 0;i < 2048; i++) {
      this.sinTable[i] = Math.sin(i * 0.0030679615757712823) * 65536 | 0;
      this.cosTable[i] = Math.cos(i * 0.0030679615757712823) * 65536 | 0;
    }
  }
  static setRenderClipping() {
    this.scanline = new Int32Array(Pix2D.height);
    for (let y = 0;y < Pix2D.height; y++) {
      this.scanline[y] = Pix2D.width * y;
    }
    this.originX = Pix2D.width / 2 | 0;
    this.originY = Pix2D.height / 2 | 0;
  }
  static setClipping(width, height) {
    this.scanline = new Int32Array(height);
    for (let y = 0;y < height; y++) {
      this.scanline[y] = width * y;
    }
    this.originX = width / 2 | 0;
    this.originY = height / 2 | 0;
  }
  static clearTexels() {
    this.texelPool = null;
    this.activeTexels.fill(null);
  }
  static initPool(size) {
    if (this.texelPool) {
      return;
    }
    this.poolSize = size;
    if (this.lowMem) {
      this.texelPool = new Int32Array2d(size, 16384);
    } else {
      this.texelPool = new Int32Array2d(size, 65536);
    }
    this.activeTexels.fill(null);
  }
  static unpackTextures(textures) {
    this.textureCount = 0;
    for (let i = 0;i < 50; i++) {
      try {
        this.textures[i] = Pix8.depack(textures, i.toString());
        if (this.lowMem && this.textures[i]?.owi === 128) {
          this.textures[i]?.halveSize();
        } else {
          this.textures[i]?.trim();
        }
        this.textureCount++;
      } catch (_e) {}
    }
  }
  static getAverageTextureRgb(id) {
    if (this.averageTextureRgb[id] !== 0) {
      return this.averageTextureRgb[id];
    }
    const palette = this.texPal[id];
    if (!palette) {
      return 0;
    }
    let r = 0;
    let g = 0;
    let b = 0;
    const length = palette.length;
    for (let i = 0;i < length; i++) {
      r += palette[i] >> 16 & 255;
      g += palette[i] >> 8 & 255;
      b += palette[i] & 255;
    }
    let rgb = ((r / length | 0) << 16) + ((g / length | 0) << 8) + (b / length | 0);
    rgb = this.gammaCorrect(rgb, 1.4);
    if (rgb === 0) {
      rgb = 1;
    }
    this.averageTextureRgb[id] = rgb;
    return rgb;
  }
  static pushTexture(id) {
    if (this.activeTexels[id] && this.texelPool) {
      this.texelPool[this.poolSize++] = this.activeTexels[id];
      this.activeTexels[id] = null;
    }
  }
  static getTexels(id) {
    this.textureCycle[id] = this.cycle++;
    if (this.activeTexels[id]) {
      return this.activeTexels[id];
    }
    let texels;
    if (this.poolSize > 0 && this.texelPool) {
      texels = this.texelPool[--this.poolSize];
      this.texelPool[this.poolSize] = null;
    } else {
      let cycle = 0;
      let selected = -1;
      for (let t = 0;t < this.textureCount; t++) {
        if (this.activeTexels[t] && (this.textureCycle[t] < cycle || selected === -1)) {
          cycle = this.textureCycle[t];
          selected = t;
        }
      }
      texels = this.activeTexels[selected];
      this.activeTexels[selected] = null;
    }
    this.activeTexels[id] = texels;
    const texture = this.textures[id];
    const palette = this.texPal[id];
    if (!texels || !texture || !palette) {
      return null;
    }
    if (this.lowMem) {
      this.textureTranslucent[id] = false;
      for (let i = 0;i < 4096; i++) {
        const rgb = texels[i] = palette[texture.data[i]] & 16316671;
        if (rgb === 0) {
          this.textureTranslucent[id] = true;
        }
        texels[i + 4096] = rgb - (rgb >>> 3) & 16316671;
        texels[i + 8192] = rgb - (rgb >>> 2) & 16316671;
        texels[i + 12288] = rgb - (rgb >>> 2) - (rgb >>> 3) & 16316671;
      }
    } else {
      if (texture.wi === 64) {
        for (let y = 0;y < 128; y++) {
          for (let x = 0;x < 128; x++) {
            texels[x + (y << 7 | 0)] = palette[texture.data[(x >> 1) + (y >> 1 << 6 | 0)]];
          }
        }
      } else {
        for (let i = 0;i < 16384; i++) {
          texels[i] = palette[texture.data[i]];
        }
      }
      this.textureTranslucent[id] = false;
      for (let i = 0;i < 16384; i++) {
        texels[i] &= 16316671;
        const rgb = texels[i];
        if (rgb === 0) {
          this.textureTranslucent[id] = true;
        }
        texels[i + 16384] = rgb - (rgb >>> 3) & 16316671;
        texels[i + 32768] = rgb - (rgb >>> 2) & 16316671;
        texels[i + 49152] = rgb - (rgb >>> 2) - (rgb >>> 3) & 16316671;
      }
    }
    return texels;
  }
  static initColourTable(brightness) {
    const randomBrightness = brightness + Math.random() * 0.03 - 0.015;
    let offset = 0;
    for (let y = 0;y < 512; y++) {
      const hue = (y / 8 | 0) / 64 + 0.0078125;
      const saturation = (y & 7) / 8 + 0.0625;
      for (let x = 0;x < 128; x++) {
        const lightness = x / 128;
        let r = lightness;
        let g = lightness;
        let b = lightness;
        if (saturation !== 0) {
          let q;
          if (lightness < 0.5) {
            q = lightness * (saturation + 1);
          } else {
            q = lightness + saturation - lightness * saturation;
          }
          const p = lightness * 2 - q;
          let t = hue + 0.3333333333333333;
          if (t > 1) {
            t--;
          }
          let d11 = hue - 0.3333333333333333;
          if (d11 < 0) {
            d11++;
          }
          if (t * 6 < 1) {
            r = p + (q - p) * 6 * t;
          } else if (t * 2 < 1) {
            r = q;
          } else if (t * 3 < 2) {
            r = p + (q - p) * (0.6666666666666666 - t) * 6;
          } else {
            r = p;
          }
          if (hue * 6 < 1) {
            g = p + (q - p) * 6 * hue;
          } else if (hue * 2 < 1) {
            g = q;
          } else if (hue * 3 < 2) {
            g = p + (q - p) * (0.6666666666666666 - hue) * 6;
          } else {
            g = p;
          }
          if (d11 * 6 < 1) {
            b = p + (q - p) * 6 * d11;
          } else if (d11 * 2 < 1) {
            b = q;
          } else if (d11 * 3 < 2) {
            b = p + (q - p) * (0.6666666666666666 - d11) * 6;
          } else {
            b = p;
          }
        }
        const intR = r * 256 | 0;
        const intG = g * 256 | 0;
        const intB = b * 256 | 0;
        const rgb = (intR << 16) + (intG << 8) + intB;
        this.colourTable[offset++] = this.gammaCorrect(rgb, randomBrightness);
      }
    }
    for (let id = 0;id < 50; id++) {
      const texture = this.textures[id];
      if (!texture) {
        continue;
      }
      const palette = texture.bpal;
      this.texPal[id] = new Int32Array(palette.length);
      for (let i = 0;i < palette.length; i++) {
        const texturePalette = this.texPal[id];
        if (!texturePalette) {
          continue;
        }
        texturePalette[i] = this.gammaCorrect(palette[i], randomBrightness);
      }
    }
    for (let id = 0;id < 50; id++) {
      this.pushTexture(id);
    }
  }
  static gammaCorrect(rgb, gamma) {
    const r = (rgb >> 16) / 256;
    const g = (rgb >> 8 & 255) / 256;
    const b = (rgb & 255) / 256;
    const powR = Math.pow(r, gamma);
    const powG = Math.pow(g, gamma);
    const powB = Math.pow(b, gamma);
    const intR = powR * 256 | 0;
    const intG = powG * 256 | 0;
    const intB = powB * 256 | 0;
    return (intR << 16) + (intG << 8) + intB;
  }
  static gouraudTriangle(xA, xB, xC, yA, yB, yC, colourA, colourB, colourC) {
    let xStepAB = 0;
    let colourStepAB = 0;
    if (yB !== yA) {
      xStepAB = (xB - xA << 16) / (yB - yA) | 0;
      colourStepAB = (colourB - colourA << 15) / (yB - yA) | 0;
    }
    let xStepBC = 0;
    let colourStepBC = 0;
    if (yC !== yB) {
      xStepBC = (xC - xB << 16) / (yC - yB) | 0;
      colourStepBC = (colourC - colourB << 15) / (yC - yB) | 0;
    }
    let xStepAC = 0;
    let colourStepAC = 0;
    if (yC !== yA) {
      xStepAC = (xA - xC << 16) / (yA - yC) | 0;
      colourStepAC = (colourA - colourC << 15) / (yA - yC) | 0;
    }
    if (yA <= yB && yA <= yC) {
      if (yA >= Pix2D.clipMaxY) {
        return;
      }
      if (yB > Pix2D.clipMaxY) {
        yB = Pix2D.clipMaxY;
      }
      if (yC > Pix2D.clipMaxY) {
        yC = Pix2D.clipMaxY;
      }
      if (yB < yC) {
        xC = xA <<= 16;
        colourC = colourA <<= 15;
        if (yA < 0) {
          xC -= xStepAC * yA;
          xA -= xStepAB * yA;
          colourC -= colourStepAC * yA;
          colourA -= colourStepAB * yA;
          yA = 0;
        }
        xB <<= 16;
        colourB <<= 15;
        if (yB < 0) {
          xB -= xStepBC * yB;
          colourB -= colourStepBC * yB;
          yB = 0;
        }
        if (yA !== yB && xStepAC < xStepAB || yA === yB && xStepAC > xStepBC) {
          yC -= yB;
          yB -= yA;
          yA = this.scanline[yA];
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.gouraudRaster(xC >> 16, xB >> 16, colourC >> 7, colourB >> 7, Pix2D.pixels, yA, 0);
                xC += xStepAC;
                xB += xStepBC;
                colourC += colourStepAC;
                colourB += colourStepBC;
                yA += Pix2D.width;
              }
            }
            this.gouraudRaster(xC >> 16, xA >> 16, colourC >> 7, colourA >> 7, Pix2D.pixels, yA, 0);
            xC += xStepAC;
            xA += xStepAB;
            colourC += colourStepAC;
            colourA += colourStepAB;
            yA += Pix2D.width;
          }
        } else {
          yC -= yB;
          yB -= yA;
          yA = this.scanline[yA];
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.gouraudRaster(xB >> 16, xC >> 16, colourB >> 7, colourC >> 7, Pix2D.pixels, yA, 0);
                xC += xStepAC;
                xB += xStepBC;
                colourC += colourStepAC;
                colourB += colourStepBC;
                yA += Pix2D.width;
              }
            }
            this.gouraudRaster(xA >> 16, xC >> 16, colourA >> 7, colourC >> 7, Pix2D.pixels, yA, 0);
            xC += xStepAC;
            xA += xStepAB;
            colourC += colourStepAC;
            colourA += colourStepAB;
            yA += Pix2D.width;
          }
        }
      } else {
        xB = xA <<= 16;
        colourB = colourA <<= 15;
        if (yA < 0) {
          xB -= xStepAC * yA;
          xA -= xStepAB * yA;
          colourB -= colourStepAC * yA;
          colourA -= colourStepAB * yA;
          yA = 0;
        }
        xC <<= 16;
        colourC <<= 15;
        if (yC < 0) {
          xC -= xStepBC * yC;
          colourC -= colourStepBC * yC;
          yC = 0;
        }
        if (yA !== yC && xStepAC < xStepAB || yA === yC && xStepBC > xStepAB) {
          yB -= yC;
          yC -= yA;
          yA = this.scanline[yA];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.gouraudRaster(xC >> 16, xA >> 16, colourC >> 7, colourA >> 7, Pix2D.pixels, yA, 0);
                xC += xStepBC;
                xA += xStepAB;
                colourC += colourStepBC;
                colourA += colourStepAB;
                yA += Pix2D.width;
              }
            }
            this.gouraudRaster(xB >> 16, xA >> 16, colourB >> 7, colourA >> 7, Pix2D.pixels, yA, 0);
            xB += xStepAC;
            xA += xStepAB;
            colourB += colourStepAC;
            colourA += colourStepAB;
            yA += Pix2D.width;
          }
        } else {
          yB -= yC;
          yC -= yA;
          yA = this.scanline[yA];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.gouraudRaster(xA >> 16, xC >> 16, colourA >> 7, colourC >> 7, Pix2D.pixels, yA, 0);
                xC += xStepBC;
                xA += xStepAB;
                colourC += colourStepBC;
                colourA += colourStepAB;
                yA += Pix2D.width;
              }
            }
            this.gouraudRaster(xA >> 16, xB >> 16, colourA >> 7, colourB >> 7, Pix2D.pixels, yA, 0);
            xB += xStepAC;
            xA += xStepAB;
            colourB += colourStepAC;
            colourA += colourStepAB;
            yA += Pix2D.width;
          }
        }
      }
    } else if (yB <= yC) {
      if (yB >= Pix2D.clipMaxY) {
        return;
      }
      if (yC > Pix2D.clipMaxY) {
        yC = Pix2D.clipMaxY;
      }
      if (yA > Pix2D.clipMaxY) {
        yA = Pix2D.clipMaxY;
      }
      if (yC < yA) {
        xA = xB <<= 16;
        colourA = colourB <<= 15;
        if (yB < 0) {
          xA -= xStepAB * yB;
          xB -= xStepBC * yB;
          colourA -= colourStepAB * yB;
          colourB -= colourStepBC * yB;
          yB = 0;
        }
        xC <<= 16;
        colourC <<= 15;
        if (yC < 0) {
          xC -= xStepAC * yC;
          colourC -= colourStepAC * yC;
          yC = 0;
        }
        if (yB !== yC && xStepAB < xStepBC || yB === yC && xStepAB > xStepAC) {
          yA -= yC;
          yC -= yB;
          yB = this.scanline[yB];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.gouraudRaster(xA >> 16, xC >> 16, colourA >> 7, colourC >> 7, Pix2D.pixels, yB, 0);
                xA += xStepAB;
                xC += xStepAC;
                colourA += colourStepAB;
                colourC += colourStepAC;
                yB += Pix2D.width;
              }
            }
            this.gouraudRaster(xA >> 16, xB >> 16, colourA >> 7, colourB >> 7, Pix2D.pixels, yB, 0);
            xA += xStepAB;
            xB += xStepBC;
            colourA += colourStepAB;
            colourB += colourStepBC;
            yB += Pix2D.width;
          }
        } else {
          yA -= yC;
          yC -= yB;
          yB = this.scanline[yB];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.gouraudRaster(xC >> 16, xA >> 16, colourC >> 7, colourA >> 7, Pix2D.pixels, yB, 0);
                xA += xStepAB;
                xC += xStepAC;
                colourA += colourStepAB;
                colourC += colourStepAC;
                yB += Pix2D.width;
              }
            }
            this.gouraudRaster(xB >> 16, xA >> 16, colourB >> 7, colourA >> 7, Pix2D.pixels, yB, 0);
            xA += xStepAB;
            xB += xStepBC;
            colourA += colourStepAB;
            colourB += colourStepBC;
            yB += Pix2D.width;
          }
        }
      } else {
        xC = xB <<= 16;
        colourC = colourB <<= 15;
        if (yB < 0) {
          xC -= xStepAB * yB;
          xB -= xStepBC * yB;
          colourC -= colourStepAB * yB;
          colourB -= colourStepBC * yB;
          yB = 0;
        }
        xA <<= 16;
        colourA <<= 15;
        if (yA < 0) {
          xA -= xStepAC * yA;
          colourA -= colourStepAC * yA;
          yA = 0;
        }
        yC -= yA;
        yA -= yB;
        yB = this.scanline[yB];
        if (xStepAB < xStepBC) {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.gouraudRaster(xA >> 16, xB >> 16, colourA >> 7, colourB >> 7, Pix2D.pixels, yB, 0);
                xA += xStepAC;
                xB += xStepBC;
                colourA += colourStepAC;
                colourB += colourStepBC;
                yB += Pix2D.width;
              }
            }
            this.gouraudRaster(xC >> 16, xB >> 16, colourC >> 7, colourB >> 7, Pix2D.pixels, yB, 0);
            xC += xStepAB;
            xB += xStepBC;
            colourC += colourStepAB;
            colourB += colourStepBC;
            yB += Pix2D.width;
          }
        } else {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.gouraudRaster(xB >> 16, xA >> 16, colourB >> 7, colourA >> 7, Pix2D.pixels, yB, 0);
                xA += xStepAC;
                xB += xStepBC;
                colourA += colourStepAC;
                colourB += colourStepBC;
                yB += Pix2D.width;
              }
            }
            this.gouraudRaster(xB >> 16, xC >> 16, colourB >> 7, colourC >> 7, Pix2D.pixels, yB, 0);
            xC += xStepAB;
            xB += xStepBC;
            colourC += colourStepAB;
            colourB += colourStepBC;
            yB += Pix2D.width;
          }
        }
      }
    } else {
      if (yC >= Pix2D.clipMaxY) {
        return;
      }
      if (yA > Pix2D.clipMaxY) {
        yA = Pix2D.clipMaxY;
      }
      if (yB > Pix2D.clipMaxY) {
        yB = Pix2D.clipMaxY;
      }
      if (yA < yB) {
        xB = xC <<= 16;
        colourB = colourC <<= 15;
        if (yC < 0) {
          xB -= xStepBC * yC;
          xC -= xStepAC * yC;
          colourB -= colourStepBC * yC;
          colourC -= colourStepAC * yC;
          yC = 0;
        }
        xA <<= 16;
        colourA <<= 15;
        if (yA < 0) {
          xA -= xStepAB * yA;
          colourA -= colourStepAB * yA;
          yA = 0;
        }
        yB -= yA;
        yA -= yC;
        yC = this.scanline[yC];
        if (xStepBC < xStepAC) {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.gouraudRaster(xB >> 16, xA >> 16, colourB >> 7, colourA >> 7, Pix2D.pixels, yC, 0);
                xB += xStepBC;
                xA += xStepAB;
                colourB += colourStepBC;
                colourA += colourStepAB;
                yC += Pix2D.width;
              }
            }
            this.gouraudRaster(xB >> 16, xC >> 16, colourB >> 7, colourC >> 7, Pix2D.pixels, yC, 0);
            xB += xStepBC;
            xC += xStepAC;
            colourB += colourStepBC;
            colourC += colourStepAC;
            yC += Pix2D.width;
          }
        } else {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.gouraudRaster(xA >> 16, xB >> 16, colourA >> 7, colourB >> 7, Pix2D.pixels, yC, 0);
                xB += xStepBC;
                xA += xStepAB;
                colourB += colourStepBC;
                colourA += colourStepAB;
                yC += Pix2D.width;
              }
            }
            this.gouraudRaster(xC >> 16, xB >> 16, colourC >> 7, colourB >> 7, Pix2D.pixels, yC, 0);
            xB += xStepBC;
            xC += xStepAC;
            colourB += colourStepBC;
            colourC += colourStepAC;
            yC += Pix2D.width;
          }
        }
      } else {
        xA = xC <<= 16;
        colourA = colourC <<= 15;
        if (yC < 0) {
          xA -= xStepBC * yC;
          xC -= xStepAC * yC;
          colourA -= colourStepBC * yC;
          colourC -= colourStepAC * yC;
          yC = 0;
        }
        xB <<= 16;
        colourB <<= 15;
        if (yB < 0) {
          xB -= xStepAB * yB;
          colourB -= colourStepAB * yB;
          yB = 0;
        }
        yA -= yB;
        yB -= yC;
        yC = this.scanline[yC];
        if (xStepBC < xStepAC) {
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.gouraudRaster(xB >> 16, xC >> 16, colourB >> 7, colourC >> 7, Pix2D.pixels, yC, 0);
                xB += xStepAB;
                xC += xStepAC;
                colourB += colourStepAB;
                colourC += colourStepAC;
                yC += Pix2D.width;
              }
            }
            this.gouraudRaster(xA >> 16, xC >> 16, colourA >> 7, colourC >> 7, Pix2D.pixels, yC, 0);
            xA += xStepBC;
            xC += xStepAC;
            colourA += colourStepBC;
            colourC += colourStepAC;
            yC += Pix2D.width;
          }
        } else {
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.gouraudRaster(xC >> 16, xB >> 16, colourC >> 7, colourB >> 7, Pix2D.pixels, yC, 0);
                xB += xStepAB;
                xC += xStepAC;
                colourB += colourStepAB;
                colourC += colourStepAC;
                yC += Pix2D.width;
              }
            }
            this.gouraudRaster(xC >> 16, xA >> 16, colourC >> 7, colourA >> 7, Pix2D.pixels, yC, 0);
            xA += xStepBC;
            xC += xStepAC;
            colourA += colourStepBC;
            colourC += colourStepAC;
            yC += Pix2D.width;
          }
        }
      }
    }
  }
  static gouraudRaster(xA, xB, colourA, colourB, dst, off, len) {
    let rgb;
    if (this.lowDetail) {
      let colourStep;
      if (this.hclip) {
        if (xB - xA > 3) {
          colourStep = (colourB - colourA) / (xB - xA) | 0;
        } else {
          colourStep = 0;
        }
        if (xB > Pix2D.sizeX) {
          xB = Pix2D.sizeX;
        }
        if (xA < 0) {
          colourA -= xA * colourStep;
          xA = 0;
        }
        if (xA >= xB) {
          return;
        }
        off += xA;
        len = xB - xA >> 2;
        colourStep <<= 2;
      } else if (xA < xB) {
        off += xA;
        len = xB - xA >> 2;
        if (len > 0) {
          colourStep = (colourB - colourA) * this.divTable[len] >> 15;
        } else {
          colourStep = 0;
        }
      } else {
        return;
      }
      if (this.trans === 0) {
        while (true) {
          len--;
          if (len < 0) {
            len = xB - xA & 3;
            if (len > 0) {
              rgb = this.colourTable[colourA >> 8];
              do {
                dst[off++] = rgb;
                len--;
              } while (len > 0);
              return;
            }
            break;
          }
          rgb = this.colourTable[colourA >> 8];
          colourA += colourStep;
          dst[off++] = rgb;
          dst[off++] = rgb;
          dst[off++] = rgb;
          dst[off++] = rgb;
        }
      } else {
        const alpha = this.trans;
        const invAlpha = 256 - this.trans;
        while (true) {
          len--;
          if (len < 0) {
            len = xB - xA & 3;
            if (len > 0) {
              rgb = this.colourTable[colourA >> 8];
              rgb = ((rgb & 16711935) * invAlpha >> 8 & 16711935) + ((rgb & 65280) * invAlpha >> 8 & 65280);
              do {
                dst[off++] = rgb + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
                len--;
              } while (len > 0);
            }
            break;
          }
          rgb = this.colourTable[colourA >> 8];
          colourA += colourStep;
          rgb = ((rgb & 16711935) * invAlpha >> 8 & 16711935) + ((rgb & 65280) * invAlpha >> 8 & 65280);
          dst[off++] = rgb + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
          dst[off++] = rgb + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
          dst[off++] = rgb + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
          dst[off++] = rgb + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
        }
      }
    } else if (xA < xB) {
      const colourStep = (colourB - colourA) / (xB - xA) | 0;
      if (this.hclip) {
        if (xB > Pix2D.sizeX) {
          xB = Pix2D.sizeX;
        }
        if (xA < 0) {
          colourA -= xA * colourStep;
          xA = 0;
        }
        if (xA >= xB) {
          return;
        }
      }
      off += xA;
      len = xB - xA;
      if (this.trans === 0) {
        do {
          dst[off++] = this.colourTable[colourA >> 8];
          colourA += colourStep;
          len--;
        } while (len > 0);
      } else {
        const alpha = this.trans;
        const invAlpha = 256 - this.trans;
        do {
          rgb = this.colourTable[colourA >> 8];
          colourA += colourStep;
          rgb = ((rgb & 16711935) * invAlpha >> 8 & 16711935) + ((rgb & 65280) * invAlpha >> 8 & 65280);
          dst[off++] = rgb + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
          len--;
        } while (len > 0);
      }
    }
  }
  static flatTriangle(xA, xB, xC, yA, yB, yC, colour) {
    let xStepAB = 0;
    if (yB !== yA) {
      xStepAB = (xB - xA << 16) / (yB - yA) | 0;
    }
    let xStepBC = 0;
    if (yC !== yB) {
      xStepBC = (xC - xB << 16) / (yC - yB) | 0;
    }
    let xStepAC = 0;
    if (yC !== yA) {
      xStepAC = (xA - xC << 16) / (yA - yC) | 0;
    }
    if (yA <= yB && yA <= yC) {
      if (yA >= Pix2D.clipMaxY) {
        return;
      }
      if (yB > Pix2D.clipMaxY) {
        yB = Pix2D.clipMaxY;
      }
      if (yC > Pix2D.clipMaxY) {
        yC = Pix2D.clipMaxY;
      }
      if (yB < yC) {
        xC = xA <<= 16;
        if (yA < 0) {
          xC -= xStepAC * yA;
          xA -= xStepAB * yA;
          yA = 0;
        }
        xB <<= 16;
        if (yB < 0) {
          xB -= xStepBC * yB;
          yB = 0;
        }
        if (yA !== yB && xStepAC < xStepAB || yA === yB && xStepAC > xStepBC) {
          yC -= yB;
          yB -= yA;
          yA = this.scanline[yA];
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.flatRaster(xC >> 16, xB >> 16, Pix2D.pixels, yA, colour);
                xC += xStepAC;
                xB += xStepBC;
                yA += Pix2D.width;
              }
            }
            this.flatRaster(xC >> 16, xA >> 16, Pix2D.pixels, yA, colour);
            xC += xStepAC;
            xA += xStepAB;
            yA += Pix2D.width;
          }
        } else {
          yC -= yB;
          yB -= yA;
          yA = this.scanline[yA];
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.flatRaster(xB >> 16, xC >> 16, Pix2D.pixels, yA, colour);
                xC += xStepAC;
                xB += xStepBC;
                yA += Pix2D.width;
              }
            }
            this.flatRaster(xA >> 16, xC >> 16, Pix2D.pixels, yA, colour);
            xC += xStepAC;
            xA += xStepAB;
            yA += Pix2D.width;
          }
        }
      } else {
        xB = xA <<= 16;
        if (yA < 0) {
          xB -= xStepAC * yA;
          xA -= xStepAB * yA;
          yA = 0;
        }
        xC <<= 16;
        if (yC < 0) {
          xC -= xStepBC * yC;
          yC = 0;
        }
        if (yA !== yC && xStepAC < xStepAB || yA === yC && xStepBC > xStepAB) {
          yB -= yC;
          yC -= yA;
          yA = this.scanline[yA];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.flatRaster(xC >> 16, xA >> 16, Pix2D.pixels, yA, colour);
                xC += xStepBC;
                xA += xStepAB;
                yA += Pix2D.width;
              }
            }
            this.flatRaster(xB >> 16, xA >> 16, Pix2D.pixels, yA, colour);
            xB += xStepAC;
            xA += xStepAB;
            yA += Pix2D.width;
          }
        } else {
          yB -= yC;
          yC -= yA;
          yA = this.scanline[yA];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.flatRaster(xA >> 16, xC >> 16, Pix2D.pixels, yA, colour);
                xC += xStepBC;
                xA += xStepAB;
                yA += Pix2D.width;
              }
            }
            this.flatRaster(xA >> 16, xB >> 16, Pix2D.pixels, yA, colour);
            xB += xStepAC;
            xA += xStepAB;
            yA += Pix2D.width;
          }
        }
      }
    } else if (yB <= yC) {
      if (yB >= Pix2D.clipMaxY) {
        return;
      }
      if (yC > Pix2D.clipMaxY) {
        yC = Pix2D.clipMaxY;
      }
      if (yA > Pix2D.clipMaxY) {
        yA = Pix2D.clipMaxY;
      }
      if (yC < yA) {
        xA = xB <<= 16;
        if (yB < 0) {
          xA -= xStepAB * yB;
          xB -= xStepBC * yB;
          yB = 0;
        }
        xC <<= 16;
        if (yC < 0) {
          xC -= xStepAC * yC;
          yC = 0;
        }
        if (yB !== yC && xStepAB < xStepBC || yB === yC && xStepAB > xStepAC) {
          yA -= yC;
          yC -= yB;
          yB = this.scanline[yB];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.flatRaster(xA >> 16, xC >> 16, Pix2D.pixels, yB, colour);
                xA += xStepAB;
                xC += xStepAC;
                yB += Pix2D.width;
              }
            }
            this.flatRaster(xA >> 16, xB >> 16, Pix2D.pixels, yB, colour);
            xA += xStepAB;
            xB += xStepBC;
            yB += Pix2D.width;
          }
        } else {
          yA -= yC;
          yC -= yB;
          yB = this.scanline[yB];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.flatRaster(xC >> 16, xA >> 16, Pix2D.pixels, yB, colour);
                xA += xStepAB;
                xC += xStepAC;
                yB += Pix2D.width;
              }
            }
            this.flatRaster(xB >> 16, xA >> 16, Pix2D.pixels, yB, colour);
            xA += xStepAB;
            xB += xStepBC;
            yB += Pix2D.width;
          }
        }
      } else {
        xC = xB <<= 16;
        if (yB < 0) {
          xC -= xStepAB * yB;
          xB -= xStepBC * yB;
          yB = 0;
        }
        xA <<= 16;
        if (yA < 0) {
          xA -= xStepAC * yA;
          yA = 0;
        }
        yC -= yA;
        yA -= yB;
        yB = this.scanline[yB];
        if (xStepAB < xStepBC) {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.flatRaster(xA >> 16, xB >> 16, Pix2D.pixels, yB, colour);
                xA += xStepAC;
                xB += xStepBC;
                yB += Pix2D.width;
              }
            }
            this.flatRaster(xC >> 16, xB >> 16, Pix2D.pixels, yB, colour);
            xC += xStepAB;
            xB += xStepBC;
            yB += Pix2D.width;
          }
        } else {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.flatRaster(xB >> 16, xA >> 16, Pix2D.pixels, yB, colour);
                xA += xStepAC;
                xB += xStepBC;
                yB += Pix2D.width;
              }
            }
            this.flatRaster(xB >> 16, xC >> 16, Pix2D.pixels, yB, colour);
            xC += xStepAB;
            xB += xStepBC;
            yB += Pix2D.width;
          }
        }
      }
    } else {
      if (yC >= Pix2D.clipMaxY) {
        return;
      }
      if (yA > Pix2D.clipMaxY) {
        yA = Pix2D.clipMaxY;
      }
      if (yB > Pix2D.clipMaxY) {
        yB = Pix2D.clipMaxY;
      }
      if (yA < yB) {
        xB = xC <<= 16;
        if (yC < 0) {
          xB -= xStepBC * yC;
          xC -= xStepAC * yC;
          yC = 0;
        }
        xA <<= 16;
        if (yA < 0) {
          xA -= xStepAB * yA;
          yA = 0;
        }
        yB -= yA;
        yA -= yC;
        yC = this.scanline[yC];
        if (xStepBC < xStepAC) {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.flatRaster(xB >> 16, xA >> 16, Pix2D.pixels, yC, colour);
                xB += xStepBC;
                xA += xStepAB;
                yC += Pix2D.width;
              }
            }
            this.flatRaster(xB >> 16, xC >> 16, Pix2D.pixels, yC, colour);
            xB += xStepBC;
            xC += xStepAC;
            yC += Pix2D.width;
          }
        } else {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.flatRaster(xA >> 16, xB >> 16, Pix2D.pixels, yC, colour);
                xB += xStepBC;
                xA += xStepAB;
                yC += Pix2D.width;
              }
            }
            this.flatRaster(xC >> 16, xB >> 16, Pix2D.pixels, yC, colour);
            xB += xStepBC;
            xC += xStepAC;
            yC += Pix2D.width;
          }
        }
      } else {
        xA = xC <<= 16;
        if (yC < 0) {
          xA -= xStepBC * yC;
          xC -= xStepAC * yC;
          yC = 0;
        }
        xB <<= 16;
        if (yB < 0) {
          xB -= xStepAB * yB;
          yB = 0;
        }
        yA -= yB;
        yB -= yC;
        yC = this.scanline[yC];
        if (xStepBC < xStepAC) {
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.flatRaster(xB >> 16, xC >> 16, Pix2D.pixels, yC, colour);
                xB += xStepAB;
                xC += xStepAC;
                yC += Pix2D.width;
              }
            }
            this.flatRaster(xA >> 16, xC >> 16, Pix2D.pixels, yC, colour);
            xA += xStepBC;
            xC += xStepAC;
            yC += Pix2D.width;
          }
        } else {
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.flatRaster(xC >> 16, xB >> 16, Pix2D.pixels, yC, colour);
                xB += xStepAB;
                xC += xStepAC;
                yC += Pix2D.width;
              }
            }
            this.flatRaster(xC >> 16, xA >> 16, Pix2D.pixels, yC, colour);
            xA += xStepBC;
            xC += xStepAC;
            yC += Pix2D.width;
          }
        }
      }
    }
  }
  static flatRaster(xA, xB, dst, off, colour) {
    if (this.hclip) {
      if (xB > Pix2D.sizeX) {
        xB = Pix2D.sizeX;
      }
      if (xA < 0) {
        xA = 0;
      }
    }
    if (xA >= xB) {
      return;
    }
    off += xA;
    let len = xB - xA >> 2;
    if (this.trans === 0) {
      while (true) {
        len--;
        if (len < 0) {
          len = xB - xA & 3;
          while (true) {
            len--;
            if (len < 0) {
              return;
            }
            dst[off++] = colour;
          }
        }
        dst[off++] = colour;
        dst[off++] = colour;
        dst[off++] = colour;
        dst[off++] = colour;
      }
    } else {
      const alpha = this.trans;
      const invAlpha = 256 - this.trans;
      colour = ((colour & 16711935) * invAlpha >> 8 & 16711935) + ((colour & 65280) * invAlpha >> 8 & 65280);
      while (true) {
        len--;
        if (len < 0) {
          len = xB - xA & 3;
          while (true) {
            len--;
            if (len < 0) {
              return;
            }
            dst[off++] = colour + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
          }
        }
        dst[off++] = colour + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
        dst[off++] = colour + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
        dst[off++] = colour + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
        dst[off++] = colour + ((dst[off] & 16711935) * alpha >> 8 & 16711935) + ((dst[off] & 65280) * alpha >> 8 & 65280);
      }
    }
  }
  static textureTriangle(xA, xB, xC, yA, yB, yC, shadeA, shadeB, shadeC, originX, originY, originZ, txB, txC, tyB, tyC, tzB, tzC, texture) {
    const texels = this.getTexels(texture);
    this.opaque = !this.textureTranslucent[texture];
    const verticalX = originX - txB;
    const verticalY = originY - tyB;
    const verticalZ = originZ - tzB;
    const horizontalX = txC - originX;
    const horizontalY = tyC - originY;
    const horizontalZ = tzC - originZ;
    let u = horizontalX * originY - horizontalY * originX << 14;
    const uStride = horizontalY * originZ - horizontalZ * originY << 8;
    const uStepVertical = horizontalZ * originX - horizontalX * originZ << 5;
    let v = verticalX * originY - verticalY * originX << 14;
    const vStride = verticalY * originZ - verticalZ * originY << 8;
    const vStepVertical = verticalZ * originX - verticalX * originZ << 5;
    let w = verticalY * horizontalX - verticalX * horizontalY << 14;
    const wStride = verticalZ * horizontalY - verticalY * horizontalZ << 8;
    const wStepVertical = verticalX * horizontalZ - verticalZ * horizontalX << 5;
    let xStepAB = 0;
    let shadeStepAB = 0;
    if (yB !== yA) {
      xStepAB = (xB - xA << 16) / (yB - yA) | 0;
      shadeStepAB = (shadeB - shadeA << 16) / (yB - yA) | 0;
    }
    let xStepBC = 0;
    let shadeStepBC = 0;
    if (yC !== yB) {
      xStepBC = (xC - xB << 16) / (yC - yB) | 0;
      shadeStepBC = (shadeC - shadeB << 16) / (yC - yB) | 0;
    }
    let xStepAC = 0;
    let shadeStepAC = 0;
    if (yC !== yA) {
      xStepAC = (xA - xC << 16) / (yA - yC) | 0;
      shadeStepAC = (shadeA - shadeC << 16) / (yA - yC) | 0;
    }
    if (yA <= yB && yA <= yC) {
      if (yA >= Pix2D.clipMaxY) {
        return;
      }
      if (yB > Pix2D.clipMaxY) {
        yB = Pix2D.clipMaxY;
      }
      if (yC > Pix2D.clipMaxY) {
        yC = Pix2D.clipMaxY;
      }
      if (yB < yC) {
        xC = xA <<= 16;
        shadeC = shadeA <<= 16;
        if (yA < 0) {
          xC -= xStepAC * yA;
          xA -= xStepAB * yA;
          shadeC -= shadeStepAC * yA;
          shadeA -= shadeStepAB * yA;
          yA = 0;
        }
        xB <<= 16;
        shadeB <<= 16;
        if (yB < 0) {
          xB -= xStepBC * yB;
          shadeB -= shadeStepBC * yB;
          yB = 0;
        }
        const dy = yA - this.originY;
        u += uStepVertical * dy;
        v += vStepVertical * dy;
        w += wStepVertical * dy;
        u |= 0;
        v |= 0;
        w |= 0;
        if (yA !== yB && xStepAC < xStepAB || yA === yB && xStepAC > xStepBC) {
          yC -= yB;
          yB -= yA;
          yA = this.scanline[yA];
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.textureRaster(xC >> 16, xB >> 16, Pix2D.pixels, yA, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeC >> 8, shadeB >> 8);
                xC += xStepAC;
                xB += xStepBC;
                shadeC += shadeStepAC;
                shadeB += shadeStepBC;
                yA += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xC >> 16, xA >> 16, Pix2D.pixels, yA, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeC >> 8, shadeA >> 8);
            xC += xStepAC;
            xA += xStepAB;
            shadeC += shadeStepAC;
            shadeA += shadeStepAB;
            yA += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        } else {
          yC -= yB;
          yB -= yA;
          yA = this.scanline[yA];
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.textureRaster(xB >> 16, xC >> 16, Pix2D.pixels, yA, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeB >> 8, shadeC >> 8);
                xC += xStepAC;
                xB += xStepBC;
                shadeC += shadeStepAC;
                shadeB += shadeStepBC;
                yA += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xA >> 16, xC >> 16, Pix2D.pixels, yA, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeA >> 8, shadeC >> 8);
            xC += xStepAC;
            xA += xStepAB;
            shadeC += shadeStepAC;
            shadeA += shadeStepAB;
            yA += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        }
      } else {
        xB = xA <<= 16;
        shadeB = shadeA <<= 16;
        if (yA < 0) {
          xB -= xStepAC * yA;
          xA -= xStepAB * yA;
          shadeB -= shadeStepAC * yA;
          shadeA -= shadeStepAB * yA;
          yA = 0;
        }
        xC <<= 16;
        shadeC <<= 16;
        if (yC < 0) {
          xC -= xStepBC * yC;
          shadeC -= shadeStepBC * yC;
          yC = 0;
        }
        const dy = yA - this.originY;
        u += uStepVertical * dy;
        v += vStepVertical * dy;
        w += wStepVertical * dy;
        u |= 0;
        v |= 0;
        w |= 0;
        if ((yA === yC || xStepAC >= xStepAB) && (yA !== yC || xStepBC <= xStepAB)) {
          yB -= yC;
          yC -= yA;
          yA = this.scanline[yA];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.textureRaster(xA >> 16, xC >> 16, Pix2D.pixels, yA, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeA >> 8, shadeC >> 8);
                xC += xStepBC;
                xA += xStepAB;
                shadeC += shadeStepBC;
                shadeA += shadeStepAB;
                yA += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xA >> 16, xB >> 16, Pix2D.pixels, yA, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeA >> 8, shadeB >> 8);
            xB += xStepAC;
            xA += xStepAB;
            shadeB += shadeStepAC;
            shadeA += shadeStepAB;
            yA += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        } else {
          yB -= yC;
          yC -= yA;
          yA = this.scanline[yA];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.textureRaster(xC >> 16, xA >> 16, Pix2D.pixels, yA, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeC >> 8, shadeA >> 8);
                xC += xStepBC;
                xA += xStepAB;
                shadeC += shadeStepBC;
                shadeA += shadeStepAB;
                yA += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xB >> 16, xA >> 16, Pix2D.pixels, yA, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeB >> 8, shadeA >> 8);
            xB += xStepAC;
            xA += xStepAB;
            shadeB += shadeStepAC;
            shadeA += shadeStepAB;
            yA += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        }
      }
    } else if (yB <= yC) {
      if (yB >= Pix2D.clipMaxY) {
        return;
      }
      if (yC > Pix2D.clipMaxY) {
        yC = Pix2D.clipMaxY;
      }
      if (yA > Pix2D.clipMaxY) {
        yA = Pix2D.clipMaxY;
      }
      if (yC < yA) {
        xA = xB <<= 16;
        shadeA = shadeB <<= 16;
        if (yB < 0) {
          xA -= xStepAB * yB;
          xB -= xStepBC * yB;
          shadeA -= shadeStepAB * yB;
          shadeB -= shadeStepBC * yB;
          yB = 0;
        }
        xC <<= 16;
        shadeC <<= 16;
        if (yC < 0) {
          xC -= xStepAC * yC;
          shadeC -= shadeStepAC * yC;
          yC = 0;
        }
        const dy = yB - this.originY;
        u += uStepVertical * dy;
        v += vStepVertical * dy;
        w += wStepVertical * dy;
        u |= 0;
        v |= 0;
        w |= 0;
        if (yB !== yC && xStepAB < xStepBC || yB === yC && xStepAB > xStepAC) {
          yA -= yC;
          yC -= yB;
          yB = this.scanline[yB];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.textureRaster(xA >> 16, xC >> 16, Pix2D.pixels, yB, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeA >> 8, shadeC >> 8);
                xA += xStepAB;
                xC += xStepAC;
                shadeA += shadeStepAB;
                shadeC += shadeStepAC;
                yB += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xA >> 16, xB >> 16, Pix2D.pixels, yB, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeA >> 8, shadeB >> 8);
            xA += xStepAB;
            xB += xStepBC;
            shadeA += shadeStepAB;
            shadeB += shadeStepBC;
            yB += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        } else {
          yA -= yC;
          yC -= yB;
          yB = this.scanline[yB];
          while (true) {
            yC--;
            if (yC < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.textureRaster(xC >> 16, xA >> 16, Pix2D.pixels, yB, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeC >> 8, shadeA >> 8);
                xA += xStepAB;
                xC += xStepAC;
                shadeA += shadeStepAB;
                shadeC += shadeStepAC;
                yB += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xB >> 16, xA >> 16, Pix2D.pixels, yB, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeB >> 8, shadeA >> 8);
            xA += xStepAB;
            xB += xStepBC;
            shadeA += shadeStepAB;
            shadeB += shadeStepBC;
            yB += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        }
      } else {
        xC = xB <<= 16;
        shadeC = shadeB <<= 16;
        if (yB < 0) {
          xC -= xStepAB * yB;
          xB -= xStepBC * yB;
          shadeC -= shadeStepAB * yB;
          shadeB -= shadeStepBC * yB;
          yB = 0;
        }
        xA <<= 16;
        shadeA <<= 16;
        if (yA < 0) {
          xA -= xStepAC * yA;
          shadeA -= shadeStepAC * yA;
          yA = 0;
        }
        const dy = yB - this.originY;
        u += uStepVertical * dy;
        v += vStepVertical * dy;
        w += wStepVertical * dy;
        u |= 0;
        v |= 0;
        w |= 0;
        yC -= yA;
        yA -= yB;
        yB = this.scanline[yB];
        if (xStepAB < xStepBC) {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.textureRaster(xA >> 16, xB >> 16, Pix2D.pixels, yB, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeA >> 8, shadeB >> 8);
                xA += xStepAC;
                xB += xStepBC;
                shadeA += shadeStepAC;
                shadeB += shadeStepBC;
                yB += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xC >> 16, xB >> 16, Pix2D.pixels, yB, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeC >> 8, shadeB >> 8);
            xC += xStepAB;
            xB += xStepBC;
            shadeC += shadeStepAB;
            shadeB += shadeStepBC;
            yB += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        } else {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yC--;
                if (yC < 0) {
                  return;
                }
                this.textureRaster(xB >> 16, xA >> 16, Pix2D.pixels, yB, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeB >> 8, shadeA >> 8);
                xA += xStepAC;
                xB += xStepBC;
                shadeA += shadeStepAC;
                shadeB += shadeStepBC;
                yB += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xB >> 16, xC >> 16, Pix2D.pixels, yB, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeB >> 8, shadeC >> 8);
            xC += xStepAB;
            xB += xStepBC;
            shadeC += shadeStepAB;
            shadeB += shadeStepBC;
            yB += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        }
      }
    } else {
      if (yC >= Pix2D.clipMaxY) {
        return;
      }
      if (yA > Pix2D.clipMaxY) {
        yA = Pix2D.clipMaxY;
      }
      if (yB > Pix2D.clipMaxY) {
        yB = Pix2D.clipMaxY;
      }
      if (yA < yB) {
        xB = xC <<= 16;
        shadeB = shadeC <<= 16;
        if (yC < 0) {
          xB -= xStepBC * yC;
          xC -= xStepAC * yC;
          shadeB -= shadeStepBC * yC;
          shadeC -= shadeStepAC * yC;
          yC = 0;
        }
        xA <<= 16;
        shadeA <<= 16;
        if (yA < 0) {
          xA -= xStepAB * yA;
          shadeA -= shadeStepAB * yA;
          yA = 0;
        }
        const dy = yC - this.originY;
        u += uStepVertical * dy;
        v += vStepVertical * dy;
        w += wStepVertical * dy;
        u |= 0;
        v |= 0;
        w |= 0;
        yB -= yA;
        yA -= yC;
        yC = this.scanline[yC];
        if (xStepBC < xStepAC) {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.textureRaster(xB >> 16, xA >> 16, Pix2D.pixels, yC, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeB >> 8, shadeA >> 8);
                xB += xStepBC;
                xA += xStepAB;
                shadeB += shadeStepBC;
                shadeA += shadeStepAB;
                yC += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xB >> 16, xC >> 16, Pix2D.pixels, yC, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeB >> 8, shadeC >> 8);
            xB += xStepBC;
            xC += xStepAC;
            shadeB += shadeStepBC;
            shadeC += shadeStepAC;
            yC += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        } else {
          while (true) {
            yA--;
            if (yA < 0) {
              while (true) {
                yB--;
                if (yB < 0) {
                  return;
                }
                this.textureRaster(xA >> 16, xB >> 16, Pix2D.pixels, yC, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeA >> 8, shadeB >> 8);
                xB += xStepBC;
                xA += xStepAB;
                shadeB += shadeStepBC;
                shadeA += shadeStepAB;
                yC += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xC >> 16, xB >> 16, Pix2D.pixels, yC, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeC >> 8, shadeB >> 8);
            xB += xStepBC;
            xC += xStepAC;
            shadeB += shadeStepBC;
            shadeC += shadeStepAC;
            yC += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        }
      } else {
        xA = xC <<= 16;
        shadeA = shadeC <<= 16;
        if (yC < 0) {
          xA -= xStepBC * yC;
          xC -= xStepAC * yC;
          shadeA -= shadeStepBC * yC;
          shadeC -= shadeStepAC * yC;
          yC = 0;
        }
        xB <<= 16;
        shadeB <<= 16;
        if (yB < 0) {
          xB -= xStepAB * yB;
          shadeB -= shadeStepAB * yB;
          yB = 0;
        }
        const dy = yC - this.originY;
        u += uStepVertical * dy;
        v += vStepVertical * dy;
        w += wStepVertical * dy;
        u |= 0;
        v |= 0;
        w |= 0;
        yA -= yB;
        yB -= yC;
        yC = this.scanline[yC];
        if (xStepBC < xStepAC) {
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.textureRaster(xB >> 16, xC >> 16, Pix2D.pixels, yC, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeB >> 8, shadeC >> 8);
                xB += xStepAB;
                xC += xStepAC;
                shadeB += shadeStepAB;
                shadeC += shadeStepAC;
                yC += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xA >> 16, xC >> 16, Pix2D.pixels, yC, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeA >> 8, shadeC >> 8);
            xA += xStepBC;
            xC += xStepAC;
            shadeA += shadeStepBC;
            shadeC += shadeStepAC;
            yC += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        } else {
          while (true) {
            yB--;
            if (yB < 0) {
              while (true) {
                yA--;
                if (yA < 0) {
                  return;
                }
                this.textureRaster(xC >> 16, xB >> 16, Pix2D.pixels, yC, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeC >> 8, shadeB >> 8);
                xB += xStepAB;
                xC += xStepAC;
                shadeB += shadeStepAB;
                shadeC += shadeStepAC;
                yC += Pix2D.width;
                u += uStepVertical;
                v += vStepVertical;
                w += wStepVertical;
                u |= 0;
                v |= 0;
                w |= 0;
              }
            }
            this.textureRaster(xC >> 16, xA >> 16, Pix2D.pixels, yC, texels, 0, 0, u, v, w, uStride, vStride, wStride, shadeC >> 8, shadeA >> 8);
            xA += xStepBC;
            xC += xStepAC;
            shadeA += shadeStepBC;
            shadeC += shadeStepAC;
            yC += Pix2D.width;
            u += uStepVertical;
            v += vStepVertical;
            w += wStepVertical;
            u |= 0;
            v |= 0;
            w |= 0;
          }
        }
      }
    }
  }
  static textureRaster(xA, xB, dst, off, texels, curU, curV, u, v, w, uStride, vStride, wStride, shadeA, shadeB) {
    if (!texels) {
      return;
    }
    if (xA >= xB) {
      return;
    }
    let shadeStrides;
    let strides;
    if (this.hclip) {
      shadeStrides = (shadeB - shadeA) / (xB - xA) | 0;
      if (xB > Pix2D.sizeX) {
        xB = Pix2D.sizeX;
      }
      if (xA < 0) {
        shadeA -= xA * shadeStrides;
        xA = 0;
      }
      if (xA >= xB) {
        return;
      }
      strides = xB - xA >> 3;
      shadeStrides <<= 12;
    } else {
      if (xB - xA > 7) {
        strides = xB - xA >> 3;
        shadeStrides = (shadeB - shadeA) * this.divTable[strides] >> 6;
      } else {
        strides = 0;
        shadeStrides = 0;
      }
    }
    shadeA <<= 9;
    off += xA;
    let nextU;
    let nextV;
    let curW;
    let dx;
    let stepU;
    let stepV;
    let shadeShift;
    if (this.lowMem) {
      nextU = 0;
      nextV = 0;
      dx = xA - this.originX;
      u = u + (uStride >> 3) * dx;
      v = v + (vStride >> 3) * dx;
      w = w + (wStride >> 3) * dx;
      u |= 0;
      v |= 0;
      w |= 0;
      curW = w >> 12;
      if (curW !== 0) {
        curU = u / curW | 0;
        curV = v / curW | 0;
        if (curU < 0) {
          curU = 0;
        } else if (curU > 4032) {
          curU = 4032;
        }
      }
      u = u + uStride;
      v = v + vStride;
      w = w + wStride;
      u |= 0;
      v |= 0;
      w |= 0;
      curW = w >> 12;
      if (curW !== 0) {
        nextU = u / curW | 0;
        nextV = v / curW | 0;
        if (nextU < 7) {
          nextU = 7;
        } else if (nextU > 4032) {
          nextU = 4032;
        }
      }
      stepU = nextU - curU >> 3;
      stepV = nextV - curV >> 3;
      curU += shadeA >> 3 & 786432;
      shadeShift = shadeA >> 23;
      if (this.opaque) {
        while (strides-- > 0) {
          dst[off++] = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift;
          curU = nextU;
          curV = nextV;
          u += uStride;
          v += vStride;
          w += wStride;
          u |= 0;
          v |= 0;
          w |= 0;
          curW = w >> 12;
          if (curW !== 0) {
            nextU = u / curW | 0;
            nextV = v / curW | 0;
            if (nextU < 7) {
              nextU = 7;
            } else if (nextU > 4032) {
              nextU = 4032;
            }
          }
          stepU = nextU - curU >> 3;
          stepV = nextV - curV >> 3;
          shadeA += shadeStrides;
          curU += shadeA >> 3 & 786432;
          shadeShift = shadeA >> 23;
        }
        strides = xB - xA & 7;
        while (strides-- > 0) {
          dst[off++] = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
        }
      } else {
        while (strides-- > 0) {
          let rgb;
          if ((rgb = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU = nextU;
          curV = nextV;
          u += uStride;
          v += vStride;
          w += wStride;
          u |= 0;
          v |= 0;
          w |= 0;
          curW = w >> 12;
          if (curW !== 0) {
            nextU = u / curW | 0;
            nextV = v / curW | 0;
            if (nextU < 7) {
              nextU = 7;
            } else if (nextU > 4032) {
              nextU = 4032;
            }
          }
          stepU = nextU - curU >> 3;
          stepV = nextV - curV >> 3;
          shadeA += shadeStrides;
          curU += shadeA >> 3 & 786432;
          shadeShift = shadeA >> 23;
        }
        strides = xB - xA & 7;
        while (strides-- > 0) {
          let rgb;
          if ((rgb = texels[(curV & 4032) + (curU >> 6)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
        }
      }
    } else {
      nextU = 0;
      nextV = 0;
      dx = xA - this.originX;
      u = u + (uStride >> 3) * dx;
      v = v + (vStride >> 3) * dx;
      w = w + (wStride >> 3) * dx;
      u |= 0;
      v |= 0;
      w |= 0;
      curW = w >> 14;
      if (curW !== 0) {
        curU = u / curW | 0;
        curV = v / curW | 0;
        if (curU < 0) {
          curU = 0;
        } else if (curU > 16256) {
          curU = 16256;
        }
      }
      u = u + uStride;
      v = v + vStride;
      w = w + wStride;
      u |= 0;
      v |= 0;
      w |= 0;
      curW = w >> 14;
      if (curW !== 0) {
        nextU = u / curW | 0;
        nextV = v / curW | 0;
        if (nextU < 7) {
          nextU = 7;
        } else if (nextU > 16256) {
          nextU = 16256;
        }
      }
      stepU = nextU - curU >> 3;
      stepV = nextV - curV >> 3;
      curU += shadeA & 6291456;
      shadeShift = shadeA >> 23;
      if (this.opaque) {
        while (strides-- > 0) {
          dst[off++] = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
          dst[off++] = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift;
          curU = nextU;
          curV = nextV;
          u += uStride;
          v += vStride;
          w += wStride;
          u |= 0;
          v |= 0;
          w |= 0;
          curW = w >> 14;
          if (curW !== 0) {
            nextU = u / curW | 0;
            nextV = v / curW | 0;
            if (nextU < 7) {
              nextU = 7;
            } else if (nextU > 16256) {
              nextU = 16256;
            }
          }
          stepU = nextU - curU >> 3;
          stepV = nextV - curV >> 3;
          shadeA += shadeStrides;
          curU += shadeA & 6291456;
          shadeShift = shadeA >> 23;
        }
        strides = xB - xA & 7;
        while (strides-- > 0) {
          dst[off++] = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift;
          curU += stepU;
          curV += stepV;
        }
      } else {
        while (strides-- > 0 && texels) {
          let rgb;
          if ((rgb = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
          if ((rgb = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU = nextU;
          curV = nextV;
          u += uStride;
          v += vStride;
          w += wStride;
          u |= 0;
          v |= 0;
          w |= 0;
          curW = w >> 14;
          if (curW !== 0) {
            nextU = u / curW | 0;
            nextV = v / curW | 0;
            if (nextU < 7) {
              nextU = 7;
            } else if (nextU > 16256) {
              nextU = 16256;
            }
          }
          stepU = nextU - curU >> 3;
          stepV = nextV - curV >> 3;
          shadeA += shadeStrides;
          curU += shadeA & 6291456;
          shadeShift = shadeA >> 23;
        }
        strides = xB - xA & 7;
        while (strides-- > 0 && texels) {
          let rgb;
          if ((rgb = texels[(curV & 16256) + (curU >> 7)] >>> shadeShift) !== 0) {
            dst[off] = rgb;
          }
          off++;
          curU += stepU;
          curV += stepV;
        }
      }
    }
  }
}

// src/graphics/PixMap.ts
class PixMap {
  data;
  width;
  height;
  img;
  ctx;
  paint;
  constructor(width, height, ctx = canvas2d) {
    this.width = width;
    this.height = height;
    this.data = new Int32Array(width * height);
    this.ctx = ctx;
    this.img = this.ctx.createImageData(width, height);
    this.paint = new Uint32Array(this.img.data.buffer);
    this.setPixels();
  }
  setPixels() {
    Pix2D.setPixels(this.data, this.width, this.height);
  }
  draw(x, y) {
    this.prepareCanvas();
    this.ctx.putImageData(this.img, x, y);
  }
  prepareCanvas() {
    const data = this.data;
    const paint = this.paint;
    const len = data.length;
    let i = 0;
    const unroll = len - len % 4;
    for (;i < unroll; i += 4) {
      const p0 = data[i];
      const p1 = data[i + 1];
      const p2 = data[i + 2];
      const p3 = data[i + 3];
      paint[i] = (p0 & 16711680) >> 16 | p0 & 65280 | (p0 & 255) << 16 | 4278190080;
      paint[i + 1] = (p1 & 16711680) >> 16 | p1 & 65280 | (p1 & 255) << 16 | 4278190080;
      paint[i + 2] = (p2 & 16711680) >> 16 | p2 & 65280 | (p2 & 255) << 16 | 4278190080;
      paint[i + 3] = (p3 & 16711680) >> 16 | p3 & 65280 | (p3 & 255) << 16 | 4278190080;
    }
    for (;i < len; i++) {
      const pixel = data[i];
      paint[i] = (pixel & 16711680) >> 16 | pixel & 65280 | (pixel & 255) << 16 | 4278190080;
    }
  }
}

// src/client/GameShell.ts
class GameShell {
  state = 0;
  deltime = 20;
  mindel = 1;
  otim = new Array(10);
  fps = 0;
  debug = false;
  drawArea = null;
  redrawScreen = true;
  focus = true;
  idleTimer = performance.now();
  mouseButton = 0;
  mouseX = -1;
  mouseY = -1;
  nextMouseClickButton = 0;
  nextMouseClickX = -1;
  nextMouseClickY = -1;
  mouseClickButton = 0;
  mouseClickX = -1;
  mouseClickY = -1;
  nextMouseClickTime = 0;
  mouseClickTime = 0;
  keyHeld = [];
  keyQueue = [];
  keyQueueReadPos = 0;
  keyQueueWritePos = 0;
  resizeToFit = false;
  tfps = 50;
  async maininit() {}
  async mainloop() {}
  async maindraw() {}
  refresh() {}
  constructor(resizetoFit = false) {
    canvas.tabIndex = -1;
    canvas2d.fillStyle = "black";
    canvas2d.fillRect(0, 0, canvas.width, canvas.height);
    this.resizeToFit = resizetoFit;
    if (this.resizeToFit) {
      this.resize(window.innerWidth, window.innerHeight);
    } else {
      this.resize(canvas.width, canvas.height);
    }
  }
  get sWid() {
    return canvas.width;
  }
  get sHei() {
    return canvas.height;
  }
  resize(width, height) {
    canvas.width = width;
    canvas.height = height;
    this.drawArea = new PixMap(width, height);
    Pix3D.setRenderClipping();
  }
  async run() {
    canvas.addEventListener("resize", () => {
      if (this.resizeToFit) {
        this.resize(window.innerWidth, window.innerHeight);
      }
    }, false);
    canvas.onfocus = this.onfocus.bind(this);
    canvas.onblur = this.onblur.bind(this);
    canvas.onkeydown = this.onkeydown.bind(this);
    canvas.onkeyup = this.onkeyup.bind(this);
    canvas.onmousedown = this.onmousedown.bind(this);
    canvas.onpointerdown = this.onpointerdown.bind(this);
    canvas.onmouseup = this.onmouseup.bind(this);
    canvas.onpointerup = this.onpointerup.bind(this);
    canvas.onpointerenter = this.onpointerenter.bind(this);
    canvas.onpointerleave = this.onpointerleave.bind(this);
    canvas.onpointermove = this.onpointermove.bind(this);
    window.onmouseup = this.windowMouseUp.bind(this);
    window.onmousemove = this.windowMouseMove.bind(this);
    if (this.isTouchDevice) {
      if (this.hasTouchEvents) {
        canvas.ontouchstart = this.ontouchstart.bind(this);
      } else {
        canvas.style.touchAction = "none";
      }
    }
    canvas.oncontextmenu = (e) => {
      e.preventDefault();
    };
    window.oncontextmenu = (e) => {
      e.preventDefault();
    };
    await this.messageBox("Loading...", 0);
    await this.maininit();
    let ntime = 0;
    let opos = 0;
    let ratio = 256;
    let delta = 1;
    let count = 0;
    for (let i = 0;i < 10; i++) {
      this.otim[i] = performance.now();
    }
    while (this.state >= 0) {
      if (this.state > 0) {
        this.state--;
        if (this.state === 0) {
          this.shutdown();
          return;
        }
      }
      const lastRatio = ratio;
      const lastDelta = delta;
      ratio = 300;
      delta = 1;
      ntime = performance.now();
      const otim = this.otim[opos];
      if (otim === 0) {
        ratio = lastRatio;
        delta = lastDelta;
      } else if (ntime > otim) {
        ratio = this.deltime * 2560 / (ntime - otim) | 0;
      }
      if (ratio < 25) {
        ratio = 25;
      } else if (ratio > 256) {
        ratio = 256;
        delta = this.deltime - (ntime - otim) / 10 | 0;
      }
      this.otim[opos] = ntime;
      opos = (opos + 1) % 10;
      if (delta > 1) {
        for (let i = 0;i < 10; i++) {
          if (this.otim[i] !== 0) {
            this.otim[i] += delta;
          }
        }
      }
      if (delta < this.mindel) {
        delta = this.mindel;
      }
      await sleep(delta);
      while (count < 256) {
        this.mouseClickButton = this.nextMouseClickButton;
        this.mouseClickX = this.nextMouseClickX;
        this.mouseClickY = this.nextMouseClickY;
        this.mouseClickTime = this.nextMouseClickTime;
        this.nextMouseClickButton = 0;
        await this.mainloop();
        count += ratio;
      }
      count &= 255;
      if (this.deltime > 0) {
        this.fps = ratio * 1000 / (this.deltime * 256) | 0;
      }
      await this.maindraw();
      if (this.tfps < 50) {
        const tfps = 1000 / this.tfps - (performance.now() - ntime);
        if (tfps > 0) {
          await sleep(tfps);
        }
      }
      if (this.debug) {
        console.log("ntime:" + ntime);
        for (let i = 0;i < 10; i++) {
          const o = (opos - i - 1 + 20) % 10;
          console.log("otim" + o + ":" + this.otim[o]);
        }
        console.log("fps:" + this.fps + " ratio:" + ratio + " count:" + count);
        console.log("del:" + delta + " deltime:" + this.deltime + " mindel:" + this.mindel);
        console.log("opos:" + opos);
        this.debug = false;
      }
    }
    if (this.state === -1) {
      this.shutdown();
    }
  }
  shutdown() {
    this.state = -2;
  }
  setFramerate(rate) {
    this.deltime = 1000 / rate | 0;
  }
  setTargetedFramerate(rate) {
    this.tfps = Math.max(Math.min(50, rate | 0), 0);
  }
  start() {
    if (this.state >= 0) {
      this.state = 0;
    }
  }
  stop() {
    if (this.state >= 0) {
      this.state = 4000 / this.deltime | 0;
    }
  }
  async messageBox(message, progress) {
    const width = this.sWid;
    const height = this.sHei;
    if (this.redrawScreen) {
      canvas2d.fillStyle = "black";
      canvas2d.fillRect(0, 0, width, height);
      this.redrawScreen = false;
    }
    const y = height / 2 - 18;
    canvas2d.strokeStyle = "rgb(140, 17, 17)";
    canvas2d.strokeRect((width / 2 | 0) - 152, y, 304, 34);
    canvas2d.fillStyle = "rgb(140, 17, 17)";
    canvas2d.fillRect((width / 2 | 0) - 150, y + 2, progress * 3, 30);
    canvas2d.fillStyle = "black";
    canvas2d.fillRect((width / 2 | 0) - 150 + progress * 3, y + 2, 300 - progress * 3, 30);
    canvas2d.font = "bold 13px helvetica, sans-serif";
    canvas2d.textAlign = "center";
    canvas2d.fillStyle = "white";
    canvas2d.fillText(message, width / 2 | 0, y + 22);
    await sleep(5);
  }
  onmousedown(e) {
    if (e.clientX < 0 || e.clientY < 0) {
      return;
    }
    const { x, y } = this.getMousePos(e);
    this.mouseDown(x, y, e);
  }
  mouseDown(x, y, e) {
    this.idleTimer = performance.now();
    this.nextMouseClickX = x;
    this.nextMouseClickY = y;
    this.nextMouseClickTime = performance.now();
    this.mouseX = x;
    this.mouseY = y;
    if (e.button === 2) {
      this.nextMouseClickButton = 2;
      this.mouseButton = 2;
    } else {
      this.nextMouseClickButton = 1;
      this.mouseButton = 1;
    }
    if (InputTracking.active) {
      InputTracking.mousePressed(x, y, e.button, "mouse");
    }
  }
  onpointerdown(e) {
    if (e.clientX < 0 || e.clientY < 0) {
      return;
    }
    const { x, y } = this.getMousePos(e);
    this.pointerDown(x, y, e);
  }
  pointerDown(_x, _y, _e) {}
  onmouseup(e) {
    const { x, y } = this.getMousePos(e);
    this.mouseUp(x, y, e);
  }
  mouseUp(x, y, e) {
    this.idleTimer = performance.now();
    this.mouseButton = 0;
    if (InputTracking.active) {
      InputTracking.mouseReleased(e.button, "mouse");
    }
    this.mouseX = x;
    this.mouseY = y;
  }
  onpointerup(e) {
    const { x, y } = this.getMousePos(e);
    this.pointerUp(x, y, e);
  }
  pointerUp(_x, _y, _e) {}
  onpointerenter(e) {
    if (e.clientX < 0 || e.clientY < 0) {
      return;
    }
    const { x, y } = this.getMousePos(e);
    this.pointerEnter(x, y, e);
  }
  pointerEnter(x, y, _e) {
    this.mouseX = x;
    this.mouseY = y;
    if (InputTracking.active) {
      InputTracking.mouseEntered();
    }
  }
  onpointerleave(e) {
    this.pointerLeave(e);
  }
  pointerLeave(_e) {
    this.idleTimer = performance.now();
    this.mouseX = -1;
    this.mouseY = -1;
    if (InputTracking.active) {
      InputTracking.mouseExited();
    }
    this.nextMouseClickX = -1;
    this.nextMouseClickY = -1;
    this.nextMouseClickButton = 0;
    this.mouseButton = 0;
  }
  onpointermove(e) {
    if (e.clientX < 0 || e.clientY < 0) {
      return;
    }
    const { x, y } = this.getMousePos(e);
    this.pointerMove(x, y, e);
  }
  pointerMove(x, y, e) {
    this.idleTimer = performance.now();
    this.mouseX = x;
    this.mouseY = y;
    if (InputTracking.active) {
      InputTracking.mouseMoved(x, y, e.pointerType);
    }
  }
  windowMouseUp(e) {}
  windowMouseMove(e) {}
  ontouchstart(e) {
    this.touchStart(e);
  }
  touchStart(e) {
    if (e.touches.length < 2) {
      e.preventDefault();
    }
  }
  onkeydown(e) {
    this.idleTimer = performance.now();
    const keyCode = KeyCodes.get(e.key);
    if (!keyCode || e.code.length === 0 && !e.isTrusted) {
      return;
    }
    let ch = keyCode.ch;
    if (e.ctrlKey) {
      if (ch >= 65 && ch <= 93 || ch == 95) {
        ch -= 65 - 1;
      } else if (ch >= 97 && ch <= 122) {
        ch -= 97 - 1;
      }
    }
    if (ch > 0 && ch < 128) {
      this.keyHeld[ch] = 1;
    }
    if (ch > 4) {
      this.keyQueue[this.keyQueueWritePos] = ch;
      this.keyQueueWritePos = this.keyQueueWritePos + 1 & 127;
    }
    if (InputTracking.active) {
      InputTracking.keyPressed(ch);
    }
    if (!CanvasEnabledKeys.includes(e.key)) {
      e.preventDefault();
    }
  }
  onkeyup(e) {
    this.idleTimer = performance.now();
    const keyCode = KeyCodes.get(e.key);
    if (!keyCode || e.code.length === 0 && !e.isTrusted) {
      return;
    }
    let ch = keyCode.ch;
    if (e.ctrlKey) {
      if (ch >= 65 && ch <= 93 || ch == 95) {
        ch -= 65 - 1;
      } else if (ch >= 97 && ch <= 122) {
        ch -= 97 - 1;
      }
    }
    if (ch > 0 && ch < 128) {
      this.keyHeld[ch] = 0;
    }
    if (InputTracking.active) {
      InputTracking.keyReleased(ch);
    }
    if (!CanvasEnabledKeys.includes(e.key)) {
      e.preventDefault();
    }
  }
  pollKey() {
    let key = -1;
    if (this.keyQueueWritePos !== this.keyQueueReadPos) {
      key = this.keyQueue[this.keyQueueReadPos];
      this.keyQueueReadPos = this.keyQueueReadPos + 1 & 127;
    }
    return key;
  }
  onfocus(_e) {
    this.focus = true;
    this.redrawScreen = true;
    this.refresh();
    if (InputTracking.active) {
      InputTracking.focusGained();
    }
  }
  onblur(_e) {
    this.focus = false;
    for (let i = 0;i < 128; i++) {
      this.keyHeld[i] = 0;
    }
    if (InputTracking.active) {
      InputTracking.focusLost();
    }
  }
  get hasTouchEvents() {
    return "ontouchstart" in window;
  }
  get isTouchDevice() {
    return this.hasTouchEvents || navigator.maxTouchPoints > 0 || navigator.msMaxTouchPoints > 0;
  }
  get isMobile() {
    if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone|Mobile/i.test(navigator.userAgent)) {
      return true;
    }
    return this.isTouchDevice;
  }
  isFullScreen() {
    return document.fullscreenElement !== null;
  }
  getMousePos(e) {
    const fixedWidth = this.sWid;
    const fixedHeight = this.sHei;
    const canvasBounds = canvas.getBoundingClientRect();
    const clickLocWithinCanvas = {
      x: e.clientX - canvasBounds.left,
      y: e.clientY - canvasBounds.top
    };
    let x = 0;
    let y = 0;
    if (this.isFullScreen()) {
      const gameAspectRatio = fixedWidth / fixedHeight;
      const ourAspectRatio = window.innerWidth / window.innerHeight;
      const wider = ourAspectRatio >= gameAspectRatio;
      let trueCanvasWidth = 0;
      let trueCanvasHeight = 0;
      let offsetX = 0;
      let offsetY = 0;
      if (wider) {
        trueCanvasWidth = window.innerHeight * gameAspectRatio;
        trueCanvasHeight = window.innerHeight;
        offsetX = (window.innerWidth - trueCanvasWidth) / 2;
      } else {
        trueCanvasWidth = window.innerWidth;
        trueCanvasHeight = window.innerWidth / gameAspectRatio;
        offsetY = (window.innerHeight - trueCanvasHeight) / 2;
      }
      const scaleX = fixedWidth / trueCanvasWidth;
      const scaleY = fixedHeight / trueCanvasHeight;
      x = (clickLocWithinCanvas.x - offsetX) * scaleX | 0;
      y = (clickLocWithinCanvas.y - offsetY) * scaleY | 0;
    } else {
      const scaleX = canvas.width / canvasBounds.width;
      const scaleY = canvas.height / canvasBounds.height;
      x = clickLocWithinCanvas.x * scaleX | 0;
      y = clickLocWithinCanvas.y * scaleY | 0;
    }
    if (x < 0) {
      x = 0;
    }
    if (x > fixedWidth) {
      x = fixedWidth;
    }
    if (y < 0) {
      y = 0;
    }
    if (y > fixedHeight) {
      y = fixedHeight;
    }
    return { x, y };
  }
}

// src/client/MobileKeyboard.ts
var KEYMAP_REGULAR = [
  "q",
  "w",
  "e",
  "r",
  "t",
  "y",
  "u",
  "i",
  "o",
  "p",
  "a",
  "s",
  "d",
  "f",
  "g",
  "h",
  "j",
  "k",
  "l",
  "Shift",
  "z",
  "x",
  "c",
  "v",
  "b",
  "n",
  "m",
  "Del",
  "123",
  ",",
  " ",
  ".",
  "Enter"
];
var KEYMAP_SHIFT = [
  "Q",
  "W",
  "E",
  "R",
  "T",
  "Y",
  "U",
  "I",
  "O",
  "P",
  "A",
  "S",
  "D",
  "F",
  "G",
  "H",
  "J",
  "K",
  "L",
  "Shift",
  "Z",
  "X",
  "C",
  "V",
  "B",
  "N",
  "M",
  "Del",
  "123",
  ",",
  " ",
  ".",
  "Enter"
];
var KEYMAP_SYMBOLS = [
  "1",
  "2",
  "3",
  "4",
  "5",
  "6",
  "7",
  "8",
  "9",
  "0",
  "!",
  '"',
  "$",
  "%",
  "_",
  "&",
  "*",
  "(",
  ")",
  "1/2",
  "@",
  "=",
  "<",
  ">",
  "~",
  ";",
  ":",
  "Del",
  "abc",
  "#",
  " ",
  "?",
  "Enter"
];
var KEYMAP_SYMBOLS_EXTRA = [
  "£",
  "^",
  "[",
  "]",
  "{",
  "}",
  "'",
  "-",
  "+",
  "/",
  "\\",
  "|",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "2/2",
  "",
  "",
  "",
  "",
  "",
  "",
  "",
  "Del",
  "abc",
  "",
  " ",
  "",
  "Enter"
];
var CHAR_OFFSET_PER_ROW = [0, 10, 19, 28];
var WIDTH_PER_KEYBOX = 50;
var HEIGHT_PER_KEYBOX = 30;
var DRAG_TIMEOUT_MS = 1000;
var DRAG_MIN_DIST_PX = 5;
var DRAG_MAX_DIST_PX = 75;
function isFullScreen() {
  return document.fullscreenElement !== null;
}

class MobileKeyboard {
  canvasKeyboard;
  nativeKeyboard;
  mode;
  constructor() {
    this.canvasKeyboard = new CanvasMobileKeyboard;
    this.nativeKeyboard = new NativeMobileKeyboard;
    const savedMode = localStorage.getItem("mobileKeyboardMode");
    if (savedMode === "native") {
      this.mode = 1 /* Native */;
    } else if (savedMode === "canvas") {
      this.mode = 2 /* Canvas */;
    } else {
      this.mode = 0 /* Hybrid */;
    }
  }
  show(originX, originY, clientX, clientY) {
    if (this.mode === 0 /* Hybrid */) {
      if (isFullScreen()) {
        this.canvasKeyboard.show(originX, originY);
      } else {
        this.nativeKeyboard.show(clientX ?? originX, clientY ?? originY);
      }
    } else if (this.mode === 2 /* Canvas */) {
      this.canvasKeyboard.show(originX, originY);
    } else if (this.mode === 1 /* Native */) {
      this.nativeKeyboard.show(clientX ?? originX, clientY ?? originY);
    }
  }
  hide() {
    this.canvasKeyboard.hide();
    this.nativeKeyboard.hide();
  }
  draw() {
    this.canvasKeyboard.draw();
  }
  isDisplayed() {
    return this.canvasKeyboard.isDisplayed() || this.nativeKeyboard.isDisplayed();
  }
  isWithinCanvasKeyboard(x, y) {
    return this.canvasKeyboard.isDisplayed() && this.canvasKeyboard.posWithinKeyboard(x, y);
  }
  captureMouseUp(x, y) {
    if (this.canvasKeyboard.isDisplayed()) {
      return this.canvasKeyboard.captureMouseUp(x, y);
    } else if (this.nativeKeyboard.isDisplayed()) {
      return this.nativeKeyboard.captureMouseUp(x, y);
    }
    return false;
  }
  captureMouseDown(x, y) {
    if (this.canvasKeyboard.isDisplayed()) {
      return this.canvasKeyboard.captureMouseDown(x, y);
    } else if (this.nativeKeyboard.isDisplayed()) {
      return this.nativeKeyboard.captureMouseDown(x, y);
    }
    return false;
  }
  notifyTouchMove(x, y) {
    if (this.canvasKeyboard.isDisplayed()) {
      this.canvasKeyboard.notifyTouchMove(x, y);
    } else if (this.nativeKeyboard.isDisplayed()) {
      this.nativeKeyboard.notifyTouchMove(x, y);
    }
  }
}

class CanvasMobileKeyboard {
  displayed = false;
  height = HEIGHT_PER_KEYBOX * 4 + 10;
  width = WIDTH_PER_KEYBOX * 10 + 10;
  startX = 0;
  startY = 503 - this.height;
  mode = 0 /* Regular */;
  animateBoxIndex = -1;
  animateBoxTimeout = 0;
  touchStartAtX = 0;
  touchStartAtY = 0;
  touching = false;
  touchStartTimestamp = 0;
  getBoxColourForIndex(index) {
    if (this.animateBoxIndex > -1) {
      if (this.animateBoxIndex === index) {
        return "#a6a6a6";
      }
    }
    const char = this.getCharForIndex(index);
    if (char !== undefined && char.length > 1) {
      return "#a9afba";
    }
    return "#c8cdd1";
  }
  getBoxForIndex(index) {
    const lineIndex = index < CHAR_OFFSET_PER_ROW[1] ? 0 : index < CHAR_OFFSET_PER_ROW[2] ? 1 : index < CHAR_OFFSET_PER_ROW[3] ? 2 : 3;
    const offsetPos = index - CHAR_OFFSET_PER_ROW[lineIndex];
    const box = {
      startX: offsetPos * WIDTH_PER_KEYBOX + 5,
      startY: lineIndex * HEIGHT_PER_KEYBOX + 5,
      width: WIDTH_PER_KEYBOX,
      height: HEIGHT_PER_KEYBOX
    };
    if (lineIndex === 1) {
      box.startX += WIDTH_PER_KEYBOX / 2;
    }
    if (index === 30) {
      box.width *= 6;
    }
    if (index > 30) {
      box.startX += WIDTH_PER_KEYBOX * 5;
    }
    return box;
  }
  getCharForIndex(index) {
    if (this.mode === 1 /* Shift */) {
      return KEYMAP_SHIFT[index];
    } else if (this.mode === 2 /* Symbols */) {
      return KEYMAP_SYMBOLS[index];
    } else if (this.mode === 3 /* SymbolsExtra */) {
      return KEYMAP_SYMBOLS_EXTRA[index];
    }
    return KEYMAP_REGULAR[index];
  }
  drawKeyBoxes() {
    for (let i = 0;i < KEYMAP_REGULAR.length; i++) {
      const box = this.getBoxForIndex(i);
      canvas2d.fillStyle = this.getBoxColourForIndex(i);
      canvas2d.beginPath();
      canvas2d.roundRect(this.startX + box.startX + 2, this.startY + box.startY + 2, box.width - 2, box.height - 2, 5);
      canvas2d.fill();
    }
  }
  drawKeyChars() {
    canvas2d.fillStyle = "black";
    canvas2d.textAlign = "center";
    canvas2d.textBaseline = "middle";
    for (let i = 0;i < KEYMAP_REGULAR.length; i++) {
      canvas2d.font = "16px Roboto, sans-serif";
      const box = this.getBoxForIndex(i);
      const offsetXCanvas = this.startX + box.startX + WIDTH_PER_KEYBOX / 2;
      const offsetYCanvas = this.startY + box.startY + HEIGHT_PER_KEYBOX / 2 + 2;
      const char = this.getCharForIndex(i);
      if (char.length > 1) {
        canvas2d.font = "14px Roboto, sans-serif";
      }
      canvas2d.fillText(char, offsetXCanvas, offsetYCanvas);
    }
  }
  drawBackground() {
    canvas2d.fillStyle = "#dadde2";
    canvas2d.beginPath();
    canvas2d.roundRect(this.startX, this.startY, this.width, this.height, 5);
    canvas2d.fill();
  }
  draw() {
    if (!this.isDisplayed()) {
      return;
    }
    canvas2d.save();
    this.drawBackground();
    this.drawKeyBoxes();
    this.drawKeyChars();
    canvas2d.restore();
  }
  show(_originX, _originY) {
    this.mode = 0 /* Regular */;
    this.displayed = true;
  }
  hide() {
    this.displayed = false;
  }
  isDisplayed() {
    return this.displayed;
  }
  posWithinKeyboard(x, y) {
    const withinX = x >= this.startX && x < this.startX + this.width;
    const withinY = y >= this.startY && y < this.startY + this.height;
    return withinX && withinY;
  }
  getBoxIndexForClick(x, y) {
    const relativeX = x - this.startX;
    const relativeY = y - this.startY;
    if (relativeX < 0 || relativeY < 0 || relativeX >= this.width || relativeY >= this.height) {
      return -1;
    }
    const rowIndex = Math.floor(relativeY / HEIGHT_PER_KEYBOX);
    const columnIndex = Math.floor(relativeX / WIDTH_PER_KEYBOX);
    if (rowIndex === 0) {
      return columnIndex;
    }
    if (rowIndex === 1) {
      if (relativeX < WIDTH_PER_KEYBOX / 2 || relativeX > this.width - WIDTH_PER_KEYBOX / 2) {
        return -1;
      }
      return CHAR_OFFSET_PER_ROW[1] + Math.floor((relativeX - WIDTH_PER_KEYBOX / 2) / WIDTH_PER_KEYBOX);
    }
    if (rowIndex === 2) {
      if (columnIndex >= 9) {
        return -1;
      }
      return CHAR_OFFSET_PER_ROW[2] + columnIndex;
    }
    return CHAR_OFFSET_PER_ROW[3] + columnIndex;
  }
  getCharForClick(x, y) {
    const boxIndex = this.getBoxIndexForClick(x, y);
    if (boxIndex > -1) {
      let char = "";
      if (boxIndex >= 30 && boxIndex <= 35) {
        char = " ";
      } else if (boxIndex === 36) {
        char = this.getCharForIndex(31);
      } else if (boxIndex === 37) {
        char = "Enter";
      } else {
        char = this.getCharForIndex(boxIndex);
      }
      if (char === "Del") {
        char = "Backspace";
      }
      return char;
    }
    return "";
  }
  captureMouseDown(x, y) {
    if (this.posWithinKeyboard(x, y)) {
      return true;
    }
    return false;
  }
  captureMouseUp(x, y) {
    this.touching = false;
    if (this.posWithinKeyboard(x, y)) {
      const index = this.getBoxIndexForClick(x, y);
      const char = this.getCharForClick(x, y);
      if (char === "Shift") {
        if (this.mode === 0 /* Regular */) {
          this.mode = 1 /* Shift */;
        } else {
          this.mode = 0 /* Regular */;
        }
        return true;
      } else if (char === "123" || char === "2/2") {
        this.mode = 2 /* Symbols */;
        return true;
      } else if (char === "1/2") {
        this.mode = 3 /* SymbolsExtra */;
        return true;
      } else if (char === "abc") {
        this.mode = 0 /* Regular */;
        return true;
      } else if (char === "") {
        return true;
      }
      const downEvent = new KeyboardEvent("keydown", {
        key: char,
        code: char
      });
      const upEvent = new KeyboardEvent("keyup", {
        key: char,
        code: char
      });
      canvas.dispatchEvent(downEvent);
      canvas.dispatchEvent(upEvent);
      if (!this.animateBoxTimeout) {
        if (index >= 30 && index <= 35) {
          this.animateBoxIndex = 30;
        } else if (index > 35) {
          this.animateBoxIndex = index - 5;
        } else {
          this.animateBoxIndex = index;
        }
        this.animateBoxTimeout = window.setTimeout(() => {
          this.animateBoxIndex = -1;
          this.animateBoxTimeout = 0;
        }, 100);
      }
      return true;
    }
    return false;
  }
  notifyTouchMove(x, y) {
    if (!this.posWithinKeyboard(x, y)) {
      return;
    }
    if (this.touching && performance.now() > this.touchStartTimestamp + DRAG_TIMEOUT_MS) {
      this.touching = false;
      return;
    }
    if (!this.touching) {
      this.touching = true;
      this.touchStartTimestamp = performance.now();
      this.touchStartAtX = x - this.startX;
      this.touchStartAtY = y - this.startY;
      return;
    }
    const deltaX = Math.abs(Math.abs(this.touchStartAtX - x) - this.startX);
    const deltaY = Math.abs(Math.abs(this.touchStartAtY - y) - this.startY);
    if (deltaX > DRAG_MAX_DIST_PX || deltaY > DRAG_MAX_DIST_PX) {
      return;
    }
    if (deltaX > DRAG_MIN_DIST_PX || deltaY > DRAG_MIN_DIST_PX) {
      const newStartX = Math.max(0, Math.min(789 - this.width, x - this.touchStartAtX));
      const newStartY = Math.max(0, Math.min(532 - this.height, y - this.touchStartAtY));
      this.startX = newStartX;
      this.startY = newStartY;
      canvas.dispatchEvent(new FocusEvent("focus"));
    }
  }
}

class NativeMobileKeyboard {
  virtualInputElement;
  displayed = false;
  isAndroid = false;
  constructor() {
    this.isAndroid = navigator.userAgent.includes("Android");
    this.virtualInputElement = document.createElement("input");
    this.virtualInputElement.setAttribute("type", "password");
    this.virtualInputElement.setAttribute("autofocus", "autofocus");
    this.virtualInputElement.setAttribute("spellcheck", "false");
    this.virtualInputElement.setAttribute("autocomplete", "off");
    this.virtualInputElement.setAttribute("autocorrect", "off");
    this.virtualInputElement.setAttribute("autocapitalize", "off");
    this.virtualInputElement.setAttribute("style", "position: fixed; top: 0px; left: 0px; width: 1px; height: 1px; opacity: 0;");
    if (this.isAndroid) {
      this.virtualInputElement.addEventListener("input", (ev) => {
        if (!(ev instanceof InputEvent)) {
          return;
        }
        const data = ev.data;
        if (data === null) {
          return;
        }
        if (ev.inputType !== "insertText") {
          return;
        }
        canvas.dispatchEvent(new KeyboardEvent("keydown", { key: data, code: data }));
        canvas.dispatchEvent(new KeyboardEvent("keyup", { key: data, code: data }));
      });
      this.virtualInputElement.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter" || ev.key === "Backspace") {
          canvas.dispatchEvent(new KeyboardEvent("keydown", { key: ev.key, code: ev.key }));
        }
      });
      this.virtualInputElement.addEventListener("keyup", (ev) => {
        if (ev.key === "Enter" || ev.key === "Backspace") {
          canvas.dispatchEvent(new KeyboardEvent("keyup", { key: ev.key, code: ev.key }));
        }
      });
    } else {
      this.virtualInputElement.addEventListener("keydown", (ev) => {
        canvas.dispatchEvent(new KeyboardEvent("keydown", { key: ev.key, code: ev.key }));
      });
      this.virtualInputElement.addEventListener("keyup", (ev) => {
        canvas.dispatchEvent(new KeyboardEvent("keyup", { key: ev.key, code: ev.key }));
      });
    }
    document.body.appendChild(this.virtualInputElement);
  }
  draw() {}
  show(originX, originY) {
    if (originX && originY) {
      this.virtualInputElement.style.left = `${originX}px`;
      this.virtualInputElement.style.top = `${originY}px`;
    }
    canvas.blur();
    this.virtualInputElement.focus();
    this.virtualInputElement.click();
    this.displayed = true;
  }
  hide() {
    this.virtualInputElement.blur();
    canvas.focus();
    this.displayed = false;
  }
  isDisplayed() {
    return this.displayed;
  }
  captureMouseUp(_x, _y) {
    return false;
  }
  captureMouseDown(_x, _y) {
    return false;
  }
  notifyTouchMove(_x, _y) {
    return;
  }
}
var MobileKeyboard_default = new MobileKeyboard;

// src/client/MouseTracking.ts
class MouseTracking {
  app;
  active = true;
  length = 0;
  x = new Array(500);
  y = new Array(500);
  constructor(app) {
    this.app = app;
  }
  cycle() {
    if (this.active) {
      if (this.length < 500) {
        this.x[this.length] = this.app.mouseX;
        this.y[this.length] = this.app.mouseY;
        this.length++;
      }
    }
  }
}

// src/config/FloType.ts
class FloType {
  static numDefinitions = 0;
  static list = [];
  rgb = 0;
  texture = -1;
  overlay = false;
  occlude = true;
  debugname = "";
  hue = 0;
  saturation = 0;
  lightness = 0;
  chroma = 0;
  underlayHue = 0;
  overlayHsl = 0;
  static init(config) {
    const dat = new Packet(config.read("flo.dat"));
    this.numDefinitions = dat.g2();
    this.list = new Array(this.numDefinitions);
    for (let id = 0;id < this.numDefinitions; id++) {
      if (!this.list[id]) {
        this.list[id] = new FloType;
      }
      this.list[id].decode(dat);
    }
  }
  decode(dat) {
    while (true) {
      const code = dat.g1();
      if (code === 0) {
        break;
      }
      if (code === 1) {
        this.rgb = dat.g3();
        this.getHsl(this.rgb);
      } else if (code === 2) {
        this.texture = dat.g1();
      } else if (code === 3) {
        this.overlay = true;
      } else if (code === 5) {
        this.occlude = false;
      } else if (code === 6) {
        this.debugname = dat.gjstr();
      } else {
        console.log("Error unrecognised config code: ", code);
      }
    }
  }
  getHsl(rgb) {
    const red = (rgb >> 16 & 255) / 256;
    const green = (rgb >> 8 & 255) / 256;
    const blue = (rgb & 255) / 256;
    let min = red;
    if (green < red) {
      min = green;
    }
    if (blue < min) {
      min = blue;
    }
    let max = red;
    if (green > red) {
      max = green;
    }
    if (blue > max) {
      max = blue;
    }
    let h = 0;
    let s = 0;
    const l = (min + max) / 2;
    if (min !== max) {
      if (l < 0.5) {
        s = (max - min) / (max + min);
      }
      if (l >= 0.5) {
        s = (max - min) / (2 - max - min);
      }
      if (red === max) {
        h = (green - blue) / (max - min);
      } else if (green === max) {
        h = (blue - red) / (max - min) + 2;
      } else if (blue === max) {
        h = (red - green) / (max - min) + 4;
      }
    }
    h /= 6;
    this.hue = h * 256 | 0;
    this.saturation = s * 256 | 0;
    this.lightness = l * 256 | 0;
    if (this.saturation < 0) {
      this.saturation = 0;
    } else if (this.saturation > 255) {
      this.saturation = 255;
    }
    if (this.lightness < 0) {
      this.lightness = 0;
    } else if (this.lightness > 255) {
      this.lightness = 255;
    }
    if (l > 0.5) {
      this.chroma = (1 - l) * s * 512 | 0;
    } else {
      this.chroma = l * s * 512 | 0;
    }
    if (this.chroma < 1) {
      this.chroma = 1;
    }
    this.underlayHue = h * this.chroma | 0;
    let hue = this.hue + (Math.random() * 16 | 0) - 8;
    if (hue < 0) {
      hue = 0;
    } else if (hue > 255) {
      hue = 255;
    }
    let saturation = this.saturation + (Math.random() * 48 | 0) - 24;
    if (saturation < 0) {
      saturation = 0;
    } else if (saturation > 255) {
      saturation = 255;
    }
    let lightness = this.lightness + (Math.random() * 48 | 0) - 24;
    if (lightness < 0) {
      lightness = 0;
    } else if (lightness > 255) {
      lightness = 255;
    }
    this.overlayHsl = FloType.getTable(hue, saturation, lightness);
  }
  static getTable(hue, saturation, lightness) {
    if (lightness > 179) {
      saturation = saturation / 2 | 0;
    }
    if (lightness > 192) {
      saturation = saturation / 2 | 0;
    }
    if (lightness > 217) {
      saturation = saturation / 2 | 0;
    }
    if (lightness > 243) {
      saturation = saturation / 2 | 0;
    }
    return ((hue / 4 | 0) << 10) + ((saturation / 32 | 0) << 7) + (lightness / 2 | 0);
  }
}

// src/dash3d/AnimBase.ts
class AnimBase {
  size = 0;
  type = null;
  labels = null;
  constructor(buf) {
    this.size = buf.g1();
    this.type = new Uint8Array(this.size);
    this.labels = new TypedArray1d(this.size, null);
    for (let i = 0;i < this.size; i++) {
      this.type[i] = buf.g1();
    }
    for (let i = 0;i < this.size; i++) {
      const count = buf.g1();
      this.labels[i] = new Uint8Array(count);
      for (let j = 0;j < count; j++) {
        this.labels[i][j] = buf.g1();
      }
    }
  }
}

// src/dash3d/AnimFrame.ts
class AnimFrame {
  static list = [];
  delay = -1;
  base = null;
  size = 0;
  ti = null;
  tx = null;
  ty = null;
  tz = null;
  static opaque = [];
  static init(total) {
    this.list = new Array(total + 1);
    this.opaque = new Array(total + 1);
    for (let i = 0;i < total + 1; i++) {
      this.opaque[i] = true;
    }
  }
  static unpack(data) {
    const buf = new Packet(data);
    buf.pos = data.length - 8;
    const headLength = buf.g2();
    const tran1Length = buf.g2();
    const tran2Length = buf.g2();
    const delLength = buf.g2();
    let pos = 0;
    const head = new Packet(data);
    head.pos = pos;
    pos += headLength + 2;
    const tran1 = new Packet(data);
    tran1.pos = pos;
    pos += tran1Length;
    const tran2 = new Packet(data);
    tran2.pos = pos;
    pos += tran2Length;
    const del = new Packet(data);
    del.pos = pos;
    pos += delLength;
    const baseBuf = new Packet(data);
    baseBuf.pos = pos;
    const base = new AnimBase(baseBuf);
    const total = head.g2();
    const tempTi = new Int32Array(500);
    const tempTx = new Int32Array(500);
    const tempTy = new Int32Array(500);
    const tempTz = new Int32Array(500);
    for (let i = 0;i < total; i++) {
      const id = head.g2();
      const frame = this.list[id] = new AnimFrame;
      frame.delay = del.g1();
      frame.base = base;
      const groupCount = head.g1();
      let lastGroup = -1;
      let current = 0;
      for (let j = 0;j < groupCount; j++) {
        if (!base.type) {
          throw new Error;
        }
        const flags = tran1.g1();
        if (flags > 0) {
          if (base.type[j] !== 0) {
            for (let group = j - 1;group > lastGroup; group--) {
              if (base.type[group] === 0) {
                tempTi[current] = group;
                tempTx[current] = 0;
                tempTy[current] = 0;
                tempTz[current] = 0;
                current++;
                break;
              }
            }
          }
          tempTi[current] = j;
          let defaultValue = 0;
          if (base.type[tempTi[current]] === 3 /* SCALE */) {
            defaultValue = 128;
          }
          if ((flags & 1) === 0) {
            tempTx[current] = defaultValue;
          } else {
            tempTx[current] = tran2.gsmart();
          }
          if ((flags & 2) === 0) {
            tempTy[current] = defaultValue;
          } else {
            tempTy[current] = tran2.gsmart();
          }
          if ((flags & 4) === 0) {
            tempTz[current] = defaultValue;
          } else {
            tempTz[current] = tran2.gsmart();
          }
          lastGroup = j;
          current++;
          if (base.type[j] === 5 /* TRANSPARENCY */) {
            this.opaque[id] = false;
          }
        }
      }
      frame.size = current;
      frame.ti = new Int32Array(current);
      frame.tx = new Int32Array(current);
      frame.ty = new Int32Array(current);
      frame.tz = new Int32Array(current);
      for (let j = 0;j < current; j++) {
        frame.ti[j] = tempTi[j];
        frame.tx[j] = tempTx[j];
        frame.ty[j] = tempTy[j];
        frame.tz[j] = tempTz[j];
      }
    }
  }
  static get(id) {
    return AnimFrame.list[id];
  }
  static shareAlpha(frame) {
    return frame === -1;
  }
}

// src/config/SeqType.ts
class SeqType {
  static numDefinitions = 0;
  static list = [];
  numFrames = 0;
  frames = null;
  iframes = null;
  delay = null;
  loops = -1;
  walkmerge = null;
  stretches = false;
  priority = 5;
  replaceheldleft = -1;
  replaceheldright = -1;
  maxloops = 99;
  preanim_move = -1;
  postanim_move = -1;
  duplicatebehaviour = -1;
  static init(config) {
    const dat = new Packet(config.read("seq.dat"));
    this.numDefinitions = dat.g2();
    this.list = new Array(this.numDefinitions);
    for (let id = 0;id < this.numDefinitions; id++) {
      if (!this.list[id]) {
        this.list[id] = new SeqType;
      }
      this.list[id].decode(dat);
    }
  }
  getDuration(frame) {
    if (!this.delay || !this.frames) {
      return 0;
    }
    let duration = this.delay[frame];
    if (duration === 0) {
      const transform = AnimFrame.get(this.frames[frame]);
      if (transform != null) {
        duration = this.delay[frame] = transform.delay;
      }
    }
    if (duration === 0) {
      duration = 1;
    }
    return duration;
  }
  decode(dat) {
    while (true) {
      const code = dat.g1();
      if (code === 0) {
        break;
      }
      if (code === 1) {
        this.numFrames = dat.g1();
        this.frames = new Int16Array(this.numFrames);
        this.iframes = new Int16Array(this.numFrames);
        this.delay = new Int16Array(this.numFrames);
        for (let i = 0;i < this.numFrames; i++) {
          this.frames[i] = dat.g2();
          this.iframes[i] = dat.g2();
          if (this.iframes[i] === 65535) {
            this.iframes[i] = -1;
          }
          this.delay[i] = dat.g2();
        }
      } else if (code === 2) {
        this.loops = dat.g2();
      } else if (code === 3) {
        const count = dat.g1();
        this.walkmerge = new Int32Array(count + 1);
        for (let i = 0;i < count; i++) {
          this.walkmerge[i] = dat.g1();
        }
        this.walkmerge[count] = 9999999;
      } else if (code === 4) {
        this.stretches = true;
      } else if (code === 5) {
        this.priority = dat.g1();
      } else if (code === 6) {
        this.replaceheldleft = dat.g2();
      } else if (code === 7) {
        this.replaceheldright = dat.g2();
      } else if (code === 8) {
        this.maxloops = dat.g1();
      } else if (code === 9) {
        this.preanim_move = dat.g1();
      } else if (code === 10) {
        this.postanim_move = dat.g1();
      } else if (code === 11) {
        this.duplicatebehaviour = dat.g1();
      } else {
        console.log("Error unrecognised seq config code: ", code);
      }
    }
    if (this.numFrames === 0) {
      this.numFrames = 1;
      this.frames = new Int16Array(1);
      this.frames[0] = -1;
      this.iframes = new Int16Array(1);
      this.iframes[0] = -1;
      this.delay = new Int16Array(1);
      this.delay[0] = -1;
    }
    if (this.preanim_move === -1) {
      if (this.walkmerge === null) {
        this.preanim_move = 0 /* DELAYMOVE */;
      } else {
        this.preanim_move = 2 /* MERGE */;
      }
    }
    if (this.postanim_move === -1) {
      if (this.walkmerge === null) {
        this.postanim_move = 0 /* DELAYMOVE */;
      } else {
        this.postanim_move = 2 /* MERGE */;
      }
    }
  }
}

// src/datastruct/HashTable.ts
class HashTable {
  bucketCount;
  buckets;
  constructor(size) {
    this.buckets = new Array(size);
    this.bucketCount = size;
    for (let i = 0;i < size; i++) {
      const sentinel = this.buckets[i] = new Linkable;
      sentinel.next = sentinel;
      sentinel.prev = sentinel;
    }
  }
  find(key) {
    const start = this.buckets[Number(key & BigInt(this.bucketCount - 1))];
    for (let node = start.next;node !== start; node = node?.next ?? null) {
      if (node && node.key === key) {
        return node;
      }
    }
    return null;
  }
  put(node, key) {
    if (node.prev) {
      node.unlink();
    }
    const sentinel = this.buckets[Number(key & BigInt(this.bucketCount - 1))];
    node.prev = sentinel.prev;
    node.next = sentinel;
    if (node.prev) {
      node.prev.next = node;
    }
    node.next.prev = node;
    node.key = key;
  }
}

// src/datastruct/LinkList2.ts
class LinkList2 {
  sentinel = new Linkable2;
  cursor = null;
  constructor() {
    this.sentinel.next2 = this.sentinel;
    this.sentinel.prev2 = this.sentinel;
  }
  push(node) {
    if (node.prev2) {
      node.unlink2();
    }
    node.prev2 = this.sentinel.prev2;
    node.next2 = this.sentinel;
    if (node.prev2) {
      node.prev2.next2 = node;
    }
    node.next2.prev2 = node;
  }
  popFront() {
    const node = this.sentinel.next2;
    if (node === this.sentinel) {
      return null;
    } else {
      node?.unlink2();
      return node;
    }
  }
  head() {
    const node = this.sentinel.next2;
    if (node === this.sentinel) {
      this.cursor = null;
      return null;
    }
    this.cursor = node?.next2 ?? null;
    return node;
  }
  next() {
    const node = this.cursor;
    if (node === this.sentinel) {
      this.cursor = null;
      return null;
    }
    this.cursor = node?.next2 ?? null;
    return node;
  }
  size() {
    let count = 0;
    for (let node = this.sentinel.next2;node !== this.sentinel && node; node = node.next2) {
      count++;
    }
    return count;
  }
}

// src/datastruct/LruCache.ts
class LruCache {
  capacity;
  table = new HashTable(1024);
  history = new LinkList2;
  available;
  constructor(size) {
    this.capacity = size;
    this.available = size;
  }
  find(key) {
    const node = this.table.find(key);
    if (node) {
      this.history.push(node);
    }
    return node;
  }
  put(node, key) {
    if (this.available === 0) {
      const first = this.history.popFront();
      first?.unlink();
      first?.unlink2();
    } else {
      this.available--;
    }
    this.table.put(node, key);
    this.history.push(node);
  }
  clear() {
    while (true) {
      const node = this.history.popFront();
      if (!node) {
        this.available = this.capacity;
        return;
      }
      node.unlink();
      node.unlink2();
    }
  }
}

// src/dash3d/LocShape.ts
var LOC_SHAPE_TO_LAYER = [
  0 /* WALL */,
  0 /* WALL */,
  0 /* WALL */,
  0 /* WALL */,
  1 /* WALL_DECOR */,
  1 /* WALL_DECOR */,
  1 /* WALL_DECOR */,
  1 /* WALL_DECOR */,
  1 /* WALL_DECOR */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  2 /* GROUND */,
  3 /* GROUND_DECOR */
];

// src/dash3d/PointNormal.ts
class PointNormal {
  x = 0;
  y = 0;
  z = 0;
  w = 0;
}

// src/dash3d/ModelSource.ts
class ModelSource extends Linkable2 {
  vertexNormal = null;
  minY = 1000;
  worldRender(loopCycle, yaw, sinEyePitch, cosEyePitch, sinEyeYaw, cosEyeYaw, relativeX, relativeY, relativeZ, typecode) {
    const model = this.getTempModel(loopCycle);
    if (model) {
      this.minY = model.minY;
      model.worldRender(0, yaw, sinEyePitch, cosEyePitch, sinEyeYaw, cosEyeYaw, relativeX, relativeY, relativeZ, typecode);
    }
  }
  getTempModel(_loopCycle) {
    return null;
  }
}

// src/dash3d/Model.ts
class Metadata {
  src = null;
  vertexCount = 0;
  faceCount = 0;
  faceTextureCount = 0;
  vertexOrderOffset = -1;
  vertexXOffset = -1;
  vertexYOffset = -1;
  vertexZOffset = -1;
  vertexLabelOffset = -1;
  faceIndexOffset = -1;
  faceIndexOrderOffset = -1;
  faceColourOffset = -1;
  faceRenderTypeOffset = -1;
  facePriorityOffset = 0;
  faceAlphaOffset = -1;
  faceLabelOffset = -1;
  faceTextureAxisOffset = -1;
}

class Model extends ModelSource {
  static loaded = 0;
  static meta = [];
  static provider;
  static tmpVertexX = new Int32Array(2000);
  static tmpVertexY = new Int32Array(2000);
  static tmpVertexZ = new Int32Array(2000);
  vertexCount = 0;
  vertexX = null;
  vertexY = null;
  vertexZ = null;
  faceCount = 0;
  faceVertexA = null;
  faceVertexB = null;
  faceVertexC = null;
  faceRenderType = null;
  facePriority = null;
  faceAlpha = null;
  faceColour = null;
  priority = 0;
  faceTextureCount = 0;
  faceTextureP = null;
  faceTextureM = null;
  faceTextureN = null;
  vertexLabel = null;
  faceLabel = null;
  labelVertices = null;
  labelFaces = null;
  vertexNormalOriginal = null;
  maxY = 0;
  minX = 0;
  maxX = 0;
  minZ = 0;
  maxZ = 0;
  objRaise = 0;
  static tempModel = new Model;
  static tempFTran = new Int32Array(2000);
  faceColourA = null;
  faceColourB = null;
  faceColourC = null;
  useAABBMouseCheck = false;
  radius = 0;
  maxDepth = 0;
  minDepth = 0;
  static faceClippedX = new TypedArray1d(4096, false);
  static faceNearClipped = new TypedArray1d(4096, false);
  static vertexScreenX = new Int32Array(4096);
  static vertexScreenY = new Int32Array(4096);
  static vertexScreenZ = new Int32Array(4096);
  static vertexViewSpaceX = new Int32Array(4096);
  static vertexViewSpaceY = new Int32Array(4096);
  static vertexViewSpaceZ = new Int32Array(4096);
  static tmpDepthFaceCount = new Int32Array(1500);
  static tmpDepthFaces = new Int32Array2d(1500, 512);
  static tmpPriorityFaceCount = new Int32Array(12);
  static tmpPriorityFaces = new Int32Array2d(12, 2000);
  static tmpPriority10FaceDepth = new Int32Array(2000);
  static tmpPriority11FaceDepth = new Int32Array(2000);
  static tmpPriorityDepthSum = new Int32Array(12);
  static clippedX = new Int32Array(10);
  static clippedY = new Int32Array(10);
  static clippedColour = new Int32Array(10);
  static oX = 0;
  static oY = 0;
  static oZ = 0;
  static mouseCheck = false;
  static mouseX = 0;
  static mouseY = 0;
  static pickedCount = 0;
  static pickedEntityTypecode = new Int32Array(1000);
  static init(total, provider) {
    Model.meta = new Array(total);
    Model.provider = provider;
  }
  static unpack(id, src) {
    if (!src) {
      const meta2 = Model.meta[id] = new Metadata;
      meta2.vertexCount = 0;
      meta2.faceCount = 0;
      meta2.faceTextureCount = 0;
      return;
    }
    const trailer = new Packet(src);
    trailer.pos = src.length - 18;
    const meta = Model.meta[id] = new Metadata;
    meta.src = src;
    meta.vertexCount = trailer.g2();
    meta.faceCount = trailer.g2();
    meta.faceTextureCount = trailer.g1();
    const hasRenderType = trailer.g1();
    const priority = trailer.g1();
    const hasAlpha = trailer.g1();
    const hasFaceLabels = trailer.g1();
    const hasVertexLabels = trailer.g1();
    const dataLengthX = trailer.g2();
    const dataLengthY = trailer.g2();
    const dataLengthZ = trailer.g2();
    const dataLengthFaceIndex = trailer.g2();
    let pos = 0;
    meta.vertexOrderOffset = pos;
    pos += meta.vertexCount;
    meta.faceIndexOrderOffset = pos;
    pos += meta.faceCount;
    meta.facePriorityOffset = pos;
    if (priority === 255) {
      pos += meta.faceCount;
    } else {
      meta.facePriorityOffset = -priority - 1;
    }
    meta.faceLabelOffset = pos;
    if (hasFaceLabels === 1) {
      pos += meta.faceCount;
    } else {
      meta.faceLabelOffset = -1;
    }
    meta.faceRenderTypeOffset = pos;
    if (hasRenderType === 1) {
      pos += meta.faceCount;
    } else {
      meta.faceRenderTypeOffset = -1;
    }
    meta.vertexLabelOffset = pos;
    if (hasVertexLabels === 1) {
      pos += meta.vertexCount;
    } else {
      meta.vertexLabelOffset = -1;
    }
    meta.faceAlphaOffset = pos;
    if (hasAlpha === 1) {
      pos += meta.faceCount;
    } else {
      meta.faceAlphaOffset = -1;
    }
    meta.faceIndexOffset = pos;
    pos += dataLengthFaceIndex;
    meta.faceColourOffset = pos;
    pos += meta.faceCount * 2;
    meta.faceTextureAxisOffset = pos;
    pos += meta.faceTextureCount * 6;
    meta.vertexXOffset = pos;
    pos += dataLengthX;
    meta.vertexYOffset = pos;
    pos += dataLengthY;
    meta.vertexZOffset = pos;
    pos += dataLengthZ;
  }
  static unload(id) {
    Model.meta[id] = null;
  }
  static load(id) {
    const meta = Model.meta[id];
    if (!meta) {
      Model.provider.requestModel(id);
      return null;
    }
    const model = new Model;
    Model.loaded++;
    model.vertexCount = meta.vertexCount;
    model.faceCount = meta.faceCount;
    model.faceTextureCount = meta.faceTextureCount;
    model.vertexX = new Int32Array(model.vertexCount);
    model.vertexY = new Int32Array(model.vertexCount);
    model.vertexZ = new Int32Array(model.vertexCount);
    model.faceVertexA = new Int32Array(model.faceCount);
    model.faceVertexB = new Int32Array(model.faceCount);
    model.faceVertexC = new Int32Array(model.faceCount);
    model.faceTextureP = new Int32Array(model.faceTextureCount);
    model.faceTextureM = new Int32Array(model.faceTextureCount);
    model.faceTextureN = new Int32Array(model.faceTextureCount);
    if (meta.vertexLabelOffset >= 0) {
      model.vertexLabel = new Int32Array(model.vertexCount);
    }
    if (meta.faceRenderTypeOffset >= 0) {
      model.faceRenderType = new Int32Array(model.faceCount);
    }
    if (meta.facePriorityOffset >= 0) {
      model.facePriority = new Int32Array(model.faceCount);
    } else {
      model.priority = -meta.facePriorityOffset - 1;
    }
    if (meta.faceAlphaOffset >= 0) {
      model.faceAlpha = new Int32Array(model.faceCount);
    }
    if (meta.faceLabelOffset >= 0) {
      model.faceLabel = new Int32Array(model.faceCount);
    }
    model.faceColour = new Int32Array(model.faceCount);
    const point1 = new Packet(meta.src);
    point1.pos = meta.vertexOrderOffset;
    const point2 = new Packet(meta.src);
    point2.pos = meta.vertexXOffset;
    const point3 = new Packet(meta.src);
    point3.pos = meta.vertexYOffset;
    const point4 = new Packet(meta.src);
    point4.pos = meta.vertexZOffset;
    const point5 = new Packet(meta.src);
    point5.pos = meta.vertexLabelOffset;
    let dx = 0;
    let dy = 0;
    let dz = 0;
    for (let v = 0;v < model.vertexCount; v++) {
      const order = point1.g1();
      let x = 0;
      if ((order & 1) !== 0) {
        x = point2.gsmart();
      }
      let y = 0;
      if ((order & 2) !== 0) {
        y = point3.gsmart();
      }
      let z = 0;
      if ((order & 4) !== 0) {
        z = point4.gsmart();
      }
      model.vertexX[v] = dx + x;
      model.vertexY[v] = dy + y;
      model.vertexZ[v] = dz + z;
      dx = model.vertexX[v];
      dy = model.vertexY[v];
      dz = model.vertexZ[v];
      if (model.vertexLabel !== null) {
        model.vertexLabel[v] = point5.g1();
      }
    }
    const face1 = new Packet(meta.src);
    face1.pos = meta.faceColourOffset;
    const face2 = new Packet(meta.src);
    face2.pos = meta.faceRenderTypeOffset;
    const face3 = new Packet(meta.src);
    face3.pos = meta.facePriorityOffset;
    const face4 = new Packet(meta.src);
    face4.pos = meta.faceAlphaOffset;
    const face5 = new Packet(meta.src);
    face5.pos = meta.faceLabelOffset;
    for (let f = 0;f < model.faceCount; f++) {
      model.faceColour[f] = face1.g2();
      if (model.faceRenderType !== null) {
        model.faceRenderType[f] = face2.g1();
      }
      if (model.facePriority !== null) {
        model.facePriority[f] = face3.g1();
      }
      if (model.faceAlpha !== null) {
        model.faceAlpha[f] = face4.g1();
      }
      if (model.faceLabel !== null) {
        model.faceLabel[f] = face5.g1();
      }
    }
    const vertex1 = new Packet(meta.src);
    vertex1.pos = meta.faceIndexOffset;
    const vertex2 = new Packet(meta.src);
    vertex2.pos = meta.faceIndexOrderOffset;
    let a = 0;
    let b = 0;
    let c = 0;
    let last = 0;
    for (let f = 0;f < model.faceCount; f++) {
      const order = vertex2.g1();
      if (order === 1) {
        a = vertex1.gsmart() + last;
        b = vertex1.gsmart() + a;
        c = vertex1.gsmart() + b;
        last = c;
      } else if (order === 2) {
        b = c;
        c = vertex1.gsmart() + last;
        last = c;
      } else if (order === 3) {
        a = c;
        c = vertex1.gsmart() + last;
        last = c;
      } else if (order === 4) {
        const tmp = a;
        a = b;
        b = tmp;
        c = vertex1.gsmart() + last;
        last = c;
      }
      model.faceVertexA[f] = a;
      model.faceVertexB[f] = b;
      model.faceVertexC[f] = c;
    }
    const axis = new Packet(meta.src);
    axis.pos = meta.faceTextureAxisOffset;
    for (let f = 0;f < model.faceTextureCount; f++) {
      model.faceTextureP[f] = axis.g2();
      model.faceTextureM[f] = axis.g2();
      model.faceTextureN[f] = axis.g2();
    }
    return model;
  }
  static requestDownload(id) {
    const meta = Model.meta[id];
    if (!meta) {
      Model.provider.requestModel(id);
      return false;
    }
    return true;
  }
  static combineForAnim(models, count) {
    const combined = new Model;
    Model.loaded++;
    let copyRenderType = false;
    let copyPriority = false;
    let copyAlpha = false;
    let copyLabels = false;
    combined.vertexCount = 0;
    combined.faceCount = 0;
    combined.faceTextureCount = 0;
    combined.priority = -1;
    for (let i = 0;i < count; i++) {
      const model = models[i];
      if (model !== null) {
        combined.vertexCount += model.vertexCount;
        combined.faceCount += model.faceCount;
        combined.faceTextureCount += model.faceTextureCount;
        if (model.faceRenderType !== null) {
          copyRenderType = true;
        }
        if (model.facePriority === null) {
          if (combined.priority === -1) {
            combined.priority = model.priority;
          }
          if (combined.priority !== model.priority) {
            copyPriority = true;
          }
        } else {
          copyPriority = true;
        }
        if (model.faceAlpha !== null) {
          copyAlpha = true;
        }
        if (model.faceLabel !== null) {
          copyLabels = true;
        }
      }
    }
    combined.vertexX = new Int32Array(combined.vertexCount);
    combined.vertexY = new Int32Array(combined.vertexCount);
    combined.vertexZ = new Int32Array(combined.vertexCount);
    combined.vertexLabel = new Int32Array(combined.vertexCount);
    combined.faceVertexA = new Int32Array(combined.faceCount);
    combined.faceVertexB = new Int32Array(combined.faceCount);
    combined.faceVertexC = new Int32Array(combined.faceCount);
    combined.faceTextureP = new Int32Array(combined.faceTextureCount);
    combined.faceTextureM = new Int32Array(combined.faceTextureCount);
    combined.faceTextureN = new Int32Array(combined.faceTextureCount);
    if (copyRenderType) {
      combined.faceRenderType = new Int32Array(combined.faceCount);
    }
    if (copyPriority) {
      combined.facePriority = new Int32Array(combined.faceCount);
    }
    if (copyAlpha) {
      combined.faceAlpha = new Int32Array(combined.faceCount);
    }
    if (copyLabels) {
      combined.faceLabel = new Int32Array(combined.faceCount);
    }
    combined.faceColour = new Int32Array(combined.faceCount);
    combined.vertexCount = 0;
    combined.faceCount = 0;
    combined.faceTextureCount = 0;
    for (let i = 0;i < count; i++) {
      const model = models[i];
      if (model !== null) {
        for (let f = 0;f < model.faceCount; f++) {
          if (copyRenderType) {
            if (model.faceRenderType === null) {
              if (combined.faceRenderType) {
                combined.faceRenderType[combined.faceCount] = 0;
              }
            } else {
              if (combined.faceRenderType) {
                combined.faceRenderType[combined.faceCount] = model.faceRenderType[f];
              }
            }
          }
          if (copyPriority) {
            if (model.facePriority === null) {
              if (combined.facePriority) {
                combined.facePriority[combined.faceCount] = model.priority;
              }
            } else {
              if (combined.facePriority) {
                combined.facePriority[combined.faceCount] = model.facePriority[f];
              }
            }
          }
          if (copyAlpha) {
            if (model.faceAlpha === null) {
              if (combined.faceAlpha) {
                combined.faceAlpha[combined.faceCount] = 0;
              }
            } else {
              if (combined.faceAlpha) {
                combined.faceAlpha[combined.faceCount] = model.faceAlpha[f];
              }
            }
          }
          if (copyLabels && model.faceLabel !== null) {
            combined.faceLabel[combined.faceCount] = model.faceLabel[f];
          }
          combined.faceColour[combined.faceCount] = model.faceColour[f];
          combined.faceVertexA[combined.faceCount] = combined.addPoint(model, model.faceVertexA[f]);
          combined.faceVertexB[combined.faceCount] = combined.addPoint(model, model.faceVertexB[f]);
          combined.faceVertexC[combined.faceCount] = combined.addPoint(model, model.faceVertexC[f]);
          combined.faceCount++;
        }
        for (let f = 0;f < model.faceTextureCount; f++) {
          combined.faceTextureP[combined.faceTextureCount] = combined.addPoint(model, model.faceTextureP[f]);
          combined.faceTextureM[combined.faceTextureCount] = combined.addPoint(model, model.faceTextureM[f]);
          combined.faceTextureN[combined.faceTextureCount] = combined.addPoint(model, model.faceTextureN[f]);
          combined.faceTextureCount++;
        }
      }
    }
    return combined;
  }
  static combine(models, count) {
    const combined = new Model;
    Model.loaded++;
    let copyRenderType = false;
    let copyPriority = false;
    let copyAlpha = false;
    let copyColour = false;
    combined.vertexCount = 0;
    combined.faceCount = 0;
    combined.faceTextureCount = 0;
    combined.priority = -1;
    for (let i = 0;i < count; i++) {
      const model = models[i];
      if (model !== null) {
        combined.vertexCount += model.vertexCount;
        combined.faceCount += model.faceCount;
        combined.faceTextureCount += model.faceTextureCount;
        if (model.faceRenderType !== null) {
          copyRenderType = true;
        }
        if (model.facePriority === null) {
          if (combined.priority === -1) {
            combined.priority = model.priority;
          }
          if (combined.priority !== model.priority) {
            copyPriority = true;
          }
        } else {
          copyPriority = true;
        }
        if (model.faceAlpha !== null) {
          copyAlpha = true;
        }
        if (model.faceColour !== null) {
          copyColour = true;
        }
      }
    }
    combined.vertexX = new Int32Array(combined.vertexCount);
    combined.vertexY = new Int32Array(combined.vertexCount);
    combined.vertexZ = new Int32Array(combined.vertexCount);
    combined.faceVertexA = new Int32Array(combined.faceCount);
    combined.faceVertexB = new Int32Array(combined.faceCount);
    combined.faceVertexC = new Int32Array(combined.faceCount);
    combined.faceColourA = new Int32Array(combined.faceCount);
    combined.faceColourB = new Int32Array(combined.faceCount);
    combined.faceColourC = new Int32Array(combined.faceCount);
    combined.faceTextureP = new Int32Array(combined.faceTextureCount);
    combined.faceTextureM = new Int32Array(combined.faceTextureCount);
    combined.faceTextureN = new Int32Array(combined.faceTextureCount);
    if (copyRenderType) {
      combined.faceRenderType = new Int32Array(combined.faceCount);
    }
    if (copyPriority) {
      combined.facePriority = new Int32Array(combined.faceCount);
    }
    if (copyAlpha) {
      combined.faceAlpha = new Int32Array(combined.faceCount);
    }
    if (copyColour) {
      combined.faceColour = new Int32Array(combined.faceCount);
    }
    combined.vertexCount = 0;
    combined.faceCount = 0;
    combined.faceTextureCount = 0;
    for (let i = 0;i < count; i++) {
      const model = models[i];
      if (model !== null) {
        const vertexCount = combined.vertexCount;
        for (let v = 0;v < model.vertexCount; v++) {
          combined.vertexX[combined.vertexCount] = model.vertexX[v];
          combined.vertexY[combined.vertexCount] = model.vertexY[v];
          combined.vertexZ[combined.vertexCount] = model.vertexZ[v];
          combined.vertexCount++;
        }
        for (let f = 0;f < model.faceCount; f++) {
          combined.faceVertexA[combined.faceCount] = model.faceVertexA[f] + vertexCount;
          combined.faceVertexB[combined.faceCount] = model.faceVertexB[f] + vertexCount;
          combined.faceVertexC[combined.faceCount] = model.faceVertexC[f] + vertexCount;
          combined.faceColourA[combined.faceCount] = model.faceColourA[f];
          combined.faceColourB[combined.faceCount] = model.faceColourB[f];
          combined.faceColourC[combined.faceCount] = model.faceColourC[f];
          if (copyRenderType) {
            if (model.faceRenderType === null) {
              if (combined.faceRenderType) {
                combined.faceRenderType[combined.faceCount] = 0;
              }
            } else {
              if (combined.faceRenderType) {
                combined.faceRenderType[combined.faceCount] = model.faceRenderType[f];
              }
            }
          }
          if (copyPriority) {
            if (model.facePriority === null) {
              if (combined.facePriority) {
                combined.facePriority[combined.faceCount] = model.priority;
              }
            } else {
              if (combined.facePriority) {
                combined.facePriority[combined.faceCount] = model.facePriority[f];
              }
            }
          }
          if (copyAlpha) {
            if (model.faceAlpha === null) {
              if (combined.faceAlpha) {
                combined.faceAlpha[combined.faceCount] = 0;
              }
            } else {
              combined.faceAlpha[combined.faceCount] = model.faceAlpha[f];
            }
          }
          if (copyColour && model.faceColour !== null) {
            combined.faceColour[combined.faceCount] = model.faceColour[f];
          }
          combined.faceCount++;
        }
        for (let f = 0;f < model.faceTextureCount; f++) {
          combined.faceTextureP[combined.faceTextureCount] = model.faceTextureP[f] + vertexCount;
          combined.faceTextureM[combined.faceTextureCount] = model.faceTextureM[f] + vertexCount;
          combined.faceTextureN[combined.faceTextureCount] = model.faceTextureN[f] + vertexCount;
          combined.faceTextureCount++;
        }
      }
    }
    combined.calcBoundingCylinder();
    return combined;
  }
  static copyForAnim(src, shareColours, shareAlpha, shareVertices) {
    const model = new Model;
    Model.loaded++;
    model.vertexCount = src.vertexCount;
    model.faceCount = src.faceCount;
    model.faceTextureCount = src.faceTextureCount;
    if (shareVertices) {
      model.vertexX = src.vertexX;
      model.vertexY = src.vertexY;
      model.vertexZ = src.vertexZ;
    } else {
      model.vertexX = new Int32Array(model.vertexCount);
      model.vertexY = new Int32Array(model.vertexCount);
      model.vertexZ = new Int32Array(model.vertexCount);
      for (let v = 0;v < model.vertexCount; v++) {
        model.vertexX[v] = src.vertexX[v];
        model.vertexY[v] = src.vertexY[v];
        model.vertexZ[v] = src.vertexZ[v];
      }
    }
    if (shareColours) {
      model.faceColour = src.faceColour;
    } else {
      model.faceColour = new Int32Array(model.faceCount);
      for (let f = 0;f < model.faceCount; f++) {
        model.faceColour[f] = src.faceColour[f];
      }
    }
    if (shareAlpha) {
      model.faceAlpha = src.faceAlpha;
    } else {
      model.faceAlpha = new Int32Array(model.faceCount);
      if (src.faceAlpha === null) {
        for (let f = 0;f < model.faceCount; f++) {
          model.faceAlpha[f] = 0;
        }
      } else {
        for (let f = 0;f < model.faceCount; f++) {
          model.faceAlpha[f] = src.faceAlpha[f];
        }
      }
    }
    model.vertexLabel = src.vertexLabel;
    model.faceLabel = src.faceLabel;
    model.faceRenderType = src.faceRenderType;
    model.faceVertexA = src.faceVertexA;
    model.faceVertexB = src.faceVertexB;
    model.faceVertexC = src.faceVertexC;
    model.facePriority = src.facePriority;
    model.priority = src.priority;
    model.faceTextureP = src.faceTextureP;
    model.faceTextureM = src.faceTextureM;
    model.faceTextureN = src.faceTextureN;
    return model;
  }
  static hillSkewCopy(src, copyVertexY, copyFaces) {
    const model = new Model;
    Model.loaded++;
    model.vertexCount = src.vertexCount;
    model.faceCount = src.faceCount;
    model.faceTextureCount = src.faceTextureCount;
    if (copyVertexY) {
      model.vertexY = new Int32Array(model.vertexCount);
      for (let v = 0;v < model.vertexCount; v++) {
        model.vertexY[v] = src.vertexY[v];
      }
    } else {
      model.vertexY = src.vertexY;
    }
    if (copyFaces) {
      model.faceColourA = new Int32Array(model.faceCount);
      model.faceColourB = new Int32Array(model.faceCount);
      model.faceColourC = new Int32Array(model.faceCount);
      for (let f = 0;f < model.faceCount; f++) {
        model.faceColourA[f] = src.faceColourA[f];
        model.faceColourB[f] = src.faceColourB[f];
        model.faceColourC[f] = src.faceColourC[f];
      }
      model.faceRenderType = new Int32Array(model.faceCount);
      if (src.faceRenderType === null) {
        for (let f = 0;f < model.faceCount; f++) {
          model.faceRenderType[f] = 0;
        }
      } else {
        for (let f = 0;f < model.faceCount; f++) {
          model.faceRenderType[f] = src.faceRenderType[f];
        }
      }
      model.vertexNormal = new TypedArray1d(model.vertexCount, null);
      for (let v = 0;v < model.vertexCount; v++) {
        const normal = model.vertexNormal[v] = new PointNormal;
        const original = src.vertexNormal[v];
        normal.x = original.x;
        normal.y = original.y;
        normal.z = original.z;
        normal.w = original.w;
      }
      model.vertexNormalOriginal = src.vertexNormalOriginal;
    } else {
      model.faceColourA = src.faceColourA;
      model.faceColourB = src.faceColourB;
      model.faceColourC = src.faceColourC;
      model.faceRenderType = src.faceRenderType;
    }
    model.vertexX = src.vertexX;
    model.vertexZ = src.vertexZ;
    model.faceColour = src.faceColour;
    model.faceAlpha = src.faceAlpha;
    model.facePriority = src.facePriority;
    model.priority = src.priority;
    model.faceVertexA = src.faceVertexA;
    model.faceVertexB = src.faceVertexB;
    model.faceVertexC = src.faceVertexC;
    model.faceTextureP = src.faceTextureP;
    model.faceTextureM = src.faceTextureM;
    model.faceTextureN = src.faceTextureN;
    model.minY = src.minY;
    model.maxY = src.maxY;
    model.radius = src.radius;
    model.minDepth = src.minDepth;
    model.maxDepth = src.maxDepth;
    model.minX = src.minX;
    model.maxZ = src.maxZ;
    model.minZ = src.minZ;
    model.maxX = src.maxX;
    return model;
  }
  set(src, shareAlpha) {
    this.vertexCount = src.vertexCount;
    this.faceCount = src.faceCount;
    this.faceTextureCount = src.faceTextureCount;
    if (Model.tmpVertexX.length < this.vertexCount) {
      Model.tmpVertexX = new Int32Array(this.vertexCount + 100);
      Model.tmpVertexY = new Int32Array(this.vertexCount + 100);
      Model.tmpVertexZ = new Int32Array(this.vertexCount + 100);
    }
    this.vertexX = Model.tmpVertexX;
    this.vertexY = Model.tmpVertexY;
    this.vertexZ = Model.tmpVertexZ;
    for (let v = 0;v < this.vertexCount; v++) {
      this.vertexX[v] = src.vertexX[v];
      this.vertexY[v] = src.vertexY[v];
      this.vertexZ[v] = src.vertexZ[v];
    }
    if (shareAlpha) {
      this.faceAlpha = src.faceAlpha;
    } else {
      if (Model.tempFTran.length < this.faceCount) {
        Model.tempFTran = new Int32Array(this.faceCount + 100);
      }
      this.faceAlpha = Model.tempFTran;
      if (!src.faceAlpha) {
        for (let f = 0;f < this.faceCount; f++) {
          this.faceAlpha[f] = 0;
        }
      } else {
        for (let f = 0;f < this.faceCount; f++) {
          this.faceAlpha[f] = src.faceAlpha[f];
        }
      }
    }
    this.faceRenderType = src.faceRenderType;
    this.faceColour = src.faceColour;
    this.facePriority = src.facePriority;
    this.priority = src.priority;
    this.labelFaces = src.labelFaces;
    this.labelVertices = src.labelVertices;
    this.faceVertexA = src.faceVertexA;
    this.faceVertexB = src.faceVertexB;
    this.faceVertexC = src.faceVertexC;
    this.faceColourA = src.faceColourA;
    this.faceColourB = src.faceColourB;
    this.faceColourC = src.faceColourC;
    this.faceTextureP = src.faceTextureP;
    this.faceTextureM = src.faceTextureM;
    this.faceTextureN = src.faceTextureN;
  }
  addPoint(src, vertex) {
    let index = -1;
    const x = src.vertexX[vertex];
    const y = src.vertexY[vertex];
    const z = src.vertexZ[vertex];
    for (let v = 0;v < this.vertexCount; v++) {
      if (this.vertexX[v] === x && this.vertexY[v] === y && this.vertexZ[v] === z) {
        index = v;
        break;
      }
    }
    if (index === -1) {
      this.vertexX[this.vertexCount] = x;
      this.vertexY[this.vertexCount] = y;
      this.vertexZ[this.vertexCount] = z;
      if (src.vertexLabel !== null) {
        this.vertexLabel[this.vertexCount] = src.vertexLabel[vertex];
      }
      index = this.vertexCount++;
    }
    return index;
  }
  calcBoundingCylinder() {
    this.minY = 0;
    this.radius = 0;
    this.maxY = 0;
    for (let i = 0;i < this.vertexCount; i++) {
      const x = this.vertexX[i];
      const y = this.vertexY[i];
      const z = this.vertexZ[i];
      if (-y > this.minY) {
        this.minY = -y;
      }
      if (y > this.maxY) {
        this.maxY = y;
      }
      const radiusSqr = x * x + z * z;
      if (radiusSqr > this.radius) {
        this.radius = radiusSqr;
      }
    }
    this.radius = Math.sqrt(this.radius) + 0.99 | 0;
    this.minDepth = Math.sqrt(this.radius * this.radius + this.minY * this.minY) + 0.99 | 0;
    this.maxDepth = this.minDepth + (Math.sqrt(this.radius * this.radius + this.maxY * this.maxY) + 0.99 | 0);
  }
  recalcBoundingCylinder() {
    this.minY = 0;
    this.maxY = 0;
    for (let i = 0;i < this.vertexCount; i++) {
      const y = this.vertexY[i];
      if (-y > this.minY) {
        this.minY = -y;
      }
      if (y > this.maxY) {
        this.maxY = y;
      }
    }
    this.minDepth = Math.sqrt(this.radius * this.radius + this.minY * this.minY) + 0.99 | 0;
    this.maxDepth = this.minDepth + (Math.sqrt(this.radius * this.radius + this.maxY * this.maxY) + 0.99 | 0);
  }
  calcBoundingCube() {
    this.minY = 0;
    this.radius = 0;
    this.maxY = 0;
    this.minX = 999999;
    this.maxX = -999999;
    this.maxZ = -99999;
    this.minZ = 99999;
    for (let v = 0;v < this.vertexCount; v++) {
      const x = this.vertexX[v];
      const y = this.vertexY[v];
      const z = this.vertexZ[v];
      if (x < this.minX) {
        this.minX = x;
      }
      if (x > this.maxX) {
        this.maxX = x;
      }
      if (z < this.minZ) {
        this.minZ = z;
      }
      if (z > this.maxZ) {
        this.maxZ = z;
      }
      if (-y > this.minY) {
        this.minY = -y;
      }
      if (y > this.maxY) {
        this.maxY = y;
      }
      const radiusSqr = x * x + z * z;
      if (radiusSqr > this.radius) {
        this.radius = radiusSqr;
      }
    }
    this.radius = Math.sqrt(this.radius) | 0;
    this.minDepth = Math.sqrt(this.radius * this.radius + this.minY * this.minY) | 0;
    this.maxDepth = this.minDepth + (Math.sqrt(this.radius * this.radius + this.maxY * this.maxY) | 0);
  }
  prepareAnim() {
    if (this.vertexLabel) {
      const labelVertexCount = new Int32Array(256);
      let count = 0;
      for (let v2 = 0;v2 < this.vertexCount; v2++) {
        const label = this.vertexLabel[v2];
        labelVertexCount[label]++;
        if (label > count) {
          count = label;
        }
      }
      this.labelVertices = new TypedArray1d(count + 1, null);
      for (let label = 0;label <= count; label++) {
        this.labelVertices[label] = new Int32Array(labelVertexCount[label]);
        labelVertexCount[label] = 0;
      }
      let v = 0;
      while (v < this.vertexCount) {
        const label = this.vertexLabel[v];
        const verts = this.labelVertices[label];
        if (!verts) {
          continue;
        }
        verts[labelVertexCount[label]++] = v++;
      }
      this.vertexLabel = null;
    }
    if (this.faceLabel) {
      const labelFaceCount = new Int32Array(256);
      let count = 0;
      for (let f = 0;f < this.faceCount; f++) {
        const label = this.faceLabel[f];
        labelFaceCount[label]++;
        if (label > count) {
          count = label;
        }
      }
      this.labelFaces = new TypedArray1d(count + 1, null);
      for (let label = 0;label <= count; label++) {
        this.labelFaces[label] = new Int32Array(labelFaceCount[label]);
        labelFaceCount[label] = 0;
      }
      let face = 0;
      while (face < this.faceCount) {
        const label = this.faceLabel[face];
        const faces = this.labelFaces[label];
        if (!faces) {
          continue;
        }
        faces[labelFaceCount[label]++] = face++;
      }
      this.faceLabel = null;
    }
  }
  animate(id) {
    if (!this.labelVertices || id === -1) {
      return;
    }
    const transform = AnimFrame.list[id];
    if (!transform) {
      return;
    }
    const skeleton = transform.base;
    Model.oX = 0;
    Model.oY = 0;
    Model.oZ = 0;
    for (let i = 0;i < transform.size; i++) {
      if (!transform.ti || !transform.tx || !transform.ty || !transform.tz || !skeleton || !skeleton.labels || !skeleton.type) {
        continue;
      }
      const base = transform.ti[i];
      this.animate2(transform.tx[i], transform.ty[i], transform.tz[i], skeleton.labels[base], skeleton.type[base]);
    }
  }
  maskAnimate(primaryId, secondaryId, mask) {
    if (primaryId === -1) {
      return;
    }
    if (!mask || secondaryId === -1) {
      this.animate(primaryId);
      return;
    }
    const primary = AnimFrame.get(primaryId);
    if (!primary) {
      return;
    }
    const secondary = AnimFrame.get(secondaryId);
    if (!secondary) {
      this.animate(primaryId);
      return;
    }
    const skeleton = primary.base;
    Model.oX = 0;
    Model.oY = 0;
    Model.oZ = 0;
    let counter = 0;
    let maskBase = mask[counter++];
    for (let i = 0;i < primary.size; i++) {
      if (!primary.ti) {
        continue;
      }
      const base = primary.ti[i];
      while (base > maskBase) {
        maskBase = mask[counter++];
      }
      if (skeleton && skeleton.type && primary.tx && primary.ty && primary.tz && skeleton.labels && (base !== maskBase || skeleton.type[base] === 0)) {
        this.animate2(primary.tx[i], primary.ty[i], primary.tz[i], skeleton.labels[base], skeleton.type[base]);
      }
    }
    Model.oX = 0;
    Model.oY = 0;
    Model.oZ = 0;
    counter = 0;
    maskBase = mask[counter++];
    for (let i = 0;i < secondary.size; i++) {
      if (!secondary.ti) {
        continue;
      }
      const base = secondary.ti[i];
      while (base > maskBase) {
        maskBase = mask[counter++];
      }
      if (skeleton && skeleton.type && secondary.tx && secondary.ty && secondary.tz && skeleton.labels && (base === maskBase || skeleton.type[base] === 0)) {
        this.animate2(secondary.tx[i], secondary.ty[i], secondary.tz[i], skeleton.labels[base], skeleton.type[base]);
      }
    }
  }
  animate2(x, y, z, labels, type) {
    if (!labels) {
      return;
    }
    const labelCount = labels.length;
    if (type === 0 /* ORIGIN */) {
      let count = 0;
      Model.oX = 0;
      Model.oY = 0;
      Model.oZ = 0;
      for (let g = 0;g < labelCount; g++) {
        if (!this.labelVertices) {
          continue;
        }
        const label = labels[g];
        if (label < this.labelVertices.length) {
          const vertices = this.labelVertices[label];
          if (vertices) {
            for (let i = 0;i < vertices.length; i++) {
              const v = vertices[i];
              Model.oX += this.vertexX[v];
              Model.oY += this.vertexY[v];
              Model.oZ += this.vertexZ[v];
              count++;
            }
          }
        }
      }
      if (count > 0) {
        Model.oX = (Model.oX / count | 0) + x;
        Model.oY = (Model.oY / count | 0) + y;
        Model.oZ = (Model.oZ / count | 0) + z;
      } else {
        Model.oX = x;
        Model.oY = y;
        Model.oZ = z;
      }
    } else if (type === 1 /* TRANSLATE */) {
      for (let g = 0;g < labelCount; g++) {
        const group = labels[g];
        if (!this.labelVertices || group >= this.labelVertices.length) {
          continue;
        }
        const vertices = this.labelVertices[group];
        if (vertices) {
          for (let i = 0;i < vertices.length; i++) {
            const v = vertices[i];
            this.vertexX[v] += x;
            this.vertexY[v] += y;
            this.vertexZ[v] += z;
          }
        }
      }
    } else if (type === 2 /* ROTATE */) {
      for (let g = 0;g < labelCount; g++) {
        const label = labels[g];
        if (!this.labelVertices || label >= this.labelVertices.length) {
          continue;
        }
        const vertices = this.labelVertices[label];
        if (vertices) {
          for (let i = 0;i < vertices.length; i++) {
            const v = vertices[i];
            this.vertexX[v] -= Model.oX;
            this.vertexY[v] -= Model.oY;
            this.vertexZ[v] -= Model.oZ;
            const pitch = (x & 255) * 8;
            const yaw = (y & 255) * 8;
            const roll = (z & 255) * 8;
            let sin;
            let cos;
            if (roll !== 0) {
              sin = Pix3D.sinTable[roll];
              cos = Pix3D.cosTable[roll];
              const x_ = this.vertexY[v] * sin + this.vertexX[v] * cos >> 16;
              this.vertexY[v] = this.vertexY[v] * cos - this.vertexX[v] * sin >> 16;
              this.vertexX[v] = x_;
            }
            if (pitch !== 0) {
              sin = Pix3D.sinTable[pitch];
              cos = Pix3D.cosTable[pitch];
              const y_ = this.vertexY[v] * cos - this.vertexZ[v] * sin >> 16;
              this.vertexZ[v] = this.vertexY[v] * sin + this.vertexZ[v] * cos >> 16;
              this.vertexY[v] = y_;
            }
            if (yaw !== 0) {
              sin = Pix3D.sinTable[yaw];
              cos = Pix3D.cosTable[yaw];
              const x_ = this.vertexZ[v] * sin + this.vertexX[v] * cos >> 16;
              this.vertexZ[v] = this.vertexZ[v] * cos - this.vertexX[v] * sin >> 16;
              this.vertexX[v] = x_;
            }
            this.vertexX[v] += Model.oX;
            this.vertexY[v] += Model.oY;
            this.vertexZ[v] += Model.oZ;
          }
        }
      }
    } else if (type === 3 /* SCALE */) {
      for (let g = 0;g < labelCount; g++) {
        const label = labels[g];
        if (!this.labelVertices || label >= this.labelVertices.length) {
          continue;
        }
        const vertices = this.labelVertices[label];
        if (vertices) {
          for (let i = 0;i < vertices.length; i++) {
            const v = vertices[i];
            this.vertexX[v] -= Model.oX;
            this.vertexY[v] -= Model.oY;
            this.vertexZ[v] -= Model.oZ;
            this.vertexX[v] = this.vertexX[v] * x / 128 | 0;
            this.vertexY[v] = this.vertexY[v] * y / 128 | 0;
            this.vertexZ[v] = this.vertexZ[v] * z / 128 | 0;
            this.vertexX[v] += Model.oX;
            this.vertexY[v] += Model.oY;
            this.vertexZ[v] += Model.oZ;
          }
        }
      }
    } else if (type === 5 /* TRANSPARENCY */ && this.labelFaces && this.faceAlpha) {
      for (let g = 0;g < labelCount; g++) {
        const label = labels[g];
        if (label >= this.labelFaces.length) {
          continue;
        }
        const triangles = this.labelFaces[label];
        if (triangles) {
          for (let i = 0;i < triangles.length; i++) {
            const t = triangles[i];
            this.faceAlpha[t] += x * 8;
            if (this.faceAlpha[t] < 0) {
              this.faceAlpha[t] = 0;
            }
            if (this.faceAlpha[t] > 255) {
              this.faceAlpha[t] = 255;
            }
          }
        }
      }
    }
  }
  rotate90() {
    for (let v = 0;v < this.vertexCount; v++) {
      const tmp = this.vertexX[v];
      this.vertexX[v] = this.vertexZ[v];
      this.vertexZ[v] = -tmp;
    }
  }
  rotateXAxis(angle) {
    const sin = Pix3D.sinTable[angle];
    const cos = Pix3D.cosTable[angle];
    for (let v = 0;v < this.vertexCount; v++) {
      const tmp = this.vertexY[v] * cos - this.vertexZ[v] * sin >> 16;
      this.vertexZ[v] = this.vertexY[v] * sin + this.vertexZ[v] * cos >> 16;
      this.vertexY[v] = tmp;
    }
  }
  translate(y, x, z) {
    for (let v = 0;v < this.vertexCount; v++) {
      this.vertexX[v] += x;
      this.vertexY[v] += y;
      this.vertexZ[v] += z;
    }
  }
  recolour(src, dst) {
    if (!this.faceColour) {
      return;
    }
    for (let f = 0;f < this.faceCount; f++) {
      if (this.faceColour[f] === src) {
        this.faceColour[f] = dst;
      }
    }
  }
  mirror() {
    for (let v = 0;v < this.vertexCount; v++) {
      this.vertexZ[v] = -this.vertexZ[v];
    }
    for (let f = 0;f < this.faceCount; f++) {
      const tmp = this.faceVertexA[f];
      this.faceVertexA[f] = this.faceVertexC[f];
      this.faceVertexC[f] = tmp;
    }
  }
  resize(x, y, z) {
    for (let v = 0;v < this.vertexCount; v++) {
      this.vertexX[v] = this.vertexX[v] * x / 128 | 0;
      this.vertexY[v] = this.vertexY[v] * y / 128 | 0;
      this.vertexZ[v] = this.vertexZ[v] * z / 128 | 0;
    }
  }
  calculateNormals(ambient, contrast, x, y, z, doNotShareLight) {
    const lightMagnitude = Math.sqrt(x * x + y * y + z * z) | 0;
    const scale = contrast * lightMagnitude >> 8;
    if (!this.faceColourA || !this.faceColourB || !this.faceColourC) {
      this.faceColourA = new Int32Array(this.faceCount);
      this.faceColourB = new Int32Array(this.faceCount);
      this.faceColourC = new Int32Array(this.faceCount);
    }
    if (!this.vertexNormal) {
      this.vertexNormal = new TypedArray1d(this.vertexCount, null);
      for (let v = 0;v < this.vertexCount; v++) {
        this.vertexNormal[v] = new PointNormal;
      }
    }
    for (let f = 0;f < this.faceCount; f++) {
      const a = this.faceVertexA[f];
      const b = this.faceVertexB[f];
      const c = this.faceVertexC[f];
      const dxAB = this.vertexX[b] - this.vertexX[a];
      const dyAB = this.vertexY[b] - this.vertexY[a];
      const dzAB = this.vertexZ[b] - this.vertexZ[a];
      const dxAC = this.vertexX[c] - this.vertexX[a];
      const dyAC = this.vertexY[c] - this.vertexY[a];
      const dzAC = this.vertexZ[c] - this.vertexZ[a];
      let nx = dyAB * dzAC - dyAC * dzAB;
      let ny = dzAB * dxAC - dzAC * dxAB;
      let nz = dxAB * dyAC - dxAC * dyAB;
      while (nx > 8192 || ny > 8192 || nz > 8192 || nx < -8192 || ny < -8192 || nz < -8192) {
        nx >>= 1;
        ny >>= 1;
        nz >>= 1;
      }
      let length = Math.sqrt(nx * nx + ny * ny + nz * nz) | 0;
      if (length <= 0) {
        length = 1;
      }
      nx = nx * 256 / length | 0;
      ny = ny * 256 / length | 0;
      nz = nz * 256 / length | 0;
      if (!this.faceRenderType || (this.faceRenderType[f] & 1) === 0) {
        let n = this.vertexNormal[a];
        if (n) {
          n.x += nx;
          n.y += ny;
          n.z += nz;
          n.w++;
        }
        n = this.vertexNormal[b];
        if (n) {
          n.x += nx;
          n.y += ny;
          n.z += nz;
          n.w++;
        }
        n = this.vertexNormal[c];
        if (n) {
          n.x += nx;
          n.y += ny;
          n.z += nz;
          n.w++;
        }
      } else {
        const lightness = ambient + ((x * nx + y * ny + z * nz) / (scale + (scale / 2 | 0)) | 0);
        if (this.faceColour) {
          this.faceColourA[f] = Model.getColour(this.faceColour[f], lightness, this.faceRenderType[f]);
        }
      }
    }
    if (doNotShareLight) {
      this.light(ambient, scale, x, y, z);
    } else {
      this.vertexNormalOriginal = new TypedArray1d(this.vertexCount, null);
      for (let v = 0;v < this.vertexCount; v++) {
        const normal = this.vertexNormal[v];
        const copy = new PointNormal;
        if (normal) {
          copy.x = normal.x;
          copy.y = normal.y;
          copy.z = normal.z;
          copy.w = normal.w;
        }
        this.vertexNormalOriginal[v] = copy;
      }
    }
    if (doNotShareLight) {
      this.calcBoundingCylinder();
    } else {
      this.calcBoundingCube();
    }
  }
  light(ambient, contrast, x, y, z) {
    for (let f = 0;f < this.faceCount; f++) {
      const a = this.faceVertexA[f];
      const b = this.faceVertexB[f];
      const c = this.faceVertexC[f];
      if (!this.faceRenderType && this.faceColour && this.vertexNormal && this.faceColourA && this.faceColourB && this.faceColourC) {
        const colour = this.faceColour[f];
        const va = this.vertexNormal[a];
        if (va) {
          this.faceColourA[f] = Model.getColour(colour, ambient + ((x * va.x + y * va.y + z * va.z) / (contrast * va.w) | 0), 0);
        }
        const vb = this.vertexNormal[b];
        if (vb) {
          this.faceColourB[f] = Model.getColour(colour, ambient + ((x * vb.x + y * vb.y + z * vb.z) / (contrast * vb.w) | 0), 0);
        }
        const vc = this.vertexNormal[c];
        if (vc) {
          this.faceColourC[f] = Model.getColour(colour, ambient + ((x * vc.x + y * vc.y + z * vc.z) / (contrast * vc.w) | 0), 0);
        }
      } else if (this.faceRenderType && (this.faceRenderType[f] & 1) === 0 && this.faceColour && this.vertexNormal && this.faceColourA && this.faceColourB && this.faceColourC) {
        const colour = this.faceColour[f];
        const info = this.faceRenderType[f];
        const va = this.vertexNormal[a];
        if (va) {
          this.faceColourA[f] = Model.getColour(colour, ambient + ((x * va.x + y * va.y + z * va.z) / (contrast * va.w) | 0), info);
        }
        const vb = this.vertexNormal[b];
        if (vb) {
          this.faceColourB[f] = Model.getColour(colour, ambient + ((x * vb.x + y * vb.y + z * vb.z) / (contrast * vb.w) | 0), info);
        }
        const vc = this.vertexNormal[c];
        if (vc) {
          this.faceColourC[f] = Model.getColour(colour, ambient + ((x * vc.x + y * vc.y + z * vc.z) / (contrast * vc.w) | 0), info);
        }
      }
    }
    this.vertexNormal = null;
    this.vertexNormalOriginal = null;
    this.vertexLabel = null;
    this.faceLabel = null;
    if (this.faceRenderType) {
      for (let f = 0;f < this.faceCount; f++) {
        if ((this.faceRenderType[f] & 2) === 2) {
          return;
        }
      }
    }
    this.faceColour = null;
  }
  static getColour(hsl, scalar, faceRenderType) {
    if ((faceRenderType & 2) === 2) {
      if (scalar < 0) {
        scalar = 0;
      } else if (scalar > 127) {
        scalar = 127;
      }
      return 127 - scalar;
    } else {
      scalar = scalar * (hsl & 127) >> 7;
      if (scalar < 2) {
        scalar = 2;
      } else if (scalar > 126) {
        scalar = 126;
      }
      return (hsl & 65408) + scalar;
    }
  }
  objRender(pitch, yaw, roll, eyePitch, eyeX, eyeY, eyeZ) {
    const sinPitch = Pix3D.sinTable[pitch];
    const cosPitch = Pix3D.cosTable[pitch];
    const sinYaw = Pix3D.sinTable[yaw];
    const cosYaw = Pix3D.cosTable[yaw];
    const sinRoll = Pix3D.sinTable[roll];
    const cosRoll = Pix3D.cosTable[roll];
    const sinEyePitch = Pix3D.sinTable[eyePitch];
    const cosEyePitch = Pix3D.cosTable[eyePitch];
    const midZ = eyeY * sinEyePitch + eyeZ * cosEyePitch >> 16;
    for (let v = 0;v < this.vertexCount; v++) {
      let x = this.vertexX[v];
      let y = this.vertexY[v];
      let z = this.vertexZ[v];
      let tmp;
      if (roll !== 0) {
        tmp = y * sinRoll + x * cosRoll >> 16;
        y = y * cosRoll - x * sinRoll >> 16;
        x = tmp;
      }
      if (pitch !== 0) {
        tmp = y * cosPitch - z * sinPitch >> 16;
        z = y * sinPitch + z * cosPitch >> 16;
        y = tmp;
      }
      if (yaw !== 0) {
        tmp = z * sinYaw + x * cosYaw >> 16;
        z = z * cosYaw - x * sinYaw >> 16;
        x = tmp;
      }
      x += eyeX;
      y += eyeY;
      z += eyeZ;
      tmp = y * cosEyePitch - z * sinEyePitch >> 16;
      z = y * sinEyePitch + z * cosEyePitch >> 16;
      y = tmp;
      Model.vertexScreenZ[v] = z - midZ;
      Model.vertexScreenX[v] = Pix3D.originX + ((x << 9) / z | 0);
      Model.vertexScreenY[v] = Pix3D.originY + ((y << 9) / z | 0);
      if (this.faceTextureCount > 0) {
        Model.vertexViewSpaceX[v] = x;
        Model.vertexViewSpaceY[v] = y;
        Model.vertexViewSpaceZ[v] = z;
      }
    }
    try {
      this.render2(false, false, 0);
    } catch (_e) {}
  }
  worldRender(_loopCycle, yaw, sinEyePitch, cosEyePitch, sinEyeYaw, cosEyeYaw, relativeX, relativeY, relativeZ, typecode) {
    const zPrime = relativeZ * cosEyeYaw - relativeX * sinEyeYaw >> 16;
    const midZ = relativeY * sinEyePitch + zPrime * cosEyePitch >> 16;
    const radiusCosEyePitch = this.radius * cosEyePitch >> 16;
    const maxZ = midZ + radiusCosEyePitch;
    if (maxZ <= 50 || midZ >= 3500) {
      return;
    }
    const midX = relativeZ * sinEyeYaw + relativeX * cosEyeYaw >> 16;
    let leftX = midX - this.radius << 9;
    if ((leftX / maxZ | 0) >= Pix2D.maxX) {
      return;
    }
    let rightX = midX + this.radius << 9;
    if ((rightX / maxZ | 0) <= -Pix2D.maxX) {
      return;
    }
    const midY = relativeY * cosEyePitch - zPrime * sinEyePitch >> 16;
    const radiusSinEyePitch = this.radius * sinEyePitch >> 16;
    let bottomY = midY + radiusSinEyePitch << 9;
    if ((bottomY / maxZ | 0) <= -Pix2D.maxY) {
      return;
    }
    const yPrime = radiusSinEyePitch + (this.minY * cosEyePitch >> 16);
    let topY = midY - yPrime << 9;
    if ((topY / maxZ | 0) >= Pix2D.maxY) {
      return;
    }
    const radiusZ = radiusCosEyePitch + (this.minY * sinEyePitch >> 16);
    let clipped = midZ - radiusZ <= 50;
    let picking = false;
    if (typecode > 0 && Model.mouseCheck) {
      let z = midZ - radiusCosEyePitch;
      if (z <= 50) {
        z = 50;
      }
      if (midX > 0) {
        leftX = leftX / maxZ | 0;
        rightX = rightX / z | 0;
      } else {
        rightX = rightX / maxZ | 0;
        leftX = leftX / z | 0;
      }
      if (midY > 0) {
        topY = topY / maxZ | 0;
        bottomY = bottomY / z | 0;
      } else {
        bottomY = bottomY / maxZ | 0;
        topY = topY / z | 0;
      }
      const mouseX = Model.mouseX - Pix3D.originX;
      const mouseY = Model.mouseY - Pix3D.originY;
      if (mouseX > leftX && mouseX < rightX && mouseY > topY && mouseY < bottomY) {
        if (this.useAABBMouseCheck) {
          Model.pickedEntityTypecode[Model.pickedCount++] = typecode;
        } else {
          picking = true;
        }
      }
    }
    const centerX = Pix3D.originX;
    const centerY = Pix3D.originY;
    let sinYaw = 0;
    let cosYaw = 0;
    if (yaw !== 0) {
      sinYaw = Pix3D.sinTable[yaw];
      cosYaw = Pix3D.cosTable[yaw];
    }
    for (let v = 0;v < this.vertexCount; v++) {
      let x = this.vertexX[v];
      let y = this.vertexY[v];
      let z = this.vertexZ[v];
      let temp;
      if (yaw !== 0) {
        temp = z * sinYaw + x * cosYaw >> 16;
        z = z * cosYaw - x * sinYaw >> 16;
        x = temp;
      }
      x += relativeX;
      y += relativeY;
      z += relativeZ;
      temp = z * sinEyeYaw + x * cosEyeYaw >> 16;
      z = z * cosEyeYaw - x * sinEyeYaw >> 16;
      x = temp;
      temp = y * cosEyePitch - z * sinEyePitch >> 16;
      z = y * sinEyePitch + z * cosEyePitch >> 16;
      y = temp;
      Model.vertexScreenZ[v] = z - midZ;
      if (z >= 50) {
        Model.vertexScreenX[v] = centerX + ((x << 9) / z | 0);
        Model.vertexScreenY[v] = centerY + ((y << 9) / z | 0);
      } else {
        Model.vertexScreenX[v] = -5000;
        clipped = true;
      }
      if (clipped || this.faceTextureCount > 0) {
        Model.vertexViewSpaceX[v] = x;
        Model.vertexViewSpaceY[v] = y;
        Model.vertexViewSpaceZ[v] = z;
      }
    }
    try {
      this.render2(clipped, picking, typecode);
    } catch (_e) {}
  }
  render2(clipped, picking, typecode) {
    for (let depth = 0;depth < this.maxDepth; depth++) {
      Model.tmpDepthFaceCount[depth] = 0;
    }
    for (let f = 0;f < this.faceCount; f++) {
      if (this.faceRenderType && this.faceRenderType[f] === -1) {
        continue;
      }
      const a = this.faceVertexA[f];
      const b = this.faceVertexB[f];
      const c = this.faceVertexC[f];
      const xA = Model.vertexScreenX[a];
      const xB = Model.vertexScreenX[b];
      const xC = Model.vertexScreenX[c];
      const yA = Model.vertexScreenY[a];
      const yB = Model.vertexScreenY[b];
      const yC = Model.vertexScreenY[c];
      const zA = Model.vertexScreenZ[a];
      const zB = Model.vertexScreenZ[b];
      const zC = Model.vertexScreenZ[c];
      if (clipped && (xA === -5000 || xB === -5000 || xC === -5000)) {
        Model.faceNearClipped[f] = true;
        const depthAverage = ((zA + zB + zC) / 3 | 0) + this.minDepth;
        Model.tmpDepthFaces[depthAverage][Model.tmpDepthFaceCount[depthAverage]++] = f;
      } else {
        if (picking && this.isMouseRoughlyInsideTriangle(Model.mouseX, Model.mouseY, yA, yB, yC, xA, xB, xC)) {
          Model.pickedEntityTypecode[Model.pickedCount++] = typecode;
          picking = false;
        }
        const dxAB = xA - xB;
        const dyAB = yA - yB;
        const dxCB = xC - xB;
        const dyCB = yC - yB;
        if (dxAB * dyCB - dyAB * dxCB <= 0) {
          continue;
        }
        Model.faceNearClipped[f] = false;
        Model.faceClippedX[f] = xA < 0 || xB < 0 || xC < 0 || xA > Pix2D.sizeX || xB > Pix2D.sizeX || xC > Pix2D.sizeX;
        const depthAverage = ((zA + zB + zC) / 3 | 0) + this.minDepth;
        Model.tmpDepthFaces[depthAverage][Model.tmpDepthFaceCount[depthAverage]++] = f;
      }
    }
    if (!this.facePriority) {
      for (let depth = this.maxDepth - 1;depth >= 0; depth--) {
        const count = Model.tmpDepthFaceCount[depth];
        if (count <= 0) {
          continue;
        }
        const faces = Model.tmpDepthFaces[depth];
        for (let f = 0;f < count; f++) {
          try {
            this.render3(faces[f]);
          } catch (_e) {}
        }
      }
      return;
    }
    for (let priority = 0;priority < 12; priority++) {
      Model.tmpPriorityFaceCount[priority] = 0;
      Model.tmpPriorityDepthSum[priority] = 0;
    }
    for (let depth = this.maxDepth - 1;depth >= 0; depth--) {
      const faceCount = Model.tmpDepthFaceCount[depth];
      if (faceCount > 0) {
        const faces = Model.tmpDepthFaces[depth];
        for (let i = 0;i < faceCount; i++) {
          const priorityDepth2 = faces[i];
          const priorityFace2 = this.facePriority[priorityDepth2];
          const priorityFaceCount2 = Model.tmpPriorityFaceCount[priorityFace2]++;
          Model.tmpPriorityFaces[priorityFace2][priorityFaceCount2] = priorityDepth2;
          if (priorityFace2 < 10) {
            Model.tmpPriorityDepthSum[priorityFace2] += depth;
          } else if (priorityFace2 === 10) {
            Model.tmpPriority10FaceDepth[priorityFaceCount2] = depth;
          } else {
            Model.tmpPriority11FaceDepth[priorityFaceCount2] = depth;
          }
        }
      }
    }
    let averagePriorityDepthSum1_2 = 0;
    if (Model.tmpPriorityFaceCount[1] > 0 || Model.tmpPriorityFaceCount[2] > 0) {
      averagePriorityDepthSum1_2 = (Model.tmpPriorityDepthSum[1] + Model.tmpPriorityDepthSum[2]) / (Model.tmpPriorityFaceCount[1] + Model.tmpPriorityFaceCount[2]) | 0;
    }
    let averagePriorityDepthSum3_4 = 0;
    if (Model.tmpPriorityFaceCount[3] > 0 || Model.tmpPriorityFaceCount[4] > 0) {
      averagePriorityDepthSum3_4 = (Model.tmpPriorityDepthSum[3] + Model.tmpPriorityDepthSum[4]) / (Model.tmpPriorityFaceCount[3] + Model.tmpPriorityFaceCount[4]) | 0;
    }
    let averagePriorityDepthSum6_8 = 0;
    if (Model.tmpPriorityFaceCount[6] > 0 || Model.tmpPriorityFaceCount[8] > 0) {
      averagePriorityDepthSum6_8 = (Model.tmpPriorityDepthSum[6] + Model.tmpPriorityDepthSum[8]) / (Model.tmpPriorityFaceCount[6] + Model.tmpPriorityFaceCount[8]) | 0;
    }
    let priorityFace = 0;
    let priorityFaceCount = Model.tmpPriorityFaceCount[10];
    let priorityFaces = Model.tmpPriorityFaces[10];
    let priorityFaceDepths = Model.tmpPriority10FaceDepth;
    if (priorityFace === priorityFaceCount) {
      priorityFace = 0;
      priorityFaceCount = Model.tmpPriorityFaceCount[11];
      priorityFaces = Model.tmpPriorityFaces[11];
      priorityFaceDepths = Model.tmpPriority11FaceDepth;
    }
    let priorityDepth;
    if (priorityFace < priorityFaceCount && priorityFaceDepths) {
      priorityDepth = priorityFaceDepths[priorityFace];
    } else {
      priorityDepth = -1000;
    }
    for (let priority = 0;priority < 10; priority++) {
      while (priority === 0 && priorityDepth > averagePriorityDepthSum1_2) {
        try {
          this.render3(priorityFaces[priorityFace++]);
          if (priorityFace === priorityFaceCount && priorityFaces !== Model.tmpPriorityFaces[11]) {
            priorityFace = 0;
            priorityFaceCount = Model.tmpPriorityFaceCount[11];
            priorityFaces = Model.tmpPriorityFaces[11];
            priorityFaceDepths = Model.tmpPriority11FaceDepth;
          }
          if (priorityFace < priorityFaceCount && priorityFaceDepths) {
            priorityDepth = priorityFaceDepths[priorityFace];
          } else {
            priorityDepth = -1000;
          }
        } catch (_e) {}
      }
      while (priority === 3 && priorityDepth > averagePriorityDepthSum3_4) {
        try {
          this.render3(priorityFaces[priorityFace++]);
          if (priorityFace === priorityFaceCount && priorityFaces !== Model.tmpPriorityFaces[11]) {
            priorityFace = 0;
            priorityFaceCount = Model.tmpPriorityFaceCount[11];
            priorityFaces = Model.tmpPriorityFaces[11];
            priorityFaceDepths = Model.tmpPriority11FaceDepth;
          }
          if (priorityFace < priorityFaceCount && priorityFaceDepths) {
            priorityDepth = priorityFaceDepths[priorityFace];
          } else {
            priorityDepth = -1000;
          }
        } catch (_e) {}
      }
      while (priority === 5 && priorityDepth > averagePriorityDepthSum6_8) {
        try {
          this.render3(priorityFaces[priorityFace++]);
          if (priorityFace === priorityFaceCount && priorityFaces !== Model.tmpPriorityFaces[11]) {
            priorityFace = 0;
            priorityFaceCount = Model.tmpPriorityFaceCount[11];
            priorityFaces = Model.tmpPriorityFaces[11];
            priorityFaceDepths = Model.tmpPriority11FaceDepth;
          }
          if (priorityFace < priorityFaceCount && priorityFaceDepths) {
            priorityDepth = priorityFaceDepths[priorityFace];
          } else {
            priorityDepth = -1000;
          }
        } catch (_e) {}
      }
      const count = Model.tmpPriorityFaceCount[priority];
      const faces = Model.tmpPriorityFaces[priority];
      for (let i = 0;i < count; i++) {
        try {
          this.render3(faces[i]);
        } catch (_e) {}
      }
    }
    while (priorityDepth !== -1000) {
      try {
        this.render3(priorityFaces[priorityFace++]);
        if (priorityFace === priorityFaceCount && priorityFaces !== Model.tmpPriorityFaces[11]) {
          priorityFace = 0;
          priorityFaces = Model.tmpPriorityFaces[11];
          priorityFaceCount = Model.tmpPriorityFaceCount[11];
          priorityFaceDepths = Model.tmpPriority11FaceDepth;
        }
        if (priorityFace < priorityFaceCount && priorityFaceDepths) {
          priorityDepth = priorityFaceDepths[priorityFace];
        } else {
          priorityDepth = -1000;
        }
      } catch (_e) {}
    }
  }
  render3(face) {
    if (Model.faceNearClipped[face]) {
      this.render3ZClip(face);
      return;
    }
    const a = this.faceVertexA[face];
    const b = this.faceVertexB[face];
    const c = this.faceVertexC[face];
    if (Model.faceClippedX) {
      Pix3D.hclip = Model.faceClippedX[face];
    }
    if (!this.faceAlpha) {
      Pix3D.trans = 0;
    } else {
      Pix3D.trans = this.faceAlpha[face];
    }
    let type;
    if (!this.faceRenderType) {
      type = 0;
    } else {
      type = this.faceRenderType[face] & 3;
    }
    if (type === 0) {
      Pix3D.gouraudTriangle(Model.vertexScreenX[a], Model.vertexScreenX[b], Model.vertexScreenX[c], Model.vertexScreenY[a], Model.vertexScreenY[b], Model.vertexScreenY[c], this.faceColourA[face], this.faceColourB[face], this.faceColourC[face]);
    } else if (type === 1) {
      Pix3D.flatTriangle(Model.vertexScreenX[a], Model.vertexScreenX[b], Model.vertexScreenX[c], Model.vertexScreenY[a], Model.vertexScreenY[b], Model.vertexScreenY[c], Pix3D.colourTable[this.faceColourA[face]]);
    } else if (type === 2) {
      const texturedFace = this.faceRenderType[face] >> 2;
      const tA = this.faceTextureP[texturedFace];
      const tB = this.faceTextureM[texturedFace];
      const tC = this.faceTextureN[texturedFace];
      Pix3D.textureTriangle(Model.vertexScreenX[a], Model.vertexScreenX[b], Model.vertexScreenX[c], Model.vertexScreenY[a], Model.vertexScreenY[b], Model.vertexScreenY[c], this.faceColourA[face], this.faceColourB[face], this.faceColourC[face], Model.vertexViewSpaceX[tA], Model.vertexViewSpaceY[tA], Model.vertexViewSpaceZ[tA], Model.vertexViewSpaceX[tB], Model.vertexViewSpaceX[tC], Model.vertexViewSpaceY[tB], Model.vertexViewSpaceY[tC], Model.vertexViewSpaceZ[tB], Model.vertexViewSpaceZ[tC], this.faceColour[face]);
    } else if (type === 3) {
      const texturedFace = this.faceRenderType[face] >> 2;
      const tA = this.faceTextureP[texturedFace];
      const tB = this.faceTextureM[texturedFace];
      const tC = this.faceTextureN[texturedFace];
      Pix3D.textureTriangle(Model.vertexScreenX[a], Model.vertexScreenX[b], Model.vertexScreenX[c], Model.vertexScreenY[a], Model.vertexScreenY[b], Model.vertexScreenY[c], this.faceColourA[face], this.faceColourA[face], this.faceColourA[face], Model.vertexViewSpaceX[tA], Model.vertexViewSpaceY[tA], Model.vertexViewSpaceZ[tA], Model.vertexViewSpaceX[tB], Model.vertexViewSpaceX[tC], Model.vertexViewSpaceY[tB], Model.vertexViewSpaceY[tC], Model.vertexViewSpaceZ[tB], Model.vertexViewSpaceZ[tC], this.faceColour[face]);
    }
  }
  render3ZClip(face) {
    let elements = 0;
    const centerX = Pix3D.originX;
    const centerY = Pix3D.originY;
    const a = this.faceVertexA[face];
    const b = this.faceVertexB[face];
    const c = this.faceVertexC[face];
    const zA = Model.vertexViewSpaceZ[a];
    const zB = Model.vertexViewSpaceZ[b];
    const zC = Model.vertexViewSpaceZ[c];
    if (zA >= 50) {
      Model.clippedX[elements] = Model.vertexScreenX[a];
      Model.clippedY[elements] = Model.vertexScreenY[a];
      Model.clippedColour[elements++] = this.faceColourA[face];
    } else {
      const xA = Model.vertexViewSpaceX[a];
      const yA = Model.vertexViewSpaceY[a];
      const colourA = this.faceColourA[face];
      if (zC >= 50) {
        const scalar = (50 - zA) * Pix3D.divTable2[zC - zA];
        Model.clippedX[elements] = centerX + ((xA + ((Model.vertexViewSpaceX[c] - xA) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedY[elements] = centerY + ((yA + ((Model.vertexViewSpaceY[c] - yA) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedColour[elements++] = colourA + ((this.faceColourC[face] - colourA) * scalar >> 16);
      }
      if (zB >= 50) {
        const scalar = (50 - zA) * Pix3D.divTable2[zB - zA];
        Model.clippedX[elements] = centerX + ((xA + ((Model.vertexViewSpaceX[b] - xA) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedY[elements] = centerY + ((yA + ((Model.vertexViewSpaceY[b] - yA) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedColour[elements++] = colourA + ((this.faceColourB[face] - colourA) * scalar >> 16);
      }
    }
    if (zB >= 50) {
      Model.clippedX[elements] = Model.vertexScreenX[b];
      Model.clippedY[elements] = Model.vertexScreenY[b];
      Model.clippedColour[elements++] = this.faceColourB[face];
    } else {
      const xB = Model.vertexViewSpaceX[b];
      const yB = Model.vertexViewSpaceY[b];
      const colourB = this.faceColourB[face];
      if (zA >= 50) {
        const scalar = (50 - zB) * Pix3D.divTable2[zA - zB];
        Model.clippedX[elements] = centerX + ((xB + ((Model.vertexViewSpaceX[a] - xB) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedY[elements] = centerY + ((yB + ((Model.vertexViewSpaceY[a] - yB) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedColour[elements++] = colourB + ((this.faceColourA[face] - colourB) * scalar >> 16);
      }
      if (zC >= 50) {
        const scalar = (50 - zB) * Pix3D.divTable2[zC - zB];
        Model.clippedX[elements] = centerX + ((xB + ((Model.vertexViewSpaceX[c] - xB) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedY[elements] = centerY + ((yB + ((Model.vertexViewSpaceY[c] - yB) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedColour[elements++] = colourB + ((this.faceColourC[face] - colourB) * scalar >> 16);
      }
    }
    if (zC >= 50) {
      Model.clippedX[elements] = Model.vertexScreenX[c];
      Model.clippedY[elements] = Model.vertexScreenY[c];
      Model.clippedColour[elements++] = this.faceColourC[face];
    } else {
      const xC = Model.vertexViewSpaceX[c];
      const yC = Model.vertexViewSpaceY[c];
      const colourC = this.faceColourC[face];
      if (zB >= 50) {
        const scalar = (50 - zC) * Pix3D.divTable2[zB - zC];
        Model.clippedX[elements] = centerX + ((xC + ((Model.vertexViewSpaceX[b] - xC) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedY[elements] = centerY + ((yC + ((Model.vertexViewSpaceY[b] - yC) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedColour[elements++] = colourC + ((this.faceColourB[face] - colourC) * scalar >> 16);
      }
      if (zA >= 50) {
        const scalar = (50 - zC) * Pix3D.divTable2[zA - zC];
        Model.clippedX[elements] = centerX + ((xC + ((Model.vertexViewSpaceX[a] - xC) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedY[elements] = centerY + ((yC + ((Model.vertexViewSpaceY[a] - yC) * scalar >> 16) << 9) / 50 | 0);
        Model.clippedColour[elements++] = colourC + ((this.faceColourA[face] - colourC) * scalar >> 16);
      }
    }
    const x0 = Model.clippedX[0];
    const x1 = Model.clippedX[1];
    const x2 = Model.clippedX[2];
    const y0 = Model.clippedY[0];
    const y1 = Model.clippedY[1];
    const y2 = Model.clippedY[2];
    if ((x0 - x1) * (y2 - y1) - (y0 - y1) * (x2 - x1) <= 0) {
      return;
    }
    Pix3D.hclip = false;
    if (elements === 3) {
      if (x0 < 0 || x1 < 0 || x2 < 0 || x0 > Pix2D.sizeX || x1 > Pix2D.sizeX || x2 > Pix2D.sizeX) {
        Pix3D.hclip = true;
      }
      let type;
      if (!this.faceRenderType) {
        type = 0;
      } else {
        type = this.faceRenderType[face] & 3;
      }
      if (type === 0) {
        Pix3D.gouraudTriangle(x0, x1, x2, y0, y1, y2, Model.clippedColour[0], Model.clippedColour[1], Model.clippedColour[2]);
      } else if (type === 1 && this.faceColourA) {
        Pix3D.flatTriangle(x0, x1, x2, y0, y1, y2, Pix3D.colourTable[this.faceColourA[face]]);
      } else if (type === 2) {
        const texturedFace = this.faceRenderType[face] >> 2;
        const tA = this.faceTextureP[texturedFace];
        const tB = this.faceTextureM[texturedFace];
        const tC = this.faceTextureN[texturedFace];
        Pix3D.textureTriangle(x0, x1, x2, y0, y1, y2, Model.clippedColour[0], Model.clippedColour[1], Model.clippedColour[2], Model.vertexViewSpaceX[tA], Model.vertexViewSpaceY[tA], Model.vertexViewSpaceZ[tA], Model.vertexViewSpaceX[tB], Model.vertexViewSpaceX[tC], Model.vertexViewSpaceY[tB], Model.vertexViewSpaceY[tC], Model.vertexViewSpaceZ[tB], Model.vertexViewSpaceZ[tC], this.faceColour[face]);
      } else if (type === 3) {
        const texturedFace = this.faceRenderType[face] >> 2;
        const tA = this.faceTextureP[texturedFace];
        const tB = this.faceTextureM[texturedFace];
        const tC = this.faceTextureN[texturedFace];
        Pix3D.textureTriangle(x0, x1, x2, y0, y1, y2, this.faceColourA[face], this.faceColourA[face], this.faceColourA[face], Model.vertexViewSpaceX[tA], Model.vertexViewSpaceY[tA], Model.vertexViewSpaceZ[tA], Model.vertexViewSpaceX[tB], Model.vertexViewSpaceX[tC], Model.vertexViewSpaceY[tB], Model.vertexViewSpaceY[tC], Model.vertexViewSpaceZ[tB], Model.vertexViewSpaceZ[tC], this.faceColour[face]);
      }
    } else if (elements === 4) {
      if (x0 < 0 || x1 < 0 || x2 < 0 || x0 > Pix2D.sizeX || x1 > Pix2D.sizeX || x2 > Pix2D.sizeX || Model.clippedX[3] < 0 || Model.clippedX[3] > Pix2D.sizeX) {
        Pix3D.hclip = true;
      }
      let type;
      if (!this.faceRenderType) {
        type = 0;
      } else {
        type = this.faceRenderType[face] & 3;
      }
      if (type === 0) {
        Pix3D.gouraudTriangle(x0, x1, x2, y0, y1, y2, Model.clippedColour[0], Model.clippedColour[1], Model.clippedColour[2]);
        Pix3D.gouraudTriangle(x0, x2, Model.clippedX[3], y0, y2, Model.clippedY[3], Model.clippedColour[0], Model.clippedColour[2], Model.clippedColour[3]);
      } else if (type === 1) {
        if (this.faceColourA) {
          const colour = Pix3D.colourTable[this.faceColourA[face]];
          Pix3D.flatTriangle(x0, x1, x2, y0, y1, y2, colour);
          Pix3D.flatTriangle(x0, x2, Model.clippedX[3], y0, y2, Model.clippedY[3], colour);
        }
      } else if (type === 2) {
        const texturedFace = this.faceRenderType[face] >> 2;
        const tA = this.faceTextureP[texturedFace];
        const tB = this.faceTextureM[texturedFace];
        const tC = this.faceTextureN[texturedFace];
        Pix3D.textureTriangle(x0, x1, x2, y0, y1, y2, Model.clippedColour[0], Model.clippedColour[1], Model.clippedColour[2], Model.vertexViewSpaceX[tA], Model.vertexViewSpaceY[tA], Model.vertexViewSpaceZ[tA], Model.vertexViewSpaceX[tB], Model.vertexViewSpaceX[tC], Model.vertexViewSpaceY[tB], Model.vertexViewSpaceY[tC], Model.vertexViewSpaceZ[tB], Model.vertexViewSpaceZ[tC], this.faceColour[face]);
        Pix3D.textureTriangle(x0, x2, Model.clippedX[3], y0, y2, Model.clippedY[3], Model.clippedColour[0], Model.clippedColour[2], Model.clippedColour[3], Model.vertexViewSpaceX[tA], Model.vertexViewSpaceY[tA], Model.vertexViewSpaceZ[tA], Model.vertexViewSpaceX[tB], Model.vertexViewSpaceX[tC], Model.vertexViewSpaceY[tB], Model.vertexViewSpaceY[tC], Model.vertexViewSpaceZ[tB], Model.vertexViewSpaceZ[tC], this.faceColour[face]);
      } else if (type === 3) {
        const texturedFace = this.faceRenderType[face] >> 2;
        const tA = this.faceTextureP[texturedFace];
        const tB = this.faceTextureM[texturedFace];
        const tC = this.faceTextureN[texturedFace];
        Pix3D.textureTriangle(x0, x1, x2, y0, y1, y2, this.faceColourA[face], this.faceColourA[face], this.faceColourA[face], Model.vertexViewSpaceX[tA], Model.vertexViewSpaceY[tA], Model.vertexViewSpaceZ[tA], Model.vertexViewSpaceX[tB], Model.vertexViewSpaceX[tC], Model.vertexViewSpaceY[tB], Model.vertexViewSpaceY[tC], Model.vertexViewSpaceZ[tB], Model.vertexViewSpaceZ[tC], this.faceColour[face]);
        Pix3D.textureTriangle(x0, x2, Model.clippedX[3], y0, y2, Model.clippedY[3], this.faceColourA[face], this.faceColourA[face], this.faceColourA[face], Model.vertexViewSpaceX[tA], Model.vertexViewSpaceY[tA], Model.vertexViewSpaceZ[tA], Model.vertexViewSpaceX[tB], Model.vertexViewSpaceX[tC], Model.vertexViewSpaceY[tB], Model.vertexViewSpaceY[tC], Model.vertexViewSpaceZ[tB], Model.vertexViewSpaceZ[tC], this.faceColour[face]);
      }
    }
  }
  isMouseRoughlyInsideTriangle(x, y, yA, yB, yC, xA, xB, xC) {
    if (y < yA && y < yB && y < yC) {
      return false;
    } else if (y > yA && y > yB && y > yC) {
      return false;
    } else if (x < xA && x < xB && x < xC) {
      return false;
    } else if (x > xA && x > xB && x > xC) {
      return false;
    } else {
      return true;
    }
  }
}

// src/config/LocType.ts
class LocType {
  static numDefinitions = 0;
  static idx = null;
  static dat = null;
  static recent = null;
  static recentPos = 0;
  static mc1 = new LruCache(500);
  static mc2 = new LruCache(30);
  static temp = new Array(4);
  id = -1;
  model = null;
  shape = null;
  name = null;
  desc = null;
  recol_s = null;
  recol_d = null;
  width = 1;
  length = 1;
  blockwalk = true;
  blockrange = true;
  active = false;
  hillskew = false;
  sharelight = false;
  occlude = false;
  anim = -1;
  wallwidth = 16;
  ambient = 0;
  contrast = 0;
  op = null;
  mapfunction = -1;
  mapscene = -1;
  mirror = false;
  shadow = true;
  resizex = 128;
  resizey = 128;
  resizez = 128;
  offsetx = 0;
  offsety = 0;
  offsetz = 0;
  forceapproach = 0;
  forcedecor = false;
  breakroutefinding = false;
  raiseobject = 0;
  static init(config) {
    this.dat = new Packet(config.read("loc.dat"));
    const idx = new Packet(config.read("loc.idx"));
    this.numDefinitions = idx.g2();
    this.idx = new Int32Array(this.numDefinitions);
    let offset = 2;
    for (let id = 0;id < this.numDefinitions; id++) {
      this.idx[id] = offset;
      offset += idx.g2();
    }
    this.recent = new TypedArray1d(10, null);
    for (let id = 0;id < 10; id++) {
      this.recent[id] = new LocType;
    }
  }
  static list(id) {
    if (!this.recent || !this.idx || !this.dat) {
      throw new Error;
    }
    for (let i = 0;i < 10; i++) {
      const type = this.recent[i];
      if (type && type.id === id) {
        return type;
      }
    }
    this.recentPos = (this.recentPos + 1) % 10;
    const loc = this.recent[this.recentPos];
    this.dat.pos = this.idx[id];
    loc.id = id;
    loc.reset();
    loc.decode(this.dat);
    return loc;
  }
  reset() {
    this.model = null;
    this.shape = null;
    this.name = null;
    this.desc = null;
    this.recol_s = null;
    this.recol_d = null;
    this.width = 1;
    this.length = 1;
    this.blockwalk = true;
    this.blockrange = true;
    this.active = false;
    this.hillskew = false;
    this.sharelight = false;
    this.occlude = false;
    this.anim = -1;
    this.wallwidth = 16;
    this.ambient = 0;
    this.contrast = 0;
    this.op = null;
    this.mapfunction = -1;
    this.mapscene = -1;
    this.mirror = false;
    this.shadow = true;
    this.resizex = 128;
    this.resizey = 128;
    this.resizez = 128;
    this.forceapproach = 0;
    this.offsetx = 0;
    this.offsety = 0;
    this.offsetz = 0;
    this.forcedecor = false;
    this.breakroutefinding = false;
    this.raiseobject = -1;
  }
  decode(dat) {
    let active = -1;
    while (true) {
      const code = dat.g1();
      if (code === 0) {
        break;
      }
      if (code === 1) {
        const count = dat.g1();
        this.model = new Int32Array(count);
        this.shape = new Int32Array(count);
        for (let i = 0;i < count; i++) {
          this.model[i] = dat.g2();
          this.shape[i] = dat.g1();
        }
      } else if (code === 2) {
        this.name = dat.gjstr();
      } else if (code === 3) {
        this.desc = dat.gjstr();
      } else if (code === 5) {
        const count = dat.g1();
        this.model = new Int32Array(count);
        this.shape = null;
        for (let i = 0;i < count; i++) {
          this.model[i] = dat.g2();
        }
      } else if (code === 14) {
        this.width = dat.g1();
      } else if (code === 15) {
        this.length = dat.g1();
      } else if (code === 17) {
        this.blockwalk = false;
      } else if (code === 18) {
        this.blockrange = false;
      } else if (code === 19) {
        active = dat.g1();
        if (active === 1) {
          this.active = true;
        }
      } else if (code === 21) {
        this.hillskew = true;
      } else if (code === 22) {
        this.sharelight = true;
      } else if (code === 23) {
        this.occlude = true;
      } else if (code === 24) {
        this.anim = dat.g2();
        if (this.anim === 65535) {
          this.anim = -1;
        }
      } else if (code === 28) {
        this.wallwidth = dat.g1();
      } else if (code === 29) {
        this.ambient = dat.g1b();
      } else if (code === 39) {
        this.contrast = dat.g1b();
      } else if (code >= 30 && code < 39) {
        if (!this.op) {
          this.op = new TypedArray1d(5, null);
        }
        this.op[code - 30] = dat.gjstr();
        if (this.op[code - 30]?.toLowerCase() === "hidden") {
          this.op[code - 30] = null;
        }
      } else if (code === 40) {
        const count = dat.g1();
        this.recol_s = new Uint16Array(count);
        this.recol_d = new Uint16Array(count);
        for (let i = 0;i < count; i++) {
          this.recol_s[i] = dat.g2();
          this.recol_d[i] = dat.g2();
        }
      } else if (code === 60) {
        this.mapfunction = dat.g2();
      } else if (code === 62) {
        this.mirror = true;
      } else if (code === 64) {
        this.shadow = false;
      } else if (code === 65) {
        this.resizex = dat.g2();
      } else if (code === 66) {
        this.resizey = dat.g2();
      } else if (code === 67) {
        this.resizez = dat.g2();
      } else if (code === 68) {
        this.mapscene = dat.g2();
      } else if (code === 69) {
        this.forceapproach = dat.g1();
      } else if (code === 70) {
        this.offsetx = dat.g2b();
      } else if (code === 71) {
        this.offsety = dat.g2b();
      } else if (code === 72) {
        this.offsetz = dat.g2b();
      } else if (code === 73) {
        this.forcedecor = true;
      } else if (code === 74) {
        this.breakroutefinding = true;
      } else if (code === 75) {
        this.raiseobject = dat.g1();
      }
    }
    if (active === -1) {
      this.active = false;
      if (this.model && (!this.shape || this.shape && this.shape[0] === 10 /* CENTREPIECE_STRAIGHT */)) {
        this.active = true;
      }
      if (this.op) {
        this.active = true;
      }
    }
    if (this.breakroutefinding) {
      this.blockwalk = false;
      this.blockrange = false;
    }
    if (this.raiseobject === -1) {
      this.raiseobject = this.blockwalk ? 1 : 0;
    }
  }
  checkModel(shape) {
    if (this.model === null) {
      return true;
    }
    if (this.shape !== null) {
      for (let i = 0;i < this.shape.length; i++) {
        if (this.shape[i] === shape) {
          return Model.requestDownload(this.model[i] & 65535);
        }
      }
      return true;
    } else if (shape === 10 /* CENTREPIECE_STRAIGHT */) {
      let ready = true;
      for (let i = 0;i < this.model.length; i++) {
        const model = this.model[i];
        if (!Model.requestDownload(model & 65535)) {
          ready = false;
        }
      }
      return ready;
    }
    return true;
  }
  checkModelAll() {
    if (this.model == null) {
      return true;
    }
    let ready = true;
    for (let i = 0;i < this.model.length; i++) {
      const model = this.model[i];
      if (!Model.requestDownload(model & 65535)) {
        ready = false;
      }
    }
    return ready;
  }
  prefetchModelAll(od) {
    if (this.model == null) {
      return;
    }
    for (let i = 0;i < this.model.length; i++) {
      const model = this.model[i];
      if (model != -1) {
        od.prefetch(0, model & 65535);
      }
    }
  }
  getModel(shape, angle, heightSW, heightSE, heightNE, heightNW, transformId) {
    let modified = this.buildModel(shape, angle, transformId);
    if (!modified) {
      return null;
    }
    if (this.hillskew || this.sharelight) {
      modified = Model.hillSkewCopy(modified, this.hillskew, this.sharelight);
    }
    if (this.hillskew) {
      const groundY = (heightSW + heightSE + heightNE + heightNW) / 4 | 0;
      for (let i = 0;i < modified.vertexCount; i++) {
        const x = modified.vertexX[i];
        const z = modified.vertexZ[i];
        const heightS = heightSW + ((heightSE - heightSW) * (x + 64) / 128 | 0);
        const heightN = heightNW + ((heightNE - heightNW) * (x + 64) / 128 | 0);
        const y = heightS + ((heightN - heightS) * (z + 64) / 128 | 0);
        modified.vertexY[i] += y - groundY;
      }
      modified.recalcBoundingCylinder();
    }
    return modified;
  }
  buildModel(shape, angle, transformId) {
    let model = null;
    let typecode = 0n;
    if (this.shape === null) {
      if (shape !== 10 /* CENTREPIECE_STRAIGHT */) {
        return null;
      }
      typecode = (BigInt(transformId) + 1n << 32n) + (BigInt(this.id) << 6n) + BigInt(angle);
      const cached = LocType.mc2.find(typecode);
      if (cached) {
        return cached;
      }
      if (!this.model) {
        return null;
      }
      const flip = this.mirror !== angle > 3;
      const modelCount = this.model.length;
      for (let i = 0;i < modelCount; i++) {
        let modelId = this.model[i];
        if (flip) {
          modelId += 65536;
        }
        model = LocType.mc1.find(BigInt(modelId));
        if (!model) {
          model = Model.load(modelId & 65535);
          if (!model) {
            return null;
          }
          if (flip) {
            model.mirror();
          }
          LocType.mc1.put(model, BigInt(modelId));
        }
        if (modelCount > 1) {
          LocType.temp[i] = model;
        }
      }
      if (modelCount > 1) {
        model = Model.combineForAnim(LocType.temp, modelCount);
      }
    } else {
      let index = -1;
      for (let i = 0;i < this.shape.length; i++) {
        if (this.shape[i] === shape) {
          index = i;
          break;
        }
      }
      if (index === -1) {
        return null;
      }
      typecode = (BigInt(transformId) + 1n << 32n) + (BigInt(this.id) << 6n) + (BigInt(index) << 3n) + BigInt(angle);
      const cached = LocType.mc2.find(typecode);
      if (cached) {
        return cached;
      }
      if (!this.model || index >= this.model.length) {
        return null;
      }
      let modelId = this.model[index];
      if (modelId === -1) {
        return null;
      }
      const flip = this.mirror !== angle > 3;
      if (flip) {
        modelId += 65536;
      }
      model = LocType.mc1.find(BigInt(modelId));
      if (!model) {
        model = Model.load(modelId & 65535);
        if (!model) {
          return null;
        }
        if (flip) {
          model.mirror();
        }
        LocType.mc1.put(model, BigInt(modelId));
      }
    }
    if (!model) {
      return null;
    }
    const scaled = this.resizex !== 128 || this.resizey !== 128 || this.resizez !== 128;
    const translated = this.offsetx !== 0 || this.offsety !== 0 || this.offsetz !== 0;
    const modified = Model.copyForAnim(model, !this.recol_s, AnimFrame.shareAlpha(transformId), angle === 0 /* WEST */ && transformId === -1 && !scaled && !translated);
    if (transformId !== -1) {
      modified.prepareAnim();
      modified.animate(transformId);
      modified.labelFaces = null;
      modified.labelVertices = null;
    }
    while (angle-- > 0) {
      modified.rotate90();
    }
    if (this.recol_s && this.recol_d) {
      for (let i = 0;i < this.recol_s.length; i++) {
        modified.recolour(this.recol_s[i], this.recol_d[i]);
      }
    }
    if (scaled) {
      modified.resize(this.resizex, this.resizey, this.resizez);
    }
    if (translated) {
      modified.translate(this.offsety, this.offsetx, this.offsetz);
    }
    modified.calculateNormals((this.ambient & 255) + 64, (this.contrast & 255) * 5 + 768, -50, -10, -50, !this.sharelight);
    if (this.raiseobject === 1) {
      modified.objRaise = modified.minY;
    }
    LocType.mc2.put(modified, typecode);
    return modified;
  }
}

// src/graphics/Jpeg.ts
var jpegCanvas = document.createElement("canvas");
var jpegImg = document.createElement("img");
var jpeg2d = jpegCanvas.getContext("2d", {
  willReadFrequently: true
});
async function decodeJpeg(data) {
  if (data[0] !== 255) {
    data[0] = 255;
  }
  URL.revokeObjectURL(jpegImg.src);
  jpegImg.src = URL.createObjectURL(new Blob([data], { type: "image/jpeg" }));
  await new Promise((resolve) => jpegImg.onload = () => resolve());
  jpeg2d.clearRect(0, 0, jpegCanvas.width, jpegCanvas.height);
  const width = jpegImg.naturalWidth;
  const height = jpegImg.naturalHeight;
  jpegCanvas.width = width;
  jpegCanvas.height = height;
  jpeg2d.drawImage(jpegImg, 0, 0);
  return jpeg2d.getImageData(0, 0, width, height);
}

// src/graphics/Pix32.ts
class Pix32 extends Pix2D {
  data;
  wi;
  hi;
  xof;
  yof;
  owi;
  ohi;
  constructor(width, height) {
    super();
    this.data = new Int32Array(width * height);
    this.wi = this.owi = width;
    this.hi = this.ohi = height;
    this.xof = this.yof = 0;
  }
  static async fromJpeg(archive, name) {
    const dat = archive.read(name + ".dat");
    if (!dat) {
      throw new Error;
    }
    const jpeg = await decodeJpeg(dat);
    const image = new Pix32(jpeg.width, jpeg.height);
    const data = new Uint32Array(jpeg.data.buffer);
    for (let i = 0;i < image.data.length; i++) {
      const pixel = data[i];
      image.data[i] = (pixel >> 24 & 255) << 24 | (pixel & 255) << 16 | (pixel >> 8 & 255) << 8 | pixel >> 16 & 255;
    }
    return image;
  }
  static depack(jag, name, sprite = 0) {
    const dat = new Packet(jag.read(name + ".dat"));
    const index = new Packet(jag.read("index.dat"));
    index.pos = dat.g2();
    const owi = index.g2();
    const ohi = index.g2();
    const bpalCount = index.g1();
    const bpal = new Int32Array(bpalCount);
    for (let i = 0;i < bpalCount - 1; i++) {
      bpal[i + 1] = index.g3();
      if (bpal[i + 1] === 0) {
        bpal[i + 1] = 1;
      }
    }
    for (let i = 0;i < sprite; i++) {
      index.pos += 2;
      dat.pos += index.g2() * index.g2();
      index.pos += 1;
    }
    if (dat.pos > dat.length || index.pos > index.length) {
      throw new Error;
    }
    const xof = index.g1();
    const yof = index.g1();
    const wi = index.g2();
    const hi = index.g2();
    const image = new Pix32(wi, hi);
    image.xof = xof;
    image.yof = yof;
    image.owi = owi;
    image.ohi = ohi;
    const encoding = index.g1();
    if (encoding === 0) {
      for (let i = 0;i < image.wi * image.hi; i++) {
        image.data[i] = bpal[dat.g1()];
      }
    } else if (encoding === 1) {
      for (let x = 0;x < image.wi; x++) {
        for (let y = 0;y < image.hi; y++) {
          image.data[x + y * image.wi] = bpal[dat.g1()];
        }
      }
    }
    return image;
  }
  setPixels() {
    Pix2D.setPixels(this.data, this.wi, this.hi);
  }
  rgbAdjust(r, g, b) {
    for (let i = 0;i < this.data.length; i++) {
      const rgb = this.data[i];
      if (rgb !== 0) {
        let red = rgb >> 16 & 255;
        red += r;
        if (red < 1) {
          red = 1;
        } else if (red > 255) {
          red = 255;
        }
        let green = rgb >> 8 & 255;
        green += g;
        if (green < 1) {
          green = 1;
        } else if (green > 255) {
          green = 255;
        }
        let blue = rgb & 255;
        blue += b;
        if (blue < 1) {
          blue = 1;
        } else if (blue > 255) {
          blue = 255;
        }
        this.data[i] = (red << 16) + (green << 8) + blue;
      }
    }
  }
  trim() {
    const pixels = new Int32Array(this.owi * this.ohi);
    for (let y = 0;y < this.hi; y++) {
      for (let x = 0;x < this.wi; x++) {
        pixels[(this.yof + y) * this.owi + this.xof + x] = this.data[this.wi * y + x];
      }
    }
    this.data = pixels;
    this.wi = this.owi;
    this.hi = this.ohi;
    this.xof = 0;
    this.yof = 0;
  }
  hflip() {
    const pixels = this.data;
    const width = this.wi;
    const height = this.hi;
    for (let y = 0;y < height; y++) {
      const div = width / 2 | 0;
      for (let x = 0;x < div; x++) {
        const off1 = x + y * width;
        const off2 = width - x - 1 + y * width;
        const tmp = pixels[off1];
        pixels[off1] = pixels[off2];
        pixels[off2] = tmp;
      }
    }
  }
  vflip() {
    const pixels = this.data;
    const width = this.wi;
    const height = this.hi;
    for (let y = 0;y < (height / 2 | 0); y++) {
      for (let x = 0;x < width; x++) {
        const off1 = x + y * width;
        const off2 = x + (height - y - 1) * width;
        const tmp = pixels[off1];
        pixels[off1] = pixels[off2];
        pixels[off2] = tmp;
      }
    }
  }
  quickPlotSprite(x, y) {
    x |= 0;
    y |= 0;
    x += this.xof;
    y += this.yof;
    let dstOff = x + y * Pix2D.width;
    let srcOff = 0;
    let h = this.hi;
    let w = this.wi;
    let dstStep = Pix2D.width - w;
    let srcStep = 0;
    if (y < Pix2D.clipMinY) {
      const cutoff = Pix2D.clipMinY - y;
      h -= cutoff;
      y = Pix2D.clipMinY;
      srcOff += cutoff * w;
      dstOff += cutoff * Pix2D.width;
    }
    if (y + h > Pix2D.clipMaxY) {
      h -= y + h - Pix2D.clipMaxY;
    }
    if (x < Pix2D.clipMinX) {
      const cutoff = Pix2D.clipMinX - x;
      w -= cutoff;
      x = Pix2D.clipMinX;
      srcOff += cutoff;
      dstOff += cutoff;
      srcStep += cutoff;
      dstStep += cutoff;
    }
    if (x + w > Pix2D.clipMaxX) {
      const cutoff = x + w - Pix2D.clipMaxX;
      w -= cutoff;
      srcStep += cutoff;
      dstStep += cutoff;
    }
    if (w > 0 && h > 0) {
      this.plotQuick(w, h, this.data, srcOff, srcStep, Pix2D.pixels, dstOff, dstStep);
    }
  }
  plotQuick(w, h, src, srcOff, srcStep, dst, dstOff, dstStep) {
    const qw = -(w >> 2);
    w = -(w & 3);
    for (let y = -h;y < 0; y++) {
      for (let x = qw;x < 0; x++) {
        dst[dstOff++] = src[srcOff++];
        dst[dstOff++] = src[srcOff++];
        dst[dstOff++] = src[srcOff++];
        dst[dstOff++] = src[srcOff++];
      }
      for (let x = w;x < 0; x++) {
        dst[dstOff++] = src[srcOff++];
      }
      dstOff += dstStep;
      srcOff += srcStep;
    }
  }
  plotSprite(x, y) {
    x |= 0;
    y |= 0;
    x += this.xof;
    y += this.yof;
    let dstOff = x + y * Pix2D.width;
    let srcOff = 0;
    let h = this.hi;
    let w = this.wi;
    let dstStep = Pix2D.width - w;
    let srcStep = 0;
    if (y < Pix2D.clipMinY) {
      const cutoff = Pix2D.clipMinY - y;
      h -= cutoff;
      y = Pix2D.clipMinY;
      srcOff += cutoff * w;
      dstOff += cutoff * Pix2D.width;
    }
    if (y + h > Pix2D.clipMaxY) {
      h -= y + h - Pix2D.clipMaxY;
    }
    if (x < Pix2D.clipMinX) {
      const cutoff = Pix2D.clipMinX - x;
      w -= cutoff;
      x = Pix2D.clipMinX;
      srcOff += cutoff;
      dstOff += cutoff;
      srcStep += cutoff;
      dstStep += cutoff;
    }
    if (x + w > Pix2D.clipMaxX) {
      const cutoff = x + w - Pix2D.clipMaxX;
      w -= cutoff;
      srcStep += cutoff;
      dstStep += cutoff;
    }
    if (w > 0 && h > 0) {
      this.plot(w, h, this.data, srcOff, srcStep, Pix2D.pixels, dstOff, dstStep);
    }
  }
  plot(w, h, src, srcOff, srcStep, dst, dstOff, dstStep) {
    const qw = -(w >> 2);
    w = -(w & 3);
    for (let y = -h;y < 0; y++) {
      for (let x = qw;x < 0; x++) {
        let rgb = src[srcOff++];
        if (rgb === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = rgb;
        }
        rgb = src[srcOff++];
        if (rgb === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = rgb;
        }
        rgb = src[srcOff++];
        if (rgb === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = rgb;
        }
        rgb = src[srcOff++];
        if (rgb === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = rgb;
        }
      }
      for (let x = w;x < 0; x++) {
        const rgb = src[srcOff++];
        if (rgb === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = rgb;
        }
      }
      dstOff += dstStep;
      srcOff += srcStep;
    }
  }
  transPlotSprite(x, y, alpha) {
    x |= 0;
    y |= 0;
    x += this.xof;
    y += this.yof;
    let dstStep = x + y * Pix2D.width;
    let srcStep = 0;
    let h = this.hi;
    let w = this.wi;
    let dstOff = Pix2D.width - w;
    let srcOff = 0;
    if (y < Pix2D.clipMinY) {
      const cutoff = Pix2D.clipMinY - y;
      h -= cutoff;
      y = Pix2D.clipMinY;
      srcStep += cutoff * w;
      dstStep += cutoff * Pix2D.width;
    }
    if (y + h > Pix2D.clipMaxY) {
      h -= y + h - Pix2D.clipMaxY;
    }
    if (x < Pix2D.clipMinX) {
      const cutoff = Pix2D.clipMinX - x;
      w -= cutoff;
      x = Pix2D.clipMinX;
      srcStep += cutoff;
      dstStep += cutoff;
      srcOff += cutoff;
      dstOff += cutoff;
    }
    if (x + w > Pix2D.clipMaxX) {
      const cutoff = x + w - Pix2D.clipMaxX;
      w -= cutoff;
      srcOff += cutoff;
      dstOff += cutoff;
    }
    if (w > 0 && h > 0) {
      this.tranSprite(Pix2D.pixels, this.data, srcStep, dstStep, w, h, dstOff, srcOff, alpha);
    }
  }
  tranSprite(dst, src, srcOff, dstOff, w, h, dstStep, srcStep, alpha) {
    const invAlpha = 256 - alpha;
    for (let y = -h;y < 0; y++) {
      for (let x = -w;x < 0; x++) {
        const rgb = src[srcOff++];
        if (rgb === 0) {
          dstOff++;
        } else {
          const dstRgb = dst[dstOff];
          dst[dstOff++] = ((rgb & 16711935) * alpha + (dstRgb & 16711935) * invAlpha & 4278255360) + ((rgb & 65280) * alpha + (dstRgb & 65280) * invAlpha & 16711680) >> 8;
        }
      }
      dstOff += dstStep;
      srcOff += srcStep;
    }
  }
  scanlineRotatePlotSprite(x, y, w, h, anchorX, anchorY, theta, zoom, lineStart, lineWidth) {
    x |= 0;
    y |= 0;
    w |= 0;
    h |= 0;
    try {
      const centerX = -w / 2 | 0;
      const centerY = -h / 2 | 0;
      const sin = Math.sin(theta / 326.11) * 65536 | 0;
      const cos = Math.cos(theta / 326.11) * 65536 | 0;
      const sinZoom = sin * zoom >> 8;
      const cosZoom = cos * zoom >> 8;
      let leftX = (anchorX << 16) + centerY * sinZoom + centerX * cosZoom;
      let leftY = (anchorY << 16) + (centerY * cosZoom - centerX * sinZoom);
      let leftOff = x + y * Pix2D.width;
      for (let i = 0;i < h; i++) {
        const dstOff = lineStart[i];
        let dstX = leftOff + dstOff;
        let srcX = leftX + cosZoom * dstOff;
        let srcY = leftY - sinZoom * dstOff;
        for (let j = -lineWidth[i];j < 0; j++) {
          Pix2D.pixels[dstX++] = this.data[(srcX >> 16) + (srcY >> 16) * this.wi];
          srcX += cosZoom;
          srcY -= sinZoom;
        }
        leftX += sinZoom;
        leftY += cosZoom;
        leftOff += Pix2D.width;
      }
    } catch (_e) {}
  }
  rotatePlotSprite(x, y, w, h, anchorX, anchorY, theta, zoom) {
    x |= 0;
    y |= 0;
    w |= 0;
    h |= 0;
    try {
      const centerX = -w / 2 | 0;
      const centerY = -h / 2 | 0;
      const sin = Math.sin(theta) * 65536 | 0;
      const cos = Math.cos(theta) * 65536 | 0;
      const sinZoom = sin * zoom >> 8;
      const cosZoom = cos * zoom >> 8;
      let leftX = (anchorX << 16) + (centerY * sinZoom + centerX * cosZoom);
      let leftY = (anchorY << 16) + (centerY * cosZoom - centerX * sinZoom);
      let leftOff = x + y * Pix2D.width;
      for (let i = 0;i < h; i++) {
        let dstX = leftOff;
        let srcX = leftX;
        let srcY = leftY;
        for (let j = -w;j < 0; j++) {
          const rgb = this.data[(srcX >> 16) + (srcY >> 16) * this.owi];
          if (rgb == 0) {
            dstX++;
          } else {
            Pix2D.pixels[dstX++] = rgb;
          }
          srcX += cosZoom;
          srcY -= sinZoom;
        }
        leftX += sinZoom;
        leftY += cosZoom;
        leftOff += Pix2D.width;
      }
    } catch (_e) {}
  }
  scanlinePlotSprite(mask, x, y) {
    x |= 0;
    y |= 0;
    x += this.xof;
    y += this.yof;
    let dstStep = x + y * Pix2D.width;
    let srcStep = 0;
    let h = this.hi;
    let w = this.wi;
    let dstOff = Pix2D.width - w;
    let srcOff = 0;
    if (y < Pix2D.clipMinY) {
      const cutoff = Pix2D.clipMinY - y;
      h -= cutoff;
      y = Pix2D.clipMinY;
      srcStep += cutoff * w;
      dstStep += cutoff * Pix2D.width;
    }
    if (y + h > Pix2D.clipMaxY) {
      h -= y + h - Pix2D.clipMaxY;
    }
    if (x < Pix2D.clipMinX) {
      const cutoff = Pix2D.clipMinX - x;
      w -= cutoff;
      x = Pix2D.clipMinX;
      srcStep += cutoff;
      dstStep += cutoff;
      srcOff += cutoff;
      dstOff += cutoff;
    }
    if (x + w > Pix2D.clipMaxX) {
      const cutoff = x + w - Pix2D.clipMaxX;
      w -= cutoff;
      srcOff += cutoff;
      dstOff += cutoff;
    }
    if (w > 0 && h > 0) {
      this.plotScanline(Pix2D.pixels, this.data, srcStep, dstStep, w, h, dstOff, srcOff, mask.data);
    }
  }
  plotScanline(dst, src, srcOff, dstOff, w, h, dstStep, srcStep, mask) {
    const qw = -(w >> 2);
    w = -(w & 3);
    for (let y = -h;y < 0; y++) {
      for (let x = qw;x < 0; x++) {
        let rgb = src[srcOff++];
        if (rgb !== 0 && mask[dstOff] === 0) {
          dst[dstOff++] = rgb;
        } else {
          dstOff++;
        }
        rgb = src[srcOff++];
        if (rgb !== 0 && mask[dstOff] === 0) {
          dst[dstOff++] = rgb;
        } else {
          dstOff++;
        }
        rgb = src[srcOff++];
        if (rgb !== 0 && mask[dstOff] === 0) {
          dst[dstOff++] = rgb;
        } else {
          dstOff++;
        }
        rgb = src[srcOff++];
        if (rgb !== 0 && mask[dstOff] === 0) {
          dst[dstOff++] = rgb;
        } else {
          dstOff++;
        }
      }
      for (let x = w;x < 0; x++) {
        const rgb = src[srcOff++];
        if (rgb !== 0 && mask[dstOff] === 0) {
          dst[dstOff++] = rgb;
        } else {
          dstOff++;
        }
      }
      dstOff += dstStep;
      srcOff += srcStep;
    }
  }
}

// src/config/ObjType.ts
class ObjType {
  static numDefinitions = 0;
  static idx = null;
  static dat = null;
  static recent = null;
  static recentPos = 0;
  static memServer = true;
  static modelCache = new LruCache(50);
  static spriteCache = new LruCache(200);
  id = -1;
  model = 0;
  name = null;
  desc = null;
  recol_s = null;
  recol_d = null;
  zoom2d = 2000;
  xan2d = 0;
  yan2d = 0;
  zan2d = 0;
  xof2d = 0;
  yof2d = 0;
  stackable = false;
  cost = 1;
  members = false;
  op = null;
  iop = null;
  manwear = -1;
  manwear2 = -1;
  manwearOffsetY = 0;
  womanwear = -1;
  womanwear2 = -1;
  womanwearOffsetY = 0;
  manwear3 = -1;
  womanwear3 = -1;
  manhead = -1;
  manhead2 = -1;
  womanhead = -1;
  womanhead2 = -1;
  countobj = null;
  countco = null;
  certlink = -1;
  certtemplate = -1;
  resizex = 0;
  resizey = 0;
  resizez = 0;
  ambient = 0;
  contrast = 0;
  static init(config, members) {
    this.memServer = members;
    this.dat = new Packet(config.read("obj.dat"));
    const idx = new Packet(config.read("obj.idx"));
    this.numDefinitions = idx.g2();
    this.idx = new Int32Array(this.numDefinitions);
    let offset = 2;
    for (let id = 0;id < this.numDefinitions; id++) {
      this.idx[id] = offset;
      offset += idx.g2();
    }
    this.recent = new TypedArray1d(10, null);
    for (let id = 0;id < 10; id++) {
      this.recent[id] = new ObjType;
    }
  }
  static list(id) {
    if (!this.recent || !this.idx || !this.dat) {
      throw new Error;
    }
    for (let i = 0;i < 10; i++) {
      const type = this.recent[i];
      if (type && type.id === id) {
        return type;
      }
    }
    this.recentPos = (this.recentPos + 1) % 10;
    const obj = this.recent[this.recentPos];
    this.dat.pos = this.idx[id];
    obj.id = id;
    obj.reset();
    obj.decode(this.dat);
    if (obj.certtemplate !== -1) {
      obj.genCert();
    }
    if (!this.memServer && obj.members) {
      obj.name = "Members Object";
      obj.desc = "Login to a members' server to use this object.";
      obj.op = null;
      obj.iop = null;
    }
    return obj;
  }
  reset() {
    this.model = 0;
    this.name = null;
    this.desc = null;
    this.recol_s = null;
    this.recol_d = null;
    this.zoom2d = 2000;
    this.xan2d = 0;
    this.yan2d = 0;
    this.zan2d = 0;
    this.xof2d = 0;
    this.yof2d = 0;
    this.stackable = false;
    this.cost = 1;
    this.members = false;
    this.op = null;
    this.iop = null;
    this.manwear = -1;
    this.manwear2 = -1;
    this.manwearOffsetY = 0;
    this.womanwear = -1;
    this.womanwear2 = -1;
    this.womanwearOffsetY = 0;
    this.manwear3 = -1;
    this.womanwear3 = -1;
    this.manhead = -1;
    this.manhead2 = -1;
    this.womanhead = -1;
    this.womanhead2 = -1;
    this.countobj = null;
    this.countco = null;
    this.certlink = -1;
    this.certtemplate = -1;
    this.resizex = 128;
    this.resizey = 128;
    this.resizez = 128;
    this.ambient = 0;
    this.contrast = 0;
  }
  decode(dat) {
    while (true) {
      const code = dat.g1();
      if (code === 0) {
        break;
      }
      if (code === 1) {
        this.model = dat.g2();
      } else if (code === 2) {
        this.name = dat.gjstr();
      } else if (code === 3) {
        this.desc = dat.gjstr();
      } else if (code === 4) {
        this.zoom2d = dat.g2();
      } else if (code === 5) {
        this.xan2d = dat.g2();
      } else if (code === 6) {
        this.yan2d = dat.g2();
      } else if (code === 7) {
        this.xof2d = dat.g2b();
        if (this.xof2d > 32767) {
          this.xof2d -= 65536;
        }
      } else if (code === 8) {
        this.yof2d = dat.g2b();
        if (this.yof2d > 32767) {
          this.yof2d -= 65536;
        }
      } else if (code === 10) {
        dat.pos += 2;
      } else if (code === 11) {
        this.stackable = true;
      } else if (code === 12) {
        this.cost = dat.g4();
      } else if (code === 16) {
        this.members = true;
      } else if (code === 23) {
        this.manwear = dat.g2();
        this.manwearOffsetY = dat.g1b();
      } else if (code === 24) {
        this.manwear2 = dat.g2();
      } else if (code === 25) {
        this.womanwear = dat.g2();
        this.womanwearOffsetY = dat.g1b();
      } else if (code === 26) {
        this.womanwear2 = dat.g2();
      } else if (code >= 30 && code < 35) {
        if (!this.op) {
          this.op = new TypedArray1d(5, null);
        }
        this.op[code - 30] = dat.gjstr();
        if (this.op[code - 30]?.toLowerCase() === "hidden") {
          this.op[code - 30] = null;
        }
      } else if (code >= 35 && code < 40) {
        if (!this.iop) {
          this.iop = new TypedArray1d(5, null);
        }
        this.iop[code - 35] = dat.gjstr();
      } else if (code === 40) {
        const count = dat.g1();
        this.recol_s = new Uint16Array(count);
        this.recol_d = new Uint16Array(count);
        for (let i = 0;i < count; i++) {
          this.recol_s[i] = dat.g2();
          this.recol_d[i] = dat.g2();
        }
      } else if (code === 78) {
        this.manwear3 = dat.g2();
      } else if (code === 79) {
        this.womanwear3 = dat.g2();
      } else if (code === 90) {
        this.manhead = dat.g2();
      } else if (code === 91) {
        this.womanhead = dat.g2();
      } else if (code === 92) {
        this.manhead2 = dat.g2();
      } else if (code === 93) {
        this.womanhead2 = dat.g2();
      } else if (code === 95) {
        this.zan2d = dat.g2();
      } else if (code === 97) {
        this.certlink = dat.g2();
      } else if (code === 98) {
        this.certtemplate = dat.g2();
      } else if (code >= 100 && code < 110) {
        if (!this.countobj || !this.countco) {
          this.countobj = new Uint16Array(10);
          this.countco = new Uint16Array(10);
        }
        this.countobj[code - 100] = dat.g2();
        this.countco[code - 100] = dat.g2();
      } else if (code === 110) {
        this.resizex = dat.g2();
      } else if (code === 111) {
        this.resizey = dat.g2();
      } else if (code === 112) {
        this.resizez = dat.g2();
      } else if (code === 113) {
        this.ambient = dat.g1b();
      } else if (code === 114) {
        this.contrast = dat.g1b() * 5;
      }
    }
  }
  genCert() {
    const template = ObjType.list(this.certtemplate);
    this.model = template.model;
    this.zoom2d = template.zoom2d;
    this.xan2d = template.xan2d;
    this.yan2d = template.yan2d;
    this.zan2d = template.zan2d;
    this.xof2d = template.xof2d;
    this.yof2d = template.yof2d;
    this.recol_s = template.recol_s;
    this.recol_d = template.recol_d;
    const link = ObjType.list(this.certlink);
    this.name = link.name;
    this.members = link.members;
    this.cost = link.cost;
    let article = "a";
    const c = (link.name || "").toLowerCase().charAt(0);
    if (c === "a" || c === "e" || c === "i" || c === "o" || c === "u") {
      article = "an";
    }
    this.desc = `Swap this note at any bank for ${article} ${link.name}.`;
    this.stackable = true;
  }
  getModelUnlit(count) {
    if (this.countobj && this.countco && count > 1) {
      let id = -1;
      for (let i = 0;i < 10; i++) {
        if (count >= this.countco[i] && this.countco[i] !== 0) {
          id = this.countobj[i];
        }
      }
      if (id !== -1) {
        return ObjType.list(id).getModelUnlit(1);
      }
    }
    const model = Model.load(this.model);
    if (!model) {
      return null;
    }
    if (this.recol_s && this.recol_d) {
      for (let i = 0;i < this.recol_s.length; i++) {
        model.recolour(this.recol_s[i], this.recol_d[i]);
      }
    }
    return model;
  }
  getModelLit(count) {
    if (this.countobj && this.countco && count > 1) {
      let id = -1;
      for (let i = 0;i < 10; i++) {
        if (count >= this.countco[i] && this.countco[i] !== 0) {
          id = this.countobj[i];
        }
      }
      if (id !== -1) {
        return ObjType.list(id).getModelLit(1);
      }
    }
    let model = ObjType.modelCache.find(BigInt(this.id));
    if (model) {
      return model;
    }
    model = Model.load(this.model);
    if (!model) {
      return null;
    }
    if (this.resizex !== 128 || this.resizey !== 128 || this.resizez !== 128) {
      model.resize(this.resizex, this.resizey, this.resizez);
    }
    if (this.recol_s && this.recol_d) {
      for (let i = 0;i < this.recol_s.length; i++) {
        model.recolour(this.recol_s[i], this.recol_d[i]);
      }
    }
    model.calculateNormals(this.ambient + 64, this.contrast + 768, -50, -10, -50, true);
    model.useAABBMouseCheck = true;
    ObjType.modelCache.put(model, BigInt(this.id));
    return model;
  }
  static getSprite(id, count, outlineRgb) {
    if (outlineRgb === 0) {
      let icon2 = ObjType.spriteCache.find(BigInt(id));
      if (icon2 && icon2.ohi !== count && icon2.ohi !== -1) {
        icon2.unlink();
        icon2 = null;
      }
      if (icon2) {
        return icon2;
      }
    }
    let obj = ObjType.list(id);
    if (!obj.countobj) {
      count = -1;
    }
    if (obj.countobj && obj.countco && count > 1) {
      let countobj = -1;
      for (let i = 0;i < 10; i++) {
        if (count >= obj.countco[i] && obj.countco[i] !== 0) {
          countobj = obj.countobj[i];
        }
      }
      if (countobj !== -1) {
        obj = ObjType.list(countobj);
      }
    }
    const model = obj.getModelLit(1);
    if (!model) {
      return null;
    }
    let linkedIcon = null;
    if (obj.certtemplate !== -1) {
      linkedIcon = this.getSprite(obj.certlink, 10, -1);
      if (!linkedIcon) {
        return null;
      }
    }
    const icon = new Pix32(32, 32);
    const _cx = Pix3D.originX;
    const _cy = Pix3D.originY;
    const _loff = Pix3D.scanline;
    const _data = Pix2D.pixels;
    const _w = Pix2D.width;
    const _h = Pix2D.height;
    const _l = Pix2D.clipMinX;
    const _r = Pix2D.clipMaxX;
    const _t = Pix2D.clipMinY;
    const _b = Pix2D.clipMaxY;
    Pix3D.lowDetail = false;
    Pix2D.setPixels(icon.data, 32, 32);
    Pix2D.fillRect(0, 0, 32, 32, 0 /* BLACK */);
    Pix3D.setRenderClipping();
    let zoom = obj.zoom2d;
    if (outlineRgb === -1) {
      zoom = zoom * 1.5 | 0;
    } else if (outlineRgb > 0) {
      zoom = zoom * 1.04 | 0;
    }
    const sinPitch = Pix3D.sinTable[obj.xan2d] * zoom >> 16;
    const cosPitch = Pix3D.cosTable[obj.xan2d] * zoom >> 16;
    model.objRender(0, obj.yan2d, obj.zan2d, obj.xan2d, obj.xof2d, sinPitch + (model.minY / 2 | 0) + obj.yof2d, cosPitch + obj.yof2d);
    for (let x = 31;x >= 0; x--) {
      for (let y = 31;y >= 0; y--) {
        if (icon.data[x + y * 32] !== 0) {
          continue;
        }
        if (x > 0 && icon.data[x + y * 32 - 1] > 1) {
          icon.data[x + y * 32] = 1;
        } else if (y > 0 && icon.data[x + (y - 1) * 32] > 1) {
          icon.data[x + y * 32] = 1;
        } else if (x < 31 && icon.data[x + y * 32 + 1] > 1) {
          icon.data[x + y * 32] = 1;
        } else if (y < 31 && icon.data[x + (y + 1) * 32] > 1) {
          icon.data[x + y * 32] = 1;
        }
      }
    }
    if (outlineRgb > 0) {
      for (let x = 31;x >= 0; x--) {
        for (let y = 31;y >= 0; y--) {
          if (icon.data[x + y * 32] !== 0) {
            continue;
          }
          if (x > 0 && icon.data[x + y * 32 - 1] === 1) {
            icon.data[x + y * 32] = outlineRgb;
          } else if (y > 0 && icon.data[x + (y - 1) * 32] === 1) {
            icon.data[x + y * 32] = outlineRgb;
          } else if (x < 31 && icon.data[x + y * 32 + 1] === 1) {
            icon.data[x + y * 32] = outlineRgb;
          } else if (y < 31 && icon.data[x + (y + 1) * 32] === 1) {
            icon.data[x + y * 32] = outlineRgb;
          }
        }
      }
    } else if (outlineRgb === 0) {
      for (let x = 31;x >= 0; x--) {
        for (let y = 31;y >= 0; y--) {
          if (icon.data[x + y * 32] === 0 && x > 0 && y > 0 && icon.data[x + (y - 1) * 32 - 1] > 0) {
            icon.data[x + y * 32] = 3153952;
          }
        }
      }
    }
    if (linkedIcon && obj.certtemplate !== -1) {
      const w = linkedIcon.owi;
      const h = linkedIcon.ohi;
      linkedIcon.owi = 32;
      linkedIcon.ohi = 32;
      linkedIcon.plotSprite(0, 0);
      linkedIcon.owi = w;
      linkedIcon.ohi = h;
    }
    if (outlineRgb === 0) {
      ObjType.spriteCache.put(icon, BigInt(id));
    }
    Pix2D.setPixels(_data, _w, _h);
    Pix2D.setClipping(_l, _t, _r, _b);
    Pix3D.originX = _cx;
    Pix3D.originY = _cy;
    Pix3D.scanline = _loff;
    Pix3D.lowDetail = true;
    if (obj.stackable) {
      icon.owi = 33;
    } else {
      icon.owi = 32;
    }
    icon.ohi = count;
    return icon;
  }
  checkWearModel(gender) {
    let wear = this.manwear;
    let wear2 = this.manwear2;
    let wear3 = this.manwear3;
    if (gender == 1) {
      wear = this.womanwear;
      wear2 = this.womanwear2;
      wear3 = this.womanwear3;
    }
    if (wear == -1) {
      return true;
    }
    let ready = true;
    if (!Model.requestDownload(wear)) {
      ready = false;
    }
    if (wear2 != -1 && !Model.requestDownload(wear2)) {
      ready = false;
    }
    if (wear3 != -1 && !Model.requestDownload(wear3)) {
      ready = false;
    }
    return ready;
  }
  getWearModelNoCheck(gender) {
    let id1 = this.manwear;
    if (gender === 1) {
      id1 = this.womanwear;
    }
    if (id1 === -1) {
      return null;
    }
    let id2 = this.manwear2;
    let id3 = this.manwear3;
    if (gender === 1) {
      id2 = this.womanwear2;
      id3 = this.womanwear3;
    }
    let model = Model.load(id1);
    if (!model) {
      return null;
    }
    if (id2 !== -1) {
      const model2 = Model.load(id2);
      if (!model2) {
        return null;
      }
      if (id3 === -1) {
        const models = [model, model2];
        model = Model.combineForAnim(models, 2);
      } else {
        const model3 = Model.load(id3);
        if (!model3) {
          return null;
        }
        const models = [model, model2, model3];
        model = Model.combineForAnim(models, 3);
      }
    }
    if (gender === 0 && this.manwearOffsetY !== 0) {
      model.translate(this.manwearOffsetY, 0, 0);
    } else if (gender === 1 && this.womanwearOffsetY !== 0) {
      model.translate(this.womanwearOffsetY, 0, 0);
    }
    if (this.recol_s && this.recol_d) {
      for (let i = 0;i < this.recol_s.length; i++) {
        model.recolour(this.recol_s[i], this.recol_d[i]);
      }
    }
    return model;
  }
  checkHeadModel(gender) {
    let head = this.manhead;
    let head2 = this.manhead2;
    if (gender == 1) {
      head = this.womanhead;
      head2 = this.womanhead2;
    }
    if (head == -1) {
      return true;
    }
    let ready = true;
    if (!Model.requestDownload(head)) {
      ready = false;
    }
    if (head2 != -1 && !Model.requestDownload(head2)) {
      ready = false;
    }
    return ready;
  }
  getHeadModelNoCheck(gender) {
    let head1 = this.manhead;
    if (gender === 1) {
      head1 = this.womanhead;
    }
    if (head1 === -1) {
      return null;
    }
    let head2 = this.manhead2;
    if (gender === 1) {
      head2 = this.womanhead2;
    }
    let model = Model.load(head1);
    if (!model) {
      return null;
    }
    if (head2 !== -1) {
      const model2 = Model.load(head2);
      if (!model2) {
        return null;
      }
      const models = [model, model2];
      model = Model.combineForAnim(models, 2);
    }
    if (this.recol_s && this.recol_d) {
      for (let i = 0;i < this.recol_s.length; i++) {
        model.recolour(this.recol_s[i], this.recol_d[i]);
      }
    }
    return model;
  }
}

// src/config/NpcType.ts
class NpcType {
  static numDefinitions = 0;
  static idx = null;
  static dat = null;
  static recent = null;
  static recentPos = 0;
  static modelCache = new LruCache(30);
  id = -1;
  name = null;
  desc = null;
  size = 1;
  model = null;
  head = null;
  readyanim = -1;
  walkanim = -1;
  walkanim_b = -1;
  walkanim_r = -1;
  walkanim_l = -1;
  recol_s = null;
  recol_d = null;
  op = null;
  minimap = true;
  vislevel = -1;
  resizeh = 128;
  resizev = 128;
  alwaysontop = false;
  ambient = 0;
  contrast = 0;
  headicon = -1;
  turnspeed = 32;
  static init(config) {
    this.dat = new Packet(config.read("npc.dat"));
    const idx = new Packet(config.read("npc.idx"));
    this.numDefinitions = idx.g2();
    this.idx = new Int32Array(this.numDefinitions);
    let offset = 2;
    for (let id = 0;id < this.numDefinitions; id++) {
      this.idx[id] = offset;
      offset += idx.g2();
    }
    this.recent = new TypedArray1d(20, null);
    for (let id = 0;id < 20; id++) {
      this.recent[id] = new NpcType;
    }
  }
  static list(id) {
    if (!this.recent || !this.idx || !this.dat) {
      throw new Error;
    }
    for (let i = 0;i < 20; i++) {
      const type = this.recent[i];
      if (type && type.id === id) {
        return type;
      }
    }
    this.recentPos = (this.recentPos + 1) % 20;
    const npc = this.recent[this.recentPos] = new NpcType;
    this.dat.pos = this.idx[id];
    npc.id = id;
    npc.decode(this.dat);
    return npc;
  }
  decode(dat) {
    while (true) {
      const code = dat.g1();
      if (code === 0) {
        break;
      }
      if (code === 1) {
        const count = dat.g1();
        this.model = new Uint16Array(count);
        for (let i = 0;i < count; i++) {
          this.model[i] = dat.g2();
        }
      } else if (code === 2) {
        this.name = dat.gjstr();
      } else if (code === 3) {
        this.desc = dat.gjstr();
      } else if (code === 12) {
        this.size = dat.g1b();
      } else if (code === 13) {
        this.readyanim = dat.g2();
      } else if (code === 14) {
        this.walkanim = dat.g2();
      } else if (code === 17) {
        this.walkanim = dat.g2();
        this.walkanim_b = dat.g2();
        this.walkanim_r = dat.g2();
        this.walkanim_l = dat.g2();
      } else if (code >= 30 && code < 40) {
        if (!this.op) {
          this.op = new TypedArray1d(5, null);
        }
        this.op[code - 30] = dat.gjstr();
        if (this.op[code - 30]?.toLowerCase() === "hidden") {
          this.op[code - 30] = null;
        }
      } else if (code === 40) {
        const count = dat.g1();
        this.recol_s = new Uint16Array(count);
        this.recol_d = new Uint16Array(count);
        for (let i = 0;i < count; i++) {
          this.recol_s[i] = dat.g2();
          this.recol_d[i] = dat.g2();
        }
      } else if (code === 60) {
        const count = dat.g1();
        this.head = new Uint16Array(count);
        for (let i = 0;i < count; i++) {
          this.head[i] = dat.g2();
        }
      } else if (code === 90) {
        dat.pos += 2;
      } else if (code === 91) {
        dat.pos += 2;
      } else if (code === 92) {
        dat.pos += 2;
      } else if (code === 93) {
        this.minimap = false;
      } else if (code === 95) {
        this.vislevel = dat.g2();
      } else if (code === 97) {
        this.resizeh = dat.g2();
      } else if (code === 98) {
        this.resizev = dat.g2();
      } else if (code === 99) {
        this.alwaysontop = true;
      } else if (code === 100) {
        this.ambient = dat.g1b();
      } else if (code === 101) {
        this.contrast = dat.g1b() * 5;
      } else if (code === 102) {
        this.headicon = dat.g2();
      } else if (code === 103) {
        this.turnspeed = dat.g2();
      }
    }
  }
  getTempModel(primaryTransformId, secondaryTransformId, seqMask) {
    let model = NpcType.modelCache.find(BigInt(this.id));
    if (!model && this.model) {
      let ready = false;
      for (let i = 0;i < this.model.length; i++) {
        if (!Model.requestDownload(this.model[i])) {
          ready = true;
        }
      }
      if (ready) {
        return null;
      }
      const models = new TypedArray1d(this.model.length, null);
      for (let i = 0;i < this.model.length; i++) {
        models[i] = Model.load(this.model[i]);
      }
      if (models.length === 1) {
        model = models[0];
      } else {
        model = Model.combineForAnim(models, models.length);
      }
      if (model) {
        if (this.recol_s && this.recol_d) {
          for (let i = 0;i < this.recol_s.length; i++) {
            model.recolour(this.recol_s[i], this.recol_d[i]);
          }
        }
        model.prepareAnim();
        model.calculateNormals(64, 850, -30, -50, -30, true);
        NpcType.modelCache.put(model, BigInt(this.id));
      }
    }
    if (!model) {
      return null;
    }
    const tmp = Model.tempModel;
    tmp.set(model, AnimFrame.shareAlpha(primaryTransformId) && AnimFrame.shareAlpha(secondaryTransformId));
    if (primaryTransformId !== -1 && secondaryTransformId !== -1) {
      tmp.maskAnimate(primaryTransformId, secondaryTransformId, seqMask);
    } else if (primaryTransformId !== -1) {
      tmp.animate(primaryTransformId);
    }
    if (this.resizeh !== 128 || this.resizev !== 128) {
      tmp.resize(this.resizeh, this.resizev, this.resizeh);
    }
    tmp.calcBoundingCylinder();
    tmp.labelFaces = null;
    tmp.labelVertices = null;
    if (this.size === 1) {
      tmp.useAABBMouseCheck = true;
    }
    return tmp;
  }
  getHead() {
    if (!this.head) {
      return null;
    }
    let exists = false;
    for (let i = 0;i < this.head.length; i++) {
      if (!Model.requestDownload(this.head[i])) {
        exists = true;
      }
    }
    if (exists) {
      return null;
    }
    const models = new TypedArray1d(this.head.length, null);
    for (let i = 0;i < this.head.length; i++) {
      models[i] = Model.load(this.head[i]);
    }
    let model;
    if (models.length === 1) {
      model = models[0];
    } else {
      model = Model.combineForAnim(models, models.length);
    }
    if (model && this.recol_s && this.recol_d) {
      for (let i = 0;i < this.recol_s.length; i++) {
        model.recolour(this.recol_s[i], this.recol_d[i]);
      }
    }
    return model;
  }
}

// src/config/IdkType.ts
class IdkType {
  static numDefinitions = 0;
  static list = [];
  part = -1;
  model = null;
  recol_s = new Int32Array(6);
  recol_d = new Int32Array(6);
  head = new Int32Array(5).fill(-1);
  disable = false;
  static init(config) {
    const dat = new Packet(config.read("idk.dat"));
    this.numDefinitions = dat.g2();
    this.list = new Array(this.numDefinitions);
    for (let id = 0;id < this.numDefinitions; id++) {
      if (!this.list[id]) {
        this.list[id] = new IdkType;
      }
      this.list[id].decode(dat);
    }
  }
  decode(dat) {
    while (true) {
      const code = dat.g1();
      if (code === 0) {
        break;
      }
      if (code === 1) {
        this.part = dat.g1();
      } else if (code === 2) {
        const count = dat.g1();
        this.model = new Int32Array(count);
        for (let i = 0;i < count; i++) {
          this.model[i] = dat.g2();
        }
      } else if (code === 3) {
        this.disable = true;
      } else if (code >= 40 && code < 50) {
        this.recol_s[code - 40] = dat.g2();
      } else if (code >= 50 && code < 60) {
        this.recol_d[code - 50] = dat.g2();
      } else if (code >= 60 && code < 70) {
        this.head[code - 60] = dat.g2();
      } else {
        console.log("Error unrecognised config code: ", code);
      }
    }
  }
  checkModel() {
    if (!this.model) {
      return true;
    }
    let ready = true;
    for (let i = 0;i < this.model.length; i++) {
      if (!Model.requestDownload(this.model[i])) {
        ready = false;
      }
    }
    return ready;
  }
  getModelNoCheck() {
    if (!this.model) {
      return null;
    }
    const models = new TypedArray1d(this.model.length, null);
    for (let i = 0;i < this.model.length; i++) {
      models[i] = Model.load(this.model[i]);
    }
    let model;
    if (models.length === 1) {
      model = models[0];
    } else {
      model = Model.combineForAnim(models, models.length);
    }
    for (let i = 0;i < 6 && this.recol_s[i] !== 0; i++) {
      model?.recolour(this.recol_s[i], this.recol_d[i]);
    }
    return model;
  }
  checkHead() {
    let ready = true;
    for (let i = 0;i < this.head.length; i++) {
      if (this.head[i] != -1 && !Model.requestDownload(this.head[i])) {
        ready = false;
      }
    }
    return ready;
  }
  getHeadNoCheck() {
    let count = 0;
    const models = new TypedArray1d(5, null);
    for (let i = 0;i < 5; i++) {
      if (this.head[i] !== -1) {
        models[count++] = Model.load(this.head[i]);
      }
    }
    const model = Model.combineForAnim(models, count);
    for (let i = 0;i < 6 && this.recol_s[i] !== 0; i++) {
      model.recolour(this.recol_s[i], this.recol_d[i]);
    }
    return model;
  }
}

// src/config/SpotType.ts
class SpotType {
  static numDefinitions = 0;
  static list = [];
  static modelCache = new LruCache(30);
  id = 0;
  model = 0;
  anim = -1;
  seq = null;
  recol_s = new Uint16Array(6);
  recol_d = new Uint16Array(6);
  resizeh = 128;
  resizev = 128;
  angle = 0;
  ambient = 0;
  contrast = 0;
  static init(config) {
    const dat = new Packet(config.read("spotanim.dat"));
    this.numDefinitions = dat.g2();
    this.list = new Array(this.numDefinitions);
    for (let id = 0;id < this.numDefinitions; id++) {
      if (!this.list[id]) {
        this.list[id] = new SpotType;
      }
      this.list[id].id = id;
      this.list[id].decode(dat);
    }
  }
  decode(dat) {
    while (true) {
      const code = dat.g1();
      if (code === 0) {
        break;
      }
      if (code === 1) {
        this.model = dat.g2();
      } else if (code === 2) {
        this.anim = dat.g2();
        if (SeqType.list) {
          this.seq = SeqType.list[this.anim];
        }
      } else if (code === 4) {
        this.resizeh = dat.g2();
      } else if (code === 5) {
        this.resizev = dat.g2();
      } else if (code === 6) {
        this.angle = dat.g2();
      } else if (code === 7) {
        this.ambient = dat.g1();
      } else if (code === 8) {
        this.contrast = dat.g1();
      } else if (code >= 40 && code < 50) {
        this.recol_s[code - 40] = dat.g2();
      } else if (code >= 50 && code < 60) {
        this.recol_d[code - 50] = dat.g2();
      } else {
        console.log("Error unrecognised spotanim config code: ", code);
      }
    }
  }
  getTempModel2() {
    let model = SpotType.modelCache.find(BigInt(this.id));
    if (model) {
      return model;
    }
    model = Model.load(this.model);
    if (!model) {
      return null;
    }
    for (let i = 0;i < 6; i++) {
      if (this.recol_s[0] !== 0) {
        model.recolour(this.recol_s[i], this.recol_d[i]);
      }
    }
    SpotType.modelCache.put(model, BigInt(this.id));
    return model;
  }
}

// src/config/VarpType.ts
class VarpType {
  static numDefinitions = 0;
  static list = [];
  clientcode = 0;
  static init(config) {
    const dat = new Packet(config.read("varp.dat"));
    this.numDefinitions = dat.g2();
    this.list = new Array(this.numDefinitions);
    for (let id = 0;id < this.numDefinitions; id++) {
      if (!this.list[id]) {
        this.list[id] = new VarpType;
      }
      this.list[id].decode(dat);
    }
    if (dat.pos != dat.data.length) {
      console.log("varptype load mismatch");
    }
  }
  decode(dat) {
    while (true) {
      const code = dat.g1();
      if (code === 0) {
        break;
      }
      if (code === 1) {
        dat.pos += 1;
      } else if (code === 2) {
        dat.pos += 1;
      } else if (code === 3) {} else if (code === 4) {} else if (code === 5) {
        this.clientcode = dat.g2();
      } else if (code === 6) {} else if (code === 7) {
        dat.pos += 4;
      } else if (code === 8) {} else if (code === 10) {
        dat.gjstr();
      } else if (code === 11) {} else {
        console.log("Error unrecognised config code: ", code);
      }
    }
  }
}

// src/config/VarBitType.ts
class VarBitType {
  static numDefinitions = 0;
  static list = [];
  basevar = -1;
  startbit = 0;
  endbit = 0;
  debugname = "";
  static init(config) {
    const dat = new Packet(config.read("varbit.dat"));
    this.numDefinitions = dat.g2();
    this.list = new Array(this.numDefinitions);
    for (let id = 0;id < this.numDefinitions; id++) {
      if (!this.list[id]) {
        this.list[id] = new VarBitType;
      }
      this.list[id].decode(dat);
    }
    if (dat.pos != dat.data.length) {
      console.log("varbit load mismatch");
    }
  }
  decode(dat) {
    while (true) {
      const code = dat.g1();
      if (code === 0) {
        break;
      }
      if (code === 1) {
        this.basevar = dat.g2();
        this.startbit = dat.g1();
        this.endbit = dat.g1();
      } else if (code === 10) {
        this.debugname = dat.gjstr();
      } else {
        console.log("Error unrecognised config code: ", code);
      }
    }
  }
}

// src/datastruct/JString.ts
class JString {
  static USERHASH_CHAR = [
    "_",
    "a",
    "b",
    "c",
    "d",
    "e",
    "f",
    "g",
    "h",
    "i",
    "j",
    "k",
    "l",
    "m",
    "n",
    "o",
    "p",
    "q",
    "r",
    "s",
    "t",
    "u",
    "v",
    "w",
    "x",
    "y",
    "z",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9"
  ];
  static toUserhash(string) {
    string = string.trim();
    let l = 0n;
    for (let i = 0;i < string.length && i < 12; i++) {
      const c = string.charCodeAt(i);
      l *= 37n;
      if (c >= 65 && c <= 90) {
        l += BigInt(c + 1 - 65);
      } else if (c >= 97 && c <= 122) {
        l += BigInt(c + 1 - 97);
      } else if (c >= 48 && c <= 57) {
        l += BigInt(c + 27 - 48);
      }
    }
    while (l % 37n === 0n && l !== 0n) {
      l /= 37n;
    }
    return l;
  }
  static toRawUsername(value) {
    if (value < 0n || value >= 6582952005840035281n) {
      return "invalid_name";
    }
    if (value % 37n === 0n) {
      return "invalid_name";
    }
    let len = 0;
    const chars = Array(12);
    while (value !== 0n) {
      const l1 = value;
      value /= 37n;
      chars[11 - len++] = this.USERHASH_CHAR[Number(l1 - value * 37n)];
    }
    return chars.slice(12 - len).join("");
  }
  static toSentenceCase(input) {
    const chars = [...input.toLowerCase()];
    let punctuation = true;
    for (let index = 0;index < chars.length; index++) {
      const char = chars[index];
      if (punctuation && char >= "a" && char <= "z") {
        chars[index] = char.toUpperCase();
        punctuation = false;
      }
      if (char === "." || char === "!") {
        punctuation = true;
      }
    }
    return chars.join("");
  }
  static getRepeatedCharacter(str) {
    let temp = "";
    for (let i = 0;i < str.length; i++) {
      temp = temp + "*";
    }
    return temp;
  }
  static formatIPv4(ip) {
    return (ip >> 24 & 255) + "." + (ip >> 16 & 255) + "." + (ip >> 8 & 255) + "." + (ip & 255);
  }
  static toScreenName(str) {
    if (str.length === 0) {
      return str;
    }
    const chars = [...str];
    for (let i = 0;i < chars.length; i++) {
      if (chars[i] === "_") {
        chars[i] = " ";
        if (i + 1 < chars.length && chars[i + 1] >= "a" && chars[i + 1] <= "z") {
          chars[i + 1] = String.fromCharCode(chars[i + 1].charCodeAt(0) + 65 - 97);
        }
      }
    }
    if (chars[0] >= "a" && chars[0] <= "z") {
      chars[0] = String.fromCharCode(chars[0].charCodeAt(0) + 65 - 97);
    }
    return chars.join("");
  }
  static hashCode(str) {
    const upper = str.toUpperCase();
    let hash = 0n;
    for (let i = 0;i < upper.length; i++) {
      hash = hash * 61n + BigInt(upper.charCodeAt(i)) - 32n;
      hash = hash + (hash >> 56n) & 0xffffffffffffffn;
    }
    return hash;
  }
}

// src/config/IfType.ts
class IfType {
  static list = [];
  static modelCache = new LruCache(30);
  static spriteCache = null;
  animFrame = 0;
  animCycle = 0;
  id = -1;
  layerId = -1;
  type = -1;
  buttonType = -1;
  clientCode = 0;
  width = 0;
  height = 0;
  trans = 0;
  overLayerId = -1;
  x = 0;
  y = 0;
  scripts = null;
  scriptComparator = null;
  scriptOperand = null;
  scrollHeight = 0;
  scrollPos = 0;
  hide = false;
  children = null;
  childX = null;
  childY = null;
  linkObjType = null;
  linkObjNumber = null;
  objSwap = false;
  objOps = false;
  objUse = false;
  objReplace = false;
  marginX = 0;
  marginY = 0;
  invBackgroundX = null;
  invBackgroundY = null;
  invBackground = null;
  iop = null;
  fill = false;
  center = false;
  font = null;
  shadow = false;
  text = null;
  text2 = null;
  colour = 0;
  colour2 = 0;
  colourOver = 0;
  colour2Over = 0;
  graphic = null;
  graphic2 = null;
  model1Type = 0;
  model1Id = 0;
  model2Id = 0;
  model2Type = 0;
  modelAnim = -1;
  modelAnim2 = -1;
  modelZoom = 0;
  modelXAn = 0;
  modelYAn = 0;
  targetVerb = null;
  targetBase = null;
  targetMask = -1;
  buttonText = null;
  static init(interfaces, media, fonts) {
    this.spriteCache = new LruCache(50000);
    const data = new Packet(interfaces.read("data"));
    let layer = -1;
    const count = data.g2();
    this.list = new Array(count);
    while (data.pos < data.length) {
      let id = data.g2();
      if (id === 65535) {
        layer = data.g2();
        id = data.g2();
      }
      const com = this.list[id] = new IfType;
      com.id = id;
      com.layerId = layer;
      com.type = data.g1();
      com.buttonType = data.g1();
      com.clientCode = data.g2();
      com.width = data.g2();
      com.height = data.g2();
      com.trans = data.g1();
      com.overLayerId = data.g1();
      if (com.overLayerId === 0) {
        com.overLayerId = -1;
      } else {
        com.overLayerId = (com.overLayerId - 1 << 8) + data.g1();
      }
      const scriptStackCount = data.g1();
      if (scriptStackCount > 0) {
        com.scriptComparator = new Uint8Array(scriptStackCount);
        com.scriptOperand = new Uint16Array(scriptStackCount);
        for (let i = 0;i < scriptStackCount; i++) {
          com.scriptComparator[i] = data.g1();
          com.scriptOperand[i] = data.g2();
        }
      }
      const scriptCount = data.g1();
      if (scriptCount > 0) {
        com.scripts = new TypedArray1d(scriptCount, null);
        for (let i = 0;i < scriptCount; i++) {
          const opcodeCount = data.g2();
          const script = new Uint16Array(opcodeCount);
          com.scripts[i] = script;
          for (let j = 0;j < opcodeCount; j++) {
            script[j] = data.g2();
          }
        }
      }
      if (com.type === 0 /* TYPE_LAYER */) {
        com.scrollHeight = data.g2();
        com.hide = data.g1() === 1;
        const childCount = data.g2();
        com.children = new Array(childCount);
        com.childX = new Array(childCount);
        com.childY = new Array(childCount);
        for (let i = 0;i < childCount; i++) {
          com.children[i] = data.g2();
          com.childX[i] = data.g2b();
          com.childY[i] = data.g2b();
        }
      }
      if (com.type === 1 /* TYPE_UNUSED */) {
        data.pos += 3;
      }
      if (com.type === 2 /* TYPE_INV */) {
        com.linkObjType = new Int32Array(com.width * com.height);
        com.linkObjNumber = new Int32Array(com.width * com.height);
        com.objSwap = data.g1() === 1;
        com.objOps = data.g1() === 1;
        com.objUse = data.g1() === 1;
        com.objReplace = data.g1() === 1;
        com.marginX = data.g1();
        com.marginY = data.g1();
        com.invBackgroundX = new Int16Array(20);
        com.invBackgroundY = new Int16Array(20);
        com.invBackground = new TypedArray1d(20, null);
        for (let i = 0;i < 20; i++) {
          if (data.g1() === 1) {
            com.invBackgroundX[i] = data.g2b();
            com.invBackgroundY[i] = data.g2b();
            const graphic = data.gjstr();
            if (media && graphic.length > 0) {
              const spriteIndex = graphic.lastIndexOf(",");
              com.invBackground[i] = this.getSprite(media, graphic.substring(0, spriteIndex), parseInt(graphic.substring(spriteIndex + 1)));
            }
          }
        }
        com.iop = new TypedArray1d(5, null);
        for (let i = 0;i < 5; i++) {
          com.iop[i] = data.gjstr();
          if (com.iop[i].length === 0) {
            com.iop[i] = null;
          }
        }
      }
      if (com.type === 3 /* TYPE_RECT */) {
        com.fill = data.g1() === 1;
      }
      if (com.type === 4 /* TYPE_TEXT */ || com.type === 1 /* TYPE_UNUSED */) {
        com.center = data.g1() === 1;
        const font = data.g1();
        if (fonts) {
          com.font = fonts[font];
        }
        com.shadow = data.g1() === 1;
      }
      if (com.type === 4 /* TYPE_TEXT */) {
        com.text = data.gjstr();
        com.text2 = data.gjstr();
      }
      if (com.type === 1 /* TYPE_UNUSED */ || com.type === 3 /* TYPE_RECT */ || com.type === 4 /* TYPE_TEXT */) {
        com.colour = data.g4();
      }
      if (com.type === 3 /* TYPE_RECT */ || com.type === 4 /* TYPE_TEXT */) {
        com.colour2 = data.g4();
        com.colourOver = data.g4();
        com.colour2Over = data.g4();
      }
      if (com.type === 5 /* TYPE_GRAPHIC */) {
        const graphic = data.gjstr();
        if (media && graphic.length > 0) {
          const index = graphic.lastIndexOf(",");
          com.graphic = this.getSprite(media, graphic.substring(0, index), parseInt(graphic.substring(index + 1), 10));
        }
        const activeGraphic = data.gjstr();
        if (media && activeGraphic.length > 0) {
          const index = activeGraphic.lastIndexOf(",");
          com.graphic2 = this.getSprite(media, activeGraphic.substring(0, index), parseInt(activeGraphic.substring(index + 1), 10));
        }
      }
      if (com.type === 6 /* TYPE_MODEL */) {
        const model = data.g1();
        if (model !== 0) {
          com.model1Type = 1;
          com.model1Id = (model - 1 << 8) + data.g1();
        }
        const activeModel = data.g1();
        if (activeModel !== 0) {
          com.model2Type = 1;
          com.model2Id = (activeModel - 1 << 8) + data.g1();
        }
        com.modelAnim = data.g1();
        if (com.modelAnim === 0) {
          com.modelAnim = -1;
        } else {
          com.modelAnim = (com.modelAnim - 1 << 8) + data.g1();
        }
        com.modelAnim2 = data.g1();
        if (com.modelAnim2 === 0) {
          com.modelAnim2 = -1;
        } else {
          com.modelAnim2 = (com.modelAnim2 - 1 << 8) + data.g1();
        }
        com.modelZoom = data.g2();
        com.modelXAn = data.g2();
        com.modelYAn = data.g2();
      }
      if (com.type === 7 /* TYPE_INV_TEXT */) {
        com.linkObjType = new Int32Array(com.width * com.height);
        com.linkObjNumber = new Int32Array(com.width * com.height);
        com.center = data.g1() === 1;
        const font = data.g1();
        if (fonts) {
          com.font = fonts[font];
        }
        com.shadow = data.g1() === 1;
        com.colour = data.g4();
        com.marginX = data.g2b();
        com.marginY = data.g2b();
        com.objOps = data.g1() === 1;
        com.iop = new TypedArray1d(5, null);
        for (let i = 0;i < 5; i++) {
          com.iop[i] = data.gjstr();
          if (com.iop[i].length === 0) {
            com.iop[i] = null;
          }
        }
      }
      if (com.buttonType === 2 /* BUTTON_TARGET */ || com.type === 2 /* TYPE_INV */) {
        com.targetVerb = data.gjstr();
        com.targetBase = data.gjstr();
        com.targetMask = data.g2();
      }
      if (com.buttonType === 1 /* BUTTON_OK */ || com.buttonType === 4 /* BUTTON_TOGGLE */ || com.buttonType === 5 /* BUTTON_SELECT */ || com.buttonType === 6 /* BUTTON_CONTINUE */) {
        com.buttonText = data.gjstr();
        if (com.buttonText.length === 0) {
          if (com.buttonType === 1 /* BUTTON_OK */) {
            com.buttonText = "Ok";
          } else if (com.buttonType === 4 /* BUTTON_TOGGLE */) {
            com.buttonText = "Select";
          } else if (com.buttonType === 5 /* BUTTON_SELECT */) {
            com.buttonText = "Select";
          } else if (com.buttonType === 6 /* BUTTON_CONTINUE */) {
            com.buttonText = "Continue";
          }
        }
      }
    }
    this.spriteCache = null;
  }
  swapSlots(src, dst) {
    if (!this.linkObjType || !this.linkObjNumber) {
      return;
    }
    let tmp = this.linkObjType[src];
    this.linkObjType[src] = this.linkObjType[dst];
    this.linkObjType[dst] = tmp;
    tmp = this.linkObjNumber[src];
    this.linkObjNumber[src] = this.linkObjNumber[dst];
    this.linkObjNumber[dst] = tmp;
  }
  getTempModel(primaryFrame, secondaryFrame, active, localPlayer) {
    let model = null;
    if (active) {
      model = this.getModel(this.model2Type, this.model2Id, localPlayer);
    } else {
      model = this.getModel(this.model1Type, this.model1Id, localPlayer);
    }
    if (!model) {
      return null;
    }
    if (primaryFrame === -1 && secondaryFrame === -1 && !model.faceColour) {
      return model;
    }
    const tmp = Model.copyForAnim(model, true, AnimFrame.shareAlpha(primaryFrame) && AnimFrame.shareAlpha(secondaryFrame), false);
    if (primaryFrame !== -1 || secondaryFrame !== -1) {
      tmp.prepareAnim();
    }
    if (primaryFrame !== -1) {
      tmp.animate(primaryFrame);
    }
    if (secondaryFrame !== -1) {
      tmp.animate(secondaryFrame);
    }
    tmp.calculateNormals(64, 768, -50, -10, -50, true);
    return tmp;
  }
  getModel(type, id, localPlayer) {
    let model = IfType.modelCache.find(BigInt((type << 16) + id));
    if (model) {
      return model;
    }
    if (type === 1) {
      model = Model.load(id);
    } else if (type === 2) {
      model = NpcType.list(id).getHead();
    } else if (type === 3) {
      if (localPlayer) {
        model = localPlayer.getHeadModel();
      }
    } else if (type === 4) {
      model = ObjType.list(id).getModelUnlit(50);
    } else if (type === 5) {
      model = null;
    }
    if (model) {
      IfType.modelCache.put(model, BigInt((type << 16) + id));
    }
    return model;
  }
  static cacheModel(model, type, id) {
    IfType.modelCache.clear();
    if (model && type != 4) {
      IfType.modelCache.put(model, BigInt((type << 16) + id));
    }
  }
  static getSprite(media, name, spriteIndex) {
    const uid = JString.hashCode(name) << 8n | BigInt(spriteIndex);
    if (this.spriteCache) {
      const image = this.spriteCache.find(uid);
      if (image) {
        return image;
      }
    }
    try {
      const image = Pix32.depack(media, name, spriteIndex);
      this.spriteCache?.put(image, uid);
      return image;
    } catch (_e) {
      return null;
    }
  }
}

// src/dash3d/ClientLocAnim.ts
class ClientLocAnim extends ModelSource {
  index;
  shape;
  angle;
  heightSW;
  heightSE;
  heightNE;
  heightNW;
  anim;
  animFrame;
  animCycle;
  constructor(loopCycle, index, shape, angle, heightSW, heightSE, heightNE, heightNW, seq, randomFrame) {
    super();
    this.index = index;
    this.shape = shape;
    this.angle = angle;
    this.heightSW = heightSW;
    this.heightSE = heightSE;
    this.heightNE = heightNE;
    this.heightNW = heightNW;
    this.anim = SeqType.list[seq];
    this.animFrame = 0;
    this.animCycle = loopCycle;
    if (randomFrame && this.anim.loops !== -1) {
      this.animFrame = Math.random() * this.anim.numFrames | 0;
      this.animCycle -= Math.random() * this.anim.getDuration(this.animFrame) | 0;
    }
  }
  getTempModel(loopCycle) {
    if (this.anim) {
      let delta = loopCycle - this.animCycle;
      if (delta > 100 && this.anim.loops > 0) {
        delta = 100;
      }
      while (delta > this.anim.getDuration(this.animFrame)) {
        delta -= this.anim.getDuration(this.animFrame);
        this.animFrame++;
        if (this.animFrame < this.anim.numFrames) {
          continue;
        }
        this.animFrame -= this.anim.loops;
        if (this.animFrame < 0 || this.animFrame >= this.anim.numFrames) {
          this.anim = null;
          break;
        }
      }
      this.animCycle = loopCycle - delta;
    }
    let frame = -1;
    if (this.anim && this.anim.frames && typeof this.anim.frames[this.animFrame] !== "undefined") {
      frame = this.anim.frames[this.animFrame];
    }
    const loc = LocType.list(this.index);
    return loc.getModel(this.shape, this.angle, this.heightSW, this.heightSE, this.heightNE, this.heightNW, frame);
  }
}

// src/dash3d/CollisionMap.ts
class CollisionMap {
  static index = (x, z) => x * 104 /* SIZE */ + z;
  startX = 0;
  startZ = 0;
  sizeX;
  sizeZ;
  flags;
  constructor() {
    this.sizeX = 104 /* SIZE */;
    this.sizeZ = 104 /* SIZE */;
    this.flags = new Int32Array(this.sizeX * this.sizeZ);
    this.reset();
  }
  reset() {
    for (let x = 0;x < this.sizeX; x++) {
      for (let z = 0;z < this.sizeZ; z++) {
        const index = CollisionMap.index(x, z);
        if (x === 0 || z === 0 || x === this.sizeX - 1 || z === this.sizeZ - 1) {
          this.flags[index] = 16777215 /* BOUNDS */;
        } else {
          this.flags[index] = 0 /* OPEN */;
        }
      }
    }
  }
  blockGround(tileX, tileZ) {
    this.flags[CollisionMap.index(tileX - this.startX, tileZ - this.startZ)] |= 2097152 /* FLOOR */;
  }
  unblockGround(tileX, tileZ) {
    this.flags[CollisionMap.index(tileX - this.startX, tileZ - this.startZ)] &= ~2097152 /* FLOOR */;
  }
  addLoc(tileX, tileZ, sizeX, sizeZ, angle, blockrange) {
    let flags = 256 /* LOC */;
    if (blockrange) {
      flags |= 131072 /* LOC_PROJ_BLOCKER */;
    }
    const x = tileX - this.startX;
    const z = tileZ - this.startZ;
    if (angle === 1 /* NORTH */ || angle === 3 /* SOUTH */) {
      const tmp = sizeX;
      sizeX = sizeZ;
      sizeZ = tmp;
    }
    for (let tx = x;tx < x + sizeX; tx++) {
      if (!(tx >= 0 && tx < this.sizeX)) {
        continue;
      }
      for (let tz = z;tz < z + sizeZ; tz++) {
        if (!(tz >= 0 && tz < this.sizeZ)) {
          continue;
        }
        this.addCMap(tx, tz, flags);
      }
    }
  }
  delLoc(tileX, tileZ, sizeX, sizeZ, angle, blockrange) {
    let flags = 256 /* LOC */;
    if (blockrange) {
      flags |= 131072 /* LOC_PROJ_BLOCKER */;
    }
    const x = tileX - this.startX;
    const z = tileZ - this.startZ;
    if (angle === 1 /* NORTH */ || angle === 3 /* SOUTH */) {
      const tmp = sizeX;
      sizeX = sizeZ;
      sizeZ = tmp;
    }
    for (let tx = x;tx < x + sizeX; tx++) {
      if (!(tx >= 0 && tx < this.sizeX)) {
        continue;
      }
      for (let tz = z;tz < z + sizeZ; tz++) {
        if (!(tz >= 0 && tz < this.sizeZ)) {
          continue;
        }
        this.remCMap(tx, tz, flags);
      }
    }
  }
  addWall(tileX, tileZ, shape, angle, blockrange) {
    const x = tileX - this.startX;
    const z = tileZ - this.startZ;
    const west = blockrange ? 65536 /* WALL_WEST_PROJ_BLOCKER */ : 128 /* WALL_WEST */;
    const east = blockrange ? 4096 /* WALL_EAST_PROJ_BLOCKER */ : 8 /* WALL_EAST */;
    const north = blockrange ? 1024 /* WALL_NORTH_PROJ_BLOCKER */ : 2 /* WALL_NORTH */;
    const south = blockrange ? 16384 /* WALL_SOUTH_PROJ_BLOCKER */ : 32 /* WALL_SOUTH */;
    const northWest = blockrange ? 512 /* WALL_NORTH_WEST_PROJ_BLOCKER */ : 1 /* WALL_NORTH_WEST */;
    const southEast = blockrange ? 8192 /* WALL_SOUTH_EAST_PROJ_BLOCKER */ : 16 /* WALL_SOUTH_EAST */;
    const northEast = blockrange ? 2048 /* WALL_NORTH_EAST_PROJ_BLOCKER */ : 4 /* WALL_NORTH_EAST */;
    const southWest = blockrange ? 32768 /* WALL_SOUTH_WEST_PROJ_BLOCKER */ : 64 /* WALL_SOUTH_WEST */;
    if (shape === 0 /* WALL_STRAIGHT */) {
      if (angle === 0 /* WEST */) {
        this.addCMap(x, z, west);
        this.addCMap(x - 1, z, east);
      } else if (angle === 1 /* NORTH */) {
        this.addCMap(x, z, north);
        this.addCMap(x, z + 1, south);
      } else if (angle === 2 /* EAST */) {
        this.addCMap(x, z, east);
        this.addCMap(x + 1, z, west);
      } else if (angle === 3 /* SOUTH */) {
        this.addCMap(x, z, south);
        this.addCMap(x, z - 1, north);
      }
    } else if (shape === 1 /* WALL_DIAGONAL_CORNER */ || shape === 3 /* WALL_SQUARE_CORNER */) {
      if (angle === 0 /* WEST */) {
        this.addCMap(x, z, northWest);
        this.addCMap(x - 1, z + 1, southEast);
      } else if (angle === 1 /* NORTH */) {
        this.addCMap(x, z, northEast);
        this.addCMap(x + 1, z + 1, southWest);
      } else if (angle === 2 /* EAST */) {
        this.addCMap(x, z, southEast);
        this.addCMap(x + 1, z - 1, northWest);
      } else if (angle === 3 /* SOUTH */) {
        this.addCMap(x, z, southWest);
        this.addCMap(x - 1, z - 1, northEast);
      }
    } else if (shape === 2 /* WALL_L */) {
      if (angle === 0 /* WEST */) {
        this.addCMap(x, z, north | west);
        this.addCMap(x - 1, z, east);
        this.addCMap(x, z + 1, south);
      } else if (angle === 1 /* NORTH */) {
        this.addCMap(x, z, north | east);
        this.addCMap(x, z + 1, south);
        this.addCMap(x + 1, z, west);
      } else if (angle === 2 /* EAST */) {
        this.addCMap(x, z, south | east);
        this.addCMap(x + 1, z, west);
        this.addCMap(x, z - 1, north);
      } else if (angle === 3 /* SOUTH */) {
        this.addCMap(x, z, south | west);
        this.addCMap(x, z - 1, north);
        this.addCMap(x - 1, z, east);
      }
    }
    if (blockrange) {
      this.addWall(tileX, tileZ, shape, angle, false);
    }
  }
  delWall(tileX, tileZ, shape, angle, blockrange) {
    const x = tileX - this.startX;
    const z = tileZ - this.startZ;
    const west = blockrange ? 65536 /* WALL_WEST_PROJ_BLOCKER */ : 128 /* WALL_WEST */;
    const east = blockrange ? 4096 /* WALL_EAST_PROJ_BLOCKER */ : 8 /* WALL_EAST */;
    const north = blockrange ? 1024 /* WALL_NORTH_PROJ_BLOCKER */ : 2 /* WALL_NORTH */;
    const south = blockrange ? 16384 /* WALL_SOUTH_PROJ_BLOCKER */ : 32 /* WALL_SOUTH */;
    const northWest = blockrange ? 512 /* WALL_NORTH_WEST_PROJ_BLOCKER */ : 1 /* WALL_NORTH_WEST */;
    const southEast = blockrange ? 8192 /* WALL_SOUTH_EAST_PROJ_BLOCKER */ : 16 /* WALL_SOUTH_EAST */;
    const northEast = blockrange ? 2048 /* WALL_NORTH_EAST_PROJ_BLOCKER */ : 4 /* WALL_NORTH_EAST */;
    const southWest = blockrange ? 32768 /* WALL_SOUTH_WEST_PROJ_BLOCKER */ : 64 /* WALL_SOUTH_WEST */;
    if (shape === 0 /* WALL_STRAIGHT */) {
      if (angle === 0 /* WEST */) {
        this.remCMap(x, z, west);
        this.remCMap(x - 1, z, east);
      } else if (angle === 1 /* NORTH */) {
        this.remCMap(x, z, north);
        this.remCMap(x, z + 1, south);
      } else if (angle === 2 /* EAST */) {
        this.remCMap(x, z, east);
        this.remCMap(x + 1, z, west);
      } else if (angle === 3 /* SOUTH */) {
        this.remCMap(x, z, south);
        this.remCMap(x, z - 1, north);
      }
    } else if (shape === 1 /* WALL_DIAGONAL_CORNER */ || shape === 3 /* WALL_SQUARE_CORNER */) {
      if (angle === 0 /* WEST */) {
        this.remCMap(x, z, northWest);
        this.remCMap(x - 1, z + 1, southEast);
      } else if (angle === 1 /* NORTH */) {
        this.remCMap(x, z, northEast);
        this.remCMap(x + 1, z + 1, southWest);
      } else if (angle === 2 /* EAST */) {
        this.remCMap(x, z, southEast);
        this.remCMap(x + 1, z - 1, northWest);
      } else if (angle === 3 /* SOUTH */) {
        this.remCMap(x, z, southWest);
        this.remCMap(x - 1, z - 1, northEast);
      }
    } else if (shape === 2 /* WALL_L */) {
      if (angle === 0 /* WEST */) {
        this.remCMap(x, z, north | west);
        this.remCMap(x - 1, z, east);
        this.remCMap(x, z + 1, south);
      } else if (angle === 1 /* NORTH */) {
        this.remCMap(x, z, north | east);
        this.remCMap(x, z + 1, south);
        this.remCMap(x + 1, z, west);
      } else if (angle === 2 /* EAST */) {
        this.remCMap(x, z, south | east);
        this.remCMap(x + 1, z, west);
        this.remCMap(x, z - 1, north);
      } else if (angle === 3 /* SOUTH */) {
        this.remCMap(x, z, south | west);
        this.remCMap(x, z - 1, north);
        this.remCMap(x - 1, z, east);
      }
    }
    if (blockrange) {
      this.delWall(tileX, tileZ, shape, angle, false);
    }
  }
  testWall(srcX, srcZ, dstX, dstZ, shape, angle) {
    if (srcX === dstX && srcZ === dstZ) {
      return true;
    }
    const sx = srcX - this.startX;
    const sz = srcZ - this.startZ;
    const dx = dstX - this.startX;
    const dz = dstZ - this.startZ;
    const index = CollisionMap.index(sx, sz);
    if (shape === 0 /* WALL_STRAIGHT */) {
      if (angle === 0 /* WEST */) {
        if (sx === dx - 1 && sz === dz) {
          return true;
        } else if (sx === dx && sz === dz + 1 && (this.flags[index] & 2621728 /* BLOCK_NORTH */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx && sz === dz - 1 && (this.flags[index] & 2621698 /* BLOCK_SOUTH */) === 0 /* OPEN */) {
          return true;
        }
      } else if (angle === 1 /* NORTH */) {
        if (sx === dx && sz === dz + 1) {
          return true;
        } else if (sx === dx - 1 && sz === dz && (this.flags[index] & 2621704 /* BLOCK_WEST */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx + 1 && sz === dz && (this.flags[index] & 2621824 /* BLOCK_EAST */) === 0 /* OPEN */) {
          return true;
        }
      } else if (angle === 2 /* EAST */) {
        if (sx === dx + 1 && sz === dz) {
          return true;
        } else if (sx === dx && sz === dz + 1 && (this.flags[index] & 2621728 /* BLOCK_NORTH */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx && sz === dz - 1 && (this.flags[index] & 2621698 /* BLOCK_SOUTH */) === 0 /* OPEN */) {
          return true;
        }
      } else if (angle === 3 /* SOUTH */) {
        if (sx === dx && sz === dz - 1) {
          return true;
        } else if (sx === dx - 1 && sz === dz && (this.flags[index] & 2621704 /* BLOCK_WEST */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx + 1 && sz === dz && (this.flags[index] & 2621824 /* BLOCK_EAST */) === 0 /* OPEN */) {
          return true;
        }
      }
    } else if (shape === 2 /* WALL_L */) {
      if (angle === 0 /* WEST */) {
        if (sx === dx - 1 && sz === dz) {
          return true;
        } else if (sx === dx && sz === dz + 1) {
          return true;
        } else if (sx === dx + 1 && sz === dz && (this.flags[index] & 2621824 /* BLOCK_EAST */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx && sz === dz - 1 && (this.flags[index] & 2621698 /* BLOCK_SOUTH */) === 0 /* OPEN */) {
          return true;
        }
      } else if (angle === 1 /* NORTH */) {
        if (sx === dx - 1 && sz === dz && (this.flags[index] & 2621704 /* BLOCK_WEST */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx && sz === dz + 1) {
          return true;
        } else if (sx === dx + 1 && sz === dz) {
          return true;
        } else if (sx === dx && sz === dz - 1 && (this.flags[index] & 2621698 /* BLOCK_SOUTH */) === 0 /* OPEN */) {
          return true;
        }
      } else if (angle === 2 /* EAST */) {
        if (sx === dx - 1 && sz === dz && (this.flags[index] & 2621704 /* BLOCK_WEST */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx && sz === dz + 1 && (this.flags[index] & 2621728 /* BLOCK_NORTH */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx + 1 && sz === dz) {
          return true;
        } else if (sx === dx && sz === dz - 1) {
          return true;
        }
      } else if (angle === 3 /* SOUTH */) {
        if (sx === dx - 1 && sz === dz) {
          return true;
        } else if (sx === dx && sz === dz + 1 && (this.flags[index] & 2621728 /* BLOCK_NORTH */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx + 1 && sz === dz && (this.flags[index] & 2621824 /* BLOCK_EAST */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx && sz === dz - 1) {
          return true;
        }
      }
    } else if (shape === 9 /* WALL_DIAGONAL */) {
      if (sx === dx && sz === dz + 1 && (this.flags[index] & 32 /* WALL_SOUTH */) === 0 /* OPEN */) {
        return true;
      } else if (sx === dx && sz === dz - 1 && (this.flags[index] & 2 /* WALL_NORTH */) === 0 /* OPEN */) {
        return true;
      } else if (sx === dx - 1 && sz === dz && (this.flags[index] & 8 /* WALL_EAST */) === 0 /* OPEN */) {
        return true;
      } else if (sx === dx + 1 && sz === dz && (this.flags[index] & 128 /* WALL_WEST */) === 0 /* OPEN */) {
        return true;
      }
    }
    return false;
  }
  testWDecor(srcX, srcZ, dstX, dstZ, shape, angle) {
    if (srcX === dstX && srcZ === dstZ) {
      return true;
    }
    const sx = srcX - this.startX;
    const sz = srcZ - this.startZ;
    const dx = dstX - this.startX;
    const dz = dstZ - this.startZ;
    const index = CollisionMap.index(sx, sz);
    if (shape === 6 /* WALLDECOR_DIAGONAL_OFFSET */ || shape === 7 /* WALLDECOR_DIAGONAL_NOOFFSET */) {
      if (shape === 7 /* WALLDECOR_DIAGONAL_NOOFFSET */) {
        angle = angle + 2 & 3;
      }
      if (angle === 0 /* WEST */) {
        if (sx === dx + 1 && sz === dz && (this.flags[index] & 128 /* WALL_WEST */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx && sz === dz - 1 && (this.flags[index] & 2 /* WALL_NORTH */) === 0 /* OPEN */) {
          return true;
        }
      } else if (angle === 1 /* NORTH */) {
        if (sx === dx - 1 && sz === dz && (this.flags[index] & 8 /* WALL_EAST */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx && sz === dz - 1 && (this.flags[index] & 2 /* WALL_NORTH */) === 0 /* OPEN */) {
          return true;
        }
      } else if (angle === 2 /* EAST */) {
        if (sx === dx - 1 && sz === dz && (this.flags[index] & 8 /* WALL_EAST */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx && sz === dz + 1 && (this.flags[index] & 32 /* WALL_SOUTH */) === 0 /* OPEN */) {
          return true;
        }
      } else if (angle === 3 /* SOUTH */) {
        if (sx === dx + 1 && sz === dz && (this.flags[index] & 128 /* WALL_WEST */) === 0 /* OPEN */) {
          return true;
        } else if (sx === dx && sz === dz + 1 && (this.flags[index] & 32 /* WALL_SOUTH */) === 0 /* OPEN */) {
          return true;
        }
      }
    } else if (shape === 8 /* WALLDECOR_DIAGONAL_BOTH */) {
      if (sx === dx && sz === dz + 1 && (this.flags[index] & 32 /* WALL_SOUTH */) === 0 /* OPEN */) {
        return true;
      } else if (sx === dx && sz === dz - 1 && (this.flags[index] & 2 /* WALL_NORTH */) === 0 /* OPEN */) {
        return true;
      } else if (sx === dx - 1 && sz === dz && (this.flags[index] & 8 /* WALL_EAST */) === 0 /* OPEN */) {
        return true;
      } else if (sx === dx + 1 && sz === dz && (this.flags[index] & 128 /* WALL_WEST */) === 0 /* OPEN */) {
        return true;
      }
    }
    return false;
  }
  testLoc(srcX, srcZ, dstX, dstZ, dstSizeX, dstSizeZ, forceapproach) {
    const maxX = dstX + dstSizeX - 1;
    const maxZ = dstZ + dstSizeZ - 1;
    const index = CollisionMap.index(srcX - this.startX, srcZ - this.startZ);
    if (srcX >= dstX && srcX <= maxX && srcZ >= dstZ && srcZ <= maxZ) {
      return true;
    } else if (srcX === dstX - 1 && srcZ >= dstZ && srcZ <= maxZ && (this.flags[index] & 8 /* WALL_EAST */) === 0 /* OPEN */ && (forceapproach & 8 /* WEST */) === 0 /* OPEN */) {
      return true;
    } else if (srcX === maxX + 1 && srcZ >= dstZ && srcZ <= maxZ && (this.flags[index] & 128 /* WALL_WEST */) === 0 /* OPEN */ && (forceapproach & 2 /* EAST */) === 0 /* OPEN */) {
      return true;
    } else if (srcZ === dstZ - 1 && srcX >= dstX && srcX <= maxX && (this.flags[index] & 2 /* WALL_NORTH */) === 0 /* OPEN */ && (forceapproach & 4 /* SOUTH */) === 0 /* OPEN */) {
      return true;
    } else if (srcZ === maxZ + 1 && srcX >= dstX && srcX <= maxX && (this.flags[index] & 32 /* WALL_SOUTH */) === 0 /* OPEN */ && (forceapproach & 1 /* NORTH */) === 0 /* OPEN */) {
      return true;
    }
    return false;
  }
  addCMap(x, z, flags) {
    this.flags[CollisionMap.index(x, z)] |= flags;
  }
  remCMap(x, z, flags) {
    this.flags[CollisionMap.index(x, z)] &= 16777215 /* BOUNDS */ - flags;
  }
}

// src/dash3d/Occlude.ts
class Occlude {
  minTileX;
  maxTileX;
  minTileZ;
  maxTileZ;
  type;
  minX;
  maxX;
  minZ;
  maxZ;
  minY;
  maxY;
  mode = 0;
  minDeltaX = 0;
  maxDeltaX = 0;
  minDeltaZ = 0;
  maxDeltaZ = 0;
  minDeltaY = 0;
  maxDeltaY = 0;
  constructor(minTileX, maxTileX, minTileZ, maxTileZ, type, minX, maxX, minZ, maxZ, minY, maxY) {
    this.minTileX = minTileX;
    this.maxTileX = maxTileX;
    this.minTileZ = minTileZ;
    this.maxTileZ = maxTileZ;
    this.type = type;
    this.minX = minX;
    this.maxX = maxX;
    this.minZ = minZ;
    this.maxZ = maxZ;
    this.minY = minY;
    this.maxY = maxY;
  }
}

// src/dash3d/GroundDecor.ts
class GroundDecor {
  y;
  x;
  z;
  model;
  typecode;
  typecode2;
  constructor(y, x, z, model, typecode, info) {
    this.y = y;
    this.x = x;
    this.z = z;
    this.model = model;
    this.typecode = typecode;
    this.typecode2 = info;
  }
}

// src/dash3d/Sprite.ts
class Sprite {
  level;
  y;
  x;
  z;
  model;
  yaw;
  minTileX;
  maxTileX;
  minTileZ;
  maxTileZ;
  typecode;
  typecode2;
  distance = 0;
  cycle = 0;
  constructor(level, y, x, z, model, yaw, minSceneTileX, maxSceneTileX, minSceneTileZ, maxSceneTileZ, typecode, info) {
    this.level = level;
    this.y = y;
    this.x = x;
    this.z = z;
    this.model = model;
    this.yaw = yaw;
    this.minTileX = minSceneTileX;
    this.maxTileX = maxSceneTileX;
    this.minTileZ = minSceneTileZ;
    this.maxTileZ = maxSceneTileZ;
    this.typecode = typecode;
    this.typecode2 = info;
  }
}

// src/dash3d/GroundObject.ts
class GroundObject {
  y;
  x;
  z;
  topObj;
  middleObj;
  bottomObj;
  typecode;
  height;
  constructor(y, x, z, topObj, middleObj, bottomObj, typecode, offset) {
    this.y = y;
    this.x = x;
    this.z = z;
    this.topObj = topObj;
    this.middleObj = middleObj;
    this.bottomObj = bottomObj;
    this.typecode = typecode;
    this.height = offset;
  }
}

// src/dash3d/Square.ts
class Square extends Linkable {
  level;
  x;
  z;
  originalLevel;
  sprites = new TypedArray1d(5, null);
  spriteSpan = new Int32Array(5);
  quickGround = null;
  ground = null;
  wall = null;
  decor = null;
  groundDecor = null;
  groundObject = null;
  linkedSquare = null;
  spriteCount = 0;
  spriteSpans = 0;
  drawLevel = 0;
  drawFront = false;
  drawBack = false;
  drawSprites = false;
  cornerSides = 0;
  sidesBeforeCorner = 0;
  sidesAfterCorner = 0;
  backWallTypes = 0;
  constructor(level, x, z) {
    super();
    this.originalLevel = this.level = level;
    this.x = x;
    this.z = z;
  }
}

// src/dash3d/Ground.ts
var defShapeP = [
  Int8Array.of(1, 3, 5, 7),
  Int8Array.of(1, 3, 5, 7),
  Int8Array.of(1, 3, 5, 7),
  Int8Array.of(1, 3, 5, 7, 6),
  Int8Array.of(1, 3, 5, 7, 6),
  Int8Array.of(1, 3, 5, 7, 6),
  Int8Array.of(1, 3, 5, 7, 6),
  Int8Array.of(1, 3, 5, 7, 2, 6),
  Int8Array.of(1, 3, 5, 7, 2, 8),
  Int8Array.of(1, 3, 5, 7, 2, 8),
  Int8Array.of(1, 3, 5, 7, 11, 12),
  Int8Array.of(1, 3, 5, 7, 11, 12),
  Int8Array.of(1, 3, 5, 7, 13, 14)
];
var defShapeF = [
  Int8Array.of(0, 1, 2, 3, 0, 0, 1, 3),
  Int8Array.of(1, 1, 2, 3, 1, 0, 1, 3),
  Int8Array.of(0, 1, 2, 3, 1, 0, 1, 3),
  Int8Array.of(0, 0, 1, 2, 0, 0, 2, 4, 1, 0, 4, 3),
  Int8Array.of(0, 0, 1, 4, 0, 0, 4, 3, 1, 1, 2, 4),
  Int8Array.of(0, 0, 4, 3, 1, 0, 1, 2, 1, 0, 2, 4),
  Int8Array.of(0, 1, 2, 4, 1, 0, 1, 4, 1, 0, 4, 3),
  Int8Array.of(0, 4, 1, 2, 0, 4, 2, 5, 1, 0, 4, 5, 1, 0, 5, 3),
  Int8Array.of(0, 4, 1, 2, 0, 4, 2, 3, 0, 4, 3, 5, 1, 0, 4, 5),
  Int8Array.of(0, 0, 4, 5, 1, 4, 1, 2, 1, 4, 2, 3, 1, 4, 3, 5),
  Int8Array.of(0, 0, 1, 5, 0, 1, 4, 5, 0, 1, 2, 4, 1, 0, 5, 3, 1, 5, 4, 3, 1, 4, 2, 3),
  Int8Array.of(1, 0, 1, 5, 1, 1, 4, 5, 1, 1, 2, 4, 0, 0, 5, 3, 0, 5, 4, 3, 0, 4, 2, 3),
  Int8Array.of(1, 0, 5, 4, 1, 0, 1, 5, 0, 0, 4, 3, 0, 4, 5, 3, 0, 5, 2, 3, 0, 1, 2, 5)
];
var FULL_SQUARE = 128;
var HALF_SQUARE = FULL_SQUARE / 2 | 0;
var CORNER_SMALL = FULL_SQUARE / 4 | 0;
var CORNER_BIG = FULL_SQUARE * 3 / 4 | 0;

class Ground {
  static drawVertexX = new Int32Array(6);
  static drawVertexY = new Int32Array(6);
  static drawTextureVertexX = new Int32Array(6);
  static drawTextureVertexY = new Int32Array(6);
  static drawTextureVertexZ = new Int32Array(6);
  vertexX;
  vertexY;
  vertexZ;
  faceColourA;
  faceColourB;
  faceColourC;
  faceVertexA;
  faceVertexB;
  faceVertexC;
  faceTexture;
  flat;
  minimapUnderlay;
  minimapOverlay;
  overlayShape;
  overlayRotation;
  constructor(x, z, shape, rotation, texture, heightSW, heightSE, heightNE, heightNW, colourSW, colourSE, colourNE, colourNW, colour2SW, colour2SE, colour2NE, colour2NW, overlay, underlay) {
    this.flat = !(heightSW !== heightSE || heightSW !== heightNE || heightSW !== heightNW);
    this.overlayShape = shape;
    this.overlayRotation = rotation;
    this.minimapOverlay = overlay;
    this.minimapUnderlay = underlay;
    const points = defShapeP[shape];
    const vertexCount = points.length;
    this.vertexX = new Int32Array(vertexCount);
    this.vertexY = new Int32Array(vertexCount);
    this.vertexZ = new Int32Array(vertexCount);
    const primaryColours = new Int32Array(vertexCount);
    const secondaryColours = new Int32Array(vertexCount);
    const sceneX = x * FULL_SQUARE;
    const sceneZ = z * FULL_SQUARE;
    for (let v = 0;v < vertexCount; v++) {
      let type = points[v];
      if ((type & 1) === 0 && type <= 8) {
        type = (type - rotation - rotation - 1 & 7) + 1;
      }
      if (type > 8 && type <= 12) {
        type = (type - rotation - 9 & 3) + 9;
      }
      if (type > 12 && type <= 16) {
        type = (type - rotation - 13 & 3) + 13;
      }
      let x2;
      let z2;
      let y;
      let colour1;
      let colour2;
      if (type === 1) {
        x2 = sceneX;
        z2 = sceneZ;
        y = heightSW;
        colour1 = colourSW;
        colour2 = colour2SW;
      } else if (type === 2) {
        x2 = sceneX + HALF_SQUARE;
        z2 = sceneZ;
        y = heightSW + heightSE >> 1;
        colour1 = colourSW + colourSE >> 1;
        colour2 = colour2SW + colour2SE >> 1;
      } else if (type === 3) {
        x2 = sceneX + FULL_SQUARE;
        z2 = sceneZ;
        y = heightSE;
        colour1 = colourSE;
        colour2 = colour2SE;
      } else if (type === 4) {
        x2 = sceneX + FULL_SQUARE;
        z2 = sceneZ + HALF_SQUARE;
        y = heightSE + heightNE >> 1;
        colour1 = colourSE + colourNE >> 1;
        colour2 = colour2SE + colour2NE >> 1;
      } else if (type === 5) {
        x2 = sceneX + FULL_SQUARE;
        z2 = sceneZ + FULL_SQUARE;
        y = heightNE;
        colour1 = colourNE;
        colour2 = colour2NE;
      } else if (type === 6) {
        x2 = sceneX + HALF_SQUARE;
        z2 = sceneZ + FULL_SQUARE;
        y = heightNE + heightNW >> 1;
        colour1 = colourNE + colourNW >> 1;
        colour2 = colour2NE + colour2NW >> 1;
      } else if (type === 7) {
        x2 = sceneX;
        z2 = sceneZ + FULL_SQUARE;
        y = heightNW;
        colour1 = colourNW;
        colour2 = colour2NW;
      } else if (type === 8) {
        x2 = sceneX;
        z2 = sceneZ + HALF_SQUARE;
        y = heightNW + heightSW >> 1;
        colour1 = colourNW + colourSW >> 1;
        colour2 = colour2NW + colour2SW >> 1;
      } else if (type === 9) {
        x2 = sceneX + HALF_SQUARE;
        z2 = sceneZ + CORNER_SMALL;
        y = heightSW + heightSE >> 1;
        colour1 = colourSW + colourSE >> 1;
        colour2 = colour2SW + colour2SE >> 1;
      } else if (type === 10) {
        x2 = sceneX + CORNER_BIG;
        z2 = sceneZ + HALF_SQUARE;
        y = heightSE + heightNE >> 1;
        colour1 = colourSE + colourNE >> 1;
        colour2 = colour2SE + colour2NE >> 1;
      } else if (type === 11) {
        x2 = sceneX + HALF_SQUARE;
        z2 = sceneZ + CORNER_BIG;
        y = heightNE + heightNW >> 1;
        colour1 = colourNE + colourNW >> 1;
        colour2 = colour2NE + colour2NW >> 1;
      } else if (type === 12) {
        x2 = sceneX + CORNER_SMALL;
        z2 = sceneZ + HALF_SQUARE;
        y = heightNW + heightSW >> 1;
        colour1 = colourNW + colourSW >> 1;
        colour2 = colour2NW + colour2SW >> 1;
      } else if (type === 13) {
        x2 = sceneX + CORNER_SMALL;
        z2 = sceneZ + CORNER_SMALL;
        y = heightSW;
        colour1 = colourSW;
        colour2 = colour2SW;
      } else if (type === 14) {
        x2 = sceneX + CORNER_BIG;
        z2 = sceneZ + CORNER_SMALL;
        y = heightSE;
        colour1 = colourSE;
        colour2 = colour2SE;
      } else if (type === 15) {
        x2 = sceneX + CORNER_BIG;
        z2 = sceneZ + CORNER_BIG;
        y = heightNE;
        colour1 = colourNE;
        colour2 = colour2NE;
      } else {
        x2 = sceneX + CORNER_SMALL;
        z2 = sceneZ + CORNER_BIG;
        y = heightNW;
        colour1 = colourNW;
        colour2 = colour2NW;
      }
      this.vertexX[v] = x2;
      this.vertexY[v] = y;
      this.vertexZ[v] = z2;
      primaryColours[v] = colour1;
      secondaryColours[v] = colour2;
    }
    const paths = defShapeF[shape];
    const faceCount = paths.length / 4 | 0;
    this.faceVertexA = new Int32Array(faceCount);
    this.faceVertexB = new Int32Array(faceCount);
    this.faceVertexC = new Int32Array(faceCount);
    this.faceColourA = new Int32Array(faceCount);
    this.faceColourB = new Int32Array(faceCount);
    this.faceColourC = new Int32Array(faceCount);
    if (texture !== -1) {
      this.faceTexture = new Int32Array(faceCount);
    } else {
      this.faceTexture = null;
    }
    let index = 0;
    for (let t = 0;t < faceCount; t++) {
      const colour = paths[index];
      let a = paths[index + 1];
      let b = paths[index + 2];
      let c = paths[index + 3];
      index += 4;
      if (a < 4) {
        a = a - rotation & 3;
      }
      if (b < 4) {
        b = b - rotation & 3;
      }
      if (c < 4) {
        c = c - rotation & 3;
      }
      this.faceVertexA[t] = a;
      this.faceVertexB[t] = b;
      this.faceVertexC[t] = c;
      if (colour === 0) {
        this.faceColourA[t] = primaryColours[a];
        this.faceColourB[t] = primaryColours[b];
        this.faceColourC[t] = primaryColours[c];
        if (this.faceTexture) {
          this.faceTexture[t] = -1;
        }
      } else {
        this.faceColourA[t] = secondaryColours[a];
        this.faceColourB[t] = secondaryColours[b];
        this.faceColourC[t] = secondaryColours[c];
        if (this.faceTexture) {
          this.faceTexture[t] = texture;
        }
      }
    }
  }
}

// src/dash3d/QuickGround.ts
class QuickGround {
  colourSW;
  colourSE;
  colourNE;
  colourNW;
  texture;
  minimapRgb;
  flat;
  constructor(colourSW, colourSE, colourNE, colourNW, texture, minimapRgb, flat) {
    this.colourSW = colourSW;
    this.colourSE = colourSE;
    this.colourNE = colourNE;
    this.colourNW = colourNW;
    this.texture = texture;
    this.minimapRgb = minimapRgb;
    this.flat = flat;
  }
}

// src/dash3d/Wall.ts
class Wall {
  y;
  x;
  z;
  angle1;
  angle2;
  model1;
  model2;
  typecode;
  typecode2;
  constructor(y, x, z, angle1, angle2, model1, model2, typecode, typecode2) {
    this.y = y;
    this.x = x;
    this.z = z;
    this.angle1 = angle1;
    this.angle2 = angle2;
    this.model1 = model1;
    this.model2 = model2;
    this.typecode = typecode;
    this.typecode2 = typecode2;
  }
}

// src/dash3d/Decor.ts
class Decor {
  y;
  x;
  z;
  wshape;
  angle;
  model;
  typecode;
  typecode2;
  constructor(y, x, z, wshape, angle, model, typecode, info) {
    this.y = y;
    this.x = x;
    this.z = z;
    this.wshape = wshape;
    this.angle = angle;
    this.model = model;
    this.typecode = typecode;
    this.typecode2 = info;
  }
}

// src/dash3d/World.ts
var PRETAB = Uint8Array.of(19, 55, 38, 155, 255, 110, 137, 205, 76);
var MIDTAB = Uint8Array.of(160, 192, 80, 96, 0, 144, 80, 48, 160);
var POSTTAB = Uint8Array.of(76, 8, 137, 4, 0, 1, 38, 2, 19);
var MIDDEP_16 = Uint8Array.of(0, 0, 2, 0, 0, 2, 1, 1, 0);
var MIDDEP_32 = Uint8Array.of(2, 0, 0, 2, 0, 0, 0, 4, 4);
var MIDDEP_64 = Uint8Array.of(0, 4, 4, 8, 0, 0, 8, 0, 0);
var MIDDEP_128 = Uint8Array.of(1, 1, 0, 0, 0, 8, 0, 0, 8);
var DECORXOF = Int8Array.of(53, -53, -53, 53);
var DECORZOF = Int8Array.of(-53, -53, 53, 53);
var DECORXOF2 = Int8Array.of(-45, 45, 45, -45);
var DECORZOF2 = Int8Array.of(45, 45, -45, -45);
var MINIMAP_SHAPE = [
  new Uint8Array(16),
  Uint8Array.of(1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
  Uint8Array.of(1, 0, 0, 0, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 1),
  Uint8Array.of(1, 1, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0),
  Uint8Array.of(0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0, 1),
  Uint8Array.of(0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1),
  Uint8Array.of(1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 1, 1, 1, 1, 1),
  Uint8Array.of(1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0),
  Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0),
  Uint8Array.of(1, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 1),
  Uint8Array.of(1, 1, 1, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0),
  Uint8Array.of(0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1),
  Uint8Array.of(0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 1, 1)
];
var MINIMAP_ROTATE = [
  Uint8Array.of(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15),
  Uint8Array.of(12, 8, 4, 0, 13, 9, 5, 1, 14, 10, 6, 2, 15, 11, 7, 3),
  Uint8Array.of(15, 14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0),
  Uint8Array.of(3, 7, 11, 15, 2, 6, 10, 14, 1, 5, 9, 13, 0, 4, 8, 12)
];
var TEXTURE_AVERAGE = Uint16Array.of(41, 39248, 41, 4643, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 43086, 41, 41, 41, 41, 41, 41, 41, 8602, 41, 28992, 41, 41, 41, 41, 41, 5056, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 41, 3131, 41, 41, 41);

class World {
  static lowMem = true;
  static cameraSinX = 0;
  static cameraCosX = 0;
  static cameraSinY = 0;
  static cameraCosY = 0;
  static fillLeft = 0;
  static fillQueue = new LinkList;
  static maxLevel = 0;
  static cycleNo = 0;
  static minX = 0;
  static maxX = 0;
  static minZ = 0;
  static maxZ = 0;
  static gx = 0;
  static gz = 0;
  static cx = 0;
  static cy = 0;
  static cz = 0;
  static click = false;
  static clickX = 0;
  static clickY = 0;
  static groundX = -1;
  static groundZ = -1;
  static visibilityMatrix = new TypedArray4d(8, 32, 51, 51, false);
  static visibilityMap = null;
  static activeOccluderCount = 0;
  static activeOccluders = new TypedArray1d(500, null);
  static levelOccluderCount = new Int32Array(4 /* LEVELS */);
  static levelOccluders = new TypedArray2d(4 /* LEVELS */, 500, null);
  static spriteBuffer = new TypedArray1d(100, null);
  static viewportLeft = 0;
  static viewportTop = 0;
  static viewportRight = 0;
  static viewportBottom = 0;
  static viewportCentreX = 0;
  static viewportCentreY = 0;
  maxTileLevel;
  maxTileX;
  maxTileZ;
  groundh;
  levelTiles;
  dynamicSprites;
  occlusionCycle;
  shareTickA;
  shareTickB;
  dynamicCount = 0;
  minLevel = 0;
  shareTic = 0;
  constructor(levelHeightmaps, maxTileZ, maxLevel, maxTileX) {
    this.maxTileLevel = maxLevel;
    this.maxTileX = maxTileX;
    this.maxTileZ = maxTileZ;
    this.levelTiles = new TypedArray3d(maxLevel, maxTileX, maxTileZ, null);
    this.occlusionCycle = new Int32Array3d(maxLevel, maxTileX + 1, maxTileZ + 1);
    this.groundh = levelHeightmaps;
    this.dynamicSprites = new TypedArray1d(5000, null);
    this.shareTickA = new Int32Array(1e4);
    this.shareTickB = new Int32Array(1e4);
    this.resetMap();
  }
  resetMap() {
    for (let level = 0;level < this.maxTileLevel; level++) {
      for (let x = 0;x < this.maxTileX; x++) {
        for (let z = 0;z < this.maxTileZ; z++) {
          this.levelTiles[level][x][z] = null;
        }
      }
    }
    for (let l = 0;l < 4 /* LEVELS */; l++) {
      for (let o = 0;o < World.levelOccluderCount[l]; o++) {
        World.levelOccluders[l][o] = null;
      }
      World.levelOccluderCount[l] = 0;
    }
    for (let i = 0;i < this.dynamicCount; i++) {
      this.dynamicSprites[i] = null;
    }
    this.dynamicCount = 0;
    World.spriteBuffer.fill(null);
  }
  fillBaseLevel(level) {
    this.minLevel = level;
    for (let stx = 0;stx < this.maxTileX; stx++) {
      for (let stz = 0;stz < this.maxTileZ; stz++) {
        this.levelTiles[level][stx][stz] = new Square(level, stx, stz);
      }
    }
  }
  pushDown(stx, stz) {
    const below = this.levelTiles[0][stx][stz];
    for (let level = 0;level < 3; level++) {
      this.levelTiles[level][stx][stz] = this.levelTiles[level + 1][stx][stz];
      const tile2 = this.levelTiles[level][stx][stz];
      if (tile2) {
        tile2.level--;
      }
    }
    if (!this.levelTiles[0][stx][stz]) {
      this.levelTiles[0][stx][stz] = new Square(0, stx, stz);
    }
    const tile = this.levelTiles[0][stx][stz];
    if (tile) {
      tile.linkedSquare = below;
    }
    this.levelTiles[3][stx][stz] = null;
  }
  static setOcclude(level, type, minX, minY, minZ, maxX, maxY, maxZ) {
    World.levelOccluders[level][World.levelOccluderCount[level]++] = new Occlude(minX / 128 | 0, maxX / 128 | 0, minZ / 128 | 0, maxZ / 128 | 0, type, minX, maxX, minZ, maxZ, minY, maxY);
  }
  setLayer(level, stx, stz, drawLevel) {
    const tile = this.levelTiles[level][stx][stz];
    if (!tile) {
      return;
    }
    tile.drawLevel = drawLevel;
  }
  setGround(level, x, z, shape, rotation, texture, heightSW, heightSE, heightNE, heightNW, colourSW, colourSE, colourNE, colourNW, colour2SW, colour2SE, colour2NE, colour2NW, overlay, underlay) {
    if (shape === 0 /* PLAIN */) {
      for (let l = level;l >= 0; l--) {
        if (!this.levelTiles[l][x][z]) {
          this.levelTiles[l][x][z] = new Square(l, x, z);
        }
      }
      const tile = this.levelTiles[level][x][z];
      if (tile) {
        tile.quickGround = new QuickGround(colourSW, colourSE, colourNE, colourNW, -1, overlay, false);
      }
    } else if (shape === 1 /* DIAGONAL */) {
      for (let l = level;l >= 0; l--) {
        if (!this.levelTiles[l][x][z]) {
          this.levelTiles[l][x][z] = new Square(l, x, z);
        }
      }
      const tile = this.levelTiles[level][x][z];
      if (tile) {
        tile.quickGround = new QuickGround(colour2SW, colour2SE, colour2NE, colour2NW, texture, underlay, heightSW === heightSE && heightSW === heightNE && heightSW === heightNW);
      }
    } else {
      for (let l = level;l >= 0; l--) {
        if (!this.levelTiles[l][x][z]) {
          this.levelTiles[l][x][z] = new Square(l, x, z);
        }
      }
      const tile = this.levelTiles[level][x][z];
      if (tile) {
        tile.ground = new Ground(x, z, shape, rotation, texture, heightSW, heightSE, heightNE, heightNW, colourSW, colourSE, colourNE, colourNW, colour2SW, colour2SE, colour2NE, colour2NW, overlay, underlay);
      }
    }
  }
  setGroundDecor(model, tileLevel, tileX, tileZ, y, typecode, typecode2) {
    if (!this.levelTiles[tileLevel][tileX][tileZ]) {
      this.levelTiles[tileLevel][tileX][tileZ] = new Square(tileLevel, tileX, tileZ);
    }
    const tile = this.levelTiles[tileLevel][tileX][tileZ];
    if (tile) {
      tile.groundDecor = new GroundDecor(y, tileX * 128 + 64, tileZ * 128 + 64, model, typecode, typecode2);
    }
  }
  delGroundDecor(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    tile.groundDecor = null;
  }
  setObj(stx, stz, y, level, typecode, topObj, middleObj, bottomObj) {
    let stackOffset = 0;
    const tile = this.levelTiles[level][stx][stz];
    if (tile) {
      for (let l = 0;l < tile.spriteCount; l++) {
        const sprite = tile.sprites[l];
        if (!sprite || !sprite.model || !(sprite.model instanceof Model)) {
          continue;
        }
        const height = sprite.model.objRaise;
        if (height > stackOffset) {
          stackOffset = height;
        }
      }
    } else {
      this.levelTiles[level][stx][stz] = new Square(level, stx, stz);
    }
    const tile2 = this.levelTiles[level][stx][stz];
    if (tile2) {
      tile2.groundObject = new GroundObject(y, stx * 128 + 64, stz * 128 + 64, topObj, middleObj, bottomObj, typecode, stackOffset);
    }
  }
  delObj(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    tile.groundObject = null;
  }
  setWall(level, tileX, tileZ, y, angle1, angle2, model1, model2, typecode1, typecode2) {
    if (!model1 && !model2) {
      return;
    }
    for (let l = level;l >= 0; l--) {
      if (!this.levelTiles[l][tileX][tileZ]) {
        this.levelTiles[l][tileX][tileZ] = new Square(l, tileX, tileZ);
      }
    }
    const tile = this.levelTiles[level][tileX][tileZ];
    if (tile) {
      tile.wall = new Wall(y, tileX * 128 + 64, tileZ * 128 + 64, angle1, angle2, model1, model2, typecode1, typecode2);
    }
  }
  delWall(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    tile.wall = null;
  }
  setDecor(level, tileX, tileZ, y, offsetX, offsetZ, typecode, model, info, angle, type) {
    if (!model) {
      return;
    }
    for (let l = level;l >= 0; l--) {
      if (!this.levelTiles[l][tileX][tileZ]) {
        this.levelTiles[l][tileX][tileZ] = new Square(l, tileX, tileZ);
      }
    }
    const tile = this.levelTiles[level][tileX][tileZ];
    if (tile) {
      tile.decor = new Decor(y, tileX * 128 + offsetX + 64, tileZ * 128 + offsetZ + 64, type, angle, model, typecode, info);
    }
  }
  delDecor(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    tile.decor = null;
  }
  setDecorOffset(level, x, z, offset) {
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    const decor = tile.decor;
    if (!decor) {
      return;
    }
    const sx = x * 128 + 64;
    const sz = z * 128 + 64;
    decor.x = sx + ((decor.x - sx) * offset / 16 | 0);
    decor.z = sz + ((decor.z - sz) * offset / 16 | 0);
  }
  setDecorModel(level, x, z, model) {
    if (!model) {
      return;
    }
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    const decor = tile.decor;
    if (!decor) {
      return;
    }
    decor.model = model;
  }
  setGroundDecorModel(level, x, z, model) {
    if (!model) {
      return;
    }
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    const decor = tile.groundDecor;
    if (!decor) {
      return;
    }
    decor.model = model;
  }
  setWallModel(level, x, z, model) {
    if (!model) {
      return;
    }
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    const wall = tile.wall;
    if (!wall) {
      return;
    }
    wall.model1 = model;
  }
  setWallModels(x, z, level, modelA, modelB) {
    if (!modelA) {
      return;
    }
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    const wall = tile.wall;
    if (!wall) {
      return;
    }
    wall.model1 = modelA;
    wall.model2 = modelB;
  }
  addScenery(level, tileX, tileZ, y, model, typecode, info, width, length, yaw) {
    if (!model) {
      return true;
    }
    const sceneX = tileX * 128 + width * 64;
    const sceneZ = tileZ * 128 + length * 64;
    return this.setSprite(sceneX, sceneZ, y, level, tileX, tileZ, width, length, model, typecode, info, yaw, false);
  }
  addDynamic(level, x, y, z, model, typecode, yaw, padding, forwardPadding) {
    if (!model) {
      return true;
    }
    let x0 = x - padding;
    let z0 = z - padding;
    let x1 = x + padding;
    let z1 = z + padding;
    if (forwardPadding) {
      if (yaw > 640 && yaw < 1408) {
        z1 += 128;
      }
      if (yaw > 1152 && yaw < 1920) {
        x1 += 128;
      }
      if (yaw > 1664 || yaw < 384) {
        z0 -= 128;
      }
      if (yaw > 128 && yaw < 896) {
        x0 -= 128;
      }
    }
    x0 = x0 / 128 | 0;
    z0 = z0 / 128 | 0;
    x1 = x1 / 128 | 0;
    z1 = z1 / 128 | 0;
    return this.setSprite(x, z, y, level, x0, z0, x1 + 1 - x0, z1 - z0 + 1, model, typecode, 0, yaw, true);
  }
  addDynamic2(level, x, y, z, minTileX, minTileZ, maxTileX, maxTileZ, model, typecode, yaw) {
    return !model || this.setSprite(x, z, y, level, minTileX, minTileZ, maxTileX + 1 - minTileX, maxTileZ - minTileZ + 1, model, typecode, 0, yaw, true);
  }
  delLoc(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    for (let l = 0;l < tile.spriteCount; l++) {
      const loc = tile.sprites[l];
      if (loc && (loc.typecode >> 29 & 3) === 2 && loc.minTileX === x && loc.minTileZ === z) {
        this.delSprite(loc);
        return;
      }
    }
  }
  removeSprites() {
    for (let i = 0;i < this.dynamicCount; i++) {
      const sprite = this.dynamicSprites[i];
      if (sprite) {
        this.delSprite(sprite);
      }
      this.dynamicSprites[i] = null;
    }
    this.dynamicCount = 0;
  }
  wallType(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    return !tile || !tile.wall ? 0 : tile.wall.typecode;
  }
  decorType(level, z, x) {
    const tile = this.levelTiles[level][x][z];
    return !tile || !tile.decor ? 0 : tile.decor.typecode;
  }
  sceneType(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return 0;
    }
    for (let l = 0;l < tile.spriteCount; l++) {
      const sprite = tile.sprites[l];
      if (sprite && (sprite.typecode >> 29 & 3) === 2 && sprite.minTileX === x && sprite.minTileZ === z) {
        return sprite.typecode;
      }
    }
    return 0;
  }
  gdType(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    return !tile || !tile.groundDecor ? 0 : tile.groundDecor.typecode;
  }
  getWall(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    return !tile || !tile.wall ? null : tile.wall;
  }
  getDecor(level, z, x) {
    const tile = this.levelTiles[level][x][z];
    return !tile || !tile.decor ? null : tile.decor;
  }
  getScene(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return null;
    }
    for (let l = 0;l < tile.spriteCount; l++) {
      const sprite = tile.sprites[l];
      if (sprite && (sprite.typecode >> 29 & 3) === 2 && sprite.minTileX === x && sprite.minTileZ === z) {
        return sprite;
      }
    }
    return null;
  }
  getGd(level, x, z) {
    const tile = this.levelTiles[level][x][z];
    return !tile || !tile.groundDecor ? null : tile.groundDecor;
  }
  typeCode2(level, x, z, typecode) {
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return -1;
    } else if (tile.wall && tile.wall.typecode === typecode) {
      return tile.wall.typecode2 & 255;
    } else if (tile.decor && tile.decor.typecode === typecode) {
      return tile.decor.typecode2 & 255;
    } else if (tile.groundDecor && tile.groundDecor.typecode === typecode) {
      return tile.groundDecor.typecode2 & 255;
    } else {
      for (let i = 0;i < tile.spriteCount; i++) {
        const sprite = tile.sprites[i];
        if (sprite && sprite.typecode === typecode) {
          return sprite.typecode2 & 255;
        }
      }
      return -1;
    }
  }
  shareLight(ambient, contrast, lightSrcX, lightSrcY, lightSrcZ) {
    const lightMagnitude = Math.sqrt(lightSrcX * lightSrcX + lightSrcY * lightSrcY + lightSrcZ * lightSrcZ) | 0;
    const attenuation = contrast * lightMagnitude >> 8;
    for (let level = 0;level < this.maxTileLevel; level++) {
      for (let tileX = 0;tileX < this.maxTileX; tileX++) {
        for (let tileZ = 0;tileZ < this.maxTileZ; tileZ++) {
          const tile = this.levelTiles[level][tileX][tileZ];
          if (!tile) {
            continue;
          }
          const wall = tile.wall;
          if (wall && wall.model1 && wall.model1.vertexNormal) {
            this.shareLightLoc(level, tileX, tileZ, 1, 1, wall.model1);
            if (wall.model2 && wall.model2.vertexNormal) {
              this.shareLightLoc(level, tileX, tileZ, 1, 1, wall.model2);
              this.modelShareLight(wall.model1, wall.model2, 0, 0, 0, false);
              wall.model2.light(ambient, attenuation, lightSrcX, lightSrcY, lightSrcZ);
            }
            wall.model1.light(ambient, attenuation, lightSrcX, lightSrcY, lightSrcZ);
          }
          for (let i = 0;i < tile.spriteCount; i++) {
            const sprite = tile.sprites[i];
            if (sprite && sprite.model && sprite.model.vertexNormal) {
              this.shareLightLoc(level, tileX, tileZ, sprite.maxTileX + 1 - sprite.minTileX, sprite.maxTileZ - sprite.minTileZ + 1, sprite.model);
              sprite.model.light(ambient, attenuation, lightSrcX, lightSrcY, lightSrcZ);
            }
          }
          const decor = tile.groundDecor;
          if (decor && decor.model && decor.model.vertexNormal) {
            this.shareLightGd(level, tileX, tileZ, decor.model);
            decor.model.light(ambient, attenuation, lightSrcX, lightSrcY, lightSrcZ);
          }
        }
      }
    }
  }
  shareLightGd(level, tileX, tileZ, model) {
    if (tileX < this.maxTileX) {
      const tile = this.levelTiles[level][tileX + 1][tileZ];
      if (tile && tile.groundDecor && tile.groundDecor.model && tile.groundDecor.model.vertexNormal) {
        this.modelShareLight(model, tile.groundDecor.model, 128, 0, 0, true);
      }
    }
    if (tileZ < this.maxTileX) {
      const tile = this.levelTiles[level][tileX][tileZ + 1];
      if (tile && tile.groundDecor && tile.groundDecor.model && tile.groundDecor.model.vertexNormal) {
        this.modelShareLight(model, tile.groundDecor.model, 0, 0, 128, true);
      }
    }
    if (tileX < this.maxTileX && tileZ < this.maxTileZ) {
      const tile = this.levelTiles[level][tileX + 1][tileZ + 1];
      if (tile && tile.groundDecor && tile.groundDecor.model && tile.groundDecor.model.vertexNormal) {
        this.modelShareLight(model, tile.groundDecor.model, 128, 0, 128, true);
      }
    }
    if (tileX < this.maxTileX && tileZ > 0) {
      const tile = this.levelTiles[level][tileX + 1][tileZ - 1];
      if (tile && tile.groundDecor && tile.groundDecor.model && tile.groundDecor.model.vertexNormal) {
        this.modelShareLight(model, tile.groundDecor.model, 128, 0, -128, true);
      }
    }
  }
  shareLightLoc(level, tileX, tileZ, tileSizeX, tileSizeZ, model) {
    let allowFaceRemoval = true;
    let minTileX = tileX;
    const maxTileX = tileX + tileSizeX;
    const minTileZ = tileZ - 1;
    const maxTileZ = tileZ + tileSizeZ;
    for (let l = level;l <= level + 1; l++) {
      if (l === this.maxTileLevel) {
        continue;
      }
      for (let x = minTileX;x <= maxTileX; x++) {
        if (x < 0 || x >= this.maxTileX) {
          continue;
        }
        for (let z = minTileZ;z <= maxTileZ; z++) {
          if (z < 0 || z >= this.maxTileZ || allowFaceRemoval && x < maxTileX && z < maxTileZ && (z >= tileZ || x === tileX)) {
            continue;
          }
          const tile = this.levelTiles[l][x][z];
          if (!tile) {
            continue;
          }
          const offsetX = (x - tileX) * 128 + (1 - tileSizeX) * 64;
          const offsetZ = (z - tileZ) * 128 + (1 - tileSizeZ) * 64;
          const offsetY = ((this.groundh[l][x][z] + this.groundh[l][x + 1][z] + this.groundh[l][x][z + 1] + this.groundh[l][x + 1][z + 1]) / 4 | 0) - ((this.groundh[level][tileX][tileZ] + this.groundh[level][tileX + 1][tileZ] + this.groundh[level][tileX][tileZ + 1] + this.groundh[level][tileX + 1][tileZ + 1]) / 4 | 0);
          const wall = tile.wall;
          if (wall && wall.model1 && wall.model1.vertexNormal) {
            this.modelShareLight(model, wall.model1, offsetX, offsetY, offsetZ, allowFaceRemoval);
          }
          if (wall && wall.model2 && wall.model2.vertexNormal) {
            this.modelShareLight(model, wall.model2, offsetX, offsetY, offsetZ, allowFaceRemoval);
          }
          for (let i = 0;i < tile.spriteCount; i++) {
            const sprite = tile.sprites[i];
            if (!sprite || !sprite.model || !sprite.model.vertexNormal) {
              continue;
            }
            const tileSizeX2 = sprite.maxTileX + 1 - sprite.minTileX;
            const tileSizeZ2 = sprite.maxTileZ + 1 - sprite.minTileZ;
            this.modelShareLight(model, sprite.model, (sprite.minTileX - tileX) * 128 + (tileSizeX2 - tileSizeX2) * 64, offsetY, (sprite.minTileZ - tileZ) * 128 + (tileSizeZ2 - tileSizeZ2) * 64, allowFaceRemoval);
          }
        }
      }
      minTileX--;
      allowFaceRemoval = false;
    }
  }
  modelShareLight(modelA, modelB, offsetX, offsetY, offsetZ, allowFaceRemoval) {
    this.shareTic++;
    let merged = 0;
    const vertexX = modelB.vertexX;
    const vertexCountB = modelB.vertexCount;
    if (modelA.vertexNormal && modelA.vertexNormalOriginal) {
      for (let vertexA = 0;vertexA < modelA.vertexCount; vertexA++) {
        const normalA = modelA.vertexNormal[vertexA];
        const originalNormalA = modelA.vertexNormalOriginal[vertexA];
        if (originalNormalA && originalNormalA.w !== 0) {
          const y = modelA.vertexY[vertexA] - offsetY;
          if (y > modelB.maxY) {
            continue;
          }
          const x = modelA.vertexX[vertexA] - offsetX;
          if (x < modelB.minX || x > modelB.maxX) {
            continue;
          }
          const z = modelA.vertexZ[vertexA] - offsetZ;
          if (z < modelB.minZ || z > modelB.maxZ) {
            continue;
          }
          if (modelB.vertexNormal && modelB.vertexNormalOriginal) {
            for (let vertexB = 0;vertexB < vertexCountB; vertexB++) {
              const normalB = modelB.vertexNormal[vertexB];
              const originalNormalB = modelB.vertexNormalOriginal[vertexB];
              if (x !== vertexX[vertexB] || z !== modelB.vertexZ[vertexB] || y !== modelB.vertexY[vertexB] || originalNormalB && originalNormalB.w === 0) {
                continue;
              }
              if (normalA && normalB && originalNormalB) {
                normalA.x += originalNormalB.x;
                normalA.y += originalNormalB.y;
                normalA.z += originalNormalB.z;
                normalA.w += originalNormalB.w;
                normalB.x += originalNormalA.x;
                normalB.y += originalNormalA.y;
                normalB.z += originalNormalA.z;
                normalB.w += originalNormalA.w;
                merged++;
              }
              this.shareTickA[vertexA] = this.shareTic;
              this.shareTickB[vertexB] = this.shareTic;
            }
          }
        }
      }
    }
    if (merged < 3 || !allowFaceRemoval) {
      return;
    }
    if (modelA.faceRenderType) {
      for (let i = 0;i < modelA.faceCount; i++) {
        if (this.shareTickA[modelA.faceVertexA[i]] === this.shareTic && this.shareTickA[modelA.faceVertexB[i]] === this.shareTic && this.shareTickA[modelA.faceVertexC[i]] === this.shareTic) {
          modelA.faceRenderType[i] = -1;
        }
      }
    }
    if (modelB.faceRenderType) {
      for (let i = 0;i < modelB.faceCount; i++) {
        if (this.shareTickB[modelB.faceVertexA[i]] === this.shareTic && this.shareTickB[modelB.faceVertexB[i]] === this.shareTic && this.shareTickB[modelB.faceVertexC[i]] === this.shareTic) {
          modelB.faceRenderType[i] = -1;
        }
      }
    }
  }
  render2DGround(level, x, z, dst, offset, step) {
    const tile = this.levelTiles[level][x][z];
    if (!tile) {
      return;
    }
    const quickGround = tile.quickGround;
    if (quickGround) {
      const rgb = quickGround.minimapRgb;
      if (rgb !== 0) {
        for (let i = 0;i < 4; i++) {
          dst[offset] = rgb;
          dst[offset + 1] = rgb;
          dst[offset + 2] = rgb;
          dst[offset + 3] = rgb;
          offset += step;
        }
      }
      return;
    }
    const ground = tile.ground;
    if (ground) {
      const shape = ground.overlayShape;
      const rotation = ground.overlayRotation;
      const overlay = ground.minimapOverlay;
      const underlay = ground.minimapUnderlay;
      const minimapShape = MINIMAP_SHAPE[shape];
      const minimapRotation = MINIMAP_ROTATE[rotation];
      let off = 0;
      if (overlay !== 0) {
        for (let i = 0;i < 4; i++) {
          dst[offset] = minimapShape[minimapRotation[off++]] === 0 ? overlay : underlay;
          dst[offset + 1] = minimapShape[minimapRotation[off++]] === 0 ? overlay : underlay;
          dst[offset + 2] = minimapShape[minimapRotation[off++]] === 0 ? overlay : underlay;
          dst[offset + 3] = minimapShape[minimapRotation[off++]] === 0 ? overlay : underlay;
          offset += step;
        }
        return;
      }
      for (let i = 0;i < 4; i++) {
        if (minimapShape[minimapRotation[off++]] !== 0) {
          dst[offset] = underlay;
        }
        if (minimapShape[minimapRotation[off++]] !== 0) {
          dst[offset + 1] = underlay;
        }
        if (minimapShape[minimapRotation[off++]] !== 0) {
          dst[offset + 2] = underlay;
        }
        if (minimapShape[minimapRotation[off++]] !== 0) {
          dst[offset + 3] = underlay;
        }
        offset += step;
      }
    }
  }
  static init(pitchDistance, frustumStart, frustumEnd, viewportWidth, viewportHeight) {
    this.viewportLeft = 0;
    this.viewportTop = 0;
    this.viewportRight = viewportWidth;
    this.viewportBottom = viewportHeight;
    this.viewportCentreX = viewportWidth / 2 | 0;
    this.viewportCentreY = viewportHeight / 2 | 0;
    const matrix = new TypedArray4d(9, 32, 53, 53, false);
    for (let pitch = 128;pitch <= 384; pitch += 32) {
      for (let yaw = 0;yaw < 2048; yaw += 64) {
        this.cameraSinX = Pix3D.sinTable[pitch];
        this.cameraCosX = Pix3D.cosTable[pitch];
        this.cameraSinY = Pix3D.sinTable[yaw];
        this.cameraCosY = Pix3D.cosTable[yaw];
        const pitchLevel = (pitch - 128) / 32 | 0;
        const yawLevel = yaw / 64 | 0;
        for (let dx = -26;dx <= 26; dx++) {
          for (let dz = -26;dz <= 26; dz++) {
            const x = dx * 128;
            const z = dz * 128;
            let visible = false;
            for (let y = -frustumStart;y <= frustumEnd; y += 128) {
              if (this.testPoint(x, z, pitchDistance[pitchLevel] + y)) {
                visible = true;
                break;
              }
            }
            matrix[pitchLevel][yawLevel][dx + 25 + 1][dz + 25 + 1] = visible;
          }
        }
      }
    }
    for (let pitchLevel = 0;pitchLevel < 8; pitchLevel++) {
      for (let yawLevel = 0;yawLevel < 32; yawLevel++) {
        for (let x = -25;x < 25; x++) {
          for (let z = -25;z < 25; z++) {
            let visible = false;
            check_areas:
              for (let dx = -1;dx <= 1; dx++) {
                for (let dz = -1;dz <= 1; dz++) {
                  if (matrix[pitchLevel][yawLevel][x + dx + 25 + 1][z + dz + 25 + 1]) {
                    visible = true;
                    break check_areas;
                  }
                  if (matrix[pitchLevel][(yawLevel + 1) % 31][x + dx + 25 + 1][z + dz + 25 + 1]) {
                    visible = true;
                    break check_areas;
                  }
                  if (matrix[pitchLevel + 1][yawLevel][x + dx + 25 + 1][z + dz + 25 + 1]) {
                    visible = true;
                    break check_areas;
                  }
                  if (matrix[pitchLevel + 1][(yawLevel + 1) % 31][x + dx + 25 + 1][z + dz + 25 + 1]) {
                    visible = true;
                    break check_areas;
                  }
                }
              }
            this.visibilityMatrix[pitchLevel][yawLevel][x + 25][z + 25] = visible;
          }
        }
      }
    }
  }
  static testPoint(x, z, y) {
    const px = z * this.cameraSinY + x * this.cameraCosY >> 16;
    const tmp = z * this.cameraCosY - x * this.cameraSinY >> 16;
    const pz = y * this.cameraSinX + tmp * this.cameraCosX >> 16;
    const py = y * this.cameraCosX - tmp * this.cameraSinX >> 16;
    if (pz < 50 || pz > 3500) {
      return false;
    }
    const viewportX = this.viewportCentreX + ((px << 9) / pz | 0);
    const viewportY = this.viewportCentreY + ((py << 9) / pz | 0);
    return viewportX >= this.viewportLeft && viewportX <= this.viewportRight && viewportY >= this.viewportTop && viewportY <= this.viewportBottom;
  }
  updateMousePicking(mouseX, mouseY) {
    World.click = true;
    World.clickX = mouseX;
    World.clickY = mouseY;
    World.groundX = -1;
    World.groundZ = -1;
  }
  renderAll(eyeX, eyeY, eyeZ, maxLevel, eyeYaw, eyePitch, loopCycle) {
    if (eyeX < 0) {
      eyeX = 0;
    } else if (eyeX >= this.maxTileX * 128) {
      eyeX = this.maxTileX * 128 - 1;
    }
    if (eyeZ < 0) {
      eyeZ = 0;
    } else if (eyeZ >= this.maxTileZ * 128) {
      eyeZ = this.maxTileZ * 128 - 1;
    }
    World.cycleNo++;
    World.cameraSinX = Pix3D.sinTable[eyePitch];
    World.cameraCosX = Pix3D.cosTable[eyePitch];
    World.cameraSinY = Pix3D.sinTable[eyeYaw];
    World.cameraCosY = Pix3D.cosTable[eyeYaw];
    World.visibilityMap = World.visibilityMatrix[(eyePitch - 128) / 32 | 0][eyeYaw / 64 | 0];
    World.cx = eyeX;
    World.cy = eyeY;
    World.cz = eyeZ;
    World.gx = eyeX / 128 | 0;
    World.gz = eyeZ / 128 | 0;
    World.maxLevel = maxLevel;
    World.minX = World.gx - 25;
    if (World.minX < 0) {
      World.minX = 0;
    }
    World.minZ = World.gz - 25;
    if (World.minZ < 0) {
      World.minZ = 0;
    }
    World.maxX = World.gx + 25;
    if (World.maxX > this.maxTileX) {
      World.maxX = this.maxTileX;
    }
    World.maxZ = World.gz + 25;
    if (World.maxZ > this.maxTileZ) {
      World.maxZ = this.maxTileZ;
    }
    this.calcOcclude();
    World.fillLeft = 0;
    for (let level = this.minLevel;level < this.maxTileLevel; level++) {
      const tiles = this.levelTiles[level];
      for (let x = World.minX;x < World.maxX; x++) {
        for (let z = World.minZ;z < World.maxZ; z++) {
          const tile = tiles[x][z];
          if (!tile) {
            continue;
          }
          if (tile.drawLevel <= maxLevel && (World.visibilityMap[x + 25 - World.gx][z + 25 - World.gz] || this.groundh[level][x][z] - eyeY >= 2000)) {
            tile.drawFront = true;
            tile.drawBack = true;
            tile.drawSprites = tile.spriteCount > 0;
            World.fillLeft++;
          } else {
            tile.drawFront = false;
            tile.drawBack = false;
            tile.cornerSides = 0;
          }
        }
      }
    }
    for (let level = this.minLevel;level < this.maxTileLevel; level++) {
      const tiles = this.levelTiles[level];
      for (let dx = -25;dx <= 0; dx++) {
        const rightTileX = World.gx + dx;
        const leftTileX = World.gx - dx;
        if (rightTileX < World.minX && leftTileX >= World.maxX) {
          continue;
        }
        for (let dz = -25;dz <= 0; dz++) {
          const forwardTileZ = World.gz + dz;
          const backwardTileZ = World.gz - dz;
          let tile;
          if (rightTileX >= World.minX) {
            if (forwardTileZ >= World.minZ) {
              tile = tiles[rightTileX][forwardTileZ];
              if (tile && tile.drawFront) {
                this.fill(tile, true, loopCycle);
              }
            }
            if (backwardTileZ < World.maxZ) {
              tile = tiles[rightTileX][backwardTileZ];
              if (tile && tile.drawFront) {
                this.fill(tile, true, loopCycle);
              }
            }
          }
          if (leftTileX < World.maxX) {
            if (forwardTileZ >= World.minZ) {
              tile = tiles[leftTileX][forwardTileZ];
              if (tile && tile.drawFront) {
                this.fill(tile, true, loopCycle);
              }
            }
            if (backwardTileZ < World.maxZ) {
              tile = tiles[leftTileX][backwardTileZ];
              if (tile && tile.drawFront) {
                this.fill(tile, true, loopCycle);
              }
            }
          }
          if (World.fillLeft === 0) {
            World.click = false;
            return;
          }
        }
      }
    }
    for (let level = this.minLevel;level < this.maxTileLevel; level++) {
      const tiles = this.levelTiles[level];
      for (let dx = -25;dx <= 0; dx++) {
        const rightTileX = World.gx + dx;
        const leftTileX = World.gx - dx;
        if (rightTileX < World.minX && leftTileX >= World.maxX) {
          continue;
        }
        for (let dz = -25;dz <= 0; dz++) {
          const forwardTileZ = World.gz + dz;
          const backgroundTileZ = World.gz - dz;
          let tile;
          if (rightTileX >= World.minX) {
            if (forwardTileZ >= World.minZ) {
              tile = tiles[rightTileX][forwardTileZ];
              if (tile && tile.drawFront) {
                this.fill(tile, false, loopCycle);
              }
            }
            if (backgroundTileZ < World.maxZ) {
              tile = tiles[rightTileX][backgroundTileZ];
              if (tile && tile.drawFront) {
                this.fill(tile, false, loopCycle);
              }
            }
          }
          if (leftTileX < World.maxX) {
            if (forwardTileZ >= World.minZ) {
              tile = tiles[leftTileX][forwardTileZ];
              if (tile && tile.drawFront) {
                this.fill(tile, false, loopCycle);
              }
            }
            if (backgroundTileZ < World.maxZ) {
              tile = tiles[leftTileX][backgroundTileZ];
              if (tile && tile.drawFront) {
                this.fill(tile, false, loopCycle);
              }
            }
          }
          if (World.fillLeft === 0) {
            World.click = false;
            return;
          }
        }
      }
    }
  }
  setSprite(x, z, y, level, tileX, tileZ, tileSizeX, tileSizeZ, model, typecode, info, yaw, dynamic) {
    if (!model) {
      return false;
    }
    for (let tx = tileX;tx < tileX + tileSizeX; tx++) {
      for (let tz = tileZ;tz < tileZ + tileSizeZ; tz++) {
        if (tx < 0 || tz < 0 || tx >= this.maxTileX || tz >= this.maxTileZ) {
          return false;
        }
        const tile = this.levelTiles[level][tx][tz];
        if (tile && tile.spriteCount >= 5) {
          return false;
        }
      }
    }
    const sprite = new Sprite(level, y, x, z, model, yaw, tileX, tileX + tileSizeX - 1, tileZ, tileZ + tileSizeZ - 1, typecode, info);
    for (let tx = tileX;tx < tileX + tileSizeX; tx++) {
      for (let tz = tileZ;tz < tileZ + tileSizeZ; tz++) {
        let spans = 0;
        if (tx > tileX) {
          spans |= 1;
        }
        if (tx < tileX + tileSizeX - 1) {
          spans += 4;
        }
        if (tz > tileZ) {
          spans += 8;
        }
        if (tz < tileZ + tileSizeZ - 1) {
          spans += 2;
        }
        for (let l = level;l >= 0; l--) {
          if (!this.levelTiles[l][tx][tz]) {
            this.levelTiles[l][tx][tz] = new Square(l, tx, tz);
          }
        }
        const tile = this.levelTiles[level][tx][tz];
        if (tile) {
          tile.sprites[tile.spriteCount] = sprite;
          tile.spriteSpan[tile.spriteCount] = spans;
          tile.spriteSpans |= spans;
          tile.spriteCount++;
        }
      }
    }
    if (dynamic) {
      this.dynamicSprites[this.dynamicCount++] = sprite;
    }
    return true;
  }
  delSprite(sprite) {
    for (let tx = sprite.minTileX;tx <= sprite.maxTileX; tx++) {
      for (let tz = sprite.minTileZ;tz <= sprite.maxTileZ; tz++) {
        const tile = this.levelTiles[sprite.level][tx][tz];
        if (!tile) {
          continue;
        }
        for (let i = 0;i < tile.spriteCount; i++) {
          if (tile.sprites[i] === sprite) {
            tile.spriteCount--;
            for (let j = i;j < tile.spriteCount; j++) {
              tile.sprites[j] = tile.sprites[j + 1];
              tile.spriteSpan[j] = tile.spriteSpan[j + 1];
            }
            tile.sprites[tile.spriteCount] = null;
            break;
          }
        }
        tile.spriteSpans = 0;
        for (let i = 0;i < tile.spriteCount; i++) {
          tile.spriteSpans |= tile.spriteSpan[i];
        }
      }
    }
  }
  calcOcclude() {
    const count = World.levelOccluderCount[World.maxLevel];
    const occluders = World.levelOccluders[World.maxLevel];
    World.activeOccluderCount = 0;
    for (let i = 0;i < count; i++) {
      const occluder = occluders[i];
      if (!occluder) {
        continue;
      }
      let deltaMaxY;
      let deltaMinTileZ;
      let deltaMaxTileZ;
      let deltaMaxTileX;
      if (occluder.type === 1) {
        deltaMaxY = occluder.minTileX + 25 - World.gx;
        if (deltaMaxY >= 0 && deltaMaxY <= 50) {
          deltaMinTileZ = occluder.minTileZ + 25 - World.gz;
          if (deltaMinTileZ < 0) {
            deltaMinTileZ = 0;
          }
          deltaMaxTileZ = occluder.maxTileZ + 25 - World.gz;
          if (deltaMaxTileZ > 50) {
            deltaMaxTileZ = 50;
          }
          let ok = false;
          while (deltaMinTileZ <= deltaMaxTileZ) {
            if (World.visibilityMap && World.visibilityMap[deltaMaxY][deltaMinTileZ++]) {
              ok = true;
              break;
            }
          }
          if (ok) {
            deltaMaxTileX = World.cx - occluder.minX;
            if (deltaMaxTileX > 32) {
              occluder.mode = 1;
            } else {
              if (deltaMaxTileX >= -32) {
                continue;
              }
              occluder.mode = 2;
              deltaMaxTileX = -deltaMaxTileX;
            }
            occluder.minDeltaZ = (occluder.minZ - World.cz << 8) / deltaMaxTileX | 0;
            occluder.maxDeltaZ = (occluder.maxZ - World.cz << 8) / deltaMaxTileX | 0;
            occluder.minDeltaY = (occluder.minY - World.cy << 8) / deltaMaxTileX | 0;
            occluder.maxDeltaY = (occluder.maxY - World.cy << 8) / deltaMaxTileX | 0;
            World.activeOccluders[World.activeOccluderCount++] = occluder;
          }
        }
      } else if (occluder.type === 2) {
        deltaMaxY = occluder.minTileZ + 25 - World.gz;
        if (deltaMaxY >= 0 && deltaMaxY <= 50) {
          deltaMinTileZ = occluder.minTileX + 25 - World.gx;
          if (deltaMinTileZ < 0) {
            deltaMinTileZ = 0;
          }
          deltaMaxTileZ = occluder.maxTileX + 25 - World.gx;
          if (deltaMaxTileZ > 50) {
            deltaMaxTileZ = 50;
          }
          let ok = false;
          while (deltaMinTileZ <= deltaMaxTileZ) {
            if (World.visibilityMap && World.visibilityMap[deltaMinTileZ++][deltaMaxY]) {
              ok = true;
              break;
            }
          }
          if (ok) {
            deltaMaxTileX = World.cz - occluder.minZ;
            if (deltaMaxTileX > 32) {
              occluder.mode = 3;
            } else {
              if (deltaMaxTileX >= -32) {
                continue;
              }
              occluder.mode = 4;
              deltaMaxTileX = -deltaMaxTileX;
            }
            occluder.minDeltaX = (occluder.minX - World.cx << 8) / deltaMaxTileX | 0;
            occluder.maxDeltaX = (occluder.maxX - World.cx << 8) / deltaMaxTileX | 0;
            occluder.minDeltaY = (occluder.minY - World.cy << 8) / deltaMaxTileX | 0;
            occluder.maxDeltaY = (occluder.maxY - World.cy << 8) / deltaMaxTileX | 0;
            World.activeOccluders[World.activeOccluderCount++] = occluder;
          }
        }
      } else if (occluder.type === 4) {
        deltaMaxY = occluder.minY - World.cy;
        if (deltaMaxY > 128) {
          deltaMinTileZ = occluder.minTileZ + 25 - World.gz;
          if (deltaMinTileZ < 0) {
            deltaMinTileZ = 0;
          }
          deltaMaxTileZ = occluder.maxTileZ + 25 - World.gz;
          if (deltaMaxTileZ > 50) {
            deltaMaxTileZ = 50;
          }
          if (deltaMinTileZ <= deltaMaxTileZ) {
            let deltaMinTileX = occluder.minTileX + 25 - World.gx;
            if (deltaMinTileX < 0) {
              deltaMinTileX = 0;
            }
            deltaMaxTileX = occluder.maxTileX + 25 - World.gx;
            if (deltaMaxTileX > 50) {
              deltaMaxTileX = 50;
            }
            let ok = false;
            find_visible_tile:
              for (let x = deltaMinTileX;x <= deltaMaxTileX; x++) {
                for (let z = deltaMinTileZ;z <= deltaMaxTileZ; z++) {
                  if (World.visibilityMap && World.visibilityMap[x][z]) {
                    ok = true;
                    break find_visible_tile;
                  }
                }
              }
            if (ok) {
              occluder.mode = 5;
              occluder.minDeltaX = (occluder.minX - World.cx << 8) / deltaMaxY | 0;
              occluder.maxDeltaX = (occluder.maxX - World.cx << 8) / deltaMaxY | 0;
              occluder.minDeltaZ = (occluder.minZ - World.cz << 8) / deltaMaxY | 0;
              occluder.maxDeltaZ = (occluder.maxZ - World.cz << 8) / deltaMaxY | 0;
              World.activeOccluders[World.activeOccluderCount++] = occluder;
            }
          }
        }
      }
    }
  }
  fill(next, checkAdjacent, loopCycle) {
    World.fillQueue.push(next);
    while (true) {
      let tile;
      do {
        tile = World.fillQueue.popFront();
        if (!tile) {
          return;
        }
      } while (!tile.drawBack);
      const tileX = tile.x;
      const tileZ = tile.z;
      const level = tile.level;
      const originalLevel = tile.originalLevel;
      const tiles = this.levelTiles[level];
      if (tile.drawFront) {
        if (checkAdjacent) {
          if (level > 0) {
            const above = this.levelTiles[level - 1][tileX][tileZ];
            if (above && above.drawBack) {
              continue;
            }
          }
          if (tileX <= World.gx && tileX > World.minX) {
            const adjacent = tiles[tileX - 1][tileZ];
            if (adjacent && adjacent.drawBack && (adjacent.drawFront || (tile.spriteSpans & 1) === 0)) {
              continue;
            }
          }
          if (tileX >= World.gx && tileX < World.maxX - 1) {
            const adjacent = tiles[tileX + 1][tileZ];
            if (adjacent && adjacent.drawBack && (adjacent.drawFront || (tile.spriteSpans & 4) === 0)) {
              continue;
            }
          }
          if (tileZ <= World.gz && tileZ > World.minZ) {
            const adjacent = tiles[tileX][tileZ - 1];
            if (adjacent && adjacent.drawBack && (adjacent.drawFront || (tile.spriteSpans & 8) === 0)) {
              continue;
            }
          }
          if (tileZ >= World.gz && tileZ < World.maxZ - 1) {
            const adjacent = tiles[tileX][tileZ + 1];
            if (adjacent && adjacent.drawBack && (adjacent.drawFront || (tile.spriteSpans & 2) === 0)) {
              continue;
            }
          }
        } else {
          checkAdjacent = true;
        }
        tile.drawFront = false;
        if (tile.linkedSquare) {
          const linkedSquare = tile.linkedSquare;
          if (!linkedSquare.quickGround) {
            if (linkedSquare.ground && !this.groundOccluded(0, tileX, tileZ)) {
              this.renderGround(tileX, tileZ, linkedSquare.ground, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY);
            }
          } else if (!this.groundOccluded(0, tileX, tileZ)) {
            this.renderQuickGround(linkedSquare.quickGround, 0, tileX, tileZ, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY);
          }
          const wall2 = linkedSquare.wall;
          if (wall2) {
            wall2.model1?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall2.x - World.cx, wall2.y - World.cy, wall2.z - World.cz, wall2.typecode);
          }
          for (let i = 0;i < linkedSquare.spriteCount; i++) {
            const sprite = linkedSquare.sprites[i];
            if (sprite) {
              sprite.model?.worldRender(loopCycle, sprite.yaw, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, sprite.x - World.cx, sprite.y - World.cy, sprite.z - World.cz, sprite.typecode);
            }
          }
        }
        let tileDrawn = false;
        if (!tile.quickGround) {
          if (tile.ground && !this.groundOccluded(originalLevel, tileX, tileZ)) {
            tileDrawn = true;
            this.renderGround(tileX, tileZ, tile.ground, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY);
          }
        } else if (!this.groundOccluded(originalLevel, tileX, tileZ)) {
          tileDrawn = true;
          this.renderQuickGround(tile.quickGround, originalLevel, tileX, tileZ, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY);
        }
        let direction = 0;
        let frontWallTypes = 0;
        const wall = tile.wall;
        const decor = tile.decor;
        if (wall || decor) {
          if (World.gx === tileX) {
            direction += 1;
          } else if (World.gx < tileX) {
            direction += 2;
          }
          if (World.gz === tileZ) {
            direction += 3;
          } else if (World.gz > tileZ) {
            direction += 6;
          }
          frontWallTypes = PRETAB[direction];
          tile.backWallTypes = POSTTAB[direction];
        }
        if (wall) {
          if ((wall.angle1 & MIDTAB[direction]) === 0) {
            tile.cornerSides = 0;
          } else if (wall.angle1 === 16) {
            tile.cornerSides = 3;
            tile.sidesBeforeCorner = MIDDEP_16[direction];
            tile.sidesAfterCorner = 3 - tile.sidesBeforeCorner;
          } else if (wall.angle1 === 32) {
            tile.cornerSides = 6;
            tile.sidesBeforeCorner = MIDDEP_32[direction];
            tile.sidesAfterCorner = 6 - tile.sidesBeforeCorner;
          } else if (wall.angle1 === 64) {
            tile.cornerSides = 12;
            tile.sidesBeforeCorner = MIDDEP_64[direction];
            tile.sidesAfterCorner = 12 - tile.sidesBeforeCorner;
          } else {
            tile.cornerSides = 9;
            tile.sidesBeforeCorner = MIDDEP_128[direction];
            tile.sidesAfterCorner = 9 - tile.sidesBeforeCorner;
          }
          if ((wall.angle1 & frontWallTypes) !== 0 && !this.wallOccluded(originalLevel, tileX, tileZ, wall.angle1)) {
            wall.model1?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
          }
          if ((wall.angle2 & frontWallTypes) !== 0 && !this.wallOccluded(originalLevel, tileX, tileZ, wall.angle2)) {
            wall.model2?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
          }
        }
        if (decor && !this.spriteOccluded(originalLevel, tileX, tileZ, decor.model.minY)) {
          if ((decor.wshape & frontWallTypes) !== 0) {
            decor.model.worldRender(loopCycle, decor.angle, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, decor.x - World.cx, decor.y - World.cy, decor.z - World.cz, decor.typecode);
          } else if ((decor.wshape & 768) !== 0) {
            const x = decor.x - World.cx;
            const y = decor.y - World.cy;
            const z = decor.z - World.cz;
            const angle = decor.angle;
            let nearestX;
            if (angle === 1 /* NORTH */ || angle === 2 /* EAST */) {
              nearestX = -x;
            } else {
              nearestX = x;
            }
            let nearestZ;
            if (angle === 2 /* EAST */ || angle === 3 /* SOUTH */) {
              nearestZ = -z;
            } else {
              nearestZ = z;
            }
            if ((decor.wshape & 256) !== 0 && nearestZ < nearestX) {
              const drawX = x + DECORXOF[angle];
              const drawZ = z + DECORZOF[angle];
              decor.model.worldRender(loopCycle, angle * 512 + 256, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, drawX, y, drawZ, decor.typecode);
            }
            if ((decor.wshape & 512) !== 0 && nearestZ > nearestX) {
              const drawX = x + DECORXOF2[angle];
              const drawZ = z + DECORZOF2[angle];
              decor.model.worldRender(loopCycle, angle * 512 + 1280 & 2047, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, drawX, y, drawZ, decor.typecode);
            }
          }
        }
        if (tileDrawn) {
          const groundDecor = tile.groundDecor;
          if (groundDecor) {
            groundDecor.model?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, groundDecor.x - World.cx, groundDecor.y - World.cy, groundDecor.z - World.cz, groundDecor.typecode);
          }
          const objs2 = tile.groundObject;
          if (objs2 && objs2.height === 0) {
            if (objs2.bottomObj) {
              objs2.bottomObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs2.x - World.cx, objs2.y - World.cy, objs2.z - World.cz, objs2.typecode);
            }
            if (objs2.middleObj) {
              objs2.middleObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs2.x - World.cx, objs2.y - World.cy, objs2.z - World.cz, objs2.typecode);
            }
            if (objs2.topObj) {
              objs2.topObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs2.x - World.cx, objs2.y - World.cy, objs2.z - World.cz, objs2.typecode);
            }
          }
        }
        const spans = tile.spriteSpans;
        if (spans !== 0) {
          if (tileX < World.gx && (spans & 4) !== 0) {
            const adjacent = tiles[tileX + 1][tileZ];
            if (adjacent && adjacent.drawBack) {
              World.fillQueue.push(adjacent);
            }
          }
          if (tileZ < World.gz && (spans & 2) !== 0) {
            const adjacent = tiles[tileX][tileZ + 1];
            if (adjacent && adjacent.drawBack) {
              World.fillQueue.push(adjacent);
            }
          }
          if (tileX > World.gx && (spans & 1) !== 0) {
            const adjacent = tiles[tileX - 1][tileZ];
            if (adjacent && adjacent.drawBack) {
              World.fillQueue.push(adjacent);
            }
          }
          if (tileZ > World.gz && (spans & 8) !== 0) {
            const adjacent = tiles[tileX][tileZ - 1];
            if (adjacent && adjacent.drawBack) {
              World.fillQueue.push(adjacent);
            }
          }
        }
      }
      if (tile.cornerSides !== 0) {
        let draw = true;
        for (let i = 0;i < tile.spriteCount; i++) {
          const sprite = tile.sprites[i];
          if (!sprite) {
            continue;
          }
          if (sprite.cycle !== World.cycleNo && (tile.spriteSpan[i] & tile.cornerSides) === tile.sidesBeforeCorner) {
            draw = false;
            break;
          }
        }
        if (draw) {
          const wall = tile.wall;
          if (wall && !this.wallOccluded(originalLevel, tileX, tileZ, wall.angle1)) {
            wall.model1?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
          }
          tile.cornerSides = 0;
        }
      }
      if (tile.drawSprites) {
        const spriteCount = tile.spriteCount;
        tile.drawSprites = false;
        let spriteBufferSize = 0;
        iterate_sprites:
          for (let i = 0;i < spriteCount; i++) {
            const sprite = tile.sprites[i];
            if (!sprite || sprite.cycle === World.cycleNo) {
              continue;
            }
            for (let x = sprite.minTileX;x <= sprite.maxTileX; x++) {
              for (let z = sprite.minTileZ;z <= sprite.maxTileZ; z++) {
                const other = tiles[x][z];
                if (!other) {
                  continue;
                }
                if (other.drawFront) {
                  tile.drawSprites = true;
                  continue iterate_sprites;
                }
                if (other.cornerSides === 0) {
                  continue;
                }
                let spans = 0;
                if (x > sprite.minTileX) {
                  spans += 1;
                }
                if (x < sprite.maxTileX) {
                  spans += 4;
                }
                if (z > sprite.minTileZ) {
                  spans += 8;
                }
                if (z < sprite.maxTileZ) {
                  spans += 2;
                }
                if ((spans & other.cornerSides) !== tile.sidesAfterCorner) {
                  continue;
                }
              }
            }
            World.spriteBuffer[spriteBufferSize++] = sprite;
            let minTileDistanceX = World.gx - sprite.minTileX;
            const maxTileDistanceX = sprite.maxTileX - World.gx;
            if (maxTileDistanceX > minTileDistanceX) {
              minTileDistanceX = maxTileDistanceX;
            }
            const minTileDistanceZ = World.gz - sprite.minTileZ;
            const maxTileDistanceZ = sprite.maxTileZ - World.gz;
            if (maxTileDistanceZ > minTileDistanceZ) {
              sprite.distance = minTileDistanceX + maxTileDistanceZ;
            } else {
              sprite.distance = minTileDistanceX + minTileDistanceZ;
            }
          }
        while (spriteBufferSize > 0) {
          let farthestDistance = -50;
          let farthestIndex = -1;
          for (let index = 0;index < spriteBufferSize; index++) {
            const sprite = World.spriteBuffer[index];
            if (!sprite) {
              continue;
            }
            if (sprite.distance > farthestDistance && sprite.cycle !== World.cycleNo) {
              farthestDistance = sprite.distance;
              farthestIndex = index;
            }
          }
          if (farthestIndex === -1) {
            break;
          }
          const farthest = World.spriteBuffer[farthestIndex];
          if (farthest) {
            farthest.cycle = World.cycleNo;
            if (!this.spriteOccluded2(originalLevel, farthest.minTileX, farthest.maxTileX, farthest.minTileZ, farthest.maxTileZ, farthest.model?.minY ?? 0)) {
              farthest.model?.worldRender(loopCycle, farthest.yaw, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, farthest.x - World.cx, farthest.y - World.cy, farthest.z - World.cz, farthest.typecode);
            }
            for (let x = farthest.minTileX;x <= farthest.maxTileX; x++) {
              for (let z = farthest.minTileZ;z <= farthest.maxTileZ; z++) {
                const occupied = tiles[x][z];
                if (!occupied) {
                  continue;
                }
                if (occupied.cornerSides !== 0) {
                  World.fillQueue.push(occupied);
                } else if ((x !== tileX || z !== tileZ) && occupied.drawBack) {
                  World.fillQueue.push(occupied);
                }
              }
            }
          }
        }
        if (tile.drawSprites) {
          continue;
        }
      }
      if (!tile.drawBack || tile.cornerSides !== 0) {
        continue;
      }
      if (tileX <= World.gx && tileX > World.minX) {
        const adjacent = tiles[tileX - 1][tileZ];
        if (adjacent && adjacent.drawBack) {
          continue;
        }
      }
      if (tileX >= World.gx && tileX < World.maxX - 1) {
        const adjacent = tiles[tileX + 1][tileZ];
        if (adjacent && adjacent.drawBack) {
          continue;
        }
      }
      if (tileZ <= World.gz && tileZ > World.minZ) {
        const adjacent = tiles[tileX][tileZ - 1];
        if (adjacent && adjacent.drawBack) {
          continue;
        }
      }
      if (tileZ >= World.gz && tileZ < World.maxZ - 1) {
        const adjacent = tiles[tileX][tileZ + 1];
        if (adjacent && adjacent.drawBack) {
          continue;
        }
      }
      tile.drawBack = false;
      World.fillLeft--;
      const objs = tile.groundObject;
      if (objs && objs.height !== 0) {
        if (objs.bottomObj) {
          objs.bottomObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs.x - World.cx, objs.y - World.cy - objs.height, objs.z - World.cz, objs.typecode);
        }
        if (objs.middleObj) {
          objs.middleObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs.x - World.cx, objs.y - World.cy - objs.height, objs.z - World.cz, objs.typecode);
        }
        if (objs.topObj) {
          objs.topObj.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, objs.x - World.cx, objs.y - World.cy - objs.height, objs.z - World.cz, objs.typecode);
        }
      }
      if (tile.backWallTypes !== 0) {
        const decor = tile.decor;
        if (decor && !this.spriteOccluded(originalLevel, tileX, tileZ, decor.model.minY)) {
          if ((decor.wshape & tile.backWallTypes) !== 0) {
            decor.model.worldRender(loopCycle, decor.angle, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, decor.x - World.cx, decor.y - World.cy, decor.z - World.cz, decor.typecode);
          } else if ((decor.wshape & 768) !== 0) {
            const x = decor.x - World.cx;
            const y = decor.y - World.cy;
            const z = decor.z - World.cz;
            const angle = decor.angle;
            let nearestX;
            if (angle === 1 /* NORTH */ || angle === 2 /* EAST */) {
              nearestX = -x;
            } else {
              nearestX = x;
            }
            let nearestZ;
            if (angle === 2 /* EAST */ || angle === 3 /* SOUTH */) {
              nearestZ = -z;
            } else {
              nearestZ = z;
            }
            if ((decor.wshape & 256) !== 0 && nearestZ >= nearestX) {
              const drawX = x + DECORXOF[angle];
              const drawZ = z + DECORZOF[angle];
              decor.model.worldRender(loopCycle, angle * 512 + 256, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, drawX, y, drawZ, decor.typecode);
            }
            if ((decor.wshape & 512) !== 0 && nearestZ <= nearestX) {
              const drawX = x + DECORXOF2[angle];
              const drawZ = z + DECORZOF2[angle];
              decor.model.worldRender(loopCycle, angle * 512 + 1280 & 2047, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, drawX, y, drawZ, decor.typecode);
            }
          }
        }
        const wall = tile.wall;
        if (wall) {
          if ((wall.angle2 & tile.backWallTypes) !== 0 && !this.wallOccluded(originalLevel, tileX, tileZ, wall.angle2)) {
            wall.model2?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
          }
          if ((wall.angle1 & tile.backWallTypes) !== 0 && !this.wallOccluded(originalLevel, tileX, tileZ, wall.angle1)) {
            wall.model1?.worldRender(loopCycle, 0, World.cameraSinX, World.cameraCosX, World.cameraSinY, World.cameraCosY, wall.x - World.cx, wall.y - World.cy, wall.z - World.cz, wall.typecode);
          }
        }
      }
      if (level < this.maxTileLevel - 1) {
        const above = this.levelTiles[level + 1][tileX][tileZ];
        if (above && above.drawBack) {
          World.fillQueue.push(above);
        }
      }
      if (tileX < World.gx) {
        const adjacent = tiles[tileX + 1][tileZ];
        if (adjacent && adjacent.drawBack) {
          World.fillQueue.push(adjacent);
        }
      }
      if (tileZ < World.gz) {
        const adjacent = tiles[tileX][tileZ + 1];
        if (adjacent && adjacent.drawBack) {
          World.fillQueue.push(adjacent);
        }
      }
      if (tileX > World.gx) {
        const adjacent = tiles[tileX - 1][tileZ];
        if (adjacent && adjacent.drawBack) {
          World.fillQueue.push(adjacent);
        }
      }
      if (tileZ > World.gz) {
        const adjacent = tiles[tileX][tileZ - 1];
        if (adjacent && adjacent.drawBack) {
          World.fillQueue.push(adjacent);
        }
      }
    }
  }
  renderQuickGround(ground, level, tileX, tileZ, sinEyePitch, cosEyePitch, sinEyeYaw, cosEyeYaw) {
    let x3;
    let x0 = x3 = (tileX << 7) - World.cx;
    let z1;
    let z0 = z1 = (tileZ << 7) - World.cz;
    let x2;
    let x1 = x2 = x0 + 128;
    let z3;
    let z2 = z3 = z0 + 128;
    let y0 = this.groundh[level][tileX][tileZ] - World.cy;
    let y1 = this.groundh[level][tileX + 1][tileZ] - World.cy;
    let y2 = this.groundh[level][tileX + 1][tileZ + 1] - World.cy;
    let y3 = this.groundh[level][tileX][tileZ + 1] - World.cy;
    let tmp = z0 * sinEyeYaw + x0 * cosEyeYaw >> 16;
    z0 = z0 * cosEyeYaw - x0 * sinEyeYaw >> 16;
    x0 = tmp;
    tmp = y0 * cosEyePitch - z0 * sinEyePitch >> 16;
    z0 = y0 * sinEyePitch + z0 * cosEyePitch >> 16;
    y0 = tmp;
    if (z0 < 50) {
      return;
    }
    tmp = z1 * sinEyeYaw + x1 * cosEyeYaw >> 16;
    z1 = z1 * cosEyeYaw - x1 * sinEyeYaw >> 16;
    x1 = tmp;
    tmp = y1 * cosEyePitch - z1 * sinEyePitch >> 16;
    z1 = y1 * sinEyePitch + z1 * cosEyePitch >> 16;
    y1 = tmp;
    if (z1 < 50) {
      return;
    }
    tmp = z2 * sinEyeYaw + x2 * cosEyeYaw >> 16;
    z2 = z2 * cosEyeYaw - x2 * sinEyeYaw >> 16;
    x2 = tmp;
    tmp = y2 * cosEyePitch - z2 * sinEyePitch >> 16;
    z2 = y2 * sinEyePitch + z2 * cosEyePitch >> 16;
    y2 = tmp;
    if (z2 < 50) {
      return;
    }
    tmp = z3 * sinEyeYaw + x3 * cosEyeYaw >> 16;
    z3 = z3 * cosEyeYaw - x3 * sinEyeYaw >> 16;
    x3 = tmp;
    tmp = y3 * cosEyePitch - z3 * sinEyePitch >> 16;
    z3 = y3 * sinEyePitch + z3 * cosEyePitch >> 16;
    y3 = tmp;
    if (z3 < 50) {
      return;
    }
    const px0 = Pix3D.originX + ((x0 << 9) / z0 | 0);
    const py0 = Pix3D.originY + ((y0 << 9) / z0 | 0);
    const pz0 = Pix3D.originX + ((x1 << 9) / z1 | 0);
    const px1 = Pix3D.originY + ((y1 << 9) / z1 | 0);
    const py1 = Pix3D.originX + ((x2 << 9) / z2 | 0);
    const pz1 = Pix3D.originY + ((y2 << 9) / z2 | 0);
    const px3 = Pix3D.originX + ((x3 << 9) / z3 | 0);
    const py3 = Pix3D.originY + ((y3 << 9) / z3 | 0);
    Pix3D.trans = 0;
    if ((py1 - px3) * (px1 - py3) - (pz1 - py3) * (pz0 - px3) > 0) {
      Pix3D.hclip = py1 < 0 || px3 < 0 || pz0 < 0 || py1 > Pix2D.sizeX || px3 > Pix2D.sizeX || pz0 > Pix2D.sizeX;
      if (World.click && this.insideTriangle(World.clickX, World.clickY, pz1, py3, px1, py1, px3, pz0)) {
        World.groundX = tileX;
        World.groundZ = tileZ;
      }
      if (ground.texture !== -1) {
        if (!World.lowMem) {
          if (ground.flat) {
            Pix3D.textureTriangle(py1, px3, pz0, pz1, py3, px1, ground.colourNE, ground.colourNW, ground.colourSE, x0, y0, z0, x1, x3, y1, y3, z1, z3, ground.texture);
          } else {
            Pix3D.textureTriangle(py1, px3, pz0, pz1, py3, px1, ground.colourNE, ground.colourNW, ground.colourSE, x2, y2, z2, x3, x1, y3, y1, z3, z1, ground.texture);
          }
        } else {
          const textureAverage = TEXTURE_AVERAGE[ground.texture];
          Pix3D.gouraudTriangle(py1, px3, pz0, pz1, py3, px1, this.getTable(textureAverage, ground.colourNE), this.getTable(textureAverage, ground.colourNW), this.getTable(textureAverage, ground.colourSE));
        }
      } else {
        if (ground.colourNE !== 12345678) {
          Pix3D.gouraudTriangle(py1, px3, pz0, pz1, py3, px1, ground.colourNE, ground.colourNW, ground.colourSE);
        }
      }
    }
    if ((px0 - pz0) * (py3 - px1) - (py0 - px1) * (px3 - pz0) > 0) {
      Pix3D.hclip = px0 < 0 || pz0 < 0 || px3 < 0 || px0 > Pix2D.sizeX || pz0 > Pix2D.sizeX || px3 > Pix2D.sizeX;
      if (World.click && this.insideTriangle(World.clickX, World.clickY, py0, px1, py3, px0, pz0, px3)) {
        World.groundX = tileX;
        World.groundZ = tileZ;
      }
      if (ground.texture !== -1) {
        if (!World.lowMem) {
          Pix3D.textureTriangle(px0, pz0, px3, py0, px1, py3, ground.colourSW, ground.colourSE, ground.colourNW, x0, y0, z0, x1, x3, y1, y3, z1, z3, ground.texture);
        } else {
          const textureAverage = TEXTURE_AVERAGE[ground.texture];
          Pix3D.gouraudTriangle(px0, pz0, px3, py0, px1, py3, this.getTable(textureAverage, ground.colourSW), this.getTable(textureAverage, ground.colourSE), this.getTable(textureAverage, ground.colourNW));
        }
      } else {
        if (ground.colourSW !== 12345678) {
          Pix3D.gouraudTriangle(px0, pz0, px3, py0, px1, py3, ground.colourSW, ground.colourSE, ground.colourNW);
        }
      }
    }
  }
  renderGround(tileX, tileZ, ground, sinEyePitch, cosEyePitch, sinEyeYaw, cosEyeYaw) {
    let vertexCount = ground.vertexX.length;
    for (let i = 0;i < vertexCount; i++) {
      let x = ground.vertexX[i] - World.cx;
      let y = ground.vertexY[i] - World.cy;
      let z = ground.vertexZ[i] - World.cz;
      let tmp = z * sinEyeYaw + x * cosEyeYaw >> 16;
      z = z * cosEyeYaw - x * sinEyeYaw >> 16;
      x = tmp;
      tmp = y * cosEyePitch - z * sinEyePitch >> 16;
      z = y * sinEyePitch + z * cosEyePitch >> 16;
      y = tmp;
      if (z < 50) {
        return;
      }
      if (ground.faceTexture) {
        Ground.drawTextureVertexX[i] = x;
        Ground.drawTextureVertexY[i] = y;
        Ground.drawTextureVertexZ[i] = z;
      }
      Ground.drawVertexX[i] = Pix3D.originX + ((x << 9) / z | 0);
      Ground.drawVertexY[i] = Pix3D.originY + ((y << 9) / z | 0);
    }
    Pix3D.trans = 0;
    vertexCount = ground.faceVertexA.length;
    for (let v = 0;v < vertexCount; v++) {
      const a = ground.faceVertexA[v];
      const b = ground.faceVertexB[v];
      const c = ground.faceVertexC[v];
      const x0 = Ground.drawVertexX[a];
      const x1 = Ground.drawVertexX[b];
      const x2 = Ground.drawVertexX[c];
      const y0 = Ground.drawVertexY[a];
      const y1 = Ground.drawVertexY[b];
      const y2 = Ground.drawVertexY[c];
      if ((x0 - x1) * (y2 - y1) - (y0 - y1) * (x2 - x1) > 0) {
        Pix3D.hclip = x0 < 0 || x1 < 0 || x2 < 0 || x0 > Pix2D.sizeX || x1 > Pix2D.sizeX || x2 > Pix2D.sizeX;
        if (World.click && this.insideTriangle(World.clickX, World.clickY, y0, y1, y2, x0, x1, x2)) {
          World.groundX = tileX;
          World.groundZ = tileZ;
        }
        if (ground.faceTexture && ground.faceTexture[v] !== -1) {
          if (!World.lowMem) {
            if (ground.flat) {
              Pix3D.textureTriangle(x0, x1, x2, y0, y1, y2, ground.faceColourA[v], ground.faceColourB[v], ground.faceColourC[v], Ground.drawTextureVertexX[0], Ground.drawTextureVertexY[0], Ground.drawTextureVertexZ[0], Ground.drawTextureVertexX[1], Ground.drawTextureVertexX[3], Ground.drawTextureVertexY[1], Ground.drawTextureVertexY[3], Ground.drawTextureVertexZ[1], Ground.drawTextureVertexZ[3], ground.faceTexture[v]);
            } else {
              Pix3D.textureTriangle(x0, x1, x2, y0, y1, y2, ground.faceColourA[v], ground.faceColourB[v], ground.faceColourC[v], Ground.drawTextureVertexX[a], Ground.drawTextureVertexY[a], Ground.drawTextureVertexZ[a], Ground.drawTextureVertexX[b], Ground.drawTextureVertexX[c], Ground.drawTextureVertexY[b], Ground.drawTextureVertexY[c], Ground.drawTextureVertexZ[b], Ground.drawTextureVertexZ[c], ground.faceTexture[v]);
            }
          } else {
            const textureAverage = TEXTURE_AVERAGE[ground.faceTexture[v]];
            Pix3D.gouraudTriangle(x0, x1, x2, y0, y1, y2, this.getTable(textureAverage, ground.faceColourA[v]), this.getTable(textureAverage, ground.faceColourB[v]), this.getTable(textureAverage, ground.faceColourC[v]));
          }
        } else {
          if (ground.faceColourA[v] !== 12345678) {
            Pix3D.gouraudTriangle(x0, x1, x2, y0, y1, y2, ground.faceColourA[v], ground.faceColourB[v], ground.faceColourC[v]);
          }
        }
      }
    }
  }
  groundOccluded(level, x, z) {
    const cycle = this.occlusionCycle[level][x][z];
    if (cycle === -World.cycleNo) {
      return false;
    } else if (cycle === World.cycleNo) {
      return true;
    } else {
      const sx = x << 7;
      const sz = z << 7;
      if (this.occluded(sx + 1, this.groundh[level][x][z], sz + 1) && this.occluded(sx + 128 - 1, this.groundh[level][x + 1][z], sz + 1) && this.occluded(sx + 128 - 1, this.groundh[level][x + 1][z + 1], sz + 128 - 1) && this.occluded(sx + 1, this.groundh[level][x][z + 1], sz + 128 - 1)) {
        this.occlusionCycle[level][x][z] = World.cycleNo;
        return true;
      } else {
        this.occlusionCycle[level][x][z] = -World.cycleNo;
        return false;
      }
    }
  }
  wallOccluded(level, x, z, type) {
    if (!this.groundOccluded(level, x, z)) {
      return false;
    }
    const sceneX = x << 7;
    const sceneZ = z << 7;
    const sceneY = this.groundh[level][x][z] - 1;
    const y0 = sceneY - 120;
    const y1 = sceneY - 230;
    const y2 = sceneY - 238;
    if (type < 16) {
      if (type === 1) {
        if (sceneX > World.cx) {
          if (!this.occluded(sceneX, sceneY, sceneZ)) {
            return false;
          }
          if (!this.occluded(sceneX, sceneY, sceneZ + 128)) {
            return false;
          }
        }
        if (level > 0) {
          if (!this.occluded(sceneX, y0, sceneZ)) {
            return false;
          }
          if (!this.occluded(sceneX, y0, sceneZ + 128)) {
            return false;
          }
        }
        if (!this.occluded(sceneX, y1, sceneZ)) {
          return false;
        }
        return this.occluded(sceneX, y1, sceneZ + 128);
      }
      if (type === 2) {
        if (sceneZ < World.cz) {
          if (!this.occluded(sceneX, sceneY, sceneZ + 128)) {
            return false;
          }
          if (!this.occluded(sceneX + 128, sceneY, sceneZ + 128)) {
            return false;
          }
        }
        if (level > 0) {
          if (!this.occluded(sceneX, y0, sceneZ + 128)) {
            return false;
          }
          if (!this.occluded(sceneX + 128, y0, sceneZ + 128)) {
            return false;
          }
        }
        if (!this.occluded(sceneX, y1, sceneZ + 128)) {
          return false;
        }
        return this.occluded(sceneX + 128, y1, sceneZ + 128);
      }
      if (type === 4) {
        if (sceneX < World.cx) {
          if (!this.occluded(sceneX + 128, sceneY, sceneZ)) {
            return false;
          }
          if (!this.occluded(sceneX + 128, sceneY, sceneZ + 128)) {
            return false;
          }
        }
        if (level > 0) {
          if (!this.occluded(sceneX + 128, y0, sceneZ)) {
            return false;
          }
          if (!this.occluded(sceneX + 128, y0, sceneZ + 128)) {
            return false;
          }
        }
        if (!this.occluded(sceneX + 128, y1, sceneZ)) {
          return false;
        }
        return this.occluded(sceneX + 128, y1, sceneZ + 128);
      }
      if (type === 8) {
        if (sceneZ > World.cz) {
          if (!this.occluded(sceneX, sceneY, sceneZ)) {
            return false;
          }
          if (!this.occluded(sceneX + 128, sceneY, sceneZ)) {
            return false;
          }
        }
        if (level > 0) {
          if (!this.occluded(sceneX, y0, sceneZ)) {
            return false;
          }
          if (!this.occluded(sceneX + 128, y0, sceneZ)) {
            return false;
          }
        }
        if (!this.occluded(sceneX, y1, sceneZ)) {
          return false;
        }
        return this.occluded(sceneX + 128, y1, sceneZ);
      }
    }
    if (!this.occluded(sceneX + 64, y2, sceneZ + 64)) {
      return false;
    } else if (type === 16) {
      return this.occluded(sceneX, y1, sceneZ + 128);
    } else if (type === 32) {
      return this.occluded(sceneX + 128, y1, sceneZ + 128);
    } else if (type === 64) {
      return this.occluded(sceneX + 128, y1, sceneZ);
    } else if (type === 128) {
      return this.occluded(sceneX, y1, sceneZ);
    }
    console.warn("Warning unsupported wall type!");
    return true;
  }
  spriteOccluded(level, tileX, tileZ, y) {
    if (this.groundOccluded(level, tileX, tileZ)) {
      const x = tileX << 7;
      const z = tileZ << 7;
      return this.occluded(x + 1, this.groundh[level][tileX][tileZ] - y, z + 1) && this.occluded(x + 128 - 1, this.groundh[level][tileX + 1][tileZ] - y, z + 1) && this.occluded(x + 128 - 1, this.groundh[level][tileX + 1][tileZ + 1] - y, z + 128 - 1) && this.occluded(x + 1, this.groundh[level][tileX][tileZ + 1] - y, z + 128 - 1);
    }
    return false;
  }
  spriteOccluded2(level, minX, maxX, minZ, maxZ, y) {
    let x;
    let z;
    if (minX !== maxX || minZ !== maxZ) {
      for (x = minX;x <= maxX; x++) {
        for (z = minZ;z <= maxZ; z++) {
          if (this.occlusionCycle[level][x][z] === -World.cycleNo) {
            return false;
          }
        }
      }
      z = (minX << 7) + 1;
      const z0 = (minZ << 7) + 2;
      const y0 = this.groundh[level][minX][minZ] - y;
      if (!this.occluded(z, y0, z0)) {
        return false;
      }
      const x1 = (maxX << 7) - 1;
      if (!this.occluded(x1, y0, z0)) {
        return false;
      }
      const z1 = (maxZ << 7) - 1;
      if (!this.occluded(z, y0, z1)) {
        return false;
      } else if (this.occluded(x1, y0, z1)) {
        return true;
      } else {
        return false;
      }
    } else if (this.groundOccluded(level, minX, minZ)) {
      x = minX << 7;
      z = minZ << 7;
      return this.occluded(x + 1, this.groundh[level][minX][minZ] - y, z + 1) && this.occluded(x + 128 - 1, this.groundh[level][minX + 1][minZ] - y, z + 1) && this.occluded(x + 128 - 1, this.groundh[level][minX + 1][minZ + 1] - y, z + 128 - 1) && this.occluded(x + 1, this.groundh[level][minX][minZ + 1] - y, z + 128 - 1);
    }
    return false;
  }
  occluded(x, y, z) {
    for (let i = 0;i < World.activeOccluderCount; i++) {
      const occluder = World.activeOccluders[i];
      if (!occluder) {
        continue;
      }
      if (occluder.mode === 1) {
        const dx = occluder.minX - x;
        if (dx > 0) {
          const minZ = occluder.minZ + (occluder.minDeltaZ * dx >> 8);
          const maxZ = occluder.maxZ + (occluder.maxDeltaZ * dx >> 8);
          const minY = occluder.minY + (occluder.minDeltaY * dx >> 8);
          const maxY = occluder.maxY + (occluder.maxDeltaY * dx >> 8);
          if (z >= minZ && z <= maxZ && y >= minY && y <= maxY) {
            return true;
          }
        }
      } else if (occluder.mode === 2) {
        const dx = x - occluder.minX;
        if (dx > 0) {
          const minZ = occluder.minZ + (occluder.minDeltaZ * dx >> 8);
          const maxZ = occluder.maxZ + (occluder.maxDeltaZ * dx >> 8);
          const minY = occluder.minY + (occluder.minDeltaY * dx >> 8);
          const maxY = occluder.maxY + (occluder.maxDeltaY * dx >> 8);
          if (z >= minZ && z <= maxZ && y >= minY && y <= maxY) {
            return true;
          }
        }
      } else if (occluder.mode === 3) {
        const dz = occluder.minZ - z;
        if (dz > 0) {
          const minX = occluder.minX + (occluder.minDeltaX * dz >> 8);
          const maxX = occluder.maxX + (occluder.maxDeltaX * dz >> 8);
          const minY = occluder.minY + (occluder.minDeltaY * dz >> 8);
          const maxY = occluder.maxY + (occluder.maxDeltaY * dz >> 8);
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            return true;
          }
        }
      } else if (occluder.mode === 4) {
        const dz = z - occluder.minZ;
        if (dz > 0) {
          const minX = occluder.minX + (occluder.minDeltaX * dz >> 8);
          const maxX = occluder.maxX + (occluder.maxDeltaX * dz >> 8);
          const minY = occluder.minY + (occluder.minDeltaY * dz >> 8);
          const maxY = occluder.maxY + (occluder.maxDeltaY * dz >> 8);
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            return true;
          }
        }
      } else if (occluder.mode === 5) {
        const dy = y - occluder.minY;
        if (dy > 0) {
          const minX = occluder.minX + (occluder.minDeltaX * dy >> 8);
          const maxX = occluder.maxX + (occluder.maxDeltaX * dy >> 8);
          const minZ = occluder.minZ + (occluder.minDeltaZ * dy >> 8);
          const maxZ = occluder.maxZ + (occluder.maxDeltaZ * dy >> 8);
          if (x >= minX && x <= maxX && z >= minZ && z <= maxZ) {
            return true;
          }
        }
      }
    }
    return false;
  }
  insideTriangle(x, y, y0, y1, y2, x0, x1, x2) {
    if (y < y0 && y < y1 && y < y2) {
      return false;
    } else if (y > y0 && y > y1 && y > y2) {
      return false;
    } else if (x < x0 && x < x1 && x < x2) {
      return false;
    } else if (x > x0 && x > x1 && x > x2) {
      return false;
    }
    const crossProduct_01 = (y - y0) * (x1 - x0) - (x - x0) * (y1 - y0);
    const crossProduct_20 = (y - y2) * (x0 - x2) - (x - x2) * (y0 - y2);
    const crossProduct_12 = (y - y1) * (x2 - x1) - (x - x1) * (y2 - y1);
    return crossProduct_01 * crossProduct_12 > 0 && crossProduct_12 * crossProduct_20 > 0;
  }
  getTable(hsl, lightness) {
    const invLightness = 127 - lightness;
    lightness = invLightness * (hsl & 127) / 160 | 0;
    if (lightness < 2) {
      lightness = 2;
    } else if (lightness > 126) {
      lightness = 126;
    }
    return (hsl & 65408) + lightness;
  }
}

// src/dash3d/ClientBuild.ts
class ClientBuild {
  static WSHAPE0 = Int8Array.of(1, 2, 4, 8);
  static WSHAPE1 = Uint8Array.of(16, 32, 64, 128);
  static DECORXOF = Int8Array.of(1, 0, -1, 0);
  static DECORZOF = Int8Array.of(0, -1, 0, 1);
  static hueOff = (Math.random() * 17 | 0) - 8;
  static ligOff = (Math.random() * 33 | 0) - 16;
  static lowMem = true;
  static minusedlevel = 0;
  maxTileX;
  maxTileZ;
  groundh;
  mapl;
  floort1;
  floort2;
  floors;
  floorr;
  shadow;
  lightmap;
  huetot;
  sattot;
  ligtot;
  comtot;
  tot;
  mapo;
  constructor(maxTileX, maxTileZ, groundh, mapl) {
    this.maxTileX = maxTileX;
    this.maxTileZ = maxTileZ;
    this.groundh = groundh;
    this.mapl = mapl;
    this.floort1 = new Uint8Array3d(4 /* LEVELS */, maxTileX, maxTileZ);
    this.floort2 = new Uint8Array3d(4 /* LEVELS */, maxTileX, maxTileZ);
    this.floors = new Uint8Array3d(4 /* LEVELS */, maxTileX, maxTileZ);
    this.floorr = new Uint8Array3d(4 /* LEVELS */, maxTileX, maxTileZ);
    this.mapo = new Int32Array3d(4 /* LEVELS */, maxTileX + 1, maxTileZ + 1);
    this.shadow = new Uint8Array3d(4 /* LEVELS */, maxTileX + 1, maxTileZ + 1);
    this.lightmap = new Int32Array2d(maxTileX + 1, maxTileZ + 1);
    this.huetot = new Int32Array(maxTileZ);
    this.sattot = new Int32Array(maxTileZ);
    this.ligtot = new Int32Array(maxTileZ);
    this.comtot = new Int32Array(maxTileZ);
    this.tot = new Int32Array(maxTileZ);
  }
  finishBuild(world, collision) {
    for (let level = 0;level < 4 /* LEVELS */; level++) {
      for (let x = 0;x < 104 /* SIZE */; x++) {
        for (let z = 0;z < 104 /* SIZE */; z++) {
          if ((this.mapl[level][x][z] & 1 /* Block */) !== 0) {
            let trueLevel = level;
            if ((this.mapl[1][x][z] & 2 /* LinkBelow */) !== 0) {
              trueLevel--;
            }
            if (trueLevel >= 0) {
              collision[trueLevel]?.blockGround(x, z);
            }
          }
        }
      }
    }
    ClientBuild.hueOff += (Math.random() * 5 | 0) - 2;
    if (ClientBuild.hueOff < -8) {
      ClientBuild.hueOff = -8;
    } else if (ClientBuild.hueOff > 8) {
      ClientBuild.hueOff = 8;
    }
    ClientBuild.ligOff += (Math.random() * 5 | 0) - 2;
    if (ClientBuild.ligOff < -16) {
      ClientBuild.ligOff = -16;
    } else if (ClientBuild.ligOff > 16) {
      ClientBuild.ligOff = 16;
    }
    for (let level = 0;level < 4 /* LEVELS */; level++) {
      const shademap = this.shadow[level];
      const lightAmbient = 96;
      const lightAttenuation = 768;
      const lightX = -50;
      const lightY = -10;
      const lightZ = -50;
      const lightMag = Math.sqrt(lightX * lightX + lightY * lightY + lightZ * lightZ) | 0;
      const lightMagnitude = lightAttenuation * lightMag >> 8;
      for (let z = 1;z < this.maxTileZ - 1; z++) {
        for (let x = 1;x < this.maxTileX - 1; x++) {
          const dx = this.groundh[level][x + 1][z] - this.groundh[level][x - 1][z];
          const dz = this.groundh[level][x][z + 1] - this.groundh[level][x][z - 1];
          const len = Math.sqrt(dx * dx + 65536 + dz * dz) | 0;
          const normalX = (dx << 8) / len | 0;
          const normalY = 65536 / len | 0;
          const normalZ = (dz << 8) / len | 0;
          const light = lightAmbient + ((lightX * normalX + lightY * normalY + lightZ * normalZ) / lightMagnitude | 0);
          const shade = (shademap[x - 1][z] >> 2) + (shademap[x + 1][z] >> 3) + (shademap[x][z - 1] >> 2) + (shademap[x][z + 1] >> 3) + (shademap[x][z] >> 1);
          this.lightmap[x][z] = light - shade;
        }
      }
      for (let z = 0;z < this.maxTileZ; z++) {
        this.huetot[z] = 0;
        this.sattot[z] = 0;
        this.ligtot[z] = 0;
        this.comtot[z] = 0;
        this.tot[z] = 0;
      }
      for (let x0 = -5;x0 < this.maxTileX + 5; x0++) {
        for (let z0 = 0;z0 < this.maxTileZ; z0++) {
          const x1 = x0 + 5;
          if (x1 >= 0 && x1 < this.maxTileX) {
            const t1 = this.floort1[level][x1][z0] & 255;
            if (t1 > 0) {
              const flo = FloType.list[t1 - 1];
              this.huetot[z0] += flo.underlayHue;
              this.sattot[z0] += flo.saturation;
              this.ligtot[z0] += flo.lightness;
              this.comtot[z0] += flo.chroma;
              this.tot[z0]++;
            }
          }
          const x2 = x0 - 5;
          if (x2 >= 0 && x2 < this.maxTileX) {
            const t1 = this.floort1[level][x2][z0] & 255;
            if (t1 > 0) {
              const flo = FloType.list[t1 - 1];
              this.huetot[z0] -= flo.underlayHue;
              this.sattot[z0] -= flo.saturation;
              this.ligtot[z0] -= flo.lightness;
              this.comtot[z0] -= flo.chroma;
              this.tot[z0]--;
            }
          }
        }
        if (x0 >= 1 && x0 < this.maxTileX - 1) {
          let blendHue = 0;
          let blendSat = 0;
          let blendLig = 0;
          let blendCom = 0;
          let blendTot = 0;
          for (let z0 = -5;z0 < this.maxTileZ + 5; z0++) {
            const dz1 = z0 + 5;
            if (dz1 >= 0 && dz1 < this.maxTileZ) {
              blendHue += this.huetot[dz1];
              blendSat += this.sattot[dz1];
              blendLig += this.ligtot[dz1];
              blendCom += this.comtot[dz1];
              blendTot += this.tot[dz1];
            }
            const dz2 = z0 - 5;
            if (dz2 >= 0 && dz2 < this.maxTileZ) {
              blendHue -= this.huetot[dz2];
              blendSat -= this.sattot[dz2];
              blendLig -= this.ligtot[dz2];
              blendCom -= this.comtot[dz2];
              blendTot -= this.tot[dz2];
            }
            if (z0 >= 1 && z0 < this.maxTileZ - 1 && (!ClientBuild.lowMem || (this.mapl[level][x0][z0] & 16 /* ForceHighDetail */) === 0 && this.getVisBelowLevel(level, x0, z0) === ClientBuild.minusedlevel)) {
              const t1 = this.floort1[level][x0][z0] & 255;
              const t2 = this.floort2[level][x0][z0] & 255;
              if (t1 > 0 || t2 > 0) {
                const heightSW = this.groundh[level][x0][z0];
                const heightSE = this.groundh[level][x0 + 1][z0];
                const heightNE = this.groundh[level][x0 + 1][z0 + 1];
                const heightNW = this.groundh[level][x0][z0 + 1];
                const lightSW = this.lightmap[x0][z0];
                const lightSE = this.lightmap[x0 + 1][z0];
                const lightNE = this.lightmap[x0 + 1][z0 + 1];
                const lightNW = this.lightmap[x0][z0 + 1];
                let t1Colour = -1;
                let t1RandColour = -1;
                if (t1 > 0) {
                  const hue = blendHue * 256 / blendCom | 0;
                  const sat = blendSat / blendTot | 0;
                  let lig = blendLig / blendTot | 0;
                  t1Colour = ClientBuild.getTable(hue, sat, lig);
                  const randomHue = hue + ClientBuild.hueOff & 255;
                  let randomLig = lig + ClientBuild.ligOff;
                  if (randomLig < 0) {
                    randomLig = 0;
                  } else if (randomLig > 255) {
                    randomLig = 255;
                  }
                  t1RandColour = ClientBuild.getTable(randomHue, sat, randomLig);
                }
                if (level > 0) {
                  let occludes = t1 !== 0 || this.floors[level][x0][z0] === 0 /* PLAIN */;
                  if (t2 > 0 && !FloType.list[t2 - 1].occlude) {
                    occludes = false;
                  }
                  if (occludes && heightSW === heightSE && heightSW === heightNE && heightSW === heightNW) {
                    this.mapo[level][x0][z0] |= 2340;
                  }
                }
                let underlay = 0;
                if (t1Colour !== -1) {
                  underlay = Pix3D.colourTable[ClientBuild.getUCol(t1RandColour, 96)];
                }
                if (t2 === 0) {
                  world?.setGround(level, x0, z0, 0 /* PLAIN */, 0 /* WEST */, -1, heightSW, heightSE, heightNE, heightNW, ClientBuild.getUCol(t1Colour, lightSW), ClientBuild.getUCol(t1Colour, lightSE), ClientBuild.getUCol(t1Colour, lightNE), ClientBuild.getUCol(t1Colour, lightNW), 0 /* BLACK */, 0 /* BLACK */, 0 /* BLACK */, 0 /* BLACK */, underlay, 0 /* BLACK */);
                } else {
                  const shape = this.floors[level][x0][z0] + 1;
                  const rotation = this.floorr[level][x0][z0];
                  const flo = FloType.list[t2 - 1];
                  let texture = flo.texture;
                  let t2Colour;
                  let overlay;
                  if (texture >= 0) {
                    overlay = Pix3D.getAverageTextureRgb(texture);
                    t2Colour = -1;
                  } else if (flo.rgb === 16711935 /* MAGENTA */) {
                    overlay = 0;
                    t2Colour = -2;
                    texture = -1;
                  } else {
                    t2Colour = ClientBuild.getTable(flo.hue, flo.saturation, flo.lightness);
                    overlay = Pix3D.colourTable[ClientBuild.getOCol(flo.overlayHsl, 96)];
                  }
                  world?.setGround(level, x0, z0, shape, rotation, texture, heightSW, heightSE, heightNE, heightNW, ClientBuild.getUCol(t1Colour, lightSW), ClientBuild.getUCol(t1Colour, lightSE), ClientBuild.getUCol(t1Colour, lightNE), ClientBuild.getUCol(t1Colour, lightNW), ClientBuild.getOCol(t2Colour, lightSW), ClientBuild.getOCol(t2Colour, lightSE), ClientBuild.getOCol(t2Colour, lightNE), ClientBuild.getOCol(t2Colour, lightNW), underlay, overlay);
                }
              }
            }
          }
        }
      }
      for (let stz = 1;stz < this.maxTileZ - 1; stz++) {
        for (let stx = 1;stx < this.maxTileX - 1; stx++) {
          world?.setLayer(level, stx, stz, this.getVisBelowLevel(level, stx, stz));
        }
      }
    }
    world?.shareLight(64, 768, -50, -10, -50);
    for (let x = 0;x < this.maxTileX; x++) {
      for (let z = 0;z < this.maxTileZ; z++) {
        if ((this.mapl[1][x][z] & 2 /* LinkBelow */) !== 0) {
          world?.pushDown(x, z);
        }
      }
    }
    let wall0 = 1;
    let wall1 = 2;
    let floor = 4;
    for (let topLevel = 0;topLevel < 4 /* LEVELS */; topLevel++) {
      if (topLevel > 0) {
        wall0 <<= 3;
        wall1 <<= 3;
        floor <<= 3;
      }
      for (let level = 0;level <= topLevel; level++) {
        for (let tileZ = 0;tileZ <= this.maxTileZ; tileZ++) {
          for (let tileX = 0;tileX <= this.maxTileX; tileX++) {
            if ((this.mapo[level][tileX][tileZ] & wall0) !== 0) {
              let minTileZ = tileZ;
              let maxTileZ = tileZ;
              let minLevel = level;
              let maxLevel = level;
              while (minTileZ > 0 && (this.mapo[level][tileX][minTileZ - 1] & wall0) !== 0) {
                minTileZ--;
              }
              while (maxTileZ < this.maxTileZ && (this.mapo[level][tileX][maxTileZ + 1] & wall0) !== 0) {
                maxTileZ++;
              }
              find_min_level:
                while (minLevel > 0) {
                  for (let z = minTileZ;z <= maxTileZ; z++) {
                    if ((this.mapo[minLevel - 1][tileX][z] & wall0) === 0) {
                      break find_min_level;
                    }
                  }
                  minLevel--;
                }
              find_max_level:
                while (maxLevel < topLevel) {
                  for (let z = minTileZ;z <= maxTileZ; z++) {
                    if ((this.mapo[maxLevel + 1][tileX][z] & wall0) === 0) {
                      break find_max_level;
                    }
                  }
                  maxLevel++;
                }
              const area = (maxLevel + 1 - minLevel) * (maxTileZ + 1 - minTileZ);
              if (area >= 8) {
                const minY = this.groundh[maxLevel][tileX][minTileZ] - 240;
                const maxX = this.groundh[minLevel][tileX][minTileZ];
                World.setOcclude(topLevel, 1, tileX * 128, minY, minTileZ * 128, tileX * 128, maxX, maxTileZ * 128 + 128);
                for (let l = minLevel;l <= maxLevel; l++) {
                  for (let z = minTileZ;z <= maxTileZ; z++) {
                    this.mapo[l][tileX][z] &= ~wall0;
                  }
                }
              }
            }
            if ((this.mapo[level][tileX][tileZ] & wall1) !== 0) {
              let minTileX = tileX;
              let maxTileX = tileX;
              let minLevel = level;
              let maxLevel = level;
              while (minTileX > 0 && (this.mapo[level][minTileX - 1][tileZ] & wall1) !== 0) {
                minTileX--;
              }
              while (maxTileX < this.maxTileX && (this.mapo[level][maxTileX + 1][tileZ] & wall1) !== 0) {
                maxTileX++;
              }
              find_min_level2:
                while (minLevel > 0) {
                  for (let x = minTileX;x <= maxTileX; x++) {
                    if ((this.mapo[minLevel - 1][x][tileZ] & wall1) === 0) {
                      break find_min_level2;
                    }
                  }
                  minLevel--;
                }
              find_max_level2:
                while (maxLevel < topLevel) {
                  for (let x = minTileX;x <= maxTileX; x++) {
                    if ((this.mapo[maxLevel + 1][x][tileZ] & wall1) === 0) {
                      break find_max_level2;
                    }
                  }
                  maxLevel++;
                }
              const area = (maxLevel + 1 - minLevel) * (maxTileX + 1 - minTileX);
              if (area >= 8) {
                const minY = this.groundh[maxLevel][minTileX][tileZ] - 240;
                const maxY = this.groundh[minLevel][minTileX][tileZ];
                World.setOcclude(topLevel, 2, minTileX * 128, minY, tileZ * 128, maxTileX * 128 + 128, maxY, tileZ * 128);
                for (let l = minLevel;l <= maxLevel; l++) {
                  for (let x = minTileX;x <= maxTileX; x++) {
                    this.mapo[l][x][tileZ] &= ~wall1;
                  }
                }
              }
            }
            if ((this.mapo[level][tileX][tileZ] & floor) !== 0) {
              let minTileX = tileX;
              let maxTileX = tileX;
              let minTileZ = tileZ;
              let maxTileZ = tileZ;
              while (minTileZ > 0 && (this.mapo[level][tileX][minTileZ - 1] & floor) !== 0) {
                minTileZ--;
              }
              while (maxTileZ < this.maxTileZ && (this.mapo[level][tileX][maxTileZ + 1] & floor) !== 0) {
                maxTileZ++;
              }
              find_min_tile_xz:
                while (minTileX > 0) {
                  for (let z = minTileZ;z <= maxTileZ; z++) {
                    if ((this.mapo[level][minTileX - 1][z] & floor) === 0) {
                      break find_min_tile_xz;
                    }
                  }
                  minTileX--;
                }
              find_max_tile_xz:
                while (maxTileX < this.maxTileX) {
                  for (let z = minTileZ;z <= maxTileZ; z++) {
                    if ((this.mapo[level][maxTileX + 1][z] & floor) === 0) {
                      break find_max_tile_xz;
                    }
                  }
                  maxTileX++;
                }
              if ((maxTileX + 1 - minTileX) * (maxTileZ + 1 - minTileZ) >= 4) {
                const y = this.groundh[level][minTileX][minTileZ];
                World.setOcclude(topLevel, 4, minTileX * 128, y, minTileZ * 128, maxTileX * 128 + 128, y, maxTileZ * 128 + 128);
                for (let x = minTileX;x <= maxTileX; x++) {
                  for (let z = minTileZ;z <= maxTileZ; z++) {
                    this.mapo[level][x][z] &= ~floor;
                  }
                }
              }
            }
          }
        }
      }
    }
  }
  static perlinNoise(x, z) {
    let value = this.interpolatedNoise(x + 45365, z + 91923, 4) + (this.interpolatedNoise(x + 10294, z + 37821, 2) - 128 >> 1) + (this.interpolatedNoise(x, z, 1) - 128 >> 2) - 128;
    value = (value * 0.3 | 0) + 35;
    if (value < 10) {
      value = 10;
    } else if (value > 60) {
      value = 60;
    }
    return value;
  }
  static interpolatedNoise(x, z, scale) {
    const intX = x / scale | 0;
    const fracX = x & scale - 1;
    const intZ = z / scale | 0;
    const fracZ = z & scale - 1;
    const v1 = this.smoothNoise(intX, intZ);
    const v2 = this.smoothNoise(intX + 1, intZ);
    const v3 = this.smoothNoise(intX, intZ + 1);
    const v4 = this.smoothNoise(intX + 1, intZ + 1);
    const i1 = this.interpolate(v1, v2, fracX, scale);
    const i2 = this.interpolate(v3, v4, fracX, scale);
    return this.interpolate(i1, i2, fracZ, scale);
  }
  static interpolate(a, b, x, scale) {
    const f = 65536 - Pix3D.cosTable[x * 1024 / scale | 0] >> 1;
    return (a * (65536 - f) >> 16) + (b * f >> 16);
  }
  static smoothNoise(x, y) {
    const corners = this.noise(x - 1, y - 1) + this.noise(x + 1, y - 1) + this.noise(x - 1, y + 1) + this.noise(x + 1, y + 1);
    const sides = this.noise(x - 1, y) + this.noise(x + 1, y) + this.noise(x, y - 1) + this.noise(x, y + 1);
    const center = this.noise(x, y);
    return (corners / 16 | 0) + (sides / 8 | 0) + (center / 4 | 0);
  }
  static noise(x, y) {
    const n = x + y * 57;
    const n1 = BigInt(n << 13 ^ n);
    return Number((n1 * (n1 * n1 * 15731n + 789221n) + 1376312589n & 0x7fffffffn) >> 19n) & 255;
  }
  fadeAdjacent(startZ, startX, endZ, endX) {
    for (let z = startZ;z <= startZ + endZ; z++) {
      for (let x = startX;x <= startX + endX; x++) {
        if (x >= 0 && x < this.maxTileX && z >= 0 && z < this.maxTileZ) {
          this.shadow[0][x][z] = 127;
          if (startX == x && x > 0) {
            this.groundh[0][x][z] = this.groundh[0][x - 1][z];
          }
          if (startX + endX == x && x < this.maxTileX - 1) {
            this.groundh[0][x][z] = this.groundh[0][x + 1][z];
          }
          if (startZ == z && z > 0) {
            this.groundh[0][x][z] = this.groundh[0][x][z - 1];
          }
          if (startZ + endZ == z && z < this.maxTileZ - 1) {
            this.groundh[0][x][z] = this.groundh[0][x][z + 1];
          }
        }
      }
    }
  }
  loadGround(src, originX, originZ, xOffset, zOffset) {
    const buf = new Packet(src);
    for (let level = 0;level < 4 /* LEVELS */; level++) {
      for (let x = 0;x < 64; x++) {
        for (let z = 0;z < 64; z++) {
          const stx = x + xOffset;
          const stz = z + zOffset;
          let opcode;
          if (stx >= 0 && stx < 104 /* SIZE */ && stz >= 0 && stz < 104 /* SIZE */) {
            this.mapl[level][stx][stz] = 0;
            while (true) {
              opcode = buf.g1();
              if (opcode === 0) {
                if (level === 0) {
                  this.groundh[0][stx][stz] = -ClientBuild.perlinNoise(stx + originX + 932731, stz + 556238 + originZ) * 8;
                } else {
                  this.groundh[level][stx][stz] = this.groundh[level - 1][stx][stz] - 240;
                }
                break;
              }
              if (opcode === 1) {
                let height = buf.g1();
                if (height === 1) {
                  height = 0;
                }
                if (level === 0) {
                  this.groundh[0][stx][stz] = -height * 8;
                } else {
                  this.groundh[level][stx][stz] = this.groundh[level - 1][stx][stz] - height * 8;
                }
                break;
              }
              if (opcode <= 49) {
                this.floort2[level][stx][stz] = buf.g1b();
                this.floors[level][stx][stz] = ((opcode - 2) / 4 | 0) << 24 >> 24;
                this.floorr[level][stx][stz] = (opcode - 2 & 3) << 24 >> 24;
              } else if (opcode <= 81) {
                this.mapl[level][stx][stz] = opcode - 49 << 24 >> 24;
              } else {
                this.floort1[level][stx][stz] = opcode - 81 << 24 >> 24;
              }
            }
          } else {
            while (true) {
              opcode = buf.g1();
              if (opcode === 0) {
                break;
              }
              if (opcode === 1) {
                buf.g1();
                break;
              }
              if (opcode <= 49) {
                buf.g1();
              }
            }
          }
        }
      }
    }
  }
  static checkLocations(src, xOffset, zOffset) {
    let ready = true;
    const buf = new Packet(src);
    let locId = -1;
    while (true) {
      const deltaId = buf.gsmarts();
      if (deltaId == 0) {
        break;
      }
      locId += deltaId;
      let locPos = 0;
      let skip = false;
      while (true) {
        if (skip) {
          const deltaPos = buf.gsmarts();
          if (deltaPos == 0) {
            break;
          }
          buf.g1();
        } else {
          const deltaPos = buf.gsmarts();
          if (deltaPos == 0) {
            break;
          }
          locPos += deltaPos - 1;
          const z = locPos & 63;
          const x = locPos >> 6 & 63;
          const shape = buf.g1() >> 2;
          const stx = xOffset + x;
          const stz = zOffset + z;
          if (stx > 0 && stz > 0 && stx < 103 && stz < 103) {
            const loc = LocType.list(locId);
            if (shape != 22 || !ClientBuild.lowMem || loc.active || loc.forcedecor) {
              if (!loc.checkModelAll()) {
                ready = false;
              }
              skip = true;
            }
          }
        }
      }
    }
    return ready;
  }
  static prefetchLocations(buf, od) {
    let locId = -1;
    while (true) {
      const deltaId = buf.gsmarts();
      if (deltaId == 0) {
        return;
      }
      locId += deltaId;
      const loc = LocType.list(locId);
      loc.prefetchModelAll(od);
      while (true) {
        const deltaPos = buf.gsmarts();
        if (deltaPos == 0) {
          break;
        }
        buf.g1();
      }
    }
  }
  loadLocations(src, xOffset, zOffset, loopCycle, world, collisions) {
    const buf = new Packet(src);
    let locId = -1;
    while (true) {
      const deltaId = buf.gsmarts();
      if (deltaId === 0) {
        return;
      }
      locId += deltaId;
      let locPos = 0;
      while (true) {
        const deltaPos = buf.gsmarts();
        if (deltaPos === 0) {
          break;
        }
        locPos += deltaPos - 1;
        const z = locPos & 63;
        const x = locPos >> 6 & 63;
        const level = locPos >> 12;
        const info = buf.g1();
        const shape = info >> 2;
        const rotation = info & 3;
        const stx = x + xOffset;
        const stz = z + zOffset;
        if (stx > 0 && stz > 0 && stx < 104 /* SIZE */ - 1 && stz < 104 /* SIZE */ - 1) {
          let currentLevel = level;
          if ((this.mapl[1][stx][stz] & 2 /* LinkBelow */) !== 0) {
            currentLevel = level - 1;
          }
          let cmap = null;
          if (currentLevel >= 0) {
            cmap = collisions[currentLevel];
          }
          this.addLoc(level, stx, stz, locId, shape, rotation, loopCycle, world, cmap);
        }
      }
    }
  }
  addLoc(level, x, z, locId, shape, angle, loopCycle, world, collision) {
    if (ClientBuild.lowMem) {
      if ((this.mapl[level][x][z] & 16 /* ForceHighDetail */) !== 0) {
        return;
      }
      if (this.getVisBelowLevel(level, x, z) !== ClientBuild.minusedlevel) {
        return;
      }
    }
    const heightSW = this.groundh[level][x][z];
    const heightSE = this.groundh[level][x + 1][z];
    const heightNE = this.groundh[level][x + 1][z + 1];
    const heightNW = this.groundh[level][x][z + 1];
    const y = heightSW + heightSE + heightNE + heightNW >> 2;
    const loc = LocType.list(locId);
    let typecode = x + (z << 7) + (locId << 14) + 1073741824 | 0;
    if (!loc.active) {
      typecode += -2147483648;
    }
    typecode |= 0;
    const typecode2 = ((angle << 6) + shape | 0) << 24 >> 24;
    if (shape === 22 /* GROUND_DECOR */) {
      if (!ClientBuild.lowMem || loc.active || loc.forcedecor) {
        let model;
        if (loc.anim === -1) {
          model = loc.getModel(22, angle, heightSW, heightSE, heightNE, heightNW, -1);
        } else {
          model = new ClientLocAnim(loopCycle, locId, 22, shape, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
        }
        world?.setGroundDecor(model, level, x, z, y, typecode, typecode2);
        if (loc.blockwalk && loc.active && collision) {
          collision.blockGround(x, z);
        }
      }
    } else if (shape === 10 /* CENTREPIECE_STRAIGHT */ || shape === 11 /* CENTREPIECE_DIAGONAL */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(10, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 10, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      if (model) {
        let yaw = 0;
        if (shape === 11 /* CENTREPIECE_DIAGONAL */) {
          yaw += 256;
        }
        let width;
        let height;
        if (angle === 1 /* NORTH */ || angle === 3 /* SOUTH */) {
          width = loc.length;
          height = loc.width;
        } else {
          width = loc.width;
          height = loc.length;
        }
        if (world?.addScenery(level, x, z, y, model, typecode, typecode2, width, height, yaw) && loc.shadow) {
          let model2;
          if (model instanceof Model) {
            model2 = model;
          } else {
            model2 = loc.getModel(10, angle, heightSW, heightSE, heightNE, heightNW, -1);
          }
          if (model2) {
            for (let dx = 0;dx <= width; dx++) {
              for (let dz = 0;dz <= height; dz++) {
                let shade = model2.radius / 4 | 0;
                if (shade > 30) {
                  shade = 30;
                }
                if (shade > this.shadow[level][x + dx][z + dz]) {
                  this.shadow[level][x + dx][z + dz] = shade << 24 >> 24;
                }
              }
            }
          }
        }
      }
      if (loc.blockwalk && collision) {
        collision.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
      }
    } else if (shape >= 12 /* ROOF_STRAIGHT */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(shape, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.addScenery(level, x, z, y, model, typecode, typecode2, 1, 1, 0);
      if (shape >= 12 /* ROOF_STRAIGHT */ && shape <= 17 /* ROOF_FLAT */ && shape !== 13 /* ROOF_DIAGONAL_WITH_ROOFEDGE */ && level > 0) {
        this.mapo[level][x][z] |= 2340;
      }
      if (loc.blockwalk && collision) {
        collision.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
      }
    } else if (shape === 0 /* WALL_STRAIGHT */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(0, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 0, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setWall(level, x, z, y, ClientBuild.WSHAPE0[angle], 0, model, null, typecode, typecode2);
      if (angle === 0 /* WEST */) {
        if (loc.shadow) {
          this.shadow[level][x][z] = 50;
          this.shadow[level][x][z + 1] = 50;
        }
        if (loc.occlude) {
          this.mapo[level][x][z] |= 585;
        }
      } else if (angle === 1 /* NORTH */) {
        if (loc.shadow) {
          this.shadow[level][x][z + 1] = 50;
          this.shadow[level][x + 1][z + 1] = 50;
        }
        if (loc.occlude) {
          this.mapo[level][x][z + 1] |= 1170;
        }
      } else if (angle === 2 /* EAST */) {
        if (loc.shadow) {
          this.shadow[level][x + 1][z] = 50;
          this.shadow[level][x + 1][z + 1] = 50;
        }
        if (loc.occlude) {
          this.mapo[level][x + 1][z] |= 585;
        }
      } else if (angle === 3 /* SOUTH */) {
        if (loc.shadow) {
          this.shadow[level][x][z] = 50;
          this.shadow[level][x + 1][z] = 50;
        }
        if (loc.occlude) {
          this.mapo[level][x][z] |= 1170;
        }
      }
      if (loc.blockwalk && collision) {
        collision.addWall(x, z, shape, angle, loc.blockrange);
      }
      if (loc.wallwidth !== 16) {
        world?.setDecorOffset(level, x, z, loc.wallwidth);
      }
    } else if (shape === 1 /* WALL_DIAGONAL_CORNER */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(1, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 1, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setWall(level, x, z, y, ClientBuild.WSHAPE1[angle], 0, model, null, typecode, typecode2);
      if (loc.shadow) {
        if (angle === 0 /* WEST */) {
          this.shadow[level][x][z + 1] = 50;
        } else if (angle === 1 /* NORTH */) {
          this.shadow[level][x + 1][z + 1] = 50;
        } else if (angle === 2 /* EAST */) {
          this.shadow[level][x + 1][z] = 50;
        } else if (angle === 3 /* SOUTH */) {
          this.shadow[level][x][z] = 50;
        }
      }
      if (loc.blockwalk && collision) {
        collision.addWall(x, z, shape, angle, loc.blockrange);
      }
    } else if (shape === 2 /* WALL_L */) {
      const offset = angle + 1 & 3;
      let model1;
      let model2;
      if (loc.anim === -1) {
        model1 = loc.getModel(2, angle + 4, heightSW, heightSE, heightNE, heightNW, -1);
        model2 = loc.getModel(2, offset, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model1 = new ClientLocAnim(loopCycle, locId, 2, angle + 4, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
        model2 = new ClientLocAnim(loopCycle, locId, 2, offset, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setWall(level, x, z, y, ClientBuild.WSHAPE0[angle], ClientBuild.WSHAPE0[offset], model1, model2, typecode, typecode2);
      if (loc.occlude) {
        if (angle === 0 /* WEST */) {
          this.mapo[level][x][z] |= 265;
          this.mapo[level][x][z + 1] |= 1170;
        } else if (angle === 1 /* NORTH */) {
          this.mapo[level][x][z + 1] |= 1170;
          this.mapo[level][x + 1][z] |= 585;
        } else if (angle === 2 /* EAST */) {
          this.mapo[level][x + 1][z] |= 585;
          this.mapo[level][x][z] |= 1170;
        } else if (angle === 3 /* SOUTH */) {
          this.mapo[level][x][z] |= 1170;
          this.mapo[level][x][z] |= 585;
        }
      }
      if (loc.blockwalk && collision) {
        collision.addWall(x, z, shape, angle, loc.blockrange);
      }
      if (loc.wallwidth !== 16) {
        world?.setDecorOffset(level, x, z, loc.wallwidth);
      }
    } else if (shape === 3 /* WALL_SQUARE_CORNER */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(3, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 3, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setWall(level, x, z, y, ClientBuild.WSHAPE1[angle], 0, model, null, typecode, typecode2);
      if (loc.shadow) {
        if (angle === 0 /* WEST */) {
          this.shadow[level][x][z + 1] = 50;
        } else if (angle === 1 /* NORTH */) {
          this.shadow[level][x + 1][z + 1] = 50;
        } else if (angle === 2 /* EAST */) {
          this.shadow[level][x + 1][z] = 50;
        } else if (angle === 3 /* SOUTH */) {
          this.shadow[level][x][z] = 50;
        }
      }
      if (loc.blockwalk && collision) {
        collision.addWall(x, z, shape, angle, loc.blockrange);
      }
    } else if (shape === 9 /* WALL_DIAGONAL */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(shape, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.addScenery(level, x, z, y, model, typecode, typecode2, 1, 1, 0);
      if (loc.blockwalk && collision) {
        collision.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
      }
    } else if (shape === 4 /* WALLDECOR_STRAIGHT_NOOFFSET */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(4, 0, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 4, 0, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setDecor(level, x, z, y, 0, 0, typecode, model, typecode2, angle * 512, ClientBuild.WSHAPE0[angle]);
    } else if (shape === 5 /* WALLDECOR_STRAIGHT_OFFSET */) {
      let wallwidth = 16;
      if (world) {
        const typecode3 = world.wallType(level, x, z);
        if (typecode3 > 0) {
          wallwidth = LocType.list(typecode3 >> 14 & 32767).wallwidth;
        }
      }
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(4, 0, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 4, 0, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setDecor(level, x, z, y, ClientBuild.DECORXOF[angle] * wallwidth, ClientBuild.DECORZOF[angle] * wallwidth, typecode, model, typecode2, angle * 512, ClientBuild.WSHAPE0[angle]);
    } else if (shape === 6 /* WALLDECOR_DIAGONAL_OFFSET */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(4, 0, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 4, 0, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setDecor(level, x, z, y, 0, 0, typecode, model, typecode2, angle, 256);
    } else if (shape === 7 /* WALLDECOR_DIAGONAL_NOOFFSET */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(4, 0, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 4, 0, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setDecor(level, x, z, y, 0, 0, typecode, model, typecode2, angle, 512);
    } else if (shape === 8 /* WALLDECOR_DIAGONAL_BOTH */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(4, 0, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 4, 0, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setDecor(level, x, z, y, 0, 0, typecode, model, typecode2, angle, 768);
    }
  }
  getVisBelowLevel(level, stx, stz) {
    if ((this.mapl[level][stx][stz] & 8 /* VisBelow */) === 0) {
      return level <= 0 || (this.mapl[1][stx][stz] & 2 /* LinkBelow */) === 0 ? level : level - 1;
    }
    return 0;
  }
  static getTable(hue, saturation, lightness) {
    if (lightness > 179) {
      saturation = saturation / 2 | 0;
    }
    if (lightness > 192) {
      saturation = saturation / 2 | 0;
    }
    if (lightness > 217) {
      saturation = saturation / 2 | 0;
    }
    if (lightness > 243) {
      saturation = saturation / 2 | 0;
    }
    return ((hue / 4 | 0) << 10) + ((saturation / 32 | 0) << 7) + (lightness / 2 | 0);
  }
  static changeLocAvailable(id, shape) {
    const loc = LocType.list(id);
    if (shape == 11) {
      shape = 10;
    }
    if (shape >= 5 && shape <= 8) {
      shape = 4;
    }
    return loc.checkModel(shape);
  }
  static changeLocUnchecked(level, x, z, locId, shape, angle, loopCycle, trueLevel, levelHeightmap, world, cmap) {
    const heightSW = levelHeightmap[trueLevel][x][z];
    const heightSE = levelHeightmap[trueLevel][x + 1][z];
    const heightNW = levelHeightmap[trueLevel][x + 1][z + 1];
    const heightNE = levelHeightmap[trueLevel][x][z + 1];
    const y = heightSW + heightSE + heightNW + heightNE >> 2;
    const loc = LocType.list(locId);
    let typecode = x + (z << 7) + (locId << 14) + 1073741824 | 0;
    if (!loc.active) {
      typecode += -2147483648;
    }
    typecode |= 0;
    const typecode2 = ((angle << 6) + shape | 0) << 24 >> 24;
    if (shape === 22 /* GROUND_DECOR */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(22, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 22, shape, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setGroundDecor(model, level, x, z, y, typecode, typecode2);
      if (loc.blockwalk && loc.active && cmap) {
        cmap.blockGround(x, z);
      }
    } else if (shape === 10 /* CENTREPIECE_STRAIGHT */ || shape === 11 /* CENTREPIECE_DIAGONAL */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(10, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 10, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      if (model) {
        let yaw = 0;
        if (shape === 11 /* CENTREPIECE_DIAGONAL */) {
          yaw += 256;
        }
        let width;
        let height;
        if (angle === 1 /* NORTH */ || angle === 3 /* SOUTH */) {
          width = loc.length;
          height = loc.width;
        } else {
          width = loc.width;
          height = loc.length;
        }
        world?.addScenery(level, x, z, y, model, typecode, typecode2, width, height, yaw);
      }
      if (loc.blockwalk && cmap) {
        cmap.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
      }
    } else if (shape >= 12 /* ROOF_STRAIGHT */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(shape, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.addScenery(level, x, z, y, model, typecode, typecode2, 1, 1, 0);
      if (loc.blockwalk && cmap) {
        cmap.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
      }
    } else if (shape === 0 /* WALL_STRAIGHT */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(0, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 0, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setWall(level, x, z, y, ClientBuild.WSHAPE0[angle], 0, model, null, typecode, typecode2);
      if (loc.blockwalk && cmap) {
        cmap.addWall(x, z, shape, angle, loc.blockrange);
      }
    } else if (shape === 1 /* WALL_DIAGONAL_CORNER */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(1, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 1, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setWall(level, x, z, y, ClientBuild.WSHAPE1[angle], 0, model, null, typecode, typecode2);
      if (loc.blockwalk && cmap) {
        cmap.addWall(x, z, shape, angle, loc.blockrange);
      }
    } else if (shape === 2 /* WALL_L */) {
      const offset = angle + 1 & 3;
      let model1;
      let model2;
      if (loc.anim === -1) {
        model1 = loc.getModel(2, angle + 4, heightSW, heightSE, heightNE, heightNW, -1);
        model2 = loc.getModel(2, offset, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model1 = new ClientLocAnim(loopCycle, locId, 2, angle + 4, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
        model2 = new ClientLocAnim(loopCycle, locId, 2, offset, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setWall(level, x, z, y, ClientBuild.WSHAPE0[angle], ClientBuild.WSHAPE0[offset], model1, model2, typecode, typecode2);
      if (loc.blockwalk && cmap) {
        cmap.addWall(x, z, shape, angle, loc.blockrange);
      }
    } else if (shape === 3 /* WALL_SQUARE_CORNER */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(3, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 3, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setWall(level, x, z, y, ClientBuild.WSHAPE1[angle], 0, model, null, typecode, typecode2);
      if (loc.blockwalk && cmap) {
        cmap.addWall(x, z, shape, angle, loc.blockrange);
      }
    } else if (shape === 9 /* WALL_DIAGONAL */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(shape, angle, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, shape, angle, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.addScenery(level, x, z, y, model, typecode, typecode2, 1, 1, 0);
      if (loc.blockwalk && cmap) {
        cmap.addLoc(x, z, loc.width, loc.length, angle, loc.blockrange);
      }
    } else if (shape === 4 /* WALLDECOR_STRAIGHT_NOOFFSET */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(4, 0, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 4, 0, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setDecor(level, x, z, y, 0, 0, typecode, model, typecode2, angle * 512, ClientBuild.WSHAPE0[angle]);
    } else if (shape === 5 /* WALLDECOR_STRAIGHT_OFFSET */) {
      let wallwidth = 16;
      if (world) {
        const typecode3 = world.wallType(level, x, z);
        if (typecode3 > 0) {
          wallwidth = LocType.list(typecode3 >> 14 & 32767).wallwidth;
        }
      }
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(4, 0, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 4, 0, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setDecor(level, x, z, y, ClientBuild.DECORXOF[angle] * wallwidth, ClientBuild.DECORZOF[angle] * wallwidth, typecode, model, typecode2, angle * 512, ClientBuild.WSHAPE0[angle]);
    } else if (shape === 6 /* WALLDECOR_DIAGONAL_OFFSET */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(4, 0, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 4, 0, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setDecor(level, x, z, y, 0, 0, typecode, model, typecode2, angle, 256);
    } else if (shape === 7 /* WALLDECOR_DIAGONAL_NOOFFSET */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(4, 0, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 4, 0, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setDecor(level, x, z, y, 0, 0, typecode, model, typecode2, angle, 512);
    } else if (shape === 8 /* WALLDECOR_DIAGONAL_BOTH */) {
      let model;
      if (loc.anim === -1) {
        model = loc.getModel(4, 0, heightSW, heightSE, heightNE, heightNW, -1);
      } else {
        model = new ClientLocAnim(loopCycle, locId, 4, 0, heightSW, heightSE, heightNE, heightNW, loc.anim, true);
      }
      world?.setDecor(level, x, z, y, 0, 0, typecode, model, typecode2, angle, 768);
    }
  }
  static getUCol(hsl, lightness) {
    if (hsl === -1) {
      return 12345678;
    }
    lightness = lightness * (hsl & 127) / 128 | 0;
    if (lightness < 2) {
      lightness = 2;
    } else if (lightness > 126) {
      lightness = 126;
    }
    return (hsl & 65408) + lightness;
  }
  static getOCol(hsl, scalar) {
    if (hsl === -2) {
      return 12345678;
    }
    if (hsl === -1) {
      if (scalar < 0) {
        scalar = 0;
      } else if (scalar > 127) {
        scalar = 127;
      }
      return 127 - scalar;
    } else {
      scalar = scalar * (hsl & 127) / 128 | 0;
      if (scalar < 2) {
        scalar = 2;
      } else if (scalar > 126) {
        scalar = 126;
      }
      return (hsl & 65408) + scalar;
    }
  }
}

// src/dash3d/ClientEntity.ts
class ClientEntity extends ModelSource {
  x = 0;
  z = 0;
  yaw = 0;
  needsForwardDrawPadding = false;
  size = 1;
  readyanim = -1;
  turnanim = -1;
  walkanim = -1;
  walkanim_b = -1;
  walkanim_l = -1;
  walkanim_r = -1;
  runanim = -1;
  chatMessage = null;
  chatTimer = 100;
  chatColour = 0;
  chatEffect = 0;
  combatCycle = -1000;
  damageValues = new Int32Array(4);
  damageTypes = new Int32Array(4);
  damageCycles = new Int32Array(4);
  health = 0;
  totalHealth = 0;
  faceEntity = -1;
  faceSquareX = 0;
  faceSquareZ = 0;
  secondaryAnim = -1;
  secondaryAnimFrame = 0;
  secondaryAnimCycle = 0;
  primaryAnim = -1;
  primaryAnimFrame = 0;
  primaryAnimCycle = 0;
  primaryAnimDelay = 0;
  primaryAnimLoop = 0;
  spotanimId = -1;
  spotanimFrame = 0;
  spotanimCycle = 0;
  spotanimLastCycle = 0;
  spotanimHeight = 0;
  exactStartX = 0;
  exactEndX = 0;
  exactStartZ = 0;
  exactEndZ = 0;
  exactMoveEnd = 0;
  exactMoveStart = 0;
  exactMoveFacing = 0;
  cycle = 0;
  height = 0;
  dstYaw = 0;
  routeLength = 0;
  routeX = new Int32Array(10);
  routeZ = new Int32Array(10);
  routeRun = new TypedArray1d(10, false);
  animDelayMove = 0;
  preanimRouteLength = 0;
  turnspeed = 32;
  teleport(jump, x, z) {
    if (this.primaryAnim !== -1 && SeqType.list[this.primaryAnim].postanim_move === 1 /* ABORTANIM */) {
      this.primaryAnim = -1;
    }
    if (!jump) {
      const dx = x - this.routeX[0];
      const dz = z - this.routeZ[0];
      if (dx >= -8 && dx <= 8 && dz >= -8 && dz <= 8) {
        if (this.routeLength < 9) {
          this.routeLength++;
        }
        for (let i = this.routeLength;i > 0; i--) {
          this.routeX[i] = this.routeX[i - 1];
          this.routeZ[i] = this.routeZ[i - 1];
          this.routeRun[i] = this.routeRun[i - 1];
        }
        this.routeX[0] = x;
        this.routeZ[0] = z;
        this.routeRun[0] = false;
        return;
      }
    }
    this.routeLength = 0;
    this.preanimRouteLength = 0;
    this.animDelayMove = 0;
    this.routeX[0] = x;
    this.routeZ[0] = z;
    this.x = this.routeX[0] * 128 + this.size * 64;
    this.z = this.routeZ[0] * 128 + this.size * 64;
  }
  moveCode(running, direction) {
    let nextX = this.routeX[0];
    let nextZ = this.routeZ[0];
    if (direction === 0) {
      nextX--;
      nextZ++;
    } else if (direction === 1) {
      nextZ++;
    } else if (direction === 2) {
      nextX++;
      nextZ++;
    } else if (direction === 3) {
      nextX--;
    } else if (direction === 4) {
      nextX++;
    } else if (direction === 5) {
      nextX--;
      nextZ--;
    } else if (direction === 6) {
      nextZ--;
    } else if (direction === 7) {
      nextX++;
      nextZ--;
    }
    if (this.primaryAnim !== -1 && SeqType.list[this.primaryAnim].postanim_move === 1 /* ABORTANIM */) {
      this.primaryAnim = -1;
    }
    if (this.routeLength < 9) {
      this.routeLength++;
    }
    for (let i = this.routeLength;i > 0; i--) {
      this.routeX[i] = this.routeX[i - 1];
      this.routeZ[i] = this.routeZ[i - 1];
      this.routeRun[i] = this.routeRun[i - 1];
    }
    this.routeX[0] = nextX;
    this.routeZ[0] = nextZ;
    this.routeRun[0] = running;
  }
  abortRoute() {
    this.routeLength = 0;
    this.preanimRouteLength = 0;
  }
  addHitmark(loopCycle, type, value) {
    for (let i = 0;i < 4; i++) {
      if (this.damageCycles[i] <= loopCycle) {
        this.damageValues[i] = value;
        this.damageTypes[i] = type;
        this.damageCycles[i] = loopCycle + 70;
        return;
      }
    }
  }
}

// src/dash3d/ClientNpc.ts
class ClientNpc extends ClientEntity {
  type = null;
  getTempModel() {
    if (this.type == null) {
      return null;
    }
    let model = this.getTempModel2();
    if (model == null) {
      return null;
    }
    this.height = model.minY;
    if (this.spotanimId != -1 && this.spotanimFrame != -1) {
      const spot = SpotType.list[this.spotanimId];
      const spotModel = spot.getTempModel2();
      if (spotModel != null) {
        const temp = Model.copyForAnim(spotModel, true, AnimFrame.shareAlpha(this.spotanimFrame), false);
        temp.translate(-this.spotanimHeight, 0, 0);
        temp.prepareAnim();
        if (spot.seq && spot.seq.frames) {
          temp.animate(spot.seq.frames[this.spotanimFrame]);
        }
        temp.labelFaces = null;
        temp.labelVertices = null;
        if (spot.resizeh != 128 || spot.resizev != 128) {
          temp.resize(spot.resizev, spot.resizeh, spot.resizeh);
        }
        temp.calculateNormals(spot.ambient + 64, spot.contrast + 850, -30, -50, -30, true);
        const models = [model, temp];
        model = Model.combine(models, 2);
      }
    }
    if (this.type.size == 1) {
      model.useAABBMouseCheck = true;
    }
    return model;
  }
  getTempModel2() {
    if (!this.type) {
      return null;
    }
    if (this.primaryAnim < 0 || this.primaryAnimDelay != 0) {
      const secondarySeq = SeqType.list[this.secondaryAnim];
      let secondaryTransform = -1;
      if (this.secondaryAnim >= 0 && secondarySeq.frames) {
        secondaryTransform = secondarySeq.frames[this.secondaryAnimFrame];
      }
      return this.type.getTempModel(secondaryTransform, -1, null);
    } else {
      const primarySeq = SeqType.list[this.primaryAnim];
      let primaryTransform = -1;
      if (primarySeq.frames) {
        primaryTransform = primarySeq.frames[this.primaryAnimFrame];
      }
      const secondarySeq = SeqType.list[this.secondaryAnim];
      let secondaryTransform = -1;
      if (this.secondaryAnim >= 0 && this.secondaryAnim != this.readyanim && secondarySeq.frames) {
        secondaryTransform = secondarySeq.frames[this.secondaryAnimFrame];
      }
      return this.type.getTempModel(primaryTransform, secondaryTransform, primarySeq.walkmerge);
    }
  }
  isReady() {
    return this.type !== null;
  }
}

// src/dash3d/ClientObj.ts
class ClientObj extends ModelSource {
  id;
  count;
  constructor(id, count) {
    super();
    this.id = id;
    this.count = count;
  }
  getTempModel() {
    const obj = ObjType.list(this.id);
    return obj.getModelLit(this.count);
  }
}

// src/dash3d/ClientPlayer.ts
class ClientPlayer extends ClientEntity {
  static recol2d = [
    9104 /* BODY_RECOLOR_KHAKI */,
    10275 /* BODY_RECOLOR_CHARCOAL */,
    7595 /* BODY_RECOLOR_CRIMSON */,
    3610 /* BODY_RECOLOR_NAVY */,
    7975 /* BODY_RECOLOR_STRAW */,
    8526 /* BODY_RECOLOR_WHITE */,
    918 /* BODY_RECOLOR_RED */,
    38802 /* BODY_RECOLOR_BLUE */,
    24466 /* BODY_RECOLOR_GREEN */,
    10145 /* BODY_RECOLOR_YELLOW */,
    58654 /* BODY_RECOLOR_PURPLE */,
    5027 /* BODY_RECOLOR_ORANGE */,
    1457 /* BODY_RECOLOR_ROSE */,
    16565 /* BODY_RECOLOR_LIME */,
    34991 /* BODY_RECOLOR_CYAN */,
    25486 /* BODY_RECOLOR_EMERALD */
  ];
  static recol1d = [
    [
      6798 /* HAIR_DARK_BROWN */,
      107 /* HAIR_WHITE */,
      10283 /* HAIR_LIGHT_GREY */,
      16 /* HAIR_DARK_GREY */,
      4797 /* HAIR_APRICOT */,
      7744 /* HAIR_STRAW */,
      5799 /* HAIR_LIGHT_BROWN */,
      4634 /* HAIR_BROWN */,
      33697 /* HAIR_TURQUOISE */,
      22433 /* HAIR_GREEN */,
      2983 /* HAIR_GINGER */,
      54193 /* HAIR_MAGENTA */
    ],
    [
      8741 /* BODY_KHAKI */,
      12 /* BODY_CHARCOAL */,
      64030 /* BODY_CRIMSON */,
      43162 /* BODY_NAVY */,
      7735 /* BODY_STRAW */,
      8404 /* BODY_WHITE */,
      1701 /* BODY_RED */,
      38430 /* BODY_BLUE */,
      24094 /* BODY_GREEN */,
      10153 /* BODY_YELLOW */,
      56621 /* BODY_PURPLE */,
      4783 /* BODY_ORANGE */,
      1341 /* BODY_ROSE */,
      16578 /* BODY_LIME */,
      35003 /* BODY_CYAN */,
      25239 /* BODY_EMERALD */
    ],
    [
      25239 /* BODY_EMERALD */ - 1,
      8741 /* BODY_KHAKI */ + 1,
      12 /* BODY_CHARCOAL */,
      64030 /* BODY_CRIMSON */,
      43162 /* BODY_NAVY */,
      7735 /* BODY_STRAW */,
      8404 /* BODY_WHITE */,
      1701 /* BODY_RED */,
      38430 /* BODY_BLUE */,
      24094 /* BODY_GREEN */,
      10153 /* BODY_YELLOW */,
      56621 /* BODY_PURPLE */,
      4783 /* BODY_ORANGE */,
      1341 /* BODY_ROSE */,
      16578 /* BODY_LIME */,
      35003 /* BODY_CYAN */
    ],
    [
      4626 /* FEET_BROWN */,
      11146 /* FEET_KHAKI */,
      6439 /* FEET_ASHEN */,
      12 /* FEET_DARK */,
      4758 /* FEET_TERRACOTTA */,
      10270 /* FEET_GREY */
    ],
    [
      4550 /* SKIN_DARKER */,
      4537 /* SKIN_DARKER_DARKER */,
      5681 /* SKIN_DARKER_DARKER_DARKER */,
      5673 /* SKIN_DARKER_DARKER_DARKER_DARKER */,
      5790 /* SKIN_DARKER_DARKER_DARKER_DARKER_DARKER */,
      6806 /* SKIN_DARKER_DARKER_DARKER_DARKER_DARKER_DARKER */,
      8076 /* SKIN_DARKER_DARKER_DARKER_DARKER_DARKER_DARKER_DARKER */,
      4574 /* SKIN */
    ]
  ];
  name = null;
  ready = false;
  gender = 0;
  headicons = 0;
  appearance = new Uint16Array(12);
  colour = new Uint16Array(5);
  combatLevel = 0;
  baseId = 0n;
  lowMemory = false;
  modelCacheKey = -1n;
  static modelCache = new LruCache(200);
  y = 0;
  locStartCycle = 0;
  locStopCycle = 0;
  locOffsetX = 0;
  locOffsetY = 0;
  locOffsetZ = 0;
  locModel = null;
  minTileX = 0;
  minTileZ = 0;
  maxTileX = 0;
  maxTileZ = 0;
  transmog = null;
  setAppearance(buf) {
    buf.pos = 0;
    this.gender = buf.g1();
    this.headicons = buf.g1();
    this.transmog = null;
    for (let part = 0;part < 12; part++) {
      const msb = buf.g1();
      if (msb === 0) {
        this.appearance[part] = 0;
      } else {
        this.appearance[part] = (msb << 8) + buf.g1();
        if (part === 0 && this.appearance[0] === 65535) {
          this.transmog = NpcType.list(buf.g2());
          break;
        }
      }
    }
    for (let part = 0;part < 5; part++) {
      let colour = buf.g1();
      if (colour < 0 || colour >= ClientPlayer.recol1d[part].length) {
        colour = 0;
      }
      this.colour[part] = colour;
    }
    this.readyanim = buf.g2();
    if (this.readyanim === 65535) {
      this.readyanim = -1;
    }
    this.turnanim = buf.g2();
    if (this.turnanim === 65535) {
      this.turnanim = -1;
    }
    this.walkanim = buf.g2();
    if (this.walkanim === 65535) {
      this.walkanim = -1;
    }
    this.walkanim_b = buf.g2();
    if (this.walkanim_b === 65535) {
      this.walkanim_b = -1;
    }
    this.walkanim_l = buf.g2();
    if (this.walkanim_l === 65535) {
      this.walkanim_l = -1;
    }
    this.walkanim_r = buf.g2();
    if (this.walkanim_r === 65535) {
      this.walkanim_r = -1;
    }
    this.runanim = buf.g2();
    if (this.runanim === 65535) {
      this.runanim = -1;
    }
    this.name = JString.toScreenName(JString.toRawUsername(buf.g8()));
    this.combatLevel = buf.g1();
    this.ready = true;
    this.baseId = 0n;
    for (let part = 0;part < 12; part++) {
      this.baseId <<= 0x4n;
      if (this.appearance[part] >= 256) {
        this.baseId += BigInt(this.appearance[part]) - 256n;
      }
    }
    if (this.appearance[0] >= 256) {
      this.baseId += BigInt(this.appearance[0]) - 256n >> 4n;
    }
    if (this.appearance[1] >= 256) {
      this.baseId += BigInt(this.appearance[1]) - 256n >> 8n;
    }
    for (let part = 0;part < 5; part++) {
      this.baseId <<= 0x3n;
      this.baseId += BigInt(this.colour[part]);
    }
    this.baseId <<= 0x1n;
    this.baseId += BigInt(this.gender);
  }
  getTempModel(loopCycle) {
    if (!this.ready) {
      return null;
    }
    let model = this.getTempModel2();
    if (model == null) {
      return null;
    }
    this.height = model.minY;
    model.useAABBMouseCheck = true;
    if (this.lowMemory) {
      return model;
    }
    if (this.spotanimId != -1 && this.spotanimFrame != -1) {
      const spot = SpotType.list[this.spotanimId];
      const spotModel = spot.getTempModel2();
      if (spotModel != null) {
        const temp = Model.copyForAnim(spotModel, true, AnimFrame.shareAlpha(this.spotanimFrame), false);
        temp.translate(-this.spotanimHeight, 0, 0);
        temp.prepareAnim();
        if (spot.seq && spot.seq.frames) {
          temp.animate(spot.seq.frames[this.spotanimFrame]);
        }
        temp.labelFaces = null;
        temp.labelVertices = null;
        if (spot.resizeh != 128 || spot.resizev != 128) {
          temp.resize(spot.resizev, spot.resizeh, spot.resizeh);
        }
        temp.calculateNormals(spot.ambient + 64, spot.contrast + 850, -30, -50, -30, true);
        const models = [model, temp];
        model = Model.combine(models, 2);
      }
    }
    if (this.locModel != null) {
      if (loopCycle >= this.locStopCycle) {
        this.locModel = null;
      }
      if (loopCycle >= this.locStartCycle && loopCycle < this.locStopCycle) {
        const loc = this.locModel;
        if (loc) {
          loc.translate(this.locOffsetY - this.y, this.locOffsetX - this.x, this.locOffsetZ - this.z);
          if (this.dstYaw == 512) {
            loc.rotate90();
            loc.rotate90();
            loc.rotate90();
          } else if (this.dstYaw == 1024) {
            loc.rotate90();
            loc.rotate90();
          } else if (this.dstYaw == 1536) {
            loc.rotate90();
          }
          const models = [model, loc];
          model = Model.combine(models, 2);
          if (this.dstYaw == 512) {
            loc.rotate90();
          } else if (this.dstYaw == 1024) {
            loc.rotate90();
            loc.rotate90();
          } else if (this.dstYaw == 1536) {
            loc.rotate90();
            loc.rotate90();
            loc.rotate90();
          }
          loc.translate(this.y - this.locOffsetY, this.x - this.locOffsetX, this.z - this.locOffsetZ);
        }
      }
    }
    model.useAABBMouseCheck = true;
    return model;
  }
  getTempModel2() {
    if (this.transmog != null) {
      let transformId = -1;
      if (this.primaryAnim >= 0 && this.primaryAnimDelay === 0) {
        const frames = SeqType.list[this.primaryAnim].frames;
        if (frames) {
          transformId = frames[this.primaryAnimFrame];
        }
      } else if (this.secondaryAnim >= 0) {
        const frames = SeqType.list[this.secondaryAnim].frames;
        if (frames) {
          transformId = frames[this.secondaryAnimFrame];
        }
      }
      return this.transmog.getTempModel(transformId, -1, null);
    }
    let hash = this.baseId;
    let primaryTransformId = -1;
    let secondaryTransformId = -1;
    let leftHandValue = -1;
    let rightHandValue = -1;
    if (this.primaryAnim >= 0 && this.primaryAnimDelay === 0) {
      const seq = SeqType.list[this.primaryAnim];
      if (seq.frames) {
        primaryTransformId = seq.frames[this.primaryAnimFrame];
      }
      if (this.secondaryAnim >= 0 && this.secondaryAnim !== this.readyanim) {
        const secondFrames = SeqType.list[this.secondaryAnim].frames;
        if (secondFrames) {
          secondaryTransformId = secondFrames[this.secondaryAnimFrame];
        }
      }
      if (seq.replaceheldleft >= 0) {
        leftHandValue = seq.replaceheldleft;
        hash += BigInt(leftHandValue - this.appearance[5]) << 40n;
      }
      if (seq.replaceheldright >= 0) {
        rightHandValue = seq.replaceheldright;
        hash += BigInt(rightHandValue - this.appearance[3]) << 48n;
      }
    } else if (this.secondaryAnim >= 0) {
      const secondFrames = SeqType.list[this.secondaryAnim].frames;
      if (secondFrames) {
        primaryTransformId = secondFrames[this.secondaryAnimFrame];
      }
    }
    let model = ClientPlayer.modelCache.find(hash);
    if (!model) {
      let needsModel = false;
      for (let slot = 0;slot < 12; slot++) {
        let value = this.appearance[slot];
        if (rightHandValue >= 0 && slot == 3) {
          value = rightHandValue;
        }
        if (leftHandValue >= 0 && slot == 5) {
          value = leftHandValue;
        }
        if (value >= 256 && value < 512 && !IdkType.list[value - 256].checkModel()) {
          needsModel = true;
        }
        if (value >= 512 && !ObjType.list(value - 512).checkWearModel(this.gender)) {
          needsModel = true;
        }
      }
      if (needsModel) {
        if (this.modelCacheKey !== -1n) {
          model = ClientPlayer.modelCache.find(this.baseId);
        }
        if (model == null) {
          return null;
        }
      }
    }
    if (!model) {
      const models = new TypedArray1d(12, null);
      let modelCount = 0;
      for (let part = 0;part < 12; part++) {
        let value = this.appearance[part];
        if (rightHandValue >= 0 && part === 3) {
          value = rightHandValue;
        }
        if (leftHandValue >= 0 && part === 5) {
          value = leftHandValue;
        }
        if (value >= 256 && value < 512) {
          const idkModel = IdkType.list[value - 256].getModelNoCheck();
          if (idkModel) {
            models[modelCount++] = idkModel;
          }
        }
        if (value >= 512) {
          const obj = ObjType.list(value - 512);
          const wornModel = obj.getWearModelNoCheck(this.gender);
          if (wornModel) {
            models[modelCount++] = wornModel;
          }
        }
      }
      model = Model.combineForAnim(models, modelCount);
      for (let part = 0;part < 5; part++) {
        if (this.colour[part] === 0) {
          continue;
        }
        model.recolour(ClientPlayer.recol1d[part][0], ClientPlayer.recol1d[part][this.colour[part]]);
        if (part === 1) {
          model.recolour(ClientPlayer.recol2d[0], ClientPlayer.recol2d[this.colour[part]]);
        }
      }
      model.prepareAnim();
      model.calculateNormals(64, 850, -30, -50, -30, true);
      ClientPlayer.modelCache.put(model, hash);
      this.modelCacheKey = hash;
    }
    if (this.lowMemory) {
      return model;
    }
    const tmp = Model.tempModel;
    tmp.set(model, AnimFrame.shareAlpha(primaryTransformId) && AnimFrame.shareAlpha(secondaryTransformId));
    if (primaryTransformId !== -1 && secondaryTransformId !== -1) {
      tmp.maskAnimate(primaryTransformId, secondaryTransformId, SeqType.list[this.primaryAnim].walkmerge);
    } else if (primaryTransformId !== -1) {
      tmp.animate(primaryTransformId);
    }
    tmp.calcBoundingCylinder();
    tmp.labelFaces = null;
    tmp.labelVertices = null;
    return tmp;
  }
  getHeadModel() {
    if (!this.ready) {
      return null;
    }
    let needsModel = false;
    for (let i = 0;i < 12; i++) {
      const part = this.appearance[i];
      if (part >= 256 && part < 512 && !IdkType.list[part - 256].checkHead()) {
        needsModel = true;
      }
      if (part >= 512 && !ObjType.list(part - 512).checkHeadModel(this.gender)) {
        needsModel = true;
      }
    }
    if (needsModel) {
      return null;
    }
    const models = new TypedArray1d(12, null);
    let modelCount = 0;
    for (let part = 0;part < 12; part++) {
      const value = this.appearance[part];
      if (value >= 256 && value < 512) {
        const idkModel = IdkType.list[value - 256].getHeadNoCheck();
        if (idkModel) {
          models[modelCount++] = idkModel;
        }
      }
      if (value >= 512) {
        const headModel = ObjType.list(value - 512).getHeadModelNoCheck(this.gender);
        if (headModel) {
          models[modelCount++] = headModel;
        }
      }
    }
    const tmp = Model.combineForAnim(models, modelCount);
    for (let part = 0;part < 5; part++) {
      if (this.colour[part] === 0) {
        continue;
      }
      tmp.recolour(ClientPlayer.recol1d[part][0], ClientPlayer.recol1d[part][this.colour[part]]);
      if (part === 1) {
        tmp.recolour(ClientPlayer.recol2d[0], ClientPlayer.recol2d[this.colour[part]]);
      }
    }
    return tmp;
  }
  isReady() {
    return this.ready;
  }
}

// src/dash3d/ClientProj.ts
class ClientProj extends ModelSource {
  spotanim;
  level;
  srcX;
  srcZ;
  h1;
  h2;
  t1;
  t2;
  angle;
  startpos;
  target;
  mobile = false;
  x = 0;
  z = 0;
  y = 0;
  velocityX = 0;
  velocityZ = 0;
  velocity = 0;
  velocityY = 0;
  accelerationY = 0;
  yaw = 0;
  pitch = 0;
  animFrame = 0;
  animCycle = 0;
  constructor(spotanim, level, srcX, h1, srcZ, t1, t2, angle, startpos, target, h2) {
    super();
    this.spotanim = SpotType.list[spotanim];
    this.level = level;
    this.srcX = srcX;
    this.srcZ = srcZ;
    this.h1 = h1;
    this.t1 = t1;
    this.t2 = t2;
    this.angle = angle;
    this.startpos = startpos;
    this.target = target;
    this.h2 = h2;
    this.mobile = false;
  }
  setTarget(dstX, dstY, dstZ, cycle) {
    if (!this.mobile) {
      const dx = dstX - this.srcX;
      const dz = dstZ - this.srcZ;
      const d = Math.sqrt(dx * dx + dz * dz);
      this.x = this.srcX + dx * this.startpos / d;
      this.z = this.srcZ + dz * this.startpos / d;
      this.y = this.h1;
    }
    const dt = this.t2 + 1 - cycle;
    this.velocityX = (dstX - this.x) / dt;
    this.velocityZ = (dstZ - this.z) / dt;
    this.velocity = Math.sqrt(this.velocityX * this.velocityX + this.velocityZ * this.velocityZ);
    if (!this.mobile) {
      this.velocityY = -this.velocity * Math.tan(this.angle * 0.02454369);
    }
    this.accelerationY = (dstY - this.y - this.velocityY * dt) * 2 / (dt * dt);
  }
  move(delta) {
    this.mobile = true;
    this.x += this.velocityX * delta;
    this.z += this.velocityZ * delta;
    this.y += this.velocityY * delta + this.accelerationY * 0.5 * delta * delta;
    this.velocityY += this.accelerationY * delta;
    this.yaw = (Math.atan2(this.velocityX, this.velocityZ) * 325.949 + 1024 | 0) & 2047;
    this.pitch = (Math.atan2(this.velocityY, this.velocity) * 325.949 | 0) & 2047;
    if (this.spotanim.seq) {
      this.animCycle += delta;
      while (this.animCycle > this.spotanim.seq.getDuration(this.animFrame)) {
        this.animCycle -= this.spotanim.seq.getDuration(this.animFrame) + 1;
        this.animFrame++;
        if (this.animFrame >= this.spotanim.seq.numFrames) {
          this.animFrame = 0;
        }
      }
    }
  }
  getTempModel() {
    const spotModel = this.spotanim.getTempModel2();
    if (!spotModel) {
      return null;
    }
    let frame = -1;
    if (this.spotanim.seq && this.spotanim.seq.frames) {
      frame = this.spotanim.seq.frames[this.animFrame];
    }
    const model = Model.copyForAnim(spotModel, true, AnimFrame.shareAlpha(frame), false);
    if (frame !== -1) {
      model.prepareAnim();
      model.animate(frame);
      model.labelFaces = null;
      model.labelVertices = null;
    }
    if (this.spotanim.resizeh !== 128 || this.spotanim.resizev !== 128) {
      model.resize(this.spotanim.resizeh, this.spotanim.resizev, this.spotanim.resizeh);
    }
    model.rotateXAxis(this.pitch);
    model.calculateNormals(64 + this.spotanim.ambient, 850 + this.spotanim.contrast, -30, -50, -30, true);
    return model;
  }
}

// src/dash3d/LocChange.ts
class LocChange extends Linkable {
  level = 0;
  layer = 0;
  x = 0;
  z = 0;
  oldType = 0;
  oldAngle = 0;
  oldShape = 0;
  newType = 0;
  newAngle = 0;
  newShape = 0;
  startTime = 0;
  endTime = -1;
}

// src/dash3d/MapSpotAnim.ts
class MapSpotAnim extends ModelSource {
  type;
  level;
  x;
  z;
  y;
  startCycle;
  animComplete = false;
  animFrame = 0;
  animCycle = 0;
  constructor(id, level, x, z, y, cycle, delay) {
    super();
    this.type = SpotType.list[id];
    this.level = level;
    this.x = x;
    this.z = z;
    this.y = y;
    this.startCycle = cycle + delay;
  }
  update(delta) {
    if (!this.type.seq) {
      return;
    }
    for (this.animCycle += delta;this.animCycle > this.type.seq.getDuration(this.animFrame); ) {
      this.animCycle -= this.type.seq.getDuration(this.animFrame) + 1;
      this.animFrame++;
      if (this.animFrame >= this.type.seq.numFrames) {
        this.animFrame = 0;
        this.animComplete = true;
      }
    }
  }
  getTempModel() {
    const tmp = this.type.getTempModel2();
    if (!tmp) {
      return null;
    }
    let frame = -1;
    if (this.type.seq && this.type.seq.frames) {
      frame = this.type.seq.frames[this.animFrame];
    }
    const model = Model.copyForAnim(tmp, true, AnimFrame.shareAlpha(frame), false);
    if (!this.animComplete) {
      model.prepareAnim();
      model.animate(frame);
      model.labelFaces = null;
      model.labelVertices = null;
    }
    if (this.type.resizeh !== 128 || this.type.resizev !== 128) {
      model.resize(this.type.resizeh, this.type.resizev, this.type.resizeh);
    }
    if (this.type.angle !== 0) {
      if (this.type.angle === 90) {
        model.rotate90();
      } else if (this.type.angle === 180) {
        model.rotate90();
        model.rotate90();
      } else if (this.type.angle === 270) {
        model.rotate90();
        model.rotate90();
        model.rotate90();
      }
    }
    model.calculateNormals(64 + this.type.ambient, 850 + this.type.contrast, -30, -50, -30, true);
    return model;
  }
}

// src/util/JavaRandom.ts
var p2_16 = 65536;
var p2_24 = 16777216;
var p2_27 = 134217728;
var p2_31 = 2147483648;
var p2_32 = 4294967296;
var p2_48 = 281474976710656;
var p2_53 = Math.pow(2, 53);
var m2_16 = 65535;
var [c2, c1, c0] = [5, 57068, 58989];
var s2 = 0;
var s1 = 0;
var s0 = 0;
function _next() {
  let carry = 11;
  let r0 = s0 * c0 + carry;
  carry = r0 >>> 16;
  r0 &= m2_16;
  let r1 = s1 * c0 + s0 * c1 + carry;
  carry = r1 >>> 16;
  r1 &= m2_16;
  let r2 = s2 * c0 + s1 * c1 + s0 * c2 + carry;
  r2 &= m2_16;
  [s2, s1, s0] = [r2, r1, r0];
  return s2 * p2_16 + s1;
}
function next_signed(bits) {
  return _next() >> 32 - bits;
}
function next(bits) {
  return _next() >>> 32 - bits;
}
function checkIsPositiveInt(n, r = Number.MAX_SAFE_INTEGER) {
  if (n < 0 || n > r) {
    throw RangeError("number must be > 0");
  }
}

class JavaRandom {
  constructor(seedval) {
    if (typeof seedval === "undefined") {
      seedval = Math.floor(Math.random() * p2_48);
    }
    this.setSeed(seedval);
  }
  setSeed(n) {
    checkIsPositiveInt(n);
    s0 = n & m2_16 ^ c0;
    s1 = n / p2_16 & m2_16 ^ c1;
    s2 = n / p2_32 & m2_16 ^ c2;
  }
  nextInt(bound) {
    if (bound === undefined) {
      return next_signed(32);
    }
    checkIsPositiveInt(bound, 2147483647);
    if ((bound & -bound) === bound) {
      const r = next(31) / p2_31;
      return ~~(bound * r);
    }
    let bits, val;
    do {
      bits = next(31);
      val = bits % bound;
    } while (bits - val + (bound - 1) < 0);
    return val;
  }
  nextLong() {
    const msb = BigInt(next_signed(32));
    const lsb = BigInt(next_signed(32));
    const p2_32n = BigInt(p2_32);
    return msb * p2_32n + lsb;
  }
  nextBoolean() {
    return next(1) != 0;
  }
  nextFloat() {
    return next(24) / p2_24;
  }
  nextDouble() {
    return (p2_27 * next(26) + next(27)) / p2_53;
  }
}

// src/graphics/PixFont.ts
class PixFont extends Linkable2 {
  static CHARSET = `ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!"£$%^&*()-_=+[{]};:'@#~,<.>/?\\| `;
  static CHARCODESET = [];
  charMask = [];
  charMaskWidth = new Int32Array(94);
  charMaskHeight = new Int32Array(94);
  charOffsetX = new Int32Array(94);
  charOffsetY = new Int32Array(94);
  charAdvance = new Int32Array(95);
  drawWidth = new Int32Array(256);
  rand = new JavaRandom(Date.now());
  strikeout = false;
  height2d = 0;
  static {
    const isCapacitor = navigator.userAgent.includes("Capacitor");
    for (let i = 0;i < 256; i++) {
      let c = PixFont.CHARSET.indexOf(String.fromCharCode(i));
      if (isCapacitor) {
        if (c >= 63) {
          c--;
        }
      }
      if (c === -1) {
        c = 74;
      }
      PixFont.CHARCODESET[i] = c;
    }
  }
  static depack(archive, name) {
    const dat = new Packet(archive.read(name + ".dat"));
    const idx = new Packet(archive.read("index.dat"));
    idx.pos = dat.g2() + 4;
    const off = idx.g1();
    if (off > 0) {
      idx.pos += (off - 1) * 3;
    }
    const font = new PixFont;
    for (let i = 0;i < 94; i++) {
      font.charOffsetX[i] = idx.g1();
      font.charOffsetY[i] = idx.g1();
      const w = font.charMaskWidth[i] = idx.g2();
      const h = font.charMaskHeight[i] = idx.g2();
      const type = idx.g1();
      const len = w * h;
      font.charMask[i] = new Int8Array(len);
      if (type === 0) {
        for (let j = 0;j < w * h; j++) {
          font.charMask[i][j] = dat.g1b();
        }
      } else if (type === 1) {
        for (let x = 0;x < w; x++) {
          for (let y = 0;y < h; y++) {
            font.charMask[i][x + y * w] = dat.g1b();
          }
        }
      }
      if (h > font.height2d) {
        font.height2d = h;
      }
      font.charOffsetX[i] = 1;
      font.charAdvance[i] = w + 2;
      {
        let space = 0;
        for (let y = h / 7 | 0;y < h; y++) {
          space += font.charMask[i][y * w];
        }
        if (space <= (h / 7 | 0)) {
          font.charAdvance[i]--;
          font.charOffsetX[i] = 0;
        }
      }
      {
        let space = 0;
        for (let y = h / 7 | 0;y < h; y++) {
          space += font.charMask[i][w + y * w - 1];
        }
        if (space <= (h / 7 | 0)) {
          font.charAdvance[i]--;
        }
      }
    }
    font.charAdvance[94] = font.charAdvance[8];
    for (let i = 0;i < 256; i++) {
      font.drawWidth[i] = font.charAdvance[PixFont.CHARCODESET[i]];
    }
    return font;
  }
  centreString(str, x, y, rgb) {
    if (!str) {
      return;
    }
    x |= 0;
    y |= 0;
    this.drawString(str, x - (this.stringWid(str) / 2 | 0), y, rgb);
  }
  centreStringTag(str, x, y, rgb, shadowed) {
    x |= 0;
    y |= 0;
    this.drawStringTag(str, x - (this.stringWid(str) / 2 | 0), y, rgb, shadowed);
  }
  stringWid(str) {
    if (!str) {
      return 0;
    }
    const length = str.length;
    let w = 0;
    for (let i = 0;i < length; i++) {
      if (str.charAt(i) === "@" && i + 4 < length && str.charAt(i + 4) === "@") {
        i += 4;
      } else {
        w += this.drawWidth[str.charCodeAt(i)];
      }
    }
    return w;
  }
  drawString(str, x, y, rgb) {
    if (!str) {
      return;
    }
    x |= 0;
    y |= 0;
    y -= this.height2d;
    for (let i = 0;i < str.length; i++) {
      const c = PixFont.CHARCODESET[str.charCodeAt(i)];
      if (c !== 94) {
        this.plotLetter(this.charMask[c], x + this.charOffsetX[c], y + this.charOffsetY[c], this.charMaskWidth[c], this.charMaskHeight[c], rgb);
      }
      x += this.charAdvance[c];
    }
  }
  centerStringWave(str, x, y, rgb, phase) {
    if (!str) {
      return;
    }
    x |= 0;
    y |= 0;
    x -= this.stringWid(str) / 2 | 0;
    const offY = y - this.height2d;
    for (let i = 0;i < str.length; i++) {
      const c = PixFont.CHARCODESET[str.charCodeAt(i)];
      if (c != 94) {
        this.plotLetter(this.charMask[c], x + this.charOffsetX[c], offY + this.charOffsetY[c] + (Math.sin(i / 2 + phase / 5) * 5 | 0), this.charMaskWidth[c], this.charMaskHeight[c], rgb);
      }
      x += this.charAdvance[c];
    }
  }
  drawStringTag(str, x, y, rgb, shadowed) {
    x |= 0;
    y |= 0;
    this.strikeout = false;
    const startX = x;
    const length = str.length;
    y -= this.height2d;
    for (let i = 0;i < length; i++) {
      if (str.charAt(i) === "@" && i + 4 < length && str.charAt(i + 4) === "@") {
        const tag = this.updateState(str.substring(i + 1, i + 4));
        if (tag !== -1) {
          rgb = tag;
        }
        i += 4;
      } else {
        const c = PixFont.CHARCODESET[str.charCodeAt(i)];
        if (c !== 94) {
          if (shadowed) {
            this.plotLetter(this.charMask[c], x + this.charOffsetX[c] + 1, y + this.charOffsetY[c] + 1, this.charMaskWidth[c], this.charMaskHeight[c], 0 /* BLACK */);
          }
          this.plotLetter(this.charMask[c], x + this.charOffsetX[c], y + this.charOffsetY[c], this.charMaskWidth[c], this.charMaskHeight[c], rgb);
        }
        x += this.charAdvance[c];
      }
    }
    if (this.strikeout) {
      Pix2D.hline(startX, y + (this.height2d * 0.7 | 0), x - startX, 8388608 /* DARKRED */);
    }
  }
  drawStringAntiMacro(str, x, y, rgb, shadowed, seed) {
    x |= 0;
    y |= 0;
    this.rand.setSeed(seed);
    const rand = (this.rand.nextInt() & 31) + 192;
    const offY = y - this.height2d;
    for (let i = 0;i < str.length; i++) {
      if (str.charAt(i) === "@" && i + 4 < str.length && str.charAt(i + 4) === "@") {
        const tag = this.updateState(str.substring(i + 1, i + 4));
        if (tag !== -1) {
          rgb = tag;
        }
        i += 4;
      } else {
        const c = PixFont.CHARCODESET[str.charCodeAt(i)];
        if (c !== 94) {
          if (shadowed) {
            this.plotLetterTrans(this.charMask[c], x + this.charOffsetX[c] + 1, offY + this.charOffsetY[c] + 1, this.charMaskWidth[c], this.charMaskHeight[c], 0 /* BLACK */, 192);
          }
          this.plotLetterTrans(this.charMask[c], x + this.charOffsetX[c], offY + this.charOffsetY[c], this.charMaskWidth[c], this.charMaskHeight[c], rgb, rand);
        }
        x += this.charAdvance[c];
        if ((this.rand.nextInt() & 3) === 0) {
          x++;
        }
      }
    }
  }
  updateState(tag) {
    if (tag === "red") {
      return 16711680 /* RED */;
    } else if (tag === "gre") {
      return 65280 /* GREEN */;
    } else if (tag === "blu") {
      return 255 /* BLUE */;
    } else if (tag === "yel") {
      return 16776960 /* YELLOW */;
    } else if (tag === "cya") {
      return 65535 /* CYAN */;
    } else if (tag === "mag") {
      return 16711935 /* MAGENTA */;
    } else if (tag === "whi") {
      return 16777215 /* WHITE */;
    } else if (tag === "bla") {
      return 0 /* BLACK */;
    } else if (tag === "lre") {
      return 16748608 /* LIGHTRED */;
    } else if (tag === "dre") {
      return 8388608 /* DARKRED */;
    } else if (tag === "dbl") {
      return 128 /* DARKBLUE */;
    } else if (tag === "or1") {
      return 16756736 /* ORANGE1 */;
    } else if (tag === "or2") {
      return 16740352 /* ORANGE2 */;
    } else if (tag === "or3") {
      return 16723968 /* ORANGE3 */;
    } else if (tag === "gr1") {
      return 12648192 /* GREEN1 */;
    } else if (tag === "gr2") {
      return 8453888 /* GREEN2 */;
    } else if (tag === "gr3") {
      return 4259584 /* GREEN3 */;
    } else {
      if (tag === "str") {
        this.strikeout = true;
      }
      return -1;
    }
  }
  drawStringRight(str, x, y, rgb, shadowed = true) {
    x |= 0;
    y |= 0;
    if (shadowed) {
      this.drawString(str, x - this.stringWid(str) + 1, y + 1, 0 /* BLACK */);
    }
    this.drawString(str, x - this.stringWid(str), y, rgb);
  }
  plotLetter(data, x, y, w, h, rgb) {
    x |= 0;
    y |= 0;
    w |= 0;
    h |= 0;
    let dstOff = x + y * Pix2D.width;
    let dstStep = Pix2D.width - w;
    let srcStep = 0;
    let srcOff = 0;
    if (y < Pix2D.clipMinY) {
      const cutoff = Pix2D.clipMinY - y;
      h -= cutoff;
      y = Pix2D.clipMinY;
      srcOff += cutoff * w;
      dstOff += cutoff * Pix2D.width;
    }
    if (y + h >= Pix2D.clipMaxY) {
      h -= y + h + 1 - Pix2D.clipMaxY;
    }
    if (x < Pix2D.clipMinX) {
      const cutoff = Pix2D.clipMinX - x;
      w -= cutoff;
      x = Pix2D.clipMinX;
      srcOff += cutoff;
      dstOff += cutoff;
      srcStep += cutoff;
      dstStep += cutoff;
    }
    if (x + w >= Pix2D.clipMaxX) {
      const cutoff = x + w + 1 - Pix2D.clipMaxX;
      w -= cutoff;
      srcStep += cutoff;
      dstStep += cutoff;
    }
    if (w > 0 && h > 0) {
      this.plot(Pix2D.pixels, data, rgb, srcOff, dstOff, w, h, dstStep, srcStep);
    }
  }
  plot(dst, src, rgb, srcOff, dstOff, w, h, dstStep, srcStep) {
    w |= 0;
    h |= 0;
    const hw = -(w >> 2);
    w = -(w & 3);
    for (let y = -h;y < 0; y++) {
      for (let x = hw;x < 0; x++) {
        if (src[srcOff++] === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = rgb;
        }
        if (src[srcOff++] === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = rgb;
        }
        if (src[srcOff++] === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = rgb;
        }
        if (src[srcOff++] === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = rgb;
        }
      }
      for (let x = w;x < 0; x++) {
        if (src[srcOff++] === 0) {
          dstOff++;
        } else {
          dst[dstOff++] = rgb;
        }
      }
      dstOff += dstStep;
      srcOff += srcStep;
    }
  }
  plotLetterTrans(data, x, y, w, h, rgb, alpha) {
    x |= 0;
    y |= 0;
    w |= 0;
    h |= 0;
    let dstOff = x + y * Pix2D.width;
    let dstStep = Pix2D.width - w;
    let srcStep = 0;
    let srcOff = 0;
    if (y < Pix2D.clipMinY) {
      const cutoff = Pix2D.clipMinY - y;
      h -= cutoff;
      y = Pix2D.clipMinY;
      srcOff += cutoff * w;
      dstOff += cutoff * Pix2D.width;
    }
    if (y + h >= Pix2D.clipMaxY) {
      h -= y + h + 1 - Pix2D.clipMaxY;
    }
    if (x < Pix2D.clipMinX) {
      const cutoff = Pix2D.clipMinX - x;
      w -= cutoff;
      x = Pix2D.clipMinX;
      srcOff += cutoff;
      dstOff += cutoff;
      srcStep += cutoff;
      dstStep += cutoff;
    }
    if (x + w >= Pix2D.clipMaxX) {
      const cutoff = x + w + 1 - Pix2D.clipMaxX;
      w -= cutoff;
      srcStep += cutoff;
      dstStep += cutoff;
    }
    if (w > 0 && h > 0) {
      this.plotTrans(Pix2D.pixels, data, rgb, srcOff, dstOff, w, h, dstStep, srcStep, alpha);
    }
  }
  plotTrans(dst, src, rgb, srcOff, dstOff, w, h, dstStep, srcStep, alpha) {
    w |= 0;
    h |= 0;
    const mixed = ((rgb & 16711935) * alpha & 4278255360) + ((rgb & 65280) * alpha & 16711680) >> 8;
    const invAlpha = 256 - alpha;
    for (let y = -h;y < 0; y++) {
      for (let x = -w;x < 0; x++) {
        if (src[srcOff++] === 0) {
          dstOff++;
        } else {
          const dstRgb = dst[dstOff];
          dst[dstOff++] = (((dstRgb & 16711935) * invAlpha & 4278255360) + ((dstRgb & 65280) * invAlpha & 16711680) >> 8) + mixed;
        }
      }
      dstOff += dstStep;
      srcOff += srcStep;
    }
  }
}

// src/io/ClientStream.ts
class WorkerWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;
  url;
  binaryType = "arraybuffer";
  readyState = 0;
  onopen = null;
  onclose = null;
  onerror = null;
  onmessage = null;
  _worker;
  _port;
  _listeners = {};
  constructor(url, protocols, onFallback) {
    this.url = url;
    window.__wsdbg?.("worker: creating");
    let worker;
    try {
      worker = new Worker("/mobile/ws-worker.js?v=" + Date.now());
    } catch (e) {
      window.__wsdbg?.("worker: new Worker() threw, falling back");
      const native = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
      onFallback?.(native);
      return;
    }
    this._worker = worker;
    const mc = new MessageChannel;
    this._port = mc.port1;
    mc.port1.onmessage = (e) => this._recv(e.data);
    worker.onerror = (e) => {
      window.__wsdbg?.("worker: onerror – " + (e.message ?? "unknown"));
      worker.terminate();
      const native = protocols ? new WebSocket(url, protocols) : new WebSocket(url);
      onFallback?.(native);
    };
    worker.postMessage({ type: "connect", url, protocols }, [mc.port2]);
    window.__wsdbg?.("worker: postMessage sent");
  }
  _recv(msg) {
    if (msg.type === "dbg") {
      window.__wsdbg?.("worker-side: " + msg.dbg);
      return;
    }
    window.__wsdbg?.("_recv: " + msg.type);
    if (msg.type === "open") {
      this.readyState = WorkerWebSocket.OPEN;
      const ev = new Event("open");
      if (this.onopen)
        this.onopen(ev);
      this._fire("open", ev);
    } else if (msg.type === "message") {
      const ev = new MessageEvent("message", { data: msg.data });
      if (this.onmessage)
        this.onmessage(ev);
      this._fire("message", ev);
    } else if (msg.type === "close") {
      this.readyState = WorkerWebSocket.CLOSED;
      const ev = new CloseEvent("close", { code: msg.code, reason: msg.reason });
      if (this.onclose)
        this.onclose(ev);
      this._fire("close", ev);
      this._worker.terminate();
    } else if (msg.type === "error") {
      this.readyState = WorkerWebSocket.CLOSED;
      const ev = new Event("error");
      if (this.onerror)
        this.onerror(ev);
      this._fire("error", ev);
    }
  }
  _fire(type, ev) {
    (this._listeners[type] ?? []).forEach((fn) => {
      fn(ev);
    });
  }
  addEventListener(type, fn) {
    (this._listeners[type] ??= []).push(fn);
  }
  removeEventListener(type, fn) {
    if (this._listeners[type]) {
      this._listeners[type] = this._listeners[type].filter((f) => f !== fn);
    }
  }
  send(data) {
    this._port.postMessage({ type: "send", data: data.buffer }, [data.buffer]);
  }
  close() {
    this.readyState = WorkerWebSocket.CLOSING;
    this._port.postMessage({ type: "close" });
    this._worker.terminate();
  }
}

class ClientStream {
  socket;
  wsin;
  wsout;
  closed = false;
  ioerror = false;
  static async openSocket(host, secured) {
    const protocol = secured ? "wss" : "ws";
    const url = `${protocol}://${host}`;
    const isIosSafari = /iPad|iPhone|iPod/.test(navigator.userAgent) && !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    if (isIosSafari) {
      return ClientStream.openSocketIos(url);
    }
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, "binary");
      const timer = setTimeout(() => reject(new Error("timeout")), 30000);
      ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve(ws);
      });
      ws.addEventListener("error", () => {
        clearTimeout(timer);
        reject(ws);
      });
    });
  }
  static async openSocketIos(url) {
    window.__wsdbg?.("iOS: starting probe attempt");
    const probe = new WorkerWebSocket(url, "binary");
    const winner = await new Promise((resolve, reject) => {
      let won = false;
      const win = (sock, other) => {
        if (won) {
          sock.close();
          return;
        }
        won = true;
        other?.close();
        resolve(sock);
      };
      const fail = (msg) => {
        if (won)
          return;
        won = true;
        reject(new Error(msg));
      };
      probe.addEventListener("open", () => {
        window.__wsdbg?.("iOS: probe connected");
        win(probe);
      });
      probe.addEventListener("error", () => fail("probe error"));
      probe.addEventListener("close", () => fail("probe closed"));
      setTimeout(() => {
        window.__wsdbg?.("iOS: launching retry after warm-up");
        const retry = new WorkerWebSocket(url, "binary");
        probe.addEventListener("open", () => {
          retry.close();
        });
        retry.addEventListener("open", () => {
          window.__wsdbg?.("iOS: retry connected");
          win(retry, probe);
        });
        retry.addEventListener("error", () => fail("retry error"));
        retry.addEventListener("close", () => fail("retry closed"));
        setTimeout(() => {
          window.__wsdbg?.("iOS: timeout");
          fail("timeout");
        }, 30000);
      }, 4000);
    });
    return winner;
  }
  constructor(socket) {
    socket.onclose = this.onclose;
    socket.onerror = this.onerror;
    this.wsin = new WebSocketReader(socket, 5000);
    this.wsout = new WebSocketWriter(socket, 5000);
    this.socket = socket;
  }
  get host() {
    return this.socket.url.split("/")[2];
  }
  get port() {
    return parseInt(this.socket.url.split(":")[2], 10);
  }
  get available() {
    return this.closed ? 0 : this.wsin.available;
  }
  write(src, len) {
    if (!this.closed) {
      this.wsout.write(src, len);
    }
  }
  async read() {
    return this.closed ? 0 : await this.wsin.read();
  }
  async readBytes(dst, off, len) {
    if (this.closed) {
      return;
    }
    await this.wsin.readBytes(dst, off, len);
  }
  close() {
    this.closed = true;
    this.socket.close();
    this.wsin.close();
    this.wsout.close();
  }
  onclose = (_event) => {
    if (this.closed) {
      return;
    }
    this.close();
  };
  onerror = (_event) => {
    if (this.closed) {
      return;
    }
    this.ioerror = true;
    this.close();
  };
}

class WebSocketWriter {
  socket;
  limit;
  closed = false;
  ioerror = false;
  constructor(socket, limit) {
    this.socket = socket;
    this.limit = limit;
  }
  write(src, len) {
    if (this.closed) {
      return;
    }
    if (this.ioerror) {
      this.ioerror = false;
      throw new Error;
    }
    if (len > this.limit || src.length > this.limit) {
      throw new Error;
    }
    try {
      this.socket.send(src.slice(0, len));
    } catch (_e) {
      this.ioerror = true;
    }
  }
  close() {
    this.closed = true;
  }
}

class WebSocketEvent {
  bytes;
  position;
  constructor(bytes) {
    this.bytes = bytes;
    this.position = 0;
  }
  get available() {
    return this.bytes.length - this.position;
  }
  get read() {
    return this.bytes[this.position++];
  }
  get len() {
    return this.bytes.length;
  }
}

class WebSocketReader {
  limit;
  queue = [];
  event = null;
  callback = null;
  closed = false;
  total = 0;
  constructor(socket, limit) {
    this.limit = limit;
    socket.binaryType = "arraybuffer";
    socket.onmessage = this.onmessage;
  }
  get available() {
    return this.total;
  }
  onmessage = (e) => {
    if (this.closed) {
      throw new Error;
    }
    const event = new WebSocketEvent(new Uint8Array(e.data));
    this.total += event.available;
    if (this.callback) {
      const cb = this.callback;
      this.callback = null;
      cb(event);
    } else {
      this.queue.push(event);
    }
  };
  async read() {
    if (this.closed) {
      throw new Error;
    }
    return await Promise.race([
      new Promise((resolve) => {
        if (!this.event || this.event.available === 0) {
          this.event = this.queue.shift() ?? null;
        }
        if (this.event && this.event.available > 0) {
          resolve(this.event.read);
          this.total--;
        } else {
          this.callback = (event) => {
            this.event = event;
            this.total--;
            resolve(event.read);
          };
        }
      }),
      new Promise((_, reject) => {
        setTimeout(() => {
          if (this.closed) {
            reject(new Error);
          } else {
            reject(new Error);
          }
        }, 20000);
      })
    ]);
  }
  async readBytes(dst, off, len) {
    if (this.closed) {
      throw new Error;
    }
    for (let i = 0;i < len; i++) {
      dst[off + i] = await this.read();
    }
    return dst;
  }
  close() {
    this.closed = true;
    this.callback = null;
    this.event = null;
    this.queue = [];
  }
}

// src/io/Database.ts
class Database {
  db;
  constructor(db) {
    db.onerror = this.onerror;
    db.onclose = this.onclose;
    this.db = db;
  }
  static async openDatabase() {
    return await new Promise((resolve, reject) => {
      const request = indexedDB.open("lostcity", 1);
      request.onsuccess = (event) => {
        const target = event.target;
        resolve(target.result);
      };
      request.onupgradeneeded = (event) => {
        const target = event.target;
        target.result.createObjectStore("cache");
      };
      request.onerror = (event) => {
        const target = event.target;
        reject(target.result);
      };
    });
  }
  async read(archive, file) {
    return await new Promise((resolve) => {
      const transaction = this.db.transaction("cache", "readonly");
      const store = transaction.objectStore("cache");
      const request = store.get(`${archive}.${file}`);
      request.onsuccess = () => {
        if (request.result) {
          resolve(new Uint8Array(request.result));
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => {
        resolve(undefined);
      };
    });
  }
  async cacheload(name) {
    return await new Promise((resolve) => {
      const transaction = this.db.transaction("cache", "readonly");
      const store = transaction.objectStore("cache");
      const request = store.get(name);
      request.onsuccess = () => {
        if (request.result) {
          resolve(new Uint8Array(request.result));
        } else {
          resolve(undefined);
        }
      };
      request.onerror = () => {
        resolve(undefined);
      };
    });
  }
  async write(archive, file, src) {
    if (src === null) {
      return;
    }
    return await new Promise((resolve, _reject) => {
      const transaction = this.db.transaction("cache", "readwrite");
      const store = transaction.objectStore("cache");
      const request = store.put(src, `${archive}.${file}`);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        resolve();
      };
    });
  }
  async cachesave(name, src) {
    if (src === null) {
      return;
    }
    return await new Promise((resolve, _reject) => {
      const transaction = this.db.transaction("cache", "readwrite");
      const store = transaction.objectStore("cache");
      const request = store.put(src, name);
      request.onsuccess = () => {
        resolve();
      };
      request.onerror = () => {
        resolve();
      };
    });
  }
  onclose = (_event) => {};
  onerror = (_event) => {};
}

// src/io/Isaac.ts
class Isaac {
  count = 0;
  rsl = new Int32Array(256);
  mem = new Int32Array(256);
  a = 0;
  b = 0;
  c = 0;
  constructor(seed) {
    for (let i = 0;i < seed.length; i++) {
      this.rsl[i] = seed[i];
    }
    this.init();
  }
  get nextInt() {
    if (this.count-- === 0) {
      this.isaac();
      this.count = 255;
    }
    return this.rsl[this.count];
  }
  init() {
    let a = 2654435769, b = 2654435769, c = 2654435769, d = 2654435769, e = 2654435769, f = 2654435769, g = 2654435769, h = 2654435769;
    for (let i = 0;i < 4; i++) {
      a ^= b << 11;
      d += a;
      b += c;
      b ^= c >>> 2;
      e += b;
      c += d;
      c ^= d << 8;
      f += c;
      d += e;
      d ^= e >>> 16;
      g += d;
      e += f;
      e ^= f << 10;
      h += e;
      f += g;
      f ^= g >>> 4;
      a += f;
      g += h;
      g ^= h << 8;
      b += g;
      h += a;
      h ^= a >>> 9;
      c += h;
      a += b;
    }
    for (let i = 0;i < 256; i += 8) {
      a += this.rsl[i];
      b += this.rsl[i + 1];
      c += this.rsl[i + 2];
      d += this.rsl[i + 3];
      e += this.rsl[i + 4];
      f += this.rsl[i + 5];
      g += this.rsl[i + 6];
      h += this.rsl[i + 7];
      a ^= b << 11;
      d += a;
      b += c;
      b ^= c >>> 2;
      e += b;
      c += d;
      c ^= d << 8;
      f += c;
      d += e;
      d ^= e >>> 16;
      g += d;
      e += f;
      e ^= f << 10;
      h += e;
      f += g;
      f ^= g >>> 4;
      a += f;
      g += h;
      g ^= h << 8;
      b += g;
      h += a;
      h ^= a >>> 9;
      c += h;
      a += b;
      this.mem[i] = a;
      this.mem[i + 1] = b;
      this.mem[i + 2] = c;
      this.mem[i + 3] = d;
      this.mem[i + 4] = e;
      this.mem[i + 5] = f;
      this.mem[i + 6] = g;
      this.mem[i + 7] = h;
    }
    for (let i = 0;i < 256; i += 8) {
      a += this.mem[i];
      b += this.mem[i + 1];
      c += this.mem[i + 2];
      d += this.mem[i + 3];
      e += this.mem[i + 4];
      f += this.mem[i + 5];
      g += this.mem[i + 6];
      h += this.mem[i + 7];
      a ^= b << 11;
      d += a;
      b += c;
      b ^= c >>> 2;
      e += b;
      c += d;
      c ^= d << 8;
      f += c;
      d += e;
      d ^= e >>> 16;
      g += d;
      e += f;
      e ^= f << 10;
      h += e;
      f += g;
      f ^= g >>> 4;
      a += f;
      g += h;
      g ^= h << 8;
      b += g;
      h += a;
      h ^= a >>> 9;
      c += h;
      a += b;
      this.mem[i] = a;
      this.mem[i + 1] = b;
      this.mem[i + 2] = c;
      this.mem[i + 3] = d;
      this.mem[i + 4] = e;
      this.mem[i + 5] = f;
      this.mem[i + 6] = g;
      this.mem[i + 7] = h;
    }
    this.isaac();
    this.count = 256;
  }
  isaac() {
    this.c++;
    this.b += this.c;
    for (let i = 0;i < 256; i++) {
      const x = this.mem[i];
      const mem = i & 3;
      if (mem === 0) {
        this.a ^= this.a << 13;
      } else if (mem === 1) {
        this.a ^= this.a >>> 6;
      } else if (mem === 2) {
        this.a ^= this.a << 2;
      } else if (mem === 3) {
        this.a ^= this.a >>> 16;
      }
      this.a += this.mem[i + 128 & 255];
      let y;
      this.mem[i] = y = this.mem[x >>> 2 & 255] + this.a + this.b;
      this.rsl[i] = this.b = this.mem[y >>> 8 >>> 2 & 255] + x;
    }
  }
}

// src/io/BZip2.js
var crc32Table = [
  0,
  79764919,
  159529838,
  222504665,
  319059676,
  398814059,
  445009330,
  507990021,
  638119352,
  583659535,
  797628118,
  726387553,
  890018660,
  835552979,
  1015980042,
  944750013,
  1276238704,
  1221641927,
  1167319070,
  1095957929,
  1595256236,
  1540665371,
  1452775106,
  1381403509,
  1780037320,
  1859660671,
  1671105958,
  1733955601,
  2031960084,
  2111593891,
  1889500026,
  1952343757,
  2552477408,
  2632100695,
  2443283854,
  2506133561,
  2334638140,
  2414271883,
  2191915858,
  2254759653,
  3190512472,
  3135915759,
  3081330742,
  3009969537,
  2905550212,
  2850959411,
  2762807018,
  2691435357,
  3560074640,
  3505614887,
  3719321342,
  3648080713,
  3342211916,
  3287746299,
  3467911202,
  3396681109,
  4063920168,
  4143685023,
  4223187782,
  4286162673,
  3779000052,
  3858754371,
  3904687514,
  3967668269,
  881225847,
  809987520,
  1023691545,
  969234094,
  662832811,
  591600412,
  771767749,
  717299826,
  311336399,
  374308984,
  453813921,
  533576470,
  25881363,
  88864420,
  134795389,
  214552010,
  2023205639,
  2086057648,
  1897238633,
  1976864222,
  1804852699,
  1867694188,
  1645340341,
  1724971778,
  1587496639,
  1516133128,
  1461550545,
  1406951526,
  1302016099,
  1230646740,
  1142491917,
  1087903418,
  2896545431,
  2825181984,
  2770861561,
  2716262478,
  3215044683,
  3143675388,
  3055782693,
  3001194130,
  2326604591,
  2389456536,
  2200899649,
  2280525302,
  2578013683,
  2640855108,
  2418763421,
  2498394922,
  3769900519,
  3832873040,
  3912640137,
  3992402750,
  4088425275,
  4151408268,
  4197601365,
  4277358050,
  3334271071,
  3263032808,
  3476998961,
  3422541446,
  3585640067,
  3514407732,
  3694837229,
  3640369242,
  1762451694,
  1842216281,
  1619975040,
  1682949687,
  2047383090,
  2127137669,
  1938468188,
  2001449195,
  1325665622,
  1271206113,
  1183200824,
  1111960463,
  1543535498,
  1489069629,
  1434599652,
  1363369299,
  622672798,
  568075817,
  748617968,
  677256519,
  907627842,
  853037301,
  1067152940,
  995781531,
  51762726,
  131386257,
  177728840,
  240578815,
  269590778,
  349224269,
  429104020,
  491947555,
  4046411278,
  4126034873,
  4172115296,
  4234965207,
  3794477266,
  3874110821,
  3953728444,
  4016571915,
  3609705398,
  3555108353,
  3735388376,
  3664026991,
  3290680682,
  3236090077,
  3449943556,
  3378572211,
  3174993278,
  3120533705,
  3032266256,
  2961025959,
  2923101090,
  2868635157,
  2813903052,
  2742672763,
  2604032198,
  2683796849,
  2461293480,
  2524268063,
  2284983834,
  2364738477,
  2175806836,
  2238787779,
  1569362073,
  1498123566,
  1409854455,
  1355396672,
  1317987909,
  1246755826,
  1192025387,
  1137557660,
  2072149281,
  2135122070,
  1912620623,
  1992383480,
  1753615357,
  1816598090,
  1627664531,
  1707420964,
  295390185,
  358241886,
  404320391,
  483945776,
  43990325,
  106832002,
  186451547,
  266083308,
  932423249,
  861060070,
  1041341759,
  986742920,
  613929101,
  542559546,
  756411363,
  701822548,
  3316196985,
  3244833742,
  3425377559,
  3370778784,
  3601682597,
  3530312978,
  3744426955,
  3689838204,
  3819031489,
  3881883254,
  3928223919,
  4007849240,
  4037393693,
  4100235434,
  4180117107,
  4259748804,
  2310601993,
  2373574846,
  2151335527,
  2231098320,
  2596047829,
  2659030626,
  2470359227,
  2550115596,
  2947551409,
  2876312838,
  2788305887,
  2733848168,
  3165939309,
  3094707162,
  3040238851,
  2985771188
];
var masks = [
  0,
  1,
  3,
  7,
  15,
  31,
  63,
  127,
  255,
  511,
  1023,
  2047,
  4095,
  8191,
  16383,
  32767,
  65535,
  131071,
  262143,
  524287,
  1048575,
  2097151,
  4194303,
  8388607,
  16777215,
  33554431,
  67108863,
  134217727,
  268435455,
  536870911,
  1073741823,
  -2147483648
];
function createOrderedHuffmanTable(lengths) {
  const z = [];
  for (let i = 0;i < lengths.length; i += 1) {
    z.push([i, lengths[i]]);
  }
  z.push([lengths.length, -1]);
  const table = [];
  let start = z[0][0];
  let bits = z[0][1];
  for (let i = 0;i < z.length; i += 1) {
    const finish = z[i][0];
    const endbits = z[i][1];
    if (bits) {
      for (let code = start;code < finish; code += 1) {
        table.push({ code, bits, symbol: undefined });
      }
    }
    start = finish;
    bits = endbits;
    if (endbits === -1) {
      break;
    }
  }
  table.sort((a, b) => a.bits - b.bits || a.code - b.code);
  let tempBits = 0;
  let symbol = -1;
  const fastAccess = [];
  let current;
  for (let i = 0;i < table.length; i += 1) {
    const t = table[i];
    symbol += 1;
    if (t.bits !== tempBits) {
      symbol <<= t.bits - tempBits;
      tempBits = t.bits;
      current = fastAccess[tempBits] = {};
    }
    t.symbol = symbol;
    current[symbol] = t;
  }
  return {
    table,
    fastAccess
  };
}
function bwtReverse(src, primary) {
  if (primary < 0 || primary >= src.length) {
    throw RangeError("Out of bound");
  }
  const unsorted = src.slice();
  src.sort((a, b) => a - b);
  const start = {};
  for (let i2 = src.length - 1;i2 >= 0; i2 -= 1) {
    start[src[i2]] = i2;
  }
  const links = [];
  for (let i2 = 0;i2 < src.length; i2 += 1) {
    links.push(start[unsorted[i2]]++);
  }
  let i;
  const first = src[i = primary];
  const ret = [];
  for (let j = 1;j < src.length; j += 1) {
    const x = src[i = links[i]];
    if (x === undefined) {
      ret.push(255);
    } else {
      ret.push(x);
    }
  }
  ret.push(first);
  ret.reverse();
  return ret;
}
function bunzip2(bytes, checkMagic = false, checkCRC = false) {
  let index = 0;
  let bitfield = 0;
  let bits = 0;
  const read = (n) => {
    if (n >= 32) {
      const nd = n >> 1;
      return read(nd) * (1 << nd) + read(n - nd);
    }
    while (bits < n) {
      bitfield = (bitfield << 8) + bytes[index];
      index += 1;
      bits += 8;
    }
    const m = masks[n];
    const r = bitfield >> bits - n & m;
    bits -= n;
    bitfield &= ~(m << bits);
    return r;
  };
  let blocksize = 1;
  if (checkMagic) {
    const magic = read(16);
    if (magic !== 16986) {
      throw new Error("Invalid magic");
    }
    const method = read(8);
    if (method !== 104) {
      throw new Error("Invalid method");
    }
    blocksize = read(8);
    if (blocksize >= 49 && blocksize <= 57) {
      blocksize -= 48;
    } else {
      throw new Error("Invalid blocksize");
    }
  }
  let out = new Uint8Array(bytes.length * 1.5);
  let outIndex = 0;
  let newCRC = -1;
  while (true) {
    const blocktype = read(48);
    const crc = read(32) | 0;
    if (blocktype === 54156738319193) {
      if (read(1)) {
        throw new Error("do not support randomised");
      }
      const pointer = read(24);
      const used = [];
      const usedGroups = read(16);
      for (let i2 = 1 << 15;i2 > 0; i2 >>= 1) {
        if (!(usedGroups & i2)) {
          for (let j = 0;j < 16; j += 1) {
            used.push(false);
          }
          continue;
        }
        const usedChars = read(16);
        for (let j = 1 << 15;j > 0; j >>= 1) {
          used.push(!!(usedChars & j));
        }
      }
      const groups = read(3);
      if (groups < 2 || groups > 6) {
        throw new Error("Invalid number of huffman groups");
      }
      const selectorsUsed = read(15);
      const selectors = [];
      const mtf = Array.from({ length: groups }, (_, i2) => i2);
      for (let i2 = 0;i2 < selectorsUsed; i2 += 1) {
        let c = 0;
        while (read(1)) {
          c += 1;
          if (c >= groups) {
            throw new Error("MTF table out of range");
          }
        }
        const v = mtf[c];
        for (let j = c;j > 0; mtf[j] = mtf[--j]) {}
        selectors.push(v);
        mtf[0] = v;
      }
      const symbolsInUse = used.reduce((a, b) => a + b, 0) + 2;
      const tables = [];
      for (let i2 = 0;i2 < groups; i2 += 1) {
        let length = read(5);
        const lengths = [];
        for (let j = 0;j < symbolsInUse; j += 1) {
          if (length < 0 || length > 20) {
            throw new Error("Huffman group length outside range");
          }
          while (read(1)) {
            length -= read(1) * 2 - 1;
          }
          lengths.push(length);
        }
        tables.push(createOrderedHuffmanTable(lengths));
      }
      const favourites = [];
      for (let i2 = 0;i2 < used.length - 1; i2 += 1) {
        if (used[i2]) {
          favourites.push(i2);
        }
      }
      let decoded = 0;
      let selectorPointer = 0;
      let t;
      let r;
      let repeat = 0;
      let repeatPower = 0;
      const buffer = [];
      while (true) {
        decoded -= 1;
        if (decoded <= 0) {
          decoded = 50;
          if (selectorPointer <= selectors.length) {
            t = tables[selectors[selectorPointer]];
            selectorPointer += 1;
          }
        }
        for (const b in t.fastAccess) {
          if (!Object.prototype.hasOwnProperty.call(t.fastAccess, b)) {
            continue;
          }
          if (bits < b) {
            bitfield = (bitfield << 8) + bytes[index];
            index += 1;
            bits += 8;
          }
          r = t.fastAccess[b][bitfield >> bits - b];
          if (r) {
            bitfield &= masks[bits -= b];
            r = r.code;
            break;
          }
        }
        if (r >= 0 && r <= 1) {
          if (repeat === 0) {
            repeatPower = 1;
          }
          repeat += repeatPower << r;
          repeatPower <<= 1;
          continue;
        } else {
          const v = favourites[0];
          for (;repeat > 0; repeat -= 1) {
            buffer.push(v);
          }
        }
        if (r === symbolsInUse - 1) {
          break;
        } else {
          const v = favourites[r - 1];
          for (let j = r - 1;j > 0; favourites[j] = favourites[--j]) {}
          favourites[0] = v;
          buffer.push(v);
        }
      }
      const nt = bwtReverse(buffer, pointer);
      let i = 0;
      while (i < nt.length) {
        const c = nt[i];
        let count = 1;
        if (i < nt.length - 4 && nt[i + 1] === c && nt[i + 2] === c && nt[i + 3] === c) {
          count = nt[i + 4] + 4;
          i += 5;
        } else {
          i += 1;
        }
        if (outIndex + count >= out.length) {
          const old = out;
          out = new Uint8Array(old.length * 2);
          out.set(old);
        }
        for (let j = 0;j < count; j += 1) {
          if (checkCRC) {
            newCRC = newCRC << 8 ^ crc32Table[(newCRC >> 24 ^ c) & 255];
          }
          out[outIndex] = c;
          outIndex += 1;
        }
      }
      if (checkCRC) {
        const calculatedCRC = newCRC ^ -1;
        if (calculatedCRC !== crc) {
          throw new Error(`CRC mismatch: ${calculatedCRC} !== ${crc}`);
        }
        newCRC = -1;
      }
    } else if (blocktype === 25779555029136) {
      read(bits & 7);
      break;
    } else {
      throw new Error("Invalid bz2 blocktype");
    }
  }
  return out.subarray(0, outIndex);
}

// src/io/Jagfile.ts
class Jagfile {
  static genHash(name) {
    let hash = 0;
    name = name.toUpperCase();
    for (let i = 0;i < name.length; i++) {
      hash = hash * 61 + name.charCodeAt(i) - 32 | 0;
    }
    return hash;
  }
  data;
  unpacked;
  fileCount;
  fileHash;
  fileUnpackedSize;
  filePackedSize;
  fileOffset;
  fileUnpacked = [];
  constructor(src) {
    let data = new Packet(new Uint8Array(src));
    const unpackedSize = data.g3();
    const packedSize = data.g3();
    if (unpackedSize === packedSize) {
      this.data = src;
      this.unpacked = false;
    } else {
      this.data = bunzip2(src.subarray(6));
      data = new Packet(new Uint8Array(this.data));
      this.unpacked = true;
    }
    this.fileCount = data.g2();
    this.fileHash = [];
    this.fileUnpackedSize = [];
    this.filePackedSize = [];
    this.fileOffset = [];
    let offset = data.pos + this.fileCount * 10;
    for (let i = 0;i < this.fileCount; i++) {
      this.fileHash.push(data.g4());
      this.fileUnpackedSize.push(data.g3());
      this.filePackedSize.push(data.g3());
      this.fileOffset.push(offset);
      offset += this.filePackedSize[i];
    }
  }
  read(name) {
    const hash = Jagfile.genHash(name);
    const index = this.fileHash.indexOf(hash);
    if (index === -1) {
      return null;
    }
    return this.readIndex(index);
  }
  readIndex(index) {
    if (index < 0 || index >= this.fileCount) {
      return null;
    }
    if (this.fileUnpacked[index]) {
      return this.fileUnpacked[index];
    }
    const offset = this.fileOffset[index];
    const length = this.filePackedSize[index];
    const src = new Uint8Array(this.data.subarray(offset, offset + length));
    if (this.unpacked) {
      this.fileUnpacked[index] = src;
      return src;
    } else {
      const data = bunzip2(src);
      this.fileUnpacked[index] = data;
      return data;
    }
  }
}

// node_modules/fflate/esm/browser.js
var u8 = Uint8Array;
var u16 = Uint16Array;
var i32 = Int32Array;
var fleb = new u8([0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0]);
var fdeb = new u8([0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13, 0, 0]);
var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
var freb = function(eb, start) {
  var b = new u16(31);
  for (var i = 0;i < 31; ++i) {
    b[i] = start += 1 << eb[i - 1];
  }
  var r = new i32(b[30]);
  for (var i = 1;i < 30; ++i) {
    for (var j = b[i];j < b[i + 1]; ++j) {
      r[j] = j - b[i] << 5 | i;
    }
  }
  return { b, r };
};
var _a = freb(fleb, 2);
var fl = _a.b;
var revfl = _a.r;
fl[28] = 258, revfl[258] = 28;
var _b = freb(fdeb, 0);
var fd = _b.b;
var revfd = _b.r;
var rev = new u16(32768);
for (i = 0;i < 32768; ++i) {
  x = (i & 43690) >> 1 | (i & 21845) << 1;
  x = (x & 52428) >> 2 | (x & 13107) << 2;
  x = (x & 61680) >> 4 | (x & 3855) << 4;
  rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
}
var x;
var i;
var hMap = function(cd, mb, r) {
  var s = cd.length;
  var i2 = 0;
  var l = new u16(mb);
  for (;i2 < s; ++i2) {
    if (cd[i2])
      ++l[cd[i2] - 1];
  }
  var le = new u16(mb);
  for (i2 = 1;i2 < mb; ++i2) {
    le[i2] = le[i2 - 1] + l[i2 - 1] << 1;
  }
  var co;
  if (r) {
    co = new u16(1 << mb);
    var rvb = 15 - mb;
    for (i2 = 0;i2 < s; ++i2) {
      if (cd[i2]) {
        var sv = i2 << 4 | cd[i2];
        var r_1 = mb - cd[i2];
        var v = le[cd[i2] - 1]++ << r_1;
        for (var m = v | (1 << r_1) - 1;v <= m; ++v) {
          co[rev[v] >> rvb] = sv;
        }
      }
    }
  } else {
    co = new u16(s);
    for (i2 = 0;i2 < s; ++i2) {
      if (cd[i2]) {
        co[i2] = rev[le[cd[i2] - 1]++] >> 15 - cd[i2];
      }
    }
  }
  return co;
};
var flt = new u8(288);
for (i = 0;i < 144; ++i)
  flt[i] = 8;
var i;
for (i = 144;i < 256; ++i)
  flt[i] = 9;
var i;
for (i = 256;i < 280; ++i)
  flt[i] = 7;
var i;
for (i = 280;i < 288; ++i)
  flt[i] = 8;
var i;
var fdt = new u8(32);
for (i = 0;i < 32; ++i)
  fdt[i] = 5;
var i;
var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
var max = function(a) {
  var m = a[0];
  for (var i2 = 1;i2 < a.length; ++i2) {
    if (a[i2] > m)
      m = a[i2];
  }
  return m;
};
var bits = function(d, p, m) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
};
var bits16 = function(d, p) {
  var o = p / 8 | 0;
  return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
};
var shft = function(p) {
  return (p + 7) / 8 | 0;
};
var slc = function(v, s, e) {
  if (s == null || s < 0)
    s = 0;
  if (e == null || e > v.length)
    e = v.length;
  return new u8(v.subarray(s, e));
};
var ec = [
  "unexpected EOF",
  "invalid block type",
  "invalid length/literal",
  "invalid distance",
  "stream finished",
  "no stream handler",
  ,
  "no callback",
  "invalid UTF-8 data",
  "extra field too long",
  "date not in range 1980-2099",
  "filename too long",
  "stream finishing",
  "invalid zip data"
];
var err = function(ind, msg, nt) {
  var e = new Error(msg || ec[ind]);
  e.code = ind;
  if (Error.captureStackTrace)
    Error.captureStackTrace(e, err);
  if (!nt)
    throw e;
  return e;
};
var inflt = function(dat, st, buf, dict) {
  var sl = dat.length, dl = dict ? dict.length : 0;
  if (!sl || st.f && !st.l)
    return buf || new u8(0);
  var noBuf = !buf;
  var resize = noBuf || st.i != 2;
  var noSt = st.i;
  if (noBuf)
    buf = new u8(sl * 3);
  var cbuf = function(l2) {
    var bl = buf.length;
    if (l2 > bl) {
      var nbuf = new u8(Math.max(bl * 2, l2));
      nbuf.set(buf);
      buf = nbuf;
    }
  };
  var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
  var tbts = sl * 8;
  do {
    if (!lm) {
      final = bits(dat, pos, 1);
      var type = bits(dat, pos + 1, 3);
      pos += 3;
      if (!type) {
        var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
        if (t > sl) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + l);
        buf.set(dat.subarray(s, t), bt);
        st.b = bt += l, st.p = pos = t * 8, st.f = final;
        continue;
      } else if (type == 1)
        lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
      else if (type == 2) {
        var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
        var tl = hLit + bits(dat, pos + 5, 31) + 1;
        pos += 14;
        var ldt = new u8(tl);
        var clt = new u8(19);
        for (var i2 = 0;i2 < hcLen; ++i2) {
          clt[clim[i2]] = bits(dat, pos + i2 * 3, 7);
        }
        pos += hcLen * 3;
        var clb = max(clt), clbmsk = (1 << clb) - 1;
        var clm = hMap(clt, clb, 1);
        for (var i2 = 0;i2 < tl; ) {
          var r = clm[bits(dat, pos, clbmsk)];
          pos += r & 15;
          var s = r >> 4;
          if (s < 16) {
            ldt[i2++] = s;
          } else {
            var c = 0, n = 0;
            if (s == 16)
              n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i2 - 1];
            else if (s == 17)
              n = 3 + bits(dat, pos, 7), pos += 3;
            else if (s == 18)
              n = 11 + bits(dat, pos, 127), pos += 7;
            while (n--)
              ldt[i2++] = c;
          }
        }
        var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
        lbt = max(lt);
        dbt = max(dt);
        lm = hMap(lt, lbt, 1);
        dm = hMap(dt, dbt, 1);
      } else
        err(1);
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
    }
    if (resize)
      cbuf(bt + 131072);
    var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
    var lpos = pos;
    for (;; lpos = pos) {
      var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
      pos += c & 15;
      if (pos > tbts) {
        if (noSt)
          err(0);
        break;
      }
      if (!c)
        err(2);
      if (sym < 256)
        buf[bt++] = sym;
      else if (sym == 256) {
        lpos = pos, lm = null;
        break;
      } else {
        var add = sym - 254;
        if (sym > 264) {
          var i2 = sym - 257, b = fleb[i2];
          add = bits(dat, pos, (1 << b) - 1) + fl[i2];
          pos += b;
        }
        var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
        if (!d)
          err(3);
        pos += d & 15;
        var dt = fd[dsym];
        if (dsym > 3) {
          var b = fdeb[dsym];
          dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
        }
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (resize)
          cbuf(bt + 131072);
        var end = bt + add;
        if (bt < dt) {
          var shift = dl - dt, dend = Math.min(dt, end);
          if (shift + bt < 0)
            err(3);
          for (;bt < dend; ++bt)
            buf[bt] = dict[shift + bt];
        }
        for (;bt < end; ++bt)
          buf[bt] = buf[bt - dt];
      }
    }
    st.l = lm, st.p = lpos, st.b = bt, st.f = final;
    if (lm)
      final = 1, st.m = lbt, st.d = dm, st.n = dbt;
  } while (!final);
  return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
};
var et = /* @__PURE__ */ new u8(0);
var b2 = function(d, b) {
  return d[b] | d[b + 1] << 8;
};
var b4 = function(d, b) {
  return (d[b] | d[b + 1] << 8 | d[b + 2] << 16 | d[b + 3] << 24) >>> 0;
};
var b8 = function(d, b) {
  return b4(d, b) + b4(d, b + 4) * 4294967296;
};
var gzs = function(d) {
  if (d[0] != 31 || d[1] != 139 || d[2] != 8)
    err(6, "invalid gzip data");
  var flg = d[3];
  var st = 10;
  if (flg & 4)
    st += (d[10] | d[11] << 8) + 2;
  for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1);zs > 0; zs -= !d[st++])
    ;
  return st + (flg & 2);
};
var gzl = function(d) {
  var l = d.length;
  return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
};
function inflateSync(data, opts) {
  return inflt(data, { i: 2 }, opts && opts.out, opts && opts.dictionary);
}
function gunzipSync(data, opts) {
  var st = gzs(data);
  if (st + 8 > data.length)
    err(6, "invalid gzip data");
  return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
}
var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder;
var tds = 0;
try {
  td.decode(et, { stream: true });
  tds = 1;
} catch (e) {}
var dutf8 = function(d) {
  for (var r = "", i2 = 0;; ) {
    var c = d[i2++];
    var eb = (c > 127) + (c > 223) + (c > 239);
    if (i2 + eb > d.length)
      return { s: r, r: slc(d, i2 - 1) };
    if (!eb)
      r += String.fromCharCode(c);
    else if (eb == 3) {
      c = ((c & 15) << 18 | (d[i2++] & 63) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63) - 65536, r += String.fromCharCode(55296 | c >> 10, 56320 | c & 1023);
    } else if (eb & 1)
      r += String.fromCharCode((c & 31) << 6 | d[i2++] & 63);
    else
      r += String.fromCharCode((c & 15) << 12 | (d[i2++] & 63) << 6 | d[i2++] & 63);
  }
};
function strFromU8(dat, latin1) {
  if (latin1) {
    var r = "";
    for (var i2 = 0;i2 < dat.length; i2 += 16384)
      r += String.fromCharCode.apply(null, dat.subarray(i2, i2 + 16384));
    return r;
  } else if (td) {
    return td.decode(dat);
  } else {
    var _a2 = dutf8(dat), s = _a2.s, r = _a2.r;
    if (r.length)
      err(8);
    return s;
  }
}
var slzh = function(d, b) {
  return b + 30 + b2(d, b + 26) + b2(d, b + 28);
};
var zh = function(d, b, z) {
  var fnl = b2(d, b + 28), fn = strFromU8(d.subarray(b + 46, b + 46 + fnl), !(b2(d, b + 8) & 2048)), es = b + 46 + fnl, bs = b4(d, b + 20);
  var _a2 = z && bs == 4294967295 ? z64e(d, es) : [bs, b4(d, b + 24), b4(d, b + 42)], sc = _a2[0], su = _a2[1], off = _a2[2];
  return [b2(d, b + 10), sc, su, fn, es + b2(d, b + 30) + b2(d, b + 32), off];
};
var z64e = function(d, b) {
  for (;b2(d, b) != 1; b += 4 + b2(d, b + 2))
    ;
  return [b8(d, b + 12), b8(d, b + 4), b8(d, b + 20)];
};
function unzipSync(data, opts) {
  var files = {};
  var e = data.length - 22;
  for (;b4(data, e) != 101010256; --e) {
    if (!e || data.length - e > 65558)
      err(13);
  }
  var c = b2(data, e + 8);
  if (!c)
    return {};
  var o = b4(data, e + 16);
  var z = o == 4294967295 || c == 65535;
  if (z) {
    var ze = b4(data, e - 12);
    z = b4(data, ze) == 101075792;
    if (z) {
      c = b4(data, ze + 32);
      o = b4(data, ze + 48);
    }
  }
  var fltr = opts && opts.filter;
  for (var i2 = 0;i2 < c; ++i2) {
    var _a2 = zh(data, o, z), c_2 = _a2[0], sc = _a2[1], su = _a2[2], fn = _a2[3], no = _a2[4], off = _a2[5], b = slzh(data, off);
    o = no;
    if (!fltr || fltr({
      name: fn,
      size: sc,
      originalSize: su,
      compression: c_2
    })) {
      if (!c_2)
        files[fn] = slc(data, b, b + sc);
      else if (c_2 == 8)
        files[fn] = inflateSync(data.subarray(b, b + sc), { out: new u8(su) });
      else
        err(14, "unknown compression type " + c_2);
    }
  }
  return files;
}

// src/io/OnDemandProvider.ts
class OnDemandProvider {
}

// src/io/OnDemandRequest.ts
class OnDemandRequest extends Linkable2 {
  archive = 0;
  file = 0;
  data = null;
  cycle = 0;
  urgent = true;
}

// src/io/OnDemand.ts
class OnDemand extends OnDemandProvider {
  modernized = true;
  zip = null;
  versions = [];
  crcs = [];
  priorities = [];
  topPriority = 0;
  modelUse = [];
  mapIndex = [];
  mapLand = [];
  mapLoc = [];
  mapMembers = [];
  animFrameIndex = [];
  midiJingle = [];
  running = true;
  app;
  active = false;
  importantCount = 0;
  requestCount = 0;
  requests = new LinkList2;
  queue = new LinkList;
  missing = new LinkList;
  pending = new LinkList;
  completed = new LinkList;
  prefetches = new LinkList;
  message = "";
  buf = new Uint8Array(500);
  data = new Uint8Array(65000);
  loadedPrefetchFiles = 0;
  totalPrefetchFiles = 0;
  partOffset = 0;
  partAvailable = 0;
  packetCycle = 0;
  noTimeoutCycle = 0;
  cycle = 0;
  socketOpenTime = 0;
  current = null;
  stream = null;
  constructor(versionlist, app) {
    super();
    const version = ["model_version", "anim_version", "midi_version", "map_version"];
    for (let i2 = 0;i2 < 4; i2++) {
      const data2 = versionlist.read(version[i2]);
      if (!data2) {
        throw new Error;
      }
      const count = data2.length / 2;
      const buf = new Packet(data2);
      this.versions[i2] = new Array(count);
      this.priorities[i2] = new Array(count);
      for (let j = 0;j < count; j++) {
        this.versions[i2][j] = buf.g2();
      }
    }
    const crc = ["model_crc", "anim_crc", "midi_crc", "map_crc"];
    for (let i2 = 0;i2 < 4; i2++) {
      const data2 = versionlist.read(crc[i2]);
      if (!data2) {
        throw new Error;
      }
      const count = data2.length / 4;
      const buf = new Packet(data2);
      this.crcs[i2] = new Array(count);
      for (let j = 0;j < count; j++) {
        this.crcs[i2][j] = buf.g4();
      }
    }
    let data = versionlist.read("model_index");
    if (data) {
      const count = this.versions[0].length;
      this.modelUse = new Array(count);
      for (let i2 = 0;i2 < count; i2++) {
        if (i2 < data.length) {
          this.modelUse[i2] = data[i2];
        } else {
          this.modelUse[i2] = 0;
        }
      }
    }
    data = versionlist.read("map_index");
    if (data) {
      const count = data.length / 7;
      const buf = new Packet(data);
      this.mapIndex = new Array(count);
      this.mapLand = new Array(count);
      this.mapLoc = new Array(count);
      this.mapMembers = new Array(count);
      for (let i2 = 0;i2 < count; i2++) {
        this.mapIndex[i2] = buf.g2();
        this.mapLand[i2] = buf.g2();
        this.mapLoc[i2] = buf.g2();
        this.mapMembers[i2] = buf.g1();
      }
    }
    data = versionlist.read("anim_index");
    if (data) {
      const count = data.length / 2;
      const buf = new Packet(data);
      this.animFrameIndex = new Array(count);
      for (let i2 = 0;i2 < count; i2++) {
        this.animFrameIndex[i2] = buf.g2();
      }
    }
    data = versionlist.read("midi_index");
    if (data) {
      const count = data.length;
      const buf = new Packet(data);
      this.midiJingle = new Array(count);
      for (let i2 = 0;i2 < count; i2++) {
        this.midiJingle[i2] = buf.g1();
      }
    }
    this.app = app;
    this.running = true;
  }
  stop() {
    this.running = false;
  }
  getFileCount(archive) {
    return this.versions[archive].length;
  }
  getAnimFrameCount() {
    return this.animFrameIndex.length;
  }
  getMapFile(x2, z, type) {
    const map = (x2 << 8) + z;
    for (let i2 = 0;i2 < this.mapIndex.length; i2++) {
      if (this.mapIndex[i2] === map) {
        if (type === 0) {
          return this.mapLand[i2];
        } else {
          return this.mapLoc[i2];
        }
      }
    }
    return -1;
  }
  async prefetchMaps(members) {
    const count = this.mapIndex.length;
    for (let i2 = 0;i2 < count; i2++) {
      if (members || this.mapMembers[i2] !== 0) {
        await this.prefetchPriority(3, this.mapLoc[i2], 2);
        await this.prefetchPriority(3, this.mapLand[i2], 2);
      }
    }
  }
  hasMapLocFile(file) {
    for (let i2 = 0;i2 < this.mapIndex.length; i2++) {
      if (this.mapLoc[i2] === file) {
        return true;
      }
    }
    return false;
  }
  getModelUse(id) {
    return this.modelUse[id] & 255;
  }
  isMidiJingle(id) {
    return this.midiJingle[id] === 1;
  }
  requestModel(id) {
    this.request(0, id);
  }
  request(archive, file) {
    if (archive < 0 || archive > this.versions.length || file < 0 || file > this.versions[archive].length || this.versions[archive][file] === 0) {
      return;
    }
    for (let req2 = this.requests.head();req2 !== null; req2 = this.requests.next()) {
      if (req2.archive === archive && req2.file === file) {
        return;
      }
    }
    const req = new OnDemandRequest;
    req.archive = archive;
    req.file = file;
    req.urgent = true;
    this.queue.push(req);
    this.requests.push(req);
  }
  remaining() {
    return this.requests.size();
  }
  loop() {
    const req = this.completed.popFront();
    if (req === null) {
      return null;
    }
    req.unlink2();
    if (req.data === null) {
      return req;
    }
    req.data = gunzipSync(req.data.slice(0, req.data.length - 2));
    return req;
  }
  async prefetchPriority(archive, file, priority) {
    if (!this.app.db || this.versions[archive][file] === 0) {
      return;
    }
    const data = await this.app.db.read(archive + 1, file);
    if (this.validate(data, this.crcs[archive][file], this.versions[archive][file])) {
      return;
    }
    this.priorities[archive][file] = priority;
    if (priority > this.topPriority) {
      this.topPriority = priority;
    }
    this.totalPrefetchFiles++;
  }
  clearPrefetches() {
    this.prefetches.clear();
  }
  prefetch(archive, file) {
    if (!this.app.db || this.versions[archive][file] === 0 || this.priorities[archive][file] === 0 || this.topPriority === 0) {
      return;
    }
    const req = new OnDemandRequest;
    req.archive = archive;
    req.file = file;
    req.urgent = false;
    this.prefetches.push(req);
  }
  async run() {
    if (!this.running) {
      return;
    }
    this.cycle++;
    this.active = true;
    for (let i2 = 0;i2 < 100 && this.active; i2++) {
      this.active = false;
      await this.handleQueue();
      await this.handlePending();
      if (this.importantCount === 0 && i2 >= 5) {
        break;
      }
      await this.handleExtras();
      await this.read();
    }
    let loading = false;
    for (let req = this.pending.head();req !== null; req = this.pending.next()) {
      if (req.urgent) {
        loading = true;
        req.cycle++;
        if (req.cycle > 50) {
          req.cycle = 0;
          await this.send(req);
        }
      }
    }
    if (!loading) {
      for (let req = this.pending.head();req !== null; req = this.pending.next()) {
        loading = true;
        req.cycle++;
        if (req.cycle > 50) {
          req.cycle = 0;
          await this.send(req);
        }
      }
    }
    if (loading) {
      this.packetCycle++;
      if (this.packetCycle > 750) {
        if (this.stream) {
          this.stream.close();
          this.stream = null;
        }
        this.partAvailable = 0;
      }
    } else {
      this.packetCycle = 0;
      this.message = "";
    }
    if (this.app.ingame && this.stream && (this.topPriority > 0 || !this.app.db)) {
      this.noTimeoutCycle++;
      if (this.noTimeoutCycle > 500) {
        this.noTimeoutCycle = 0;
        this.buf[0] = 0;
        this.buf[1] = 0;
        this.buf[2] = 0;
        this.buf[3] = 10;
        this.stream.write(this.buf, 4);
      }
    }
  }
  async handleQueue() {
    let req = this.queue.popFront();
    while (req !== null) {
      this.active = true;
      let data;
      if (this.app.db) {
        data = await this.app.db.read(req.archive + 1, req.file);
      }
      if (!this.validate(data, this.crcs[req.archive][req.file], this.versions[req.archive][req.file])) {
        data = undefined;
      }
      if (!data) {
        this.missing.push(req);
      } else {
        req.data = data;
        this.completed.push(req);
      }
      req = this.queue.popFront();
    }
  }
  async handlePending() {
    this.importantCount = 0;
    this.requestCount = 0;
    for (let req = this.pending.head();req !== null; req = this.pending.next()) {
      if (req.urgent) {
        this.importantCount++;
      } else {
        this.requestCount++;
      }
    }
    while (this.importantCount < 10) {
      const req = this.missing.popFront();
      if (req === null) {
        break;
      }
      if (this.priorities[req.archive][req.file] !== 0) {
        this.loadedPrefetchFiles++;
      }
      this.priorities[req.archive][req.file] = 0;
      this.pending.push(req);
      this.importantCount++;
      await this.send(req);
      this.active = true;
    }
  }
  async handleExtras() {
    while (this.importantCount === 0 && this.requestCount < 10) {
      if (this.topPriority === 0) {
        return;
      }
      let extra = this.prefetches.popFront();
      while (extra !== null) {
        if (this.priorities[extra.archive][extra.file] !== 0) {
          this.priorities[extra.archive][extra.file] = 0;
          this.pending.push(extra);
          await this.send(extra);
          this.active = true;
          if (this.loadedPrefetchFiles < this.totalPrefetchFiles) {
            this.loadedPrefetchFiles++;
          }
          this.message = "Loading extra files - " + (this.loadedPrefetchFiles * 100 / this.totalPrefetchFiles | 0) + "%";
          this.requestCount++;
          if (this.requestCount === 10) {
            return;
          }
        }
        extra = this.prefetches.popFront();
      }
      for (let archive = 0;archive < 4; archive++) {
        const priorities = this.priorities[archive];
        const count = priorities.length;
        for (let i2 = 0;i2 < count; i2++) {
          if (priorities[i2] === this.topPriority) {
            priorities[i2] = 0;
            const req = new OnDemandRequest;
            req.archive = archive;
            req.file = i2;
            req.urgent = false;
            this.pending.push(req);
            await this.send(req);
            this.active = true;
            if (this.loadedPrefetchFiles < this.totalPrefetchFiles) {
              this.loadedPrefetchFiles++;
            }
            this.message = "Loading extra files - " + (this.loadedPrefetchFiles * 100 / this.totalPrefetchFiles | 0) + "%";
            this.requestCount++;
            if (this.requestCount === 10) {
              return;
            }
          }
        }
      }
      this.topPriority--;
    }
  }
  async read() {
    if (this.modernized) {
      for (let req = this.pending.head();req !== null; req = this.pending.next()) {
        this.current = req;
        break;
      }
      if (this.current) {
        await this.downloadZip();
        if (!this.zip) {
          return;
        }
        this.current.data = this.zip[`${this.current.archive + 1}.${this.current.file}`];
        if (!this.current.data) {
          this.current.unlink();
          this.current = null;
          return;
        }
        if (this.app.db) {
          await this.app.db.write(this.current.archive + 1, this.current.file, this.current.data);
        }
        if (!this.current.urgent && this.current.archive === 3) {
          this.current.urgent = true;
          this.current.archive = 93;
        }
        if (this.current.urgent) {
          this.completed.push(this.current);
        } else {
          this.current.unlink();
        }
        this.current = null;
      }
    } else {
      if (!this.stream) {
        return;
      }
      try {
        const available = this.stream.available;
        if (this.partAvailable === 0 && available >= 6) {
          this.active = true;
          await this.stream.readBytes(this.buf, 0, 6);
          const archive = this.buf[0] & 255;
          const file = ((this.buf[1] & 255) << 8) + (this.buf[2] & 255);
          const size = ((this.buf[3] & 255) << 8) + (this.buf[4] & 255);
          const part = this.buf[5] & 255;
          this.current = null;
          for (let req = this.pending.head();req !== null; req = this.pending.next()) {
            if (req.archive === archive && req.file === file) {
              this.current = req;
            }
            if (this.current !== null) {
              req.cycle = 0;
            }
          }
          if (this.current) {
            this.packetCycle = 0;
            if (size === 0) {
              console.error("rej: " + archive + "," + file);
              this.current.data = null;
              if (this.current.urgent) {
                this.completed.push(this.current);
              } else {
                this.current.unlink();
              }
              this.current = null;
            } else {
              if (this.current.data === null && part === 0) {
                this.current.data = new Uint8Array(size);
              }
              if (this.current.data === null && part !== 0) {
                console.error("missing start of file");
                throw new Error;
              }
            }
          }
          this.partOffset = part * 500;
          this.partAvailable = 500;
          if (this.partAvailable > size - part * 500) {
            this.partAvailable = size - part * 500;
          }
        }
        if (this.partAvailable > 0 && available >= this.partAvailable) {
          this.active = true;
          let dst = this.buf;
          let off = 0;
          if (this.current && this.current.data) {
            dst = this.current.data;
            off = this.partOffset;
          }
          await this.stream.readBytes(dst, off, this.partAvailable);
          if (this.partAvailable + this.partOffset >= dst.length && this.current) {
            if (this.app.db) {
              await this.app.db.write(this.current.archive + 1, this.current.file, dst);
            }
            if (!this.current.urgent && this.current.archive === 3) {
              this.current.urgent = true;
              this.current.archive = 93;
            }
            if (this.current.urgent) {
              this.completed.push(this.current);
            } else {
              this.current.unlink();
            }
          }
          this.partAvailable = 0;
        }
      } catch (e) {
        console.error(e);
        if (this.stream) {
          this.stream.close();
        }
        this.stream = null;
        this.partAvailable = 0;
      }
    }
  }
  validate(src, expectedCrc, expectedVersion) {
    if (typeof src === "undefined" || src.length < 2) {
      return false;
    }
    const trailerPos = src.length - 2;
    const version = ((src[trailerPos] & 255) << 8) + (src[trailerPos + 1] & 255);
    const crc = Packet.getcrc(src, 0, src.length - 2);
    return version === expectedVersion && crc === expectedCrc;
  }
  async send(req) {
    if (this.modernized) {
      return;
    }
    try {
      if (this.stream === null) {
        const now = performance.now();
        if (now - this.socketOpenTime < 5000) {
          return;
        }
        this.socketOpenTime = now;
        this.stream = new ClientStream(await ClientStream.openSocket(window.location.host, window.location.protocol === "https:"));
        this.buf[0] = 15;
        this.stream.write(this.buf, 1);
        for (let i2 = 0;i2 < 8; i2++) {
          await this.stream.read();
        }
        this.packetCycle = 0;
      }
      this.buf[0] = req.archive;
      this.buf[1] = req.file >> 8;
      this.buf[2] = req.file;
      if (req.urgent) {
        this.buf[3] = 2;
      } else if (this.app.ingame) {
        this.buf[3] = 0;
      } else {
        this.buf[3] = 1;
      }
      this.stream.write(this.buf, 4);
      this.noTimeoutCycle = 0;
    } catch (e) {
      console.error(e);
      this.stream = null;
      this.partAvailable = 0;
    }
  }
  async downloadZip() {
    while (!this.zip) {
      try {
        this.zip = unzipSync(await downloadUrl("/ondemand.zip"));
        break;
      } catch (_) {
        await sleep(1000);
      }
    }
  }
  async prefetchAll() {
    let success = false;
    for (let retry = 0;retry < 3 && !success; retry++) {
      if (!this.app.db) {
        return;
      }
      const remote = await downloadUrl("/build");
      const local = await this.app.db.cacheload("build");
      if (typeof local !== "undefined" && local[0] === remote[0] && local[1] === remote[1] && local[2] === remote[2] && local[3] === remote[3]) {
        break;
      }
      await this.app.db.cachesave("build", remote);
      try {
        const zip = unzipSync(await downloadUrl("/ondemand.zip"));
        const start = performance.now();
        for (let archive = 0;archive < 4; archive++) {
          const count = this.versions[archive].length;
          for (let file = 0;file < count; file++) {
            const data = zip[`${archive + 1}.${file}`];
            if (typeof data === "undefined") {
              continue;
            }
            const existing = await this.app.db.read(archive + 1, file);
            if (!existing || !this.validate(existing, this.crcs[archive][file], this.versions[archive][file])) {
              await this.app.db.write(archive + 1, file, data);
            }
            if (file % 100 === 0 && performance.now() - start > 15000) {
              this.app.db = null;
              return;
            }
          }
        }
        success = true;
      } catch (e) {
        console.error(e);
      }
    }
  }
}

// src/io/ServerProt.ts
var ServerProtSizes = [
  6,
  0,
  0,
  4,
  0,
  0,
  0,
  0,
  7,
  0,
  0,
  0,
  0,
  0,
  4,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  3,
  5,
  0,
  6,
  -2,
  0,
  4,
  0,
  0,
  0,
  0,
  0,
  0,
  15,
  4,
  0,
  0,
  -2,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  6,
  0,
  0,
  1,
  0,
  -1,
  -2,
  0,
  -2,
  6,
  0,
  0,
  0,
  0,
  0,
  4,
  0,
  0,
  -1,
  0,
  1,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  0,
  -2,
  2,
  0,
  0,
  3,
  0,
  0,
  1,
  4,
  0,
  0,
  7,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  9,
  0,
  0,
  6,
  3,
  0,
  0,
  0,
  0,
  5,
  0,
  0,
  -2,
  0,
  0,
  0,
  6,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  6,
  0,
  1,
  0,
  0,
  2,
  0,
  2,
  0,
  0,
  10,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  0,
  2,
  0,
  2,
  2,
  0,
  0,
  0,
  2,
  0,
  -2,
  0,
  0,
  2,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  3,
  2,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  6,
  2,
  0,
  0,
  0,
  0,
  0,
  0,
  -1,
  0,
  0,
  0,
  0,
  4,
  0,
  4,
  0,
  3,
  0,
  0,
  0,
  0,
  14,
  0,
  0,
  0,
  6,
  0,
  0,
  4,
  0,
  3,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  0,
  2,
  0,
  0,
  4,
  0,
  0,
  0,
  0,
  0,
  0,
  4,
  0,
  0,
  0,
  0,
  0,
  1,
  0
];

// src/wordenc/WordFilter.ts
class WordFilter {
  static PERIOD = new Uint16Array(["d", "o", "t"].join("").split("").map((char) => char.charCodeAt(0)));
  static AMPERSAT = new Uint16Array(["(", "a", ")"].join("").split("").map((char) => char.charCodeAt(0)));
  static SLASH = new Uint16Array(["s", "l", "a", "s", "h"].join("").split("").map((char) => char.charCodeAt(0)));
  static whitelist = ["cook", "cook's", "cooks", "seeks", "sheet", "woop", "woops", "faq"];
  static tlds = [];
  static tldTypes = [];
  static bads = [];
  static badCombinations = [];
  static domains = [];
  static fragments = [];
  static unpack(wordenc) {
    const fragments = new Packet(wordenc.read("fragmentsenc.txt"));
    const bad = new Packet(wordenc.read("badenc.txt"));
    const domain = new Packet(wordenc.read("domainenc.txt"));
    const tld = new Packet(wordenc.read("tldlist.txt"));
    this.read(bad, domain, fragments, tld);
  }
  static filter(input) {
    const characters = [...input];
    this.format(characters);
    const trimmed = characters.join("").trim();
    const lowercase = trimmed.toLowerCase();
    const filtered = [...lowercase];
    this.filterTlds(filtered);
    this.filterBadWords(filtered);
    this.filterDomains(filtered);
    this.filterFragments(filtered);
    for (let index = 0;index < this.whitelist.length; index++) {
      let offset = -1;
      while ((offset = lowercase.indexOf(this.whitelist[index], offset + 1)) !== -1) {
        const whitelisted = [...this.whitelist[index]];
        for (let charIndex = 0;charIndex < whitelisted.length; charIndex++) {
          filtered[charIndex + offset] = whitelisted[charIndex];
        }
      }
    }
    this.replaceUppercases(filtered, [...trimmed]);
    this.formatUppercases(filtered);
    return filtered.join("").trim();
  }
  static read(bad, domain, fragments, tld) {
    this.readBadWords(bad);
    this.readDomains(domain);
    this.readFragments(fragments);
    this.readTld(tld);
  }
  static readTld(packet) {
    const count = packet.g4();
    for (let index = 0;index < count; index++) {
      this.tldTypes[index] = packet.g1();
      this.tlds[index] = new Uint16Array(packet.g1()).map(() => packet.g1());
    }
  }
  static readBadWords(packet) {
    const count = packet.g4();
    for (let index = 0;index < count; index++) {
      this.bads[index] = new Uint16Array(packet.g1()).map(() => packet.g1());
      const combos = new Array(packet.g1()).fill([]).map(() => [packet.g1b(), packet.g1b()]);
      if (combos.length > 0) {
        this.badCombinations[index] = combos;
      }
    }
  }
  static readDomains(packet) {
    const count = packet.g4();
    for (let index = 0;index < count; index++) {
      this.domains[index] = new Uint16Array(packet.g1()).map(() => packet.g1());
    }
  }
  static readFragments(packet) {
    const count = packet.g4();
    for (let index = 0;index < count; index++) {
      this.fragments[index] = packet.g2();
    }
  }
  static filterTlds(chars) {
    const period = [...chars];
    const slash = [...chars];
    this.filterBadCombinations(null, period, this.PERIOD);
    this.filterBadCombinations(null, slash, this.SLASH);
    for (let index = 0;index < this.tlds.length; index++) {
      this.filterTld(slash, this.tldTypes[index], chars, this.tlds[index], period);
    }
  }
  static filterBadWords(chars) {
    for (let comboIndex = 0;comboIndex < 2; comboIndex++) {
      for (let index = this.bads.length - 1;index >= 0; index--) {
        this.filterBadCombinations(this.badCombinations[index], chars, this.bads[index]);
      }
    }
  }
  static filterDomains(chars) {
    const ampersat = [...chars];
    const period = [...chars];
    this.filterBadCombinations(null, ampersat, this.AMPERSAT);
    this.filterBadCombinations(null, period, this.PERIOD);
    for (let index = this.domains.length - 1;index >= 0; index--) {
      this.filterDomain(period, ampersat, this.domains[index], chars);
    }
  }
  static filterFragments(chars) {
    for (let currentIndex = 0;currentIndex < chars.length; ) {
      const numberIndex = this.indexOfNumber(chars, currentIndex);
      if (numberIndex === -1) {
        return;
      }
      let isSymbolOrNotLowercaseAlpha = false;
      for (let index = currentIndex;index >= 0 && index < numberIndex && !isSymbolOrNotLowercaseAlpha; index++) {
        if (!this.isSymbol(chars[index]) && !this.isNotLowercaseAlpha(chars[index])) {
          isSymbolOrNotLowercaseAlpha = true;
        }
      }
      let startIndex = 0;
      if (isSymbolOrNotLowercaseAlpha) {
        startIndex = 0;
      }
      if (startIndex === 0) {
        startIndex = 1;
        currentIndex = numberIndex;
      }
      let value = 0;
      for (let index = numberIndex;index < chars.length && index < currentIndex; index++) {
        value = value * 10 + chars[index].charCodeAt(0) - 48;
      }
      if (value <= 255 && currentIndex - numberIndex <= 8) {
        startIndex++;
      } else {
        startIndex = 0;
      }
      if (startIndex === 4) {
        this.maskChars(numberIndex, currentIndex, chars);
        startIndex = 0;
      }
      currentIndex = this.indexOfNonNumber(currentIndex, chars);
    }
  }
  static isBadFragment(chars) {
    if (this.isNumericalChars(chars)) {
      return true;
    }
    const value = this.getInteger(chars);
    const fragments = this.fragments;
    const fragmentsLength = fragments.length;
    if (value === fragments[0] || value === fragments[fragmentsLength - 1]) {
      return true;
    }
    let start = 0;
    let end = fragmentsLength - 1;
    while (start <= end) {
      const mid = (start + end) / 2 | 0;
      if (value === fragments[mid]) {
        return true;
      } else if (value < fragments[mid]) {
        end = mid - 1;
      } else {
        start = mid + 1;
      }
    }
    return false;
  }
  static getInteger(chars) {
    if (chars.length > 6) {
      return 0;
    }
    let value = 0;
    for (let index = 0;index < chars.length; index++) {
      const char = chars[chars.length - index - 1];
      if (this.isLowercaseAlpha(char)) {
        value = value * 38 + char.charCodeAt(0) + 1 - 97;
      } else if (char === "'") {
        value = value * 38 + 27;
      } else if (this.isNumerical(char)) {
        value = value * 38 + char.charCodeAt(0) + 28 - 48;
      } else if (char !== "\x00") {
        return 0;
      }
    }
    return value;
  }
  static indexOfNumber(chars, offset) {
    for (let index = offset;index < chars.length && index >= 0; index++) {
      if (this.isNumerical(chars[index])) {
        return index;
      }
    }
    return -1;
  }
  static indexOfNonNumber(offset, chars) {
    for (let index = offset;index < chars.length && index >= 0; index++) {
      if (!this.isNumerical(chars[index])) {
        return index;
      }
    }
    return chars.length;
  }
  static getEmulatedDomainCharLen(nextChar, domainChar, currentChar) {
    if (domainChar === currentChar) {
      return 1;
    } else if (domainChar === "o" && currentChar === "0") {
      return 1;
    } else if (domainChar === "o" && currentChar === "(" && nextChar === ")") {
      return 2;
    } else if (domainChar === "c" && (currentChar === "(" || currentChar === "<" || currentChar === "[")) {
      return 1;
    } else if (domainChar === "e" && currentChar === "€") {
      return 1;
    } else if (domainChar === "s" && currentChar === "$") {
      return 1;
    } else if (domainChar === "l" && currentChar === "i") {
      return 1;
    }
    return 0;
  }
  static filterDomain(period, ampersat, domain, chars) {
    const domainLength = domain.length;
    const charsLength = chars.length;
    for (let index = 0;index <= charsLength - domainLength; index++) {
      const { matched, currentIndex } = this.findMatchingDomain(index, domain, chars);
      if (!matched) {
        continue;
      }
      const ampersatStatus = this.prefixSymbolStatus(index, chars, 3, ampersat, ["@"]);
      const periodStatus = this.suffixSymbolStatus(currentIndex - 1, chars, 3, period, [".", ","]);
      const shouldFilter = ampersatStatus > 2 || periodStatus > 2;
      if (!shouldFilter) {
        continue;
      }
      this.maskChars(index, currentIndex, chars);
    }
  }
  static findMatchingDomain(startIndex, domain, chars) {
    const domainLength = domain.length;
    let currentIndex = startIndex;
    let domainIndex = 0;
    while (currentIndex < chars.length && domainIndex < domainLength) {
      const currentChar = chars[currentIndex];
      const nextChar = currentIndex + 1 < chars.length ? chars[currentIndex + 1] : "\x00";
      const currentLength = this.getEmulatedDomainCharLen(nextChar, String.fromCharCode(domain[domainIndex]), currentChar);
      if (currentLength > 0) {
        currentIndex += currentLength;
        domainIndex++;
      } else {
        if (domainIndex === 0)
          break;
        const previousLength = this.getEmulatedDomainCharLen(nextChar, String.fromCharCode(domain[domainIndex - 1]), currentChar);
        if (previousLength > 0) {
          currentIndex += previousLength;
          if (domainIndex === 1)
            startIndex++;
        } else {
          if (domainIndex >= domainLength || !this.isSymbol(currentChar))
            break;
          currentIndex++;
        }
      }
    }
    return { matched: domainIndex >= domainLength, currentIndex };
  }
  static filterBadCombinations(combos, chars, bads) {
    if (bads.length > chars.length) {
      return;
    }
    for (let startIndex = 0;startIndex <= chars.length - bads.length; startIndex++) {
      let currentIndex = startIndex;
      const { currentIndex: updatedCurrentIndex, badIndex, hasSymbol, hasNumber, hasDigit } = this.processBadCharacters(chars, bads, currentIndex);
      currentIndex = updatedCurrentIndex;
      let currentChar = chars[currentIndex];
      let nextChar = currentIndex + 1 < chars.length ? chars[currentIndex + 1] : "\x00";
      if (!(badIndex >= bads.length && (!hasNumber || !hasDigit))) {
        continue;
      }
      let shouldFilter = true;
      let localIndex;
      if (hasSymbol) {
        let isBeforeSymbol = false;
        let isAfterSymbol = false;
        if (startIndex - 1 < 0 || this.isSymbol(chars[startIndex - 1]) && chars[startIndex - 1] !== "'") {
          isBeforeSymbol = true;
        }
        if (currentIndex >= chars.length || this.isSymbol(chars[currentIndex]) && chars[currentIndex] !== "'") {
          isAfterSymbol = true;
        }
        if (!isBeforeSymbol || !isAfterSymbol) {
          let isSubstringValid = false;
          localIndex = startIndex - 2;
          if (isBeforeSymbol) {
            localIndex = startIndex;
          }
          while (!isSubstringValid && localIndex < currentIndex) {
            if (localIndex >= 0 && (!this.isSymbol(chars[localIndex]) || chars[localIndex] === "'")) {
              const localSubString = [];
              let localSubStringIndex;
              for (localSubStringIndex = 0;localSubStringIndex < 3 && localIndex + localSubStringIndex < chars.length && (!this.isSymbol(chars[localIndex + localSubStringIndex]) || chars[localIndex + localSubStringIndex] === "'"); localSubStringIndex++) {
                localSubString[localSubStringIndex] = chars[localIndex + localSubStringIndex];
              }
              let isSubStringValidCondition = true;
              if (localSubStringIndex === 0) {
                isSubStringValidCondition = false;
              }
              if (localSubStringIndex < 3 && localIndex - 1 >= 0 && (!this.isSymbol(chars[localIndex - 1]) || chars[localIndex - 1] === "'")) {
                isSubStringValidCondition = false;
              }
              if (isSubStringValidCondition && !this.isBadFragment(localSubString)) {
                isSubstringValid = true;
              }
            }
            localIndex++;
          }
          if (!isSubstringValid) {
            shouldFilter = false;
          }
        }
      } else {
        currentChar = " ";
        if (startIndex - 1 >= 0) {
          currentChar = chars[startIndex - 1];
        }
        nextChar = " ";
        if (currentIndex < chars.length) {
          nextChar = chars[currentIndex];
        }
        const current = this.getIndex(currentChar);
        const next2 = this.getIndex(nextChar);
        if (combos && this.comboMatches(current, combos, next2)) {
          shouldFilter = false;
        }
      }
      if (!shouldFilter) {
        continue;
      }
      let numeralCount = 0;
      let alphaCount = 0;
      for (let index = startIndex;index < currentIndex; index++) {
        if (this.isNumerical(chars[index])) {
          numeralCount++;
        } else if (this.isAlpha(chars[index])) {
          alphaCount++;
        }
      }
      if (numeralCount <= alphaCount) {
        this.maskChars(startIndex, currentIndex, chars);
      }
    }
  }
  static processBadCharacters(chars, bads, startIndex) {
    let index = startIndex;
    let badIndex = 0;
    let count = 0;
    let hasSymbol = false;
    let hasNumber = false;
    let hasDigit = false;
    for (;index < chars.length && !(hasNumber && hasDigit); ) {
      if (index >= chars.length || hasNumber && hasDigit) {
        break;
      }
      const currentChar = chars[index];
      const nextChar = index + 1 < chars.length ? chars[index + 1] : "\x00";
      let currentLength;
      if (badIndex < bads.length && (currentLength = this.getEmulatedBadCharLen(nextChar, String.fromCharCode(bads[badIndex]), currentChar)) > 0) {
        if (currentLength === 1 && this.isNumerical(currentChar)) {
          hasNumber = true;
        }
        if (currentLength === 2 && (this.isNumerical(currentChar) || this.isNumerical(nextChar))) {
          hasNumber = true;
        }
        index += currentLength;
        badIndex++;
      } else {
        if (badIndex === 0) {
          break;
        }
        let previousLength;
        if ((previousLength = this.getEmulatedBadCharLen(nextChar, String.fromCharCode(bads[badIndex - 1]), currentChar)) > 0) {
          index += previousLength;
        } else {
          if (badIndex >= bads.length || !this.isNotLowercaseAlpha(currentChar)) {
            break;
          }
          if (this.isSymbol(currentChar) && currentChar !== "'") {
            hasSymbol = true;
          }
          if (this.isNumerical(currentChar)) {
            hasDigit = true;
          }
          index++;
          count++;
          if ((count * 100 / (index - startIndex) | 0) > 90) {
            break;
          }
        }
      }
    }
    return { currentIndex: index, badIndex, hasSymbol, hasNumber, hasDigit };
  }
  static getEmulatedBadCharLen(nextChar, badChar, currentChar) {
    if (badChar === currentChar) {
      return 1;
    }
    if (badChar >= "a" && badChar <= "m") {
      if (badChar === "a") {
        if (currentChar !== "4" && currentChar !== "@" && currentChar !== "^") {
          if (currentChar === "/" && nextChar === "\\") {
            return 2;
          }
          return 0;
        }
        return 1;
      }
      if (badChar === "b") {
        if (currentChar !== "6" && currentChar !== "8") {
          if (currentChar === "1" && nextChar === "3") {
            return 2;
          }
          return 0;
        }
        return 1;
      }
      if (badChar === "c") {
        if (currentChar !== "(" && currentChar !== "<" && currentChar !== "{" && currentChar !== "[") {
          return 0;
        }
        return 1;
      }
      if (badChar === "d") {
        if (currentChar === "[" && nextChar === ")") {
          return 2;
        }
        return 0;
      }
      if (badChar === "e") {
        if (currentChar !== "3" && currentChar !== "€") {
          return 0;
        }
        return 1;
      }
      if (badChar === "f") {
        if (currentChar === "p" && nextChar === "h") {
          return 2;
        }
        if (currentChar === "£") {
          return 1;
        }
        return 0;
      }
      if (badChar === "g") {
        if (currentChar !== "9" && currentChar !== "6") {
          return 0;
        }
        return 1;
      }
      if (badChar === "h") {
        if (currentChar === "#") {
          return 1;
        }
        return 0;
      }
      if (badChar === "i") {
        if (currentChar !== "y" && currentChar !== "l" && currentChar !== "j" && currentChar !== "1" && currentChar !== "!" && currentChar !== ":" && currentChar !== ";" && currentChar !== "|") {
          return 0;
        }
        return 1;
      }
      if (badChar === "j") {
        return 0;
      }
      if (badChar === "k") {
        return 0;
      }
      if (badChar === "l") {
        if (currentChar !== "1" && currentChar !== "|" && currentChar !== "i") {
          return 0;
        }
        return 1;
      }
      if (badChar === "m") {
        return 0;
      }
    }
    if (badChar >= "n" && badChar <= "z") {
      if (badChar === "n") {
        return 0;
      }
      if (badChar === "o") {
        if (currentChar !== "0" && currentChar !== "*") {
          if ((currentChar !== "(" || nextChar !== ")") && (currentChar !== "[" || nextChar !== "]") && (currentChar !== "{" || nextChar !== "}") && (currentChar !== "<" || nextChar !== ">")) {
            return 0;
          }
          return 2;
        }
        return 1;
      }
      if (badChar === "p") {
        return 0;
      }
      if (badChar === "q") {
        return 0;
      }
      if (badChar === "r") {
        return 0;
      }
      if (badChar === "s") {
        if (currentChar !== "5" && currentChar !== "z" && currentChar !== "$" && currentChar !== "2") {
          return 0;
        }
        return 1;
      }
      if (badChar === "t") {
        if (currentChar !== "7" && currentChar !== "+") {
          return 0;
        }
        return 1;
      }
      if (badChar === "u") {
        if (currentChar === "v") {
          return 1;
        }
        if ((currentChar !== "\\" || nextChar !== "/") && (currentChar !== "\\" || nextChar !== "|") && (currentChar !== "|" || nextChar !== "/")) {
          return 0;
        }
        return 2;
      }
      if (badChar === "v") {
        if ((currentChar !== "\\" || nextChar !== "/") && (currentChar !== "\\" || nextChar !== "|") && (currentChar !== "|" || nextChar !== "/")) {
          return 0;
        }
        return 2;
      }
      if (badChar === "w") {
        if (currentChar === "v" && nextChar === "v") {
          return 2;
        }
        return 0;
      }
      if (badChar === "x") {
        if ((currentChar !== ")" || nextChar !== "(") && (currentChar !== "}" || nextChar !== "{") && (currentChar !== "]" || nextChar !== "[") && (currentChar !== ">" || nextChar !== "<")) {
          return 0;
        }
        return 2;
      }
      if (badChar === "y") {
        return 0;
      }
      if (badChar === "z") {
        return 0;
      }
    }
    if (badChar >= "0" && badChar <= "9") {
      if (badChar === "0") {
        if (currentChar === "o" || currentChar === "O") {
          return 1;
        } else if ((currentChar !== "(" || nextChar !== ")") && (currentChar !== "{" || nextChar !== "}") && (currentChar !== "[" || nextChar !== "]")) {
          return 0;
        } else {
          return 2;
        }
      } else if (badChar === "1") {
        return currentChar === "l" ? 1 : 0;
      } else {
        return 0;
      }
    } else if (badChar === ",") {
      return currentChar === "." ? 1 : 0;
    } else if (badChar === ".") {
      return currentChar === "," ? 1 : 0;
    } else if (badChar === "!") {
      return currentChar === "i" ? 1 : 0;
    }
    return 0;
  }
  static comboMatches(currentIndex, combos, nextIndex) {
    let start = 0;
    let end = combos.length - 1;
    while (start <= end) {
      const mid = (start + end) / 2 | 0;
      if (combos[mid][0] === currentIndex && combos[mid][1] === nextIndex) {
        return true;
      } else if (currentIndex < combos[mid][0] || currentIndex === combos[mid][0] && nextIndex < combos[mid][1]) {
        end = mid - 1;
      } else {
        start = mid + 1;
      }
    }
    return false;
  }
  static getIndex(char) {
    if (this.isLowercaseAlpha(char)) {
      return char.charCodeAt(0) + 1 - 97;
    } else if (char === "'") {
      return 28;
    } else if (this.isNumerical(char)) {
      return char.charCodeAt(0) + 29 - 48;
    }
    return 27;
  }
  static filterTld(slash, tldType, chars, tld, period) {
    if (tld.length > chars.length) {
      return;
    }
    for (let index = 0;index <= chars.length - tld.length; index++) {
      const { currentIndex, tldIndex } = this.processTlds(chars, tld, index);
      if (tldIndex < tld.length) {
        continue;
      }
      let shouldFilter = false;
      const periodFilterStatus = this.prefixSymbolStatus(index, chars, 3, period, [",", "."]);
      const slashFilterStatus = this.suffixSymbolStatus(currentIndex - 1, chars, 5, slash, ["\\", "/"]);
      if (tldType === 1 && periodFilterStatus > 0 && slashFilterStatus > 0) {
        shouldFilter = true;
      }
      if (tldType === 2 && (periodFilterStatus > 2 && slashFilterStatus > 0 || periodFilterStatus > 0 && slashFilterStatus > 2)) {
        shouldFilter = true;
      }
      if (tldType === 3 && periodFilterStatus > 0 && slashFilterStatus > 2) {
        shouldFilter = true;
      }
      if (!shouldFilter) {
        continue;
      }
      let startFilterIndex = index;
      let endFilterIndex = currentIndex - 1;
      let foundPeriod = false;
      let periodIndex;
      if (periodFilterStatus > 2) {
        if (periodFilterStatus === 4) {
          foundPeriod = false;
          for (periodIndex = index - 1;periodIndex >= 0; periodIndex--) {
            if (foundPeriod) {
              if (period[periodIndex] !== "*") {
                break;
              }
              startFilterIndex = periodIndex;
            } else if (period[periodIndex] === "*") {
              startFilterIndex = periodIndex;
              foundPeriod = true;
            }
          }
        }
        foundPeriod = false;
        for (periodIndex = startFilterIndex - 1;periodIndex >= 0; periodIndex--) {
          if (foundPeriod) {
            if (this.isSymbol(chars[periodIndex])) {
              break;
            }
            startFilterIndex = periodIndex;
          } else if (!this.isSymbol(chars[periodIndex])) {
            foundPeriod = true;
            startFilterIndex = periodIndex;
          }
        }
      }
      if (slashFilterStatus > 2) {
        if (slashFilterStatus === 4) {
          foundPeriod = false;
          for (periodIndex = endFilterIndex + 1;periodIndex < chars.length; periodIndex++) {
            if (foundPeriod) {
              if (slash[periodIndex] !== "*") {
                break;
              }
              endFilterIndex = periodIndex;
            } else if (slash[periodIndex] === "*") {
              endFilterIndex = periodIndex;
              foundPeriod = true;
            }
          }
        }
        foundPeriod = false;
        for (periodIndex = endFilterIndex + 1;periodIndex < chars.length; periodIndex++) {
          if (foundPeriod) {
            if (this.isSymbol(chars[periodIndex])) {
              break;
            }
            endFilterIndex = periodIndex;
          } else if (!this.isSymbol(chars[periodIndex])) {
            foundPeriod = true;
            endFilterIndex = periodIndex;
          }
        }
      }
      this.maskChars(startFilterIndex, endFilterIndex + 1, chars);
    }
  }
  static processTlds(chars, tld, currentIndex) {
    let tldIndex = 0;
    while (currentIndex < chars.length && tldIndex < tld.length) {
      const currentChar = chars[currentIndex];
      const nextChar = currentIndex + 1 < chars.length ? chars[currentIndex + 1] : "\x00";
      let currentLength;
      if ((currentLength = this.getEmulatedDomainCharLen(nextChar, String.fromCharCode(tld[tldIndex]), currentChar)) > 0) {
        currentIndex += currentLength;
        tldIndex++;
      } else {
        if (tldIndex === 0) {
          break;
        }
        let previousLength;
        if ((previousLength = this.getEmulatedDomainCharLen(nextChar, String.fromCharCode(tld[tldIndex - 1]), currentChar)) > 0) {
          currentIndex += previousLength;
        } else {
          if (!this.isSymbol(currentChar)) {
            break;
          }
          currentIndex++;
        }
      }
    }
    return { currentIndex, tldIndex };
  }
  static isSymbol(char) {
    return !this.isAlpha(char) && !this.isNumerical(char);
  }
  static isNotLowercaseAlpha(char) {
    return this.isLowercaseAlpha(char) ? char === "v" || char === "x" || char === "j" || char === "q" || char === "z" : true;
  }
  static isAlpha(char) {
    return this.isLowercaseAlpha(char) || this.isUppercaseAlpha(char);
  }
  static isNumerical(char) {
    return char >= "0" && char <= "9";
  }
  static isLowercaseAlpha(char) {
    return char >= "a" && char <= "z";
  }
  static isUppercaseAlpha(char) {
    return char >= "A" && char <= "Z";
  }
  static isNumericalChars(chars) {
    for (let index = 0;index < chars.length; index++) {
      if (!this.isNumerical(chars[index]) && chars[index] !== "\x00") {
        return false;
      }
    }
    return true;
  }
  static maskChars(offset, length, chars) {
    for (let index = offset;index < length; index++) {
      chars[index] = "*";
    }
  }
  static maskedCountBackwards(chars, offset) {
    let count = 0;
    for (let index = offset - 1;index >= 0 && this.isSymbol(chars[index]); index--) {
      if (chars[index] === "*") {
        count++;
      }
    }
    return count;
  }
  static maskedCountForwards(chars, offset) {
    let count = 0;
    for (let index = offset + 1;index < chars.length && this.isSymbol(chars[index]); index++) {
      if (chars[index] === "*") {
        count++;
      }
    }
    return count;
  }
  static maskedCharsStatus(chars, filtered, offset, length, prefix) {
    const count = prefix ? this.maskedCountBackwards(filtered, offset) : this.maskedCountForwards(filtered, offset);
    if (count >= length) {
      return 4;
    } else if (this.isSymbol(prefix ? chars[offset - 1] : chars[offset + 1])) {
      return 1;
    }
    return 0;
  }
  static prefixSymbolStatus(offset, chars, length, symbolChars, symbols) {
    if (offset === 0) {
      return 2;
    }
    for (let index = offset - 1;index >= 0 && this.isSymbol(chars[index]); index--) {
      if (symbols.includes(chars[index])) {
        return 3;
      }
    }
    return this.maskedCharsStatus(chars, symbolChars, offset, length, true);
  }
  static suffixSymbolStatus(offset, chars, length, symbolChars, symbols) {
    if (offset + 1 === chars.length) {
      return 2;
    }
    for (let index = offset + 1;index < chars.length && this.isSymbol(chars[index]); index++) {
      if (symbols.includes(chars[index])) {
        return 3;
      }
    }
    return this.maskedCharsStatus(chars, symbolChars, offset, length, false);
  }
  static format(chars) {
    let pos = 0;
    for (let index = 0;index < chars.length; index++) {
      if (this.isCharacterAllowed(chars[index])) {
        chars[pos] = chars[index];
      } else {
        chars[pos] = " ";
      }
      if (pos === 0 || chars[pos] !== " " || chars[pos - 1] !== " ") {
        pos++;
      }
    }
    for (let index = pos;index < chars.length; index++) {
      chars[index] = " ";
    }
  }
  static isCharacterAllowed(char) {
    return char >= " " && char <= "" || char === " " || char === `
` || char === "\t" || char === "£" || char === "€";
  }
  static replaceUppercases(chars, comparison) {
    for (let index = 0;index < comparison.length; index++) {
      if (chars[index] !== "*" && this.isUppercaseAlpha(comparison[index])) {
        chars[index] = comparison[index];
      }
    }
  }
  static formatUppercases(chars) {
    let flagged = true;
    for (let index = 0;index < chars.length; index++) {
      const char = chars[index];
      if (!this.isAlpha(char)) {
        flagged = true;
      } else if (flagged) {
        if (this.isLowercaseAlpha(char)) {
          flagged = false;
        }
      } else if (this.isUppercaseAlpha(char)) {
        chars[index] = String.fromCharCode(char.charCodeAt(0) + 97 - 65);
      }
    }
  }
}

// src/wordenc/WordPack.ts
class WordPack {
  static TABLE = [
    " ",
    "e",
    "t",
    "a",
    "o",
    "i",
    "h",
    "n",
    "s",
    "r",
    "d",
    "l",
    "u",
    "m",
    "w",
    "c",
    "y",
    "f",
    "g",
    "p",
    "b",
    "v",
    "k",
    "x",
    "j",
    "q",
    "z",
    "0",
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    " ",
    "!",
    "?",
    ".",
    ",",
    ":",
    ";",
    "(",
    ")",
    "-",
    "&",
    "*",
    "\\",
    "'",
    "@",
    "#",
    "+",
    "=",
    "£",
    "$",
    "%",
    '"',
    "[",
    "]"
  ];
  static charBuffer = [];
  static unpack(word, length) {
    let pos = 0;
    let carry = -1;
    let nibble;
    for (let index = 0;index < length && pos < 100; index++) {
      const value = word.g1();
      nibble = value >> 4 & 15;
      if (carry !== -1) {
        this.charBuffer[pos++] = this.TABLE[(carry << 4) + nibble - 195];
        carry = -1;
      } else if (nibble < 13) {
        this.charBuffer[pos++] = this.TABLE[nibble];
      } else {
        carry = nibble;
      }
      nibble = value & 15;
      if (carry !== -1) {
        this.charBuffer[pos++] = this.TABLE[(carry << 4) + nibble - 195];
        carry = -1;
      } else if (nibble < 13) {
        this.charBuffer[pos++] = this.TABLE[nibble];
      } else {
        carry = nibble;
      }
    }
    let uppercase = true;
    for (let index = 0;index < pos; index++) {
      const char = this.charBuffer[index];
      if (uppercase && char >= "a" && char <= "z") {
        this.charBuffer[index] = char.toUpperCase();
        uppercase = false;
      }
      if (char === "." || char === "!") {
        uppercase = true;
      }
    }
    return this.charBuffer.slice(0, pos).join("");
  }
  static pack(word, str) {
    if (str.length > 80) {
      str = str.substring(0, 80);
    }
    str = str.toLowerCase();
    let carry = -1;
    for (let index = 0;index < str.length; index++) {
      const char = str.charAt(index);
      let currentChar = 0;
      for (let lookupIndex = 0;lookupIndex < this.TABLE.length; lookupIndex++) {
        if (char === this.TABLE[lookupIndex]) {
          currentChar = lookupIndex;
          break;
        }
      }
      if (currentChar > 12) {
        currentChar += 195;
      }
      if (carry === -1) {
        if (currentChar < 13) {
          carry = currentChar;
        } else {
          word.p1(currentChar);
        }
      } else if (currentChar < 13) {
        word.p1((carry << 4) + currentChar);
        carry = -1;
      } else {
        word.p1((carry << 4) + (currentChar >> 4));
        carry = currentChar & 15;
      }
    }
    if (carry !== -1) {
      word.p1(carry << 4);
    }
  }
}

// src/sound/Envelope.ts
class Envelope {
  length = 2;
  shapeDelta = new Int32Array(2);
  shapePeak = new Int32Array(2);
  start = 0;
  end = 0;
  form = 0;
  threshold = 0;
  position = 0;
  delta = 0;
  amplitude = 0;
  ticks = 0;
  constructor() {
    this.shapeDelta[0] = 0;
    this.shapeDelta[1] = 65535;
    this.shapePeak[0] = 0;
    this.shapePeak[1] = 65535;
  }
  load(dat) {
    this.form = dat.g1();
    this.start = dat.g4();
    this.end = dat.g4();
    this.length = dat.g1();
    this.shapeDelta = new Int32Array(this.length);
    this.shapePeak = new Int32Array(this.length);
    for (let i2 = 0;i2 < this.length; i2++) {
      this.shapeDelta[i2] = dat.g2();
      this.shapePeak[i2] = dat.g2();
    }
  }
  genInit() {
    this.threshold = 0;
    this.position = 0;
    this.delta = 0;
    this.amplitude = 0;
    this.ticks = 0;
  }
  genNext(delta) {
    if (this.ticks >= this.threshold) {
      this.amplitude = this.shapePeak[this.position++] << 15;
      if (this.position >= this.length) {
        this.position = this.length - 1;
      }
      this.threshold = this.shapeDelta[this.position] / 65536 * delta | 0;
      if (this.threshold > this.ticks) {
        this.delta = ((this.shapePeak[this.position] << 15) - this.amplitude) / (this.threshold - this.ticks) | 0;
      }
    }
    this.amplitude += this.delta;
    this.ticks++;
    return this.amplitude - this.delta >> 15;
  }
}

// src/sound/Tone.ts
class Tone {
  frequencyBase = new Envelope;
  amplitudeBase = new Envelope;
  frequencyModRate = null;
  frequencyModRange = null;
  amplitudeModRate = null;
  amplitudeModRange = null;
  release = null;
  attack = null;
  harmonicVolume = new Int32Array(5);
  harmonicSemitone = new Int32Array(5);
  harmonicDelay = new Int32Array(5);
  reverbDelay = 0;
  reverbVolume = 100;
  length = 500;
  start = 0;
  static buf = new Int32Array(22050 * 10);
  static noise = new Int32Array(32768);
  static sine = new Int32Array(32768);
  static fPos = new Int32Array(5);
  static fDel = new Int32Array(5);
  static fAmp = new Int32Array(5);
  static fMulti = new Int32Array(5);
  static fOffset = new Int32Array(5);
  static {
    const rand = new JavaRandom(0);
    for (let i2 = 0;i2 < 32768; i2++) {
      this.noise[i2] = (rand.nextInt() & 2) - 1;
    }
    for (let i2 = 0;i2 < 32768; i2++) {
      this.sine[i2] = Math.sin(i2 / 5215.1903) * 16384 | 0;
    }
  }
  generate(sampleCount, length) {
    for (let sample = 0;sample < sampleCount; sample++) {
      Tone.buf[sample] = 0;
    }
    if (length < 10) {
      return Tone.buf;
    }
    const samplesPerStep = sampleCount / length;
    this.frequencyBase.genInit();
    this.amplitudeBase.genInit();
    let frequencyStart = 0;
    let frequencyDuration = 0;
    let frequencyPhase = 0;
    if (this.frequencyModRate !== null && this.frequencyModRange !== null) {
      this.frequencyModRate.genInit();
      this.frequencyModRange.genInit();
      frequencyStart = (this.frequencyModRate.end - this.frequencyModRate.start) * 32.768 / samplesPerStep | 0;
      frequencyDuration = this.frequencyModRate.start * 32.768 / samplesPerStep | 0;
    }
    let amplitudeStart = 0;
    let amplitudeDuration = 0;
    let amplitudePhase = 0;
    if (this.amplitudeModRate !== null && this.amplitudeModRange !== null) {
      this.amplitudeModRate.genInit();
      this.amplitudeModRange.genInit();
      amplitudeStart = (this.amplitudeModRate.end - this.amplitudeModRate.start) * 32.768 / samplesPerStep | 0;
      amplitudeDuration = this.amplitudeModRate.start * 32.768 / samplesPerStep | 0;
    }
    for (let harmonic = 0;harmonic < 5; harmonic++) {
      if (this.harmonicVolume[harmonic] !== 0) {
        Tone.fPos[harmonic] = 0;
        Tone.fDel[harmonic] = this.harmonicDelay[harmonic] * samplesPerStep;
        Tone.fAmp[harmonic] = (this.harmonicVolume[harmonic] << 14) / 100 | 0;
        Tone.fMulti[harmonic] = (this.frequencyBase.end - this.frequencyBase.start) * 32.768 * Math.pow(1.0057929410678534, this.harmonicSemitone[harmonic]) / samplesPerStep | 0;
        Tone.fOffset[harmonic] = this.frequencyBase.start * 32.768 / samplesPerStep | 0;
      }
    }
    for (let sample = 0;sample < sampleCount; sample++) {
      let frequency = this.frequencyBase.genNext(sampleCount);
      let amplitude = this.amplitudeBase.genNext(sampleCount);
      if (this.frequencyModRate !== null && this.frequencyModRange !== null) {
        const rate = this.frequencyModRate.genNext(sampleCount);
        const range = this.frequencyModRange.genNext(sampleCount);
        frequency += this.waveFunc(range, frequencyPhase, this.frequencyModRate.form) >> 1;
        frequencyPhase += (rate * frequencyStart >> 16) + frequencyDuration;
      }
      if (this.amplitudeModRate !== null && this.amplitudeModRange !== null) {
        const rate = this.amplitudeModRate.genNext(sampleCount);
        const range = this.amplitudeModRange.genNext(sampleCount);
        amplitude = amplitude * ((this.waveFunc(range, amplitudePhase, this.amplitudeModRate.form) >> 1) + 32768) >> 15;
        amplitudePhase += (rate * amplitudeStart >> 16) + amplitudeDuration;
      }
      for (let harmonic = 0;harmonic < 5; harmonic++) {
        if (this.harmonicVolume[harmonic] !== 0) {
          const position = sample + Tone.fDel[harmonic];
          if (position < sampleCount) {
            Tone.buf[position] += this.waveFunc(amplitude * Tone.fAmp[harmonic] >> 15, Tone.fPos[harmonic], this.frequencyBase.form);
            Tone.fPos[harmonic] += (frequency * Tone.fMulti[harmonic] >> 16) + Tone.fOffset[harmonic];
          }
        }
      }
    }
    if (this.release !== null && this.attack !== null) {
      this.release.genInit();
      this.attack.genInit();
      let counter = 0;
      let muted = true;
      for (let sample = 0;sample < sampleCount; sample++) {
        const releaseValue = this.release.genNext(sampleCount);
        const attackValue = this.attack.genNext(sampleCount);
        let threshold;
        if (muted) {
          threshold = this.release.start + ((this.release.end - this.release.start) * releaseValue >> 8);
        } else {
          threshold = this.release.start + ((this.release.end - this.release.start) * attackValue >> 8);
        }
        counter += 256;
        if (counter >= threshold) {
          counter = 0;
          muted = !muted;
        }
        if (muted) {
          Tone.buf[sample] = 0;
        }
      }
    }
    if (this.reverbDelay > 0 && this.reverbVolume > 0) {
      const start = this.reverbDelay * samplesPerStep | 0;
      for (let sample = start;sample < sampleCount; sample++) {
        Tone.buf[sample] += Tone.buf[sample - start] * this.reverbVolume / 100 | 0;
      }
    }
    for (let sample = 0;sample < sampleCount; sample++) {
      if (Tone.buf[sample] < -32768) {
        Tone.buf[sample] = -32768;
      }
      if (Tone.buf[sample] > 32767) {
        Tone.buf[sample] = 32767;
      }
    }
    return Tone.buf;
  }
  waveFunc(amplitude, phase, form) {
    if (form === 1) {
      return (phase & 32767) < 16384 ? amplitude : -amplitude;
    } else if (form === 2) {
      return Tone.sine[phase & 32767] * amplitude >> 14;
    } else if (form === 3) {
      return ((phase & 32767) * amplitude >> 14) - amplitude;
    } else if (form === 4) {
      return Tone.noise[(phase / 2607 | 0) & 32767] * amplitude;
    } else {
      return 0;
    }
  }
  load(dat) {
    this.frequencyBase = new Envelope;
    this.frequencyBase.load(dat);
    this.amplitudeBase = new Envelope;
    this.amplitudeBase.load(dat);
    if (dat.g1() !== 0) {
      dat.pos--;
      this.frequencyModRate = new Envelope;
      this.frequencyModRate.load(dat);
      this.frequencyModRange = new Envelope;
      this.frequencyModRange.load(dat);
    }
    if (dat.g1() !== 0) {
      dat.pos--;
      this.amplitudeModRate = new Envelope;
      this.amplitudeModRate.load(dat);
      this.amplitudeModRange = new Envelope;
      this.amplitudeModRange.load(dat);
    }
    if (dat.g1() !== 0) {
      dat.pos--;
      this.release = new Envelope;
      this.release.load(dat);
      this.attack = new Envelope;
      this.attack.load(dat);
    }
    for (let harmonic = 0;harmonic < 10; harmonic++) {
      const volume = dat.gsmarts();
      if (volume === 0) {
        break;
      }
      this.harmonicVolume[harmonic] = volume;
      this.harmonicSemitone[harmonic] = dat.gsmart();
      this.harmonicDelay[harmonic] = dat.gsmarts();
    }
    this.reverbDelay = dat.gsmarts();
    this.reverbVolume = dat.gsmarts();
    this.length = dat.g2();
    this.start = dat.g2();
  }
}

// src/sound/JagFX.ts
class JagFX {
  static synth = new TypedArray1d(1000, null);
  static delays = new Int32Array(1000);
  static waveBytes = new Uint8Array(22050 * 20);
  static waveBuffer = new Packet(this.waveBytes);
  tones = new TypedArray1d(10, null);
  loopBegin = 0;
  loopEnd = 0;
  static unpack(dat) {
    while (true) {
      const id = dat.g2();
      if (id === 65535) {
        break;
      }
      this.synth[id] = new JagFX;
      this.synth[id].load(dat);
      this.delays[id] = this.synth[id].optimiseStart();
    }
  }
  static generate(id, loopCount) {
    const sound = this.synth[id];
    if (sound === null) {
      return null;
    }
    return sound.getWave(loopCount);
  }
  load(dat) {
    for (let tone = 0;tone < 10; tone++) {
      if (dat.g1() !== 0) {
        dat.pos--;
        this.tones[tone] = new Tone;
        this.tones[tone].load(dat);
      }
    }
    this.loopBegin = dat.g2();
    this.loopEnd = dat.g2();
  }
  optimiseStart() {
    let start = 9999999;
    for (let i2 = 0;i2 < 10; i2++) {
      const tone = this.tones[i2];
      if (tone !== null && (tone.start / 20 | 0) < start) {
        start = tone.start / 20 | 0;
      }
    }
    if (this.loopBegin < this.loopEnd && (this.loopBegin / 20 | 0) < start) {
      start = this.loopBegin / 20 | 0;
    }
    if (start === 9999999 || start === 0) {
      return 0;
    }
    for (let i2 = 0;i2 < 10; i2++) {
      const tone = this.tones[i2];
      if (tone !== null) {
        tone.start -= start * 20;
      }
    }
    if (this.loopBegin < this.loopEnd) {
      this.loopBegin -= start * 20;
      this.loopEnd -= start * 20;
    }
    return start;
  }
  getWave(loopCount) {
    const length = this.makeSound(loopCount);
    JagFX.waveBuffer.pos = 0;
    JagFX.waveBuffer.p4(1380533830);
    JagFX.waveBuffer.ip4(length + 36);
    JagFX.waveBuffer.p4(1463899717);
    JagFX.waveBuffer.p4(1718449184);
    JagFX.waveBuffer.ip4(16);
    JagFX.waveBuffer.ip2(1);
    JagFX.waveBuffer.ip2(1);
    JagFX.waveBuffer.ip4(22050);
    JagFX.waveBuffer.ip4(22050);
    JagFX.waveBuffer.ip2(1);
    JagFX.waveBuffer.ip2(8);
    JagFX.waveBuffer.p4(1684108385);
    JagFX.waveBuffer.ip4(length);
    JagFX.waveBuffer.pos += length;
    return JagFX.waveBuffer;
  }
  makeSound(loopCount) {
    let duration = 0;
    for (let i2 = 0;i2 < 10; i2++) {
      const tone = this.tones[i2];
      if (tone !== null && tone.length + tone.start > duration) {
        duration = tone.length + tone.start;
      }
    }
    if (duration === 0) {
      return 0;
    }
    let sampleCount = duration * 22050 / 1000 | 0;
    let loopStart = this.loopBegin * 22050 / 1000 | 0;
    let loopStop = this.loopEnd * 22050 / 1000 | 0;
    if (loopStart < 0 || loopStop < 0 || loopStop > sampleCount || loopStart >= loopStop) {
      loopCount = 0;
    }
    let totalSampleCount = sampleCount + (loopStop - loopStart) * (loopCount - 1);
    for (let sample = 44;sample < totalSampleCount + 44; sample++) {
      JagFX.waveBytes[sample] = -128;
    }
    for (let i2 = 0;i2 < 10; i2++) {
      const tone = this.tones[i2];
      if (tone !== null) {
        const toneSampleCount = tone.length * 22050 / 1000 | 0;
        const start = tone.start * 22050 / 1000 | 0;
        const samples = tone.generate(toneSampleCount, tone.length);
        for (let sample = 0;sample < toneSampleCount; sample++) {
          JagFX.waveBytes[sample + start + 44] += samples[sample] >> 8 << 24 >> 24;
        }
      }
    }
    if (loopCount > 1) {
      loopStart += 44;
      loopStop += 44;
      sampleCount += 44;
      totalSampleCount += 44;
      const endOffset = totalSampleCount - sampleCount;
      for (let sample = sampleCount - 1;sample >= loopStop; sample--) {
        JagFX.waveBytes[sample + endOffset] = JagFX.waveBytes[sample];
      }
      for (let loop = 1;loop < loopCount; loop++) {
        const offset = (loopStop - loopStart) * loop;
        for (let sample = loopStart;sample < loopStop; sample++) {
          JagFX.waveBytes[sample + offset] = JagFX.waveBytes[sample];
        }
      }
      totalSampleCount -= 44;
    }
    return totalSampleCount;
  }
}

// src/client/Client.ts
var CLIENT_VERSION = 254;
var MAX_PLAYER_COUNT = 2048;
var LOCAL_PLAYER_INDEX = 2047;
var MAX_CHATS = 50;
var CHAT_COLOURS = [16776960 /* YELLOW */, 16711680 /* RED */, 65280 /* GREEN */, 65535 /* CYAN */, 16711935 /* MAGENTA */, 16777215 /* WHITE */];
var SCROLLBAR_TRACK = 2301979;
var SCROLLBAR_GRIP_FOREGROUND = 5063219;
var SCROLLBAR_GRIP_HIGHLIGHT = 7759444;
var SCROLLBAR_GRIP_LOWLIGHT = 3353893;

class Client extends GameShell {
  static levelExperience = [];
  static readbit = new Int32Array(32);
  static nodeId = 10;
  static memServer = true;
  static lowMem = false;
  alreadyStarted = false;
  errorStarted = false;
  errorLoading = false;
  errorHost = false;
  errorMessage = null;
  lastProgressPercent = 0;
  lastProgressMessage = "";
  ingame = false;
  loopCycle = 0;
  drawCycle = 0;
  flameCycle = 0;
  prevMouseClickTime = 0;
  mouseTracked = false;
  mouseTracking = new MouseTracking(this);
  mouseTrackedX = 0;
  mouseTrackedY = 0;
  mouseTrackedDelta = 0;
  focusIn = false;
  showFps = false;
  rebootTimer = 0;
  hintType = 0;
  hintNpc = 0;
  hintPlayer = 0;
  hintTileX = 0;
  hintTileZ = 0;
  hintHeight = 0;
  hintOffsetX = 0;
  hintOffsetZ = 0;
  lastAddress = 0;
  daysSinceLastLogin = 0;
  daysSinceRecoveriesChanged = 0;
  unreadMessages = 0;
  warnMembersInNonMembers = 0;
  onDemand = null;
  db = null;
  jagChecksum = [];
  npc = new TypedArray1d(16384, null);
  npcCount = 0;
  npcIds = new Int32Array(16384);
  stream = null;
  loginSeed = 0n;
  randomIn = null;
  out = Packet.alloc(1);
  loginout = Packet.alloc(1);
  in = Packet.alloc(1);
  psize = 0;
  ptype = 0;
  timeoutTimer = 0;
  noTimeoutTimer = 0;
  logoutTimer = 0;
  ptype0 = 0;
  ptype1 = 0;
  ptype2 = 0;
  title = null;
  p11 = null;
  p12 = null;
  b12 = null;
  q8 = null;
  mapBuildBaseX = 0;
  mapBuildBaseZ = 0;
  mapBuildPrevBaseX = 0;
  mapBuildPrevBaseZ = 0;
  sceneState = 0;
  sceneLoadStartTime = 0;
  withinTutorialIsland = false;
  awaitingPlayerInfo = false;
  mapBuildCenterZoneX = 0;
  mapBuildCenterZoneZ = 0;
  mapBuildIndex = null;
  mapBuildGroundFile = [];
  mapBuildLocationFile = [];
  mapBuildGroundData = null;
  mapBuildLocationData = null;
  world = null;
  mapl = null;
  groundh = null;
  collision = new TypedArray1d(4 /* LEVELS */, null);
  textureBuffer = new Int8Array(16384);
  zoneUpdateX = 0;
  zoneUpdateZ = 0;
  tryMoveNearest = 0;
  dirMap = new Int32Array(104 /* SIZE */ * 104 /* SIZE */);
  distMap = new Int32Array(104 /* SIZE */ * 104 /* SIZE */);
  routeX = new Int32Array(4000);
  routeZ = new Int32Array(4000);
  macroCameraX = 0;
  macroCameraXModifier = 2;
  macroCameraZ = 0;
  macroCameraZModifier = 2;
  macroCameraAngle = 0;
  macroCameraAngleModifier = 1;
  macroCameraCycle = 0;
  macroMinimapAngle = 0;
  macroMinimapAngleModifier = 2;
  macroMinimapZoom = 0;
  macroMinimapZoomModifier = 1;
  macroMinimapCycle = 0;
  worldUpdateNum = 0;
  minimap = null;
  compass = null;
  mapedge = null;
  mapscene = new TypedArray1d(50, null);
  mapfunction = new TypedArray1d(50, null);
  hitmarks = new TypedArray1d(20, null);
  headicons = new TypedArray1d(20, null);
  mapmarker1 = null;
  mapmarker2 = null;
  cross = new TypedArray1d(8, null);
  mapdots1 = null;
  mapdots2 = null;
  mapdots3 = null;
  mapdots4 = null;
  scrollbar1 = null;
  scrollbar2 = null;
  modIcons = [];
  redrawFrame = true;
  imageTitle2 = null;
  imageTitle3 = null;
  imageTitle4 = null;
  imageTitle0 = null;
  imageTitle1 = null;
  imageTitle5 = null;
  imageTitle6 = null;
  imageTitle7 = null;
  imageTitle8 = null;
  imageTitlebox = null;
  imageTitlebutton = null;
  loginscreen = 0;
  loginSelect = 0;
  loginMes1 = "";
  loginMes2 = "";
  loginUser = "";
  loginPass = "";
  imageRunes = [];
  flameActive = false;
  imageFlamesLeft = null;
  imageFlamesRight = null;
  flameBuffer1 = null;
  flameBuffer0 = null;
  flameBuffer3 = null;
  flameBuffer2 = null;
  flameGradient = null;
  flameGradient0 = null;
  flameGradient1 = null;
  flameGradient2 = null;
  flameLineOffset = new Int32Array(256);
  flameCycle0 = 0;
  flameGradientCycle0 = 0;
  flameGradientCycle1 = 0;
  flamesInterval = null;
  mouseTrackingInterval = null;
  areaSidebar = null;
  areaMapback = null;
  areaViewport = null;
  areaChatback = null;
  areaBackbase1 = null;
  areaBackbase2 = null;
  areaBackhmid1 = null;
  areaBackleft1 = null;
  areaBackleft2 = null;
  areaBackright1 = null;
  areaBackright2 = null;
  areaBacktop1 = null;
  areaBackvmid1 = null;
  areaBackvmid2 = null;
  areaBackvmid3 = null;
  areaBackhmid2 = null;
  chatbackScanline = null;
  sidebarScanline = null;
  viewportScanline = null;
  invback = null;
  chatback = null;
  backbase1 = null;
  backbase2 = null;
  backhmid1 = null;
  sideicons = new TypedArray1d(13, null);
  redstone1 = null;
  redstone2 = null;
  redstone3 = null;
  redstone1h = null;
  redstone2h = null;
  redstone1v = null;
  redstone2v = null;
  redstone3v = null;
  redstone1hv = null;
  redstone2hv = null;
  redrawSidebar = false;
  redrawChatback = false;
  redrawSideicons = false;
  redrawPrivacySettings = false;
  mapback = null;
  compassMaskLineOffsets = new Int32Array(33);
  compassMaskLineLengths = new Int32Array(33);
  minimapMaskLineOffsets = new Int32Array(151);
  minimapMaskLineLengths = new Int32Array(151);
  scrollGrabbed = false;
  scrollInputPadding = 0;
  scrollCycle = 0;
  camX = 0;
  camY = 0;
  camZ = 0;
  camPitch = 0;
  camYaw = 0;
  orbitCameraPitch = 128;
  orbitCameraYaw = 0;
  orbitCameraYawVelocity = 0;
  orbitCameraPitchVelocity = 0;
  orbitCameraX = 0;
  orbitCameraZ = 0;
  sendCameraDelay = 0;
  sendCamera = false;
  cameraPitchClamp = 0;
  chatCount = 0;
  chatX = new Int32Array(MAX_CHATS);
  chatY = new Int32Array(MAX_CHATS);
  chatHeight = new Int32Array(MAX_CHATS);
  chatWidth = new Int32Array(MAX_CHATS);
  chatColour = new Int32Array(MAX_CHATS);
  chatEffect = new Int32Array(MAX_CHATS);
  chatTimer = new Int32Array(MAX_CHATS);
  chats = new TypedArray1d(MAX_CHATS, null);
  tileLastOccupiedCycle = new Int32Array2d(104 /* SIZE */, 104 /* SIZE */);
  sceneCycle = 0;
  projectX = 0;
  projectY = 0;
  crossX = 0;
  crossY = 0;
  crossCycle = 0;
  crossMode = 0;
  selectedArea = 0;
  selectedComId = 0;
  selectedItem = 0;
  selectedCycle = 0;
  objDragArea = 0;
  objDragComId = 0;
  hoveredSlotComId = 0;
  objDragSlot = 0;
  objGrabX = 0;
  objGrabY = 0;
  hoveredSlot = 0;
  objGrabThreshold = false;
  objDragCycles = 0;
  inMultizone = 0;
  chatDisabled = 0;
  players = new TypedArray1d(MAX_PLAYER_COUNT, null);
  playerCount = 0;
  playerIds = new Int32Array(MAX_PLAYER_COUNT);
  entityUpdateCount = 0;
  entityUpdateIds = new Int32Array(MAX_PLAYER_COUNT);
  playerAppearanceBuffer = new TypedArray1d(MAX_PLAYER_COUNT, null);
  minusedlevel = 0;
  selfSlot = -1;
  localPlayer = null;
  membersAccount = 0;
  entityRemovalCount = 0;
  entityRemovalIds = new Int32Array(1000);
  playerOp = new TypedArray1d(5, null);
  playerOpPriority = new TypedArray1d(5, false);
  groundObj = new TypedArray3d(4 /* LEVELS */, 104 /* SIZE */, 104 /* SIZE */, null);
  locChanges = new LinkList;
  projectiles = new LinkList;
  spotanims = new LinkList;
  statEffectiveLevel = [];
  statBaseLevel = [];
  statXP = [];
  oneMouseButton = 0;
  isMenuOpen = false;
  menuNumEntries = 0;
  menuArea = 0;
  menuX = 0;
  menuY = 0;
  menuWidth = 0;
  menuHeight = 0;
  menuParamB = new Int32Array(500);
  menuParamC = new Int32Array(500);
  menuAction = new Int32Array(500);
  menuParamA = new Int32Array(500);
  menuOption = [];
  useMode = 0;
  objComId = 0;
  objSelectedName = null;
  objSelectedComId = 0;
  objSelectedSlot = 0;
  targetMode = 0;
  targetComId = 0;
  targetMask = 0;
  targetOp = null;
  chatComId = -1;
  mainModalId = -1;
  sideModalId = -1;
  mainOverlayId = -1;
  lastOverComId = 0;
  overChatComId = 0;
  overMainComId = 0;
  overSideComId = 0;
  sideTab = 3;
  sideOverlayId = [
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1,
    -1
  ];
  tutComId = -1;
  tutComMessage = null;
  tutFlashingTab = -1;
  chatEffects = 0;
  splitPrivateChat = 0;
  bankArrangeMode = 0;
  resumedPauseButton = false;
  runenergy = 0;
  runweight = 0;
  staffmodlevel = 0;
  var = [];
  varServ = [];
  chatInterface = new IfType;
  chatScrollHeight = 78;
  chatScrollPos = 0;
  chatInput = "";
  chatType = new Int32Array(100);
  chatUsername = new TypedArray1d(100, null);
  chatText = new TypedArray1d(100, null);
  chatPublicMode = 0;
  chatPrivateMode = 0;
  chatTradeMode = 0;
  privateMessageIds = new Int32Array(100);
  privateMessageCount = 0;
  socialUserhash = null;
  socialInputOpen = false;
  socialInput = "";
  socialInputType = 0;
  socialInputHeader = "";
  dialogInputOpen = false;
  dialogInput = "";
  reportAbuseInput = "";
  reportAbuseMuteOption = false;
  reportAbuseComId = -1;
  minimapLevel = -1;
  activeMapFunctionCount = 0;
  activeMapFunctionX = new Int32Array(1000);
  activeMapFunctionZ = new Int32Array(1000);
  activeMapFunctions = new TypedArray1d(1000, null);
  minimapFlagX = 0;
  minimapFlagZ = 0;
  midiActive = true;
  midiVolume = 0;
  midiSong = -1;
  nextMidiSong = -1;
  nextMusicDelay = 0;
  midiFading = false;
  waveEnabled = true;
  waveVolume = 0;
  waveCount = 0;
  waveIds = new Int32Array(50);
  waveLoops = new Int32Array(50);
  waveDelay = new Int32Array(50);
  lastWaveId = -1;
  lastWaveLoops = -1;
  lastWaveLength = 0;
  lastWaveStartTime = 0;
  cinemaCam = false;
  camShake = new TypedArray1d(5, false);
  camShakeAxis = new Int32Array(5);
  camShakeRan = new Int32Array(5);
  camShakeAmp = new Int32Array(5);
  camShakeCycle = new Int32Array(5);
  camMoveToLx = 0;
  camMoveToLz = 0;
  camMoveToHei = 0;
  camMoveToRate = 0;
  camMoveToRate2 = 0;
  camLookAtLx = 0;
  camLookAtLz = 0;
  camLookAtHei = 0;
  camLookAtRate = 0;
  camLookAtRate2 = 0;
  friendCount = 0;
  friendServerStatus = 0;
  friendUsername = new TypedArray1d(200, null);
  friendUserhash = new BigInt64Array(200);
  friendNodeId = new Int32Array(200);
  ignoreCount = 0;
  ignoreUserhash = [];
  idkDesignGender = true;
  idkDesignRedraw = false;
  idkDesignPart = new Int32Array(7);
  idkDesignColour = new Int32Array(5);
  idkDesignButton1 = null;
  idkDesignButton2 = null;
  static cyclelogic1 = 0;
  static cyclelogic2 = 0;
  static cyclelogic3 = 0;
  static cyclelogic4 = 0;
  static cyclelogic5 = 0;
  static cyclelogic6 = 0;
  static cyclelogic7 = 0;
  static cyclelogic8 = 0;
  static cyclelogic9 = 0;
  static cyclelogic10 = 0;
  static oplogic1 = 0;
  static oplogic2 = 0;
  static oplogic3 = 0;
  static oplogic4 = 0;
  static oplogic5 = 0;
  static oplogic6 = 0;
  static oplogic7 = 0;
  static oplogic8 = 0;
  static oplogic9 = 0;
  static oplogic10 = 0;
  static {
    let n = 2;
    for (let bit = 0;bit < 32; bit++) {
      Client.readbit[bit] = n - 1;
      n += n;
    }
    let acc = 0;
    for (let i2 = 0;i2 < 99; i2++) {
      const level = i2 + 1;
      const delta = level + Math.pow(2, level / 7) * 300 | 0;
      acc += delta;
      Client.levelExperience[i2] = acc / 4 | 0;
    }
  }
  constructor(nodeid, lowmem, members) {
    super();
    if (typeof nodeid === "undefined" || typeof lowmem === "undefined" || typeof members === "undefined") {
      return;
    }
    console.log(`RS2 user client - release #${CLIENT_VERSION}`);
    Client.nodeId = nodeid;
    Client.memServer = members;
    if (lowmem) {
      Client.setLowMem();
    } else {
      Client.setHighMem();
    }
    this.run();
  }
  static setLowMem() {
    World.lowMem = true;
    Pix3D.lowMem = true;
    Client.lowMem = true;
    ClientBuild.lowMem = true;
  }
  static setHighMem() {
    World.lowMem = false;
    Pix3D.lowMem = false;
    Client.lowMem = false;
    ClientBuild.lowMem = false;
  }
  saveMidi(data, fading) {
    playMidi(data, this.midiVolume, fading);
  }
  drawError() {
    canvas2d.fillStyle = "black";
    canvas2d.fillRect(0, 0, this.sWid, this.sHei);
    this.setFramerate(1);
    this.flameActive = false;
    let y = 0;
    if (this.errorLoading) {
      canvas2d.font = "bold 16px helvetica, sans-serif";
      canvas2d.textAlign = "left";
      canvas2d.fillStyle = "yellow";
      y = 35;
      canvas2d.fillText("Sorry, an error has occured whilst loading RuneScape", 30, y);
      y += 50;
      canvas2d.fillStyle = "white";
      canvas2d.fillText("To fix this try the following (in order):", 30, y);
      y += 50;
      canvas2d.font = "bold 12px helvetica, sans-serif";
      canvas2d.fillText("1: Try closing ALL open web-browser windows, and reloading", 30, y);
      y += 30;
      canvas2d.fillText("2: Try clearing your web-browsers cache", 30, y);
      y += 30;
      canvas2d.fillText("3: Try using a different game-world", 30, y);
      y += 30;
      canvas2d.fillText("4: Try rebooting your computer", 30, y);
      y += 30;
      canvas2d.fillText("5: Try selecting a different method from the play-game menu", 30, y);
    } else if (this.errorHost) {
      canvas2d.font = "bold 20px helvetica, sans-serif";
      canvas2d.textAlign = "left";
      canvas2d.fillStyle = "white";
      y = 50;
      canvas2d.fillText("Error - unable to load game!", 50, y);
      y += 50;
      canvas2d.fillText("To play RuneScape make sure you play from", 50, y);
      y += 50;
      canvas2d.fillText("An approved domain", 50, y);
    } else if (this.errorStarted) {
      canvas2d.font = "bold 13px helvetica, sans-serif";
      canvas2d.textAlign = "left";
      canvas2d.fillStyle = "yellow";
      y = 35;
      canvas2d.fillText("Error a copy of RuneScape already appears to be loaded", 30, y);
      y += 50;
      canvas2d.fillStyle = "white";
      canvas2d.fillText("To fix this try the following (in order):", 30, y);
      y += 50;
      canvas2d.font = "bold 12px helvetica, sans-serif";
      canvas2d.fillText("1: Try closing ALL open web-browser windows, and reloading", 30, y);
      y += 30;
      canvas2d.fillText("2: Try rebooting your computer, and reloading", 30, y);
    }
    if (this.errorMessage) {
      y += 50;
      canvas2d.fillStyle = "red";
      canvas2d.fillText(this.errorMessage, 30, y);
    }
  }
  async getJagFile(displayName, progress, filename, index) {
    const crc = this.jagChecksum[index];
    let data;
    let retry = 5;
    try {
      if (this.db) {
        data = await this.db.read(0, index);
      }
    } catch (_e) {}
    if (data && Packet.getcrc(data, 0, data.length) !== crc) {
      data = undefined;
    }
    if (data) {
      return new Jagfile(data);
    }
    let loops = 0;
    while (!data) {
      await this.messageBox(`Requesting ${displayName}`, progress);
      try {
        data = await downloadUrl(`/${filename}${crc}`);
        const checksum = Packet.getcrc(data, 0, data.length);
        if (crc === checksum) {
          try {
            if (this.db) {
              await this.db.write(0, index, data);
            }
          } catch (_e) {}
        } else {
          data = undefined;
          loops++;
        }
      } catch (_e) {
        data = undefined;
      }
      if (!data) {
        for (let i2 = retry;i2 > 0; i2--) {
          if (loops >= 3) {
            await this.messageBox("Game updated - please reload page", progress);
            i2 = 10;
          } else {
            await this.messageBox(`Error loading - Will retry in ${i2} secs.`, progress);
          }
          await sleep(1000);
        }
        retry *= 2;
        if (retry > 60) {
          retry = 60;
        }
      }
    }
    return new Jagfile(data);
  }
  async maininit() {
    if (this.isMobile && Client.lowMem) {
      this.setTargetedFramerate(30);
    }
    if (this.alreadyStarted) {
      this.errorStarted = true;
      return;
    }
    this.alreadyStarted = true;
    if (false) {}
    try {
      this.db = new Database(await Database.openDatabase());
    } catch (_e) {
      this.db = null;
    }
    try {
      await this.messageBox("Connecting to web server", 10);
      const checksums = new Packet(await downloadUrl("/crc"));
      for (let i2 = 0;i2 < 9; i2++) {
        this.jagChecksum[i2] = checksums.g4();
      }
      this.title = await this.getJagFile("title screen", 25, "title", 1);
      this.p11 = PixFont.depack(this.title, "p11");
      this.p12 = PixFont.depack(this.title, "p12");
      this.b12 = PixFont.depack(this.title, "b12");
      this.q8 = PixFont.depack(this.title, "q8");
      await this.loadTitleBackground();
      this.loadTitleImages();
      const config = await this.getJagFile("config", 30, "config", 2);
      const interfaces = await this.getJagFile("interface", 35, "interface", 3);
      const media = await this.getJagFile("2d graphics", 40, "media", 4);
      const textures = await this.getJagFile("textures", 45, "textures", 6);
      const wordenc = await this.getJagFile("chat system", 50, "wordenc", 7);
      const sounds = await this.getJagFile("sound effects", 55, "sounds", 8);
      this.mapl = new Uint8Array3d(4 /* LEVELS */, 104 /* SIZE */, 104 /* SIZE */);
      this.groundh = new Int32Array3d(4 /* LEVELS */, 104 /* SIZE */ + 1, 104 /* SIZE */ + 1);
      this.world = new World(this.groundh, 104 /* SIZE */, 4 /* LEVELS */, 104 /* SIZE */);
      for (let level = 0;level < 4 /* LEVELS */; level++) {
        this.collision[level] = new CollisionMap;
      }
      this.minimap = new Pix32(512, 512);
      const versionlist = await this.getJagFile("update list", 60, "versionlist", 5);
      await this.messageBox("Connecting to update server", 60);
      this.onDemand = new OnDemand(versionlist, this);
      AnimFrame.init(this.onDemand.getAnimFrameCount());
      Model.init(this.onDemand.getFileCount(0), this.onDemand);
      await this.messageBox("Preloading cache", 62);
      await this.onDemand.prefetchAll();
      if (!Client.lowMem) {
        this.midiSong = 0;
        this.midiFading = false;
        this.onDemand.request(2, this.midiSong);
        while (this.onDemand.remaining() > 0) {
          await this.onDemandLoop();
          await sleep(100);
        }
      }
      await this.messageBox("Requesting animations", 65);
      const animCount = this.onDemand.getFileCount(1);
      for (let i2 = 0;i2 < animCount; i2++) {
        this.onDemand.request(1, i2);
      }
      while (this.onDemand.remaining() > 0) {
        const progress = animCount - this.onDemand.remaining();
        if (progress > 0) {
          await this.messageBox("Loading animations - " + (progress * 100 / animCount | 0) + "%", 65);
        }
        await this.onDemandLoop();
        await sleep(100);
      }
      await this.messageBox("Requesting models", 70);
      const modelCount = this.onDemand.getFileCount(0);
      for (let i2 = 0;i2 < modelCount; i2++) {
        const flags = this.onDemand.getModelUse(i2);
        if ((flags & 1) != 0) {
          this.onDemand.request(0, i2);
        }
      }
      const modelPrefetch = this.onDemand.remaining();
      while (this.onDemand.remaining() > 0) {
        const progress = modelPrefetch - this.onDemand.remaining();
        if (progress > 0) {
          await this.messageBox("Loading models - " + (progress * 100 / modelPrefetch | 0) + "%", 70);
        }
        await this.onDemandLoop();
        await sleep(100);
      }
      if (this.db) {
        await this.messageBox("Requesting maps", 75);
        this.onDemand.request(3, this.onDemand.getMapFile(47, 48, 0));
        this.onDemand.request(3, this.onDemand.getMapFile(47, 48, 1));
        this.onDemand.request(3, this.onDemand.getMapFile(48, 48, 0));
        this.onDemand.request(3, this.onDemand.getMapFile(48, 48, 1));
        this.onDemand.request(3, this.onDemand.getMapFile(49, 48, 0));
        this.onDemand.request(3, this.onDemand.getMapFile(49, 48, 1));
        this.onDemand.request(3, this.onDemand.getMapFile(47, 47, 0));
        this.onDemand.request(3, this.onDemand.getMapFile(47, 47, 1));
        this.onDemand.request(3, this.onDemand.getMapFile(48, 47, 0));
        this.onDemand.request(3, this.onDemand.getMapFile(48, 47, 1));
        this.onDemand.request(3, this.onDemand.getMapFile(148, 48, 0));
        this.onDemand.request(3, this.onDemand.getMapFile(148, 48, 1));
        const mapPrefetch = this.onDemand.remaining();
        while (this.onDemand.remaining() > 0) {
          const progress = mapPrefetch - this.onDemand.remaining();
          if (progress > 0) {
            await this.messageBox("Loading maps - " + (progress * 100 / mapPrefetch | 0) + "%", 75);
          }
          await this.onDemandLoop();
          await sleep(100);
        }
      }
      const modelCount2 = this.onDemand.getFileCount(0);
      for (let i2 = 0;i2 < modelCount2; i2++) {
        const flags = this.onDemand.getModelUse(i2);
        let priority = 0;
        if ((flags & 8) != 0) {
          priority = 10;
        } else if ((flags & 32) != 0) {
          priority = 9;
        } else if ((flags & 16) != 0) {
          priority = 8;
        } else if ((flags & 64) != 0) {
          priority = 7;
        } else if ((flags & 128) != 0) {
          priority = 6;
        } else if ((flags & 2) != 0) {
          priority = 5;
        } else if ((flags & 4) != 0) {
          priority = 4;
        }
        if ((flags & 1) != 0) {
          priority = 3;
        }
        if (priority != 0) {
          this.onDemand.requestModel(i2);
        }
      }
      await this.onDemand.prefetchMaps(Client.memServer);
      if (!Client.lowMem) {
        const midiCount = this.onDemand.getFileCount(2);
        for (let i2 = 0;i2 < midiCount; i2++) {
          if (this.onDemand.isMidiJingle(i2)) {
            this.onDemand.prefetchPriority(2, i2, 1);
          }
        }
      }
      await this.messageBox("Unpacking media", 80);
      this.invback = Pix8.depack(media, "invback", 0);
      this.chatback = Pix8.depack(media, "chatback", 0);
      this.mapback = Pix8.depack(media, "mapback", 0);
      this.backbase1 = Pix8.depack(media, "backbase1", 0);
      this.backbase2 = Pix8.depack(media, "backbase2", 0);
      this.backhmid1 = Pix8.depack(media, "backhmid1", 0);
      for (let i2 = 0;i2 < 13; i2++) {
        this.sideicons[i2] = Pix8.depack(media, "sideicons", i2);
      }
      this.compass = Pix32.depack(media, "compass", 0);
      this.mapedge = Pix32.depack(media, "mapedge", 0);
      this.mapedge.trim();
      try {
        for (let i2 = 0;i2 < 50; i2++) {
          this.mapscene[i2] = Pix8.depack(media, "mapscene", i2);
        }
      } catch (_e) {}
      try {
        for (let i2 = 0;i2 < 50; i2++) {
          this.mapfunction[i2] = Pix32.depack(media, "mapfunction", i2);
        }
      } catch (_e) {}
      try {
        for (let i2 = 0;i2 < 20; i2++) {
          this.hitmarks[i2] = Pix32.depack(media, "hitmarks", i2);
        }
      } catch (_e) {}
      try {
        for (let i2 = 0;i2 < 20; i2++) {
          this.headicons[i2] = Pix32.depack(media, "headicons", i2);
        }
      } catch (_e) {}
      this.mapmarker1 = Pix32.depack(media, "mapmarker", 0);
      this.mapmarker2 = Pix32.depack(media, "mapmarker", 1);
      for (let i2 = 0;i2 < 8; i2++) {
        this.cross[i2] = Pix32.depack(media, "cross", i2);
      }
      this.mapdots1 = Pix32.depack(media, "mapdots", 0);
      this.mapdots2 = Pix32.depack(media, "mapdots", 1);
      this.mapdots3 = Pix32.depack(media, "mapdots", 2);
      this.mapdots4 = Pix32.depack(media, "mapdots", 3);
      this.scrollbar1 = Pix8.depack(media, "scrollbar", 0);
      this.scrollbar2 = Pix8.depack(media, "scrollbar", 1);
      this.redstone1 = Pix8.depack(media, "redstone1", 0);
      this.redstone2 = Pix8.depack(media, "redstone2", 0);
      this.redstone3 = Pix8.depack(media, "redstone3", 0);
      this.redstone1h = Pix8.depack(media, "redstone1", 0);
      this.redstone1h?.hflip();
      this.redstone2h = Pix8.depack(media, "redstone2", 0);
      this.redstone2h?.hflip();
      this.redstone1v = Pix8.depack(media, "redstone1", 0);
      this.redstone1v?.vflip();
      this.redstone2v = Pix8.depack(media, "redstone2", 0);
      this.redstone2v?.vflip();
      this.redstone3v = Pix8.depack(media, "redstone3", 0);
      this.redstone3v?.vflip();
      this.redstone1hv = Pix8.depack(media, "redstone1", 0);
      this.redstone1hv?.hflip();
      this.redstone1hv?.vflip();
      this.redstone2hv = Pix8.depack(media, "redstone2", 0);
      this.redstone2hv?.hflip();
      this.redstone2hv?.vflip();
      for (let i2 = 0;i2 < 2; i2++) {
        this.modIcons[i2] = Pix8.depack(media, "mod_icons", i2);
      }
      const backleft1 = Pix32.depack(media, "backleft1", 0);
      this.areaBackleft1 = new PixMap(backleft1.wi, backleft1.hi);
      backleft1.quickPlotSprite(0, 0);
      const backleft2 = Pix32.depack(media, "backleft2", 0);
      this.areaBackleft2 = new PixMap(backleft2.wi, backleft2.hi);
      backleft2.quickPlotSprite(0, 0);
      const backright1 = Pix32.depack(media, "backright1", 0);
      this.areaBackright1 = new PixMap(backright1.wi, backright1.hi);
      backright1.quickPlotSprite(0, 0);
      const backright2 = Pix32.depack(media, "backright2", 0);
      this.areaBackright2 = new PixMap(backright2.wi, backright2.hi);
      backright2.quickPlotSprite(0, 0);
      const backtop1 = Pix32.depack(media, "backtop1", 0);
      this.areaBacktop1 = new PixMap(backtop1.wi, backtop1.hi);
      backtop1.quickPlotSprite(0, 0);
      const backvmid1 = Pix32.depack(media, "backvmid1", 0);
      this.areaBackvmid1 = new PixMap(backvmid1.wi, backvmid1.hi);
      backvmid1.quickPlotSprite(0, 0);
      const backvmid2 = Pix32.depack(media, "backvmid2", 0);
      this.areaBackvmid2 = new PixMap(backvmid2.wi, backvmid2.hi);
      backvmid2.quickPlotSprite(0, 0);
      const backvmid3 = Pix32.depack(media, "backvmid3", 0);
      this.areaBackvmid3 = new PixMap(backvmid3.wi, backvmid3.hi);
      backvmid3.quickPlotSprite(0, 0);
      const backhmid2 = Pix32.depack(media, "backhmid2", 0);
      this.areaBackhmid2 = new PixMap(backhmid2.wi, backhmid2.hi);
      backhmid2.quickPlotSprite(0, 0);
      const randR = (Math.random() * 21 | 0) - 10;
      const randG = (Math.random() * 21 | 0) - 10;
      const randB = (Math.random() * 21 | 0) - 10;
      const rand = (Math.random() * 41 | 0) - 20;
      for (let i2 = 0;i2 < 50; i2++) {
        if (this.mapfunction[i2]) {
          this.mapfunction[i2]?.rgbAdjust(randR + rand, randG + rand, randB + rand);
        }
        if (this.mapscene[i2]) {
          this.mapscene[i2]?.rgbAdjust(randR + rand, randG + rand, randB + rand);
        }
      }
      await this.messageBox("Unpacking textures", 83);
      Pix3D.unpackTextures(textures);
      Pix3D.initColourTable(0.8);
      Pix3D.initPool(20);
      await this.messageBox("Unpacking config", 86);
      SeqType.init(config);
      LocType.init(config);
      FloType.init(config);
      ObjType.init(config, Client.memServer);
      NpcType.init(config);
      IdkType.init(config);
      SpotType.init(config);
      VarpType.init(config);
      VarBitType.init(config);
      if (!Client.lowMem) {
        await this.messageBox("Unpacking sounds", 90);
        const soundsDat = sounds.read("sounds.dat");
        JagFX.unpack(new Packet(soundsDat));
      }
      await this.messageBox("Unpacking interfaces", 95);
      IfType.init(interfaces, media, [this.p11, this.p12, this.b12, this.q8]);
      await this.messageBox("Preparing game engine", 100);
      for (let y = 0;y < 33; y++) {
        let left = 999;
        let right = 0;
        for (let x2 = 0;x2 < 34; x2++) {
          if (this.mapback.data[x2 + y * this.mapback.wi] === 0) {
            if (left === 999) {
              left = x2;
            }
          } else if (left !== 999) {
            right = x2;
            break;
          }
        }
        this.compassMaskLineOffsets[y] = left;
        this.compassMaskLineLengths[y] = right - left;
      }
      for (let y = 5;y < 156; y++) {
        let left = 999;
        let right = 0;
        for (let x2 = 25;x2 < 172; x2++) {
          if (this.mapback.data[x2 + y * this.mapback.wi] === 0 && (x2 > 34 || y > 34)) {
            if (left === 999) {
              left = x2;
            }
          } else if (left !== 999) {
            right = x2;
            break;
          }
        }
        this.minimapMaskLineOffsets[y - 5] = left - 25;
        this.minimapMaskLineLengths[y - 5] = right - left;
      }
      Pix3D.setClipping(479, 96);
      this.chatbackScanline = Pix3D.scanline;
      Pix3D.setClipping(190, 261);
      this.sidebarScanline = Pix3D.scanline;
      Pix3D.setClipping(512, 334);
      this.viewportScanline = Pix3D.scanline;
      const distance = new Int32Array(9);
      for (let x2 = 0;x2 < 9; x2++) {
        const angle = x2 * 32 + 128 + 15;
        const offset = angle * 3 + 600;
        const sin = Pix3D.sinTable[angle];
        distance[x2] = offset * sin >> 16;
      }
      World.init(distance, 500, 800, 512, 334);
      WordFilter.unpack(wordenc);
      this.mouseTrackingInterval = setInterval(() => {
        this.mouseTracking.cycle();
      }, 50);
    } catch (e) {
      console.error(e);
      if (e instanceof Error) {
        this.errorMessage = `loaderror - ${this.lastProgressMessage} ${this.lastProgressPercent}%: ${e.message}`;
      }
      this.errorLoading = true;
    }
  }
  async mainloop() {
    if (this.errorStarted || this.errorLoading || this.errorHost) {
      return;
    }
    this.loopCycle++;
    if (!this.ingame) {
      await this.titleScreenLoop();
    } else {
      await this.gameLoop();
    }
    await this.onDemandLoop();
  }
  async maindraw() {
    if (this.errorStarted || this.errorLoading || this.errorHost) {
      this.drawError();
      return;
    }
    this.drawCycle++;
    if (!this.ingame) {
      await this.titleScreenDraw();
    } else {
      this.gameDraw();
    }
    if (this.isMobile) {
      MobileKeyboard_default.draw();
    }
    this.scrollCycle = 0;
  }
  refresh() {
    this.redrawFrame = true;
  }
  async onDemandLoop() {
    if (!this.onDemand) {
      return;
    }
    await this.onDemand.run();
    while (true) {
      const req = this.onDemand.loop();
      if (req === null) {
        return;
      }
      if (!req.data) {
        continue;
      }
      if (req.archive === 0) {
        Model.unpack(req.file, req.data);
        if ((this.onDemand.getModelUse(req.file) & 98) != 0) {
          this.redrawSidebar = true;
          if (this.chatComId !== -1) {
            this.redrawChatback = true;
          }
        }
      } else if (req.archive === 1) {
        AnimFrame.unpack(req.data);
      } else if (req.archive === 2) {
        if (this.midiSong === req.file) {
          this.saveMidi(req.data, this.midiFading);
        }
      } else if (req.archive === 3) {
        if (this.mapBuildGroundData && this.mapBuildLocationData && this.sceneState === 1) {
          for (let i2 = 0;i2 < this.mapBuildGroundData.length; i2++) {
            if (this.mapBuildGroundFile[i2] == req.file) {
              this.mapBuildGroundData[i2] = req.data;
              if (req.data == null) {
                this.mapBuildGroundFile[i2] = -1;
              }
              break;
            }
            if (this.mapBuildLocationFile[i2] == req.file) {
              this.mapBuildLocationData[i2] = req.data;
              if (req.data == null) {
                this.mapBuildLocationFile[i2] = -1;
              }
              break;
            }
          }
        }
      } else if (req.archive === 93) {
        if (this.onDemand.hasMapLocFile(req.file)) {
          ClientBuild.prefetchLocations(new Packet(req.data), this.onDemand);
        }
      }
    }
  }
  async titleScreenLoop() {
    if (this.loginscreen === 0) {
      let x2 = (this.sWid / 2 | 0) - 80;
      let y = (this.sHei / 2 | 0) + 20;
      y += 20;
      if (this.mouseClickButton === 1 && this.mouseClickX >= x2 - 75 && this.mouseClickX <= x2 + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
        this.loginscreen = 3;
        this.loginSelect = 0;
      }
      x2 = (this.sWid / 2 | 0) + 80;
      if (this.mouseClickButton === 1 && this.mouseClickX >= x2 - 75 && this.mouseClickX <= x2 + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
        this.loginMes1 = "";
        this.loginMes2 = "Enter your username & password.";
        this.loginscreen = 2;
        this.loginSelect = 0;
      }
    } else if (this.loginscreen === 2) {
      let y = (this.sHei / 2 | 0) - 40;
      y += 30;
      y += 25;
      if (this.mouseClickButton === 1 && this.mouseClickY >= y - 15 && this.mouseClickY < y) {
        this.loginSelect = 0;
      }
      y += 15;
      if (this.mouseClickButton === 1 && this.mouseClickY >= y - 15 && this.mouseClickY < y) {
        this.loginSelect = 1;
      }
      let x2 = (this.sWid / 2 | 0) - 80;
      y = (this.sHei / 2 | 0) + 50;
      y += 20;
      if (this.mouseClickButton === 1 && this.mouseClickX >= x2 - 75 && this.mouseClickX <= x2 + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
        await this.login(this.loginUser, this.loginPass, false);
        if (this.ingame) {
          return;
        }
      }
      x2 = (this.sWid / 2 | 0) + 80;
      if (this.mouseClickButton === 1 && this.mouseClickX >= x2 - 75 && this.mouseClickX <= x2 + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
        this.loginscreen = 0;
        this.loginUser = "";
        this.loginPass = "";
      }
      while (true) {
        const key = this.pollKey();
        if (key === -1) {
          return;
        }
        let valid = false;
        for (let i2 = 0;i2 < PixFont.CHARSET.length; i2++) {
          if (String.fromCharCode(key) === PixFont.CHARSET.charAt(i2)) {
            valid = true;
            break;
          }
        }
        if (this.loginSelect === 0) {
          if (key === 8 && this.loginUser.length > 0) {
            this.loginUser = this.loginUser.substring(0, this.loginUser.length - 1);
          }
          if (key === 9 || key === 10 || key === 13) {
            this.loginSelect = 1;
          }
          if (valid) {
            this.loginUser = this.loginUser + String.fromCharCode(key);
          }
          if (this.loginUser.length > 12) {
            this.loginUser = this.loginUser.substring(0, 12);
          }
        } else if (this.loginSelect === 1) {
          if (key === 8 && this.loginPass.length > 0) {
            this.loginPass = this.loginPass.substring(0, this.loginPass.length - 1);
          }
          if (key === 9 || key === 10 || key === 13) {
            this.loginSelect = 0;
          }
          if (valid) {
            this.loginPass = this.loginPass + String.fromCharCode(key);
          }
          if (this.loginPass.length > 20) {
            this.loginPass = this.loginPass.substring(0, 20);
          }
        }
      }
    } else if (this.loginscreen === 3) {
      const x2 = this.sWid / 2 | 0;
      let y = (this.sHei / 2 | 0) + 50;
      y += 20;
      if (this.mouseClickButton === 1 && this.mouseClickX >= x2 - 75 && this.mouseClickX <= x2 + 75 && this.mouseClickY >= y - 20 && this.mouseClickY <= y + 20) {
        this.loginscreen = 0;
      }
    }
  }
  async titleScreenDraw() {
    await this.prepareTitle();
    this.imageTitle4?.setPixels();
    this.imageTitlebox?.plotSprite(0, 0);
    const w = 360;
    const h = 200;
    if (this.loginscreen === 0) {
      const extraY = (h / 2 | 0) + 80;
      let y = (h / 2 | 0) - 20;
      if (this.onDemand) {
        this.p11?.centreStringTag(this.onDemand.message, w / 2, extraY, 7711145, true);
      }
      this.b12?.centreStringTag("Welcome to RuneScape", w / 2, y, 16776960 /* YELLOW */, true);
      y += 30;
      let x2 = (w / 2 | 0) - 80;
      y = (h / 2 | 0) + 20;
      this.imageTitlebutton?.plotSprite(x2 - 73, y - 20);
      this.b12?.centreStringTag("New user", x2, y + 5, 16777215 /* WHITE */, true);
      x2 = (w / 2 | 0) + 80;
      this.imageTitlebutton?.plotSprite(x2 - 73, y - 20);
      this.b12?.centreStringTag("Existing User", x2, y + 5, 16777215 /* WHITE */, true);
    } else if (this.loginscreen === 2) {
      let x2 = (w / 2 | 0) - 80;
      let y = (h / 2 | 0) - 40;
      if (this.loginMes1.length > 0) {
        this.b12?.centreStringTag(this.loginMes1, w / 2, y - 15, 16776960 /* YELLOW */, true);
        this.b12?.centreStringTag(this.loginMes2, w / 2, y, 16776960 /* YELLOW */, true);
        y += 30;
      } else {
        this.b12?.centreStringTag(this.loginMes2, w / 2, y - 7, 16776960 /* YELLOW */, true);
        y += 30;
      }
      this.b12?.drawStringTag(`Username: ${this.loginUser}${this.loginSelect === 0 && this.loopCycle % 40 < 20 ? "@yel@|" : ""}`, w / 2 - 90, y, 16777215 /* WHITE */, true);
      y += 15;
      this.b12?.drawStringTag(`Password: ${JString.getRepeatedCharacter(this.loginPass)}${this.loginSelect === 1 && this.loopCycle % 40 < 20 ? "@yel@|" : ""}`, w / 2 - 88, y, 16777215 /* WHITE */, true);
      y += 15;
      x2 = (w / 2 | 0) - 80;
      y = (h / 2 | 0) + 50;
      this.imageTitlebutton?.plotSprite(x2 - 73, y - 20);
      this.b12?.centreStringTag("Login", x2, y + 5, 16777215 /* WHITE */, true);
      x2 = (w / 2 | 0) + 80;
      this.imageTitlebutton?.plotSprite(x2 - 73, y - 20);
      this.b12?.centreStringTag("Cancel", x2, y + 5, 16777215 /* WHITE */, true);
    } else if (this.loginscreen === 3) {
      let x2 = w / 2 | 0;
      let y = (h / 2 | 0) - 60;
      this.b12?.centreStringTag("Create a free account", x2, y, 16776960 /* YELLOW */, true);
      y = (h / 2 | 0) - 35;
      this.b12?.centreStringTag("To create a new account you need to", x2, y, 16777215 /* WHITE */, true);
      y += 15;
      this.b12?.centreStringTag("go back to the main RuneScape webpage", x2, y, 16777215 /* WHITE */, true);
      y += 15;
      this.b12?.centreStringTag("and choose the red 'create account'", x2, y, 16777215 /* WHITE */, true);
      y += 15;
      this.b12?.centreStringTag("button at the top right of that page.", x2, y, 16777215 /* WHITE */, true);
      y += 15;
      x2 = w / 2 | 0;
      y = (h / 2 | 0) + 50;
      this.imageTitlebutton?.plotSprite(x2 - 73, y - 20);
      this.b12?.centreStringTag("Cancel", x2, y + 5, 16777215 /* WHITE */, true);
    }
    this.imageTitle4?.draw(202, 171);
    if (this.redrawFrame) {
      this.redrawFrame = false;
      this.imageTitle2?.draw(128, 0);
      this.imageTitle3?.draw(202, 371);
      this.imageTitle5?.draw(0, 265);
      this.imageTitle6?.draw(562, 265);
      this.imageTitle7?.draw(128, 171);
      this.imageTitle8?.draw(562, 171);
    }
  }
  async prepareTitle() {
    if (this.imageTitle2) {
      return;
    }
    this.drawArea = null;
    this.areaChatback = null;
    this.areaMapback = null;
    this.areaSidebar = null;
    this.areaViewport = null;
    this.areaBackbase1 = null;
    this.areaBackbase2 = null;
    this.areaBackhmid1 = null;
    this.imageTitle0 = new PixMap(128, 265);
    Pix2D.cls();
    this.imageTitle1 = new PixMap(128, 265);
    Pix2D.cls();
    this.imageTitle2 = new PixMap(509, 171);
    Pix2D.cls();
    this.imageTitle3 = new PixMap(360, 132);
    Pix2D.cls();
    this.imageTitle4 = new PixMap(360, 200);
    Pix2D.cls();
    this.imageTitle5 = new PixMap(202, 238);
    Pix2D.cls();
    this.imageTitle6 = new PixMap(203, 238);
    Pix2D.cls();
    this.imageTitle7 = new PixMap(74, 94);
    Pix2D.cls();
    this.imageTitle8 = new PixMap(75, 94);
    Pix2D.cls();
    if (this.title) {
      await this.loadTitleBackground();
      this.loadTitleImages();
    }
    this.redrawFrame = true;
  }
  async loadTitleBackground() {
    if (!this.title) {
      return;
    }
    const background = await Pix32.fromJpeg(this.title, "title");
    this.imageTitle0?.setPixels();
    background.quickPlotSprite(0, 0);
    this.imageTitle1?.setPixels();
    background.quickPlotSprite(-637, 0);
    this.imageTitle2?.setPixels();
    background.quickPlotSprite(-128, 0);
    this.imageTitle3?.setPixels();
    background.quickPlotSprite(-202, -371);
    this.imageTitle4?.setPixels();
    background.quickPlotSprite(-202, -171);
    this.imageTitle5?.setPixels();
    background.quickPlotSprite(0, -265);
    this.imageTitle6?.setPixels();
    background.quickPlotSprite(-562, -265);
    this.imageTitle7?.setPixels();
    background.quickPlotSprite(-128, -171);
    this.imageTitle8?.setPixels();
    background.quickPlotSprite(-562, -171);
    background.hflip();
    this.imageTitle0?.setPixels();
    background.quickPlotSprite(382, 0);
    this.imageTitle1?.setPixels();
    background.quickPlotSprite(-255, 0);
    this.imageTitle2?.setPixels();
    background.quickPlotSprite(254, 0);
    this.imageTitle3?.setPixels();
    background.quickPlotSprite(180, -371);
    this.imageTitle4?.setPixels();
    background.quickPlotSprite(180, -171);
    this.imageTitle5?.setPixels();
    background.quickPlotSprite(382, -265);
    this.imageTitle6?.setPixels();
    background.quickPlotSprite(-180, -265);
    this.imageTitle7?.setPixels();
    background.quickPlotSprite(254, -171);
    this.imageTitle8?.setPixels();
    background.quickPlotSprite(-180, -171);
    const logo = Pix32.depack(this.title, "logo");
    this.imageTitle2?.setPixels();
    logo.plotSprite((this.sWid / 2 | 0) - (logo.wi / 2 | 0) - 128, 18);
  }
  loadTitleImages() {
    if (!this.title) {
      return;
    }
    this.imageTitlebox = Pix8.depack(this.title, "titlebox");
    this.imageTitlebutton = Pix8.depack(this.title, "titlebutton");
    for (let i2 = 0;i2 < 12; i2++) {
      this.imageRunes[i2] = Pix8.depack(this.title, "runes", i2);
    }
    this.imageFlamesLeft = new Pix32(128, 265);
    this.imageFlamesRight = new Pix32(128, 265);
    if (this.imageTitle0)
      arraycopy(this.imageTitle0.data, 0, this.imageFlamesLeft.data, 0, 33920);
    if (this.imageTitle1)
      arraycopy(this.imageTitle1.data, 0, this.imageFlamesRight.data, 0, 33920);
    this.flameGradient0 = new Int32Array(256);
    for (let index = 0;index < 64; index++) {
      this.flameGradient0[index] = index * 262144;
    }
    for (let index = 0;index < 64; index++) {
      this.flameGradient0[index + 64] = index * 1024 + 16711680 /* RED */;
    }
    for (let index = 0;index < 64; index++) {
      this.flameGradient0[index + 128] = index * 4 + 16776960 /* YELLOW */;
    }
    for (let index = 0;index < 64; index++) {
      this.flameGradient0[index + 192] = 16777215 /* WHITE */;
    }
    this.flameGradient1 = new Int32Array(256);
    for (let index = 0;index < 64; index++) {
      this.flameGradient1[index] = index * 1024;
    }
    for (let index = 0;index < 64; index++) {
      this.flameGradient1[index + 64] = index * 4 + 65280 /* GREEN */;
    }
    for (let index = 0;index < 64; index++) {
      this.flameGradient1[index + 128] = index * 262144 + 65535 /* CYAN */;
    }
    for (let index = 0;index < 64; index++) {
      this.flameGradient1[index + 192] = 16777215 /* WHITE */;
    }
    this.flameGradient2 = new Int32Array(256);
    for (let index = 0;index < 64; index++) {
      this.flameGradient2[index] = index * 4;
    }
    for (let index = 0;index < 64; index++) {
      this.flameGradient2[index + 64] = index * 262144 + 255 /* BLUE */;
    }
    for (let index = 0;index < 64; index++) {
      this.flameGradient2[index + 128] = index * 1024 + 16711935 /* MAGENTA */;
    }
    for (let index = 0;index < 64; index++) {
      this.flameGradient2[index + 192] = 16777215 /* WHITE */;
    }
    this.flameGradient = new Int32Array(256);
    this.flameBuffer0 = new Int32Array(32768);
    this.flameBuffer1 = new Int32Array(32768);
    this.generateFlameCoolingMap(null);
    this.flameBuffer3 = new Int32Array(32768);
    this.flameBuffer2 = new Int32Array(32768);
    this.messageBox("Connecting to fileserver", 10).then(() => {
      if (!this.flameActive) {
        this.flameActive = true;
        this.flamesInterval = setInterval(this.renderFlames.bind(this), 35);
      }
    });
  }
  renderFlames() {
    if (!this.flameActive) {
      return;
    }
    this.flameCycle++;
    this.updateFlames();
    this.updateFlames();
    this.drawFlames();
  }
  updateFlames() {
    if (!this.flameBuffer3 || !this.flameBuffer2 || !this.flameBuffer0 || !this.flameLineOffset) {
      return;
    }
    const height = 256;
    for (let x2 = 10;x2 < 117; x2++) {
      const rand = Math.random() * 100 | 0;
      if (rand < 50)
        this.flameBuffer3[x2 + (height - 2 << 7)] = 255;
    }
    for (let l = 0;l < 100; l++) {
      const x2 = (Math.random() * 124 | 0) + 2;
      const y = (Math.random() * 128 | 0) + 128;
      const index = x2 + (y << 7);
      this.flameBuffer3[index] = 192;
    }
    for (let y = 1;y < height - 1; y++) {
      for (let x2 = 1;x2 < 127; x2++) {
        const index = x2 + (y << 7);
        this.flameBuffer2[index] = (this.flameBuffer3[index - 1] + this.flameBuffer3[index + 1] + this.flameBuffer3[index - 128] + this.flameBuffer3[index + 128]) / 4 | 0;
      }
    }
    this.flameCycle0 += 128;
    if (this.flameCycle0 > this.flameBuffer0.length) {
      this.flameCycle0 -= this.flameBuffer0.length;
      this.generateFlameCoolingMap(this.imageRunes[Math.random() * 12 | 0]);
    }
    for (let y = 1;y < height - 1; y++) {
      for (let x2 = 1;x2 < 127; x2++) {
        const index = x2 + (y << 7);
        let intensity = this.flameBuffer2[index + 128] - (this.flameBuffer0[index + this.flameCycle0 & this.flameBuffer0.length - 1] / 5 | 0);
        if (intensity < 0) {
          intensity = 0;
        }
        this.flameBuffer3[index] = intensity;
      }
    }
    for (let y = 0;y < height - 1; y++) {
      this.flameLineOffset[y] = this.flameLineOffset[y + 1];
    }
    this.flameLineOffset[height - 1] = Math.sin(this.loopCycle / 14) * 16 + Math.sin(this.loopCycle / 15) * 14 + Math.sin(this.loopCycle / 16) * 12 | 0;
    if (this.flameGradientCycle0 > 0) {
      this.flameGradientCycle0 -= 4;
    }
    if (this.flameGradientCycle1 > 0) {
      this.flameGradientCycle1 -= 4;
    }
    if (this.flameGradientCycle0 === 0 && this.flameGradientCycle1 === 0) {
      const rand = Math.random() * 2000 | 0;
      if (rand === 0) {
        this.flameGradientCycle0 = 1024;
      } else if (rand === 1) {
        this.flameGradientCycle1 = 1024;
      }
    }
  }
  generateFlameCoolingMap(image) {
    if (!this.flameBuffer0 || !this.flameBuffer1) {
      return;
    }
    const flameHeight = 256;
    this.flameBuffer0.fill(0);
    for (let i2 = 0;i2 < 5000; i2++) {
      const rand = Math.random() * 128 * flameHeight | 0;
      this.flameBuffer0[rand] = Math.random() * 256 | 0;
    }
    for (let i2 = 0;i2 < 20; i2++) {
      for (let y = 1;y < flameHeight - 1; y++) {
        for (let x2 = 1;x2 < 127; x2++) {
          const index = x2 + (y << 7);
          this.flameBuffer1[index] = (this.flameBuffer0[index - 1] + this.flameBuffer0[index + 1] + this.flameBuffer0[index - 128] + this.flameBuffer0[index + 128]) / 4 | 0;
        }
      }
      const last = this.flameBuffer0;
      this.flameBuffer0 = this.flameBuffer1;
      this.flameBuffer1 = last;
    }
    if (image) {
      let off = 0;
      for (let y = 0;y < image.hi; y++) {
        for (let x2 = 0;x2 < image.wi; x2++) {
          if (image.data[off++] !== 0) {
            const x0 = x2 + image.xof + 16;
            const y0 = y + image.yof + 16;
            const index = x0 + (y0 << 7);
            this.flameBuffer0[index] = 0;
          }
        }
      }
    }
  }
  drawFlames() {
    if (!this.flameGradient || !this.flameGradient0 || !this.flameGradient1 || !this.flameGradient2 || !this.flameLineOffset || !this.flameBuffer3) {
      return;
    }
    const height = 256;
    if (this.flameGradientCycle0 > 0) {
      for (let i2 = 0;i2 < 256; i2++) {
        if (this.flameGradientCycle0 > 768) {
          this.flameGradient[i2] = this.titleFlamesMerge(this.flameGradient0[i2], this.flameGradient1[i2], 1024 - this.flameGradientCycle0);
        } else if (this.flameGradientCycle0 > 256) {
          this.flameGradient[i2] = this.flameGradient1[i2];
        } else {
          this.flameGradient[i2] = this.titleFlamesMerge(this.flameGradient1[i2], this.flameGradient0[i2], 256 - this.flameGradientCycle0);
        }
      }
    } else if (this.flameGradientCycle1 > 0) {
      for (let i2 = 0;i2 < 256; i2++) {
        if (this.flameGradientCycle1 > 768) {
          this.flameGradient[i2] = this.titleFlamesMerge(this.flameGradient0[i2], this.flameGradient2[i2], 1024 - this.flameGradientCycle1);
        } else if (this.flameGradientCycle1 > 256) {
          this.flameGradient[i2] = this.flameGradient2[i2];
        } else {
          this.flameGradient[i2] = this.titleFlamesMerge(this.flameGradient2[i2], this.flameGradient0[i2], 256 - this.flameGradientCycle1);
        }
      }
    } else {
      for (let i2 = 0;i2 < 256; i2++) {
        this.flameGradient[i2] = this.flameGradient0[i2];
      }
    }
    for (let i2 = 0;i2 < 33920; i2++) {
      if (this.imageTitle0 && this.imageFlamesLeft)
        this.imageTitle0.data[i2] = this.imageFlamesLeft.data[i2];
    }
    let srcOffset = 0;
    let dstOffset = 1152;
    for (let y = 1;y < height - 1; y++) {
      const offset = this.flameLineOffset[y] * (height - y) / height | 0;
      let step = offset + 22;
      if (step < 0) {
        step = 0;
      }
      srcOffset += step;
      for (let x2 = step;x2 < 128; x2++) {
        let value = this.flameBuffer3[srcOffset++];
        if (value === 0) {
          dstOffset++;
        } else {
          const alpha = value;
          const invAlpha = 256 - value;
          value = this.flameGradient[value];
          if (this.imageTitle0) {
            const background = this.imageTitle0.data[dstOffset];
            this.imageTitle0.data[dstOffset++] = ((value & 16711935) * alpha + (background & 16711935) * invAlpha & 4278255360) + ((value & 65280) * alpha + (background & 65280) * invAlpha & 16711680) >> 8;
          }
        }
      }
      dstOffset += step;
    }
    this.imageTitle0?.draw(0, 0);
    for (let i2 = 0;i2 < 33920; i2++) {
      if (this.imageTitle1 && this.imageFlamesRight) {
        this.imageTitle1.data[i2] = this.imageFlamesRight.data[i2];
      }
    }
    srcOffset = 0;
    dstOffset = 1176;
    for (let y = 1;y < height - 1; y++) {
      const offset = this.flameLineOffset[y] * (height - y) / height | 0;
      const step = 103 - offset;
      dstOffset += offset;
      for (let x2 = 0;x2 < step; x2++) {
        let value = this.flameBuffer3[srcOffset++];
        if (value === 0) {
          dstOffset++;
        } else {
          const alpha = value;
          const invAlpha = 256 - value;
          value = this.flameGradient[value];
          if (this.imageTitle1) {
            const background = this.imageTitle1.data[dstOffset];
            this.imageTitle1.data[dstOffset++] = ((value & 16711935) * alpha + (background & 16711935) * invAlpha & 4278255360) + ((value & 65280) * alpha + (background & 65280) * invAlpha & 16711680) >> 8;
          }
        }
      }
      srcOffset += 128 - step;
      dstOffset += 128 - step - offset;
    }
    this.imageTitle1?.draw(637, 0);
  }
  titleFlamesMerge(src, dst, alpha) {
    const invAlpha = 256 - alpha;
    return ((src & 16711935) * invAlpha + (dst & 16711935) * alpha & 4278255360) + ((src & 65280) * invAlpha + (dst & 65280) * alpha & 16711680) >> 8;
  }
  async login(username, password, reconnect) {
    try {
      if (!reconnect) {
        this.loginMes1 = "";
        this.loginMes2 = "Connecting to server...";
        await this.titleScreenDraw();
      }
      const wasFlameActive = this.flameActive;
      this.flameActive = false;
      if (this.flamesInterval) {
        clearInterval(this.flamesInterval);
        this.flamesInterval = null;
      }
      if (this.mouseTrackingInterval) {
        clearInterval(this.mouseTrackingInterval);
        this.mouseTrackingInterval = null;
      }
      let socket;
      try {
        socket = await ClientStream.openSocket(window.location.host, window.location.protocol === "https:");
      } catch (e) {
        if (wasFlameActive) {
          this.flameActive = true;
          this.flamesInterval = setInterval(this.renderFlames.bind(this), 35);
        }
        this.mouseTrackingInterval = setInterval(() => {
          this.mouseTracking.cycle();
        }, 50);
        throw e;
      }
      this.mouseTrackingInterval = setInterval(() => {
        this.mouseTracking.cycle();
      }, 50);
      this.stream = new ClientStream(socket);
      const userhash = JString.toUserhash(username);
      const loginServer = Number(userhash >> 16n) & 31;
      this.out.pos = 0;
      this.out.p1(14);
      this.out.p1(loginServer);
      this.stream.write(this.out.data, 2);
      for (let i2 = 0;i2 < 8; i2++) {
        await this.stream.read();
      }
      let response = await this.stream.read();
      if (response === 0) {
        await this.stream.readBytes(this.in.data, 0, 8);
        this.in.pos = 0;
        this.loginSeed = this.in.g8();
        const seed = new Int32Array([
          Math.floor(Math.random() * 99999999),
          Math.floor(Math.random() * 99999999),
          Number(this.loginSeed >> 32n),
          Number(this.loginSeed & BigInt(4294967295))
        ]);
        this.out.pos = 0;
        this.out.p1(10);
        this.out.p4(seed[0]);
        this.out.p4(seed[1]);
        this.out.p4(seed[2]);
        this.out.p4(seed[3]);
        this.out.p4(1337);
        this.out.pjstr(username);
        this.out.pjstr(password);
        this.out.rsaenc(BigInt("7162900525229798032761816791230527296329313291232324290237849263501208207972894053929065636522363163621000728841182238772712427862772219676577293600221789"), BigInt("58778699976184461502525193738213253649000149147835990136706041084440742975821"));
        this.loginout.pos = 0;
        if (reconnect) {
          this.loginout.p1(18);
        } else {
          this.loginout.p1(16);
        }
        this.loginout.p1(this.out.pos + 36 + 1 + 1);
        this.loginout.p1(CLIENT_VERSION);
        this.loginout.p1(Client.lowMem ? 1 : 0);
        for (let i2 = 0;i2 < 9; i2++) {
          this.loginout.p4(this.jagChecksum[i2]);
        }
        this.loginout.pdata(this.out.data, this.out.pos, 0);
        this.out.random = new Isaac(seed);
        for (let i2 = 0;i2 < 4; i2++) {
          seed[i2] += 50;
        }
        this.randomIn = new Isaac(seed);
        this.stream?.write(this.loginout.data, this.loginout.pos);
        response = await this.stream.read();
      }
      if (response === 1) {
        await sleep(2000);
        await this.login(username, password, reconnect);
      } else if (response === 2) {
        this.staffmodlevel = await this.stream.read();
        this.mouseTracked = await this.stream.read() === 1;
        InputTracking.deactivate();
        this.prevMouseClickTime = 0;
        this.mouseTrackedDelta = 0;
        this.mouseTracking.length = 0;
        this.focus = true;
        this.focusIn = true;
        this.ingame = true;
        this.out.pos = 0;
        this.in.pos = 0;
        this.ptype = -1;
        this.ptype0 = -1;
        this.ptype1 = -1;
        this.ptype2 = -1;
        this.psize = 0;
        this.timeoutTimer = performance.now();
        this.rebootTimer = 0;
        this.logoutTimer = 0;
        this.hintType = 0;
        this.menuNumEntries = 0;
        this.isMenuOpen = false;
        this.idleTimer = performance.now();
        for (let i2 = 0;i2 < 100; i2++) {
          this.chatText[i2] = null;
        }
        this.useMode = 0;
        this.targetMode = 0;
        this.sceneState = 0;
        this.waveCount = 0;
        this.macroCameraX = (Math.random() * 100 | 0) - 50;
        this.macroCameraZ = (Math.random() * 110 | 0) - 55;
        this.macroCameraAngle = (Math.random() * 80 | 0) - 40;
        this.macroMinimapAngle = (Math.random() * 120 | 0) - 60;
        this.macroMinimapZoom = (Math.random() * 30 | 0) - 20;
        this.orbitCameraYaw = (Math.random() * 20 | 0) - 10 & 2047;
        this.minimapLevel = -1;
        this.minimapFlagX = 0;
        this.minimapFlagZ = 0;
        this.playerCount = 0;
        this.npcCount = 0;
        for (let i2 = 0;i2 < MAX_PLAYER_COUNT; i2++) {
          this.players[i2] = null;
          this.playerAppearanceBuffer[i2] = null;
        }
        for (let i2 = 0;i2 < 16384; i2++) {
          this.npc[i2] = null;
        }
        this.localPlayer = this.players[LOCAL_PLAYER_INDEX] = new ClientPlayer;
        this.projectiles.clear();
        this.spotanims.clear();
        for (let level = 0;level < 4 /* LEVELS */; level++) {
          for (let x2 = 0;x2 < 104 /* SIZE */; x2++) {
            for (let z = 0;z < 104 /* SIZE */; z++) {
              this.groundObj[level][x2][z] = null;
            }
          }
        }
        this.locChanges = new LinkList;
        this.friendServerStatus = 0;
        this.friendCount = 0;
        this.tutComId = -1;
        this.chatComId = -1;
        this.mainModalId = -1;
        this.sideModalId = -1;
        this.mainOverlayId = -1;
        this.resumedPauseButton = false;
        this.sideTab = 3;
        this.dialogInputOpen = false;
        this.isMenuOpen = false;
        this.socialInputOpen = false;
        this.tutComMessage = null;
        this.inMultizone = 0;
        this.tutFlashingTab = -1;
        this.idkDesignGender = true;
        this.validateIdkDesign();
        for (let i2 = 0;i2 < 5; i2++) {
          this.idkDesignColour[i2] = 0;
        }
        for (let i2 = 0;i2 < 5; i2++) {
          this.playerOp[i2] = null;
          this.playerOpPriority[i2] = false;
        }
        Client.oplogic1 = 0;
        Client.oplogic2 = 0;
        Client.oplogic3 = 0;
        Client.oplogic4 = 0;
        Client.oplogic5 = 0;
        Client.oplogic6 = 0;
        Client.oplogic7 = 0;
        Client.oplogic8 = 0;
        Client.oplogic9 = 0;
        Client.oplogic10 = 0;
        this.prepareGame();
      } else if (response === 3) {
        this.loginMes1 = "";
        this.loginMes2 = "Invalid username or password.";
      } else if (response === 4) {
        this.loginMes1 = "Your account has been disabled.";
        this.loginMes2 = "Please check your message-centre for details.";
      } else if (response === 5) {
        this.loginMes1 = "Your account is already logged in.";
        this.loginMes2 = "Try again in 60 secs...";
      } else if (response === 6) {
        this.loginMes1 = "RuneScape has been updated!";
        this.loginMes2 = "Please reload this page.";
      } else if (response === 7) {
        this.loginMes1 = "This world is full.";
        this.loginMes2 = "Please use a different world.";
      } else if (response === 8) {
        this.loginMes1 = "Unable to connect.";
        this.loginMes2 = "Login server offline.";
      } else if (response === 9) {
        this.loginMes1 = "Login limit exceeded.";
        this.loginMes2 = "Too many connections from your address.";
      } else if (response === 10) {
        this.loginMes1 = "Unable to connect.";
        this.loginMes2 = "Bad session id.";
      } else if (response === 11) {
        this.loginMes2 = "Login server rejected session.";
        this.loginMes2 = "Please try again.";
      } else if (response === 12) {
        this.loginMes1 = "You need a members account to login to this world.";
        this.loginMes2 = "Please subscribe, or use a different world.";
      } else if (response === 13) {
        this.loginMes1 = "Could not complete login.";
        this.loginMes2 = "Please try using a different world.";
      } else if (response === 14) {
        this.loginMes1 = "The server is being updated.";
        this.loginMes2 = "Please wait 1 minute and try again.";
      } else if (response === 15) {
        this.ingame = true;
        this.out.pos = 0;
        this.in.pos = 0;
        this.ptype = -1;
        this.ptype0 = -1;
        this.ptype1 = -1;
        this.ptype2 = -1;
        this.psize = 0;
        this.timeoutTimer = performance.now();
        this.rebootTimer = 0;
        this.menuNumEntries = 0;
        this.isMenuOpen = false;
        this.sceneLoadStartTime = performance.now();
      } else if (response === 16) {
        this.loginMes1 = "Login attempts exceeded.";
        this.loginMes2 = "Please wait 1 minute and try again.";
      } else if (response === 17) {
        this.loginMes1 = "You are standing in a members-only area.";
        this.loginMes2 = "To play on this world move to a free area first";
      } else if (response === 20) {
        this.loginMes1 = "Invalid loginserver requested";
        this.loginMes2 = "Please try using a different world.";
      } else if (response === 21) {
        for (let remaining = await this.stream.read();remaining >= 0; remaining--) {
          this.loginMes1 = "You have only just left another world";
          this.loginMes2 = "Your profile will be transferred in: " + remaining + " seconds.";
          await this.titleScreenDraw();
          await sleep(1000);
        }
        await this.login(username, password, reconnect);
      } else {
        console.log("response:" + response);
        this.loginMes1 = "Unexpected server response";
        this.loginMes2 = "Please try using a different world.";
      }
    } catch (e) {
      if ((e instanceof WebSocket || e instanceof WorkerWebSocket) && e.readyState === 3) {
        this.loginMes1 = "";
        this.loginMes2 = "Error connecting to server.";
      } else {
        throw e;
      }
    }
  }
  unloadTitle() {
    this.flameActive = false;
    if (this.flamesInterval) {
      clearInterval(this.flamesInterval);
      this.flamesInterval = null;
    }
    this.imageTitlebox = null;
    this.imageTitlebutton = null;
    this.imageRunes = [];
    this.flameGradient = null;
    this.flameGradient0 = null;
    this.flameGradient1 = null;
    this.flameGradient2 = null;
    this.flameBuffer0 = null;
    this.flameBuffer1 = null;
    this.flameBuffer3 = null;
    this.flameBuffer2 = null;
    this.imageFlamesLeft = null;
    this.imageFlamesRight = null;
  }
  prepareGame() {
    if (this.areaChatback) {
      return;
    }
    this.unloadTitle();
    this.drawArea = null;
    this.imageTitle2 = null;
    this.imageTitle3 = null;
    this.imageTitle4 = null;
    this.imageTitle0 = null;
    this.imageTitle1 = null;
    this.imageTitle5 = null;
    this.imageTitle6 = null;
    this.imageTitle7 = null;
    this.imageTitle8 = null;
    this.areaChatback = new PixMap(479, 96);
    this.areaMapback = new PixMap(172, 156);
    Pix2D.cls();
    this.mapback?.plotSprite(0, 0);
    this.areaSidebar = new PixMap(190, 261);
    this.areaViewport = new PixMap(512, 334);
    Pix2D.cls();
    this.areaBackbase1 = new PixMap(496, 50);
    this.areaBackbase2 = new PixMap(269, 37);
    this.areaBackhmid1 = new PixMap(249, 45);
    this.redrawFrame = true;
  }
  async gameLoop() {
    if (this.players === null) {
      return;
    }
    if (this.rebootTimer > 1) {
      this.rebootTimer--;
    }
    if (this.logoutTimer > 0) {
      this.logoutTimer--;
    }
    for (let i2 = 0;i2 < 5 && await this.tcpIn(); i2++) {}
    const now = performance.now();
    if (!this.ingame) {
      return;
    }
    if (!this.mouseTracked) {
      this.mouseTracking.length = 0;
    } else if (this.mouseClickButton !== 0 || this.mouseTracking.length >= 40) {
      this.out.pIsaac(232 /* EVENT_MOUSE_MOVE */);
      this.out.p1(0);
      const start = this.out.pos;
      let count = 0;
      for (let i2 = 0;i2 < this.mouseTracking.length && this.out.pos - start < 240; i2++) {
        count++;
        let y = this.mouseTracking.y[i2];
        if (y < 0) {
          y = 0;
        } else if (y > 502) {
          y = 502;
        }
        let x2 = this.mouseTracking.x[i2];
        if (x2 < 0) {
          x2 = 0;
        } else if (x2 > 764) {
          x2 = 764;
        }
        let pos = y * 765 + x2;
        if (this.mouseTracking.y[i2] === -1 && this.mouseTracking.x[i2] === -1) {
          x2 = -1;
          y = -1;
          pos = 524287;
        }
        if (x2 !== this.mouseTrackedX || y !== this.mouseTrackedY) {
          let dx = x2 - this.mouseTrackedX;
          this.mouseTrackedX = x2;
          let dy = y - this.mouseTrackedY;
          this.mouseTrackedY = y;
          if (this.mouseTrackedDelta < 8 && dx >= -32 && dx <= 31 && dy >= -32 && dy <= 31) {
            dx += 32;
            dy += 32;
            this.out.p2((this.mouseTrackedDelta << 12) + (dx << 6) + dy);
            this.mouseTrackedDelta = 0;
          } else if (this.mouseTrackedDelta < 8) {
            this.out.p3(8388608 + (this.mouseTrackedDelta << 19) + pos);
            this.mouseTrackedDelta = 0;
          } else {
            this.out.p4(3221225472 + (this.mouseTrackedDelta << 19) + pos);
            this.mouseTrackedDelta = 0;
          }
        } else if (this.mouseTrackedDelta < 2047) {
          this.mouseTrackedDelta++;
        }
      }
      this.out.psize1(this.out.pos - start);
      if (count >= this.mouseTracking.length) {
        this.mouseTracking.length = 0;
      } else {
        this.mouseTracking.length -= count;
        for (let i2 = 0;i2 < this.mouseTracking.length; i2++) {
          this.mouseTracking.x[i2] = this.mouseTracking.x[i2 + count];
          this.mouseTracking.y[i2] = this.mouseTracking.y[i2 + count];
        }
      }
    }
    if (this.mouseClickButton !== 0) {
      let delta = (this.mouseClickTime - this.prevMouseClickTime) / 50 | 0;
      if (delta > 4095) {
        delta = 4095;
      }
      this.prevMouseClickTime = this.mouseClickTime;
      let y = this.mouseClickY;
      if (y < 0) {
        y = 0;
      } else if (y > 502) {
        y = 502;
      }
      let x2 = this.mouseClickX;
      if (x2 < 0) {
        x2 = 0;
      } else if (x2 > 764) {
        x2 = 764;
      }
      const pos = y * 765 + x2;
      let button = 0;
      if (this.mouseClickButton === 2) {
        button = 1;
      }
      this.out.pIsaac(234 /* EVENT_MOUSE_CLICK */);
      this.out.p4((delta << 20) + (button << 19) + pos);
    }
    if (this.sendCameraDelay > 0) {
      this.sendCameraDelay--;
    }
    if (this.keyHeld[1] === 1 || this.keyHeld[2] === 1 || this.keyHeld[3] === 1 || this.keyHeld[4] === 1) {
      this.sendCamera = true;
    }
    if (this.sendCamera && this.sendCameraDelay <= 0) {
      this.sendCameraDelay = 20;
      this.sendCamera = false;
      this.out.pIsaac(91 /* EVENT_CAMERA_POSITION */);
      this.out.p2(this.orbitCameraPitch);
      this.out.p2(this.orbitCameraYaw);
    }
    if (this.focus && !this.focusIn) {
      this.focusIn = true;
      this.out.pIsaac(8 /* EVENT_APPLET_FOCUS */);
      this.out.p1(1);
    } else if (!this.focus && this.focusIn) {
      this.focusIn = false;
      this.out.pIsaac(8 /* EVENT_APPLET_FOCUS */);
      this.out.p1(0);
    }
    this.checkMinimap();
    this.locChangeDoQueue();
    await this.soundsDoQueue();
    const tracking = InputTracking.flush();
    if (tracking) {
      this.out.pIsaac(142 /* EVENT_TRACKING */);
      this.out.p2(tracking.pos);
      this.out.pdata(tracking.data, tracking.pos, 0);
      tracking.release();
    }
    if (now - this.timeoutTimer > 15000) {
      await this.lostCon();
    }
    this.movePlayers();
    this.moveNpcs();
    this.timeoutChat();
    this.worldUpdateNum++;
    if (this.crossMode !== 0) {
      this.crossCycle += 20;
      if (this.crossCycle >= 400) {
        this.crossMode = 0;
      }
    }
    if (this.selectedArea !== 0) {
      this.selectedCycle++;
      if (this.selectedCycle >= 15) {
        if (this.selectedArea === 2) {
          this.redrawSidebar = true;
        }
        if (this.selectedArea === 3) {
          this.redrawChatback = true;
        }
        this.selectedArea = 0;
      }
    }
    if (this.objDragArea !== 0) {
      this.objDragCycles++;
      if (this.mouseX > this.objGrabX + 5 || this.mouseX < this.objGrabX - 5 || this.mouseY > this.objGrabY + 5 || this.mouseY < this.objGrabY - 5) {
        this.objGrabThreshold = true;
      }
      if (this.mouseButton === 0) {
        if (this.objDragArea === 2) {
          this.redrawSidebar = true;
        }
        if (this.objDragArea === 3) {
          this.redrawChatback = true;
        }
        this.objDragArea = 0;
        if (this.objGrabThreshold && this.objDragCycles >= 5) {
          this.hoveredSlotComId = -1;
          this.buildMinimenu();
          if (this.hoveredSlotComId === this.objDragComId && this.hoveredSlot !== this.objDragSlot) {
            const com = IfType.list[this.objDragComId];
            let mode = 0;
            if (this.bankArrangeMode == 1 && com.clientCode == 206 /* CC_BANKMODE */) {
              mode = 1;
            }
            if (com.linkObjType && com.linkObjType[this.hoveredSlot] <= 0) {
              mode = 0;
            }
            if (com.objReplace && com.linkObjType && com.linkObjNumber) {
              const src = this.objDragSlot;
              const dst = this.hoveredSlot;
              com.linkObjType[dst] = com.linkObjType[src];
              com.linkObjNumber[dst] = com.linkObjNumber[src];
              com.linkObjType[src] = -1;
              com.linkObjNumber[src] = 0;
            } else if (mode == 1) {
              let src = this.objDragSlot;
              const dst = this.hoveredSlot;
              while (src != dst) {
                if (src > dst) {
                  com.swapSlots(src, src - 1);
                  src--;
                } else if (src < dst) {
                  com.swapSlots(src, src + 1);
                  src++;
                }
              }
            } else {
              com.swapSlots(this.objDragSlot, this.hoveredSlot);
            }
            this.out.pIsaac(176 /* INV_BUTTOND */);
            this.out.p2(this.objDragComId);
            this.out.p2(this.objDragSlot);
            this.out.p2(this.hoveredSlot);
            this.out.p1(mode);
          }
        } else if ((this.oneMouseButton === 1 || this.isAddFriendOption(this.menuNumEntries - 1)) && this.menuNumEntries > 2) {
          this.openMenu();
        } else if (this.menuNumEntries > 0) {
          this.doAction(this.menuNumEntries - 1);
        }
        this.selectedCycle = 10;
        this.mouseClickButton = 0;
      }
    }
    Client.cyclelogic7++;
    if (Client.cyclelogic7 > 62) {
      Client.cyclelogic7 = 0;
      this.out.pIsaac(182 /* ANTICHEAT_CYCLELOGIC7 */);
    }
    if (World.groundX !== -1) {
      if (this.localPlayer) {
        const x2 = World.groundX;
        const z = World.groundZ;
        const success = this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], x2, z, true, 0, 0, 0, 0, 0, 0);
        World.groundX = -1;
        if (success) {
          this.crossX = this.mouseClickX;
          this.crossY = this.mouseClickY;
          this.crossMode = 1;
          this.crossCycle = 0;
        }
      }
    }
    if (this.mouseClickButton === 1 && this.tutComMessage) {
      this.tutComMessage = null;
      this.redrawChatback = true;
      this.mouseClickButton = 0;
    }
    const checkClickInput = !this.isMobile || this.isMobile && !MobileKeyboard_default.isWithinCanvasKeyboard(this.mouseClickX, this.mouseClickY);
    if (checkClickInput) {
      this.mouseLoop();
      this.minimapLoop();
      this.tabLoop();
      this.chatModeLoop();
    }
    if (this.mouseButton === 1 || this.mouseClickButton === 1) {
      this.scrollCycle++;
    }
    if (this.sceneState === 2) {
      this.followCamera();
    }
    if (this.sceneState === 2 && this.cinemaCam) {
      this.cinemaCamera();
    }
    for (let i2 = 0;i2 < 5; i2++) {
      this.camShakeCycle[i2]++;
    }
    await this.handleInputKey();
    if (now - this.idleTimer > 90000) {
      this.logoutTimer = 250;
      this.idleTimer += 1e4;
      this.out.pIsaac(144 /* IDLE_TIMER */);
    }
    this.macroCameraCycle++;
    if (this.macroCameraCycle > 500) {
      this.macroCameraCycle = 0;
      const rand = Math.random() * 8 | 0;
      if ((rand & 1) === 1) {
        this.macroCameraX += this.macroCameraXModifier;
      }
      if ((rand & 2) === 2) {
        this.macroCameraZ += this.macroCameraZModifier;
      }
      if ((rand & 4) === 4) {
        this.macroCameraAngle += this.macroCameraAngleModifier;
      }
    }
    if (this.macroCameraX < -50) {
      this.macroCameraXModifier = 2;
    }
    if (this.macroCameraX > 50) {
      this.macroCameraXModifier = -2;
    }
    if (this.macroCameraZ < -55) {
      this.macroCameraZModifier = 2;
    }
    if (this.macroCameraZ > 55) {
      this.macroCameraZModifier = -2;
    }
    if (this.macroCameraAngle < -40) {
      this.macroCameraAngleModifier = 1;
    }
    if (this.macroCameraAngle > 40) {
      this.macroCameraAngleModifier = -1;
    }
    this.macroMinimapCycle++;
    if (this.macroMinimapCycle > 500) {
      this.macroMinimapCycle = 0;
      const rand = Math.random() * 8 | 0;
      if ((rand & 1) === 1) {
        this.macroMinimapAngle += this.macroMinimapAngleModifier;
      }
      if ((rand & 2) === 2) {
        this.macroMinimapZoom += this.macroMinimapZoomModifier;
      }
    }
    if (this.macroMinimapAngle < -60) {
      this.macroMinimapAngleModifier = 2;
    }
    if (this.macroMinimapAngle > 60) {
      this.macroMinimapAngleModifier = -2;
    }
    if (this.macroMinimapZoom < -20) {
      this.macroMinimapZoomModifier = 1;
    }
    if (this.macroMinimapZoom > 10) {
      this.macroMinimapZoomModifier = -1;
    }
    if (now - this.noTimeoutTimer > 1000) {
      this.out.pIsaac(239 /* NO_TIMEOUT */);
    }
    try {
      if (this.stream && this.out.pos > 0) {
        this.stream.write(this.out.data, this.out.pos);
        this.out.pos = 0;
        this.noTimeoutTimer = now;
      }
    } catch (e) {
      if ((e instanceof WebSocket || e instanceof WorkerWebSocket) && e.readyState === 3) {
        await this.lostCon();
      } else {
        await this.logout();
      }
    }
  }
  async logout() {
    if (this.stream) {
      this.stream.close();
    }
    this.stream = null;
    this.ingame = false;
    this.loginscreen = 0;
    this.loginUser = "";
    this.loginPass = "";
    InputTracking.deactivate();
    this.clearCaches();
    this.world?.resetMap();
    for (let level = 0;level < 4 /* LEVELS */; level++) {
      this.collision[level]?.reset();
    }
    stopMidi(false);
    this.nextMidiSong = -1;
    this.midiSong = -1;
    this.nextMusicDelay = 0;
  }
  clearCaches() {
    LocType.mc1?.clear();
    LocType.mc2?.clear();
    NpcType.modelCache?.clear();
    ObjType.modelCache?.clear();
    ObjType.spriteCache?.clear();
    ClientPlayer.modelCache?.clear();
    SpotType.modelCache?.clear();
  }
  async lostCon() {
    if (this.logoutTimer > 0) {
      await this.logout();
      return;
    }
    this.areaViewport?.setPixels();
    this.p12?.centreString("Connection lost", 257, 144, 0 /* BLACK */);
    this.p12?.centreString("Connection lost", 256, 143, 16777215 /* WHITE */);
    this.p12?.centreString("Please wait - attempting to reestablish", 257, 159, 0 /* BLACK */);
    this.p12?.centreString("Please wait - attempting to reestablish", 256, 158, 16777215 /* WHITE */);
    this.areaViewport?.draw(4, 4);
    this.minimapFlagX = 0;
    this.stream?.close();
    this.ingame = false;
    await this.login(this.loginUser, this.loginPass, true);
    if (!this.ingame) {
      await this.logout();
    }
  }
  buildMinimenu() {
    if (this.objDragArea !== 0) {
      return;
    }
    this.menuOption[0] = "Cancel";
    this.menuAction[0] = 1106 /* CANCEL */;
    this.menuNumEntries = 1;
    this.addPrivateChatOptions();
    this.lastOverComId = 0;
    if (this.mouseX > 4 && this.mouseY > 4 && this.mouseX < 516 && this.mouseY < 338) {
      if (this.mainModalId === -1) {
        this.addWorldOptions();
      } else {
        this.addComponentOptions(IfType.list[this.mainModalId], this.mouseX, this.mouseY, 4, 4, 0);
      }
    }
    if (this.lastOverComId !== this.overMainComId) {
      this.overMainComId = this.lastOverComId;
    }
    this.lastOverComId = 0;
    if (this.mouseX > 553 && this.mouseY > 205 && this.mouseX < 743 && this.mouseY < 466) {
      if (this.sideModalId !== -1) {
        this.addComponentOptions(IfType.list[this.sideModalId], this.mouseX, this.mouseY, 553, 205, 0);
      } else if (this.sideOverlayId[this.sideTab] !== -1) {
        this.addComponentOptions(IfType.list[this.sideOverlayId[this.sideTab]], this.mouseX, this.mouseY, 553, 205, 0);
      }
    }
    if (this.lastOverComId !== this.overSideComId) {
      this.redrawSidebar = true;
      this.overSideComId = this.lastOverComId;
    }
    this.lastOverComId = 0;
    if (this.mouseX > 17 && this.mouseY > 357 && this.mouseX < 426 && this.mouseY < 453) {
      if (this.chatComId !== -1) {
        this.addComponentOptions(IfType.list[this.chatComId], this.mouseX, this.mouseY, 17, 357, 0);
      } else if (this.mouseY < 434) {
        this.addChatOptions(this.mouseX - 17, this.mouseY - 357);
      }
    }
    if (this.chatComId !== -1 && this.lastOverComId !== this.overChatComId) {
      this.redrawChatback = true;
      this.overChatComId = this.lastOverComId;
    }
    let sorted = false;
    while (!sorted) {
      sorted = true;
      for (let i2 = 0;i2 < this.menuNumEntries - 1; i2++) {
        if (this.menuAction[i2] < 1000 && this.menuAction[i2 + 1] > 1000) {
          const tmp0 = this.menuOption[i2];
          this.menuOption[i2] = this.menuOption[i2 + 1];
          this.menuOption[i2 + 1] = tmp0;
          const tmp1 = this.menuAction[i2];
          this.menuAction[i2] = this.menuAction[i2 + 1];
          this.menuAction[i2 + 1] = tmp1;
          const tmp2 = this.menuParamB[i2];
          this.menuParamB[i2] = this.menuParamB[i2 + 1];
          this.menuParamB[i2 + 1] = tmp2;
          const tmp3 = this.menuParamC[i2];
          this.menuParamC[i2] = this.menuParamC[i2 + 1];
          this.menuParamC[i2 + 1] = tmp3;
          const tmp4 = this.menuParamA[i2];
          this.menuParamA[i2] = this.menuParamA[i2 + 1];
          this.menuParamA[i2 + 1] = tmp4;
          sorted = false;
        }
      }
    }
  }
  addPrivateChatOptions() {
    if (this.splitPrivateChat === 0) {
      return;
    }
    let line = 0;
    if (this.rebootTimer !== 0) {
      line = 1;
    }
    for (let i2 = 0;i2 < 100; i2++) {
      if (this.chatText[i2] !== null) {
        const type = this.chatType[i2];
        let sender = this.chatUsername[i2];
        let _mod = false;
        if (sender && sender.startsWith("@cr1@")) {
          sender = sender.substring(5);
          _mod = true;
        } else if (sender && sender.startsWith("@cr2@")) {
          sender = sender.substring(5);
          _mod = true;
        }
        if ((type === 3 || type === 7) && (type === 7 || this.chatPrivateMode === 0 || this.chatPrivateMode === 1 && this.isFriend(sender))) {
          const y = 329 - line * 13;
          if (this.mouseX > 4 && this.mouseX < 516 && this.mouseY - 4 > y - 10 && this.mouseY - 4 <= y + 3) {
            if (this.staffmodlevel) {
              this.menuOption[this.menuNumEntries] = "Report abuse @whi@" + sender;
              this.menuAction[this.menuNumEntries] = 2000 /* _PRIORITY */ + 524 /* ABUSE_REPORT */;
              this.menuNumEntries++;
            }
            this.menuOption[this.menuNumEntries] = "Add ignore @whi@" + sender;
            this.menuAction[this.menuNumEntries] = 2000 /* _PRIORITY */ + 47 /* IGNORELIST_ADD */;
            this.menuNumEntries++;
            this.menuOption[this.menuNumEntries] = "Add friend @whi@" + sender;
            this.menuAction[this.menuNumEntries] = 2000 /* _PRIORITY */ + 605 /* FRIENDLIST_ADD */;
            this.menuNumEntries++;
          }
          line++;
          if (line >= 5) {
            return;
          }
        } else if ((type === 5 || type === 6) && this.chatPrivateMode < 2) {
          line++;
          if (line >= 5) {
            return;
          }
        }
      }
    }
  }
  addChatOptions(_mouseX, mouseY) {
    let line = 0;
    for (let i2 = 0;i2 < 100; i2++) {
      if (!this.chatText[i2]) {
        continue;
      }
      const type = this.chatType[i2];
      const y = this.chatScrollPos + 70 + 4 - line * 14;
      if (y < -20) {
        break;
      }
      let sender = this.chatUsername[i2];
      let _mod = false;
      if (sender && sender.startsWith("@cr1@")) {
        sender = sender.substring(5);
        _mod = true;
      } else if (sender && sender.startsWith("@cr2@")) {
        sender = sender.substring(5);
        _mod = true;
      }
      if (type === 0) {
        line++;
      } else if ((type == 1 || type == 2) && (type == 1 || this.chatPublicMode == 0 || this.chatPublicMode == 1 && this.isFriend(sender))) {
        if (mouseY > y - 14 && mouseY <= y && this.localPlayer && sender !== this.localPlayer.name) {
          if (this.staffmodlevel >= 1) {
            this.menuOption[this.menuNumEntries] = "Report abuse @whi@" + sender;
            this.menuAction[this.menuNumEntries] = 524 /* ABUSE_REPORT */;
            this.menuNumEntries++;
          }
          this.menuOption[this.menuNumEntries] = "Add ignore @whi@" + sender;
          this.menuAction[this.menuNumEntries] = 47 /* IGNORELIST_ADD */;
          this.menuNumEntries++;
          this.menuOption[this.menuNumEntries] = "Add friend @whi@" + sender;
          this.menuAction[this.menuNumEntries] = 605 /* FRIENDLIST_ADD */;
          this.menuNumEntries++;
        }
        line++;
      } else if ((type === 3 || type === 7) && this.splitPrivateChat === 0 && (type === 7 || this.chatPrivateMode === 0 || this.chatPrivateMode === 1 && this.isFriend(sender))) {
        if (mouseY > y - 14 && mouseY <= y) {
          if (this.staffmodlevel >= 1) {
            this.menuOption[this.menuNumEntries] = "Report abuse @whi@" + sender;
            this.menuAction[this.menuNumEntries] = 524 /* ABUSE_REPORT */;
            this.menuNumEntries++;
          }
          this.menuOption[this.menuNumEntries] = "Add ignore @whi@" + sender;
          this.menuAction[this.menuNumEntries] = 47 /* IGNORELIST_ADD */;
          this.menuNumEntries++;
          this.menuOption[this.menuNumEntries] = "Add friend @whi@" + sender;
          this.menuAction[this.menuNumEntries] = 605 /* FRIENDLIST_ADD */;
          this.menuNumEntries++;
        }
        line++;
      } else if (type === 4 && (this.chatTradeMode === 0 || this.chatTradeMode === 1 && this.isFriend(sender))) {
        if (mouseY > y - 14 && mouseY <= y) {
          this.menuOption[this.menuNumEntries] = "Accept trade @whi@" + sender;
          this.menuAction[this.menuNumEntries] = 507 /* ACCEPT_TRADEREQ */;
          this.menuNumEntries++;
        }
        line++;
      } else if ((type === 5 || type === 6) && this.splitPrivateChat === 0 && this.chatPrivateMode < 2) {
        line++;
      } else if (type === 8 && (this.chatTradeMode === 0 || this.chatTradeMode === 1 && this.isFriend(sender))) {
        if (mouseY > y - 14 && mouseY <= y) {
          this.menuOption[this.menuNumEntries] = "Accept duel @whi@" + sender;
          this.menuAction[this.menuNumEntries] = 957 /* ACCEPT_DUELREQ */;
          this.menuNumEntries++;
        }
        line++;
      }
    }
  }
  minimapLoop() {
    if (this.mouseClickButton !== 1 || !this.localPlayer) {
      return;
    }
    let x2 = this.mouseClickX - 25 - 550;
    let y = this.mouseClickY - 4 - 4;
    if (x2 < 0 || y < 0 || x2 >= 146 || y >= 151) {
      return;
    }
    x2 -= 73;
    y -= 75;
    const yaw = this.orbitCameraYaw + this.macroMinimapAngle & 2047;
    let sinYaw = Pix3D.sinTable[yaw];
    let cosYaw = Pix3D.cosTable[yaw];
    sinYaw = sinYaw * (this.macroMinimapZoom + 256) >> 8;
    cosYaw = cosYaw * (this.macroMinimapZoom + 256) >> 8;
    const relX = y * sinYaw + x2 * cosYaw >> 11;
    const relY = y * cosYaw - x2 * sinYaw >> 11;
    const tileX = this.localPlayer.x + relX >> 7;
    const tileZ = this.localPlayer.z - relY >> 7;
    if (this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], tileX, tileZ, true, 0, 0, 0, 0, 0, 1)) {
      this.out.p1(x2);
      this.out.p1(y);
      this.out.p2(this.orbitCameraYaw);
      this.out.p1(57);
      this.out.p1(this.macroMinimapAngle);
      this.out.p1(this.macroMinimapZoom);
      this.out.p1(89);
      this.out.p2(this.localPlayer.x);
      this.out.p2(this.localPlayer.z);
      this.out.p1(this.tryMoveNearest);
      this.out.p1(63);
    }
  }
  tabLoop() {
    if (this.mouseClickButton !== 1) {
      return;
    }
    if (this.mouseClickX >= 539 && this.mouseClickX <= 573 && this.mouseClickY >= 169 && this.mouseClickY < 205 && this.sideOverlayId[0] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 0;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 569 && this.mouseClickX <= 599 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.sideOverlayId[1] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 1;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 597 && this.mouseClickX <= 627 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.sideOverlayId[2] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 2;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 625 && this.mouseClickX <= 669 && this.mouseClickY >= 168 && this.mouseClickY < 203 && this.sideOverlayId[3] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 3;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 666 && this.mouseClickX <= 696 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.sideOverlayId[4] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 4;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 694 && this.mouseClickX <= 724 && this.mouseClickY >= 168 && this.mouseClickY < 205 && this.sideOverlayId[5] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 5;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 722 && this.mouseClickX <= 756 && this.mouseClickY >= 169 && this.mouseClickY < 205 && this.sideOverlayId[6] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 6;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 540 && this.mouseClickX <= 574 && this.mouseClickY >= 466 && this.mouseClickY < 502 && this.sideOverlayId[7] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 7;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 572 && this.mouseClickX <= 602 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.sideOverlayId[8] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 8;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 599 && this.mouseClickX <= 629 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.sideOverlayId[9] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 9;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 627 && this.mouseClickX <= 671 && this.mouseClickY >= 467 && this.mouseClickY < 502 && this.sideOverlayId[10] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 10;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 669 && this.mouseClickX <= 699 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.sideOverlayId[11] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 11;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 696 && this.mouseClickX <= 726 && this.mouseClickY >= 466 && this.mouseClickY < 503 && this.sideOverlayId[12] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 12;
      this.redrawSideicons = true;
    } else if (this.mouseClickX >= 724 && this.mouseClickX <= 758 && this.mouseClickY >= 466 && this.mouseClickY < 502 && this.sideOverlayId[13] != -1) {
      this.redrawSidebar = true;
      this.sideTab = 13;
      this.redrawSideicons = true;
    }
  }
  chatModeLoop() {
    if (this.mouseClickButton !== 1) {
      return;
    }
    if (this.mouseClickX >= 6 && this.mouseClickX <= 106 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
      this.chatPublicMode = (this.chatPublicMode + 1) % 4;
      this.redrawPrivacySettings = true;
      this.redrawChatback = true;
      this.out.pIsaac(129 /* CHAT_SETMODE */);
      this.out.p1(this.chatPublicMode);
      this.out.p1(this.chatPrivateMode);
      this.out.p1(this.chatTradeMode);
    } else if (this.mouseClickX >= 135 && this.mouseClickX <= 235 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
      this.chatPrivateMode = (this.chatPrivateMode + 1) % 3;
      this.redrawPrivacySettings = true;
      this.redrawChatback = true;
      this.out.pIsaac(129 /* CHAT_SETMODE */);
      this.out.p1(this.chatPublicMode);
      this.out.p1(this.chatPrivateMode);
      this.out.p1(this.chatTradeMode);
    } else if (this.mouseClickX >= 273 && this.mouseClickX <= 373 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
      this.chatTradeMode = (this.chatTradeMode + 1) % 3;
      this.redrawPrivacySettings = true;
      this.redrawChatback = true;
      this.out.pIsaac(129 /* CHAT_SETMODE */);
      this.out.p1(this.chatPublicMode);
      this.out.p1(this.chatPrivateMode);
      this.out.p1(this.chatTradeMode);
    } else if (this.mouseClickX >= 412 && this.mouseClickX <= 512 && this.mouseClickY >= 467 && this.mouseClickY <= 499) {
      this.closeModal();
      this.reportAbuseInput = "";
      this.reportAbuseMuteOption = false;
      for (let i2 = 0;i2 < IfType.list.length; i2++) {
        if (IfType.list[i2] && IfType.list[i2].clientCode === 600 /* CC_REPORT_INPUT */) {
          this.reportAbuseComId = this.mainModalId = IfType.list[i2].layerId;
          break;
        }
      }
      if (this.isMobile) {
        MobileKeyboard_default.show();
      }
    }
  }
  timeoutChat() {
    for (let i2 = -1;i2 < this.playerCount; i2++) {
      let index;
      if (i2 === -1) {
        index = LOCAL_PLAYER_INDEX;
      } else {
        index = this.playerIds[i2];
      }
      const player = this.players[index];
      if (player && player.chatTimer > 0) {
        player.chatTimer--;
        if (player.chatTimer === 0) {
          player.chatMessage = null;
        }
      }
    }
    for (let i2 = 0;i2 < this.npcCount; i2++) {
      const index = this.npcIds[i2];
      const npc = this.npc[index];
      if (npc && npc.chatTimer > 0) {
        npc.chatTimer--;
        if (npc.chatTimer === 0) {
          npc.chatMessage = null;
        }
      }
    }
  }
  async handleInputKey() {
    Client.cyclelogic4++;
    if (Client.cyclelogic4 > 192) {
      Client.cyclelogic4 = 0;
      this.out.pIsaac(226 /* ANTICHEAT_CYCLELOGIC4 */);
      this.out.p1(232);
    }
    while (true) {
      let key;
      do {
        while (true) {
          key = this.pollKey();
          if (key === -1) {
            return;
          }
          if (this.mainModalId !== -1 && this.mainModalId === this.reportAbuseComId) {
            if (key === 8 && this.reportAbuseInput.length > 0) {
              this.reportAbuseInput = this.reportAbuseInput.substring(0, this.reportAbuseInput.length - 1);
            }
            break;
          }
          if (this.socialInputOpen) {
            if (key >= 32 && key <= 122 && this.socialInput.length < 80) {
              this.socialInput = this.socialInput + String.fromCharCode(key);
              this.redrawChatback = true;
            }
            if (key === 8 && this.socialInput.length > 0) {
              this.socialInput = this.socialInput.substring(0, this.socialInput.length - 1);
              this.redrawChatback = true;
            }
            if (key === 13 || key === 10) {
              this.socialInputOpen = false;
              this.redrawChatback = true;
              let userhash;
              if (this.socialInputType === 1) {
                userhash = JString.toUserhash(this.socialInput);
                this.addFriend(userhash);
              }
              if (this.socialInputType === 2 && this.friendCount > 0) {
                userhash = JString.toUserhash(this.socialInput);
                this.delFriend(userhash);
              }
              if (this.socialInputType === 3 && this.socialInput.length > 0 && this.socialUserhash) {
                this.out.pIsaac(214 /* MESSAGE_PRIVATE */);
                this.out.p1(0);
                const start = this.out.pos;
                this.out.p8(this.socialUserhash);
                WordPack.pack(this.out, this.socialInput);
                this.out.psize1(this.out.pos - start);
                this.socialInput = JString.toSentenceCase(this.socialInput);
                this.socialInput = WordFilter.filter(this.socialInput);
                this.addChat(6, this.socialInput, JString.toScreenName(JString.toRawUsername(this.socialUserhash)));
                if (this.chatPrivateMode === 2) {
                  this.chatPrivateMode = 1;
                  this.redrawPrivacySettings = true;
                  this.out.pIsaac(129 /* CHAT_SETMODE */);
                  this.out.p1(this.chatPublicMode);
                  this.out.p1(this.chatPrivateMode);
                  this.out.p1(this.chatTradeMode);
                }
              }
              if (this.socialInputType === 4 && this.ignoreCount < 100) {
                userhash = JString.toUserhash(this.socialInput);
                this.addIgnore(userhash);
              }
              if (this.socialInputType === 5 && this.ignoreCount > 0) {
                userhash = JString.toUserhash(this.socialInput);
                this.delIgnore(userhash);
              }
            }
          } else if (this.dialogInputOpen) {
            if (key >= 48 && key <= 57 && this.dialogInput.length < 10) {
              this.dialogInput = this.dialogInput + String.fromCharCode(key);
              this.redrawChatback = true;
            }
            if (key === 8 && this.dialogInput.length > 0) {
              this.dialogInput = this.dialogInput.substring(0, this.dialogInput.length - 1);
              this.redrawChatback = true;
            }
            if (key === 13 || key === 10) {
              if (this.dialogInput.length > 0) {
                let value = 0;
                try {
                  value = parseInt(this.dialogInput, 10);
                } catch (_e) {}
                this.out.pIsaac(161 /* RESUME_P_COUNTDIALOG */);
                this.out.p4(value);
              }
              this.dialogInputOpen = false;
              this.redrawChatback = true;
            }
          } else if (this.chatComId === -1) {
            if (key >= 32 && (key <= 122 || this.chatInput.startsWith("::") && key <= 126) && this.chatInput.length < 80) {
              this.chatInput = this.chatInput + String.fromCharCode(key);
              this.redrawChatback = true;
            }
            if (key === 8 && this.chatInput.length > 0) {
              this.chatInput = this.chatInput.substring(0, this.chatInput.length - 1);
              this.redrawChatback = true;
            }
            if ((key === 13 || key === 10) && this.chatInput.length > 0) {
              if (this.staffmodlevel === 2) {
                if (this.chatInput === "::clientdrop") {
                  await this.lostCon();
                } else if (this.chatInput === "::prefetchmusic") {
                  if (this.onDemand) {
                    for (let i2 = 0;i2 < this.onDemand.getFileCount(2); i2++) {
                      this.onDemand.prefetchPriority(2, i2, 1);
                    }
                  }
                } else if (this.chatInput === "::lag") {
                  this.lag();
                }
              }
              if (this.chatInput === "::fpson") {
                this.showFps = true;
              } else if (this.chatInput === "::fpsoff") {
                this.showFps = false;
              } else if (this.chatInput.startsWith("::fps ")) {
                try {
                  const desiredFps = parseInt(this.chatInput.substring(6)) || 50;
                  this.setTargetedFramerate(desiredFps);
                } catch (_e) {}
              } else if (this.chatInput.startsWith("::")) {
                this.out.pIsaac(86 /* CLIENT_CHEAT */);
                this.out.p1(this.chatInput.length - 2 + 1);
                this.out.pjstr(this.chatInput.substring(2));
              } else {
                let colour = 0;
                if (this.chatInput.startsWith("yellow:")) {
                  colour = 0;
                  this.chatInput = this.chatInput.substring(7);
                } else if (this.chatInput.startsWith("red:")) {
                  colour = 1;
                  this.chatInput = this.chatInput.substring(4);
                } else if (this.chatInput.startsWith("green:")) {
                  colour = 2;
                  this.chatInput = this.chatInput.substring(6);
                } else if (this.chatInput.startsWith("cyan:")) {
                  colour = 3;
                  this.chatInput = this.chatInput.substring(5);
                } else if (this.chatInput.startsWith("purple:")) {
                  colour = 4;
                  this.chatInput = this.chatInput.substring(7);
                } else if (this.chatInput.startsWith("white:")) {
                  colour = 5;
                  this.chatInput = this.chatInput.substring(6);
                } else if (this.chatInput.startsWith("flash1:")) {
                  colour = 6;
                  this.chatInput = this.chatInput.substring(7);
                } else if (this.chatInput.startsWith("flash2:")) {
                  colour = 7;
                  this.chatInput = this.chatInput.substring(7);
                } else if (this.chatInput.startsWith("flash3:")) {
                  colour = 8;
                  this.chatInput = this.chatInput.substring(7);
                } else if (this.chatInput.startsWith("glow1:")) {
                  colour = 9;
                  this.chatInput = this.chatInput.substring(6);
                } else if (this.chatInput.startsWith("glow2:")) {
                  colour = 10;
                  this.chatInput = this.chatInput.substring(6);
                } else if (this.chatInput.startsWith("glow3:")) {
                  colour = 11;
                  this.chatInput = this.chatInput.substring(6);
                }
                let effect = 0;
                if (this.chatInput.startsWith("wave:")) {
                  effect = 1;
                  this.chatInput = this.chatInput.substring(5);
                }
                if (this.chatInput.startsWith("scroll:")) {
                  effect = 2;
                  this.chatInput = this.chatInput.substring(7);
                }
                this.out.pIsaac(83 /* MESSAGE_PUBLIC */);
                this.out.p1(0);
                const start = this.out.pos;
                this.out.p1(colour);
                this.out.p1(effect);
                WordPack.pack(this.out, this.chatInput);
                this.out.psize1(this.out.pos - start);
                this.chatInput = JString.toSentenceCase(this.chatInput);
                this.chatInput = WordFilter.filter(this.chatInput);
                if (this.localPlayer && this.localPlayer.name) {
                  this.localPlayer.chatMessage = this.chatInput;
                  this.localPlayer.chatColour = colour;
                  this.localPlayer.chatEffect = effect;
                  this.localPlayer.chatTimer = 150;
                  if (this.staffmodlevel === 2) {
                    this.addChat(2, this.localPlayer.chatMessage, "@cr2@" + this.localPlayer.name);
                  } else if (this.staffmodlevel === 1) {
                    this.addChat(2, this.localPlayer.chatMessage, "@cr1@" + this.localPlayer.name);
                  } else {
                    this.addChat(2, this.localPlayer.chatMessage, this.localPlayer.name);
                  }
                }
                if (this.chatPublicMode === 2) {
                  this.chatPublicMode = 3;
                  this.redrawPrivacySettings = true;
                  this.out.pIsaac(129 /* CHAT_SETMODE */);
                  this.out.p1(this.chatPublicMode);
                  this.out.p1(this.chatPrivateMode);
                  this.out.p1(this.chatTradeMode);
                }
              }
              this.chatInput = "";
              this.redrawChatback = true;
            }
          }
        }
      } while ((key < 97 || key > 122) && (key < 65 || key > 90) && (key < 48 || key > 57) && key !== 32);
      if (this.reportAbuseInput.length < 12) {
        this.reportAbuseInput = this.reportAbuseInput + String.fromCharCode(key);
      }
    }
  }
  lag() {
    console.log("============");
    console.log(`flame-cycle:${this.flameCycle0}`);
    if (this.onDemand) {
      console.log(`od-cycle:${this.onDemand.cycle}`);
    }
    console.log(`loop-cycle:${this.loopCycle}`);
    console.log(`draw-cycle:${this.drawCycle}`);
    console.log(`ptype:${this.ptype}`);
    console.log(`psize:${this.psize}`);
    this.debug = true;
  }
  followCamera() {
    if (!this.localPlayer) {
      return;
    }
    const orbitX = this.localPlayer.x + this.macroCameraX;
    const orbitZ = this.localPlayer.z + this.macroCameraZ;
    if (this.orbitCameraX - orbitX < -500 || this.orbitCameraX - orbitX > 500 || this.orbitCameraZ - orbitZ < -500 || this.orbitCameraZ - orbitZ > 500) {
      this.orbitCameraX = orbitX;
      this.orbitCameraZ = orbitZ;
    }
    if (this.orbitCameraX !== orbitX) {
      this.orbitCameraX += (orbitX - this.orbitCameraX) / 16 | 0;
    }
    if (this.orbitCameraZ !== orbitZ) {
      this.orbitCameraZ += (orbitZ - this.orbitCameraZ) / 16 | 0;
    }
    if (this.keyHeld[1] === 1) {
      this.orbitCameraYawVelocity += (-this.orbitCameraYawVelocity - 24) / 2 | 0;
    } else if (this.keyHeld[2] === 1) {
      this.orbitCameraYawVelocity += (24 - this.orbitCameraYawVelocity) / 2 | 0;
    } else {
      this.orbitCameraYawVelocity = this.orbitCameraYawVelocity / 2 | 0;
    }
    if (this.keyHeld[3] === 1) {
      this.orbitCameraPitchVelocity += (12 - this.orbitCameraPitchVelocity) / 2 | 0;
    } else if (this.keyHeld[4] === 1) {
      this.orbitCameraPitchVelocity += (-this.orbitCameraPitchVelocity - 12) / 2 | 0;
    } else {
      this.orbitCameraPitchVelocity = this.orbitCameraPitchVelocity / 2 | 0;
    }
    this.orbitCameraYaw = (this.orbitCameraYaw + this.orbitCameraYawVelocity / 2 | 0) & 2047;
    this.orbitCameraPitch += this.orbitCameraPitchVelocity / 2 | 0;
    if (this.orbitCameraPitch < 128) {
      this.orbitCameraPitch = 128;
    } else if (this.orbitCameraPitch > 383) {
      this.orbitCameraPitch = 383;
    }
    const orbitTileX = this.orbitCameraX >> 7;
    const orbitTileZ = this.orbitCameraZ >> 7;
    const orbitY = this.getAvH(this.orbitCameraX, this.orbitCameraZ, this.minusedlevel);
    let maxY = 0;
    if (this.groundh) {
      if (orbitTileX > 3 && orbitTileZ > 3 && orbitTileX < 100 && orbitTileZ < 100) {
        for (let x2 = orbitTileX - 4;x2 <= orbitTileX + 4; x2++) {
          for (let z = orbitTileZ - 4;z <= orbitTileZ + 4; z++) {
            let level = this.minusedlevel;
            if (level < 3 && this.mapl && (this.mapl[1][x2][z] & 8 /* VisBelow */) !== 0) {
              level++;
            }
            const y = orbitY - this.groundh[level][x2][z];
            if (y > maxY) {
              maxY = y;
            }
          }
        }
      }
    }
    let clamp = maxY * 192;
    if (clamp > 98048) {
      clamp = 98048;
    } else if (clamp < 32768) {
      clamp = 32768;
    }
    if (clamp > this.cameraPitchClamp) {
      this.cameraPitchClamp += (clamp - this.cameraPitchClamp) / 24 | 0;
    } else if (clamp < this.cameraPitchClamp) {
      this.cameraPitchClamp += (clamp - this.cameraPitchClamp) / 80 | 0;
    }
  }
  cinemaCamera() {
    let x2 = this.camMoveToLx * 128 + 64;
    let z = this.camMoveToLz * 128 + 64;
    let y = this.getAvH(x2, z, this.minusedlevel) - this.camMoveToHei;
    if (this.camX < x2) {
      this.camX += this.camMoveToRate + ((x2 - this.camX) * this.camMoveToRate2 / 1000 | 0);
      if (this.camX > x2) {
        this.camX = x2;
      }
    }
    if (this.camX > x2) {
      this.camX -= this.camMoveToRate + ((this.camX - x2) * this.camMoveToRate2 / 1000 | 0);
      if (this.camX < x2) {
        this.camX = x2;
      }
    }
    if (this.camY < y) {
      this.camY += this.camMoveToRate + ((y - this.camY) * this.camMoveToRate2 / 1000 | 0);
      if (this.camY > y) {
        this.camY = y;
      }
    }
    if (this.camY > y) {
      this.camY -= this.camMoveToRate + ((this.camY - y) * this.camMoveToRate2 / 1000 | 0);
      if (this.camY < y) {
        this.camY = y;
      }
    }
    if (this.camZ < z) {
      this.camZ += this.camMoveToRate + ((z - this.camZ) * this.camMoveToRate2 / 1000 | 0);
      if (this.camZ > z) {
        this.camZ = z;
      }
    }
    if (this.camZ > z) {
      this.camZ -= this.camMoveToRate + ((this.camZ - z) * this.camMoveToRate2 / 1000 | 0);
      if (this.camZ < z) {
        this.camZ = z;
      }
    }
    x2 = this.camLookAtLx * 128 + 64;
    z = this.camLookAtLz * 128 + 64;
    y = this.getAvH(x2, z, this.minusedlevel) - this.camLookAtHei;
    const dx = x2 - this.camX;
    const dy = y - this.camY;
    const dz = z - this.camZ;
    const distance = Math.sqrt(dx * dx + dz * dz) | 0;
    let pitch = (Math.atan2(dy, distance) * 325.949 | 0) & 2047;
    const yaw = (Math.atan2(dx, dz) * -325.949 | 0) & 2047;
    if (pitch < 128) {
      pitch = 128;
    } else if (pitch > 383) {
      pitch = 383;
    }
    if (this.camPitch < pitch) {
      this.camPitch += this.camLookAtRate + ((pitch - this.camPitch) * this.camLookAtRate2 / 1000 | 0);
      if (this.camPitch > pitch) {
        this.camPitch = pitch;
      }
    }
    if (this.camPitch > pitch) {
      this.camPitch -= this.camLookAtRate + ((this.camPitch - pitch) * this.camLookAtRate2 / 1000 | 0);
      if (this.camPitch < pitch) {
        this.camPitch = pitch;
      }
    }
    let deltaYaw = yaw - this.camYaw;
    if (deltaYaw > 1024) {
      deltaYaw -= 2048;
    } else if (deltaYaw < -1024) {
      deltaYaw += 2048;
    }
    if (deltaYaw > 0) {
      this.camYaw += this.camLookAtRate + (deltaYaw * this.camLookAtRate2 / 1000 | 0);
      this.camYaw &= 2047;
    }
    if (deltaYaw < 0) {
      this.camYaw -= this.camLookAtRate + (-deltaYaw * this.camLookAtRate2 / 1000 | 0);
      this.camYaw &= 2047;
    }
    let tmp = yaw - this.camYaw;
    if (tmp > 1024) {
      tmp -= 2048;
    } else if (tmp < -1024) {
      tmp += 2048;
    }
    if (tmp < 0 && deltaYaw > 0 || tmp > 0 && deltaYaw < 0) {
      this.camYaw = yaw;
    }
  }
  async soundsDoQueue() {
    for (let wave = 0;wave < this.waveCount; wave++) {
      if (this.waveDelay[wave] <= 0) {
        try {
          const buf = JagFX.generate(this.waveIds[wave], this.waveLoops[wave]);
          if (!buf) {
            throw new Error;
          }
          if (performance.now() + (buf.pos / 22 | 0) > this.lastWaveStartTime + (this.lastWaveLength / 22 | 0)) {
            this.lastWaveLength = buf.pos;
            this.lastWaveStartTime = performance.now();
            this.lastWaveId = this.waveIds[wave];
            this.lastWaveLoops = this.waveLoops[wave];
            await playWave(buf.data.slice(0, buf.pos));
          }
        } catch (_e) {}
        this.waveCount--;
        for (let i2 = wave;i2 < this.waveCount; i2++) {
          this.waveIds[i2] = this.waveIds[i2 + 1];
          this.waveLoops[i2] = this.waveLoops[i2 + 1];
          this.waveDelay[i2] = this.waveDelay[i2 + 1];
        }
        wave--;
      } else {
        this.waveDelay[wave]--;
      }
    }
    if (this.nextMusicDelay > 0) {
      this.nextMusicDelay -= 20;
      if (this.nextMusicDelay < 0) {
        this.nextMusicDelay = 0;
      }
      if (this.nextMusicDelay === 0 && this.midiActive && !Client.lowMem) {
        this.midiSong = this.nextMidiSong;
        this.midiFading = false;
        this.onDemand?.request(2, this.midiSong);
      }
    }
  }
  movePlayers() {
    for (let i2 = -1;i2 < this.playerCount; i2++) {
      let index;
      if (i2 === -1) {
        index = LOCAL_PLAYER_INDEX;
      } else {
        index = this.playerIds[i2];
      }
      const player = this.players[index];
      if (player) {
        this.moveEntity(player);
      }
    }
  }
  moveNpcs() {
    for (let i2 = 0;i2 < this.npcCount; i2++) {
      const id = this.npcIds[i2];
      const npc = this.npc[id];
      if (npc && npc.type) {
        this.moveEntity(npc);
      }
    }
  }
  moveEntity(e) {
    if (e.x < 128 || e.z < 128 || e.x >= 13184 || e.z >= 13184) {
      e.primaryAnim = -1;
      e.spotanimId = -1;
      e.exactMoveEnd = 0;
      e.exactMoveStart = 0;
      e.x = e.routeX[0] * 128 + e.size * 64;
      e.z = e.routeZ[0] * 128 + e.size * 64;
      e.abortRoute();
    }
    if (e === this.localPlayer && (e.x < 1536 || e.z < 1536 || e.x >= 11776 || e.z >= 11776)) {
      e.primaryAnim = -1;
      e.spotanimId = -1;
      e.exactMoveEnd = 0;
      e.exactMoveStart = 0;
      e.x = e.routeX[0] * 128 + e.size * 64;
      e.z = e.routeZ[0] * 128 + e.size * 64;
      e.abortRoute();
    }
    if (e.exactMoveEnd > this.loopCycle) {
      this.exactMove1(e);
    } else if (e.exactMoveStart >= this.loopCycle) {
      this.exactMove2(e);
    } else {
      this.routeMove(e);
    }
    this.entityFace(e);
    this.entityAnim(e);
  }
  exactMove1(e) {
    const delta = e.exactMoveEnd - this.loopCycle;
    const dstX = e.exactStartX * 128 + e.size * 64;
    const dstZ = e.exactStartZ * 128 + e.size * 64;
    e.x += (dstX - e.x) / delta | 0;
    e.z += (dstZ - e.z) / delta | 0;
    e.animDelayMove = 0;
    if (e.exactMoveFacing === 0) {
      e.dstYaw = 1024;
    } else if (e.exactMoveFacing === 1) {
      e.dstYaw = 1536;
    } else if (e.exactMoveFacing === 2) {
      e.dstYaw = 0;
    } else if (e.exactMoveFacing === 3) {
      e.dstYaw = 512;
    }
  }
  exactMove2(e) {
    if (e.exactMoveStart === this.loopCycle || e.primaryAnim === -1 || e.primaryAnimDelay !== 0 || e.primaryAnimCycle + 1 > SeqType.list[e.primaryAnim].getDuration(e.primaryAnimFrame)) {
      const duration = e.exactMoveStart - e.exactMoveEnd;
      const delta = this.loopCycle - e.exactMoveEnd;
      const dx0 = e.exactStartX * 128 + e.size * 64;
      const dz0 = e.exactStartZ * 128 + e.size * 64;
      const dx1 = e.exactEndX * 128 + e.size * 64;
      const dz1 = e.exactEndZ * 128 + e.size * 64;
      e.x = (dx0 * (duration - delta) + dx1 * delta) / duration | 0;
      e.z = (dz0 * (duration - delta) + dz1 * delta) / duration | 0;
    }
    e.animDelayMove = 0;
    if (e.exactMoveFacing === 0) {
      e.dstYaw = 1024;
    } else if (e.exactMoveFacing === 1) {
      e.dstYaw = 1536;
    } else if (e.exactMoveFacing === 2) {
      e.dstYaw = 0;
    } else if (e.exactMoveFacing === 3) {
      e.dstYaw = 512;
    }
    e.yaw = e.dstYaw;
  }
  routeMove(e) {
    e.secondaryAnim = e.readyanim;
    if (e.routeLength === 0) {
      e.animDelayMove = 0;
      return;
    }
    if (e.primaryAnim !== -1 && e.primaryAnimDelay === 0) {
      const seq = SeqType.list[e.primaryAnim];
      if (e.preanimRouteLength > 0 && seq.preanim_move === 0 /* DELAYMOVE */) {
        e.animDelayMove++;
        return;
      }
      if (e.preanimRouteLength <= 0 && seq.postanim_move === 0 /* DELAYMOVE */) {
        e.animDelayMove++;
        return;
      }
    }
    const x2 = e.x;
    const z = e.z;
    const dstX = e.routeX[e.routeLength - 1] * 128 + e.size * 64;
    const dstZ = e.routeZ[e.routeLength - 1] * 128 + e.size * 64;
    if (dstX - x2 > 256 || dstX - x2 < -256 || dstZ - z > 256 || dstZ - z < -256) {
      e.x = dstX;
      e.z = dstZ;
      return;
    }
    if (x2 < dstX) {
      if (z < dstZ) {
        e.dstYaw = 1280;
      } else if (z > dstZ) {
        e.dstYaw = 1792;
      } else {
        e.dstYaw = 1536;
      }
    } else if (x2 > dstX) {
      if (z < dstZ) {
        e.dstYaw = 768;
      } else if (z > dstZ) {
        e.dstYaw = 256;
      } else {
        e.dstYaw = 512;
      }
    } else if (z < dstZ) {
      e.dstYaw = 1024;
    } else {
      e.dstYaw = 0;
    }
    let deltaYaw = e.dstYaw - e.yaw & 2047;
    if (deltaYaw > 1024) {
      deltaYaw -= 2048;
    }
    let seqId = e.walkanim_b;
    if (deltaYaw >= -256 && deltaYaw <= 256) {
      seqId = e.walkanim;
    } else if (deltaYaw >= 256 && deltaYaw < 768) {
      seqId = e.walkanim_r;
    } else if (deltaYaw >= -768 && deltaYaw <= -256) {
      seqId = e.walkanim_l;
    }
    if (seqId === -1) {
      seqId = e.walkanim;
    }
    e.secondaryAnim = seqId;
    let moveSpeed = 4;
    if (e.yaw !== e.dstYaw && e.faceEntity === -1 && e.turnspeed !== 0) {
      moveSpeed = 2;
    }
    if (e.routeLength > 2) {
      moveSpeed = 6;
    }
    if (e.routeLength > 3) {
      moveSpeed = 8;
    }
    if (e.animDelayMove > 0 && e.routeLength > 1) {
      moveSpeed = 8;
      e.animDelayMove--;
    }
    if (e.routeRun[e.routeLength - 1]) {
      moveSpeed <<= 1;
    }
    if (moveSpeed >= 8 && e.secondaryAnim === e.walkanim && e.runanim !== -1) {
      e.secondaryAnim = e.runanim;
    }
    if (x2 < dstX) {
      e.x += moveSpeed;
      if (e.x > dstX) {
        e.x = dstX;
      }
    } else if (x2 > dstX) {
      e.x -= moveSpeed;
      if (e.x < dstX) {
        e.x = dstX;
      }
    }
    if (z < dstZ) {
      e.z += moveSpeed;
      if (e.z > dstZ) {
        e.z = dstZ;
      }
    } else if (z > dstZ) {
      e.z -= moveSpeed;
      if (e.z < dstZ) {
        e.z = dstZ;
      }
    }
    if (e.x === dstX && e.z === dstZ) {
      e.routeLength--;
      if (e.preanimRouteLength > 0) {
        e.preanimRouteLength--;
      }
    }
  }
  entityFace(e) {
    if (e.turnspeed === 0) {
      return;
    }
    if (e.faceEntity !== -1 && e.faceEntity < 32768) {
      const npc = this.npc[e.faceEntity];
      if (npc) {
        const dstX = e.x - npc.x;
        const dstZ = e.z - npc.z;
        if (dstX !== 0 || dstZ !== 0) {
          e.dstYaw = (Math.atan2(dstX, dstZ) * 325.949 | 0) & 2047;
        }
      }
    }
    if (e.faceEntity >= 32768) {
      let index = e.faceEntity - 32768;
      if (index === this.selfSlot) {
        index = LOCAL_PLAYER_INDEX;
      }
      const player = this.players[index];
      if (player) {
        const dstX = e.x - player.x;
        const dstZ = e.z - player.z;
        if (dstX !== 0 || dstZ !== 0) {
          e.dstYaw = (Math.atan2(dstX, dstZ) * 325.949 | 0) & 2047;
        }
      }
    }
    if ((e.faceSquareX !== 0 || e.faceSquareZ !== 0) && (e.routeLength === 0 || e.animDelayMove > 0)) {
      const dstX = e.x - (e.faceSquareX - this.mapBuildBaseX - this.mapBuildBaseX) * 64;
      const dstZ = e.z - (e.faceSquareZ - this.mapBuildBaseZ - this.mapBuildBaseZ) * 64;
      if (dstX !== 0 || dstZ !== 0) {
        e.dstYaw = (Math.atan2(dstX, dstZ) * 325.949 | 0) & 2047;
      }
      e.faceSquareX = 0;
      e.faceSquareZ = 0;
    }
    const remainingYaw = e.dstYaw - e.yaw & 2047;
    if (remainingYaw !== 0) {
      if (remainingYaw < e.turnspeed || remainingYaw > 2048 - e.turnspeed) {
        e.yaw = e.dstYaw;
      } else if (remainingYaw > 1024) {
        e.yaw -= e.turnspeed;
      } else {
        e.yaw += e.turnspeed;
      }
      e.yaw &= 2047;
      if (e.secondaryAnim === e.readyanim && e.yaw !== e.dstYaw) {
        if (e.turnanim != -1) {
          e.secondaryAnim = e.turnanim;
        } else {
          e.secondaryAnim = e.walkanim;
        }
      }
    }
  }
  entityAnim(e) {
    e.needsForwardDrawPadding = false;
    let seq;
    if (e.secondaryAnim !== -1) {
      seq = SeqType.list[e.secondaryAnim];
      e.secondaryAnimCycle++;
      if (e.secondaryAnimFrame < seq.numFrames && e.secondaryAnimCycle > seq.getDuration(e.secondaryAnimFrame)) {
        e.secondaryAnimCycle = 0;
        e.secondaryAnimFrame++;
      }
      if (e.secondaryAnimFrame >= seq.numFrames) {
        e.secondaryAnimCycle = 0;
        e.secondaryAnimFrame = 0;
      }
    }
    if (e.spotanimId !== -1 && this.loopCycle >= e.spotanimLastCycle) {
      if (e.spotanimFrame < 0) {
        e.spotanimFrame = 0;
      }
      seq = SpotType.list[e.spotanimId].seq;
      e.spotanimCycle++;
      while (seq && e.spotanimFrame < seq.numFrames && e.spotanimCycle > seq.getDuration(e.spotanimFrame)) {
        e.spotanimCycle -= seq.getDuration(e.spotanimFrame);
        e.spotanimFrame++;
      }
      if (seq && e.spotanimFrame >= seq.numFrames) {
        if (e.spotanimFrame < 0 || e.spotanimFrame >= seq.numFrames) {
          e.spotanimId = -1;
        }
      }
    }
    if (e.primaryAnim != -1 && e.primaryAnimDelay <= 1) {
      seq = SeqType.list[e.primaryAnim];
      if (seq.preanim_move === 1 /* DELAYANIM */ && e.preanimRouteLength > 0 && this.loopCycle >= e.exactMoveStart && this.loopCycle > e.exactMoveEnd) {
        e.primaryAnimDelay = 1;
        return;
      }
    }
    if (e.primaryAnim !== -1 && e.primaryAnimDelay === 0) {
      seq = SeqType.list[e.primaryAnim];
      e.primaryAnimCycle++;
      while (e.primaryAnimFrame < seq.numFrames && e.primaryAnimCycle > seq.getDuration(e.primaryAnimFrame)) {
        e.primaryAnimCycle -= seq.getDuration(e.primaryAnimFrame);
        e.primaryAnimFrame++;
      }
      if (e.primaryAnimFrame >= seq.numFrames) {
        e.primaryAnimFrame -= seq.loops;
        e.primaryAnimLoop++;
        if (e.primaryAnimLoop >= seq.maxloops) {
          e.primaryAnim = -1;
        }
        if (e.primaryAnimFrame < 0 || e.primaryAnimFrame >= seq.numFrames) {
          e.primaryAnim = -1;
        }
      }
      e.needsForwardDrawPadding = seq.stretches;
    }
    if (e.primaryAnimDelay > 0) {
      e.primaryAnimDelay--;
    }
  }
  async messageBox(message, progress) {
    console.log(`${progress}%: ${message}`);
    this.lastProgressPercent = progress;
    this.lastProgressMessage = message;
    await this.prepareTitle();
    if (!this.title) {
      await super.messageBox(message, progress);
      return;
    }
    this.imageTitle4?.setPixels();
    const x2 = 360;
    const y = 200;
    const offsetY = 20;
    this.b12?.centreString("RuneScape is loading - please wait...", x2 / 2 | 0, (y / 2 | 0) - offsetY - 26, 16777215 /* WHITE */);
    const midY = (y / 2 | 0) - 18 - offsetY;
    Pix2D.drawRect((x2 / 2 | 0) - 152, midY, 304, 34, 9179409);
    Pix2D.drawRect((x2 / 2 | 0) - 151, midY + 1, 302, 32, 0 /* BLACK */);
    Pix2D.fillRect((x2 / 2 | 0) - 150, midY + 2, progress * 3, 30, 9179409);
    Pix2D.fillRect((x2 / 2 | 0) - 150 + progress * 3, midY + 2, 300 - progress * 3, 30, 0 /* BLACK */);
    this.b12?.centreString(message, x2 / 2 | 0, (y / 2 | 0) + 5 - offsetY, 16777215 /* WHITE */);
    this.imageTitle4?.draw(202, 171);
    if (this.redrawFrame) {
      this.redrawFrame = false;
      if (!this.flameActive) {
        this.imageTitle0?.draw(0, 0);
        this.imageTitle1?.draw(637, 0);
      }
      this.imageTitle2?.draw(128, 0);
      this.imageTitle3?.draw(202, 371);
      this.imageTitle5?.draw(0, 265);
      this.imageTitle6?.draw(562, 265);
      this.imageTitle7?.draw(128, 171);
      this.imageTitle8?.draw(562, 171);
    }
    await sleep(5);
  }
  gameDraw() {
    if (this.players === null) {
      return;
    }
    if (this.redrawFrame) {
      this.redrawFrame = false;
      this.areaBackleft1?.draw(0, 4);
      this.areaBackleft2?.draw(0, 357);
      this.areaBackright1?.draw(722, 4);
      this.areaBackright2?.draw(743, 205);
      this.areaBacktop1?.draw(0, 0);
      this.areaBackvmid1?.draw(516, 4);
      this.areaBackvmid2?.draw(516, 205);
      this.areaBackvmid3?.draw(496, 357);
      this.areaBackhmid2?.draw(0, 338);
      this.redrawSidebar = true;
      this.redrawChatback = true;
      this.redrawSideicons = true;
      this.redrawPrivacySettings = true;
      if (this.sceneState !== 2) {
        this.areaViewport?.draw(4, 4);
        this.areaMapback?.draw(550, 4);
      }
    }
    if (this.sceneState === 2) {
      this.gameDrawMain();
    }
    if (this.isMenuOpen && this.menuArea === 1) {
      this.redrawSidebar = true;
    }
    if (this.sideModalId !== -1) {
      const redraw = this.animateInterface(this.sideModalId, this.worldUpdateNum);
      if (redraw) {
        this.redrawSidebar = true;
      }
    }
    if (this.selectedArea === 2) {
      this.redrawSidebar = true;
    }
    if (this.objDragArea === 2) {
      this.redrawSidebar = true;
    }
    if (this.redrawSidebar) {
      this.drawSidebar();
      this.redrawSidebar = false;
    }
    if (this.chatComId === -1) {
      this.chatInterface.scrollPos = this.chatScrollHeight - this.chatScrollPos - 77;
      if (this.mouseX > 448 && this.mouseX < 560 && this.mouseY > 332) {
        this.doScrollbar(this.mouseX - 17, this.mouseY - 357, this.chatScrollHeight, 77, false, 463, 0, this.chatInterface);
      }
      let offset = this.chatScrollHeight - this.chatInterface.scrollPos - 77;
      if (offset < 0) {
        offset = 0;
      }
      if (offset > this.chatScrollHeight - 77) {
        offset = this.chatScrollHeight - 77;
      }
      if (this.chatScrollPos !== offset) {
        this.chatScrollPos = offset;
        this.redrawChatback = true;
      }
    }
    if (this.chatComId !== -1) {
      const redraw = this.animateInterface(this.chatComId, this.worldUpdateNum);
      if (redraw) {
        this.redrawChatback = true;
      }
    }
    if (this.selectedArea === 3) {
      this.redrawChatback = true;
    }
    if (this.objDragArea === 3) {
      this.redrawChatback = true;
    }
    if (this.tutComMessage) {
      this.redrawChatback = true;
    }
    if (this.isMenuOpen && this.menuArea === 2) {
      this.redrawChatback = true;
    }
    if (this.redrawChatback) {
      this.drawChat();
      this.redrawChatback = false;
    }
    if (this.sceneState === 2) {
      this.minimapDraw();
      this.areaMapback?.draw(550, 4);
    }
    if (this.tutFlashingTab !== -1) {
      this.redrawSideicons = true;
    }
    if (this.redrawSideicons) {
      if (this.tutFlashingTab !== -1 && this.tutFlashingTab === this.sideTab) {
        this.tutFlashingTab = -1;
        this.out.pIsaac(201 /* TUT_CLICKSIDE */);
        this.out.p1(this.sideTab);
      }
      this.redrawSideicons = false;
      this.areaBackhmid1?.setPixels();
      this.backhmid1?.plotSprite(0, 0);
      if (this.sideModalId === -1) {
        if (this.sideOverlayId[this.sideTab] !== -1) {
          if (this.sideTab === 0) {
            this.redstone1?.plotSprite(22, 10);
          } else if (this.sideTab === 1) {
            this.redstone2?.plotSprite(54, 8);
          } else if (this.sideTab === 2) {
            this.redstone2?.plotSprite(82, 8);
          } else if (this.sideTab === 3) {
            this.redstone3?.plotSprite(110, 8);
          } else if (this.sideTab === 4) {
            this.redstone2h?.plotSprite(153, 8);
          } else if (this.sideTab === 5) {
            this.redstone2h?.plotSprite(181, 8);
          } else if (this.sideTab === 6) {
            this.redstone1h?.plotSprite(209, 9);
          }
        }
        if (this.sideOverlayId[0] !== -1 && (this.tutFlashingTab !== 0 || this.loopCycle % 20 < 10)) {
          this.sideicons[0]?.plotSprite(29, 13);
        }
        if (this.sideOverlayId[1] !== -1 && (this.tutFlashingTab !== 1 || this.loopCycle % 20 < 10)) {
          this.sideicons[1]?.plotSprite(53, 11);
        }
        if (this.sideOverlayId[2] !== -1 && (this.tutFlashingTab !== 2 || this.loopCycle % 20 < 10)) {
          this.sideicons[2]?.plotSprite(82, 11);
        }
        if (this.sideOverlayId[3] !== -1 && (this.tutFlashingTab !== 3 || this.loopCycle % 20 < 10)) {
          this.sideicons[3]?.plotSprite(115, 12);
        }
        if (this.sideOverlayId[4] !== -1 && (this.tutFlashingTab !== 4 || this.loopCycle % 20 < 10)) {
          this.sideicons[4]?.plotSprite(153, 13);
        }
        if (this.sideOverlayId[5] !== -1 && (this.tutFlashingTab !== 5 || this.loopCycle % 20 < 10)) {
          this.sideicons[5]?.plotSprite(180, 11);
        }
        if (this.sideOverlayId[6] !== -1 && (this.tutFlashingTab !== 6 || this.loopCycle % 20 < 10)) {
          this.sideicons[6]?.plotSprite(208, 13);
        }
      }
      this.areaBackhmid1?.draw(516, 160);
      this.areaBackbase2?.setPixels();
      this.backbase2?.plotSprite(0, 0);
      if (this.sideModalId === -1) {
        if (this.sideOverlayId[this.sideTab] !== -1) {
          if (this.sideTab === 7) {
            this.redstone1v?.plotSprite(42, 0);
          } else if (this.sideTab === 8) {
            this.redstone2v?.plotSprite(74, 0);
          } else if (this.sideTab === 9) {
            this.redstone2v?.plotSprite(102, 0);
          } else if (this.sideTab === 10) {
            this.redstone3v?.plotSprite(130, 1);
          } else if (this.sideTab === 11) {
            this.redstone2hv?.plotSprite(173, 0);
          } else if (this.sideTab === 12) {
            this.redstone2hv?.plotSprite(201, 0);
          } else if (this.sideTab === 13) {
            this.redstone1hv?.plotSprite(229, 0);
          }
        }
        if (this.sideOverlayId[8] !== -1 && (this.tutFlashingTab !== 8 || this.loopCycle % 20 < 10)) {
          this.sideicons[7]?.plotSprite(74, 2);
        }
        if (this.sideOverlayId[9] !== -1 && (this.tutFlashingTab !== 9 || this.loopCycle % 20 < 10)) {
          this.sideicons[8]?.plotSprite(102, 3);
        }
        if (this.sideOverlayId[10] !== -1 && (this.tutFlashingTab !== 10 || this.loopCycle % 20 < 10)) {
          this.sideicons[9]?.plotSprite(137, 4);
        }
        if (this.sideOverlayId[11] !== -1 && (this.tutFlashingTab !== 11 || this.loopCycle % 20 < 10)) {
          this.sideicons[10]?.plotSprite(174, 2);
        }
        if (this.sideOverlayId[12] !== -1 && (this.tutFlashingTab !== 12 || this.loopCycle % 20 < 10)) {
          this.sideicons[11]?.plotSprite(201, 2);
        }
        if (this.sideOverlayId[13] !== -1 && (this.tutFlashingTab !== 13 || this.loopCycle % 20 < 10)) {
          this.sideicons[12]?.plotSprite(226, 2);
        }
      }
      this.areaBackbase2?.draw(496, 466);
      this.areaViewport?.setPixels();
    }
    if (this.redrawPrivacySettings) {
      this.redrawPrivacySettings = false;
      this.areaBackbase1?.setPixels();
      this.backbase1?.plotSprite(0, 0);
      this.p12?.centreStringTag("Public chat", 55, 28, 16777215 /* WHITE */, true);
      if (this.chatPublicMode === 0) {
        this.p12?.centreStringTag("On", 55, 41, 65280 /* GREEN */, true);
      }
      if (this.chatPublicMode === 1) {
        this.p12?.centreStringTag("Friends", 55, 41, 16776960 /* YELLOW */, true);
      }
      if (this.chatPublicMode === 2) {
        this.p12?.centreStringTag("Off", 55, 41, 16711680 /* RED */, true);
      }
      if (this.chatPublicMode === 3) {
        this.p12?.centreStringTag("Hide", 55, 41, 65535 /* CYAN */, true);
      }
      this.p12?.centreStringTag("Private chat", 184, 28, 16777215 /* WHITE */, true);
      if (this.chatPrivateMode === 0) {
        this.p12?.centreStringTag("On", 184, 41, 65280 /* GREEN */, true);
      }
      if (this.chatPrivateMode === 1) {
        this.p12?.centreStringTag("Friends", 184, 41, 16776960 /* YELLOW */, true);
      }
      if (this.chatPrivateMode === 2) {
        this.p12?.centreStringTag("Off", 184, 41, 16711680 /* RED */, true);
      }
      this.p12?.centreStringTag("Trade/duel", 324, 28, 16777215 /* WHITE */, true);
      if (this.chatTradeMode === 0) {
        this.p12?.centreStringTag("On", 324, 41, 65280 /* GREEN */, true);
      }
      if (this.chatTradeMode === 1) {
        this.p12?.centreStringTag("Friends", 324, 41, 16776960 /* YELLOW */, true);
      }
      if (this.chatTradeMode === 2) {
        this.p12?.centreStringTag("Off", 324, 41, 16711680 /* RED */, true);
      }
      this.p12?.centreStringTag("Report abuse", 458, 33, 16777215 /* WHITE */, true);
      this.areaBackbase1?.draw(0, 453);
      this.areaViewport?.setPixels();
    }
    this.worldUpdateNum = 0;
  }
  gameDrawMain() {
    this.sceneCycle++;
    this.addPlayers(true);
    this.addNpcs(true);
    this.addPlayers(false);
    this.addNpcs(false);
    this.addProjectiles();
    this.addMapAnim();
    if (!this.cinemaCam) {
      let pitch = this.orbitCameraPitch;
      if ((this.cameraPitchClamp / 256 | 0) > pitch) {
        pitch = this.cameraPitchClamp / 256 | 0;
      }
      if (this.camShake[4] && this.camShakeRan[4] + 128 > pitch) {
        pitch = this.camShakeRan[4] + 128;
      }
      const yaw = this.orbitCameraYaw + this.macroCameraAngle & 2047;
      if (this.localPlayer) {
        this.camFollow(pitch, yaw, this.orbitCameraX, this.getAvH(this.localPlayer.x, this.localPlayer.z, this.minusedlevel) - 50, this.orbitCameraZ, pitch * 3 + 600);
      }
    }
    let level;
    if (this.cinemaCam) {
      level = this.roofCheck2();
    } else {
      level = this.roofCheck();
    }
    const camX = this.camX;
    const camY = this.camY;
    const camZ = this.camZ;
    const camPitch = this.camPitch;
    const camYaw = this.camYaw;
    for (let axis = 0;axis < 5; axis++) {
      if (!this.camShake[axis]) {
        continue;
      }
      const jitter = Math.random() * (this.camShakeAxis[axis] * 2 + 1) - this.camShakeAxis[axis] + Math.sin(this.camShakeCycle[axis] * (this.camShakeAmp[axis] / 100)) * this.camShakeRan[axis] | 0;
      if (axis === 0) {
        this.camX += jitter;
      } else if (axis === 1) {
        this.camY += jitter;
      } else if (axis === 2) {
        this.camZ += jitter;
      } else if (axis === 3) {
        this.camYaw = this.camYaw + jitter & 2047;
      } else if (axis === 4) {
        this.camPitch += jitter;
        if (this.camPitch < 128) {
          this.camPitch = 128;
        }
        if (this.camPitch > 383) {
          this.camPitch = 383;
        }
      }
    }
    const cycle = Pix3D.cycle;
    Model.mouseCheck = true;
    Model.pickedCount = 0;
    Model.mouseX = this.mouseX - 4;
    Model.mouseY = this.mouseY - 4;
    Pix2D.cls();
    this.world?.renderAll(this.camX, this.camY, this.camZ, level, this.camYaw, this.camPitch, this.loopCycle);
    this.world?.removeSprites();
    this.entityOverlays();
    this.coordArrow();
    this.textureRunAnims(cycle);
    this.otherOverlays();
    this.areaViewport?.draw(4, 4);
    this.camX = camX;
    this.camY = camY;
    this.camZ = camZ;
    this.camPitch = camPitch;
    this.camYaw = camYaw;
  }
  addPlayers(self) {
    if (!this.localPlayer) {
      return;
    }
    if (this.localPlayer.x >> 7 === this.minimapFlagX && this.localPlayer.z >> 7 === this.minimapFlagZ) {
      this.minimapFlagX = 0;
      Client.cyclelogic6++;
      if (Client.cyclelogic6 > 122) {
        Client.cyclelogic6 = 0;
        this.out.pIsaac(36 /* ANTICHEAT_CYCLELOGIC6 */);
        this.out.p1(62);
      }
    }
    let count = this.playerCount;
    if (self) {
      count = 1;
    }
    for (let i2 = 0;i2 < count; i2++) {
      let player;
      let id;
      if (self) {
        player = this.localPlayer;
        id = LOCAL_PLAYER_INDEX << 14;
      } else {
        player = this.players[this.playerIds[i2]];
        id = this.playerIds[i2] << 14;
      }
      if (!player || !player.isReady()) {
        continue;
      }
      player.lowMemory = false;
      if ((Client.lowMem && this.playerCount > 50 || this.playerCount > 200) && !self && player.secondaryAnim == player.readyanim) {
        player.lowMemory = true;
      }
      const stx = player.x >> 7;
      const stz = player.z >> 7;
      if (stx < 0 || stx >= 104 /* SIZE */ || stz < 0 || stz >= 104 /* SIZE */) {
        continue;
      }
      if (!player.locModel || this.loopCycle < player.locStartCycle || this.loopCycle >= player.locStopCycle) {
        if ((player.x & 127) === 64 && (player.z & 127) === 64) {
          if (this.tileLastOccupiedCycle[stx][stz] == this.sceneCycle && i2 != -1) {
            continue;
          }
          this.tileLastOccupiedCycle[stx][stz] = this.sceneCycle;
        }
        player.y = this.getAvH(player.x, player.z, this.minusedlevel);
        this.world?.addDynamic(this.minusedlevel, player.x, player.y, player.z, player, id, player.yaw, 60, player.needsForwardDrawPadding);
      } else {
        player.lowMemory = false;
        player.y = this.getAvH(player.x, player.z, this.minusedlevel);
        this.world?.addDynamic2(this.minusedlevel, player.x, player.y, player.z, player.minTileX, player.minTileZ, player.maxTileX, player.maxTileZ, player, id, player.yaw);
      }
    }
  }
  addNpcs(alwaysontop) {
    for (let i2 = 0;i2 < this.npcCount; i2++) {
      const npc = this.npc[this.npcIds[i2]];
      const typecode = (this.npcIds[i2] << 14) + 536870912 | 0;
      if (!npc || !npc.isReady() || npc.type?.alwaysontop !== alwaysontop) {
        continue;
      }
      const x2 = npc.x >> 7;
      const z = npc.z >> 7;
      if (x2 < 0 || x2 >= 104 /* SIZE */ || z < 0 || z >= 104 /* SIZE */) {
        continue;
      }
      if (npc.size === 1 && (npc.x & 127) === 64 && (npc.z & 127) === 64) {
        if (this.tileLastOccupiedCycle[x2][z] === this.sceneCycle) {
          continue;
        }
        this.tileLastOccupiedCycle[x2][z] = this.sceneCycle;
      }
      this.world?.addDynamic(this.minusedlevel, npc.x, this.getAvH(npc.x, npc.z, this.minusedlevel), npc.z, npc, typecode, npc.yaw, (npc.size - 1) * 64 + 60, npc.needsForwardDrawPadding);
    }
  }
  addProjectiles() {
    for (let proj = this.projectiles.head();proj !== null; proj = this.projectiles.next()) {
      if (proj.level !== this.minusedlevel || this.loopCycle > proj.t2) {
        proj.unlink();
      } else if (this.loopCycle >= proj.t1) {
        if (proj.target > 0) {
          const npc = this.npc[proj.target - 1];
          if (npc) {
            proj.setTarget(npc.x, this.getAvH(npc.x, npc.z, proj.level) - proj.h2, npc.z, this.loopCycle);
          }
        }
        if (proj.target < 0) {
          const index = -proj.target - 1;
          let player;
          if (index === this.selfSlot) {
            player = this.localPlayer;
          } else {
            player = this.players[index];
          }
          if (player) {
            proj.setTarget(player.x, this.getAvH(player.x, player.z, proj.level) - proj.h2, player.z, this.loopCycle);
          }
        }
        proj.move(this.worldUpdateNum);
        this.world?.addDynamic(this.minusedlevel, proj.x | 0, proj.y | 0, proj.z | 0, proj, -1, proj.yaw, 60, false);
      }
    }
    Client.cyclelogic1++;
    if (Client.cyclelogic1 > 1174) {
      Client.cyclelogic1 = 0;
      this.out.pIsaac(51 /* ANTICHEAT_CYCLELOGIC1 */);
      this.out.p1(0);
      const start = this.out.pos;
      if ((Math.random() * 2 | 0) === 0) {
        this.out.p2(11499);
      }
      this.out.p2(10548);
      if ((Math.random() * 2 | 0) == 0) {
        this.out.p1(139);
      }
      if ((Math.random() * 2 | 0) == 0) {
        this.out.p1(94);
      }
      this.out.p2(51693);
      this.out.p1(16);
      this.out.p2(15036);
      if ((Math.random() * 2 | 0) == 0) {
        this.out.p1(65);
      }
      this.out.p1(Math.random() * 256 | 0);
      this.out.p2(22990);
      this.out.psize1(this.out.pos - start);
    }
  }
  addMapAnim() {
    for (let spot = this.spotanims.head();spot !== null; spot = this.spotanims.next()) {
      if (spot.level !== this.minusedlevel || spot.animComplete) {
        spot.unlink();
      } else if (this.loopCycle >= spot.startCycle) {
        spot.update(this.worldUpdateNum);
        if (spot.animComplete) {
          spot.unlink();
        } else {
          this.world?.addDynamic(spot.level, spot.x, spot.y, spot.z, spot, -1, 0, 60, false);
        }
      }
    }
  }
  camFollow(pitch, yaw, targetX, targetY, targetZ, distance) {
    const invPitch = 2048 - pitch & 2047;
    const invYaw = 2048 - yaw & 2047;
    let x2 = 0;
    let y = 0;
    let z = distance;
    let sin;
    let cos;
    let tmp;
    if (invPitch !== 0) {
      sin = Pix3D.sinTable[invPitch];
      cos = Pix3D.cosTable[invPitch];
      tmp = y * cos - distance * sin >> 16;
      z = y * sin + distance * cos >> 16;
      y = tmp;
    }
    if (invYaw !== 0) {
      sin = Pix3D.sinTable[invYaw];
      cos = Pix3D.cosTable[invYaw];
      tmp = z * sin + x2 * cos >> 16;
      z = z * cos - x2 * sin >> 16;
      x2 = tmp;
    }
    this.camX = targetX - x2;
    this.camY = targetY - y;
    this.camZ = targetZ - z;
    this.camPitch = pitch;
    this.camYaw = yaw;
  }
  roofCheck2() {
    if (!this.mapl) {
      return 0;
    }
    const y = this.getAvH(this.camX, this.camZ, this.minusedlevel);
    return y - this.camY >= 800 || (this.mapl[this.minusedlevel][this.camX >> 7][this.camZ >> 7] & 4 /* RemoveRoof */) === 0 ? 3 : this.minusedlevel;
  }
  roofCheck() {
    let top = 3;
    if (this.camPitch < 310 && this.localPlayer) {
      let cameraLocalTileX = this.camX >> 7;
      let cameraLocalTileZ = this.camZ >> 7;
      const playerLocalTileX = this.localPlayer.x >> 7;
      const playerLocalTileZ = this.localPlayer.z >> 7;
      if (this.mapl && (this.mapl[this.minusedlevel][cameraLocalTileX][cameraLocalTileZ] & 4 /* RemoveRoof */) !== 0) {
        top = this.minusedlevel;
      }
      let tileDeltaX;
      if (playerLocalTileX > cameraLocalTileX) {
        tileDeltaX = playerLocalTileX - cameraLocalTileX;
      } else {
        tileDeltaX = cameraLocalTileX - playerLocalTileX;
      }
      let tileDeltaZ;
      if (playerLocalTileZ > cameraLocalTileZ) {
        tileDeltaZ = playerLocalTileZ - cameraLocalTileZ;
      } else {
        tileDeltaZ = cameraLocalTileZ - playerLocalTileZ;
      }
      if (tileDeltaX > tileDeltaZ) {
        const delta = tileDeltaZ * 65536 / tileDeltaX | 0;
        let accumulator = 32768;
        while (cameraLocalTileX !== playerLocalTileX) {
          if (cameraLocalTileX < playerLocalTileX) {
            cameraLocalTileX++;
          } else if (cameraLocalTileX > playerLocalTileX) {
            cameraLocalTileX--;
          }
          if (this.mapl && (this.mapl[this.minusedlevel][cameraLocalTileX][cameraLocalTileZ] & 4 /* RemoveRoof */) !== 0) {
            top = this.minusedlevel;
          }
          accumulator += delta;
          if (accumulator >= 65536) {
            accumulator -= 65536;
            if (cameraLocalTileZ < playerLocalTileZ) {
              cameraLocalTileZ++;
            } else if (cameraLocalTileZ > playerLocalTileZ) {
              cameraLocalTileZ--;
            }
            if (this.mapl && (this.mapl[this.minusedlevel][cameraLocalTileX][cameraLocalTileZ] & 4 /* RemoveRoof */) !== 0) {
              top = this.minusedlevel;
            }
          }
        }
      } else {
        const delta = tileDeltaX * 65536 / tileDeltaZ | 0;
        let accumulator = 32768;
        while (cameraLocalTileZ !== playerLocalTileZ) {
          if (cameraLocalTileZ < playerLocalTileZ) {
            cameraLocalTileZ++;
          } else if (cameraLocalTileZ > playerLocalTileZ) {
            cameraLocalTileZ--;
          }
          if (this.mapl && (this.mapl[this.minusedlevel][cameraLocalTileX][cameraLocalTileZ] & 4 /* RemoveRoof */) !== 0) {
            top = this.minusedlevel;
          }
          accumulator += delta;
          if (accumulator >= 65536) {
            accumulator -= 65536;
            if (cameraLocalTileX < playerLocalTileX) {
              cameraLocalTileX++;
            } else if (cameraLocalTileX > playerLocalTileX) {
              cameraLocalTileX--;
            }
            if (this.mapl && (this.mapl[this.minusedlevel][cameraLocalTileX][cameraLocalTileZ] & 4 /* RemoveRoof */) !== 0) {
              top = this.minusedlevel;
            }
          }
        }
      }
    }
    if (this.localPlayer && this.mapl && (this.mapl[this.minusedlevel][this.localPlayer.x >> 7][this.localPlayer.z >> 7] & 4 /* RemoveRoof */) !== 0) {
      top = this.minusedlevel;
    }
    return top;
  }
  entityOverlays() {
    this.chatCount = 0;
    for (let index = -1;index < this.playerCount + this.npcCount; index++) {
      let entity = null;
      if (index === -1) {
        entity = this.localPlayer;
      } else if (index < this.playerCount) {
        entity = this.players[this.playerIds[index]];
      } else {
        entity = this.npc[this.npcIds[index - this.playerCount]];
      }
      if (!entity || !entity.isReady()) {
        continue;
      }
      if (index >= this.playerCount) {
        const npc = entity.type;
        if (npc && npc.headicon >= 0 && npc.headicon < this.headicons.length) {
          this.getOverlayPosEntity(entity, entity.height + 15);
          if (this.projectX > -1) {
            this.headicons[npc.headicon]?.plotSprite(this.projectX - 12, this.projectY - 30);
          }
        }
        if (this.hintType === 1 && this.hintNpc === this.npcIds[index - this.playerCount] && this.loopCycle % 20 < 10) {
          this.getOverlayPosEntity(entity, entity.height + 15);
          if (this.projectX > -1) {
            this.headicons[2]?.plotSprite(this.projectX - 12, this.projectY - 28);
          }
        }
      } else {
        let y = 30;
        const player = entity;
        if (player.headicons !== 0) {
          this.getOverlayPosEntity(entity, entity.height + 15);
          if (this.projectX > -1) {
            for (let icon = 0;icon < 8; icon++) {
              if ((player.headicons & 1 << icon) !== 0) {
                this.headicons[icon]?.plotSprite(this.projectX - 12, this.projectY - y);
                y -= 25;
              }
            }
          }
        }
        if (index >= 0 && this.hintType === 10 && this.hintPlayer === this.playerIds[index]) {
          this.getOverlayPosEntity(entity, entity.height + 15);
          if (this.projectX > -1) {
            this.headicons[7]?.plotSprite(this.projectX - 12, this.projectY - y);
          }
        }
      }
      if (entity.chatMessage && (index >= this.playerCount || this.chatPublicMode === 0 || this.chatPublicMode === 3 || this.chatPublicMode === 1 && this.isFriend(entity.name))) {
        this.getOverlayPosEntity(entity, entity.height);
        if (this.projectX > -1 && this.chatCount < MAX_CHATS && this.b12) {
          this.chatWidth[this.chatCount] = this.b12.stringWid(entity.chatMessage) / 2 | 0;
          this.chatHeight[this.chatCount] = this.b12.height2d;
          this.chatX[this.chatCount] = this.projectX;
          this.chatY[this.chatCount] = this.projectY;
          this.chatColour[this.chatCount] = entity.chatColour;
          this.chatEffect[this.chatCount] = entity.chatEffect;
          this.chatTimer[this.chatCount] = entity.chatTimer;
          this.chats[this.chatCount++] = entity.chatMessage;
          if (this.chatEffects === 0 && entity.chatEffect === 1) {
            this.chatHeight[this.chatCount] += 10;
            this.chatY[this.chatCount] += 5;
          }
          if (this.chatEffects === 0 && entity.chatEffect === 2) {
            this.chatWidth[this.chatCount] = 60;
          }
        }
      }
      if (entity.combatCycle > this.loopCycle + 100) {
        this.getOverlayPosEntity(entity, entity.height + 15);
        if (this.projectX > -1) {
          let w = entity.health * 30 / entity.totalHealth | 0;
          if (w > 30) {
            w = 30;
          }
          Pix2D.fillRect(this.projectX - 15, this.projectY - 3, w, 5, 65280 /* GREEN */);
          Pix2D.fillRect(this.projectX - 15 + w, this.projectY - 3, 30 - w, 5, 16711680 /* RED */);
        }
      }
      for (let i2 = 0;i2 < 4; ++i2) {
        if (entity.damageCycles[i2] <= this.loopCycle) {
          continue;
        }
        this.getOverlayPosEntity(entity, entity.height / 2 | 0);
        if (this.projectX <= -1) {
          continue;
        }
        if (i2 == 1) {
          this.projectY -= 20;
        } else if (i2 == 2) {
          this.projectX -= 15;
          this.projectY -= 10;
        } else if (i2 == 3) {
          this.projectX += 15;
          this.projectY -= 10;
        }
        this.hitmarks[entity.damageTypes[i2]]?.plotSprite(this.projectX - 12, this.projectY - 12);
        this.p11?.centreString(entity.damageValues[i2].toString(), this.projectX, this.projectY + 4, 0 /* BLACK */);
        this.p11?.centreString(entity.damageValues[i2].toString(), this.projectX - 1, this.projectY + 3, 16777215 /* WHITE */);
      }
    }
    for (let i2 = 0;i2 < this.chatCount; i2++) {
      const x2 = this.chatX[i2];
      let y = this.chatY[i2];
      const padding = this.chatWidth[i2];
      const height = this.chatHeight[i2];
      let sorting = true;
      while (sorting) {
        sorting = false;
        for (let j = 0;j < i2; j++) {
          if (y + 2 > this.chatY[j] - this.chatHeight[j] && y - height < this.chatY[j] + 2 && x2 - padding < this.chatX[j] + this.chatWidth[j] && x2 + padding > this.chatX[j] - this.chatWidth[j] && this.chatY[j] - this.chatHeight[j] < y) {
            y = this.chatY[j] - this.chatHeight[j];
            sorting = true;
          }
        }
      }
      this.projectX = this.chatX[i2];
      this.projectY = this.chatY[i2] = y;
      const message = this.chats[i2];
      if (this.chatEffects !== 0) {
        this.b12?.centreString(message, this.projectX, this.projectY + 1, 0 /* BLACK */);
        this.b12?.centreString(message, this.projectX, this.projectY, 16776960 /* YELLOW */);
      } else {
        let colour = 16776960 /* YELLOW */;
        if (this.chatColour[i2] < 6) {
          colour = CHAT_COLOURS[this.chatColour[i2]];
        } else if (this.chatColour[i2] === 6) {
          colour = this.sceneCycle % 20 < 10 ? 16711680 /* RED */ : 16776960 /* YELLOW */;
        } else if (this.chatColour[i2] === 7) {
          colour = this.sceneCycle % 20 < 10 ? 255 /* BLUE */ : 65535 /* CYAN */;
        } else if (this.chatColour[i2] === 8) {
          colour = this.sceneCycle % 20 < 10 ? 45056 : 8454016;
        } else if (this.chatColour[i2] === 9) {
          const delta = 150 - this.chatTimer[i2];
          if (delta < 50) {
            colour = delta * 1280 + 16711680 /* RED */;
          } else if (delta < 100) {
            colour = 16776960 /* YELLOW */ - (delta - 50) * 327680;
          } else if (delta < 150) {
            colour = (delta - 100) * 5 + 65280 /* GREEN */;
          }
        } else if (this.chatColour[i2] === 10) {
          const delta = 150 - this.chatTimer[i2];
          if (delta < 50) {
            colour = delta * 5 + 16711680 /* RED */;
          } else if (delta < 100) {
            colour = 16711935 /* MAGENTA */ - (delta - 50) * 327680;
          } else if (delta < 150) {
            colour = (delta - 100) * 327680 + 255 /* BLUE */ - (delta - 100) * 5;
          }
        } else if (this.chatColour[i2] === 11) {
          const delta = 150 - this.chatTimer[i2];
          if (delta < 50) {
            colour = 16777215 /* WHITE */ - delta * 327685;
          } else if (delta < 100) {
            colour = (delta - 50) * 327685 + 65280 /* GREEN */;
          } else if (delta < 150) {
            colour = 16777215 /* WHITE */ - (delta - 100) * 327680;
          }
        }
        if (this.chatEffect[i2] === 0) {
          this.b12?.centreString(message, this.projectX, this.projectY + 1, 0 /* BLACK */);
          this.b12?.centreString(message, this.projectX, this.projectY, colour);
        } else if (this.chatEffect[i2] === 1) {
          this.b12?.centerStringWave(message, this.projectX, this.projectY + 1, 0 /* BLACK */, this.sceneCycle);
          this.b12?.centerStringWave(message, this.projectX, this.projectY, colour, this.sceneCycle);
        } else if (this.chatEffect[i2] === 2) {
          const w = this.b12?.stringWid(message) ?? 0;
          const offsetX = (150 - this.chatTimer[i2]) * (w + 100) / 150;
          Pix2D.setClipping(this.projectX - 50, 0, this.projectX + 50, 334);
          this.b12?.drawString(message, this.projectX + 50 - offsetX, this.projectY + 1, 0 /* BLACK */);
          this.b12?.drawString(message, this.projectX + 50 - offsetX, this.projectY, colour);
          Pix2D.resetClipping();
        }
      }
    }
  }
  coordArrow() {
    if (this.hintType !== 2 || !this.headicons[2]) {
      return;
    }
    this.getOverlayPos((this.hintTileX - this.mapBuildBaseX << 7) + this.hintOffsetX, (this.hintTileZ - this.mapBuildBaseZ << 7) + this.hintOffsetZ, this.hintHeight * 2);
    if (this.projectX > -1 && this.loopCycle % 20 < 10) {
      this.headicons[2].plotSprite(this.projectX - 12, this.projectY - 28);
    }
  }
  textureRunAnims(cycle) {
    if (!Client.lowMem) {
      if (Pix3D.textureCycle[17] >= cycle) {
        const texture = Pix3D.textures[17];
        if (!texture) {
          return;
        }
        const bottom = texture.wi * texture.hi - 1;
        const adjustment = texture.wi * this.worldUpdateNum * 2;
        const src = texture.data;
        const dst = this.textureBuffer;
        for (let i2 = 0;i2 <= bottom; i2++) {
          dst[i2] = src[i2 - adjustment & bottom];
        }
        texture.data = dst;
        this.textureBuffer = src;
        Pix3D.pushTexture(17);
      }
      if (Pix3D.textureCycle[24] >= cycle) {
        const texture = Pix3D.textures[24];
        if (!texture) {
          return;
        }
        const bottom = texture.wi * texture.hi - 1;
        const adjustment = texture.wi * this.worldUpdateNum * 2;
        const src = texture.data;
        const dst = this.textureBuffer;
        for (let i2 = 0;i2 <= bottom; i2++) {
          dst[i2] = src[i2 - adjustment & bottom];
        }
        texture.data = dst;
        this.textureBuffer = src;
        Pix3D.pushTexture(24);
      }
    }
  }
  otherOverlays() {
    this.drawPrivateMessages();
    if (this.crossMode === 1) {
      this.cross[this.crossCycle / 100 | 0]?.plotSprite(this.crossX - 8 - 4, this.crossY - 8 - 4);
    } else if (this.crossMode === 2) {
      this.cross[(this.crossCycle / 100 | 0) + 4]?.plotSprite(this.crossX - 8 - 4, this.crossY - 8 - 4);
      Client.cyclelogic5++;
      if (Client.cyclelogic5 > 57) {
        Client.cyclelogic5 = 0;
        this.out.pIsaac(100 /* ANTICHEAT_CYCLELOGIC5 */);
      }
    }
    if (this.mainOverlayId !== -1) {
      this.animateInterface(this.mainOverlayId, this.worldUpdateNum);
      this.drawInterface(IfType.list[this.mainOverlayId], 0, 0, 0);
    }
    if (this.mainModalId !== -1) {
      this.animateInterface(this.mainModalId, this.worldUpdateNum);
      this.drawInterface(IfType.list[this.mainModalId], 0, 0, 0);
    }
    this.getSpecialArea();
    if (!this.isMenuOpen) {
      this.buildMinimenu();
      this.drawFeedback();
    } else if (this.menuArea === 0) {
      this.drawMinimenu();
    }
    if (this.inMultizone === 1) {
      this.headicons[1]?.plotSprite(472, 296);
    }
    if (this.showFps) {
      const x2 = 507;
      let y = 20;
      let colour = 16776960 /* YELLOW */;
      if (this.fps < 15) {
        colour = 16711680 /* RED */;
      }
      this.p12?.drawStringRight("Fps:" + this.fps, x2, y, colour);
      y += 15;
      let memoryUsage = -1;
      if (typeof window.performance["memory"] !== "undefined") {
        const memory = window.performance["memory"];
        memoryUsage = memory.usedJSHeapSize / 1024 | 0;
      }
      if (memoryUsage !== -1) {
        this.p12?.drawStringRight("Mem:" + memoryUsage + "k", x2, y, 16776960 /* YELLOW */);
      }
    }
    if (this.rebootTimer !== 0) {
      let seconds = this.rebootTimer / 50 | 0;
      const minutes = seconds / 60 | 0;
      seconds %= 60;
      if (seconds < 10) {
        this.p12?.drawString("System update in: " + minutes + ":0" + seconds, 4, 329, 16776960 /* YELLOW */);
      } else {
        this.p12?.drawString("System update in: " + minutes + ":" + seconds, 4, 329, 16776960 /* YELLOW */);
      }
    }
  }
  drawPrivateMessages() {
    if (this.splitPrivateChat === 0) {
      return;
    }
    const font = this.p12;
    let lineOffset = 0;
    if (this.rebootTimer !== 0) {
      lineOffset = 1;
    }
    for (let i2 = 0;i2 < 100; i2++) {
      if (!this.chatText[i2]) {
        continue;
      }
      const type = this.chatType[i2];
      let sender = this.chatUsername[i2];
      let modlevel = 0;
      if (sender && sender.startsWith("@cr1@")) {
        sender = sender.substring(5);
        modlevel = 1;
      } else if (sender && sender.startsWith("@cr2@")) {
        sender = sender.substring(5);
        modlevel = 2;
      }
      if ((type == 3 || type == 7) && (type == 7 || this.chatPrivateMode == 0 || this.chatPrivateMode == 1 && this.isFriend(sender))) {
        const y = 329 - lineOffset * 13;
        let x2 = 4;
        font?.drawString("From", 4, y, 0 /* BLACK */);
        font?.drawString("From", 4, y - 1, 65535 /* CYAN */);
        x2 += font?.stringWid("From ") ?? 0;
        if (modlevel == 1) {
          this.modIcons[0].plotSprite(x2, y - 12);
          x2 += 14;
        } else if (modlevel == 2) {
          this.modIcons[1].plotSprite(x2, y - 12);
          x2 += 14;
        }
        font?.drawString(sender + ": " + this.chatText[i2], x2, y, 0 /* BLACK */);
        font?.drawString(sender + ": " + this.chatText[i2], x2, y - 1, 65535 /* CYAN */);
        lineOffset++;
        if (lineOffset >= 5) {
          return;
        }
      } else if (type === 5 && this.chatPrivateMode < 2) {
        const y = 329 - lineOffset * 13;
        font?.drawString(this.chatText[i2], 4, y, 0 /* BLACK */);
        font?.drawString(this.chatText[i2], 4, y - 1, 65535 /* CYAN */);
        lineOffset++;
        if (lineOffset >= 5) {
          return;
        }
      } else if (type === 6 && this.chatPrivateMode < 2) {
        const y = 329 - lineOffset * 13;
        font?.drawString("To " + sender + ": " + this.chatText[i2], 4, y, 0 /* BLACK */);
        font?.drawString("To " + sender + ": " + this.chatText[i2], 4, y - 1, 65535 /* CYAN */);
        lineOffset++;
        if (lineOffset >= 5) {
          return;
        }
      }
    }
  }
  getSpecialArea() {
    if (!this.localPlayer) {
      return;
    }
    const x2 = (this.localPlayer.x >> 7) + this.mapBuildBaseX;
    const z = (this.localPlayer.z >> 7) + this.mapBuildBaseZ;
    this.chatDisabled = 0;
    if (x2 >= 3053 && x2 <= 3156 && z >= 3056 && z <= 3136) {
      this.chatDisabled = 1;
    } else if (x2 >= 3072 && x2 <= 3118 && z >= 9492 && z <= 9535) {
      this.chatDisabled = 1;
    }
    if (this.chatDisabled === 1 && x2 >= 3139 && x2 <= 3199 && z >= 3008 && z <= 3062) {
      this.chatDisabled = 0;
    }
  }
  getOverlayPosEntity(entity, height) {
    this.getOverlayPos(entity.x, entity.z, height);
  }
  getOverlayPos(x2, z, height) {
    if (x2 < 128 || z < 128 || x2 > 13056 || z > 13056) {
      this.projectX = -1;
      this.projectY = -1;
      return;
    }
    const y = this.getAvH(x2, z, this.minusedlevel) - height;
    let dx = x2 - this.camX;
    let dy = y - this.camY;
    let dz = z - this.camZ;
    const sinPitch = Pix3D.sinTable[this.camPitch];
    const cosPitch = Pix3D.cosTable[this.camPitch];
    const sinYaw = Pix3D.sinTable[this.camYaw];
    const cosYaw = Pix3D.cosTable[this.camYaw];
    let tmp = dz * sinYaw + dx * cosYaw >> 16;
    dz = dz * cosYaw - dx * sinYaw >> 16;
    dx = tmp;
    tmp = dy * cosPitch - dz * sinPitch >> 16;
    dz = dy * sinPitch + dz * cosPitch >> 16;
    dy = tmp;
    if (dz >= 50) {
      this.projectX = Pix3D.originX + ((dx << 9) / dz | 0);
      this.projectY = Pix3D.originY + ((dy << 9) / dz | 0);
    } else {
      this.projectX = -1;
      this.projectY = -1;
    }
  }
  getAvH(sceneX, sceneZ, level) {
    if (!this.groundh) {
      return 0;
    }
    const tileX = sceneX >> 7;
    const tileZ = sceneZ >> 7;
    if (tileX < 0 || tileZ < 0 || tileX > 103 || tileZ > 103) {
      return 0;
    }
    let realLevel = level;
    if (level < 3 && this.mapl && (this.mapl[1][tileX][tileZ] & 2 /* LinkBelow */) !== 0) {
      realLevel = level + 1;
    }
    const tileLocalX = sceneX & 127;
    const tileLocalZ = sceneZ & 127;
    const y00 = this.groundh[realLevel][tileX][tileZ] * (128 - tileLocalX) + this.groundh[realLevel][tileX + 1][tileZ] * tileLocalX >> 7;
    const y11 = this.groundh[realLevel][tileX][tileZ + 1] * (128 - tileLocalX) + this.groundh[realLevel][tileX + 1][tileZ + 1] * tileLocalX >> 7;
    return y00 * (128 - tileLocalZ) + y11 * tileLocalZ >> 7;
  }
  checkMinimap() {
    if (Client.lowMem && this.sceneState === 2 && ClientBuild.minusedlevel !== this.minusedlevel) {
      this.areaViewport?.setPixels();
      this.p12?.centreString("Loading - please wait.", 257, 151, 0 /* BLACK */);
      this.p12?.centreString("Loading - please wait.", 256, 150, 16777215 /* WHITE */);
      this.areaViewport?.draw(4, 4);
      this.sceneState = 1;
      this.sceneLoadStartTime = performance.now();
    }
    if (this.sceneState === 1) {
      const status = this.checkScene();
      if (status != 0 && performance.now() - this.sceneLoadStartTime > 360000) {
        console.log(`${this.loginUser} glcfb ${this.loginSeed},${status},${Client.lowMem},${this.db !== null},${this.onDemand?.remaining()},${this.minusedlevel},${this.mapBuildCenterZoneX},${this.mapBuildCenterZoneZ}`);
        this.sceneLoadStartTime = performance.now();
      }
    }
    if (this.sceneState === 2 && this.minusedlevel !== this.minimapLevel) {
      this.minimapLevel = this.minusedlevel;
      this.minimapBuildBuffer(this.minusedlevel);
    }
  }
  checkScene() {
    if (!this.mapBuildIndex || !this.mapBuildGroundData || !this.mapBuildLocationData) {
      return -1000;
    }
    for (let i2 = 0;i2 < this.mapBuildGroundData.length; i2++) {
      if (this.mapBuildGroundData[i2] == null && this.mapBuildGroundFile[i2] !== -1) {
        return -1;
      }
      if (this.mapBuildLocationData[i2] == null && this.mapBuildLocationFile[i2] !== -1) {
        return -2;
      }
    }
    let ready = true;
    for (let i2 = 0;i2 < this.mapBuildGroundData.length; i2++) {
      const data = this.mapBuildLocationData[i2];
      if (data != null) {
        const x2 = (this.mapBuildIndex[i2] >> 8) * 64 - this.mapBuildBaseX;
        const z = (this.mapBuildIndex[i2] & 255) * 64 - this.mapBuildBaseZ;
        if (!ClientBuild.checkLocations(data, x2, z)) {
          ready = false;
        }
      }
    }
    if (!ready) {
      return -3;
    } else if (this.awaitingPlayerInfo) {
      return -4;
    }
    this.sceneState = 2;
    ClientBuild.minusedlevel = this.minusedlevel;
    this.mapBuild();
    this.out.pIsaac(134 /* MAP_BUILD_COMPLETE */);
    return 0;
  }
  mapBuild() {
    try {
      this.minimapLevel = -1;
      this.spotanims.clear();
      this.projectiles.clear();
      Pix3D.clearTexels();
      this.clearCaches();
      this.world?.resetMap();
      for (let level = 0;level < 4 /* LEVELS */; level++) {
        this.collision[level]?.reset();
      }
      const build = new ClientBuild(104 /* SIZE */, 104 /* SIZE */, this.groundh, this.mapl);
      const maps = this.mapBuildGroundData?.length ?? 0;
      ClientBuild.lowMem = World.lowMem;
      if (this.mapBuildIndex) {
        for (let index = 0;index < maps; index++) {
          const x2 = this.mapBuildIndex[index] >> 8;
          const z = this.mapBuildIndex[index] & 255;
          if (x2 === 33 && z >= 71 && z <= 73) {
            ClientBuild.lowMem = false;
            break;
          }
        }
      }
      if (ClientBuild.lowMem) {
        this.world?.fillBaseLevel(this.minusedlevel);
      } else {
        this.world?.fillBaseLevel(0);
      }
      if (this.mapBuildIndex && this.mapBuildGroundData) {
        this.out.pIsaac(239 /* NO_TIMEOUT */);
        for (let i2 = 0;i2 < maps; i2++) {
          const x2 = (this.mapBuildIndex[i2] >> 8) * 64 - this.mapBuildBaseX;
          const z = (this.mapBuildIndex[i2] & 255) * 64 - this.mapBuildBaseZ;
          const data = this.mapBuildGroundData[i2];
          if (data) {
            build.loadGround(data, (this.mapBuildCenterZoneX - 6) * 8, (this.mapBuildCenterZoneZ - 6) * 8, x2, z);
          }
        }
        for (let i2 = 0;i2 < maps; i2++) {
          const x2 = (this.mapBuildIndex[i2] >> 8) * 64 - this.mapBuildBaseX;
          const z = (this.mapBuildIndex[i2] & 255) * 64 - this.mapBuildBaseZ;
          const data = this.mapBuildGroundData[i2];
          if (!data && this.mapBuildCenterZoneZ < 800) {
            build.fadeAdjacent(z, x2, 64, 64);
          }
        }
      }
      if (this.mapBuildIndex && this.mapBuildLocationData) {
        this.out.pIsaac(239 /* NO_TIMEOUT */);
        for (let i2 = 0;i2 < maps; i2++) {
          const data = this.mapBuildLocationData[i2];
          if (data) {
            const x2 = (this.mapBuildIndex[i2] >> 8) * 64 - this.mapBuildBaseX;
            const z = (this.mapBuildIndex[i2] & 255) * 64 - this.mapBuildBaseZ;
            build.loadLocations(data, x2, z, this.loopCycle, this.world, this.collision);
          }
        }
      }
      this.out.pIsaac(239 /* NO_TIMEOUT */);
      build.finishBuild(this.world, this.collision);
      this.areaViewport?.setPixels();
      this.out.pIsaac(239 /* NO_TIMEOUT */);
      for (let x2 = 0;x2 < 104 /* SIZE */; x2++) {
        for (let z = 0;z < 104 /* SIZE */; z++) {
          this.showObject(x2, z);
        }
      }
      this.locChangePostBuildCorrect();
    } catch (e) {
      console.error(e);
    }
    LocType.mc1?.clear();
    if (Client.lowMem && this.db) {
      const modelCount = this.onDemand?.getFileCount(0) ?? 0;
      for (let i2 = 0;i2 < modelCount; i2++) {
        const flags = this.onDemand?.getModelUse(i2) ?? 0;
        if ((flags & 121) == 0) {
          Model.unload(i2);
        }
      }
    }
    Pix3D.initPool(20);
    this.onDemand?.clearPrefetches();
    let left = (this.mapBuildCenterZoneX - 6) / 8 - 1;
    let right = (this.mapBuildCenterZoneX + 6) / 8 + 1;
    let bottom = (this.mapBuildCenterZoneZ - 6) / 8 - 1;
    let top = (this.mapBuildCenterZoneZ + 6) / 8 + 1;
    if (this.withinTutorialIsland) {
      left = 49;
      right = 50;
      bottom = 49;
      top = 50;
    }
    for (let x2 = left;x2 <= right; x2++) {
      for (let z = bottom;z <= top; z++) {
        if (left == x2 || right == x2 || bottom == z || top == z) {
          const land = this.onDemand?.getMapFile(z, x2, 0) ?? -1;
          if (land != -1) {
            this.onDemand?.prefetch(3, land);
          }
          const loc = this.onDemand?.getMapFile(z, x2, 1) ?? -1;
          if (loc != -1) {
            this.onDemand?.prefetch(3, loc);
          }
        }
      }
    }
  }
  minimapBuildBuffer(level) {
    if (!this.minimap) {
      return;
    }
    const pixels = this.minimap.data;
    const length = pixels.length;
    for (let i2 = 0;i2 < length; i2++) {
      pixels[i2] = 0;
    }
    for (let z = 1;z < 104 /* SIZE */ - 1; z++) {
      let offset = (104 /* SIZE */ - 1 - z) * 512 * 4 + 24628;
      for (let x2 = 1;x2 < 104 /* SIZE */ - 1; x2++) {
        if (this.mapl && (this.mapl[level][x2][z] & (8 /* VisBelow */ | 16 /* ForceHighDetail */)) === 0) {
          this.world?.render2DGround(level, x2, z, pixels, offset, 512);
        }
        if (level < 3 && this.mapl && (this.mapl[level + 1][x2][z] & 8 /* VisBelow */) !== 0) {
          this.world?.render2DGround(level + 1, x2, z, pixels, offset, 512);
        }
        offset += 4;
      }
    }
    const inactiveRgb = ((Math.random() * 20 | 0) + 238 - 10 << 16) + ((Math.random() * 20 | 0) + 238 - 10 << 8) + (Math.random() * 20 | 0) + 238 - 10;
    const activeRgb = (Math.random() * 20 | 0) + 238 - 10 << 16;
    this.minimap.setPixels();
    for (let z = 1;z < 104 /* SIZE */ - 1; z++) {
      for (let x2 = 1;x2 < 104 /* SIZE */ - 1; x2++) {
        if (this.mapl && (this.mapl[level][x2][z] & (8 /* VisBelow */ | 16 /* ForceHighDetail */)) === 0) {
          this.drawDetail(level, x2, z, inactiveRgb, activeRgb);
        }
        if (level < 3 && this.mapl && (this.mapl[level + 1][x2][z] & 8 /* VisBelow */) !== 0) {
          this.drawDetail(level + 1, x2, z, inactiveRgb, activeRgb);
        }
      }
    }
    this.areaViewport?.setPixels();
    this.activeMapFunctionCount = 0;
    for (let x2 = 0;x2 < 104 /* SIZE */; x2++) {
      for (let z = 0;z < 104 /* SIZE */; z++) {
        const typecode = this.world?.gdType(this.minusedlevel, x2, z) ?? 0;
        if (typecode === 0) {
          continue;
        }
        const locId = typecode >> 14 & 32767;
        const func = LocType.list(locId).mapfunction;
        if (func < 0) {
          continue;
        }
        let stx = x2;
        let stz = z;
        if (func !== 22 && func !== 29 && func !== 34 && func !== 36 && func !== 46 && func !== 47 && func !== 48) {
          const maxX = 104 /* SIZE */;
          const maxZ = 104 /* SIZE */;
          const collisionMap = this.collision[this.minusedlevel];
          if (collisionMap) {
            const flags = collisionMap.flags;
            for (let i2 = 0;i2 < 10; i2++) {
              const rand = Math.random() * 4 | 0;
              if (rand === 0 && stx > 0 && stx > x2 - 3 && (flags[CollisionMap.index(stx - 1, stz)] & 2621704 /* BLOCK_WEST */) === 0 /* OPEN */) {
                stx--;
              }
              if (rand === 1 && stx < maxX - 1 && stx < x2 + 3 && (flags[CollisionMap.index(stx + 1, stz)] & 2621824 /* BLOCK_EAST */) === 0 /* OPEN */) {
                stx++;
              }
              if (rand === 2 && stz > 0 && stz > z - 3 && (flags[CollisionMap.index(stx, stz - 1)] & 2621698 /* BLOCK_SOUTH */) === 0 /* OPEN */) {
                stz--;
              }
              if (rand === 3 && stz < maxZ - 1 && stz < z + 3 && (flags[CollisionMap.index(stx, stz + 1)] & 2621728 /* BLOCK_NORTH */) === 0 /* OPEN */) {
                stz++;
              }
            }
          }
        }
        this.activeMapFunctions[this.activeMapFunctionCount] = this.mapfunction[func];
        this.activeMapFunctionX[this.activeMapFunctionCount] = stx;
        this.activeMapFunctionZ[this.activeMapFunctionCount] = stz;
        this.activeMapFunctionCount++;
      }
    }
    Client.cyclelogic3++;
    if (Client.cyclelogic3 > 112) {
      Client.cyclelogic3 = 0;
      this.out.pIsaac(4 /* ANTICHEAT_CYCLELOGIC3 */);
      this.out.p1(50);
    }
  }
  drawDetail(level, tileX, tileZ, inactiveRgb, activeRgb) {
    if (!this.world || !this.minimap) {
      return;
    }
    const wallType = this.world.wallType(level, tileX, tileZ);
    if (wallType !== 0) {
      const info = this.world.typeCode2(level, tileX, tileZ, wallType);
      const angle = info >> 6 & 3;
      const shape = info & 31;
      let rgb = inactiveRgb;
      if (wallType > 0) {
        rgb = activeRgb;
      }
      const dst = this.minimap.data;
      const offset = tileX * 4 + (103 - tileZ) * 512 * 4 + 24624;
      const locId = wallType >> 14 & 32767;
      const loc = LocType.list(locId);
      if (loc.mapscene !== -1) {
        const scene = this.mapscene[loc.mapscene];
        if (scene) {
          const offsetX = (loc.width * 4 - scene.wi) / 2 | 0;
          const offsetY = (loc.length * 4 - scene.hi) / 2 | 0;
          scene.plotSprite(tileX * 4 + 48 + offsetX, (104 /* SIZE */ - tileZ - loc.length) * 4 + offsetY + 48);
        }
      } else {
        if (shape === 0 /* WALL_STRAIGHT */ || shape === 2 /* WALL_L */) {
          if (angle === 0 /* WEST */) {
            dst[offset] = rgb;
            dst[offset + 512] = rgb;
            dst[offset + 1024] = rgb;
            dst[offset + 1536] = rgb;
          } else if (angle === 1 /* NORTH */) {
            dst[offset] = rgb;
            dst[offset + 1] = rgb;
            dst[offset + 2] = rgb;
            dst[offset + 3] = rgb;
          } else if (angle === 2 /* EAST */) {
            dst[offset + 3] = rgb;
            dst[offset + 3 + 512] = rgb;
            dst[offset + 3 + 1024] = rgb;
            dst[offset + 3 + 1536] = rgb;
          } else if (angle === 3 /* SOUTH */) {
            dst[offset + 1536] = rgb;
            dst[offset + 1536 + 1] = rgb;
            dst[offset + 1536 + 2] = rgb;
            dst[offset + 1536 + 3] = rgb;
          }
        }
        if (shape === 3 /* WALL_SQUARE_CORNER */) {
          if (angle === 0 /* WEST */) {
            dst[offset] = rgb;
          } else if (angle === 1 /* NORTH */) {
            dst[offset + 3] = rgb;
          } else if (angle === 2 /* EAST */) {
            dst[offset + 3 + 1536] = rgb;
          } else if (angle === 3 /* SOUTH */) {
            dst[offset + 1536] = rgb;
          }
        }
        if (shape === 2 /* WALL_L */) {
          if (angle === 3 /* SOUTH */) {
            dst[offset] = rgb;
            dst[offset + 512] = rgb;
            dst[offset + 1024] = rgb;
            dst[offset + 1536] = rgb;
          } else if (angle === 0 /* WEST */) {
            dst[offset] = rgb;
            dst[offset + 1] = rgb;
            dst[offset + 2] = rgb;
            dst[offset + 3] = rgb;
          } else if (angle === 1 /* NORTH */) {
            dst[offset + 3] = rgb;
            dst[offset + 3 + 512] = rgb;
            dst[offset + 3 + 1024] = rgb;
            dst[offset + 3 + 1536] = rgb;
          } else if (angle === 2 /* EAST */) {
            dst[offset + 1536] = rgb;
            dst[offset + 1536 + 1] = rgb;
            dst[offset + 1536 + 2] = rgb;
            dst[offset + 1536 + 3] = rgb;
          }
        }
      }
    }
    const sceneType = this.world.sceneType(level, tileX, tileZ);
    if (sceneType !== 0) {
      const info = this.world.typeCode2(level, tileX, tileZ, sceneType);
      const angle = info >> 6 & 3;
      const shape = info & 31;
      const locId = sceneType >> 14 & 32767;
      const loc = LocType.list(locId);
      if (loc.mapscene !== -1) {
        const scene = this.mapscene[loc.mapscene];
        if (scene) {
          const offsetX = (loc.width * 4 - scene.wi) / 2 | 0;
          const offsetY = (loc.length * 4 - scene.hi) / 2 | 0;
          scene.plotSprite(tileX * 4 + 48 + offsetX, (104 /* SIZE */ - tileZ - loc.length) * 4 + offsetY + 48);
        }
      } else {
        if (shape === 9 /* WALL_DIAGONAL */) {
          let rgb = 15658734;
          if (sceneType > 0) {
            rgb = 15597568;
          }
          const dst = this.minimap.data;
          const offset = tileX * 4 + (104 /* SIZE */ - 1 - tileZ) * 512 * 4 + 24624;
          if (angle === 0 /* WEST */ || angle === 2 /* EAST */) {
            dst[offset + 1536] = rgb;
            dst[offset + 1024 + 1] = rgb;
            dst[offset + 512 + 2] = rgb;
            dst[offset + 3] = rgb;
          } else {
            dst[offset] = rgb;
            dst[offset + 512 + 1] = rgb;
            dst[offset + 1024 + 2] = rgb;
            dst[offset + 1536 + 3] = rgb;
          }
        }
      }
    }
    const gdType = this.world.gdType(level, tileX, tileZ);
    if (gdType !== 0) {
      const locId = gdType >> 14 & 32767;
      const loc = LocType.list(locId);
      if (loc.mapscene !== -1) {
        const scene = this.mapscene[loc.mapscene];
        if (scene) {
          const offsetX = (loc.width * 4 - scene.wi) / 2 | 0;
          const offsetY = (loc.length * 4 - scene.hi) / 2 | 0;
          scene.plotSprite(tileX * 4 + 48 + offsetX, (104 /* SIZE */ - tileZ - loc.length) * 4 + offsetY + 48);
        }
      }
    }
  }
  interactWithLoc(x2, z, typecode, opcode) {
    if (!this.localPlayer || !this.world) {
      return false;
    }
    const locId = typecode >> 14 & 32767;
    const info = this.world.typeCode2(this.minusedlevel, x2, z, typecode);
    if (info === -1) {
      return false;
    }
    const shape = info & 31;
    const angle = info >> 6 & 3;
    Client.cyclelogic2++;
    if (Client.cyclelogic2 > 1086) {
      Client.cyclelogic2 = 0;
      this.out.pIsaac(225 /* ANTICHEAT_CYCLELOGIC2 */);
      this.out.p1(0);
      const start = this.out.pos;
      if ((Math.random() * 2 | 0) == 0) {
        this.out.p2(16791);
      }
      this.out.p1(254);
      this.out.p2(Math.random() * 65536 | 0);
      this.out.p2(16128);
      this.out.p2(52610);
      this.out.p2(Math.random() * 65536 | 0);
      this.out.p2(55420);
      if ((Math.random() * 2 | 0) == 0) {
        this.out.p2(35025);
      }
      this.out.p2(46628);
      this.out.p1(Math.random() * 256 | 0);
      this.out.psize1(this.out.pos - start);
    }
    if (shape === 10 /* CENTREPIECE_STRAIGHT */ || shape === 11 /* CENTREPIECE_DIAGONAL */ || shape === 22 /* GROUND_DECOR */) {
      const loc = LocType.list(locId);
      let width;
      let height;
      if (angle === 0 /* WEST */ || angle === 2 /* EAST */) {
        width = loc.width;
        height = loc.length;
      } else {
        width = loc.length;
        height = loc.width;
      }
      let forceapproach = loc.forceapproach;
      if (angle !== 0) {
        forceapproach = (forceapproach << angle & 15) + (forceapproach >> 4 - angle);
      }
      this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], x2, z, false, width, height, 0, 0, forceapproach, 2);
    } else {
      this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], x2, z, false, 0, 0, angle, shape + 1, 0, 2);
    }
    this.crossX = this.mouseClickX;
    this.crossY = this.mouseClickY;
    this.crossMode = 2;
    this.crossCycle = 0;
    this.out.pIsaac(opcode);
    this.out.p2(x2 + this.mapBuildBaseX);
    this.out.p2(z + this.mapBuildBaseZ);
    this.out.p2(locId);
    return true;
  }
  tryMove(srcX, srcZ, dx, dz, tryNearest, locWidth, locLength, locAngle, locShape, forceapproach, type) {
    const collisionMap = this.collision[this.minusedlevel];
    if (!collisionMap) {
      return false;
    }
    const sceneWidth = 104 /* SIZE */;
    const sceneLength = 104 /* SIZE */;
    for (let x3 = 0;x3 < sceneWidth; x3++) {
      for (let z2 = 0;z2 < sceneLength; z2++) {
        const index = CollisionMap.index(x3, z2);
        this.dirMap[index] = 0;
        this.distMap[index] = 99999999;
      }
    }
    let x2 = srcX;
    let z = srcZ;
    const srcIndex = CollisionMap.index(srcX, srcZ);
    this.dirMap[srcIndex] = 99;
    this.distMap[srcIndex] = 0;
    let steps = 0;
    let length = 0;
    this.routeX[steps] = srcX;
    this.routeZ[steps++] = srcZ;
    let arrived = false;
    let bufferSize = this.routeX.length;
    const flags = collisionMap.flags;
    while (length !== steps) {
      x2 = this.routeX[length];
      z = this.routeZ[length];
      length = (length + 1) % bufferSize;
      if (x2 === dx && z === dz) {
        arrived = true;
        break;
      }
      if (locShape !== 0 /* WALL_STRAIGHT */) {
        if ((locShape < 5 /* WALLDECOR_STRAIGHT_OFFSET */ || locShape === 10 /* CENTREPIECE_STRAIGHT */) && collisionMap.testWall(x2, z, dx, dz, locShape - 1, locAngle)) {
          arrived = true;
          break;
        }
        if (locShape < 10 /* CENTREPIECE_STRAIGHT */ && collisionMap.testWDecor(x2, z, dx, dz, locShape - 1, locAngle)) {
          arrived = true;
          break;
        }
      }
      if (locWidth !== 0 && locLength !== 0 && collisionMap.testLoc(x2, z, dx, dz, locWidth, locLength, forceapproach)) {
        arrived = true;
        break;
      }
      const nextCost = this.distMap[CollisionMap.index(x2, z)] + 1;
      let index = CollisionMap.index(x2 - 1, z);
      if (x2 > 0 && this.dirMap[index] === 0 && (flags[index] & 2621704 /* BLOCK_WEST */) === 0 /* OPEN */) {
        this.routeX[steps] = x2 - 1;
        this.routeZ[steps] = z;
        steps = (steps + 1) % bufferSize;
        this.dirMap[index] = 2;
        this.distMap[index] = nextCost;
      }
      index = CollisionMap.index(x2 + 1, z);
      if (x2 < sceneWidth - 1 && this.dirMap[index] === 0 && (flags[index] & 2621824 /* BLOCK_EAST */) === 0 /* OPEN */) {
        this.routeX[steps] = x2 + 1;
        this.routeZ[steps] = z;
        steps = (steps + 1) % bufferSize;
        this.dirMap[index] = 8;
        this.distMap[index] = nextCost;
      }
      index = CollisionMap.index(x2, z - 1);
      if (z > 0 && this.dirMap[index] === 0 && (flags[index] & 2621698 /* BLOCK_SOUTH */) === 0 /* OPEN */) {
        this.routeX[steps] = x2;
        this.routeZ[steps] = z - 1;
        steps = (steps + 1) % bufferSize;
        this.dirMap[index] = 1;
        this.distMap[index] = nextCost;
      }
      index = CollisionMap.index(x2, z + 1);
      if (z < sceneLength - 1 && this.dirMap[index] === 0 && (flags[index] & 2621728 /* BLOCK_NORTH */) === 0 /* OPEN */) {
        this.routeX[steps] = x2;
        this.routeZ[steps] = z + 1;
        steps = (steps + 1) % bufferSize;
        this.dirMap[index] = 4;
        this.distMap[index] = nextCost;
      }
      index = CollisionMap.index(x2 - 1, z - 1);
      if (x2 > 0 && z > 0 && this.dirMap[index] === 0 && (flags[index] & 2621710 /* BLOCK_SOUTH_WEST */) === 0 && (flags[CollisionMap.index(x2 - 1, z)] & 2621704 /* BLOCK_WEST */) === 0 /* OPEN */ && (flags[CollisionMap.index(x2, z - 1)] & 2621698 /* BLOCK_SOUTH */) === 0 /* OPEN */) {
        this.routeX[steps] = x2 - 1;
        this.routeZ[steps] = z - 1;
        steps = (steps + 1) % bufferSize;
        this.dirMap[index] = 3;
        this.distMap[index] = nextCost;
      }
      index = CollisionMap.index(x2 + 1, z - 1);
      if (x2 < sceneWidth - 1 && z > 0 && this.dirMap[index] === 0 && (flags[index] & 2621827 /* BLOCK_SOUTH_EAST */) === 0 && (flags[CollisionMap.index(x2 + 1, z)] & 2621824 /* BLOCK_EAST */) === 0 /* OPEN */ && (flags[CollisionMap.index(x2, z - 1)] & 2621698 /* BLOCK_SOUTH */) === 0 /* OPEN */) {
        this.routeX[steps] = x2 + 1;
        this.routeZ[steps] = z - 1;
        steps = (steps + 1) % bufferSize;
        this.dirMap[index] = 9;
        this.distMap[index] = nextCost;
      }
      index = CollisionMap.index(x2 - 1, z + 1);
      if (x2 > 0 && z < sceneLength - 1 && this.dirMap[index] === 0 && (flags[index] & 2621752 /* BLOCK_NORTH_WEST */) === 0 && (flags[CollisionMap.index(x2 - 1, z)] & 2621704 /* BLOCK_WEST */) === 0 /* OPEN */ && (flags[CollisionMap.index(x2, z + 1)] & 2621728 /* BLOCK_NORTH */) === 0 /* OPEN */) {
        this.routeX[steps] = x2 - 1;
        this.routeZ[steps] = z + 1;
        steps = (steps + 1) % bufferSize;
        this.dirMap[index] = 6;
        this.distMap[index] = nextCost;
      }
      index = CollisionMap.index(x2 + 1, z + 1);
      if (x2 < sceneWidth - 1 && z < sceneLength - 1 && this.dirMap[index] === 0 && (flags[index] & 2621920 /* BLOCK_NORTH_EAST */) === 0 && (flags[CollisionMap.index(x2 + 1, z)] & 2621824 /* BLOCK_EAST */) === 0 /* OPEN */ && (flags[CollisionMap.index(x2, z + 1)] & 2621728 /* BLOCK_NORTH */) === 0 /* OPEN */) {
        this.routeX[steps] = x2 + 1;
        this.routeZ[steps] = z + 1;
        steps = (steps + 1) % bufferSize;
        this.dirMap[index] = 12;
        this.distMap[index] = nextCost;
      }
    }
    this.tryMoveNearest = 0;
    if (!arrived) {
      if (tryNearest) {
        let min = 100;
        for (let padding = 1;padding < 2; padding++) {
          for (let px = dx - padding;px <= dx + padding; px++) {
            for (let pz = dz - padding;pz <= dz + padding; pz++) {
              const index = CollisionMap.index(px, pz);
              if (px >= 0 && pz >= 0 && px < 104 /* SIZE */ && pz < 104 /* SIZE */ && this.distMap[index] < min) {
                min = this.distMap[index];
                x2 = px;
                z = pz;
                this.tryMoveNearest = 1;
                arrived = true;
              }
            }
          }
          if (arrived) {
            break;
          }
        }
      }
      if (!arrived) {
        return false;
      }
    }
    length = 0;
    this.routeX[length] = x2;
    this.routeZ[length++] = z;
    let dir = this.dirMap[CollisionMap.index(x2, z)];
    let next2 = dir;
    while (x2 !== srcX || z !== srcZ) {
      if (next2 !== dir) {
        dir = next2;
        this.routeX[length] = x2;
        this.routeZ[length++] = z;
      }
      if ((next2 & 2 /* EAST */) !== 0) {
        x2++;
      } else if ((next2 & 8 /* WEST */) !== 0) {
        x2--;
      }
      if ((next2 & 1 /* NORTH */) !== 0) {
        z++;
      } else if ((next2 & 4 /* SOUTH */) !== 0) {
        z--;
      }
      next2 = this.dirMap[CollisionMap.index(x2, z)];
    }
    if (length > 0) {
      bufferSize = Math.min(length, 25);
      length--;
      const startX = this.routeX[length];
      const startZ = this.routeZ[length];
      if (type === 0) {
        this.out.pIsaac(6 /* MOVE_GAMECLICK */);
        this.out.p1(bufferSize + bufferSize + 3);
      } else if (type === 1) {
        this.out.pIsaac(220 /* MOVE_MINIMAPCLICK */);
        this.out.p1(bufferSize + bufferSize + 3 + 14);
      } else if (type === 2) {
        this.out.pIsaac(127 /* MOVE_OPCLICK */);
        this.out.p1(bufferSize + bufferSize + 3);
      }
      if (this.keyHeld[5] === 1) {
        this.out.p1(1);
      } else {
        this.out.p1(0);
      }
      this.out.p2(startX + this.mapBuildBaseX);
      this.out.p2(startZ + this.mapBuildBaseZ);
      this.minimapFlagX = this.routeX[0];
      this.minimapFlagZ = this.routeZ[0];
      for (let i2 = 1;i2 < bufferSize; i2++) {
        length--;
        this.out.p1(this.routeX[length] - startX);
        this.out.p1(this.routeZ[length] - startZ);
      }
      return true;
    }
    return type !== 1;
  }
  async tcpIn() {
    if (!this.stream) {
      return false;
    }
    try {
      let available = this.stream.available;
      if (available === 0) {
        return false;
      }
      if (this.ptype === -1) {
        await this.stream.readBytes(this.in.data, 0, 1);
        this.ptype = this.in.data[0] & 255;
        if (this.randomIn) {
          this.ptype = this.ptype - this.randomIn.nextInt & 255;
        }
        this.psize = ServerProtSizes[this.ptype];
        available--;
      }
      if (this.psize === -1) {
        if (available <= 0) {
          return false;
        }
        await this.stream.readBytes(this.in.data, 0, 1);
        this.psize = this.in.data[0] & 255;
        available--;
      }
      if (this.psize === -2) {
        if (available <= 1) {
          return false;
        }
        await this.stream.readBytes(this.in.data, 0, 2);
        this.in.pos = 0;
        this.psize = this.in.g2();
        available -= 2;
      }
      if (available < this.psize) {
        return false;
      }
      this.in.pos = 0;
      await this.stream.readBytes(this.in.data, 0, this.psize);
      this.timeoutTimer = performance.now();
      this.ptype2 = this.ptype1;
      this.ptype1 = this.ptype0;
      this.ptype0 = this.ptype;
      if (this.ptype === 141 /* IF_OPENCHAT */) {
        const com = this.in.g2();
        this.ifAnimReset(com);
        if (this.sideModalId !== -1) {
          this.sideModalId = -1;
          this.redrawSidebar = true;
          this.redrawSideicons = true;
        }
        this.chatComId = com;
        this.redrawChatback = true;
        this.mainModalId = -1;
        this.resumedPauseButton = false;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 249 /* IF_OPENMAIN_SIDE */) {
        const main = this.in.g2();
        const side = this.in.g2();
        if (this.chatComId !== -1) {
          this.chatComId = -1;
          this.redrawChatback = true;
        }
        if (this.dialogInputOpen) {
          this.dialogInputOpen = false;
          this.redrawChatback = true;
        }
        this.mainModalId = main;
        this.sideModalId = side;
        this.redrawSidebar = true;
        this.redrawSideicons = true;
        this.resumedPauseButton = false;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 174 /* IF_CLOSE */) {
        if (this.sideModalId !== -1) {
          this.sideModalId = -1;
          this.redrawSidebar = true;
          this.redrawSideicons = true;
        }
        if (this.chatComId !== -1) {
          this.chatComId = -1;
          this.redrawChatback = true;
        }
        if (this.dialogInputOpen) {
          this.dialogInputOpen = false;
          this.redrawChatback = true;
        }
        this.mainModalId = -1;
        this.resumedPauseButton = false;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 91 /* IF_SETTAB */) {
        let com = this.in.g2();
        const tab = this.in.g1();
        if (com === 65535) {
          com = -1;
        }
        this.sideOverlayId[tab] = com;
        this.redrawSidebar = true;
        this.redrawSideicons = true;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 197 /* IF_OPENMAIN */) {
        const com = this.in.g2();
        this.ifAnimReset(com);
        if (this.sideModalId !== -1) {
          this.sideModalId = -1;
          this.redrawSidebar = true;
          this.redrawSideicons = true;
        }
        if (this.chatComId !== -1) {
          this.chatComId = -1;
          this.redrawChatback = true;
        }
        if (this.dialogInputOpen) {
          this.dialogInputOpen = false;
          this.redrawChatback = true;
        }
        this.mainModalId = com;
        this.resumedPauseButton = false;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 187 /* IF_OPENSIDE */) {
        const com = this.in.g2();
        this.ifAnimReset(com);
        if (this.chatComId !== -1) {
          this.chatComId = -1;
          this.redrawChatback = true;
        }
        if (this.dialogInputOpen) {
          this.dialogInputOpen = false;
          this.redrawChatback = true;
        }
        this.sideModalId = com;
        this.redrawSidebar = true;
        this.redrawSideicons = true;
        this.mainModalId = -1;
        this.resumedPauseButton = false;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 138 /* IF_SETTAB_ACTIVE */) {
        this.sideTab = this.in.g1();
        this.redrawSidebar = true;
        this.redrawSideicons = true;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 85 /* IF_OPENOVERLAY */) {
        const com = this.in.g2b();
        this.mainOverlayId = com;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 38 /* IF_SETCOLOUR */) {
        const com = this.in.g2();
        const colour = this.in.g2();
        const r = colour >> 10 & 31;
        const g = colour >> 5 & 31;
        const b = colour & 31;
        IfType.list[com].colour = (r << 19) + (g << 11) + (b << 3);
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 227 /* IF_SETHIDE */) {
        const comId = this.in.g2();
        const hide = this.in.g1() === 1;
        IfType.list[comId].hide = hide;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 222 /* IF_SETOBJECT */) {
        const c = this.in.g2();
        const obj = this.in.g2();
        const zoom = this.in.g2();
        const type = ObjType.list(obj);
        IfType.list[c].model1Type = 4;
        IfType.list[c].model1Id = obj;
        IfType.list[c].modelXAn = type.xan2d;
        IfType.list[c].modelYAn = type.yan2d;
        IfType.list[c].modelZoom = type.zoom2d * 100 / zoom | 0;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 211 /* IF_SETMODEL */) {
        const com = this.in.g2();
        const m = this.in.g2();
        IfType.list[com].model1Type = 1;
        IfType.list[com].model1Id = m;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 95 /* IF_SETANIM */) {
        const com = this.in.g2();
        IfType.list[com].modelAnim = this.in.g2();
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 161 /* IF_SETPLAYERHEAD */) {
        const comId = this.in.g2();
        if (this.localPlayer) {
          IfType.list[comId].model1Type = 3;
          IfType.list[comId].model1Id = (this.localPlayer.appearance[8] << 6) + (this.localPlayer.appearance[0] << 12) + (this.localPlayer.colour[0] << 24) + (this.localPlayer.colour[4] << 18) + this.localPlayer.appearance[11];
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 41 /* IF_SETTEXT */) {
        const comId = this.in.g2();
        const text = this.in.gjstr();
        IfType.list[comId].text = text;
        if (IfType.list[comId].layerId === this.sideOverlayId[this.sideTab]) {
          this.redrawSidebar = true;
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 3 /* IF_SETNPCHEAD */) {
        const com = this.in.g2();
        const npcId = this.in.g2();
        IfType.list[com].model1Type = 2;
        IfType.list[com].model1Id = npcId;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 27 /* IF_SETPOSITION */) {
        const comId = this.in.g2();
        const x2 = this.in.g2b();
        const z = this.in.g2b();
        const com = IfType.list[comId];
        com.x = x2;
        com.y = z;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 14 /* IF_SETSCROLLPOS */) {
        const com = this.in.g2();
        let pos = this.in.g2();
        const inter = IfType.list[com];
        if (typeof inter !== "undefined" && inter.type === 0 /* TYPE_LAYER */) {
          if (pos < 0) {
            pos = 0;
          }
          if (pos > inter.scrollHeight - inter.height) {
            pos = inter.scrollHeight - inter.height;
          }
          inter.scrollPos = pos;
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 58 /* TUT_FLASH */) {
        this.tutFlashingTab = this.in.g1();
        if (this.tutFlashingTab === this.sideTab) {
          if (this.tutFlashingTab === 3) {
            this.sideTab = 1;
          } else {
            this.sideTab = 3;
          }
          this.redrawSidebar = true;
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 239 /* TUT_OPEN */) {
        this.tutComId = this.in.g2b();
        this.redrawChatback = true;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 168 /* UPDATE_INV_STOP_TRANSMIT */) {
        const component = this.in.g2();
        const inv = IfType.list[component];
        if (inv.linkObjType) {
          for (let i2 = 0;i2 < inv.linkObjType.length; i2++) {
            inv.linkObjType[i2] = -1;
            inv.linkObjType[i2] = 0;
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 28 /* UPDATE_INV_FULL */) {
        this.redrawSidebar = true;
        const component = this.in.g2();
        const inv = IfType.list[component];
        const size = this.in.g1();
        if (inv.linkObjType && inv.linkObjNumber) {
          for (let i2 = 0;i2 < size; i2++) {
            inv.linkObjType[i2] = this.in.g2();
            let count = this.in.g1();
            if (count === 255) {
              count = this.in.g4();
            }
            inv.linkObjNumber[i2] = count;
          }
          for (let i2 = size;i2 < inv.linkObjType.length; i2++) {
            inv.linkObjType[i2] = 0;
            inv.linkObjNumber[i2] = 0;
          }
        } else {
          for (let i2 = 0;i2 < size; i2++) {
            this.in.g2();
            if (this.in.g1() === 255) {
              this.in.g4();
            }
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 170 /* UPDATE_INV_PARTIAL */) {
        this.redrawSidebar = true;
        const component = this.in.g2();
        const inv = IfType.list[component];
        while (this.in.pos < this.psize) {
          const slot = this.in.g1();
          const id = this.in.g2();
          let count = this.in.g1();
          if (count === 255) {
            count = this.in.g4();
          }
          if (inv.linkObjType && inv.linkObjNumber && slot >= 0 && slot < inv.linkObjType.length) {
            inv.linkObjType[slot] = id;
            inv.linkObjNumber[slot] = count;
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 0 /* CAM_LOOKAT */) {
        this.cinemaCam = true;
        this.camLookAtLx = this.in.g1();
        this.camLookAtLz = this.in.g1();
        this.camLookAtHei = this.in.g2();
        this.camLookAtRate = this.in.g1();
        this.camLookAtRate2 = this.in.g1();
        if (this.camLookAtRate2 >= 100) {
          const sceneX = this.camLookAtLx * 128 + 64;
          const sceneZ = this.camLookAtLz * 128 + 64;
          const sceneY = this.getAvH(sceneX, sceneZ, this.minusedlevel) - this.camLookAtHei;
          const deltaX = sceneX - this.camX;
          const deltaY = sceneY - this.camY;
          const deltaZ = sceneZ - this.camZ;
          const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ) | 0;
          this.camPitch = (Math.atan2(deltaY, distance) * 325.949 | 0) & 2047;
          this.camYaw = (Math.atan2(deltaX, deltaZ) * -325.949 | 0) & 2047;
          if (this.camPitch < 128) {
            this.camPitch = 128;
          } else if (this.camPitch > 383) {
            this.camPitch = 383;
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 225 /* CAM_SHAKE */) {
        const axis = this.in.g1();
        const ran = this.in.g1();
        const amp = this.in.g1();
        const rate = this.in.g1();
        this.camShake[axis] = true;
        this.camShakeAxis[axis] = ran;
        this.camShakeRan[axis] = amp;
        this.camShakeAmp[axis] = rate;
        this.camShakeCycle[axis] = 0;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 55 /* CAM_MOVETO */) {
        this.cinemaCam = true;
        this.camMoveToLx = this.in.g1();
        this.camMoveToLz = this.in.g1();
        this.camMoveToHei = this.in.g2();
        this.camMoveToRate = this.in.g1();
        this.camMoveToRate2 = this.in.g1();
        if (this.camMoveToRate2 >= 100) {
          this.camX = this.camMoveToLx * 128 + 64;
          this.camZ = this.camMoveToLz * 128 + 64;
          this.camY = this.getAvH(this.camX, this.camZ, this.minusedlevel) - this.camMoveToHei;
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 167 /* CAM_RESET */) {
        this.cinemaCam = false;
        for (let i2 = 0;i2 < 5; i2++) {
          this.camShake[i2] = false;
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 123 /* NPC_INFO */) {
        this.getNpcPos(this.in, this.psize);
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 87 /* PLAYER_INFO */) {
        this.getPlayerPos(this.in, this.psize);
        this.awaitingPlayerInfo = false;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 29 /* FINISH_TRACKING */) {
        const tracking = InputTracking.stop();
        if (tracking) {
          this.out.pIsaac(142 /* EVENT_TRACKING */);
          this.out.p2(tracking.pos);
          this.out.pdata(tracking.data, tracking.pos, 0);
          tracking.release();
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 251 /* ENABLE_TRACKING */) {
        InputTracking.activate();
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 73 /* MESSAGE_GAME */) {
        const message = this.in.gjstr();
        if (message.endsWith(":tradereq:")) {
          const player = message.substring(0, message.indexOf(":"));
          const username = JString.toUserhash(player);
          let ignored = false;
          for (let i2 = 0;i2 < this.ignoreCount; i2++) {
            if (this.ignoreUserhash[i2] === username) {
              ignored = true;
              break;
            }
          }
          if (!ignored && this.chatDisabled === 0) {
            this.addChat(4, "wishes to trade with you.", player);
          }
        } else if (message.endsWith(":duelreq:")) {
          const player = message.substring(0, message.indexOf(":"));
          const username = JString.toUserhash(player);
          let ignored = false;
          for (let i2 = 0;i2 < this.ignoreCount; i2++) {
            if (this.ignoreUserhash[i2] === username) {
              ignored = true;
              break;
            }
          }
          if (!ignored && this.chatDisabled === 0) {
            this.addChat(8, "wishes to duel with you.", player);
          }
        } else {
          this.addChat(0, message, "");
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 63 /* UPDATE_IGNORELIST */) {
        this.ignoreCount = this.psize / 8 | 0;
        for (let i2 = 0;i2 < this.ignoreCount; i2++) {
          this.ignoreUserhash[i2] = this.in.g8();
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 24 /* CHAT_FILTER_SETTINGS */) {
        this.chatPublicMode = this.in.g1();
        this.chatPrivateMode = this.in.g1();
        this.chatTradeMode = this.in.g1();
        this.redrawPrivacySettings = true;
        this.redrawChatback = true;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 60 /* MESSAGE_PRIVATE */) {
        const from = this.in.g8();
        const messageId = this.in.g4();
        const staffModLevel = this.in.g1();
        let ignored = false;
        for (let i2 = 0;i2 < 100; i2++) {
          if (this.privateMessageIds[i2] === messageId) {
            ignored = true;
            break;
          }
        }
        if (staffModLevel <= 1) {
          for (let i2 = 0;i2 < this.ignoreCount; i2++) {
            if (this.ignoreUserhash[i2] === from) {
              ignored = true;
              break;
            }
          }
        }
        if (!ignored && this.chatDisabled === 0) {
          try {
            this.privateMessageIds[this.privateMessageCount] = messageId;
            this.privateMessageCount = (this.privateMessageCount + 1) % 100;
            const uncompressed = WordPack.unpack(this.in, this.psize - 13);
            const filtered = WordFilter.filter(uncompressed);
            if (staffModLevel === 2 || staffModLevel === 3) {
              this.addChat(7, filtered, "@cr2@" + JString.toScreenName(JString.toRawUsername(from)));
            } else if (staffModLevel === 1) {
              this.addChat(7, filtered, "@cr1@" + JString.toScreenName(JString.toRawUsername(from)));
            } else {
              this.addChat(3, filtered, JString.toScreenName(JString.toRawUsername(from)));
            }
          } catch (_e) {}
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 255 /* FRIENDLIST_LOADED */) {
        this.friendServerStatus = this.in.g1();
        this.redrawSidebar = true;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 111 /* UPDATE_FRIENDLIST */) {
        const username = this.in.g8();
        const world = this.in.g1();
        let displayName = JString.toScreenName(JString.toRawUsername(username));
        for (let i2 = 0;i2 < this.friendCount; i2++) {
          if (username === this.friendUserhash[i2]) {
            if (this.friendNodeId[i2] !== world) {
              this.friendNodeId[i2] = world;
              this.redrawSidebar = true;
              if (world > 0) {
                this.addChat(5, displayName + " has logged in.", "");
              }
              if (world === 0) {
                this.addChat(5, displayName + " has logged out.", "");
              }
            }
            displayName = null;
            break;
          }
        }
        if (displayName && this.friendCount < 200) {
          this.friendUserhash[this.friendCount] = username;
          this.friendUsername[this.friendCount] = displayName;
          this.friendNodeId[this.friendCount] = world;
          this.friendCount++;
          this.redrawSidebar = true;
        }
        let sorted = false;
        while (!sorted) {
          sorted = true;
          for (let i2 = 0;i2 < this.friendCount - 1; i2++) {
            if (this.friendNodeId[i2] !== Client.nodeId && this.friendNodeId[i2 + 1] === Client.nodeId || this.friendNodeId[i2] === 0 && this.friendNodeId[i2 + 1] !== 0) {
              const oldWorld = this.friendNodeId[i2];
              this.friendNodeId[i2] = this.friendNodeId[i2 + 1];
              this.friendNodeId[i2 + 1] = oldWorld;
              const oldName = this.friendUsername[i2];
              this.friendUsername[i2] = this.friendUsername[i2 + 1];
              this.friendUsername[i2 + 1] = oldName;
              const oldUserhash = this.friendUserhash[i2];
              this.friendUserhash[i2] = this.friendUserhash[i2 + 1];
              this.friendUserhash[i2 + 1] = oldUserhash;
              this.redrawSidebar = true;
              sorted = false;
            }
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 108 /* UNSET_MAP_FLAG */) {
        this.minimapFlagX = 0;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 164 /* UPDATE_RUNWEIGHT */) {
        if (this.sideTab === 12) {
          this.redrawSidebar = true;
        }
        this.runweight = this.in.g2b();
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 64 /* HINT_ARROW */) {
        this.hintType = this.in.g1();
        if (this.hintType === 1) {
          this.hintNpc = this.in.g2();
        }
        if (this.hintType >= 2 && this.hintType <= 6) {
          if (this.hintType === 2) {
            this.hintOffsetX = 64;
            this.hintOffsetZ = 64;
          } else if (this.hintType === 3) {
            this.hintOffsetX = 0;
            this.hintOffsetZ = 64;
          } else if (this.hintType === 4) {
            this.hintOffsetX = 128;
            this.hintOffsetZ = 64;
          } else if (this.hintType === 5) {
            this.hintOffsetX = 64;
            this.hintOffsetZ = 0;
          } else if (this.hintType === 6) {
            this.hintOffsetX = 64;
            this.hintOffsetZ = 128;
          }
          this.hintType = 2;
          this.hintTileX = this.in.g2();
          this.hintTileZ = this.in.g2();
          this.hintHeight = this.in.g1();
        }
        if (this.hintType === 10) {
          this.hintPlayer = this.in.g2();
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 143 /* UPDATE_REBOOT_TIMER */) {
        this.rebootTimer = this.in.g2() * 30;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 136 /* UPDATE_STAT */) {
        this.redrawSidebar = true;
        const stat = this.in.g1();
        const xp = this.in.g4();
        const level = this.in.g1();
        this.statXP[stat] = xp;
        this.statEffectiveLevel[stat] = level;
        this.statBaseLevel[stat] = 1;
        for (let i2 = 0;i2 < 98; i2++) {
          if (xp >= Client.levelExperience[i2]) {
            this.statBaseLevel[stat] = i2 + 2;
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 94 /* UPDATE_RUNENERGY */) {
        if (this.sideTab === 12) {
          this.redrawSidebar = true;
        }
        this.runenergy = this.in.g1();
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 203 /* RESET_ANIMS */) {
        for (let i2 = 0;i2 < this.players.length; i2++) {
          const player = this.players[i2];
          if (!player) {
            continue;
          }
          player.primaryAnim = -1;
        }
        for (let i2 = 0;i2 < this.npc.length; i2++) {
          const npc = this.npc[i2];
          if (!npc) {
            continue;
          }
          npc.primaryAnim = -1;
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 213 /* UPDATE_PID */) {
        this.selfSlot = this.in.g2();
        this.membersAccount = this.in.g1();
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 146 /* LAST_LOGIN_INFO */) {
        this.lastAddress = this.in.g4();
        this.daysSinceLastLogin = this.in.g2();
        this.daysSinceRecoveriesChanged = this.in.g1();
        this.unreadMessages = this.in.g2();
        this.warnMembersInNonMembers = this.in.g1();
        if (this.lastAddress !== 0 && this.mainModalId === -1) {
          this.closeModal();
          let contentType = 650;
          if (this.daysSinceRecoveriesChanged !== 201 || this.warnMembersInNonMembers == 1) {
            contentType = 655;
          }
          this.reportAbuseInput = "";
          this.reportAbuseMuteOption = false;
          for (let i2 = 0;i2 < IfType.list.length; i2++) {
            if (IfType.list[i2] && IfType.list[i2].clientCode === contentType) {
              this.mainModalId = IfType.list[i2].layerId;
              break;
            }
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 21 /* LOGOUT */) {
        await this.logout();
        this.ptype = -1;
        return false;
      }
      if (this.ptype === 5 /* P_COUNTDIALOG */) {
        this.socialInputOpen = false;
        this.dialogInputOpen = true;
        this.dialogInput = "";
        this.redrawChatback = true;
        if (this.isMobile) {
          MobileKeyboard_default.show();
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 75 /* SET_MULTIWAY */) {
        this.inMultizone = this.in.g1();
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 204 /* SET_PLAYER_OP */) {
        const index = this.in.g1();
        const priority = this.in.g1();
        let op = this.in.gjstr();
        if (index >= 1 && index <= 5) {
          if (op.toLowerCase() === "null") {
            op = null;
          }
          this.playerOp[index - 1] = op;
          this.playerOpPriority[index - 1] = priority === 0;
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 209 /* REBUILD_NORMAL */) {
        const zoneX = this.in.g2();
        const zoneZ = this.in.g2();
        if (this.mapBuildCenterZoneX === zoneX && this.mapBuildCenterZoneZ === zoneZ && this.sceneState !== 0) {
          this.ptype = -1;
          return true;
        }
        this.mapBuildCenterZoneX = zoneX;
        this.mapBuildCenterZoneZ = zoneZ;
        this.mapBuildBaseX = (this.mapBuildCenterZoneX - 6) * 8;
        this.mapBuildBaseZ = (this.mapBuildCenterZoneZ - 6) * 8;
        this.withinTutorialIsland = false;
        if ((this.mapBuildCenterZoneX / 8 == 48 || this.mapBuildCenterZoneX / 8 == 49) && this.mapBuildCenterZoneZ / 8 == 48) {
          this.withinTutorialIsland = true;
        } else if (this.mapBuildCenterZoneX / 8 == 48 && this.mapBuildCenterZoneZ / 8 == 148) {
          this.withinTutorialIsland = true;
        }
        this.sceneState = 1;
        this.sceneLoadStartTime = performance.now();
        this.areaViewport?.setPixels();
        this.p12?.centreString("Loading - please wait.", 257, 151, 0 /* BLACK */);
        this.p12?.centreString("Loading - please wait.", 256, 150, 16777215 /* WHITE */);
        this.areaViewport?.draw(4, 4);
        let regions = 0;
        for (let x2 = (this.mapBuildCenterZoneX - 6) / 8 | 0;x2 <= ((this.mapBuildCenterZoneX + 6) / 8 | 0); x2++) {
          for (let z = (this.mapBuildCenterZoneZ - 6) / 8 | 0;z <= ((this.mapBuildCenterZoneZ + 6) / 8 | 0); z++) {
            regions++;
          }
        }
        this.mapBuildGroundData = new TypedArray1d(regions, null);
        this.mapBuildLocationData = new TypedArray1d(regions, null);
        this.mapBuildIndex = new Int32Array(regions);
        this.mapBuildGroundFile = new Array(regions);
        this.mapBuildLocationFile = new Array(regions);
        let mapCount = 0;
        for (let x2 = (this.mapBuildCenterZoneX - 6) / 8 | 0;x2 <= ((this.mapBuildCenterZoneX + 6) / 8 | 0); x2++) {
          for (let z = (this.mapBuildCenterZoneZ - 6) / 8 | 0;z <= ((this.mapBuildCenterZoneZ + 6) / 8 | 0); z++) {
            this.mapBuildIndex[mapCount] = (x2 << 8) + z;
            if (this.withinTutorialIsland && (z == 49 || z == 149 || z == 147 || x2 == 50 || x2 == 49 && z == 47)) {
              this.mapBuildGroundFile[mapCount] = -1;
              this.mapBuildLocationFile[mapCount] = -1;
              mapCount++;
            } else if (this.onDemand) {
              const landFile = this.mapBuildGroundFile[mapCount] = this.onDemand.getMapFile(x2, z, 0);
              if (landFile != -1) {
                this.onDemand.request(3, landFile);
              }
              const locFile = this.mapBuildLocationFile[mapCount] = this.onDemand.getMapFile(x2, z, 1);
              if (locFile != -1) {
                this.onDemand.request(3, locFile);
              }
              mapCount++;
            }
          }
        }
        const dx = this.mapBuildBaseX - this.mapBuildPrevBaseX;
        const dz = this.mapBuildBaseZ - this.mapBuildPrevBaseZ;
        this.mapBuildPrevBaseX = this.mapBuildBaseX;
        this.mapBuildPrevBaseZ = this.mapBuildBaseZ;
        for (let i2 = 0;i2 < 16384; i2++) {
          const npc = this.npc[i2];
          if (npc) {
            for (let j = 0;j < 10; j++) {
              npc.routeX[j] -= dx;
              npc.routeZ[j] -= dz;
            }
            npc.x -= dx * 128;
            npc.z -= dz * 128;
          }
        }
        for (let i2 = 0;i2 < MAX_PLAYER_COUNT; i2++) {
          const player = this.players[i2];
          if (player) {
            for (let j = 0;j < 10; j++) {
              player.routeX[j] -= dx;
              player.routeZ[j] -= dz;
            }
            player.x -= dx * 128;
            player.z -= dz * 128;
          }
        }
        this.awaitingPlayerInfo = true;
        let startTileX = 0;
        let endTileX = 104 /* SIZE */;
        let dirX = 1;
        if (dx < 0) {
          startTileX = 104 /* SIZE */ - 1;
          endTileX = -1;
          dirX = -1;
        }
        let startTileZ = 0;
        let endTileZ = 104 /* SIZE */;
        let dirZ = 1;
        if (dz < 0) {
          startTileZ = 104 /* SIZE */ - 1;
          endTileZ = -1;
          dirZ = -1;
        }
        for (let x2 = startTileX;x2 !== endTileX; x2 += dirX) {
          for (let z = startTileZ;z !== endTileZ; z += dirZ) {
            const lastX = x2 + dx;
            const lastZ = z + dz;
            for (let level = 0;level < 4 /* LEVELS */; level++) {
              if (lastX >= 0 && lastZ >= 0 && lastX < 104 /* SIZE */ && lastZ < 104 /* SIZE */) {
                this.groundObj[level][x2][z] = this.groundObj[level][lastX][lastZ];
              } else {
                this.groundObj[level][x2][z] = null;
              }
            }
          }
        }
        for (let loc = this.locChanges.head();loc !== null; loc = this.locChanges.next()) {
          loc.x -= dx;
          loc.z -= dz;
          if (loc.x < 0 || loc.z < 0 || loc.x >= 104 /* SIZE */ || loc.z >= 104 /* SIZE */) {
            loc.unlink();
          }
        }
        if (this.minimapFlagX !== 0) {
          this.minimapFlagX -= dx;
          this.minimapFlagZ -= dz;
        }
        this.cinemaCam = false;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 186 /* VARP_SMALL */) {
        const variable = this.in.g2();
        const value = this.in.g1b();
        this.varServ[variable] = value;
        if (this.var[variable] !== value) {
          this.var[variable] = value;
          this.clientVar(variable);
          this.redrawSidebar = true;
          if (this.tutComId !== -1) {
            this.redrawChatback = true;
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 196 /* VARP_LARGE */) {
        const variable = this.in.g2();
        const value = this.in.g4();
        this.varServ[variable] = value;
        if (this.var[variable] !== value) {
          this.var[variable] = value;
          this.clientVar(variable);
          this.redrawSidebar = true;
          if (this.tutComId !== -1) {
            this.redrawChatback = true;
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 140 /* VARP_SYNC */) {
        for (let i2 = 0;i2 < this.var.length; i2++) {
          if (this.var[i2] !== this.varServ[i2]) {
            this.var[i2] = this.varServ[i2];
            this.clientVar(i2);
            this.redrawSidebar = true;
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 25 /* SYNTH_SOUND */) {
        const id = this.in.g2();
        const loop = this.in.g1();
        const delay = this.in.g2();
        if (this.waveEnabled && !Client.lowMem && this.waveCount < 50) {
          this.waveIds[this.waveCount] = id;
          this.waveLoops[this.waveCount] = loop;
          this.waveDelay[this.waveCount] = delay + JagFX.delays[id];
          this.waveCount++;
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 163 /* MIDI_SONG */) {
        let id = this.in.g2();
        if (id == 65535) {
          id = -1;
        }
        if (this.nextMidiSong != id && this.midiActive && !Client.lowMem) {
          this.midiSong = id;
          this.midiFading = true;
          this.onDemand?.request(2, this.midiSong);
        }
        this.nextMidiSong = id;
        this.nextMusicDelay = 0;
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 242 /* MIDI_JINGLE */) {
        const id = this.in.g2();
        const delay = this.in.g2();
        if (this.midiActive && !Client.lowMem) {
          this.midiSong = id;
          this.midiFading = false;
          this.onDemand?.request(2, this.midiSong);
          this.nextMusicDelay = delay;
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 173 /* UPDATE_ZONE_PARTIAL_FOLLOWS */) {
        this.zoneUpdateX = this.in.g1();
        this.zoneUpdateZ = this.in.g1();
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 159 /* UPDATE_ZONE_FULL_FOLLOWS */) {
        this.zoneUpdateX = this.in.g1();
        this.zoneUpdateZ = this.in.g1();
        for (let x2 = this.zoneUpdateX;x2 < this.zoneUpdateX + 8; x2++) {
          for (let z = this.zoneUpdateZ;z < this.zoneUpdateZ + 8; z++) {
            if (this.groundObj[this.minusedlevel][x2][z]) {
              this.groundObj[this.minusedlevel][x2][z] = null;
              this.showObject(x2, z);
            }
          }
        }
        for (let loc = this.locChanges.head();loc !== null; loc = this.locChanges.next()) {
          if (loc.x >= this.zoneUpdateX && loc.x < this.zoneUpdateX + 8 && loc.z >= this.zoneUpdateZ && loc.z < this.zoneUpdateZ + 8 && loc.level === this.minusedlevel) {
            loc.endTime = 0;
          }
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 61 /* UPDATE_ZONE_PARTIAL_ENCLOSED */) {
        this.zoneUpdateX = this.in.g1();
        this.zoneUpdateZ = this.in.g1();
        while (this.in.pos < this.psize) {
          const opcode = this.in.g1();
          this.zonePacket(this.in, opcode);
        }
        this.ptype = -1;
        return true;
      }
      if (this.ptype === 98 /* OBJ_COUNT */ || this.ptype === 218 /* P_LOCMERGE */ || this.ptype === 8 /* OBJ_REVEAL */ || this.ptype === 114 /* MAP_ANIM */ || this.ptype === 37 /* MAP_PROJANIM */ || this.ptype === 115 /* OBJ_DEL */ || this.ptype === 120 /* OBJ_ADD */ || this.ptype === 30 /* LOC_ANIM */ || this.ptype === 88 /* LOC_DEL */ || this.ptype === 70 /* LOC_ADD_CHANGE */) {
        this.zonePacket(this.in, this.ptype);
        this.ptype = -1;
        return true;
      }
      console.error(`T1 - ${this.ptype},${this.psize} - ${this.ptype1},${this.ptype2}`);
      await this.logout();
    } catch (e) {
      if ((e instanceof WebSocket || e instanceof WorkerWebSocket) && e.readyState === 3) {
        await this.lostCon();
      } else {
        console.error(e);
        let str = `T2 - ${this.ptype},${this.psize} - ${this.ptype1},${this.ptype2} - ${this.psize},${(this.localPlayer?.routeX[0] ?? 0) + this.mapBuildBaseX},${(this.localPlayer?.routeZ[0] ?? 0) + this.mapBuildBaseZ} -`;
        for (let i2 = 0;i2 < this.psize && i2 < 50; i2++) {
          str += this.in.data[i2] + ",";
        }
        console.error(str);
        await this.logout();
      }
    }
    return true;
  }
  zonePacket(buf, opcode) {
    const pos = buf.g1();
    let x2 = this.zoneUpdateX + (pos >> 4 & 7);
    let z = this.zoneUpdateZ + (pos & 7);
    if (opcode === 70 /* LOC_ADD_CHANGE */) {
      const info = buf.g1();
      const id = buf.g2();
      const shape = info >> 2;
      const rotate = info & 3;
      const layer = LOC_SHAPE_TO_LAYER[shape];
      if (x2 >= 0 && z >= 0 && x2 < 104 /* SIZE */ && z < 104 /* SIZE */) {
        this.locChangeCreate(this.minusedlevel, x2, z, layer, id, shape, rotate, 0, -1);
      }
    } else if (opcode === 88 /* LOC_DEL */) {
      const info = buf.g1();
      const shape = info >> 2;
      const rotate = info & 3;
      const layer = LOC_SHAPE_TO_LAYER[shape];
      if (x2 >= 0 && z >= 0 && x2 < 104 /* SIZE */ && z < 104 /* SIZE */) {
        this.locChangeCreate(this.minusedlevel, x2, z, layer, -1, shape, rotate, 0, -1);
      }
    } else if (opcode === 30 /* LOC_ANIM */) {
      const info = buf.g1();
      const seq = buf.g2();
      let shape = info >> 2;
      const rotate = info & 3;
      const layer = LOC_SHAPE_TO_LAYER[shape];
      if (x2 >= 0 && z >= 0 && x2 < 104 /* SIZE */ && z < 104 /* SIZE */ && this.world && this.groundh) {
        const heightSW = this.groundh[this.minusedlevel][x2][z];
        const heightSE = this.groundh[this.minusedlevel][x2 + 1][z];
        const heightNE = this.groundh[this.minusedlevel][x2 + 1][z + 1];
        const heightNW = this.groundh[this.minusedlevel][x2][z + 1];
        if (layer == 0) {
          const wall = this.world.getWall(this.minusedlevel, x2, z);
          if (wall) {
            const locId = wall.typecode >> 14 & 32767;
            if (shape == 2) {
              wall.model1 = new ClientLocAnim(this.loopCycle, locId, 2, rotate + 4, heightSW, heightSE, heightNE, heightNW, seq, false);
              wall.model2 = new ClientLocAnim(this.loopCycle, locId, 2, rotate + 1 & 3, heightSW, heightSE, heightNE, heightNW, seq, false);
            } else {
              wall.model1 = new ClientLocAnim(this.loopCycle, locId, shape, rotate, heightSW, heightSE, heightNE, heightNW, seq, false);
            }
          }
        } else if (layer == 1) {
          const decor = this.world.getDecor(this.minusedlevel, z, x2);
          if (decor) {
            decor.model = new ClientLocAnim(this.loopCycle, decor.typecode >> 14 & 32767, 4, 0, heightSW, heightNE, heightNE, heightNW, seq, false);
          }
        } else if (layer == 2) {
          const sprite = this.world.getScene(this.minusedlevel, x2, z);
          if (shape == 11) {
            shape = 10;
          }
          if (sprite) {
            sprite.model = new ClientLocAnim(this.loopCycle, sprite.typecode >> 14 & 32767, shape, rotate, heightSW, heightSE, heightNE, heightNW, seq, false);
          }
        } else if (layer == 3) {
          const decor = this.world.getGd(this.minusedlevel, x2, z);
          if (decor) {
            decor.model = new ClientLocAnim(this.loopCycle, decor.typecode >> 14 & 32767, 22, rotate, heightSW, heightSE, heightNE, heightNW, seq, false);
          }
        }
      }
    } else if (opcode === 120 /* OBJ_ADD */) {
      const type = buf.g2();
      const count = buf.g2();
      if (x2 >= 0 && z >= 0 && x2 < 104 /* SIZE */ && z < 104 /* SIZE */) {
        const obj = new ClientObj(type, count);
        if (!this.groundObj[this.minusedlevel][x2][z]) {
          this.groundObj[this.minusedlevel][x2][z] = new LinkList;
        }
        this.groundObj[this.minusedlevel][x2][z]?.push(obj);
        this.showObject(x2, z);
      }
    } else if (opcode === 115 /* OBJ_DEL */) {
      const type = buf.g2();
      if (x2 >= 0 && z >= 0 && x2 < 104 /* SIZE */ && z < 104 /* SIZE */) {
        const objs = this.groundObj[this.minusedlevel][x2][z];
        if (objs) {
          for (let obj = objs.head();obj !== null; obj = objs.next()) {
            if (obj.id === (type & 32767)) {
              obj.unlink();
              break;
            }
          }
          if (objs.head() === null) {
            this.groundObj[this.minusedlevel][x2][z] = null;
          }
          this.showObject(x2, z);
        }
      }
    } else if (opcode === 37 /* MAP_PROJANIM */) {
      let x22 = x2 + buf.g1b();
      let z2 = z + buf.g1b();
      const targetEntity = buf.g2b();
      const spotanim = buf.g2();
      const h1 = buf.g1() * 4;
      const h2 = buf.g1() * 4;
      const t1 = buf.g2();
      const t2 = buf.g2();
      const angle = buf.g1();
      const startpos = buf.g1();
      if (x2 >= 0 && z >= 0 && x2 < 104 /* SIZE */ && z < 104 /* SIZE */ && x22 >= 0 && z2 >= 0 && x22 < 104 /* SIZE */ && z2 < 104 /* SIZE */) {
        x2 = x2 * 128 + 64;
        z = z * 128 + 64;
        x22 = x22 * 128 + 64;
        z2 = z2 * 128 + 64;
        const proj = new ClientProj(spotanim, this.minusedlevel, x2, this.getAvH(x2, z, this.minusedlevel) - h1, z, t1 + this.loopCycle, t2 + this.loopCycle, angle, startpos, targetEntity, h2);
        proj.setTarget(x22, this.getAvH(x22, z2, this.minusedlevel) - h2, z2, t1 + this.loopCycle);
        this.projectiles.push(proj);
      }
    } else if (opcode === 114 /* MAP_ANIM */) {
      const spotanim = buf.g2();
      const height = buf.g1();
      const time = buf.g2();
      if (x2 >= 0 && z >= 0 && x2 < 104 /* SIZE */ && z < 104 /* SIZE */) {
        x2 = x2 * 128 + 64;
        z = z * 128 + 64;
        const spot = new MapSpotAnim(spotanim, this.minusedlevel, x2, z, this.getAvH(x2, z, this.minusedlevel) - height, this.loopCycle, time);
        this.spotanims.push(spot);
      }
    } else if (opcode === 8 /* OBJ_REVEAL */) {
      const id = buf.g2();
      const count = buf.g2();
      const pid = buf.g2();
      if (x2 >= 0 && z >= 0 && x2 < 104 /* SIZE */ && z < 104 /* SIZE */ && pid !== this.selfSlot) {
        if (!this.groundObj[this.minusedlevel][x2][z]) {
          this.groundObj[this.minusedlevel][x2][z] = new LinkList;
        }
        const obj = new ClientObj(id, count);
        this.groundObj[this.minusedlevel][x2][z]?.push(obj);
        this.showObject(x2, z);
      }
    } else if (opcode === 218 /* P_LOCMERGE */) {
      const info = buf.g1();
      const shape = info >> 2;
      const rotate = info & 3;
      const layer = LOC_SHAPE_TO_LAYER[shape];
      const id = buf.g2();
      const t1 = buf.g2();
      const t2 = buf.g2();
      const pid = buf.g2();
      let east = buf.g1b();
      let south = buf.g1b();
      let west = buf.g1b();
      let north = buf.g1b();
      let player;
      if (pid === this.selfSlot) {
        player = this.localPlayer;
      } else {
        player = this.players[pid];
      }
      if (player && this.groundh) {
        const loc = LocType.list(id);
        const heightSW = this.groundh[this.minusedlevel][x2][z];
        const heightSE = this.groundh[this.minusedlevel][x2 + 1][z];
        const heightNE = this.groundh[this.minusedlevel][x2 + 1][z + 1];
        const heightNW = this.groundh[this.minusedlevel][x2][z + 1];
        const model = loc.getModel(shape, rotate, heightSW, heightSE, heightNE, heightNW, -1);
        if (model) {
          this.locChangeCreate(this.minusedlevel, x2, z, layer, -1, 0, 0, t1 + 1, t2 + 1);
          player.locStartCycle = t1 + this.loopCycle;
          player.locStopCycle = t2 + this.loopCycle;
          player.locModel = model;
          let width = loc.width;
          let height = loc.length;
          if (rotate === 1 /* NORTH */ || rotate === 3 /* SOUTH */) {
            width = loc.length;
            height = loc.width;
          }
          player.locOffsetX = x2 * 128 + width * 64;
          player.locOffsetZ = z * 128 + height * 64;
          player.locOffsetY = this.getAvH(player.locOffsetX, player.locOffsetZ, this.minusedlevel);
          let tmp;
          if (east > west) {
            tmp = east;
            east = west;
            west = tmp;
          }
          if (south > north) {
            tmp = south;
            south = north;
            north = tmp;
          }
          player.minTileX = x2 + east;
          player.maxTileX = x2 + west;
          player.minTileZ = z + south;
          player.maxTileZ = z + north;
        }
      }
    } else if (opcode === 98 /* OBJ_COUNT */) {
      const type = buf.g2();
      const ocount = buf.g2();
      const count = buf.g2();
      if (x2 >= 0 && z >= 0 && x2 < 104 /* SIZE */ && z < 104 /* SIZE */) {
        const objs = this.groundObj[this.minusedlevel][x2][z];
        if (objs) {
          for (let obj = objs.head();obj !== null; obj = objs.next()) {
            if (obj.id === (type & 32767) && obj.count === ocount) {
              obj.count = count;
              break;
            }
          }
          this.showObject(x2, z);
        }
      }
    }
  }
  locChangeCreate(level, x2, z, layer, type, shape, angle, startTime, endTime) {
    let loc = null;
    for (let next2 = this.locChanges.head();next2 !== null; next2 = this.locChanges.next()) {
      if (next2.level === this.minusedlevel && next2.x === x2 && next2.z === z && next2.layer === layer) {
        loc = next2;
        break;
      }
    }
    if (!loc) {
      loc = new LocChange;
      loc.level = level;
      loc.layer = layer;
      loc.x = x2;
      loc.z = z;
      this.locChangeSetOld(loc);
      this.locChanges.push(loc);
    }
    loc.newType = type;
    loc.newShape = shape;
    loc.newAngle = angle;
    loc.startTime = startTime;
    loc.endTime = endTime;
  }
  locChangePostBuildCorrect() {
    for (let loc = this.locChanges.head();loc !== null; loc = this.locChanges.next()) {
      if (loc.endTime === -1) {
        loc.startTime = 0;
        this.locChangeSetOld(loc);
      } else {
        loc.unlink();
      }
    }
  }
  locChangeSetOld(loc) {
    if (!this.world) {
      return;
    }
    let typecode = 0;
    let otherId = -1;
    let otherShape = 0;
    let otherAngle = 0;
    if (loc.layer === 0 /* WALL */) {
      typecode = this.world.wallType(loc.level, loc.x, loc.z);
    } else if (loc.layer === 1 /* WALL_DECOR */) {
      typecode = this.world.decorType(loc.level, loc.z, loc.x);
    } else if (loc.layer === 2 /* GROUND */) {
      typecode = this.world.sceneType(loc.level, loc.x, loc.z);
    } else if (loc.layer === 3 /* GROUND_DECOR */) {
      typecode = this.world.gdType(loc.level, loc.x, loc.z);
    }
    if (typecode !== 0) {
      const otherInfo = this.world.typeCode2(loc.level, loc.x, loc.z, typecode);
      otherId = typecode >> 14 & 32767;
      otherShape = otherInfo & 31;
      otherAngle = otherInfo >> 6;
    }
    loc.oldType = otherId;
    loc.oldShape = otherShape;
    loc.oldAngle = otherAngle;
  }
  locChangeDoQueue() {
    if (this.sceneState !== 2) {
      return;
    }
    for (let loc = this.locChanges.head();loc !== null; loc = this.locChanges.next()) {
      if (loc.endTime > 0) {
        loc.endTime--;
      }
      if (loc.endTime != 0) {
        if (loc.startTime > 0) {
          loc.startTime--;
        }
        if (loc.startTime === 0 && loc.x >= 1 && loc.z >= 1 && loc.x <= 102 && loc.z <= 102 && (loc.newType < 0 || ClientBuild.changeLocAvailable(loc.newType, loc.newShape))) {
          this.locChangeUnchecked(loc.level, loc.layer, loc.x, loc.z, loc.newType, loc.newShape, loc.newAngle);
          loc.startTime = -1;
          if (loc.oldType === loc.newType && loc.oldType === -1) {
            loc.unlink();
          } else if (loc.oldType === loc.newType && loc.oldAngle === loc.newAngle && loc.oldShape === loc.newShape) {
            loc.unlink();
          }
        }
      } else if (loc.oldType < 0 || ClientBuild.changeLocAvailable(loc.oldType, loc.oldShape)) {
        this.locChangeUnchecked(loc.level, loc.layer, loc.x, loc.z, loc.oldType, loc.oldShape, loc.oldAngle);
        loc.unlink();
      }
    }
  }
  locChangeUnchecked(level, layer, x2, z, id, shape, angle) {
    if (x2 < 1 || z < 1 || x2 > 102 || z > 102) {
      return;
    }
    if (Client.lowMem && level !== this.minusedlevel) {
      return;
    }
    if (!this.world) {
      return;
    }
    let typecode = 0;
    if (layer === 0 /* WALL */) {
      typecode = this.world.wallType(level, x2, z);
    } else if (layer === 1 /* WALL_DECOR */) {
      typecode = this.world.decorType(level, z, x2);
    } else if (layer === 2 /* GROUND */) {
      typecode = this.world.sceneType(level, x2, z);
    } else if (layer === 3 /* GROUND_DECOR */) {
      typecode = this.world.gdType(level, x2, z);
    }
    if (typecode !== 0) {
      const otherInfo = this.world.typeCode2(level, x2, z, typecode);
      const otherId = typecode >> 14 & 32767;
      const otherShape = otherInfo & 31;
      const otherAngle = otherInfo >> 6;
      if (layer === 0 /* WALL */) {
        this.world?.delWall(level, x2, z);
        const type = LocType.list(otherId);
        if (type.blockwalk) {
          this.collision[level]?.delWall(x2, z, otherShape, otherAngle, type.blockrange);
        }
      } else if (layer === 1 /* WALL_DECOR */) {
        this.world?.delDecor(level, x2, z);
      } else if (layer === 2 /* GROUND */) {
        this.world.delLoc(level, x2, z);
        const type = LocType.list(otherId);
        if (x2 + type.width > 104 /* SIZE */ - 1 || z + type.width > 104 /* SIZE */ - 1 || x2 + type.length > 104 /* SIZE */ - 1 || z + type.length > 104 /* SIZE */ - 1) {
          return;
        }
        if (type.blockwalk) {
          this.collision[level]?.delLoc(x2, z, type.width, type.length, otherAngle, type.blockrange);
        }
      } else if (layer === 3 /* GROUND_DECOR */) {
        this.world?.delGroundDecor(level, x2, z);
        const type = LocType.list(otherId);
        if (type.blockwalk && type.active) {
          this.collision[level]?.unblockGround(x2, z);
        }
      }
    }
    if (id >= 0) {
      let tileLevel = level;
      if (this.mapl && level < 3 && (this.mapl[1][x2][z] & 2 /* LinkBelow */) !== 0) {
        tileLevel = level + 1;
      }
      if (this.groundh) {
        ClientBuild.changeLocUnchecked(level, x2, z, id, shape, angle, this.loopCycle, tileLevel, this.groundh, this.world, this.collision[level]);
      }
    }
  }
  showObject(x2, z) {
    const objs = this.groundObj[this.minusedlevel][x2][z];
    if (!objs) {
      this.world?.delObj(this.minusedlevel, x2, z);
      return;
    }
    let topCost = -99999999;
    let topObj = null;
    for (let obj = objs.head();obj !== null; obj = objs.next()) {
      const type = ObjType.list(obj.id);
      let cost = type.cost;
      if (type.stackable) {
        cost *= obj.count + 1;
      }
      if (cost > topCost) {
        topCost = cost;
        topObj = obj;
      }
    }
    if (!topObj) {
      return;
    }
    objs.pushFront(topObj);
    let bottomObj = null;
    let middleObj = null;
    for (let obj = objs.head();obj !== null; obj = objs.next()) {
      if (obj.id !== topObj.id && bottomObj === null) {
        bottomObj = obj;
      }
      if (obj.id !== topObj.id && bottomObj && obj.id !== bottomObj.id && middleObj === null) {
        middleObj = obj;
      }
    }
    const typecode = x2 + (z << 7) + 1610612736 | 0;
    this.world?.setObj(x2, z, this.getAvH(x2 * 128 + 64, z * 128 + 64, this.minusedlevel), this.minusedlevel, typecode, topObj, middleObj, bottomObj);
  }
  getPlayerPos(buf, size) {
    this.entityRemovalCount = 0;
    this.entityUpdateCount = 0;
    this.getPlayerLocal(buf);
    this.getPlayerOldVis(buf);
    this.getPlayerNewVis(buf, size);
    this.getPlayerExtended(buf);
    for (let i2 = 0;i2 < this.entityRemovalCount; i2++) {
      const index = this.entityRemovalIds[i2];
      const player = this.players[index];
      if (!player) {
        continue;
      }
      if (player.cycle !== this.loopCycle) {
        this.players[index] = null;
      }
    }
    if (buf.pos !== size) {
      console.error(`eek! Error packet size mismatch in getplayer pos:${buf.pos} psize:${size}`);
      throw new Error("eek");
    }
    for (let index = 0;index < this.playerCount; index++) {
      if (!this.players[this.playerIds[index]]) {
        console.error(`eek! ${this.loginUser} null entry in pl list - pos:${index} size:${this.playerCount}`);
        throw new Error("eek");
      }
    }
  }
  getPlayerLocal(buf) {
    buf.bits();
    const info = buf.gBit(1);
    if (info !== 0) {
      const op = buf.gBit(2);
      if (op === 0) {
        this.entityUpdateIds[this.entityUpdateCount++] = LOCAL_PLAYER_INDEX;
      } else if (op === 1) {
        const walkDir = buf.gBit(3);
        this.localPlayer?.moveCode(false, walkDir);
        const extendedInfo = buf.gBit(1);
        if (extendedInfo === 1) {
          this.entityUpdateIds[this.entityUpdateCount++] = LOCAL_PLAYER_INDEX;
        }
      } else if (op === 2) {
        const walkDir = buf.gBit(3);
        this.localPlayer?.moveCode(true, walkDir);
        const runDir = buf.gBit(3);
        this.localPlayer?.moveCode(true, runDir);
        const extendedInfo = buf.gBit(1);
        if (extendedInfo === 1) {
          this.entityUpdateIds[this.entityUpdateCount++] = LOCAL_PLAYER_INDEX;
        }
      } else if (op === 3) {
        this.minusedlevel = buf.gBit(2);
        const localX = buf.gBit(7);
        const localZ = buf.gBit(7);
        const jump = buf.gBit(1);
        this.localPlayer?.teleport(jump === 1, localX, localZ);
        const extendedInfo = buf.gBit(1);
        if (extendedInfo === 1) {
          this.entityUpdateIds[this.entityUpdateCount++] = LOCAL_PLAYER_INDEX;
        }
      }
    }
  }
  getPlayerOldVis(buf) {
    const count = buf.gBit(8);
    if (count < this.playerCount) {
      for (let i2 = count;i2 < this.playerCount; i2++) {
        this.entityRemovalIds[this.entityRemovalCount++] = this.playerIds[i2];
      }
    }
    if (count > this.playerCount) {
      console.error(`eek! ${this.loginUser} Too many players`);
      throw new Error;
    }
    this.playerCount = 0;
    for (let i2 = 0;i2 < count; i2++) {
      const index = this.playerIds[i2];
      const player = this.players[index];
      const info = buf.gBit(1);
      if (info === 0) {
        this.playerIds[this.playerCount++] = index;
        if (player) {
          player.cycle = this.loopCycle;
        }
      } else {
        const op = buf.gBit(2);
        if (op === 0) {
          this.playerIds[this.playerCount++] = index;
          if (player) {
            player.cycle = this.loopCycle;
          }
          this.entityUpdateIds[this.entityUpdateCount++] = index;
        } else if (op === 1) {
          this.playerIds[this.playerCount++] = index;
          if (player) {
            player.cycle = this.loopCycle;
          }
          const walkDir = buf.gBit(3);
          player?.moveCode(false, walkDir);
          const extendedInfo = buf.gBit(1);
          if (extendedInfo === 1) {
            this.entityUpdateIds[this.entityUpdateCount++] = index;
          }
        } else if (op === 2) {
          this.playerIds[this.playerCount++] = index;
          if (player) {
            player.cycle = this.loopCycle;
          }
          const walkDir = buf.gBit(3);
          player?.moveCode(true, walkDir);
          const runDir = buf.gBit(3);
          player?.moveCode(true, runDir);
          const extendedInfo = buf.gBit(1);
          if (extendedInfo === 1) {
            this.entityUpdateIds[this.entityUpdateCount++] = index;
          }
        } else if (op === 3) {
          this.entityRemovalIds[this.entityRemovalCount++] = index;
        }
      }
    }
  }
  getPlayerNewVis(buf, size) {
    while (buf.bitPos + 10 < size * 8) {
      const index = buf.gBit(11);
      if (index === 2047) {
        break;
      }
      if (!this.players[index]) {
        this.players[index] = new ClientPlayer;
        const appearance = this.playerAppearanceBuffer[index];
        if (appearance) {
          this.players[index]?.setAppearance(appearance);
        }
      }
      this.playerIds[this.playerCount++] = index;
      const player = this.players[index];
      if (player) {
        player.cycle = this.loopCycle;
      }
      let dx = buf.gBit(5);
      if (dx > 15) {
        dx -= 32;
      }
      let dz = buf.gBit(5);
      if (dz > 15) {
        dz -= 32;
      }
      const jump = buf.gBit(1);
      if (this.localPlayer) {
        player?.teleport(jump === 1, this.localPlayer.routeX[0] + dx, this.localPlayer.routeZ[0] + dz);
      }
      const extendedInfo = buf.gBit(1);
      if (extendedInfo === 1) {
        this.entityUpdateIds[this.entityUpdateCount++] = index;
      }
    }
    buf.bytes();
  }
  getPlayerExtended(buf) {
    for (let i2 = 0;i2 < this.entityUpdateCount; i2++) {
      const index = this.entityUpdateIds[i2];
      const player = this.players[index];
      if (!player) {
        continue;
      }
      let mask = buf.g1();
      if ((mask & 128 /* BIG_UPDATE */) !== 0) {
        mask += buf.g1() << 8;
      }
      this.getPlayerExtendedDecode(player, index, mask, buf);
    }
  }
  getPlayerExtendedDecode(player, index, mask, buf) {
    if ((mask & 1 /* APPEARANCE */) !== 0) {
      const length = buf.g1();
      const data = new Uint8Array(length);
      const appearance = new Packet(data);
      buf.gdata(length, 0, data);
      this.playerAppearanceBuffer[index] = appearance;
      player.setAppearance(appearance);
    }
    if ((mask & 2 /* ANIM */) !== 0) {
      let seqId = buf.g2();
      if (seqId === 65535) {
        seqId = -1;
      }
      if (seqId === player.primaryAnim) {
        player.primaryAnimLoop = 0;
      }
      const delay = buf.g1();
      if (player.primaryAnim === seqId && seqId !== -1) {
        const restartMode = SeqType.list[seqId].duplicatebehaviour;
        if (restartMode == 1 /* RESET */) {
          player.primaryAnimFrame = 0;
          player.primaryAnimCycle = 0;
          player.primaryAnimDelay = delay;
          player.primaryAnimLoop = 0;
        } else if (restartMode == 2 /* RESETLOOP */) {
          player.primaryAnimLoop = 0;
        }
      } else if (seqId === -1 || player.primaryAnim === -1 || SeqType.list[seqId].priority >= SeqType.list[player.primaryAnim].priority) {
        player.primaryAnim = seqId;
        player.primaryAnimFrame = 0;
        player.primaryAnimCycle = 0;
        player.primaryAnimDelay = delay;
        player.primaryAnimLoop = 0;
        player.preanimRouteLength = player.routeLength;
      }
    }
    if ((mask & 4 /* FACEENTITY */) !== 0) {
      player.faceEntity = buf.g2();
      if (player.faceEntity === 65535) {
        player.faceEntity = -1;
      }
    }
    if ((mask & 8 /* SAY */) !== 0) {
      player.chatMessage = buf.gjstr();
      player.chatColour = 0;
      player.chatEffect = 0;
      player.chatTimer = 150;
      if (player.name) {
        this.addChat(2, player.chatMessage, player.name);
      }
    }
    if ((mask & 16 /* HITMARK */) !== 0) {
      const damage = buf.g1();
      const damageType = buf.g1();
      player.addHitmark(this.loopCycle, damageType, damage);
      player.combatCycle = this.loopCycle + 400;
      player.health = buf.g1();
      player.totalHealth = buf.g1();
    }
    if ((mask & 32 /* FACESQUARE */) !== 0) {
      player.faceSquareX = buf.g2();
      player.faceSquareZ = buf.g2();
    }
    if ((mask & 64 /* CHAT */) !== 0) {
      const colourEffect = buf.g2();
      const type = buf.g1();
      const length = buf.g1();
      const start = buf.pos;
      if (player.name && player.ready) {
        const username = JString.toUserhash(player.name);
        let ignored = false;
        if (type <= 1) {
          for (let i2 = 0;i2 < this.ignoreCount; i2++) {
            if (this.ignoreUserhash[i2] === username) {
              ignored = true;
              break;
            }
          }
        }
        if (!ignored && this.chatDisabled === 0) {
          try {
            const uncompressed = WordPack.unpack(buf, length);
            const filtered = WordFilter.filter(uncompressed);
            player.chatMessage = filtered;
            player.chatColour = colourEffect >> 8;
            player.chatEffect = colourEffect & 255;
            player.chatTimer = 150;
            if (type === 2 || type === 3) {
              this.addChat(1, filtered, "@cr2@" + player.name);
            } else if (type === 1) {
              this.addChat(1, filtered, "@cr1@" + player.name);
            } else {
              this.addChat(2, filtered, player.name);
            }
          } catch (_e) {}
        }
      }
      buf.pos = start + length;
    }
    if ((mask & 256 /* SPOTANIM */) !== 0) {
      player.spotanimId = buf.g2();
      const heightDelay = buf.g4();
      player.spotanimHeight = heightDelay >> 16;
      player.spotanimLastCycle = this.loopCycle + (heightDelay & 65535);
      player.spotanimFrame = 0;
      player.spotanimCycle = 0;
      if (player.spotanimLastCycle > this.loopCycle) {
        player.spotanimFrame = -1;
      }
      if (player.spotanimId === 65535) {
        player.spotanimId = -1;
      }
    }
    if ((mask & 512 /* EXACTMOVE */) !== 0) {
      player.exactStartX = buf.g1();
      player.exactStartZ = buf.g1();
      player.exactEndX = buf.g1();
      player.exactEndZ = buf.g1();
      player.exactMoveEnd = buf.g2() + this.loopCycle;
      player.exactMoveStart = buf.g2() + this.loopCycle;
      player.exactMoveFacing = buf.g1();
      player.abortRoute();
    }
    if ((mask & 1024 /* HITMARK2 */) !== 0) {
      const damage = buf.g1();
      const damageType = buf.g1();
      player.addHitmark(this.loopCycle, damageType, damage);
      player.combatCycle = this.loopCycle + 400;
      player.health = buf.g1();
      player.totalHealth = buf.g1();
    }
  }
  getNpcPos(buf, size) {
    this.entityRemovalCount = 0;
    this.entityUpdateCount = 0;
    this.getNpcPosOldVis(buf);
    this.getNpcPosNewVis(buf, size);
    this.getNpcPosExtended(buf);
    for (let i2 = 0;i2 < this.entityRemovalCount; i2++) {
      const index = this.entityRemovalIds[i2];
      const npc = this.npc[index];
      if (!npc) {
        continue;
      }
      if (npc.cycle !== this.loopCycle) {
        npc.type = null;
        this.npc[index] = null;
      }
    }
    if (buf.pos !== size) {
      console.error(`eek! ${this.loginUser} size mismatch in getnpcpos - pos:${buf.pos} psize:${size}`);
      throw new Error("eek");
    }
    for (let i2 = 0;i2 < this.npcCount; i2++) {
      if (!this.npc[this.npcIds[i2]]) {
        console.error(`eek! ${this.loginUser} null entry in npc list - pos:${i2} size:${this.npcCount}`);
        throw new Error("eek");
      }
    }
  }
  getNpcPosOldVis(buf) {
    buf.bits();
    const count = buf.gBit(8);
    if (count < this.npcCount) {
      for (let i2 = count;i2 < this.npcCount; i2++) {
        this.entityRemovalIds[this.entityRemovalCount++] = this.npcIds[i2];
      }
    }
    if (count > this.npcCount) {
      console.error(`eek! ${this.loginUser} Too many npcs`);
      throw new Error("eek");
    }
    this.npcCount = 0;
    for (let i2 = 0;i2 < count; i2++) {
      const index = this.npcIds[i2];
      const npc = this.npc[index];
      const info = buf.gBit(1);
      if (info === 0) {
        this.npcIds[this.npcCount++] = index;
        if (npc) {
          npc.cycle = this.loopCycle;
        }
      } else {
        const op = buf.gBit(2);
        if (op === 0) {
          this.npcIds[this.npcCount++] = index;
          if (npc) {
            npc.cycle = this.loopCycle;
          }
          this.entityUpdateIds[this.entityUpdateCount++] = index;
        } else if (op === 1) {
          this.npcIds[this.npcCount++] = index;
          if (npc) {
            npc.cycle = this.loopCycle;
          }
          const walkDir = buf.gBit(3);
          npc?.moveCode(false, walkDir);
          const extendedInfo = buf.gBit(1);
          if (extendedInfo === 1) {
            this.entityUpdateIds[this.entityUpdateCount++] = index;
          }
        } else if (op === 2) {
          this.npcIds[this.npcCount++] = index;
          if (npc) {
            npc.cycle = this.loopCycle;
          }
          const walkDir = buf.gBit(3);
          npc?.moveCode(true, walkDir);
          const runDir = buf.gBit(3);
          npc?.moveCode(true, runDir);
          const extendedInfo = buf.gBit(1);
          if (extendedInfo === 1) {
            this.entityUpdateIds[this.entityUpdateCount++] = index;
          }
        } else if (op === 3) {
          this.entityRemovalIds[this.entityRemovalCount++] = index;
        }
      }
    }
  }
  getNpcPosNewVis(buf, size) {
    while (buf.bitPos + 21 < size * 8) {
      const index = buf.gBit(14);
      if (index === 16383) {
        break;
      }
      if (!this.npc[index]) {
        this.npc[index] = new ClientNpc;
      }
      const npc = this.npc[index];
      this.npcIds[this.npcCount++] = index;
      if (npc) {
        npc.cycle = this.loopCycle;
        npc.type = NpcType.list(buf.gBit(11));
        npc.size = npc.type.size;
        npc.turnspeed = npc.type.turnspeed;
        npc.walkanim = npc.type.walkanim;
        npc.walkanim_b = npc.type.walkanim_b;
        npc.walkanim_l = npc.type.walkanim_r;
        npc.walkanim_r = npc.type.walkanim_l;
        npc.readyanim = npc.type.readyanim;
      } else {
        buf.gBit(11);
      }
      let dx = buf.gBit(5);
      if (dx > 15) {
        dx -= 32;
      }
      let dz = buf.gBit(5);
      if (dz > 15) {
        dz -= 32;
      }
      if (this.localPlayer) {
        npc?.teleport(false, this.localPlayer.routeX[0] + dx, this.localPlayer.routeZ[0] + dz);
      }
      const extendedInfo = buf.gBit(1);
      if (extendedInfo === 1) {
        this.entityUpdateIds[this.entityUpdateCount++] = index;
      }
    }
    buf.bytes();
  }
  getNpcPosExtended(buf) {
    for (let i2 = 0;i2 < this.entityUpdateCount; i2++) {
      const id = this.entityUpdateIds[i2];
      const npc = this.npc[id];
      if (!npc) {
        continue;
      }
      const mask = buf.g1();
      if ((mask & 1 /* HITMARK2 */) !== 0) {
        const damage = buf.g1();
        const damageType = buf.g1();
        npc.addHitmark(this.loopCycle, damageType, damage);
        npc.combatCycle = this.loopCycle + 400;
        npc.health = buf.g1();
        npc.totalHealth = buf.g1();
      }
      if ((mask & 2 /* ANIM */) !== 0) {
        let anim = buf.g2();
        if (anim === 65535) {
          anim = -1;
        }
        if (anim === npc.primaryAnim) {
          npc.primaryAnimLoop = 0;
        }
        const delay = buf.g1();
        if (npc.primaryAnim === anim && anim !== -1) {
          const restartMode = SeqType.list[anim].duplicatebehaviour;
          if (restartMode == 1 /* RESET */) {
            npc.primaryAnimFrame = 0;
            npc.primaryAnimCycle = 0;
            npc.primaryAnimDelay = delay;
            npc.primaryAnimLoop = 0;
          } else if (restartMode == 2 /* RESETLOOP */) {
            npc.primaryAnimLoop = 0;
          }
        } else if (anim === -1 || npc.primaryAnim === -1 || SeqType.list[anim].priority >= SeqType.list[npc.primaryAnim].priority) {
          npc.primaryAnim = anim;
          npc.primaryAnimFrame = 0;
          npc.primaryAnimCycle = 0;
          npc.primaryAnimDelay = delay;
          npc.primaryAnimLoop = 0;
          npc.preanimRouteLength = npc.routeLength;
        }
      }
      if ((mask & 4 /* FACEENTITY */) !== 0) {
        npc.faceEntity = buf.g2();
        if (npc.faceEntity === 65535) {
          npc.faceEntity = -1;
        }
      }
      if ((mask & 8 /* SAY */) !== 0) {
        npc.chatMessage = buf.gjstr();
        npc.chatTimer = 100;
      }
      if ((mask & 16 /* HITMARK */) !== 0) {
        const damage = buf.g1();
        const damageType = buf.g1();
        npc.addHitmark(this.loopCycle, damageType, damage);
        npc.combatCycle = this.loopCycle + 400;
        npc.health = buf.g1();
        npc.totalHealth = buf.g1();
      }
      if ((mask & 32 /* CHANGETYPE */) !== 0) {
        npc.type = NpcType.list(buf.g2());
        npc.size = npc.type.size;
        npc.turnspeed = npc.type.turnspeed;
        npc.walkanim = npc.type.walkanim;
        npc.walkanim_b = npc.type.walkanim_b;
        npc.walkanim_l = npc.type.walkanim_r;
        npc.walkanim_r = npc.type.walkanim_l;
        npc.readyanim = npc.type.readyanim;
      }
      if ((mask & 64 /* SPOTANIM */) !== 0) {
        npc.spotanimId = buf.g2();
        const info = buf.g4();
        npc.spotanimHeight = info >> 16;
        npc.spotanimLastCycle = this.loopCycle + (info & 65535);
        npc.spotanimFrame = 0;
        npc.spotanimCycle = 0;
        if (npc.spotanimLastCycle > this.loopCycle) {
          npc.spotanimFrame = -1;
        }
        if (npc.spotanimId === 65535) {
          npc.spotanimId = -1;
        }
      }
      if ((mask & 128 /* FACESQUARE */) !== 0) {
        npc.faceSquareX = buf.g2();
        npc.faceSquareZ = buf.g2();
      }
    }
  }
  mouseLoop() {
    if (this.objDragArea !== 0) {
      return;
    }
    if (this.isMobile && this.dialogInputOpen && this.insideChatPopupArea()) {
      return;
    }
    let button = this.mouseClickButton;
    if (this.targetMode === 1 && this.mouseClickX >= 516 && this.mouseClickY >= 160 && this.mouseClickX <= 765 && this.mouseClickY <= 205) {
      button = 0;
    }
    if (this.isMenuOpen) {
      if (button === 1) {
        const menuX = this.menuX;
        const menuY = this.menuY;
        const menuWidth = this.menuWidth;
        let clickX = this.mouseClickX;
        let clickY = this.mouseClickY;
        if (this.menuArea === 0) {
          clickX -= 4;
          clickY -= 4;
        } else if (this.menuArea === 1) {
          clickX -= 553;
          clickY -= 205;
        } else if (this.menuArea === 2) {
          clickX -= 17;
          clickY -= 357;
        }
        let option = -1;
        for (let i2 = 0;i2 < this.menuNumEntries; i2++) {
          const optionY = menuY + (this.menuNumEntries - 1 - i2) * 15 + 31;
          if (clickX > menuX && clickX < menuX + menuWidth && clickY > optionY - 13 && clickY < optionY + 3) {
            option = i2;
          }
        }
        if (option !== -1) {
          this.doAction(option);
        }
        this.isMenuOpen = false;
        if (this.menuArea === 1) {
          this.redrawSidebar = true;
        } else if (this.menuArea === 2) {
          this.redrawChatback = true;
        }
      } else {
        let x2 = this.mouseX;
        let y = this.mouseY;
        if (this.menuArea === 0) {
          x2 -= 4;
          y -= 4;
        } else if (this.menuArea === 1) {
          x2 -= 553;
          y -= 205;
        } else if (this.menuArea === 2) {
          x2 -= 17;
          y -= 357;
        }
        if (x2 < this.menuX - 10 || x2 > this.menuX + this.menuWidth + 10 || y < this.menuY - 10 || y > this.menuY + this.menuHeight + 10) {
          this.isMenuOpen = false;
          if (this.menuArea === 1) {
            this.redrawSidebar = true;
          }
          if (this.menuArea === 2) {
            this.redrawChatback = true;
          }
        }
      }
    } else {
      if (button === 1 && this.menuNumEntries > 0) {
        const action = this.menuAction[this.menuNumEntries - 1];
        if (action == 582 /* INV_BUTTON1 */ || action == 113 /* INV_BUTTON2 */ || action == 555 /* INV_BUTTON3 */ || action == 331 /* INV_BUTTON4 */ || action == 354 /* INV_BUTTON5 */ || action == 694 /* OP_HELD1 */ || action == 962 /* OP_HELD2 */ || action == 795 /* OP_HELD3 */ || action == 681 /* OP_HELD4 */ || action == 100 /* OP_HELD5 */ || action == 102 /* USEHELD_START */ || action === 1328 /* OP_HELD6 */) {
          const slot = this.menuParamB[this.menuNumEntries - 1];
          const comId = this.menuParamC[this.menuNumEntries - 1];
          const com = IfType.list[comId];
          if (com.objSwap || com.objReplace) {
            this.objGrabThreshold = false;
            this.objDragCycles = 0;
            this.objDragComId = comId;
            this.objDragSlot = slot;
            this.objDragArea = 2;
            this.objGrabX = this.mouseClickX;
            this.objGrabY = this.mouseClickY;
            if (IfType.list[comId].layerId === this.mainModalId) {
              this.objDragArea = 1;
            }
            if (IfType.list[comId].layerId === this.chatComId) {
              this.objDragArea = 3;
            }
            return;
          }
        }
      }
      if (button === 1 && (this.oneMouseButton === 1 || this.isAddFriendOption(this.menuNumEntries - 1)) && this.menuNumEntries > 2) {
        button = 2;
      }
      if (button === 1 && this.menuNumEntries > 0) {
        this.doAction(this.menuNumEntries - 1);
      } else if (button == 2 && this.menuNumEntries > 0) {
        this.openMenu();
      }
    }
  }
  drawMinimenu() {
    const x2 = this.menuX;
    const y = this.menuY;
    const w = this.menuWidth;
    const h = this.menuHeight;
    const background = 6116423;
    Pix2D.fillRect(x2, y, w, h, background);
    Pix2D.fillRect(x2 + 1, y + 1, w - 2, 16, 0 /* BLACK */);
    Pix2D.drawRect(x2 + 1, y + 18, w - 2, h - 19, 0 /* BLACK */);
    this.b12?.drawString("Choose Option", x2 + 3, y + 14, background);
    let mouseX = this.mouseX;
    let mouseY = this.mouseY;
    if (this.menuArea === 0) {
      mouseX -= 4;
      mouseY -= 4;
    } else if (this.menuArea === 1) {
      mouseX -= 553;
      mouseY -= 205;
    } else if (this.menuArea === 2) {
      mouseX -= 17;
      mouseY -= 357;
    }
    for (let i2 = 0;i2 < this.menuNumEntries; i2++) {
      const optionY = y + (this.menuNumEntries - 1 - i2) * 15 + 31;
      let rgb = 16777215 /* WHITE */;
      if (mouseX > x2 && mouseX < x2 + w && mouseY > optionY - 13 && mouseY < optionY + 3) {
        rgb = 16776960 /* YELLOW */;
      }
      this.b12?.drawStringTag(this.menuOption[i2], x2 + 3, optionY, rgb, true);
    }
  }
  drawFeedback() {
    if (this.menuNumEntries < 2 && this.useMode === 0 && this.targetMode === 0) {
      return;
    }
    let tooltip;
    if (this.useMode === 1 && this.menuNumEntries < 2) {
      tooltip = "Use " + this.objSelectedName + " with...";
    } else if (this.targetMode === 1 && this.menuNumEntries < 2) {
      tooltip = this.targetOp + "...";
    } else {
      tooltip = this.menuOption[this.menuNumEntries - 1];
    }
    if (this.menuNumEntries > 2) {
      tooltip = tooltip + "@whi@ / " + (this.menuNumEntries - 2) + " more options";
    }
    this.b12?.drawStringAntiMacro(tooltip, 4, 15, 16777215 /* WHITE */, true, this.loopCycle / 1000 | 0);
  }
  openMenu() {
    let width = 0;
    if (this.b12) {
      width = this.b12.stringWid("Choose Option");
      let maxWidth;
      for (let i2 = 0;i2 < this.menuNumEntries; i2++) {
        maxWidth = this.b12.stringWid(this.menuOption[i2]);
        if (maxWidth > width) {
          width = maxWidth;
        }
      }
    }
    width += 8;
    const height = this.menuNumEntries * 15 + 21;
    let x2;
    let y;
    if (this.mouseClickX > 4 && this.mouseClickY > 4 && this.mouseClickX < 516 && this.mouseClickY < 338) {
      x2 = this.mouseClickX - (width / 2 | 0) - 4;
      if (x2 + width > 512) {
        x2 = 512 - width;
      }
      if (x2 < 0) {
        x2 = 0;
      }
      y = this.mouseClickY - 4;
      if (y + height > 334) {
        y = 334 - height;
      }
      if (y < 0) {
        y = 0;
      }
      this.isMenuOpen = true;
      this.menuArea = 0;
      this.menuX = x2;
      this.menuY = y;
      this.menuWidth = width;
      this.menuHeight = this.menuNumEntries * 15 + 22;
    }
    if (this.mouseClickX > 553 && this.mouseClickY > 205 && this.mouseClickX < 743 && this.mouseClickY < 466) {
      x2 = this.mouseClickX - (width / 2 | 0) - 553;
      if (x2 < 0) {
        x2 = 0;
      } else if (x2 + width > 190) {
        x2 = 190 - width;
      }
      y = this.mouseClickY - 205;
      if (y < 0) {
        y = 0;
      } else if (y + height > 261) {
        y = 261 - height;
      }
      this.isMenuOpen = true;
      this.menuArea = 1;
      this.menuX = x2;
      this.menuY = y;
      this.menuWidth = width;
      this.menuHeight = this.menuNumEntries * 15 + 22;
    }
    if (this.mouseClickX > 17 && this.mouseClickY > 357 && this.mouseClickX < 496 && this.mouseClickY < 453) {
      x2 = this.mouseClickX - (width / 2 | 0) - 17;
      if (x2 < 0) {
        x2 = 0;
      } else if (x2 + width > 479) {
        x2 = 479 - width;
      }
      y = this.mouseClickY - 357;
      if (y < 0) {
        y = 0;
      } else if (y + height > 96) {
        y = 96 - height;
      }
      this.isMenuOpen = true;
      this.menuArea = 2;
      this.menuX = x2;
      this.menuY = y;
      this.menuWidth = width;
      this.menuHeight = this.menuNumEntries * 15 + 22;
    }
  }
  isAddFriendOption(option) {
    if (option < 0) {
      return false;
    }
    let action = this.menuAction[option];
    if (action >= 2000 /* _PRIORITY */) {
      action -= 2000 /* _PRIORITY */;
    }
    return action === 605 /* FRIENDLIST_ADD */;
  }
  doAction(optionId) {
    if (optionId < 0) {
      return;
    }
    if (this.dialogInputOpen) {
      this.dialogInputOpen = false;
      this.redrawChatback = true;
    }
    let action = this.menuAction[optionId];
    const a = this.menuParamA[optionId];
    const b = this.menuParamB[optionId];
    const c = this.menuParamC[optionId];
    if (action >= 2000 /* _PRIORITY */) {
      action -= 2000 /* _PRIORITY */;
    }
    if (action === 139 /* OP_OBJ1 */ || action === 778 /* OP_OBJ2 */ || action === 617 /* OP_OBJ3 */ || action === 224 /* OP_OBJ4 */ || action === 662 /* OP_OBJ5 */) {
      if (this.localPlayer) {
        const success = this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 0, 0, 0, 0, 0, 2);
        if (!success) {
          this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 1, 1, 0, 0, 0, 2);
        }
        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        if (action === 139 /* OP_OBJ1 */) {
          if ((b & 3) == 0) {
            Client.oplogic7++;
          }
          if (Client.oplogic7 >= 123) {
            this.out.pIsaac(187 /* ANTICHEAT_OPLOGIC7 */);
            this.out.p4(0);
          }
          this.out.pIsaac(141 /* OPOBJ1 */);
        }
        if (action === 778 /* OP_OBJ2 */) {
          this.out.pIsaac(67 /* OPOBJ2 */);
        }
        if (action === 617 /* OP_OBJ3 */) {
          this.out.pIsaac(178 /* OPOBJ3 */);
        }
        if (action === 224 /* OP_OBJ4 */) {
          Client.oplogic8 += c;
          if (Client.oplogic8 >= 75) {
            this.out.pIsaac(206 /* ANTICHEAT_OPLOGIC8 */);
            this.out.p1(19);
          }
          this.out.pIsaac(47 /* OPOBJ4 */);
        }
        if (action === 662 /* OP_OBJ5 */) {
          Client.oplogic3 += this.mapBuildBaseZ;
          if (Client.oplogic3 >= 118) {
            this.out.pIsaac(56 /* ANTICHEAT_OPLOGIC3 */);
            this.out.p4(0);
          }
          this.out.pIsaac(97 /* OPOBJ5 */);
        }
        this.out.p2(b + this.mapBuildBaseX);
        this.out.p2(c + this.mapBuildBaseZ);
        this.out.p2(a);
      }
    }
    if (action === 1152 /* OP_OBJ6 */) {
      const obj = ObjType.list(a);
      let examine;
      if (!obj.desc) {
        examine = "It's a " + obj.name + ".";
      } else {
        examine = obj.desc;
      }
      this.addChat(0, examine, "");
    }
    if (action === 370 /* TGT_OBJ */) {
      if (this.localPlayer) {
        const success = this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 0, 0, 0, 0, 0, 2);
        if (!success) {
          this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 1, 1, 0, 0, 0, 2);
        }
        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        this.out.pIsaac(202 /* OPOBJT */);
        this.out.p2(b + this.mapBuildBaseX);
        this.out.p2(c + this.mapBuildBaseZ);
        this.out.p2(a);
        this.out.p2(this.targetComId);
      }
    }
    if (action === 111 /* USEHELD_ONOBJ */) {
      if (this.localPlayer) {
        const success = this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 0, 0, 0, 0, 0, 2);
        if (!success) {
          this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], b, c, false, 1, 1, 0, 0, 0, 2);
        }
        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        this.out.pIsaac(245 /* OPOBJU */);
        this.out.p2(b + this.mapBuildBaseX);
        this.out.p2(c + this.mapBuildBaseZ);
        this.out.p2(a);
        this.out.p2(this.objComId);
        this.out.p2(this.objSelectedSlot);
        this.out.p2(this.objSelectedComId);
      }
    }
    if (action === 242 /* OP_NPC1 */ || action === 209 /* OP_NPC2 */ || action === 309 /* OP_NPC3 */ || action === 852 /* OP_NPC4 */ || action === 793 /* OP_NPC5 */) {
      const npc = this.npc[a];
      if (npc && this.localPlayer) {
        this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], npc.routeX[0], npc.routeZ[0], false, 1, 1, 0, 0, 0, 2);
        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        if (action === 242 /* OP_NPC1 */) {
          this.out.pIsaac(143 /* OPNPC1 */);
        }
        if (action === 209 /* OP_NPC2 */) {
          this.out.pIsaac(195 /* OPNPC2 */);
        }
        if (action === 309 /* OP_NPC3 */) {
          this.out.pIsaac(69 /* OPNPC3 */);
        }
        if (action === 852 /* OP_NPC4 */) {
          this.out.pIsaac(122 /* OPNPC4 */);
        }
        if (action === 793 /* OP_NPC5 */) {
          this.out.pIsaac(118 /* OPNPC5 */);
        }
        this.out.p2(a);
      }
    }
    if (action === 1714 /* OP_NPC6 */) {
      const npc = this.npc[a];
      if (npc && npc.type) {
        let examine;
        if (!npc.type.desc) {
          examine = "It's a " + npc.type.name + ".";
        } else {
          examine = npc.type.desc;
        }
        this.addChat(0, examine, "");
      }
    }
    if (action === 240 /* TGT_NPC */) {
      const npc = this.npc[a];
      if (npc && this.localPlayer) {
        this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], npc.routeX[0], npc.routeZ[0], false, 1, 1, 0, 0, 0, 2);
        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        this.out.pIsaac(231 /* OPNPCT */);
        this.out.p2(a);
        this.out.p2(this.targetComId);
      }
    }
    if (action === 829 /* USEHELD_ONNPC */) {
      const npc = this.npc[a];
      if (npc && this.localPlayer) {
        this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], npc.routeX[0], npc.routeZ[0], false, 1, 1, 0, 0, 0, 2);
        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        this.out.pIsaac(119 /* OPNPCU */);
        this.out.p2(a);
        this.out.p2(this.objComId);
        this.out.p2(this.objSelectedSlot);
        this.out.p2(this.objSelectedComId);
      }
    }
    if (action === 625 /* OP_LOC1 */) {
      this.interactWithLoc(b, c, a, 33 /* OPLOC1 */);
    }
    if (action === 721 /* OP_LOC2 */) {
      Client.oplogic1 += c;
      if (Client.oplogic1 >= 139) {
        this.out.pIsaac(28 /* ANTICHEAT_OPLOGIC1 */);
        this.out.p4(0);
      }
      this.interactWithLoc(b, c, a, 213 /* OPLOC2 */);
    }
    if (action === 743 /* OP_LOC3 */) {
      Client.oplogic2++;
      if (Client.oplogic2 >= 124) {
        this.out.pIsaac(77 /* ANTICHEAT_OPLOGIC2 */);
        this.out.p2(37954);
      }
      this.interactWithLoc(b, c, a, 98 /* OPLOC3 */);
    }
    if (action === 357 /* OP_LOC4 */) {
      this.interactWithLoc(b, c, a, 87 /* OPLOC4 */);
    }
    if (action === 1071 /* OP_LOC5 */) {
      this.interactWithLoc(b, c, a, 147 /* OPLOC5 */);
    }
    if (action === 1381 /* OP_LOC6 */) {
      const locId = a >> 14 & 32767;
      const loc = LocType.list(locId);
      let examine;
      if (!loc.desc) {
        examine = "It's a " + loc.name + ".";
      } else {
        examine = loc.desc;
      }
      this.addChat(0, examine, "");
    }
    if (action === 899 /* TGT_LOC */) {
      if (this.interactWithLoc(b, c, a, 26 /* OPLOCT */)) {
        this.out.p2(this.targetComId);
      }
    }
    if (action === 810 /* USEHELD_ONLOC */) {
      if (this.interactWithLoc(b, c, a, 240 /* OPLOCU */)) {
        this.out.p2(this.objComId);
        this.out.p2(this.objSelectedSlot);
        this.out.p2(this.objSelectedComId);
      }
    }
    if (action === 639 /* OP_PLAYER1 */ || action === 499 /* OP_PLAYER2 */ || action === 27 /* OP_PLAYER3 */ || action === 387 /* OP_PLAYER4 */ || action === 185 /* OP_PLAYER5 */) {
      const player = this.players[a];
      if (player && this.localPlayer) {
        this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], player.routeX[0], player.routeZ[0], false, 1, 1, 0, 0, 0, 2);
        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        if (action === 639 /* OP_PLAYER1 */) {
          Client.oplogic4++;
          if (Client.oplogic4 >= 52) {
            this.out.pIsaac(121 /* ANTICHEAT_OPLOGIC4 */);
            this.out.p1(131);
          }
          this.out.pIsaac(192 /* OPPLAYER1 */);
        }
        if (action === 499 /* OP_PLAYER2 */) {
          this.out.pIsaac(17 /* OPPLAYER2 */);
        }
        if (action === 27 /* OP_PLAYER3 */) {
          this.out.pIsaac(18 /* OPPLAYER3 */);
        }
        if (action === 387 /* OP_PLAYER4 */) {
          Client.oplogic5 += a;
          if (Client.oplogic5 >= 66) {
            this.out.pIsaac(233 /* ANTICHEAT_OPLOGIC5 */);
            this.out.p1(154);
          }
          this.out.pIsaac(72 /* OPPLAYER4 */);
        }
        if (action === 185 /* OP_PLAYER5 */) {
          this.out.pIsaac(230 /* OPPLAYER5 */);
        }
        this.out.p2(a);
      }
    }
    if (action === 507 /* ACCEPT_TRADEREQ */ || action === 957 /* ACCEPT_DUELREQ */) {
      let option = this.menuOption[optionId];
      const tag = option.indexOf("@whi@");
      if (tag !== -1) {
        option = option.substring(tag + 5).trim();
        const name = JString.toScreenName(JString.toRawUsername(JString.toUserhash(option)));
        let found = false;
        for (let i2 = 0;i2 < this.playerCount; i2++) {
          const player = this.players[this.playerIds[i2]];
          if (player && player.name && player.name.toLowerCase() === name.toLowerCase() && this.localPlayer) {
            this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], player.routeX[0], player.routeZ[0], false, 1, 1, 0, 0, 0, 2);
            if (action === 507 /* ACCEPT_TRADEREQ */) {
              Client.oplogic5 += a;
              if (Client.oplogic5 >= 66) {
                this.out.pIsaac(233 /* ANTICHEAT_OPLOGIC5 */);
                this.out.p1(154);
              }
              this.out.pIsaac(72 /* OPPLAYER4 */);
            }
            if (action === 957 /* ACCEPT_DUELREQ */) {
              Client.oplogic4++;
              if (Client.oplogic4 >= 52) {
                this.out.pIsaac(121 /* ANTICHEAT_OPLOGIC4 */);
                this.out.p1(131);
              }
              this.out.pIsaac(192 /* OPPLAYER1 */);
            }
            this.out.p2(this.playerIds[i2]);
            found = true;
            break;
          }
        }
        if (!found) {
          this.addChat(0, "Unable to find " + name, "");
        }
      }
    }
    if (action === 131 /* TGT_PLAYER */) {
      const player = this.players[a];
      if (player && this.localPlayer) {
        this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], player.routeX[0], player.routeZ[0], false, 1, 1, 0, 0, 0, 2);
        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        this.out.pIsaac(68 /* OPPLAYERT */);
        this.out.p2(a);
        this.out.p2(this.targetComId);
      }
    }
    if (action === 275 /* USEHELD_ONPLAYER */) {
      const player = this.players[a];
      if (player && this.localPlayer) {
        this.tryMove(this.localPlayer.routeX[0], this.localPlayer.routeZ[0], player.routeX[0], player.routeZ[0], false, 1, 1, 0, 0, 0, 2);
        this.crossX = this.mouseClickX;
        this.crossY = this.mouseClickY;
        this.crossMode = 2;
        this.crossCycle = 0;
        this.out.pIsaac(113 /* OPPLAYERU */);
        this.out.p2(a);
        this.out.p2(this.objComId);
        this.out.p2(this.objSelectedSlot);
        this.out.p2(this.objSelectedComId);
      }
    }
    if (action === 694 /* OP_HELD1 */ || action === 962 /* OP_HELD2 */ || action === 795 /* OP_HELD3 */ || action === 681 /* OP_HELD4 */ || action === 100 /* OP_HELD5 */) {
      if (action === 694 /* OP_HELD1 */) {
        this.out.pIsaac(243 /* OPHELD1 */);
      }
      if (action === 962 /* OP_HELD2 */) {
        this.out.pIsaac(228 /* OPHELD2 */);
      }
      if (action === 795 /* OP_HELD3 */) {
        this.out.pIsaac(80 /* OPHELD3 */);
      }
      if (action === 681 /* OP_HELD4 */) {
        Client.oplogic9++;
        if (Client.oplogic9 >= 116) {
          this.out.pIsaac(162 /* ANTICHEAT_OPLOGIC9 */);
          this.out.p3(13018169);
        }
        this.out.pIsaac(163 /* OPHELD4 */);
      }
      if (action === 100 /* OP_HELD5 */) {
        this.out.pIsaac(74 /* OPHELD5 */);
      }
      this.out.p2(a);
      this.out.p2(b);
      this.out.p2(c);
      this.selectedCycle = 0;
      this.selectedComId = c;
      this.selectedItem = b;
      this.selectedArea = 2;
      if (IfType.list[c].layerId === this.mainModalId) {
        this.selectedArea = 1;
      }
      if (IfType.list[c].layerId === this.chatComId) {
        this.selectedArea = 3;
      }
    }
    if (action === 1328 /* OP_HELD6 */) {
      const obj = ObjType.list(a);
      const com = IfType.list[c];
      let examine;
      if (com && com.linkObjNumber && com.linkObjNumber[b] >= 1e5) {
        examine = com.linkObjNumber[b] + " x " + obj.name;
      } else if (!obj.desc) {
        examine = "It's a " + obj.name + ".";
      } else {
        examine = obj.desc;
      }
      this.addChat(0, examine, "");
    }
    if (action === 102 /* USEHELD_START */) {
      this.useMode = 1;
      this.objSelectedSlot = b;
      this.objSelectedComId = c;
      this.objComId = a;
      this.objSelectedName = ObjType.list(a).name;
      this.targetMode = 0;
      this.redrawSidebar = true;
      return;
    }
    if (action === 274 /* TGT_BUTTON */) {
      const com = IfType.list[c];
      this.targetMode = 1;
      this.targetComId = c;
      this.targetMask = com.targetMask;
      this.useMode = 0;
      this.redrawSidebar = true;
      let prefix = com.targetVerb;
      if (prefix && prefix.indexOf(" ") !== -1) {
        prefix = prefix.substring(0, prefix.indexOf(" "));
      }
      let suffix = com.targetVerb;
      if (suffix && suffix.indexOf(" ") !== -1) {
        suffix = suffix.substring(suffix.indexOf(" ") + 1);
      }
      this.targetOp = prefix + " " + com.targetBase + " " + suffix;
      if (this.targetMask === 16) {
        this.redrawSidebar = true;
        this.sideTab = 3;
        this.redrawSideicons = true;
      }
      return;
    }
    if (action === 563 /* TGT_HELD */) {
      this.out.pIsaac(102 /* OPHELDT */);
      this.out.p2(a);
      this.out.p2(b);
      this.out.p2(c);
      this.out.p2(this.targetComId);
      this.selectedCycle = 0;
      this.selectedComId = c;
      this.selectedItem = b;
      this.selectedArea = 2;
      if (IfType.list[c].layerId === this.mainModalId) {
        this.selectedArea = 1;
      }
      if (IfType.list[c].layerId === this.chatComId) {
        this.selectedArea = 3;
      }
    }
    if (action === 398 /* USEHELD_ONHELD */) {
      this.out.pIsaac(200 /* OPHELDU */);
      this.out.p2(a);
      this.out.p2(b);
      this.out.p2(c);
      this.out.p2(this.objComId);
      this.out.p2(this.objSelectedSlot);
      this.out.p2(this.objSelectedComId);
      this.selectedCycle = 0;
      this.selectedComId = c;
      this.selectedItem = b;
      this.selectedArea = 2;
      if (IfType.list[c].layerId === this.mainModalId) {
        this.selectedArea = 1;
      }
      if (IfType.list[c].layerId === this.chatComId) {
        this.selectedArea = 3;
      }
    }
    if (action === 582 /* INV_BUTTON1 */ || action === 113 /* INV_BUTTON2 */ || action === 555 /* INV_BUTTON3 */ || action === 331 /* INV_BUTTON4 */ || action === 354 /* INV_BUTTON5 */) {
      if (action === 582 /* INV_BUTTON1 */) {
        if ((a & 3) == 0) {
          Client.oplogic6++;
        }
        if (Client.oplogic6 >= 133) {
          this.out.pIsaac(131 /* ANTICHEAT_OPLOGIC6 */);
          this.out.p2(6118);
        }
        this.out.pIsaac(181 /* INV_BUTTON1 */);
      }
      if (action === 113 /* INV_BUTTON2 */) {
        this.out.pIsaac(70 /* INV_BUTTON2 */);
      }
      if (action === 555 /* INV_BUTTON3 */) {
        this.out.pIsaac(59 /* INV_BUTTON3 */);
      }
      if (action === 331 /* INV_BUTTON4 */) {
        this.out.pIsaac(160 /* INV_BUTTON4 */);
      }
      if (action === 354 /* INV_BUTTON5 */) {
        this.out.pIsaac(62 /* INV_BUTTON5 */);
      }
      this.out.p2(a);
      this.out.p2(b);
      this.out.p2(c);
      this.selectedCycle = 0;
      this.selectedComId = c;
      this.selectedItem = b;
      this.selectedArea = 2;
      if (IfType.list[c].layerId === this.mainModalId) {
        this.selectedArea = 1;
      }
      if (IfType.list[c].layerId === this.chatComId) {
        this.selectedArea = 3;
      }
    }
    if (action === 231 /* IF_BUTTON */) {
      const com = IfType.list[c];
      let notify = true;
      if (com.clientCode > 0) {
        notify = this.clientButton(com);
      }
      if (notify) {
        this.out.pIsaac(244 /* IF_BUTTON */);
        this.out.p2(c);
      }
    }
    if (action === 435 /* TOGGLE_BUTTON */) {
      this.out.pIsaac(244 /* IF_BUTTON */);
      this.out.p2(c);
      const com = IfType.list[c];
      if (com.scripts && com.scripts[0] && com.scripts[0][0] === 5) {
        const varp = com.scripts[0][1];
        this.var[varp] = 1 - this.var[varp];
        this.clientVar(varp);
        this.redrawSidebar = true;
      }
    }
    if (action === 225 /* SELECT_BUTTON */) {
      this.out.pIsaac(244 /* IF_BUTTON */);
      this.out.p2(c);
      const com = IfType.list[c];
      if (com.scripts && com.scripts[0] && com.scripts[0][0] === 5) {
        const varp = com.scripts[0][1];
        if (com.scriptOperand && this.var[varp] !== com.scriptOperand[0]) {
          this.var[varp] = com.scriptOperand[0];
          this.clientVar(varp);
          this.redrawSidebar = true;
        }
      }
    }
    if (action === 997 /* PAUSE_BUTTON */) {
      if (!this.resumedPauseButton) {
        this.out.pIsaac(146 /* RESUME_PAUSEBUTTON */);
        this.out.p2(c);
        this.resumedPauseButton = true;
      }
    }
    if (action === 737 /* CLOSE_BUTTON */) {
      this.closeModal();
    }
    if (action === 524 /* ABUSE_REPORT */) {
      const option = this.menuOption[optionId];
      const tag = option.indexOf("@whi@");
      if (tag !== -1) {
        this.closeModal();
        this.reportAbuseInput = option.substring(tag + 5).trim();
        this.reportAbuseMuteOption = false;
        for (let i2 = 0;i2 < IfType.list.length; i2++) {
          if (IfType.list[i2] && IfType.list[i2].clientCode === 600 /* CC_REPORT_INPUT */) {
            this.reportAbuseComId = this.mainModalId = IfType.list[i2].layerId;
            break;
          }
        }
      }
    }
    if (action === 718 /* WALK */) {
      if (this.isMenuOpen) {
        this.world?.updateMousePicking(b - 4, c - 4);
      } else {
        this.world?.updateMousePicking(this.mouseClickX - 4, this.mouseClickY - 4);
      }
    }
    if (action === 605 /* FRIENDLIST_ADD */ || action === 47 /* IGNORELIST_ADD */ || action === 513 /* FRIENDLIST_DEL */ || action === 884 /* IGNORELIST_DEL */) {
      const option = this.menuOption[optionId];
      const tag = option.indexOf("@whi@");
      if (tag !== -1) {
        const username = JString.toUserhash(option.substring(tag + 5).trim());
        if (action === 605 /* FRIENDLIST_ADD */) {
          this.addFriend(username);
        } else if (action === 47 /* IGNORELIST_ADD */) {
          this.addIgnore(username);
        } else if (action === 513 /* FRIENDLIST_DEL */) {
          this.delFriend(username);
        } else if (action === 884 /* IGNORELIST_DEL */) {
          this.delIgnore(username);
        }
      }
    }
    if (action === 902 /* MESSAGE_PRIVATE */) {
      const option = this.menuOption[optionId];
      const tag = option.indexOf("@whi@");
      if (tag !== -1) {
        const userhash = JString.toUserhash(option.substring(tag + 5).trim());
        let friend = -1;
        for (let i2 = 0;i2 < this.friendCount; i2++) {
          if (this.friendUserhash[i2] === userhash) {
            friend = i2;
            break;
          }
        }
        if (friend !== -1 && this.friendNodeId[friend] > 0) {
          this.redrawChatback = true;
          this.dialogInputOpen = false;
          this.socialInputOpen = true;
          this.socialInput = "";
          this.socialInputType = 3;
          this.socialUserhash = this.friendUserhash[friend];
          this.socialInputHeader = "Enter message to send to " + this.friendUsername[friend];
        }
      }
    }
    this.useMode = 0;
    this.targetMode = 0;
    this.redrawSidebar = true;
  }
  addWorldOptions() {
    if (this.useMode === 0 && this.targetMode === 0) {
      this.menuOption[this.menuNumEntries] = "Walk here";
      this.menuAction[this.menuNumEntries] = 718 /* WALK */;
      this.menuParamB[this.menuNumEntries] = this.mouseX;
      this.menuParamC[this.menuNumEntries] = this.mouseY;
      this.menuNumEntries++;
    }
    let lastTypecode = -1;
    for (let picked = 0;picked < Model.pickedCount; picked++) {
      const typecode = Model.pickedEntityTypecode[picked];
      const x2 = typecode & 127;
      const z = typecode >> 7 & 127;
      const entityType = typecode >> 29 & 3;
      const typeId = typecode >> 14 & 32767;
      if (typecode === lastTypecode) {
        continue;
      }
      lastTypecode = typecode;
      if (entityType === 2 && this.world && this.world.typeCode2(this.minusedlevel, x2, z, typecode) >= 0) {
        const loc = LocType.list(typeId);
        if (this.useMode === 1) {
          this.menuOption[this.menuNumEntries] = "Use " + this.objSelectedName + " with @cya@" + loc.name;
          this.menuAction[this.menuNumEntries] = 810 /* USEHELD_ONLOC */;
          this.menuParamA[this.menuNumEntries] = typecode;
          this.menuParamB[this.menuNumEntries] = x2;
          this.menuParamC[this.menuNumEntries] = z;
          this.menuNumEntries++;
        } else if (this.targetMode === 1) {
          if ((this.targetMask & 4) === 4) {
            this.menuOption[this.menuNumEntries] = this.targetOp + " @cya@" + loc.name;
            this.menuAction[this.menuNumEntries] = 899 /* TGT_LOC */;
            this.menuParamA[this.menuNumEntries] = typecode;
            this.menuParamB[this.menuNumEntries] = x2;
            this.menuParamC[this.menuNumEntries] = z;
            this.menuNumEntries++;
          }
        } else {
          if (loc.op) {
            for (let i2 = 4;i2 >= 0; i2--) {
              if (loc.op[i2] === null) {
                continue;
              }
              this.menuOption[this.menuNumEntries] = loc.op[i2] + " @cya@" + loc.name;
              if (i2 === 0) {
                this.menuAction[this.menuNumEntries] = 625 /* OP_LOC1 */;
              } else if (i2 === 1) {
                this.menuAction[this.menuNumEntries] = 721 /* OP_LOC2 */;
              } else if (i2 === 2) {
                this.menuAction[this.menuNumEntries] = 743 /* OP_LOC3 */;
              } else if (i2 === 3) {
                this.menuAction[this.menuNumEntries] = 357 /* OP_LOC4 */;
              } else if (i2 === 4) {
                this.menuAction[this.menuNumEntries] = 1071 /* OP_LOC5 */;
              }
              this.menuParamA[this.menuNumEntries] = typecode;
              this.menuParamB[this.menuNumEntries] = x2;
              this.menuParamC[this.menuNumEntries] = z;
              this.menuNumEntries++;
            }
          }
          this.menuOption[this.menuNumEntries] = "Examine @cya@" + loc.name;
          this.menuAction[this.menuNumEntries] = 1381 /* OP_LOC6 */;
          this.menuParamA[this.menuNumEntries] = typecode;
          this.menuParamB[this.menuNumEntries] = x2;
          this.menuParamC[this.menuNumEntries] = z;
          this.menuNumEntries++;
        }
      } else if (entityType === 1) {
        const npc = this.npc[typeId];
        if (npc && npc.type && npc.type.size === 1 && (npc.x & 127) === 64 && (npc.z & 127) === 64) {
          for (let i2 = 0;i2 < this.npcCount; i2++) {
            const other = this.npc[this.npcIds[i2]];
            if (other && other !== npc && other.type && other.type.size === 1 && other.x === npc.x && other.z === npc.z) {
              this.addNpcOptions(other.type, this.npcIds[i2], x2, z);
            }
          }
        }
        if (npc && npc.type) {
          this.addNpcOptions(npc.type, typeId, x2, z);
        }
      } else if (entityType === 0) {
        const player = this.players[typeId];
        if (player && (player.x & 127) === 64 && (player.z & 127) === 64) {
          for (let i2 = 0;i2 < this.npcCount; i2++) {
            const other = this.npc[this.npcIds[i2]];
            if (other && other.type && other.type.size === 1 && other.x === player.x && other.z === player.z) {
              this.addNpcOptions(other.type, this.npcIds[i2], x2, z);
            }
          }
          for (let i2 = 0;i2 < this.playerCount; i2++) {
            const other = this.players[this.playerIds[i2]];
            if (other && other !== player && other.x === player.x && other.z === player.z) {
              this.addPlayerOptions(other, this.playerIds[i2], x2, z);
            }
          }
        }
        if (player) {
          this.addPlayerOptions(player, typeId, x2, z);
        }
      } else if (entityType === 3) {
        const objs = this.groundObj[this.minusedlevel][x2][z];
        if (!objs) {
          continue;
        }
        for (let obj = objs.tail();obj !== null; obj = objs.prev()) {
          const type = ObjType.list(obj.id);
          if (this.useMode === 1) {
            this.menuOption[this.menuNumEntries] = "Use " + this.objSelectedName + " with @lre@" + type.name;
            this.menuAction[this.menuNumEntries] = 111 /* USEHELD_ONOBJ */;
            this.menuParamA[this.menuNumEntries] = obj.id;
            this.menuParamB[this.menuNumEntries] = x2;
            this.menuParamC[this.menuNumEntries] = z;
            this.menuNumEntries++;
          } else if (this.targetMode === 1) {
            if ((this.targetMask & 1) === 1) {
              this.menuOption[this.menuNumEntries] = this.targetOp + " @lre@" + type.name;
              this.menuAction[this.menuNumEntries] = 370 /* TGT_OBJ */;
              this.menuParamA[this.menuNumEntries] = obj.id;
              this.menuParamB[this.menuNumEntries] = x2;
              this.menuParamC[this.menuNumEntries] = z;
              this.menuNumEntries++;
            }
          } else {
            for (let op = 4;op >= 0; op--) {
              if (type.op && type.op[op]) {
                this.menuOption[this.menuNumEntries] = type.op[op] + " @lre@" + type.name;
                if (op === 0) {
                  this.menuAction[this.menuNumEntries] = 139 /* OP_OBJ1 */;
                } else if (op === 1) {
                  this.menuAction[this.menuNumEntries] = 778 /* OP_OBJ2 */;
                } else if (op === 2) {
                  this.menuAction[this.menuNumEntries] = 617 /* OP_OBJ3 */;
                } else if (op === 3) {
                  this.menuAction[this.menuNumEntries] = 224 /* OP_OBJ4 */;
                } else if (op === 4) {
                  this.menuAction[this.menuNumEntries] = 662 /* OP_OBJ5 */;
                }
                this.menuParamA[this.menuNumEntries] = obj.id;
                this.menuParamB[this.menuNumEntries] = x2;
                this.menuParamC[this.menuNumEntries] = z;
                this.menuNumEntries++;
              } else if (op === 2) {
                this.menuOption[this.menuNumEntries] = "Take @lre@" + type.name;
                this.menuAction[this.menuNumEntries] = 617 /* OP_OBJ3 */;
                this.menuParamA[this.menuNumEntries] = obj.id;
                this.menuParamB[this.menuNumEntries] = x2;
                this.menuParamC[this.menuNumEntries] = z;
                this.menuNumEntries++;
              }
            }
            this.menuOption[this.menuNumEntries] = "Examine @lre@" + type.name;
            this.menuAction[this.menuNumEntries] = 1152 /* OP_OBJ6 */;
            this.menuParamA[this.menuNumEntries] = obj.id;
            this.menuParamB[this.menuNumEntries] = x2;
            this.menuParamC[this.menuNumEntries] = z;
            this.menuNumEntries++;
          }
        }
      }
    }
  }
  addNpcOptions(npc, a, b, c) {
    if (this.menuNumEntries >= 400) {
      return;
    }
    let tooltip = npc.name;
    if (npc.vislevel !== 0 && this.localPlayer) {
      tooltip = tooltip + this.combatColourCode(this.localPlayer.combatLevel, npc.vislevel) + " (level-" + npc.vislevel + ")";
    }
    if (this.useMode === 1) {
      this.menuOption[this.menuNumEntries] = "Use " + this.objSelectedName + " with @yel@" + tooltip;
      this.menuAction[this.menuNumEntries] = 829 /* USEHELD_ONNPC */;
      this.menuParamA[this.menuNumEntries] = a;
      this.menuParamB[this.menuNumEntries] = b;
      this.menuParamC[this.menuNumEntries] = c;
      this.menuNumEntries++;
    } else if (this.targetMode === 1) {
      if ((this.targetMask & 2) === 2) {
        this.menuOption[this.menuNumEntries] = this.targetOp + " @yel@" + tooltip;
        this.menuAction[this.menuNumEntries] = 240 /* TGT_NPC */;
        this.menuParamA[this.menuNumEntries] = a;
        this.menuParamB[this.menuNumEntries] = b;
        this.menuParamC[this.menuNumEntries] = c;
        this.menuNumEntries++;
      }
    } else {
      if (npc.op) {
        for (let i2 = 4;i2 >= 0; i2--) {
          if (npc.op[i2] === null || npc.op[i2]?.toLowerCase() === "attack") {
            continue;
          }
          this.menuOption[this.menuNumEntries] = npc.op[i2] + " @yel@" + tooltip;
          if (i2 === 0) {
            this.menuAction[this.menuNumEntries] = 242 /* OP_NPC1 */;
          } else if (i2 === 1) {
            this.menuAction[this.menuNumEntries] = 209 /* OP_NPC2 */;
          } else if (i2 === 2) {
            this.menuAction[this.menuNumEntries] = 309 /* OP_NPC3 */;
          } else if (i2 === 3) {
            this.menuAction[this.menuNumEntries] = 852 /* OP_NPC4 */;
          } else if (i2 === 4) {
            this.menuAction[this.menuNumEntries] = 793 /* OP_NPC5 */;
          }
          this.menuParamA[this.menuNumEntries] = a;
          this.menuParamB[this.menuNumEntries] = b;
          this.menuParamC[this.menuNumEntries] = c;
          this.menuNumEntries++;
        }
      }
      if (npc.op) {
        for (let i2 = 4;i2 >= 0; i2--) {
          if (npc.op[i2] === null || npc.op[i2]?.toLowerCase() !== "attack") {
            continue;
          }
          let priority = 0;
          if (this.localPlayer && npc.vislevel > this.localPlayer.combatLevel) {
            priority = 2000 /* _PRIORITY */;
          }
          this.menuOption[this.menuNumEntries] = npc.op[i2] + " @yel@" + tooltip;
          if (i2 === 0) {
            this.menuAction[this.menuNumEntries] = priority + 242 /* OP_NPC1 */;
          } else if (i2 === 1) {
            this.menuAction[this.menuNumEntries] = priority + 209 /* OP_NPC2 */;
          } else if (i2 === 2) {
            this.menuAction[this.menuNumEntries] = priority + 309 /* OP_NPC3 */;
          } else if (i2 === 3) {
            this.menuAction[this.menuNumEntries] = priority + 852 /* OP_NPC4 */;
          } else if (i2 === 4) {
            this.menuAction[this.menuNumEntries] = priority + 793 /* OP_NPC5 */;
          }
          this.menuParamA[this.menuNumEntries] = a;
          this.menuParamB[this.menuNumEntries] = b;
          this.menuParamC[this.menuNumEntries] = c;
          this.menuNumEntries++;
        }
      }
      this.menuOption[this.menuNumEntries] = "Examine @yel@" + tooltip;
      this.menuAction[this.menuNumEntries] = 1714 /* OP_NPC6 */;
      this.menuParamA[this.menuNumEntries] = a;
      this.menuParamB[this.menuNumEntries] = b;
      this.menuParamC[this.menuNumEntries] = c;
      this.menuNumEntries++;
    }
  }
  addPlayerOptions(player, a, b, c) {
    if (player === this.localPlayer || this.menuNumEntries >= 400) {
      return;
    }
    let tooltip = null;
    if (this.localPlayer) {
      tooltip = player.name + this.combatColourCode(this.localPlayer.combatLevel, player.combatLevel) + " (level-" + player.combatLevel + ")";
    }
    if (this.useMode === 1) {
      this.menuOption[this.menuNumEntries] = "Use " + this.objSelectedName + " with @whi@" + tooltip;
      this.menuAction[this.menuNumEntries] = 275 /* USEHELD_ONPLAYER */;
      this.menuParamA[this.menuNumEntries] = a;
      this.menuParamB[this.menuNumEntries] = b;
      this.menuParamC[this.menuNumEntries] = c;
      this.menuNumEntries++;
    } else if (this.targetMode === 1) {
      if ((this.targetMask & 8) === 8) {
        this.menuOption[this.menuNumEntries] = this.targetOp + " @whi@" + tooltip;
        this.menuAction[this.menuNumEntries] = 131 /* TGT_PLAYER */;
        this.menuParamA[this.menuNumEntries] = a;
        this.menuParamB[this.menuNumEntries] = b;
        this.menuParamC[this.menuNumEntries] = c;
        this.menuNumEntries++;
      }
    } else {
      for (let i2 = 4;i2 >= 0; i2--) {
        const op = this.playerOp[i2];
        if (op === null || !this.localPlayer) {
          continue;
        }
        this.menuOption[this.menuNumEntries] = op + " @whi@" + tooltip;
        let priority = 0;
        if (op.toLowerCase() === "attack") {
          if (player.combatLevel > this.localPlayer.combatLevel) {
            priority = 2000;
          }
        } else if (this.playerOpPriority[i2]) {
          priority = 2000;
        }
        if (i2 === 0) {
          this.menuAction[this.menuNumEntries] = priority + 639 /* OP_PLAYER1 */;
        } else if (i2 === 1) {
          this.menuAction[this.menuNumEntries] = priority + 499 /* OP_PLAYER2 */;
        } else if (i2 === 2) {
          this.menuAction[this.menuNumEntries] = priority + 27 /* OP_PLAYER3 */;
        } else if (i2 === 3) {
          this.menuAction[this.menuNumEntries] = priority + 387 /* OP_PLAYER4 */;
        } else if (i2 === 4) {
          this.menuAction[this.menuNumEntries] = priority + 185 /* OP_PLAYER5 */;
        }
        this.menuParamA[this.menuNumEntries] = a;
        this.menuParamB[this.menuNumEntries] = b;
        this.menuParamC[this.menuNumEntries] = c;
        this.menuNumEntries++;
      }
    }
    for (let i2 = 0;i2 < this.menuNumEntries; i2++) {
      if (this.menuAction[i2] === 718 /* WALK */) {
        this.menuOption[i2] = "Walk here @whi@" + tooltip;
        break;
      }
    }
  }
  addComponentOptions(com, mouseX, mouseY, x2, y, scrollPosition) {
    if (com.type !== 0 || !com.children || com.hide || mouseX < x2 || mouseY < y || mouseX > x2 + com.width || mouseY > y + com.height || !com.childX || !com.childY) {
      return;
    }
    const children = com.children.length;
    for (let i2 = 0;i2 < children; i2++) {
      let childX = com.childX[i2] + x2;
      let childY = com.childY[i2] + y - scrollPosition;
      const child = IfType.list[com.children[i2]];
      childX += child.x;
      childY += child.y;
      if ((child.overLayerId >= 0 || child.colourOver !== 0) && mouseX >= childX && mouseY >= childY && mouseX < childX + child.width && mouseY < childY + child.height) {
        if (child.overLayerId >= 0) {
          this.lastOverComId = child.overLayerId;
        } else {
          this.lastOverComId = child.id;
        }
      }
      if (child.type === 0) {
        this.addComponentOptions(child, mouseX, mouseY, childX, childY, child.scrollPos);
        if (child.scrollHeight > child.height) {
          this.doScrollbar(mouseX, mouseY, child.scrollHeight, child.height, true, childX + child.width, childY, child);
        }
      } else if (child.type === 2) {
        let slot = 0;
        for (let row = 0;row < child.height; row++) {
          for (let col = 0;col < child.width; col++) {
            let slotX = childX + col * (child.marginX + 32);
            let slotY = childY + row * (child.marginY + 32);
            if (slot < 20 && child.invBackgroundX && child.invBackgroundY) {
              slotX += child.invBackgroundX[slot];
              slotY += child.invBackgroundY[slot];
            }
            if (mouseX < slotX || mouseY < slotY || mouseX >= slotX + 32 || mouseY >= slotY + 32) {
              slot++;
              continue;
            }
            this.hoveredSlot = slot;
            this.hoveredSlotComId = child.id;
            if (!child.linkObjType || child.linkObjType[slot] <= 0) {
              slot++;
              continue;
            }
            const obj = ObjType.list(child.linkObjType[slot] - 1);
            if (this.useMode === 1 && child.objOps) {
              if (child.id !== this.objSelectedComId || slot !== this.objSelectedSlot) {
                this.menuOption[this.menuNumEntries] = "Use " + this.objSelectedName + " with @lre@" + obj.name;
                this.menuAction[this.menuNumEntries] = 398 /* USEHELD_ONHELD */;
                this.menuParamA[this.menuNumEntries] = obj.id;
                this.menuParamB[this.menuNumEntries] = slot;
                this.menuParamC[this.menuNumEntries] = child.id;
                this.menuNumEntries++;
              }
            } else if (this.targetMode === 1 && child.objOps) {
              if ((this.targetMask & 16) === 16) {
                this.menuOption[this.menuNumEntries] = this.targetOp + " @lre@" + obj.name;
                this.menuAction[this.menuNumEntries] = 563 /* TGT_HELD */;
                this.menuParamA[this.menuNumEntries] = obj.id;
                this.menuParamB[this.menuNumEntries] = slot;
                this.menuParamC[this.menuNumEntries] = child.id;
                this.menuNumEntries++;
              }
            } else {
              if (child.objOps) {
                for (let op = 4;op >= 3; op--) {
                  if (obj.iop && obj.iop[op]) {
                    this.menuOption[this.menuNumEntries] = obj.iop[op] + " @lre@" + obj.name;
                    if (op === 3) {
                      this.menuAction[this.menuNumEntries] = 681 /* OP_HELD4 */;
                    } else if (op === 4) {
                      this.menuAction[this.menuNumEntries] = 100 /* OP_HELD5 */;
                    }
                    this.menuParamA[this.menuNumEntries] = obj.id;
                    this.menuParamB[this.menuNumEntries] = slot;
                    this.menuParamC[this.menuNumEntries] = child.id;
                    this.menuNumEntries++;
                  } else if (op === 4) {
                    this.menuOption[this.menuNumEntries] = "Drop @lre@" + obj.name;
                    this.menuAction[this.menuNumEntries] = 100 /* OP_HELD5 */;
                    this.menuParamA[this.menuNumEntries] = obj.id;
                    this.menuParamB[this.menuNumEntries] = slot;
                    this.menuParamC[this.menuNumEntries] = child.id;
                    this.menuNumEntries++;
                  }
                }
              }
              if (child.objUse) {
                this.menuOption[this.menuNumEntries] = "Use @lre@" + obj.name;
                this.menuAction[this.menuNumEntries] = 102 /* USEHELD_START */;
                this.menuParamA[this.menuNumEntries] = obj.id;
                this.menuParamB[this.menuNumEntries] = slot;
                this.menuParamC[this.menuNumEntries] = child.id;
                this.menuNumEntries++;
              }
              if (child.objOps && obj.iop) {
                for (let op = 2;op >= 0; op--) {
                  if (obj.iop[op]) {
                    this.menuOption[this.menuNumEntries] = obj.iop[op] + " @lre@" + obj.name;
                    if (op === 0) {
                      this.menuAction[this.menuNumEntries] = 694 /* OP_HELD1 */;
                    } else if (op === 1) {
                      this.menuAction[this.menuNumEntries] = 962 /* OP_HELD2 */;
                    } else if (op === 2) {
                      this.menuAction[this.menuNumEntries] = 795 /* OP_HELD3 */;
                    }
                    this.menuParamA[this.menuNumEntries] = obj.id;
                    this.menuParamB[this.menuNumEntries] = slot;
                    this.menuParamC[this.menuNumEntries] = child.id;
                    this.menuNumEntries++;
                  }
                }
              }
              if (child.iop) {
                for (let op = 4;op >= 0; op--) {
                  if (child.iop[op]) {
                    this.menuOption[this.menuNumEntries] = child.iop[op] + " @lre@" + obj.name;
                    if (op === 0) {
                      this.menuAction[this.menuNumEntries] = 582 /* INV_BUTTON1 */;
                    } else if (op === 1) {
                      this.menuAction[this.menuNumEntries] = 113 /* INV_BUTTON2 */;
                    } else if (op === 2) {
                      this.menuAction[this.menuNumEntries] = 555 /* INV_BUTTON3 */;
                    } else if (op === 3) {
                      this.menuAction[this.menuNumEntries] = 331 /* INV_BUTTON4 */;
                    } else if (op === 4) {
                      this.menuAction[this.menuNumEntries] = 354 /* INV_BUTTON5 */;
                    }
                    this.menuParamA[this.menuNumEntries] = obj.id;
                    this.menuParamB[this.menuNumEntries] = slot;
                    this.menuParamC[this.menuNumEntries] = child.id;
                    this.menuNumEntries++;
                  }
                }
              }
              this.menuOption[this.menuNumEntries] = "Examine @lre@" + obj.name;
              this.menuAction[this.menuNumEntries] = 1328 /* OP_HELD6 */;
              this.menuParamA[this.menuNumEntries] = obj.id;
              this.menuParamB[this.menuNumEntries] = slot;
              this.menuParamC[this.menuNumEntries] = child.id;
              this.menuNumEntries++;
            }
            slot++;
          }
        }
      } else if (mouseX >= childX && mouseY >= childY && mouseX < childX + child.width && mouseY < childY + child.height) {
        if (child.buttonType === 1 /* BUTTON_OK */) {
          let override = false;
          if (child.clientCode !== 0) {
            override = this.addSocialOptions(child);
          }
          if (!override && child.buttonText) {
            this.menuOption[this.menuNumEntries] = child.buttonText;
            this.menuAction[this.menuNumEntries] = 231 /* IF_BUTTON */;
            this.menuParamC[this.menuNumEntries] = child.id;
            this.menuNumEntries++;
          }
        } else if (child.buttonType === 2 /* BUTTON_TARGET */ && this.targetMode === 0) {
          let prefix = child.targetVerb;
          if (prefix && prefix.indexOf(" ") !== -1) {
            prefix = prefix.substring(0, prefix.indexOf(" "));
          }
          this.menuOption[this.menuNumEntries] = prefix + " @gre@" + child.targetBase;
          this.menuAction[this.menuNumEntries] = 274 /* TGT_BUTTON */;
          this.menuParamC[this.menuNumEntries] = child.id;
          this.menuNumEntries++;
        } else if (child.buttonType === 3 /* BUTTON_CLOSE */) {
          this.menuOption[this.menuNumEntries] = "Close";
          this.menuAction[this.menuNumEntries] = 737 /* CLOSE_BUTTON */;
          this.menuParamC[this.menuNumEntries] = child.id;
          this.menuNumEntries++;
        } else if (child.buttonType === 4 /* BUTTON_TOGGLE */ && child.buttonText) {
          this.menuOption[this.menuNumEntries] = child.buttonText;
          this.menuAction[this.menuNumEntries] = 435 /* TOGGLE_BUTTON */;
          this.menuParamC[this.menuNumEntries] = child.id;
          this.menuNumEntries++;
        } else if (child.buttonType === 5 /* BUTTON_SELECT */ && child.buttonText) {
          this.menuOption[this.menuNumEntries] = child.buttonText;
          this.menuAction[this.menuNumEntries] = 225 /* SELECT_BUTTON */;
          this.menuParamC[this.menuNumEntries] = child.id;
          this.menuNumEntries++;
        } else if (child.buttonType === 6 /* BUTTON_CONTINUE */ && !this.resumedPauseButton && child.buttonText) {
          this.menuOption[this.menuNumEntries] = child.buttonText;
          this.menuAction[this.menuNumEntries] = 997 /* PAUSE_BUTTON */;
          this.menuParamC[this.menuNumEntries] = child.id;
          this.menuNumEntries++;
        }
      }
    }
  }
  addSocialOptions(component) {
    let clientCode = component.clientCode;
    if (clientCode >= 1 /* CC_FRIENDS_START */ && clientCode <= 200 /* CC_FRIENDS_UPDATE_END */ || clientCode >= 701 && clientCode <= 900) {
      if (clientCode >= 801) {
        clientCode -= 701;
      } else if (clientCode >= 701) {
        clientCode -= 601;
      } else if (clientCode >= 101 /* CC_FRIENDS_UPDATE_START */) {
        clientCode -= 101 /* CC_FRIENDS_UPDATE_START */;
      } else {
        clientCode--;
      }
      this.menuOption[this.menuNumEntries] = "Remove @whi@" + this.friendUsername[clientCode];
      this.menuAction[this.menuNumEntries] = 513 /* FRIENDLIST_DEL */;
      this.menuNumEntries++;
      this.menuOption[this.menuNumEntries] = "Message @whi@" + this.friendUsername[clientCode];
      this.menuAction[this.menuNumEntries] = 902 /* MESSAGE_PRIVATE */;
      this.menuNumEntries++;
      return true;
    } else if (clientCode >= 401 /* CC_IGNORES_START */ && clientCode <= 500 /* CC_IGNORES_END */) {
      this.menuOption[this.menuNumEntries] = "Remove @whi@" + component.text;
      this.menuAction[this.menuNumEntries] = 884 /* IGNORELIST_DEL */;
      this.menuNumEntries++;
      return true;
    }
    return false;
  }
  combatColourCode(viewerLevel, otherLevel) {
    const diff = viewerLevel - otherLevel;
    if (diff < -9) {
      return "@red@";
    } else if (diff < -6) {
      return "@or3@";
    } else if (diff < -3) {
      return "@or2@";
    } else if (diff < 0) {
      return "@or1@";
    } else if (diff > 9) {
      return "@gre@";
    } else if (diff > 6) {
      return "@gr3@";
    } else if (diff > 3) {
      return "@gr2@";
    } else if (diff > 0) {
      return "@gr1@";
    } else {
      return "@yel@";
    }
  }
  drawInterface(com, x2, y, scrollY) {
    if (com.type !== 0 || !com.children || com.hide && this.overMainComId !== com.id && this.overSideComId !== com.id && this.overChatComId !== com.id) {
      return;
    }
    const left = Pix2D.clipMinX;
    const top = Pix2D.clipMinY;
    const right = Pix2D.clipMaxX;
    const bottom = Pix2D.clipMaxY;
    Pix2D.setClipping(x2, y, x2 + com.width, y + com.height);
    const children = com.children.length;
    for (let i2 = 0;i2 < children; i2++) {
      if (!com.childX || !com.childY) {
        continue;
      }
      let childX = com.childX[i2] + x2;
      let childY = com.childY[i2] + y - scrollY;
      const child = IfType.list[com.children[i2]];
      childX += child.x;
      childY += child.y;
      if (child.clientCode > 0) {
        this.clientComponent(child);
      }
      if (child.type === 0 /* TYPE_LAYER */) {
        if (child.scrollPos > child.scrollHeight - child.height) {
          child.scrollPos = child.scrollHeight - child.height;
        }
        if (child.scrollPos < 0) {
          child.scrollPos = 0;
        }
        this.drawInterface(child, childX, childY, child.scrollPos);
        if (child.scrollHeight > child.height) {
          this.drawScrollbar(childX + child.width, childY, child.scrollPos, child.scrollHeight, child.height);
        }
      } else if (child.type === 2 /* TYPE_INV */) {
        let slot = 0;
        for (let row = 0;row < child.height; row++) {
          for (let col = 0;col < child.width; col++) {
            if (!child.invBackgroundX || !child.invBackgroundY || !child.linkObjType || !child.linkObjNumber) {
              continue;
            }
            let slotX = childX + col * (child.marginX + 32);
            let slotY = childY + row * (child.marginY + 32);
            if (slot < 20) {
              slotX += child.invBackgroundX[slot];
              slotY += child.invBackgroundY[slot];
            }
            if (child.linkObjType[slot] > 0) {
              let dx = 0;
              let dy = 0;
              const id = child.linkObjType[slot] - 1;
              if (slotX > Pix2D.clipMinX - 32 && slotX < Pix2D.clipMaxX && slotY > Pix2D.clipMinY - 32 && slotY < Pix2D.clipMaxY || this.objDragArea !== 0 && this.objDragSlot === slot) {
                let outline = 0;
                if (this.useMode == 1 && this.objSelectedSlot == slot && this.objSelectedComId == child.id) {
                  outline = 16777215;
                }
                const icon = ObjType.getSprite(id, child.linkObjNumber[slot], outline);
                if (icon) {
                  if (this.objDragArea !== 0 && this.objDragSlot === slot && this.objDragComId === child.id) {
                    dx = this.mouseX - this.objGrabX;
                    dy = this.mouseY - this.objGrabY;
                    if (dx < 5 && dx > -5) {
                      dx = 0;
                    }
                    if (dy < 5 && dy > -5) {
                      dy = 0;
                    }
                    if (this.objDragCycles < 5) {
                      dx = 0;
                      dy = 0;
                    }
                    icon.transPlotSprite(slotX + dx, slotY + dy, 128);
                    if (slotY + dy < Pix2D.clipMinY && com.scrollPos > 0) {
                      let autoscroll = (Pix2D.clipMinY - slotY - dy) * this.worldUpdateNum / 3;
                      if (autoscroll > this.worldUpdateNum * 10) {
                        autoscroll = this.worldUpdateNum * 10;
                      }
                      if (autoscroll > com.scrollPos) {
                        autoscroll = com.scrollPos;
                      }
                      com.scrollPos -= autoscroll;
                      this.objGrabY += autoscroll;
                    }
                    if (slotY + dy + 32 > Pix2D.clipMaxY && com.scrollPos < com.scrollHeight - com.height) {
                      let autoscroll = (slotY + dy + 32 - Pix2D.clipMaxY) * this.worldUpdateNum / 3;
                      if (autoscroll > this.worldUpdateNum * 10) {
                        autoscroll = this.worldUpdateNum * 10;
                      }
                      if (autoscroll > com.scrollHeight - com.height - com.scrollPos) {
                        autoscroll = com.scrollHeight - com.height - com.scrollPos;
                      }
                      com.scrollPos += autoscroll;
                      this.objGrabY -= autoscroll;
                    }
                  } else if (this.selectedArea !== 0 && this.selectedItem === slot && this.selectedComId === child.id) {
                    icon.transPlotSprite(slotX, slotY, 128);
                  } else {
                    icon.plotSprite(slotX, slotY);
                  }
                  if (icon.owi === 33 || child.linkObjNumber[slot] !== 1) {
                    const count = child.linkObjNumber[slot];
                    this.p11?.drawString(this.invNumber(count), slotX + dx + 1, slotY + 10 + dy, 0 /* BLACK */);
                    this.p11?.drawString(this.invNumber(count), slotX + dx, slotY + 9 + dy, 16776960 /* YELLOW */);
                  }
                }
              }
            } else if (child.invBackground && slot < 20) {
              const image = child.invBackground[slot];
              image?.plotSprite(slotX, slotY);
            }
            slot++;
          }
        }
      } else if (child.type === 3 /* TYPE_RECT */) {
        let hovered = false;
        if (this.overChatComId === child.id || this.overSideComId === child.id || this.overMainComId === child.id) {
          hovered = true;
        }
        let colour = 0;
        if (this.getIfActive(child)) {
          colour = child.colour2;
          if (hovered && child.colour2Over !== 0) {
            colour = child.colour2Over;
          }
        } else {
          colour = child.colour;
          if (hovered && child.colourOver !== 0) {
            colour = child.colourOver;
          }
        }
        if (child.trans === 0) {
          if (child.fill) {
            Pix2D.fillRect(childX, childY, child.width, child.height, colour);
          } else {
            Pix2D.drawRect(childX, childY, child.width, child.height, colour);
          }
        } else if (child.fill) {
          Pix2D.fillRectTrans(childX, childY, child.width, child.height, colour, 256 - (child.trans & 255));
        } else {
          Pix2D.drawRect(childX, childY, child.width, child.height, colour);
          Pix2D.drawRectTrans(childX, childY, child.width, child.height, colour, 256 - (child.trans & 255));
        }
      } else if (child.type === 4 /* TYPE_TEXT */) {
        const font = child.font;
        let text = child.text;
        let hovered = false;
        if (this.overChatComId === child.id || this.overSideComId === child.id || this.overMainComId === child.id) {
          hovered = true;
        }
        let colour = 0;
        if (this.getIfActive(child)) {
          colour = child.colour2;
          if (hovered && child.colour2Over !== 0) {
            colour = child.colour2Over;
          }
          if (child.text2 && child.text2.length > 0) {
            text = child.text2;
          }
        } else {
          colour = child.colour;
          if (hovered && child.colourOver !== 0) {
            colour = child.colourOver;
          }
        }
        if (child.buttonType === 6 /* BUTTON_CONTINUE */ && this.resumedPauseButton) {
          text = "Please wait...";
          colour = child.colour;
        }
        if (Pix2D.width == 479) {
          if (colour == 16776960) {
            colour = 255;
          }
          if (colour == 49152) {
            colour = 16777215;
          }
        }
        if (!font || !text) {
          continue;
        }
        for (let lineY = childY + font.height2d;text.length > 0; lineY += font.height2d) {
          if (text.indexOf("%") !== -1) {
            do {
              const index = text.indexOf("%1");
              if (index === -1) {
                break;
              }
              text = text.substring(0, index) + this.inf(this.getIfVar(child, 0)) + text.substring(index + 2);
            } while (true);
            do {
              const index = text.indexOf("%2");
              if (index === -1) {
                break;
              }
              text = text.substring(0, index) + this.inf(this.getIfVar(child, 1)) + text.substring(index + 2);
            } while (true);
            do {
              const index = text.indexOf("%3");
              if (index === -1) {
                break;
              }
              text = text.substring(0, index) + this.inf(this.getIfVar(child, 2)) + text.substring(index + 2);
            } while (true);
            do {
              const index = text.indexOf("%4");
              if (index === -1) {
                break;
              }
              text = text.substring(0, index) + this.inf(this.getIfVar(child, 3)) + text.substring(index + 2);
            } while (true);
            do {
              const index = text.indexOf("%5");
              if (index === -1) {
                break;
              }
              text = text.substring(0, index) + this.inf(this.getIfVar(child, 4)) + text.substring(index + 2);
            } while (true);
          }
          const newline = text.indexOf("\\n");
          let split;
          if (newline !== -1) {
            split = text.substring(0, newline);
            text = text.substring(newline + 2);
          } else {
            split = text;
            text = "";
          }
          if (child.center) {
            font.centreStringTag(split, childX + (child.width / 2 | 0), lineY, colour, child.shadow);
          } else {
            font.drawStringTag(split, childX, lineY, colour, child.shadow);
          }
        }
      } else if (child.type === 5 /* TYPE_GRAPHIC */) {
        let image;
        if (this.getIfActive(child)) {
          image = child.graphic2;
        } else {
          image = child.graphic;
        }
        image?.plotSprite(childX, childY);
      } else if (child.type === 6 /* TYPE_MODEL */) {
        const tmpX = Pix3D.originX;
        const tmpY = Pix3D.originY;
        Pix3D.originX = childX + (child.width / 2 | 0);
        Pix3D.originY = childY + (child.height / 2 | 0);
        const eyeY = Pix3D.sinTable[child.modelXAn] * child.modelZoom >> 16;
        const eyeZ = Pix3D.cosTable[child.modelXAn] * child.modelZoom >> 16;
        const active = this.getIfActive(child);
        let seqId;
        if (active) {
          seqId = child.modelAnim2;
        } else {
          seqId = child.modelAnim;
        }
        let model = null;
        if (seqId === -1) {
          model = child.getTempModel(-1, -1, active, this.localPlayer);
        } else {
          const seq = SeqType.list[seqId];
          if (seq.frames && seq.iframes) {
            model = child.getTempModel(seq.frames[child.animFrame], seq.iframes[child.animFrame], active, this.localPlayer);
          }
        }
        if (model) {
          model.objRender(0, child.modelYAn, 0, child.modelXAn, 0, eyeY, eyeZ);
        }
        Pix3D.originX = tmpX;
        Pix3D.originY = tmpY;
      } else if (child.type === 7 /* TYPE_INV_TEXT */) {
        const font = child.font;
        if (!font || !child.linkObjType || !child.linkObjNumber) {
          continue;
        }
        let slot = 0;
        for (let row = 0;row < child.height; row++) {
          for (let col = 0;col < child.width; col++) {
            if (child.linkObjType[slot] > 0) {
              const obj = ObjType.list(child.linkObjType[slot] - 1);
              let text = obj.name;
              if (obj.stackable || child.linkObjNumber[slot] !== 1) {
                text = text + " x" + this.niceNumber(child.linkObjNumber[slot]);
              }
              if (!text) {
                continue;
              }
              const textX = childX + col * (child.marginX + 115);
              const textY = childY + row * (child.marginY + 12);
              if (child.center) {
                font.centreStringTag(text, textX + (child.width / 2 | 0), textY, child.colour, child.shadow);
              } else {
                font.drawStringTag(text, textX, textY, child.colour, child.shadow);
              }
            }
            slot++;
          }
        }
      }
    }
    Pix2D.setClipping(left, top, right, bottom);
  }
  invNumber(amount) {
    if (amount < 1e5) {
      return String(amount);
    } else if (amount < 1e7) {
      return (amount / 1000 | 0) + "K";
    } else {
      return (amount / 1e6 | 0) + "M";
    }
  }
  niceNumber(amount) {
    let s = String(amount);
    for (let i2 = s.length - 3;i2 > 0; i2 -= 3) {
      s = s.substring(0, i2) + "," + s.substring(i2);
    }
    if (s.length > 8) {
      s = "@gre@" + s.substring(0, s.length - 8) + " million @whi@(" + s + ")";
    } else if (s.length > 4) {
      s = "@cya@" + s.substring(0, s.length - 4) + "K @whi@(" + s + ")";
    }
    return " " + s;
  }
  doScrollbar(x2, y, scrollableHeight, height, redraw, left, top, com) {
    if (this.scrollGrabbed) {
      this.scrollInputPadding = 32;
    } else {
      this.scrollInputPadding = 0;
    }
    this.scrollGrabbed = false;
    if (x2 >= left && x2 < left + 16 && y >= top && y < top + 16) {
      com.scrollPos -= this.scrollCycle * 4;
      if (redraw) {
        this.redrawSidebar = true;
      }
    } else if (x2 >= left && x2 < left + 16 && y >= top + height - 16 && y < top + height) {
      com.scrollPos += this.scrollCycle * 4;
      if (redraw) {
        this.redrawSidebar = true;
      }
    } else if (x2 >= left - this.scrollInputPadding && x2 < left + this.scrollInputPadding + 16 && y >= top + 16 && y < top + height - 16 && this.scrollCycle > 0) {
      let gripSize = (height - 32) * height / scrollableHeight | 0;
      if (gripSize < 8) {
        gripSize = 8;
      }
      const gripY = y - top - (gripSize / 2 | 0) - 16;
      const maxY = height - gripSize - 32;
      com.scrollPos = (scrollableHeight - height) * gripY / maxY | 0;
      if (redraw) {
        this.redrawSidebar = true;
      }
      this.scrollGrabbed = true;
    }
  }
  drawScrollbar(x2, y, scrollY, scrollHeight, height) {
    this.scrollbar1?.plotSprite(x2, y);
    this.scrollbar2?.plotSprite(x2, y + height - 16);
    Pix2D.fillRect(x2, y + 16, 16, height - 32, SCROLLBAR_TRACK);
    let gripSize = (height - 32) * height / scrollHeight | 0;
    if (gripSize < 8) {
      gripSize = 8;
    }
    const gripY = (height - gripSize - 32) * scrollY / (scrollHeight - height) | 0;
    Pix2D.fillRect(x2, y + gripY + 16, 16, gripSize, SCROLLBAR_GRIP_FOREGROUND);
    Pix2D.vline(x2, y + gripY + 16, gripSize, SCROLLBAR_GRIP_HIGHLIGHT);
    Pix2D.vline(x2 + 1, y + gripY + 16, gripSize, SCROLLBAR_GRIP_HIGHLIGHT);
    Pix2D.hline(x2, y + gripY + 16, 16, SCROLLBAR_GRIP_HIGHLIGHT);
    Pix2D.hline(x2, y + gripY + 17, 16, SCROLLBAR_GRIP_HIGHLIGHT);
    Pix2D.vline(x2 + 15, y + gripY + 16, gripSize, SCROLLBAR_GRIP_LOWLIGHT);
    Pix2D.vline(x2 + 14, y + gripY + 17, gripSize - 1, SCROLLBAR_GRIP_LOWLIGHT);
    Pix2D.hline(x2, y + gripY + gripSize + 15, 16, SCROLLBAR_GRIP_LOWLIGHT);
    Pix2D.hline(x2 + 1, y + gripY + gripSize + 14, 15, SCROLLBAR_GRIP_LOWLIGHT);
  }
  inf(value) {
    return value < 999999999 ? String(value) : "*";
  }
  getIfActive(com) {
    if (!com.scriptComparator) {
      return false;
    }
    for (let i2 = 0;i2 < com.scriptComparator.length; i2++) {
      if (!com.scriptOperand) {
        return false;
      }
      const value = this.getIfVar(com, i2);
      const operand = com.scriptOperand[i2];
      if (com.scriptComparator[i2] === 2) {
        if (value >= operand) {
          return false;
        }
      } else if (com.scriptComparator[i2] === 3) {
        if (value <= operand) {
          return false;
        }
      } else if (com.scriptComparator[i2] === 4) {
        if (value === operand) {
          return false;
        }
      } else if (value !== operand) {
        return false;
      }
    }
    return true;
  }
  getIfVar(component, scriptId) {
    if (!component.scripts || scriptId >= component.scripts.length) {
      return -2;
    }
    try {
      const script = component.scripts[scriptId];
      if (!script) {
        return -1;
      }
      let acc = 0;
      let pc = 0;
      let arithmetic = 0;
      while (true) {
        let register = 0;
        let nextArithmetic = 0;
        const opcode = script[pc++];
        if (opcode === 0) {
          return acc;
        }
        if (opcode === 1) {
          register = this.statEffectiveLevel[script[pc++]];
        } else if (opcode === 2) {
          register = this.statBaseLevel[script[pc++]];
        } else if (opcode === 3) {
          register = this.statXP[script[pc++]];
        } else if (opcode === 4) {
          const com = IfType.list[script[pc++]];
          const obj = script[pc++] + 1;
          if (com.linkObjType && com.linkObjNumber) {
            for (let i2 = 0;i2 < com.linkObjType.length; i2++) {
              if (com.linkObjType[i2] === obj) {
                register += com.linkObjNumber[i2];
              }
            }
          }
        } else if (opcode === 5) {
          register = this.var[script[pc++]];
        } else if (opcode === 6) {
          register = Client.levelExperience[this.statBaseLevel[script[pc++]] - 1];
        } else if (opcode === 7) {
          register = this.var[script[pc++]] * 100 / 46875 | 0;
        } else if (opcode === 8) {
          register = this.localPlayer?.combatLevel || 0;
        } else if (opcode === 9) {
          for (let i2 = 0;i2 < 19; i2++) {
            if (i2 === 18) {
              i2 = 20;
            }
            register += this.statBaseLevel[i2];
          }
        } else if (opcode === 10) {
          const com = IfType.list[script[pc++]];
          const obj = script[pc++] + 1;
          if (com.linkObjType) {
            for (let i2 = 0;i2 < com.linkObjType.length; i2++) {
              if (com.linkObjType[i2] === obj) {
                register = 999999999;
                break;
              }
            }
          }
        } else if (opcode === 11) {
          register = this.runenergy;
        } else if (opcode === 12) {
          register = this.runweight;
        } else if (opcode === 13) {
          const varp = this.var[script[pc++]];
          const lsb = script[pc++];
          register = (varp & 1 << lsb) === 0 ? 0 : 1;
        } else if (opcode === 14) {
          const varbit = VarBitType.list[script[pc++]];
          const { basevar, startbit, endbit } = varbit;
          const mask = Client.readbit[endbit - startbit];
          register = this.var[basevar] >> startbit & mask;
        } else if (opcode === 15) {
          nextArithmetic = 1;
        } else if (opcode === 16) {
          nextArithmetic = 2;
        } else if (opcode === 17) {
          nextArithmetic = 3;
        } else if (opcode === 18) {
          if (this.localPlayer) {
            register = (this.localPlayer.x >> 7) + this.mapBuildBaseX;
          }
        } else if (opcode === 19) {
          if (this.localPlayer) {
            register = (this.localPlayer.z >> 7) + this.mapBuildBaseZ;
          }
        } else if (opcode === 20) {
          register = script[pc++];
        }
        if (nextArithmetic === 0) {
          if (arithmetic === 0) {
            acc += register;
          } else if (arithmetic === 1) {
            acc -= register;
          } else if (arithmetic === 2 && register !== 0) {
            acc = acc / register | 0;
          } else if (arithmetic === 3) {
            acc = acc * register | 0;
          }
          arithmetic = 0;
        } else {
          arithmetic = nextArithmetic;
        }
      }
    } catch (_e) {
      return -1;
    }
  }
  ifAnimReset(id) {
    const parent = IfType.list[id];
    if (!parent.children) {
      return;
    }
    for (let i2 = 0;i2 < parent.children.length && parent.children[i2] !== -1; i2++) {
      const child = IfType.list[parent.children[i2]];
      if (child.type === 1) {
        this.ifAnimReset(child.id);
      }
      child.animFrame = 0;
      child.animCycle = 0;
    }
  }
  animateInterface(id, delta) {
    const parent = IfType.list[id];
    if (!parent.children) {
      return false;
    }
    let updated = false;
    for (let i2 = 0;i2 < parent.children.length && parent.children[i2] !== -1; i2++) {
      const child = IfType.list[parent.children[i2]];
      if (child.type === 1) {
        updated ||= this.animateInterface(child.id, delta);
      }
      if (child.type === 6 && (child.modelAnim !== -1 || child.modelAnim2 !== -1)) {
        const active = this.getIfActive(child);
        let seqId;
        if (active) {
          seqId = child.modelAnim2;
        } else {
          seqId = child.modelAnim;
        }
        if (seqId !== -1) {
          const type = SeqType.list[seqId];
          child.animCycle += delta;
          while (child.animCycle > type.getDuration(child.animFrame)) {
            child.animCycle -= type.getDuration(child.animFrame) + 1;
            child.animFrame++;
            if (child.animFrame >= type.numFrames) {
              child.animFrame -= type.loops;
              if (child.animFrame < 0 || child.animFrame >= type.numFrames) {
                child.animFrame = 0;
              }
            }
            updated = true;
          }
        }
      }
    }
    return updated;
  }
  clientVar(id) {
    const clientcode = VarpType.list[id].clientcode;
    if (clientcode === 0) {
      return;
    }
    const value = this.var[id];
    if (clientcode === 1) {
      if (value === 1) {
        Pix3D.initColourTable(0.9);
      } else if (value === 2) {
        Pix3D.initColourTable(0.8);
      } else if (value === 3) {
        Pix3D.initColourTable(0.7);
      } else if (value === 4) {
        Pix3D.initColourTable(0.6);
      }
      ObjType.spriteCache?.clear();
      this.redrawFrame = true;
    } else if (clientcode === 3) {
      const lastMidiActive = this.midiActive;
      if (value === 0) {
        this.midiVolume = 0;
        this.midiActive = true;
      } else if (value === 1) {
        this.midiVolume = -4;
        this.midiActive = true;
      } else if (value === 2) {
        this.midiVolume = -8;
        this.midiActive = true;
      } else if (value === 3) {
        this.midiVolume = -12;
        this.midiActive = true;
      } else if (value === 4) {
        this.midiActive = false;
      }
      if (this.midiActive) {
        setMidiVolume(this.midiVolume);
      }
      if (this.midiActive !== lastMidiActive) {
        if (this.midiActive) {
          this.midiSong = this.nextMidiSong;
          this.midiFading = false;
          this.onDemand?.request(2, this.midiSong);
        } else {
          stopMidi(false);
        }
        this.nextMusicDelay = 0;
      }
    } else if (clientcode === 4) {
      if (value === 0) {
        this.waveVolume = 0;
        this.waveEnabled = true;
      } else if (value === 1) {
        this.waveVolume = -4;
        this.waveEnabled = true;
      } else if (value === 2) {
        this.waveVolume = -8;
        this.waveEnabled = true;
      } else if (value === 3) {
        this.waveVolume = -12;
        this.waveEnabled = true;
      } else if (value === 4) {
        this.waveEnabled = false;
      }
      if (this.waveEnabled) {
        setWaveVolume(this.waveVolume);
      }
    } else if (clientcode === 5) {
      this.oneMouseButton = value;
    } else if (clientcode === 6) {
      this.chatEffects = value;
    } else if (clientcode === 8) {
      this.splitPrivateChat = value;
      this.redrawChatback = true;
    } else if (clientcode === 9) {
      this.bankArrangeMode = value;
    }
  }
  clientComponent(com) {
    let clientCode = com.clientCode;
    if (clientCode >= 1 /* CC_FRIENDS_START */ && clientCode <= 100 /* CC_FRIENDS_END */ || clientCode >= 701 /* CC_FRIENDS2_START */ && clientCode <= 800 /* CC_FRIENDS2_END */) {
      if (clientCode === 1 /* CC_FRIENDS_START */ && this.friendServerStatus === 0) {
        com.text = "Loading friend list";
        com.buttonType = 0;
      } else if (clientCode === 1 /* CC_FRIENDS_START */ && this.friendServerStatus === 1) {
        com.text = "Connecting to friendserver";
        com.buttonType = 0;
      } else if (clientCode === 2 && this.friendServerStatus !== 2) {
        com.text = "Please wait...";
        com.buttonType = 0;
      } else {
        let count = this.friendCount;
        if (this.friendServerStatus != 2) {
          count = 0;
        }
        if (clientCode > 700) {
          clientCode -= 601;
        } else {
          clientCode -= 1;
        }
        if (clientCode >= count) {
          com.text = "";
          com.buttonType = 0;
        } else {
          com.text = this.friendUsername[clientCode];
          com.buttonType = 1;
        }
      }
    } else if (clientCode >= 101 /* CC_FRIENDS_UPDATE_START */ && clientCode <= 200 /* CC_FRIENDS_UPDATE_END */ || clientCode >= 801 /* CC_FRIENDS2_UPDATE_START */ && clientCode <= 900 /* CC_FRIENDS2_UPDATE_END */) {
      let count = this.friendCount;
      if (this.friendServerStatus != 2) {
        count = 0;
      }
      if (clientCode > 800) {
        clientCode -= 701;
      } else {
        clientCode -= 101;
      }
      if (clientCode >= count) {
        com.text = "";
        com.buttonType = 0;
      } else {
        if (this.friendNodeId[clientCode] === 0) {
          com.text = "@red@Offline";
        } else if (this.friendNodeId[clientCode] === Client.nodeId) {
          com.text = "@gre@World-" + (this.friendNodeId[clientCode] - 9);
        } else {
          com.text = "@yel@World-" + (this.friendNodeId[clientCode] - 9);
        }
        com.buttonType = 1;
      }
    } else if (clientCode === 203 /* CC_FRIENDS_SIZE */) {
      let count = this.friendCount;
      if (this.friendServerStatus != 2) {
        count = 0;
      }
      com.scrollHeight = count * 15 + 20;
      if (com.scrollHeight <= com.height) {
        com.scrollHeight = com.height + 1;
      }
    } else if (clientCode >= 401 /* CC_IGNORES_START */ && clientCode <= 500 /* CC_IGNORES_END */) {
      clientCode -= 401 /* CC_IGNORES_START */;
      if (clientCode >= this.ignoreCount) {
        com.text = "";
        com.buttonType = 0;
      } else {
        com.text = JString.toScreenName(JString.toRawUsername(this.ignoreUserhash[clientCode]));
        com.buttonType = 1;
      }
    } else if (clientCode === 503 /* CC_IGNORES_SIZE */) {
      com.scrollHeight = this.ignoreCount * 15 + 20;
      if (com.scrollHeight <= com.height) {
        com.scrollHeight = com.height + 1;
      }
    } else if (clientCode === 327 /* CC_DESIGN_PREVIEW */) {
      com.modelXAn = 150;
      com.modelYAn = (Math.sin(this.loopCycle / 40) * 256 | 0) & 2047;
      if (this.idkDesignRedraw) {
        for (let i2 = 0;i2 < 7; i2++) {
          const kit = this.idkDesignPart[i2];
          if (kit >= 0 && !IdkType.list[kit].checkModel()) {
            return;
          }
        }
        this.idkDesignRedraw = false;
        const models = new TypedArray1d(7, null);
        let modelCount = 0;
        for (let part = 0;part < 7; part++) {
          const kit = this.idkDesignPart[part];
          if (kit >= 0) {
            models[modelCount++] = IdkType.list[kit].getModelNoCheck();
          }
        }
        const model = Model.combineForAnim(models, modelCount);
        for (let part = 0;part < 5; part++) {
          if (this.idkDesignColour[part] !== 0) {
            model.recolour(ClientPlayer.recol1d[part][0], ClientPlayer.recol1d[part][this.idkDesignColour[part]]);
            if (part === 1) {
              model.recolour(ClientPlayer.recol2d[0], ClientPlayer.recol2d[this.idkDesignColour[part]]);
            }
          }
        }
        model.prepareAnim();
        model.calculateNormals(64, 850, -30, -50, -30, true);
        if (this.localPlayer) {
          const frames = SeqType.list[this.localPlayer.readyanim].frames;
          if (frames) {
            model.animate(frames[0]);
          }
        }
        com.model1Type = 5;
        com.model1Id = 0;
        IfType.cacheModel(model, 5, 0);
      }
    } else if (clientCode === 324 /* CC_SWITCH_TO_MALE */) {
      if (!this.idkDesignButton1) {
        this.idkDesignButton1 = com.graphic;
        this.idkDesignButton2 = com.graphic2;
      }
      if (this.idkDesignGender) {
        com.graphic = this.idkDesignButton2;
      } else {
        com.graphic = this.idkDesignButton1;
      }
    } else if (clientCode === 325 /* CC_SWITCH_TO_FEMALE */) {
      if (!this.idkDesignButton1) {
        this.idkDesignButton1 = com.graphic;
        this.idkDesignButton2 = com.graphic2;
      }
      if (this.idkDesignGender) {
        com.graphic = this.idkDesignButton1;
      } else {
        com.graphic = this.idkDesignButton2;
      }
    } else if (clientCode === 600 /* CC_REPORT_INPUT */) {
      com.text = this.reportAbuseInput;
      if (this.loopCycle % 20 < 10) {
        com.text = com.text + "|";
      } else {
        com.text = com.text + " ";
      }
    } else if (clientCode === 613 /* CC_MOD_MUTE */) {
      if (this.staffmodlevel < 1) {
        com.text = "";
      } else if (this.reportAbuseMuteOption) {
        com.colour = 16711680 /* RED */;
        com.text = "Moderator option: Mute player for 48 hours: <ON>";
      } else {
        com.colour = 16777215 /* WHITE */;
        com.text = "Moderator option: Mute player for 48 hours: <OFF>";
      }
    } else if (clientCode === 650 /* CC_LAST_LOGIN_INFO */ || clientCode === 655 /* CC_LAST_LOGIN_INFO2 */) {
      if (this.lastAddress === 0) {
        com.text = "";
      } else {
        let text;
        if (this.daysSinceLastLogin === 0) {
          text = "earlier today";
        } else if (this.daysSinceLastLogin === 1) {
          text = "yesterday";
        } else {
          text = this.daysSinceLastLogin + " days ago";
        }
        const ipStr = JString.formatIPv4(this.lastAddress);
        com.text = "You last logged in " + text + (ipStr === "127.0.0.1" ? "." : " from: " + ipStr);
      }
    } else if (clientCode === 651 /* CC_UNREAD_MESSAGES */) {
      if (this.unreadMessages === 0) {
        com.text = "0 unread messages";
        com.colour = 16776960 /* YELLOW */;
      } else if (this.unreadMessages === 1) {
        com.text = "1 unread message";
        com.colour = 65280 /* GREEN */;
      } else if (this.unreadMessages > 1) {
        com.text = this.unreadMessages + " unread messages";
        com.colour = 65280 /* GREEN */;
      }
    } else if (clientCode === 652 /* CC_RECOVERY1 */) {
      if (this.daysSinceRecoveriesChanged === 201) {
        if (this.warnMembersInNonMembers == 1) {
          com.text = "@yel@This is a non-members world: @whi@Since you are a member we";
        } else {
          com.text = "";
        }
      } else if (this.daysSinceRecoveriesChanged === 200) {
        com.text = "You have not yet set any password recovery questions.";
      } else {
        let text;
        if (this.daysSinceRecoveriesChanged === 0) {
          text = "Earlier today";
        } else if (this.daysSinceRecoveriesChanged === 1) {
          text = "Yesterday";
        } else {
          text = this.daysSinceRecoveriesChanged + " days ago";
        }
        com.text = text + " you changed your recovery questions";
      }
    } else if (clientCode === 653 /* CC_RECOVERY2 */) {
      if (this.daysSinceRecoveriesChanged === 201) {
        if (this.warnMembersInNonMembers == 1) {
          com.text = "@whi@recommend you use a members world instead. You may use";
        } else {
          com.text = "";
        }
      } else if (this.daysSinceRecoveriesChanged === 200) {
        com.text = "We strongly recommend you do so now to secure your account.";
      } else {
        com.text = "If you do not remember making this change then cancel it immediately";
      }
    } else if (clientCode === 654 /* CC_RECOVERY3 */) {
      if (this.daysSinceRecoveriesChanged === 201) {
        if (this.warnMembersInNonMembers == 1) {
          com.text = "@whi@this world but member benefits are unavailable whilst here.";
        } else {
          com.text = "";
        }
      } else if (this.daysSinceRecoveriesChanged === 200) {
        com.text = "Do this from the 'account management' area on our front webpage";
      } else {
        com.text = "Do this from the 'account management' area on our front webpage";
      }
    }
  }
  closeModal() {
    this.out.pIsaac(58 /* CLOSE_MODAL */);
    if (this.sideModalId !== -1) {
      this.sideModalId = -1;
      this.redrawSidebar = true;
      this.resumedPauseButton = false;
      this.redrawSideicons = true;
    }
    if (this.chatComId !== -1) {
      this.chatComId = -1;
      this.redrawChatback = true;
      this.resumedPauseButton = false;
    }
    this.mainModalId = -1;
  }
  clientButton(com) {
    const clientCode = com.clientCode;
    if (this.friendServerStatus === 2) {
      if (clientCode === 201 /* CC_ADD_FRIEND */) {
        this.redrawChatback = true;
        this.dialogInputOpen = false;
        this.socialInputOpen = true;
        this.socialInput = "";
        this.socialInputType = 1;
        this.socialInputHeader = "Enter name of friend to add to list";
      } else if (clientCode === 202 /* CC_DEL_FRIEND */) {
        this.redrawChatback = true;
        this.dialogInputOpen = false;
        this.socialInputOpen = true;
        this.socialInput = "";
        this.socialInputType = 2;
        this.socialInputHeader = "Enter name of friend to delete from list";
      }
    }
    if (clientCode === 205 /* CC_LOGOUT */) {
      this.logoutTimer = 250;
      return true;
    } else if (clientCode === 501 /* CC_ADD_IGNORE */) {
      this.redrawChatback = true;
      this.dialogInputOpen = false;
      this.socialInputOpen = true;
      this.socialInput = "";
      this.socialInputType = 4;
      this.socialInputHeader = "Enter name of player to add to list";
    } else if (clientCode === 502 /* CC_DEL_IGNORE */) {
      this.redrawChatback = true;
      this.dialogInputOpen = false;
      this.socialInputOpen = true;
      this.socialInput = "";
      this.socialInputType = 5;
      this.socialInputHeader = "Enter name of player to delete from list";
    } else if (clientCode >= 300 /* CC_CHANGE_HEAD_L */ && clientCode <= 313 /* CC_CHANGE_FEET_R */) {
      const part = (clientCode - 300) / 2 | 0;
      const direction = clientCode & 1;
      let kit = this.idkDesignPart[part];
      if (kit !== -1) {
        while (true) {
          if (direction === 0) {
            kit--;
            if (kit < 0) {
              kit = IdkType.numDefinitions - 1;
            }
          }
          if (direction === 1) {
            kit++;
            if (kit >= IdkType.numDefinitions) {
              kit = 0;
            }
          }
          if (!IdkType.list[kit].disable && IdkType.list[kit].part === part + (this.idkDesignGender ? 0 : 7)) {
            this.idkDesignPart[part] = kit;
            this.idkDesignRedraw = true;
            break;
          }
        }
      }
    } else if (clientCode >= 314 /* CC_RECOLOUR_HAIR_L */ && clientCode <= 323 /* CC_RECOLOUR_SKIN_R */) {
      const part = (clientCode - 314) / 2 | 0;
      const direction = clientCode & 1;
      let colour = this.idkDesignColour[part];
      if (direction === 0) {
        colour--;
        if (colour < 0) {
          colour = ClientPlayer.recol1d[part].length - 1;
        }
      }
      if (direction === 1) {
        colour++;
        if (colour >= ClientPlayer.recol1d[part].length) {
          colour = 0;
        }
      }
      this.idkDesignColour[part] = colour;
      this.idkDesignRedraw = true;
    } else if (clientCode === 324 /* CC_SWITCH_TO_MALE */ && !this.idkDesignGender) {
      this.idkDesignGender = true;
      this.validateIdkDesign();
    } else if (clientCode === 325 /* CC_SWITCH_TO_FEMALE */ && this.idkDesignGender) {
      this.idkDesignGender = false;
      this.validateIdkDesign();
    } else if (clientCode === 326 /* CC_ACCEPT_DESIGN */) {
      this.out.pIsaac(13 /* IDK_SAVEDESIGN */);
      this.out.p1(this.idkDesignGender ? 0 : 1);
      for (let i2 = 0;i2 < 7; i2++) {
        this.out.p1(this.idkDesignPart[i2]);
      }
      for (let i2 = 0;i2 < 5; i2++) {
        this.out.p1(this.idkDesignColour[i2]);
      }
      return true;
    } else if (clientCode === 613 /* CC_MOD_MUTE */) {
      this.reportAbuseMuteOption = !this.reportAbuseMuteOption;
    } else if (clientCode >= 601 /* CC_REPORT_RULE1 */ && clientCode <= 612 /* CC_REPORT_RULE12 */) {
      this.closeModal();
      if (this.reportAbuseInput.length > 0) {
        this.out.pIsaac(203 /* SEND_SNAPSHOT */);
        this.out.p8(JString.toUserhash(this.reportAbuseInput));
        this.out.p1(clientCode - 601);
        this.out.p1(this.reportAbuseMuteOption ? 1 : 0);
      }
    }
    return false;
  }
  validateIdkDesign() {
    this.idkDesignRedraw = true;
    for (let i2 = 0;i2 < 7; i2++) {
      this.idkDesignPart[i2] = -1;
      for (let j = 0;j < IdkType.numDefinitions; j++) {
        if (!IdkType.list[j].disable && IdkType.list[j].part === i2 + (this.idkDesignGender ? 0 : 7)) {
          this.idkDesignPart[i2] = j;
          break;
        }
      }
    }
  }
  drawSidebar() {
    this.areaSidebar?.setPixels();
    if (this.sidebarScanline) {
      Pix3D.scanline = this.sidebarScanline;
    }
    this.invback?.plotSprite(0, 0);
    if (this.sideModalId !== -1) {
      this.drawInterface(IfType.list[this.sideModalId], 0, 0, 0);
    } else if (this.sideOverlayId[this.sideTab] !== -1) {
      this.drawInterface(IfType.list[this.sideOverlayId[this.sideTab]], 0, 0, 0);
    }
    if (this.isMenuOpen && this.menuArea === 1) {
      this.drawMinimenu();
    }
    this.areaSidebar?.draw(553, 205);
    this.areaViewport?.setPixels();
    if (this.viewportScanline) {
      Pix3D.scanline = this.viewportScanline;
    }
  }
  drawChat() {
    this.areaChatback?.setPixels();
    if (this.chatbackScanline) {
      Pix3D.scanline = this.chatbackScanline;
    }
    this.chatback?.plotSprite(0, 0);
    if (this.socialInputOpen) {
      this.b12?.centreString(this.socialInputHeader, 239, 40, 0 /* BLACK */);
      this.b12?.centreString(this.socialInput + "*", 239, 60, 128 /* DARKBLUE */);
    } else if (this.dialogInputOpen) {
      this.b12?.centreString("Enter amount:", 239, 40, 0 /* BLACK */);
      this.b12?.centreString(this.dialogInput + "*", 239, 60, 128 /* DARKBLUE */);
    } else if (this.tutComMessage) {
      this.b12?.centreString(this.tutComMessage, 239, 40, 0 /* BLACK */);
      this.b12?.centreString("Click to continue", 239, 60, 128 /* DARKBLUE */);
    } else if (this.chatComId !== -1) {
      this.drawInterface(IfType.list[this.chatComId], 0, 0, 0);
    } else if (this.tutComId !== -1) {
      this.drawInterface(IfType.list[this.tutComId], 0, 0, 0);
    } else {
      const font = this.p12;
      let line = 0;
      Pix2D.setClipping(0, 0, 463, 77);
      for (let i2 = 0;i2 < 100; i2++) {
        const message = this.chatText[i2];
        if (!message) {
          continue;
        }
        const type = this.chatType[i2];
        const y = this.chatScrollPos + 70 - line * 14;
        let sender = this.chatUsername[i2];
        let modlevel = 0;
        if (sender && sender.startsWith("@cr1@")) {
          sender = sender.substring(5);
          modlevel = 1;
        } else if (sender && sender.startsWith("@cr2@")) {
          sender = sender.substring(5);
          modlevel = 2;
        }
        if (type === 0) {
          if (y > 0 && y < 110) {
            font?.drawString(message, 4, y, 0 /* BLACK */);
          }
          line++;
        } else if ((type === 1 || type === 2) && (type === 1 || this.chatPublicMode === 0 || this.chatPublicMode === 1 && this.isFriend(sender))) {
          if (y > 0 && y < 110) {
            let x2 = 4;
            if (modlevel == 1) {
              this.modIcons[0].plotSprite(x2, y - 12);
              x2 += 14;
            } else if (modlevel == 2) {
              this.modIcons[1].plotSprite(x2, y - 12);
              x2 += 14;
            }
            font?.drawString(sender + ":", x2, y, 0 /* BLACK */);
            x2 += (font?.stringWid(sender) ?? 0) + 8;
            font?.drawString(message, x2, y, 255 /* BLUE */);
          }
          line++;
        } else if ((type === 3 || type === 7) && this.splitPrivateChat === 0 && (type === 7 || this.chatPrivateMode === 0 || this.chatPrivateMode === 1 && this.isFriend(sender))) {
          if (y > 0 && y < 110) {
            let x2 = 4;
            font?.drawString("From ", x2, y, 0 /* BLACK */);
            x2 += font?.stringWid("From ") ?? 0;
            if (modlevel == 1) {
              this.modIcons[0].plotSprite(x2, y - 12);
              x2 += 14;
            } else if (modlevel == 2) {
              this.modIcons[1].plotSprite(x2, y - 12);
              x2 += 14;
            }
            font?.drawString(sender + ":", x2, y, 0 /* BLACK */);
            x2 += (font?.stringWid(sender) ?? 0) + 8;
            font?.drawString(message, x2, y, 8388608 /* DARKRED */);
          }
          line++;
        } else if (type === 4 && (this.chatTradeMode === 0 || this.chatTradeMode === 1 && this.isFriend(sender))) {
          if (y > 0 && y < 110) {
            font?.drawString(sender + " " + this.chatText[i2], 4, y, 8388736);
          }
          line++;
        } else if (type === 5 && this.splitPrivateChat === 0 && this.chatPrivateMode < 2) {
          if (y > 0 && y < 110) {
            font?.drawString(message, 4, y, 8388608 /* DARKRED */);
          }
          line++;
        } else if (type === 6 && this.splitPrivateChat === 0 && this.chatPrivateMode < 2) {
          if (y > 0 && y < 110) {
            font?.drawString("To " + sender + ":", 4, y, 0 /* BLACK */);
            font?.drawString(message, font.stringWid("To " + sender) + 12, y, 8388608 /* DARKRED */);
          }
          line++;
        } else if (type === 8 && (this.chatTradeMode === 0 || this.chatTradeMode === 1 && this.isFriend(sender))) {
          if (y > 0 && y < 110) {
            font?.drawString(sender + " " + this.chatText[i2], 4, y, 8270336);
          }
          line++;
        }
      }
      Pix2D.resetClipping();
      this.chatScrollHeight = line * 14 + 7;
      if (this.chatScrollHeight < 78) {
        this.chatScrollHeight = 78;
      }
      this.drawScrollbar(463, 0, this.chatScrollHeight - this.chatScrollPos - 77, this.chatScrollHeight, 77);
      let username;
      if (this.localPlayer == null || this.localPlayer.name == null) {
        username = JString.toScreenName(this.loginUser);
      } else {
        username = this.localPlayer.name;
      }
      font?.drawString(username + ":", 4, 90, 0 /* BLACK */);
      font?.drawString(this.chatInput + "*", font.stringWid(username + ": ") + 6, 90, 255 /* BLUE */);
      Pix2D.hline(0, 77, 479, 0 /* BLACK */);
    }
    if (this.isMenuOpen && this.menuArea === 2) {
      this.drawMinimenu();
    }
    this.areaChatback?.draw(17, 357);
    this.areaViewport?.setPixels();
    if (this.viewportScanline) {
      Pix3D.scanline = this.viewportScanline;
    }
  }
  minimapDraw() {
    if (!this.localPlayer) {
      return;
    }
    this.areaMapback?.setPixels();
    const angle = this.orbitCameraYaw + this.macroMinimapAngle & 2047;
    let anchorX = (this.localPlayer.x / 32 | 0) + 48;
    let anchorY = 464 - (this.localPlayer.z / 32 | 0);
    this.minimap?.scanlineRotatePlotSprite(25, 5, 146, 151, anchorX, anchorY, angle, this.macroMinimapZoom + 256, this.minimapMaskLineOffsets, this.minimapMaskLineLengths);
    this.compass?.scanlineRotatePlotSprite(0, 0, 33, 33, 25, 25, this.orbitCameraYaw, 256, this.compassMaskLineOffsets, this.compassMaskLineLengths);
    for (let i2 = 0;i2 < this.activeMapFunctionCount; i2++) {
      anchorX = this.activeMapFunctionX[i2] * 4 + 2 - (this.localPlayer.x / 32 | 0);
      anchorY = this.activeMapFunctionZ[i2] * 4 + 2 - (this.localPlayer.z / 32 | 0);
      this.minimapDrawDot(anchorY, this.activeMapFunctions[i2], anchorX);
    }
    for (let ltx = 0;ltx < 104 /* SIZE */; ltx++) {
      for (let ltz = 0;ltz < 104 /* SIZE */; ltz++) {
        const objs = this.groundObj[this.minusedlevel][ltx][ltz];
        if (objs) {
          anchorX = ltx * 4 + 2 - (this.localPlayer.x / 32 | 0);
          anchorY = ltz * 4 + 2 - (this.localPlayer.z / 32 | 0);
          this.minimapDrawDot(anchorY, this.mapdots1, anchorX);
        }
      }
    }
    for (let i2 = 0;i2 < this.npcCount; i2++) {
      const npc = this.npc[this.npcIds[i2]];
      if (npc && npc.isReady() && npc.type && npc.type.minimap) {
        anchorX = (npc.x / 32 | 0) - (this.localPlayer.x / 32 | 0);
        anchorY = (npc.z / 32 | 0) - (this.localPlayer.z / 32 | 0);
        this.minimapDrawDot(anchorY, this.mapdots2, anchorX);
      }
    }
    for (let i2 = 0;i2 < this.playerCount; i2++) {
      const player = this.players[this.playerIds[i2]];
      if (player && player.isReady() && player.name) {
        anchorX = (player.x / 32 | 0) - (this.localPlayer.x / 32 | 0);
        anchorY = (player.z / 32 | 0) - (this.localPlayer.z / 32 | 0);
        let friend = false;
        const userhash = JString.toUserhash(player.name);
        for (let j = 0;j < this.friendCount; j++) {
          if (userhash === this.friendUserhash[j] && this.friendNodeId[j] !== 0) {
            friend = true;
            break;
          }
        }
        if (friend) {
          this.minimapDrawDot(anchorY, this.mapdots4, anchorX);
        } else {
          this.minimapDrawDot(anchorY, this.mapdots3, anchorX);
        }
      }
    }
    if (this.hintType != 0 && this.loopCycle % 20 < 10) {
      if (this.hintType == 1 && this.hintNpc >= 0 && this.hintNpc < this.npc.length) {
        const npc = this.npc[this.hintNpc];
        if (npc != null) {
          const x2 = (npc.x / 32 | 0) - (this.localPlayer.x / 32 | 0);
          const y = (npc.z / 32 | 0) - (this.localPlayer.z / 32 | 0);
          this.minimapDrawArrow(x2, y, this.mapmarker2);
        }
      } else if (this.hintType == 2) {
        const x2 = (this.hintTileX - this.mapBuildBaseX) * 4 + 2 - (this.localPlayer.x / 32 | 0);
        const y = (this.hintTileZ - this.mapBuildBaseZ) * 4 + 2 - (this.localPlayer.z / 32 | 0);
        this.minimapDrawArrow(x2, y, this.mapmarker2);
      } else if (this.hintType == 10 && this.hintPlayer >= 0 && this.hintPlayer < this.players.length) {
        const player = this.players[this.hintPlayer];
        if (player != null) {
          const x2 = (player.x / 32 | 0) - (this.localPlayer.x / 32 | 0);
          const y = (player.z / 32 | 0) - (this.localPlayer.z / 32 | 0);
          this.minimapDrawArrow(x2, y, this.mapmarker2);
        }
      }
    }
    if (this.minimapFlagX !== 0) {
      anchorX = this.minimapFlagX * 4 + 2 - (this.localPlayer.x / 32 | 0);
      anchorY = this.minimapFlagZ * 4 + 2 - (this.localPlayer.z / 32 | 0);
      this.minimapDrawDot(anchorY, this.mapmarker1, anchorX);
    }
    Pix2D.fillRect(97, 78, 3, 3, 16777215 /* WHITE */);
    this.areaViewport?.setPixels();
  }
  minimapDrawArrow(dx, dy, image) {
    if (!image) {
      return;
    }
    const distance = dx * dx + dy * dy;
    if (distance <= 4225 || distance >= 90000) {
      this.minimapDrawDot(dy, image, dx);
      return;
    }
    const angle = this.orbitCameraYaw + this.macroMinimapAngle & 2047;
    let sinAngle = Pix3D.sinTable[angle];
    let cosAngle = Pix3D.cosTable[angle];
    sinAngle = sinAngle * 256 / (this.macroMinimapZoom + 256) | 0;
    cosAngle = cosAngle * 256 / (this.macroMinimapZoom + 256) | 0;
    const x2 = dy * sinAngle + dx * cosAngle >> 16;
    const y = dy * cosAngle - dx * sinAngle >> 16;
    const var13 = Math.atan2(x2, y);
    const var15 = Math.sin(var13) * 63 | 0;
    const var16 = Math.cos(var13) * 57 | 0;
    this.mapedge?.rotatePlotSprite(var15 + 94 + 4 - 10, 83 - var16 - 20, 20, 20, 15, 15, var13, 256);
  }
  minimapDrawDot(dy, image, dx) {
    if (!image) {
      return;
    }
    const distance = dx * dx + dy * dy;
    if (distance > 6400) {
      return;
    }
    const angle = this.orbitCameraYaw + this.macroMinimapAngle & 2047;
    let sinAngle = Pix3D.sinTable[angle];
    let cosAngle = Pix3D.cosTable[angle];
    sinAngle = sinAngle * 256 / (this.macroMinimapZoom + 256) | 0;
    cosAngle = cosAngle * 256 / (this.macroMinimapZoom + 256) | 0;
    const x2 = dy * sinAngle + dx * cosAngle >> 16;
    const y = dy * cosAngle - dx * sinAngle >> 16;
    if (distance > 2500 && this.mapback) {
      image.scanlinePlotSprite(this.mapback, x2 + 94 - (image.owi / 2 | 0) + 4, 83 - y - (image.ohi / 2 | 0) - 4);
    } else {
      image.plotSprite(x2 + 94 - (image.owi / 2 | 0) + 4, 83 - y - (image.ohi / 2 | 0) - 4);
    }
  }
  addChat(type, text, sender) {
    if (type === 0 && this.tutComId !== -1) {
      this.tutComMessage = text;
      this.mouseClickButton = 0;
    }
    if (this.chatComId === -1) {
      this.redrawChatback = true;
    }
    for (let i2 = 99;i2 > 0; i2--) {
      this.chatType[i2] = this.chatType[i2 - 1];
      this.chatUsername[i2] = this.chatUsername[i2 - 1];
      this.chatText[i2] = this.chatText[i2 - 1];
    }
    this.chatType[0] = type;
    this.chatUsername[0] = sender;
    this.chatText[0] = text;
  }
  isFriend(username) {
    if (!username) {
      return false;
    }
    for (let i2 = 0;i2 < this.friendCount; i2++) {
      if (username.toLowerCase() === this.friendUsername[i2]?.toLowerCase()) {
        return true;
      }
    }
    if (!this.localPlayer) {
      return false;
    }
    return username.toLowerCase() === this.localPlayer.name?.toLowerCase();
  }
  addFriend(userhash) {
    if (userhash === 0n) {
      return;
    }
    if (this.friendCount >= 100 && this.membersAccount != 1) {
      this.addChat(0, "Your friendlist is full. Max of 100 for free users, and 200 for members", "");
      return;
    } else if (this.friendCount >= 200) {
      this.addChat(0, "Your friendlist is full. Max of 100 for free users, and 200 for members", "");
      return;
    }
    const displayName = JString.toScreenName(JString.toRawUsername(userhash));
    for (let i2 = 0;i2 < this.friendCount; i2++) {
      if (this.friendUserhash[i2] === userhash) {
        this.addChat(0, displayName + " is already on your friend list", "");
        return;
      }
    }
    for (let i2 = 0;i2 < this.ignoreCount; i2++) {
      if (this.ignoreUserhash[i2] === userhash) {
        this.addChat(0, "Please remove " + displayName + " from your ignore list first", "");
        return;
      }
    }
    if (!this.localPlayer || !this.localPlayer.name) {
      return;
    }
    if (displayName !== this.localPlayer.name) {
      this.friendUsername[this.friendCount] = displayName;
      this.friendUserhash[this.friendCount] = userhash;
      this.friendNodeId[this.friendCount] = 0;
      this.friendCount++;
      this.redrawSidebar = true;
      this.out.pIsaac(9 /* FRIENDLIST_ADD */);
      this.out.p8(userhash);
    }
  }
  addIgnore(userhash) {
    if (userhash === 0n) {
      return;
    }
    if (this.ignoreCount >= 100) {
      this.addChat(0, "Your ignore list is full. Max of 100 hit", "");
      return;
    }
    const displayName = JString.toScreenName(JString.toRawUsername(userhash));
    for (let i2 = 0;i2 < this.ignoreCount; i2++) {
      if (this.ignoreUserhash[i2] === userhash) {
        this.addChat(0, displayName + " is already on your ignore list", "");
        return;
      }
    }
    for (let i2 = 0;i2 < this.friendCount; i2++) {
      if (this.friendUserhash[i2] === userhash) {
        this.addChat(0, "Please remove " + displayName + " from your friend list first", "");
        return;
      }
    }
    this.ignoreUserhash[this.ignoreCount++] = userhash;
    this.redrawSidebar = true;
    this.out.pIsaac(189 /* IGNORELIST_ADD */);
    this.out.p8(userhash);
  }
  delFriend(userhash) {
    if (userhash === 0n) {
      return;
    }
    for (let i2 = 0;i2 < this.friendCount; i2++) {
      if (this.friendUserhash[i2] === userhash) {
        this.friendCount--;
        this.redrawSidebar = true;
        for (let j = i2;j < this.friendCount; j++) {
          this.friendUsername[j] = this.friendUsername[j + 1];
          this.friendNodeId[j] = this.friendNodeId[j + 1];
          this.friendUserhash[j] = this.friendUserhash[j + 1];
        }
        this.out.pIsaac(84 /* FRIENDLIST_DEL */);
        this.out.p8(userhash);
        return;
      }
    }
  }
  delIgnore(userhash) {
    if (userhash === 0n) {
      return;
    }
    for (let i2 = 0;i2 < this.ignoreCount; i2++) {
      if (this.ignoreUserhash[i2] === userhash) {
        this.ignoreCount--;
        this.redrawSidebar = true;
        for (let j = i2;j < this.ignoreCount; j++) {
          this.ignoreUserhash[j] = this.ignoreUserhash[j + 1];
        }
        this.out.pIsaac(193 /* IGNORELIST_DEL */);
        this.out.p8(userhash);
        return;
      }
    }
  }
  startedInViewport = false;
  startedInTabArea = false;
  startedInChatScroll = false;
  ttime = -1;
  sx = 0;
  sy = 0;
  mx = 0;
  my = 0;
  nx = 0;
  ny = 0;
  dragging = false;
  panning = false;
  pointerDown(x2, y, e) {
    if (MobileKeyboard_default.isWithinCanvasKeyboard(x2, y) && !this.exceedsGrabThreshold(20)) {
      MobileKeyboard_default.captureMouseDown(x2, y);
      return;
    }
    if (e.pointerType !== "mouse") {
      this.idleTimer = performance.now();
      this.nextMouseClickX = -1;
      this.nextMouseClickY = -1;
      this.nextMouseClickButton = 0;
      this.mouseX = x2;
      this.mouseY = y;
      this.mouseButton = 0;
      this.sx = this.nx = this.mx = e.screenX | 0;
      this.sy = this.ny = this.my = e.screenY | 0;
      this.ttime = e.timeStamp;
      this.startedInViewport = this.insideViewportArea();
      this.startedInTabArea = this.insideTabArea();
      this.startedInChatScroll = this.insideChatScrollArea();
    }
  }
  mouseUp(x2, y, e) {
    this.idleTimer = performance.now();
    this.mouseButton = 0;
    if (InputTracking.active) {
      InputTracking.mouseReleased(e.button, "mouse");
    }
    this.mouseX = x2;
    this.mouseY = y;
  }
  pointerUp(x2, y, e) {
    if (MobileKeyboard_default.isWithinCanvasKeyboard(x2, y) && !this.exceedsGrabThreshold(20)) {
      MobileKeyboard_default.captureMouseUp(x2, y);
      return;
    }
    if (e.pointerType !== "mouse") {
      this.idleTimer = performance.now();
      this.mouseX = x2;
      this.mouseY = y;
      if (this.dragging) {
        this.dragging = false;
        this.nextMouseClickX = -1;
        this.nextMouseClickY = -1;
        this.nextMouseClickButton = 0;
        this.mouseButton = 0;
        if (InputTracking.active) {
          InputTracking.mouseReleased(0, e.pointerType);
        }
      } else if (this.panning) {
        this.panning = false;
        this.keyHeld[1] = 0;
        this.keyHeld[2] = 0;
        this.keyHeld[3] = 0;
        this.keyHeld[4] = 0;
        return;
      } else {
        if (!MobileKeyboard_default.isDisplayed() && this.insideMobileInputArea()) {
          MobileKeyboard_default.show(x2, y, e.clientX, e.clientY);
        } else if (MobileKeyboard_default.isDisplayed() && !MobileKeyboard_default.isWithinCanvasKeyboard(x2, y)) {
          MobileKeyboard_default.hide();
          this.refresh();
        }
        this.nextMouseClickX = x2;
        this.nextMouseClickY = y;
        this.nextMouseClickTime = performance.now();
        const longPress = e.timeStamp >= this.ttime + 500;
        if (longPress) {
          this.nextMouseClickButton = 2;
          this.mouseButton = 2;
        } else {
          this.nextMouseClickButton = 1;
          this.mouseButton = 1;
        }
        if (InputTracking.active) {
          InputTracking.mousePressed(x2, y, longPress ? 2 : 0, e.pointerType);
        }
        setTimeout(() => {
          this.mouseButton = 0;
          if (InputTracking.active) {
            InputTracking.mouseReleased(longPress ? 2 : 0, e.pointerType);
          }
        }, 40);
      }
    }
  }
  pointerEnter(x2, y, e) {
    if (e.pointerType === "mouse") {
      this.mouseX = x2;
      this.mouseY = y;
      if (InputTracking.active) {
        InputTracking.mouseEntered();
      }
    } else {
      this.idleTimer = performance.now();
      this.nextMouseClickX = -1;
      this.nextMouseClickY = -1;
      this.nextMouseClickButton = 0;
      this.mouseX = x2;
      this.mouseY = y;
      this.mouseButton = 0;
      this.sx = this.nx = this.mx = e.screenX | 0;
      this.sy = this.ny = this.my = e.screenY | 0;
      this.ttime = e.timeStamp;
      this.startedInViewport = this.insideViewportArea();
      this.startedInTabArea = this.insideTabArea();
    }
  }
  pointerLeave(e) {
    if (e.pointerType === "mouse") {
      this.idleTimer = performance.now();
      this.mouseX = -1;
      this.mouseY = -1;
      if (InputTracking.active) {
        InputTracking.mouseExited();
      }
      this.nextMouseClickX = -1;
      this.nextMouseClickY = -1;
      this.nextMouseClickButton = 0;
      this.mouseButton = 0;
    } else {
      this.idleTimer = performance.now();
      this.keyHeld[1] = 0;
      this.keyHeld[2] = 0;
      this.keyHeld[3] = 0;
      this.keyHeld[4] = 0;
    }
  }
  pointerMove(x2, y, e) {
    if (e.pointerType === "mouse") {
      this.idleTimer = performance.now();
      this.mouseX = x2;
      this.mouseY = y;
      if (InputTracking.active) {
        InputTracking.mouseMoved(x2, y, e.pointerType);
      }
    } else {
      this.idleTimer = performance.now();
      this.mouseX = x2;
      this.mouseY = y;
      this.nx = e.screenX | 0;
      this.ny = e.screenY | 0;
      if (this.dragging) {} else if (MobileKeyboard_default.isWithinCanvasKeyboard(x2, y) && this.exceedsGrabThreshold(20)) {
        MobileKeyboard_default.notifyTouchMove(x2, y);
      } else if (this.startedInViewport && !this.isViewportObscured() && this.exceedsGrabThreshold(20)) {
        this.panning = true;
        if (this.mx - this.nx > 0) {
          this.keyHeld[1] = 0;
          this.keyHeld[2] = 1;
        } else if (this.mx - this.nx < 0) {
          this.keyHeld[1] = 1;
          this.keyHeld[2] = 0;
        }
        if (this.my - this.ny > 0) {
          this.keyHeld[3] = 0;
          this.keyHeld[4] = 1;
        } else if (this.my - this.ny < 0) {
          this.keyHeld[3] = 1;
          this.keyHeld[4] = 0;
        }
      } else if (this.startedInTabArea || this.startedInChatScroll || this.isViewportObscured()) {
        if (!this.dragging && this.exceedsGrabThreshold(5)) {
          this.dragging = true;
          this.nextMouseClickX = x2;
          this.nextMouseClickY = y;
          this.nextMouseClickButton = 1;
          this.mouseButton = 1;
        }
      }
      this.mx = this.nx;
      this.my = this.ny;
    }
  }
  touchStart(e) {
    if (e.touches.length < 2 || this.dragging) {
      e.preventDefault();
    }
  }
  exceedsGrabThreshold(size) {
    return Math.abs(this.sx - this.nx) > size || Math.abs(this.sy - this.ny) > size;
  }
  isViewportObscured() {
    return this.mainModalId !== -1;
  }
  insideMobileInputArea() {
    return this.insideChatInputArea() || this.insideChatPopupArea() || this.insideUsernameArea() || this.inPasswordArea() || this.insideReportInterfaceTextArea();
  }
  insideViewportArea() {
    const viewportAreaX1 = 4;
    const viewportAreaY1 = 4;
    const viewportAreaX2 = viewportAreaX1 + 512;
    const viewportAreaY2 = viewportAreaY1 + 334;
    return this.ingame && this.mouseX >= viewportAreaX1 && this.mouseX <= viewportAreaX2 && this.mouseY >= viewportAreaY1 && this.mouseY <= viewportAreaY2;
  }
  insideTabArea() {
    const tabAreaX1 = 553;
    const tabAreaY1 = 205;
    const tabAreaX2 = tabAreaX1 + 190;
    const tabAreaY2 = tabAreaY1 + 261;
    return this.ingame && this.mouseX >= tabAreaX1 && this.mouseX <= tabAreaX2 && this.mouseY >= tabAreaY1 && this.mouseY <= tabAreaY2;
  }
  insideChatScrollArea() {
    const chatInputAreaX1 = 480;
    const chatInputAreaY1 = 357;
    const chatInputAreaX2 = chatInputAreaX1 + 16;
    const chatInputAreaY2 = chatInputAreaY1 + 77;
    return this.ingame && !this.dialogInputOpen && !this.socialInputOpen && this.mouseX >= chatInputAreaX1 && this.mouseX <= chatInputAreaX2 && this.mouseY >= chatInputAreaY1 && this.mouseY <= chatInputAreaY2;
  }
  insideChatInputArea() {
    const chatInputAreaX1 = 17;
    const chatInputAreaY1 = 434;
    const chatInputAreaX2 = chatInputAreaX1 + 479;
    const chatInputAreaY2 = chatInputAreaY1 + 26;
    return this.ingame && this.chatComId === -1 && !this.dialogInputOpen && !this.socialInputOpen && this.mouseX >= chatInputAreaX1 && this.mouseX <= chatInputAreaX2 && this.mouseY >= chatInputAreaY1 && this.mouseY <= chatInputAreaY2;
  }
  insideChatPopupArea() {
    const chatInputAreaX1 = 17;
    const chatInputAreaY1 = 357;
    const chatInputAreaX2 = chatInputAreaX1 + 479;
    const chatInputAreaY2 = chatInputAreaY1 + 96;
    return this.ingame && (this.dialogInputOpen || this.socialInputOpen) && this.mouseX >= chatInputAreaX1 && this.mouseX <= chatInputAreaX2 && this.mouseY >= chatInputAreaY1 && this.mouseY <= chatInputAreaY2;
  }
  insideReportInterfaceTextArea() {
    if (!this.ingame) {
      return false;
    }
    if (this.mainModalId === -1 || this.reportAbuseComId === -1) {
      return false;
    }
    if (this.mainModalId !== this.reportAbuseComId) {
      return false;
    }
    const reportInputAreaX1 = 87;
    const reportInputAreaY1 = 119;
    const reportInputAreaX2 = reportInputAreaX1 + 348;
    const reportInputAreaY2 = reportInputAreaY1 + 37;
    return this.mouseX >= reportInputAreaX1 && this.mouseX <= reportInputAreaX2 && this.mouseY >= reportInputAreaY1 && this.mouseY <= reportInputAreaY2;
  }
  insideUsernameArea() {
    const usernameAreaX1 = 280;
    const usernameAreaY1 = 233;
    const usernameAreaX2 = usernameAreaX1 + 190;
    const usernameAreaY2 = usernameAreaY1 + 31;
    return !this.ingame && this.loginscreen === 2 && this.mouseX >= usernameAreaX1 && this.mouseX <= usernameAreaX2 && this.mouseY >= usernameAreaY1 && this.mouseY <= usernameAreaY2;
  }
  inPasswordArea() {
    const passwordAreaX1 = 280;
    const passwordAreaY1 = 264;
    const passwordAreaX2 = passwordAreaX1 + 278;
    const passwordAreaY2 = passwordAreaY1 + 20;
    return !this.ingame && this.loginscreen === 2 && this.mouseX >= passwordAreaX1 && this.mouseX <= passwordAreaX2 && this.mouseY >= passwordAreaY1 && this.mouseY <= passwordAreaY2;
  }
}
export {
  Client
};

//# debugId=BED669E187C2319464756E2164756E21
