// Lightweight audio manager built on expo-audio.
// Effects play one-shot; background music loops. All wrapped defensively so a
// missing/failed asset never crashes the puja experience.
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";

let initialised = false;
let soundOn = true;
let musicOn = true;

const effectPlayers: Record<string, AudioPlayer> = {};
let musicPlayer: AudioPlayer | null = null;
let musicUri: string | null = null;

async function ensureInit() {
  if (initialised) return;
  initialised = true;
  try {
    await setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: false });
  } catch {
    // ignore — playback still works in most cases
  }
}

export const audio = {
  setSoundOn(v: boolean) {
    soundOn = v;
  },
  setMusicOn(v: boolean) {
    musicOn = v;
    if (!v) this.stopMusic();
  },

  async playEffect(uri: string | null | undefined, volume = 1) {
    if (!uri || !soundOn) return;
    await ensureInit();
    try {
      let player = effectPlayers[uri];
      if (!player) {
        player = createAudioPlayer({ uri });
        effectPlayers[uri] = player;
      }
      player.volume = volume;
      player.seekTo(0);
      player.play();
    } catch {
      // ignore playback errors
    }
  },

  async startMusic(uri: string | null | undefined, volume = 0.5) {
    if (!uri || !musicOn) return;
    await ensureInit();
    try {
      if (musicPlayer && musicUri === uri) {
        musicPlayer.play();
        return;
      }
      this.stopMusic();
      musicPlayer = createAudioPlayer({ uri });
      musicUri = uri;
      musicPlayer.loop = true;
      musicPlayer.volume = volume;
      musicPlayer.play();
    } catch {
      // ignore
    }
  },

  stopMusic() {
    try {
      if (musicPlayer) {
        musicPlayer.pause();
        musicPlayer.remove();
      }
    } catch {
      // ignore
    }
    musicPlayer = null;
    musicUri = null;
  },
};
