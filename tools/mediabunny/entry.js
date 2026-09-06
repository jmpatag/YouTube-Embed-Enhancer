// The bits of Mediabunny that remuxToMp4() actually touches. esbuild follows
// this and throws away the rest (mp3/wav/ogg/flac/adts/hls parsers, sample
// sinks, file targets, ...), which is where the ~300 KB saving comes from.

export {
  Input,
  Output,
  Conversion,
  BlobSource,
  BufferTarget,
  Mp4OutputFormat,

  // input containers — only what MediaRecorder can hand us:
  // webm/mkv on Chrome/Firefox, mp4/mov on Safari. Add more here if that changes.
  Mp4InputFormat,
  QuickTimeInputFormat,
  MatroskaInputFormat,
  WebMInputFormat,
} from 'mediabunny';
