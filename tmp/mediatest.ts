import { Input, UrlSource, ALL_FORMATS } from "./public/vendor/mediabunny/dist/modules/src/index.js";
const source = new UrlSource("http://localhost:2101/media/nicovideo_sm9.faudio-aac-128kbps.mp4");
const input = new Input({ source, formats: ALL_FORMATS });
const audioTrack = await input.getPrimaryAudioTrack();
console.log("track?", !!audioTrack);
if (audioTrack) {
  console.log("codec", audioTrack.codec);
  console.log("canDecode", await audioTrack.canDecode());
}
