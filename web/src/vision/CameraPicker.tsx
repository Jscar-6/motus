// Camera choice as a grey pill on the Session camera panel; the pick is remembered in this browser (camera.ts).
import { useEffect } from 'react';
import { chooseCamera, refreshCameras, useCamera } from './camera';

/** Dropdown of the connected cameras; hidden until there is more than one to choose from. */
export default function CameraPicker({ pillClass }: { pillClass: string }) {
  const devices = useCamera((s) => s.devices);
  const chosen = useCamera((s) => s.chosen);
  useEffect(() => {
    void refreshCameras().catch(() => undefined);
  }, []);
  if (devices.length < 2) return null;

  return (
    <label className={pillClass}>
      <span className="sr-only">Camera</span>
      <select
        value={chosen?.deviceId ?? ''}
        onChange={(e) => chooseCamera(e.target.value || null)}
        className="h-8 max-w-[11rem] cursor-pointer truncate rounded-full bg-transparent px-3 text-inherit outline-none"
      >
        <option value="" className="text-ink">Default camera</option>
        {devices.map((d, i) => (
          <option key={d.deviceId} value={d.deviceId} className="text-ink">{d.label || `Camera ${i + 1}`}</option>
        ))}
      </select>
    </label>
  );
}
