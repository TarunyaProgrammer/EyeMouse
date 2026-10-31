export interface CameraDevice {
  deviceId: string;
  label: string;
}

export class CameraManager {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;

  async listVideoInputs(): Promise<CameraDevice[]> {
    if (!navigator.mediaDevices?.enumerateDevices) return [];
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput").map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Camera ${index + 1}` }));
  }

  async requestAccess(deviceId: string | null = null, onEnded?: () => void): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This environment does not expose a compatible camera API.");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" },
      audio: false
    });
    for (const track of this.stream.getVideoTracks()) track.addEventListener("ended", () => onEnded?.(), { once: true });
    this.video = document.createElement("video");
    this.video.muted = true;
    this.video.autoplay = true;
    this.video.playsInline = true;
    this.video.srcObject = this.stream;
    await this.video.play();
  }

  getVideo(): HTMLVideoElement | null { return this.video; }

  release(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
    }
    this.video = null;
    this.stream = null;
  }
}
