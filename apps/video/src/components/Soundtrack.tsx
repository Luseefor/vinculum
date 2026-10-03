import React from "react";
import { Audio, staticFile } from "remotion";

interface SoundtrackProps {
  filename?: string;
  volume?: number;
}

export const Soundtrack: React.FC<SoundtrackProps> = ({
  filename = "audio/soundtrack.mp3",
  volume = 0.8,
}) => {
  // If the user places an audio file in apps/video/public/audio/soundtrack.mp3,
  // Remotion will effortlessly mix it into the final render.
  try {
    return <Audio src={staticFile(filename)} volume={volume} />;
  } catch {
    return null;
  }
};
