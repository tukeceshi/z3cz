import {
  ALL_FORMATS,
  BlobSource,
  BufferTarget,
  EncodedAudioPacketSource,
  EncodedPacketSink,
  EncodedVideoPacketSource,
  Input,
  Mp4OutputFormat,
  Output,
} from "mediabunny";

export async function concatVideoBuffers(
  buffers: readonly ArrayBuffer[]
): Promise<ArrayBuffer> {
  if (buffers.length === 0) {
    throw new Error("concat_empty_input");
  }
  if (buffers.length === 1) {
    return buffers[0]!;
  }

  const firstInput = new Input({
    source: new BlobSource(new Blob([buffers[0]!])),
    formats: ALL_FORMATS,
  });
  const firstVideo = await firstInput.getPrimaryVideoTrack();
  const videoCodec = await firstVideo?.getCodec();
  if (!firstVideo || !videoCodec) {
    throw new Error("concat_no_video_track");
  }

  const output = new Output({
    format: new Mp4OutputFormat(),
    target: new BufferTarget(),
  });
  const videoSource = new EncodedVideoPacketSource(videoCodec);
  output.addVideoTrack(videoSource);

  const firstAudio = await firstInput.getPrimaryAudioTrack();
  const audioCodec = await firstAudio?.getCodec();
  const audioSource = firstAudio && audioCodec
    ? new EncodedAudioPacketSource(audioCodec)
    : null;
  if (audioSource) {
    output.addAudioTrack(audioSource);
  }

  const videoDecoderConfig = await firstVideo.getDecoderConfig();
  const audioDecoderConfig = firstAudio
    ? await firstAudio.getDecoderConfig()
    : null;

  await output.start();

  let videoOffset = 0;
  let audioOffset = 0;
  let videoMetaSent = false;
  let audioMetaSent = false;

  for (const buffer of buffers) {
    const input = new Input({
      source: new BlobSource(new Blob([buffer])),
      formats: ALL_FORMATS,
    });
    const videoTrack = await input.getPrimaryVideoTrack();
    if (!videoTrack) {
      throw new Error("concat_no_video_track");
    }

    const videoSink = new EncodedPacketSink(videoTrack);
    for await (const packet of videoSink.packets()) {
      await videoSource.add(
        packet.clone({ timestamp: packet.timestamp + videoOffset }),
        videoMetaSent || !videoDecoderConfig
          ? undefined
          : { decoderConfig: videoDecoderConfig }
      );
      videoMetaSent = true;
    }
    videoOffset += await videoTrack.computeDuration();

    if (audioSource) {
      const audioTrack = await input.getPrimaryAudioTrack();
      if (audioTrack) {
        const audioSink = new EncodedPacketSink(audioTrack);
        for await (const packet of audioSink.packets()) {
          await audioSource.add(
            packet.clone({ timestamp: packet.timestamp + audioOffset }),
            audioMetaSent || !audioDecoderConfig
              ? undefined
              : { decoderConfig: audioDecoderConfig }
          );
          audioMetaSent = true;
        }
        audioOffset += await audioTrack.computeDuration();
      }
    }
  }

  await output.finalize();
  const result = output.target.buffer;
  if (!result) {
    throw new Error("concat_empty_output");
  }
  return result;
}
