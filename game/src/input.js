// Keyboard and mouse controls, smoothed into stick, rudder and throttle inputs.
//   W/S or Up/Down: pitch   A/D or Left/Right: roll   Q/E: rudder   Shift/Ctrl (or R/F): throttle
//   B: brakes   C: cockpit/chase   P: pause   Mouse (click to capture): stick

export function createInput(target) {
  const keys = new Set();
  const mouse = { x: 0, y: 0, captured: false };
  const pressed = [];

  addEventListener('keydown', (e) => {
    if (!keys.has(e.code)) pressed.push(e.code);
    keys.add(e.code);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => keys.clear());
  target.addEventListener('click', () => target.requestPointerLock?.());
  document.addEventListener('pointerlockchange', () => {
    mouse.captured = document.pointerLockElement === target;
    mouse.x = mouse.y = 0;
  });
  addEventListener('mousemove', (e) => {
    if (!mouse.captured) return;
    mouse.x = Math.max(-1, Math.min(1, mouse.x + e.movementX / 300));
    mouse.y = Math.max(-1, Math.min(1, mouse.y + e.movementY / 300));
  });

  const stick = { pitch: 0, roll: 0, yaw: 0 };
  const any = (...codes) => codes.some((c) => keys.has(c));

  /** Read the controls for this frame; keys ease in so taps stay gentle at high speed. */
  function read(dt) {
    const kp = (any('KeyS', 'ArrowDown') ? 1 : 0) - (any('KeyW', 'ArrowUp') ? 1 : 0);
    const kr = (any('KeyD', 'ArrowRight') ? 1 : 0) - (any('KeyA', 'ArrowLeft') ? 1 : 0);
    const ky = (any('KeyE') ? 1 : 0) - (any('KeyQ') ? 1 : 0);
    const ease = Math.min(1, dt * 5);
    stick.pitch += (kp - stick.pitch) * ease;
    stick.roll += (kr - stick.roll) * ease;
    stick.yaw += (ky - stick.yaw) * ease;
    if (mouse.captured) {
      mouse.x *= 1 - dt * 0.8;
      mouse.y *= 1 - dt * 0.8;
    }
    const throttle = (any('ShiftLeft', 'ShiftRight', 'KeyR') ? 1 : 0) - (any('ControlLeft', 'ControlRight', 'KeyF') ? 1 : 0);
    return {
      pitch: clamp(stick.pitch - (mouse.captured ? mouse.y : 0)),
      roll: clamp(stick.roll + (mouse.captured ? mouse.x : 0)),
      yaw: stick.yaw,
      throttle,
      brake: any('KeyB', 'Space'),
    };
  }

  /** Keys pressed since the last call (for one-shot actions). */
  function takePresses() {
    return pressed.splice(0, pressed.length);
  }

  return { read, takePresses, mouse };
}

function clamp(v) {
  return Math.max(-1, Math.min(1, v));
}
