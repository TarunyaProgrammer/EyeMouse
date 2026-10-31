export class CameraManager {
  private stream: MediaStream | null = null;
  private video: HTMLVideoElement | null = null;

  async requestAccess(): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error("This environment does not expose a compatible camera API.");
    }

    this.stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "user" },
      audio: false
    });
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
