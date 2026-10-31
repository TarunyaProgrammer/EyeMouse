export class CameraManager {
  private stream: MediaStream | null = null;

  async requestAccess(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This environment does not expose a compatible camera API.");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
  }

  release(): void {
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
  }
}
