// Camera + hand tracker. The tracker loads as soon as the host screen opens (it's just
// code); the camera itself only turns on when the game starts, and off again in the lobby.
// Everything runs in this browser; video never leaves the laptop.
import { ref } from 'vue';
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';

export const cameraStream = ref(null);
export const cameraError = ref('');
export const trackerReady = ref(false);

// Served by our own server from node_modules / web/public: no internet needed.
const WASM = '/mediapipe/wasm';
const MODEL = '/models/hand_landmarker.task';

export const landmarker = (async () => {
  const t0 = performance.now();
  const fileset = await FilesetResolver.forVisionTasks(WASM);
  const lm = await HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL, delegate: 'GPU' },
    runningMode: 'VIDEO',
    numHands: 1,
  });
  console.log(`Hand tracker ready in ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  trackerReady.value = true;
  return lm;
})();
landmarker.catch((e) => (cameraError.value = 'Hand tracker failed to load: ' + e.message));

/** Turn the camera on (no-op if it already is, unless `force`: the "Try again" button). */
let starting = null;
export function startCamera(force = false) {
  if ((cameraStream.value || starting) && !force) return starting;
  cameraError.value = '';
  starting = (async () => {
    try {
      cameraStream.value?.getTracks().forEach((t) => t.stop());
      cameraStream.value = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
    } catch (e) {
      cameraError.value = e.name === 'NotAllowedError' ? 'Camera permission was denied.' : `Camera error: ${e.message}`;
    } finally {
      starting = null;
    }
  })();
  return starting;
}

export function stopCamera() {
  cameraStream.value?.getTracks().forEach((t) => t.stop());
  cameraStream.value = null;
  cameraError.value = '';
}
